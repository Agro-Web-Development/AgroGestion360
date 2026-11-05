# Guía de Pruebas Funcionales - AgroGestión 360

Versión piloto · noviembre de 2026

Esta guía sirve para comprobar **manualmente**, desde la pantalla, que cada módulo de AgroGestión 360 funciona. Cada
prueba indica qué preparar, qué datos usar, qué pasos seguir y qué debe ocurrir. Quien la ejecuta anota el resultado
obtenido y el estado.

Los nombres de pantallas, botones y campos coinciden con la aplicación y con el
[Manual de Usuario](../manual/manual_usuario_agrogestion_360.md).

---

## 1. Cómo usar esta guía

### 1.1 Estados de una prueba

| Estado | Cuándo usarlo |
| ------ | ------------- |
| **Pendiente** | La prueba aún no se ejecuta. |
| **Aprobada** | Se ejecutó y el resultado obtenido coincide con el esperado. |
| **Rechazada** | Se ejecutó y el resultado no coincide. Describe la diferencia en *Observaciones*. |
| **Bloqueada** | No se pudo ejecutar, por ejemplo porque falló una prueba previa, falta un dato o el entorno no lo permite. Indica la causa. |
| **Parcial** | Se ejecutaron solo algunos pasos y todos dieron el resultado esperado. Los pasos restantes siguen pendientes y se indican en *Observaciones*. |

**Estado al 5 de noviembre de 2026.** Se ejecutaron **32 pruebas** desde la pantalla, con clics reales en un navegador
Chromium automatizado (Playwright, 1440 × 900 px), contra la compilación de producción y la base local con datos de
demostración: **25 aprobadas**, **7 parciales**, **0 rechazadas**. Las otras 46 siguen **Pendientes**. Cada resultado
anota la fecha y la captura de evidencia, guardada en [`evidencias/`](evidencias/). El detalle consolidado está en la
[Matriz de resultados](matriz_resultados_pruebas.md).

Algunas pruebas se ejecutaron con datos equivalentes (por ejemplo, nombres con un sufijo numérico como «Rancho Los
Campos 5029») porque la base no se reinició antes de la ejecución. Cuando la variación importa, se indica en el
resultado. Solo se marca «Aprobada» una prueba que se ejecutó y verificó.

En *Observaciones* se indica, cuando existe, la **prueba automatizada** que cubre la misma regla. Esas pruebas se
ejecutaron el 5 de noviembre de 2026 con estos resultados:
- Unitarias: 145 de 145.
- Base de datos y permisos: 450 de 450.
- Integración con usuarios reales: 67 de 67.
- Navegador (Playwright, escritorio y móvil): 32 de 32.

Son un respaldo técnico, **no sustituyen** la prueba manual: comprueban la lógica, no la pantalla.

### 1.2 Cómo registrar el resultado

Cada prueba termina con una tabla para llenar:

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| *Qué ocurrió realmente (mensaje, cifra, pantalla)* | Pendiente → Aprobada / Rechazada / Bloqueada | *Fecha, quién ejecutó, navegador, capturas, diferencias* |

### 1.3 Entorno de prueba

1. **Instalación local:** `npm install`, `npm run db:start` y `.env.local` configurado (ver `README.md`).
2. **Datos limpios:** ejecuta `npm run db:reset` antes de empezar. Las cifras de esta guía corresponden a los datos de
   demostración recién cargados. Muchas pruebas modifican datos, así que conviene ejecutarlas en el orden indicado.
3. **Segunda organización:** ejecuta `npm run demo:jitomate`. Carga la organización «Agropecuaria Los Campos · Escenario
   jitomate», que tiene usuarios de los roles Almacén y Finanzas y ventas, y sirve para las pruebas de separación entre
   organizaciones.
4. **Servidor:**
   - Para las pruebas en general: `npm run dev` (http://localhost:3000).
   - Para las pruebas PWA y sin conexión (sección 14): `npm run build && npm start`, porque el service worker solo se
     activa en la compilación de producción.
5. **Correos:** los correos de invitación y recuperación llegan a Mailpit (http://127.0.0.1:54324).
6. **Navegador:** Chrome actualizado en computadora. Para las pruebas móviles, Chrome en Android o Safari en iPhone.

### 1.4 Usuarios de prueba

Las contraseñas de los usuarios de demostración están en `README.md` (sección *Usuarios de demostración*). No se
repiten aquí.

| Alias en esta guía | Usuario | Rol | Organización |
| ------------------ | ------- | --- | ------------ |
| **PROP** | propietario@demo.agrogestion360.mx (Laura Méndez Ruiz) | Propietario | Agropecuaria Los Campos |
| **AGRO** | agronomo@demo.agrogestion360.mx (Ing. Carlos Herrera) | Agrónomo | Agropecuaria Los Campos |
| **CAMPO** | campo@demo.agrogestion360.mx (José Luis Ramírez) | Supervisor de campo | Agropecuaria Los Campos |
| **CONS** | consulta@demo.agrogestion360.mx (Ana Sofía Torres) | Consulta | Agropecuaria Los Campos |
| **J-PROP** | jitomate.propietario@demo.agrogestion360.mx | Propietario | … · Escenario jitomate |
| **J-ALM** | jitomate.almacen@demo.agrogestion360.mx | Almacén | … · Escenario jitomate |
| **J-FIN** | jitomate.finanzas@demo.agrogestion360.mx | Finanzas y ventas | … · Escenario jitomate |

### 1.5 Datos de demostración usados

Datos de la organización «Agropecuaria Los Campos», recién cargada con `npm run db:reset`:

| Tipo | Datos |
| ---- | ----- |
| Proyectos | PRY-2026-0001 Maíz blanco (Desarrollo) · PRY-2026-0002 Jitomate saladette (Desarrollo) · **PRY-2026-0003 Brócoli exportación (Cosecha)** · PRY-2026-0004 Sorgo escobero (Planeación) |
| Parcelas | El Mezquite: **Parcela Norte 25 ha (12 asignadas, 13 libres)**, Parcela Sur 30 ha, El Bajío 18.5 ha · La Esperanza: Lote 1 20 ha, Lote 2 22 ha |
| Cultivos | Brócoli · Avenger, **Jitomate · Saladette**, Maíz · Blanco H-377, Sorgo · Escobero |
| Insumos (Almacén general) | **Urea 46 %: 5,000 kg** · Diésel 4,405 l · Fosfato DAP 300 kg (bajo mínimo) · Fungicida clorotalonil 34 l (por lote) |
| Almacenes | Almacén general · Bodega La Esperanza |
| Lotes de producto | **LOT-2026-0004: 18,000 kg disponibles** · LOT-2026-0005: 4,000 kg · LOT-2026-0001: 1,850 kg |
| Ventas | VTA-2026-0001 (saldo $142,000) · VTA-2026-0002 (pagada) · **VTA-2026-0003 Comercializadora Central de Abasto, $44,500 sin pagar** · VTA-2026-0004 (borrador) |
| Equipos | Tractor John Deere 6110 ($650/h) y otros 3 |
| Empleados | 6 empleados, por ejemplo Miguel Ortega Ruiz ($400/jornal) · Cuadrilla La Esperanza |

### 1.6 Resumen de pruebas

| ID | Prueba | Módulo | Estado |
| -- | ------ | ------ | ------ |
| AUT-01 | Inicio de sesión correcto | Autenticación | Aprobada |
| AUT-02 | Inicio de sesión incorrecto | Autenticación | Aprobada |
| AUT-03 | Cierre de sesión | Autenticación | Aprobada |
| AUT-04 | Recuperación de contraseña | Autenticación | Pendiente |
| AUT-05 | Acceso según roles | Autenticación | Parcial |
| AUT-06 | Registro de cuenta y creación de organización | Autenticación | Pendiente |
| AUT-07 | Invitar usuario y aceptar la invitación | Usuarios | Pendiente |
| AUT-08 | Actualizar perfil y contraseña | Perfil | Pendiente |
| GEN-01 | Dashboard y notificaciones | General | Aprobada |
| CAT-01 | Registrar rancho y parcela | Ranchos y parcelas | Aprobada |
| CAT-02 | Superficie de parcelas mayor a la del rancho | Ranchos y parcelas | Aprobada |
| CAT-03 | Registrar cultivo | Cultivos | Aprobada |
| PRO-01 | Crear proyecto | Proyectos | Aprobada |
| PRO-02 | Editar proyecto | Proyectos | Pendiente |
| PRO-03 | Consultar proyecto (expediente) | Proyectos | Pendiente |
| PRO-04 | Asignar parcelas | Proyectos | Parcial |
| PRO-05 | Asignar más superficie de la disponible | Proyectos | Aprobada |
| PRO-06 | Cambiar estado | Proyectos | Aprobada |
| PRO-07 | Cancelar proyecto con motivo | Proyectos | Aprobada |
| INV-01 | Crear producto | Inventario | Aprobada |
| INV-02 | Registrar entrada | Inventario | Aprobada |
| INV-03 | Registrar salida (consumo a proyecto) | Inventario | Aprobada |
| INV-04 | Consultar existencia | Inventario | Pendiente |
| INV-05 | Salida superior al inventario disponible | Inventario | Aprobada |
| INV-06 | Consultar historial y anular movimiento | Inventario | Aprobada |
| INV-07 | Transferencia entre almacenes | Inventario | Aprobada |
| BIT-01 | Registrar riego | Bitácoras | Aprobada |
| BIT-02 | Registrar aplicación con descuento de almacén | Bitácoras | Pendiente |
| BIT-03 | Registrar actividad | Bitácoras | Pendiente |
| BIT-04 | Consultar historial y cronología | Bitácoras | Pendiente |
| BIT-05 | Cancelar aplicación (devuelve el producto) | Bitácoras | Pendiente |
| MAQ-01 | Registrar equipo | Maquinaria | Pendiente |
| MAQ-02 | Registrar utilización y asignar a proyecto | Maquinaria | Pendiente |
| MAQ-03 | Más de 24 h de uso en un día | Maquinaria | Pendiente |
| MAQ-04 | Registrar mantenimiento | Maquinaria | Pendiente |
| RH-01 | Registrar trabajador | Personal | Pendiente |
| RH-02 | Asignar trabajador | Personal | Pendiente |
| RH-03 | Registrar jornada | Personal | Pendiente |
| RH-04 | Segundo jornal el mismo día | Personal | Parcial |
| RH-05 | Consultar costo de mano de obra | Personal | Pendiente |
| PRD-01 | Registrar corte | Producción | Pendiente |
| PRD-02 | Crear lote (dos calidades en un corte) | Producción | Pendiente |
| PRD-03 | Consultar producción disponible | Producción | Parcial |
| PRD-04 | Registrar merma | Producción | Pendiente |
| PRD-05 | Vender más producción de la disponible | Producción / Ventas | Aprobada |
| VEN-01 | Registrar cliente | Ventas | Aprobada |
| VEN-02 | Crear venta (borrador) | Ventas | Pendiente |
| VEN-03 | Agregar varios productos | Ventas | Pendiente |
| VEN-04 | Confirmar venta | Ventas | Pendiente |
| VEN-05 | Registrar entrega | Ventas | Pendiente |
| VEN-06 | Consultar historial comercial | Ventas | Pendiente |
| PAG-01 | Registrar pago con comprobante | Cobranza | Pendiente |
| PAG-02 | Registrar pago parcial | Cobranza | Aprobada |
| PAG-03 | Registrar liquidación | Cobranza | Parcial |
| PAG-04 | Consultar saldo pendiente | Cobranza | Aprobada |
| PAG-05 | Pago superior al saldo | Cobranza | Aprobada |
| PAG-06 | Anticipo y su aplicación | Cobranza | Pendiente |
| FIN-01 | Crear presupuesto | Presupuestos | Pendiente |
| FIN-02 | Registrar gasto | Gastos | Pendiente |
| FIN-03 | Registrar gasto compartido | Gastos | Pendiente |
| FIN-04 | Consultar costos | Finanzas | Pendiente |
| FIN-05 | Comparar presupuesto contra gasto | Presupuestos | Pendiente |
| FIN-06 | Consultar rentabilidad | Rentabilidad | Aprobada |
| FIN-07 | Flujo de efectivo | Flujo de efectivo | Pendiente |
| REP-01 | Reportes operativos y descarga CSV | Reportes | Aprobada |
| REP-02 | Reportes financieros y descarga CSV, Excel y PDF | Reportes | Parcial |
| SEG-01 | Acceso con diferentes roles | Seguridad | Pendiente |
| SEG-02 | Información de otra organización | Seguridad | Parcial |
| SEG-03 | Operación sin autorización | Seguridad | Pendiente |
| SEG-04 | Protección de archivos | Seguridad | Pendiente |
| SEG-05 | Desactivar usuario | Seguridad | Pendiente |
| PWA-01 | Instalar aplicación | PWA | Pendiente |
| PWA-02 | Abrir la aplicación instalada | PWA | Pendiente |
| PWA-03 | Registrar información sin conexión | Sin conexión | Pendiente |
| PWA-04 | Recuperar conexión y sincronizar | Sin conexión | Pendiente |
| PWA-05 | Comprobar que no existan duplicados | Sin conexión | Pendiente |
| PWA-06 | Consultar registros pendientes o fallidos | Sin conexión | Pendiente |
| PWA-07 | Revisión y descarte en Sincronización | Sincronización | Pendiente |

**Total:** 78 pruebas · Aprobadas: 25 · Parciales: 7 · Rechazadas: 0 · Bloqueadas: 0 · Pendientes: 46

---

## 2. Pruebas de autenticación y acceso

### AUT-01 · Inicio de sesión correcto

- **Módulo:** Autenticación
- **Objetivo:** Comprobar que un usuario registrado entra con su correo y contraseña.
- **Requisitos previos:** Servidor activo. Sesión cerrada.
- **Datos de prueba:** Usuario PROP.
- **Pasos:**
  1. Abre http://localhost:3000. Debe aparecer **Bienvenido de nuevo**.
  2. Captura **Correo electrónico** y **Contraseña** de PROP.
  3. Pulsa **Iniciar sesión**.
- **Resultado esperado:**
  - Se abre el **Dashboard** con el saludo «Hola, Laura».
  - La barra superior muestra «Agropecuaria Los Campos» con la etiqueta **Demostración**.
  - El menú de usuario muestra el rol «Propietario».

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| Se abre el Dashboard con «Hola, Laura»; barra superior con «Agropecuaria Los Campos» y la etiqueta Demostración. | **Aprobada** | 05/11/2026 · Playwright (Chromium 1440×900) · compilación de producción. Evidencia: `evidencias/aut-01.png`. Automatizada: `tests/e2e/auth.spec.ts` ✅. |

### AUT-02 · Inicio de sesión incorrecto

- **Módulo:** Autenticación
- **Objetivo:** Comprobar que se rechazan credenciales erróneas y datos incompletos.
- **Requisitos previos:** Sesión cerrada.
- **Datos de prueba:**
  - Correo de PROP con la contraseña «Incorrecta123».
  - Correo «correo-invalido».
- **Pasos:**
  1. Captura el correo de PROP y la contraseña «Incorrecta123». Pulsa **Iniciar sesión**.
  2. Borra la contraseña y pulsa **Iniciar sesión**.
  3. Escribe «correo-invalido» en **Correo electrónico** y pulsa **Iniciar sesión**.
- **Resultado esperado:**
  1. Aviso rojo «Correo o contraseña incorrectos.» y no se entra.
  2. Debajo del campo aparece «Ingresa tu contraseña».
  3. Debajo del campo aparece «Ingresa un correo electrónico válido».

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| 1) Aviso «Correo o contraseña incorrectos.» 2) «Ingresa tu contraseña» 3) «Ingresa un correo electrónico válido». No se entra. | **Aprobada** | 05/11/2026 · Playwright (Chromium 1440×900) · compilación de producción. Evidencia: `evidencias/aut-02.png`. Automatizada: integración «rechaza una contraseña incorrecta» ✅. |

