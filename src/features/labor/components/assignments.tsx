"use client"

import { Pencil, Trash2, UserPlus } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import { FormDialog } from "@/components/forms/form-dialog"
import { FormInput } from "@/components/forms/form-input"
import { FormSelect, type SelectOption } from "@/components/forms/form-select"
import { FormTextarea } from "@/components/forms/form-textarea"
import { useActionForm } from "@/components/forms/use-action-form"
import { ConfirmAction } from "@/components/shared/confirm-action"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ProjectPlotFields } from "@/features/projects/components/project-plot-fields"
import type { OpenProject } from "@/features/projects/queries"
import { isClosed } from "@/features/projects/status"
import { formatDate, todayISO } from "@/lib/format"
import { NONE } from "@/lib/validation"
import { deleteAssignment, saveAssignment } from "../actions"
import type { Assignment } from "../queries"
import { assignmentSchema, type AssignmentInput } from "../schemas"

const EMPTY = (): AssignmentInput => ({
  employeeId: "",
  projectId: "",
  plotId: NONE,
  crewId: NONE,
  startDate: todayISO(),
  endDate: "",
  role: "",
  notes: "",
})

export function AssignmentDialog({
  employees,
  projects,
  crews,
  assignment,
  trigger,
}: {
  employees: SelectOption[]
  projects: OpenProject[]
  crews: SelectOption[]
  assignment?: AssignmentInput
  trigger?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const { form, onSubmit, pending } = useActionForm<AssignmentInput>({
    schema: assignmentSchema,
    defaultValues: assignment ?? EMPTY(),
    action: saveAssignment,
    onSuccess: () => setOpen(false),
  })
  const editing = Boolean(assignment)

  return (
    <FormDialog
      trigger={
        trigger ?? (
          <Button variant="outline" disabled={employees.length === 0 || projects.length === 0}>
            <UserPlus aria-hidden /> Asignar a proyecto
          </Button>
        )
      }
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (value) form.reset(assignment ?? EMPTY())
      }}
      title={editing ? "Editar asignación" : "Asignar trabajador a proyecto"}
      description="Planeación del personal por proyecto y parcela. El costo se genera con las jornadas registradas, no con la asignación."
      onSubmit={onSubmit}
      pending={pending}
      submitLabel={editing ? "Guardar cambios" : "Asignar"}
    >
      <FieldGroup className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FormSelect control={form.control} name="employeeId" label="Trabajador" options={employees} disabled={editing} />
        </div>
        {editing ? (
          <FormSelect
            control={form.control}
            name="plotId"
            label="Parcela (opcional)"
            options={[
              { value: NONE, label: "Todo el proyecto" },
              ...(projects.find((p) => p.id === assignment?.projectId)?.plots ?? []).map((p) => ({
                value: p.id,
                label: `${p.farm} · ${p.name}`,
              })),
            ]}
          />
        ) : (
          <ProjectPlotFields
            control={form.control}
            setValue={form.setValue}
            projects={projects}
            projectName="projectId"
            plotName="plotId"
          />
        )}
        <FormSelect
          control={form.control}
          name="crewId"
          label="Cuadrilla (opcional)"
          options={[{ value: NONE, label: "Sin cuadrilla" }, ...crews]}
        />
        <FormInput control={form.control} name="role" label="Función" placeholder="Ej. Aplicador, jefe de cuadrilla" />
        <FormInput control={form.control} name="startDate" label="Desde" type="date" />
        <FormInput control={form.control} name="endDate" label="Hasta (opcional)" type="date" />
        <FormTextarea control={form.control} name="notes" label="Observaciones" rows={2} className="sm:col-span-2" />
      </FieldGroup>
    </FormDialog>
  )
}

export function AssignmentsTable({
  assignments,
  employees,
  projects,
  crews,
  canWrite,
}: {
  assignments: Assignment[]
  employees: SelectOption[]
  projects: OpenProject[]
  crews: SelectOption[]
  canWrite: boolean
}) {
  const today = todayISO()
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Trabajador</TableHead>
            <TableHead>Proyecto / parcela</TableHead>
            <TableHead className="hidden sm:table-cell">Periodo</TableHead>
            <TableHead className="hidden md:table-cell">Cuadrilla / función</TableHead>
            {canWrite && (
              <TableHead className="w-24">
                <span className="sr-only">Acciones</span>
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {assignments.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                Sin asignaciones registradas.
              </TableCell>
            </TableRow>
          )}
          {assignments.map((a) => {
            const current = a.start_date <= today && (!a.end_date || a.end_date >= today)
            const editable = canWrite && !isClosed(a.project.status)
            return (
              <TableRow key={a.id}>
                <TableCell>
                  <p className="font-medium">{a.employee.full_name}</p>
                  {current && <Badge variant="secondary">Vigente</Badge>}
                </TableCell>
                <TableCell>
                  <Link href={`/proyectos/${a.project.id}`} className="hover:underline">
                    {a.project.code}
                  </Link>
                  <p className="text-xs text-muted-foreground">{a.assignment?.plot.name ?? "Todo el proyecto"}</p>
                </TableCell>
                <TableCell className="hidden whitespace-nowrap sm:table-cell">
                  {formatDate(a.start_date)} – {a.end_date ? formatDate(a.end_date) : "sin fecha de término"}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {[a.crew?.name, a.role].filter(Boolean).join(" · ") || "—"}
                </TableCell>
                {canWrite && (
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {editable && (
                        <AssignmentDialog
                          employees={employees}
                          projects={projects}
                          crews={crews}
                          assignment={{
                            id: a.id,
                            employeeId: a.employee_id,
                            projectId: a.project_id,
                            plotId: a.plot_id ?? NONE,
                            crewId: a.crew_id ?? NONE,
                            startDate: a.start_date,
                            endDate: a.end_date ?? "",
                            role: a.role ?? "",
                            notes: a.notes ?? "",
                          }}
                          trigger={
                            <Button variant="ghost" size="icon" aria-label={`Editar asignación de ${a.employee.full_name}`}>
                              <Pencil aria-hidden />
                            </Button>
                          }
                        />
                      )}
                      <ConfirmAction
                        title="Eliminar asignación"
                        description={`${a.employee.full_name} dejará de aparecer asignado a ${a.project.code}. Sus jornadas registradas no cambian.`}
                        confirmLabel="Eliminar"
                        action={() => deleteAssignment(a.id)}
                        trigger={
                          <Button variant="ghost" size="icon" aria-label={`Eliminar asignación de ${a.employee.full_name}`}>
                            <Trash2 aria-hidden />
                          </Button>
                        }
                      />
                    </div>
                  </TableCell>
                )}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
