# ObraSaaS — comparación competitiva y plan transversal por ciclos

Fecha de revisión: 18 de septiembre de 2026. Base de código revisada: rama de recuperación a partir de 0b55859. Este documento complementa, no reemplaza, PLAN_DE_IMPLEMENTACION_CODEX.md y walkthrough.md.

## 1. Qué se comparó y qué no
Se consultaron páginas oficiales de Jelou, Procore, Fieldwire, PlanRadar y Sienge. Las capacidades descritas abajo son publicaciones del proveedor: no se accedió a una cuenta comercial ni se ejecutó una prueba de rendimiento de esos productos. No se copiaron interfaces, marca, imágenes o código. Las decisiones de ObraSaaS son inferencias de producto y arquitectura, separadas de esas afirmaciones.

El plan maestro denomina 14 módulos «100%» y el walkthrough describe interfaces y demostraciones. Esas etiquetas documentales no prueban que cada botón persista, que los canales externos estén activos o que los circuitos se hayan cerrado con personas reales. Las verificaciones del repositorio, del navegador controlado y del preview autenticado deben registrarse por separado, con SHA y entorno.

## 2. Referencias oficiales revisadas
| Referencia | Capacidades publicadas por el proveedor | Criterio adoptado para ObraSaaS |
| --- | --- | --- |
| Jelou / Brain Studio | Workflows, herramientas reutilizables, bandeja multicanal y transferencia a atención humana con contexto. Presenta agentes que ejecutan acciones transaccionales y un centro para observar la operación. | El mensaje debe producir un caso/registro rastreable, no una conversación aislada. Las herramientas llaman al dominio autorizado y explican el resultado; no replican reglas de compra, medición o aprobación. |
| Procore Project Management | Conexión entre equipos, documentación, reportes diarios, tareas, aprobaciones y operación móvil/offline. | Mantener una identidad de obra/tarea/documento y visibilidad de pendientes; validar offline y cambios de versión, sin confundir una vista gráfica con un proceso operativo. |
| Fieldwire | Coordinación de tareas en terreno, planos, fotos/videos, seguimiento y reportes. | El operario debe llegar a capturar y consultar su tarea con pocos pasos. Foto, observación y actividad deben quedar vinculadas. |
| PlanRadar | Documentación, inspecciones, incidencias y reportes durante construcción y operación. | Observaciones con responsables, estado, evidencia y camino de corrección; no dejar un rechazo o una incidencia sin una acción siguiente. |
| Sienge | Ecosistema de construcción que vincula planificación, suministros, costos, finanzas y ciclo inmobiliario. | Una necesidad de obra debe relacionarse con la compra y su recepción, y luego con costo/contrato cuando corresponda. No trasladar automáticamente reglas fiscales brasileñas al producto argentino. |

Fuentes: https://www.jelou.ai/es/ ; https://docs.jelou.ai/ ; https://www.procore.com/project-management ; https://www.fieldwire.com/ ; https://www.planradar.com/es/ ; https://sienge.com.br/ . Consulta pública en la fecha indicada. La diferenciación y las recomendaciones de este documento no son una certificación de superioridad frente a esas empresas.

## 3. Problema transversal observado en el código
La navegación reunía 28 destinos de obra/gestión/exploración en listas largas. Había nombres ambiguos («Bitácora» para auditoría además de «Bitácora de avance», «blockers», «SOV») y los pendientes se consultaban en módulos distintos. La rama ya tiene persistencia y flujos revisables; sumar otra pantalla independiente no resuelve esa fragmentación.

Se implementa sobre el inicio existente, no como otro módulo paralelo: Centro de operaciones, bandejas autorizadas con datos reales, accesos por ciclo, navegación por las mismas rutas y agrupación compartida con el buscador. Los formularios y motores de decisión siguen en sus dominios originales. Ninguna tarjeta ejecuta compras, mensajes, aprobaciones o pagos al abrirse.

## 4. Arquitectura de información que se aplica
1. Trabajo diario: Hoy, Campo móvil, Bandeja WhatsApp, Canal de campo, Aprobaciones y Notificaciones.
2. Planificación y equipo: Cronograma, Cuadrillas y restricciones, Personal, Asistencia y turnos, Escenarios de plan.
3. Calidad y avance: Bitácora de avance, Inspecciones, Mediciones, Trabajo extra.
4. Abastecimiento y costos: Presupuesto, Compras y recepción, Cuentas por pagar, Caja, Contratos y partidas.
5. Empresa y control: Obras, Reporte, Historial y auditoría, Equipo y roles, Integraciones, Puesta en marcha, Privacidad.
6. Exploración: capacidades en evaluación, diferenciadas de la operación persistente.

