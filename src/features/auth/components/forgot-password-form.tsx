"use client"

import { MailCheck } from "lucide-react"
import { useState } from "react"

import { FormInput } from "@/components/forms/form-input"
import { SubmitButton } from "@/components/forms/submit-button"
import { useActionForm } from "@/components/forms/use-action-form"
import { FieldGroup } from "@/components/ui/field"
import { requestPasswordReset } from "../actions"
import { forgotPasswordSchema, type ForgotPasswordInput } from "../schemas"

export function ForgotPasswordForm() {
  const [message, setMessage] = useState<string | null>(null)
  const { form, onSubmit, pending } = useActionForm<ForgotPasswordInput>({
    schema: forgotPasswordSchema,
    defaultValues: { email: "" },
    action: requestPasswordReset,
    toastOnSuccess: false,
    onSuccess: (result) => setMessage(result.message ?? null),
  })

  if (message) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border bg-card p-6 text-center">
        <MailCheck className="size-10 text-primary" aria-hidden />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <FormInput
          control={form.control}
          name="email"
          label="Correo electrónico"
          type="email"
          autoComplete="email"
        />
        <SubmitButton pending={pending} className="w-full">
          Enviar enlace
        </SubmitButton>
      </FieldGroup>
    </form>
  )
}