### AUT-03 · Cierre de sesión

- **Módulo:** Autenticación
- **Objetivo:** Comprobar que al cerrar sesión ya no se puede entrar a pantallas internas.
- **Requisitos previos:** AUT-01 aprobada; sesión iniciada como PROP.
- **Datos de prueba:** —
- **Pasos:**
  1. Pulsa el **Menú de usuario** y elige **Cerrar sesión**.
  2. Escribe en la barra de direcciones http://localhost:3000/dashboard.
- **Resultado esperado:**
  1. Regresa a **Bienvenido de nuevo**.
  2. En lugar del dashboard, se redirige al inicio de sesión. La dirección incluye `?next=%2Fdashboard`.
  3. Al iniciar sesión de nuevo, se abre directamente el Dashboard.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| Regresa a «Bienvenido de nuevo». /dashboard redirige a `/login?next=%2Fdashboard`. | **Aprobada** | 05/11/2026 · Playwright (Chromium 1440×900) · compilación de producción. Recorrido HTTP del 5-nov: sin sesión, `/dashboard` redirige a `/login?next=%2Fdashboard`. |

### AUT-04 · Recuperación de contraseña

- **Módulo:** Autenticación
- **Objetivo:** Comprobar el flujo completo de restablecimiento de contraseña.
- **Requisitos previos:** Mailpit accesible. Sesión cerrada.
- **Datos de prueba:**
  - Usuario CONS.
  - Nueva contraseña «Prueba2026x».
  - Correo inexistente «nadie@ejemplo.mx».
- **Pasos:**
  1. En el inicio de sesión pulsa **¿Olvidaste tu contraseña?**.
  2. Captura el correo de CONS y pulsa **Enviar enlace**.
  3. Abre Mailpit y el correo recibido. Pulsa el enlace.
  4. En **Crea tu nueva contraseña** captura «Prueba2026x» dos veces y guarda.
  5. Cierra sesión e inicia con la contraseña nueva.
  6. Repite el paso 2 con «nadie@ejemplo.mx».
  7. Al terminar, restablece la contraseña original de CONS o ejecuta `npm run db:reset`.
- **Resultado esperado:**
  - Paso 2: «Si el correo está registrado, recibirás un enlace para restablecer tu contraseña».
  - Paso 4: la contraseña se actualiza.
  - Paso 5: se entra con la nueva contraseña.
  - Paso 6: el mismo mensaje que en el paso 2, pero no llega ningún correo.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| | Pendiente | No verificado en el análisis (Anexo A del manual). El correo llega en inglés (plantilla estándar). |

### AUT-05 · Acceso según roles

- **Módulo:** Autenticación / Permisos
- **Objetivo:** Comprobar que cada rol ve las pantallas y botones que le corresponden.
- **Requisitos previos:** Ninguno.
- **Datos de prueba:** Usuarios PROP, AGRO, CAMPO y CONS.
- **Pasos:** con cada usuario, abre las pantallas de la tabla y anota lo que ves.

| Pantalla | PROP | AGRO | CAMPO | CONS |
| -------- | ---- | ---- | ----- | ---- |
| Proyectos | Botón **Nuevo proyecto** | Botón **Nuevo proyecto** | Sin botón | Sin botón |
| Inventario | **Registrar movimiento** | Sin botón | Sin botón | Sin botón |
| Bitácoras | **Riego**, **Aplicación**, **Actividad** | Sí | Sí | Sin botones |
| Ventas | **Nueva venta** | «Sin acceso a este módulo» | «Sin acceso a este módulo» | Listado sin **Nueva venta** |
| Dashboard financiero | Visible | «Sin acceso a este módulo» | «Sin acceso a este módulo» | Visible |
| Usuarios y roles | **Invitar usuario** | Sin botón | Sin botón | Sin botón |

- **Resultado esperado:** Coincide con la tabla. En CONS, ninguna pantalla ofrece botones de captura.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| Supervisor de campo: «Sin acceso a este módulo» en Dashboard financiero y Ventas; sí ve el botón **Riego** en Bitácoras. Consulta: no ve **Nuevo proyecto**. Falta recorrer la tabla completa con PROP y AGRO. | **Parcial** | 05/11/2026 · Playwright (Chromium 1440×900) · compilación de producción. Evidencia: `evidencias/aut-05.png`. Recorrido HTTP del 5-nov con 4 roles × 53 rutas: los «Sin acceso» coinciden con la tabla. |

### AUT-06 · Registro de cuenta y creación de organización

- **Módulo:** Autenticación / Organizaciones
- **Objetivo:** Comprobar que una persona nueva crea su cuenta y su empresa.
- **Requisitos previos:** Sesión cerrada.
- **Datos de prueba:**
  - Nombre «Prueba Registro».
  - Correo «registro.prueba@ejemplo.mx».
  - Contraseña «Registro2026».
  - Organización «Agrícola de Prueba».
- **Pasos:**
  1. En el inicio de sesión pulsa **Regístrate**.
  2. Captura **Nombre completo**, **Correo electrónico**, **Contraseña** y **Confirmar contraseña**. Envía.
  3. Si aparece «Revisa tu correo», abre el enlace en Mailpit.
  4. En **Bienvenido**, captura **Nombre de la organización** y pulsa **Crear organización**.
  5. Repite el paso 2 con la contraseña «corta».
- **Resultado esperado:**
  - Pasos 1 a 4: se entra al Dashboard de «Agrícola de Prueba» con el rol Propietario.
  - Paso 5: «La contraseña debe tener al menos 8 caracteres».

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| | Pendiente | Automatizada: integración «registra una cuenta…», «crea la organización con el usuario como propietario», «rechaza contraseñas cortas» ✅. |

### AUT-07 · Invitar usuario y aceptar la invitación

- **Módulo:** Usuarios y roles
- **Objetivo:** Comprobar el alta de un miembro por invitación.
- **Requisitos previos:** Sesión como PROP. Mailpit accesible.
- **Datos de prueba:** Correo «invitado.prueba@ejemplo.mx», rol Almacén.
- **Pasos:**
  1. Ve a **Configuración → Usuarios y roles** y pulsa **Invitar usuario**.
  2. Captura el correo, elige el **Rol** Almacén y pulsa **Enviar invitación**.
  3. Comprueba que aparece en **Invitaciones pendientes**.
  4. En otra ventana privada, abre el enlace del correo desde Mailpit. Define la contraseña.
  5. Como PROP, recarga **Usuarios y roles**.
- **Resultado esperado:**
  - El invitado entra a «Agropecuaria Los Campos» con el rol Almacén.
  - La invitación desaparece de pendientes y el usuario aparece en **Miembros** como Activo.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| | Pendiente | Automatizada: integración «agrega miembros con su rol» ✅. El correo llega en inglés. |

### AUT-08 · Actualizar perfil y contraseña

- **Módulo:** Mi perfil
- **Objetivo:** Comprobar la edición de datos personales.
- **Requisitos previos:** Sesión como CAMPO.
- **Datos de prueba:**
  - Teléfono «4621234567».
  - Teléfono inválido «abc».
- **Pasos:**
  1. Abre **Menú de usuario → Mi perfil**.
  2. En **Datos personales** captura el teléfono «4621234567» y guarda.
  3. Captura «abc» en el teléfono y guarda.
- **Resultado esperado:**
  - Paso 2: aviso de éxito y el teléfono queda guardado al recargar.
  - Paso 3: «Teléfono no válido».

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| | Pendiente | |

### GEN-01 · Dashboard y notificaciones

- **Módulo:** General
- **Objetivo:** Comprobar que el dashboard y las alertas muestran datos reales.
- **Requisitos previos:** Datos demo recién cargados.
- **Datos de prueba:** Usuarios PROP y CAMPO.
- **Pasos:**
  1. Como PROP, abre el **Dashboard**. Revisa **Proyectos vigentes** y la gráfica **Proyectos por estado**.
  2. Pulsa la campana de **Notificaciones**.
  3. Pulsa la alerta de insumos bajo el mínimo.
  4. Repite los pasos 1 y 2 como CAMPO.
- **Resultado esperado:**
  1. Para PROP, **Proyectos vigentes** = 4 y la gráfica muestra 2 en Desarrollo, 1 en Cosecha y 1 en Planeación.
  2. La campana muestra alertas. Entre ellas, una de insumos bajo el mínimo (por ejemplo, Fosfato diamónico) y una de
     mantenimiento.
  3. La alerta lleva a **Inventario**.
  4. CAMPO no ve la sección **Indicadores financieros y comerciales** ni alertas de cobranza o presupuesto.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| PROP: **Proyectos vigentes** 4 e indicadores financieros visibles; la campana lista insumos bajo mínimo (Fosfato DAP, Fungicida clorotalonil), lotes por caducar y mantenimiento vencido. CAMPO: sin indicadores financieros ni alertas de cobranza o presupuesto. El paso 3 (la alerta lleva a Inventario) lo cubre la prueba de navegador `escritorio.spec.ts` ✅. | **Aprobada** | 05/11/2026 · Playwright (Chromium 1440×900) · compilación de producción. Evidencia: `evidencias/gen-01.png`, `evidencias/gen-01-campo.png`. Automatizada: `tests/e2e/escritorio.spec.ts` (notificaciones) ✅. |

---

## 3. Pruebas de catálogos agrícolas

### CAT-01 · Registrar rancho y parcela

