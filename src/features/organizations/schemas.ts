import { z } from "zod"

/** Convierte cadenas vacías en null para columnas opcionales. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .transform((v) => (v === "" ? null : v))

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres").max(120),
})

export const RFC_REGEX = /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/

export const organizationSchema = z.object({
  name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres").max(120),
  legalName: optionalText(200),
  rfc: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === "" || RFC_REGEX.test(v), "RFC no válido (12 o 13 caracteres)")
    .transform((v) => (v === "" ? null : v)),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .refine((v) => v === "" || z.email().safeParse(v).success, "Correo electrónico no válido")
    .transform((v) => (v === "" ? null : v)),
  phone: optionalText(30),
  address: optionalText(300),
})

export type CreateOrganizationInput = z.input<typeof createOrganizationSchema>
export type OrganizationInput = z.input<typeof organizationSchema>
