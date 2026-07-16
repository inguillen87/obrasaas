export const OPERATIONAL_PROJECT_WRITE_STATUSES = Object.freeze([
  'PLANNING',
  'ACTIVE',
  'PAUSED',
]);

const OPERATIONAL_PROJECT_WRITE_STATUS_SET = new Set(
  OPERATIONAL_PROJECT_WRITE_STATUSES,
);

export class ProjectWritePolicyError extends Error {
  constructor(message, {
    code = 'PROJECT_WRITE_FORBIDDEN',
    status = 409,
    projectStatus = null,
  } = {}) {
    super(message);
    this.name = 'ProjectWritePolicyError';
    this.code = code;
    this.status = status;
    this.projectStatus = projectStatus;
  }
}

function trustedProjectWriteScope(scope) {
  const organizationId = typeof scope?.organizationId === 'string'
    ? scope.organizationId.trim()
    : '';
  const projectId = typeof scope?.projectId === 'string'
    ? scope.projectId.trim()
    : '';
  if (!organizationId || !projectId) {
    throw new ProjectWritePolicyError(
      'La obra ya no está disponible dentro de la organización activa.',
      { code: 'PROJECT_WRITE_SCOPE_INVALID', status: 403 },
    );
  }
  return { organizationId, projectId };
}

export function isOperationalProjectWriteStatus(status) {
  return OPERATIONAL_PROJECT_WRITE_STATUS_SET.has(status);
}

export async function lockProjectTransaction(transaction, projectId) {
  await transaction.$executeRawUnsafe(
    'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
    projectId,
  );
}

function readOnlyProjectError(status) {
  const action = status === 'ARCHIVED' ? 'restaurarla' : 'reabrirla';
  const state = status === 'ARCHIVED' ? 'archivada' : 'finalizada';
  return new ProjectWritePolicyError(
    `La obra está ${state} y quedó en modo solo lectura. Tenés que ${action} antes de guardar cambios.`,
    {
      code: 'PROJECT_READ_ONLY',
      status: 409,
      projectStatus: status,
    },
  );
}

export async function requireOperationalProjectWrite(transaction, scope) {
  const trustedScope = trustedProjectWriteScope(scope);
  await lockProjectTransaction(transaction, trustedScope.projectId);
  const project = await transaction.project.findFirst({
    where: {
      id: trustedScope.projectId,
      organizationId: trustedScope.organizationId,
    },
    select: {
      id: true,
      organizationId: true,
      status: true,
    },
  });
  if (!project) {
    throw new ProjectWritePolicyError(
      'La obra ya no está disponible dentro de la organización activa.',
      { code: 'PROJECT_WRITE_SCOPE_INVALID', status: 403 },
    );
  }
  if (!isOperationalProjectWriteStatus(project.status)) {
    throw readOnlyProjectError(project.status);
  }
  return project;
}

export async function runOperationalProjectMutation(
  prisma,
  scope,
  operation,
  { attempts = 3, transactionOptions = { isolationLevel: 'Serializable' } } = {},
) {
  if (typeof operation !== 'function') {
    throw new TypeError('An operational project mutation callback is required.');
  }
  const maxAttempts = Math.max(1, Math.trunc(Number(attempts) || 1));
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await prisma.$transaction(async (transaction) => {
        const project = await requireOperationalProjectWrite(transaction, scope);
        return operation(transaction, project);
      }, transactionOptions);
    } catch (error) {
      if (error?.code !== 'P2034' || attempt === maxAttempts) throw error;
    }
  }
  throw new Error('Operational project mutation retry loop exhausted.');
}

export function projectWritePolicyErrorResponse(error) {
  if (!(error instanceof ProjectWritePolicyError)) return null;
  return Response.json({
    error: error.message,
    code: error.code,
    ...(error.projectStatus ? { projectStatus: error.projectStatus } : {}),
  }, { status: error.status });
}
