'use client';

import { useState } from 'react';
import styles from './team.module.css';

const CHANNEL_ROLES = [
  {
    key: 'WORKER',
    label: 'Operario',
    description: 'Fichaje, evidencia, certificados e incidencias; sin cambiar avances ni demoras.',
  },
  {
    key: 'FOREMAN',
    label: 'Capataz',
    description: 'Puede informar avances, además de fichaje, evidencia, incidencias y demoras.',
  },
  {
    key: 'SITE_MANAGER',
    label: 'Jefe de obra',
    description: 'Mismos comandos operativos que capataz, aplicados desde su identidad autorizada.',
  },
  {
    key: 'SAFETY',
    label: 'Seguridad e higiene',
    description: 'Fichaje, evidencias, certificados e incidencias; sin cambiar avances ni demoras.',
  },
];

const CHANNEL_STATUS_LABELS = Object.freeze({
  VERIFIED: 'Verificado',
  PENDING: 'Pendiente',
  REVOKED: 'Revocado',
  CONFLICT: 'En conflicto',
});

function workerRoleLabel(role) {
  return CHANNEL_ROLES.find((option) => option.key === role)?.label || 'Operario';
}

function workerChannel(worker) {
  const channels = Array.isArray(worker.channels) ? worker.channels : [];
  return channels.find((channel) => channel.status === 'VERIFIED') || channels[0] || null;
}

function workerChannelLabel(worker) {
  return worker.phone || workerChannel(worker)?.addressMasked || 'Canal no disponible';
}

function workerChannelStatusLabel(worker) {
  const channel = workerChannel(worker);
  if (!channel) return 'Registro anterior';
  return CHANNEL_STATUS_LABELS[channel.status] || 'Estado no disponible';
}

function hasUsableChannel(worker) {
  if (!worker.active) return false;
  if (worker.phone) return true;
  const channel = workerChannel(worker);
  return channel?.status === 'VERIFIED' && Boolean(channel.verifiedAt);
}

