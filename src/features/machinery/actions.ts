"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { dbErrorMessage, failure, isDuplicateId, success, validationFailure, type ActionResult } from "@/lib/actions"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { machineSchema, usageSchema, type MachineInput, type UsageInput } from "./schemas"

const idSchema = z.uuid()

export async function saveMachine(input: MachineInput): Promise<ActionResult> {
  const parsed = machineSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)

  const ctx = await getOrgContext()
  if (!can(ctx.role, "machinery.write")) return failure("No tienes permiso para administrar maquinaria.")

  const { id, ...v } = parsed.data
  const values = { name: v.name, code: v.code, kind: v.kind, hourly_cost: v.hourlyCost, notes: v.notes }

  const supabase = await createClient()
  const { data, error } = id
    ? await supabase.from("machinery").update(values).eq("id", id).eq("organization_id", ctx.organization.id).select("id")
    : await supabase.from("machinery").insert({ ...values, organization_id: ctx.organization.id }).select("id")

  if (error) {
    if (error.code === "23505") return failure("Ya existe un equipo con ese nombre o clave.")
    return failure(dbErrorMessage(error))
  }
  if (!data?.length) return failure("No tienes permiso para modificar este equipo.")

  refresh()
  return success(
    undefined,
    id ? "Equipo actualizado. La nueva tarifa aplica a los registros siguientes." : "Equipo registrado."
  )
}

export async function setMachineActive(machineId: string, active: boolean): Promise<ActionResult> {
  if (!idSchema.safeParse(machineId).success) return failure("Equipo no válido.")
  const ctx = await getOrgContext()
  if (!can(ctx.role, "machinery.write")) return failure("No tienes permiso para administrar maquinaria.")

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("machinery")
    .update({ is_active: active })
    .eq("id", machineId)
    .eq("organization_id", ctx.organization.id)
    .select("id")
  if (error) return failure(dbErrorMessage(error))
  if (!data?.length) return failure("No tienes permiso para modificar este equipo.")

  refresh()
  return success(undefined, active ? "Equipo reactivado." : "Equipo desactivado.")
}

export async function deleteMachine(machineId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(machineId).success) return failure("Equipo no válido.")
  const ctx = await getOrgContext()
  if (!can(ctx.role, "catalogs.delete")) return failure("Solo propietarios y administradores pueden eliminar equipos.")

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("machinery")
    .delete()
    .eq("id", machineId)
    .eq("organization_id", ctx.organization.id)
    .select("id")
  if (error) {
    if (error.code === "23503") return failure("El equipo tiene usos registrados. Puedes desactivarlo en su lugar.")
    return failure(dbErrorMessage(error))
  }
  if (!data?.length) return failure("No tienes permiso para eliminar este equipo.")

  refresh()
  return success(undefined, "Equipo eliminado.")
}

export async function registerUsage(input: UsageInput): Promise<ActionResult> {
  const parsed = usageSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)

  const ctx = await getOrgContext()
  if (!can(ctx.role, "machinery.write")) return failure("No tienes permiso para registrar uso de maquinaria.")

  const v = parsed.data
  const supabase = await createClient()
  const { error } = await supabase.from("machinery_usage").insert({
    id: v.id,
    organization_id: ctx.organization.id,
    machine_id: v.machineId,
    project_id: v.projectId,
    plot_id: v.plotId,
    usage_date: v.date,
    hours: v.hours,
    // null: un trigger toma la tarifa del equipo (y la congela) antes de validar NOT NULL.
    hourly_rate: v.hourlyRate as number,
    operator: v.operator,
    activity: v.activity,
    notes: v.notes,
  })
  if (error && !isDuplicateId(error)) {
    if (error.code === "23503") return failure("La parcela no está asignada al proyecto.", { plotId: ["Parcela no válida"] })
    return failure(dbErrorMessage(error))
  }

  refresh()
  return success(undefined, "Uso de maquinaria registrado.")
}

export async function deleteUsage(usageId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(usageId).success) return failure("Registro no válido.")
  const ctx = await getOrgContext()
  if (!can(ctx.role, "machinery.write")) return failure("No tienes permiso para eliminar registros de maquinaria.")

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("machinery_usage")
    .delete()
    .eq("id", usageId)
    .eq("organization_id", ctx.organization.id)
    .select("id")
  if (error) return failure(dbErrorMessage(error))
  if (!data?.length) return failure("No tienes permiso para eliminar este registro.")

  refresh()
  return success(undefined, "Registro eliminado.")
}
