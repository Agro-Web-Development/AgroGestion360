import { activeMembership, getApiSession, json } from "@/lib/auth/api-session"
import { getOfflineCatalog } from "@/features/offline/catalog"

/** Sesión y catálogos para la captura sin conexión (respuesta privada, sin caché). */
export async function GET() {
  const session = await getApiSession()
  if (!session) return json({ error: "Tu sesión expiró. Inicia sesión de nuevo." }, 401)
  const membership = await activeMembership(session)
  if (!membership) return json({ error: "No perteneces a ninguna organización." }, 403)
  try {
    return json(await getOfflineCatalog(session, membership))
  } catch {
    return json({ error: "No fue posible cargar los catálogos de campo." }, 503)
  }
}
