import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspaceHandlers} from '../src/lib/workspace-http.mjs';
import {createWorkspaceStore} from '../src/lib/workspace-store.mjs';
import {scopeStamp} from '../src/lib/workspace-policy.mjs';
import {portfolioOverviewMatches,mergePortfolioPages,portfolioDateLabel} from '../src/app/(identity)/cuenta/portfolio-overview-view.mjs';
const session={authenticated:true,verification:'clerk-production-jwt',userId:'user_Portfolio',organizationId:'org_Portfolio',organizationRole:'org:member'};
const member={actorId:'actor-a',membershipId:'membership-a',organizationId:'company-a',organizationName:'Empresa de ensayo',role:'AUDITOR'};
const scope=scopeStamp(session,member);
const row=(n=1)=>({id:'p-'+String(n).padStart(3,'0'),name:'Obra '+n,status:'ACTIVE',totalTasks:8,completedTasks:2,inProgressTasks:3,blockedTasks:1,unscheduledTasks:3,nextEndsOn:'2026-11-03'});
const snapshot=()=>({scope,organizationName:member.organizationName,role:member.role,projects:[row()],nextCursor:null});
const request=(query,method='GET',headers={})=>new Request('https://obrasaas.com/api/identity/workspace'+query,{method,headers});
function handlers(identity=session) {
 const calls=[];
 return {calls,api:createWorkspaceHandlers({verify:async()=>identity,store:{overview:async(...args)=>{calls.push(args);return snapshot();}}})};
}
test('authorized portfolio GET uses the verified identity and exact cursor; it is private',async()=>{
 const h=handlers(),response=await h.api.GET(request('?'+new URLSearchParams({portfolio:'1',scope,afterProject:'p-001'})));
 assert.equal(response.status,200);assert.deepEqual(h.calls,[[session,{scope,afterProject:'p-001'}]]);
 assert.equal(response.headers.get('cache-control'),'private, no-store, max-age=0');assert.match(response.headers.get('vary'),/Authorization/);assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow');
});
for(const query of ['?portfolio=2&scope='+scope,'?portfolio=1&scope=bad','?portfolio=1&scope='+scope+'&projectId=foreign','?portfolio=1&scope='+scope+'&role=ADMIN','?portfolio=1&scope='+scope+'&organizationId=foreign','?portfolio=1&scope='+scope+'&scope='+scope,'?portfolio=1&portfolio=1&scope='+scope,'?portfolio=1&scope='+scope+'&afterProject=','?portfolio=1&scope='+scope+'&afterProject=../foreign'])test('portfolio refuses ambiguous or forged query '+query,async()=>{
 const h=handlers();assert.equal((await h.api.GET(request(query))).status,400);assert.equal(h.calls.length,0);
});
test('anonymous, personal and cross-site reads cannot consult a portfolio',async()=>{
 for(const [identity,status] of [[{authenticated:false},401],[{...session,organizationId:undefined},403]]){const h=handlers(identity);assert.equal((await h.api.GET(request('?portfolio=1&scope='+scope))).status,status);assert.equal(h.calls.length,0);}
 const h=handlers();assert.equal((await h.api.GET(request('?portfolio=1&scope='+scope,'GET',{'sec-fetch-site':'cross-site'}))).status,403);assert.equal(h.calls.length,0);
});
test('portfolio query cannot mutate an existing workspace command',async()=>{
 const h=handlers();assert.equal((await h.api.POST(request('?portfolio=1&scope='+scope,'POST',{origin:'https://obrasaas.com'}))).status,403);assert.equal(h.calls.length,0);
});
test('overview keeps a read-only canonical transaction and bounds projection without private fields',async()=>{
 const queries=[],rows=Array.from({length:51},(_,i)=>({...row(i+1),extra:'MUST_NOT_PROJECT'}));
 const store=createWorkspaceStore({connect:async()=>({query:async(sql,args)=>{queries.push({sql,args});if(sql.includes('FROM public."PlatformUser"'))return {rows:[member]};if(sql.includes('FROM public."Project" p')&&!sql.includes('CROSS JOIN LATERAL')){assert.deepEqual(args,['company-a',false,'membership-a',null]);return {rows};}if(sql.includes('CROSS JOIN LATERAL')){assert.deepEqual(args,['company-a',rows.map(row=>row.id)]);return {rows};}return {rows:[]};},release:()=>{}})});
 const result=await store.overview(session,{scope});assert.equal(result.projects.length,50);assert.equal(result.nextCursor,'p-050');assert.equal(result.projects[0].extra,undefined);assert.equal(portfolioOverviewMatches(result,{scope,role:'AUDITOR'}),true);
 assert.ok(queries.some(q=>q.sql==='BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'));assert.equal(queries.at(-1).sql,'ROLLBACK');assert.ok(!queries.some(q=>/^(INSERT|UPDATE|DELETE|COMMIT)\b/.test(q.sql)));
 assert.ok(!queries.some(q=>/"WhatsAppConnection"|obrasaas_app_state/.test(q.sql)));
 assert.ok(queries.filter(q=>q.sql.includes('"Worker"')).every(q=>!q.sql.includes('SELECT metadata')&&!q.sql.includes('phone')));
 assert.ok(queries.filter(q=>q.sql.includes('"AuditLog"')).every(q=>q.sql.includes("'INVITATION_ACCEPTED'")&&!q.sql.includes('SELECT metadata')));
});
test('scope and disabled canonical membership deny before any task read',async()=>{
 for(const identityRows of [[],[member]]){const queries=[],store=createWorkspaceStore({connect:async()=>({query:async sql=>{queries.push(sql);return {rows:sql.includes('FROM public."PlatformUser"')?identityRows:[]};},release:()=>{}})});
  await assert.rejects(store.overview(session,{scope:'f'.repeat(64)}),{code:identityRows.length?'WORKSPACE_CONTEXT_CHANGED':'WORKSPACE_MEMBERSHIP_REQUIRED'});assert.ok(!queries.some(q=>q.includes('FROM public."Task"')));
 }
});
test('strict view rejects response from another organization or role and invalid aggregate counts',()=>{
 assert.equal(portfolioOverviewMatches(snapshot(),{scope,role:'AUDITOR'}),true);
 for(const patch of [{scope:'b'.repeat(64)},{role:'DIRECTOR'},{tenantId:'company-other'},{nextCursor:'p-001'}])assert.equal(portfolioOverviewMatches({...snapshot(),...patch},{scope,role:'AUDITOR'}),false);
 for(const patch of [{totalTasks:-1},{completedTasks:9},{blockedTasks:1.2},{unscheduledTasks:'3'},{nextEndsOn:'2026-02-30'},{status:'ARCHIVED'},{privateDocument:'x'}])assert.equal(portfolioOverviewMatches({...snapshot(),projects:[{...row(),...patch}]},{scope,role:'AUDITOR'}),false);
});
test('page merge requires the cursor of the authorized preceding page and never deduplicates conflicting records silently',()=>{
 const first={...snapshot(),projects:Array.from({length:50},(_,i)=>row(i+1)),nextCursor:'p-050'},second={...snapshot(),projects:[row(51)]};
 assert.equal(portfolioOverviewMatches(first,{scope,role:'AUDITOR'}),true);assert.equal(mergePortfolioPages(first,second,'p-050').length,51);
 for(const incoming of [{...second,scope:'b'.repeat(64)},{...second,role:'ADMIN'},{...second,projects:[row(50)]}])assert.throws(()=>mergePortfolioPages(first,incoming,'p-050'));
 assert.throws(()=>mergePortfolioPages(first,second,'p-049'));assert.deepEqual(mergePortfolioPages(null,second,null),second.projects);
});
test('date formatting does not shift a planned calendar date by timezone',()=>{
 assert.equal(portfolioDateLabel('2026-11-03'),'03/11/2026');assert.equal(portfolioDateLabel(null),'Sin fecha pendiente registrada');assert.equal(portfolioDateLabel('2026-02-30'),'Sin fecha pendiente registrada');
});
