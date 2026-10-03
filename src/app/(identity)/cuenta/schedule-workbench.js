'use client';
import {useMemo, useState} from 'react';
import {Search, CalendarDays, CircleCheck, Clock3, TriangleAlert, ListFilter} from 'lucide-react';
import {calendarDay, formatCalendarDay, loadedScheduleOverview, planningState, registeredProgress, selectLoadedTasks, taskStatus, taskStatusLabel} from './schedule-workbench.mjs';
import styles from './schedule-workbench.module.css';

export function ScheduleWorkbench({tasks, totalTasks, nextCursor, canPlan, locked, onPlan}) {
 const [search, setSearch] = useState(''), [status, setStatus] = useState('ALL'), [planning, setPlanning] = useState('ALL'), [order, setOrder] = useState('REGISTERED');
 const overview = useMemo(() => loadedScheduleOverview(tasks, totalTasks, nextCursor), [tasks, totalTasks, nextCursor]);
 const visible = useMemo(() => selectLoadedTasks(tasks, {search, status, planning, order}), [tasks, search, status, planning, order]);
 const filtered = Boolean(search || status !== 'ALL' || planning !== 'ALL' || order !== 'REGISTERED');
 const clear = () => {setSearch(''); setStatus('ALL'); setPlanning('ALL'); setOrder('REGISTERED');};
 const countCards = [
  {label: 'En curso', count: overview.inProgress, Icon: Clock3, tone: 'active'},
  {label: 'Bloqueadas', count: overview.blocked, Icon: TriangleAlert, tone: 'attention'},
  {label: 'Sin fechas', count: overview.missingDates, Icon: CalendarDays, tone: 'neutral'},
  {label: 'Finalizadas', count: overview.done, Icon: CircleCheck, tone: 'complete'},
 ];
 return <div className={styles.workbench} data-schedule-workbench>
  <section className={styles.overview} aria-labelledby="schedule-overview-title">
   <div className={styles.overviewHeading}><h4 id="schedule-overview-title">Panorama del cronograma</h4><span className={styles.coverage}>{overview.partial ? 'Resumen parcial' : 'Todas las tareas cargadas'}</span></div>
   <p className={styles.context}>{overview.total === null ? `${overview.loaded} tareas cargadas. El total debe actualizarse.` : `${overview.loaded} de ${overview.total} tareas cargadas.`} {overview.partial ? 'Los indicadores y los filtros consideran sólo las tareas cargadas.' : 'Los indicadores corresponden a las tareas registradas de esta obra.'}</p>
   <dl className={styles.metrics}>{countCards.map(({label, count, Icon, tone}) => <div className={styles.metric} key={label} data-tone={tone}><dt><Icon size={18} aria-hidden="true"/>{label}</dt><dd>{count}</dd></div>)}</dl>
   {(overview.invalidDates > 0 || overview.unrecognizedStatus > 0 || overview.invalidProgress > 0) && <p className={styles.review}><TriangleAlert size={18} aria-hidden="true"/><span>Datos para revisar: {[overview.invalidDates && `${overview.invalidDates} con fechas inválidas o incompletas`, overview.unrecognizedStatus && `${overview.unrecognizedStatus} con estado no reconocido`, overview.invalidProgress && `${overview.invalidProgress} con avance inválido`].filter(Boolean).join(' · ')}.</span></p>}
  </section>
  <section className={styles.taskList} aria-labelledby="schedule-list-title">
   <div className={styles.listHeading}><h4 id="schedule-list-title"><ListFilter size={18} aria-hidden="true"/>Tareas de la obra</h4><button type="button" onClick={clear} disabled={!filtered}>Limpiar filtros</button></div>
   <div className={styles.toolbar}>
    <label className={styles.search}>Buscar tareas<span><Search size={18} aria-hidden="true"/><input type="search" aria-label="Buscar tareas" placeholder="Nombre de la tarea" maxLength={160} value={search} onChange={event => setSearch(event.target.value)}/></span></label>
    <label>Estado<select aria-label="Estado de las tareas" value={status} onChange={event => setStatus(event.target.value)}><option value="ALL">Todos los estados</option><option value="BACKLOG">Por iniciar</option><option value="IN_PROGRESS">En curso</option><option value="BLOCKED">Bloqueadas</option><option value="DONE">Finalizadas</option><option value="UNRECOGNIZED">Estado por revisar</option></select></label>
    <label>Planificación<select aria-label="Planificación de las tareas" value={planning} onChange={event => setPlanning(event.target.value)}><option value="ALL">Todas las fechas</option><option value="VALID">Con fechas válidas</option><option value="MISSING">Sin fechas</option><option value="INVALID">Fechas para revisar</option></select></label>
    <label>Orden<select aria-label="Orden de las tareas" value={order} onChange={event => setOrder(event.target.value)}><option value="REGISTERED">Orden de carga</option><option value="START_ASC">Inicio previsto</option><option value="TITLE_ASC">Nombre de la tarea</option></select></label>
   </div>
   <p className={styles.result} role="status" aria-live="polite">Mostrando {visible.length} de {tasks.length} tareas cargadas.{overview.partial && (nextCursor ? ' Podés cargar más tareas para ampliar la búsqueda.' : ' Actualizá la consulta y volvé a abrir la obra para comprobar el total.')}</p>
   {overview.range && <div className={styles.range}><span>Escala de fechas previstas</span><strong>{formatCalendarDay(new Date(overview.range.start).toISOString().slice(0, 10))} — {formatCalendarDay(new Date(overview.range.end - 86400000).toISOString().slice(0, 10))}</strong><small>Considera las tareas cargadas con fechas válidas.</small></div>}
   {!tasks.length && <p className={styles.empty}>Esta obra todavía no tiene tareas registradas. Empezá por cargar la primera tarea.</p>}
   {tasks.length > 0 && !visible.length && <div className={styles.empty}><strong>No hay coincidencias entre las tareas cargadas.</strong><p>Revisá la búsqueda o usá «Limpiar filtros» para volver a verlas.{overview.partial && (nextCursor ? ' También podés cargar más tareas.' : ' Actualizá la consulta y volvé a abrir la obra para comprobar el total.')}</p></div>}
   <div className={styles.tasks}>{visible.map(task => {
    const state = planningState(task), progress = registeredProgress(task.progress), range = overview.range;
    return <article key={task.id} className={styles.task} data-task-id={task.id}>
     <div className={styles.taskHeading}><h5>{task.title}</h5><span className={styles.badge} data-status={taskStatus(task.status)}>{taskStatusLabel(task.status)}</span></div>
     <div className={styles.taskBody}>
      <div className={styles.planning}><p className={styles.label}>Fechas previstas</p><p className={styles.dates}>{state === 'VALID' ? <><time dateTime={task.startsOn}>{formatCalendarDay(task.startsOn)}</time><span aria-hidden="true"> → </span><span className={styles.srOnly}> hasta </span><time dateTime={task.endsOn}>{formatCalendarDay(task.endsOn)}</time></> : state === 'MISSING' ? 'Sin fechas planificadas' : 'Fechas para revisar'}</p>
       <div className={styles.track} aria-label={state === 'VALID' ? `Planificada desde ${formatCalendarDay(task.startsOn)} hasta ${formatCalendarDay(task.endsOn)}` : 'Sin intervalo de planificación válido'}>{state === 'VALID' && range && <span className={styles.bar} style={{left: ((calendarDay(task.startsOn) - range.start) / (range.end - range.start) * 100) + '%', width: ((calendarDay(task.endsOn) + 86400000 - calendarDay(task.startsOn)) / (range.end - range.start) * 100) + '%'}}/>}</div>
      </div>
      <div className={styles.progress}><p className={styles.label}>Avance registrado: <strong>{progress === null ? 'Requiere revisión' : `${progress} %`}</strong></p>{progress !== null && <div className={styles.progressTrack} role="progressbar" aria-label={`Avance registrado de ${task.title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{width: progress + '%'}}/></div>}</div>
     </div>
     {canPlan && <div className={styles.taskActions}><button type="button" disabled={locked} onClick={() => onPlan(task)}>Planificar fechas</button></div>}
    </article>;
   })}</div>
  </section>
 </div>;
}
