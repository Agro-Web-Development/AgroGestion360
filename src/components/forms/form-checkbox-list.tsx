"use client"

import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form"

import type { SelectOption } from "@/components/forms/form-select"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"

/** Selección múltiple con casillas; el valor del campo es un arreglo de ids. */
export function FormCheckboxList<T extends FieldValues>({
  control,
  name,
  label,
  options,
  description,
  emptyText = "Sin opciones disponibles.",
  className,
}: {
  control: Control<T>
  name: FieldPath<T>
  label: string
  options: SelectOption[]
  description?: string
  emptyText?: string
  className?: string
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const selected = new Set<string>(field.value ?? [])
        const toggle = (value: string, checked: boolean) => {
          const next = new Set(selected)
          if (checked) next.add(value)
          else next.delete(value)
          field.onChange(options.map((o) => o.value).filter((v) => next.has(v)))
        }
        return (
          <Field data-invalid={fieldState.invalid || undefined} className={className}>
            <div className="flex items-center justify-between gap-2">
              <FieldLabel>{label}</FieldLabel>
              {options.length > 1 && (
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => field.onChange(selected.size === options.length ? [] : options.map((o) => o.value))}
                >
                  {selected.size === options.length ? "Quitar todos" : "Seleccionar todos"}
                </button>
              )}
            </div>
            <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border p-3" role="group" aria-label={label}>
              {options.length === 0 && <p className="text-sm text-muted-foreground">{emptyText}</p>}
              {options.map((o) => (
                <label key={o.value} className="flex items-start gap-2.5 text-sm">
                  <Checkbox
                    checked={selected.has(o.value)}
                    onCheckedChange={(v) => toggle(o.value, v === true)}
                    className="mt-0.5"
                  />
                  <span>
                    {o.label}
                    {o.description && <span className="block text-xs text-muted-foreground">{o.description}</span>}
                  </span>
                </label>
              ))}
            </div>
            {description && !fieldState.error && <FieldDescription>{description}</FieldDescription>}
            <FieldError errors={[fieldState.error]} />
          </Field>
        )
      }}
    />
  )
}
