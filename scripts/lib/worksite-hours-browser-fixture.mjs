import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {copyFileSync,existsSync,lstatSync,mkdirSync,readFileSync,realpathSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {parse} from '@babel/parser';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const inside=(file,base)=>{const rel=path.relative(base,file);return rel!==''&&!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel);};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export const HOURS_WIDTHS=[320,390,768,1280],HOURS_CASES=['complete','advanced','incomplete-preview','stale-download','incomplete-download','denied-download','denied-preview'];

// No backend module is imported in the loopback parent. The Node-only fixture
// and its mandatory network guard run exclusively in the separate data child.
export function prepareWorksiteHoursBrowserFixture({root,fixture,sourceManifest,bundle,fingerprintOnly=false}){
 const recorded=new Map(sourceManifest.map(row=>[row.path,row.sha256])),visited=new Set(),copied=new Set(),externalImports=new Set();
 function walk(filename,copy){
  filename=realpathSync(filename);assert.ok(inside(filename,root));const rel=path.relative(root,filename).split(path.sep).join('/'),bytes=readFileSync(filename),hash=sha(bytes);
  if(recorded.has(rel))assert.equal(recorded.get(rel),hash);else{recorded.set(rel,hash);sourceManifest.push({path:rel,sha256:hash});}
  if(copy&&!copied.has(filename)){assert.ok(inside(filename,path.join(root,'src')));const dest=path.join(fixture,path.relative(root,filename));assert.ok(inside(dest,fixture));mkdirSync(path.dirname(dest),{recursive:true});copyFileSync(filename,dest);assert.deepEqual(readFileSync(dest),bytes);copied.add(filename);}
  const visitKey=(copy?'copy:':'hash:')+filename;if(visited.has(visitKey))return;visited.add(visitKey);
  if(filename.endsWith('.css')){assert.ok(!/@import\s|url\(\s*['"]?(?!data:|#)/i.test(bytes.toString()));return;}
  const ast=parse(bytes.toString(),{sourceType:'module',plugins:['jsx']}),imports=[];
  function visit(node){if(!node||typeof node!=='object')return;if(['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration'].includes(node.type)&&node.source)imports.push(node.source.value);if(node.type==='ImportExpression'){assert.equal(node.source.type,'StringLiteral');imports.push(node.source.value);}if(node.type==='CallExpression'&&node.callee?.type==='Import'){assert.equal(node.arguments[0]?.type,'StringLiteral');imports.push(node.arguments[0].value);}for(const value of Object.values(node)){if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);}}
  visit(ast);
  for(const specifier of imports){if(!specifier.startsWith('.')){if(copy)assert.ok(['react','lucide-react'].includes(specifier),'Unexpected Hours browser import '+specifier);externalImports.add(specifier);continue;}const fileBase=path.resolve(path.dirname(filename),specifier),dep=[fileBase,fileBase+'.js',fileBase+'.mjs',fileBase+'.css',path.join(fileBase,'index.js')].find(candidate=>existsSync(candidate)&&lstatSync(candidate).isFile());assert.ok(dep,'Unresolved source '+specifier);walk(dep,copy);}
 }
 walk(path.join(root,'src/app/(identity)/cuenta/field-hours-report-panel.js'),true);
 // The fixture page mounts the same outer Field panel styling explicitly.
 walk(path.join(root,'src/app/(identity)/cuenta/field-operations-panel.module.css'),true);
 walk(path.join(root,'scripts/lib/worksite-hours-browser-data.mjs'),false);
 if(fingerprintOnly){sourceManifest.sort((a,b)=>a.path.localeCompare(b.path));return {fingerprinted:true};}
 const selected=bundle.cases[bundle.zones[0]].complete;
 const page=`'use client';
import {useState} from 'react';
import {FieldHoursReportPanel} from '../(identity)/cuenta/field-hours-report-panel';
import styles from '../(identity)/cuenta/field-operations-panel.module.css';
const token=async()=> 'synthetic-hours-browser-director';
export default function HoursBrowserFixture(){const [denials,setDenials]=useState([]);return <main data-hours-browser-fixture style={{maxWidth:1050,margin:'0 auto',minWidth:0}}><section className={styles.panel}><FieldHoursReportPanel projectId=${JSON.stringify(selected.projectId)} scope=${JSON.stringify(selected.scope)} disabled={false} getSessionToken={token} onAccessDenied={error=>setDenials(old=>[...old,error.status])}/></section><output data-hours-access-denials>{denials.join(',')}</output></main>;}
`;
 const target=path.join(fixture,'src/app/hours-browser/page.js');mkdirSync(path.dirname(target),{recursive:true});writeFileSync(target,page);sourceManifest.sort((a,b)=>a.path.localeCompare(b.path));
 return {pageSha256:sha(page),actualHoursPanelMounted:true,canonicalBrowserFiles:copied.size,sourceFingerprintCount:sourceManifest.length,externalImports:[...externalImports].sort(),dataSource:'Isolated guarded child: actual canonical HTTP/projectOperation/report/CSV with in-memory SQL adapter',database:false};
}

async function tabTo(page,selector,keyboard){
 for(let step=0;step<90;step++){
  if(await page.evaluate(selector=>{const node=document.querySelector(selector);return Boolean(node)&&document.activeElement===node;},selector))return;
  await page.keyboard.press('Tab');keyboard.push(await page.evaluate(()=>({tag:document.activeElement?.tagName,type:document.activeElement?.type||null,text:document.activeElement?.textContent?.trim().slice(0,100)||null})));
 }
 throw new Error('Keyboard could not reach '+selector);
}
async function tabToText(page,label,keyboard){
 for(let step=0;step<90;step++){
  if(await page.evaluate(label=>[...document.querySelectorAll('button,summary')].find(node=>node.textContent.trim()===label)===document.activeElement,label))return;
  await page.keyboard.press('Tab');keyboard.push(await page.evaluate(()=>({tag:document.activeElement?.tagName,type:document.activeElement?.type||null,text:document.activeElement?.textContent?.trim().slice(0,100)||null})));
 }
 throw new Error('Keyboard could not reach '+label);
}
async function hasText(page,text){await page.waitForFunction(text=>document.body.innerText.includes(text),{timeout:20000},text);}
async function formDates(page,fromDate,untilDate){
 await page.$$eval('form input[type=date]',(nodes,values)=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;nodes.forEach((node,index)=>{setter.call(node,values[index]);node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}));});},[fromDate,untilDate]);
}
async function selected(page){return page.evaluate(()=>({dates:[...document.querySelectorAll('input[type=date]')].map(node=>node.value),zone:document.querySelector('form select')?.value,other:document.querySelector('input[placeholder*="Europe/Madrid"]')?.value||null,confirmed:document.querySelector('input[type=checkbox]')?.checked}));}
async function layout(page,width,stage){
 const value=await page.evaluate(()=>({viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,controls:[...document.querySelectorAll('form input:not([type=checkbox]),form select,form button,form label:has(input[type=checkbox]),button:not([type=submit])')].filter(node=>node.getClientRects().length).map(node=>({tag:node.tagName,type:node.type||null,text:node.textContent.slice(0,100),left:node.getBoundingClientRect().left,right:node.getBoundingClientRect().right,width:node.getBoundingClientRect().width,height:node.getBoundingClientRect().height})),summaries:[...document.querySelectorAll('summary')].filter(node=>node.getClientRects().length).map(node=>({text:node.textContent,height:node.getBoundingClientRect().height,width:node.getBoundingClientRect().width}))}));
 assert.equal(value.viewport,width);assert.ok(value.documentWidth<=width,'Horizontal overflow '+stage+' at '+width);assert.ok(value.controls.every(node=>node.left>=0&&node.right<=width&&node.height>=44&&node.width>=44),'Clipped/small primary control '+stage+' '+JSON.stringify(value.controls.filter(node=>node.left<0||node.right>width||node.height<44||node.width<44)));
 return {stage,...value};
}
async function downloaded(file){for(let i=0;i<200;i++){if(existsSync(file))return readFileSync(file);await wait(50);}throw new Error('Explicit Hours CSV download did not complete');}

