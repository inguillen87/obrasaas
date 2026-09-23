import { createHash } from 'node:crypto';
import { assignmentId, TaskAssignmentError } from './task-assignment-policy.js';
import { normalizeOwnerSearch, OWNER_PAGE_SIZE } from './assignment-owner-directory-policy.js';

const invalidCursor = () => new TaskAssignmentError('La página no corresponde a esta búsqueda. Volvé a la primera página.', 'ASSIGNMENT_DIRECTORY_CURSOR_INVALID');
const bindingFor = (scope, request) => createHash('sha256').update(JSON.stringify([
  scope.organizationId, scope.projectId, request.taskId, request.expectedTaskRevision, request.ownerKind, request.query,
])).digest('hex');
function decodeCursor(cursor, binding) {
  if (!cursor) return null;
  try {
    const raw = Buffer.from(cursor, 'base64url');
    if (raw.toString('base64url') !== cursor) throw invalidCursor();
    const parsed = JSON.parse(raw.toString('utf8'));
    if (!parsed || Object.keys(parsed).sort().join(',') !== 'binding,id,name,v' || parsed.v !== 1
      || parsed.binding !== binding || typeof parsed.name !== 'string' || !parsed.name.trim() || parsed.name.length > 500) throw invalidCursor();
    assignmentId(parsed.id);
    return { name: parsed.name, id: parsed.id };
  } catch { throw invalidCursor(); }
}
// The cursor is a pagination hint, not a credential. Every page repeats tenant,
// worksite and task validation. Client-modified hints never replace that scope.
export async function listAssignmentOwners(prisma, { scope: rawScope, input }) {
  const scope = { organizationId: assignmentId(rawScope?.organizationId), projectId: assignmentId(rawScope?.projectId) };
  const request = normalizeOwnerSearch(input), binding = bindingFor(scope, request);
  const after = decodeCursor(request.cursor, binding);
  return prisma.$transaction(async tx => {
    const project = await tx.project.findFirst({ where: { id: scope.projectId, organizationId: scope.organizationId }, select: { id: true } });
    if (!project) throw new TaskAssignmentError('La obra no está disponible.', 'ASSIGNMENT_PROJECT_MISSING', 404);
    const task = await tx.task.findFirst({ where: { id: request.taskId, projectId: scope.projectId, type: 'TASK', metadata: { path: ['source'], equals: 'canonical-task-v1' } }, select: { id: true, revision: true } });
    if (!task) throw new TaskAssignmentError('La actividad no está disponible en esta obra.', 'ASSIGNMENT_TASK_MISSING', 404);
    if (task.revision !== request.expectedTaskRevision) throw new TaskAssignmentError('La actividad cambió. Actualizá la actividad y sus responsables.', 'ASSIGNMENT_TASK_CHANGED', 409);
    // Escape LIKE metacharacters: %, _ and backslash are literal search text.
    const words = request.query ? request.query.split(' ').map(word => word.replace(/[\\%_]/g, '\\$&')) : [];
    const where = { projectId: scope.projectId, project: { organizationId: scope.organizationId },
      ...(request.ownerKind === 'WORKER' ? { organizationId: scope.organizationId, active: true } : { status: 'ACTIVE' }),
      AND: [...words.map(word => ({ name: { contains: word, mode: 'insensitive' } })),
        ...(after ? [{ OR: [{ name: { gt: after.name } }, { name: after.name, id: { gt: after.id } }] }] : [])] };
    const model = request.ownerKind === 'WORKER' ? tx.worker : tx.workTeam;
    const rows = await model.findMany({ where, orderBy: [{ name: 'asc' }, { id: 'asc' }], take: OWNER_PAGE_SIZE + 1, select: { id: true, name: true } });
    const items = rows.slice(0, OWNER_PAGE_SIZE).map(({ id, name }) => ({ id, name }));
    const last = items.at(-1);
    const nextCursor = rows.length > OWNER_PAGE_SIZE ? Buffer.from(JSON.stringify({ v: 1, binding, ...last })).toString('base64url') : null;
    return { context: scope, task, ownerKind: request.ownerKind, query: request.query, cursor: request.cursor, pageSize: OWNER_PAGE_SIZE, items, nextCursor };
  }, { isolationLevel: 'RepeatableRead', timeout: 10000 });
}
