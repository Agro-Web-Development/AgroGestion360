# Escenario Integral de Prueba - AgroGestión 360

**Caso práctico: Producción de jitomate · Agropecuaria Los Campos**

Versión piloto · noviembre de 2026

Este caso recorre AgroGestión 360 completo, desde el alta del rancho hasta que el cliente termina de pagar la venta. Todos
los datos son ficticios y las cifras se calcularon para que cuadren entre sí.

Los nombres de pantallas y botones coinciden con el [Manual de Usuario](../manual/manual_usuario_agrogestion_360.md). Las pruebas individuales
de cada módulo están en la [Guía de Pruebas Funcionales](guia_pruebas_funcionales.md).

> **Origen de las cifras.** Cantidades, precios y resultados son los del escenario automatizado
> `tests/support/escenario-jitomate.ts`. Ese escenario se ejecutó con usuarios reales el 5 de noviembre de 2026 y cuadró al
> centavo, hasta el pago parcial (saldo de $86,000). Este documento agrega el **pago final de $86,000**. Las cifras
> posteriores a ese pago se calcularon a mano a partir de las verificadas.

---

## 1. Antes de empezar

### 1.1 Entorno: nunca en producción

> **Ejecuta este escenario solo en un entorno de pruebas:** Supabase local (`npm run db:start` + `npm run dev`) o un
> entorno de pruebas aparte. **No lo ejecutes en producción.** Crea registros financieros y de inventario que no se
> pueden borrar desde la aplicación, porque los movimientos solo se cancelan o revierten. Para limpiar un entorno local,
> usa `npm run db:reset`.

### 1.2 Organización limpia

Las cifras esperadas (folios, totales del dashboard, inventario) suponen una organización **sin datos previos**:

1. Regístrate con un usuario nuevo, por ejemplo `escenario.propietario@ejemplo.mx`, desde **Regístrate** (Manual 3.1).
2. En **Bienvenido**, captura el **Nombre de la organización** «Agropecuaria Los Campos» y pulsa **Crear organización**.
   Quedas como **Propietario**.

La organización nueva ya trae:
- Las categorías de insumo **Semillas**, **Fertilizantes**, **Agroquímicos** y **Combustibles**, entre otras.
- El almacén **Almacén general**.
- El catálogo de actividades.

> En el entorno local ya existe una organización de demostración con el mismo nombre. No hay conflicto: el usuario nuevo
> solo pertenece a la suya, que no lleva la etiqueta **Demostración**. **No uses la organización de demostración**: tiene
> datos previos y las cifras no coincidirían.

**Folios.** En la organización nueva, los folios empiezan en 0001. **AAAA** es el **año en que se captura** el registro,
no la fecha del registro. Si ejecutas el escenario en 2026, verás PRY-2026-0001, LOT-2026-0001, etc.

**Quién captura.** Todo el escenario puede hacerlo el **Propietario**. Si quieres probar también los roles, invita
usuarios (Manual 16.4) y reparte los pasos según la columna «Rol sugerido» del calendario (1.4).

### 1.3 Fechas

Las fechas son de 2026 y respetan estas reglas de la aplicación:
- Ningún registro puede tener fecha futura.
- Los registros de campo deben ser posteriores al inicio del proyecto.
- Las ventas deben ser posteriores al corte de sus lotes.
- Los pagos no pueden ser anteriores a la venta.

Si ejecutas el escenario **antes del 3 de noviembre de 2026**, recorre todas las fechas hacia atrás el mismo número de
días.

### 1.4 Calendario del escenario

| Paso | Fecha | Operación | Rol sugerido |
| ---- | ----- | --------- | ------------ |
| 1–2 | — | Rancho Los Campos y Parcela Norte (5 ha) | Agrónomo |
| 3 | 28-jul-2026 | Proyecto «Producción de jitomate» (inicio) | Agrónomo |
| 4 | 28-jul-2026 | Presupuesto de $250,000 por categoría | Finanzas y ventas |
| 5–6 | 30-jul-2026 | Alta de 5 insumos y entradas por $75,300 | Almacén |
| 6 | 02-ago-2026 | Pago al proveedor de insumos, $70,500 | Finanzas y ventas |
| 9 | 09-ago-2026 | Tractor: 6 h + 40 l de diésel | Agrónomo |
| 8 | 11-ago-2026 | Asignación de 3 trabajadores | Agrónomo |
| 7 | 12 y 13-ago-2026 | Consumo de semilla y fertilizante | Almacén |
| 10 | 17-ago, 27-ago y 06-sep | 3 riegos de 3 h y 120 m³ | Supervisor de campo |
| 11 | 01-sep y 16-sep-2026 | Aplicaciones de nitrato e insecticida | Supervisor de campo |
| 8 | 11-ago a 24-sep-2026 | 5 jornadas de la cuadrilla | Supervisor de campo |
| 12 | 06-sep y 26-oct-2026 | Gastos: energía (pagada) y flete (por pagar) | Finanzas y ventas |
| 13–14 | 06-oct, 16-oct y 26-oct-2026 | 3 cortes, 4 lotes, 30,000 kg | Supervisor de campo |
| 14 | 16-oct-2026 | Destajo de corte (300 cajas) | Supervisor de campo |
| 14 | 27-oct-2026 | Merma de 200 kg | Supervisor de campo |
| 15–16 | 18-oct-2026 | Cliente y venta de 700 cajas, $196,000 | Finanzas y ventas |
| 17 | 18-oct y 20-oct-2026 | Anticipo de $50,000, recibido y aplicado | Finanzas y ventas |
| 18 | 28-oct-2026 | Pago parcial de $60,000 | Finanzas y ventas |
| 19 | 03-nov-2026 | Pago final de $86,000 | Finanzas y ventas |
| 20 | — | Consulta de costos y rentabilidad | Propietario |

