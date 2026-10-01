import {Client} from 'pg';
import {workspaceConnectionConfig} from '../src/lib/workspace-policy.mjs';
import {COMPANY_SCHEMA_REQUIREMENTS,checkCompanySchema,companyPreflightEnabled} from './lib/company-schema-preflight.mjs';
let client;
try{
 if(companyPreflightEnabled()){
  client=new Client(workspaceConnectionConfig());client.on('error',()=>{});await client.connect();
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');await client.query("SET LOCAL statement_timeout='5000ms'");
  const readonly=(await client.query("SELECT current_setting('transaction_read_only') AS readonly")).rows[0].readonly;
  if(readonly!=='on')throw new Error('READ_ONLY_NOT_ENFORCED');
  const rows=(await client.query(`SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=ANY($1::text[])`,[Object.keys(COMPANY_SCHEMA_REQUIREMENTS)])).rows;
  const schema=checkCompanySchema(rows);if(!schema.compatible)throw new Error('COMPANY_SCHEMA_INCOMPATIBLE');
  const permissions=(await client.query(`SELECT bool_and((has_table_privilege(current_user,format('%I.%I','public',table_name),'SELECT') AND has_table_privilege(current_user,format('%I.%I','public',table_name),'INSERT') AND has_table_privilege(current_user,format('%I.%I','public',table_name),'UPDATE'))) AS allowed FROM unnest($1::text[]) AS table_name`,[Object.keys(COMPANY_SCHEMA_REQUIREMENTS)])).rows[0].allowed;
  if(permissions!==true)throw new Error('COMPANY_TABLE_PERMISSION_MISSING');
  await client.query('ROLLBACK');
  console.log(JSON.stringify({companyOnboardingSchemaCheck:{status:'PASS',readOnly:true,requiredTables:schema.requiredTables,requiredColumnsPresent:true,roleHasRequiredTablePrivileges:true,businessRecordsRead:0,businessDataWritten:false,clerkSessionChecked:false,whatsAppConnected:false}}));
 }
}catch{console.error(JSON.stringify({companyOnboardingSchemaCheck:{status:'UNCONFIRMED',readOnly:true,businessDataWritten:false}}));process.exitCode=1;}
finally{if(client){await client.query('ROLLBACK').catch(()=>{});await client.end().catch(()=>{});}}
