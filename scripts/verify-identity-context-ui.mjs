import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';
import {mkdirSync,writeFileSync,readFileSync,existsSync,mkdtempSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {buildIdentityReview} from './lib/identity-review-context.mjs';
import {renderIdentityReview} from './lib/identity-review-page.mjs';
import {SHA} from '../tests/helpers/legacy-mapping-fixture.mjs';
const out=resolve('.vercel/identity-context-evidence');mkdirSync(out,{recursive:true});
const snapshot=JSON.parse(readFileSync(resolve(out,'synthetic-snapshot.json'),'utf8'));
const bundle=buildIdentityReview(snapshot,null,{sourceSha:SHA}),downloads=mkdtempSync(resolve(out,'download-'));
const file=resolve(out,'review-fixture.html');writeFileSync(file,renderIdentityReview(bundle));
const browser=await puppeteer.launch({headless:true,...(process.env.PUPPETEER_CHANNEL?{channel:process.env.PUPPETEER_CHANNEL}:{}),args:['--no-sandbox','--disable-setuid-sandbox']});
const page=await browser.newPage(),errors=[],network=[];
try{
  page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  page.on('request',request=>{if(/^https?:/.test(request.url()))network.push(request.url());});page.on('dialog',dialog=>dialog.accept());
  const cdp=await page.createCDPSession();await cdp.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
  await page.goto(pathToFileURL(file).href,{waitUntil:'load'});
  assert.ok(await page.$eval('h2',element=>element.textContent.includes('PRIVATE_ORG')));
  assert.equal(await page.$$eval('.record select[aria-label^="Destino"]',items=>items.filter(item=>item.value).length),0);
  await page.select('#kind','all');assert.equal(await page.$$eval('.record',items=>items.length),4);
  await page.type('#search','Operario');assert.equal(await page.$$eval('.record',items=>items.length),1);
  await page.$eval('#search',element=>{element.value='';element.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.select('#kind','task');await page.select('select[aria-label="Decisión Tarea 1"]','LINK_EXISTING');
  assert.equal(await page.$eval('select[aria-label="Destino existente Tarea 1"]',element=>element.disabled),true);
  await page.click('#export');assert.ok(await page.$eval('#notice',element=>element.textContent.includes('antes de exportar')));
  const names={organization:'Empresa',project:'Obra',worker:'Trabajador',task:'Tarea'};
  for(const kind of ['organization','project','worker','task']){
    await page.select('#kind',kind);const label=names[kind]+' 1';
    await page.select('select[aria-label="Decisión '+label+'"]','LINK_EXISTING');
    if(kind!=='organization')await page.select('select[aria-label="Empresa u obra de origen '+label+'"]',bundle.proposal.plan.records.find(row=>row.kind===(kind==='project'?'organization':'project')).sourceRef);
    const target=bundle.proposal.plan.targets.find(row=>row.kind===kind&&row.ordinal===1);
    if(kind==='worker')assert.equal(await page.$$eval('select[aria-label="Destino existente Trabajador 1"] option',items=>items.filter(item=>item.value).length),1);
    await page.select('select[aria-label="Destino existente '+label+'"]',target.targetRef);
    await page.click('input[aria-label="Contraste documental '+label+'"]');
  }
  await page.select('#kind','all');
  for(const width of [320,390,768,1280]){
    await page.setViewport({width,height:950});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'overflow '+width);
    if([390,1280].includes(width))await page.screenshot({path:resolve(out,'identity-review-'+width+'.png'),fullPage:true});
  }
  await page.click('#export');const exportPath=resolve(downloads,'identity-decisions.json');
  for(let i=0;i<40&&!existsSync(exportPath);i++)await new Promise(done=>setTimeout(done,100));assert.ok(existsSync(exportPath),'No proposal file exported');
  const exported=readFileSync(exportPath,'utf8'),proposal=JSON.parse(exported),checked=buildIdentityReview(snapshot,proposal,{sourceSha:SHA});
  assert.equal(checked.report.status,'SELECTIONS_COMPLETE_NOT_AUTHORIZED');assert.equal(checked.report.counts.linked,4);
  for(const value of ['PRIVATE_ORG','PRIVATE_PROJECT','PRIVATE_TASK','Operario sintético','PRIVATE_PHONE','PRIVATE_DOCUMENT'])assert.ok(!exported.includes(value),value);
  await page.select('#kind','organization');const alternative=bundle.proposal.plan.targets.find(row=>row.kind==='organization'&&row.ordinal===2);
  await page.select('select[aria-label="Destino existente Empresa 1"]',alternative.targetRef);
  assert.ok(await page.$eval('#summary',element=>element.textContent.startsWith('3 sin revisar')));
  assert.ok(await page.$eval('#notice',element=>element.textContent.includes('dependientes')));
  const wrong=structuredClone(proposal);wrong.contextDigest='0'.repeat(64);const wrongPath=resolve(out,'wrong-observation.json');writeFileSync(wrongPath,JSON.stringify(wrong));
  await (await page.$('#import')).uploadFile(wrongPath);await page.waitForFunction(()=>document.getElementById('notice').textContent.includes('No se cargó'));
  assert.ok(await page.$eval('#summary',element=>element.textContent.startsWith('3 sin revisar')));
  await (await page.$('#import')).uploadFile(exportPath);await page.waitForFunction(()=>document.getElementById('notice').textContent.includes('Propuesta cargada'));
  assert.ok(await page.$eval('#summary',element=>element.textContent.includes('4 propuestas')));
  const renamed=structuredClone(snapshot);renamed.displayLabels.Project[0].label='Changed after export';
  assert.throws(()=>buildIdentityReview(renamed,proposal,{sourceSha:SHA}),{code:'IDENTITY_DISPLAY_OBSERVATION_CHANGED'});
  assert.deepEqual(network,[]);assert.deepEqual(errors,[]);assert.equal(await page.$('form'),null);
  const proof={status:'PASS',environment:'offline-local-context-from-disposable-postgresql',networkRequests:0,pageErrors:0,
    defaultSelections:0,namesVisibleOnlyInPrivateHtml:true,exportContainsNames:false,parentBeforeChild:true,
    targetOptionsFilteredByScope:true,parentChangeResetsDescendants:true,foreignObservationImportRejected:true,
    savedProposalResumed:true,exportRevalidated:true,catalogRenameRejected:true,importAuthorized:false,widths:[320,390,768,1280]};
  writeFileSync(resolve(out,'browser.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}catch(error){writeFileSync(resolve(out,'browser-failure.json'),JSON.stringify({message:error.message,stack:error.stack,errors,network},null,2));
  await page.screenshot({path:resolve(out,'failure.png'),fullPage:true}).catch(()=>{});throw error;
}finally{await browser.close();}
