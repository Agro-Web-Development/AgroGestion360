"use client"

import { HandCoins } from "lucide-react"
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
import { formatMoney, todayISO } from "@/lib/format"
import { newId } from "@/lib/ids"
import { registerPayment } from "../actions"
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS, paymentSchema, type PaymentInput } from "../schemas"

export function PaymentDialog({
  saleId,
  saleCode,
  saleDate,
  balance,
  size,
}: {
  saleId: string
  saleCode: string
  saleDate: string
  balance: number
  size?: "sm" | "default"
}) {
  const [open, setOpen] = useState(false)
  const empty = (): PaymentInput => ({
    id: newId(),
    saleId,
    date: todayISO(),
    amount: "",
    method: "transferencia",
    reference: "",
    notes: "",
  })
  const { form, onSubmit, pending } = useActionForm<PaymentInput>({
    schema: paymentSchema,
    defaultValues: empty(),
    action: registerPayment,
    onSuccess: () => setOpen(false),
  })
  const amount = Number(form.watch("amount").replace(/,/g, ""))
  const remaining = Number.isFinite(amount) && amount > 0 ? Math.round((balance - amount) * 100) / 100 : null

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (value) form.reset(empty())
      }}
    >
      <DialogTrigger asChild>
        <Button size={size}>
          <HandCoins aria-hidden /> Registrar pago
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} noValidate className="grid gap-6">
          <DialogHeader>
            <DialogTitle>Pago de {saleCode}</DialogTitle>
            <DialogDescription>Saldo pendiente: {formatMoney(balance)}. El pago no puede exceder el saldo.</DialogDescription>
          </DialogHeader>
          <FieldGroup className="grid gap-5 sm:grid-cols-2">
            <div className="flex items-end gap-2 sm:col-span-2">
              <FormInput control={form.control} name="amount" label="Importe (MXN)" inputMode="decimal" className="flex-1" />
              <Button
                type="button"
                variant="outline"
                className="mb-px"
                onClick={() => form.setValue("amount", balance.toFixed(2), { shouldDirty: true, shouldValidate: true })}
              >
                Liquidar
              </Button>
            </div>
            <FormInput control={form.control} name="date" label="Fecha" type="date" min={saleDate} max={todayISO()} />
            <FormSelect
              control={form.control}
              name="method"
              label="Forma de pago"
              options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))}
            />
            <FormInput control={form.control} name="reference" label="Referencia" placeholder="Ej. clave de rastreo" className="sm:col-span-2" />
            <FormTextarea control={form.control} name="notes" label="Notas" rows={2} className="sm:col-span-2" />
          </FieldGroup>
          {remaining !== null && (
            <p className={`rounded-md px-3 py-2 text-sm ${remaining < 0 ? "bg-destructive/10 text-destructive" : "bg-muted"}`}>
              {remaining < 0
                ? `Excede el saldo por ${formatMoney(-remaining)}.`
                : remaining === 0
                  ? "Con este pago la venta queda liquidada."
                  : `Saldo después del pago: ${formatMoney(remaining)}.`}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <SubmitButton pending={pending} disabled={remaining !== null && remaining < 0}>
              Registrar pago
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
