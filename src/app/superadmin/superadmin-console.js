'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import styles from './superadmin.module.css';

const STATUS_LABELS = {
  TRIALING: 'En prueba',
  ACTIVE: 'Activo',
  PAST_DUE: 'Pago pendiente',
  CANCELED: 'Cancelado',
  SUSPENDED: 'Suspendido',
};

const HEALTH_LABELS = {
  HEALTHY: 'Saludable',
  ONBOARDING: 'Onboarding',
  ATTENTION: 'Atención',
  RISK: 'En riesgo',
  BLOCKED: 'Bloqueado',
};

function formatDate(value, includeTime = false) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('es-AR', includeTime ? {
    dateStyle: 'medium',
    timeStyle: 'short',
  } : {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function dateInputValue(value) {
  return value ? new Date(value).toISOString().slice(0, 10) : '';
}

function searchableText(tenant) {
  return [tenant.name, tenant.slug, tenant.primaryContact?.name, tenant.primaryContact?.email]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('es');
}

export default function SuperadminConsole({ initialTenants }) {
  const router = useRouter();
  const [tenantOverrides, setTenantOverrides] = useState({});
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [planFilter, setPlanFilter] = useState('ALL');
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [notice, setNotice] = useState(null);
  const [pending, setPending] = useState(false);

  const tenants = useMemo(() => initialTenants.map((tenant) => ({
    ...tenant,
    ...(tenantOverrides[tenant.id] || {}),
  })), [initialTenants, tenantOverrides]);

  const visibleTenants = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('es');
    return tenants.filter((tenant) => (
      (!normalizedQuery || searchableText(tenant).includes(normalizedQuery))
      && (statusFilter === 'ALL' || tenant.subscriptionStatus === statusFilter)
      && (planFilter === 'ALL' || tenant.subscriptionPlan === planFilter)
    ));
  }, [planFilter, query, statusFilter, tenants]);

  const selected = tenants.find((tenant) => tenant.id === selectedId) || null;

  function openTenant(tenant) {
    setSelectedId(tenant.id);
    setDraft({
      subscriptionPlan: tenant.subscriptionPlan,
      subscriptionStatus: tenant.subscriptionStatus,
      trialEndsAt: dateInputValue(tenant.trialEndsAt),
    });
    setNotice(null);
  }

  function closeTenant() {
    if (pending) return;
    setSelectedId(null);
    setDraft(null);
    setNotice(null);
  }

  function setPlan(subscriptionPlan) {
    setDraft((current) => ({
      ...current,
      subscriptionPlan,
      subscriptionStatus: subscriptionPlan === 'TRIAL'
        ? 'TRIALING'
        : current.subscriptionStatus === 'TRIALING' ? 'ACTIVE' : current.subscriptionStatus,
    }));
  }

  function setStatus(subscriptionStatus) {
    setDraft((current) => ({
      ...current,
      subscriptionStatus,
      subscriptionPlan: subscriptionStatus === 'TRIALING'
        ? 'TRIAL'
        : ['ACTIVE', 'PAST_DUE'].includes(subscriptionStatus) && current.subscriptionPlan === 'TRIAL'
          ? 'PRO'
          : current.subscriptionPlan,
    }));
  }

  function extendTrial() {
    const base = draft?.trialEndsAt && new Date(`${draft.trialEndsAt}T12:00:00Z`).getTime() > Date.now()
      ? new Date(`${draft.trialEndsAt}T12:00:00Z`)
      : new Date();
    base.setUTCDate(base.getUTCDate() + 14);
    setDraft({
      subscriptionPlan: 'TRIAL',
      subscriptionStatus: 'TRIALING',
      trialEndsAt: base.toISOString().slice(0, 10),
    });
    setNotice({ type: 'info', text: 'Se preparó una extensión de 14 días. Guardá para aplicarla.' });
  }

  async function saveTenant(event) {
    event.preventDefault();
    if (!selected || !draft || pending) return;
    if (
      ['SUSPENDED', 'CANCELED'].includes(draft.subscriptionStatus)
      && !window.confirm(`¿Confirmás dejar a ${selected.name} en estado ${STATUS_LABELS[draft.subscriptionStatus]}?`)
    ) return;

    setPending(true);
    setNotice(null);
    try {
      const response = await fetch('/api/superadmin/tenants', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: selected.id, ...draft }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'No se pudo actualizar el tenant.');
      setTenantOverrides((current) => ({
        ...current,
        [selected.id]: { ...(current[selected.id] || {}), ...payload.tenant },
      }));
      setNotice({ type: 'success', text: 'Cambio aplicado y registrado en auditoría.' });
      router.refresh();
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setPending(false);
    }
  }

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.eyebrow}>CRM de cuentas</p>
          <h2>Organizaciones y suscripciones</h2>
        </div>
        <span className={styles.liveBadge}><i /> Datos reales de Neon</span>
      </div>

      <div className={styles.toolbar}>
        <label className={styles.searchField}>
          <span>Buscar tenant o contacto</span>
          <div><i className="fa-solid fa-magnifying-glass" aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Organización, email o slug" /></div>
        </label>
        <label>
          <span>Estado</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="ALL">Todos</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          <span>Plan</span>
          <select value={planFilter} onChange={(event) => setPlanFilter(event.target.value)}>
            <option value="ALL">Todos</option>
            <option value="TRIAL">Trial</option>
            <option value="PRO">Pro</option>
            <option value="ENTERPRISE">Enterprise</option>
          </select>
        </label>
        <div className={styles.resultCount}><strong>{visibleTenants.length}</strong><span>de {tenants.length} tenants</span></div>
      </div>

      {tenants.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}><i className="fa-solid fa-building-circle-check" aria-hidden="true" /></div>
          <strong>Control plane listo para el primer tenant externo.</strong>
          <p>Las altas creadas desde Clerk aparecerán con su prueba, equipo, obras, canal WhatsApp y salud operativa.</p>
        </div>
      ) : visibleTenants.length === 0 ? (
        <div className={styles.emptyState}>
          <strong>No hay resultados con estos filtros.</strong>
          <button type="button" onClick={() => { setQuery(''); setStatusFilter('ALL'); setPlanFilter('ALL'); }}>Limpiar filtros</button>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table>
            <thead><tr><th>Organización</th><th>Salud</th><th>Plan</th><th>Adopción</th><th>WhatsApp</th><th>Última actividad</th><th><span className={styles.srOnly}>Acciones</span></th></tr></thead>
            <tbody>
              {visibleTenants.map((tenant) => (
                <tr key={tenant.id}>
                  <td>
                    <strong>{tenant.name}</strong>
                    <small>{tenant.primaryContact?.email || tenant.slug}</small>
                  </td>
                  <td><span className={`${styles.health} ${styles[tenant.health.toLowerCase()]}`}><i />{HEALTH_LABELS[tenant.health]}</span>{tenant.failedWebhooks > 0 && <small>{tenant.failedWebhooks} webhook{tenant.failedWebhooks === 1 ? '' : 's'} fallido{tenant.failedWebhooks === 1 ? '' : 's'}</small>}</td>
                  <td><strong>{tenant.subscriptionPlan}</strong><span className={`${styles.status} ${styles[tenant.subscriptionStatus.toLowerCase()]}`}>{STATUS_LABELS[tenant.subscriptionStatus]}</span></td>
                  <td><strong>{tenant.activeMembers}/{tenant.members} usuarios</strong><small>{tenant.activeProjects}/{tenant.projects} obras activas</small></td>
                  <td><strong>{tenant.connectedChannels > 0 ? `${tenant.connectedChannels} conectado${tenant.connectedChannels === 1 ? '' : 's'}` : 'Sin conectar'}</strong><small>Cloud API por tenant</small></td>
                  <td><strong>{formatDate(tenant.lastActivityAt, true)}</strong><small>Alta {formatDate(tenant.createdAt)}</small></td>
                  <td><button type="button" className={styles.manageButton} onClick={() => openTenant(tenant)}>Gestionar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && draft && (
        <div className={styles.drawerBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeTenant(); }}>
          <aside className={styles.drawer} aria-label={`Gestionar ${selected.name}`}>
            <div className={styles.drawerHeader}>
              <div><p className={styles.eyebrow}>Cuenta tenant</p><h2>{selected.name}</h2><span>{selected.primaryContact?.email || selected.slug}</span></div>
              <button type="button" onClick={closeTenant} aria-label="Cerrar panel"><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
            </div>

            <div className={styles.accountSnapshot}>
              <div><span>Salud</span><strong>{HEALTH_LABELS[selected.health]}</strong></div>
              <div><span>Equipo</span><strong>{selected.activeMembers} activos</strong></div>
              <div><span>Obras</span><strong>{selected.activeProjects} activas</strong></div>
              <div><span>WhatsApp</span><strong>{selected.connectedChannels > 0 ? 'Conectado' : 'Pendiente'}</strong></div>
            </div>

            <form onSubmit={saveTenant} className={styles.tenantForm}>
              <label><span>Plan comercial</span><select value={draft.subscriptionPlan} onChange={(event) => setPlan(event.target.value)} disabled={pending}><option value="TRIAL">Trial · USD 0</option><option value="PRO">Pro · USD 199/mes</option><option value="ENTERPRISE">Enterprise · desde USD 699/mes</option></select></label>
              <label><span>Estado de la cuenta</span><select value={draft.subscriptionStatus} onChange={(event) => setStatus(event.target.value)} disabled={pending}>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label><span>Fin de prueba</span><input type="date" value={draft.trialEndsAt} onChange={(event) => setDraft((current) => ({ ...current, trialEndsAt: event.target.value }))} disabled={pending || draft.subscriptionStatus !== 'TRIALING'} /></label>

              <button type="button" className={styles.trialButton} onClick={extendTrial} disabled={pending}><i className="fa-regular fa-calendar-plus" aria-hidden="true" /> Extender prueba 14 días</button>
              {notice && <div className={`${styles.formNotice} ${styles[notice.type]}`} role="status">{notice.text}</div>}

              <div className={styles.auditNote}><i className="fa-solid fa-shield-halved" aria-hidden="true" /><span>El cambio se aplicará de inmediato y quedará registrado con tu identidad de superadmin.</span></div>
              <div className={styles.formActions}><button type="button" onClick={closeTenant} disabled={pending}>Cancelar</button><button type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Guardar cambio'}</button></div>
            </form>
          </aside>
        </div>
      )}
    </section>
  );
}
