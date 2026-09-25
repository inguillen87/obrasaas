import { assignmentId, TaskAssignmentError } from './task-assignment-policy.js';

export const OWNER_PAGE_SIZE = 30;
const CURSOR = /^[A-Za-z0-9_-]{1,4096}$/;
export function normalizeOwnerQuery(value = '') {
  if (typeof value !== 'string' || value.length > 80 || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new TaskAssignmentError('Buscá por nombre, con hasta 80 caracteres.', 'ASSIGNMENT_DIRECTORY_INVALID');
  }
  return value.trim().replace(/\s+/g, ' ');
}
export function normalizeOwnerSearch(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.keys(input).some(key => !['taskId', 'expectedTaskRevision', 'ownerKind', 'query', 'cursor'].includes(key))) {
    throw new TaskAssignmentError('La consulta de responsables contiene campos no admitidos.', 'ASSIGNMENT_DIRECTORY_INVALID');
  }
  if (!['WORKER', 'TEAM'].includes(input.ownerKind)
    || !Number.isSafeInteger(input.expectedTaskRevision) || input.expectedTaskRevision < 0
    || input.cursor != null && (typeof input.cursor !== 'string' || !CURSOR.test(input.cursor))) {
    throw new TaskAssignmentError('Actualizá los datos de la consulta de responsables.', 'ASSIGNMENT_DIRECTORY_INVALID');
  }
  return { taskId: assignmentId(input.taskId), expectedTaskRevision: input.expectedTaskRevision,
    ownerKind: input.ownerKind, query: normalizeOwnerQuery(input.query), cursor: input.cursor ?? null };
}
export function ownerDirectoryPageMatches(page, input, scope) {
  try {
    const request = normalizeOwnerSearch(input);
    return Boolean(page?.context?.organizationId === scope.organizationId && page.context.projectId === scope.projectId
      && page.task?.id === request.taskId && page.task.revision === request.expectedTaskRevision
      && page.ownerKind === request.ownerKind && page.query === request.query && page.cursor === request.cursor
      && page.pageSize === OWNER_PAGE_SIZE && Array.isArray(page.items) && page.items.length <= OWNER_PAGE_SIZE
      && page.items.every(row => row && typeof row.id === 'string' && assignmentId(row.id)
        && typeof row.name === 'string' && row.name.trim() && row.name.length <= 500
        && Object.keys(row).every(key => ['id', 'name'].includes(key)))
      && new Set(page.items.map(row => row.id)).size === page.items.length
      && (page.nextCursor === null || typeof page.nextCursor === 'string' && CURSOR.test(page.nextCursor)
        && page.nextCursor !== request.cursor && page.items.length === OWNER_PAGE_SIZE));
  } catch { return false; }
}
