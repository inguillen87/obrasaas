import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,copyFileSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import puppeteer from 'puppeteer';
import QRCode from 'qrcode';

assert.ok(!process.env.VERCEL&&!process.env.VERCEL_ENV,'Local/disposable fixture only');
const root=process.cwd(),output=process.env.FIELD_QR_UI_EVIDENCE?path.resolve(root,process.env.FIELD_QR_UI_EVIDENCE):path.join(root,'.vercel/field-qr-evidence');
mkdirSync(output,{recursive:true});
const fixture=mkdtempSync(path.join(output,'fixture-')),app=path.join(fixture,'src/app'),components=path.join(app,'(identity)/cuenta');
mkdirSync(components,{recursive:true});
const sha=value=>createHash('sha256').update(value).digest('hex'),sourceManifest=[];
const harnessSha256=sha(readFileSync(new URL(import.meta.url)));
const decoderVersion=JSON.parse(readFileSync(path.join(root,'node_modules/jsqr/package.json'),'utf8')).version;
assert.equal(decoderVersion,'1.4.0');assert.equal(JSON.parse(readFileSync(path.join(root,'package.json'),'utf8')).dependencies.jsqr,'1.4.0');
for(const file of ['field-qr-capture.js','field-qr-reader.mjs','field-operations-panel.module.css']){
 const source=path.join(root,'src/app/(identity)/cuenta',file),target=path.join(components,file);
 copyFileSync(source,target);sourceManifest.push({path:'src/app/(identity)/cuenta/'+file,sha256:sha(readFileSync(target))});
}
writeFileSync(path.join(fixture,'package.json'),JSON.stringify({name:'isolated-field-qr-ui',private:true}));
writeFileSync(path.join(fixture,'next.config.mjs'),`export default {devIndicators:false,turbopack:{root:${JSON.stringify(root)}}};`);
writeFileSync(path.join(app,'layout.js'),`export default function Layout({children}){return <html lang="es"><body style={{margin:0,padding:12,background:'#f0f4f7',fontFamily:'Arial,sans-serif'}}>{children}</body></html>}`);
writeFileSync(path.join(app,'page.js'),`'use client';
import {useCallback,useEffect,useState} from 'react';
import {FieldQrCapture} from './(identity)/cuenta/field-qr-capture';
import styles from './(identity)/cuenta/field-operations-panel.module.css';
export default function Page(){
 const [projectId,setProjectId]=useState('project-fixture'),[sectorId,setSectorId]=useState('sector-main'),[disabled,setDisabled]=useState(false),[shown,setShown]=useState(true),[key,setKey]=useState(0),[busy,setBusy]=useState(false),[count,setCount]=useState(0),[ready,setReady]=useState(false);
 const onBusyChange=useCallback(value=>{window.__qrTest.busyTrace.push(Boolean(value));setBusy(Boolean(value));},[]);
 const onRead=useCallback(raw=>{window.__qrTest.reads.push(raw);setCount(value=>value+1);},[]);
 useEffect(()=>{if(window.__qrTest.mode==='foreign-project')setProjectId('another-project');if(window.__qrTest.mode==='wrong-sector')setSectorId('another-sector');setReady(true);},[]);
 return <main className={styles.panel} style={{maxWidth:800,margin:'0 auto'}}>
  <h1>Lectura QR de ensayo</h1><p data-testid="ready">{ready?'Fixture lista':'Preparando fixture'}</p>
  <p data-testid="busy">{busy?'Ocupado':'Disponible'}</p><p data-testid="read-count">Lecturas: {count}</p>
  <div className={styles.actions}>
   <button data-testid="context-prop" onClick={()=>setProjectId('new-project')}>Cambiar obra de ensayo</button>
   <button data-testid="sector-prop" onClick={()=>setSectorId('new-sector')}>Cambiar sector de ensayo</button>
   <button data-testid="context-remount" onClick={()=>{setProjectId('remounted-project');setKey(value=>value+1);}}>Remontar contexto de ensayo</button>
   <button data-testid="disable" onClick={()=>setDisabled(true)}>Retirar permiso de ensayo</button>
   <button data-testid="unmount" onClick={()=>setShown(false)}>Desmontar lector de ensayo</button>
  </div>
  {ready&&shown&&<FieldQrCapture key={key} projectId={projectId} sectorId={sectorId} sectorName="Planta baja de ensayo" disabled={disabled} onRead={onRead} onBusyChange={onBusyChange}/>}
 </main>;
}`);

