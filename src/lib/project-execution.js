import { runOperationalProjectMutation } from './project-write-policy.js';
import { enqueueNotification } from './notification-outbox.js';

const TEAM_STATUSES = new Set(['ACTIVE', 'ARCHIVED']);
const MEMBER_ROLES = new Set(['LEAD', 'MEMBER']);
const ASSIGNMENT_STATUSES = new Set(['PLANNED', 'ACTIVE', 'ENDED', 'CANCELLED']);
const BLOCKER_STATUSES = new Set(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED']);
const BLOCKER_SEVERITIES = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

export class ProjectExecutionError extends Error {
  constructor(message, code = 'PROJECT_EXECUTION_INVALID', status = 400, details = null) {
    super(message);
    this.name = 'ProjectExecutionError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function text(value, field, max, required = true) {
  if ((value === null || value === undefined || value === '') && !required) return null;
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new ProjectExecutionError(`${field} no cumple los límites de formato.`);
  }
  return value.trim();
}

function date(value, field, required = false) {
  if (value === null || value === undefined || value === '') {
    if (!required) return null;
    throw new ProjectExecutionError(`${field} es obligatorio.`);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new ProjectExecutionError(`${field} no es una fecha válida.`);
  return parsed;
}

function revision(value) {
  const parsed = Number(value ?? 0);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new ProjectExecutionError('expectedRevision inválida.');
  return parsed;
}

function scopeOf(scope) {
  return {
    organizationId: text(scope?.organizationId, 'organizationId', 190),
    projectId: text(scope?.projectId, 'projectId', 190),
  };
}

function actorOf(actorId) { return text(actorId, 'actorId', 190); }

function serializeTeam(team) {
  return {
    id: team.id, projectId: team.projectId, code: team.code || null, name: team.name,
    status: team.status, revision: team.revision,
    members: (team.members || []).map((member) => ({
      id: member.id, workerId: member.workerId, role: member.role,
      startsAt: member.startsAt?.toISOString?.() || null, endsAt: member.endsAt?.toISOString?.() || null,
    })),
    createdAt: team.createdAt?.toISOString?.() || null,
    updatedAt: team.updatedAt?.toISOString?.() || null,
  };
}

function serializeAssignment(assignment) {
  return {
    id: assignment.id, projectId: assignment.projectId, taskId: assignment.taskId,
    workerId: assignment.workerId || null, teamId: assignment.teamId || null,
    status: assignment.status, startsAt: assignment.startsAt?.toISOString?.() || null,
    endsAt: assignment.endsAt?.toISOString?.() || null, revision: assignment.revision,
  };
}

function serializeBlocker(blocker) {
  return {
    id: blocker.id, projectId: blocker.projectId, taskId: blocker.taskId || null,
    ownerWorkerId: blocker.ownerWorkerId || null, ownerTeamId: blocker.ownerTeamId || null,
    title: blocker.title, description: blocker.description || null, severity: blocker.severity,
    status: blocker.status, dueAt: blocker.dueAt?.toISOString?.() || null,
    resolvedAt: blocker.resolvedAt?.toISOString?.() || null, resolution: blocker.resolution || null,
    revision: blocker.revision, createdAt: blocker.createdAt?.toISOString?.() || null,
    updatedAt: blocker.updatedAt?.toISOString?.() || null,
  };
}

const TEAM_INCLUDE = { members: { orderBy: { startsAt: 'asc' }, select: { id: true, workerId: true, role: true, startsAt: true, endsAt: true } } };
const ASSIGNMENT_SELECT = { id: true, projectId: true, taskId: true, workerId: true, teamId: true, status: true, startsAt: true, endsAt: true, revision: true };
const BLOCKER_SELECT = { id: true, projectId: true, taskId: true, ownerWorkerId: true, ownerTeamId: true, title: true, description: true, severity: true, status: true, dueAt: true, resolvedAt: true, resolution: true, revision: true, createdAt: true, updatedAt: true };

export async function listProjectExecution(prisma, { projectId }) {
  const safeProjectId = text(projectId, 'projectId', 190);
  const [teams, assignments, blockers] = await Promise.all([
    prisma.workTeam.findMany({ where: { projectId: safeProjectId }, orderBy: [{ status: 'asc' }, { name: 'asc' }], include: TEAM_INCLUDE }),
    prisma.taskAssignment.findMany({ where: { projectId: safeProjectId }, orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], select: ASSIGNMENT_SELECT }),
    prisma.projectBlocker.findMany({ where: { projectId: safeProjectId }, orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { createdAt: 'desc' }], select: BLOCKER_SELECT }),
  ]);
  return { teams: teams.map(serializeTeam), assignments: assignments.map(serializeAssignment), blockers: blockers.map(serializeBlocker) };
}

