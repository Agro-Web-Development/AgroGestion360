import type { PostgrestError } from "@supabase/supabase-js"
import type { z } from "zod"

export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> }

export function success<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, data, message }
}

export function failure(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error, fieldErrors }
}

export function validationFailure(error: z.ZodError): ActionResult<never> {
  const fieldErrors: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_"
    ;(fieldErrors[key] ??= []).push(issue.message)
  }
  return failure("Revisa los datos marcados en el formulario.", fieldErrors)
}

/** Códigos con mensaje propio (RAISE EXCEPTION en español desde las funciones SQL). */
const PASSTHROUGH_CODES = new Set(["22023", "23505", "P0001", "P0002"])

/** Traduce errores de PostgREST/PostgreSQL a mensajes claros para el usuario. */
export function dbErrorMessage(error: Pick<PostgrestError, "code" | "message">): string {
  if (error.code === "42501") {
    return error.message && !error.message.startsWith("permission denied") && !error.message.includes("row-level security")
      ? error.message
      : "No tienes permiso para realizar esta operación."
  }
  if (error.code && PASSTHROUGH_CODES.has(error.code)) {
    if (error.code === "23505" && error.message.startsWith("duplicate key")) {
      return "Ya existe un registro con esos datos."
    }
    return error.message
  }
  if (error.code === "23503") return "El registro está relacionado con información que no existe o no puede eliminarse."
  if (error.code === "23514") return "Algún dato no cumple las reglas de validación."
  return "Ocurrió un error inesperado. Intenta de nuevo."
}

/**
 * Las altas de registros operativos llevan un id generado en el cliente. Si un
 * reintento (doble clic, red intermitente) choca con la llave primaria, el
 * registro ya quedó guardado y no debe duplicarse ni reportarse como error.
 */
export function isDuplicateId(error: Pick<PostgrestError, "code" | "message">): boolean {
  return error.code === "23505" && error.message.includes('_pkey"')
}

/**
 * Clases de error de PostgreSQL que expresan una regla de negocio o de acceso
 * (datos inválidos, existencias insuficientes, proyecto cerrado, sin permiso…):
 * reintentar sin cambiar nada daría el mismo resultado. Cualquier otro error
 * (red, tiempo de espera, interbloqueo, servicio no disponible) es transitorio.
 */
export function isRetryableDbError(error: Pick<PostgrestError, "code">): boolean {
  const code = error.code ?? ""
  if (code === "42501" || code === "P0001" || code === "P0002") return false
  if (code.startsWith("22") || code.startsWith("23")) return false
  return true
}
