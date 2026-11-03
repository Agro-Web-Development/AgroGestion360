import {
  Activity,
  ArrowRight,
  CalendarClock,
  CircleDollarSign,
  HandCoins,
  History,
  LandPlot,
  Leaf,
  Map,
  MailPlus,
  PackageCheck,
  Plus,
  Receipt,
  ShoppingCart,
  Sprout,
  TrendingUp,
  Users,
  Wallet,
  Wheat,
  type LucideIcon,
} from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { PageHeader } from "@/components/layout/page-header"
import { KpiCard } from "@/components/shared/kpi-card"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BarListChart } from "@/features/dashboard/components/bar-list-chart"
import { getAgroSummary, getRecentProjects, getUpcomingHarvests } from "@/features/dashboard/queries"
import { getFinanceSummary } from "@/features/finance/queries"
import { getRecentActivity, getTeamSummary } from "@/features/organizations/queries"
import { ProjectStatusBadge } from "@/features/projects/components/project-status-badge"
import { PROJECT_STATUSES, STATUS_LABELS } from "@/features/projects/status"
import { can, ROLE_LABELS, type AppRole } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { formatDate, formatDateTime, formatMoney, formatNumber, LOCALE, TIME_ZONE, todayISO } from "@/lib/format"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Dashboard" }

const TABLE_LABELS: Record<string, string> = {
  organizations: "Organización",
  memberships: "Membresía",
  invitations: "Invitación",
  farms: "Rancho",
  plots: "Parcela",
  crops: "Cultivo",
  projects: "Proyecto",
  project_plots: "Asignación de parcela",
  inventory_products: "Producto de inventario",
  inventory_movements: "Movimiento de inventario",
  machinery: "Equipo",
  machinery_usage: "Uso de maquinaria",
  employees: "Empleado",
  labor_records: "Mano de obra",
  project_expenses: "Gasto",
  harvests: "Corte / lote",
  production_movements: "Movimiento de producto",
  sale_deliveries: "Entrega",
  sale_delivery_items: "Partida entregada",
  advance_applications: "Aplicación de anticipo",
  attachments: "Evidencia",
  customers: "Cliente",
  sales: "Venta",
  sale_items: "Partida de venta",
  payments: "Pago",
}
const ACTION_LABELS: Record<string, string> = { INSERT: "alta", UPDATE: "cambio", DELETE: "baja" }
const ACTION_DOT: Record<string, string> = { INSERT: "bg-primary", UPDATE: "bg-warning", DELETE: "bg-destructive" }
const LONG_DATE = new Intl.DateTimeFormat(LOCALE, { timeZone: TIME_ZONE, dateStyle: "full" })

