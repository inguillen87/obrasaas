'use client';

import { useState } from 'react';
import styles from './team.module.css';

const invitationDateFormatter = new Intl.DateTimeFormat('es-AR', {
  timeZone: 'America/Argentina/Buenos_Aires',
});

const PROJECT_STATUS_LABELS = {
  PLANNING: 'Planificación',
  ACTIVE: 'Activa',
  PAUSED: 'Pausada',
  COMPLETED: 'Finalizada',
};

const MEMBERSHIP_STATUS_LABELS = {
  ACTIVE: 'Activo',
  INVITED: 'Invitado',
  DISABLED: 'Desactivado',
};

function sortedIds(projectIds = []) {
  return [...projectIds].sort((left, right) => left.localeCompare(right, 'en'));
}

function sameIds(left, right) {
  const normalizedLeft = sortedIds(left);
  const normalizedRight = sortedIds(right);
  return normalizedLeft.length === normalizedRight.length
    && normalizedLeft.every((projectId, index) => projectId === normalizedRight[index]);
}

function initialDrafts(memberships) {
  return Object.fromEntries(
    memberships.map((membership) => [membership.id, sortedIds(membership.projectIds)]),
  );
}

export default function TeamClient({
  initialMemberships,
  initialInvitations,
  roles,
  canManage,
  projects,
  officeUserLimit,
}) {
  const [memberships, setMemberships] = useState(initialMemberships);
  const [invitations, setInvitations] = useState(initialInvitations);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('SITE_MANAGER');
  const [pending, setPending] = useState(null);
  const [message, setMessage] = useState(null);
  const [assignmentDrafts, setAssignmentDrafts] = useState(() => initialDrafts(initialMemberships));
  const [assignmentPending, setAssignmentPending] = useState(null);
  const [assignmentMessages, setAssignmentMessages] = useState({});

  const roleByKey = Object.fromEntries(roles.map((role) => [role.key, role]));
  const roleLabels = Object.fromEntries(roles.map((role) => [role.key, role.label]));
  const projectsById = Object.fromEntries(projects.map((project) => [project.id, project]));

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
    setAssignmentMessages((current) => ({ ...current, [membershipId]: null }));
    try {
      const response = await fetch('/api/tenant/members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ membershipId, tenantRole }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudo actualizar el rol.');
      setMemberships((current) => current.map((membership) => {
        if (membership.id !== membershipId) return membership;
        return {
          ...membership,
          ...payload.membership,
          projectIds: payload.membership.projectIds || membership.projectIds,
          portfolioAccess: Boolean(roleByKey[payload.membership.tenantRole]?.portfolioAccess),
        };
      }));
      if (payload.membership.projectIds) {
        setAssignmentDrafts((current) => ({
          ...current,
          [membershipId]: sortedIds(payload.membership.projectIds),
        }));
      }
      setMessage({ type: 'success', text: 'Rol actualizado y registrado en auditoría.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setPending(null);
    }
  }

  function toggleProject(membershipId, projectId, checked) {
    setAssignmentDrafts((current) => {
      const nextIds = new Set(current[membershipId] || []);
      if (checked) nextIds.add(projectId);
      else nextIds.delete(projectId);
      return { ...current, [membershipId]: sortedIds(nextIds) };
    });
    setAssignmentMessages((current) => ({ ...current, [membershipId]: null }));
  }

  function resetProjectAccess(membership) {
    setAssignmentDrafts((current) => ({
      ...current,
      [membership.id]: sortedIds(membership.projectIds),
    }));
    setAssignmentMessages((current) => ({ ...current, [membership.id]: null }));
  }

  async function saveProjectAccess(membership) {
    const projectIds = sortedIds(assignmentDrafts[membership.id] || []);
    setAssignmentPending(membership.id);
    setAssignmentMessages((current) => ({ ...current, [membership.id]: null }));
    try {
      const response = await fetch('/api/tenant/project-access', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          membershipId: membership.id,
          projectIds,
          expectedProjectIds: sortedIds(membership.projectIds),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        if (Array.isArray(payload.currentProjectIds)) {
          const currentProjectIds = sortedIds(payload.currentProjectIds);
          setMemberships((current) => current.map((item) => (
            item.id === membership.id ? { ...item, projectIds: currentProjectIds } : item
          )));
          setAssignmentDrafts((current) => ({
            ...current,
            [membership.id]: currentProjectIds,
          }));
        }
        throw new Error(payload.error || 'No se pudo actualizar el acceso a las obras.');
      }
      const confirmedIds = sortedIds(payload.projectAccess.projectIds);
      setMemberships((current) => current.map((item) => (
        item.id === membership.id ? { ...item, projectIds: confirmedIds } : item
      )));
      setAssignmentDrafts((current) => ({ ...current, [membership.id]: confirmedIds }));
      setAssignmentMessages((current) => ({
        ...current,
        [membership.id]: {
          type: 'success',
          text: payload.projectAccess.changed
            ? 'Acceso por obra actualizado y auditado.'
            : 'El acceso ya estaba sincronizado.',
        },
      }));
    } catch (error) {
      setAssignmentMessages((current) => ({
        ...current,
        [membership.id]: { type: 'error', text: error.message },
      }));
    } finally {
      setAssignmentPending(null);
    }
  }

  return (
    <section className={styles.membersPanel}>
      {canManage && (
        <div className={styles.invitePanel}>
          <div>
            <p className={styles.eyebrow}>Activar equipo</p>
            <h2>Invitar una persona</h2>
            <p>
              Hasta {officeUserLimit} cuentas de acceso en el plan actual. Las cuadrillas que operan
              por WhatsApp no ocupan una cuenta.
            </p>
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
        <p>{canManage ? 'Roles y alcance por obra con auditoría.' : 'Vista de solo lectura.'}</p>
      </div>

      {message && (
        <div
          className={message.type === 'success' ? styles.success : styles.error}
          role="status"
        >
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
                <span>
                  {roleLabels[invitation.tenantRole] || invitation.tenantRole}
                  {' · vence '}
                  {invitationDateFormatter.format(new Date(invitation.expiresAt))}
                </span>
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
          const portfolioAccess = Boolean(
            roleByKey[membership.tenantRole]?.portfolioAccess || membership.portfolioAccess,
          );
          const draftIds = assignmentDrafts[membership.id] || [];
          const assignedProjects = membership.projectIds
            .map((projectId) => projectsById[projectId])
            .filter(Boolean);
          const isAssignmentPending = assignmentPending === membership.id;
          const isDirty = !sameIds(draftIds, membership.projectIds);
          const assignmentMessage = assignmentMessages[membership.id];
          const assignmentFeedbackId = `project-access-feedback-${membership.id}`;

          return (
            <article className={styles.member} key={membership.id}>
              <div className={styles.memberSummary}>
                <div className={styles.avatar} aria-hidden="true">
                  {(membership.user.name || membership.user.email).slice(0, 2).toUpperCase()}
                </div>
                <div className={styles.person}>
                  <strong>{membership.user.name || 'Sin nombre'}</strong>
                  <span>{membership.user.email}</span>
                </div>
                <span
                  className={
                    membership.status === 'ACTIVE' ? styles.status : styles.statusInactive
                  }
                >
                  {MEMBERSHIP_STATUS_LABELS[membership.status] || membership.status}
                </span>
                <label className={styles.roleControl}>
                  <span>Rol ObraSaaS</span>
                  <select
                    value={membership.tenantRole}
                    disabled={
                      !canManage
                      || pending === membership.id
                      || isAssignmentPending
                      || clerkAdmin
                    }
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
              </div>

              {clerkAdmin && (
                <p className={styles.clerkAdminNote}>Administrador de la organización en Clerk</p>
              )}

              <div className={styles.projectAccess}>
                <div className={styles.projectAccessHeading}>
                  <div>
                    <span>Alcance operativo</span>
                    <strong>{portfolioAccess ? 'Portfolio completo' : `${draftIds.length} obras`}</strong>
                  </div>
                  {!portfolioAccess && (
                    <span className={styles.accessMode}>
                      {canManage ? 'Asignación exacta' : 'Sólo lectura'}
                    </span>
                  )}
                </div>

                {portfolioAccess ? (
                  <div className={styles.portfolioAccess}>
                    <span aria-hidden="true">360°</span>
                    <div>
                      <strong>Portfolio completo</strong>
                      <p>
                        {roleLabels[membership.tenantRole]} puede consultar todas las obras actuales y
                        futuras del tenant. Este alcance no se edita obra por obra.
                      </p>
                    </div>
                  </div>
                ) : canManage ? (
                  <>
                    {projects.length > 0 ? (
                      <fieldset
                        className={styles.projectChecklist}
                        disabled={membership.status !== 'ACTIVE' || isAssignmentPending}
                        aria-describedby={assignmentMessage ? assignmentFeedbackId : undefined}
                      >
                        <legend>Obras asignadas a {membership.user.name || membership.user.email}</legend>
                        {projects.map((project) => {
                          const checked = draftIds.includes(project.id);
                          return (
                            <label
                              className={checked ? styles.projectOptionSelected : styles.projectOption}
                              key={project.id}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(event) => toggleProject(
                                  membership.id,
                                  project.id,
                                  event.target.checked,
                                )}
                              />
                              <span>
                                <strong>{project.name}</strong>
                                <small>{PROJECT_STATUS_LABELS[project.status] || project.status}</small>
                              </span>
                            </label>
                          );
                        })}
                      </fieldset>
                    ) : (
                      <p className={styles.noProjects}>No hay obras disponibles para asignar.</p>
                    )}
                    <div className={styles.assignmentFooter}>
                      <p>
                        {draftIds.length === 0
                          ? 'Sin acceso operativo hasta que se asigne una obra.'
                          : `${draftIds.length} de ${projects.length} obras seleccionadas.`}
                      </p>
                      <div>
                        <button
                          className={styles.secondaryButton}
                          disabled={!isDirty || isAssignmentPending}
                          type="button"
                          onClick={() => resetProjectAccess(membership)}
                        >
                          Descartar
                        </button>
                        <button
                          className={styles.saveAccessButton}
                          disabled={!isDirty || isAssignmentPending}
                          type="button"
                          onClick={() => saveProjectAccess(membership)}
                        >
                          {isAssignmentPending ? 'Guardando…' : 'Guardar alcance'}
                        </button>
                      </div>
                    </div>
                  </>
                ) : assignedProjects.length > 0 ? (
                  <div className={styles.assignedProjectList} role="list" aria-label="Obras asignadas">
                    {assignedProjects.map((project) => (
                      <span key={project.id} role="listitem">
                        {project.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className={styles.noProjects}>Sin obras asignadas.</p>
                )}

                {assignmentMessage && (
                  <p
                    className={
                      assignmentMessage.type === 'success'
                        ? styles.assignmentSuccess
                        : styles.assignmentError
                    }
                    id={assignmentFeedbackId}
                    role="status"
                  >
                    {assignmentMessage.text}
                  </p>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
