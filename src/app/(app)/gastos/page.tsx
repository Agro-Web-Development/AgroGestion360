import { CircleDollarSign, HandCoins, Split, Wallet } from "lucide-react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/layout/page-header"
import { FilterBar } from "@/components/shared/filter-bar"
import { KpiCard } from "@/components/shared/kpi-card"
import { NoAccess } from "@/components/shared/no-access"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ExpenseDialog } from "@/features/finance/components/expense-dialog"
import { ExpensesTable } from "@/features/finance/components/expenses-table"
import { getExpenses } from "@/features/finance/queries"
import { getSuppliers } from "@/features/inventory/queries"
import { getActiveMembers, getOpenProjects, getProjects } from "@/features/projects/queries"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { formatDate, formatMoney, formatNumber, todayISO } from "@/lib/format"
import { sumMoney } from "@/lib/money"
import { dateParam, idParam } from "@/lib/search-params"

export const metadata: Metadata = { title: "Gastos" }

export default async function ExpensesPage({ searchParams }: PageProps<"/gastos">) {
  const ctx = await getOrgContext()
  if (!can(ctx.role, "finance.read")) return <NoAccess title="Gastos" />
  const canWrite = can(ctx.role, "expenses.write")
  const sp = await searchParams
  const today = todayISO()
  const filters = {
    from: dateParam(sp.desde) ?? `${today.slice(0, 4)}-01-01`,
    to: dateParam(sp.hasta) ?? today,
    projectId: idParam(sp.proyecto),
  }
  const [expenses, projects, openProjects, suppliers, members] = await Promise.all([
    getExpenses(filters),
    getProjects(),
    canWrite ? getOpenProjects() : Promise.resolve([]),
    canWrite ? getSuppliers() : Promise.resolve([]),
    canWrite ? getActiveMembers() : Promise.resolve([]),
  ])
  const active = expenses.filter((e) => e.status === "registrado")
  // Con filtro de proyecto, los importes son la parte asignada a ese proyecto.
  const projectShare = (e: (typeof active)[number]) =>
    filters.projectId ? (e.allocations.find((a) => a.project_id === filters.projectId)?.amount ?? 0) : e.amount
  const total = sumMoney(active.map(projectShare))
  const paid = sumMoney(active.map((e) => e.paidAmount))
  const pending = sumMoney(active.map((e) => e.pendingAmount))
  const shared = active.filter((e) => e.allocation_method !== "directo").length

  return (
    <>
      <PageHeader
        title="Gastos"
        description="Gastos directos y compartidos que no provienen de inventario, maquinaria ni mano de obra, con su pago."
        actions={
          canWrite && (
            <ExpenseDialog
              organizationId={ctx.organization.id}
              projects={openProjects}
              suppliers={suppliers.filter((s) => s.is_active).map((s) => ({ id: s.id, name: s.name }))}
              members={members}
              currentUserId={ctx.user.id}
            />
          )
        }
      />
      <div className="mb-4">
        <FilterBar
          action="/gastos"
          from={filters.from}
          to={filters.to}
          selects={[
            {
              name: "proyecto",
              label: "Proyecto",
              allLabel: "Todos los proyectos",
              value: filters.projectId,
              options: projects.map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` })),
            },
          ]}
        />
      </div>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Gastos del periodo"
          value={formatMoney(total)}
          hint={`${formatNumber(active.length)} vigentes · ${formatDate(filters.from)} – ${formatDate(filters.to)}`}
          icon={Wallet}
        />
        <KpiCard label="Pagado" value={formatMoney(paid)} hint="Egresos registrados de esos gastos" icon={CircleDollarSign} tone="positive" />
        <KpiCard
          label="Por pagar"
          value={formatMoney(pending)}
          hint="Registrado como costo, aún sin egreso"
          icon={HandCoins}
          tone={pending > 0 ? "warning" : "default"}
        />
        <KpiCard label="Gastos compartidos" value={formatNumber(shared)} hint="Repartidos entre varios proyectos" icon={Split} />
      </div>
      {filters.projectId && (
        <p className="mb-3 text-sm text-muted-foreground">
          Con filtro de proyecto, «Gastos del periodo» suma solo la parte asignada a ese proyecto; pagado y por pagar son del gasto completo.
        </p>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Registro de gastos</CardTitle>
          <CardDescription>
            Un gasto cancelado deja de contar como costo pero queda en el historial. Para corregir uno pagado, cancela primero sus
            pagos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ExpensesTable organizationId={ctx.organization.id} expenses={expenses} canWrite={canWrite} />
        </CardContent>
      </Card>
    </>
  )
}
