import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,copyFileSync,cpSync,writeFileSync,readFileSync,readdirSync,rmSync} from 'node:fs';
import {createHash,randomBytes} from 'node:crypto';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {IDENTITY_PUBLIC_KEY,IDENTITY_INSTANCE,IDENTITY_ORIGIN} from '../src/lib/production-identity-config.mjs';
assert.ok(!process.env.VERCEL&&!process.env.VERCEL_ENV&&!process.env.VERCEL_TARGET_ENV);
const root=process.cwd(),privateFolder=path.join(root,'.vercel/private');mkdirSync(privateFolder,{recursive:true});
const fixture=mkdtempSync(path.join(privateFolder,'company-channel-built-boundary-')),manifest=[];
function copied(relative){const target=path.join(fixture,relative);mkdirSync(path.dirname(target),{recursive:true});copyFileSync(path.join(root,relative),target);manifest.push({path:relative,sha256:createHash('sha256').update(readFileSync(target)).digest('hex')});}
copied('src/proxy.js');copied('src/app/api/identity/company-channel/route.js');
// Compile the actual transitive runtime against installed dependencies, with no
// .env files, business database, provider credentials or copied client screens.
cpSync(path.join(root,'src/lib'),path.join(fixture,'src/lib'),{recursive:true});
function walk(folder){for(const entry of readdirSync(folder,{withFileTypes:true})){const item=path.join(folder,entry.name);if(entry.isDirectory())walk(item);else manifest.push({path:path.relative(fixture,item).replaceAll(path.sep,'/'),sha256:createHash('sha256').update(readFileSync(item)).digest('hex')});}}walk(path.join(fixture,'src/lib'));
writeFileSync(path.join(fixture,'package.json'),JSON.stringify({private:true}));writeFileSync(path.join(fixture,'next.config.mjs'),`export default {serverExternalPackages:['ffmpeg-static'],turbopack:{root:${JSON.stringify(root)}}};`);
writeFileSync(path.join(fixture,'src/app/layout.js'),`export default function Layout({children}){return <html lang="es"><body>{children}</body></html>}`);writeFileSync(path.join(fixture,'src/app/page.js'),`export default function Page(){return <p>Corporate channel boundary fixture</p>}`);
const env={...process.env,NEXT_TELEMETRY_DISABLED:'1',VERCEL_ENV:'development',NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:IDENTITY_PUBLIC_KEY,CLERK_EXPECTED_INSTANCE_ID:IDENTITY_INSTANCE,NEXT_PUBLIC_APP_URL:IDENTITY_ORIGIN,CLERK_AUTHORIZED_PARTIES:IDENTITY_ORIGIN,DATABASE_URL:'',NEON_DATABASE_URL:'',OPENAI_API_KEY:'',BLOB_READ_WRITE_TOKEN:'',META_APP_SECRET:'',META_CUSTOMER_CREDENTIALS_KEY:'',WHATSAPP_CREDENTIALS_ENCRYPTION_KEY:'',CLERK_SECRET_KEY:'',INTERNAL_API_SECRET:randomBytes(32).toString('hex')};
let server,log='';const port=3148,origin='http://127.0.0.1:'+port,checks=[];
function command(args){const child=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),...args],{cwd:root,windowsHide:true,env,stdio:['ignore','pipe','pipe']});for(const stream of [child.stdout,child.stderr])stream.on('data',data=>{log=(log+data).slice(-12000);});return child;}
try{
 const build=command(['build',fixture,'--webpack']),exit=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{build.kill();reject(new Error('COMPANY_CHANNEL_BOUNDARY_BUILD_TIMEOUT'));},180000);build.once('error',reject);build.once('exit',code=>{clearTimeout(timeout);resolve(code);});});assert.equal(exit,0,'Actual Next build failed');
 server=command(['start',fixture,'--hostname','127.0.0.1','--port',String(port)]);
 for(let attempt=0;attempt<90;attempt++){try{if((await fetch(origin)).ok)break;}catch{}if(server.exitCode!==null)throw Error('COMPANY_CHANNEL_BOUNDARY_SERVER_STOPPED');await new Promise(resolve=>setTimeout(resolve,500));if(attempt===89)throw Error('COMPANY_CHANNEL_BOUNDARY_SERVER_TIMEOUT');}
 const forged='Bearer '+Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT',kid:'synthetic'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:'user_Synthetic',org_id:'org_Synthetic',org_role:'org:admin'})).toString('base64url')+'.'+Buffer.alloc(32).toString('base64url');
 for(const method of ['GET','POST'])for(const [kind,headers] of [['anonymous',{}],['legacy-service',{authorization:'Bearer '+env.INTERNAL_API_SECRET}],['client-identity',{'x-user-id':'user_Synthetic','x-organization-id':'org_Synthetic','x-role':'ADMIN',cookie:'obrasaas_logged_in=true'}],['middleware-subrequest',{'x-middleware-subrequest':'proxy:proxy:proxy:proxy:proxy'}],['forged-JWT',{authorization:forged}]]){
  const response=await fetch(origin+'/api/identity/company-channel',{method,headers:{origin:IDENTITY_ORIGIN,'Content-Type':'application/json',...headers},...(method==='POST'?{body:'{}'}:{})});assert.equal(response.status,401,kind+' '+method);assert.equal((await response.json()).code,'SESSION_REQUIRED');assert.match(response.headers.get('cache-control'),/private, no-store/);checks.push({method,kind,status:401});
 }
 for(const suffix of ['/fake','-extra']){const response=await fetch(origin+'/api/identity/company-channel'+suffix);assert.equal(response.status,401);assert.equal((await response.json()).code,'AUTHENTICATION_REQUIRED');checks.push({suffix,status:401});}
 for(const method of ['PUT','PATCH','DELETE']){const response=await fetch(origin+'/api/identity/company-channel',{method});assert.equal(response.status,405);checks.push({method,status:405});}
 writeFileSync(path.join(privateFolder,'company-channel-boundary-proof.json'),JSON.stringify({version:1,at:new Date().toISOString(),status:'PASS',checks,checkCount:checks.length,actualNextBuild:true,actualNextProxy:true,anonymousAndForgedOnly:true,businessDatabaseConfigured:false,providerCredentialsConfigured:false,providerRequests:0,businessWrites:0,harnessSha256:createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),sourceManifest:manifest},null,2));console.log(JSON.stringify({status:'PASS',checks:checks.length,actualNextBuild:true,actualNextProxy:true,providerRequests:0,businessWrites:0}));
}catch(error){console.error(log);throw error;}finally{if(server){const stopped=new Promise(resolve=>server.once('exit',resolve));server.kill();if(server.exitCode===null)await stopped;}assert.ok(path.resolve(fixture).startsWith(path.resolve(privateFolder)+path.sep));rmSync(fixture,{recursive:true,force:true});}
