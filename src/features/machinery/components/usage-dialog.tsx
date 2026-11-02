"use client"

import { Plus } from "lucide-react"
import { useState } from "react"

import { FormInput } from "@/components/forms/form-input"
import { FormSelect } from "@/components/forms/form-select"
import { FormTextarea } from "@/components/forms/form-textarea"
import { SubmitButton } from "@/components/forms/submit-button"
import { useActionForm } from "@/components/forms/use-action-form"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { FieldGroup } from "@/components/ui/field"
import { ProjectPlotFields } from "@/features/projects/components/project-plot-fields"
import type { OpenProject } from "@/features/projects/queries"
import { formatMoney, todayISO } from "@/lib/format"
import { newId } from "@/lib/ids"
import { registerUsage } from "../actions"
import type { Machine } from "../queries"
import { usageSchema, type UsageInput } from "../schemas"

function emptyUsage(): UsageInput {
  return {
    id: newId(),
    machineId: "",
    projectId: "",
    plotId: "",
    date: todayISO(),
    hours: "",
    hourlyRate: "",
    operator: "",
    activity: "",
    notes: "",
  }
}

export function UsageDialog({ machines, projects }: { machines: Machine[]; projects: OpenProject[] }) {
  const [open, setOpen] = useState(false)
  const active = machines.filter((m) => m.is_active)
  const { form, onSubmit, pending } = useActionForm<UsageInput>({
    schema: usageSchema,
    defaultValues: emptyUsage(),
    action: registerUsage,
    onSuccess: () => setOpen(false),
  })
  const machine = active.find((m) => m.id === form.watch("machineId"))
  const hours = Number(form.watch("hours"))
  const rateText = form.watch("hourlyRate")?.replace(/,/g, "") ?? ""
  const rate = rateText !== "" ? Number(rateText) : machine ? Number(machine.hourly_cost) : NaN
  const estimate = hours > 0 && Number.isFinite(rate) ? hours * rate : null

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (value) form.reset(emptyUsage())
      }}
    >
      <DialogTrigger asChild>
        <Button disabled={active.length === 0 || projects.length === 0}>
          <Plus aria-hidden /> Registrar uso
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <form onSubmit={onSubmit} noValidate className="grid gap-6">
          <DialogHeader>
            <DialogTitle>Uso de maquinaria</DialogTitle>
            <DialogDescription>Las horas se cargan al proyecto con la tarifa vigente del equipo.</DialogDescription>
          </DialogHeader>
          <FieldGroup className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FormSelect
                control={form.control}
                name="machineId"
                label="Equipo"
                options={active.map((m) => ({ value: m.id, label: `${m.name} · ${formatMoney(m.hourly_cost)}/h` }))}
              />
            </div>
            <ProjectPlotFields
              control={form.control}
              setValue={form.setValue}
              projects={projects}
              projectName="projectId"
              plotName="plotId"
            />
            <FormInput control={form.control} name="date" label="Fecha" type="date" max={todayISO()} />
            <FormInput control={form.control} name="hours" label="Horas" inputMode="decimal" />
            <FormInput
              control={form.control}
              name="hourlyRate"
              label="Tarifa por hora (opcional)"
              inputMode="decimal"
              description="Vacío = tarifa del equipo. Úsala para equipo rentado."
            />
            <FormInput control={form.control} name="operator" label="Operador" />
            <FormInput control={form.control} name="activity" label="Labor" placeholder="Ej. Rastreo" className="sm:col-span-2" />
            <FormTextarea control={form.control} name="notes" label="Notas" rows={2} className="sm:col-span-2" />
          </FieldGroup>
          {estimate !== null && (
            <p className="rounded-md bg-muted px-3 py-2 text-sm">
              Costo a cargar: <span className="font-semibold tabular-nums">{formatMoney(estimate)}</span>
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <SubmitButton pending={pending}>Registrar</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
