# Sistema de marca ObraSaaS

Estado: identidad operativa v1, lista para producto y comunicación. El nombre y el símbolo deberán revisarse legalmente antes de registrar la marca o comprar el dominio definitivo.

## Idea central

El símbolo representa una planta estructural que se convierte en una obra coordinada:

- La losa superior forma una `O` en perspectiva: ObraSaaS conecta la planta, la ejecución y el control sin recurrir a un monograma literal.
- El vacío central funciona como núcleo de coordinación y conserva una silueta reconocible incluso en tamaños pequeños.
- La capa naranja expresa la ejecución física y el avance real de la obra.
- Las caras laterales aportan profundidad y muestran que la información de campo pasa a formar parte de una estructura operativa común.

La marca evita recursos demasiado literales o genéricos para software de construcción: casco, casa, grúa, tilde de verificación, escudo y hexágono.

## Activos oficiales

- `public/brand/obrasaas-app-icon.svg`: ícono con fondo para aplicaciones y perfiles.
- `public/brand/obrasaas-app-icon-1024.png`: versión raster de alta resolución.
- `public/brand/obrasaas-app-icon-192.png` y `obrasaas-app-icon-512.png`: íconos PWA de propósito general.
- `public/brand/obrasaas-maskable-512.png`: ícono PWA opaco y preparado para máscaras del sistema.
- `public/brand/obrasaas-favicon.svg`: microícono simplificado para 16–48 px.
- `public/brand/obrasaas-symbol.svg`: símbolo para fondos claros.
- `public/brand/obrasaas-symbol-inverse.svg`: símbolo para fondos oscuros.
- `public/brand/obrasaas-symbol-mono.svg`: versión monocromática.
- `public/brand/obrasaas-lockup.svg`: firma horizontal para fondos claros.
- `public/brand/obrasaas-lockup-inverse.svg`: firma horizontal para fondos oscuros.
- `public/brand/obrasaas-lockup-mono.svg`: firma horizontal a una tinta.
- `src/app/brand/brand-logo.js`: lockup vivo y accesible utilizado por la interfaz.

## Paleta principal

| Uso | Color | Hex |
| --- | --- | --- |
| Fondo profundo | Verde carbón | `#08110F` |
| Estructura / texto inverso | Marfil técnico | `#F4F1E8` |
| Campo / acción | Naranja obra | `#F28A42` |

El naranja es un acento de acción, no un color de relleno indiscriminado. El verde carbón reemplaza al negro puro para conservar profundidad y una identidad propia.

## Wordmark

El nombre se compone con Manrope:

- `Obra`: peso 800, el máximo real del archivo variable de Manrope utilizado por el producto.
- `SaaS`: peso 650 y menor contraste.
- Tracking aproximado: `-0.055em`.

No se debe recrear el wordmark como una imagen raster. En producto se utiliza el componente `ObraSaasLogo` para mantener nitidez, traducción accesible y consistencia tipográfica. Para piezas externas se usan los lockups oficiales: el wordmark ya está convertido a paths, no contiene elementos `<text>` ni depende de que Manrope esté instalada en el equipo de destino.

## Reglas de uso

- Tamaño mínimo recomendado del símbolo digital: `24 px`; entre `16` y `23 px` usar el microícono de favicon.
- Tamaño mínimo recomendado del lockup: `120 px` de ancho.
- Área de protección: como mínimo, el grosor de un tramo del símbolo alrededor de toda la marca.
- En fondos claros: usar `obrasaas-lockup.svg` o `obrasaas-symbol.svg` si el espacio no admite la firma completa.
- En fondos oscuros: usar `obrasaas-lockup-inverse.svg` o `obrasaas-symbol-inverse.svg`.
- Cuando el color no sea viable: usar `obrasaas-lockup-mono.svg` o `obrasaas-symbol-mono.svg`.
- Para favicons de hasta `48 px`: usar el microícono preparado. Para launchers, perfiles y avatares institucionales: usar el app icon.
- Para `maskable` y Apple touch icon: usar únicamente las variantes opacas preparadas; el sistema operativo aplica su propia máscara.

## Usos prohibidos

- No rotar, inclinar ni deformar.
- No cambiar la perspectiva, el vacío central ni la relación entre los niveles estructurales.
- No agregar sombras, biseles, contornos o gradientes dentro del símbolo.
- No encerrar el símbolo en otra forma salvo el app icon oficial.
- No reemplazar los colores principales por colores de cada tenant.
- No usar el símbolo como ícono genérico de estado, aprobación o seguridad.

## Marca de tenants

ObraSaaS conserva su identidad en navegación, autenticación, comunicaciones del sistema y superficies de confianza. La identidad de cada organización puede aparecer como contexto secundario —nombre, avatar y color de acento— sin reemplazar la marca de plataforma ni confundir la autoría de las acciones.
