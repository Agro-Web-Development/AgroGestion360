"use client"

import { Ban } from "lucide-react"

import { ReasonDialog } from "@/components/shared/reason-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PAYMENT_METHOD_LABELS } from "@/features/sales/schemas"
import { formatDate, formatMoney } from "@/lib/format"
import { cn } from "@/lib/utils"
import { cancelCashMovement } from "../actions"
import type { CashMovement } from "../queries"
import { CASH_KIND_LABELS } from "../schemas"

/** Movimientos de efectivo capturados (pagos de gastos, a proveedores y otros); se cancelan con motivo. */
export function CashMovementsTable({ movements, canWrite }: { movements: CashMovement[]; canWrite: boolean }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Concepto</TableHead>
            <TableHead className="hidden md:table-cell">Tipo</TableHead>
            <TableHead className="text-right">Importe</TableHead>
            {canWrite && (
              <TableHead className="w-12">
                <span className="sr-only">Acciones</span>
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {movements.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                Sin movimientos capturados en el periodo.
              </TableCell>
            </TableRow>
          )}
          {movements.map((m) => {
            const cancelled = m.status === "cancelado"
            const income = m.direction === "ingreso"
            return (
              <TableRow key={m.id} className={cn(cancelled && "text-muted-foreground")}>
                <TableCell className="whitespace-nowrap">{formatDate(m.movement_date)}</TableCell>
                <TableCell>
                  <p className={cn("font-medium", cancelled && "line-through")}>{m.concept}</p>
                  <p className="text-xs text-muted-foreground">
                    {[m.supplier?.name, m.project?.code, PAYMENT_METHOD_LABELS[m.method], m.reference].filter(Boolean).join(" · ")}
                  </p>
                  {cancelled && <p className="text-xs">Cancelado: {m.cancel_reason}</p>}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <Badge variant="outline">{CASH_KIND_LABELS[m.kind]}</Badge>
                </TableCell>
                <TableCell className={cn("text-right font-medium tabular-nums", income && !cancelled && "text-primary")}>
                  {income ? "+" : "−"}
                  {formatMoney(m.amount)}
                </TableCell>
                {canWrite && (
                  <TableCell>
                    {!cancelled && (
                      <ReasonDialog
                        title="Cancelar movimiento"
                        description={`"${m.concept}" (${formatMoney(m.amount)}) dejará de contar en el flujo${
                          m.kind === "pago_gasto" ? " y el gasto volverá a tener saldo por pagar" : ""
                        }. Queda en el historial.`}
                        confirmLabel="Cancelar movimiento"
                        action={(reason) => cancelCashMovement(m.id, reason)}
                        trigger={
                          <Button variant="ghost" size="icon" aria-label={`Cancelar movimiento: ${m.concept}`}>
                            <Ban aria-hidden />
                          </Button>
                        }
                      />
                    )}
                  </TableCell>
                )}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
