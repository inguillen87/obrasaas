import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { emitRealtimeUpdate } from './realtime.js';

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
    // Tenant Project Configuration & Geofence
    activeProjectId: "obra-palermo-01",
    projects: [
        {
            id: "obra-palermo-01",
            name: "Torre Palermo Soho",
            city: "Buenos Aires",
            province: "CABA",
            address: "Honduras 4850, Palermo, CABA",
            latitude: -34.5886,
            longitude: -58.4302,
            geofenceRadiusMeters: 100,
            expectedWorkersCount: 5,
            climateZone: "Templado Húmedo (Pampeano)",
            director: { name: "Arq. Marcelo", phone: "+54 9 261 316-8608" },
            capataz: { name: "Luis Martínez", phone: "+54 9 11 8899-7766" }
        },
        {
            id: "obra-mendoza-02",
            name: "Complejo Chacras de Coria",
            city: "Mendoza",
            province: "Mendoza",
            address: "Italia 5800, Chacras de Coria, Luján de Cuyo",
            latitude: -32.9961,
            longitude: -68.8778,
            geofenceRadiusMeters: 150,
            expectedWorkersCount: 8,
            climateZone: "Árido Andino / Gran Amplitud Térmica",
            director: { name: "Arq. Marcelo", phone: "+54 9 261 316-8608" },
            capataz: { name: "Juan Gómez", phone: "+54 9 11 3241-9981" }
        },
        {
            id: "obra-ushuaia-03",
            name: "Edificio Fueguino Canal Beagle",
            city: "Ushuaia",
            province: "Tierra del Fuego",
            address: "Av. Maipú 1200, Ushuaia",
            latitude: -54.8019,
            longitude: -68.3030,
            geofenceRadiusMeters: 120,
            expectedWorkersCount: 6,
            climateZone: "Patagónico Frío / Riesgo Heladas",
            director: { name: "Arq. Victoria", phone: "+54 9 2964 52-0753" },
            capataz: { name: "Carlos Pérez", phone: "+54 9 11 3241-9982" }
        },
        {
            id: "obra-cordoba-04",
            name: "Torre Nueva Córdoba",
            city: "Córdoba",
            province: "Córdoba",
            address: "Av. Vélez Sarsfield 1100, Nueva Córdoba",
            latitude: -31.4201,
            longitude: -64.1888,
            geofenceRadiusMeters: 100,
            expectedWorkersCount: 10,
            climateZone: "Serrano / Templado Cálido",
            director: { name: "Arq. Marcelo", phone: "+54 9 261 316-8608" },
            capataz: { name: "Luis Martínez", phone: "+54 9 11 8899-7766" }
        },
        {
            id: "obra-rosario-05",
            name: "Puerto Norte Muelle",
            city: "Rosario",
            province: "Santa Fe",
            address: "Av. Carballo 180, Puerto Norte, Rosario",
            latitude: -32.9282,
            longitude: -60.6653,
            geofenceRadiusMeters: 110,
            expectedWorkersCount: 7,
            climateZone: "Ribereño Húmedo",
            director: { name: "Arq. Victoria", phone: "+54 9 2964 52-0753" },
            capataz: { name: "Juan Gómez", phone: "+54 9 11 3241-9981" }
        }
    ],
    projectConfig: {
        id: "obra-palermo-01",
        name: "Torre Palermo Soho",
        city: "Buenos Aires",
        province: "CABA",
        address: "Honduras 4850, Palermo, CABA",
        latitude: -34.5886,
        longitude: -58.4302,
        geofenceRadiusMeters: 100,
        expectedWorkersCount: 5,
        climateZone: "Templado Húmedo (Pampeano)",
        totalBudget: 4995000,
        director: { name: "Arq. Marcelo", phone: "+54 9 261 316-8608" },
        capataz: { name: "Luis Martínez", phone: "+54 9 11 8899-7766" },
        directorPhone: "5492613168608",
        techDirectorPhone: "5492964520753"
    },
    // Pending self-registration flows (keyed by phone number)
    pendingRegistrations: {},
    // Worker Registry & Trade Directory
    workerRegistry: [
        { id: "w-1", name: "Juan Gómez", role: "Albañilería Principal", trade: "Albañil Principal", phone: "+54 9 11 3241-9981", dni: "34.589.120", status: "Activo", assignedTasks: ["Revoque Grueso"] },
        { id: "w-2", name: "Luis Martínez", role: "Instalaciones y Sanitarios", trade: "Plomero / Gasista", phone: "+54 9 11 8899-7766", dni: "31.204.850", status: "Activo", assignedTasks: ["Cañería y Descargas"] },
        { id: "w-3", name: "Carlos Pérez", role: "Pintura e Interiores", trade: "Pintor / Revestimientos", phone: "+54 9 11 3241-9982", dni: "28.940.111", status: "Activo", assignedTasks: ["Revestimiento Cerámico", "Pintura"] },
        { id: "w-4", name: "Arq. Marcelo", role: "Director de Obra", trade: "Arquitectura & Dirección", phone: "+54 9 261 316-8608", dni: "25.109.800", status: "Director", assignedTasks: ["Certificaciones Quincenales"] },
        { id: "w-5", name: "Aberturas López", role: "Proveedor Externo", trade: "Carpintería de Aluminio", phone: "+54 9 11 5544-3322", dni: "CUIT 30-71458920-4", status: "Proveedor", assignedTasks: ["Entrega Aberturas Q2"] },
        { id: "w-6", name: "Arq. Victoria", role: "Socia & Directora Técnica", trade: "Arquitectura & Dirección Técnica", phone: "+54 9 2964 52-0753", dni: "33.450.912", status: "Socia Directora", assignedTasks: ["Supervisión Técnica", "Certificaciones"] }
    ],
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
        "Juan Gómez": { role: "Albañilería Principal", checkin: "08:02 AM", status: "Presente", verifiedBy: "Voz & Biometría", distanceMeters: 12 },
        "Carlos Pérez": { role: "Pintura e Interiores", checkin: "--:--", status: "Ausente", verifiedBy: "Pendiente", distanceMeters: null },
        "Luis Martínez": { role: "Instalaciones y Sanitarios", checkin: "--:--", status: "Ausente", verifiedBy: "Pendiente", distanceMeters: null },
        "Arq. Victoria": { role: "Socia & Directora Técnica", checkin: "--:--", status: "Socia Directora", verifiedBy: "Acceso Remoto", distanceMeters: null }
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
    // KYC Biometrics & Identity Verification Hub (Enterprise ConTech)
    kycVerifications: {
        "w-1": {
            workerId: "w-1",
            workerName: "Juan Gómez",
            dni: "34.589.120",
            phone: "+54 9 11 3241-9981",
            dniFrontUrl: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=600&q=80",
            dniBackUrl: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=600&q=80",
            selfieUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80",
            faceMatchScore: 98.4,
            voiceSampleEnrolled: true,
            geofenceRadiusValid: true,
            status: "VERIFICADO",
            verifiedAt: "10/08/2026 08:00 AM",
            trade: "Albañil Principal",
            uocraLevel: "Oficial Albañil"
        },
        "w-2": {
            workerId: "w-2",
            workerName: "Luis Martínez",
            dni: "31.204.850",
            phone: "+54 9 11 8899-7766",
            dniFrontUrl: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=600&q=80",
            dniBackUrl: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=600&q=80",
            selfieUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=80",
            faceMatchScore: 96.8,
            voiceSampleEnrolled: true,
            geofenceRadiusValid: true,
            status: "VERIFICADO",
            verifiedAt: "11/08/2026 07:45 AM",
            trade: "Plomero / Gasista",
            uocraLevel: "Oficial Especializado"
        },
        "w-3": {
            workerId: "w-3",
            workerName: "Carlos Pérez",
            dni: "28.940.111",
            phone: "+54 9 11 3241-9982",
            dniFrontUrl: null,
            dniBackUrl: null,
            selfieUrl: null,
            faceMatchScore: 0,
            voiceSampleEnrolled: false,
            geofenceRadiusValid: false,
            status: "PENDIENTE",
            verifiedAt: null,
            trade: "Pintor / Revestimientos",
            uocraLevel: "Medio Oficial"
        }
    },
    // Real Scanned Remitos & Receipts OCR with Line Items & Image Provenance
    remitos: [
        {
            id: "rem-101",
            proveedor: "Ferretería Palermo Soho",
            cuit: "30-71829340-9",
            comprobanteNro: "REM-0004-00019283",
            fecha: "17/08/2026",
            montoTotal: 18500,
            moneda: "ARS",
            items: [
                { descripcion: "Clavos punta París 2 1/2 (kg)", cantidad: 2, precioUnitario: 3500, subtotal: 7000 },
                { descripcion: "Alambre de fardo recocido #16 (kg)", cantidad: 2.5, precioUnitario: 4600, subtotal: 11500 }
            ],
            solicitante: "Arq. Marcelo",
            estado: "Aprobado",
            scannedPhotoUrl: "https://images.unsplash.com/photo-1554415707-9e49016a3e46?auto=format&fit=crop&w=600&q=80",
            ocrConfidence: 99.2,
            categoria: "Ferretería & Herramientas"
        },
        {
            id: "rem-100",
            proveedor: "Cantera & Corralón Central",
            cuit: "33-65920194-9",
            comprobanteNro: "FACT-A-0002-00448190",
            fecha: "16/08/2026",
            montoTotal: 47000,
            moneda: "ARS",
            items: [
                { descripcion: "Flete de emergencia arena fina (m³)", cantidad: 2, precioUnitario: 23500, subtotal: 47000 }
            ],
            solicitante: "Luis Martínez",
            estado: "Aprobado",
            scannedPhotoUrl: "https://images.unsplash.com/photo-1607344645866-009c320b5ab8?auto=format&fit=crop&w=600&q=80",
            ocrConfidence: 98.7,
            categoria: "Áridos & Fletes"
        }
    ],
    // Live Technical Construction Photos Analyzed by Vision AI
    sitePhotos: [
        {
            id: "sp-1",
            photoUrl: "https://images.unsplash.com/photo-1541888946425-d0fbb18086f6?auto=format&fit=crop&w=800&q=80",
            caption: "Inspección de revoque grueso en frente de obra",
            phase: "Mampostería & Revoques",
            aiAnalysis: "Revoque grueso completado con nivel de plomada adecuado. Cobertura estimada: 100% de la sección frontal.",
            timestamp: "Hoy, 11:48 AM",
            reporter: "Juan Gómez (Albañilería)"
        },
        {
            id: "sp-2",
            photoUrl: "https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=800&q=80",
            caption: "Instalación de cañerías cloacales y desagües secundarios",
            phase: "Sanitarios & Descargas",
            aiAnalysis: "Caños de PVC 110 fijados con abrazaderas metálicas. Pendiente verificada: 2.1%. Sin obstrucciones.",
            timestamp: "Hoy, 10:20 AM",
            reporter: "Luis Martínez (Plomero)"
        }
    ],
    // Safety & Regulatory Compliance (UOCRA / ART Ley 22.250)
    artPolicies: {
        "Juan Gómez": {
            company: "La Segunda ART",
            policyNumber: "ART-882910-01",
            expirationDate: "30/04/2027",
            clausulaNoRepeticion: true,
            status: "VIGENTE",
            certificatePdfUrl: "/art/certificado-juan.pdf"
        },
        "Luis Martínez": {
            company: "Federación Patronal ART",
            policyNumber: "ART-449102-09",
            expirationDate: "15/03/2027",
            clausulaNoRepeticion: true,
            status: "VIGENTE",
            certificatePdfUrl: "/art/certificado-luis.pdf"
        },
        "Carlos Pérez": {
            company: "Prevención ART",
            policyNumber: "ART-109283-04",
            expirationDate: "01/08/2026",
            clausulaNoRepeticion: false,
            status: "VENCIDA",
            certificatePdfUrl: null
        }
    },
    // Cryptographic Inmutable SHA-256 Audit Trail
    auditLedger: [
        {
            index: 1,
            timestamp: "2026-08-17T20:00:00.000Z",
            formattedTime: "20:00:00",
            action: "GENESIS_BLOQUE_AUDITORIA",
            actor: "Sistema ObraSaaS Enterprise",
            details: { obra: "Torre Palermo Soho", hashAlg: "SHA-256" },
            previousHash: "000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f",
            hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            signatureStatus: "CERTIFICADO_SHA256"
        }
    ],
    // Budget tracking by rubro
    budget: {
        rubros: [
            { id: 'estructura', nombre: 'Estructura (Hormigón + Hierro)', presupuesto: 1498500, ejecutado: 1423575, movimientos: [] },
            { id: 'mamposteria', nombre: 'Mampostería y Revoques', presupuesto: 749250, ejecutado: 449550, movimientos: [] },
            { id: 'instalaciones', nombre: 'Instalaciones (Sanitaria + Gas + Eléctrica)', presupuesto: 899100, ejecutado: 269730, movimientos: [] },
            { id: 'carpinteria', nombre: 'Carpintería y Aberturas', presupuesto: 499500, ejecutado: 0, movimientos: [] },
            { id: 'pintura', nombre: 'Pintura y Revestimientos', presupuesto: 399600, ejecutado: 0, movimientos: [] },
            { id: 'pisos', nombre: 'Pisos y Mesadas', presupuesto: 349650, ejecutado: 0, movimientos: [] },
            { id: 'cubierta', nombre: 'Cubierta e Impermeabilización', presupuesto: 249750, ejecutado: 0, movimientos: [] },
            { id: 'mano_obra', nombre: 'Mano de Obra (Jornales UOCRA)', presupuesto: 249750, ejecutado: 124875, movimientos: [] },
            { id: 'imprevistos', nombre: 'Imprevistos (5%)', presupuesto: 99900, ejecutado: 0, movimientos: [] }
        ],
        lastUpdated: "2026-08-18T12:00:00.000Z"
    },
    // Libro de Obra Digital (Ley 22.250)
    libroObra: [],
    // Tenant registry (multi-tenant)
    tenants: [
        {
            id: 'tenant-default',
            name: 'ObraSaaS Demo',
            slug: 'demo',
            plan: 'professional',
            ownerEmail: 'marcelo@obrasaas.app',
            ownerPhone: '5492613168608',
            createdAt: '2026-01-15T00:00:00.000Z',
            projectCount: 4,
            workerCount: 6,
            status: 'active'
        }
    ],
    // Project-level insurance policies
    projectPolicies: [
        { type: 'Todo Riesgo Construcción', company: 'San Cristóbal Seguros', status: 'VIGENTE', expirationDate: '2027-03-15', coverage: '$50.000.000 ARS' },
        { type: 'Responsabilidad Civil', company: 'La Meridional', status: 'VIGENTE', expirationDate: '2027-01-20', coverage: '$20.000.000 ARS' },
        { type: 'Caución por Anticipo', company: 'Fianzas y Crédito', status: 'VIGENTE', expirationDate: '2026-12-31', coverage: '$5.000.000 ARS' }
    ],
    // Registered webhooks
    webhooks: [],
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
                const storedState = rows[0].state;
                const mergedState = {
                    ...defaultAppState,
                    ...storedState,
                    activeProjectId: storedState.activeProjectId || defaultAppState.activeProjectId,
                    projects: storedState.projects || defaultAppState.projects,
                    projectConfig: storedState.projectConfig || defaultAppState.projectConfig,
                    workerRegistry: storedState.workerRegistry || defaultAppState.workerRegistry,
                    attendance: { ...defaultAppState.attendance, ...(storedState.attendance || {}) },
                    cajaChica: storedState.cajaChica || defaultAppState.cajaChica,
                    kycVerifications: { ...defaultAppState.kycVerifications, ...(storedState.kycVerifications || {}) },
                    remitos: storedState.remitos || defaultAppState.remitos,
                    sitePhotos: storedState.sitePhotos || defaultAppState.sitePhotos,
                    artPolicies: { ...defaultAppState.artPolicies, ...(storedState.artPolicies || {}) },
                    auditLedger: storedState.auditLedger || defaultAppState.auditLedger
                };
                return {
                    appState: mergedState,
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

    // Local file fallback (only works in local dev, not on Vercel)
    try {
        initLocalDb();
        const data = fs.readFileSync(LOCAL_DB_PATH, 'utf-8');
        const parsed = JSON.parse(data);
        const storedState = parsed.appState || {};
        const mergedState = {
            ...defaultAppState,
            ...storedState,
            activeProjectId: storedState.activeProjectId || defaultAppState.activeProjectId,
            projects: storedState.projects || defaultAppState.projects,
            projectConfig: storedState.projectConfig || defaultAppState.projectConfig,
            workerRegistry: storedState.workerRegistry || defaultAppState.workerRegistry,
            attendance: { ...defaultAppState.attendance, ...(storedState.attendance || {}) },
            cajaChica: storedState.cajaChica || defaultAppState.cajaChica,
            kycVerifications: { ...defaultAppState.kycVerifications, ...(storedState.kycVerifications || {}) },
            remitos: storedState.remitos || defaultAppState.remitos,
            sitePhotos: storedState.sitePhotos || defaultAppState.sitePhotos,
            artPolicies: { ...defaultAppState.artPolicies, ...(storedState.artPolicies || {}) },
            auditLedger: storedState.auditLedger || defaultAppState.auditLedger
        };
        return {
            appState: mergedState,
            messages: parsed.messages || defaultMessages
        };
    } catch(e) {
        console.warn("Local file read skipped (read-only or missing):", e.message);
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
            return; // Successfully written to Postgres — no local fallback needed
        } catch (e) {
            console.error("Neon Postgres write error. Falling back to local file:", e.message);
        }
    }

    // Local file fallback (only works in local dev, not on Vercel)
    try {
        initLocalDb();
        fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2));
    } catch (e) {
        console.warn("Local file write skipped (read-only filesystem):", e.message);
    }
}

