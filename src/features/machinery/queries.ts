import "server-only"

import { getOrgContext } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"

export async function getMachines() {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("machinery")
    .select("id, name, code, kind, hourly_cost, notes, is_active, machinery_usage(hours, amount)")
    .eq("organization_id", ctx.organization.id)
    .order("is_active", { ascending: false })
    .order("name")
  if (error) throw new Error("No fue posible cargar la maquinaria.")
  return data.map(({ machinery_usage, ...m }) => ({
    ...m,
    usageCount: machinery_usage.length,
    totalHours: machinery_usage.reduce((s, u) => s + Number(u.hours), 0),
    totalCost: machinery_usage.reduce((s, u) => s + Number(u.amount), 0),
  }))
}

export async function getUsage(limit = 300) {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("machinery_usage")
    .select(
      "id, usage_date, hours, hourly_rate, amount, operator, activity, machine:machinery!inner(name), project:projects!inner(id, code, status), assignment:project_plots(plot:plots!inner(name))"
    )
    .eq("organization_id", ctx.organization.id)
    .order("usage_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error("No fue posible cargar el uso de maquinaria.")
  return data
}

export type Machine = Awaited<ReturnType<typeof getMachines>>[number]
