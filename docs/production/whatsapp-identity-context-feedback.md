# Recuperación del contexto de identidad por WhatsApp

Un botón o una imagen en respuesta a un mensaje anterior del mismo intento
puede recibir una orientación de texto. `ESTADO` y `ESTADO IDENTIDAD` también
admiten esta respuesta cuando citan un mensaje de identidad realmente enviado.
Una consulta sin contexto, un remitente distinto, un nonce inventado o una
fuente de otro desafío no establecen esta autoridad.

El propósito `KYC_CONTEXT_FEEDBACK` comprueba el evento firmado, la fuente
saliente `KYC_CAPTURE` confirmada, su recibo cifrado, el mismo desafío actual,
los principales y sus membresías/asignaciones vigentes. La selección se
comprueba contra las opciones originales. Los límites del planificador de
captura y del feedback de vencimiento mantienen su mensaje y nonce actuales.

Esta respuesta no cambia la conversación, conserva los consentimientos y
plazos, no descarga imágenes y no presenta ni aprueba identidad. Orienta hacia
el último mensaje del bot, la cuenta o el cierre explícito del intento por su
responsable. No genera códigos ni botones nuevos. La cuenta, la revisión
independiente y la vinculación operativa siguen siendo pasos separados.

El procesador intercepta una fuente anterior antes de entrar a captura. Guarda
la respuesta cifrada y usa el outbox canónico del evento. Una reserva incierta
no se reenvía. Tras una resolución completa, los fences del envío usan una
capability del mismo cliente y transacción, con snapshot de evento, Worker,
principales, asignaciones, canal, fuentes firmadas y recibos. La observación de
entrega puede pasar a leído; una revocación, una fuente fallida o un cambio de
autoridad detiene el envío.

Las pruebas focales usan datos y HTTP sintéticos. Los dos productores existentes
de PostgreSQL incorporan concurrencia nativa, consulta neutral, revocación,
intercepción previa y latencia controlada de 225 ms por SQL y 200 ms por Graph,
sin extender la lease original de 60 segundos. Su configuración no demuestra
que hayan sido ejecutados para esta revisión. Publicación, recepción física,
consentimiento humano y aceptación municipal/empresarial se registran aparte.
