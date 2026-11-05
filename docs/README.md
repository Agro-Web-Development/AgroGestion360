# Documentación de AgroGestión 360

Índice de toda la documentación del proyecto. Versión piloto · 5 de noviembre de 2026 · commit `49f3644`.

---

## 1. Por dónde empezar

| Si eres… | Empieza por |
| -------- | ----------- |
| Usuario de la aplicación (propietario, agrónomo, supervisor, almacén, finanzas) | [Manual de usuario](manual/manual_usuario_agrogestion_360.md) |
| Responsable de pruebas o de la puesta en marcha | [Guía de pruebas funcionales](pruebas/guia_pruebas_funcionales.md) y [Matriz de resultados](pruebas/matriz_resultados_pruebas.md) |
| Quien quiere ver la aplicación funcionando de punta a punta | [Escenario de prueba integral](pruebas/escenario_prueba_integral.md) |
| Quien decide sobre el producto o el alcance | [Inventario de funcionalidades](analisis/inventario_funcionalidades.md) |
| Desarrollador o administrador técnico | [Arquitectura](arquitectura.md) y [Despliegue](despliegue.md) |

---

## 2. Estructura de la carpeta

```
docs/
├── README.md                              Este índice
├── manual/
│   ├── manual_usuario_agrogestion_360.md  Manual de usuario (17 capítulos + anexo)
│   └── images/                            56 capturas reales de la aplicación
├── pruebas/
│   ├── guia_pruebas_funcionales.md        78 casos de prueba, con resultado y estado
│   ├── escenario_prueba_integral.md       Caso práctico: proyecto de jitomate de 5 ha
│   ├── matriz_resultados_pruebas.md       Estado consolidado de todas las pruebas
│   └── evidencias/                        Capturas y archivos de la ejecución de pruebas
├── analisis/
│   └── inventario_funcionalidades.md      Qué está implementado, parcial, pendiente o sin verificar
└── (documentos técnicos)                  Arquitectura, base de datos, seguridad, despliegue…
```

---

## 3. Documentación funcional

| Documento | Contenido |
| --------- | --------- |
| [Manual de usuario](manual/manual_usuario_agrogestion_360.md) | Requisitos, acceso, interfaz, proyectos, ranchos y parcelas, inventario, bitácoras, maquinaria, personal, producción, ventas, cobranza, costos y presupuestos, reportes, usuarios y permisos, problemas frecuentes. Con capturas reales y ejemplos. |
| [Guía de pruebas funcionales](pruebas/guia_pruebas_funcionales.md) | 78 pruebas manuales por módulo: objetivo, requisitos, datos, pasos, resultado esperado, resultado obtenido y estado. |
| [Escenario de prueba integral](pruebas/escenario_prueba_integral.md) | Proyecto de jitomate en 20 pasos, del rancho a la cobranza, con hoja de comprobación de cifras. |
| [Matriz de resultados de pruebas](pruebas/matriz_resultados_pruebas.md) | Resumen por estado y por módulo, matriz de las 78 pruebas, resultados de las 694 pruebas automatizadas, diferencias corregidas y defectos. |
| [Inventario de funcionalidades](analisis/inventario_funcionalidades.md) | Funcionalidades implementadas, parciales, pendientes y no verificadas, con su evidencia; permisos por rol; modelo de datos. |

### Estado en una línea

- **Funcionalidades:** 42 implementadas, 6 parciales, 3 pendientes, 3 sin verificar (requieren correo o dispositivo real).
- **Pruebas automatizadas:** 694 de 694 aprobadas.
- **Pruebas funcionales desde la pantalla:** 32 ejecutadas (25 aprobadas, 7 parciales, 0 rechazadas) y 46 pendientes.

---

## 4. Documentación técnica

| Documento | Contenido |
| --------- | --------- |
| [Arquitectura](arquitectura.md) | Estructura del código, módulos y flujo de datos. |
| [Base de datos](base-de-datos.md) | Tablas, vistas, funciones y reglas de acceso. |
| [Seguridad](seguridad.md) | Autenticación, roles, RLS y protección de archivos. |
| [PWA y modo sin conexión](pwa-offline.md) | Service worker, captura en campo y sincronización. |
| [SaaS y suscripciones](saas-suscripciones.md) | Planes, límites y arquitectura propuesta para el cobro (no implementado). |
| [Despliegue](despliegue.md) | Puesta en producción. |
| [Solución de errores](solucion-de-errores.md) | Errores técnicos frecuentes y su solución. |
| [Decisiones](decisiones.md) | Registro de decisiones y supuestos, incluidos los criterios de cálculo. |
| [Auditoría integral](auditoria-integral.md) | Auditoría con el escenario de jitomate y correcciones D1–D9. |
| [Informe de la Fase 6](informe-fase-6.md) | Funcionalidades, pruebas, riesgos y recomendaciones de la preparación comercial. |

---

## 5. Cómo consultar el manual

- **En GitHub o en el editor:** abre los archivos `.md`; las imágenes y los enlaces entre documentos son relativos y se
  ven directamente. En VS Code usa **Abrir vista previa** (Ctrl+Shift+V).
- **Navegación:** el manual empieza con un índice de capítulos con enlaces. Las referencias como «Manual 16.4» indican
  capítulo y sección.
- **Imprimir o compartir en PDF:** abre la vista previa del Markdown y usa **Imprimir → Guardar como PDF**, o conviértelo
  con una herramienta como Pandoc (`pandoc manual_usuario_agrogestion_360.md -o manual.pdf`, desde `docs/manual/` para
  que encuentre las imágenes).
- **Para probar lo que describe el manual** en un entorno local: `npm install`, `npm run db:start`, `npm run dev` y abre
  http://localhost:3000 con un usuario de demostración (ver `README.md` en la raíz, sección *Usuarios de demostración*).
