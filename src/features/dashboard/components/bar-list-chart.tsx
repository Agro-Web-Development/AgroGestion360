"use client"

import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { useIsMobile } from "@/hooks/use-mobile"
import { formatMoney, formatNumber } from "@/lib/format"

type Datum = { label: string; value: number }

/**
 * Barras horizontales de una sola serie (un solo color, sin leyenda): el
 * título de la tarjeta nombra la medida. Valor al final de cada barra, tooltip
 * al pasar el cursor y tabla oculta para lectores de pantalla.
 */
export function BarListChart({
  data,
  unit,
  caption,
  money = false,
}: {
  data: Datum[]
  unit?: string
  caption: string
  /** Valores en pesos (MXN). */
  money?: boolean
}) {
  const isMobile = useIsMobile()
  const fmt = (v: number) => (money ? formatMoney(v) : formatNumber(v, unit))
  const height = Math.max(data.length * 38 + 8, 80)

  return (
    <figure>
      <div style={{ height }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: isMobile ? 56 : 72, bottom: 4, left: 0 }} barCategoryGap={10}>
            <XAxis type="number" hide domain={[0, "dataMax"]} />
            <YAxis
              type="category"
              dataKey="label"
              width={isMobile ? 104 : 150}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              interval={0}
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
            <Bar
              dataKey="value"
              fill="var(--chart-1)"
              radius={[0, 4, 4, 0]}
              maxBarSize={18}
              background={{ fill: "var(--muted)", radius: 4 }}
              isAnimationActive={false}
            >
              <LabelList
                dataKey="value"
                position="right"
                formatter={(value) => fmt(Number(value))}
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
              <td>{fmt(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
