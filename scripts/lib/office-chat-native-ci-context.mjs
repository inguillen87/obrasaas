// Source-only proposal644. Adapted from the existing owned-service pattern in
// verify-participant-kyc-preanalysis-postgres.mjs:87-181; no OIDC/authenticator.
// Environment is execution context, never independent evidence of a CI run.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync,lstatSync,readFileSync,realpathSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const OFFICE_NATIVE_CI_WORKFLOW='Office chat native PostgreSQL';
export const OFFICE_NATIVE_CI_WORKFLOW_PATH='.github/workflows/office-chat-native.yml';
export const OFFICE_NATIVE_CI_EVIDENCE='.vercel/office-chat-native-ci';
export const OFFICE_NATIVE_CI_IMAGE='docker.io/library/postgres:17-alpine@sha256:742f40ea20b9ff2ff31db5458d127452988a2164df9e17441e191f3b72252193';
const imageDigest='sha256:742f40ea20b9ff2ff31db5458d127452988a2164df9e17441e191f3b72252193';
const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url)));
const sha=value=>createHash('sha256').update(value).digest('hex');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const requireCi=(value,label)=>{if(!value)throw Object.assign(new Error(label),{code:'OFFICE_NATIVE_CI_CONTEXT_REJECTED'});};
const hex=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const safe=file=>typeof file==='string'&&!/[\\:\x00-\x1f]/.test(file)&&!file.startsWith('/')&&file.split('/').every(part=>part&&part!=='.'&&part!=='..');
const command=(binary,args)=>execFileSync(binary,args,{cwd:root,env:process.env,maxBuffer:16*1024*1024,timeout:10000,stdio:['ignore','pipe','pipe']});
const git=(...args)=>command('/usr/bin/git',args).toString('utf8').trim();

// Whole tracked source, including workflow/helper/native fixtures and lockfile.
// A Linux checkout must equal each actual Git blob byte-for-byte. No guessed
// historical 344 count, hardcoded future source hash, or hand-built source list.
export function officeCiSnapshot(expectedHead=process.env.GITHUB_SHA){
 requireCi(process.platform==='linux'&&path.resolve(process.cwd())===root,'Linux checkout cwd required');
 const head=git('rev-parse','HEAD'),tree=git('rev-parse','HEAD^{tree}');
 requireCi(/^[a-f0-9]{40}$/.test(expectedHead)&&head===expectedHead&&/^[a-f0-9]{40}$/.test(tree),'Exact current HEAD/tree required');
 requireCi(git('rev-parse','--show-object-format')==='sha1'&&git('status','--porcelain','--untracked-files=no')==='','Clean tracked Git source required');
 const entries=command('/usr/bin/git',['ls-tree','-rz','--full-tree',head]).toString('utf8').split('\0').filter(Boolean);
 const files=entries.map(entry=>{
  const match=/^(100644|100755) blob ([a-f0-9]{40})\t(.+)$/.exec(entry);requireCi(Boolean(match),'Regular tracked source required');
  const [,mode,blob,file]=match;requireCi(safe(file),'Safe tracked path required');
  const filename=path.join(root,file),stat=lstatSync(filename);requireCi(stat.isFile()&&!stat.isSymbolicLink(),'No source symlink');
  requireCi(realpathSync(filename).startsWith(realpathSync(root)+path.sep),'Source remains inside checkout');
  const bytes=readFileSync(filename),actualBlob=createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
  requireCi(actualBlob===blob,'Checkout RAW differs from committed Git blob: '+file);
  return {path:file,bytes:bytes.length,sha256:sha(bytes),gitBlob:blob,mode};
 }).sort((a,b)=>a.path.localeCompare(b.path,'en'));
 requireCi(files.length>0&&new Set(files.map(row=>row.path)).size===files.length,'Complete distinct source census required');
 for(const file of [OFFICE_NATIVE_CI_WORKFLOW_PATH,'scripts/verify-office-chat-native-ci.mjs','scripts/lib/office-chat-native-ci-context.mjs','scripts/verify-office-chat-postgres.mjs','scripts/verify-office-chat-own-postgres.mjs','package.json','package-lock.json'])requireCi(files.some(row=>row.path===file),'Missing committed CI source: '+file);
 return {head,tree,files};
}

