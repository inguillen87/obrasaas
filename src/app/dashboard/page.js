"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';

const initialAppState = {
  operariosCount: 1,
  avancePercentage: 42,
  alertsCount: 2,
  diasEstimados: "Día 12/35",
  currentQuincena: "Quincena 1 (01/Ago - 15/Ago)",
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
  incidents: [
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
  ],
  attendance: {
      "Juan Gómez": { role: "Albañilería Principal", checkin: "08:02 AM", status: "Presente" },
      "Carlos Pérez": { role: "Pintura e Interiores", checkin: "--:--", status: "Ausente" },
      "Luis Martínez": { role: "Instalaciones y Sanitarios", checkin: "--:--", status: "Ausente" }
  },
  stockpiles: {
      cemento: { name: "Cemento Loma Negra", current: 35, min: 40, max: 150, unit: "Bolsas", supplier: "Loma Negra S.A.", status: "Crítico", confirmedDeliveryDate: "16/08/2026", onTimeStatus: "A tiempo" },
      hierro: { name: "Hierro A500 Acindar", current: 85, min: 30, max: 100, unit: "Barras", supplier: "Acindar Distribuidores", status: "Stock OK", confirmedDeliveryDate: "18/08/2026", onTimeStatus: "A tiempo" },
      ladrillo: { name: "Ladrillo Portante Alberdi", current: 1500, min: 800, max: 2500, unit: "Uds", supplier: "Ladrillos Alberdi", status: "Stock OK", confirmedDeliveryDate: "20/08/2026", onTimeStatus: "A tiempo" },
      arena: { name: "Arena Fina Cantera", current: 4, min: 8, max: 20, unit: "m³", supplier: "Cantera Palermo", status: "En Camino", confirmedDeliveryDate: "17/08/2026", onTimeStatus: "A tiempo" },
      ceramicas: { name: "Cerámica San Lorenzo 45x45", current: 0, min: 80, max: 150, unit: "m²", supplier: "Cerámicas San Lorenzo", status: "Demorado", confirmedDeliveryDate: "25/08/2026", onTimeStatus: "Retraso 48hs" }
  },
  suppliers: [
      { id: "prov-1", name: "Loma Negra S.A.", category: "Cemento & Hormigón", email: "despacho@lomanegra.com", phone: "+54 9 11 4455-6677", status: "Confirmado", nextTaskDate: "15/08/2026", reminderDays: 7, confirmationStatus: "Confirmado" },
      { id: "prov-2", name: "Acindar Distribuidores", category: "Hierro & Estructuras", email: "ventas@acindardist.com", phone: "+54 9 11 3322-1100", status: "En Camino", nextTaskDate: "18/08/2026", reminderDays: 7, confirmationStatus: "Confirmado" },
      { id: "prov-3", name: "Ladrillos Alberdi", category: "Mampostería", email: "pedidos@alberdi.com.ar", phone: "+54 9 11 8899-0011", status: "Confirmado", nextTaskDate: "20/08/2026", reminderDays: 7, confirmationStatus: "Confirmado" },
      { id: "prov-4", name: "Aberturas López & Hnos", category: "Carpintería de Aluminio", email: "ventas@aberturaslopez.com", phone: "+54 9 11 5544-3322", status: "Pendiente", nextTaskDate: "21/08/2026", reminderDays: 7, confirmationStatus: "Pendiente (2 días antes)" },
      { id: "prov-5", name: "Cerámicas San Lorenzo", category: "Revestimientos", email: "logistica@sanlorenzo.com.ar", phone: "+54 9 11 7766-5544", status: "Demorado", nextTaskDate: "25/08/2026", reminderDays: 7, confirmationStatus: "En Riesgo - Demorado" }
  ],
  certifications: [
      { id: "cert-q1", period: "Quincena 1 (01/Ago - 15/Ago)", physicalProgress: "38%", financialValue: "$2.850.000 ARS", approvedByDirector: true, directorName: "Arq. Marcelo", status: "Certificado & Facturado", date: "15/08/2026" },
      { id: "cert-q2", period: "Quincena 2 (16/Ago - 31/Ago)", physicalProgress: "14% (en curso)", financialValue: "$1.950.000 ARS", approvedByDirector: false, directorName: "Arq. Marcelo", status: "En Medición de Campo", date: "En curso" }
  ],
  operationalProposals: [
      { id: "prop-1", intent: "avance_tarea", summary: "Juan Gómez reportó Revoque Grueso al 100%", proposedBy: "Juan Gómez", role: "Albañilería Principal", status: "APROBADO", timestamp: "Hoy, 08:15 AM", taskImpact: "Tarea 1 -> 100%" },
      { id: "prop-2", intent: "replanificacion_material", summary: "Demora en flete de cerámicas. Mover Revestimiento a Q2 (25/Ago)", proposedBy: "Carlos Pérez", role: "Pintura e Interiores", status: "PENDIENTE_APROBACION", timestamp: "Hoy, 09:30 AM", taskImpact: "Tarea 3 -> +48hs desplazar" }
  ],
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
  artPolicies: {
      "Juan Gómez": {
          company: "La Segunda ART",
          policyNumber: "ART-882910-01",
          expirationDate: "30/04/2027",
          clausulaNoRepeticion: true,
          status: "VIGENTE"
      },
      "Luis Martínez": {
          company: "Federación Patronal ART",
          policyNumber: "ART-449102-09",
          expirationDate: "15/03/2027",
          clausulaNoRepeticion: true,
          status: "VIGENTE"
      },
      "Carlos Pérez": {
          company: "Prevención ART",
          policyNumber: "ART-109283-04",
          expirationDate: "01/08/2026",
          clausulaNoRepeticion: false,
          status: "VENCIDA"
      }
  },
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
  ]
};

const initialChatMessages = [
  {
      sender: "bot",
      text: "Hola Arq. Marcelo. Soy tu Copiloto Inteligente de ObraSaaS. Estoy procesando los reportes de la cuadrilla y telemetría de obra en tiempo real. Escribe una consulta o reproduce un audio.",
      time: "08:00 AM"
  }
];

const audioData = {
  1: {
      from: "luis",
      text: "Buenas, jefe. Le aviso que ya entramos a la obra acá en Palermo Chico con toda la gente. Está Juan Gómez en la mezcla y Luis Martínez ya arrancó a revisar las cañerías del baño. Todo listo para arrancar la jornada.",
      actionDesc: "Fichaje de ingreso verificado y registrado mediante biométrica de voz.",
      impactTag: "Ingreso Exitoso",
      impactClass: "success",
      time: "08:02 AM"
  },
  2: {
      from: "juan",
      text: "Jefe, le comento que terminamos de dar la segunda mano de revoque grueso en la cocina y en todo el living del primer piso. Quedó espectacular, ya está listo para el fratachado final. Avanzamos a la siguiente fase según el plano.",
      actionDesc: "Revoque grueso registrado al 100%. Avanzada etapa en Gantt.",
      impactTag: "Gantt Actualizado",
      impactClass: "success",
      time: "02:15 PM"
  },
  3: {
      from: "luis",
      text: "Hola, Marcelo. Mirá, tenemos una complicación técnica acá. Luis Martínez estuvo probando la descarga principal del baño y salta agua por una fisura importante en el codo de descarga de PVC de ciento diez. Hay que picar un pedacito de losa y cambiar el tramo roto antes de tapar.",
      actionDesc: "Fisura en descarga sanitaria detectada. Ordenada reparación técnica urgente.",
      impactTag: "Alerta de Rotura",
      impactClass: "danger",
      time: "04:05 PM"
  },
  4: {
      from: "carlos",
      text: "Marcelo, llamé al corralón y me dicen que el flete con las cerámicas del revestimiento del baño se retrasó y recién nos descargan pasado mañana a primera hora. Nos va a demorar por lo menos dos días la colocación. Voy reordenando a la gente para que avance con la pintura exterior.",
      actionDesc: "Retraso logístico del proveedor. Reprogramación de cronograma Gantt (+2 días).",
      impactTag: "Gantt Reajustado",
      impactClass: "warning",
      time: "05:10 PM"
  },
  5: {
      from: "aberturas",
      text: "Hola Arq. Marcelo, confirmamos que el flete con las aberturas y materiales de revestimiento sale mañana temprano. Entrega confirmada en obra para las 09:00 AM.",
      actionDesc: "Proveedor confirmó entrega de materiales. Tarea liberada en Gantt.",
      impactTag: "Proveedor Confirmado",
      impactClass: "success",
      time: "09:00 AM"
  },
  6: {
      from: "juan",
      text: "Hola Arq. Marcelo, ¿qué tareas nos tocan a la cuadrilla de albañilería en esta quincena?",
      actionDesc: "Consulta de quincena procesada por Copiloto IA.",
      impactTag: "Quincena Consultada",
      impactClass: "info",
      time: "10:15 AM"
  }
};