- **Módulo:** Ranchos y parcelas
- **Objetivo:** Comprobar el alta de un rancho y su parcela.
- **Requisitos previos:** Sesión como AGRO.
- **Datos de prueba:**
  - Rancho «Rancho Los Campos», clave RLC-01, 12 ha, municipio Irapuato, estado Guanajuato.
  - Parcela «Parcela Prueba», 5 ha, riego Goteo.
- **Pasos:**
  1. Ve a **Ranchos y parcelas** y pulsa **Nuevo rancho**. Captura los datos y pulsa **Registrar rancho**.
  2. Abre el rancho y pulsa **Nueva parcela**. Captura los datos y pulsa **Registrar parcela**.
- **Resultado esperado:**
  - El rancho aparece en la lista como Activo.
  - En su detalle: **Superficie total** 12 ha, **Parcelada** 5 ha, **Sin parcelar** 7 ha.
  - La parcela tiene 5 ha **Disponible**.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| «Rancho registrado.» y parcela registrada. Detalle: **Parcelada** 5 ha, **Sin parcelar** 7 ha. Datos con sufijo numérico para no repetir nombres (p. ej. «Rancho Los Campos 5029»). | **Aprobada** | 05/11/2026 · Playwright (Chromium 1440×900) · compilación de producción. Evidencia: `evidencias/cat-01.png`. Automatizada: integración «registra rancho, parcela y cultivo» ✅. |

### CAT-02 · Superficie de parcelas mayor a la del rancho

- **Módulo:** Ranchos y parcelas
- **Objetivo:** Comprobar que no se parcela más de la superficie del rancho.
- **Requisitos previos:** CAT-01 aprobada.
- **Datos de prueba:** Parcela «Parcela Excedida» de 8 ha en «Rancho Los Campos» (solo quedan 7 ha).
- **Pasos:**
  1. En el rancho, pulsa **Nueva parcela**. Captura 8 ha y guarda.
  2. Intenta una parcela de −2 ha.
- **Resultado esperado:**
  1. Se rechaza con «La superficie de las parcelas (13 ha) excede la del rancho (12 ha). Disponible: 7 ha» (formato de
     cifras aproximado). La parcela no se crea.
  2. Bajo el campo aparece «Ingresa un número válido» y no se guarda.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| 8 ha: «La superficie de las parcelas (13.00 ha) excede la del rancho (12.00 ha). Disponible: 7.00 ha». −2 ha: «Ingresa un número válido». | **Aprobada** | 05/11/2026 · Playwright (Chromium 1440×900) · compilación de producción. Evidencia: `evidencias/cat-02.png`. Automatizada: integración «rechaza parcelas que exceden la superficie del rancho o con superficie negativa» ✅. |

### CAT-03 · Registrar cultivo

- **Módulo:** Cultivos
- **Objetivo:** Comprobar el alta de un cultivo y que no se elimina uno en uso.
- **Requisitos previos:** Sesión como PROP.
- **Datos de prueba:**
  - Cultivo «Chile», variedad «Serrano», ciclo 110 días, unidad Cajas.
  - El cultivo existente «Brócoli · Avenger».
- **Pasos:**
  1. En **Cultivos** pulsa **Nuevo cultivo**, captura los datos y pulsa **Registrar cultivo**.
  2. Busca el botón **Eliminar** (bote de basura) en la fila de «Brócoli · Avenger».
- **Resultado esperado:**
  1. «Chile · Serrano» aparece en la lista, con los botones Editar, Desactivar y Eliminar.
  2. «Brócoli · Avenger» **no muestra** el botón Eliminar porque tiene proyectos; solo ofrece **Desactivar**.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| | Pendiente | |

---

## 4. Pruebas de proyectos

### PRO-01 · Crear proyecto

- **Módulo:** Proyectos
- **Objetivo:** Comprobar el alta de un proyecto con folio automático.
- **Requisitos previos:** Sesión como AGRO.
- **Datos de prueba:**
  - Nombre «Producción de jitomate prueba».
  - Cultivo «Jitomate · Saladette».
  - Temporada «Otoño-Invierno 2026».
  - Responsable «Ing. Carlos Herrera».
  - Fechas: inicio = hoy; siembra = hoy + 15 días; cosecha estimada = hoy + 120 días.
  - Producción esperada 10000.
  - Presupuesto total 250000.
- **Pasos:**
  1. Ve a **Proyectos** y pulsa **Nuevo proyecto**.
  2. Captura los datos en **Datos del proyecto**, **Calendario** y **Metas**.
  3. Pulsa **Crear proyecto**.
  4. Repite el paso 1 y pulsa **Crear proyecto** sin capturar nada.
- **Resultado esperado:**
  - Pasos 1 a 3: se abre el expediente con el folio **PRY-2026-0005**, el estado **Planeación** y el presupuesto
    $250,000.00.
  - Paso 4: mensajes de campo obligatorio y no se crea nada.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| «Cultivo registrado.». En «Brócoli · Avenger» (con proyectos) **no aparece** el botón Eliminar, solo **Desactivar**; en el cultivo nuevo sí aparece Eliminar. | **Aprobada** | 05/11/2026 · Playwright (Chromium 1440×900) · compilación de producción. Evidencia: `evidencias/cat-03.png`. Automatizada: integración «crea el proyecto con folio…», «rechaza datos incompletos» ✅. |

### PRO-02 · Editar proyecto

- **Módulo:** Proyectos
- **Objetivo:** Comprobar la modificación de datos generales.
- **Requisitos previos:** PRO-01 aprobada.
- **Datos de prueba:** Producción esperada 12000. Temporada «O-I 2026/27».
- **Pasos:**
  1. Abre el expediente de PRY-2026-0005 y pulsa **Editar**.
  2. Cambia los datos y pulsa **Guardar cambios**.
- **Resultado esperado:**
  - El **Resumen** muestra los nuevos valores.
  - **Última modificación** se actualiza.
  - El folio y el estado no cambian.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| | Pendiente | |

### PRO-03 · Consultar proyecto (expediente)

- **Módulo:** Proyectos
- **Objetivo:** Comprobar que el expediente reúne la información de todos los módulos.
- **Requisitos previos:** Datos demo.
- **Datos de prueba:** PRY-2026-0003 Brócoli exportación. Usuarios PROP y CAMPO.
- **Pasos:**
  1. Como PROP, abre **Proyectos → Brócoli exportación · La Esperanza**.
  2. Revisa las tarjetas **Parcelas asignadas**, **Costos y resultados**, **Producción**, **Ventas y cobranza**,
     **Detalle de costos**, **Bitácora del proyecto**, **Operación** e **Historial de estados**.
  3. Abre el mismo proyecto como CAMPO.
- **Resultado esperado:**
  - PROP ve todas las tarjetas con datos:
    - **Parcelas asignadas**: «Lote 1», 20 ha.
    - **Producción** con 5 lotes.
    - **Ventas y cobranza** con valor vendido y cobrado por separado.
  - CAMPO no ve las tarjetas de costos ni de ventas.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| Vacío: «Selecciona un cultivo» y demás mensajes; no se crea. Alta: folio **PRY-2026-0005**, estado **Planeación**, presupuesto $250,000.00. | **Aprobada** | 05/11/2026 · Playwright (Chromium 1440×900) · compilación de producción. Evidencia: `evidencias/pro-01.png`. Automatizada: escenario de jitomate (integración, 22 pruebas) ✅. |

### PRO-04 · Asignar parcelas

- **Módulo:** Proyectos
- **Objetivo:** Comprobar la asignación de superficie de una parcela.
- **Requisitos previos:** PRO-01 aprobada.
- **Datos de prueba:** PRY-2026-0005, parcela «El Mezquite · Parcela Norte (13 ha libres)», 5 ha.
- **Pasos:**
  1. En el expediente, tarjeta **Parcelas asignadas**, pulsa **Asignar parcela**.
  2. Elige la parcela, captura 5 en **Superficie a asignar (ha)** y pulsa **Asignar**.
  3. Ve a **Ranchos y parcelas → El Mezquite**.
- **Resultado esperado:**
  - El proyecto muestra la Parcela Norte con 5 ha y su total de 5 ha.
  - En el rancho, la Parcela Norte muestra **Disponible** 8 ha.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| | Pendiente | |

### PRO-05 · Asignar más superficie de la disponible

- **Módulo:** Proyectos
- **Objetivo:** Comprobar que no se compromete superficie inexistente.
- **Requisitos previos:** PRO-04 aprobada (Parcela Norte con 8 ha libres).
- **Datos de prueba:** 10 ha adicionales en la Parcela Norte, editando la asignación de PRY-2026-0005 de 5 a 15 ha.
- **Pasos:**
  1. En la tabla de parcelas del proyecto, pulsa el lápiz **Editar superficie de Parcela Norte**.
  2. Captura 15 en **Hectáreas** y pulsa **Guardar**.
- **Resultado esperado:**
  - Se rechaza con un mensaje del tipo «La parcela "Parcela Norte" tiene 25 ha; ya hay 12 ha asignadas a otros
    proyectos vigentes. Disponible: 13 ha».
  - La asignación sigue en 5 ha.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| «Parcela asignada al proyecto.» Se usó la parcela de prueba de CAT-01 (3 ha) en lugar de la Parcela Norte. El diálogo indica que solo ofrece superficie libre. No se revisó el **Disponible** en Ranchos. | **Parcial** | 05/11/2026 · Playwright (Chromium 1440×900) · compilación de producción. Evidencia: `evidencias/pro-04.png`. Regla verificada en pgTAP ✅. |

### PRO-06 · Cambiar estado

- **Módulo:** Proyectos
- **Objetivo:** Comprobar las transiciones de estado y su historial.
- **Requisitos previos:** PRO-04 aprobada.
- **Datos de prueba:** PRY-2026-0005. Nota «Inició la preparación del suelo».
- **Pasos:**
  1. Pulsa **Cambiar estado**.
  2. Revisa las opciones de **Nuevo estado**.
  3. Elige «Preparación de suelo», captura la nota y confirma.
  4. Como CONS, abre el mismo expediente.
- **Resultado esperado:**
  - Paso 2: desde Planeación solo se ofrecen Preparación de suelo, Siembra y Cancelado.
  - Paso 3: el estado cambia y la barra de avance se actualiza. **Historial de estados** muestra el cambio con la nota
    y el usuario.
  - Paso 4: CONS no ve **Cambiar estado**.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| | Pendiente | |

### PRO-07 · Cancelar proyecto con motivo

- **Módulo:** Proyectos
- **Objetivo:** Comprobar que cancelar exige motivo y libera la superficie.
- **Requisitos previos:** PRO-06 aprobada. Ejecútala **al final** de la sección 13, porque PRY-2026-0005 se usa en
  pruebas financieras.
- **Datos de prueba:** Motivo «Prueba de cancelación».
- **Pasos:**
  1. Pulsa **Cambiar estado** y elige **Cancelado**.
  2. Intenta confirmar sin motivo.
  3. Captura el motivo y pulsa **Cancelar proyecto**.
  4. Revisa la Parcela Norte en Ranchos.
  5. Como AGRO, intenta **Cambiar estado** en el proyecto cancelado.
- **Resultado esperado:**
  - Paso 2: el motivo es obligatorio.
  - Paso 3: el estado queda **Cancelado** y la línea de avance dice «Proyecto cancelado. Consulta el motivo en el
    historial».
  - Paso 4: la Parcela Norte vuelve a 13 ha disponibles.
  - Paso 5: AGRO no puede reabrir; solo PROP o un administrador.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| | Pendiente | |

---

## 5. Pruebas de inventario

### INV-01 · Crear producto

- **Módulo:** Inventario
- **Objetivo:** Comprobar el alta de un insumo.
- **Requisitos previos:** Sesión como PROP (o J-ALM en la organización de jitomate).
- **Datos de prueba:** «Sulfato de potasio», clave FER-090, categoría Fertilizantes, unidad Kilogramos (kg), existencia
  mínima 200, sin control por lote.
- **Pasos:**
  1. Ve a **Inventario** y pulsa **Nuevo producto**.
  2. Captura los datos y pulsa **Registrar producto**.
- **Resultado esperado:**
  - El producto aparece en **Existencias** con existencia 0.
  - Aparece con la marca **Bajo mínimo**, porque 0 ≤ 200.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| | Pendiente | |

### INV-02 · Registrar entrada

- **Módulo:** Inventario
- **Objetivo:** Comprobar que una compra aumenta la existencia y no carga costo a proyectos.
- **Requisitos previos:** INV-01 aprobada.
- **Datos de prueba:**
  - Entrada por compra de 1,000 kg de «Sulfato de potasio» a $20.00/kg en «Almacén general».
  - Proveedor «Agroquímicos Irapuato».
  - Factura «F-PRUEBA-01».
