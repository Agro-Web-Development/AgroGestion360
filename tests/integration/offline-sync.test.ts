/**
 * Sincronización de la captura sin conexión (features/offline/server.ts) contra
 * Supabase local, con sesiones reales: idempotencia, conflictos, revalidación
 * de existencias, revisión, permisos, organización incorrecta y fallas de red.
 */
import { randomUUID } from "node:crypto"

import { createClient } from "@supabase/supabase-js"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { processAttachments, processSubmission } from "@/features/offline/server"
import type { Submission } from "@/features/offline/schemas"
import type { ApiSession } from "@/lib/auth/api-session"
import type { AppRole } from "@/lib/auth/roles"
import type { Database } from "@/types/database"
import { cleanup, createUser, mxDate, signIn, type Client } from "../support/supabase"

const stamp = Date.now().toString(36)
const email = (role: string) => `${role}.sync.${stamp}@pruebas.agrogestion360.mx`
const users: string[] = []
const orgs: string[] = []
const ids: Record<string, string> = {}
let owner: Client, campo: Client, consulta: Client
let orgId = "", otherOrg = "", projectId = "", plotId = "", productId = "", warehouseId = ""
const today = mxDate()

function session(client: Client, role: AppRole, userId = ids[role]): ApiSession {
  return { supabase: client, userId, email: "", memberships: [{ organizationId: orgId, organizationName: "Org", role }] }
}

function submission(type: Submission["type"], payload: Record<string, unknown>, overrides: Partial<Submission> = {}): Submission {
  const localId = (payload.id as string) ?? randomUUID()
  return {
    localId,
    organizationId: orgId,
    userId: ids.supervisor,
    type,
    capturedAt: new Date().toISOString(),
    payload: { ...payload, id: localId },
    ...overrides,
  }
}

const irrigation = (id = randomUUID(), extra: Record<string, unknown> = {}) => ({
  id,
  projectId,
  plotId,
  date: today,
  startTime: "06:00",
  endTime: "07:30",
  system: "__none__",
  waterM3: "12.5",
  responsibleId: "__none__",
  notes: "Capturado sin conexión",
  ...extra,
})

const application = (id: string, quantity: string) => ({
  id,
  projectId,
  plotId,
  date: today,
  time: "",
  productId,
  activeIngredient: "",
  quantity,
  treatedArea: "2",
  issueFromStock: true,
  warehouseId,
  lotId: "",
  lotNumber: "",
  responsibleId: "__none__",
  machineId: "__none__",
  equipment: "",
  reentryHours: "",
  preharvestDays: "",
  notes: "",
})

beforeAll(async () => {
  ids.propietario = await createUser(email("propietario"), "Propietario Sync")
  ids.supervisor = await createUser(email("supervisor"), "Supervisor Sync")
  ids.consulta = await createUser(email("consulta"), "Consulta Sync")
  users.push(ids.propietario, ids.supervisor, ids.consulta)
  owner = await signIn(email("propietario"))
  campo = await signIn(email("supervisor"))
  consulta = await signIn(email("consulta"))

  orgId = (await owner.rpc("create_organization", { p_name: `Sync ${stamp}` })).data!
  otherOrg = (await owner.rpc("create_organization", { p_name: `Sync otra ${stamp}` })).data!
  orgs.push(orgId, otherOrg)
  await owner.rpc("invite_member", { p_org: orgId, p_email: email("supervisor"), p_role: "supervisor" })
  await owner.rpc("invite_member", { p_org: orgId, p_email: email("consulta"), p_role: "consulta" })

  const farm = await owner.from("farms").insert({ organization_id: orgId, name: "Rancho" }).select("id").single()
  plotId = (await owner.from("plots").insert({ organization_id: orgId, farm_id: farm.data!.id, name: "P1", area_ha: 10 }).select("id").single()).data!.id
  const crop = await owner.from("crops").insert({ organization_id: orgId, name: "Lechuga" }).select("id").single()
  projectId = (
    await owner.from("projects").insert({ organization_id: orgId, name: "Lechuga", crop_id: crop.data!.id, start_date: mxDate(-20) }).select("id").single()
  ).data!.id
  await owner.from("project_plots").insert({ organization_id: orgId, project_id: projectId, plot_id: plotId, assigned_area_ha: 10 })
  await owner.rpc("change_project_status", { p_project: projectId, p_status: "siembra" })
  await owner.rpc("change_project_status", { p_project: projectId, p_status: "desarrollo" })

  const category = await owner.from("inventory_categories").select("id").eq("organization_id", orgId).eq("kind", "agroquimico").limit(1).single()
  productId = (
    await owner.from("inventory_products").insert({ organization_id: orgId, name: "Fungicida", category_id: category.data!.id, unit: "l" }).select("id").single()
  ).data!.id
  warehouseId = (await owner.from("warehouses").select("id").eq("organization_id", orgId).limit(1).single()).data!.id
  await owner.rpc("register_inventory_movement", {
    p_id: randomUUID(),
    p_product: productId,
    p_type: "entrada",
    p_date: mxDate(-10),
    p_quantity: 5,
    p_unit_cost: 100,
    p_warehouse: warehouseId,
  })
})

