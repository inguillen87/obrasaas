import {Client} from 'pg';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {workspaceConnectionConfig} from '../src/lib/workspace-policy.mjs';
import {companyContactArguments,companyContactProductionContext,executeCompanyContactAdoption} from './lib/company-contact-migration.mjs';

let client,connectionFailed=false;
try{
 const command=companyContactArguments(process.argv.slice(2));
 const project=JSON.parse(readFileSync(new URL('../.vercel/project.json',import.meta.url),'utf8'));
 const context=companyContactProductionContext(process.env,project,command);
 client=new Client({...workspaceConnectionConfig(),statement_timeout:15000,query_timeout:20000,application_name:'obrasaas-company-contact-schema-adoption'});
 client.on('error',()=>{connectionFailed=true;});await client.connect();
 const result=await executeCompanyContactAdoption(client,command);await client.end();client=null;
 if(connectionFailed)throw new Error('Connection outcome unconfirmed');
 const directory=new URL('../.vercel/private/company-contact-migration/',import.meta.url);mkdirSync(directory,{recursive:true});
 const path=new URL(result.at.replaceAll(':','-')+'-'+result.mode.toLowerCase()+'.json',directory);
 writeFileSync(path,JSON.stringify({...context,...result},null,2));
 console.log(JSON.stringify({companyContactAdoption:{...context,...result,privateManifestWritten:true}}));
}catch(error){
 const code=/^COMPANY_CONTACT_[A-Z_]+$/.test(error?.code||'')?error.code:'COMPANY_CONTACT_MIGRATION_UNCONFIRMED';
 console.error(JSON.stringify({companyContactAdoption:{status:code,productionDataWriteConfirmed:false,credentialsPrinted:false}}));process.exitCode=1;
}finally{if(client)try{await client.end();}catch{console.error(JSON.stringify({companyContactAdoption:{status:'COMPANY_CONTACT_CLEANUP_UNCONFIRMED',credentialsPrinted:false}}));process.exitCode=1;}}