- **Pasos:**
  1. Pulsa **Registrar movimiento** y elige **Tipo** «Entrada por compra».
  2. Captura los datos y comprueba que **Valor estimado del movimiento** muestra $20,000.00.
  3. Pulsa **Registrar**.
  4. Abre el expediente de cualquier proyecto, en **Detalle de costos**.
- **Resultado esperado:**
  - La existencia es de 1,000 kg, con costo promedio $20.00 y valor $20,000.00.
  - Desaparece la marca **Bajo mínimo**.
  - Ningún proyecto muestra este importe.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| Al editar a 9 ha una parcela de 5 ha: «La parcela "Parcela Prueba" tiene 5.00 ha; ya hay 0 ha asignadas a otros proyectos vigentes. Disponible: 5.00 ha». No se guarda. | **Aprobada** | 05/11/2026 · Playwright (Chromium 1440×900) · compilación de producción. Evidencia: `evidencias/pro-05.png`. Automatizada: integración «registra la entrada (compra) sin cargar costo al proyecto» ✅. |

### INV-03 · Registrar salida (consumo a proyecto)

- **Módulo:** Inventario
- **Objetivo:** Comprobar que el consumo descuenta existencia y carga el costo al proyecto.
- **Requisitos previos:** INV-02 aprobada.
- **Datos de prueba:** Salida por consumo de 300 kg de «Sulfato de potasio» desde «Almacén general» a
  PRY-2026-0002 Jitomate saladette, Parcela Norte.
- **Pasos:**
  1. Pulsa **Registrar movimiento** y elige «Salida por consumo».
  2. Elige producto, **Sale de**, **Proyecto** y **Parcela**. Captura 300 en la cantidad.
  3. Pulsa **Registrar**.
  4. Abre el expediente de PRY-2026-0002, en **Detalle de costos**.
- **Resultado esperado:**
  - La existencia baja a 700 kg.
  - El proyecto muestra un costo de origen Inventario por **$6,000.00** (300 × $20).

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| Desde Planeación se ofrecen solo Preparación de suelo, Siembra y Cancelado. «Estado del proyecto actualizado.»; el **Historial de estados** registra «Planeación → Preparación de suelo». CONS no ve **Cambiar estado**. | **Aprobada** | 05/11/2026 · Playwright (Chromium 1440×900) · compilación de producción. Evidencia: `evidencias/pro-06.png`. Automatizada: integración «el consumo sale a costo promedio y se vuelve costo del proyecto» ✅. |

### INV-04 · Consultar existencia

- **Módulo:** Inventario
- **Objetivo:** Comprobar las vistas de existencias y alertas.
- **Requisitos previos:** Datos demo.
- **Datos de prueba:** Productos «Fosfato diamónico DAP 18-46-00» y «Fungicida clorotalonil 720».
- **Pasos:**
  1. En **Existencias**, marca **Solo bajo mínimo**.
  2. Abre la pestaña **Por almacén y lote** y filtra por **Todos los almacenes**.
  3. Busca «clorotalonil».
- **Resultado esperado:**
  - Paso 1: aparecen el Fosfato DAP (300 kg con mínimo de 1,000) y el Fungicida (34 l con mínimo de 40).
  - Paso 3: el fungicida aparece con su número de lote y su caducidad.
  - Los indicadores **Bajo mínimo** y **Lotes por caducar** coinciden con lo listado.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| | Pendiente | |

### INV-05 · Salida superior al inventario disponible

- **Módulo:** Inventario
- **Objetivo:** Comprobar que no se puede sacar más de lo que hay en el almacén.
- **Requisitos previos:** Datos demo.
- **Datos de prueba:**
  - Salida por consumo de 6,000 kg de «Urea 46 %» (hay 5,000 kg en Almacén general) a PRY-2026-0001, Parcela Sur.
  - Cantidad −10.
- **Pasos:**
  1. Registra el consumo de 6,000 kg con los datos indicados.
  2. Repite con la cantidad −10.
- **Resultado esperado:**
  1. Se rechaza con «Existencia insuficiente de "Urea 46 %" en Almacén general: hay 5,000 kg y se requieren 6,000»
     (formato de cifras aproximado). La existencia sigue en 5,000 kg.
  2. Bajo **Cantidad** aparece «Ingresa un número válido». (Con 0 el mensaje es «Debe ser mayor que cero».)

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| Sin motivo: «Indica el motivo de la cancelación». Con motivo: estado Cancelado, «Proyecto cancelado. Consulta el motivo en el historial.» y el historial guarda «Prueba de cancelación». La parcela vuelve a 5 ha disponibles. AGRO ya no ve **Cambiar estado**. | **Aprobada** | 05/11/2026 · Playwright (Chromium 1440×900) · compilación de producción. Evidencia: `evidencias/pro-07.png`, `evidencias/pro-07-rancho.png`. Automatizada: integración «rechaza existencias insuficientes y cantidades negativas» ✅. |

### INV-06 · Consultar historial y anular movimiento

- **Módulo:** Inventario
- **Objetivo:** Comprobar el historial y la anulación con contrapartida.
- **Requisitos previos:** INV-03 aprobada.
- **Datos de prueba:** El consumo de 300 kg de INV-03.
- **Pasos:**
  1. En **Movimientos**, filtra **Producto** «Sulfato de potasio» y pulsa **Aplicar**.
  2. En el consumo, pulsa **Anular movimiento**, escribe el **Motivo** (mínimo 5 caracteres) y pulsa **Anular**.
  3. Intenta anularlo otra vez.
- **Resultado esperado:**
  - Paso 1: aparecen la entrada y el consumo.
  - Paso 2: aparece «Movimiento anulado con su contrapartida.». Se agrega una «Devolución de proyecto» con la etiqueta
    **Anulación** y el original queda como **Anulado**. La existencia regresa a 1,000 kg y el proyecto muestra la
    contrapartida de −$6,000.00.
  - Paso 3: ya no se ofrece la anulación.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| | Pendiente | |

### INV-07 · Transferencia entre almacenes

- **Módulo:** Inventario
- **Objetivo:** Comprobar que una transferencia mueve existencia sin cambiar el valor.
- **Requisitos previos:** Datos demo.
- **Datos de prueba:** 100 l de «Diésel» de «Almacén general» (4,405 l) a «Bodega La Esperanza» (800 l).
- **Pasos:**
  1. Anota el **Valor del inventario**.
  2. Registra la «Transferencia entre almacenes».
  3. Revisa **Por almacén y lote**.
- **Resultado esperado:**
  - Almacén general queda con 4,305 l y Bodega La Esperanza con 900 l.
  - El **Valor del inventario** no cambia.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| | Pendiente | |

---

## 6. Pruebas de bitácoras

### BIT-01 · Registrar riego

- **Módulo:** Bitácoras
- **Objetivo:** Comprobar el registro de un riego y el cálculo de su duración.
- **Requisitos previos:** Sesión como CAMPO.
- **Datos de prueba:**
  - PRY-2026-0002, Parcela Norte, fecha de ayer, de 22:00 a 02:00.
  - Sistema «El de la parcela».
  - Agua 120 m³.
  - Responsable «Miguel Ortega Ruiz».
  - Observaciones «Prueba de riego».
- **Pasos:**
  1. Ve a **Bitácoras** y pulsa **Riego**.
  2. Captura los datos y pulsa **Registrar riego**.
  3. Repite con una fecha de mañana.
- **Resultado esperado:**
  - Paso 2: el riego aparece en la pestaña **Riego** con una **Duración** de 4 h y 120 m³.
  - Paso 3: «No puede ser una fecha futura».

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| «Producto registrado.». Fila: existencia 0 kg con **Bajo mínimo**, mínimo 200 kg. | **Aprobada** | 05/11/2026 · Playwright (Chromium 1440×900) · compilación de producción. Evidencia: `evidencias/inv-01.png`. Automatizada: integración «el supervisor registra una bitácora de riego; consulta no» ✅. |

### BIT-02 · Registrar aplicación con descuento de almacén

- **Módulo:** Bitácoras
- **Objetivo:** Comprobar que la aplicación registra lo aplicado, descuenta el almacén y carga el costo.
- **Requisitos previos:** Sesión como CAMPO. Una fotografía JPG en el equipo.
- **Datos de prueba:**
  - Producto «Trichoderma harzianum WP», 2 kg.
  - PRY-2026-0001, Parcela Sur, superficie tratada 4 ha.
  - **Descontar del almacén** activado: Almacén general y el primer lote.
  - Equipo «Aspersora de aguilón 600 l».
  - Una fotografía.
- **Pasos:**
  1. Pulsa **Aplicación** y captura los datos. Agrega la foto en **Fotografías (opcional)**.
  2. Pulsa **Registrar aplicación**.
  3. Revisa **Inventario → Movimientos**.
  4. Abre la cámara (**Evidencias**) de la aplicación.
- **Resultado esperado:**
  - La aplicación aparece con su costo.
  - En Inventario aparece una salida con la etiqueta **Desde bitácora**; el Trichoderma baja de 16 a 14 kg.
  - La evidencia muestra la foto.
  - El formulario no sugiere dosis.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| | Pendiente | |

### BIT-03 · Registrar actividad

- **Módulo:** Bitácoras
- **Objetivo:** Comprobar el registro de labores y su costo adicional.
- **Requisitos previos:** Sesión como CAMPO.
- **Datos de prueba:**
  - PRY-2026-0002, «Todo el proyecto», actividad «Deshierbe».
  - Descripción «Deshierbe manual prueba».
  - Costo adicional $1,500.
- **Pasos:**
  1. Pulsa **Actividad**, captura los datos y pulsa **Registrar actividad**.
  2. Como PROP, abre el **Detalle de costos** de PRY-2026-0002.
- **Resultado esperado:**
  - La actividad aparece en **Actividades**.
  - El proyecto suma $1,500 con origen «Actividades de campo».

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| | Pendiente | |

### BIT-04 · Consultar historial y cronología

- **Módulo:** Bitácoras
- **Objetivo:** Comprobar filtros, búsqueda y cronología.
- **Requisitos previos:** BIT-01 a BIT-03 aprobadas.
- **Datos de prueba:** Proyecto PRY-2026-0002.
- **Pasos:**
  1. En la barra de filtros, elige **Proyecto** PRY-2026-0002 y pulsa **Aplicar**.
  2. Abre la pestaña **Cronología**.
  3. En **Riego**, escribe «Prueba» en el buscador.
  4. Pulsa **Limpiar**.
- **Resultado esperado:**
  - La cronología lista en orden de fecha el riego, la actividad y el consumo de INV-03.
  - La búsqueda deja solo el riego de prueba.
  - **Limpiar** quita los filtros.
  - Las observaciones no aparecen en la cronología (limitación conocida).

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| | Pendiente | |

### BIT-05 · Cancelar aplicación (devuelve el producto)

- **Módulo:** Bitácoras
- **Objetivo:** Comprobar que cancelar una aplicación revierte su salida de almacén.
- **Requisitos previos:** BIT-02 aprobada.
- **Datos de prueba:** Motivo «Captura duplicada».
- **Pasos:**
  1. En **Aplicaciones**, pulsa **Cancelar registro** en la aplicación de BIT-02.
  2. Captura el motivo y confirma.
  3. Marca **Mostrar cancelados**.
- **Resultado esperado:**
  - La aplicación aparece como **Cancelado**.
  - El Trichoderma regresa a 16 kg, en el mismo lote.
  - El costo sale del proyecto.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| | Pendiente | |

---

## 7. Pruebas de maquinaria

### MAQ-01 · Registrar equipo

- **Módulo:** Maquinaria
- **Objetivo:** Comprobar el alta de un equipo con tarifa y programa de mantenimiento.
- **Requisitos previos:** Sesión como AGRO.
- **Datos de prueba:**
  - «Tractor de prueba 5075E», tipo Tractor, clave TR-09, estado Operativa.
  - Responsable «Pedro Sánchez Luna».
  - Cobro Por hora, $600/h.
  - Mantenimiento cada 250 h.
- **Pasos:**
  1. Ve a **Maquinaria → Equipos** y pulsa **Nuevo equipo**.
  2. Captura los datos y pulsa **Registrar equipo**.
- **Resultado esperado:**
  - El equipo aparece en **Equipos** como Operativa, con su tarifa.
  - **Equipos operativos** aumenta en 1.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| | Pendiente | |

### MAQ-02 · Registrar utilización y asignar a proyecto

