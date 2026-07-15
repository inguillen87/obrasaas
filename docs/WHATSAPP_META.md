# WhatsApp Cloud API y Embedded Signup

## Arquitectura

ObraSaaS usa una app propia de Meta y separada del resto de las plataformas:

- app de Meta: `ObraSaaS` (`1665088767899217`);
- configuración Embedded Signup v4: `1556998679107747`;
- callback de la beta: `https://obrasaas-preview.vercel.app/api/webhooks/whatsapp`;
- versión de Graph API y de las suscripciones: `v25.0`;
- cada tenant conecta su propio WABA, número y token;
- las credenciales del tenant se cifran con AES-256-GCM y nunca se comparten entre organizaciones;
- los Flows se definen como blueprints Flow JSON `7.3` y se crean dentro del WABA de cada tenant.

La URL de callback está verificada en Meta. El token de verificación vive cifrado en Vercel y no se documenta ni se imprime.

## Campos suscritos

El webhook solo está suscrito a los eventos que el backend procesa:

- `messages` (incluye respuestas de WhatsApp Flows y estados de entrega);
- `account_update`;
- `account_review_update`;
- `phone_number_name_update`;
- `phone_number_quality_update`;
- `message_template_status_update`.

No se deben habilitar campos adicionales hasta que exista un consumidor idempotente, persistencia y pruebas para ese contrato.

## Controles de seguridad

- El challenge `GET` compara `hub.verify_token` en tiempo constante a nivel de aplicación.
- Cada `POST` debe incluir `x-hub-signature-256` y se valida sobre el cuerpo sin modificar con `META_APP_SECRET`.
- Los eventos se reclaman de forma idempotente antes de procesarse.
- El `phone_number_id` o WABA debe resolver una conexión activa y autorizada; los eventos desconocidos se rechazan.
- Fotos, audios y documentos se descargan solo desde hosts permitidos, con límites de tamaño, MIME y SHA-256.
- El bot responde usando la credencial cifrada del mismo número que originó el evento.

## Estado operativo de la beta

Listo:

- endpoint público sin Vercel Authentication;
- challenge real verificado con respuesta HTTP 200;
- callback guardado en Meta;
- seis campos de webhook suscritos en `v25.0`;
- dominio, privacidad, términos, eliminación de datos y categoría de la app completados;
- Embedded Signup v4 implementado y tenant-scoped;
- blueprints `Incidencia de obra` y `Fichaje y seguridad` validados localmente;
- provisionamiento de borradores Meta tenant-scoped, sin publicación automática.

Pendiente antes del primer tenant real:

1. revelar el App Secret desde Meta con reautenticación del propietario;
2. guardarlo como `META_APP_SECRET` sensible en Vercel Preview y Production;
3. redeployar la beta y ejecutar un webhook de prueba firmado;
4. completar el primer Embedded Signup con un WABA y número reales;
5. crear los dos borradores desde Integraciones y completar una prueba Flow end-to-end;
6. publicar los Flows aprobados desde Meta;
7. publicar la app de Meta cuando el ícono y la identidad definitivos estén aprobados.

La interfaz de integraciones mantiene deshabilitado el alta mientras falte cualquiera de los secretos necesarios. Esto evita que un administrador complete Meta y falle recién al volver a ObraSaaS.

Meta vuelve inmutables los assets de un Flow después de publicarlo. Por eso ObraSaaS puede crear o actualizar borradores, pero no expone una publicación automática: un cambio posterior debe salir como un nuevo Flow clonado y volver a validarse.
