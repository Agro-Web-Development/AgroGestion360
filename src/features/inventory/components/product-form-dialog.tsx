"use client"

import { useState } from "react"

import { FormCheckbox } from "@/components/forms/form-checkbox"
import { FormDialog } from "@/components/forms/form-dialog"
import { FormInput } from "@/components/forms/form-input"
import { FormSelect } from "@/components/forms/form-select"
import { FormTextarea } from "@/components/forms/form-textarea"
import { useActionForm } from "@/components/forms/use-action-form"
import { FieldGroup } from "@/components/ui/field"
import { saveProduct } from "../actions"
import type { Category } from "../queries"
import { INVENTORY_UNIT_LABELS, INVENTORY_UNITS, productSchema, type ProductInput } from "../schemas"

const EMPTY: ProductInput = { name: "", sku: "", categoryId: "", unit: "kg", minStock: "", trackLots: false, notes: "" }

export function ProductFormDialog({
  trigger,
  categories,
  product,
  unitLocked = false,
  lotsLocked = false,
}: {
  trigger: React.ReactNode
  categories: Category[]
  product?: ProductInput
  /** Con movimientos registrados la unidad ya no puede cambiar. */
  unitLocked?: boolean
  /** Con existencia, el control por lotes no puede cambiar. */
  lotsLocked?: boolean
}) {
  const [open, setOpen] = useState(false)
  const defaults = product ?? EMPTY
  const { form, onSubmit, pending } = useActionForm<ProductInput>({
    schema: productSchema,
    defaultValues: defaults,
    action: saveProduct,
    onSuccess: () => setOpen(false),
  })
  const options = categories
    .filter((c) => c.is_active || c.id === product?.categoryId)
    .map((c) => ({ value: c.id, label: c.name }))

  return (
    <FormDialog
      trigger={trigger}
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (value) form.reset(defaults)
      }}
      title={product ? "Editar producto" : "Nuevo producto"}
      description="La existencia y el costo promedio se calculan con los movimientos; no se capturan aquí."
      onSubmit={onSubmit}
      pending={pending}
      submitLabel={product ? "Guardar cambios" : "Registrar producto"}
    >
      <FieldGroup className="grid gap-5 sm:grid-cols-2">
        <FormInput control={form.control} name="name" label="Nombre" placeholder="Ej. Urea 46%" className="sm:col-span-2" />
        <FormInput control={form.control} name="sku" label="Clave (opcional)" placeholder="Ej. FER-001" />
        <FormSelect control={form.control} name="categoryId" label="Categoría" options={options} />
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
        <FormCheckbox
          control={form.control}
          name="trackLots"
          label="Controlar por lote y caducidad"
          disabled={lotsLocked}
          description={
            lotsLocked
              ? "Solo cambia con existencia en cero."
              : "Cada entrada registra el lote del fabricante y cada salida indica de qué lote sale."
          }
          className="sm:col-span-2"
        />
        <FormTextarea control={form.control} name="notes" label="Notas" className="sm:col-span-2" />
      </FieldGroup>
    </FormDialog>
  )
}
