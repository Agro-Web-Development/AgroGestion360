"use client"

import { Download, FileSpreadsheet, Printer } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDate, formatMoney, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import { buildXlsx } from "@/lib/xlsx"
import { cell, toCsv, toXlsxRows, type ReportColumn, type ReportValue } from "../csv"

function display(value: ReportValue, column: ReportColumn): string {
  if (value === null || value === "") return "—"
  switch (column.format) {
    case "money":
      return formatMoney(value)
    case "number":
      return formatNumber(value, column.unit)
    case "date":
      return formatDate(String(value))
    default:
      return String(value)
  }
}

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Tabla de reporte con totales y exportación a CSV, Excel (.xlsx con números
 * y fechas reales) y PDF (impresión del navegador, solo el reporte).
 */
export function ReportTable({
  columns,
  rows,
  filename,
  emptyText = "Sin registros en el periodo.",
  excel = false,
  printable = false,
  sheetName,
}: {
  columns: ReportColumn[]
  rows: readonly object[]
  filename: string
  emptyText?: string
  /** Ofrece la descarga en Excel. */
  excel?: boolean
  /** Ofrece imprimir / guardar como PDF. */
  printable?: boolean
  sheetName?: string
}) {
  const numeric = (c: ReportColumn) => c.format === "money" || c.format === "number"
  const hasTotals = rows.length > 1 && columns.some((c) => c.total)

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap justify-end gap-2" data-print="hide">
        <Button
          variant="outline"
          size="sm"
          onClick={() => save(new Blob([toCsv(columns, rows)], { type: "text/csv;charset=utf-8" }), `${filename}.csv`)}
          disabled={rows.length === 0}
        >
          <Download aria-hidden /> CSV
        </Button>
        {excel && (
          <Button
            variant="outline"
            size="sm"
            disabled={rows.length === 0}
            onClick={() => {
              const data = buildXlsx(sheetName ?? filename, columns, toXlsxRows(columns, rows))
              save(
                new Blob([data.buffer as ArrayBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
                `${filename}.xlsx`
              )
            }}
          >
            <FileSpreadsheet aria-hidden /> Excel
          </Button>
        )}
        {printable && (
          <Button variant="outline" size="sm" disabled={rows.length === 0} onClick={() => window.print()}>
            <Printer aria-hidden /> PDF
          </Button>
        )}
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={c.key} className={cn(numeric(c) && "text-right", c.secondary && "hidden md:table-cell")}>
                  {c.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-8 text-center text-muted-foreground">
                  {emptyText}
                </TableCell>
              </TableRow>
            )}
            {rows.map((r, i) => (
              <TableRow key={i}>
                {columns.map((c, j) => (
                  <TableCell
                    key={c.key}
                    className={cn(
                      numeric(c) && "text-right tabular-nums",
                      j === 0 && "font-medium",
                      c.secondary && "hidden md:table-cell"
                    )}
                  >
                    {display(cell(r, c.key), c)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
          {hasTotals && (
            <TableFooter>
              <TableRow>
                {columns.map((c, j) => (
                  <TableCell
                    key={c.key}
                    className={cn(numeric(c) && "text-right font-semibold tabular-nums", c.secondary && "hidden md:table-cell")}
                  >
                    {j === 0
                      ? "Total"
                      : c.total
                        ? display(
                            Math.round(rows.reduce((s, r) => s + Number(cell(r, c.key) ?? 0), 0) * 1000) / 1000,
                            c
                          )
                        : ""}
                  </TableCell>
                ))}
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  )
}
