"use client"

import { Ban, Pencil, Wrench } from "lucide-react"
import { useState } from "react"

import { FormDialog } from "@/components/forms/form-dialog"
import { FormInput } from "@/components/forms/form-input"
import { FormSelect, type SelectOption } from "@/components/forms/form-select"
import { FormTextarea } from "@/components/forms/form-textarea"
import { useActionForm } from "@/components/forms/use-action-form"
import { ReasonDialog } from "@/components/shared/reason-dialog"
import { matchesQuery, SearchInput } from "@/components/shared/search-input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cancelFieldRecord } from "@/features/fieldlogs/actions"
import { EvidenceDialog, PhotoInput, uploadEvidence } from "@/features/fieldlogs/components/evidence"
import { formatDate, formatMoney, formatNumber, todayISO } from "@/lib/format"
import { newId } from "@/lib/ids"
import { NONE, toInput } from "@/lib/validation"
import { saveMaintenance } from "../actions"
import type { Maintenance } from "../queries"
import { MAINTENANCE_KIND_LABELS, MAINTENANCE_KINDS, maintenanceSchema, type MaintenanceInput } from "../schemas"

export function MaintenanceDialog({
  organizationId,
  machines,
  employees,
  record,
  trigger,
}: {
  organizationId: string
  machines: SelectOption[]
  employees: SelectOption[]
  record?: MaintenanceInput
  trigger?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const empty = (): MaintenanceInput => ({
    id: newId(),
    machineId: "",
    date: todayISO(),
    kind: "preventivo",
    description: "",
    provider: "",
    cost: "",
    hourMeter: "",
    responsibleId: NONE,
    notes: "",
  })
  const { form, onSubmit, pending } = useActionForm<MaintenanceInput>({
    schema: maintenanceSchema,
    defaultValues: record ?? empty(),
    action: (values) => saveMaintenance(values, Boolean(record)),
    onSuccess: () => {
      void uploadEvidence(organizationId, "machinery_maintenance", form.getValues("id"), files)
      setFiles([])
      setOpen(false)
    },
  })

  return (
    <FormDialog
      trigger={
        trigger ?? (
          <Button variant="outline" disabled={machines.length === 0}>
            <Wrench aria-hidden /> Registrar mantenimiento
          </Button>
        )
      }
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (value) {
          form.reset(record ?? empty())
          setFiles([])
        }
      }}
      title={record ? "Editar mantenimiento" : "Mantenimiento o reparación"}
      description="Costo del equipo: no se carga a proyectos (la tarifa de uso ya lo considera). Un preventivo reinicia la alerta de horas."
      onSubmit={onSubmit}
      pending={pending}
      submitLabel={record ? "Guardar cambios" : "Registrar"}
    >
      <FieldGroup className="grid gap-5 sm:grid-cols-2">
        <FormSelect control={form.control} name="machineId" label="Equipo" options={machines} disabled={Boolean(record)} />
        <FormSelect
          control={form.control}
          name="kind"
          label="Tipo"
          options={MAINTENANCE_KINDS.map((k) => ({ value: k, label: MAINTENANCE_KIND_LABELS[k] }))}
        />
        <FormInput control={form.control} name="date" label="Fecha" type="date" max={todayISO()} />
        <FormInput control={form.control} name="hourMeter" label="Horómetro (opcional)" inputMode="decimal" />
        <FormInput control={form.control} name="description" label="Descripción" className="sm:col-span-2" placeholder="Ej. Cambio de aceite y filtros" />
        <FormInput control={form.control} name="provider" label="Taller / proveedor" />
        <FormInput control={form.control} name="cost" label="Costo (MXN)" inputMode="decimal" />
        <div className="sm:col-span-2">
          <FormSelect
            control={form.control}
            name="responsibleId"
            label="Responsable"
            options={[{ value: NONE, label: "Sin responsable" }, ...employees]}
          />
        </div>
        <FormTextarea control={form.control} name="notes" label="Observaciones" rows={2} className="sm:col-span-2" />
        {!record && <PhotoInput files={files} onChange={setFiles} />}
      </FieldGroup>
    </FormDialog>
  )
}

