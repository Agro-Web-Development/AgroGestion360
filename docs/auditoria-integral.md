# Auditoría técnica integral · AgroGestión 360

Noviembre de 2026 · Revisión posterior a las fases 1–6

## 1. Estado general

**Apto para demostración integral y prueba piloto.** El modelo de datos, las reglas de negocio y los cálculos financieros
son correctos: un escenario completo de producción de jitomate, capturado con usuarios reales de cada rol, cuadra al
centavo con cifras calculadas a mano. Se encontraron y corrigieron **9 defectos**. Los más graves: una organización con
historial no se podía eliminar, y varios indicadores se calculaban sobre listas truncadas sin avisar. No quedan errores
críticos abiertos.

| Indicador | Antes | Después |
| --------- | ----- | ------- |
| Pruebas unitarias (Vitest) | 145 ✅ | 145 ✅ |
| Base de datos y RLS (pgTAP) | 436 ✅ | **450** ✅ (+14) |
| Integración con usuarios reales | 45 ✅ | **67** ✅ (+22, escenario completo) |
| Navegador (Playwright) | 23 ✅ | **32** ✅ (+9) |
| Recorrido de pantallas (34 rutas × escritorio y móvil) | 7 con desborde, 1 error de servidor | **68/68 sin errores** |
| `tsc`, ESLint, `next build` | ✅ | ✅ |
| Migración desde cero (`supabase db reset`) | ✅ | ✅ (incluye la migración 0008) |

## 2. Arquitectura

- **Estructura:** Next.js 16 (App Router, Cache Components) con carpetas por módulo en `src/features/<módulo>/`
  (`queries.ts` de lectura, `actions.ts` / `mutations.ts` de escritura, `schemas.ts` con Zod, `components/`). Rutas en
  `src/app/(app)`. Componentes base en `src/components/ui` (shadcn) y compartidos en `src/components/shared`. Separación
  clara, sin código muerto relevante ni componentes duplicados.
- **Datos:** PostgreSQL 17 en Supabase, 10 migraciones (9,300 líneas), 51 tablas, 8 vistas `security_invoker`, RLS en
  todas las tablas. Las escrituras sensibles (inventario, ventas, pagos, gastos, presupuestos, sincronización) van por
  funciones `SECURITY DEFINER` con `search_path` vacío, bloqueos y llaves de idempotencia.
- **Fuente única de costos:** `v_project_cost_entries`; `v_project_costs` agrega cada métrica en su propia subconsulta
  (ninguna unión multiplica renglones).
- **Autenticación:** Supabase Auth con cookies (`@supabase/ssr`); `getOrgContext()` resuelve usuario, organización
  activa y rol; la matriz `PERMISSIONS` de la interfaz refleja la RLS.
- **Estado:** el servidor es la fuente de verdad (RSC + Server Actions + `revalidatePath`). En cliente solo hay estado de
  formularios (react-hook-form), filtros locales y la cola sin conexión (IndexedDB).
- **Variables de entorno:** solo URL y llave publicable en el navegador; `SUPABASE_SECRET_KEY` solo en servidor
  (`lib/supabase/admin.ts` con `server-only`). `.env*` ignorado por git, salvo `.env.example`.
- **Consultas redundantes:** el expediente y la rentabilidad leen la vista agregada una vez por proyecto. Las únicas
  agregaciones en JavaScript sobre listas eran los indicadores de pantallas operativas (defecto D3, corregido).

## 3. Relaciones entre módulos

Todas las relaciones de negocio usan llaves foráneas compuestas `(organization_id, id)`: no se puede referenciar un
registro de otra organización aunque se conozca su id.

```
Organización ─┬─ Ranchos ── Parcelas ──┐
              ├─ Cultivos ── Proyectos ─┴─ project_plots (superficie asignada)
              │                 │
              │   ┌─────────────┼───────────────┬──────────────┬───────────────┐
              │   Consumos de   Bitácoras       Jornadas y     Uso de          Gastos (reparto
              │   inventario    (riego, aplic., asignaciones   maquinaria      directo o compartido)
              │   (entradas →   actividad,      de personal    (+ combustible
              │   almacén)      observación)                   del almacén)
              │                 │
              │   Cortes = lotes (folio LOT) ── movimientos de producto (ventas, mermas)
              │                 │
              ├─ Clientes ── Ventas ── partidas (lote) ── pagos y anticipos (aplicaciones)
              ├─ Presupuestos por versión y categoría
              └─ Flujo de efectivo (cobros, pagos de gastos y a proveedores)
```