- **Módulo:** Maquinaria
- **Objetivo:** Comprobar que el uso se carga al proyecto con la tarifa congelada, incluido el combustible del almacén.
- **Requisitos previos:** MAQ-01 aprobada.
- **Datos de prueba:**
  - Equipo «Tractor de prueba 5075E», PRY-2026-0001, Parcela Sur, fecha de hoy, 6 h, cobro por hora.
  - Operador «Pedro Sánchez Luna», actividad «Rastreo».
  - Combustible 40 l **Surtido del almacén**: Diésel, Almacén general.
- **Pasos:**
  1. Pulsa **Registrar uso**, captura los datos y pulsa **Registrar**.
  2. Edita el equipo y cambia la tarifa a $700/h.
  3. Revisa el registro de uso.
  4. Abre el **Detalle de costos** de PRY-2026-0001.
- **Resultado esperado:**
  - El uso muestra 6 h × $600 = **$3,600**. Sigue en $3,600 después de cambiar la tarifa.
  - El proyecto tiene un costo de Maquinaria de $3,600 y un costo de Inventario (Diésel) por los 40 l al costo promedio.
  - El Diésel del Almacén general baja 40 l.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| **Valor estimado del movimiento** $20,000.00. Existencia 1,000 kg, costo promedio $20.00, valor $20,000.00, sin Bajo mínimo. En el Detalle de costos de PRY-2026-0002 la entrada no aparece. | **Aprobada** | 05/11/2026 · Playwright (Chromium 1440×900) · compilación de producción. Evidencia: `evidencias/inv-02-form.png`, `evidencias/inv-02.png`. Automatizada: integración «registra maquinaria y su uso con tarifa congelada» ✅. |

### MAQ-03 · Más de 24 h de uso en un día

- **Módulo:** Maquinaria
- **Objetivo:** Comprobar el límite diario de horas.
- **Requisitos previos:** MAQ-02 aprobada.
- **Datos de prueba:** El mismo equipo y la misma fecha, 20 h adicionales.
- **Pasos:** registra un segundo uso de 20 h para el mismo día.
- **Resultado esperado:** Se rechaza con «"Tractor de prueba 5075E" ya tiene 6 h registradas el …; no puede exceder 24 h
  por día».

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| Existencia 700 kg. PRY-2026-0002 muestra «Sulfato de potasio … 300. kg · Inventario · $6,000.00». Defecto cosmético: la cantidad aparece como «300.» (ver matriz, D-DOC-01). | **Aprobada** | 05/11/2026 · Playwright (Chromium 1440×900) · compilación de producción. Evidencia: `evidencias/inv-03.png`, `evidencias/inv-03-costo-proyecto.png`. Automatizada: integración «rechaza más de 24 horas de un equipo en el día» ✅. |

### MAQ-04 · Registrar mantenimiento

- **Módulo:** Maquinaria
- **Objetivo:** Comprobar el registro de mantenimiento y su efecto en las alertas.
- **Requisitos previos:** Datos demo (hay un equipo con el servicio vencido).
- **Datos de prueba:** El equipo que aparece en **Alertas de mantenimiento**. Tipo Mantenimiento preventivo, fecha de hoy,
  «Cambio de aceite y filtros», taller «Taller Prueba», costo $2,800.
- **Pasos:**
  1. Anota el indicador **Alertas de mantenimiento**.
  2. En **Mantenimiento**, pulsa **Registrar mantenimiento**, captura los datos y pulsa **Registrar**.
  3. Revisa de nuevo el indicador y la campana.
- **Resultado esperado:**
  - El registro aparece como **Preventivo**.
  - El equipo deja de estar vencido y la alerta desaparece de la campana.
  - El costo no aparece en ningún proyecto.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| | Pendiente | |

---

## 8. Pruebas de recursos humanos

### RH-01 · Registrar trabajador

- **Módulo:** Personal
- **Objetivo:** Comprobar el alta de un empleado.
- **Requisitos previos:** Sesión como AGRO.
- **Datos de prueba:** «Juan Prueba Torres», puesto Jornalero, tipo Eventual, ingreso hoy, tarifa por jornal $380.
- **Pasos:**
  1. En **Personal → Empleados** pulsa **Nuevo empleado**.
  2. Captura los datos y pulsa **Registrar empleado**.
- **Resultado esperado:** El empleado aparece en la tabla y **Empleados activos** aumenta en 1.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| | Pendiente | |

### RH-02 · Asignar trabajador

- **Módulo:** Personal
- **Objetivo:** Comprobar la asignación a un proyecto sin generar costo.
- **Requisitos previos:** RH-01 aprobada.
- **Datos de prueba:** «Juan Prueba Torres» → PRY-2026-0002, Parcela Norte, función «Aplicador», desde hoy.
- **Pasos:**
  1. En **Asignaciones** pulsa **Asignar a proyecto**, captura los datos y pulsa **Asignar**.
  2. Abre el expediente de PRY-2026-0002, tarjeta **Operación**.
- **Resultado esperado:**
  - La asignación aparece como **Vigente**.
  - El expediente lo lista en **Personal asignado**.
  - El costo del proyecto no cambia.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| 6,000 kg: «Existencia insuficiente de "Urea 46 %": hay 5000.000 kg y se requieren 6000» (cifras sin formato, D-DOC-02). −10: «Ingresa un número válido». | **Aprobada** | 05/11/2026 · Playwright (Chromium 1440×900) · compilación de producción. Evidencia: `evidencias/inv-05.png`. Automatizada: integración «asigna un trabajador al proyecto» ✅. |

### RH-03 · Registrar jornada

- **Módulo:** Personal
- **Objetivo:** Comprobar el registro de un jornal y de un destajo.
- **Requisitos previos:** RH-01 aprobada. Sesión como CAMPO.
- **Datos de prueba:**
  - Jornal: «Juan Prueba Torres», PRY-2026-0002, Parcela Norte, hoy, «Deshierbe manual», 1 jornal, pago vacío (usa $380).
  - Destajo: «Cuadrilla / eventuales sin alta», cuadrilla «Cuadrilla de corte», PRY-2026-0003, Lote 1, 150 cajas × $12.
- **Pasos:**
  1. En **Jornadas** pulsa **Registrar jornada**, captura el jornal y pulsa **Registrar**.
  2. Registra el destajo.
  3. Abre **Asistencia** y filtra por hoy.
- **Resultado esperado:**
  - Jornal de $380 y destajo de $1,800.
  - Juan aparece **Presente** hoy, porque el jornal marca la asistencia.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| | Pendiente | |

### RH-04 · Segundo jornal el mismo día

- **Módulo:** Personal
- **Objetivo:** Comprobar que un empleado no acumula más de 1 jornal por día ni trabaja con falta.
- **Requisitos previos:** RH-03 aprobada.
- **Datos de prueba:**
  - Otro jornal de «Juan Prueba Torres» hoy, en PRY-2026-0001.
  - Falta de «Rosa María Vega» hoy.
- **Pasos:**
  1. Registra el segundo jornal.
  2. Registra la asistencia de Rosa María Vega como **Falta**.
  3. Registra un jornal de Rosa María Vega hoy.
- **Resultado esperado:**
  - Paso 1: rechazado con «Juan Prueba Torres ya tiene 1 jornal(es) registrados el …; un empleado no puede exceder 1
    jornal por día».
  - Paso 3: rechazado con «Rosa María Vega está registrado con Falta el …; corrige la asistencia antes de registrar
    trabajo» (texto aproximado).

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| | Pendiente | |

### RH-05 · Consultar costo de mano de obra

- **Módulo:** Personal / Reportes
- **Objetivo:** Comprobar que el costo de mano de obra se suma por proyecto.
- **Requisitos previos:** RH-03 aprobada.
- **Datos de prueba:** Periodo = hoy.
- **Pasos:**
  1. En **Jornadas**, filtra **Desde** y **Hasta** = hoy y pulsa **Aplicar**.
  2. Revisa el indicador **Costo de mano de obra del periodo**.
  3. Abre **Reportes operativos → Mano de obra** con el mismo periodo.
- **Resultado esperado:**
  - El indicador incluye $380 + $1,800 = $2,180, más los registros de hoy que ya existieran.
  - El reporte muestra los mismos importes por proyecto y actividad.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| | Pendiente | |

---

## 9. Pruebas de producción

### PRD-01 · Registrar corte

- **Módulo:** Producción
- **Objetivo:** Comprobar el registro de un corte en cajas y su conversión a kg.
- **Requisitos previos:** Sesión como CAMPO.
- **Datos de prueba:**
  - PRY-2026-0003 Brócoli (en Cosecha), Lote 1, fecha de hoy.
  - Número de corte vacío. Calidad Primera, clasificación «Exportación».
  - 500 cajas × 20 kg.
  - Responsable «Raúl Díaz Hernández».
- **Pasos:**
  1. Ve a **Producción** y pulsa **Registrar corte**.
  2. Captura los datos y pulsa **Registrar corte**.
  3. Intenta registrar un corte en PRY-2026-0002, que está en Desarrollo.
- **Resultado esperado:**
  - Se crea el lote **LOT-2026-0006** con 10,000 kg y su número de corte automático.
  - En el paso 3, PRY-2026-0002 no aparece en la lista de proyectos.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| El diálogo pide **Motivo** (mínimo 5 caracteres). «Movimiento anulado con su contrapartida.»: aparecen «Devolución de proyecto · Anulación» y el consumo «Anulado». Existencia regresa a 1,000 kg; el proyecto muestra −$6,000.00. Ya no se ofrece una segunda anulación. | **Aprobada** | 05/11/2026 · Playwright (Chromium 1440×900) · compilación de producción. Evidencia: `evidencias/inv-06.png`. Automatizada: integración «registra un corte que genera su lote» ✅. |

### PRD-02 · Crear lote (dos calidades en un corte)

- **Módulo:** Producción
- **Objetivo:** Comprobar que cada calidad del mismo corte genera su propio lote.
- **Requisitos previos:** PRD-01 aprobada.
- **Datos de prueba:** El mismo proyecto, parcela y fecha, con el **mismo número de corte** que LOT-2026-0006. Calidad
  Segunda, 2.5 toneladas.
- **Pasos:** registra el corte con unidad Toneladas y cantidad 2.5.
- **Resultado esperado:**
  - Se crea **LOT-2026-0007** con 2,500 kg.
  - Comparte el número de corte con LOT-2026-0006.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| | Pendiente | |

### PRD-03 · Consultar producción disponible

- **Módulo:** Producción
- **Objetivo:** Comprobar el inventario de producto por lote.
- **Requisitos previos:** PRD-01 y PRD-02 aprobadas.
- **Datos de prueba:** Lotes LOT-2026-0004, LOT-2026-0006 y LOT-2026-0007.
- **Pasos:**
  1. Abre **Inventario de producto** y marca **Solo con existencia**.
  2. Abre la trazabilidad (ícono de ruta) de LOT-2026-0006.
  3. Revisa la pestaña **Indicadores** con el periodo de hoy.
- **Resultado esperado:**
  - Disponibles: LOT-2026-0004 = 18,000 kg; LOT-2026-0006 = 10,000 kg; LOT-2026-0007 = 2,500 kg.
  - La trazabilidad muestra **Origen** (proyecto, Lote 1, corte, calidad) e **Historial agrícola hasta el corte**.
  - **Producción del periodo** incluye 12,500 kg.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| «Movimiento registrado.». **Valor del inventario** $275,516.90 antes y después. | **Aprobada** | 05/11/2026 · Playwright (Chromium 1440×900) · compilación de producción. Evidencia: `evidencias/inv-07.png`. Automatizada: integración «producción: cortes, lotes, mermas, vendido y disponible» ✅. |

### PRD-04 · Registrar merma

- **Módulo:** Producción
- **Objetivo:** Comprobar el registro y la reversión de una merma.
- **Requisitos previos:** PRD-02 aprobada.
- **Datos de prueba:**
  - LOT-2026-0007, tipo Merma, 200 kg, justificación «Selección en empaque».
  - Un segundo intento de 5,000 kg.
- **Pasos:**
  1. En el lote pulsa **Merma o ajuste**, captura los datos y pulsa **Registrar**.
  2. Intenta una merma de 5,000 kg.
  3. En **Movimientos**, pulsa **Revertir movimiento** en la merma de 200 kg.
- **Resultado esperado:**
  - Paso 1: el disponible baja a 2,300 kg.
  - Paso 2: se rechaza, porque excede lo disponible.
  - Paso 3: el disponible regresa a 2,500 kg y la merma original queda como **Revertido**.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| | Pendiente | |

### PRD-05 · Vender más producción de la disponible

- **Módulo:** Producción / Ventas
- **Objetivo:** Comprobar que no se vende más de lo disponible en un lote.
- **Requisitos previos:** Sesión como PROP. Datos demo.
- **Datos de prueba:**
  - Cliente «Comercializadora Central de Abasto».
  - Partida de LOT-2026-0004 (18,000 kg disponibles), unidad Kilogramos, 20,000 kg a $10/kg.
