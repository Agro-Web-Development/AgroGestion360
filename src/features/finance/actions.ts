"use server"

import { refresh } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { dbErrorMessage, failure, success, validationFailure, type ActionResult } from "@/lib/actions"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import {
  budgetSchema,
  cashMovementSchema,
  expenseSchema,
  financeSettingsSchema,
  type BudgetInput,
  type CashMovementInput,
  type ExpenseInput,
  type FinanceSettingsInput,
} from "./schemas"

const idSchema = z.uuid()
const reasonSchema = z.string().trim().min(5, "Indica el motivo").max(500)

export async function registerExpense(input: ExpenseInput): Promise<ActionResult> {
  const parsed = expenseSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)

  const ctx = await getOrgContext()
  if (!can(ctx.role, "expenses.write")) return failure("No tienes permiso para registrar gastos.")

  const v = parsed.data
  const supabase = await createClient()
  const { error } = await supabase.rpc("register_expense", {
    p_id: v.id,
    p_org: ctx.organization.id,
    p_date: v.date,
    p_category: v.category,
    p_cost_category: v.costCategory,
    p_description: v.description,
    p_amount: v.amount,
    p_allocation_method: v.allocationMethod,
    p_allocations: v.allocations.map((a) => ({
      project_id: a.projectId,
      plot_id: v.allocationMethod === "directo" ? a.plotId : null,
      value: a.value,
    })),
    p_supplier: v.supplierId ?? undefined,
    p_invoice_ref: v.invoiceRef ?? undefined,
    p_payment_method: v.paymentMethod ?? undefined,
    p_responsible: v.responsibleId ?? undefined,
    p_notes: v.notes ?? undefined,
    p_payment: v.paidNow
      ? { id: v.paymentId, date: v.paymentDate, method: v.paymentMethod, reference: v.paymentReference }
      : undefined,
  })
  if (error) {
    if (error.code === "23505" && error.message.includes("factura")) {
      return failure(error.message, { invoiceRef: [error.message] })
    }
    if (error.code === "22023" && error.message.includes("fecha del gasto")) {
      return failure(error.message, { date: [error.message] })
    }
    return failure(dbErrorMessage(error))
  }

  refresh()
  return success(undefined, v.paidNow ? "Gasto registrado y pagado." : "Gasto registrado; queda pendiente de pago.")
}

export async function cancelExpense(expenseId: string, reason: string): Promise<ActionResult> {
  if (!idSchema.safeParse(expenseId).success) return failure("Gasto no válido.")
  const r = reasonSchema.safeParse(reason)
  if (!r.success) return failure("Indica el motivo de la cancelación (mínimo 5 caracteres).")
  const ctx = await getOrgContext()
  if (!can(ctx.role, "expenses.write")) return failure("No tienes permiso para cancelar gastos.")

  const supabase = await createClient()
  const { error } = await supabase.rpc("cancel_expense", { p_expense: expenseId, p_reason: r.data })
  if (error) return failure(dbErrorMessage(error))

  refresh()
  return success(undefined, "Gasto cancelado; ya no cuenta como costo.")
}

export async function registerCashMovement(input: CashMovementInput): Promise<ActionResult> {
  const parsed = cashMovementSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)

  const ctx = await getOrgContext()
  if (!can(ctx.role, "cash.write")) return failure("No tienes permiso para registrar movimientos de efectivo.")

  const v = parsed.data
  const supabase = await createClient()
  const { error } = await supabase.rpc("register_cash_movement", {
    p_id: v.id,
    p_org: ctx.organization.id,
    p_kind: v.kind,
    p_date: v.date,
    p_amount: v.amount,
    p_method: v.method,
    p_concept: v.concept ?? undefined,
    p_reference: v.reference ?? undefined,
    p_expense: v.kind === "pago_gasto" ? (v.expenseId ?? undefined) : undefined,
    p_supplier: v.supplierId ?? undefined,
    p_project: v.kind === "pago_gasto" ? undefined : (v.projectId ?? undefined),
    p_notes: v.notes ?? undefined,
  })
  if (error) {
    if (error.code === "22023" && error.message.includes("excede")) return failure(error.message, { amount: [error.message] })
    return failure(dbErrorMessage(error))
  }

  refresh()
  return success(undefined, v.kind === "pago_gasto" ? "Pago del gasto registrado." : "Movimiento registrado.")
}

export async function cancelCashMovement(movementId: string, reason: string): Promise<ActionResult> {
  if (!idSchema.safeParse(movementId).success) return failure("Movimiento no válido.")
  const r = reasonSchema.safeParse(reason)
  if (!r.success) return failure("Indica el motivo de la cancelación (mínimo 5 caracteres).")
  const ctx = await getOrgContext()
  if (!can(ctx.role, "cash.write")) return failure("No tienes permiso para cancelar movimientos de efectivo.")

  const supabase = await createClient()
  const { error } = await supabase.rpc("cancel_cash_movement", { p_movement: movementId, p_reason: r.data })
  if (error) return failure(dbErrorMessage(error))

  refresh()
  return success(undefined, "Movimiento cancelado.")
}

export async function saveBudget(input: BudgetInput): Promise<ActionResult> {
  const parsed = budgetSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)

  const ctx = await getOrgContext()
  if (!can(ctx.role, "budgets.write")) return failure("No tienes permiso para elaborar presupuestos.")

  const v = parsed.data
  const supabase = await createClient()
  const { error } = await supabase.rpc("save_budget", {
    p_id: v.id,
    p_project: v.projectId,
    p_lines: v.lines.map((l) => ({
      category: l.category,
      concept: l.concept,
      unit: l.unit,
      quantity: l.quantity,
      unit_cost: l.unitCost,
    })),
    p_period_start: v.periodStart,
    p_period_end: v.periodEnd,
    p_area_ha: v.areaHa,
    p_base_version: v.baseVersion ?? undefined,
    p_reason: v.reason ?? undefined,
    p_notes: v.notes ?? undefined,
  })
  if (error) {
    if (error.code === "22023" && error.message.includes("periodo")) return failure(error.message, { periodEnd: [error.message] })
    if (error.code === "22023" && error.message.includes("motivo")) return failure(error.message, { reason: [error.message] })
    return failure(dbErrorMessage(error))
  }

  redirect(`/presupuestos/${v.projectId}`)
}

export async function saveFinanceSettings(input: FinanceSettingsInput): Promise<ActionResult> {
  const parsed = financeSettingsSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)

  const ctx = await getOrgContext()
  if (!can(ctx.role, "budgets.write")) return failure("No tienes permiso para configurar las alertas.")

  const v = parsed.data
  const values = { warning_pct: v.warning, critical_pct: v.critical, exhausted_pct: v.exhausted }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("finance_settings")
    .update(values)
    .eq("organization_id", ctx.organization.id)
    .select("organization_id")
  if (error) return failure(dbErrorMessage(error))
  if (!data.length) {
    const { error: insertError } = await supabase
      .from("finance_settings")
      .insert({ organization_id: ctx.organization.id, ...values })
    // Si otra sesión creó la fila en el intermedio, se actualiza.
    if (insertError?.code === "23505") {
      const { error: retryError } = await supabase.from("finance_settings").update(values).eq("organization_id", ctx.organization.id)
      if (retryError) return failure(dbErrorMessage(retryError))
    } else if (insertError) {
      return failure(dbErrorMessage(insertError))
    }
  }

  refresh()
  return success(undefined, "Umbrales de alerta actualizados.")
}
