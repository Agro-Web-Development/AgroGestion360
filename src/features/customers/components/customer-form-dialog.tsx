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
import { saveCustomer } from "../actions"
import { CUSTOMER_TYPE_LABELS, CUSTOMER_TYPES, customerSchema, type CustomerInput } from "../schemas"

const EMPTY: CustomerInput = {
  name: "",
  customerType: "mayorista",
  rfc: "",
  contactName: "",
  phone: "",
  email: "",
  address: "",
  creditDays: "0",
  notes: "",
}

export function CustomerFormDialog({ trigger, customer }: { trigger: React.ReactNode; customer?: CustomerInput }) {
  const [open, setOpen] = useState(false)
  const defaults = customer ?? EMPTY
  const { form, onSubmit, pending } = useActionForm<CustomerInput>({
    schema: customerSchema,
    defaultValues: defaults,
    action: saveCustomer,
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
            <DialogTitle>{customer ? "Editar cliente" : "Nuevo cliente"}</DialogTitle>
            <DialogDescription>Los días de crédito definen el vencimiento por omisión de cada venta.</DialogDescription>
          </DialogHeader>
          <FieldGroup className="grid gap-5 sm:grid-cols-2">
            <FormInput control={form.control} name="name" label="Nombre o razón social" className="sm:col-span-2" />
            <FormSelect
              control={form.control}
              name="customerType"
              label="Tipo de cliente"
              options={CUSTOMER_TYPES.map((t) => ({ value: t, label: CUSTOMER_TYPE_LABELS[t] }))}
            />
            <FormInput control={form.control} name="rfc" label="RFC (cuando corresponda)" />
            <FormInput control={form.control} name="creditDays" label="Días de crédito" inputMode="numeric" />
            <FormInput control={form.control} name="contactName" label="Contacto" />
            <FormInput control={form.control} name="phone" label="Teléfono" type="tel" />
            <FormInput control={form.control} name="email" label="Correo" type="email" className="sm:col-span-2" />
            <FormInput control={form.control} name="address" label="Dirección" className="sm:col-span-2" />
            <FormTextarea control={form.control} name="notes" label="Observaciones" className="sm:col-span-2" />
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <SubmitButton pending={pending}>{customer ? "Guardar cambios" : "Registrar cliente"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
