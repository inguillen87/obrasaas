import fs from 'fs';
import path from 'path';

// Path for local file fallback
const LOCAL_DB_PATH = path.join(process.cwd(), 'data', 'db.json');

const initialIncidents = [
    {
        id: "inc-1",
        title: "Quiebre de Stock Crítico",
        description: "Cemento Loma Negra por debajo del mínimo de seguridad (35 de 40 bolsas). Riesgo de detención de revoque grueso.",
        type: "warning",
        badge: "Stock Bajo",
        timestamp: "Hoy, 08:30 AM",
        reporter: "Control de Corralón",
        icon: "fa-solid fa-triangle-exclamation"
    },
    {
        id: "inc-2",
        title: "Alerta de Geocerca (Desvío GPS)",
        description: "El operario Carlos Pérez registró check-in satelital a 150m del radio de obra verificado (excede límite de 20m).",
        type: "critical",
        badge: "Desvío GPS",
        timestamp: "Hoy, 07:50 AM",
        reporter: "Geolocalización Satelital",
        icon: "fa-solid fa-location-crosshairs"
    },
    {
        id: "inc-3",
        title: "Asistencia Registrada por Voz",
        description: "Juan Gómez (Albañilería Principal) inició jornada. Biometría de voz validada con éxito.",
        type: "success",
        badge: "Presentismo",
        timestamp: "Hoy, 08:02 AM",
        reporter: "Asistente de Voz IA",
        icon: "fa-solid fa-microphone"
    },
    {
        id: "inc-4",
        title: "Planificación Gantt Sincronizada",
        description: "Línea base reajustada. Hito de finalización proyectado para el 15/Jul.",
        type: "info",
        badge: "Gantt",
        timestamp: "Ayer, 06:15 PM",
        reporter: "Supervisor IA",
        icon: "fa-solid fa-chart-gantt"
    }
];

export const defaultAppState = {
    operariosCount: 1,
    avancePercentage: 42,
    alertsCount: 2,
    diasEstimados: "Día 12/35",
    tasks: {
        1: { name: "Revoque Grueso", progress: 80, duration: 5, startOffset: 0, assignee: "Juan Gómez" },
        2: { name: "Cañería y Descargas", progress: 20, duration: 4, startOffset: 28.5, assignee: "Luis Martínez" },
        3: { name: "Revestimiento Cerámico", progress: 0, duration: 4, startOffset: 57.1, assignee: "Carlos Pérez" },
        4: { name: "Pintura y Terminación", progress: 0, duration: 2, startOffset: 85.7, assignee: "Carlos Pérez" }
    },
    incidents: initialIncidents,
    attendance: {
        "Juan Gómez": { role: "Albañilería Principal", checkin: "08:02 AM", status: "Presente" },
        "Carlos Pérez": { role: "Pintura e Interiores", checkin: "--:--", status: "Ausente" },
        "Luis Martínez": { role: "Instalaciones y Sanitarios", checkin: "--:--", status: "Ausente" }
    },
    stockpiles: {
        cemento: { name: "Cemento Loma Negra", current: 35, min: 40, max: 150, unit: "Bolsas", supplier: "Loma Negra S.A.", status: "Crítico" },
        hierro: { name: "Hierro A500 Acindar", current: 85, min: 30, max: 100, unit: "Barras", supplier: "Acindar Distribuidores", status: "Stock OK" },
        ladrillo: { name: "Ladrillo Portante Alberdi", current: 1500, min: 800, max: 2500, unit: "Uds", supplier: "Ladrillos Alberdi", status: "Stock OK" },
        arena: { name: "Arena Fina Cantera", current: 4, min: 8, max: 20, unit: "m³", supplier: "Cantera Palermo", status: "En Camino" }
    },
    crmLeads: [
        { name: "Ing. R. Silva", company: "Silva Constructora", topic: "Cotización para 8 obras simultáneas", status: "Nuevo Lead" },
        { name: "Arq. Sofía B.", company: "Estudio SB", topic: "Consulta por plan Pro de 3 usuarios", status: "En Contacto" },
        { name: "Arq. Carlos M.", company: "PfZ Planeamiento", topic: "Demo de Geofencing en Mendoza", status: "Nuevo Lead" }
    ],
    crmTickets: [
        { client: "Estudio BMA", issue: "Error de sincronización en mapa de Palermo", severity: "Media" },
        { client: "MSGSSV", issue: "Falla al exportar reporte semanal en PDF", severity: "Alta" },
        { client: "Constructora Innovar", issue: "Agregar invitación para 2 operarios extra", severity: "Baja" }
    ],
    hrAttendance: {
        "Juan Gómez": { role: "Albañilería Principal", presents: 21, excused: 1, unexcused: 0, status: "Presente" },
        "Carlos Pérez": { role: "Pintura e Interiores", presents: 15, excused: 2, unexcused: 5, status: "Ausente" },
        "Luis Martínez": { role: "Instalaciones y Sanitarios", presents: 18, excused: 3, unexcused: 1, status: "Ausente" }
    },
    hrBonuses: [
        { name: "Juan Gómez", type: "Bono Puntualidad", amount: "$25.000 ARS", date: "Hace 2 días" },
        { name: "Luis Martínez", type: "Bono Desempeño", amount: "$45.000 ARS", date: "Hace 1 semana" }
    ],
    subscription: {
        status: "active",
        plan: "Pro",
        expiresAt: "2027-12-31"
    }
};

