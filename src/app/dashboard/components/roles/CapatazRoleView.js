'use client';

import React from 'react';
import Link from 'next/link';

export default function CapatazRoleView({
  state,
  setState,
  addToast
}) {
  const attendanceList = Object.keys(state.attendance || {}).map(name => ({ name, ...state.attendance[name] }));
  const presentCount = attendanceList.filter(a => a.status?.includes('Presente')).length;
  const tasksList = Object.keys(state.tasks || {}).map(id => ({ id, ...state.tasks[id] }));

  const handleQuickTaskProgress = (taskId, newPct) => {
    setState(prev => {
      const updatedTasks = { ...prev.tasks };
      if (updatedTasks[taskId]) {
        updatedTasks[taskId] = { ...updatedTasks[taskId], progress: newPct };
      }
      return { ...prev, tasks: updatedTasks };
    });
    addToast(`⚡ Tarea actualizada al ${newPct}% por Jefe de Campo. Sincronizado en Gantt.`, 'success');
  };

  return (
    <div className="role-view capataz-view animate-fade-in-up">
      {/* Role Header Banner */}
      <div className="glass-panel-premium" style={{ marginBottom: '20px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', borderLeft: '4px solid #22c55e', background: 'linear-gradient(90deg, rgba(34, 197, 94, 0.08) 0%, rgba(15, 23, 42, 0.6) 100%)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ padding: '3px 8px', borderRadius: '6px', background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              👷 Jefe de Obra & Operaciones de Terreno
            </span>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Responsable: <strong>Capataz Juan Gómez / Luis Martínez</strong></span>
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', margin: 0 }}>
            Panel de Cuadrillas, Asistencia Satelital & Tareas de Hoy
          </h2>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '2px 0 0' }}>
            Control de presentismo por geocerca GPS, validación de ART UOCRA, reporte de novedades por voz y avance de tareas.
          </p>
        </div>

        {/* Quick Action Toolbar */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Link href="/webview/attendance?worker=juan&token=direct" style={{ textDecoration: 'none' }}>
            <button 
              className="btn btn-sm"
              style={{ background: '#22c55e', color: '#0f172a', fontWeight: 800, fontSize: '0.78rem', padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <i className="fa-solid fa-location-dot"></i> Fichar Cuadrilla
            </button>
          </Link>
          <button 
            onClick={() => addToast('🚨 Reporte de Emergencia: Enviando alerta de audio al bot de WhatsApp...', 'warning')}
            className="btn btn-sm"
            style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.4)', fontSize: '0.78rem', padding: '8px 14px', borderRadius: '8px' }}
          >
            <i className="fa-solid fa-triangle-exclamation"></i> Reportar Incidencia
          </button>
          <Link href="/poster" style={{ textDecoration: 'none' }}>
            <button 
              className="btn btn-sm btn-secondary"
              style={{ fontSize: '0.78rem', padding: '8px 14px', borderRadius: '8px', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.3)' }}
            >
              <i className="fa-solid fa-qrcode"></i> Cartel QR Obra
            </button>
          </Link>
        </div>
      </div>

      {/* Capataz Specific KPIs */}
      <div className="grid-4" style={{ marginBottom: '24px' }}>
        <div className="glass-panel-premium dashboard-card-hover stat-card">
          <div className="stat-icon success"><i className="fa-solid fa-user-check"></i></div>
          <div className="stat-content">
            <span className="stat-value">{presentCount} / {attendanceList.length || 8}</span>
            <span className="stat-label">Operarios en Terreno (GPS OK)</span>
          </div>
        </div>
        <div className="glass-panel-premium dashboard-card-hover stat-card">
          <div className="stat-icon primary"><i className="fa-solid fa-shield-halved"></i></div>
          <div className="stat-content">
            <span className="stat-value">100%</span>
            <span className="stat-label">Pólizas ART Vigentes (SRT)</span>
          </div>
        </div>
        <div className="glass-panel-premium dashboard-card-hover stat-card">
          <div className="stat-icon info"><i className="fa-solid fa-helmet-safety"></i></div>
          <div className="stat-content">
            <span className="stat-value">95%</span>
            <span className="stat-label">Conformidad EPP (Edge AI)</span>
          </div>
        </div>
        <div className="glass-panel-premium dashboard-card-hover stat-card">
          <div className="stat-icon warning"><i className="fa-solid fa-list-check"></i></div>
          <div className="stat-content">
            <span className="stat-value">{tasksList.length}</span>
            <span className="stat-label">Frentes de Trabajo Activos</span>
          </div>
        </div>
      </div>

      {/* 1-Click Task Progress Matrix */}
      <div className="glass-panel-premium dashboard-card-hover" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-heading)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-bolt" style={{ color: '#fbbf24' }}></i> Asignación y Avance Rápido de Cuadrillas (Hoy)
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Hacé click para certificar el avance de cada tarea sin abrir el Gantt</span>
          </div>
          <span className="badge badge-success"><i className="fa-solid fa-clock"></i> Jornada Activa</span>
        </div>

        <div className="grid-2" style={{ gap: '14px' }}>
          {tasksList.map(task => (
            <div key={task.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <strong style={{ fontSize: '0.9rem', color: '#fff', display: 'block' }}>{task.name}</strong>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Asignado: <strong style={{ color: '#38bdf8' }}>{task.assignee}</strong> • Días: {task.duration}d</span>
                </div>
                <span className="badge badge-primary" style={{ fontSize: '0.75rem', fontWeight: 800 }}>
                  {task.progress}%
                </span>
              </div>

              {/* Progress Bar */}
              <div style={{ background: 'rgba(255,255,255,0.05)', height: '6px', borderRadius: '3px', overflow: 'hidden', marginBottom: '12px' }}>
                <div style={{ width: `${task.progress}%`, height: '100%', background: task.progress === 100 ? '#22c55e' : '#f59e0b', borderRadius: '3px', transition: 'width 0.3s' }}></div>
              </div>

              {/* Quick Update Buttons */}
              <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                {[25, 50, 75, 100].map(pct => (
                  <button
                    key={pct}
                    onClick={() => handleQuickTaskProgress(task.id, pct)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      border: task.progress === pct ? '1px solid #22c55e' : '1px solid rgba(255,255,255,0.1)',
                      background: task.progress === pct ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255,255,255,0.03)',
                      color: task.progress === pct ? '#4ade80' : '#cbd5e1',
                      cursor: 'pointer'
                    }}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Attendance History Table & CCTV Row */}
      <div className="grid-2" style={{ marginBottom: '24px' }}>
        {/* Attendance Matrix */}
        <div className="glass-panel-premium dashboard-card-hover">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-users" style={{ color: '#22c55e' }}></i> Cuadrilla en Obra (Fichajes Satelitales)
            </h3>
            <span className="badge badge-success">Radio: 100m</span>
          </div>

          <table className="logs-table">
            <thead>
              <tr>
                <th>Operario</th>
                <th>Oficio</th>
                <th>Check-in</th>
                <th>Geocerca</th>
              </tr>
            </thead>
            <tbody>
              {attendanceList.map(item => (
                <tr key={item.name}>
                  <td><strong>{item.name}</strong></td>
                  <td><span className="badge badge-secondary" style={{ fontSize: '0.68rem' }}>{item.role}</span></td>
                  <td>{item.checkin || '08:00 AM'}</td>
                  <td>
                    <span style={{ fontSize: '0.72rem', color: '#4ade80', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <i className="fa-solid fa-satellite-dish"></i> {item.distanceMeters ?? 0}m (OK)
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Safety & CCTV Alerts */}
        <div className="glass-panel-premium dashboard-card-hover">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-shield-halved" style={{ color: '#ef4444' }}></i> Seguridad & Higiene (CCTV Edge AI)
            </h3>
            <span className="badge badge-danger">1 Alerta Activa</span>
          </div>

          <div style={{ height: '160px', background: 'url(/cctv_render.png) center/cover no-repeat', borderRadius: '10px', marginBottom: '12px', border: '1px solid var(--border-color)', position: 'relative' }}>
            <div style={{ position: 'absolute', bottom: '8px', left: '8px', background: 'rgba(0,0,0,0.8)', padding: '4px 8px', borderRadius: '6px', fontSize: '0.7rem', color: '#f87171', fontWeight: 'bold' }}>
              ⚠️ Zona Caliente: Detección EPP Requerido
            </div>
          </div>

          <div style={{ background: 'rgba(239,68,68,0.1)', borderLeft: '3px solid #ef4444', padding: '10px 12px', borderRadius: '0 8px 8px 0', fontSize: '0.75rem', color: '#f87171' }}>
            <strong>Recordatorio de ART:</strong> Obligatorio uso de calzado dieléctrico y arnés en trabajos a más de 2 metros de altura (Res. SRT 319/99).
          </div>
        </div>
      </div>
    </div>
  );
}
