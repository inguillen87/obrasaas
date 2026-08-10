export const CANONICAL_OPERATIONAL_TASK_SOURCE = 'canonical-task-v1';
export const LEGACY_OPERATIONAL_TASK_SOURCE = 'project-snapshot-v1';

export const OPERATIONAL_TASK_AUTHORITIES = Object.freeze({
  CANONICAL: 'CANONICAL',
  LEGACY: 'LEGACY',
});

const MAX_OPERATIONAL_TASKS = 500;

const CANONICAL_OPERATIONAL_TASK_SELECT = Object.freeze({
  id: true,
  title: true,
  description: true,
  status: true,
  progress: true,
  revision: true,
  metadata: true,
});

function trustedTaskScope(scope) {
  const projectId = String(scope?.projectId || '').trim();
  const organizationId = String(scope?.organizationId || '').trim();
  if (!projectId || !organizationId) {
    throw new Error('A trusted organization and project are required to read operational tasks.');
  }
  return { projectId, organizationId };
}

function boundedCount(value) {
  const count = Number(value);
  return Number.isSafeInteger(count) && count > 0 ? count : 0;
}

export function canonicalFirstTaskCount({
  canonicalCount = 0,
  legacyCount = 0,
} = {}) {
  const canonical = boundedCount(canonicalCount);
  if (canonical > 0) {
    return {
      authority: OPERATIONAL_TASK_AUTHORITIES.CANONICAL,
      count: canonical,
    };
  }
  return {
    authority: OPERATIONAL_TASK_AUTHORITIES.LEGACY,
    count: boundedCount(legacyCount),
  };
}

export function canonicalFirstTaskRows({
  canonicalRows = [],
  legacyRows = [],
} = {}) {
  const canonical = Array.isArray(canonicalRows) ? canonicalRows : [];
  if (canonical.length > 0) {
    return {
      authority: OPERATIONAL_TASK_AUTHORITIES.CANONICAL,
      rows: canonical.slice(0, MAX_OPERATIONAL_TASKS),
    };
  }
  return {
    authority: OPERATIONAL_TASK_AUTHORITIES.LEGACY,
    rows: (Array.isArray(legacyRows) ? legacyRows : []).slice(0, MAX_OPERATIONAL_TASKS),
  };
}

export async function listCanonicalOperationalTaskRows(prisma, scope, {
  limit = MAX_OPERATIONAL_TASKS,
} = {}) {
  const { projectId, organizationId } = trustedTaskScope(scope);
  const take = Math.min(
    MAX_OPERATIONAL_TASKS,
    Math.max(1, Math.trunc(Number(limit) || MAX_OPERATIONAL_TASKS)),
  );
  return prisma.task.findMany({
    where: {
      projectId,
      project: { organizationId },
      metadata: { path: ['source'], equals: CANONICAL_OPERATIONAL_TASK_SOURCE },
    },
    orderBy: [{ title: 'asc' }, { id: 'asc' }],
    take,
    select: CANONICAL_OPERATIONAL_TASK_SELECT,
  });
}

export async function findCanonicalOperationalTaskRow(prisma, scope, taskId) {
  const { projectId, organizationId } = trustedTaskScope(scope);
  const id = typeof taskId === 'string' ? taskId.trim() : '';
  if (!id || id !== taskId || id.length > 190 || /[\u0000-\u001f\u007f]/.test(id)) {
    return null;
  }
  return prisma.task.findFirst({
    where: {
      id,
      projectId,
      project: { organizationId },
      metadata: { path: ['source'], equals: CANONICAL_OPERATIONAL_TASK_SOURCE },
    },
    select: CANONICAL_OPERATIONAL_TASK_SELECT,
  });
}
