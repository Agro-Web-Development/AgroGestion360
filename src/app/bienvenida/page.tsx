import { ArrowLeft } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"

import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { signOut } from "@/features/auth/actions"
import { CreateOrganizationForm } from "@/features/organizations/components/create-organization-form"
import { getCurrentUser, getMemberships } from "@/lib/auth/session"

export const metadata: Metadata = { title: "Bienvenida" }

export default function WelcomePage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/40 p-6">
      <Logo className="text-lg" />
      <Suspense fallback={<Skeleton className="h-80 w-full max-w-md" />}>
        <WelcomeCard />
      </Suspense>
    </main>
  )
}

async function WelcomeCard() {
  const [user, memberships] = await Promise.all([getCurrentUser(), getMemberships()])
  const hasOrganizations = memberships.length > 0

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-xl">
          {hasOrganizations ? "Nueva organización" : `Bienvenido${user.fullName ? `, ${user.fullName.split(" ")[0]}` : ""}`}
        </CardTitle>
        <CardDescription>
          {hasOrganizations
            ? "Crea otra organización agrícola. Serás su propietario."
            : "Registra tu organización agrícola para comenzar. Si te invitaron a una existente, pide al administrador que te envíe la invitación a este correo: " + user.email}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <CreateOrganizationForm />
        {hasOrganizations ? (
          <Button asChild variant="ghost" className="w-full">
            <Link href="/dashboard">
              <ArrowLeft aria-hidden /> Volver al dashboard
            </Link>
          </Button>
        ) : (
          <form action={signOut}>
            <Button type="submit" variant="ghost" className="w-full">
              Cerrar sesión
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
