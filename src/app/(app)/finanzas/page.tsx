import {
  Calculator,
  CircleDollarSign,
  HandCoins,
  Landmark,
  PiggyBank,
  Receipt,
  Scale,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { PageHeader } from "@/components/layout/page-header"
import { FilterBar } from "@/components/shared/filter-bar"
import { KpiCard } from "@/components/shared/kpi-card"
import { NoAccess } from "@/components/shared/no-access"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { monthSeries } from "@/features/commercial/series"
import { BarListChart } from "@/features/dashboard/components/bar-list-chart"
import { ColumnChart } from "@/features/dashboard/components/column-chart"
import { GroupedBarChart, SignedBarChart } from "@/features/dashboard/components/grouped-bar-chart"
import { budgetAlerts, combineProjects, compareBudget } from "@/features/finance/analysis"
import { BudgetStatusBadge } from "@/features/finance/components/status-badges"
import { getBudgetComparison, getFinanceSettings, getFinancialSeries, getProjectCosts } from "@/features/finance/queries"
import { BUDGET_CATEGORY_LABELS, COST_CLASS_LABELS, COST_CLASSES } from "@/features/finance/schemas"
import { getActiveCrops, getProjects } from "@/features/projects/queries"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { formatDate, formatMoney, formatNumber, todayISO } from "@/lib/format"
import { dateParam, idParam } from "@/lib/search-params"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Dashboard financiero" }

function ChartCard({
  title,
  description,
  empty,
  children,
  className,
}: {
  title: string
  description: string
  empty: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {empty ? (
          <p className="flex h-32 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
            Sin registros con los filtros seleccionados.
          </p>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  )
}

function Section({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-4 flex items-center gap-2 text-base font-semibold tracking-tight">
        <Icon className="size-4 text-primary" aria-hidden /> {title}
      </h2>
      {children}
    </section>
  )
}

export default async function FinancialDashboardPage({ searchParams }: PageProps<"/finanzas">) {
  const ctx = await getOrgContext()
  if (!can(ctx.role, "finance.read")) return <NoAccess title="Dashboard financiero" />
  const sp = await searchParams
  const today = todayISO()
  const filters = {
    from: dateParam(sp.desde) ?? `${today.slice(0, 4)}-01-01`,
    to: dateParam(sp.hasta) ?? today,
    cropId: idParam(sp.cultivo),
    projectId: idParam(sp.proyecto),
  }
  const scope = { cropId: filters.cropId, projectId: filters.projectId }
  const [costs, comparison, series, thresholds, crops, projectOptions] = await Promise.all([
    getProjectCosts(scope),
    getBudgetComparison(scope),
    getFinancialSeries(filters),
    getFinanceSettings(),
    getActiveCrops(),
    getProjects(),
  ])
  const projects = costs.filter((p) => p.totalCost !== 0 || p.budgetVersion !== null || p.salesAmount > 0)
  const totals = combineProjects(projects)
  const byCategory = compareBudget(
    comparison.map((r) => ({ category: r.category, amount: r.budget })),
    comparison.map((r) => ({ category: r.category, amount: r.actual })),
    thresholds
  )
  const alerts = budgetAlerts(comparison)
  const costsByMonth = monthSeries(filters.from, filters.to, series.costs_by_month)
  const salesByMonth = monthSeries(filters.from, filters.to, series.sales_by_month)
  const collectionsByMonth = monthSeries(filters.from, filters.to, series.collections_by_month)
  const withHarvest = projects.filter((p) => p.harvestedKg > 0)

  return (
    <>
      <PageHeader
        title="Dashboard financiero"
        description="Inversión, presupuesto, costos, ventas, cobranza y resultado de los proyectos con los registros reales de todos los módulos."
      />
      <div className="mb-6 space-y-2">
        <FilterBar
          action="/finanzas"
          from={filters.from}
          to={filters.to}
          preserve={[]}
          selects={[
            {
              name: "cultivo",
              label: "Cultivo",
              value: filters.cropId,
              allLabel: "Todos los cultivos",
              options: crops.map((c) => ({ value: c.id, label: [c.name, c.variety].filter(Boolean).join(" · ") })),
            },
            {
              name: "proyecto",
              label: "Proyecto",
              value: filters.projectId,
              allLabel: "Todos los proyectos",
              options: projectOptions.map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` })),
            },
          ]}
        />
        <p className="text-sm text-muted-foreground">
          Indicadores acumulados desde el inicio de cada proyecto; las gráficas de evolución usan el periodo del{" "}
          {formatDate(filters.from)} al {formatDate(filters.to)}.
        </p>
      </div>

      <Section icon={Landmark} title="Indicadores">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Inversión total"
            value={formatMoney(totals.totalCost)}
            hint={`Costo acumulado de ${formatNumber(totals.projects)} proyectos`}
            icon={Landmark}
          />
          <KpiCard label="Presupuesto total" value={formatMoney(totals.budget)} hint="Versiones vigentes" icon={Calculator} />
          <KpiCard
            label="Costos reales del periodo"
            value={formatMoney(series.period_cost)}
            hint={`${formatDate(filters.from)} – ${formatDate(filters.to)}`}
            icon={Wallet}
          />
          <KpiCard
            label="Presupuesto utilizado"
            value={totals.budgetUsedPct === null ? "—" : `${formatNumber(totals.budgetUsedPct)} %`}
            hint={alerts.length ? `${formatNumber(alerts.length)} categorías en alerta` : "Sin categorías en alerta"}
            icon={PiggyBank}
            tone={alerts.some((a) => a.status === "agotado") ? "negative" : alerts.length ? "warning" : "default"}
          />
          <KpiCard label="Ventas" value={formatMoney(totals.sales)} hint="Ventas confirmadas (reconocidas)" icon={Receipt} />
          <KpiCard
            label="Cobranza"
            value={formatMoney(totals.collected)}
            hint="Dinero recibido y aplicado a esas ventas"
            icon={CircleDollarSign}
            tone="positive"
          />
          <KpiCard
            label="Cuentas por cobrar"
            value={formatMoney(totals.receivable)}
            hint="Ventas − cobranza"
            icon={HandCoins}
            tone={totals.receivable > 0 ? "warning" : "default"}
          />
          <KpiCard
            label="Resultado estimado"
            value={formatMoney(totals.result)}
            hint={
              totals.stockValueAtCost > 0
                ? `Ventas − costo de producción · existencia a costo ${formatMoney(totals.stockValueAtCost)} (no es ingreso)`
                : "Ventas − costo de producción"
            }
            icon={TrendingUp}
            tone={totals.result < 0 ? "negative" : "positive"}
          />
        </div>
      </Section>

      <Section icon={Scale} title="Presupuesto y costos">
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Presupuesto contra costo real"
            description="Por categoría, versiones vigentes contra el costo acumulado."
            empty={byCategory.length === 0}
          >
            <GroupedBarChart
              layout="bars"
              names={["Presupuesto", "Costo real"]}
              caption="Presupuesto contra costo real por categoría"
              data={byCategory.map((r) => ({ label: BUDGET_CATEGORY_LABELS[r.category], a: r.budget, b: r.actual }))}
            />
          </ChartCard>
          <ChartCard title="Costos por categoría" description="Siete clases de costo, acumulado." empty={totals.totalCost === 0}>
            <BarListChart
              money
              caption="Costos por clase"
              data={COST_CLASSES.map((c) => ({ label: COST_CLASS_LABELS[c], value: totals.byClass[c] })).filter((d) => d.value !== 0)}
            />
          </ChartCard>
          <ChartCard title="Costos por proyecto" description="Costo de producción acumulado." empty={projects.length === 0}>
            <BarListChart
              money
              caption="Costos por proyecto"
              data={[...projects].sort((a, b) => b.totalCost - a.totalCost).map((p) => ({ label: p.code, value: p.totalCost }))}
            />
          </ChartCard>
          <ChartCard title="Evolución de gastos" description="Costo registrado por mes en el periodo." empty={series.costs_by_month.length === 0}>
            <ColumnChart data={costsByMonth} money caption="Costos por mes" />
          </ChartCard>
        </div>
      </Section>

      <Section icon={TrendingUp} title="Ventas y rentabilidad">
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Ventas contra cobranza"
            description="Ventas confirmadas y cobros aplicados por mes."
            empty={series.sales_by_month.length === 0 && series.collections_by_month.length === 0}
          >
            <GroupedBarChart
              names={["Ventas", "Cobranza"]}
              caption="Ventas contra cobranza por mes"
              data={salesByMonth.map((m, i) => ({ label: m.label, a: m.value, b: collectionsByMonth[i]?.value ?? 0 }))}
            />
          </ChartCard>
          <ChartCard title="Rentabilidad por proyecto" description="Resultado estimado: ventas − costo de producción." empty={projects.length === 0}>
            <SignedBarChart caption="Resultado estimado por proyecto" data={projects.map((p) => ({ label: p.code, value: p.estimatedResult }))} />
          </ChartCard>
          <ChartCard title="Costo por hectárea" description="Costo acumulado entre superficie asignada." empty={!projects.some((p) => p.costPerHa)}>
            <BarListChart
              money
              caption="Costo por hectárea"
              data={projects.filter((p) => p.costPerHa).map((p) => ({ label: p.code, value: p.costPerHa ?? 0 }))}
            />
          </ChartCard>
          <ChartCard title="Costo por unidad producida" description="Costo por kilogramo de los proyectos con cosecha." empty={withHarvest.length === 0}>
            <BarListChart
              money
              caption="Costo por kilogramo"
              data={withHarvest.map((p) => ({ label: p.code, value: p.costPerKg ?? 0 }))}
            />
          </ChartCard>
        </div>
      </Section>

      <Section icon={Calculator} title="Comparación de proyectos">
        <Card>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Proyecto</TableHead>
                    <TableHead className="text-right">Presupuesto</TableHead>
                    <TableHead className="text-right">Costo</TableHead>
                    <TableHead className="hidden text-right md:table-cell">Costo / ha</TableHead>
                    <TableHead className="hidden text-right md:table-cell">Rendimiento</TableHead>
                    <TableHead className="hidden text-right lg:table-cell">Ventas</TableHead>
                    <TableHead className="hidden text-right lg:table-cell">Cobrado</TableHead>
                    <TableHead className="text-right">Resultado</TableHead>
                    <TableHead className="hidden xl:table-cell">Presupuesto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((p) => (
                    <TableRow key={p.projectId}>
                      <TableCell>
                        <Link href={`/proyectos/${p.projectId}`} className="font-medium hover:underline">
                          {p.code}
                        </Link>
                        <p className="text-xs text-muted-foreground">{p.cropName} · {formatNumber(p.areaHa, "ha")}</p>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(p.budget)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(p.totalCost)}</TableCell>
                      <TableCell className="hidden text-right tabular-nums md:table-cell">{formatMoney(p.costPerHa)}</TableCell>
                      <TableCell className="hidden text-right tabular-nums md:table-cell">
                        {p.harvestedKg > 0 ? formatNumber(p.yieldKgPerHa, "kg/ha") : "—"}
                      </TableCell>
                      <TableCell className="hidden text-right tabular-nums lg:table-cell">{formatMoney(p.salesAmount)}</TableCell>
                      <TableCell className="hidden text-right tabular-nums lg:table-cell">{formatMoney(p.collectedAmount)}</TableCell>
                      <TableCell className={cn("text-right font-medium tabular-nums", p.estimatedResult < 0 && "text-destructive")}>
                        {formatMoney(p.estimatedResult)}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">
                        <BudgetStatusBadge status={p.budgetStatus} thresholds={thresholds} short />
                        {p.budgetUsedPct !== null && (
                          <span className="ml-2 text-xs text-muted-foreground tabular-nums">{formatNumber(p.budgetUsedPct)} %</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </Section>
    </>
  )
}