> El orden de los pasos sigue la lista solicitada, no el orden cronológico, y la aplicación lo permite porque cada
> registro lleva su propia fecha. Excepciones: el **paso 9** (maquinaria) puede ir antes que el 7, y los **cortes
> (paso 13)** requieren antes cambiar el proyecto a **Cosecha**.

### 1.5 Cifras clave que debes obtener al final

| Concepto | Valor |
| -------- | ----- |
| Superficie | 5 ha |
| Presupuesto | $250,000.00 |
| Costo de producción acumulado | **$66,560.00** |
| Presupuesto utilizado | 26.6 % |
| Costo por hectárea | $13,312.00 |
| Costo por kilogramo | $2.2187 (≈ $2.22) |
| Producción cosechada | 30,000 kg en 3 cortes y 4 lotes |
| Vendido / merma / disponible | 14,000 kg / 200 kg / 15,800 kg |
| Ventas | $196,000.00 |
| Cobrado | $196,000.00 |
| Por cobrar | $0.00 |
| Resultado estimado | **$129,440.00** |
| Flujo de efectivo | Ingresos $196,000 · Egresos $75,000 · Neto $121,000 |
| Gastos por pagar | $3,200 (flete) |
| Valor del inventario de insumos | $30,190.00 |

---

## 2. Escenario paso a paso

Cada paso indica dónde ingresar, qué botón usar, qué capturar, qué se muestra al guardar y qué comprobar.

### Paso 1 · Registrar el rancho

- **Dónde:** **Producción agrícola → Ranchos y parcelas**.
- **Botón:** **Nuevo rancho** y, al final, **Registrar rancho**.
- **Capturar:**

  | Campo | Valor |
  | ----- | ----- |
  | Nombre | Rancho Los Campos |
  | Clave | RLC-01 |
  | Superficie total (ha) | 12 |
  | Municipio | Irapuato |
  | Estado | Guanajuato |
  | Ubicación o referencia | Carretera Irapuato–Abasolo km 8 |

- **Se muestra:** Aviso de éxito. El rancho aparece en la tabla como **Activo**, con 0 parcelas.
- **Comprobar:** Indicador **Ranchos activos** = 1. En el detalle del rancho: **Superficie total** 12 ha, **Parcelada**
  0 ha.

### Paso 2 · Registrar la parcela

- **Dónde:** Detalle de **Rancho Los Campos**.
- **Botón:** **Nueva parcela** y **Registrar parcela**.
- **Capturar:**

  | Campo | Valor |
  | ----- | ----- |
  | Rancho | Rancho Los Campos |
  | Nombre | Parcela Norte |
  | Clave | PN-01 |
  | Superficie (ha) | 5 |
  | Sistema de riego | Goteo |
  | Tipo de suelo | Franco arcilloso |

- **Se muestra:** La parcela aparece en la tabla con **Superficie** 5 ha y **Disponible** 5 ha.
- **Comprobar:** En el rancho: **Parcelada** 5 ha y **Sin parcelar** 7 ha (12 − 5).

### Paso 3 · Crear el proyecto de jitomate

**3a. Cultivo.**
- **Dónde:** **Cultivos**.
- **Botón:** **Nuevo cultivo** y **Registrar cultivo**.
- **Capturar:** Cultivo «Jitomate», Variedad «Saladette», Ciclo (días) 120, Unidad de producción «Cajas».

**3b. Proyecto.**
- **Dónde:** **Proyectos**.
- **Botón:** **Nuevo proyecto** y **Crear proyecto**.
- **Capturar:**

  | Campo | Valor |
  | ----- | ----- |
  | Nombre del proyecto | Producción de jitomate |
  | Cultivo y variedad | Jitomate · Saladette |
  | Ciclo / temporada | Otoño-invierno 2026 |
  | Responsable | Tu usuario |
  | Inicio | 28/07/2026 |
  | Siembra | 12/08/2026 |
  | Cosecha estimada | 06/10/2026 |
  | Producción esperada (cajas) | 2000 |
  | Presupuesto total (MXN) | 250000 |

- **Se muestra:** El expediente del proyecto con folio **PRY-AAAA-0001**, estado **Planeación** y presupuesto
  $250,000.00.

**3c. Parcela del proyecto.**
- **Dónde:** Expediente del proyecto, tarjeta **Parcelas asignadas**.
- **Botón:** **Asignar parcela** y **Asignar**.
- **Capturar:** Parcela «Rancho Los Campos · Parcela Norte (5 ha libres)», **Superficie a asignar (ha)** 5.

**3d. Estado.**
- **Botón:** **Cambiar estado**, tres veces: **Preparación de suelo** → **Siembra** → **Desarrollo del cultivo**.
- **Capturar:** En la nota de Siembra, «Trasplante en Parcela Norte».

**Comprobar:**
- **Parcelas asignadas**: total 5 ha.
- En el rancho, la Parcela Norte tiene **Disponible** 0 ha.
- **Historial de estados** muestra los 3 cambios.
- El Dashboard muestra **Proyectos vigentes** 1 y **Superficie cultivada** 5 ha.

### Paso 4 · Establecer el presupuesto

