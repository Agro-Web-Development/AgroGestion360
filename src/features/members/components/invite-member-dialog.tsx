"use client"

import { MailPlus } from "lucide-react"
import { useState } from "react"

import { FormInput } from "@/components/forms/form-input"
import { FormSelect } from "@/components/forms/form-select"
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
import { ROLE_DESCRIPTIONS, ROLE_LABELS, type AppRole } from "@/lib/auth/roles"
import { inviteMember } from "../actions"
import { inviteMemberSchema, type InviteMemberInput } from "../schemas"

export function InviteMemberDialog({ roles }: { roles: AppRole[] }) {
  const [open, setOpen] = useState(false)
  const { form, onSubmit, pending } = useActionForm<InviteMemberInput>({
    schema: inviteMemberSchema,
    defaultValues: { email: "", role: "consulta" },
    action: inviteMember,
    onSuccess: () => {
      form.reset()
      setOpen(false)
    },
  })
  const selectedRole = form.watch("role") as AppRole

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (!value) form.reset()
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <MailPlus aria-hidden /> Invitar usuario
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} noValidate className="grid gap-6">
          <DialogHeader>
            <DialogTitle>Invitar usuario</DialogTitle>
            <DialogDescription>
              Si el correo ya tiene cuenta se agregará de inmediato; si no, recibirá un enlace para
              crear su contraseña.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <FormInput
              control={form.control}
              name="email"
              label="Correo electrónico"
              type="email"
              autoComplete="off"
            />
            <FormSelect
              control={form.control}
              name="role"
              label="Rol"
              options={roles.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
              description={selectedRole ? ROLE_DESCRIPTIONS[selectedRole] : undefined}
            />
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <SubmitButton pending={pending}>Enviar invitación</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
