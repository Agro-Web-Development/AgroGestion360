"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { dbErrorMessage, failure, isDuplicateId, success, validationFailure, type ActionResult } from "@/lib/actions"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import {
  machineSchema,
  MACHINE_STATUSES,
  maintenanceSchema,
  usageSchema,
  type MachineInput,
  type MachineStatus,
  type MaintenanceInput,
  type UsageInput,
} from "./schemas"

const idSchema = z.uuid()

export async function saveMachine(input: MachineInput): Promise<ActionResult> {
  const parsed = machineSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)

  const ctx = await getOrgContext()
  if (!can(ctx.role, "machinery.write")) return failure("No tienes permiso para administrar maquinaria.")

  const { id, ...v } = parsed.data
  const values = {
    name: v.name,
    code: v.code,
    kind: v.kind,
    brand: v.brand,
    model: v.model,
    serial_number: v.serialNumber,
    acquisition_date: v.acquisitionDate,
    acquisition_cost: v.acquisitionCost,
    status: v.status,
    responsible_id: v.responsibleId,
    rate_basis: v.rateBasis,
    hourly_cost: v.hourlyCost,
    daily_rate: v.dailyRate,
    maintenance_interval_hours: v.maintenanceIntervalHours,
    maintenance_interval_days: v.maintenanceIntervalDays,
    notes: v.notes,
  }

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
    id ? "Equipo actualizado. Las nuevas tarifas aplican a los registros siguientes." : "Equipo registrado."
  )
}

export async function setMachineStatus(machineId: string, status: MachineStatus): Promise<ActionResult> {
  if (!idSchema.safeParse(machineId).success || !MACHINE_STATUSES.includes(status)) return failure("Equipo no válido.")
  const ctx = await getOrgContext()
  if (!can(ctx.role, "machinery.write")) return failure("No tienes permiso para administrar maquinaria.")

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("machinery")
    .update({ status })
    .eq("id", machineId)
    .eq("organization_id", ctx.organization.id)
    .select("id")
  if (error) return failure(dbErrorMessage(error))
  if (!data?.length) return failure("No tienes permiso para modificar este equipo.")

  refresh()
  return success(undefined, status === "baja" ? "Equipo dado de baja." : "Estado del equipo actualizado.")
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
    if (error.code === "23503") return failure("El equipo tiene usos o mantenimientos registrados. Puedes darlo de baja en su lugar.")
    return failure(dbErrorMessage(error))
  }
  if (!data?.length) return failure("No tienes permiso para eliminar este equipo.")

  refresh()
  return success(undefined, "Equipo eliminado.")
}

/** El uso y el combustible surtido del almacén se registran en una sola transacción (idempotente por id). */
export async function registerUsage(input: UsageInput): Promise<ActionResult> {
  const parsed = usageSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)

  const ctx = await getOrgContext()
  if (!can(ctx.role, "machinery.write")) return failure("No tienes permiso para registrar uso de maquinaria.")

  const v = parsed.data
  const supabase = await createClient()
  const { error } = await supabase.rpc("register_machinery_usage", {
    p_id: v.id,
    p_machine: v.machineId,
    p_project: v.projectId,
    p_date: v.date,
    p_hours: v.hours,
    p_plot: v.plotId ?? undefined,
    p_rate_basis: v.rateBasis,
    p_jornadas: v.rateBasis === "jornada" ? (v.jornadas ?? undefined) : undefined,
    // Sin tarifa, un trigger toma la del equipo según la base y la congela.
    p_rate: v.rate ?? undefined,
    p_operator_id: v.operatorId ?? undefined,
    p_operator: v.operatorId ? undefined : (v.operator ?? undefined),
    p_activity_type: v.activityTypeId ?? undefined,
    p_activity: v.activity ?? undefined,
    p_fuel_quantity: v.fuelQuantity ?? undefined,
    p_fuel_product: v.fuelFromStock ? (v.fuelProductId ?? undefined) : undefined,
    p_fuel_warehouse: v.fuelFromStock ? (v.fuelWarehouseId ?? undefined) : undefined,
    p_fuel_lot: v.fuelFromStock ? (v.fuelLotId ?? undefined) : undefined,
    p_notes: v.notes ?? undefined,
  })
  if (error) {
    if (error.code === "23503") return failure("La parcela no está asignada al proyecto.", { plotId: ["Parcela no válida"] })
    if (error.code === "22023" && error.message.startsWith("Existencia insuficiente")) {
      return failure(error.message, { fuelQuantity: [error.message] })
    }
    if (error.code === "22023" && /24 h|jornada/.test(error.message)) {
      return failure(error.message, { [/24 h/.test(error.message) ? "hours" : "jornadas"]: [error.message] })
    }
    return failure(dbErrorMessage(error))
  }

  refresh()
  return success(undefined, v.fuelFromStock ? "Uso registrado; el combustible se descontó del almacén." : "Uso de maquinaria registrado.")
}

export async function deleteUsage(usageId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(usageId).success) return failure("Registro no válido.")
  const ctx = await getOrgContext()
  if (!can(ctx.role, "machinery.write")) return failure("No tienes permiso para eliminar registros de maquinaria.")

  const supabase = await createClient()
  // Si tenía combustible del almacén, un trigger lo regresa con su costo.
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

export async function saveMaintenance(input: MaintenanceInput, isUpdate = false): Promise<ActionResult> {
  const parsed = maintenanceSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)

  const ctx = await getOrgContext()
  if (!can(ctx.role, "machinery.write")) return failure("No tienes permiso para registrar mantenimientos.")

  const v = parsed.data
  const values = {
    maintenance_date: v.date,
    kind: v.kind,
    description: v.description,
    provider: v.provider,
    cost: v.cost,
    hour_meter: v.hourMeter,
    responsible_id: v.responsibleId,
    notes: v.notes,
  }
  const supabase = await createClient()
  if (isUpdate) {
    const { data, error } = await supabase
      .from("machinery_maintenance")
      .update(values)
      .eq("id", v.id)
      .eq("organization_id", ctx.organization.id)
      .select("id")
    if (error) return failure(dbErrorMessage(error))
    if (!data?.length) return failure("No tienes permiso para modificar este mantenimiento.")
  } else {
    const { error } = await supabase
      .from("machinery_maintenance")
      .insert({ ...values, id: v.id, organization_id: ctx.organization.id, machine_id: v.machineId })
    if (error && !isDuplicateId(error)) return failure(dbErrorMessage(error))
  }

  refresh()
  return success(undefined, isUpdate ? "Mantenimiento actualizado." : "Mantenimiento registrado.")
}
