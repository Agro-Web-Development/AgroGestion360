import { attachmentPath } from "@/features/fieldlogs/schemas"
import { createClient } from "@/lib/supabase/client"
import * as idb from "./idb"
import { applyFailure, applyResult, isDueForSync, markSyncing, recoverInterrupted, type OfflineRecord } from "./queue"
import { RECORD_ATTACHMENT_ENTITY, type Submission, type SyncResult } from "./schemas"

/**
 * Motor de sincronización del dispositivo. Un solo envío a la vez entre todas
 * las pestañas (Web Locks); cada registro se envía con su id local como llave
 * de idempotencia y solo cambia a «sincronizado» con la confirmación del
 * servidor. Las fotografías se suben después, cuando el registro ya existe.
 */
const CHANNEL = "ag360-campo"
const EVENT = "ag360:campo-cambio"

export type SyncSummary = {
  synced: number
  review: number
  failed: number
  photos: number
  sessionExpired: boolean
  offline: boolean
}

/** Avisa a esta y otras pestañas que la cola cambió. */
export function notifyChange() {
  window.dispatchEvent(new Event(EVENT))
  try {
    const channel = new BroadcastChannel(CHANNEL)
    channel.postMessage("cambio")
    channel.close()
  } catch {
    // BroadcastChannel no disponible: basta el evento local.
  }
}

export function onChange(listener: () => void): () => void {
  window.addEventListener(EVENT, listener)
  let channel: BroadcastChannel | null = null
  try {
    channel = new BroadcastChannel(CHANNEL)
    channel.onmessage = listener
  } catch {
    channel = null
  }
  return () => {
    window.removeEventListener(EVENT, listener)
    channel?.close()
  }
}

let localLock = false

async function withLock<T>(run: () => Promise<T>): Promise<T | null> {
  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks.request("ag360-sync", { ifAvailable: true }, (lock) => (lock ? run() : null))
  }
  if (localLock) return null
  localLock = true
  try {
    return await run()
  } finally {
    localLock = false
  }
}

function toSubmission(record: OfflineRecord): Submission {
  return {
    localId: record.localId,
    organizationId: record.organizationId,
    userId: record.userId,
    type: record.type,
    capturedAt: record.capturedAt,
    payload: { ...record.payload, id: record.localId },
  }
}

async function readError(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as { error?: string }
    return body.error ?? null
  } catch {
    return null
  }
}

/**
 * Envía los registros del usuario que estén pendientes (o con error cuya espera
 * ya terminó). Con `only`, envía exactamente esos registros (reintento manual).
 */
export async function syncNow(userId: string, only?: string[]): Promise<SyncSummary | null> {
  if (!idb.isSupported()) return null
  return withLock(async () => {
    const summary: SyncSummary = { synced: 0, review: 0, failed: 0, photos: 0, sessionExpired: false, offline: false }
    const now = () => new Date()
    let records = await idb.listRecords(userId)

    for (const r of records) {
      const recovered = recoverInterrupted(r, now())
      if (recovered !== r) await idb.putRecord(recovered)
    }
    records = await idb.listRecords(userId)
    const due = records.filter((r) =>
      only ? only.includes(r.localId) && r.status === "pendiente" : isDueForSync(r, userId, now())
    )

    for (const record of due) {
      const sending = await idb.updateRecord(record.localId, (r) => markSyncing(r, now()))
      if (!sending) continue
      notifyChange()

      let response: Response
      try {
        response = await fetch("/api/campo/sincronizar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(toSubmission(sending)),
          credentials: "same-origin",
          cache: "no-store",
        })
      } catch {
        await idb.updateRecord(record.localId, (r) => applyFailure(r, "Sin conexión con el servidor. Se reintentará.", now()))
        summary.failed++
        summary.offline = true
        break
      }

      if (response.status === 401) {
        await idb.updateRecord(record.localId, (r) => applyFailure(r, "Tu sesión expiró. Inicia sesión para sincronizar.", now()))
        summary.failed++
        summary.sessionExpired = true
        break
      }
      if (response.ok) {
        const result = (await response.json()) as SyncResult
        await idb.updateRecord(record.localId, (r) => applyResult(r, result, now()))
        if (result.status === "sincronizado") summary.synced++
        else summary.review++
      } else if (response.status === 400) {
        // Solicitud mal formada: reenviarla igual no la corrige.
        const message = (await readError(response)) ?? "El servidor rechazó el registro."
        await idb.updateRecord(record.localId, (r) => applyResult(r, { status: "requiere_revision", message }, now()))
        summary.review++
      } else {
        const message = (await readError(response)) ?? "El servidor no está disponible. Se reintentará."
        await idb.updateRecord(record.localId, (r) => applyFailure(r, message, now()))
        summary.failed++
      }
      notifyChange()
    }

    if (!summary.offline && !summary.sessionExpired) {
      const withPhotos = (await idb.listRecords(userId)).filter((r) => r.status === "sincronizado" && r.photosPending > 0)
      for (const r of withPhotos) summary.photos += await uploadPhotos(r)
    }
    notifyChange()
    return summary
  })
}

function alreadyExists(error: { message?: string } & Record<string, unknown>): boolean {
  return String(error.statusCode ?? error.status ?? "") === "409" || /already exists/i.test(error.message ?? "")
}

/**
 * Sube las fotografías de un registro ya sincronizado. La ruta usa el id de la
 * foto, así que un reintento reemplaza la misma ruta en lugar de duplicarla.
 * Las fotos subidas se retiran del dispositivo para liberar espacio.
 */
async function uploadPhotos(record: OfflineRecord): Promise<number> {
  const photos = (await idb.listPhotos(record.localId)).filter((p) => p.status !== "subida")
  if (photos.length === 0) {
    await idb.updateRecord(record.localId, (r) => ({ ...r, photosPending: 0 }))
    return 0
  }
  const supabase = createClient()
  const entity = RECORD_ATTACHMENT_ENTITY[record.type]
  const uploaded: { photo: (typeof photos)[number]; path: string }[] = []

  for (const photo of photos) {
    const path = attachmentPath(record.organizationId, entity, record.localId, photo.id, photo.name)
    const { error } = await supabase.storage.from("evidencias").upload(path, photo.blob, { contentType: photo.type, upsert: false })
    if (error && !alreadyExists(error as never)) {
      await idb.putPhoto({ ...photo, status: "error", error: error.message })
      continue
    }
    uploaded.push({ photo, path })
  }

  let registered = 0
  if (uploaded.length > 0) {
    try {
      const response = await fetch("/api/campo/evidencias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({
          organizationId: record.organizationId,
          type: record.type,
          entityId: record.localId,
          files: uploaded.map(({ photo, path }) => ({ path, name: photo.name.slice(0, 200), type: photo.type, size: photo.size })),
        }),
      })
      if (response.ok) {
        for (const { photo } of uploaded) await idb.deletePhoto(photo.id)
        registered = uploaded.length
      } else {
        const message = (await readError(response)) ?? "No se pudieron registrar las fotografías."
        for (const { photo } of uploaded) await idb.putPhoto({ ...photo, status: "error", error: message })
      }
    } catch {
      // Sin red: se reintentará en la siguiente sincronización.
    }
  }

  const remaining = (await idb.listPhotos(record.localId)).length
  await idb.updateRecord(record.localId, (r) => ({ ...r, photosPending: remaining }))
  return registered
}
