# Borrador de avance desde una nota de audio

La transcripción existente puede producir un borrador privado con actividad mencionada, tarea elegida por la persona, cantidad, unidad y alcance. Es un reconocedor conservador de expresiones explícitas en español, después de la transcripción. No representa comprensión general del habla ni acredita que el trabajo haya ocurrido. No utiliza otro proveedor ni otro motor de operaciones.

Ejemplos admitidos con números escritos en cifras:

- `Ejecutamos en total 12,5 metros cuadrados de revoque.`: cantidad `12.5000`, unidad `M2`, alcance `ACUMULADA`.
- `Hoy hicimos 12 m2 de revoque.`: cantidad mencionada `12.0000`, alcance `DELTA`; la propuesta requiere ingresar la acumulada verificada.
- `Hicimos 12 m2 de revoque.`: alcance `DESCONOCIDO`; no se presupone acumulada.

Los números en palabras, negaciones, estimaciones, cancelaciones, instrucciones, consumos de materiales, varias cantidades, unidades ausentes y formatos ambiguos quedan por confirmar. No se infiere un porcentaje ni una cantidad base; tampoco se suma una cantidad del día a valores anteriores. La persona debe comprobar la correspondencia con la tarea y su metrado. La actividad mencionada puede quedar desconocida aunque la tarea haya sido seleccionada.

El borrador conserva el ID y la versión de la tarea consultada, el ID y la versión de la evidencia al procesarla y las huellas del archivo y de la transcripción. Preparar una propuesta requiere una evidencia aprobada y una tarea con la misma versión. La web muestra el borrador, pide completar la medición y exige confirmación humana. Cambiar datos o retirar el audio del checklist invalida esa confirmación; un conflicto de versión exige preparar una medición manual con los registros vigentes.

En WhatsApp, después de la revisión independiente del audio desde la web, `AVANCE` permite elegir ese audio, revisar el borrador y completar la medición acumulada sin salir de la conversación. Ni una afirmación libre ni el resultado del procesamiento guardan una propuesta automáticamente. La confirmación interactiva entra a `PROPOSE_PROGRESS`, usando los permisos, KYC, recibos privados y guardas existentes. Otra persona autorizada decide mediante `DECIDE_PROGRESS`; únicamente esa decisión puede modificar la tarea y el cronograma. El analizador no modifica tareas, inventario, jornadas, identidades ni permisos.

Esta función se valida con adaptadores falsos, pruebas de contratos y el componente real servido localmente con APIs interceptadas. Esas pruebas no acreditan precisión del proveedor, transcripción de voces reales, entrega por WhatsApp, operación física, publicación ni aceptación del piloto.

Validación focal:

```powershell
node --test tests/production-voice-progress-draft.test.mjs tests/production-field-media.test.mjs tests/production-meta-field.test.mjs
$env:FIELD_UI_FOCUS='voice-progress'
$env:FIELD_UI_EVIDENCE='.vercel/private/voice-progress-ui'
node scripts/verify-field-operations-ui.mjs
```

El foco de UI tiene once escenarios en cuatro anchos. También se ejecutan de forma aditiva en el harness de campo existente, sin crear una lane paralela. El lint de Production incluye el helper y su prueba; el contrato inmutable de Workspace CI conserva sus bloques anteriores.

El runner existente `scripts/verify-field-operations-postgres.mjs` añade cuatro controles de voz a sus 45 controles previos. Usa otra tarea y un participante sintéticos con storage y transcriptor falsos: procesamiento y replay, revisión independiente y KYC, propuesta sin modificar la tarea y rechazo por cambio de versión, decisión independiente con CAS y replay. Sólo admite PostgreSQL local marcado como desechable; crea una base aleatoria y elimina esa misma base al terminar. No debe ejecutarse con una conexión de producción ni se usa para acreditar al proveedor.
