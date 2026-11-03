"use client"

import { Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export function SearchInput({
  value,
  onChange,
  placeholder,
  label,
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  /** Etiqueta accesible (por omisión, el placeholder). */
  label?: string
  className?: string
}) {
  return (
    <div className={cn("relative w-full sm:max-w-sm", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-8"
        aria-label={label ?? placeholder}
      />
    </div>
  )
}

/** Coincidencia sin distinguir mayúsculas ni acentos. */
export function matchesQuery(query: string, ...values: (string | null | undefined)[]): boolean {
  const normalize = (v: string) => v.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()
  const q = normalize(query.trim())
  if (!q) return true
  return values.some((v) => v && normalize(v).includes(q))
}
