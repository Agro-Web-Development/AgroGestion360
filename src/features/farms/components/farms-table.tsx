"use client"

import { ChevronRight, Search } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatNumber } from "@/lib/format"
import type { Farm } from "../queries"

export function FarmsTable({ farms }: { farms: Farm[] }) {
  const [query, setQuery] = useState("")
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return farms
    return farms.filter((f) =>
      [f.name, f.code, f.municipality, f.state].some((v) => v?.toLowerCase().includes(q))
    )
  }, [farms, query])

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre, clave o ubicación"
          className="pl-8"
          aria-label="Buscar ranchos"
        />
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rancho</TableHead>
              <TableHead className="hidden md:table-cell">Ubicación</TableHead>
              <TableHead className="text-right">Parcelas</TableHead>
              <TableHead className="text-right">Superficie parcelada</TableHead>
              <TableHead className="hidden sm:table-cell">Estado</TableHead>
              <TableHead className="w-10">
                <span className="sr-only">Abrir</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No se encontraron ranchos.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((f) => (
              <TableRow key={f.id} className={f.is_active ? undefined : "opacity-60"}>
                <TableCell>
                  <Link href={`/ranchos/${f.id}`} className="font-medium hover:underline">
                    {f.name}
                  </Link>
                  {f.code && <p className="text-xs text-muted-foreground">{f.code}</p>}
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {[f.municipality, f.state].filter(Boolean).join(", ") || "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(f.plotCount)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(f.plottedArea, "ha")}
                  {f.total_area_ha !== null && (
                    <span className="block text-xs text-muted-foreground">
                      de {formatNumber(f.total_area_ha, "ha")}
                    </span>
                  )}
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <Badge variant={f.is_active ? "outline" : "destructive"}>{f.is_active ? "Activo" : "Inactivo"}</Badge>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/ranchos/${f.id}`}
                    aria-label={`Ver ${f.name}`}
                    className="flex size-8 items-center justify-center rounded-md hover:bg-muted"
                  >
                    <ChevronRight className="size-4" aria-hidden />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
