import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDate, formatMoney, formatNumber } from "@/lib/format"
import type { CostEntry } from "../queries"
import {
  BUDGET_CATEGORY_LABELS,
  COST_CLASS_LABELS,
  COST_SOURCE_LABELS,
  EXPENSE_CATEGORY_LABELS,
  type BudgetCategory,
  type CostSource,
} from "../schemas"

/**
 * Detalle de costos del proyecto. Proviene de la misma vista que el total, de
 * modo que la suma del detalle siempre coincide con el costo de producción.
 * Cada renglón indica su módulo de origen, su clase y su categoría presupuestal.
 */
export function CostEntriesTable({ entries, total, limited }: { entries: CostEntry[]; total: number; limited: boolean }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Concepto</TableHead>
            <TableHead className="hidden sm:table-cell">Origen</TableHead>
            <TableHead className="hidden lg:table-cell">Clase · categoría</TableHead>
            <TableHead className="text-right">Importe</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((e) => (
            <TableRow key={`${e.source}-${e.source_id}`}>
              <TableCell className="whitespace-nowrap">{formatDate(e.entry_date)}</TableCell>
              <TableCell>
                <p className="font-medium">{e.concept}</p>
                <p className="text-xs text-muted-foreground">
                  {[e.expense_category && EXPENSE_CATEGORY_LABELS[e.expense_category], e.detail].filter(Boolean).join(" · ")}
                </p>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <Badge variant="outline">{COST_SOURCE_LABELS[e.source as CostSource] ?? e.source}</Badge>
              </TableCell>
              <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                {COST_CLASS_LABELS[e.cost_class]}
                <span className="block">{e.budget_category && BUDGET_CATEGORY_LABELS[e.budget_category as BudgetCategory]}</span>
              </TableCell>
              <TableCell className={`text-right tabular-nums ${e.amount < 0 ? "text-primary" : "font-medium"}`}>
                {formatMoney(e.amount)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={2} className="font-medium">
              Costo de producción
              {limited && (
                <span className="block text-xs font-normal text-muted-foreground">
                  Se muestran los {formatNumber(entries.length)} registros más recientes; el total incluye todos.
                </span>
              )}
            </TableCell>
            <TableCell className="hidden sm:table-cell" />
            <TableCell className="hidden lg:table-cell" />
            <TableCell className="text-right font-semibold tabular-nums">{formatMoney(total)}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  )
}
