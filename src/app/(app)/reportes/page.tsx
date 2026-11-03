import type { Metadata } from "next"

import { PageHeader } from "@/components/layout/page-header"
import { FilterBar } from "@/components/shared/filter-bar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { UrlTabs } from "@/components/shared/url-tabs"
import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getApplications, getIrrigationLogs } from "@/features/fieldlogs/queries"
import { appliedRate } from "@/features/fieldlogs/schemas"
import { getStock } from "@/features/inventory/queries"
import { getLaborRecords } from "@/features/labor/queries"
import { getMaintenance, getUsage } from "@/features/machinery/queries"
import { getProjects } from "@/features/projects/queries"
import {
  inputConsumption,
  irrigationByPlot,
  laborByWorker,
  laborCostByProject,
  machineryUtilization,
  operatingCosts,
} from "@/features/reports/aggregate"
import { ReportTable } from "@/features/reports/components/report-table"
import { getConsumptionMovements, getCostEntries, REPORT_LIMIT } from "@/features/reports/queries"
import { formatDate, todayISO } from "@/lib/format"
import { dateParam, idParam, param } from "@/lib/search-params"

export const metadata: Metadata = { title: "Reportes operativos" }

const REPORTS = [
  { key: "insumos", label: "Consumo de insumos" },
  { key: "existencias", label: "Existencias" },
  { key: "caducidad", label: "Por caducar" },
  { key: "riegos", label: "Riegos" },
  { key: "aplicaciones", label: "Aplicaciones" },
  { key: "jornadas", label: "Jornadas" },
  { key: "mano-obra", label: "Mano de obra" },
  { key: "maquinaria", label: "Maquinaria" },
  { key: "costos", label: "Costos operativos" },
] as const

const EXPIRY_WINDOW_DAYS = 60