export function MaintenanceTable({
  records,
  organizationId,
  machines,
  employees,
  canWrite,
}: {
  records: Maintenance[]
  organizationId: string
  machines: SelectOption[]
  employees: SelectOption[]
  canWrite: boolean
}) {
  const [query, setQuery] = useState("")
  const filtered = records.filter((r) => matchesQuery(query, r.machine.name, r.description, r.provider, r.notes))
  const active = filtered.filter((r) => r.status !== "cancelado")
  const total = active.reduce((s, r) => s + Number(r.cost), 0)
  const repairs = active.filter((r) => r.kind === "correctivo").reduce((s, r) => s + Number(r.cost), 0)

  return (
    <div className="space-y-3">
      <SearchInput value={query} onChange={setQuery} placeholder="Buscar equipo, servicio o taller" />
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Equipo / servicio</TableHead>
              <TableHead className="hidden md:table-cell">Taller / responsable</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Horómetro</TableHead>
              <TableHead className="text-right">Costo</TableHead>
              <TableHead className="w-28">
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Sin mantenimientos registrados.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((r) => {
              const cancelled = r.status === "cancelado"
              return (
                <TableRow key={r.id} className={cancelled ? "opacity-60" : undefined}>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(r.maintenance_date)}
                    {cancelled && (
                      <Badge variant="destructive" title={r.cancel_reason ?? undefined}>
                        Cancelado
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{r.machine.name}</p>
                    <p className="text-xs text-muted-foreground">
                      <Badge variant={r.kind === "correctivo" ? "outline" : "secondary"} className="mr-1">
                        {r.kind === "correctivo" ? "Reparación" : "Preventivo"}
                      </Badge>
                      {r.description}
                    </p>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {r.provider ?? "—"}
                    {r.responsible && <p className="text-xs text-muted-foreground">{r.responsible.full_name}</p>}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">
                    {r.hour_meter !== null ? formatNumber(r.hour_meter, "h") : "—"}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatMoney(r.cost)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <EvidenceDialog
                        organizationId={organizationId}
                        entity="machinery_maintenance"
                        entityId={r.id}
                        title={`${r.machine.name} · ${formatDate(r.maintenance_date)}`}
                        canAdd={canWrite && !cancelled}
                      />
                      {canWrite && !cancelled && (
                        <>
                          <MaintenanceDialog
                            organizationId={organizationId}
                            machines={machines}
                            employees={employees}
                            record={{
                              id: r.id,
                              machineId: r.machine_id,
                              date: r.maintenance_date,
                              kind: r.kind,
                              description: r.description,
                              provider: r.provider ?? "",
                              cost: toInput(r.cost),
                              hourMeter: toInput(r.hour_meter),
                              responsibleId: r.responsible_id ?? NONE,
                              notes: r.notes ?? "",
                            }}
                            trigger={
                              <Button variant="ghost" size="icon" aria-label="Editar mantenimiento">
                                <Pencil aria-hidden />
                              </Button>
                            }
                          />
                          <ReasonDialog
                            title="Cancelar mantenimiento"
                            description="El registro queda en el historial como cancelado y deja de contar para alertas y costos del equipo."
                            confirmLabel="Cancelar registro"
                            action={(reason) => cancelFieldRecord("mantenimiento", r.id, reason)}
                            trigger={
                              <Button variant="ghost" size="icon" aria-label="Cancelar mantenimiento">
                                <Ban aria-hidden />
                              </Button>
                            }
                          />
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
          {active.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="font-medium">
                  Total ({formatNumber(active.length)}) · reparaciones {formatMoney(repairs)}
                </TableCell>
                <TableCell className="hidden md:table-cell" />
                <TableCell className="hidden sm:table-cell" />
                <TableCell className="text-right font-semibold tabular-nums">{formatMoney(total)}</TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  )
}
