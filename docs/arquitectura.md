# Arquitectura técnica

## Visión general

```
Navegador (React 19, PWA en Fase 6)
   │  Server Actions / RSC streaming
Next.js 16 (App Router, Cache Components)
   ├─ src/proxy.ts ............ refresca la sesión y redirige si no hay sesión (verificación optimista)
   ├─ lib/auth/session.ts ..... DAL: getCurrentUser / getMemberships / getOrgContext
   ├─ features/*/actions.ts ... Server Actions: validan con Zod, verifican rol, llaman a Supabase
   └─ features/*/queries.ts ... lecturas server-only filtradas por la organización activa
   │  PostgREST (clave publishable + JWT del usuario)
Supabase
   ├─ PostgreSQL + RLS ........ aislamiento por organization_id y rol
   ├─ Funciones RPC plpgsql ... operaciones transaccionales (inventario, ventas, pagos…)
   ├─ Auth .................... correo/contraseña, recuperación, invitaciones
   └─ Storage ................. evidencias y documentos (rutas org_id/…) — Fase 3
```

**Defensa en profundidad:** la interfaz oculta acciones según `lib/auth/roles.ts`, las
Server Actions vuelven a validar sesión, rol y datos, y la base de datos aplica RLS y
reglas en funciones SQL. Ninguna capa confía en la anterior.

## Estructura de carpetas

```
src/
  app/
    (auth)/            login, registro, recuperar, restablecer
    (app)/             shell autenticado (menú lateral + barra superior)
      dashboard/
      ranchos/[id]     ranchos y sus parcelas
      cultivos/
      proyectos/       lista, nuevo, [id] (expediente con costos), [id]/editar
      inventario/ maquinaria/ personal/ produccion/
      clientes/ ventas/ (nueva, [id]) pagos/ gastos/
      configuracion/   organizacion, usuarios, perfil
    auth/callback/     intercambio de código PKCE / token_hash
    auth/aceptar/      aceptación de invitaciones (tokens en el fragmento)
    bienvenida/        alta de la primera organización
  components/
    ui/                componentes shadcn/ui
    layout/            sidebar, selector de organización, menús
    forms/             FormInput, FormSelect, useActionForm, SubmitButton
    shared/            KpiCard, ConfirmAction
  features/<módulo>/   schemas.ts (Zod) · actions.ts · queries.ts · components/
  lib/
    supabase/          client, server, proxy, admin (server-only)
    auth/              roles.ts (matriz de permisos), session.ts (DAL)
    actions.ts         ActionResult y traducción de errores de BD
    format.ts          MXN, números y fechas (America/Mexico_City)
  types/database.ts    tipos generados por `supabase gen types`
supabase/
  migrations/          una migración por fase
  seed.sql             datos de demostración (solo local)
  tests/database/      pruebas pgTAP
tests/unit/            pruebas Vitest
```

## Patrones

- **Lecturas:** Server Components asíncronos dentro de `<Suspense>` (requisito de Cache
  Components al leer cookies). El layout `(app)` envuelve `children` en un límite, por lo
  que cada página puede `await getOrgContext()` directamente.
- **Escrituras:** formulario cliente con React Hook Form + `zodResolver` (modo `raw`) →
  Server Action que re-valida con el mismo esquema → Supabase → `refresh()`.
  Las acciones devuelven `ActionResult` con errores por campo que el formulario muestra.
- **Operaciones críticas:** funciones `plpgsql` `SECURITY DEFINER` con `search_path = ''`,
  que verifican `has_role()` y bloquean filas (`FOR UPDATE`) para mantener consistencia.
- **Organización activa:** cookie `ag360_org` (httpOnly), validada siempre contra las
  membresías del usuario.
- **Auditoría:** trigger genérico `log_audit()` que guarda `old/new` en `audit_logs`.

## Modelo de datos

### Implementado (Fase 1)

