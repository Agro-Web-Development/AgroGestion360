import { getApiSession, isSameOrigin, json } from "@/lib/auth/api-session"
import { processAttachments } from "@/features/offline/server"

/** Registra las fotografías de un registro sincronizado (el archivo ya está en Storage). */
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
  const outcome = await processAttachments(session, body)
  switch (outcome.kind) {
    case "ok":
      return json({ count: outcome.count })
    case "invalid":
      return json({ error: outcome.error }, 400)
    case "rejected":
      return json({ error: outcome.error }, 422)
    case "transient":
      return json({ error: outcome.error }, 503)
  }
}
