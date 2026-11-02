import "server-only"

import { getOrgContext } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"

export async function getCrops() {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("crops")
    .select("id, name, variety, scientific_name, cycle_days, yield_unit, notes, is_active, projects(status)")
    .eq("organization_id", ctx.organization.id)
    .order("is_active", { ascending: false })
    .order("name")
    .order("variety", { nullsFirst: true })
  if (error) throw new Error("No fue posible cargar los cultivos.")

  return data.map(({ projects, ...crop }) => ({
    ...crop,
    projectCount: projects.length,
    activeProjectCount: projects.filter((p) => p.status !== "cerrado" && p.status !== "cancelado").length,
  }))
}

export type Crop = Awaited<ReturnType<typeof getCrops>>[number]
