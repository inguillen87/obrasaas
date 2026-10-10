import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,copyFileSync,writeFileSync,rmSync,readFileSync,realpathSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {spawn,spawnSync,execFileSync} from 'node:child_process';
import {IDENTITY_PUBLIC_KEY,IDENTITY_INSTANCE,IDENTITY_ORIGIN} from '../src/lib/production-identity-config.mjs';
assert.ok(!process.env.VERCEL&&!process.env.VERCEL_ENV);
const root=process.cwd(),evidence=path.join(root,'.vercel/private');mkdirSync(evidence,{recursive:true});const fixture=mkdtempSync(path.join(evidence,'plan-boundary-'));
const sourceManifest=[],trackedClean=execFileSync('git',['status','--porcelain','--untracked-files=no'],{encoding:'utf8'}).trim()==='';
if(process.env.CI==='true')assert.equal(trackedClean,true,'CI proof requires committed clean source');
const sourceProof={sourceRevision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceTree:execFileSync('git',['rev-parse','HEAD^{tree}'],{encoding:'utf8'}).trim(),sourceState:process.env.CI==='true'?'EXACT_CI_SOURCE':'LOCAL_REVIEW_SOURCE',trackedClean,harnessSha256:createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex')};
function copy(relative){const source=path.join(root,relative),destination=path.join(fixture,relative);mkdirSync(path.dirname(destination),{recursive:true});copyFileSync(source,destination);const bytes=readFileSync(source);assert.deepEqual(readFileSync(destination),bytes);sourceManifest.push({path:relative,sha256:createHash('sha256').update(bytes).digest('hex')});}
copy('src/proxy.js');copy('src/app/api/identity/plan-import/route.js');
for(const name of ['legacy-access-boundary.js','brand-assets.mjs','production-identity-config.mjs','verified-session.mjs','workspace-runtime.mjs','workspace-store.mjs','workspace-policy.mjs','participant-admission.mjs','participant-approved-identity.mjs','participant-kyc-image-set.mjs','private-image-upload.mjs','plan-import-analyzer.mjs','plan-import-http.mjs','plan-import-policy.mjs','plan-import-runtime.mjs','plan-import-store.mjs','plan-import-ooxml.mjs','plan-import-monthly-curve.mjs','plan-import-cyp-curve.mjs'])copy('src/lib/'+name);
writeFileSync(path.join(fixture,'package.json'),JSON.stringify({private:true}));writeFileSync(path.join(fixture,'next.config.mjs'),`export default {devIndicators:false,turbopack:{root:${JSON.stringify(root)}}};`);
writeFileSync(path.join(fixture,'src/app/layout.js'),`export default function Layout({children}){return <html lang="es"><body>{children}</body></html>}`);writeFileSync(path.join(fixture,'src/app/page.js'),`export default function Page(){return <p>Plan boundary fixture</p>}`);
const port=3139,origin='http://127.0.0.1:'+port,checks=[];
const server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev',fixture,'--webpack','--hostname','127.0.0.1','--port',String(port)],{cwd:root,windowsHide:true,detached:process.platform!=='win32',env:{...process.env,NEXT_TELEMETRY_DISABLED:'1',VERCEL_ENV:'development',NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:IDENTITY_PUBLIC_KEY,CLERK_EXPECTED_INSTANCE_ID:IDENTITY_INSTANCE,NEXT_PUBLIC_APP_URL:IDENTITY_ORIGIN,CLERK_AUTHORIZED_PARTIES:IDENTITY_ORIGIN,DATABASE_URL:'',OPENAI_API_KEY:'',BLOB_READ_WRITE_TOKEN:'',INTERNAL_API_SECRET:''},stdio:['ignore','pipe','pipe']});
const serverClosed=new Promise(resolve=>server.once('close',resolve));
async function stopHarnessServer(){
 let deadline;try{
  assert.ok(Number.isSafeInteger(server.pid)&&server.pid>0,'Only this owned Next tree may be stopped');
  if(process.platform==='win32'){if(server.exitCode===null&&server.signalCode===null){const stopped=spawnSync('taskkill.exe',['/PID',String(server.pid),'/T','/F'],{stdio:'ignore',windowsHide:true,timeout:10000});assert.equal(stopped.status,0,'The owned Next tree must stop before fixture removal');}}
  else{try{process.kill(-server.pid,'SIGTERM');}catch(error){if(error.code!=='ESRCH')throw error;}}
  await Promise.race([serverClosed,new Promise((_,reject)=>{deadline=setTimeout(()=>reject(Error('PLAN_BOUNDARY_SERVER_CLOSE_TIMEOUT')),10000);})]);
  if(process.platform!=='win32'){try{process.kill(-server.pid,'SIGKILL');}catch(error){if(error.code!=='ESRCH')throw error;}const until=Date.now()+10000;for(;;){try{process.kill(-server.pid,0);}catch(error){if(error.code==='ESRCH')break;throw error;}assert.ok(Date.now()<until,'The owned Next process group must disappear before fixture removal');await new Promise(resolve=>setTimeout(resolve,50));}}
 }finally{clearTimeout(deadline);}
}
let log='',proof,fixtureRemoved=false;for(const stream of [server.stdout,server.stderr])stream.on('data',data=>{log=(log+data).slice(-8000);});
try {
 for(let attempt=0;attempt<90;attempt++){try{if((await fetch(origin)).ok)break;}catch{}if(server.exitCode!==null)throw Error('PLAN_BOUNDARY_SERVER_STOPPED');await new Promise(resolve=>setTimeout(resolve,500));if(attempt===89)throw Error('PLAN_BOUNDARY_SERVER_TIMEOUT');}
 for(const method of ['GET','POST']){const response=await fetch(origin+'/api/identity/plan-import',{method,headers:{origin:IDENTITY_ORIGIN,'Content-Type':'application/json'},...(method==='POST'?{body:'{}'}:{})});assert.equal(response.status,401);assert.equal((await response.json()).code,'SESSION_REQUIRED');assert.match(response.headers.get('cache-control'),/private, no-store/);checks.push({method,status:401,code:'SESSION_REQUIRED'});}
 for(const method of ['HEAD','OPTIONS','PUT','PATCH','DELETE']){const response=await fetch(origin+'/api/identity/plan-import',{method});assert.equal(response.status,401);assert.match(response.headers.get('cache-control'),/private, no-store/);if(method!=='HEAD')assert.equal((await response.json()).code,'AUTHENTICATION_REQUIRED');checks.push({method,status:401,code:'AUTHENTICATION_REQUIRED'});}
 for(const suffix of ['/fake','-extra']){const response=await fetch(origin+'/api/identity/plan-import'+suffix);assert.equal(response.status,401);assert.equal((await response.json()).code,'AUTHENTICATION_REQUIRED');checks.push({suffix,status:401,code:'AUTHENTICATION_REQUIRED'});}
 sourceManifest.sort((a,b)=>a.path.localeCompare(b.path));proof={validated:true,actualNextProxy:true,anonymousOnly:true,providerRequests:0,businessWrites:0,checks,sourceManifest,...sourceProof};
}catch(error){console.error(log);throw error;}finally{await stopHarnessServer();const target=realpathSync(fixture);assert.equal(path.dirname(target),realpathSync(evidence));assert.ok(path.basename(target).startsWith('plan-boundary-'));rmSync(target,{recursive:true,force:true});fixtureRemoved=!existsSync(target);}
assert.equal(fixtureRemoved,true);proof.fixtureRemoved=true;writeFileSync(path.join(evidence,'plan-import-boundary-validation.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify({...proof,checks:checks.length,sourceManifest:sourceManifest.length}));