export async function createExecutionRecord(prisma, { scope: scopeInput, actorId, input } = {}) {
  const scope = scopeOf(scopeInput); const actor = actorOf(actorId);
  const kind = text(input?.kind, 'kind', 32);
  return runOperationalProjectMutation(prisma, scope, async (tx) => {
    if (kind === 'TEAM') {
      const name = text(input.name, 'name', 160); const code = text(input.code, 'code', 64, false);
      const team = await tx.workTeam.create({ data: { projectId: scope.projectId, name, code }, include: TEAM_INCLUDE });
      await tx.auditLog.create({ data: { organizationId: scope.organizationId, actorId: actor, action: 'execution.team.created', entityType: 'WorkTeam', entityId: team.id, metadata: { projectId: scope.projectId, name: team.name, code: team.code } } });
      return { kind, team: serializeTeam(team) };
    }
    if (kind === 'TEAM_MEMBER') {
      const teamId = text(input.teamId, 'teamId', 190); const workerId = text(input.workerId, 'workerId', 190);
      const role = String(input.role || 'MEMBER'); if (!MEMBER_ROLES.has(role)) throw new ProjectExecutionError('Rol de miembro inválido.');
      const startsAt = date(input.startsAt, 'startsAt') || new Date(); const endsAt = date(input.endsAt, 'endsAt');
      if (endsAt && endsAt < startsAt) throw new ProjectExecutionError('endsAt no puede preceder a startsAt.');
      const [team, worker] = await Promise.all([
        tx.workTeam.findFirst({ where: { id: teamId, projectId: scope.projectId, status: 'ACTIVE' }, select: { id: true } }),
        tx.worker.findFirst({ where: { id: workerId, projectId: scope.projectId, active: true }, select: { id: true } }),
      ]);
      if (!team || !worker) throw new ProjectExecutionError('Equipo o persona fuera del alcance de la obra.', 'PROJECT_EXECUTION_SCOPE', 409);
      const activeMembership = await tx.workTeamMember.findFirst({ where: { projectId: scope.projectId, teamId, workerId, endsAt: null }, select: { id: true } });
      if (activeMembership) throw new ProjectExecutionError('La persona ya pertenece al equipo activo.', 'PROJECT_TEAM_MEMBER_DUPLICATE', 409);
      const member = await tx.workTeamMember.create({ data: { projectId: scope.projectId, teamId, workerId, role, startsAt, endsAt } });
      await tx.auditLog.create({ data: { organizationId: scope.organizationId, actorId: actor, action: 'execution.team.member.added', entityType: 'WorkTeamMember', entityId: member.id, metadata: { projectId: scope.projectId, teamId, workerId, role } } });
      return { kind, member: { id: member.id, teamId, workerId, role, startsAt: startsAt.toISOString(), endsAt: endsAt?.toISOString() || null } };
    }
    if (kind === 'ASSIGNMENT') {
      const taskId = text(input.taskId, 'taskId', 190); const workerId = text(input.workerId, 'workerId', 190, false); const teamId = text(input.teamId, 'teamId', 190, false);
      if (!workerId && !teamId) throw new ProjectExecutionError('La asignación debe tener persona o equipo.');
      const status = String(input.status || 'PLANNED'); if (!ASSIGNMENT_STATUSES.has(status)) throw new ProjectExecutionError('Estado de asignación inválido.');
      const startsAt = date(input.startsAt, 'startsAt'); const endsAt = date(input.endsAt, 'endsAt');
      if (startsAt && endsAt && endsAt < startsAt) throw new ProjectExecutionError('endsAt no puede preceder a startsAt.');
      const task = await tx.task.findFirst({ where: { id: taskId, projectId: scope.projectId, metadata: { path: ['source'], equals: 'canonical-task-v1' } }, select: { id: true } });
      if (!task) throw new ProjectExecutionError('La tarea debe ser canónica y pertenecer a la obra.', 'PROJECT_EXECUTION_TASK_SCOPE', 409);
      const [worker, team] = await Promise.all([
        workerId ? tx.worker.findFirst({ where: { id: workerId, projectId: scope.projectId, active: true }, select: { id: true } }) : null,
        teamId ? tx.workTeam.findFirst({ where: { id: teamId, projectId: scope.projectId, status: 'ACTIVE' }, select: { id: true } }) : null,
      ]);
      if (workerId && !worker || teamId && !team) throw new ProjectExecutionError('El responsable de la asignación está fuera del alcance.', 'PROJECT_EXECUTION_SCOPE', 409);
      const assignment = await tx.taskAssignment.create({ data: { projectId: scope.projectId, taskId, workerId, teamId, status, startsAt, endsAt }, select: ASSIGNMENT_SELECT });
      await tx.auditLog.create({ data: { organizationId: scope.organizationId, actorId: actor, action: 'execution.task.assignment.created', entityType: 'TaskAssignment', entityId: assignment.id, metadata: { projectId: scope.projectId, taskId, workerId, teamId, status } } });
      return { kind, assignment: serializeAssignment(assignment) };
    }
    if (kind === 'BLOCKER') {
      const title = text(input.title, 'title', 220); const description = text(input.description, 'description', 4000, false);
      const severity = String(input.severity || 'MEDIUM'); const status = String(input.status || 'OPEN');
      if (!BLOCKER_SEVERITIES.has(severity) || !BLOCKER_STATUSES.has(status)) throw new ProjectExecutionError('Severidad o estado del blocker inválido.');
      const taskId = text(input.taskId, 'taskId', 190, false); const ownerWorkerId = text(input.ownerWorkerId, 'ownerWorkerId', 190, false); const ownerTeamId = text(input.ownerTeamId, 'ownerTeamId', 190, false);
      const dueAt = date(input.dueAt, 'dueAt');
      if (!ownerWorkerId && !ownerTeamId) throw new ProjectExecutionError('El blocker debe tener una persona o cuadrilla responsable.');
      if (status === 'RESOLVED') throw new ProjectExecutionError('Un blocker nuevo no puede nacer resuelto.');
      if (taskId) {
        const task = await tx.task.findFirst({ where: { id: taskId, projectId: scope.projectId, metadata: { path: ['source'], equals: 'canonical-task-v1' } }, select: { id: true } });
        if (!task) throw new ProjectExecutionError('La tarea del blocker está fuera del alcance.', 'PROJECT_EXECUTION_TASK_SCOPE', 409);
      }
      const [ownerWorker, ownerTeam] = await Promise.all([
        ownerWorkerId ? tx.worker.findFirst({ where: { id: ownerWorkerId, projectId: scope.projectId, active: true }, select: { id: true } }) : null,
        ownerTeamId ? tx.workTeam.findFirst({ where: { id: ownerTeamId, projectId: scope.projectId, status: 'ACTIVE' }, select: { id: true } }) : null,
      ]);
      if (ownerWorkerId && !ownerWorker || ownerTeamId && !ownerTeam) throw new ProjectExecutionError('El owner del blocker está fuera del alcance de la obra.', 'PROJECT_EXECUTION_OWNER_SCOPE', 409);
      const blocker = await tx.projectBlocker.create({ data: { projectId: scope.projectId, taskId, ownerWorkerId, ownerTeamId, title, description, severity, status, dueAt }, select: BLOCKER_SELECT });
      await tx.auditLog.create({ data: { organizationId: scope.organizationId, actorId: actor, action: 'execution.blocker.created', entityType: 'ProjectBlocker', entityId: blocker.id, metadata: { projectId: scope.projectId, taskId, severity, ownerWorkerId, ownerTeamId } } });
      if (['HIGH', 'CRITICAL'].includes(severity)) {
        const recipients = await tx.projectMembership.findMany({ where: { projectId: scope.projectId, status: 'ACTIVE' }, select: { tenantMembership: { select: { userId: true } } } });
        for (const recipient of recipients) await enqueueNotification(tx, { organizationId: scope.organizationId, projectId: scope.projectId, recipientId: recipient.tenantMembership.userId, eventKey: `blocker:${blocker.id}`, channel: 'IN_APP', title: `Blocker ${severity.toLowerCase()}`, body: blocker.title, payload: { blockerId: blocker.id, severity, taskId } });
      }
      return { kind, blocker: serializeBlocker(blocker) };
    }
    throw new ProjectExecutionError('Tipo de registro de ejecución inválido.');
  });
}

