import "server-only"

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js"
import type { z } from "zod"

import { isDuplicateId } from "@/lib/actions"
import type { Database, TablesInsert } from "@/types/database"
import { needsUnitWeight, type harvestSchema } from "./schemas"

/**
 * Alta idempotente de un corte (lote de producción), compartida por la Server
 * Action y la sincronización sin conexión. El folio del lote y el número de
 * corte por omisión los asigna un trigger.
 */
export async function createHarvest(
  supabase: SupabaseClient<Database>,
  orgId: string,
  v: z.output<typeof harvestSchema>
): Promise<PostgrestError | null> {
  const { error } = await supabase.from("harvests").insert({
    id: v.id,
    organization_id: orgId,
    project_id: v.projectId,
    plot_id: v.plotId,
    harvest_date: v.date,
    cut_number: v.cutNumber,
    quality: v.quality,
    classification: v.classification,
    unit: v.unit,
    quantity: v.quantity,
    unit_weight_kg: needsUnitWeight(v.unit) ? v.unitWeightKg : null,
    packages: v.packages,
    responsible_id: v.responsibleId,
    notes: v.notes,
  } as TablesInsert<"harvests">)
  return error && !isDuplicateId(error) ? error : null
}
