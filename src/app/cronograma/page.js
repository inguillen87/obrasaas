"use client";
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { tokens, Badge, Button, GlassCard, StatCard, PageHeader, Modal } from '@/lib/design-system';
import { useBreakpoint } from '@/lib/useBreakpoint';

// ----------------------------------------------------------------------
// DATA MOCKUP
// ----------------------------------------------------------------------
const initialTasks = [
  // Estructura
  { id: 't1', name: 'Excavación y Fundaciones', startWeek: 1, duration: 2, progress: 100, assignee: 'JZ', group: 'Estructura', dependencies: [], status: 'completed' },
  { id: 't2', name: 'Hormigonado de Columnas', startWeek: 3, duration: 2, progress: 100, assignee: 'MR', group: 'Estructura', dependencies: ['t1'], status: 'completed' },
  { id: 't3', name: 'Vigas y Losas N1', startWeek: 5, duration: 3, progress: 80, assignee: 'JZ', group: 'Estructura', dependencies: ['t2'], status: 'on-track' },
  { id: 't4', name: 'Vigas y Losas N2', startWeek: 8, duration: 3, progress: 20, assignee: 'MR', group: 'Estructura', dependencies: ['t3'], status: 'delayed' },
  // Cerramientos
  { id: 't5', name: 'Mampostería Exterior', startWeek: 6, duration: 4, progress: 50, assignee: 'AP', group: 'Cerramientos', dependencies: ['t3'], status: 'on-track' },
  { id: 't6', name: 'Carpinterías DVH', startWeek: 10, duration: 2, progress: 0, assignee: 'LG', group: 'Cerramientos', dependencies: ['t5'], status: 'at-risk' },
  { id: 't7', name: 'Revoque Grueso', startWeek: 8, duration: 3, progress: 10, assignee: 'AP', group: 'Cerramientos', dependencies: ['t5'], status: 'on-track' },
  { id: 't8', name: 'Contrapiso', startWeek: 9, duration: 2, progress: 0, assignee: 'MR', group: 'Cerramientos', dependencies: ['t7'], status: 'on-track' },
  // Terminaciones
  { id: 't9', name: 'Revoque Fino', startWeek: 11, duration: 3, progress: 0, assignee: 'AP', group: 'Terminaciones', dependencies: ['t7'], status: 'on-track' },
  { id: 't10', name: 'Cerámicos y Porcelanato', startWeek: 12, duration: 3, progress: 0, assignee: 'JZ', group: 'Terminaciones', dependencies: ['t8'], status: 'on-track' },
  { id: 't11', name: 'Pintura Interior', startWeek: 14, duration: 2, progress: 0, assignee: 'LG', group: 'Terminaciones', dependencies: ['t9'], status: 'on-track' },
  { id: 't12', name: 'Instalaciones Sanitarias', startWeek: 4, duration: 5, progress: 60, assignee: 'MR', group: 'Terminaciones', dependencies: ['t2'], status: 'critical' },
];

const statusColors = {
  'completed': tokens.colors.accent.secondary, // blue
  'on-track': tokens.colors.accent.success,    // green
  'delayed': tokens.colors.accent.danger,      // red
  'at-risk': tokens.colors.accent.warning,     // orange
  'critical': tokens.colors.accent.danger      // red
};

