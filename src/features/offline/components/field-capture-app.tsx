"use client"

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  CloudOff,
  Droplets,
  Eye,
  FlaskConical,
  ImageIcon,
  Loader2,
  Pencil,
  RefreshCw,
  RotateCcw,
  Trash2,
  Wheat,
  Wifi,
  type LucideIcon,
} from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { Logo } from "@/components/brand/logo"
import { ConfirmAction } from "@/components/shared/confirm-action"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDateTime } from "@/lib/format"
import { compressImage } from "@/lib/image"
import { newId } from "@/lib/ids"
import { cn } from "@/lib/utils"
import type { OfflineCatalog } from "../catalog"
import { describeSummary, useAutoSync, useOfflineRecords, useOnline } from "../hooks"
import * as idb from "../idb"
import { applyEdit, canEdit, canRetry, countByStatus, newRecord, retry, unsyncedCount, type OfflineRecord } from "../queue"
import { OFFLINE_RECORD_TYPES, RECORD_TYPE_LABELS, STATUS_LABELS, type OfflineRecordType, type OfflineStatus } from "../schemas"
import { notifyChange, syncNow } from "../sync-client"
import { CaptureForm, type CaptureSubmit } from "./capture-forms"

const TYPE_ICONS: Record<OfflineRecordType, LucideIcon> = {
  riego: Droplets,
  actividad: ClipboardList,
  aplicacion: FlaskConical,
  observacion: Eye,
  cosecha: Wheat,
}

const TYPE_HINTS: Record<OfflineRecordType, string> = {
  riego: "Horario, sistema y agua aplicada",
  actividad: "Labores de campo por parcela",
  aplicacion: "Agroquímicos, biológicos y fertilizantes",
  observacion: "Plagas, enfermedades, clima",
  cosecha: "Cortes por calidad y unidad",
}

const STATUS_STYLES: Record<OfflineStatus, string> = {
  pendiente: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  sincronizando: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  sincronizado: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  error: "border-destructive/30 bg-destructive/10 text-destructive",
  requiere_revision: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300",
}

type ContextState =
  | { kind: "loading" }
  | { kind: "ready"; catalog: OfflineCatalog; fresh: boolean }
  | { kind: "signed-out" }
  | { kind: "unavailable" }
  | { kind: "unsupported" }

/** Lee la sesión y los catálogos: del servidor si hay red, del dispositivo si no. */
function useFieldContext() {
  const [state, setState] = useState<ContextState>({ kind: "loading" })
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (fromServer: boolean) => {
    if (!idb.isSupported()) {
      setState({ kind: "unsupported" })
      return
    }
    const stored = await idb.getContext().catch(() => null)
    if (stored) setState({ kind: "ready", catalog: stored, fresh: false })
    if (!fromServer || !navigator.onLine) {
      if (!stored) setState({ kind: "unavailable" })
      return
    }
    setRefreshing(true)
    try {
      const response = await fetch("/api/campo/contexto", { credentials: "same-origin", cache: "no-store" })
      if (response.status === 401) {
        await idb.clearContext()
        setState({ kind: "signed-out" })
        return
      }
      if (!response.ok) throw new Error("catalogo")
      const catalog = (await response.json()) as OfflineCatalog
      await idb.saveContext(catalog)
      setState({ kind: "ready", catalog, fresh: true })
    } catch {
      if (!stored) setState({ kind: "unavailable" })
      else toast.warning("No se pudieron actualizar los catálogos; se usan los guardados en el dispositivo.")
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(true)
  }, [load])

  return { state, refreshing, refresh: () => load(true) }
}

/**
 * Captura en campo: funciona sin conexión. Los registros se guardan en el
 * dispositivo (IndexedDB) y se envían al servidor cuando hay red.
 */
