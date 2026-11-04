import { dbErrorMessage, failure, type ActionResult } from "@/lib/actions"

/**
 * Traducción de los errores de alta de bitácoras a mensajes y campos del
 * formulario. La usan las Server Actions y la sincronización sin conexión.
 */
type DbError = Parameters<typeof dbErrorMessage>[0]

export function plotFailure(error: DbError): ActionResult<never> {
  if (error.code === "23503") return failure("La parcela no está asignada al proyecto.", { plotId: ["Parcela no válida"] })
  if (error.code === "22023" && error.message.includes("fecha")) return failure(error.message, { date: [error.message] })
  return failure(dbErrorMessage(error))
}

export function applicationFailure(error: DbError): ActionResult<never> {
  if (error.code === "22023" && error.message.startsWith("Existencia insuficiente")) {
    return failure(error.message, { quantity: [error.message] })
  }
  if (error.code === "22023" && error.message.includes("superficie")) {
    return failure(error.message, { treatedArea: [error.message] })
  }
  if (error.code === "22023" && /lote/i.test(error.message)) return failure(error.message, { lotId: [error.message] })
  return plotFailure(error)
}
