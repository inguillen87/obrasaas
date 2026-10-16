# Cuenta por áreas y presentación guiada

Cuando una persona llega desde WhatsApp para presentar identidad, la cuenta debe abrir esa tarea sin mostrar también facturación, cronogramas y configuración. La nueva navegación muestra una sección a la vez. Sus formularios permanecen montados para conservar archivos preparados, borradores y referencias de operaciones pendientes.

## Recorridos

- `/cuenta?seccion=identidad&obra=<id>#participant-title`: sugiere la obra mediante el GET canónico existente, abre identidad y consulta una vez los metadatos del perfil. El perfil propio tiene prioridad inicial sobre otra ficha. El enlace no concede pertenencia, permisos ni consentimiento.
- Resumen: accesos a equipo, jornada, cronograma y materiales, con indicadores calculados sobre las tareas cargadas. Los datos parciales siguen identificados.
- Configuración y facturación tienen destinos separados. Plan y recuperación permanecen accesibles con sus permisos aun antes de seleccionar una obra o cuando la empresa todavía no tiene obras asignadas. Su visibilidad conserva las capacidades actuales; el servidor sigue decidiendo cada acceso.
- Los fragmentos anteriores de cronograma, importación y edición siguen abriendo su sección. Atrás y Adelante cambian la vista sin reenviar operaciones.
- La recuperación de operaciones conserva su propio destino. Un formulario pendiente sigue bloqueando cambios de obra y organización según los controles existentes.

## Captura web

Tres pasos: frente, dorso y selfie. El dorso mantiene su autorización opcional independiente. Se puede volver a los pasos anteriores sin perder las imágenes preparadas. La presentación sólo se envía desde el último paso, con las imágenes y el consentimiento requeridos; los análisis opcionales siguen desmarcados. Los avisos completos mantienen su contenido y están disponibles en detalles, junto con la política de privacidad.

Los nombres de proveedores se retiraron de las instrucciones operativas nuevas. Esto no altera los avisos históricos ni oculta el detalle del tratamiento en los avisos completos.

## Verificación local

Se ejecutaron 23 pruebas de navegación y retorno de autenticación, seis controles del productor y 20 recorridos con el JSX/CSS actuales en Chromium aislado, a 390 y 1440 píxeles. Se comprobaron ocultación accesible, una sola sección visible, ausencia de desborde horizontal, autolectura limitada al área de identidad, perfil propio después de otra ficha y conservación de borradores.

La captura utilizó PNG geométricos sintéticos y respuestas de API cerradas. Sólo el clic final produjo una solicitud sintética por ancho. Un 503 conservó el UUID y la referencia real del journal, sin reenvío al navegar. No se usaron documentos, rostros ni proveedores reales. Lint pasó.

La prueba aislada no acredita Clerk real, el renderizado completo del servidor, una cámara física, Safari ni aceptación del piloto. CI, publicación y comprobación posterior en el dominio real siguen siendo etapas separadas.
