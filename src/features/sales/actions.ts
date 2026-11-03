"use server"

import { refresh } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { dbErrorMessage, failure, success, validationFailure, type ActionResult } from "@/lib/actions"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import {
  applyAdvanceSchema,
  deliverySchema,
  paymentSchema,
  saleSchema,
  type ApplyAdvanceInput,
  type DeliveryInput,
  type PaymentInput,
  type SaleInput,
} from "./schemas"

const idSchema = z.uuid()
const reasonSchema = z.string().trim().min(5).max(500)

/** Errores de la BD que corresponden a un campo del formulario. */
function amountFailure(error: Parameters<typeof dbErrorMessage>[0]): ActionResult<never> {
  if (error.code === "22023" && error.message.includes("excede")) return failure(error.message, { amount: [error.message] })
  if (error.code === "22023" && error.message.includes("fecha")) return failure(error.message, { date: [error.message] })
  return failure(dbErrorMessage(error))
}

/**
 * Guarda la venta como borrador (encabezado y partidas en una transacción) y,
 * con `confirm`, la confirma en la misma operación: entonces descuenta los
 * lotes con bloqueo, de modo que dos ventas simultáneas no venden el mismo
 * producto. Un reintento con el mismo id no duplica la venta.
 */
export async function saveSale(input: SaleInput, confirm: boolean): Promise<ActionResult> {
  const parsed = saleSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)

  const ctx = await getOrgContext()
  if (!can(ctx.role, "sales.write")) return failure("No tienes permiso para registrar ventas.")

  const v = parsed.data
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("save_sale", {
    p_id: v.id,
    p_customer: v.customerId,
    p_sale_date: v.saleDate,
    p_due_date: v.dueDate ?? undefined,
    p_delivery_date: v.deliveryDate ?? undefined,
    p_notes: v.notes ?? undefined,
    p_confirm: confirm,
    p_items: v.items.map((i) => ({
      harvest_id: i.harvestId,
      description: i.description,
      unit: i.unit,
      quantity: i.quantity,
      unit_weight_kg: i.unitWeightKg,
      unit_price: i.unitPrice,
      discount: i.discount,
    })),
  })
  if (error) {
    if (error.code === "22023" && error.message.includes("fecha de venta")) {
      return failure(error.message, { saleDate: [error.message] })
    }
    return failure(dbErrorMessage(error))
  }

  redirect(`/ventas/${data}`)
}

export async function confirmSale(saleId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(saleId).success) return failure("Venta no válida.")
  const ctx = await getOrgContext()
  if (!can(ctx.role, "sales.write")) return failure("No tienes permiso para confirmar ventas.")

  const supabase = await createClient()
  const { error } = await supabase.rpc("confirm_sale", { p_sale: saleId })
  if (error) return failure(dbErrorMessage(error))

  refresh()
  return success(undefined, "Venta confirmada. Se descontó la producción de sus lotes.")
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
  return success(undefined, "Venta cancelada. Si estaba confirmada, su producción regresó a los lotes.")
}

/** Pago o anticipo; la RPC bloquea la venta y rechaza importes mayores a lo cobrable. */
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
    p_kind: v.kind,
  })
  if (error) return amountFailure(error)

  refresh()
  return success(undefined, v.kind === "anticipo" ? "Anticipo registrado; aplícalo cuando la venta esté confirmada." : "Pago registrado.")
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
  return success(undefined, "Movimiento cancelado; el saldo de la venta se restituyó.")
}

/** Aplicación explícita (total o parcial) de un anticipo al saldo de su venta. */
export async function applyAdvance(input: ApplyAdvanceInput): Promise<ActionResult> {
  const parsed = applyAdvanceSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)

  const ctx = await getOrgContext()
  if (!can(ctx.role, "payments.write")) return failure("No tienes permiso para aplicar anticipos.")

  const v = parsed.data
  const supabase = await createClient()
  const { error } = await supabase.rpc("apply_advance", {
    p_id: v.id,
    p_payment: v.paymentId,
    p_amount: v.amount,
    p_date: v.date,
  })
  if (error) return amountFailure(error)

  refresh()
  return success(undefined, "Anticipo aplicado al saldo de la venta.")
}

export async function cancelAdvanceApplication(applicationId: string, reason: string): Promise<ActionResult> {
  if (!idSchema.safeParse(applicationId).success) return failure("Aplicación no válida.")
  if (!reasonSchema.safeParse(reason).success) return failure("Indica el motivo de la reversión.")
  const ctx = await getOrgContext()
  if (!can(ctx.role, "payments.write")) return failure("No tienes permiso para revertir aplicaciones.")

  const supabase = await createClient()
  const { error } = await supabase.rpc("cancel_advance_application", { p_application: applicationId, p_reason: reason.trim() })
  if (error) return failure(dbErrorMessage(error))

  refresh()
  return success(undefined, "Aplicación revertida; el importe vuelve a quedar como anticipo pendiente.")
}

export async function registerDelivery(input: DeliveryInput): Promise<ActionResult> {
  const parsed = deliverySchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)

  const ctx = await getOrgContext()
  if (!can(ctx.role, "sales.write")) return failure("No tienes permiso para registrar entregas.")

  const v = parsed.data
  const supabase = await createClient()
  const { error } = await supabase.rpc("register_delivery", {
    p_id: v.id,
    p_sale: v.saleId,
    p_date: v.date,
    p_items: v.items.filter((i) => i.quantity > 0).map((i) => ({ sale_item_id: i.saleItemId, quantity: i.quantity })),
    p_received_by: v.receivedBy ?? undefined,
    p_transport: v.transport ?? undefined,
    p_notes: v.notes ?? undefined,
  })
  if (error) return amountFailure(error)

  refresh()
  return success(undefined, "Entrega registrada.")
}

export async function cancelDelivery(deliveryId: string, reason: string): Promise<ActionResult> {
  if (!idSchema.safeParse(deliveryId).success) return failure("Entrega no válida.")
  if (!reasonSchema.safeParse(reason).success) return failure("Indica el motivo de la cancelación.")
  const ctx = await getOrgContext()
  if (!can(ctx.role, "sales.write")) return failure("No tienes permiso para cancelar entregas.")

  const supabase = await createClient()
  const { error } = await supabase.rpc("cancel_delivery", { p_delivery: deliveryId, p_reason: reason.trim() })
  if (error) return failure(dbErrorMessage(error))

  refresh()
  return success(undefined, "Entrega cancelada; lo entregado vuelve a quedar pendiente.")
}
