import { deriveWhatsAppChannelPresentation } from './whatsapp/channel-presentation.js';
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,189}$/;
export const OPERATIONS_SAMPLE_LIMIT = 3;
export class OperationsOverviewError extends Error {
  constructor(message, status = 400, code = 'OPERATIONS_INVALID') { super(message); this.status = status; this.code = code; }
}
export function operationsPermissions(access, hasPermission) {
  const has = permission => hasPermission(access, permission) === true;
  return { execution: has('org:execution:read'), capture: has('org:execution:manage'), tasks: has('org:tasks:read'),
    proposals: has('org:operational-proposals:read'), evidence: has('org:field:evidence:read'),
    review: has('org:progress:review'), inspect: has('org:inspections:approve'),
    inbox: has('org:conversations:read'), integrations: has('org:integrations:manage'),
    attendance: has('org:attendance:read'), reports: has('org:reports:read'), team: has('tenant:members:read') };
}
const iso = value => value ? new Date(value).toISOString() : null;
const title = (value, fallback) => typeof value === 'string' && value.trim() ? value.trim().slice(0, 220) : fallback;
const recordLink = id => '/dashboard/progress?recordId=' + encodeURIComponent(id);
export async function readOperationsOverview(prisma, { scope, permissions = {}, now = new Date() }) {
  const { organizationId, projectId } = scope || {};
  if (![organizationId, projectId].every(value => typeof value === 'string' && ID.test(value))) throw new OperationsOverviewError('El contexto de la obra no es válido.');
  const project = await prisma.project.findFirst({ where: { id: projectId, organizationId }, select: { id: true, name: true, status: true } });
  if (!project) throw new OperationsOverviewError('Obra no disponible.', 404, 'OPERATIONS_NOT_FOUND');
  const scoped = { projectId, project: { organizationId } };
  const lanes = [];
  if (permissions.execution) {
    lanes.push({ key: 'unassigned', cycle: 'daily', label: 'Partes sin tarea', detail: 'Borradores que todavía no se incorporaron a una actividad.', action: 'Abrir pendientes de vinculación', href: '/dashboard/progress?unassigned=1', next: 'Vincular tarea → enviar a revisión',
      model: 'dailyLog', where: { ...scoped, status: 'DRAFT', taskId: null }, select: { id: true, title: true, createdAt: true }, item: row => ({ label: title(row.title, 'Parte de obra'), href: recordLink(row.id), action: 'Abrir parte' }) });
    lanes.push({ key: 'reports', cycle: 'quality', label: 'Partes por revisar', detail: 'Registros enviados que esperan una decisión autorizada.', action: 'Abrir bitácora', href: '/dashboard/progress', next: 'Revisar → aprobar o devolver con motivo',
      model: 'dailyLog', where: { ...scoped, status: 'SUBMITTED' }, select: { id: true, title: true, createdAt: true }, item: row => ({ label: title(row.title, 'Parte de obra'), href: recordLink(row.id), action: permissions.review && permissions.capture ? 'Revisar parte' : 'Consultar parte' }) });
    lanes.push({ key: 'inspections', cycle: 'quality', label: 'Inspecciones por decidir', detail: 'Controles enviados a revisión técnica.', action: 'Abrir inspecciones', href: '/dashboard/inspections', next: 'Ver checklist → dictaminar con alcance',
      model: 'inspectionRecord', where: { organizationId, projectId, status: 'SUBMITTED' }, select: { id: true, title: true, createdAt: true }, item: row => ({ label: title(row.title, 'Inspección'), href: '/dashboard/inspections?inspection=' + encodeURIComponent(row.id), action: permissions.inspect ? 'Revisar inspección' : 'Consultar inspección' }) });
    lanes.push({ key: 'blockers', cycle: 'planning', label: 'Restricciones abiertas', detail: 'Impedimentos registrados que aún no se resolvieron.', action: 'Abrir restricciones', href: '/dashboard/execution', next: 'Identificar responsable → resolver y registrar',
      model: 'projectBlocker', where: { ...scoped, status: { in: ['OPEN', 'IN_PROGRESS'] } }, select: { id: true, title: true, createdAt: true }, item: row => ({ label: title(row.title, 'Restricción'), href: '/dashboard/execution', action: 'Consultar en cuadrillas' }) });
    lanes.push({ key: 'purchases', cycle: 'supply', label: 'Órdenes en preparación', detail: 'Borradores de compra, no compras emitidas ni recepciones.', action: 'Abrir compras', href: '/dashboard/purchases', next: 'Completar orden → emitir → recibir y conciliar',
      model: 'purchaseOrder', where: { organizationId, projectId, status: 'DRAFT' }, select: { id: true, number: true, createdAt: true }, item: row => ({ label: title(row.number, 'Orden de compra'), href: '/dashboard/purchases', action: 'Consultar en compras' }) });
    if (permissions.evidence) lanes.push({ key: 'evidence', cycle: 'quality', label: 'Evidencias por revisar', detail: 'Archivos registrados pendientes de revisión humana.', action: 'Abrir evidencias', href: '/dashboard/progress', next: 'Ver original → revisar → medir, cuando corresponda',
      model: 'progressEvidence', where: { ...scoped, status: 'PENDING' }, select: { id: true, taskId: true, createdAt: true }, item: row => ({ label: 'Evidencia pendiente de revisión', href: '/dashboard/progress?taskId=' + encodeURIComponent(row.taskId), action: 'Ver evidencia en su tarea' }) });
  }
  if (permissions.proposals) lanes.push({ key: 'proposals', cycle: 'daily', label: 'Propuestas vigentes', detail: 'Propuestas pendientes que todavía no vencieron.', action: 'Abrir aprobaciones', href: '/dashboard/approvals', next: 'Consultar efecto → decidir → verificar resultado',
    model: 'operationalProposal', where: { ...scoped, status: 'PENDING', expiresAt: { gt: now } }, select: { id: true, createdAt: true }, item: () => ({ label: 'Propuesta operativa pendiente', href: '/dashboard/approvals', action: 'Consultar en aprobaciones' }) });
  const queues = await Promise.all(lanes.map(async lane => {
    const { model, where, select, item, ...presentation } = lane;
    try {
      const result = await prisma.$transaction(async tx => {
        const count = await tx[model].count({ where });
        const rows = await tx[model].findMany({ where, select, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: OPERATIONS_SAMPLE_LIMIT });
        return { count, samples: rows.map(row => ({ id: row.id, ...item(row), since: iso(row.createdAt) })) };
      }, { isolationLevel: 'RepeatableRead', timeout: 10000 });
      return { ...presentation, state: 'available', ...result, hasMore: result.count > result.samples.length };
    } catch {
      return { ...presentation, state: 'unavailable', count: null, samples: [], hasMore: false };
    }
  }));
  let channel = null;
  if (permissions.inbox || permissions.integrations) {
    try {
      const connection = await prisma.whatsAppConnection.findUnique({ where: { projectId }, select: { enabled: true, connectionStatus: true, lastVerifiedAt: true, metadata: true } });
      const status = deriveWhatsAppChannelPresentation(connection);
      channel = { state: 'available', label: status.label, connected: status.connected === true,
        detail: 'Estado registrado de la conexión. No reemplaza una prueba real de envío y recepción.',
        href: permissions.integrations ? '/dashboard/integrations' : '/dashboard/inbox', action: permissions.integrations ? 'Verificar canal' : 'Abrir conversaciones' };
    } catch { channel = { state: 'unavailable', label: 'Canal sin verificar', connected: false, detail: 'No se pudo consultar su estado.', href: permissions.integrations ? '/dashboard/integrations' : '/dashboard/inbox', action: 'Consultar canal' }; }
  }
  const paths = [
    ...(permissions.execution ? [{ key: 'capture', label: permissions.capture ? 'Registrar en campo' : 'Consultar campo', detail: 'Partes y evidencia en su tarea', href: '/dashboard/campo', icon: 'fa-solid fa-mobile-screen-button' }, { key: 'quality', label: permissions.inspect ? 'Revisar calidad' : 'Consultar calidad', detail: 'Inspecciones y seguimiento', href: '/dashboard/inspections', icon: 'fa-solid fa-clipboard-check' }, { key: 'supply', label: 'Abastecer la obra', detail: 'Compras, entregas y recepción', href: '/dashboard/purchases', icon: 'fa-solid fa-truck-ramp-box' }] : []),
    ...(permissions.tasks ? [{ key: 'plan', label: 'Seguir el plan', detail: 'Tareas y avance registrado', href: '/dashboard?tab=sec-gantt', icon: 'fa-solid fa-timeline' }] : []),
    ...(permissions.attendance ? [{ key: 'people', label: 'Coordinar jornadas', detail: 'Asistencia y turnos', href: '/dashboard/attendance', icon: 'fa-solid fa-user-clock' }] : []),
    ...(permissions.inbox ? [{ key: 'channel', label: 'Atender mensajes', detail: 'Fuente, contexto e intervención', href: '/dashboard/inbox', icon: 'fa-solid fa-comments' }] : []),
    ...(permissions.reports ? [{ key: 'report', label: 'Informar a dirección', detail: 'Reporte de la obra', href: '/dashboard/report', icon: 'fa-solid fa-chart-line' }] : []),
  ];
  return { organizationId, projectId, projectName: project.name, projectStatus: project.status,
    checkedAt: new Date().toISOString(), queues, paths, channel, readOnly: ['ARCHIVED', 'COMPLETED'].includes(project.status),
    sampleLimit: OPERATIONS_SAMPLE_LIMIT, failedQueues: queues.filter(queue => queue.state === 'unavailable').length };
}
