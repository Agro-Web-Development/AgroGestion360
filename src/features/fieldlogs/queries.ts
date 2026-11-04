import "server-only"

import { getOrgContext } from "@/lib/auth/session"
import { fetchRows } from "@/lib/supabase/rows"
import { createClient } from "@/lib/supabase/server"
import type { TimelineKind } from "./schemas"

export type LogFilters = { from?: string; to?: string; projectId?: string }

const LIMIT = 300

export async function getIrrigationLogs(filters: LogFilters = {}, limit = LIMIT) {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  let query = supabase
    .from("irrigation_logs")
    .select(
      "id, project_id, plot_id, log_date, start_time, end_time, duration_minutes, irrigation_system, water_m3, responsible_id, notes, status, cancel_reason, responsible:employees(full_name), project:projects!inner(id, code, status), assignment:project_plots!inner(plot:plots!inner(name))"
    )
    .eq("organization_id", ctx.organization.id)
  if (filters.from) query = query.gte("log_date", filters.from)
  if (filters.to) query = query.lte("log_date", filters.to)
  if (filters.projectId) query = query.eq("project_id", filters.projectId)
  const { data, error } = await fetchRows(
    query    .order("log_date", { ascending: false })
      .order("start_time", { ascending: false })
      .order("id"),
    limit
  )
  if (error) throw new Error("No fue posible cargar los riegos.")
  return data
}