export function officeCiContext(snapshot){
 const env=process.env;
 requireCi(env.CI==='true'&&env.GITHUB_ACTIONS==='true'&&env.RUNNER_OS==='Linux'&&process.platform==='linux','GitHub Linux execution context required');
 requireCi(env.GITHUB_REPOSITORY==='inguillen87/obrasaas'&&['https://github.com/inguillen87/obrasaas','https://github.com/inguillen87/obrasaas.git'].includes(git('config','--get','remote.origin.url')),'Repository context required');
 requireCi(env.GITHUB_SHA===snapshot.head&&env.GITHUB_WORKFLOW===OFFICE_NATIVE_CI_WORKFLOW&&env.GITHUB_JOB==='office-native'&&['push','workflow_dispatch'].includes(env.GITHUB_EVENT_NAME),'Workflow/job/event context required');
 requireCi(/^[1-9]\d*$/.test(env.GITHUB_RUN_ID)&&/^[1-9]\d*$/.test(env.GITHUB_RUN_ATTEMPT),'Run/attempt context required');
 requireCi(typeof env.GITHUB_WORKSPACE==='string'&&path.resolve(env.GITHUB_WORKSPACE)===root,'Actual workspace required');
 requireCi(!env.DOCKER_HOST&&!env.DOCKER_CONTEXT&&!env.DOCKER_TLS_VERIFY&&!env.DOCKER_CERT_PATH,'Local Docker daemon only');
 requireCi(hex(env.OBRASAAS_OFFICE_CI_SERVICE_ID)&&/^github_network_[a-f0-9]{32}$/.test(env.OBRASAAS_OFFICE_CI_NETWORK)&&env.OBRASAAS_OFFICE_CI_PUBLISHED_PORT==='5432','Explicit job.services.postgres context required');
 requireCi(process.version==='v24.21.0'&&process.execArgv.length===0&&!env.NODE_OPTIONS&&!env.NODE_PATH,'Reviewed Node version with no preload required');
 requireCi(env.TZ==='UTC'&&Intl.DateTimeFormat().resolvedOptions().timeZone==='UTC','UTC process required');
 for(const key of ['DATABASE_URL','DATABASE_URL_UNPOOLED','POSTGRES_URL','POSTGRES_URL_NON_POOLING','POSTGRES_PRISMA_URL','PGHOST','PGPORT','PGPASSWORD','PGSERVICE','PGPASSFILE','PGSERVICEFILE','VERCEL','VERCEL_ENV','VERCEL_TARGET_ENV'])requireCi(!env[key],'Ambient DB/provider configuration forbidden');
 for(const file of ['.env','.env.local','.env.production','.env.production.local'])requireCi(!existsSync(path.join(root,file)),'Ambient dotenv file forbidden');
 requireCi(Object.entries(env).every(([key,value])=>!key.startsWith('META_')||!value),'Ambient Meta credentials forbidden');
 requireCi(env.CUTOVER_TEST_DISPOSABLE==='1'&&env.CUTOVER_TEST_DATABASE_URL==='postgresql://cutover_test:cutover_test@127.0.0.1:5432/obrasaas_cutover_ci','Only the existing synthetic CI service target is accepted');
 return {repository:env.GITHUB_REPOSITORY,sourceRevision:snapshot.head,sourceTree:snapshot.tree,runId:env.GITHUB_RUN_ID,runAttempt:env.GITHUB_RUN_ATTEMPT,event:env.GITHUB_EVENT_NAME,workflow:env.GITHUB_WORKFLOW,job:env.GITHUB_JOB,serviceId:env.OBRASAAS_OFFICE_CI_SERVICE_ID,networkName:env.OBRASAAS_OFFICE_CI_NETWORK,publishedPort:5432};
}