afterAll(async () => {
  await cleanup(orgs, users)
})

describe("Sincronización sin conexión", () => {
  const riegoId = randomUUID()

  it("sincroniza un riego y registra la fecha de sincronización", async () => {
    const outcome = await processSubmission(session(campo, "supervisor"), submission("riego", irrigation(riegoId)))
    expect(outcome).toMatchObject({ kind: "result", result: { status: "sincronizado" } })
    const { data } = await campo.from("irrigation_logs").select("id, water_m3").eq("id", riegoId)
    expect(data).toHaveLength(1)
    const { data: log } = await campo.from("offline_submissions").select("status, synced_at, entity_id").eq("id", riegoId).single()
    expect(log).toMatchObject({ status: "sincronizado", entity_id: riegoId })
    expect(log!.synced_at).toBeTruthy()
  })

  it("no duplica al reintentar (idempotencia)", async () => {
    const outcome = await processSubmission(session(campo, "supervisor"), submission("riego", irrigation(riegoId)))
    expect(outcome).toMatchObject({ kind: "result", result: { status: "sincronizado" } })
    const { data } = await campo.from("irrigation_logs").select("id").eq("id", riegoId)
    expect(data).toHaveLength(1)
  })

  it("detecta un conflicto si el mismo id llega con otro contenido", async () => {
    const outcome = await processSubmission(session(campo, "supervisor"), submission("riego", irrigation(riegoId, { waterM3: "99" })))
    expect(outcome).toMatchObject({ kind: "result", result: { status: "requiere_revision", conflict: true } })
    const { data } = await campo.from("irrigation_logs").select("water_m3").eq("id", riegoId).single()
    expect(Number(data!.water_m3)).toBe(12.5)
  })

  it("rechaza datos incompletos o inválidos y los deja en revisión con el detalle", async () => {
    const id = randomUUID()
    const outcome = await processSubmission(session(campo, "supervisor"), submission("riego", irrigation(id, { plotId: "", waterM3: "-3" })))
    expect(outcome.kind).toBe("result")
    if (outcome.kind !== "result" || outcome.result.status !== "requiere_revision") throw new Error("esperaba revisión")
    expect(Object.keys(outcome.result.fieldErrors ?? {})).toEqual(expect.arrayContaining(["plotId", "waterM3"]))
    const { data } = await owner.from("offline_submissions").select("status, last_error").eq("id", id).single()
    expect(data!.status).toBe("requiere_revision")
  })

  it("revalida existencias: no descuenta ni confirma si ya no alcanzan", async () => {
    ids.app = randomUUID()
    const outcome = await processSubmission(session(campo, "supervisor"), submission("aplicacion", application(ids.app, "8")))
    expect(outcome).toMatchObject({ kind: "result", result: { status: "requiere_revision" } })
    const { data: stock } = await owner.from("inventory_products").select("stock").eq("id", productId).single()
    expect(Number(stock!.stock)).toBe(5)
    const { data: apps } = await owner.from("chemical_applications").select("id").eq("id", ids.app)
    expect(apps).toHaveLength(0)
  })

  it("tras corregir la causa, el reintento se sincroniza y descuenta una sola vez", async () => {
    await owner.rpc("register_inventory_movement", {
      p_id: randomUUID(),
      p_product: productId,
      p_type: "entrada",
      p_date: today,
      p_quantity: 10,
      p_unit_cost: 100,
      p_warehouse: warehouseId,
    })
    const sub = submission("aplicacion", application(ids.app, "8"))
    expect(await processSubmission(session(campo, "supervisor"), sub)).toMatchObject({ result: { status: "sincronizado" } })
    expect(await processSubmission(session(campo, "supervisor"), sub)).toMatchObject({ result: { status: "sincronizado" } })
    const { data: stock } = await owner.from("inventory_products").select("stock").eq("id", productId).single()
    expect(Number(stock!.stock)).toBe(7)
    const { data: log } = await owner.from("offline_submissions").select("attempts").eq("id", ids.app).single()
    expect(log!.attempts).toBe(2)
  })

  it("un corte en un proyecto que no está en cosecha queda en revisión", async () => {
    const outcome = await processSubmission(
      session(campo, "supervisor"),
      submission("cosecha", {
        id: randomUUID(),
        projectId,
        plotId,
        date: today,
        cutNumber: "",
        quality: "primera",
        classification: "",
        unit: "kg",
        quantity: "500",
        unitWeightKg: "",
        packages: "",
        responsibleId: "__none__",
        notes: "",
      })
    )
    expect(outcome).toMatchObject({ kind: "result", result: { status: "requiere_revision" } })
  })

  it("un revisor descarta y el dispositivo deja de reintentar", async () => {
    const id = randomUUID()
    await processSubmission(session(campo, "supervisor"), submission("riego", irrigation(id, { date: mxDate(-30) })))
    const { error } = await owner.rpc("discard_offline_submission", { p_id: id, p_note: "Fecha anterior al proyecto" })
    expect(error).toBeNull()
    const outcome = await processSubmission(session(campo, "supervisor"), submission("riego", irrigation(id)))
    expect(outcome).toMatchObject({ kind: "result", result: { status: "requiere_revision", discarded: true } })
    const { data } = await owner.from("irrigation_logs").select("id").eq("id", id)
    expect(data).toHaveLength(0)
  })

  it("rechaza un usuario sin permiso de captura", async () => {
    const id = randomUUID()
    const outcome = await processSubmission(session(consulta, "consulta"), submission("riego", irrigation(id), { userId: ids.consulta }))
    expect(outcome).toMatchObject({ kind: "result", result: { status: "requiere_revision" } })
    const { data } = await owner.from("irrigation_logs").select("id").eq("id", id)
    expect(data).toHaveLength(0)
  })

  it("rechaza registros de otro usuario o de una organización ajena", async () => {
    const other = await processSubmission(session(campo, "supervisor"), submission("riego", irrigation(), { userId: ids.propietario }))
    expect(other).toMatchObject({ kind: "result", result: { status: "requiere_revision" } })
    const foreign = await processSubmission(session(campo, "supervisor"), submission("riego", irrigation(), { organizationId: otherOrg }))
    expect(foreign).toMatchObject({ kind: "result", result: { status: "requiere_revision" } })
  })

  it("rechaza solicitudes mal formadas", async () => {
    expect((await processSubmission(session(campo, "supervisor"), { foo: 1 })).kind).toBe("invalid")
    const mismatch = submission("riego", irrigation())
    mismatch.payload.id = randomUUID()
    expect((await processSubmission(session(campo, "supervisor"), mismatch)).kind).toBe("invalid")
  })

  it("una falla de red es transitoria y no marca nada como sincronizado", async () => {
    const broken = createClient<Database>("http://127.0.0.1:54321", "x", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: () => Promise.reject(new TypeError("fetch failed")) },
    })
    const id = randomUUID()
    const outcome = await processSubmission(session(broken, "supervisor"), submission("riego", irrigation(id)))
    expect(outcome.kind).toBe("transient")
    const { data } = await owner.from("offline_submissions").select("id").eq("id", id)
    expect(data).toHaveLength(0)
  })

  it("sincroniza una observación con su fotografía pendiente", async () => {
    const id = randomUUID()
    const outcome = await processSubmission(
      session(campo, "supervisor"),
      submission("observacion", {
        id,
        projectId,
        plotId: "__none__",
        date: today,
        time: "09:15",
        category: "plaga",
        severity: "alta",
        title: "Gusano cogollero",
        description: "",
        latitude: "20.523456",
        longitude: "-100.812345",
        responsibleId: "__none__",
      })
    )
    expect(outcome).toMatchObject({ result: { status: "sincronizado" } })

    const path = `${orgId}/field_observation/${id}/${randomUUID()}.jpg`
    const upload = await campo.storage.from("evidencias").upload(path, new Blob([new Uint8Array(64)], { type: "image/jpeg" }), { contentType: "image/jpeg" })
    expect(upload.error).toBeNull()
    const file = { path, name: "foto.jpg", type: "image/jpeg" as const, size: 64 }
    const body = { organizationId: orgId, type: "observacion", entityId: id, files: [file] }
    expect(await processAttachments(session(campo, "supervisor"), body)).toEqual({ kind: "ok", count: 1 })
    // Reintento de la carga: no duplica la evidencia.
    expect(await processAttachments(session(campo, "supervisor"), body)).toEqual({ kind: "ok", count: 1 })
    const { data } = await campo.from("attachments").select("id").eq("entity_id", id)
    expect(data).toHaveLength(1)

    const outside = { ...body, files: [{ ...file, path: `${otherOrg}/field_observation/${id}/x.jpg` }] }
    expect((await processAttachments(session(campo, "supervisor"), outside)).kind).toBe("invalid")
  })
})
