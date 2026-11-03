import { ArrowDownLeft, ArrowUpRight, HandCoins, Scale, Wallet } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { PageHeader } from "@/components/layout/page-header"
import { FilterBar } from "@/components/shared/filter-bar"
import { KpiCard } from "@/components/shared/kpi-card"
import { NoAccess } from "@/components/shared/no-access"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { monthSeries } from "@/features/commercial/series"
import { GroupedBarChart } from "@/features/dashboard/components/grouped-bar-chart"
import { cashFlowByMonth, cashFlowSummary } from "@/features/finance/analysis"
import { CashMovementDialog } from "@/features/finance/components/cash-movement-dialog"
import { CashMovementsTable } from "@/features/finance/components/cash-movements-table"
import { getCashFlow, getCashMovements, getExpenses, getProjectCost } from "@/features/finance/queries"
import { CASH_FLOW_KIND_LABELS } from "@/features/finance/schemas"
import { getSuppliers } from "@/features/inventory/queries"
import { getProjects } from "@/features/projects/queries"
import { ReportTable } from "@/features/reports/components/report-table"
import { getSales } from "@/features/sales/queries"
import { PAYMENT_METHOD_LABELS } from "@/features/sales/schemas"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { formatDate, formatMoney, formatNumber, todayISO } from "@/lib/format"
import { scaleMoney, sumMoney } from "@/lib/money"
import { dateParam, idParam } from "@/lib/search-params"

export const metadata: Metadata = { title: "Flujo de efectivo" }

