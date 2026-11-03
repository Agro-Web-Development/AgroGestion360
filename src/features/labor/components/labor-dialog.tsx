"use client"

import { Plus } from "lucide-react"
import { useEffect, useState } from "react"
import { useWatch, type Control, type FieldPath, type FieldValues, type UseFormSetValue } from "react-hook-form"

import { FormDialog, FormNote } from "@/components/forms/form-dialog"
import { FormInput } from "@/components/forms/form-input"
import { FormSelect, type SelectOption } from "@/components/forms/form-select"
import { FormTextarea } from "@/components/forms/form-textarea"
import { useActionForm } from "@/components/forms/use-action-form"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { ProjectPlotFields } from "@/features/projects/components/project-plot-fields"
import type { OpenProject } from "@/features/projects/queries"
import { formatMoney, todayISO } from "@/lib/format"
import { newId } from "@/lib/ids"
import { NONE } from "@/lib/validation"
import { registerLabor } from "../actions"
import type { Employee } from "../queries"
import { laborSchema, PAY_TYPE_LABELS, PAY_TYPES, type LaborInput } from "../schemas"

/**
 * Tipo de actividad del catálogo; al elegirlo propone la descripción de la
 * labor si aún está vacía.
 */
export function ActivityTypeField<T extends FieldValues>({
  control,
  setValue,
  activityTypes,
  typeName,
  activityName,
}: {
  control: Control<T>
  setValue: UseFormSetValue<T>
  activityTypes: SelectOption[]
  typeName: FieldPath<T>
  activityName: FieldPath<T>
}) {
  const typeId = useWatch({ control, name: typeName }) as string
  const activity = useWatch({ control, name: activityName }) as string
  useEffect(() => {
    const label = activityTypes.find((t) => t.value === typeId)?.label
    if (label && !activity) setValue(activityName, label as never, { shouldValidate: true })
  }, [typeId, activity, activityTypes, activityName, setValue])

  return (
    <FormSelect
      control={control}
      name={typeName}
      label="Tipo de actividad (opcional)"
      options={[{ value: NONE, label: "Sin clasificar" }, ...activityTypes]}
    />
  )
}

function emptyLabor(): LaborInput {
  return {
    id: newId(),
    projectId: "",
    plotId: "",
    employeeId: NONE,
    crew: "",
    date: todayISO(),
    activityTypeId: NONE,
    activity: "",
    payType: "jornal",
    quantity: "1",
    unitLabel: "",
    unitRate: "",
    notes: "",
  }
}

export function LaborDialog({
  employees,
  projects,
  activityTypes,
}: {
  employees: Employee[]
  projects: OpenProject[]
  activityTypes: SelectOption[]
}) {
  const [open, setOpen] = useState(false)
  const active = employees.filter((e) => e.is_active)
  const { form, onSubmit, pending } = useActionForm<LaborInput>({
    schema: laborSchema,
    defaultValues: emptyLabor(),
    action: registerLabor,
    onSuccess: () => setOpen(false),
  })
  const [employeeId, payType, quantityText, rateText] = useWatch({
    control: form.control,
    name: ["employeeId", "payType", "quantity", "unitRate"],
  })
  const employee = active.find((e) => e.id === employeeId)
  const quantity = Number(quantityText.replace(/,/g, ""))
  const rateValue = rateText?.replace(/,/g, "") ?? ""
  const rate = rateValue !== "" ? Number(rateValue) : employee && payType === "jornal" ? Number(employee.daily_wage) : NaN
  const estimate = quantity > 0 && Number.isFinite(rate) ? quantity * rate : null

  return (
    <FormDialog
      trigger={
        <Button disabled={projects.length === 0}>
          <Plus aria-hidden /> Registrar jornada
        </Button>
      }
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (value) form.reset(emptyLabor())
      }}
      title="Jornada o destajo"
      description="Jornales de empleados (máximo uno por día entre todos los proyectos) o destajo de cuadrillas eventuales."
      onSubmit={onSubmit}
      pending={pending}
      submitLabel="Registrar"
      after={
        estimate !== null && (
          <FormNote>
            Costo a cargar: <span className="font-semibold tabular-nums">{formatMoney(estimate)}</span>
          </FormNote>
        )
      }
    >
      <FieldGroup className="grid gap-5 sm:grid-cols-2">
        <ProjectPlotFields
          control={form.control}
          setValue={form.setValue}
          projects={projects}
          projectName="projectId"
          plotName="plotId"
        />
        <FormSelect
          control={form.control}
          name="employeeId"
          label="Trabajador"
          options={[
            { value: NONE, label: "Cuadrilla / eventuales sin alta" },
            ...active.map((e) => ({ value: e.id, label: `${e.full_name} · ${formatMoney(e.daily_wage)}/día` })),
          ]}
        />
        <FormInput control={form.control} name="date" label="Fecha" type="date" max={todayISO()} />
        {!employee && (
          <FormInput
            control={form.control}
            name="crew"
            label="Cuadrilla"
            placeholder="Ej. Cuadrilla de corte (8 personas)"
            className="sm:col-span-2"
          />
        )}
        <ActivityTypeField
          control={form.control}
          setValue={form.setValue}
          activityTypes={activityTypes}
          typeName="activityTypeId"
          activityName="activity"
        />
        <FormInput control={form.control} name="activity" label="Labor realizada" placeholder="Ej. Deshierbe manual" />
        <FormSelect
          control={form.control}
          name="payType"
          label="Forma de pago"
          options={PAY_TYPES.map((t) => ({ value: t, label: PAY_TYPE_LABELS[t] }))}
        />
        <FormInput
          control={form.control}
          name="quantity"
          label={payType === "jornal" ? "Jornales" : "Unidades"}
          inputMode="decimal"
          description={payType === "jornal" && employee ? "1 = día completo; 0.5 = medio día." : undefined}
        />
        {payType === "destajo" && (
          <FormInput control={form.control} name="unitLabel" label="Unidad" placeholder="Ej. caja, surco, ha" />
        )}
        <FormInput
          control={form.control}
          name="unitRate"
          label={payType === "jornal" ? "Pago por jornal (MXN)" : "Pago por unidad (MXN)"}
          inputMode="decimal"
          description={employee && payType === "jornal" ? "Vacío = tarifa diaria del empleado." : undefined}
        />
        <FormTextarea control={form.control} name="notes" label="Observaciones" rows={2} className="sm:col-span-2" />
      </FieldGroup>
    </FormDialog>
  )
}
