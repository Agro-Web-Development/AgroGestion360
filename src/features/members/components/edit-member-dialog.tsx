"use client"

import { Pencil } from "lucide-react"
import { useState } from "react"

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
import { ROLE_DESCRIPTIONS, ROLE_LABELS, type AppRole, type MembershipStatus } from "@/lib/auth/roles"
import { updateMember } from "../actions"
import { updateMemberSchema, type UpdateMemberInput } from "../schemas"

export function EditMemberDialog({
  membershipId,
  name,
  role,
  status,
  roles,
  isSelf,
}: {
  membershipId: string
  name: string
  role: AppRole
  status: MembershipStatus
  roles: AppRole[]
  isSelf: boolean
}) {
  const [open, setOpen] = useState(false)
  const { form, onSubmit, pending } = useActionForm<UpdateMemberInput>({
    schema: updateMemberSchema,
    defaultValues: { membershipId, role, status },
    action: updateMember,
    onSuccess: () => setOpen(false),
  })
  const selectedRole = form.watch("role") as AppRole
  const deactivating = form.watch("status") === "inactivo" && status === "activo"

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (value) form.reset({ membershipId, role, status })
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Editar a ${name}`}>
          <Pencil aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} noValidate className="grid gap-6">
          <DialogHeader>
            <DialogTitle>Editar miembro</DialogTitle>
            <DialogDescription>{name}</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <FormSelect
              control={form.control}
              name="role"
              label="Rol"
              options={roles.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
              description={selectedRole ? ROLE_DESCRIPTIONS[selectedRole] : undefined}
            />
            <FormSelect
              control={form.control}
              name="status"
              label="Estado"
              disabled={isSelf}
              options={[
                { value: "activo", label: "Activo" },
                { value: "inactivo", label: "Inactivo (sin acceso)" },
              ]}
              description={isSelf ? "No puedes desactivar tu propia cuenta." : undefined}
            />
          </FieldGroup>
          {deactivating && (
            <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              El usuario perderá el acceso a esta organización. Su historial de operaciones se conserva.
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <SubmitButton pending={pending} variant={deactivating ? "destructive" : "default"}>
              {deactivating ? "Desactivar usuario" : "Guardar"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
