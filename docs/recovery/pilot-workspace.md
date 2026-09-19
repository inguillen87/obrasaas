# Alta explícita de empresa piloto para WhatsApp

La demo interna de administración no es un tenant cliente. Esta entrega añade un alta Preview que prepara una organización de identidad real, su membresía del titular y una obra independiente antes de importar el número de prueba. No elimina la restricción de importación a organizaciones externas ni cambia la resolución de acceso del superadmin.

## Operación
En Integraciones, el superadmin del piloto confirma los nombres y el alcance. El backend usa su sesión; no admite IDs de actor, tokens, destinatarios o empresa enviados por el cliente. Sólo funciona cuando VERCEL_ENV=preview y WHATSAPP_PILOT_IMPORT_ENABLED=true. El origen y las cabeceras de contexto se verifican antes de llamar al proveedor.

La organización se crea con el SDK de Clerk, createdBy del usuario autenticado, slug determinista y metadata privada de procedencia. Primero se busca ese slug y se verifica que pertenezca al mismo intento. Una respuesta perdida se reconcilia con una lectura; no se emite una segunda creación ciega. Cambiar los nombres de un piloto existente devuelve conflicto en lugar de reutilizarlo silenciosamente.

La membresía remota debe existir y ser administrativa. La sincronización de organización y membresía, la obra y un recibo único de auditoría se completan bajo el bloqueo de identidad existente. No se reactiva una membresía revocada, no se aumenta una suscripción vencida y no se cambia una obra archivada. Un fallo de la transacción deja la identidad remota recuperable con el mismo intento, no otro tenant nuevo.

El resultado habilita seleccionar el destino en la importación piloto existente. Crear el espacio no conecta el número, no envía mensajes ni invitaciones, no crea trabajadores y no copia la demo interna. El trial se asigna por la política de alta existente, sin cambiar planes de otros clientes.

## Interfaz y confirmación
El panel utiliza tokens Dark Obsidian, campos táctiles y una confirmación explícita. Bloquea envíos duplicados. En una respuesta incierta conserva los mismos nombres y permite verificar el mismo intento. Verifica el contexto y el resultado antes de mostrar alta confirmada. La importación posterior conserva sus validaciones de número/WABA, permisos, cifrado y recuperación.

## Pruebas y alcance
Se prueban dominio y handlers con proveedores controlados: alta aislada, reintento, respuesta perdida, origen, contexto, modo Preview, permisos, trial vencido, membresía revocada, nombres cambiados y rollback de auditoría. La prueba de navegador monta el componente real con respuestas sintéticas y valida los anchos 320/390/768/1280 px.

La creación autenticada, vinculación del número, recepción desde WhatsApp Web, persistencia y respuesta se documentan por separado con sus resultados efectivos. No se consideran terminadas por pasar tests aislados ni se afirma capacidad para cientos de tenants sin mediciones de carga y operación. La continuidad corresponde al aislamiento del Sprint 10 y la operación real por celular del Sprint 11 del plan maestro.

Referencias de SDK consultadas: documentación oficial Clerk createOrganization y getOrganization. No se solicita la contraseña del usuario ni se imprimen credenciales. No hay nuevas tablas, migraciones o dependencias.
