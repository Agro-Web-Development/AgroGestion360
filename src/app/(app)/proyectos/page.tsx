import { Plus, Sprout } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { PageHeader } from "@/components/layout/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ProjectsTable } from "@/features/projects/components/projects-table"
import { getProjects } from "@/features/projects/queries"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"

export const metadata: Metadata = { title: "Proyectos" }

export default async function ProjectsPage() {
  const ctx = await getOrgContext()
  const canWrite = can(ctx.role, "projects.write")
  const projects = await getProjects()

  const newProject = canWrite && (
    <Button asChild>
      <Link href="/proyectos/nuevo">
        <Plus aria-hidden /> Nuevo proyecto
      </Link>
    </Button>
  )

  return (
    <>
      <PageHeader
        title="Proyectos agrícolas"
        description="Cada proyecto agrupa un cultivo, sus parcelas y su avance por etapas."
        actions={newProject}
      />
      {projects.length === 0 ? (
        <EmptyState
          icon={Sprout}
          title="Aún no hay proyectos"
          description="Crea un proyecto para planear un ciclo de cultivo y asignarle parcelas."
          action={newProject}
        />
      ) : (
        <Card>
          <CardContent>
            <ProjectsTable projects={projects} />
          </CardContent>
        </Card>
      )}
    </>
  )
}
