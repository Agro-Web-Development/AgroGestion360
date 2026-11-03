"use client"

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { formatMoney, formatNumber } from "@/lib/format"

type Datum = { label: string; value: number }

const compact = new Intl.NumberFormat("es-MX", { notation: "compact", maximumFractionDigits: 1 })

/**
 * Columnas de una sola serie a lo largo del tiempo (meses o días). Sin
 * leyenda: el título de la tarjeta nombra la medida. Tooltip por columna y
 * tabla oculta para lectores de pantalla.
 */
export function ColumnChart({
  data,
  unit,
  caption,
  money = false,
  height = 220,
}: {
  data: Datum[]
  unit?: string
  caption: string
  money?: boolean
  height?: number
}) {
  const fmt = (v: number) => (money ? formatMoney(v) : formatNumber(v, unit))

  return (
    <figure>
      <div style={{ height }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="24%">
            <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              interval="preserveStartEnd"
              minTickGap={8}
            />
            <YAxis
              width={52}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              tickFormatter={(v) => (money ? `$${compact.format(Number(v))}` : compact.format(Number(v)))}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.6 }}
              formatter={(value) => [fmt(Number(value)), null]}
              separator=""
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                boxShadow: "0 4px 12px rgb(0 0 0 / 0.08)",
                color: "var(--popover-foreground)",
                fontSize: 12,
              }}
              labelStyle={{ color: "var(--popover-foreground)", fontWeight: 500 }}
              itemStyle={{ color: "var(--popover-foreground)" }}
            />
            <Bar dataKey="value" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>{caption}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <th scope="row">{d.label}</th>
              <td>{fmt(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
