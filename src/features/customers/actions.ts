"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { dbErrorMessage, failure, success, validationFailure, type ActionResult } from "@/lib/actions"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { customerSchema, type CustomerInput } from "./schemas"

const idSchema = z.uuid()

export async function saveCustomer(input: CustomerInput): Promise<ActionResult> {
  const parsed = customerSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)

  const ctx = await getOrgContext()
  if (!can(ctx.role, "sales.write")) return failure("No tienes permiso para administrar clientes.")

  const { id, ...v } = parsed.data
  const values = {
    name: v.name,
    customer_type: v.customerType,
    rfc: v.rfc,
    contact_name: v.contactName,
    phone: v.phone,
    email: v.email,
    address: v.address,
    credit_days: v.creditDays,
    notes: v.notes,
  }

  const supabase = await createClient()
  const { data, error } = id
    ? await supabase.from("customers").update(values).eq("id", id).eq("organization_id", ctx.organization.id).select("id")
    : await supabase.from("customers").insert({ ...values, organization_id: ctx.organization.id }).select("id")

  if (error) {
    if (error.code === "23505") return failure("Ya existe un cliente con ese nombre.")
    return failure(dbErrorMessage(error))
  }
  if (!data?.length) return failure("No tienes permiso para modificar este cliente.")

  refresh()
  return success(undefined, id ? "Cliente actualizado." : "Cliente registrado.")
}

export async function setCustomerActive(customerId: string, active: boolean): Promise<ActionResult> {
  if (!idSchema.safeParse(customerId).success) return failure("Cliente no válido.")
  const ctx = await getOrgContext()
  if (!can(ctx.role, "sales.write")) return failure("No tienes permiso para administrar clientes.")

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("customers")
    .update({ is_active: active })
    .eq("id", customerId)
    .eq("organization_id", ctx.organization.id)
    .select("id")
  if (error) return failure(dbErrorMessage(error))
  if (!data?.length) return failure("No tienes permiso para modificar este cliente.")

  refresh()
  return success(undefined, active ? "Cliente reactivado." : "Cliente desactivado.")
}

export async function deleteCustomer(customerId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(customerId).success) return failure("Cliente no válido.")
  const ctx = await getOrgContext()
  if (!can(ctx.role, "catalogs.delete")) return failure("Solo propietarios y administradores pueden eliminar clientes.")

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("customers")
    .delete()
    .eq("id", customerId)
    .eq("organization_id", ctx.organization.id)
    .select("id")
  if (error) {
    if (error.code === "23503") return failure("El cliente tiene ventas registradas. Puedes desactivarlo en su lugar.")
    return failure(dbErrorMessage(error))
  }
  if (!data?.length) return failure("No tienes permiso para eliminar este cliente.")

  refresh()
  return success(undefined, "Cliente eliminado.")
}
