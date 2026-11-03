import { AlertTriangle, Clock, Plus, Tractor, Wallet, Wrench } from "lucide-react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/layout/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { FilterBar } from "@/components/shared/filter-bar"
import { KpiCard } from "@/components/shared/kpi-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { UrlTabs } from "@/components/shared/url-tabs"
import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getActivityTypeOptions } from "@/features/fieldlogs/queries"
import { RecordsTable } from "@/features/finance/components/records-table"
import { getLotBalances, getProducts, getWarehouses } from "@/features/inventory/queries"
import { getEmployeeOptions } from "@/features/labor/queries"
import { deleteUsage } from "@/features/machinery/actions"
import { MachineFormDialog } from "@/features/machinery/components/machine-form-dialog"
import { MachinesTable } from "@/features/machinery/components/machines-table"
import { MaintenanceDialog, MaintenanceTable } from "@/features/machinery/components/maintenance"
import { UsageDialog } from "@/features/machinery/components/usage-dialog"
import { getMachines, getMaintenance, getUsage } from "@/features/machinery/queries"
import { getOpenProjects } from "@/features/projects/queries"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { formatMoney, formatNumber, todayISO } from "@/lib/format"
import { dateParam, idParam, param } from "@/lib/search-params"

export const metadata: Metadata = { title: "Maquinaria" }

const TABS = ["uso", "equipos", "mantenimiento"] as const

export default async function MachineryPage({ searchParams }: PageProps<"/maquinaria">) {
  const sp = await searchParams
  const filters = { from: dateParam(sp.desde), to: dateParam(sp.hasta), projectId: idParam(sp.proyecto) }
  const tab = TABS.find((t) => t === param(sp.tab)) ?? "uso"

  const ctx = await getOrgContext()
  const canWrite = can(ctx.role, "machinery.write")
  const [machines, usage, maintenance, employees, projects, activityTypes, products, warehouses, lotBalances] =
    await Promise.all([
      getMachines(),
      getUsage(filters),
      getMaintenance(),
      getEmployeeOptions(),
      getOpenProjects(),
      canWrite ? getActivityTypeOptions() : Promise.resolve([]),
      canWrite ? getProducts() : Promise.resolve([]),
      canWrite ? getWarehouses() : Promise.resolve([]),
      canWrite ? getLotBalances() : Promise.resolve([]),
    ])
  const monthStart = `${todayISO().slice(0, 8)}01`
  const month = usage.filter((u) => u.usage_date >= monthStart)
  const alerts = machines.filter((m) => m.alert === "vencido" || m.alert === "proximo")
  const machineOptions = machines.filter((m) => m.is_active).map((m) => ({ value: m.id, label: m.name }))
  const fuels = products.filter((p) => p.is_active && p.category.kind === "combustible")
  const maintenanceMonth = maintenance
    .filter((r) => r.status !== "cancelado" && r.maintenance_date >= monthStart)
    .reduce((s, r) => s + Number(r.cost), 0)

  const newMachine = canWrite && (
    <MachineFormDialog
      employees={employees}
      trigger={
        <Button variant="outline">
          <Plus aria-hidden /> Nuevo equipo
        </Button>
      }
    />
  )

  return (
    <>
      <PageHeader
        title="Maquinaria"
        description="Catálogo de equipos, horas de uso cargadas a cada proyecto, mantenimientos y alertas."
        actions={
          <>
            {newMachine}
            {canWrite && (
              <MaintenanceDialog organizationId={ctx.organization.id} machines={machineOptions} employees={employees} />
            )}
            {canWrite && (
              <UsageDialog
                machines={machines}
                projects={projects}
                employees={employees}
                activityTypes={activityTypes}
                fuels={fuels}
                warehouses={warehouses.filter((w) => w.is_active)}
                lotBalances={lotBalances}
              />
            )}
          </>
        }
      />
      {machines.length === 0 ? (
        <EmptyState
          icon={Tractor}
          title="Aún no hay equipos registrados"
          description="Registra tractores, implementos y vehículos con su tarifa por hora o jornada para cargar su uso a los proyectos."
          action={newMachine}
        />
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Equipos operativos"
              value={formatNumber(machines.filter((m) => m.status === "operativa").length)}
              hint={`${formatNumber(machines.filter((m) => m.is_active).length)} activos en catálogo`}
              icon={Tractor}
            />
            <KpiCard label="Horas del mes" value={formatNumber(month.reduce((s, u) => s + Number(u.hours), 0), "h")} icon={Clock} />
            <KpiCard
              label="Costo cargado del mes"
              value={formatMoney(month.reduce((s, u) => s + Number(u.amount), 0))}
              hint={`Mantenimiento del mes: ${formatMoney(maintenanceMonth)} (no se carga a proyectos)`}
              icon={Wallet}
            />
            <KpiCard
              label="Alertas de mantenimiento"
              value={formatNumber(alerts.length)}
              hint={alerts.length ? alerts.slice(0, 3).map((m) => m.name).join(", ") : "Todos los programas al día"}
              icon={alerts.some((m) => m.alert === "vencido") ? AlertTriangle : Wrench}
              tone={alerts.some((m) => m.alert === "vencido") ? "negative" : alerts.length ? "warning" : "default"}
            />
          </div>
          <UrlTabs defaultValue={tab}>
            <TabsList>
              <TabsTrigger value="uso">Uso por proyecto</TabsTrigger>
              <TabsTrigger value="equipos">Equipos</TabsTrigger>
              <TabsTrigger value="mantenimiento">Mantenimiento</TabsTrigger>
            </TabsList>
            <TabsContent value="uso" className="space-y-3">
              <FilterBar
                action="/maquinaria"
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
              <Card>
                <CardContent>
                  <RecordsTable
                    rows={usage.map((u) => ({
                      id: u.id,
                      date: u.usage_date,
                      title: u.machine.name,
                      subtitle:
                        [
                          u.activity ?? u.activity_type?.name,
                          u.operator_ref?.full_name ?? u.operator,
                          u.fuel_quantity !== null &&
                            `${formatNumber(u.fuel_quantity, "l")} combustible${u.fuel ? ` (${formatMoney(u.fuel.total_cost)} en insumos)` : ""}`,
                        ]
                          .filter(Boolean)
                          .join(" · ") || null,
                      project: u.project,
                      plot: u.assignment?.plot.name,
                      quantity:
                        u.rate_basis === "jornada"
                          ? `${formatNumber(u.jornadas)} jornada(s) × ${formatMoney(u.rate)} · ${formatNumber(u.hours, "h")}`
                          : `${formatNumber(u.hours, "h")} × ${formatMoney(u.rate)}`,
                      value: u.amount,
                    }))}
                    quantityHeader="Uso × tarifa"
                    deleteAction={canWrite ? deleteUsage : undefined}
                    deleteLabel="Eliminar uso"
                    emptyText="Sin uso de maquinaria en el periodo."
                  />
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="equipos">
              <Card>
                <CardContent>
                  <MachinesTable
                    machines={machines}
                    employees={employees}
                    canWrite={canWrite}
                    canDelete={can(ctx.role, "catalogs.delete")}
                  />
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="mantenimiento">
              <Card>
                <CardContent>
                  <MaintenanceTable
                    records={maintenance}
                    organizationId={ctx.organization.id}
                    machines={machineOptions}
                    employees={employees}
                    canWrite={canWrite}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </UrlTabs>
        </>
      )}
    </>
  )
}
