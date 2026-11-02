"use client"

import { Plus } from "lucide-react"
import { useState } from "react"

import { FormInput } from "@/components/forms/form-input"
import { FormSelect } from "@/components/forms/form-select"
import { FormTextarea } from "@/components/forms/form-textarea"
import { SubmitButton } from "@/components/forms/submit-button"
import { useActionForm } from "@/components/forms/use-action-form"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { FieldGroup } from "@/components/ui/field"
import { ProjectPlotFields } from "@/features/projects/components/project-plot-fields"
import type { OpenProject } from "@/features/projects/queries"
import { todayISO } from "@/lib/format"
import { newId } from "@/lib/ids"
import { registerHarvest } from "../actions"
import { HARVEST_QUALITIES, harvestSchema, QUALITY_LABELS, type HarvestInput } from "../schemas"

function emptyHarvest(): HarvestInput {
  return {
    id: newId(),
    projectId: "",
    plotId: "",
    date: todayISO(),
    quality: "primera",
    quantityKg: "",
    packages: "",
    notes: "",
  }
}

export function HarvestDialog({ projects }: { projects: OpenProject[] }) {
  const [open, setOpen] = useState(false)
  const { form, onSubmit, pending } = useActionForm<HarvestInput>({
    schema: harvestSchema,
    defaultValues: emptyHarvest(),
    action: registerHarvest,
    onSuccess: () => setOpen(false),
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (value) form.reset(emptyHarvest())
      }}
    >
      <DialogTrigger asChild>
        <Button
          disabled={projects.length === 0}
          title={projects.length === 0 ? "No hay proyectos en cosecha o comercialización" : undefined}
        >
          <Plus aria-hidden /> Registrar corte
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <form onSubmit={onSubmit} noValidate className="grid gap-6">
          <DialogHeader>
            <DialogTitle>Corte de cosecha</DialogTitle>
            <DialogDescription>
              Solo proyectos en cosecha o comercialización. La producción en kg es la base del costo por kilogramo y de lo
              disponible para venta.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="grid gap-5 sm:grid-cols-2">
            <ProjectPlotFields
              control={form.control}
              setValue={form.setValue}
              projects={projects}
              projectName="projectId"
              plotName="plotId"
              plotRequired
            />
            <FormInput control={form.control} name="date" label="Fecha" type="date" max={todayISO()} />
            <FormSelect
              control={form.control}
              name="quality"
              label="Calidad"
              options={HARVEST_QUALITIES.map((q) => ({ value: q, label: QUALITY_LABELS[q] }))}
            />
            <FormInput control={form.control} name="quantityKg" label="Peso neto (kg)" inputMode="decimal" />
            <FormInput
              control={form.control}
              name="packages"
              label="Cajas / sacos (opcional)"
              inputMode="numeric"
            />
            <FormTextarea control={form.control} name="notes" label="Notas" rows={2} className="sm:col-span-2" />
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <SubmitButton pending={pending}>Registrar</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
