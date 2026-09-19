'use client';
import { useState } from 'react';
import { tokens } from '@/lib/design-system';
import { publishFieldInvalidation } from '@/lib/schedule-field-channel';
import AssignmentPlanner from './assignment-planner';
import AssignmentCard from './assignment-card';
import styles from './assignments.module.css';
export default function AssignmentBoard({assignments,tasks,workers,teams,permissions,organizationId,projectId,focusedTask,onChanged}){
  const [planning,setPlanning]=useState(false),[query,setQuery]=useState(''),[filter,setFilter]=useState('all'),[notice,setNotice]=useState('');
  const canPlan=permissions.canManage&&permissions.canReadTasks;
  const hasTask=tasks.some(task=>task.type==='TASK');
  const active=assignments.filter(row=>['PLANNED','ACTIVE'].includes(row.status)).length;
  const visible=assignments.filter(row=>(filter==='all'||filter==='open'&&['PLANNED','ACTIVE'].includes(row.status)||filter==='closed'&&['ENDED','CANCELLED'].includes(row.status))
    &&[tasks.find(task=>task.id===row.taskId)?.title,workers.find(worker=>worker.id===row.workerId)?.name,teams.find(team=>team.id===row.teamId)?.name].join(' ').toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es')));
  const style={'--assign-bg':tokens.colors.bg.secondary,'--assign-accent':tokens.colors.accent.primary,'--assign-border':tokens.colors.border.default,'--assign-text':tokens.colors.text.primary,'--assign-muted':tokens.colors.text.secondary};
  function changed(row){onChanged(row);publishFieldInvalidation({organizationId,projectId});}
  return <section id="task-assignments" className={styles.board} style={style} aria-label="Planificación y seguimiento de asignaciones">
    <header className={styles.boardHeader}><div><span>QUIÉN HACE QUÉ</span><h2>Asignaciones de la obra</h2><p>{focusedTask?'Actividad: '+focusedTask.title:'Personas y cuadrillas vinculadas a actividades, con decisiones trazables.'}</p></div>
      {canPlan&&<button type="button" className={styles.primary} disabled={!hasTask} onClick={()=>setPlanning(true)}>Planificar asignación</button>}</header>
    {canPlan&&!hasTask&&<p className={styles.hint}>No hay actividades asignables en este contexto. Las fases y los hitos no se asignan desde este formulario; revisá las actividades del cronograma.</p>}
    <div className={styles.summary}><strong>{active}</strong><span>Planificadas o en curso en este listado</span><small>{assignments.length} {assignments.length===1?'asignación registrada':'asignaciones registradas'} · finalizar no certifica avance</small></div>
    <div className={styles.toolbar}><label>Buscar asignaciones<input type="search" value={query} onChange={event=>setQuery(event.target.value)} maxLength={80} placeholder="Actividad o responsable" /></label><label>Estado<select value={filter} onChange={event=>setFilter(event.target.value)}><option value="all">Todas</option><option value="open">Planificadas y en curso</option><option value="closed">Finalizadas y canceladas</option></select></label></div>
    {notice&&<p role="status" className={styles.warning}>{notice}</p>}
    {visible.length===0&&<div className={styles.empty}><strong>{assignments.length?'No hay coincidencias con estos filtros':'Todavía no hay asignaciones registradas'}</strong><p>{assignments.length?'Cambiá el estado o la búsqueda para consultar otros registros.':canPlan?'Prepará una actividad y elegí una persona o cuadrilla de esta obra. Se guardará como planificada.':'Un responsable con permiso de ejecución puede planificar el trabajo.'}</p></div>}
    <div className={styles.cards}>{visible.map(row=><AssignmentCard key={row.id} assignment={row} tasks={tasks} workers={workers} teams={teams} organizationId={organizationId} projectId={projectId} canManage={permissions.canManage} canReadTasks={permissions.canReadTasks} onChanged={changed}/>)}</div>
    {planning&&<AssignmentPlanner organizationId={organizationId} projectId={projectId} tasks={tasks} focusedTask={focusedTask} onClose={()=>setPlanning(false)} onSaved={row=>{changed(row);setPlanning(false);setFilter('all');setQuery('');setNotice('Asignación confirmada. Continuá desde su tarjeta; no se modificó el avance de la actividad.');}}/>}
  </section>;
}
