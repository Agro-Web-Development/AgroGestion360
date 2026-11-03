import Link from "next/link"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatMoney, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { ProjectCosts } from "../queries"
import { COST_CLASS_LABELS, COST_CLASSES, type AlertThresholds } from "../schemas"
import { UsageBar } from "./budget-comparison-table"
import { BudgetStatusBadge } from "./status-badges"

/** Costo de producción por clase, presupuesto, unitarios, ventas, cobranza y resultado estimado del proyecto. */
export function ProjectFinanceCard({ costs, thresholds }: { costs: ProjectCosts; thresholds?: AlertThresholds }) {
  const budgetPct = costs.budgetUsedPct

  return (
    <Card>
      <CardHeader>
        <CardTitle>Costos y resultados</CardTitle>
        <CardDescription>Calculados con los registros reales; las compras de almacén no cuentan hasta consumirse.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <p className="text-sm text-muted-foreground">Costo de producción acumulado</p>
          <p className="text-2xl font-semibold tabular-nums">{formatMoney(costs.totalCost)}</p>
          {budgetPct !== null && (
            <div className="mt-2 space-y-1">
              <UsageBar pct={budgetPct} status={costs.budgetStatus} />
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {formatNumber(budgetPct)} % de{" "}
                  <Link href={`/presupuestos/${costs.projectId}`} className="underline">
                    {costs.budgetVersion ? `presupuesto v${costs.budgetVersion}` : "presupuesto"} ({formatMoney(costs.budget)})
                  </Link>
                </span>
                <BudgetStatusBadge status={costs.budgetStatus} thresholds={thresholds} short />
              </div>
              {costs.budgetVariance !== null && (
                <p className={cn("text-xs", costs.budgetVariance < 0 ? "font-medium text-destructive" : "text-muted-foreground")}>
                  {costs.budgetVariance < 0
                    ? `Excede el presupuesto por ${formatMoney(-costs.budgetVariance)}`
                    : `Presupuesto restante: ${formatMoney(costs.budgetRemaining)}`}
                </p>
              )}
            </div>
          )}
        </div>

        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
          {COST_CLASSES.map((c) => (
            <div key={c} className="contents">
              <dt className="text-muted-foreground">{COST_CLASS_LABELS[c]}</dt>
              <dd className="text-right tabular-nums">{formatMoney(costs.byClass[c])}</dd>
            </div>
          ))}
        </dl>

        <dl className="grid grid-cols-2 gap-3 border-t pt-4 text-sm">
          <div>
            <dt className="text-muted-foreground">Costo por hectárea</dt>
            <dd className="font-medium tabular-nums">{formatMoney(costs.costPerHa)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Costo por kg · t</dt>
            <dd className="font-medium tabular-nums">
              {costs.costPerKg !== null ? `${formatMoney(costs.costPerKg)} · ${formatMoney(costs.costPerTon)}` : "Sin cosecha"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Cosechado</dt>
            <dd className="font-medium tabular-nums">{formatNumber(costs.harvestedKg, "kg")}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Rendimiento</dt>
            <dd className="font-medium tabular-nums">
              {costs.yieldKgPerHa !== null && costs.harvestedKg > 0 ? formatNumber(costs.yieldKgPerHa, "kg/ha") : "—"}
            </dd>
          </div>
        </dl>

        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 border-t pt-4 text-sm">
          <dt className="text-muted-foreground">Ventas reconocidas</dt>
          <dd className="text-right tabular-nums">
            {formatMoney(costs.salesAmount)}
            <span className="block text-xs text-muted-foreground">{formatNumber(costs.soldKg, "kg")} vendidos</span>
          </dd>
          <dt className="text-muted-foreground">Cobrado</dt>
          <dd className="text-right tabular-nums">{formatMoney(costs.collectedAmount)}</dd>
          <dt className="text-muted-foreground">Por cobrar</dt>
          <dd className="text-right font-medium tabular-nums">{formatMoney(costs.receivableAmount)}</dd>
          <dt className="font-medium">Resultado estimado</dt>
          <dd className={cn("text-right text-base font-semibold tabular-nums", costs.estimatedResult < 0 && "text-destructive")}>
            {formatMoney(costs.estimatedResult)}
            {costs.marginPct !== null && (
              <span className="block text-xs font-normal text-muted-foreground">Margen {formatNumber(costs.marginPct)} %</span>
            )}
          </dd>
          {costs.availableKg > 0 && (
            <>
              <dt className="text-muted-foreground">Producto en existencia</dt>
              <dd className="text-right tabular-nums">
                {formatNumber(costs.availableKg, "kg")}
                <span className="block text-xs text-muted-foreground">a costo: {formatMoney(costs.stockValueAtCost)}</span>
              </dd>
            </>
          )}
        </dl>
        <p className="text-xs text-muted-foreground">
          Resultado estimado = ventas confirmadas − costo de producción acumulado. Lo cobrado no es utilidad, y el producto sin
          vender no se cuenta como ingreso (se muestra a costo solo como referencia).
        </p>
      </CardContent>
    </Card>
  )
}
