import { dbErrorMessage, failure, type ActionResult } from "@/lib/actions"

/** Traducción de los errores de alta de cortes (Server Actions y sincronización sin conexión). */
export function harvestFailure(error: Parameters<typeof dbErrorMessage>[0]): ActionResult<never> {
  if (error.code === "23503") return failure("La parcela no está asignada al proyecto.", { plotId: ["Parcela no válida"] })
  if (error.code === "22023" && error.message.includes("fecha")) return failure(error.message, { date: [error.message] })
  if (error.code === "22023" && error.message.includes("cantidad")) return failure(error.message, { quantity: [error.message] })
  return failure(dbErrorMessage(error))
}
