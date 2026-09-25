import { historyId, FlowHistoryError } from './proactive-flow-history-policy.js';
import { resolveProactiveFlowReplyInTransaction } from './proactive-flow-reply.js';
import { flowAttendanceReceiptMatches, flowAttendanceMatches } from './flow-attendance-policy.js';
import { ATTENDANCE_GEO_WINDOW_MS } from '../attendance.js';
const date = value => value instanceof Date && Number.isFinite(value.getTime()) ? value.toISOString() : null;

// No provider, token, geocoordinates, payroll, message text or domain mutations.
export async function readProactiveFlowAttendance({ prisma, access, conversationId, messageId, clock = () => new Date() }) {
  const scope = { organizationId: historyId(access?.organization?.id), projectId: historyId(access?.project?.id), conversationId: historyId(conversationId) };
  historyId(messageId);
  return prisma.$transaction(async tx => {
    const observedAt = date(clock());
    const output = (state, entry = null) => {
      const payload = { context: scope, sourceMessageId: messageId, observedAt, state, entry };
      if (!flowAttendanceMatches(payload, scope, messageId)) throw new FlowHistoryError('No se pudo verificar el ingreso vinculado.', 'WHATSAPP_FLOW_ATTENDANCE_UNVERIFIED', 503);
      return payload;
    };
    const linked = await resolveProactiveFlowReplyInTransaction(tx, scope, messageId, observedAt);
    if (linked.state !== 'available') return output(linked.state);
    if (linked.session.blueprintKey !== 'shift-check-in') return output('unsupported');
    const meta = linked.inbound.metadata;
    if (meta.redacted === true || meta.simulated === true || meta.sensitivity === 'medical') return output('unavailable');
    if (!Object.hasOwn(meta, 'flowAttendanceReceipt')) return output('unlinked');
    const receipt = meta.flowAttendanceReceipt;
    if (!flowAttendanceReceiptMatches(receipt, linked.session)) return output('unavailable');
    const entry = await tx.attendanceEntry.findFirst({ where: { id: receipt.entryId, projectId: scope.projectId, workerId: linked.session.workerId,
      project: { organizationId: scope.organizationId }, eventType: 'CHECK_IN' },
      select: { id: true, verificationStatus: true, occurredAt: true, shiftId: true } });
    if (!entry || !date(entry.occurredAt)) return output('unavailable');
    let shift = null;
    if (entry.shiftId) {
      shift = await tx.attendanceShift.findFirst({ where: { id: entry.shiftId, projectId: scope.projectId, workerId: linked.session.workerId,
        project: { organizationId: scope.organizationId } }, select: { id: true, status: true, revision: true, workDate: true } });
      if (!shift || !date(shift.workDate)) return output('unavailable');
    }
    const publicEntry = { id: entry.id, verificationStatus: entry.verificationStatus, occurredAt: date(entry.occurredAt),
      locationDeadlineAt: date(new Date(entry.occurredAt.getTime() + ATTENDANCE_GEO_WINDOW_MS)),
      shift: shift ? { id: shift.id, status: shift.status, revision: shift.revision, workDate: date(shift.workDate).slice(0,10) } : null };
    if (!flowAttendanceMatches({ context: scope, sourceMessageId: messageId, observedAt, state: 'available', entry: publicEntry }, scope, messageId)) return output('unavailable');
    return output('available', publicEntry);
  }, { isolationLevel: 'RepeatableRead', maxWait: 5000, timeout: 10000 });
}
