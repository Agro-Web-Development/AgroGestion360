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

### Planeado (Fases 2–5)

Todas las tablas llevan `id uuid`, `organization_id` (FK + índice), `created_at/by`,
`updated_at/by`, RLS con `is_member()` para lectura y `has_role()` para escritura.
Importes en `NUMERIC(14,2)`, cantidades en `NUMERIC(14,3)`.

- **Agrícola:** `farms` → `plots`; `crops`; `projects` (8 estados); `project_plots` (N:M con
  superficie asignada); `project_budgets` por categoría de costo.
- **Inventario:** `suppliers`, `input_categories`, `warehouses`, `inventory_products`,
  `inventory_lots` (lote, caducidad, costo), `inventory_stock` (CHECK ≥ 0),
  `inventory_movements` (entrada, salida, ajuste, devolución, transferencia; las salidas por
  consumo exigen `project_id` y `plot_id`). Cada movimiento lleva `idempotency_key` única.
- **Bitácoras:** `irrigation_logs`, `chemical_applications`, `agricultural_activities` +
  `activity_types`; `attachments` polimórfico sobre Storage.
- **Maquinaria y personal:** `machinery`, `machinery_usage`, `machinery_maintenance`;
  `employees`, `crews`, `labor_records` (jornada o destajo).
- **Producción y ventas:** `harvests` (cortes), `harvest_batches` (calidad, disponible,
  merma), `customers`, `sales` (folio por organización), `sale_items` → `harvest_batches`,
  `payments` (anticipo, parcial, liquidación).
- **Finanzas:** `project_expenses`; vistas `v_project_costs`, `v_sale_balances`,
  `v_project_profitability`.

**Regla de costos:** el costo de un proyecto proviene de *consumos* (salidas de inventario),
mano de obra, maquinaria y gastos directos. Las compras/entradas de almacén no generan costo
de proyecto, evitando duplicidad. Ventas registradas y dinero cobrado se reportan por
separado; el cobro no se presenta como utilidad.

## Roadmap

1. ✅ Fundación: Next.js, tema, Supabase, autenticación, organizaciones, roles, usuarios.
2. Dashboard con indicadores reales, ranchos, parcelas, cultivos, proyectos y expediente.
3. Inventarios, bitácoras, maquinaria, recursos humanos.
4. Cortes de producción, clientes, ventas, pagos, cuentas por cobrar.
5. Presupuestos, gastos, costos, rentabilidad, reportes (CSV/XLSX/PDF).
6. PWA, captura sin conexión con sincronización, pruebas E2E, endurecimiento y despliegue.
