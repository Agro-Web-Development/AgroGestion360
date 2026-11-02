"use client"

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
import { saveCrop } from "../actions"
import { cropSchema, YIELD_UNIT_LABELS, YIELD_UNITS, type CropInput } from "../schemas"

const EMPTY: CropInput = { name: "", variety: "", scientificName: "", cycleDays: "", yieldUnit: "ton", notes: "" }

export function CropFormDialog({ trigger, crop }: { trigger: React.ReactNode; crop?: CropInput }) {
  const [open, setOpen] = useState(false)
  const defaults = crop ?? EMPTY
  const { form, onSubmit, pending } = useActionForm<CropInput>({
    schema: cropSchema,
    defaultValues: defaults,
    action: saveCrop,
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
            <DialogTitle>{crop ? "Editar cultivo" : "Nuevo cultivo"}</DialogTitle>
            <DialogDescription>
              Registra cada variedad por separado para comparar su rendimiento entre proyectos.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="grid gap-5 sm:grid-cols-2">
            <FormInput control={form.control} name="name" label="Cultivo" placeholder="Ej. Maíz" />
            <FormInput control={form.control} name="variety" label="Variedad" placeholder="Ej. Blanco H-377" />
            <FormInput
              control={form.control}
              name="scientificName"
              label="Nombre científico"
              placeholder="Ej. Zea mays"
              className="sm:col-span-2"
            />
            <FormInput
              control={form.control}
              name="cycleDays"
              label="Ciclo (días)"
              inputMode="numeric"
              description="De siembra a cosecha, aproximado."
            />
            <FormSelect
              control={form.control}
              name="yieldUnit"
              label="Unidad de producción"
              options={YIELD_UNITS.map((u) => ({ value: u, label: YIELD_UNIT_LABELS[u] }))}
            />
            <FormTextarea control={form.control} name="notes" label="Notas" className="sm:col-span-2" />
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <SubmitButton pending={pending}>{crop ? "Guardar cambios" : "Registrar cultivo"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
