"use server"

import { refresh } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { dbErrorMessage, failure, success, validationFailure, type ActionResult } from "@/lib/actions"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { paymentSchema, saleSchema, type PaymentInput, type SaleInput } from "./schemas"

const idSchema = z.uuid()
const reasonSchema = z.string().trim().min(5).max(500)

/** Encabezado y partidas en una sola transacción (RPC); un reintento con el mismo id no duplica la venta. */
export async function createSale(input: SaleInput): Promise<ActionResult> {
  const parsed = saleSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)

  const ctx = await getOrgContext()
  if (!can(ctx.role, "sales.write")) return failure("No tienes permiso para registrar ventas.")

  const v = parsed.data
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("create_sale", {
    p_id: v.id,
    p_customer: v.customerId,
    p_sale_date: v.saleDate,
    p_due_date: v.dueDate ?? undefined,
    p_notes: v.notes ?? undefined,
    p_items: v.items.map((i) => ({
      project_id: i.projectId,
      description: i.description,
      quality: i.quality,
      quantity_kg: i.quantityKg,
      unit_price: i.unitPrice,
    })),
  })
  if (error) return failure(dbErrorMessage(error))

  redirect(`/ventas/${data}`)
}

export async function cancelSale(saleId: string, reason: string): Promise<ActionResult> {
  if (!idSchema.safeParse(saleId).success) return failure("Venta no válida.")
  if (!reasonSchema.safeParse(reason).success) return failure("Indica el motivo de la cancelación.")
  const ctx = await getOrgContext()
  if (!can(ctx.role, "sales.write")) return failure("No tienes permiso para cancelar ventas.")

  const supabase = await createClient()
  const { error } = await supabase.rpc("cancel_sale", { p_sale: saleId, p_reason: reason.trim() })
  if (error) return failure(dbErrorMessage(error))

  refresh()
  return success(undefined, "Venta cancelada. Su producción vuelve a estar disponible.")
}

/** Pago parcial o total; la RPC bloquea la venta y rechaza importes mayores al saldo. */
export async function registerPayment(input: PaymentInput): Promise<ActionResult> {
  const parsed = paymentSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)

  const ctx = await getOrgContext()
  if (!can(ctx.role, "payments.write")) return failure("No tienes permiso para registrar pagos.")

  const v = parsed.data
  const supabase = await createClient()
  const { error } = await supabase.rpc("register_payment", {
    p_id: v.id,
    p_sale: v.saleId,
    p_date: v.date,
    p_amount: v.amount,
    p_method: v.method,
    p_reference: v.reference ?? undefined,
    p_notes: v.notes ?? undefined,
  })
  if (error) {
    if (error.code === "22023" && error.message.includes("excede")) return failure(error.message, { amount: [error.message] })
    return failure(dbErrorMessage(error))
  }

  refresh()
  return success(undefined, "Pago registrado.")
}

export async function cancelPayment(paymentId: string, reason: string): Promise<ActionResult> {
  if (!idSchema.safeParse(paymentId).success) return failure("Pago no válido.")
  if (!reasonSchema.safeParse(reason).success) return failure("Indica el motivo de la cancelación.")
  const ctx = await getOrgContext()
  if (!can(ctx.role, "payments.write")) return failure("No tienes permiso para cancelar pagos.")

  const supabase = await createClient()
  const { error } = await supabase.rpc("cancel_payment", { p_payment: paymentId, p_reason: reason.trim() })
  if (error) return failure(dbErrorMessage(error))

  refresh()
  return success(undefined, "Pago cancelado; el saldo de la venta se restituyó.")
}
