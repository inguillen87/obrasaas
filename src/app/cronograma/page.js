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
  const [zoomLevel, setZoomLevel] = useState('Semanas');
  const [viewMode, setViewMode] = useState('Gantt Completo');
  const [assigneeFilter, setAssigneeFilter] = useState('Todos');
  const [selectedTask, setSelectedTask] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [rainDaysSim, setRainDaysSim] = useState(0);
  const [exportToast, setExportToast] = useState(false);
  
  // New task form state
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskGroup, setNewTaskGroup] = useState('Estructura');
  const [newTaskStart, setNewTaskStart] = useState(1);
  const [newTaskDuration, setNewTaskDuration] = useState(2);
  const [newTaskAssignee, setNewTaskAssignee] = useState('JZ');

  const { isMobile, isTablet } = useBreakpoint();
  
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
  const totalTasks = tasks.length;
  const onTrackCount = tasks.filter(t => t.status === 'on-track' || t.status === 'completed').length;
  const onTrackPct = Math.round((onTrackCount / totalTasks) * 100);
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
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <Link href="/dashboard" style={{ textDecoration: 'none' }}>
              <Button variant="ghost">← Dashboard</Button>
            </Link>
            <Button variant="secondary" icon="📥" onClick={handleExportCSV}>Exportar CSV / Excel</Button>
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
              {['Gantt Completo', 'Lookahead 4 Semanas', 'Ruta Crítica'].map(mode => (
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

        {/* Main Workspace Area */}
        <div style={{ display: 'flex', gap: '24px', flex: 1, minHeight: '500px' }}>
          
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
            <span style={{ fontWeight: '600' }}>{totalTasks}</span>
          </div>
          <div>
            <span style={{ color: tokens.colors.text.muted }}>On Track: </span>
            <span style={{ fontWeight: '600', color: tokens.colors.accent.success }}>{onTrackPct}%</span>
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
