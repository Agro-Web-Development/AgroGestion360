"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { dbErrorMessage, failure, isDuplicateId, success, validationFailure, type ActionResult } from "@/lib/actions"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import {
  assignmentSchema,
  attendanceSchema,
  crewLaborSchema,
  crewSchema,
  employeeSchema,
  laborSchema,
  type AssignmentInput,
  type AttendanceInput,
  type CrewInput,
  type CrewLaborInput,
  type EmployeeInput,
  type LaborInput,
} from "./schemas"

const idSchema = z.uuid()

/** Los errores de jornal, asistencia o cuadrilla llegan de la BD con mensaje propio; se muestran en el campo. */
function laborFailure(error: Parameters<typeof dbErrorMessage>[0], field = "quantity"): ActionResult<never> {
  if (error.code === "23503") return failure("La parcela no está asignada al proyecto.", { plotId: ["Parcela no válida"] })
  if (error.code === "22023" && /jornal|asistencia|registrad[oa] con/.test(error.message)) {
    return failure(error.message, { [field]: [error.message] })
  }
  return failure(dbErrorMessage(error))
}

export async function saveEmployee(input: EmployeeInput): Promise<ActionResult> {
  const parsed = employeeSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)

  const ctx = await getOrgContext()
  if (!can(ctx.role, "employees.write")) return failure("No tienes permiso para administrar el personal.")

  const { id, ...v } = parsed.data
  const values = {
    full_name: v.fullName,
    position: v.position,
    worker_type: v.workerType,
    phone: v.phone,
    hire_date: v.hireDate,
    daily_wage: v.dailyWage,
    notes: v.notes,
  }

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
    if (error.code === "23503") {
      return failure("El empleado tiene jornadas, asistencias o asignaciones registradas. Puedes darlo de baja en su lugar.")
    }
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
    activity_type_id: v.activityTypeId,
    activity: v.activity,
    pay_type: v.payType,
    quantity: v.quantity,
    unit_label: v.payType === "destajo" ? v.unitLabel : null,
    // null en jornal de empleado: un trigger toma su salario diario antes de validar NOT NULL.
    unit_rate: v.unitRate as number,
    notes: v.notes,
  })
  if (error && !isDuplicateId(error)) return laborFailure(error)

  refresh()
  return success(undefined, "Mano de obra registrada.")
}

/** Una jornada por integrante en una sola transacción (idempotente por id de lote). */
export async function registerCrewLabor(input: CrewLaborInput): Promise<ActionResult<number>> {
  const parsed = crewLaborSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)

  const ctx = await getOrgContext()
  if (!can(ctx.role, "labor.write")) return failure("No tienes permiso para registrar mano de obra.")

  const v = parsed.data
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("register_crew_labor", {
    p_id: v.id,
    p_crew: v.crewId,
    p_project: v.projectId,
    p_plot: v.plotId ?? undefined,
    p_date: v.date,
    p_activity: v.activity,
    p_activity_type: v.activityTypeId ?? undefined,
    p_pay_type: v.payType,
    p_quantity: v.quantity,
    p_unit_label: v.unitLabel ?? undefined,
    p_unit_rate: v.unitRate ?? undefined,
    p_employees: v.employeeIds,
    p_notes: v.notes ?? undefined,
  })
  if (error) return laborFailure(error, "employeeIds")

  refresh()
  return success(data, `Se registraron ${data} jornada(s) de la cuadrilla.`)
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

export async function saveAttendance(input: AttendanceInput): Promise<ActionResult> {
  const parsed = attendanceSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)

  const ctx = await getOrgContext()
  if (!can(ctx.role, "labor.write")) return failure("No tienes permiso para registrar asistencia.")

  const { id, ...v } = parsed.data
  const values = { status: v.status, check_in: v.checkIn, check_out: v.checkOut, notes: v.notes }
  const supabase = await createClient()
  const { data, error } = id
    ? await supabase
        .from("attendance_records")
        .update(values)
        .eq("id", id)
        .eq("organization_id", ctx.organization.id)
        .select("id")
    : await supabase
        .from("attendance_records")
        .insert({ ...values, organization_id: ctx.organization.id, employee_id: v.employeeId, work_date: v.date })
        .select("id")
  if (error) {
    if (error.code === "23505") return failure("Ese empleado ya tiene asistencia registrada en esa fecha; edítala.")
    if (error.code === "22023") return failure(error.message, { status: [error.message] })
    return failure(dbErrorMessage(error))
  }
  if (!data?.length) return failure("No tienes permiso para modificar esta asistencia.")

  refresh()
  return success(undefined, id ? "Asistencia actualizada." : "Asistencia registrada.")
}

export async function deleteAttendance(recordId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(recordId).success) return failure("Registro no válido.")
  const ctx = await getOrgContext()
  if (!can(ctx.role, "labor.write")) return failure("No tienes permiso para modificar la asistencia.")

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("attendance_records")
    .delete()
    .eq("id", recordId)
    .eq("organization_id", ctx.organization.id)
    .select("id")
  if (error) return failure(dbErrorMessage(error))
  if (!data?.length) return failure("No tienes permiso para eliminar este registro.")

  refresh()
  return success(undefined, "Asistencia eliminada.")
}

