'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';

export default function CapatazRoleView({
  state,
  setState,
  addToast
}) {
  const attendanceList = Object.keys(state.attendance || {}).map(name => ({ name, ...state.attendance[name] }));
  const presentCount = attendanceList.filter(a => a.status?.includes('Presente')).length;
  const tasksList = Object.keys(state.tasks || {}).map(id => ({ id, ...state.tasks[id] }));

  // Modals state
  const [showRemitoModal, setShowRemitoModal] = useState(false);
  const [showRainModal, setShowRainModal] = useState(false);
  const [showCharlaModal, setShowCharlaModal] = useState(false);

  // Remito Form State
  const [remitoData, setRemitoData] = useState({
    supplier: 'Hormisur / Cemento Avellaneda',
    driver: 'Roberto Benítez (Patente AF 234 JK)',
    remitoNum: 'R-0004-00084920',
    cae: '74910284719283',
    volumeM3: 8,
    slumpCm: 12,
    tempC: 18,
    sealNum: 'AR-99381',
    mixType: 'H-21 Bombeable (CIRSOC 201)',
  });
  const [remitoSigned, setRemitoSigned] = useState(false);

  // Rain Protocol State
  const [rainMm, setRainMm] = useState(14);
  const [rainReason, setRainReason] = useState('Lluvia intensa y riesgo eléctrico en encofrados');
  const [rainDeclared, setRainDeclared] = useState(false);

  // Safety Briefing State
  const [charlaDone, setCharlaDone] = useState(false);

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

  const handleFicharTodaCuadrilla = () => {
    setState(prev => {
      const updatedAttendance = { ...prev.attendance };
      const names = ['Juan Gómez', 'Luis Martínez', 'Darío Fernández', 'Carlos Véliz', 'Marcelo Sosa', 'Jorge Benítez', 'Pablo Almirón', 'Esteban Suárez'];
      const roles = ['Oficial Albañil', 'Medio Oficial', 'Ayudante', 'Armador', 'Carpintero', 'Electricista', 'Sanitarista', 'Pintor'];

      names.forEach((name, idx) => {
        updatedAttendance[name] = {
          role: roles[idx] || 'Operario',
          status: 'Presente (GPS)',
          checkin: '07:55 AM',
          distanceMeters: Math.floor(Math.random() * 30) + 15,
          artStatus: 'Vigente (La Segunda)'
        };
      });

      return { ...prev, attendance: updatedAttendance };
    });
    addToast('👷 Toda la cuadrilla (8 operarios) fichada dentro de geocerca GPS. ART y aptos validados.', 'success');
  };

  const handleConfirmRemito = () => {
    setState(prev => {
      const currentHormigon = prev.stockpiles?.hormigon?.current || 4;
      const updatedStockpiles = {
        ...prev.stockpiles,
        hormigon: {
          current: currentHormigon + remitoData.volumeM3,
          max: 30,
          unit: 'm³',
          status: 'Normal'
        }
      };
      const updatedRemitos = [
        ...(prev.remitos || []),
        {
          id: remitoData.remitoNum,
          supplier: remitoData.supplier,
          material: `Hormigón Elaborado ${remitoData.mixType}`,
          quantity: `${remitoData.volumeM3} m³`,
          date: new Date().toLocaleDateString(),
          signedBy: 'Capataz Miguel Silva',
          cae: remitoData.cae,
          hash: 'SHA256-REMITO-' + Date.now().toString(36).toUpperCase()
        }
      ];
      return { ...prev, stockpiles: updatedStockpiles, remitos: updatedRemitos };
    });
    setRemitoSigned(true);
    setShowRemitoModal(false);
    addToast(`🚚 Camión Mixer recibido: ${remitoData.volumeM3} m³ de hormigón sumados al acopio. Remito firmado conforme.`, 'success');
  };

  const handleDeclareRain = () => {
    setRainDeclared(true);
    setShowRainModal(false);
    addToast(`🌧️ Suspensión por lluvia asentada (Art. 21 CCT 76/75). Horas mínimas (2.5hs) garantizadas a la cuadrilla.`, 'warning');
  };

  const handleConfirmCharla = () => {
    setCharlaDone(true);
    setShowCharlaModal(false);
    addToast(`🦺 Charla de 5 minutos 'Riesgos en Altura' registrada con 8 firmas digitales.`, 'success');
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
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Responsable: <strong>Capataz Miguel Silva / Luis Martínez</strong></span>
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', margin: 0 }}>
            Panel de Cuadrillas, Asistencia Satelital & Control de Obra
          </h2>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '2px 0 0' }}>
            Control de presentismo por geocerca GPS, validación de ART UOCRA, remitos de camiones y libro de novedades diarias.
          </p>
        </div>

        {/* Quick Action Toolbar */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button 
            onClick={handleFicharTodaCuadrilla}
            className="btn btn-sm"
            style={{ background: '#22c55e', color: '#0f172a', fontWeight: 800, fontSize: '0.78rem', padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <i className="fa-solid fa-users-viewfinder"></i> Fichar Cuadrilla Completa
          </button>
          <button 
            onClick={() => setShowRemitoModal(true)}
            className="btn btn-sm"
            style={{ background: '#38bdf8', color: '#0f172a', fontWeight: 800, fontSize: '0.78rem', padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <i className="fa-solid fa-truck-ramp-box"></i> Recibir Camión Mixer
          </button>
          <button 
            onClick={() => setShowRainModal(true)}
            className="btn btn-sm btn-secondary"
            style={{ fontSize: '0.78rem', padding: '8px 14px', borderRadius: '8px', color: '#fbbf24', borderColor: 'rgba(245, 158, 11, 0.4)' }}
          >
            <i className="fa-solid fa-cloud-showers-heavy"></i> Parte de Lluvia
          </button>
          <button 
            onClick={() => setShowCharlaModal(true)}
            className="btn btn-sm btn-secondary"
            style={{ fontSize: '0.78rem', padding: '8px 14px', borderRadius: '8px', color: '#34d399', borderColor: 'rgba(16, 185, 129, 0.4)' }}
          >
            <i className="fa-solid fa-clipboard-check"></i> Charla 5 Min
          </button>
        </div>
      </div>

      {/* Capataz Specific KPIs */}
      <div className="grid-4" style={{ marginBottom: '24px' }}>
        <div className="glass-panel-premium dashboard-card-hover stat-card">
          <div className="stat-icon success"><i className="fa-solid fa-user-check"></i></div>
          <div className="stat-content">
            <span className="stat-value">{presentCount || 8} / {attendanceList.length || 8}</span>
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
            <span className="stat-value">98%</span>
            <span className="stat-label">Conformidad EPP (Edge AI)</span>
          </div>
        </div>
        <div className="glass-panel-premium dashboard-card-hover stat-card">
          <div className="stat-icon warning"><i className="fa-solid fa-list-check"></i></div>
          <div className="stat-content">
            <span className="stat-value">{tasksList.length || 6}</span>
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
          {(tasksList.length > 0 ? tasksList : [
            { id: 't1', name: 'Armado de Armaduras Losa Nivel +3', assignee: 'Carlos Véliz & Cuadrilla', duration: 4, progress: 85 },
            { id: 't2', name: 'Encofrado de Vigas Perimetrales V-12', assignee: 'Marcelo Sosa (Carpintero)', duration: 3, progress: 60 },
            { id: 't3', name: 'Mampostería Ladrillo Portante Piso 2', assignee: 'Juan Gómez (Oficial)', duration: 6, progress: 45 },
            { id: 't4', name: 'Canalización Sanitaria Descargas 110mm', assignee: 'Pablo Almirón (Sanitarista)', duration: 2, progress: 100 },
          ]).map(task => (
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
              {(attendanceList.length > 0 ? attendanceList : [
                { name: 'Juan Gómez', role: 'Oficial Albañil', checkin: '07:55 AM', distanceMeters: 32 },
                { name: 'Luis Martínez', role: 'Medio Oficial', checkin: '07:58 AM', distanceMeters: 28 },
                { name: 'Darío Fernández', role: 'Ayudante', checkin: '08:00 AM', distanceMeters: 45 },
                { name: 'Carlos Véliz', role: 'Armador', checkin: '07:50 AM', distanceMeters: 21 },
              ]).map(item => (
                <tr key={item.name}>
                  <td><strong>{item.name}</strong></td>
                  <td><span className="badge badge-secondary" style={{ fontSize: '0.68rem' }}>{item.role}</span></td>
                  <td>{item.checkin || '08:00 AM'}</td>
                  <td>
                    <span style={{ fontSize: '0.72rem', color: '#4ade80', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <i className="fa-solid fa-satellite-dish"></i> {item.distanceMeters ?? 25}m (OK)
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
            <span className="badge badge-success">Zona Asegurada</span>
          </div>

          <div style={{ height: '160px', background: 'url(/cctv_render.png) center/cover no-repeat', borderRadius: '10px', marginBottom: '12px', border: '1px solid var(--border-color)', position: 'relative' }}>
            <div style={{ position: 'absolute', bottom: '8px', left: '8px', background: 'rgba(0,0,0,0.8)', padding: '4px 8px', borderRadius: '6px', fontSize: '0.7rem', color: '#4ade80', fontWeight: 'bold' }}>
              🟢 Cámara Sector Losa: Cascos &amp; Arnés Detectados (100%)
            </div>
          </div>

          <div style={{ background: 'rgba(34, 197, 94, 0.08)', borderLeft: '3px solid #22c55e', padding: '10px 12px', borderRadius: '0 8px 8px 0', fontSize: '0.75rem', color: '#86efac' }}>
            <strong>Cumplimiento Normativo:</strong> Cuadrilla completa con calzado de seguridad, casco homologado y arnés de dos colas (Res. SRT 319/99).
          </div>
        </div>
      </div>

      {/* MODAL 1: RECEPCIÓN DE CAMIÓN MIXER CON REMITO DIGITAL */}
      {showRemitoModal && (
        <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9999 }}>
          <div className="glass-card modal-content" style={{ maxWidth: '560px', width: '90%', background: '#0b1120', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '14px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-truck-moving"></i> Recepción de Camión Hormigonero
              </h3>
              <i className="fa-solid fa-xmark" onClick={() => setShowRemitoModal(false)} style={{ cursor: 'pointer', fontSize: '1.2rem', color: '#94a3b8' }}></i>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px', background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.75rem' }}>
              <div><span style={{ color: '#94a3b8' }}>Proveedor:</span> <strong style={{ color: '#fff' }}>{remitoData.supplier}</strong></div>
              <div><span style={{ color: '#94a3b8' }}>Chofer:</span> <strong style={{ color: '#fff' }}>{remitoData.driver}</strong></div>
              <div><span style={{ color: '#94a3b8' }}>Remito Oficial:</span> <strong style={{ color: '#38bdf8' }}>{remitoData.remitoNum}</strong></div>
              <div><span style={{ color: '#94a3b8' }}>CAE AFIP:</span> <code style={{ color: '#fbbf24' }}>{remitoData.cae}</code></div>
              <div><span style={{ color: '#94a3b8' }}>Volumen:</span> <strong style={{ color: '#4ade80' }}>{remitoData.volumeM3} m³</strong></div>
              <div><span style={{ color: '#94a3b8' }}>Dosificación:</span> <strong style={{ color: '#fff' }}>{remitoData.mixType}</strong></div>
              <div><span style={{ color: '#94a3b8' }}>Asentamiento (Abrams):</span> <strong style={{ color: '#4ade80' }}>{remitoData.slumpCm} cm (OK)</strong></div>
              <div><span style={{ color: '#94a3b8' }}>Precinto Seguridad:</span> <strong style={{ color: '#fff' }}>#{remitoData.sealNum}</strong></div>
            </div>

            {/* Verification Checklist */}
            <div style={{ background: 'rgba(34, 197, 94, 0.08)', borderLeft: '3px solid #22c55e', padding: '10px 12px', borderRadius: '0 8px 8px 0', fontSize: '0.75rem', color: '#86efac', marginBottom: '16px' }}>
              <i className="fa-solid fa-check"></i> Ensayo de consistencia verificado en obra. Temperatura de masa: 18°C. Probetas testigo moldeadas conforme IRAM 1534.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button 
                onClick={() => setShowRemitoModal(false)}
                className="btn btn-secondary btn-sm"
                style={{ padding: '8px 16px', fontSize: '0.8rem' }}
              >
                Cancelar
              </button>
              <button 
                onClick={handleConfirmRemito}
                className="btn btn-primary btn-sm"
                style={{ padding: '8px 18px', fontSize: '0.8rem', fontWeight: 800, background: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: '8px' }}
              >
                <i className="fa-solid fa-signature"></i> Firmar Conforme &amp; Sumar al Acopio
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: PARTE DIARIO DE LLUVIA UOCRA (ART. 21 CCT 76/75) */}
      {showRainModal && (
        <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9999 }}>
          <div className="glass-card modal-content" style={{ maxWidth: '520px', width: '90%', background: '#0b1120', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '14px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-cloud-showers-water"></i> Declaración de Suspensión por Lluvia
              </h3>
              <i className="fa-solid fa-xmark" onClick={() => setShowRainModal(false)} style={{ cursor: 'pointer', fontSize: '1.2rem', color: '#94a3b8' }}></i>
            </div>

            <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0 0 14px' }}>
              De acuerdo al <strong>Convenio Colectivo UOCRA CCT 76/75 (Art. 21)</strong>, la suspensión por inclemencias climáticas garantiza el cobro de la jornada mínima de presentación (2.5 horas) a los operarios presentes.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '18px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Milímetros acumulados (Pluviómetro de Obra)</label>
                <input 
                  type="number" 
                  value={rainMm} 
                  onChange={(e) => setRainMm(Number(e.target.value))} 
                  className="form-input" 
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-color)', color: '#fff', fontSize: '0.85rem' }} 
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Causa Técnica / Medidas de Seguridad Adoptadas</label>
                <textarea 
                  value={rainReason} 
                  onChange={(e) => setRainReason(e.target.value)} 
                  rows={2} 
                  className="form-input" 
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-color)', color: '#fff', fontSize: '0.8rem' }} 
                />
              </div>
            </div>

            <div style={{ background: 'rgba(245, 158, 11, 0.08)', borderLeft: '3px solid #fbbf24', padding: '10px 12px', borderRadius: '0 8px 8px 0', fontSize: '0.72rem', color: '#fde68a', marginBottom: '16px' }}>
              Se pausarán las tareas exteriores de hormigonado y andamios. Se reubicará a la cuadrilla en tareas protegidas o repliegue seguro.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button 
                onClick={() => setShowRainModal(false)}
                className="btn btn-secondary btn-sm"
                style={{ padding: '8px 16px', fontSize: '0.8rem' }}
              >
                Cancelar
              </button>
              <button 
                onClick={handleDeclareRain}
                className="btn btn-primary btn-sm"
                style={{ padding: '8px 18px', fontSize: '0.8rem', fontWeight: 800, background: '#f59e0b', color: '#0f172a', border: 'none', borderRadius: '8px' }}
              >
                <i className="fa-solid fa-cloud-bolt"></i> Confirmar Suspensión UOCRA
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: REGISTRO DE CHARLA DE 5 MINUTOS */}
      {showCharlaModal && (
        <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9999 }}>
          <div className="glass-card modal-content" style={{ maxWidth: '520px', width: '90%', background: '#0b1120', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '14px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#34d399', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-clipboard-check"></i> Registro Diario de Charla de Seguridad (5 Min)
              </h3>
              <i className="fa-solid fa-xmark" onClick={() => setShowCharlaModal(false)} style={{ cursor: 'pointer', fontSize: '1.2rem', color: '#94a3b8' }}></i>
            </div>

            <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0 0 14px' }}>
              Cumplimiento del Programa de Seguridad SRT Res. 319/99 y 299/11 previo al inicio de la jornada de obra:
            </p>

            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>
                Tema: Prevención de Caídas en Altura & Uso de Cabo de Vida en Losa +3
              </div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '10px' }}>
                Capataz instructor: <strong>Miguel Silva</strong> • Hora: <strong>08:05 AM</strong>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#38bdf8' }}>
                Asistentes firmantes: <strong>8 operarios</strong> (Juan Gómez, Luis Martínez, Darío Fernández, Carlos Véliz, etc.)
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button 
                onClick={() => setShowCharlaModal(false)}
                className="btn btn-secondary btn-sm"
                style={{ padding: '8px 16px', fontSize: '0.8rem' }}
              >
                Cancelar
              </button>
              <button 
                onClick={handleConfirmCharla}
                className="btn btn-primary btn-sm"
                style={{ padding: '8px 18px', fontSize: '0.8rem', fontWeight: 800, background: '#10b981', color: '#0f172a', border: 'none', borderRadius: '8px' }}
              >
                <i className="fa-solid fa-file-signature"></i> Asentar Charla en Libro de Obra
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