export default async function DashboardPage() {
  const ctx = await getOrgContext()
  const canManage = can(ctx.role, "members.manage")
  const canSeeFinance = can(ctx.role, "finance.read")
  const [team, activity, agro, harvests, recent, finance] = await Promise.all([
    getTeamSummary(),
    can(ctx.role, "audit.read") ? getRecentActivity() : Promise.resolve([]),
    getAgroSummary(),
    getUpcomingHarvests(),
    getRecentProjects(),
    canSeeFinance ? getFinanceSummary() : Promise.resolve(null),
  ])
  const firstName = ctx.user.fullName.split(" ")[0]
  const today = todayISO()

  const statusData = PROJECT_STATUSES.filter((s) => (agro.by_status[s] ?? 0) > 0).map((s) => ({
    label: STATUS_LABELS[s],
    value: agro.by_status[s] ?? 0,
  }))
  const cropData = agro.area_by_crop.slice(0, 8).map((c) => ({ label: c.crop, value: Number(c.area) }))
  const utilization = agro.registered_area > 0 ? (agro.cultivated_area / agro.registered_area) * 100 : null
  const grossProfit = finance ? finance.sales_total - finance.total_cost : 0

  return (
    <>
      <PageHeader
        title={firstName ? `Hola, ${firstName}` : "Dashboard"}
        description={`${capitalize(LONG_DATE.format(new Date()))} · Resumen general de ${ctx.organization.name}.`}
        actions={
          <>
            {canManage && (
              <Button asChild variant="outline">
                <Link href="/configuracion/usuarios">
                  <MailPlus aria-hidden /> Invitar usuarios
                </Link>
              </Button>
            )}
            {can(ctx.role, "projects.write") && (
              <Button asChild>
                <Link href="/proyectos/nuevo">
                  <Plus aria-hidden /> Nuevo proyecto
                </Link>
              </Button>
            )}
          </>
        }
      />

      <section aria-labelledby="kpi-agro" className="mb-8">
        <SectionHeading id="kpi-agro" icon={Sprout} title="Producción agrícola" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Proyectos vigentes"
            value={formatNumber(agro.projects_active)}
            hint={`${formatNumber(agro.projects_total)} registrados en total`}
            icon={Sprout}
          />
          <KpiCard
            label="Superficie cultivada"
            value={formatNumber(agro.cultivated_area, "ha")}
            hint={
              utilization !== null
                ? `${formatNumber(utilization)} % de ${formatNumber(agro.registered_area, "ha")} parceladas`
                : "Sin parcelas registradas"
            }
            icon={LandPlot}
          />
          <KpiCard
            label="Ranchos y parcelas"
            value={`${formatNumber(agro.farms)} · ${formatNumber(agro.plots)}`}
            hint={`${formatNumber(agro.crops)} cultivos en catálogo`}
            icon={Map}
          />
          <KpiCard
            label="Presupuesto planeado"
            value={formatMoney(agro.planned_budget)}
            hint="Suma de proyectos vigentes"
            icon={Wallet}
          />
        </div>
        {utilization !== null && (
          <div className="mt-4 rounded-xl border bg-card px-4 py-3 shadow-xs sm:px-5">
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">Aprovechamiento de la superficie parcelada</span>
              <span className="font-semibold tabular-nums">{formatNumber(utilization)} %</span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label="Aprovechamiento de la superficie parcelada"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(Math.min(utilization, 100))}
            >
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(utilization, 100)}%` }} />
            </div>
          </div>
        )}
      </section>

      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Proyectos por estado</CardTitle>
            <CardDescription>Número de proyectos en cada etapa, incluidos cerrados y cancelados.</CardDescription>
            <CardAction>
              <ViewAll href="/proyectos" label="Ver proyectos" />
            </CardAction>
          </CardHeader>
          <CardContent>
            {statusData.length === 0 ? (
              <EmptyChart icon={Sprout} text="Sin proyectos registrados." href="/proyectos" cta="Ir a proyectos" />
            ) : (
              <BarListChart data={statusData} caption="Proyectos por estado" />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Superficie cultivada por cultivo</CardTitle>
            <CardDescription>Hectáreas asignadas a proyectos vigentes.</CardDescription>
            <CardAction>
              <ViewAll href="/cultivos" label="Ver cultivos" />
            </CardAction>
          </CardHeader>
          <CardContent>
            {cropData.length === 0 ? (
              <EmptyChart
                icon={Leaf}
                text="Ningún proyecto vigente tiene parcelas asignadas."
                href="/proyectos"
                cta="Asignar parcelas"
              />
            ) : (
              <BarListChart data={cropData} unit="ha" caption="Superficie cultivada por cultivo" />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="size-4 text-primary" aria-hidden /> Próximas cosechas
            </CardTitle>
            <CardDescription>Proyectos vigentes con cosecha estimada en los próximos 45 días.</CardDescription>
          </CardHeader>
          <CardContent>
            {harvests.length === 0 ? (
              <EmptyList icon={Wheat} text="No hay cosechas estimadas en ese periodo." />
            ) : (
              <ul className="-mx-2 divide-y">
                {harvests.map((h) => {
                  const overdue = h.expected_harvest_date! < today
                  return (
                    <li key={h.id}>
                      <Link
                        href={`/proyectos/${h.id}`}
                        className="flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm transition-colors hover:bg-muted/60"
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary dark:text-secondary-foreground">
                          <Wheat className="size-4" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{h.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {h.code} · {h.crop.name}
                            {h.crop.variety && ` · ${h.crop.variety}`}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "shrink-0 rounded-md px-2 py-1 text-xs font-medium tabular-nums",
                            overdue ? "bg-destructive/10 text-destructive" : "bg-muted text-foreground"
                          )}
                        >
                          {overdue && "Vencida · "}
                          {formatDate(h.expected_harvest_date)}
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="size-4 text-primary" aria-hidden /> Proyectos con movimiento reciente
            </CardTitle>
            <CardDescription>Últimos proyectos actualizados por el equipo.</CardDescription>
            <CardAction>
              <ViewAll href="/proyectos" label="Ver todos" />
            </CardAction>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <EmptyList icon={Sprout} text="Sin proyectos registrados." />
            ) : (
              <ul className="-mx-2 divide-y">
                {recent.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/proyectos/${p.id}`}
                      className="flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm transition-colors hover:bg-muted/60"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{p.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {p.code} · {formatDateTime(p.updated_at)}
                        </span>
                      </span>
                      <ProjectStatusBadge status={p.status} className="shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {finance && (
        <section aria-labelledby="kpi-finance" className="mb-8">
          <SectionHeading
            id="kpi-finance"
            icon={CircleDollarSign}
            title="Indicadores financieros y comerciales"
            description="Ventas registradas y dinero efectivamente cobrado se muestran por separado; el cobro no es utilidad."
          />
          <div className="-mt-2 mb-4">
            <ViewAll href="/comercial" label="Abrir dashboard comercial" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Inversión acumulada"
              value={formatMoney(finance.total_cost)}
              hint="Costo de producción de todos los proyectos"
              icon={Wallet}
            />
            <KpiCard label="Gastos del periodo" value={formatMoney(finance.period_cost)} hint="Costos registrados este mes" icon={Receipt} />
            <KpiCard
              label="Producción cosechada"
              value={formatNumber(finance.harvested_kg / 1000, "t")}
              hint={`Inventario de insumos: ${formatMoney(finance.inventory_value)}`}
              icon={Wheat}
            />
            <KpiCard
              label="Pendiente de venta"
              value={formatNumber(finance.available_kg / 1000, "t")}
              hint="Cosechado y aún no vendido"
              icon={PackageCheck}
            />
            <KpiCard
              label="Ventas registradas"
              value={formatMoney(finance.sales_total)}
              hint={`${formatNumber(finance.sales_count)} ventas confirmadas`}
              icon={ShoppingCart}
            />
            <KpiCard
              label="Dinero cobrado"
              value={formatMoney(finance.collected)}
              hint="Pagos aplicados"
              icon={CircleDollarSign}
              tone="positive"
            />
            <KpiCard
              label="Cuentas por cobrar"
              value={formatMoney(finance.receivable)}
              hint={
                finance.overdue > 0
                  ? `Vencido: ${formatMoney(finance.overdue)} (${formatNumber(finance.overdue_count)} ventas)`
                  : "Sin saldos vencidos"
              }
              icon={HandCoins}
              tone={finance.overdue > 0 ? "warning" : "default"}
            />
            <KpiCard
              label="Utilidad bruta"
              value={formatMoney(grossProfit)}
              hint="Ventas registradas − inversión acumulada"
              icon={TrendingUp}
              tone={grossProfit < 0 ? "negative" : "positive"}
            />
          </div>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-4 text-primary" aria-hidden /> Equipo por rol
            </CardTitle>
            <CardDescription>
              {formatNumber(team.activeMembers)} usuarios activos
              {canManage && team.pendingInvitations > 0 && ` · ${formatNumber(team.pendingInvitations)} invitaciones pendientes`}
            </CardDescription>
            {canManage && (
              <CardAction>
                <ViewAll href="/configuracion/usuarios" label="Administrar" />
              </CardAction>
            )}
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {[...team.byRole.entries()].map(([role, count]) => (
                <li key={role} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-primary/60" aria-hidden />
                    {ROLE_LABELS[role as AppRole]}
                  </span>
                  <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums">{count}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {can(ctx.role, "audit.read") && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="size-4 text-primary" aria-hidden /> Actividad reciente
              </CardTitle>
              <CardDescription>Últimos movimientos registrados en la bitácora de auditoría.</CardDescription>
            </CardHeader>
            <CardContent>
              {activity.length === 0 ? (
                <EmptyList icon={History} text="Sin actividad registrada." />
              ) : (
                <ol className="relative space-y-3 border-l pl-5">
                  {activity.map((a) => (
                    <li key={a.id} className="relative flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm">
                      <span
                        className={cn(
                          "absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-card",
                          ACTION_DOT[a.action] ?? "bg-muted-foreground"
                        )}
                        aria-hidden
                      />
                      <span>
                        <span className="font-medium">{TABLE_LABELS[a.table_name] ?? a.table_name}</span>
                        <span className="text-muted-foreground"> · {ACTION_LABELS[a.action] ?? a.action}</span>
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{formatDateTime(a.created_at)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function SectionHeading({
  id,
  icon: Icon,
  title,
  description,
}: {
  id: string
  icon: LucideIcon
  title: string
  description?: string
}) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <h2 id={id} className="text-base font-semibold tracking-tight">
          {title}
        </h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
    </div>
  )
}

function ViewAll({ href, label }: { href: string; label: string }) {
  return (
    <Button asChild variant="ghost" size="sm" className="-mr-2 text-primary hover:text-primary dark:text-foreground">
      <Link href={href}>
        {label} <ArrowRight aria-hidden />
      </Link>
    </Button>
  )
}

function EmptyList({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
      <Icon className="size-5" aria-hidden />
      <p>{text}</p>
    </div>
  )
}

function EmptyChart({ icon: Icon, text, href, cta }: { icon: LucideIcon; text: string; href: string; cta: string }) {
  return (
    <div className="flex h-44 flex-col items-center justify-center gap-3 rounded-lg border border-dashed text-center text-sm text-muted-foreground">
      <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-primary dark:text-secondary-foreground">
        <Icon className="size-5" aria-hidden />
      </span>
      <p>{text}</p>
      <Button asChild variant="outline" size="sm">
        <Link href={href}>{cta}</Link>
      </Button>
    </div>
  )
}
