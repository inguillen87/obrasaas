import { CutoverAuditError } from './legacy-cutover-audit.mjs';
const fail=code=>{throw new CutoverAuditError(code);};
const LIMIT=25000;
async function bounded(client,sql){
  const {rows}=await client.query(sql);
  if(rows.length>LIMIT)fail('AUDIT_CATALOG_LIMIT');
  return rows;
}
export async function readLegacyCutover(client){
  let transaction=false;
  try{
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');transaction=true;
    await client.query("SET LOCAL statement_timeout = '10s'");
    await client.query("SET LOCAL lock_timeout = '2s'");
    const mode=(await client.query("SELECT current_setting('transaction_read_only') AS ro, current_setting('transaction_isolation') AS isolation")).rows[0];
    if(mode?.ro!=='on'||mode?.isolation!=='repeatable read')fail('READ_ONLY_TRANSACTION_REQUIRED');
    const sizes=(await client.query('SELECT octet_length(state::text)+octet_length(messages::text) AS bytes FROM public.obrasaas_app_state LIMIT 11')).rows;
    if(sizes.length>10)fail('AUDIT_SOURCE_LIMIT');
    if(sizes.some(row=>!Number.isSafeInteger(Number(row.bytes))||Number(row.bytes)>8*1024*1024))fail('SOURCE_TOO_LARGE');
    const sources=(await client.query('SELECT id, state::text AS "stateText", messages::text AS "messagesText" FROM public.obrasaas_app_state ORDER BY id LIMIT 11')).rows;
    if(sources.length!==sizes.length)fail('SOURCE_SNAPSHOT_INCONSISTENT');
    const organizations=await bounded(client,'SELECT id FROM public."Organization" ORDER BY id LIMIT 25001');
    const projects=await bounded(client,'SELECT id,"organizationId" FROM public."Project" ORDER BY id LIMIT 25001');
    const workers=await bounded(client,'SELECT id,"projectId","externalId" FROM public."Worker" ORDER BY id LIMIT 25001');
    const tasks=await bounded(client,'SELECT id,"projectId","externalId" FROM public."Task" ORDER BY id LIMIT 25001');
    const projectSnapshots=await bounded(client,'SELECT id,"projectId",version FROM public."ProjectSnapshot" ORDER BY id LIMIT 25001');
    const migrations=await bounded(client,'SELECT migration_name AS name, finished_at IS NOT NULL AS completed, rolled_back_at IS NOT NULL AS "rolledBack" FROM public._prisma_migrations ORDER BY migration_name LIMIT 25001');
    await client.query('ROLLBACK');transaction=false;
    return {readOnlyVerified:true,sources,organizations,projects,workers,tasks,projectSnapshots,migrations};
  }catch(error){
    if(transaction)await client.query('ROLLBACK').catch(()=>{});
    if(error instanceof CutoverAuditError)throw error;
    throw new CutoverAuditError('AUDIT_DATABASE_READ_FAILED');
  }
}
export function auditConnectionConfig(value,expectedHost){
  let url;try{url=new URL(value);}catch{fail('AUDIT_CONNECTION_INVALID');}
  if(!['postgres:','postgresql:'].includes(url.protocol)||url.hostname!==expectedHost||
    !/^ep-[a-z0-9-]+\.[a-z0-9.-]+\.neon\.tech$/.test(url.hostname)||
    url.hash||(url.port&&url.port!=='5432'))fail('AUDIT_TARGET_MISMATCH');
  if(!url.pathname.slice(1)||url.pathname.slice(1).includes('/'))fail('AUDIT_CONNECTION_INVALID');
  for(const [key,value]of url.searchParams){
    if(key==='sslmode'&&['require','verify-full','verify-ca'].includes(value))continue;
    if(key==='channel_binding'&&['require','prefer'].includes(value))continue;
    if(key==='schema'&&value==='public')continue;
    fail('AUDIT_CONNECTION_OPTION_REJECTED');
  }
  url.search='';
  return {connectionString:url.toString(),ssl:{rejectUnauthorized:true},enableChannelBinding:true,
    application_name:'obrasaas-cutover-readonly',connectionTimeoutMillis:10000,query_timeout:15000};
}
