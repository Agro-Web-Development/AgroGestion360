"use client"

import Link from "next/link"

import { FormInput } from "@/components/forms/form-input"
import { FormSelect } from "@/components/forms/form-select"
import { FormTextarea } from "@/components/forms/form-textarea"
import { SubmitButton } from "@/components/forms/submit-button"
import { useActionForm } from "@/components/forms/use-action-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FieldGroup } from "@/components/ui/field"
import { YIELD_UNIT_LABELS, type YieldUnit } from "@/features/crops/schemas"
import { NONE } from "@/lib/validation"
import { saveProject } from "../actions"
import { projectSchema, type ProjectInput } from "../schemas"

type CropOption = { id: string; name: string; variety: string | null; yield_unit: string; cycle_days: number | null }

export function ProjectForm({
  defaultValues,
  crops,
  members,
  cancelHref,
  budgetLocked = false,
}: {
  defaultValues: ProjectInput
  crops: CropOption[]
  members: { id: string; name: string }[]
  cancelHref: string
  /** Con presupuesto detallado, el total lo define la versión vigente en Presupuestos. */
  budgetLocked?: boolean
}) {
  const { form, onSubmit, pending } = useActionForm<ProjectInput>({
    schema: projectSchema,
    defaultValues,
    action: saveProject,
  })
  const isEdit = Boolean(defaultValues.id)
  const crop = crops.find((c) => c.id === form.watch("cropId"))
  const unit = crop ? YIELD_UNIT_LABELS[crop.yield_unit as YieldUnit]?.toLowerCase() : null

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 xl:grid-cols-3">
      <div className="space-y-4 xl:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Datos del proyecto</CardTitle>
            <CardDescription>
              {isEdit
                ? "El folio y el estado no se editan aquí; el estado cambia desde el expediente."
                : "Se asignará un folio consecutivo y el proyecto iniciará en Planeación."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup className="grid gap-5 md:grid-cols-2">
              <FormInput
                control={form.control}
                name="name"
                label="Nombre del proyecto"
                placeholder="Ej. Maíz blanco P-V 2026 · El Mezquite"
                className="md:col-span-2"
              />
              <FormSelect
                control={form.control}
                name="cropId"
                label="Cultivo y variedad"
                placeholder={crops.length ? "Selecciona un cultivo" : "No hay cultivos activos"}
                options={crops.map((c) => ({ value: c.id, label: c.variety ? `${c.name} · ${c.variety}` : c.name }))}
                description={crop?.cycle_days ? `Ciclo aproximado: ${crop.cycle_days} días.` : undefined}
              />
              <FormInput
                control={form.control}
                name="season"
                label="Ciclo / temporada"
                placeholder="Ej. Primavera-Verano 2026"
              />
              <FormSelect
                control={form.control}
                name="responsibleId"
                label="Responsable"
                placeholder="Sin asignar"
                options={[{ value: NONE, label: "Sin asignar" }, ...members.map((m) => ({ value: m.id, label: m.name }))]}
              />
            </FieldGroup>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Descripción</CardTitle>
          </CardHeader>
          <CardContent>
            <FormTextarea
              control={form.control}
              name="description"
              label="Objetivos, condiciones o notas"
              rows={5}
            />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Calendario</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <FormInput control={form.control} name="startDate" label="Inicio" type="date" />
              <FormInput control={form.control} name="plantingDate" label="Siembra" type="date" />
              <FormInput control={form.control} name="expectedHarvestDate" label="Cosecha estimada" type="date" />
            </FieldGroup>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Metas</CardTitle>
            <CardDescription>El costo real y su avance contra el presupuesto se calculan en el expediente.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <FormInput
                control={form.control}
                name="expectedYield"
                label={unit ? `Producción esperada (${unit})` : "Producción esperada"}
                inputMode="decimal"
                description="Total del proyecto, en la unidad del cultivo."
              />
              <FormInput
                control={form.control}
                name="budgetAmount"
                label="Presupuesto total (MXN)"
                inputMode="decimal"
                placeholder="0.00"
                disabled={budgetLocked}
                description={
                  budgetLocked
                    ? "Es el total de la versión vigente del presupuesto; se modifica con una revisión en Presupuestos."
                    : "Importe global; el desglose por categoría se elabora en Presupuestos."
                }
              />
            </FieldGroup>
          </CardContent>
        </Card>
        <div className="flex justify-end gap-2">
          <Button asChild variant="outline">
            <Link href={cancelHref}>Cancelar</Link>
          </Button>
          <SubmitButton pending={pending} disabled={isEdit && !form.formState.isDirty}>
            {isEdit ? "Guardar cambios" : "Crear proyecto"}
          </SubmitButton>
        </div>
      </div>
    </form>
  )
}
