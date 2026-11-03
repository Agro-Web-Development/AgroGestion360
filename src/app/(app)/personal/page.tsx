import { CalendarX, HardHat, Plus, UsersRound, Wallet } from "lucide-react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/layout/page-header"
import { FilterBar } from "@/components/shared/filter-bar"
import { KpiCard } from "@/components/shared/kpi-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { UrlTabs } from "@/components/shared/url-tabs"
import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getActivityTypeOptions } from "@/features/fieldlogs/queries"
import { RecordsTable } from "@/features/finance/components/records-table"
import { deleteLabor } from "@/features/labor/actions"
import { AssignmentDialog, AssignmentsTable } from "@/features/labor/components/assignments"
import { AttendanceDialog, AttendanceTable } from "@/features/labor/components/attendance"
import { CrewLaborDialog } from "@/features/labor/components/crew-labor-dialog"
import { CrewsPanel } from "@/features/labor/components/crews"
import { EmployeeFormDialog } from "@/features/labor/components/employee-form-dialog"
import { EmployeesTable } from "@/features/labor/components/employees-table"
import { LaborDialog } from "@/features/labor/components/labor-dialog"
import {
  getAssignments,
  getAttendance,
  getCrews,
  getEmployeeOptions,
  getEmployees,
  getLaborRecords,
} from "@/features/labor/queries"
import { getOpenProjects } from "@/features/projects/queries"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { formatMoney, formatNumber, todayISO } from "@/lib/format"
import { dateParam, idParam, param } from "@/lib/search-params"

export const metadata: Metadata = { title: "Personal" }

const TABS = ["jornadas", "asistencia", "cuadrillas", "asignaciones", "empleados"] as const

export default async function LaborPage({ searchParams }: PageProps<"/personal">) {
  const sp = await searchParams
  const today = todayISO()
  const monthStart = `${today.slice(0, 8)}01`
  // Sin filtro, la vista inicia en el mes en curso.
  const filters = { from: dateParam(sp.desde), to: dateParam(sp.hasta), projectId: idParam(sp.proyecto) }
  const range = { ...filters, from: filters.from ?? (filters.to ? undefined : monthStart) }
  const tab = TABS.find((t) => t === param(sp.tab)) ?? "jornadas"

  const ctx = await getOrgContext()
  const canRecord = can(ctx.role, "labor.write")
  const canManage = can(ctx.role, "employees.write")
  const [employees, employeeOptions, records, attendance, crews, assignments, projects, activityTypes] = await Promise.all([
    getEmployees(),
    getEmployeeOptions(),
    getLaborRecords(range),
    getAttendance(range),
    getCrews(),
    getAssignments(),
    getOpenProjects(),
    canRecord ? getActivityTypeOptions() : Promise.resolve([]),
  ])
  const crewOptions = crews.filter((c) => c.is_active).map((c) => ({ value: c.id, label: c.name }))
  const jornales = records.filter((r) => r.pay_type === "jornal").reduce((s, r) => s + Number(r.quantity), 0)
  const absences = attendance.filter((a) => a.status === "falta").length
  const periodLabel = range.from || range.to ? "del periodo" : "registrados"

  return (
    <>
      <PageHeader
        title="Personal y mano de obra"
        description="Jornadas, destajos, asistencia y cuadrillas cargadas a cada proyecto y parcela. No es nómina fiscal."
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
            {canRecord && (
              <CrewLaborDialog crews={crews} employees={employees} projects={projects} activityTypes={activityTypes} />
            )}
            {canRecord && <LaborDialog employees={employees} projects={projects} activityTypes={activityTypes} />}
          </>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Empleados activos"
          value={formatNumber(employees.filter((e) => e.is_active).length)}
          hint={`${formatNumber(crewOptions.length)} cuadrillas activas`}
          icon={UsersRound}
        />
        <KpiCard label={`Jornales ${periodLabel}`} value={formatNumber(jornales)} icon={HardHat} />
        <KpiCard
          label={`Costo de mano de obra ${periodLabel}`}
          value={formatMoney(records.reduce((s, r) => s + Number(r.amount), 0))}
          hint="Jornales y destajos cargados a proyectos"
          icon={Wallet}
        />
        <KpiCard
          label={`Faltas ${periodLabel}`}
          value={formatNumber(absences)}
          icon={CalendarX}
          tone={absences ? "warning" : "default"}
        />
      </div>
      <UrlTabs defaultValue={tab} className="space-y-1">
        <TabsList className="max-w-full overflow-x-auto">
          <TabsTrigger value="jornadas">Jornadas</TabsTrigger>
          <TabsTrigger value="asistencia">Asistencia</TabsTrigger>
          <TabsTrigger value="cuadrillas">Cuadrillas</TabsTrigger>
          <TabsTrigger value="asignaciones">Asignaciones</TabsTrigger>
          <TabsTrigger value="empleados">Empleados</TabsTrigger>
        </TabsList>
        <TabsContent value="jornadas" className="space-y-3">
          <FilterBar
            action="/personal"
            from={range.from}
            to={range.to}
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
                rows={records.map((r) => ({
                  id: r.id,
                  date: r.work_date,
                  title: r.activity,
                  subtitle: [r.employee?.full_name ?? r.crew, r.crew_ref?.name && `Cuadrilla ${r.crew_ref.name}`, r.activity_type?.name]
                    .filter(Boolean)
                    .join(" · "),
                  project: r.project,
                  plot: r.assignment?.plot.name,
                  quantity: `${formatNumber(r.quantity)} ${r.pay_type === "jornal" ? "jornal(es)" : (r.unit_label ?? "unid.")} × ${formatMoney(r.unit_rate)}`,
                  value: r.amount,
                }))}
                quantityHeader="Cantidad × tarifa"
                deleteAction={canRecord ? deleteLabor : undefined}
                emptyText="Sin mano de obra en el periodo."
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="asistencia" className="space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <FilterBar action="/personal" from={range.from} to={range.to} />
            {canRecord && <AttendanceDialog employees={employeeOptions} />}
          </div>
          <Card>
            <CardContent>
              <AttendanceTable records={attendance} employees={employeeOptions} canWrite={canRecord} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="cuadrillas">
          <CrewsPanel
            crews={crews}
            employees={employeeOptions}
            canWrite={canManage}
            canDelete={can(ctx.role, "catalogs.delete")}
          />
        </TabsContent>
        <TabsContent value="asignaciones" className="space-y-3">
          {canManage && (
            <div className="flex justify-end">
              <AssignmentDialog employees={employeeOptions} projects={projects} crews={crewOptions} />
            </div>
          )}
          <Card>
            <CardContent>
              <AssignmentsTable
                assignments={assignments}
                employees={employeeOptions}
                projects={projects}
                crews={crewOptions}
                canWrite={canManage}
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
      </UrlTabs>
    </>
  )
}
