import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import path from 'node:path';
import puppeteer from 'puppeteer';

assert.ok(!process.env.VERCEL&&!process.env.VERCEL_ENV,'Local built evidence only');
const root=process.cwd(),output=path.join(root,'.vercel/local-font-evidence');
mkdirSync(output,{recursive:true});
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const sources=JSON.parse(readFileSync(path.join(root,'src/app/fonts/sources.json'),'utf8'));
const fontModule=createRequire(import.meta.url)('next/dist/compiled/@next/font/dist/fontkit').default;
const fontFromBuffer=fontModule.default||fontModule;
const spanish='áéíóúÁÉÍÓÚüÜñÑ¿¡€',checks=[],errors=[],externalRequests=[],mutations=[];
const assets=sources.assets.map(asset=>{
  const bytes=readFileSync(path.join(root,'src/app/fonts',asset.path));
  assert.equal(digest(bytes),asset.sha256,asset.family+' binary checksum');
  assert.equal(bytes.length,asset.bytes,asset.family+' binary length');
  const license=readFileSync(path.join(root,'src/app/fonts',asset.license.path));
  assert.equal(digest(license),asset.license.sha256,asset.family+' license checksum');
  assert.match(license.toString(),/SIL OPEN FONT LICENSE Version 1\.1/);
  const font=fontFromBuffer(bytes),missing=[...spanish].filter(char=>font.glyphForCodePoint(char.codePointAt(0)).id===0);
  assert.deepEqual(missing,[],asset.family+' Spanish glyphs');
  assert.ok(asset.weights.every(weight=>weight>=font.variationAxes.wght.min&&weight<=font.variationAxes.wght.max));
  return {...asset,binaryFamily:font.familyName,version:font.version,spanishGlyphs:spanish,missingGlyphs:missing};
});
const html=readFileSync(path.join(root,'.next/server/app/index.html'),'utf8');
assert.doesNotMatch(html,/fonts\.(?:googleapis|gstatic)\.com/,'Compiled page still requests Google fonts');
const stylesheetPaths=[...new Set([...html.matchAll(/<link[^>]+href="(\/_next\/[^"?]+\.css)/g)].map(match=>match[1]))];
const stylesheets=stylesheetPaths.map(asset=>({asset,bytes:readFileSync(path.join(root,'.next',asset.replace('/_next/','')))}));
const faces=[...stylesheets.map(item=>item.bytes.toString()).join('\n').matchAll(/@font-face\s*\{([^}]+)\}/g)].map(match=>match[1]);
const compiledAssets=assets.map(asset=>{
  const familyFaces=faces.filter(face=>new RegExp('font-family:[\\s\'\"]*'+asset.family+'[\\s\'\"]*;').test(face));
  assert.equal(familyFaces.length,asset.weights.length,asset.family+' exact discrete faces');
  assert.deepEqual(familyFaces.map(face=>Number(face.match(/font-weight:\s*(\d+)/)[1])).sort((a,b)=>a-b),asset.weights);
  const urls=[...new Set(familyFaces.map(face=>face.match(/src:\s*url\(([^)]+)\)/)[1].replace(/["']/g,'')))];
  assert.equal(urls.length,1,asset.family+' emitted binary deduplication');
  const url=urls[0];assert.ok(url.startsWith('/_next/static/media/')&&url.endsWith('.woff2'),url);
  assert.equal(digest(readFileSync(path.join(root,'.next',url.replace('/_next/','')))),asset.sha256,asset.family+' emitted bytes');
  assert.ok(familyFaces.every(face=>/font-display:\s*swap/.test(face)),asset.family+' display strategy');
  return {...asset,emittedPath:url};
});
const nextFontManifest=JSON.parse(readFileSync(path.join(root,'.next/server/next-font-manifest.json'),'utf8'));
const windowsManifestMissing=process.platform==='win32'&&Object.keys(nextFontManifest.app).length===0;
const expectedPreloads=compiledAssets.filter(asset=>asset.family!=='Outfit').map(asset=>asset.emittedPath).sort();
// Next 16.3.6's webpack manifest plugin matches forward-slash loader paths.
// A Windows build can emit .p files without collecting manifest entries. Keep
// that limitation explicit; a non-Windows build must emit both real preloads.
if(windowsManifestMissing){
  assert.ok(expectedPreloads.every(url=>url.endsWith('.p.woff2')),'Canonical fonts not configured for preload');
  assert.ok(!compiledAssets.find(asset=>asset.family==='Outfit').emittedPath.endsWith('.p.woff2'));
}else assert.ok(Object.keys(nextFontManifest.app).length>0,'Font preload manifest is empty');
checks.push({compiledFamilies:compiledAssets.map(asset=>({family:asset.family,weights:asset.weights,bytes:asset.bytes,sha256:asset.sha256,emittedPath:asset.emittedPath})),spanishGlyphs:spanish});
const port=3233,origin='http://127.0.0.1:'+port;
const server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',String(port)],{
  cwd:root,env:{...process.env,NODE_ENV:'production',DATABASE_URL:'postgresql://font_fixture:font_fixture@127.0.0.1:1/font_fixture',NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe'],
});
let startup='',browser,page;
for(const stream of [server.stdout,server.stderr])stream.on('data',chunk=>{startup=(startup+chunk).slice(-16000);});
async function platformFonts(session,selector){
  const {root:document}=await session.send('DOM.getDocument');
  const {nodeId}=await session.send('DOM.querySelector',{nodeId:document.nodeId,selector});
  assert.ok(nodeId,'Font sample missing '+selector);
  return (await session.send('CSS.getPlatformFontsForNode',{nodeId})).fonts;
}
async function sampleContrast(page,selector){return page.$eval(selector,element=>{
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const context=canvas.getContext('2d');
  const color=value=>{context.clearRect(0,0,1,1);context.fillStyle=value;context.fillRect(0,0,1,1);return [...context.getImageData(0,0,1,1).data].map((value,index)=>index===3?value/255:value);};
  const over=(fg,bg)=>{const alpha=fg[3]+bg[3]*(1-fg[3]);return [0,1,2].map(index=>alpha?(fg[index]*fg[3]+bg[index]*bg[3]*(1-fg[3]))/alpha:0).concat(alpha);};
  const ancestors=[];for(let current=element;current;current=current.parentElement)ancestors.unshift(current);
  let background=[255,255,255,1],opacity=1;for(const current of ancestors){const style=getComputedStyle(current);background=over(color(style.backgroundColor),background);opacity*=Number(style.opacity);}
  const style=getComputedStyle(element),foreground=color(style.color);foreground[3]*=opacity;const rendered=over(foreground,background);
  const luminance=rgb=>rgb.slice(0,3).map(value=>value/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);
  const a=luminance(rendered),b=luminance(background),large=parseFloat(style.fontSize)>=24||(parseFloat(style.fontSize)>=18.66&&Number(style.fontWeight)>=700);
  return {text:element.textContent.trim(),font:style.fontFamily,fontSize:parseFloat(style.fontSize),weight:style.fontWeight,foreground:style.color,background:background.slice(0,3),contrast:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),minimum:large?3:4.5};
});}
try{
  let ready=false;for(let attempt=0;attempt<90;attempt++){
    if(server.exitCode!==null)throw Error('Built server exited: '+startup);
    try{if((await fetch(origin+'/api/health')).status===200){ready=true;break;}}catch{}
    await new Promise(resolve=>setTimeout(resolve,500));
  }assert.ok(ready,'Built Next server did not become ready');
  browser=await puppeteer.launch({headless:true,...(process.platform==='win32'?{channel:'chrome'}:{}),args:['--no-sandbox','--disable-setuid-sandbox']});
  page=await browser.newPage();await page.setBypassServiceWorker(true);await page.setCacheEnabled(false);
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  page.on('pageerror',error=>errors.push(error.message));await page.setRequestInterception(true);
  page.on('request',request=>{
    const url=new URL(request.url());
    if(!['GET','HEAD','OPTIONS'].includes(request.method())){mutations.push({method:request.method(),url:request.url()});void request.abort();return;}
    if(url.origin!==origin&&!['data:','blob:'].includes(url.protocol)){externalRequests.push({url:request.url(),type:request.resourceType()});void request.abort();return;}
    void request.continue();
  });
  const session=await page.createCDPSession();await session.send('DOM.enable');await session.send('CSS.enable');
  for(const route of ['/','/demo'])for(const width of [320,390,768,1280]){
    await page.setViewport({width,height:1050});const response=await page.goto(origin+route,{waitUntil:'networkidle0'});await page.evaluate(()=>document.fonts.ready);
    const geometry=await page.$$eval('[data-brand="obrasaas-v3"]',nodes=>nodes.map(node=>{
      const rect=node.getBoundingClientRect(),ancestors=[];for(let current=node;current;current=current.parentElement)ancestors.push(current);
      const visible=rect.width>0&&rect.height>0&&ancestors.every(current=>{const style=getComputedStyle(current);return style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)>0;});
      return {text:node.textContent.replace(/\s/g,''),visible,width:rect.width,height:rect.height,font:getComputedStyle(node.querySelector('strong')).fontFamily,fontSize:parseFloat(getComputedStyle(node.querySelector('strong')).fontSize),markHeight:node.querySelector('svg').getBoundingClientRect().height};
    }));
    assert.ok(geometry.length>=(route==='/'?3:1),route+' canonical brand count');
    assert.ok(geometry.every(item=>item.visible&&item.text==='ObraSaaS'&&item.font.includes('Manrope')&&item.fontSize>=18&&item.markHeight>=28),route+' '+width+' visible brand');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,route+' '+width+' overflow');
    const fonts=await platformFonts(session,'[data-brand="obrasaas-v3"] strong');assert.ok(fonts.some(font=>font.isCustomFont&&font.familyName.startsWith('Manrope')&&font.glyphCount>0),'Brand rendered with local custom Manrope');
    const domPreloads=await page.$$eval('link[rel=preload][as=font]',links=>links.map(link=>new URL(link.href).pathname));
    const headerPreloads=(response.headers().link||'').split(',').filter(entry=>/;\s*as="?font"?(?:;|$)/.test(entry)).map(entry=>new URL(entry.match(/<([^>]+)>/)[1],origin).pathname);
    const preloads=[...new Set([...domPreloads,...headerPreloads])].sort();
    assert.deepEqual(preloads,windowsManifestMissing?[]:expectedPreloads,'Actual canonical font preloads');
    const contrasts=[];if(route==='/')for(const selector of ['#platform-title','#recorrido h3','#recorrido h3+p','#recorrido a[href="/sign-up"]']){
      const sample=await sampleContrast(page,selector);assert.ok(sample.contrast>=sample.minimum,selector+' contrast '+sample.contrast);contrasts.push(sample);
    }
    await page.screenshot({path:path.join(output,(route==='/'?'home':'demo')+'-'+width+'.png'),fullPage:false});
    checks.push({route,width,overflow:false,geometry,actualBrandFonts:fonts,preloads,contrast:contrasts});
  }
  await page.goto(origin,{waitUntil:'networkidle0'});
  await page.evaluate(text=>{const probe=document.createElement('div');probe.id='spanish-font-probes';probe.style.cssText='position:fixed;inset:100px 20px auto;z-index:100;background:white;color:black;padding:16px';for(const family of ['Inter','Manrope','Outfit']){const node=document.createElement('p');node.id='font-probe-'+family;node.textContent=text;node.style.cssText='font-family:'+family+',monospace;font-size:24px;font-weight:'+(family==='Manrope'?650:400);probe.append(node);}document.body.append(probe);},spanish);
  await page.evaluate(()=>document.fonts.ready);
  for(const asset of compiledAssets){
    const fonts=await platformFonts(session,'#font-probe-'+asset.family);
    assert.ok(fonts.length===1&&fonts[0].isCustomFont&&fonts[0].familyName===asset.binaryFamily&&fonts[0].glyphCount>0,asset.family+' Spanish text fell back to another font');
    const response=await fetch(origin+asset.emittedPath);assert.equal(response.status,200);assert.match(response.headers.get('content-type')||'',/font\/woff2/);assert.equal(digest(Buffer.from(await response.arrayBuffer())),asset.sha256);
    checks.push({family:asset.family,actualSpanishFonts:fonts,servedStatus:200,servedSha256:asset.sha256});
  }
  await page.evaluate(()=>document.querySelector('#spanish-font-probes').remove());
  assert.deepEqual(externalRequests.filter(request=>request.type==='font'||/fonts\.(googleapis|gstatic)\.com/.test(request.url)),[],'External font request attempted');
  assert.deepEqual(mutations,[]);assert.deepEqual(errors,[]);
  const tracked=['src/app/layout.js','src/app/globals.css','scripts/verify-local-font-delivery.mjs','scripts/verify-professional-landing-ui.mjs','src/app/fonts/sources.json','src/app/fonts/README.md',...assets.flatMap(asset=>['src/app/fonts/'+asset.path,'src/app/fonts/'+asset.license.path])];
  const sourceManifest=tracked.map(file=>({file,sha256:digest(readFileSync(path.join(root,file)))}));
  const preloadEmission=windowsManifestMissing?'not-emitted-by-local-Windows-webpack-manifest':'two-canonical-families-verified';
  const proof={status:'PASS',environment:'actual-full-webpack-build-local-browser-with-external-requests-blocked',buildId:readFileSync(path.join(root,'.next/BUILD_ID'),'utf8').trim(),sourceManifest,stylesheets:stylesheets.map(({asset,bytes})=>({asset,bytes:bytes.length,sha256:digest(bytes)})),compiledAssets,preloadEmission,linuxPreloadAcceptanceRequired:windowsManifestMissing,checks,externalRequests,externalFontRequests:0,mutations,errors,providerWrites:0,realClerkRendered:false,authenticatedWorkspaceTested:false,physicalMobileAccepted:false};
  writeFileSync(path.join(output,'proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify({status:'PASS',checks:checks.length,localFamilies:3,configuredPreloadFamilies:2,preloadEmission,externalFontRequests:0,providerWrites:0,widths:[320,390,768,1280]}));
}catch(error){writeFileSync(path.join(output,'failure.json'),JSON.stringify({message:error.message,stack:error.stack,startup,checks,errors,externalRequests,mutations},null,2));await page?.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});throw error;}
finally{await browser?.close();server.kill('SIGTERM');}
