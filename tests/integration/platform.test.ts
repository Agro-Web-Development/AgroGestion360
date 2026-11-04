/**
 * Pruebas de integración de extremo a extremo de la capa de datos: usuarios
 * reales (correo y contraseña) contra Supabase local, con la clave publicable.
 * Cubren los 18 procesos de la Fase 6, situaciones incorrectas y la separación
 * de organizaciones. Requisito: `npm run db:start`. Ejecutar: `npm run test:integration`.
 */
import { randomUUID } from "node:crypto"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { anonClient, cleanup, createUser, mxDate, PASSWORD, signIn, type Client } from "../support/supabase"

const stamp = Date.now().toString(36)
const email = (role: string) => `${role}.${stamp}@pruebas.agrogestion360.mx`

const users: string[] = []
const orgs: string[] = []
let owner: Client, campo: Client, almacen: Client, finanzas: Client, consulta: Client, otro: Client
let orgA = "", orgB = ""
let farmId = "", plotId = "", cropId = "", projectId = "", projectB = ""
let productId = "", warehouseId = "", employeeId = "", machineId = "", customerId = "", harvestId = "", saleId = ""

const start = mxDate(-40)
const today = mxDate()

beforeAll(async () => {
  for (const [role, name] of [
    ["campo", "Supervisor Prueba"],
    ["almacen", "Almacén Prueba"],
    ["finanzas", "Finanzas Prueba"],
    ["consulta", "Consulta Prueba"],
    ["otro", "Propietario Otra Org"],
  ] as const) {
    users.push(await createUser(email(role), name))
  }
})

afterAll(async () => {
  await cleanup(orgs, users)
})

describe("1. Registro e inicio de sesión", () => {
  it("registra una cuenta y crea su perfil", async () => {
    const { data, error } = await anonClient().auth.signUp({
      email: email("propietario"),
      password: PASSWORD,
      options: { data: { full_name: "Propietaria Prueba" } },
    })
    expect(error).toBeNull()
    expect(data.user?.id).toBeTruthy()
    users.push(data.user!.id)

    owner = await signIn(email("propietario"))
    const { data: profile } = await owner.from("profiles").select("full_name").eq("id", data.user!.id).single()
    expect(profile?.full_name).toBe("Propietaria Prueba")
  })

  it("rechaza una contraseña incorrecta", async () => {
    const { error } = await anonClient().auth.signInWithPassword({ email: email("propietario"), password: "incorrecta1" })
    expect(error).not.toBeNull()
  })

  it("rechaza contraseñas cortas", async () => {
    const { error } = await anonClient().auth.signUp({ email: email("corta"), password: "abc1" })
    expect(error).not.toBeNull()
  })
})

describe("2. Creación de organización y usuarios", () => {
  it("crea la organización con el usuario como propietario", async () => {
    const { data, error } = await owner.rpc("create_organization", { p_name: `Agrícola Prueba ${stamp}` })
    expect(error).toBeNull()
    orgA = data!
    orgs.push(orgA)
    const { data: membership } = await owner.from("memberships").select("role").eq("organization_id", orgA).single()
    expect(membership?.role).toBe("propietario")
    const { data: plan } = await owner.rpc("organization_usage", { p_org: orgA })
    expect((plan as { plan_code: string }).plan_code).toBe("piloto")
  })

  it("agrega miembros con su rol", async () => {
    for (const [role, appRole] of [
      ["campo", "supervisor"],
      ["almacen", "almacen"],
      ["finanzas", "finanzas"],
      ["consulta", "consulta"],
    ] as const) {
      const { data, error } = await owner.rpc("invite_member", { p_org: orgA, p_email: email(role), p_role: appRole })
      expect(error).toBeNull()
      expect(data).toBe("agregado")
    }
    ;[campo, almacen, finanzas, consulta, otro] = await Promise.all(
      ["campo", "almacen", "finanzas", "consulta", "otro"].map((r) => signIn(email(r)))
    )
    const { data, error } = await otro.rpc("create_organization", { p_name: `Otra Agrícola ${stamp}` })
    expect(error).toBeNull()
    orgB = data!
    orgs.push(orgB)
  })

  it("un usuario sin permisos no invita ni se cambia el rol", async () => {
    const invite = await campo.rpc("invite_member", { p_org: orgA, p_email: email("intruso"), p_role: "administrador" })
    expect(invite.error?.code).toBe("42501")
    const { data } = await campo.from("memberships").update({ role: "propietario" }).eq("organization_id", orgA).select("id")
    expect(data ?? []).toHaveLength(0)
  })
})

