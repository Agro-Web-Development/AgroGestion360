"use server"

import { refresh } from "next/cache"

import { dbErrorMessage, failure, success, validationFailure, type ActionResult } from "@/lib/actions"
import { can, canManageMember } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { env } from "@/lib/env"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import {
  inviteMemberSchema,
  updateMemberSchema,
  type InviteMemberInput,
  type UpdateMemberInput,
} from "./schemas"

export async function inviteMember(input: InviteMemberInput): Promise<ActionResult> {
  const parsed = inviteMemberSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)

  const ctx = await getOrgContext()
  if (!can(ctx.role, "members.manage")) return failure("No tienes permiso para invitar usuarios.")

  const supabase = await createClient()
  const { data: outcome, error } = await supabase.rpc("invite_member", {
    p_org: ctx.organization.id,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
  })
  if (error) return failure(dbErrorMessage(error))

  if (outcome === "agregado") {
    refresh()
    return success(undefined, "El usuario ya tenía cuenta y fue agregado a la organización.")
  }

  // Sin cuenta: la RPC dejó la invitación pendiente (ya autorizada); enviamos el correo.
  // El trigger de alta convierte la invitación en membresía al crearse el usuario.
  const admin = createAdminClient()
  const { error: mailError } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    redirectTo: `${env.siteUrl}/auth/aceptar`,
  })
  refresh()
  if (mailError) {
    return success(
      undefined,
      "Invitación registrada, pero no se pudo enviar el correo. El usuario puede registrarse con ese correo para unirse."
    )
  }
  return success(undefined, `Invitación enviada a ${parsed.data.email}.`)
}

export async function cancelInvitation(invitationId: string): Promise<ActionResult> {
  const ctx = await getOrgContext()
  if (!can(ctx.role, "members.manage")) return failure("No tienes permiso para cancelar invitaciones.")

  const supabase = await createClient()
  const { error } = await supabase.rpc("cancel_invitation", { p_invitation: invitationId })
  if (error) return failure(dbErrorMessage(error))

  refresh()
  return success(undefined, "Invitación cancelada.")
}

export async function updateMember(input: UpdateMemberInput): Promise<ActionResult> {
  const parsed = updateMemberSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)

  const ctx = await getOrgContext()
  if (!can(ctx.role, "members.manage")) return failure("No tienes permiso para administrar usuarios.")
  if (parsed.data.role === "propietario" && !canManageMember(ctx.role, "propietario")) {
    return failure("Solo un propietario puede asignar el rol de propietario.")
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc("update_member", {
    p_membership: parsed.data.membershipId,
    p_role: parsed.data.role,
    p_status: parsed.data.status,
  })
  if (error) return failure(dbErrorMessage(error))

  refresh()
  return success(undefined, "Miembro actualizado.")
}
