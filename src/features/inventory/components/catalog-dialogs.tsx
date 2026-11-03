"use client"

import { useState } from "react"

import { FormDialog } from "@/components/forms/form-dialog"
import { FormInput } from "@/components/forms/form-input"
import { FormSelect, type SelectOption } from "@/components/forms/form-select"
import { FormTextarea } from "@/components/forms/form-textarea"
import { useActionForm } from "@/components/forms/use-action-form"
import { FieldGroup } from "@/components/ui/field"
import { NONE } from "@/lib/validation"
import { saveCategory, saveSupplier, saveWarehouse, updateLot } from "../actions"
import {
  categorySchema,
  INPUT_KIND_LABELS,
  INPUT_KINDS,
  lotSchema,
  supplierSchema,
  warehouseSchema,
  type CategoryInput,
  type LotInput,
  type SupplierInput,
  type WarehouseInput,
} from "../schemas"

export function CategoryFormDialog({ trigger, category }: { trigger: React.ReactNode; category?: CategoryInput }) {
  const [open, setOpen] = useState(false)
  const defaults: CategoryInput = category ?? { name: "", kind: "otro", description: "" }
  const { form, onSubmit, pending } = useActionForm<CategoryInput>({
    schema: categorySchema,
    defaultValues: defaults,
    action: saveCategory,
    onSuccess: () => setOpen(false),
  })

  return (
    <FormDialog
      trigger={trigger}
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (value) form.reset(defaults)
      }}
      title={category ? "Editar categoría" : "Nueva categoría"}
      description="La clasificación define qué productos se ofrecen en aplicaciones (agroquímicos, biológicos, fertilizantes) y como combustible de maquinaria."
      onSubmit={onSubmit}
      pending={pending}
      submitLabel={category ? "Guardar cambios" : "Registrar categoría"}
      wide={false}
    >
      <FieldGroup className="grid gap-5">
        <FormInput control={form.control} name="name" label="Nombre" placeholder="Ej. Fertilizantes foliares" />
        <FormSelect
          control={form.control}
          name="kind"
          label="Clasificación"
          options={INPUT_KINDS.map((k) => ({ value: k, label: INPUT_KIND_LABELS[k] }))}
        />
        <FormTextarea control={form.control} name="description" label="Descripción" rows={2} />
      </FieldGroup>
    </FormDialog>
  )
}

export function WarehouseFormDialog({
  trigger,
  warehouse,
  farms,
  employees,
}: {
  trigger: React.ReactNode
  warehouse?: WarehouseInput
  farms: SelectOption[]
  employees: SelectOption[]
}) {
  const [open, setOpen] = useState(false)
  const defaults: WarehouseInput = warehouse ?? {
    name: "",
    code: "",
    farmId: NONE,
    location: "",
    responsibleId: NONE,
    notes: "",
  }
  const { form, onSubmit, pending } = useActionForm<WarehouseInput>({
    schema: warehouseSchema,
    defaultValues: defaults,
    action: saveWarehouse,
    onSuccess: () => setOpen(false),
  })

  return (
    <FormDialog
      trigger={trigger}
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (value) form.reset(defaults)
      }}
      title={warehouse ? "Editar almacén" : "Nuevo almacén"}
      description="Las existencias se controlan por almacén; el costo promedio es el mismo para todo el producto."
      onSubmit={onSubmit}
      pending={pending}
      submitLabel={warehouse ? "Guardar cambios" : "Registrar almacén"}
    >
      <FieldGroup className="grid gap-5 sm:grid-cols-2">
        <FormInput control={form.control} name="name" label="Nombre" placeholder="Ej. Bodega La Esperanza" />
        <FormInput control={form.control} name="code" label="Clave (opcional)" />
        <FormSelect
          control={form.control}
          name="farmId"
          label="Rancho (opcional)"
          options={[{ value: NONE, label: "Sin rancho" }, ...farms]}
        />
        <FormSelect
          control={form.control}
          name="responsibleId"
          label="Responsable (opcional)"
          options={[{ value: NONE, label: "Sin responsable" }, ...employees]}
        />
        <FormInput control={form.control} name="location" label="Ubicación" className="sm:col-span-2" />
        <FormTextarea control={form.control} name="notes" label="Notas" rows={2} className="sm:col-span-2" />
      </FieldGroup>
    </FormDialog>
  )
}

export function SupplierFormDialog({ trigger, supplier }: { trigger: React.ReactNode; supplier?: SupplierInput }) {
  const [open, setOpen] = useState(false)
  const defaults: SupplierInput = supplier ?? {
    name: "",
    rfc: "",
    contactName: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
  }
  const { form, onSubmit, pending } = useActionForm<SupplierInput>({
    schema: supplierSchema,
    defaultValues: defaults,
    action: saveSupplier,
    onSuccess: () => setOpen(false),
  })

  return (
    <FormDialog
      trigger={trigger}
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (value) form.reset(defaults)
      }}
      title={supplier ? "Editar proveedor" : "Nuevo proveedor"}
      onSubmit={onSubmit}
      pending={pending}
      submitLabel={supplier ? "Guardar cambios" : "Registrar proveedor"}
    >
      <FieldGroup className="grid gap-5 sm:grid-cols-2">
        <FormInput control={form.control} name="name" label="Nombre o razón social" className="sm:col-span-2" />
        <FormInput control={form.control} name="rfc" label="RFC (opcional)" autoCapitalize="characters" />
        <FormInput control={form.control} name="contactName" label="Contacto" />
        <FormInput control={form.control} name="phone" label="Teléfono" type="tel" />
        <FormInput control={form.control} name="email" label="Correo" type="email" />
        <FormInput control={form.control} name="address" label="Dirección" className="sm:col-span-2" />
        <FormTextarea control={form.control} name="notes" label="Notas" rows={2} className="sm:col-span-2" />
      </FieldGroup>
    </FormDialog>
  )
}

export function LotFormDialog({ trigger, lot, label }: { trigger: React.ReactNode; lot: LotInput; label: string }) {
  const [open, setOpen] = useState(false)
  const { form, onSubmit, pending } = useActionForm<LotInput>({
    schema: lotSchema,
    defaultValues: lot,
    action: updateLot,
    onSuccess: () => setOpen(false),
  })

  return (
    <FormDialog
      trigger={trigger}
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (value) form.reset(lot)
      }}
      title={`Lote ${label}`}
      description="Corrige la caducidad o agrega notas. El número de lote no cambia."
      onSubmit={onSubmit}
      pending={pending}
      submitLabel="Guardar"
      wide={false}
    >
      <FieldGroup className="grid gap-5">
        <FormInput control={form.control} name="expiryDate" label="Caducidad" type="date" />
        <FormTextarea control={form.control} name="notes" label="Notas" rows={2} />
      </FieldGroup>
    </FormDialog>
  )
}
