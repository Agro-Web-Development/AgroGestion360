/**
 * Escenario integral de demostración: «Producción de jitomate» (5 ha,
 * presupuesto de $250,000 MXN) en una organización ficticia. Cada paso usa el
 * rol que lo haría en la operación real y las mismas RPC y tablas que la
 * aplicación, de modo que la RLS y las reglas de negocio aplican igual.
 *
 * Lo usan la prueba de integración (tests/integration/escenario-jitomate.test.ts)
 * y el script de demostración (scripts/demo-jitomate.ts). Las cifras esperadas
 * están calculadas a mano en ESPERADO; si cambias un dato, recalcúlalas.
 */
import { randomUUID } from "node:crypto"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/types/database"

type Client = SupabaseClient<Database>

export type Roles = {
  propietario: Client
  agronomo: Client
  campo: Client
  almacen: Client
  finanzas: Client
}

export type Escenario = {
  orgId: string
  projectId: string
  plotId: string
  saleId: string
  advanceId: string
  lots: string[]
  products: Record<"semilla" | "fertilizante" | "nitrato" | "insecticida" | "diesel", string>
  warehouseId: string
}

/** Fecha AAAA-MM-DD en la zona de México, `days` días antes de hoy. */
export function hace(days: number): string {
  const d = new Date(Date.now() - days * 86_400_000)
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(d)
}

function ok<T>(paso: string, res: { data: T; error: { message: string; code?: string } | null }): NonNullable<T> {
  if (res.error) throw new Error(`${paso}: ${res.error.message} (${res.error.code ?? "sin código"})`)
  return res.data as NonNullable<T>
}

/** Presupuesto inicial por categoría (suma $250,000). */
export const PRESUPUESTO = [
  { category: "semillas", concept: "Semilla de jitomate saladette", unit: "sobre", quantity: 30, unit_cost: 1_000 },
  { category: "fertilizantes", concept: "Fertilización de fondo y fertirriego", unit: "lote", quantity: 1, unit_cost: 45_000 },
  { category: "agroquimicos", concept: "Control fitosanitario", unit: "lote", quantity: 1, unit_cost: 25_000 },
  { category: "riego", concept: "Energía y operación del riego", unit: "mes", quantity: 4, unit_cost: 5_000 },
  { category: "mano_obra", concept: "Jornales y destajo de corte", unit: "lote", quantity: 1, unit_cost: 60_000 },
  { category: "maquinaria", concept: "Preparación de terreno y labores", unit: "h", quantity: 50, unit_cost: 600 },
  { category: "cosecha", concept: "Material de empaque", unit: "lote", quantity: 1, unit_cost: 25_000 },
  { category: "transporte", concept: "Fletes a central de abasto", unit: "viaje", quantity: 5, unit_cost: 3_000 },
] as const

/**
 * Cifras esperadas. Compras de almacén $75,300 (no son costo del proyecto hasta
 * consumirse); consumos y aplicaciones $45,110; maquinaria 6 h × $650 = $3,900;
 * mano de obra 5 días × (400 + 400 + 450) + destajo 300 cajas × $12 = $9,850;
 * gastos directos $4,500 + $3,200 = $7,700. Producción 30,000 kg en 3 cortes y
 * 4 lotes; venta de 14,000 kg ($196,000); anticipo $50,000 aplicado y pago
 * parcial $60,000.
 */
export const ESPERADO = {
  areaHa: 5,
  budget: 250_000,
  purchases: 75_300,
  inputsCost: 45_110,
  machineryCost: 3_900,
  laborCost: 9_850,
  expensesCost: 7_700,
  totalCost: 66_560,
  costPerHa: 13_312,
  costPerKg: 2.2187,
  budgetUsedPct: 26.6,
  byBudgetCategory: {
    semillas: { budget: 30_000, actual: 23_750 },
    fertilizantes: { budget: 45_000, actual: 15_200 },
    agroquimicos: { budget: 25_000, actual: 5_200 },
    combustible: { budget: 0, actual: 960 },
    riego: { budget: 20_000, actual: 4_500 },
    mano_obra: { budget: 60_000, actual: 9_850 },
    maquinaria: { budget: 30_000, actual: 3_900 },
    cosecha: { budget: 25_000, actual: 0 },
    transporte: { budget: 15_000, actual: 3_200 },
  } as Record<string, { budget: number; actual: number }>,
  harvestedKg: 30_000,
  cuts: 3,
  lots: 4,
  shrinkageKg: 200,
  soldKg: 14_000,
  availableKg: 15_800,
  salesAmount: 196_000,
  advance: 50_000,
  partialPayment: 60_000,
  collected: 110_000,
  receivable: 86_000,
  estimatedResult: 129_440,
  stock: {
    semilla: { qty: 5, value: 4_750 },
    fertilizante: { qty: 400, value: 7_200 },
    nitrato: { qty: 300, value: 6_600 },
    insecticida: { qty: 12, value: 7_800 },
    diesel: { qty: 160, value: 3_840 },
  },
  inventoryValue: 30_190,
  cashIn: 110_000,
  cashOut: 75_000,
} as const