- **Dónde:** **Finanzas → Presupuestos**, fila «Producción de jitomate».
- **Botón:** **Elaborar**, luego **Agregar partida** por cada renglón, y **Guardar presupuesto**.
- **Capturar:** Inicio del periodo 28/07/2026, Fin del periodo 04/01/2027, **Superficie (ha)** 5, y estas partidas:

  | Categoría | Concepto | Unidad | Cantidad | Costo unitario | Importe |
  | --------- | -------- | ------ | -------: | -------------: | ------: |
  | Semillas | Semilla de jitomate saladette | sobre | 30 | 1,000 | 30,000 |
  | Fertilizantes | Fertilización de fondo y fertirriego | lote | 1 | 45,000 | 45,000 |
  | Agroquímicos | Control fitosanitario | lote | 1 | 25,000 | 25,000 |
  | Riego | Energía y operación del riego | mes | 4 | 5,000 | 20,000 |
  | Mano de obra | Jornales y destajo de corte | lote | 1 | 60,000 | 60,000 |
  | Maquinaria | Preparación de terreno y labores | h | 50 | 600 | 30,000 |
  | Cosecha | Material de empaque | lote | 1 | 25,000 | 25,000 |
  | Transporte | Fletes a central de abasto | viaje | 5 | 3,000 | 15,000 |
  | | | | | **Presupuesto total** | **250,000** |

- **Se muestra:** El detalle del presupuesto con la **versión 1** como **Vigente**.
- **Comprobar:**
  - **Presupuesto** $250,000.00, **Costo acumulado** $0.00, **Presupuesto por ha** $50,000.00.
  - En **Presupuestos**, el proyecto aparece con 0 % utilizado.

### Paso 5 · Registrar insumos

**5a. Proveedores.**
- **Dónde:** **Operación → Inventario**, pestaña **Catálogos**, sección **Proveedores**.
- **Botón:** **Nuevo proveedor** y **Registrar proveedor**.
- **Capturar:** «Semillas y Agroinsumos del Bajío» y «Combustibles El Sauz».

**5b. Productos.**
- **Botón:** **Nuevo producto** y **Registrar producto**. Ningún producto se controla por lote en este escenario.
- **Capturar:**

  | Nombre | Categoría | Unidad de medida | Existencia mínima |
  | ------ | --------- | ---------------- | ----------------: |
  | Semilla jitomate saladette (sobre 1,000 semillas) | Semillas | Piezas | 2 |
  | Fertilizante 18-46-00 | Fertilizantes | Kilogramos (kg) | 100 |
  | Nitrato de calcio | Fertilizantes | Kilogramos (kg) | 100 |
  | Insecticida spirotetramat | Agroquímicos | Litros (l) | 5 |
  | Diésel | Combustibles | Litros (l) | 50 |

- **Se muestra:** Los 5 productos en **Existencias** con existencia 0 y la marca **Bajo mínimo**.
- **Comprobar:** Indicador **Productos activos** = 5.

### Paso 6 · Realizar entradas al inventario

**6a. Entradas.**
- **Dónde:** **Inventario**.
- **Botón:** **Registrar movimiento** con **Tipo** «Entrada por compra», y **Registrar**. Una entrada por producto.
- **Capturar:** Fecha 30/07/2026, Almacén «Almacén general».

  | Producto | Cantidad | Costo unitario | Valor | Proveedor | Factura / remisión |
  | -------- | -------: | -------------: | ----: | --------- | ------------------ |
  | Semilla jitomate saladette | 30 | $950 | $28,500 | Semillas y Agroinsumos del Bajío | FAC-A-1024 |
  | Fertilizante 18-46-00 | 1,000 kg | $18 | $18,000 | Semillas y Agroinsumos del Bajío | FAC-A-1024 |
  | Nitrato de calcio | 500 kg | $22 | $11,000 | Semillas y Agroinsumos del Bajío | FAC-A-1024 |
  | Insecticida spirotetramat | 20 l | $650 | $13,000 | Semillas y Agroinsumos del Bajío | FAC-A-1024 |
  | Diésel | 200 l | $24 | $4,800 | Combustibles El Sauz | FAC-D-3381 |
  | | | **Total** | **$75,300** | | |

- **Se muestra:** Antes de guardar, cada entrada muestra su **Valor estimado del movimiento**. Después, la existencia y el
  costo promedio de cada producto.
- **Comprobar:**
  - **Valor del inventario** = **$75,300.00**.
  - Ningún producto queda **Bajo mínimo**.
  - El expediente del proyecto sigue con costo $0: una compra no es costo hasta que se consume.

**6b. Pago al proveedor.** Es un egreso de dinero, no un costo.
- **Dónde:** **Finanzas → Flujo de efectivo**.
- **Botón:** **Registrar movimiento** y **Registrar**.
- **Capturar:**

  | Campo | Valor |
  | ----- | ----- |
  | Tipo | Pago a proveedor |
  | Fecha | 02/08/2026 |
  | Concepto | Pago factura FAC-A-1024 |
  | Importe | 70,500 |
  | Método de pago | Transferencia (SPEI) |
  | Proveedor | Semillas y Agroinsumos del Bajío |
  | Proyecto | General (sin proyecto) |
  | Referencia | SPEI 4471 |

- **Comprobar:**
  - **Egresos** del periodo = $70,500.
  - El costo del proyecto sigue en $0.
  - La factura del diésel ($4,800) queda sin pago registrado; esto es intencional.

### Paso 7 · Registrar consumo de insumos

