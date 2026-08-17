import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

// Global connection pool cache for Neon PostgreSQL
let pool = null;

function getPool() {
    if (!pool && process.env.DATABASE_URL) {
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false },
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
        });
    }
    return pool;
}

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
    currentQuincena: "Quincena 1 (01/Ago - 15/Ago)",
    // Tasks with Quincenas and Material Blockers (v2.0)
    tasks: {
        1: {
            name: "Revoque Grueso",
            progress: 80,
            duration: 5,
            startOffset: 0,
            assignee: "Juan Gómez",
            quincena: "Q1",
            startDate: "2026-08-01",
            endDate: "2026-08-06",
            requiredMaterials: ["Cemento Loma Negra", "Arena Fina"],
            materialStatus: "Disponible",
            isBlocked: false,
            supplierStatus: "Confirmado",
            supplierName: "Loma Negra S.A."
        },
        2: {
            name: "Cañería y Descargas",
            progress: 20,
            duration: 4,
            startOffset: 28.5,
            assignee: "Luis Martínez",
            quincena: "Q1",
            startDate: "2026-08-07",
            endDate: "2026-08-11",
            requiredMaterials: ["Caño PVC 110", "Codos y Ramales"],
            materialStatus: "Disponible",
            isBlocked: false,
            supplierStatus: "Confirmado",
            supplierName: "Sanitarios Palermo"
        },
        3: {
            name: "Revestimiento Cerámico",
            progress: 0,
            duration: 4,
            startOffset: 57.1,
            assignee: "Carlos Pérez",
            quincena: "Q2",
            startDate: "2026-08-16",
            endDate: "2026-08-20",
            requiredMaterials: ["Cerámicas San Lorenzo", "Pegamento Klaukol"],
            materialStatus: "Pendiente de Materiales",
            isBlocked: true,
            supplierStatus: "En Riesgo (Demora 48hs)",
            supplierName: "Cerámicas San Lorenzo",
            isShifted: false
        },
        4: {
            name: "Pintura y Terminación",
            progress: 0,
            duration: 2,
            startOffset: 85.7,
            assignee: "Carlos Pérez",
            quincena: "Q2",
            startDate: "2026-08-21",
            endDate: "2026-08-23",
            requiredMaterials: ["Látex Alba Interior", "Enduido Plástico"],
            materialStatus: "Disponible",
            isBlocked: false,
            supplierStatus: "Confirmado",
            supplierName: "Pinturerías Rex"
        }
    },
    incidents: initialIncidents,
    attendance: {
        "Juan Gómez": { role: "Albañilería Principal", checkin: "08:02 AM", status: "Presente" },
        "Carlos Pérez": { role: "Pintura e Interiores", checkin: "--:--", status: "Ausente" },
        "Luis Martínez": { role: "Instalaciones y Sanitarios", checkin: "--:--", status: "Ausente" }
    },
    // Stockpiles with Confirmed Delivery Dates (Módulo 4B)
    stockpiles: {
        cemento: { name: "Cemento Loma Negra", current: 35, min: 40, max: 150, unit: "Bolsas", supplier: "Loma Negra S.A.", status: "Crítico", confirmedDeliveryDate: "16/08/2026", onTimeStatus: "A tiempo" },
        hierro: { name: "Hierro A500 Acindar", current: 85, min: 30, max: 100, unit: "Barras", supplier: "Acindar Distribuidores", status: "Stock OK", confirmedDeliveryDate: "18/08/2026", onTimeStatus: "A tiempo" },
        ladrillo: { name: "Ladrillo Portante Alberdi", current: 1500, min: 800, max: 2500, unit: "Uds", supplier: "Ladrillos Alberdi", status: "Stock OK", confirmedDeliveryDate: "20/08/2026", onTimeStatus: "A tiempo" },
        arena: { name: "Arena Fina Cantera", current: 4, min: 8, max: 20, unit: "m³", supplier: "Cantera Palermo", status: "En Camino", confirmedDeliveryDate: "17/08/2026", onTimeStatus: "A tiempo" },
        ceramicas: { name: "Cerámica San Lorenzo 45x45", current: 0, min: 80, max: 150, unit: "m²", supplier: "Cerámicas San Lorenzo", status: "Demorado", confirmedDeliveryDate: "25/08/2026", onTimeStatus: "Retraso 48hs" }
    },
    // Suppliers with automated reminder & confirmation status (Módulo 2B)
    suppliers: [
        { id: "prov-1", name: "Loma Negra S.A.", category: "Cemento & Hormigón", email: "despacho@lomanegra.com", phone: "+54 9 11 4455-6677", status: "Confirmado", nextTaskDate: "15/08/2026", reminderDays: 7, confirmationStatus: "Confirmado" },
        { id: "prov-2", name: "Acindar Distribuidores", category: "Hierro & Estructuras", email: "ventas@acindardist.com", phone: "+54 9 11 3322-1100", status: "En Camino", nextTaskDate: "18/08/2026", reminderDays: 7, confirmationStatus: "Confirmado" },
        { id: "prov-3", name: "Ladrillos Alberdi", category: "Mampostería", email: "pedidos@alberdi.com.ar", phone: "+54 9 11 8899-0011", status: "Confirmado", nextTaskDate: "20/08/2026", reminderDays: 7, confirmationStatus: "Confirmado" },
        { id: "prov-4", name: "Aberturas López & Hnos", category: "Carpintería de Aluminio", email: "ventas@aberturaslopez.com", phone: "+54 9 11 5544-3322", status: "Pendiente", nextTaskDate: "21/08/2026", reminderDays: 7, confirmationStatus: "Pendiente (2 días antes)" },
        { id: "prov-5", name: "Cerámicas San Lorenzo", category: "Revestimientos", email: "logistica@sanlorenzo.com.ar", phone: "+54 9 11 7766-5544", status: "Demorado", nextTaskDate: "25/08/2026", reminderDays: 7, confirmationStatus: "En Riesgo - Demorado" }
    ],
    // Quincenal Certifications (Módulo 8 & 10)
    certifications: [
        { id: "cert-q1", period: "Quincena 1 (01/Ago - 15/Ago)", physicalProgress: "38%", financialValue: "$2.850.000 ARS", approvedByDirector: true, directorName: "Arq. Marcelo", status: "Certificado & Facturado", date: "15/08/2026" },
        { id: "cert-q2", period: "Quincena 2 (16/Ago - 31/Ago)", physicalProgress: "14% (en curso)", financialValue: "$1.950.000 ARS", approvedByDirector: false, directorName: "Arq. Marcelo", status: "En Medición de Campo", date: "En curso" }
    ],
    // Operational Proposals Inbox (Maker-Checker approval)
    operationalProposals: [
        { id: "prop-1", intent: "avance_tarea", summary: "Juan Gómez reportó Revoque Grueso al 100%", proposedBy: "Juan Gómez", role: "Albañilería Principal", status: "APROBADO", timestamp: "Hoy, 08:15 AM", taskImpact: "Tarea 1 -> 100%" },
        { id: "prop-2", intent: "replanificacion_material", summary: "Demora en flete de cerámicas. Mover Revestimiento a Q2 (25/Ago)", proposedBy: "Carlos Pérez", role: "Pintura e Interiores", status: "PENDIENTE_APROBACION", timestamp: "Hoy, 09:30 AM", taskImpact: "Tarea 3 -> +48hs desplazar" }
    ],
    // Caja Chica & Receipts OCR (Módulo 7)
    cajaChica: {
        saldoActual: 84500,
        fondoInicial: 150000,
        moneda: "ARS",
        umbralAlerta: 50000,
        movimientos: [
            { id: "cc-1", descripcion: "Compra rápida clavos y alambre en ferretería", monto: 18500, tipo: "Egreso", solicitante: "Juan Gómez", estado: "Aprobado", fecha: "Hoy, 10:15 AM", ticketUrl: "/tickets/ticket-01.jpg" },
            { id: "cc-2", descripcion: "Viáticos flete de emergencia arena", monto: 47000, tipo: "Egreso", solicitante: "Luis Martínez", estado: "Aprobado", fecha: "Ayer, 03:40 PM", ticketUrl: "/tickets/ticket-02.jpg" }
        ]
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

// Ensure Neon Postgres schema exists
async function ensurePostgresTable(p) {
    try {
        await p.query(`
            CREATE TABLE IF NOT EXISTS obrasaas_app_state (
                id VARCHAR(50) PRIMARY KEY,
                state JSONB NOT NULL,
                messages JSONB NOT NULL,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);
    } catch(e) {
        console.warn("Could not ensure Postgres table obrasaas_app_state:", e.message);
    }
}

// Read database contents
async function readDb() {
    const p = getPool();
    if (p) {
        try {
            await ensurePostgresTable(p);
            const { rows } = await p.query('SELECT state, messages FROM obrasaas_app_state WHERE id = $1', ['default']);
            if (rows.length > 0 && rows[0].state) {
                return {
                    appState: rows[0].state,
                    messages: rows[0].messages || defaultMessages
                };
            } else {
                // Seed initial state into Neon Postgres
                await p.query(
                    'INSERT INTO obrasaas_app_state (id, state, messages, updated_at) VALUES ($1, $2, $3, NOW()) ON CONFLICT (id) DO UPDATE SET state = $2, messages = $3, updated_at = NOW()',
                    ['default', JSON.stringify(defaultAppState), JSON.stringify(defaultMessages)]
                );
                return {
                    appState: defaultAppState,
                    messages: defaultMessages
                };
            }
        } catch (e) {
            console.error("Neon Postgres read error. Falling back to local file:", e.message);
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
    const p = getPool();
    if (p) {
        try {
            await ensurePostgresTable(p);
            await p.query(
                'INSERT INTO obrasaas_app_state (id, state, messages, updated_at) VALUES ($1, $2, $3, NOW()) ON CONFLICT (id) DO UPDATE SET state = $2, messages = $3, updated_at = NOW()',
                ['default', JSON.stringify(data.appState), JSON.stringify(data.messages)]
            );
        } catch (e) {
            console.error("Neon Postgres write error. Falling back to local file:", e.message);
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

