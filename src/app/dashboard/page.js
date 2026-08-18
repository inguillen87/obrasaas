"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import WeatherRadar from './components/WeatherRadar';
import GanttChart from './components/GanttChart';
import ChatSimulator from './components/ChatSimulator';
import PersonalHR from './components/PersonalHR';

import AdminPanel from './components/AdminPanel';
// Minimal loading skeleton — real state arrives via SSE within milliseconds
// Single source of truth: src/lib/db.js (defaultAppState)
const initialAppState = {
  operariosCount: 0,
  avancePercentage: 0,
  alertsCount: 0,
  diasEstimados: "Cargando...",
  currentQuincena: "Cargando...",
  activeProjectId: "",
  projects: [],
  projectConfig: { name: "Cargando...", city: "", province: "", latitude: -34.5886, longitude: -58.4302, geofenceRadiusMeters: 100 },
  workerRegistry: [],
  tasks: {},
  incidents: [],
  attendance: {},
  stockpiles: {},
  suppliers: [],
  certifications: [],
  operationalProposals: [],
  cajaChica: { saldoActual: 0, fondoInicial: 0, moneda: "ARS", umbralAlerta: 0, movimientos: [] },
  crmLeads: [],
  crmTickets: [],
  hrAttendance: {},
  hrBonuses: [],
  kycVerifications: {},
  remitos: [],
  sitePhotos: [],
  artPolicies: {},
  auditLedger: [],
  subscription: { status: "active", plan: "Pro", expiresAt: "" }
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
  const [showForensicCertModal, setShowForensicCertModal] = useState(false);
  const [selectedForecastDay, setSelectedForecastDay] = useState(null);

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
  
  const copilotMessagesEndRef = useRef(null);
  const crmMessagesEndRef = useRef(null);

  
  
  
  
  

  // Real-Time Socket/SSE Connection State (Zero DB Polling)
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [weatherTelemetry, setWeatherTelemetry] = useState(null);

  // Fetch Weather Telemetry (reactive to active project)
  useEffect(() => {
    const lat = state.projectConfig?.latitude || -34.5886;
    const lon = state.projectConfig?.longitude || -58.4302;
    const city = state.projectConfig?.city || '';
    const name = state.projectConfig?.name || '';
    fetch(`/api/weather?lat=${lat}&lon=${lon}&city=${encodeURIComponent(city)}&name=${encodeURIComponent(name)}`)
      .then(res => res.json())
      .then(data => setWeatherTelemetry(data))
      .catch(err => console.warn("Failed to load weather telemetry:", err));
  }, [state.activeProjectId, state.projectConfig?.city]);

  // Fetch initial state & setup Real-Time SSE Stream + Polling Fallback
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
    // Real-Time Server-Sent Events Stream (SSE) + Polling Fallback for Serverless
    let eventSource = null;
    let reconnectTimer = null;
    let pollTimer = null;
    let sseActive = false;

    // Polling fallback: fetch state every 5s when SSE is disconnected
    const startPollingFallback = () => {
      if (pollTimer) return;
      pollTimer = setInterval(async () => {
        if (sseActive) {
          clearInterval(pollTimer);
          pollTimer = null;
          return;
        }
        try {
          const res = await fetch('/api/state');
          if (res.ok) {
            const data = await res.json();
            if (data) setState(data);
          }
        } catch (err) { /* silent */ }
      }, 5000);
    };

    const connectRealtime = () => {
      try {
        if (eventSource) eventSource.close();

        eventSource = new EventSource('/api/realtime?tenant=default');

        eventSource.addEventListener('init', (e) => {
          try {
            const payload = JSON.parse(e.data);
            if (payload?.data?.state) setState(payload.data.state);
            if (payload?.data?.messages) setChatMessages(payload.data.messages);
            setRealtimeConnected(true);
            sseActive = true;
            if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
          } catch (err) { console.warn("SSE init parse error:", err); }
        });

        eventSource.addEventListener('update', (e) => {
          try {
            const payload = JSON.parse(e.data);
            if (payload?.type === 'STATE_UPDATE' || payload?.type === 'STATE_RESET') {
              if (payload.data) setState(payload.data);
            } else if (payload?.type === 'MESSAGE_RECEIVED') {
              if (payload.data) setChatMessages(payload.data);
            }
            setRealtimeConnected(true);
          } catch (err) { console.warn("SSE update parse error:", err); }
        });

        eventSource.onopen = () => { setRealtimeConnected(true); sseActive = true; };

        eventSource.onerror = () => {
          setRealtimeConnected(false);
          sseActive = false;
          if (eventSource) { eventSource.close(); eventSource = null; }
          startPollingFallback();
          clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(connectRealtime, 5000);
        };
      } catch (err) {
        console.warn("Realtime connection error:", err);
        setRealtimeConnected(false);
        startPollingFallback();
      }
    };

    connectRealtime();

    return () => {
      if (eventSource) eventSource.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (pollTimer) clearInterval(pollTimer);
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

      const activeLat = state.projectConfig?.latitude || -34.5886;
      const activeLon = state.projectConfig?.longitude || -58.4302;
      const currentSite = [activeLat, activeLon];
      const geofenceRadius = state.projectConfig?.geofenceRadiusMeters || 80;

      mapInstance = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false
      }).setView(currentSite, 17);

      const tileUrl = isLightTheme
        ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

      tileLayer = L.tileLayer(tileUrl, {
        maxZoom: 20
      }).addTo(mapInstance);

      // Virtual geofence (green boundary)
      L.circle(currentSite, {
        color: '#10b981',
        fillColor: '#10b981',
        fillOpacity: 0.12,
        radius: geofenceRadius
      }).addTo(mapInstance);

      // Coordinates for employees (anchored dynamically to active site)
      const workerCoords = {
        "Juan Gómez": { lat: activeLat + 0.0002, lng: activeLon - 0.0002, role: "Albañilería Principal" },
        "Carlos Pérez": { lat: activeLat, lng: activeLon, role: "Pintura e Interiores" },
        "Luis Martínez": { lat: activeLat - 0.0002, lng: activeLon + 0.0002, role: "Instalaciones y Sanitarios" }
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
          { lat: activeLat, lng: activeLon, radius: geofenceRadius * 0.75, opacity: 0.45 },
          { lat: activeLat + 0.0002, lng: activeLon - 0.0002, radius: geofenceRadius * 0.45, opacity: 0.30 }
        ];

        if (state.attendance["Luis Martínez"]?.status?.includes("Presente")) {
          heatSpots.push({ lat: activeLat - 0.0002, lng: activeLon + 0.0002, radius: geofenceRadius * 0.45, opacity: 0.30 });
        }
        if (state.attendance["Carlos Pérez"]?.status?.includes("Presente")) {
          heatSpots.push({ lat: activeLat, lng: activeLon, radius: geofenceRadius * 0.55, opacity: 0.35 });
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
  }, [activeTab, isLightTheme, mapMode, state.attendance, state.projectConfig, state.activeProjectId]);

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
        aiSummaryText = `La obra "${state.projectConfig?.name || 'Obra'}" se desenvuelve bajo condiciones óptimas de eficiencia, alcanzando un progreso físico consolidado del ${progressVal}%. La cuadrilla registra un presentismo perfecto del 100% de los operarios reportados. El inventario de acopios se mantiene estable sin desvíos presupuestarios ni de entrega de materiales. Se aconseja continuar con las etapas de cañería y preparación de revoques según el cronograma previsto.`;
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
            <li style={{ padding: '8px 16px', fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700, marginTop: '8px' }}>Enterprise</li>
            <li className="nav-item">
              <Link href="/costos" style={{ textDecoration: 'none', display: 'block', width: '100%' }}>
                <button style={{ textAlign: 'left', width: '100%' }}><i className="fa-solid fa-coins"></i> Control de Costos</button>
              </Link>
            </li>
            <li className="nav-item">
              <Link href="/ejecutivo" style={{ textDecoration: 'none', display: 'block', width: '100%' }}>
                <button style={{ textAlign: 'left', width: '100%' }}><i className="fa-solid fa-briefcase"></i> Dashboard CEO</button>
              </Link>
            </li>
            <li className="nav-item">
              <Link href="/portal" style={{ textDecoration: 'none', display: 'block', width: '100%' }}>
                <button style={{ textAlign: 'left', width: '100%' }}><i className="fa-solid fa-building"></i> Portal Inversor</button>
              </Link>
            </li>
            <li className="nav-item">
              <Link href="/superadmin" style={{ textDecoration: 'none', display: 'block', width: '100%' }}>
                <button style={{ textAlign: 'left', width: '100%' }}><i className="fa-solid fa-shield-halved"></i> Super Admin</button>
              </Link>
            </li>
            <li className="nav-item">
              <Link href="/api-docs" style={{ textDecoration: 'none', display: 'block', width: '100%' }}>
                <button style={{ textAlign: 'left', width: '100%' }}><i className="fa-solid fa-code"></i> API Docs</button>
              </Link>
            </li>
            <li className="nav-item">
              <Link href="/marketplace" style={{ textDecoration: 'none', display: 'block', width: '100%' }}>
                <button style={{ textAlign: 'left', width: '100%' }}><i className="fa-solid fa-store"></i> Marketplace</button>
              </Link>
            </li>
            <li className="nav-item">
              <Link href="/compliance" style={{ textDecoration: 'none', display: 'block', width: '100%' }}>
                <button style={{ textAlign: 'left', width: '100%' }}><i className="fa-solid fa-scale-balanced"></i> Compliance</button>
              </Link>
            </li>
            <li className="nav-item">
              <Link href="/bim" style={{ textDecoration: 'none', display: 'block', width: '100%' }}>
                <button style={{ textAlign: 'left', width: '100%' }}><i className="fa-solid fa-cube"></i> Visor 3D BIM</button>
              </Link>
            </li>
            <li className="nav-item">
              <Link href="/planos" style={{ textDecoration: 'none', display: 'block', width: '100%' }}>
                <button style={{ textAlign: 'left', width: '100%' }}><i className="fa-solid fa-compass-drafting"></i> Visor Planos 2D</button>
              </Link>
            </li>
            <li className="nav-item">
              <Link href="/poster" style={{ textDecoration: 'none', display: 'block', width: '100%' }}>
                <button style={{ textAlign: 'left', width: '100%' }}><i className="fa-solid fa-qrcode"></i> Cartel de Obra QR</button>
              </Link>
            </li>
            <li className="nav-item">
              <Link href="/licitaciones" style={{ textDecoration: 'none', display: 'block', width: '100%' }}>
                <button style={{ textAlign: 'left', width: '100%' }}><i className="fa-solid fa-landmark"></i> Licitómetro Público</button>
              </Link>
            </li>
            <li className="nav-item">
              <Link href="/pricing" style={{ textDecoration: 'none', display: 'block', width: '100%' }}>
                <button style={{ textAlign: 'left', width: '100%' }}><i className="fa-solid fa-tag"></i> Precios</button>
              </Link>
            </li>
          </nav>
          
          <div className="sidebar-footer">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary)', color: 'var(--bg-main)', fontWeight: 800, display: 'flex', alignItems: 'center', fontSize: '0.85rem', flexShrink: 0, justifyContent: 'center' }}>{(state.projectConfig?.director?.name || 'M')[0]}</div>
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexGrow: 1 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', color: '#fff' }}>{state.projectConfig?.director?.name || 'Director'}</span>
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

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {/* Multi-Obra Dynamic Project Switcher */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '8px', padding: '4px 10px' }}>
                <span style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 700 }}>
                  <i className="fa-solid fa-city"></i> Obra:
                </span>
                <select 
                  value={state.activeProjectId || state.projectConfig?.id || "obra-palermo-01"}
                  onChange={async (e) => {
                    const selectedId = e.target.value;
                    try {
                      const res = await fetch('/api/project', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ projectId: selectedId })
                      });
                      const d = await res.json();
                      if (d.success && d.activeProject) {
                        addToast(`📍 Obra cambiada a: ${d.activeProject.name} (${d.activeProject.city})`, 'success');
                        // Instantly refresh weather for new project coordinates
                        const wRes = await fetch(`/api/weather?lat=${d.activeProject.latitude}&lon=${d.activeProject.longitude}&name=${encodeURIComponent(d.activeProject.name)}&city=${encodeURIComponent(d.activeProject.city)}`);
                        const wData = await wRes.json();
                        setWeatherTelemetry(wData);
                      }
                    } catch (err) {
                      console.error("Change project error:", err);
                    }
                  }}
                  style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', outline: 'none' }}
                >
                  {(state.projects || [
                    { id: "obra-palermo-01", name: "Torre Palermo Soho", city: "CABA" },
                    { id: "obra-mendoza-02", name: "Complejo Chacras de Coria", city: "Mendoza" },
                    { id: "obra-ushuaia-03", name: "Edificio Fueguino Canal Beagle", city: "Ushuaia" },
                    { id: "obra-cordoba-04", name: "Torre Nueva Córdoba", city: "Córdoba" },
                    { id: "obra-rosario-05", name: "Puerto Norte Muelle", city: "Rosario" }
                  ]).map(p => (
                    <option key={p.id} value={p.id} style={{ background: '#0f172a', color: '#fff' }}>
                      {p.city === 'Mendoza' ? '🏔️' : p.city === 'Ushuaia' ? '❄️' : p.city === 'Córdoba' ? '🏛️' : p.city === 'Rosario' ? '🚢' : '🏢'} {p.name} ({p.city})
                    </option>
                  ))}
                </select>
              </div>

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

            <WeatherRadar weatherTelemetry={weatherTelemetry} setWeatherTelemetry={setWeatherTelemetry} selectedForecastDay={selectedForecastDay} setSelectedForecastDay={setSelectedForecastDay} state={state} addToast={addToast} />

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
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button 
                    onClick={() => setShowForensicCertModal(true)} 
                    className="btn btn-sm"
                    style={{ background: 'rgba(168, 85, 247, 0.15)', border: '1px solid #a855f7', color: '#c084fc', fontSize: '0.78rem', fontWeight: 800, padding: '6px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <i className="fa-solid fa-file-shield"></i> Emitir Acta Pericial Forense
                  </button>
                  <span className="badge badge-success" style={{ background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc', border: '1px solid #a855f7' }}>
                    <i className="fa-solid fa-shield-halved"></i> Integridad 100% Verificada
                  </span>
                </div>
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
          <ChatSimulator activeTab={activeTab} state={state} setState={setState} chatMessages={chatMessages} setChatMessages={setChatMessages} audioData={audioData} addToast={addToast} setCopilotMessages={setCopilotMessages} playBeep={playBeep} />\n\n          {/* SECTION 3: GANTT CHART POR QUINCENAS (v2.0) */}
          <GanttChart state={state} setState={setState} activeTab={activeTab} setShowAddTaskModal={setShowAddTaskModal} setShowEditTaskModal={setShowEditTaskModal} setEditTaskId={setEditTaskId} setEditTaskName={setEditTaskName} setEditTaskAssignee={setEditTaskAssignee} setEditTaskStart={setEditTaskStart} setEditTaskDuration={setEditTaskDuration} setEditTaskProgress={setEditTaskProgress} setShowReceiveMaterialModal={setShowReceiveMaterialModal} setReceiveMaterialKey={setReceiveMaterialKey} addToast={addToast} />

          {/* SECTION 4: SUPER ADMIN MULTITENANT CONSOLE */}
          <AdminPanel 
            state={state}
            setState={setState}
            activeTab={activeTab}
            addToast={addToast}
            simulateBillingCycle={simulateBillingCycle}
            billingCycleRunning={billingCycleRunning}
            mrrChartRef={mrrChartRef}
            crmMessages={crmMessages}
            crmMessagesEndRef={crmMessagesEndRef}
            crmInput={crmInput}
            setCrmInput={setCrmInput}
            sendCrmUserMessage={sendCrmUserMessage}
            handleApproveProposal={handleApproveProposal}
            handleNotifySupplier={handleNotifySupplier}
            handleConfirmSupplier={handleConfirmSupplier}
            setShowReceiveMaterialModal={setShowReceiveMaterialModal}
            handleCertifyQuincena={handleCertifyQuincena}
            showBillingLogs={showBillingLogs}
            billingLogs={billingLogs}
          />

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
          <PersonalHR 
            state={state} 
            setState={setState} 
            activeTab={activeTab} 
            addToast={addToast}
            hrBonusAssignee={hrBonusAssignee}
            setHrBonusAssignee={setHrBonusAssignee}
            hrBonusType={hrBonusType}
            setHrBonusType={setHrBonusType}
            hrMedAssignee={hrMedAssignee}
            setHrMedAssignee={setHrMedAssignee}
            hrMedDiagnosis={hrMedDiagnosis}
            setHrMedDiagnosis={setHrMedDiagnosis}
            hrMedDays={hrMedDays}
            setHrMedDays={setHrMedDays}
            hrMedFileName={hrMedFileName}
            setHrMedFileName={setHrMedFileName}
            handleAwardBonus={handleAwardBonus}
            handleSubmitMedicalCert={handleSubmitMedicalCert}
            handleMedicalFileSelected={handleMedicalFileSelected}
          />
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
                    <span style={{ color: '#64748b', fontWeight: 600, display: 'inline-block', width: '90px' }}>PROYECTO:</span> <strong style={{ color: '#0f172a' }}>{state.projectConfig?.name || 'Torre Palermo Soho'}</strong><br/>
                    <span style={{ color: '#64748b', fontWeight: 600, display: 'inline-block', width: '90px' }}>UBICACIÓN:</span> <strong style={{ color: '#0f172a' }}>{state.projectConfig?.city || 'CABA'}, {state.projectConfig?.province || 'Argentina'}</strong>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ color: '#64748b', fontWeight: 600 }}>AUDITOR:</span> <strong style={{ color: '#0f172a' }}>{state.projectConfig?.director?.name || 'Arq. Marcelo'} (Director)</strong><br/>
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

      {/* Modal: Forensic Digital Legal Audit Certificate (SHA-256) */}
      {showForensicCertModal && (
        <div className="modal-overlay" style={{ display: 'flex', zIndex: 9999 }}>
          <div className="glass-card modal-content" style={{ maxWidth: '840px', width: '95%', maxHeight: '90vh', overflowY: 'auto', padding: '36px', background: 'var(--bg-surface)', backdropFilter: 'blur(20px)', border: '1px solid #a855f7', borderRadius: 'var(--border-radius)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }} className="no-print">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#a855f7', display: 'inline-block' }}></span>
                <h3 style={{ fontFamily: 'var(--font-heading)', color: '#c084fc', margin: 0 }}>
                  <i className="fa-solid fa-file-shield"></i> Acta Pericial Forense Digital (SHA-256)
                </h3>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-primary btn-sm" onClick={() => window.print()} style={{ padding: '6px 14px', fontSize: '0.75rem', fontWeight: 700, background: 'linear-gradient(135deg, #a855f7, #7c3aed)', border: 'none' }}>
                  <i className="fa-solid fa-print"></i> Imprimir / Exportar PDF
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowForensicCertModal(false)} style={{ padding: '6px 12px', fontSize: '0.75rem', fontWeight: 600 }}>
                  <i className="fa-solid fa-xmark"></i> Cerrar
                </button>
              </div>
            </div>
            
            {/* Document Body */}
            <div id="forensic-cert-print-area" style={{ color: '#0f172a', background: '#fff', padding: '32px', borderRadius: '12px', fontFamily: "'Inter', sans-serif" }}>
              {/* Certificate Header */}
              <div style={{ borderBottom: '3px solid #7c3aed', paddingBottom: '16px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#7c3aed', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.5px' }}>
                    Poder Judicial de la Nación / SECLO • Blindaje Probatorio
                  </div>
                  <h1 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0f172a', margin: '4px 0 0 0' }}>
                    ACTA NOTARIAL DE INTEGRIDAD DIGITAL &amp; AUDITORÍA FORENSE
                  </h1>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                    Conforme a la Ley Nacional de Obras 22.250 y Ley de Firma Digital 25.506
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '8px', padding: '6px 12px', display: 'inline-block' }}>
                    <span style={{ fontSize: '0.65rem', color: '#7c3aed', fontWeight: 700, display: 'block' }}>EXPEDIENTE DIGITAL</span>
                    <strong style={{ fontSize: '0.9rem', color: '#5b21b6', fontFamily: 'monospace' }}>OBS-{(state.projectConfig?.id || 'PALERMO-01').toUpperCase()}-{Date.now().toString().slice(-6)}</strong>
                  </div>
                </div>
              </div>

              {/* Project & Legal Details */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', marginBottom: '24px', fontSize: '0.8rem' }}>
                <div>
                  <div style={{ marginBottom: '6px' }}><span style={{ color: '#64748b', fontWeight: 600 }}>Obra / Emplazamiento:</span> <strong style={{ color: '#0f172a' }}>{state.projectConfig?.name || 'Torre Palermo Soho'}</strong></div>
                  <div style={{ marginBottom: '6px' }}><span style={{ color: '#64748b', fontWeight: 600 }}>Jurisdicción / Ciudad:</span> <strong style={{ color: '#0f172a' }}>{state.projectConfig?.city || 'CABA'}, Argentina</strong></div>
                  <div><span style={{ color: '#64748b', fontWeight: 600 }}>Geocerca Satelital:</span> <strong style={{ color: '#0f172a' }}>Radio {state.projectConfig?.geofenceRadiusMeters || 100}m (GPS Haversine)</strong></div>
                </div>
                <div>
                  <div style={{ marginBottom: '6px' }}><span style={{ color: '#64748b', fontWeight: 600 }}>Director Responsable:</span> <strong style={{ color: '#0f172a' }}>Arq. Marcelo (Director de Obra)</strong></div>
                  <div style={{ marginBottom: '6px' }}><span style={{ color: '#64748b', fontWeight: 600 }}>Directora Técnica:</span> <strong style={{ color: '#0f172a' }}>Arq. Victoria</strong></div>
                  <div><span style={{ color: '#64748b', fontWeight: 600 }}>Algoritmo Hash:</span> <strong style={{ color: '#7c3aed', fontFamily: 'monospace' }}>SHA-256 (Merkle Blockchain Tree)</strong></div>
                </div>
              </div>

              {/* Chained Ledger Table */}
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px', borderBottom: '2px solid #e2e8f0', paddingBottom: '6px' }}>
                  Registro Secuencial de Bloques Criptográficos Inmutables
                </h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                      <th style={{ padding: '8px' }}>Bloque</th>
                      <th style={{ padding: '8px' }}>Timestamp</th>
                      <th style={{ padding: '8px' }}>Transacción / Evento</th>
                      <th style={{ padding: '8px' }}>Actor</th>
                      <th style={{ padding: '8px' }}>Hash SHA-256 Certificado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(state.auditLedger || []).map((b, idx) => (
                      <tr key={b.hash || idx} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <td style={{ padding: '8px', fontWeight: 800, color: '#7c3aed' }}>#{b.index}</td>
                        <td style={{ padding: '8px', color: '#64748b' }}>{b.formattedTime || 'Hoy'}</td>
                        <td style={{ padding: '8px', fontWeight: 700, color: '#1e293b' }}>{b.action}</td>
                        <td style={{ padding: '8px', color: '#475569' }}>{b.actor}</td>
                        <td style={{ padding: '8px', fontFamily: 'monospace', color: '#0369a1', fontSize: '0.7rem' }}>
                          {b.hash}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Legal Certification Statement */}
              <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '10px', padding: '16px', marginBottom: '24px', fontSize: '0.75rem', lineHeight: '1.6', color: '#4c1d95' }}>
                <strong>DICTAMEN DE VALIDEZ PROBATORIA:</strong> Se certifica mediante la presente que la secuencia de transacciones operativas, geoposicionamiento satelital, partes de avance quincenal y comprobantes fiscales AFIP-ARCA detallados precedentemente poseen sellado criptográfico encadenado sin solución de continuidad. La alteración de un solo bit en la base de datos invalida matemáticamente la cadena de custodia probatoria.
              </div>

              {/* Signatures & Seal */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '2px solid #cbd5e1', paddingTop: '24px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0f172a' }}>Arq. Marcelo</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Director de Obra • Firma Digital Verificada</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: '60px', height: '60px', border: '2px solid #7c3aed', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: '0 auto 4px auto', background: '#faf5ff' }}>
                    <i className="fa-solid fa-shield-check" style={{ fontSize: '1.8rem', color: '#7c3aed' }}></i>
                  </div>
                  <span style={{ fontSize: '0.65rem', color: '#64748b' }}>Cadena Verificada</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0f172a' }}>ObraSaaS Legal Node v4.0</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Timestamp Server: {new Date().toLocaleDateString('es-AR')}</div>
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
