import { getApiSession, isSameOrigin, json } from "@/lib/auth/api-session"
import { processSubmission } from "@/features/offline/server"

/**
 * Recibe un registro capturado sin conexión. Es un Route Handler (no una
 * Server Action) para que su URL no cambie entre despliegues: un dispositivo
 * con la página en caché de una versión anterior puede seguir sincronizando.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return json({ error: "Origen no permitido." }, 403)
  const session = await getApiSession()
  if (!session) return json({ error: "Tu sesión expiró. Inicia sesión para sincronizar." }, 401)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: "Solicitud no válida." }, 400)
  }
  const outcome = await processSubmission(session, body)
  switch (outcome.kind) {
    case "result":
      return json(outcome.result)
    case "invalid":
      return json({ error: outcome.error }, 400)
    case "transient":
      return json({ error: outcome.error }, 503)
  }
}
