"use client"

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
import { saveMachine } from "../actions"
import { MACHINE_KIND_LABELS, MACHINE_KINDS, machineSchema, type MachineInput } from "../schemas"

const EMPTY: MachineInput = { name: "", code: "", kind: "tractor", hourlyCost: "", notes: "" }

export function MachineFormDialog({ trigger, machine }: { trigger: React.ReactNode; machine?: MachineInput }) {
  const [open, setOpen] = useState(false)
  const defaults = machine ?? EMPTY
  const { form, onSubmit, pending } = useActionForm<MachineInput>({
    schema: machineSchema,
    defaultValues: defaults,
    action: saveMachine,
    onSuccess: () => setOpen(false),
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (value) form.reset(defaults)
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <form onSubmit={onSubmit} noValidate className="grid gap-6">
          <DialogHeader>
            <DialogTitle>{machine ? "Editar equipo" : "Nuevo equipo"}</DialogTitle>
            <DialogDescription>
              Cambiar la tarifa no modifica los costos ya registrados: cada uso guarda la tarifa vigente.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="grid gap-5 sm:grid-cols-2">
            <FormInput control={form.control} name="name" label="Nombre" placeholder="Ej. Tractor John Deere 6110" className="sm:col-span-2" />
            <FormInput control={form.control} name="code" label="Clave / económico" placeholder="Ej. TR-01" />
            <FormSelect
              control={form.control}
              name="kind"
              label="Tipo"
              options={MACHINE_KINDS.map((k) => ({ value: k, label: MACHINE_KIND_LABELS[k] }))}
            />
            <FormInput
              control={form.control}
              name="hourlyCost"
              label="Costo por hora (MXN)"
              inputMode="decimal"
              className="sm:col-span-2"
              description="Operador, depreciación y mantenimiento. Excluye el combustible si se surte del inventario, para no contarlo dos veces."
            />
            <FormTextarea control={form.control} name="notes" label="Notas" className="sm:col-span-2" />
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <SubmitButton pending={pending}>{machine ? "Guardar cambios" : "Registrar equipo"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
