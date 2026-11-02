"use client"

import { useState } from "react"

import { FormInput } from "@/components/forms/form-input"
import { FormSelect, type SelectOption } from "@/components/forms/form-select"
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
import { savePlot } from "../actions"
import { IRRIGATION_LABELS, IRRIGATION_TYPES, plotSchema, type PlotInput } from "../schemas"

export function PlotFormDialog({
  trigger,
  plot,
  farmId,
  farms,
  availableHint,
}: {
  trigger: React.ReactNode
  plot?: PlotInput
  /** Rancho fijo (desde su ficha). */
  farmId?: string
  /** Ranchos activos para elegir cuando no hay rancho fijo. */
  farms?: SelectOption[]
  availableHint?: string
}) {
  const [open, setOpen] = useState(false)
  const defaults: PlotInput = plot ?? {
    farmId: farmId ?? "",
    name: "",
    code: "",
    areaHa: "",
    soilType: "",
    irrigationType: "temporal",
    notes: "",
  }
  const { form, onSubmit, pending } = useActionForm<PlotInput>({
    schema: plotSchema,
    defaultValues: defaults,
    action: savePlot,
    onSuccess: () => setOpen(false),
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (value) form.reset(defaults)
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <form onSubmit={onSubmit} noValidate className="grid gap-6">
          <DialogHeader>
            <DialogTitle>{plot ? "Editar parcela" : "Nueva parcela"}</DialogTitle>
            {availableHint && <DialogDescription>{availableHint}</DialogDescription>}
          </DialogHeader>
          <FieldGroup className="grid gap-5 sm:grid-cols-2">
            {farms && (
              <div className="sm:col-span-2">
                <FormSelect control={form.control} name="farmId" label="Rancho" options={farms} />
              </div>
            )}
            <FormInput control={form.control} name="name" label="Nombre" />
            <FormInput control={form.control} name="code" label="Clave" autoCapitalize="characters" maxLength={20} />
            <FormInput control={form.control} name="areaHa" label="Superficie (ha)" inputMode="decimal" placeholder="0.00" />
            <FormSelect
              control={form.control}
              name="irrigationType"
              label="Sistema de riego"
              options={IRRIGATION_TYPES.map((t) => ({ value: t, label: IRRIGATION_LABELS[t] }))}
            />
            <FormInput
              control={form.control}
              name="soilType"
              label="Tipo de suelo"
              placeholder="Ej. Vertisol, franco arcilloso"
              className="sm:col-span-2"
            />
            <FormTextarea control={form.control} name="notes" label="Notas" className="sm:col-span-2" />
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <SubmitButton pending={pending}>{plot ? "Guardar cambios" : "Registrar parcela"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