- **Dónde:** **Inventario**.
- **Botón:** **Registrar movimiento** con **Tipo** «Salida por consumo», y **Registrar**.
- **Capturar:** En ambos casos, **Sale de** «Almacén general», **Proyecto** «PRY-AAAA-0001 · Producción de jitomate» y
  **Parcela** «Rancho Los Campos · Parcela Norte».

  | Fecha | Producto | Cantidad | Costo (al promedio) |
  | ----- | -------- | -------: | ------------------: |
  | 12/08/2026 | Semilla jitomate saladette | 25 | 25 × $950 = **$23,750** |
  | 13/08/2026 | Fertilizante 18-46-00 | 600 kg | 600 × $18 = **$10,800** |

- **Se muestra:** Existencias: semilla 5, fertilizante 400 kg.
- **Comprobar:**
  - **Detalle de costos** del proyecto: dos renglones de origen **Inventario**, que suman $34,550.
  - **Valor del inventario** = $75,300 − $34,550 = **$40,750**.

### Paso 8 · Asignar trabajadores (y sus jornadas)

**8a. Empleados.**
- **Dónde:** **Operación → Personal**, pestaña **Empleados**.
- **Botón:** **Nuevo empleado** y **Registrar empleado**.
- **Capturar:**

  | Nombre completo | Puesto | Tipo de trabajador | Tarifa por jornal |
  | --------------- | ------ | ------------------ | ----------------: |
  | Juan Pérez Hernández | Jornalero | Temporal (por ciclo) | $400 |
  | María López García | Jornalera | Temporal (por ciclo) | $400 |
  | Pedro Ramírez Soto | Tractorista | De planta | $450 |

**8b. Asignación.**
- **Dónde:** Pestaña **Asignaciones**.
- **Botón:** **Asignar a proyecto** y **Asignar**, una vez por trabajador.
- **Capturar:** Proyecto «Producción de jitomate», Parcela «Parcela Norte», Función «Labores culturales» (Pedro:
  «Tractorista»), **Desde** 11/08/2026.
- **Comprobar:** En el expediente, tarjeta **Operación**, aparecen los 3 en **Personal asignado**. El costo no cambia,
  porque la asignación no genera costo.

**8c. Cuadrilla.**
- **Dónde:** Pestaña **Cuadrillas**.
- **Botón:** **Nueva cuadrilla** y **Registrar cuadrilla**.
- **Capturar:** Nombre «Cuadrilla jitomate» con los 3 integrantes.

**8d. Jornadas.**
- **Botón:** **Jornada de cuadrilla** y **Registrar jornadas**, cinco veces.
- **Capturar:**
  - Cuadrilla «Cuadrilla jitomate».
  - Proyecto y Parcela Norte.
  - Labor realizada «Labores culturales».
  - Forma de pago **Jornal (por día)**, **Jornales por integrante** 1, **Pago por jornal** vacío (toma la tarifa de cada
    uno).
  - Los 3 integrantes marcados.
  - Fechas: **11/08, 22/08, 02/09, 13/09 y 24/09/2026**.
- **Cálculo:** 5 días × ($400 + $400 + $450) = 5 × $1,250 = **$6,250** (15 jornales).
- **Comprobar:**
  - **Jornadas** muestra 15 registros.
  - **Asistencia** muestra a los 3 como **Presente** en esas fechas.
  - El **Detalle de costos** tiene **Mano de obra** por $6,250.

### Paso 9 · Registrar actividades de maquinaria

**9a. Equipo.**
- **Dónde:** **Operación → Maquinaria**, pestaña **Equipos**.
- **Botón:** **Nuevo equipo** y **Registrar equipo**.
- **Capturar:**
  - Nombre «Tractor John Deere 5075E», Tipo Tractor, Clave TR-01, Estado Operativa.
  - Responsable «Pedro Ramírez Soto».
  - **Cobro habitual** Por hora, **Tarifa por hora (MXN)** 650.
  - Mantenimiento cada 250 h.

**9b. Uso.**
- **Dónde:** Pestaña **Uso por proyecto**.
- **Botón:** **Registrar uso** y **Registrar**.
- **Capturar:**

  | Campo | Valor |
  | ----- | ----- |
  | Equipo | Tractor John Deere 5075E |
  | Proyecto / Parcela | Producción de jitomate / Parcela Norte |
  | Fecha | 09/08/2026 |
  | Horas trabajadas | 6 |
  | Cobro | Por hora (tarifa vacía = $650) |
  | Operador | Pedro Ramírez Soto |
  | Actividad realizada | Barbecho y rastra |
  | Combustible utilizado (l) | 40 |
  | Surtido del almacén | Sí → Combustible «Diésel», Almacén «Almacén general» |

- **Cálculo:**
  - Maquinaria: 6 h × $650 = **$3,900**.
  - Combustible: 40 l × $24 = **$960**, como insumo del proyecto.
- **Comprobar:**
  - Uso con «Uso × tarifa» = $3,900.
  - El diésel baja a 160 l y aparece en **Movimientos** con la etiqueta **Desde bitácora**.
  - **Detalle de costos**: Maquinaria $3,900 e Inventario (diésel) $960.

### Paso 10 · Registrar actividades de riego

- **Dónde:** **Operación → Bitácoras**, pestaña **Riego**.
- **Botón:** **Riego** y **Registrar riego**, tres veces.
- **Capturar:**
  - Proyecto «Producción de jitomate», Parcela «Parcela Norte».
  - **Hora de inicio** 06:00, **Hora de término** 09:00.
  - **Sistema de riego** «El de la parcela» (Goteo).
  - **Agua utilizada** 120 m³.
  - **Responsable** «Juan Pérez Hernández».
  - Fechas: **17/08, 27/08 y 06/09/2026**.
