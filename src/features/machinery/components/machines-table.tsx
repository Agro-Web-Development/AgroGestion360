"use client"

import { Pencil, Power, PowerOff, Trash2 } from "lucide-react"

import { ConfirmAction } from "@/components/shared/confirm-action"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatMoney, formatNumber } from "@/lib/format"
import { deleteMachine, setMachineActive } from "../actions"
import type { Machine } from "../queries"
import { MACHINE_KIND_LABELS } from "../schemas"
import { MachineFormDialog } from "./machine-form-dialog"

export function MachinesTable({ machines, canWrite, canDelete }: { machines: Machine[]; canWrite: boolean; canDelete: boolean }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Equipo</TableHead>
            <TableHead className="hidden sm:table-cell">Tipo</TableHead>
            <TableHead className="text-right">Tarifa / h</TableHead>
            <TableHead className="hidden text-right md:table-cell">Horas registradas</TableHead>
            <TableHead className="hidden text-right md:table-cell">Costo cargado</TableHead>
            {(canWrite || canDelete) && (
              <TableHead className="w-28">
                <span className="sr-only">Acciones</span>
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {machines.map((m) => (
            <TableRow key={m.id} className={m.is_active ? undefined : "opacity-60"}>
              <TableCell>
                <p className="font-medium">
                  {m.name}
                  {!m.is_active && (
                    <Badge variant="destructive" className="ml-2">
                      Inactivo
                    </Badge>
                  )}
                </p>
                {m.code && <p className="text-xs text-muted-foreground">{m.code}</p>}
              </TableCell>
              <TableCell className="hidden sm:table-cell">{MACHINE_KIND_LABELS[m.kind]}</TableCell>
              <TableCell className="text-right tabular-nums">{formatMoney(m.hourly_cost)}</TableCell>
              <TableCell className="hidden text-right tabular-nums md:table-cell">{formatNumber(m.totalHours, "h")}</TableCell>
              <TableCell className="hidden text-right tabular-nums md:table-cell">{formatMoney(m.totalCost)}</TableCell>
              {(canWrite || canDelete) && (
                <TableCell>
                  <div className="flex justify-end gap-1">
                    {canWrite && (
                      <MachineFormDialog
                        machine={{
                          id: m.id,
                          name: m.name,
                          code: m.code ?? "",
                          kind: m.kind,
                          hourlyCost: String(m.hourly_cost),
                          notes: m.notes ?? "",
                        }}
                        trigger={
                          <Button variant="ghost" size="icon" aria-label={`Editar ${m.name}`}>
                            <Pencil aria-hidden />
                          </Button>
                        }
                      />
                    )}
                    {canWrite && (
                      <ConfirmAction
                        title={m.is_active ? "Desactivar equipo" : "Reactivar equipo"}
                        description={
                          m.is_active
                            ? `"${m.name}" ya no se ofrecerá para registrar uso. Su historial se conserva.`
                            : `"${m.name}" volverá a estar disponible.`
                        }
                        confirmLabel={m.is_active ? "Desactivar" : "Reactivar"}
                        destructive={m.is_active}
                        action={() => setMachineActive(m.id, !m.is_active)}
                        trigger={
                          <Button variant="ghost" size="icon" aria-label={m.is_active ? `Desactivar ${m.name}` : `Reactivar ${m.name}`}>
                            {m.is_active ? <PowerOff aria-hidden /> : <Power aria-hidden />}
                          </Button>
                        }
                      />
                    )}
                    {canDelete && m.usageCount === 0 && (
                      <ConfirmAction
                        title="Eliminar equipo"
                        description={`Se eliminará "${m.name}" de forma permanente.`}
                        confirmLabel="Eliminar"
                        action={() => deleteMachine(m.id)}
                        trigger={
                          <Button variant="ghost" size="icon" aria-label={`Eliminar ${m.name}`}>
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
