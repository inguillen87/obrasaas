// Node-only fixture producer, invoked as an isolated sanitized child. The
// existing fixture imports its network guard; do not import it in loopback parent.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,lstatSync,realpathSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {canonicalFixture,shift,addReview,period} from '../../tests/helpers/field-hours-fixture.mjs';
import {createFieldHandlers} from '../../src/lib/field-operations-http.mjs';

const root=realpathSync(process.cwd()),privateRoot=path.join(root,'.vercel/private');
const inside=(file,base)=>{const rel=path.relative(base,file);return rel!==''&&!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel);};
async function wire(response){return {status:response.status,headers:Object.fromEntries(response.headers),bodyBase64:Buffer.from(await response.arrayBuffer()).toString('base64')};}
async function one(mode,timeZone){
 const f=canonicalFixture({role:'DIRECTOR'}),rows=f.add(shift({verificationStatus:mode==='stale-download'?'REVIEW_REQUIRED':'VERIFIED'}),{name:'Operario sintético para revisión de jornadas y comprobación de diseño'});
 let denied=mode==='denied-preview';
 const handlers=createFieldHandlers({verify:async()=>denied?{authenticated:false}:f.session,operations:f.operations});
 const selected={...period,timeZone};
 const request=(format,digest)=>new Request('https://obrasaas.com/api/identity/field-operations?'+new URLSearchParams({projectId:f.context.projectId,scope:f.context.scope,hoursFrom:selected.fromDate,hoursUntil:selected.untilDate,hoursTimeZone:selected.timeZone,hoursFormat:format,...(digest?{expectedHoursDigest:digest}:{})}),{headers:{Authorization:'Bearer synthetic-hours-browser-director'}});
 if(mode==='incomplete-preview')f.state.ledger.push({id:'legacy-hours',projectId:f.context.projectId,workerId:'legacy-person',metadata:{legacy:true}});
 const preview=await handlers.GET(request('json')),previewWire=await wire(preview),body=JSON.parse(Buffer.from(previewWire.bodyBase64,'base64').toString('utf8'));
 let downloadWire=null;
 if(body.exportable){
  if(mode==='stale-download')for(const row of rows)addReview(f,row,'APPROVE');
  if(mode==='incomplete-download')f.state.ledger.push({id:'legacy-hours',projectId:f.context.projectId,workerId:'legacy-person',metadata:{legacy:true}});
  if(mode==='denied-download')denied=true;
  downloadWire=await wire(await handlers.GET(request('csv',body.reportDigest)));
 }
 assert.ok(f.queries.every(query=>! /\b(?:INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|COPY|TRUNCATE)\b/i.test(query.sql)));
 assert.equal(f.connections(),f.released(),'All canonical memory transactions must release');
 return {mode,period:selected,projectId:f.context.projectId,scope:f.context.scope,preview:previewWire,download:downloadWire,reportDigest:body.reportDigest||null,backend:'createFieldHandlers -> createFieldOperations.hoursReport -> projectOperation -> readFieldHoursReport, in-memory adapter only',memoryTransactions:f.connections(),sqlQueries:f.queries.length};
}
async function main(){
 assert.equal(globalThis.__hoursExportNetworkGuard?.active,true);const destination=path.resolve(process.argv[2]||'');assert.ok(inside(destination,privateRoot));assert.equal(realpathSync(path.dirname(destination)),path.dirname(destination));assert.ok(lstatSync(path.dirname(destination)).isDirectory()&&!lstatSync(path.dirname(destination)).isSymbolicLink());assert.equal(existsSync(destination),false);
 const modes=['complete','stale-download','incomplete-preview','incomplete-download','denied-download','denied-preview'],zones=['America/Argentina/Buenos_Aires','Europe/Madrid'],cases={};
 for(const timeZone of zones){cases[timeZone]={};for(const mode of modes)cases[timeZone][mode]=await one(mode,timeZone);}
 assert.deepEqual(globalThis.__hoursExportNetworkGuard.attempts,[]);
 const bundle={version:1,syntheticOnly:true,realDatabase:false,providers:false,networkAttempts:globalThis.__hoursExportNetworkGuard.attempts,period,zones,modes,cases};
 const bytes=Buffer.from(JSON.stringify(bundle,null,2)+'\n');writeFileSync(destination,bytes,{flag:'wx'});process.stdout.write(JSON.stringify({destination,sha256:createHash('sha256').update(bytes).digest('hex'),cases:modes.length*zones.length,networkAttempts:0})+'\n');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
