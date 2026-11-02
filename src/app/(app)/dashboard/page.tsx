import {
  CalendarClock,
  CircleDollarSign,
  HandCoins,
  LandPlot,
  Map,
  MailPlus,
  PackageCheck,
  Plus,
  Receipt,
  ShoppingCart,
  Sprout,
  Users,
  Wallet,
  Wheat,
} from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { PageHeader } from "@/components/layout/page-header"
import { KpiCard } from "@/components/shared/kpi-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BarListChart } from "@/features/dashboard/components/bar-list-chart"
import { getAgroSummary, getRecentProjects, getUpcomingHarvests } from "@/features/dashboard/queries"
import { getRecentActivity, getTeamSummary } from "@/features/organizations/queries"
import { ProjectStatusBadge } from "@/features/projects/components/project-status-badge"
import { PROJECT_STATUSES, STATUS_LABELS } from "@/features/projects/status"
import { can, ROLE_LABELS, type AppRole } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { formatDate, formatDateTime, formatMoney, formatNumber, todayISO } from "@/lib/format"

export const metadata: Metadata = { title: "Dashboard" }

/** Indicadores que se alimentarán con los módulos de las siguientes fases. */
const UPCOMING_KPIS = [
  { label: "Inversión acumulada", icon: Wallet, phase: 5 },
  { label: "Gastos del periodo", icon: Receipt, phase: 5 },
  { label: "Producción cosechada", icon: Wheat, phase: 4 },
  { label: "Pendiente de venta", icon: PackageCheck, phase: 4 },
  { label: "Ventas registradas", icon: ShoppingCart, phase: 4 },
  { label: "Dinero cobrado", icon: CircleDollarSign, phase: 4 },
  { label: "Cuentas por cobrar", icon: HandCoins, phase: 4 },
]

const TABLE_LABELS: Record<string, string> = {
  organizations: "Organización",
  memberships: "Membresía",
  invitations: "Invitación",
  farms: "Rancho",
  plots: "Parcela",
  crops: "Cultivo",
  projects: "Proyecto",
  project_plots: "Asignación de parcela",
}
const ACTION_LABELS: Record<string, string> = { INSERT: "alta", UPDATE: "cambio", DELETE: "baja" }

export default async function DashboardPage() {
  const ctx = await getOrgContext()
  const canManage = can(ctx.role, "members.manage")
  const [team, activity, agro, harvests, recent] = await Promise.all([
    getTeamSummary(),
    can(ctx.role, "audit.read") ? getRecentActivity() : Promise.resolve([]),
    getAgroSummary(),
    getUpcomingHarvests(),
    getRecentProjects(),
  ])
  const firstName = ctx.user.fullName.split(" ")[0]
  const today = todayISO()

  const statusData = PROJECT_STATUSES.filter((s) => (agro.by_status[s] ?? 0) > 0).map((s) => ({
    label: STATUS_LABELS[s],
    value: agro.by_status[s] ?? 0,
  }))
  const cropData = agro.area_by_crop.slice(0, 8).map((c) => ({ label: c.crop, value: Number(c.area) }))
  const utilization = agro.registered_area > 0 ? (agro.cultivated_area / agro.registered_area) * 100 : null

  return (
    <>
      <PageHeader
        title={firstName ? `Hola, ${firstName}` : "Dashboard"}
        description={`Resumen general de ${ctx.organization.name}.`}
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
        <h2 id="kpi-agro" className="sr-only">Indicadores agrícolas</h2>
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
      </section>

      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Proyectos por estado</CardTitle>
            <CardDescription>Número de proyectos en cada etapa, incluidos cerrados y cancelados.</CardDescription>
          </CardHeader>
          <CardContent>
            {statusData.length === 0 ? (
              <EmptyChart text="Sin proyectos registrados." href="/proyectos" cta="Ir a proyectos" />
            ) : (
              <BarListChart data={statusData} caption="Proyectos por estado" />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Superficie cultivada por cultivo</CardTitle>
            <CardDescription>Hectáreas asignadas a proyectos vigentes.</CardDescription>
          </CardHeader>
          <CardContent>
            {cropData.length === 0 ? (
              <EmptyChart
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
              <CalendarClock className="size-4" aria-hidden /> Próximas cosechas
            </CardTitle>
            <CardDescription>Proyectos vigentes con cosecha estimada en los próximos 45 días.</CardDescription>
          </CardHeader>
          <CardContent>
            {harvests.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay cosechas estimadas en ese periodo.</p>
            ) : (
              <ul className="divide-y">
                {harvests.map((h) => {
                  const overdue = h.expected_harvest_date! < today
                  return (
                    <li key={h.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <div className="min-w-0">
                        <Link href={`/proyectos/${h.id}`} className="block truncate font-medium hover:underline">
                          {h.name}
                        </Link>
                        <p className="truncate text-xs text-muted-foreground">
                          {h.code} · {h.crop.name}
                          {h.crop.variety && ` · ${h.crop.variety}`}
                        </p>
                      </div>
                      <span className={overdue ? "shrink-0 font-medium text-destructive" : "shrink-0 tabular-nums"}>
                        {overdue && "Vencida · "}
                        {formatDate(h.expected_harvest_date)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Proyectos con movimiento reciente</CardTitle>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin proyectos registrados.</p>
            ) : (
              <ul className="divide-y">
                {recent.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <div className="min-w-0">
                      <Link href={`/proyectos/${p.id}`} className="block truncate font-medium hover:underline">
                        {p.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {p.code} · {formatDateTime(p.updated_at)}
                      </p>
                    </div>
                    <ProjectStatusBadge status={p.status} className="shrink-0" />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <section aria-labelledby="kpi-next" className="mb-8 space-y-3">
        <div>
          <h2 id="kpi-next" className="font-semibold">Indicadores financieros y comerciales</h2>
          <p className="text-sm text-muted-foreground">
            Se calcularán con los registros reales de cada módulo conforme se habiliten. Las ventas registradas y el
            dinero efectivamente cobrado se mostrarán por separado.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {UPCOMING_KPIS.map((kpi) => (
            <KpiCard
              key={kpi.label}
              label={kpi.label}
              value={null}
              hint={`Sin registros · módulo disponible en la fase ${kpi.phase}`}
              icon={kpi.icon}
              muted
            />
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-4" aria-hidden /> Equipo por rol
            </CardTitle>
            <CardDescription>
              {formatNumber(team.activeMembers)} usuarios activos
              {canManage && team.pendingInvitations > 0 && ` · ${formatNumber(team.pendingInvitations)} invitaciones pendientes`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {[...team.byRole.entries()].map(([role, count]) => (
                <li key={role} className="flex items-center justify-between py-2 text-sm">
                  <span>{ROLE_LABELS[role as AppRole]}</span>
                  <span className="font-medium tabular-nums">{count}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {can(ctx.role, "audit.read") && (
          <Card>
            <CardHeader>
              <CardTitle>Actividad reciente</CardTitle>
              <CardDescription>Últimos movimientos registrados en la bitácora de auditoría.</CardDescription>
            </CardHeader>
            <CardContent>
              {activity.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin actividad registrada.</p>
              ) : (
                <ul className="divide-y">
                  {activity.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span>
                        {TABLE_LABELS[a.table_name] ?? a.table_name} · {ACTION_LABELS[a.action] ?? a.action}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(a.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}

function EmptyChart({ text, href, cta }: { text: string; href: string; cta: string }) {
  return (
    <div className="flex h-40 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
      <p>{text}</p>
      <Button asChild variant="outline" size="sm">
        <Link href={href}>{cta}</Link>
      </Button>
    </div>
  )
}
