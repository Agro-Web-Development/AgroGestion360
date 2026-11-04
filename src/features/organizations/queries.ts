import "server-only"

import { getOrgContext } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"

export async function getOrganizationDetails() {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, legal_name, rfc, email, phone, address, timezone, currency, is_demo, created_at")
    .eq("id", ctx.organization.id)
    .single()
  if (error) throw new Error("No fue posible cargar la organización.")
  return data
}

export async function getTeamSummary() {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const [members, invitations] = await Promise.all([
    supabase
      .from("memberships")
      .select("role", { count: "exact" })
      .eq("organization_id", ctx.organization.id)
      .eq("status", "activo"),
    supabase
      .from("invitations")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", ctx.organization.id)
      .eq("status", "pendiente"),
  ])
  if (members.error) throw new Error("No fue posible cargar el equipo.")

  const byRole = new Map<string, number>()
  for (const m of members.data) byRole.set(m.role, (byRole.get(m.role) ?? 0) + 1)

  return {
    activeMembers: members.count ?? 0,
    pendingInvitations: invitations.count ?? 0,
    byRole,
  }
}

export async function getRecentActivity(limit = 8) {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const { data } = await supabase
    .from("audit_logs")
    .select("id, table_name, action, actor_id, created_at")
    .eq("organization_id", ctx.organization.id)
    .order("created_at", { ascending: false })
    .limit(limit)
  return data ?? []
}

export type PlanUsage = {
  plan_code: string
  plan_name: string
  features: string[]
  max_projects: number | null
  max_users: number | null
  max_storage_mb: number | null
  projects: number
  users: number
  pending_invitations: number
  storage_bytes: number
}

/** Plan de la organización y su uso frente a los límites (sin cobros; ver docs/saas-suscripciones.md). */
export async function getPlanUsage(): Promise<PlanUsage> {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("organization_usage", { p_org: ctx.organization.id })
  if (error) throw new Error("No fue posible cargar el plan de la organización.")
  return data as unknown as PlanUsage
}