export async function updateProjectBlocker(prisma, { scope: scopeInput, actorId, blockerId, expectedRevision, input } = {}) {
  const scope = scopeOf(scopeInput); const actor = actorOf(actorId); const id = text(blockerId, 'blockerId', 190); const expected = revision(expectedRevision);
  const data = {};
  if (input?.title !== undefined) data.title = text(input.title, 'title', 220);
  if (input?.description !== undefined) data.description = text(input.description, 'description', 4000, false);
  if (input?.severity !== undefined) { data.severity = String(input.severity); if (!BLOCKER_SEVERITIES.has(data.severity)) throw new ProjectExecutionError('Severidad inválida.'); }
  if (input?.status !== undefined) { data.status = String(input.status); if (!BLOCKER_STATUSES.has(data.status)) throw new ProjectExecutionError('Estado inválido.'); }
  if (input?.dueAt !== undefined) data.dueAt = date(input.dueAt, 'dueAt');
  if (data.status === 'RESOLVED') { data.resolvedAt = new Date(); data.resolution = text(input.resolution, 'resolution', 4000); }
  if (data.status && data.status !== 'RESOLVED') { data.resolvedAt = null; data.resolution = null; }
  return runOperationalProjectMutation(prisma, scope, async (tx) => {
    const result = await tx.projectBlocker.updateMany({ where: { id, projectId: scope.projectId, revision: expected }, data: { ...data, revision: { increment: 1 } } });
    if (result.count !== 1) throw new ProjectExecutionError('El blocker cambió; recargá y reintentá.', 'PROJECT_BLOCKER_STALE', 409);
    const blocker = await tx.projectBlocker.findFirst({ where: { id, projectId: scope.projectId }, select: BLOCKER_SELECT });
    await tx.auditLog.create({ data: { organizationId: scope.organizationId, actorId: actor, action: 'execution.blocker.updated', entityType: 'ProjectBlocker', entityId: id, metadata: { projectId: scope.projectId, revision: expected + 1, status: blocker.status } } });
    return serializeBlocker(blocker);
  });
}

export function projectExecutionErrorResponse(error) {
  if (!(error instanceof ProjectExecutionError)) return null;
  return Response.json({ error: error.message, code: error.code, ...(error.details ? { details: error.details } : {}) }, { status: error.status });
}
