import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import puppeteer from 'puppeteer';
import {renderLinkRehearsalReport} from './lib/legacy-link-report.mjs';
const folder=resolve('.vercel/link-rehearsal-evidence');mkdirSync(folder,{recursive:true});
const samplePath=resolve(folder,'sample-receipt.json');
const receipt=JSON.parse(readFileSync(samplePath,'utf8'));
assert.equal(receipt.status,'REHEARSAL_REVERTED');assert.equal(receipt.importAuthorized,false);
const html=renderLinkRehearsalReport({...receipt,historicalReplay:true});
const path=resolve(folder,'receipt.html');writeFileSync(path,html,'utf8');
const browser=await puppeteer.launch({headless:true,...(process.platform==='win32'?{channel:'chrome'}:{}),args:['--no-sandbox','--disable-setuid-sandbox']});
try{
  const page=await browser.newPage(),errors=[],network=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request',request=>{if(/^https?:/.test(request.url())){network.push(new URL(request.url()).origin);request.abort();}else request.continue();});
  await page.goto(pathToFileURL(path).href,{waitUntil:'load'});
  assert.equal(await page.$eval('h1',element=>element.textContent),'Ensayo revertido');
  assert.equal(await page.$('form'),null);assert.equal(await page.$('script'),null);
  assert.ok(await page.$eval('.notice',element=>element.textContent.includes('No es una importación productiva.')));
  for(const width of [320,390,768,1280]){
    await page.setViewport({width,height:950});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'overflow '+width);
    if([390,1280].includes(width))await page.screenshot({path:resolve(folder,'receipt-'+width+'.png'),fullPage:true});
  }
  const styled=await page.$eval('main',element=>getComputedStyle(element).maxWidth);assert.equal(styled,'900px');
  assert.deepEqual(network,[]);assert.deepEqual(errors,[]);
  const proof={status:'PASS',source:'persisted-synthetic-rehearsal-receipt',widths:[320,390,768,1280],networkRequests:0,pageErrors:0,importAuthorized:false};
  writeFileSync(resolve(folder,'browser.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}finally{await browser.close();}
