import { z } from "zod"

import type { Database } from "@/types/database"
import { decimal, optionalDecimal, optionalText, requiredId, requiredText } from "@/lib/validation"

export type IrrigationType = Database["public"]["Enums"]["irrigation_type"]

export const IRRIGATION_TYPES = [
  "temporal",
  "goteo",
  "aspersion",
  "microaspersion",
  "gravedad",
  "pivote",
  "otro",
] as const satisfies readonly IrrigationType[]

export const IRRIGATION_LABELS: Record<IrrigationType, string> = {
  temporal: "Temporal",
  goteo: "Goteo",
  aspersion: "Aspersión",
  microaspersion: "Microaspersión",
  gravedad: "Gravedad",
  pivote: "Pivote central",
  otro: "Otro",
}

export const MX_STATES = [
  "Aguascalientes", "Baja California", "Baja California Sur", "Campeche", "Chiapas", "Chihuahua",
  "Ciudad de México", "Coahuila", "Colima", "Durango", "Estado de México", "Guanajuato", "Guerrero",
  "Hidalgo", "Jalisco", "Michoacán", "Morelos", "Nayarit", "Nuevo León", "Oaxaca", "Puebla",
  "Querétaro", "Quintana Roo", "San Luis Potosí", "Sinaloa", "Sonora", "Tabasco", "Tamaulipas",
  "Tlaxcala", "Veracruz", "Yucatán", "Zacatecas",
] as const

const code = z
  .string()
  .trim()
  .toUpperCase()
  .max(20, "Máximo 20 caracteres")
  .refine((v) => v === "" || /^[A-Z0-9-]+$/.test(v), "Solo letras, números y guiones")
  .transform((v) => (v === "" ? null : v))

const coordinate = (limit: number) => z
  .string()
  .trim()
  .refine((v) => v === "" || (/^-?\d+(\.\d{1,6})?$/.test(v) && Math.abs(Number(v)) <= limit), "Coordenada no válida")
  .transform((v) => (v === "" ? null : Number(v)))

export const farmSchema = z
  .object({
    id: z.uuid().optional(),
    name: requiredText(2, 120, "El nombre debe tener al menos 2 caracteres"),
    code,
    municipality: optionalText(120),
    state: z
      .string()
      .refine((v) => v === "" || (MX_STATES as readonly string[]).includes(v), "Estado no válido")
      .transform((v) => (v === "" ? null : v)),
    address: optionalText(300),
    totalAreaHa: optionalDecimal({ scale: 2, max: 9_999_999 }),
    latitude: coordinate(90),
    longitude: coordinate(180),
    notes: optionalText(2000),
  })
  .refine((v) => (v.latitude === null) === (v.longitude === null), {
    message: "Captura latitud y longitud juntas",
    path: ["longitude"],
  })

export const plotSchema = z.object({
  id: z.uuid().optional(),
  farmId: requiredId("Selecciona el rancho"),
  name: requiredText(1, 120, "Ingresa el nombre de la parcela"),
  code,
  areaHa: decimal({ scale: 2, max: 9_999_999 }),
  soilType: optionalText(60),
  irrigationType: z.enum(IRRIGATION_TYPES, { error: "Selecciona el tipo de riego" }),
  notes: optionalText(2000),
})

export type FarmInput = z.input<typeof farmSchema>
export type PlotInput = z.input<typeof plotSchema>
