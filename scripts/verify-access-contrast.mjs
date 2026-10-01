import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import puppeteer from 'puppeteer';
import {IDENTITY_ORIGIN,IDENTITY_PUBLIC_KEY,IDENTITY_INSTANCE} from '../src/lib/production-identity-config.mjs';

const live=process.env.ACCESS_LIVE_ORIGIN;
assert.ok(!live||live===IDENTITY_ORIGIN,'Only the canonical ObraSaaS origin is accepted for live checks');
const local='http://127.0.0.1:3232',folder=resolve('.vercel/access-contrast-evidence'+(live?'-live':''));
mkdirSync(folder,{recursive:true});
let server,browser,page,startup='';const checks=[],pageErrors=[],blockedMutations=[];
if(!live){server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3232'],{
 env:{...process.env,NODE_ENV:'production',NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:IDENTITY_PUBLIC_KEY,CLERK_EXPECTED_INSTANCE_ID:IDENTITY_INSTANCE,NEXT_PUBLIC_APP_URL:IDENTITY_ORIGIN,CLERK_AUTHORIZED_PARTIES:IDENTITY_ORIGIN},stdio:['ignore','pipe','pipe']});
 for(const stream of [server.stdout,server.stderr])stream.on('data',chunk=>{startup=(startup+chunk.toString()).slice(-12000);});}

// Measure computed colors of the real remotely loaded Clerk component. Canvas
// resolves modern CSS color syntax; translucent text is composited over its
// actual ancestor backgrounds before applying the WCAG luminance formula.
async function measure(page){return page.evaluate(()=>{
 const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const context=canvas.getContext('2d',{willReadFrequently:true});
 const color=value=>{context.clearRect(0,0,1,1);context.fillStyle=value;context.fillRect(0,0,1,1);return [...context.getImageData(0,0,1,1).data].map((value,index)=>index===3?value/255:value);};
 const over=(fg,bg)=>{const alpha=fg[3]+bg[3]*(1-fg[3]);return [0,1,2].map(index=>alpha?(fg[index]*fg[3]+bg[index]*bg[3]*(1-fg[3]))/alpha:0).concat(alpha);};
 const luminance=rgb=>rgb.slice(0,3).map(value=>value/255).map(value=>value<=0.04045?value/12.92:((value+0.055)/1.055)**2.4).reduce((sum,value,index)=>sum+value*[0.2126,0.7152,0.0722][index],0);
 const ratio=(fg,bg)=>{const a=luminance(fg),b=luminance(bg);return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);};
 const hiddenReason=element=>{const rect=element.getBoundingClientRect();if(rect.width===0||rect.height===0)return 'zero-area';for(let current=element;current;current=current.parentElement){const style=getComputedStyle(current);if(style.visibility==='hidden'||style.display==='none')return 'hidden-by-style';if(Number(style.opacity)===0)return 'fully-transparent';if(current.getAttribute('aria-hidden')==='true')return 'aria-hidden';if(style.clip==='rect(0px, 0px, 0px, 0px)'||style.clipPath==='inset(50%)')return 'visually-clipped';}return null;};
 function sample(element,pseudo=null,label=null){const ancestors=[];for(let current=element;current;current=current.parentElement)ancestors.unshift(current);let background=[255,255,255,1],opacity=1;
  for(const current of ancestors){const style=getComputedStyle(current);background=over(color(style.backgroundColor),background);opacity*=Number(style.opacity);}
  const style=getComputedStyle(element,pseudo),foreground=color(style.color);foreground[3]*=opacity*(pseudo?Number(style.opacity):1);
  const computed=over(foreground,background),large=parseFloat(style.fontSize)>=24||(parseFloat(style.fontSize)>=18.66&&parseInt(style.fontWeight,10)>=700);
  return {label:label||element.textContent.trim().slice(0,120),selector:element.className,foreground:style.color,background:background.slice(0,3).map(Math.round),opacity:foreground[3],contrast:Number(ratio(computed,background).toFixed(3)),minimum:large?3:4.5};
 }
 const root=document.querySelector('.cl-rootBox');if(!root)throw new Error('The real Clerk form is unavailable');const samples=[],excluded=[];
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);while(walker.nextNode()){const node=walker.currentNode,element=node.parentElement;if(node.textContent.trim()&&element&&element.tagName!=='SCRIPT'&&element.tagName!=='STYLE'){const hidden=hiddenReason(element);if(hidden)excluded.push({label:node.textContent.trim().slice(0,120),reason:hidden});else samples.push(sample(element,null,node.textContent.trim().slice(0,120)));}}
 for(const input of root.querySelectorAll('input:not([type=hidden])'))if(!hiddenReason(input)){samples.push(sample(input,null,'Input text: '+(input.name||input.type)));if(input.placeholder)samples.push(sample(input,'::placeholder','Input placeholder: '+(input.name||input.type)));}
 return {samples,excluded,required:{heading:Boolean(root.querySelector('.cl-headerTitle')),label:Boolean(root.querySelector('.cl-formFieldLabel')),input:Boolean(root.querySelector('input:not([type=hidden])')),primary:Boolean(root.querySelector('.cl-formButtonPrimary')),footer:Boolean(root.querySelector('.cl-footerActionText')),link:Boolean(root.querySelector('.cl-footerActionLink'))},overflow:document.documentElement.scrollWidth>innerWidth};
 });}
