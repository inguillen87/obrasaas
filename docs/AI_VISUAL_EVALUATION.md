# IA visual, OCR y evaluación de modelos

Fecha de corte: 2026-07-28

## Estado verificable

ObraSaaS tiene una primera vertical de lectura visual gobernada y verificada en Preview. Incluye:

- `VisualProgressAssessment` tenant/project/task/evidence scoped, con idempotencia, huellas SHA-256, baseline hash, estados de proveedor y revisión humana CAS;
- imagen privada leída servidor a servidor, límite de bytes y píxeles, MIME contrastado con magic bytes y rechazo de WebP animado;
- derivado JPEG/PNG/WebP sin metadatos EXIF/XMP/textuales antes de abandonar ObraSaaS;
- `safety_identifier` seudónimo estable firmado con `AI_SAFETY_IDENTIFIER_SECRET`: el despacho falla cerrado si el secreto dedicado falta o tiene menos de 32 bytes y nunca deriva este identificador de `OPENAI_API_KEY`;
- opt-in separado por tenant y atestación versionada;
- `AI Dispatch Plan` previo a leer bytes privados: selecciona exactamente una ruta registrada, conserva versión de política/precio y no hace fallback ni fan-out implícito;
- presupuesto diario por tenant en micro-USD, con límite fijado por día UTC, reserva durable antes de leer la imagen y liquidación exacta desde usage versionado; cambiar el límite durante el día falla cerrado;
- recibo normalizado e inmutable persistido apenas vuelve el proveedor, antes de proyectar resultado o liquidar costo. Si el proceso cae después de la respuesta, el aplicador/replay bajo demanda reanuda ese recibo sin reenviar la imagen ni duplicar la llamada;
- revalidación de suscripción, opt-in, tarea y evidencia en la última frontera antes de llamar al proveedor;
- lease persistente de dos minutos para `RUNNING`, renovado mediante CAS en la frontera durable inmediatamente anterior al request externo y usado como fencing: una recuperación ganadora antes de esa frontera impide el despacho; después de la frontera, una respuesta tardía sólo puede continuar mediante su recibo inmutable y nunca habilita un segundo envío;
- correlación separada de request/response, tokens y costo estimado/real sin conservar prompt ni respuesta cruda; una falla previa al request libera la reserva, mientras que una salida ambigua posterior conserva la reserva y bloquea reintentos hasta conciliación explícita;
- rango de avance entero, hechos visibles, calidad, limitaciones y abstención; no se conserva prompt, respuesta cruda, URL firmada ni secreto;
- revisión `APPROVED/CORRECTED/REJECTED` que conserva el resultado original y no modifica `Task`, baseline, Gantt, certificado, asistencia ni pago.

Las 100 migraciones, incluido el nuevo ledger de despacho/costo y su hotfix de cascada, ya pasaron PostgreSQL 17.5 efímero y Neon Preview con verifier concurrente/rollback-only; el build `0a00f37` quedó `Ready` ([evidencia](./evidence/2026-07-29-preview-0a00f37.md)). La credencial dedicada de OpenAI ya fue elegida y aislada para ObraSaaS, y un smoke no personal confirmó visión, abstención y telemetría cache completa. Aún no se probó una foto real recibida por Meta dentro del tenant piloto ni se cerró el gate contractual de datos. Por lo tanto, esta capacidad es **infraestructura de piloto Preview**, no una función productiva anunciable.

El 26 de julio de 2026 se ejecutó un smoke API real y acotado contra OpenAI usando un render BIM no personal del propio repositorio; no fue una foto real de obra. El primer intento fue bloqueado localmente porque el archivo tenía bytes JPEG aunque su extensión era `.png`. Con el MIME binario correcto, `gpt-5.6-sol` se abstuvo como `not_construction_progress`, dejó el rango en `null` y explicó que un modelo digital no demuestra ejecución física. No se guardaron IDs, tokens ni respuesta cruda en el repositorio.

## Registro de proveedores

