import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import type { AppRole } from "@/lib/auth/roles"
import { ACTIVE_ORG_COOKIE } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database"

export type ApiMembership = { organizationId: string; organizationName: string; role: AppRole }

export type ApiSession = {
  supabase: SupabaseClient<Database>
  userId: string
  email: string
  memberships: ApiMembership[]
}

/**
 * Sesión para Route Handlers (API de la captura sin conexión). A diferencia
 * del DAL de las páginas, no redirige: devuelve null para que la API responda
 * 401 en JSON. El usuario se verifica contra Supabase Auth (getUser).
 */
export async function getApiSession(): Promise<ApiSession | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return null

  const { data: rows, error: membershipsError } = await supabase
    .from("memberships")
    .select("role, organization:organizations!inner(id, name)")
    .eq("user_id", data.user.id)
    .eq("status", "activo")
    .order("created_at")
  if (membershipsError) throw new Error("No fue posible cargar las organizaciones.")

  return {
    supabase,
    userId: data.user.id,
    email: data.user.email ?? "",
    memberships: rows.map((m) => ({ organizationId: m.organization.id, organizationName: m.organization.name, role: m.role })),
  }
}

/** Organización activa (cookie), validada contra las membresías. */
export async function activeMembership(session: ApiSession): Promise<ApiMembership | null> {
  const selected = (await cookies()).get(ACTIVE_ORG_COOKIE)?.value
  return session.memberships.find((m) => m.organizationId === selected) ?? session.memberships[0] ?? null
}

/**
 * Las escrituras de la API solo se aceptan desde el mismo origen. Las cookies
 * de sesión ya son SameSite=Lax; esta verificación cubre navegadores o proxies
 * que no envíen ese atributo.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin")
  if (!origin) return request.headers.get("sec-fetch-site") !== "cross-site"
  try {
    return new URL(origin).host === new URL(request.url).host
  } catch {
    return false
  }
}

export const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } })
