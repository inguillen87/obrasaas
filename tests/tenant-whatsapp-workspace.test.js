import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeTenantWorkspace, tenantWorkspaceFromMetadata, workspaceAuthorizationState, confirmsTenantWorkspaceSave } from '../src/lib/whatsapp/tenant-workspace-policy.js';
import { saveTenantWorkspace, readTenantWorkspace, assertTenantWorkspaceAuthorization } from '../src/lib/whatsapp/tenant-workspace.js';
const scope = { organizationId: 'company-a', projectId: 'project-a' };
const now = new Date('2026-09-19T14:00:00Z');
const input = { assistantName: 'Asistente de obra', numberMode: 'DEDICATED', initialProjectId: 'project-a', useCases: ['FIELD_REPORTS'], expectedRevision: 0, confirmOwnership: true };
function fixture() {
  const state = { org: { id: scope.organizationId, clerkOrganizationId: 'org_external_a', name: 'Empresa de ensayo', metadata: { businessProfile: { preserved: true } }, updatedAt: now },
    projects: [{ id: 'project-a', name: 'Obra A', status: 'ACTIVE', organizationId: scope.organizationId, metadata: { safetyPlan: 'preserved' }, updatedAt: now }, { id: 'project-b', name: 'Obra B', status: 'PLANNING', organizationId: scope.organizationId, metadata: null, updatedAt: now }, { id: 'foreign', name: 'Otra empresa', status: 'ACTIVE', organizationId: 'company-b' }], audits: [], writes: 0, failAudit: false, conflict: false };
  const tx = {
    $executeRawUnsafe: async () => 1,
    organization: {
      findUnique: async ({ where }) => where.id === state.org.id ? structuredClone(state.org) : null,
      updateMany: async () => { throw new Error('Organization metadata must not be overwritten'); },
    },
    project: {
      updateMany: async ({ where, data }) => { const p=state.projects.find(p=>p.id===where.id && p.organizationId===where.organizationId); if (!p || state.conflict || p.updatedAt?.getTime() !== where.updatedAt?.getTime()) return {count:0}; p.metadata=structuredClone(data.metadata); state.writes++; return {count:1}; },
      findFirst: async ({ where }) => state.projects.find(p => p.id === where.id && p.organizationId === where.organizationId) || null,
      findMany: async ({ where, take }) => { assert.equal(take,51); return state.projects.filter(p => p.organizationId === where.organizationId && where.status.in.includes(p.status)).slice(0,take); },
    },
    auditLog: { create: async ({ data }) => { if (state.failAudit) throw new Error('Audit unavailable'); state.audits.push(structuredClone(data)); return data; } },
  };
  const prisma = { ...tx, $transaction: async action => { const before = structuredClone(state); try { return await action(tx); } catch (e) { Object.assign(state,before); throw e; } } };
  return { prisma, state, save: (command = input, currentScope = scope) => saveTenantWorkspace(prisma, { scope: currentScope, actorId: 'admin-a', input: command, now }) };
}
test('unconfigured company has no agent activation or default number', async () => {
  const f = fixture(), view = await readTenantWorkspace(f.prisma,{scope});
  assert.equal(view.profile.configured,false); assert.equal(view.authorization.allowed,false); assert.equal(view.automationActivated,false);
  assert.equal(view.projects.length,1); assert.equal(f.state.writes,0);
});
test('save is project-scoped, preserves company and project metadata and records the acting administrator', async () => {
  const f=fixture(), body=await f.save();
  assert.equal(body.profile.revision,1); assert.equal(body.automationActivated,false); assert.equal(body.profile.mode,'REVIEW_REQUIRED');
  assert.equal(f.state.org.metadata.businessProfile.preserved,true); assert.equal(f.state.audits.length,1); assert.equal(f.state.audits[0].actorId,'admin-a');
  assert.equal(f.state.audits[0].metadata.assistantName,undefined); assert.equal(confirmsTenantWorkspaceSave(body,input,scope),true);
  const read=await readTenantWorkspace(f.prisma,{scope:{...scope,projectId:'project-b'}});
  assert.equal(read.profile.revision,0); assert.equal(read.authorization.code,'WORKSPACE_REQUIRED');
  assert.equal(f.state.projects[0].metadata.safetyPlan,'preserved'); assert.equal(f.state.org.metadata.whatsappWorkspace,undefined);
});
test('retry with identical content verifies the same preparation without another revision or audit',async()=>{
  const f=fixture();await f.save();const retry=await f.save();assert.equal(retry.unchanged,true);assert.equal(f.state.writes,1);assert.equal(f.state.audits.length,1);
});
test('new revision requires the last version and does not grant autonomous authority',async()=>{
  const f=fixture();await f.save();const result=await f.save({...input,assistantName:'Asistente Norte',expectedRevision:1});
  assert.equal(result.profile.revision,2);assert.equal(result.profile.mode,'REVIEW_REQUIRED');
  await assert.rejects(f.save({...input,assistantName:'Cambio obsoleto'}),{code:'WORKSPACE_CONFLICT'});assert.equal(f.state.writes,2);
});
for(const numberMode of ['BUSINESS_APP','EXISTING_API']) test('unsupported connection path is saved but cannot activate API-only onboarding: '+numberMode,async()=>{
  const f=fixture(),result=await f.save({...input,numberMode});assert.equal(result.profile.numberMode,numberMode);assert.equal(result.authorization.allowed,false);
  await assert.rejects(assertTenantWorkspaceAuthorization(f.prisma,{scope,preparedRevision:1}),{code:'WORKSPACE_ASSISTED_ONBOARDING'});
});
test('direct authorization requires a prepared version in this company and initial project',async()=>{
  const f=fixture();await assert.rejects(assertTenantWorkspaceAuthorization(f.prisma,{scope,preparedRevision:0}),{code:'WORKSPACE_REQUIRED'});
  await f.save();assert.equal((await assertTenantWorkspaceAuthorization(f.prisma,{scope,preparedRevision:1})).revision,1);
  await assert.rejects(assertTenantWorkspaceAuthorization(f.prisma,{scope,preparedRevision:0}),{code:'WORKSPACE_REVISION_CHANGED'});
  await assert.rejects(assertTenantWorkspaceAuthorization(f.prisma,{scope:{...scope,projectId:'project-b'},preparedRevision:1}),{code:'WORKSPACE_REQUIRED'});
});
test('project from another company is rejected without updating metadata',async()=>{
  const f=fixture();await assert.rejects(f.save({...input,initialProjectId:'foreign'}),{code:'WORKSPACE_PROJECT_MISMATCH'});assert.equal(f.state.writes,0);
});
for(const status of ['ARCHIVED','COMPLETED','PAUSED'])test('non-operational initial project is rejected: '+status,async()=>{
  const f=fixture();f.state.projects[0].status=status;await assert.rejects(f.save(),{code:'WORKSPACE_PROJECT_UNAVAILABLE'});assert.equal(f.state.writes,0);
});
test('the internal control organization cannot be used as a customer',async()=>{
  const f=fixture();f.state.org.clerkOrganizationId='system:obrasaas';await assert.rejects(f.save(),{code:'WORKSPACE_CUSTOMER_REQUIRED'});assert.equal(f.state.writes,0);
});
test('audit failure rolls back preparation',async()=>{
  const f=fixture();f.state.failAudit=true;await assert.rejects(f.save(),/Audit unavailable/);assert.equal(f.state.writes,0);assert.equal(f.state.org.metadata.whatsappWorkspace,undefined);
});
test('competing metadata update does not get overwritten',async()=>{
  const f=fixture();f.state.conflict=true;await assert.rejects(f.save(),{code:'WORKSPACE_CONFLICT'});assert.equal(f.state.audits.length,0);
});
for(const patch of [{tenantId:'other'},{ownership:'PLATFORM'},{mode:'AUTONOMOUS'},{assistantName:'<script>'},{assistantName:'a'.repeat(71)},{useCases:['PAYMENTS']},{useCases:['FIELD_REPORTS','FIELD_REPORTS']},{confirmOwnership:false},{expectedRevision:'1'}]) test('unknown authority or invalid value denied: '+Object.keys(patch)[0],()=>{
  assert.throws(()=>normalizeTenantWorkspace({...input,...patch}));
});
test('stored corruption never silently becomes a blank usable configuration',()=>{
  for(const metadata of [[],{whatsappWorkspace:{schemaVersion:99}},{whatsappWorkspace:{revision:NaN}}])assert.throws(()=>tenantWorkspaceFromMetadata(metadata),{code:'WORKSPACE_INTEGRITY'});
});
test('confirmation must match the same tenant and the submitted values',async()=>{
  const f=fixture(),body=await f.save();assert.equal(confirmsTenantWorkspaceSave({...body,organizationId:'other'},input,scope),false);
  assert.equal(confirmsTenantWorkspaceSave({...body,profile:{...body.profile,mode:'AUTONOMOUS'}},input,scope),false);
  assert.equal(workspaceAuthorizationState(body.profile,'foreign').allowed,false);
});