export default async function CashFlowPage({ searchParams }: PageProps<"/flujo-efectivo">) {
  const ctx = await getOrgContext()
  if (!can(ctx.role, "finance.read")) return <NoAccess title="Flujo de efectivo" />
  const canWrite = can(ctx.role, "cash.write")
  const sp = await searchParams
  const today = todayISO()
  const filters = {
    from: dateParam(sp.desde) ?? `${today.slice(0, 4)}-01-01`,
    to: dateParam(sp.hasta) ?? today,
    projectId: idParam(sp.proyecto),
  }
  const [flow, movements, projects, expenses, sales, projectCost, suppliers] = await Promise.all([
    getCashFlow(filters),
    getCashMovements(filters),
    getProjects(),
    getExpenses({ projectId: filters.projectId }),
    filters.projectId ? Promise.resolve([]) : getSales(),
    filters.projectId ? getProjectCost(filters.projectId) : Promise.resolve(null),
    canWrite ? getSuppliers() : Promise.resolve([]),
  ])
  const codes = new Map(projects.map((p) => [p.id, p.code]))
  const summary = cashFlowSummary(flow)
  const months = cashFlowByMonth(flow)
  const series = monthSeries(filters.from, filters.to, [...months.entries()].map(([month, m]) => ({ month, value: m.income })))
  const payables = expenses.filter((e) => e.pendingAmount > 0)
  // Con filtro de proyecto se toma la parte asignada del saldo de cada gasto.
  const payableAmount = (e: (typeof payables)[number]) => {
    if (!filters.projectId) return e.pendingAmount
    const a = e.allocations.find((x) => x.project_id === filters.projectId)
    return a ? scaleMoney(e.pendingAmount, a.allocation_share) : 0
  }
  const payableTotal = sumMoney(payables.map(payableAmount))
  const receivables = sales.filter((s) => s.balance > 0)
  const receivableTotal = filters.projectId ? (projectCost?.receivableAmount ?? 0) : sumMoney(receivables.map((s) => s.balance))
  const period = `${formatDate(filters.from)} – ${formatDate(filters.to)}`

  return (
    <>
      <PageHeader
        title="Flujo de efectivo"
        description="Dinero efectivamente recibido y pagado. Una venta o un gasto registrados no son ingreso o egreso hasta que se cobran o se pagan."
        actions={
          canWrite && (
            <CashMovementDialog
              suppliers={suppliers.filter((s) => s.is_active).map((s) => ({ id: s.id, label: s.name }))}
              projects={projects.map((p) => ({ id: p.id, label: `${p.code} · ${p.name}` }))}
            />
          )
        }
      />
      <div className="mb-4">
        <FilterBar
          action="/flujo-efectivo"
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

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Ingresos" value={formatMoney(summary.income)} hint={`Cobros y otros ingresos · ${period}`} icon={ArrowDownLeft} tone="positive" />
        <KpiCard label="Egresos" value={formatMoney(summary.outflow)} hint="Pagos de gastos, proveedores y otros" icon={ArrowUpRight} />
        <KpiCard
          label="Flujo neto"
          value={formatMoney(summary.net)}
          hint="Ingresos − egresos del periodo"
          icon={Scale}
          tone={summary.net < 0 ? "negative" : "positive"}
        />
        <KpiCard label="Por cobrar" value={formatMoney(receivableTotal)} hint="Ventas registradas sin cobrar (al día)" icon={HandCoins} />
        <KpiCard
          label="Por pagar"
          value={formatMoney(payableTotal)}
          hint={`${formatNumber(payables.length)} gastos registrados sin pagar`}
          icon={Wallet}
          tone={payableTotal > 0 ? "warning" : "default"}
        />
      </div>
      {filters.projectId && (
        <p className="mb-4 text-sm text-muted-foreground">
          Con filtro de proyecto, los cobros de ventas con varios proyectos y los pagos de gastos compartidos se prorratean; los pagos
          a proveedores generales no se incluyen.
        </p>
      )}

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Ingresos contra egresos</CardTitle>
            <CardDescription>Por mes, en la fecha en que se recibió o pagó el dinero.</CardDescription>
          </CardHeader>
          <CardContent>
            {flow.length === 0 ? (
              <p className="flex h-32 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                Sin movimientos de dinero en el periodo.
              </p>
            ) : (
              <GroupedBarChart
                names={["Ingresos", "Egresos"]}
                caption="Ingresos contra egresos por mes"
                data={series.map((m) => ({ label: m.label, a: m.value, b: months.get(m.month)?.outflow ?? 0 }))}
              />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Por tipo de movimiento</CardTitle>
            <CardDescription>{period}</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
              {[...summary.byKind.entries()].map(([kind, amount]) => (
                <div key={kind} className="contents">
                  <dt className="text-muted-foreground">{CASH_FLOW_KIND_LABELS[kind] ?? kind}</dt>
                  <dd className="text-right tabular-nums">{formatMoney(amount)}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Movimientos de dinero</CardTitle>
          <CardDescription>Ingresos en positivo y egresos en negativo; incluye cobros de ventas y anticipos recibidos.</CardDescription>
        </CardHeader>
        <CardContent>
          <ReportTable
            filename={`flujo-efectivo_${filters.from}_${filters.to}`}
            excel
            emptyText="Sin movimientos de dinero en el periodo."
            columns={[
              { key: "date", header: "Fecha", format: "date" },
              { key: "concept", header: "Concepto" },
              { key: "counterparty", header: "Cliente / proveedor", secondary: true },
              { key: "project", header: "Proyecto", secondary: true },
              { key: "kind", header: "Tipo" },
              { key: "amount", header: "Importe", format: "money", total: true },
              { key: "method", header: "Método de pago", secondary: true },
              { key: "reference", header: "Referencia", secondary: true },
            ]}
            rows={flow.map((e) => ({
              date: e.entry_date,
              concept: e.concept,
              counterparty: e.counterparty,
              project: e.project_id ? (codes.get(e.project_id) ?? "") : "Varios / general",
              kind: CASH_FLOW_KIND_LABELS[e.kind] ?? e.kind,
              amount: e.direction === "ingreso" ? e.amount : -e.amount,
              method: e.method ? PAYMENT_METHOD_LABELS[e.method] : null,
              reference: e.reference,
            }))}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Gastos por pagar</CardTitle>
            <CardDescription>Registrados como costo pero sin egreso completo. Se pagan desde Gastos.</CardDescription>
          </CardHeader>
          <CardContent>
            {payables.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No hay gastos pendientes de pago.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Gasto</TableHead>
                      <TableHead className="text-right">Importe</TableHead>
                      <TableHead className="text-right">Por pagar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payables.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>
                          <p className="font-medium">{e.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {[formatDate(e.expense_date), e.supplier?.name, e.allocations.map((a) => a.project.code).join(", ")]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(e.amount)}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{formatMoney(payableAmount(e))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Ventas por cobrar</CardTitle>
            <CardDescription>Ventas confirmadas con saldo. Se cobran desde Ventas o Cobranza.</CardDescription>
          </CardHeader>
          <CardContent>
            {filters.projectId ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Saldo del proyecto (prorrateado por partidas): {formatMoney(receivableTotal)}.{" "}
                <Link href="/pagos" className="underline">
                  Ver cobranza
                </Link>
              </p>
            ) : receivables.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No hay saldos por cobrar.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Venta</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receivables.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>
                          <Link href={`/ventas/${s.id}`} className="font-medium hover:underline">
                            {s.code}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {s.customerName} · vence {formatDate(s.dueDate)}
                            {s.daysOverdue > 0 && ` · ${formatNumber(s.daysOverdue)} días vencida`}
                          </p>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(s.total)}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{formatMoney(s.balance)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Movimientos capturados</CardTitle>
          <CardDescription>Pagos de gastos, pagos a proveedores y otros ingresos o egresos del periodo, incluidos los cancelados.</CardDescription>
        </CardHeader>
        <CardContent>
          <CashMovementsTable movements={movements} canWrite={canWrite} />
        </CardContent>
      </Card>
    </>
  )
}
