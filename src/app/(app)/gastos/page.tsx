import { HandCoins, Receipt, TrendingUp, Wallet } from "lucide-react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/layout/page-header"
import { KpiCard } from "@/components/shared/kpi-card"
import { NoAccess } from "@/components/shared/no-access"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { deleteExpense } from "@/features/finance/actions"
import { ExpenseDialog } from "@/features/finance/components/expense-dialog"
import { ProfitabilityTable } from "@/features/finance/components/profitability-table"
import { RecordsTable } from "@/features/finance/components/records-table"
import { getExpenses, getFinanceSummary, getProjectCosts } from "@/features/finance/queries"
import { EXPENSE_CATEGORY_LABELS } from "@/features/finance/schemas"
import { getOpenProjects } from "@/features/projects/queries"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { formatMoney, formatNumber } from "@/lib/format"

export const metadata: Metadata = { title: "Gastos y rentabilidad" }

export default async function ExpensesPage() {
  const ctx = await getOrgContext()
  if (!can(ctx.role, "finance.read")) return <NoAccess title="Gastos y rentabilidad" />
  const canWrite = can(ctx.role, "expenses.write")
  const [summary, costs, expenses, projects] = await Promise.all([
    getFinanceSummary(),
    getProjectCosts(),
    getExpenses(),
    canWrite ? getOpenProjects() : Promise.resolve([]),
  ])
  const withActivity = costs.filter((c) => c.totalCost !== 0 || c.salesAmount > 0)
  const profit = summary.sales_total - summary.total_cost

  return (
    <>
      <PageHeader
        title="Gastos y rentabilidad"
        description="Costo de producción por proyecto a partir de consumos, maquinaria, mano de obra y gastos directos."
        actions={canWrite && <ExpenseDialog projects={projects} />}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Costo de producción"
          value={formatMoney(summary.total_cost)}
          hint={`${formatMoney(summary.period_cost)} en el mes`}
          icon={Wallet}
        />
        <KpiCard
          label="Ventas registradas"
          value={formatMoney(summary.sales_total)}
          hint={`${formatNumber(summary.sales_count)} ventas vigentes`}
          icon={Receipt}
        />
        <KpiCard
          label="Utilidad bruta"
          value={formatMoney(profit)}
          hint="Ventas registradas − costo de producción"
          icon={TrendingUp}
        />
        <KpiCard
          label="Por cobrar"
          value={formatMoney(summary.receivable)}
          hint={`Cobrado: ${formatMoney(summary.collected)}`}
          icon={HandCoins}
        />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Costo por categoría</CardTitle>
          <CardDescription>
            Las compras de almacén no aparecen aquí: el insumo se vuelve costo cuando se consume en un proyecto.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-3 xl:grid-cols-5">
            {[
              ["Insumos consumidos", summary.inputs_cost],
              ["Maquinaria", summary.machinery_cost],
              ["Mano de obra", summary.labor_cost],
              ["Gastos directos", summary.expenses_cost],
              ["Actividades de campo", summary.activities_cost],
            ].map(([label, value]) => (
              <div key={label as string}>
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="text-lg font-semibold tabular-nums">{formatMoney(value as number)}</dd>
                <dd className="text-xs text-muted-foreground">
                  {summary.total_cost > 0 ? `${formatNumber(((value as number) / summary.total_cost) * 100)} %` : "—"}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Tabs defaultValue="rentabilidad">
        <TabsList>
          <TabsTrigger value="rentabilidad">Rentabilidad por proyecto</TabsTrigger>
          <TabsTrigger value="gastos">Gastos directos</TabsTrigger>
        </TabsList>
        <TabsContent value="rentabilidad">
          <Card>
            <CardContent>
              {withActivity.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Ningún proyecto tiene costos o ventas registrados.</p>
              ) : (
                <ProfitabilityTable rows={withActivity} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="gastos">
          <Card>
            <CardContent>
              <RecordsTable
                rows={expenses.map((e) => ({
                  id: e.id,
                  date: e.expense_date,
                  title: e.description,
                  subtitle: [EXPENSE_CATEGORY_LABELS[e.category], e.supplier, e.invoice_ref].filter(Boolean).join(" · "),
                  project: e.project,
                  plot: e.assignment?.plot.name,
                  value: e.amount,
                }))}
                deleteAction={canWrite ? deleteExpense : undefined}
                deleteLabel="Eliminar gasto"
                emptyText="Sin gastos directos registrados."
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  )
}
