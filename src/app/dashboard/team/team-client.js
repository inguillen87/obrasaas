'use client';

import { useState } from 'react';
import styles from './team.module.css';

export default function TeamClient({ initialMemberships, roles, canManage }) {
  const [memberships, setMemberships] = useState(initialMemberships);
  const [pending, setPending] = useState(null);
  const [message, setMessage] = useState(null);

  async function updateRole(membershipId, tenantRole) {
    setPending(membershipId);
    setMessage(null);
    try {
      const response = await fetch('/api/tenant/members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ membershipId, tenantRole }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudo actualizar el rol.');
      setMemberships((current) => current.map((membership) => (
        membership.id === membershipId ? payload.membership : membership
      )));
      setMessage({ type: 'success', text: 'Rol actualizado y registrado en auditoría.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setPending(null);
    }
  }

  return (
    <section className={styles.membersPanel}>
      <div className={styles.panelHeading}>
        <div>
          <p className={styles.eyebrow}>Acceso activo</p>
          <h2>{memberships.length} integrantes</h2>
        </div>
        <p>{canManage ? 'Los cambios quedan auditados.' : 'Vista de solo lectura.'}</p>
      </div>

      {message && (
        <div className={message.type === 'success' ? styles.success : styles.error} role="status">
          {message.text}
        </div>
      )}

      <div className={styles.memberList}>
        {memberships.map((membership) => {
          const clerkAdmin = membership.clerkRole === 'org:admin';
          return (
            <article className={styles.member} key={membership.id}>
              <div className={styles.avatar} aria-hidden="true">
                {(membership.user.name || membership.user.email).slice(0, 2).toUpperCase()}
              </div>
              <div className={styles.person}>
                <strong>{membership.user.name || 'Sin nombre'}</strong>
                <span>{membership.user.email}</span>
              </div>
              <span className={styles.status}>{membership.status}</span>
              <label>
                <span>Rol ObraSaaS</span>
                <select
                  value={membership.tenantRole}
                  disabled={!canManage || pending === membership.id || clerkAdmin}
                  onChange={(event) => updateRole(membership.id, event.target.value)}
                >
                  {roles.map((role) => (
                    <option
                      key={role.key}
                      value={role.key}
                      disabled={role.key === 'ADMIN' && !clerkAdmin}
                    >
                      {role.label}
                    </option>
                  ))}
                </select>
              </label>
              {clerkAdmin && <small>Administrador de la organización</small>}
            </article>
          );
        })}
      </div>
    </section>
  );
}
