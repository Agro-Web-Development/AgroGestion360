"use client"

import { Pencil, Route, SlidersHorizontal, Trash2, Undo2 } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"

import type { SelectOption } from "@/components/forms/form-select"
import { ConfirmAction } from "@/components/shared/confirm-action"
import { ReasonDialog } from "@/components/shared/reason-dialog"
import { matchesQuery, SearchInput } from "@/components/shared/search-input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EvidenceDialog } from "@/features/fieldlogs/components/evidence"
import type { OpenProject } from "@/features/projects/queries"
import { isClosed } from "@/features/projects/status"
import { formatDate, formatNumber } from "@/lib/format"
import { newId } from "@/lib/ids"
import { NONE, toInput } from "@/lib/validation"
import { cn } from "@/lib/utils"
import { deleteHarvest, reverseAdjustment } from "../actions"
import type { Harvest, ProductionMovement } from "../queries"
import { MOVEMENT_LABELS, QUALITY_LABELS, UNIT_SHORT } from "../schemas"
import { AdjustmentDialog } from "./adjustment-dialog"
import { HarvestDialog } from "./harvest-dialog"

const n = (v: number | string | null) => Number(v ?? 0)
const product = (h: Harvest) => [h.project.crop.name, h.project.crop.variety].filter(Boolean).join(" ")

function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-8 text-center text-muted-foreground">
        {text}
      </TableCell>
    </TableRow>
  )
}

/** Cantidad en la unidad capturada y, si no es kg, su equivalente. */
function Quantity({ h }: { h: Harvest }) {
  return (
    <>
      {formatNumber(h.quantity, UNIT_SHORT[h.unit])}
      {h.unit !== "kg" && (
        <span className="block text-xs text-muted-foreground">
          {formatNumber(h.quantity_kg, "kg")}
          {h.unit_weight_kg && ` · ${formatNumber(h.unit_weight_kg)} kg c/u`}
        </span>
      )}
    </>
  )
}