| Carga | Proveedor/modelo | Rol | Estado y regla |
| --- | --- | --- | --- |
| Lectura visual | OpenAI `gpt-5.6-sol` | Primario de piloto | Adapter Responses probado; `store:false`, `detail:high` por defecto, Structured Outputs estricto y `safety_identifier` HMAC seudónimo por operador con secreto estable separado de la API key |
| Lectura visual | Hugging Face `Qwen/Qwen3-VL-32B-Instruct` | Shadow | Adapter implementado y probado por contrato; usa el router público de Inference Providers hacia el proveedor externo `featherless-ai`, fijado en allowlist, con `X-HF-Bill-To` opcional. No fue ejecutado contra API real ni se invoca por defecto/fan-out |
| Lectura visual | Z.ai `glm-5v-turbo` | Challenger | Adapter implementado y probado por contrato contra la API pública directa de Z.ai; modelo visual separado, secreto y rollout explícitos. Sin smoke real todavía |
| OCR | Z.ai `glm-ocr` | Especialista | Adapter de layout implementado contra la API pública de Z.ai. ObraSaaS impone un chunk interno de 30 páginas para acotar costo/salida, aunque el proveedor documenta un máximo superior; aún no está conectado a remitos/facturas ni probado contra API real |
| Texto estructurado | Z.ai `glm-5.2` | Especialista | Adapter implementado **sólo para texto/JSON**, razonamiento `none` explícito y validador de negocio obligatorio. Sin smoke real; puede evaluar JSON extraído, nunca una foto |

“Usar toda la suite” significa registrar capacidades compatibles, fijar proveedor/revisión y compararlas sobre un dataset gobernado. No significa enviar cada foto a todos los modelos: eso aumentaría costo, latencia y exposición de datos sin mejorar por sí mismo la calidad.

La selección neutral resuelve exactamente un modelo y exige habilitar de forma explícita rol + adapter para cualquier shadow, challenger o especialista. En el piloto `gpt-5.6-sol` es la única ruta primaria; `gpt-5.6-terra` existe como shadow con precio versionado y sólo puede seleccionarse de forma explícita. El comparador de benchmark es puro: consume observaciones ya generadas sobre el mismo set de casos, rechaza duplicados/cobertura desigual y no realiza llamadas a proveedores.

Fuentes primarias:

