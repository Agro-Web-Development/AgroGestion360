import { BarChart3, Package, Sprout, Tractor } from "lucide-react"

import { Logo } from "@/components/brand/logo"

const HIGHLIGHTS = [
  { icon: Sprout, text: "Proyectos de siembra con expediente completo" },
  { icon: Package, text: "Inventario de insumos con trazabilidad por parcela" },
  { icon: Tractor, text: "Maquinaria, personal y bitácoras de campo" },
  { icon: BarChart3, text: "Costos, ventas, cobranza y rentabilidad" },
]

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-6 p-6 md:p-10">
        <Logo className="text-lg" />
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">{children}</div>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          AgroGestión 360 · Hecho para el campo mexicano
        </p>
      </div>
      <aside className="relative hidden overflow-hidden bg-sidebar text-sidebar-foreground lg:flex lg:flex-col lg:justify-center lg:p-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-20 [background:repeating-linear-gradient(115deg,transparent_0_38px,var(--sidebar-primary)_38px_40px)]"
        />
        <div className="relative max-w-md space-y-8">
          <h2 className="text-3xl font-semibold leading-tight text-balance">
            Del cultivo a la cobranza, todo tu proyecto agrícola en un solo lugar.
          </h2>
          <ul className="space-y-4">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-sidebar-accent">
                  <Icon className="size-5 text-sidebar-primary" aria-hidden />
                </span>
                <span className="text-sidebar-foreground/90">{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  )
}
