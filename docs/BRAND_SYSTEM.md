# Sistema de marca ObraSaaS

Estado: identidad operativa v3, lista para producto y comunicación. El nombre y el símbolo deben revisarse legalmente antes de registrar la marca o comprar el dominio definitivo.

## Idea central: enlace estructural

El símbolo representa el vínculo que diferencia a ObraSaaS: dos partes de una operación dejan de trabajar aisladas cuando una señal de campo gana contexto y se convierte en una decisión coordinada.

- Los dos módulos verde carbón funcionan como piezas estructurales complementarias: campo y dirección, empresa y obra, dato y decisión. No forman un marco de escaneo ni dibujan un edificio literal.
- El trazado naranja atraviesa ambas piezas con una única curva continua. Representa captura, contexto, revisión y registro; también aporta una firma reconocible cuando el símbolo se reduce.
- La tensión entre ángulos técnicos y curvas humanas evita que la identidad parezca una plantilla de software o una marca de ingeniería pesada.
- La geometría plana conserva una silueta clara en 16 px, funciona en una tinta y permite revelar el recorrido una sola vez sin convertir la marca en decoración.
- El símbolo evita los recursos saturados del software de construcción: casa, casco, grúa, skyline, cubo, tilde, escudo, pin y cuatro esquinas de escaneo.

La marca no utiliza descriptor junto al nombre. `ObraSaaS` es la firma completa; expresiones de posicionamiento como “sistema operativo de obra” pertenecen al contenido, no al lockup.

## Activos oficiales

- `public/brand/obrasaas-app-icon.svg`: ícono opaco para launchers, perfiles y avatares institucionales.
- `public/brand/obrasaas-app-icon-1024.png`: raster de alta resolución.
- `public/brand/obrasaas-app-icon-192.png` y `obrasaas-app-icon-512.png`: íconos PWA.
- `public/brand/obrasaas-maskable-512.png`: ícono PWA maskable.
- `public/brand/obrasaas-favicon.svg`: microícono para 16–48 px.
- `public/brand/obrasaas-symbol.svg`: símbolo para fondos claros.
- `public/brand/obrasaas-symbol-inverse.svg`: símbolo para fondos oscuros.
- `public/brand/obrasaas-symbol-mono.svg`: versión monocromática.
- `public/brand/obrasaas-lockup.svg`: firma horizontal para fondos claros.
- `public/brand/obrasaas-lockup-inverse.svg`: firma horizontal para fondos oscuros.
- `public/brand/obrasaas-lockup-mono.svg`: firma horizontal a una tinta.
- `src/app/brand/brand-geometry.js`: geometría canónica usada por la interfaz.
- `src/app/brand/brand-logo.js`: símbolo y lockup vivos, accesibles y adaptables al tema.

Los PNG, Apple icon, maskable e ICO se regeneran con `npm run brand:assets`; no se editan manualmente.

## Paleta principal

| Uso | Color | Hex |
| --- | --- | --- |
| Fondo profundo | Verde carbón | `#08110F` |
| Estructura / tinta | Verde estructural | `#0A1B17` |
| Texto inverso | Marfil técnico | `#F4F1E8` |
| Campo / acción | Naranja obra | `#F28A42` |

El naranja identifica recorrido y acción. No debe convertirse en un relleno dominante ni reemplazar colores semánticos de WhatsApp, éxito, advertencia o riesgo.

## Wordmark

El nombre se compone con Manrope:

- `Obra`: peso 800.
- `SaaS`: peso 650 y contraste secundario.
- Tracking aproximado: `-0.055em`.

En producto se usa `ObraSaasLogo`; nunca se combina el app icon cuadrado con el wordmark. Para piezas externas se usan los lockups convertidos a paths, sin elementos `<text>` ni dependencia de fuentes instaladas.

## Contraste y movimiento

- `auto`: marfil en tema oscuro y verde estructural en tema claro.
- `dark`: verde estructural para fondos claros.
- `inverse`: marfil para fondos oscuros.
- `mono`: una sola tinta heredada.
- `app`: fondo verde carbón, reservado para launchers y perfiles.

El recorrido puede revelarse una sola vez al cargar un lockup. No se anima de forma continua y se desactiva con `prefers-reduced-motion`.

## Reglas de uso

- Tamaño mínimo del símbolo digital: `24 px`; entre `16` y `23 px`, usar el favicon.
- Tamaño mínimo del lockup: `120 px` de ancho.
- Área de protección: al menos el grosor de uno de los módulos estructurales alrededor de la marca.
- No rotar, inclinar, deformar ni alterar el cambio de nivel del trazado.
- No agregar sombras, biseles, gradientes o contornos.
- No encerrar el símbolo en otra forma salvo el app icon oficial.
- No usar el símbolo como ícono genérico de una obra, aprobación o estado.
- La identidad de un tenant puede convivir como contexto secundario, pero no reemplaza la autoría de plataforma.
