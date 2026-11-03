"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Suspense } from "react"

import { Logo } from "@/components/brand/logo"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { NAVIGATION } from "./navigation"

export function AppSidebar({ organizationSlot }: { organizationSlot: React.ReactNode }) {
  const { isMobile, setOpenMobile } = useSidebar()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-3 border-b border-sidebar-border pb-3">
        <Link
          href="/dashboard"
          className="rounded-md px-1 py-1.5 outline-hidden focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          onClick={() => isMobile && setOpenMobile(false)}
        >
          <Logo className="text-sidebar-foreground group-data-[collapsible=icon]:hidden" />
          <Logo compact className="hidden group-data-[collapsible=icon]:flex" />
        </Link>
        {organizationSlot}
      </SidebarHeader>

      <SidebarContent className="gap-0 py-2">
        {/* La ruta actual solo se conoce al solicitar la página: el menú del shell
            estático se muestra sin elemento activo y se reemplaza al transmitirse. */}
        <Suspense fallback={<NavigationMenu pathname={null} />}>
          <ActiveNavigationMenu />
        </Suspense>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border group-data-[collapsible=icon]:hidden">
        <div className="flex items-center gap-2 rounded-lg bg-sidebar-accent/50 px-3 py-2 text-xs text-sidebar-foreground/70">
          <span className="size-2 shrink-0 rounded-full bg-sidebar-primary" aria-hidden />
          <span className="truncate">Versión 0.4 · Control operativo</span>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

function ActiveNavigationMenu() {
  return <NavigationMenu pathname={usePathname()} />
}

function NavigationMenu({ pathname }: { pathname: string | null }) {
  const { isMobile, setOpenMobile } = useSidebar()
  return (
    <>
    {NAVIGATION.map((group) => (
      <SidebarGroup key={group.label} className="py-1.5">
        <SidebarGroupLabel className="text-[11px] font-semibold tracking-wider text-sidebar-foreground/50 uppercase">
          {group.label}
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {group.items.map((item) => {
              const active = pathname !== null && (pathname === item.href || pathname.startsWith(`${item.href}/`))
              const Icon = item.icon

              if (item.comingInPhase) {
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      disabled
                      aria-disabled
                      tooltip={`${item.title} · Próximamente`}
                      className="opacity-60"
                    >
                      <Icon aria-hidden />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                    <SidebarMenuBadge className="rounded-full bg-sidebar-accent px-1.5 text-[10px] font-medium text-sidebar-foreground/70">
                      Pronto
                    </SidebarMenuBadge>
                  </SidebarMenuItem>
                )
              }

              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={active}
                    tooltip={item.title}
                    className="relative text-sidebar-foreground/85 data-active:text-sidebar-accent-foreground data-active:[&_svg]:text-sidebar-primary data-active:before:absolute data-active:before:inset-y-1.5 data-active:before:left-0 data-active:before:w-[3px] data-active:before:rounded-full data-active:before:bg-sidebar-primary group-data-[collapsible=icon]:before:hidden"
                  >
                    <Link href={item.href} onClick={() => isMobile && setOpenMobile(false)}>
                      <Icon aria-hidden />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    ))}
    </>
  )
}