La agrupación opera después del filtro de permisos existente. No hace visibles destinos que ese rol no recibió. Conserva rutas, navegación dura de privacidad, badges y protección de cambios locales. El buscador Ctrl/Cmd+K usa esos mismos grupos; los enlaces nuevos no abren todas las rutas ni precargan fuentes privadas. La ubicación visible combina ciclo y sección.

## 5. Regla de calidad para cada acción
Toda acción operativa debe especificar origen, obra, entidad y versión; permiso de lectura/escritura; estado inicial; validación; confirmación y efecto; respuesta de error; recuperación/idempotencia cuando haya escritura; registro de auditoría; destinatario humano cuando corresponda y siguiente paso visible. Una etiqueta «IA», un toast o un HTTP 200 no reemplazan esa verificación.

Estados UX obligatorios: sin datos reales, cargando, listo, guardando, confirmado, conflicto, contexto cambiado, sin permiso, sin conexión y respuesta incierta. Un fallo no se transforma en cero pendientes. Cambiar de empresa/obra no puede reutilizar un borrador contra otro contexto. Un conteo de muestra no se presenta como total global.

Las decisiones sensibles siguen requiriendo autorización de su módulo. El sistema puede preparar propuestas o mostrar pendientes sin que ello habilite nómina, pagos, compra automática o certificación. El cumplimiento legal y una firma digital válida no se deducen de un hash: esas afirmaciones del plan requieren validación normativa específica, fuera del alcance de esta comparación.

## 6. Matriz de cierre de los 14 módulos originales
La columna de aceptación define trabajo pendiente de verificar; no indica que se haya implementado todo en esta tanda.
| Módulo del plan | Ciclo y conexión de destino | Criterio verificable para darlo por cerrado |
| --- | --- | --- |
| Dashboard / simulador | Hoy, campo y bandejas autorizadas | Separar datos sintéticos; indicadores con fuente y hora; acceso al siguiente paso y lectura coherente con PostgreSQL. |
| Certificación | Mediciones → contratos/partidas → corte → certificado | Cantidades aprobadas y valores versionados; reglas contractuales explícitas; doble control cuando aplique; documento trazable sin equiparar hash a firma. |
| Coordinación visual | Evidencia → tarea → incidencia/inspección → revisión | Original privado, responsable y estado; explicación de una clasificación; corrección enlazada y no borrado del antecedente. |
| Ejecutivo | Agregados por obra y cartera | Métricas con período, población, unidad y fuente. No ROI/SPIs de ejemplo como resultados reales. Navegación al dato de origen. |
| Compliance | Roles, auditoría, documentación y vencimientos | Cada control respalda evidencia vigente y regla versionada. No score fijo 94/100 ni afirmaciones de certificación sin comprobación. |
| Licitaciones | Fuente de pliego → oportunidad → oferta → contrato | Procedencia y fecha comprobables, versiones y responsables. Una lista de pliegos demo no se presenta como monitoreo oficial. |
| Presupuesto | Partidas → revisiones → propuesta → aceptación | Unidades/cantidades/precios persistidos; revisión de supuestos e impuestos; reutilización de partidas aceptadas en contrato y control de costos. |
| Marketplace/corralones | Requerimiento → cotización → orden → recepción → inventario/cuenta | Proveedor autorizado; emisión explícita; recepción parcial/rechazada y faltantes conciliados; no 1-clic masivo sin destinatarios confirmados. |
| Libro de obra | Parte → revisión → folio/documento | Separar borrador operativo de asiento formal. Numeración, autor, revisión y documento fuente; correcciones preservan antecedentes. |
| Inspecciones | Plantilla → captura → envío → dictamen → corrección | Criterios de aceptación explícitos por tarea y normativa aplicable; permisos de decisión; historial y evidencia; revisión en móvil real. |
| Planos / punch list | Documento/revisión → ubicación → tarea/incidencia | La revisión del plano acompaña cada anotación. No medir a partir de una escala ficticia; gestionar versiones y conflictos. |
| Cronograma | Tareas/dependencias → evidencia → medición → pronóstico | Evidencia aprobada no equivale a avance medido. Fecha prevista no reescribe línea base; mostrar fuente, supuestos y autorización para cambios. |
| BIM | Archivo IFC real → identificador de elemento → tarea/medición | Verificar carga de un modelo real y cantidades/unidades; un dibujo isométrico no demuestra interoperabilidad IFC. |
| Portal del inversor | Identidad/unidad → datos publicados → certificados/cuotas | Acceso mínimo por participante y unidad; publicar sólo avances y documentos autorizados; no exponer personal, otros inversores o datos internos. |

