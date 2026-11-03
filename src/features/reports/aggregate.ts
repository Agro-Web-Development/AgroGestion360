/**
 * Agregaciones de los reportes operativos. Funciones puras: reciben los
 * registros ya filtrados por organización, periodo y proyecto, y devuelven
 * renglones listos para mostrar o exportar.
 */

type Num = number | string | null | undefined

const toNumber = (v: Num) => (v === null || v === undefined || v === "" ? 0 : Number(v))

/** Suma redondeada (evita residuos de punto flotante en importes y cantidades). */
export function sum<T>(rows: readonly T[], value: (r: T) => Num, decimals = 2): number {
  const factor = 10 ** decimals
  return Math.round(rows.reduce((s, r) => s + toNumber(value(r)) * factor, 0)) / factor
}

/** Agrupa por llave y arma un renglón por grupo, en el orden en que aparecen. */
export function summarize<T, R>(rows: readonly T[], key: (r: T) => string, build: (items: T[]) => R): R[] {
  const groups = new Map<string, T[]>()
  for (const r of rows) {
    const k = key(r)
    const g = groups.get(k)
    if (g) g.push(r)
    else groups.set(k, [r])
  }
  return [...groups.values()].map(build)
}

const byText = <T>(f: (r: T) => string) => (a: T, b: T) => f(a).localeCompare(f(b), "es")

// -----------------------------------------------------------------------------
// Consumo de insumos por proyecto (consumos menos devoluciones, al costo histórico)
// -----------------------------------------------------------------------------
export type ConsumptionMovement = {
  movement_type: "consumo" | "devolucion" | string
  quantity: Num
  total_cost: Num
  unit: string
  product: { id: string; name: string; category: { name: string } }
  project: { id: string; code: string } | null
}

export function inputConsumption(movements: readonly ConsumptionMovement[]) {
  const relevant = movements.filter((m) => m.project && (m.movement_type === "consumo" || m.movement_type === "devolucion"))
  const sign = (m: ConsumptionMovement) => (m.movement_type === "devolucion" ? -1 : 1)
  return summarize(
    relevant,
    (m) => `${m.project!.id}|${m.product.id}`,
    (items) => {
      const first = items[0]
      return {
        projectId: first.project!.id,
        project: first.project!.code,
        product: first.product.name,
        category: first.product.category.name,
        unit: first.unit,
        consumed: sum(items.filter((m) => m.movement_type === "consumo"), (m) => m.quantity, 3),
        returned: sum(items.filter((m) => m.movement_type === "devolucion"), (m) => m.quantity, 3),
        net: sum(items, (m) => sign(m) * toNumber(m.quantity), 3),
        cost: sum(items, (m) => sign(m) * toNumber(m.total_cost)),
      }
    }
  ).sort((a, b) => a.project.localeCompare(b.project) || b.cost - a.cost)
}

// -----------------------------------------------------------------------------
// Riegos por parcela
// -----------------------------------------------------------------------------
export type IrrigationRow = {
  status: string
  duration_minutes: number | null
  water_m3: Num
  project: { id: string; code: string }
  assignment: { plot: { name: string } }
}

export function irrigationByPlot(logs: readonly IrrigationRow[]) {
  const active = logs.filter((l) => l.status !== "cancelado")
  return summarize(
    active,
    (l) => `${l.project.id}|${l.assignment.plot.name}`,
    (items) => ({
      project: items[0].project.code,
      plot: items[0].assignment.plot.name,
      events: items.length,
      hours: sum(items, (l) => toNumber(l.duration_minutes) / 60, 1),
      water: sum(items, (l) => l.water_m3),
      measured: items.filter((l) => l.water_m3 !== null && l.water_m3 !== undefined).length,
    })
  ).sort((a, b) => a.project.localeCompare(b.project) || a.plot.localeCompare(b.plot, "es"))
}

// -----------------------------------------------------------------------------
// Mano de obra: jornadas por trabajador y costo por proyecto y actividad
// -----------------------------------------------------------------------------
export type LaborRow = {
  work_date: string
  pay_type: "jornal" | "destajo"
  quantity: Num
  amount: Num
  crew: string | null
  activity: string
  employee: { full_name: string } | null
  activity_type: { name: string } | null
  project: { id: string; code: string }
}

