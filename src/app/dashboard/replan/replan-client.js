'use client';

import { useRef, useState } from 'react';
import { parseReplanComparisonResponse } from '@/lib/replan-comparison-contract';
import styles from './replan.module.css';

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || 'No se pudo completar la operación.');
    error.status = response.status;
    error.code = body.code;
    throw error;
  }
  return body;
}

export default function ReplanClient({ initialScenarios, approvedExtras, canManage, projectName }) {
  const [rows, setRows] = useState(initialScenarios);
  const [name, setName] = useState('');
  const [extraWorkId, setExtraWorkId] = useState('');
  const [assumptions, setAssumptions] = useState('{"base":"plan vigente"}');
  const [impact, setImpact] = useState('{"days":0,"cost":0}');
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [comparison, setComparison] = useState(null);
  const [decisionNotes, setDecisionNotes] = useState({});
  const busyRef = useRef(false);

  function beginOperation() {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    return true;
  }

  function endOperation() {
    busyRef.current = false;
    setBusy(false);
  }

  async function refreshScenarios() {
    try {
      const result = await api('/api/replan-scenarios');
      setRows(result.scenarios);
      return true;
    } catch {
      return false;
    }
  }

  async function create(event) {
    event.preventDefault();
    let parsedAssumptions;
    let parsedImpact;
    try {
      parsedAssumptions = JSON.parse(assumptions);
      parsedImpact = JSON.parse(impact);
    } catch {
      setNotice('Supuestos e impacto deben ser JSON válido.');
      return;
    }
    if (!beginOperation()) return;
    try {
      const result = await api('/api/replan-scenarios', {
        method: 'POST',
        body: JSON.stringify({
          name,
          extraWorkId: extraWorkId || undefined,
          assumptions: parsedAssumptions,
          impact: parsedImpact,
        }),
      });
      setRows((current) => [result.scenario, ...current]);
      setName('');
      setNotice('Escenario propuesto; no modifica el plan vigente.');
    } catch (error) {
      setNotice(error.message);
    } finally {
      endOperation();
    }
  }

  async function decide(row, status) {
    const decisionNote = String(decisionNotes[row.id] || '').trim();
    if (!decisionNote) {
      setNotice('Ingresá un fundamento para aprobar o rechazar el escenario.');
      return;
    }
    if (!beginOperation()) return;
    try {
      await api('/api/replan-scenarios', {
        method: 'PATCH',
        body: JSON.stringify({
          id: row.id,
          expectedRevision: row.revision,
          status,
          decisionNote,
        }),
      });
      setRows((current) => current.map((entry) => (
        entry.id === row.id ? { ...entry, status, revision: entry.revision + 1 } : entry
      )));
      setDecisionNotes((current) => ({ ...current, [row.id]: '' }));
      setNotice('Decisión registrada; el plan canónico no fue modificado.');
    } catch (error) {
      if (error.status === 409) {
        const refreshed = await refreshScenarios();
        setNotice(refreshed
          ? 'El escenario cambió en otra sesión. Actualizamos su revisión.'
          : 'El escenario cambió y no pudimos refrescarlo. Recargá la página.');
      } else {
        setNotice(error.message);
      }
    } finally {
      endOperation();
    }
  }

  async function compare(row) {
    if (!beginOperation()) return;
    try {
      const result = parseReplanComparisonResponse(
        await api(`/api/replan-scenarios/${row.id}`),
        { expectedScenarioId: row.id },
      );
      setComparison(result);
      setNotice(`Plan canónico actual: ${result.baselineTasks.length} tareas disponibles para comparar.`);
    } catch (error) {
      setNotice(error.message);
    } finally {
      endOperation();
    }
  }

  return (
    <main className={styles.shell}>
      <header>
        <span>S6 · planificación controlada</span>
        <h1>Escenarios de replanificación</h1>
        <p>{projectName} · un escenario permite evaluar impacto sin reescribir baseline ni presupuesto.</p>
      </header>
      {notice && <p className={styles.notice} role="status" aria-live="polite">{notice}</p>}
      {comparison && (
        <section className={styles.panel}>
          <h2>Plan de referencia</h2>
          <p><strong>Plan canónico actual</strong> · {comparison.baselineTasks.length} tareas · solo lectura</p>
          <p><strong>Supuestos declarados:</strong> <code>{JSON.stringify(comparison.scenario.assumptions)}</code></p>
          <p><strong>Impacto declarado:</strong> <code>{JSON.stringify(comparison.scenario.impact)}</code></p>
          <ul>
            {comparison.baselineTasks.slice(0, 20).map((task) => (
              <li key={task.id}><strong>{task.code || '—'}</strong> {task.title} · {task.status}</li>
            ))}
          </ul>
          {comparison.baselineTasks.length > 20 && (
            <p>Vista resumida de 20 tareas. Esta versión todavía no calcula deltas ni pronóstico automático sobre una baseline inmutable.</p>
          )}
        </section>
      )}
      {canManage && (
        <section className={styles.panel}>
          <h2>Nuevo escenario</h2>
          <form onSubmit={create}>
            <input
              aria-label="Nombre del escenario"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nombre del escenario"
              maxLength={220}
            />
            <select aria-label="Trabajo extra vinculado" value={extraWorkId} onChange={(event) => setExtraWorkId(event.target.value)}>
              <option value="">Sin trabajo extra vinculado</option>
              {approvedExtras.map((row) => <option key={row.id} value={row.id}>{row.title}</option>)}
            </select>
            <textarea
              required
              value={assumptions}
              onChange={(event) => setAssumptions(event.target.value)}
              aria-label="Supuestos"
            />
            <textarea
              required
              value={impact}
              onChange={(event) => setImpact(event.target.value)}
              aria-label="Impacto"
            />
            <button disabled={busy} type="submit">Proponer escenario</button>
          </form>
        </section>
      )}
      <section className={styles.panel}>
        <h2>Escenarios registrados</h2>
        {rows.length === 0 ? <p>No hay escenarios.</p> : (
          <ul>
            {rows.map((row) => (
              <li key={row.id}>
                <div>
                  <strong>{row.name}</strong>
                  <span>{row.status} · revisión {row.revision}</span>
                  <p>Supuestos e impacto estructurados; aplicación separada.</p>
                </div>
                <div>
                  <button disabled={busy} onClick={() => compare(row)}>Ver plan actual</button>
                  {canManage && row.status === 'PROPOSED' && (
                    <>
                      <input
                        aria-label={`Fundamento de decisión para ${row.name}`}
                        value={decisionNotes[row.id] || ''}
                        onChange={(event) => setDecisionNotes((current) => ({
                          ...current,
                          [row.id]: event.target.value,
                        }))}
                        placeholder="Fundamento de la decisión"
                        maxLength={10000}
                      />
                      <button disabled={busy} onClick={() => decide(row, 'APPROVED')}>Aprobar</button>
                      <button disabled={busy} onClick={() => decide(row, 'REJECTED')}>Rechazar</button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
