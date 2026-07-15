"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { OrganizationSwitcher, UserButton, useUser } from '@clerk/nextjs';
import PlatformReadiness from './platform-readiness';

function parseAgenticMessage(message) {
  const text = message.replace(/\*\*/g, '');
  const parts = [];
  let cursor = 0;

  for (const match of text.matchAll(/\[ACTION:(.*?):(.*?)\]/g)) {
    if (match.index > cursor) {
      parts.push({ type: 'text', content: text.slice(cursor, match.index) });
    }

    parts.push({ type: 'action', cmd: match[1], label: match[2] });
    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) {
    parts.push({ type: 'text', content: text.slice(cursor) });
  }

  return { parts, text };
}

const initialAppState = {
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
      cemento: { name: "Cemento Loma Negra", current: 35, min: 40, max: 150, unit: "Bolsas", supplier: "Loma Negra S.A.", status: "Crítico" },
      hierro: { name: "Hierro A500 Acindar", current: 85, min: 30, max: 100, unit: "Barras", supplier: "Acindar Distribuidores", status: "Stock OK" },
      ladrillo: { name: "Ladrillo Portante Alberdi", current: 1500, min: 800, max: 2500, unit: "Uds", supplier: "Ladrillos Alberdi", status: "Stock OK" },
      arena: { name: "Arena Fina Cantera", current: 4, min: 8, max: 20, unit: "m³", supplier: "Cantera Palermo", status: "En Camino" }
  },
  hrAttendance: {
      "Juan Gómez": { role: "Albañilería Principal", presents: 21, excused: 1, unexcused: 0, status: "Presente" },
      "Carlos Pérez": { role: "Pintura e Interiores", presents: 15, excused: 2, unexcused: 5, status: "Ausente" },
      "Luis Martínez": { role: "Instalaciones y Sanitarios", presents: 18, excused: 3, unexcused: 1, status: "Ausente" }
  },
  hrBonuses: [
      { name: "Juan Gómez", type: "Bono Puntualidad", amount: "$25.000 ARS", date: "Hace 2 días" },
      { name: "Luis Martínez", type: "Bono Desempeño", amount: "$45.000 ARS", date: "Hace 1 semana" }
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
  }
};

