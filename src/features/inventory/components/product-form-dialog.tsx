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
import { saveProduct } from "../actions"
import {
  INPUT_CATEGORIES,
  INPUT_CATEGORY_LABELS,
  INVENTORY_UNIT_LABELS,
  INVENTORY_UNITS,
  productSchema,
  type ProductInput,
} from "../schemas"

const EMPTY: ProductInput = { name: "", sku: "", category: "fertilizante", unit: "kg", minStock: "", notes: "" }

export function ProductFormDialog({
  trigger,
  product,
  unitLocked = false,
}: {
  trigger: React.ReactNode
  product?: ProductInput
  /** Con movimientos registrados la unidad ya no puede cambiar. */
  unitLocked?: boolean
}) {
  const [open, setOpen] = useState(false)
  const defaults = product ?? EMPTY
  const { form, onSubmit, pending } = useActionForm<ProductInput>({
    schema: productSchema,
    defaultValues: defaults,
    action: saveProduct,
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
            <DialogTitle>{product ? "Editar producto" : "Nuevo producto"}</DialogTitle>
            <DialogDescription>
              La existencia y el costo promedio se calculan con los movimientos; no se capturan aquí.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="grid gap-5 sm:grid-cols-2">
            <FormInput
              control={form.control}
              name="name"
              label="Nombre"
              placeholder="Ej. Urea 46%"
              className="sm:col-span-2"
            />
            <FormInput control={form.control} name="sku" label="Clave (opcional)" placeholder="Ej. FER-001" />
            <FormSelect
              control={form.control}
              name="category"
              label="Categoría"
              options={INPUT_CATEGORIES.map((c) => ({ value: c, label: INPUT_CATEGORY_LABELS[c] }))}
            />
            <FormSelect
              control={form.control}
              name="unit"
              label="Unidad de medida"
              disabled={unitLocked}
              description={unitLocked ? "No se cambia porque ya tiene movimientos." : undefined}
              options={INVENTORY_UNITS.map((u) => ({ value: u, label: INVENTORY_UNIT_LABELS[u] }))}
            />
            <FormInput
              control={form.control}
              name="minStock"
              label="Existencia mínima"
              inputMode="decimal"
              description="Se marca como bajo mínimo al llegar a este nivel."
            />
            <FormTextarea control={form.control} name="notes" label="Notas" className="sm:col-span-2" />
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <SubmitButton pending={pending}>{product ? "Guardar cambios" : "Registrar producto"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
