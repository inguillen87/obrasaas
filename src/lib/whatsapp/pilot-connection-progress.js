const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,189}$/;
export const PILOT_PROGRESS_LIMIT = 5;
// Input is the server-authorized pilot catalog, never a client-supplied tenant list.
export async function readPilotConnectionProgress(prisma, { targets = [], now = new Date() } = {}) {
  const scopes = targets.filter(t => ID.test(t.organizationId || '')).flatMap(t => (t.projects || []).filter(p => ID.test(p.id || '')).map(p => ({ organizationId: t.organizationId, companyName: t.organizationName, projectId: p.id, projectName: p.name })));
  if (!scopes.length) return { channels: [], hasMore: false };
  const channels = await prisma.whatsAppConnection.findMany({ where: { OR: scopes.map(s => ({ projectId: s.projectId, project: { organizationId: s.organizationId } })) },
    take: PILOT_PROGRESS_LIMIT + 1, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    select: { id: true, projectId: true, phoneNumberId: true, displayPhoneNumber: true, enabled: true, connectionStatus: true, connectedAt: true } });
  const visible = channels.slice(0, PILOT_PROGRESS_LIMIT);
  const summaries = await Promise.all(visible.map(async connection => {
    const scope = scopes.find(s => s.projectId === connection.projectId);
    if (!scope) return null;
    const summary = { companyName: scope.companyName, projectName: scope.projectName, displayPhoneNumber: connection.displayPhoneNumber,
      linked: connection.enabled === true && connection.connectionStatus === 'CONNECTED', checkedAt: now.toISOString() };
    try {
      const counts = await prisma.$transaction(async tx => {
        const since = connection.connectedAt ? { gte: connection.connectedAt } : undefined;
        const base = { conversation: { projectId: scope.projectId, project: { organizationId: scope.organizationId } }, ...(since ? { createdAt: since } : {}) };
        const incoming = { ...base, direction: 'INBOUND', metadata: { path: ['phoneNumberId'], equals: connection.phoneNumberId } };
        const [received, awaitingParticipant, outboundRecorded] = await Promise.all([
          tx.message.count({ where: incoming }),
          tx.message.count({ where: { ...base, direction: 'INBOUND', AND: [{ metadata: { path: ['phoneNumberId'], equals: connection.phoneNumberId } }, { metadata: { path: ['contactStatus'], equals: 'UNASSIGNED' } }] } }),
          tx.message.count({ where: { ...base, direction: 'OUTBOUND', providerMessageId: { not: null } } }),
        ]);
        return { received, awaitingParticipant, outboundRecorded };
      }, { isolationLevel: 'RepeatableRead', timeout: 10000 });
      return { ...summary, state: 'available', ...counts };
    } catch { return { ...summary, state: 'unavailable', received: null, awaitingParticipant: null, outboundRecorded: null }; }
  }));
  return { channels: summaries.filter(Boolean), hasMore: channels.length > PILOT_PROGRESS_LIMIT };
}
