# Inventario de Funcionalidades - AgroGestión 360

Versión piloto · 5 de noviembre de 2026 · Versión analizada: commit `49f3644` («Auditoría integral»)

Este documento registra **qué está implementado realmente** en AgroGestión 360, qué funciona con limitaciones y qué
falta. Es la base del [Manual de Usuario](../manual/manual_usuario_agrogestion_360.md): el manual solo describe como
disponible lo que aquí aparece como **Implementado** o **Parcial**, con sus limitaciones.

---

## 1. Cómo se elaboró

Se revisó la aplicación desde cuatro ángulos:

1. **Código fuente.**
   - Cada pantalla (`src/app`) y sus formularios y diálogos (`src/features/<módulo>/components`).
   - Las acciones del servidor que guardan información (`actions.ts`) y las consultas (`queries.ts`).
   - La estructura de la base de datos: 11 migraciones en `supabase/migrations`.
   - El menú lateral (`src/components/layout/navigation.ts`) y la matriz de permisos (`src/lib/auth/roles.ts`).
2. **Pruebas automatizadas**, ejecutadas el 5 de noviembre de 2026 contra Supabase local con datos de demostración:

   | Prueba | Comando | Resultado |
   | ------ | ------- | --------- |
   | Unitarias (reglas y cálculos) | `npm test` | 145 de 145 ✅ |
   | Base de datos, permisos y RLS (pgTAP) | `npm run test:db` | 450 de 450 ✅ |
   | Integración con usuarios reales de cada rol | `npm run test:integration` | 67 de 67 ✅ |
   | Navegador: escritorio, móvil, PWA y sin conexión (Playwright) | `npm run test:e2e` | 32 de 32 ✅ |
   | Compilación de producción | `npm run build` (incluida en `test:e2e`) | ✅ sin errores |

3. **Pruebas funcionales desde la pantalla.** Se ejecutaron 32 casos de la
   [Guía de pruebas funcionales](../pruebas/guia_pruebas_funcionales.md) con clics reales en Chromium (25 aprobados,
   7 parciales, 0 rechazados). Detalle en la [Matriz de resultados](../pruebas/matriz_resultados_pruebas.md).
4. **Lectura de cifras del escenario integral** en la organización «Escenario jitomate»: costos, rentabilidad,
   inventario y flujo coinciden al centavo con las cifras del
   [Escenario de prueba integral](../pruebas/escenario_prueba_integral.md).

### 1.1 Criterios de estado

| Estado | Significado |
| ------ | ----------- |
| **Implementado** | La pantalla está conectada a la base de datos, valida los datos, carga información real y sus operaciones pasan pruebas automatizadas o manuales. |
| **Parcial** | Funciona, pero le faltan partes o tiene limitaciones que el usuario notará. |
| **Visual** | Existe la interfaz, pero no hace nada real. |
| **Pendiente** | No existe en la aplicación. |
| **No verificado** | Existe en el código, pero no se pudo comprobar en este análisis (depende de un correo real o de un dispositivo físico). |

No se encontró ninguna funcionalidad **Visual**. El menú puede marcar módulos como «Próximamente», pero ningún módulo
usa esa marca: todas las opciones del menú abren pantallas con datos reales.

### 1.2 Resumen

| Estado | Cantidad | Funcionalidades |
| ------ | :------: | --------------- |
| Implementado | 42 | Prácticamente toda la operación agrícola, comercial y financiera |
| Parcial | 6 | Observaciones de campo, captura sin conexión, reportes operativos, invitaciones, plan y límites, bitácora de auditoría |
| Visual | 0 | — |
| Pendiente | 3 | Cobro de suscripciones, eliminar organización desde la interfaz, importación masiva de datos |
| No verificado | 3 | Recuperación de contraseña por correo, instalación en dispositivo real, sincronización en segundo plano |

Respecto del análisis anterior (Anexo A del manual, misma fecha), el **indicador de conexión** pasa de *No verificado*
a *Implementado*: la prueba de navegador `offline.spec.ts` comprueba el aviso «Sin conexión» al cortar la red. Además,
los **permisos por rol** se cuentan aquí como una funcionalidad propia (sección 2.6).

---

## 2. Funcionalidades implementadas

La columna **Menú** usa los nombres exactos del menú lateral.

