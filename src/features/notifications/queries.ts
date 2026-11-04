import "server-only"

import type { AppNotification } from "@/components/layout/notifications-menu"
import { can } from "@/lib/auth/roles"
import { getOrgContext } from "@/lib/auth/session"
import { formatMoney, formatNumber } from "@/lib/format"
import { createClient } from "@/lib/supabase/server"

const EXPIRY_DAYS = 30

/**
 * Alertas vigentes de la organización para el centro de notificaciones, según
 * lo que el rol puede consultar: existencias bajo el mínimo, lotes por caducar,
 * mantenimiento vencido o próximo, cobranza vencida, presupuestos en riesgo y
 * registros sin conexión que requieren revisión. Se calculan al cargar la
 * página (sin tabla propia): desaparecen cuando se atiende la causa.
 */
export async function getNotifications(): Promise<AppNotification[]> {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const org = ctx.organization.id
  const finance = can(ctx.role, "finance.read")
  const review = can(ctx.role, "offline.review")
  const none = Promise.resolve({ data: null, error: null })

  const [products, lots, machines, overdue, budgets, pending] = await Promise.all([
    supabase.from("inventory_products").select("id, name, unit, stock, min_stock").eq("organization_id", org).eq("is_active", true).not("min_stock", "is", null),
    supabase
      .from("v_inventory_stock")
      .select("product_name, lot_number, days_to_expiry")
      .eq("organization_id", org)
      .gt("quantity", 0)
      .lte("days_to_expiry", EXPIRY_DAYS)
      .order("days_to_expiry")
      .limit(20),
    supabase.from("v_machinery_status").select("machine_id, name, maintenance_alert").eq("organization_id", org).in("maintenance_alert", ["vencido", "proximo"]),
    finance
      ? supabase.from("v_sale_balances").select("id, balance").eq("organization_id", org).gt("days_overdue", 0).gt("balance", 0)
      : none,
    finance
      ? supabase
          .from("v_project_costs")
          .select("project_id, code, budget_status, budget_used_pct")
          .eq("organization_id", org)
          .in("budget_status", ["critico", "agotado"])
          .not("status", "in", "(cerrado,cancelado)")
      : none,
    review
      ? supabase.from("offline_submissions").select("id", { count: "exact", head: true }).eq("organization_id", org).eq("status", "requiere_revision")
      : Promise.resolve({ count: 0, error: null }),
  ])

  const items: AppNotification[] = []

  const low = (products.data ?? []).filter((p) => Number(p.stock) <= Number(p.min_stock))
  if (low.length > 0) {
    items.push({
      id: "stock",
      title: `${formatNumber(low.length)} insumo(s) en o bajo el mínimo`,
      description: low
        .slice(0, 3)
        .map((p) => `${p.name}: ${formatNumber(Number(p.stock), p.unit)}`)
        .join(" · "),
      href: "/inventario",
    })
  }
  if (lots.data?.length) {
    const expired = lots.data.filter((l) => (l.days_to_expiry ?? 0) < 0).length
    items.push({
      id: "caducidad",
      title: expired > 0 ? `${formatNumber(expired)} lote(s) de insumo caducado(s)` : `Lotes por caducar en ${EXPIRY_DAYS} días`,
      description: lots.data
        .slice(0, 3)
        .map((l) => `${l.product_name} ${l.lot_number ?? ""}`.trim())
        .join(" · "),
      href: "/inventario?tab=almacenes",
    })
  }
  if (machines.data?.length) {
    const due = machines.data.filter((m) => m.maintenance_alert === "vencido")
    items.push({
      id: "mantenimiento",
      title: due.length > 0 ? `Mantenimiento vencido: ${formatNumber(due.length)} equipo(s)` : "Mantenimiento próximo",
      description: machines.data
        .slice(0, 3)
        .map((m) => m.name)
        .join(" · "),
      href: "/maquinaria",
    })
  }
  if (overdue.data?.length) {
    const total = overdue.data.reduce((t, s) => t + Number(s.balance), 0)
    items.push({
      id: "cobranza",
      title: `${formatNumber(overdue.data.length)} venta(s) con pago vencido`,
      description: `Saldo vencido: ${formatMoney(total)}`,
      href: "/pagos",
    })
  }
  for (const b of budgets.data ?? []) {
    items.push({
      id: `presupuesto-${b.project_id}`,
      title: `Presupuesto ${b.budget_status === "agotado" ? "agotado" : "en nivel crítico"}: ${b.code}`,
      description: `${formatNumber(Number(b.budget_used_pct))} % utilizado`,
      href: `/presupuestos/${b.project_id}`,
    })
  }
  if (pending.count) {
    items.push({
      id: "sincronizacion",
      title: `${formatNumber(pending.count)} registro(s) sin conexión por revisar`,
      href: "/sincronizacion",
    })
  }
  return items
}
