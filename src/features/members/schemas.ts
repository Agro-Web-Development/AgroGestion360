import { z } from "zod"

import { ROLES } from "@/lib/auth/roles"

const role = z.enum(ROLES, { error: "Selecciona un rol" })

export const inviteMemberSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Ingresa un correo electrónico válido")),
  role: role.refine((r) => r !== "propietario", "El rol de propietario no se asigna por invitación"),
})

export const updateMemberSchema = z.object({
  membershipId: z.uuid(),
  role,
  status: z.enum(["activo", "inactivo"]),
})

export type InviteMemberInput = z.input<typeof inviteMemberSchema>
export type UpdateMemberInput = z.input<typeof updateMemberSchema>