- **Se muestra:** Cada riego con **Duración** 3 h y 120 m³.
- **Comprobar:**
  - Indicador **Agua registrada** = 360 m³ con el filtro de proyecto.
  - Los riegos aparecen en **Cronología**.
  - El costo no cambia, porque el riego no tiene costo propio: la energía se registra como gasto en el paso 12.

### Paso 11 · Registrar una aplicación agrícola documentada

- **Dónde:** **Bitácoras**.
- **Botón:** **Aplicación** y **Registrar aplicación**, dos veces.
- **Capturar:**

  | Campo | Aplicación 1 (fertirriego) | Aplicación 2 (insecticida) |
  | ----- | -------------------------- | -------------------------- |
  | Proyecto / Parcela | Producción de jitomate / Parcela Norte | Igual |
  | Fecha / Hora | 01/09/2026 · 07:00 | 16/09/2026 · 07:30 |
  | Producto del inventario | Nitrato de calcio | Insecticida spirotetramat |
  | Ingrediente activo | — | Spirotetramat |
  | Cantidad aplicada | 200 kg | 8 l |
  | Superficie tratada (ha) | 5 | 5 |
  | Descontar del almacén | Sí · Almacén general | Sí · Almacén general |
  | Número de lote | — | SP-2408 |
  | Responsable | María López García | Pedro Ramírez Soto |
  | Equipo utilizado | Sistema de goteo | Aspersora de mochila |
  | Reentrada (horas) | — | 24 |
  | Intervalo de seguridad (días) | — | 3 |
  | Observaciones | Fertirriego | Según etiqueta del producto |
  | Fotografías | Opcional | Una foto de la etiqueta |

  > Las cantidades son **datos ficticios del escenario**, no recomendaciones. La aplicación no recomienda dosis.

- **Cálculo:**
  - Nitrato: 200 × $22 = **$4,400**.
  - Insecticida: 8 × $650 = **$5,200**.
- **Comprobar:**
  - Existencias: nitrato 300 kg, insecticida 12 l.
  - Dos salidas con la etiqueta **Desde bitácora**.
  - La tabla de aplicaciones muestra el costo, la reentrada y el intervalo.
  - El ícono de cámara muestra la foto.
  - Inventario consumido en total: $23,750 + $10,800 + $960 + $4,400 + $5,200 = **$45,110**.

### Paso 12 · Registrar gastos

- **Dónde:** **Finanzas → Gastos**.
- **Botón:** **Registrar gasto**. El botón final es **Registrar y pagar** para el gasto 1 y **Registrar gasto** para el
  gasto 2.
- **Capturar:**

  | Campo | Gasto 1 | Gasto 2 |
  | ----- | ------- | ------- |
  | Tipo de gasto | Energía eléctrica | Fletes |
  | Categoría presupuestal | Riego | Transporte |
  | Concepto | Energía eléctrica para bombeo | Flete a central de abasto |
  | Fecha | 06/09/2026 | 26/10/2026 |
  | Importe | 4,500 | 3,200 |
  | Factura / comprobante | CFE-0925 | FL-0331 |
  | Método de pago | Transferencia (SPEI) | Por definir |
  | Asignación | Directo · Producción de jitomate | Directo · Producción de jitomate |
  | Ya está pagado | **Sí** · Fecha del pago 08/09/2026 | **No** |

- **Comprobar:**
  - **Gastos**: **Pagado** $4,500 y **Por pagar** $3,200.
  - **Flujo de efectivo**: egresos $70,500 + $4,500 = **$75,000**. El flete aparece en **Gastos por pagar**, no como
    egreso.
  - **Detalle de costos**: **Gastos** por $7,700. Ambos gastos son costo, aunque el flete no se ha pagado.

### Paso 13 · Registrar dos o más cortes de producción

**13a. Cambiar a Cosecha.** En el expediente, pulsa **Cambiar estado** → **Cosecha**. Sin este cambio, el proyecto no
aparece en **Registrar corte**.

**13b. Cortes.**
- **Dónde:** **Comercialización → Producción**.
- **Botón:** **Registrar corte** y **Registrar corte**, cuatro veces: tres cortes, uno de ellos con dos calidades.
- **Capturar:** Proyecto «Producción de jitomate», Parcela «Parcela Norte», **Unidad de medida** Cajas, **Peso neto por
  unidad (kg)** 20, **Responsable** «Juan Pérez Hernández».

  | # | Fecha de corte | Número de corte | Calidad | Cajas | kg |
  | - | -------------- | --------------- | ------- | ----: | -----: |
  | 1 | 06/10/2026 | vacío (→ 1) | Primera | 400 | 8,000 |
  | 2 | 16/10/2026 | vacío (→ 2) | Primera | 500 | 10,000 |
  | 3 | 16/10/2026 | **2** | Segunda | 150 | 3,000 |
  | 4 | 26/10/2026 | vacío (→ 3) | Primera | 450 | 9,000 |
  | | | | **Total** | **1,500** | **30,000** |

**13c. Destajo del corte.**
- **Dónde:** **Personal → Jornadas**.
- **Botón:** **Registrar jornada**.
- **Capturar:**
  - Trabajador «Cuadrilla / eventuales sin alta», Cuadrilla «Cuadrilla de corte».
  - Proyecto y Parcela Norte, fecha 16/10/2026.
  - Labor «Corte de jitomate».
  - **Destajo (por unidad)**: 300 unidades «caja» × $12 = **$3,600**.
- **Comprobar:** Mano de obra total = $6,250 + $3,600 = **$9,850**.

### Paso 14 · Crear lotes de cosecha

Cada corte por calidad genera su lote automáticamente al guardar.

