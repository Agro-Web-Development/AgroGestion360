import { z } from "zod"

import { optionalInteger, optionalText, requiredText } from "@/lib/validation"

const RFC_REGEX = /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/

export const customerSchema = z.object({
  id: z.uuid().optional(),
  name: requiredText(2, 150, "El nombre debe tener al menos 2 caracteres"),
  rfc: optionalText(13)
    .transform((v) => v?.toUpperCase() ?? null)
    .refine((v) => v === null || RFC_REGEX.test(v), "RFC no válido (12 o 13 caracteres)"),
  contactName: optionalText(120),
  phone: optionalText(30),
  email: optionalText(254).refine((v) => v === null || z.email().safeParse(v).success, "Correo no válido"),
  address: optionalText(300),
  creditDays: optionalInteger(0, 365).transform((v) => v ?? 0),
  notes: optionalText(2000),
})

export type CustomerInput = z.input<typeof customerSchema>
