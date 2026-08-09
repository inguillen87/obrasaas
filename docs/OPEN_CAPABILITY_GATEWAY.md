# Open Capability Gateway

Fecha de decisión: 2026-08-09

## Objetivo

ObraSaaS adopta una estrategia **open-first, evidence-gated**: para cada carga se
evalúa primero una alternativa abierta o de menor costo, y se escala a un
proveedor premium sólo cuando calidad, latencia, privacidad o soporte lo
justifican. La elección se hace por capacidad y versión; nunca mediante un
alias móvil que cambie silenciosamente en Production.

Un catálogo comunitario como `public-apis/public-apis` sirve para descubrir
candidatos. No certifica por sí mismo licencia comercial, disponibilidad,
exactitud, residencia o retención de datos, límites, soporte ni continuidad.
Por eso una entrada del catálogo no se conecta directamente al dominio
operativo.

## Capas de decisión

1. **Núcleo determinista:** tenancy, identidad, permisos, asistencia, stock,
   pagos, auditoría, baseline y certificaciones. Una API o un modelo externo no
   reemplaza esta autoridad.
2. **Capacidad abierta/local:** reglas, librerías y modelos ejecutables en una
   infraestructura controlada cuando el benchmark y el costo total lo avalen.
3. **Modelo abierto hospedado:** Hugging Face Inference Providers u otro
   proveedor aprobado, con ruta y revisión fijadas.
4. **Proveedor premium:** se usa para los casos en los que gane el benchmark o
   cumpla controles que la alternativa abierta no ofrece.
5. **Revisión humana:** obligatoria para decisiones laborales, financieras,
   contractuales, de seguridad, certificación o mutación de baseline.

No hay fan-out automático ni fallback silencioso. Una salida ambigua conserva
su estado y se concilia; no se reenvía por reflejo a otro proveedor.

## Contrato de admisión de una capacidad

Cada integración debe quedar registrada con:

- `capabilityId`, proveedor, endpoint y versión de contrato inmutables;
- allowlist de host/ruta y credencial dedicada, rotatable y nunca expuesta al
  navegador;
- clase máxima de datos, campos permitidos y transformación previa;
- estado de revisión legal/comercial, licencia, subprocesadores, retención y
  región;
- timeout, tamaño máximo, rate limit, presupuesto, TTL de caché y SLO esperado;
- normalizador estricto, versión de esquema y límites semánticos;
- política de degradación explícita: dato anterior marcado como obsoleto o
  `no disponible`, nunca un valor inventado;
- telemetría sin PII, costo conciliable, health y circuit breaker;
- pruebas de tenant scope, SSRF/host allowlist, payload inválido, staleness,
  replay y ausencia de mutaciones fuera de contrato;
- owner, fecha de revisión y runbook de desactivación.

## Estado actual

La vertical de visión ya implementa gran parte del patrón:

- registro versionado para OpenAI, Hugging Face/Qwen y Z.ai;
- selección de una sola ruta, presupuesto previo, recibo durable e idempotencia;
- sanitización de imagen, esquema estricto, abstención y revisión humana;
- benchmark offline que no llama proveedores ni promueve modelos solo.

OpenAI es la única ruta con smoke real no personal. Los adapters HF y Z.ai
están probados por contrato, pero no están habilitados para fotos confidenciales
de obra. Antes de conectarlos al orquestador productivo requieren frontera
durable pre-request, política de datos por subprocesador, pricing/reserva,
liquidación compatible y benchmark reproducible. Un modelo abierto hospedado
sigue enviando datos a terceros y no equivale a costo cero.

El calendario JSON/ICS es propio y no constituye sincronización viva con Google
u Outlook. Tampoco hay hoy adapters productivos de clima, geocodificación o
datos abiertos argentinos.

## Priorización de capacidades abiertas

| Prioridad | Capacidad | Uso permitido inicial | Autoridad que conserva ObraSaaS |
| --- | --- | --- | --- |
| 1 | Clima | Riesgo consultivo por obra y ventana de tareas | No mueve fechas ni certifica demoras |
| 2 | Geocodificación | Ayuda al alta de obra y normalización de dirección | No prueba asistencia ni identidad |
| 3 | Calendarios | Suscripción/sincronización controlada de hitos | La tarea canónica permanece en ObraSaaS |
| 4 | Datos públicos AR | Enriquecimiento administrativo no sensible | No valida identidad, CUIT ni cuenta bancaria por sí solo |
| 5 | OCR abierto | Extracción propuesta de remitos/facturas | Nunca aprueba recepción, match ni pago |
| 6 | Visión abierta | Shadow sobre dataset consentido | Nunca certifica avance ni altera Gantt automáticamente |

## Primer slice: riesgo climático consultivo

El primer adapter del gateway será meteorológico porque aporta valor a obra con
un payload de riesgo relativamente bajo y crea el patrón reutilizable.

Alcance v1:

- request server-side con coordenadas redondeadas, zona horaria y ventana de
  fechas; sin trabajador, teléfono, asistencia, foto o texto de tarea;
- snapshot tenant/project scoped con proveedor, versión, hora de emisión,
  vigencia, hash y datos normalizados;
- tarjeta en calendario/Gantt con fuente, actualización y estado `vigente`,
  `obsoleto` o `no disponible`;
- caché y límite de respuesta acotados;
- cero cambios automáticos sobre Task, baseline, forecast, asistencia, pago o
  certificación;
- feature flag y kill switch por ambiente/tenant;
- proveedor habilitado sólo después de revisar uso comercial, privacidad y
  límites vigentes.

Este slice corre en paralelo y **no bloquea** los gates prioritarios del piloto:
Preview unificado, Meta E2E, roles, asistencia, foto, privacidad y operación.

## Gate de promoción

Una capacidad avanza por estos estados:

`DISCOVERED -> CONTRACT_TESTED -> PREVIEW_VERIFIED -> SHADOW_MEASURED -> PILOT_APPROVED`

`PRODUCTION_APPROVED` exige además evidencia de SLO, alertas, degradación,
revisión de datos/licencia, runbook y rollback. Ningún estado se infiere por la
popularidad del repositorio, del modelo o del proveedor.
