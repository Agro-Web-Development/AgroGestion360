/**
 * Indicadores de producción calculados sobre los lotes ya filtrados (periodo y
 * proyecto). Funciones puras: la página consulta y aquí solo se agrega.
 */

export type LotFigures = {
  projectId: string
  projectCode: string
  cutNumber: number
  date: string
  quality: string
  plotId: string
  plotName: string
  /** Superficie de la parcela asignada al proyecto. */
  areaHa: number
  quantityKg: number
  soldKg: number
  adjustedKg: number
  availableKg: number
}

export type Datum = { label: string; value: number }

const round3 = (n: number) => Math.round(n * 1000) / 1000

/** Suma `value` por `key`, de mayor a menor. */
export function sumBy<T>(rows: T[], key: (row: T) => string, value: (row: T) => number): Datum[] {
  const totals = new Map<string, number>()
  for (const r of rows) totals.set(key(r), (totals.get(key(r)) ?? 0) + value(r))
  return [...totals.entries()].map(([label, v]) => ({ label, value: round3(v) })).sort((a, b) => b.value - a.value)
}

/** Totales: un corte es un número de corte dentro de un proyecto (puede tener varios lotes por calidad). */
export function productionTotals(rows: LotFigures[]) {
  const cuts = new Set(rows.map((r) => `${r.projectId}:${r.cutNumber}`))
  const sum = (f: (r: LotFigures) => number) => round3(rows.reduce((t, r) => t + f(r), 0))
  return {
    cuts: cuts.size,
    lots: rows.length,
    producedKg: sum((r) => r.quantityKg),
    soldKg: sum((r) => r.soldKg),
    shrinkageKg: sum((r) => r.adjustedKg),
    availableKg: sum((r) => r.availableKg),
  }
}

/** Producción por día de corte en orden cronológico. */
export function productionByDate(rows: LotFigures[]): Datum[] {
  return sumBy(rows, (r) => r.date, (r) => r.quantityKg).sort((a, b) => a.label.localeCompare(b.label))
}

/**
 * Rendimiento por parcela de cada proyecto: kg cosechados / ha asignadas. La
 * superficie se cuenta una vez por parcela aunque tenga varios cortes.
 */
export function yieldByPlot(rows: LotFigures[]) {
  const byPlot = new Map<string, { projectCode: string; plotName: string; areaHa: number; kg: number }>()
  for (const r of rows) {
    const key = `${r.projectId}:${r.plotId}`
    const acc = byPlot.get(key) ?? { projectCode: r.projectCode, plotName: r.plotName, areaHa: r.areaHa, kg: 0 }
    acc.kg += r.quantityKg
    byPlot.set(key, acc)
  }
  return [...byPlot.values()]
    .map((p) => ({ ...p, kg: round3(p.kg), kgPerHa: p.areaHa > 0 ? Math.round((p.kg / p.areaHa) * 10) / 10 : null }))
    .sort((a, b) => a.projectCode.localeCompare(b.projectCode) || b.kg - a.kg)
}