const projectId='project-fixture',sectorId='sector-main',token='b'.repeat(64);
const validRaw=JSON.stringify({version:1,projectId,sectorId,token});
const malformedRaw=JSON.stringify({version:1,projectId,sectorId,token:'invalid-token'});
const syntheticScanSources=[];
function cameraSource(name,raw){
 const qr=QRCode.create(raw,{errorCorrectionLevel:'M'}),width=640,height=480,quiet=4,scale=Math.floor((height-32)/(qr.modules.size+quiet*2));
 assert.ok(scale>=3,'Generated QR modules must be readable at 640×480');
 const pixels=qr.modules.size*scale,left=Math.floor((width-pixels)/2),top=Math.floor((height-pixels)/2),frame=Buffer.alloc(width*height*3/2,128);
 frame.fill(235,0,width*height);
 for(let row=0;row<qr.modules.size;row++)for(let column=0;column<qr.modules.size;column++)if(qr.modules.get(row,column))for(let y=0;y<scale;y++)frame.fill(16,(top+row*scale+y)*width+left+column*scale,(top+row*scale+y)*width+left+(column+1)*scale);
 const bytes=Buffer.concat([Buffer.from('YUV4MPEG2 W640 H480 F15:1 Ip A1:1 C420jpeg\n'),...Array.from({length:15},()=>[Buffer.from('FRAME\n'),frame]).flat()]);
 const cameraPath=path.join(fixture,name+'.y4m');writeFileSync(cameraPath,bytes);
 syntheticScanSources.push({name,width,height,frames:15,fps:15,qrModules:qr.modules.size,pixelsPerModule:scale,rawContentSha256:sha(raw),y4mSha256:sha(bytes),generatedBy:'qrcode.create -> luminance plane -> Chromium fake camera; no decoder-result stub',synthetic:true});
 return cameraPath;
}
const validCamera=cameraSource('valid-context-qr',validRaw),malformedCamera=cameraSource('malformed-qr',malformedRaw);
const focus=process.env.FIELD_QR_UI_FOCUS||null,requestedPort=process.env.FIELD_QR_UI_PORT?Number(process.env.FIELD_QR_UI_PORT):null;
assert.ok(focus===null||/^[a-z0-9-]+$/.test(focus),'Focused report names stay inside evidence directory');
assert.ok(requestedPort===null||[3118,3129].includes(requestedPort),'Only dedicated fixture ports 3118/3129');
async function isFree(port){return new Promise(resolve=>{const probe=net.createServer();probe.once('error',()=>resolve(false));probe.listen(port,'127.0.0.1',()=>probe.close(()=>resolve(true)));});}
let port=null;for(const candidate of requestedPort?[requestedPort]:[3118,3129])if(await isFree(candidate)){port=candidate;break;}
assert.ok(port,'Dedicated QR fixture ports are occupied; never stop another server');
const origin='http://127.0.0.1:'+port,server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev',fixture,'--webpack','--hostname','127.0.0.1','--port',String(port)],{cwd:root,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'});
let serverLog='',browser,malformedBrowser,activeScenario=null;
for(const stream of [server.stdout,server.stderr])stream.on('data',data=>{serverLog=(serverLog+data.toString()).slice(-16000);});
const checks=[],errors=[],scenarioResults=[];
const waitText=(page,text)=>page.waitForFunction(value=>document.body.innerText.includes(value),{timeout:15000},text);
async function button(page,text){
 await page.waitForFunction(value=>[...document.querySelectorAll('button')].some(button=>button.textContent.trim()===value&&!button.disabled),{timeout:15000},text);
 const handle=await page.evaluateHandle(value=>[...document.querySelectorAll('button')].find(button=>button.textContent.trim()===value),text);
 try{assert.ok(handle.asElement());await handle.asElement().click();}finally{await handle.dispose();}
}
async function launch(camera){return puppeteer.launch({headless:true,...(process.platform==='win32'?{channel:'chrome'}:{}),args:['--no-sandbox','--disable-setuid-sandbox','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--use-file-for-fake-video-capture='+camera]});}
async function scenario(width,mode='fallback-real'){
 activeScenario={width,mode};
 if(mode==='malformed'&&!malformedBrowser)malformedBrowser=await launch(malformedCamera);
 const selected=mode==='malformed'?malformedBrowser:browser,context=await selected.createBrowserContext(),page=await context.newPage();
 await page.setViewport({width,height:900});
 const requests=[],apiRequests=[];
 page.on('console',message=>{if(message.type()==='error'&&!message.text().startsWith('Failed to load resource'))errors.push({width,mode,error:message.text()});});
 page.on('pageerror',error=>errors.push({width,mode,error:error.message}));
 await page.setRequestInterception(true);
 page.on('request',request=>{
  const url=new URL(request.url());requests.push({method:request.method(),url:request.url(),resourceType:request.resourceType()});
  if(url.origin!==origin){errors.push({width,mode,error:'Unexpected external request '+url.origin});return request.abort();}
  if(url.pathname.startsWith('/api/')||request.method()!=='GET'){apiRequests.push({method:request.method(),path:url.pathname});return request.respond({status:418,contentType:'application/json',body:'{"code":"NO_OPERATION_ALLOWED_IN_QR_FIXTURE"}'});}
  return request.continue();
 });
 await page.evaluateOnNewDocument(({mode,validRaw})=>{
  const test=window.__qrTest={mode,reads:[],busyTrace:[],streams:[],permissionCalls:0,constraints:[],permissionPending:[],detectPending:[],nativeCalls:{formats:0,construct:0,detect:0},timeoutDelays:[],timeoutCallbacks:[],storageWrites:[],urls:new Set()};
  const originalPermission=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia=async constraints=>{
   test.permissionCalls++;test.constraints.push(constraints);
   if(mode==='permission-denied')throw new DOMException('Synthetic camera permission denial','NotAllowedError');
   const stream=await originalPermission(constraints);test.streams.push(stream);
   if(['permission-cancel-restart','permission-disabled','permission-context','permission-unmount','permission-timeout'].includes(mode)&&test.permissionCalls===1)return new Promise(resolve=>test.permissionPending.push(()=>resolve(stream)));
   return stream;
  };
  const nativeModes=['native-unsupported','native-formats-throw','native-constructor-throw','native-detect-throw','native-positive-controlled','detector-cancel-restart','timeout','permission-cancel-restart','permission-disabled','permission-context','permission-unmount','permission-timeout','disabled','context-prop','sector-prop','context-remount','hidden','pagehide','unmount','cancel'];
  if(nativeModes.includes(mode)){
   let instances=0;
   window.BarcodeDetector=class{
    static async getSupportedFormats(){test.nativeCalls.formats++;if(mode==='native-formats-throw')throw new Error('Synthetic formats failure');return mode==='native-unsupported'?['code_128']:['qr_code'];}
    constructor(){test.nativeCalls.construct++;this.instance=++instances;if(mode==='native-constructor-throw')throw new Error('Synthetic constructor failure');}
    async detect(){test.nativeCalls.detect++;if(mode==='native-detect-throw')throw new Error('Synthetic detect failure');if(mode==='native-positive-controlled')return [{rawValue:validRaw}];if(mode==='detector-cancel-restart'&&this.instance===1||mode==='timeout')return new Promise(resolve=>test.detectPending.push(raw=>resolve(raw?[{rawValue:raw}]:[])));return [];}
   };
  }else Object.defineProperty(window,'BarcodeDetector',{value:undefined,configurable:true,writable:true});
  const nativeSetTimeout=window.setTimeout.bind(window);
  window.setTimeout=(callback,delay,...args)=>{if(delay===30000){test.timeoutDelays.push(delay);if(mode==='timeout'||mode==='permission-timeout'){test.timeoutCallbacks.push(()=>callback(...args));return nativeSetTimeout(()=>{},delay);}}return nativeSetTimeout(callback,delay,...args);};
  const originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){test.storageWrites.push({key:String(key),value:String(value)});return originalSetItem.call(this,key,value);};
  const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);URL.createObjectURL=value=>{const url=create(value);test.urls.add(url);return url;};URL.revokeObjectURL=url=>{test.urls.delete(url);return revoke(url);};
  Object.defineProperty(document,'visibilityState',{get:()=>test.hidden?'hidden':'visible',configurable:true});
  Object.defineProperty(document,'hidden',{get:()=>Boolean(test.hidden),configurable:true});
 },{mode,validRaw});
 try{
  await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await page.bringToFront();await waitText(page,'Fixture lista');
  assert.equal(await page.evaluate(()=>window.__qrTest.permissionCalls),0,'No automatic camera permission');
  assert.equal(await page.evaluate(()=>window.__qrTest.reads.length),0);
  const start='Leer QR con cámara',stop='Detener lectura QR';
  await button(page,start);
  if(mode.startsWith('permission-')&&mode!=='permission-denied')await page.waitForFunction(()=>window.__qrTest.permissionPending.length===1);
  if(mode==='permission-denied'){
   await waitText(page,'No se otorgó permiso de cámara');await waitText(page,'Disponible');
   assert.equal(await page.evaluate(()=>window.__qrTest.reads.length),0);checks.push('controlled-permission-denial-keeps-manual-QR-path-without-read-or-write');
  }else if(mode==='permission-cancel-restart'){
   await button(page,stop);await waitText(page,'Disponible');
   await button(page,start);await page.waitForFunction(()=>window.__qrTest.streams.length===2&&document.querySelector('video')?.readyState>=2);
   await page.evaluate(()=>window.__qrTest.permissionPending.shift()());
   await page.waitForFunction(()=>window.__qrTest.streams[0].getTracks().every(track=>track.readyState==='ended'));
   assert.equal(await page.evaluate(()=>window.__qrTest.streams[1].getTracks().some(track=>track.readyState==='live')),true);
   assert.equal(await page.$eval('[data-testid="busy"]',node=>node.textContent),'Ocupado');assert.equal(await page.evaluate(()=>window.__qrTest.reads.length),0);
   checks.push('cancel-pending-permission-unlocks-immediately-restart-survives-old-real-stream-resolution');await button(page,stop);
  }else if(mode.startsWith('permission-')&&mode!=='permission-timeout'){
   const action=mode==='permission-disabled'?'disable':mode==='permission-context'?'context-prop':'unmount';
   await page.click('[data-testid="'+action+'"]');await waitText(page,'Disponible');await page.evaluate(()=>window.__qrTest.permissionPending.shift()());
   await page.waitForFunction(()=>window.__qrTest.streams.every(stream=>stream.getTracks().every(track=>track.readyState==='ended')));assert.equal(await page.evaluate(()=>window.__qrTest.reads.length),0);
   checks.push(mode+'-late-permission-result-stops-all-tracks-without-restoring-context');
  }else if(mode==='detector-cancel-restart'){
   await page.waitForFunction(()=>window.__qrTest.detectPending.length===1);await button(page,stop);await waitText(page,'Disponible');
   await button(page,start);await page.waitForFunction(()=>window.__qrTest.streams.length===2&&document.querySelector('video')?.readyState>=2);
   await page.evaluate(raw=>window.__qrTest.detectPending.shift()(raw),validRaw);
   await page.waitForFunction(()=>window.__qrTest.nativeCalls.construct===2&&window.__qrTest.streams[0].getTracks().every(track=>track.readyState==='ended'));
   assert.equal(await page.evaluate(()=>window.__qrTest.reads.length),0);assert.equal(await page.$eval('[data-testid="busy"]',node=>node.textContent),'Ocupado');
   assert.equal(await page.evaluate(()=>window.__qrTest.streams[1].getTracks().some(track=>track.readyState==='live')),true);
   checks.push('cancel-pending-detector-releases-reader-and-restart-ignores-old-valid-result');await button(page,stop);
  }else if(['timeout','permission-timeout'].includes(mode)){
   if(mode==='timeout')await page.waitForFunction(()=>window.__qrTest.detectPending.length===1);
   await page.waitForFunction(()=>window.__qrTest.timeoutCallbacks.length===1);await page.evaluate(()=>window.__qrTest.timeoutCallbacks.shift()());await waitText(page,'No se leyó un QR en 30 segundos');await waitText(page,'Disponible');
   if(mode==='permission-timeout')await page.evaluate(()=>window.__qrTest.permissionPending.shift()());
   else await page.evaluate(raw=>window.__qrTest.detectPending.shift()(raw),validRaw);
   await page.waitForFunction(()=>window.__qrTest.streams.every(stream=>stream.getTracks().every(track=>track.readyState==='ended')));
   assert.equal(await page.evaluate(()=>window.__qrTest.reads.length),0);assert.equal(await page.evaluate(()=>window.__qrTest.timeoutDelays.includes(30000)),true);
   checks.push(mode+'-scheduled-30s-callback-stops-and-rejects-late-result-controlled-clock');
  }else if(['disabled','context-prop','sector-prop','context-remount','hidden','pagehide','unmount','cancel'].includes(mode)){
   await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2);assert.equal(await page.$eval('[data-testid="busy"]',node=>node.textContent),'Ocupado');
   if(mode==='hidden')await page.evaluate(()=>{window.__qrTest.hidden=true;document.dispatchEvent(new Event('visibilitychange'));});
   else if(mode==='pagehide')await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
   else if(mode==='cancel')await button(page,stop);
   else await page.click('[data-testid="'+(mode==='disabled'?'disable':mode)+'"]');
   await waitText(page,'Disponible');await page.waitForFunction(()=>window.__qrTest.streams.every(stream=>stream.getTracks().every(track=>track.readyState==='ended')));
   assert.equal(await page.evaluate(()=>window.__qrTest.reads.length),0);checks.push(mode+'-active-synthetic-camera-stops-without-read');
  }else if(['foreign-project','wrong-sector','malformed'].includes(mode)){
   await page.waitForFunction(()=>/QR.*(corresponde|válido)/i.test(document.body.innerText),{timeout:25000});
   assert.equal(await page.evaluate(()=>window.__qrTest.reads.length),0);assert.equal(await page.evaluate(()=>window.BarcodeDetector===undefined),true);
   checks.push(mode+'-actual-jsQR-decoded-image-never-adopted-for-invalid-context-or-payload');
   if(await page.$$eval('button',buttons=>buttons.some(button=>button.textContent.trim()==='Detener lectura QR'&&!button.disabled)))await button(page,stop);
  }else{
   // Await a real frame before allowing the successful decode to end the stream.
   await page.waitForFunction(()=>window.__qrTest.streams.length===1);
   await page.waitForFunction(()=>window.__qrTest.reads.length===1,{timeout:25000});
   assert.equal(await page.evaluate(()=>window.__qrTest.reads[0]),validRaw);
   assert.equal(await page.$eval('[data-testid="busy"]',node=>node.textContent),'Disponible');
   const native=await page.evaluate(()=>window.__qrTest.nativeCalls);
   if(mode==='native-positive-controlled'){assert.ok(native.detect>0);checks.push('synthetic-controlled-native-positive-validates-current-project-and-sector');}
   else{if(mode==='fallback-real')assert.equal(await page.evaluate(()=>window.BarcodeDetector===undefined),true);if(mode==='native-unsupported'){assert.ok(native.formats>0);assert.equal(native.construct,0);}if(mode==='native-formats-throw')assert.ok(native.formats>0);if(mode==='native-constructor-throw')assert.ok(native.construct>0);if(mode==='native-detect-throw')assert.ok(native.detect>0);checks.push(mode+'-real-jsQR-decodes-generated-640x480-camera-'+width);}
   checks.push(mode+'-valid-read-is-single-local-callback-with-no-automatic-save-'+width);
  }
  // Each scenario owns its stream. Closing the component must finish all of them.
  const shown=await page.$('[data-testid="unmount"]');if(shown)await shown.click();
  await waitText(page,'Disponible');await page.waitForFunction(()=>window.__qrTest.streams.every(stream=>stream.getTracks().every(track=>track.readyState==='ended')));
  const telemetry=await page.evaluate(()=>({reads:window.__qrTest.reads.length,busyTrace:window.__qrTest.busyTrace,permissionCalls:window.__qrTest.permissionCalls,constraints:window.__qrTest.constraints,nativeCalls:window.__qrTest.nativeCalls,timeoutDelays:window.__qrTest.timeoutDelays,allTracksEnded:window.__qrTest.streams.every(stream=>stream.getTracks().every(track=>track.readyState==='ended')),trackStates:window.__qrTest.streams.flatMap(stream=>stream.getTracks().map(track=>({kind:track.kind,readyState:track.readyState,settings:{width:track.getSettings().width,height:track.getSettings().height}}))),storageWrites:window.__qrTest.storageWrites,storage:{local:{...localStorage},session:{...sessionStorage}},objectUrls:window.__qrTest.urls.size,currentUrl:location.href,overflow:document.documentElement.scrollWidth>innerWidth}));
  assert.equal(apiRequests.length,0,'No POST or business/API request');assert.equal(telemetry.objectUrls,0);
  assert.equal(telemetry.allTracksEnded,true);assert.equal(telemetry.overflow,false);
  assert.equal(JSON.stringify(telemetry.storage).includes(token),false);assert.equal(JSON.stringify(telemetry.storage).includes(projectId),false);assert.equal(JSON.stringify(telemetry.storage).includes(sectorId),false);assert.equal(telemetry.currentUrl.includes(token),false);assert.equal(telemetry.storageWrites.length,0,'QR component never persists metadata');
  for(const constraints of telemetry.constraints){assert.equal(constraints.audio,false);assert.ok(constraints.video,'Video-only explicit camera request');}
  checks.push(mode+'-all-tracks-ended-zero-API-requests-and-zero-QR-storage-'+width);
  scenarioResults.push({width,mode,...telemetry,requests:requests.filter(item=>!item.url.includes('/_next/')).map(item=>({method:item.method,path:new URL(item.url).pathname})),jsQrChunkRequests:requests.filter(item=>/jsqr/i.test(item.url)).length,apiRequests,cameraSource:mode==='malformed'?'malformed-qr':'valid-context-qr',nativePositiveSynthetic:mode==='native-positive-controlled'});
 }finally{await context.close();}
}
async function preview(width){
 activeScenario={width,mode:'viewport-preview'};
 // An empty controlled detector keeps the actual generated camera visible for layout checks.
 const context=await browser.createBrowserContext(),page=await context.newPage();await page.setViewport({width,height:900});
 const requests=[];page.on('pageerror',error=>errors.push({width,mode:'viewport-preview',error:error.message}));
 await page.setRequestInterception(true);page.on('request',request=>{const url=new URL(request.url());if(url.origin!==origin||url.pathname.startsWith('/api/')||request.method()!=='GET'){requests.push({method:request.method(),url:request.url()});return request.abort();}return request.continue();});
 await page.evaluateOnNewDocument(()=>{window.__qrTest={mode:'viewport-preview',busyTrace:[],reads:[],streams:[],calls:0};const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async constraints=>{window.__qrTest.calls++;const stream=await original(constraints);window.__qrTest.streams.push(stream);return stream;};window.BarcodeDetector=class{static async getSupportedFormats(){return ['qr_code'];}async detect(){return [];}};});
 try{
  await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await waitText(page,'Fixture lista');assert.equal(await page.evaluate(()=>window.__qrTest.calls),0);
  await button(page,'Leer QR con cámara');await page.waitForFunction(()=>{const video=document.querySelector('video'),box=video?.getBoundingClientRect();return video?.readyState>=2&&box.width>0&&box.height>0;});
  const geometry=await page.$eval('video',video=>{const box=video.getBoundingClientRect(),style=getComputedStyle(video);return {width:box.width,height:box.height,intrinsicWidth:video.videoWidth,intrinsicHeight:video.videoHeight,objectFit:style.objectFit,scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth};});
  assert.equal(geometry.intrinsicWidth,640);assert.equal(geometry.intrinsicHeight,480);assert.ok(geometry.width>0&&geometry.height>0);assert.ok(geometry.scrollWidth<=width);assert.ok(geometry.width<=width);assert.ok(Math.abs(geometry.width/geometry.height-4/3)<.03||geometry.objectFit==='contain','Preview preserves frame aspect or contains the full frame');
  await page.screenshot({path:path.join(output,'camera-preview-'+width+'.png'),fullPage:true});checks.push('generated-camera-preview-no-overflow-preserved-aspect-'+width);
  await button(page,'Detener lectura QR');await waitText(page,'Disponible');await page.waitForFunction(()=>window.__qrTest.streams.every(stream=>stream.getTracks().every(track=>track.readyState==='ended')));assert.equal(requests.length,0);
  checks.push('preview-explicit-cancel-stops-all-synthetic-tracks-'+width);scenarioResults.push({width,mode:'viewport-preview',geometry,allTracksEnded:true,physicalCameraAccepted:false});
 }finally{await context.close();}
}
const edgeModes=['native-unsupported','native-formats-throw','native-constructor-throw','native-detect-throw','native-positive-controlled','foreign-project','wrong-sector','malformed','permission-denied','permission-cancel-restart','permission-disabled','permission-context','permission-unmount','permission-timeout','detector-cancel-restart','timeout','disabled','context-prop','sector-prop','context-remount','hidden','pagehide','unmount','cancel'];
try{
 let ready=false;for(let count=0;count<120;count++){if(server.exitCode!==null)throw new Error('Fixture server exited: '+serverLog);try{if((await fetch(origin)).ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,500));}assert.ok(ready,'Next fixture must be ready');
 browser=await launch(validCamera);
 if(focus==='preview')for(const width of [320,390,768,1280])await preview(width);
 else if(focus==='fallback')for(const width of [320,390,768,1280])await scenario(width);
 else if(focus){assert.ok(edgeModes.includes(focus),'Unknown focused QR scenario');await scenario(390,focus);}
 else{for(const width of [320,390,768,1280]){await scenario(width);await preview(width);}for(const mode of edgeModes)await scenario(390,mode);}
 assert.deepEqual(errors,[]);
 for(const item of sourceManifest)assert.equal(sha(readFileSync(path.join(root,item.path))),item.sha256,'Source changed during harness; rerun after freeze');
 const actualFallbackDecodedWithoutResultStub=scenarioResults.some(item=>item.reads===1&&!item.nativePositiveSynthetic);
 if(!focus)for(const width of [320,390,768,1280])assert.ok(scenarioResults.some(item=>item.width===width&&item.mode==='fallback-real'&&item.reads===1));
 const report={status:'PASS',checkedAt:new Date().toISOString(),fullSuite:!focus,focusedScenario:focus,widths:!focus||['fallback','preview'].includes(focus)?[320,390,768,1280]:[390],environment:'real Next component with Chromium generated Y4M camera and controlled permission/native failure interleavings',checks,errors,sourceManifest,harnessSha256,decoderVersion,syntheticScanSources,scenarioResults,actualFallbackDecodedWithoutResultStub,nativePositiveEnvironment:scenarioResults.some(item=>item.nativePositiveSynthetic)?'controlled BarcodeDetector fixture, synthetic result; no native-device acceptance':'not exercised in this focused report',timeoutEnvironment:scenarioResults.some(item=>['timeout','permission-timeout'].includes(item.mode))?'actual scheduled 30000ms component callback manually released only in timeout stress scenarios':'not exercised in this focused report',contextEnvironment:'ordinary fixture prop changes plus explicit keyed remount; no product hooks added',productionDataWritten:false,providerCalls:0,metaMessagesSent:0,businessApiRequests:0,physicalCameraAccepted:false,cameraQrAccepted:false,physicalPhoneAccepted:false,humanAccepted:false};
 writeFileSync(path.join(output,focus?'browser-'+focus+'.json':'browser.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,checks:checks.length,errors:errors.length,fullSuite:report.fullSuite,focusedScenario:focus,sourceManifest,harnessSha256,output}));
}catch(error){
 writeFileSync(path.join(output,'browser-failure-'+(focus||'full')+'.json'),JSON.stringify({status:'FAIL',checkedAt:new Date().toISOString(),message:error.message,stack:error.stack,activeScenario,completedChecks:checks,errors,sourceManifest,harnessSha256,serverLog},null,2));throw error;
}finally{
 await malformedBrowser?.close();await browser?.close();try{if(process.platform!=='win32')process.kill(-server.pid,'SIGTERM');else server.kill();}catch{}
 await new Promise(resolve=>setTimeout(resolve,500));const resolved=path.resolve(fixture);assert.ok(resolved.startsWith(path.resolve(output)+path.sep)&&path.basename(resolved).startsWith('fixture-'),'Remove only this isolated fixture');rmSync(resolved,{recursive:true,force:true});
}
