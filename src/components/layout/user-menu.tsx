"use client"

import { LogOut, Monitor, Moon, Sun, UserCircle } from "lucide-react"
import Link from "next/link"
import { useTheme } from "next-themes"
import { useTransition } from "react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { clearWorkerCaches } from "@/components/pwa/service-worker"
import { signOut } from "@/features/auth/actions"
import { clearContext, listRecords } from "@/features/offline/idb"
import { unsyncedCount } from "@/features/offline/queue"
import { initials } from "@/lib/format"

/**
 * Al cerrar sesión se borran del dispositivo la sesión y los catálogos de la
 * captura sin conexión. Los registros sin sincronizar se conservan y se avisa
 * al usuario: se enviarán cuando vuelva a iniciar sesión con su cuenta.
 */
async function prepareSignOut(userId: string): Promise<boolean> {
  try {
    const records = await listRecords(userId)
    const pending = unsyncedCount(records)
    if (
      pending > 0 &&
      !window.confirm(
        `Tienes ${pending} ${pending === 1 ? "registro" : "registros"} sin sincronizar. Se conservarán en este dispositivo y se enviarán cuando vuelvas a iniciar sesión. ¿Cerrar sesión?`
      )
    ) {
      return false
    }
    await clearContext()
  } catch {
    // Sin IndexedDB: no hay nada que limpiar.
  }
  clearWorkerCaches()
  return true
}

export function UserMenu({ userId, name, email, roleLabel }: { userId: string; name: string; email: string; roleLabel: string }) {
  const { theme, setTheme } = useTheme()
  const [pending, startTransition] = useTransition()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-10 gap-2 px-2" aria-label="Menú de usuario">
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary text-xs text-primary-foreground">
              {initials(name || email)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden text-left text-sm leading-tight md:grid">
            <span className="max-w-40 truncate font-medium">{name || email}</span>
            <span className="text-xs text-muted-foreground">{roleLabel}</span>
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="grid">
          <span className="truncate">{name || "Sin nombre"}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/configuracion/perfil">
            <UserCircle aria-hidden /> Mi perfil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">Tema</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light">
            <Sun aria-hidden /> Claro
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon aria-hidden /> Oscuro
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor aria-hidden /> Sistema
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={pending}
          onSelect={() =>
            startTransition(async () => {
              if (await prepareSignOut(userId)) await signOut()
            })
          }
        >
          <LogOut aria-hidden /> Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
