"use client"

import { useId, useState } from "react"
import { useWatch } from "react-hook-form"

import { FormDialog, FormNote } from "@/components/forms/form-dialog"
import { FormInput } from "@/components/forms/form-input"
import { FormSelect, type SelectOption } from "@/components/forms/form-select"
import { FormTextarea } from "@/components/forms/form-textarea"
import { useActionForm } from "@/components/forms/use-action-form"
import { FieldGroup } from "@/components/ui/field"
import { PhotoInput, uploadEvidence } from "@/features/fieldlogs/components/evidence"
import { ProjectPlotFields } from "@/features/projects/components/project-plot-fields"
import type { OpenProject } from "@/features/projects/queries"
import { formatNumber, todayISO } from "@/lib/format"
import { newId } from "@/lib/ids"
import { NONE } from "@/lib/validation"
import { saveHarvest } from "../actions"
import {
  CLASSIFICATION_SUGGESTIONS,
  HARVEST_QUALITIES,
  harvestSchema,
  needsUnitWeight,
  PRODUCE_UNITS,
  QUALITY_LABELS,
  toKg,
  UNIT_LABELS,
  type HarvestInput,
  type ProduceUnit,
} from "../schemas"

const toNumber = (v: string | undefined) => Number((v ?? "").replace(/,/g, "")) || 0

/**
 * Registro o corrección de un corte. Cada corte por calidad genera un lote con
 * folio propio; dos calidades del mismo corte comparten el número de corte.
 */
export function HarvestDialog({
  organizationId,
  projects,
  employees,
  trigger,
  record,
  locked = false,
}: {
  organizationId: string
  projects: OpenProject[]
  employees: SelectOption[]
  trigger: React.ReactNode
  /** Valores del corte a corregir. */
  record?: HarvestInput & { lotCode: string }
  /** El lote ya tiene ventas o ajustes: no cambia su origen. */
  locked?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const datalistId = useId()
  const empty = (): HarvestInput => ({
    id: newId(),
    projectId: projects.length === 1 ? projects[0].id : "",
    plotId: "",
    date: todayISO(),
    cutNumber: "",
    quality: "primera",
    classification: "",
    unit: "kg",
    quantity: "",
    unitWeightKg: "",
    packages: "",
    responsibleId: NONE,
    notes: "",
  })
  const { form, onSubmit, pending } = useActionForm<HarvestInput>({
    schema: harvestSchema,
    defaultValues: record ?? empty(),
    action: (values) => saveHarvest(values, Boolean(record)),
    onSuccess: () => {
      const pendingFiles = files
      setFiles([])
      void uploadEvidence(organizationId, "harvest", form.getValues("id"), pendingFiles)
      setOpen(false)
    },
  })
  const [projectId, unit, quantity, unitWeight] = useWatch({
    control: form.control,
    name: ["projectId", "unit", "quantity", "unitWeightKg"],
  })
  const project = projects.find((p) => p.id === projectId)
  const kg = toKg(toNumber(quantity), unit as ProduceUnit, toNumber(unitWeight))
  const showWeight = needsUnitWeight(unit)

  return (
    <FormDialog
      trigger={trigger}
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (value) {
          form.reset(record ?? empty())
          setFiles([])
        }
      }}
      title={record ? `Corregir corte · ${record.lotCode}` : "Registrar corte"}
      description={
        record
          ? locked
            ? "El lote ya tiene ventas o ajustes: solo se corrigen cantidad, clasificación, responsable y notas. La cantidad no puede quedar por debajo de lo vendido."
            : "El proyecto no cambia; si fue incorrecto, elimina el corte y regístralo de nuevo."
          : "Solo proyectos en cosecha o comercialización. Cada calidad se registra como un lote; usa el mismo número de corte."
      }
      onSubmit={onSubmit}
      pending={pending}
      submitLabel={record ? "Guardar cambios" : "Registrar corte"}
      after={
        kg > 0 && (
          <FormNote>
            Cantidad del lote: <span className="font-semibold">{formatNumber(kg, "kg")}</span>
            {unit !== "kg" && " (base de existencias, costo por kg y ventas)"}
          </FormNote>
        )
      }
    >
      <FieldGroup className="grid gap-5 sm:grid-cols-2">
        {record ? (
          <p className="text-sm text-muted-foreground sm:col-span-2">
            {project ? `${project.code} · ${project.name}` : "Proyecto"} ·{" "}
            {project && [project.crop.name, project.crop.variety].filter(Boolean).join(" ")}
          </p>
        ) : (
          <ProjectPlotFields
            control={form.control}
            setValue={form.setValue}
            projects={projects}
            projectName="projectId"
            plotName="plotId"
            plotRequired
          />
        )}
        {record && !locked && (
          <FormSelect
            control={form.control}
            name="plotId"
            label="Parcela"
            options={(project?.plots ?? []).map((p) => ({ value: p.id, label: `${p.farm} · ${p.name}` }))}
          />
        )}
        {!record && (
          <div className="grid gap-1.5 text-sm sm:col-span-2">
            <span className="text-muted-foreground">Cultivo</span>
            <span className="font-medium">
              {project ? [project.crop.name, project.crop.variety].filter(Boolean).join(" · ") : "Se toma del proyecto"}
            </span>
          </div>
        )}
        <FormInput
          control={form.control}
          name="date"
          label="Fecha de corte"
          type="date"
          max={todayISO()}
          disabled={locked}
        />
        <FormInput
          control={form.control}
          name="cutNumber"
          label="Número de corte"
          inputMode="numeric"
          placeholder="Automático"
          description="Vacío: el del mismo día o el siguiente."
        />
        <FormSelect
          control={form.control}
          name="quality"
          label="Calidad"
          disabled={locked}
          options={HARVEST_QUALITIES.map((q) => ({ value: q, label: QUALITY_LABELS[q] }))}
        />
        <FormInput
          control={form.control}
          name="classification"
          label="Clasificación (opcional)"
          placeholder="Ej. Exportación"
          list={datalistId}
        />
        <datalist id={datalistId}>
          {CLASSIFICATION_SUGGESTIONS.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <FormSelect
          control={form.control}
          name="unit"
          label="Unidad de medida"
          options={PRODUCE_UNITS.map((u) => ({ value: u, label: UNIT_LABELS[u] }))}
        />
        <FormInput control={form.control} name="quantity" label="Cantidad cosechada" inputMode="decimal" />
        {showWeight && (
          <FormInput
            control={form.control}
            name="unitWeightKg"
            label="Peso neto por unidad (kg)"
            inputMode="decimal"
            placeholder="Ej. 20"
          />
        )}
        <FormInput control={form.control} name="packages" label="Empaques (opcional)" inputMode="numeric" />
        <FormSelect
          control={form.control}
          name="responsibleId"
          label="Responsable"
          options={[{ value: NONE, label: "Sin responsable" }, ...employees]}
        />
        <FormTextarea control={form.control} name="notes" label="Observaciones" rows={2} className="sm:col-span-2" />
        {!record && <PhotoInput files={files} onChange={setFiles} />}
      </FieldGroup>
    </FormDialog>
  )
}
