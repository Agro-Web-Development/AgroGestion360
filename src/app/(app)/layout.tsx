import { Suspense } from "react"

import { AppSidebar } from "@/components/layout/app-sidebar"
import { NotificationsMenu } from "@/components/layout/notifications-menu"
import { OrganizationSwitcher } from "@/components/layout/organization-switcher"
import { UserMenu } from "@/components/layout/user-menu"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { ROLE_LABELS } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"

/**
 * Shell de la aplicación. El marco (menú y barra) es estático; todo lo que
 * depende de la sesión se transmite dentro de límites <Suspense>.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar
        organizationSlot={
          <Suspense fallback={<Skeleton className="h-12 w-full bg-sidebar-accent" />}>
            <OrganizationSlot />
          </Suspense>
        }
      />
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-card/90 px-3 backdrop-blur supports-backdrop-filter:bg-card/75 sm:h-16 sm:px-6">
          <SidebarTrigger className="-ml-1 size-9" />
          <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-5" />
          <Suspense fallback={<Skeleton className="ml-auto h-8 w-48" />}>
            <TopbarSlot />
          </Suspense>
        </header>
        <div className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

async function OrganizationSlot() {
  const ctx = await getOrgContext()
  const organizations = ctx.memberships.map((m) => ({ ...m.organization, role: m.role }))
  return (
    <OrganizationSwitcher active={{ ...ctx.organization, role: ctx.role }} organizations={organizations} />
  )
}

async function TopbarSlot() {
  const ctx = await getOrgContext()
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <span className="min-w-0 truncate text-sm font-semibold">{ctx.organization.name}</span>
      {ctx.organization.isDemo && (
        <Badge
          variant="secondary"
          className="hidden border-primary/15 sm:inline-flex"
          title="Organización con datos ficticios de demostración"
        >
          Demostración
        </Badge>
      )}
      <div className="ml-auto flex items-center gap-1">
        <NotificationsMenu notifications={[]} />
        <UserMenu name={ctx.user.fullName} email={ctx.user.email} roleLabel={ROLE_LABELS[ctx.role]} />
      </div>
    </div>
  )
}

function PageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  )
}
