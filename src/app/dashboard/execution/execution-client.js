'use client';

import { useState } from 'react';
import styles from './execution.module.css';

async function api(options = {}) {
  const result = await fetch('/api/execution', { ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) }, body: options.body ? JSON.stringify(options.body) : undefined });
  const data = await result.json().catch(() => ({}));
  if (!result.ok) throw new Error(data.error || 'No se pudo completar la operación.');
  return data;
}

export default function ExecutionClient({ initialData, workers, tasks, permissions }) {
  const [data, setData] = useState(initialData);
  const [teamName, setTeamName] = useState('');
  const [blockerTitle, setBlockerTitle] = useState('');
  const [blockerTask, setBlockerTask] = useState('');
  const [blockerOwnerWorker, setBlockerOwnerWorker] = useState('');
  const [blockerOwnerTeam, setBlockerOwnerTeam] = useState('');
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  async function createTeam(event) {
    event.preventDefault(); if (!teamName.trim()) return;
    setBusy(true); try { const result = await api({ method: 'POST', body: { kind: 'TEAM', name: teamName } }); setData((current) => ({ ...current, teams: [...current.teams, result.team] })); setTeamName(''); setNotice('Equipo creado y auditado.'); } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  }

  async function createBlocker(event) {
    event.preventDefault(); if (!blockerTitle.trim()) return;
    if (!blockerOwnerWorker && !blockerOwnerTeam) { setNotice('Seleccioná una persona o cuadrilla responsable.'); return; }
    setBusy(true); try { const result = await api({ method: 'POST', body: { kind: 'BLOCKER', title: blockerTitle, taskId: blockerTask || undefined, severity: 'MEDIUM', ownerWorkerId: blockerOwnerWorker || undefined, ownerTeamId: blockerOwnerTeam || undefined } }); setData((current) => ({ ...current, blockers: [result.blocker, ...current.blockers] })); setBlockerTitle(''); setBlockerTask(''); setBlockerOwnerWorker(''); setBlockerOwnerTeam(''); setNotice('Blocker abierto y asignado.'); } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  }

  async function resolveBlocker(blocker) {
    setBusy(true); try { const result = await fetch(`/api/execution/blockers/${encodeURIComponent(blocker.id)}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ expectedRevision: blocker.revision, status: 'RESOLVED', resolution: 'Resuelto desde el control de ejecución.' }) }); const payload = await result.json(); if (!result.ok) throw new Error(payload.error || 'No se pudo resolver.'); setData((current) => ({ ...current, blockers: current.blockers.map((item) => item.id === blocker.id ? payload.blocker : item) })); setNotice('Blocker resuelto y auditado.'); } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  }

  return <section className={styles.content}>
    {notice && <div className={styles.notice} role="status">{notice}<button type="button" onClick={() => setNotice(null)}>×</button></div>}
    <div className={styles.metrics}><article><span>Equipos activos</span><strong>{data.teams.filter((team) => team.status === 'ACTIVE').length}</strong></article><article><span>Asignaciones</span><strong>{data.assignments.length}</strong></article><article><span>Blockers abiertos</span><strong>{data.blockers.filter((blocker) => !['RESOLVED', 'CANCELLED'].includes(blocker.status)).length}</strong></article></div>
    <div className={styles.grid}>
      <section className={styles.panel}><div className={styles.heading}><div><span className={styles.kicker}>Estructura operativa</span><h2>Cuadrillas</h2></div></div>{data.teams.length === 0 ? <p className={styles.empty}>Todavía no hay equipos versionados.</p> : <ul className={styles.list}>{data.teams.map((team) => <li key={team.id}><div><strong>{team.name}</strong><span>{team.members.length} integrantes · revisión {team.revision}</span></div><em>{team.status}</em></li>)}</ul>}{permissions.canManage && <form className={styles.form} onSubmit={createTeam}><input value={teamName} onChange={(event) => setTeamName(event.target.value)} placeholder="Nombre de la cuadrilla" maxLength={160} /><button disabled={busy} type="submit">Crear equipo</button></form>}</section>
      <section className={styles.panel}><div className={styles.heading}><div><span className={styles.kicker}>Riesgo operativo</span><h2>Blockers</h2></div></div>{data.blockers.length === 0 ? <p className={styles.empty}>No hay bloqueos registrados.</p> : <ul className={styles.blockers}>{data.blockers.map((blocker) => <li key={blocker.id}><div><strong>{blocker.title}</strong><span>{blocker.taskId ? `Tarea vinculada · ${blocker.severity}` : `Sin tarea vinculada · ${blocker.severity}`}</span></div>{permissions.canManage && !['RESOLVED', 'CANCELLED'].includes(blocker.status) && <button type="button" disabled={busy} onClick={() => resolveBlocker(blocker)}>Resolver</button>}</li>)}</ul>}{permissions.canManage && <form className={styles.form} onSubmit={createBlocker}><input value={blockerTitle} onChange={(event) => setBlockerTitle(event.target.value)} placeholder="Título del blocker" maxLength={220} /><select value={blockerTask} onChange={(event) => setBlockerTask(event.target.value)}><option value="">Sin tarea vinculada</option>{tasks.map((task) => <option value={task.id} key={task.id}>{task.title}</option>)}</select><select value={blockerOwnerWorker} onChange={(event) => { setBlockerOwnerWorker(event.target.value); setBlockerOwnerTeam(''); }}><option value="">Owner persona</option>{workers.map((worker) => <option value={worker.id} key={worker.id}>{worker.name}</option>)}</select><select value={blockerOwnerTeam} onChange={(event) => { setBlockerOwnerTeam(event.target.value); setBlockerOwnerWorker(''); }}><option value="">Owner cuadrilla</option>{data.teams.filter((team) => team.status === 'ACTIVE').map((team) => <option value={team.id} key={team.id}>{team.name}</option>)}</select><button disabled={busy} type="submit">Abrir blocker</button></form>}</section>
    </div>
    <section className={styles.panel}><div className={styles.heading}><div><span className={styles.kicker}>Fuente de verdad</span><h2>Asignaciones versionadas</h2></div></div>{data.assignments.length === 0 ? <p className={styles.empty}>Las asignaciones se crean desde la API de ejecución y quedan vinculadas al WBS.</p> : <div className={styles.tableWrap}><table><thead><tr><th>Tarea</th><th>Persona</th><th>Equipo</th><th>Estado</th><th>Revisión</th></tr></thead><tbody>{data.assignments.map((assignment) => <tr key={assignment.id}><td>{tasks.find((task) => task.id === assignment.taskId)?.title || assignment.taskId}</td><td>{workers.find((worker) => worker.id === assignment.workerId)?.name || '—'}</td><td>{data.teams.find((team) => team.id === assignment.teamId)?.name || '—'}</td><td>{assignment.status}</td><td>{assignment.revision}</td></tr>)}</tbody></table></div>}</section>
  </section>;
}
