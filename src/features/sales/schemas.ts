import { z } from "zod"

import { PRODUCE_UNITS, needsUnitWeight, toKg, type ProduceUnit } from "@/features/harvests/schemas"
import { todayISO } from "@/lib/format"
import { decimal, optionalDate, optionalDecimal, optionalText, requiredDate, requiredId } from "@/lib/validation"
import type { Database } from "@/types/database"

export type PaymentMethod = Database["public"]["Enums"]["payment_method"]
export type PaymentKind = Database["public"]["Enums"]["payment_kind"]
export type SaleStatus = Database["public"]["Enums"]["sale_status"]
export type PaymentState = "borrador" | "pendiente" | "parcial" | "pagada" | "cancelada"
export type DeliveryState = "pendiente" | "parcial" | "entregada"

export const PAYMENT_METHODS = ["transferencia", "efectivo", "cheque", "deposito", "otro"] as const satisfies readonly PaymentMethod[]

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  transferencia: "Transferencia (SPEI)",
  efectivo: "Efectivo",
  cheque: "Cheque",
  deposito: "Depósito bancario",
  otro: "Otro",
}

export const PAYMENT_KIND_LABELS: Record<PaymentKind, string> = {
  pago: "Pago",
  anticipo: "Anticipo",
}

export const SALE_STATUSES = [
  "borrador",
  "confirmada",
  "entregada",
  "parcialmente_pagada",
  "pagada",
  "cancelada",
] as const satisfies readonly SaleStatus[]

export const SALE_STATUS_LABELS: Record<SaleStatus, string> = {
  borrador: "Borrador",
  confirmada: "Confirmada",
  entregada: "Entregada",
  parcialmente_pagada: "Parcialmente pagada",
  pagada: "Pagada",
  cancelada: "Cancelada",
}

export const SALE_STATUS_CLASS: Record<SaleStatus, string> = {
  borrador: "border-dashed bg-transparent text-muted-foreground",
  confirmada: "bg-secondary text-secondary-foreground",
  entregada: "bg-sky-500/15 text-sky-800 dark:text-sky-200",
  parcialmente_pagada: "bg-warning/20 text-foreground",
  pagada: "bg-primary text-primary-foreground",
  cancelada: "bg-destructive/15 text-destructive",
}

export const PAYMENT_STATE_LABELS: Record<PaymentState, string> = {
  borrador: "Sin confirmar",
  pendiente: "Pendiente de pago",
  parcial: "Pago parcial",
  pagada: "Pagada",
  cancelada: "Cancelada",
}

export const DELIVERY_STATE_LABELS: Record<DeliveryState, string> = {
  pendiente: "Por entregar",
  parcial: "Entrega parcial",
  entregada: "Entregada",
}

/** Una venta cuenta como venta (y cuenta por cobrar) desde que se confirma hasta que se cancela. */
export function isActiveSale(status: SaleStatus): boolean {
  return status !== "borrador" && status !== "cancelada"
}

export const saleItemSchema = z
  .object({
    harvestId: requiredId("Selecciona el lote"),
    description: optionalText(200),
    unit: z.enum(PRODUCE_UNITS, { error: "Selecciona la unidad" }),
    quantity: decimal({ scale: 3, max: 999_999_999 }),
    unitWeightKg: optionalDecimal({ scale: 3, max: 9_999 }),
    unitPrice: decimal({ scale: 4, max: 99_999_999 }),
    discount: optionalDecimal({ scale: 2, max: 9_999_999_999, allowZero: true }).transform((v) => v ?? 0),
  })
  .superRefine((v, ctx) => {
    if (needsUnitWeight(v.unit) && v.unitWeightKg === null) {
      ctx.addIssue({ code: "custom", path: ["unitWeightKg"], message: "Indica el peso neto por unidad" })
    }
    if (v.discount > lineGross(v.quantity, v.unitPrice)) {
      ctx.addIssue({ code: "custom", path: ["discount"], message: "No puede superar el importe de la partida" })
    }
  })

