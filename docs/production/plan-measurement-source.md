# Candidatos de metrado desde una fuente

El perfil opcional `SOURCE_QUANTITIES_V1` extrae cantidades físicas para revisión.
No aprueba ejecución, crea fechas, calcula presupuesto ni configura Task por sí
solo. Usa el proyecto, permisos, almacenamiento privado, revisión y recibos del
flujo canónico; no incorpora otra base ni un sistema de permisos paralelo.

## Consentimiento y alcance

- Excel: `plan-source-quantities-local-v1`; lectura local de XLSX/XLSM, sin
  proveedor, recálculo, ejecución de macros o apertura de referencias externas.
  Reconoce exclusivamente los layouts CyP (`Plan de trabajo` contrastado por
  código/descripción con `CyP Integral completo`) y detalle de `Cotización`
  (`DESIGNACIÓN`, `UNIDAD`, `CANTIDAD`). No adivina columnas de otro Excel.
- PDF/imagen: `plan-source-quantities-openai-v1`; propósito separado
  `PHYSICAL_TASK_MEASUREMENT`. El integrador autoriza y registra el envío; este
  módulo exporta esquema/instrucciones/normalizador, sin hacer llamadas de red.
  La lectura OCR y sus referencias son propuestas que requieren comparación
  humana con el archivo original.
- Se extraen hasta 200 partidas Excel o 50 documentales. Si exceden el límite,
  o el proveedor declara extracción parcial, falla la extracción completa.
  La selección posterior de un subconjunto es una decisión explícita.
- CyP declara agrupadores y filas H/I de costo en `excludedRows`. Cotización
  separa agrupadores con descendientes por código; sus rubros mensuales agregados
  no se reparten entre tareas. No se convierten dinero o porcentajes en metrado.

Los perfiles v1/v2/v3/v4, sus consentimientos, fingerprints y resultados siguen
vigentes: `quantityImported:false` histórico conserva su significado. La curva
monetaria original permanece completa, sin recomputarse según partidas físicas
seleccionadas, cantidades corregidas o exclusiones.

## Procedencia conservada

El extractor Excel calcula SHA-256 de los bytes y comprueba el SHA esperado si
se proporciona. Cada fila se identifica por hoja y rango de la misma fila, con
código, agrupador, descripción y direcciones originales de cantidad/unidad.
Una fila no se identifica por título editable ni posición de selección.

Cada celda física conserva presencia/ausencia, `<v>` original, texto resuelto,
tipo, presencia de cache, fórmula original/atributos, maestro de fórmula
compartida, estilo efectivo y atributos originales de celda/fila/columnas,
además de las intersecciones con merges. Los estilos de fila/columna se aplican
también a celdas ausentes; no se fabrica una cache ni una visibilidad favorable.
Las filas XML contradictorias con las direcciones de sus celdas se rechazan.
El snapshot nuevo expone sólo columnas físicas de las hojas permitidas.

Código y título conservan los mismos hechos completos; en CyP también se
conservan sus celdas de contraste en el presupuesto original. Sus valores y
direcciones deben coincidir con la identidad declarada. Fórmulas inseguras o
shared huérfanas en la identidad rechazan la extracción. Cache segura,
ocultamiento, formato o visibilidad inciertos exigen `IDENTITY_REVIEW_REQUIRED`
y una confirmación independiente `identityConfirmed:true` después de comparar
código/descripción literales con el original. `hidden="True"` no se interpreta
como visible: queda incierto porque no es el boolean XML reconocido.

Los estilos permitidos son General y formatos numéricos simples conocidos.
Fecha/hora, porcentaje, moneda, fracción, escala visual, `;;;`, formatos
desconocidos, visibilidad incierta, celdas ocultas/merged y fórmulas inseguras no
producen una baseline automática. Una fórmula con cache sintácticamente válida
requiere reconocimiento explícito; no demuestra que la cache esté actualizada.
Referencias externas, fórmulas data-table/orphan y caches ausentes quedan
pendientes de corrección. Nunca se evalúa una fórmula.

