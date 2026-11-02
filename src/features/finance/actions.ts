"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { dbErrorMessage, failure, isDuplicateId, success, validationFailure, type ActionResult } from "@/lib/actions"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { expenseSchema, type ExpenseInput } from "./schemas"

const idSchema = z.uuid()

export async function registerExpense(input: ExpenseInput): Promise<ActionResult> {
  const parsed = expenseSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)

  const ctx = await getOrgContext()
  if (!can(ctx.role, "expenses.write")) return failure("No tienes permiso para registrar gastos.")

  const v = parsed.data
  const supabase = await createClient()
  const { error } = await supabase.from("project_expenses").insert({
    id: v.id,
    organization_id: ctx.organization.id,
    project_id: v.projectId,
    plot_id: v.plotId,
    expense_date: v.date,
    category: v.category,
    description: v.description,
    supplier: v.supplier,
    invoice_ref: v.invoiceRef,
    amount: v.amount,
    notes: v.notes,
  })
  if (error && !isDuplicateId(error)) {
    if (error.code === "23505") {
      const message = "Esa factura de ese proveedor ya está registrada en el proyecto."
      return failure(message, { invoiceRef: [message] })
    }
    if (error.code === "23503") return failure("La parcela no está asignada al proyecto.", { plotId: ["Parcela no válida"] })
    return failure(dbErrorMessage(error))
  }

  refresh()
  return success(undefined, "Gasto registrado.")
}

export async function deleteExpense(expenseId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(expenseId).success) return failure("Gasto no válido.")
  const ctx = await getOrgContext()
  if (!can(ctx.role, "expenses.write")) return failure("No tienes permiso para eliminar gastos.")

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("project_expenses")
    .delete()
    .eq("id", expenseId)
    .eq("organization_id", ctx.organization.id)
    .select("id")
  if (error) return failure(dbErrorMessage(error))
  if (!data?.length) return failure("No tienes permiso para eliminar este gasto.")

  refresh()
  return success(undefined, "Gasto eliminado.")
}