/**
 * Carga el escenario en una organización recién creada (catálogos iniciales
 * incluidos) cuyos miembros son los clientes de `r`. Devuelve los ids clave.
 */
export async function cargarEscenario(r: Roles, orgId: string, onStep: (msg: string) => void = () => {}): Promise<Escenario> {
  const { propietario, agronomo, campo, almacen, finanzas } = r

  // --- Rancho, parcela, cultivo, proyecto y presupuesto -----------------------
  onStep("Rancho, parcela, cultivo y proyecto")
  const farm = ok("Rancho", await propietario
    .from("farms")
    .insert({ organization_id: orgId, name: "Rancho El Mirador", total_area_ha: 12, municipality: "Irapuato", state: "Guanajuato" })
    .select("id")
    .single())
  const plot = ok("Parcela", await propietario
    .from("plots")
    .insert({ organization_id: orgId, farm_id: farm.id, name: "Parcela Norte", area_ha: 5, irrigation_type: "goteo" })
    .select("id")
    .single())
  const crop = ok("Cultivo", await propietario
    .from("crops")
    .insert({ organization_id: orgId, name: "Jitomate", variety: "Saladette", cycle_days: 120, yield_unit: "caja" })
    .select("id")
    .single())
  const project = ok("Proyecto", await propietario
    .from("projects")
    .insert({
      organization_id: orgId,
      name: "Producción de jitomate",
      crop_id: crop.id,
      season: "Otoño-invierno 2026",
      start_date: hace(100),
      planting_date: hace(85),
      expected_harvest_date: hace(30),
      expected_yield: 2_000,
      budget_amount: ESPERADO.budget,
    })
    .select("id")
    .single())
  ok("Asignar parcela", await propietario
    .from("project_plots")
    .insert({ organization_id: orgId, project_id: project.id, plot_id: plot.id, assigned_area_ha: 5 }))
  ok("Presupuesto", await finanzas.rpc("save_budget", {
    p_id: randomUUID(),
    p_project: project.id,
    p_lines: [...PRESUPUESTO],
    p_period_start: hace(100),
    p_period_end: hace(-60),
    p_area_ha: 5,
  }))
  for (const status of ["preparacion", "siembra", "desarrollo"] as const) {
    ok(`Estado ${status}`, await propietario.rpc("change_project_status", { p_project: project.id, p_status: status }))
  }

  // --- Compra de semillas y fertilizantes: entrada al almacén ----------------
  onStep("Compras y entradas al almacén")
  const { data: categories } = await almacen.from("inventory_categories").select("id, kind").eq("organization_id", orgId)
  const category = (kind: string) => categories!.find((c) => c.kind === kind)!.id
  const warehouse = ok("Almacén", await almacen.from("warehouses").select("id").eq("organization_id", orgId).limit(1).single())
  const supplier = ok("Proveedor", await almacen
    .from("suppliers")
    .insert({ organization_id: orgId, name: "Semillas y Agroinsumos del Bajío" })
    .select("id")
    .single())
  const fuelSupplier = ok("Proveedor diésel", await almacen
    .from("suppliers")
    .insert({ organization_id: orgId, name: "Combustibles El Sauz" })
    .select("id")
    .single())

  const catalog = [
    ["semilla", "Semilla jitomate saladette (sobre 1,000 semillas)", "semilla", "pieza", 30, 950, supplier.id],
    ["fertilizante", "Fertilizante 18-46-00", "fertilizante", "kg", 1_000, 18, supplier.id],
    ["nitrato", "Nitrato de calcio", "fertilizante", "kg", 500, 22, supplier.id],
    ["insecticida", "Insecticida spirotetramat", "agroquimico", "l", 20, 650, supplier.id],
    ["diesel", "Diésel", "combustible", "l", 200, 24, fuelSupplier.id],
  ] as const
  const products = {} as Escenario["products"]
  for (const [key, name, kind, unit, quantity, unitCost, supplierId] of catalog) {
    const product = ok(`Producto ${name}`, await almacen
      .from("inventory_products")
      .insert({ organization_id: orgId, name, category_id: category(kind), unit })
      .select("id")
      .single())
    products[key] = product.id
    ok(`Entrada ${name}`, await almacen.rpc("register_inventory_movement", {
      p_id: randomUUID(),
      p_product: product.id,
      p_type: "entrada",
      p_date: hace(98),
      p_quantity: quantity,
      p_unit_cost: unitCost,
      p_warehouse: warehouse.id,
      p_supplier: supplierId,
      p_reference: key === "diesel" ? "FAC-D-3381" : "FAC-A-1024",
    }))
  }
  // Pago al proveedor de insumos (egreso de efectivo, no costo del proyecto).
  ok("Pago a proveedor", await finanzas.rpc("register_cash_movement", {
    p_id: randomUUID(),
    p_org: orgId,
    p_kind: "pago_proveedor",
    p_date: hace(95),
    p_amount: 70_500,
    p_method: "transferencia",
    p_concept: "Pago factura FAC-A-1024",
    p_supplier: supplier.id,
    p_reference: "SPEI 4471",
  }))

  // --- Consumo de insumos en el proyecto -------------------------------------
  onStep("Consumo de insumos, riegos y aplicaciones")
  const consumo = (product: string, date: string, quantity: number) =>
    almacen.rpc("register_inventory_movement", {
      p_id: randomUUID(),
      p_product: product,
      p_type: "consumo",
      p_date: date,
      p_quantity: quantity,
      p_warehouse: warehouse.id,
      p_project: project.id,
      p_plot: plot.id,
    })
  ok("Consumo de semilla", await consumo(products.semilla, hace(85), 25))
  ok("Fertilización de fondo", await consumo(products.fertilizante, hace(84), 600))

  // --- Riegos ----------------------------------------------------------------
  for (const days of [80, 70, 60]) {
    ok(`Riego hace ${days} días`, await campo.from("irrigation_logs").insert({
      id: randomUUID(),
      organization_id: orgId,
      project_id: project.id,
      plot_id: plot.id,
      log_date: hace(days),
      start_time: "06:00",
      end_time: "09:00",
      irrigation_system: "goteo",
      water_m3: 120,
    }))
  }

  // --- Aplicaciones documentadas (salen del almacén) -------------------------
  ok("Aplicación de nitrato", await campo.rpc("register_chemical_application", {
    p_id: randomUUID(),
    p_project: project.id,
    p_plot: plot.id,
    p_date: hace(65),
    p_product: products.nitrato,
    p_quantity: 200,
    p_treated_area: 5,
    p_warehouse: warehouse.id,
    p_notes: "Fertirriego",
  }))
  ok("Aplicación de insecticida", await campo.rpc("register_chemical_application", {
    p_id: randomUUID(),
    p_project: project.id,
    p_plot: plot.id,
    p_date: hace(50),
    p_product: products.insecticida,
    p_quantity: 8,
    p_treated_area: 5,
    p_warehouse: warehouse.id,
    p_active_ingredient: "Spirotetramat",
    p_reentry_hours: 24,
    p_preharvest_days: 3,
    p_equipment: "Aspersora de mochila",
  }))

  // --- Trabajadores ----------------------------------------------------------
  onStep("Personal y maquinaria")
  const employees: string[] = []
  for (const [name, wage] of [
    ["Juan Pérez Hernández", 400],
    ["María López García", 400],
    ["Pedro Ramírez Soto", 450],
  ] as const) {
    const e = ok(`Empleado ${name}`, await propietario
      .from("employees")
      .insert({ organization_id: orgId, full_name: name, daily_wage: wage })
      .select("id")
      .single())
    employees.push(e.id)
    ok(`Asignación ${name}`, await agronomo.from("employee_assignments").insert({
      organization_id: orgId,
      employee_id: e.id,
      project_id: project.id,
      plot_id: plot.id,
      start_date: hace(86),
    }))
  }
  for (const days of [86, 75, 64, 53, 42]) {
    for (const employeeId of employees) {
      ok(`Jornal hace ${days} días`, await campo.from("labor_records").insert({
        id: randomUUID(),
        organization_id: orgId,
        project_id: project.id,
        plot_id: plot.id,
        employee_id: employeeId,
        work_date: hace(days),
        activity: "Labores culturales",
        pay_type: "jornal",
        quantity: 1,
        unit_rate: null as unknown as number, // el trigger toma el salario diario
      }))
    }
  }

  // --- Maquinaria con combustible del almacén --------------------------------
  const machine = ok("Tractor", await propietario
    .from("machinery")
    .insert({ organization_id: orgId, name: "Tractor John Deere 5075E", kind: "tractor", hourly_cost: 650 })
    .select("id")
    .single())
  ok("Uso de maquinaria", await agronomo.rpc("register_machinery_usage", {
    p_id: randomUUID(),
    p_machine: machine.id,
    p_project: project.id,
    p_plot: plot.id,
    p_date: hace(88),
    p_hours: 6,
    p_activity: "Barbecho y rastra",
    p_fuel_quantity: 40,
    p_fuel_product: products.diesel,
    p_fuel_warehouse: warehouse.id,
  }))

  // --- Gastos directos -------------------------------------------------------
  onStep("Gastos")
  ok("Gasto energía (pagado)", await finanzas.rpc("register_expense", {
    p_id: randomUUID(),
    p_org: orgId,
    p_date: hace(60),
    p_category: "energia",
    p_cost_category: "riego",
    p_description: "Energía eléctrica para bombeo",
    p_amount: 4_500,
    p_allocation_method: "directo",
    p_allocations: [{ project_id: project.id }],
    p_invoice_ref: "CFE-0925",
    p_payment_method: "transferencia",
    p_payment: { id: randomUUID(), date: hace(58), method: "transferencia" },
  }))
  ok("Gasto flete (por pagar)", await finanzas.rpc("register_expense", {
    p_id: randomUUID(),
    p_org: orgId,
    p_date: hace(10),
    p_category: "fletes",
    p_cost_category: "transporte",
    p_description: "Flete a central de abasto",
    p_amount: 3_200,
    p_allocation_method: "directo",
    p_allocations: [{ project_id: project.id }],
  }))

  // --- Cortes y lotes --------------------------------------------------------
  onStep("Cortes, lotes y mermas")
  ok("Estado cosecha", await propietario.rpc("change_project_status", { p_project: project.id, p_status: "cosecha" }))
  const lots: string[] = []
  for (const [days, quality, boxes] of [
    [30, "primera", 400],
    [20, "primera", 500],
    [20, "segunda", 150],
    [10, "primera", 450],
  ] as const) {
    const id = randomUUID()
    ok(`Corte hace ${days} días (${quality})`, await campo.from("harvests").insert({
      id,
      organization_id: orgId,
      project_id: project.id,
      plot_id: plot.id,
      harvest_date: hace(days),
      quality,
      unit: "caja",
      quantity: boxes,
      unit_weight_kg: 20,
    } as never))
    lots.push(id)
  }
  // Destajo de la cuadrilla de corte (sin empleado de planta).
  ok("Destajo de corte", await campo.from("labor_records").insert({
    id: randomUUID(),
    organization_id: orgId,
    project_id: project.id,
    plot_id: plot.id,
    crew: "Cuadrilla de corte",
    work_date: hace(20),
    activity: "Corte de jitomate",
    pay_type: "destajo",
    quantity: 300,
    unit_label: "caja",
    unit_rate: 12,
  }))
  ok("Merma", await campo.rpc("register_production_adjustment", {
    p_id: randomUUID(),
    p_harvest: lots[3],
    p_type: "merma",
    p_date: hace(9),
    p_quantity_kg: 200,
    p_reason: "Fruta dañada en selección",
  }))

  // --- Venta, anticipo y pago parcial ----------------------------------------
  onStep("Venta, anticipo y pago parcial")
  const customer = ok("Cliente", await finanzas
    .from("customers")
    .insert({ organization_id: orgId, name: "Comercializadora del Centro", customer_type: "mayorista" })
    .select("id")
    .single())
  const saleId = randomUUID()
  ok("Venta en borrador", await finanzas.rpc("save_sale", {
    p_id: saleId,
    p_customer: customer.id,
    p_sale_date: hace(18),
    p_due_date: hace(-15),
    p_items: [
      { harvest_id: lots[0], unit: "caja", quantity: 400, unit_weight_kg: 20, unit_price: 280 },
      { harvest_id: lots[1], unit: "caja", quantity: 300, unit_weight_kg: 20, unit_price: 280 },
    ],
  }))
  const advanceId = randomUUID()
  ok("Anticipo", await finanzas.rpc("register_payment", {
    p_id: advanceId,
    p_sale: saleId,
    p_date: hace(22),
    p_amount: ESPERADO.advance,
    p_method: "transferencia",
    p_kind: "anticipo",
    p_reference: "SPEI 9120",
  }))
  ok("Confirmar venta", await finanzas.rpc("confirm_sale", { p_sale: saleId }))

  return { orgId, projectId: project.id, plotId: plot.id, saleId, advanceId, lots, products, warehouseId: warehouse.id }
}

/** Aplica el anticipo y registra el pago parcial (segunda parte de la cobranza). */
export async function cobrarEscenario(finanzas: Client, e: Escenario) {
  ok("Aplicar anticipo", await finanzas.rpc("apply_advance", { p_id: randomUUID(), p_payment: e.advanceId, p_date: hace(18) }))
  ok("Pago parcial", await finanzas.rpc("register_payment", {
    p_id: randomUUID(),
    p_sale: e.saleId,
    p_date: hace(8),
    p_amount: ESPERADO.partialPayment,
    p_method: "transferencia",
    p_reference: "SPEI 9876",
  }))
}