describe("3–4. Parcelas y proyecto agrícola", () => {
  it("registra rancho, parcela y cultivo", async () => {
    const farm = await owner.from("farms").insert({ organization_id: orgA, name: "Rancho Prueba", total_area_ha: 30 }).select("id").single()
    expect(farm.error).toBeNull()
    farmId = farm.data!.id
    const plot = await owner
      .from("plots")
      .insert({ organization_id: orgA, farm_id: farmId, name: "Parcela 1", area_ha: 20, irrigation_type: "goteo" })
      .select("id")
      .single()
    expect(plot.error).toBeNull()
    plotId = plot.data!.id
    const crop = await owner.from("crops").insert({ organization_id: orgA, name: "Brócoli" }).select("id").single()
    cropId = crop.data!.id
  })

  it("rechaza parcelas que exceden la superficie del rancho o con superficie negativa", async () => {
    const excess = await owner.from("plots").insert({ organization_id: orgA, farm_id: farmId, name: "Excede", area_ha: 15 })
    expect(excess.error).not.toBeNull()
    const negative = await owner.from("plots").insert({ organization_id: orgA, farm_id: farmId, name: "Negativa", area_ha: -2 })
    expect(negative.error?.code).toBe("23514")
  })

  it("crea el proyecto con folio y le asigna la parcela", async () => {
    const project = await owner
      .from("projects")
      .insert({ organization_id: orgA, name: "Brócoli otoño", crop_id: cropId, start_date: start })
      .select("id, code, status")
      .single()
    expect(project.error).toBeNull()
    expect(project.data!.code).toMatch(/^PRY-\d{4}-\d{4}$/)
    expect(project.data!.status).toBe("planeacion")
    projectId = project.data!.id
    const assign = await owner
      .from("project_plots")
      .insert({ organization_id: orgA, project_id: projectId, plot_id: plotId, assigned_area_ha: 20 })
    expect(assign.error).toBeNull()
    for (const status of ["siembra", "desarrollo"] as const) {
      const { error } = await owner.rpc("change_project_status", { p_project: projectId, p_status: status })
      expect(error).toBeNull()
    }
  })

  it("rechaza datos incompletos", async () => {
    const { error } = await owner.from("projects").insert({ organization_id: orgA, name: "Sin cultivo" } as never)
    expect(error).not.toBeNull()
  })
})

describe("5–6. Inventario: entradas, salidas y consumo de insumos", () => {
  it("registra la entrada (compra) sin cargar costo al proyecto", async () => {
    const { data: category } = await almacen
      .from("inventory_categories")
      .select("id")
      .eq("organization_id", orgA)
      .eq("kind", "agroquimico")
      .limit(1)
      .single()
    const product = await almacen
      .from("inventory_products")
      .insert({ organization_id: orgA, name: "Insecticida X", category_id: category!.id, unit: "l" })
      .select("id")
      .single()
    expect(product.error).toBeNull()
    productId = product.data!.id
    const { data: warehouse } = await almacen.from("warehouses").select("id").eq("organization_id", orgA).limit(1).single()
    warehouseId = warehouse!.id

    const entry = await almacen.rpc("register_inventory_movement", {
      p_id: randomUUID(),
      p_product: productId,
      p_type: "entrada",
      p_date: start,
      p_quantity: 100,
      p_unit_cost: 250,
      p_warehouse: warehouseId,
    })
    expect(entry.error).toBeNull()
    const { data: stock } = await almacen.from("inventory_products").select("stock, stock_value").eq("id", productId).single()
    expect(Number(stock!.stock)).toBe(100)
    expect(Number(stock!.stock_value)).toBe(25000)
    const { data: costs } = await owner.from("v_project_costs").select("total_cost").eq("project_id", projectId).single()
    expect(Number(costs!.total_cost)).toBe(0)
  })

  it("el consumo sale a costo promedio y se vuelve costo del proyecto", async () => {
    const id = randomUUID()
    const args = {
      p_id: id,
      p_product: productId,
      p_type: "consumo" as const,
      p_date: today,
      p_quantity: 10,
      p_warehouse: warehouseId,
      p_project: projectId,
      p_plot: plotId,
    }
    expect((await almacen.rpc("register_inventory_movement", args)).error).toBeNull()
    // Solicitud duplicada (reintento con el mismo id): no se descuenta dos veces.
    expect((await almacen.rpc("register_inventory_movement", args)).error).toBeNull()
    const { data: stock } = await almacen.from("inventory_products").select("stock").eq("id", productId).single()
    expect(Number(stock!.stock)).toBe(90)
    const { data: entries } = await owner.from("v_project_cost_entries").select("amount").eq("project_id", projectId)
    expect(entries!.reduce((s, e) => s + Number(e.amount), 0)).toBe(2500)
  })

  it("rechaza existencias insuficientes y cantidades negativas", async () => {
    const insufficient = await almacen.rpc("register_inventory_movement", {
      p_id: randomUUID(),
      p_product: productId,
      p_type: "consumo",
      p_date: today,
      p_quantity: 1000,
      p_warehouse: warehouseId,
      p_project: projectId,
      p_plot: plotId,
    })
    expect(insufficient.error?.code).toBe("22023")
    const negative = await almacen.rpc("register_inventory_movement", {
      p_id: randomUUID(),
      p_product: productId,
      p_type: "entrada",
      p_date: today,
      p_quantity: -5,
      p_unit_cost: 10,
      p_warehouse: warehouseId,
    })
    expect(negative.error).not.toBeNull()
  })

  it("un supervisor de campo no mueve inventario", async () => {
    const { error } = await campo.rpc("register_inventory_movement", {
      p_id: randomUUID(),
      p_product: productId,
      p_type: "entrada",
      p_date: today,
      p_quantity: 5,
      p_unit_cost: 10,
      p_warehouse: warehouseId,
    })
    expect(error?.code).toBe("42501")
  })
})

