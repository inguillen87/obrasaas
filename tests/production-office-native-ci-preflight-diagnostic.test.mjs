import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {parse} from '@babel/parser';
import {Script} from 'node:vm';
import {formatOfficeNativeCiPreflightError} from '../scripts/lib/office-chat-native-ci-preflight-error.mjs';
const context='OFFICE_NATIVE_CI_CONTEXT_REJECTED';
const envelope='OFFICE_NATIVE_CI_ENVELOPE_REJECTED';
const error=(code,message)=>Object.assign(new Error(message),{code});

test('known initial context guards retain their error code and a bounded public label',()=>{
 for(const [message,label]of [['Reviewed Node version with no preload required','NODE_RUNTIME'],['Ambient DB/provider configuration forbidden','AMBIENT_DB_PROVIDER'],['Actual owned SQL PostgreSQL17 identity required','SQL_IDENTITY']]){
  assert.equal(formatOfficeNativeCiPreflightError(error(context,message)),context+' guard='+label);
 }
});
test('envelope argument errors retain the independent envelope error code',()=>{
 assert.equal(formatOfficeNativeCiPreflightError(error(envelope,'Use --expected-head <actual commit>')),envelope+' guard=EXPECTED_HEAD_ARGUMENT');
 assert.equal(formatOfficeNativeCiPreflightError(error(envelope,'Reviewed Node version with no preload required')),envelope+' guard=UNCLASSIFIED');
});
test('unknown context messages never expose connection strings, tokens, env, or stack',()=>{
 const secret='postgresql://private:password@host/db?token=private-token';
 const e=error(context,secret+'\nDATABASE_URL='+secret);e.stack=secret;e.stderr=secret;e.env={DATABASE_URL:secret};
 assert.equal(formatOfficeNativeCiPreflightError(e),context+' guard=UNCLASSIFIED');
});
test('known dynamic guards redact secret suffixes and inspect counts expose only fixed labels',()=>{
 const secret='postgresql://private:password@host/db?token=private-token';
 for(const [message,label]of [
  ['Checkout RAW differs from committed Git blob: '+secret,'CHECKOUT_RAW_BLOB_MISMATCH'],
  ['Missing committed CI source: '+secret,'COMMITTED_CI_SOURCE_MISSING'],
  ['One inspected container required','INSPECT_CONTAINER_COUNT'],
  ['One inspected image required','INSPECT_IMAGE_COUNT'],
  ['One inspected network required','INSPECT_NETWORK_COUNT'],
 ]){
  const output=formatOfficeNativeCiPreflightError(error(context,message));
  assert.equal(output,context+' guard='+label);assert.equal(output.includes(secret),false);
  assert.equal(formatOfficeNativeCiPreflightError(error('FOREIGN_ERROR_CODE',message)),'OFFICE_NATIVE_CI_PREFLIGHT_FAILED guard=UNCLASSIFIED');
 }
 for(const message of ['One inspected volume required',secret+' Checkout RAW differs from committed Git blob: private-file','Reviewed Node version with no preload required\nprivate-token']){
  assert.equal(formatOfficeNativeCiPreflightError(error(context,message)),context+' guard=UNCLASSIFIED');
 }
});
test('foreign exception codes cannot become diagnostic output even with a known message',()=>{
 for(const code of ['ECONNREFUSED','private-token\nPASSWORD=secret',{},null]){
  assert.equal(formatOfficeNativeCiPreflightError(error(code,'Actual owned SQL PostgreSQL17 identity required')),'OFFICE_NATIVE_CI_PREFLIGHT_FAILED guard=UNCLASSIFIED');
 }
});
test('accessors and coercion are not invoked when examining errors',()=>{
 let reads=0;const e={toString(){reads++;throw new Error('private-token');}};
 for(const key of ['code','message','stack','stderr'])Object.defineProperty(e,key,{get(){reads++;throw new Error('private-token');}});
 assert.equal(formatOfficeNativeCiPreflightError(e),'OFFICE_NATIVE_CI_PREFLIGHT_FAILED guard=UNCLASSIFIED');assert.equal(reads,0);
 const inherited=Object.create({code:context,message:'Reviewed Node version with no preload required'});
 assert.equal(formatOfficeNativeCiPreflightError(inherited),'OFFICE_NATIVE_CI_PREFLIGHT_FAILED guard=UNCLASSIFIED');
});
test('non-errors and hostile descriptors produce the fixed fallback without throwing',()=>{
 for(const e of [null,undefined,42,'private-token',new Proxy({},{getOwnPropertyDescriptor(){throw new Error('private-token');}})]){
  assert.equal(formatOfficeNativeCiPreflightError(e),'OFFICE_NATIVE_CI_PREFLIGHT_FAILED guard=UNCLASSIFIED');
 }
 const output=formatOfficeNativeCiPreflightError(error(context,'private-token'.repeat(10000)));assert.equal(output,context+' guard=UNCLASSIFIED');assert.ok(output.length<100);
});
test('real entrypoint rejects an invalid argument with safe stderr before context or evidence creation',()=>{
 const root=fileURLToPath(new URL('../',import.meta.url));
 const entry=fileURLToPath(new URL('../scripts/verify-office-chat-native-ci.mjs',import.meta.url));
 const evidence=new URL('../.vercel/office-chat-native-ci/',import.meta.url),existed=existsSync(evidence);
 const env={TZ:'UTC',NO_COLOR:'1'};
 for(const key of ['SystemRoot','WINDIR','TEMP','TMP'])if(typeof process.env[key]==='string')env[key]=process.env[key];
 const child=spawnSync(process.execPath,[entry,'--invalid-preflight-argument'],{cwd:root,env,encoding:'utf8',maxBuffer:64*1024});
 assert.equal(child.error,undefined);assert.equal(child.signal,null);assert.equal(child.status,1);
 assert.equal(child.stdout,'');
 assert.equal(child.stderr.trim(),'OFFICE_NATIVE_CI_ENVELOPE_REJECTED guard=EXPECTED_HEAD_ARGUMENT');
 assert.equal(existsSync(evidence),existed,'Argument rejection must not create the native evidence directory');
});

