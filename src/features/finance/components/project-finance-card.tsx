import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatMoney, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { ProjectCosts } from "../queries"
import { COST_SOURCE_LABELS, COST_SOURCES, type CostSource } from "../schemas"

const SOURCE_KEY: Record<CostSource, keyof ProjectCosts> = {
  insumos: "inputsCost",
  maquinaria: "machineryCost",
  mano_obra: "laborCost",
  gastos: "expensesCost",
  actividades: "activitiesCost",
}

/** Costo de producción, unitarios, ventas acumuladas y saldo del proyecto. */
export function ProjectFinanceCard({ costs }: { costs: ProjectCosts }) {
  const budgetPct = costs.budgetUsedPct

  return (
    <Card>
      <CardHeader>
        <CardTitle>Costos y resultados</CardTitle>
        <CardDescription>Calculados con los registros reales; las compras de almacén no cuentan hasta consumirse.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <p className="text-sm text-muted-foreground">Costo de producción</p>
          <p className="text-2xl font-semibold tabular-nums">{formatMoney(costs.totalCost)}</p>
          {budgetPct !== null && (
            <div className="mt-2 space-y-1">
              <div className="h-2 overflow-hidden rounded-full bg-muted" role="presentation">
                <div
                  className={cn("h-full rounded-full", budgetPct > 100 ? "bg-destructive" : "bg-primary")}
                  style={{ width: `${Math.min(budgetPct, 100)}%` }}
                />
              </div>
              <p className={cn("text-xs text-muted-foreground", budgetPct > 100 && "font-medium text-destructive")}>
                {formatNumber(budgetPct)} % del presupuesto ({formatMoney(costs.budget)})
              </p>
            </div>
          )}
        </div>

        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
          {COST_SOURCES.map((s) => (
            <div key={s} className="contents">
              <dt className="text-muted-foreground">{COST_SOURCE_LABELS[s]}</dt>
              <dd className="text-right tabular-nums">{formatMoney(costs[SOURCE_KEY[s]] as number)}</dd>
            </div>
          ))}
        </dl>

        <dl className="grid grid-cols-2 gap-3 border-t pt-4 text-sm">
          <div>
            <dt className="text-muted-foreground">Costo por hectárea</dt>
            <dd className="font-medium tabular-nums">{formatMoney(costs.costPerHa)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Costo por kilogramo</dt>
            <dd className="font-medium tabular-nums">{costs.costPerKg !== null ? formatMoney(costs.costPerKg) : "Sin cosecha"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Cosechado</dt>
            <dd className="font-medium tabular-nums">{formatNumber(costs.harvestedKg, "kg")}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Disponible para venta</dt>
            <dd className="font-medium tabular-nums">{formatNumber(costs.availableKg, "kg")}</dd>
          </div>
        </dl>

        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 border-t pt-4 text-sm">
          <dt className="text-muted-foreground">Ventas acumuladas</dt>
          <dd className="text-right tabular-nums">
            {formatMoney(costs.salesAmount)}
            <span className="block text-xs text-muted-foreground">{formatNumber(costs.soldKg, "kg")} vendidos</span>
          </dd>
          <dt className="text-muted-foreground">Cobrado</dt>
          <dd className="text-right tabular-nums">{formatMoney(costs.collectedAmount)}</dd>
          <dt className="text-muted-foreground">Saldo por cobrar</dt>
          <dd className="text-right font-medium tabular-nums">{formatMoney(costs.receivableAmount)}</dd>
          <dt className="font-medium">Utilidad bruta</dt>
          <dd className={cn("text-right text-base font-semibold tabular-nums", costs.grossProfit < 0 && "text-destructive")}>
            {formatMoney(costs.grossProfit)}
          </dd>
        </dl>
        <p className="text-xs text-muted-foreground">
          Utilidad = ventas registradas − costo de producción. Lo cobrado de ventas con varios proyectos se prorratea por
          importe.
        </p>
      </CardContent>
    </Card>
  )
}
