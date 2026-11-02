import { Clock, Plus, Tractor, Wallet } from "lucide-react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/layout/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { KpiCard } from "@/components/shared/kpi-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RecordsTable } from "@/features/finance/components/records-table"
import { deleteUsage } from "@/features/machinery/actions"
import { MachineFormDialog } from "@/features/machinery/components/machine-form-dialog"
import { MachinesTable } from "@/features/machinery/components/machines-table"
import { UsageDialog } from "@/features/machinery/components/usage-dialog"
import { getMachines, getUsage } from "@/features/machinery/queries"
import { getOpenProjects } from "@/features/projects/queries"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { formatMoney, formatNumber, todayISO } from "@/lib/format"

export const metadata: Metadata = { title: "Maquinaria" }

export default async function MachineryPage() {
  const ctx = await getOrgContext()
  const canWrite = can(ctx.role, "machinery.write")
  const [machines, usage, projects] = await Promise.all([
    getMachines(),
    getUsage(),
    canWrite ? getOpenProjects() : Promise.resolve([]),
  ])
  const monthStart = `${todayISO().slice(0, 8)}01`
  const month = usage.filter((u) => u.usage_date >= monthStart)

  const newMachine = canWrite && (
    <MachineFormDialog
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
        description="Catálogo de equipos y horas de uso cargadas a cada proyecto."
        actions={
          <>
            {newMachine}
            {canWrite && <UsageDialog machines={machines} projects={projects} />}
          </>
        }
      />
      {machines.length === 0 ? (
        <EmptyState
          icon={Tractor}
          title="Aún no hay equipos registrados"
          description="Registra tractores, implementos y vehículos con su costo por hora para cargar su uso a los proyectos."
          action={newMachine}
        />
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <KpiCard
              label="Equipos activos"
              value={formatNumber(machines.filter((m) => m.is_active).length)}
              hint={`${formatNumber(machines.length)} en catálogo`}
              icon={Tractor}
            />
            <KpiCard
              label="Horas del mes"
              value={formatNumber(month.reduce((s, u) => s + Number(u.hours), 0), "h")}
              icon={Clock}
            />
            <KpiCard
              label="Costo del mes"
              value={formatMoney(month.reduce((s, u) => s + Number(u.amount), 0))}
              hint="Cargado a proyectos"
              icon={Wallet}
            />
          </div>
          <Tabs defaultValue="uso">
            <TabsList>
              <TabsTrigger value="uso">Uso por proyecto</TabsTrigger>
              <TabsTrigger value="equipos">Equipos</TabsTrigger>
            </TabsList>
            <TabsContent value="uso">
              <Card>
                <CardContent>
                  <RecordsTable
                    rows={usage.map((u) => ({
                      id: u.id,
                      date: u.usage_date,
                      title: u.machine.name,
                      subtitle: [u.activity, u.operator].filter(Boolean).join(" · ") || null,
                      project: u.project,
                      plot: u.assignment?.plot.name,
                      quantity: `${formatNumber(u.hours, "h")} × ${formatMoney(u.hourly_rate)}`,
                      value: u.amount,
                    }))}
                    quantityHeader="Horas × tarifa"
                    deleteAction={canWrite ? deleteUsage : undefined}
                    emptyText="Sin uso de maquinaria registrado."
                  />
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="equipos">
              <Card>
                <CardContent>
                  <MachinesTable machines={machines} canWrite={canWrite} canDelete={can(ctx.role, "catalogs.delete")} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </>
  )
}
