"use client"

import { Check, ChevronsUpDown, Plus } from "lucide-react"
import Link from "next/link"
import { useTransition } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar"
import { switchOrganization } from "@/features/organizations/actions"
import { ROLE_LABELS, type AppRole } from "@/lib/auth/roles"
import { initials } from "@/lib/format"

type Org = { id: string; name: string; isDemo: boolean; role: AppRole }

export function OrganizationSwitcher({ active, organizations }: { active: Org; organizations: Org[] }) {
  const { isMobile } = useSidebar()
  const [pending, startTransition] = useTransition()

  function select(id: string) {
    if (id === active.id) return
    startTransition(async () => {
      const result = await switchOrganization(id)
      if (result && !result.ok) toast.error(result.error)
    })
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              disabled={pending}
              className="bg-sidebar-accent/60 data-[state=open]:bg-sidebar-accent"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
                {initials(active.name)}
              </span>
              <span className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{active.name}</span>
                <span className="truncate text-xs text-sidebar-foreground/70">
                  {ROLE_LABELS[active.role]}
                  {active.isDemo && " · Demostración"}
                </span>
              </span>
              <ChevronsUpDown className="ml-auto" aria-hidden />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-60"
            side={isMobile ? "bottom" : "right"}
            align="start"
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">Organizaciones</DropdownMenuLabel>
            {organizations.map((org) => (
              <DropdownMenuItem key={org.id} onSelect={() => select(org.id)} className="gap-2">
                <span className="flex size-6 items-center justify-center rounded-sm border text-[10px] font-semibold">
                  {initials(org.name)}
                </span>
                <span className="flex-1 truncate">{org.name}</span>
                {org.isDemo && <Badge variant="secondary">Demo</Badge>}
                {org.id === active.id && <Check className="size-4" aria-label="Activa" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="gap-2">
              <Link href="/bienvenida">
                <Plus className="size-4" aria-hidden />
                Crear organización
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
