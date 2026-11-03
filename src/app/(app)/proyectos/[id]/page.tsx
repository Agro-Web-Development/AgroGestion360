import { ArrowLeft, CalendarDays, ClipboardList, Layers, Pencil, Receipt, ShoppingCart, Trash2, Wheat } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { PageHeader } from "@/components/layout/page-header"
import { ConfirmAction } from "@/components/shared/confirm-action"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { yieldUnitShort } from "@/features/crops/schemas"
import { ProjectTimeline } from "@/features/fieldlogs/components/timeline"
import { getProjectOperations, getProjectTimeline } from "@/features/fieldlogs/queries"
import { formatDuration } from "@/features/fieldlogs/schemas"
import { CostEntriesTable } from "@/features/finance/components/cost-entries-table"
import { ProjectFinanceCard } from "@/features/finance/components/project-finance-card"
import { getFinanceSettings, getProjectCost, getProjectCostEntries } from "@/features/finance/queries"
import { LotsTable } from "@/features/harvests/components/production-tables"
import { getProjectHarvests } from "@/features/harvests/queries"
import { getAssignments } from "@/features/labor/queries"
import { PaymentsTable } from "@/features/sales/components/payments-table"
import { TraceTable } from "@/features/sales/components/trace-table"
import { getLotTrace, getPayments } from "@/features/sales/queries"
import { deleteProject } from "@/features/projects/actions"
import { AssignPlotDialog } from "@/features/projects/components/assign-plot-dialog"
import { ChangeStatusDialog } from "@/features/projects/components/change-status-dialog"
import { ProjectPlotsTable } from "@/features/projects/components/project-plots-table"
import { ProjectStatusBadge } from "@/features/projects/components/project-status-badge"
import { StatusProgress } from "@/features/projects/components/status-progress"
import { getActiveMembers, getAssignablePlots, getProject, getProjectHistory } from "@/features/projects/queries"
import { isClosed, nextStatuses, STATUS_LABELS } from "@/features/projects/status"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { formatDate, formatDateTime, formatMoney, formatNumber, todayISO } from "@/lib/format"

export const metadata: Metadata = { title: "Expediente del proyecto" }

const DAY_MS = 86_400_000
const COST_ENTRY_LIMIT = 100
const TIMELINE_LIMIT = 40