// These unit cases exercise the actual SQL identity function with a controlled
// pg dependency only. They neither claim a GitHub context nor contact a DB.
function sqlIdentityFixture({patch={},queryFailure=false}={}){
 const source=readFileSync(new URL('../scripts/lib/office-chat-native-ci-context.mjs',import.meta.url),'utf8');
 const tree=parse(source,{sourceType:'module'});
 const exported=name=>{
  const found=tree.program.body.filter(node=>node.type==='ExportNamedDeclaration'&&node.declaration?.type==='FunctionDeclaration'&&node.declaration.id?.name===name);
  assert.equal(found.length,1);return found[0].declaration;
 };
 const identity=exported('officeCiSqlIdentity'),connection=exported('officeCiConnection');
 const guards=tree.program.body.filter(node=>node.type==='VariableDeclaration').flatMap(node=>node.declarations).filter(node=>node.id.type==='Identifier'&&node.id.name==='requireCi');
 assert.equal(guards.length,1);
 const imports=[];
 const visit=node=>{
  if(!node||typeof node!=='object')return;
  if(node.type==='AwaitExpression'){
   const value=node.argument;
   if(value?.type==='CallExpression'&&value.callee?.type==='Import'&&value.arguments.length===1&&value.arguments[0]?.value==='pg'||value?.type==='ImportExpression'&&value.source?.value==='pg')imports.push(node);
  }
  for(const value of Object.values(node))if(Array.isArray(value))for(const item of value)visit(item);else if(value&&typeof value==='object')visit(value);
 };
 visit(identity);assert.equal(imports.length,1);
 const dynamic=imports[0],body=source.slice(identity.start,dynamic.start)+'pgFixture'+source.slice(dynamic.end,identity.end);
 const trace={connected:0,ended:0,queries:[],connection:null};
 const address='192.0.2.15',networkName='synthetic-network';
 class Client{
  constructor(options){trace.connection={...options};}
  async connect(){trace.connected++;}
  async query(sql){
   trace.queries.push(sql);
   if(queryFailure)throw new Error('synthetic SQL failure');
   // PostgreSQL17 documents ::text as address/netmask and host(inet) as bare IP.
   // Keeping both forms makes the historical query fail the positive case.
   const projection=sql.match(/,(host\(inet_server_addr\(\)\)|inet_server_addr\(\)::text) AS address,/);
   assert.ok(projection,'The actual query must select the server address explicitly');
   const value=projection[1]==='host(inet_server_addr())'?address:address+'/32';
   return {rows:[{id:'1234567890123456789',data:'/var/lib/postgresql/data',port:'5432',timezone:'UTC',version:170000,actor:'cutover_test',database:'obrasaas_cutover_ci',address:value,connection_port:5432,started:new Date('2026-01-01T00:00:01.000Z'),...patch}]};
  }
  async end(){trace.ended++;}
 }
 const script='const requireCi='+source.slice(guards[0].init.start,guards[0].init.end)+';const officeCiConnection='+source.slice(connection.start,connection.end)+';('+body+')';
 // Use the same Date intrinsic as the pg double's Date values; no cross-realm
 // Date failure can masquerade as a SQL identity denial.
 const run=new Script(script,{filename:'actual-office-sql-identity-isolated-pg'}).runInNewContext({pgFixture:{Client},Date});
 const observation={container:{environment:{PGDATA:'/var/lib/postgresql/data'},networks:{[networkName]:{IPAddress:address}},startedAt:'2026-01-01T00:00:00.000Z'},context:{networkName}};
 return {run:()=>run(observation),trace,address};
}

