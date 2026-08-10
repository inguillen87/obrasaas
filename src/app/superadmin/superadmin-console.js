'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import styles from './superadmin.module.css';

const STATUS_LABELS = {
  TRIALING: 'En prueba',
  TRIAL_EXPIRED: 'Prueba vencida',
  ACTIVE: 'Activo',
  PAST_DUE: 'Pago pendiente',
  CANCELED: 'Cancelado',
  SUSPENDED: 'Suspendido',
};

const EDITABLE_STATUS_LABELS = Object.fromEntries(
  Object.entries(STATUS_LABELS).filter(([status]) => status !== 'TRIAL_EXPIRED'),
);

const HEALTH_LABELS = {
  HEALTHY: 'Saludable',
  ONBOARDING: 'Onboarding',
  ATTENTION: 'Atención',
  RISK: 'En riesgo',
  BLOCKED: 'Bloqueado',
};

const CRM_STAGE_LABELS = {
  NEW: 'Nuevo',
  CONTACTED: 'Contactado',
  QUALIFIED: 'Calificado',
  DEMO: 'Demo',
  PROPOSAL: 'Propuesta',
  TRIAL: 'Prueba',
  WON: 'Ganado',
  LOST: 'Perdido',
};

const SEGMENT_LABELS = {
  ARCHITECTURE: 'Estudio de arquitectura',
  CONSTRUCTION: 'Constructora',
  REAL_ESTATE: 'Desarrolladora',
  GOVERNMENT: 'Gobierno / sector público',
  INDUSTRIAL: 'Infraestructura / industria',
  OTHER: 'Otro',
};

const SOURCE_LABELS = {
  REFERRAL: 'Referido',
  ORGANIC: 'Orgánico',
  OUTBOUND: 'Prospección',
  PARTNER: 'Partner',
  EVENT: 'Evento',
  OTHER: 'Otro',
};

const OPEN_CRM_STAGES = new Set(['NEW', 'CONTACTED', 'QUALIFIED', 'DEMO', 'PROPOSAL', 'TRIAL']);

function emptyAccountDraft() {
  return {
    name: '',
    contactName: '',
    email: '',
    phone: '',
    segment: 'CONSTRUCTION',
    source: 'REFERRAL',
    stage: 'NEW',
    estimatedSeats: '',
    estimatedMonthlyValue: '',
    nextFollowUpAt: '',
    notes: '',
  };
}

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

