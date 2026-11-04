import type { OfflineRecordType, OfflineStatus, SyncResult } from "./schemas"

/**
 * Reglas de la cola de sincronización (funciones puras, sin IndexedDB ni red).
 *
 *   pendiente ──► sincronizando ──► sincronizado      (el servidor confirmó)
 *                     │
 *                     ├──► error               (falla de red o del servidor: se reintenta solo, con espera creciente)
 *                     └──► requiere_revision   (regla de negocio, conflicto o descartado: espera al usuario)
 *
 * Un registro nunca pasa a «sincronizado» sin la confirmación del servidor, y
 * los registros con error o en revisión se conservan hasta que el usuario los
 * corrija, los reintente o los elimine.
 */
export type OfflineRecord = {
  /** Identificador local; también es el id del registro en el servidor (llave de idempotencia). */
  localId: string
  organizationId: string
  organizationName: string
  userId: string
  userName: string
  type: OfflineRecordType
  /** Fecha y hora de captura en el dispositivo (ISO 8601). */
  capturedAt: string
  /** Valores del formulario tal como se capturaron; el servidor los vuelve a validar. */
  payload: Record<string, unknown>
  /** Texto corto para la lista de pendientes (proyecto, parcela, fecha). */
  summary: string
  status: OfflineStatus
  attempts: number
  lastAttemptAt: string | null
  syncedAt: string | null
  error: string | null
  fieldErrors?: Record<string, string[]>
  /** Un revisor lo descartó en el servidor: ya no se reintenta. */
  discarded?: boolean
  photoCount: number
  photosPending: number
  updatedAt: string
}

export type PhotoStatus = "pendiente" | "subida" | "error"

export type OfflinePhoto = {
  id: string
  recordId: string
  name: string
  type: string
  size: number
  blob: Blob
  status: PhotoStatus
  error: string | null
}

const BASE_DELAY_MS = 15_000
const MAX_DELAY_MS = 30 * 60_000
/** Un registro «sincronizando» sin respuesta en este tiempo se considera interrumpido. */
export const STALE_SYNC_MS = 2 * 60_000

/** Espera antes del siguiente reintento automático: 15 s, 30 s, 1 min… hasta 30 min. */
export function backoffMs(attempts: number): number {
  return Math.min(BASE_DELAY_MS * 2 ** Math.max(0, attempts - 1), MAX_DELAY_MS)
}

export function newRecord(
  input: Pick<OfflineRecord, "localId" | "organizationId" | "organizationName" | "userId" | "userName" | "type" | "payload" | "summary"> & {
    photoCount?: number
  },
  now: Date
): OfflineRecord {
  const iso = now.toISOString()
  return {
    ...input,
    capturedAt: iso,
    status: "pendiente",
    attempts: 0,
    lastAttemptAt: null,
    syncedAt: null,
    error: null,
    photoCount: input.photoCount ?? 0,
    photosPending: input.photoCount ?? 0,
    updatedAt: iso,
  }
}

/** ¿Se envía en la sincronización automática? Los registros en revisión esperan al usuario. */
export function isDueForSync(record: OfflineRecord, userId: string, now: Date): boolean {
  if (record.userId !== userId || record.discarded) return false
  if (record.status === "pendiente") return true
  if (record.status === "error") {
    const last = record.lastAttemptAt ? Date.parse(record.lastAttemptAt) : 0
    return now.getTime() - last >= backoffMs(record.attempts)
  }
  return false
}

export function markSyncing(record: OfflineRecord, now: Date): OfflineRecord {
  const iso = now.toISOString()
  return { ...record, status: "sincronizando", attempts: record.attempts + 1, lastAttemptAt: iso, updatedAt: iso }
}

/** Resultado confirmado por el servidor. */
export function applyResult(record: OfflineRecord, result: SyncResult, now: Date): OfflineRecord {
  const iso = now.toISOString()
  if (result.status === "sincronizado") {
    return { ...record, status: "sincronizado", syncedAt: result.syncedAt, error: null, fieldErrors: undefined, updatedAt: iso }
  }
  return {
    ...record,
    status: "requiere_revision",
    error: result.message,
    fieldErrors: result.fieldErrors,
    discarded: result.discarded || undefined,
    updatedAt: iso,
  }
}

/** Falla transitoria (sin red, servidor no disponible, sesión vencida): se conserva y se reintenta. */
export function applyFailure(record: OfflineRecord, message: string, now: Date): OfflineRecord {
  return { ...record, status: "error", error: message, updatedAt: now.toISOString() }
}

/** Al abrir la aplicación: un envío que quedó a medias vuelve a la cola (el reenvío es idempotente). */
export function recoverInterrupted(record: OfflineRecord, now: Date): OfflineRecord {
  if (record.status !== "sincronizando") return record
  const last = record.lastAttemptAt ? Date.parse(record.lastAttemptAt) : 0
  return now.getTime() - last >= STALE_SYNC_MS ? { ...record, status: "pendiente", updatedAt: now.toISOString() } : record
}

/** Reintento manual: también para registros en revisión, salvo los descartados. */
export function canRetry(record: OfflineRecord): boolean {
  return !record.discarded && (record.status === "error" || record.status === "requiere_revision")
}

export function retry(record: OfflineRecord, now: Date): OfflineRecord {
  if (!canRetry(record)) return record
  return { ...record, status: "pendiente", lastAttemptAt: null, updatedAt: now.toISOString() }
}

/** Solo se corrige lo que aún no está confirmado ni en envío. */
export function canEdit(record: OfflineRecord): boolean {
  return !record.discarded && (record.status === "pendiente" || record.status === "error" || record.status === "requiere_revision")
}

export function applyEdit(record: OfflineRecord, payload: Record<string, unknown>, summary: string, now: Date): OfflineRecord {
  if (!canEdit(record)) return record
  return { ...record, payload, summary, status: "pendiente", error: null, fieldErrors: undefined, updatedAt: now.toISOString() }
}

/** Un registro sincronizado se puede retirar del dispositivo; los demás solo con confirmación explícita. */
export function needsConfirmToDelete(record: OfflineRecord): boolean {
  return record.status !== "sincronizado" || record.photosPending > 0
}

export function countByStatus(records: OfflineRecord[]): Record<OfflineStatus, number> {
  const counts: Record<OfflineStatus, number> = { pendiente: 0, sincronizando: 0, sincronizado: 0, error: 0, requiere_revision: 0 }
  for (const r of records) counts[r.status]++
  return counts
}

/** Registros que aún necesitan algo (envío o carga de fotografías). */
export function unsyncedCount(records: OfflineRecord[]): number {
  return records.filter((r) => r.status !== "sincronizado" || r.photosPending > 0).length
}