export const defaultMessages = [
    {
        sender: "bot",
        text: "Hola Arq. Marcelo. Soy tu Copiloto Inteligente de ObraSaaS. Estoy procesando los reportes de la cuadrilla y telemetría de obra en tiempo real. Escribe una consulta o reproduce un audio.",
        time: "08:00 AM"
    }
];

// Helper to check and initialize the local database file
function initLocalDb() {
    const dir = path.dirname(LOCAL_DB_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(LOCAL_DB_PATH)) {
        fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify({
            appState: defaultAppState,
            messages: defaultMessages
        }, null, 2));
    }
}

// Read database contents
async function readDb() {
    if (process.env.DATABASE_URL) {
        try {
            // Placeholder for Postgres/Supabase/Vercel Postgres integration
            // e.g., const { rows } = await pg.query('SELECT data FROM state WHERE id = 1');
            // return rows[0].data;
        } catch (e) {
            console.error("External database read error. Falling back to local file:", e);
        }
    }
    initLocalDb();
    const data = fs.readFileSync(LOCAL_DB_PATH, 'utf-8');
    try {
        return JSON.parse(data);
    } catch(e) {
        return {
            appState: defaultAppState,
            messages: defaultMessages
        };
    }
}

// Write database contents
async function writeDb(data) {
    if (process.env.DATABASE_URL) {
        try {
            // Placeholder for Postgres/Supabase write
            // await pg.query('UPDATE state SET data = $1 WHERE id = 1', [JSON.stringify(data)]);
            // return;
        } catch (e) {
            console.error("External database write error. Falling back to local file:", e);
        }
    }
    initLocalDb();
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2));
}

export async function getAppState() {
    const db = await readDb();
    return db.appState || defaultAppState;
}

export async function saveAppState(state) {
    const db = await readDb();
    db.appState = state;
    await writeDb(db);
    return state;
}

export async function getMessages() {
    const db = await readDb();
    return db.messages || defaultMessages;
}

export async function saveMessages(messages) {
    const db = await readDb();
    db.messages = messages;
    await writeDb(db);
    return messages;
}

export async function resetState() {
    const freshDb = {
        appState: JSON.parse(JSON.stringify(defaultAppState)),
        messages: JSON.parse(JSON.stringify(defaultMessages))
    };
    await writeDb(freshDb);
    return freshDb;
}