| Tabla          | Propósito                                                        |
| -------------- | ---------------------------------------------------------------- |
| organizations  | Cliente SaaS (tenant). `is_demo` separa datos de demostración.   |
| profiles       | 1:1 con `auth.users`; se crea por trigger al registrarse.        |
| memberships    | Usuario ↔ organización con rol (`app_role`) y estado.            |
| invitations    | Invitaciones pendientes; se aceptan al crear la cuenta.          |
| audit_logs     | Historial de cambios con actor y datos anteriores/nuevos.        |

Funciones: `is_member`, `has_role`, `user_role`, `shares_organization`,
`create_organization`, `invite_member`, `cancel_invitation`, `update_member`.

### Implementado (Fase 2)

| Tabla                   | Propósito                                                                 |
| ----------------------- | ------------------------------------------------------------------------- |
| farms                   | Ranchos: ubicación, superficie total opcional, coordenadas, activo.       |
| plots                   | Parcelas de un rancho: superficie, suelo, sistema de riego.              |
| crops                   | Catálogo de cultivos y variedades con ciclo y unidad de producción.      |
| projects                | Proyecto agrícola: folio `PRY-AAAA-0001`, cultivo, 8 estados, fechas, metas. |
| project_plots           | N:M proyecto ↔ parcela con superficie asignada.                          |
| project_status_history  | Historial de estados con nota y autor (lo escribe un trigger).           |
| organization_counters   | Folios consecutivos por organización y año (solo vía `next_folio`).      |

Reglas en base de datos:

- **Integridad multiempresa:** FKs compuestas `(organization_id, id)`; una parcela, proyecto o
  asignación no puede referir datos de otra organización aunque se conozca el id.
- **Superficie:** las parcelas activas no exceden la superficie del rancho; lo asignado a
  proyectos vigentes (no cerrados ni cancelados) no excede la parcela. Los triggers bloquean
  la fila padre (`FOR UPDATE`) para evitar sobreasignación concurrente.
- **Estados:** solo cambian con la RPC `change_project_status` (transiciones definidas en
  `project_transition_allowed`, reflejadas en `features/projects/status.ts`). Cancelar exige
  motivo; reabrir un proyecto cerrado/cancelado es exclusivo de propietario/administrador y
  verifica que la superficie siga disponible.
- **Permisos:** lectura para miembros; alta/edición para propietario, administrador y
  agrónomo; eliminación solo propietario/administrador, y en proyectos solo en planeación o
  cancelados. Columnas como `organization_id`, `code` y `status` no son editables por el cliente.
- **Dashboard:** `dashboard_summary(org)` agrega los indicadores en SQL con `SECURITY INVOKER`
  (respeta la RLS del usuario).

### Implementado (módulos financieros)

| Tabla / vista               | Propósito                                                                        |
| --------------------------- | -------------------------------------------------------------------------------- |
| inventory_products          | Insumos con existencia y valor (`stock`, `stock_value`); costo promedio derivado. |
| inventory_movements         | Entrada, consumo, devolución y ajustes. Inmutables; se anulan con contrapartida.  |
| machinery · machinery_usage | Equipos con costo/hora; uso por proyecto con la tarifa congelada.                 |
| employees · labor_records   | Personal con salario diario; jornales y destajo por proyecto/parcela.             |
| project_expenses            | Gastos directos (renta, agua, energía, fletes, maquila…).                         |
| harvests                    | Cortes por proyecto/parcela en kg, con calidad.                                   |
| customers                   | Compradores con días de crédito.                                                  |
| sales · sale_items          | Ventas con folio `VTA-AAAA-0001`; partidas en kg imputadas a proyectos.           |
| payments                    | Pagos parciales o de liquidación; se cancelan, no se eliminan.                    |
| v_project_cost_entries      | **Única fuente de costos**: un renglón por consumo, uso, jornal o gasto.          |
| v_project_costs             | Por proyecto: costo por categoría, costo/ha, costo/kg, cosechado, vendido, ventas, cobrado, saldo, utilidad y % de presupuesto. |
| v_sale_balances             | Saldo, estado de pago y días vencidos por venta.                                  |