export function laborByWorker(records: readonly LaborRow[]) {
  return summarize(
    records,
    (r) => r.employee?.full_name ?? `Cuadrilla: ${r.crew ?? "sin nombre"}`,
    (items) => ({
      worker: items[0].employee?.full_name ?? `Cuadrilla: ${items[0].crew ?? "sin nombre"}`,
      employee: Boolean(items[0].employee),
      days: new Set(items.map((r) => r.work_date)).size,
      jornales: sum(items.filter((r) => r.pay_type === "jornal"), (r) => r.quantity),
      destajoRecords: items.filter((r) => r.pay_type === "destajo").length,
      projects: [...new Set(items.map((r) => r.project.code))].sort().join(", "),
      amount: sum(items, (r) => r.amount),
    })
  ).sort((a, b) => Number(b.employee) - Number(a.employee) || a.worker.localeCompare(b.worker, "es"))
}

export function laborCostByProject(records: readonly LaborRow[]) {
  return summarize(
    records,
    (r) => `${r.project.id}|${r.activity_type?.name ?? r.activity}`,
    (items) => ({
      project: items[0].project.code,
      activity: items[0].activity_type?.name ?? items[0].activity,
      jornales: sum(items.filter((r) => r.pay_type === "jornal"), (r) => r.quantity),
      destajo: sum(items.filter((r) => r.pay_type === "destajo"), (r) => r.amount),
      amount: sum(items, (r) => r.amount),
    })
  ).sort((a, b) => a.project.localeCompare(b.project) || b.amount - a.amount)
}

// -----------------------------------------------------------------------------
// Utilización de maquinaria (uso cargado a proyectos y gasto de mantenimiento)
// -----------------------------------------------------------------------------
export type UsageRow = {
  hours: Num
  jornadas: Num
  amount: Num
  fuel_quantity: Num
  machine: { id: string; name: string }
  fuel: { total_cost: Num } | null
  project: { code: string }
}

export type MaintenanceRow = { status: string; kind: string; cost: Num; machine_id: string; machine: { name: string } }

export function machineryUtilization(usage: readonly UsageRow[], maintenance: readonly MaintenanceRow[]) {
  const active = maintenance.filter((m) => m.status !== "cancelado")
  const ids = new Set([...usage.map((u) => u.machine.id), ...active.map((m) => m.machine_id)])
  return [...ids]
    .map((id) => {
      const items = usage.filter((u) => u.machine.id === id)
      const services = active.filter((m) => m.machine_id === id)
      return {
        machine: items[0]?.machine.name ?? services[0]?.machine.name ?? "",
        records: items.length,
        hours: sum(items, (u) => u.hours),
        jornadas: sum(items, (u) => u.jornadas),
        projects: [...new Set(items.map((u) => u.project.code))].sort().join(", "),
        charged: sum(items, (u) => u.amount),
        fuel: sum(items, (u) => u.fuel_quantity, 3),
        fuelCost: sum(items, (u) => u.fuel?.total_cost),
        maintenance: sum(services, (m) => m.cost),
        repairs: sum(services.filter((m) => m.kind === "correctivo"), (m) => m.cost),
      }
    })
    .sort(byText((r) => r.machine))
}

// -----------------------------------------------------------------------------
// Costos operativos por proyecto (insumos, maquinaria, mano de obra y
// actividades; los gastos directos se reportan en Finanzas)
// -----------------------------------------------------------------------------
export const OPERATING_SOURCES = ["insumos", "maquinaria", "mano_obra", "actividades"] as const
export type OperatingSource = (typeof OPERATING_SOURCES)[number]

export type CostEntryRow = { project_id: string; code: string; source: string; amount: Num }

export function operatingCosts(entries: readonly CostEntryRow[]) {
  const relevant = entries.filter((e) => (OPERATING_SOURCES as readonly string[]).includes(e.source))
  return summarize(
    relevant,
    (e) => e.project_id,
    (items) => {
      const bySource = (s: OperatingSource) => sum(items.filter((e) => e.source === s), (e) => e.amount)
      return {
        project: items[0].code,
        insumos: bySource("insumos"),
        maquinaria: bySource("maquinaria"),
        mano_obra: bySource("mano_obra"),
        actividades: bySource("actividades"),
        total: sum(items, (e) => e.amount),
      }
    }
  ).sort(byText((r) => r.project))
}
