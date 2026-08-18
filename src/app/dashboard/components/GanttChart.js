"use client";

import React, { useState, useEffect, useRef } from 'react';

export default function GanttChart({
    state,
    setState,
    activeTab,
    setShowAddTaskModal,
    setShowEditTaskModal,
    setEditTaskId,
    setEditTaskName,
    setEditTaskAssignee,
    setEditTaskStart,
    setEditTaskDuration,
    setEditTaskProgress,
    setShowReceiveMaterialModal,
    setReceiveMaterialKey
}) {
  const [ganttQuincenaView, setGanttQuincenaView] = useState('todas');
  const svgLinesRef = useRef(null);

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
    // addToast might be missing, but we can just skip it here or use console.log
    console.log("Proveedor confirmado (2 días antes). Tarea 'Revestimiento Cerámico' desbloqueada en el Gantt.");
  };

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

  return (
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
  );
}