### 2.1 General

| Funcionalidad | Menú / ubicación | Ruta | Qué permite | Evidencia |
| ------------- | ---------------- | ---- | ----------- | --------- |
| Dashboard general | General → Dashboard | `/dashboard` | Proyectos vigentes, superficie, ranchos y parcelas, presupuesto; gráficas por estado y cultivo; próximas cosechas. Indicadores financieros solo para roles con lectura financiera. Actividad reciente solo para Propietario y Administrador. | GEN-01 ✅ |
| Centro de notificaciones | Campana de la barra superior | — | Alertas calculadas según el rol: existencias bajo el mínimo, lotes por caducar en 30 días, mantenimiento vencido o próximo, cobranza vencida, presupuestos críticos, registros sin conexión por revisar. | GEN-01 ✅, `escritorio.spec.ts` ✅ |
| Tema claro / oscuro | Menú de usuario | — | Claro, oscuro o el del sistema. | Código |
| Indicador de conexión | Barra superior y Captura en campo | — | Muestra «Sin conexión» y el número de registros por sincronizar. | `offline.spec.ts` ✅ |

### 2.2 Producción agrícola

| Funcionalidad | Menú | Ruta | Qué permite | Evidencia |
| ------------- | ---- | ---- | ----------- | --------- |
| Proyectos: alta, edición, eliminación | Producción agrícola → Proyectos | `/proyectos`, `/proyectos/nuevo`, `/proyectos/[id]/editar` | Folio automático `PRY-AAAA-NNNN`. El Agrónomo no elimina. Un proyecto con registros no se elimina. | PRO-01 ✅ |
| Proyectos: estados e historial | Expediente → **Cambiar estado** | `/proyectos/[id]` | Solo ofrece las transiciones válidas. Cancelar exige motivo y libera la superficie. Reabrir solo Propietario y Administrador. | PRO-06 ✅, PRO-07 ✅ |
| Proyectos: asignar parcelas | Expediente → **Asignar parcela** | `/proyectos/[id]` | Solo ofrece superficie libre; la base de datos impide excederla. | PRO-04 ◐, PRO-05 ✅ |
| Expediente del proyecto | Expediente | `/proyectos/[id]` | Parcelas, costos, presupuesto, operación, producción, ventas, cobranza y cronología en una pantalla. | Escenario integral ✅ |
| Ranchos y parcelas | Producción agrícola → Ranchos y parcelas | `/ranchos`, `/ranchos/[id]` | La suma de parcelas no excede la superficie del rancho. Lo que está en uso se desactiva en lugar de eliminarse. | CAT-01 ✅, CAT-02 ✅ |
| Cultivos y variedades | Producción agrícola → Cultivos | `/cultivos` | Un cultivo con proyectos no muestra **Eliminar**; solo puede desactivarse. | CAT-03 ✅ |

### 2.3 Operación

