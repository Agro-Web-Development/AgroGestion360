import { existsSync } from "node:fs"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/types/database"

// `npm run demo:jitomate:remoto` (vitest.demo.config.mts --mode remoto) lee .env.demo: el proyecto Supabase de
// demostración para clientes. Todo lo demás usa .env.local.
const remoteDemo = process.env.DEMO_ENV_FILE === ".env.demo"
if (remoteDemo && !existsSync(".env.demo")) throw new Error("Falta .env.demo (ver docs/despliegue.md, «Entorno de demostración»).")
const envFile = remoteDemo ? ".env.demo" : ".env.local"
if (existsSync(envFile)) process.loadEnvFile(envFile)

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321"
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? ""
const secret = process.env.SUPABASE_SECRET_KEY ?? ""

export const PASSWORD = "Prueba12345!"
export type Client = SupabaseClient<Database>

const local = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)
// La única excepción remota: el proyecto de demostración declarado de forma explícita en .env.demo.
const demoRef = process.env.DEMO_REMOTE_REF
const allowedDemo = remoteDemo && !!demoRef && url === `https://${demoRef}.supabase.co`
if (!local && !allowedDemo) {
  // Salvaguarda: estas pruebas crean y eliminan usuarios; nunca contra producción.
  throw new Error(`Las pruebas de integración solo se ejecutan contra Supabase local (URL actual: ${url}).`)
}

const noSession = { auth: { autoRefreshToken: false, persistSession: false } }

export function anonClient(): Client {
  return createClient<Database>(url, publishable, noSession)
}

export function adminClient(): Client {
  if (!secret) throw new Error("Falta SUPABASE_SECRET_KEY en .env.local")
  return createClient<Database>(url, secret, noSession)
}

export async function createUser(email: string, fullName: string): Promise<string> {
  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })
  if (error) throw error
  return data.user.id
}

export async function signIn(email: string): Promise<Client> {
  const client = anonClient()
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw error
  return client
}

/** Elimina las organizaciones (cascada) y los usuarios creados por la prueba. */
export async function cleanup(orgIds: string[], userIds: string[]) {
  const admin = adminClient()
  if (orgIds.length) {
    const { error } = await admin.from("organizations").delete().in("id", orgIds)
    if (error) throw new Error(`No se eliminaron las organizaciones de prueba: ${error.message}`)
  }
  for (const id of userIds) {
    const { error } = await admin.auth.admin.deleteUser(id)
    if (error) throw new Error(`No se eliminó el usuario de prueba ${id}: ${error.message}`)
  }
}

/** Fecha AAAA-MM-DD en la zona de México (la misma regla que la BD). */
export function mxDate(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000)
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(d)
}