**El expediente del proyecto** (`/proyectos/[id]`) consulta: parcelas y superficie, producción (cortes, lotes, mermas,
vendido, disponible), ventas con trazabilidad lote → parcela, pagos y anticipos, detalle de costos por origen,
cronología (riegos, aplicaciones, jornadas, maquinaria, insumos, cortes), personal asignado, indicadores de operación,
costos por clase, presupuesto, unitarios y resultado. Verificado con el escenario (sección 4).

## 4. Escenario completo de demostración

Datos ficticios en una organización propia: **«Agropecuaria Los Campos · Escenario jitomate»** (marcada como demo, con
sus propios usuarios; no se mezcla con la organización del seed). Proyecto **Producción de jitomate**, 5 ha, presupuesto
**$250,000 MXN** en 8 categorías.

- Prueba automatizada: `tests/integration/escenario-jitomate.test.ts` (22 pruebas; crea y elimina su organización).
- Carga persistente para demostrar: `npm run demo:jitomate` (usuarios `jitomate.{propietario,agronomo,campo,almacen,
  finanzas,consulta}@demo.agrogestion360.mx`, contraseña `Demo12345!`). Se puede volver a ejecutar: reemplaza el escenario.
- Pasos y cifras esperadas: `tests/support/escenario-jitomate.ts` (`ESPERADO`).

| Paso | Rol | Registro |
| ---- | --- | -------- |
| Compra de semillas, fertilizantes, insecticida y diésel | Almacén | 5 entradas por $75,300 con proveedor y factura |
| Pago al proveedor | Finanzas | Egreso de $70,500 (no es costo del proyecto) |
| Consumo de insumos | Almacén | Semilla 25 sobres ($23,750), 18-46-00 600 kg ($10,800) |
| Riegos | Supervisor | 3 riegos por goteo, 360 m³ |
| Aplicaciones documentadas | Supervisor | Nitrato 200 kg ($4,400); insecticida 8 l ($5,200) con reentrada y carencia |
| Trabajadores | Agrónomo / supervisor | 3 asignados; 15 jornales ($6,250) + destajo 300 cajas ($3,600) |
| Maquinaria | Agrónomo | Tractor 6 h × $650 ($3,900) + 40 l de diésel del almacén ($960) |
| Gastos | Finanzas | Energía $4,500 (pagado) y flete $3,200 (por pagar) |
| Cortes y lotes | Supervisor | 3 cortes, 4 lotes, 30,000 kg; merma de 200 kg |
| Venta | Finanzas | 700 cajas (14,000 kg) por $196,000, en borrador y después confirmada |
| Anticipo | Finanzas | $50,000 recibido antes de confirmar y luego aplicado |
| Pago parcial | Finanzas | $60,000 |
| Saldo pendiente | — | **$86,000** |

**Inventario:** existencias finales y su valor cuadran por producto y por almacén; compras ($75,300) = consumos
($45,110) + existencias ($30,190). Las salidas por aplicación y combustible no se duplican en la cronología.

## 5. Validación financiera

Todas verificadas contra la base de datos con usuarios reales (vista `v_project_costs`, `v_budget_comparison`,
`finance_summary`, `commercial_summary`, `cash_flow_entries`):

| Concepto | Esperado | Resultado |
| -------- | -------- | --------- |
| Presupuesto inicial | $250,000.00 | ✅ |
| Costos acumulados | $66,560.00 (insumos 45,110 · maquinaria 3,900 · mano de obra 9,850 · gastos 7,700) | ✅ |
| Costos por categoría presupuestal | 9 categorías (incluye combustible sin presupuesto) | ✅ suman $66,560 |
| Costo por hectárea | $13,312.00 | ✅ |
| Costo por kilogramo | $2.2187 | ✅ |
| Presupuesto utilizado | 26.6 % (estado normal) | ✅ |
| Producción acumulada | 30,000 kg, 3 cortes, 4 lotes | ✅ |
| Producción disponible | 15,800 kg (tras 200 kg de merma) | ✅ |
| Producción vendida | 14,000 kg | ✅ |
| Importe de ventas | $196,000.00 | ✅ |
| Dinero cobrado | $110,000.00 | ✅ |
| Cuentas por cobrar | $86,000.00 | ✅ |
| Resultado estimado | $129,440.00 (ventas − costo) | ✅ |
| Flujo de efectivo | Ingresos $110,000 · egresos $75,000 | ✅ |

**Sin costos duplicados:** 24 asientos de costo, cada registro de origen una sola vez; las compras de almacén y los pagos
a proveedores no son costo; el gasto por pagar es costo pero no egreso. **Ventas ≠ cobros:** el resultado usa ventas
confirmadas; cobrado + por cobrar = ventas; un anticipo sin aplicar cuenta como ingreso de efectivo al recibirse, pero no
como cobro de la venta hasta aplicarse (se probó el estado intermedio).

