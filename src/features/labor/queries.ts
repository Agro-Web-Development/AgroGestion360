import "server-only"

import { getOrgContext } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"

export async function getEmployees() {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("employees")
    .select("id, full_name, position, phone, daily_wage, notes, is_active, labor_records(count)")
    .eq("organization_id", ctx.organization.id)
    .order("is_active", { ascending: false })
    .order("full_name")
  if (error) throw new Error("No fue posible cargar el personal.")
  return data.map(({ labor_records, ...e }) => ({ ...e, recordCount: labor_records[0]?.count ?? 0 }))
}

export async function getLaborRecords(limit = 300) {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("labor_records")
    .select(
      "id, work_date, activity, pay_type, quantity, unit_label, unit_rate, amount, crew, employee:employees(full_name), project:projects!inner(id, code, status), assignment:project_plots(plot:plots!inner(name))"
    )
    .eq("organization_id", ctx.organization.id)
    .order("work_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error("No fue posible cargar la mano de obra.")
  return data
}

export type Employee = Awaited<ReturnType<typeof getEmployees>>[number]