describe("7–9. Bitácoras, trabajadores y maquinaria", () => {
  it("el supervisor registra una bitácora de riego; consulta no", async () => {
    const values = {
      organization_id: orgA,
      project_id: projectId,
      plot_id: plotId,
      log_date: today,
      start_time: "06:00",
      end_time: "08:30",
      irrigation_system: "goteo" as const,
    }
    expect((await campo.from("irrigation_logs").insert({ ...values, id: randomUUID() })).error).toBeNull()
    expect((await consulta.from("irrigation_logs").insert({ ...values, id: randomUUID() })).error?.code).toBe("42501")
  })

  it("asigna un trabajador al proyecto", async () => {
    const employee = await owner
      .from("employees")
      .insert({ organization_id: orgA, full_name: "Juan Pérez", daily_wage: 450 })
      .select("id")
      .single()
    expect(employee.error).toBeNull()
    employeeId = employee.data!.id
    const assignment = await owner
      .from("employee_assignments")
      .insert({ organization_id: orgA, employee_id: employeeId, project_id: projectId, plot_id: plotId, start_date: today })
    expect(assignment.error).toBeNull()
  })

  it("registra maquinaria y su uso con tarifa congelada", async () => {
    const machine = await owner
      .from("machinery")
      .insert({ organization_id: orgA, name: "Tractor JD", hourly_cost: 600 })
      .select("id")
      .single()
    expect(machine.error).toBeNull()
    machineId = machine.data!.id
    const usage = await owner.rpc("register_machinery_usage", {
      p_id: randomUUID(),
      p_machine: machineId,
      p_project: projectId,
      p_plot: plotId,
      p_date: today,
      p_hours: 3,
    })
    expect(usage.error).toBeNull()
    await owner.from("machinery").update({ hourly_cost: 900 }).eq("id", machineId)
    const { data } = await owner.from("v_project_costs").select("machinery_cost").eq("project_id", projectId).single()
    expect(Number(data!.machinery_cost)).toBe(1800)
  })

  it("rechaza más de 24 horas de un equipo en el día", async () => {
    const { error } = await owner.rpc("register_machinery_usage", {
      p_id: randomUUID(),
      p_machine: machineId,
      p_project: projectId,
      p_plot: plotId,
      p_date: today,
      p_hours: 22,
    })
    expect(error?.code).toBe("22023")
  })
})