## 6. Experiencia de usuario

Recorrido automatizado de las 34 pantallas en escritorio (1280 px) y móvil (Pixel 7), con sesión de propietario y datos
del escenario: respuesta HTTP, errores de consola y de servidor, desplazamiento horizontal, textos `NaN`/`undefined`,
botones sin nombre accesible y campos sin etiqueta.

- Menú, navegación, formularios, modales, filtros por periodo y proyecto, notificaciones (toasts) y dashboards: sin
  errores.
- **Corregido:** desborde horizontal en escritorio en 7 pantallas con tablas anchas (D5); falta de paginación (D4);
  centro de notificaciones sin datos (D6); anticipos sin aplicar no visibles en el expediente (D8).
- Accesibilidad básica: todos los botones tienen nombre accesible y todos los campos su etiqueta (los `<select>` ocultos
  de Radix son `aria-hidden`); títulos de página, `lang="es"`, foco visible.
- Tiempo de respuesta (compilación de producción, servidor local): mediana 1.7 s por pantalla, máximo 3.7 s (dashboard,
  primera carga).

## 7. Seguridad

| Revisión | Resultado |
| -------- | --------- |
| Separación entre organizaciones (tablas, vistas, RPC, Storage) | ✅ Otra organización no lee ni modifica nada del escenario (12 tablas, 4 vistas, `finance_summary`, `apply_advance`) |
| RLS | ✅ En todas las tablas; ninguna política para `anon`; vistas `security_invoker` |
| Funciones `SECURITY DEFINER` | ✅ Todas con `search_path` vacío; ninguna ejecutable por `anon`; las internas no son ejecutables por `authenticated` |
| Operaciones financieras | ✅ `sales`, `payments`, `expenses`, `cash_movements`, `inventory_movements`, presupuestos: sin `INSERT/UPDATE/DELETE` directo; solo RPC con rol |
| Permisos por rol | ✅ Consulta lee pero no registra; supervisor no ve ventas, pagos ni gastos; almacén no registra pagos ni gastos |
| Archivos | ✅ Bucket privado, ruta con organización, rol por tipo de evidencia (pruebas de Fase 6 vigentes) |
| Historial de modificaciones | ✅ `audit_logs` registra ventas, pagos, anticipos aplicados, gastos, efectivo, inventario, cortes y presupuestos con su autor; solo propietario/administrador lo leen |

## 8. Errores encontrados y corregidos

| # | Error | Impacto | Corrección |
| - | ----- | ------- | ---------- |
| D1 | **Una organización con historial no se podía eliminar.** La cascada disparaba reglas de registro (proyecto vigente, lote con ventas, devolución de combustible, parcelas de proyecto cerrado), la auditoría intentaba escribir renglones de la organización borrada, 70 llaves `ON DELETE RESTRICT` se verificaban antes de que la cascada terminara, y `payments` no tenía llave a la organización | No se puede dar de baja a un productor del piloto ni limpiar datos de prueba | Migración `20261106070000_auditoria.sql`: reglas omitidas solo si la organización ya no existe, llaves `NO ACTION DEFERRABLE` que se difieren solo al eliminar la organización, llave `payments → organizations`; 14 pruebas pgTAP |
| D2 | La limpieza de las pruebas de integración ignoraba el error de D1 | 14 organizaciones y 14 usuarios de prueba acumulados en la base local, mezclados con la demo | `cleanup()` falla si no elimina; restos eliminados |
| D3 | **Indicadores calculados sobre listas truncadas en silencio** (Personal 500, Maquinaria 300, Gastos 500, Cobranza 300, Producción 500, Bitácoras 300, movimientos de inventario 300 filas) | Costo de mano de obra, horas, gastos, cuentas por pagar o kg en existencia subestimados en temporadas grandes, sin aviso | Límite común `LIST_LIMIT` (5,000) con paginación de 1,000 en la BD (`fetchRows`); la tabla avisa si se alcanza |
| D4 | Tablas sin paginación | Pantallas lentas con miles de registros | `TablePagination` (50 por página) en 9 tablas: registros, gastos, pagos, ventas, movimientos, cortes, lotes y bitácoras |
| D5 | Desborde horizontal de la página en escritorio (por el ancho del menú lateral) en 7 pantallas | Página desplazable a los lados en laptops de 1280–1440 px | `min-w-0` en el contenedor principal; prueba E2E en 1280 px |
| D6 | **Centro de notificaciones solo visual** (siempre vacío) | Módulo con interfaz sin conexión a datos | Alertas reales según el rol: existencias mínimas, caducidades, mantenimiento, cobranza vencida, presupuestos críticos, registros sin conexión por revisar; prueba E2E |
| D7 | `/reportes` leía el reloj antes de la sesión | Error de prerenderizado en el registro del servidor | Orden de lectura (mismo patrón que Producción) |
| D8 | El expediente no mostraba anticipos sin aplicar; «Cobrado (pagos recibidos)» era ambiguo | Un anticipo recibido parecía no existir en el proyecto | Aviso con el importe y etiqueta «pagos y anticipos aplicados» |
| D9 | Leyenda de versión desactualizada en el menú («0.4 · Control operativo») | Cosmético | «Versión piloto · Fase 6» |

