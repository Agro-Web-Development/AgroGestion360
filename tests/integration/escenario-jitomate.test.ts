/**
 * Auditoría integral · escenario completo «Producción de jitomate» con usuarios
 * reales de cada rol contra Supabase local. Verifica que inventario, bitácoras,
 * personal, maquinaria, gastos, producción, ventas y cobranza se integran en el
 * expediente del proyecto y que los cálculos financieros cuadran con cifras
 * calculadas a mano (ESPERADO). La organización es ficticia y se elimina al
 * terminar. Requisito: `npm run db:start`. Ejecutar: `npm run test:integration`.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { cargarEscenario, cobrarEscenario, ESPERADO, hace, type Escenario, type Roles } from "../support/escenario-jitomate"
import { cleanup, createUser, signIn, type Client } from "../support/supabase"

const stamp = Date.now().toString(36)
const email = (role: string) => `${role}.jitomate.${stamp}@pruebas.agrogestion360.mx`

const users: string[] = []
const orgs: string[] = []
let r: Roles
let consulta: Client, otro: Client
let e: Escenario

const n = (v: unknown) => Number(v ?? 0)

beforeAll(async () => {
  for (const role of ["propietario", "agronomo", "campo", "almacen", "finanzas", "consulta", "otro"]) {
    users.push(await createUser(email(role), `Usuario ${role}`))
  }
  const [propietario, agronomo, campo, almacen, finanzas] = await Promise.all(
    ["propietario", "agronomo", "campo", "almacen", "finanzas"].map((x) => signIn(email(x)))
  )
  ;[consulta, otro] = await Promise.all([signIn(email("consulta")), signIn(email("otro"))])
  r = { propietario, agronomo, campo, almacen, finanzas }

  const { data: orgId, error } = await propietario.rpc("create_organization", { p_name: `Agropecuaria Los Campos · prueba ${stamp}` })
  if (error) throw error
  orgs.push(orgId)
  for (const [role, appRole] of [
    ["agronomo", "agronomo"],
    ["campo", "supervisor"],
    ["almacen", "almacen"],
    ["finanzas", "finanzas"],
    ["consulta", "consulta"],
  ] as const) {
    const { error: inviteError } = await propietario.rpc("invite_member", { p_org: orgId, p_email: email(role), p_role: appRole })
    if (inviteError) throw inviteError
  }
  const other = await otro.rpc("create_organization", { p_name: `Otra organización · prueba ${stamp}` })
  if (other.error) throw other.error
  orgs.push(other.data)

  e = await cargarEscenario(r, orgId)
}, 120_000)

afterAll(async () => {
  // También comprueba que una organización con historial completo se puede eliminar.
  await cleanup(orgs, users)
})

describe("Inventario: compras, consumos y existencias", () => {
  it("las compras entran al almacén con su valor y no son costo del proyecto", async () => {
    const { data } = await r.almacen.from("inventory_products").select("id, stock, stock_value").eq("organization_id", e.orgId)
    const byId = new Map(data!.map((p) => [p.id, p]))
    for (const [key, expected] of Object.entries(ESPERADO.stock)) {
      const p = byId.get(e.products[key as keyof Escenario["products"]])!
      expect(n(p.stock), key).toBe(expected.qty)
      expect(n(p.stock_value), key).toBe(expected.value)
    }
    expect(data!.reduce((s, p) => s + n(p.stock_value), 0)).toBe(ESPERADO.inventoryValue)

    const { data: entries } = await r.almacen
      .from("inventory_movements")
      .select("total_cost")
      .eq("organization_id", e.orgId)
      .eq("movement_type", "entrada")
    expect(entries!.reduce((s, m) => s + n(m.total_cost), 0)).toBe(ESPERADO.purchases)
  })

  it("compras = consumos + existencias (nada se pierde ni se duplica)", () => {
    expect(ESPERADO.inputsCost + ESPERADO.inventoryValue).toBe(ESPERADO.purchases)
  })

  it("las existencias por almacén cuadran con el total del producto", async () => {
    const { data } = await r.almacen.from("v_inventory_stock").select("product_id, quantity").eq("organization_id", e.orgId)
    const diesel = data!.filter((s) => s.product_id === e.products.diesel)
    expect(diesel.reduce((s, x) => s + n(x.quantity), 0)).toBe(ESPERADO.stock.diesel.qty)
  })
})

describe("Expediente del proyecto: bitácoras, personal, maquinaria y producción", () => {
  it("la cronología integra riegos, aplicaciones, jornadas, maquinaria, insumos y cortes", async () => {
    const { data } = await r.propietario.from("v_project_timeline").select("kind, amount, cancelled").eq("project_id", e.projectId)
    const count = (kind: string) => data!.filter((t) => t.kind === kind).length
    expect(count("riego")).toBe(3)
    expect(count("aplicacion")).toBe(2)
    expect(count("mano_obra")).toBe(16)
    expect(count("maquinaria")).toBe(1)
    // Las salidas ligadas a aplicaciones y al combustible no se repiten como «insumo».
    expect(count("insumo")).toBe(2)
    expect(count("cosecha")).toBe(4)
    // Todo costo operativo aparece en la cronología (los gastos administrativos no).
    const amounts = data!.filter((t) => !t.cancelled).reduce((s, t) => s + n(t.amount), 0)
    expect(amounts).toBe(ESPERADO.totalCost - ESPERADO.expensesCost)
  })

  it("el personal asignado y la operación se consultan desde el proyecto", async () => {
    const { data: assignments } = await r.propietario.from("employee_assignments").select("id").eq("project_id", e.projectId)
    expect(assignments).toHaveLength(3)
    const { data: irrigation } = await r.propietario.from("irrigation_logs").select("water_m3").eq("project_id", e.projectId)
    expect(irrigation!.reduce((s, i) => s + n(i.water_m3), 0)).toBe(360)
    const { data: apps } = await r.propietario
      .from("chemical_applications")
      .select("inventory_movement_id, preharvest_days")
      .eq("project_id", e.projectId)
    expect(apps!.every((a) => a.inventory_movement_id)).toBe(true)
  })

  it("producción: cortes, lotes, mermas, vendido y disponible", async () => {
    const { data: lots } = await r.campo
      .from("harvests")
      .select("lot_code, cut_number, quantity_kg, sold_kg, adjusted_kg, available_kg")
      .eq("project_id", e.projectId)
    expect(lots).toHaveLength(ESPERADO.lots)
    expect(new Set(lots!.map((l) => l.cut_number)).size).toBe(ESPERADO.cuts)
    expect(lots!.every((l) => /^LOT-\d{4}-\d{4}$/.test(l.lot_code))).toBe(true)
    expect(lots!.reduce((s, l) => s + n(l.quantity_kg), 0)).toBe(ESPERADO.harvestedKg)
    expect(lots!.reduce((s, l) => s + n(l.sold_kg), 0)).toBe(ESPERADO.soldKg)
    expect(lots!.reduce((s, l) => s + n(l.adjusted_kg), 0)).toBe(ESPERADO.shrinkageKg)
    expect(lots!.reduce((s, l) => s + n(l.available_kg), 0)).toBe(ESPERADO.availableKg)
  })

  it("trazabilidad: cada partida vendida apunta a su lote, parcela y proyecto", async () => {
    const { data } = await r.finanzas.from("v_sale_lot_trace").select("harvest_id, plot_id, project_id, quantity_kg, amount").eq("sale_id", e.saleId)
    expect(data).toHaveLength(2)
    expect(data!.every((t) => t.project_id === e.projectId && t.plot_id === e.plotId)).toBe(true)
    expect(data!.reduce((s, t) => s + n(t.quantity_kg), 0)).toBe(ESPERADO.soldKg)
    expect(data!.reduce((s, t) => s + n(t.amount), 0)).toBe(ESPERADO.salesAmount)
  })
})

describe("Venta, anticipo y cobranza", () => {
  it("antes de aplicar el anticipo: se recibió dinero, pero la venta no está cobrada", async () => {
    const { data: sale } = await r.finanzas
      .from("v_sale_balances")
      .select("status, total, amount_paid, advance_balance, balance")
      .eq("id", e.saleId)
      .single()
    expect(sale!.status).toBe("confirmada")
    expect(n(sale!.total)).toBe(ESPERADO.salesAmount)
    expect(n(sale!.amount_paid)).toBe(0)
    expect(n(sale!.advance_balance)).toBe(ESPERADO.advance)
    expect(n(sale!.balance)).toBe(ESPERADO.salesAmount)

    const { data: cash } = await r.finanzas.rpc("cash_flow_entries", { p_org: e.orgId, p_from: hace(120), p_to: hace(0) })
    const advance = cash!.filter((c) => c.kind === "anticipo_cliente")
    expect(advance.reduce((s, c) => s + n(c.amount), 0)).toBe(ESPERADO.advance)
  })

  it("no se puede cobrar más del saldo no cubierto por anticipos", async () => {
    const { error } = await r.finanzas.rpc("register_payment", {
      p_id: crypto.randomUUID(),
      p_sale: e.saleId,
      p_date: hace(8),
      p_amount: ESPERADO.salesAmount - ESPERADO.advance + 1,
      p_method: "efectivo",
    })
    expect(error?.code).toBe("22023")
  })

  it("aplica el anticipo, registra el pago parcial y deja el saldo pendiente", async () => {
    await cobrarEscenario(r.finanzas, e)
    const { data: sale } = await r.finanzas
      .from("v_sale_balances")
      .select("status, payment_status, amount_paid, advance_balance, balance")
      .eq("id", e.saleId)
      .single()
    expect(sale!.status).toBe("parcialmente_pagada")
    expect(sale!.payment_status).toBe("parcial")
    expect(n(sale!.amount_paid)).toBe(ESPERADO.collected)
    expect(n(sale!.advance_balance)).toBe(0)
    expect(n(sale!.balance)).toBe(ESPERADO.receivable)
  })

  it("el flujo de efectivo cuenta el dinero una sola vez (anticipo al recibirse, no al aplicarse)", async () => {
    const { data: cash } = await r.finanzas.rpc("cash_flow_entries", { p_org: e.orgId, p_from: hace(120), p_to: hace(0) })
    const sum = (dir: string) => cash!.filter((c) => c.direction === dir).reduce((s, c) => s + n(c.amount), 0)
    expect(sum("ingreso")).toBe(ESPERADO.cashIn)
    expect(sum("egreso")).toBe(ESPERADO.cashOut)
  })
})

describe("Validación financiera del proyecto", () => {
  it("presupuesto, costos acumulados, por hectárea y por kilogramo", async () => {
    const { data: c } = await r.propietario.from("v_project_costs").select("*").eq("project_id", e.projectId).single()
    expect(n(c!.budget_amount)).toBe(ESPERADO.budget)
    expect(n(c!.area_ha)).toBe(ESPERADO.areaHa)
    expect(n(c!.inputs_cost)).toBe(ESPERADO.inputsCost)
    expect(n(c!.machinery_cost)).toBe(ESPERADO.machineryCost)
    expect(n(c!.labor_cost)).toBe(ESPERADO.laborCost)
    expect(n(c!.expenses_cost)).toBe(ESPERADO.expensesCost)
    expect(n(c!.total_cost)).toBe(ESPERADO.totalCost)
    expect(n(c!.cost_per_ha)).toBe(ESPERADO.costPerHa)
    expect(n(c!.cost_per_kg)).toBe(ESPERADO.costPerKg)
    expect(n(c!.budget_used_pct)).toBe(ESPERADO.budgetUsedPct)
    expect(n(c!.budget_variance)).toBe(ESPERADO.budget - ESPERADO.totalCost)
    expect(c!.budget_status).toBe("normal")
  })

  it("producción acumulada, disponible y vendida; ventas, cobrado, por cobrar y resultado", async () => {
    const { data: c } = await r.propietario.from("v_project_costs").select("*").eq("project_id", e.projectId).single()
    expect(n(c!.harvested_kg)).toBe(ESPERADO.harvestedKg)
    expect(n(c!.available_kg)).toBe(ESPERADO.availableKg)
    expect(n(c!.sold_kg)).toBe(ESPERADO.soldKg)
    expect(n(c!.shrinkage_kg)).toBe(ESPERADO.shrinkageKg)
    expect(n(c!.cuts)).toBe(ESPERADO.cuts)
    expect(n(c!.lots)).toBe(ESPERADO.lots)
    expect(n(c!.sales_amount)).toBe(ESPERADO.salesAmount)
    expect(n(c!.collected_amount)).toBe(ESPERADO.collected)
    expect(n(c!.receivable_amount)).toBe(ESPERADO.receivable)
    expect(n(c!.estimated_result)).toBe(ESPERADO.estimatedResult)
    // Las ventas no se confunden con lo cobrado: el resultado usa ventas, no cobros.
    expect(n(c!.estimated_result)).toBe(n(c!.sales_amount) - n(c!.total_cost))
    expect(n(c!.collected_amount) + n(c!.receivable_amount)).toBe(n(c!.sales_amount))
  })

  it("costos por categoría presupuestal contra el presupuesto", async () => {
    const { data } = await r.propietario.from("v_budget_comparison").select("category, budget_amount, actual_amount").eq("project_id", e.projectId)
    const rows = new Map(data!.map((x) => [x.category!, x]))
    for (const [category, expected] of Object.entries(ESPERADO.byBudgetCategory)) {
      expect(n(rows.get(category as never)?.budget_amount), category).toBe(expected.budget)
      expect(n(rows.get(category as never)?.actual_amount), category).toBe(expected.actual)
    }
    expect(data!.reduce((s, x) => s + n(x.budget_amount), 0)).toBe(ESPERADO.budget)
    expect(data!.reduce((s, x) => s + n(x.actual_amount), 0)).toBe(ESPERADO.totalCost)
  })

  it("sin costos duplicados: cada registro de origen aparece una vez", async () => {
    const { data } = await r.propietario
      .from("v_project_cost_entries")
      .select("source, origin_table, source_id, amount")
      .eq("project_id", e.projectId)
    const keys = data!.map((x) => `${x.origin_table}:${x.source_id}`)
    expect(new Set(keys).size).toBe(keys.length)
    // 2 consumos + 2 aplicaciones + 1 combustible + 1 maquinaria + 16 jornadas/destajo + 2 gastos
    expect(data).toHaveLength(24)
    expect(data!.reduce((s, x) => s + n(x.amount), 0)).toBe(ESPERADO.totalCost)
    // Las compras (entradas) y los pagos a proveedores no son costo del proyecto.
    expect(data!.some((x) => x.origin_table === "cash_movements")).toBe(false)
  })

  it("los indicadores de la organización coinciden con el proyecto", async () => {
    const { data: fin } = await r.propietario.rpc("finance_summary", { p_org: e.orgId })
    const f = fin as Record<string, number>
    expect(n(f.total_cost)).toBe(ESPERADO.totalCost)
    expect(n(f.sales_total)).toBe(ESPERADO.salesAmount)
    expect(n(f.collected)).toBe(ESPERADO.collected)
    expect(n(f.receivable)).toBe(ESPERADO.receivable)
    expect(n(f.harvested_kg)).toBe(ESPERADO.harvestedKg)
    expect(n(f.available_kg)).toBe(ESPERADO.availableKg)
    expect(n(f.inventory_value)).toBe(ESPERADO.inventoryValue)

    const { data: com } = await r.propietario.rpc("commercial_summary", { p_org: e.orgId, p_from: hace(120), p_to: hace(0) })
    const c = com as Record<string, number>
    expect(n(c.production_kg)).toBe(ESPERADO.harvestedKg)
    expect(n(c.sold_kg)).toBe(ESPERADO.soldKg)
    expect(n(c.sales_total)).toBe(ESPERADO.salesAmount)
    expect(n(c.collected)).toBe(ESPERADO.collected)
    expect(n(c.receivable)).toBe(ESPERADO.receivable)
  })

  it("el gasto pendiente de pago es costo, pero no egreso", async () => {
    const { data } = await r.finanzas.from("expenses").select("amount, paid_amount").eq("organization_id", e.orgId)
    expect(data!.reduce((s, x) => s + n(x.amount), 0)).toBe(ESPERADO.expensesCost)
    expect(data!.reduce((s, x) => s + n(x.paid_amount), 0)).toBe(4_500)
  })
})

describe("Seguridad: roles, organizaciones e historial", () => {
  it("consulta lee el expediente financiero, pero no registra operaciones", async () => {
    const { data } = await consulta.from("v_project_costs").select("total_cost").eq("project_id", e.projectId).single()
    expect(n(data!.total_cost)).toBe(ESPERADO.totalCost)
    const pay = await consulta.rpc("register_payment", {
      p_id: crypto.randomUUID(),
      p_sale: e.saleId,
      p_date: hace(1),
      p_amount: 1,
      p_method: "efectivo",
    })
    expect(pay.error).not.toBeNull()
    const move = await consulta.rpc("register_inventory_movement", {
      p_id: crypto.randomUUID(),
      p_product: e.products.diesel,
      p_type: "consumo",
      p_date: hace(1),
      p_quantity: 1,
      p_warehouse: e.warehouseId,
      p_project: e.projectId,
      p_plot: e.plotId,
    })
    expect(move.error?.code).toBe("42501")
  })

  it("el supervisor de campo no ve importes de ventas ni costos", async () => {
    const { data: sales } = await r.campo.from("sales").select("id").eq("organization_id", e.orgId)
    expect(sales ?? []).toHaveLength(0)
    const { data: payments } = await r.campo.from("payments").select("id").eq("organization_id", e.orgId)
    expect(payments ?? []).toHaveLength(0)
    const { data: expenses } = await r.campo.from("expenses").select("id").eq("organization_id", e.orgId)
    expect(expenses ?? []).toHaveLength(0)
  })

  it("almacén no registra pagos ni gastos", async () => {
    const pay = await r.almacen.rpc("register_payment", {
      p_id: crypto.randomUUID(),
      p_sale: e.saleId,
      p_date: hace(1),
      p_amount: 1,
      p_method: "efectivo",
    })
    expect(pay.error).not.toBeNull()
    const exp = await r.almacen.rpc("register_expense", {
      p_id: crypto.randomUUID(),
      p_org: e.orgId,
      p_date: hace(1),
      p_category: "otros",
      p_cost_category: "otros",
      p_description: "Intento no autorizado",
      p_amount: 10,
      p_allocation_method: "directo",
      p_allocations: [{ project_id: e.projectId }],
    })
    expect(exp.error?.code).toBe("42501")
  })

  it("otra organización no ve ni modifica nada del escenario", async () => {
    for (const table of [
      "projects", "harvests", "sales", "payments", "expenses", "cash_movements", "inventory_movements",
      "labor_records", "machinery_usage", "chemical_applications", "project_budgets", "audit_logs",
    ] as const) {
      const { data } = await otro.from(table).select("id").eq("organization_id", e.orgId)
      expect(data ?? [], table).toHaveLength(0)
    }
    for (const view of ["v_project_costs", "v_project_cost_entries", "v_budget_comparison", "v_project_timeline"] as const) {
      const { data } = await otro.from(view).select("project_id").eq("project_id", e.projectId)
      expect(data ?? [], view).toHaveLength(0)
    }
    const { data: summary } = await otro.rpc("finance_summary", { p_org: e.orgId })
    expect(n((summary as Record<string, number>).total_cost)).toBe(0)
    const apply = await otro.rpc("apply_advance", { p_id: crypto.randomUUID(), p_payment: e.advanceId })
    expect(apply.error).not.toBeNull()
  })

  it("el historial de modificaciones registra las operaciones financieras y de inventario", async () => {
    const { data } = await r.propietario.from("audit_logs").select("table_name, action, actor_id").eq("organization_id", e.orgId)
    const tables = new Set(data!.map((a) => a.table_name))
    for (const t of ["sales", "payments", "advance_applications", "expenses", "cash_movements", "inventory_movements", "harvests", "project_budgets"]) {
      expect(tables.has(t), t).toBe(true)
    }
    expect(data!.every((a) => a.action !== "INSERT" || a.actor_id)).toBe(true)
    // Solo propietario y administrador leen el historial.
    const { data: hidden } = await r.finanzas.from("audit_logs").select("id").eq("organization_id", e.orgId)
    expect(hidden ?? []).toHaveLength(0)
  })
})
