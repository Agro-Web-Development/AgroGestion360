import { createBrowserClient } from "@supabase/ssr"

import type { Database } from "@/types/database"
import { env } from "@/lib/env"

/** Cliente Supabase para Client Components (usa solo la clave publicable). */
export function createClient() {
  return createBrowserClient<Database>(env.supabaseUrl, env.supabasePublishableKey)
}
