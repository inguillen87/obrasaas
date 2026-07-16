import { randomUUID } from 'node:crypto';

import { prependUniqueEventIncident } from './whatsapp/obra-policy.js';

export const DEFAULT_OPERATIONAL_TIME_ZONE = 'America/Argentina/Buenos_Aires';

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function trustedOperationalTimeZone(value) {
  const candidate = String(value || '').trim();
  if (!candidate) return DEFAULT_OPERATIONAL_TIME_ZONE;
  try {
    new Intl.DateTimeFormat('en', { timeZone: candidate }).format(0);
    return candidate;
  } catch {
    return DEFAULT_OPERATIONAL_TIME_ZONE;
  }
}

export function ensureOperationalStateCollections(state) {
  state.attendance ||= {};
  state.incidents ||= [];
  state.tasks ||= {};
  state.alertsCount ||= 0;
  return state;
}

export function selectOperationalTask(state, text) {
  const normalizedText = normalize(text);
  const explicitId = normalizedText.match(/(?:tarea|task)\s*#?([0-9]+)/)?.[1];
  if (explicitId && state.tasks[explicitId]) return [explicitId, state.tasks[explicitId]];

  const entries = Object.entries(state.tasks || {});
  const exactNameMatches = entries.filter(([, task]) => {
    const taskName = normalize(task?.name).trim();
    return taskName.length >= 3 && normalizedText.includes(taskName);
  });
  if (exactNameMatches.length === 1) return exactNameMatches[0];
  if (exactNameMatches.length > 1) return [null, null];

  const wordMatches = entries.filter(([, task]) => {
    const significantWords = normalize(task?.name)
      .split(/\s+/)
      .filter((word) => word.length >= 5);
    return significantWords.some((word) => normalizedText.includes(word));
  });
  return wordMatches.length === 1 ? wordMatches[0] : [null, null];
}

export function recalculateOverallProgress(state) {
  const tasks = Object.values(state.tasks || {});
  const nextProgress = tasks.length === 0
    ? 0
    : Math.round(tasks.reduce((total, task) => (
        total + Math.max(0, Math.min(100, Number(task?.progress) || 0))
      ), 0) / tasks.length);
  const changed = Number(state.avancePercentage) !== nextProgress;
  state.avancePercentage = nextProgress;
  return changed;
}

export function appendOperationalIncident(state, event, {
  title,
  description,
  type,
  badge,
  reporter,
  icon,
  now,
  evidence,
  sensitivity,
  metadata,
  timeZone = DEFAULT_OPERATIONAL_TIME_ZONE,
}) {
  return prependUniqueEventIncident(
    state.incidents,
    event?.externalId,
    {
      id: `inc-${randomUUID()}`,
      title,
      description,
      type,
      badge,
      timestamp: new Intl.DateTimeFormat('es-AR', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: trustedOperationalTimeZone(timeZone),
      }).format(now),
      reporter,
      icon,
      ...(evidence ? { evidence } : {}),
      ...(sensitivity ? { sensitivity } : {}),
      ...(metadata ? { metadata } : {}),
    },
  );
}