export default function Dashboard({ platformAccess, initialState, initialMessages, setup }) {
  const { user } = useUser();
  // Application State
  const [state, setState] = useState(initialState || initialAppState);
  const [chatMessages, setChatMessages] = useState(initialMessages || initialChatMessages);
  const [syncState, setSyncState] = useState('live');
  const [lastSyncedAt, setLastSyncedAt] = useState(setup.initialLoadedAt);
  const [activeTab, setActiveTab] = useState('sec-dashboard');
  const [isLightTheme, setIsLightTheme] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mapMode, setMapMode] = useState('sat');

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

  // Audio Playback Waveforms Animation State
  const [playingAudioIndex, setPlayingAudioIndex] = useState(null);

  // Live Toast Notifications State
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);

  const addToast = (message, type = 'info') => {
    toastIdRef.current += 1;
    const id = toastIdRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  // DOM Canvas and Map Container Refs
  const progressChartRef = useRef(null);
  const tasksChartRef = useRef(null);
  const mapContainerRef = useRef(null);
  const svgLinesRef = useRef(null);
  const chatMessagesEndRef = useRef(null);
  const copilotMessagesEndRef = useRef(null);

  const waveformRef1 = useRef(null);
  const waveformRef2 = useRef(null);
  const waveformRef3 = useRef(null);
  const waveformRef4 = useRef(null);
  const waveformRefs = useMemo(
    () => ({ 1: waveformRef1, 2: waveformRef2, 3: waveformRef3, 4: waveformRef4 }),
    [],
  );

  // Refresh tenant-scoped operational data while the app is visible.
  useEffect(() => {
    const initializationFrame = requestAnimationFrame(() => {
      const savedTheme = localStorage.getItem('obrasaas_theme');
      const lightTheme = savedTheme === 'light';
      setIsLightTheme(lightTheme);
      document.body.classList.toggle('light-theme', lightTheme);

      const tabParam = new URLSearchParams(window.location.search).get('tab');
      if (tabParam) setActiveTab(tabParam);
    });

    let active = true;
    let refreshing = false;
    const refreshOperationalData = async () => {
      if (refreshing || document.visibilityState === 'hidden') return;
      refreshing = true;
      setSyncState('syncing');
      try {
        const [stateRes, messagesRes] = await Promise.all([
          fetch('/api/state', { cache: 'no-store' }),
          fetch('/api/whatsapp', { cache: 'no-store' }),
        ]);
        if (!stateRes.ok || !messagesRes.ok) throw new Error('Operational refresh failed.');
        const [stateData, messagesData] = await Promise.all([
          stateRes.json(),
          messagesRes.json(),
        ]);
        if (!active) return;
        setState(stateData);
        setChatMessages(messagesData);
        setLastSyncedAt(new Date().toISOString());
        setSyncState('live');
      } catch (err) {
        if (active) setSyncState('error');
        console.warn('Operational refresh failed:', err);
      } finally {
        refreshing = false;
      }
    };
    const interval = setInterval(refreshOperationalData, 10_000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void refreshOperationalData();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      active = false;
      cancelAnimationFrame(initializationFrame);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // Sync scroll to bottoms on updates
  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    copilotMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [copilotMessages]);

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
          const h = 8 + (Math.sin((i + idx) * 1.7) + 1) * 8;
          const y = (canvas.height - h) / 2;
          ctx.fillRect(x, y, barWidth, h);
        }
      }
    });
  }, [activeTab, waveformRefs]);

  // Audio Playback waveform animation
  useEffect(() => {
    if (playingAudioIndex === null) return;
    const canvas = waveformRefs[playingAudioIndex]?.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationId;
    let progress = 0;
    const heights = Array.from({ length: 40 }, (_, index) => 8 + (Math.sin((index + playingAudioIndex) * 1.7) + 1) * 8);

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
  }, [playingAudioIndex, waveformRefs]);

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
                text: data.text,
                kind: 'audio',
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
  const replayAudio = async (message) => {
    if (message?.id && message.mediaUrl && message.media?.storage?.status === 'stored') {
      try {
        const audio = new Audio(`/api/evidence/${encodeURIComponent(message.id)}`);
        await audio.play();
        return;
      } catch (error) {
        console.error('Protected audio playback failed:', error);
        addToast('No pudimos reproducir la evidencia de audio.', 'warning');
      }
    }
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

    };

    if (activeTab === 'sec-dashboard') {
      buildCharts();
    }

    return () => {
      if (progressChart) progressChart.destroy();
      if (tasksChart) tasksChart.destroy();
    };
  }, [activeTab, isLightTheme, state]);

  // Gantt SVG Dependency Lines Drawer
  const drawGanttDependencyLines = useCallback(() => {
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
  }, [state.tasks]);

  useEffect(() => {
    if (activeTab === 'sec-gantt') {
      setTimeout(drawGanttDependencyLines, 100);
      window.addEventListener('resize', drawGanttDependencyLines);
    }
    return () => window.removeEventListener('resize', drawGanttDependencyLines);
  }, [activeTab, drawGanttDependencyLines]);

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
            reply += `⚠️ **Sugerencia Predictiva**: Conviene revisar la asignación del módulo "Revestimiento" por la ausencia de ${absent[0]}. Puedo crear una solicitud para que el responsable la apruebe.\n[ACTION:CREAR_SOLICITUD_REASIGNACION:Crear solicitud de reasignación]`;
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
            reply += `\n🚨 **Bloqueador Potencial**: El bajo stock de Cemento (35 bolsas) puede retrasar las tareas en 48hs. Recomiendo iniciar una solicitud de compra para aprobación.\n[ACTION:CREAR_SOLICITUD_COMPRA_CEMENTO:Crear solicitud de compra]`;
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
    
    return `Hola, Marcelo. Soy tu Copiloto Inteligente de ObraSaaS. Puedes preguntarme acerca de:\n\n` + 
           `• *¿Quiénes llegaron y quiénes faltaron hoy?*\n` + 
           `• *Dame un resumen de avances frente al Gantt*\n` + 
           `• *¿Existen problemas de stock o alertas de roturas?*\n\n` + 
           `Analizo 140 variables de obra y sensores GPS en vivo.`;
  };

  // Actionable AI (Agentic Workflow Handler)
  const handleAgenticAction = async (actionCmd) => {
    const actions = {
      CREAR_SOLICITUD_REASIGNACION: {
        title: 'Reasignación de cuadrilla pendiente',
        description: 'El Copiloto detectó una ausencia y creó una solicitud para que el responsable revise la asignación de Revestimiento.',
      },
      CREAR_SOLICITUD_COMPRA_CEMENTO: {
        title: 'Compra de cemento pendiente de aprobación',
        description: 'El stock está debajo del mínimo. La solicitud requiere cantidad, proveedor y aprobación antes de emitir cualquier orden.',
      },
    };
    const action = actions[actionCmd];
    if (!action) {
      addToast('Comando de IA no reconocido.', 'warning');
      return;
    }

    const newIncident = {
      id: `approval-${actionCmd.toLowerCase()}-${state.incidents.length + 1}`,
      title: action.title,
      description: action.description,
      type: 'warning',
      badge: 'Requiere aprobación',
      timestamp: 'Recién creada',
      reporter: 'Copiloto IA',
      icon: 'fa-solid fa-clipboard-check',
    };
    const nextState = { ...state, incidents: [newIncident, ...state.incidents] };
    setState(nextState);
    await saveStateToApi(nextState);
    addToast('Solicitud creada. No se ejecutó ninguna acción externa.', 'success');
    setCopilotMessages(prev => [...prev, {
      sender: 'bot',
      text: '✅ Solicitud registrada para aprobación humana. No se emitieron órdenes ni mensajes externos.',
    }]);
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
          text
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
      payload.text = "Documento enviado: planos_palermo_v2.pdf";
      payload.mediaUrl = "planos_palermo_v2.pdf";
      payload.mediaType = "application/pdf";
      payload.kind = "document";
    } else if (type === 'camera') {
      // Multimodal Chaos Tolerance Simulator (Task 4)
      payload.text = "[IMAGEN BORROSA DETECTADA] - Procesando con Visión Multimodal...";
      payload.mediaUrl = "fachada.jpg";
      payload.mediaType = "image/jpeg";
      payload.kind = "image";
      
      addToast('Procesando imagen caótica de WhatsApp mediante IA Multimodal...', 'info');
      
      setTimeout(() => {
        addToast('IA: Muro detectado con 85% de avance. Actualizando Gantt.', 'success');
        setCopilotMessages(prev => [...prev, { sender: 'bot', text: '✅ He analizado la foto borrosa enviada desde la obra. Reconozco que es el frente sur y el muro está al 85%. He actualizado el progreso de "Mampostería" en el Gantt.' }]);
      }, 3000);
      
    } else if (type === 'gallery') {
      payload.text = "Imagen de revoque seleccionada";
      payload.mediaUrl = "revoque.jpg";
      payload.mediaType = "image/jpeg";
      payload.kind = "image";
    } else if (type === 'audio') {
      payload.text = "Audio de obra (5.4s)";
      payload.mediaUrl = "audio.mp3";
      payload.mediaType = "audio/mpeg";
      payload.kind = "audio";
    } else if (type === 'contact') {
      payload.text = "👤 Contacto: Proveedor Arenas";
      payload.mediaUrl = "arenas.vcf";
      payload.mediaType = "text/vcard";
      payload.kind = "document";
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
          {platformAccess.isSuperadmin ? (
            <div className="internal-workspace" aria-label="Workspace interno de plataforma">
              <span className="internal-workspace__eyebrow">Control plane</span>
              <span className="internal-workspace__name">ObraSaaS Operaciones</span>
              <span className="internal-workspace__status">
                <i className="fa-solid fa-shield-halved" aria-hidden="true"></i>
                Workspace interno
              </span>
            </div>
          ) : (
            <div style={{ marginBottom: '16px' }}>
              <OrganizationSwitcher
                hidePersonal
                afterCreateOrganizationUrl="/dashboard"
                afterSelectOrganizationUrl="/dashboard"
                appearance={{
                  elements: {
                    rootBox: { width: '100%' },
                    organizationSwitcherTrigger: {
                      width: '100%',
                      justifyContent: 'space-between',
                      border: '1px solid var(--border-color)',
                      background: 'rgba(255,255,255,0.03)',
                      color: 'var(--text-primary)',
                    },
                  },
                }}
              />
            </div>
          )}
          
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
              <button onClick={() => setActiveTab('sec-whatsapp')}><i className="fa-brands fa-whatsapp"></i> WhatsApp · Demo Lab</button>
            </li>
            <li className={`nav-item ${activeTab === 'sec-gantt' ? 'active' : ''}`}>
              <button onClick={() => setActiveTab('sec-gantt')}><i className="fa-solid fa-timeline"></i> Cronograma Gantt</button>
            </li>
            {platformAccess.isSuperadmin && (
              <li className="nav-item">
                <Link href="/superadmin" style={{ textDecoration: 'none', display: 'block', width: '100%' }}>
                  <button style={{ textAlign: 'left', width: '100%' }}><i className="fa-solid fa-building-user"></i> Consola SuperAdmin</button>
                </Link>
              </li>
            )}
            {(platformAccess.isSuperadmin || platformAccess.tenantRole !== 'AUDITOR') && (
              <li className="nav-item">
                <Link href="/dashboard/team" style={{ textDecoration: 'none', display: 'block', width: '100%' }}>
                  <button style={{ textAlign: 'left', width: '100%' }}><i className="fa-solid fa-user-shield"></i> Equipo y roles</button>
                </Link>
              </li>
            )}
            {(platformAccess.isSuperadmin || ['ADMIN', 'DIRECTOR'].includes(platformAccess.tenantRole)) && (
              <li className="nav-item">
                <Link href="/dashboard/integrations" style={{ textDecoration: 'none', display: 'block', width: '100%' }}>
                  <button style={{ textAlign: 'left', width: '100%' }}><i className="fa-solid fa-plug-circle-bolt"></i> Integraciones</button>
                </Link>
              </li>
            )}
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
                <span style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', color: '#fff' }}>{user?.fullName || user?.primaryEmailAddress?.emailAddress || 'Usuario'}</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                  {platformAccess.organization.name} · {platformAccess.isSuperadmin ? 'Superadmin' : platformAccess.orgRole || 'Miembro'}
                </span>
              </div>
              <UserButton afterSignOutUrl="/" />
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
          <PlatformReadiness
            platformAccess={platformAccess}
            setup={setup}
            syncState={syncState}
            lastSyncedAt={lastSyncedAt}
          />
          
          {/* SECTION 1: DASHBOARD */}
          <section id="sec-dashboard" className={`content-section animate-fade-in-up ${activeTab === 'sec-dashboard' ? 'active' : ''}`}>
            <div className="section-header">
              <div className="header-title">
                <h1>{platformAccess.project.name}</h1>
                <p>{platformAccess.project.address || 'Operación centralizada de la obra activa'} · avance, alertas y evidencia en un solo lugar.</p>
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
                      <i className="fa-solid fa-cube" style={{ color: 'var(--info)' }}></i> Visor BIM · Demo Lab
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>
                      Modelo de muestra para validar capas, interferencias y seguimiento visual antes de conectar el CDE del cliente.
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
                      <span className="badge badge-info"><i className="fa-solid fa-flask"></i> Escenario demostrativo</span>
                      <span style={{ fontSize: '0.8rem', color: '#fff' }}>Sin Autodesk conectado</span>
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
                      const { parts, text } = parseAgenticMessage(msg.text);

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
                        }) : <span style={{ whiteSpace: 'pre-wrap' }}>{text}</span>}
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
                  <i className="fa-solid fa-video"></i> Visión perimetral · Demo Lab
                </h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <span className="badge badge-warning">Escenario EPP</span>
                  <span className="badge badge-info"><i className="fa-solid fa-flask"></i> Cámara no conectada</span>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0' }}>
                <div style={{ height: '350px', background: 'url(/cctv_render.png) center/cover no-repeat', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                </div>
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ borderLeft: '4px solid var(--danger)', paddingLeft: '12px' }}>
                    <strong style={{ color: 'var(--warning)', display: 'block', fontSize: '0.9rem', marginBottom: '4px' }}>CASO DE PRUEBA: EPP</strong>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Simulación de detección de una persona sin casco en una zona restringida.</span>
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={() => addToast('Simulación: el supervisor recibiría una alerta por el canal configurado.', 'info')} style={{ width: '100%' }}>
                    <i className="fa-solid fa-bell"></i> Simular alerta
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => addToast('Simulación: se generaría evidencia para revisión humana antes de guardarla.', 'info')} style={{ width: '100%', marginTop: '8px' }}>
                    <i className="fa-solid fa-file-signature"></i> Simular evidencia
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
                      <th>Operario</th>
                      <th>Especialidad</th>
                      <th>Check-in</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(state.attendance).map(name => {
                      const item = state.attendance[name];
                      let badgeClass = "badge-warning";
                      if (item.status.includes('Presente')) badgeClass = 'badge-success';
                      if (item.status.includes('GPS')) badgeClass = 'badge-info';

                      return (
                        <tr key={name}>
                          <td>{name}</td>
                          <td>{item.role}</td>
                          <td>{item.checkin}</td>
                          <td>
                            {item.status.includes('GPS') ? (
                              <span className="badge badge-success" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa' }}>
                                <i className="fa-solid fa-location-dot" style={{ marginRight: '4px' }}></i> Presente (GPS)
                              </span>
                            ) : (
                              <span className={`badge ${badgeClass}`}>{item.status}</span>
                            )}
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

            {/* Operational capabilities */}
            <div className="glass-panel-premium dashboard-card-hover" style={{ marginTop: '24px' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '16px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fa-solid fa-shield-halved"></i> Capacidades operativas disponibles
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>
                Componentes incorporados al núcleo operativo. Su disponibilidad final depende de los canales y permisos configurados por cada tenant.
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
                <h1>WhatsApp · Demo Lab</h1>
                <p>Probá el flujo operativo sin afectar un número real. Cuando Meta esté conectado, los mensajes reales ingresarán por la integración del tenant.</p>
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
                      <div key={msg.id || msg.externalId || i} className={`message ${msg.sender === 'user' ? 'sent' : 'received'}`}>
                        {msg.text.includes(' plan') || msg.text.includes('Ubicación') || msg.text.includes('🎙️') || msg.text.includes('📍') || msg.text.includes('📸') ? (
                          <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
                        ) : msg.text.startsWith('📄') || msg.text.startsWith('📸') || msg.text.startsWith('🖼️') || msg.text.startsWith('👤') ? (
                          <div>{msg.text}</div>
                        ) : msg.kind === 'audio' || msg.text.includes('Audio de obra') || msg.text.includes('Audio ') ? (
                          <div>
                            <div className="audio-player-container" onClick={() => replayAudio(msg)} style={{ minWidth: '180px', marginBottom: '6px', cursor: 'pointer' }} title="Reproducir audio">
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
                        {msg.id && msg.mediaUrl && msg.media?.storage?.status === 'stored' && msg.kind !== 'audio' && (
                          <a
                            href={`/api/evidence/${encodeURIComponent(msg.id)}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ display: 'inline-flex', marginTop: '8px', color: 'inherit', textDecoration: 'underline' }}
                          >
                            Ver evidencia protegida
                          </a>
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
                    &ldquo;Hola Marcelo, ya entramos a la obra de Palermo. Todo el equipo listo.&rdquo;
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
                    &ldquo;Terminamos el revoque grueso en la cocina y living. Avanzamos según lo planeado.&rdquo;
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
                    &ldquo;Che, Marcelo, detectamos que la cañería de la descarga del baño principal tiene una fisura y pierde agua, hay que cambiar un codo de PVC de 110.&rdquo;
                  </p>
                </div>

                {/* Audio 4 */}
                <div className="glass-panel-premium dashboard-card-hover" style={{ background: 'rgba(255, 255, 255, 0.01)', padding: '14px', marginBottom: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <strong style={{ fontSize: '0.85rem' }}><i className="fa-solid fa-clock" style={{ color: 'var(--warning)' }}></i> Audio 4: Alerta de Retraso Crítico</strong>
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
                    &ldquo;No nos llegó el camión con las cerámicas para el baño, nos va a demorar 2 días la colocación del revestimiento.&rdquo;
                  </p>
                </div>

                {/* Sim Check-in */}
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

          {/* SECTION 3: GANTT CHART */}
          <section id="sec-gantt" className={`content-section animate-fade-in-up ${activeTab === 'sec-gantt' ? 'active' : ''}`}>
            <div className="section-header">
              <div className="header-title">
                <h1>Cronograma Dinámico de Obra (Gantt Interactivo)</h1>
                <p>Editor de Tareas. Ajusta el progreso y las duraciones directamente para ver el impacto en tiempo real.</p>
              </div>
              <div className="header-actions">
                <button className="btn btn-primary" onClick={() => setShowAddTaskModal(true)} style={{ marginRight: '8px' }}><i className="fa-solid fa-plus"></i> Agregar Tarea</button>
                <button className="btn btn-secondary" onClick={handleResetState}><i className="fa-solid fa-arrow-rotate-left"></i> Restablecer Cronograma</button>
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

                {/* Timeline Header */}
                <div className="gantt-timeline-header">
                  <div className="gantt-label-col-header" style={{ zIndex: 2 }}>Tarea / Asignado</div>
                  <div className="gantt-days-header" style={{ zIndex: 2 }}>
                    <div className="gantt-day-header-item">L 20</div>
                    <div className="gantt-day-header-item">M 21</div>
                    <div className="gantt-day-header-item">X 22</div>
                    <div className="gantt-day-header-item">J 23</div>
                    <div className="gantt-day-header-item">V 24</div>
                    <div className="gantt-day-header-item weekend">S 25</div>
                    <div className="gantt-day-header-item weekend">D 26</div>
                    <div className="gantt-day-header-item today">L 27</div>
                    <div className="gantt-day-header-item">M 28</div>
                    <div className="gantt-day-header-item">X 29</div>
                    <div className="gantt-day-header-item">J 30</div>
                    <div className="gantt-day-header-item">V 01</div>
                    <div className="gantt-day-header-item weekend">S 02</div>
                    <div className="gantt-day-header-item weekend">D 03</div>
                  </div>
                </div>

                {/* Gantt Rows */}
                <div className="gantt-rows" style={{ zIndex: 2, position: 'relative' }}>
                  {Object.keys(state.tasks).map(id => {
                    const task = state.tasks[id];
                    let barClass = "gantt-bar";
                    if (task.progress === 100) barClass += " completed";
                    else if (task.isDelayed || id === "99") barClass += " delayed";
                    else if (task.isShifted) barClass += " shifted";

                    const leftVal = task.startOffset;
                    const widthVal = task.duration * 7.14;

                    return (
                      <div key={id} className="gantt-row">
                        <div className="gantt-task-info" onClick={() => handleEditTask(id)} style={{ cursor: 'pointer' }}>
                          <span className="gantt-task-name">{task.name}</span>
                          <span className="gantt-task-assignee"><i className="fa-solid fa-user" style={{ fontSize: '0.65rem', marginRight: '4px' }}></i>{task.assignee}</span>
                        </div>
                        <div className="gantt-task-bar-container">
                          <div className={barClass} id={`gantt-bar-${id}`} style={{ left: `${leftVal}%`, width: `${widthVal}%` }} onClick={() => handleEditTask(id)}>
                            <div className="gantt-bar-progress" id={`gantt-bar-progress-${id}`} style={{ width: `${task.progress}%` }}></div>
                            <span className="gantt-bar-text" id={`gantt-bar-text-${id}`}>{task.name} ({task.progress}%)</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Editors Grid */}
              <div className="gantt-editor-card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px', marginTop: '24px' }}>
                {Object.keys(state.tasks).map(id => {
                  const task = state.tasks[id];
                  return (
                    <div key={id} className="glass-panel-premium dashboard-card-hover" style={{ padding: '14px', marginBottom: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: '0.8rem', color: 'var(--primary)' }}>{task.name}</strong>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => handleEditTask(id)}><i className="fa-solid fa-cog"></i> Configurar</span>
                      </div>
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
                  Presentamos la cotización de servicios profesionales para el desarrollo, despliegue y puesta en marcha de la <strong>plataforma de control de obras &ldquo;ObraSaaS&rdquo;</strong>, integrando reportes de campo, automatización y cronogramas dinámicos.
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
                    &ldquo;{weeklyReportDetails.aiSummaryText}&rdquo;
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
