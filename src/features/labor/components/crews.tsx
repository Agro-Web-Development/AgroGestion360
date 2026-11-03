"use client"

import { Plus } from "lucide-react"
import { useState } from "react"

import { FormCheckboxList } from "@/components/forms/form-checkbox-list"
import { FormDialog } from "@/components/forms/form-dialog"
import { FormInput } from "@/components/forms/form-input"
import { FormSelect, type SelectOption } from "@/components/forms/form-select"
import { FormTextarea } from "@/components/forms/form-textarea"
import { useActionForm } from "@/components/forms/use-action-form"
import { CatalogRowActions } from "@/components/shared/catalog-row-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FieldGroup } from "@/components/ui/field"
import { formatNumber } from "@/lib/format"
import { NONE } from "@/lib/validation"
import { deleteCrew, saveCrew, setCrewActive } from "../actions"
import type { Crew } from "../queries"
import { crewSchema, type CrewInput } from "../schemas"

export function CrewFormDialog({
  trigger,
  employees,
  crew,
}: {
  trigger: React.ReactNode
  employees: SelectOption[]
  crew?: CrewInput
}) {
  const [open, setOpen] = useState(false)
  const defaults: CrewInput = crew ?? { name: "", leaderId: NONE, memberIds: [], notes: "" }
  const { form, onSubmit, pending } = useActionForm<CrewInput>({
    schema: crewSchema,
    defaultValues: defaults,
    action: saveCrew,
    onSuccess: () => setOpen(false),
  })

  return (
    <FormDialog
      trigger={trigger}
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (value) form.reset(defaults)
      }}
      title={crew ? "Editar cuadrilla" : "Nueva cuadrilla"}
      description="Agrupa trabajadores para registrar sus jornadas en una sola captura."
      onSubmit={onSubmit}
      pending={pending}
      submitLabel={crew ? "Guardar cambios" : "Registrar cuadrilla"}
    >
      <FieldGroup className="grid gap-5 sm:grid-cols-2">
        <FormInput control={form.control} name="name" label="Nombre" placeholder="Ej. Cuadrilla de corte" />
        <FormSelect
          control={form.control}
          name="leaderId"
          label="Jefe de cuadrilla (opcional)"
          options={[{ value: NONE, label: "Sin jefe asignado" }, ...employees]}
        />
        <FormCheckboxList
          control={form.control}
          name="memberIds"
          label="Integrantes"
          options={employees}
          emptyText="Registra empleados para integrarlos a la cuadrilla."
          className="sm:col-span-2"
        />
        <FormTextarea control={form.control} name="notes" label="Observaciones" rows={2} className="sm:col-span-2" />
      </FieldGroup>
    </FormDialog>
  )
}

export function CrewsPanel({
  crews,
  employees,
  canWrite,
  canDelete,
}: {
  crews: Crew[]
  employees: SelectOption[]
  canWrite: boolean
  canDelete: boolean
}) {
  return (
    <div className="space-y-4">
      {canWrite && (
        <div className="flex justify-end">
          <CrewFormDialog
            employees={employees}
            trigger={
              <Button variant="outline">
                <Plus aria-hidden /> Nueva cuadrilla
              </Button>
            }
          />
        </div>
      )}
      {crews.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Sin cuadrillas. Crea una para registrar jornadas de varios trabajadores a la vez.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {crews.map((c) => (
            <Card key={c.id} className={c.is_active ? undefined : "opacity-60"}>
              <CardHeader className="flex flex-row items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <CardTitle className="text-base">
                    {c.name}
                    {!c.is_active && (
                      <Badge variant="destructive" className="ml-2">
                        Inactiva
                      </Badge>
                    )}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {c.leader ? `Jefe: ${c.leader.full_name}` : "Sin jefe asignado"} · {formatNumber(c.recordCount)} jornadas
                  </p>
                </div>
                {(canWrite || canDelete) && (
                  <CatalogRowActions
                    name={c.name}
                    active={c.is_active}
                    editDialog={
                      canWrite
                        ? (trigger) => (
                            <CrewFormDialog
                              trigger={trigger}
                              employees={employees}
                              crew={{
                                id: c.id,
                                name: c.name,
                                leaderId: c.leader_id ?? NONE,
                                memberIds: c.members.filter((m) => m.active).map((m) => m.id),
                                notes: c.notes ?? "",
                              }}
                            />
                          )
                        : undefined
                    }
                    onToggle={canWrite ? () => setCrewActive(c.id, !c.is_active) : undefined}
                    onDelete={canDelete && c.recordCount === 0 ? () => deleteCrew(c.id) : undefined}
                  />
                )}
              </CardHeader>
              <CardContent>
                {c.members.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin integrantes.</p>
                ) : (
                  <ul className="flex flex-wrap gap-1.5">
                    {c.members.map((m) => (
                      <li key={m.id}>
                        <Badge variant={m.active ? "secondary" : "outline"}>
                          {m.name}
                          {!m.active && " (baja)"}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
