"use client"

import { CloudOff, RefreshCw } from "lucide-react"
import { useEffect } from "react"

import { cacheFieldShell } from "@/components/pwa/service-worker"
import { Badge } from "@/components/ui/badge"
import { useAutoSync, useOfflineRecords, useOnline } from "@/features/offline/hooks"
import { unsyncedCount } from "@/features/offline/queue"

/**
 * Indicador de conexión y de registros capturados sin conexión pendientes de
 * enviar. También mantiene la sincronización automática mientras el usuario
 * navega por la aplicación y prepara la captura en campo para usarse sin red.
 */
export function ConnectionStatus({ userId }: { userId: string }) {
  const online = useOnline()
  const { records } = useOfflineRecords(userId)
  useAutoSync(userId)
  useEffect(() => cacheFieldShell(), [])

  const pending = records ? unsyncedCount(records) : 0
  if (online && pending === 0) return null

  return (
    <a href="/campo" className="shrink-0" title="Abrir captura en campo">
      <Badge
        variant="outline"
        className={
          online
            ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
            : "border-destructive/30 bg-destructive/10 text-destructive"
        }
      >
        {online ? <RefreshCw aria-hidden /> : <CloudOff aria-hidden />}
        {!online ? "Sin conexión" : pending === 1 ? "1 por sincronizar" : `${pending} por sincronizar`}
        {!online && pending > 0 && ` · ${pending}`}
      </Badge>
    </a>
  )
}