PDF/imagen conserva título/código literales, cantidad/unidad originales y
evidencia breve de página/ubicación/texto. La cantidad/unidad deben aparecer
literalmente en el quote propuesto; esto comprueba consistencia del resultado,
no fidelidad OCR. Imagen exige página1. Una ausencia requiere incertidumbre y
nunca equivale a cero. La autoría del documento no sustituye al actor autenticado
que carga, revisa o aprueba.

## Decimal, unidad y revisión

La cantidad candidata se procesa con BigInt, sin cast a Number, redondeo,
conversión de unidades ni inferencia de separadores locales. La baseline de Task
admite hasta 14 dígitos enteros y 4 decimales, y debe ser positiva.

| Fuente literal | Candidato | Resultado |
| --- | --- | --- |
| `12.34000` | `12.3400` | Representación exacta; original conservado |
| `1e2` numérico Excel | `100.0000` | Expansión exacta; no cálculo de fórmula |
| `1.23456`, `1e-5` | null | Requiere corrección explícita; no redondeo |
| `1,25`, `1 000`, `$12`, `1%` | null | No se interpreta separador/dinero/porcentaje |
| Ausente / `0` / `-1` | null | Incidencias distintas; no baseline positiva |

Se propone una tabla limitada de alias de unidad, sin factores de conversión.
Cada propuesta requiere confirmación. En Excel, una unidad literal reconocida
obliga a la misma unidad canónica: `m²`→`M2` permite representación, mientras
`m²`→`KG` se deniega. Una unidad desconocida exige elección humana explícita y
motivo. Las unidades OCR son candidatas; pueden corregirse tras comparar la
fuente, con motivo y reconocimiento de incidencias, sin conversión automática.

`normalizePlanMeasurementReview({source,rows})` valida un subconjunto explícito:
identidades únicas, baseline decimal canónica, unidad admitida, motivo de8–1000
caracteres, confirmación y reconocimiento de las incidencias presentes. Devuelve
SHA/digest de fuente, código original y marca `corrected`. Recalcula el candidato
desde los hechos originales; no acepta derivados enviados libremente.
`identityConfirmed` es boolean opcional cuando no existen dudas de identidad;
el resultado siempre conserva su valor normalizado y se revalida al aplicar.

El store debe usar la Source original extraída/persistida por el servidor y
comparar su digest/revisión; un SHA con formato válido enviado por un cliente no
acredita procedencia. Debe declarar filas omitidas y resolver separadamente el
destino CREATE o EXISTING, con identidad y revisión de Task explícitas. Aplicar
el metrado requiere autorización vigente y transacción/recibo propios. No debe
sobrescribir definiciones existentes o cantidades selladas, ni reconstruir
ejecución desde porcentaje histórico. Una tarea nueva comienza con avance0 y
sin un recibo de cantidad ejecutada; fechas requieren revisión independiente.

## Comprobación

`tests/production-plan-measurement-source.test.mjs` cubre precisión/overflow,
consentimiento, extracción200/201, faltantes, formatos e herencia, ocultos/merges,
caches/fórmulas compartidas, shared strings, identidad/SHA, manipulación de
derivados, selección/revisión y evidencia documental. Las fixtures nuevas son
completamente sintéticas y tienen filas XML coherentes. No modifican ni
resnapshottean fixtures históricas.

Cotización rechaza un total prematuro si después aparecen códigos, unidades o
cantidades: esas filas no se omiten como si la extracción estuviera completa.
También rechaza una fila física sin descripción. Las notas sólo textuales que
siguen al total no son partidas. Los booleanos XML de selección de formato
(`customFormat`, `applyNumberFormat`) aceptan únicamente 0, 1, false y true;
un valor desconocido no se convierte en el formato General.

Las pruebas de fuente no acreditan la integración de guardado, revisión humana,
proveedor real ni aceptación con documentación de una obra. Esas verificaciones
corresponden al flujo integrado y a sus recibos canónicos.