## 7. Brechas prioritarias y secuencia de implementación
**P0 · Operación trazable y piloto.** Cerrar físicamente el canal de la app Meta ObraSaaS: número correcto, recepción firmada, identidad autorizada, obra/tarea, persistencia y respuesta de entrega. Verificar con los dos participantes ya autorizados antes de incorporar albañiles. Distinguir consola de Meta, backend, pruebas controladas y uso real. Recibir audio/imagen/video no demuestra que el contenido ya se haya transcrito o analizado.

**P0 · Validación transversal de rutas.** Inventario por ruta real y rol; ninguna acción decorativa; pruebas de acceso directo, permisos negativos, cambio de contexto, guardado/recarga, registro final y ausencia de duplicados. Validar en el mismo SHA publicado. No sustituir el resultado por el número acumulado de tests.

**P1 · Fuentes y decisiones conectadas.** Para cada medio: identidad + fuente privada + contexto de obra/tarea + propuesta revisable. Medición física con unidad/base/cantidad y maker-checker; pronóstico con supuestos. La IA debe abstenerse cuando la evidencia no permite determinar una cantidad. No entrenar automáticamente con los medios de Victoria.

**P1 · Móvil y offline real.** Cola por empresa/obra/usuario, archivos y límites, claves idempotentes, expiración de sesión, conflicto y cancelación. Probar desconectar, cerrar/reabrir, volver con otra obra y recuperar sin duplicar. El fallback PWA actual no sustituye este circuito. Evaluar Android e iPhone físicos, accesibilidad y rendimiento con red de obra.

**P1 · Conversación a excepción resuelta.** Que cada mensaje tenga estado, responsable, vencimiento, contexto y transferencia a una persona sin perder historial. Instrumentar errores del canal y del dominio por separado; reintentos seguros, no envíos repetidos a contactos como única prueba.

**P2 · Administración y finanzas.** Cerrar abastecimiento/recepciones parciales, conciliación de costos, presupuestos/contratos/certificados, nómina y pagos con fuentes verificadas. Homologar integraciones antes de afirmar facturación, firma o cumplimiento. Separar cobro SaaS de cuotas de una obra y de pagos a proveedores.

**P2 · Reconocimientos responsables.** El programa de puntos sugerido por el usuario debe basarse en aportes y criterios auditables, con explicación y revisión. No puntuar productividad de una cara/foto ni automatizar decisiones laborales. No premiar «cero incidentes» de modo que incentive ocultar reportes. Datos de asistencia corregibles y exclusiones justificadas; premios presupuestados con autorización, no descuentos de sueldo automáticos.

## 8. Medición de progreso del producto
Registrar por release: flujos E2E aprobados/reprobados, pasos para completar cada tarea, errores recuperables sin pérdida, duplicados, cruces de tenant bloqueados, latencia medida por red/dispositivo, fuentes con datos faltantes y cobertura por rol. Son métricas que deben medirse, no cifras inventadas en la landing. Esta tanda deja una estructura operativa y contratos de prueba, no publica un SLA ni declara superioridad comercial.

## 9. Qué se entrega ahora
Se implementan menú organizado por ciclos, catálogo compartido con búsqueda, ubicación contextual y Centro de operaciones dentro de Hoy. Siete tipos de bandeja leen datos existentes con permisos, total real y hasta tres ejemplos por bandeja. Una fuente fallida queda desconocida; las demás siguen consultables. Se usa el estado registrado del canal sin confundirlo con operación física verificada. No se cambian motores de escritura, tablas, credenciales, planes o producción.

La comprobación exacta de esta entrega (tests, build, navegador, SHA y preview) se documenta en el PR después de ejecutar las validaciones. Las futuras filas del roadmap no deben contarse como funciones publicadas por existir en este documento.
