import { AlertTriangle, Calculator, PiggyBank, Wallet } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { PageHeader } from "@/components/layout/page-header"
import { KpiCard } from "@/components/shared/kpi-card"
import { NoAccess } from "@/components/shared/no-access"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { budgetAlerts } from "@/features/finance/analysis"
import { AlertSettingsDialog } from "@/features/finance/components/alert-settings-dialog"
import { UsageBar } from "@/features/finance/components/budget-comparison-table"
import { BudgetStatusBadge } from "@/features/finance/components/status-badges"
import { getBudgetComparison, getFinanceSettings, getProjectCosts } from "@/features/finance/queries"
import { BUDGET_CATEGORY_LABELS } from "@/features/finance/schemas"
import { ProjectStatusBadge } from "@/features/projects/components/project-status-badge"
import { isClosed } from "@/features/projects/status"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { formatMoney, formatNumber } from "@/lib/format"
import { fromCents, percent, sumMoney, toCents } from "@/lib/money"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Presupuestos" }

export default async function BudgetsPage() {
  const ctx = await getOrgContext()
  if (!can(ctx.role, "finance.read")) return <NoAccess title="Presupuestos" />
  const canWrite = can(ctx.role, "budgets.write")
  const [projects, comparison, thresholds] = await Promise.all([getProjectCosts(), getBudgetComparison(), getFinanceSettings()])
  const budgeted = projects.filter((p) => p.budgetVersion !== null)
  const budgetTotal = sumMoney(budgeted.map((p) => p.budget ?? 0))
  const costTotal = sumMoney(budgeted.map((p) => p.totalCost))
  const projectAlerts = budgetAlerts(projects.map((p) => ({ ...p, status: p.budgetStatus, usedPct: p.budgetUsedPct })))
  const categoryAlerts = budgetAlerts(comparison)
  // Costos en categorías sin partida, solo de proyectos que sí tienen presupuesto.
  const withBudget = new Set(budgeted.map((p) => p.projectId))
  const unbudgeted = comparison.filter((r) => r.status === "sin_presupuesto" && r.actual > 0 && withBudget.has(r.projectId))

  return (
    <>
      <PageHeader
        title="Presupuestos"
        description="Presupuesto por proyecto y categoría contra el costo real registrado en inventario, mano de obra, maquinaria, actividades y gastos."
        actions={canWrite && <AlertSettingsDialog thresholds={thresholds} />}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Presupuesto vigente"
          value={formatMoney(budgetTotal)}
          hint={`${formatNumber(budgeted.length)} de ${formatNumber(projects.length)} proyectos con presupuesto`}
          icon={Calculator}
        />
        <KpiCard label="Costo real" value={formatMoney(costTotal)} hint="De los proyectos con presupuesto" icon={Wallet} />
        <KpiCard
          label="Utilizado"
          value={percent(costTotal, budgetTotal) === null ? "—" : `${formatNumber(percent(costTotal, budgetTotal))} %`}
          hint={`Restante: ${formatMoney(Math.max(fromCents(toCents(budgetTotal) - toCents(costTotal)), 0))}`}
          icon={PiggyBank}
        />
        <KpiCard
          label="Alertas"
          value={formatNumber(categoryAlerts.length + projectAlerts.length)}
          hint={`Umbrales: ${thresholds.warning} % · ${thresholds.critical} % · ${thresholds.exhausted} %`}
          icon={AlertTriangle}
          tone={categoryAlerts.some((a) => a.status === "agotado") ? "negative" : categoryAlerts.length ? "warning" : "default"}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Proyectos</CardTitle>
            <CardDescription>Versión vigente del presupuesto, costo acumulado y porcentaje utilizado.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Proyecto</TableHead>
                    <TableHead className="text-right">Presupuesto</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">Costo real</TableHead>
                    <TableHead className="w-36">Utilización</TableHead>
                    <TableHead className="hidden md:table-cell">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((p) => (
                    <TableRow key={p.projectId}>
                      <TableCell>
                        <Link href={`/presupuestos/${p.projectId}`} className="font-medium hover:underline">
                          {p.name}
                        </Link>
                        <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {p.code} · {p.cropName}
                          {p.budgetVersion !== null && ` · versión ${p.budgetVersion}`}
                          <ProjectStatusBadge status={p.status} className="hidden sm:inline-flex" />
                        </p>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {p.budgetVersion !== null ? (
                          formatMoney(p.budget)
                        ) : canWrite && !isClosed(p.status) ? (
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/presupuestos/${p.projectId}/editar`}>Elaborar</Link>
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">Sin presupuesto</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatMoney(p.totalCost)}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <span className="text-sm tabular-nums">
                            {p.budgetUsedPct === null ? "—" : `${formatNumber(p.budgetUsedPct)} %`}
                          </span>
                          <UsageBar pct={p.budgetUsedPct} status={p.budgetStatus} />
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <BudgetStatusBadge status={p.budgetStatus} thresholds={thresholds} short />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alertas</CardTitle>
            <CardDescription>
              Categorías y proyectos que alcanzaron {thresholds.warning} %, {thresholds.critical} % o {thresholds.exhausted} % de su
              presupuesto.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {projectAlerts.length + categoryAlerts.length + unbudgeted.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Ninguna categoría alcanza los umbrales de alerta.</p>
            ) : (
              <ul className="divide-y text-sm">
                {projectAlerts.map((p) => (
                  <li key={p.projectId} className="py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/presupuestos/${p.projectId}`} className="font-medium hover:underline">
                        {p.code} · total del proyecto
                      </Link>
                      <BudgetStatusBadge status={p.status} thresholds={thresholds} short />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatNumber(p.usedPct)} % · {formatMoney(p.totalCost)} de {formatMoney(p.budget)}
                    </p>
                  </li>
                ))}
                {categoryAlerts.map((r) => (
                  <li key={`${r.projectId}-${r.category}`} className="py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/presupuestos/${r.projectId}`} className="font-medium hover:underline">
                        {r.code} · {BUDGET_CATEGORY_LABELS[r.category]}
                      </Link>
                      <BudgetStatusBadge status={r.status} thresholds={thresholds} short />
                    </div>
                    <p className={cn("text-xs text-muted-foreground", r.difference < 0 && "text-destructive")}>
                      {formatNumber(r.usedPct)} % · {formatMoney(r.actual)} de {formatMoney(r.budget)}
                      {r.difference < 0 && ` · excede por ${formatMoney(-r.difference)}`}
                    </p>
                  </li>
                ))}
                {unbudgeted.map((r) => (
                  <li key={`${r.projectId}-${r.category}-sp`} className="py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/presupuestos/${r.projectId}`} className="font-medium hover:underline">
                        {r.code} · {BUDGET_CATEGORY_LABELS[r.category]}
                      </Link>
                      <BudgetStatusBadge status="sin_presupuesto" short />
                    </div>
                    <p className="text-xs text-muted-foreground">Costo real de {formatMoney(r.actual)} sin partida presupuestada.</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
