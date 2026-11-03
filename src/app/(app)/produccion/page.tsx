import { Boxes, PackageCheck, Plus, Scale, Scissors, TrendingDown, Wheat } from "lucide-react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/layout/page-header"
import { FilterBar } from "@/components/shared/filter-bar"
import { KpiCard } from "@/components/shared/kpi-card"
import { UrlTabs } from "@/components/shared/url-tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BarListChart } from "@/features/dashboard/components/bar-list-chart"
import { ColumnChart } from "@/features/dashboard/components/column-chart"
import { productionByDate, productionTotals, sumBy, yieldByPlot } from "@/features/harvests/aggregate"
import { HarvestDialog } from "@/features/harvests/components/harvest-dialog"
import { HarvestsTable, LotsTable, MovementsTable } from "@/features/harvests/components/production-tables"
import { getHarvests, getProductionMovements, toLotFigures } from "@/features/harvests/queries"
import { QUALITY_LABELS, type HarvestQuality } from "@/features/harvests/schemas"
import { getEmployeeOptions } from "@/features/labor/queries"
import { getOpenProjects, getProjects } from "@/features/projects/queries"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { formatDate, formatNumber, todayISO } from "@/lib/format"
import { dateParam, idParam, param } from "@/lib/search-params"

export const metadata: Metadata = { title: "Producción" }

const TABS = ["indicadores", "cortes", "inventario", "movimientos"] as const

