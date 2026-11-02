import "server-only"

import { getOrgContext } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"

export async function getHarvests(limit = 300) {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("harvests")
    .select(
      "id, harvest_date, quality, quantity_kg, packages, notes, project:projects!inner(id, code, name, status, crop:crops!inner(name, variety)), assignment:project_plots!inner(plot:plots!inner(name))"
    )
    .eq("organization_id", ctx.organization.id)
    .order("harvest_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error("No fue posible cargar las cosechas.")
  return data
}
