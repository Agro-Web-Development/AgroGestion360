"use client"

import { ArrowDownToLine } from "lucide-react"
import { useState } from "react"

import { FormDialog, FormNote } from "@/components/forms/form-dialog"
import { FormInput } from "@/components/forms/form-input"
import { useActionForm } from "@/components/forms/use-action-form"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { formatDate, formatMoney, todayISO } from "@/lib/format"
import { newId } from "@/lib/ids"
import { applyAdvance } from "../actions"
import { applyAdvanceSchema, type ApplyAdvanceInput } from "../schemas"

/** Mecanismo explícito para que un anticipo cuente como pagado. */
export function ApplyAdvanceDialog({
  paymentId,
  paymentDate,
  pending,
  balance,
}: {
  paymentId: string
  paymentDate: string
  /** Importe del anticipo aún sin aplicar. */
  pending: number
  /** Saldo pendiente de la venta. */
  balance: number
}) {
  const [open, setOpen] = useState(false)
  const suggested = Math.min(pending, balance)
  const empty = (): ApplyAdvanceInput => ({
    id: newId(),
    paymentId,
    amount: suggested.toFixed(2),
    date: todayISO(),
  })
  const { form, onSubmit, pending: saving } = useActionForm<ApplyAdvanceInput>({
    schema: applyAdvanceSchema,
    defaultValues: empty(),
    action: applyAdvance,
    onSuccess: () => setOpen(false),
  })

  return (
    <FormDialog
      trigger={
        <Button size="sm" variant="outline">
          <ArrowDownToLine aria-hidden /> Aplicar
        </Button>
      }
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (value) form.reset(empty())
      }}
      title="Aplicar anticipo"
      description={`Anticipo recibido el ${formatDate(paymentDate)}. Pendiente de aplicar: ${formatMoney(pending)}. Saldo de la venta: ${formatMoney(balance)}.`}
      onSubmit={onSubmit}
      pending={saving}
      submitLabel="Aplicar al saldo"
      wide={false}
      after={<FormNote>La aplicación se puede revertir con motivo; el anticipo vuelve a quedar pendiente.</FormNote>}
    >
      <FieldGroup className="grid gap-5 sm:grid-cols-2">
        <FormInput control={form.control} name="amount" label="Importe a aplicar" inputMode="decimal" />
        <FormInput control={form.control} name="date" label="Fecha" type="date" min={paymentDate} max={todayISO()} />
      </FieldGroup>
    </FormDialog>
  )
}