// Fixed local daemon/binary and three read-only inspections. No injected JSON,
// Docker host, address, executable, PID controller or lifecycle operation.
export function inspectOfficeCiService(context){
 const inspect=(type,id)=>{const rows=JSON.parse(command('/usr/bin/docker',['--host=unix:///var/run/docker.sock','inspect','--type='+type,id]));requireCi(Array.isArray(rows)&&rows.length===1,'One inspected '+type+' required');return rows[0];};
 const project=value=>({id:value?.Id,imageId:value?.Image,imageReference:value?.Config?.Image,running:value?.State?.Running,health:value?.State?.Health?.Status,createdAt:value?.Created,startedAt:value?.State?.StartedAt,environment:Object.fromEntries((value?.Config?.Env||[]).filter(item=>/^(POSTGRES_USER|POSTGRES_PASSWORD|POSTGRES_DB|PGDATA|TZ|PGTZ)=/.test(item)).map(item=>{const split=item.indexOf('=');return [item.slice(0,split),item.slice(split+1)];})),binds:value?.HostConfig?.Binds||[],networks:value?.NetworkSettings?.Networks,ports:value?.NetworkSettings?.Ports});
 const container=project(inspect('container',context.serviceId));
 requireCi(container.id===context.serviceId&&/^sha256:[a-f0-9]{64}$/.test(container.imageId)&&container.imageReference===OFFICE_NATIVE_CI_IMAGE&&container.running===true&&container.health==='healthy','Pinned running owned service required');
 requireCi(container.environment.POSTGRES_USER==='cutover_test'&&container.environment.POSTGRES_PASSWORD==='cutover_test'&&container.environment.POSTGRES_DB==='obrasaas_cutover_ci'&&container.environment.TZ==='UTC'&&container.environment.PGTZ==='UTC'&&typeof container.environment.PGDATA==='string'&&container.environment.PGDATA.startsWith('/')&&container.binds.length===0,'Synthetic UTC service without host bind required');
 const imageRaw=inspect('image',container.imageId),networkRaw=inspect('network',context.networkName),allowed=['postgres@'+imageDigest,'docker.io/library/postgres@'+imageDigest];
 requireCi(imageRaw.Id===container.imageId&&Array.isArray(imageRaw.RepoDigests)&&imageRaw.RepoDigests.length>0&&imageRaw.RepoDigests.length<=2&&new Set(imageRaw.RepoDigests).size===imageRaw.RepoDigests.length&&imageRaw.RepoDigests.every(value=>allowed.includes(value)),'Actual image digest required');
 requireCi(same(Object.keys(container.networks),[context.networkName]),'One exact job network required');
 const endpoint=container.networks[context.networkName],members=networkRaw.Containers;
 requireCi(hex(endpoint.NetworkID)&&hex(endpoint.EndpointID)&&typeof endpoint.IPAddress==='string'&&/^(?:\d{1,3}\.){3}\d{1,3}$/.test(endpoint.IPAddress)&&endpoint.IPAddress.split('.').every(value=>Number(value)<=255)&&!['0.0.0.0','127.0.0.1'].includes(endpoint.IPAddress)&&Number.isInteger(endpoint.IPPrefixLen)&&endpoint.IPPrefixLen>0&&endpoint.IPPrefixLen<=32&&Array.isArray(endpoint.Aliases)&&endpoint.Aliases.includes('postgres'),'Actual container network endpoint required');
 requireCi(networkRaw.Id===endpoint.NetworkID&&networkRaw.Name===context.networkName&&networkRaw.Driver==='bridge'&&networkRaw.Internal===false&&members&&same(Object.keys(members),[context.serviceId])&&members[context.serviceId].EndpointID===endpoint.EndpointID&&members[context.serviceId].IPv4Address===endpoint.IPAddress+'/'+endpoint.IPPrefixLen,'Independent job network join required');
 requireCi(same(Object.keys(container.ports),['5432/tcp']),'Only the PostgreSQL port is published');
 const mappings=container.ports['5432/tcp'];requireCi(Array.isArray(mappings)&&mappings.length>0&&mappings.length<=2&&new Set(mappings.map(row=>row.HostIp)).size===mappings.length,'Unambiguous published port required');
 requireCi(mappings.every(row=>['0.0.0.0','127.0.0.1','::','::1'].includes(row.HostIp)&&row.HostPort==='5432')&&mappings.some(row=>['0.0.0.0','127.0.0.1'].includes(row.HostIp)),'Loopback published PostgreSQL5432 required');
 requireCi(same(container,project(inspect('container',context.serviceId))),'Container changed during inspection');
 return {version:1,checkedAt:new Date().toISOString(),context,container,image:{id:imageRaw.Id,repoDigests:[...imageRaw.RepoDigests].sort()},network:{id:networkRaw.Id,name:networkRaw.Name,driver:networkRaw.Driver,internal:networkRaw.Internal,containers:members},endpoint:{host:'127.0.0.1',port:5432}};
}

export function officeCiConnection(){
 // No DATABASE_URL or arbitrary connection string ever reaches a client.
 return {host:'127.0.0.1',port:5432,user:'cutover_test',password:'cutover_test',database:'obrasaas_cutover_ci',ssl:false,connectionTimeoutMillis:2000,statement_timeout:8000,options:'-c TimeZone=UTC'};
}

