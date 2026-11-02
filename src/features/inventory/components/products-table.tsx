"use client"

import { Pencil, Power, PowerOff, Search, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"

import { ConfirmAction } from "@/components/shared/confirm-action"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatMoney, formatNumber } from "@/lib/format"
import { toInput } from "@/lib/validation"
import { deleteProduct, setProductActive } from "../actions"
import type { Product } from "../queries"
import { INPUT_CATEGORY_LABELS, type InventoryUnit } from "../schemas"
import { ProductFormDialog } from "./product-form-dialog"

export function ProductsTable({
  products,
  canWrite,
  canDelete,
}: {
  products: Product[]
  canWrite: boolean
  canDelete: boolean
}) {
  const [query, setQuery] = useState("")
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return products
    return products.filter((p) => [p.name, p.sku, INPUT_CATEGORY_LABELS[p.category]].some((v) => v?.toLowerCase().includes(q)))
  }, [products, query])
  const totalValue = filtered.reduce((s, p) => s + Number(p.stock_value), 0)

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre, clave o categoría"
          className="pl-8"
          aria-label="Buscar productos"
        />
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead className="hidden md:table-cell">Categoría</TableHead>
              <TableHead className="text-right">Existencia</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Costo promedio</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              {(canWrite || canDelete) && (
                <TableHead className="w-28">
                  <span className="sr-only">Acciones</span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No se encontraron productos.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((p) => (
              <TableRow key={p.id} className={p.is_active ? undefined : "opacity-60"}>
                <TableCell>
                  <p className="font-medium">
                    {p.name}
                    {!p.is_active && (
                      <Badge variant="destructive" className="ml-2">
                        Inactivo
                      </Badge>
                    )}
                  </p>
                  {p.sku && <p className="text-xs text-muted-foreground">{p.sku}</p>}
                </TableCell>
                <TableCell className="hidden md:table-cell">{INPUT_CATEGORY_LABELS[p.category]}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(p.stock, p.unit)}
                  {p.lowStock && (
                    <Badge variant="outline" className="ml-2 border-destructive text-destructive">
                      Bajo mínimo
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatMoney(p.avg_cost)}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">{formatMoney(p.stock_value)}</TableCell>
                {(canWrite || canDelete) && (
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {canWrite && (
                        <ProductFormDialog
                          unitLocked={p.movementCount > 0}
                          product={{
                            id: p.id,
                            name: p.name,
                            sku: p.sku ?? "",
                            category: p.category,
                            unit: p.unit as InventoryUnit,
                            minStock: toInput(p.min_stock),
                            notes: p.notes ?? "",
                          }}
                          trigger={
                            <Button variant="ghost" size="icon" aria-label={`Editar ${p.name}`}>
                              <Pencil aria-hidden />
                            </Button>
                          }
                        />
                      )}
                      {canWrite && (
                        <ConfirmAction
                          title={p.is_active ? "Desactivar producto" : "Reactivar producto"}
                          description={
                            p.is_active
                              ? `"${p.name}" ya no admitirá entradas ni consumos. Su existencia y su historial se conservan.`
                              : `"${p.name}" volverá a estar disponible.`
                          }
                          confirmLabel={p.is_active ? "Desactivar" : "Reactivar"}
                          destructive={p.is_active}
                          action={() => setProductActive(p.id, !p.is_active)}
                          trigger={
                            <Button variant="ghost" size="icon" aria-label={p.is_active ? `Desactivar ${p.name}` : `Reactivar ${p.name}`}>
                              {p.is_active ? <PowerOff aria-hidden /> : <Power aria-hidden />}
                            </Button>
                          }
                        />
                      )}
                      {canDelete && p.movementCount === 0 && (
                        <ConfirmAction
                          title="Eliminar producto"
                          description={`Se eliminará "${p.name}" de forma permanente.`}
                          confirmLabel="Eliminar"
                          action={() => deleteProduct(p.id)}
                          trigger={
                            <Button variant="ghost" size="icon" aria-label={`Eliminar ${p.name}`}>
                              <Trash2 aria-hidden />
                            </Button>
                          }
                        />
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={3} className="font-medium">
                Valor del inventario
              </TableCell>
              <TableCell className="hidden sm:table-cell" />
              <TableCell className="text-right font-semibold tabular-nums">{formatMoney(totalValue)}</TableCell>
              {(canWrite || canDelete) && <TableCell />}
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  )
}