export default function CronogramaPage() {
  const [tasks, setTasks] = useState(initialTasks);
  const [apiTotalTasks, setApiTotalTasks] = useState(initialTasks.length);
  const [apiOverallProgress, setApiOverallProgress] = useState(0);
  const [apiCurrentQuincena, setApiCurrentQuincena] = useState('Quincena 1');
  const [isLoading, setIsLoading] = useState(true);
  const [sseConnected, setSseConnected] = useState(false);

  const [zoomLevel, setZoomLevel] = useState('Semanas');
  const [viewMode, setViewMode] = useState('Gantt Completo');
  const [assigneeFilter, setAssigneeFilter] = useState('Todos');
  const [selectedTask, setSelectedTask] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [rainDaysSim, setRainDaysSim] = useState(0);
  const [curvaS, setCurvaS] = useState([]);
  const [ganttFiles, setGanttFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [exportToast, setExportToast] = useState(false);

  // Sprint H&S, Gantt Import & Overtime State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importCsvText, setImportCsvText] = useState('');
  const [importTasksPreview, setImportTasksPreview] = useState([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importSuccessMsg, setImportSuccessMsg] = useState(null);

  const [isOvertimeModalOpen, setIsOvertimeModalOpen] = useState(false);
  const [overtimeData, setOvertimeData] = useState(null);
  const [overtimeLoading, setOvertimeLoading] = useState(false);
  const [newOtWorker, setNewOtWorker] = useState('Juan Gómez');
  const [newOtTrade, setNewOtTrade] = useState('Oficial Albañil Principal');
  const [newOtHours50, setNewOtHours50] = useState(0);
  const [newOtHours100, setNewOtHours100] = useState(0);
  const [newOtConcept, setNewOtConcept] = useState('');
  const [newOtDayType, setNewOtDayType] = useState('Día Hábil Prolongado (50%)');
  
  // New task form state
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskGroup, setNewTaskGroup] = useState('Estructura');
  const [newTaskStart, setNewTaskStart] = useState(1);
  const [newTaskDuration, setNewTaskDuration] = useState(2);
  const [newTaskAssignee, setNewTaskAssignee] = useState('JZ');

  const { isMobile, isTablet } = useBreakpoint();
  
  const calculateStartWeek = (dateString) => {
    const projectStart = new Date('2026-08-01');
    const taskStart = new Date(dateString);
    const diffTime = Math.abs(taskStart - projectStart);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.floor(diffDays / 7) + 1;
  };

  const calculateDuration = (startString, endString) => {
    const start = new Date(startString);
    const end = new Date(endString);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(1, Math.round(diffDays / 7));
  };

  const getAssigneeInitials = (name) => {
    if (!name) return 'UN';
    const parts = name.split(' ');
    if (parts.length > 1) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const inferGroup = (name) => {
    const n = name.toLowerCase();
    if (n.includes('hormigón') || n.includes('excavación') || n.includes('vigas') || n.includes('losas') || n.includes('estructura') || n.includes('fundaciones')) return 'Estructura';
    if (n.includes('mampostería') || n.includes('carpinterías') || n.includes('revoque grueso') || n.includes('contrapiso') || n.includes('cerramientos')) return 'Cerramientos';
    if (n.includes('revoque fino') || n.includes('pintura') || n.includes('cerámicos') || n.includes('terminaciones') || n.includes('instalaciones')) return 'Terminaciones';
    return 'Estructura';
  };

  const fetchOvertime = async () => {
    setOvertimeLoading(true);
    try {
      const res = await fetch('/api/v1/overtime');
      const json = await res.json();
      if (json.success) {
        setOvertimeData(json);
      }
    } catch (e) {
      console.error('Error fetching overtime:', e);
    } finally {
      setOvertimeLoading(false);
    }
  };

  const handleApproveOvertime = async (id) => {
    try {
      const res = await fetch('/api/v1/overtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', id, approvedBy: 'Arq. Victoria Schiaffino' })
      });
      const data = await res.json();
      if (data.success) {
        fetchOvertime();
      }
    } catch (e) {
      console.error('Error approving overtime:', e);
    }
  };

  const handleCreateOvertime = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/v1/overtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerName: newOtWorker,
          trade: newOtTrade,
          hours50: Number(newOtHours50),
          hours100: Number(newOtHours100),
          dayType: newOtDayType,
          concept: newOtConcept || 'Jornada extendida por avance crítico'
        })
      });
      const data = await res.json();
      if (data.success) {
        setNewOtHours50(0);
        setNewOtHours100(0);
        setNewOtConcept('');
        fetchOvertime();
      }
    } catch (e) {
      console.error('Error creating overtime:', e);
    }
  };

  const handleLoadSampleGantt = () => {
    const sample = `Excavación y Subsuelo,Estructura,1,2,JZ,100
Hormigonado de Bases,Estructura,2,3,MR,100
Muros Portantes Madera / CLT,Estructura,4,4,AP,85
Entrepisos y Viguetas,Estructura,6,3,JZ,50
Instalación Eléctrica Embutida,Instalaciones,5,4,LG,60
Aberturas DVH Triple Vidrio,Cerramientos,8,2,AP,30
Terminaciones y Revestimientos,Terminaciones,9,4,MR,10`;
    setImportCsvText(sample);
    parseCsv(sample);
  };

  const parseCsv = (text) => {
    const lines = text.trim().split('\n');
    const parsed = lines.map((line, idx) => {
      const [name, group, start, duration, assignee, progress] = line.split(',').map(s => s ? s.trim() : '');
      return {
        id: 'imp-' + idx,
        name: name || 'Tarea ' + (idx + 1),
        group: group || 'Estructura',
        startWeek: Number(start) || 1,
        duration: Number(duration) || 2,
        assignee: assignee || 'JZ',
        progress: Number(progress) || 0
      };
    });
    setImportTasksPreview(parsed);
  };

  const handleSyncImportedTasks = async () => {
    if (!importTasksPreview.length) return;
    setImportLoading(true);
    try {
      const apiKey = typeof window !== 'undefined' ? localStorage.getItem('obrasaas_admin_key') || 'internal' : 'internal';
      for (const t of importTasksPreview) {
        await fetch('/api/v1/tasks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey
          },
          body: JSON.stringify({
            name: t.name,
            quincena: 'Q' + Math.ceil(t.startWeek / 2),
            assignee: t.assignee === 'JZ' ? 'Juan Zapata' : t.assignee === 'MR' ? 'Marcelo Rodríguez' : 'Antonio Pérez',
            progress: t.progress
          })
        }).catch(() => {});
      }
      setImportSuccessMsg(`¡${importTasksPreview.length} tareas importadas y sincronizadas exitosamente con la obra!`);
      await fetchTasks();
      setTimeout(() => {
        setIsImportModalOpen(false);
        setImportSuccessMsg(null);
      }, 2000);
    } catch (e) {
      console.error('Error syncing imported tasks:', e);
    } finally {
      setImportLoading(false);
    }
  };

    const fetchTasks = async () => {
    try {
      const apiKey = typeof window !== 'undefined' ? localStorage.getItem('obrasaas_admin_key') || 'internal' : 'internal';
      const res = await fetch('/api/v1/tasks', {
        headers: { 'x-api-key': apiKey }
      });
      if (!res.ok) throw new Error('Failed to fetch tasks');
      const data = await res.json();
      
      if (data.tasks) {
        const mappedTasks = data.tasks.map(t => ({
          id: t.id,
          name: t.name,
          startWeek: calculateStartWeek(t.startDate),
          duration: calculateDuration(t.startDate, t.endDate),
          progress: t.progress,
          assignee: getAssigneeInitials(t.assignedTo),
          group: inferGroup(t.name),
          dependencies: t.dependencies || [],
          status: t.status === 'in_progress' ? 'on-track' : t.status === 'completed' ? 'completed' : t.status === 'delayed' ? 'delayed' : t.status === 'critical' ? 'critical' : 'on-track'
        }));
        setTasks(mappedTasks);
        setApiTotalTasks(data.total || mappedTasks.length);
        setApiOverallProgress(data.overallProgress || 0);
        setApiCurrentQuincena(data.currentQuincena || 'Quincena 1');
      }
    } catch (err) {
      console.error(err);
      // Keep initialTasks on failure
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchOvertime();
    const es = new EventSource('/api/realtime');
    es.onopen = () => setSseConnected(true);
    es.onerror = () => setSseConnected(false);
    es.onmessage = (event) => {
      try {
        const update = JSON.parse(event.data);
        if (update.type === 'STATE_UPDATE') {
          fetchTasks();
        }
      } catch (e) {}
    };
    return () => es.close();
  }, []);

  useEffect(() => {
    fetch('/api/state')
      .then(r => r.json())
      .then(data => {
        if (data?.curvaS) setCurvaS(data.curvaS);
        if (data?.ganttExternalFiles) setGanttFiles(data.ganttExternalFiles);
      })
      .catch(() => {});
  }, []);

  // Chart dimensions
  const weeksToShow = 18;
  const colWidth = isMobile ? 40 : 60;
  const rowHeight = 48;
  const nameColWidth = isMobile ? 140 : 220;

  // Apply rain delay simulation: outdoor tasks shift by 1 week if rainDays >= 2
  const tasksWithWeather = tasks.map(t => {
    if (rainDaysSim >= 2 && (t.group === 'Estructura' || t.group === 'Cerramientos') && t.status !== 'completed') {
      return { ...t, startWeek: t.startWeek + Math.floor(rainDaysSim / 2) };
    }
    return t;
  });
  
  // Filtered tasks
  const filteredTasks = tasksWithWeather.filter(t => {
    let match = true;
    if (assigneeFilter !== 'Todos' && t.assignee !== assigneeFilter) match = false;
    if (viewMode === 'Lookahead 4 Semanas') {
       const currentWeek = 6; // Mock current week
       if (t.startWeek > currentWeek + 4 || t.startWeek + t.duration < currentWeek) match = false;
    }
    if (viewMode === 'Ruta Crítica') {
       if (t.status !== 'critical' && t.status !== 'delayed') match = false;
    }
    return match;
  });

  const assignees = ['Todos', ...Array.from(new Set(tasks.map(t => t.assignee)))];

  const handleExportCSV = () => {
    const headers = ['ID', 'Tarea', 'Rubro', 'Semana Inicio', 'Duracion (Semanas)', 'Avance (%)', 'Estado', 'Responsable'];
    const rows = tasks.map(t => [
      t.id,
      `"${t.name}"`,
      `"${t.group}"`,
      t.startWeek,
      t.duration,
      t.progress,
      t.status,
      t.assignee
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Cronograma_Gantt_ObraSaaS_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setExportToast(true);
    setTimeout(() => setExportToast(false), 4000);
  };

  const handleAddTask = (e) => {
    e.preventDefault();
    if (!newTaskName) return;

    const newTask = {
      id: `t-${Date.now()}`,
      name: newTaskName,
      group: newTaskGroup,
      startWeek: parseInt(newTaskStart, 10) || 1,
      duration: parseInt(newTaskDuration, 10) || 1,
      progress: 0,
      assignee: newTaskAssignee,
      dependencies: [],
      status: 'on-track'
    };

    setTasks([...tasks, newTask]);
    setIsAddModalOpen(false);
    setNewTaskName('');
  };

  // Group tasks for rendering
  const groupedTasks = filteredTasks.reduce((acc, task) => {
    if (!acc[task.group]) acc[task.group] = [];
    acc[task.group].push(task);
    return acc;
  }, {});

  // Calculate task positions map to draw dependencies
  let currentY = 0;
  const taskPositions = {};
  
  Object.keys(groupedTasks).forEach(group => {
    currentY += rowHeight; // Group header
    groupedTasks[group].forEach(task => {
      taskPositions[task.id] = {
        x: nameColWidth + (task.startWeek - 1) * colWidth,
        y: currentY,
        width: task.duration * colWidth,
        height: 32, // Bar height
      };
      currentY += rowHeight;
    });
  });

  // Calculate bottom stats
  const onTrackCount = tasks.filter(t => t.status === 'on-track' || t.status === 'completed').length;
  const onTrackPct = Math.round((onTrackCount / tasks.length) * 100) || 0;
  const criticalCount = tasks.filter(t => t.status === 'critical' || t.status === 'delayed').length;

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: tokens.colors.bg.primary, 
      color: tokens.colors.text.primary,
      fontFamily: tokens.font.sans,
      display: 'flex',
      flexDirection: 'column',
      paddingBottom: '80px'
    }}>
      <PageHeader 
        title="Cronograma Studio & Planificación Gantt CPM" 
        subtitle="Control de plazos, ruta crítica, dependencias y cálculo de impacto climático por lluvia"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Cronograma de Obra' }]}
        actions={
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            {sseConnected && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 'bold', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                🟢 En Vivo
              </div>
            )}
            <Link href="/dashboard" style={{ textDecoration: 'none' }}>
              <Button variant="ghost">← Dashboard</Button>
            </Link>
            <Button variant="secondary" icon="📥" onClick={() => setIsImportModalOpen(true)}>Importar Gantt</Button>
            <Button variant="secondary" icon="⏱️" onClick={() => { setIsOvertimeModalOpen(true); fetchOvertime(); }}>Horas Extras UOCRA</Button>
            <Button variant="secondary" icon="💾" onClick={handleExportCSV}>Exportar CSV</Button>
            <Button variant="primary" icon="+" onClick={() => setIsAddModalOpen(true)}>Agregar Tarea</Button>
          </div>
        }
      />

      <main style={{ 
        maxWidth: '1440px', 
        margin: '0 auto', 
        padding: `0 ${isMobile ? '16px' : '32px'}`,
        width: '100%',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }}>

        {exportToast && (
          <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', padding: '12px 16px', borderRadius: '8px', color: '#10b981', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>✅</span> Archivo CSV del Cronograma exportado con éxito para Microsoft Project / Excel.
          </div>
        )}
        
        {/* Controls */}
        <GlassCard style={{ padding: '16px 24px', display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '8px', background: tokens.colors.bg.elevated, padding: '4px', borderRadius: tokens.radius.md }}>
              {['Gantt Completo', 'Lookahead 4 Semanas', 'Ruta Crítica', 'Curva S'].map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: tokens.radius.sm,
                    background: viewMode === mode ? tokens.colors.bg.cardHover : 'transparent',
                    border: 'none',
                    color: viewMode === mode ? tokens.colors.text.primary : tokens.colors.text.muted,
                    cursor: 'pointer',
                    fontWeight: viewMode === mode ? '600' : '400',
                    transition: 'all 0.2s',
                    fontSize: '14px'
                  }}
                >
                  {mode}
                </button>
              ))}
            </div>

            <div style={{ width: '1px', height: '24px', background: tokens.colors.border.subtle }} />

            {/* Rain Day Delay Simulator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(56, 189, 248, 0.08)', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
              <span style={{ fontSize: '13px', color: '#38bdf8', fontWeight: 600 }}>🌧️ Días de Lluvia (Ley 22.250):</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                {[0, 2, 4, 6].map(days => (
                  <button
                    key={days}
                    onClick={() => setRainDaysSim(days)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      background: rainDaysSim === days ? '#38bdf8' : 'transparent',
                      color: rainDaysSim === days ? '#060913' : '#94a3b8',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {days === 0 ? 'Normal' : `+${days}d`}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ width: '1px', height: '24px', background: tokens.colors.border.subtle }} />

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: tokens.colors.text.muted }}>Zoom:</span>
              <select
                value={zoomLevel}
                onChange={e => setZoomLevel(e.target.value)}
                style={{
                  background: tokens.colors.bg.elevated,
                  border: `1px solid ${tokens.colors.border.default}`,
                  color: tokens.colors.text.primary,
                  padding: '8px 12px',
                  borderRadius: tokens.radius.sm,
                  fontSize: '14px',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                {['Días', 'Semanas', 'Quincenas', 'Meses'].map(z => <option key={z} value={z}>{z}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: tokens.colors.text.muted }}>Responsable:</span>
            <select
              value={assigneeFilter}
              onChange={e => setAssigneeFilter(e.target.value)}
              style={{
                background: tokens.colors.bg.elevated,
                border: `1px solid ${tokens.colors.border.default}`,
                color: tokens.colors.text.primary,
                padding: '8px 12px',
                borderRadius: tokens.radius.sm,
                fontSize: '14px',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {assignees.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </GlassCard>

        
        {/* VIEW MODE: CURVA S EVM VIEW */}
        {viewMode === 'Curva S' && (
          <GlassCard style={{ padding: '28px', border: '1px solid rgba(56, 189, 248, 0.3)', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                  📈 Curva S Físico-Financiera (EVM) — Torre Palermo Soho
                </h2>
                <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '6px 0 0' }}>
                  Correlación quincenal: Avance Programado (PV) vs Real Certificado (EV) vs Costo Directo (AC)
                </p>
              </div>
              <div style={{ display: 'flex', gap: '12px', fontSize: '0.8rem', fontWeight: 700 }}>
                <span style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>● Planificado (Baseline PV)</span>
                <span style={{ color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '4px' }}>● Real Certificado (EV)</span>
                <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>● SPI = 1.05 (+5%)</span>
              </div>
            </div>

            {/* EVM KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <div style={{ background: 'rgba(6, 9, 19, 0.8)', padding: '18px', borderRadius: '12px', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Índice de Rendimiento (SPI)</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#10b981', margin: '4px 0' }}>1.05</div>
                <div style={{ fontSize: '0.74rem', color: '#86efac' }}>↑ Obra adelantada +5% frente a línea de base</div>
              </div>
              <div style={{ background: 'rgba(6, 9, 19, 0.8)', padding: '18px', borderRadius: '12px', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Índice de Costos (CPI)</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#f59e0b', margin: '4px 0' }}>0.98</div>
                <div style={{ fontSize: '0.74rem', color: '#fbbf24' }}>Gasto de insumos controlado dentro del 2%</div>
              </div>
              <div style={{ background: 'rgba(6, 9, 19, 0.8)', padding: '18px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Variación de Plazo (SV)</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#10b981', margin: '4px 0' }}>+4 Días</div>
                <div style={{ fontSize: '0.74rem', color: '#86efac' }}>Plazo holgado respecto al contrato comitente</div>
              </div>
              <div style={{ background: 'rgba(6, 9, 19, 0.8)', padding: '18px', borderRadius: '12px', border: '1px solid rgba(168, 85, 247, 0.25)' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Impacto por Lluvia Simulado</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#a855f7', margin: '4px 0' }}>+{rainDaysSim}d</div>
                <div style={{ fontSize: '0.74rem', color: '#d8b4fe' }}>Prórroga amparada por Ley 22.250 UOCRA</div>
              </div>
            </div>

            {/* S-Curve Chart */}
            <div style={{ background: 'rgba(6, 9, 19, 0.95)', padding: '24px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: '220px', gap: '8px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                {[
                  { q: 'Q1 Ene', plan: 8, real: 10 },
                  { q: 'Q2 Ene', plan: 18, real: 22 },
                  { q: 'Q1 Feb', plan: 32, real: 35 },
                  { q: 'Q2 Feb', plan: 46, real: 50 },
                  { q: 'Q1 Mar', plan: 60, real: 62 },
                  { q: 'Q2 Mar', plan: 74, real: null },
                  { q: 'Q1 Abr', plan: 88, real: null },
                  { q: 'Q2 Abr', plan: 100, real: null }
                ].map((d, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', width: '100%', justifyContent: 'center', height: '180px' }}>
                      <div style={{ width: '12px', height: (d.plan * 1.7) + 'px', background: 'rgba(148, 163, 184, 0.4)', borderRadius: '4px 4px 0 0' }} title={'Plan: ' + d.plan + '%'} />
                      {d.real !== null && (
                        <div style={{ width: '12px', height: (d.real * 1.7) + 'px', background: '#38bdf8', borderRadius: '4px 4px 0 0' }} title={'Real: ' + d.real + '%'} />
                      )}
                    </div>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700 }}>{d.q}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '0.78rem', color: '#64748b' }}>
                <span>Inicio de Obra (01/Ene/2026)</span>
                <span style={{ color: '#38bdf8', fontWeight: 800 }}>Punto de Control Activo: Q1 Marzo (62% Real vs 60% Plan)</span>
                <span>Finalización Prevista (30/Abr/2026)</span>
              </div>
            </div>

            {/* Quincenas Breakdown Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', textAlign: 'left' }}>
                    <th style={{ padding: '10px' }}>Período</th>
                    <th style={{ padding: '10px' }}>Planificado (PV)</th>
                    <th style={{ padding: '10px' }}>Real (EV)</th>
                    <th style={{ padding: '10px' }}>Desvío (SV)</th>
                    <th style={{ padding: '10px' }}>Estado Quincenal</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { p: 'Q1 Enero 2026', pv: '8%', ev: '10%', sv: '+2%', st: 'Adelantada', c: '#10b981' },
                    { p: 'Q2 Enero 2026', pv: '18%', ev: '22%', sv: '+4%', st: 'Adelantada', c: '#10b981' },
                    { p: 'Q1 Febrero 2026', pv: '32%', ev: '35%', sv: '+3%', st: 'Adelantada', c: '#10b981' },
                    { p: 'Q2 Febrero 2026', pv: '46%', ev: '50%', sv: '+4%', st: 'Adelantada', c: '#10b981' },
                    { p: 'Q1 Marzo 2026 (Activa)', pv: '60%', ev: '62%', sv: '+2%', st: 'En Curso Conforme', c: '#38bdf8' }
                  ].map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#f8fafc' }}>
                      <td style={{ padding: '10px', fontWeight: 600 }}>{row.p}</td>
                      <td style={{ padding: '10px', color: '#94a3b8' }}>{row.pv}</td>
                      <td style={{ padding: '10px', color: '#38bdf8', fontWeight: 700 }}>{row.ev}</td>
                      <td style={{ padding: '10px', color: '#10b981', fontWeight: 700 }}>{row.sv}</td>
                      <td style={{ padding: '10px' }}><span style={{ background: 'rgba(255,255,255,0.06)', color: row.c, padding: '4px 8px', borderRadius: '4px', fontWeight: 700, fontSize: '0.75rem' }}>{row.st}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        )}

        {/* Main Workspace Area */}
        <div style={{ display: 'flex', gap: '24px', flex: 1, minHeight: '500px', position: 'relative' }}>
          
          {isLoading && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(6,9,19,0.7)', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(4px)', borderRadius: tokens.radius.lg }}>
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} style={{ width: '40px', height: '40px', borderRadius: '50%', border: `3px solid ${tokens.colors.border.subtle}`, borderTopColor: tokens.colors.accent.primary }} />
            </div>
          )}

          {/* Gantt Chart Container */}
          <GlassCard style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 0 }}>
            <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1 }}>
              <div style={{ minWidth: `${nameColWidth + weeksToShow * colWidth}px`, position: 'relative' }}>
                
                {/* Header Row */}
                <div style={{ 
                  display: 'flex', 
                  borderBottom: `1px solid ${tokens.colors.border.default}`,
                  background: tokens.colors.bg.elevated,
                  position: 'sticky',
                  top: 0,
                  zIndex: 10
                }}>
                  <div style={{ 
                    width: nameColWidth, 
                    padding: '16px', 
                    fontWeight: '600',
                    fontSize: '13px',
                    color: tokens.colors.text.secondary,
                    borderRight: `1px solid ${tokens.colors.border.default}`,
                    position: 'sticky',
                    left: 0,
                    background: tokens.colors.bg.elevated,
                    zIndex: 11
                  }}>
                    Tarea
                  </div>
                  {Array.from({ length: weeksToShow }).map((_, i) => (
                    <div key={i} style={{ 
                      width: colWidth, 
                      padding: '16px 0', 
                      textAlign: 'center',
                      fontSize: '13px',
                      color: tokens.colors.text.secondary,
                      borderRight: `1px solid ${tokens.colors.border.subtle}`
                    }}>
                      S{i + 1}
                    </div>
                  ))}
                </div>

                {/* Grid & Rows */}
                <div style={{ position: 'relative' }}>
                  {/* Vertical Grid Lines */}
                  {Array.from({ length: weeksToShow }).map((_, i) => (
                    <div key={`grid-${i}`} style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      left: nameColWidth + i * colWidth,
                      width: '1px',
                      background: tokens.colors.border.subtle,
                      zIndex: 1
                    }} />
                  ))}

                  {/* Tasks Rendering */}
                  {Object.keys(groupedTasks).map(group => (
                    <div key={group}>
                      {/* Group Header */}
                      <div style={{ 
                        height: rowHeight, 
                        display: 'flex', 
                        alignItems: 'center',
                        background: 'rgba(255,255,255,0.03)',
                        borderBottom: `1px solid ${tokens.colors.border.subtle}`,
                        position: 'relative',
                        zIndex: 2
                      }}>
                        <div style={{ 
                          width: nameColWidth, 
                          padding: '0 16px', 
                          fontWeight: '600',
                          color: tokens.colors.accent.primary,
                          fontSize: '14px',
                          position: 'sticky',
                          left: 0,
                          background: tokens.colors.bg.primary,
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          borderRight: `1px solid ${tokens.colors.border.default}`,
                          zIndex: 3
                        }}>
                          {group}
                        </div>
                      </div>

                      {/* Task Rows */}
                      {groupedTasks[group].map(task => (
                        <div 
                          key={task.id} 
                          style={{ 
                            height: rowHeight, 
                            display: 'flex',
                            borderBottom: `1px solid ${tokens.colors.border.subtle}`,
                            position: 'relative',
                            zIndex: 2
                          }}
                        >
                          {/* Task Name Col */}
                          <div 
                            style={{ 
                              width: nameColWidth, 
                              padding: '0 16px', 
                              fontSize: '14px',
                              display: 'flex',
                              alignItems: 'center',
                              position: 'sticky',
                              left: 0,
                              background: tokens.colors.bg.card,
                              borderRight: `1px solid ${tokens.colors.border.default}`,
                              zIndex: 3,
                              cursor: 'pointer',
                              color: selectedTask?.id === task.id ? tokens.colors.accent.primary : tokens.colors.text.primary
                            }}
                            onClick={() => setSelectedTask(task)}
                          >
                            <span style={{ 
                              width: '8px', 
                              height: '8px', 
                              borderRadius: '50%', 
                              background: statusColors[task.status], 
                              marginRight: '12px' 
                            }} />
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {task.name}
                            </span>
                          </div>

                          {/* Task Bar */}
                          {taskPositions[task.id] && (
                            <motion.div
                              whileHover={{ scale: 1.02, filter: 'brightness(1.1)' }}
                              onClick={() => setSelectedTask(task)}
                              style={{
                                position: 'absolute',
                                left: taskPositions[task.id].x,
                                top: '8px',
                                width: taskPositions[task.id].width - 8,
                                height: taskPositions[task.id].height,
                                background: 'rgba(255,255,255,0.1)',
                                borderRadius: '4px',
                                border: `1px solid ${task.status === 'critical' ? tokens.colors.accent.danger : statusColors[task.status]}`,
                                cursor: 'pointer',
                                overflow: 'hidden',
                                display: 'flex',
                                alignItems: 'center',
                                boxShadow: task.status === 'critical' ? `0 0 8px ${tokens.colors.accent.danger}40` : 'none',
                                zIndex: 4
                              }}
                            >
                              {/* Progress Fill */}
                              <div style={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                bottom: 0,
                                width: `${task.progress}%`,
                                background: statusColors[task.status],
                                opacity: 0.8
                              }} />
                              
                              {/* Assignee Avatar inside bar */}
                              <div style={{
                                position: 'absolute',
                                right: '4px',
                                background: tokens.colors.bg.elevated,
                                color: tokens.colors.text.primary,
                                fontSize: '10px',
                                fontWeight: 'bold',
                                width: '20px',
                                height: '20px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: `1px solid ${tokens.colors.border.subtle}`
                              }}>
                                {task.assignee}
                              </div>
                            </motion.div>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                  
                  {/* SVG Dependencies Layer */}
                  <svg style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                    zIndex: 3
                  }}>
                    {filteredTasks.map(task => 
                      task.dependencies.map(depId => {
                        const fromPos = taskPositions[depId];
                        const toPos = taskPositions[task.id];
                        if (!fromPos || !toPos) return null;
                        
                        const startX = fromPos.x + fromPos.width - 4;
                        const startY = fromPos.y + fromPos.height / 2;
                        const endX = toPos.x;
                        const endY = toPos.y + toPos.height / 2;
                        
                        const path = `M ${startX} ${startY} L ${startX + 10} ${startY} L ${startX + 10} ${endY} L ${endX} ${endY}`;
                        
                        return (
                          <g key={`${depId}-${task.id}`}>
                            <path 
                              d={path} 
                              fill="none" 
                              stroke={tokens.colors.border.strong} 
                              strokeWidth="2" 
                              strokeDasharray="4,4"
                            />
                            <polygon 
                              points={`${endX-6},${endY-4} ${endX},${endY} ${endX-6},${endY+4}`} 
                              fill={tokens.colors.border.strong} 
                            />
                          </g>
                        );
                      })
                    )}
                  </svg>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Task Details Sidebar */}
          <AnimatePresence>
            {selectedTask && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: isMobile ? '100%' : '340px', opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                style={{ overflow: 'hidden' }}
              >
                <GlassCard style={{ height: '100%', position: 'relative' }}>
                  <button 
                    onClick={() => setSelectedTask(null)}
                    style={{
                      position: 'absolute',
                      top: '16px',
                      right: '16px',
                      background: 'none',
                      border: 'none',
                      color: tokens.colors.text.muted,
                      cursor: 'pointer',
                      fontSize: '20px'
                    }}
                  >
                    ×
                  </button>
                  
                  <div style={{ marginTop: '8px' }}>
                    <Badge color={
                      selectedTask.status === 'completed' ? 'secondary' :
                      selectedTask.status === 'on-track' ? 'success' :
                      selectedTask.status === 'delayed' ? 'danger' : 'warning'
                    }>
                      {selectedTask.status.toUpperCase()}
                    </Badge>
                  </div>
                  
                  <h3 style={{ 
                    fontSize: '20px', 
                    fontWeight: '600', 
                    marginTop: '16px', 
                    marginBottom: '8px',
                    color: tokens.colors.text.primary
                  }}>
                    {selectedTask.name}
                  </h3>
                  
                  <p style={{ color: tokens.colors.text.muted, fontSize: '14px', marginBottom: '24px' }}>
                    Grupo: {selectedTask.group}
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ background: tokens.colors.bg.elevated, padding: '16px', borderRadius: tokens.radius.md }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ color: tokens.colors.text.muted, fontSize: '13px' }}>Progreso</span>
                        <span style={{ fontWeight: '600', fontSize: '14px' }}>{selectedTask.progress}%</span>
                      </div>
                      <div style={{ height: '6px', background: tokens.colors.bg.secondary, borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ 
                          height: '100%', 
                          width: `${selectedTask.progress}%`, 
                          background: statusColors[selectedTask.status] 
                        }} />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div style={{ background: tokens.colors.bg.elevated, padding: '12px', borderRadius: tokens.radius.md }}>
                        <div style={{ color: tokens.colors.text.muted, fontSize: '12px', marginBottom: '4px' }}>Semana Inicio</div>
                        <div style={{ fontWeight: '600' }}>S{selectedTask.startWeek}</div>
                      </div>
                      <div style={{ background: tokens.colors.bg.elevated, padding: '12px', borderRadius: tokens.radius.md }}>
                        <div style={{ color: tokens.colors.text.muted, fontSize: '12px', marginBottom: '4px' }}>Duración</div>
                        <div style={{ fontWeight: '600' }}>{selectedTask.duration} sem.</div>
                      </div>
                    </div>

                    <div style={{ background: tokens.colors.bg.elevated, padding: '16px', borderRadius: tokens.radius.md }}>
                      <div style={{ color: tokens.colors.text.muted, fontSize: '13px', marginBottom: '8px' }}>Responsable</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '50%',
                          background: tokens.colors.accent.primary,
                          color: tokens.colors.bg.primary,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 'bold', fontSize: '14px'
                        }}>
                          {selectedTask.assignee}
                        </div>
                        <span style={{ fontWeight: '500' }}>Usuario {selectedTask.assignee}</span>
                      </div>
                    </div>

                    {selectedTask.dependencies.length > 0 && (
                      <div>
                        <div style={{ color: tokens.colors.text.muted, fontSize: '13px', marginBottom: '8px' }}>Depende de:</div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {selectedTask.dependencies.map(d => {
                            const depTask = tasks.find(t => t.id === d);
                            return depTask ? (
                              <Badge key={d} color="default">{depTask.name}</Badge>
                            ) : null;
                          })}
                        </div>
                      </div>
                    )}
                    
                    <Button variant="primary" style={{ marginTop: '16px', width: '100%' }}>
                      Editar Tarea
                    </Button>
                  </div>
                </GlassCard>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </main>

      {/* Bottom Stats Bar */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: tokens.colors.bg.elevated,
        borderTop: `1px solid ${tokens.colors.border.subtle}`,
        padding: '12px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 50,
        backdropFilter: 'blur(10px)',
        fontSize: '14px'
      }}>
        <div style={{ display: 'flex', gap: '32px' }}>
          <div>
            <span style={{ color: tokens.colors.text.muted }}>Total Tareas: </span>
            <span style={{ fontWeight: '600' }}>{apiTotalTasks}</span>
          </div>
          <div>
            <span style={{ color: tokens.colors.text.muted }}>Avance Global: </span>
            <span style={{ fontWeight: '600', color: tokens.colors.accent.success }}>{apiOverallProgress}%</span>
          </div>
          <div>
            <span style={{ color: tokens.colors.text.muted }}>Quincena: </span>
            <span style={{ fontWeight: '600', color: tokens.colors.accent.primary }}>{apiCurrentQuincena}</span>
          </div>
          <div>
            <span style={{ color: tokens.colors.text.muted }}>Ruta Crítica: </span>
            <span style={{ fontWeight: '600', color: tokens.colors.accent.danger }}>{criticalCount} items</span>
          </div>
        </div>
        <div>
          <span style={{ color: tokens.colors.text.muted }}>Fin Estimado: </span>
          <span style={{ fontWeight: '600', color: tokens.colors.accent.primary }}>Semana 18</span>
        </div>
      </div>

      {viewMode === 'Curva S' && (
        <div style={{ position: 'absolute', top: '160px', left: 0, right: 0, padding: '0 32px', zIndex: 40, background: tokens.colors.bg.primary, paddingBottom: '120px' }}>
          <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {(() => {
            const latest = curvaS.length ? curvaS[curvaS.length - 1] : { costoPlanificadoARS: 0, avanceRealPct: 0, costoRealARS: 0 };
            const pv = latest.costoPlanificadoARS || 0;
            const ev = ((latest.avanceRealPct || 0) / 100) * 4995000;
            const ac = latest.costoRealARS || 0;
            const spi = pv ? (ev / pv).toFixed(2) : '1.00';
            const cpi = ac ? (ev / ac).toFixed(2) : '1.00';

            const chartW = 800;
            const chartH = 400;
            const padL = 60, padR = 20, padT = 20, padB = 40;
            const plotW = chartW - padL - padR;
            const plotH = chartH - padT - padB;

            const pathPlan = curvaS.map((p, i) => {
              const x = padL + (i / Math.max(1, curvaS.length - 1)) * plotW;
              const y = padT + plotH - ((p.avancePlanificadoPct || 0) / 100) * plotH;
              return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
            }).join(' ');

            const pathReal = curvaS.map((p, i) => {
              const x = padL + (i / Math.max(1, curvaS.length - 1)) * plotW;
              const y = padT + plotH - ((p.avanceRealPct || 0) / 100) * plotH;
              return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
            }).join(' ');
            
            let pathArea = '';
            if (curvaS.length > 0) {
              const reversePlan = [...curvaS].reverse().map((p, idx) => {
                const i = curvaS.length - 1 - idx;
                const x = padL + (i / Math.max(1, curvaS.length - 1)) * plotW;
                const y = padT + plotH - ((p.avancePlanificadoPct || 0) / 100) * plotH;
                return `L ${x} ${y}`;
              }).join(' ');
              pathArea = `${pathReal} ${reversePlan} Z`;
            }

            return (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <StatCard title="PV (Costo Planificado)" value={`$${pv.toLocaleString('es-AR')}`} icon="📈" />
                  <StatCard title="EV (Valor Ganado)" value={`$${ev.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`} icon="🏆" />
                  <StatCard title="AC (Costo Real)" value={`$${ac.toLocaleString('es-AR')}`} icon="💰" />
                  <StatCard title="SPI / CPI (Rendimiento)" value={`${spi} / ${cpi}`} icon="📊" 
                    trend={spi >= 1 && cpi >= 1 ? 'positive' : 'negative'}
                    trendValue={spi >= 1 && cpi >= 1 ? 'Óptimo' : 'Desvío'}
                  />
                </div>

                <GlassCard style={{ padding: '24px' }}>
                  <h3 style={{ marginBottom: '16px', color: tokens.colors.text.primary }}>Curva S - Avance Físico (%)</h3>
                  <div style={{ width: '100%', overflowX: 'auto' }}>
                    <svg viewBox={`0 0 ${chartW} ${chartH}`} style={{ minWidth: '600px', width: '100%', height: 'auto', background: tokens.colors.bg.elevated, borderRadius: tokens.radius.md }}>
                      <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke={tokens.colors.border.default} />
                      <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke={tokens.colors.border.default} />
                      
                      {[0, 25, 50, 75, 100].map(val => (
                        <g key={val}>
                          <text x={padL - 10} y={padT + plotH - (val/100)*plotH + 4} fill={tokens.colors.text.muted} fontSize="12" textAnchor="end">{val}%</text>
                          <line x1={padL} y1={padT + plotH - (val/100)*plotH} x2={padL + plotW} y2={padT + plotH - (val/100)*plotH} stroke={tokens.colors.border.subtle} strokeDasharray="4 4" />
                        </g>
                      ))}

                      {curvaS.map((p, i) => {
                        const x = padL + (i / Math.max(1, curvaS.length - 1)) * plotW;
                        return (
                          <text key={i} x={x} y={padT + plotH + 20} fill={tokens.colors.text.muted} fontSize="12" textAnchor="middle">S{p.semana}</text>
                        );
                      })}

                      {pathArea && <path d={pathArea} fill="rgba(239, 68, 68, 0.2)" />}
                      {pathPlan && <path d={pathPlan} fill="none" stroke={tokens.colors.accent.primary} strokeWidth="3" strokeDasharray="6 6" />}
                      {pathReal && <path d={pathReal} fill="none" stroke={tokens.colors.accent.success} strokeWidth="3" />}

                      {curvaS.map((p, i) => {
                        const x = padL + (i / Math.max(1, curvaS.length - 1)) * plotW;
                        const yPlan = padT + plotH - ((p.avancePlanificadoPct || 0) / 100) * plotH;
                        const yReal = padT + plotH - ((p.avanceRealPct || 0) / 100) * plotH;
                        return (
                          <g key={i}>
                            <circle cx={x} cy={yPlan} r="4" fill={tokens.colors.bg.primary} stroke={tokens.colors.accent.primary} strokeWidth="2" />
                            <circle cx={x} cy={yReal} r="4" fill={tokens.colors.bg.primary} stroke={tokens.colors.accent.success} strokeWidth="2" />
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                  <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', marginTop: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '20px', height: '3px', borderTop: `3px dashed ${tokens.colors.accent.primary}` }} />
                      <span style={{ fontSize: '13px', color: tokens.colors.text.secondary }}>Avance Programado (Baseline)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '20px', height: '3px', background: tokens.colors.accent.success }} />
                      <span style={{ fontSize: '13px', color: tokens.colors.text.secondary }}>Avance Real (Ejecutado)</span>
                    </div>
                  </div>
                </GlassCard>

                <GlassCard style={{ padding: '24px' }}>
                  <h3 style={{ marginBottom: '16px', color: tokens.colors.text.primary }}>Gestor de Archivos Gantt (PDF/Imágenes)</h3>
                  
                  <div 
                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={e => { e.preventDefault(); setIsDragging(false); }}
                    style={{
                      border: `2px dashed ${isDragging ? tokens.colors.accent.primary : tokens.colors.border.strong}`,
                      background: isDragging ? 'rgba(56, 189, 248, 0.05)' : tokens.colors.bg.elevated,
                      padding: '40px 20px',
                      borderRadius: tokens.radius.md,
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      marginBottom: '24px'
                    }}
                  >
                    <div style={{ fontSize: '32px', marginBottom: '12px' }}>📁</div>
                    <div style={{ fontWeight: '600', color: tokens.colors.text.primary, marginBottom: '8px' }}>
                      Arrastra y suelta tu archivo exportado de MS Project o Primavera P6
                    </div>
                    <div style={{ fontSize: '13px', color: tokens.colors.text.muted }}>
                      Soporta PDF, PNG, JPG (Max 10MB)
                    </div>
                  </div>

                  {ganttFiles.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <h4 style={{ fontSize: '14px', color: tokens.colors.text.secondary, marginBottom: '4px' }}>Archivos Subidos</h4>
                      {ganttFiles.map((file, i) => (
                        <div key={i} style={{ 
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                          padding: '12px 16px', background: tokens.colors.bg.elevated, 
                          borderRadius: tokens.radius.sm, border: `1px solid ${tokens.colors.border.subtle}`
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '20px' }}>📄</span>
                            <div>
                              <div style={{ fontSize: '14px', fontWeight: '500', color: tokens.colors.text.primary }}>{file.name}</div>
                              <div style={{ fontSize: '12px', color: tokens.colors.text.muted }}>Subido el {new Date(file.uploadDate).toLocaleDateString()}</div>
                            </div>
                          </div>
                          <Badge color="success">Analizado</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </GlassCard>
              </>
            );
          })()}
          </div>
        </div>
      )}

      
      {/* Modal: Importar Gantt desde Excel / CSV / MS Project */}
      {isImportModalOpen && (
        <Modal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          title="Importar Cronograma Gantt (Excel / CSV / MS Project)"
          subtitle="Sincroniza tareas, semanas de inicio, duraciones y avances con la obra en vivo"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {importSuccessMsg && (
              <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', padding: '12px 16px', borderRadius: '8px', color: '#10b981', fontSize: '0.85rem' }}>
                ✅ {importSuccessMsg}
              </div>
            )}

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '0.8rem', color: tokens.colors.text.secondary }}>Pega los datos en formato CSV o carga una plantilla de ejemplo:</label>
                <Button size="sm" variant="ghost" onClick={handleLoadSampleGantt}>
                  📄 Cargar Ejemplo MS Project
                </Button>
              </div>
              <textarea
                rows={6}
                value={importCsvText}
                onChange={e => { setImportCsvText(e.target.value); parseCsv(e.target.value); }}
                placeholder="Nombre, Rubro, SemanaInicio, DuracionSemanas, Responsable, Progreso"
                style={{ width: '100%', padding: '12px', background: '#060913', border: `1px solid ${tokens.colors.border.default}`, borderRadius: tokens.radius.sm, color: '#f8fafc', fontFamily: tokens.font.mono, fontSize: '13px' }}
              />
            </div>

            {importTasksPreview.length > 0 && (
              <div>
                <h4 style={{ fontSize: '0.85rem', color: '#38bdf8', marginBottom: '8px' }}>Vista Previa ({importTasksPreview.length} tareas detectadas):</h4>
                <div style={{ maxHeight: '180px', overflowY: 'auto', border: `1px solid ${tokens.colors.border.subtle}`, borderRadius: '6px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.05)', color: '#94a3b8' }}>
                        <th style={{ padding: '6px' }}>Tarea</th>
                        <th style={{ padding: '6px' }}>Rubro</th>
                        <th style={{ padding: '6px' }}>Inicio</th>
                        <th style={{ padding: '6px' }}>Duración</th>
                        <th style={{ padding: '6px' }}>Resp.</th>
                        <th style={{ padding: '6px' }}>Avance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importTasksPreview.map((t, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                          <td style={{ padding: '6px', color: '#fff' }}>{t.name}</td>
                          <td style={{ padding: '6px', color: '#94a3b8' }}>{t.group}</td>
                          <td style={{ padding: '6px', textAlign: 'center' }}>S{t.startWeek}</td>
                          <td style={{ padding: '6px', textAlign: 'center' }}>{t.duration} sem</td>
                          <td style={{ padding: '6px', textAlign: 'center' }}>{t.assignee}</td>
                          <td style={{ padding: '6px', textAlign: 'center', color: '#10b981' }}>{t.progress}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
              <Button variant="secondary" onClick={() => setIsImportModalOpen(false)}>Cancelar</Button>
              <Button variant="primary" icon="🔄" onClick={handleSyncImportedTasks} disabled={importLoading || !importTasksPreview.length}>
                {importLoading ? 'Sincronizando...' : 'Sincronizar Tareas con la Obra'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Horas Extras UOCRA (Acuerdo Victoria & Marcelo) */}
      {isOvertimeModalOpen && (
        <Modal
          isOpen={isOvertimeModalOpen}
          onClose={() => setIsOvertimeModalOpen(false)}
          title="Gestor de Horas Extras & Sobrecostos Laborales (UOCRA CCT 76/75)"
          subtitle="Seguimiento de horas al 50% y 100%, impacto quincenal y aprobación por Dirección Técnica"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Stats Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
              <div style={{ background: 'rgba(6,9,19,0.8)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Total Horas Extras</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#38bdf8' }}>{overtimeData?.stats?.totalHoursCombined || 0} hs</div>
                <div style={{ fontSize: '0.68rem', color: '#64748b' }}>{overtimeData?.stats?.totalHours50 || 0}h (50%) + {overtimeData?.stats?.totalHours100 || 0}h (100%)</div>
              </div>
              <div style={{ background: 'rgba(6,9,19,0.8)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Sobrecosto Acumulado</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981' }}>${(overtimeData?.stats?.totalAmountARS || 0).toLocaleString('es-AR')}</div>
                <div style={{ fontSize: '0.68rem', color: '#86efac' }}>Aprobado: ${(overtimeData?.stats?.approvedAmountARS || 0).toLocaleString('es-AR')}</div>
              </div>
              <div style={{ background: 'rgba(6,9,19,0.8)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Pendiente Aprobación</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f59e0b' }}>{overtimeData?.stats?.pendingCount || 0} reg.</div>
                <div style={{ fontSize: '0.68rem', color: '#fbbf24' }}>${(overtimeData?.stats?.pendingAmountARS || 0).toLocaleString('es-AR')}</div>
              </div>
            </div>

            {/* Overtime Records List */}
            <div>
              <h4 style={{ fontSize: '0.85rem', color: '#f8fafc', marginBottom: '10px' }}>Registros de la Quincena:</h4>
              <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {overtimeData?.records?.map(r => (
                  <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>{r.workerName} ({r.trade})</div>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{r.date} • {r.dayType} • {r.concept}</div>
                      <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 700 }}>${(r.totalAmountARS || 0).toLocaleString('es-AR')} ARS</div>
                    </div>
                    <div>
                      {r.status === 'APROBADA' ? (
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '4px 8px', borderRadius: '4px' }}>
                          ✓ Aprobada ({r.approvedBy})
                        </span>
                      ) : (
                        <Button size="sm" variant="primary" onClick={() => handleApproveOvertime(r.id)}>
                          Aprobar
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Add Form */}
            <form onSubmit={handleCreateOvertime} style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#38bdf8' }}>➕ Cargar Nuevas Horas Extras:</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                <select value={newOtWorker} onChange={e => setNewOtWorker(e.target.value)} style={{ padding: '8px', background: '#060913', border: `1px solid ${tokens.colors.border.default}`, borderRadius: '4px', color: '#fff', fontSize: '0.78rem' }}>
                  <option value="Juan Gómez">Juan Gómez (Oficial)</option>
                  <option value="Luis Martínez">Luis Martínez (Instalaciones)</option>
                  <option value="Carlos Pérez">Carlos Pérez (Medio Oficial)</option>
                </select>
                <input
                  type="number"
                  placeholder="Horas al 50%"
                  value={newOtHours50 || ''}
                  onChange={e => setNewOtHours50(e.target.value)}
                  style={{ padding: '8px', background: '#060913', border: `1px solid ${tokens.colors.border.default}`, borderRadius: '4px', color: '#fff', fontSize: '0.78rem' }}
                />
                <input
                  type="number"
                  placeholder="Horas al 100%"
                  value={newOtHours100 || ''}
                  onChange={e => setNewOtHours100(e.target.value)}
                  style={{ padding: '8px', background: '#060913', border: `1px solid ${tokens.colors.border.default}`, borderRadius: '4px', color: '#fff', fontSize: '0.78rem' }}
                />
              </div>
              <input
                placeholder="Motivo / Justificación de la extensión horaria..."
                value={newOtConcept}
                onChange={e => setNewOtConcept(e.target.value)}
                style={{ padding: '8px', background: '#060913', border: `1px solid ${tokens.colors.border.default}`, borderRadius: '4px', color: '#fff', fontSize: '0.78rem' }}
              />
              <Button type="submit" variant="primary" size="sm">
                Registrar Horas Extras
              </Button>
            </form>
          </div>
        </Modal>
      )}

      {/* Add Task Modal */}
      {isAddModalOpen && (
        <Modal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          title="Agregar Nueva Tarea al Cronograma Gantt"
          subtitle="Planificación de hitos y dependencias de obra"
        >
          <form onSubmit={handleAddTask} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '0.78rem', color: tokens.colors.text.muted, display: 'block', marginBottom: '4px' }}>Nombre de la Tarea / Hito *</label>
              <input
                required
                placeholder="Ej: Montaje de Carpinterías DVH en Torre"
                value={newTaskName}
                onChange={e => setNewTaskName(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', background: '#060913', border: `1px solid ${tokens.colors.border.default}`, borderRadius: tokens.radius.sm, color: '#f8fafc' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', color: tokens.colors.text.muted, display: 'block', marginBottom: '4px' }}>Rubro de Obra</label>
              <select
                value={newTaskGroup}
                onChange={e => setNewTaskGroup(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', background: '#060913', border: `1px solid ${tokens.colors.border.default}`, borderRadius: tokens.radius.sm, color: '#f8fafc' }}
              >
                <option value="Estructura">Estructura & Hormigón</option>
                <option value="Cerramientos">Cerramientos & Mampostería</option>
                <option value="Terminaciones">Terminaciones & Revestimientos</option>
                <option value="Instalaciones">Instalaciones Sanitarias / Eléctricas</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.78rem', color: tokens.colors.text.muted, display: 'block', marginBottom: '4px' }}>Semana de Inicio (1-18)</label>
                <input
                  type="number"
                  min="1"
                  max="18"
                  value={newTaskStart}
                  onChange={e => setNewTaskStart(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', background: '#060913', border: `1px solid ${tokens.colors.border.default}`, borderRadius: tokens.radius.sm, color: '#f8fafc' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.78rem', color: tokens.colors.text.muted, display: 'block', marginBottom: '4px' }}>Duración (Semanas)</label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={newTaskDuration}
                  onChange={e => setNewTaskDuration(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', background: '#060913', border: `1px solid ${tokens.colors.border.default}`, borderRadius: tokens.radius.sm, color: '#f8fafc' }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', color: tokens.colors.text.muted, display: 'block', marginBottom: '4px' }}>Responsable (Iniciales)</label>
              <select
                value={newTaskAssignee}
                onChange={e => setNewTaskAssignee(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', background: '#060913', border: `1px solid ${tokens.colors.border.default}`, borderRadius: tokens.radius.sm, color: '#f8fafc' }}
              >
                <option value="JZ">JZ - Ing. Juan Zapata</option>
                <option value="MR">MR - Arq. Marcelo Rodríguez</option>
                <option value="AP">AP - Capataz Antonio Pérez</option>
                <option value="LG">LG - Subcontrato Lucas Gómez</option>
              </select>
            </div>

            <Button variant="primary" size="md" style={{ width: '100%', marginTop: '6px' }} icon="📅">
              Guardar Tarea en Gantt
            </Button>
          </form>
        </Modal>
      )}

    </div>
  );
}
