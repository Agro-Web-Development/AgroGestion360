"use client"

import { Tabs } from "@/components/ui/tabs"

/**
 * Pestañas que guardan la activa en la URL (sin volver a consultar el
 * servidor), para que los filtros y la recarga regresen a la misma pestaña.
 */
export function UrlTabs({
  param = "tab",
  defaultValue,
  className,
  children,
}: {
  param?: string
  defaultValue: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <Tabs
      defaultValue={defaultValue}
      className={className}
      onValueChange={(value) => {
        const params = new URLSearchParams(window.location.search)
        params.set(param, value)
        window.history.replaceState(null, "", `?${params.toString()}`)
      }}
    >
      {children}
    </Tabs>
  )
}
