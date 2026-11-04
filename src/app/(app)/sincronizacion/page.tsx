import { CheckCircle2, CloudUpload, Smartphone } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { PageHeader } from "@/components/layout/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SubmissionsTable } from "@/features/offline/components/submissions-table"
import { getOfflineSubmissions, getSubmissionCounts, type SubmissionStatus } from "@/features/offline/queries"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { param } from "@/lib/search-params"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Sincronización" }

const TABS: { value: SubmissionStatus; label: string }[] = [
  { value: "requiere_revision", label: "Requieren revisión" },
  { value: "sincronizado", label: "Sincronizados" },
  { value: "descartado", label: "Descartados" },
]

export default async function SyncPage({ searchParams }: PageProps<"/sincronizacion">) {
  const sp = await searchParams
  const status = TABS.find((t) => t.value === param(sp.estado))?.value ?? "requiere_revision"
  const ctx = await getOrgContext()
  const canReview = can(ctx.role, "offline.review")
  const [rows, counts] = await Promise.all([getOfflineSubmissions(status), getSubmissionCounts()])

  return (
    <>
      <PageHeader
        title="Sincronización"
        description={
          canReview
            ? "Registros capturados sin conexión por el personal de campo. Los que no pudieron crearse esperan revisión: corrige la causa (p. ej. asigna la parcela o registra la entrada al almacén) para que el dispositivo los reintente, o descártalos."
            : "Tus registros capturados sin conexión y su resultado en el servidor."
        }
        actions={
          <Button asChild>
            <a href="/campo">
              <Smartphone aria-hidden /> Captura en campo
            </a>
          </Button>
        }
      />

      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Estado">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={`/sincronizacion?estado=${t.value}`}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition-colors",
              t.value === status ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
            )}
            aria-current={t.value === status ? "page" : undefined}
          >
            {t.label} <span className="tabular-nums opacity-80">({counts[t.value]})</span>
          </Link>
        ))}
      </nav>

      <Card>
        <CardHeader>
          <CardTitle>{TABS.find((t) => t.value === status)?.label}</CardTitle>
          <CardDescription>
            {status === "requiere_revision"
              ? "Cada registro conserva el motivo del rechazo. Nada se crea, descuenta ni confirma hasta que el servidor lo acepta."
              : status === "sincronizado"
                ? "Registros confirmados por el servidor, con su fecha de sincronización."
                : "Registros que un revisor decidió no crear."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState
              icon={status === "requiere_revision" ? CheckCircle2 : CloudUpload}
              title={status === "requiere_revision" ? "Nada pendiente de revisión" : "Sin registros"}
              description="Los registros aparecen aquí cuando un dispositivo los sincroniza."
            />
          ) : (
            <SubmissionsTable rows={rows} canReview={canReview} />
          )}
        </CardContent>
      </Card>
    </>
  )
}
