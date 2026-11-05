# Matriz de Resultados de Pruebas - AgroGestión 360

Versión piloto · 5 de noviembre de 2026 · Commit `49f3644`

Esta matriz consolida el estado de las 78 pruebas de la [Guía de pruebas funcionales](guia_pruebas_funcionales.md) y
de las pruebas automatizadas del proyecto. Las capturas de evidencia están en [`evidencias/`](evidencias/).

---

## 1. Resumen

### 1.1 Pruebas funcionales (desde la pantalla)

| Estado | Cantidad | % |
| ------ | :------: | :-: |
| ✅ Aprobada | 25 | 32 % |
| ◐ Parcial (pasos ejecutados correctos; faltan pasos) | 7 | 9 % |
| ❌ Rechazada | 0 | 0 % |
| ⛔ Bloqueada | 0 | 0 % |
| ⏳ Pendiente | 46 | 59 % |
| **Total** | **78** | **100 %** |

De las 46 pendientes, **5 no pueden ejecutarse en el entorno local** sin un correo real o un dispositivo físico (AUT-04,
AUT-07, PWA-01, PWA-02 y PWA-04). Las otras 41 pueden ejecutarse siguiendo la guía.

### 1.2 Pruebas automatizadas

| Suite | Comando | Pruebas | Resultado |
| ----- | ------- | :-----: | --------- |
| Unitarias (reglas y cálculos) | `npm test` | 145 | ✅ 145 aprobadas |
| Base de datos, permisos y RLS (pgTAP) | `npm run test:db` | 450 | ✅ 450 aprobadas |
| Integración con usuarios reales de cada rol | `npm run test:integration` | 67 | ✅ 67 aprobadas |
| Navegador: escritorio, móvil, PWA y sin conexión (Playwright) | `npm run test:e2e` | 32 | ✅ 32 aprobadas |
| **Total** | | **694** | **✅ 694 aprobadas, 0 fallidas** |

Todas se ejecutaron el 5 de noviembre de 2026 en el equipo de desarrollo (WSL2, Supabase local).

### 1.3 Por módulo

| Módulo | Pruebas | ✅ | ◐ | ⏳ |
| ------ | :-----: | :-: | :-: | :-: |
| Autenticación | 6 | 3 | 1 | 2 |
| Usuarios | 1 |  |  | 1 |
| Perfil | 1 |  |  | 1 |
| General | 1 | 1 |  |  |
| Ranchos y parcelas | 2 | 2 |  |  |
| Cultivos | 1 | 1 |  |  |
| Proyectos | 7 | 4 | 1 | 2 |
| Inventario | 7 | 6 |  | 1 |
| Bitácoras | 5 | 1 |  | 4 |
| Maquinaria | 4 |  |  | 4 |
| Personal | 5 |  | 1 | 4 |
| Producción | 4 |  | 1 | 3 |
| Producción / Ventas | 1 | 1 |  |  |
| Ventas | 6 | 1 |  | 5 |
| Cobranza | 6 | 3 | 1 | 2 |
| Presupuestos | 2 |  |  | 2 |
| Gastos | 2 |  |  | 2 |
| Finanzas | 1 |  |  | 1 |
| Rentabilidad | 1 | 1 |  |  |
| Flujo de efectivo | 1 |  |  | 1 |
| Reportes | 2 | 1 | 1 |  |
| Seguridad | 5 |  | 1 | 4 |
| PWA | 2 |  |  | 2 |
| Sin conexión | 4 |  |  | 4 |
| Sincronización | 1 |  |  | 1 |
| **Total** | **78** | **25** | **7** | **46** |

---

## 2. Entorno de ejecución

| Elemento | Valor |
| -------- | ----- |
| Fecha | 5 de noviembre de 2026 |
| Versión | commit `49f3644`, compilación de producción (`next build` + `next start`, puerto 3217) |
| Base de datos | Supabase local con datos de demostración (`supabase/seed.sql`) y la organización «Escenario jitomate» (`npm run demo:jitomate`) |
| Navegador | Chromium (Playwright 1.64), 1440 × 900 px, idioma es-MX, zona horaria America/Mexico_City |
| Forma de ejecución | Guion de Playwright que hace los mismos clics y capturas que una persona; cada paso se comparó contra el resultado esperado de la guía |
| Usuarios | Usuarios de demostración PROP, AGRO, CAMPO, CONS y J-PROP / J-FIN (ver guía, 1.4) |
| Datos creados | Solo datos de prueba en la organización de demostración, con sufijo numérico (p. ej. «Rancho Los Campos 5029», «Sulfato de potasio 7034») |

