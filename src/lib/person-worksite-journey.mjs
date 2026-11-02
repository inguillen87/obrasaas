import {WorkspaceError, workspaceId, digest} from './workspace-policy.mjs';
import {readEffectivePersonAttendance,latestEffectiveJourneys} from './attendance-effective-store.mjs';

// One principal in one organization, shared by web and signed channel adapters.
// Call after canonical identity, BEFORE locking any Project. The canonical
// AttendanceEntry ledger remains the only attendance state/transition engine.
export async function lockPersonWorksiteJourney(client, member) {
  if (!workspaceId(member?.organizationId) || !workspaceId(member?.actorId)) throw new WorkspaceError('FIELD_PARTICIPANT_REQUIRED', 403);
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', ['person-worksite-journey-v1:' + digest([member.organizationId, member.actorId])]);
}

export async function assertPersonWorksiteJourney(client, member, projectId, workerId, eventType) {
  const ledger=await readEffectivePersonAttendance(client,{organizationId:member.organizationId,actorId:member.actorId});
  const heads=latestEffectiveJourneys(ledger),open=heads.filter(j=>j.projection.effective.state==='RECORDED_OPEN');
  if(open.some(j=>j.projection.projectId!==projectId||j.projection.workerId!==workerId)||open.length>1)throw new WorkspaceError('ATTENDANCE_PERSON_JOURNEY_OPEN',409);
  if(eventType==='CHECK_IN'&&open.length)throw new WorkspaceError('ATTENDANCE_SHIFT_ALREADY_OPEN',409);
}
