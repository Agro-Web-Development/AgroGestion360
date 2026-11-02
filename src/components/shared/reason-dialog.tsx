"use client"

import { useState } from "react"
import { z } from "zod"

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
import type { ActionResult } from "@/lib/actions"

const reasonSchema = z.object({
  reason: z.string().trim().min(5, "Indica el motivo (mínimo 5 caracteres)").max(500, "Máximo 500 caracteres"),
})
type ReasonInput = z.input<typeof reasonSchema>

/** Cancelaciones y anulaciones: exigen motivo, que queda en el historial. */
export function ReasonDialog({
  trigger,
  title,
  description,
  confirmLabel,
  action,
}: {
  trigger: React.ReactNode
  title: string
  description: string
  confirmLabel: string
  action: (reason: string) => Promise<ActionResult<unknown>>
}) {
  const [open, setOpen] = useState(false)
  const { form, onSubmit, pending } = useActionForm<ReasonInput, unknown>({
    schema: reasonSchema,
    defaultValues: { reason: "" },
    action: (values) => action(values.reason),
    onSuccess: () => setOpen(false),
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (value) form.reset({ reason: "" })
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} noValidate className="grid gap-6">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <FormTextarea control={form.control} name="reason" label="Motivo" rows={3} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Regresar
            </Button>
            <SubmitButton pending={pending} variant="destructive">
              {confirmLabel}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
