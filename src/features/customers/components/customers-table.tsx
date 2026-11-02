"use client"

import { Pencil, Power, PowerOff, Search, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"

import { ConfirmAction } from "@/components/shared/confirm-action"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatMoney, formatNumber } from "@/lib/format"
import { deleteCustomer, setCustomerActive } from "../actions"
import type { Customer } from "../queries"
import { CustomerFormDialog } from "./customer-form-dialog"

export function CustomersTable({
  customers,
  canWrite,
  canDelete,
}: {
  customers: Customer[]
  canWrite: boolean
  canDelete: boolean
}) {
  const [query, setQuery] = useState("")
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return customers
    return customers.filter((c) => [c.name, c.rfc, c.contact_name].some((v) => v?.toLowerCase().includes(q)))
  }, [customers, query])

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre, RFC o contacto"
          className="pl-8"
          aria-label="Buscar clientes"
        />
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead className="hidden md:table-cell">Contacto</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Crédito</TableHead>
              <TableHead className="hidden text-right lg:table-cell">Ventas</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              {(canWrite || canDelete) && (
                <TableHead className="w-28">
                  <span className="sr-only">Acciones</span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No se encontraron clientes.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((c) => (
              <TableRow key={c.id} className={c.is_active ? undefined : "opacity-60"}>
                <TableCell>
                  <p className="font-medium">
                    {c.name}
                    {!c.is_active && (
                      <Badge variant="destructive" className="ml-2">
                        Inactivo
                      </Badge>
                    )}
                  </p>
                  {c.rfc && <p className="text-xs text-muted-foreground">{c.rfc}</p>}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {c.contact_name ?? "—"}
                  {(c.phone || c.email) && (
                    <p className="text-xs text-muted-foreground">{[c.phone, c.email].filter(Boolean).join(" · ")}</p>
                  )}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums sm:table-cell">
                  {c.credit_days ? `${formatNumber(c.credit_days)} días` : "Contado"}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums lg:table-cell">
                  {formatMoney(c.sales)}
                  <span className="block text-xs text-muted-foreground">{formatNumber(c.saleCount)} ventas</span>
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatMoney(c.balance)}
                  {c.overdue > 0 && <span className="block text-xs text-destructive">Vencido: {formatMoney(c.overdue)}</span>}
                </TableCell>
                {(canWrite || canDelete) && (
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {canWrite && (
                        <CustomerFormDialog
                          customer={{
                            id: c.id,
                            name: c.name,
                            rfc: c.rfc ?? "",
                            contactName: c.contact_name ?? "",
                            phone: c.phone ?? "",
                            email: c.email ?? "",
                            address: c.address ?? "",
                            creditDays: String(c.credit_days),
                            notes: c.notes ?? "",
                          }}
                          trigger={
                            <Button variant="ghost" size="icon" aria-label={`Editar ${c.name}`}>
                              <Pencil aria-hidden />
                            </Button>
                          }
                        />
                      )}
                      {canWrite && (
                        <ConfirmAction
                          title={c.is_active ? "Desactivar cliente" : "Reactivar cliente"}
                          description={
                            c.is_active
                              ? `No se podrán registrar nuevas ventas a "${c.name}". Sus ventas y saldos se conservan.`
                              : `"${c.name}" volverá a estar disponible para ventas.`
                          }
                          confirmLabel={c.is_active ? "Desactivar" : "Reactivar"}
                          destructive={c.is_active}
                          action={() => setCustomerActive(c.id, !c.is_active)}
                          trigger={
                            <Button variant="ghost" size="icon" aria-label={c.is_active ? `Desactivar ${c.name}` : `Reactivar ${c.name}`}>
                              {c.is_active ? <PowerOff aria-hidden /> : <Power aria-hidden />}
                            </Button>
                          }
                        />
                      )}
                      {canDelete && c.saleCount === 0 && (
                        <ConfirmAction
                          title="Eliminar cliente"
                          description={`Se eliminará "${c.name}" de forma permanente.`}
                          confirmLabel="Eliminar"
                          action={() => deleteCustomer(c.id)}
                          trigger={
                            <Button variant="ghost" size="icon" aria-label={`Eliminar ${c.name}`}>
                              <Trash2 aria-hidden />
                            </Button>
                          }
                        />
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
