import "server-only"

import { getOrgContext } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"

export async function getEmployees() {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("employees")
    .select("id, full_name, position, worker_type, phone, hire_date, daily_wage, notes, is_active, labor_records(count)")
    .eq("organization_id", ctx.organization.id)
    .order("is_active", { ascending: false })
    .order("full_name")
  if (error) throw new Error("No fue posible cargar el personal.")
  return data.map(({ labor_records, ...e }) => ({ ...e, recordCount: labor_records[0]?.count ?? 0 }))
}

/** Empleados activos para selectores (responsables, operadores, integrantes). */
export async function getEmployeeOptions() {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("employees")
    .select("id, full_name, position")
    .eq("organization_id", ctx.organization.id)
    .eq("is_active", true)
    .order("full_name")
  if (error) throw new Error("No fue posible cargar el personal.")
  return data.map((e) => ({ value: e.id, label: e.position ? `${e.full_name} · ${e.position}` : e.full_name }))
}

export type DateRange = { from?: string; to?: string; projectId?: string }

export async function getLaborRecords(range: DateRange = {}, limit = 500) {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  let query = supabase
    .from("labor_records")
    .select(
      "id, work_date, activity, pay_type, quantity, unit_label, unit_rate, amount, crew, batch_id, employee:employees(full_name), crew_ref:crews(name), activity_type:activity_types(name), project:projects!inner(id, code, status), assignment:project_plots(plot:plots!inner(name))"
    )
    .eq("organization_id", ctx.organization.id)
  if (range.from) query = query.gte("work_date", range.from)
  if (range.to) query = query.lte("work_date", range.to)
  if (range.projectId) query = query.eq("project_id", range.projectId)
  const { data, error } = await query
    .order("work_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error("No fue posible cargar la mano de obra.")
  return data
}

export async function getAttendance(range: DateRange = {}, limit = 500) {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  let query = supabase
    .from("attendance_records")
    .select("id, employee_id, work_date, status, check_in, check_out, notes, employee:employees!inner(full_name, position)")
    .eq("organization_id", ctx.organization.id)
  if (range.from) query = query.gte("work_date", range.from)
  if (range.to) query = query.lte("work_date", range.to)
  const { data, error } = await query.order("work_date", { ascending: false }).order("created_at").limit(limit)
  if (error) throw new Error("No fue posible cargar la asistencia.")
  return data
}

export async function getCrews() {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("crews")
    .select(
      "id, name, leader_id, notes, is_active, leader:employees(full_name), crew_members(employee_id, employee:employees!inner(full_name, is_active)), labor_records(count)"
    )
    .eq("organization_id", ctx.organization.id)
    .order("is_active", { ascending: false })
    .order("name")
  if (error) throw new Error("No fue posible cargar las cuadrillas.")
  return data.map(({ crew_members, labor_records, ...c }) => ({
    ...c,
    members: crew_members
      .map((m) => ({ id: m.employee_id, name: m.employee.full_name, active: m.employee.is_active }))
      .sort((a, b) => a.name.localeCompare(b.name, "es")),
    recordCount: labor_records[0]?.count ?? 0,
  }))
}

export async function getAssignments(projectId?: string) {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  let query = supabase
    .from("employee_assignments")
    .select(
      "id, employee_id, project_id, plot_id, crew_id, start_date, end_date, role, notes, employee:employees!inner(full_name), crew:crews(name), project:projects!inner(id, code, name, status), assignment:project_plots(plot:plots!inner(name))"
    )
    .eq("organization_id", ctx.organization.id)
  if (projectId) query = query.eq("project_id", projectId)
  const { data, error } = await query.order("start_date", { ascending: false })
  if (error) throw new Error("No fue posible cargar las asignaciones.")
  return data
}

export type Employee = Awaited<ReturnType<typeof getEmployees>>[number]
export type LaborRecord = Awaited<ReturnType<typeof getLaborRecords>>[number]
export type AttendanceRecord = Awaited<ReturnType<typeof getAttendance>>[number]
export type Crew = Awaited<ReturnType<typeof getCrews>>[number]
export type Assignment = Awaited<ReturnType<typeof getAssignments>>[number]
