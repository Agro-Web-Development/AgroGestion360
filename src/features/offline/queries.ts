import "server-only"

import { getOrgContext } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database"

export type SubmissionStatus = Database["public"]["Enums"]["offline_submission_status"]

/**
 * Envíos de la captura sin conexión. La RLS limita: cada quien ve los suyos y
 * los revisores (propietario, administrador, agrónomo) los de la organización.
 */
export async function getOfflineSubmissions(status: SubmissionStatus, limit = 200) {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("offline_submissions")
    .select("id, user_id, record_type, captured_at, received_at, synced_at, status, attempts, last_error, review_note, reviewed_at, payload")
    .eq("organization_id", ctx.organization.id)
    .eq("status", status)
    .order("received_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error("No fue posible cargar la sincronización.")

  const userIds = [...new Set(data.map((s) => s.user_id))]
  const projectIds = [...new Set(data.map((s) => (s.payload as { projectId?: string }).projectId).filter((v): v is string => !!v))]
  const [profiles, projects] = await Promise.all([
    userIds.length ? supabase.from("profiles").select("id, full_name, email").in("id", userIds) : Promise.resolve({ data: [] }),
    projectIds.length
      ? supabase.from("projects").select("id, code, name").eq("organization_id", ctx.organization.id).in("id", projectIds)
      : Promise.resolve({ data: [] }),
  ])
  const names = new Map((profiles.data ?? []).map((p) => [p.id, p.full_name || p.email]))
  const projectNames = new Map((projects.data ?? []).map((p) => [p.id, `${p.code} · ${p.name}`]))

  return data.map(({ payload, ...s }) => {
    const p = payload as { projectId?: string; date?: string }
    return {
      ...s,
      userName: names.get(s.user_id) ?? "Usuario",
      project: (p.projectId && projectNames.get(p.projectId)) || null,
      recordDate: typeof p.date === "string" ? p.date : null,
    }
  })
}

export async function getSubmissionCounts() {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const statuses: SubmissionStatus[] = ["requiere_revision", "sincronizado", "descartado"]
  const results = await Promise.all(
    statuses.map((status) =>
      supabase
        .from("offline_submissions")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", ctx.organization.id)
        .eq("status", status)
    )
  )
  return Object.fromEntries(statuses.map((s, i) => [s, results[i].count ?? 0])) as Record<SubmissionStatus, number>
}

export type OfflineSubmissionRow = Awaited<ReturnType<typeof getOfflineSubmissions>>[number]
