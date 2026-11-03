import type { Metadata } from "next"

import { PageHeader } from "@/components/layout/page-header"
import { FilterBar } from "@/components/shared/filter-bar"
import { NoAccess } from "@/components/shared/no-access"
import { UrlTabs } from "@/components/shared/url-tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { costsByProjectClass, expensesByCategory, profitabilityByCrop } from "@/features/finance/analysis"
import { getCostEntries, getCurrentBudgetLines, getExpenses, getInitialBudgets, getProjectCosts } from "@/features/finance/queries"
import {
  BUDGET_CATEGORY_LABELS,
  COST_CLASS_LABELS,
  COST_CLASSES,
  EXPENSE_CATEGORY_LABELS,
  type BudgetCategory,
  type ExpenseCategory,
} from "@/features/finance/schemas"
import { getActiveCrops, getProjects } from "@/features/projects/queries"
import { STATUS_LABELS } from "@/features/projects/status"
import { ReportTable } from "@/features/reports/components/report-table"
import type { ReportColumn } from "@/features/reports/csv"
import { getSales } from "@/features/sales/queries"
import { PAYMENT_STATE_LABELS } from "@/features/sales/schemas"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { formatDate, todayISO } from "@/lib/format"
import { dateParam, idParam, param } from "@/lib/search-params"

export const metadata: Metadata = { title: "Reportes financieros" }

const REPORTS = [
  { key: "estado", label: "Estado financiero" },
  { key: "presupuestos", label: "Presupuestos" },
  { key: "gastos", label: "Gastos por categoría" },
  { key: "costos", label: "Costos de producción" },
  { key: "costo-ha", label: "Costo por hectárea" },
  { key: "costo-kg", label: "Costo por kilogramo" },
  { key: "cultivos", label: "Rentabilidad por cultivo" },
  { key: "ventas", label: "Ventas y cobranza" },
  { key: "pendientes", label: "Cuentas pendientes" },
  { key: "comparacion", label: "Comparación de proyectos" },
] as const

/** Encabezado del reporte; al imprimir (PDF) se agrega la organización y los filtros. */
function Report({
  title,
  description,
  context,
  children,
}: {
  title: string
  description: string
  context: string
  children: React.ReactNode
}) {
  return (
    <Card data-print="report">
      <CardHeader>
        <p className="hidden text-xs text-muted-foreground print:block">{context}</p>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">{children}</CardContent>
    </Card>
  )
}

