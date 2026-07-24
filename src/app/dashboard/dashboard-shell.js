'use client';

import { useEffect, useRef, useState } from 'react';
import { OrganizationSwitcher, UserButton, useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { ObraSaasLogo } from '@/app/brand/brand-logo';
import { dashboardDestinationIsActive } from '@/lib/dashboard-navigation';

const PROJECT_STATUS_LABELS = Object.freeze({
  ACTIVE: 'Activa',
  PLANNING: 'Planificación',
  PAUSED: 'Pausada',
  COMPLETED: 'Finalizada',
});

const WORKSPACE_DESTINATIONS = Object.freeze([
  { key: 'summary', href: '/dashboard', tab: 'sec-dashboard', label: 'Hoy', icon: 'fa-solid fa-house-chimney' },
  { key: 'whatsapp', href: '/dashboard?tab=sec-whatsapp', tab: 'sec-whatsapp', label: 'Operación de campo', icon: 'fa-brands fa-whatsapp' },
  { key: 'inbox', href: '/dashboard/inbox', exact: true, label: 'Bandeja WhatsApp', icon: 'fa-solid fa-comments', permission: 'canReadInbox' },
  { key: 'gantt', href: '/dashboard?tab=sec-gantt', tab: 'sec-gantt', label: 'Cronograma', icon: 'fa-solid fa-timeline' },
  { key: 'approvals', href: '/dashboard/approvals', exact: true, label: 'Aprobaciones', icon: 'fa-solid fa-list-check', permission: 'canReadApprovals' },
  { key: 'attendance', href: '/dashboard/attendance', exact: true, label: 'Asistencia y turnos', icon: 'fa-solid fa-user-clock', permission: 'canReadAttendance' },
  { key: 'execution', href: '/dashboard/execution', exact: true, label: 'Cuadrillas y blockers', icon: 'fa-solid fa-people-group', permission: 'canReadExecution' },
  { key: 'progress', href: '/dashboard/progress', exact: true, label: 'Bitácora de avance', icon: 'fa-solid fa-camera-retro', permission: 'canReadExecution' },
  { key: 'notifications', href: '/dashboard/notifications', exact: true, label: 'Notificaciones', icon: 'fa-solid fa-bell', permission: 'canReadExecution' },
  { key: 'activity', href: '/dashboard/activity', exact: true, label: 'Bitácora', icon: 'fa-solid fa-shield-halved' },
  { key: 'people', href: '/dashboard?tab=sec-personal', tab: 'sec-personal', label: 'Personal de obra', icon: 'fa-solid fa-users-gear' },
]);

const CONTROL_DESTINATIONS = Object.freeze([
  { key: 'projects', href: '/dashboard/projects', exact: true, label: 'Obras y portfolio', icon: 'fa-solid fa-building-circle-check' },
  { key: 'report', href: '/dashboard/report', exact: true, label: 'Reporte semanal', icon: 'fa-solid fa-file-lines', permission: 'canReadReports' },
  { key: 'activation', href: '/dashboard/getting-started', exact: true, label: 'Puesta en marcha', icon: 'fa-solid fa-route' },
  { key: 'team', href: '/dashboard/team', exact: true, label: 'Equipo y roles', icon: 'fa-solid fa-user-shield', permission: 'canReadTeam' },
  { key: 'integrations', href: '/dashboard/integrations', exact: true, label: 'Integraciones', icon: 'fa-solid fa-plug-circle-bolt', permission: 'canManageIntegrations' },
]);

const EXPLORE_DESTINATIONS = Object.freeze([
  { key: 'labs', href: '/dashboard/labs', exact: true, label: 'ObraSaaS Labs', icon: 'fa-solid fa-flask' },
]);

function visibleDestinations(destinations, permissions) {
  return destinations.filter((destination) => (
    !destination.permission || permissions[destination.permission]
  ));
}

function NavigationGroup({
  destinations,
  label,
  location,
  onNavigate,
  pendingApprovalCount,
}) {
  return (
    <section className="dashboard-nav-group">
      <p className="dashboard-nav-label">{label}</p>
      <ul className="nav-menu">
        {destinations.map((destination) => {
          const active = dashboardDestinationIsActive(destination, location);
          const count = destination.key === 'approvals' ? pendingApprovalCount : 0;
          return (
            <li className={`nav-item ${active ? 'active' : ''}`} key={destination.key}>
              <Link
                aria-current={active ? 'page' : undefined}
                className="nav-button-link"
                href={destination.href}
                onClick={onNavigate}
              >
                <i className={destination.icon} aria-hidden="true" />
                <span>{destination.label}</span>
                {count > 0 && (
                  <span
                    aria-label={`${count} aprobaciones pendientes`}
                    className="nav-count-badge"
                  >
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function DashboardShell({ children, model }) {
  const { user } = useUser();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const sidebarRef = useRef(null);
  const mobileToggleRef = useRef(null);
  const mobileCloseRef = useRef(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState('dark');
  const [selectedProjectId, setSelectedProjectId] = useState(model.project.id);
  const [projectSwitchState, setProjectSwitchState] = useState('idle');
  const [projectSwitchError, setProjectSwitchError] = useState('');
  const [pendingApprovalCount, setPendingApprovalCount] = useState(
    model.pendingApprovalCount,
  );

  const location = {
    pathname,
    tab: searchParams.get('tab'),
    onboarding: searchParams.get('onboarding'),
  };
  const workspaceDestinations = visibleDestinations(
    WORKSPACE_DESTINATIONS,
    model.permissions,
  );
  const controlDestinations = visibleDestinations(
    CONTROL_DESTINATIONS,
    model.permissions,
  );
  const exploreDestinations = visibleDestinations(
    EXPLORE_DESTINATIONS,
    model.permissions,
  );
  const userLabel = user?.fullName
    || user?.primaryEmailAddress?.emailAddress
    || model.identity.email;
  const userInitial = String(userLabel || 'O').trim().charAt(0).toUpperCase();
  const routeContent = pathname !== '/dashboard';
  const projectStatusTone = projectSwitchState === 'switching'
    ? 'switching'
    : model.whatsappConnected ? 'connected' : 'pending';

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const storedTheme = window.localStorage.getItem('obrasaas_theme');
      const nextTheme = storedTheme === 'light' ? 'light' : 'dark';
      setTheme(nextTheme);
      document.body.classList.toggle('light-theme', nextTheme === 'light');
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMobileOpen(false));
    return () => window.cancelAnimationFrame(frame);
  }, [pathname, searchKey]);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    mobileCloseRef.current?.focus();
    const handleMobileKeyboard = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setMobileOpen(false);
        window.requestAnimationFrame(() => mobileToggleRef.current?.focus());
        return;
      }
      if (event.key !== 'Tab' || !sidebarRef.current) return;

      const focusable = Array.from(sidebarRef.current.querySelectorAll(
        'a[href], button:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )).filter((element) => element.getClientRects().length > 0);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleMobileKeyboard, true);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleMobileKeyboard, true);
    };
  }, [mobileOpen]);

  useEffect(() => {
    const updatePendingCount = (event) => {
      if (event.detail?.projectId !== model.project.id) return;
      const nextCount = Number(event.detail?.count);
      if (Number.isSafeInteger(nextCount) && nextCount >= 0) {
        setPendingApprovalCount(nextCount);
      }
    };
    window.addEventListener('obrasaas:pending-approval-count', updatePendingCount);
    return () => {
      window.removeEventListener('obrasaas:pending-approval-count', updatePendingCount);
    };
  }, [model.project.id]);

  function toggleTheme() {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    document.body.classList.toggle('light-theme', nextTheme === 'light');
    window.localStorage.setItem('obrasaas_theme', nextTheme);
    window.dispatchEvent(new CustomEvent('obrasaas:theme-change', {
      detail: { theme: nextTheme },
    }));
  }

  async function switchProject(event) {
    const projectId = event.target.value;
    setSelectedProjectId(projectId);
    setProjectSwitchError('');
    if (projectId === model.project.id) return;
    setProjectSwitchState('switching');
    try {
      const response = await fetch('/api/projects', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'No pudimos cambiar de obra.');
      }
      setProjectSwitchState('idle');
      router.refresh();
    } catch (error) {
      setSelectedProjectId(model.project.id);
      setProjectSwitchState('idle');
      setProjectSwitchError(error.message || 'No pudimos cambiar de obra.');
    }
  }

  return (
    <div className="app-container dashboard-shell">
      <a className="dashboard-skip-link" href="#dashboard-content">Saltar al contenido</a>
      <aside
        aria-label="Navegación principal de ObraSaaS"
        className={`sidebar dashboard-shell-sidebar ${mobileOpen ? 'active' : ''}`}
        id="dashboard-sidebar"
        ref={sidebarRef}
      >
        <div className="brand dashboard-shell-brand">
          <Link aria-label="Ir al resumen de ObraSaaS" href="/dashboard" onClick={() => setMobileOpen(false)}>
            <ObraSaasLogo
              className="dashboard-brand-lockup"
              markClassName="brand-logo"
              markSize={38}
              wordmarkClassName="brand-name"
            />
          </Link>
          <button
            aria-label="Cerrar navegación"
            className="dashboard-sidebar-close"
            onClick={() => {
              setMobileOpen(false);
              window.requestAnimationFrame(() => mobileToggleRef.current?.focus());
            }}
            ref={mobileCloseRef}
            type="button"
          >
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>

        {model.identity.isSuperadmin ? (
          <div className="internal-workspace" aria-label="Workspace interno de plataforma">
            <span className="internal-workspace__eyebrow">Control plane</span>
            <span className="internal-workspace__name">ObraSaaS Operaciones</span>
            <span className="internal-workspace__status">
              <i className="fa-solid fa-shield-halved" aria-hidden="true" />
              Workspace interno
            </span>
          </div>
        ) : (
          <div className="dashboard-organization-switcher">
            <OrganizationSwitcher
              afterCreateOrganizationUrl="/dashboard"
              afterSelectOrganizationUrl="/dashboard"
              appearance={{
                elements: {
                  rootBox: { width: '100%' },
                  organizationSwitcherTrigger: {
                    width: '100%',
                    justifyContent: 'space-between',
                    border: '1px solid var(--border-color)',
                    background: 'rgba(255,255,255,0.03)',
                    color: 'var(--text-primary)',
                  },
                },
              }}
              hidePersonal
            />
          </div>
        )}

        <section className="dashboard-project-context" aria-labelledby="active-project-label">
          <div>
            <span id="active-project-label">Obra activa</span>
            <small>{model.organization.planLabel}</small>
          </div>
          <label>
            <span className="sr-only">Cambiar obra activa</span>
            <select
              aria-describedby={projectSwitchError ? 'project-switch-error' : undefined}
              disabled={projectSwitchState === 'switching'}
              onChange={switchProject}
              value={selectedProjectId}
            >
              {model.projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name} · {PROJECT_STATUS_LABELS[project.status] || project.status}
                </option>
              ))}
            </select>
          </label>
          <p
            aria-live="polite"
            className={`dashboard-project-status is-${projectStatusTone}`}
            role="status"
          >
            <i aria-hidden="true" />
            {projectSwitchState === 'switching'
              ? 'Cambiando contexto…'
              : model.whatsappConnected ? 'WhatsApp conectado' : 'Canal pendiente'}
          </p>
          {model.hasMoreProjects && (
            <Link href="/dashboard/projects" onClick={() => setMobileOpen(false)}>
              Ver portfolio completo
            </Link>
          )}
          <span className="dashboard-project-error" id="project-switch-error" role="status">
            {projectSwitchError}
          </span>
        </section>

        <nav className="dashboard-shell-nav">
          <NavigationGroup
            destinations={workspaceDestinations}
            label="Obra"
            location={location}
            onNavigate={() => setMobileOpen(false)}
            pendingApprovalCount={pendingApprovalCount}
          />
          <NavigationGroup
            destinations={controlDestinations}
            label="Gestión"
            location={location}
            onNavigate={() => setMobileOpen(false)}
            pendingApprovalCount={pendingApprovalCount}
          />
          <NavigationGroup
            destinations={exploreDestinations}
            label="Explorar"
            location={location}
            onNavigate={() => setMobileOpen(false)}
            pendingApprovalCount={0}
          />
          {model.identity.isSuperadmin && (
            <NavigationGroup
              destinations={[{
                key: 'superadmin',
                href: '/superadmin',
                exact: true,
                label: 'Consola SuperAdmin',
                icon: 'fa-solid fa-building-user',
              }]}
              label="Plataforma"
              location={location}
              onNavigate={() => setMobileOpen(false)}
              pendingApprovalCount={0}
            />
          )}
        </nav>

        <div className="dashboard-shell-utility">
          <button onClick={toggleTheme} type="button">
            <i className={theme === 'light' ? 'fa-solid fa-sun' : 'fa-solid fa-moon'} aria-hidden="true" />
            <span>Tema {theme === 'light' ? 'claro' : 'oscuro'}</span>
          </button>
          {/* A full reload clears the dashboard-only global stylesheet before landing. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/">
            <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" />
            <span>Sitio público</span>
          </a>
        </div>

        <div className="sidebar-footer dashboard-shell-footer">
          <span className="dashboard-user-initial" aria-hidden="true">{userInitial}</span>
          <div>
            <strong>{userLabel}</strong>
            <small>{model.organization.name} · {model.identity.tenantRoleLabel}</small>
          </div>
          <UserButton afterSignOutUrl="/" />
        </div>
      </aside>

      {mobileOpen && (
        <button
          aria-label="Cerrar navegación"
          className="sidebar-overlay active"
          onClick={() => {
            setMobileOpen(false);
            window.requestAnimationFrame(() => mobileToggleRef.current?.focus());
          }}
          tabIndex={-1}
          type="button"
        />
      )}

      <header
        aria-hidden={mobileOpen ? true : undefined}
        className="mobile-header dashboard-shell-mobile-header"
        inert={mobileOpen || undefined}
      >
        <button
          aria-controls="dashboard-sidebar"
          aria-expanded={mobileOpen}
          aria-label="Abrir navegación"
          className="mobile-toggle-btn"
          onClick={() => setMobileOpen(true)}
          ref={mobileToggleRef}
          type="button"
        >
          <i className="fa-solid fa-bars" aria-hidden="true" />
        </button>
        <div className="dashboard-mobile-context">
          <small>{model.organization.name}</small>
          <strong>{model.project.name}</strong>
        </div>
        <UserButton afterSignOutUrl="/" />
      </header>

      <div
        aria-hidden={mobileOpen ? true : undefined}
        className={`main-content ${routeContent ? 'dashboard-route-content' : 'dashboard-home-content'}`}
        id="dashboard-content"
        inert={mobileOpen || undefined}
        role="main"
        tabIndex="-1"
      >
        {children}
      </div>
    </div>
  );
}