**Notas sobre la ejecución.**
- La base no se reinició antes de ejecutar, así que algunas pruebas usaron nombres con sufijo o datos equivalentes. Cuando
  la variación importa, se indica en el resultado de la guía.
- Algunas pruebas se repitieron mientras se ajustaba el guion (por ejemplo, INV-07 se ejecutó tres veces: el Diésel de
  Bodega La Esperanza aumentó 300 l en total). Solo se registra el resultado de la ejecución final.
- PAG-02 y PAG-03 liquidaron VTA-2026-0003 y PRO-07 canceló PRY-2026-0005. Para repetir la guía con las cifras
  originales ejecuta `npm run db:reset` y `npm run demo:jitomate`.

---

## 3. Matriz completa

Leyenda: ✅ Aprobada · ◐ Parcial · ⏳ Pendiente · 🔒 Pendiente que requiere correo o dispositivo real.

| ID | Prueba | Módulo | Estado manual | Evidencia | Cobertura automatizada |
| -- | ------ | ------ | ------------- | --------- | ---------------------- |
| AUT-01 | Inicio de sesión correcto | Autenticación | ✅ Aprobada | [aut-01.png](evidencias/aut-01.png) | `tests/e2e/auth.spec.ts` ✅ |
| AUT-02 | Inicio de sesión incorrecto | Autenticación | ✅ Aprobada | [aut-02.png](evidencias/aut-02.png) | integración «rechaza una contraseña incorrecta» ✅ |
| AUT-03 | Cierre de sesión | Autenticación | ✅ Aprobada | — | `auth.spec.ts` «inicia y cierra sesión» ✅ |
| AUT-04 | Recuperación de contraseña | Autenticación | 🔒 Pendiente | — | — |
| AUT-05 | Acceso según roles | Autenticación | ◐ Parcial | [aut-05.png](evidencias/aut-05.png) | — |
| AUT-06 | Registro de cuenta y creación de organización | Autenticación | ⏳ Pendiente | — | integración «registra una cuenta…», «crea la organización con el usuario como propietario», «rechaza contraseñas cortas» ✅ |
| AUT-07 | Invitar usuario y aceptar la invitación | Usuarios | 🔒 Pendiente | — | integración «agrega miembros con su rol» ✅ |
| AUT-08 | Actualizar perfil y contraseña | Perfil | ⏳ Pendiente | — | — |
| GEN-01 | Dashboard y notificaciones | General | ✅ Aprobada | [gen-01.png](evidencias/gen-01.png), [gen-01-campo.png](evidencias/gen-01-campo.png) | `tests/e2e/escritorio.spec.ts` (notificaciones) ✅ |
| CAT-01 | Registrar rancho y parcela | Ranchos y parcelas | ✅ Aprobada | [cat-01.png](evidencias/cat-01.png) | integración «registra rancho, parcela y cultivo» ✅ |
| CAT-02 | Superficie de parcelas mayor a la del rancho | Ranchos y parcelas | ✅ Aprobada | [cat-02.png](evidencias/cat-02.png) | integración «rechaza parcelas que exceden la superficie del rancho o con superficie negativa» ✅ |
| CAT-03 | Registrar cultivo | Cultivos | ✅ Aprobada | — | — |
| PRO-01 | Crear proyecto | Proyectos | ✅ Aprobada | [cat-03.png](evidencias/cat-03.png) | integración «crea el proyecto con folio…», «rechaza datos incompletos» ✅ |
| PRO-02 | Editar proyecto | Proyectos | ⏳ Pendiente | — | — |
| PRO-03 | Consultar proyecto (expediente) | Proyectos | ⏳ Pendiente | [pro-01.png](evidencias/pro-01.png) | escenario de jitomate (integración, 22 pruebas) ✅ |
| PRO-04 | Asignar parcelas | Proyectos | ◐ Parcial | — | — |
| PRO-05 | Asignar más superficie de la disponible | Proyectos | ✅ Aprobada | [pro-04.png](evidencias/pro-04.png) | — |
| PRO-06 | Cambiar estado | Proyectos | ✅ Aprobada | — | — |
| PRO-07 | Cancelar proyecto con motivo | Proyectos | ✅ Aprobada | — | — |
| INV-01 | Crear producto | Inventario | ✅ Aprobada | — | — |
| INV-02 | Registrar entrada | Inventario | ✅ Aprobada | [pro-05.png](evidencias/pro-05.png) | integración «registra la entrada (compra) sin cargar costo al proyecto» ✅ |
| INV-03 | Registrar salida (consumo a proyecto) | Inventario | ✅ Aprobada | [pro-06.png](evidencias/pro-06.png) | integración «el consumo sale a costo promedio y se vuelve costo del proyecto» ✅ |
| INV-04 | Consultar existencia | Inventario | ⏳ Pendiente | — | — |
| INV-05 | Salida superior al inventario disponible | Inventario | ✅ Aprobada | [pro-07.png](evidencias/pro-07.png), [pro-07-rancho.png](evidencias/pro-07-rancho.png) | integración «rechaza existencias insuficientes y cantidades negativas» ✅ |
| INV-06 | Consultar historial y anular movimiento | Inventario | ✅ Aprobada | — | — |
| INV-07 | Transferencia entre almacenes | Inventario | ✅ Aprobada | — | — |
| BIT-01 | Registrar riego | Bitácoras | ✅ Aprobada | [inv-01.png](evidencias/inv-01.png) | integración «el supervisor registra una bitácora de riego; consulta no» ✅ |
| BIT-02 | Registrar aplicación con descuento de almacén | Bitácoras | ⏳ Pendiente | — | — |
| BIT-03 | Registrar actividad | Bitácoras | ⏳ Pendiente | — | — |
| BIT-04 | Consultar historial y cronología | Bitácoras | ⏳ Pendiente | — | — |
| BIT-05 | Cancelar aplicación (devuelve el producto) | Bitácoras | ⏳ Pendiente | — | — |
| MAQ-01 | Registrar equipo | Maquinaria | ⏳ Pendiente | — | — |
| MAQ-02 | Registrar utilización y asignar a proyecto | Maquinaria | ⏳ Pendiente | [inv-02-form.png](evidencias/inv-02-form.png), [inv-02.png](evidencias/inv-02.png) | integración «registra maquinaria y su uso con tarifa congelada» ✅ |
| MAQ-03 | Más de 24 h de uso en un día | Maquinaria | ⏳ Pendiente | [inv-03.png](evidencias/inv-03.png), [inv-03-costo-proyecto.png](evidencias/inv-03-costo-proyecto.png) | integración «rechaza más de 24 horas de un equipo en el día» ✅ |
| MAQ-04 | Registrar mantenimiento | Maquinaria | ⏳ Pendiente | — | — |
| RH-01 | Registrar trabajador | Personal | ⏳ Pendiente | — | — |
| RH-02 | Asignar trabajador | Personal | ⏳ Pendiente | [inv-05.png](evidencias/inv-05.png) | integración «asigna un trabajador al proyecto» ✅ |
| RH-03 | Registrar jornada | Personal | ⏳ Pendiente | — | — |
| RH-04 | Segundo jornal el mismo día | Personal | ◐ Parcial | — | — |
| RH-05 | Consultar costo de mano de obra | Personal | ⏳ Pendiente | — | — |
| PRD-01 | Registrar corte | Producción | ⏳ Pendiente | [inv-06.png](evidencias/inv-06.png) | integración «registra un corte que genera su lote» ✅ |
| PRD-02 | Crear lote (dos calidades en un corte) | Producción | ⏳ Pendiente | — | — |
| PRD-03 | Consultar producción disponible | Producción | ◐ Parcial | [inv-07.png](evidencias/inv-07.png) | integración «producción: cortes, lotes, mermas, vendido y disponible» ✅ |
| PRD-04 | Registrar merma | Producción | ⏳ Pendiente | — | — |
| PRD-05 | Vender más producción de la disponible | Producción / Ventas | ✅ Aprobada | [bit-01.png](evidencias/bit-01.png), [bit-01-futura.png](evidencias/bit-01-futura.png) | integración «rechaza ventas superiores a la producción disponible» ✅ |
| VEN-01 | Registrar cliente | Ventas | ✅ Aprobada | — | — |
| VEN-02 | Crear venta (borrador) | Ventas | ⏳ Pendiente | — | — |
| VEN-03 | Agregar varios productos | Ventas | ⏳ Pendiente | — | — |
| VEN-04 | Confirmar venta | Ventas | ⏳ Pendiente | [rh-04.png](evidencias/rh-04.png) | integración «confirma una venta y descuenta el lote» ✅ |
| VEN-05 | Registrar entrega | Ventas | ⏳ Pendiente | — | — |
| VEN-06 | Consultar historial comercial | Ventas | ⏳ Pendiente | — | — |
| PAG-01 | Registrar pago con comprobante | Cobranza | ⏳ Pendiente | — | — |
| PAG-02 | Registrar pago parcial | Cobranza | ✅ Aprobada | [prd-03.png](evidencias/prd-03.png) | integración «registra un pago parcial y actualiza el saldo» ✅ |
| PAG-03 | Registrar liquidación | Cobranza | ◐ Parcial | — | — |
| PAG-04 | Consultar saldo pendiente | Cobranza | ✅ Aprobada | — | — |
| PAG-05 | Pago superior al saldo | Cobranza | ✅ Aprobada | [prd-05.png](evidencias/prd-05.png) | integración «rechaza pagos superiores al saldo» ✅ |
| PAG-06 | Anticipo y su aplicación | Cobranza | ⏳ Pendiente | [ven-01.png](evidencias/ven-01.png) | escenario de jitomate «antes de aplicar el anticipo…», «aplica el anticipo…» ✅ |
| FIN-01 | Crear presupuesto | Presupuestos | ⏳ Pendiente | — | — |
| FIN-02 | Registrar gasto | Gastos | ⏳ Pendiente | [pag-02.png](evidencias/pag-02.png) | escenario de jitomate «el gasto pendiente de pago es costo, pero no egreso» ✅ |
| FIN-03 | Registrar gasto compartido | Gastos | ⏳ Pendiente | — | — |
| FIN-04 | Consultar costos | Finanzas | ⏳ Pendiente | [pag-03.png](evidencias/pag-03.png) | escenario de jitomate «sin costos duplicados…» ✅ |
| FIN-05 | Comparar presupuesto contra gasto | Presupuestos | ⏳ Pendiente | — | — |
| FIN-06 | Consultar rentabilidad | Rentabilidad | ✅ Aprobada | [pag-04.png](evidencias/pag-04.png), [pag-04-cobranza.png](evidencias/pag-04-cobranza.png) | integración «calcula costos de producción y rentabilidad sin duplicar» ✅ |
| FIN-07 | Flujo de efectivo | Flujo de efectivo | ⏳ Pendiente | [pag-05.png](evidencias/pag-05.png) | escenario de jitomate «el flujo de efectivo cuenta el dinero una sola vez» ✅ |
| REP-01 | Reportes operativos y descarga CSV | Reportes | ✅ Aprobada | — | — |
| REP-02 | Reportes financieros y descarga CSV, Excel y PDF | Reportes | ◐ Parcial | — | — |
| SEG-01 | Acceso con diferentes roles | Seguridad | ⏳ Pendiente | [fin-06.png](evidencias/fin-06.png) | — |
| SEG-02 | Información de otra organización | Seguridad | ◐ Parcial | [rep-01.png](evidencias/rep-01.png) | integración «otra organización no ve los datos», «no escribe ni ejecuta operaciones», «no se referencian datos de otra organización» ✅ |
| SEG-03 | Operación sin autorización | Seguridad | ⏳ Pendiente | [rep-02.png](evidencias/rep-02.png) | integración «un supervisor de campo no mueve inventario», «el supervisor no ve ventas ni registra ventas», «consulta lee la rentabilidad pero no registra pagos» ✅ |
| SEG-04 | Protección de archivos | Seguridad | ⏳ Pendiente | [seg-02.png](evidencias/seg-02.png) | integración «Storage: no se leen ni suben evidencias de otra organización», «Storage: rechaza formatos no permitidos» ✅ |
| SEG-05 | Desactivar usuario | Seguridad | ⏳ Pendiente | — | — |
| PWA-01 | Instalar aplicación | PWA | 🔒 Pendiente | — | `tests/e2e/pwa.spec.ts` (manifiesto, íconos y registro del service worker) ✅ |
| PWA-02 | Abrir la aplicación instalada | PWA | 🔒 Pendiente | — | — |
| PWA-03 | Registrar información sin conexión | Sin conexión | ⏳ Pendiente | — | `tests/e2e/offline.spec.ts` (captura sin red y sincronización al volver la conexión) ✅ |
| PWA-04 | Recuperar conexión y sincronizar | Sin conexión | 🔒 Pendiente | — | integración «sincroniza un riego…», «sincroniza una observación con su fotografía pendiente» ✅ |
| PWA-05 | Comprobar que no existan duplicados | Sin conexión | ⏳ Pendiente | — | integración «no duplica al reintentar (idempotencia)», «una falla de red es transitoria…» ✅ |
| PWA-06 | Consultar registros pendientes o fallidos | Sin conexión | ⏳ Pendiente | — | `offline.spec.ts` «un rechazo del servidor queda en revisión…» ✅ |
| PWA-07 | Revisión y descarte en Sincronización | Sincronización | ⏳ Pendiente | — | `offline.spec.ts` «…se ve en Sincronización» ✅ |

