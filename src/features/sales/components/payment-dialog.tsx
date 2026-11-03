"use client"

import { HandCoins } from "lucide-react"
import { useState } from "react"
import { useWatch } from "react-hook-form"

import { FormDialog, FormNote } from "@/components/forms/form-dialog"
import { FormInput } from "@/components/forms/form-input"
import { FormSelect } from "@/components/forms/form-select"
import { FormTextarea } from "@/components/forms/form-textarea"
import { useActionForm } from "@/components/forms/use-action-form"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { PhotoInput, uploadEvidence } from "@/features/fieldlogs/components/evidence"
import { formatMoney, todayISO } from "@/lib/format"
import { newId } from "@/lib/ids"
import { registerPayment } from "../actions"
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS, paymentSchema, type PaymentInput } from "../schemas"

/**
 * Pago (total o parcial) o anticipo de una venta. Lo cobrable es el saldo menos
 * los anticipos sin aplicar; un borrador solo recibe anticipos.
 */
export function PaymentDialog({
  organizationId,
  saleId,
  saleCode,
  saleDate,
  collectible,
  draft = false,
  size,
}: {
  organizationId: string
  saleId: string
  saleCode: string
  saleDate: string
  /** Total − pagado − anticipos sin aplicar. */
  collectible: number
  draft?: boolean
  size?: "sm" | "default"
}) {
  const [open, setOpen] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const empty = (): PaymentInput => ({
    id: newId(),
    saleId,
    kind: draft ? "anticipo" : "pago",
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
    onSuccess: () => {
      const pendingFiles = files
      setFiles([])
      void uploadEvidence(organizationId, "payment", form.getValues("id"), pendingFiles)
      setOpen(false)
    },
  })
  const [kind, amountText] = useWatch({ control: form.control, name: ["kind", "amount"] })
  const amount = Number((amountText ?? "").replace(/,/g, ""))
  const remaining = Number.isFinite(amount) && amount > 0 ? Math.round((collectible - amount) * 100) / 100 : null

  return (
    <FormDialog
      trigger={
        <Button size={size}>
          <HandCoins aria-hidden /> {draft ? "Registrar anticipo" : "Registrar pago"}
        </Button>
      }
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (value) {
          form.reset(empty())
          setFiles([])
        }
      }}
      title={`${kind === "anticipo" ? "Anticipo" : "Pago"} de ${saleCode}`}
      description={
        kind === "anticipo"
          ? "El anticipo no reduce el saldo hasta que se aplica de forma explícita a la venta confirmada."
          : `Por cobrar: ${formatMoney(collectible)}. El pago no puede exceder esa cantidad.`
      }
      onSubmit={onSubmit}
      pending={pending}
      submitLabel={kind === "anticipo" ? "Registrar anticipo" : "Registrar pago"}
      after={
        remaining !== null && (
          <FormNote tone={remaining < 0 ? "warning" : "muted"}>
            {remaining < 0
              ? `Excede lo cobrable por ${formatMoney(-remaining)}.`
              : kind === "anticipo"
                ? `Quedará ${formatMoney(amount)} como anticipo pendiente de aplicar.`
                : remaining === 0
                  ? "Con este pago la venta queda liquidada."
                  : `Saldo después del pago: ${formatMoney(remaining)}.`}
          </FormNote>
        )
      }
    >
      <FieldGroup className="grid gap-5 sm:grid-cols-2">
        <FormSelect
          control={form.control}
          name="kind"
          label="Tipo"
          disabled={draft}
          options={[
            { value: "pago", label: "Pago (parcial o total)" },
            { value: "anticipo", label: "Anticipo" },
          ]}
        />
        <div className="flex items-end gap-2">
          <FormInput control={form.control} name="amount" label="Importe (MXN)" inputMode="decimal" className="flex-1" />
          {kind === "pago" && (
            <Button
              type="button"
              variant="outline"
              className="mb-px"
              onClick={() => form.setValue("amount", collectible.toFixed(2), { shouldDirty: true, shouldValidate: true })}
            >
              Liquidar
            </Button>
          )}
        </div>
        <FormInput
          control={form.control}
          name="date"
          label="Fecha"
          type="date"
          min={kind === "pago" ? saleDate : undefined}
          max={todayISO()}
        />
        <FormSelect
          control={form.control}
          name="method"
          label="Método de pago"
          options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))}
        />
        <FormInput
          control={form.control}
          name="reference"
          label="Referencia bancaria"
          placeholder="Ej. clave de rastreo o número de cheque"
          className="sm:col-span-2"
        />
        <FormTextarea control={form.control} name="notes" label="Observaciones" rows={2} className="sm:col-span-2" />
        <PhotoInput files={files} onChange={setFiles} entity="payment" />
      </FieldGroup>
    </FormDialog>
  )
}