RPC transaccionales (`SECURITY DEFINER`, verifican rol y bloquean filas):
`register_inventory_movement`, `reverse_inventory_movement`, `create_sale`, `cancel_sale`,
`register_payment`, `cancel_payment`. Indicadores: `finance_summary(org)` (`SECURITY INVOKER`).

**Regla de costos (sin duplicidad):**

- El costo de un proyecto proviene solo de consumos de inventario, uso de maquinaria, mano de obra y
  gastos directos. Las compras/entradas de almacén no son costo de proyecto; el insumo se vuelve costo al
  consumirse, valorado al costo promedio.
- Las categorías de gasto directo excluyen insumos, maquinaria y mano de obra, para que no puedan
  capturarse por dos vías. La tarifa de maquinaria se define sin combustible cuando el diésel sale del
  inventario.
- Valor en almacén + costo imputado a proyectos = compras netas, al centavo: las salidas que vacían la
  existencia se llevan exactamente el valor restante y las devoluciones regresan al costo con que el
  proyecto consumió.
- `v_project_costs` agrega sobre `v_project_cost_entries`, y cada métrica (área, cosecha, ventas, cobranza)
  se agrega en su propia subconsulta antes de unir; ninguna unión multiplica renglones.
- Duplicados por reintento: los registros llevan un `id` generado en el cliente (`lib/ids.ts`); las RPC
  devuelven el registro existente y las altas directas tratan el choque de llave primaria como éxito.
  Además: una factura por proveedor y proyecto, máximo 1 jornal por empleado y día, cada movimiento de
  inventario se anula una sola vez y lo vendido nunca excede lo cosechado.

**Transaccionalidad y concurrencia:** cada RPC corre en una sola transacción (si una partida es inválida
no queda ni el encabezado ni el folio). Se bloquea con `FOR UPDATE` el producto (existencias), la venta
(saldo) y los proyectos de una venta (en orden de id, para evitar interbloqueos). Los registros de costo
toman `FOR SHARE` sobre el proyecto: un cierre concurrente (`change_project_status`, `FOR UPDATE`) espera
y, una vez cerrado, el proyecto ya no admite costos ni ventas.

**Ventas y cobranza:** ventas registradas, dinero cobrado y saldo se reportan por separado; la utilidad
bruta es ventas − costo de producción. Lo cobrado de una venta con varios proyectos se prorratea por
importe de partida.

**Acceso:** operación (inventario, maquinaria, personal, cosechas) la leen todos los miembros; clientes,
ventas, pagos y gastos solo propietario, administrador, finanzas y consulta (`finance.read`).

### Pendiente

- Presupuestos por categoría (`project_budgets`), reportes exportables (CSV/XLSX/PDF) y bitácoras de
  campo (`irrigation_logs`, `chemical_applications`, `attachments`).
- Inventario: almacenes múltiples, lotes y caducidades, transferencias, proveedores como catálogo.
- Ventas: anticipos sin venta, notas de crédito y CFDI.

## Roadmap

1. ✅ Fundación: Next.js, tema, Supabase, autenticación, organizaciones, roles, usuarios.
2. ✅ Dashboard con indicadores reales, ranchos, parcelas, cultivos, proyectos y expediente.
3. ✅ Inventario de insumos, maquinaria, recursos humanos · ⏳ bitácoras de campo.
4. ✅ Cortes de producción, clientes, ventas, pagos, cuentas por cobrar.
5. ✅ Gastos, costos, rentabilidad · ⏳ presupuestos por categoría, reportes (CSV/XLSX/PDF).
6. PWA, captura sin conexión con sincronización, pruebas E2E, endurecimiento y despliegue.
