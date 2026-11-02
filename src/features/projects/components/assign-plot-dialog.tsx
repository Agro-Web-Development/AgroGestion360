"use client"

import { Plus } from "lucide-react"
import { useState } from "react"

import { FormInput } from "@/components/forms/form-input"
import { FormSelect } from "@/components/forms/form-select"
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
import { formatNumber } from "@/lib/format"
import { assignPlot } from "../actions"
import type { AssignablePlot } from "../queries"
import { projectPlotSchema, type ProjectPlotInput } from "../schemas"

export function AssignPlotDialog({ projectId, plots }: { projectId: string; plots: AssignablePlot[] }) {
  const [open, setOpen] = useState(false)
  const defaults: ProjectPlotInput = { projectId, plotId: "", assignedAreaHa: "" }
  const { form, onSubmit, pending } = useActionForm<ProjectPlotInput>({
    schema: projectPlotSchema,
    defaultValues: defaults,
    action: assignPlot,
    onSuccess: () => setOpen(false),
  })
  const selected = plots.find((p) => p.id === form.watch("plotId"))

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (value) form.reset(defaults)
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" disabled={plots.length === 0} title={plots.length === 0 ? "No hay parcelas con superficie disponible" : undefined}>
          <Plus aria-hidden /> Asignar parcela
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} noValidate className="grid gap-6">
          <DialogHeader>
            <DialogTitle>Asignar parcela</DialogTitle>
            <DialogDescription>
              Solo se muestran parcelas activas con superficie libre (no comprometida en otros proyectos vigentes).
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <FormSelect
              control={form.control}
              name="plotId"
              label="Parcela"
              options={plots.map((p) => ({
                value: p.id,
                label: `${p.farm} · ${p.name} (${formatNumber(p.available, "ha")} libres)`,
              }))}
            />
            <div className="flex items-end gap-2">
              <FormInput
                control={form.control}
                name="assignedAreaHa"
                label="Superficie a asignar (ha)"
                inputMode="decimal"
                placeholder="0.00"
                className="flex-1"
              />
              {selected && (
                <Button
                  type="button"
                  variant="outline"
                  className="mb-px"
                  onClick={() =>
                    form.setValue("assignedAreaHa", String(selected.available), { shouldDirty: true, shouldValidate: true })
                  }
                >
                  Todo ({formatNumber(selected.available)})
                </Button>
              )}
            </div>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <SubmitButton pending={pending}>Asignar</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
