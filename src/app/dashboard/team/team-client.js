'use client';

import { useState } from 'react';
import styles from './team.module.css';

const invitationDateFormatter = new Intl.DateTimeFormat('es-AR', {
  timeZone: 'America/Argentina/Buenos_Aires',
});

export default function TeamClient({ initialMemberships, initialInvitations, roles, canManage }) {
  const [memberships, setMemberships] = useState(initialMemberships);
  const [invitations, setInvitations] = useState(initialInvitations);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('SITE_MANAGER');
  const [pending, setPending] = useState(null);
  const [message, setMessage] = useState(null);

  const roleLabels = Object.fromEntries(roles.map((role) => [role.key, role.label]));

  async function inviteMember(event) {
    event.preventDefault();
    setPending('invite');
    setMessage(null);
    try {
      const response = await fetch('/api/tenant/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, tenantRole: inviteRole }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudo enviar la invitación.');
      setInvitations((current) => [payload.invitation, ...current]);
      setInviteEmail('');
      setMessage({ type: 'success', text: 'Invitación enviada. El acceso vence en 7 días.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setPending(null);
    }
  }

  async function revokeInvitation(invitationId) {
    setPending(invitationId);
    setMessage(null);
    try {
      const response = await fetch('/api/tenant/invitations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitationId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudo revocar la invitación.');
      setInvitations((current) => current.filter((item) => item.id !== invitationId));
      setMessage({ type: 'success', text: 'Invitación revocada y registrada en auditoría.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setPending(null);
    }
  }

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
      {canManage && (
        <div className={styles.invitePanel}>
          <div>
            <p className={styles.eyebrow}>Activar equipo</p>
            <h2>Invitar una persona</h2>
            <p>Hasta 20 cuentas de acceso. Las cuadrillas que operan por WhatsApp no ocupan una cuenta.</p>
          </div>
          <form className={styles.inviteForm} onSubmit={inviteMember}>
            <label>
              <span>Email laboral</span>
              <input
                autoComplete="email"
                inputMode="email"
                placeholder="persona@empresa.com"
                required
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
              />
            </label>
            <label>
              <span>Rol inicial</span>
              <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value)}>
                {roles.map((role) => <option key={role.key} value={role.key}>{role.label}</option>)}
              </select>
            </label>
            <button disabled={pending === 'invite'} type="submit">
              {pending === 'invite' ? 'Enviando…' : 'Enviar invitación'}
            </button>
          </form>
        </div>
      )}

      <div className={styles.panelHeading}>
        <div>
          <p className={styles.eyebrow}>Acceso activo</p>
          <h2>{memberships.length} {memberships.length === 1 ? 'integrante' : 'integrantes'}</h2>
        </div>
        <p>{canManage ? 'Los cambios quedan auditados.' : 'Vista de solo lectura.'}</p>
      </div>

      {message && (
        <div className={message.type === 'success' ? styles.success : styles.error} role="status">
          {message.text}
        </div>
      )}

      {canManage && invitations.length > 0 && (
        <div className={styles.pendingInvitations}>
          <div className={styles.subheading}>
            <strong>Invitaciones pendientes</strong>
            <span>{invitations.length}</span>
          </div>
          {invitations.map((invitation) => (
            <article key={invitation.id}>
              <div>
                <strong>{invitation.email}</strong>
                <span>{roleLabels[invitation.tenantRole] || invitation.tenantRole} · vence {invitationDateFormatter.format(new Date(invitation.expiresAt))}</span>
              </div>
              <button
                disabled={pending === invitation.id}
                type="button"
                onClick={() => revokeInvitation(invitation.id)}
              >
                {pending === invitation.id ? 'Revocando…' : 'Revocar'}
              </button>
            </article>
          ))}
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
