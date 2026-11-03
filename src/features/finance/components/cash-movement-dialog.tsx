"use client"

import { ArrowLeftRight, HandCoins } from "lucide-react"
import { useState } from "react"
import { useWatch } from "react-hook-form"

import { FormDialog, FormNote } from "@/components/forms/form-dialog"
import { FormInput } from "@/components/forms/form-input"
import { FormSelect } from "@/components/forms/form-select"
import { FormTextarea } from "@/components/forms/form-textarea"
import { useActionForm } from "@/components/forms/use-action-form"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from "@/features/sales/schemas"
import { formatMoney, todayISO } from "@/lib/format"
import { newId } from "@/lib/ids"
import { fromCents, toCents } from "@/lib/money"
import { NONE } from "@/lib/validation"
import { registerCashMovement } from "../actions"
import { CASH_KIND_LABELS, cashMovementSchema, MANUAL_CASH_KINDS, type CashMovementInput, type PaymentMethod } from "../schemas"

type Option = { id: string; label: string }

/** Pago total o parcial de un gasto registrado: nunca excede su saldo. */
export function ExpensePaymentDialog({
  expense,
  size = "sm",
}: {
  expense: { id: string; description: string; pendingAmount: number; paymentMethod: PaymentMethod | null }
  size?: "sm" | "default"
}) {
  const [open, setOpen] = useState(false)
  const empty = (): CashMovementInput => ({
    id: newId(),
    kind: "pago_gasto",
    expenseId: expense.id,
    supplierId: NONE,
    projectId: NONE,
    date: todayISO(),
    amount: "",
    method: expense.paymentMethod ?? "transferencia",
    concept: "",
    reference: "",
    notes: "",
  })
  const { form, onSubmit, pending } = useActionForm<CashMovementInput>({
    schema: cashMovementSchema,
    defaultValues: empty(),
    action: registerCashMovement,
    onSuccess: () => setOpen(false),
  })
  const amountText = useWatch({ control: form.control, name: "amount" })
  const remaining = amountText ? fromCents(toCents(expense.pendingAmount) - toCents(amountText)) : null

  return (
    <FormDialog
      trigger={
        <Button size={size} variant="outline">
          <HandCoins aria-hidden /> Pagar
        </Button>
      }
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (value) form.reset(empty())
      }}
      title={`Pago de "${expense.description}"`}
      description={`Saldo por pagar: ${formatMoney(expense.pendingAmount)}. El pago se reparte entre los proyectos del gasto.`}
      onSubmit={onSubmit}
      pending={pending}
      submitLabel="Registrar pago"
      wide={false}
      after={
        remaining !== null && (
          <FormNote tone={remaining < 0 ? "warning" : "muted"}>
            {remaining < 0
              ? `Excede el saldo por ${formatMoney(-remaining)}.`
              : remaining === 0
                ? "Con este pago el gasto queda liquidado."
                : `Saldo después del pago: ${formatMoney(remaining)}.`}
          </FormNote>
        )
      }
    >
      <FieldGroup className="grid gap-5">
        <div className="flex items-end gap-2">
          <FormInput control={form.control} name="amount" label="Importe (MXN)" inputMode="decimal" className="flex-1" />
          <Button
            type="button"
            variant="outline"
            className="mb-px"
            onClick={() => form.setValue("amount", expense.pendingAmount.toFixed(2), { shouldValidate: true })}
          >
            Liquidar
          </Button>
        </div>
        <FormInput control={form.control} name="date" label="Fecha del pago" type="date" max={todayISO()} />
        <FormSelect
          control={form.control}
          name="method"
          label="Método de pago"
          options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))}
        />
        <FormInput control={form.control} name="reference" label="Referencia" placeholder="Ej. clave de rastreo" />
      </FieldGroup>
    </FormDialog>
  )
}

/** Pago a proveedor u otro ingreso/egreso capturado desde Flujo de efectivo. */
export function CashMovementDialog({ suppliers, projects }: { suppliers: Option[]; projects: Option[] }) {
  const [open, setOpen] = useState(false)
  const empty = (): CashMovementInput => ({
    id: newId(),
    kind: "pago_proveedor",
    expenseId: NONE,
    supplierId: NONE,
    projectId: NONE,
    date: todayISO(),
    amount: "",
    method: "transferencia",
    concept: "",
    reference: "",
    notes: "",
  })
  const { form, onSubmit, pending } = useActionForm<CashMovementInput>({
    schema: cashMovementSchema,
    defaultValues: empty(),
    action: registerCashMovement,
    onSuccess: () => setOpen(false),
  })
  const kind = useWatch({ control: form.control, name: "kind" })

  return (
    <FormDialog
      trigger={
        <Button>
          <ArrowLeftRight aria-hidden /> Registrar movimiento
        </Button>
      }
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (value) form.reset(empty())
      }}
      title="Movimiento de efectivo"
      description="Dinero efectivamente pagado o recibido. Los pagos de gastos se registran desde Gastos y los cobros de ventas desde Ventas."
      onSubmit={onSubmit}
      pending={pending}
      submitLabel="Registrar"
      after={
        kind === "pago_proveedor" && (
          <FormNote>
            Un pago a proveedor (p. ej. una compra de almacén) es salida de dinero pero no costo de proyecto: el insumo se
            vuelve costo al consumirse.
          </FormNote>
        )
      }
    >
      <FieldGroup className="grid gap-5 sm:grid-cols-2">
        <FormSelect
          control={form.control}
          name="kind"
          label="Tipo"
          options={MANUAL_CASH_KINDS.map((k) => ({ value: k, label: CASH_KIND_LABELS[k] }))}
        />
        <FormInput control={form.control} name="date" label="Fecha" type="date" max={todayISO()} />
        <FormInput
          control={form.control}
          name="concept"
          label="Concepto"
          placeholder={kind === "otro_ingreso" ? "Ej. Apoyo a la productividad" : "Ej. Pago factura F-1203"}
          className="sm:col-span-2"
        />
        <FormInput control={form.control} name="amount" label="Importe (MXN)" inputMode="decimal" />
        <FormSelect
          control={form.control}
          name="method"
          label="Método de pago"
          options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))}
        />
        <FormSelect
          control={form.control}
          name="supplierId"
          label={kind === "pago_proveedor" ? "Proveedor" : "Proveedor (opcional)"}
          options={[
            ...(kind === "pago_proveedor" ? [] : [{ value: NONE, label: "Sin proveedor" }]),
            ...suppliers.map((s) => ({ value: s.id, label: s.label })),
          ]}
        />
        <FormSelect
          control={form.control}
          name="projectId"
          label="Proyecto (opcional)"
          options={[{ value: NONE, label: "General (sin proyecto)" }, ...projects.map((p) => ({ value: p.id, label: p.label }))]}
        />
        <FormInput control={form.control} name="reference" label="Referencia" className="sm:col-span-2" />
        <FormTextarea control={form.control} name="notes" label="Observaciones" rows={2} className="sm:col-span-2" />
      </FieldGroup>
    </FormDialog>
  )
}
