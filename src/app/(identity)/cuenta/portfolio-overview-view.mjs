const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
const roles = ['ADMIN', 'DIRECTOR', 'SITE_MANAGER', 'FINANCE', 'AUDITOR'];
const keys = (value, expected) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join('|') === [...expected].sort().join('|');
const count = value => Number.isSafeInteger(value) && value >= 0;
function date(value) {
  if (value === null) return true;
  if (typeof value !== 'string' || !/^(20\d\d|2100)-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
export function portfolioOverviewMatches(value, {scope, role}) {
  if (!keys(value, ['scope', 'organizationName', 'role', 'projects', 'nextCursor']) || value.scope !== scope || !/^[a-f0-9]{64}$/.test(scope || '') || value.role !== role || !roles.includes(role) || typeof value.organizationName !== 'string' || !value.organizationName.trim() || !Array.isArray(value.projects) || value.projects.length > 50) return false;
  let previous = '';
  for (const row of value.projects) {
    if (!keys(row, ['id','name','status','totalTasks','completedTasks','inProgressTasks','blockedTasks','unscheduledTasks','nextEndsOn']) || !id(row.id) || row.id <= previous || typeof row.name !== 'string' || !row.name.trim() || row.status !== 'ACTIVE' || !date(row.nextEndsOn)) return false;
    if (![row.totalTasks,row.completedTasks,row.inProgressTasks,row.blockedTasks,row.unscheduledTasks].every(count) || [row.completedTasks,row.inProgressTasks,row.blockedTasks,row.unscheduledTasks].some(amount => amount > row.totalTasks) || row.completedTasks + row.inProgressTasks + row.blockedTasks > row.totalTasks || row.totalTasks === 0 && row.nextEndsOn !== null) return false;
    previous = row.id;
  }
  return value.nextCursor === null || value.projects.length === 50 && value.nextCursor === value.projects.at(-1).id;
}
export function mergePortfolioPages(previous, incoming, cursor) {
  if (cursor === null) return incoming.projects;
  if (!previous || previous.scope !== incoming.scope || previous.role !== incoming.role || previous.nextCursor !== cursor || previous.projects.at(-1)?.id !== cursor || incoming.projects.some(row => row.id <= cursor)) throw new Error('La respuesta no corresponde a la página de obras solicitada. Volvé a consultar el resumen.');
  return [...previous.projects, ...incoming.projects];
}
export function portfolioDateLabel(value) {
  if (!date(value) || value === null) return 'Sin fecha pendiente registrada';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}