- **Se muestra:**

  | Lote | Corte | Calidad | kg |
  | ---- | ----- | ------- | -----: |
  | LOT-AAAA-0001 | 1 | Primera | 8,000 |
  | LOT-AAAA-0002 | 2 | Primera | 10,000 |
  | LOT-AAAA-0003 | 2 | Segunda | 3,000 |
  | LOT-AAAA-0004 | 3 | Primera | 9,000 |

- **Merma.**
  - **Dónde:** **Producción → Inventario de producto**, lote LOT-AAAA-0004.
  - **Botón:** **Merma o ajuste** y **Registrar**.
  - **Capturar:** Tipo «Merma», Cantidad 200 kg, Fecha 27/10/2026, Justificación «Fruta dañada en selección».
- **Comprobar:**
  - **Inventario de producto**: 8,000 + 10,000 + 3,000 + 8,800 = **29,800 kg** disponibles.
  - **Indicadores** del periodo 01/10–31/10: **Producción del periodo** 30,000 kg, **Rendimiento** 6,000 kg/ha
    (30,000 ÷ 5), **Cortes registrados** 3.
  - La trazabilidad de LOT-AAAA-0002 muestra el **Historial agrícola hasta el corte**: riegos, aplicaciones y labores.

### Paso 15 · Registrar un cliente

- **Dónde:** **Comercialización → Clientes**.
- **Botón:** **Nuevo cliente** y **Registrar cliente**.
- **Capturar:**

  | Campo | Valor |
  | ----- | ----- |
  | Nombre o razón social | Comercializadora del Centro |
  | Tipo de cliente | Mayorista |
  | Días de crédito | 30 |
  | Contacto | Lic. Ramón Aguilar |
  | Teléfono | 4621000000 |

- **Comprobar:** El cliente aparece **Activo**. En **Nueva venta** se ofrece como «Comercializadora del Centro · 30 días».

### Paso 16 · Realizar una venta

- **Dónde:** **Comercialización → Ventas**.
- **Botón:** **Nueva venta**, luego **Agregar partida**, y **Guardar borrador**. La venta se confirma en el paso 17,
  después de recibir el anticipo.
- **Capturar:** Cliente «Comercializadora del Centro», **Fecha de venta** 18/10/2026, **Vencimiento del pago** vacío
  (= 17/11/2026, por los 30 días de crédito), y estas partidas:

  | Lote de producción | Unidad | Cantidad | Kg por unidad | Precio por caja | Importe |
  | ------------------ | ------ | -------: | ------------: | --------------: | ------: |
  | LOT-AAAA-0001 (Primera) | Cajas | 400 | 20 | $280 | $112,000 |
  | LOT-AAAA-0002 (Primera) | Cajas | 300 | 20 | $280 | $84,000 |
  | | | **700 (14,000 kg)** | | **Total de la venta** | **$196,000** |

- **Se muestra:** La venta **VTA-AAAA-0001** en estado **Borrador**.
- **Comprobar:** El borrador **no** descuenta producto: LOT-AAAA-0001 sigue en 8,000 kg y no hay cuenta por cobrar.

### Paso 17 · Registrar un anticipo (y confirmar la venta)

**17a. Anticipo.**
- **Dónde:** Detalle de la venta VTA-AAAA-0001.
- **Botón:** **Registrar anticipo** y **Registrar anticipo**.
- **Capturar:** Importe 50,000, Fecha 18/10/2026, Método «Transferencia (SPEI)», Referencia «SPEI 9120».
- **Comprobar:**
  - **Flujo de efectivo**: **Ingresos** $50,000 (tipo «Anticipo de cliente»).
  - **Cobranza → Anticipos pendientes de aplicar**: $50,000.

**17b. Confirmar.**
- **Botón:** **Confirmar venta**, y confirmar en la ventana. La ventana indica que se descontarán 14,000 kg.
- **Se muestra:** Estado **Confirmada**. **Saldo pendiente** $196,000 y **Anticipos sin aplicar** $50,000.
- **Comprobar:**
  - LOT-AAAA-0001 queda en 0 kg disponibles y LOT-AAAA-0002 en 4,000 kg.
  - Producción disponible total: 29,800 − 14,000 = **15,800 kg**.
  - Antes de aplicar el anticipo, la venta **no está cobrada** ($0), aunque el dinero ya se recibió.

**17c. Aplicar.**
- **Dónde:** Tarjeta **Pagos y anticipos**.
- **Botón:** **Aplicar** y **Aplicar al saldo**.
- **Capturar:** Importe a aplicar 50,000, Fecha 20/10/2026.
- **Comprobar:**
  - **Total pagado** $50,000, **Saldo pendiente** $146,000, estado **Parcialmente pagada**.
  - El flujo de efectivo **no** cambia: el dinero se contó al recibirse, no al aplicarse.

### Paso 18 · Registrar un pago parcial

- **Dónde:** Detalle de la venta, o **Cobranza → Ventas con saldo**.
- **Botón:** **Registrar pago** y **Registrar pago**.
- **Capturar:** Tipo «Pago (parcial o total)», Importe 60,000, Fecha 28/10/2026, Método «Transferencia (SPEI)»,
  Referencia «SPEI 9876». Opcionalmente, un comprobante PDF en **Comprobante (opcional)**.
- **Se muestra:** **Total pagado** $110,000, **Saldo pendiente** **$86,000**, **Recuperación** 56.1 %, estado
  **Parcialmente pagada**.
- **Comprobar:**
  - Expediente del proyecto: **Valor vendido** $196,000, **Cobrado** $110,000, **Saldo por cobrar** $86,000.
  - **Resultado estimado** $129,440 (ventas − costo).
  - **Flujo de efectivo**: ingresos $110,000.

  *Estas cifras son las verificadas por el escenario automatizado.*

