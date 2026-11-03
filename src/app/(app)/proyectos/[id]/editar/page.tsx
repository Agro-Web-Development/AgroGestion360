import { ArrowLeft } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"

import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { getBudgetVersions } from "@/features/finance/queries"
import { ProjectForm } from "@/features/projects/components/project-form"
import { getActiveCrops, getActiveMembers, getProject } from "@/features/projects/queries"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { NONE, toInput } from "@/lib/validation"

export const metadata: Metadata = { title: "Editar proyecto" }

export default async function EditProjectPage({ params }: PageProps<"/proyectos/[id]/editar">) {
  const { id } = await params
  const ctx = await getOrgContext()
  if (!can(ctx.role, "projects.write")) redirect(`/proyectos/${id}`)
  const [project, activeCrops, activeMembers, budgets] = await Promise.all([
    getProject(id),
    getActiveCrops(),
    getActiveMembers(),
    can(ctx.role, "finance.read") ? getBudgetVersions(id) : Promise.resolve([]),
  ])

  // Conservar el cultivo actual aunque se haya desactivado después.
  const crops = activeCrops.some((c) => c.id === project.crop.id)
    ? activeCrops
    : [{ ...project.crop }, ...activeCrops]
  const members =
    project.responsible_id && project.responsible && !activeMembers.some((m) => m.id === project.responsible_id)
      ? [
          { id: project.responsible_id, name: `${project.responsible.full_name || project.responsible.email} (sin acceso)` },
          ...activeMembers,
        ]
      : activeMembers

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href={`/proyectos/${project.id}`}>
          <ArrowLeft aria-hidden /> {project.code}
        </Link>
      </Button>
      <PageHeader title="Editar proyecto" description={project.name} />
      <ProjectForm
        crops={crops}
        members={members}
        cancelHref={`/proyectos/${project.id}`}
        budgetLocked={budgets.length > 0}
        defaultValues={{
          id: project.id,
          name: project.name,
          cropId: project.crop_id,
          season: project.season ?? "",
          startDate: project.start_date,
          plantingDate: project.planting_date ?? "",
          expectedHarvestDate: project.expected_harvest_date ?? "",
          expectedYield: toInput(project.expected_yield),
          budgetAmount: toInput(project.budget_amount),
          responsibleId: project.responsible_id ?? NONE,
          description: project.description ?? "",
        }}
      />
    </>
  )
}
