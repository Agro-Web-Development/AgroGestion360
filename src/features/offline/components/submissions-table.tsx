"use client"

import { Ban } from "lucide-react"

import { ReasonDialog } from "@/components/shared/reason-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDate, formatDateTime } from "@/lib/format"
import { discardSubmission } from "../actions"
import type { OfflineSubmissionRow } from "../queries"
import { RECORD_TYPE_LABELS, type OfflineRecordType } from "../schemas"

export function SubmissionsTable({ rows, canReview }: { rows: OfflineSubmissionRow[]; canReview: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Registro</TableHead>
          <TableHead className="hidden md:table-cell">Capturado por</TableHead>
          <TableHead className="hidden sm:table-cell">Capturado</TableHead>
          <TableHead className="hidden lg:table-cell">Recibido</TableHead>
          <TableHead>Estado</TableHead>
          {canReview && <TableHead className="w-12"><span className="sr-only">Acciones</span></TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((s) => (
          <TableRow key={s.id}>
            <TableCell className="max-w-72 align-top whitespace-normal">
              <p className="font-medium">{RECORD_TYPE_LABELS[s.record_type as OfflineRecordType]}</p>
              <p className="text-xs text-muted-foreground">
                {[s.project, s.recordDate && formatDate(s.recordDate)].filter(Boolean).join(" · ") || "—"}
              </p>
              <p className="text-xs text-muted-foreground md:hidden">{s.userName}</p>
            </TableCell>
            <TableCell className="hidden align-top md:table-cell">{s.userName}</TableCell>
            <TableCell className="hidden align-top sm:table-cell">{formatDateTime(s.captured_at)}</TableCell>
            <TableCell className="hidden align-top lg:table-cell">
              {formatDateTime(s.received_at)}
              <p className="text-xs text-muted-foreground">{s.attempts} {s.attempts === 1 ? "intento" : "intentos"}</p>
            </TableCell>
            <TableCell className="max-w-80 align-top whitespace-normal">
              {s.status === "sincronizado" && (
                <Badge variant="secondary">Sincronizado {s.synced_at && formatDateTime(s.synced_at)}</Badge>
              )}
              {s.status === "requiere_revision" && (
                <>
                  <Badge variant="destructive">Requiere revisión</Badge>
                  {s.last_error && <p className="mt-1 text-xs text-muted-foreground">{s.last_error}</p>}
                </>
              )}
              {s.status === "descartado" && (
                <>
                  <Badge variant="outline">Descartado</Badge>
                  {s.review_note && <p className="mt-1 text-xs text-muted-foreground">{s.review_note}</p>}
                </>
              )}
            </TableCell>
            {canReview && (
              <TableCell className="align-top">
                {s.status === "requiere_revision" && (
                  <ReasonDialog
                    title="Descartar registro"
                    description="El registro no se creará. Quien lo capturó verá el motivo en su dispositivo en la siguiente sincronización."
                    confirmLabel="Descartar"
                    action={(reason) => discardSubmission(s.id, reason)}
                    trigger={
                      <Button variant="ghost" size="icon" aria-label="Descartar registro">
                        <Ban aria-hidden />
                      </Button>
                    }
                  />
                )}
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
