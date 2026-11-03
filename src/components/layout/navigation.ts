import {
  BarChart3,
  Building2,
  ChartColumnBig,
  ClipboardList,
  HandCoins,
  LayoutDashboard,
  Leaf,
  Map,
  Package,
  ReceiptText,
  ShoppingCart,
  Sprout,
  Tractor,
  UserCircle,
  Users,
  UsersRound,
  Wallet,
  Wheat,
  type LucideIcon,
} from "lucide-react"

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  /** Fase del plan en la que se habilita el módulo; sin valor = disponible. */
  comingInPhase?: number
}

export type NavGroup = { label: string; items: NavItem[] }

export const NAVIGATION: NavGroup[] = [
  {
    label: "General",
    items: [{ title: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Producción agrícola",
    items: [
      { title: "Proyectos", href: "/proyectos", icon: Sprout },
      { title: "Ranchos y parcelas", href: "/ranchos", icon: Map },
      { title: "Cultivos", href: "/cultivos", icon: Leaf },
    ],
  },
  {
    label: "Operación",
    items: [
      { title: "Inventario", href: "/inventario", icon: Package },
      { title: "Bitácoras", href: "/bitacoras", icon: ClipboardList },
      { title: "Maquinaria", href: "/maquinaria", icon: Tractor },
      { title: "Personal", href: "/personal", icon: UsersRound },
    ],
  },
  {
    label: "Comercialización",
    items: [
      { title: "Dashboard comercial", href: "/comercial", icon: ChartColumnBig },
      { title: "Producción", href: "/produccion", icon: Wheat },
      { title: "Clientes", href: "/clientes", icon: Building2 },
      { title: "Ventas", href: "/ventas", icon: ShoppingCart },
      { title: "Cobranza", href: "/pagos", icon: HandCoins },
    ],
  },
  {
    label: "Finanzas",
    items: [
      { title: "Gastos y rentabilidad", href: "/gastos", icon: Wallet },
      { title: "Reportes operativos", href: "/reportes", icon: BarChart3 },
    ],
  },
  {
    label: "Configuración",
    items: [
      { title: "Organización", href: "/configuracion/organizacion", icon: ReceiptText },
      { title: "Usuarios y roles", href: "/configuracion/usuarios", icon: Users },
      { title: "Mi perfil", href: "/configuracion/perfil", icon: UserCircle },
    ],
  },
]
