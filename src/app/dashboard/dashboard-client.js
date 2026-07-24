"use client";
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ObraSaasMark } from '@/app/brand/brand-logo';
import { resolveDashboardTab } from '@/lib/dashboard-navigation';
import { WHATSAPP_DEMO_AUDIO_TRANSCRIPTS } from '@/lib/whatsapp/demo-audio';
import {
  FIRST_VALUE_APPROVAL_SIMULATOR_SCENARIO,
  nextPendingOperationalProposalCount,
  pendingOperationalProposalCountFromPayload,
} from '@/lib/first-value-onboarding';
import GanttPlanner from './gantt-planner';
import OperationalPulse from './operational-pulse';
import PlatformReadiness from './platform-readiness';
import StockpilePanel from './stockpile-panel';

const initialAppState = {
  operariosCount: 0,
  avancePercentage: 0,
  alertsCount: 0,
  diasEstimados: 'Sin plazo',
  tasks: {},
  incidents: [],
  attendance: {},
  stockpiles: {},
  hrAttendance: {},
  hrBonuses: [],
};

const LEGACY_DEMO_IDENTITIES = new Set([
  'juan gómez',
  'carlos pérez',
  'luis martínez',
]);

const LEGACY_DEMO_MATERIALS = new Set([
  'cemento loma negra',
  'hierro a500 acindar',
  'ladrillo portante alberdi',
  'arena fina cantera',
]);

