"use client"

import { useMemo, useState } from "react"

import { CatalogRowActions } from "@/components/shared/catalog-row-actions"
import { matchesQuery, SearchInput } from "@/components/shared/search-input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatMoney, formatNumber } from "@/lib/format"
import { toInput } from "@/lib/validation"
import { deleteCatalog, setCatalogActive } from "../actions"
import type { Category, Product } from "../queries"
import type { InventoryUnit } from "../schemas"
import { ProductFormDialog } from "./product-form-dialog"

const ALL = "todas"

export function ProductsTable({
  products,
  categories,
  canWrite,
  canDelete,
}: {
  products: Product[]
  categories: Category[]
  canWrite: boolean
  canDelete: boolean
}) {
  const [query, setQuery] = useState("")
  const [categoryId, setCategoryId] = useState(ALL)
  const [onlyLow, setOnlyLow] = useState(false)
  const filtered = useMemo(
    () =>
      products.filter(
        (p) =>
          (categoryId === ALL || p.category.id === categoryId) &&
          (!onlyLow || p.lowStock) &&
          matchesQuery(query, p.name, p.sku, p.category.name)
      ),
    [products, query, categoryId, onlyLow]
  )
  const totalValue = filtered.reduce((s, p) => s + Number(p.stock_value), 0)

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput value={query} onChange={setQuery} placeholder="Buscar por nombre, clave o categoría" />
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger className="w-full sm:w-56" aria-label="Filtrar por categoría">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas las categorías</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} className="size-4 accent-primary" />
          Solo bajo mínimo
        </label>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead className="hidden md:table-cell">Categoría</TableHead>
              <TableHead className="text-right">Existencia</TableHead>
              <TableHead className="hidden text-right lg:table-cell">Mínimo</TableHead>
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
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
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
                  <p className="text-xs text-muted-foreground">
                    {[p.sku, p.track_lots && "Por lote"].filter(Boolean).join(" · ")}
                    <span className="md:hidden">{p.sku || p.track_lots ? " · " : ""}{p.category.name}</span>
                  </p>
                </TableCell>
                <TableCell className="hidden md:table-cell">{p.category.name}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(p.stock, p.unit)}
                  {p.lowStock && (
                    <Badge variant="outline" className="ml-2 border-destructive text-destructive">
                      Bajo mínimo
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums lg:table-cell">{formatNumber(p.min_stock, p.unit)}</TableCell>
                <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatMoney(p.avg_cost)}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">{formatMoney(p.stock_value)}</TableCell>
                {(canWrite || canDelete) && (
                  <TableCell>
                    <CatalogRowActions
                      name={p.name}
                      active={p.is_active}
                      deactivateDescription={`"${p.name}" ya no admitirá entradas ni consumos. Su existencia y su historial se conservan.`}
                      editDialog={
                        canWrite
                          ? (trigger) => (
                              <ProductFormDialog
                                trigger={trigger}
                                categories={categories}
                                unitLocked={p.movementCount > 0}
                                lotsLocked={Number(p.stock) > 0}
                                product={{
                                  id: p.id,
                                  name: p.name,
                                  sku: p.sku ?? "",
                                  categoryId: p.category.id,
                                  unit: p.unit as InventoryUnit,
                                  minStock: toInput(p.min_stock),
                                  trackLots: p.track_lots,
                                  notes: p.notes ?? "",
                                }}
                              />
                            )
                          : undefined
                      }
                      onToggle={canWrite ? () => setCatalogActive("inventory_products", p.id, !p.is_active) : undefined}
                      onDelete={
                        canDelete && p.movementCount === 0 ? () => deleteCatalog("inventory_products", p.id) : undefined
                      }
                    />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={2} className="font-medium md:col-span-1">
                Valor del inventario ({formatNumber(filtered.length)} productos)
              </TableCell>
              <TableCell className="hidden md:table-cell" />
              <TableCell className="hidden lg:table-cell" />
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
