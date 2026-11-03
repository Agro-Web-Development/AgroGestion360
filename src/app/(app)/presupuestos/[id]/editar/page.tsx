import { ArrowLeft } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"

import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { BudgetForm } from "@/features/finance/components/budget-form"
import { getBudgetLines, getBudgetVersions } from "@/features/finance/queries"
import { getProject } from "@/features/projects/queries"
import { isClosed } from "@/features/projects/status"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { newId } from "@/lib/ids"
import { toInput } from "@/lib/validation"

export const metadata: Metadata = { title: "Presupuesto" }

/** Fecha AAAA-MM-DD más n días. */
const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)

export default async function EditBudgetPage({ params }: PageProps<"/presupuestos/[id]/editar">) {
  const { id } = await params
  const ctx = await getOrgContext()
  if (!can(ctx.role, "budgets.write")) redirect(`/presupuestos/${id}`)
  const [project, versions] = await Promise.all([getProject(id), getBudgetVersions(id)])
  if (isClosed(project.status)) redirect(`/presupuestos/${id}`)
  const current = versions.find((v) => v.is_current) ?? null
  const lines = current ? await getBudgetLines(current.id) : []
  const assignedArea = project.project_plots.reduce((s, pp) => s + Number(pp.assigned_area_ha), 0)
  const defaultEnd =
    project.end_date ?? project.expected_harvest_date ?? addDays(project.start_date, project.crop.cycle_days ?? 180)

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href={`/presupuestos/${project.id}`}>
          <ArrowLeft aria-hidden /> {project.code}
        </Link>
      </Button>
      <PageHeader
        title={current ? `Revisión del presupuesto (versión ${current.version + 1})` : "Presupuesto del proyecto"}
        description={project.name}
      />
      <BudgetForm
        cancelHref={`/presupuestos/${project.id}`}
        project={{
          code: project.code,
          crop: [project.crop.name, project.crop.variety].filter(Boolean).join(" · "),
          assignedAreaHa: assignedArea,
        }}
        defaultValues={{
          id: newId(),
          projectId: project.id,
          baseVersion: current?.version ?? null,
          periodStart: current?.period_start ?? project.start_date,
          periodEnd: current?.period_end ?? defaultEnd,
          areaHa: toInput(current?.area_ha ?? (assignedArea || "")),
          reason: "",
          notes: current?.notes ?? "",
          lines: lines.map((l) => ({
            category: l.category,
            concept: l.concept,
            unit: l.unit ?? "",
            quantity: toInput(l.quantity),
            unitCost: toInput(l.unit_cost),
          })),
        }}
      />
    </>
  )
}
