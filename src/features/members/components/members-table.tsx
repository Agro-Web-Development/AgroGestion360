"use client"

import { Search } from "lucide-react"
import { useMemo, useState } from "react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { canManageMember, ROLE_LABELS, type AppRole } from "@/lib/auth/roles"
import { formatDate, initials } from "@/lib/format"
import type { Member } from "../queries"
import { EditMemberDialog } from "./edit-member-dialog"

export function MembersTable({
  members,
  actorRole,
  actorId,
  assignable,
}: {
  members: Member[]
  actorRole: AppRole
  actorId: string
  assignable: AppRole[]
}) {
  const [query, setQuery] = useState("")
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return members
    return members.filter(
      (m) =>
        m.user.full_name.toLowerCase().includes(q) ||
        m.user.email.toLowerCase().includes(q) ||
        ROLE_LABELS[m.role].toLowerCase().includes(q)
    )
  }, [members, query])

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre, correo o rol"
          className="pl-8"
          aria-label="Buscar usuarios"
        />
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="hidden md:table-cell">Alta</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  No se encontraron usuarios.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((m) => {
              const name = m.user.full_name || m.user.email
              return (
                <TableRow key={m.id} className={m.status === "inactivo" ? "opacity-60" : undefined}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8">
                        <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {name}
                          {m.user.id === actorId && <span className="text-muted-foreground"> (tú)</span>}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{m.user.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={m.role === "propietario" ? "default" : "secondary"}>{ROLE_LABELS[m.role]}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={m.status === "activo" ? "outline" : "destructive"}>
                      {m.status === "activo" ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {formatDate(m.created_at)}
                  </TableCell>
                  <TableCell>
                    {canManageMember(actorRole, m.role) && (
                      <EditMemberDialog
                        membershipId={m.id}
                        name={name}
                        role={m.role}
                        status={m.status}
                        roles={assignable}
                        isSelf={m.user.id === actorId}
                      />
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