describe("10–13. Cortes, lotes, ventas y existencias", () => {
  it("registra un corte que genera su lote", async () => {
    expect((await owner.rpc("change_project_status", { p_project: projectId, p_status: "cosecha" })).error).toBeNull()
    harvestId = randomUUID()
    const harvest = await campo.from("harvests").insert({
      id: harvestId,
      organization_id: orgA,
      project_id: projectId,
      plot_id: plotId,
      harvest_date: today,
      quality: "primera",
      unit: "caja",
      quantity: 100,
      unit_weight_kg: 10,
    } as never)
    expect(harvest.error).toBeNull()
    const { data } = await campo.from("harvests").select("lot_code, quantity_kg, available_kg").eq("id", harvestId).single()
    expect(data!.lot_code).toMatch(/^LOT-\d{4}-\d{4}$/)
    expect(Number(data!.quantity_kg)).toBe(1000)
    expect(Number(data!.available_kg)).toBe(1000)
  })

  it("confirma una venta y descuenta el lote", async () => {
    const customer = await finanzas.from("customers").insert({ organization_id: orgA, name: "Empacadora del Bajío" }).select("id").single()
    expect(customer.error).toBeNull()
    customerId = customer.data!.id
    saleId = randomUUID()
    const sale = await finanzas.rpc("save_sale", {
      p_id: saleId,
      p_customer: customerId,
      p_sale_date: today,
      p_items: [{ harvest_id: harvestId, unit: "kg", quantity: 600, unit_price: 20 }],
      p_confirm: true,
    })
    expect(sale.error).toBeNull()
    const { data } = await finanzas.from("harvests").select("sold_kg, available_kg").eq("id", harvestId).single()
    expect(Number(data!.sold_kg)).toBe(600)
    expect(Number(data!.available_kg)).toBe(400)
  })

  it("rechaza ventas superiores a la producción disponible", async () => {
    const { error } = await finanzas.rpc("save_sale", {
      p_id: randomUUID(),
      p_customer: customerId,
      p_sale_date: today,
      p_items: [{ harvest_id: harvestId, unit: "kg", quantity: 500, unit_price: 20 }],
      p_confirm: true,
    })
    expect(error?.code).toBe("22023")
    const { data } = await finanzas.from("harvests").select("available_kg").eq("id", harvestId).single()
    expect(Number(data!.available_kg)).toBe(400)
  })

  it("el supervisor no ve ventas ni registra ventas", async () => {
    const { data } = await campo.from("sales").select("id").eq("organization_id", orgA)
    expect(data ?? []).toHaveLength(0)
    const { error } = await campo.rpc("save_sale", {
      p_id: randomUUID(),
      p_customer: customerId,
      p_sale_date: today,
      p_items: [{ harvest_id: harvestId, unit: "kg", quantity: 1, unit_price: 1 }],
    })
    expect(error).not.toBeNull()
  })
})

describe("14–17. Pagos, cuentas por cobrar, costos y rentabilidad", () => {
  it("registra un pago parcial y actualiza el saldo", async () => {
    const id = randomUUID()
    const args = { p_id: id, p_sale: saleId, p_date: today, p_amount: 5000, p_method: "transferencia" as const }
    expect((await finanzas.rpc("register_payment", args)).error).toBeNull()
    // Reintento del mismo pago: no se cobra dos veces.
    expect((await finanzas.rpc("register_payment", args)).error).toBeNull()
    const { data } = await finanzas.from("v_sale_balances").select("total, amount_paid, balance, status").eq("id", saleId).single()
    expect(Number(data!.total)).toBe(12000)
    expect(Number(data!.amount_paid)).toBe(5000)
    expect(Number(data!.balance)).toBe(7000)
    expect(data!.status).toBe("parcialmente_pagada")
  })

  it("rechaza pagos superiores al saldo", async () => {
    const { error } = await finanzas.rpc("register_payment", {
      p_id: randomUUID(),
      p_sale: saleId,
      p_date: today,
      p_amount: 7000.01,
      p_method: "efectivo",
    })
    expect(error?.code).toBe("22023")
  })

  it("calcula costos de producción y rentabilidad sin duplicar", async () => {
    const { data } = await owner
      .from("v_project_costs")
      .select("inputs_cost, machinery_cost, total_cost, harvested_kg, sold_kg, sales_amount, collected_amount, receivable_amount, gross_profit, cost_per_kg")
      .eq("project_id", projectId)
      .single()
    expect(Number(data!.inputs_cost)).toBe(2500)
    expect(Number(data!.machinery_cost)).toBe(1800)
    expect(Number(data!.total_cost)).toBe(4300)
    expect(Number(data!.harvested_kg)).toBe(1000)
    expect(Number(data!.sold_kg)).toBe(600)
    expect(Number(data!.sales_amount)).toBe(12000)
    expect(Number(data!.collected_amount)).toBe(5000)
    expect(Number(data!.receivable_amount)).toBe(7000)
    expect(Number(data!.gross_profit)).toBe(7700)
    expect(Number(data!.cost_per_kg)).toBeCloseTo(4.3, 2)
  })

  it("consulta lee la rentabilidad pero no registra pagos", async () => {
    const { data } = await consulta.from("v_project_costs").select("total_cost").eq("project_id", projectId).single()
    expect(Number(data!.total_cost)).toBe(4300)
    const { error } = await consulta.rpc("register_payment", {
      p_id: randomUUID(),
      p_sale: saleId,
      p_date: today,
      p_amount: 1,
      p_method: "efectivo",
    })
    expect(error).not.toBeNull()
  })
})