### Paso 19 · Registrar el pago final

- **Dónde:** Detalle de la venta.
- **Botón:** **Registrar pago**, luego **Liquidar** (llena $86,000), y **Registrar pago**.
- **Capturar:** Fecha 03/11/2026, Método «Transferencia (SPEI)», Referencia «SPEI 10233».
- **Se muestra:**
  - Antes de guardar: «Con este pago la venta queda liquidada.».
  - Después: **Total pagado** $196,000, **Saldo pendiente** $0.00, **Recuperación** 100 %, estado **Pagada**.
- **Comprobar:**
  - La venta ya no aparece en **Cobranza → Ventas con saldo**.
  - El cliente queda sin saldo pendiente.
  - **Flujo de efectivo**: ingresos $196,000.
  - Intentar otro pago de $1 se rechaza, porque excede el saldo.

### Paso 20 · Consultar costos y rentabilidad

- **Dónde:**
  - Expediente del proyecto.
  - **Finanzas → Presupuestos** (detalle del proyecto).
  - **Rentabilidad**.
  - **Dashboard financiero**.
  - **Flujo de efectivo** (periodo 01/07/2026–hoy).
  - **Reportes financieros → Estado financiero**.
- **Botón:** Ninguno; solo consulta. Opcionalmente, descarga **Excel** o **PDF** del reporte.
- **Comprobar:** Usa la hoja de la sección 3.

---

## 3. Hoja de comprobación final

### 3.1 Costo de producción del proyecto

| Origen (Detalle de costos) | Registros | Importe |
| -------------------------- | --------- | ------: |
| Inventario: semilla | 25 × $950 | 23,750.00 |
| Inventario: fertilizante 18-46-00 | 600 × $18 | 10,800.00 |
| Inventario: nitrato de calcio (aplicación) | 200 × $22 | 4,400.00 |
| Inventario: insecticida (aplicación) | 8 × $650 | 5,200.00 |
| Inventario: diésel (maquinaria) | 40 × $24 | 960.00 |
| **Subtotal insumos** | | **45,110.00** |
| Maquinaria: tractor | 6 h × $650 | 3,900.00 |
| Mano de obra: jornales | 5 días × $1,250 | 6,250.00 |
| Mano de obra: destajo de corte | 300 cajas × $12 | 3,600.00 |
| Gastos: energía eléctrica | — | 4,500.00 |
| Gastos: flete | — | 3,200.00 |
| **Costo de producción acumulado** | | **66,560.00** |

**No son costo del proyecto:**
- Las compras al almacén ($75,300).
- El pago al proveedor ($70,500).
- El insumo que quedó en almacén ($30,190).
- Los riegos.
- Las asignaciones de personal.

### 3.2 Presupuesto contra real

| Categoría | Presupuesto | Real | % utilizado |
| --------- | ----------: | ---: | ----------: |
| Semillas | 30,000 | 23,750 | 79.2 % (por encima del umbral de **Aviso**, 70 %) |
| Fertilizantes | 45,000 | 15,200 | 33.8 % |
| Agroquímicos | 25,000 | 5,200 | 20.8 % |
| Combustible | 0 | 960 | Sin presupuesto |
| Riego | 20,000 | 4,500 | 22.5 % |
| Mano de obra | 60,000 | 9,850 | 16.4 % |
| Maquinaria | 30,000 | 3,900 | 13.0 % |
| Cosecha | 25,000 | 0 | 0 % |
| Transporte | 15,000 | 3,200 | 21.3 % |
| **Total** | **250,000** | **66,560** | **26.6 %** |

**Presupuesto restante:** $183,440.00.

### 3.3 Indicadores del proyecto

| Indicador | Cálculo | Esperado |
| --------- | ------- | -------: |
| Costo por hectárea | 66,560 ÷ 5 | $13,312.00 |
| Costo por kilogramo | 66,560 ÷ 30,000 | $2.2187 |
| Costo por tonelada | 66,560 ÷ 30 | $2,218.67 |
| Rendimiento | 30,000 kg ÷ 5 ha | 6,000 kg/ha |
| Producción cosechada | 1,500 cajas × 20 kg | 30,000 kg |
| Vendido | 700 cajas × 20 kg | 14,000 kg |
| Mermas y ajustes | — | 200 kg |
| Disponible | 30,000 − 14,000 − 200 | 15,800 kg |
| Ventas reconocidas | 700 × $280 | $196,000.00 |
| Cobrado | 50,000 + 60,000 + 86,000 | $196,000.00 |
| Por cobrar | 196,000 − 196,000 | $0.00 |
| Resultado estimado | 196,000 − 66,560 | **$129,440.00** |
| Producto en existencia (referencia, a costo) | 15,800 × 2.2187 | ≈ $35,055 |

### 3.4 Inventario de insumos al final

| Producto | Comprado | Consumido | Existencia | Valor |
| -------- | -------: | --------: | ---------: | ----: |
| Semilla jitomate saladette | 30 | 25 | 5 | 4,750 |
| Fertilizante 18-46-00 | 1,000 kg | 600 kg | 400 kg | 7,200 |
| Nitrato de calcio | 500 kg | 200 kg | 300 kg | 6,600 |
| Insecticida spirotetramat | 20 l | 8 l | 12 l | 7,800 |
| Diésel | 200 l | 40 l | 160 l | 3,840 |
| **Total** | **$75,300** | **$45,110** | | **$30,190** |

