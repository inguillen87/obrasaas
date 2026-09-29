# Marca v3 en producción

Base productiva: `e7e535ccc0d1e724bf92d61173398f211e9cc4d8`.
Fuente de marca: `1677ff72773c95140535603093e5cb8624d1f063`. Se recuperan únicamente sus activos y componente, no los otros cambios de la rama enterprise.

Los 12 archivos de public/brand, favicon ICO, icon PNG, Apple icon, geometría, estilos y sistema de marca se copian del commit original. `brand-v3-source.json` conserva sus hashes. El componente sólo agrega atributos para pruebas; su geometría no cambia.

Portada, pie de página, aviso de acceso, ingreso, registro y cuenta utilizan ObraSaasLogo. El código de la barra lateral, cabecera móvil y marca del informe del dashboard también se actualiza, sin habilitar esa ruta ni presentar su sesión como verificada.

Se retiran los selectores que convertían cualquier span de la marca en un cuadro OS. Se incorpora Manrope y se conservan los colores oficiales. El trazado se anima una vez y respeta reduced motion. Se mantiene el nombre accesible y los enlaces a inicio.

El manifest conserva id, start_url y scope. Usa los iconos oficiales SVG, 192, 512 y maskable separado. Se retira una captura declarada de dashboard que en realidad era un icono. Las rutas antiguas de iconos permanecen y sirven la marca nueva.

La caché pública v5 reemplaza la v4 al activarse; no guarda APIs ni páginas privadas ni toca operaciones pendientes. La renovación del icono de una instalación existente también depende del navegador y del sistema operativo.

La lista pública incorpora sólo los nuevos archivos de imagen exactos. No habilita directorios, prefijos, cuentas ni APIs. Las escrituras permanecen denegadas. No se modifican credenciales, autenticación, almacenamiento privado, registros de obra ni migraciones.

Las pruebas comprueban hashes de origen, geometría SVG, dimensiones de iconos, manifest, rutas de lectura, sustitución de OS y reduced motion. El navegador compara cada archivo servido, logos/metadatos y cuatro tamaños de pantalla; comprueba la renovación de caché y que el acceso privado siga denegado. El modo live sólo admite obrasaas.com y no envía operaciones de negocio.

Se mantienen los controles CI existentes. El dashboard legacy conserva incidencias lint anteriores fuera del bloque de marca: aquí sólo se cambian importaciones y tres emblemas. No se desactivan reglas globales. La portada corrige dos comillas JSX que ya generaban errores lint sin cambiar su contenido visible.

Resultados finales, SHA, CI y despliegue quedan registrados después de comprobarlos. Este corte resuelve la identidad visual, no la reapertura del panel empresarial.
