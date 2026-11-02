export const LOCALE = "es-MX"
export const TIME_ZONE = "America/Mexico_City"
export const CURRENCY = "MXN"

const currencyFormatter = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: CURRENCY,
  minimumFractionDigits: 2,
})

const numberFormatter = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 })

const dateFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
})

const dateTimeFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})

/**
 * Formatea importes en MXN. Acepta string porque PostgreSQL NUMERIC llega como
 * texto desde la API y no debe convertirse a float para cálculos.
 */
export function formatMoney(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—"
  const n = typeof value === "string" ? Number(value) : value
  return Number.isFinite(n) ? currencyFormatter.format(n) : "—"
}

export function formatNumber(value: number | string | null | undefined, unit?: string): string {
  if (value === null || value === undefined || value === "") return "—"
  const n = typeof value === "string" ? Number(value) : value
  if (!Number.isFinite(n)) return "—"
  return unit ? `${numberFormatter.format(n)} ${unit}` : numberFormatter.format(n)
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—"
  // Las columnas DATE llegan como "AAAA-MM-DD"; se fijan al mediodía UTC para que
  // la conversión a la zona horaria de México no las recorra al día anterior.
  if (typeof value === "string" && DATE_ONLY.test(value)) return dateFormatter.format(new Date(`${value}T12:00:00Z`))
  return dateFormatter.format(typeof value === "string" ? new Date(value) : value)
}

/** Fecha de hoy (AAAA-MM-DD) en la zona horaria de la organización. */
export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date())
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—"
  return dateTimeFormatter.format(typeof value === "string" ? new Date(value) : value)
}

export function initials(name: string | null | undefined, fallback = "?"): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return fallback
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase()
}