export const saleSchema = z
  .object({
    id: z.uuid(),
    customerId: requiredId("Selecciona el cliente"),
    saleDate: requiredDate(),
    dueDate: optionalDate(),
    deliveryDate: optionalDate(),
    notes: optionalText(1000),
    items: z.array(saleItemSchema).min(1, "Agrega al menos una partida").max(50, "Máximo 50 partidas"),
  })
  .superRefine((v, ctx) => {
    if (v.saleDate > todayISO()) ctx.addIssue({ code: "custom", path: ["saleDate"], message: "No puede ser una fecha futura" })
    if (v.dueDate && v.dueDate < v.saleDate) {
      ctx.addIssue({ code: "custom", path: ["dueDate"], message: "No puede ser anterior a la venta" })
    }
    if (v.deliveryDate && v.deliveryDate < v.saleDate) {
      ctx.addIssue({ code: "custom", path: ["deliveryDate"], message: "No puede ser anterior a la venta" })
    }
  })

export const paymentSchema = z
  .object({
    id: z.uuid(),
    saleId: z.uuid(),
    kind: z.enum(["pago", "anticipo"]),
    date: requiredDate(),
    amount: decimal({ scale: 2, max: 999_999_999_999 }),
    method: z.enum(PAYMENT_METHODS, { error: "Selecciona la forma de pago" }),
    reference: optionalText(60),
    notes: optionalText(500),
  })
  .refine((v) => v.date <= todayISO(), { path: ["date"], message: "No puede ser una fecha futura" })

export const applyAdvanceSchema = z.object({
  id: z.uuid(),
  paymentId: z.uuid(),
  amount: decimal({ scale: 2, max: 999_999_999_999 }),
  date: requiredDate(),
})

export const deliverySchema = z
  .object({
    id: z.uuid(),
    saleId: z.uuid(),
    date: requiredDate(),
    receivedBy: optionalText(120),
    transport: optionalText(120),
    notes: optionalText(500),
    items: z
      .array(
        z.object({
          saleItemId: z.uuid(),
          quantity: optionalDecimal({ scale: 3, max: 999_999_999, allowZero: true }).transform((v) => v ?? 0),
        })
      )
      .min(1),
  })
  .superRefine((v, ctx) => {
    if (v.date > todayISO()) ctx.addIssue({ code: "custom", path: ["date"], message: "No puede ser una fecha futura" })
    if (!v.items.some((i) => i.quantity > 0)) {
      ctx.addIssue({ code: "custom", path: ["items"], message: "Indica la cantidad entregada de al menos una partida" })
    }
  })

export type SaleInput = z.input<typeof saleSchema>
export type SaleItemInput = z.input<typeof saleItemSchema>
export type PaymentInput = z.input<typeof paymentSchema>
export type ApplyAdvanceInput = z.input<typeof applyAdvanceSchema>
export type DeliveryInput = z.input<typeof deliverySchema>

const cents = (n: number) => Math.round(n * 100) / 100

/** Importe bruto de una partida redondeado a centavos, igual que la columna generada en la BD. */
export function lineGross(quantity: number, unitPrice: number): number {
  return cents(quantity * unitPrice)
}

/** Subtotal, descuentos, total y kilogramos de una venta, con el mismo redondeo que la BD. */
export function saleTotals(
  items: { quantity: number; unitPrice: number; discount: number; unit: ProduceUnit; unitWeightKg?: number | null }[]
) {
  const subtotal = cents(items.reduce((t, i) => t + lineGross(i.quantity, i.unitPrice), 0))
  const discount = cents(items.reduce((t, i) => t + i.discount, 0))
  const kg = Math.round(items.reduce((t, i) => t + toKg(i.quantity, i.unit, i.unitWeightKg), 0) * 1000) / 1000
  return { subtotal, discount, total: cents(subtotal - discount), kg }
}

/** Cobranza de un conjunto de ventas confirmadas: lo vendido, lo pagado, el saldo y su recuperación. */
export function collectionSummary(sales: { total: number; paid: number; lastPaymentDate?: string | null }[]) {
  const total = cents(sales.reduce((t, s) => t + s.total, 0))
  const paid = cents(sales.reduce((t, s) => t + s.paid, 0))
  const lastPaymentDate = sales.reduce<string | null>(
    (last, s) => (s.lastPaymentDate && (!last || s.lastPaymentDate > last) ? s.lastPaymentDate : last),
    null
  )
  return {
    total,
    paid,
    balance: cents(total - paid),
    recoveryPct: total > 0 ? Math.round((paid / total) * 1000) / 10 : null,
    lastPaymentDate,
  }
}
