import Link from "next/link"

import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ProjectStatusBadge } from "@/features/projects/components/project-status-badge"
import { formatMoney, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { ProjectCosts } from "../queries"
import { ratio } from "../schemas"

/** Costo de producción, unitarios y resultado por proyecto. */
export function ProfitabilityTable({ rows }: { rows: ProjectCosts[] }) {
  const sum = (key: keyof ProjectCosts) => rows.reduce((s, r) => s + Number(r[key] ?? 0), 0)
  const total = { cost: sum("totalCost"), area: sum("areaHa"), kg: sum("harvestedKg"), sales: sum("salesAmount") }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Proyecto</TableHead>
            <TableHead className="text-right">Costo de producción</TableHead>
            <TableHead className="hidden text-right md:table-cell">Costo / ha</TableHead>
            <TableHead className="hidden text-right md:table-cell">Costo / kg</TableHead>
            <TableHead className="hidden text-right lg:table-cell">Ventas</TableHead>
            <TableHead className="text-right">Utilidad bruta</TableHead>
            <TableHead className="hidden text-right xl:table-cell">Presupuesto</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.projectId}>
              <TableCell>
                <Link href={`/proyectos/${r.projectId}`} className="font-medium hover:underline">
                  {r.name}
                </Link>
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  {r.code} · {formatNumber(r.areaHa, "ha")}
                  <ProjectStatusBadge status={r.status} className="hidden sm:inline-flex" />
                </p>
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">{formatMoney(r.totalCost)}</TableCell>
              <TableCell className="hidden text-right tabular-nums md:table-cell">{formatMoney(r.costPerHa)}</TableCell>
              <TableCell className="hidden text-right tabular-nums md:table-cell">
                {r.costPerKg !== null ? formatMoney(r.costPerKg) : "—"}
                {r.harvestedKg > 0 && (
                  <span className="block text-xs text-muted-foreground">{formatNumber(r.harvestedKg, "kg")}</span>
                )}
              </TableCell>
              <TableCell className="hidden text-right tabular-nums lg:table-cell">{formatMoney(r.salesAmount)}</TableCell>
              <TableCell
                className={cn("text-right font-medium tabular-nums", r.grossProfit < 0 && "text-destructive")}
              >
                {formatMoney(r.grossProfit)}
              </TableCell>
              <TableCell className="hidden text-right tabular-nums xl:table-cell">
                {r.budgetUsedPct !== null ? (
                  <span className={cn(r.budgetUsedPct > 100 && "font-medium text-destructive")}>
                    {formatNumber(r.budgetUsedPct)} %
                  </span>
                ) : (
                  "—"
                )}
                {r.budget !== null && <span className="block text-xs text-muted-foreground">de {formatMoney(r.budget)}</span>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell className="font-medium">Total</TableCell>
            <TableCell className="text-right font-semibold tabular-nums">{formatMoney(total.cost)}</TableCell>
            <TableCell className="hidden text-right tabular-nums md:table-cell">
              {formatMoney(ratio(total.cost, total.area))}
            </TableCell>
            <TableCell className="hidden text-right tabular-nums md:table-cell">
              {formatMoney(ratio(total.cost, total.kg))}
            </TableCell>
            <TableCell className="hidden text-right font-semibold tabular-nums lg:table-cell">{formatMoney(total.sales)}</TableCell>
            <TableCell className="text-right font-semibold tabular-nums">{formatMoney(total.sales - total.cost)}</TableCell>
            <TableCell className="hidden xl:table-cell" />
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  )
}
