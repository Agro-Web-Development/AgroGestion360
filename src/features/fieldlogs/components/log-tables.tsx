"use client"

import { Ban, Pencil } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"

import type { SelectOption } from "@/components/forms/form-select"
import { CatalogRowActions } from "@/components/shared/catalog-row-actions"
import { ReasonDialog } from "@/components/shared/reason-dialog"
import { matchesQuery, SearchInput } from "@/components/shared/search-input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { IRRIGATION_LABELS } from "@/features/farms/schemas"
import { BUDGET_CATEGORY_LABELS } from "@/features/finance/schemas"
import type { OpenProject } from "@/features/projects/queries"
import { isClosed, type ProjectStatus } from "@/features/projects/status"
import type { ActionResult } from "@/lib/actions"
import { formatDate, formatMoney, formatNumber } from "@/lib/format"
import { toInput, NONE } from "@/lib/validation"
import { cancelApplication, cancelFieldRecord, deleteActivityType, setActivityTypeActive } from "../actions"
import type { ActivityType, Application, FieldActivity, FieldObservation, IrrigationLog } from "../queries"
import {
  appliedRate,
  formatDuration,
  OBSERVATION_CATEGORY_LABELS,
  SEVERITY_LABELS,
  type AttachmentEntity,
  type ObservationCategory,
  type ObservationSeverity,
} from "../schemas"
import { EvidenceDialog } from "./evidence"
import { ActivityDialog, ActivityTypeDialog, ApplicationEditDialog, IrrigationDialog } from "./log-dialogs"

const ALL = "todos"

type Shared = {
  organizationId: string
  canWrite: boolean
  employees: SelectOption[]
  projects: OpenProject[]
}

type Row = { status: string; cancel_reason: string | null; project: { id: string; code: string; status: ProjectStatus } }