El resultado obtenido de cada prueba, palabra por palabra, está en la tabla final de cada caso de la guía.

---

## 4. Diferencias entre la guía y la aplicación (corregidas)

Durante la ejecución, cinco casos describían un comportamiento distinto al real. **La aplicación funciona
correctamente**; lo que estaba mal era la redacción de la guía, que ya se corrigió.

| Prueba | La guía decía | La aplicación hace |
| ------ | ------------- | ------------------ |
| CAT-02 | Con −2 ha: «validación de superficie mayor que cero». | Muestra «Ingresa un número válido». |
| CAT-03 | Pulsar **Eliminar** en un cultivo con proyectos muestra un error. | El botón **Eliminar** no aparece en cultivos con proyectos; solo **Desactivar**. |
| INV-05 | Con −10: «Debe ser mayor que cero». | Muestra «Ingresa un número válido» («Debe ser mayor que cero» aparece con 0). |
| INV-06 | **Anular movimiento** se confirma directamente. | Pide un **Motivo** de al menos 5 caracteres. |
| PRD-05 | Se intenta confirmar la venta y se rechaza. | La pantalla avisa «Excede lo disponible…» y deshabilita **Confirmar venta**; **Guardar borrador** se rechaza con el mensaje del servidor. |

El manual de usuario también se ajustó: anulación con motivo (7.10), botón Eliminar oculto en cultivos y empleados
(5.2 y 10.1), mensajes de validación (3.6) y ventanas de motivo (4.13).

