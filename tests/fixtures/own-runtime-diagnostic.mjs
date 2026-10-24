import assert from 'node:assert/strict';
import {ownCompanyRuntimeFixture} from './own-company-runtime.mjs';
import {createOwnCompanyConnection} from '../../src/lib/meta-own-company-connection.mjs';
import {COMPANY_CHANNEL_SCHEMA_CONTRACT} from '../../src/lib/company-channel-schema.mjs';
import {digest,WorkspaceError} from '../../src/lib/workspace-policy.mjs';

// Proposed fixture only. These imports resolve after the proposal is applied to
// a reviewed checkout. It is not executable as this incomplete private mirror.
export async function ownRuntimeDiagnosticFixture(){
 const f=await ownCompanyRuntimeFixture();
 f.time=Date.parse(f.policy.expiresAt)+1;
 f.member=structuredClone(f.context.member);f.session={...f.context.session,expiresAt:Math.floor(f.time/1000)+300};
 f.request={projectId:f.policy.projectId,scope:'a'.repeat(64)};
 f.channelState={mode:'COMPANY',revision:2};f.schemaReady=true;f.projectPresent=true;f.channelPresent=true;
 f.operations=[];f.reads=[];f.afterQuery=null;
 const rows=value=>({rows:value});
 const client={async query(sql,args=[]){
  f.reads.push({sql,args});assert.match(sql.trim(),/^SELECT\b/i,'diagnostic cannot write');assert.doesNotMatch(sql,/\bFOR\s+UPDATE\b/i);
  let result;
  if(sql==='SELECT clock_timestamp() AS now')result=rows([{now:new Date(f.time)}]);
  else if(sql.includes('JOIN public."WhatsAppCompanyChannel" cc'))result=rows(f.channelPresent?[{...structuredClone(f.connection),...f.channelState}]:[]);
  else if(sql.startsWith('SELECT revision,mode FROM public."WhatsAppCompanyChannel"')){
   assert.deepEqual(args,[f.connection.id,f.member.organizationId,f.request.projectId]);result=rows(f.channelPresent?[{...f.channelState}]:[]);
  }
  else if(sql.includes('to_regclass'))result=rows([{present:f.schemaReady,count:1}]);
  else if(sql.startsWith('SELECT\n  (SELECT COALESCE(JSON_AGG(JSON_BUILD_OBJECT('))result=rows([{columns:[],keys:[],indexes:[],triggers:[]}]);
  else if(sql.startsWith('SELECT version,contract,"catalogFingerprint",'))result=rows([{version:1,contract:COMPANY_CHANNEL_SCHEMA_CONTRACT,catalogFingerprint:digest({columns:[],keys:[],indexes:[],triggers:[]}),currentCatalog:{columns:[],keys:[],indexes:[],triggers:[]},catalog:args[1].map(conname=>({conname,convalidated:true})),indexes:args[2].map(relname=>({relname,indisvalid:true,indisready:true,indisunique:true})),triggers:args[3].map(tgname=>({tgname,tgenabled:'O'}))}]);
  else if(sql.includes('information_schema.columns'))result=rows(sql.includes("column_name='catalogFingerprint'")?[{count:1}]:[]);
  else if(sql.includes('FROM public."WhatsAppCompanySchema"'))result=rows([{version:1,contract:COMPANY_CHANNEL_SCHEMA_CONTRACT,catalogFingerprint:digest({columns:[],keys:[],indexes:[],triggers:[]})}]);
  else if(sql.includes('FROM pg_constraint WHERE'))result=rows(args[0].map(conname=>({conname,convalidated:true})));
  else if(sql.includes('FROM pg_index i JOIN pg_class c')&&!sql.includes('pg_get_indexdef'))result=rows(args[0].map(relname=>({relname,indisvalid:true,indisready:true,indisunique:true})));
  else if(sql.includes('FROM pg_trigger WHERE'))result=rows(args[0].map(tgname=>({tgname,tgenabled:'O'})));
  else if(sql.includes('pg_get_constraintdef')||sql.includes('pg_get_indexdef')||sql.includes('pg_get_triggerdef'))result=rows([]);
  else result=await f.client.query(sql,args);
  if(f.afterQuery)await f.afterQuery(sql,args);return result;
 }};
 const workspace={async organizationOperation(session,context,writable,callback,archived=false){
  f.operations.push({writable,archived});
  // This models the existing READ COMMITTED transaction with SHARE locks.
  // Writable transaction mode is not permission for any diagnostic SQL write.
  assert.equal(writable,true);assert.equal(archived,false);
  if(context.scope!=='a'.repeat(64))throw new WorkspaceError('WORKSPACE_CONTEXT_CHANGED',409);
  if(!f.projectPresent||context.projectId!==f.policy.projectId)throw new WorkspaceError('WORKSPACE_PROJECT_UNAVAILABLE',404);
  if(f.member.role!=='ADMIN'||f.member.officeReviewOnly===true)throw new WorkspaceError('WORKSPACE_ORGANIZATION_PERMISSION_REQUIRED',403);
  return callback(client,f.member,f.request.scope);
 }};
 f.makeService=(provider=f.provider)=>createOwnCompanyConnection({workspace,provider,environment:f.environment,now:()=>f.time});
 f.service=f.makeService();f.diagnose=()=>f.service.diagnoseRuntime(f.session,f.request);
 f.runtimeInput=async()=>({capability:await f.capability(),connection:f.connection,token:f.token,beforeExternal:()=>f.beforeExternal(f.connection)});
 f.calls.length=0;f.queries.length=0;
 return f;
}

export function assertDiagnosticNoEffects(f){
 assert.ok(f.calls.every(call=>call.method==='GET'));
 assert.equal(f.calls.filter(call=>call.method==='POST').length,0);
 assert.ok(f.reads.every(({sql})=>/^SELECT\b/i.test(sql.trim())));
 assert.ok(f.queries.every(({sql})=>/^SELECT\b/i.test(sql.trim())));
 assert.ok(f.operations.every(op=>op.writable===true&&op.archived===false));
}
