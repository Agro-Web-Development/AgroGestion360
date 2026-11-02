import {
  CircleDollarSign,
  HandCoins,
  LandPlot,
  MailPlus,
  PackageCheck,
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
import { getRecentActivity, getTeamSummary } from "@/features/organizations/queries"
import { can, ROLE_LABELS, type AppRole } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { formatDateTime, formatNumber } from "@/lib/format"

export const metadata: Metadata = { title: "Dashboard" }

/** Indicadores que se alimentarán con los módulos de las siguientes fases. */
const UPCOMING_KPIS = [
  { label: "Proyectos agrícolas", icon: Sprout, phase: 2 },
  { label: "Superficie cultivada", icon: LandPlot, phase: 2 },
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
}
const ACTION_LABELS: Record<string, string> = { INSERT: "alta", UPDATE: "cambio", DELETE: "baja" }

export default async function DashboardPage() {
  const ctx = await getOrgContext()
  const canManage = can(ctx.role, "members.manage")
  const [team, activity] = await Promise.all([
    getTeamSummary(),
    can(ctx.role, "audit.read") ? getRecentActivity() : Promise.resolve([]),
  ])
  const firstName = ctx.user.fullName.split(" ")[0]

  return (
    <>
      <PageHeader
        title={firstName ? `Hola, ${firstName}` : "Dashboard"}
        description={`Resumen general de ${ctx.organization.name}.`}
        actions={
          canManage && (
            <Button asChild variant="outline">
              <Link href="/configuracion/usuarios">
                <MailPlus aria-hidden /> Invitar usuarios
              </Link>
            </Button>
          )
        }
      />

      <section aria-labelledby="kpi-team" className="mb-8">
        <h2 id="kpi-team" className="sr-only">Equipo</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Usuarios activos" value={formatNumber(team.activeMembers)} icon={Users} />
          {canManage && (
            <KpiCard
              label="Invitaciones pendientes"
              value={formatNumber(team.pendingInvitations)}
              icon={MailPlus}
            />
          )}
        </div>
      </section>

      <section aria-labelledby="kpi-ops" className="mb-8 space-y-3">
        <div>
          <h2 id="kpi-ops" className="font-semibold">Indicadores agrícolas y financieros</h2>
          <p className="text-sm text-muted-foreground">
            Se calcularán con los registros reales de cada módulo conforme se habiliten. Las ventas
            registradas y el dinero efectivamente cobrado se mostrarán por separado.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
            <CardTitle>Equipo por rol</CardTitle>
            <CardDescription>Usuarios activos en la organización.</CardDescription>
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
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatDateTime(a.created_at)}
                      </span>
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
