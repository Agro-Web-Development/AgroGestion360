"use client"

import { Bell, BellOff } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type AppNotification = { id: string; title: string; description?: string }

/**
 * Centro de notificaciones. En fases posteriores recibirá alertas de stock
 * mínimo, caducidades y pagos vencidos; por ahora muestra las que se le pasen.
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
          <ul className="max-h-80 overflow-y-auto">
            {notifications.map((n) => (
              <li key={n.id} className="rounded-sm px-2 py-2 text-sm hover:bg-accent">
                <p className="font-medium">{n.title}</p>
                {n.description && <p className="text-xs text-muted-foreground">{n.description}</p>}
              </li>
            ))}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
