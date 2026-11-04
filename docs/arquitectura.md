# Arquitectura técnica

## Visión general

```
Navegador (React 19, PWA instalable)
   ├─ public/sw.js ............ service worker: estáticos en caché, /campo y /offline sin red; nunca API ni Supabase
   ├─ IndexedDB ............... registros capturados sin conexión, fotos pendientes y catálogos (por usuario)
   │  Server Actions / RSC streaming · /api/campo/* (sincronización)
Next.js 16 (App Router, Cache Components)
   ├─ src/proxy.ts ............ refresca la sesión y redirige si no hay sesión (verificación optimista; 401 JSON en /api)
   ├─ lib/auth/session.ts ..... DAL: getCurrentUser / getMemberships / getOrgContext
   ├─ lib/auth/api-session.ts . sesión para Route Handlers (sin redirecciones) y verificación de origen
   ├─ features/*/actions.ts ... Server Actions: validan con Zod, verifican rol, llaman a Supabase
   ├─ features/*/mutations.ts . altas compartidas por las Server Actions y la sincronización sin conexión
   └─ features/*/queries.ts ... lecturas server-only filtradas por la organización activa
   │  PostgREST (clave publishable + JWT del usuario)
Supabase
   ├─ PostgreSQL + RLS ........ aislamiento por organization_id y rol
   ├─ Funciones RPC plpgsql ... operaciones transaccionales (inventario, ventas, pagos…)
   ├─ Auth .................... correo/contraseña, recuperación, invitaciones
   └─ Storage ................. bucket privado `evidencias` (rutas org_id/tipo/registro/archivo)
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
      inventario/      existencias, almacenes y lotes, movimientos, catálogos
      bitacoras/       riego, aplicaciones, actividades, cronología, catálogo de actividades
      maquinaria/      uso, equipos, mantenimiento
      personal/        jornadas, asistencia, cuadrillas, asignaciones, empleados
      reportes/        reportes operativos con exportación CSV
      produccion/      indicadores, cortes, inventario de producto, movimientos; lotes/[id] (trazabilidad)
      comercial/       dashboard comercial (filtros de fechas, cultivo y proyecto)
      clientes/ ([id] expediente) ventas/ (nueva, [id], [id]/editar) pagos/
      finanzas/        dashboard financiero (filtros de fechas, cultivo y proyecto)
      presupuestos/    listado con alertas, [id] (comparativo y versiones), [id]/editar (nueva revisión)
      gastos/ rentabilidad/ flujo-efectivo/ reportes-financieros/ (CSV, Excel y PDF)
      configuracion/   organizacion, usuarios, perfil
      sincronizacion/  revisión de registros capturados sin conexión
    auth/callback/     intercambio de código PKCE / token_hash
    auth/aceptar/      aceptación de invitaciones (tokens en el fragmento)
    bienvenida/        alta de la primera organización
    campo/             captura en campo sin conexión (página estática; datos en IndexedDB)
    offline/           respaldo «Sin conexión» del service worker
    api/campo/         contexto (catálogos), sincronizar y evidencias (Route Handlers)
    manifest.ts        manifiesto de la PWA
  components/
    ui/                componentes shadcn/ui
    layout/            sidebar, selector de organización, menús
    forms/             FormInput, FormSelect, useActionForm, SubmitButton
    shared/            KpiCard, ConfirmAction, ReasonDialog, FilterBar (filtros en la URL), UrlTabs,
                       SearchInput, CatalogRowActions
    pwa/               registro del service worker y botón «Instalar app»
  features/<módulo>/   schemas.ts (Zod) · actions.ts · queries.ts · components/
                       (fieldlogs = bitácoras y evidencias; reports = agregaciones puras y CSV;
                       harvests = cortes, lotes e inventario de producto; commercial = dashboard comercial;
                       finance = presupuestos, gastos, flujo de efectivo, análisis puro en analysis.ts;
                       offline = cola, IndexedDB, motor de sincronización, API y formularios de campo)
  lib/
    supabase/          client, server, proxy, admin (server-only)
    auth/              roles.ts (matriz de permisos), session.ts (DAL)
    actions.ts         ActionResult y traducción de errores de BD
    format.ts          MXN, números y fechas (America/Mexico_City)
    money.ts           importes en centavos / BigInt: sumas, redondeo y prorrateo idénticos a PostgreSQL
    xlsx.ts            generador de .xlsx sin dependencias (ZIP sin compresión + SpreadsheetML)
    search-params.ts   lectura validada de filtros de la URL (fechas, UUID)
    safe-redirect.ts   redirecciones internas seguras (evita redirecciones abiertas)
    image.ts           reducción de fotografías antes de subirlas o guardarlas sin conexión
    supabase/rows.ts   fetchRows: consultas de más de 1,000 filas en páginas (límite max_rows de PostgREST)
  types/database.ts    tipos generados por `supabase gen types`
supabase/
  migrations/          una migración por fase
  seed.sql             datos de demostración (solo local)
  tests/database/      pruebas pgTAP
tests/
  unit/                pruebas Vitest (funciones puras, esquemas, cola de sincronización)
  integration/         Vitest contra Supabase local con usuarios reales (18 procesos, sincronización)
  e2e/                 Playwright (autenticación, PWA, sin conexión, móvil)
.github/workflows/     CI: lint, tipos, unitarias, pgTAP, integración y E2E
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

### Implementado (Fase 3 · control operativo)

Migraciones `20261102030000_operations_enums.sql` (valor `transferencia`, en archivo propio porque PostgreSQL no
usa un valor de enum en la transacción que lo crea) y `20261102030100_operations.sql`.

| Tabla / vista            | Propósito                                                                                     |
| ------------------------ | --------------------------------------------------------------------------------------------- |
| inventory_categories     | Categorías configurables con clasificación fija (`input_kind`): semilla, fertilizante, agroquímico, biológico, combustible, herramienta, material, otro. Reemplazan al enum `input_category`. |
| suppliers                | Proveedores (RFC opcional). Las entradas por compra los referencian; los nombres capturados como texto se migraron al catálogo. |
| warehouses               | Almacenes (rancho, ubicación, responsable). Toda organización nace con «Almacén general».      |
| inventory_lots           | Lotes por producto con caducidad. Se crean en la entrada; solo se edita caducidad y notas.     |
| inventory_balances       | Existencia por producto × almacén × lote. Σ saldos = `inventory_products.stock` (solo la RPC los toca). |
| activity_types           | Catálogo de actividades agrícolas (10 iniciales), usado por bitácora, mano de obra y maquinaria. |
| irrigation_logs          | Riegos: parcela, horario (duración calculada, cruza medianoche), sistema, m³ opcional, responsable. |
| chemical_applications    | Aplicaciones: producto del inventario, ingrediente activo, cantidad, superficie, lote, equipo, reentrada e intervalo de seguridad. Ligada a la salida de almacén que genera. |
| field_activities         | Actividades con tipo, parcela, responsable y costo adicional opcional.                         |
| machinery_maintenance    | Mantenimientos preventivos y reparaciones con costo y horómetro.                               |
| crews · crew_members     | Cuadrillas con jefe e integrantes.                                                             |
| attendance_records       | Asistencia diaria (presente, falta, permiso, incapacidad, descanso) con entrada y salida.      |
| employee_assignments     | Asignación de trabajadores a proyecto/parcela/cuadrilla con periodo y función.                 |
| attachments              | Evidencias fotográficas (metadatos); el archivo vive en Storage.                               |
| v_inventory_stock        | Existencias por almacén y lote con días a caducidad y valor estimado.                          |
| v_machinery_status       | Horas, costo cargado, mantenimiento y alerta (`vencido`, `proximo`, `al_dia`, `sin_programa`). |
| v_project_timeline       | Cronología del proyecto: riegos, aplicaciones, actividades, jornadas, maquinaria e insumos.     |

Columnas nuevas en tablas existentes:

- `inventory_products`: `category_id` (FK compuesta), `track_lots`; unidades `g`, `ml`, `caja`, `m`.
- `inventory_movements`: `warehouse_id`, `to_warehouse_id`, `lot_id`, `supplier_id`, `responsible_id` (empleado) y
  `unit` (unidad al registrar). Se eliminó la columna de texto `supplier`.
- `machinery`: marca, modelo, número de serie, adquisición (fecha y costo), `status` (`operativa`, `en_mantenimiento`,
  `fuera_servicio`, `baja`), responsable, `rate_basis` + `daily_rate`, intervalos de mantenimiento (horas y días).
  `is_active` ahora es columna generada (`status <> 'baja'`).
- `machinery_usage`: `hourly_rate` → `rate`; `rate_basis`, `jornadas`, `operator_id`, `activity_type_id`,
  `fuel_quantity`, `fuel_movement_id`. `amount` = (horas o jornadas) × tarifa.
- `employees`: `worker_type`, `hire_date`. `labor_records`: `crew_id`, `activity_type_id`, `batch_id`.
- `v_project_costs` agrega `activities_cost`; `finance_summary` devuelve `activities_cost`.

RPC (transaccionales, `SECURITY DEFINER`, verifican rol, idempotentes por id del cliente):

| Función                          | Qué hace                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------ |
| `register_inventory_movement`    | Entrada, consumo, devolución, ajustes y **transferencia**, con almacén, lote (crea o elige), proveedor y responsable. |
| `reverse_inventory_movement`     | Anula con contrapartida exacta (misma cantidad, valor, almacén y lote). No anula consumos que pertenecen a una aplicación o a un uso de maquinaria. |
| `register_chemical_application`  | Registra la aplicación y, si se descuenta del almacén, su salida por consumo en la misma transacción. |
| `cancel_chemical_application`    | Cancela con motivo y regresa el producto (mismo lote) y su costo.                           |
| `register_machinery_usage`       | Uso por hora o jornada y, opcionalmente, el combustible surtido del almacén.               |
| `register_crew_labor`            | Una jornada por integrante de la cuadrilla en una sola operación.                          |
| `cancel_field_record`            | Cancela con motivo riegos, actividades y mantenimientos.                                   |

Internas (sin `EXECUTE` para usuarios): `process_inventory_movement`, `process_inventory_reversal`,
`post_inventory_movement`, `apply_inventory_balance`, `seed_organization_catalogs`.

Reglas en base de datos:

- **Sin existencias negativas por almacén ni por lote**, aunque el total del producto alcance. El producto se
  bloquea `FOR UPDATE` en cada movimiento, lo que serializa todos sus saldos.
- **Costo promedio ponderado por producto** (no por almacén): una transferencia mueve cantidad sin cambiar el valor
  del inventario ni el costo de ningún proyecto. Cada movimiento conserva su costo histórico (`total_cost`).
- **Lotes**: con `track_lots`, toda entrada indica lote (si existe se suma; si trae otra caducidad se rechaza) y toda
  salida indica de qué lote sale. Un lote caducado no se consume en campo; se da de baja como ajuste. El control por
  lotes solo cambia con existencia en cero.
- **Historial inmutable**: un trigger impide `UPDATE` y `DELETE` en `inventory_movements` incluso al dueño de la base
  (solo se permite la cascada al eliminar la organización). Las bitácoras y mantenimientos tampoco se eliminan: se
  cancelan con motivo, y un registro cancelado ya no se edita.
- **Proyecto vigente**: riegos, aplicaciones y actividades usan el mismo trigger `check_project_record` que los costos:
  fecha no futura ni anterior al inicio, parcela asignada al proyecto y proyecto no cerrado ni cancelado.
- **Aplicaciones**: solo productos de clasificación agroquímico, biológico o fertilizante; la superficie tratada no
  excede la asignada a la parcela en el proyecto. No hay recomendaciones de dosis: solo se registra lo aplicado.
- **Maquinaria**: un equipo no excede 24 h ni 1 jornada por día entre todos los proyectos; equipos fuera de servicio
  o dados de baja no registran uso. Eliminar un uso con combustible del almacén regresa el combustible y su costo.
- **Personal**: no se registra trabajo a quien tiene falta, permiso, incapacidad o descanso ese día, ni se marca falta
  a quien tiene trabajo registrado; registrar trabajo marca la asistencia como presente.
- **Almacenes**: uno con existencias no se desactiva; una organización con un solo almacén activo puede omitirlo en
  la RPC (se usa ese).
- **Evidencias**: la ruta debe ser `organización/tipo/registro/archivo` (CHECK) y el archivo debe existir en Storage
  (trigger). Políticas de `storage.objects`: leer = miembro de la organización de la primera carpeta; subir =
  propietario, administrador, agrónomo o supervisor; eliminar = quien lo subió o propietario/administrador. El
  bucket solo acepta JPG, PNG, WEBP y HEIC de hasta 10 MB.

**Regla de costos (sin duplicidad), ampliada:**

| Concepto                               | Dónde se carga                     | Por qué no se duplica                                              |
| -------------------------------------- | ---------------------------------- | ------------------------------------------------------------------ |
| Agroquímico aplicado desde el almacén  | Insumos (consumo)                  | La aplicación no tiene costo propio; solo su salida de almacén.     |
| Combustible surtido a un equipo        | Insumos (consumo)                  | La tarifa del equipo debe excluir el combustible del almacén.       |
| Horas o jornadas de un equipo          | Maquinaria (tarifa congelada)      | Máximo 24 h / 1 jornada por equipo y día.                           |
| Mantenimiento y reparaciones           | Costo del equipo (no del proyecto) | El proyecto absorbe la maquinaria solo vía tarifa de uso.           |
| Jornadas de una cuadrilla              | Mano de obra (una por integrante)  | Máximo 1 jornal por empleado y día; idempotente por lote.           |
| Costo adicional de una actividad       | Actividades                        | Solo lo no capturado en otro módulo (p. ej. servicio contratado).   |
| Compra / transferencia                 | Ninguno                            | El costo nace en el consumo.                                        |

**Acceso:** todos los miembros leen la operación. Bitácoras: propietario, administrador, agrónomo y supervisor.
Inventario y sus catálogos: propietario, administrador y almacén (las aplicaciones de campo descuentan del almacén
mediante su RPC, que verifica el rol de campo). Maquinaria, mantenimiento, cuadrillas y asignaciones: propietario,
administrador y agrónomo. Asistencia y jornadas: además, supervisor.

**Reportes operativos** (`/reportes`): consumo de insumos por proyecto, existencias, por caducar (60 días), riegos,
aplicaciones, jornadas, costos de mano de obra, utilización de maquinaria y costos operativos. Se filtran por periodo
y proyecto en el servidor (máximo 5,000 registros por reporte), se agregan con funciones puras
(`features/reports/aggregate.ts`, con pruebas) y se exportan a CSV.

### Implementado (Fase 4 · producción y comercialización)

Migraciones `20261103040000_commercial_enums.sql` (estados de venta; `vigente` se renombra a `confirmada`) y
`20261103040100_commercial.sql`. Se **amplían** cosechas, clientes, ventas y pagos existentes; no hay tablas paralelas.

| Tabla / vista            | Propósito                                                                                     |
| ------------------------ | --------------------------------------------------------------------------------------------- |
| harvests (ampliada)      | Cada corte por calidad es un **lote**: folio `LOT-AAAA-0001`, número de corte, unidad (kg, t, caja, saco, arpilla, reja) con peso por empaque, clasificación, responsable, `sold_kg`, `adjusted_kg` y `available_kg` (generada). |
| production_movements     | Libro **inmutable** del producto por lote: venta, cancelación de venta, merma, pérdida, ajustes y reverso de ajuste, con signo, existencia posterior, venta/partida ligada y motivo. |
| customers (ampliada)     | `customer_type` (mayorista, minorista, empacadora, exportadora, industria, intermediario, otro). |
| sales (ampliada)         | Estados `borrador → confirmada → entregada`, `parcialmente_pagada`, `pagada`, `cancelada`; subtotal, descuento, total, `advance_balance`, fecha de entrega programada, confirmación (fecha y usuario). |
| sale_items (ampliada)    | Lote (`harvest_id`), unidad, cantidad, kg por unidad, precio por unidad, descuento, `gross_amount`/`amount` generados y cantidad entregada. |
| sale_deliveries · sale_delivery_items | Entregas parciales por partida; se cancelan con motivo.                          |
| payments (ampliada)      | `kind` (`pago` / `anticipo`) y `applied_amount` del anticipo.                                  |
| advance_applications     | Aplicación explícita (total o parcial) de un anticipo al saldo; se revierte con motivo.       |
| attachments (ampliada)   | Evidencias de cortes (`harvest`) y comprobantes de pago (`payment`, imagen o PDF).            |
| v_sale_balances          | Saldo, estado de pago y de entrega, días vencidos, % de recuperación, último pago, kg.         |
| v_sale_lot_trace         | Trazabilidad venta ↔ partida ↔ lote ↔ parcela ↔ proyecto (incluye salidas revertidas).          |
| v_project_costs          | Agrega `shrinkage_kg`, `lots`, `cuts`; lo vendido cuenta desde la confirmación y el disponible sale de los lotes. |
| v_project_timeline       | Agrega los cortes (`cosecha`) a la cronología del proyecto.                                   |

RPC (transaccionales, `SECURITY DEFINER`, verifican rol, idempotentes por id del cliente):

| Función                          | Qué hace                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------ |
| `save_sale`                      | Crea o modifica un borrador (encabezado + partidas por lote) y, con `p_confirm`, lo confirma en la misma transacción. |
| `confirm_sale`                   | Bloquea venta → lotes (en orden de id) → proyectos; verifica existencias y descuenta cada partida de su lote. |
| `cancel_sale`                    | Borrador o venta sin pagos ni anticipos; revierte cada salida con `cancelacion_venta` (una sola vez). |
| `register_delivery` · `cancel_delivery` | Entrega total o parcial por partida (hasta lo pendiente) y su cancelación.        |
| `register_payment`               | Pago o anticipo; nunca excede total − pagado − anticipos sin aplicar. Un borrador solo recibe anticipos. |
| `apply_advance` · `cancel_advance_application` | Mecanismo explícito para que un anticipo cuente como pagado, y su reversión. |
| `cancel_payment`                 | Cancela (no elimina) un pago o anticipo; un anticipo con aplicaciones primero se desaplica. |
| `register_production_adjustment` · `reverse_production_adjustment` | Mermas, pérdidas y ajustes justificados; reversión con contrapartida. |
| `commercial_summary`             | Indicadores y series del dashboard comercial (`SECURITY INVOKER`).                         |

Internas: `post_production_movement` (único punto que modifica existencias de lotes), `confirm_sale_internal`,
`refresh_sale_status`, `parse_sale_lines`, triggers `before_harvest_write` / `before_harvest_delete`.

Reglas en base de datos:

- **Existencias por lote:** `harvests_available_check` impide que un lote quede negativo aunque una función omitiera la
  validación. Las salidas por venta solo ocurren al confirmar; un borrador no aparta producto.
- **Concurrencia:** orden de bloqueo fijo venta → lotes (`FOR UPDATE`, por id) → proyecto (`FOR UPDATE`). Editar un corte
  bloquea el lote y luego el proyecto (mismo orden). Dos confirmaciones simultáneas del mismo lote se serializan y la
  segunda falla con el disponible actualizado (verificado con dos sesiones concurrentes).
- **Lote con historial:** con ventas o ajustes no se elimina ni cambia proyecto, parcela, fecha o calidad; su cantidad no
  baja de lo vendido y ajustado. Un proyecto cerrado congela sus lotes (sin ventas ni ajustes).
- **Estados de venta:** `refresh_sale_status` los deriva de cobro y entrega (pagada > parcialmente pagada > entregada >
  confirmada). El estado de entrega se expone aparte en `v_sale_balances`.
- **Pagos:** nunca se eliminan (sin `DELETE`); cancelar restituye el saldo. Los comprobantes de pago solo los ven y
  agregan los roles financieros (RLS de `attachments` y de Storage por la segunda carpeta de la ruta) y solo los retira
  propietario o administrador.
- **Datos existentes:** la migración asignó folios de lote y números de corte, y descontó las ventas confirmadas de los
  lotes del mismo proyecto (primero la misma calidad, el más antiguo primero), registrando sus movimientos.

**Acceso:** el libro de producto (kg) lo leen todos los miembros; mermas y ajustes los registran propietario,
administrador, agrónomo, supervisor y almacén (`produce.adjust`). Ventas, entregas, pagos, anticipos, trazabilidad
comercial y dashboard comercial: lectura `finance.read`, escritura `sales.write` / `payments.write`.

**Indicadores:** `/produccion` agrega con funciones puras (`features/harvests/aggregate.ts`) los cortes del periodo
(cortes, lotes, producción por parcela, fecha y calidad, rendimiento por hectárea, vendido, mermas, disponible).
`/comercial` usa `commercial_summary`: flujos del periodo (producción por fecha de corte, ventas por fecha de venta,
cobros por fecha de pago o de aplicación del anticipo) y saldos al día; con filtro de cultivo o proyecto, cada venta
participa con sus partidas de ese filtro y su cobro y saldo se prorratean en la misma proporción.

### Implementado (Fase 5 · administración financiera y rentabilidad)

Migraciones `20261104050000_financial_enums.sql` (tipo de gasto `mantenimiento`) y `20261104050100_financial.sql`. Se
**consolida** lo que ya registran los módulos: no hay un sistema financiero paralelo ni costos capturados dos veces.

| Tabla / vista            | Propósito                                                                                     |
| ------------------------ | --------------------------------------------------------------------------------------------- |
| project_budgets          | Versión del presupuesto de un proyecto: número, vigente, cultivo, superficie, periodo, total, motivo de revisión. Inmutable salvo `is_current`. |
| project_budget_lines     | Partidas: categoría (12), concepto, unidad, cantidad, costo unitario e importe generado. Inmutables. |
| finance_settings         | Umbrales de alerta por organización (aviso, crítico, agotado; 70/90/100 sin fila).            |
| expenses                 | Encabezado del gasto: tipo, categoría presupuestal, concepto, proveedor, factura, método de pago, responsable, observaciones, criterio de reparto, pagado y estado. Se cancela, no se elimina. |
| project_expenses (ampliada) | Ahora es la **asignación** del gasto a cada proyecto: importe, `allocation_share` y `allocation_basis` (ha, %, importe). Sin escrituras directas. |
| cash_movements           | Pagos de gastos, pagos a proveedores y otros ingresos/egresos, con método, referencia y estado. |
| v_project_cost_entries   | Agrega `cost_class` (7 clases), `budget_category` (12) y `origin_table`/`origin_id` (documento de origen). |
| v_project_costs          | Agrega cultivo, versión de presupuesto, costo por clase, costo por tonelada, diferencia y restante, estado de alerta, existencia a costo, resultado estimado y margen. |
| v_budget_comparison      | Presupuesto vigente contra costo real por proyecto y categoría, con diferencia, % y estado.  |

RPC (transaccionales, `SECURITY DEFINER`, verifican rol, idempotentes por id del cliente):

| Función                  | Qué hace                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------ |
| `save_budget`            | Versión original o revisión (exige motivo y la versión base vigente); sincroniza `projects.budget_amount`. |
| `register_expense`       | Gasto directo o compartido con su reparto (proyectos en orden de id, residuo al de mayor base) y, opcionalmente, su pago. |
| `cancel_expense`         | Cancela con motivo si no tiene pagos y sus proyectos siguen vigentes.                      |
| `register_cash_movement` · `cancel_cash_movement` | Movimientos de efectivo; un pago de gasto bloquea el gasto y nunca excede su saldo. |
| `cash_flow_entries`      | Flujo del periodo (cobros, anticipos, pagos y otros), prorrateado al filtrar por proyecto (`SECURITY INVOKER`). |
| `financial_series`       | Series del dashboard financiero (costos, ventas y cobranza por mes) (`SECURITY INVOKER`).  |

**Clasificación de costos** (funciones `input_cost_class`, `input_budget_category`, `expense_cost_class`,
`expense_default_budget_category`, reflejadas en `features/finance/schemas.ts`):

| Origen                     | Clase                          | Categoría presupuestal                               |
| -------------------------- | ------------------------------ | ---------------------------------------------------- |
| Consumo de inventario      | insumos (combustibles si es combustible) | por clasificación del insumo: semillas, fertilizantes, agroquímicos (incluye biológicos), combustible, otros |
| Mano de obra               | mano de obra                   | mano de obra                                          |
| Uso de maquinaria          | maquinaria                     | maquinaria                                            |
| Costo adicional de actividad | servicios                    | la del tipo de actividad (configurable en el catálogo) |
| Gasto                      | mantenimiento, servicios (agua, energía, fletes, maquila, asesoría) o gastos adicionales | la elegida en el gasto (preparación de terreno, riego, mantenimiento, cosecha, transporte, otros) |

Reglas en base de datos:

- **Presupuestos inmutables:** un trigger impide modificar o eliminar versiones y partidas (solo cambia `is_current`, y
  se permite la cascada al eliminar el proyecto). Un índice único garantiza una sola versión vigente. Con presupuesto
  detallado, `projects.budget_amount` solo lo cambia `save_budget` (trigger `guard_project_budget_amount`).
- **Sin duplicidad:** un gasto no acepta categorías que nacen en inventario, personal o maquinaria (CHECK y RPC); una
  factura de un proveedor se registra una sola vez en la organización (índice único parcial sobre gastos vigentes); un
  proyecto aparece una vez por gasto.
- **Reparto exacto:** la suma de las asignaciones es el importe del gasto al centavo; el criterio y la base quedan guardados.
- **Registrado ≠ pagado:** `expenses.paid_amount` solo cambia con movimientos de efectivo (`0 ≤ pagado ≤ importe`); un gasto
  cancelado no conserva pagos.
- **Concurrencia:** gasto → proyectos `FOR SHARE` en orden de id; pago: gasto `FOR UPDATE` → movimiento; revisión de
  presupuesto: proyecto `FOR UPDATE` y verificación de la versión base.
- **Cierre:** un proyecto cerrado no recibe gastos ni revisiones de presupuesto; los pagos sí se registran (flujo, no costo).

**Acceso:** presupuestos, gastos, movimientos de efectivo, comparativos y reportes financieros: lectura `finance.read`
(propietario, administrador, finanzas, consulta); escritura `budgets.write`, `expenses.write`, `cash.write` (propietario,
administrador, finanzas). Los comprobantes de gastos (imagen o PDF) siguen la protección de los comprobantes de pago.

**Resultado estimado** = ventas reconocidas (confirmadas) − costo de producción acumulado. Ver decisión 66.

### Implementado (Fase 6 · preparación comercial y producción)

Migración `20261105060000_platform.sql`. Detalle en [pwa-offline.md](pwa-offline.md), [seguridad.md](seguridad.md),
[base-de-datos.md](base-de-datos.md), [despliegue.md](despliegue.md) y [saas-suscripciones.md](saas-suscripciones.md).

| Elemento                 | Descripción                                                                                   |
| ------------------------ | --------------------------------------------------------------------------------------------- |
| field_observations       | Observaciones de campo (plaga, enfermedad, maleza, clima, riego, nutrición, fenología) con severidad, ubicación opcional y evidencias; se cancelan con motivo. Pestaña *Observaciones* en Bitácoras. |
| offline_submissions      | Bitácora de sincronización: id = clave de idempotencia = id del registro; huella del contenido; estado (`sincronizado`, `requiere_revision`, `descartado`), intentos, error, fechas de captura, recepción y sincronización, revisión. Solo RPC. |
| plans · organizations.plan_code | Planes con límites (proyectos vigentes, usuarios, almacenamiento) y funciones; plan `piloto` sin límites. Triggers de límite y `organization_usage`. |
| Storage                  | Política de eliminación corregida (membresía vigente; comprobantes solo propietario/administrador). |
| Índices                  | 22 índices de llaves foráneas usadas al eliminar catálogos.                                    |

RPC: `save_offline_submission` (máquina de estados; no sobrescribe lo sincronizado ni lo descartado y reporta
conflictos), `discard_offline_submission` (revisores), `organization_usage`. `cancel_field_record` admite `observacion`.

Aplicación:

- **PWA:** manifiesto, íconos, service worker propio (sin dependencias), botón de instalación, indicador de conexión y
  pendientes en la barra superior.
- **Captura sin conexión:** `/campo` (estática, en caché), cola en IndexedDB, sincronización automática con espera
  creciente y Web Locks, fotos reducidas y subidas después de confirmar el registro, pantalla de registros con estados,
  corrección, reintento y eliminación; `/sincronizacion` para revisores.
- **Altas compartidas:** `features/fieldlogs/mutations.ts` y `features/harvests/mutations.ts` las usan tanto las Server
  Actions como la API de sincronización: la validación y las reglas son idénticas en línea y sin conexión.
- **Seguridad:** redirecciones seguras, encabezados (CSP y otros), 401 JSON en la API, verificación de origen.
- **Consultas:** `fetchRows` pagina las consultas de reportes, cobranza y listados que pueden superar 1,000 filas.

### Pendiente

- Cuentas por pagar de compras de almacén (hoy el pago a proveedor se registra sin ligarse a la entrada).
- Presupuestos de gastos generales no imputables a un proyecto (administración, depreciación) y estado de resultados.
- Inventario: costo PEPS por lote, devoluciones a proveedor, conteos físicos programados.
- Edición de registros de costo (uso de maquinaria y jornadas) en lugar de eliminar y volver a capturar.
- Ventas: anticipos sin venta, notas de crédito, devoluciones parciales de producto y CFDI.
- Inventario de producto por almacén o cámara fría (hoy la existencia es por lote).
- Paginación con navegación por páginas en los listados operativos (hoy: filtros de periodo en el servidor y los
  registros más recientes; los reportes traen hasta 5,000 y avisan si se alcanzó el límite).
- Observaciones en la cronología del proyecto y captura sin conexión de jornadas y uso de maquinaria.
- Suscripciones con cobro, funciones por plan aplicadas en RLS y panel interno (ver saas-suscripciones.md).

## Roadmap

1. ✅ Fundación: Next.js, tema, Supabase, autenticación, organizaciones, roles, usuarios.
2. ✅ Dashboard con indicadores reales, ranchos, parcelas, cultivos, proyectos y expediente.
3. ✅ Control operativo: inventario con almacenes, lotes y transferencias; bitácoras de riego, aplicaciones y
   actividades con evidencias; maquinaria con mantenimiento; personal con asistencia y cuadrillas; reportes.
4. ✅ Cortes y lotes de producción, inventario de producto con mermas, clientes, ventas con borrador y entregas,
   pagos y anticipos, cuentas por cobrar, trazabilidad por lote y dashboard comercial.
5. ✅ Presupuestos con versiones, gastos directos y compartidos, consolidación de costos, rentabilidad, flujo de efectivo,
   alertas configurables, dashboard financiero y reportes en CSV, Excel y PDF.
6. ✅ PWA, captura sin conexión con sincronización y revisión, auditoría de seguridad, pruebas de integración y E2E,
   optimización, planes por organización, documentación y despliegue.
