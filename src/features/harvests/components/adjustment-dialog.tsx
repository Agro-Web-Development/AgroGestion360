"use client"

import { useState } from "react"
import { useWatch } from "react-hook-form"

import { FormDialog, FormNote } from "@/components/forms/form-dialog"
import { FormInput } from "@/components/forms/form-input"
import { FormSelect } from "@/components/forms/form-select"
import { FormTextarea } from "@/components/forms/form-textarea"
import { useActionForm } from "@/components/forms/use-action-form"
import { FieldGroup } from "@/components/ui/field"
import { formatNumber, todayISO } from "@/lib/format"
import { newId } from "@/lib/ids"
import { registerAdjustment } from "../actions"
import { ADJUSTMENT_HINTS, ADJUSTMENT_TYPES, adjustmentSchema, MOVEMENT_LABELS, type AdjustmentInput } from "../schemas"

/** Merma, pérdida o ajuste por conteo de un lote, siempre con justificación. */
export function AdjustmentDialog({
  lot,
  trigger,
}: {
  lot: { id: string; lotCode: string; availableKg: number; harvestDate: string }
  trigger: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const empty = (): AdjustmentInput => ({
    id: newId(),
    harvestId: lot.id,
    type: "merma",
    quantityKg: "",
    date: todayISO(),
    reason: "",
  })
  const { form, onSubmit, pending } = useActionForm<AdjustmentInput>({
    schema: adjustmentSchema,
    defaultValues: empty(),
    action: registerAdjustment,
    onSuccess: () => setOpen(false),
  })
  const [type, quantity] = useWatch({ control: form.control, name: ["type", "quantityKg"] })
  const kg = Number((quantity ?? "").replace(/,/g, "")) || 0
  const after = type === "ajuste_entrada" ? lot.availableKg + kg : lot.availableKg - kg

  return (
    <FormDialog
      trigger={trigger}
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (value) form.reset(empty())
      }}
      title={`Merma o ajuste · ${lot.lotCode}`}
      description={`Disponible: ${formatNumber(lot.availableKg, "kg")}. El movimiento queda en el historial del lote; si fue un error, se revierte con su contrapartida.`}
      onSubmit={onSubmit}
      pending={pending}
      submitLabel="Registrar"
      wide={false}
      after={
        kg > 0 && (
          <FormNote tone={after < 0 ? "warning" : "muted"}>
            {after < 0
              ? `Excede lo disponible por ${formatNumber(-after, "kg")}.`
              : `Disponible después del movimiento: ${formatNumber(after, "kg")}.`}
          </FormNote>
        )
      }
    >
      <FieldGroup className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FormSelect
            control={form.control}
            name="type"
            label="Tipo"
            options={ADJUSTMENT_TYPES.map((t) => ({ value: t, label: MOVEMENT_LABELS[t] }))}
            description={ADJUSTMENT_HINTS[type as (typeof ADJUSTMENT_TYPES)[number]]}
          />
        </div>
        <FormInput control={form.control} name="quantityKg" label="Cantidad (kg)" inputMode="decimal" />
        <FormInput control={form.control} name="date" label="Fecha" type="date" min={lot.harvestDate} max={todayISO()} />
        <FormTextarea control={form.control} name="reason" label="Justificación" rows={2} className="sm:col-span-2" />
      </FieldGroup>
    </FormDialog>
  )
}
