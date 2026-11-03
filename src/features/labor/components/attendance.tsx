"use client"

import { CalendarCheck, Pencil, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { useWatch } from "react-hook-form"

import { FormDialog } from "@/components/forms/form-dialog"
import { FormInput } from "@/components/forms/form-input"
import { FormSelect, type SelectOption } from "@/components/forms/form-select"
import { FormTextarea } from "@/components/forms/form-textarea"
import { useActionForm } from "@/components/forms/use-action-form"
import { ConfirmAction } from "@/components/shared/confirm-action"
import { matchesQuery, SearchInput } from "@/components/shared/search-input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDate, todayISO } from "@/lib/format"
import { deleteAttendance, saveAttendance } from "../actions"
import type { AttendanceRecord } from "../queries"
import { ATTENDANCE_LABELS, ATTENDANCE_STATUSES, attendanceSchema, type AttendanceInput, type AttendanceStatus } from "../schemas"

const EMPTY = (): AttendanceInput => ({
  employeeId: "",
  date: todayISO(),
  status: "presente",
  checkIn: "",
  checkOut: "",
  notes: "",
})

export function AttendanceDialog({
  employees,
  record,
  trigger,
}: {
  employees: SelectOption[]
  record?: AttendanceInput & { employeeName?: string }
  trigger?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const defaults = record ?? EMPTY()
  const { form, onSubmit, pending } = useActionForm<AttendanceInput>({
    schema: attendanceSchema,
    defaultValues: defaults,
    action: saveAttendance,
    onSuccess: () => setOpen(false),
  })
  const status = useWatch({ control: form.control, name: "status" })

  return (
    <FormDialog
      trigger={
        trigger ?? (
          <Button variant="outline" disabled={employees.length === 0}>
            <CalendarCheck aria-hidden /> Registrar asistencia
          </Button>
        )
      }
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (value) form.reset(record ?? EMPTY())
      }}
      title={record ? `Asistencia de ${record.employeeName ?? "empleado"}` : "Registrar asistencia"}
      description="Registrar un jornal marca automáticamente la asistencia. Una falta o permiso impide cargar trabajo ese día."
      onSubmit={onSubmit}
      pending={pending}
      submitLabel={record ? "Guardar cambios" : "Registrar"}
      wide={false}
    >
      <FieldGroup className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FormSelect control={form.control} name="employeeId" label="Empleado" options={employees} disabled={Boolean(record)} />
        </div>
        <FormInput control={form.control} name="date" label="Fecha" type="date" max={todayISO()} disabled={Boolean(record)} />
        <FormSelect
          control={form.control}
          name="status"
          label="Estado"
          options={ATTENDANCE_STATUSES.map((s) => ({ value: s, label: ATTENDANCE_LABELS[s] }))}
        />
        {status === "presente" && (
          <>
            <FormInput control={form.control} name="checkIn" label="Entrada (opcional)" type="time" />
            <FormInput control={form.control} name="checkOut" label="Salida (opcional)" type="time" />
          </>
        )}
        <FormTextarea control={form.control} name="notes" label="Observaciones" rows={2} className="sm:col-span-2" />
      </FieldGroup>
    </FormDialog>
  )
}

const STATUS_VARIANT: Record<AttendanceStatus, "secondary" | "destructive" | "outline"> = {
  presente: "secondary",
  falta: "destructive",
  permiso: "outline",
  incapacidad: "outline",
  descanso: "outline",
}

export function AttendanceTable({
  records,
  employees,
  canWrite,
}: {
  records: AttendanceRecord[]
  employees: SelectOption[]
  canWrite: boolean
}) {
  const [query, setQuery] = useState("")
  const filtered = useMemo(
    () => records.filter((r) => matchesQuery(query, r.employee.full_name, ATTENDANCE_LABELS[r.status], r.notes)),
    [records, query]
  )
  const absences = filtered.filter((r) => r.status === "falta").length

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput value={query} onChange={setQuery} placeholder="Buscar empleado o estado" />
        <p className="text-sm text-muted-foreground">
          {filtered.length} registros · {absences} falta(s)
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Empleado</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="hidden sm:table-cell">Horario</TableHead>
              <TableHead className="hidden md:table-cell">Observaciones</TableHead>
              {canWrite && (
                <TableHead className="w-24">
                  <span className="sr-only">Acciones</span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Sin asistencias en el periodo.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap">{formatDate(r.work_date)}</TableCell>
                <TableCell>
                  <p className="font-medium">{r.employee.full_name}</p>
                  {r.employee.position && <p className="text-xs text-muted-foreground">{r.employee.position}</p>}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[r.status]}>{ATTENDANCE_LABELS[r.status]}</Badge>
                </TableCell>
                <TableCell className="hidden tabular-nums sm:table-cell">
                  {r.check_in ? `${r.check_in.slice(0, 5)}${r.check_out ? ` – ${r.check_out.slice(0, 5)}` : ""}` : "—"}
                </TableCell>
                <TableCell className="hidden max-w-64 truncate text-sm text-muted-foreground md:table-cell">{r.notes ?? "—"}</TableCell>
                {canWrite && (
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <AttendanceDialog
                        employees={employees}
                        record={{
                          id: r.id,
                          employeeId: r.employee_id,
                          employeeName: r.employee.full_name,
                          date: r.work_date,
                          status: r.status,
                          checkIn: r.check_in?.slice(0, 5) ?? "",
                          checkOut: r.check_out?.slice(0, 5) ?? "",
                          notes: r.notes ?? "",
                        }}
                        trigger={
                          <Button variant="ghost" size="icon" aria-label={`Editar asistencia de ${r.employee.full_name}`}>
                            <Pencil aria-hidden />
                          </Button>
                        }
                      />
                      <ConfirmAction
                        title="Eliminar asistencia"
                        description={`Se eliminará la asistencia de ${r.employee.full_name} del ${formatDate(r.work_date)}. Las jornadas registradas no cambian.`}
                        confirmLabel="Eliminar"
                        action={() => deleteAttendance(r.id)}
                        trigger={
                          <Button variant="ghost" size="icon" aria-label={`Eliminar asistencia de ${r.employee.full_name}`}>
                            <Trash2 aria-hidden />
                          </Button>
                        }
                      />
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
