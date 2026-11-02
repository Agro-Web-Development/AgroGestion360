import "server-only"

import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"

export async function getMembers() {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("memberships")
    .select("id, role, status, created_at, user:profiles!inner(id, full_name, email, phone)")
    .eq("organization_id", ctx.organization.id)
    .order("status")
    .order("created_at")
  if (error) throw new Error("No fue posible cargar los usuarios.")
  return data
}

export async function getPendingInvitations() {
  const ctx = await getOrgContext()
  if (!can(ctx.role, "members.manage")) return []
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("invitations")
    .select("id, email, role, created_at, expires_at")
    .eq("organization_id", ctx.organization.id)
    .eq("status", "pendiente")
    .order("created_at", { ascending: false })
  if (error) throw new Error("No fue posible cargar las invitaciones.")
  return data
}

export type Member = Awaited<ReturnType<typeof getMembers>>[number]
export type PendingInvitation = Awaited<ReturnType<typeof getPendingInvitations>>[number]
