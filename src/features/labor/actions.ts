"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { dbErrorMessage, failure, isDuplicateId, success, validationFailure, type ActionResult } from "@/lib/actions"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { employeeSchema, laborSchema, type EmployeeInput, type LaborInput } from "./schemas"

const idSchema = z.uuid()

export async function saveEmployee(input: EmployeeInput): Promise<ActionResult> {
  const parsed = employeeSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)

  const ctx = await getOrgContext()
  if (!can(ctx.role, "employees.write")) return failure("No tienes permiso para administrar el personal.")

  const { id, ...v } = parsed.data
  const values = { full_name: v.fullName, position: v.position, phone: v.phone, daily_wage: v.dailyWage, notes: v.notes }

  const supabase = await createClient()
  const { data, error } = id
    ? await supabase.from("employees").update(values).eq("id", id).eq("organization_id", ctx.organization.id).select("id")
    : await supabase.from("employees").insert({ ...values, organization_id: ctx.organization.id }).select("id")

  if (error) {
    if (error.code === "23505") return failure("Ya existe un empleado con ese nombre.")
    return failure(dbErrorMessage(error))
  }
  if (!data?.length) return failure("No tienes permiso para modificar este empleado.")

  refresh()
  return success(undefined, id ? "Empleado actualizado." : "Empleado registrado.")
}

export async function setEmployeeActive(employeeId: string, active: boolean): Promise<ActionResult> {
  if (!idSchema.safeParse(employeeId).success) return failure("Empleado no válido.")
  const ctx = await getOrgContext()
  if (!can(ctx.role, "employees.write")) return failure("No tienes permiso para administrar el personal.")

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("employees")
    .update({ is_active: active })
    .eq("id", employeeId)
    .eq("organization_id", ctx.organization.id)
    .select("id")
  if (error) return failure(dbErrorMessage(error))
  if (!data?.length) return failure("No tienes permiso para modificar este empleado.")

  refresh()
  return success(undefined, active ? "Empleado reactivado." : "Empleado dado de baja.")
}

export async function deleteEmployee(employeeId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(employeeId).success) return failure("Empleado no válido.")
  const ctx = await getOrgContext()
  if (!can(ctx.role, "catalogs.delete")) return failure("Solo propietarios y administradores pueden eliminar empleados.")

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("employees")
    .delete()
    .eq("id", employeeId)
    .eq("organization_id", ctx.organization.id)
    .select("id")
  if (error) {
    if (error.code === "23503") return failure("El empleado tiene jornadas registradas. Puedes darlo de baja en su lugar.")
    return failure(dbErrorMessage(error))
  }
  if (!data?.length) return failure("No tienes permiso para eliminar este empleado.")

  refresh()
  return success(undefined, "Empleado eliminado.")
}

export async function registerLabor(input: LaborInput): Promise<ActionResult> {
  const parsed = laborSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)

  const ctx = await getOrgContext()
  if (!can(ctx.role, "labor.write")) return failure("No tienes permiso para registrar mano de obra.")

  const v = parsed.data
  const supabase = await createClient()
  const { error } = await supabase.from("labor_records").insert({
    id: v.id,
    organization_id: ctx.organization.id,
    project_id: v.projectId,
    plot_id: v.plotId,
    employee_id: v.employeeId,
    crew: v.employeeId ? null : v.crew,
    work_date: v.date,
    activity: v.activity,
    pay_type: v.payType,
    quantity: v.quantity,
    unit_label: v.payType === "destajo" ? v.unitLabel : null,
    // null en jornal de empleado: un trigger toma su salario diario antes de validar NOT NULL.
    unit_rate: v.unitRate as number,
    notes: v.notes,
  })
  if (error && !isDuplicateId(error)) {
    if (error.code === "23503") return failure("La parcela no está asignada al proyecto.", { plotId: ["Parcela no válida"] })
    if (error.code === "22023" && error.message.includes("jornal")) {
      return failure(error.message, { quantity: [error.message] })
    }
    return failure(dbErrorMessage(error))
  }

  refresh()
  return success(undefined, "Mano de obra registrada.")
}

export async function deleteLabor(recordId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(recordId).success) return failure("Registro no válido.")
  const ctx = await getOrgContext()
  if (!can(ctx.role, "labor.write")) return failure("No tienes permiso para eliminar registros de mano de obra.")

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("labor_records")
    .delete()
    .eq("id", recordId)
    .eq("organization_id", ctx.organization.id)
    .select("id")
  if (error) return failure(dbErrorMessage(error))
  if (!data?.length) return failure("No tienes permiso para eliminar este registro.")

  refresh()
  return success(undefined, "Registro eliminado.")
}
