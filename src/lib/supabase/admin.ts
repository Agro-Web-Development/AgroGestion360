import "server-only"

import { createClient } from "@supabase/supabase-js"

import type { Database } from "@/types/database"
import { env } from "@/lib/env"

/**
 * Cliente con la clave secreta: ignora RLS. Úsalo solo en el servidor, después
 * de verificar permisos, y únicamente para operaciones de administración de Auth
 * (p. ej. enviar invitaciones por correo).
 */
export function createAdminClient() {
  const secret = process.env.SUPABASE_SECRET_KEY
  if (!secret) {
    throw new Error("Falta SUPABASE_SECRET_KEY en el entorno del servidor.")
  }
  return createClient<Database>(env.supabaseUrl, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
