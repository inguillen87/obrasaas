# ObraSaaS

Plataforma multi-tenant para convertir reportes de campo enviados por WhatsApp en tareas, asistencia, evidencia, alertas, cronograma y reportes ejecutivos trazables.

## Estado actual

- Next.js 16 App Router, React 19 y Vercel.
- Clerk Organizations para autenticación B2B, cinco roles operativos y superadmin único.
- Neon Postgres + Prisma con aislamiento por organización y obra.
- Integración local/por contrato con Meta WhatsApp Cloud API y Embedded Signup v4 por tenant; el webhook firmado y el journey sobre un tenant real siguen como gate externo.
- Media Meta privada con firma, hash y alcance por número; las subidas web de progreso, caja, remitos y facturas usan una reserva `ProtectedUpload` server-owned y sólo exponen `uploadId`, sobre Vercel Blob privado o Cloudinary autenticado.
- Inbox operativo para vincular una foto autorizada de Meta a una tarea canónica como evidencia idempotente y revisable.
- Transcripción de audio preparada para OpenAI y persistencia de mensajes idempotente.
- Piloto local de lectura visual con OpenAI `gpt-5.6-sol`, rango/abstención y revisión humana. Qwen3-VL y GLM-5V son challengers visuales; GLM-OCR y GLM-5.2 son especialistas OCR/texto. Sólo OpenAI tuvo un smoke API controlado y nunca hay fan-out automático.
- Dashboard operativo, Gantt, asistencia, acopios, incidencias y reporte semanal PDF A4 generado en servidor, versionado y auditable.
- Proyección transaccional de tareas para que Gantt, aprobaciones, portfolio y WhatsApp compartan la misma identidad operativa; contrato en [docs/OPERATIONAL_TASKS.md](docs/OPERATIONAL_TASKS.md).
- Web Analytics anonimizado incluido en el plan de Vercel.
- Consola global de tenants reservada a `guillen.marce@gmail.com`.

Las superficies BIM y visión perimetral continúan identificadas como **Demo Lab**. La lectura visual de evidencia de avance es una vertical distinta, gobernada y probada localmente, pero sigue siendo **piloto no desplegado** hasta superar migración Preview, foto Meta real, benchmark, observabilidad y controles de datos/DPA/retención de cada proveedor. La aplicación no presenta ninguna de esas capacidades como productiva antes de sus gates.

El diagnóstico verificable, los gates de producción y el plan multitrimestre están en [docs/PRODUCT_ROADMAP.md](docs/PRODUCT_ROADMAP.md). La especificación funcional v1.0 de la clienta ya fue contrastada contra el producto, requisito por requisito, en [docs/CLIENT_SPEC_TRACEABILITY.md](docs/CLIENT_SPEC_TRACEABILITY.md).

## Planes

| Plan | Precio | Alcance principal |
| --- | ---: | --- |
| Prueba completa | USD 0 por 14 días | 1 obra, 3 usuarios de gestión, 20 colaboradores de campo |
| Pro | USD 199/mes o USD 159/mes anual | 10 obras, 10 usuarios de gestión, 100 colaboradores de campo |
| Enterprise | Desde USD 699/mes | Obras ilimitadas, 50 usuarios de gestión, 500 colaboradores y gobierno avanzado |

El precio es por organización, no por cada persona de campo dentro de los límites publicados. Meta, IA y almacenamiento extraordinario se informan como costos variables separados. La referencia competitiva y la lógica de posicionamiento están documentadas en [docs/PRICING.md](docs/PRICING.md).

## Desarrollo local

Requisitos: Node.js 24 y npm.

```powershell
npm ci
npm test
npm run lint
npm run dev
```

Copiar `.env.example` a `.env.local` y completar únicamente credenciales dedicadas de ObraSaaS. No reutilizar recursos de otras plataformas.

## Gates de entrega

```powershell
npm test
npm run lint
npm run test:e2e:public
npm run build
npm audit --omit=dev
```

GitHub Actions ejecuta estos gates sobre pull requests y pushes a `master` o `codex/**`. S9.2 agrega un job E2E autenticado separado: exige identidades sintéticas dedicadas de Clerk Development, dos tenants y PostgreSQL 17 descartable, y cubre maker-checker, roles negativos, cross-tenant, seal/replay/stale y UI. Los journeys core y de proveedores todavía deben ampliarse antes de producción comercial; este gate no usa ni acredita Clerk Production.

El alias estable configurado es `https://obrasaas.vercel.app`; `https://obrasaas-preview.vercel.app` queda reservado para validaciones de Preview. Su disponibilidad se verifica en cada release y no se infiere desde la configuración. Mientras no exista un dominio propio, ambos entornos usan la instancia dedicada de desarrollo de Clerk y no se contratan add-ons ni una instancia productiva.

## Superficies principales

- `/`: landing comercial y planes.
- `/dashboard`: vista Hoy tenant-aware con prioridades, avance, presencia y señales reales de la obra activa.
- `/dashboard/labs`: perímetro experimental separado para BIM, visión e IoT; explicita evidencia, límites y requisitos antes de una activación real.
- `/dashboard/report`: vista ejecutiva tenant-aware con descarga de PDF A4 real, versión de snapshot, huella SHA-256 auditada y tipografía Source Sans 3 embebida para nombres internacionales.
- `/dashboard/team`: equipo y matriz de roles.
- `/dashboard/integrations`: conexión de activos Meta propios del tenant y opt-in independiente para lectura visual de evidencia.
- `/dashboard/inbox` y `/dashboard/progress`: incorporación de fotos a tareas, revisión de evidencia y evaluación visual asistida con decisión humana.
- `/superadmin`: CRM global de organizaciones, solo superadmin.
- `/webview/attendance` y `/webview/medical`: vistas móviles firmadas para WhatsApp.

## Seguridad operativa

- Una app Meta exclusiva para ObraSaaS; cada tenant aporta su WABA, número y token mediante Embedded Signup.
- Tokens de integración cifrados con AES-256-GCM.
- Los endpoints verifican criptográficamente las firmas de Meta y Clerk y aplican idempotencia por contrato; el webhook Meta inbound real sigue pendiente de H1.
- Clerk restringe orígenes autorizados y conserva identidades internas durante bajas o un futuro cutover development → production; el procedimiento está documentado en [docs/AUTH_AND_TENANCY.md](docs/AUTH_AND_TENANCY.md).
- Evidencia privada accesible únicamente desde el tenant y proyecto autorizados.
- Acciones sensibles sujetas a permisos, estado de suscripción y auditoría.

Nunca guardar claves reales en el repositorio ni pegarlas en documentación o incidencias.
