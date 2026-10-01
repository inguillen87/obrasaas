import { WorkspaceError, WORKSPACE_ROLES, workspaceId, operationId, requireWorkspaceIdentity, scopeStamp, checkScope, portfolioAccess, managesSchedule, validateScheduleChange, scheduleReceiptId, scheduleRequestDigest } from './workspace-policy.mjs';

const taskColumns = `t.id, t.title, t.status::text AS status, t.progress,
  to_char(t."startsAt", 'YYYY-MM-DD') AS "startsOn", to_char(t."endsAt", 'YYYY-MM-DD') AS "endsOn",
  to_char(t."updatedAt", 'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision`;
const publicTask = row => ({ id: row.id, title: row.title, status: row.status, progress: row.progress, startsOn: row.startsOn, endsOn: row.endsOn, revision: row.revision });
const publicReceipt = row => ({ id: row.id, taskId: row.entityId, recordedAt: row.recordedAt, before: row.metadata.before, after: row.metadata.after });

export function createWorkspaceStore({ connect }) {
  if (typeof connect !== 'function') throw new TypeError('An explicit database connection is required');
  async function transaction(session, writable, callback) {
    requireWorkspaceIdentity(session);
    let client, broken = false;
    try {
      client = await connect();
      await client.query(writable ? 'BEGIN ISOLATION LEVEL READ COMMITTED' : 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      await client.query("SET LOCAL statement_timeout = '6000ms'");
      await client.query("SET LOCAL lock_timeout = '2500ms'");
      const result = await client.query(`SELECT u.id AS "actorId", m.id AS "membershipId", m."tenantRole"::text AS role,
        o.id AS "organizationId", o.name AS "organizationName"
        FROM public."PlatformUser" u JOIN public."TenantMembership" m ON m."userId"=u.id
        JOIN public."Organization" o ON o.id=m."organizationId"
        WHERE u."clerkUserId"=$1 AND o."clerkOrganizationId"=$2 AND m."clerkRole"=$3
          AND m.status='ACTIVE' AND COALESCE(o.metadata->'internal','false'::jsonb) <> 'true'::jsonb
        ${writable ? 'FOR SHARE OF u,m,o' : ''}`, [session.userId, session.organizationId, session.organizationRole]);
      if (result.rows.length !== 1 || !Object.hasOwn(WORKSPACE_ROLES, result.rows[0].role)) throw new WorkspaceError('WORKSPACE_MEMBERSHIP_REQUIRED', 403);
      const membership = result.rows[0], scope = scopeStamp(session, membership);
      const value = await callback(client, membership, scope);
      await client.query(writable ? 'COMMIT' : 'ROLLBACK');
      return value;
    } catch (error) {
      if (client) { try { await client.query('ROLLBACK'); } catch { broken = true; } }
      if (error instanceof WorkspaceError) throw error;
      throw new WorkspaceError('WORKSPACE_OPERATION_UNCONFIRMED', 503);
    } finally { client?.release(broken); }
  }
  async function project(client, membership, id, lock = false) {
    if (!workspaceId(id)) throw new WorkspaceError('WORKSPACE_PROJECT_INVALID');
    const result = await client.query(`SELECT id,name,status::text AS status FROM public."Project"
      WHERE id=$1 AND "organizationId"=$2 AND status='ACTIVE' ${lock ? 'FOR SHARE' : ''}`, [id, membership.organizationId]);
    if (result.rows.length !== 1) throw new WorkspaceError('WORKSPACE_PROJECT_UNAVAILABLE', 404);
    if (!portfolioAccess(membership.role)) {
      const access = await client.query(`SELECT id FROM public."ProjectMembership" WHERE "projectId"=$1
        AND "tenantMembershipId"=$2 AND status='ACTIVE' ${lock ? 'FOR SHARE' : ''}`, [id, membership.membershipId]);
      if (access.rows.length !== 1) throw new WorkspaceError('WORKSPACE_PROJECT_UNAVAILABLE', 404);
    }
    return result.rows[0];
  }
  async function task(client, projectId, taskId, lock = false) {
    const result = await client.query(`SELECT ${taskColumns} FROM public."Task" t WHERE t.id=$1 AND t."projectId"=$2 ${lock ? 'FOR UPDATE OF t' : ''}`, [taskId, projectId]);
    if (result.rows.length !== 1) throw new WorkspaceError('WORKSPACE_TASK_UNAVAILABLE', 404);
    return publicTask(result.rows[0]);
  }
  async function receipt(client, membership, id) {
    const result = await client.query(`SELECT id,"entityId",metadata,to_char("createdAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS "recordedAt"
      FROM public."AuditLog" WHERE id=$1 AND "actorId"=$2 AND "organizationId"=$3 AND action='task.schedule.reviewed'`, [id, membership.actorId, membership.organizationId]);
    return result.rows[0] || null;
  }
  return {
    async list(session) {
      return transaction(session, false, async (client, member, scope) => {
        const result = await client.query(`SELECT p.id,p.name,p.status::text AS status FROM public."Project" p
          WHERE p."organizationId"=$1 AND p.status='ACTIVE' AND ($2::boolean OR EXISTS
          (SELECT 1 FROM public."ProjectMembership" pm WHERE pm."projectId"=p.id AND pm."tenantMembershipId"=$3 AND pm.status='ACTIVE'))
          ORDER BY p.id LIMIT 101`, [member.organizationId, portfolioAccess(member.role), member.membershipId]);
        return { scope, organizationName: member.organizationName, role: member.role, roleLabel: WORKSPACE_ROLES[member.role], canPlanSchedule: managesSchedule(member.role), projects: result.rows.slice(0,100), projectsTruncated: result.rows.length>100 };
      });
    },
    async read(session, { projectId, scope: expected, afterTask = null }) {
      if (afterTask !== null && !workspaceId(afterTask)) throw new WorkspaceError('WORKSPACE_CURSOR_INVALID');
      return transaction(session, false, async (client, member, scope) => {
        checkScope(scope, expected);
        const selected = await project(client, member, projectId);
        const counts = await client.query('SELECT count(*)::int AS total FROM public."Task" WHERE "projectId"=$1', [projectId]);
        const result = await client.query(`SELECT ${taskColumns} FROM public."Task" t
          WHERE t."projectId"=$1 AND ($2::text IS NULL OR t.id>$2) ORDER BY t.id LIMIT 101`, [projectId, afterTask]);
        const rows = result.rows.slice(0,100).map(publicTask);
        return { scope, project: selected, roleLabel: WORKSPACE_ROLES[member.role], canPlanSchedule: managesSchedule(member.role), tasks: rows, totalTasks: counts.rows[0].total, nextCursor: result.rows.length>100 ? rows.at(-1).id : null };
      });
    },
    async schedule(session, body) {
      const input = validateScheduleChange(body);
      return transaction(session, true, async (client, member, scope) => {
        checkScope(scope, input.scope);
        if (!managesSchedule(member.role)) throw new WorkspaceError('SCHEDULE_PERMISSION_REQUIRED', 403);
        await project(client, member, input.projectId, true);
        const id = scheduleReceiptId(member.actorId, input.projectId, input.operationId), requestDigest = scheduleRequestDigest(input);
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [id]);
        const previous = await receipt(client, member, id);
        if (previous) {
          if (previous.metadata.requestDigest !== requestDigest || previous.entityId !== input.taskId || previous.metadata.projectId !== input.projectId) throw new WorkspaceError('SCHEDULE_OPERATION_CONFLICT', 409);
          return { scope, saved: true, replayed: true, receipt: publicReceipt(previous), task: await task(client, input.projectId, input.taskId) };
        }
        const before = await task(client, input.projectId, input.taskId, true);
        if (before.revision !== input.expectedRevision) throw new WorkspaceError('SCHEDULE_REVISION_CHANGED', 409);
        if (before.startsOn === input.startsOn && before.endsOn === input.endsOn) throw new WorkspaceError('SCHEDULE_UNCHANGED', 409);
        const updated = await client.query(`UPDATE public."Task" SET "startsAt"=$3::date, "endsAt"=$4::date, "updatedAt"=clock_timestamp()
          WHERE id=$1 AND "projectId"=$2`, [input.taskId, input.projectId, input.startsOn, input.endsOn]);
        if (updated.rowCount !== 1) throw new WorkspaceError('SCHEDULE_WRITE_UNCONFIRMED', 503);
        const after = await task(client, input.projectId, input.taskId);
        if (after.progress !== before.progress || after.status !== before.status) throw new WorkspaceError('SCHEDULE_SIDE_EFFECT_REJECTED', 503);
        await client.query(`INSERT INTO public."AuditLog" (id,"organizationId","actorId",action,"entityType","entityId",metadata)
          VALUES ($1,$2,$3,'task.schedule.reviewed','Task',$4,$5::jsonb)`, [id, member.organizationId, member.actorId, input.taskId,
          JSON.stringify({ version:1, projectId:input.projectId, requestDigest, reason:input.reason, before:{startsOn:before.startsOn,endsOn:before.endsOn,revision:before.revision}, after:{startsOn:after.startsOn,endsOn:after.endsOn,revision:after.revision}, source:'authorized-account-workspace' })]);
        const recorded = await receipt(client, member, id);
        if (!recorded) throw new WorkspaceError('SCHEDULE_RECEIPT_UNCONFIRMED', 503);
        return { scope, saved:true, replayed:false, receipt:publicReceipt(recorded), task:after };
      });
    },
    async status(session, { projectId, scope: expected, operationId: key }) {
      if (!operationId(key)) throw new WorkspaceError('SCHEDULE_INPUT_INVALID');
      return transaction(session, false, async (client, member, scope) => {
        checkScope(scope, expected);
        await project(client, member, projectId);
        const found = await receipt(client, member, scheduleReceiptId(member.actorId, projectId, key));
        if (!found || found.metadata.projectId !== projectId) return { scope, state:'NOT_OBSERVED', definitive:false };
        return { scope, state:'RECORDED', receipt:publicReceipt(found), task:await task(client, projectId, found.entityId) };
      });
    },
  };
}
