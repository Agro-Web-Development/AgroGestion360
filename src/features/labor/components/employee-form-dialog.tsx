"use client"

import { useState } from "react"

import { FormDialog } from "@/components/forms/form-dialog"
import { FormInput } from "@/components/forms/form-input"
import { FormSelect } from "@/components/forms/form-select"
import { FormTextarea } from "@/components/forms/form-textarea"
import { useActionForm } from "@/components/forms/use-action-form"
import { FieldGroup } from "@/components/ui/field"
import { todayISO } from "@/lib/format"
import { saveEmployee } from "../actions"
import { employeeSchema, WORKER_TYPE_LABELS, WORKER_TYPES, type EmployeeInput } from "../schemas"

const EMPTY: EmployeeInput = {
  fullName: "",
  position: "",
  workerType: "planta",
  phone: "",
  hireDate: "",
  dailyWage: "",
  notes: "",
}

export function EmployeeFormDialog({ trigger, employee }: { trigger: React.ReactNode; employee?: EmployeeInput }) {
  const [open, setOpen] = useState(false)
  const defaults = employee ?? EMPTY
  const { form, onSubmit, pending } = useActionForm<EmployeeInput>({
    schema: employeeSchema,
    defaultValues: defaults,
    action: saveEmployee,
    onSuccess: () => setOpen(false),
  })

  return (
    <FormDialog
      trigger={trigger}
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (value) form.reset(defaults)
      }}
      title={employee ? "Editar empleado" : "Nuevo empleado"}
      description="La tarifa diaria se propone al registrar jornales; cada registro conserva la que tenía. No es nómina fiscal."
      onSubmit={onSubmit}
      pending={pending}
      submitLabel={employee ? "Guardar cambios" : "Registrar empleado"}
    >
      <FieldGroup className="grid gap-5 sm:grid-cols-2">
        <FormInput control={form.control} name="fullName" label="Nombre completo" className="sm:col-span-2" />
        <FormInput control={form.control} name="position" label="Puesto" placeholder="Ej. Jornalero, tractorista" />
        <FormSelect
          control={form.control}
          name="workerType"
          label="Tipo de trabajador"
          options={WORKER_TYPES.map((t) => ({ value: t, label: WORKER_TYPE_LABELS[t] }))}
        />
        <FormInput control={form.control} name="phone" label="Teléfono" type="tel" />
        <FormInput control={form.control} name="hireDate" label="Fecha de ingreso" type="date" max={todayISO()} />
        <FormInput
          control={form.control}
          name="dailyWage"
          label="Tarifa por jornal (MXN)"
          inputMode="decimal"
          description="Costo de un día de trabajo para los proyectos."
        />
        <FormTextarea control={form.control} name="notes" label="Observaciones" className="sm:col-span-2" />
      </FieldGroup>
    </FormDialog>
  )
}