export default async function ProjectPage({ params }: PageProps<"/proyectos/[id]">) {
  const { id } = await params
  const ctx = await getOrgContext()
  const canWrite = can(ctx.role, "projects.write")
  const canSeeFinance = can(ctx.role, "finance.read")
  const [project, history, members] = await Promise.all([getProject(id), getProjectHistory(id), getActiveMembers()])
  const [timeline, operations, assignments, lots] = await Promise.all([
    getProjectTimeline(project.id, {}, TIMELINE_LIMIT),
    getProjectOperations(project.id),
    getAssignments(project.id),
    getProjectHarvests(project.id),
  ])
  const [costs, costEntries, trace, thresholds] = canSeeFinance
    ? await Promise.all([
        getProjectCost(project.id),
        getProjectCostEntries(project.id, COST_ENTRY_LIMIT),
        getLotTrace({ projectId: project.id }),
        getFinanceSettings(),
      ])
    : [null, [], [], undefined]
  const saleIds = [...new Set(trace.map((t) => t.saleId))]
  const payments = saleIds.length > 0 ? await getPayments({ saleIds, includeCancelled: true }) : []
  const produced = lots.reduce((t, l) => t + Number(l.quantity_kg), 0)
  const soldKg = lots.reduce((t, l) => t + Number(l.sold_kg), 0)
  const shrinkage = lots.reduce((t, l) => t + Number(l.adjusted_kg), 0)
  const availableKg = lots.reduce((t, l) => t + Number(l.available_kg), 0)
  const cuts = new Set(lots.map((l) => l.cut_number)).size
  const closed = isClosed(project.status)
  const plotsEditable = canWrite && !closed
  const assignable = plotsEditable ? await getAssignablePlots(project.id) : []
  const statusOptions = canWrite ? nextStatuses(project.status, can(ctx.role, "projects.reopen")) : []
  const canDelete =
    can(ctx.role, "projects.delete") && (project.status === "planeacion" || project.status === "cancelado")

  const names = new Map(members.map((m) => [m.id, m.name]))
  const area = project.project_plots.reduce((s, pp) => s + Number(pp.assigned_area_ha), 0)
  const unit = yieldUnitShort(project.crop.yield_unit)
  const yieldPerHa = project.expected_yield !== null && area > 0 ? Number(project.expected_yield) / area : null
  const budgetPerHa = project.budget_amount !== null && area > 0 ? Number(project.budget_amount) / area : null
  const daysToHarvest =
    project.expected_harvest_date && !closed
      ? Math.round((Date.parse(project.expected_harvest_date) - Date.parse(todayISO())) / DAY_MS)
      : null

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href="/proyectos">
          <ArrowLeft aria-hidden /> Proyectos
        </Link>
      </Button>
      <PageHeader
        title={project.name}
        description={[project.code, project.season].filter(Boolean).join(" · ")}
        actions={
          <>
            {canWrite && (
              <Button asChild variant="outline">
                <Link href={`/proyectos/${project.id}/editar`}>
                  <Pencil aria-hidden /> Editar
                </Link>
              </Button>
            )}
            {canDelete && (
              <ConfirmAction
                title="Eliminar proyecto"
                description={`Se eliminará ${project.code} con sus asignaciones de parcelas e historial. Esta acción no se puede deshacer.`}
                confirmLabel="Eliminar"
                action={deleteProject.bind(null, project.id)}
                trigger={
                  <Button variant="destructive">
                    <Trash2 aria-hidden /> Eliminar
                  </Button>
                }
              />
            )}
            {statusOptions.length > 0 && (
              <ChangeStatusDialog projectId={project.id} current={project.status} options={statusOptions} />
            )}
          </>
        }
      />

      <Card className="mb-4">
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Estado:</span>
            <ProjectStatusBadge status={project.status} />
            {daysToHarvest !== null && (
              <span className="ml-auto inline-flex items-center gap-1 text-muted-foreground">
                <CalendarDays className="size-4" aria-hidden />
                {daysToHarvest > 0
                  ? `Cosecha estimada en ${formatNumber(daysToHarvest)} días`
                  : daysToHarvest === 0
                    ? "Cosecha estimada hoy"
                    : `Cosecha estimada vencida hace ${formatNumber(-daysToHarvest)} días`}
              </span>
            )}
          </div>
          <StatusProgress status={project.status} />
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div className="space-y-1.5">
                <CardTitle>Parcelas asignadas</CardTitle>
                <CardDescription>
                  {closed
                    ? "El proyecto está cerrado o cancelado; su superficie ya no se considera comprometida."
                    : "La superficie asignada queda comprometida mientras el proyecto esté vigente."}
                </CardDescription>
              </div>
              {plotsEditable && project.project_plots.length > 0 && (
                <AssignPlotDialog projectId={project.id} plots={assignable} />
              )}
            </CardHeader>
            <CardContent>
              {project.project_plots.length === 0 ? (
                <EmptyState
                  icon={Layers}
                  title="Sin parcelas asignadas"
                  description={
                    plotsEditable && assignable.length === 0
                      ? "No hay parcelas con superficie disponible. Registra parcelas en Ranchos y parcelas."
                      : "Asigna las parcelas donde se desarrollará el cultivo."
                  }
                  action={plotsEditable && <AssignPlotDialog projectId={project.id} plots={assignable} />}
                />
              ) : (
                <ProjectPlotsTable assignments={project.project_plots} editable={plotsEditable} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div className="space-y-1.5">
                <CardTitle>Producción</CardTitle>
                <CardDescription>Cortes, lotes de producción y producto disponible.</CardDescription>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href={`/produccion?proyecto=${project.id}&tab=cortes`}>Ver cortes</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {lots.length === 0 ? (
                <EmptyState
                  icon={Wheat}
                  title="Sin cortes registrados"
                  description="Los cortes se registran en Producción cuando el proyecto está en cosecha o comercialización."
                />
              ) : (
                <>
                  <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
                    {[
                      ["Cortes", formatNumber(cuts)],
                      ["Lotes", formatNumber(lots.length)],
                      ["Cosechado", formatNumber(produced, "kg")],
                      ["Vendido", formatNumber(soldKg, "kg")],
                      ["Mermas y ajustes", formatNumber(shrinkage, "kg")],
                      ["Disponible", formatNumber(availableKg, "kg")],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-lg border px-3 py-2">
                        <dt className="text-xs text-muted-foreground">{label}</dt>
                        <dd className="font-semibold tabular-nums">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <LotsTable rows={lots} canAdjust={can(ctx.role, "produce.adjust")} />
                </>
              )}
            </CardContent>
          </Card>

          {canSeeFinance && costs && (
            <Card>
              <CardHeader>
                <CardTitle>Ventas y cobranza</CardTitle>
                <CardDescription>
                  Qué lote y parcela originó cada venta. El valor vendido y lo efectivamente cobrado se muestran por separado.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                  <div className="rounded-lg border px-3 py-2">
                    <dt className="text-xs text-muted-foreground">Valor vendido</dt>
                    <dd className="text-lg font-semibold tabular-nums">{formatMoney(costs.salesAmount)}</dd>
                  </div>
                  <div className="rounded-lg border px-3 py-2">
                    <dt className="text-xs text-muted-foreground">Cobrado (pagos recibidos)</dt>
                    <dd className="text-lg font-semibold tabular-nums">{formatMoney(costs.collectedAmount)}</dd>
                  </div>
                  <div className="rounded-lg border px-3 py-2">
                    <dt className="text-xs text-muted-foreground">Saldo por cobrar</dt>
                    <dd className="text-lg font-semibold tabular-nums">{formatMoney(costs.receivableAmount)}</dd>
                  </div>
                </dl>
                {trace.length === 0 ? (
                  <EmptyState icon={ShoppingCart} title="Sin ventas" description="Las ventas confirmadas de sus lotes aparecerán aquí." />
                ) : (
                  <>
                    <TraceTable rows={trace} />
                    <div>
                      <p className="mb-2 text-sm font-medium">Pagos recibidos de esas ventas</p>
                      <p className="mb-2 text-xs text-muted-foreground">
                        Importe total de cada pago; si una venta incluye otros proyectos, lo cobrado del proyecto se prorratea
                        por importe.
                      </p>
                      <PaymentsTable payments={payments} organizationId={ctx.organization.id} canAttach={false} />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {canSeeFinance && costs && (
            <Card>
              <CardHeader>
                <CardTitle>Detalle de costos</CardTitle>
                <CardDescription>
                  Consumos de insumos, maquinaria, mano de obra y gastos directos imputados al proyecto.
                  {closed && " El proyecto está cerrado: sus costos ya no se modifican."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {costEntries.length === 0 ? (
                  <EmptyState
                    icon={Receipt}
                    title="Sin costos registrados"
                    description="Registra consumos en Inventario, uso en Maquinaria, jornales en Personal o gastos directos."
                  />
                ) : (
                  <CostEntriesTable
                    entries={costEntries}
                    total={costs.totalCost}
                    limited={costEntries.length === COST_ENTRY_LIMIT}
                  />
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div className="space-y-1.5">
                <CardTitle>Bitácora del proyecto</CardTitle>
                <CardDescription>Riegos, aplicaciones, actividades, jornadas, maquinaria e insumos en orden cronológico.</CardDescription>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href={`/bitacoras?proyecto=${project.id}&tab=cronologia`}>Ver todo</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {timeline.length === 0 ? (
                <EmptyState
                  icon={ClipboardList}
                  title="Sin registros de campo"
                  description="Registra riegos, aplicaciones y actividades en Bitácoras; jornadas y maquinaria también aparecen aquí."
                />
              ) : (
                <>
                  <ProjectTimeline entries={timeline} showAmounts={canSeeFinance} />
                  {timeline.length === TIMELINE_LIMIT && (
                    <p className="mt-4 text-xs text-muted-foreground">Se muestran los {TIMELINE_LIMIT} registros más recientes.</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {project.description && (
            <Card>
              <CardHeader>
                <CardTitle>Descripción</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-line">{project.description}</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Historial de estados</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="relative space-y-4 border-l pl-5">
                {history.map((h) => (
                  <li key={h.id} className="relative">
                    <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-background bg-primary" aria-hidden />
                    <p className="text-sm">
                      {h.from_status ? (
                        <>
                          {STATUS_LABELS[h.from_status]} → <span className="font-medium">{STATUS_LABELS[h.to_status]}</span>
                        </>
                      ) : (
                        <span className="font-medium">Proyecto creado en {STATUS_LABELS[h.to_status]}</span>
                      )}
                    </p>
                    {h.note && <p className="text-sm text-muted-foreground">“{h.note}”</p>}
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(h.changed_at)}
                      {h.changed_by && ` · ${names.get(h.changed_by) ?? "Usuario sin acceso"}`}
                    </p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Resumen</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm">
                <dt className="text-muted-foreground">Cultivo</dt>
                <dd className="text-right">
                  {project.crop.name}
                  {project.crop.variety && <span className="block text-muted-foreground">{project.crop.variety}</span>}
                </dd>
                <dt className="text-muted-foreground">Responsable</dt>
                <dd className="text-right">
                  {project.responsible ? project.responsible.full_name || project.responsible.email : "Sin asignar"}
                </dd>
                <dt className="text-muted-foreground">Superficie</dt>
                <dd className="text-right tabular-nums">{formatNumber(area, "ha")}</dd>
                <dt className="text-muted-foreground">Producción esperada</dt>
                <dd className="text-right tabular-nums">
                  {formatNumber(project.expected_yield, unit)}
                  {yieldPerHa !== null && (
                    <span className="block text-xs text-muted-foreground">{formatNumber(yieldPerHa, `${unit}/ha`)}</span>
                  )}
                </dd>
                <dt className="text-muted-foreground">Presupuesto</dt>
                <dd className="text-right tabular-nums">
                  {formatMoney(project.budget_amount)}
                  {budgetPerHa !== null && (
                    <span className="block text-xs text-muted-foreground">{formatMoney(budgetPerHa)} / ha</span>
                  )}
                </dd>
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Fechas</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <dt className="text-muted-foreground">Inicio</dt>
                <dd className="text-right">{formatDate(project.start_date)}</dd>
                <dt className="text-muted-foreground">Siembra</dt>
                <dd className="text-right">{formatDate(project.planting_date)}</dd>
                <dt className="text-muted-foreground">Cosecha estimada</dt>
                <dd className="text-right">{formatDate(project.expected_harvest_date)}</dd>
                <dt className="text-muted-foreground">Término</dt>
                <dd className="text-right">{formatDate(project.end_date)}</dd>
                <dt className="text-muted-foreground">Última modificación</dt>
                <dd className="text-right">{formatDateTime(project.updated_at)}</dd>
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Operación</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-3 text-sm">
                <dt className="text-muted-foreground">Riegos</dt>
                <dd className="text-right tabular-nums">
                  {formatNumber(operations.irrigations)}
                  {operations.irrigations > 0 && (
                    <span className="block text-xs text-muted-foreground">
                      {formatDuration(operations.irrigationMinutes)}
                      {operations.waterM3 > 0 && ` · ${formatNumber(operations.waterM3, "m³")}`}
                    </span>
                  )}
                </dd>
                <dt className="text-muted-foreground">Aplicaciones</dt>
                <dd className="text-right tabular-nums">{formatNumber(operations.applications)}</dd>
                <dt className="text-muted-foreground">Actividades</dt>
                <dd className="text-right tabular-nums">{formatNumber(operations.activities)}</dd>
                <dt className="text-muted-foreground">Jornales</dt>
                <dd className="text-right tabular-nums">{formatNumber(operations.jornales)}</dd>
                <dt className="text-muted-foreground">Horas de maquinaria</dt>
                <dd className="text-right tabular-nums">{formatNumber(operations.machineHours, "h")}</dd>
              </dl>
              {assignments.length > 0 && (
                <div className="mt-4 border-t pt-4">
                  <p className="mb-2 text-sm font-medium">Personal asignado</p>
                  <ul className="space-y-1.5 text-sm">
                    {assignments.map((a) => (
                      <li key={a.id} className="flex justify-between gap-2">
                        <span>{a.employee.full_name}</span>
                        <span className="text-right text-xs text-muted-foreground">
                          {[a.role, a.crew?.name, a.assignment?.plot.name].filter(Boolean).join(" · ") || "Todo el proyecto"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
          {canSeeFinance && costs && <ProjectFinanceCard costs={costs} thresholds={thresholds} />}
        </div>
      </div>
    </>
  )
}
