import { buildFlowAttendanceReceipt } from '../../src/lib/whatsapp/flow-attendance-policy.js';
export const ATTENDANCE_NOW = new Date('2026-09-24T12:00:00.000Z');
export const attendanceScope = { organizationId: 'organization-a', projectId: 'project-a', conversationId: 'conversation-a' };
export const attendanceAccess = { organization: { id: 'organization-a' }, project: { id: 'project-a' }, databaseUserId: 'reader-a' };
export function createFlowAttendanceFixture() {
  const scope = attendanceScope, calls = [], stamp = seconds => new Date(ATTENDANCE_NOW.getTime() - seconds * 1000);
  const source = { id: 'message-attendance', conversationId: scope.conversationId, direction: 'OUTBOUND', kind: 'INTERACTIVE', externalId: 'obrasaas-flow-template:attempt-attendance', providerMessageId: 'wamid.synthetic.sent', createdAt: stamp(120), metadata: { messageType: 'whatsapp_flow_template', blueprintKey: 'shift-check-in', flowSessionId: '50000000-0000-4000-8000-000000000001' } };
  const session = { id: source.metadata.flowSessionId, organizationId: scope.organizationId, projectId: scope.projectId, workerId: 'worker-a', blueprintKey: 'shift-check-in', sourceExternalId: source.externalId, createdAt: stamp(120), sentAt: stamp(110), consumedAt: stamp(60), consumedExternalId: 'wamid.synthetic.received', providerMessageId: source.providerMessageId, deliveryRejectedAt: null };
  const entry = { id: 'entry-a', projectId: scope.projectId, workerId: session.workerId, eventType: 'CHECK_IN', verificationStatus: 'PENDING', occurredAt: stamp(90), shiftId: null, latitude: 12.345678, evidence: { private: 'PRIVATE_EVIDENCE_CANARY' } };
  const inbound = { id: 'reply-attendance', conversationId: scope.conversationId, direction: 'INBOUND', kind: 'INTERACTIVE', externalId: session.consumedExternalId, body: 'Formulario de ingreso recibido.', createdAt: stamp(60), sentAt: stamp(60), metadata: { provider: 'meta', authorized: true, workerId: session.workerId, whatsappFlowSessionId: session.id, whatsappFlowBlueprintKey: session.blueprintKey, flowAttendanceReceipt: buildFlowAttendanceReceipt(entry,session), from: 'PRIVATE_PHONE_CANARY' } };
  const state = { source, session, inbound, entry, shift: null };
  const same = (row, where) => row && Object.entries(where).every(([key,value]) => ['AND','project'].includes(key) || row[key] === value);
  const projectMatches = where => !where.project || where.project.organizationId === scope.organizationId;
  const select = (row, fields) => row ? Object.fromEntries(Object.keys(fields).map(key => [key,structuredClone(row[key])])) : null;
  const prisma = {
    project: { findFirst: async ({where}) => where.id === scope.projectId && where.organizationId === scope.organizationId ? {id:scope.projectId} : null },
    conversation: { findFirst: async args => { calls.push({model:'conversation',args}); const w=args.where; return w.id===scope.conversationId && w.projectId===scope.projectId && projectMatches(w) ? {id:scope.conversationId} : null; } },
    message: { findFirst: async args => { calls.push({model:'message',args}); const row=args.where.direction==='OUTBOUND'?state.source:state.inbound; return select(same(row,args.where)&&(!args.where.AND || ['shift-check-in','incident-report'].includes(row.metadata.blueprintKey))?row:null,args.select); } },
    whatsAppFlowSession: { findFirst: async args => { calls.push({model:'session',args}); return select(same(state.session,args.where)?state.session:null,args.select); } },
    attendanceEntry: { findFirst: async args => { calls.push({model:'entry',args}); return select(same(state.entry,args.where)&&projectMatches(args.where)?state.entry:null,args.select); } },
    attendanceShift: { findFirst: async args => { calls.push({model:'shift',args}); return select(same(state.shift,args.where)&&projectMatches(args.where)?state.shift:null,args.select); } },
  };
  prisma.$transaction = async (fn,options) => { calls.push({transaction:options}); return fn(prisma); };
  return {state,source,session,inbound,entry,calls,prisma};
}
