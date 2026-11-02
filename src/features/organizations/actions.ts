"use server"

import { refresh } from "next/cache"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { dbErrorMessage, failure, success, validationFailure, type ActionResult } from "@/lib/actions"
import { can } from "@/lib/auth/roles"
import { ACTIVE_ORG_COOKIE, getMemberships, getOrgContext } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import {
  createOrganizationSchema,
  organizationSchema,
  type CreateOrganizationInput,
  type OrganizationInput,
} from "./schemas"

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
} as const

export async function createOrganization(input: CreateOrganizationInput): Promise<ActionResult> {
  const parsed = createOrganizationSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)

  const supabase = await createClient()
  const { data: orgId, error } = await supabase.rpc("create_organization", { p_name: parsed.data.name })
  if (error) return failure(dbErrorMessage(error))

  ;(await cookies()).set(ACTIVE_ORG_COOKIE, orgId, COOKIE_OPTIONS)
  redirect("/dashboard")
}

export async function updateOrganization(input: OrganizationInput): Promise<ActionResult> {
  const parsed = organizationSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)

  const ctx = await getOrgContext()
  if (!can(ctx.role, "organization.manage")) {
    return failure("No tienes permiso para modificar la organización.")
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("organizations")
    .update({
      name: parsed.data.name,
      legal_name: parsed.data.legalName,
      rfc: parsed.data.rfc,
      email: parsed.data.email,
      phone: parsed.data.phone,
      address: parsed.data.address,
    })
    .eq("id", ctx.organization.id)
    .select("id")

  if (error) return failure(dbErrorMessage(error))
  if (!data?.length) return failure("No tienes permiso para modificar la organización.")

  refresh()
  return success(undefined, "Datos de la organización actualizados.")
}

export async function switchOrganization(organizationId: string): Promise<ActionResult> {
  const memberships = await getMemberships()
  if (!memberships.some((m) => m.organization.id === organizationId)) {
    return failure("No perteneces a esa organización.")
  }
  ;(await cookies()).set(ACTIVE_ORG_COOKIE, organizationId, COOKIE_OPTIONS)
  redirect("/dashboard")
}
