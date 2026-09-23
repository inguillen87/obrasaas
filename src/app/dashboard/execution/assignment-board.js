'use client';
import { useState } from 'react';
import { assignmentPlanFeedback } from '@/lib/task-assignment-policy';
import { buildAssignmentAgenda, selectAgendaRows, validAgendaDay, AGENDA_LABELS } from '@/lib/assignment-agenda';
import { requestWorkspaceNavigation } from '@/lib/workspace-leave-policy';
import { tokens } from '@/lib/design-system';
import { publishFieldInvalidation } from '@/lib/schedule-field-channel';
import AssignmentPlanner from './assignment-planner';
import AssignmentCard from './assignment-card';
import AssignmentAgendaControls from './assignment-agenda-controls';
import styles from './assignments.module.css';
export default function AssignmentBoard({assignments,tasks,workers,teams,permissions,organizationId,projectId,focusedTask,onChanged,timeZone=null,agendaDay=null}){
  const [planning,setPlanning]=useState(false),[query,setQuery]=useState(''),[filter,setFilter]=useState('all'),[notice,setNotice]=useState('');
  const [day,setDay]=useState(agendaDay),[bucket,setBucket]=useState('all');
  const canPlan=permissions.canManage&&permissions.canReadTasks;
  const hasTask=tasks.some(task=>task.type==='TASK');
  const agenda=buildAssignmentAgenda(assignments,{projectId,day});
  const visible=selectAgendaRows(agenda,{bucket,status:filter,query,tasks,workers,teams});
  const style={'--assign-bg':tokens.colors.bg.secondary,'--assign-accent':tokens.colors.accent.primary,'--assign-border':tokens.colors.border.default,'--assign-text':tokens.colors.text.primary,'--assign-muted':tokens.colors.text.secondary};
  function changed(row){onChanged(row);publishFieldInvalidation({organizationId,projectId});}
  // Filtering may unmount a card with a draft. Use the same leave guard as workspace navigation.
  function changeView(action){if(requestWorkspaceNavigation('route'))action();}
  function reset(){changeView(()=>{setBucket('all');setFilter('all');setQuery('');});}
  return <section id="task-assignments" className={styles.board} style={style} aria-label="Planificación y seguimiento de asignaciones">
    <header className={styles.boardHeader}><div><span>QUIÉN HACE QUÉ</span><h2>Asignaciones de la obra</h2><p>{focusedTask?'Actividad: '+focusedTask.title:'Personas y cuadrillas vinculadas a actividades, con decisiones trazables.'}</p></div>
      {canPlan&&<button type="button" className={styles.primary} disabled={!hasTask} onClick={()=>setPlanning(true)}>Planificar asignación</button>}</header>
    {canPlan&&!hasTask&&<p className={styles.hint}>No hay actividades asignables en este contexto. Las fases y los hitos no se asignan desde este formulario; revisá las actividades del cronograma.</p>}
    <div className={styles.summary}><strong>{agenda.open}</strong><span>Planificadas o en curso en este listado</span><small>{agenda.counts.all} {agenda.counts.all===1?'asignación registrada':'asignaciones registradas'} · finalizar no certifica avance</small></div>
    <AssignmentAgendaControls agenda={agenda} bucket={bucket} timeZone={timeZone} onReset={reset}
      onDayChange={value=>changeView(()=>{setDay(value);if(!validAgendaDay(value))setBucket('all');})}
      onBucketChange={value=>changeView(()=>{setBucket(value);setFilter('open');})}/>
    <div className={styles.toolbar}><label>Buscar asignaciones<input type="search" value={query} onChange={event=>{const value=event.target.value;changeView(()=>setQuery(value));}} maxLength={80} placeholder="Actividad, código o responsable" /></label><label>Estado<select value={filter} onChange={event=>{const value=event.target.value;changeView(()=>setFilter(value));}}><option value="all">Todas</option><option value="open">Planificadas y en curso</option><option value="closed">Finalizadas y canceladas</option></select></label></div>
    <p className={styles.hint} role="status" aria-live="polite">{visible.length} de {agenda.counts.all} asignaciones del listado · {AGENDA_LABELS[bucket]}{agenda.day&&bucket!=='all'?' · referencia '+agenda.day.split('-').reverse().join('/'):''}</p>
    {notice&&<p role="status" className={styles.warning}>{notice}</p>}
    {visible.length===0&&<div className={styles.empty}><strong>{agenda.counts.all?'No hay coincidencias con estos filtros':'Todavía no hay asignaciones registradas'}</strong><p>{agenda.counts.all?'Cambiá la fecha, el estado o la búsqueda para consultar otros registros.':canPlan?'Prepará una actividad y elegí una persona o cuadrilla de esta obra. Se guardará como planificada.':'Un responsable con permiso de ejecución puede planificar el trabajo.'}</p>{agenda.counts.all>0&&<button type="button" onClick={reset}>Limpiar filtros</button>}</div>}
    <div className={styles.cards}>{visible.map(row=><AssignmentCard key={row.id} assignment={row} tasks={tasks} workers={workers} teams={teams} organizationId={organizationId} projectId={projectId} canManage={permissions.canManage} canReadTasks={permissions.canReadTasks} onChanged={changed}/>)}</div>
    {planning&&<AssignmentPlanner organizationId={organizationId} projectId={projectId} tasks={tasks} focusedTask={focusedTask} onClose={()=>setPlanning(false)} onSaved={(row,outcome)=>{changed(row);setPlanning(false);setBucket('all');setFilter('all');setQuery('');setNotice(assignmentPlanFeedback(outcome));}}/>}
  </section>;
}
