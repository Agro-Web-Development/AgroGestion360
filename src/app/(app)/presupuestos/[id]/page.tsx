import { ArrowLeft, FilePlus2, History } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { PageHeader } from "@/components/layout/page-header"
import { NoAccess } from "@/components/shared/no-access"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { compareBudget, comparisonTotals } from "@/features/finance/analysis"
import { BudgetComparisonTable } from "@/features/finance/components/budget-comparison-table"
import { getBudgetComparison, getBudgetLines, getBudgetVersions, getFinanceSettings, getProjectCost } from "@/features/finance/queries"
import { BUDGET_CATEGORY_LABELS } from "@/features/finance/schemas"
import { ProjectStatusBadge } from "@/features/projects/components/project-status-badge"
import { getProject } from "@/features/projects/queries"
import { isClosed } from "@/features/projects/status"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { formatDate, formatDateTime, formatMoney, formatNumber } from "@/lib/format"
import { sumMoney } from "@/lib/money"
import { param } from "@/lib/search-params"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Presupuesto del proyecto" }

export default async function ProjectBudgetPage({ params, searchParams }: PageProps<"/presupuestos/[id]">) {
  const { id } = await params
  const ctx = await getOrgContext()
  if (!can(ctx.role, "finance.read")) return <NoAccess title="Presupuesto del proyecto" />
  const sp = await searchParams
  const [project, versions, comparison, costs, thresholds] = await Promise.all([
    getProject(id),
    getBudgetVersions(id),
    getBudgetComparison({ projectId: id }),
    getProjectCost(id),
    getFinanceSettings(),
  ])
  const current = versions.find((v) => v.is_current) ?? null
  const requested = Number(param(sp.version))
  const selected = versions.find((v) => v.version === requested) ?? current
  const lines = selected ? await getBudgetLines(selected.id) : []
  const canRevise = can(ctx.role, "budgets.write") && !isClosed(project.status)

  // El gasto real no depende de la versión: se compara cualquier versión contra lo registrado.
  const rows = compareBudget(
    lines.map((l) => ({ category: l.category, amount: l.amount })),
    comparison.map((r) => ({ category: r.category, amount: r.actual })),
    thresholds
  )
  const totals = comparisonTotals(rows, thresholds)
  const area = selected?.area_ha ?? 0
  const kg = costs?.harvestedKg ?? 0

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href="/presupuestos">
          <ArrowLeft aria-hidden /> Presupuestos
        </Link>
      </Button>
      <PageHeader
        title={project.name}
        description={`${project.code} · ${[project.crop.name, project.crop.variety].filter(Boolean).join(" · ")}`}
        actions={
          canRevise && (
            <Button asChild>
              <Link href={`/presupuestos/${project.id}/editar`}>
                <FilePlus2 aria-hidden /> {current ? "Nueva revisión" : "Elaborar presupuesto"}
              </Link>
            </Button>
          )
        }
      />

      {!selected ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            El proyecto aún no tiene presupuesto por categoría.
            {costs && costs.totalCost > 0 && ` Lleva ${formatMoney(costs.totalCost)} de costo registrado.`}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-3">
          <div className="space-y-4 xl:col-span-2">
            {selected.id !== current?.id && (
              <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
                Estás viendo la versión {selected.version}, que ya no es la vigente.{" "}
                <Link href={`/presupuestos/${project.id}`} className="font-medium underline">
                  Ver la versión {current?.version}
                </Link>
              </p>
            )}
            <Card>
              <CardHeader>
                <CardTitle>Presupuesto contra gasto real</CardTitle>
                <CardDescription>
                  Gasto real acumulado de todos los módulos (sin duplicar compras de almacén) contra la versión {selected.version}.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BudgetComparisonTable rows={rows} thresholds={thresholds} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Partidas · versión {selected.version}</CardTitle>
                <CardDescription>
                  Periodo {formatDate(selected.period_start)} – {formatDate(selected.period_end)} · {formatNumber(selected.area_ha, "ha")} ·{" "}
                  {[selected.crop.name, selected.crop.variety].filter(Boolean).join(" · ")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Concepto</TableHead>
                        <TableHead className="hidden md:table-cell">Categoría</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                        <TableHead className="hidden text-right sm:table-cell">Costo unitario</TableHead>
                        <TableHead className="text-right">Importe</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lines.map((l) => (
                        <TableRow key={l.id}>
                          <TableCell>
                            <p className="font-medium">{l.concept}</p>
                            <p className="text-xs text-muted-foreground md:hidden">{BUDGET_CATEGORY_LABELS[l.category]}</p>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">{BUDGET_CATEGORY_LABELS[l.category]}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(l.quantity, l.unit ?? undefined)}</TableCell>
                          <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatMoney(l.unit_cost)}</TableCell>
                          <TableCell className="text-right font-medium tabular-nums">{formatMoney(l.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell className="font-medium">Total ({formatNumber(lines.length)} partidas)</TableCell>
                        <TableCell className="hidden md:table-cell" />
                        <TableCell />
                        <TableCell className="hidden sm:table-cell" />
                        <TableCell className="text-right font-semibold tabular-nums">
                          {formatMoney(sumMoney(lines.map((l) => l.amount)))}
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Resumen</CardTitle>
                <CardDescription>
                  <ProjectStatusBadge status={project.status} />
                </CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">Presupuesto</dt>
                  <dd className="text-right font-medium tabular-nums">{formatMoney(selected.total)}</dd>
                  <dt className="text-muted-foreground">Costo acumulado</dt>
                  <dd className="text-right font-medium tabular-nums">{formatMoney(costs?.totalCost ?? 0)}</dd>
                  <dt className="text-muted-foreground">Presupuesto restante</dt>
                  <dd className="text-right tabular-nums">{formatMoney(Math.max(totals.difference, 0))}</dd>
                  <dt className="text-muted-foreground">Diferencia presupuestaria</dt>
                  <dd className={cn("text-right tabular-nums", totals.difference < 0 && "text-destructive")}>
                    {formatMoney(totals.difference)}
                  </dd>
                  <dt className="border-t pt-2 text-muted-foreground">Presupuesto por ha</dt>
                  <dd className="border-t pt-2 text-right tabular-nums">{area > 0 ? formatMoney(selected.total / area) : "—"}</dd>
                  <dt className="text-muted-foreground">Costo por ha</dt>
                  <dd className="text-right tabular-nums">{formatMoney(costs?.costPerHa)}</dd>
                  <dt className="text-muted-foreground">Costo por kg</dt>
                  <dd className="text-right tabular-nums">{kg > 0 ? formatMoney(costs?.costPerKg) : "Sin cosecha"}</dd>
                  <dt className="text-muted-foreground">Costo por tonelada</dt>
                  <dd className="text-right tabular-nums">{kg > 0 ? formatMoney(costs?.costPerTon) : "Sin cosecha"}</dd>
                </dl>
                {selected.notes && <p className="mt-4 text-sm text-muted-foreground">{selected.notes}</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="size-4" aria-hidden /> Versiones
                </CardTitle>
                <CardDescription>Las versiones anteriores se conservan sin cambios.</CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="space-y-3 text-sm">
                  {versions.map((v) => (
                    <li key={v.id} className={cn("rounded-md border p-3", v.id === selected.id && "border-primary")}>
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          href={v.is_current ? `/presupuestos/${project.id}` : `/presupuestos/${project.id}?version=${v.version}`}
                          className="font-medium hover:underline"
                        >
                          Versión {v.version}
                          {v.version === 1 && " (original)"}
                        </Link>
                        {v.is_current && <Badge>Vigente</Badge>}
                      </div>
                      <p className="tabular-nums">{formatMoney(v.total)}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(v.created_at)}</p>
                      {v.revision_reason && <p className="mt-1 text-xs">{v.revision_reason}</p>}
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </>
  )
}