| Funcionalidad | Menú | Ruta | Qué permite | Evidencia |
| ------------- | ---- | ---- | ----------- | --------- |
| Inventario: existencias | Operación → Inventario | `/inventario` | Existencias por producto, almacén y lote, con caducidades, valor a costo promedio y marca **Bajo mínimo**. | INV-01 ✅, INV-02 ✅ |
| Inventario: movimientos | Inventario → pestaña **Movimientos** | `/inventario?tab=movimientos` | Entrada por compra, salida por consumo (a costo promedio, cargada al proyecto), devolución y transferencia entre almacenes. **Anular** pide motivo y crea la contrapartida una sola vez. No permite sacar más de lo que hay. | INV-03 ✅, INV-05 ✅, INV-06 ✅, INV-07 ✅ |
| Inventario: catálogos | Inventario → pestaña **Catálogos** | `/inventario?tab=catalogos` | Productos, categorías, almacenes y proveedores. Un almacén con existencias no se desactiva. | INV-01 ✅ |
| Bitácora de riego | Operación → Bitácoras | `/bitacoras` | Calcula la duración, incluso si el riego cruza la medianoche. Rechaza fechas futuras. | BIT-01 ✅ |
| Bitácora de aplicaciones | Bitácoras → pestaña **Aplicaciones** | `/bitacoras?tab=aplicaciones` | Puede descontar el producto del almacén y cargarlo al costo. Al cancelar, el producto regresa al mismo lote. No sugiere dosis. | Integración ✅ |
| Actividades de campo | Bitácoras → pestaña **Actividades** | `/bitacoras?tab=actividades` | El costo adicional se suma al proyecto. Catálogo en la pestaña **Catálogo de actividades**. | Integración ✅ |
| Cronología del proyecto | Bitácoras → pestaña **Cronología** | `/bitacoras?tab=cronologia` | Riegos, aplicaciones, actividades, jornadas, maquinaria, insumos y cortes en orden. | Integración ✅ |
| Fotografías / evidencias | Ícono de cámara en las bitácoras | — | Bucket privado; las fotos se reducen a 1920 px; solo formatos permitidos. | Integración ✅ |
| Sincronización (revisión) | Operación → Sincronización | `/sincronizacion` | Pestañas **Requieren revisión**, **Sincronizados** y **Descartados**. Descartar exige motivo. Propietario, Administrador y Agrónomo. | `offline.spec.ts` ✅ |
| Maquinaria: equipos y uso | Operación → Maquinaria | `/maquinaria` | Tarifa congelada al registrar; máximo 24 h por día; un equipo fuera de servicio no registra uso; combustible desde almacén. | Integración ✅ |
| Maquinaria: mantenimiento | Maquinaria → pestaña **Mantenimiento** | `/maquinaria?tab=mantenimiento` | Alertas de mantenimiento vencido o próximo. | GEN-01 ✅ |
| Personal: empleados, jornadas y destajo | Operación → Personal | `/personal` | Máximo un jornal por empleado y día. **Jornada de cuadrilla** crea un registro por integrante. | RH-04 ◐ |
| Personal: asistencia, cuadrillas y asignaciones | Personal → pestañas | `/personal?tab=…` | No se marca falta a quien ya trabajó ese día. | Integración ✅ |

### 2.4 Comercialización

| Funcionalidad | Menú | Ruta | Qué permite | Evidencia |
| ------------- | ---- | ---- | ----------- | --------- |
| Dashboard comercial | Comercialización → Dashboard comercial | `/comercial` | Indicadores y gráficas de producción, ventas y cobranza, con filtros. | Recorrido de pantallas |
| Producción: cortes y lotes | Comercialización → Producción | `/produccion` | Cada corte genera un lote `LOT-AAAA-NNNN`; cajas, toneladas o kg; calidad y fotos; rendimiento por hectárea. | Escenario integral ✅ |
| Inventario de producto y mermas | Producción → pestaña **Inventario de producto** | `/produccion?tab=inventario` | Disponible = inicial − vendido − mermas. Mermas con justificación, sin exceder lo disponible. | PRD-03 ◐ |
| Trazabilidad de lote | Producción → ícono de ruta | `/produccion/lotes/[id]` | Labores de la parcela, corte, movimientos y ventas con cliente. | Integración ✅ |
| Clientes y expediente | Comercialización → Clientes | `/clientes`, `/clientes/[id]` | Compras, pagos, saldos y producto por lote. Un cliente con ventas no muestra **Eliminar**. | VEN-01 ✅ |
| Ventas: borrador, confirmación, cancelación | Comercialización → Ventas | `/ventas`, `/ventas/nueva`, `/ventas/[id]` | El borrador no descuenta producto; confirmar sí. No se vende más de lo disponible (aviso en pantalla y botón deshabilitado). Una venta con pagos no se cancela. | PRD-05 ✅ |
| Ventas: entregas | Detalle de la venta | `/ventas/[id]` | Entregas parciales. | Integración ✅ |
| Cobranza: pagos y anticipos | Comercialización → Cobranza; detalle de la venta | `/pagos`, `/ventas/[id]` | Pagos con comprobante (imagen o PDF); no se acepta un pago mayor al saldo; antigüedad de saldos por cliente. | PAG-02 ✅, PAG-03 ◐, PAG-04 ✅, PAG-05 ✅ |

### 2.5 Finanzas y reportes