/** Alta o edición de la cuadrilla y sincronización de integrantes. */
export async function saveCrew(input: CrewInput): Promise<ActionResult> {
  const parsed = crewSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)

  const ctx = await getOrgContext()
  if (!can(ctx.role, "employees.write")) return failure("No tienes permiso para administrar cuadrillas.")

  const { id, memberIds, ...v } = parsed.data
  const org = ctx.organization.id
  const values = { name: v.name, leader_id: v.leaderId, notes: v.notes }
  const supabase = await createClient()
  const { data, error } = id
    ? await supabase.from("crews").update(values).eq("id", id).eq("organization_id", org).select("id")
    : await supabase.from("crews").insert({ ...values, organization_id: org }).select("id")
  if (error) {
    if (error.code === "23505") return failure("Ya existe una cuadrilla con ese nombre.")
    return failure(dbErrorMessage(error))
  }
  const crewId = data?.[0]?.id
  if (!crewId) return failure("No tienes permiso para modificar esta cuadrilla.")

  const { data: current, error: readError } = await supabase.from("crew_members").select("employee_id").eq("crew_id", crewId)
  if (readError) return failure(dbErrorMessage(readError))
  const existing = new Set(current.map((m) => m.employee_id))
  const wanted = new Set(memberIds)
  const toAdd = memberIds.filter((m) => !existing.has(m))
  const toRemove = [...existing].filter((m) => !wanted.has(m))

  if (toAdd.length) {
    const { error: addError } = await supabase
      .from("crew_members")
      .insert(toAdd.map((employee_id) => ({ organization_id: org, crew_id: crewId, employee_id })))
    if (addError && addError.code !== "23505") return failure(dbErrorMessage(addError))
  }
  if (toRemove.length) {
    const { error: removeError } = await supabase.from("crew_members").delete().eq("crew_id", crewId).in("employee_id", toRemove)
    if (removeError) return failure(dbErrorMessage(removeError))
  }

  refresh()
  return success(undefined, id ? "Cuadrilla actualizada." : "Cuadrilla registrada.")
}

export async function setCrewActive(crewId: string, active: boolean): Promise<ActionResult> {
  if (!idSchema.safeParse(crewId).success) return failure("Cuadrilla no válida.")
  const ctx = await getOrgContext()
  if (!can(ctx.role, "employees.write")) return failure("No tienes permiso para administrar cuadrillas.")

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("crews")
    .update({ is_active: active })
    .eq("id", crewId)
    .eq("organization_id", ctx.organization.id)
    .select("id")
  if (error) return failure(dbErrorMessage(error))
  if (!data?.length) return failure("No tienes permiso para modificar esta cuadrilla.")

  refresh()
  return success(undefined, active ? "Cuadrilla reactivada." : "Cuadrilla desactivada.")
}

export async function deleteCrew(crewId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(crewId).success) return failure("Cuadrilla no válida.")
  const ctx = await getOrgContext()
  if (!can(ctx.role, "catalogs.delete")) return failure("Solo propietarios y administradores pueden eliminar cuadrillas.")

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("crews")
    .delete()
    .eq("id", crewId)
    .eq("organization_id", ctx.organization.id)
    .select("id")
  if (error) {
    if (error.code === "23503") return failure("La cuadrilla tiene jornadas o asignaciones registradas. Puedes desactivarla.")
    return failure(dbErrorMessage(error))
  }
  if (!data?.length) return failure("No tienes permiso para eliminar esta cuadrilla.")

  refresh()
  return success(undefined, "Cuadrilla eliminada.")
}

export async function saveAssignment(input: AssignmentInput): Promise<ActionResult> {
  const parsed = assignmentSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)

  const ctx = await getOrgContext()
  if (!can(ctx.role, "employees.write")) return failure("No tienes permiso para asignar personal.")

  const { id, ...v } = parsed.data
  const values = {
    plot_id: v.plotId,
    crew_id: v.crewId,
    start_date: v.startDate,
    end_date: v.endDate,
    role: v.role,
    notes: v.notes,
  }
  const supabase = await createClient()
  const { data, error } = id
    ? await supabase
        .from("employee_assignments")
        .update(values)
        .eq("id", id)
        .eq("organization_id", ctx.organization.id)
        .select("id")
    : await supabase
        .from("employee_assignments")
        .insert({ ...values, organization_id: ctx.organization.id, employee_id: v.employeeId, project_id: v.projectId })
        .select("id")
  if (error) {
    if (error.code === "23503") return failure("La parcela no está asignada al proyecto.", { plotId: ["Parcela no válida"] })
    return failure(dbErrorMessage(error))
  }
  if (!data?.length) return failure("No tienes permiso para modificar esta asignación.")

  refresh()
  return success(undefined, id ? "Asignación actualizada." : "Trabajador asignado al proyecto.")
}

export async function deleteAssignment(assignmentId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(assignmentId).success) return failure("Asignación no válida.")
  const ctx = await getOrgContext()
  if (!can(ctx.role, "employees.write")) return failure("No tienes permiso para modificar asignaciones.")

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("employee_assignments")
    .delete()
    .eq("id", assignmentId)
    .eq("organization_id", ctx.organization.id)
    .select("id")
  if (error) return failure(dbErrorMessage(error))
  if (!data?.length) return failure("No tienes permiso para eliminar esta asignación.")

  refresh()
  return success(undefined, "Asignación eliminada.")
}
