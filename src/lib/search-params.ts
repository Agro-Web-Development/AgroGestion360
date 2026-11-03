import { isValidDate } from "@/lib/validation"

/** Valor de los selectores de filtro que equivale a "todos". */
export const ALL_PARAM = "__all__"

/** Lee un parámetro de búsqueda como texto (ignora "todos" y valores repetidos). */
export function param(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value
  return v && v !== ALL_PARAM ? v : undefined
}

/** Fecha AAAA-MM-DD válida o undefined. */
export function dateParam(value: string | string[] | undefined): string | undefined {
  const v = param(value)
  return v && isValidDate(v) ? v : undefined
}

/** UUID válido o undefined (los filtros nunca llegan sin validar a la consulta). */
export function idParam(value: string | string[] | undefined): string | undefined {
  const v = param(value)
  return v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v : undefined
}
