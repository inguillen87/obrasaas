'use client';

import { useState } from 'react';
import Link from 'next/link';
import BlockerFollowupCard from './blocker-followup-card';
import { useWorkspaceLeaveGuard } from '../use-workspace-leave-guard';
import { requestWorkspaceNavigation } from '@/lib/workspace-leave-policy';
import styles from './execution.module.css';

async function api(options = {}) {
  const result = await fetch('/api/execution', { ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) }, body: options.body ? JSON.stringify(options.body) : undefined });
  const data = await result.json().catch(() => ({}));
  if (!result.ok) throw new Error(data.error || 'No se pudo completar la operación.');
  return data;
}

export default function ExecutionClient({ initialData, workers, tasks, permissions, organizationId, projectId, focusedBlockerId = null }) {
  const [data, setData] = useState(initialData);
  const [teamName, setTeamName] = useState('');
  const [blockerTitle, setBlockerTitle] = useState('');
  const [blockerTask, setBlockerTask] = useState('');
  const [blockerOwnerWorker, setBlockerOwnerWorker] = useState('');
  const [blockerOwnerTeam, setBlockerOwnerTeam] = useState('');
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  const visibleBlockers = focusedBlockerId ? data.blockers.filter(row => row.id === focusedBlockerId) : data.blockers;
  useWorkspaceLeaveGuard({ dirty: Boolean(teamName || blockerTitle || blockerTask || blockerOwnerWorker || blockerOwnerTeam), busy });
  async function createTeam(event) {
    event.preventDefault(); if (!teamName.trim()) return;
    setBusy(true); try { const result = await api({ method: 'POST', body: { kind: 'TEAM', name: teamName } }); setData((current) => ({ ...current, teams: [...current.teams, result.team] })); setTeamName(''); setNotice('Equipo creado y auditado.'); } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  }

  async function createBlocker(event) {
    event.preventDefault(); if (!blockerTitle.trim()) return;
    if (!blockerOwnerWorker && !blockerOwnerTeam) { setNotice('Seleccioná una persona o cuadrilla responsable.'); return; }
    setBusy(true); try { const result = await api({ method: 'POST', body: { kind: 'BLOCKER', title: blockerTitle, taskId: blockerTask || undefined, severity: 'MEDIUM', ownerWorkerId: blockerOwnerWorker || undefined, ownerTeamId: blockerOwnerTeam || undefined } }); setData((current) => ({ ...current, blockers: [result.blocker, ...current.blockers] })); setBlockerTitle(''); setBlockerTask(''); setBlockerOwnerWorker(''); setBlockerOwnerTeam(''); setNotice('Restricción abierta y asignada.'); } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  }

  return <section className={styles.content}>
    {notice && <div className={styles.notice} role="status">{notice}<button type="button" onClick={() => setNotice(null)}>×</button></div>}
    {focusedBlockerId && <div className={styles.notice}><span>Mostrando la restricción seleccionada desde su enlace.</span><Link href="/dashboard/execution" onNavigate={event => { if (!requestWorkspaceNavigation('route')) event.preventDefault(); }}>Ver todas las restricciones</Link></div>}
    <div className={styles.metrics}><article><span>Equipos activos</span><strong>{data.teams.filter((team) => team.status === 'ACTIVE').length}</strong></article><article><span>Asignaciones</span><strong>{data.assignments.length}</strong></article><article><span>Restricciones abiertas</span><strong>{data.blockers.filter((blocker) => !['RESOLVED', 'CANCELLED'].includes(blocker.status)).length}</strong></article></div>
    <div className={styles.grid}>
      <section className={styles.panel}><div className={styles.heading}><div><span className={styles.kicker}>Estructura operativa</span><h2>Cuadrillas</h2></div></div>{data.teams.length === 0 ? <p className={styles.empty}>Todavía no hay equipos versionados.</p> : <ul className={styles.list}>{data.teams.map((team) => <li key={team.id}><div><strong>{team.name}</strong><span>{team.members.length} integrantes · revisión {team.revision}</span></div><em>{team.status === 'ACTIVE' ? 'Activa' : 'Archivada'}</em></li>)}</ul>}{permissions.canManage && <form className={styles.form} onSubmit={createTeam}><input value={teamName} onChange={(event) => setTeamName(event.target.value)} aria-label="Nombre de la cuadrilla" placeholder="Nombre de la cuadrilla" maxLength={160} /><button disabled={busy} type="submit">Crear equipo</button></form>}</section>
      <section className={styles.panel}><div className={styles.heading}><div><span className={styles.kicker}>Riesgo operativo</span><h2>Restricciones de obra</h2></div></div>{data.blockers.length === 0 ? <p className={styles.empty}>No hay restricciones registradas.</p> : <ul className={styles.restrictionList}>{visibleBlockers.map(blocker => <BlockerFollowupCard key={blocker.id} blocker={blocker} tasks={tasks} workers={workers} teams={data.teams}
        organizationId={organizationId} projectId={projectId} canManage={permissions.canManage} canReadTasks={permissions.canReadTasks}
        onChanged={saved => setData(current => ({ ...current, blockers: current.blockers.map(row => row.id === saved.id ? saved : row) }))} />)}</ul>}{permissions.canManage && <form className={styles.form} onSubmit={createBlocker}><input value={blockerTitle} onChange={(event) => setBlockerTitle(event.target.value)} aria-label="Título de la restricción" placeholder="Título de la restricción" maxLength={220} /><select aria-label="Actividad de la restricción" value={blockerTask} onChange={(event) => setBlockerTask(event.target.value)}><option value="">Sin tarea vinculada</option>{tasks.map((task) => <option value={task.id} key={task.id}>{task.title}</option>)}</select><select aria-label="Persona responsable" value={blockerOwnerWorker} onChange={(event) => { setBlockerOwnerWorker(event.target.value); setBlockerOwnerTeam(''); }}><option value="">Responsable: persona</option>{workers.map((worker) => <option value={worker.id} key={worker.id}>{worker.name}</option>)}</select><select aria-label="Cuadrilla responsable" value={blockerOwnerTeam} onChange={(event) => { setBlockerOwnerTeam(event.target.value); setBlockerOwnerWorker(''); }}><option value="">Responsable: cuadrilla</option>{data.teams.filter((team) => team.status === 'ACTIVE').map((team) => <option value={team.id} key={team.id}>{team.name}</option>)}</select><button disabled={busy} type="submit">Abrir restricción</button></form>}</section>
    </div>
    <section className={styles.panel}><div className={styles.heading}><div><span className={styles.kicker}>Fuente de verdad</span><h2>Asignaciones versionadas</h2></div></div>{data.assignments.length === 0 ? <p className={styles.empty}>Las asignaciones se crean desde la API de ejecución y quedan vinculadas al WBS.</p> : <div className={styles.tableWrap}><table><thead><tr><th>Tarea</th><th>Persona</th><th>Equipo</th><th>Estado</th><th>Revisión</th></tr></thead><tbody>{data.assignments.map((assignment) => <tr key={assignment.id}><td>{tasks.find((task) => task.id === assignment.taskId)?.title || assignment.taskId}</td><td>{workers.find((worker) => worker.id === assignment.workerId)?.name || '—'}</td><td>{data.teams.find((team) => team.id === assignment.teamId)?.name || '—'}</td><td>{assignment.status}</td><td>{assignment.revision}</td></tr>)}</tbody></table></div>}</section>
  </section>;
}