describe("18. Separación de datos entre organizaciones", () => {
  it("otra organización no ve los datos", async () => {
    for (const table of ["projects", "plots", "harvests", "inventory_products", "sales", "payments", "irrigation_logs", "audit_logs"] as const) {
      const { data } = await otro.from(table).select("id").eq("organization_id", orgA)
      expect(data ?? [], table).toHaveLength(0)
    }
    const { data } = await otro.from("v_project_costs").select("project_id").eq("organization_id", orgA)
    expect(data ?? []).toHaveLength(0)
  })

  it("otra organización no escribe ni ejecuta operaciones sobre los datos", async () => {
    const insert = await otro.from("irrigation_logs").insert({
      id: randomUUID(),
      organization_id: orgA,
      project_id: projectId,
      plot_id: plotId,
      log_date: today,
      start_time: "06:00",
      end_time: "07:00",
      irrigation_system: "goteo",
    })
    expect(insert.error?.code).toBe("42501")
    const update = await otro.from("projects").update({ name: "Hackeado" }).eq("id", projectId).select("id")
    expect(update.data ?? []).toHaveLength(0)
    const movement = await otro.rpc("register_inventory_movement", {
      p_id: randomUUID(),
      p_product: productId,
      p_type: "entrada",
      p_date: today,
      p_quantity: 1,
      p_unit_cost: 1,
    })
    expect(movement.error).not.toBeNull()
    const payment = await otro.rpc("register_payment", { p_id: randomUUID(), p_sale: saleId, p_date: today, p_amount: 1, p_method: "efectivo" })
    expect(payment.error).not.toBeNull()
  })

  it("no se referencian datos de otra organización aunque se conozca el id", async () => {
    const { data: crop } = await otro.from("crops").insert({ organization_id: orgB, name: "Maíz" }).select("id").single()
    const project = await otro
      .from("projects")
      .insert({ organization_id: orgB, name: "Maíz B", crop_id: crop!.id, start_date: start })
      .select("id")
      .single()
    expect(project.error).toBeNull()
    projectB = project.data!.id
    // La parcela es de la organización A: la FK compuesta lo impide.
    const cross = await otro.from("project_plots").insert({ organization_id: orgB, project_id: projectB, plot_id: plotId, assigned_area_ha: 1 })
    expect(cross.error).not.toBeNull()
  })

  it("Storage: no se leen ni suben evidencias de otra organización", async () => {
    const path = `${orgA}/irrigation_log/${randomUUID()}/foto.jpg`
    const upload = await otro.storage.from("evidencias").upload(path, new Blob(["x"], { type: "image/jpeg" }), { contentType: "image/jpeg" })
    expect(upload.error).not.toBeNull()
    const own = await campo.storage.from("evidencias").upload(path, new Blob(["x"], { type: "image/jpeg" }), { contentType: "image/jpeg" })
    expect(own.error).toBeNull()
    const read = await otro.storage.from("evidencias").download(path)
    expect(read.error).not.toBeNull()
    const signed = await otro.storage.from("evidencias").createSignedUrl(path, 60)
    expect(signed.error).not.toBeNull()
  })

  it("Storage: rechaza formatos no permitidos", async () => {
    const path = `${orgA}/irrigation_log/${randomUUID()}/script.html`
    const { error } = await campo.storage.from("evidencias").upload(path, new Blob(["<script>"], { type: "text/html" }), { contentType: "text/html" })
    expect(error).not.toBeNull()
  })
})


describe("Consultas de más de 1,000 filas", () => {
  it("PostgREST corta en 1,000 filas; fetchRows trae todas", async () => {
    const { fetchRows } = await import("@/lib/supabase/rows")
    const rows = Array.from({ length: 1050 }, (_, i) => ({
      id: randomUUID(),
      organization_id: orgA,
      project_id: projectId,
      observation_date: today,
      category: "plaga" as const,
      title: `Monitoreo ${i}`,
    }))
    expect((await campo.from("field_observations").insert(rows)).error).toBeNull()

    const capped = await campo.from("field_observations").select("id").eq("organization_id", orgA).limit(5000)
    expect(capped.data).toHaveLength(1000)

    const all = await fetchRows(campo.from("field_observations").select("id").eq("organization_id", orgA).order("id"), 5000)
    expect(all.error).toBeNull()
    expect(all.data).toHaveLength(1050)
    expect(new Set(all.data!.map((r) => r.id)).size).toBe(1050)
  })
})