export async function runWorksiteHoursBrowser({browser,origin,output,bundle,checks,errors,evidenceSink={}}){
 const facts=[],cases=[],handlerErrors=[];evidenceSink.requests=facts;evidenceSink.cases=cases;
 for(const width of HOURS_WIDTHS)for(const mode of HOURS_CASES){
  const directory=path.join(output,'downloads-'+width+'-'+mode);mkdirSync(directory,{recursive:true});const context=await browser.createBrowserContext({downloadBehavior:{policy:'allow',downloadPath:directory}}),page=await context.newPage(),keyboard=[],layouts=[];let scenarioFailure;
  const backendMode=mode==='advanced'?'complete':mode;
  await page.setViewport({width,height:1000});
  await page.evaluateOnNewDocument(()=>{window.__hoursObjectUrls=new Set();window.__hoursAnchors=[];const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL),click=HTMLAnchorElement.prototype.click;URL.createObjectURL=value=>{const url=create(value);window.__hoursObjectUrls.add(url);return url;};URL.revokeObjectURL=value=>{window.__hoursObjectUrls.delete(value);revoke(value);};HTMLAnchorElement.prototype.click=function(){window.__hoursAnchors.push({href:this.href,download:this.download});return click.call(this);};});
  page.on('pageerror',error=>errors.push({width,mode,error:error.message}));page.on('console',message=>{if(message.type()==='error'&&!message.text().startsWith('Failed to load resource'))errors.push({width,mode,error:message.text()});});
  await page.setRequestInterception(true);
  page.on('request',async request=>{try{
   const url=new URL(request.url());if(url.origin!==origin){if(['blob:','data:'].includes(url.protocol))return request.continue();handlerErrors.push({width,mode,error:'External request blocked',origin:url.origin});return request.abort();}if(!url.pathname.startsWith('/api/identity/'))return request.continue();
   assert.equal(request.method(),'GET','Hours UI must not send a write');assert.equal(url.pathname,'/api/identity/field-operations');assert.equal(request.headers().authorization,'Bearer synthetic-hours-browser-director');
   const params=Object.fromEntries(url.searchParams),wireCase=bundle.cases[params.hoursTimeZone]?.[backendMode];assert.ok(wireCase,'Only explicit confirmed fixture zones are allowed');assert.equal(params.projectId,wireCase.projectId);assert.equal(params.scope,wireCase.scope);assert.equal(params.hoursFrom,wireCase.period.fromDate);assert.equal(params.hoursUntil,wireCase.period.untilDate);assert.ok(['json','csv'].includes(params.hoursFormat));
   const csv=params.hoursFormat==='csv';assert.deepEqual(Object.keys(params).sort(),(csv?['expectedHoursDigest','hoursFormat','hoursFrom','hoursTimeZone','hoursUntil','projectId','scope']:['hoursFormat','hoursFrom','hoursTimeZone','hoursUntil','projectId','scope']).sort());if(csv)assert.equal(params.expectedHoursDigest,wireCase.reportDigest);
   const response=csv?wireCase.download:wireCase.preview;assert.ok(response,'No export is available for an incomplete/unauthorized preview');facts.push({width,mode,method:request.method(),path:url.pathname,query:params,status:response.status});return request.respond({status:response.status,headers:response.headers,body:Buffer.from(response.bodyBase64,'base64')});
  }catch(error){handlerErrors.push({width,mode,error:error.message});try{await request.abort();}catch{/* Already closed. */}}});
  const ownFacts=()=>facts.filter(item=>item.width===width&&item.mode===mode);
  try{
   await page.goto(origin+'/hours-browser',{waitUntil:'networkidle0'});assert.equal(ownFacts().length,0);assert.deepEqual(await page.evaluate(()=>window.__hoursAnchors),[]);
   await tabToText(page,'Resumen de jornadas',keyboard);await page.keyboard.press('Enter');await page.waitForSelector('details[open] form');
   assert.deepEqual(await selected(page),{dates:['',''],zone:'',other:null,confirmed:false});assert.equal(await page.$eval('button[type=submit]',node=>node.disabled),true);layouts.push(await layout(page,width,'empty'));
   // Native required-field validation blocks a confirmed but empty form.
   await tabTo(page,'input[type=checkbox]',keyboard);await page.keyboard.press('Space');await tabTo(page,'button[type=submit]',keyboard);await page.keyboard.press('Enter');await wait(100);assert.equal(ownFacts().length,0);assert.equal(await page.$eval('form',node=>node.checkValidity()),false);
   await formDates(page,bundle.period.fromDate,bundle.period.untilDate);assert.equal((await selected(page)).confirmed,false);
   await tabTo(page,'form select',keyboard);await page.keyboard.press('Home');await page.keyboard.press('ArrowDown');assert.equal((await selected(page)).zone,'America/Argentina/Buenos_Aires');assert.equal((await selected(page)).confirmed,false);assert.equal(ownFacts().length,0);
   await tabTo(page,'input[type=checkbox]',keyboard);await page.keyboard.press('Space');await tabTo(page,'button[type=submit]',keyboard);await page.keyboard.press('Enter');
   if(mode==='denied-preview'){
    await page.waitForFunction(()=>document.querySelector('[data-hours-access-denials]')?.textContent==='401');assert.equal(await page.$eval('main',node=>/jornadas? en la consulta completa/.test(node.innerText)),false);assert.equal(await page.$('button[type=button]'),null);assert.equal(ownFacts().length,1);
   }else if(mode==='incomplete-preview'){
    await hasText(page,'No se muestran totales ni una exportación parcial.');assert.equal(await page.$eval('main',node=>node.innerText.includes('Netas observadas')),false);assert.equal(await page.$$eval('button',nodes=>nodes.filter(node=>node.textContent==='Descargar CSV de esta consulta').length),0);assert.equal(ownFacts().length,1);layouts.push(await layout(page,width,'incomplete-preview'));
   }else{
    await hasText(page,'1 jornada en la consulta completa');await page.waitForFunction(()=>document.activeElement?.tabIndex===-1&&Boolean(document.activeElement.querySelector?.('h4')));assert.equal(ownFacts().length,1);assert.equal(await page.$eval('main',node=>node.innerText.includes('Zona: Argentina (Buenos Aires)')),true);
    if(mode==='advanced'){
     await tabTo(page,'form select',keyboard);await page.keyboard.press('End');await page.waitForSelector('input[placeholder*="Europe/Madrid"]');assert.equal((await selected(page)).confirmed,false);assert.equal(await page.$eval('main',node=>/jornadas? en la consulta completa/.test(node.innerText)),false);
     await tabTo(page,'input[type=checkbox]',keyboard);await page.keyboard.press('Space');await tabTo(page,'button[type=submit]',keyboard);await page.keyboard.press('Enter');await wait(100);assert.equal(ownFacts().length,1,'Empty advanced zone must not dispatch');
     await tabTo(page,'input[placeholder*="Europe/Madrid"]',keyboard);await page.keyboard.type('Europe/Madrid');assert.equal((await selected(page)).confirmed,false);await tabTo(page,'input[type=checkbox]',keyboard);await page.keyboard.press('Space');await tabTo(page,'button[type=submit]',keyboard);await page.keyboard.press('Enter');await hasText(page,'Zona: Europe/Madrid');assert.equal(ownFacts().length,2);
    }
    layouts.push(await layout(page,width,'complete-preview'));
    if(['complete','advanced'].includes(mode)){
     const report=bundle.cases[mode==='advanced'?'Europe/Madrid':bundle.zones[0]].complete;
     assert.equal(await page.$eval('main',node=>node.innerText.includes('actor-worker')),false,'Technical actor reference must stay collapsed');assert.equal(await page.$eval('main',(node,digest)=>node.innerText.includes(digest),report.reportDigest),false);
     await tabToText(page,'Ver jornadas y sus estados (1)',keyboard);await page.keyboard.press('Enter');layouts.push(await layout(page,width,'expanded-rows'));
     await tabToText(page,'Referencias del registro',keyboard);await page.keyboard.press('Enter');await hasText(page,'actor-worker');layouts.push(await layout(page,width,'expanded-source-reference'));await page.keyboard.press('Enter');
     await tabToText(page,'Referencias de la consulta',keyboard);await page.keyboard.press('Enter');await hasText(page,report.reportDigest);layouts.push(await layout(page,width,'expanded-report-reference'));await page.keyboard.press('Enter');
    }
    const beforeDownload=ownFacts().length;assert.equal(ownFacts().filter(item=>item.query.hoursFormat==='csv').length,0);assert.deepEqual(await page.evaluate(()=>window.__hoursAnchors),[]);
    await tabToText(page,'Descargar CSV de esta consulta',keyboard);assert.ok(await page.evaluate(()=>parseFloat(getComputedStyle(document.activeElement).outlineWidth)>=1),'Keyboard focus must remain visible');await page.keyboard.press('Enter');
    if(['complete','advanced'].includes(mode)){
     await hasText(page,'CSV obtenido con los mismos fichajes y revisiones consultados.');const data=bundle.cases[mode==='advanced'?'Europe/Madrid':bundle.zones[0]].complete.download,filename='jornadas-'+bundle.period.fromDate+'-'+bundle.period.untilDate+'-hasta-exclusivo.csv',bytes=await downloaded(path.join(directory,filename));assert.deepEqual(bytes,Buffer.from(data.bodyBase64,'base64'));await page.waitForFunction(()=>window.__hoursObjectUrls.size===0);assert.equal((await page.evaluate(()=>window.__hoursAnchors)).length,1);
    }else{
     await hasText(page,mode==='stale-download'?'Los fichajes o sus revisiones cambiaron':mode==='incomplete-download'?'La fuente no está completa':'No se pudo consultar el resumen');
     assert.equal(await page.$eval('main',node=>/Netas observadas|jornadas? en la consulta completa/.test(node.innerText)),false);assert.equal(await page.$$eval('button',nodes=>nodes.filter(node=>node.textContent==='Descargar CSV de esta consulta').length),0);assert.deepEqual(await page.evaluate(()=>window.__hoursAnchors),[]);assert.equal(await page.evaluate(()=>window.__hoursObjectUrls.size),0);
     if(mode==='denied-download')assert.equal(await page.$eval('[data-hours-access-denials]',node=>node.textContent),'401');
     assert.deepEqual((await selected(page)).dates,[bundle.period.fromDate,bundle.period.untilDate]);assert.equal((await selected(page)).zone,'America/Argentina/Buenos_Aires');
    }
    assert.equal(ownFacts().length,beforeDownload+1);await wait(650);assert.equal(ownFacts().length,beforeDownload+1,'No automatic reconsultation or repeated CSV');
   }
   layouts.push(await layout(page,width,'final'));assert.deepEqual(handlerErrors,[]);assert.deepEqual(errors,[]);const screenshot=path.join(output,'hours-'+width+'-'+mode+'.png');await page.screenshot({path:screenshot,fullPage:true});checks.push('hours-'+mode+'-'+width);cases.push({width,mode,status:'PASS',requests:ownFacts().length,keyboard,layouts,screenshot});
  }catch(error){scenarioFailure=error;cases.push({width,mode,status:'FAIL',error:error.message,requests:ownFacts().length,keyboard,layouts});throw error;}
  finally{await context.close();if(scenarioFailure)evidenceSink.lastFailure=scenarioFailure.message;}
 }
 assert.equal(checks.length,HOURS_WIDTHS.length*HOURS_CASES.length);return {caseCount:cases.length,requestCount:facts.length,allGet:true,layoutWidths:HOURS_WIDTHS,keyboardScenarios:true};
}
