import { z } from "zod"

/**
 * Esquemas reutilizables para formularios. Los campos llegan como texto desde
 * los inputs; aquí se validan y se convierten al tipo que espera la base de datos.
 */

export const requiredText = (min: number, max: number, message = `Mínimo ${min} caracteres`) =>
  z.string().trim().min(min, message).max(max, `Máximo ${max} caracteres`)

/** Convierte cadenas vacías en null para columnas opcionales. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .transform((v) => (v === "" ? null : v))

const DECIMAL_REGEX = /^\d+(\.\d+)?$/

type DecimalOptions = { scale: number; min?: number; max?: number; allowZero?: boolean }

function checkDecimal(v: string, { scale, min, max, allowZero }: DecimalOptions, ctx: z.RefinementCtx) {
  const normalized = v.replace(/,/g, "")
  if (!DECIMAL_REGEX.test(normalized)) {
    ctx.addIssue({ code: "custom", message: "Ingresa un número válido" })
    return
  }
  const decimals = normalized.split(".")[1]?.length ?? 0
  if (decimals > scale) {
    ctx.addIssue({ code: "custom", message: `Máximo ${scale} decimales` })
    return
  }
  const n = Number(normalized)
  if (!allowZero && n === 0) ctx.addIssue({ code: "custom", message: "Debe ser mayor que cero" })
  if (min !== undefined && n < min) ctx.addIssue({ code: "custom", message: `Mínimo ${min}` })
  if (max !== undefined && n > max) ctx.addIssue({ code: "custom", message: `Máximo ${max.toLocaleString("es-MX")}` })
}

/** Número decimal positivo obligatorio (acepta separadores de miles con coma). */
export const decimal = (options: DecimalOptions) =>
  z
    .string()
    .trim()
    .min(1, "Campo obligatorio")
    .superRefine((v, ctx) => checkDecimal(v, options, ctx))
    .transform((v) => Number(v.replace(/,/g, "")))

/** Número decimal opcional: vacío → null. */
export const optionalDecimal = (options: DecimalOptions) =>
  z
    .string()
    .trim()
    .superRefine((v, ctx) => {
      if (v !== "") checkDecimal(v, options, ctx)
    })
    .transform((v) => (v === "" ? null : Number(v.replace(/,/g, ""))))

export const optionalInteger = (min: number, max: number) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d+$/.test(v), "Ingresa un número entero")
    .refine((v) => v === "" || (Number(v) >= min && Number(v) <= max), `Entre ${min} y ${max}`)
    .transform((v) => (v === "" ? null : Number(v)))

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

const isValidDate = (v: string) => DATE_REGEX.test(v) && !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime())

export const requiredDate = (message = "Selecciona una fecha") =>
  z.string().trim().min(1, message).refine(isValidDate, "Fecha no válida")

export const optionalDate = () =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || isValidDate(v), "Fecha no válida")
    .transform((v) => (v === "" ? null : v))

/** Valor centinela para "ninguno" en selects (Radix no admite value=""). */
export const NONE = "__none__"

export const optionalId = () =>
  z
    .string()
    .transform((v) => (v === "" || v === NONE ? null : v))
    .pipe(z.uuid("Selección no válida").nullable())

export const requiredId = (message: string) => z.string({ error: message }).min(1, message).pipe(z.uuid(message))

/** Convierte un número de la BD (puede llegar como number o string) al texto del formulario. */
export function toInput(value: number | string | null | undefined): string {
  return value === null || value === undefined ? "" : String(value)
}