export async function getApplications(filters: LogFilters = {}, limit = LIMIT) {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  let query = supabase
    .from("chemical_applications")
    .select(
      "id, project_id, plot_id, application_date, application_time, active_ingredient, quantity, unit, treated_area_ha, responsible_id, machine_id, equipment, lot_number, reentry_hours, preharvest_days, notes, status, cancel_reason, inventory_movement_id, product:inventory_products!inner(id, name), responsible:employees(full_name), machine:machinery(name), movement:inventory_movements(total_cost, warehouse:warehouses!inventory_movements_organization_id_warehouse_id_fkey(name)), project:projects!inner(id, code, status), assignment:project_plots!inner(plot:plots!inner(name))"
    )
    .eq("organization_id", ctx.organization.id)
  if (filters.from) query = query.gte("application_date", filters.from)
  if (filters.to) query = query.lte("application_date", filters.to)
  if (filters.projectId) query = query.eq("project_id", filters.projectId)
  const { data, error } = await fetchRows(
    query    .order("application_date", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id"),
    limit
  )
  if (error) throw new Error("No fue posible cargar las aplicaciones.")
  return data
}

export async function getActivities(filters: LogFilters = {}, limit = LIMIT) {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  let query = supabase
    .from("field_activities")
    .select(
      "id, project_id, plot_id, activity_type_id, activity_date, description, responsible_id, cost, notes, status, cancel_reason, activity_type:activity_types!inner(name), responsible:employees(full_name), project:projects!inner(id, code, status), assignment:project_plots(plot:plots!inner(name))"
    )
    .eq("organization_id", ctx.organization.id)
  if (filters.from) query = query.gte("activity_date", filters.from)
  if (filters.to) query = query.lte("activity_date", filters.to)
  if (filters.projectId) query = query.eq("project_id", filters.projectId)
  const { data, error } = await fetchRows(
    query    .order("activity_date", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id"),
    limit
  )
  if (error) throw new Error("No fue posible cargar las actividades.")
  return data
}

export async function getObservations(filters: LogFilters = {}, limit = LIMIT) {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  let query = supabase
    .from("field_observations")
    .select(
      "id, project_id, plot_id, observation_date, observation_time, category, severity, title, description, latitude, longitude, status, cancel_reason, responsible:employees(full_name), project:projects!inner(id, code, status), assignment:project_plots(plot:plots!inner(name))"
    )
    .eq("organization_id", ctx.organization.id)
  if (filters.from) query = query.gte("observation_date", filters.from)
  if (filters.to) query = query.lte("observation_date", filters.to)
  if (filters.projectId) query = query.eq("project_id", filters.projectId)
  const { data, error } = await fetchRows(
    query    .order("observation_date", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id"),
    limit
  )
  if (error) throw new Error("No fue posible cargar las observaciones.")
  return data
}

export async function getActivityTypes() {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("activity_types")
    .select("id, name, description, cost_category, is_active, field_activities(count), labor_records(count)")
    .eq("organization_id", ctx.organization.id)
    .order("is_active", { ascending: false })
    .order("name")
  if (error) throw new Error("No fue posible cargar el catálogo de actividades.")
  return data.map(({ field_activities, labor_records, ...t }) => ({
    ...t,
    useCount: (field_activities[0]?.count ?? 0) + (labor_records[0]?.count ?? 0),
  }))
}

export async function getActivityTypeOptions() {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("activity_types")
    .select("id, name")
    .eq("organization_id", ctx.organization.id)
    .eq("is_active", true)
    .order("name")
  if (error) throw new Error("No fue posible cargar el catálogo de actividades.")
  return data.map((t) => ({ value: t.id, label: t.name }))
}

/** Bitácora cronológica de un proyecto (riegos, aplicaciones, actividades, jornadas, maquinaria e insumos). */
export async function getProjectTimeline(projectId: string, filters: Omit<LogFilters, "projectId"> = {}, limit = 200) {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  let query = supabase
    .from("v_project_timeline")
    .select("kind, source_id, plot_id, event_date, event_time, title, detail, responsible, amount, cancelled, created_at")
    .eq("organization_id", ctx.organization.id)
    .eq("project_id", projectId)
  if (filters.from) query = query.gte("event_date", filters.from)
  if (filters.to) query = query.lte("event_date", filters.to)
  const [{ data, error }, plots] = await Promise.all([
    query
      .order("event_date", { ascending: false })
      .order("event_time", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase.from("project_plots").select("plot:plots!inner(id, name)").eq("project_id", projectId),
  ])
  if (error) throw new Error("No fue posible cargar la bitácora del proyecto.")
  const plotNames = new Map((plots.data ?? []).map((p) => [p.plot.id, p.plot.name]))
  return data.map((e) => ({
    kind: e.kind as TimelineKind,
    id: e.source_id!,
    date: e.event_date!,
    time: e.event_time?.slice(0, 5) ?? null,
    title: e.title ?? "",
    detail: e.detail,
    plot: e.plot_id ? (plotNames.get(e.plot_id) ?? null) : null,
    responsible: e.responsible,
    amount: e.amount === null ? null : Number(e.amount),
    cancelled: Boolean(e.cancelled),
  }))
}

export type IrrigationLog = Awaited<ReturnType<typeof getIrrigationLogs>>[number]
export type Application = Awaited<ReturnType<typeof getApplications>>[number]
export type FieldActivity = Awaited<ReturnType<typeof getActivities>>[number]
export type FieldObservation = Awaited<ReturnType<typeof getObservations>>[number]
export type ActivityType = Awaited<ReturnType<typeof getActivityTypes>>[number]
export type TimelineEntry = Awaited<ReturnType<typeof getProjectTimeline>>[number]

/** Indicadores operativos del proyecto para su expediente (sin importes). */
export async function getProjectOperations(projectId: string) {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const org = ctx.organization.id
  const [irrigations, applications, activities, labor, usage] = await Promise.all([
    supabase.from("irrigation_logs").select("duration_minutes, water_m3").eq("organization_id", org).eq("project_id", projectId).eq("status", "registrado"),
    supabase.from("chemical_applications").select("id").eq("organization_id", org).eq("project_id", projectId).eq("status", "registrado"),
    supabase.from("field_activities").select("id").eq("organization_id", org).eq("project_id", projectId).eq("status", "registrado"),
    supabase.from("labor_records").select("pay_type, quantity").eq("organization_id", org).eq("project_id", projectId),
    supabase.from("machinery_usage").select("hours").eq("organization_id", org).eq("project_id", projectId),
  ])
  if (irrigations.error || applications.error || activities.error || labor.error || usage.error) {
    throw new Error("No fue posible cargar la operación del proyecto.")
  }
  return {
    irrigations: irrigations.data.length,
    irrigationMinutes: irrigations.data.reduce((s, r) => s + (r.duration_minutes ?? 0), 0),
    waterM3: irrigations.data.reduce((s, r) => s + Number(r.water_m3 ?? 0), 0),
    applications: applications.data.length,
    activities: activities.data.length,
    jornales: labor.data.filter((r) => r.pay_type === "jornal").reduce((s, r) => s + Number(r.quantity), 0),
    machineHours: usage.data.reduce((s, r) => s + Number(r.hours), 0),
  }
}