export function FieldCaptureApp() {
  const online = useOnline()
  const { state, refreshing, refresh } = useFieldContext()
  const catalog = state.kind === "ready" ? state.catalog : null
  const userId = catalog?.user.id ?? null
  const { records } = useOfflineRecords(userId)
  const [tab, setTab] = useState<"capturar" | "pendientes">("capturar")
  const [editing, setEditing] = useState<{ type: OfflineRecordType; record?: OfflineRecord } | null>(null)
  const [syncing, setSyncing] = useState(false)
  useAutoSync(userId)

  const pending = records ? unsyncedCount(records) : 0

  const runSync = async (only?: string[]) => {
    if (!userId) return
    if (!navigator.onLine) {
      toast.info("Sin conexión. Los registros se enviarán cuando vuelva la señal.")
      return
    }
    setSyncing(true)
    try {
      const summary = await syncNow(userId, only)
      if (!summary) toast.info("Ya hay una sincronización en curso.")
      else if (summary.sessionExpired) toast.error("Tu sesión expiró. Inicia sesión para enviar los registros.")
      else if (summary.offline) toast.error("No hay conexión con el servidor. Se reintentará automáticamente.")
      else toast.success(describeSummary(summary) ?? "No hay registros por enviar.")
    } finally {
      setSyncing(false)
    }
  }

  const save = async (type: OfflineRecordType, data: CaptureSubmit, existing?: OfflineRecord) => {
    if (!catalog) return
    const now = new Date()
    if (existing) {
      await idb.updateRecord(existing.localId, (r) => applyEdit(r, data.payload, data.summary, now))
    } else {
      const localId = String(data.payload.id)
      const files = await Promise.all(data.photos.map(compressImage))
      const record = newRecord(
        {
          localId,
          organizationId: catalog.organization.id,
          organizationName: catalog.organization.name,
          userId: catalog.user.id,
          userName: catalog.user.fullName || catalog.user.email,
          type,
          payload: data.payload,
          summary: data.summary,
          photoCount: files.length,
        },
        now
      )
      await idb.saveRecord(
        record,
        files.map((f) => ({ id: newId(), recordId: localId, name: f.name, type: f.type, size: f.size, blob: f, status: "pendiente", error: null }))
      )
      // Pide almacenamiento persistente: el navegador no debe borrar registros sin sincronizar por falta de espacio.
      void navigator.storage?.persist?.().catch(() => false)
    }
    notifyChange()
    setEditing(null)
    toast.success(navigator.onLine ? "Guardado. Enviando al servidor…" : "Guardado en el dispositivo. Se enviará cuando haya señal.")
    if (navigator.onLine && catalog) void syncNow(catalog.user.id)
  }

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <a href="/dashboard" className="shrink-0" aria-label="Ir al panel">
            <Logo compact />
          </a>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">Captura en campo</p>
            <p className="truncate text-xs text-muted-foreground">
              {catalog ? `${catalog.organization.name} · ${catalog.user.fullName || catalog.user.email}` : "Sin sesión descargada"}
            </p>
          </div>
          <Badge variant="outline" className={cn("gap-1", online ? STATUS_STYLES.sincronizado : STATUS_STYLES.pendiente)}>
            {online ? <Wifi aria-hidden /> : <CloudOff aria-hidden />}
            {online ? "En línea" : "Sin conexión"}
          </Badge>
        </div>
      </header>

      <main className="mx-auto grid max-w-3xl gap-4 px-4 py-4 pb-24">
        {state.kind === "loading" && (
          <p className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Cargando…
          </p>
        )}
        {state.kind === "unsupported" && (
          <Notice title="Navegador no compatible" text="Este navegador no permite guardar información sin conexión. Usa Chrome, Edge, Safari o Firefox actualizados." />
        )}
        {state.kind === "signed-out" && (
          <Notice
            title="Inicia sesión"
            text="Para capturar sin conexión primero inicia sesión con internet: así se descargan tus proyectos y catálogos."
            action={<a href="/login?next=/campo" className="text-sm font-medium text-primary underline">Iniciar sesión</a>}
          />
        )}
        {state.kind === "unavailable" && (
          <Notice
            title="Sin catálogos en este dispositivo"
            text="Conéctate a internet y abre esta pantalla una vez con tu sesión iniciada para descargar proyectos, parcelas y catálogos."
          />
        )}

        {catalog && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Catálogos del {formatDateTime(catalog.generatedAt)}</span>
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => void refresh()} disabled={!online || refreshing}>
                <RefreshCw className={cn(refreshing && "animate-spin")} aria-hidden /> Actualizar
              </Button>
              <a href="/dashboard" className="ml-auto inline-flex items-center gap-1 font-medium text-primary">
                <ArrowLeft className="size-3.5" aria-hidden /> Panel
              </a>
            </div>

            {editing ? (
              <Card>
                <CardHeader>
                  <CardTitle>{RECORD_TYPE_LABELS[editing.type]}</CardTitle>
                  <CardDescription>
                    {editing.record
                      ? "Corrige los datos y se volverá a enviar."
                      : "Se guarda en este dispositivo y se envía al servidor cuando haya conexión."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CaptureForm
                    key={editing.record?.localId ?? editing.type}
                    type={editing.type}
                    catalog={catalog}
                    id={editing.record?.localId ?? newId()}
                    initial={editing.record?.payload}
                    allowPhotos={!editing.record}
                    onSubmit={(data) => save(editing.type, data, editing.record)}
                    onCancel={() => setEditing(null)}
                  />
                </CardContent>
              </Card>
            ) : (
              <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
                <TabsList className="w-full">
                  <TabsTrigger value="capturar" className="flex-1">Nuevo registro</TabsTrigger>
                  <TabsTrigger value="pendientes" className="flex-1">
                    Registros {pending > 0 && <Badge className="ml-1">{pending}</Badge>}
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="capturar" className="mt-4">
                  <TypePicker catalog={catalog} onPick={(type) => setEditing({ type })} />
                </TabsContent>
                <TabsContent value="pendientes" className="mt-4">
                  <RecordList
                    records={records ?? []}
                    online={online}
                    syncing={syncing}
                    onSync={() => void runSync()}
                    onRetry={async (record) => {
                      await idb.updateRecord(record.localId, (r) => retry(r, new Date()))
                      notifyChange()
                      await runSync([record.localId])
                    }}
                    onEdit={(record) => setEditing({ type: record.type, record })}
                  />
                </TabsContent>
              </Tabs>
            )}
          </>
        )}
      </main>
    </div>
  )
}

