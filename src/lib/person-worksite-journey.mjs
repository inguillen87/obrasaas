import {WorkspaceError, workspaceId, digest} from './workspace-policy.mjs';

// One principal in one organization, shared by web and signed channel adapters.
// Call after canonical identity, BEFORE locking any Project. The canonical
// AttendanceEntry ledger remains the only attendance state/transition engine.
export async function lockPersonWorksiteJourney(client, member) {
  if (!workspaceId(member?.organizationId) || !workspaceId(member?.actorId)) throw new WorkspaceError('FIELD_PARTICIPANT_REQUIRED', 403);
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', ['person-worksite-journey-v1:' + digest([member.organizationId, member.actorId])]);
}

export async function assertPersonWorksiteJourney(client, member, projectId, workerId, eventType) {
  // Select the latest event PER worker first; filtering the actor before that
  // would resurrect an old open shift after a later legitimate close.
  const open = (await client.query(`SELECT id,"projectId","workerId",metadata FROM (
    SELECT DISTINCT ON (a."projectId",a."workerId") a.id,a."projectId",a."workerId",a.metadata
    FROM public."AttendanceEntry" a JOIN public."Project" p ON p.id=a."projectId"
    WHERE p."organizationId"=$1 AND a.metadata->'fieldOperations'->>'version'='1'
    ORDER BY a."projectId",a."workerId",(a.metadata->'fieldOperations'->>'sequence')::int DESC,a.id DESC
  ) latest WHERE metadata->'fieldOperations'->>'recordedBy'=$2
    AND metadata->'fieldOperations'->>'eventType'<>'CHECK_OUT'`, [member.organizationId, member.actorId])).rows;
  const elsewhere = open.some(row => row.projectId !== projectId || row.workerId !== workerId);
  if (elsewhere || open.length > 1) throw new WorkspaceError('ATTENDANCE_PERSON_JOURNEY_OPEN', 409);
  if (eventType !== 'CHECK_IN' && open.length === 1 && (open[0].projectId !== projectId || open[0].workerId !== workerId)) throw new WorkspaceError('ATTENDANCE_PERSON_JOURNEY_OPEN', 409);
}
