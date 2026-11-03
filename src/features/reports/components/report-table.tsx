"use client"

import { Download } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDate, formatMoney, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import { cell, toCsv, type ReportColumn, type ReportValue } from "../csv"


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

export function ReportTable({
  columns,
  rows,
  filename,
  emptyText = "Sin registros en el periodo.",
}: {
  columns: ReportColumn[]
  rows: readonly object[]
  filename: string
  emptyText?: string
}) {
  const numeric = (c: ReportColumn) => c.format === "money" || c.format === "number"
  const hasTotals = rows.length > 1 && columns.some((c) => c.total)
  const download = () => {
    const url = URL.createObjectURL(new Blob([toCsv(columns, rows)], { type: "text/csv;charset=utf-8" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `${filename}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={download} disabled={rows.length === 0}>
          <Download aria-hidden /> CSV
        </Button>
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
