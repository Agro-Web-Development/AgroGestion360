/**
 * Carga el escenario de demostración «Producción de jitomate» en Supabase
 * LOCAL, en una organización ficticia propia (marcada como demo) con usuarios
 * propios: no se mezcla con la organización del seed ni con datos reales.
 * Volver a ejecutarlo reemplaza el escenario anterior.
 *
 *   npm run demo:jitomate
 *
 * Usuarios (contraseña Demo12345!): jitomate.{propietario,agronomo,campo,almacen,finanzas,consulta}@demo.agrogestion360.mx
 *
 * En el proyecto de demostración para clientes: npm run demo:jitomate:remoto (lee .env.demo; DEMO_PASSWORD
 * reemplaza la contraseña común).
 */
import { expect, it } from "vitest"

import { cargarEscenario, cobrarEscenario, ESPERADO } from "../tests/support/escenario-jitomate"
import { adminClient, anonClient } from "../tests/support/supabase"

const ORG_NAME = "Agropecuaria Los Campos · Escenario jitomate"
const PASSWORD = process.env.DEMO_PASSWORD || "Demo12345!"
const ROLES = [
  ["propietario", "propietario", "Laura Campos Méndez"],
  ["agronomo", "agronomo", "Ing. Rafael Ortiz"],
  ["campo", "supervisor", "Martín Juárez"],
  ["almacen", "almacen", "Rosa Delgado"],
  ["finanzas", "finanzas", "C.P. Elena Vargas"],
  ["consulta", "consulta", "Jorge Salinas"],
] as const
const email = (key: string) => `jitomate.${key}@demo.agrogestion360.mx`

it("carga el escenario de demostración", async () => {
  const admin = adminClient()

  // Escenario anterior: se elimina completo (organización y usuarios).
  const { data: previous } = await admin.from("organizations").select("id").eq("name", ORG_NAME)
  if (previous?.length) {
    const { error } = await admin.from("organizations").delete().in("id", previous.map((o) => o.id))
    if (error) throw error
  }
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
  for (const u of list.users.filter((u) => u.email?.startsWith("jitomate.") && u.email.endsWith("@demo.agrogestion360.mx"))) {
    await admin.auth.admin.deleteUser(u.id)
  }

  const clients = {} as Record<(typeof ROLES)[number][0], ReturnType<typeof anonClient>>
  for (const [key, , name] of ROLES) {
    const { error } = await admin.auth.admin.createUser({
      email: email(key),
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: name },
    })
    if (error) throw error
    clients[key] = anonClient()
    const signIn = await clients[key].auth.signInWithPassword({ email: email(key), password: PASSWORD })
    if (signIn.error) throw signIn.error
  }

  const { data: orgId, error } = await clients.propietario.rpc("create_organization", { p_name: ORG_NAME })
  if (error) throw error
  await admin.from("organizations").update({ is_demo: true }).eq("id", orgId)
  for (const [key, role] of ROLES.slice(1)) {
    const invite = await clients.propietario.rpc("invite_member", { p_org: orgId, p_email: email(key), p_role: role })
    if (invite.error) throw invite.error
  }

  const escenario = await cargarEscenario(clients, orgId, (step) => console.log(`· ${step}`))
  await cobrarEscenario(clients.finanzas, escenario)

  const { data: costs } = await clients.propietario.from("v_project_costs").select("total_cost, receivable_amount").eq("project_id", escenario.projectId).single()
  expect(Number(costs!.total_cost)).toBe(ESPERADO.totalCost)
  expect(Number(costs!.receivable_amount)).toBe(ESPERADO.receivable)

  console.log(`\nEscenario cargado en «${ORG_NAME}».`)
  console.log(`Expediente: /proyectos/${escenario.projectId}`)
  console.log(`Usuarios (contraseña ${PASSWORD}):`)
  for (const [key, role] of ROLES) console.log(`  ${email(key).padEnd(44)} ${role}`)
})
