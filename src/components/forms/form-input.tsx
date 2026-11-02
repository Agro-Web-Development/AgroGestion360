"use client"

import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form"

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

type FormInputProps<T extends FieldValues> = {
  control: Control<T>
  name: FieldPath<T>
  label: string
  description?: string
} & Omit<React.ComponentProps<typeof Input>, "name" | "value" | "onChange" | "onBlur">

/** Campo de texto integrado con React Hook Form y los componentes Field de shadcn. */
export function FormInput<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  ...inputProps
}: FormInputProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid || undefined} className={className}>
          <FieldLabel htmlFor={name}>{label}</FieldLabel>
          <Input
            id={name}
            aria-invalid={fieldState.invalid || undefined}
            {...inputProps}
            {...field}
            value={field.value ?? ""}
          />
          {description && !fieldState.error && <FieldDescription>{description}</FieldDescription>}
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  )
}