function formatCurrency(value) {
  if (value === null || value === undefined || value === '') return 'Sin estimar';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function searchableText(tenant) {
  return [tenant.name, tenant.slug, tenant.primaryContact?.name, tenant.primaryContact?.email]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('es');
}

function tenantAccessStatus(tenant) {
  return tenant.subscriptionAccessStatus || tenant.subscriptionStatus;
}

export default function SuperadminConsole({ initialTenants, initialAccounts }) {
  const router = useRouter();
  const accountNameRef = useRef(null);
  const [tenantOverrides, setTenantOverrides] = useState({});
  const [accounts, setAccounts] = useState(initialAccounts);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [planFilter, setPlanFilter] = useState('ALL');
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [notice, setNotice] = useState(null);
  const [pending, setPending] = useState(false);
  const [accountEditor, setAccountEditor] = useState(null);
  const [accountNotice, setAccountNotice] = useState(null);
  const [accountPending, setAccountPending] = useState(false);
  const [crmQuery, setCrmQuery] = useState('');
  const [crmStageFilter, setCrmStageFilter] = useState('ALL');
  const accountEditorOpen = Boolean(accountEditor);

  const tenants = useMemo(() => initialTenants.map((tenant) => ({
    ...tenant,
    ...(tenantOverrides[tenant.id] || {}),
  })), [initialTenants, tenantOverrides]);

  const visibleTenants = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('es');
    return tenants.filter((tenant) => (
      (!normalizedQuery || searchableText(tenant).includes(normalizedQuery))
      && (statusFilter === 'ALL' || tenantAccessStatus(tenant) === statusFilter)
      && (planFilter === 'ALL' || tenant.subscriptionPlan === planFilter)
    ));
  }, [planFilter, query, statusFilter, tenants]);

  const selected = tenants.find((tenant) => tenant.id === selectedId) || null;

  const pipeline = useMemo(() => {
    const open = accounts.filter((account) => OPEN_CRM_STAGES.has(account.stage));
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return {
      open: open.length,
      value: open.reduce((sum, account) => sum + Number(account.estimatedMonthlyValue || 0), 0),
      cutoff: today.getTime(),
      due: open.filter((account) => (
        account.nextFollowUpAt && new Date(account.nextFollowUpAt).getTime() <= today.getTime()
      )).length,
      trials: accounts.filter((account) => account.stage === 'TRIAL').length,
    };
  }, [accounts]);

  const visibleAccounts = useMemo(() => {
    const normalizedQuery = crmQuery.trim().toLocaleLowerCase('es');
    return accounts.filter((account) => {
      const haystack = [account.name, account.contactName, account.email, account.phone]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('es');
      return (!normalizedQuery || haystack.includes(normalizedQuery))
        && (crmStageFilter === 'ALL' || account.stage === crmStageFilter);
    });
  }, [accounts, crmQuery, crmStageFilter]);

  useEffect(() => {
    if (!selectedId && !accountEditorOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function closeOnEscape(event) {
      if (event.key !== 'Escape') return;
      if (accountEditorOpen && !accountPending) {
        setAccountEditor(null);
        setAccountNotice(null);
      } else if (selectedId && !pending) {
        setSelectedId(null);
        setDraft(null);
        setNotice(null);
      }
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [accountEditorOpen, accountPending, pending, selectedId]);

  useEffect(() => {
    if (!accountEditorOpen) return;
    accountNameRef.current?.focus();
  }, [accountEditorOpen]);

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

  function openNewAccount() {
    setAccountEditor(emptyAccountDraft());
    setAccountNotice(null);
  }

  function openAccount(account) {
    setAccountEditor({
      id: account.id,
      name: account.name,
      contactName: account.contactName || '',
      email: account.email || '',
      phone: account.phone || '',
      segment: account.segment || 'OTHER',
      source: account.source || 'OTHER',
      stage: account.stage,
      estimatedSeats: account.estimatedSeats ?? '',
      estimatedMonthlyValue: account.estimatedMonthlyValue ?? '',
      nextFollowUpAt: dateInputValue(account.nextFollowUpAt),
      notes: account.notes || '',
    });
    setAccountNotice(null);
  }

  function closeAccount() {
    if (accountPending) return;
    setAccountEditor(null);
    setAccountNotice(null);
  }

  function setAccountField(field, value) {
    setAccountEditor((current) => ({ ...current, [field]: value }));
  }

  async function saveAccount(event) {
    event.preventDefault();
    if (!accountEditor || accountPending) return;
    setAccountPending(true);
    setAccountNotice(null);
    try {
      const response = await fetch('/api/superadmin/crm-accounts', {
        method: accountEditor.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(accountEditor),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'No se pudo guardar la oportunidad.');
      setAccounts((current) => accountEditor.id
        ? current.map((account) => (account.id === payload.account.id ? payload.account : account))
        : [payload.account, ...current]);
      openAccount(payload.account);
      setAccountNotice({ type: 'success', text: 'Oportunidad guardada y registrada en auditoría.' });
      router.refresh();
    } catch (error) {
      setAccountNotice({ type: 'error', text: error.message });
    } finally {
      setAccountPending(false);
    }
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
    <>
    <section className={`${styles.panel} ${styles.pipelinePanel}`}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.eyebrow}>Pipeline comercial</p>
          <h2>Oportunidades antes del alta</h2>
          <p className={styles.panelDescription}>Seguimiento propio para estudios, constructoras, desarrolladoras y sector público.</p>
        </div>
        <button type="button" className={styles.primaryButton} onClick={openNewAccount}>
          <i className="fa-solid fa-plus" aria-hidden="true" /> Nueva oportunidad
        </button>
      </div>

      <div className={styles.pipelineMetrics} aria-label="Métricas del pipeline comercial">
        <article><span>Pipeline abierto</span><strong>{pipeline.open}</strong><small>Oportunidades activas</small></article>
        <article><span>Valor mensual estimado</span><strong>{formatCurrency(pipeline.value)}</strong><small>Sin confundirlo con MRR real</small></article>
        <article><span>Seguimientos vencidos</span><strong>{pipeline.due}</strong><small>Acciones hasta hoy</small></article>
        <article><span>Pruebas comerciales</span><strong>{pipeline.trials}</strong><small>En validación del producto</small></article>
      </div>

      {accounts.length > 0 && (
        <div className={`${styles.toolbar} ${styles.pipelineToolbar}`}>
          <label className={styles.searchField}>
            <span>Buscar oportunidad</span>
            <div><i className="fa-solid fa-magnifying-glass" aria-hidden="true" /><input value={crmQuery} onChange={(event) => setCrmQuery(event.target.value)} placeholder="Empresa, contacto, email o teléfono" /></div>
          </label>
          <label>
            <span>Etapa</span>
            <select value={crmStageFilter} onChange={(event) => setCrmStageFilter(event.target.value)}>
              <option value="ALL">Todas</option>
              {Object.entries(CRM_STAGE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <div className={styles.resultCount}><strong>{visibleAccounts.length}</strong><span>de {accounts.length} oportunidades</span></div>
        </div>
      )}

      {accounts.length === 0 ? (
        <div className={styles.compactEmptyState}>
          <div><strong>El pipeline está listo.</strong><span>Registrá el primer prospecto sin crear todavía un tenant ni generar costos.</span></div>
          <button type="button" onClick={openNewAccount}>Crear oportunidad</button>
        </div>
      ) : visibleAccounts.length === 0 ? (
        <div className={styles.compactEmptyState}>
          <div><strong>No hay oportunidades con estos filtros.</strong><span>El pipeline completo sigue intacto.</span></div>
          <button type="button" onClick={() => { setCrmQuery(''); setCrmStageFilter('ALL'); }}>Limpiar filtros</button>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.pipelineTable}>
            <thead><tr><th>Cuenta</th><th>Etapa</th><th>Segmento</th><th>Valor</th><th>Próximo paso</th><th><span className={styles.srOnly}>Acciones</span></th></tr></thead>
            <tbody>
              {visibleAccounts.map((account) => {
                const followUpDue = account.nextFollowUpAt
                  && new Date(account.nextFollowUpAt).getTime() <= pipeline.cutoff;
                return (
                  <tr key={account.id}>
                    <td><strong>{account.name}</strong><small>{account.contactName || account.email || 'Contacto por definir'}</small></td>
                    <td><span className={`${styles.crmStage} ${styles[`crm${account.stage.toLowerCase()}`]}`}>{CRM_STAGE_LABELS[account.stage]}</span></td>
                    <td><strong>{SEGMENT_LABELS[account.segment] || 'Sin clasificar'}</strong><small>{SOURCE_LABELS[account.source] || 'Origen pendiente'}</small></td>
                    <td><strong>{formatCurrency(account.estimatedMonthlyValue)}</strong><small>{account.estimatedSeats ? `${account.estimatedSeats} usuarios estimados` : 'Usuarios por relevar'}</small></td>
                    <td><strong className={followUpDue ? styles.overdue : undefined}>{formatDate(account.nextFollowUpAt)}</strong><small>{followUpDue ? 'Requiere seguimiento' : 'Próxima acción'}</small></td>
                    <td><button type="button" className={styles.manageButton} onClick={() => openAccount(account)}>Abrir</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>

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
                  <td><strong>{tenant.subscriptionPlan}</strong><span className={`${styles.status} ${styles[tenantAccessStatus(tenant).toLowerCase()]}`}>{STATUS_LABELS[tenantAccessStatus(tenant)]}</span></td>
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
          <aside className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="tenant-drawer-title">
            <div className={styles.drawerHeader}>
              <div><p className={styles.eyebrow}>Cuenta tenant</p><h2 id="tenant-drawer-title">{selected.name}</h2><span>{selected.primaryContact?.email || selected.slug}</span></div>
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
              <label><span>Estado de la cuenta</span><select value={draft.subscriptionStatus} onChange={(event) => setStatus(event.target.value)} disabled={pending}>{Object.entries(EDITABLE_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
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

    {accountEditor && (
      <div className={styles.drawerBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeAccount(); }}>
        <aside className={`${styles.drawer} ${styles.crmDrawer}`} role="dialog" aria-modal="true" aria-labelledby="crm-drawer-title">
          <div className={styles.drawerHeader}>
            <div>
              <p className={styles.eyebrow}>{accountEditor.id ? 'Oportunidad comercial' : 'Nueva oportunidad'}</p>
              <h2 id="crm-drawer-title">{accountEditor.id ? accountEditor.name : 'Registrar prospecto'}</h2>
              <span>Sin alta de tenant ni cobro automático</span>
            </div>
            <button type="button" onClick={closeAccount} aria-label="Cerrar oportunidad"><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
          </div>

          <form onSubmit={saveAccount} className={`${styles.tenantForm} ${styles.crmForm}`}>
            <label className={styles.fullField}><span>Organización</span><input ref={accountNameRef} value={accountEditor.name} onChange={(event) => setAccountField('name', event.target.value)} maxLength={120} required disabled={accountPending} placeholder="Ej. Constructora del Sur" /></label>
            <label><span>Contacto principal</span><input value={accountEditor.contactName} onChange={(event) => setAccountField('contactName', event.target.value)} maxLength={120} disabled={accountPending} placeholder="Nombre y apellido" /></label>
            <label><span>Email</span><input type="email" value={accountEditor.email} onChange={(event) => setAccountField('email', event.target.value)} maxLength={254} disabled={accountPending} placeholder="contacto@empresa.com" /></label>
            <label><span>Teléfono</span><input type="tel" value={accountEditor.phone} onChange={(event) => setAccountField('phone', event.target.value)} maxLength={40} disabled={accountPending} placeholder="+54 9 11…" /></label>
            <label><span>Segmento</span><select value={accountEditor.segment} onChange={(event) => setAccountField('segment', event.target.value)} disabled={accountPending}>{Object.entries(SEGMENT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label><span>Origen</span><select value={accountEditor.source} onChange={(event) => setAccountField('source', event.target.value)} disabled={accountPending}>{Object.entries(SOURCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label><span>Etapa</span><select value={accountEditor.stage} onChange={(event) => setAccountField('stage', event.target.value)} disabled={accountPending}>{Object.entries(CRM_STAGE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label><span>Usuarios estimados</span><input type="number" min="1" max="100000" value={accountEditor.estimatedSeats} onChange={(event) => setAccountField('estimatedSeats', event.target.value)} disabled={accountPending} placeholder="25" /></label>
            <label><span>Valor mensual estimado · USD</span><input type="number" min="0" max="1000000" step="0.01" value={accountEditor.estimatedMonthlyValue} onChange={(event) => setAccountField('estimatedMonthlyValue', event.target.value)} disabled={accountPending} placeholder="199" /></label>
            <label><span>Próximo seguimiento</span><input type="date" value={accountEditor.nextFollowUpAt} onChange={(event) => setAccountField('nextFollowUpAt', event.target.value)} disabled={accountPending} /></label>
            <label className={styles.fullField}><span>Notas y próximo objetivo</span><textarea value={accountEditor.notes} onChange={(event) => setAccountField('notes', event.target.value)} maxLength={5000} disabled={accountPending} rows={5} placeholder="Necesidad, decisores, alcance y compromiso de la próxima conversación." /></label>

            {accountNotice && <div className={`${styles.formNotice} ${styles[accountNotice.type]} ${styles.fullField}`} role="status">{accountNotice.text}</div>}
            <div className={`${styles.auditNote} ${styles.fullField}`}><i className="fa-solid fa-shield-halved" aria-hidden="true" /><span>Cada alta y cambio queda auditado con tu identidad. El valor es una estimación comercial, nunca un cobro.</span></div>
            <div className={`${styles.formActions} ${styles.fullField}`}><button type="button" onClick={closeAccount} disabled={accountPending}>Cerrar</button><button type="submit" disabled={accountPending}>{accountPending ? 'Guardando…' : accountEditor.id ? 'Guardar cambios' : 'Crear oportunidad'}</button></div>
          </form>
        </aside>
      </div>
    )}
    </>
  );
}
