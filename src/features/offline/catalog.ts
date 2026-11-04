import "server-only"

import { APPLICABLE_KINDS } from "@/features/inventory/schemas"
import type { ApiMembership, ApiSession } from "@/lib/auth/api-session"
import { can } from "@/lib/auth/roles"

/**
 * Catálogos que el dispositivo guarda en IndexedDB para capturar sin conexión.
 * Solo lo indispensable para los formularios de campo: nombres e
 * identificadores, sin importes, costos ni datos financieros.
 */
export async function getOfflineCatalog(session: ApiSession, membership: ApiMembership) {
  const { supabase } = session
  const org = membership.organizationId
  const [profile, projects, activityTypes, employees, products, warehouses, balances, machines] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", session.userId).maybeSingle(),
    supabase
      .from("projects")
      .select("id, code, name, status, start_date, crop:crops!inner(name, variety), project_plots(assigned_area_ha, plot:plots!inner(id, name, farm:farms!inner(name)))")
      .eq("organization_id", org)
      .not("status", "in", "(cerrado,cancelado)")
      .order("code"),
    supabase.from("activity_types").select("id, name").eq("organization_id", org).eq("is_active", true).order("name"),
    supabase.from("employees").select("id, full_name, position").eq("organization_id", org).eq("is_active", true).order("full_name"),
    supabase
      .from("inventory_products")
      .select("id, name, unit, track_lots, category:inventory_categories!inner(name, kind)")
      .eq("organization_id", org)
      .eq("is_active", true)
      .in("inventory_categories.kind", [...APPLICABLE_KINDS])
      .order("name"),
    supabase.from("warehouses").select("id, name").eq("organization_id", org).eq("is_active", true).order("name"),
    supabase
      .from("inventory_balances")
      .select("product_id, warehouse_id, lot_id, quantity, lot:inventory_lots(lot_number, expiry_date)")
      .eq("organization_id", org)
      .gt("quantity", 0),
    supabase.from("machinery").select("id, name").eq("organization_id", org).eq("is_active", true).order("name"),
  ])
  for (const r of [projects, activityTypes, employees, products, warehouses, balances, machines]) {
    if (r.error) throw new Error("No fue posible cargar los catálogos de campo.")
  }

  return {
    generatedAt: new Date().toISOString(),
    user: { id: session.userId, email: session.email, fullName: profile.data?.full_name ?? "" },
    organization: { id: org, name: membership.organizationName },
    role: membership.role,
    permissions: { fieldlogs: can(membership.role, "fieldlogs.write"), harvest: can(membership.role, "harvest.write") },
    organizations: session.memberships.map((m) => ({ id: m.organizationId, name: m.organizationName })),
    projects: projects.data!.map(({ project_plots, ...p }) => ({
      ...p,
      plots: project_plots
        .map((pp) => ({ id: pp.plot.id, name: pp.plot.name, farm: pp.plot.farm.name, areaHa: Number(pp.assigned_area_ha) }))
        .sort((a, b) => a.farm.localeCompare(b.farm, "es") || a.name.localeCompare(b.name, "es")),
    })),
    activityTypes: activityTypes.data!.map((t) => ({ value: t.id, label: t.name })),
    employees: employees.data!.map((e) => ({ value: e.id, label: e.position ? `${e.full_name} · ${e.position}` : e.full_name })),
    products: products.data!.map((p) => ({ id: p.id, name: p.name, unit: p.unit, trackLots: p.track_lots, category: p.category.name })),
    warehouses: warehouses.data!.map((w) => ({ value: w.id, label: w.name })),
    lotBalances: balances.data!.map((b) => ({
      productId: b.product_id,
      warehouseId: b.warehouse_id,
      lotId: b.lot_id,
      lotNumber: b.lot?.lot_number ?? null,
      expiryDate: b.lot?.expiry_date ?? null,
      quantity: Number(b.quantity),
    })),
    machines: machines.data!.map((m) => ({ value: m.id, label: m.name })),
  }
}

export type OfflineCatalog = Awaited<ReturnType<typeof getOfflineCatalog>>