function Notice({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{text}</CardDescription>
      </CardHeader>
      {action && <CardContent>{action}</CardContent>}
    </Card>
  )
}

function TypePicker({ catalog, onPick }: { catalog: OfflineCatalog; onPick: (type: OfflineRecordType) => void }) {
  const allowed = OFFLINE_RECORD_TYPES.filter((t) => (t === "cosecha" ? catalog.permissions.harvest : catalog.permissions.fieldlogs))
  if (allowed.length === 0) {
    return <Notice title="Solo consulta" text="Tu rol no permite capturar registros de campo en esta organización." />
  }
  if (catalog.projects.length === 0) {
    return <Notice title="Sin proyectos vigentes" text="No hay proyectos vigentes en los catálogos descargados. Actualiza los catálogos con conexión." />
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {allowed.map((type) => {
        const Icon = TYPE_ICONS[type]
        return (
          <button
            key={type}
            type="button"
            onClick={() => onPick(type)}
            className="flex min-h-20 items-center gap-4 rounded-xl border bg-card p-4 text-left shadow-xs transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-5" aria-hidden />
            </span>
            <span className="grid gap-0.5">
              <span className="font-medium">{RECORD_TYPE_LABELS[type]}</span>
              <span className="text-xs text-muted-foreground">{TYPE_HINTS[type]}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

function RecordList({
  records,
  online,
  syncing,
  onSync,
  onRetry,
  onEdit,
}: {
  records: OfflineRecord[]
  online: boolean
  syncing: boolean
  onSync: () => void
  onRetry: (record: OfflineRecord) => Promise<void>
  onEdit: (record: OfflineRecord) => void
}) {
  const counts = countByStatus(records)
  const synced = records.filter((r) => r.status === "sincronizado" && r.photosPending === 0)

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(counts) as OfflineStatus[])
          .filter((s) => counts[s] > 0)
          .map((s) => (
            <Badge key={s} variant="outline" className={STATUS_STYLES[s]}>
              {STATUS_LABELS[s]}: {counts[s]}
            </Badge>
          ))}
        <div className="ml-auto flex gap-2">
          {synced.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                for (const r of synced) await idb.deleteRecord(r.localId)
                notifyChange()
              }}
            >
              Limpiar sincronizados
            </Button>
          )}
          <Button size="sm" onClick={onSync} disabled={!online || syncing}>
            {syncing ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />} Sincronizar
          </Button>
        </div>
      </div>

      {records.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No hay registros capturados en este dispositivo.</p>
      ) : (
        <ul className="grid gap-3" aria-label="Registros capturados">
          {records.map((record) => (
            <RecordItem key={record.localId} record={record} onRetry={onRetry} onEdit={onEdit} />
          ))}
        </ul>
      )}
    </div>
  )
}

