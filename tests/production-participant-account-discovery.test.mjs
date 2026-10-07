import test from 'node:test';
import assert from 'node:assert/strict';
import {createParticipantStore} from '../src/lib/participant-store.mjs';
import {createParticipantHandlers} from '../src/lib/participant-http.mjs';
import {createWorkspaceStore} from '../src/lib/workspace-store.mjs';
import {scopeStamp,digest} from '../src/lib/workspace-policy.mjs';
import {participantAccountCursor,participantAccountQuery} from '../src/lib/participant-account-discovery.mjs';

const revision='2026-10-07T09:00:00.000001';
const session={authenticated:true,verification:'clerk-production-jwt',userId:'user_Owner',organizationId:'org_A',organizationRole:'org:admin'};
const account=(n,extra={})=>({membershipId:'member-'+String(n).padStart(3,'0'),organizationId:'company-a',userId:'actor-'+n,clerkUserId:'user_Employee'+n,name:'Synthetic account '+n,email:'account'+n+'@example.invalid',role:'AUDITOR',clerkRole:'org:member',status:'ACTIVE',revision,phone:'+5491100000000',bankAccount:'private-bank',metadata:{kyc:'private-identity'},...extra});

function fixture({rows=Array.from({length:103},(_,i)=>account(i+1)),role='ADMIN'}={}){
 const member={actorId:'actor-owner',membershipId:'member-owner',organizationId:'company-a',organizationName:'Synthetic company',role};
 const state={activeMember:true,activeProject:true,assigned:true,duplicateAnchor:false,duplicatePage:false,rows},queries=[];
 const lookup=text=>text.toLocaleLowerCase('es-AR');
 const client={release:()=>{},query:async(sql,args=[])=>{
  queries.push({sql,args});assert.ok(/^(SELECT|BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY|SET LOCAL|ROLLBACK)/.test(sql),'Account discovery cannot write or commit');
  if(/^(BEGIN|SET LOCAL|ROLLBACK)/.test(sql))return {rows:[]};
  if(sql.includes('WHERE u."clerkUserId"=$1')){assert.deepEqual(args,[session.userId,session.organizationId,session.organizationRole]);return {rows:state.activeMember?[{...member}]:[]};}
  if(sql.includes('FROM public."ProjectMembership"'))return {rows:state.assigned?[{id:'assignment'}]:[]};
  if(sql.includes('FROM public."Project"'))return {rows:state.activeProject&&args[1]===member.organizationId?[{id:args[0],name:'Synthetic project',metadata:{},organizationMetadata:{}}]:[]};
  if(sql.includes('FROM public."Worker"'))return {rows:[]};
  if(sql.includes('to_regclass'))return {rows:[{present:false}]};
  if(sql.includes('FROM public."WhatsAppConnection"'))return {rows:[]};
  assert.ok(sql.includes('FROM public."TenantMembership" tm'),'Unexpected read '+sql);
  assert.match(sql,/tm\."organizationId"=\$1 AND tm\.status='ACTIVE'/);
  assert.match(sql,/strpos\(lower\(translate\(COALESCE\(u\."fullName"/);
  assert.match(sql,/strpos\(lower\(translate\(COALESCE\(u\."primaryEmail"/);
  assert.doesNotMatch(sql,/\bLIKE\b|\bILIKE\b|phone|bankAccount/);
  const [organizationId,query,after,exact]=args;
  let matches=state.rows.filter(row=>row.organizationId===organizationId&&row.status==='ACTIVE'&&(!query||lookup(row.name||'').includes(lookup(query))||lookup(row.email||'').includes(lookup(query))));
  if(sql.includes('AND tm.id=$3')){matches=matches.filter(row=>row.membershipId===after);if(state.duplicateAnchor&&matches.length)matches.push({...matches[0]});return {rows:structuredClone(matches)};}
  assert.match(sql,/ORDER BY tm\.id LIMIT 101$/);
  matches=matches.filter(row=>(!after||row.membershipId>after)&&(!exact||row.membershipId===exact)).sort((a,b)=>a.membershipId.localeCompare(b.membershipId)).slice(0,101);
  if(state.duplicatePage&&matches.length)matches.push({...matches[0]});
  return {rows:structuredClone(matches)};
 }};
 let connections=0;
 const connect=async()=>{connections++;return client;},forbidden=()=>assert.fail('Discovery cannot call a provider, private storage or identity verification');
 const store=createParticipantStore({workspace:createWorkspaceStore({connect}),connect:forbidden,identity:{verifyMembership:forbidden,verifiedEmail:forbidden,createInvitation:forbidden,findInvitation:forbidden},upload:forbidden,get:forbidden,environment:{}});
 const context=extra=>({projectId:'project-a',scope:scopeStamp(session,member),...extra});
 return {store,member,state,queries,context,connections:()=>connections};
}

test('canonical first page and next page discover account 101 even if its worker belongs to another project',async()=>{
 const f=fixture();f.state.rows[100].otherProjectWorkerId='worker-other-project';
 f.state.rows.push(account(0,{organizationId:'company-b',email:'foreign@example.invalid'}),account(0,{status:'INACTIVE'}));
 const before=JSON.stringify(f.state.rows),first=await f.store.accounts(session,f.context());
 assert.equal(first.existingAccounts.length,100);assert.equal(first.existingAccounts[99].membershipId,'member-100');assert.equal(first.existingAccountsTruncated,true);assert.ok(first.nextAccountCursor);
 const next=await f.store.accounts(session,f.context({afterAccount:first.nextAccountCursor}));
 assert.deepEqual(next.existingAccounts.map(row=>row.membershipId),['member-101','member-102','member-103']);assert.equal(next.nextAccountCursor,null);assert.equal(next.existingAccountsTruncated,false);
 assert.equal(new Set([...first.existingAccounts,...next.existingAccounts].map(row=>row.membershipId)).size,103);assert.equal(JSON.stringify(f.state.rows),before);
 const base=await f.store.read(session,f.context());assert.deepEqual(base.existingAccounts,first.existingAccounts);assert.equal(base.nextAccountCursor,first.nextAccountCursor);assert.equal(base.accountQuery,'');
 assert.ok(f.queries.filter(query=>query.sql.startsWith('BEGIN')).every(query=>query.sql.endsWith('READ ONLY')));
});

test('name/email lookup is literal, bounded and case aware with Spanish names',async()=>{
 const f=fixture({rows:[account(1,{name:'ÁLVARO Ñandú',email:'owner@example.invalid'}),account(2,{name:'100%_\\ quoted\' value'}),account(3,{name:'100anythingX value',email:'search@example.invalid'})]});
 for(const [query,ids] of [[' álvaro ñANDÚ ',['member-001']],['OWNER@',['member-001']],['%_\\',['member-002']],["quoted'",['member-002']],['search@example.invalid',['member-003']]]){
  const page=await f.store.accounts(session,f.context({query}));assert.deepEqual(page.existingAccounts.map(row=>row.membershipId),ids);assert.equal(page.accountQuery,query.normalize('NFC').trim());
 }
 assert.equal(participantAccountQuery('A\u0301LVARO'),'ÁLVARO');
 assert.equal((await f.store.accounts(session,f.context({query:'x'.repeat(80)}))).existingAccounts.length,0);
 const count=f.connections();for(const query of ['x'.repeat(81),' '.repeat(81),'bad\ntext','bad\u0000text','bad\u0085text','\ud800',42,null])await assert.rejects(async()=>f.store.accounts(session,f.context({query})),{code:'PARTICIPANT_ACCOUNT_QUERY_INVALID'});assert.equal(f.connections(),count);
});

test('exact readback returns current revision and protected capabilities without private identity fields',async()=>{
 const f=fixture({rows:[account(101,{name:'Current name',role:'FINANCE',revision:'2026-10-07T10:00:00.000002'})]});
 const page=await f.store.accounts(session,f.context({accountId:'member-101'})),row=page.existingAccounts[0];
 assert.equal(page.accountId,'member-101');assert.equal(page.accountQuery,'');assert.equal(page.canManageOfficeRoles,true);assert.equal(page.canManage,true);assert.equal(page.canInvite,true);assert.equal(page.nextAccountCursor,null);
 assert.equal(row.revision,'2026-10-07T10:00:00.000002');assert.equal(row.role,'FINANCE');assert.equal(row.canChangeRole,true);
 assert.deepEqual(Object.keys(row).sort(),['membershipId','name','email','role','roleLabel','roleScope','revision','status','self','canChangeRole'].sort());
 for(const extra of [{userId:f.member.actorId},{role:'ADMIN'},{clerkRole:'org:admin'}]){Object.assign(f.state.rows[0],extra);assert.equal((await f.store.accounts(session,f.context({accountId:'member-101'}))).existingAccounts[0].canChangeRole,false);}
 assert.doesNotMatch(JSON.stringify(page),/phone|bankAccount|private-bank|clerkUserId|private-identity|otherProjectWorkerId/);
});

test('foreign, inactive and missing exact accounts are indistinguishable and cannot mix with search or cursor',async()=>{
 const f=fixture({rows:[account(101,{organizationId:'company-b'}),account(102,{status:'INACTIVE'})]});
 for(const accountId of ['member-101','member-102','member-missing'])await assert.rejects(f.store.accounts(session,f.context({accountId})),{code:'PARTICIPANT_ACCOUNT_UNAVAILABLE',status:404});
 const count=f.connections();for(const extra of [{accountId:'member-101',query:''},{accountId:'member-101',afterAccount:'a~'+'a'.repeat(64)},{accountId:''},{phone:'+5491100000000'}])await assert.rejects(async()=>f.store.accounts(session,f.context(extra)),{code:'PARTICIPANT_ACCOUNT_QUERY_INVALID'});assert.equal(f.connections(),count);
});

for(const change of ['actor','membership','organization','project','query'])test(`cursor is unavailable in a different current ${change} context`,async()=>{
 const f=fixture(),context=f.context({query:''}),first=await f.store.accounts(session,context);f.queries.length=0;
 if(change==='actor')f.member.actorId='actor-other';if(change==='membership')f.member.membershipId='member-other';if(change==='organization')f.member.organizationId='company-b';
 const next=f.context({afterAccount:first.nextAccountCursor,...(change==='project'?{projectId:'project-b'}:{}),...(change==='query'?{query:'Synthetic'}:{})});
 await assert.rejects(f.store.accounts(session,next),{code:'PARTICIPANT_ACCOUNT_CURSOR_UNAVAILABLE',status:404});assert.equal(f.queries.some(query=>query.sql.includes('FROM public."TenantMembership" tm')),false);
});

for(const change of ['revision','inactive','removed','search','duplicate'])test(`pagination rejects a stale or ambiguous anchor: ${change}`,async()=>{
 const f=fixture(),first=await f.store.accounts(session,f.context({query:'Synthetic'})),anchor=f.state.rows[99];
 if(change==='revision')anchor.revision='2026-10-07T10:00:00.000002';if(change==='inactive')anchor.status='INACTIVE';if(change==='removed')f.state.rows.splice(99,1);if(change==='search'){anchor.name='Different name';anchor.email='different@example.invalid';}if(change==='duplicate')f.state.duplicateAnchor=true;
 f.queries.length=0;await assert.rejects(f.store.accounts(session,f.context({query:'Synthetic',afterAccount:first.nextAccountCursor})),{code:'PARTICIPANT_ACCOUNT_CURSOR_UNAVAILABLE',status:404});assert.equal(f.queries.filter(query=>query.sql.includes('FROM public."TenantMembership" tm')).length,1,'No page is read after a bad anchor');
});

test('malformed, oversized and noncanonical cursors fail before account data is queried',async()=>{
 const f=fixture(),first=await f.store.accounts(session,f.context()),[encoded]=first.nextAccountCursor.split('~'),body=JSON.parse(Buffer.from(encoded,'base64url').toString('utf8'));
 const noncanonical=Buffer.from(JSON.stringify(body,null,1)).toString('base64url')+'~'+digest(body);
 for(const afterAccount of ['',first.nextAccountCursor+'=',encoded+'~'+'0'.repeat(64),'x'.repeat(1025),noncanonical]){f.queries.length=0;await assert.rejects(async()=>f.store.accounts(session,f.context({afterAccount})),{code:'PARTICIPANT_ACCOUNT_QUERY_INVALID'});assert.equal(f.queries.some(query=>query.sql.includes('FROM public."TenantMembership" tm')),false);}
 const foreign=participantAccountCursor(account(100),{...f.member,actorId:'foreign'},f.context(),f.context().scope,'');await assert.rejects(f.store.accounts(session,f.context({afterAccount:foreign})),{code:'PARTICIPANT_ACCOUNT_CURSOR_UNAVAILABLE'});
});

for(const role of ['DIRECTOR','SITE_MANAGER','FINANCE','AUDITOR'])test(`current ${role} cannot discover company accounts, including exact readback`,async()=>{
 const f=fixture({role});for(const extra of [{},{accountId:'member-101'}])await assert.rejects(f.store.accounts(session,f.context(extra)),{code:'WORKSPACE_ORGANIZATION_PERMISSION_REQUIRED',status:403});assert.equal(f.queries.some(query=>query.sql.includes('FROM public."TenantMembership" tm')),false);
});

test('old scope, revoked caller and archived project cannot retain account lookup authority',async()=>{
 const f=fixture(),old=f.context();await f.store.accounts(session,old);f.member.role='DIRECTOR';await assert.rejects(f.store.accounts(session,old),{code:'WORKSPACE_CONTEXT_CHANGED',status:409});
 f.member.role='ADMIN';f.state.activeMember=false;await assert.rejects(f.store.accounts(session,f.context()),{code:'WORKSPACE_MEMBERSHIP_REQUIRED',status:403});f.state.activeMember=true;f.state.activeProject=false;await assert.rejects(f.store.accounts(session,f.context()),{code:'WORKSPACE_PROJECT_UNAVAILABLE',status:404});
 const connections=f.connections();await assert.rejects(f.store.accounts({...session,authenticated:false},f.context()),{code:'SESSION_REQUIRED',status:401});assert.equal(f.connections(),connections);
});

test('ambiguous or malformed page rows fail closed instead of yielding duplicate selections',async()=>{
 const f=fixture({rows:[account(1)]});f.state.duplicatePage=true;await assert.rejects(f.store.accounts(session,f.context()),{code:'PARTICIPANT_ACCOUNT_RESULT_INVALID',status:503});f.state.duplicatePage=false;
 for(const extra of [{membershipId:'invalid/id'},{revision:'client timestamp'},{role:'org:admin'}]){f.state.rows=[account(1,extra)];await assert.rejects(f.store.accounts(session,f.context()),{code:'PARTICIPANT_ACCOUNT_RESULT_INVALID',status:503});}
});

const request=search=>new Request('https://obrasaas.com/api/identity/participants?projectId=project-a&scope='+'a'.repeat(64)+search,{headers:{'sec-fetch-site':'same-origin'}});
test('HTTP delegates only the exclusive current-account query and keeps private no-store headers',async()=>{
 const calls=[],api=createParticipantHandlers({verify:async()=>session,store:{accounts:async(current,input)=>{calls.push({current,input});return {scope:input.scope,existingAccounts:[],nextAccountCursor:null};}}});
 for(const suffix of ['&detail=existing-accounts','&detail=existing-accounts&query='+encodeURIComponent(' 100%_\\ '),'&detail=existing-accounts&accountId=member-101']){const result=await api.GET(request(suffix));assert.equal(result.status,200);assert.match(result.headers.get('Cache-Control'),/private, no-store/);assert.equal(result.headers.get('Vary'),'Cookie, Authorization');assert.equal(result.headers.get('Referrer-Policy'),'no-referrer');}
 assert.deepEqual(calls[1].input,{projectId:'project-a',scope:'a'.repeat(64),query:' 100%_\\ '});assert.equal(calls[2].input.accountId,'member-101');assert.equal(calls[0].current,session);
});

test('HTTP rejects duplicate, mixed, oversized and privacy-expanding query parameters before store access',async()=>{
 let calls=0;const forbid=()=>{calls++;assert.fail('Rejected query reached the store');},api=createParticipantHandlers({verify:async()=>session,store:{accounts:forbid,read:forbid,status:forbid,downloadKyc:forbid,privateBankRead:forbid}});
 const invalid=['&detail=existing-accounts&query=a&query=b','&detail=existing-accounts&accountId=member-101&accountId=member-102','&detail=existing-accounts&scope='+'a'.repeat(64),'&detail=existing-accounts&detail=existing-accounts','&detail=existing-accounts&afterAccount=a&afterAccount=b','&detail=existing-accounts&accountId=member-101&query=','&detail=existing-accounts&accountId=member-101&afterAccount=a','&detail=existing-accounts&operationId=00000000-0000-4000-8000-000000000000','&detail=existing-accounts&workerId=worker-a','&detail=existing-accounts&phone=private','&detail=existing-accounts&query='+'x'.repeat(81),'&detail=existing-accounts&query=%00','&detail=existing-accounts&afterAccount='+'x'.repeat(1025),'&query=name','&accountId=member-101','&detail=private-bank-account&workerId=worker-a&query=name'];
 for(const suffix of invalid)assert.equal((await api.GET(request(suffix))).status,400,suffix);assert.equal(calls,0);
 const crossSite=new Request(request('&detail=existing-accounts'),{headers:{'sec-fetch-site':'cross-site'}});assert.equal((await api.GET(crossSite)).status,403);assert.equal(calls,0);
});
