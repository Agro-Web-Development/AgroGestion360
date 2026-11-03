const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]

/**
 * Serie mensual continua entre dos fechas (AAAA-MM-DD): los meses sin
 * movimientos aparecen en cero para no ocultar huecos en la gráfica.
 */
export function monthSeries(from: string, to: string, rows: { month: string; value: number }[]) {
  const values = new Map(rows.map((r) => [r.month, r.value]))
  const series: { label: string; month: string; value: number }[] = []
  let [year, month] = from.slice(0, 7).split("-").map(Number)
  const [endYear, endMonth] = to.slice(0, 7).split("-").map(Number)
  while (year < endYear || (year === endYear && month <= endMonth)) {
    const key = `${year}-${String(month).padStart(2, "0")}`
    series.push({ label: `${MONTHS[month - 1]} ${String(year).slice(2)}`, month: key, value: values.get(key) ?? 0 })
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }
  return series
}