function isObjectRecord(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isLegacyDemoIdentity(value) {
  return LEGACY_DEMO_IDENTITIES.has(String(value || '').trim().toLocaleLowerCase('es-AR'));
}

function isLegacyDemoSnapshot(candidate) {
  if (!isObjectRecord(candidate) || String(candidate.diasEstimados || '').trim() !== 'Día 12/35') {
    return false;
  }
  const identities = new Set([
    ...Object.keys(isObjectRecord(candidate.attendance) ? candidate.attendance : {}),
    ...Object.keys(isObjectRecord(candidate.hrAttendance) ? candidate.hrAttendance : {}),
    ...Object.values(isObjectRecord(candidate.tasks) ? candidate.tasks : {})
      .map((task) => (isObjectRecord(task) ? task.assignee : null)),
  ].map((value) => String(value || '').trim().toLocaleLowerCase('es-AR')));
  return [...LEGACY_DEMO_IDENTITIES].every((identity) => identities.has(identity));
}

function normalizeAppState(candidate) {
  if (!isObjectRecord(candidate)) return { ...initialAppState };
  const stripLegacyDemo = isLegacyDemoSnapshot(candidate);

  const tasks = Object.fromEntries(
    Object.entries(isObjectRecord(candidate.tasks) ? candidate.tasks : {})
      .filter(([, task]) => (
        isObjectRecord(task)
        && (!stripLegacyDemo || !isLegacyDemoIdentity(task.assignee))
      )),
  );
  const attendance = Object.fromEntries(
    Object.entries(isObjectRecord(candidate.attendance) ? candidate.attendance : {})
      .filter(([key, entry]) => (
        isObjectRecord(entry)
        && (!stripLegacyDemo || (!isLegacyDemoIdentity(key) && !isLegacyDemoIdentity(entry.name)))
      )),
  );
  const hrAttendance = Object.fromEntries(
    Object.entries(isObjectRecord(candidate.hrAttendance) ? candidate.hrAttendance : {})
      .filter(([key, entry]) => (
        isObjectRecord(entry)
        && (!stripLegacyDemo || (!isLegacyDemoIdentity(key) && !isLegacyDemoIdentity(entry.name)))
      )),
  );
  const stockpiles = Object.fromEntries(
    Object.entries(isObjectRecord(candidate.stockpiles) ? candidate.stockpiles : {})
      .filter(([, item]) => (
        isObjectRecord(item)
        && (
          !stripLegacyDemo
          || (
            !LEGACY_DEMO_MATERIALS.has(String(item.name || '').trim().toLocaleLowerCase('es-AR'))
            && !String(item.supplier || '').toLocaleLowerCase('es-AR').includes('palermo')
          )
        )
      )),
  );
  const incidents = (Array.isArray(candidate.incidents) ? candidate.incidents : [])
    .filter((incident) => isObjectRecord(incident))
    .filter((incident) => (
      !stripLegacyDemo
      || ![
        incident.title,
        incident.description,
        incident.reporter,
      ].some((value) => {
        const copy = String(value || '').toLocaleLowerCase('es-AR');
        return copy.includes('juan gómez')
          || copy.includes('carlos pérez')
          || copy.includes('luis martínez');
      })
    ));
  const hrBonuses = (Array.isArray(candidate.hrBonuses) ? candidate.hrBonuses : [])
    .filter((bonus) => (
      isObjectRecord(bonus)
      && (!stripLegacyDemo || !isLegacyDemoIdentity(bonus.name))
    ));
  const taskValues = Object.values(tasks);
  const attendanceValues = Object.values(attendance);
  const presentWorkers = attendanceValues.filter((entry) => attendanceStatus(entry).startsWith('Presente')).length;
  const alertCount = incidents.filter((incident) => ['warning', 'critical'].includes(incident.type)).length;
  const progress = taskValues.length > 0
    ? Math.round(taskValues.reduce((sum, task) => sum + Math.max(0, Math.min(100, Number(task.progress) || 0)), 0) / taskValues.length)
    : 0;

  return {
    ...candidate,
    operariosCount: presentWorkers,
    avancePercentage: progress,
    alertsCount: alertCount,
    diasEstimados: stripLegacyDemo
      ? initialAppState.diasEstimados
      : String(candidate.diasEstimados || initialAppState.diasEstimados),
    tasks,
    incidents,
    attendance,
    stockpiles,
    hrAttendance,
    hrBonuses,
  };
}

function canonicalTasksToGanttCatalog(tasks, projectStartsAt) {
  if (!Array.isArray(tasks) || tasks.length === 0) return null;
  const projectStart = projectStartsAt ? new Date(projectStartsAt).getTime() : NaN;
  const catalog = {};
  for (const task of tasks) {
    const start = task.startsAt ? new Date(task.startsAt).getTime() : NaN;
    const end = task.endsAt ? new Date(task.endsAt).getTime() : NaN;
    const startOffset = Number.isFinite(start) && Number.isFinite(projectStart)
      ? Math.max(0, Math.round((start - projectStart) / 86_400_000))
      : 0;
    const duration = Number.isFinite(start) && Number.isFinite(end)
      ? Math.max(1, Math.round((end - start) / 86_400_000) + 1)
      : 1;
    catalog[task.id] = {
      name: task.title,
      description: task.description || '',
      assignee: task.assignee || '',
      progress: task.progress,
      duration,
      startOffset,
      startDay: startOffset + 1,
      dependencies: (task.dependencies || [])
        .filter((dependency) => dependency.successorId === task.id)
        .map((dependency) => dependency.predecessorId),
      status: task.status,
      canonicalTaskId: task.id,
      revision: task.revision,
    };
  }
  return catalog;
}

const initialChatMessages = [
  {
      sender: "bot",
      text: "Hola. Soy tu Copiloto de ObraSaaS. Puedo analizar el último estado registrado de la cuadrilla y la obra. Escribí una consulta o probá un audio demostrativo.",
      time: "08:00 AM"
  }
];

function createClientEntityId(prefix) {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`;
  const bytes = new Uint32Array(4);
  globalThis.crypto.getRandomValues(bytes);
  return `${prefix}-${Array.from(bytes, (value) => value.toString(16).padStart(8, '0')).join('')}`;
}

function attendanceRecords(attendance) {
  if (!attendance || typeof attendance !== 'object' || Array.isArray(attendance)) return [];
  return Object.entries(attendance).map(([key, value]) => {
    const entry = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const name = typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim() : key;
    return { key, name, entry };
  });
}

function attendanceRecordByName(attendance, name) {
  return attendanceRecords(attendance).find((record) => (
    record.name === name || record.key === name
  )) || null;
}

function attendanceStatus(entry) {
  return typeof entry?.status === 'string' && entry.status.trim()
    ? entry.status.trim()
    : 'Sin registro';
}

function validProjectStateVersion(value) {
  const version = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^\d+$/.test(value.trim())
      ? Number(value.trim())
      : Number.NaN;
  return Number.isSafeInteger(version) && version >= 0 && version <= 2_147_483_647
    ? version
    : null;
}

function projectStateEtag(version) {
  return `"project-state-${validProjectStateVersion(version) ?? 0}"`;
}

function decodeProjectStateResponse(response, payload, fallbackVersion = 0) {
  const explicitHeaderVersion = validProjectStateVersion(
    response.headers.get('x-project-state-version'),
  );
  const etagMatch = response.headers.get('etag')?.match(/^"project-state-(\d+)"$/);
  const etagVersion = validProjectStateVersion(etagMatch?.[1]);
  const envelopeVersion = isObjectRecord(payload)
    && isObjectRecord(payload.state)
    ? validProjectStateVersion(payload.version)
    : null;
  const headerVersion = explicitHeaderVersion ?? etagVersion;
  if (headerVersion != null && envelopeVersion != null && headerVersion !== envelopeVersion) {
    throw new Error('La API devolvió versiones de estado inconsistentes.');
  }
  return {
    state: envelopeVersion == null ? payload : payload.state,
    version: headerVersion ?? envelopeVersion ?? validProjectStateVersion(fallbackVersion) ?? 0,
  };
}

export default function Dashboard({ platformAccess, initialState, initialMessages, setup }) {
  const searchParams = useSearchParams();
  const activeTab = resolveDashboardTab({
    tab: searchParams.get('tab'),
    onboarding: searchParams.get('onboarding'),
  });
  const approvalOnboardingRequested = searchParams.get('onboarding') === 'approval';
  // Application State
  const [state, setState] = useState(() => normalizeAppState(initialState));
  const [canonicalTasks, setCanonicalTasks] = useState(
    () => (Array.isArray(setup.canonicalTasks) ? setup.canonicalTasks : []),
  );
  const canonicalTaskCatalog = useMemo(
    () => canonicalTasksToGanttCatalog(canonicalTasks, platformAccess.project.startsAt),
    [canonicalTasks, platformAccess.project.startsAt],
  );
  const handleCanonicalTaskChange = useCallback((task) => {
    setCanonicalTasks((current) => {
      const next = current.filter((candidate) => candidate.id !== task.id);
      return [...next, task].sort((left, right) => String(left.id).localeCompare(String(right.id)));
    });
  }, []);
  const handleCanonicalTaskDelete = useCallback((taskId) => {
    setCanonicalTasks((current) => current.filter((candidate) => candidate.id !== taskId));
  }, []);
  const stateVersionRef = useRef(validProjectStateVersion(setup.initialStateVersion) ?? 0);
  const stateWriteQueueRef = useRef(Promise.resolve());
  const stateWriteGenerationRef = useRef(0);
  const latestStateWriteSequenceRef = useRef(0);
  const pendingStateWritesRef = useRef(0);
  const [chatMessages, setChatMessages] = useState(Array.isArray(initialMessages) ? initialMessages : initialChatMessages);
  const [syncState, setSyncState] = useState('live');
  const [lastSyncedAt, setLastSyncedAt] = useState(setup.initialLoadedAt);
  const [approvalOnboardingMode, setApprovalOnboardingMode] = useState(false);
  const [pendingOperationalProposalCount, setPendingOperationalProposalCount] = useState(
    () => Math.max(0, Number(setup.pendingOperationalProposalCount) || 0),
  );
  const [latestOperationalProposal, setLatestOperationalProposal] = useState(null);
  const [isLightTheme, setIsLightTheme] = useState(false);
  const [mapMode, setMapMode] = useState('sat');

  // Personal HR forms
  const [hrBonusAssignee, setHrBonusAssignee] = useState('');
  const [hrBonusType, setHrBonusType] = useState('Bono de Puntualidad');
  const [hrMedAssignee, setHrMedAssignee] = useState('');
  const [hrMedDays, setHrMedDays] = useState('1 día');

  // Simulated messaging / chats inputs
  const [chatInput, setChatInput] = useState('');
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [gpsModalOpen, setGpsModalOpen] = useState(false);
  const [gpsLabel, setGpsLabel] = useState('Elegí cómo obtener un punto de ubicación');
  const [gpsRequestPending, setGpsRequestPending] = useState(false);
  const [selectedFieldWorkerId, setSelectedFieldWorkerId] = useState('');
  const [fieldSimulationPending, setFieldSimulationPending] = useState(false);

  // AI Supervisors Inputs & histories
  const [copilotInput, setCopilotInput] = useState('');
  const [copilotMessages, setCopilotMessages] = useState([
    {
      sender: "bot",
      text: "Puedo analizar el avance, la asistencia, los materiales y las alertas registradas en esta obra. Las acciones siempre quedan sujetas a aprobación humana.",
      confidence: null,
      evidence: [],
      limitations: [],
      actions: [],
    }
  ]);
  const [copilotStatus, setCopilotStatus] = useState('idle');

  // Audio Playback Waveforms Animation State
  const [playingAudioIndex, setPlayingAudioIndex] = useState(null);

  // Live Toast Notifications State
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);

  const addToast = (message, type = 'info') => {
    toastIdRef.current += 1;
    const id = toastIdRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  // DOM Canvas and Map Container Refs
  const progressChartRef = useRef(null);
  const tasksChartRef = useRef(null);
  const mapContainerRef = useRef(null);
  const chatMessagesEndRef = useRef(null);
  const copilotMessagesEndRef = useRef(null);
  const gpsDialogRef = useRef(null);
  const gpsReturnFocusRef = useRef(null);
  const fieldSimulationOperationRef = useRef(null);
  const knownOperationalProposalIdsRef = useRef(new Set());
  const pendingProposalLocalGenerationRef = useRef(0);

  const waveformRef1 = useRef(null);
  const waveformRef2 = useRef(null);
  const waveformRef3 = useRef(null);
  const waveformRef4 = useRef(null);
  const waveformRefs = useMemo(
    () => ({ 1: waveformRef1, 2: waveformRef2, 3: waveformRef3, 4: waveformRef4 }),
    [],
  );

  // Refresh tenant-scoped operational data while the app is visible.
  useEffect(() => {
    const initializationFrame = requestAnimationFrame(() => {
      const savedTheme = localStorage.getItem('obrasaas_theme');
      const lightTheme = savedTheme === 'light';
      setIsLightTheme(lightTheme);
      document.body.classList.toggle('light-theme', lightTheme);

    });

    const handleThemeChange = (event) => {
      setIsLightTheme(event.detail?.theme === 'light');
    };
    window.addEventListener('obrasaas:theme-change', handleThemeChange);

    let active = true;
    let refreshing = false;
    const refreshOperationalData = async () => {
      if (refreshing || document.visibilityState === 'hidden') return;
      refreshing = true;
      setSyncState('syncing');
      try {
        const [stateRes, messagesRes] = await Promise.all([
          fetch('/api/state', { cache: 'no-store' }),
          fetch('/api/whatsapp', { cache: 'no-store' }),
        ]);
        if (!stateRes.ok || !messagesRes.ok) throw new Error('Operational refresh failed.');
        const [stateData, messagesData] = await Promise.all([
          stateRes.json(),
          messagesRes.json(),
        ]);
        if (!active) return;
        const snapshot = decodeProjectStateResponse(
          stateRes,
          stateData,
          stateVersionRef.current,
        );
        if (
          pendingStateWritesRef.current === 0
          && snapshot.version >= stateVersionRef.current
        ) {
          stateVersionRef.current = snapshot.version;
          setState(normalizeAppState(snapshot.state));
        }
        setChatMessages(Array.isArray(messagesData) ? messagesData : []);
        setLastSyncedAt(new Date().toISOString());
        setSyncState('live');
      } catch (err) {
        if (active) setSyncState('error');
        console.warn('Operational refresh failed:', err);
      } finally {
        refreshing = false;
      }
    };
    const interval = setInterval(refreshOperationalData, 10_000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void refreshOperationalData();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      active = false;
      cancelAnimationFrame(initializationFrame);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('obrasaas:theme-change', handleThemeChange);
    };
  }, [setup.pendingOperationalProposalCount]);

  useEffect(() => {
    if (!approvalOnboardingRequested) {
      setApprovalOnboardingMode(false);
      return;
    }
    setApprovalOnboardingMode(
      Math.max(0, Number(setup.pendingOperationalProposalCount) || 0) === 0,
    );
  }, [approvalOnboardingRequested, setup.pendingOperationalProposalCount]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('obrasaas:pending-approval-count', {
      detail: {
        projectId: platformAccess.project.id,
        count: pendingOperationalProposalCount,
      },
    }));
  }, [pendingOperationalProposalCount, platformAccess.project.id]);

  useEffect(() => {
    if (!setup.canReadOperationalProposals) return undefined;
    let active = true;
    let refreshing = false;

    const refreshPendingCount = async () => {
      if (refreshing || document.visibilityState === 'hidden') return;
      refreshing = true;
      const localGeneration = pendingProposalLocalGenerationRef.current;
      try {
        const response = await fetch(
          '/api/operational-proposals?summary=pending-count',
          {
            cache: 'no-store',
            headers: { Accept: 'application/json' },
          },
        );
        if (!response.ok) throw new Error('Pending proposal count refresh failed.');
        const payload = await response.json();
        const nextCount = pendingOperationalProposalCountFromPayload(
          payload,
          platformAccess.project.id,
        );
        if (nextCount === null) {
          throw new Error('Pending proposal count response was invalid.');
        }
        if (
          active
          && localGeneration === pendingProposalLocalGenerationRef.current
        ) {
          setPendingOperationalProposalCount(nextCount);
          setLatestOperationalProposal(null);
        }
      } catch (error) {
        console.warn('Pending proposal count refresh failed:', error);
      } finally {
        refreshing = false;
      }
    };

    const frame = window.requestAnimationFrame(() => void refreshPendingCount());
    const interval = window.setInterval(() => void refreshPendingCount(), 30_000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void refreshPendingCount();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      active = false;
      window.cancelAnimationFrame(frame);
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [
    platformAccess.project.id,
    setup.canReadOperationalProposals,
  ]);

  // Sync scroll to bottoms on updates
  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    copilotMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [copilotMessages]);

  const reloadLatestProjectState = async () => {
    const response = await fetch('/api/state', { cache: 'no-store' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || 'No se pudo recargar el estado vigente de la obra.');
    }
    const snapshot = decodeProjectStateResponse(
      response,
      payload,
      stateVersionRef.current,
    );
    stateVersionRef.current = snapshot.version;
    setState(normalizeAppState(snapshot.state));
    setLastSyncedAt(new Date().toISOString());
    setSyncState('live');
    return snapshot;
  };

  // Serialize local writes so rapid controls use the version returned by the prior save.
  const saveStateToApi = (updatedState) => {
    const queuedState = JSON.parse(JSON.stringify(updatedState));
    const generation = stateWriteGenerationRef.current;
    const sequence = latestStateWriteSequenceRef.current + 1;
    latestStateWriteSequenceRef.current = sequence;
    pendingStateWritesRef.current += 1;
    setSyncState('syncing');

    const performWrite = async () => {
      let saved = false;
      try {
        if (generation !== stateWriteGenerationRef.current) return false;
        const expectedVersion = stateVersionRef.current;
        const response = await fetch('/api/state', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'If-Match': projectStateEtag(expectedVersion),
          },
          body: JSON.stringify({ state: queuedState, expectedVersion }),
        });
        const payload = await response.json().catch(() => ({}));
        if (response.status === 409 && payload.code === 'STATE_VERSION_CONFLICT') {
          if (generation === stateWriteGenerationRef.current) {
            stateWriteGenerationRef.current += 1;
          }
          await reloadLatestProjectState();
          addToast(
            'Otra persona actualizó la obra antes que vos. Recargamos sus cambios y descartamos la edición desactualizada para no sobrescribirla.',
            'warning',
          );
          return false;
        }
        if (!response.ok) {
          throw new Error(payload.error || 'No se pudo guardar el cambio operativo.');
        }

        const snapshot = decodeProjectStateResponse(
          response,
          payload,
          expectedVersion + 1,
        );
        stateVersionRef.current = snapshot.version;
        if (sequence === latestStateWriteSequenceRef.current) {
          setState(normalizeAppState(snapshot.state));
        }
        setLastSyncedAt(new Date().toISOString());
        saved = true;
        return true;
      } catch (error) {
        if (generation === stateWriteGenerationRef.current) {
          stateWriteGenerationRef.current += 1;
        }
        console.error('Error saving state to DB:', error);
        setSyncState('error');
        addToast(error.message || 'No se pudo guardar el cambio operativo.', 'error');
        return false;
      } finally {
        pendingStateWritesRef.current = Math.max(0, pendingStateWritesRef.current - 1);
        if (saved && pendingStateWritesRef.current === 0) setSyncState('live');
      }
    };

    const queuedWrite = stateWriteQueueRef.current.then(performWrite, performWrite);
    stateWriteQueueRef.current = queuedWrite.catch(() => false);
    return queuedWrite;
  };

  const fieldWorkers = useMemo(
    () => (Array.isArray(setup.fieldWorkers) ? setup.fieldWorkers : []),
    [setup.fieldWorkers],
  );
  const selectedFieldWorker = fieldWorkers.find((worker) => worker.id === selectedFieldWorkerId) || null;
  const taskEntries = Object.entries(state.tasks);
  const hrAttendanceEntries = Object.entries(state.hrAttendance);
  const isLegacyInternalProject = platformAccess.isSuperadmin
    && platformAccess.organization.name === 'ObraSaaS Operaciones'
    && String(platformAccess.project.name || '').trim().toLocaleLowerCase('es-AR') === 'obra palermo';
  const displayProjectName = isLegacyInternalProject
    ? 'Proyecto sin configurar'
    : platformAccess.project.name || 'Proyecto sin configurar';
  const displayProjectAddress = isLegacyInternalProject
    ? ''
    : platformAccess.project.address || '';
  const setupNeedsAttention = setup.isEmptyState
    || !setup.whatsappConnected
    || setup.membershipCount <= 1;
  const attendanceInsight = useMemo(() => {
    const measured = hrAttendanceEntries
      .map(([key, item]) => ({
        name: item?.name || key,
        role: item?.role || 'Cuadrilla de obra',
        presents: Number(item?.presents),
      }))
      .filter((item) => Number.isFinite(item.presents) && item.presents > 0)
      .sort((left, right) => right.presents - left.presents || left.name.localeCompare(right.name, 'es'));
    if (measured.length === 0) return null;
    const leader = measured[0];
    const tied = measured.filter((item) => item.presents === leader.presents);
    return tied.length === 1 ? leader : null;
  }, [hrAttendanceEntries]);
  const fieldSimulatorReady = Boolean(setup.canManageField && selectedFieldWorker);
  const fieldSimulatorBusy = fieldSimulationPending || gpsRequestPending || playingAudioIndex !== null;
  const projectLatitude = Number(platformAccess.project.latitude);
  const projectLongitude = Number(platformAccess.project.longitude);
  const projectPointAvailable = platformAccess.project.latitude != null
    && platformAccess.project.longitude != null
    && Number.isFinite(projectLatitude)
    && Number.isFinite(projectLongitude);

  useEffect(() => {
    const activeIds = new Set(fieldWorkers.map((worker) => worker.id));
    if (hrBonusAssignee && !activeIds.has(hrBonusAssignee)) setHrBonusAssignee('');
    if (hrMedAssignee && !activeIds.has(hrMedAssignee)) setHrMedAssignee('');
  }, [fieldWorkers, hrBonusAssignee, hrMedAssignee]);

  useEffect(() => {
    if (
      approvalOnboardingMode
      && setup.canManageField
      && fieldWorkers.length === 1
      && !selectedFieldWorkerId
    ) {
      setSelectedFieldWorkerId(fieldWorkers[0].id);
    }
  }, [
    approvalOnboardingMode,
    fieldWorkers,
    selectedFieldWorkerId,
    setup.canManageField,
  ]);

  const registerPendingOperationalProposal = (proposal) => {
    if (!proposal || String(proposal.status || '').toUpperCase() !== 'PENDING') return;
    const proposalId = String(proposal.id || proposal.confirmationCode || '').trim();
    const alreadyKnown = proposalId
      ? knownOperationalProposalIdsRef.current.has(proposalId)
      : false;
    if (proposalId) knownOperationalProposalIdsRef.current.add(proposalId);
    if (!alreadyKnown) pendingProposalLocalGenerationRef.current += 1;
    setPendingOperationalProposalCount((current) => (
      nextPendingOperationalProposalCount(current, proposal, { alreadyKnown })
    ));
    setLatestOperationalProposal(proposal);
    setApprovalOnboardingMode(false);
  };

  const postFieldSimulation = async (payload) => {
    if (!setup.canManageField) {
      throw new Error('Tu rol no puede ejecutar comandos de campo.');
    }
    if (!selectedFieldWorker) {
      throw new Error(fieldWorkers.length === 0
        ? 'Primero autorizá una persona de la cuadrilla en Equipo y permisos.'
        : 'Elegí qué persona autorizada representa este evento de prueba.');
    }
    const requestBody = { ...payload, workerId: selectedFieldWorker.id };
    const requestSignature = JSON.stringify(requestBody);
    if (fieldSimulationOperationRef.current?.signature !== requestSignature) {
      fieldSimulationOperationRef.current = {
        signature: requestSignature,
        idempotencyKey: createClientEntityId('field-simulator'),
      };
    }
    const idempotencyKey = fieldSimulationOperationRef.current.idempotencyKey;
    setFieldSimulationPending(true);
    try {
      const send = () => fetch('/api/whatsapp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(requestBody),
      });
      let response;
      try {
        response = await send();
        if (response.status >= 500) response = await send();
      } catch {
        response = await send();
      }
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status < 500) fieldSimulationOperationRef.current = null;
        throw new Error(result.error || 'No se pudo procesar el evento de campo.');
      }
      fieldSimulationOperationRef.current = null;
      registerPendingOperationalProposal(result.operationalProposal);
      return result;
    } finally {
      setFieldSimulationPending(false);
    }
  };

  const refreshFieldSimulationViews = async () => {
    const [stateRefresh, messageRefresh] = await Promise.allSettled([
      reloadLatestProjectState(),
      (async () => {
        const response = await fetch('/api/whatsapp', { cache: 'no-store' });
        if (!response.ok) throw new Error('No se pudo recargar la conversación.');
        const messages = await response.json();
        setChatMessages(Array.isArray(messages) ? messages : []);
      })(),
    ]);
    const failures = [stateRefresh, messageRefresh].filter(
      (result) => result.status === 'rejected',
    );
    if (failures.length === 0) return true;
    if (stateRefresh.status === 'rejected') setSyncState('error');
    console.warn(
      'Field simulation committed, but its follow-up refresh was incomplete:',
      failures.map((failure) => failure.reason),
    );
    addToast(
      'El evento ya fue aplicado. No pudimos refrescar toda la vista; recargá el panel sin reenviar la acción.',
      'warning',
    );
    return false;
  };

  // Helper Beep Node generator (Web Audio API)
  const playBeep = (type, callback) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) {
        if (callback) callback();
        return;
      }
      const audioCtx = new AudioCtx();
      const osc = audioCtx.createOscillator();
      const filter = audioCtx.createBiquadFilter();
      const gainNode = audioCtx.createGain();

      osc.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      if (type === 'start') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(500, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(700, audioCtx.currentTime + 0.12);
        filter.type = 'bandpass';
        filter.frequency.value = 1000;
        gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.16);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.16);
        setTimeout(callback, 150);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        osc.frequency.setValueAtTime(440, audioCtx.currentTime + 0.08);
        gainNode.gain.setValueAtTime(0.04, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.18);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.18);
        if (callback) setTimeout(callback, 180);
      }
    } catch (e) {
      if (callback) callback();
    }
  };

  // Voice Synthesis helper in Spanish
  const speakTextSpanish = (text, callback) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'es-AR';
      const voices = window.speechSynthesis.getVoices();
      const esVoice = voices.find(v => v.lang.startsWith('es-AR') || v.lang.startsWith('es-ES') || v.lang.startsWith('es'));
      if (esVoice) utterance.voice = esVoice;
      utterance.rate = 0.92;
      utterance.pitch = 0.95;
      utterance.onend = () => { if (callback) callback(); };
      utterance.onerror = () => { if (callback) callback(); };
      window.speechSynthesis.speak(utterance);
    } else {
      if (callback) setTimeout(callback, 3000);
    }
  };

  // Draw Static Waveforms on canvases
  useEffect(() => {
    [1, 2, 3, 4].forEach(idx => {
      const canvas = waveformRefs[idx]?.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#475569';
        const barWidth = 3;
        const gap = 2;
        for (let i = 0; i < 40; i++) {
          const x = i * (barWidth + gap) + 10;
          const h = 8 + (Math.sin((i + idx) * 1.7) + 1) * 8;
          const y = (canvas.height - h) / 2;
          ctx.fillRect(x, y, barWidth, h);
        }
      }
    });
  }, [activeTab, waveformRefs]);

  // Audio Playback waveform animation
  useEffect(() => {
    if (playingAudioIndex === null) return;
    const canvas = waveformRefs[playingAudioIndex]?.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationId;
    let progress = 0;
    const heights = Array.from({ length: 40 }, (_, index) => 8 + (Math.sin((index + playingAudioIndex) * 1.7) + 1) * 8);

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = 3;
      const gap = 2;
      progress += 0.01;
      if (progress >= 1.0) progress = 1.0;

      for (let i = 0; i < heights.length; i++) {
        const x = i * (barWidth + gap) + 10;
        const barProgress = i / heights.length;
        const animatedHeight = heights[i] + Math.sin(Date.now() * 0.025 + i) * 4;
        const y = (canvas.height - animatedHeight) / 2;

        if (barProgress < progress) {
          ctx.fillStyle = '#ff9f1c'; // Amber progress color
        } else {
          ctx.fillStyle = '#475569'; // Grey default color
        }
        ctx.fillRect(x, y, barWidth, animatedHeight);
      }
      if (progress < 1.0) {
        animationId = requestAnimationFrame(render);
      }
    };
    render();

    return () => {
      cancelAnimationFrame(animationId);
      if (canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#475569';
        const barWidth = 3;
        const gap = 2;
        for (let i = 0; i < heights.length; i++) {
          const x = i * (barWidth + gap) + 10;
          const h = heights[i];
          const y = (canvas.height - h) / 2;
          ctx.fillRect(x, y, barWidth, h);
        }
      }
    };
  }, [playingAudioIndex, waveformRefs]);

  // Play simulated audio notes
  const playAudioSim = (index) => {
    if (playingAudioIndex !== null) return;
    if (!setup.canManageField) {
      addToast('Tu rol no puede ejecutar comandos de campo.', 'warning');
      return;
    }
    if (!selectedFieldWorker) {
      addToast(fieldWorkers.length === 0
        ? 'Primero autorizá una persona de la cuadrilla en Equipo y permisos.'
        : 'Elegí el actor autorizado de la prueba.', 'warning');
      return;
    }

    setPlayingAudioIndex(index);
    playBeep('start', () => {
      setTimeout(() => {
        playBeep('end', async () => {
          setPlayingAudioIndex(null);

          // Register the provided demo transcript without implying live transcription.
          const data = WHATSAPP_DEMO_AUDIO_TRANSCRIPTS[index];
          try {
            const simulation = await postFieldSimulation({ text: data.text, kind: 'audio' });

            addToast(
              simulation.operationalProposal
                ? `Propuesta ${simulation.operationalProposal.confirmationCode} creada y pendiente de confirmación.`
                : 'Transcripción de prueba guardada como evidencia.',
              'success',
            );

            setCopilotMessages(prev => [...prev, { 
                sender: 'bot',
                text: `**[Audio de prueba]**\n${simulation.reply}`,
            }]);

            await refreshFieldSimulationViews();
          } catch (e) {
            console.error("Audio sim webhook error:", e);
            addToast(e.message || 'No se pudo procesar el audio de prueba.', 'error');
          }
        });
      }, 3000);
    });
  };

  // Replay audio directly from chat bubble
  const replayAudio = async (message) => {
    if (message?.id && message.mediaUrl && message.media?.storage?.status === 'stored') {
      try {
        const audio = new Audio(`/api/evidence/${encodeURIComponent(message.id)}`);
        await audio.play();
        return;
      } catch (error) {
        console.error('Protected audio playback failed:', error);
        addToast('No pudimos reproducir la evidencia de audio.', 'warning');
      }
    }
    playBeep('start', () => {
      setTimeout(() => {
        playBeep('end');
      }, 1500);
    });
  };

  // Leaflet Map client-side loader
  useEffect(() => {
    let cancelled = false;
    let mapTimer = null;
    let mapInstance = null;
    let tileLayer = null;
    let markers = [];
    let heatCircles = [];

    const initMap = async () => {
      const L = await import('leaflet');
      await import('leaflet/dist/leaflet.css');

      if (cancelled || !mapContainerRef.current) return;

      const projectSite = projectPointAvailable
        ? [projectLatitude, projectLongitude]
        : [-34.6037, -58.3816];
      mapInstance = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false
      }).setView(projectSite, projectPointAvailable ? 17 : 11);

      const tileUrl = isLightTheme
        ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

      tileLayer = L.tileLayer(tileUrl, {
        maxZoom: 20
      }).addTo(mapInstance);

      if (projectPointAvailable) {
        L.circle(projectSite, {
          color: '#10b981',
          fillColor: '#10b981',
          fillOpacity: 0.12,
          radius: Math.max(25, Number(platformAccess.project.geofenceMeters) || 100),
        }).addTo(mapInstance);
      }

      const locatedAttendance = attendanceRecords(state.attendance).filter(({ entry }) => {
        const latitude = Number(entry.latitude);
        const longitude = Number(entry.longitude);
        return attendanceStatus(entry).includes('Presente')
          && entry.latitude != null
          && entry.longitude != null
          && Number.isFinite(latitude)
          && Number.isFinite(longitude);
      });

      if (mapMode === 'sat') {
        locatedAttendance.forEach(({ name, entry }) => {
          const radarIcon = L.divIcon({
            className: 'radar-marker-container',
            html: '<div class="radar-marker-pulse"></div><div class="radar-marker-dot"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          });
          const popup = document.createElement('div');
          const person = document.createElement('strong');
          person.textContent = name;
          const detail = document.createElement('div');
          detail.textContent = `${entry.role || 'Cuadrilla de obra'} · Check-in: ${entry.checkin || 'Sin hora'}`;
          popup.append(person, detail);

          const marker = L.marker([Number(entry.latitude), Number(entry.longitude)], { icon: radarIcon })
            .addTo(mapInstance)
            .bindPopup(popup);
          markers.push(marker);
        });

        // Zoom fit
        if (markers.length > 0) {
          const group = L.featureGroup(markers);
          mapInstance.fitBounds(group.getBounds().pad(0.3));
          markers[0].openPopup();
        }
      } else {
        locatedAttendance.forEach(({ entry }) => {
          const circle = L.circle([Number(entry.latitude), Number(entry.longitude)], {
            color: '#ff9f1c',
            fillColor: '#ff9f1c',
            fillOpacity: 0.35,
            radius: Math.max(25, Number(entry.accuracy) || 35),
            stroke: false
          }).addTo(mapInstance);
          heatCircles.push(circle);
        });
      }
    };

    if (activeTab === 'sec-dashboard') {
      mapTimer = window.setTimeout(() => {
        void initMap().catch((error) => {
          if (!cancelled) {
            console.error('Map initialization failed:', error);
          }
        });
      }, 100);
    }

    return () => {
      cancelled = true;
      if (mapTimer !== null) {
        window.clearTimeout(mapTimer);
      }
      if (mapInstance) {
        mapInstance.remove();
        mapInstance = null;
      }
    };
  }, [
    activeTab,
    isLightTheme,
    mapMode,
    platformAccess.project.geofenceMeters,
    projectLatitude,
    projectLongitude,
    projectPointAvailable,
    state.attendance,
  ]);

  // Chart.js reactive loader
  useEffect(() => {
    let progressChart = null;
    let tasksChart = null;

    const buildCharts = async () => {
      const { Chart } = await import('chart.js/auto');

      // 1. Progress recorded on each persisted task.
      if (progressChartRef.current) {
        progressChart = new Chart(progressChartRef.current, {
          type: 'bar',
          data: {
              labels: Object.values(state.tasks).map((task) => task.name || 'Tarea sin nombre'),
              datasets: [{
                label: 'Avance registrado',
                data: Object.values(state.tasks).map((task) => Math.max(0, Math.min(100, Number(task.progress) || 0))),
                backgroundColor: '#ff9f1c',
                borderRadius: 6,
              }],
          },
          options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                  legend: { labels: { color: isLightTheme ? '#475569' : '#94a3b8', font: { family: 'Inter', size: 11 } } }
              },
              scales: {
                  x: { grid: { color: isLightTheme ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.02)' }, ticks: { color: isLightTheme ? '#475569' : '#64748b' } },
                  y: { min: 0, max: 100, grid: { color: isLightTheme ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.02)' }, ticks: { color: isLightTheme ? '#475569' : '#64748b', callback: v => v + '%' } }
              }
          }
        });
      }

      // 2. Tasks Chart (Doughnut)
      if (tasksChartRef.current) {
        let completed = 0;
        let enCurso = 0;
        let pendientes = 0;

        Object.values(state.tasks).forEach(task => {
          if (task.progress === 100) completed++;
          else if (task.progress > 0) enCurso++;
          else pendientes++;
        });

        tasksChart = new Chart(tasksChartRef.current, {
          type: 'doughnut',
          data: {
              labels: ['Completadas', 'En curso', 'Pendientes'],
              datasets: [{
                  data: [completed, enCurso, pendientes],
                  backgroundColor: [
                      '#10b981', 
                      '#3b82f6', 
                      isLightTheme ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.12)',
                  ],
                  borderWidth: 0
              }]
          },
          options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                  legend: { 
                      position: 'right',
                      labels: { color: isLightTheme ? '#475569' : '#94a3b8', font: { family: 'Inter', size: 10 } } 
                  }
              },
              cutout: '72%'
          }
        });
      }

    };

    if (activeTab === 'sec-dashboard') {
      buildCharts();
    }

    return () => {
      if (progressChart) progressChart.destroy();
      if (tasksChart) tasksChart.destroy();
    };
  }, [activeTab, isLightTheme, state]);

  const handleAgenticAction = async (suggestion) => {
    if (!setup.canManageProjects) {
      addToast('Tu rol puede consultar la obra, pero no crear solicitudes operativas.', 'warning');
      return;
    }
    const actions = {
      REQUEST_CREW_REASSIGNMENT: {
        title: 'Reasignación de cuadrilla pendiente',
        description: 'El Supervisor IA sugirió revisar una reasignación de cuadrilla. La solicitud requiere aprobación del responsable.',
      },
      REQUEST_MATERIAL_PURCHASE: {
        title: 'Compra de material pendiente de aprobación',
        description: 'El Supervisor IA detectó un posible riesgo de stock. La solicitud requiere cantidad, proveedor y aprobación antes de emitir una orden.',
      },
    };
    const action = actions[suggestion?.type];
    if (!action) {
      addToast('Comando de IA no reconocido.', 'warning');
      return;
    }

    const newIncident = {
      id: createClientEntityId('approval-ai'),
      title: action.title,
      description: suggestion.rationale || action.description,
      type: 'warning',
      badge: 'Requiere aprobación',
      timestamp: 'Recién creada',
      reporter: 'Supervisor IA',
      icon: 'fa-solid fa-clipboard-check',
    };
    const nextState = { ...state, incidents: [newIncident, ...state.incidents] };
    const saved = await saveStateToApi(nextState);
    if (!saved) return;
    addToast('Solicitud creada. No se ejecutó ninguna acción externa.', 'success');
    setCopilotMessages(prev => [...prev, {
      sender: 'bot',
      text: '✅ Solicitud registrada para aprobación humana. No se emitieron órdenes ni mensajes externos.',
      confidence: 'high',
      evidence: [],
      limitations: [],
      actions: [],
    }]);
  };

  const sendCopilotUserMessage = async (promptOverride = null) => {
    if (!setup.aiSupervisorEnabled) {
      addToast('El Supervisor IA debe ser activado por un administrador en Integraciones.', 'warning');
      return;
    }
    const text = (typeof promptOverride === 'string' ? promptOverride : copilotInput).trim();
    if (!text || copilotStatus === 'loading') return;

    const history = copilotMessages
      .filter((message) => message.text && !message.error)
      .slice(-8)
      .map((message) => ({
        role: message.sender === 'user' ? 'user' : 'assistant',
        content: message.text.slice(0, 1_200),
      }));
    const userMsg = {
      sender: 'user',
      text,
      confidence: null,
      evidence: [],
      limitations: [],
      actions: [],
    };
    setCopilotMessages(prev => [...prev, userMsg]);
    setCopilotInput('');
    setCopilotStatus('loading');

    try {
      const response = await fetch('/api/ai/supervisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text, history }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'El Supervisor IA no está disponible.');

      const botMsg = {
        sender: 'bot',
        text: data.answer,
        confidence: data.confidence,
        evidence: data.evidence || [],
        limitations: data.limitations || [],
        actions: data.actions || [],
        model: data.model,
        generatedAt: data.generatedAt,
      };
      setCopilotMessages(prev => [...prev, botMsg]);
      const cleanText = data.answer.replace(/\*\*|\[.*?\]|•|🟢|🔴|⚠️/g, '').split('.')[0];
      speakTextSpanish(cleanText);
    } catch (error) {
      setCopilotMessages(prev => [...prev, {
        sender: 'bot',
        text: error.message || 'No pude procesar la consulta. Probá nuevamente.',
        confidence: null,
        evidence: [],
        limitations: [],
        actions: [],
        error: true,
      }]);
      addToast(error.message || 'El Supervisor IA no está disponible.', 'error');
    } finally {
      setCopilotStatus('idle');
    }
  };

  const handleSendMessage = async () => {
    const text = chatInput.trim();
    if (!text || fieldSimulatorBusy) return;

    try {
      const simulation = await postFieldSimulation({ text });
      setChatInput('');
      await refreshFieldSimulationViews();
      if (simulation.operationalProposal) {
        addToast(
          `Propuesta ${simulation.operationalProposal.confirmationCode} creada. Revisala antes de aplicar cambios.`,
          'success',
        );
      }
    } catch (e) {
      console.error(e);
      addToast(e.message || 'No se pudo enviar el mensaje.', 'error');
    }
  };

  const handleCreateOnboardingProposal = async () => {
    if (!fieldSimulatorReady || fieldSimulatorBusy) return;
    try {
      const simulation = await postFieldSimulation({
        scenario: FIRST_VALUE_APPROVAL_SIMULATOR_SCENARIO,
      });
      await refreshFieldSimulationViews();
      if (!simulation.operationalProposal) {
        throw new Error('El escenario se registró, pero no generó una propuesta accionable.');
      }
      addToast(
        `Propuesta ${simulation.operationalProposal.confirmationCode} lista para revisión.`,
        'success',
      );
    } catch (error) {
      console.error('First-value proposal simulation failed:', error);
      addToast(error.message || 'No se pudo generar la propuesta de prueba.', 'error');
    }
  };

  // Select simulated attachments
  const selectAttachment = async (type) => {
    setAttachmentMenuOpen(false);
    const payload = { kind: 'text' };

    if (type === 'document') {
      payload.text = '[Escenario de documento] No se adjuntó un archivo real desde este simulador.';
    } else if (type === 'camera') {
      payload.text = '[Escenario de cámara] No se capturó ni adjuntó una imagen real.';
    } else if (type === 'gallery') {
      payload.text = '[Escenario de galería] No se seleccionó ni adjuntó una imagen real.';
    } else if (type === 'audio') {
      payload.text = '[Escenario de audio] Usá los audios demostrativos del panel para registrar una transcripción de prueba.';
    } else if (type === 'contact') {
      payload.text = '[Escenario de contacto] No se adjuntó una tarjeta de contacto real.';
    }

    try {
      await postFieldSimulation(payload);
      addToast('Escenario registrado sin adjuntar un archivo real.', 'info');
      await refreshFieldSimulationViews();
    } catch(e) {
      console.error(e);
      addToast(e.message || 'No se pudo adjuntar la evidencia de prueba.', 'error');
    }
  };

  const sendGpsPoint = async ({ latitude, longitude, successMessage }) => {
    try {
      await postFieldSimulation({
        latitude,
        longitude,
      });
      closeGpsOptions();
      addToast(successMessage, 'success');
      await refreshFieldSimulationViews();
    } catch (e) {
      console.error(e);
      addToast(e.message || 'No se pudo validar la ubicación.', 'error');
    }
  };

  const openGpsOptions = () => {
    if (!fieldSimulatorReady || fieldSimulatorBusy) return;
    gpsReturnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    setGpsLabel('Elegí cómo obtener un punto de ubicación');
    setGpsModalOpen(true);
  };

  const closeGpsOptions = () => {
    setGpsModalOpen(false);
    requestAnimationFrame(() => gpsReturnFocusRef.current?.focus());
  };

  const handleGpsDialogKeyDown = (event) => {
    if (event.key === 'Escape') {
      if (!fieldSimulatorBusy) {
        event.preventDefault();
        closeGpsOptions();
      }
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(
      gpsDialogRef.current?.querySelectorAll('button:not([disabled])') || [],
    );
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }
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

  const simulateProjectGps = async () => {
    if (!projectPointAvailable) {
      addToast('La obra todavía no tiene latitud y longitud configuradas.', 'warning');
      return;
    }
    setGpsLabel(`Punto configurado de ${displayProjectName}`);
    await sendGpsPoint({
      latitude: projectLatitude,
      longitude: projectLongitude,
      successMessage: `Punto configurado de ${displayProjectName} enviado como simulación.`,
    });
  };

  const useBrowserGps = async () => {
    if (!navigator.geolocation) {
      addToast('Este navegador no ofrece geolocalización.', 'error');
      return;
    }
    setGpsRequestPending(true);
    setGpsLabel('Solicitando una lectura puntual al navegador…');
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 12_000,
        });
      });
      const latitude = Number(position.coords.latitude);
      const longitude = Number(position.coords.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error('El navegador devolvió una ubicación inválida.');
      }
      const accuracy = Number(position.coords.accuracy);
      setGpsLabel(Number.isFinite(accuracy)
        ? `Lectura puntual obtenida · precisión aproximada ${Math.round(accuracy)} m`
        : 'Lectura puntual obtenida');
      await sendGpsPoint({
        latitude,
        longitude,
        successMessage: 'Ubicación actual del navegador enviada como lectura puntual.',
      });
    } catch (error) {
      const denied = error?.code === 1;
      const timedOut = error?.code === 3;
      addToast(
        denied
          ? 'El navegador no recibió permiso para acceder a tu ubicación.'
          : timedOut
            ? 'La ubicación demoró demasiado. Probá nuevamente.'
            : error.message || 'No se pudo obtener la ubicación del navegador.',
        'error',
      );
      setGpsLabel('No se obtuvo una ubicación. Podés reintentar o usar el punto configurado de la obra.');
    } finally {
      setGpsRequestPending(false);
    }
  };

  const handleTasksChange = async (updatedTasks) => {
    if (!setup.canManageProjects) {
      addToast('Tu rol puede consultar el cronograma, pero no modificarlo.', 'warning');
      return false;
    }
    const items = Object.values(updatedTasks);
    const avancePercentage = items.length > 0
      ? Math.round(items.reduce((sum, task) => sum + (Number(task.progress) || 0), 0) / items.length)
      : 0;
    const nextState = { ...state, tasks: updatedTasks, avancePercentage };
    return saveStateToApi(nextState);
  };

  // Stockpile control. The child owns form state; this callback keeps the shared
  // tenant snapshot and its optimistic-concurrency precondition in one place.
  const handleStockpileCommit = async (updatedStockpiles, action) => {
    if (!setup.canManageProjects) {
      addToast('Tu rol puede consultar los acopios, pero no modificarlos.', 'warning');
      return false;
    }

    const material = updatedStockpiles[action.materialId];
    const newIncident = action.type === 'received' && material
      ? {
          id: createClientEntityId('inc-mat'),
          title: 'Recepción de materiales',
          description: `Se registraron ${Number(action.quantity).toLocaleString('es-AR')} ${material.unit} de ${material.name}.${action.reference ? ` Referencia: ${action.reference}.` : ''} Stock actualizado a ${Number(material.current).toLocaleString('es-AR')} ${material.unit}.`,
          type: 'success',
          badge: 'Ingreso',
          timestamp: new Intl.DateTimeFormat('es-AR', {
            dateStyle: 'short',
            timeStyle: 'short',
          }).format(new Date()),
          reporter: 'Control de acopio',
          icon: 'fa-solid fa-circle-check',
          metadata: { stockpileKey: action.materialId },
        }
      : null;

    const nextState = {
      ...state,
      stockpiles: updatedStockpiles,
      incidents: newIncident
        ? [newIncident, ...(Array.isArray(state.incidents) ? state.incidents : [])].slice(0, 1_000)
        : state.incidents,
    };
    const saved = await saveStateToApi(nextState);
    if (saved) {
      addToast(
        action.type === 'received'
          ? 'Recepción y stock guardados en la obra.'
          : action.type === 'updated'
            ? 'Material actualizado.'
            : 'Material agregado al acopio.',
        'success',
      );
    }
    return saved;
  };

  // Award incentive bonus
  const handleAwardBonus = async () => {
    const worker = fieldWorkers.find((candidate) => candidate.id === hrBonusAssignee) || null;
    if (!worker) {
      addToast('Elegí una persona activa de la cuadrilla.', 'warning');
      return;
    }
    const nextBonuses = [
      {
        name: worker.name,
        type: hrBonusType,
        amount: null,
        date: new Date().toLocaleString('es-AR'),
      },
      ...state.hrBonuses
    ];

    const newIncident = {
      id: createClientEntityId('inc-bonus'),
      title: "Incentivo registrado",
      description: `${hrBonusType} registrado para ${worker.name}. No se informó un importe ni se ejecutó un pago.`,
      type: "success",
      badge: "Registro",
      timestamp: "Hace un momento",
      reporter: "Recursos Humanos",
      icon: "fa-solid fa-gift"
    };

    const nextState = {
      ...state,
      hrBonuses: nextBonuses,
      incidents: [newIncident, ...state.incidents]
    };

    setState(normalizeAppState(nextState));
    await saveStateToApi(nextState);
    addToast(`Incentivo registrado para ${worker.name}.`, 'success');
  };

  const handleSubmitMedicalCert = async (e) => {
    e.preventDefault();
    const worker = fieldWorkers.find((candidate) => candidate.id === hrMedAssignee) || null;
    if (!worker) {
      addToast('Elegí una persona activa de la cuadrilla.', 'warning');
      return;
    }
    const updatedHrAttendance = { ...state.hrAttendance };
    const legacyAttendee = updatedHrAttendance[worker.name];
    const sameNameWorkers = fieldWorkers.filter((candidate) => candidate.name === worker.name);
    const canMigrateLegacy = legacyAttendee && (
      legacyAttendee.workerId === worker.id
      || (!legacyAttendee.workerId && sameNameWorkers.length === 1)
    );
    const attendee = updatedHrAttendance[worker.id]
      || (canMigrateLegacy ? legacyAttendee : null)
      || {};
    if (canMigrateLegacy && worker.name !== worker.id) {
      delete updatedHrAttendance[worker.name];
    }
    updatedHrAttendance[worker.id] = {
      ...attendee,
      workerId: worker.id,
      name: worker.name,
      role: worker.role || attendee.role || 'Cuadrilla de obra',
      presents: Number(attendee.presents) || 0,
      excused: (Number(attendee.excused) || 0) + 1,
      unexcused: Number(attendee.unexcused) || 0,
      status: 'Ausente Justificado',
    };

    const newIncident = {
      id: createClientEntityId('inc-med'),
      title: "Licencia Médica Registrada",
      description: `Licencia registrada manualmente para ${worker.name}. Duración informada: ${hrMedDays}. Los detalles clínicos y el certificado no se incorporan a la bitácora operativa.`,
      type: "warning",
      badge: "Licencia",
      sensitivity: "medical",
      timestamp: "Hace un momento",
      reporter: "Recursos Humanos",
      icon: "fa-solid fa-notes-medical"
    };

    const nextState = {
      ...state,
      hrAttendance: updatedHrAttendance,
      incidents: [newIncident, ...state.incidents]
    };

    setState(normalizeAppState(nextState));
    await saveStateToApi(nextState);

    addToast(`Licencia registrada para ${worker.name}.`, 'success');
  };

  return (
    <>
      {/* Live Toasts Notifications Container */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast-notification toast-${t.type}`}>
            <div className="toast-icon-wrapper">
              <i className={t.type === 'success' ? 'fa-solid fa-check' : t.type === 'warning' ? 'fa-solid fa-exclamation-triangle' : 'fa-solid fa-info'}></i>
            </div>
            <div>
              <strong style={{ display: 'block', fontSize: '0.85rem', marginBottom: '2px' }}>{t.type === 'success' ? 'Éxito' : t.type === 'warning' ? 'Alerta Crítica' : 'Notificación'}</strong>
              <span style={{ fontSize: '0.8rem', opacity: 0.9 }}>{t.message}</span>
            </div>
          </div>
        ))}
      </div>

          {setup.canReadOperationalProposals && pendingOperationalProposalCount > 0 && (
            <aside className="operational-approval-cta" aria-live="polite">
              <div className="operational-approval-cta__icon" aria-hidden="true">
                <i className="fa-solid fa-list-check"></i>
              </div>
              <div className="operational-approval-cta__copy">
                <span>Control humano pendiente</span>
                <strong>
                  {latestOperationalProposal?.confirmationCode
                    ? `La propuesta ${latestOperationalProposal.confirmationCode} está lista para decidir.`
                    : `${pendingOperationalProposalCount} propuesta${pendingOperationalProposalCount === 1 ? '' : 's'} espera${pendingOperationalProposalCount === 1 ? '' : 'n'} revisión.`}
                </strong>
                <small>Ningún cambio se aplica hasta confirmar una decisión válida.</small>
              </div>
              <Link href="/dashboard/approvals">
                {setup.canManageOperationalProposals ? 'Revisar y decidir' : 'Revisar propuestas'}
                <span aria-hidden="true">→</span>
              </Link>
            </aside>
          )}
          
          {/* SECTION 1: DASHBOARD */}
          <section id="sec-dashboard" className={`content-section animate-fade-in-up ${activeTab === 'sec-dashboard' ? 'active' : ''}`}>
            <OperationalPulse
              project={{
                ...platformAccess.project,
                name: displayProjectName,
                address: displayProjectAddress,
              }}
              state={state}
              setup={setup}
              syncState={syncState}
              lastSyncedAt={lastSyncedAt}
            />

            {setupNeedsAttention && (
              <PlatformReadiness
                platformAccess={platformAccess}
                setup={setup}
                syncState={syncState}
                lastSyncedAt={lastSyncedAt}
              />
            )}

            {/* Dashboard Charts */}
            <div className="grid-2" style={{ marginBottom: '24px' }}>
              <div className="glass-panel-premium dashboard-card-hover">
                <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '16px' }}>Avance registrado por tarea</h3>
                <div className="chart-container" style={{ height: '220px', position: 'relative' }}>
                  {taskEntries.length === 0 ? (
                    <div className="nocrit-msg" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '54px 20px' }}>
                      <i className="fa-solid fa-list-check" style={{ display: 'block', fontSize: '1.8rem', marginBottom: '10px' }}></i>
                      Todavía no hay tareas registradas.
                    </div>
                  ) : <canvas ref={progressChartRef}></canvas>}
                </div>
              </div>

              <div className="glass-panel-premium dashboard-card-hover">
                <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '16px' }}>Distribución de Tareas por Estado</h3>
                <div className="chart-container" style={{ height: '220px', position: 'relative' }}>
                  {taskEntries.length === 0 ? (
                    <div className="nocrit-msg" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '54px 20px' }}>
                      <i className="fa-solid fa-chart-pie" style={{ display: 'block', fontSize: '1.8rem', marginBottom: '10px' }}></i>
                      La distribución aparecerá cuando cargues tareas.
                    </div>
                  ) : <canvas ref={tasksChartRef}></canvas>}
                </div>
              </div>
            </div>

            {/* Interactive Map & AI Copilot Row */}
            <div className="grid-2" style={{ marginBottom: '24px' }}>
              {/* Map Card */}
              <div className="glass-panel-premium dashboard-card-hover" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: 0 }}>Mapa de ubicaciones registradas</h3>
                  <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <button className="btn btn-sm" onClick={() => setMapMode('sat')} style={{ fontSize: '0.7rem', padding: '4px 10px', background: mapMode === 'sat' ? 'var(--primary)' : 'transparent', color: mapMode === 'sat' ? 'var(--on-primary)' : 'var(--text-secondary)', fontWeight: mapMode === 'sat' ? '700' : '600', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>Puntos</button>
                    <button className="btn btn-sm" onClick={() => setMapMode('heat')} style={{ fontSize: '0.7rem', padding: '4px 10px', background: mapMode === 'heat' ? 'var(--primary)' : 'transparent', color: mapMode === 'heat' ? 'var(--on-primary)' : 'var(--text-secondary)', fontWeight: mapMode === 'heat' ? '700' : '600', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>Precisión</button>
                  </div>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '12px' }}>
                  Lecturas puntuales informadas por cada dispositivo. La precisión depende del navegador y no constituye seguimiento continuo ni validación de identidad.
                </p>
                <div id="map" ref={mapContainerRef} style={{ height: '260px', width: '100%', borderRadius: '12px', border: '1px solid var(--border-color)', zIndex: 5 }}></div>
              </div>

              {/* Architect AI Supervisor Card */}
              <div className="glass-panel-premium dashboard-card-hover copilot-panel">
                <div className="copilot-heading">
                  <div>
                    <span className="copilot-eyebrow">Inteligencia operativa</span>
                    <h3><i className="fa-solid fa-wand-magic-sparkles"></i> Supervisor IA de Obra</h3>
                  </div>
                  <span className={`copilot-scope-badge ${setup.isEmptyState ? 'is-empty' : 'is-live'}`}>
                    <span className="copilot-status-dot"></span>
                    {setup.isEmptyState ? 'Sin datos operativos' : 'Obra activa'}
                  </span>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '10px' }}>
                  Consultá avances, asistencia, stock y riesgos con evidencia de la obra seleccionada. No ejecuta acciones sin aprobación.
                </p>
                <p style={{ color: setup.aiSupervisorEnabled ? 'var(--text-secondary)' : 'var(--warning)', fontSize: '0.74rem', marginBottom: '12px', lineHeight: 1.5 }}>
                  {setup.aiSupervisorEnabled
                    ? <>Al consultar, OpenAI procesa la pregunta y un contexto acotado de la obra activa. <a href="/privacy#openai-processing">Ver privacidad</a>.</>
                    : <>Procesamiento con OpenAI desactivado para este tenant. <Link href="/dashboard/integrations">Revisar activación y privacidad</Link>.</>}
                </p>
                
                <div className="copilot-chat-box">
                  <div className="copilot-chat-messages" style={{ overflowY: 'auto' }}>
                    {copilotMessages.map((msg, i) => (
                      <div
                        key={`${msg.sender}-${msg.generatedAt || i}`}
                        className={`copilot-message ${msg.sender === 'user' ? 'is-user' : 'is-assistant'} ${msg.error ? 'is-error' : ''}`}
                      >
                        <span className="copilot-message-text">{msg.text}</span>
                        {msg.confidence && (
                          <div className="copilot-answer-meta">
                            <span>Confianza {msg.confidence === 'high' ? 'alta' : msg.confidence === 'medium' ? 'media' : 'baja'}</span>
                            {msg.model && <span>{msg.model}</span>}
                          </div>
                        )}
                        {msg.evidence?.length > 0 && (
                          <details className="copilot-evidence">
                            <summary><i className="fa-solid fa-list-check"></i> Evidencia usada ({msg.evidence.length})</summary>
                            <ul>
                              {msg.evidence.map((item, evidenceIndex) => (
                                <li key={`${item}-${evidenceIndex}`}>{item}</li>
                              ))}
                            </ul>
                          </details>
                        )}
                        {msg.limitations?.length > 0 && (
                          <div className="copilot-limitations">
                            <i className="fa-solid fa-circle-info"></i>
                            <span>{msg.limitations.join(' ')}</span>
                          </div>
                        )}
                        {msg.actions?.map((action) => (
                          <button
                            type="button"
                            key={action.type}
                            className="copilot-action-btn"
                            onClick={() => handleAgenticAction(action)}
                            disabled={!setup.canManageProjects}
                            title={!setup.canManageProjects ? 'Tu rol no puede crear solicitudes operativas' : action.rationale}
                          >
                            <i className="fa-solid fa-clipboard-check"></i>
                            {action.label}
                            <span>Requiere aprobación</span>
                          </button>
                        ))}
                      </div>
                    ))}
                    {copilotStatus === 'loading' && (
                      <div className="copilot-message is-assistant is-loading" role="status">
                        <span className="copilot-thinking"><i></i><i></i><i></i></span>
                        Analizando la obra activa…
                      </div>
                    )}
                    <div ref={copilotMessagesEndRef}></div>
                  </div>
                  <form
                    className="copilot-chat-input-container"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void sendCopilotUserMessage();
                    }}
                  >
                    <input 
                      type="text" 
                      className="copilot-chat-input" 
                      placeholder={setup.aiSupervisorEnabled ? 'Pregunta al Supervisor de la obra...' : 'Supervisor IA desactivado por la organización'}
                      value={copilotInput}
                      onChange={(e) => setCopilotInput(e.target.value)}
                      maxLength={2000}
                      disabled={copilotStatus === 'loading' || !setup.aiSupervisorEnabled}
                      aria-label="Consulta para el Supervisor IA"
                    />
                    <button
                      type="submit"
                      className="copilot-chat-btn"
                      disabled={copilotStatus === 'loading' || !copilotInput.trim() || !setup.aiSupervisorEnabled}
                    >
                      {copilotStatus === 'loading' ? 'Analizando…' : 'Consultar'}
                    </button>
                  </form>
                </div>

                <div className="crm-suggestions copilot-suggestions">
                  <button type="button" className="crm-suggest-tag" onClick={() => void sendCopilotUserMessage('Haceme un resumen ejecutivo del avance y los bloqueos registrados.')} disabled={copilotStatus === 'loading' || !setup.aiSupervisorEnabled}>Resumen ejecutivo</button>
                  <button type="button" className="crm-suggest-tag" onClick={() => void sendCopilotUserMessage('¿Quiénes figuran presentes y qué datos de asistencia faltan hoy?')} disabled={copilotStatus === 'loading' || !setup.aiSupervisorEnabled}>Asistencia hoy</button>
                  <button type="button" className="crm-suggest-tag" onClick={() => void sendCopilotUserMessage('¿Qué alertas, incidentes o riesgos de stock requieren atención?')} disabled={copilotStatus === 'loading' || !setup.aiSupervisorEnabled}>Riesgos abiertos</button>
                </div>
              </div>
            </div>

            {/* Dashboard Details Table */}
            <div className="grid-2">
              {/* Left: Asistencia y Operarios */}
              <div className="glass-panel-premium dashboard-card-hover">
                <div className="section-header" style={{ marginBottom: '16px' }}>
                  <h3 style={{ fontFamily: 'var(--font-heading)' }}>Historial de Fichajes de Hoy</h3>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '16px' }}>
                  Registros asociados al número autorizado de cada persona activa.
                </p>
                <table className="logs-table">
                  <thead>
                    <tr>
                      <th>Operario</th>
                      <th>Especialidad</th>
                      <th>Entrada</th>
                      <th>Pausa</th>
                      <th>Salida</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceRecords(state.attendance).length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>
                          Todavía no hay fichajes registrados para esta obra.
                        </td>
                      </tr>
                    ) : attendanceRecords(state.attendance).map(({ key, name, entry: item }) => {
                      const status = attendanceStatus(item);
                      let badgeClass = "badge-warning";
                      if (status.includes('Presente')) badgeClass = 'badge-success';
                      if (status.includes('GPS')) badgeClass = 'badge-info';
                      if (status.includes('Desvío')) badgeClass = 'badge-danger';
                      if (status.includes('Jornada cerrada')) badgeClass = 'badge-info';

                      const breakLabel = item.breakStartedAt
                        ? `${item.breakStartedAt} — ${item.breakEndedAt || 'activa'}`
                        : '—';

                      return (
                        <tr key={key}>
                          <td>{name}</td>
                          <td>{item.role || 'Cuadrilla de obra'}</td>
                          <td>{item.checkin || '—'}</td>
                          <td>{breakLabel}</td>
                          <td>{item.checkout || '—'}</td>
                          <td>
                            <span className={`badge ${badgeClass}`}>{status}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Right: Incidencias y Bitácora */}
              <div className="glass-panel-premium dashboard-card-hover">
                <div className="section-header" style={{ marginBottom: '16px' }}>
                  <h3 style={{ fontFamily: 'var(--font-heading)' }}>Incidencias &amp; Alertas en Curso</h3>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '16px' }}>
                  Novedades persistidas en la bitácora de la obra. Los audios de prueba se conservan como evidencia y no ejecutan cambios por sí solos.
                </p>
                <div className="incidencias-feed" style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: '280px' }}>
                  {state.incidents.length === 0 ? (
                    <div className="nocrit-msg" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px', fontSize: '0.9rem' }}>
                      <i className="fa-solid fa-shield-halved" style={{ fontSize: '2rem', marginBottom: '10px', display: 'block', color: 'var(--success)' }}></i>
                      No hay incidencias registradas para esta obra.
                    </div>
                  ) : (
                    state.incidents.map((inc, i) => {
                      let borderCol = 'var(--info)';
                      let bgCol = 'var(--info-bg)';
                      let badgeClass = 'badge-info';
                      if (inc.type === 'critical') {
                        borderCol = 'var(--danger)';
                        bgCol = 'var(--danger-bg)';
                        badgeClass = 'badge-danger';
                      } else if (inc.type === 'warning') {
                        borderCol = 'var(--warning)';
                        bgCol = 'var(--warning-bg)';
                        badgeClass = 'badge-warning';
                      } else if (inc.type === 'success') {
                        borderCol = 'var(--success)';
                        bgCol = 'var(--success-bg)';
                        badgeClass = 'badge-success';
                      }

                      return (
                        <div key={i} className="glass-panel-premium dashboard-card-hover" style={{ borderLeft: `4px solid ${borderCol}`, background: bgCol, marginBottom: 0, padding: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <strong style={{ color: borderCol, fontSize: '0.8rem' }}><i className={inc.icon}></i> {inc.title}</strong>
                            <span className={`badge ${badgeClass}`}>{inc.badge}</span>
                          </div>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-primary)', margin: '4px 0' }}>
                            {inc.description}
                          </p>
                          <div style={{ marginTop: '4px', fontSize: '0.65rem', color: 'var(--text-secondary)', textAlign: 'right' }}>
                            {inc.timestamp} • {inc.reporter}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <StockpilePanel
              stockpiles={state.stockpiles}
              canManage={setup.canManageProjects && !canonicalTaskCatalog}
              createId={() => createClientEntityId('material')}
              onCommit={handleStockpileCommit}
            />

            {/* Operational capabilities */}
            <div className="glass-panel-premium dashboard-card-hover" style={{ marginTop: '24px' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '16px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fa-solid fa-shield-halved"></i> Capacidades operativas disponibles
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>
                Funciones disponibles en esta versión. Su resultado depende de los datos, canales y permisos configurados por cada organización.
              </p>
              <div className="grid-3" style={{ marginBottom: '10px' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', borderTop: '3px solid #60a5fa' }}>
                  <h5 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.95rem', marginBottom: '8px' }}><i className="fa-solid fa-key" style={{ color: '#60a5fa' }}></i> Identidad por número autorizado</h5>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                    Vincula un número normalizado a una persona activa de la cuadrilla. No confirma la titularidad de la línea ni evita que otra persona use el dispositivo.
                  </p>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', borderTop: '3px solid #34d399' }}>
                  <h5 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.95rem', marginBottom: '8px' }}><i className="fa-solid fa-map-location-dot" style={{ color: '#34d399' }}></i> Comparación con geocerca</h5>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                    Compara una lectura puntual enviada por el dispositivo con el radio configurado. Registra el resultado y la precisión informada; no evita manipulación del GPS.
                  </p>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', borderTop: '3px solid #ff9f1c' }}>
                  <h5 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.95rem', marginBottom: '8px' }}><i className="fa-solid fa-file-pdf" style={{ color: '#ff9f1c' }}></i> Reporte operativo revisable</h5>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                    La vista de reporte compone únicamente los registros disponibles y permite revisarlos antes de imprimir. No envía mensajes ni archivos automáticamente.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 2: WHATSAPP SIMULATOR */}
          <section id="sec-whatsapp" className={`content-section animate-fade-in-up ${activeTab === 'sec-whatsapp' ? 'active' : ''}`}>
            <div className="section-header">
              <div className="header-title">
                <h1>WhatsApp · Demo Lab</h1>
                <p>Probá el flujo operativo sin afectar un número real. Cuando Meta esté conectado, los mensajes reales ingresarán por la integración del tenant.</p>
              </div>
            </div>

            {approvalOnboardingMode && (
              <aside className="approval-onboarding-card" aria-labelledby="approval-onboarding-title">
                <div className="approval-onboarding-card__step">05</div>
                <div className="approval-onboarding-card__copy">
                  <span>Primer valor · reportar → aprobar → controlar</span>
                  <strong id="approval-onboarding-title">Generá una propuesta operativa segura.</strong>
                  <p>
                    Este escenario registra una demora de proveedor como propuesta pendiente.
                    No modifica el cronograma: primero vas a revisarla y decidirla en la bandeja.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!fieldSimulatorReady || fieldSimulatorBusy}
                  onClick={() => void handleCreateOnboardingProposal()}
                >
                  <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>
                  {fieldSimulationPending ? 'Generando…' : 'Generar propuesta de prueba'}
                </button>
              </aside>
            )}

            <div className="field-simulator-toolbar">
              <label className="field-simulator-actor" htmlFor="field-simulator-worker">
                <span>Identidad representada en la simulación</span>
                <select
                  id="field-simulator-worker"
                  value={selectedFieldWorkerId}
                  disabled={!setup.canManageField || fieldWorkers.length === 0 || fieldSimulatorBusy}
                  onChange={(event) => setSelectedFieldWorkerId(event.target.value)}
                >
                  <option value="">Seleccioná una persona</option>
                  {fieldWorkers.map((worker) => (
                    <option key={worker.id} value={worker.id}>
                      {worker.name} · {worker.role || 'Cuadrilla'} · {worker.whatsappRole}
                    </option>
                  ))}
                </select>
                <small>La simulación puede modificar esta obra. La auditoría registra al usuario del panel y a la persona representada.</small>
              </label>
              <div className={`field-simulator-access ${fieldSimulatorReady ? 'is-ready' : 'is-blocked'}`} role="status">
                {!setup.canManageField ? (
                  <>
                    <div><strong>Simulador en modo consulta</strong><span>Tu rol no puede ejecutar comandos de campo.</span></div>
                    {setup.canViewTeam
                      ? <Link href="/dashboard/team">Revisar equipo y permisos</Link>
                      : <span>Pedile acceso a un administrador.</span>}
                  </>
                ) : fieldWorkers.length === 0 ? (
                  <>
                    <div><strong>Falta autorizar la cuadrilla</strong><span>Ningún evento puede modificar la obra sin una identidad activa.</span></div>
                    <Link href="/dashboard/team">Autorizar una persona</Link>
                  </>
                ) : !selectedFieldWorker ? (
                  <div><strong>Elegí el actor de la prueba</strong><span>Los controles se habilitan después de seleccionar una identidad.</span></div>
                ) : (
                  <div><strong>{selectedFieldWorker.name}</strong><span>Persona representada; el usuario real del panel también queda auditado.</span></div>
                )}
              </div>
            </div>

            <div className="grid-2">
              {/* Smartphone Mockup */}
              <div className="phone-frame">
                <div className="phone-notch"></div>
                <div className="whatsapp-simulator">
                  <div className="whatsapp-header">
                    <div className="whatsapp-contact">
                      <div className="whatsapp-avatar"><ObraSaasMark className="whatsapp-avatar-mark" size={38} /></div>
                        <div className="whatsapp-contact-details">
                          <span className="whatsapp-contact-name">Asistente ObraSaaS</span>
                          <span className="whatsapp-contact-status">{fieldSimulatorReady ? `Actor: ${selectedFieldWorker.name}` : 'Actor pendiente'}</span>
                        </div>
                      </div>
                    <span className="field-simulator-badge">Simulador</span>
                  </div>

                  {/* Chat messages */}
                  <div className="whatsapp-chat-body" style={{ overflowY: 'auto' }}>
                    {chatMessages.map((msg, i) => (
                      <div key={msg.id || msg.externalId || i} className={`message ${msg.sender === 'user' ? 'sent' : 'received'}`}>
                        {msg.text.includes(' plan') || msg.text.includes('Ubicación') || msg.text.includes('🎙️') || msg.text.includes('📍') || msg.text.includes('📸') ? (
                          <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
                        ) : msg.text.startsWith('📄') || msg.text.startsWith('📸') || msg.text.startsWith('🖼️') || msg.text.startsWith('👤') ? (
                          <div>{msg.text}</div>
                        ) : msg.kind === 'audio' || msg.text.includes('Audio de obra') || msg.text.includes('Audio ') ? (
                          <div>
                            <div className="audio-player-container" onClick={() => replayAudio(msg)} style={{ minWidth: '180px', marginBottom: '6px', cursor: 'pointer' }} title="Reproducir audio">
                              <div className="play-btn" style={{ width: '26px', height: '26px', fontSize: '0.75rem', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', color: 'var(--on-primary)' }}><i className="fa-solid fa-play"></i></div>
                              <div style={{ flexGrow: 1, height: '4px', background: 'rgba(255,255,255,0.15)', borderRadius: '2px', position: 'relative', overflow: 'hidden' }}>
                                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '100%', background: 'var(--primary)', borderRadius: '2px' }}></div>
                              </div>
                              <i className="fa-solid fa-microphone-lines" style={{ color: '#ff9f1c', fontSize: '0.85rem' }}></i>
                            </div>
                            <span style={{ fontSize: '0.75rem' }}>{msg.text}</span>
                          </div>
                        ) : (
                          <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
                        )}
                        {msg.id && msg.mediaUrl && msg.media?.storage?.status === 'stored' && msg.kind !== 'audio' && (
                          <a
                            href={`/api/evidence/${encodeURIComponent(msg.id)}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ display: 'inline-flex', marginTop: '8px', color: 'inherit', textDecoration: 'underline' }}
                          >
                            Ver evidencia protegida
                          </a>
                        )}
                        <span className="message-time">{msg.time}</span>
                      </div>
                    ))}
                    <div ref={chatMessagesEndRef}></div>
                  </div>

                  {/* Input Bar */}
                  <div className="whatsapp-input-bar">
                    <button
                      type="button"
                      className="whatsapp-clip-btn"
                      aria-label="Abrir menú de adjuntos de prueba"
                      aria-expanded={attachmentMenuOpen}
                      disabled={!fieldSimulatorReady || fieldSimulatorBusy}
                      onClick={() => setAttachmentMenuOpen(!attachmentMenuOpen)}
                    >
                      <i className="fa-solid fa-paperclip" aria-hidden="true"></i>
                    </button>
                    <input 
                      type="text" 
                      className="whatsapp-text-input" 
                      placeholder={fieldSimulatorReady ? `Mensaje como ${selectedFieldWorker.name}…` : 'Seleccioná un actor para simular…'}
                      disabled={!fieldSimulatorReady || fieldSimulatorBusy}
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    />
                    <button
                      type="button"
                      className="whatsapp-send-btn"
                      aria-label="Enviar mensaje de prueba"
                      disabled={!fieldSimulatorReady || fieldSimulatorBusy || !chatInput.trim()}
                      onClick={handleSendMessage}
                    >
                      <i className="fa-solid fa-paper-plane" aria-hidden="true"></i>
                    </button>
                  </div>

                  {/* Attachment menu */}
                  {attachmentMenuOpen && (
                    <div className="whatsapp-attachment-menu" style={{ display: 'grid' }} aria-label="Adjuntos de prueba">
                      <button type="button" className="attachment-item" disabled={!fieldSimulatorReady || fieldSimulatorBusy} onClick={() => selectAttachment('document')}>
                        <div className="attachment-icon" style={{ background: '#4285f4' }}><i className="fa-solid fa-file-lines"></i></div>
                        <span>Documento</span>
                      </button>
                      <button type="button" className="attachment-item" disabled={!fieldSimulatorReady || fieldSimulatorBusy} onClick={() => selectAttachment('camera')}>
                        <div className="attachment-icon" style={{ background: '#ea4335' }}><i className="fa-solid fa-camera"></i></div>
                        <span>Cámara</span>
                      </button>
                      <button type="button" className="attachment-item" disabled={!fieldSimulatorReady || fieldSimulatorBusy} onClick={() => selectAttachment('gallery')}>
                        <div className="attachment-icon" style={{ background: '#a142f4' }}><i className="fa-solid fa-image"></i></div>
                        <span>Galería</span>
                      </button>
                      <button type="button" className="attachment-item" disabled={!fieldSimulatorReady || fieldSimulatorBusy} onClick={() => selectAttachment('audio')}>
                        <div className="attachment-icon" style={{ background: '#ff6d01' }}><i className="fa-solid fa-headphones"></i></div>
                        <span>Audio</span>
                      </button>
                      <button type="button" className="attachment-item" disabled={!fieldSimulatorReady || fieldSimulatorBusy} onClick={() => { setAttachmentMenuOpen(false); openGpsOptions(); }}>
                        <div className="attachment-icon" style={{ background: '#0f9d58' }}><i className="fa-solid fa-location-dot"></i></div>
                        <span>Ubicación</span>
                      </button>
                      <button type="button" className="attachment-item" disabled={!fieldSimulatorReady || fieldSimulatorBusy} onClick={() => selectAttachment('contact')}>
                        <div className="attachment-icon" style={{ background: '#34a853' }}><i className="fa-solid fa-user"></i></div>
                        <span>Contacto</span>
                      </button>
                    </div>
                  )}

                  {/* GPS modal */}
                  {gpsModalOpen && (
                    <div ref={gpsDialogRef} className="gps-share-screen" style={{ display: 'flex' }} role="dialog" aria-modal="true" aria-labelledby="gps-dialog-title" onKeyDown={handleGpsDialogKeyDown}>
                      <div className="gps-share-header">
                        <button type="button" aria-label="Cerrar opciones de ubicación" autoFocus disabled={fieldSimulatorBusy} onClick={closeGpsOptions}>
                          <i className="fa-solid fa-arrow-left" aria-hidden="true"></i>
                        </button>
                        <span id="gps-dialog-title">Elegir punto de ubicación</span>
                        <span aria-hidden="true" />
                      </div>
                      <div className="gps-share-map-preview">
                        <div className="gps-radar-scanner">
                          <div className="radar-circle-1"></div>
                          <div className="radar-circle-2"></div>
                          <div className="radar-dot"></div>
                        </div>
                        <span className="gps-map-label">{gpsLabel}</span>
                      </div>
                      <div className="gps-share-options">
                        <button type="button" className="gps-option-item" disabled={!fieldSimulatorReady || fieldSimulatorBusy} onClick={useBrowserGps}>
                          <div className="gps-option-icon" style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--success)' }}><i className="fa-solid fa-location-crosshairs"></i></div>
                          <div className="gps-option-details">
                            <strong>Usar mi ubicación actual</strong>
                            <span>Solicita una lectura puntual al navegador y requiere tu permiso.</span>
                          </div>
                        </button>
                        <button type="button" className="gps-option-item" disabled={!fieldSimulatorReady || fieldSimulatorBusy || !projectPointAvailable} onClick={simulateProjectGps}>
                          <div className="gps-option-icon" style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--info)' }}><i className="fa-solid fa-building"></i></div>
                          <div className="gps-option-details">
                            <strong>Simular punto de obra</strong>
                            <span>{projectPointAvailable ? `Usa la latitud y longitud configuradas para ${displayProjectName}.` : 'Configurá primero la latitud y longitud de la obra.'}</span>
                          </div>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Waveform Controls */}
              <div className="glass-panel-premium dashboard-card-hover" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <h3 style={{ fontFamily: 'var(--font-heading)', color: 'var(--primary)' }}>Audios con transcripción de prueba</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  Cada escenario ya incluye una transcripción demostrativa. Al reproducirlo se registra como evidencia del actor seleccionado; no llama a OpenAI ni ejecuta comandos desde el audio.
                </p>

                {/* Audio 1 */}
                <div className="glass-panel-premium dashboard-card-hover" style={{ background: 'rgba(255, 255, 255, 0.01)', padding: '14px', marginBottom: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <strong style={{ fontSize: '0.85rem' }}><i className="fa-solid fa-clipboard-user" style={{ color: 'var(--success)' }}></i> Audio 1: Fichaje Diario (Ingreso)</strong>
                    <span className="badge badge-success">{selectedFieldWorker?.name || 'Actor pendiente'}</span>
                  </div>
                  <div className="audio-player-container">
                    <button type="button" className="play-btn" aria-label="Reproducir audio de prueba de ingreso" onClick={() => playAudioSim(1)} disabled={!fieldSimulatorReady || fieldSimulatorBusy}>
                      <i className={playingAudioIndex === 1 ? "fa-solid fa-microphone-lines fa-fade" : "fa-solid fa-play"} id="play-icon-1"></i>
                    </button>
                    <canvas ref={waveformRef1} width="200" height="40" className="waveform-canvas"></canvas>
                    <span className="audio-duration">0:08</span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '6px' }}>
                    Actor: {selectedFieldWorker?.name || 'pendiente'} · &ldquo;{WHATSAPP_DEMO_AUDIO_TRANSCRIPTS[1].text}&rdquo;
                  </p>
                </div>

                {/* Audio 2 */}
                <div className="glass-panel-premium dashboard-card-hover" style={{ background: 'rgba(255, 255, 255, 0.01)', padding: '14px', marginBottom: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <strong style={{ fontSize: '0.85rem' }}><i className="fa-solid fa-chart-line" style={{ color: 'var(--info)' }}></i> Audio 2: Reporte de Avance Diario</strong>
                    <span className="badge badge-info">{selectedFieldWorker?.name || 'Actor pendiente'}</span>
                  </div>
                  <div className="audio-player-container">
                    <button type="button" className="play-btn" aria-label="Reproducir audio de prueba de avance" onClick={() => playAudioSim(2)} disabled={!fieldSimulatorReady || fieldSimulatorBusy}>
                      <i className={playingAudioIndex === 2 ? "fa-solid fa-microphone-lines fa-fade" : "fa-solid fa-play"} id="play-icon-2"></i>
                    </button>
                    <canvas ref={waveformRef2} width="200" height="40" className="waveform-canvas"></canvas>
                    <span className="audio-duration">0:12</span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '6px' }}>
                    Actor: {selectedFieldWorker?.name || 'pendiente'} · &ldquo;{WHATSAPP_DEMO_AUDIO_TRANSCRIPTS[2].text}&rdquo;
                  </p>
                </div>

                {/* Audio 3 */}
                <div className="glass-panel-premium dashboard-card-hover" style={{ background: 'rgba(255, 255, 255, 0.01)', padding: '14px', marginBottom: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <strong style={{ fontSize: '0.85rem' }}><i className="fa-solid fa-triangle-exclamation" style={{ color: 'var(--danger)' }}></i> Audio 3: Incidencia Técnica Crítica</strong>
                    <span className="badge badge-danger">{selectedFieldWorker?.name || 'Actor pendiente'}</span>
                  </div>
                  <div className="audio-player-container">
                    <button type="button" className="play-btn" aria-label="Reproducir audio de prueba de incidencia" onClick={() => playAudioSim(3)} disabled={!fieldSimulatorReady || fieldSimulatorBusy}>
                      <i className={playingAudioIndex === 3 ? "fa-solid fa-microphone-lines fa-fade" : "fa-solid fa-play"} id="play-icon-3"></i>
                    </button>
                    <canvas ref={waveformRef3} width="200" height="40" className="waveform-canvas"></canvas>
                    <span className="audio-duration">0:16</span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '6px' }}>
                    Actor: {selectedFieldWorker?.name || 'pendiente'} · &ldquo;{WHATSAPP_DEMO_AUDIO_TRANSCRIPTS[3].text}&rdquo;
                  </p>
                </div>

                {/* Audio 4 */}
                <div className="glass-panel-premium dashboard-card-hover" style={{ background: 'rgba(255, 255, 255, 0.01)', padding: '14px', marginBottom: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <strong style={{ fontSize: '0.85rem' }}><i className="fa-solid fa-clock" style={{ color: 'var(--warning)' }}></i> Audio 4: Alerta de Retraso Crítico</strong>
                    <span className="badge badge-warning">{selectedFieldWorker?.name || 'Actor pendiente'}</span>
                  </div>
                  <div className="audio-player-container">
                    <button type="button" className="play-btn" aria-label="Reproducir audio de prueba de demora" onClick={() => playAudioSim(4)} disabled={!fieldSimulatorReady || fieldSimulatorBusy}>
                      <i className={playingAudioIndex === 4 ? "fa-solid fa-microphone-lines fa-fade" : "fa-solid fa-play"} id="play-icon-4"></i>
                    </button>
                    <canvas ref={waveformRef4} width="200" height="40" className="waveform-canvas"></canvas>
                    <span className="audio-duration">0:14</span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '6px' }}>
                    Actor: {selectedFieldWorker?.name || 'pendiente'} · &ldquo;{WHATSAPP_DEMO_AUDIO_TRANSCRIPTS[4].text}&rdquo;
                  </p>
                </div>

                {/* Sim Check-in */}
                <div className="glass-panel-premium dashboard-card-hover" style={{ background: 'rgba(255, 255, 255, 0.01)', padding: '14px', marginBottom: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <strong style={{ fontSize: '0.85rem' }}><i className="fa-solid fa-map-location-dot" style={{ color: '#60a5fa' }}></i> Probar control puntual por GPS</strong>
                    <span className="badge badge-info">{selectedFieldWorker?.name || 'Actor pendiente'}</span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    Elegí entre una lectura actual del navegador o el punto configurado de la obra. Ambas son lecturas únicas; no existe seguimiento continuo.
                  </p>
                  <button type="button" className="btn btn-primary btn-sm" disabled={!fieldSimulatorReady || fieldSimulatorBusy} onClick={openGpsOptions} style={{ width: '100%', fontSize: '0.8rem', padding: '10px', background: '#60a5fa', color: '#0a0e17', fontWeight: 700 }}>
                    <i className="fa-solid fa-location-arrow"></i> Elegir punto de ubicación
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 3: GANTT CHART */}
          <section id="sec-gantt" className={`content-section animate-fade-in-up ${activeTab === 'sec-gantt' ? 'active' : ''}`}>
            <GanttPlanner
              canManage={setup.canManageProjects}
              canonicalMode={Boolean(canonicalTaskCatalog)}
              fieldWorkers={fieldWorkers}
              onCanonicalTaskChange={handleCanonicalTaskChange}
              onCanonicalTaskDelete={handleCanonicalTaskDelete}
              onTasksChange={handleTasksChange}
              onToast={addToast}
              project={platformAccess.project}
              tasks={canonicalTaskCatalog || state.tasks}
            />
          </section>

          {/* SECTION 6: GESTION DE PERSONAL & RRHH */}
          <section id="sec-personal" className={`content-section animate-fade-in-up ${activeTab === 'sec-personal' ? 'active' : ''}`}>
            <div className="section-header">
              <div className="header-title">
                <h1>Gestión de Personal &amp; Recursos Humanos</h1>
                <p>Registros de asistencia, incentivos y licencias cargados para la cuadrilla activa.</p>
              </div>
              <div className="header-actions">
                <span className={`badge ${setup.canManageField && fieldWorkers.length > 0 ? 'badge-success' : 'badge-info'}`}><i className="fa-solid fa-users"></i> {setup.canManageField ? `${fieldWorkers.length} personas activas` : 'Modo consulta'}</span>
              </div>
            </div>

            <div className="grid-3">
              {/* Attendance insight based only on persisted counters. */}
              <div className="glass-panel-premium dashboard-card-hover" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '8px', color: 'var(--primary)' }}><i className="fa-solid fa-chart-simple"></i> Mayor asistencia registrada</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '20px' }}>
                    Comparación simple de los contadores disponibles. No evalúa desempeño, puntualidad ni calidad de trabajo.
                  </p>
                  {attendanceInsight ? (
                    <div style={{ background: 'rgba(255, 159, 28, 0.05)', border: '1px solid var(--primary)', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
                      <i className="fa-solid fa-user-check" style={{ color: 'var(--primary)', fontSize: '2rem', marginBottom: '12px' }}></i>
                      <h4 style={{ fontFamily: 'var(--font-heading)', color: '#fff', marginBottom: '4px' }}>{attendanceInsight.name}</h4>
                      <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase' }}>{attendanceInsight.role}</span>
                      <div style={{ marginTop: '15px', borderTop: '1px solid var(--border-color)', paddingTop: '12px', fontSize: '0.75rem' }}>
                        <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Asistencias acumuladas</span>
                        <strong style={{ color: 'var(--success)', fontSize: '1rem' }}>{attendanceInsight.presents}</strong>
                      </div>
                    </div>
                  ) : (
                    <div className="nocrit-msg" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '28px 12px' }}>
                      <i className="fa-solid fa-user-clock" style={{ display: 'block', fontSize: '1.8rem', marginBottom: '10px' }}></i>
                      No hay un registro suficiente y sin empates para mostrar este dato.
                    </div>
                  )}
                </div>
              </div>

              {/* Incentives / Bonuses */}
              <div className="glass-panel-premium dashboard-card-hover" style={{ display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '8px', color: 'var(--success)' }}><i className="fa-solid fa-gift"></i> Incentivos registrados</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '16px' }}>
                  Incentivos cargados para motivar el cumplimiento de plazos del cronograma.
                </p>
                
                <div style={{ flexGrow: 1, overflowY: 'auto', maxHeight: '180px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                  {state.hrBonuses.length === 0 && (
                    <div className="nocrit-msg" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 10px' }}>
                      No hay incentivos registrados.
                    </div>
                  )}
                  {state.hrBonuses.map((bonus, i) => (
                    <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', padding: '10px 14px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', color: '#fff' }}>{bonus.name}</span>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>{bonus.type}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '0.7rem', color: bonus.amount ? 'var(--success)' : 'var(--text-secondary)', fontWeight: 700, display: 'block' }}>{bonus.amount || 'Sin importe informado'}</span>
                        <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{bonus.date || 'Sin fecha informada'}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <select value={hrBonusAssignee} onChange={(e) => setHrBonusAssignee(e.target.value)} className="form-control" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: '8px', padding: '6px 10px', fontSize: '0.75rem', flexGrow: 1, width: '50%' }}>
                      <option value="">Seleccioná una persona</option>
                      {fieldWorkers.map((worker) => (
                        <option key={worker.id} value={worker.id}>{worker.name}</option>
                      ))}
                    </select>
                    <select value={hrBonusType} onChange={(e) => setHrBonusType(e.target.value)} className="form-control" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: '8px', padding: '6px 10px', fontSize: '0.75rem', flexGrow: 1, width: '50%' }}>
                      <option value="Bono de Puntualidad">Bono de puntualidad</option>
                      <option value="Reconocimiento de avance">Reconocimiento de avance</option>
                      <option value="Reconocimiento de presentismo">Reconocimiento de presentismo</option>
                    </select>
                  </div>
                  {fieldWorkers.length === 0 && (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', marginBottom: '8px' }}>
                      {setup.canManageField
                        ? <>Primero agregá una persona activa desde <Link href="/dashboard/team">Equipo y roles</Link>.</>
                        : 'Tu rol puede consultar estos registros, pero no asignar incentivos.'}
                    </p>
                  )}
                  <button className="btn btn-primary btn-sm" disabled={!setup.canManageProjects || !hrBonusAssignee || fieldWorkers.length === 0} onClick={handleAwardBonus} style={{ width: '100%', padding: '8px', fontSize: '0.75rem', fontWeight: 700, border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                    <i className="fa-solid fa-plus"></i> Registrar incentivo sin importe
                  </button>
                </div>
              </div>

              {/* Medical Licences */}
              <div className="glass-panel-premium dashboard-card-hover">
                <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '8px', color: 'var(--info)' }}><i className="fa-solid fa-notes-medical"></i> Registro manual de licencias</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '16px' }}>
                  Registrá solo la duración informada. No ingreses diagnósticos ni detalles clínicos: la bitácora operativa no debe almacenarlos.
                </p>
                
                <form onSubmit={handleSubmitMedicalCert} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Seleccionar Operario</label>
                    <select value={hrMedAssignee} onChange={(e) => setHrMedAssignee(e.target.value)} className="form-control" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: '8px', padding: '8px 12px', fontSize: '0.8rem', outline: 'none' }} required>
                      <option value="">Seleccioná una persona</option>
                      {fieldWorkers.map((worker) => (
                        <option key={worker.id} value={worker.id}>{worker.name}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Días informados</label>
                    <select value={hrMedDays} onChange={(e) => setHrMedDays(e.target.value)} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: '8px', padding: '8px 12px', fontSize: '0.8rem', outline: 'none' }}>
                      <option value="1 día">1 día</option>
                      <option value="2 días">2 días</option>
                      <option value="3 días">3 días</option>
                      <option value="5 días">5 días</option>
                    </select>
                  </div>
                  {fieldWorkers.length === 0 && (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', margin: 0 }}>
                      {setup.canManageField
                        ? <>Primero agregá una persona activa desde <Link href="/dashboard/team">Equipo y roles</Link>.</>
                        : 'Tu rol puede consultar estos registros, pero no registrar licencias.'}
                    </p>
                  )}
                  <button type="submit" disabled={!setup.canManageProjects || !hrMedAssignee || fieldWorkers.length === 0} className="btn btn-secondary" style={{ background: 'var(--info-bg)', border: '1px solid var(--info)', color: 'var(--info)', width: '100%', padding: '10px', fontSize: '0.8rem', fontWeight: 700, borderRadius: '8px', cursor: 'pointer' }}>
                    <i className="fa-solid fa-calendar-plus"></i> Registrar licencia manual
                  </button>
                </form>
              </div>
            </div>

            {/* Attendance History */}
            <div className="glass-panel-premium dashboard-card-hover" style={{ marginTop: '24px' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '12px', color: '#fff' }}><i className="fa-solid fa-calendar-check"></i> Historial de Presentismo &amp; Licencias de la Obra</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '10px' }}>Operario</th>
                      <th style={{ padding: '10px' }}>Rol</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Asistencias</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Faltas Justificadas</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Faltas Injustificadas</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Estado Actual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hrAttendanceEntries.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ padding: '24px 10px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                          No hay historial de presentismo o licencias registrado.
                        </td>
                      </tr>
                    )}
                    {hrAttendanceEntries.map(([key, item]) => {
                      const workerName = item.name || key;
                      const currentAttendance = attendanceRecordByName(
                        state.attendance,
                        item.workerId || workerName,
                      );
                      const currentStatus = attendanceStatus(currentAttendance?.entry);

                      let statusBadge = <span className="badge badge-info">Sin registro actual</span>;
                      if (currentStatus.startsWith('Presente')) {
                        statusBadge = <span className="badge badge-success">Presente</span>;
                      } else if (currentStatus.includes('Justificado')) {
                        statusBadge = <span className="badge badge-info">Licencia</span>;
                      } else if (currentStatus.includes('GPS pendiente')) {
                        statusBadge = <span className="badge badge-info">GPS pendiente</span>;
                      } else if (currentStatus.includes('Desvío')) {
                        statusBadge = <span className="badge badge-danger">Revisar GPS</span>;
                      } else if (currentStatus === 'Ausente') {
                        statusBadge = <span className="badge badge-warning">Ausente</span>;
                      }

                      return (
                        <tr key={item.workerId || key} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '10px' }}><strong>{workerName}</strong></td>
                          <td style={{ padding: '10px' }}>{item.role || 'Cuadrilla de obra'}</td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>{Number(item.presents) || 0}</td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>{Number(item.excused) || 0}</td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>{Number(item.unexcused) || 0}</td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>{statusBadge}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
      {/* Styled JSX for local overlay overrides */}
      <style dangerouslySetInnerHTML={{ __html: `
        .crm-suggestions {
            display: flex;
            gap: 8px;
            margin-top: 10px;
            flex-wrap: wrap;
        }
        .crm-suggest-tag {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--border-color);
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 0.7rem;
            color: var(--text-secondary);
            cursor: pointer;
            transition: var(--transition-smooth);
        }
        .crm-suggest-tag:hover {
            border-color: var(--primary);
            color: var(--text-primary);
        }
        .operational-approval-cta {
            display: grid;
            grid-template-columns: auto minmax(0, 1fr) auto;
            align-items: center;
            gap: 14px;
            margin-bottom: 22px;
            padding: 14px 16px;
            border: 1px solid color-mix(in srgb, var(--primary) 38%, transparent);
            border-radius: 15px;
            background:
                radial-gradient(circle at 96% 0, color-mix(in srgb, var(--primary) 14%, transparent), transparent 38%),
                var(--bg-surface);
            box-shadow: 0 18px 45px rgba(0, 0, 0, .16);
        }
        .operational-approval-cta__icon {
            display: grid;
            width: 42px;
            height: 42px;
            place-items: center;
            border: 1px solid color-mix(in srgb, var(--primary) 28%, transparent);
            border-radius: 12px;
            color: var(--primary);
            background: color-mix(in srgb, var(--primary) 10%, transparent);
        }
        .operational-approval-cta__copy {
            min-width: 0;
            display: grid;
            gap: 3px;
        }
        .operational-approval-cta__copy > span,
        .approval-onboarding-card__copy > span {
            color: var(--primary);
            font-size: .62rem;
            font-weight: 850;
            letter-spacing: .1em;
            text-transform: uppercase;
        }
        .operational-approval-cta__copy strong {
            overflow: hidden;
            font-size: .82rem;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .operational-approval-cta__copy small {
            color: var(--text-secondary);
            font-size: .66rem;
        }
        .operational-approval-cta > a,
        .approval-onboarding-card > button {
            min-height: 40px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 0 13px;
            border: 0;
            border-radius: 9px;
            color: #121822;
            background: var(--primary);
            font: inherit;
            font-size: .69rem;
            font-weight: 850;
            text-decoration: none;
            cursor: pointer;
        }
        .operational-approval-cta > a:focus-visible,
        .approval-onboarding-card > button:focus-visible {
            outline: 2px solid var(--text-primary);
            outline-offset: 3px;
        }
        .approval-onboarding-card {
            display: grid;
            grid-template-columns: auto minmax(0, 1fr) auto;
            align-items: center;
            gap: 16px;
            margin-bottom: 18px;
            padding: 16px;
            border: 1px solid color-mix(in srgb, var(--info) 30%, transparent);
            border-radius: 15px;
            background:
                linear-gradient(135deg, color-mix(in srgb, var(--info) 9%, transparent), transparent 52%),
                rgba(255, 255, 255, .025);
        }
        .approval-onboarding-card__step {
            display: grid;
            width: 42px;
            height: 42px;
            place-items: center;
            border: 1px solid color-mix(in srgb, var(--info) 32%, transparent);
            border-radius: 50%;
            color: var(--info);
            background: color-mix(in srgb, var(--info) 9%, transparent);
            font-size: .72rem;
            font-weight: 850;
        }
        .approval-onboarding-card__copy {
            min-width: 0;
            display: grid;
            gap: 4px;
        }
        .approval-onboarding-card__copy strong {
            font-family: var(--font-heading);
            font-size: .94rem;
        }
        .approval-onboarding-card__copy p {
            margin: 0;
            color: var(--text-secondary);
            font-size: .69rem;
            line-height: 1.5;
        }
        .approval-onboarding-card > button:disabled {
            cursor: not-allowed;
            filter: saturate(.45);
            opacity: .5;
        }
        .field-simulator-toolbar {
            display: grid;
            grid-template-columns: minmax(260px, .8fr) minmax(320px, 1.2fr);
            gap: 14px;
            align-items: stretch;
            margin-bottom: 18px;
            padding: 14px;
            border: 1px solid var(--border-color);
            border-radius: 14px;
            background: rgba(255, 255, 255, 0.025);
        }
        .field-simulator-actor {
            display: grid;
            gap: 6px;
        }
        .field-simulator-actor > span {
            color: var(--text-primary);
            font-size: .72rem;
            font-weight: 800;
        }
        .field-simulator-actor select {
            width: 100%;
            min-height: 42px;
            padding: 8px 10px;
            color: var(--text-primary);
            border: 1px solid var(--border-color);
            border-radius: 9px;
            background: #111827;
        }
        .field-simulator-actor small {
            color: var(--text-secondary);
            font-size: .65rem;
            line-height: 1.45;
        }
        .field-simulator-access {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 14px;
            padding: 12px 14px;
            border: 1px solid var(--border-color);
            border-radius: 11px;
            background: rgba(255, 255, 255, 0.025);
        }
        .field-simulator-access.is-ready {
            border-color: color-mix(in srgb, var(--success) 34%, transparent);
            background: color-mix(in srgb, var(--success) 8%, transparent);
        }
        .field-simulator-access.is-blocked {
            border-color: color-mix(in srgb, var(--warning) 28%, transparent);
        }
        .field-simulator-access > div {
            display: grid;
            gap: 4px;
        }
        .field-simulator-access strong {
            font-size: .76rem;
        }
        .field-simulator-access span {
            color: var(--text-secondary);
            font-size: .68rem;
            line-height: 1.45;
        }
        .field-simulator-access > a {
            flex: 0 0 auto;
            padding: 8px 10px;
            color: var(--on-primary);
            border-radius: 8px;
            background: var(--primary);
            font-size: .68rem;
            font-weight: 800;
            text-decoration: none;
        }
        .field-simulator-badge {
            padding: 5px 7px;
            color: var(--warning);
            border: 1px solid color-mix(in srgb, var(--warning) 28%, transparent);
            border-radius: 999px;
            font-size: .6rem;
            font-weight: 800;
        }
        .whatsapp-clip-btn {
            display: grid;
            place-items: center;
            width: 32px;
            height: 32px;
            flex: 0 0 32px;
            padding: 0;
            border: 0;
            background: transparent;
        }
        .whatsapp-clip-btn:disabled,
        .whatsapp-send-btn:disabled,
        .attachment-item:disabled,
        .gps-option-item:disabled {
            cursor: not-allowed;
            opacity: .48;
        }
        .attachment-item {
            min-width: 0;
            padding: 0;
            color: inherit;
            border: 0;
            background: transparent;
            font: inherit;
        }
        .gps-share-header button {
            width: 34px;
            height: 34px;
            padding: 0;
            color: var(--text-primary);
            border: 0;
            border-radius: 8px;
            background: transparent;
            cursor: pointer;
        }
        .gps-share-header > span:last-child {
            width: 34px;
        }
        .gps-option-item {
            width: 100%;
            color: inherit;
            font: inherit;
            text-align: left;
        }
        #map {
            height: 260px;
            width: 100%;
            border-radius: 12px;
            border: 1px solid var(--border-color);
            margin-bottom: 16px;
            z-index: 10;
        }
        .copilot-panel {
            display: flex;
            flex-direction: column;
            min-width: 0;
        }
        .copilot-heading {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 6px;
        }
        .copilot-heading h3 {
            display: flex;
            align-items: center;
            gap: 8px;
            margin: 2px 0 0;
            color: var(--primary);
            font-family: var(--font-heading);
        }
        .copilot-eyebrow {
            color: var(--text-secondary);
            font-size: 0.62rem;
            font-weight: 800;
            letter-spacing: 0.12em;
            text-transform: uppercase;
        }
        .copilot-scope-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            flex: 0 0 auto;
            padding: 5px 8px;
            border: 1px solid var(--border-color);
            border-radius: 999px;
            color: var(--text-secondary);
            background: rgba(255, 255, 255, 0.035);
            font-size: 0.64rem;
            font-weight: 700;
        }
        .copilot-scope-badge.is-live {
            color: var(--success);
            border-color: color-mix(in srgb, var(--success) 35%, transparent);
        }
        .copilot-scope-badge.is-empty {
            color: var(--warning);
            border-color: color-mix(in srgb, var(--warning) 35%, transparent);
        }
        .copilot-status-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: currentColor;
            box-shadow: 0 0 0 4px color-mix(in srgb, currentColor 12%, transparent);
        }
        .copilot-chat-box {
            display: flex;
            flex-direction: column;
            height: 320px;
            background: linear-gradient(180deg, rgba(8, 13, 19, 0.68), rgba(4, 8, 12, 0.42));
            border-radius: 12px;
            border: 1px solid var(--border-color);
            overflow: hidden;
            margin-bottom: 12px;
        }
        .copilot-chat-messages {
            flex-grow: 1;
            padding: 12px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 8px;
            font-size: 0.8rem;
        }
        .copilot-message {
            display: flex;
            flex-direction: column;
            gap: 8px;
            max-width: 92%;
            padding: 10px 12px;
            border-radius: 12px;
            color: var(--text-primary);
            line-height: 1.5;
        }
        .copilot-message.is-assistant {
            align-self: flex-start;
            background: rgba(255, 255, 255, 0.045);
            border: 1px solid rgba(255, 255, 255, 0.07);
            box-shadow: 0 8px 22px rgba(0, 0, 0, 0.12);
        }
        .copilot-message.is-user {
            align-self: flex-end;
            color: #fff;
            background: linear-gradient(135deg, color-mix(in srgb, var(--primary) 78%, #111), color-mix(in srgb, var(--primary) 55%, #111));
            border-bottom-right-radius: 4px;
        }
        .copilot-message.is-error {
            border-color: color-mix(in srgb, var(--danger) 38%, transparent);
            background: color-mix(in srgb, var(--danger) 10%, transparent);
        }
        .copilot-message-text {
            white-space: pre-wrap;
        }
        .copilot-answer-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            padding-top: 7px;
            border-top: 1px solid var(--border-color);
        }
        .copilot-answer-meta span {
            padding: 3px 6px;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.05);
            color: var(--text-secondary);
            font-size: 0.62rem;
            font-weight: 700;
        }
        .copilot-evidence {
            color: var(--text-secondary);
            font-size: 0.72rem;
        }
        .copilot-evidence summary {
            display: flex;
            align-items: center;
            gap: 6px;
            color: var(--primary);
            cursor: pointer;
            font-weight: 700;
        }
        .copilot-evidence ul {
            margin: 8px 0 0;
            padding-left: 18px;
        }
        .copilot-evidence li + li {
            margin-top: 5px;
        }
        .copilot-limitations {
            display: flex;
            gap: 7px;
            padding: 8px;
            border-radius: 8px;
            background: color-mix(in srgb, var(--warning) 8%, transparent);
            color: var(--text-secondary);
            font-size: 0.7rem;
        }
        .copilot-limitations i {
            color: var(--warning);
            margin-top: 2px;
        }
        .copilot-action-btn {
            display: grid;
            grid-template-columns: auto 1fr;
            gap: 2px 8px;
            align-items: center;
            width: 100%;
            padding: 9px 10px;
            border: 1px solid color-mix(in srgb, var(--success) 32%, transparent);
            border-radius: 8px;
            color: var(--text-primary);
            background: color-mix(in srgb, var(--success) 10%, transparent);
            cursor: pointer;
            font: inherit;
            font-weight: 750;
            text-align: left;
        }
        .copilot-action-btn i {
            grid-row: 1 / span 2;
            color: var(--success);
        }
        .copilot-action-btn span {
            color: var(--text-secondary);
            font-size: 0.62rem;
            font-weight: 600;
        }
        .copilot-action-btn:disabled {
            cursor: not-allowed;
            opacity: 0.52;
        }
        .copilot-message.is-loading {
            flex-direction: row;
            align-items: center;
            color: var(--text-secondary);
        }
        .copilot-thinking {
            display: inline-flex;
            gap: 3px;
        }
        .copilot-thinking i {
            width: 5px;
            height: 5px;
            border-radius: 50%;
            background: var(--primary);
            animation: copilot-bounce 1.1s infinite ease-in-out;
        }
        .copilot-thinking i:nth-child(2) { animation-delay: 0.14s; }
        .copilot-thinking i:nth-child(3) { animation-delay: 0.28s; }
        .copilot-chat-input-container {
            display: flex;
            border-top: 1px solid var(--border-color);
        }
        .copilot-chat-input {
            flex-grow: 1;
            background: transparent;
            border: none;
            padding: 8px 12px;
            color: #fff;
            font-size: 0.8rem;
            outline: none;
        }
        .copilot-chat-input:disabled {
            opacity: 0.65;
        }
        .copilot-chat-btn {
            background: var(--primary);
            color: var(--on-primary);
            border: none;
            padding: 0 12px;
            cursor: pointer;
            font-weight: 600;
            font-size: 0.8rem;
        }
        .copilot-chat-btn:disabled {
            cursor: not-allowed;
            filter: saturate(0.45);
            opacity: 0.58;
        }
        .copilot-suggestions {
            margin-top: 0;
        }
        .copilot-suggestions .crm-suggest-tag {
            font: inherit;
        }
        .copilot-suggestions .crm-suggest-tag:disabled {
            cursor: not-allowed;
            opacity: 0.48;
        }
        @keyframes copilot-bounce {
            0%, 60%, 100% { transform: translateY(0); opacity: 0.45; }
            30% { transform: translateY(-3px); opacity: 1; }
        }

        @media (max-width: 640px) {
            .operational-approval-cta,
            .approval-onboarding-card {
                grid-template-columns: auto minmax(0, 1fr);
                align-items: start;
            }
            .operational-approval-cta > a,
            .approval-onboarding-card > button {
                grid-column: 1 / -1;
                width: 100%;
            }
            .operational-approval-cta__copy strong {
                white-space: normal;
            }
            .field-simulator-toolbar {
                grid-template-columns: 1fr;
            }
            .field-simulator-access {
                align-items: flex-start;
                flex-direction: column;
            }
            .copilot-heading {
                align-items: flex-start;
                flex-direction: column;
            }
            .copilot-chat-box {
                height: 360px;
            }
            .copilot-chat-btn {
                padding-inline: 10px;
            }
        }

        /* Responsive Layout Overrides for Print Mode */
        @media print {
            body.print-report-mode .app-container,
            body.print-report-mode .mobile-header,
            .no-print {
                display: none !important;
            }
            body.print-report-mode #weekly-report-print-area {
                display: block !important;
                position: absolute;
                left: 0;
                top: 0;
                width: 100% !important;
                max-width: 100% !important;
                background: #fff !important;
                color: #000 !important;
                padding: 0 !important;
                box-shadow: none !important;
                border: none !important;
                z-index: 99999 !important;
            }
            body {
                background: #fff !important;
                color: #000 !important;
            }
            /* Reset dark theme CSS variables during printing */
            :root {
                --bg-main: #fff !important;
                --text-primary: #000 !important;
                --border-color: #e2e8f0 !important;
            }
        }
      ` }} />
    </>
  );
}
