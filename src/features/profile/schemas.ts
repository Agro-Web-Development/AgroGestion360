import { z } from "zod"

export const profileSchema = z.object({
  fullName: z.string().trim().min(3, "Ingresa tu nombre completo").max(120),
  phone: z
    .string()
    .trim()
    .refine((v) => v === "" || /^[0-9+()\s-]{7,30}$/.test(v), "Teléfono no válido")
    .transform((v) => (v === "" ? null : v)),
})

export type ProfileInput = z.input<typeof profileSchema>
