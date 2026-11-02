import "server-only"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { cache } from "react"

import { createClient } from "@/lib/supabase/server"
import type { AppRole } from "@/lib/auth/roles"

export const ACTIVE_ORG_COOKIE = "ag360_org"

export type CurrentUser = {
  id: string
  email: string
  fullName: string
  phone: string | null
}

export type UserMembership = {
  membershipId: string
  role: AppRole
  organization: { id: string; name: string; isDemo: boolean }
}

export type OrgContext = {
  user: CurrentUser
  role: AppRole
  organization: UserMembership["organization"]
  memberships: UserMembership[]
}

/**
 * Capa de acceso a datos (DAL) de la sesión. Verifica el usuario contra Supabase
 * Auth (getUser valida el token en el servidor) y se memoriza por solicitud.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone, email")
    .eq("id", data.user.id)
    .single()

  return {
    id: data.user.id,
    email: profile?.email ?? data.user.email ?? "",
    fullName: profile?.full_name ?? "",
    phone: profile?.phone ?? null,
  }
})

export const getMemberships = cache(async (): Promise<UserMembership[]> => {
  const user = await getCurrentUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("memberships")
    .select("id, role, organization:organizations!inner(id, name, is_demo)")
    .eq("user_id", user.id)
    .eq("status", "activo")
    .order("created_at")

  if (error) throw new Error("No fue posible cargar tus organizaciones.")

  return data.map((m) => ({
    membershipId: m.id,
    role: m.role,
    organization: { id: m.organization.id, name: m.organization.name, isDemo: m.organization.is_demo },
  }))
})

/**
 * Devuelve la organización activa (cookie) validando que el usuario sea miembro.
 * Si no pertenece a ninguna organización lo envía al alta inicial.
 */
export const getOrgContext = cache(async (): Promise<OrgContext> => {
  const [user, memberships, cookieStore] = await Promise.all([
    getCurrentUser(),
    getMemberships(),
    cookies(),
  ])
  if (memberships.length === 0) redirect("/bienvenida")

  const selected = cookieStore.get(ACTIVE_ORG_COOKIE)?.value
  const active = memberships.find((m) => m.organization.id === selected) ?? memberships[0]

  return { user, role: active.role, organization: active.organization, memberships }
})
