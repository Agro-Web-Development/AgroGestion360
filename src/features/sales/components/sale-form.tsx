"use client"

import { CheckCircle2, Plus, Save, Trash2 } from "lucide-react"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useFieldArray, useWatch, type Control, type UseFormSetValue } from "react-hook-form"

import { FormInput } from "@/components/forms/form-input"
import { FormSelect } from "@/components/forms/form-select"
import { FormTextarea } from "@/components/forms/form-textarea"
import { SubmitButton } from "@/components/forms/submit-button"
import { useActionForm } from "@/components/forms/use-action-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FieldGroup } from "@/components/ui/field"
import type { SaleableLot } from "@/features/harvests/queries"
import {
  needsUnitWeight,
  PRODUCE_UNITS,
  QUALITY_LABELS,
  toKg,
  UNIT_LABELS,
  UNIT_SHORT,
  type ProduceUnit,
} from "@/features/harvests/schemas"
import { formatDate, formatMoney, formatNumber, todayISO } from "@/lib/format"
import { newId } from "@/lib/ids"
import { toInput } from "@/lib/validation"
import { saveSale } from "../actions"
import type { CustomerOption } from "../queries"
import { lineGross, saleSchema, saleTotals, type SaleInput, type SaleItemInput } from "../schemas"

const toNumber = (v: string | undefined) => Number((v ?? "").replace(/,/g, "")) || 0

function emptyItem(): SaleItemInput {
  return { harvestId: "", description: "", unit: "kg", quantity: "", unitWeightKg: "", unitPrice: "", discount: "" }
}

const lotLabel = (l: SaleableLot) =>
  `${l.lotCode} · ${l.product} ${QUALITY_LABELS[l.quality].toLowerCase()} · ${formatNumber(l.availableKg, "kg")}`

