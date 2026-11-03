import { ClipboardList, Droplets, FlaskConical, History, Plus } from "lucide-react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/layout/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { FilterBar } from "@/components/shared/filter-bar"
import { KpiCard } from "@/components/shared/kpi-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { UrlTabs } from "@/components/shared/url-tabs"
import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ActivityDialog, ActivityTypeDialog, ApplicationDialog, IrrigationDialog } from "@/features/fieldlogs/components/log-dialogs"
import { ActivitiesTable, ActivityTypesTable, ApplicationsTable, IrrigationTable } from "@/features/fieldlogs/components/log-tables"
import { ProjectTimeline } from "@/features/fieldlogs/components/timeline"
import {
  getActivities,
  getActivityTypeOptions,
  getActivityTypes,
  getApplications,
  getIrrigationLogs,
  getProjectTimeline,
} from "@/features/fieldlogs/queries"
import { formatDuration } from "@/features/fieldlogs/schemas"
import { getLotBalances, getProducts, getWarehouses } from "@/features/inventory/queries"
import { getEmployeeOptions } from "@/features/labor/queries"
import { getMachines } from "@/features/machinery/queries"
import { getOpenProjects, getProjects } from "@/features/projects/queries"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { formatNumber } from "@/lib/format"
import { dateParam, idParam, param } from "@/lib/search-params"

export const metadata: Metadata = { title: "Bitácoras" }

const TABS = ["riego", "aplicaciones", "actividades", "cronologia", "catalogo"] as const

export default async function FieldLogsPage({ searchParams }: PageProps<"/bitacoras">) {
  const sp = await searchParams
  const filters = { from: dateParam(sp.desde), to: dateParam(sp.hasta), projectId: idParam(sp.proyecto) }
  const tab = TABS.find((t) => t === param(sp.tab)) ?? (filters.projectId && !param(sp.tab) ? "cronologia" : "riego")

  const ctx = await getOrgContext()
  const canWrite = can(ctx.role, "fieldlogs.write")
  const [irrigations, applications, activities, types, typeOptions, employees, openProjects, allProjects, machines] =
    await Promise.all([
      getIrrigationLogs(filters),
      getApplications(filters),
      getActivities(filters),
      getActivityTypes(),
      getActivityTypeOptions(),
      getEmployeeOptions(),
      getOpenProjects(),
      getProjects(),
      getMachines(),
    ])
  const [products, warehouses, lotBalances] = canWrite
    ? await Promise.all([getProducts(), getWarehouses(), getLotBalances()])
    : [[], [], []]
  const timeline = filters.projectId ? await getProjectTimeline(filters.projectId, filters) : []
  const machineOptions = machines.filter((m) => m.is_active).map((m) => ({ value: m.id, label: m.name }))
  const shared = { organizationId: ctx.organization.id, canWrite, employees, projects: openProjects }

  const activeIrrigations = irrigations.filter((r) => r.status !== "cancelado")
  const water = activeIrrigations.reduce((s, r) => s + Number(r.water_m3 ?? 0), 0)
  const minutes = activeIrrigations.reduce((s, r) => s + (r.duration_minutes ?? 0), 0)
  const noProjects = openProjects.length === 0
  const projectFilter = {
    name: "proyecto",
    label: "Proyecto",
    allLabel: "Todos los proyectos",
    value: filters.projectId,
    options: allProjects.map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` })),
  }

  return (
    <>
      <PageHeader
        title="Bitácoras de campo"
        description="Riegos, aplicaciones y labores registradas por proyecto y parcela, con evidencia fotográfica."
        actions={
          canWrite && (
            <>
              <IrrigationDialog
                {...shared}
                trigger={
                  <Button variant="outline" disabled={noProjects}>
                    <Droplets aria-hidden /> Riego
                  </Button>
                }
              />
              <ApplicationDialog
                {...shared}
                products={products}
                warehouses={warehouses}
                lotBalances={lotBalances}
                machines={machineOptions}
                trigger={
                  <Button variant="outline" disabled={noProjects}>
                    <FlaskConical aria-hidden /> Aplicación
                  </Button>
                }
              />
              <ActivityDialog
                {...shared}
                activityTypes={typeOptions}
                trigger={
                  <Button disabled={noProjects}>
                    <Plus aria-hidden /> Actividad
                  </Button>
                }
              />
            </>
          )
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Riegos"
          value={formatNumber(activeIrrigations.length)}
          hint={`${formatDuration(minutes)} de riego`}
          icon={Droplets}
        />
        <KpiCard label="Agua registrada" value={formatNumber(water, "m³")} hint="Solo riegos con medición" icon={Droplets} />
        <KpiCard
          label="Aplicaciones"
          value={formatNumber(applications.filter((a) => a.status !== "cancelado").length)}
          hint="Agroquímicos, biológicos y fertilizantes"
          icon={FlaskConical}
        />
        <KpiCard
          label="Actividades"
          value={formatNumber(activities.filter((a) => a.status !== "cancelado").length)}
          hint={filters.from || filters.to ? "En el periodo" : "Registros más recientes"}
          icon={ClipboardList}
        />
      </div>

      <div className="mb-4">
        <FilterBar action="/bitacoras" from={filters.from} to={filters.to} selects={[projectFilter]} />
      </div>

      <UrlTabs defaultValue={tab}>
        <TabsList className="max-w-full overflow-x-auto">
          <TabsTrigger value="riego">Riego</TabsTrigger>
          <TabsTrigger value="aplicaciones">Aplicaciones</TabsTrigger>
          <TabsTrigger value="actividades">Actividades</TabsTrigger>
          <TabsTrigger value="cronologia">Cronología</TabsTrigger>
          <TabsTrigger value="catalogo">Catálogo de actividades</TabsTrigger>
        </TabsList>
        <TabsContent value="riego">
          <Card>
            <CardContent>
              <IrrigationTable logs={irrigations} {...shared} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="aplicaciones">
          <Card>
            <CardContent>
              <ApplicationsTable applications={applications} machines={machineOptions} {...shared} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="actividades">
          <Card>
            <CardContent>
              <ActivitiesTable activities={activities} activityTypes={typeOptions} {...shared} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="cronologia">
          <Card>
            <CardHeader>
              <CardTitle>Cronología del proyecto</CardTitle>
              <CardDescription>
                Todo lo registrado en el proyecto: riegos, aplicaciones, actividades, jornadas, maquinaria e insumos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!filters.projectId ? (
                <EmptyState
                  icon={History}
                  title="Elige un proyecto"
                  description="Selecciona el proyecto en los filtros para ver su bitácora cronológica."
                />
              ) : timeline.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Sin registros en el periodo.</p>
              ) : (
                <ProjectTimeline entries={timeline} showAmounts={can(ctx.role, "finance.read")} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="catalogo">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div className="space-y-1.5">
                <CardTitle>Catálogo de actividades</CardTitle>
                <CardDescription>Se usa en la bitácora de actividades, la mano de obra y el uso de maquinaria.</CardDescription>
              </div>
              {can(ctx.role, "catalogs.write") && (
                <ActivityTypeDialog
                  trigger={
                    <Button variant="outline" size="sm">
                      <Plus aria-hidden /> Nueva actividad
                    </Button>
                  }
                />
              )}
            </CardHeader>
            <CardContent>
              <ActivityTypesTable
                types={types}
                canWrite={can(ctx.role, "catalogs.write")}
                canDelete={can(ctx.role, "catalogs.delete")}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </UrlTabs>
    </>
  )
}