function Report({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export default async function ReportsPage({ searchParams }: PageProps<"/reportes">) {
  const sp = await searchParams
  const today = todayISO()
  const filters = {
    from: dateParam(sp.desde) ?? `${today.slice(0, 4)}-01-01`,
    to: dateParam(sp.hasta) ?? today,
    projectId: idParam(sp.proyecto),
  }
  const tab = REPORTS.find((r) => r.key === param(sp.reporte))?.key ?? "insumos"

  const [projects, movements, stock, irrigations, applications, labor, usage, maintenance, costEntries] = await Promise.all([
    getProjects(),
    getConsumptionMovements(filters),
    getStock(),
    getIrrigationLogs(filters, REPORT_LIMIT),
    getApplications(filters, REPORT_LIMIT),
    getLaborRecords(filters, REPORT_LIMIT),
    getUsage(filters, REPORT_LIMIT),
    getMaintenance(filters, REPORT_LIMIT),
    getCostEntries(filters),
  ])
  const codes = new Map(projects.map((p) => [p.id, p.code]))
  const truncated = [movements, irrigations, applications, labor, usage].some((rows) => rows.length >= REPORT_LIMIT)
  const period = `${formatDate(filters.from)} – ${formatDate(filters.to)}`
  const suffix = `${filters.from}_${filters.to}`
  const expiring = stock
    .filter((s) => s.daysToExpiry !== null && s.daysToExpiry <= EXPIRY_WINDOW_DAYS)
    .sort((a, b) => (a.daysToExpiry ?? 0) - (b.daysToExpiry ?? 0))

  return (
    <>
      <PageHeader
        title="Reportes operativos"
        description="Insumos, existencias, bitácoras, mano de obra y maquinaria por periodo y proyecto. Los gastos directos, ventas y rentabilidad están en Finanzas."
      />
      <div className="mb-4 space-y-2">
        <FilterBar
          action="/reportes"
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
        <p className="text-sm text-muted-foreground">
          Periodo: {period}
          {filters.projectId && ` · Proyecto ${codes.get(filters.projectId) ?? ""}`}
          {truncated && ` · Algún reporte alcanzó ${REPORT_LIMIT.toLocaleString("es-MX")} registros; acota el periodo.`}
        </p>
      </div>

      <UrlTabs param="reporte" defaultValue={tab}>
        <TabsList className="max-w-full overflow-x-auto">
          {REPORTS.map((r) => (
            <TabsTrigger key={r.key} value={r.key}>
              {r.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="insumos">
          <Report
            title="Consumo de insumos por proyecto"
            description="Salidas por consumo menos devoluciones, valoradas al costo histórico de cada movimiento."
          >
            <ReportTable
              filename={`consumo-insumos_${suffix}`}
              columns={[
                { key: "project", header: "Proyecto" },
                { key: "product", header: "Producto" },
                { key: "category", header: "Categoría", secondary: true },
                { key: "unit", header: "Unidad", secondary: true },
                { key: "consumed", header: "Consumido", format: "number", secondary: true },
                { key: "returned", header: "Devuelto", format: "number", secondary: true },
                { key: "net", header: "Neto", format: "number" },
                { key: "cost", header: "Costo", format: "money", total: true },
              ]}
              rows={inputConsumption(movements)}
            />
          </Report>
        </TabsContent>

        <TabsContent value="existencias">
          <Report title="Existencias de almacén" description="Existencia actual por almacén y lote (no depende del periodo).">
            <ReportTable
              filename={`existencias_${today}`}
              columns={[
                { key: "productName", header: "Producto" },
                { key: "categoryName", header: "Categoría", secondary: true },
                { key: "warehouseName", header: "Almacén" },
                { key: "lotNumber", header: "Lote", secondary: true },
                { key: "expiryDate", header: "Caducidad", format: "date", secondary: true },
                { key: "quantity", header: "Existencia", format: "number" },
                { key: "unit", header: "Unidad" },
                { key: "estimatedValue", header: "Valor estimado", format: "money", total: true },
              ]}
              rows={stock}
            />
          </Report>
        </TabsContent>

        <TabsContent value="caducidad">
          <Report
            title="Productos próximos a caducar"
            description={`Lotes con existencia que caducan en los próximos ${EXPIRY_WINDOW_DAYS} días o ya caducados.`}
          >
            <ReportTable
              filename={`por-caducar_${today}`}
              emptyText={`Ningún lote con existencia caduca en los próximos ${EXPIRY_WINDOW_DAYS} días.`}
              columns={[
                { key: "productName", header: "Producto" },
                { key: "lotNumber", header: "Lote" },
                { key: "warehouseName", header: "Almacén", secondary: true },
                { key: "expiryDate", header: "Caducidad", format: "date" },
                { key: "daysToExpiry", header: "Días restantes", format: "number" },
                { key: "quantity", header: "Existencia", format: "number" },
                { key: "unit", header: "Unidad", secondary: true },
                { key: "estimatedValue", header: "Valor estimado", format: "money", total: true },
              ]}
              rows={expiring}
            />
          </Report>
        </TabsContent>

        <TabsContent value="riegos">
          <Report title="Historial de riegos" description="Riegos vigentes por proyecto y parcela. El agua solo suma los riegos con medición.">
            <ReportTable
              filename={`riegos_${suffix}`}
              columns={[
                { key: "project", header: "Proyecto" },
                { key: "plot", header: "Parcela" },
                { key: "events", header: "Riegos", format: "number", total: true },
                { key: "hours", header: "Horas", format: "number", total: true },
                { key: "water", header: "Agua", format: "number", unit: "m³", total: true },
                { key: "measured", header: "Con medición", format: "number", secondary: true },
              ]}
              rows={irrigationByPlot(irrigations)}
            />
          </Report>
        </TabsContent>

        <TabsContent value="aplicaciones">
          <Report
            title="Aplicaciones registradas"
            description="Bitácora de aplicaciones vigentes (lo aplicado, no recomendaciones), con lote, reentrada e intervalo de seguridad."
          >
            <ReportTable
              filename={`aplicaciones_${suffix}`}
              columns={[
                { key: "date", header: "Fecha", format: "date" },
                { key: "project", header: "Proyecto" },
                { key: "plot", header: "Parcela", secondary: true },
                { key: "product", header: "Producto" },
                { key: "ingredient", header: "Ingrediente activo", secondary: true },
                { key: "lot", header: "Lote", secondary: true },
                { key: "quantity", header: "Cantidad", format: "number" },
                { key: "unit", header: "Unidad" },
                { key: "area", header: "Superficie", format: "number", unit: "ha", secondary: true },
                { key: "rate", header: "Cantidad por ha", format: "number", secondary: true },
                { key: "reentry", header: "Reentrada (h)", format: "number", secondary: true },
                { key: "phi", header: "Seguridad (días)", format: "number", secondary: true },
                { key: "responsible", header: "Responsable", secondary: true },
              ]}
              rows={applications
                .filter((a) => a.status !== "cancelado")
                .map((a) => ({
                  date: a.application_date,
                  project: a.project.code,
                  plot: a.assignment.plot.name,
                  product: a.product.name,
                  ingredient: a.active_ingredient,
                  lot: a.lot_number,
                  quantity: a.quantity,
                  unit: a.unit,
                  area: a.treated_area_ha,
                  rate: appliedRate(a.quantity, a.treated_area_ha),
                  reentry: a.reentry_hours,
                  phi: a.preharvest_days,
                  responsible: a.responsible?.full_name ?? null,
                }))}
            />
          </Report>
        </TabsContent>

        <TabsContent value="jornadas">
          <Report title="Jornadas de trabajo" description="Días trabajados, jornales y destajos por trabajador o cuadrilla eventual.">
            <ReportTable
              filename={`jornadas_${suffix}`}
              columns={[
                { key: "worker", header: "Trabajador" },
                { key: "days", header: "Días", format: "number", total: true },
                { key: "jornales", header: "Jornales", format: "number", total: true },
                { key: "destajoRecords", header: "Registros a destajo", format: "number", secondary: true },
                { key: "projects", header: "Proyectos", secondary: true },
                { key: "amount", header: "Importe", format: "money", total: true },
              ]}
              rows={laborByWorker(labor)}
            />
          </Report>
        </TabsContent>

        <TabsContent value="mano-obra">
          <Report title="Costos de mano de obra" description="Costo por proyecto y actividad (jornales y destajos).">
            <ReportTable
              filename={`mano-obra_${suffix}`}
              columns={[
                { key: "project", header: "Proyecto" },
                { key: "activity", header: "Actividad" },
                { key: "jornales", header: "Jornales", format: "number", total: true },
                { key: "destajo", header: "Destajo", format: "money", total: true, secondary: true },
                { key: "amount", header: "Costo total", format: "money", total: true },
              ]}
              rows={laborCostByProject(labor)}
            />
          </Report>
        </TabsContent>

        <TabsContent value="maquinaria">
          <Report
            title="Utilización de maquinaria"
            description="Uso cargado a proyectos, combustible surtido y gasto de mantenimiento del equipo. El mantenimiento no se carga a proyectos, por eso no aparece al filtrar por proyecto."
          >
            <ReportTable
              filename={`maquinaria_${suffix}`}
              columns={[
                { key: "machine", header: "Equipo" },
                { key: "hours", header: "Horas", format: "number", total: true },
                { key: "jornadas", header: "Jornadas", format: "number", total: true, secondary: true },
                { key: "projects", header: "Proyectos", secondary: true },
                { key: "charged", header: "Cargado a proyectos", format: "money", total: true },
                { key: "fuel", header: "Combustible", format: "number", unit: "l", total: true, secondary: true },
                { key: "fuelCost", header: "Costo combustible", format: "money", total: true, secondary: true },
                { key: "maintenance", header: "Mantenimiento", format: "money", total: true },
                { key: "repairs", header: "De ello, reparaciones", format: "money", total: true, secondary: true },
              ]}
              rows={machineryUtilization(usage, filters.projectId ? [] : maintenance)}
            />
          </Report>
        </TabsContent>

        <TabsContent value="costos">
          <Report
            title="Costos operativos por proyecto"
            description="Insumos consumidos, maquinaria, mano de obra y actividades de campo; misma fuente que el costo de producción (sin gastos directos)."
          >
            <ReportTable
              filename={`costos-operativos_${suffix}`}
              columns={[
                { key: "project", header: "Proyecto" },
                { key: "insumos", header: "Insumos", format: "money", total: true },
                { key: "maquinaria", header: "Maquinaria", format: "money", total: true },
                { key: "mano_obra", header: "Mano de obra", format: "money", total: true },
                { key: "actividades", header: "Actividades", format: "money", total: true, secondary: true },
                { key: "total", header: "Total operativo", format: "money", total: true },
              ]}
              rows={operatingCosts(costEntries.map((e) => ({ ...e, code: codes.get(e.project_id) ?? "" })))}
            />
          </Report>
        </TabsContent>
      </UrlTabs>
    </>
  )
}
