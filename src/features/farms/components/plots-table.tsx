"use client"

import { Pencil, Power, PowerOff, Trash2 } from "lucide-react"
import Link from "next/link"

import { ConfirmAction } from "@/components/shared/confirm-action"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatNumber } from "@/lib/format"
import { toInput } from "@/lib/validation"
import { deletePlot, setPlotActive } from "../actions"
import type { Plot } from "../queries"
import { IRRIGATION_LABELS } from "../schemas"
import { PlotFormDialog } from "./plot-form-dialog"

export function PlotsTable({
  plots,
  canWrite,
  canDelete,
}: {
  plots: Plot[]
  canWrite: boolean
  canDelete: boolean
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Parcela</TableHead>
            <TableHead className="text-right">Superficie</TableHead>
            <TableHead className="text-right">Disponible</TableHead>
            <TableHead className="hidden md:table-cell">Riego</TableHead>
            <TableHead className="hidden lg:table-cell">Proyectos vigentes</TableHead>
            {(canWrite || canDelete) && (
              <TableHead className="w-28">
                <span className="sr-only">Acciones</span>
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {plots.map((p) => (
            <TableRow key={p.id} className={p.is_active ? undefined : "opacity-60"}>
              <TableCell>
                <p className="font-medium">
                  {p.name}
                  {!p.is_active && (
                    <Badge variant="destructive" className="ml-2">
                      Inactiva
                    </Badge>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {[p.code, p.soil_type].filter(Boolean).join(" · ") || "—"}
                </p>
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(p.area_ha, "ha")}</TableCell>
              <TableCell className="text-right tabular-nums">
                <span className={p.availableArea === 0 ? "text-muted-foreground" : undefined}>
                  {formatNumber(p.availableArea, "ha")}
                </span>
              </TableCell>
              <TableCell className="hidden md:table-cell">{IRRIGATION_LABELS[p.irrigation_type]}</TableCell>
              <TableCell className="hidden lg:table-cell">
                {p.projects.length === 0 ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <ul className="space-y-0.5 text-sm">
                    {p.projects.map((pr) => (
                      <li key={pr.id}>
                        <Link href={`/proyectos/${pr.id}`} className="hover:underline">
                          {pr.code}
                        </Link>{" "}
                        <span className="text-muted-foreground">· {formatNumber(pr.area, "ha")}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </TableCell>
              {(canWrite || canDelete) && (
                <TableCell>
                  <div className="flex justify-end gap-1">
                    {canWrite && (
                      <PlotFormDialog
                        plot={{
                          id: p.id,
                          farmId: p.farm_id,
                          name: p.name,
                          code: p.code ?? "",
                          areaHa: toInput(p.area_ha),
                          soilType: p.soil_type ?? "",
                          irrigationType: p.irrigation_type,
                          notes: p.notes ?? "",
                        }}
                        availableHint={
                          p.assignedArea > 0
                            ? `Tiene ${formatNumber(p.assignedArea, "ha")} asignadas a proyectos vigentes; la superficie no puede ser menor.`
                            : undefined
                        }
                        trigger={
                          <Button variant="ghost" size="icon" aria-label={`Editar ${p.name}`}>
                            <Pencil aria-hidden />
                          </Button>
                        }
                      />
                    )}
                    {canWrite && (
                      <ConfirmAction
                        title={p.is_active ? "Desactivar parcela" : "Reactivar parcela"}
                        description={
                          p.is_active
                            ? `"${p.name}" dejará de estar disponible para nuevos proyectos. Su historial se conserva.`
                            : `"${p.name}" volverá a estar disponible para asignarse a proyectos.`
                        }
                        confirmLabel={p.is_active ? "Desactivar" : "Reactivar"}
                        destructive={p.is_active}
                        action={() => setPlotActive(p.id, !p.is_active)}
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={p.is_active ? `Desactivar ${p.name}` : `Reactivar ${p.name}`}
                          >
                            {p.is_active ? <PowerOff aria-hidden /> : <Power aria-hidden />}
                          </Button>
                        }
                      />
                    )}
                    {canDelete && !p.hasHistory && (
                      <ConfirmAction
                        title="Eliminar parcela"
                        description={`Se eliminará "${p.name}" de forma permanente.`}
                        confirmLabel="Eliminar"
                        action={() => deletePlot(p.id)}
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
      </Table>
    </div>
  )
}
