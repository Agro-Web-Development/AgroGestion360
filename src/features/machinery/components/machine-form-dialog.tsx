"use client"

import { useState } from "react"
import { useWatch } from "react-hook-form"

import { FormDialog } from "@/components/forms/form-dialog"
import { FormInput } from "@/components/forms/form-input"
import { FormSelect, type SelectOption } from "@/components/forms/form-select"
import { FormTextarea } from "@/components/forms/form-textarea"
import { useActionForm } from "@/components/forms/use-action-form"
import { FieldGroup, FieldSeparator } from "@/components/ui/field"
import { todayISO } from "@/lib/format"
import { NONE } from "@/lib/validation"
import { saveMachine } from "../actions"
import {
  MACHINE_KIND_LABELS,
  MACHINE_KINDS,
  MACHINE_STATUS_LABELS,
  MACHINE_STATUSES,
  machineSchema,
  RATE_BASES,
  RATE_BASIS_LABELS,
  type MachineInput,
} from "../schemas"

const EMPTY: MachineInput = {
  name: "",
  code: "",
  kind: "tractor",
  brand: "",
  model: "",
  serialNumber: "",
  acquisitionDate: "",
  acquisitionCost: "",
  status: "operativa",
  responsibleId: NONE,
  rateBasis: "hora",
  hourlyCost: "",
  dailyRate: "",
  maintenanceIntervalHours: "",
  maintenanceIntervalDays: "",
  notes: "",
}

export function MachineFormDialog({
  trigger,
  machine,
  employees,
}: {
  trigger: React.ReactNode
  machine?: MachineInput
  employees: SelectOption[]
}) {
  const [open, setOpen] = useState(false)
  const defaults = machine ?? EMPTY
  const { form, onSubmit, pending } = useActionForm<MachineInput>({
    schema: machineSchema,
    defaultValues: defaults,
    action: saveMachine,
    onSuccess: () => setOpen(false),
  })
  const basis = useWatch({ control: form.control, name: "rateBasis" })

  return (
    <FormDialog
      trigger={trigger}
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (value) form.reset(defaults)
      }}
      title={machine ? "Editar equipo" : "Nuevo equipo"}
      description="Cambiar la tarifa no modifica los costos ya registrados: cada uso guarda la tarifa vigente."
      onSubmit={onSubmit}
      pending={pending}
      submitLabel={machine ? "Guardar cambios" : "Registrar equipo"}
    >
      <FieldGroup className="grid gap-5 sm:grid-cols-2">
        <FormInput control={form.control} name="name" label="Nombre" placeholder="Ej. Tractor John Deere 6110" className="sm:col-span-2" />
        <FormSelect
          control={form.control}
          name="kind"
          label="Tipo"
          options={MACHINE_KINDS.map((k) => ({ value: k, label: MACHINE_KIND_LABELS[k] }))}
        />
        <FormInput control={form.control} name="code" label="Clave / económico" placeholder="Ej. TR-01" />
        <FormInput control={form.control} name="brand" label="Marca" />
        <FormInput control={form.control} name="model" label="Modelo" />
        <FormInput control={form.control} name="serialNumber" label="Número de serie / identificación" />
        <FormSelect
          control={form.control}
          name="status"
          label="Estado"
          options={MACHINE_STATUSES.map((s) => ({ value: s, label: MACHINE_STATUS_LABELS[s] }))}
        />
        <FormInput control={form.control} name="acquisitionDate" label="Fecha de adquisición" type="date" max={todayISO()} />
        <FormInput control={form.control} name="acquisitionCost" label="Costo de adquisición (MXN)" inputMode="decimal" />
        <div className="sm:col-span-2">
          <FormSelect
            control={form.control}
            name="responsibleId"
            label="Responsable"
            options={[{ value: NONE, label: "Sin responsable" }, ...employees]}
          />
        </div>
        <FieldSeparator className="sm:col-span-2">Tarifas de uso</FieldSeparator>
        <FormSelect
          control={form.control}
          name="rateBasis"
          label="Cobro habitual"
          options={RATE_BASES.map((b) => ({ value: b, label: RATE_BASIS_LABELS[b] }))}
          description="Se propone al registrar uso; se puede cambiar en cada registro."
        />
        <FormInput control={form.control} name="hourlyCost" label="Tarifa por hora (MXN)" inputMode="decimal" />
        <FormInput
          control={form.control}
          name="dailyRate"
          label={basis === "jornada" ? "Tarifa por jornada (MXN)" : "Tarifa por jornada (opcional)"}
          inputMode="decimal"
        />
        <p className="text-xs text-muted-foreground sm:col-span-2">
          Las tarifas incluyen operador, depreciación y mantenimiento. Excluyen el combustible si se surte del almacén y los
          mantenimientos registrados aquí no se cargan a los proyectos: así ningún costo se cuenta dos veces.
        </p>
        <FieldSeparator className="sm:col-span-2">Programa de mantenimiento</FieldSeparator>
        <FormInput
          control={form.control}
          name="maintenanceIntervalHours"
          label="Cada cuántas horas"
          inputMode="decimal"
          description="Alerta al 90 % de las horas."
        />
        <FormInput
          control={form.control}
          name="maintenanceIntervalDays"
          label="Cada cuántos días"
          inputMode="numeric"
          description="Alerta 7 días antes."
        />
        <FormTextarea control={form.control} name="notes" label="Notas" className="sm:col-span-2" />
      </FieldGroup>
    </FormDialog>
  )
}
