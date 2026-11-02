import { HardHat, Plus, UsersRound, Wallet } from "lucide-react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/layout/page-header"
import { KpiCard } from "@/components/shared/kpi-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RecordsTable } from "@/features/finance/components/records-table"
import { deleteLabor } from "@/features/labor/actions"
import { EmployeeFormDialog } from "@/features/labor/components/employee-form-dialog"
import { EmployeesTable } from "@/features/labor/components/employees-table"
import { LaborDialog } from "@/features/labor/components/labor-dialog"
import { getEmployees, getLaborRecords } from "@/features/labor/queries"
import { getOpenProjects } from "@/features/projects/queries"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { formatMoney, formatNumber, todayISO } from "@/lib/format"

export const metadata: Metadata = { title: "Personal" }

export default async function LaborPage() {
  const ctx = await getOrgContext()
  const canRecord = can(ctx.role, "labor.write")
  const canManage = can(ctx.role, "employees.write")
  const [employees, records, projects] = await Promise.all([
    getEmployees(),
    getLaborRecords(),
    canRecord ? getOpenProjects() : Promise.resolve([]),
  ])
  const monthStart = `${todayISO().slice(0, 8)}01`
  const month = records.filter((r) => r.work_date >= monthStart)

  return (
    <>
      <PageHeader
        title="Personal y mano de obra"
        description="Jornales y destajos cargados a cada proyecto y parcela."
        actions={
          <>
            {canManage && (
              <EmployeeFormDialog
                trigger={
                  <Button variant="outline">
                    <Plus aria-hidden /> Nuevo empleado
                  </Button>
                }
              />
            )}
            {canRecord && <LaborDialog employees={employees} projects={projects} />}
          </>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Empleados activos"
          value={formatNumber(employees.filter((e) => e.is_active).length)}
          icon={UsersRound}
        />
        <KpiCard
          label="Jornales del mes"
          value={formatNumber(month.filter((r) => r.pay_type === "jornal").reduce((s, r) => s + Number(r.quantity), 0))}
          icon={HardHat}
        />
        <KpiCard
          label="Costo del mes"
          value={formatMoney(month.reduce((s, r) => s + Number(r.amount), 0))}
          hint="Jornales y destajos"
          icon={Wallet}
        />
      </div>
      <Tabs defaultValue="registros">
        <TabsList>
          <TabsTrigger value="registros">Mano de obra</TabsTrigger>
          <TabsTrigger value="empleados">Empleados</TabsTrigger>
        </TabsList>
        <TabsContent value="registros">
          <Card>
            <CardContent>
              <RecordsTable
                rows={records.map((r) => ({
                  id: r.id,
                  date: r.work_date,
                  title: r.activity,
                  subtitle: r.employee?.full_name ?? r.crew,
                  project: r.project,
                  plot: r.assignment?.plot.name,
                  quantity: `${formatNumber(r.quantity)} ${r.pay_type === "jornal" ? "jornal(es)" : (r.unit_label ?? "unid.")} × ${formatMoney(r.unit_rate)}`,
                  value: r.amount,
                }))}
                quantityHeader="Cantidad × tarifa"
                deleteAction={canRecord ? deleteLabor : undefined}
                emptyText="Sin mano de obra registrada."
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="empleados">
          <Card>
            <CardContent>
              {employees.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Sin empleados registrados. Las cuadrillas eventuales pueden registrarse sin alta de empleados.
                </p>
              ) : (
                <EmployeesTable employees={employees} canWrite={canManage} canDelete={can(ctx.role, "catalogs.delete")} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  )
}
