import { PackageCheck, Scale, Wheat } from "lucide-react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/layout/page-header"
import { KpiCard } from "@/components/shared/kpi-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { RecordsTable } from "@/features/finance/components/records-table"
import { getProjectCosts } from "@/features/finance/queries"
import { deleteHarvest } from "@/features/harvests/actions"
import { HarvestDialog } from "@/features/harvests/components/harvest-dialog"
import { getHarvests } from "@/features/harvests/queries"
import { QUALITY_LABELS } from "@/features/harvests/schemas"
import { getOpenProjects } from "@/features/projects/queries"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { formatMoney, formatNumber } from "@/lib/format"

export const metadata: Metadata = { title: "Cosechas" }

export default async function HarvestsPage() {
  const ctx = await getOrgContext()
  const canWrite = can(ctx.role, "harvest.write")
  // Lo vendido y el costo por kg dependen de ventas y gastos (información financiera).
  const canSeeFinance = can(ctx.role, "finance.read")
  const [harvests, projects, costs] = await Promise.all([
    getHarvests(),
    canWrite ? getOpenProjects(["cosecha", "comercializacion"]) : Promise.resolve([]),
    canSeeFinance ? getProjectCosts() : Promise.resolve([]),
  ])
  const totalKg = harvests.reduce((s, h) => s + Number(h.quantity_kg), 0)
  const withHarvest = costs.filter((c) => c.harvestedKg > 0)
  const availableKg = withHarvest.reduce((s, c) => s + c.availableKg, 0)

  return (
    <>
      <PageHeader
        title="Cosechas"
        description="Cortes de producción por proyecto y parcela. Lo cosechado limita lo que se puede vender."
        actions={canWrite && <HarvestDialog projects={projects} />}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <KpiCard label="Producción registrada" value={formatNumber(totalKg / 1000, "t")} hint={`${formatNumber(harvests.length)} cortes`} icon={Wheat} />
        {canSeeFinance && (
          <>
            <KpiCard
              label="Pendiente de venta"
              value={formatNumber(availableKg / 1000, "t")}
              hint="Cosechado − vendido"
              icon={PackageCheck}
            />
            <KpiCard
              label="Vendido"
              value={formatNumber(withHarvest.reduce((s, c) => s + c.soldKg, 0) / 1000, "t")}
              icon={Scale}
            />
          </>
        )}
      </div>

      {withHarvest.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Producción por proyecto</CardTitle>
            <CardDescription>Rendimiento, costo por kilogramo y disponible para venta.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Proyecto</TableHead>
                    <TableHead className="text-right">Cosechado</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">Rendimiento</TableHead>
                    <TableHead className="hidden text-right md:table-cell">Costo / kg</TableHead>
                    <TableHead className="text-right">Disponible</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {withHarvest.map((c) => (
                    <TableRow key={c.projectId}>
                      <TableCell>
                        <p className="font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.code}</p>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(c.harvestedKg, "kg")}</TableCell>
                      <TableCell className="hidden text-right tabular-nums sm:table-cell">
                        {c.yieldKgPerHa !== null ? formatNumber(c.yieldKgPerHa, "kg/ha") : "—"}
                      </TableCell>
                      <TableCell className="hidden text-right tabular-nums md:table-cell">{formatMoney(c.costPerKg)}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{formatNumber(c.availableKg, "kg")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Cortes registrados</CardTitle>
        </CardHeader>
        <CardContent>
          <RecordsTable
            rows={harvests.map((h) => ({
              id: h.id,
              date: h.harvest_date,
              title: `${h.project.crop.name}${h.project.crop.variety ? ` · ${h.project.crop.variety}` : ""}`,
              subtitle: [QUALITY_LABELS[h.quality], h.packages ? `${formatNumber(h.packages)} empaques` : null]
                .filter(Boolean)
                .join(" · "),
              project: h.project,
              plot: h.assignment.plot.name,
              value: h.quantity_kg,
            }))}
            valueHeader="Peso neto"
            valueUnit="kg"
            deleteAction={canWrite ? deleteHarvest : undefined}
            deleteLabel="Eliminar corte"
            emptyText="Sin cortes registrados."
          />
        </CardContent>
      </Card>
    </>
  )
}