test('SQL identity projects the bare PostgreSQL server host and retains the exact owned endpoint',async()=>{
 const f=sqlIdentityFixture(),result=await f.run();
 assert.equal(result.address,f.address);assert.equal(result.started,'2026-01-01T00:00:01.000Z');
 assert.equal(f.trace.queries.length,1);assert.match(f.trace.queries[0],/,host\(inet_server_addr\(\)\) AS address,/);
 assert.equal(f.trace.queries[0].includes('inet_server_addr()::text AS address'),false);
 assert.deepEqual(f.trace.connection,{host:'127.0.0.1',port:5432,user:'cutover_test',password:'cutover_test',database:'obrasaas_cutover_ci',ssl:false,connectionTimeoutMillis:2000,statement_timeout:8000,options:'-c TimeZone=UTC'});
 assert.equal(f.trace.connected,1);assert.equal(f.trace.ended,1);
});

test('SQL identity keeps all ownership attributes exact and rejects masks rather than broadening a suffix match',async()=>{
 const denied=[
  ['different host',{address:'192.0.2.16'}],['masked host',{address:'192.0.2.15/32'}],['network suffix',{address:'192.0.2.15/24'}],['null Unix address',{address:null}],['whitespace address',{address:'192.0.2.15 '}],
  ['different data directory',{data:'/var/lib/postgresql/other'}],['different configured port',{port:'5433'}],['different connection port',{connection_port:5433}],['noninteger connection port',{connection_port:'5432'}],
  ['different timezone',{timezone:'America/Argentina/Buenos_Aires'}],['different role',{actor:'another_role'}],['different database',{database:'another_database'}],
  ['old PostgreSQL',{version:160999}],['next PostgreSQL',{version:180000}],['version string',{version:'170000'}],['fractional version',{version:170000.5}],
  ['short system identifier',{id:'123'}],['nondigit system identifier',{id:'123456789x'}],
 ];
 for(const [label,patch]of denied){
  const f=sqlIdentityFixture({patch});
  await assert.rejects(f.run(),e=>e.code===context&&e.message==='Actual owned SQL PostgreSQL17 identity required',label);
  assert.equal(f.trace.connected,1,label);assert.equal(f.trace.ended,1,label);
 }
});

test('SQL identity retains the postmaster-start guard and releases its client on query failure',async()=>{
 for(const started of [new Date('2025-12-31T23:59:58.000Z'),new Date('invalid'),'2026-01-01T00:00:01.000Z']){
  const f=sqlIdentityFixture({patch:{started}});
  await assert.rejects(f.run(),e=>e.code===context&&e.message==='SQL postmaster belongs to this service start');
  assert.equal(f.trace.ended,1);
 }
 const f=sqlIdentityFixture({queryFailure:true});
 await assert.rejects(f.run(),/synthetic SQL failure/);assert.equal(f.trace.ended,1);
});
