# Captura facial previa y preanálisis de la presentación privada

## Presentaciones nuevas con comparación facial v3

El aviso independiente `participant-private-biometric-v3` permite elegir entre comparación asistida y revisión manual. La selección es personal y explícita. El aviso, su huella y el modo forman parte de la fuente del intento; nunca se infieren de una opción anterior.

La plataforma y WhatsApp utilizan el mismo coordinador. Primero comprueba el conjunto completo de imágenes: frente, selfie y dorso autorizado. Después, en modo asistido, registra el despacho durable y obtiene una señal facial privada antes de la primera subida a Blob. En modo manual no llama al modelo facial. Cada subida vuelve a comprobar autoridad, fuente y concesión. Worker, recibo, adopción del resultado facial y estado COMMITTED se registran en la misma transacción; el servicio de preanálisis no repite esa comparación. La lectura OCR autorizada conserva su etapa posterior independiente.

Los nuevos desafíos de WhatsApp exigen una cuenta ACTIVE que ya aceptó su invitación. Se indica aceptar la invitación antes de pedir fotos. No se transfiere un intento entre el emisor de una invitación y la persona que la acepta. Los desafíos v1/v2 ya sellados conservan su versión y sus reglas de lectura; no se los actualiza automáticamente a v3.

El intento utiliza AuditLog y bloqueos existentes; no agrega una base ni una tabla de biometría. Reserva y despacho ocurren antes de la inferencia; las funciones del coordinador reutilizan la transacción autorizada y no abren una conexión anidada. Los bytes enviados y los destinados a almacenamiento son copias propias comprobadas por hash después de cada espera. La capacidad de guardado sólo existe en el servidor y se invalida al cambiar la fuente, la autoridad o el intento.

Un despacho sin resultado confirmado queda incierto y no vuelve a llamar al modelo por replay. La continuación manual requiere una acción explícita y una operación nueva vinculada al intento anterior. Su cierre técnico impide que una respuesta tardía del intento anterior guarde resultados. La respuesta de estado conserva el indicador de posibles objetos privados pendientes; un error no acredita que no se hayan subido imágenes.

La recuperación del navegador conserva las fotos en RAM y una referencia de IDs cuando el resultado es incierto. Una respuesta de cierre manual sólo retira la referencia anterior si procede del HTTP observado, tiene el contexto y el sucesor correctos y pudo eliminarse esa referencia. No acredita por sí sola una identidad presentada. Una recarga pierde las fotos de RAM; el servidor conserva la referencia y la evidencia técnica, sin inventar una continuación automática con imágenes ausentes.

La selfie debe mostrar una sola cara, sin sostener el documento. Las capturas y los consentimientos no se realizan automáticamente. En WhatsApp, Meta ya recibió los adjuntos: el control previo se refiere al almacenamiento privado de ObraSaaS y no elimina esos mensajes del proveedor.

La detección de un retrato y la comparación facial son señales orientativas. No clasifican de forma fiable un DNI, no certifican autenticidad, prueba de vida, identidad civil ni permisos de obra. No se almacenan embeddings. Las pruebas de modelos con muestras públicas, los componentes con puertos sintéticos, PostgreSQL y el recorrido personal publicado tienen evidencias independientes; ninguna sustituye a las otras.

## Presentaciones y consentimientos históricos v1/v2


El preanálisis comienza después de guardar una nueva presentación web o de WhatsApp con autorización explícita v2. El usuario conserva elecciones independientes para OCR y comparación facial; no requiere un segundo clic de un responsable. La autorización v1 histórica conserva texto, huella y ejecución manual anteriores. No se actualizan presentaciones anteriores ni se realiza un barrido retroactivo.

Los nuevos avisos son `participant-external-ocr-v2` y `participant-private-biometric-v2`. Ambos anuncian el inicio automático al completar la presentación. Un código preparado pero todavía no reclamado puede iniciar un recorrido con v2: el primer reclamo canónico guarda la versión y el estado cifrado en la misma transacción. Los recorridos ya iniciados mantienen sus versiones v1. El dorso sigue reservado a revisión humana y nunca se envía a OpenAI ni al motor facial.

La captura guarda la intención dentro de `Worker.metadata.participant.kyc.processing` en la misma transacción que el recibo `KYC_SUBMITTED`. El aviso posterior al commit despierta el servicio; el cron existente `/api/meta/customer-process` también recupera intenciones. Una caída de la respuesta o del despertar no elimina la intención. La captura no ejecuta inferencia dentro de su transacción.

El servicio no fabrica una sesión Clerk ni un administrador. Deriva una capacidad interna de un único recibo de presentación, su autor real, empresa, obra, participante, conjunto de imágenes, huellas y consentimientos. Revalida membresía, asignación, fuente y consentimiento antes de cada transferencia y de guardar resultados. Para un invitado con captura de WhatsApp íntegra, puede analizar sin esperar la aceptación de la cuenta; conserva `PENDING_ACCOUNT_CLAIM`. Para una cuenta aceptada conserva `PENDING_REVIEW`. No modifica identidad aprobada, roles, permisos, fichajes ni tareas.

Los hashes del nuevo vínculo automático, su operación determinista y la huella de consentimientos usan serialización canónica de claves. PostgreSQL `jsonb` cambia el orden de las propiedades de un objeto al guardarlo; ese cambio de orden no cambia sus valores ni su autoridad. La validación mantiene exactos todos los valores y rechaza propiedades adicionales. Esta normalización está limitada al nuevo protocolo automático; no cambia hashes históricos de avisos ni el digest del conjunto de imágenes.

