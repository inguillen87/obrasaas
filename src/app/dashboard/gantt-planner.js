'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildGanttModel,
  dependencyCycle,
  earliestGanttStartDay,
  ganttDateForDay,
  ganttDayForDate,
  ganttTaskDependencies,
  ganttTaskStartDay,
} from '@/lib/gantt';
import styles from './gantt-planner.module.css';
import { useModalFocus } from './use-modal-focus';

const SCALE_OPTIONS = [
  { days: 1, label: 'Días' },
  { days: 7, label: 'Semanas' },
  { days: 30, label: 'Meses' },
];

function integer(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(parsed)));
}

function dateKey(value) {
  return value instanceof Date && !Number.isNaN(value.getTime())
    ? value.toISOString().slice(0, 10)
    : '';
}

function formatDate(value, options = {}) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null;
  return new Intl.DateTimeFormat('es-AR', { timeZone: 'UTC', ...options }).format(value);
}

function taskId() {
  if (globalThis.crypto?.randomUUID) return `task-${globalThis.crypto.randomUUID()}`;
  return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function legacyOffset(startDay) {
  return Math.min(100, Math.max(0, ((integer(startDay, 1, 1, 3_650) - 1) / 13) * 100));
}

function progressAverage(tasks) {
  const values = Object.values(tasks || {});
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, task) => (
    sum + integer(task?.progress, 0, 0, 100)
  ), 0) / values.length);
}

function emptyEditor(startDay = 1) {
  return {
    id: null,
    name: '',
    assigneeId: '',
    startDay,
    duration: 5,
    progress: 0,
    dependencies: [],
  };
}

function StatusPill({ tone, children }) {
  return <span className={`${styles.status} ${styles[tone]}`}>{children}</span>;
}

