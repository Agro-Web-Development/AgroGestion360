"use client"

import { UsersRound } from "lucide-react"
import { useEffect, useState } from "react"
import { useWatch } from "react-hook-form"

import { FormCheckboxList } from "@/components/forms/form-checkbox-list"
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
import { registerCrewLabor } from "../actions"
import type { Crew, Employee } from "../queries"
import { crewLaborSchema, PAY_TYPE_LABELS, PAY_TYPES, type CrewLaborInput } from "../schemas"
import { ActivityTypeField } from "./labor-dialog"

function emptyCrewLabor(): CrewLaborInput {
  return {
    id: newId(),
    crewId: "",
    projectId: "",
    plotId: "",
    date: todayISO(),
    activityTypeId: NONE,
    activity: "",
    payType: "jornal",
    quantity: "1",
    unitLabel: "",
    unitRate: "",
    employeeIds: [],
    notes: "",
  }
}

/** Registra la misma labor para varios integrantes de una cuadrilla (una jornada cada uno). */
export function CrewLaborDialog({
  crews,
  employees,
  projects,
  activityTypes,
}: {
  crews: Crew[]
  employees: Employee[]
  projects: OpenProject[]
  activityTypes: SelectOption[]
}) {
  const [open, setOpen] = useState(false)
  const active = crews.filter((c) => c.is_active && c.members.some((m) => m.active))
  const { form, onSubmit, pending } = useActionForm<CrewLaborInput, number>({
    schema: crewLaborSchema,
    defaultValues: emptyCrewLabor(),
    action: registerCrewLabor,
    onSuccess: () => setOpen(false),
  })
  const [crewId, payType, quantityText, rateText, selected] = useWatch({
    control: form.control,
    name: ["crewId", "payType", "quantity", "unitRate", "employeeIds"],
  })
  const crew = active.find((c) => c.id === crewId)
  const members = (crew?.members ?? []).filter((m) => m.active)
  const wages = new Map(employees.map((e) => [e.id, Number(e.daily_wage)]))

  // Al cambiar de cuadrilla se proponen todos sus integrantes activos.
  useEffect(() => {
    form.setValue(
      "employeeIds",
      (active.find((c) => c.id === crewId)?.members ?? []).filter((m) => m.active).map((m) => m.id)
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al elegir otra cuadrilla
  }, [crewId])

  const quantity = Number(quantityText.replace(/,/g, ""))
  const rateValue = rateText?.replace(/,/g, "") ?? ""
  const estimate =
    quantity > 0
      ? selected.reduce((s, id) => {
          const rate = rateValue !== "" ? Number(rateValue) : payType === "jornal" ? (wages.get(id) ?? NaN) : NaN
          return s + quantity * rate
        }, 0)
      : NaN

  return (
    <FormDialog
      trigger={
        <Button variant="outline" disabled={active.length === 0 || projects.length === 0}>
          <UsersRound aria-hidden /> Jornada de cuadrilla
        </Button>
      }
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (value) form.reset(emptyCrewLabor())
      }}
      title="Jornada de cuadrilla"
      description="Se crea un registro por integrante en una sola operación. Quien tenga falta o ya tenga jornal ese día lo impide."
      onSubmit={onSubmit}
      pending={pending}
      submitLabel="Registrar jornadas"
      after={
        Number.isFinite(estimate) &&
        estimate > 0 && (
          <FormNote>
            {selected.length} integrante(s) · costo a cargar:{" "}
            <span className="font-semibold tabular-nums">{formatMoney(estimate)}</span>
          </FormNote>
        )
      }
    >
      <FieldGroup className="grid gap-5 sm:grid-cols-2">
        <FormSelect
          control={form.control}
          name="crewId"
          label="Cuadrilla"
          options={active.map((c) => ({ value: c.id, label: `${c.name} (${c.members.filter((m) => m.active).length})` }))}
        />
        <FormInput control={form.control} name="date" label="Fecha" type="date" max={todayISO()} />
        <ProjectPlotFields
          control={form.control}
          setValue={form.setValue}
          projects={projects}
          projectName="projectId"
          plotName="plotId"
        />
        <ActivityTypeField
          control={form.control}
          setValue={form.setValue}
          activityTypes={activityTypes}
          typeName="activityTypeId"
          activityName="activity"
        />
        <FormInput control={form.control} name="activity" label="Labor realizada" />
        <FormSelect
          control={form.control}
          name="payType"
          label="Forma de pago"
          options={PAY_TYPES.map((t) => ({ value: t, label: PAY_TYPE_LABELS[t] }))}
        />
        <FormInput
          control={form.control}
          name="quantity"
          label={payType === "jornal" ? "Jornales por integrante" : "Unidades por integrante"}
          inputMode="decimal"
        />
        {payType === "destajo" && <FormInput control={form.control} name="unitLabel" label="Unidad" placeholder="Ej. caja, surco" />}
        <FormInput
          control={form.control}
          name="unitRate"
          label={payType === "jornal" ? "Pago por jornal (opcional)" : "Pago por unidad (MXN)"}
          inputMode="decimal"
          description={payType === "jornal" ? "Vacío = tarifa diaria de cada integrante." : undefined}
        />
        <FormCheckboxList
          control={form.control}
          name="employeeIds"
          label="Integrantes que trabajaron"
          options={members.map((m) => ({ value: m.id, label: m.name }))}
          emptyText={crew ? "La cuadrilla no tiene integrantes activos." : "Primero elige la cuadrilla."}
          className="sm:col-span-2"
        />
        <FormTextarea control={form.control} name="notes" label="Observaciones" rows={2} className="sm:col-span-2" />
      </FieldGroup>
    </FormDialog>
  )
}
