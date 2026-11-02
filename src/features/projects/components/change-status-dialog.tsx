"use client"

import { ArrowRightLeft } from "lucide-react"
import { useState } from "react"

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
import { changeProjectStatus } from "../actions"
import { changeStatusSchema, type ChangeStatusInput } from "../schemas"
import { isClosed, STATUS_LABELS, type ProjectStatus } from "../status"

export function ChangeStatusDialog({
  projectId,
  current,
  options,
}: {
  projectId: string
  current: ProjectStatus
  options: ProjectStatus[]
}) {
  const [open, setOpen] = useState(false)
  const defaults: ChangeStatusInput = { projectId, status: options[0], note: "" }
  const { form, onSubmit, pending } = useActionForm<ChangeStatusInput>({
    schema: changeStatusSchema,
    defaultValues: defaults,
    action: changeProjectStatus,
    onSuccess: () => setOpen(false),
  })
  const target = form.watch("status") as ProjectStatus
  const cancelling = target === "cancelado"

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (value) form.reset(defaults)
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <ArrowRightLeft aria-hidden /> Cambiar estado
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} noValidate className="grid gap-6">
          <DialogHeader>
            <DialogTitle>Cambiar estado</DialogTitle>
            <DialogDescription>Estado actual: {STATUS_LABELS[current]}.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <FormSelect
              control={form.control}
              name="status"
              label="Nuevo estado"
              options={options.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
            />
            <FormTextarea
              control={form.control}
              name="note"
              label={cancelling ? "Motivo de la cancelación" : "Nota (opcional)"}
              placeholder={cancelling ? "Explica por qué se cancela el proyecto" : "Ej. Inició la siembra en P1 y P2"}
              maxLength={500}
            />
          </FieldGroup>
          {cancelling && (
            <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              Al cancelar, la superficie asignada se libera para otros proyectos y ya no se podrán modificar sus parcelas.
            </p>
          )}
          {target === "cerrado" && (
            <p className="rounded-md border bg-muted/50 p-3 text-sm text-muted-foreground">
              Al cerrar, la superficie asignada se libera y se registra la fecha de término.
            </p>
          )}
          {isClosed(current) && (
            <p className="rounded-md border bg-muted/50 p-3 text-sm text-muted-foreground">
              Se reabrirá el proyecto. Sus parcelas deben seguir teniendo superficie disponible.
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <SubmitButton pending={pending} variant={cancelling ? "destructive" : "default"}>
              {cancelling ? "Cancelar proyecto" : "Cambiar estado"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
