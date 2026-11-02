"use client"

import { MailCheck } from "lucide-react"
import { useState } from "react"

import { FormInput } from "@/components/forms/form-input"
import { SubmitButton } from "@/components/forms/submit-button"
import { useActionForm } from "@/components/forms/use-action-form"
import { FieldGroup } from "@/components/ui/field"
import { signUp } from "../actions"
import { registerSchema, type RegisterInput } from "../schemas"

export function RegisterForm() {
  const [sentTo, setSentTo] = useState<string | null>(null)
  const { form, onSubmit, pending } = useActionForm<RegisterInput, { needsConfirmation: boolean }>({
    schema: registerSchema,
    defaultValues: { fullName: "", email: "", password: "", confirmPassword: "" },
    action: signUp,
    toastOnSuccess: false,
    onSuccess: () => setSentTo(form.getValues("email")),
  })

  if (sentTo) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border bg-card p-6 text-center">
        <MailCheck className="size-10 text-primary" aria-hidden />
        <p className="font-medium">Revisa tu correo</p>
        <p className="text-sm text-muted-foreground">
          Enviamos un enlace de confirmación a <strong>{sentTo}</strong>.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <FormInput control={form.control} name="fullName" label="Nombre completo" autoComplete="name" />
        <FormInput
          control={form.control}
          name="email"
          label="Correo electrónico"
          type="email"
          autoComplete="email"
          placeholder="nombre@empresa.mx"
        />
        <FormInput
          control={form.control}
          name="password"
          label="Contraseña"
          type="password"
          autoComplete="new-password"
          description="Mínimo 8 caracteres, con letras y números."
        />
        <FormInput
          control={form.control}
          name="confirmPassword"
          label="Confirmar contraseña"
          type="password"
          autoComplete="new-password"
        />
        <SubmitButton pending={pending} className="w-full">
          Crear cuenta
        </SubmitButton>
      </FieldGroup>
    </form>
  )
}