/** Filtro por texto y proyecto común a las bitácoras. */
function useLogFilter<T extends Row>(rows: T[], text: (r: T) => (string | null | undefined)[]) {
  const [query, setQuery] = useState("")
  const [projectId, setProjectId] = useState(ALL)
  const [showCancelled, setShowCancelled] = useState(false)
  const projects = useMemo(
    () => [...new Map(rows.map((r) => [r.project.id, r.project.code])).entries()].sort((a, b) => a[1].localeCompare(b[1])),
    [rows]
  )
  const filtered = rows.filter(
    (r) =>
      (showCancelled || r.status !== "cancelado") &&
      (projectId === ALL || r.project.id === projectId) &&
      matchesQuery(query, ...text(r))
  )
  const controls = (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <SearchInput value={query} onChange={setQuery} placeholder="Buscar en la bitácora" />
      {projects.length > 1 && (
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger className="w-full sm:w-56" aria-label="Filtrar por proyecto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los proyectos</SelectItem>
            {projects.map(([id, code]) => (
              <SelectItem key={id} value={id}>
                {code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={showCancelled}
          onChange={(e) => setShowCancelled(e.target.checked)}
          className="size-4 accent-primary"
        />
        Mostrar cancelados
      </label>
    </div>
  )
  return { filtered, controls }
}

function ProjectCell({ project, plot }: { project: Row["project"]; plot?: string | null }) {
  return (
    <>
      <Link href={`/proyectos/${project.id}`} className="hover:underline">
        {project.code}
      </Link>
      <p className="text-xs text-muted-foreground">{plot ?? "Todo el proyecto"}</p>
    </>
  )
}

function CancelledBadge({ row }: { row: Row }) {
  if (row.status !== "cancelado") return null
  return (
    <Badge variant="destructive" title={row.cancel_reason ?? undefined}>
      Cancelado
    </Badge>
  )
}

function RowActions({
  row,
  canWrite,
  organizationId,
  entity,
  title,
  edit,
  cancel,
}: {
  row: Row & { id: string }
  canWrite: boolean
  organizationId: string
  entity: AttachmentEntity
  title: string
  edit?: React.ReactNode
  cancel: { description: string; action: (reason: string) => Promise<ActionResult> }
}) {
  const open = row.status !== "cancelado" && !isClosed(row.project.status)
  return (
    <div className="flex justify-end gap-1">
      <EvidenceDialog organizationId={organizationId} entity={entity} entityId={row.id} title={title} canAdd={canWrite && open} />
      {canWrite && open && edit}
      {canWrite && open && (
        <ReasonDialog
          title="Cancelar registro"
          description={cancel.description}
          confirmLabel="Cancelar registro"
          action={cancel.action}
          trigger={
            <Button variant="ghost" size="icon" aria-label={`Cancelar: ${title}`}>
              <Ban aria-hidden />
            </Button>
          }
        />
      )}
    </div>
  )
}

const editButton = (label: string) => (
  <Button variant="ghost" size="icon" aria-label={label}>
    <Pencil aria-hidden />
  </Button>
)

function Empty({ cols, text }: { cols: number; text: string }) {
  return (
    <TableRow>
      <TableCell colSpan={cols} className="py-8 text-center text-muted-foreground">
        {text}
      </TableCell>
    </TableRow>
  )
}

// -----------------------------------------------------------------------------
export function IrrigationTable({ logs, ...shared }: Shared & { logs: IrrigationLog[] }) {
  const { filtered, controls } = useLogFilter(logs, (r) => [r.project.code, r.assignment.plot.name, r.responsible?.full_name, r.notes])
  const active = filtered.filter((r) => r.status !== "cancelado")
  const water = active.reduce((s, r) => s + Number(r.water_m3 ?? 0), 0)
  const minutes = active.reduce((s, r) => s + (r.duration_minutes ?? 0), 0)

  return (
    <div className="space-y-3">
      {controls}
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha / horario</TableHead>
              <TableHead>Proyecto / parcela</TableHead>
              <TableHead className="hidden md:table-cell">Sistema</TableHead>
              <TableHead className="text-right">Duración</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Agua</TableHead>
              <TableHead className="hidden lg:table-cell">Responsable</TableHead>
              <TableHead className="w-28">
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && <Empty cols={7} text="Sin riegos en el periodo." />}
            {filtered.map((r) => (
              <TableRow key={r.id} className={r.status === "cancelado" ? "opacity-60" : undefined}>
                <TableCell className="whitespace-nowrap">
                  {formatDate(r.log_date)}
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {r.start_time.slice(0, 5)} – {r.end_time.slice(0, 5)}
                  </p>
                  <CancelledBadge row={r} />
                </TableCell>
                <TableCell>
                  <ProjectCell project={r.project} plot={r.assignment.plot.name} />
                </TableCell>
                <TableCell className="hidden md:table-cell">{IRRIGATION_LABELS[r.irrigation_system]}</TableCell>
                <TableCell className="text-right whitespace-nowrap tabular-nums">{formatDuration(r.duration_minutes)}</TableCell>
                <TableCell className="hidden text-right tabular-nums sm:table-cell">
                  {r.water_m3 !== null ? formatNumber(r.water_m3, "m³") : "—"}
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  {r.responsible?.full_name ?? "—"}
                  {r.notes && <p className="max-w-56 truncate text-xs text-muted-foreground">{r.notes}</p>}
                </TableCell>
                <TableCell>
                  <RowActions
                    row={r}
                    canWrite={shared.canWrite}
                    organizationId={shared.organizationId}
                    entity="irrigation_log"
                    title={`Riego ${r.project.code} · ${r.assignment.plot.name} · ${formatDate(r.log_date)}`}
                    edit={
                      <IrrigationDialog
                        organizationId={shared.organizationId}
                        projects={shared.projects}
                        employees={shared.employees}
                        trigger={editButton("Editar riego")}
                        record={{
                          id: r.id,
                          projectId: r.project_id,
                          plotId: r.plot_id,
                          date: r.log_date,
                          startTime: r.start_time.slice(0, 5),
                          endTime: r.end_time.slice(0, 5),
                          system: r.irrigation_system,
                          waterM3: toInput(r.water_m3),
                          responsibleId: r.responsible_id ?? NONE,
                          notes: r.notes ?? "",
                        }}
                      />
                    }
                    cancel={{
                      description: "El riego queda en el historial marcado como cancelado.",
                      action: (reason) => cancelFieldRecord("riego", r.id, reason),
                    }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          {active.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="font-medium">
                  {formatNumber(active.length)} riegos vigentes
                </TableCell>
                <TableCell className="hidden md:table-cell" />
                <TableCell className="text-right font-semibold tabular-nums">{formatDuration(minutes)}</TableCell>
                <TableCell className="hidden text-right font-semibold tabular-nums sm:table-cell">{formatNumber(water, "m³")}</TableCell>
                <TableCell className="hidden lg:table-cell" />
                <TableCell />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
export function ApplicationsTable({
  applications,
  machines,
  ...shared
}: Shared & { applications: Application[]; machines: SelectOption[] }) {
  const { filtered, controls } = useLogFilter(applications, (r) => [
    r.project.code,
    r.assignment.plot.name,
    r.product.name,
    r.active_ingredient,
    r.lot_number,
    r.responsible?.full_name,
  ])

  return (
    <div className="space-y-3">
      {controls}
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Producto / lote</TableHead>
              <TableHead className="hidden md:table-cell">Proyecto / parcela</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
              <TableHead className="hidden text-right lg:table-cell">Reentrada / seguridad</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Costo</TableHead>
              <TableHead className="w-28">
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && <Empty cols={7} text="Sin aplicaciones en el periodo." />}
            {filtered.map((r) => {
              const rate = appliedRate(r.quantity, r.treated_area_ha)
              return (
                <TableRow key={r.id} className={r.status === "cancelado" ? "opacity-60" : undefined}>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(r.application_date)}
                    {r.application_time && <p className="text-xs text-muted-foreground">{r.application_time.slice(0, 5)}</p>}
                    <CancelledBadge row={r} />
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{r.product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {[r.active_ingredient, r.lot_number && `Lote ${r.lot_number}`, r.responsible?.full_name].filter(Boolean).join(" · ")}
                    </p>
                    <p className="text-xs text-muted-foreground md:hidden">{r.project.code}</p>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <ProjectCell project={r.project} plot={r.assignment.plot.name} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(r.quantity, r.unit)}
                    <p className="text-xs text-muted-foreground">
                      {formatNumber(r.treated_area_ha, "ha")}
                      {rate !== null && ` · ${formatNumber(rate, `${r.unit}/ha`)}`}
                    </p>
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums lg:table-cell">
                    {r.reentry_hours !== null ? `${r.reentry_hours} h` : "—"} /{" "}
                    {r.preharvest_days !== null ? `${r.preharvest_days} d` : "—"}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">
                    {r.movement ? formatMoney(r.movement.total_cost) : <span className="text-xs text-muted-foreground">Sin salida</span>}
                    {r.movement?.warehouse && <p className="text-xs text-muted-foreground">{r.movement.warehouse.name}</p>}
                  </TableCell>
                  <TableCell>
                    <RowActions
                      row={r}
                      canWrite={shared.canWrite}
                      organizationId={shared.organizationId}
                      entity="chemical_application"
                      title={`${r.product.name} · ${r.project.code} · ${formatDate(r.application_date)}`}
                      edit={
                        <ApplicationEditDialog
                          employees={shared.employees}
                          machines={machines}
                          trigger={editButton("Editar aplicación")}
                          record={{
                            id: r.id,
                            title: `${r.product.name} · ${formatNumber(r.quantity, r.unit)}`,
                            time: r.application_time?.slice(0, 5) ?? "",
                            activeIngredient: r.active_ingredient ?? "",
                            treatedArea: String(r.treated_area_ha),
                            responsibleId: r.responsible_id ?? NONE,
                            machineId: r.machine_id ?? NONE,
                            equipment: r.equipment ?? "",
                            reentryHours: toInput(r.reentry_hours),
                            preharvestDays: toInput(r.preharvest_days),
                            notes: r.notes ?? "",
                          }}
                        />
                      }
                      cancel={{
                        description: r.inventory_movement_id
                          ? "El producto regresa al almacén (mismo lote) y su costo sale del proyecto. La aplicación queda en el historial como cancelada."
                          : "La aplicación queda en el historial como cancelada.",
                        action: (reason) => cancelApplication(r.id, reason),
                      }}
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
export function ActivitiesTable({
  activities,
  activityTypes,
  ...shared
}: Shared & { activities: FieldActivity[]; activityTypes: SelectOption[] }) {
  const { filtered, controls } = useLogFilter(activities, (r) => [
    r.activity_type.name,
    r.description,
    r.project.code,
    r.responsible?.full_name,
    r.notes,
  ])
  const total = filtered.filter((r) => r.status !== "cancelado").reduce((s, r) => s + Number(r.cost), 0)

  return (
    <div className="space-y-3">
      {controls}
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Actividad</TableHead>
              <TableHead className="hidden md:table-cell">Proyecto / parcela</TableHead>
              <TableHead className="hidden lg:table-cell">Responsable</TableHead>
              <TableHead className="text-right">Costo adicional</TableHead>
              <TableHead className="w-28">
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && <Empty cols={6} text="Sin actividades en el periodo." />}
            {filtered.map((r) => (
              <TableRow key={r.id} className={r.status === "cancelado" ? "opacity-60" : undefined}>
                <TableCell className="whitespace-nowrap">
                  {formatDate(r.activity_date)}
                  <CancelledBadge row={r} />
                </TableCell>
                <TableCell>
                  <p className="font-medium">{r.activity_type.name}</p>
                  {(r.description || r.notes) && (
                    <p className="max-w-72 truncate text-xs text-muted-foreground">{[r.description, r.notes].filter(Boolean).join(" · ")}</p>
                  )}
                  <p className="text-xs text-muted-foreground md:hidden">{r.project.code}</p>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <ProjectCell project={r.project} plot={r.assignment?.plot.name} />
                </TableCell>
                <TableCell className="hidden lg:table-cell">{r.responsible?.full_name ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{Number(r.cost) > 0 ? formatMoney(r.cost) : "—"}</TableCell>
                <TableCell>
                  <RowActions
                    row={r}
                    canWrite={shared.canWrite}
                    organizationId={shared.organizationId}
                    entity="field_activity"
                    title={`${r.activity_type.name} · ${r.project.code} · ${formatDate(r.activity_date)}`}
                    edit={
                      <ActivityDialog
                        organizationId={shared.organizationId}
                        projects={shared.projects}
                        employees={shared.employees}
                        activityTypes={activityTypes}
                        trigger={editButton("Editar actividad")}
                        record={{
                          id: r.id,
                          projectId: r.project_id,
                          plotId: r.plot_id ?? NONE,
                          activityTypeId: r.activity_type_id,
                          date: r.activity_date,
                          description: r.description ?? "",
                          responsibleId: r.responsible_id ?? NONE,
                          cost: Number(r.cost) > 0 ? String(r.cost) : "",
                          notes: r.notes ?? "",
                        }}
                      />
                    }
                    cancel={{
                      description: "La actividad queda en el historial como cancelada y su costo adicional deja de contar para el proyecto.",
                      action: (reason) => cancelFieldRecord("actividad", r.id, reason),
                    }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          {total > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="font-medium">
                  Costo adicional de actividades
                </TableCell>
                <TableCell className="hidden md:table-cell" />
                <TableCell className="hidden lg:table-cell" />
                <TableCell className="text-right font-semibold tabular-nums">{formatMoney(total)}</TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
const SEVERITY_STYLES: Record<ObservationSeverity, string> = {
  baja: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  media: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  alta: "border-destructive/30 bg-destructive/10 text-destructive",
}

/** Observaciones de campo (se capturan en /campo, con o sin conexión). */
export function ObservationsTable({ observations, ...shared }: Shared & { observations: FieldObservation[] }) {
  const { filtered, controls } = useLogFilter(observations, (r) => [
    r.title,
    r.description,
    OBSERVATION_CATEGORY_LABELS[r.category as ObservationCategory],
    r.project.code,
    r.responsible?.full_name,
  ])

  return (
    <div className="space-y-3">
      {controls}
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Observación</TableHead>
              <TableHead className="hidden md:table-cell">Proyecto / parcela</TableHead>
              <TableHead>Severidad</TableHead>
              <TableHead className="w-24">
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && <Empty cols={5} text="Sin observaciones en el periodo." />}
            {filtered.map((r) => (
              <TableRow key={r.id} className={r.status === "cancelado" ? "opacity-60" : undefined}>
                <TableCell className="whitespace-nowrap">
                  {formatDate(r.observation_date)}
                  {r.observation_time && <p className="text-xs text-muted-foreground">{r.observation_time.slice(0, 5)}</p>}
                  <CancelledBadge row={r} />
                </TableCell>
                <TableCell className="max-w-80 whitespace-normal">
                  <p className="font-medium">{r.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {OBSERVATION_CATEGORY_LABELS[r.category as ObservationCategory]}
                    {r.responsible && ` · ${r.responsible.full_name}`}
                    {r.latitude !== null && r.longitude !== null && (
                      <>
                        {" · "}
                        <a
                          href={`https://www.openstreetmap.org/?mlat=${r.latitude}&mlon=${r.longitude}#map=17/${r.latitude}/${r.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="underline"
                        >
                          ubicación
                        </a>
                      </>
                    )}
                  </p>
                  {r.description && <p className="line-clamp-2 text-xs text-muted-foreground">{r.description}</p>}
                  <p className="text-xs text-muted-foreground md:hidden">{r.project.code}</p>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <ProjectCell project={r.project} plot={r.assignment?.plot.name} />
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={SEVERITY_STYLES[r.severity as ObservationSeverity]}>
                    {SEVERITY_LABELS[r.severity as ObservationSeverity]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <RowActions
                    row={r}
                    canWrite={shared.canWrite}
                    organizationId={shared.organizationId}
                    entity="field_observation"
                    title={`${r.title} · ${r.project.code} · ${formatDate(r.observation_date)}`}
                    cancel={{
                      description: "La observación se conserva como cancelada con el motivo.",
                      action: (reason) => cancelFieldRecord("observacion", r.id, reason),
                    }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

export function ActivityTypesTable({
  types,
  canWrite,
  canDelete,
}: {
  types: ActivityType[]
  canWrite: boolean
  canDelete: boolean
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Actividad</TableHead>
            <TableHead className="text-right">Registros</TableHead>
            {(canWrite || canDelete) && (
              <TableHead className="w-28">
                <span className="sr-only">Acciones</span>
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {types.map((t) => (
            <TableRow key={t.id} className={t.is_active ? undefined : "opacity-60"}>
              <TableCell>
                <p className="font-medium">
                  {t.name}
                  {!t.is_active && (
                    <Badge variant="destructive" className="ml-2">
                      Inactiva
                    </Badge>
                  )}
                </p>
                {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                <p className="text-xs text-muted-foreground">Costo adicional: {BUDGET_CATEGORY_LABELS[t.cost_category]}</p>
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(t.useCount)}</TableCell>
              {(canWrite || canDelete) && (
                <TableCell>
                  <CatalogRowActions
                    name={t.name}
                    active={t.is_active}
                    editDialog={
                      canWrite
                        ? (trigger) => (
                            <ActivityTypeDialog
                              trigger={trigger}
                              activityType={{ id: t.id, name: t.name, description: t.description ?? "", costCategory: t.cost_category }}
                            />
                          )
                        : undefined
                    }
                    onToggle={canWrite ? () => setActivityTypeActive(t.id, !t.is_active) : undefined}
                    onDelete={canDelete && t.useCount === 0 ? () => deleteActivityType(t.id) : undefined}
                  />
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