// -----------------------------------------------------------------------------
// Cortes
// -----------------------------------------------------------------------------
export function HarvestsTable({
  rows,
  organizationId,
  canWrite,
  projects,
  employees,
}: {
  rows: Harvest[]
  organizationId: string
  canWrite: boolean
  projects: OpenProject[]
  employees: SelectOption[]
}) {
  const [query, setQuery] = useState("")
  const filtered = rows.filter((h) =>
    matchesQuery(query, h.lot_code, h.project.code, h.project.name, product(h), h.assignment.plot.name, h.classification)
  )

  return (
    <div className="space-y-3">
      <SearchInput value={query} onChange={setQuery} placeholder="Buscar por lote, proyecto, parcela o cultivo" />
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Corte / lote</TableHead>
              <TableHead className="hidden md:table-cell">Proyecto · parcela</TableHead>
              <TableHead className="hidden sm:table-cell">Calidad</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
              <TableHead className="hidden lg:table-cell">Responsable</TableHead>
              <TableHead className="w-32">
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && <EmptyRow colSpan={6} text="Sin cortes en el periodo." />}
            {filtered.map((h) => {
              const closed = isClosed(h.project.status)
              const moved = n(h.sold_kg) > 0 || n(h.adjusted_kg) !== 0
              const editProjects = projects.some((p) => p.id === h.project.id)
                ? projects
                : [] // proyecto cerrado o fuera de cosecha: no se edita
              return (
                <TableRow key={h.id}>
                  <TableCell>
                    <p className="font-medium">
                      Corte {h.cut_number} · {formatDate(h.harvest_date)}
                    </p>
                    <Link href={`/produccion/lotes/${h.id}`} className="text-xs text-muted-foreground hover:underline">
                      {h.lot_code}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Link href={`/proyectos/${h.project.id}`} className="hover:underline">
                      {h.project.code}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {product(h)} · {h.assignment.plot.name}
                    </p>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {QUALITY_LABELS[h.quality]}
                    {h.classification && <p className="text-xs text-muted-foreground">{h.classification}</p>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <Quantity h={h} />
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">{h.responsible?.full_name ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <EvidenceDialog
                        organizationId={organizationId}
                        entity="harvest"
                        entityId={h.id}
                        title={`${h.lot_code} · corte ${h.cut_number}`}
                        canAdd={canWrite}
                      />
                      {canWrite && !closed && editProjects.length > 0 && (
                        <HarvestDialog
                          organizationId={organizationId}
                          projects={editProjects}
                          employees={employees}
                          locked={moved}
                          record={{
                            id: h.id,
                            lotCode: h.lot_code,
                            projectId: h.project.id,
                            plotId: h.assignment.plot.id,
                            date: h.harvest_date,
                            cutNumber: String(h.cut_number),
                            quality: h.quality,
                            classification: h.classification ?? "",
                            unit: h.unit,
                            quantity: toInput(h.quantity),
                            unitWeightKg: toInput(h.unit_weight_kg),
                            packages: toInput(h.packages),
                            responsibleId: h.responsible_id ?? NONE,
                            notes: h.notes ?? "",
                          }}
                          trigger={
                            <Button variant="ghost" size="icon" aria-label={`Corregir ${h.lot_code}`}>
                              <Pencil aria-hidden />
                            </Button>
                          }
                        />
                      )}
                      {canWrite && !closed && !moved && (
                        <ConfirmAction
                          title="Eliminar corte"
                          description={`Se eliminará el lote ${h.lot_code} (${formatNumber(h.quantity_kg, "kg")}) y sus fotografías.`}
                          confirmLabel="Eliminar"
                          action={() => deleteHarvest(h.id)}
                          trigger={
                            <Button variant="ghost" size="icon" aria-label={`Eliminar ${h.lot_code}`}>
                              <Trash2 aria-hidden />
                            </Button>
                          }
                        />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Inventario de producto cosechado (un renglón por lote)
// -----------------------------------------------------------------------------
export function LotsTable({ rows, canAdjust }: { rows: Harvest[]; canAdjust: boolean }) {
  const [query, setQuery] = useState("")
  const [onlyAvailable, setOnlyAvailable] = useState(true)
  const filtered = useMemo(
    () =>
      rows.filter(
        (h) =>
          (!onlyAvailable || n(h.available_kg) > 0) &&
          matchesQuery(query, h.lot_code, h.project.code, product(h), h.assignment.plot.name)
      ),
    [rows, query, onlyAvailable]
  )
  const total = (f: (h: Harvest) => number) => filtered.reduce((t, h) => t + f(h), 0)

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput value={query} onChange={setQuery} placeholder="Buscar lote, proyecto o producto" />
        <div className="flex items-center gap-2">
          <Checkbox id="lots-available" checked={onlyAvailable} onCheckedChange={(v) => setOnlyAvailable(v === true)} />
          <Label htmlFor="lots-available" className="text-sm font-normal">
            Solo con existencia
          </Label>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lote · producto</TableHead>
              <TableHead className="hidden md:table-cell">Proyecto · parcela</TableHead>
              <TableHead className="hidden lg:table-cell">Cosecha</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Inicial</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Vendido</TableHead>
              <TableHead className="hidden text-right xl:table-cell">Mermas y ajustes</TableHead>
              <TableHead className="text-right">Disponible</TableHead>
              <TableHead className="w-24">
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && <EmptyRow colSpan={8} text="Sin lotes que mostrar." />}
            {filtered.map((h) => (
              <TableRow key={h.id}>
                <TableCell>
                  <Link href={`/produccion/lotes/${h.id}`} className="font-medium hover:underline">
                    {h.lot_code}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {product(h)} · {QUALITY_LABELS[h.quality]}
                  </p>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {h.project.code}
                  <p className="text-xs text-muted-foreground">{h.assignment.plot.name}</p>
                </TableCell>
                <TableCell className="hidden whitespace-nowrap lg:table-cell">{formatDate(h.harvest_date)}</TableCell>
                <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatNumber(h.quantity_kg)}</TableCell>
                <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatNumber(h.sold_kg)}</TableCell>
                <TableCell className="hidden text-right tabular-nums xl:table-cell">{formatNumber(h.adjusted_kg)}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">{formatNumber(h.available_kg, "kg")}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    {canAdjust && !isClosed(h.project.status) && (
                      <AdjustmentDialog
                        lot={{ id: h.id, lotCode: h.lot_code, availableKg: n(h.available_kg), harvestDate: h.harvest_date }}
                        trigger={
                          <Button variant="ghost" size="icon" aria-label={`Merma o ajuste de ${h.lot_code}`}>
                            <SlidersHorizontal aria-hidden />
                          </Button>
                        }
                      />
                    )}
                    <Button asChild variant="ghost" size="icon">
                      <Link href={`/produccion/lotes/${h.id}`} aria-label={`Trazabilidad de ${h.lot_code}`}>
                        <Route aria-hidden />
                      </Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          {filtered.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell className="font-medium">{formatNumber(filtered.length)} lotes</TableCell>
                <TableCell className="hidden md:table-cell" />
                <TableCell className="hidden lg:table-cell" />
                <TableCell className="hidden text-right font-semibold tabular-nums sm:table-cell">
                  {formatNumber(total((h) => n(h.quantity_kg)))}
                </TableCell>
                <TableCell className="hidden text-right font-semibold tabular-nums sm:table-cell">
                  {formatNumber(total((h) => n(h.sold_kg)))}
                </TableCell>
                <TableCell className="hidden text-right font-semibold tabular-nums xl:table-cell">
                  {formatNumber(total((h) => n(h.adjusted_kg)))}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatNumber(total((h) => n(h.available_kg)), "kg")}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Movimientos de producto
// -----------------------------------------------------------------------------
const REVERSIBLE = new Set(["merma", "perdida", "ajuste_entrada", "ajuste_salida"])

export function MovementsTable({
  rows,
  canAdjust,
  showLot = true,
}: {
  rows: ProductionMovement[]
  canAdjust: boolean
  showLot?: boolean
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Movimiento</TableHead>
            {showLot && <TableHead className="hidden sm:table-cell">Lote</TableHead>}
            <TableHead className="text-right">Kg</TableHead>
            <TableHead className="hidden text-right md:table-cell">Disponible después</TableHead>
            <TableHead className="w-12">
              <span className="sr-only">Acciones</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && <EmptyRow colSpan={showLot ? 5 : 4} text="Sin movimientos." />}
          {rows.map((m) => {
            const qty = n(m.quantity_kg)
            return (
              <TableRow key={m.id} className={cn(m.reversed && "opacity-60")}>
                <TableCell>
                  <p className="font-medium">
                    {MOVEMENT_LABELS[m.movement_type]}
                    {m.reversed && (
                      <Badge variant="outline" className="ml-2">
                        Revertido
                      </Badge>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(m.movement_date)}
                    {m.sale && (
                      <>
                        {" · "}
                        <Link href={`/ventas/${m.sale.id}`} className="hover:underline">
                          {m.sale.code}
                        </Link>
                      </>
                    )}
                    {m.reason && ` · ${m.reason}`}
                  </p>
                </TableCell>
                {showLot && (
                  <TableCell className="hidden sm:table-cell">
                    <Link href={`/produccion/lotes/${m.lot.id}`} className="hover:underline">
                      {m.lot.lot_code}
                    </Link>
                    <p className="text-xs text-muted-foreground">{m.lot.project.code}</p>
                  </TableCell>
                )}
                <TableCell className={cn("text-right font-medium tabular-nums", qty < 0 ? "text-destructive" : "text-primary")}>
                  {qty > 0 ? "+" : "−"}
                  {formatNumber(Math.abs(qty))}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums md:table-cell">{formatNumber(m.available_after)}</TableCell>
                <TableCell>
                  {canAdjust && REVERSIBLE.has(m.movement_type) && !m.reversed && !isClosed(m.lot.project.status) && (
                    <ReasonDialog
                      title="Revertir movimiento"
                      description={`Se registrará la contrapartida de ${formatNumber(Math.abs(qty), "kg")} en ${m.lot.lot_code}. El movimiento original se conserva.`}
                      confirmLabel="Revertir"
                      action={reverseAdjustment.bind(null, newId(), m.id)}
                      trigger={
                        <Button variant="ghost" size="icon" aria-label="Revertir movimiento">
                          <Undo2 aria-hidden />
                        </Button>
                      }
                    />
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
