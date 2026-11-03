"use client"

import { Ellipsis, Pencil, Trash2 } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import type { SelectOption } from "@/components/forms/form-select"
import { ConfirmAction } from "@/components/shared/confirm-action"
import { matchesQuery, SearchInput } from "@/components/shared/search-input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDate, formatMoney, formatNumber } from "@/lib/format"
import { toInput, NONE } from "@/lib/validation"
import { deleteMachine, setMachineStatus } from "../actions"
import type { Machine } from "../queries"
import {
  MACHINE_KIND_LABELS,
  MACHINE_STATUS_LABELS,
  MACHINE_STATUSES,
  MAINTENANCE_ALERT_LABELS,
  type MachineStatus,
  type MaintenanceAlert,
} from "../schemas"
import { MachineFormDialog } from "./machine-form-dialog"

export function MaintenanceAlertBadge({ alert }: { alert: MaintenanceAlert }) {
  if (alert === "al_dia" || alert === "no_aplica" || alert === "sin_programa") return null
  return (
    <Badge variant={alert === "vencido" ? "destructive" : "outline"} className={alert === "proximo" ? "border-warning" : undefined}>
      {MAINTENANCE_ALERT_LABELS[alert]}
    </Badge>
  )
}

const STATUS_VARIANT: Record<MachineStatus, "secondary" | "outline" | "destructive"> = {
  operativa: "secondary",
  en_mantenimiento: "outline",
  fuera_servicio: "destructive",
  baja: "destructive",
}

function StatusMenu({ machine }: { machine: Machine }) {
  const [pending, startTransition] = useTransition()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Cambiar estado de ${machine.name}`} disabled={pending}>
          <Ellipsis aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Estado del equipo</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={machine.status}
          onValueChange={(value) =>
            startTransition(async () => {
              const result = await setMachineStatus(machine.id, value as MachineStatus)
              if (result.ok) toast.success(result.message)
              else toast.error(result.error)
            })
          }
        >
          {MACHINE_STATUSES.map((s) => (
            <DropdownMenuRadioItem key={s} value={s}>
              {MACHINE_STATUS_LABELS[s]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function MachinesTable({
  machines,
  employees,
  canWrite,
  canDelete,
}: {
  machines: Machine[]
  employees: SelectOption[]
  canWrite: boolean
  canDelete: boolean
}) {
  const [query, setQuery] = useState("")
  const filtered = machines.filter((m) =>
    matchesQuery(query, m.name, m.code, m.brand, m.model, m.serial_number, MACHINE_KIND_LABELS[m.kind])
  )

  return (
    <div className="space-y-3">
      <SearchInput value={query} onChange={setQuery} placeholder="Buscar por nombre, clave, marca o serie" />
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Equipo</TableHead>
              <TableHead className="hidden sm:table-cell">Estado</TableHead>
              <TableHead className="text-right">Tarifa</TableHead>
              <TableHead className="hidden text-right md:table-cell">Horas / costo cargado</TableHead>
              <TableHead className="hidden lg:table-cell">Mantenimiento</TableHead>
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
                  No se encontraron equipos.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((m) => (
              <TableRow key={m.id} className={m.is_active ? undefined : "opacity-60"}>
                <TableCell>
                  <p className="font-medium">{m.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {[m.code, MACHINE_KIND_LABELS[m.kind], [m.brand, m.model].filter(Boolean).join(" ")].filter(Boolean).join(" · ")}
                  </p>
                  {m.responsible && <p className="text-xs text-muted-foreground">Responsable: {m.responsible.full_name}</p>}
                  <div className="mt-1 flex flex-wrap gap-1 sm:hidden">
                    <Badge variant={STATUS_VARIANT[m.status]}>{MACHINE_STATUS_LABELS[m.status]}</Badge>
                    <MaintenanceAlertBadge alert={m.alert} />
                  </div>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <Badge variant={STATUS_VARIANT[m.status]}>{MACHINE_STATUS_LABELS[m.status]}</Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(m.hourly_cost)}/h
                  {m.daily_rate !== null && <p className="text-xs text-muted-foreground">{formatMoney(m.daily_rate)}/jornada</p>}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums md:table-cell">
                  {formatNumber(m.totalHours, "h")}
                  <p className="text-xs text-muted-foreground">{formatMoney(m.totalCost)}</p>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <MaintenanceAlertBadge alert={m.alert} />
                  <p className="text-xs text-muted-foreground">
                    {m.lastServiceDate ? `Último: ${formatDate(m.lastServiceDate)}` : "Sin servicio registrado"}
                    {m.hoursToService !== null && ` · ${formatNumber(Math.max(m.hoursToService, 0), "h")} restantes`}
                    {m.nextServiceDate && ` · Próximo: ${formatDate(m.nextServiceDate)}`}
                  </p>
                  {m.maintenanceCost > 0 && (
                    <p className="text-xs text-muted-foreground">Gasto en mantenimiento: {formatMoney(m.maintenanceCost)}</p>
                  )}
                </TableCell>
                {(canWrite || canDelete) && (
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {canWrite && (
                        <MachineFormDialog
                          employees={employees}
                          machine={{
                            id: m.id,
                            name: m.name,
                            code: m.code ?? "",
                            kind: m.kind,
                            brand: m.brand ?? "",
                            model: m.model ?? "",
                            serialNumber: m.serial_number ?? "",
                            acquisitionDate: m.acquisition_date ?? "",
                            acquisitionCost: toInput(m.acquisition_cost),
                            status: m.status,
                            responsibleId: m.responsible_id ?? NONE,
                            rateBasis: m.rate_basis,
                            hourlyCost: String(m.hourly_cost),
                            dailyRate: toInput(m.daily_rate),
                            maintenanceIntervalHours: toInput(m.maintenance_interval_hours),
                            maintenanceIntervalDays: toInput(m.maintenance_interval_days),
                            notes: m.notes ?? "",
                          }}
                          trigger={
                            <Button variant="ghost" size="icon" aria-label={`Editar ${m.name}`}>
                              <Pencil aria-hidden />
                            </Button>
                          }
                        />
                      )}
                      {canWrite && <StatusMenu machine={m} />}
                      {canDelete && m.usageCount === 0 && m.maintenanceCount === 0 && (
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
    </div>
  )
}
