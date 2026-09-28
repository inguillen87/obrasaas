# Sprint C-2.6 — Certificaciones contractuales verificables

Base: `ba7dfb15ba23451b41f37a8ebb3d4ef1aecb111b` (C-2.5), rama `release/enterprise-unified-2026`.
Se retoma el módulo C-2.6 que había quedado local y sin publicar. El respaldo de esa preparación permanece fuera del repositorio.

## Circuito cerrado por esta implementación
`/certificacion` redirige temporalmente a `/dashboard/certificates`. El menú y el buscador lo sitúan en Abastecimiento y costos y conservan `org:certificates:read`.

La página lee el snapshot contractual durable por empresa/obra, fecha civil y membresía. Candidato, corte, importes, versiones, bloqueos y capacidades proceden del dominio existente; no se importa estado demo de master. Las acciones preparan y deciden mediante las mismas rutas, ABI, CAS e idempotencia del backend.

Preparador y certificador mantienen sus designaciones. La vista muestra únicamente las decisiones habilitadas por las capacidades y su actor/target; una apariencia de rol no concede autoridad. Los importes conservan minor units con BigInt y las deducciones se convierten decimalmente sin floats.

## Período, identidad y recuperación
- Cambiar fecha retira la observación anterior y exige consultar la nueva quincena. Si hay deducciones o dictamen sin guardar, se pide elegir entre conservarlos o descartarlos explícitamente.
- Toda lectura retira los controles anteriores mientras se verifica. Se comprueban empresa, obra, período, estructura de datos, revisiones y capacidades ligadas a la membresía.
- La pantalla se remonta por empresa/obra/membresía y aborta o descarta respuestas de la instancia anterior.
- Los requests nuevos incorporan los hints existentes `X-ObraSaaS-Organization` y `X-ObraSaaS-Project`, más `X-ObraSaaS-Membership`. Las rutas los comparan con la sesión antes de acceder a la base. No seleccionan ámbito ni otorgan acceso. Los clientes legacy sin hints conservan su contrato.
- No se transforma un 200 vacío en éxito. El recibo debe corresponder al tipo de operación, actor, certificado, período y revisiones; las decisiones además verifican digest y fundamento.
- Un fallo ambiguo mantiene una copia inmutable de payload e Idempotency-Key. «Recuperar mismo intento» es explícito y reutiliza ambos; no hay reenvío automático.
- Cuando la escritura quedó confirmada pero falla el GET posterior, la recuperación sólo vuelve a consultar. No repite el POST.
- Un bloqueo síncrono impide dos escrituras por doble clic. Las acciones de otro período pendiente no utilizan la revisión de la quincena visible.
- No se muestran errores técnicos crudos. La advertencia al cerrar cubre borradores/intentos en memoria; no se promete persistencia después de cerrar la pestaña ni operación offline.

## UX y datos
Dark Obsidian; jerarquía de período, estado, candidato, dictamen e historial. Se omite el panel de candidato vacío cuando ya hay certificado. Los dictámenes se presentan en español, con foco visible, controles táctiles y adaptación 320/390/768/1280. El historial describe hasta 20 versiones del período, no un total global.

No ejecuta pagos ni reemplaza factura fiscal o firma digital certificada. El digest se presenta como integridad, no como firma legal. No se cambian migraciones, SQL, números WhatsApp, credenciales, activos de otros productos ni la configuración de Production.

## Evidencia local y cierre de release
- Suite final: 4.514 pruebas aprobadas, cero fallos/canceladas/omitidas (40 más que C-2.5).
- Suite focal de certificados: 65 pruebas aprobadas.
- 13 grupos de navegador con `CertificateClient` real y HTTP/datos/actores sintéticos: flujo de preparación/deducción/dictamen con dos actores; período nuevo; conservar/descartar borrador; cinco fallos de lectura; dos resultados de escritura ambiguos; GET fallido tras escritura confirmada; doble clic; respuesta tardía al reemplazar contexto.
- Capturas en preparación/dictamen/aprobado a 390/1280; overflow comprobado también a 320/768. No se presenta como auditoría completa de accesibilidad ni sesión Clerk real.
- La primera regresión completa detectó un destino sin grupo. Se agregó Certificaciones al grupo existente y se preservó la expectativa original de seis grupos, junto con una prueba de permiso específica.
- El build local estándar falló por el junction de dependencias fuera del root de Turbopack. El intento local con Webpack también falló en el import anterior `medical-upload`/`node:crypto`; no se considera una compilación aprobada ni se alteró ese módulo para ocultarlo.
- El cierre exige preflight limpio del árbol exacto con `npm run build` estándar, suite, lint y navegador. Run, SHA del producto, CI y Preview se registran en PR #4 después de comprobarlos, sin promover Production.

El fixture de `scripts/lib/certificate-workspace-fixture.mjs` sólo se importa desde pruebas/verificadores, nunca desde el producto. Sus certificados no son registros de una constructora real.
