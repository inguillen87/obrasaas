import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizePilotWorkspaceInput, provisionPilotWorkspace } from '../src/lib/whatsapp/pilot-workspace.js';
const environment = { VERCEL_ENV: 'preview', WHATSAPP_PILOT_IMPORT_ENABLED: 'true', VERCEL_GIT_COMMIT_REF: 'synthetic-test' };
const access = { isSuperadmin: true, userId: 'user_test', databaseUserId: 'actor-test', organization: { id: 'internal', metadata: { internal: true } }, project: { id: 'internal-project' } };
const body = { organizationName: 'Empresa de ensayo', projectName: 'Obra de ensayo', confirmIsolatedPilot: true };
function fixture() {
  const state = { remote: null, memberships: [], projects: [], audits: [], creates: 0, revoked: false, expired: false, lostResponse: false, auditFail: false };
  const tx = { tenantMembership: {
    findUnique: async ({ where }) => state.memberships.find(row => row.organizationId === where.organizationId_userId.organizationId && row.userId === where.organizationId_userId.userId) || null,
    create: async ({ data }) => { state.memberships.push({ id: 'membership', ...data }); return data; },
  }, project: { upsert: async ({ where, create, update }) => { assert.deepEqual(update, {}); let project = state.projects.find(row => row.organizationId === where.organizationId_slug.organizationId && row.slug === where.organizationId_slug.slug); if (!project) { project = { id: 'pilot-project', status: 'ACTIVE', ...create }; state.projects.push(project); } return project; } },
    auditLog: { upsert: async ({ where, create, update }) => { assert.deepEqual(update, {}); if (state.auditFail) throw new Error('audit failure'); if (!state.audits.find(row => row.id === where.id)) state.audits.push(create); return create; } } };
  const clerk = { organizations: {
    getOrganization: async ({ slug }) => { if (!state.remote || slug !== state.remote.slug) throw Object.assign(new Error('not found'), { status: 404 }); return state.remote; },
    createOrganization: async input => { state.creates++; assert.equal(input.createdBy, access.userId); state.remote = { id: 'org_pilot', ...input }; if (state.lostResponse) throw new Error('response lost'); return state.remote; },
    getOrganizationMembershipList: async ({ organizationId, userId }) => { assert.equal(organizationId, 'org_pilot'); assert.deepEqual(userId, [access.userId]); return { data: state.revoked ? [] : [{ id: 'om_pilot', role: 'org:admin', publicUserData: { userId: access.userId } }] }; },
  } };
  const deps = { prisma: tx, clerk, access, body, environment,
    synchronize: async (db, { organization }) => { assert.equal(organization.id, 'org_pilot'); return { id: 'tenant-pilot', name: organization.name, clerkOrganizationId: organization.id, metadata: { internal: false }, subscriptionPlan: 'TRIAL', subscriptionStatus: 'TRIALING', trialEndsAt: state.expired ? new Date('2020-01-01') : new Date('2099-01-01') }; },
    identityLock: async (db, work, options) => { assert.ok(options.identityKeys.length > 0); const before = structuredClone({ memberships: state.memberships, projects: state.projects, audits: state.audits }); try { return await work(db); } catch (error) { Object.assign(state, before); throw error; } },
  };
  return { state, deps };
}
test('explicit pilot creates a separate organization/project and owner membership, not a WhatsApp connection', async () => {
  const { state, deps } = fixture(); const result = await provisionPilotWorkspace(deps);
  assert.equal(result.status, 'READY_FOR_CONNECTION'); assert.equal(result.organization.id, 'tenant-pilot'); assert.notEqual(result.organization.id, access.organization.id);
  assert.equal(state.creates, 1); assert.equal(state.memberships.length, 1); assert.equal(state.projects.length, 1); assert.equal(state.audits.length, 1); assert.equal(result.messagesSent, false); assert.equal(result.connectionCreated, false);
});
test('same request recovers the same remote organization, membership, project and audit receipt', async () => {
  const { state, deps } = fixture(); const a = await provisionPilotWorkspace(deps), b = await provisionPilotWorkspace(deps);
  assert.deepEqual(a.project, b.project); assert.equal(state.creates, 1); assert.equal(state.audits.length, 1); assert.equal(state.memberships.length, 1);
});
test('lost provider response is read back without sending another create', async () => {
  const { state, deps } = fixture(); state.lostResponse = true; const result = await provisionPilotWorkspace(deps);
  assert.equal(result.status, 'READY_FOR_CONNECTION'); assert.equal(state.creates, 1);
});
for (const env of [{ VERCEL_ENV: 'production' }, { WHATSAPP_PILOT_IMPORT_ENABLED: 'false' }]) test('unavailable outside explicit preview pilot: ' + JSON.stringify(env), async () => {
  const { state, deps } = fixture(); await assert.rejects(provisionPilotWorkspace({ ...deps, environment: { ...environment, ...env } }), { status: 404 }); assert.equal(state.creates, 0);
});
test('ordinary tenant user cannot provision from this administration route', async () => { const { state, deps } = fixture(); await assert.rejects(provisionPilotWorkspace({ ...deps, access: { ...access, isSuperadmin: false } }), { status: 404 }); assert.equal(state.creates, 0); });
test('changed names cannot silently reuse a previous pilot receipt', async () => { const { state, deps } = fixture(); await provisionPilotWorkspace(deps); await assert.rejects(provisionPilotWorkspace({ ...deps, body: { ...body, projectName: 'Obra diferente' } }), { code: 'PILOT_SETUP_EXISTING_CONTEXT_CONFLICT' }); assert.equal(state.creates, 1); });
test('current remote membership is required even on retry', async () => { const { state, deps } = fixture(); await provisionPilotWorkspace(deps); state.revoked = true; await assert.rejects(provisionPilotWorkspace(deps), { status: 403 }); assert.equal(state.audits.length, 1); });
test('expired trial is not extended silently', async () => { const { state, deps } = fixture(); state.expired = true; await assert.rejects(provisionPilotWorkspace(deps), { code: 'PILOT_SETUP_SUBSCRIPTION_REQUIRED' }); assert.equal(state.projects.length, 0); });
test('audit failure rolls back database provisioning while preserving recoverable remote identity', async () => { const { state, deps } = fixture(); state.auditFail = true; await assert.rejects(provisionPilotWorkspace(deps)); assert.equal(state.projects.length, 0); state.auditFail = false; await provisionPilotWorkspace(deps); assert.equal(state.creates, 1); assert.equal(state.audits.length, 1); });
test('revoked database membership is not restored by provisioning', async () => { const { state, deps } = fixture(); await provisionPilotWorkspace(deps); state.memberships[0].status = 'SUSPENDED'; await assert.rejects(provisionPilotWorkspace(deps), { code: 'PILOT_SETUP_EXISTING_MEMBERSHIP_RESTRICTED' }); });
for (const patch of [{ confirmIsolatedPilot: false }, { organizationName: '' }, { actorId: 'other' }, { projectId: 'other' }, { accessToken: 'secret' }, { organizationName: 'x'.repeat(101) }, { projectName: 'bad\u0000text' }]) test('untrusted provisioning fields rejected: ' + Object.keys(patch)[0], () => assert.throws(() => normalizePilotWorkspaceInput({ ...body, ...patch })));

