import type { PostgrestError } from "@supabase/supabase-js"

/**
 * Máximo de filas por respuesta de PostgREST (`max_rows` en supabase/config.toml
 * y en el proyecto de producción). Una consulta con `.limit(5000)` recibe solo
 * 1,000 filas, sin error: los reportes quedarían incompletos en silencio.
 */
export const MAX_ROWS_PER_REQUEST = 1000

type Page<T> = PromiseLike<{ data: T[] | null; error: PostgrestError | null }>

/**
 * Trae hasta `limit` filas en páginas de 1,000 (`range`). La consulta debe
 * tener un orden total (incluye un desempate por id) para que las páginas no
 * se traslapen. Con `limit` ≤ 1,000 hace una sola solicitud.
 */
export async function fetchRows<T>(
  query: { range(from: number, to: number): Page<T> },
  limit: number
): Promise<{ data: T[]; error: null } | { data: null; error: PostgrestError }> {
  const rows: T[] = []
  for (let from = 0; from < limit; from += MAX_ROWS_PER_REQUEST) {
    const to = Math.min(from + MAX_ROWS_PER_REQUEST, limit) - 1
    const { data, error } = await query.range(from, to)
    if (error) return { data: null, error }
    rows.push(...(data ?? []))
    if (!data || data.length < to - from + 1) break
  }
  return { data: rows, error: null }
}