- **Pasos:**
  1. Pulsa **Nueva venta** y captura la partida.
  2. Observa el resumen y el botón **Confirmar venta**.
  3. Pulsa **Guardar borrador**.
- **Resultado esperado:**
  - Paso 2: la partida y el resumen muestran «Excede lo disponible en LOT-2026-0004 (18,000 kg)» y **Confirmar venta**
    queda deshabilitado.
  - Paso 3: se rechaza con «El lote LOT-2026-0004 tiene 18000.000 kg disponibles y se intentan vender 20000.000 kg».
    No se crea la venta.
  - El disponible del lote no cambia.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| «Riego registrado.». Fila: 22:00 – 02:00, Goteo, **4 h**, 120 m³, Miguel Ortega Ruiz. Fecha de mañana: «No puede ser una fecha futura». | **Aprobada** | 05/11/2026 · Playwright (Chromium 1440×900) · compilación de producción. Evidencia: `evidencias/bit-01.png`, `evidencias/bit-01-futura.png`. Automatizada: integración «rechaza ventas superiores a la producción disponible» ✅. Elimina o cancela el borrador al terminar. |

---

## 10. Pruebas de ventas

### VEN-01 · Registrar cliente

- **Módulo:** Clientes
- **Objetivo:** Comprobar el alta de un cliente con crédito.
- **Requisitos previos:** Sesión como PROP (o J-FIN en la organización de jitomate).
- **Datos de prueba:** «Comercializadora del Centro», tipo Mayorista, 15 días de crédito, contacto «Lic. Prueba»,
  teléfono 4610000000.
- **Pasos:**
  1. En **Clientes** pulsa **Nuevo cliente**.
  2. Captura los datos y pulsa **Registrar cliente**.
- **Resultado esperado:** El cliente aparece Activo. En **Nueva venta** se ofrece como «Comercializadora del Centro · 15
  días».

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| | Pendiente | |

### VEN-02 · Crear venta (borrador)

- **Módulo:** Ventas
- **Objetivo:** Comprobar que un borrador no descuenta producto.
- **Requisitos previos:** VEN-01 y PRD-03 aprobadas.
- **Datos de prueba:** Cliente «Comercializadora del Centro», fecha de hoy, vencimiento vacío. Partida de LOT-2026-0006:
  300 cajas × 20 kg a $250/caja.
- **Pasos:**
  1. Pulsa **Nueva venta**, captura los datos y pulsa **Guardar borrador**.
  2. Revisa el disponible de LOT-2026-0006 en Producción.
- **Resultado esperado:**
  - Se crea **VTA-2026-0005** (o el siguiente folio) en estado **Borrador**, con un total de $75,000 y vencimiento en
    hoy + 15 días.
  - LOT-2026-0006 sigue con 10,000 kg.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| | Pendiente | |

### VEN-03 · Agregar varios productos

- **Módulo:** Ventas
- **Objetivo:** Comprobar una venta con partidas de varios lotes, unidades y descuento.
- **Requisitos previos:** VEN-02 aprobada.
- **Datos de prueba:** Agregar al borrador:
  - LOT-2026-0007: 2 toneladas a $8,000/t con descuento de $1,000.
  - LOT-2026-0005: 1,000 kg a $9/kg.
- **Pasos:**
  1. Abre el borrador y pulsa **Editar borrador**.
  2. Pulsa **Agregar partida** dos veces y captura los datos.
  3. Revisa **Subtotal**, **Descuentos** y **Total de la venta**. Guarda el borrador.
- **Resultado esperado:**
  - Subtotal $75,000 + $16,000 + $9,000 = $100,000.
  - Descuentos $1,000.
  - Total **$99,000**.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| | Pendiente | |

### VEN-04 · Confirmar venta

- **Módulo:** Ventas
- **Objetivo:** Comprobar que la confirmación descuenta los lotes y genera la cuenta por cobrar.
- **Requisitos previos:** VEN-03 aprobada.
- **Datos de prueba:** El borrador de VEN-03.
- **Pasos:**
  1. En el detalle del borrador pulsa **Confirmar venta**. Lee la ventana y confirma.
  2. Revisa **Producción → Inventario de producto** y **Cobranza**.
- **Resultado esperado:**
  - Estado **Confirmada**.
  - Disponibles: LOT-2026-0006 = 4,000 kg; LOT-2026-0007 = 500 kg; LOT-2026-0005 = 3,000 kg.
  - La venta aparece en **Ventas con saldo** con $99,000.
  - **Trazabilidad** muestra lote, parcela y proyecto de cada partida.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| Paso 1 con Miguel Ortega Ruiz: «Miguel Ortega Ruiz ya tiene 1.00 jornal(es) registrados el 04/11/2026; un empleado no puede exceder 1 jornal por día». Pasos 2 y 3 (falta y jornal) pendientes. | **Parcial** | 05/11/2026 · Playwright (Chromium 1440×900) · compilación de producción. Evidencia: `evidencias/rh-04.png`. Automatizada: integración «confirma una venta y descuenta el lote» ✅. |

### VEN-05 · Registrar entrega

- **Módulo:** Ventas
- **Objetivo:** Comprobar las entregas parciales y totales.
- **Requisitos previos:** VEN-04 aprobada.
- **Datos de prueba:**
  - Primer viaje: 150 cajas de la partida de LOT-2026-0006 y 0 en las demás. Recibió «Almacén cliente». Transporte
    «Camión Ford F-450».
  - Segundo viaje: el resto.
- **Pasos:**
  1. Pulsa **Registrar entrega**, captura el primer viaje y pulsa **Registrar entrega**.
  2. Registra el segundo viaje.
- **Resultado esperado:**
  - Tras el primer viaje: **Entrega parcial**.
  - Tras el segundo: **Entregada**.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| | Pendiente | |

### VEN-06 · Consultar historial comercial

- **Módulo:** Ventas / Clientes
- **Objetivo:** Comprobar las consultas de ventas y del expediente del cliente.
- **Requisitos previos:** VEN-04 aprobada.
- **Datos de prueba:** «Comercializadora del Centro».
- **Pasos:**
  1. En **Ventas**, busca «Comercializadora» y filtra por estado.
  2. Abre el detalle de la venta y revisa la tarjeta **Historial**.
  3. Abre **Clientes → Comercializadora del Centro**.
- **Resultado esperado:**
  - El **Historial** muestra la creación y la confirmación, con usuario y fecha.
  - El expediente del cliente muestra **Total comprado** $99,000, el **Historial de compras** y el **Producto comprado
    por lote**.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| | Pendiente | |

---

## 11. Pruebas de pagos y cobranza

### PAG-01 · Registrar pago con comprobante

- **Módulo:** Cobranza
- **Objetivo:** Comprobar el registro de un pago con su comprobante.
- **Requisitos previos:** Sesión como PROP. Un PDF o imagen de menos de 10 MB.
- **Datos de prueba:** VTA-2026-0001 (saldo $142,000): pago de $10,000 por Transferencia (SPEI), referencia «RASTREO-001»,
  con comprobante.
- **Pasos:**
  1. Abre VTA-2026-0001 y pulsa **Registrar pago**.
  2. Elige **Tipo** «Pago (parcial o total)», captura los datos y adjunta el comprobante en **Comprobante (opcional)**.
  3. Pulsa **Registrar pago**.
  4. Abre el ícono **Comprobantes** del pago.
- **Resultado esperado:**
  - **Saldo pendiente** $132,000.
  - El pago aparece en **Pagos y anticipos**.
  - El comprobante se puede abrir.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| | Pendiente | |

### PAG-02 · Registrar pago parcial

- **Módulo:** Cobranza
- **Objetivo:** Comprobar el cambio de estado con un pago parcial.
- **Requisitos previos:** Datos demo.
- **Datos de prueba:** VTA-2026-0003 «Comercializadora Central de Abasto», confirmada con saldo de $44,500. Pago de
  $20,000 en Efectivo.
- **Pasos:**
  1. Ve a **Cobranza → Ventas con saldo** y pulsa **Registrar pago** en VTA-2026-0003.
  2. Captura $20,000 y registra.
- **Resultado esperado:**
  - Saldo **$24,500**.
  - Estado **Parcialmente pagada**.
  - El **Total pagado** de Cobranza aumenta $20,000.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| LOT-2026-0004: inicial 18,000, vendido 0, mermas 0, disponible 18,000 kg. LOT-2026-0006 y 0007 dependen de PRD-01/02 (no ejecutadas). | **Parcial** | 05/11/2026 · Playwright (Chromium 1440×900) · compilación de producción. Evidencia: `evidencias/prd-03.png`. Automatizada: integración «registra un pago parcial y actualiza el saldo» ✅. |

### PAG-03 · Registrar liquidación

- **Módulo:** Cobranza
- **Objetivo:** Comprobar que el último pago liquida la venta.
- **Requisitos previos:** PAG-02 aprobada.
- **Datos de prueba:** VTA-2026-0003, saldo $24,500.
- **Pasos:**
  1. Pulsa **Registrar pago**.
  2. Pulsa **Liquidar**: el importe se llena con $24,500.
  3. Lee el aviso y pulsa **Registrar pago**.
- **Resultado esperado:**
  - Paso 3: aparece «Con este pago la venta queda liquidada.».
  - Saldo $0, estado **Pagada**.
  - La venta sale de **Ventas con saldo**.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| | Pendiente | |

### PAG-04 · Consultar saldo pendiente

- **Módulo:** Cobranza
- **Objetivo:** Comprobar que saldos, vencidos y antigüedad coinciden.
- **Requisitos previos:** PAG-01 a PAG-03 aprobadas.
- **Datos de prueba:** —
- **Pasos:**
  1. Abre **Cobranza** y revisa **Saldo pendiente**, **Vencido** y **Porcentaje de recuperación**.
  2. Revisa **Antigüedad de saldos por cliente**.
  3. Compara con la tarjeta **Saldo** de cada venta con saldo.
- **Resultado esperado:**
  - **Saldo pendiente** = suma de los saldos de **Ventas con saldo**.
  - Las ventas vencidas aparecen en rojo.
  - Por cliente, la antigüedad suma lo mismo.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| | Pendiente | |

### PAG-05 · Pago superior al saldo

- **Módulo:** Cobranza
- **Objetivo:** Comprobar que no se cobra más que el saldo.
- **Requisitos previos:** PAG-01 aprobada (VTA-2026-0001 con saldo $132,000).
- **Datos de prueba:** Pago de $150,000.
- **Pasos:** en VTA-2026-0001 pulsa **Registrar pago**, captura $150,000 y registra.
- **Resultado esperado:**
  - Se rechaza con «El pago ($150,000.00) excede el saldo pendiente de la venta ($132,000.00)» (formato aproximado).
  - El saldo no cambia.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| La pantalla avisa «Excede lo disponible en LOT-2026-0004 (18,000 kg)» y **Confirmar venta** queda deshabilitado. **Guardar borrador** se rechaza con «El lote LOT-2026-0004 tiene 18000.000 kg disponibles y se intentan vender 20000.000 kg». No se crea la venta. | **Aprobada** | 05/11/2026 · Playwright (Chromium 1440×900) · compilación de producción. Evidencia: `evidencias/prd-05.png`. Automatizada: integración «rechaza pagos superiores al saldo» ✅. |

### PAG-06 · Anticipo y su aplicación

- **Módulo:** Cobranza
- **Objetivo:** Comprobar que un anticipo no reduce el saldo hasta aplicarse.
- **Requisitos previos:** Datos demo. Borrador VTA-2026-0004 ($60,000).
- **Datos de prueba:** Anticipo de $20,000 en el borrador.
- **Pasos:**
  1. Abre VTA-2026-0004 (borrador) y pulsa **Registrar anticipo**. Captura $20,000.
  2. Revisa **Flujo de efectivo** y **Cobranza → Anticipos pendientes de aplicar**.
  3. Pulsa **Confirmar venta**.
  4. En **Pagos y anticipos** pulsa **Aplicar**, captura $20,000 y pulsa **Aplicar al saldo**.
  5. Pulsa **Revertir aplicación** y confirma.
- **Resultado esperado:**
  - Paso 2: el anticipo cuenta como ingreso en Flujo de efectivo y aparece en anticipos pendientes.
  - Tras confirmar (paso 3): saldo $60,000, con **Anticipos sin aplicar** $20,000.
  - Tras aplicar (paso 4): saldo $40,000.
  - Tras revertir (paso 5): saldo $60,000 otra vez, con el anticipo pendiente.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| «Cliente registrado.». Aparece Mayorista, 15 días, saldo $0.00 (nombre con sufijo: «Distribuidora de Prueba 8872»). | **Aprobada** | 05/11/2026 · Playwright (Chromium 1440×900) · compilación de producción. Evidencia: `evidencias/ven-01.png`. Automatizada: escenario de jitomate «antes de aplicar el anticipo…», «aplica el anticipo…» ✅. |

