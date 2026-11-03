import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { QUALITY_LABELS } from "@/features/harvests/schemas"
import { formatDate, formatMoney, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { LotTraceRow } from "../queries"

type Column = "sale" | "customer" | "lot" | "origin"

/**
 * Trazabilidad venta ↔ lote ↔ parcela ↔ proyecto. Cada renglón es una salida
 * de producto; las revertidas por cancelación se muestran tachadas.
 */
export function TraceTable({ rows, hide = [] }: { rows: LotTraceRow[]; hide?: Column[] }) {
  const show = (c: Column) => !hide.includes(c)
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            {show("sale") && <TableHead>Venta</TableHead>}
            {show("customer") && <TableHead className="hidden md:table-cell">Cliente</TableHead>}
            {show("lot") && <TableHead>Lote</TableHead>}
            {show("origin") && <TableHead className="hidden sm:table-cell">Proyecto · parcela</TableHead>}
            <TableHead className="text-right">Kg</TableHead>
            <TableHead className="text-right">Importe vendido</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                Sin ventas confirmadas de este origen.
              </TableCell>
            </TableRow>
          )}
          {rows.map((r) => (
            <TableRow key={r.movementId} className={cn(r.reversed && "text-muted-foreground line-through")}>
              {show("sale") && (
                <TableCell>
                  <Link href={`/ventas/${r.saleId}`} className="font-medium hover:underline">
                    {r.saleCode}
                  </Link>
                  <p className="text-xs text-muted-foreground no-underline">
                    {formatDate(r.saleDate)}
                    {r.reversed && (
                      <Badge variant="outline" className="ml-2">
                        Cancelada
                      </Badge>
                    )}
                  </p>
                </TableCell>
              )}
              {show("customer") && <TableCell className="hidden md:table-cell">{r.customerName}</TableCell>}
              {show("lot") && (
                <TableCell>
                  <Link href={`/produccion/lotes/${r.harvestId}`} className="font-medium hover:underline">
                    {r.lotCode}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    Corte {r.cutNumber} · {formatDate(r.harvestDate)} · {QUALITY_LABELS[r.quality]}
                  </p>
                </TableCell>
              )}
              {show("origin") && (
                <TableCell className="hidden sm:table-cell">
                  <Link href={`/proyectos/${r.projectId}`} className="hover:underline">
                    {r.projectCode}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {r.farmName} · {r.plotName}
                  </p>
                </TableCell>
              )}
              <TableCell className="text-right tabular-nums">{formatNumber(r.quantityKg)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatMoney(r.amount)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