| Funcionalidad | Menú | Ruta | Qué permite | Evidencia |
| ------------- | ---- | ---- | ----------- | --------- |
| Dashboard financiero | Finanzas → Dashboard financiero | `/finanzas` | Inversión, presupuesto, costos, ventas, cobranza y resultado. | Recorrido de pantallas |
| Presupuestos por versión | Finanzas → Presupuestos | `/presupuestos`, `/presupuestos/[id]` | Cada revisión exige motivo y conserva la versión anterior; umbrales de alerta configurables. | Integración ✅ |
| Gastos directos y compartidos | Finanzas → Gastos | `/gastos` | Reparto por superficie o porcentaje; pago posterior; no se repite la misma factura; un gasto con pagos no se cancela. | Integración ✅ |
| Rentabilidad | Finanzas → Rentabilidad | `/rentabilidad` | Por proyecto y por cultivo. Resultado = ventas − costo; cobrado + por cobrar = ventas. | FIN-06 ✅, escenario ✅ |
| Flujo de efectivo | Finanzas → Flujo de efectivo | `/flujo-efectivo` | Ingresos contra egresos; gastos sin pagar en «Por pagar». | Escenario ✅ |
| Reportes financieros | Finanzas → Reportes financieros | `/reportes-financieros` | 10 reportes; exportación a CSV, Excel (.xlsx) y PDF (impresión del navegador). | REP-02 ◐ |

### 2.6 Configuración y plataforma

| Funcionalidad | Menú / ubicación | Ruta | Qué permite | Evidencia |
| ------------- | ---------------- | ---- | ----------- | --------- |
| Registro, inicio y cierre de sesión | Pantallas de acceso | `/registro`, `/login` | Rechaza contraseñas incorrectas; sin sesión redirige al inicio de sesión. | AUT-01 ✅, AUT-02 ✅, AUT-03 ✅ |
| Crear organización y multiempresa | `/bienvenida`; selector del menú lateral | — | Quien crea la organización queda como Propietario. Separación entre empresas probada en tablas, vistas, funciones y archivos. | SEG-02 ◐, pgTAP ✅ |
| Datos de la organización | Configuración → Organización | `/configuracion/organizacion` | Nombre, RFC, correo, teléfono y dirección. | Integración ✅ |
| Mi perfil | Configuración → Mi perfil | `/configuracion/perfil` | Nombre, teléfono y cambio de contraseña. No hay foto de perfil. | Integración ✅ |
| Permisos por rol | Todas las pantallas | — | La interfaz oculta botones según el rol y la base de datos rechaza la operación aunque se intente saltar la interfaz. | AUT-05 ◐, SEG (pgTAP 450) ✅ |

✅ = aprobada · ◐ = ejecutada parcialmente (los pasos ejecutados fueron correctos).

---

## 3. Funcionalidades parciales

| Funcionalidad | Ruta | Qué funciona | Qué falta o qué limita |
| ------------- | ---- | ------------ | ---------------------- |
| Observaciones de campo | `/bitacoras?tab=observaciones` | Se consultan en Bitácoras y se capturan desde **Captura en campo**, con foto. | En Bitácoras **no hay botón para registrarlas**. **No aparecen en la cronología** del proyecto (`v_project_timeline` no las incluye). |
| Captura en campo (con y sin conexión) | `/campo` | Riego, actividad, aplicación, observación con foto y corte. La sincronización no duplica, detecta conflictos y reintenta. | Sin conexión **no se capturan** jornadas, uso de maquinaria, ventas, pagos, gastos ni movimientos de inventario. La foto de un registro pendiente no se edita: se agrega después desde «Evidencias». |
| Reportes operativos | `/reportes` | 9 reportes con filtros: Consumo de insumos, Existencias, Por caducar, Riegos, Aplicaciones, Jornadas, Mano de obra, Maquinaria y Costos operativos. | **Solo se exportan a CSV**: no tienen Excel ni PDF (los financieros sí). |
| Usuarios, roles e invitaciones | `/configuracion/usuarios` | Invitar, cambiar rol, desactivar y cancelar invitaciones. | El **correo de invitación** usa las plantillas de Supabase, **en inglés**. No se comprobó la recepción real del correo. |
| Plan y límites de uso | `/configuracion/organizacion` | Muestra el plan (*Piloto*, sin límites) y el uso; los límites se aplican en la base de datos. | Las «funciones por plan» son informativas; el plan solo se cambia desde la base de datos. |
| Bitácora de auditoría | Dashboard → «Actividad reciente» | La base de datos registra las operaciones financieras y de inventario con su autor. | En la interfaz solo se ven los últimos movimientos: **no hay pantalla de consulta ni filtros**. |

