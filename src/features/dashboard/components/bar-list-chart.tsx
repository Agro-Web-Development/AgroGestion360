"use client"

import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { formatNumber } from "@/lib/format"

type Datum = { label: string; value: number }

/**
 * Barras horizontales de una sola serie (un solo color, sin leyenda): el
 * título de la tarjeta nombra la medida. Valor al final de cada barra, tooltip
 * al pasar el cursor y tabla oculta para lectores de pantalla.
 */
export function BarListChart({ data, unit, caption }: { data: Datum[]; unit?: string; caption: string }) {
  const height = Math.max(data.length * 36 + 8, 80)

  return (
    <figure>
      <div style={{ height }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 72, bottom: 4, left: 0 }} barCategoryGap={8}>
            <XAxis type="number" hide domain={[0, "dataMax"]} />
            <YAxis
              type="category"
              dataKey="label"
              width={150}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              interval={0}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.6 }}
              formatter={(value) => [formatNumber(Number(value), unit), null]}
              separator=""
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--popover-foreground)",
                fontSize: 12,
              }}
              labelStyle={{ color: "var(--popover-foreground)", fontWeight: 500 }}
              itemStyle={{ color: "var(--popover-foreground)" }}
            />
            <Bar dataKey="value" fill="var(--chart-1)" radius={[0, 4, 4, 0]} maxBarSize={20} isAnimationActive={false}>
              <LabelList
                dataKey="value"
                position="right"
                formatter={(value) => formatNumber(Number(value), unit)}
                style={{ fill: "var(--foreground)", fontSize: 12 }}
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
              <td>{formatNumber(d.value, unit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
