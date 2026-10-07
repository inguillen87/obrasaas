# Consulta de obras autorizadas

La sección «Resumen de obras» de Mi cuenta consulta el estado actual de las tareas de las obras a las que la sesión tiene acceso. La consulta usa el store y la autorización canónicos; no utiliza el estado de la demo ni crea una jerarquía entre organizaciones.

`GET /api/identity/workspace?portfolio=1&scope=<scope>&afterProject=<cursor opcional>` devuelve páginas de hasta 50 obras activas de la organización actual. ADMIN y DIRECTOR pueden consultar su cartera; SITE_MANAGER, FINANCE y AUDITOR necesitan una asignación activa a cada obra. Tanto el cursor como la página vuelven a verificar el acceso y el contexto actual. La lectura usa una transacción de sólo lectura con snapshot consistente.

La proyección incluye nombre, total de tareas, tareas completadas (estado DONE y avance 100), en ejecución, bloqueadas, con alguna fecha pendiente y próximo fin previsto pendiente. Los conteos no son un avance ponderado ni una certificación. No devuelve datos de trabajadores, documentos, cuentas bancarias, evidencias o credenciales.

La pantalla requiere una consulta explícita. Una nueva consulta o el cambio de contexto retira las tarjetas anteriores. La instancia se desmonta al cambiar scope/rol y aborta las peticiones antiguas. HTTP 401/403/409 invalida el acceso también cuando el servidor devuelve HTML; una respuesta 200 que no sea JSON válido muestra un error de reconsulta. Un error no habilita datos del contexto anterior. La navegación a una obra sigue pasando por la lectura canónica.

## Validación local

- 17 contratos focales y 62 pruebas existentes de workspace: 79 pasaron.
- PostgreSQL desechable: 17 grupos (13 existentes y 4 nuevos), con paginación de 107 obras, exclusión de otras organizaciones/obras archivadas y revocación de asignaciones.
- UI real del componente: 68 casos, 17 escenarios y cuatro anchos (320, 390, 768, 1280), incluidos errores HTTP con HTML, cambio de contexto, respuesta tardía, teclado y modo oscuro.
- Revisión independiente: hallazgo de clasificación de HTTP corregido; sin hallazgos materiales pendientes en el alcance revisado.

Estas pruebas son locales y sintéticas. Faltan CI del código final, despliegue y aceptación humana. Esta sección no concede supervisión de otras empresas a administraciones de barrios/countries; esa colaboración requiere una autorización explícita adicional.
