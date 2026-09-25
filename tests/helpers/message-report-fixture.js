export const scope = { organizationId: 'org-a', projectId: 'project-a' };
export const context = { scope, actorId: 'director-a', conversationId: 'conversation-a', messageId: 'message-a' };
const makeMessage = () => ({ id: 'message-a', conversationId: 'conversation-a', externalId: 'wamid.test', direction: 'INBOUND', kind: 'TEXT', body: 'Faltan diez bolsas de cemento en el sector norte.', sentAt: new Date('2026-09-18T02:30:00Z'),
  metadata: { provider: 'meta', authorized: true, workerId: 'worker-a' }, conversation: { projectId: scope.projectId, channel: 'whatsapp', externalId: 'meta:demo-contact' } });
const org = () => ({ id: scope.organizationId, timezone: 'America/Argentina/Buenos_Aires', subscriptionPlan: 'ENTERPRISE', subscriptionStatus: 'ACTIVE' });
export function database() {
  const state = { message: makeMessage(), worker: true, task: true, org: org(), projectStatus: 'ACTIVE', logs: [], audits: [], failAudit: false };
  const matches = (row, where) => Object.entries(where).every(([key, value]) => row[key] === value);
  const tx = {
    $executeRawUnsafe: async () => 1,
    project: { findFirst: async ({ where }) => where.id === scope.projectId && where.organizationId === scope.organizationId ? { ...scope, status: state.projectStatus } : null },
    message: { findFirst: async ({ where }) => where.id === context.messageId && where.conversationId === context.conversationId && where.conversation.projectId === scope.projectId && where.conversation.project.organizationId === scope.organizationId ? structuredClone(state.message) : null },
    worker: { findFirst: async ({ where }) => state.worker && where.id === 'worker-a' && where.projectId === scope.projectId ? { id: 'worker-a' } : null },
    organization: { findUnique: async ({ where }) => where.id === scope.organizationId ? structuredClone(state.org) : null },
    task: { findFirst: async ({ where }) => state.task && where.id === 'task-a' && where.projectId === scope.projectId && where.type === 'TASK' && where.metadata.equals === 'canonical-task-v1' ? { id: 'task-a' } : null },
    dailyLog: {
      findFirst: async ({ where }) => structuredClone(state.logs.find(row => matches(row, where)) || null),
      create: async ({ data }) => { const row = { ...structuredClone(data), revision: 0 }; state.logs.push(row); return structuredClone(row); },
    },
    auditLog: { findFirst: async ({ where }) => structuredClone(state.audits.find(row => matches(row, where)) || null), create: async ({ data }) => { if (state.failAudit) throw new Error('audit-failure'); state.audits.push(structuredClone(data)); return data; } },
  };
  return { state, prisma: { $transaction: async operation => { const before = structuredClone(state); try { return await operation(tx); } catch (error) { Object.assign(state, before); throw error; } } } };
}
