"use client"

import { Pencil, Power, PowerOff, Search, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"

import { ConfirmAction } from "@/components/shared/confirm-action"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatNumber } from "@/lib/format"
import { toInput } from "@/lib/validation"
import { deleteCrop, setCropActive } from "../actions"
import type { Crop } from "../queries"
import { YIELD_UNIT_LABELS, type YieldUnit } from "../schemas"
import { CropFormDialog } from "./crop-form-dialog"

export function CropsTable({ crops, canWrite, canDelete }: { crops: Crop[]; canWrite: boolean; canDelete: boolean }) {
  const [query, setQuery] = useState("")
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return crops
    return crops.filter((c) => [c.name, c.variety, c.scientific_name].some((v) => v?.toLowerCase().includes(q)))
  }, [crops, query])

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por cultivo o variedad"
          className="pl-8"
          aria-label="Buscar cultivos"
        />
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cultivo</TableHead>
              <TableHead className="hidden md:table-cell">Ciclo</TableHead>
              <TableHead className="hidden sm:table-cell">Unidad</TableHead>
              <TableHead className="text-right">Proyectos vigentes</TableHead>
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
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  No se encontraron cultivos.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((c) => {
              const label = c.variety ? `${c.name} · ${c.variety}` : c.name
              return (
                <TableRow key={c.id} className={c.is_active ? undefined : "opacity-60"}>
                  <TableCell>
                    <p className="font-medium">
                      {c.name}
                      {c.variety && <span className="font-normal text-muted-foreground"> · {c.variety}</span>}
                      {!c.is_active && (
                        <Badge variant="destructive" className="ml-2">
                          Inactivo
                        </Badge>
                      )}
                    </p>
                    {c.scientific_name && <p className="text-xs text-muted-foreground italic">{c.scientific_name}</p>}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {c.cycle_days ? `${formatNumber(c.cycle_days)} días` : "—"}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{YIELD_UNIT_LABELS[c.yield_unit as YieldUnit]}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(c.activeProjectCount)}
                    {c.projectCount > c.activeProjectCount && (
                      <span className="block text-xs text-muted-foreground">{formatNumber(c.projectCount)} en total</span>
                    )}
                  </TableCell>
                  {(canWrite || canDelete) && (
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {canWrite && (
                          <CropFormDialog
                            crop={{
                              id: c.id,
                              name: c.name,
                              variety: c.variety ?? "",
                              scientificName: c.scientific_name ?? "",
                              cycleDays: toInput(c.cycle_days),
                              yieldUnit: c.yield_unit as YieldUnit,
                              notes: c.notes ?? "",
                            }}
                            trigger={
                              <Button variant="ghost" size="icon" aria-label={`Editar ${label}`}>
                                <Pencil aria-hidden />
                              </Button>
                            }
                          />
                        )}
                        {canWrite && (
                          <ConfirmAction
                            title={c.is_active ? "Desactivar cultivo" : "Reactivar cultivo"}
                            description={
                              c.is_active
                                ? `"${label}" ya no se ofrecerá al crear proyectos. Los proyectos existentes no cambian.`
                                : `"${label}" volverá a estar disponible para nuevos proyectos.`
                            }
                            confirmLabel={c.is_active ? "Desactivar" : "Reactivar"}
                            destructive={c.is_active}
                            action={() => setCropActive(c.id, !c.is_active)}
                            trigger={
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={c.is_active ? `Desactivar ${label}` : `Reactivar ${label}`}
                              >
                                {c.is_active ? <PowerOff aria-hidden /> : <Power aria-hidden />}
                              </Button>
                            }
                          />
                        )}
                        {canDelete && c.projectCount === 0 && (
                          <ConfirmAction
                            title="Eliminar cultivo"
                            description={`Se eliminará "${label}" de forma permanente.`}
                            confirmLabel="Eliminar"
                            action={() => deleteCrop(c.id)}
                            trigger={
                              <Button variant="ghost" size="icon" aria-label={`Eliminar ${label}`}>
                                <Trash2 aria-hidden />
                              </Button>
                            }
                          />
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
