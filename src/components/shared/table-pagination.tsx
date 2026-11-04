"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { formatNumber } from "@/lib/format"
import { LIST_LIMIT } from "@/lib/list-limit"

export const PAGE_SIZE = 50

/**
 * Página actual de una lista ya filtrada. Si la lista cambia (filtro, nueva
 * captura) y la página queda fuera de rango, regresa a la última válida.
 */
export function usePagination<T>(rows: T[], pageSize = PAGE_SIZE) {
  const [requested, setPage] = useState(0)
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const page = Math.min(requested, pageCount - 1)
  return {
    page,
    pageCount,
    setPage,
    pageRows: rows.slice(page * pageSize, (page + 1) * pageSize),
    pagination: { page, pageCount, pageSize, total: rows.length, onPage: setPage },
  }
}

/**
 * Controles de página bajo una tabla. Avisa cuando la consulta alcanzó el máximo
 * de registros que se cargan (LIST_LIMIT): los totales de la pantalla dejarían
 * de incluir los más antiguos y conviene acotar el periodo.
 */
export function TablePagination({
  page,
  pageCount,
  pageSize,
  total,
  onPage,
}: {
  page: number
  pageCount: number
  pageSize: number
  total: number
  onPage: (page: number) => void
}) {
  const limitReached = total >= LIST_LIMIT
  if (pageCount <= 1 && !limitReached) return null
  const first = page * pageSize + 1
  const last = Math.min(total, (page + 1) * pageSize)

  return (
    <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <p aria-live="polite">
        {formatNumber(first)}–{formatNumber(last)} de {formatNumber(total)}
        {limitReached && ` · Se alcanzó el máximo de ${formatNumber(LIST_LIMIT)} registros: acota el periodo.`}
      </p>
      {pageCount > 1 && (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onPage(page - 1)} disabled={page === 0}>
            <ChevronLeft aria-hidden /> Anterior
          </Button>
          <span className="tabular-nums">
            Página {formatNumber(page + 1)} de {formatNumber(pageCount)}
          </span>
          <Button variant="outline" size="sm" onClick={() => onPage(page + 1)} disabled={page >= pageCount - 1}>
            Siguiente <ChevronRight aria-hidden />
          </Button>
        </div>
      )}
    </div>
  )
}
