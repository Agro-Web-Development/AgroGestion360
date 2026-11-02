import { ArrowLeft, Leaf } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"

import { PageHeader } from "@/components/layout/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { ProjectForm } from "@/features/projects/components/project-form"
import { getActiveCrops, getActiveMembers } from "@/features/projects/queries"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { todayISO } from "@/lib/format"
import { NONE } from "@/lib/validation"

export const metadata: Metadata = { title: "Nuevo proyecto" }

export default async function NewProjectPage() {
  const ctx = await getOrgContext()
  if (!can(ctx.role, "projects.write")) redirect("/proyectos")
  const [crops, members] = await Promise.all([getActiveCrops(), getActiveMembers()])

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href="/proyectos">
          <ArrowLeft aria-hidden /> Proyectos
        </Link>
      </Button>
      <PageHeader title="Nuevo proyecto" description="Después de crearlo podrás asignarle parcelas." />
      {crops.length === 0 ? (
        <EmptyState
          icon={Leaf}
          title="Primero registra un cultivo"
          description="Todo proyecto se asocia a un cultivo del catálogo."
          action={
            <Button asChild>
              <Link href="/cultivos">Ir a cultivos</Link>
            </Button>
          }
        />
      ) : (
        <ProjectForm
          crops={crops}
          members={members}
          cancelHref="/proyectos"
          defaultValues={{
            name: "",
            cropId: "",
            season: "",
            startDate: todayISO(),
            plantingDate: "",
            expectedHarvestDate: "",
            expectedYield: "",
            budgetAmount: "",
            responsibleId: members.some((m) => m.id === ctx.user.id) ? ctx.user.id : NONE,
            description: "",
          }}
        />
      )}
    </>
  )
}
