import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';
import { mkdirSync, writeFileSync, readFileSync, existsSync, mkdtempSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { draftLegacyMappingPlan, checkLegacyMappingPlan } from './lib/legacy-mapping-plan.mjs';
import { renderLegacyMappingReview } from './lib/legacy-mapping-review.mjs';
import { mappingSnapshot,SHA } from '../tests/helpers/legacy-mapping-fixture.mjs';
const out=resolve('.vercel/mapping-plan-evidence'),snapshot=mappingSnapshot(),draft=draftLegacyMappingPlan(snapshot,{sourceSha:SHA});
mkdirSync(out,{recursive:true});const downloads=mkdtempSync(resolve(out,'download-'));const file=resolve(out,'review-fixture.html');writeFileSync(file,renderLegacyMappingReview(draft));
const browser=await puppeteer.launch({headless:true,...(process.env.PUPPETEER_CHANNEL?{channel:process.env.PUPPETEER_CHANNEL}:{}),args:['--no-sandbox','--disable-setuid-sandbox']});
const page=await browser.newPage(),errors=[],network=[];
try {
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  page.on('request',request=>{if(/^https?:/.test(request.url()))network.push(request.url());});
  const cdp=await page.createCDPSession();await cdp.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
  await page.goto(pathToFileURL(file).href,{waitUntil:'load'});
  assert.equal(await page.$eval('h1',node=>node.textContent),'Conciliación de empresa y obra');
  assert.equal(await page.$$eval('.record',nodes=>nodes.length),4);
  assert.ok(await page.$eval('#summary',node=>node.textContent.includes('4 pendientes')));
  assert.deepEqual(await page.$$eval('.record select[aria-label^="Destino"]',nodes=>nodes.map(node=>node.value)),['','','','']);
  for(const width of [320,390,768,1280]) {
    await page.setViewport({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'overflow '+width);
    if([390,1280].includes(width))await page.screenshot({path:resolve(out,'review-'+width+'.png'),fullPage:true});
  }
  await page.select('#filter','worker');assert.equal(await page.$$eval('.record',nodes=>nodes.length),1);await page.select('#filter','all');
  const names={organization:'Empresa',project:'Obra',worker:'Trabajador',task:'Tarea'};

  for(const kind of ['organization','project','worker','task']) {
    const label=names[kind]+' 1';await page.select('select[aria-label="Decisión '+label+'"]','LINK_EXISTING');
    const target=draft.targets.find(item=>item.kind===kind&&item.ordinal===1);
    await page.select('select[aria-label="Destino '+label+'"]',target.targetRef);
    if(kind!=='organization')await page.select('select[aria-label="Pertenencia '+label+'"]',draft.records.find(row=>row.kind===(kind==='project'?'organization':'project')).sourceRef);
    await page.select('select[aria-label="Motivo '+label+'"]','DOCUMENTED_MATCH');
  }
  await page.click('#export');
  const download=resolve(downloads,'mapping-decisions.json');
  for(let i=0;i<40&&!existsSync(download);i++)await new Promise(done=>setTimeout(done,100));
  assert.ok(existsSync(download),'Review export did not complete');
  const chosen=JSON.parse(readFileSync(download,'utf8')),checked=checkLegacyMappingPlan(snapshot,chosen,{sourceSha:SHA});
  assert.equal(checked.status,'SELECTIONS_COMPLETE_NOT_AUTHORIZED');assert.equal(checked.importAuthorized,false);
  assert.equal(checked.reviewIdentityVerified,false);assert.equal(checked.counts.linked,4);
  assert.deepEqual(network,[]);assert.deepEqual(errors,[]);
  assert.equal(await page.$('form'),null);
  const proof={status:'PASS',environment:'offline-standalone-html-synthetic-fixture',networkRequests:network.length,
    implicitTargetSelections:0,exportRevalidated:true,reviewGrantsAuthority:false,browserErrors:errors.length,widths:[320,390,768,1280]};
  writeFileSync(resolve(out,'browser.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
} catch(error) {
  writeFileSync(resolve(out,'browser-failure.json'),JSON.stringify({message:error.message,stack:error.stack,errors,network},null,2));
  await page.screenshot({path:resolve(out,'browser-failure.png'),fullPage:true}).catch(()=>{});throw error;
} finally {await browser.close();}
