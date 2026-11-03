/**
 * Aritmética de importes sin punto flotante. Los importes (NUMERIC en la BD)
 * se manejan como centavos enteros o como BigInt escalados, de modo que las
 * sumas, prorrateos y redondeos de la interfaz coinciden al centavo con los
 * de PostgreSQL (round(x, 2): mitad hacia arriba, lejos de cero).
 */

type Num = number | string | null | undefined

/** Convierte un decimal (texto o número) a entero escalado: ("12.345", 2) → 1235n. */
export function toScaled(value: Num, scale: number): bigint {
  if (value === null || value === undefined || value === "") return BigInt(0)
  const text = (typeof value === "number" ? value.toFixed(Math.min(scale + 4, 20)) : value).replace(/,/g, "").trim()
  const match = /^(-?)(\d*)(?:\.(\d*))?$/.exec(text)
  if (!match) return BigInt(0)
  const [, sign, intPart, fracPart = ""] = match
  const digits = BigInt(`${intPart || "0"}${fracPart.slice(0, scale).padEnd(scale, "0")}`)
  // Redondeo de los dígitos sobrantes (mitad lejos de cero).
  const roundUp = fracPart.length > scale && Number(fracPart[scale]) >= 5 ? BigInt(1) : BigInt(0)
  const result = digits + roundUp
  return sign === "-" ? -result : result
}

/** Divide redondeando a la mitad lejos de cero (como round() de PostgreSQL). */
export function divRound(numerator: bigint, denominator: bigint): bigint {
  if (denominator === BigInt(0)) return BigInt(0)
  const negative = numerator < BigInt(0) !== denominator < BigInt(0)
  const n = numerator < BigInt(0) ? -numerator : numerator
  const d = denominator < BigInt(0) ? -denominator : denominator
  const q = (n * BigInt(2) + d) / (d * BigInt(2))
  return negative ? -q : q
}

/** Importe en centavos enteros. */
export function toCents(value: Num): number {
  return Number(toScaled(value, 2))
}

export function fromCents(cents: number | bigint): number {
  return Number(cents) / 100
}

/** Suma exacta de importes (al centavo). */
export function sumMoney(values: readonly Num[]): number {
  return fromCents(values.reduce<number>((s, v) => s + toCents(v), 0))
}

/** round(cantidad × precio, 2) exacto: cantidad con 3 decimales y precio con 4, como las columnas generadas. */
export function lineAmount(quantity: Num, unitPrice: Num, quantityScale = 3, priceScale = 4): number {
  const product = toScaled(quantity, quantityScale) * toScaled(unitPrice, priceScale)
  return fromCents(divRound(product, BigInt(10) ** BigInt(quantityScale + priceScale - 2)))
}

/** Porcentaje (1 decimal) de parte sobre total; null si el total no es positivo. */
export function percent(part: Num, total: Num): number | null {
  const t = toScaled(total, 2)
  if (t <= BigInt(0)) return null
  return Number(divRound(toScaled(part, 2) * BigInt(1000), t)) / 10
}

/** round(importe × factor, 2) exacto (p. ej. la parte de un saldo según un porcentaje de reparto). */
export function scaleMoney(amount: Num, factor: Num, factorScale = 6): number {
  return fromCents(divRound(toScaled(amount, 2) * toScaled(factor, factorScale), BigInt(10) ** BigInt(factorScale)))
}