export default function FieldWorkersClient({ initialWorkers, canManage, projectName }) {
  const [workers, setWorkers] = useState(initialWorkers);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    role: '',
    whatsappRole: 'WORKER',
  });
  const [pending, setPending] = useState(null);
  const [message, setMessage] = useState(null);

  async function createWorker(event) {
    event.preventDefault();
    setPending('create');
    setMessage(null);
    try {
      const response = await fetch('/api/field/workers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'No se pudo autorizar el número.');
      setWorkers((current) => [payload.worker, ...current]);
      setForm({ name: '', phone: '', role: '', whatsappRole: 'WORKER' });
      setMessage({
        type: 'success',
        text: 'Número autorizado. Los comandos de WhatsApp ya respetan su identidad y rol.',
      });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setPending(null);
    }
  }

  async function updateWorker(workerId, changes, successText) {
    setPending(workerId);
    setMessage(null);
    try {
      const response = await fetch('/api/field/workers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workerId, ...changes }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'No se pudo actualizar el acceso.');
      setWorkers((current) => current.map((worker) => (
        worker.id === workerId ? payload.worker : worker
      )));
      setMessage({ type: 'success', text: successText });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setPending(null);
    }
  }

  const activeCount = workers.filter(hasUsableChannel).length;

  return (
    <section className={styles.fieldPanel} aria-labelledby="field-workers-title">
      <div className={styles.fieldPanelHeader}>
        <div>
          <p className={styles.eyebrow}>Identidad de campo</p>
          <h2 id="field-workers-title">Cuadrilla autorizada por WhatsApp</h2>
          <p>
            {projectName} · solo estos números pueden registrar acciones. Un contacto desconocido
            queda bloqueado antes de descargar o transcribir archivos.
          </p>
        </div>
        <div className={styles.fieldMetric} aria-label={`${activeCount} canales activos`}>
          <strong>{activeCount}</strong>
          <span>canales activos</span>
        </div>
      </div>

      {canManage && (
        <form className={styles.workerForm} onSubmit={createWorker}>
          <div className={styles.legacyWorkerNotice}>
            <strong>Alta administrativa heredada · uso excepcional</strong>
            <span>
              Priorizá el alta protegida por WhatsApp. Usá este formulario sólo para una
              contingencia administrativa documentada.
            </span>
          </div>
          <label>
            <span>Nombre y apellido</span>
            <input
              autoComplete="name"
              maxLength={100}
              placeholder="María Fernández"
              required
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
          </label>
          <label>
            <span>WhatsApp internacional</span>
            <input
              autoComplete="tel"
              inputMode="tel"
              maxLength={24}
              placeholder="+54 9 11 2345 6789"
              required
              value={form.phone}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
            />
          </label>
          <label>
            <span>Oficio / función</span>
            <input
              maxLength={80}
              placeholder="Capataz de estructura"
              value={form.role}
              onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}
            />
          </label>
          <label>
            <span>Permiso del canal</span>
            <select
              value={form.whatsappRole}
              onChange={(event) => setForm((current) => ({
                ...current,
                whatsappRole: event.target.value,
              }))}
            >
              {CHANNEL_ROLES.map((role) => (
                <option key={role.key} value={role.key}>{role.label}</option>
              ))}
            </select>
          </label>
          <button disabled={pending === 'create'} type="submit">
            {pending === 'create' ? 'Autorizando…' : 'Crear alta excepcional'}
          </button>
        </form>
      )}

      {message && (
        <div
          className={message.type === 'success' ? styles.success : styles.error}
          role={message.type === 'error' ? 'alert' : 'status'}
        >
          {message.text}
        </div>
      )}

      <div className={styles.workerList}>
        {workers.length === 0 ? (
          <div className={styles.workerEmpty}>
            <strong>Todavía no hay números autorizados</strong>
            <p>
              Hasta registrar la cuadrilla, los mensajes entrantes no pueden cambiar avances,
              asistencia ni incidencias de la obra.
            </p>
          </div>
        ) : workers.map((worker) => (
          <article
            className={`${styles.workerCard} ${!worker.active ? styles.workerInactive : ''}`}
            id={`field-worker-${worker.id}`}
            key={worker.id}
          >
            <div className={styles.workerIdentity}>
              <span className={styles.channelBadge} aria-hidden="true">WA</span>
              <div>
                <strong>{worker.name}</strong>
                <span>{workerChannelLabel(worker)}</span>
              </div>
            </div>
            <div className={styles.workerDetails}>
              <span>{worker.role || 'Cuadrilla de obra'}</span>
              <strong>
                {workerRoleLabel(worker.whatsappRole)}
                {` · ${workerChannelStatusLabel(worker)}`}
              </strong>
            </div>
            {canManage ? (
              <div className={styles.workerActions}>
                <label>
                  <select
                    aria-label={`Permiso de WhatsApp de ${worker.name}`}
                    disabled={pending === worker.id || !worker.active}
                    value={worker.whatsappRole}
                    onChange={(event) => updateWorker(
                      worker.id,
                      { whatsappRole: event.target.value },
                      'Permiso actualizado y auditado.',
                    )}
                  >
                    {CHANNEL_ROLES.map((role) => (
                      <option key={role.key} value={role.key}>{role.label}</option>
                    ))}
                  </select>
                </label>
                <button
                  className={worker.active ? styles.deactivateButton : styles.activateButton}
                  disabled={pending === worker.id}
                  type="button"
                  onClick={() => updateWorker(
                    worker.id,
                    { active: !worker.active },
                    worker.active
                      ? 'Número desactivado. Sus próximos comandos quedarán bloqueados.'
                      : 'Número reactivado con su permiso anterior.',
                  )}
                >
                  {pending === worker.id
                    ? 'Guardando…'
                    : worker.active ? 'Desactivar' : 'Reactivar'}
                </button>
              </div>
            ) : (
              <span className={worker.active ? styles.workerStatusActive : styles.workerStatusInactive}>
                {worker.active ? 'Autorizado' : 'Desactivado'}
              </span>
            )}
          </article>
        ))}
      </div>

      <div className={styles.roleLegend}>
        {CHANNEL_ROLES.map((role) => (
          <div key={role.key}>
            <strong>{role.label}</strong>
            <span>{role.description}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
