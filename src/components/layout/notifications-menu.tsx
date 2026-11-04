"use client"

import { Bell, BellOff } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type AppNotification = { id: string; title: string; description?: string; href?: string }

/**
 * Centro de notificaciones: alertas vigentes calculadas en el servidor
 * (features/notifications/queries.ts). Cada una lleva a la pantalla donde se atiende.
 */
export function NotificationsMenu({ notifications }: { notifications: AppNotification[] }) {
  const count = notifications.length

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notificaciones (${count})`}>
          <Bell aria-hidden />
          {count > 0 && (
            <span className="absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-white">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notificaciones</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {count === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-muted-foreground">
            <BellOff className="size-6" aria-hidden />
            No tienes notificaciones pendientes.
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {notifications.map((n) => {
              const body = (
                <div className="min-w-0">
                  <p className="font-medium">{n.title}</p>
                  {n.description && <p className="truncate text-xs text-muted-foreground">{n.description}</p>}
                </div>
              )
              return n.href ? (
                <DropdownMenuItem key={n.id} asChild>
                  <Link href={n.href}>{body}</Link>
                </DropdownMenuItem>
              ) : (
                <div key={n.id} className="px-2 py-1.5 text-sm">
                  {body}
                </div>
              )
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
