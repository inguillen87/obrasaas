import {digest} from '../../src/lib/workspace-policy.mjs';
import {COMPANY_CHANNEL_SCHEMA_SQL,COMPANY_CHANNEL_SCHEMA_CONTRACT,companyChannelSchemaReady,companyChannelCatalogFingerprint} from '../../src/lib/company-channel-schema.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
async function catalog(client){
 const columns=(await client.query(`SELECT table_name,column_name,data_type,is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name=ANY($1::text[]) ORDER BY table_name,ordinal_position`,[['Project','TenantMembership','ProjectMembership','Worker','WhatsAppConnection','WebhookEvent','WhatsAppCompanyChannel','WhatsAppChannelProjectAssignment','WhatsAppCompanyRoute','WhatsAppCompanyEventRoute','WhatsAppCompanySchema']])).rows;
 const constraints=(await client.query(`SELECT conrelid::regclass::text AS relation,conname,contype,convalidated,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE connamespace='public'::regnamespace AND (conname LIKE 'company_%' OR conrelid=ANY(ARRAY[to_regclass('public."WhatsAppCompanyChannel"'),to_regclass('public."WhatsAppChannelProjectAssignment"'),to_regclass('public."WhatsAppCompanyRoute"'),to_regclass('public."WhatsAppCompanyEventRoute"')])) ORDER BY relation,conname`)).rows;
 const indexes=(await client.query(`SELECT c.relname,i.indisvalid,i.indisready,i.indisunique,pg_get_indexdef(c.oid) AS definition FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid WHERE c.relnamespace='public'::regnamespace AND c.relname LIKE 'company_%' ORDER BY c.relname`)).rows;
 const triggers=(await client.query(`SELECT tgname,tgenabled,pg_get_triggerdef(oid) AS definition FROM pg_trigger WHERE NOT tgisinternal AND tgname LIKE 'company_%' ORDER BY tgname`)).rows;
 return {columns,constraints,indexes,triggers};
}
async function aggregateConflicts(client){
 return (await client.query(`SELECT
 (SELECT count(*)::int FROM (SELECT "whatsappBusinessId" FROM public."WhatsAppConnection" WHERE "whatsappBusinessId" IS NOT NULL GROUP BY "whatsappBusinessId" HAVING count(*)>1) d) AS "duplicateWabas",
 (SELECT count(*)::int FROM public."WhatsAppConnection" c JOIN public."Project" p ON p.id=c."projectId" WHERE c.metadata->>'credentialFormat' IS DISTINCT FROM 'tenant-aad-v2' OR c.metadata->>'credentialOrganizationId' IS DISTINCT FROM p."organizationId") AS "credentialOwnerConflicts",
 (SELECT count(*)::int FROM public."WhatsAppConnection") AS connections`)).rows[0];
}
export async function executeCompanyChannelAdoption(client,{mode='DRY_RUN',expectedFingerprint}={}){
 if(!['DRY_RUN','APPLY'].includes(mode)||expectedFingerprint!==undefined&&!/^[a-f0-9]{64}$/.test(expectedFingerprint)||mode==='APPLY'&&!expectedFingerprint)fail('COMPANY_CHANNEL_ADOPTION_ARGUMENTS_INVALID');
 let active=false;
 try{
  await client.query(mode==='DRY_RUN'?'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY':'BEGIN ISOLATION LEVEL READ COMMITTED');active=true;await client.query("SET LOCAL statement_timeout='15000ms'");await client.query("SET LOCAL lock_timeout='1500ms'");
  if(mode==='DRY_RUN'&&(await client.query("SELECT current_setting('transaction_read_only') AS readonly")).rows[0].readonly!=='on')fail('COMPANY_CHANNEL_ADOPTION_READONLY_REQUIRED');
  const before=await catalog(client),fingerprint=digest(before),adopted=await companyChannelSchemaReady(client),present=before.columns.some(c=>c.table_name==='WhatsAppCompanySchema');
  if(present&&!adopted||!present&&(before.constraints.length||before.indexes.length||before.triggers.length))fail('COMPANY_CHANNEL_ADOPTION_PARTIAL_SCHEMA');
  const required={Project:['id','organizationId','status'],TenantMembership:['id','organizationId','userId'],ProjectMembership:['projectId','tenantMembershipId'],Worker:['id','projectId','metadata'],WhatsAppConnection:['id','projectId','phoneNumberId','whatsappBusinessId','encryptedAccessToken','metadata'],WebhookEvent:['id','projectId','provider','externalId','payload']};
  if(Object.entries(required).some(([table,names])=>names.some(name=>!before.columns.some(c=>c.table_name===table&&c.column_name===name))))fail('COMPANY_CHANNEL_ADOPTION_BASE_SCHEMA_REJECTED');
  const counts=await aggregateConflicts(client);if(counts.duplicateWabas||counts.credentialOwnerConflicts)fail('COMPANY_CHANNEL_ADOPTION_DATA_CONFLICT');
  if(expectedFingerprint!==undefined&&expectedFingerprint!==fingerprint)fail('COMPANY_CHANNEL_ADOPTION_FINGERPRINT_CHANGED');
  let applied=false;
  if(mode==='APPLY'&&!adopted){
   // Explicit reviewed adoption, never called by HTTP, build or onboarding.
   // Locks prevent legacy assignment/anchor writes during aggregate recheck.
   await client.query(`LOCK TABLE public."Organization",public."Project",public."TenantMembership",public."ProjectMembership",public."Worker",public."WhatsAppConnection",public."WebhookEvent" IN ACCESS EXCLUSIVE MODE`);
   if(digest(await catalog(client))!==fingerprint)fail('COMPANY_CHANNEL_ADOPTION_FINGERPRINT_CHANGED');const locked=await aggregateConflicts(client);if(locked.duplicateWabas||locked.credentialOwnerConflicts||locked.connections!==counts.connections)fail('COMPANY_CHANNEL_ADOPTION_DATA_CONFLICT');
   const credentialBefore=(await client.query(`SELECT md5(COALESCE(string_agg(to_jsonb(c)::text,'' ORDER BY c.id),'')) AS digest FROM public."WhatsAppConnection" c`)).rows[0].digest;
   await client.query(COMPANY_CHANNEL_SCHEMA_SQL);await client.query(`INSERT INTO public."WhatsAppCompanySchema"(id,version,contract,"catalogFingerprint") VALUES(1,1,$1,$2)`,[COMPANY_CHANNEL_SCHEMA_CONTRACT,await companyChannelCatalogFingerprint(client)]);
   if(!await companyChannelSchemaReady(client))fail('COMPANY_CHANNEL_ADOPTION_POSTCHECK_FAILED');
   const credentialAfter=(await client.query(`SELECT md5(COALESCE(string_agg(to_jsonb(c)::text,'' ORDER BY c.id),'')) AS digest FROM public."WhatsAppConnection" c`)).rows[0].digest;if(credentialBefore!==credentialAfter)fail('COMPANY_CHANNEL_ADOPTION_CREDENTIAL_CHANGED');
   applied=true;
  }
  const manifest={version:1,at:new Date().toISOString(),mode,status:applied?'APPLIED':adopted?'ALREADY_ADOPTED':'DRY_RUN_READY',readOnly:mode==='DRY_RUN',ddlExecuted:applied,canApply:!counts.duplicateWabas&&!counts.credentialOwnerConflicts,fingerprint,contract:COMPANY_CHANNEL_SCHEMA_CONTRACT,counts,channelMode:'PROJECT_ONLY',businessDataWritten:false,credentialsChanged:false,sourceEventsDuplicated:false,providerCalls:0,rawBusinessRecordsReturned:false,productionActivation:false};
  await client.query(mode==='DRY_RUN'?'ROLLBACK':'COMMIT');active=false;return manifest;
 }catch(error){if(active)await client.query('ROLLBACK');throw error;}
}
