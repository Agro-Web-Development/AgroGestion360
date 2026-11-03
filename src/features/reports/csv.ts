export type ReportValue = string | number | null

export type ReportColumn = {
  key: string
  header: string
  format?: "text" | "money" | "number" | "date"
  unit?: string
  /** Se oculta en pantallas pequeñas (sigue en el CSV). */
  secondary?: boolean
  /** Suma la columna en el pie. */
  total?: boolean
}

/** Valor de una columna de un renglón (cualquier objeto plano). */
export function cell(row: object, key: string): ReportValue {
  const v = (row as Record<string, unknown>)[key]
  if (v === null || v === undefined) return null
  if (typeof v === "number" || typeof v === "string") return v
  if (typeof v === "boolean") return v ? "Sí" : "No"
  return String(v)
}

/** CSV con BOM para que Excel respete acentos; los números van sin formato. */
export function toCsv(columns: ReportColumn[], rows: readonly object[]): string {
  const escape = (v: ReportValue) => {
    const s = v === null ? "" : String(v)
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = columns.map((c) => escape(c.unit ? `${c.header} (${c.unit})` : c.header)).join(",")
  return `\uFEFF${[header, ...rows.map((r) => columns.map((c) => escape(cell(r, c.key))).join(","))].join("\r\n")}`
}

/** Renglones para Excel: números y fechas sin formatear (el formato lo da la hoja). */
export function toXlsxRows(columns: ReportColumn[], rows: readonly object[]): (string | number | null)[][] {
  return rows.map((r) =>
    columns.map((c) => {
      const v = cell(r, c.key)
      if (v === null) return null
      return (c.format === "money" || c.format === "number") && v !== "" ? Number(v) : v
    })
  )
}
