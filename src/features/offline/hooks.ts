"use client"

import { useCallback, useEffect, useState, useSyncExternalStore } from "react"
import { toast } from "sonner"

import * as idb from "./idb"
import type { OfflineRecord } from "./queue"
import { notifyChange, onChange, syncNow, type SyncSummary } from "./sync-client"

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback)
  window.addEventListener("offline", callback)
  return () => {
    window.removeEventListener("online", callback)
    window.removeEventListener("offline", callback)
  }
}

/** Estado de la conexión según el navegador (en el servidor se asume en línea). */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true)
}

/** Registros del usuario guardados en el dispositivo; se actualiza con cualquier cambio en la cola. */
export function useOfflineRecords(userId: string | null) {
  const [records, setRecords] = useState<OfflineRecord[] | null>(null)

  const reload = useCallback(async () => {
    if (!userId || !idb.isSupported()) {
      setRecords([])
      return
    }
    try {
      setRecords(await idb.listRecords(userId))
    } catch {
      setRecords([])
    }
  }, [userId])

  useEffect(() => {
    // Carga inicial asíncrona desde IndexedDB.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
    return onChange(() => void reload())
  }, [reload])

  return { records, reload }
}

export function describeSummary(summary: SyncSummary): string | null {
  const parts: string[] = []
  if (summary.synced) parts.push(summary.synced === 1 ? "1 registro sincronizado" : `${summary.synced} registros sincronizados`)
  if (summary.photos) parts.push(summary.photos === 1 ? "1 fotografía cargada" : `${summary.photos} fotografías cargadas`)
  if (summary.review) parts.push(summary.review === 1 ? "1 requiere revisión" : `${summary.review} requieren revisión`)
  return parts.length ? parts.join(" · ") : null
}

const AUTO_SYNC_INTERVAL_MS = 60_000

/**
 * Sincroniza en segundo plano: al abrir, al recuperar la conexión, al volver a
 * la pestaña y cada minuto mientras haya pendientes. También responde al
 * Background Sync del service worker cuando el navegador lo soporta.
 */
export function useAutoSync(userId: string | null, { notify = true }: { notify?: boolean } = {}) {
  useEffect(() => {
    if (!userId || !idb.isSupported()) return
    let cancelled = false

    const run = async () => {
      if (cancelled || !navigator.onLine) return
      try {
        const summary = await syncNow(userId)
        const text = summary && describeSummary(summary)
        if (notify && text && !cancelled) {
          if (summary.review) toast.warning(text)
          else toast.success(text)
        }
        if (notify && summary?.sessionExpired && !cancelled) {
          toast.error("Tu sesión expiró. Inicia sesión para enviar los registros pendientes.")
        }
      } catch {
        // Falla inesperada de IndexedDB o red: se intenta en el siguiente ciclo.
      }
    }

    void run()
    const onOnline = () => void run()
    const onVisible = () => {
      if (document.visibilityState === "visible") void run()
    }
    const onWorkerMessage = (event: MessageEvent) => {
      if (event.data === "ag360:sync") void run()
    }
    window.addEventListener("online", onOnline)
    document.addEventListener("visibilitychange", onVisible)
    navigator.serviceWorker?.addEventListener("message", onWorkerMessage)
    const timer = window.setInterval(() => void run(), AUTO_SYNC_INTERVAL_MS)

    // Background Sync: el navegador despierta al service worker al volver la red.
    void navigator.serviceWorker?.ready
      .then((registration) => (registration as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } }).sync?.register("ag360-sync"))
      .catch(() => undefined)

    return () => {
      cancelled = true
      window.removeEventListener("online", onOnline)
      document.removeEventListener("visibilitychange", onVisible)
      navigator.serviceWorker?.removeEventListener("message", onWorkerMessage)
      window.clearInterval(timer)
    }
  }, [userId, notify])
}

export { notifyChange }