export default function Dashboard() {
  // Application State
  const [state, setState] = useState(initialAppState);
  const [chatMessages, setChatMessages] = useState(initialChatMessages);
  const [activeTab, setActiveTab] = useState('sec-dashboard');
  const [isLightTheme, setIsLightTheme] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mapMode, setMapMode] = useState('sat');

  // Modal Overlays
  const [clerkModalOpen, setClerkModalOpen] = useState(false);
  const [clerkEmail, setClerkEmail] = useState('');
  const [clerkPassword, setClerkPassword] = useState('');

  // Modals for CRUD
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [showEditTaskModal, setShowEditTaskModal] = useState(false);
  const [showReceiveMaterialModal, setShowReceiveMaterialModal] = useState(false);
  const [showWeeklyReportModal, setShowWeeklyReportModal] = useState(false);

  // CRUD Forms State
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('Juan Gómez');
  const [newTaskStart, setNewTaskStart] = useState(1);
  const [newTaskDuration, setNewTaskDuration] = useState(3);
  const [newTaskProgress, setNewTaskProgress] = useState(0);

  const [editTaskId, setEditTaskId] = useState(null);
  const [editTaskName, setEditTaskName] = useState('');
  const [editTaskAssignee, setEditTaskAssignee] = useState('Juan Gómez');
  const [editTaskStart, setEditTaskStart] = useState(1);
  const [editTaskDuration, setEditTaskDuration] = useState(3);
  const [editTaskProgress, setEditTaskProgress] = useState(0);

  const [receiveMaterialKey, setReceiveMaterialKey] = useState('cemento');
  const [receiveMaterialQty, setReceiveMaterialQty] = useState(50);
  const [receiveMaterialInvoice, setReceiveMaterialInvoice] = useState('');

  // Personal HR forms
  const [hrBonusAssignee, setHrBonusAssignee] = useState('Juan Gómez');
  const [hrBonusType, setHrBonusType] = useState('Bono de Puntualidad');
  const [hrMedAssignee, setHrMedAssignee] = useState('Carlos Pérez');
  const [hrMedDiagnosis, setHrMedDiagnosis] = useState('');
  const [hrMedDays, setHrMedDays] = useState('1 día');
  const [hrMedFileName, setHrMedFileName] = useState('Seleccionar Archivo...');

  // Simulated messaging / chats inputs
  const [chatInput, setChatInput] = useState('');
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [gpsModalOpen, setGpsModalOpen] = useState(false);
  const [gpsLabel, setGpsLabel] = useState('GPS: Obra Palermo Chico');

  // AI Supervisors Inputs & histories
  const [copilotInput, setCopilotInput] = useState('');
  const [copilotMessages, setCopilotMessages] = useState([
    {
      sender: "bot",
      text: "Hola Arq. Marcelo. ¿Deseas un resumen de la obra, el estado de asistencia, alertas o heridos?"
    }
  ]);

  const [crmInput, setCrmInput] = useState('');
  const [crmMessages, setCrmMessages] = useState([
    {
      sender: "bot",
      text: "Hola Administrador. ¿Qué reporte comercial o de tickets deseas que audite hoy?"
    }
  ]);

  // Billing cycle
  const [billingLogs, setBillingLogs] = useState('');
  const [showBillingLogs, setShowBillingLogs] = useState(false);
  const [billingCycleRunning, setBillingCycleRunning] = useState(false);

  // Audio Playback Waveforms Animation State
  const [playingAudioIndex, setPlayingAudioIndex] = useState(null);

  // Live Toast Notifications State
  const [toasts, setToasts] = useState([]);

  // Multi-Role Persona Switcher State (v2.0)
  const [selectedPersona, setSelectedPersona] = useState('directora'); // 'directora' | 'compras' | 'capataz' | 'cliente'
  const [ganttQuincenaView, setGanttQuincenaView] = useState('todas'); // 'todas' | 'Q1' | 'Q2'

  const addToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  // DOM Canvas and Map Container Refs
  const progressChartRef = useRef(null);
  const tasksChartRef = useRef(null);
  const mrrChartRef = useRef(null);
  const mapContainerRef = useRef(null);
  const svgLinesRef = useRef(null);
  const chatMessagesEndRef = useRef(null);
  const copilotMessagesEndRef = useRef(null);
  const crmMessagesEndRef = useRef(null);

  const waveformRef1 = useRef(null);
  const waveformRef2 = useRef(null);
  const waveformRef3 = useRef(null);
  const waveformRef4 = useRef(null);
  const waveformRefs = { 1: waveformRef1, 2: waveformRef2, 3: waveformRef3, 4: waveformRef4 };

  // Real-Time Socket/SSE Connection State (Zero DB Polling)
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [weatherTelemetry, setWeatherTelemetry] = useState(null);

  // Fetch Weather Telemetry
  useEffect(() => {
    fetch('/api/weather')
      .then(res => res.json())
      .then(data => setWeatherTelemetry(data))
      .catch(err => console.warn("Failed to load weather telemetry:", err));
  }, []);

  // Fetch initial state & setup Real-Time SSE Stream (Zero DB Polling)
  useEffect(() => {
    // Check login state
    const logged = localStorage.getItem('obrasaas_logged_in') === 'true';
    if (!logged) {
      setClerkModalOpen(true);
    }

    // Check saved theme
    const savedTheme = localStorage.getItem('obrasaas_theme');
    if (savedTheme === 'light') {
      setIsLightTheme(true);
      document.body.classList.add('light-theme');
    } else {
      setIsLightTheme(false);
      document.body.classList.remove('light-theme');
    }

    // Auto-select tab if passed in URL query param (e.g. ?tab=sec-admin)
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam) {
      setActiveTab(tabParam);
    }

    // Real-Time Server-Sent Events Stream (SSE / WebSockets mode)
    let eventSource = null;
    let reconnectTimer = null;

    const connectRealtime = () => {
      try {
        if (eventSource) {
          eventSource.close();
        }

        eventSource = new EventSource('/api/realtime?tenant=default');

        // Handshake and snapshot load
        eventSource.addEventListener('init', (e) => {
          try {
            const payload = JSON.parse(e.data);
            if (payload?.data?.state) {
              setState(payload.data.state);
            }
            if (payload?.data?.messages) {
              setChatMessages(payload.data.messages);
            }
            setRealtimeConnected(true);
          } catch (err) {
            console.warn("SSE init parse error:", err);
          }
        });

        // Instant push on mutations (WhatsApp webhook, Gantt update, etc.)
        eventSource.addEventListener('update', (e) => {
          try {
            const payload = JSON.parse(e.data);
            if (payload?.type === 'STATE_UPDATE' || payload?.type === 'STATE_RESET') {
              if (payload.data) {
                setState(payload.data);
              }
            } else if (payload?.type === 'MESSAGE_RECEIVED') {
              if (payload.data) {
                setChatMessages(payload.data);
              }
            }
            setRealtimeConnected(true);
          } catch (err) {
            console.warn("SSE update parse error:", err);
          }
        });

        eventSource.onopen = () => {
          setRealtimeConnected(true);
        };

        eventSource.onerror = () => {
          setRealtimeConnected(false);
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          // Reconnect with 4s backoff
          clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(connectRealtime, 4000);
        };
      } catch (err) {
        console.warn("Realtime connection error:", err);
        setRealtimeConnected(false);
      }
    };

    connectRealtime();

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
    };
  }, []);

  // Sync scroll to bottoms on updates
  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    copilotMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [copilotMessages]);

  useEffect(() => {
    crmMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [crmMessages]);

  // Handle Theme switching
  const handleToggleTheme = () => {
    const nextTheme = !isLightTheme;
    setIsLightTheme(nextTheme);
    if (nextTheme) {
      document.body.classList.add('light-theme');
      localStorage.setItem('obrasaas_theme', 'light');
    } else {
      document.body.classList.remove('light-theme');
      localStorage.setItem('obrasaas_theme', 'dark');
    }
  };

  // Check login
  const handleClerkSubmit = (e) => {
    e.preventDefault();
    localStorage.setItem('obrasaas_logged_in', 'true');
    setClerkModalOpen(false);
    alert("Autenticación con Clerk completada con éxito. Cargando Panel...");
  };

  const handleClerkLogout = () => {
    localStorage.setItem('obrasaas_logged_in', 'false');
    setClerkModalOpen(true);
  };

  // Sync state back to API database
  const saveStateToApi = async (updatedState) => {
    try {
      const res = await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedState)
      });
      if (res.ok) {
        const data = await res.json();
        setState(data);
      }
    } catch (e) {
      console.error("Error saving state to DB:", e);
    }
  };

  // v2.0 Actions: Supplier Reminders (7d) & Confirmations (2d)
  const handleNotifySupplier = async (supplierId) => {
    const updatedSuppliers = (state.suppliers || []).map(s => {
      if (s.id === supplierId) {
        return { ...s, reminderSent: true, status: "Aviso 7d Enviado", confirmationStatus: "Aviso Enviado (Esperando confirmación 2d antes)" };
      }
      return s;
    });
    const updatedState = { ...state, suppliers: updatedSuppliers };
    setState(updatedState);
    await saveStateToApi(updatedState);
    addToast("Email y WhatsApp de aviso automático (7 días antes) enviado al proveedor.", "info");
  };

  const handleConfirmSupplier = async (supplierId) => {
    const updatedSuppliers = (state.suppliers || []).map(s => {
      if (s.id === supplierId) {
        return { ...s, confirmationStatus: "Confirmado", status: "Confirmado" };
      }
      return s;
    });
    // Unblock Task 3 if blocked by supplier
    const updatedTasks = { ...state.tasks };
    if (updatedTasks[3]) {
      updatedTasks[3].isBlocked = false;
      updatedTasks[3].materialStatus = "Disponible / En Camino";
      updatedTasks[3].supplierStatus = "Confirmado";
    }
    const updatedStockpiles = { ...state.stockpiles };
    if (updatedStockpiles.ceramicas) {
      updatedStockpiles.ceramicas.status = "En Camino";
      updatedStockpiles.ceramicas.onTimeStatus = "Confirmado para entrega";
    }
    const updatedState = { 
      ...state, 
      suppliers: updatedSuppliers, 
      tasks: updatedTasks, 
      stockpiles: updatedStockpiles,
      alertsCount: Math.max(0, state.alertsCount - 1)
    };
    setState(updatedState);
    await saveStateToApi(updatedState);
    addToast("Proveedor confirmado (2 días antes). Tarea 'Revestimiento Cerámico' desbloqueada en el Gantt.", "success");
  };

  // v2.0 Actions: Operational Proposals Approval (Maker-Checker)
  const handleApproveProposal = async (propId) => {
    const updatedProposals = (state.operationalProposals || []).map(p => {
      if (p.id === propId) {
        return { ...p, status: "APROBADO" };
      }
      return p;
    });
    const updatedState = { ...state, operationalProposals: updatedProposals };
    setState(updatedState);
    await saveStateToApi(updatedState);
    addToast("Propuesta de avance o replanificación aprobada por la Dirección de Obra.", "success");
  };

  // v2.0 Actions: Quincenal Certifications Approval
  const handleCertifyQuincena = async (certId) => {
    const updatedCerts = (state.certifications || []).map(c => {
      if (c.id === certId) {
        return { ...c, approvedByDirector: true, status: "Certificado & Facturado", date: new Date().toLocaleDateString('es-AR') };
      }
      return c;
    });
    const updatedState = { ...state, certifications: updatedCerts };
    setState(updatedState);
    await saveStateToApi(updatedState);
    addToast("Acta de Certificación Quincenal firmada con éxito. Habilitada para facturación al cliente.", "success");
  };

  // Helper Beep Node generator (Web Audio API)
  const playBeep = (type, callback) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) {
        if (callback) callback();
        return;
      }
      const audioCtx = new AudioCtx();
      const osc = audioCtx.createOscillator();
      const filter = audioCtx.createBiquadFilter();
      const gainNode = audioCtx.createGain();

      osc.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      if (type === 'start') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(500, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(700, audioCtx.currentTime + 0.12);
        filter.type = 'bandpass';
        filter.frequency.value = 1000;
        gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.16);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.16);
        setTimeout(callback, 150);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        osc.frequency.setValueAtTime(440, audioCtx.currentTime + 0.08);
        gainNode.gain.setValueAtTime(0.04, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.18);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.18);
        if (callback) setTimeout(callback, 180);
      }
    } catch (e) {
      if (callback) callback();
    }
  };

  // Voice Synthesis helper in Spanish
  const speakTextSpanish = (text, callback) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'es-AR';
      const voices = window.speechSynthesis.getVoices();
      const esVoice = voices.find(v => v.lang.startsWith('es-AR') || v.lang.startsWith('es-ES') || v.lang.startsWith('es'));
      if (esVoice) utterance.voice = esVoice;
      utterance.rate = 0.92;
      utterance.pitch = 0.95;
      utterance.onend = () => { if (callback) callback(); };
      utterance.onerror = () => { if (callback) callback(); };
      window.speechSynthesis.speak(utterance);
    } else {
      if (callback) setTimeout(callback, 3000);
    }
  };

  // Draw Static Waveforms on canvases
  useEffect(() => {
    [1, 2, 3, 4].forEach(idx => {
      const canvas = waveformRefs[idx]?.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#475569';
        const barWidth = 3;
        const gap = 2;
        for (let i = 0; i < 40; i++) {
          const x = i * (barWidth + gap) + 10;
          const h = Math.random() * 20 + 5;
          const y = (canvas.height - h) / 2;
          ctx.fillRect(x, y, barWidth, h);
        }
      }
    });
  }, [activeTab]);

  // Audio Playback waveform animation
  useEffect(() => {
    if (playingAudioIndex === null) return;
    const canvas = waveformRefs[playingAudioIndex]?.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationId;
    let progress = 0;
    const heights = Array.from({ length: 40 }, () => Math.random() * 20 + 5);

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = 3;
      const gap = 2;
      progress += 0.01;
      if (progress >= 1.0) progress = 1.0;

      for (let i = 0; i < heights.length; i++) {
        const x = i * (barWidth + gap) + 10;
        const barProgress = i / heights.length;
        const animatedHeight = heights[i] + Math.sin(Date.now() * 0.025 + i) * 4;
        const y = (canvas.height - animatedHeight) / 2;

        if (barProgress < progress) {
          ctx.fillStyle = '#ff9f1c'; // Amber progress color
        } else {
          ctx.fillStyle = '#475569'; // Grey default color
        }
        ctx.fillRect(x, y, barWidth, animatedHeight);
      }
      if (progress < 1.0) {
        animationId = requestAnimationFrame(render);
      }
    };
    render();

    return () => {
      cancelAnimationFrame(animationId);
      if (canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#475569';
        const barWidth = 3;
        const gap = 2;
        for (let i = 0; i < heights.length; i++) {
          const x = i * (barWidth + gap) + 10;
          const h = heights[i];
          const y = (canvas.height - h) / 2;
          ctx.fillRect(x, y, barWidth, h);
        }
      }
    };
  }, [playingAudioIndex]);

  // Play simulated audio notes
  const playAudioSim = (index) => {
    if (playingAudioIndex !== null) return;

    setPlayingAudioIndex(index);
    playBeep('start', () => {
      setTimeout(() => {
        playBeep('end', async () => {
          setPlayingAudioIndex(null);

          // Call simulated Webhook API to process the voice note transcription!
          const data = audioData[index];
          try {
            await fetch('/api/whatsapp', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                from: data.from,
                bodyText: data.text,
                mediaUrl: `audio-sim-${index}.mp3`,
                mediaType: "audio/mpeg"
              })
            });

            // Reload state after webhook processed it
            const stateRes = await fetch('/api/state');
            if (stateRes.ok) {
              const stateData = await stateRes.json();
              setState(stateData);
            }

            const messagesRes = await fetch('/api/whatsapp');
            if (messagesRes.ok) {
              const messagesData = await messagesRes.json();
              setChatMessages(messagesData);
            }
            
            // Push smart notification
            if (data.impactClass === 'danger') {
              addToast('Alerta crítica prioritaria de campo: ' + data.actionDesc, 'warning');
            } else {
              addToast('Evento procesado por IA: ' + data.impactTag, 'success');
            }
            
            // Auto Copilot Insights update
            setCopilotMessages(prev => [...prev, { 
                sender: 'bot', 
                text: `**[Alerta de Audio en Vivo]**\nHe interceptado un mensaje de voz de ${data.from}. He procedido a actualizar el Gantt y notificar a los supervisores por precaución.` 
            }]);

          } catch (e) {
            console.error("Audio sim webhook error:", e);
          }
        });
      }, 3000);
    });
  };

  // Replay audio directly from chat bubble
  const replayAudio = () => {
    playBeep('start', () => {
      setTimeout(() => {
        playBeep('end');
      }, 1500);
    });
  };

  // Leaflet Map client-side loader
  useEffect(() => {
    let mapInstance = null;
    let tileLayer = null;
    let markers = [];
    let heatCircles = [];

    const initMap = async () => {
      const L = await import('leaflet');
      await import('leaflet/dist/leaflet.css');

      if (!mapContainerRef.current) return;

      const palermoSite = [-34.5886, -58.4302];
      mapInstance = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false
      }).setView(palermoSite, 17);

      const tileUrl = isLightTheme
        ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

      tileLayer = L.tileLayer(tileUrl, {
        maxZoom: 20
      }).addTo(mapInstance);

      // Virtual geofence (green boundary)
      L.circle(palermoSite, {
        color: '#10b981',
        fillColor: '#10b981',
        fillOpacity: 0.12,
        radius: 80
      }).addTo(mapInstance);

      // Coordinates for employees
      const workerCoords = {
        "Juan Gómez": { lat: -34.5884, lng: -58.4304, role: "Albañilería Principal" },
        "Carlos Pérez": { lat: -34.5886, lng: -58.4302, role: "Pintura e Interiores" },
        "Luis Martínez": { lat: -34.5888, lng: -58.4300, role: "Instalaciones y Sanitarios" }
      };

      if (mapMode === 'sat') {
        // Draw individual markers with pulsating CSS radar ring
        Object.keys(state.attendance).forEach(name => {
          const att = state.attendance[name];
          if (att.status.includes('Presente') && workerCoords[name]) {
            const coord = workerCoords[name];
            const radarIcon = L.divIcon({
              className: 'radar-marker-container',
              html: '<div class="radar-marker-pulse"></div><div class="radar-marker-dot"></div>',
              iconSize: [20, 20],
              iconAnchor: [10, 10]
            });

            const marker = L.marker([coord.lat, coord.lng], { icon: radarIcon })
              .addTo(mapInstance)
              .bindPopup(`<b>${name}</b><br>${coord.role}<br>Check-in: ${att.checkin}`);
            markers.push(marker);
          }
        });

        // Zoom fit
        if (markers.length > 0) {
          const group = L.featureGroup(markers);
          mapInstance.fitBounds(group.getBounds().pad(0.3));
          markers[0].openPopup();
        }
      } else {
        // Draw heat map circles
        const heatSpots = [
          { lat: -34.5886, lng: -58.4302, radius: 60, opacity: 0.45 },
          { lat: -34.5884, lng: -58.4304, radius: 35, opacity: 0.30 }
        ];

        if (state.attendance["Luis Martínez"].status.includes("Presente")) {
          heatSpots.push({ lat: -34.5888, lng: -58.4300, radius: 35, opacity: 0.30 });
        }
        if (state.attendance["Carlos Pérez"].status.includes("Presente")) {
          heatSpots.push({ lat: -34.5886, lng: -58.4302, radius: 45, opacity: 0.35 });
        }

        heatSpots.forEach(spot => {
          const circle = L.circle([spot.lat, spot.lng], {
            color: '#ff9f1c',
            fillColor: '#ff9f1c',
            fillOpacity: spot.opacity,
            radius: spot.radius,
            stroke: false
          }).addTo(mapInstance);
          heatCircles.push(circle);
        });
      }
    };

    if (activeTab === 'sec-dashboard') {
      setTimeout(initMap, 100);
    }

    return () => {
      if (mapInstance) {
        mapInstance.remove();
      }
    };
  }, [activeTab, isLightTheme, mapMode, state.attendance]);

  // Chart.js reactive loader
  useEffect(() => {
    let progressChart = null;
    let tasksChart = null;
    let mrrChart = null;

    const buildCharts = async () => {
      const { Chart } = await import('chart.js/auto');

      // 1. Progress Chart (Line)
      if (progressChartRef.current) {
        const ctx = progressChartRef.current.getContext('2d');
        const gradientReal = ctx.createLinearGradient(0, 0, 0, 250);
        gradientReal.addColorStop(0, 'rgba(255, 159, 28, 0.35)');
        gradientReal.addColorStop(1, 'rgba(255, 159, 28, 0.00)');

        progressChart = new Chart(progressChartRef.current, {
          type: 'line',
          data: {
              labels: ['Día 1', 'Día 4', 'Día 8', 'Día 12', 'Día 16', 'Día 20', 'Día 24', 'Día 28', 'Día 32', 'Día 35'],
              datasets: [
                  {
                      label: 'Planificado (Curva S)',
                      data: [10, 22, 35, 45, 58, 70, 82, 90, 96, 100],
                      borderColor: isLightTheme ? 'rgba(0,0,0,0.2)' : 'rgba(255, 255, 255, 0.25)',
                      borderDash: [5, 5],
                      backgroundColor: 'transparent',
                      borderWidth: 2,
                      tension: 0.3
                  },
                  {
                      label: 'Real de Obra',
                      data: [10, 20, 32, state.avancePercentage, null, null, null, null, null, null],
                      borderColor: '#ff9f1c',
                      backgroundColor: gradientReal,
                      fill: true,
                      borderWidth: 3,
                      tension: 0.3
                  }
              ]
          },
          options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                  legend: { labels: { color: isLightTheme ? '#475569' : '#94a3b8', font: { family: 'Inter', size: 11 } } }
              },
              scales: {
                  x: { grid: { color: isLightTheme ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.02)' }, ticks: { color: isLightTheme ? '#475569' : '#64748b' } },
                  y: { min: 0, max: 100, grid: { color: isLightTheme ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.02)' }, ticks: { color: isLightTheme ? '#475569' : '#64748b', callback: v => v + '%' } }
              }
          }
        });
      }

      // 2. Tasks Chart (Doughnut)
      if (tasksChartRef.current) {
        let completed = 0;
        let enCurso = 0;
        let pendientes = 0;
        let demoradas = state.alertsCount;

        Object.values(state.tasks).forEach(task => {
          if (task.progress === 100) completed++;
          else if (task.progress > 0) enCurso++;
          else pendientes++;
        });

        if (demoradas > 0) {
          pendientes = Math.max(0, pendientes - demoradas);
        }

        tasksChart = new Chart(tasksChartRef.current, {
          type: 'doughnut',
          data: {
              labels: ['Completadas', 'En Curso', 'Pendientes', 'Bloqueadas/Demoradas'],
              datasets: [{
                  data: [completed, enCurso, pendientes, demoradas],
                  backgroundColor: [
                      '#10b981', 
                      '#3b82f6', 
                      isLightTheme ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.08)', 
                      '#ef4444'  
                  ],
                  borderWidth: 0
              }]
          },
          options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                  legend: { 
                      position: 'right',
                      labels: { color: isLightTheme ? '#475569' : '#94a3b8', font: { family: 'Inter', size: 10 } } 
                  }
              },
              cutout: '72%'
          }
        });
      }

      // 3. MRR Chart (Bar)
      if (mrrChartRef.current) {
        const ctx = mrrChartRef.current.getContext('2d');
        const gradientBar = ctx.createLinearGradient(0, 0, 0, 200);
        gradientBar.addColorStop(0, 'rgba(255, 159, 28, 0.85)');
        gradientBar.addColorStop(1, 'rgba(255, 159, 28, 0.15)');

        mrrChart = new Chart(mrrChartRef.current, {
          type: 'bar',
          data: {
              labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'],
              datasets: [{
                  label: 'MRR en ARS',
                  data: [3200000, 3500000, 3900000, 4200000, 4500000, state.subscription?.plan === 'Enterprise' ? 5030000 : 4850000],
                  backgroundColor: gradientBar,
                  borderColor: '#ff9f1c',
                  borderWidth: 1.5,
                  borderRadius: 6
              }]
          },
          options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                  legend: { display: false }
              },
              scales: {
                  x: { grid: { display: false }, ticks: { color: isLightTheme ? '#475569' : '#64748b', font: { size: 10 } } },
                  y: { grid: { color: isLightTheme ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.02)' }, ticks: { color: isLightTheme ? '#475569' : '#64748b', font: { size: 9 }, callback: v => '$' + (v/1000000) + 'M' } }
              }
          }
        });
      }
    };

    if (activeTab === 'sec-dashboard' || activeTab === 'sec-admin') {
      buildCharts();
    }

    return () => {
      if (progressChart) progressChart.destroy();
      if (tasksChart) tasksChart.destroy();
      if (mrrChart) mrrChart.destroy();
    };
  }, [activeTab, isLightTheme, state]);

  // Gantt SVG Dependency Lines Drawer
  const drawGanttDependencyLines = () => {
    const svg = svgLinesRef.current;
    if (!svg) return;
    svg.innerHTML = ''; // Clear old lines

    const svgRect = svg.getBoundingClientRect();
    const taskIds = Object.keys(state.tasks);
    if (taskIds.length < 2) return;

    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    defs.innerHTML = `
        <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="rgba(255, 159, 28, 0.4)"/>
        </marker>
    `;
    svg.appendChild(defs);

    for (let i = 0; i < taskIds.length - 1; i++) {
      const fromId = taskIds[i];
      const toId = taskIds[i + 1];

      const fromBar = document.getElementById(`gantt-bar-${fromId}`);
      const toBar = document.getElementById(`gantt-bar-${toId}`);

      if (fromBar && toBar) {
        const fromRect = fromBar.getBoundingClientRect();
        const toRect = toBar.getBoundingClientRect();

        const x1 = fromRect.right - svgRect.left;
        const y1 = (fromRect.top + fromRect.bottom) / 2 - svgRect.top;

        const x2 = toRect.left - svgRect.left;
        const y2 = (toRect.top + toRect.bottom) / 2 - svgRect.top;

        if (x1 > 0 && x2 > 0) {
          const midX = x1 + (x2 - x1) / 2;

          const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
          path.setAttribute("d", `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`);
          path.setAttribute("stroke", "rgba(255, 159, 28, 0.35)");
          path.setAttribute("stroke-width", "2");
          path.setAttribute("fill", "none");
          path.setAttribute("marker-end", "url(#arrow)");

          svg.appendChild(path);
        }
      }
    }
  };

  useEffect(() => {
    if (activeTab === 'sec-gantt') {
      setTimeout(drawGanttDependencyLines, 100);
      window.addEventListener('resize', drawGanttDependencyLines);
    }
    return () => window.removeEventListener('resize', drawGanttDependencyLines);
  }, [activeTab, state.tasks]);

  // NLP bot response (Supervisor & CRM AI engine)
  const getBotResponse = (msgText) => {
    const lower = msgText.toLowerCase();
    
    // Cross-referencing logic: NLP engine upgrades
    if (lower.includes('falto') || lower.includes('asistencia') || lower.includes('llegaron') || lower.includes('presente') || lower.includes('tarde') || lower.includes('quien') || lower.includes('fichaje')) {
        let present = [];
        let absent = [];
        Object.keys(state.attendance).forEach(name => {
            if (state.attendance[name].status.includes('Presente')) present.push(`${name} (${state.attendance[name].checkin})`);
            else absent.push(name);
        });
        
        let reply = `**[Monitoreo de Asistencia Biométrico - AI]**\n\n`;
        reply += `Actualmente detecto **${state.operariosCount} operarios** en la zona caliente de obra.\n\n`;
        reply += `🟢 **Ingresos Check-in**: ${present.length > 0 ? present.join(', ') : 'Ninguno'}.\n`;
        reply += `🔴 **Faltas Injustificadas**: ${absent.length > 0 ? absent.join(', ') : 'Plantilla Completa'}.\n\n`;
        
        if (absent.length > 0) {
            reply += `⚠️ **Sugerencia Predictiva**: Recomendamos reasignar tareas del módulo "Revestimiento" debido a la falta de ${absent[0]}. Puedo enviar un memo a RRHH automáticamente.\n[ACTION:REASIGNAR_REVESTIMIENTO:Reasignar Personal de Revestimiento]`;
        } else {
            reply += `La cuadrilla está operando a máxima capacidad.`;
        }
        return reply;
    }
    
    if (lower.includes('resumen') || lower.includes('avance') || lower.includes('como va') || lower.includes('avances') || lower.includes('progreso') || lower.includes('gantt') || lower.includes('cronograma')) {
        let reply = `**[Auditoría de Avance y Gantt - AI]**\n\n`;
        reply += `El progreso real de la obra es del **${state.avancePercentage}%** (frente al 32% proyectado en curva S).\n\n`;
        
        Object.keys(state.tasks).forEach(id => {
            const t = state.tasks[id];
            reply += `• **${t.name}**: ${t.progress}% (${t.assignee}).\n`;
        });
        
        // Stock Insight crossover
        if (state.stockpiles.cemento.status === 'Crítico') {
            reply += `\n🚨 **Bloqueador Potencial**: El bajo stock de Cemento (35 bolsas) puede retrasar las tareas en 48hs. Recomiendo emitir orden de compra hoy.\n[ACTION:COMPRAR_CEMENTO:Emitir Orden de Compra Inteligente]`;
        }
        return reply;
    }
    
    if (lower.includes('herido') || lower.includes('accidente') || lower.includes('heridos') || lower.includes('seguridad') || lower.includes('alerta') || lower.includes('alertas') || lower.includes('problema') || lower.includes('preocupante') || lower.includes('fuga') || lower.includes('agua') || lower.includes('caño') || lower.includes('cañería')) {
        let reply = `**[Control de Riesgos de Obra - AI]**\n\n`;
        reply += `👷 **Integridad Física**: 🔴 0 Accidentes Reportados.\n\n`;
        
        if (state.incidents.length > 0) {
            reply += `⚠️ **Incidencias Estructurales Activas**:\n`;
            state.incidents.forEach(inc => {
                reply += `• *${inc.title}: ${inc.description}*\n`;
            });
            reply += `\nHe procedido a notificar a los subcontratistas y al arquitecto residente para la mitigación inmediata del riesgo.`;
        }
        return reply;
    }
    
    if (lower.includes('suscripcion') || lower.includes('suscripciones') || lower.includes('mrr') || lower.includes('mes') || lower.includes('cobros') || lower.includes('facturacion') || lower.includes('plataforma') || lower.includes('estudios') || lower.includes('dinero') || lower.includes('ingresos') || lower.includes('crm')) {
        let reply = `**[Métricas de Crecimiento CRM - AI]**\n\n`;
        reply += `• **MRR Recurrente**: $4.850.000 ARS (+12% MoM).\n`;
        reply += `• **Leads Calientes**: 3 Nuevos prospectos de Estudios.\n`;
        reply += `• **Churn Involuntario**: $0. Tickets técnicos estables.\n\n`;
        reply += `💡 **Insight de Crecimiento**: Aumentar la inversión en Ads de "Geofencing" puede subir tu MRR un 8% este trimestre.`;
        return reply;
    }
    
    return `Hola, Marcelo. Soy tu Copiloto Inteligente de ObraSaaS. Puedes preguntarme acerca de:\n\n` + 
           `• *¿Quiénes llegaron y quiénes faltaron hoy?*\n` + 
           `• *Dame un resumen de avances frente al Gantt*\n` + 
           `• *¿Existen problemas de stock o alertas de roturas?*\n` + 
           `• *Muéstrame el flujo comercial CRM y MRR*\n\n` + 
           `Analizo 140 variables de obra y sensores GPS en vivo.`;
  };

  // Actionable AI (Agentic Workflow Handler)
  const handleAgenticAction = (actionCmd) => {
    if (actionCmd === 'REASIGNAR_REVESTIMIENTO') {
      addToast('IA: Personal de revestimiento reasignado con éxito.', 'success');
      // Simulate state update
      setCopilotMessages(prev => [...prev, { sender: 'bot', text: '✅ Tareas reasignadas y memo de RRHH enviado.' }]);
    } else if (actionCmd === 'COMPRAR_CEMENTO') {
      addToast('IA: Orden de compra de cemento emitida al corralón.', 'success');
      setCopilotMessages(prev => [...prev, { sender: 'bot', text: '✅ Orden de compra generada. El acopio llegará en 24hs.' }]);
    } else {
      addToast('Comando de IA no reconocido.', 'warning');
    }
  };

  // Supervisor IA Chat handler
  const sendCopilotUserMessage = () => {
    const text = copilotInput.trim();
    if (!text) return;

    const userMsg = { sender: 'user', text };
    setCopilotMessages(prev => [...prev, userMsg]);
    setCopilotInput('');

    setTimeout(() => {
      const responseText = getBotResponse(text);
      const botMsg = { sender: 'bot', text: responseText };
      setCopilotMessages(prev => [...prev, botMsg]);

      // Speak audio synthesis of bot response (clean text)
      const cleanText = responseText.replace(/\*\*|\[.*?\]|•|🟢|🔴|⚠️/g, '').split('.')[0];
      speakTextSpanish(cleanText);
    }, 1000);
  };

  // CRM Consultor Chat handler
  const sendCrmUserMessage = () => {
    const text = crmInput.trim();
    if (!text) return;

    const userMsg = { sender: 'user', text };
    setCrmMessages(prev => [...prev, userMsg]);
    setCrmInput('');

    setTimeout(() => {
      const responseText = getBotResponse(text);
      const botMsg = { sender: 'bot', text: responseText };
      setCrmMessages(prev => [...prev, botMsg]);

      const cleanText = responseText.replace(/\*\*|\[.*?\]|•|🟢|🔴|⚠️/g, '').split('.')[0];
      speakTextSpanish(cleanText);
    }, 1000);
  };

  const handleSendMessage = async () => {
    const text = chatInput.trim();
    if (!text) return;

    setChatInput('');
    try {
      await fetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'carlos',
          bodyText: text
        })
      });

      // Fetch updates
      const messagesRes = await fetch('/api/whatsapp');
      if (messagesRes.ok) {
        const messagesData = await messagesRes.json();
        setChatMessages(messagesData);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Select simulated attachments
  const selectAttachment = async (type) => {
    setAttachmentMenuOpen(false);
    let payload = { from: 'carlos' };
    
    if (type === 'document') {
      payload.bodyText = "Documento enviado: planos_palermo_v2.pdf";
      payload.mediaUrl = "planos_palermo_v2.pdf";
      payload.mediaType = "application/pdf";
    } else if (type === 'camera') {
      // Multimodal Chaos Tolerance Simulator (Task 4)
      payload.bodyText = "[IMAGEN BORROSA DETECTADA] - Procesando con Visión Multimodal...";
      payload.mediaUrl = "fachada.jpg";
      payload.mediaType = "image/jpeg";
      
      addToast('Procesando imagen caótica de WhatsApp mediante IA Multimodal...', 'info');
      
      setTimeout(() => {
        addToast('IA: Muro detectado con 85% de avance. Actualizando Gantt.', 'success');
        setCopilotMessages(prev => [...prev, { sender: 'bot', text: '✅ He analizado la foto borrosa enviada desde la obra. Reconozco que es el frente sur y el muro está al 85%. He actualizado el progreso de "Mampostería" en el Gantt.' }]);
      }, 3000);
      
    } else if (type === 'gallery') {
      payload.bodyText = "Imagen de revoque seleccionada";
      payload.mediaUrl = "revoque.jpg";
      payload.mediaType = "image/jpeg";
    } else if (type === 'audio') {
      payload.bodyText = "Audio de obra (5.4s)";
      payload.mediaUrl = "audio.mp3";
      payload.mediaType = "audio/mpeg";
    } else if (type === 'contact') {
      payload.bodyText = "👤 Contacto: Proveedor Arenas";
      payload.mediaUrl = "arenas.vcf";
      payload.mediaType = "text/vcard";
    }

    try {
      await fetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch(e) {
      console.error(e);
    }
  };

  const confirmGpsSend = async () => {
    setGpsModalOpen(false);
    try {
      await fetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'carlos',
          latitude: -34.5886,
          longitude: -58.4302
        })
      });
    } catch (e) {
      console.error(e);
    }
  };

  const refreshGpsSearch = () => {
    setGpsLabel("Buscando satélites GPS...");
    setTimeout(() => {
      setGpsLabel("GPS: Obra Palermo Chico (Precisión: 4m)");
    }, 1000);
  };

  // CRUD actions for Gantt Chart
  const handleAddNewTask = async () => {
    if (!newTaskName.trim()) {
      alert("Ingrese un nombre de tarea válido.");
      return;
    }
    const newId = Date.now();
    const startOffset = (newTaskStart - 1) * 7.14;
    
    const updatedTasks = {
      ...state.tasks,
      [newId]: {
        name: newTaskName,
        assignee: newTaskAssignee,
        progress: newTaskProgress,
        duration: newTaskDuration,
        startOffset: startOffset
      }
    };

    const nextState = { ...state, tasks: updatedTasks };
    setState(nextState);
    await saveStateToApi(nextState);

    setShowAddTaskModal(false);
    setNewTaskName('');
    setNewTaskStart(1);
    setNewTaskDuration(3);
    setNewTaskProgress(0);
  };

  const handleEditTask = (id) => {
    const task = state.tasks[id];
    if (!task) return;
    setEditTaskId(id);
    setEditTaskName(task.name);
    setEditTaskAssignee(task.assignee);
    setEditTaskStart(Math.round(task.startOffset / 7.14) + 1);
    setEditTaskDuration(task.duration);
    setEditTaskProgress(task.progress);
    setShowEditTaskModal(true);
  };

  const handleSaveEditedTask = async () => {
    if (!editTaskName.trim()) return;

    const startOffset = (editTaskStart - 1) * 7.14;
    const updatedTasks = { ...state.tasks };
    updatedTasks[editTaskId] = {
      name: editTaskName,
      assignee: editTaskAssignee,
      progress: editTaskProgress,
      duration: editTaskDuration,
      startOffset: startOffset
    };

    // Recalculate global percentage
    let sum = 0;
    const items = Object.values(updatedTasks);
    items.forEach(t => sum += t.progress);
    const newAv = Math.round(sum / items.length);

    const nextState = {
      ...state,
      tasks: updatedTasks,
      avancePercentage: newAv
    };

    setState(nextState);
    await saveStateToApi(nextState);
    setShowEditTaskModal(false);
  };

  const handleDeleteTask = async () => {
    const updatedTasks = { ...state.tasks };
    delete updatedTasks[editTaskId];

    let sum = 0;
    const items = Object.values(updatedTasks);
    let newAv = 0;
    if (items.length > 0) {
      items.forEach(t => sum += t.progress);
      newAv = Math.round(sum / items.length);
    }

    const nextState = {
      ...state,
      tasks: updatedTasks,
      avancePercentage: newAv
    };

    setState(nextState);
    await saveStateToApi(nextState);
    setShowEditTaskModal(false);
  };

  const updateGanttTaskSlider = async (id, field, value) => {
    const updatedTasks = { ...state.tasks };
    updatedTasks[id] = {
      ...updatedTasks[id],
      [field]: parseInt(value)
    };

    let sum = 0;
    const items = Object.values(updatedTasks);
    items.forEach(t => sum += t.progress);
    const newAv = Math.round(sum / items.length);

    const nextState = {
      ...state,
      tasks: updatedTasks,
      avancePercentage: newAv
    };

    setState(nextState);
    await saveStateToApi(nextState);
  };

  // Stockpile control
  const handleSaveReceivedMaterial = async () => {
    const qty = parseInt(receiveMaterialQty);
    if (isNaN(qty) || qty <= 0) {
      alert("Por favor ingrese una cantidad válida.");
      return;
    }

    const updatedStockpiles = { ...state.stockpiles };
    const item = updatedStockpiles[receiveMaterialKey];
    item.current = Math.min(item.current + qty, item.max);
    item.status = 'Stock OK';

    const newIncident = {
      id: "inc-mat-" + Date.now(),
      title: "Recepción de Materiales",
      description: `Ingresaron ${qty} ${item.unit} de ${item.name} de ${item.supplier}. Remito: ${receiveMaterialInvoice || 'S/N'}. Stock normalizado.`,
      type: "success",
      badge: "Ingreso",
      timestamp: "Hace un momento",
      reporter: `Admin (Remito: ${receiveMaterialInvoice || 'S/N'})`,
      icon: "fa-solid fa-circle-check"
    };

    const nextState = {
      ...state,
      stockpiles: updatedStockpiles,
      incidents: [newIncident, ...state.incidents]
    };

    setState(nextState);
    await saveStateToApi(nextState);

    setShowReceiveMaterialModal(false);
    setReceiveMaterialQty(50);
    setReceiveMaterialInvoice('');
  };

  // Award incentive bonus
  const handleAwardBonus = async () => {
    const nextBonuses = [
      {
        name: hrBonusAssignee,
        type: hrBonusType,
        amount: hrBonusType.includes("Puntualidad") ? "$15.000 ARS" : hrBonusType.includes("Velocidad") ? "$20.000 ARS" : "$25.000 ARS",
        date: "Hace un momento"
      },
      ...state.hrBonuses
    ];

    const newIncident = {
      id: "inc-bonus-" + Date.now(),
      title: "Bono Otorgado",
      description: `Premio de ${hrBonusType} asignado a ${hrBonusAssignee}.`,
      type: "success",
      badge: "Premio",
      timestamp: "Hace un momento",
      reporter: "Recursos Humanos",
      icon: "fa-solid fa-gift"
    };

    const nextState = {
      ...state,
      hrBonuses: nextBonuses,
      incidents: [newIncident, ...state.incidents]
    };

    setState(nextState);
    await saveStateToApi(nextState);
    alert(`¡Premio otorgado con éxito a ${hrBonusAssignee}!`);
  };

  // Upload medical certificate uploader form
  const handleMedicalFileSelected = (e) => {
    const file = e.target.files[0];
    if (file) {
      setHrMedFileName(file.name);
    }
  };

  const handleSubmitMedicalCert = async (e) => {
    e.preventDefault();
    if (!hrMedDiagnosis.trim()) {
      alert("Por favor ingrese un diagnóstico.");
      return;
    }

    const updatedHrAttendance = { ...state.hrAttendance };
    const attendee = updatedHrAttendance[hrMedAssignee];
    if (attendee) {
      attendee.excused += 1;
      attendee.status = "Ausente Justificado";
    }

    const updatedAttendance = { ...state.attendance };
    if (updatedAttendance[hrMedAssignee]) {
      updatedAttendance[hrMedAssignee].status = "Ausente Justificado";
    }

    const newIncident = {
      id: "inc-med-" + Date.now(),
      title: "Licencia Médica Registrada",
      description: `${hrMedAssignee} presentó certificado por ${hrMedDiagnosis} (${hrMedDays} de licencia). Archivo adjunto: ${hrMedFileName}.`,
      type: "warning",
      badge: "Licencia",
      timestamp: "Hace un momento",
      reporter: "Recursos Humanos",
      icon: "fa-solid fa-notes-medical"
    };

    const nextState = {
      ...state,
      hrAttendance: updatedHrAttendance,
      attendance: updatedAttendance,
      incidents: [newIncident, ...state.incidents]
    };

    setState(nextState);
    await saveStateToApi(nextState);

    alert(`Certificado cargado para ${hrMedAssignee}. Ausencia justificada.`);
    setHrMedDiagnosis('');
    setHrMedFileName('Seleccionar Archivo...');
  };

  // Super Admin Billing Cycle Simulation
  const simulateBillingCycle = () => {
    if (billingCycleRunning) return;

    setBillingCycleRunning(true);
    setShowBillingLogs(true);
    setBillingLogs("Iniciando ciclo de facturación mensual en ARS...\n");
    
    const tenants = [
        { name: "Estudio BMA", amount: 350000, card: "VISA **** 8821" },
        { name: "MSGSSV", amount: 350000, card: "MASTERCARD **** 4322" },
        { name: "Estudio Clorindo Testa Hijos", amount: 180000, card: "VISA **** 5510" },
        { name: "Constructora Innovar Latam", amount: 350000, card: "CABAL **** 9912" },
        { name: "Estudio MRA+A", amount: 180000, card: "AMEX **** 1004" }
    ];
    
    let currentIdx = 0;
    
    const processNextTenant = () => {
        if (currentIdx >= tenants.length) {
            setBillingLogs(prev => prev + "\n[CICLO FINALIZADO] Facturación mensual procesada con éxito.\nTotal recaudado: $1.410.000 ARS. Notificaciones enviadas por email.");
            
            // Update plan to Enterprise or keep active
            const nextState = {
              ...state,
              subscription: {
                status: "active",
                plan: "Enterprise",
                expiresAt: "2027-12-31"
              }
            };
            setState(nextState);
            saveStateToApi(nextState);

            setBillingCycleRunning(false);
            return;
        }
        
        const tenant = tenants[currentIdx];
        setBillingLogs(prev => prev + `Procesando cobro: ${tenant.name} por $${tenant.amount.toLocaleString('es-AR')} ARS...`);
        
        setTimeout(() => {
            setBillingLogs(prev => prev + ` [OK] Cargado en ${tenant.card}. Transacción ID: tx_${Math.random().toString(36).substring(2, 11).toUpperCase()}\n`);
            currentIdx++;
            processNextTenant();
        }, 800);
    };
    
    processNextTenant();
  };

  // Reset entire database state
  const handleResetState = async () => {
    if (confirm("¿Estás seguro de restablecer toda la base de datos de ObraSaaS? Se borrarán las tareas creadas, licencias e incidencias.")) {
      try {
        const res = await fetch('/api/state', { method: 'DELETE' });
        if (res.ok) {
          const freshState = await res.json();
          setState(freshState);
          alert("Base de datos de ObraSaaS restablecida con éxito.");
        }
      } catch(e) {
        console.error(e);
      }
    }
  };

  // PDF print fallbacks resolving PDF export issue
  const handlePrintProposal = () => {
    document.body.classList.add('print-proposal-mode');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('print-proposal-mode');
    }, 500);
  };

  const handlePrintWeeklyReport = () => {
    window.open('/dashboard/report?print=true', '_blank');
  };

  // Calculate dynamic weekly report details
  const weeklyReportDetails = useMemo(() => {
    const cleanDias = String(state.diasEstimados || "12/35").replace(/Día\s*|Da\s*|D.a\s*/gi, "");
    const match = cleanDias.match(/(\d+)\/(\d+)/);
    let currentDay = 12;
    let totalDays = 35;
    if (match) {
        currentDay = parseInt(match[1]) || 12;
        totalDays = parseInt(match[2]) || 35;
    }
    totalDays = totalDays || 35;
    const timelinePercentage = Math.round((currentDay / totalDays) * 100);

    const totalBudget = 4995000;
    const progressVal = parseFloat(state.avancePercentage) || 0;
    const executedBudget = Math.round(totalBudget * (progressVal / 100));
    const remainingBudget = totalBudget - executedBudget;

    let aiSummaryText = '';
    if (state.alertsCount === 0) {
        aiSummaryText = `La obra "Edificio Palermo Chico" se desenvuelve bajo condiciones óptimas de eficiencia, alcanzando un progreso físico consolidado del ${progressVal}%. La cuadrilla registra un presentismo perfecto del 100% de los operarios reportados. El inventario de acopios se mantiene estable sin desvíos presupuestarios ni de entrega de materiales. Se aconseja continuar con las etapas de cañería y preparación de revoques según el cronograma previsto.`;
    } else {
        let problems = [];
        const incidentsString = (state.incidents || []).map(inc => typeof inc === 'object' && inc !== null ? (inc.title + ' ' + inc.description) : inc).join(' ').toLowerCase();
        if (incidentsString.includes('cañería') || incidentsString.includes('baño') || incidentsString.includes('fuga')) {
            problems.push('una fisura sanitaria en la cañería del baño principal (reparación inmediata en curso)');
        }
        if (incidentsString.includes('cerámicas') || incidentsString.includes('suministro') || incidentsString.includes('retraso') || incidentsString.includes('demora')) {
            problems.push('un retraso logístico de 48 horas en el suministro de revestimientos cerámicos');
        }
        
        let problemStr = problems.length > 0 ? problems.join(' y ') : 'demoras menores reportadas en las bitácoras diarias';
        aiSummaryText = `Se detecta una desviación operativa temporal en el proyecto por ${state.alertsCount} alerta(s) activa(s), generadas principalmente por ${problemStr}. Para neutralizar impactos negativos en el plazo de entrega, la IA ha reprogramado las holguras del Gantt, postergando revestimientos por 2 días y priorizando las tareas correctivas. Los niveles de seguridad física y el avance en el resto de los frentes continúan con normalidad.`;
    }

    return {
      currentDay,
      totalDays,
      timelinePercentage,
      totalBudget,
      executedBudget,
      remainingBudget,
      aiSummaryText,
      todayStr: new Date().toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' })
    };
  }, [state]);

  return (
    <>
      {/* Live Toasts Notifications Container */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast-notification toast-${t.type}`}>
            <div className="toast-icon-wrapper">
              <i className={t.type === 'success' ? 'fa-solid fa-check' : t.type === 'warning' ? 'fa-solid fa-exclamation-triangle' : 'fa-solid fa-info'}></i>
            </div>
            <div>
              <strong style={{ display: 'block', fontSize: '0.85rem', marginBottom: '2px' }}>{t.type === 'success' ? 'Éxito' : t.type === 'warning' ? 'Alerta Crítica' : 'Notificación'}</strong>
              <span style={{ fontSize: '0.8rem', opacity: 0.9 }}>{t.message}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="app-container">
        {/* Sidebar Navigation */}
        <aside className={`sidebar ${mobileSidebarOpen ? 'active' : ''}`}>
          <div className="brand">
            <div className="brand-logo">OS</div>
            <div className="brand-name">ObraSaaS</div>
          </div>
          
          {/* Light/Dark Theme Toggle */}
          <div className="theme-toggle-container" style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', padding: '8px 12px', borderRadius: '12px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}><i className="fa-solid fa-circle-half-stroke"></i> Tema</span>
            <button onClick={handleToggleTheme} className="btn btn-sm" style={{ padding: '4px 10px', fontSize: '0.75rem', background: 'var(--primary)', color: 'var(--bg-main)', border: 'none', cursor: 'pointer', fontWeight: 700, borderRadius: '8px' }}>
              {isLightTheme ? <><i className="fa-solid fa-sun"></i> Claro</> : <><i className="fa-solid fa-moon"></i> Oscuro</>}
            </button>
          </div>
          
          <nav className="nav-menu">
            <li className={`nav-item ${activeTab === 'sec-dashboard' ? 'active' : ''}`}>
              <button onClick={() => setActiveTab('sec-dashboard')}><i className="fa-solid fa-chart-line"></i> Dashboard</button>
            </li>
            <li className={`nav-item ${activeTab === 'sec-whatsapp' ? 'active' : ''}`}>
              <button onClick={() => setActiveTab('sec-whatsapp')}><i className="fa-brands fa-whatsapp"></i> Simulador WhatsApp</button>
            </li>
            <li className={`nav-item ${activeTab === 'sec-gantt' ? 'active' : ''}`}>
              <button onClick={() => setActiveTab('sec-gantt')}><i className="fa-solid fa-timeline"></i> Cronograma Gantt</button>
            </li>
            <li className={`nav-item ${activeTab === 'sec-admin' ? 'active' : ''}`}>
              <button onClick={() => setActiveTab('sec-admin')}><i className="fa-solid fa-building-user"></i> Consola SuperAdmin</button>
            </li>
            <li className={`nav-item ${activeTab === 'sec-presupuesto' ? 'active' : ''}`}>
              <button onClick={() => setActiveTab('sec-presupuesto')}><i className="fa-solid fa-file-invoice-dollar"></i> Presupuesto Formal</button>
            </li>
            <li className={`nav-item ${activeTab === 'sec-personal' ? 'active' : ''}`}>
              <button onClick={() => setActiveTab('sec-personal')}><i className="fa-solid fa-users-gear"></i> Personal &amp; RRHH</button>
            </li>
            <li className="nav-item">
              <Link href="/" style={{ textDecoration: 'none', display: 'block', width: '100%' }}>
                <button style={{ textAlign: 'left', width: '100%' }}><i className="fa-solid fa-rocket"></i> Landing Comercial</button>
              </Link>
            </li>
          </nav>
          
          <div className="sidebar-footer">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary)', color: 'var(--bg-main)', fontWeight: 800, display: 'flex', alignItems: 'center', fontSize: '0.85rem', flexShrink: 0, justifyContent: 'center' }}>M</div>
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexGrow: 1 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', color: '#fff' }}>Arq. Marcelo</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Plan {state.subscription?.plan || 'Pro'}</span>
              </div>
              <button onClick={handleClerkLogout} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <i className="fa-solid fa-right-from-bracket"></i>
              </button>
            </div>
          </div>
        </aside>

        {/* Sidebar Overlay for mobile screen */}
        {mobileSidebarOpen && <div className="sidebar-overlay active" onClick={() => setMobileSidebarOpen(false)}></div>}

        {/* Mobile Header Top Navigation */}
        <header className="mobile-header">
          <button className="mobile-toggle-btn" onClick={() => setMobileSidebarOpen(true)}>
            <i className="fa-solid fa-bars"></i>
          </button>
          <div className="mobile-logo">
            <div className="mobile-logo-box">OS</div>
            <span className="mobile-brand-name">ObraSaaS</span>
          </div>
          <div style={{ width: '32px' }}></div>
        </header>

        {/* Main Content Area */}
        <main className="main-content">

          {/* Multi-Role Persona Switcher (v2.0) */}
          <div className="persona-switcher-bar glass-panel-premium" style={{ marginBottom: '20px', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', borderLeft: '4px solid var(--primary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>
                <i className="fa-solid fa-users-viewfinder" style={{ color: 'var(--primary)', marginRight: '6px' }}></i> Vista por Rol:
              </span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button 
                  onClick={() => { setSelectedPersona('directora'); addToast("Cambiado a vista: Directora de Obra / Arquitecta", "info"); }}
                  className={`btn btn-sm ${selectedPersona === 'directora' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.75rem', padding: '5px 12px', borderRadius: '6px' }}
                >
                  <i className="fa-solid fa-compass-drafting" style={{ marginRight: '4px' }}></i> Directora de Obra
                </button>
                <button 
                  onClick={() => { setSelectedPersona('compras'); addToast("Cambiado a vista: Socio Compras & Abastecimiento", "info"); }}
                  className={`btn btn-sm ${selectedPersona === 'compras' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.75rem', padding: '5px 12px', borderRadius: '6px' }}
                >
                  <i className="fa-solid fa-cart-flatbed" style={{ marginRight: '4px' }}></i> Compras &amp; Corralón
                </button>
                <button 
                  onClick={() => { setSelectedPersona('capataz'); addToast("Cambiado a vista: Capataz / Jefe de Campo", "info"); }}
                  className={`btn btn-sm ${selectedPersona === 'capataz' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.75rem', padding: '5px 12px', borderRadius: '6px' }}
                >
                  <i className="fa-solid fa-helmet-safety" style={{ marginRight: '4px' }}></i> Jefe de Obra / Capataz
                </button>
                <button 
                  onClick={() => { setSelectedPersona('cliente'); addToast("Cambiado a vista: Cliente / Licitación Pública", "info"); }}
                  className={`btn btn-sm ${selectedPersona === 'cliente' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.75rem', padding: '5px 12px', borderRadius: '6px' }}
                >
                  <i className="fa-solid fa-landmark" style={{ marginRight: '4px' }}></i> Cliente / Municipio
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className={`badge ${realtimeConnected ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }} title={realtimeConnected ? "Conexión Real-Time SSE/Sockets activa (0 consultas a base de datos en reposo)" : "Reconectando con el servidor..."}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: realtimeConnected ? '#22c55e' : '#eab308', display: 'inline-block', boxShadow: realtimeConnected ? '0 0 8px #22c55e' : 'none' }}></span>
                {realtimeConnected ? 'Sockets En Vivo (SSE)' : 'Reconectando...'}
              </span>
              <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>
                <i className="fa-solid fa-calendar-week" style={{ marginRight: '4px' }}></i> {state.currentQuincena || 'Quincena 1 (01/Ago - 15/Ago)'}
              </span>
            </div>
          </div>
          
          {/* SECTION 1: DASHBOARD */}
          <section id="sec-dashboard" className={`content-section animate-fade-in-up ${activeTab === 'sec-dashboard' ? 'active' : ''}`}>
            <div className="section-header">
              <div className="header-title">
                <h1>
                  {selectedPersona === 'directora' && 'Panel Directora de Obra (Socio Técnico)'}
                  {selectedPersona === 'compras' && 'Panel Abastecimiento & Compras (Socio Logística)'}
                  {selectedPersona === 'capataz' && 'Panel Jefe de Obra & Cuadrilla de Campo'}
                  {selectedPersona === 'cliente' && 'Portal de Transparencia & Certificaciones'}
                </h1>
                <p>
                  {selectedPersona === 'directora' && 'Control de hitos por quincenas, resolución de interferencias, aprobación de propuestas y certificaciones.'}
                  {selectedPersona === 'compras' && 'Seguimiento de entregas comprometidas, avisos automáticos (7d / 2d), caja chica y control de corralón.'}
                  {selectedPersona === 'capataz' && 'Presentismo biométrico satelital, asignación de tareas diarias y reporte de novedades por voz.'}
                  {selectedPersona === 'cliente' && 'Curva de inversión acumulada, actas de medición quincenal aprobadas y avance fotográfico verificado.'}
                </p>
              </div>
              <div className="header-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowWeeklyReportModal(true)} style={{ padding: '8px 14px', fontSize: '0.8rem', fontWeight: 700, background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>
                  <i className="fa-solid fa-file-pdf"></i> Reporte Semanal
                </button>
                <span className="badge badge-success"><i className="fa-solid fa-circle-check"></i> Obra Activa</span>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid-4">
              <div className="glass-panel-premium dashboard-card-hover stat-card">
                <div className="stat-icon primary"><i className="fa-solid fa-person-digging"></i></div>
                <div className="stat-content">
                  <span className="stat-value">{state.operariosCount}</span>
                  <span className="stat-label">Operarios en Obra</span>
                </div>
              </div>
              <div className="glass-panel-premium dashboard-card-hover stat-card">
                <div className="stat-icon success"><i className="fa-solid fa-percent"></i></div>
                <div className="stat-content">
                  <span className="stat-value">{state.avancePercentage}%</span>
                  <span className="stat-label">Progreso General</span>
                </div>
              </div>
              <div className="glass-panel-premium dashboard-card-hover stat-card">
                <div className={`stat-icon danger ${state.alertsCount > 0 ? 'fa-fade' : ''}`} style={{ background: state.alertsCount > 0 ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.02)' }}>
                  <i className="fa-solid fa-triangle-exclamation"></i>
                </div>
                <div className="stat-content">
                  <span className="stat-value">{state.alertsCount}</span>
                  <span className="stat-label">Alertas/Bloqueos</span>
                </div>
              </div>
              <div className="glass-panel-premium dashboard-card-hover stat-card">
                <div className="stat-icon info"><i className="fa-solid fa-calendar-day"></i></div>
                <div className="stat-content">
                  <span className="stat-value">{state.diasEstimados}</span>
                  <span className="stat-label">Plazo Estimado</span>
                </div>
              </div>
            </div>

            {/* Dashboard Charts */}
            <div className="grid-2" style={{ marginBottom: '24px' }}>
              <div className="glass-panel-premium dashboard-card-hover">
                <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '16px' }}>Curva de Avance Real vs. Planificado</h3>
                <div className="chart-container" style={{ height: '220px', position: 'relative' }}>
                  <canvas ref={progressChartRef}></canvas>
                </div>
              </div>

              <div className="glass-panel-premium dashboard-card-hover">
                <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '16px' }}>Distribución de Tareas por Estado</h3>
                <div className="chart-container" style={{ height: '220px', position: 'relative' }}>
                  <canvas ref={tasksChartRef}></canvas>
                </div>
              </div>
            </div>

            {/* Actionable BIM / Digital Twin Viewer */}
            <div className="grid-1" style={{ marginBottom: '24px' }}>
              <div className="glass-panel-premium dashboard-card-hover" style={{ display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', zIndex: 10 }}>
                  <div>
                    <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <i className="fa-solid fa-cube" style={{ color: 'var(--info)' }}></i> Gemelo Digital BIM (Autodesk Sync)
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>
                      Renderización en la nube del modelo federado. Control de interferencias y avance visual.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-sm" style={{ background: 'var(--primary)', color: 'var(--bg-main)', fontWeight: 700, borderRadius: '6px' }}><i className="fa-solid fa-layer-group"></i> MEP</button>
                    <button className="btn btn-sm btn-secondary" style={{ borderRadius: '6px' }}><i className="fa-solid fa-building"></i> Estructura</button>
                  </div>
                </div>
                
                <div style={{ height: '350px', width: '100%', borderRadius: '12px', background: 'url(/bim_render.png) center/cover no-repeat', border: '1px solid var(--border-color)', position: 'relative' }}>
                  {/* Overlay UI on BIM */}
                  <div style={{ position: 'absolute', bottom: '16px', left: '16px', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Clash Detection AI</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="badge badge-success"><i className="fa-solid fa-check"></i> Cero Conflictos</span>
                      <span style={{ fontSize: '0.8rem', color: '#fff' }}>Nivel 4 Revisado</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Interactive Map & AI Copilot Row */}
            <div className="grid-2" style={{ marginBottom: '24px' }}>
              {/* Map Card */}
              <div className="glass-panel-premium dashboard-card-hover" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: 0 }}>Mapa de Asistencia Satelital</h3>
                  <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <button className="btn btn-sm" onClick={() => setMapMode('sat')} style={{ fontSize: '0.7rem', padding: '4px 10px', background: mapMode === 'sat' ? 'var(--primary)' : 'transparent', color: mapMode === 'sat' ? 'var(--bg-main)' : 'var(--text-secondary)', fontWeight: mapMode === 'sat' ? '700' : '600', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>Satelital</button>
                    <button className="btn btn-sm" onClick={() => setMapMode('heat')} style={{ fontSize: '0.7rem', padding: '4px 10px', background: mapMode === 'heat' ? 'var(--primary)' : 'transparent', color: mapMode === 'heat' ? 'var(--bg-main)' : 'var(--text-secondary)', fontWeight: mapMode === 'heat' ? '700' : '600', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>Mapa de Calor</button>
                  </div>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '12px' }}>
                  Geolocalización satelital en tiempo real de los operarios dentro del radio de obra (cerca virtual).
                </p>
                <div id="map" ref={mapContainerRef} style={{ height: '260px', width: '100%', borderRadius: '12px', border: '1px solid var(--border-color)', zIndex: 5 }}></div>
              </div>

              {/* Architect AI Supervisor Card */}
              <div className="glass-panel-premium dashboard-card-hover" style={{ display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '4px', color: 'var(--primary)' }}><i className="fa-solid fa-wand-magic-sparkles"></i> Supervisor IA de Obra</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '10px' }}>
                  Pregúntale al supervisor un resumen global de avances, asistencia o alertas sin navegar menú por menú.
                </p>
                
                <div className="copilot-chat-box">
                  <div className="copilot-chat-messages" style={{ overflowY: 'auto' }}>
                    {copilotMessages.map((msg, i) => {
                      // Agentic AI Action Parser
                      const actionRegex = /\[ACTION:(.*?):(.*?)\]/g;
                      let parts = [];
                      let lastIndex = 0;
                      let match;
                      
                      const textToParse = msg.text.replace(/\*\*/g, '');
                      
                      while ((match = actionRegex.exec(textToParse)) !== null) {
                        if (match.index > lastIndex) {
                          parts.push({ type: 'text', content: textToParse.substring(lastIndex, match.index) });
                        }
                        parts.push({ type: 'action', cmd: match[1], label: match[2] });
                        lastIndex = actionRegex.lastIndex;
                      }
                      if (lastIndex < textToParse.length) {
                        parts.push({ type: 'text', content: textToParse.substring(lastIndex) });
                      }

                      return (
                      <div key={i} style={{ 
                        background: msg.sender === 'user' ? 'var(--primary-glow)' : 'rgba(255,255,255,0.03)', 
                        padding: '10px 14px', 
                        borderRadius: '12px', 
                        alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start', 
                        maxWidth: '90%',
                        fontSize: '0.8rem',
                        color: '#fff',
                        border: msg.sender === 'bot' ? '1px solid rgba(255,255,255,0.05)' : 'none',
                        boxShadow: msg.sender === 'bot' ? '0 4px 6px rgba(0,0,0,0.1)' : 'none'
                      }}>
                        {parts.length > 0 ? parts.map((p, idx) => {
                          if (p.type === 'text') {
                            return <span key={idx} style={{ whiteSpace: 'pre-wrap' }}>{p.content}</span>;
                          } else {
                            return (
                              <button 
                                key={idx} 
                                onClick={() => handleAgenticAction(p.cmd)}
                                style={{
                                  display: 'block',
                                  marginTop: '10px',
                                  padding: '8px 12px',
                                  background: 'var(--success)',
                                  color: 'var(--bg-main)',
                                  border: 'none',
                                  borderRadius: '6px',
                                  fontWeight: 'bold',
                                  cursor: 'pointer',
                                  fontSize: '0.75rem',
                                  width: '100%',
                                  textAlign: 'center',
                                  transition: 'transform 0.2s'
                                }}
                                onMouseOver={(e) => e.target.style.transform = 'scale(1.02)'}
                                onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
                              >
                                <i className="fa-solid fa-bolt"></i> {p.label}
                              </button>
                            );
                          }
                        }) : <span style={{ whiteSpace: 'pre-wrap' }}>{textToParse}</span>}
                      </div>
                      );
                    })}
                    <div ref={copilotMessagesEndRef}></div>
                  </div>
                  <div className="copilot-chat-input-container">
                    <input 
                      type="text" 
                      className="copilot-chat-input" 
                      placeholder="Pregunta al Supervisor de la obra..." 
                      value={copilotInput}
                      onChange={(e) => setCopilotInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && sendCopilotUserMessage()}
                    />
                    <button className="copilot-chat-btn" onClick={sendCopilotUserMessage}>Consultar</button>
                  </div>
                </div>

                <div className="crm-suggestions" style={{ marginTop: 0 }}>
                  <span className="crm-suggest-tag" onClick={() => { setCopilotInput("Haceme un resumen de cómo van los avances"); setTimeout(sendCopilotUserMessage, 50); }}>Resumen de avances</span>
                  <span className="crm-suggest-tag" onClick={() => { setCopilotInput("¿Alguien faltó hoy? ¿Llegaron todos a tiempo?"); setTimeout(sendCopilotUserMessage, 50); }}>Asistencia hoy</span>
                  <span className="crm-suggest-tag" onClick={() => { setCopilotInput("¿Hay algún mensaje preocupante, alerta o heridos?"); setTimeout(sendCopilotUserMessage, 50); }}>¿Alguna alerta o heridos?</span>
                </div>
              </div>
            </div>

            {/* Edge AI CCTV Security Panel */}
            <div className="glass-panel-premium dashboard-card-hover" style={{ marginBottom: '24px', overflow: 'hidden' }}>
              <div className="section-header" style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontFamily: 'var(--font-heading)', color: 'var(--danger)', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <i className="fa-solid fa-video fa-fade"></i> Control CCTV Edge AI (En Vivo)
                </h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <span className="badge badge-danger">1 Alerta EPP</span>
                  <span className="badge badge-success"><i className="fa-solid fa-signal"></i> Cam 4 - Activa</span>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0' }}>
                <div style={{ height: '350px', background: 'url(/cctv_render.png) center/cover no-repeat', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                </div>
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ borderLeft: '4px solid var(--danger)', paddingLeft: '12px' }}>
                    <strong style={{ color: 'var(--danger)', display: 'block', fontSize: '0.9rem', marginBottom: '4px' }}>VIOLACIÓN DE SEGURIDAD</strong>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Detección de operario sin casco de seguridad en zona caliente.</span>
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={() => addToast('Notificación enviada al supervisor de campo vía SMS.', 'success')} style={{ width: '100%' }}>
                    <i className="fa-solid fa-bell"></i> Alertar Supervisor
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => addToast('IA: Reporte de infracción guardado en legajo del operario.', 'info')} style={{ width: '100%', marginTop: '8px' }}>
                    <i className="fa-solid fa-file-signature"></i> Cargar a Legajo
                  </button>
                </div>
              </div>
            </div>

            {/* Dashboard Details Table */}
            <div className="grid-2">
              {/* Left: Asistencia y Operarios */}
              <div className="glass-panel-premium dashboard-card-hover">
                <div className="section-header" style={{ marginBottom: '16px' }}>
                  <h3 style={{ fontFamily: 'var(--font-heading)' }}>Historial de Fichajes de Hoy</h3>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '16px' }}>
                  Registro pormenorizado de operarios activos validados por celular.
                </p>
                <table className="logs-table">
                  <thead>
                    <tr>
                      <th>Operario &amp; Puesto</th>
                      <th>Gremio</th>
                      <th>Check-in</th>
                      <th>Validación &amp; Geocerca</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(state.attendance || {}).map(name => {
                      const item = state.attendance[name];
                      let badgeClass = "badge-warning";
                      if (item.status?.includes('Presente')) badgeClass = 'badge-success';
                      if (item.status?.includes('Desviado')) badgeClass = 'badge-danger';
                      if (item.status?.includes('GPS')) badgeClass = 'badge-info';

                      return (
                        <tr key={name}>
                          <td><strong>{name}</strong></td>
                          <td><span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>{item.role}</span></td>
                          <td>{item.checkin || '--:--'}</td>
                          <td>
                            {item.distanceMeters !== undefined && item.distanceMeters !== null ? (
                              <span style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', color: item.distanceMeters <= 100 ? '#22c55e' : '#ef4444' }}>
                                <i className="fa-solid fa-satellite-dish"></i>
                                {item.distanceMeters}m ({item.distanceMeters <= 100 ? 'Geocerca OK' : 'Fuera de Radio'})
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                <i className="fa-solid fa-microphone" style={{ marginRight: '4px' }}></i> {item.verifiedBy || 'Biometría'}
                              </span>
                            )}
                          </td>
                          <td>
                            <span className={`badge ${badgeClass}`}>{item.status}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Right: Incidencias y Bitácora */}
              <div className="glass-panel-premium dashboard-card-hover">
                <div className="section-header" style={{ marginBottom: '16px' }}>
                  <h3 style={{ fontFamily: 'var(--font-heading)' }}>Incidencias &amp; Alertas en Curso</h3>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '16px' }}>
                  Filtro automático de novedades críticas detectadas en audios procesados por el motor de IA.
                </p>
                <div className="incidencias-feed" style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: '280px' }}>
                  {state.incidents.length === 0 ? (
                    <div className="nocrit-msg" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px', fontSize: '0.9rem' }}>
                      <i className="fa-solid fa-shield-halved" style={{ fontSize: '2rem', marginBottom: '10px', display: 'block', color: 'var(--success)' }}></i>
                      Sin incidencias reportadas hoy. Obra en curso regular.
                    </div>
                  ) : (
                    state.incidents.map((inc, i) => {
                      let borderCol = 'var(--info)';
                      let bgCol = 'var(--info-bg)';
                      let badgeClass = 'badge-info';
                      if (inc.type === 'critical') {
                        borderCol = 'var(--danger)';
                        bgCol = 'var(--danger-bg)';
                        badgeClass = 'badge-danger';
                      } else if (inc.type === 'warning') {
                        borderCol = 'var(--warning)';
                        bgCol = 'var(--warning-bg)';
                        badgeClass = 'badge-warning';
                      } else if (inc.type === 'success') {
                        borderCol = 'var(--success)';
                        bgCol = 'var(--success-bg)';
                        badgeClass = 'badge-success';
                      }

                      return (
                        <div key={i} className="glass-panel-premium dashboard-card-hover" style={{ borderLeft: `4px solid ${borderCol}`, background: bgCol, marginBottom: 0, padding: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <strong style={{ color: borderCol, fontSize: '0.8rem' }}><i className={inc.icon}></i> {inc.title}</strong>
                            <span className={`badge ${badgeClass}`}>{inc.badge}</span>
                          </div>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-primary)', margin: '4px 0' }}>
                            {inc.description}
                          </p>
                          <div style={{ marginTop: '4px', fontSize: '0.65rem', color: 'var(--text-secondary)', textAlign: 'right' }}>
                            {inc.timestamp} • {inc.reporter}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Control de Acopios and Recepción de Suministros Row */}
            <div className="glass-panel-premium dashboard-card-hover" style={{ marginTop: '24px' }}>
              <div className="section-header" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <i className="fa-solid fa-boxes-stacked" style={{ color: 'var(--primary)' }}></i> Control de Acopios y Recepción de Suministros
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    Trazabilidad de materiales críticos en corralón y en obra para evitar demoras por falta de stock.
                  </p>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => setShowReceiveMaterialModal(true)} style={{ padding: '8px 16px', fontSize: '0.8rem', fontWeight: 700 }}>
                  <i className="fa-solid fa-truck-loading"></i> Registrar Recepción
                </button>
              </div>

              <div className="grid-4" style={{ marginBottom: 0 }}>
                {Object.keys(state.stockpiles).map(key => {
                  const item = state.stockpiles[key];
                  let badgeClass = 'badge-success';
                  let barColor = 'var(--success)';
                  if (item.status === 'Crítico') {
                    badgeClass = 'badge-danger';
                    barColor = 'var(--danger)';
                  } else if (item.status === 'En Camino') {
                    badgeClass = 'badge-info';
                    barColor = 'var(--info)';
                  }

                  const pct = Math.min((item.current / item.max) * 100, 100);

                  return (
                    <div key={key} className="glass-panel-premium dashboard-card-hover stat-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '8px', marginBottom: 0, padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: '0.9rem', fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}>{item.name}</strong>
                        <span className={`badge ${badgeClass}`}>{item.status}</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '-2px' }}>
                        Proveedor: {item.supplier}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '8px' }}>
                        <span style={{ fontSize: '1.15rem', fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--text-primary)' }}>{item.current.toLocaleString('es-AR')} {item.unit}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Mín: {item.min} / Máx: {item.max}</span>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.05)', height: '6px', borderRadius: '3px', overflow: 'hidden', marginTop: '4px', border: '1px solid var(--border-color)' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: '3px', transition: 'width 0.4s ease' }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Remitos & Facturas Digitalizadas con IA (OCR en Vivo) */}
            <div className="glass-panel-premium dashboard-card-hover" style={{ marginTop: '24px' }}>
              <div className="section-header" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', color: 'var(--success)' }}>
                    <i className="fa-solid fa-receipt"></i> Remitos &amp; Facturas Digitalizadas por IA (OCR)
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    Extracción automática con GPT-4o Vision de proveedores, CUIT, ítems y montos desde fotos de WhatsApp. Sincronizado en vivo con Caja Chica.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span className="badge badge-success"><i className="fa-solid fa-bolt"></i> Auditoría OCR Activa</span>
                </div>
              </div>

              <div className="grid-2" style={{ gap: '16px' }}>
                {(state.remitos || []).map((rem, idx) => (
                  <div key={rem.id || idx} style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 800, color: '#fff', fontSize: '0.95rem' }}>{rem.proveedor}</span>
                          <span className="badge badge-secondary" style={{ fontSize: '0.65rem' }}>{rem.categoria}</span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          CUIT: <strong>{rem.cuit}</strong> • Comp: <strong>{rem.comprobanteNro}</strong>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--success)', display: 'block' }}>
                          ${rem.montoTotal?.toLocaleString('es-AR')} ARS
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{rem.fecha}</span>
                      </div>
                    </div>

                    {/* Items table */}
                    <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: '8px', padding: '8px 12px' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '6px' }}>Ítems Auditados:</span>
                      {(rem.items || []).map((it, itemIdx) => (
                        <div key={itemIdx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-primary)', padding: '2px 0' }}>
                          <span>• {it.cantidad}x {it.descripcion}</span>
                          <strong style={{ color: '#fff' }}>${it.subtotal?.toLocaleString('es-AR')} ARS</strong>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', color: 'var(--text-secondary)', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px' }}>
                      <span>Rendido por: <strong style={{ color: '#fff' }}>{rem.solicitante}</strong></span>
                      <span style={{ color: '#38bdf8', fontWeight: 'bold' }}><i className="fa-solid fa-circle-check"></i> OCR Confianza: {rem.ocrConfidence || 99}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Inspección Visual & Fotos Técnicas en Vivo (AI Vision) */}
            <div className="glass-panel-premium dashboard-card-hover" style={{ marginTop: '24px' }}>
              <div className="section-header" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', color: 'var(--info)' }}>
                    <i className="fa-solid fa-camera"></i> Inspección Visual &amp; Fotos Técnicas en Vivo (AI Vision)
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    Diagnóstico de calidad, control de plomos, cañerías y detección de fisuras mediante análisis de imágenes en tiempo real.
                  </p>
                </div>
                <span className="badge badge-info"><i className="fa-solid fa-eye"></i> Visión Computacional</span>
              </div>

              <div className="grid-2" style={{ gap: '16px' }}>
                {(state.sitePhotos || []).map((photo, idx) => (
                  <div key={photo.id || idx} style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
                    <div style={{ height: '180px', backgroundImage: `url(${photo.photoUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative' }}>
                      <div style={{ position: 'absolute', top: '10px', left: '10px', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--info)', border: '1px solid var(--info)' }}>
                        {photo.phase}
                      </div>
                      <div style={{ position: 'absolute', bottom: '10px', right: '10px', background: 'rgba(0,0,0,0.75)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', color: '#fff' }}>
                        {photo.timestamp}
                      </div>
                    </div>
                    <div style={{ padding: '14px' }}>
                      <p style={{ fontSize: '0.8rem', color: '#fff', fontWeight: 600, marginBottom: '6px' }}>{photo.caption}</p>
                      <div style={{ background: 'rgba(56, 189, 248, 0.08)', borderLeft: '3px solid var(--info)', padding: '8px 10px', borderRadius: '0 6px 6px 0', fontSize: '0.75rem', color: 'var(--text-primary)', marginBottom: '8px' }}>
                        <i className="fa-solid fa-brain" style={{ color: 'var(--info)', marginRight: '6px' }}></i>
                        {photo.aiAnalysis}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textAlign: 'right' }}>
                        Reportado por: <strong>{photo.reporter}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Telemetría Meteorológica & Radar de Hormigonado (IRAM 1666 / CIRSOC 201) */}
            <div className="glass-panel-premium dashboard-card-hover" style={{ marginTop: '24px' }}>
              <div className="section-header" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', color: '#38bdf8' }}>
                    <i className="fa-solid fa-cloud-sun-rain"></i> Telemetría Meteorológica &amp; Radar de Hormigonado
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    Auditoría satelital en tiempo real para colado de losas y revoques. Normas IRAM 1666 y CIRSOC 201.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span className={`badge ${weatherTelemetry?.concreteAdvisory?.pouringBadge || 'badge-success'}`}>
                    <i className="fa-solid fa-tower-broadcast"></i> {weatherTelemetry?.concreteAdvisory?.pouringStatus || 'APTO_COLADO'}
                  </span>
                </div>
              </div>

              {/* Weather Stats Grid */}
              <div className="grid-4" style={{ gap: '12px', marginBottom: '16px' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Temperatura Actual</span>
                  <strong style={{ fontSize: '1.4rem', color: '#fff', fontWeight: 900 }}>{weatherTelemetry?.current?.temp ?? 21}°C</strong>
                  <span style={{ fontSize: '0.65rem', color: 'var(--success)', display: 'block' }}>Rango Normativo (5°-32°C)</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Riesgo de Lluvia</span>
                  <strong style={{ fontSize: '1.4rem', color: (weatherTelemetry?.current?.rainProb ?? 10) > 40 ? '#ef4444' : '#22c55e', fontWeight: 900 }}>
                    {weatherTelemetry?.current?.rainProb ?? 12}%
                  </strong>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block' }}>Humedad: {weatherTelemetry?.current?.humidity ?? 60}%</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Viento &amp; Ráfagas</span>
                  <strong style={{ fontSize: '1.4rem', color: '#fff', fontWeight: 900 }}>{weatherTelemetry?.current?.windSpeed ?? 14} km/h</strong>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block' }}>Ráfagas: {weatherTelemetry?.current?.windGusts ?? 20} km/h</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Seguridad Grúa Torre</span>
                  <strong style={{ fontSize: '1.2rem', color: '#22c55e', fontWeight: 900 }}>{weatherTelemetry?.current?.craneStatus || 'OPERATIVA'}</strong>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block' }}>Límite IRAM 3920: 50 km/h</span>
                </div>
              </div>

              {/* Concrete Advisory Box */}
              <div style={{ background: 'rgba(56, 189, 248, 0.05)', border: '1px solid #0284c7', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <strong style={{ color: '#38bdf8', fontSize: '0.85rem' }}><i className="fa-solid fa-clipboard-check"></i> Dictamen Técnico de Colado (IA ConTech):</strong>
                  <span style={{ fontSize: '0.75rem', color: '#fff', fontWeight: 700 }}>Ventana Óptima: {weatherTelemetry?.concreteAdvisory?.optimalWindow || '08:00 - 13:30 hs'}</span>
                </div>
                <p style={{ color: 'var(--text-primary)', fontSize: '0.8rem', margin: 0 }}>
                  {weatherTelemetry?.concreteAdvisory?.advisoryText || 'Condiciones favorables para llenado de estructuras de hormigón armado y revoques.'}
                </p>
              </div>

              {/* 7-Day Forecast Radar Bar */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '8px' }}>
                {(weatherTelemetry?.forecast7Days || []).slice(0, 5).map((fDay, fIdx) => (
                  <div key={fIdx} style={{ background: 'rgba(0,0,0,0.25)', border: `1px solid ${fDay.color}44`, borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', fontWeight: 700 }}>{fDay.date}</span>
                    <strong style={{ fontSize: '0.85rem', color: '#fff', display: 'block', margin: '2px 0' }}>{fDay.maxTemp}° / {fDay.minTemp}°</strong>
                    <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: `${fDay.color}22`, color: fDay.color, fontWeight: 700 }}>
                      {fDay.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Cadena Inmutable de Trazabilidad Forense SHA-256 (Blindaje Judicial) */}
            <div className="glass-panel-premium dashboard-card-hover" style={{ marginTop: '24px' }}>
              <div className="section-header" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', color: '#a855f7' }}>
                    <i className="fa-solid fa-link"></i> Cadena Inmutable de Trazabilidad Forense (SHA-256)
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    Sellado criptográfico encadenado de cada fichaje, remito e hito para blindaje probatorio ante litigios laborales y reclamos de contratistas.
                  </p>
                </div>
                <span className="badge badge-success" style={{ background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc', border: '1px solid #a855f7' }}>
                  <i className="fa-solid fa-shield-halved"></i> Integridad 100% Verificada
                </span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '8px' }}>Bloque #</th>
                      <th style={{ padding: '8px' }}>Hora</th>
                      <th style={{ padding: '8px' }}>Evento Registrado</th>
                      <th style={{ padding: '8px' }}>Actor</th>
                      <th style={{ padding: '8px' }}>Hash Criptográfico SHA-256</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>Sello</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(state.auditLedger || []).slice(0, 5).map((block, bIdx) => (
                      <tr key={block.hash || bIdx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '8px', fontWeight: 800, color: '#a855f7' }}>#{block.index}</td>
                        <td style={{ padding: '8px', color: 'var(--text-muted)' }}>{block.formattedTime || 'Reciente'}</td>
                        <td style={{ padding: '8px', color: '#fff', fontWeight: 600 }}>{block.action}</td>
                        <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>{block.actor}</td>
                        <td style={{ padding: '8px', fontFamily: 'monospace', fontSize: '0.75rem', color: '#38bdf8' }}>
                          {block.hash?.substring(0, 16)}...{block.hash?.substring(block.hash?.length - 8)}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', fontWeight: 'bold' }}>
                            ✓ FIRMADO
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Future Pro Features Roadmap */}
            <div className="glass-panel-premium dashboard-card-hover" style={{ marginTop: '24px' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '16px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fa-solid fa-rocket"></i> Roadmap de Funcionalidades Pro (Plan de Evolución)
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>
                Para escalar de un MVP a un SaaS corporativo de alta gama, estas son las características técnicas y comerciales que integrará la plataforma:
              </p>
              <div className="grid-3" style={{ marginBottom: '10px' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', borderTop: '3px solid #60a5fa' }}>
                  <h5 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.95rem', marginBottom: '8px' }}><i className="fa-solid fa-key" style={{ color: '#60a5fa' }}></i> Enlace Único de Celular</h5>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                    Vincula cada número de teléfono móvil a la identidad biométrica y DNI del operario. La app rechaza fichajes desde números no validados o suplantados.
                  </p>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', borderTop: '3px solid #34d399' }}>
                  <h5 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.95rem', marginBottom: '8px' }}><i className="fa-solid fa-map-location-dot" style={{ color: '#34d399' }}></i> Geofencing Automático</h5>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                    Dibuja un límite geográfico (cerca virtual) en el plano de la obra. Los operarios solo pueden fichar entrada si el GPS de su celular está físicamente dentro del predio.
                  </p>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', borderTop: '3px solid #ff9f1c' }}>
                  <h5 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.95rem', marginBottom: '8px' }}><i className="fa-solid fa-file-pdf" style={{ color: '#ff9f1c' }}></i> Reportes Semanales Auto</h5>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                    Compilación automática en un click de todas las fotos de avance de la semana, notas de voz y estado del Gantt en un reporte PDF premium para enviar directo por WhatsApp al cliente final.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 2: WHATSAPP SIMULATOR */}
          <section id="sec-whatsapp" className={`content-section animate-fade-in-up ${activeTab === 'sec-whatsapp' ? 'active' : ''}`}>
            <div className="section-header">
              <div className="header-title">
                <h1>Simulador de Chat de Obra (WhatsApp IA)</h1>
                <p>Interactúa con la IA en tiempo real. Reproduce notas de voz con sonido sintetizado o chatea directamente con el bot.</p>
              </div>
            </div>

            <div className="grid-2">
              {/* Smartphone Mockup */}
              <div className="phone-frame">
                <div className="phone-notch"></div>
                <div className="whatsapp-simulator">
                  <div className="whatsapp-header">
                    <div className="whatsapp-contact">
                      <div className="whatsapp-avatar">OS</div>
                      <div className="whatsapp-contact-details">
                        <span className="whatsapp-contact-name">Asistente ObraSaaS</span>
                        <span className="whatsapp-contact-status">En línea</span>
                      </div>
                    </div>
                    <div>
                      <i className="fa-solid fa-phone" style={{ color: 'var(--text-secondary)', marginRight: '12px', cursor: 'pointer' }}></i>
                      <i className="fa-solid fa-ellipsis-vertical" style={{ color: 'var(--text-secondary)', cursor: 'pointer' }}></i>
                    </div>
                  </div>

                  {/* Chat messages */}
                  <div className="whatsapp-chat-body" style={{ overflowY: 'auto' }}>
                    {chatMessages.map((msg, i) => (
                      <div key={i} className={`message ${msg.sender === 'user' ? 'sent' : 'received'}`}>
                        {msg.text.includes(' plan') || msg.text.includes('Ubicación') || msg.text.includes('🎙️') || msg.text.includes('📍') || msg.text.includes('📸') ? (
                          <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
                        ) : msg.text.startsWith('📄') || msg.text.startsWith('📸') || msg.text.startsWith('🖼️') || msg.text.startsWith('👤') ? (
                          <div>{msg.text}</div>
                        ) : msg.text.includes('Audio de obra') || msg.text.includes('Audio ') ? (
                          <div>
                            <div className="audio-player-container" onClick={replayAudio} style={{ minWidth: '180px', marginBottom: '6px', cursor: 'pointer' }} title="Replay Audio">
                              <div className="play-btn" style={{ width: '26px', height: '26px', fontSize: '0.75rem', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', color: 'var(--bg-main)' }}><i className="fa-solid fa-play"></i></div>
                              <div style={{ flexGrow: 1, height: '4px', background: 'rgba(255,255,255,0.15)', borderRadius: '2px', position: 'relative', overflow: 'hidden' }}>
                                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '100%', background: 'var(--primary)', borderRadius: '2px' }}></div>
                              </div>
                              <i className="fa-solid fa-microphone-lines" style={{ color: '#ff9f1c', fontSize: '0.85rem' }}></i>
                            </div>
                            <span style={{ fontSize: '0.75rem' }}>{msg.text}</span>
                          </div>
                        ) : (
                          <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
                        )}
                        <span className="message-time">{msg.time}</span>
                      </div>
                    ))}
                    <div ref={chatMessagesEndRef}></div>
                  </div>

                  {/* Input Bar */}
                  <div className="whatsapp-input-bar">
                    <i className="fa-solid fa-paperclip whatsapp-clip-btn" onClick={() => setAttachmentMenuOpen(!attachmentMenuOpen)} title="Menú de Adjuntos" style={{ cursor: 'pointer' }}></i>
                    <input 
                      type="text" 
                      className="whatsapp-text-input" 
                      placeholder="Pregúntale al bot de obra..." 
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    />
                    <button className="whatsapp-send-btn" onClick={handleSendMessage}><i className="fa-solid fa-paper-plane"></i></button>
                  </div>

                  {/* Attachment menu */}
                  {attachmentMenuOpen && (
                    <div className="whatsapp-attachment-menu" style={{ display: 'grid' }}>
                      <div className="attachment-item" onClick={() => selectAttachment('document')}>
                        <div className="attachment-icon" style={{ background: '#4285f4' }}><i className="fa-solid fa-file-lines"></i></div>
                        <span>Documento</span>
                      </div>
                      <div className="attachment-item" onClick={() => selectAttachment('camera')}>
                        <div className="attachment-icon" style={{ background: '#ea4335' }}><i className="fa-solid fa-camera"></i></div>
                        <span>Cámara</span>
                      </div>
                      <div className="attachment-item" onClick={() => selectAttachment('gallery')}>
                        <div className="attachment-icon" style={{ background: '#a142f4' }}><i className="fa-solid fa-image"></i></div>
                        <span>Galería</span>
                      </div>
                      <div className="attachment-item" onClick={() => selectAttachment('audio')}>
                        <div className="attachment-icon" style={{ background: '#ff6d01' }}><i className="fa-solid fa-headphones"></i></div>
                        <span>Audio</span>
                      </div>
                      <div className="attachment-item" onClick={() => { setAttachmentMenuOpen(false); setGpsModalOpen(true); }}>
                        <div className="attachment-icon" style={{ background: '#0f9d58' }}><i className="fa-solid fa-location-dot"></i></div>
                        <span>Ubicación</span>
                      </div>
                      <div className="attachment-item" onClick={() => selectAttachment('contact')}>
                        <div className="attachment-icon" style={{ background: '#34a853' }}><i className="fa-solid fa-user"></i></div>
                        <span>Contacto</span>
                      </div>
                    </div>
                  )}

                  {/* GPS modal */}
                  {gpsModalOpen && (
                    <div className="gps-share-screen" style={{ display: 'flex' }}>
                      <div className="gps-share-header">
                        <i className="fa-solid fa-arrow-left" onClick={() => setGpsModalOpen(false)} style={{ cursor: 'pointer' }}></i>
                        <span>Enviar ubicación</span>
                        <i className="fa-solid fa-rotate-right" onClick={refreshGpsSearch} style={{ cursor: 'pointer' }}></i>
                      </div>
                      <div className="gps-share-map-preview">
                        <div className="gps-radar-scanner">
                          <div className="radar-circle-1"></div>
                          <div className="radar-circle-2"></div>
                          <div className="radar-dot"></div>
                        </div>
                        <span className="gps-map-label">{gpsLabel}</span>
                      </div>
                      <div className="gps-share-options">
                        <div className="gps-option-item" onClick={confirmGpsSend}>
                          <div className="gps-option-icon" style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--success)' }}><i className="fa-solid fa-location-crosshairs"></i></div>
                          <div className="gps-option-details">
                            <strong>Compartir ubicación en tiempo real</strong>
                            <span>Actualización satelital en vivo</span>
                          </div>
                        </div>
                        <div className="gps-option-item" onClick={confirmGpsSend}>
                          <div className="gps-option-icon" style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--info)' }}><i className="fa-solid fa-building"></i></div>
                          <div className="gps-option-details">
                            <strong>Enviar ubicación actual (Obra)</strong>
                            <span>Fichaje de Asistencia Georreferenciado</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Waveform Controls */}
              <div className="glass-panel-premium dashboard-card-hover" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <h3 style={{ fontFamily: 'var(--font-heading)', color: 'var(--primary)' }}>Panel de Simulación de Audios</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  Haz clic en reproducir para oír la telemetría sintetizada por **Web Audio API** mientras la IA procesa y transcribe el reporte.
                </p>

                {/* Audio 1 */}
                <div className="glass-panel-premium dashboard-card-hover" style={{ background: 'rgba(255, 255, 255, 0.01)', padding: '14px', marginBottom: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <strong style={{ fontSize: '0.85rem' }}><i className="fa-solid fa-clipboard-user" style={{ color: 'var(--success)' }}></i> Audio 1: Fichaje Diario (Ingreso)</strong>
                    <span className="badge badge-success">Luis Martínez</span>
                  </div>
                  <div className="audio-player-container">
                    <button className="play-btn" onClick={() => playAudioSim(1)} disabled={playingAudioIndex !== null}>
                      <i className={playingAudioIndex === 1 ? "fa-solid fa-microphone-lines fa-fade" : "fa-solid fa-play"} id="play-icon-1"></i>
                    </button>
                    <canvas ref={waveformRef1} width="200" height="40" className="waveform-canvas"></canvas>
                    <span className="audio-duration">0:08</span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '6px' }}>
                    "Hola Marcelo, ya entramos a la obra de Palermo. Todo el equipo listo."
                  </p>
                </div>

                {/* Audio 2 */}
                <div className="glass-panel-premium dashboard-card-hover" style={{ background: 'rgba(255, 255, 255, 0.01)', padding: '14px', marginBottom: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <strong style={{ fontSize: '0.85rem' }}><i className="fa-solid fa-chart-line" style={{ color: 'var(--info)' }}></i> Audio 2: Reporte de Avance Diario</strong>
                    <span className="badge badge-info">Juan Gómez</span>
                  </div>
                  <div className="audio-player-container">
                    <button className="play-btn" onClick={() => playAudioSim(2)} disabled={playingAudioIndex !== null}>
                      <i className={playingAudioIndex === 2 ? "fa-solid fa-microphone-lines fa-fade" : "fa-solid fa-play"} id="play-icon-2"></i>
                    </button>
                    <canvas ref={waveformRef2} width="200" height="40" className="waveform-canvas"></canvas>
                    <span className="audio-duration">0:12</span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '6px' }}>
                    "Terminamos el revoque grueso en la cocina y living. Avanzamos según lo planeado."
                  </p>
                </div>

                {/* Audio 3 */}
                <div className="glass-panel-premium dashboard-card-hover" style={{ background: 'rgba(255, 255, 255, 0.01)', padding: '14px', marginBottom: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <strong style={{ fontSize: '0.85rem' }}><i className="fa-solid fa-triangle-exclamation" style={{ color: 'var(--danger)' }}></i> Audio 3: Incidencia Técnica Crítica</strong>
                    <span className="badge badge-danger">Luis Martínez</span>
                  </div>
                  <div className="audio-player-container">
                    <button className="play-btn" onClick={() => playAudioSim(3)} disabled={playingAudioIndex !== null}>
                      <i className={playingAudioIndex === 3 ? "fa-solid fa-microphone-lines fa-fade" : "fa-solid fa-play"} id="play-icon-3"></i>
                    </button>
                    <canvas ref={waveformRef3} width="200" height="40" className="waveform-canvas"></canvas>
                    <span className="audio-duration">0:16</span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '6px' }}>
                    "Che, Marcelo, detectamos que la cañería de la descarga del baño principal tiene una fisura y pierde agua, hay que cambiar un codo de PVC de 110."
                  </p>
                </div>

                {/* Audio 4 */}
                <div className="glass-panel-premium dashboard-card-hover" style={{ background: 'rgba(255, 255, 255, 0.01)', padding: '14px', marginBottom: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <strong style={{ fontSize: '0.85rem' }}><i className="fa-solid fa-clock" style={{ color: 'var(--warning)' }}></i> Audio 4: Demora en Suministros (Cerámicas)</strong>
                    <span className="badge badge-warning">Carlos Pérez</span>
                  </div>
                  <div className="audio-player-container">
                    <button className="play-btn" onClick={() => playAudioSim(4)} disabled={playingAudioIndex !== null}>
                      <i className={playingAudioIndex === 4 ? "fa-solid fa-microphone-lines fa-fade" : "fa-solid fa-play"} id="play-icon-4"></i>
                    </button>
                    <canvas ref={waveformRef4} width="200" height="40" className="waveform-canvas"></canvas>
                    <span className="audio-duration">0:14</span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '6px' }}>
                    "No nos llegó el camión con las cerámicas para el baño, nos va a demorar 2 días la colocación del revestimiento."
                  </p>
                </div>

                {/* Audio 5: Proveedor Confirmando Entrega (Módulo 2B / 4B) */}
                <div className="glass-panel-premium dashboard-card-hover" style={{ background: 'rgba(255, 255, 255, 0.01)', padding: '14px', marginBottom: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <strong style={{ fontSize: '0.85rem' }}><i className="fa-solid fa-truck-ramp-box" style={{ color: 'var(--success)' }}></i> Audio 5: Confirmación de Proveedor (2 días antes)</strong>
                    <span className="badge badge-success">Aberturas López</span>
                  </div>
                  <div className="audio-player-container">
                    <button className="play-btn" onClick={() => playAudioSim(5)} disabled={playingAudioIndex !== null}>
                      <i className={playingAudioIndex === 5 ? "fa-solid fa-microphone-lines fa-fade" : "fa-solid fa-play"} id="play-icon-5"></i>
                    </button>
                    <canvas width="200" height="40" className="waveform-canvas" style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}></canvas>
                    <span className="audio-duration">0:10</span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '6px' }}>
                    "Hola Arq. Marcelo, confirmamos que el flete sale mañana temprano. Entrega en obra a las 09:00 AM."
                  </p>
                </div>

                {/* Audio 6: Consulta de Quincena (Módulo 2B) */}
                <div className="glass-panel-premium dashboard-card-hover" style={{ background: 'rgba(255, 255, 255, 0.01)', padding: '14px', marginBottom: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <strong style={{ fontSize: '0.85rem' }}><i className="fa-solid fa-calendar-check" style={{ color: 'var(--info)' }}></i> Audio 6: Consulta de Quincena (Cuadrilla)</strong>
                    <span className="badge badge-info">Juan Gómez</span>
                  </div>
                  <div className="audio-player-container">
                    <button className="play-btn" onClick={() => playAudioSim(6)} disabled={playingAudioIndex !== null}>
                      <i className={playingAudioIndex === 6 ? "fa-solid fa-microphone-lines fa-fade" : "fa-solid fa-play"} id="play-icon-6"></i>
                    </button>
                    <canvas width="200" height="40" className="waveform-canvas" style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}></canvas>
                    <span className="audio-duration">0:07</span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '6px' }}>
                    "Hola Arq. Marcelo, ¿qué tareas nos tocan a la cuadrilla de albañilería en esta quincena?"
                  </p>
                </div>

                {/* Sim Check-in & Fast Triggers */}
                <div className="glass-panel-premium dashboard-card-hover" style={{ background: 'rgba(255, 255, 255, 0.01)', padding: '14px', marginBottom: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <strong style={{ fontSize: '0.85rem' }}><i className="fa-solid fa-map-location-dot" style={{ color: '#60a5fa' }}></i> Simular Fichaje Completo por GPS</strong>
                    <span className="badge badge-info">Carlos Pérez</span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    Simula que el operario envía su ubicación real desde su celular único enlazado para registrar ingreso.
                  </p>
                  <button className="btn btn-primary btn-sm" onClick={confirmGpsSend} style={{ width: '100%', fontSize: '0.8rem', padding: '10px', background: '#60a5fa', color: '#0a0e17', fontWeight: 700 }}>
                    <i className="fa-solid fa-location-arrow"></i> Enviar Ubicación en Tiempo Real
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 3: GANTT CHART POR QUINCENAS (v2.0) */}
          <section id="sec-gantt" className={`content-section animate-fade-in-up ${activeTab === 'sec-gantt' ? 'active' : ''}`}>
            <div className="section-header">
              <div className="header-title">
                <h1>Cronograma de Obra por Quincenas (Gantt Interactivo v2.0)</h1>
                <p>Planificación sincronizada con entregas comprometidas de proveedores y bloqueos automáticos por falta de materiales.</p>
              </div>
              <div className="header-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {/* Quincena View Selector (Módulo 2B) */}
                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <button 
                    onClick={() => setGanttQuincenaView('todas')}
                    className={`btn btn-sm ${ganttQuincenaView === 'todas' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '6px' }}
                  >
                    Todas
                  </button>
                  <button 
                    onClick={() => setGanttQuincenaView('Q1')}
                    className={`btn btn-sm ${ganttQuincenaView === 'Q1' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '6px' }}
                  >
                    Quincena 1 (Q1)
                  </button>
                  <button 
                    onClick={() => setGanttQuincenaView('Q2')}
                    className={`btn btn-sm ${ganttQuincenaView === 'Q2' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '6px' }}
                  >
                    Quincena 2 (Q2)
                  </button>
                </div>

                <button className="btn btn-primary" onClick={() => setShowAddTaskModal(true)}><i className="fa-solid fa-plus"></i> Agregar Tarea</button>
                <button className="btn btn-secondary" onClick={handleResetState}><i className="fa-solid fa-arrow-rotate-left"></i> Restablecer</button>
              </div>
            </div>

            {/* Quincenas Summary Alert Bar */}
            <div className="grid-3" style={{ marginBottom: '16px' }}>
              <div className="glass-panel-premium dashboard-card-hover" style={{ padding: '12px 16px', marginBottom: 0, borderLeft: '4px solid var(--success)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Quincena 1 Activa</div>
                <strong style={{ fontSize: '1rem', color: '#fff', display: 'block' }}>01/Ago al 15/Ago</strong>
                <span style={{ fontSize: '0.75rem', color: 'var(--success)' }}>2 Tareas • 100% Materiales OK</span>
              </div>
              <div className="glass-panel-premium dashboard-card-hover" style={{ padding: '12px 16px', marginBottom: 0, borderLeft: state.tasks[3]?.isBlocked ? '4px solid var(--danger)' : '4px solid var(--info)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Próxima Quincena 2</div>
                <strong style={{ fontSize: '1rem', color: '#fff', display: 'block' }}>16/Ago al 31/Ago</strong>
                <span style={{ fontSize: '0.75rem', color: state.tasks[3]?.isBlocked ? 'var(--danger)' : 'var(--info)' }}>
                  {state.tasks[3]?.isBlocked ? '⚠️ 1 Tarea Bloqueada por Proveedor' : '2 Tareas Programadas • Proveedores Confirmados'}
                </span>
              </div>
              <div className="glass-panel-premium dashboard-card-hover" style={{ padding: '12px 16px', marginBottom: 0, borderLeft: '4px solid var(--primary)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Certificación Quincenal</div>
                <strong style={{ fontSize: '1rem', color: 'var(--primary)', display: 'block' }}>Q1 Aprobada ($2.850.000)</strong>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Q2 en medición de campo</span>
              </div>
            </div>

            <div className="glass-panel-premium dashboard-card-hover">
              <div className="gantt-chart-container" style={{ position: 'relative', overflowX: 'auto' }}>
                {/* Grid lines background */}
                <div className="gantt-row-grid-bg">
                  <div className="gantt-grid-line"></div>
                  <div className="gantt-grid-line"></div>
                  <div className="gantt-grid-line"></div>
                  <div className="gantt-grid-line"></div>
                  <div className="gantt-grid-line"></div>
                  <div className="gantt-grid-line weekend-grid"></div>
                  <div className="gantt-grid-line weekend-grid"></div>
                  <div className="gantt-grid-line"></div>
                  <div className="gantt-grid-line"></div>
                  <div className="gantt-grid-line"></div>
                  <div className="gantt-grid-line"></div>
                  <div className="gantt-grid-line"></div>
                  <div className="gantt-grid-line weekend-grid"></div>
                  <div className="gantt-grid-line weekend-grid"></div>
                </div>

                {/* Dependency lines SVG */}
                <svg className="gantt-dependency-svg" id="gantt-dependency-lines" ref={svgLinesRef}></svg>

                {/* Timeline Header with Quincena Banners */}
                <div className="gantt-timeline-header">
                  <div className="gantt-label-col-header" style={{ zIndex: 2 }}>
                    <span>Tarea / Asignado / Quincena</span>
                  </div>
                  <div className="gantt-days-header" style={{ zIndex: 2 }}>
                    <div className="gantt-day-header-item">01 Ago (Q1)</div>
                    <div className="gantt-day-header-item">03 Ago</div>
                    <div className="gantt-day-header-item">06 Ago</div>
                    <div className="gantt-day-header-item">08 Ago</div>
                    <div className="gantt-day-header-item">11 Ago</div>
                    <div className="gantt-day-header-item weekend">13 Ago</div>
                    <div className="gantt-day-header-item weekend">15 Ago</div>
                    <div className="gantt-day-header-item today">16 Ago (Q2)</div>
                    <div className="gantt-day-header-item">18 Ago</div>
                    <div className="gantt-day-header-item">21 Ago</div>
                    <div className="gantt-day-header-item">23 Ago</div>
                    <div className="gantt-day-header-item">26 Ago</div>
                    <div className="gantt-day-header-item weekend">28 Ago</div>
                    <div className="gantt-day-header-item weekend">31 Ago</div>
                  </div>
                </div>

                {/* Gantt Rows */}
                <div className="gantt-rows" style={{ zIndex: 2, position: 'relative' }}>
                  {Object.keys(state.tasks)
                    .filter(id => {
                      if (ganttQuincenaView === 'todas') return true;
                      return state.tasks[id].quincena === ganttQuincenaView;
                    })
                    .map(id => {
                      const task = state.tasks[id];
                      let barClass = "gantt-bar";
                      if (task.progress === 100) barClass += " completed";
                      else if (task.isBlocked) barClass += " delayed";
                      else if (task.isDelayed || id === "99") barClass += " delayed";
                      else if (task.isShifted) barClass += " shifted";

                      const leftVal = task.startOffset;
                      const widthVal = Math.max(10, task.duration * 7.14);

                      return (
                        <div key={id} className="gantt-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '8px 0' }}>
                          <div className="gantt-task-info" onClick={() => handleEditTask(id)} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span className="badge badge-info" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>{task.quincena || 'Q1'}</span>
                              <span className="gantt-task-name" style={{ fontWeight: 700 }}>{task.name}</span>
                              {task.isBlocked && (
                                <span className="badge badge-danger" style={{ fontSize: '0.65rem', animation: 'pulse 1.5s infinite' }}>
                                  <i className="fa-solid fa-ban"></i> Pendiente Materiales
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                              <span><i className="fa-solid fa-user" style={{ fontSize: '0.6rem', marginRight: '3px' }}></i>{task.assignee}</span>
                              {task.supplierName && (
                                <span><i className="fa-solid fa-truck" style={{ fontSize: '0.6rem', marginRight: '3px' }}></i>{task.supplierName} ({task.supplierStatus || 'Confirmado'})</span>
                              )}
                            </div>
                          </div>
                          <div className="gantt-task-bar-container">
                            <div className={barClass} id={`gantt-bar-${id}`} style={{ left: `${leftVal}%`, width: `${widthVal}%` }} onClick={() => handleEditTask(id)}>
                              <div className="gantt-bar-progress" id={`gantt-bar-progress-${id}`} style={{ width: `${task.progress}%` }}></div>
                              <span className="gantt-bar-text" id={`gantt-bar-text-${id}`}>
                                {task.name} ({task.progress}%) {task.isBlocked ? '⛔ Bloqueada' : ''}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Action Controls & Task Editor Cards */}
              <div className="gantt-editor-card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', marginTop: '24px' }}>
                {Object.keys(state.tasks).map(id => {
                  const task = state.tasks[id];
                  return (
                    <div key={id} className="glass-panel-premium dashboard-card-hover" style={{ padding: '14px', marginBottom: 0, display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: task.isBlocked ? '3px solid var(--danger)' : '3px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span className="badge badge-info" style={{ fontSize: '0.65rem', marginRight: '6px' }}>{task.quincena || 'Q1'}</span>
                          <strong style={{ fontSize: '0.85rem', color: task.isBlocked ? 'var(--danger)' : 'var(--primary)' }}>{task.name}</strong>
                        </div>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => handleEditTask(id)}><i className="fa-solid fa-cog"></i> Configurar</span>
                      </div>

                      {task.isBlocked && (
                        <div style={{ background: 'rgba(239,68,68,0.1)', padding: '6px 8px', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.2)', fontSize: '0.75rem', color: 'var(--danger)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>⛔ Bloqueada por retraso de proveedor</span>
                          <button 
                            className="btn btn-sm btn-success" 
                            onClick={() => handleConfirmSupplier("prov-4")}
                            style={{ fontSize: '0.65rem', padding: '2px 6px' }}
                          >
                            Desbloquear
                          </button>
                        </div>
                      )}

                      <div className="editor-control">
                        <label style={{ fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>Progreso: <strong>{task.progress}%</strong></label>
                        <input type="range" min="0" max="100" value={task.progress} onChange={(e) => updateGanttTaskSlider(id, 'progress', e.target.value)} />
                      </div>
                      <div className="editor-control">
                        <label style={{ fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>Duración: <strong>{task.duration} días</strong></label>
                        <input type="range" min="1" max="10" value={task.duration} onChange={(e) => updateGanttTaskSlider(id, 'duration', e.target.value)} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* SECTION 4: SUPER ADMIN MULTITENANT CONSOLE */}
          <section id="sec-admin" className={`content-section animate-fade-in-up ${activeTab === 'sec-admin' ? 'active' : ''}`}>
            <div className="section-header">
              <div className="header-title">
                <h1>Consola Multitenant de Super Admin</h1>
                <p>Gestión global de licencias, CRM comercial, tickets de soporte y métricas analíticas del negocio en Argentina.</p>
              </div>
              <div className="header-actions">
                <button className="btn btn-primary" onClick={simulateBillingCycle} disabled={billingCycleRunning}>
                  {billingCycleRunning ? <><i className="fa-solid fa-spinner fa-spin"></i> Procesando...</> : <><i className="fa-solid fa-credit-card"></i> Ejecutar Facturación Mensual</>}
                </button>
              </div>
            </div>

            {/* Admin CRM Stats Grid */}
            <div className="grid-4" style={{ marginBottom: '24px' }}>
              <div className="glass-panel-premium dashboard-card-hover stat-card" style={{ marginBottom: 0 }}>
                <div className="stat-icon primary"><i className="fa-solid fa-hotel"></i></div>
                <div className="stat-content">
                  <span className="stat-value">28</span>
                  <span className="stat-label">Suscripciones</span>
                </div>
              </div>
              <div className="glass-panel-premium dashboard-card-hover stat-card" style={{ marginBottom: 0 }}>
                <div className="stat-icon success"><i className="fa-solid fa-money-bill-trend-up"></i></div>
                <div className="stat-content">
                  <span className="stat-value" id="val-mrr">{state.subscription?.plan === 'Enterprise' ? "$5.030.000 ARS" : "$4.850.000 ARS"}</span>
                  <span className="stat-label">MRR Recurrente</span>
                </div>
              </div>
              <div className="glass-panel-premium dashboard-card-hover stat-card" style={{ marginBottom: 0 }}>
                <div className="stat-icon info"><i className="fa-solid fa-user-tag"></i></div>
                <div className="stat-content">
                  <span className="stat-value">{state.crmLeads.length}</span>
                  <span className="stat-label">Leads Activos</span>
                </div>
              </div>
              <div className="glass-panel-premium dashboard-card-hover stat-card" style={{ marginBottom: 0 }}>
                <div className="stat-icon danger" style={{ background: state.crmTickets.length > 3 ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.02)' }}><i className="fa-solid fa-ticket"></i></div>
                <div className="stat-content">
                  <span className="stat-value">{state.crmTickets.length}</span>
                  <span className="stat-label">Tickets Abiertos</span>
                </div>
              </div>
            </div>

            {/* MRR & KPIs Row */}
            <div className="grid-2" style={{ marginBottom: '24px' }}>
              <div className="glass-panel-premium dashboard-card-hover" style={{ marginBottom: 0 }}>
                <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '8px', color: 'var(--primary)' }}><i className="fa-solid fa-chart-line"></i> Evolución de Ingresos Recurrentes (MRR)</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '16px' }}>
                  Facturación mensual acumulada de licencias de estudios y constructoras en Argentina.
                </p>
                <div className="chart-container" style={{ height: '200px', position: 'relative' }}>
                  <canvas ref={mrrChartRef}></canvas>
                </div>
              </div>

              <div className="glass-panel-premium dashboard-card-hover" style={{ marginBottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '8px', color: 'var(--success)' }}><i className="fa-solid fa-chart-pie"></i> KPIs de Negocio &amp; Retención</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '16px' }}>
                    Indicadores clave de performance de la plataforma comercial.
                  </p>
                </div>
                <div className="grid-2" style={{ gap: '16px', marginBottom: 0, gridTemplateColumns: '1fr 1fr' }}>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid var(--success)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Retención (SLA)</span>
                    <strong style={{ fontSize: '1.25rem', fontFamily: 'var(--font-heading)', display: 'block' }}>100%</strong>
                    <span style={{ fontSize: '0.65rem', color: 'var(--success)' }}>Churn Rate: 0%</span>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid var(--info)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Conversión Leads</span>
                    <strong style={{ fontSize: '1.25rem', fontFamily: 'var(--font-heading)', display: 'block' }}>24%</strong>
                    <span style={{ fontSize: '0.65rem', color: 'var(--info)' }}>+4.2% este mes</span>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid var(--warning)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Tck. Resueltos</span>
                    <strong style={{ fontSize: '1.25rem', fontFamily: 'var(--font-heading)', display: 'block' }}>92.5%</strong>
                    <span style={{ fontSize: '0.65rem', color: 'var(--warning)' }}>SLA &lt; 2hs</span>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid var(--primary)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Crecimiento MRR</span>
                    <strong style={{ fontSize: '1.25rem', fontFamily: 'var(--font-heading)', display: 'block' }}>+15.4%</strong>
                    <span style={{ fontSize: '0.65rem', color: 'var(--primary)' }}>Proyección Q3</span>
                  </div>
                </div>
              </div>
            </div>

            {/* CRM Chat and Subscriptions */}
            <div className="grid-2" style={{ marginBottom: '24px' }}>
              {/* AI CRM Chatbot */}
              <div className="glass-panel-premium dashboard-card-hover">
                <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '8px', color: 'var(--primary)' }}><i className="fa-solid fa-chart-pie"></i> Consultor Financiero &amp; Leads (AI CRM)</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '12px' }}>
                  Hazle consultas directas a la IA del negocio para auditar métricas financieras y conversiones.
                </p>

                <div className="crm-chat-box">
                  <div className="crm-chat-messages" style={{ overflowY: 'auto' }}>
                    {crmMessages.map((msg, i) => (
                      <div key={i} style={{ 
                        background: msg.sender === 'user' ? 'var(--primary-glow)' : 'rgba(255,255,255,0.03)', 
                        padding: '8px 12px', 
                        borderRadius: '8px', 
                        alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start', 
                        maxWidth: '90%',
                        fontSize: '0.8rem',
                        whiteSpace: 'pre-wrap',
                        color: '#fff'
                      }}>
                        {msg.text.replace(/\*\*/g, '')}
                      </div>
                    ))}
                    <div ref={crmMessagesEndRef}></div>
                  </div>
                  <div className="crm-chat-input-container">
                    <input 
                      type="text" 
                      className="crm-chat-input" 
                      placeholder="Pregunta sobre MRR, leads o tickets..." 
                      value={crmInput}
                      onChange={(e) => setCrmInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && sendCrmUserMessage()}
                    />
                    <button className="crm-chat-btn" onClick={sendCrmUserMessage}>Consultar</button>
                  </div>
                </div>

                <div className="crm-suggestions">
                  <span className="crm-suggest-tag" onClick={() => { setCrmInput("Suscripciones de este mes"); setTimeout(sendCrmUserMessage, 50); }}>Suscripciones de este mes</span>
                  <span className="crm-suggest-tag" onClick={() => { setCrmInput("Leads y consultas comerciales"); setTimeout(sendCrmUserMessage, 50); }}>Leads y consultas comerciales</span>
                  <span className="crm-suggest-tag" onClick={() => { setCrmInput("Tickets de soporte abiertos"); setTimeout(sendCrmUserMessage, 50); }}>Tickets de soporte abiertos</span>
                </div>
              </div>

              {/* Active Subscriptions list */}
              <div className="glass-panel-premium dashboard-card-hover">
                <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '16px' }}>Suscripciones de Estudios</h3>
                <table className="billing-table">
                  <thead>
                    <tr>
                      <th>Estudio / Constructora</th>
                      <th>Plan</th>
                      <th>Costo</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>Estudio BMA</strong></td>
                      <td><span className="badge badge-info">Enterprise</span></td>
                      <td>$350.000</td>
                      <td><span className="badge badge-success">Pagado</span></td>
                    </tr>
                    <tr>
                      <td><strong>MSGSSV</strong></td>
                      <td><span className="badge badge-info">Enterprise</span></td>
                      <td>$350.000</td>
                      <td><span className="badge badge-success">Pagado</span></td>
                    </tr>
                    <tr>
                      <td><strong>Estudio Clorindo Testa</strong></td>
                      <td><span className="badge badge-warning">Pro</span></td>
                      <td>$180.000</td>
                      <td><span className="badge badge-success">Pagado</span></td>
                    </tr>
                    <tr>
                      <td><strong>Constructora Innovar</strong></td>
                      <td><span className="badge badge-info">Enterprise</span></td>
                      <td>$350.000</td>
                      <td><span className="badge badge-success">Pagado</span></td>
                    </tr>
                    <tr>
                      <td><strong>Estudio MRA+A</strong></td>
                      <td><span className="badge badge-warning">Pro</span></td>
                      <td>$180.000</td>
                      <td>
                        <span className={`badge ${state.subscription?.plan === 'Enterprise' ? 'badge-success' : 'badge-danger'}`}>
                          {state.subscription?.plan === 'Enterprise' ? 'Pagado' : 'Pendiente'}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* CRM Second Row: Leads and Tickets Lists */}
            <div className="grid-2">
              <div className="glass-panel-premium dashboard-card-hover">
                <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-users-rectangle" style={{ color: 'var(--info)' }}></i> Leads de la Web (Consultas Recientes)
                </h3>
                <table className="logs-table">
                  <thead>
                    <tr>
                      <th>Contacto / Empresa</th>
                      <th>Asunto de Interés</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.crmLeads.map((lead, i) => (
                      <tr key={i}>
                        <td><strong>{lead.name}</strong><br/><span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{lead.company}</span></td>
                        <td>{lead.topic}</td>
                        <td><span className={`badge ${lead.status === 'En Contacto' ? 'badge-warning' : 'badge-info'}`}>{lead.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="glass-panel-premium dashboard-card-hover">
                <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-circle-exclamation" style={{ color: 'var(--warning)' }}></i> Tickets de Soporte Activos
                </h3>
                <table className="logs-table">
                  <thead>
                    <tr>
                      <th>Usuario / Empresa</th>
                      <th>Problema Reportado</th>
                      <th>Gravedad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.crmTickets.map((t, i) => (
                      <tr key={i}>
                        <td><strong>{t.client}</strong></td>
                        <td>{t.issue}</td>
                        <td><span className={`badge ${t.severity === 'Alta' ? 'badge-danger' : t.severity === 'Media' ? 'badge-warning' : 'badge-success'}`}>{t.severity}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Operational Proposals Inbox (Maker-Checker Workflow) */}
            <div className="glass-panel-premium dashboard-card-hover" style={{ marginTop: '24px', borderLeft: '4px solid var(--info)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-inbox" style={{ color: 'var(--info)' }}></i> Bandeja de Propuestas Operativas (Maker-Checker)
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>
                    Reportes capturados por audio en WhatsApp que requieren validación y firma de la Directora de Obra para impactar el cronograma.
                  </p>
                </div>
                <span className="badge badge-info">{state.operationalProposals?.length || 0} Propuestas</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {(state.operationalProposals || []).map((prop, idx) => (
                  <div key={prop.id || idx} style={{ background: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span className={`badge ${prop.status === 'APROBADO' ? 'badge-success' : 'badge-warning'}`}>{prop.status}</span>
                        <strong style={{ fontSize: '0.85rem', color: '#fff' }}>{prop.summary}</strong>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        <span><i className="fa-solid fa-user" style={{ marginRight: '4px' }}></i>{prop.proposedBy} ({prop.role})</span> • 
                        <span style={{ marginLeft: '6px' }}><i className="fa-solid fa-clock" style={{ marginRight: '4px' }}></i>{prop.timestamp}</span> • 
                        <span style={{ marginLeft: '6px', color: 'var(--primary)' }}><i className="fa-solid fa-code-branch" style={{ marginRight: '4px' }}></i>Impacto: {prop.taskImpact}</span>
                      </div>
                    </div>

                    {prop.status !== 'APROBADO' && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button 
                          className="btn btn-sm btn-success" 
                          onClick={() => handleApproveProposal(prop.id)}
                          style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                        >
                          <i className="fa-solid fa-check" style={{ marginRight: '4px' }}></i> Aprobar
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Módulo 2B: Catálogo de Proveedores & Notificaciones (7d / 2d) */}
            <div className="glass-panel-premium dashboard-card-hover" style={{ marginTop: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-truck-field" style={{ color: 'var(--primary)' }}></i> Módulo 2B: Notificaciones &amp; Confirmaciones a Proveedores
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>
                    Avisos automáticos 7 días antes de la tarea asignada y confirmación obligatoria 2 días antes para evitar bloqueos en el Gantt.
                  </p>
                </div>
                <span className="badge badge-success"><i className="fa-solid fa-shield-check"></i> Sincronización Automática</span>
              </div>

              <table className="billing-table">
                <thead>
                  <tr>
                    <th>Proveedor / Corralón</th>
                    <th>Categoría</th>
                    <th>Próxima Tarea Programada</th>
                    <th>Aviso Automático (7d antes)</th>
                    <th>Confirmación (2d antes)</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {(state.suppliers || []).map(prov => (
                    <tr key={prov.id}>
                      <td>
                        <strong>{prov.name}</strong><br/>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{prov.email}</span>
                      </td>
                      <td><span className="badge badge-info">{prov.category}</span></td>
                      <td><strong style={{ color: 'var(--primary)' }}>{prov.nextTaskDate}</strong></td>
                      <td>
                        <span className="badge badge-success">
                          <i className="fa-solid fa-paper-plane" style={{ marginRight: '4px' }}></i> {prov.status}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${prov.confirmationStatus?.includes('Confirmado') ? 'badge-success' : prov.confirmationStatus?.includes('Riesgo') ? 'badge-danger' : 'badge-warning'}`}>
                          {prov.confirmationStatus}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button 
                            className="btn btn-sm btn-secondary" 
                            onClick={() => handleNotifySupplier(prov.id)}
                            style={{ fontSize: '0.7rem', padding: '4px 8px' }}
                            title="Enviar notificación por Email y WhatsApp 7 días antes"
                          >
                            <i className="fa-solid fa-envelope"></i> Aviso 7d
                          </button>
                          <button 
                            className="btn btn-sm btn-success" 
                            onClick={() => handleConfirmSupplier(prov.id)}
                            style={{ fontSize: '0.7rem', padding: '4px 8px' }}
                            title="Confirmar recepción y compromiso de entrega 2 días antes"
                          >
                            <i className="fa-solid fa-check-double"></i> Confirmar 2d
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Módulo 4B: Control de Acopios & Fechas Comprometidas de Entrega */}
            <div className="glass-panel-premium dashboard-card-hover" style={{ marginTop: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-cubes-stacked" style={{ color: 'var(--warning)' }}></i> Módulo 4B: Acopios &amp; Fecha de Entrega Comprometida
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>
                    Fechas comprometidas por el proveedor visibles para todo el equipo. Bloqueo automático de tareas dependientes en caso de rotura de stock.
                  </p>
                </div>
                <button className="btn btn-sm btn-primary" onClick={() => setShowReceiveMaterialModal(true)}>
                  <i className="fa-solid fa-dolly"></i> Recibir Material
                </button>
              </div>

              <table className="billing-table">
                <thead>
                  <tr>
                    <th>Material / Insumo</th>
                    <th>Stock Actual / Mínimo</th>
                    <th>Proveedor Responsable</th>
                    <th>Fecha Comprometida</th>
                    <th>Estado de Entrega</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(state.stockpiles || {}).map(key => {
                    const mat = state.stockpiles[key];
                    const isLow = mat.current < mat.min;
                    return (
                      <tr key={key}>
                        <td><strong>{mat.name}</strong></td>
                        <td>
                          <span style={{ fontWeight: 700, color: isLow ? 'var(--danger)' : '#fff' }}>
                            {mat.current} {mat.unit}
                          </span> / {mat.min} {mat.unit}
                        </td>
                        <td>{mat.supplier}</td>
                        <td><strong style={{ color: 'var(--primary)' }}>{mat.confirmedDeliveryDate || '16/08/2026'}</strong></td>
                        <td>
                          <span className={`badge ${mat.status === 'Crítico' ? 'badge-danger' : mat.status === 'Demorado' ? 'badge-warning' : 'badge-success'}`}>
                            {mat.onTimeStatus || mat.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Módulo 8 & 10: Certificaciones Quincenales de Obra */}
            <div className="glass-panel-premium dashboard-card-hover" style={{ marginTop: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-file-signature" style={{ color: 'var(--primary)' }}></i> Módulos 8 &amp; 10: Certificaciones Quincenales de Avance
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>
                    Actas de medición física y financiera quincenales para facturación transparente a propietarios o entes públicos.
                  </p>
                </div>
              </div>

              <div className="grid-2" style={{ gap: '16px' }}>
                {(state.certifications || []).map(cert => (
                  <div key={cert.id} style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '10px', border: cert.approvedByDirector ? '1px solid rgba(16,185,129,0.3)' : '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '0.95rem', color: '#fff' }}>{cert.period}</strong>
                      <span className={`badge ${cert.approvedByDirector ? 'badge-success' : 'badge-warning'}`}>{cert.status}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Avance Físico Medido:</span>
                      <strong>{cert.physicalProgress}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Valor Financiero:</span>
                      <strong style={{ color: 'var(--primary)', fontSize: '1.05rem' }}>{cert.financialValue}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px' }}>
                      <span>Firma Directora: <strong>{cert.directorName}</strong> {cert.approvedByDirector ? '✍️ (Firmado)' : '⏳ (Pendiente)'}</span>
                      {!cert.approvedByDirector && (
                        <button 
                          className="btn btn-sm btn-primary" 
                          onClick={() => handleCertifyQuincena(cert.id)}
                          style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                        >
                          <i className="fa-solid fa-pen-nib" style={{ marginRight: '4px' }}></i> Certificar Quincena
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Módulo 7: Caja Chica & OCR de Comprobantes */}
            <div className="glass-panel-premium dashboard-card-hover" style={{ marginTop: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-receipt" style={{ color: 'var(--info)' }}></i> Módulo 7: Caja Chica &amp; Rendiciones con OCR
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>
                    Control de fondos para compras de ferretería y fletes menores con lectura automática de tickets por visión artificial.
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="badge badge-info">Saldo Actual: ${(state.cajaChica?.saldoActual || 84500).toLocaleString('es-AR')} ARS</span>
                </div>
              </div>

              <table className="billing-table">
                <thead>
                  <tr>
                    <th>Descripción del Gasto</th>
                    <th>Monto</th>
                    <th>Solicitante</th>
                    <th>Fecha</th>
                    <th>Comprobante</th>
                  </tr>
                </thead>
                <tbody>
                  {(state.cajaChica?.movimientos || []).map(mov => (
                    <tr key={mov.id}>
                      <td><strong>{mov.descripcion}</strong></td>
                      <td><strong style={{ color: 'var(--danger)' }}>-${mov.monto.toLocaleString('es-AR')} ARS</strong></td>
                      <td>{mov.solicitante}</td>
                      <td>{mov.fecha}</td>
                      <td>
                        <span className="badge badge-success" style={{ cursor: 'pointer' }}>
                          <i className="fa-solid fa-file-image" style={{ marginRight: '4px' }}></i> Ticket OCR Validado
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Simulation Log */}
            {showBillingLogs && (
              <div className="glass-panel-premium dashboard-card-hover" style={{ borderLeft: '4px solid var(--success)', animation: 'fadeIn 0.3s ease', marginTop: '24px' }}>
                <h4 style={{ fontFamily: 'var(--font-heading)', color: 'var(--success)', marginBottom: '10px' }}><i className="fa-solid fa-cash-register"></i> Logs de Procesamiento de Pago (Simulado)</h4>
                <pre style={{ fontFamily: 'monospace', fontSize: '0.8rem', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', color: '#a3e635', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                  {billingLogs}
                </pre>
              </div>
            )}
          </section>

          {/* SECTION 5: BUDGET & PROPOSAL VIEW */}
          <section id="sec-presupuesto" className={`content-section animate-fade-in-up ${activeTab === 'sec-presupuesto' ? 'active' : ''}`}>
            <div className="section-header">
              <div className="header-title">
                <h1>Presupuesto Formal de Desarrollo</h1>
                <p>Propuesta económica oficial emitida por Innovar Latam para el diseño e implementación del MVP.</p>
              </div>
              <div className="header-actions">
                <button className="btn btn-primary" onClick={handlePrintProposal}><i className="fa-solid fa-print"></i> Imprimir / Exportar a PDF</button>
              </div>
            </div>

            {/* Proposal Stationery Sheet */}
            <div className="formal-proposal-document">
              <div className="document-header">
                <div className="logo-section">
                  <div className="corp-logo">
                    <div className="corp-logo-box">IL</div>
                    Innovar Latam
                  </div>
                  <span className="corp-tagline">Soluciones Tecnológicas &amp; Arquitectura</span>
                </div>
                <div className="doc-info">
                  <h2>Propuesta de Servicios</h2>
                  <strong>REF:</strong> PRO-2026-0428<br/>
                  <strong>FECHA:</strong> 20 de Junio de 2026<br/>
                  <strong>VIGENCIA:</strong> 30 días corridos
                </div>
              </div>

              <div className="doc-recipient">
                <div>
                  <div className="doc-recipient-title">Preparado Para:</div>
                  <div className="doc-recipient-val">Estudio de Arquitectura Asociado</div>
                  <div style={{ color: '#64748b', fontSize: '0.8rem' }}>MVP Validación de Negocio</div>
                </div>
                <div>
                  <div className="doc-recipient-title">Preparado Por:</div>
                  <div className="doc-recipient-val">Ing. Marcelo Guillén</div>
                  <div style={{ color: '#64748b', fontSize: '0.8rem' }}>Director de Tecnología - Innovar Latam</div>
                </div>
              </div>

              <div className="doc-intro">
                <p>
                  Presentamos la cotización de servicios profesionales para el desarrollo, despliegue y puesta en marcha del <strong>MVP (Producto Mínimo Viable) de la plataforma de control de obras "ObraSaaS"</strong>, integrando comandos de voz con inteligencia artificial y cronogramas dinámicos.
                </p>
              </div>

              <div className="doc-section-title">Desglose de Costos de Desarrollo (MVP a Producción)</div>
              <table className="budget-table">
                <thead>
                  <tr>
                    <th>Ítem / Concepto</th>
                    <th>Horas Est.</th>
                    <th>Precio Unitario (ARS)</th>
                    <th>Subtotal (ARS)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <strong>Diseño UX/UI, Prototipado &amp; Arquitectura de Obra</strong><br/>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Diseño móvil y web adaptado a condiciones en obra. Diagramación de base de datos relacional.</span>
                    </td>
                    <td>30</td>
                    <td>$22.000 ARS</td>
                    <td>$660.000 ARS</td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Backend Postgres Serverless (Neon/Prisma ORM) &amp; Geofencing Satelital</strong><br/>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Creación de tablas, migración Prisma, validación de coordenadas por satélite y geocercas del predio.</span>
                    </td>
                    <td>50</td>
                    <td>$23.100 ARS</td>
                    <td>$1.155.000 ARS</td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Webhooks WhatsApp API, Cloudinary Media Setup &amp; Logs</strong><br/>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Configuración de webhooks en la API oficial de WhatsApp, almacenamiento de imágenes y grabaciones en Cloudinary.</span>
                    </td>
                    <td>40</td>
                    <td>$24.625 ARS</td>
                    <td>$985.000 ARS</td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Módulo de Inferencia de Voz IA &amp; Speech-to-Task (ObraSaaS Engine)</strong><br/>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Procesamiento de lenguaje natural y transcripción inteligente de reportes de obra. Clasificación automatizada de tareas y bloqueos.</span>
                    </td>
                    <td>55</td>
                    <td>$25.000 ARS</td>
                    <td>$1.375.000 ARS</td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Despliegue de Producción (Vercel/Cloudflare) &amp; Soporte SLA (30 días)</strong><br/>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Setup de CDN Cloudflare, pipelines automatizados de despliegue en Vercel, pruebas reales y soporte post-lanzamiento.</span>
                    </td>
                    <td>35</td>
                    <td>$23.428,57 ARS</td>
                    <td>$820.000 ARS</td>
                  </tr>
                  <tr className="budget-total-row">
                    <td colSpan="3" style={{ textAlign: 'right' }}>Total Cotización MVP Listo para Producción (ARS):</td>
                    <td>$4.995.000 ARS</td>
                  </tr>
                </tbody>
              </table>

              <div className="doc-section-title">Hitos y Plan de Trabajo (Plazo Acotado: 4 Semanas)</div>
              <div className="milestones-timeline">
                <div className="milestone-item">
                  <div className="milestone-badge">Hito 1</div>
                  <div className="milestone-desc">
                    <h4>Semana 1: Arquitectura y Diseño UX/UI (30% del Pago)</h4>
                    <p>Aprobación del prototipo visual de pantallas, wireframes optimizados para obra y diagramación inicial de base de datos relacional.</p>
                  </div>
                </div>
                <div className="milestone-item">
                  <div className="milestone-badge">Hito 2</div>
                  <div className="milestone-desc">
                    <h4>Semana 2-3: Backend Cloud &amp; Conectividad de WhatsApp con IA (40% del Pago)</h4>
                    <p>Montaje de base de datos Neon con Prisma. Conexión de webhooks de la API de WhatsApp, procesamiento de audio-a-texto e inteligencia artificial para alertas críticas.</p>
                  </div>
                </div>
                <div className="milestone-item">
                  <div className="milestone-badge">Hito 3</div>
                  <div className="milestone-desc">
                    <h4>Semana 4: Dashboard Gantt Reactivo, PDF &amp; Despliegue en Producción (30% del Pago)</h4>
                    <p>Implementación final del cronograma Gantt dinámico en el Dashboard administrativo, compilación de reportes semanales en PDF, despliegue seguro a producción en Vercel con Cloudflare y capacitación final del equipo.</p>
                  </div>
                </div>
              </div>

              <div className="doc-section-title">Evolución y Escalabilidad Futura (SaaS Corporativo)</div>
              <p style={{ fontSize: '0.85rem', color: '#334155', marginBottom: '24px', lineHeight: '1.6' }}>
                El presente prototipo interactivo (MVP) valida y demuestra en tiempo real la Landing Page con el <strong>Avatar Comercial de Ventas</strong>, el control integrado de <strong>Acopios y Suministros</strong> y la <strong>Generación de Reportes Ejecutivos en PDF</strong>. El ecosistema está arquitectónicamente listo para escalar a un SaaS a través de:
                <br/><br/>
                • <strong>Automatización de Compras &amp; Integración IoT</strong>: Enlace directo del módulo de acopios con balanzas digitales de silos de cemento o tags RFID en corralón de obra, disparando órdenes de compra automáticas vía API de WhatsApp a proveedores homologados cuando el stock alcance niveles críticos.
                <br/>
                • <strong>Trazabilidad Satelital de Suministros (GPS)</strong>: Vinculación del mapa de control con localizadores GPS de transportes y camiones de hormigón para auditar hora de salida, paradas intermedias y tiempo exacto estimado de arribo a obra.
                <br/>
                • <strong>Ecosistema Móvil Novedoso Multirubro</strong>: Desarrollo de aplicaciones nativas Android/iOS con soporte offline robusto (mediante bases de datos embebidas tipo SQLite/WatermelonDB) para registrar fichajes e incidencias en subsuelos o zonas sin cobertura móvil.
              </p>

              <div className="doc-section-title">Condiciones de Servicio (SLA) &amp; Garantías</div>
              <p style={{ fontSize: '0.85rem', color: '#334155', marginBottom: '24px' }}>
                - <strong>Disponibilidad del Sistema (SLA)</strong>: Compromiso de disponibilidad de la base de datos Postgres del 99.9% mensual.<br/>
                - <strong>Soporte Post-Entrega</strong>: Incluye 30 días de soporte técnico gratuito para corregir posibles bugs y dar capacitación a los operarios en obra.<br/>
                - <strong>Propiedad Intelectual</strong>: El código fuente desarrollado del MVP será de propiedad exclusiva del cliente una vez saldada la totalidad de la propuesta.
              </p>

              <div className="signatures-container">
                <div className="signature-block">
                  <div className="signature-seal">Ing. Marcelo Guillén</div>
                  <div className="signature-line">
                    <span className="signature-title">Ing. Marcelo Guillén</span><br/>
                    <span className="signature-meta">Innovar Latam</span>
                  </div>
                </div>
                <div className="signature-block">
                  <div style={{ height: '40px' }}></div>
                  <div className="signature-line">
                    <span className="signature-title">Firma de Aceptación</span><br/>
                    <span className="signature-meta">Socio / Cliente</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 6: GESTION DE PERSONAL & RRHH */}
          <section id="sec-personal" className={`content-section animate-fade-in-up ${activeTab === 'sec-personal' ? 'active' : ''}`}>
            <div className="section-header">
              <div className="header-title">
                <h1>Gestión de Personal &amp; Recursos Humanos</h1>
                <p>Estadísticas de presentismo, control de asistencia satelital, bonos de incentivos y licencias de la cuadrilla.</p>
              </div>
              <div className="header-actions">
                <span className="badge badge-success"><i className="fa-solid fa-users"></i> Cuadrilla Activa</span>
              </div>
            </div>

            <div className="grid-3">
              {/* Empleado del Mes */}
              <div className="glass-panel-premium dashboard-card-hover" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '8px', color: 'var(--primary)' }}><i className="fa-solid fa-award"></i> Empleado del Mes</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '20px' }}>
                    Reconocimiento automático de IA basado en presentismo, puntualidad y tareas completadas en Gantt.
                  </p>
                  
                  <div style={{ background: 'rgba(255, 159, 28, 0.05)', border: '1px solid var(--primary)', padding: '20px', borderRadius: '12px', textAlign: 'center', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: '-10px', right: '-10px', background: 'var(--primary)', color: 'var(--bg-main)', width: '30px', height: '30px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', boxShadow: '0 0 10px var(--primary-glow)' }}>
                      <i className="fa-solid fa-crown" style={{ fontSize: '0.8rem' }}></i>
                    </div>
                    <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: '#475569', backgroundImage: 'url(\'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23ffffff"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>\')', backgroundSize: '40px', backgroundRepeat: 'no-repeat', backgroundPosition: 'center', margin: '0 auto 12px auto', border: '3px solid var(--primary)', boxShadow: '0 0 15px rgba(255, 159, 28, 0.3)' }}></div>
                    <h4 style={{ fontFamily: 'var(--font-heading)', color: '#fff', marginBottom: '4px' }}>Juan Gómez</h4>
                    <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase' }}>Albañilería Principal</span>
                    <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '15px', borderTop: '1px solid var(--border-color)', paddingTop: '12px', fontSize: '0.75rem' }}>
                      <div>
                        <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Asistencia</span>
                        <strong style={{ color: 'var(--success)', fontSize: '0.9rem' }}>100%</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Tareas</span>
                        <strong style={{ color: '#fff', fontSize: '0.9rem' }}>2 Hechas</strong>
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: '20px', fontSize: '0.7rem', color: 'var(--text-secondary)', textAlign: 'center', fontStyle: 'italic' }}>
                  Premio mensual: Bono de $35.000 ARS y canasta de herramientas.
                </div>
              </div>

              {/* Incentives / Bonuses */}
              <div className="glass-panel-premium dashboard-card-hover" style={{ display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '8px', color: 'var(--success)' }}><i className="fa-solid fa-gift"></i> Premios &amp; Bonos Asignados</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '16px' }}>
                  Incentivos cargados para motivar el cumplimiento de plazos del cronograma.
                </p>
                
                <div style={{ flexGrow: 1, overflowY: 'auto', maxHeight: '180px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                  {state.hrBonuses.map((bonus, i) => (
                    <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', padding: '10px 14px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', color: '#fff' }}>{bonus.name}</span>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>{bonus.type}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: 800, display: 'block' }}>{bonus.amount}</span>
                        <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{bonus.date}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <select value={hrBonusAssignee} onChange={(e) => setHrBonusAssignee(e.target.value)} className="form-control" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: '8px', padding: '6px 10px', fontSize: '0.75rem', flexGrow: 1, width: '50%' }}>
                      <option value="Juan Gómez">Juan Gómez</option>
                      <option value="Luis Martínez">Luis Martínez</option>
                      <option value="Carlos Pérez">Carlos Pérez</option>
                    </select>
                    <select value={hrBonusType} onChange={(e) => setHrBonusType(e.target.value)} className="form-control" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: '8px', padding: '6px 10px', fontSize: '0.75rem', flexGrow: 1, width: '50%' }}>
                      <option value="Bono de Puntualidad">Bono Puntualidad ($15.000)</option>
                      <option value="Premio Velocidad Gantt">Premio Velocidad ($20.000)</option>
                      <option value="Presentismo Perfecto">Presentismo Perfecto ($25.000)</option>
                    </select>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={handleAwardBonus} style={{ width: '100%', padding: '8px', fontSize: '0.75rem', fontWeight: 700, border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                    <i className="fa-solid fa-plus"></i> Otorgar Incentivo / Bono
                  </button>
                </div>
              </div>

              {/* Medical Licences */}
              <div className="glass-panel-premium dashboard-card-hover">
                <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '8px', color: 'var(--info)' }}><i className="fa-solid fa-notes-medical"></i> Licencias &amp; Certificados Médicos</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '16px' }}>
                  Registra certificados médicos recibidos por WhatsApp para justificar ausencias en presentismo.
                </p>
                
                <form onSubmit={handleSubmitMedicalCert} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Seleccionar Operario</label>
                    <select value={hrMedAssignee} onChange={(e) => setHrMedAssignee(e.target.value)} className="form-control" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: '8px', padding: '8px 12px', fontSize: '0.8rem', outline: 'none' }} required>
                      <option value="Carlos Pérez">Carlos Pérez (Ausente)</option>
                      <option value="Luis Martínez">Luis Martínez</option>
                      <option value="Juan Gómez">Juan Gómez</option>
                    </select>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '10px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Diagnóstico</label>
                      <input type="text" placeholder="Ej. Gripe / Esguince" value={hrMedDiagnosis} onChange={(e) => setHrMedDiagnosis(e.target.value)} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: '8px', padding: '8px 12px', fontSize: '0.8rem', outline: 'none' }} required />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Días</label>
                      <select value={hrMedDays} onChange={(e) => setHrMedDays(e.target.value)} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: '8px', padding: '8px 12px', fontSize: '0.8rem', outline: 'none' }}>
                        <option value="1 día">1 día</option>
                        <option value="2 días">2 días</option>
                        <option value="3 días">3 días</option>
                        <option value="5 días">5 días</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Foto del Certificado (.jpg/.pdf)</label>
                    <div style={{ border: '1px dashed var(--border-color)', borderRadius: '8px', padding: '12px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.15)', cursor: 'pointer' }} onClick={() => document.getElementById('hr-file-input').click()}>
                      <i className="fa-solid fa-cloud-arrow-up" style={{ fontSize: '1.2rem', color: 'var(--info)', marginBottom: '4px', display: 'block' }}></i>
                      <span>{hrMedFileName}</span>
                      <input type="file" id="hr-file-input" style={{ display: 'none' }} onChange={handleMedicalFileSelected} />
                    </div>
                  </div>
                  <button type="submit" className="btn btn-secondary" style={{ background: 'var(--info-bg)', border: '1px solid var(--info)', color: 'var(--info)', width: '100%', padding: '10px', fontSize: '0.8rem', fontWeight: 700, borderRadius: '8px', cursor: 'pointer' }}>
                    <i className="fa-solid fa-file-circle-check"></i> Cargar Licencia &amp; Justificar Faltas
                  </button>
                </form>
              </div>
            </div>

            {/* Centro de Verificación KYC & Identidad Biometría */}
            <div className="glass-panel-premium dashboard-card-hover" style={{ marginTop: '24px' }}>
              <div className="section-header" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', color: 'var(--primary)' }}>
                    <i className="fa-solid fa-id-card-clip"></i> Centro de Verificación KYC &amp; Identidad Biometría
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    Auditoría estricta de identidad: validación de DNI mediante OCR, biometría facial (liveness check), geocerca satelital y enrolamiento vocal.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <a href="/webview/kyc" target="_blank" className="btn btn-primary btn-sm" style={{ padding: '8px 14px', fontSize: '0.75rem', fontWeight: 700, borderRadius: '8px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <i className="fa-solid fa-user-plus"></i> Abrir Portal KYC Móvil
                  </a>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '10px' }}>Operario / Legajo</th>
                      <th style={{ padding: '10px' }}>DNI / CUIL</th>
                      <th style={{ padding: '10px' }}>Documento DNI</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Facial Match</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Voz Enrolada</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Geocerca GPS</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Estado KYC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.values(state.kycVerifications || {}).map((kyc, kIndex) => {
                      const isVerified = kyc.status === 'VERIFICADO';
                      return (
                        <tr key={kyc.workerId || kIndex} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundImage: `url(${kyc.selfieUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80'})`, backgroundSize: 'cover', backgroundPosition: 'center', border: `2px solid ${isVerified ? 'var(--success)' : '#64748b'}` }}></div>
                              <div>
                                <strong style={{ display: 'block', color: '#fff' }}>{kyc.workerName}</strong>
                                <span style={{ fontSize: '0.7rem', color: 'var(--primary)' }}>{kyc.trade}</span>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '10px' }}>
                            <span style={{ fontWeight: 700, color: '#fff', display: 'block' }}>{kyc.dni}</span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{kyc.phone || '+54 9 11 ...'}</span>
                          </td>
                          <td style={{ padding: '10px' }}>
                            {kyc.dniFrontUrl ? (
                              <span style={{ color: 'var(--success)', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <i className="fa-solid fa-file-check"></i> OCR Validado
                              </span>
                            ) : (
                              <span style={{ color: '#ef4444', fontSize: '0.8rem' }}>
                                <i className="fa-solid fa-clock"></i> Pendiente
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>
                            {kyc.faceMatchScore > 0 ? (
                              <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>
                                {kyc.faceMatchScore}% ✓
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>--</span>
                            )}
                          </td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>
                            {kyc.voiceSampleEnrolled ? (
                              <span style={{ color: '#38bdf8' }}><i className="fa-solid fa-microphone-lines"></i> Sí</span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>No</span>
                            )}
                          </td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>
                            {kyc.geofenceRadiusValid ? (
                              <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>En Radio (0-100m)</span>
                            ) : (
                              <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>Sin GPS</span>
                            )}
                          </td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>
                            <span className={`badge ${isVerified ? 'badge-success' : 'badge-warning'}`}>
                              {kyc.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Auditoría de Pólizas ART & IERIC (Ley 22.250 / Res. SRT 299/11) */}
            <div className="glass-panel-premium dashboard-card-hover" style={{ marginTop: '24px' }}>
              <div className="section-header" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', color: '#f59e0b' }}>
                    <i className="fa-solid fa-shield-halved"></i> Auditoría de Pólizas ART &amp; IERIC (Ley 22.250 / Res. SRT 299/11)
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    Control estricto de cobertura de riesgos del trabajo. Bloqueo preventivo automático ante pólizas vencidas o falta de Cláusula de No Repetición.
                  </p>
                </div>
                <span className="badge badge-warning" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid #f59e0b' }}>
                  <i className="fa-solid fa-file-shield"></i> Exigencia Legal de Ingreso
                </span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '10px' }}>Operario</th>
                      <th style={{ padding: '10px' }}>Compañía ART</th>
                      <th style={{ padding: '10px' }}>N° de Póliza</th>
                      <th style={{ padding: '10px' }}>Vencimiento</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Cláusula No Repetición</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Estado Cobertura</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(state.artPolicies || {}).map((wName) => {
                      const policy = state.artPolicies[wName];
                      const isVigente = policy.status === 'VIGENTE';
                      return (
                        <tr key={wName} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '10px' }}><strong style={{ color: '#fff' }}>{wName}</strong></td>
                          <td style={{ padding: '10px', color: '#38bdf8' }}>{policy.company}</td>
                          <td style={{ padding: '10px', fontFamily: 'monospace' }}>{policy.policyNumber}</td>
                          <td style={{ padding: '10px', color: isVigente ? '#fff' : '#ef4444', fontWeight: isVigente ? 'normal' : 'bold' }}>{policy.expirationDate}</td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>
                            {policy.clausulaNoRepeticion ? (
                              <span style={{ color: '#22c55e', fontWeight: 'bold' }}>✓ Incluida</span>
                            ) : (
                              <span style={{ color: '#ef4444' }}>✗ Faltante</span>
                            )}
                          </td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>
                            <span className={`badge ${isVigente ? 'badge-success' : 'badge-danger'}`}>
                              {policy.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Attendance History */}
            <div className="glass-panel-premium dashboard-card-hover" style={{ marginTop: '24px' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '12px', color: '#fff' }}><i className="fa-solid fa-calendar-check"></i> Historial de Presentismo &amp; Licencias de la Obra</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '10px' }}>Operario</th>
                      <th style={{ padding: '10px' }}>Rol</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Asistencias</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Faltas Justificadas</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Faltas Injustificadas</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Estado Actual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(state.hrAttendance).map(name => {
                      const item = state.hrAttendance[name];
                      const currentAtt = state.attendance[name] || {};
                      
                      let statusBadge = <span className="badge badge-warning">Ausente</span>;
                      if (currentAtt.status === 'Presente' || currentAtt.status.includes('GPS')) {
                        statusBadge = <span className="badge badge-success">Presente</span>;
                      } else if (currentAtt.status.includes('Justificado')) {
                        statusBadge = <span className="badge badge-info">Licencia</span>;
                      }

                      return (
                        <tr key={name} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '10px' }}><strong>{name}</strong></td>
                          <td style={{ padding: '10px' }}>{item.role}</td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>{item.presents}</td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>{item.excused}</td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>{item.unexcused}</td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>{statusBadge}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </main>
      </div>

      {/* Modal: Add Task */}
      {showAddTaskModal && (
        <div className="modal-overlay" style={{ display: 'flex' }}>
          <div className="glass-card modal-content" style={{ maxWidth: '480px', width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', margin: 0 }}>Agregar Nueva Tarea</h3>
              <i className="fa-solid fa-xmark" onClick={() => setShowAddTaskModal(false)} style={{ cursor: 'pointer' }}></i>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Nombre de la Tarea</label>
                <input type="text" className="form-input" placeholder="Ej. Fratachado de Cocina" value={newTaskName} onChange={(e) => setNewTaskName(e.target.value)} />
              </div>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Operario Asignado</label>
                <select className="form-input" value={newTaskAssignee} onChange={(e) => setNewTaskAssignee(e.target.value)}>
                  <option value="Juan Gómez">Juan Gómez (Albañilería)</option>
                  <option value="Luis Martínez">Luis Martínez (Instalaciones)</option>
                  <option value="Carlos Pérez">Carlos Pérez (Pintura)</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Día de Inicio (1-14)</label>
                  <input type="number" min="1" max="14" className="form-input" value={newTaskStart} onChange={(e) => setNewTaskStart(parseInt(e.target.value))} />
                </div>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Duración (días)</label>
                  <input type="number" min="1" max="14" className="form-input" value={newTaskDuration} onChange={(e) => setNewTaskDuration(parseInt(e.target.value))} />
                </div>
              </div>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Progreso Inicial (%)</label>
                <input type="range" min="0" max="100" className="form-input" style={{ background: 'transparent' }} value={newTaskProgress} onChange={(e) => setNewTaskProgress(parseInt(e.target.value))} />
              </div>
              <button className="btn btn-primary" onClick={handleAddNewTask} style={{ marginTop: '10px' }}>Guardar Tarea</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Task */}
      {showEditTaskModal && (
        <div className="modal-overlay" style={{ display: 'flex' }}>
          <div className="glass-card modal-content" style={{ maxWidth: '480px', width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', color: 'var(--primary)', margin: 0 }}><i className="fa-solid fa-pen-to-square"></i> Editar Tarea</h3>
              <i className="fa-solid fa-xmark modal-close-btn" onClick={() => setShowEditTaskModal(false)} style={{ cursor: 'pointer', fontSize: '1.2rem', color: 'var(--text-secondary)' }}></i>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Nombre de la Tarea</label>
                <input type="text" className="form-input" value={editTaskName} onChange={(e) => setEditTaskName(e.target.value)} />
              </div>
              
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Operario Asignado</label>
                <select className="form-input" value={editTaskAssignee} onChange={(e) => setEditTaskAssignee(e.target.value)}>
                  <option value="Juan Gómez">Juan Gómez (Albañilería)</option>
                  <option value="Luis Martínez">Luis Martínez (Instalaciones)</option>
                  <option value="Carlos Pérez">Carlos Pérez (Pintura)</option>
                </select>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Día de Inicio (1-14)</label>
                  <input type="number" min="1" max="14" className="form-input" value={editTaskStart} onChange={(e) => setEditTaskStart(parseInt(e.target.value))} />
                </div>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Duración (días)</label>
                  <input type="number" min="1" max="14" className="form-input" value={editTaskDuration} onChange={(e) => setEditTaskDuration(parseInt(e.target.value))} />
                </div>
              </div>
              
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Progreso ({editTaskProgress}%)</label>
                <input type="range" min="0" max="100" className="form-input" style={{ background: 'transparent' }} value={editTaskProgress} onChange={(e) => setEditTaskProgress(parseInt(e.target.value))} />
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                <button className="btn btn-danger btn-sm" onClick={handleDeleteTask} style={{ padding: '8px 16px', fontSize: '0.8rem' }}><i className="fa-solid fa-trash"></i> Eliminar</button>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowEditTaskModal(false)} style={{ padding: '8px 16px', fontSize: '0.8rem' }}>Cancelar</button>
                  <button className="btn btn-primary btn-sm" onClick={handleSaveEditedTask} style={{ padding: '8px 16px', fontSize: '0.8rem' }}>Guardar</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Receive Material */}
      {showReceiveMaterialModal && (
        <div className="modal-overlay" style={{ display: 'flex' }}>
          <div className="glass-card modal-content" style={{ maxWidth: '480px', width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', color: 'var(--primary)', margin: 0 }}><i className="fa-solid fa-truck-ramp-box"></i> Registrar Recepción</h3>
              <i className="fa-solid fa-xmark modal-close-btn" onClick={() => setShowReceiveMaterialModal(false)} style={{ cursor: 'pointer', fontSize: '1.2rem', color: 'var(--text-secondary)' }}></i>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Material / Insumo</label>
                <select className="form-input" value={receiveMaterialKey} onChange={(e) => setReceiveMaterialKey(e.target.value)}>
                  <option value="cemento">Cemento Loma Negra (Bolsas)</option>
                  <option value="hierro">Hierro A500 Acindar (Barras)</option>
                  <option value="ladrillo">Ladrillo Portante Alberdi (Unidades)</option>
                  <option value="arena">Arena Fina Cantera (m³)</option>
                </select>
              </div>
              
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Cantidad Recibida</label>
                <input type="number" min="1" className="form-input" value={receiveMaterialQty} onChange={(e) => setReceiveMaterialQty(e.target.value)} />
              </div>

              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Remito / Número de Factura</label>
                <input type="text" placeholder="Ej. REM-004-98122" className="form-input" value={receiveMaterialInvoice} onChange={(e) => setReceiveMaterialInvoice(e.target.value)} />
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowReceiveMaterialModal(false)} style={{ padding: '8px 16px', fontSize: '0.8rem' }}>Cancelar</button>
                <button className="btn btn-primary btn-sm" onClick={handleSaveReceivedMaterial} style={{ padding: '8px 16px', fontSize: '0.8rem' }}>Registrar Entrada</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Weekly report preview */}
      {showWeeklyReportModal && (
        <div className="modal-overlay" style={{ display: 'flex' }}>
          <div className="glass-card modal-content" style={{ maxWidth: '800px', width: '95%', maxHeight: '90vh', overflowY: 'auto', padding: '40px', background: 'var(--bg-surface)', backdropFilter: 'blur(20px)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }} className="no-print">
              <h3 style={{ fontFamily: 'var(--font-heading)', color: 'var(--primary)', margin: 0 }}><i className="fa-solid fa-file-invoice"></i> Vista Previa del Reporte de Obra</h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-primary btn-sm" onClick={handlePrintWeeklyReport} style={{ padding: '6px 12px', fontSize: '0.75rem', fontWeight: 700 }}><i className="fa-solid fa-print"></i> Imprimir / PDF</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowWeeklyReportModal(false)} style={{ padding: '6px 12px', fontSize: '0.75rem', fontWeight: 600 }}><i className="fa-solid fa-xmark"></i> Cerrar</button>
              </div>
            </div>
            
            {/* Printable Report body */}
            <div id="weekly-report-print-area" style={{ color: '#0f172a', background: '#fff', padding: '30px', borderRadius: '8px' }}>
              <div style={{ fontFamily: "'Inter', 'Outfit', sans-serif", color: '#1e293b', lineHeight: 1.5, padding: '15px', maxWidth: '740px', margin: '0 auto', background: '#fff' }}>
                
                {/* Header logo */}
                <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#ffffff', padding: '20px 25px', borderRadius: '10px', marginBottom: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ width: '42px', height: '42px', background: 'linear-gradient(135deg, #ff9f1c 0%, #ff6b35 100%)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontFamily: "'Outfit', sans-serif", fontSize: '1.3rem' }}>OS</div>
                    <div>
                      <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>ObraSaaS</h1>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginTop: '3px' }}>Innovar Latam • Reporte de Dirección</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#cbd5e1', lineHeight: 1.4 }}>
                    <span style={{ background: 'rgba(255, 159, 28, 0.2)', color: '#ff9f1c', padding: '3px 8px', borderRadius: '6px', fontWeight: 700, display: 'inline-block', marginBottom: '6px', fontSize: '0.65rem' }}>Auditoría Semanal</span><br/>
                    <strong>Fecha:</strong> {weeklyReportDetails.todayStr}
                  </div>
                </div>

                {/* Details grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px', marginBottom: '25px', fontSize: '0.8rem', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px 18px', borderRadius: '8px' }}>
                  <div>
                    <span style={{ color: '#64748b', fontWeight: 600, display: 'inline-block', width: '90px' }}>PROYECTO:</span> <strong style={{ color: '#0f172a' }}>Edificio Palermo Chico</strong><br/>
                    <span style={{ color: '#64748b', fontWeight: 600, display: 'inline-block', width: '90px' }}>UBICACIÓN:</span> <strong style={{ color: '#0f172a' }}>Palermo, CABA</strong>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ color: '#64748b', fontWeight: 600 }}>AUDITOR:</span> <strong style={{ color: '#0f172a' }}>Arq. Marcelo (Director)</strong><br/>
                    <span style={{ color: '#64748b', fontWeight: 600 }}>EMPRESA:</span> <strong style={{ color: '#0f172a' }}>Innovar Latam S.A.</strong>
                  </div>
                </div>

                {/* AI Summary */}
                <div style={{ background: 'linear-gradient(180deg, rgba(255, 159, 28, 0.04) 0%, rgba(255, 159, 28, 0.01) 100%)', borderLeft: '5px solid #ff9f1c', padding: '18px', borderRadius: '4px 10px 10px 4px', marginBottom: '30px', borderTop: '1px solid rgba(255, 159, 28, 0.08)', borderRight: '1px solid rgba(255, 159, 28, 0.08)', borderBottom: '1px solid rgba(255, 159, 28, 0.08)' }}>
                  <h4 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '0.85rem', color: '#d97706', margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 700 }}>
                    ⭐ RESUMEN DIRECTIVO IA (PREDICCIÓN GEORREFERENCIADA)
                  </h4>
                  <p style={{ fontSize: '0.85rem', color: '#334155', margin: 0, lineHeight: 1.6, fontStyle: 'italic', fontWeight: 500 }}>
                    "{weeklyReportDetails.aiSummaryText}"
                  </p>
                </div>

                {/* Costs analytics */}
                <div style={{ marginBottom: '35px' }}>
                  <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '0.95rem', borderBottom: '2px solid #cbd5e1', paddingBottom: '6px', color: '#0f172a', marginBottom: '15px', fontWeight: 700 }}>
                    CONTROL FINANCIERO Y PRESUPUESTO
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 700, display: 'block', textTransform: 'uppercase' }}>Presupuesto</span>
                      <strong style={{ fontSize: '0.9rem', color: '#0f172a', display: 'block' }}>${weeklyReportDetails.totalBudget.toLocaleString('es-AR')}</strong>
                      <span style={{ fontSize: '0.55rem', color: '#10b981', fontWeight: 700, background: '#e6f4ea', padding: '1px 6px', borderRadius: '4px', display: 'inline-block', marginTop: '4px' }}>Bloqueado</span>
                    </div>
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 700, display: 'block', textTransform: 'uppercase' }}>Ejecutado</span>
                      <strong style={{ fontSize: '0.9rem', color: '#ff9f1c', display: 'block' }}>${weeklyReportDetails.executedBudget.toLocaleString('es-AR')}</strong>
                      <span style={{ fontSize: '0.6rem', color: '#64748b', display: 'block', marginTop: '4px' }}>Físico: {state.avancePercentage}%</span>
                    </div>
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 700, display: 'block', textTransform: 'uppercase' }}>Disponible</span>
                      <strong style={{ fontSize: '0.9rem', color: '#3b82f6', display: 'block' }}>${weeklyReportDetails.remainingBudget.toLocaleString('es-AR')}</strong>
                      <span style={{ fontSize: '0.6rem', color: '#3b82f6', display: 'block', marginTop: '4px' }}>Por liberar</span>
                    </div>
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 700, display: 'block', textTransform: 'uppercase' }}>Transcurrido</span>
                      <strong style={{ fontSize: '0.9rem', color: '#0f172a', display: 'block' }}>{weeklyReportDetails.currentDay} Días</strong>
                      <span style={{ fontSize: '0.55rem', color: '#ef4444', fontWeight: 700, background: '#fce8e6', padding: '1px 6px', borderRadius: '4px', display: 'inline-block', marginTop: '4px' }}>Tiempo: {weeklyReportDetails.timelinePercentage}%</span>
                    </div>
                  </div>
                </div>

                {/* Tasks table */}
                <div style={{ marginBottom: '25px' }}>
                  <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '0.95rem', borderBottom: '2px solid #cbd5e1', paddingBottom: '6px', color: '#0f172a', marginBottom: '12px', fontWeight: 700 }}>
                    ESTADO DE TAREAS Y DESEMPEÑO
                  </h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                        <th style={{ padding: '8px', fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>Tarea</th>
                        <th style={{ padding: '8px', fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>Responsable</th>
                        <th style={{ padding: '8px', fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>Progreso</th>
                        <th style={{ padding: '8px', fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>Duración</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.keys(state.tasks).map(id => {
                        const task = state.tasks[id];
                        let progressColor = '#f59e0b';
                        if (task.progress === 100) progressColor = '#10b981';
                        else if (task.progress === 0) progressColor = '#94a3b8';

                        return (
                          <tr key={id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '10px 8px', fontSize: '0.8rem', fontWeight: 600 }}>{task.name}</td>
                            <td style={{ padding: '10px 8px', fontSize: '0.8rem', color: '#475569' }}>{task.assignee}</td>
                            <td style={{ padding: '10px 8px', fontSize: '0.8rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '80px', background: '#cbd5e1', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                                  <div style={{ width: `${task.progress}%`, background: progressColor, height: '100%' }}></div>
                                </div>
                                <span style={{ fontWeight: 700, color: progressColor }}>{task.progress}%</span>
                              </div>
                            </td>
                            <td style={{ padding: '10px 8px', fontSize: '0.8rem', fontWeight: 600 }}>{task.duration} días</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Stockpile table */}
                <div style={{ marginBottom: '25px' }}>
                  <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '0.95rem', borderBottom: '2px solid #cbd5e1', paddingBottom: '6px', color: '#0f172a', marginBottom: '12px', fontWeight: 700 }}>
                    CONTROL DE LOGÍSTICA E INSUMOS
                  </h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                        <th style={{ padding: '8px', fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>Material</th>
                        <th style={{ padding: '8px', fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>Stock Actual</th>
                        <th style={{ padding: '8px', fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>Proveedor</th>
                        <th style={{ padding: '8px', fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.keys(state.stockpiles).map(key => {
                        const item = state.stockpiles[key];
                        let statusColor = '#137333';
                        let statusBg = '#e6f4ea';
                        if (item.status === 'Crítico') { statusColor = '#c5221f'; statusBg = '#fce8e6'; }
                        if (item.status === 'En Camino') { statusColor = '#1a73e8'; statusBg = '#e8f0fe'; }

                        return (
                          <tr key={key} style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '10px 8px', fontSize: '0.8rem', fontWeight: 600 }}>{item.name}</td>
                            <td style={{ padding: '10px 8px', fontSize: '0.8rem', fontWeight: 700 }}>{item.current.toLocaleString('es-AR')} {item.unit}</td>
                            <td style={{ padding: '10px 8px', fontSize: '0.8rem', color: '#475569' }}>{item.supplier}</td>
                            <td style={{ padding: '10px 8px', fontSize: '0.8rem' }}>
                              <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 700, color: statusColor, background: statusBg }}>{item.status}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Safety & Incident Notes */}
                <div style={{ marginBottom: '30px' }}>
                  <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '0.95rem', borderBottom: '2px solid #cbd5e1', paddingBottom: '6px', color: '#0f172a', marginBottom: '12px', fontWeight: 700 }}>
                    SEGURIDAD DE OBRA Y BITÁCORA IA
                  </h3>
                  {state.incidents.length === 0 ? (
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '12px', borderRadius: '8px', color: '#166534', fontSize: '0.8rem' }}>
                      No se registraron desvíos logísticos ni incidencias críticas en el periodo semanal. Obra operando en curso nominal.
                    </div>
                  ) : (
                    <ul style={{ paddingLeft: '20px', margin: 0, fontSize: '0.8rem', color: '#334155' }}>
                      {state.incidents.slice(0, 4).map((inc, i) => (
                        <li key={i} style={{ marginBottom: '6px' }}>
                          <strong style={{ color: inc.type === 'critical' ? '#ef4444' : inc.type === 'warning' ? '#f59e0b' : '#10b981' }}>{inc.title}</strong>: {inc.description} ({inc.timestamp})
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Signatures */}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #cbd5e1', paddingTop: '20px', marginTop: '30px' }}>
                  <div>
                    <strong style={{ fontSize: '0.8rem', color: '#0f172a' }}>Arq. Marcelo (Director)</strong><br/>
                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Innovar Latam S.A.</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ borderBottom: '1px solid #cbd5e1', width: '120px', height: '24px' }}></div>
                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Firma del Inspector de Obra</span>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clerk Auth Simulation Modal */}
      {clerkModalOpen && (
        <div className="clerk-modal-overlay" id="clerk-dashboard-modal" style={{ display: 'flex', zIndex: 9999 }}>
          <div className="clerk-card" style={{ background: '#0d1222', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', width: '420px', padding: '36px', position: 'relative', color: '#fff' }}>
            <div style={{ position: 'absolute', top: '16px', right: '16px', cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setClerkModalOpen(false)}>
              <i className="fa-solid fa-xmark" style={{ fontSize: '1.2rem' }}></i>
            </div>
            
            <div className="clerk-header" style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div className="clerk-badge" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '4px 12px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 600, display: 'inline-block', marginBottom: '12px' }}>Seguridad por Clerk.com</div>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>Iniciar Sesión en ObraSaaS</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Accede a tus paneles de control de obra georreferenciados.</p>
            </div>

            <button className="clerk-social-btn" onClick={handleClerkSubmit} style={{ display: 'flex', alignItems: 'center', justify: 'center', gap: '10px', width: '100%', padding: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', borderRadius: '10px', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', marginBottom: '12px' }}>
              <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" width="16" alt="Google" />
              <span>Continuar con Google</span>
            </button>
            <button className="clerk-social-btn" onClick={handleClerkSubmit} style={{ display: 'flex', alignItems: 'center', justify: 'center', gap: '10px', width: '100%', padding: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', borderRadius: '10px', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', marginBottom: '12px' }}>
              <img src="https://upload.wikimedia.org/wikipedia/commons/b/b8/2021_Facebook_icon.svg" width="16" alt="Facebook" />
              <span>Continuar con Facebook</span>
            </button>

            <div className="clerk-divider" style={{ display: 'flex', alignItems: 'center', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.75rem', margin: '20px 0' }}>o correo electrónico</div>

            <form onSubmit={handleClerkSubmit}>
              <div className="form-group" style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Correo Electrónico</label>
                <input type="email" className="form-control" placeholder="arquitecto@estudio.com" value={clerkEmail} onChange={(e) => setClerkEmail(e.target.value)} style={{ background: 'rgba(0, 0, 0, 0.25)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px 16px', color: '#fff', fontSize: '0.9rem', outline: 'none' }} required />
              </div>
              <div className="form-group" style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Contraseña</label>
                <input type="password" className="form-control" placeholder="••••••••" value={clerkPassword} onChange={(e) => setClerkPassword(e.target.value)} style={{ background: 'rgba(0, 0, 0, 0.25)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px 16px', color: '#fff', fontSize: '0.9rem', outline: 'none' }} required />
              </div>
              <button type="submit" className="clerk-btn" style={{ background: 'var(--primary)', color: 'var(--bg-main)', width: '100%', padding: '12px', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', marginTop: '10px' }}>Ingresar</button>
            </form>
          </div>
        </div>
      )}

      {/* Styled JSX for local overlay overrides */}
      <style dangerouslySetInnerHTML={{ __html: `
        .gantt-row-grid-bg {
            position: absolute;
            top: 0;
            left: 220px;
            right: 0;
            bottom: 0;
            display: grid;
            grid-template-columns: repeat(14, 1fr);
            pointer-events: none;
            z-index: 0;
        }
        .gantt-grid-line {
            border-right: 1px solid rgba(255, 255, 255, 0.03);
            height: 100%;
        }
        .gantt-grid-line.weekend-grid {
            background: rgba(255, 255, 255, 0.01);
        }
        .gantt-dependency-svg {
            position: absolute;
            top: 0;
            left: 220px;
            width: calc(100% - 220px);
            height: 100%;
            pointer-events: none;
            z-index: 1;
        }
        .crm-chat-box {
            display: flex;
            flex-direction: column;
            height: 250px;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 12px;
            border: 1px solid var(--border-color);
            overflow: hidden;
        }
        .crm-chat-messages {
            flex-grow: 1;
            padding: 14px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 10px;
            font-size: 0.8rem;
        }
        .crm-chat-input-container {
            display: flex;
            border-top: 1px solid var(--border-color);
            background: rgba(0, 0, 0, 0.1);
        }
        .crm-chat-input {
            flex-grow: 1;
            background: transparent;
            border: none;
            padding: 10px 14px;
            color: #fff;
            font-size: 0.8rem;
            outline: none;
        }
        .crm-chat-btn {
            background: var(--primary);
            color: var(--bg-main);
            border: none;
            padding: 0 16px;
            cursor: pointer;
            font-weight: 600;
            font-size: 0.8rem;
        }
        .crm-suggestions {
            display: flex;
            gap: 8px;
            margin-top: 10px;
            flex-wrap: wrap;
        }
        .crm-suggest-tag {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--border-color);
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 0.7rem;
            color: var(--text-secondary);
            cursor: pointer;
            transition: var(--transition-smooth);
        }
        .crm-suggest-tag:hover {
            border-color: var(--primary);
            color: var(--text-primary);
        }
        #map {
            height: 260px;
            width: 100%;
            border-radius: 12px;
            border: 1px solid var(--border-color);
            margin-bottom: 16px;
            z-index: 10;
        }
        .copilot-chat-box {
            display: flex;
            flex-direction: column;
            height: 220px;
            background: rgba(0, 0, 0, 0.25);
            border-radius: 12px;
            border: 1px solid var(--border-color);
            overflow: hidden;
            margin-bottom: 12px;
        }
        .copilot-chat-messages {
            flex-grow: 1;
            padding: 12px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 8px;
            font-size: 0.8rem;
        }
        .copilot-chat-input-container {
            display: flex;
            border-top: 1px solid var(--border-color);
        }
        .copilot-chat-input {
            flex-grow: 1;
            background: transparent;
            border: none;
            padding: 8px 12px;
            color: #fff;
            font-size: 0.8rem;
            outline: none;
        }
        .copilot-chat-btn {
            background: var(--primary);
            color: var(--bg-main);
            border: none;
            padding: 0 12px;
            cursor: pointer;
            font-weight: 600;
            font-size: 0.8rem;
        }

        /* Responsive Layout Overrides for Print Mode */
        @media print {
            body.print-proposal-mode .app-container,
            body.print-proposal-mode .mobile-header,
            body.print-report-mode .app-container,
            body.print-report-mode .mobile-header,
            .no-print {
                display: none !important;
            }
            body.print-proposal-mode .formal-proposal-document,
            body.print-report-mode #weekly-report-print-area {
                display: block !important;
                position: absolute;
                left: 0;
                top: 0;
                width: 100% !important;
                max-width: 100% !important;
                background: #fff !important;
                color: #000 !important;
                padding: 0 !important;
                box-shadow: none !important;
                border: none !important;
                z-index: 99999 !important;
            }
            body {
                background: #fff !important;
                color: #000 !important;
            }
            /* Reset dark theme CSS variables during printing */
            :root {
                --bg-main: #fff !important;
                --text-primary: #000 !important;
                --border-color: #e2e8f0 !important;
            }
        }
      ` }} />
    </>
  );
}
