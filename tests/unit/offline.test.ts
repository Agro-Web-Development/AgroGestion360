import { describe, expect, it } from "vitest"

import { observationSchema } from "@/features/fieldlogs/schemas"
import {
  applyEdit,
  applyFailure,
  applyResult,
  backoffMs,
  canEdit,
  canRetry,
  countByStatus,
  isDueForSync,
  markSyncing,
  newRecord,
  recoverInterrupted,
  retry,
  STALE_SYNC_MS,
  unsyncedCount,
  type OfflineRecord,
} from "@/features/offline/queue"
import { canonicalJson, RECORD_PERMISSION, submissionSchema } from "@/features/offline/schemas"
import { isRetryableDbError } from "@/lib/actions"
import { can } from "@/lib/auth/roles"
import { safeRedirectPath } from "@/lib/safe-redirect"
import { todayISO } from "@/lib/format"

const USER = "11111111-1111-4111-8111-111111111111"
const T0 = new Date("2026-11-05T15:00:00Z")
const at = (ms: number) => new Date(T0.getTime() + ms)

function record(overrides: Partial<OfflineRecord> = {}): OfflineRecord {
  return {
    ...newRecord(
      {
        localId: "22222222-2222-4222-8222-222222222222",
        organizationId: "33333333-3333-4333-8333-333333333333",
        organizationName: "Agrícola",
        userId: USER,
        userName: "Supervisor",
        type: "riego",
        payload: { id: "22222222-2222-4222-8222-222222222222" },
        summary: "PRY-2026-0001 · P1",
        photoCount: 2,
      },
      T0
    ),
    ...overrides,
  }
}

describe("cola de sincronización", () => {
  it("un registro nuevo queda pendiente con su fecha de captura y fotos por cargar", () => {
    const r = record()
    expect(r.status).toBe("pendiente")
    expect(r.capturedAt).toBe(T0.toISOString())
    expect(r.photosPending).toBe(2)
    expect(r.attempts).toBe(0)
  })

  it("solo se marca sincronizado con la confirmación del servidor", () => {
    const sending = markSyncing(record(), T0)
    expect(sending.status).toBe("sincronizando")
    expect(sending.attempts).toBe(1)
    const failed = applyFailure(sending, "Sin conexión", at(1000))
    expect(failed.status).toBe("error")
    expect(failed.syncedAt).toBeNull()
    const ok = applyResult(sending, { status: "sincronizado", syncedAt: "2026-11-05T15:00:05Z", message: "ok" }, at(5000))
    expect(ok.status).toBe("sincronizado")
    expect(ok.syncedAt).toBe("2026-11-05T15:00:05Z")
    expect(ok.error).toBeNull()
  })

  it("un rechazo de negocio requiere revisión y conserva el detalle", () => {
    const r = applyResult(markSyncing(record(), T0), {
      status: "requiere_revision",
      message: "Existencia insuficiente",
      fieldErrors: { quantity: ["Existencia insuficiente"] },
    }, T0)
    expect(r.status).toBe("requiere_revision")
    expect(r.fieldErrors?.quantity).toEqual(["Existencia insuficiente"])
    expect(isDueForSync(r, USER, at(STALE_SYNC_MS * 100))).toBe(false)
    expect(canRetry(r)).toBe(true)
    expect(canEdit(r)).toBe(true)
  })

  it("los errores transitorios se reintentan con espera creciente", () => {
    expect(backoffMs(1)).toBe(15_000)
    expect(backoffMs(2)).toBe(30_000)
    expect(backoffMs(3)).toBe(60_000)
    expect(backoffMs(20)).toBe(30 * 60_000)
    const failed = applyFailure(markSyncing(record(), T0), "Sin conexión", T0)
    expect(isDueForSync(failed, USER, at(10_000))).toBe(false)
    expect(isDueForSync(failed, USER, at(15_000))).toBe(true)
  })

  it("solo sincroniza los registros del usuario de la sesión", () => {
    expect(isDueForSync(record(), USER, T0)).toBe(true)
    expect(isDueForSync(record(), "44444444-4444-4444-8444-444444444444", T0)).toBe(false)
  })

  it("un envío interrumpido vuelve a la cola después del tiempo de espera", () => {
    const sending = markSyncing(record(), T0)
    expect(recoverInterrupted(sending, at(1000)).status).toBe("sincronizando")
    expect(recoverInterrupted(sending, at(STALE_SYNC_MS)).status).toBe("pendiente")
  })

  it("un registro descartado por un revisor ya no se reintenta ni se edita", () => {
    const r = applyResult(record(), { status: "requiere_revision", message: "Descartado", discarded: true }, T0)
    expect(canRetry(r)).toBe(false)
    expect(canEdit(r)).toBe(false)
    expect(retry(r, T0)).toBe(r)
    expect(isDueForSync({ ...r, status: "pendiente" }, USER, T0)).toBe(false)
  })

  it("corregir un registro lo regresa a pendiente y limpia el error", () => {
    const review = applyResult(record(), { status: "requiere_revision", message: "x", fieldErrors: { a: ["b"] } }, T0)
    const edited = applyEdit(review, { id: "x", notes: "corregido" }, "nuevo", at(1))
    expect(edited.status).toBe("pendiente")
    expect(edited.error).toBeNull()
    expect(edited.fieldErrors).toBeUndefined()
    expect(edited.summary).toBe("nuevo")
    const synced = applyResult(record(), { status: "sincronizado", syncedAt: "x", message: "" }, T0)
    expect(applyEdit(synced, {}, "", T0)).toBe(synced)
  })

  it("cuenta por estado y lo que falta por enviar (incluye fotos)", () => {
    const rows = [
      record(),
      applyResult(record(), { status: "sincronizado", syncedAt: "x", message: "" }, T0),
      { ...applyResult(record(), { status: "sincronizado", syncedAt: "x", message: "" }, T0), photosPending: 0 },
    ]
    expect(countByStatus(rows)).toMatchObject({ pendiente: 1, sincronizado: 2 })
    expect(unsyncedCount(rows)).toBe(2)
  })
})