function verify(result,label){for(const [name,present] of Object.entries(result.required))assert.ok(present,label+' missing real Clerk '+name);assert.equal(result.overflow,false,label+' horizontal overflow');assert.ok(result.samples.length>=7,label+' insufficient real text samples');for(const sample of result.samples)assert.ok(sample.contrast>=sample.minimum,`${label}: ${sample.label} contrast ${sample.contrast} < ${sample.minimum}`);}

try{
 if(server){let ready=false;for(let i=0;i<60;i++){if(server.exitCode!==null)throw new Error('Built Next server exited');try{if((await fetch(local+'/sign-in')).ok){ready=true;break;}}catch{}await new Promise(done=>setTimeout(done,500));}assert.ok(ready,'Built Next server is unavailable');}
 browser=await puppeteer.launch({headless:true,...(process.platform==='win32'?{channel:'chrome'}:{}),args:['--no-sandbox','--disable-setuid-sandbox']});
 for(const route of ['/sign-in','/sign-up']){
  page=await browser.newPage();await page.setBypassServiceWorker(true);page.on('pageerror',error=>pageErrors.push(error.message));await page.setRequestInterception(true);
  page.on('request',async request=>{try{const url=new URL(request.url()),bootstrap=request.method()==='POST'&&url.origin==='https://clerk.obrasaas.com'&&url.pathname==='/v1/client';
   if(!['GET','HEAD','OPTIONS'].includes(request.method())&&!bootstrap){blockedMutations.push({method:request.method(),origin:url.origin,path:url.pathname});return request.abort();}
   // Production Clerk keys require their canonical browser origin. In local
   // mode only ObraSaaS GET resources are served from the built local checkout;
   // the real Clerk SDK and anonymous configuration still come from Clerk.
   if(!live&&url.origin===IDENTITY_ORIGIN){const response=await fetch(local+url.pathname+url.search,{method:request.method(),redirect:'manual'}),headers=Object.fromEntries(response.headers);delete headers['content-encoding'];delete headers['content-length'];return request.respond({status:response.status,headers,body:Buffer.from(await response.arrayBuffer())});}
   return request.continue();
  }catch(error){pageErrors.push(error.message);if(!request.isInterceptResolutionHandled())await request.abort().catch(()=>{});}});
  await page.goto(IDENTITY_ORIGIN+route,{waitUntil:'networkidle2',timeout:90000});await page.waitForSelector('.cl-rootBox .cl-formFieldInput',{visible:true,timeout:30000});
  for(const width of [320,390,768,1280]){await page.setViewport({width,height:950});await new Promise(done=>setTimeout(done,150));const result=await measure(page);checks.push({route,width,state:'default',...result});verify(result,route+' '+width);await page.screenshot({path:resolve(folder,(route==='/sign-in'?'sign-in':'sign-up')+'-'+width+'.png'),fullPage:true});}
  await page.setViewport({width:390,height:950});await page.type('.cl-formFieldInput','contrast-check@example.invalid');await page.focus('.cl-formFieldInput');const focused=await measure(page);verify(focused,route+' focused-input');checks.push({route,width:390,state:'focused-input-with-text',...focused});
  await page.hover('.cl-formButtonPrimary');const hovered=await measure(page);verify(hovered,route+' hovered-button');checks.push({route,width:390,state:'hovered-button',...hovered});
  await page.hover('.cl-footerActionLink');const link=await measure(page);verify(link,route+' hovered-link');checks.push({route,width:390,state:'hovered-link',...link});await page.close();page=null;
 }
 assert.deepEqual(pageErrors,[]);assert.deepEqual(blockedMutations,[]);
 const proof={status:'PASS',environment:live?'live-production-anonymous':'built-local-app-with-real-Clerk-at-canonical-browser-origin',base:live||local,checks,pageErrors,blockedMutations,realClerkRendered:true,submittedSignInAttempts:0,authenticatedUserTested:false,businessWrites:0};writeFileSync(resolve(folder,'proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify({status:proof.status,environment:proof.environment,scenarios:checks.length,minimumContrast:Math.min(...checks.flatMap(value=>value.samples.map(sample=>sample.contrast))),submittedSignInAttempts:0,businessWrites:0}));
}catch(error){writeFileSync(resolve(folder,'failure.json'),JSON.stringify({message:error.message,stack:error.stack,pageErrors,blockedMutations,checks,startup},null,2));await page?.screenshot({path:resolve(folder,'failure.png'),fullPage:true}).catch(()=>{});throw error;
}finally{await browser?.close();server?.kill('SIGTERM');}