---

## 5. Defectos encontrados

| ID | Severidad | Descripción | Prueba | Estado |
| -- | --------- | ----------- | ------ | ------ |
| D-DOC-01 | Baja (cosmética) | En **Detalle de costos** del proyecto las cantidades enteras aparecen como «300. kg» (punto colgante). Origen: `to_char(…, 'FM999,999,990.999')` en la vista `v_project_cost_entries`. | INV-03 | Abierto. No se corrigió: fuera del alcance (no modificar la lógica). |
| D-DOC-02 | Baja (cosmética) | Los avisos de existencia insuficiente muestran cantidades sin formato: «hay 5000.000 kg y se requieren 6000». | INV-05, PRD-05 | Abierto. Documentado en el manual (3.6). |

No se encontraron defectos funcionales: todas las reglas de negocio probadas (superficie, existencias, saldos, permisos,
jornal diario, fechas futuras, separación entre organizaciones) se comportaron como se espera.

---

## 6. Escenario integral

El [Escenario de prueba integral](escenario_prueba_integral.md) no se ha capturado manualmente paso a paso, pero:
- sus cifras se recalcularon a mano y cuadran;
- la secuencia hasta el paso 18 la ejecuta la prueba de integración ✅;
- en la organización «Escenario jitomate» la aplicación muestra exactamente las cifras esperadas: costo $66,560.00,
  resultado $129,440.00, inventario $30,190.00, disponible 15,800 kg, por cobrar $86,000.00 (evidencias `esc-*.png`).

---

## 7. Siguientes pasos

1. Ejecutar las 41 pruebas pendientes que no requieren correo ni dispositivo:
   - Acceso y perfil: AUT-06, AUT-08.
   - Proyectos e inventario: PRO-02, PRO-03, INV-04.
   - Bitácoras: BIT-02 a BIT-05.
   - Maquinaria: MAQ-01 a MAQ-04.
   - Personal: RH-01, RH-02, RH-03, RH-05.
   - Producción: PRD-01, PRD-02, PRD-04.
   - Ventas y cobranza: VEN-02 a VEN-06, PAG-01, PAG-06.
   - Finanzas: FIN-01 a FIN-05, FIN-07.
   - Seguridad: SEG-01, SEG-03, SEG-04, SEG-05.
   - Sin conexión: PWA-03, PWA-05, PWA-06, PWA-07.
2. Completar los pasos faltantes de las 7 parciales.
3. Configurar SMTP en el entorno de pruebas y ejecutar AUT-04 y AUT-07.
4. Ejecutar PWA-01, PWA-02 y PWA-04 en un teléfono Android y en un iPhone.
5. Ejecutar el escenario integral completo con un usuario nuevo y llenar su tabla de registro (sección 4 del escenario).