export async function getAppState() {
    const db = await readDb();
    return db.appState || defaultAppState;
}

export async function saveAppState(state) {
    const db = await readDb();
    const previousState = db.appState || null;
    db.appState = state;
    await writeDb(db);
    emitRealtimeUpdate('STATE_UPDATE', state);
    
    // Proactive WhatsApp alerts (non-blocking)
    if (previousState) {
        import('./whatsappNotifications.js').then(({ checkAndSendAlerts }) => {
            checkAndSendAlerts(state, previousState).catch(err => 
                console.warn('Alert check failed (non-fatal):', err.message)
            );
        }).catch(() => {});
    }
    
    // Webhook event dispatching (non-blocking)
    if (previousState && state.webhooks?.length > 0) {
        import('./webhookDispatcher.js').then(({ dispatchWebhookEvent }) => {
            // Detect task completions
            const prevTasks = previousState.tasks || {};
            const newTasks = state.tasks || {};
            for (const [key, task] of Object.entries(newTasks)) {
                if (task.progress === 100 && prevTasks[key]?.progress < 100) {
                    dispatchWebhookEvent(state, 'task.completed', { taskId: key, name: task.name });
                } else if (task.progress !== prevTasks[key]?.progress) {
                    dispatchWebhookEvent(state, 'task.progress_updated', { taskId: key, name: task.name, progress: task.progress });
                }
            }
            // Detect new incidents
            if ((state.incidents?.length || 0) > (previousState.incidents?.length || 0)) {
                const newInc = state.incidents[state.incidents.length - 1];
                dispatchWebhookEvent(state, 'incident.created', newInc);
            }
            // Detect new worker registrations
            if ((state.workerRegistry?.length || 0) > (previousState.workerRegistry?.length || 0)) {
                const newWorker = state.workerRegistry[state.workerRegistry.length - 1];
                dispatchWebhookEvent(state, 'worker.registered', { name: newWorker.name, trade: newWorker.trade });
            }
        }).catch(() => {});
    }
    
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
    emitRealtimeUpdate('MESSAGE_RECEIVED', messages);
    return messages;
}

export async function resetState() {
    const freshDb = {
        appState: JSON.parse(JSON.stringify(defaultAppState)),
        messages: JSON.parse(JSON.stringify(defaultMessages))
    };
    await writeDb(freshDb);
    emitRealtimeUpdate('STATE_RESET', freshDb);
    return freshDb;
}