describe("envío al servidor", () => {
  const base = {
    localId: "22222222-2222-4222-8222-222222222222",
    organizationId: "33333333-3333-4333-8333-333333333333",
    userId: USER,
    type: "riego",
    capturedAt: "2026-11-05T09:00:00.000Z",
    payload: { id: "22222222-2222-4222-8222-222222222222" },
  }

  it("valida la estructura del envío", () => {
    expect(submissionSchema.safeParse(base).success).toBe(true)
    expect(submissionSchema.safeParse({ ...base, type: "venta" }).success).toBe(false)
    expect(submissionSchema.safeParse({ ...base, localId: "1" }).success).toBe(false)
    expect(submissionSchema.safeParse({ ...base, capturedAt: "ayer" }).success).toBe(false)
  })

  it("no se capturan ventas, pagos ni movimientos de inventario sin conexión", () => {
    for (const type of ["venta", "pago", "inventario", "movimiento"]) {
      expect(submissionSchema.safeParse({ ...base, type }).success).toBe(false)
    }
  })

  it("la huella del contenido no depende del orden de las llaves", () => {
    expect(canonicalJson({ b: 1, a: { d: [1, { y: 2, x: 1 }], c: null } })).toBe(canonicalJson({ a: { c: null, d: [1, { x: 1, y: 2 }] }, b: 1 }))
    expect(canonicalJson({ a: 1 })).not.toBe(canonicalJson({ a: "1" }))
    expect(canonicalJson({ a: undefined, b: 2 })).toBe(canonicalJson({ b: 2 }))
  })

  it("permisos de captura por tipo de registro", () => {
    expect(can("supervisor", RECORD_PERMISSION.riego)).toBe(true)
    expect(can("supervisor", RECORD_PERMISSION.cosecha)).toBe(true)
    expect(can("almacen", RECORD_PERMISSION.aplicacion)).toBe(false)
    expect(can("consulta", RECORD_PERMISSION.observacion)).toBe(false)
    expect(can("agronomo", "offline.review")).toBe(true)
    expect(can("supervisor", "offline.review")).toBe(false)
  })
})

describe("observaciones de campo", () => {
  const valid = {
    id: "22222222-2222-4222-8222-222222222222",
    projectId: "33333333-3333-4333-8333-333333333333",
    plotId: "__none__",
    date: todayISO(),
    time: "08:30",
    category: "plaga",
    severity: "alta",
    title: "Pulgón",
    description: "",
    latitude: "20.5",
    longitude: "-100.8",
    responsibleId: "__none__",
  }

  it("acepta una observación con ubicación", () => {
    const r = observationSchema.safeParse(valid)
    expect(r.success).toBe(true)
    expect(r.data?.plotId).toBeNull()
    expect(r.data?.latitude).toBe(20.5)
  })

  it("exige latitud y longitud juntas, dentro de rango", () => {
    expect(observationSchema.safeParse({ ...valid, longitude: "" }).success).toBe(false)
    expect(observationSchema.safeParse({ ...valid, latitude: "91" }).success).toBe(false)
    expect(observationSchema.safeParse({ ...valid, latitude: "", longitude: "" }).success).toBe(true)
  })

  it("rechaza fechas futuras y títulos vacíos", () => {
    expect(observationSchema.safeParse({ ...valid, date: "2999-01-01" }).success).toBe(false)
    expect(observationSchema.safeParse({ ...valid, title: "  " }).success).toBe(false)
  })
})

describe("seguridad", () => {
  it("solo redirige a rutas internas", () => {
    expect(safeRedirectPath("/proyectos/1?tab=costos")).toBe("/proyectos/1?tab=costos")
    expect(safeRedirectPath("/campo")).toBe("/campo")
    for (const evil of ["//evil.com", "/\\evil.com", "/\\/evil.com", "https://evil.com", "/\t/evil.com", "javascript:alert(1)", "", null, undefined]) {
      expect(safeRedirectPath(evil)).toBe("/dashboard")
    }
  })

  it("distingue reglas de negocio de fallas transitorias", () => {
    for (const code of ["22023", "23505", "23503", "23514", "42501", "P0001", "P0002"]) expect(isRetryableDbError({ code })).toBe(false)
    for (const code of ["", "40001", "40P01", "57014", "08006", "PGRST000"]) expect(isRetryableDbError({ code })).toBe(true)
  })
})

describe("consultas paginadas", () => {
  it("pide páginas de 1,000 hasta el límite y se detiene en la última", async () => {
    const { fetchRows } = await import("@/lib/supabase/rows")
    const total = 2_345
    const calls: [number, number][] = []
    const query = {
      range(from: number, to: number) {
        calls.push([from, to])
        const data = Array.from({ length: Math.max(0, Math.min(to, total - 1) - from + 1) }, (_, i) => from + i)
        return Promise.resolve({ data, error: null })
      },
    }
    const all = await fetchRows(query, 10_000)
    expect(all.data).toHaveLength(total)
    expect(calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]])

    calls.length = 0
    const limited = await fetchRows(query, 1_500)
    expect(limited.data).toHaveLength(1_500)
    expect(calls).toEqual([[0, 999], [1000, 1499]])
  })
})
