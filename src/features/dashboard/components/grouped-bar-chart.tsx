"use client"

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { useIsMobile } from "@/hooks/use-mobile"
import { formatMoney, formatNumber } from "@/lib/format"

const compact = new Intl.NumberFormat("es-MX", { notation: "compact", maximumFractionDigits: 1 })

const TOOLTIP_STYLE = {
  contentStyle: {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    boxShadow: "0 4px 12px rgb(0 0 0 / 0.08)",
    color: "var(--popover-foreground)",
    fontSize: 12,
  },
  labelStyle: { color: "var(--popover-foreground)", fontWeight: 500 },
  itemStyle: { color: "var(--popover-foreground)" },
}

/** Dos series comparadas (p. ej. presupuesto y real). Colores validados para daltonismo (--series-a / --series-b). */
const SERIES_COLORS = ["var(--series-a)", "var(--series-b)"] as const

export type GroupedDatum = { label: string; a: number; b: number }

function Legend({ names }: { names: [string, string] }) {
  return (
    <div className="mb-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
      {names.map((name, i) => (
        <span key={name} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ background: SERIES_COLORS[i] }} aria-hidden />
          {name}
        </span>
      ))}
    </div>
  )
}

/**
 * Columnas (series de tiempo) o barras horizontales (categorías) con dos
 * series lado a lado. Leyenda siempre visible, tooltip compartido y tabla
 * oculta para lectores de pantalla.
 */
export function GroupedBarChart({
  data,
  names,
  caption,
  money = true,
  unit,
  layout = "columns",
}: {
  data: GroupedDatum[]
  names: [string, string]
  caption: string
  money?: boolean
  unit?: string
  layout?: "columns" | "bars"
}) {
  const isMobile = useIsMobile()
  const fmt = (v: number) => (money ? formatMoney(v) : formatNumber(v, unit))
  const tick = (v: number) => (money ? `$${compact.format(v)}` : compact.format(v))
  const horizontal = layout === "bars"
  const height = horizontal ? Math.max(data.length * 46 + 16, 100) : 240

  return (
    <figure>
      <Legend names={names} />
      <div style={{ height }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout={horizontal ? "vertical" : "horizontal"}
            margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
            barCategoryGap={horizontal ? 10 : "22%"}
            barGap={2}
          >
            <CartesianGrid vertical={horizontal} horizontal={!horizontal} stroke="var(--border)" strokeOpacity={0.6} />
            {horizontal ? (
              <>
                <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} tickFormatter={tick} />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={isMobile ? 104 : 150}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  interval={0}
                />
              </>
            ) : (
              <>
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  interval="preserveStartEnd"
                  minTickGap={8}
                />
                <YAxis width={56} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} tickFormatter={tick} />
              </>
            )}
            <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.6 }} formatter={(value, name) => [fmt(Number(value)), name]} {...TOOLTIP_STYLE} />
            {(["a", "b"] as const).map((key, i) => (
              <Bar
                key={key}
                dataKey={key}
                name={names[i]}
                fill={SERIES_COLORS[i]}
                radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
                maxBarSize={horizontal ? 14 : 28}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Concepto</th>
            <th scope="col">{names[0]}</th>
            <th scope="col">{names[1]}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <th scope="row">{d.label}</th>
              <td>{fmt(d.a)}</td>
              <td>{fmt(d.b)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

/**
 * Barras horizontales con signo (resultado por proyecto): las pérdidas a la
 * izquierda de cero en color de alerta y cada barra con su valor.
 */
export function SignedBarChart({ data, caption }: { data: { label: string; value: number }[]; caption: string }) {
  const isMobile = useIsMobile()
  const height = Math.max(data.length * 38 + 8, 80)

  return (
    <figure>
      <div style={{ height }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: isMobile ? 64 : 84, bottom: 4, left: 0 }} barCategoryGap={10}>
            <XAxis type="number" hide domain={[(min: number) => Math.min(min, 0), (max: number) => Math.max(max, 0)]} />
            <YAxis
              type="category"
              dataKey="label"
              width={isMobile ? 104 : 150}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              interval={0}
            />
            <ReferenceLine x={0} stroke="var(--border)" />
            <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.6 }} formatter={(value) => [formatMoney(Number(value)), null]} separator="" {...TOOLTIP_STYLE} />
            <Bar dataKey="value" radius={4} maxBarSize={18} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.label} fill={d.value < 0 ? "var(--destructive)" : "var(--series-a)"} />
              ))}
              <LabelList
                dataKey="value"
                position="right"
                formatter={(value) => formatMoney(Number(value))}
                style={{ fill: "var(--foreground)", fontSize: 12, fontWeight: 500 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>{caption}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <th scope="row">{d.label}</th>
              <td>{formatMoney(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
