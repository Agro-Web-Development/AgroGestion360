"use client"

import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form"

import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"

/** Casilla de verificación integrada con React Hook Form (valor booleano). */
export function FormCheckbox<T extends FieldValues>({
  control,
  name,
  label,
  description,
  disabled,
  className,
}: {
  control: Control<T>
  name: FieldPath<T>
  label: string
  description?: string
  disabled?: boolean
  className?: string
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid || undefined} className={className}>
          <div className="flex items-start gap-2.5">
            <Checkbox
              id={name}
              checked={Boolean(field.value)}
              onCheckedChange={(v) => field.onChange(v === true)}
              onBlur={field.onBlur}
              disabled={disabled}
              className="mt-0.5"
            />
            <div className="grid gap-1">
              <FieldLabel htmlFor={name} className="font-normal">
                {label}
              </FieldLabel>
              {description && <FieldDescription>{description}</FieldDescription>}
            </div>
          </div>
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  )
}
