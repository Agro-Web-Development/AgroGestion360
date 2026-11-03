import type { Metadata } from "next"
import Link from "next/link"

import { PageHeader } from "@/components/layout/page-header"
import { FilterBar } from "@/components/shared/filter-bar"
import { NoAccess } from "@/components/shared/no-access"
import { UrlTabs } from "@/components/shared/url-tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { combineProjects, profitabilityByCrop } from "@/features/finance/analysis"
import { getInitialBudgets, getProjectCosts } from "@/features/finance/queries"
import { ProjectStatusBadge } from "@/features/projects/components/project-status-badge"
import { getActiveCrops } from "@/features/projects/queries"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { formatMoney, formatNumber } from "@/lib/format"
import { sumMoney } from "@/lib/money"
import { idParam, param } from "@/lib/search-params"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Rentabilidad" }

const money = (v: number | null) => formatMoney(v)
const signed = (v: number) => cn("text-right tabular-nums", v < 0 && "text-destructive")

export default async function ProfitabilityPage({ searchParams }: PageProps<"/rentabilidad">) {
  const ctx = await getOrgContext()
  if (!can(ctx.role, "finance.read")) return <NoAccess title="Rentabilidad" />
  const sp = await searchParams
  const cropId = idParam(sp.cultivo)
  const [costs, initial, crops] = await Promise.all([getProjectCosts({ cropId }), getInitialBudgets(), getActiveCrops()])
  const rows = costs.filter((p) => p.totalCost !== 0 || p.budgetVersion !== null || p.salesAmount > 0)
  const totals = combineProjects(rows)
  const byCrop = profitabilityByCrop(rows)
  const tab = param(sp.tab) === "cultivos" ? "cultivos" : "proyectos"

  return (
    <>
      <PageHeader
        title="Rentabilidad"
        description="Situación económica de cada proyecto: presupuesto, costo acumulado, producción, ventas, cobranza y resultado estimado."
      />
      <div className="mb-4">
        <FilterBar
          action="/rentabilidad"
          dates={false}
          selects={[
            {
              name: "cultivo",
              label: "Cultivo",
              value: cropId,
              allLabel: "Todos los cultivos",
              options: crops.map((c) => ({ value: c.id, label: [c.name, c.variety].filter(Boolean).join(" · ") })),
            },
          ]}
        />
      </div>

      <UrlTabs defaultValue={tab}>
        <TabsList>
          <TabsTrigger value="proyectos">Por proyecto</TabsTrigger>
          <TabsTrigger value="cultivos">Por cultivo</TabsTrigger>
        </TabsList>
        <TabsContent value="proyectos">
          <Card>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Proyecto</TableHead>
                      <TableHead className="hidden text-right lg:table-cell">Presupuesto inicial</TableHead>
                      <TableHead className="hidden text-right xl:table-cell">Gastos reales</TableHead>
                      <TableHead className="text-right">Costo acumulado</TableHead>
                      <TableHead className="hidden text-right md:table-cell">Producción</TableHead>
                      <TableHead className="hidden text-right lg:table-cell">Costo / kg</TableHead>
                      <TableHead className="hidden text-right sm:table-cell">Ventas</TableHead>
                      <TableHead className="hidden text-right xl:table-cell">Cobrado</TableHead>
                      <TableHead className="hidden text-right xl:table-cell">Por cobrar</TableHead>
                      <TableHead className="text-right">Resultado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                          Ningún proyecto tiene presupuesto, costos o ventas.
                        </TableCell>
                      </TableRow>
                    )}
                    {rows.map((r) => (
                      <TableRow key={r.projectId}>
                        <TableCell>
                          <Link href={`/proyectos/${r.projectId}`} className="font-medium hover:underline">
                            {r.name}
                          </Link>
                          <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            {r.code} · {r.cropName} · {formatNumber(r.areaHa, "ha")}
                            <ProjectStatusBadge status={r.status} className="hidden sm:inline-flex" />
                          </p>
                        </TableCell>
                        <TableCell className="hidden text-right tabular-nums lg:table-cell">
                          {money(initial.get(r.projectId) ?? null)}
                          {r.budgetVersion !== null && r.budgetVersion > 1 && (
                            <span className="block text-xs text-muted-foreground">vigente v{r.budgetVersion}: {money(r.budget)}</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden text-right tabular-nums xl:table-cell">{money(r.expensesCost)}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {money(r.totalCost)}
                          <span className="block text-xs font-normal text-muted-foreground">{money(r.costPerHa)} / ha</span>
                        </TableCell>
                        <TableCell className="hidden text-right tabular-nums md:table-cell">
                          {formatNumber(r.harvestedKg, "kg")}
                          {r.harvestedKg > 0 && (
                            <span className="block text-xs text-muted-foreground">{formatNumber(r.yieldKgPerHa, "kg/ha")}</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden text-right tabular-nums lg:table-cell">
                          {r.costPerKg !== null ? money(r.costPerKg) : "—"}
                        </TableCell>
                        <TableCell className="hidden text-right tabular-nums sm:table-cell">{money(r.salesAmount)}</TableCell>
                        <TableCell className="hidden text-right tabular-nums xl:table-cell">{money(r.collectedAmount)}</TableCell>
                        <TableCell className="hidden text-right tabular-nums xl:table-cell">{money(r.receivableAmount)}</TableCell>
                        <TableCell className={signed(r.estimatedResult)}>
                          <span className="font-medium">{money(r.estimatedResult)}</span>
                          {r.marginPct !== null && (
                            <span className="block text-xs text-muted-foreground">Margen {formatNumber(r.marginPct)} %</span>
                          )}
                          {r.availableKg > 0 && (
                            <span className="block text-xs text-muted-foreground">
                              Existencia: {formatNumber(r.availableKg, "kg")} ({money(r.stockValueAtCost)} a costo)
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  {rows.length > 1 && (
                    <TableFooter>
                      <TableRow>
                        <TableCell className="font-medium">Total</TableCell>
                        <TableCell className="hidden lg:table-cell" />
                        <TableCell className="hidden text-right tabular-nums xl:table-cell">
                          {money(sumMoney(rows.map((r) => r.expensesCost)))}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{money(totals.totalCost)}</TableCell>
                        <TableCell className="hidden text-right tabular-nums md:table-cell">{formatNumber(totals.harvestedKg, "kg")}</TableCell>
                        <TableCell className="hidden text-right tabular-nums lg:table-cell">{money(totals.costPerKg)}</TableCell>
                        <TableCell className="hidden text-right font-semibold tabular-nums sm:table-cell">{money(totals.sales)}</TableCell>
                        <TableCell className="hidden text-right tabular-nums xl:table-cell">{money(totals.collected)}</TableCell>
                        <TableCell className="hidden text-right tabular-nums xl:table-cell">{money(totals.receivable)}</TableCell>
                        <TableCell className={cn(signed(totals.result), "font-semibold")}>{money(totals.result)}</TableCell>
                      </TableRow>
                    </TableFooter>
                  )}
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="cultivos">
          <Card>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cultivo</TableHead>
                      <TableHead className="hidden text-right sm:table-cell">Superficie</TableHead>
                      <TableHead className="text-right">Costo</TableHead>
                      <TableHead className="hidden text-right md:table-cell">Costo / ha</TableHead>
                      <TableHead className="hidden text-right md:table-cell">Rendimiento</TableHead>
                      <TableHead className="hidden text-right lg:table-cell">Ventas</TableHead>
                      <TableHead className="text-right">Resultado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byCrop.map((c) => (
                      <TableRow key={c.crop}>
                        <TableCell>
                          <p className="font-medium">{c.crop}</p>
                          <p className="text-xs text-muted-foreground">{formatNumber(c.projects)} proyectos</p>
                        </TableCell>
                        <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatNumber(c.areaHa, "ha")}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(c.totalCost)}</TableCell>
                        <TableCell className="hidden text-right tabular-nums md:table-cell">{money(c.costPerHa)}</TableCell>
                        <TableCell className="hidden text-right tabular-nums md:table-cell">
                          {c.harvestedKg > 0 ? formatNumber(c.yieldKgPerHa, "kg/ha") : "—"}
                        </TableCell>
                        <TableCell className="hidden text-right tabular-nums lg:table-cell">{money(c.sales)}</TableCell>
                        <TableCell className={signed(c.result)}>
                          <span className="font-medium">{money(c.result)}</span>
                          {c.marginPct !== null && (
                            <span className="block text-xs text-muted-foreground">Margen {formatNumber(c.marginPct)} %</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </UrlTabs>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Criterios de cálculo</CardTitle>
          <CardDescription>Cómo se obtiene cada cifra (documentado también en docs/decisiones.md).</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 text-sm md:grid-cols-2">
            <div>
              <dt className="font-medium">Ventas</dt>
              <dd className="text-muted-foreground">
                Importe de las ventas confirmadas (sin borradores ni canceladas), por la partida de cada proyecto.
              </dd>
            </div>
            <div>
              <dt className="font-medium">Cobranza</dt>
              <dd className="text-muted-foreground">
                Pagos y anticipos ya aplicados a esas ventas; con varios proyectos se prorratea por importe. No es utilidad.
              </dd>
            </div>
            <div>
              <dt className="font-medium">Costo de producción</dt>
              <dd className="text-muted-foreground">
                Insumos consumidos, mano de obra, maquinaria, combustible, mantenimiento, servicios y gastos aplicados al proyecto. Las
                compras de almacén no cuentan hasta consumirse; ningún costo se registra dos veces.
              </dd>
            </div>
            <div>
              <dt className="font-medium">Resultado estimado</dt>
              <dd className="text-muted-foreground">
                Ventas reconocidas − costo de producción acumulado. Criterio conservador: todo el costo incurrido se resta aunque parte
                de la cosecha siga sin venderse.
              </dd>
            </div>
            <div>
              <dt className="font-medium">Producto en existencia</dt>
              <dd className="text-muted-foreground">
                Kilos cosechados sin vender, valuados a costo de producción por kg solo como referencia: no se suman a ventas ni al
                resultado.
              </dd>
            </div>
            <div>
              <dt className="font-medium">Gastos reales</dt>
              <dd className="text-muted-foreground">
                Gastos registrados en el módulo de gastos (directos y la parte asignada de los compartidos). El costo acumulado los
                incluye junto con los demás módulos.
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </>
  )
}
