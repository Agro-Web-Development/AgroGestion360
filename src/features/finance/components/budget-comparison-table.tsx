import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatMoney, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import { comparisonTotals, type ComparisonRow } from "../analysis"
import { BUDGET_CATEGORY_LABELS, type AlertThresholds, type BudgetStatus } from "../schemas"
import { BudgetStatusBadge } from "./status-badges"

export function UsageBar({ pct, status }: { pct: number | null; status: BudgetStatus }) {
  if (pct === null) return null
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" role="presentation">
      <div
        className={cn(
          "h-full rounded-full",
          status === "agotado" ? "bg-destructive" : status === "critico" ? "bg-orange-500" : status === "aviso" ? "bg-warning" : "bg-primary"
        )}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  )
}

export function BudgetComparisonTable({ rows, thresholds }: { rows: ComparisonRow[]; thresholds: AlertThresholds }) {
  const { budget, actual, difference, usedPct: pct, status } = comparisonTotals(rows, thresholds)

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Categoría</TableHead>
            <TableHead className="text-right">Presupuesto</TableHead>
            <TableHead className="text-right">Gasto real</TableHead>
            <TableHead className="hidden text-right sm:table-cell">Diferencia</TableHead>
            <TableHead className="w-40">Utilización</TableHead>
            <TableHead className="hidden md:table-cell">Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                Sin presupuesto ni costos registrados.
              </TableCell>
            </TableRow>
          )}
          {rows.map((r) => (
            <TableRow key={r.category}>
              <TableCell className="font-medium">
                {BUDGET_CATEGORY_LABELS[r.category]}
                <div className="mt-1 md:hidden">
                  <BudgetStatusBadge status={r.status} thresholds={thresholds} short />
                </div>
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatMoney(r.budget)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatMoney(r.actual)}</TableCell>
              <TableCell className={cn("hidden text-right tabular-nums sm:table-cell", r.difference < 0 && "text-destructive")}>
                {formatMoney(r.difference)}
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <span className="text-sm tabular-nums">{r.usedPct === null ? "—" : `${formatNumber(r.usedPct)} %`}</span>
                  <UsageBar pct={r.usedPct} status={r.status} />
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <BudgetStatusBadge status={r.status} thresholds={thresholds} short />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        {rows.length > 0 && (
          <TableFooter>
            <TableRow>
              <TableCell className="font-medium">Total</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">{formatMoney(budget)}</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">{formatMoney(actual)}</TableCell>
              <TableCell className={cn("hidden text-right font-semibold tabular-nums sm:table-cell", difference < 0 && "text-destructive")}>
                {formatMoney(difference)}
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <span className="text-sm font-semibold tabular-nums">{pct === null ? "—" : `${formatNumber(pct)} %`}</span>
                  <UsageBar pct={pct} status={status} />
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <BudgetStatusBadge status={status} thresholds={thresholds} short />
              </TableCell>
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </div>
  )
}
