# Bitácora: contexto visible y continuidad del registro

La bitácora fija empresa y obra desde la pantalla y las adjunta a sus solicitudes. El servidor compara esas condiciones con la sesión antes de consultar o modificar datos. No son una autorización suministrada por el navegador: se mantienen los permisos de sesión y revisión.

Una discrepancia de contexto no se confunde con un conflicto de versión. El cliente deja de enviar nuevas operaciones desde esa instancia, conserva el texto y muestra una advertencia persistente. Es posible copiar el texto o abrir la obra activa en otra pestaña. Recargar exige confirmar el descarte de cambios locales. No se copia ni almacena el archivo en el portapapeles.

La franja de contexto muestra la obra de esta pantalla y el circuito Registrar → Enviar a revisión → Decisión autorizada. El aviso no afirma que los borradores estén guardados ni equivale a una cola offline. Una creación sin ID, estado y revisión válidos no borra el texto ni se presenta como guardado confirmado. No hay reintentos automáticos nuevos.

Se mantiene la compatibilidad documentada de clientes que omiten las cabeceras. Esta entrega se limita al editor de bitácora y su ruta de revisión: no certifica todas las rutas ni integraciones externas.

## Verificación reproducible
Las pruebas de contexto ejecutan rutas reales con dependencias simuladas y mantienen la comparación real de contexto junto con los controles de rol. El ensayo de navegador monta el componente real con identidad y respuestas sintéticas: conservación de texto, copia, cancelación de recarga, guardado válido, respuesta incompleta y diseño a 320/390/768/1280 px. No es una sesión Clerk real ni una prueba contra PostgreSQL o WhatsApp.

Antes de integrar en la rama deben pasar la suite completa, ESLint de afectados y npm run build. La validación en GitHub Actions no solicita claves Meta, datos productivos ni secretos de Vercel. La publicación de la aplicación queda separada y requiere su validación de entorno habitual.
