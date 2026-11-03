"use client"

import { Truck } from "lucide-react"
import { useState } from "react"

import { FormDialog } from "@/components/forms/form-dialog"
import { FormInput } from "@/components/forms/form-input"
import { FormTextarea } from "@/components/forms/form-textarea"
import { useActionForm } from "@/components/forms/use-action-form"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { UNIT_SHORT, type ProduceUnit } from "@/features/harvests/schemas"
import { formatNumber, todayISO } from "@/lib/format"
import { newId } from "@/lib/ids"
import { registerDelivery } from "../actions"
import { deliverySchema, type DeliveryInput } from "../schemas"

type PendingItem = { id: string; description: string; lotCode: string | null; unit: ProduceUnit; pending: number }

/** Entrega total o parcial: por omisión propone todo lo pendiente de cada partida. */
export function DeliveryDialog({ saleId, saleDate, items }: { saleId: string; saleDate: string; items: PendingItem[] }) {
  const [open, setOpen] = useState(false)
  const empty = (): DeliveryInput => ({
    id: newId(),
    saleId,
    date: todayISO(),
    receivedBy: "",
    transport: "",
    notes: "",
    items: items.map((i) => ({ saleItemId: i.id, quantity: String(i.pending) })),
  })
  const { form, onSubmit, pending } = useActionForm<DeliveryInput>({
    schema: deliverySchema,
    defaultValues: empty(),
    action: registerDelivery,
    onSuccess: () => setOpen(false),
  })

  return (
    <FormDialog
      trigger={
        <Button variant="outline">
          <Truck aria-hidden /> Registrar entrega
        </Button>
      }
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (value) form.reset(empty())
      }}
      title="Registrar entrega"
      description="Captura lo entregado en este viaje; deja en cero las partidas que no se entregan."
      onSubmit={onSubmit}
      pending={pending}
      submitLabel="Registrar entrega"
    >
      <FieldGroup className="grid gap-5 sm:grid-cols-2">
        {items.map((item, index) => (
          <FormInput
            key={item.id}
            control={form.control}
            name={`items.${index}.quantity`}
            label={`${item.description}${item.lotCode ? ` · ${item.lotCode}` : ""}`}
            inputMode="decimal"
            description={`Pendiente: ${formatNumber(item.pending, UNIT_SHORT[item.unit])}`}
            className="sm:col-span-2"
          />
        ))}
        {form.formState.errors.items?.root?.message && (
          <p className="text-sm text-destructive sm:col-span-2">{form.formState.errors.items.root.message}</p>
        )}
        <FormInput control={form.control} name="date" label="Fecha de entrega" type="date" min={saleDate} max={todayISO()} />
        <FormInput control={form.control} name="receivedBy" label="Recibió" />
        <FormInput
          control={form.control}
          name="transport"
          label="Transporte"
          placeholder="Vehículo, placas o transportista"
          className="sm:col-span-2"
        />
        <FormTextarea control={form.control} name="notes" label="Observaciones" rows={2} className="sm:col-span-2" />
      </FieldGroup>
    </FormDialog>
  )
}