Comprobación: compras ($75,300) = consumos ($45,110) + existencias ($30,190).

### 3.5 Flujo de efectivo (01/07/2026 – hoy)

| Fecha | Movimiento | Ingreso | Egreso |
| ----- | ---------- | ------: | -----: |
| 02/08 | Pago a proveedor FAC-A-1024 | | 70,500 |
| 08/09 | Pago de energía eléctrica | | 4,500 |
| 18/10 | Anticipo de cliente | 50,000 | |
| 28/10 | Cobro de venta (parcial) | 60,000 | |
| 03/11 | Cobro de venta (liquidación) | 86,000 | |
| | **Totales** | **196,000** | **75,000** |
| | **Flujo neto** | | **121,000** |

**Pendientes que muestra la aplicación:**
- **Por pagar**: $3,200 (el flete).
- **Por cobrar**: $0.

La factura del diésel ($4,800) también está sin pagar, pero **no aparece** en «Por pagar»: es una compra de almacén, no
un gasto registrado, y ese indicador solo incluye gastos. Su pago se registraría como «Pago a proveedor» en **Flujo de
efectivo**.

### 3.6 Diferencias que el escenario demuestra

- **Venta ≠ cobro.**
  - Tras el paso 17b había $196,000 vendidos y $0 cobrados, con $50,000 de anticipo recibido.
  - Tras el paso 18: $110,000 cobrados.
  - Tras el paso 19: $196,000 cobrados.
- **Cobro ≠ resultado.** El resultado ($129,440) no depende de cuánto se ha cobrado.
- **Compra ≠ costo.** $75,300 comprados, pero solo $45,110 son costo, porque es lo consumido.
- **Costo ≠ egreso.** El flete es costo ($3,200), pero todavía no es egreso.
- **Anticipo.** Es ingreso de efectivo el 18/10, pero cuenta como cobro de la venta hasta el 20/10, al aplicarse.

---

## 4. Registro de la ejecución

| Paso | Fecha de ejecución | Ejecutó | ¿Coincide con lo esperado? | Observaciones |
| ---- | ------------------ | ------- | -------------------------- | ------------- |
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |
| 6 | | | | |
| 7 | | | | |
| 8 | | | | |
| 9 | | | | |
| 10 | | | | |
| 11 | | | | |
| 12 | | | | |
| 13 | | | | |
| 14 | | | | |
| 15 | | | | |
| 16 | | | | |
| 17 | | | | |
| 18 | | | | |
| 19 | | | | |
| 20 | | | | |

**Estado del escenario manual: Pendiente.** Nadie lo ha capturado todavía paso a paso desde la pantalla.

**Lo que sí está verificado (5 de noviembre de 2026):**

1. **Cálculos.** Todas las cifras de la sección 3 se recalcularon a mano y cuadran: costos (45,110 + 21,450 = 66,560),
   presupuesto (250,000 − 66,560 = 183,440), inventario (75,300 = 45,110 + 30,190), flujo (196,000 − 75,000 = 121,000)
   y resultado (196,000 − 66,560 = 129,440).
2. **Integración automatizada.** La misma secuencia de datos, hasta el paso 18, la ejecuta
   `npm run test:integration` (67 de 67 pruebas ✅).
3. **Lectura en pantalla.** `npm run demo:jitomate` carga la organización «Agropecuaria Los Campos · Escenario jitomate»
   con el escenario hasta el paso 18. Se abrió como J-PROP y la aplicación mostró:

   | Pantalla | Cifra en la aplicación | Esperado (hasta el paso 18) | ¿Coincide? |
   | -------- | ---------------------- | --------------------------- | :--------: |
   | Rentabilidad | Costo acumulado $66,560.00 · $13,312.00/ha · $2.22/kg | $66,560 · $13,312 · $2.2187 | ✅ |
   | Rentabilidad | Producción 30,000 kg · 6,000 kg/ha | 30,000 kg · 6,000 kg/ha | ✅ |
   | Rentabilidad | Ventas $196,000.00 · Cobrado $110,000.00 · Por cobrar $86,000.00 | 196,000 · 110,000 · 86,000 | ✅ |
   | Rentabilidad | Resultado $129,440.00 · Existencia 15,800 kg ($35,054.93 a costo) | 129,440 · ≈ $35,055 | ✅ |
   | Inventario | Valor del inventario $30,190.00 (5 productos, mismas existencias de 3.4) | $30,190 | ✅ |
   | Producción | Vendido 14,000 kg · Mermas 200 kg · Disponible 15,800 kg | 14,000 · 200 · 15,800 | ✅ |
   | Flujo de efectivo (desde 01/07/2026) | Ingresos $110,000 · Egresos $75,000 · Neto $35,000 · Por pagar $3,200 | 110,000 · 75,000 · 35,000 · 3,200 | ✅ |

   Evidencias: `evidencias/esc-rentabilidad.png`, `esc-inventario.png`, `esc-produccion.png`, `esc-flujo.png` y
   `esc-expediente.png`. Tras el paso 19 (pago de $86,000), Cobrado y Flujo pasan a $196,000 y Por cobrar a $0, como
   indica la sección 1.5.

   El script de demostración usa algunos datos distintos a los de este documento (por ejemplo, el rancho se llama
   «Rancho El Mirador» y algunas fechas cambian un día). Las cifras no cambian.

**Al terminar** en un entorno local, ejecuta `npm run db:reset` si quieres borrar los datos de prueba. En un entorno
compartido de pruebas, deja la organización tal cual o pide al administrador de la base de datos que la elimine. No
existe opción para eliminar una organización desde la aplicación.
