import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {createServer} from 'node:net';
import {existsSync,lstatSync,mkdirSync,mkdtempSync,readFileSync,realpathSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import puppeteer from 'puppeteer';
import {captureOwnedFixture,removeOwnedFixture} from './lib/owned-fixture-cleanup.mjs';
import {prepareWorksiteHoursBrowserFixture,runWorksiteHoursBrowser,HOURS_WIDTHS,HOURS_CASES} from './lib/worksite-hours-browser-fixture.mjs';

// Deliberately only the hours report focus. Shares the existing owned custom-Next
// fixture/IPC/cleanup pattern with verify-task-progress-measurement-ui.
assert.equal(process.env.FIELD_HOURS_UI_FOCUS,'hours-report','Explicit hours-report focus is required');
assert.ok(!process.env.VERCEL&&!process.env.VERCEL_ENV,'Disposable localhost fixture only');
const root=realpathSync(process.cwd()),privateRoot=path.join(root,'.vercel','private');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const inside=(file,base)=>{const rel=path.relative(base,file);return rel!==''&&!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel);};
for(const folder of [root,path.join(root,'.vercel'),privateRoot]){if(!existsSync(folder))mkdirSync(folder);assert.ok(lstatSync(folder).isDirectory()&&!lstatSync(folder).isSymbolicLink());assert.equal(realpathSync(folder),folder);}
const output=process.env.FIELD_HOURS_UI_EVIDENCE?path.resolve(root,process.env.FIELD_HOURS_UI_EVIDENCE):path.join(privateRoot,'hours-report-evidence');
assert.ok(inside(output,privateRoot),'Evidence must stay inside the existing private root');mkdirSync(output,{recursive:true});assert.ok(lstatSync(output).isDirectory()&&!lstatSync(output).isSymbolicLink());assert.equal(realpathSync(output),output);
const runId=new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8),prefix='hours-report-ui-';
const sourceManifest=[],checks=[],errors=[],scenarioEvidence={};
for(const source of ['scripts/verify-field-hours-report-ui.mjs','scripts/lib/worksite-hours-browser-fixture.mjs','scripts/lib/worksite-hours-browser-data.mjs','scripts/lib/owned-fixture-cleanup.mjs','package.json','package-lock.json'])sourceManifest.push({path:source,sha256:sha(readFileSync(path.join(root,source)))});
const fixture=mkdtempSync(path.join(privateRoot,prefix)),ownership=captureOwnedFixture({workspaceRoot:root,privateRoot,fixture,prefix});
let browser,child,childClose,fixtureProof,scenarioResult,failure,bundle,bundleSha256,dataChild,dataChildClose,dataChildClosed=true,dataProducer,serverLog='',closeAck=false,browserClosed=false,serverClosed=false,sourceBytesUnchanged=false,fixtureCleanupProof,origin,port;
const nonce=randomUUID(),marker='obrasaas-owned-field-hours-v1';
const serverEnv=Object.fromEntries(['PATH','Path','SystemRoot','WINDIR','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA','ComSpec','COMSPEC'].filter(key=>process.env[key]!==undefined).map(key=>[key,process.env[key]]));
async function bounded(promise,label,milliseconds=15000){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label+' timed out')),milliseconds);})]);}finally{clearTimeout(timer);}}
async function freePort(){const lease=createServer();await new Promise((resolve,reject)=>{lease.once('error',reject);lease.listen(0,'127.0.0.1',resolve);});const selected=lease.address().port;await new Promise((resolve,reject)=>lease.close(error=>error?reject(error):resolve()));return selected;}
try{
 prepareWorksiteHoursBrowserFixture({root,fixture,sourceManifest,fingerprintOnly:true});
 const bundleFile=path.join(fixture,'hours-data.json');let dataStdout='',dataStderr='';
 dataChild=spawn(process.execPath,[path.join(root,'scripts/lib/worksite-hours-browser-data.mjs'),bundleFile],{cwd:root,env:{...serverEnv,NODE_ENV:'test',TZ:'UTC'},stdio:['ignore','pipe','pipe'],windowsHide:true});dataChildClosed=false;
 dataChildClose=new Promise((resolve,reject)=>{dataChild.once('error',reject);dataChild.once('close',(code,signal)=>{dataChildClosed=true;resolve({code,signal});});});
 dataChild.stdout.on('data',chunk=>{dataStdout+=chunk.toString();});dataChild.stderr.on('data',chunk=>{dataStderr+=chunk.toString();});
 const dataExit=await bounded(dataChildClose,'Guarded hours data producer',30000);
 const stdoutPath=path.join(output,'hours-data-'+runId+'.stdout.log'),stderrPath=path.join(output,'hours-data-'+runId+'.stderr.log');writeFileSync(stdoutPath,dataStdout,{flag:'wx'});writeFileSync(stderrPath,dataStderr,{flag:'wx'});dataProducer={exit:dataExit,stdoutPath,stderrPath};assert.equal(dataExit.code,0,'Canonical guarded hours fixture producer must succeed');
 const bundleBytes=readFileSync(bundleFile);bundle=JSON.parse(bundleBytes.toString('utf8'));bundleSha256=sha(bundleBytes);assert.equal(bundle.version,1);assert.equal(bundle.syntheticOnly,true);assert.equal(bundle.realDatabase,false);assert.equal(bundle.providers,false);assert.deepEqual(bundle.networkAttempts,[]);const bundlePath=path.join(output,'hours-data-'+runId+'.json');writeFileSync(bundlePath,bundleBytes,{flag:'wx'});dataProducer={...dataProducer,bundlePath,bundleSha256,networkAttempts:0,actualCanonicalBackend:true,memoryOnly:true};
 fixtureProof=prepareWorksiteHoursBrowserFixture({root,fixture,sourceManifest,bundle});
 const app=path.join(fixture,'src/app');
 writeFileSync(path.join(fixture,'package.json'),JSON.stringify({name:'isolated-field-hours-report',private:true}));
 writeFileSync(path.join(fixture,'next.config.mjs'),`export default {devIndicators:false,turbopack:{root:${JSON.stringify(root)}}};\n`);
 writeFileSync(path.join(app,'layout.js'),`export default function Layout({children}){return <html lang="es"><body style={{margin:0,padding:12,background:'#f0f4f7',fontFamily:'Arial,sans-serif'}}>{children}</body></html>}`);
 // The selected port is fresh. If another owner wins before listen, our child
 // reports startup failure; an existing 200 is never accepted as readiness.
 port=await freePort();origin='http://127.0.0.1:'+port;
 const childFile=path.join(fixture,'owned-server.cjs');
 writeFileSync(childFile,`const {createServer}=require('node:http');const next=require(${JSON.stringify(path.join(root,'node_modules/next'))});const nonce=${JSON.stringify(nonce)},marker=${JSON.stringify(marker)},pageSha256=${JSON.stringify(fixtureProof.pageSha256)};let app,server,closing=false,ready;async function close(){if(closing)return;closing=true;try{await ready.catch(()=>{});if(server?.listening){server.closeAllConnections();await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}if(app)await app.close();if(process.connected)process.send({type:'closed',nonce},()=>process.exit(0));else process.exit(0);}catch(error){console.error(error);if(process.connected)process.send({type:'close-failed',nonce},()=>process.exit(1));else process.exit(1);}}process.on('message',message=>{if(message&&Object.keys(message).sort().join('|')==='nonce|type'&&message.type==='close'&&message.nonce===nonce)void close();});process.on('disconnect',()=>void close());process.on('SIGTERM',()=>void close());ready=(async()=>{server=createServer((req,res)=>{if(req.url==='/__field_hours_owned?nonce='+nonce){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({marker,nonce,pid:process.pid,pageSha256}));return;}return app.getRequestHandler()(req,res);});app=next({dev:true,dir:${JSON.stringify(fixture)},hostname:'127.0.0.1',port:${port},httpServer:server,webpack:true,turbopack:false});await app.prepare();server.on('upgrade',(req,socket,head)=>app.getUpgradeHandler()(req,socket,head));await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(${port},'127.0.0.1',resolve);});if(process.connected)process.send({type:'ready',nonce,port:${port}});})();ready.catch(error=>{console.error(error);process.exitCode=1;if(process.connected)process.send({type:'failed',nonce});});`);
 child=spawn(process.execPath,[childFile],{cwd:fixture,env:{...serverEnv,NEXT_TELEMETRY_DISABLED:'1',NODE_ENV:'development'},stdio:['ignore','pipe','pipe','ipc'],windowsHide:true});
 childClose=new Promise(resolve=>child.once('close',(code,signal)=>resolve({code,signal})));
 for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{serverLog=(serverLog+chunk.toString()).slice(-20000);});
 child.on('message',message=>{if(message?.nonce===nonce&&message.type==='closed')closeAck=true;});
 await bounded(new Promise((resolve,reject)=>{child.once('error',reject);child.on('message',message=>{if(message?.nonce!==nonce)return;if(message.type==='ready'){if(message.port!==port){reject(new Error('Owned ready port mismatch'));return;}resolve();}if(message.type==='failed')reject(new Error('Owned Next fixture startup failed'));});child.once('exit',()=>reject(new Error('Owned fixture exited before readiness')));}), 'Owned fixture readiness',90000);
 const readyResponse=await fetch(origin+'/__field_hours_owned?nonce='+nonce,{signal:AbortSignal.timeout(15000)});assert.equal(readyResponse.status,200);assert.deepEqual(await readyResponse.json(),{marker,nonce,pid:child.pid,pageSha256:fixtureProof.pageSha256});
 const htmlResponse=await fetch(origin+'/hours-browser',{signal:AbortSignal.timeout(60000)});assert.equal(htmlResponse.status,200);assert.ok((await htmlResponse.text()).includes('data-hours-browser-fixture'),'The owned fixture page must be rendered');
 browser=await puppeteer.launch({headless:true,...(process.platform==='win32'?{channel:'chrome'}:{}),args:['--disable-background-networking','--disable-component-update','--disable-domain-reliability','--disable-sync','--metrics-recording-only','--no-first-run','--disable-features=MediaRouter',...(process.env.GITHUB_ACTIONS==='true'&&process.platform==='linux'?['--no-sandbox','--disable-setuid-sandbox']:[])]});
 const scenarioOutput=path.join(output,'cases-'+runId);mkdirSync(scenarioOutput);
 scenarioResult=await runWorksiteHoursBrowser({browser,origin,output:scenarioOutput,bundle,checks,errors,evidenceSink:scenarioEvidence});
 assert.equal(checks.length,HOURS_WIDTHS.length*HOURS_CASES.length);assert.deepEqual(errors,[]);
}catch(error){failure=error;}
finally{
 try{if(dataChild&&!dataChildClosed){dataChild.kill();await bounded(dataChildClose,'Owned data child close',15000);}assert.equal(dataChildClosed,true);}catch(error){failure ||=error;}
 try{if(browser)await bounded(browser.close(),'Owned browser close',15000);browserClosed=true;}catch(error){failure ||=error;}
 try{
  if(!child)serverClosed=true;
  else{if(child.exitCode===null&&child.signalCode===null&&child.connected)child.send({type:'close',nonce});const exit=await bounded(childClose,'Owned Next/app.close and process close',30000);serverClosed=closeAck&&exit.code===0;assert.ok(serverClosed,'Owned close acknowledgment and process exit are required');}
 }catch(error){failure ||=error;}
 // app.close drains the directly owned Next server/bundler resources before
 // process exit. No CLI watcher, broad PID lookup or arbitrary tree kill runs.
 try{fixtureCleanupProof=await removeOwnedFixture(ownership,{serverClosedBeforeFixtureRemoval:serverClosed&&dataChildClosed});assert.equal(fixtureCleanupProof.fixtureRemoved,true);}catch(error){failure ||=error;fixtureCleanupProof=error.cleanupProof;}
 try{sourceBytesUnchanged=sourceManifest.every(source=>sha(readFileSync(path.join(root,source.path)))===source.sha256);assert.equal(sourceBytesUnchanged,true,'Canonical source or one of the three hours harness files changed during the run');}catch(error){failure ||=error;}
}
const proof={version:1,status:failure?'FAIL':'PASS',checkedAt:new Date().toISOString(),runId,sourceState:'current-working-tree-content-hashes',sourceManifest,sourceBytesUnchanged,fixtureProof,dataProducer,scenarioResult,environment:'owned-loopback-next-actual-HoursPanel-with-isolated-guarded-canonical-backend-memory-responses',focus:'hours-report',widths:HOURS_WIDTHS,checks,errors,requests:scenarioEvidence.requests||[],cases:scenarioEvidence.cases||[],expectedCases:HOURS_WIDTHS.length*HOURS_CASES.length,keyboardAndLayout:true,allBusinessRequests:'Explicit GET preview or CSV only',providerCalls:0,metaMessagesSent:0,realDatabase:false,productionDataWritten:false,productionLoginVerified:false,humanAccepted:false,cleanup:{dataChildClosed,browserClosed,serverClosed,gracefulCloseAcknowledged:closeAck,fixtureRemoved:fixtureCleanupProof?.fixtureRemoved===true,fixtureCleanupProof},...(failure?{failure:failure.message,serverLog,ownedChildPid:child?.pid,fixturePreserved:fixtureCleanupProof?.fixtureRemoved!==true}:{})};
const target=path.join(output,'browser-hours-report-'+runId+'.json');writeFileSync(target,JSON.stringify(proof,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:proof.status,target,checks:checks.length,sourceBytesUnchanged,cleanup:proof.cleanup}));if(failure)throw failure;
