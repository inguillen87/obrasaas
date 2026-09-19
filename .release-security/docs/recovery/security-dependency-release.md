# Actualización acotada de dependencias — preparación de release

Fecha: 19/09/2026. Base: b47980aa948899dbb30af91a344a10b07f6bebd4.

## Motivo y alcance
La auditoría del lockfile para dependencias de producción identificó ocho entradas afectadas: una crítica, seis altas y una moderada. Ese conteo incluye dependencias transitivas y agregados como Prisma; no equivale a ocho ataques demostrados ni prueba que cada vulnerabilidad sea alcanzable en el despliegue actual. No se observaron ataques en esta comprobación.

Se revisaron avisos y versiones corregidas publicados por los mantenedores. Se fijan Next.js y eslint-config-next en 16.3.5, sharp en 0.35.4 y fast-uri en 3.1.6. Se incorporan overrides acotados para mysql2 3.23.1 y baseline-browser-mapping 2.11.0. No se ejecuta `npm audit fix --force` ni se acepta el downgrade sugerido de Prisma a la versión 6.

## Excepción de compatibilidad explícita: deepmerge-ts
Prisma 7.9.0 utiliza deepmerge-ts 7.1.5 como función de mezcla al cargar su configuración mediante c12. El aviso GHSA-ggr8-5vv4-36mx se corrige en deepmerge-ts 8.0.0; la versión 8 también introduce cambios de comportamiento en Maps y tipos. Por ello el override se limita a la dependencia de `@prisma/config`, no al código de negocio.

La configuración de ObraSaaS utiliza objetos ordinarios de schema, migrations y datasource. La comprobación valida esa estructura con el cargador real de Prisma y verifica que su mezcla no muta los registros originales. Además se exige validación/generación Prisma, aplicación de migraciones en PostgreSQL desechable y build de la aplicación antes de integrar el cambio. Esto comprueba el uso de esta aplicación; no declara compatibilidad universal de toda API de deepmerge-ts 7 y 8. Debe retirarse el override cuando la versión adoptada de Prisma incorpore una dependencia corregida compatible.

## Controles
Se conserva package-lock.json, actualizando solamente la resolución necesaria para estos cambios. La instalación final se realiza con `npm ci`. Las pruebas fijan mínimos de seguridad para las dependencias afectadas y que Prisma continúe en la versión mayor 7. Los resultados de la auditoría nueva, las versiones resueltas, los tests, el build y las pruebas de PostgreSQL quedan como artefactos de la ejecución de validación; un resultado fallido impide el commit de aplicación.

El uso de PostgreSQL en ObraSaaS no convierte el paquete transitivo mysql2 en un conector de negocio activo. Se actualiza su dependencia sin habilitar MySQL ni alterar el esquema. Tampoco se crean bases de usuarios, cambian credenciales, envían mensajes o despliega producción desde este proceso.

## Referencias primarias
- Next.js, aviso GHSA-2xp9-vwfh-vxw4: https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4
- Next.js, release 16.3.5: https://github.com/vercel/next.js/releases/tag/v16.3.5
- sharp, aviso y parche 0.35.4: https://github.com/lovell/sharp/security/advisories/GHSA-rgj7-g3m4-5g8c
- fast-uri 3.1.6: https://github.com/fastify/fast-uri/releases/tag/v3.1.6
- MySQL2 3.23.1: https://github.com/sidorares/node-mysql2/releases/tag/v3.23.1
- deepmerge-ts 8.0.0 y cambios incompatibles: https://github.com/RebeccaStevens/deepmerge-ts/releases/tag/v8.0.0
- cargador Prisma 7.9.0: https://github.com/prisma/prisma/blob/7.9.0/packages/config/src/loadConfigFromFile.ts
- baseline-browser-mapping 2.11.0: https://github.com/web-platform-dx/baseline-browser-mapping/releases/tag/v2.11.0

## Publicación
Una auditoría sin avisos conocidos y un build exitoso no certifican ausencia de vulnerabilidades ni habilitan por sí solos el pase. Siguen siendo necesarios la configuración Production, el control de identidad/SHA de base, el resguardo y el ensayo autenticado del canal. No se retiran esas guardas para publicar esta actualización.