---

## 12. Pruebas financieras

### FIN-01 · Crear presupuesto

- **Módulo:** Presupuestos
- **Objetivo:** Comprobar la elaboración de un presupuesto por categoría y su revisión.
- **Requisitos previos:** PRO-04 aprobada (PRY-2026-0005 sin presupuesto por categoría y con 5 ha). Sesión como PROP.
- **Datos de prueba:**
  - Semillas: 25 sobres × $950 = $23,750.
  - Fertilizantes: 1,000 kg × $18 = $18,000.
  - Mano de obra: 100 jornales × $400 = $40,000.
  - Superficie 5 ha.
- **Pasos:**
  1. En **Presupuestos**, pulsa **Elaborar** en PRY-2026-0005.
  2. Captura el periodo, la superficie y las tres partidas. Pulsa **Guardar presupuesto**.
  3. Pulsa **Nueva revisión**, cambia la mano de obra a 120 jornales y guarda sin motivo.
  4. Captura el motivo «Ajuste de jornales» y pulsa **Guardar revisión**.
  5. Abre **Versiones**.
- **Resultado esperado:**
  - Paso 2: versión 1 con un total de **$81,750**.
  - Paso 3: el motivo es obligatorio.
  - Paso 4: versión 2 vigente con $89,750.
  - Paso 5: la versión 1 se conserva sin cambios.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| | Pendiente | |

### FIN-02 · Registrar gasto

- **Módulo:** Gastos
- **Objetivo:** Comprobar un gasto directo por pagar y su pago posterior.
- **Requisitos previos:** Sesión como PROP (o J-FIN).
- **Datos de prueba:**
  - Tipo «Energía eléctrica», categoría presupuestal Riego, concepto «Recibo CFE prueba».
  - $4,500, fecha de hoy, proveedor «Sin proveedor», factura «CFE-PRUEBA-1».
  - Directo a PRY-2026-0002.
  - **Ya está pagado** sin marcar.
- **Pasos:**
  1. En **Gastos** pulsa **Registrar gasto**, captura los datos y pulsa **Registrar gasto**.
  2. Revisa los indicadores **Por pagar** y, en Flujo de efectivo, **Egresos**.
  3. Pulsa **Pagar**, luego **Liquidar**, y **Registrar pago**.
  4. Registra otro gasto con la misma factura y el mismo proveedor.
- **Resultado esperado:**
  - Paso 2: el gasto es costo del proyecto (+$4,500), pero aparece en **Por pagar** y no en Egresos.
  - Paso 3: pasa a pagado y el egreso aparece en Flujo de efectivo.
  - Paso 4: rechazado con «La factura CFE-PRUEBA-1 de ese proveedor ya está registrada…». Si la regla depende del
    proveedor, repite el paso con un proveedor real.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| Pago de $20,000 desde el detalle de VTA-2026-0003: «Pago registrado.», saldo **$24,500.00**, estado Parcialmente pagada. | **Aprobada** | 05/11/2026 · Playwright (Chromium 1440×900) · compilación de producción. Evidencia: `evidencias/pag-02.png`. Automatizada: escenario de jitomate «el gasto pendiente de pago es costo, pero no egreso» ✅. |

### FIN-03 · Registrar gasto compartido

- **Módulo:** Gastos
- **Objetivo:** Comprobar el reparto exacto entre proyectos.
- **Requisitos previos:** Sesión como PROP.
- **Datos de prueba:** «Asesoría técnica prueba», $10,000, tipo Servicios profesionales. Asignación «Compartido por
  superficie» entre PRY-2026-0001 (45 ha) y PRY-2026-0002 (12 ha).
- **Pasos:**
  1. Registra el gasto con la asignación indicada.
  2. Antes de guardar, revisa **Reparto que se registrará**.
- **Resultado esperado:**
  - El reparto es proporcional (≈ $7,894.74 y $2,105.26) y suma exactamente $10,000.00.
  - Cada proyecto recibe su parte en **Detalle de costos**.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| | Pendiente | |

### FIN-04 · Consultar costos

- **Módulo:** Finanzas
- **Objetivo:** Comprobar que el costo del proyecto coincide entre pantallas.
- **Requisitos previos:** Pruebas INV-03, BIT-03, MAQ-02, RH-03 y FIN-02 ejecutadas.
- **Datos de prueba:** PRY-2026-0002.
- **Pasos:**
  1. Anota el **Costo de producción acumulado** del expediente y la suma del **Detalle de costos**.
  2. Compara con **Dashboard financiero → Costos por proyecto** y con **Reportes financieros → Costos de producción**.
  3. Revisa el costo por ha y por kg.
- **Resultado esperado:**
  - Las cifras coinciden en las tres pantallas.
  - Costo por ha = costo ÷ 12 ha.
  - El costo por kg muestra «Sin cosecha» si el proyecto no tiene cortes.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| Pago de $24,500 capturado a mano (no se probó el botón **Liquidar**): saldo $0.00 y estado **Pagada**. | **Parcial** | 05/11/2026 · Playwright (Chromium 1440×900) · compilación de producción. Evidencia: `evidencias/pag-03.png`. Automatizada: escenario de jitomate «sin costos duplicados…» ✅. |

### FIN-05 · Comparar presupuesto contra gasto

- **Módulo:** Presupuestos
- **Objetivo:** Comprobar la comparación y las alertas de presupuesto.
- **Requisitos previos:** FIN-01 aprobada. Datos demo.
- **Datos de prueba:** Proyecto de maíz (demo: semilla al 104 %). Umbrales 60 / 80 / 100 %.
- **Pasos:**
  1. Abre **Presupuestos** y revisa la tarjeta **Alertas**.
  2. Abre el proyecto de maíz → **Presupuesto contra gasto real**.
  3. Pulsa **Alertas**, cambia los umbrales a 60 / 80 / 100 y pulsa **Guardar umbrales**.
  4. Captura 90 / 80 / 100.
- **Resultado esperado:**
  - Paso 2: la categoría Semillas aparece excedida.
  - Paso 3: los estados se recalculan con los umbrales nuevos.
  - Paso 4: se rechaza, porque cada umbral debe ser mayor que el anterior.
  - Restaura 70 / 90 / 100 al terminar.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| | Pendiente | |

### FIN-06 · Consultar rentabilidad

- **Módulo:** Rentabilidad
- **Objetivo:** Comprobar el cálculo del resultado estimado.
- **Requisitos previos:** Datos demo.
- **Datos de prueba:** PRY-2026-0003 Brócoli.
- **Pasos:**
  1. Abre **Rentabilidad → Por proyecto**.
  2. Para Brócoli, comprueba que **Resultado** = ventas − costo acumulado y que cobrado + pendiente = ventas.
  3. Abre la pestaña **Por cultivo** y filtra por **Cultivo** Brócoli.
- **Resultado esperado:**
  - Las igualdades se cumplen.
  - Las cifras coinciden con la tarjeta **Costos y resultados** del expediente.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| **Saldo pendiente** $142,000.00 = suma de **Ventas con saldo** (VTA-2026-0001) = total de **Antigüedad de saldos por cliente**. Recuperación 80.9 %. | **Aprobada** | 05/11/2026 · Playwright (Chromium 1440×900) · compilación de producción. Evidencia: `evidencias/pag-04.png`, `evidencias/pag-04-cobranza.png`. Automatizada: integración «calcula costos de producción y rentabilidad sin duplicar» ✅. |

### FIN-07 · Flujo de efectivo

- **Módulo:** Flujo de efectivo
- **Objetivo:** Comprobar que el flujo registra solo dinero real.
- **Requisitos previos:** PAG-02, PAG-03 y FIN-02 aprobadas.
- **Datos de prueba:** Otro ingreso de $5,000, concepto «Apoyo prueba», método Transferencia.
- **Pasos:**
  1. Filtra el periodo de hoy y revisa **Ingresos** y **Egresos**.
  2. Pulsa **Registrar movimiento**, elige **Tipo** «Otro ingreso», captura los datos y registra.
  3. Cancela ese movimiento con motivo.
- **Resultado esperado:**
  - Paso 1: los ingresos incluyen los pagos de PAG-02 y PAG-03; los egresos, el pago de FIN-02.
  - Paso 2: los ingresos aumentan $5,000.
  - Paso 3: el movimiento deja de contar y queda en **Movimientos capturados** como cancelado.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| «El pago ($50,000.00) excede el saldo pendiente de la venta ($44,500.00)». No se registra. | **Aprobada** | 05/11/2026 · Playwright (Chromium 1440×900) · compilación de producción. Evidencia: `evidencias/pag-05.png`. Automatizada: escenario de jitomate «el flujo de efectivo cuenta el dinero una sola vez» ✅. |

### REP-01 · Reportes operativos y descarga CSV

- **Módulo:** Reportes operativos
- **Objetivo:** Comprobar la consulta y la descarga.
- **Requisitos previos:** Sesión como AGRO.
- **Datos de prueba:** Reporte «Consumo de insumos», todo el año.
- **Pasos:**
  1. Abre **Reportes operativos** y elige **Consumo de insumos**.
  2. Filtra el periodo y pulsa **Aplicar**.
  3. Pulsa **CSV** y abre el archivo en una hoja de cálculo.
  4. Recorre las 9 pestañas de reportes.
- **Resultado esperado:**
  - El archivo contiene las mismas filas y totales que la pantalla, con acentos correctos.
  - No hay botones Excel ni PDF (limitación conocida).

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| | Pendiente | |

### REP-02 · Reportes financieros y descarga CSV, Excel y PDF

- **Módulo:** Reportes financieros
- **Objetivo:** Comprobar la consulta y los tres formatos de descarga.
- **Requisitos previos:** Sesión como PROP.
- **Datos de prueba:** Reporte «Estado financiero».
- **Pasos:**
  1. Abre **Reportes financieros → Estado financiero**.
  2. Pulsa **CSV**, **Excel** y **PDF**.
  3. Abre el .xlsx.
- **Resultado esperado:**
  - El Excel tiene números y fechas reconocidos como tales, no como texto.
  - **PDF** abre la impresión del navegador solo con el reporte.
  - Las cifras coinciden con **Rentabilidad**.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| | Pendiente | |

---

## 13. Pruebas de seguridad

### SEG-01 · Acceso con diferentes roles

- **Módulo:** Seguridad
- **Objetivo:** Comprobar que las restricciones también se aplican al escribir la dirección directamente.
- **Requisitos previos:** Ninguno.
- **Datos de prueba:**
  - Usuario CONS: http://localhost:3000/proyectos/nuevo y http://localhost:3000/ventas/nueva.
  - Usuario CAMPO: http://localhost:3000/finanzas y http://localhost:3000/clientes.
  - Usuario J-ALM: http://localhost:3000/gastos.
- **Pasos:** inicia sesión con cada usuario y escribe cada dirección en la barra del navegador.
- **Resultado esperado:**
  - CONS en `/proyectos/nuevo`: regresa a **Proyectos**.
  - CONS en `/ventas/nueva`: «Sin acceso a este módulo».
  - CAMPO y J-ALM: «Sin acceso a este módulo» en las pantallas financieras y comerciales.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| Brócoli: ventas $743,500.00 − costo $751,027.65 = resultado −$7,527.65; cobrado $601,500.00 + por cobrar $142,000.00 = ventas. (Cifras posteriores a PAG-02/03.) | **Aprobada** | 05/11/2026 · Playwright (Chromium 1440×900) · compilación de producción. Evidencia: `evidencias/fin-06.png`. Recorrido HTTP del 5-nov: coinciden para CONS, CAMPO y AGRO; J-ALM no se recorrió. |

### SEG-02 · Información de otra organización

- **Módulo:** Seguridad
- **Objetivo:** Comprobar que una organización no ve datos de otra, aunque conozca la dirección.
- **Requisitos previos:** `npm run demo:jitomate` ejecutado.
- **Datos de prueba:** Usuario J-PROP (organización «Escenario jitomate») y estas direcciones de la organización
  «Agropecuaria Los Campos»:
  - `/proyectos/00000000-0000-4000-a400-000000000001`
  - `/ventas/00000000-0000-4000-a900-000000000001`
  - `/clientes/00000000-0000-4000-a800-000000000003`
  - `/produccion/lotes/00000000-0000-4000-a910-000000000004`
- **Pasos:**
  1. Inicia sesión como J-PROP.
  2. Escribe cada dirección.
  3. Revisa listados, buscadores y selectores de Proyectos, Clientes e Inventario.