function RecordItem({
  record,
  onRetry,
  onEdit,
}: {
  record: OfflineRecord
  onRetry: (record: OfflineRecord) => Promise<void>
  onEdit: (record: OfflineRecord) => void
}) {
  const Icon = TYPE_ICONS[record.type]
  const [busy, setBusy] = useState(false)
  const fieldErrors = [...new Set(Object.values(record.fieldErrors ?? {}).flat())].filter((m) => m !== record.error)

  return (
    <li className="rounded-xl border bg-card p-4 shadow-xs" data-status={record.status}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{RECORD_TYPE_LABELS[record.type]}</p>
            <Badge variant="outline" className={STATUS_STYLES[record.status]}>
              {record.status === "sincronizando" && <Loader2 className="animate-spin" aria-hidden />}
              {record.status === "sincronizado" && <CheckCircle2 aria-hidden />}
              {(record.status === "error" || record.status === "requiere_revision") && <AlertTriangle aria-hidden />}
              {record.discarded ? "Descartado" : STATUS_LABELS[record.status]}
            </Badge>
          </div>
          <p className="text-sm break-words text-muted-foreground">{record.summary}</p>
          <p className="text-xs text-muted-foreground">
            Capturado {formatDateTime(record.capturedAt)}
            {record.syncedAt && ` · sincronizado ${formatDateTime(record.syncedAt)}`}
            {record.attempts > 0 && ` · ${record.attempts} ${record.attempts === 1 ? "intento" : "intentos"}`}
            {record.organizationName && ` · ${record.organizationName}`}
          </p>
          {record.photoCount > 0 && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <ImageIcon className="size-3.5" aria-hidden />
              {record.photosPending > 0
                ? `${record.photosPending} de ${record.photoCount} fotografías pendientes de carga`
                : `${record.photoCount} fotografías cargadas`}
            </p>
          )}
          {record.error && record.status !== "sincronizado" && (
            <div className="rounded-md bg-muted/60 p-2 text-sm">
              <p>{record.error}</p>
              {fieldErrors.length > 0 && (
                <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">
                  {fieldErrors.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
      {(canRetry(record) || canEdit(record) || record.status !== "sincronizando") && (
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          {canEdit(record) && (
            <Button variant="outline" size="sm" onClick={() => onEdit(record)}>
              <Pencil aria-hidden /> Corregir
            </Button>
          )}
          {canRetry(record) && (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                await onRetry(record)
                setBusy(false)
              }}
            >
              <RotateCcw aria-hidden /> Reintentar
            </Button>
          )}
          {record.status !== "sincronizando" && (
            <ConfirmAction
              title="Eliminar del dispositivo"
              description={
                record.status === "sincronizado" && record.photosPending === 0
                  ? "El registro ya está en el servidor; solo se retira de este dispositivo."
                  : "Este registro no se ha sincronizado por completo. Si lo eliminas, se perderá lo capturado (y sus fotografías pendientes)."
              }
              confirmLabel="Eliminar"
              action={async () => {
                await idb.deleteRecord(record.localId)
                notifyChange()
                return { ok: true, data: undefined, message: "Registro eliminado del dispositivo." }
              }}
              trigger={
                <Button variant="ghost" size="sm" aria-label="Eliminar del dispositivo">
                  <Trash2 aria-hidden />
                </Button>
              }
            />
          )}
        </div>
      )}
    </li>
  )
}