---

## 4. Funcionalidades pendientes (no implementadas)

| Funcionalidad | Situación actual |
| ------------- | ---------------- |
| Cobro de suscripciones y facturación (CFDI) | No hay pasarela de pago ni facturación. Solo existe la arquitectura propuesta en `docs/saas-suscripciones.md`. |
| Eliminar una organización desde la interfaz | La base de datos lo permite, pero no hay opción en pantalla. Se hace desde la base de datos. |
| Importación masiva de datos | La captura inicial de ranchos, insumos, personal, etc. es manual. |

Funciones que la aplicación **no ofrece** y que conviene aclarar a los usuarios:
- Foto de perfil (el campo `avatar_url` existe en la base de datos, pero ninguna pantalla lo usa).
- Recomendaciones agronómicas o sugerencia de dosis.
- Notificaciones por correo o en el teléfono: las alertas solo se ven en la campana.

---

## 5. Implementadas pero no verificadas

| Funcionalidad | Por qué no se pudo verificar | Cómo verificarla |
| ------------- | ---------------------------- | ---------------- |
| Recuperar y restablecer contraseña (`/recuperar`, `/restablecer`) | Depende del correo. Localmente llega a Mailpit, pero no se siguió el enlace. En producción requiere SMTP propio. | Prueba AUT-04 con Mailpit (http://127.0.0.1:54324). |
| Instalación de la aplicación (PWA) en un dispositivo | El manifiesto, los íconos y el service worker sí se verificaron en navegador (`pwa.spec.ts` ✅). La instalación real en Android o iPhone requiere un teléfono. | Pruebas PWA-01 y PWA-02 en un dispositivo real. |
| Sincronización en segundo plano | Usa el evento `sync` del service worker, que no existe en iPhone; ahí se sincroniza al abrir la app. | Prueba PWA-04 en Android con la app cerrada. |

---

## 6. Funcionalidades que todavía no pueden probarse

| Prueba (guía) | Motivo |
| ------------- | ------ |
| AUT-04 Recuperación de contraseña | Requiere seguir el enlace del correo (Mailpit en local, SMTP en producción). |
| AUT-07 Invitar usuario y aceptar | Requiere el correo de invitación; además, la plantilla está en inglés. |
| PWA-01, PWA-02 Instalar y abrir la app instalada | Requieren un teléfono o una computadora con instalación real. |
| PWA-04 Sincronización en segundo plano | Requiere un dispositivo Android con la app cerrada. |
| Cobro de suscripciones, eliminar organización, importación masiva | No están implementadas. |

El resto de las pruebas pendientes de la guía (46 en total) **sí pueden ejecutarse** en un entorno local; simplemente
no se ejecutaron en esta jornada.

---

## 7. Defectos detectados durante la documentación

Ninguno impide operar. No se corrigieron porque el alcance de este trabajo excluye cambios a la lógica.

| ID | Severidad | Dónde | Descripción | Evidencia |
| -- | --------- | ----- | ----------- | --------- |
| D-DOC-01 | Baja (cosmética) | Expediente del proyecto → **Detalle de costos** | Las cantidades enteras aparecen con un punto colgante: «300. kg». La vista `v_project_cost_entries` usa `to_char(…, 'FM999,999,990.999')`, que deja el separador decimal cuando no hay decimales. | `pruebas/evidencias/inv-03-costo-proyecto.png` |
| D-DOC-02 | Baja (cosmética) | Avisos de error de inventario y ventas | Las cantidades salen sin formato: «hay 5000.000 kg y se requieren 6000», «tiene 18000.000 kg disponibles y se intentan vender 20000.000 kg». | `pruebas/evidencias/inv-05.png`, `prd-05.png` |
| D-DOC-03 | Baja (documentación) | Guía de pruebas | Cinco casos describían un comportamiento distinto al real (CAT-02, CAT-03, INV-05, INV-06, PRD-05). La guía ya está corregida. | Matriz de resultados, sección 4 |

---

## 8. Roles y permisos

Fuente: `src/lib/auth/roles.ts`. «✔» = puede registrar o modificar; «👁» = solo consulta; «—» = sin acceso a la
pantalla («Sin acceso a este módulo»).

| Área | Propietario | Administrador | Agrónomo | Supervisor | Almacén | Finanzas | Consulta |
| ---- | :---------: | :-----------: | :------: | :--------: | :-----: | :------: | :------: |
| Organización y usuarios | ✔ | ✔ | 👁 | 👁 | 👁 | 👁 | 👁 |
| Ranchos, parcelas, cultivos y proyectos | ✔ | ✔ | ✔ (no elimina) | 👁 | 👁 | 👁 | 👁 |
| Bitácoras de campo | ✔ | ✔ | ✔ | ✔ | 👁 | 👁 | 👁 |
| Inventario de insumos | ✔ | ✔ | 👁 | 👁 | ✔ | 👁 | 👁 |
| Maquinaria y empleados | ✔ | ✔ | ✔ | 👁 | 👁 | 👁 | 👁 |
| Jornadas de mano de obra | ✔ | ✔ | ✔ | ✔ | 👁 | 👁 | 👁 |
| Cortes de producción | ✔ | ✔ | ✔ | ✔ | 👁 | 👁 | 👁 |
| Mermas de producto | ✔ | ✔ | ✔ | ✔ | ✔ | 👁 | 👁 |
| Clientes, ventas y cobranza | ✔ | ✔ | — | — | — | ✔ | 👁 |
| Presupuestos, gastos, flujo, rentabilidad, reportes financieros | ✔ | ✔ | — | — | — | ✔ | 👁 |
| Revisión de registros sin conexión | ✔ | ✔ | ✔ | — | — | — | — |
| Actividad reciente (auditoría) | ✔ | ✔ | — | — | — | — | — |

Comprobado en pantalla (AUT-05, SEG-03): el Supervisor de campo ve «Sin acceso a este módulo» en Dashboard financiero
y Ventas; el usuario Consulta no ve **Nuevo proyecto** ni **Registrar movimiento**, y al abrir `/proyectos/nuevo` por
dirección regresa al listado.

---

## 9. Modelo de datos (referencia)

La base de datos tiene **51 tablas, 8 vistas de cálculo y 125 reglas de acceso (RLS)**; las 51 tablas tienen RLS
activada. Cada registro pertenece a una organización y las relaciones no pueden cruzar organizaciones.

| Grupo | Tablas principales |
| ----- | ------------------ |
| Plataforma | `organizations`, `profiles`, `memberships`, `invitations`, `audit_logs`, `plans`, `organization_counters` |
| Producción agrícola | `farms`, `plots`, `crops`, `projects`, `project_plots`, `project_status_history` |
| Inventario | `inventory_products`, `inventory_categories`, `warehouses`, `suppliers`, `inventory_lots`, `inventory_balances`, `inventory_movements` |
| Bitácoras | `irrigation_logs`, `chemical_applications`, `field_activities`, `activity_types`, `field_observations`, `attachments` |
| Maquinaria y personal | `machinery`, `machinery_usage`, `machinery_maintenance`, `employees`, `crews`, `crew_members`, `employee_assignments`, `attendance_records`, `labor_records` |
| Producción y ventas | `harvests`, `production_movements`, `customers`, `sales`, `sale_items`, `sale_deliveries`, `sale_delivery_items`, `payments`, `advance_applications` |
| Finanzas | `project_budgets`, `project_budget_lines`, `expenses`, `project_expenses`, `cash_movements`, `finance_settings` |
| Sin conexión | `offline_submissions` |

Vistas de cálculo: `v_project_costs`, `v_project_cost_entries`, `v_budget_comparison`, `v_sale_balances`,
`v_sale_lot_trace`, `v_inventory_stock`, `v_machinery_status`, `v_project_timeline`.

---

## 10. Cómo repetir este análisis

```bash
npm run db:start          # Supabase local con datos de demostración
npm test                  # 145 pruebas unitarias
npm run test:db           # 450 pruebas de base de datos y permisos
npm run test:integration  # 67 pruebas con usuarios reales
npm run test:e2e          # 32 pruebas en navegador (compila producción)
```

En WSL, Chromium necesita las bibliotecas del sistema (`libnspr4`, `libnss3`, `libasound2`). Instálalas con
`npx playwright install --with-deps chromium` o apunta `LD_LIBRARY_PATH` a una copia local de esas bibliotecas.