test('disabled organization slugs do not become a lost-response loop or a partial tenant', async () => {
  const { state, deps } = fixture(); const original = deps.clerk.organizations.createOrganization; let reads = 0;
  const read = deps.clerk.organizations.getOrganization;
  deps.clerk.organizations.getOrganization = async args => { reads++; return read(args); };
  deps.clerk.organizations.createOrganization = async () => { state.creates++; throw Object.assign(new Error('private provider response'), { status: 403, errors: [{ code: 'organization_slugs_disabled' }] }); };
  await assert.rejects(provisionPilotWorkspace(deps), error => error.code === 'PILOT_SETUP_SLUGS_DISABLED' && error.status === 409 && error.message.includes('Clerk') && !error.message.includes('private provider response'));
  assert.equal(reads, 1); assert.equal(state.creates, 1); assert.equal(state.remote, null);
  assert.equal(state.projects.length, 0); assert.equal(state.memberships.length, 0); assert.equal(state.audits.length, 0);
  deps.clerk.organizations.createOrganization = original;
  const confirmed = await provisionPilotWorkspace(deps);
  assert.equal(confirmed.status, 'READY_FOR_CONNECTION'); assert.equal(state.projects.length, 1);
  await provisionPilotWorkspace(deps); assert.equal(state.creates, 2); assert.equal(state.audits.length, 1);
});
test('a slug-disabled lookup fails before requesting a create', async () => {
  const { state, deps } = fixture();
  deps.clerk.organizations.getOrganization = async () => { throw Object.assign(new Error('private'), { status: 403, errors: [{ code: 'organization_slugs_disabled' }] }); };
  await assert.rejects(provisionPilotWorkspace(deps), { code: 'PILOT_SETUP_SLUGS_DISABLED', status: 409 }); assert.equal(state.creates, 0);
});
test('ambiguous provider failure still reads back without issuing a second create', async () => {
  const { state, deps } = fixture(); let reads = 0;
  const read = deps.clerk.organizations.getOrganization;
  deps.clerk.organizations.getOrganization = async args => { reads++; return read(args); };
  deps.clerk.organizations.createOrganization = async () => { state.creates++; throw new Error('network result unknown'); };
  await assert.rejects(provisionPilotWorkspace(deps), { code: 'PILOT_SETUP_PROVIDER_UNCONFIRMED' });
  assert.equal(state.creates, 1); assert.equal(reads, 2); assert.equal(state.projects.length, 0);
});
