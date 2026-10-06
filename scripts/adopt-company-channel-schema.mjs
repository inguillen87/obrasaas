import {Client} from 'pg';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {workspaceConnectionConfig} from '../src/lib/workspace-policy.mjs';
import {companyContactArguments,companyContactProductionContext} from './lib/company-contact-migration.mjs';
import {executeCompanyChannelAdoption} from './lib/company-channel-migration.mjs';
let client;
try{
 // Same exact project/team/environment guard as the reviewed company schema
 // wrapper. Default is READ ONLY; APPLY needs the reviewed catalog fingerprint.
 const command=companyContactArguments(process.argv.slice(2)),project=JSON.parse(readFileSync(new URL('../.vercel/project.json',import.meta.url),'utf8')),context=companyContactProductionContext(process.env,project,command);
 client=new Client({...workspaceConnectionConfig(),statement_timeout:15000,query_timeout:20000,application_name:'obrasaas-company-channel-schema-adoption'});await client.connect();
 const result=await executeCompanyChannelAdoption(client,command);await client.end();client=null;
 const directory=new URL('../.vercel/private/company-channel-migration/',import.meta.url);mkdirSync(directory,{recursive:true});writeFileSync(new URL(result.at.replaceAll(':','-')+'-'+result.mode.toLowerCase()+'.json',directory),JSON.stringify({...context,...result},null,2));console.log(JSON.stringify({companyChannelAdoption:{...context,...result,privateManifestWritten:true}}));
}catch(error){console.error(JSON.stringify({companyChannelAdoption:{status:/^(?:COMPANY_CHANNEL|COMPANY_CONTACT)_[A-Z_]+$/.test(error?.code||'')?error.code:'COMPANY_CHANNEL_ADOPTION_UNCONFIRMED',credentialsPrinted:false,productionActivation:false}}));process.exitCode=1;}
finally{if(client)try{await client.end();}catch{process.exitCode=1;}}
