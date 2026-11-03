"use client"

import { Pencil, Power, PowerOff, Trash2 } from "lucide-react"

import { ConfirmAction } from "@/components/shared/confirm-action"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDate, formatMoney, formatNumber } from "@/lib/format"
import { deleteEmployee, setEmployeeActive } from "../actions"
import type { Employee } from "../queries"
import { WORKER_TYPE_LABELS } from "../schemas"
import { EmployeeFormDialog } from "./employee-form-dialog"

export function EmployeesTable({
  employees,
  canWrite,
  canDelete,
}: {
  employees: Employee[]
  canWrite: boolean
  canDelete: boolean
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Empleado</TableHead>
            <TableHead className="hidden sm:table-cell">Tipo / ingreso</TableHead>
            <TableHead className="hidden lg:table-cell">Teléfono</TableHead>
            <TableHead className="text-right">Tarifa diaria</TableHead>
            <TableHead className="hidden text-right md:table-cell">Registros</TableHead>
            {(canWrite || canDelete) && (
              <TableHead className="w-28">
                <span className="sr-only">Acciones</span>
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {employees.map((e) => (
            <TableRow key={e.id} className={e.is_active ? undefined : "opacity-60"}>
              <TableCell>
                <p className="font-medium">
                  {e.full_name}
                  {!e.is_active && (
                    <Badge variant="destructive" className="ml-2">
                      Baja
                    </Badge>
                  )}
                </p>
                {e.position && <p className="text-xs text-muted-foreground">{e.position}</p>}
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                {WORKER_TYPE_LABELS[e.worker_type]}
                {e.hire_date && <p className="text-xs text-muted-foreground">Desde {formatDate(e.hire_date)}</p>}
              </TableCell>
              <TableCell className="hidden lg:table-cell">{e.phone ?? "—"}</TableCell>
              <TableCell className="text-right tabular-nums">{formatMoney(e.daily_wage)}</TableCell>
              <TableCell className="hidden text-right tabular-nums md:table-cell">{formatNumber(e.recordCount)}</TableCell>
              {(canWrite || canDelete) && (
                <TableCell>
                  <div className="flex justify-end gap-1">
                    {canWrite && (
                      <EmployeeFormDialog
                        employee={{
                          id: e.id,
                          fullName: e.full_name,
                          position: e.position ?? "",
                          workerType: e.worker_type,
                          phone: e.phone ?? "",
                          hireDate: e.hire_date ?? "",
                          dailyWage: String(e.daily_wage),
                          notes: e.notes ?? "",
                        }}
                        trigger={
                          <Button variant="ghost" size="icon" aria-label={`Editar ${e.full_name}`}>
                            <Pencil aria-hidden />
                          </Button>
                        }
                      />
                    )}
                    {canWrite && (
                      <ConfirmAction
                        title={e.is_active ? "Dar de baja" : "Reactivar empleado"}
                        description={
                          e.is_active
                            ? `${e.full_name} ya no se ofrecerá para registrar jornadas. Su historial se conserva.`
                            : `${e.full_name} volverá a estar disponible.`
                        }
                        confirmLabel={e.is_active ? "Dar de baja" : "Reactivar"}
                        destructive={e.is_active}
                        action={() => setEmployeeActive(e.id, !e.is_active)}
                        trigger={
                          <Button variant="ghost" size="icon" aria-label={e.is_active ? `Dar de baja a ${e.full_name}` : `Reactivar a ${e.full_name}`}>
                            {e.is_active ? <PowerOff aria-hidden /> : <Power aria-hidden />}
                          </Button>
                        }
                      />
                    )}
                    {canDelete && e.recordCount === 0 && (
                      <ConfirmAction
                        title="Eliminar empleado"
                        description={`Se eliminará a ${e.full_name} de forma permanente.`}
                        confirmLabel="Eliminar"
                        action={() => deleteEmployee(e.id)}
                        trigger={
                          <Button variant="ghost" size="icon" aria-label={`Eliminar ${e.full_name}`}>
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