export async function officeCiSqlIdentity(observation){
 const {Client}=await import('pg'),client=new Client(officeCiConnection());
 try{
  await client.connect();
  const row=(await client.query("SELECT system_identifier::text AS id,current_setting('data_directory') AS data,current_setting('port') AS port,current_setting('TimeZone') AS timezone,current_setting('server_version_num')::int AS version,current_user AS actor,current_database() AS database,inet_server_addr()::text AS address,inet_server_port() AS connection_port,pg_postmaster_start_time() AS started FROM pg_control_system()")).rows[0];
  requireCi(/^[0-9]{10,22}$/.test(row?.id)&&row.data===observation.container.environment.PGDATA&&row.port==='5432'&&row.connection_port===5432&&row.address===observation.container.networks[observation.context.networkName].IPAddress&&row.timezone==='UTC'&&Number.isInteger(row.version)&&row.version>=170000&&row.version<180000&&row.actor==='cutover_test'&&row.database==='obrasaas_cutover_ci','Actual owned SQL PostgreSQL17 identity required');
  requireCi(Number.isFinite(Date.parse(observation.container.startedAt))&&row.started instanceof Date&&row.started.getTime()>=Date.parse(observation.container.startedAt)-1000,'SQL postmaster belongs to this service start');
  return {...row,started:row.started.toISOString()};
 }finally{await client.end();}
}

export async function officeCiOwnedDatabaseCatalog(names){
 requireCi(Array.isArray(names)&&names.length===8&&new Set(names).size===8&&names.filter(name=>/^office496_[a-f0-9]{32}$/.test(name)).length===1&&names.filter(name=>/^officeown_[a-f0-9]{32}$/.test(name)).length===7,'Only the eight actually created synthetic database names are accepted');
 const {Client}=await import('pg'),client=new Client(officeCiConnection());
 try{await client.connect();const rows=(await client.query('SELECT datname AS name,oid::int AS oid,pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname=ANY($1::text[]) ORDER BY datname',[names])).rows;requireCi(rows.length===8&&same(rows.map(row=>row.name),[...names].sort())&&rows.every(row=>row.owner==='cutover_test'&&Number.isSafeInteger(row.oid)&&row.oid>0),'Actual synthetic database catalog ownership required');return rows;}
 finally{await client.end();}
}

export async function loadOfficeNativeCiContext({variant,argv,entryUrl}){
 assert.deepEqual(argv,['--github-actions-service']);assert(['dedicated','own'].includes(variant));
 const snapshot=officeCiSnapshot(),context=officeCiContext(snapshot),observation=inspectOfficeCiService(context),sqlIdentity=await officeCiSqlIdentity(observation);
 const producer=variant==='dedicated'?'scripts/verify-office-chat-postgres.mjs':'scripts/verify-office-chat-own-postgres.mjs';
 requireCi(path.resolve(fileURLToPath(entryUrl))===path.join(root,producer),'Exact committed native entrypoint required');
 const output=path.join(root,OFFICE_NATIVE_CI_EVIDENCE,variant),parent=path.dirname(output);
 requireCi(existsSync(parent)&&realpathSync(parent)===path.join(realpathSync(root),OFFICE_NATIVE_CI_EVIDENCE)&&!existsSync(output),'Fresh owned evidence output required');mkdirSync(output);
 const save=(name,value)=>{requireCi(/^[a-z0-9-]+\.json$/.test(name),'Safe evidence filename required');writeFileSync(path.join(output,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});};
 const node={version:process.version,platform:process.platform,architecture:process.arch,executableSha256:sha(readFileSync(process.execPath))};
 const asRows=value=>value.files.map(({path,bytes,sha256})=>({path,bytes,sha256}));
 const sourceManifest={schema:'office-chat-github-service-execution-inputs.v1',sourceRoot:root,files:asRows(snapshot)};
 const sources=()=>{const current=officeCiSnapshot(snapshot.head);requireCi(current.tree===snapshot.tree&&same(current.files,snapshot.files)&&process.version===node.version&&sha(readFileSync(process.execPath))===node.executableSha256,'Whole source census or Node binary changed');return asRows(current);};
 const beforeSources=sources(),server={host:'127.0.0.1',port:5432,user:'cutover_test',systemIdentifier:sqlIdentity.id,dataDirectory:sqlIdentity.data,pid:null};
 const binding={mode:'github-actions-service',ci:context,node};
 save('ci-context.json',{binding,serviceBefore:observation,sqlIdentity,sourceCensus:snapshot,externalGitHubRunArtifactVerification:'REQUIRED_NOT_PERFORMED_BY_THIS_PROCESS'});
 return {binding,server,sourceManifest,beforeSources,sources,output,save};
}