export default async function ProductionPage({ searchParams }: PageProps<"/produccion">) {
  const sp = await searchParams
  const today = todayISO()
  const filters = {
    from: dateParam(sp.desde) ?? `${today.slice(0, 4)}-01-01`,
    to: dateParam(sp.hasta) ?? today,
    projectId: idParam(sp.proyecto),
  }
  const tab = TABS.find((t) => t === param(sp.tab)) ?? "indicadores"

  const ctx = await getOrgContext()
  const canWrite = can(ctx.role, "harvest.write")
  const canAdjust = can(ctx.role, "produce.adjust")
  const [harvests, lots, movements, projects, openProjects, employees] = await Promise.all([
    getHarvests(filters),
    // El inventario muestra todos los lotes (con existencia de cualquier fecha).
    getHarvests({ projectId: filters.projectId }),
    getProductionMovements(filters),
    getProjects(),
    canWrite ? getOpenProjects(["cosecha", "comercializacion"]) : Promise.resolve([]),
    canWrite ? getEmployeeOptions() : Promise.resolve([]),
  ])

  const figures = toLotFigures(harvests)
  const totals = productionTotals(figures)
  const yields = yieldByPlot(figures)
  const byPlot = sumBy(figures, (r) => `${r.projectCode} · ${r.plotName}`, (r) => r.quantityKg)
  const byQuality = sumBy(figures, (r) => QUALITY_LABELS[r.quality as HarvestQuality], (r) => r.quantityKg)
  const byDate = productionByDate(figures).map((d) => ({ label: formatDate(d.label).slice(0, 6), value: d.value }))
  const stockKg = lots.reduce((t, h) => t + Number(h.available_kg), 0)
  const totalArea = yields.reduce((t, y) => t + y.areaHa, 0)
  const yieldPerHa = totalArea > 0 ? totals.producedKg / totalArea : null

  return (
    <>
      <PageHeader
        title="Producción"
        description="Cortes de cosecha, lotes de producción e inventario de producto cosechado."
        actions={
          canWrite && (
            <HarvestDialog
              organizationId={ctx.organization.id}
              projects={openProjects}
              employees={employees}
              trigger={
                <Button disabled={openProjects.length === 0} title={openProjects.length === 0 ? "No hay proyectos en cosecha o comercialización" : undefined}>
                  <Plus aria-hidden /> Registrar corte
                </Button>
              }
            />
          )
        }
      />

      <div className="mb-6">
        <FilterBar
          action="/produccion"
          from={filters.from}
          to={filters.to}
          preserve={["tab"]}
          selects={[
            {
              name: "proyecto",
              label: "Proyecto",
              value: filters.projectId,
              allLabel: "Todos los proyectos",
              options: projects.map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` })),
            },
          ]}
        />
      </div>

      <UrlTabs defaultValue={tab}>
        <TabsList className="mb-4 w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="indicadores">Indicadores</TabsTrigger>
          <TabsTrigger value="cortes">Cortes ({formatNumber(harvests.length)})</TabsTrigger>
          <TabsTrigger value="inventario">Inventario de producto</TabsTrigger>
          <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
        </TabsList>

        <TabsContent value="indicadores" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Producción del periodo"
              value={formatNumber(totals.producedKg / 1000, "t")}
              hint={`${formatNumber(totals.cuts)} cortes · ${formatNumber(totals.lots)} lotes`}
              icon={Wheat}
            />
            <KpiCard
              label="Rendimiento"
              value={yieldPerHa !== null ? formatNumber(yieldPerHa, "kg/ha") : "—"}
              hint={totalArea > 0 ? `Sobre ${formatNumber(totalArea, "ha")} cosechadas` : "Sin parcelas cosechadas"}
              icon={Scale}
            />
            <KpiCard
              label="Vendido"
              value={formatNumber(totals.soldKg / 1000, "t")}
              hint="Ventas confirmadas de los lotes del periodo"
              icon={PackageCheck}
            />
            <KpiCard
              label="Mermas y ajustes"
              value={formatNumber(totals.shrinkageKg, "kg")}
              hint={totals.producedKg > 0 ? `${formatNumber((totals.shrinkageKg / totals.producedKg) * 100)} % de lo cosechado` : undefined}
              icon={TrendingDown}
              tone={totals.shrinkageKg > 0 ? "warning" : "default"}
            />
            <KpiCard
              label="Disponible de lotes del periodo"
              value={formatNumber(totals.availableKg / 1000, "t")}
              icon={Boxes}
            />
            <KpiCard
              label="Existencia total de producto"
              value={formatNumber(stockKg / 1000, "t")}
              hint={`${formatNumber(lots.filter((l) => Number(l.available_kg) > 0).length)} lotes con existencia`}
              icon={Boxes}
            />
            <KpiCard label="Cortes registrados" value={formatNumber(totals.cuts)} hint="Número de corte por proyecto" icon={Scissors} />
          </div>

          {figures.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Sin cortes en el periodo seleccionado.
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Producción por fecha de corte</CardTitle>
                  <CardDescription>Kilogramos cosechados cada día del periodo.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ColumnChart data={byDate} unit="kg" caption="Producción por fecha de corte" />
                </CardContent>
              </Card>
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Producción por parcela</CardTitle>
                    <CardDescription>Kilogramos cosechados por proyecto y parcela.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <BarListChart data={byPlot.slice(0, 10)} unit="kg" caption="Producción por parcela" />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Producción por calidad</CardTitle>
                    <CardDescription>Kilogramos cosechados por calidad.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <BarListChart data={byQuality} unit="kg" caption="Producción por calidad" />
                  </CardContent>
                </Card>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>Rendimiento por hectárea</CardTitle>
                  <CardDescription>Kilogramos cosechados en el periodo entre la superficie asignada de cada parcela.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Proyecto · parcela</TableHead>
                          <TableHead className="text-right">Superficie</TableHead>
                          <TableHead className="text-right">Cosechado</TableHead>
                          <TableHead className="text-right">Rendimiento</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {yields.map((y) => (
                          <TableRow key={`${y.projectCode}-${y.plotName}`}>
                            <TableCell>
                              <p className="font-medium">{y.plotName}</p>
                              <p className="text-xs text-muted-foreground">{y.projectCode}</p>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{formatNumber(y.areaHa, "ha")}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatNumber(y.kg, "kg")}</TableCell>
                            <TableCell className="text-right font-medium tabular-nums">
                              {y.kgPerHa !== null ? formatNumber(y.kgPerHa, "kg/ha") : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="cortes">
          <Card>
            <CardHeader>
              <CardTitle>Cortes registrados</CardTitle>
              <CardDescription>
                Cada corte por calidad es un lote. Un lote con ventas o ajustes conserva su origen y solo se corrige su
                cantidad sin bajar de lo vendido.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <HarvestsTable
                rows={harvests}
                organizationId={ctx.organization.id}
                canWrite={canWrite}
                projects={openProjects}
                employees={employees}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventario">
          <Card>
            <CardHeader>
              <CardTitle>Inventario de producto cosechado</CardTitle>
              <CardDescription>
                Existencia por lote en kilogramos: inicial − vendido − mermas y ajustes. Las ventas confirmadas descuentan
                el lote y las cancelaciones lo restituyen.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LotsTable rows={lots} canAdjust={canAdjust} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movimientos">
          <Card>
            <CardHeader>
              <CardTitle>Movimientos de producto</CardTitle>
              <CardDescription>
                Salidas por venta, reversiones por cancelación, mermas, pérdidas y ajustes del periodo. No se modifican ni
                eliminan: se revierten con su contrapartida.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MovementsTable rows={movements} canAdjust={canAdjust} />
            </CardContent>
          </Card>
        </TabsContent>
      </UrlTabs>
    </>
  )
}