| Estado público | Significado y recuperación |
| --- | --- |
| `QUEUED` | La intención está guardada; falta reclamarla. |
| `RUNNING` | Un proceso tiene una concesión de 150 segundos. Otro proceso no vuelve a enviar. |
| `WAITING_CONFIGURATION` | Falta configuración para una etapa. No se transfieren sus imágenes ni se reserva consumo; se revisa después de cinco minutos. Las otras etapas autorizadas pueden terminar. |
| `USAGE_HELD` | La cobertura comercial vencida puede revisarse después de cinco minutos. Un envío de proveedor pendiente o ya despachado impide repetirlo y queda fuera de la recuperación automática. |
| `EXTRACTED_UNVERIFIED` | OCR normalizado guardado en privado; puede contener también señales faciales. |
| `ADVISORY_UNREVIEWED` | Hay señales faciales privadas sin extracción OCR. |
| `FAILED_RETRYABLE` | Fallo conocido guardado. El replay devuelve el mismo estado; el servicio no inicia otro análisis automáticamente ni habilita el botón manual. El nombre conserva el contrato de vista existente. |
| `UNCERTAIN` | Una etapa fue despachada sin resultado durable confirmado o venció su concesión. Esa etapa no vuelve a enviarse. Las otras etapas autorizadas que todavía no fueron despachadas mantienen su recuperación independiente. |
| `SKIPPED_CONSENT` | Los avisos v2 fueron presentados pero ninguna etapa automática fue autorizada. No se leen imágenes para análisis. |

Cada etapa tiene su propio estado durable. OCR utiliza los recibos existentes `organization.usage.resource`, sus estados `RESERVED`, `DISPATCHED`, `UNKNOWN`, `OBSERVED` y `UNMEASURED`, y una operación determinista por presentación. La comparación facial tiene un cerrojo durable antes de llamar al endpoint privado. El resultado de una etapa terminada se conserva aunque la otra espere configuración. La expiración de una concesión con despacho no cancela la llamada original ni vuelve a enviar esa etapa; un nuevo reclamo acotado puede ejecutar solamente las etapas autorizadas aún pendientes de la misma fuente vigente. Una respuesta tardía del reclamo anterior no puede guardar campos ni reemplazar el resultado del nuevo reclamo. El consumo técnico observado de la llamada original sí se conserva.

La incertidumbre y la configuración pendiente pueden coexistir: el estado agregado continúa en `UNCERTAIN`, con `OCR_DISPATCH_UNCERTAIN` y `FACIAL_UNAVAILABLE`, por ejemplo. Si resta una etapa recuperable, la proyección técnica indica `processed:false` y programa su revisión después de cinco minutos. Cuando termina esa etapa, continúa la incertidumbre original y `processed:true` indica que no quedan etapas autorizadas recuperables. El recibo técnico de incertidumbre conserva su identificador único durante ambas situaciones; no acredita un resultado de OCR que no fue guardado.

El responsable autorizado, distinto del titular, puede consultar los tres campos normalizados de una etapa OCR `COMPLETE` aunque el estado agregado espere configuración, esté retenido o sea incierto por otra etapa. La proyección valida los campos, descarta propiedades adicionales y los mantiene ocultos al titular y a quienes no tienen permiso de revisión. La ausencia de CUIL se informa como dato no leído: no impide la participación ni exige recapturar un documento que puede no mostrarlo.

La recuperación omite estados retenidos que no pueden resolverse sin evidencia nueva, concesiones vigentes y decisiones de identidad finalizadas. Examina un lote acotado y continúa ante una fuente inválida; aplica una demora técnica de cinco minutos sólo al `processing` de la referencia exacta. No convierte ese fallo en autoridad para enviar imágenes. Las fechas canónicas se validan en el servicio y la selección SQL no realiza conversiones que permitan que una fecha corrupta aborte toda la cola.

OCR sigue usando el adaptador existente de OpenAI con `gpt-4o`, sólo con el frente autorizado. Extrae nombre, DNI y CUIL legibles y normaliza formatos básicos. No comprueba la autenticidad del documento, la vigencia civil ni una equivalencia con RENAPER/BINDX; tampoco implementa una evaluación completa de calidad documental o validaciones de todos sus campos. El motor facial existente usa YuNet, SFace y MiniFAS dentro del endpoint privado, con manifiesto y huellas verificadas. Sus señales permanecen sin calibración y no acreditan prueba de vida, autenticidad ni identidad certificada.

La cobertura comercial y el registro de tokens no acreditan saldo del proveedor, cuota, financiación ni costo. Si el proveedor rechaza una llamada o no informa consumo, se conserva lo observado; no se inventan ceros. Un resultado perdido entre la respuesta del proveedor y el guardado local no se puede reconstruir con esta API: queda incierto y no se paga otro intento por un replay.

La ruta web admite 300 segundos para captura y trabajo posterior; los adaptadores mantienen sus tiempos máximos y el servicio conserva la concesión de 150 segundos. El cron de 300 segundos reserva un presupuesto independiente para una presentación y corre en paralelo a la recuperación Meta existente.

Las pruebas focales usan imágenes sintéticas, proveedores cerrados y adaptadores de uso reales. Cubren consentimientos independientes y heredados, duplicados, concurrencia, recuperación, revocación durante E/S, ausencia de configuración, cobertura vencida, respuesta perdida y rechazo de resultados falsos. Las pruebas locales y el arnés PostgreSQL no establecen ejecución real de OpenAI, del endpoint biométrico desplegado ni aceptación humana. Publicación y pruebas reales requieren una revisión de la fuente congelada, configuración comprobada y un recorrido autorizado con evidencia separada.