- **Resultado esperado:**
  - Cada dirección muestra **Página no encontrada** («La dirección que buscas no existe o fue movida»).
  - Ningún listado ni selector muestra datos de «Agropecuaria Los Campos».

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| CSV «consumo-insumos_2026-01-01_2026-11-05.csv» con acentos correctos. 9 pestañas: Consumo de insumos, Existencias, Por caducar, Riegos, Aplicaciones, Jornadas, Mano de obra, Maquinaria, Costos operativos. Sin botones Excel ni PDF. | **Aprobada** | 05/11/2026 · Playwright (Chromium 1440×900) · compilación de producción. Evidencia: `evidencias/rep-01.png`. Automatizada: integración «otra organización no ve los datos», «no escribe ni ejecuta operaciones», «no se referencian datos de otra organización» ✅. |

### SEG-03 · Operación sin autorización

- **Módulo:** Seguridad
- **Objetivo:** Comprobar que el servidor rechaza una operación aunque el formulario se haya abierto con permiso.
- **Requisitos previos:** Dos navegadores, o una ventana normal y una privada.
- **Datos de prueba:** AGRO en la ventana A y PROP en la ventana B.
- **Pasos:**
  1. Ventana A (AGRO): abre **Bitácoras → Riego** y llena el formulario **sin guardarlo**.
  2. Ventana B (PROP): en **Usuarios y roles** cambia el rol de AGRO a **Consulta**.
  3. Ventana A: pulsa **Registrar riego**.
  4. Ventana B: restaura el rol **Agrónomo**.
- **Resultado esperado:**
  - Paso 3: «No tienes permiso para realizar esta operación.» y el riego no se guarda.
  - Tras el paso 4, AGRO vuelve a registrar normalmente.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| Descargas «estado-financiero_2026-11-05.csv» y «.xlsx» correctas; botón PDF presente. No se abrió el .xlsx en una hoja de cálculo ni se probó la impresión. | **Parcial** | 05/11/2026 · Playwright (Chromium 1440×900) · compilación de producción. Evidencia: `evidencias/rep-02.png`. Automatizada: integración «un supervisor de campo no mueve inventario», «el supervisor no ve ventas ni registra ventas», «consulta lee la rentabilidad pero no registra pagos» ✅. |

### SEG-04 · Protección de archivos

- **Módulo:** Seguridad
- **Objetivo:** Comprobar que las evidencias son privadas y que solo se aceptan formatos permitidos.
- **Requisitos previos:** BIT-02 aprobada (aplicación con foto). Un archivo .txt y una imagen de más de 10 MB.
- **Datos de prueba:** La foto de BIT-02.
- **Pasos:**
  1. Como CAMPO, en una bitácora abre **Evidencias → Agregar fotografías** y elige el .txt.
  2. Elige la imagen de más de 10 MB.
  3. Abre la foto de BIT-02 en una pestaña nueva y copia su dirección.
  4. Pega la dirección en una ventana privada sin sesión, antes y después de 30 minutos.
  5. En la dirección, cambia `/object/sign/` por `/object/public/` y elimina el parámetro `?token=…`.
- **Resultado esperado:**
  - Pasos 1 y 2: «Solo imágenes JPG, PNG, WEBP o HEIC de hasta 10 MB.» y no se sube nada.
  - Paso 4: la liga firmada funciona solo por tiempo limitado (30 min) y después falla.
  - Paso 5: el acceso público se rechaza, porque el depósito `evidencias` es privado.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| Variante inversa: PROP (Agropecuaria Los Campos) abre la URL de una venta de la organización jitomate y obtiene **Página no encontrada**. No se recorrieron las 4 direcciones ni los selectores. | **Parcial** | 05/11/2026 · Playwright (Chromium 1440×900) · compilación de producción. Evidencia: `evidencias/seg-02.png`. Automatizada: integración «Storage: no se leen ni suben evidencias de otra organización», «Storage: rechaza formatos no permitidos» ✅. |

### SEG-05 · Desactivar usuario

- **Módulo:** Seguridad / Usuarios
- **Objetivo:** Comprobar que un usuario desactivado pierde el acceso y que no se puede desactivar uno mismo.
- **Requisitos previos:** AUT-07 aprobada (usuario invitado).
- **Datos de prueba:** «invitado.prueba@ejemplo.mx».
- **Pasos:**
  1. Como PROP, edita al invitado, cambia el **Estado** a «Inactivo (sin acceso)» y pulsa **Desactivar usuario**.
  2. Inicia sesión como el invitado.
  3. Como PROP, edítate a ti mismo.
- **Resultado esperado:**
  - Paso 2: el invitado ya no entra a la organización (pantalla **Bienvenido** para crear una).
  - Paso 3: aparece «No puedes desactivar tu propia cuenta.».

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| | Pendiente | |

---

## 14. Pruebas PWA y sin conexión

> **Implementado:** manifiesto, service worker, botón **Instalar app**, pantalla «Sin conexión», **Captura en campo**
> con IndexedDB y sincronización.
>
> **Verificado en navegador automatizado** (32 de 32 pruebas de Playwright, 5 de noviembre de 2026): manifiesto, registro
> del service worker, captura sin conexión, sincronización al volver la red y aviso «Sin conexión».
>
> **No verificado:** la instalación en dispositivos reales y la sincronización en
> segundo plano.
>
> Ejecuta esta sección con `npm run build && npm start`.

### PWA-01 · Instalar aplicación

- **Módulo:** PWA
- **Objetivo:** Comprobar la instalación en computadora y teléfono.
- **Requisitos previos:** Compilación de producción en ejecución. Chrome en computadora. Para el teléfono, la aplicación
  publicada con HTTPS, o el teléfono conectado a la red con un túnel HTTPS.
- **Datos de prueba:** Usuario CAMPO.
- **Pasos:**
  1. Inicia sesión y pulsa **Instalar app** en la barra superior.
  2. Acepta el aviso del navegador.
  3. En iPhone, pulsa **Instalar app** y sigue **Compartir → Agregar a pantalla de inicio**.
- **Resultado esperado:**
  - Se crea el ícono «AgroGestión» en el escritorio o en la pantalla de inicio.
  - En iPhone se muestran las instrucciones de dos pasos.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| | Pendiente | Automatizada: `tests/e2e/pwa.spec.ts` (manifiesto, íconos y registro del service worker) ✅. La instalación en un dispositivo real no se ha verificado. |

### PWA-02 · Abrir la aplicación instalada

- **Módulo:** PWA
- **Objetivo:** Comprobar que la app abre en su propia ventana y ofrece sus accesos directos.
- **Requisitos previos:** PWA-01 aprobada.
- **Datos de prueba:** —
- **Pasos:**
  1. Abre la app desde el ícono.
  2. Haz clic derecho o pulsación larga en el ícono.
- **Resultado esperado:**
  - Abre sin la barra del navegador.
  - Paso 2: aparecen los accesos **Captura en campo**, **Bitácoras** y **Producción**.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| | Pendiente | |

### PWA-03 · Registrar información sin conexión

- **Módulo:** Captura en campo
- **Objetivo:** Comprobar la captura sin red.
- **Requisitos previos:** Sesión como CAMPO. Haber abierto **Captura en campo** con conexión al menos una vez.
- **Datos de prueba:**
  - Riego: PRY-2026-0002, Parcela Norte, hoy, de 06:00 a 08:00.
  - Observación: categoría Plaga, severidad Media, «Pulgón en hojas bajeras», con foto.
  - Corte: PRY-2026-0003, Lote 1, 100 cajas × 20 kg.
- **Pasos:**
  1. En DevTools → Network elige **Offline**, o activa el modo avión del teléfono.
  2. Recarga **Captura en campo**.
  3. Registra el riego, la observación y el corte con **Guardar riego**, **Guardar observación** y **Guardar corte**.
  4. Abre otra pantalla, por ejemplo **Ventas**.
- **Resultado esperado:**
  - **Captura en campo** abre sin red y muestra «Sin conexión».
  - Cada registro muestra «Guardado en el dispositivo. Se enviará cuando haya señal.» y queda **Pendiente** en
    **Registros**.
  - La barra superior muestra **Sin conexión · 3**.
  - **Ventas** muestra «Sin conexión — Esta sección necesita internet».

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| | Pendiente | Automatizada: `tests/e2e/offline.spec.ts` (captura sin red y sincronización al volver la conexión) ✅. |

### PWA-04 · Recuperar conexión y sincronizar

- **Módulo:** Captura en campo
- **Objetivo:** Comprobar el envío automático al volver la red.
- **Requisitos previos:** PWA-03 aprobada.
- **Datos de prueba:** Los 3 registros pendientes.
- **Pasos:**
  1. Quita el modo **Offline**.
  2. Espera o pulsa **Sincronizar**.
  3. Revisa **Bitácoras → Riego**, **Bitácoras → Observaciones** y **Producción → Cortes**.
- **Resultado esperado:**
  - Los 3 registros pasan a **Sincronizado**, con fecha.
  - La foto se carga.
  - Los registros aparecen en Bitácoras y en Producción; el corte con su nuevo lote.
  - El indicador de la barra superior desaparece.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| | Pendiente | Automatizada: integración «sincroniza un riego…», «sincroniza una observación con su fotografía pendiente» ✅. |

### PWA-05 · Comprobar que no existan duplicados

- **Módulo:** Sincronización
- **Objetivo:** Comprobar que reintentos y cortes de red no duplican registros.
- **Requisitos previos:** PWA-04 aprobada.
- **Datos de prueba:** Un riego nuevo sin conexión.
- **Pasos:**
  1. Captura un riego sin conexión.
  2. Recupera la red y, mientras se envía, vuelve a poner **Offline**.
  3. Recupera la red y pulsa **Sincronizar** varias veces.
  4. Cuenta los riegos de ese proyecto, fecha y horario en **Bitácoras**.
- **Resultado esperado:**
  - Existe exactamente **un** riego.
  - El registro termina en **Sincronizado**.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| | Pendiente | Automatizada: integración «no duplica al reintentar (idempotencia)», «una falla de red es transitoria…» ✅. |

### PWA-06 · Consultar registros pendientes o fallidos

- **Módulo:** Captura en campo
- **Objetivo:** Comprobar el manejo de un rechazo del servidor.
- **Requisitos previos:** Sesión como CAMPO.
- **Datos de prueba:** Sin conexión, una aplicación de «Fungicida clorotalonil 720» con **Descontar del almacén** de 50 l
  (hay 34 l).
- **Pasos:**
  1. Captura la aplicación sin conexión.
  2. Recupera la red.
  3. En **Registros**, lee el estado y el motivo.
  4. Pulsa **Corregir**, cambia la cantidad a 5 l y pulsa **Reintentar**.
- **Resultado esperado:**
  - Paso 3: queda **Requiere revisión**, con un motivo de existencia insuficiente, y no se descuenta nada.
  - Paso 4: se sincroniza y descuenta 5 l una sola vez.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| | Pendiente | Automatizada: integración «revalida existencias…», «tras corregir la causa, el reintento se sincroniza y descuenta una sola vez» ✅. |

### PWA-07 · Revisión y descarte en Sincronización

- **Módulo:** Sincronización
- **Objetivo:** Comprobar que un revisor ve los rechazos del equipo y puede descartarlos.
- **Requisitos previos:** Un registro de CAMPO en **Requiere revisión**: repite PWA-06 sin corregir.
- **Datos de prueba:** Usuario AGRO. Motivo «Captura de prueba».
- **Pasos:**
  1. Como AGRO, abre **Operación → Sincronización**, pestaña **Requieren revisión**.
  2. Pulsa **Descartar registro**, captura el motivo y confirma.
  3. Como CAMPO, abre **Captura en campo → Registros** y pulsa **Sincronizar**.
- **Resultado esperado:**
  - AGRO ve el registro con el autor y el error.
  - Tras descartar, el registro pasa a **Descartados**.
  - En el dispositivo de CAMPO aparece **Descartado** y deja de reintentarse.

| Resultado obtenido | Estado | Observaciones |
| ------------------ | ------ | ------------- |
| | Pendiente | Automatizada: integración «un revisor descarta y el dispositivo deja de reintentar» ✅. |

---

## 15. Cierre de la ejecución

Al terminar:
1. Actualiza la columna **Estado** del resumen (1.6) y los totales.
2. Para cada prueba **Rechazada**, registra:
   - Los pasos para reproducir el problema.
   - El mensaje exacto.
   - Una captura de pantalla.
   - El navegador.
3. Ejecuta `npm run db:reset` para devolver los datos de demostración a su estado inicial.
4. Repite las pruebas rechazadas después de cada corrección.
