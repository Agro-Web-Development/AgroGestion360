import "server-only"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { connection } from "next/server"

import type { Database } from "@/types/database"
import { env } from "@/lib/env"

/** Cliente Supabase para Server Components, Server Actions y Route Handlers. */
export async function createClient() {
  // La sesión depende de la hora actual (expiración del token): solo en tiempo de solicitud.
  await connection()
  const cookieStore = await cookies()

  return createServerClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // Llamado desde un Server Component: el proxy se encarga de refrescar la sesión.
        }
      },
    },
  })
}