**Del entorno, no del código:** el servidor `next dev` en el puerto 3000 lleva corriendo desde antes de crearse
`src/lib/supabase/rows.ts` y responde 500 en todas las páginas (la vigilancia de archivos en `/mnt/c` bajo WSL no detecta
archivos nuevos). Se resuelve reiniciándolo.

## 9. Módulos

**Completamente funcionales (interfaz conectada a la base de datos, con pruebas):** organizaciones y usuarios, ranchos y
parcelas, cultivos, proyectos y expediente, inventario (almacenes, lotes, entradas, consumos, devoluciones,
transferencias), bitácoras (riego, aplicaciones, actividades, observaciones), captura sin conexión y sincronización,
maquinaria y mantenimiento, personal (empleados, cuadrillas, asistencia, jornadas, destajo), producción (cortes, lotes,
mermas, trazabilidad), clientes, ventas (borrador, confirmación, entregas), cobranza (pagos, anticipos, antigüedad),
gastos (directos y compartidos), presupuestos por versión, flujo de efectivo, rentabilidad, dashboards, reportes con
exportación, notificaciones (desde esta auditoría) y límites por plan.

**Con limitaciones conocidas (no bloquean el piloto):**

- **Suscripciones:** hay planes y límites funcionales, pero **no hay cobro** (documentado en `saas-suscripciones.md`); no
  debe presentarse como terminado.
- Las observaciones de campo no aparecen todavía en la cronología del proyecto.
- Sin conexión no se capturan jornadas ni uso de maquinaria.
- Plantillas de correo de Supabase en inglés (se configuran en producción).

## 10. Integridad de la base de datos

- Llaves compuestas por organización en todas las relaciones; restricciones `CHECK` en importes, cantidades,
  existencias y estados; superficie asignada ≤ superficie de la parcela ≤ rancho.
- Historial inmutable (movimientos, presupuestos, pagos): se cancela o revierte con contrapartida y motivo.
- Idempotencia por id generado en el cliente: los reintentos no duplican movimientos, pagos ni gastos.
- Tras D1, la eliminación de una organización no deja huérfanos (verificado en 11 tablas y en la auditoría) y las reglas
  de eliminación siguen aplicando a todo lo demás (verificado: lote con ventas, parcelas de proyecto cerrado, cultivo en
  uso, venta con pagos, proyecto con registros).

## 11. Rendimiento

- Índices `(organization_id, fecha)` y `(project_id, fecha)` en registros e índices de llaves foráneas (Fase 6).
- Indicadores principales agregados en SQL (vistas y funciones); los listados operativos traen hasta 5,000 registros del
  periodo en páginas de 1,000.
- El centro de notificaciones hace 6 consultas en paralelo por página; con volúmenes del piloto no es perceptible.

## 12. Recomendaciones

1. **Antes del piloto:** reiniciar el servidor de desarrollo; aplicar la migración 0008 en producción
   (`supabase db push`); cargar la demo con `npm run demo:jitomate` en el entorno de demostración.
2. Para organizaciones que superen 5,000 registros por periodo: mover los indicadores de Personal, Maquinaria y Gastos a
   agregados SQL y paginar en el servidor.
3. Definir si los roles de campo deben ver costos operativos (salarios, costo de insumos): hoy los ven, igual que la
   interfaz de Personal e Inventario; ventas, pagos y gastos sí están restringidos.
4. Guardar en caché por unos segundos las notificaciones si el número de proyectos crece.
5. Agregar las observaciones a la cronología del proyecto y la captura sin conexión de jornadas.
6. Actualizar la CLI de Supabase (v3) en CI y en local, y configurar SMTP con plantillas en español.
7. Las pruebas E2E sin conexión escriben observaciones en la organización del seed: ejecutar `npm run db:reset` antes de
   una demostración.
