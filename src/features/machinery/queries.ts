import "server-only"

import { getOrgContext } from "@/lib/auth/session"
import { LIST_LIMIT } from "@/lib/list-limit"
import { fetchRows } from "@/lib/supabase/rows"
import { createClient } from "@/lib/supabase/server"
import type { MaintenanceAlert } from "./schemas"

/** Equipos con horas, costos y alerta de mantenimiento (vista v_machinery_status). */
export async function getMachines() {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const [machines, status] = await Promise.all([
    supabase
      .from("machinery")
      .select(
        "id, name, code, kind, brand, model, serial_number, acquisition_date, acquisition_cost, status, is_active, responsible_id, rate_basis, hourly_cost, daily_rate, maintenance_interval_hours, maintenance_interval_days, notes, responsible:employees(full_name)"
      )
      .eq("organization_id", ctx.organization.id)
      .order("is_active", { ascending: false })
      .order("name"),
    supabase.from("v_machinery_status").select("*").eq("organization_id", ctx.organization.id),
  ])
  if (machines.error || status.error) throw new Error("No fue posible cargar la maquinaria.")
  const byId = new Map(status.data.map((s) => [s.machine_id, s]))
  return machines.data.map((m) => {
    const s = byId.get(m.id)
    return {
      ...m,
      usageCount: Number(s?.usage_count ?? 0),
      totalHours: Number(s?.total_hours ?? 0),
      totalCost: Number(s?.usage_amount ?? 0),
      maintenanceCount: Number(s?.maintenance_count ?? 0),
      maintenanceCost: Number(s?.maintenance_cost ?? 0),
      repairCost: Number(s?.repair_cost ?? 0),
      hoursSinceService: Number(s?.hours_since_service ?? 0),
      hoursToService: s?.hours_to_service === null || s?.hours_to_service === undefined ? null : Number(s.hours_to_service),
      lastServiceDate: s?.last_service_date ?? null,
      nextServiceDate: s?.next_service_date ?? null,
      alert: (s?.maintenance_alert ?? "sin_programa") as MaintenanceAlert,
    }
  })
}

export type UsageFilters = { from?: string; to?: string; projectId?: string }

export async function getUsage(filters: UsageFilters = {}, limit = LIST_LIMIT) {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  let query = supabase
    .from("machinery_usage")
    .select(
      "id, usage_date, hours, rate_basis, jornadas, rate, amount, operator, activity, fuel_quantity, fuel_movement_id, machine:machinery!inner(id, name), operator_ref:employees(full_name), activity_type:activity_types(name), fuel:inventory_movements(total_cost, product:inventory_products!inner(name)), project:projects!inner(id, code, status), assignment:project_plots(plot:plots!inner(name))"
    )
    .eq("organization_id", ctx.organization.id)
  if (filters.from) query = query.gte("usage_date", filters.from)
  if (filters.to) query = query.lte("usage_date", filters.to)
  if (filters.projectId) query = query.eq("project_id", filters.projectId)
  const { data, error } = await fetchRows(
    query    .order("usage_date", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id"),
    limit
  )
  if (error) throw new Error("No fue posible cargar el uso de maquinaria.")
  return data
}

export async function getMaintenance(filters: Omit<UsageFilters, "projectId"> = {}, limit = LIST_LIMIT) {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  let query = supabase
    .from("machinery_maintenance")
    .select(
      "id, machine_id, maintenance_date, kind, description, provider, cost, hour_meter, responsible_id, notes, status, cancel_reason, machine:machinery!inner(name, status), responsible:employees(full_name)"
    )
    .eq("organization_id", ctx.organization.id)
  if (filters.from) query = query.gte("maintenance_date", filters.from)
  if (filters.to) query = query.lte("maintenance_date", filters.to)
  const { data, error } = await fetchRows(
    query    .order("maintenance_date", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id"),
    limit
  )
  if (error) throw new Error("No fue posible cargar el historial de mantenimiento.")
  return data
}

export type Machine = Awaited<ReturnType<typeof getMachines>>[number]
export type Usage = Awaited<ReturnType<typeof getUsage>>[number]
export type Maintenance = Awaited<ReturnType<typeof getMaintenance>>[number]
