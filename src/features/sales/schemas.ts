import { z } from "zod"

import { HARVEST_QUALITIES } from "@/features/harvests/schemas"
import { todayISO } from "@/lib/format"
import { decimal, NONE, optionalDate, optionalText, requiredDate, requiredId, requiredText } from "@/lib/validation"
import type { Database } from "@/types/database"

export type PaymentMethod = Database["public"]["Enums"]["payment_method"]
export type PaymentState = "pendiente" | "parcial" | "pagada" | "cancelada"

export const PAYMENT_METHODS = ["transferencia", "efectivo", "cheque", "deposito", "otro"] as const satisfies readonly PaymentMethod[]

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  transferencia: "Transferencia (SPEI)",
  efectivo: "Efectivo",
  cheque: "Cheque",
  deposito: "Depósito bancario",
  otro: "Otro",
}

export const PAYMENT_STATE_LABELS: Record<PaymentState, string> = {
  pendiente: "Pendiente de pago",
  parcial: "Pago parcial",
  pagada: "Pagada",
  cancelada: "Cancelada",
}

export const PAYMENT_STATE_CLASS: Record<PaymentState, string> = {
  pendiente: "bg-warning/20 text-foreground",
  parcial: "bg-secondary text-secondary-foreground",
  pagada: "bg-primary text-primary-foreground",
  cancelada: "bg-destructive/15 text-destructive",
}

export const saleItemSchema = z.object({
  projectId: requiredId("Selecciona el proyecto"),
  description: requiredText(2, 200, "Describe el producto"),
  quality: z
    .string()
    .transform((v) => (v === "" || v === NONE ? null : v))
    .pipe(z.enum(HARVEST_QUALITIES).nullable()),
  quantityKg: decimal({ scale: 3, max: 999_999_999 }),
  unitPrice: decimal({ scale: 4, max: 9_999_999 }),
})

export const saleSchema = z
  .object({
    id: z.uuid(),
    customerId: requiredId("Selecciona el cliente"),
    saleDate: requiredDate(),
    dueDate: optionalDate(),
    notes: optionalText(1000),
    items: z.array(saleItemSchema).min(1, "Agrega al menos una partida").max(50, "Máximo 50 partidas"),
  })
  .superRefine((v, ctx) => {
    if (v.saleDate > todayISO()) ctx.addIssue({ code: "custom", path: ["saleDate"], message: "No puede ser una fecha futura" })
    if (v.dueDate && v.dueDate < v.saleDate) {
      ctx.addIssue({ code: "custom", path: ["dueDate"], message: "No puede ser anterior a la venta" })
    }
  })

export const paymentSchema = z
  .object({
    id: z.uuid(),
    saleId: z.uuid(),
    date: requiredDate(),
    amount: decimal({ scale: 2, max: 999_999_999_999 }),
    method: z.enum(PAYMENT_METHODS, { error: "Selecciona la forma de pago" }),
    reference: optionalText(60),
    notes: optionalText(500),
  })
  .refine((v) => v.date <= todayISO(), { path: ["date"], message: "No puede ser una fecha futura" })

export type SaleInput = z.input<typeof saleSchema>
export type SaleItemInput = z.input<typeof saleItemSchema>
export type PaymentInput = z.input<typeof paymentSchema>

/** Importe de una partida redondeado a centavos, igual que la columna generada en la BD. */
export function lineAmount(quantityKg: number, unitPrice: number): number {
  return Math.round(quantityKg * unitPrice * 100) / 100
}