/** Una partida: lote, unidad de venta, cantidad, precio y descuento. */
function ItemRow({
  index,
  control,
  setValue,
  lots,
  removable,
  onRemove,
}: {
  index: number
  control: Control<SaleInput>
  setValue: UseFormSetValue<SaleInput>
  lots: SaleableLot[]
  removable: boolean
  onRemove: () => void
}) {
  const item = useWatch({ control, name: `items.${index}` })
  const lot = lots.find((l) => l.id === item?.harvestId)
  const previousLot = useRef(item?.harvestId)

  // Al elegir otro lote se proponen su unidad, peso por empaque y producto.
  useEffect(() => {
    if (!lot || previousLot.current === lot.id) return
    previousLot.current = lot.id
    setValue(`items.${index}.unit`, lot.unit)
    setValue(`items.${index}.unitWeightKg`, toInput(lot.unitWeightKg))
    setValue(`items.${index}.description`, `${lot.product}${lot.classification ? ` · ${lot.classification}` : ""}`)
  }, [lot, index, setValue])

  const unit = (item?.unit ?? "kg") as ProduceUnit
  const quantity = toNumber(item?.quantity)
  const kg = toKg(quantity, unit, toNumber(item?.unitWeightKg))
  const gross = lineGross(quantity, toNumber(item?.unitPrice))
  const amount = gross - toNumber(item?.discount)

  return (
    <div className="rounded-lg border p-4">
      <FieldGroup className="grid gap-4 md:grid-cols-6">
        <div className="md:col-span-6">
          <FormSelect
            control={control}
            name={`items.${index}.harvestId`}
            label="Lote de producción"
            placeholder="Selecciona el lote"
            options={lots.map((l) => ({ value: l.id, label: lotLabel(l) }))}
            description={
              lot
                ? `${lot.projectCode} · parcela ${lot.plot} · cosecha ${formatDate(lot.harvestDate)} · ${QUALITY_LABELS[lot.quality]}`
                : undefined
            }
          />
        </div>
        <FormInput
          control={control}
          name={`items.${index}.description`}
          label="Producto"
          placeholder="Se toma del cultivo del lote"
          className="md:col-span-6"
        />
        <div className="md:col-span-2">
          <FormSelect
            control={control}
            name={`items.${index}.unit`}
            label="Unidad"
            options={PRODUCE_UNITS.map((u) => ({ value: u, label: UNIT_LABELS[u] }))}
          />
        </div>
        <FormInput control={control} name={`items.${index}.quantity`} label="Cantidad" inputMode="decimal" className="md:col-span-2" />
        {needsUnitWeight(unit) ? (
          <FormInput
            control={control}
            name={`items.${index}.unitWeightKg`}
            label="Kg por unidad"
            inputMode="decimal"
            className="md:col-span-2"
          />
        ) : (
          <div className="hidden md:col-span-2 md:block" />
        )}
        <FormInput
          control={control}
          name={`items.${index}.unitPrice`}
          label={`Precio por ${UNIT_SHORT[unit] === "kg" ? "kg" : unit === "t" ? "tonelada" : unit}`}
          inputMode="decimal"
          className="md:col-span-2"
        />
        <FormInput
          control={control}
          name={`items.${index}.discount`}
          label="Descuento ($)"
          inputMode="decimal"
          placeholder="0.00"
          className="md:col-span-2"
        />
        <div className="flex items-end justify-between gap-2 md:col-span-2">
          <div>
            <p className="text-sm text-muted-foreground">Importe</p>
            <p className="text-lg font-semibold tabular-nums">{formatMoney(amount)}</p>
            <p className={kg > (lot?.availableKg ?? Infinity) ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
              {formatNumber(kg, "kg")}
              {lot && kg > lot.availableKg && ` · excede ${formatNumber(lot.availableKg, "kg")}`}
            </p>
          </div>
          {removable && (
            <Button type="button" variant="ghost" size="icon" aria-label={`Quitar partida ${index + 1}`} onClick={onRemove}>
              <Trash2 aria-hidden />
            </Button>
          )}
        </div>
      </FieldGroup>
    </div>
  )
}

export function SaleForm({
  customers,
  lots,
  draft,
}: {
  customers: CustomerOption[]
  lots: SaleableLot[]
  /** Borrador a modificar (mismo id: se reemplazan sus partidas). */
  draft?: SaleInput & { code: string }
}) {
  // Qué botón envió el formulario: la referencia se lee al enviar (el estado solo pinta el indicador).
  const confirmRef = useRef(false)
  const [confirm, setConfirm] = useState(false)
  const choose = (value: boolean) => {
    confirmRef.current = value
    setConfirm(value)
  }
  const { form, onSubmit, pending } = useActionForm<SaleInput>({
    schema: saleSchema,
    defaultValues: draft ?? {
      // Generado una vez por formulario: reenviar no duplica la venta.
      id: newId(),
      customerId: "",
      saleDate: todayISO(),
      dueDate: "",
      deliveryDate: "",
      notes: "",
      items: [emptyItem()],
    },
    action: (values) => saveSale(values, confirmRef.current),
  })
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" })
  const items = useWatch({ control: form.control, name: "items" })
  const [customerId, saleDate] = useWatch({ control: form.control, name: ["customerId", "saleDate"] })
  const customer = customers.find((c) => c.id === customerId)

  const lines = items.map((i) => ({
    quantity: toNumber(i.quantity),
    unitPrice: toNumber(i.unitPrice),
    discount: toNumber(i.discount),
    unit: (i.unit || "kg") as ProduceUnit,
    unitWeightKg: toNumber(i.unitWeightKg),
  }))
  const totals = saleTotals(lines)
  const kgByLot = new Map<string, number>()
  items.forEach((i, idx) => {
    const kg = toKg(lines[idx].quantity, lines[idx].unit, lines[idx].unitWeightKg)
    kgByLot.set(i.harvestId, (kgByLot.get(i.harvestId) ?? 0) + kg)
  })
  const overdrawn = lots.filter((l) => (kgByLot.get(l.id) ?? 0) > l.availableKg)
  const defaultDue =
    customer && /^\d{4}-\d{2}-\d{2}$/.test(saleDate)
      ? new Date(Date.parse(`${saleDate}T12:00:00Z`) + customer.credit_days * 86_400_000).toISOString().slice(0, 10)
      : null

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 xl:grid-cols-3">
      <div className="space-y-4 xl:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Productos y lotes</CardTitle>
            <CardDescription>
              Cada partida sale de un lote de producción. Solo se puede confirmar lo disponible en cada lote.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.map((field, index) => (
              <ItemRow
                key={field.id}
                index={index}
                control={form.control}
                setValue={form.setValue}
                lots={lots}
                removable={fields.length > 1}
                onRemove={() => remove(index)}
              />
            ))}
            {form.formState.errors.items?.root?.message && (
              <p className="text-sm text-destructive">{form.formState.errors.items.root.message}</p>
            )}
            <Button type="button" variant="outline" disabled={fields.length >= 50} onClick={() => append(emptyItem())}>
              <Plus aria-hidden /> Agregar producto o lote
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Datos de la venta</CardTitle>
            <CardDescription>
              {draft ? `Borrador ${draft.code}.` : "Se asigna un folio consecutivo al guardar."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <FormSelect
                control={form.control}
                name="customerId"
                label="Cliente"
                placeholder={customers.length ? "Selecciona el cliente" : "No hay clientes activos"}
                options={customers.map((c) => ({
                  value: c.id,
                  label: c.credit_days ? `${c.name} · ${c.credit_days} días` : `${c.name} · contado`,
                }))}
              />
              <FormInput control={form.control} name="saleDate" label="Fecha de venta" type="date" max={todayISO()} />
              <FormInput
                control={form.control}
                name="deliveryDate"
                label="Fecha de entrega (opcional)"
                type="date"
                min={saleDate}
              />
              <FormInput
                control={form.control}
                name="dueDate"
                label="Vencimiento del pago"
                type="date"
                min={saleDate}
                description={defaultDue ? `Vacío = ${formatDate(defaultDue)} (días de crédito del cliente).` : undefined}
              />
              <FormTextarea control={form.control} name="notes" label="Observaciones" rows={3} />
            </FieldGroup>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums">{formatMoney(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Descuentos</span>
              <span className="tabular-nums">−{formatMoney(totals.discount)}</span>
            </div>
            <div className="flex items-baseline justify-between border-t pt-2">
              <span className="font-medium">Total de la venta</span>
              <span className="text-2xl font-semibold tabular-nums">{formatMoney(totals.total)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {formatNumber(totals.kg, "kg")} · Productos agrícolas sin procesar, tasa 0 % de IVA.
            </p>
            {overdrawn.length > 0 && (
              <p className="text-sm text-destructive">
                Excede lo disponible en {overdrawn.map((l) => `${l.lotCode} (${formatNumber(l.availableKg, "kg")})`).join(", ")}.
              </p>
            )}
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground">
          El borrador no aparta producto. Al confirmar se descuentan los lotes y la venta pasa a cuentas por cobrar.
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button asChild variant="ghost">
            <Link href={draft ? `/ventas/${draft.id}` : "/ventas"}>Cancelar</Link>
          </Button>
          <SubmitButton pending={pending && !confirm} disabled={pending} variant="outline" onClick={() => choose(false)}>
            <Save aria-hidden /> Guardar borrador
          </SubmitButton>
          <SubmitButton pending={pending && confirm} disabled={pending || overdrawn.length > 0} onClick={() => choose(true)}>
            <CheckCircle2 aria-hidden /> Confirmar venta
          </SubmitButton>
        </div>
      </div>
    </form>
  )
}
