# 🏗️ ObraSaaS - Plataforma SaaS de Control de Obras Inteligente

ObraSaaS es una plataforma SaaS modular de nivel de producción diseñada para arquitectos, inspectores y constructoras en América Latina. Convierte reportes informales por mensajes de voz y fotos de WhatsApp en planificación Gantt reactiva y reportes ejecutivos semanales automáticos.

---

## 🚀 Características Clave

1.  **Copiloto de Voz de WhatsApp (IA)**:
    *   Los operarios envían audios a un número de WhatsApp.
    *   La plataforma transcribe (Whisper API) e interpreta intenciones (IA) para registrar asistencia satelital, actualizar tareas del Gantt y añadir incidencias del corralón.
2.  **Geocercas Satelitales (Geofencing)**:
    *   Validación de presentismo mediante el envío de ubicación en tiempo real en WhatsApp.
    *   Verificación automática de coordenadas contra el predio de la obra (límite de 20 metros).
3.  **Cronograma Gantt Interactivo**:
    *   Seguimiento dinámico de dependencias y tareas de obra (Revoque, Cañerías, Revestimiento, Pintura) con barras y líneas de progreso reactivas.
4.  **Consola SuperAdmin (CRM)**:
    *   Gestión integrada de leads, tickets de soporte técnico de clientes corporativos y gráficas financieras de suscripciones.
5.  **Membership Gate (Planes SaaS)**:
    *   Control de accesos según la licencia contratada:
        *   **Free**: Hasta 1 operario activo en demo.
        *   **Pro ($180.000 ARS/mes)**: Operarios ilimitados, edición Gantt y exportación de reportes PDF.
        *   **Enterprise ($350.000 ARS/mes)**: Control multi-obra, auditoría blockchain y analíticas avanzadas.
6.  **WhatsApp Webviews**:
    *   Páginas optimizadas para celular integrables en botones de plantillas de WhatsApp:
        *   `/webview/medical` para subir certificados médicos directamente.
        *   `/webview/attendance` para marcar presentismo detallado.

---

## 🛠️ Estructura del Proyecto (Next.js App Router)

*   `src/app/page.js`: Landing page comercial con la Asistente Virtual Sofía AI.
*   `src/app/dashboard/page.js`: Panel administrativo principal (Gantt, Mapa Satelital, Acopios, CRM, RRHH y Facturación).
*   `src/app/presupuesto/page.js`: Hoja membretada oficial con la propuesta de desarrollo de $4.995.000 ARS.
*   `src/app/api/state/route.js`: API para leer, actualizar y resetear el estado de la obra.
*   `src/app/api/whatsapp/route.js`: Webhook de mensajería (compatible con Twilio y Meta) que procesa la lógica conversacional.
*   `src/app/api/billing/route.js`: Pasarela para simulación de upgrades y degradación de planes.
*   `src/app/webview/`: Vistas de integración en el chat de WhatsApp.
*   `src/lib/db.js`: Adaptador centralizado con fallback automático a archivo local (`data/db.json`) si no hay base de datos SQL conectada.

---

## 💻 Configuración y Ejecución Local

### Prerrequisitos
*   Node.js (v18 o superior)
*   npm (v9 o superior)

### Instalación y Servidor de Desarrollo
1.  Instala las dependencias necesarias:
    ```bash
    npm install
    ```
2.  Inicia el servidor local en modo desarrollo:
    ```bash
    npm run dev
    ```
3.  Abre tu navegador en [http://localhost:3000](http://localhost:3000).

---

## 🌐 Guía de Despliegue en GitHub y Vercel

### Paso 1: Inicializar y empujar a GitHub
```bash
git remote add origin https://github.com/TU-USUARIO/obrasaas-saas.git
git branch -M main
git push -u origin main
```

### Paso 2: Desplegar en Vercel
1.  Importa el repositorio en tu cuenta de Vercel.
2.  Configura las siguientes variables de entorno en el panel (opcional para simulación, requerido para producción):
    *   `OPENAI_API_KEY`: Para transcripción por Whisper.
    *   `DATABASE_URL`: URL de Postgres (Supabase/Neon) para persistencia duradera de producción.
3.  Haz clic en **Deploy**. ¡El proyecto estará en vivo en segundos!

---

## 📄 Licencia y Garantía (SLA)

Soporte técnico premium post-despliegue por 30 días incluido. Propiedad intelectual exclusiva del cliente una vez saldada la propuesta de servicios de Innovar Latam.