export default function GanttPlanner({
  canManage,
  canonicalMode = false,
  fieldWorkers,
  onCanonicalTaskChange,
  onCanonicalTaskDelete,
  onTasksChange,
  onToast,
  project,
  tasks,
}) {
  const [unitDays, setUnitDays] = useState(null);
  const [editor, setEditor] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const svgRef = useRef(null);
  const rowsRef = useRef(null);
  const barRefs = useRef(new Map());
  const projectStartsAt = project?.startsAt || null;
  const projectEndsAt = project?.endsAt || null;

  const automaticModel = useMemo(() => buildGanttModel(tasks, {
    projectStartsAt,
    projectEndsAt,
  }), [projectEndsAt, projectStartsAt, tasks]);
  const model = useMemo(() => buildGanttModel(tasks, {
    projectStartsAt,
    projectEndsAt,
    unitDays: unitDays || automaticModel.unitDays,
  }), [automaticModel.unitDays, projectEndsAt, projectStartsAt, tasks, unitDays]);
  const selectedScale = unitDays || automaticModel.unitDays;
  const chartWidth = Math.max(760, 250 + model.columns.length * (selectedScale === 1 ? 48 : 74));

  const drawDependencies = useCallback(() => {
    const svg = svgRef.current;
    const rows = rowsRef.current;
    if (!svg || !rows) return;
    const rect = rows.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
    svg.replaceChildren();

    const namespace = 'http://www.w3.org/2000/svg';
    const defs = document.createElementNS(namespace, 'defs');
    for (const [id, color] of [['gantt-arrow', '#ff9f1c'], ['gantt-arrow-risk', '#ef4444']]) {
      const marker = document.createElementNS(namespace, 'marker');
      marker.setAttribute('id', id);
      marker.setAttribute('viewBox', '0 0 10 10');
      marker.setAttribute('refX', '8');
      marker.setAttribute('refY', '5');
      marker.setAttribute('markerWidth', '6');
      marker.setAttribute('markerHeight', '6');
      marker.setAttribute('orient', 'auto-start-reverse');
      const arrow = document.createElementNS(namespace, 'path');
      arrow.setAttribute('d', 'M 0 1.5 L 8 5 L 0 8.5 z');
      arrow.setAttribute('fill', color);
      marker.appendChild(arrow);
      defs.appendChild(marker);
    }
    svg.appendChild(defs);

    for (const edge of model.dependencyEdges) {
      const from = barRefs.current.get(edge.fromId);
      const to = barRefs.current.get(edge.toId);
      if (!from || !to) continue;
      const fromRect = from.getBoundingClientRect();
      const toRect = to.getBoundingClientRect();
      const x1 = fromRect.right - rect.left;
      const y1 = fromRect.top + fromRect.height / 2 - rect.top;
      const x2 = toRect.left - rect.left;
      const y2 = toRect.top + toRect.height / 2 - rect.top;
      const elbow = x2 > x1 ? x1 + (x2 - x1) / 2 : x1 + 18;
      const target = model.taskById.get(edge.toId);
      const risk = Boolean(target?.dependencyConflict);
      const path = document.createElementNS(namespace, 'path');
      path.setAttribute('d', `M ${x1} ${y1} L ${elbow} ${y1} L ${elbow} ${y2} L ${x2} ${y2}`);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', risk ? '#ef4444' : '#ff9f1c');
      path.setAttribute('stroke-opacity', risk ? '0.9' : '0.55');
      path.setAttribute('stroke-width', risk ? '2.2' : '1.6');
      path.setAttribute('marker-end', `url(#${risk ? 'gantt-arrow-risk' : 'gantt-arrow'})`);
      svg.appendChild(path);
    }
  }, [model.dependencyEdges, model.taskById]);

  useEffect(() => {
    const frame = requestAnimationFrame(drawDependencies);
    const observer = typeof ResizeObserver === 'function'
      ? new ResizeObserver(drawDependencies)
      : null;
    if (rowsRef.current) observer?.observe(rowsRef.current);
    window.addEventListener('resize', drawDependencies);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', drawDependencies);
    };
  }, [drawDependencies]);

  function closeEditor() {
    if (!busy) setEditor(null);
  }

  const { captureReturnFocus, dialogRef } = useModalFocus({
    locked: busy,
    onRequestClose: closeEditor,
    open: Boolean(editor),
  });

  function openCreate() {
    const nextStart = model.tasks.length > 0
      ? Math.min(3_650, Math.max(...model.tasks.map((task) => task.endDay)) + 1)
      : 1;
    setError('');
    captureReturnFocus();
    setEditor(emptyEditor(nextStart));
  }

  function openEdit(id) {
    const task = tasks[id];
    if (!task) return;
    setError('');
    captureReturnFocus();
    setEditor({
      id,
      name: task.name || '',
      assigneeId: fieldWorkers.find((worker) => worker.name === task.assignee)?.id || '',
      startDay: ganttTaskStartDay(task),
      duration: integer(task.duration, 1, 1, 3_650),
      progress: integer(task.progress, 0, 0, 100),
      dependencies: ganttTaskDependencies(task, { knownIds: Object.keys(tasks), taskId: id }),
    });
  }

  function updateEditor(field, value) {
    setEditor((current) => ({ ...current, [field]: value }));
    setError('');
  }

  function toggleDependency(id) {
    setEditor((current) => {
      const exists = current.dependencies.includes(id);
      return {
        ...current,
        dependencies: exists
          ? current.dependencies.filter((dependencyId) => dependencyId !== id)
          : [...current.dependencies, id],
      };
    });
    setError('');
  }

  async function persist(nextTasks, successMessage) {
    setBusy(true);
    setError('');
    try {
      const saved = await onTasksChange(nextTasks);
      if (!saved) {
        setError('No se pudo confirmar el cambio. Revisá el estado de sincronización e intentá otra vez.');
        return false;
      }
      if (successMessage) onToast?.(successMessage, 'success');
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function saveTask(event) {
    event.preventDefault();
    if (!canManage) return;
    const name = editor.name.trim();
    if (name.length < 3) {
      setError('El nombre debe tener al menos 3 caracteres.');
      return;
    }
    const id = editor.id || taskId();
    const worker = fieldWorkers.find((candidate) => candidate.id === editor.assigneeId);
    const requestedStartDay = integer(editor.startDay, 1, 1, 3_650);
    const alignedStartDay = earliestGanttStartDay(tasks, editor.dependencies, requestedStartDay);
    const duration = integer(editor.duration, 1, 1, 3_650);
    if (alignedStartDay + duration - 1 > 3_650) {
      setError('La duración supera el horizonte máximo de 3.650 días para esta fecha de inicio.');
      return;
    }
    const previous = tasks[id] || {};
    const nextTasks = {
      ...tasks,
      [id]: {
        ...previous,
        name,
        assignee: worker?.name || 'Sin asignar',
        progress: integer(editor.progress, 0, 0, 100),
        duration,
        startDay: alignedStartDay,
        startOffset: legacyOffset(alignedStartDay),
        dependencies: editor.dependencies,
      },
    };
    const cycle = dependencyCycle(nextTasks);
    if (cycle) {
      setError('Esta selección crea una dependencia circular. Quitá una predecesora antes de guardar.');
      return;
    }
    if (canonicalMode) {
      setBusy(true);
      setError('');
      try {
        const startsAt = projectStartsAt
          ? ganttDateForDay(projectStartsAt, alignedStartDay)?.toISOString?.() || null
          : null;
        const endsAt = startsAt
          ? ganttDateForDay(projectStartsAt, alignedStartDay + duration - 1)?.toISOString?.() || null
          : null;
        const progress = integer(editor.progress, 0, 0, 100);
        const payload = {
          title: name,
          assignee: worker?.name || null,
          progress,
          status: progress >= 100 ? 'DONE' : progress > 0 ? 'IN_PROGRESS' : 'READY',
          startsAt,
          endsAt,
          schedule: {
            startDay: alignedStartDay,
            durationDays: duration,
          },
          dependencies: editor.dependencies,
          ...(editor.id ? { expectedRevision: Number(previous.revision) || 0 } : {}),
        };
        const response = await fetch(
          editor.id ? `/api/tasks/${encodeURIComponent(editor.id)}` : '/api/tasks',
          {
            method: editor.id ? 'PATCH' : 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          },
        );
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.task) {
          throw new Error(result.error || 'No se pudo guardar la tarea canónica.');
        }
        onCanonicalTaskChange?.(result.task);
        onToast?.(editor.id ? 'Tarea canónica actualizada.' : 'Tarea canónica incorporada al WBS.', 'success');
        setEditor(null);
      } catch (canonicalError) {
        setError(canonicalError.message);
      } finally {
        setBusy(false);
      }
      return;
    }
    const saved = await persist(
      nextTasks,
      editor.id ? 'Tarea y secuencia actualizadas.' : 'Tarea incorporada al cronograma.',
    );
    if (saved) {
      if (alignedStartDay > requestedStartDay) {
        onToast?.(`La tarea se alineó al día ${alignedStartDay} para respetar sus predecesoras.`, 'info');
      }
      setEditor(null);
    }
  }

  async function deleteTask() {
    if (!editor?.id) return;
    const dependentCount = Object.values(tasks).filter((task) => (
      ganttTaskDependencies(task).includes(editor.id)
    )).length;
    const warning = dependentCount > 0
      ? `También se quitará esta predecesora de ${dependentCount} tarea${dependentCount === 1 ? '' : 's'} dependiente${dependentCount === 1 ? '' : 's'}.`
      : 'Esta acción no borra incidencias, asistencia ni evidencias.';
    if (!window.confirm(`¿Eliminar “${tasks[editor.id]?.name || 'esta tarea'}”? ${warning}`)) return;
    if (canonicalMode) {
      setBusy(true);
      setError('');
      try {
        const response = await fetch(`/api/tasks/${encodeURIComponent(editor.id)}`, { method: 'DELETE' });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'No se pudo eliminar la tarea canónica.');
        onCanonicalTaskDelete?.(editor.id);
        onToast?.('Tarea canónica eliminada.', 'success');
        setEditor(null);
      } catch (deleteError) {
        setError(deleteError.message);
      } finally {
        setBusy(false);
      }
      return;
    }
    const nextTasks = Object.fromEntries(
      Object.entries(tasks)
        .filter(([id]) => id !== editor.id)
        .map(([id, task]) => [id, {
          ...task,
          dependencies: ganttTaskDependencies(task).filter((dependencyId) => dependencyId !== editor.id),
        }]),
    );
    const saved = await persist(nextTasks, 'Tarea eliminada sin alterar el resto de la obra.');
    if (saved) setEditor(null);
  }

  async function clearSchedule() {
    if (model.tasks.length === 0) return;
    if (!window.confirm('¿Vaciar solamente el cronograma? Se eliminarán las tareas y sus dependencias; la asistencia, los materiales, las incidencias y las evidencias permanecerán intactas.')) return;
    await persist({}, 'Cronograma vaciado. Los demás registros de la obra no se modificaron.');
  }

  const selectedEarliestStart = editor
    ? earliestGanttStartDay(tasks, editor.dependencies, editor.startDay)
    : 1;
  const projectStartDate = projectStartsAt ? ganttDateForDay(projectStartsAt, 1) : null;
  const projectEndDate = projectEndsAt ? new Date(projectEndsAt) : null;
  const planLabel = projectStartDate && projectEndDate && !Number.isNaN(projectEndDate.getTime())
    ? `${formatDate(projectStartDate, { day: '2-digit', month: 'short', year: 'numeric' })} — ${formatDate(projectEndDate, { day: '2-digit', month: 'short', year: 'numeric' })}`
    : model.startsAt && model.endsAt
      ? `${formatDate(model.startsAt, { day: '2-digit', month: 'short', year: 'numeric' })} — ${formatDate(model.endsAt, { day: '2-digit', month: 'short', year: 'numeric' })}`
    : `${model.totalDays} días de planificación relativa`;

  return (
    <div className={styles.planner}>
      <div className={styles.topbar}>
        <div>
          <span className={styles.eyebrow}>Plan maestro de ejecución</span>
          <h1>Cronograma y dependencias</h1>
          <p>{planLabel} · La secuencia se guarda por obra y por tenant.</p>
        </div>
        <div className={styles.primaryActions}>
          <Link className={styles.reportButton} href="/dashboard/report">Reporte semanal</Link>
          <button type="button" className={styles.addButton} disabled={!canManage || busy} onClick={openCreate}>+ Nueva tarea</button>
        </div>
      </div>

      <div className={styles.metrics} aria-label="Indicadores del cronograma">
        <article><span>Avance ponderado simple</span><strong>{progressAverage(tasks)}%</strong><small>{model.completeTasks} de {model.tasks.length} finalizadas</small></article>
        <article><span>Horizonte visible</span><strong>{model.totalDays}</strong><small>días planificados</small></article>
        <article><span>Dependencias reales</span><strong>{model.dependencyCount}</strong><small>relaciones configuradas</small></article>
        <article className={model.dependencyConflicts ? styles.metricRisk : undefined}><span>Conflictos de secuencia</span><strong>{model.dependencyConflicts}</strong><small>{model.dependencyConflicts ? 'requieren replanificación' : 'plan consistente'}</small></article>
      </div>

      <div className={styles.panel}>
        <div className={styles.panelToolbar}>
          <div className={styles.scaleGroup} aria-label="Escala temporal">
            <span>Escala</span>
            {SCALE_OPTIONS.map((option) => (
              <button
                type="button"
                key={option.days}
                className={selectedScale === option.days ? styles.scaleActive : undefined}
                aria-pressed={selectedScale === option.days}
                onClick={() => setUnitDays(option.days)}
              >{option.label}</button>
            ))}
          </div>
          <div className={styles.legend} aria-label="Leyenda">
            <span><i className={styles.legendPlan} /> Planificada</span>
            <span><i className={styles.legendDone} /> Finalizada</span>
            <span><i className={styles.legendRisk} /> Conflicto</span>
          </div>
          {canManage && !canonicalMode && model.tasks.length > 0 && (
            <button type="button" className={styles.clearButton} disabled={busy} onClick={clearSchedule}>Vaciar sólo cronograma</button>
          )}
        </div>

        {model.tasks.length === 0 ? (
          <div className={styles.emptyState}>
            <span aria-hidden="true">⌁</span>
            <h2>Construí la línea base de esta obra</h2>
            <p>Agregá tareas, responsables y predecesoras. El cronograma dejará de asumir relaciones que nadie configuró.</p>
            {canManage && <button type="button" onClick={openCreate}>Crear primera tarea</button>}
          </div>
        ) : (
          <div className={styles.scroller}>
            <div className={styles.canvas} style={{ width: `${chartWidth}px` }}>
              <div className={styles.timelineHeader}>
                <div className={styles.stickyLabel}><span>Actividad</span><small>Responsable · estado</small></div>
                <div className={styles.columns} style={{ '--gantt-columns': model.columns.length }}>
                  {model.columns.map((column) => <span key={column.id}>{column.label}</span>)}
                </div>
              </div>
              <div className={styles.rows} ref={rowsRef}>
                <svg className={styles.dependencies} ref={svgRef} aria-hidden="true" />
                {model.tasks.map((task) => (
                  <div className={styles.row} key={task.id}>
                    <button type="button" className={styles.taskLabel} onClick={() => openEdit(task.id)} disabled={busy}>
                      <strong>{task.name}</strong>
                      <span>{task.assignee}</span>
                      <StatusPill tone={task.tone}>{task.status}</StatusPill>
                    </button>
                    <div className={styles.track} style={{ '--gantt-columns': model.columns.length }}>
                      <button
                        type="button"
                        ref={(node) => {
                          if (node) barRefs.current.set(task.id, node);
                          else barRefs.current.delete(task.id);
                        }}
                        className={`${styles.bar} ${styles[task.tone]}`}
                        style={{ left: `${task.leftPercentage}%`, width: `${task.widthPercentage}%` }}
                        onClick={() => openEdit(task.id)}
                        disabled={busy}
                        title={`${task.name}: día ${task.startDay} a ${task.endDay}, ${task.progress}%`}
                      >
                        <i style={{ width: `${task.progress}%` }} />
                        <span>{task.progress}%</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {editor && (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeEditor();
        }}>
          <form ref={dialogRef} tabIndex={-1} className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="gantt-editor-title" onSubmit={saveTask}>
            <header>
              <div><span>{!canManage ? 'Detalle de actividad' : editor.id ? 'Editar actividad' : 'Nueva actividad'}</span><h2 id="gantt-editor-title">{!canManage ? 'Planificación registrada' : editor.id ? 'Actualizar planificación' : 'Incorporar al plan maestro'}</h2></div>
              <button type="button" aria-label="Cerrar" disabled={busy} onClick={closeEditor}>×</button>
            </header>

            <div className={styles.formGrid}>
              <label className={styles.fullField}>
                <span>Nombre de la tarea</span>
                <input data-autofocus value={editor.name} onChange={(event) => updateEditor('name', event.target.value)} minLength={3} maxLength={160} required disabled={!canManage || busy} placeholder="Ej. Hormigonado de losa nivel 2" />
              </label>
              <label>
                <span>Responsable</span>
                <select value={editor.assigneeId} onChange={(event) => updateEditor('assigneeId', event.target.value)} disabled={!canManage || busy}>
                  <option value="">Sin asignar</option>
                  {fieldWorkers.map((worker) => <option key={worker.id} value={worker.id}>{worker.name} · {worker.role || 'Cuadrilla'}</option>)}
                </select>
              </label>
              <label>
                <span>{projectStartDate ? 'Inicio planificado' : 'Día de inicio relativo'}</span>
                {projectStartDate ? (
                  <input
                    type="date"
                    value={dateKey(ganttDateForDay(projectStartsAt, editor.startDay))}
                    min={dateKey(projectStartDate)}
                    max={dateKey(projectEndDate)}
                    onChange={(event) => updateEditor('startDay', ganttDayForDate(projectStartsAt, event.target.value) || 1)}
                    disabled={!canManage || busy}
                    required
                  />
                ) : (
                  <input type="number" value={editor.startDay} min="1" max="3650" onChange={(event) => updateEditor('startDay', event.target.value)} disabled={!canManage || busy} required />
                )}
              </label>
              <label>
                <span>Duración · días</span>
                <input type="number" value={editor.duration} min="1" max="3650" onChange={(event) => updateEditor('duration', event.target.value)} disabled={!canManage || busy} required />
              </label>
              <label>
                <span>Avance · {editor.progress}%</span>
                <input type="range" value={editor.progress} min="0" max="100" step="5" onChange={(event) => updateEditor('progress', event.target.value)} disabled={!canManage || busy} />
              </label>
            </div>

            <fieldset className={styles.dependenciesField}>
              <legend>Predecesoras · relación fin → inicio</legend>
              {model.tasks.filter((task) => task.id !== editor.id).length === 0 ? (
                <p>La obra todavía no tiene otra tarea que pueda actuar como predecesora.</p>
              ) : (
                <div className={styles.dependencyOptions}>
                  {model.tasks.filter((task) => task.id !== editor.id).map((task) => (
                    <label key={task.id}>
                      <input type="checkbox" checked={editor.dependencies.includes(task.id)} onChange={() => toggleDependency(task.id)} disabled={!canManage || busy} />
                      <span><strong>{task.name}</strong><small>Día {task.startDay}–{task.endDay} · {task.progress}%</small></span>
                    </label>
                  ))}
                </div>
              )}
            </fieldset>

            {selectedEarliestStart > Number(editor.startDay) && (
              <div className={styles.alignmentNotice}>Para respetar la secuencia, el inicio se alineará automáticamente al día {selectedEarliestStart}.</div>
            )}
            {error && <div className={styles.formError} role="alert">{error}</div>}

            <footer>
              <div>{canManage && editor.id && <button type="button" className={styles.deleteButton} disabled={busy} onClick={deleteTask}>Eliminar tarea</button>}</div>
              <div><button type="button" className={styles.cancelButton} disabled={busy} onClick={closeEditor}>{canManage ? 'Cancelar' : 'Cerrar'}</button>{canManage && <button type="submit" className={styles.saveButton} disabled={busy}>{busy ? 'Guardando…' : 'Guardar planificación'}</button>}</div>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}