export default async function FinancialReportsPage({ searchParams }: PageProps<"/reportes-financieros">) {
  const ctx = await getOrgContext()
  if (!can(ctx.role, "finance.read")) return <NoAccess title="Reportes financieros" />
  const sp = await searchParams
  const today = todayISO()
  const filters = {
    from: dateParam(sp.desde) ?? `${today.slice(0, 4)}-01-01`,
    to: dateParam(sp.hasta) ?? today,
    cropId: idParam(sp.cultivo),
    projectId: idParam(sp.proyecto),
  }
  const scope = { cropId: filters.cropId, projectId: filters.projectId }
  const tab = REPORTS.find((r) => r.key === param(sp.reporte))?.key ?? "estado"

  const [costs, initial, budgetLines, expenses, entries, sales, crops, projects] = await Promise.all([
    getProjectCosts(scope),
    getInitialBudgets(),
    getCurrentBudgetLines(scope),
    getExpenses({ from: filters.from, to: filters.to, projectId: filters.projectId }, 5000),
    getCostEntries({ from: filters.from, to: filters.to, projectId: filters.projectId }),
    getSales({ from: filters.from, to: filters.to }),
    getActiveCrops(),
    getProjects(),
  ])
  const inScope = new Set(costs.map((c) => c.projectId))
  const codes = new Map(costs.map((c) => [c.projectId, c.code]))
  const rows = costs.filter((p) => p.totalCost !== 0 || p.budgetVersion !== null || p.salesAmount > 0)
  const suffix = `${filters.from}_${filters.to}`
  const cropName = crops.find((c) => c.id === filters.cropId)
  const projectName = projects.find((p) => p.id === filters.projectId)
  const context = [
    ctx.organization.name,
    `${formatDate(filters.from)} – ${formatDate(filters.to)}`,
    cropName && `Cultivo: ${[cropName.name, cropName.variety].filter(Boolean).join(" · ")}`,
    projectName && `Proyecto: ${projectName.code}`,
    `Generado el ${formatDate(today)}`,
  ]
    .filter(Boolean)
    .join(" · ")
  const common = { excel: true, printable: true } as const

  const expenseRows = expensesByCategory(
    expenses
      .filter((e) => e.status === "registrado")
      .flatMap((e) =>
        e.allocations
          .filter((a) => inScope.has(a.project_id))
          .map((a) => ({
            category: EXPENSE_CATEGORY_LABELS[e.category as ExpenseCategory],
            costCategory: BUDGET_CATEGORY_LABELS[e.cost_category as BudgetCategory],
            projectCode: a.project.code,
            amount: a.amount,
            shared: e.allocation_method !== "directo",
          }))
      )
  )
  const classColumns: ReportColumn[] = COST_CLASSES.map((c) => ({
    key: c,
    header: COST_CLASS_LABELS[c],
    format: "money",
    total: true,
    secondary: c !== "insumos" && c !== "mano_obra",
  }))
  const receivables = sales.filter((s) => s.balance > 0)
  const payables = expenses.filter((e) => e.pendingAmount > 0 && e.allocations.some((a) => inScope.has(a.project_id)))

  return (
    <>
      <PageHeader
        title="Reportes financieros"
        description="Estado financiero, presupuestos, gastos, costos, rentabilidad, ventas y cuentas pendientes con exportación a CSV, Excel y PDF."
      />
      <div className="mb-4 space-y-2" data-print="hide">
        <FilterBar
          action="/reportes-financieros"
          from={filters.from}
          to={filters.to}
          selects={[
            {
              name: "cultivo",
              label: "Cultivo",
              allLabel: "Todos los cultivos",
              value: filters.cropId,
              options: crops.map((c) => ({ value: c.id, label: [c.name, c.variety].filter(Boolean).join(" · ") })),
            },
            {
              name: "proyecto",
              label: "Proyecto",
              allLabel: "Todos los proyectos",
              value: filters.projectId,
              options: projects.map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` })),
            },
          ]}
        />
        <p className="text-sm text-muted-foreground">
          Los reportes por proyecto son acumulados desde el inicio de cada proyecto; gastos, costos de producción y ventas usan el
          periodo. PDF imprime solo el reporte abierto.
        </p>
      </div>

      <UrlTabs param="reporte" defaultValue={tab}>
        <TabsList className="max-w-full overflow-x-auto" data-print="hide">
          {REPORTS.map((r) => (
            <TabsTrigger key={r.key} value={r.key}>
              {r.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="estado">
          <Report
            title="Estado financiero por proyecto"
            description="Presupuesto, costo, ventas, cobranza, saldo y resultado estimado (ventas − costo de producción). Acumulado."
            context={context}
          >
            <ReportTable
              {...common}
              filename={`estado-financiero_${today}`}
              sheetName="Estado financiero"
              emptyText="Sin proyectos con movimientos."
              columns={[
                { key: "code", header: "Proyecto" },
                { key: "name", header: "Nombre", secondary: true },
                { key: "status", header: "Estado", secondary: true },
                { key: "initial", header: "Presupuesto inicial", format: "money", total: true, secondary: true },
                { key: "budget", header: "Presupuesto vigente", format: "money", total: true },
                { key: "cost", header: "Costo de producción", format: "money", total: true },
                { key: "variance", header: "Diferencia presupuestaria", format: "money", total: true, secondary: true },
                { key: "sales", header: "Ventas", format: "money", total: true },
                { key: "collected", header: "Cobrado", format: "money", total: true, secondary: true },
                { key: "receivable", header: "Por cobrar", format: "money", total: true, secondary: true },
                { key: "stock", header: "Existencia a costo", format: "money", total: true, secondary: true },
                { key: "result", header: "Resultado estimado", format: "money", total: true },
                { key: "margin", header: "Margen (%)", format: "number", secondary: true },
              ]}
              rows={rows.map((p) => ({
                code: p.code,
                name: p.name,
                status: STATUS_LABELS[p.status],
                initial: initial.get(p.projectId) ?? null,
                budget: p.budgetVersion !== null ? p.budget : null,
                cost: p.totalCost,
                variance: p.budgetVariance,
                sales: p.salesAmount,
                collected: p.collectedAmount,
                receivable: p.receivableAmount,
                stock: p.stockValueAtCost,
                result: p.estimatedResult,
                margin: p.marginPct,
              }))}
            />
          </Report>
        </TabsContent>

        <TabsContent value="presupuestos">
          <Report
            title="Presupuestos vigentes"
            description="Partidas de la versión vigente de cada proyecto: categoría, concepto, cantidad, costo unitario e importe."
            context={context}
          >
            <ReportTable
              {...common}
              filename={`presupuestos_${today}`}
              sheetName="Presupuestos"
              emptyText="Ningún proyecto tiene presupuesto."
              columns={[
                { key: "project", header: "Proyecto" },
                { key: "version", header: "Versión", format: "number", secondary: true },
                { key: "category", header: "Categoría" },
                { key: "concept", header: "Concepto" },
                { key: "unit", header: "Unidad", secondary: true },
                { key: "quantity", header: "Cantidad", format: "number", secondary: true },
                { key: "unitCost", header: "Costo unitario", format: "money", secondary: true },
                { key: "amount", header: "Importe", format: "money", total: true },
              ]}
              rows={budgetLines.map((l) => ({ ...l, category: BUDGET_CATEGORY_LABELS[l.category] }))}
            />
          </Report>
        </TabsContent>

        <TabsContent value="gastos">
          <Report
            title="Gastos por categoría"
            description="Gastos vigentes del periodo por tipo y categoría presupuestal; los compartidos cuentan con la parte asignada a cada proyecto."
            context={context}
          >
            <ReportTable
              {...common}
              filename={`gastos-categoria_${suffix}`}
              sheetName="Gastos por categoría"
              columns={[
                { key: "category", header: "Tipo de gasto" },
                { key: "costCategory", header: "Categoría presupuestal" },
                { key: "records", header: "Asignaciones", format: "number", total: true, secondary: true },
                { key: "projects", header: "Proyectos", secondary: true },
                { key: "shared", header: "De gastos compartidos", format: "money", total: true, secondary: true },
                { key: "amount", header: "Importe", format: "money", total: true },
              ]}
              rows={expenseRows}
            />
          </Report>
        </TabsContent>

        <TabsContent value="costos">
          <Report
            title="Costos de producción"
            description="Costo registrado en el periodo por proyecto y clase (inventario, personal, maquinaria, actividades y gastos)."
            context={context}
          >
            <ReportTable
              {...common}
              filename={`costos-produccion_${suffix}`}
              sheetName="Costos de producción"
              columns={[{ key: "project", header: "Proyecto" }, ...classColumns, { key: "total", header: "Total", format: "money", total: true }]}
              rows={costsByProjectClass(
                entries.filter((e) => inScope.has(e.projectId)),
                codes
              )}
            />
          </Report>
        </TabsContent>

        <TabsContent value="costo-ha">
          <Report
            title="Costo por hectárea"
            description="Costo acumulado y presupuesto entre la superficie asignada al proyecto."
            context={context}
          >
            <ReportTable
              {...common}
              filename={`costo-hectarea_${today}`}
              sheetName="Costo por hectárea"
              columns={[
                { key: "code", header: "Proyecto" },
                { key: "crop", header: "Cultivo", secondary: true },
                { key: "area", header: "Superficie", format: "number", unit: "ha", total: true },
                { key: "cost", header: "Costo", format: "money", total: true },
                { key: "costPerHa", header: "Costo por ha", format: "money" },
                { key: "budgetPerHa", header: "Presupuesto por ha", format: "money", secondary: true },
              ]}
              rows={rows.map((p) => ({
                code: p.code,
                crop: p.cropName,
                area: p.areaHa,
                cost: p.totalCost,
                costPerHa: p.costPerHa,
                budgetPerHa: p.budget && p.areaHa > 0 ? Math.round((p.budget / p.areaHa) * 100) / 100 : null,
              }))}
            />
          </Report>
        </TabsContent>

        <TabsContent value="costo-kg">
          <Report
            title="Costo por kilogramo"
            description="Costo acumulado entre los kilogramos cosechados (proyectos con cosecha)."
            context={context}
          >
            <ReportTable
              {...common}
              filename={`costo-kilogramo_${today}`}
              sheetName="Costo por kilogramo"
              emptyText="Ningún proyecto tiene cosecha registrada."
              columns={[
                { key: "code", header: "Proyecto" },
                { key: "crop", header: "Cultivo", secondary: true },
                { key: "kg", header: "Cosechado", format: "number", unit: "kg", total: true },
                { key: "yield", header: "Rendimiento", format: "number", unit: "kg/ha", secondary: true },
                { key: "cost", header: "Costo", format: "money", total: true },
                { key: "costPerKg", header: "Costo por kg", format: "money" },
                { key: "costPerTon", header: "Costo por t", format: "money", secondary: true },
              ]}
              rows={rows
                .filter((p) => p.harvestedKg > 0)
                .map((p) => ({
                  code: p.code,
                  crop: p.cropName,
                  kg: p.harvestedKg,
                  yield: p.yieldKgPerHa,
                  cost: p.totalCost,
                  costPerKg: p.costPerKg,
                  costPerTon: p.costPerTon,
                }))}
            />
          </Report>
        </TabsContent>

        <TabsContent value="cultivos">
          <Report
            title="Rentabilidad por cultivo"
            description="Suma de los proyectos de cada cultivo y variedad. Acumulado."
            context={context}
          >
            <ReportTable
              {...common}
              filename={`rentabilidad-cultivo_${today}`}
              sheetName="Rentabilidad por cultivo"
              columns={[
                { key: "crop", header: "Cultivo" },
                { key: "projects", header: "Proyectos", format: "number", total: true, secondary: true },
                { key: "areaHa", header: "Superficie", format: "number", unit: "ha", total: true, secondary: true },
                { key: "harvestedKg", header: "Cosechado", format: "number", unit: "kg", total: true, secondary: true },
                { key: "totalCost", header: "Costo", format: "money", total: true },
                { key: "sales", header: "Ventas", format: "money", total: true },
                { key: "collected", header: "Cobrado", format: "money", total: true, secondary: true },
                { key: "result", header: "Resultado estimado", format: "money", total: true },
                { key: "marginPct", header: "Margen (%)", format: "number" },
              ]}
              rows={profitabilityByCrop(rows)}
            />
          </Report>
        </TabsContent>

        <TabsContent value="ventas">
          <Report
            title="Ventas y cobranza"
            description="Ventas del periodo (sin borradores ni canceladas) con lo cobrado y el saldo al día. Este reporte no se filtra por cultivo ni proyecto."
            context={context}
          >
            <ReportTable
              {...common}
              filename={`ventas-cobranza_${suffix}`}
              sheetName="Ventas y cobranza"
              columns={[
                { key: "code", header: "Folio" },
                { key: "customer", header: "Cliente" },
                { key: "date", header: "Fecha", format: "date", secondary: true },
                { key: "due", header: "Vencimiento", format: "date", secondary: true },
                { key: "total", header: "Total", format: "money", total: true },
                { key: "paid", header: "Cobrado", format: "money", total: true },
                { key: "balance", header: "Saldo", format: "money", total: true },
                { key: "recovery", header: "Recuperación (%)", format: "number", secondary: true },
                { key: "state", header: "Estado de pago", secondary: true },
              ]}
              rows={sales
                .filter((s) => s.status !== "borrador" && s.status !== "cancelada")
                .map((s) => ({
                  code: s.code,
                  customer: s.customerName,
                  date: s.saleDate,
                  due: s.dueDate,
                  total: s.total,
                  paid: s.paid,
                  balance: s.balance,
                  recovery: s.recoveryPct,
                  state: PAYMENT_STATE_LABELS[s.paymentState],
                }))}
            />
          </Report>
        </TabsContent>

        <TabsContent value="pendientes">
          <Report
            title="Cuentas pendientes"
            description="Por cobrar: ventas del periodo con saldo. Por pagar: gastos del periodo sin pagar por completo. Saldos al día de hoy."
            context={context}
          >
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Cuentas por cobrar</h3>
              <ReportTable
                {...common}
                filename={`cuentas-por-cobrar_${today}`}
                sheetName="Por cobrar"
                emptyText="Sin saldos por cobrar."
                columns={[
                  { key: "code", header: "Folio" },
                  { key: "customer", header: "Cliente" },
                  { key: "due", header: "Vencimiento", format: "date" },
                  { key: "overdue", header: "Días vencida", format: "number", secondary: true },
                  { key: "balance", header: "Saldo", format: "money", total: true },
                ]}
                rows={receivables.map((s) => ({
                  code: s.code,
                  customer: s.customerName,
                  due: s.dueDate,
                  overdue: s.daysOverdue,
                  balance: s.balance,
                }))}
              />
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Cuentas por pagar</h3>
              <ReportTable
                {...common}
                filename={`cuentas-por-pagar_${today}`}
                sheetName="Por pagar"
                emptyText="Sin gastos pendientes de pago."
                columns={[
                  { key: "date", header: "Fecha", format: "date" },
                  { key: "description", header: "Concepto" },
                  { key: "supplier", header: "Proveedor", secondary: true },
                  { key: "projects", header: "Proyectos", secondary: true },
                  { key: "amount", header: "Importe", format: "money", total: true },
                  { key: "pending", header: "Por pagar", format: "money", total: true },
                ]}
                rows={payables.map((e) => ({
                  date: e.expense_date,
                  description: e.description,
                  supplier: e.supplier?.name ?? null,
                  projects: e.allocations.map((a) => a.project.code).join(", "),
                  amount: e.amount,
                  pending: e.pendingAmount,
                }))}
              />
            </div>
          </Report>
        </TabsContent>

        <TabsContent value="comparacion">
          <Report
            title="Comparación de proyectos"
            description="Indicadores por hectárea y por kilogramo para comparar proyectos de distinta superficie. Acumulado."
            context={context}
          >
            <ReportTable
              {...common}
              filename={`comparacion-proyectos_${today}`}
              sheetName="Comparación"
              columns={[
                { key: "code", header: "Proyecto" },
                { key: "crop", header: "Cultivo", secondary: true },
                { key: "area", header: "Superficie", format: "number", unit: "ha" },
                { key: "budgetUsed", header: "Presupuesto usado (%)", format: "number", secondary: true },
                { key: "costPerHa", header: "Costo por ha", format: "money" },
                { key: "yield", header: "Rendimiento", format: "number", unit: "kg/ha", secondary: true },
                { key: "costPerKg", header: "Costo por kg", format: "money", secondary: true },
                { key: "salesPerHa", header: "Ventas por ha", format: "money", secondary: true },
                { key: "resultPerHa", header: "Resultado por ha", format: "money" },
                { key: "margin", header: "Margen (%)", format: "number" },
              ]}
              rows={rows.map((p) => ({
                code: p.code,
                crop: p.cropName,
                area: p.areaHa,
                budgetUsed: p.budgetUsedPct,
                costPerHa: p.costPerHa,
                yield: p.harvestedKg > 0 ? p.yieldKgPerHa : null,
                costPerKg: p.costPerKg,
                salesPerHa: p.areaHa > 0 ? Math.round((p.salesAmount / p.areaHa) * 100) / 100 : null,
                resultPerHa: p.areaHa > 0 ? Math.round((p.estimatedResult / p.areaHa) * 100) / 100 : null,
                margin: p.marginPct,
              }))}
            />
          </Report>
        </TabsContent>
      </UrlTabs>
    </>
  )
}