- [OpenAI GPT-5.6 Sol](https://developers.openai.com/api/docs/models/gpt-5.6-sol), [visión](https://developers.openai.com/api/docs/guides/images-vision), [Prompt Caching](https://developers.openai.com/api/docs/guides/prompt-caching) y [precios](https://developers.openai.com/api/docs/pricing);
- [Qwen3-VL-32B-Instruct](https://huggingface.co/Qwen/Qwen3-VL-32B-Instruct) y [seguridad de Inference Providers](https://huggingface.co/docs/inference-providers/security);
- [Z.ai GLM-5V Turbo](https://docs.z.ai/guides/vlm/glm-5v-turbo), [GLM-OCR](https://docs.z.ai/guides/vlm/glm-ocr), [GLM-5.2 text-only](https://docs.z.ai/guides/llm/glm-5.2) y [política de privacidad](https://docs.z.ai/legal-agreement/privacy-policy).

La revisión de catálogo del 26 de julio de 2026 confirmó que OpenAI presenta
`gpt-5.6-sol` como su modelo de capacidad insignia con entrada de imágenes; el
mapping público de Hugging Face exponía `Qwen/Qwen3-VL-32B-Instruct` mediante
`featherless-ai` en estado `live`; y Z.ai documentaba `glm-5.2` como modelo de
texto, `glm-5v-turbo` como VLM y `glm-ocr` como parser documental. Esto confirma
el contrato, no la habilitación de nuestra cuenta ni el rendimiento sobre obra.

"Siempre el mejor" se implementa mediante una política de actualización, no
mediante aliases móviles en producción. Cada ID queda fijado en el registro y
una versión posterior sólo puede entrar con adapter explícito, pruebas de
contrato, revisión de datos/costos, benchmark sobre el mismo gold set y decisión
humana de promoción. Un cambio arbitrario de `HF_VISION_MODEL`,
`ZAI_VISION_MODEL` o `ZAI_TEXT_MODEL` se rechaza si no coincide con un modelo
registrado; así se evita que una actualización silenciosa cambie calidad,
precio, residencia de datos o formato de salida.

## OCR de clase profesional

`glm-ocr` es el primer especialista integrado, pero un modelo por sí solo no
convierte el proceso en OCR productivo. El cierre profesional exige:

- ingreso por `ProtectedUpload`, hash e idempotencia, sin descriptor de storage
  controlado por el navegador;
- MIME/magic bytes, límites y preprocesado seguro antes del proveedor;
- chunking explícito para documentos de más de 30 páginas por política interna de ObraSaaS —no por un máximo actual del proveedor—, orden estable y
  detección de páginas faltantes o repetidas;
- salida de texto/layout acotada, más extracción de campos con esquema y
  validador de negocio obligatorio;
- reconciliación determinista de remito/factura con proveedor, OC, cantidades,
  moneda e importes; ninguna coincidencia se autoaprueba;
- vista humana que muestre documento fuente, campo extraído, advertencias y
  corrección auditada;
- benchmark por tipo de documento con CER/WER, exactitud de campos/tablas,
  rechazo de baja calidad, p95, costo y tasa de corrección;
- retención, borrado, DPA y observabilidad sin contenido sensible.

La conexión de este pipeline a remitos y facturas sigue pendiente. Hasta que
ese recorrido y el benchmark estén verdes, ObraSaaS puede describir el adapter
como integrado por contrato, pero no el OCR como productivo.

## Contrato de salida

La salida v1 separa:

- `facts`: hechos visibles, no inferencias contractuales;
- `quality`: ángulo, iluminación, oclusión y suficiencia general;
- `progressMin/progressMax`: rango prudente o ambos `null`;
- `confidence`: autoconfianza del proveedor, visible sólo como señal orientativa y nunca como calibración probada;
- `limitations` y `abstentionReason`;
- `summary` y `elementType` acotados.

El prompt y el contrato de salida exigen abstención cuando la imagen no es evidencia de avance, falta contexto de tarea, la calidad es insuficiente o la solicitud no es segura/soportada; el esquema valida su forma, no que el juicio semántico sea correcto. Esa calidad se mide con benchmark y revisión humana. Una abstención puede tener alta confianza: esa confianza describe la decisión de abstenerse, no un porcentaje de avance.

## Flujo gobernado

1. Una imagen Meta autorizada se guarda en storage privado y se verifica con SHA-256.
2. Un rol con permisos de evidencia la vincula idempotentemente a una tarea canónica.
3. Un administrador activa por separado la lectura visual y confirma la base legal/autorización organizacional aplicable.
4. Antes de leer bytes, el servicio crea un plan de despacho único y reserva de forma durable el costo conservador contra el presupuesto diario del tenant.
5. El servicio reserva una evaluación `RUNNING`, vuelve a validar tenant/suscripción, lee y verifica el archivo privado.
6. Antes del request externo vuelve a validar consentimiento, suscripción, SHA y revisión de la tarea, y persiste por CAS la frontera de despacho con identidad exacta (`revision`, intento, ruta y vencimiento). Si ese CAS pierde contra la recuperación, no se llama al proveedor.
7. El proveedor devuelve un rango o se abstiene. ObraSaaS guarda primero un recibo canónico con resultado, correlativos, huellas y usage. Luego, dentro de una transacción, proyecta la evaluación, liquida el costo cuando la telemetría es completa y marca el recibo aplicado. El resultado queda `PENDING` de revisión.
8. El Director aprueba, corrige con motivo/rango o rechaza mediante CAS.
9. La revisión no cambia el plan. Un escenario forecast posterior debe usar una baseline inmutable y un motor determinista separado.

Una evidencia admite como máximo una ejecución activa o un resultado pendiente de revisión. La regla se aplica bajo el lock de escritura del proyecto y mediante un índice parcial único en PostgreSQL, por lo que dos pestañas con claves distintas no duplican llamadas al proveedor. Si la foto, la tarea o el plan cambian, la lectura queda marcada como obsoleta para la decisión: sólo puede rechazarse con motivo y, una vez cerrada, se habilita un intento nuevo.

Si el proceso cae antes de la frontera externa, el lease vencido se cierra como
`FAILED`, libera la reserva y admite luego un intento explícito. Si cae después
de esa frontera y el proveedor todavía no respondió, se conserva la reserva y
la evidencia queda bloqueada hasta una conciliación explícita. Si la respuesta
ya volvió y el recibo alcanzó la base, el aplicador/replay bajo demanda completa la proyección y
liquidación sin llamar otra vez al proveedor. Ningún adapter puede prometer
`exactly once` frente a un proveedor externo. La recuperación es tenant/project
scoped, usa revisión CAS y emite una sola auditoría aun bajo carreras locales.
La reserva concurrente y el rollback-only ya pasaron contra Neon Preview; resta
recorrer el replay y la conciliación desde una sesión superadmin autenticada.

Si el proveedor respondió pero no informó usage completo, el resultado humano
puede quedar aplicado con `costPending`, mientras la reserva y el bloqueo de la
evidencia permanecen activos. No se estima ni se libera costo por inferencia.
La conciliación de emergencia es una operación interna de superadmin, sin UI
pública: exige tenant, obra, evaluación, `Idempotency-Key`, costo exacto y una
evidencia SHA-256. Por ahora sólo acepta facturación externa comprobable o una
confirmación documentada de costo cero. `RECONCILED_USAGE` permanece cerrado
hasta recibir tokens completos, derivar el costo con el pricing snapshot y
conservar una prueba durable recuperable. Un hash prueba integridad, no custodia;
el comprobante externo debe poder recuperarse por ese hash antes de operar.

La recuperación actual es **bajo demanda**: cada listado recupera exactamente
los leases vencidos incluidos en la página que va a devolver y cada replay
recupera su propia ejecución. Todavía no existe un sweeper cron global; por eso
una evaluación que nadie vuelva a consultar puede permanecer `RUNNING` en base
hasta el próximo acceso. Ese cron autenticado y observable es un gate operativo
antes de declarar la capacidad productiva a escala.

## Benchmark antes de producción

El gold set debe ser privado, consentido y desidentificado, con split congelado y doble etiquetado profesional más arbitraje. Debe cubrir tipologías, etapas, antes/después, baja luz, desenfoque, oclusión, fotos irrelevantes, BIM/planos, remitos y casos fuera de distribución.

Métricas mínimas:

- macro-F1 de etapa/elemento y tasa de afirmaciones sin respaldo;
- MAE y cobertura del intervalo de avance, sólo donde exista ground truth válido;
- precisión/recall de abstención y de señales de riesgo;
- OCR CER/WER y exactitud de campos/tablas;
- JSON válido, aceptación/corrección/rechazo humano;
- p50/p95, errores, reintentos y costo por evidencia;
- comparación por configuración completa: modelo + proveedor + revisión + prompt + esquema.

Cada costo debe conservar fuente y fecha de precio fuera del comparador; éste valida que `registryModelId`, proveedor y modelo coincidan, pero nunca consulta precios ni promueve un modelo automáticamente. Toda promoción es una decisión humana documentada sobre un gold set con cobertura mínima acordada.

Rollout: `offline eval -> shadow muestreado -> sugerencia visible -> eventual automatización sólo de campos descriptivos no críticos`. Pagos, certificación, seguridad, identidad laboral, asistencia y mutaciones de baseline conservan revisión humana.

En este corte, sólo OpenAI tuvo un smoke API real controlado, sobre un render BIM y no sobre evidencia de campo. Que los adapters HF/Z.ai pasen pruebas de contrato demuestra forma, validación y límites locales; no demuestra disponibilidad, calidad, costo ni compatibilidad efectiva del proveedor hasta ejecutar el benchmark con credenciales dedicadas y datos autorizados.

`store:false` deshabilita el almacenamiento de estado de Responses, pero **no equivale por sí solo a Zero Data Retention**. Antes de enviar fotos reales deben verificarse los controles de datos del proyecto OpenAI (ZDR o Modified Abuse Monitoring cuando corresponda), DPA, consentimiento y retención aplicable. El piloto fija `detail:high`; `original`, `auto` y `low` fallan cerrado hasta versionar límites y reserva de costo. Para GPT-5.6 también se usa prompt cache explícito sin breakpoints, evitando escrituras implícitas de prefijos confidenciales; si los contadores de caché faltan o reportan escritura, el costo queda sin conciliar y se bloquea otro despacho. El router público de HF y su proveedor externo Featherless, así como las APIs públicas de Z.ai, requieren revisión contractual propia antes de recibir evidencia real; no son endpoints privados de ObraSaaS.

## Gate para la foto real del piloto

Antes de probar “pared a medio terminar” desde WhatsApp deben estar verdes:

- migración desplegada en Neon Preview aislado y verificada (`0a00f37`, verde);
- `META_APP_SECRET`, webhook firmado y conexión del tenant piloto activos;
- storage privado y ruta Meta -> Inbox -> `ProgressEvidence` probados con un archivo real;
- opt-in visual activado por el administrador en ese tenant;
- `AI_SAFETY_IDENTIFIER_SECRET` dedicado, aleatorio y de al menos 32 bytes configurado; rotar `OPENAI_API_KEY` no debe alterar el seudónimo y rotar este secreto sí lo hace;
- controles de retención/DPA del proveedor verificados; `store:false` solo no satisface este gate;
- tarea/baseline identificables, permisos y revisión del Director;
- observabilidad de latencia/error/costo sin contenido, teléfono ni URL privada en logs.

La prueba se considera exitosa si la foto llega, conserva comentario/tarea, produce una descripción y rango razonables **o una abstención correcta**, y la decisión humana queda auditada. No exige ni permite que una sola foto certifique o reprograme la obra.