test('two worksites in one company retain independent assistant names and revisions', async () => {
  const f=fixture(), first=await f.save();
  const second=await f.save({...input,initialProjectId:'project-b',assistantName:'Asistente Sur'},{...scope,projectId:'project-b'});
  assert.equal(first.profile.revision,1); assert.equal(second.profile.revision,1);
  const a=await readTenantWorkspace(f.prisma,{scope});
  const b=await readTenantWorkspace(f.prisma,{scope:{...scope,projectId:'project-b'}});
  assert.equal(a.profile.assistantName,input.assistantName); assert.equal(b.profile.assistantName,'Asistente Sur');
  assert.equal(a.authorization.allowed,true); assert.equal(b.authorization.allowed,true);
  assert.equal(f.state.audits[0].entityId,'project-a'); assert.equal(f.state.audits[1].entityId,'project-b');
  assert.equal(f.state.org.metadata.whatsappWorkspace,undefined);
});
test('changing a second worksite does not expire the first worksite authorization revision',async()=>{
  const f=fixture();await f.save();
  await f.save({...input,initialProjectId:'project-b'},{...scope,projectId:'project-b'});
  await f.save({...input,initialProjectId:'project-b',assistantName:'Otro asistente',expectedRevision:1},{...scope,projectId:'project-b'});
  assert.equal((await assertTenantWorkspaceAuthorization(f.prisma,{scope,preparedRevision:1})).revision,1);
});
test('old single-company setup is visible only to its original worksite without writes',async()=>{
  const f=fixture(); f.state.org.metadata.whatsappWorkspace={...input,schemaVersion:1,revision:4,mode:'REVIEW_REQUIRED',ownership:'CUSTOMER',updatedAt:now.toISOString()};
  const before=structuredClone(f.state.org);
  const original=await readTenantWorkspace(f.prisma,{scope}), other=await readTenantWorkspace(f.prisma,{scope:{...scope,projectId:'project-b'}});
  assert.equal(original.profile.revision,4);assert.equal(original.profileSource,'LEGACY_ORGANIZATION');
  assert.equal(other.profile.configured,false);assert.equal(other.profileSource,'NONE');assert.equal(f.state.writes,0);assert.deepEqual(f.state.org,before);
});
test('updating legacy preparation writes the project only and preserves the original legacy record',async()=>{
  const f=fixture(); f.state.org.metadata.whatsappWorkspace={...input,schemaVersion:1,revision:4,mode:'REVIEW_REQUIRED',ownership:'CUSTOMER',updatedAt:now.toISOString()};
  const before=structuredClone(f.state.org);const result=await f.save({...input,assistantName:'Asistente actualizado',expectedRevision:4});
  assert.equal(result.profile.revision,5);assert.equal(result.profileSource,'PROJECT');
  assert.equal(f.state.projects[0].metadata.whatsappWorkspace.schemaVersion,2);assert.deepEqual(f.state.org,before);
});
test('a project record with the wrong worksite cannot fall back to the legacy configuration',async()=>{
  const f=fixture();await f.save();f.state.projects[0].metadata.whatsappWorkspace.initialProjectId='project-b';
  await assert.rejects(readTenantWorkspace(f.prisma,{scope}),{code:'WORKSPACE_INTEGRITY'});
  await assert.rejects(assertTenantWorkspaceAuthorization(f.prisma,{scope,preparedRevision:1}),{code:'WORKSPACE_INTEGRITY'});
});
test('readonly worksite exposes saved configuration but cannot authorize another Meta operation',async()=>{
  const f=fixture();await f.save();f.state.projects[0].status='ARCHIVED';const view=await readTenantWorkspace(f.prisma,{scope});
  assert.equal(view.profile.configured,true);assert.equal(view.projectWritable,false);assert.equal(view.authorization.allowed,false);
});
test('the browser receives one current worksite, never another site preparation',async()=>{
  const f=fixture();await f.save({...input,initialProjectId:'project-b',assistantName:'Do not disclose another site'},{...scope,projectId:'project-b'});
  const view=await readTenantWorkspace(f.prisma,{scope});assert.equal(view.projects.length,1);assert.equal(view.projects[0].id,'project-a');
  assert.ok(!JSON.stringify(view).includes('Do not disclose another site'));assert.equal(view.profileScope,'PROJECT');
});
