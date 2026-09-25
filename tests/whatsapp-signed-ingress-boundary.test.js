import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { registerHooks } from 'node:module';
import { after, beforeEach, test } from 'node:test';
const secret='a32-unit-signing-secret-not-provider-credentials';
const original=process.env.META_APP_SECRET;process.env.META_APP_SECRET=secret;
globalThis.__a32Boundary={stores:0,scheduled:[],fail:false};
registerHooks({resolve(specifier,context,next){
 if(specifier==='next/server')return {url:'fixture:a32-after',shortCircuit:true};
 if(specifier==='@/lib/db')return {url:'fixture:a32-store',shortCircuit:true};
 if(specifier==='@/lib/whatsapp/webhook-worker')return {url:'fixture:a32-drain',shortCircuit:true};
 if(specifier.startsWith('@/'))return next(new URL('../src/'+specifier.slice(2)+(specifier.startsWith('@/generated/')?'.ts':'.js'),import.meta.url).href,context);
 return next(specifier,context);
},load(url,context,next){
 if(url==='fixture:a32-after')return {format:'module',shortCircuit:true,source:'export function after(fn){globalThis.__a32Boundary.scheduled.push(fn)}'};
 if(url==='fixture:a32-store')return {format:'module',shortCircuit:true,source:`export async function storeMetaWebhookBatch(){globalThis.__a32Boundary.stores++;if(globalThis.__a32Boundary.fail)throw new Error('PRIVATE_STORAGE_CANARY');return {accepted:1,duplicate:0,unknownConnections:0,projectIds:['unit-project']}}`};
 if(url==='fixture:a32-drain')return {format:'module',shortCircuit:true,source:'export async function drainProjectWebhookEvents(){}'};
 return next(url,context);
}});
const {POST}=await import('../src/app/api/webhooks/whatsapp/route.js');
const {verifyMetaSignature}=await import('../src/lib/whatsapp/meta.js');
const sign=body=>'sha256='+createHmac('sha256',secret).update(body).digest('hex');
const request=(body,signature=sign(body),headers={})=>new Request('http://localhost/api/webhooks/whatsapp',{method:'POST',headers:{'content-type':'application/json','x-hub-signature-256':signature,...headers},body});
const valid=JSON.stringify({object:'whatsapp_business_account',entry:[]});
beforeEach(()=>{globalThis.__a32Boundary={stores:0,scheduled:[],fail:false};process.env.META_APP_SECRET=secret;});
after(()=>{if(original===undefined)delete process.env.META_APP_SECRET;else process.env.META_APP_SECRET=original;delete globalThis.__a32Boundary;});
for(const suffix of ['=extra','=',',sha256=other',' extra'])test('signature rejects trailing data '+JSON.stringify(suffix),()=>{
 assert.equal(verifyMetaSignature(valid,sign(valid)+suffix,secret),false);
});
test('signature rejects non-string headers without throwing',()=>{for(const value of [null,undefined,12,{},[sign(valid)]])assert.equal(verifyMetaSignature(valid,value,secret),false);});
test('signature authenticates bytes, not a parsed or reserialized JSON object',()=>{
 const a=Buffer.from('{"text":"\\u00f1","entry":[]}'),b=Buffer.from(JSON.stringify(JSON.parse(a)));
 assert.equal(verifyMetaSignature(a,sign(a),secret),true);assert.equal(verifyMetaSignature(b,sign(a),secret),false);
 assert.equal(verifyMetaSignature(Buffer.from(valid+' '),sign(valid),secret),false);
});
for(const [body,signature,status] of [[valid,'sha256='+'0'.repeat(64),401],['{',null,400],[Buffer.from([0xff]),null,400]])test('invalid request rejected before storage: '+status+' '+String(body).slice(0,20),async()=>{
 const r=await POST(request(body,signature||sign(body)));assert.equal(r.status,status);assert.equal(globalThis.__a32Boundary.stores,0);assert.equal(globalThis.__a32Boundary.scheduled.length,0);
});
for(const entry of [[null],[{changes:{}}],[{changes:[null]}],[{changes:[{field:'messages',value:{messages:[null]}}]}],[{changes:[{field:'messages',value:{contacts:{}}}]}]])test('malformed signed collections are a bounded client error '+JSON.stringify(entry),async()=>{
 const r=await POST(request(JSON.stringify({object:'whatsapp_business_account',entry})));assert.equal(r.status,400);assert.equal((await r.json()).code,'META_WEBHOOK_BATCH_INVALID');assert.equal(globalThis.__a32Boundary.stores,0);assert.equal(globalThis.__a32Boundary.scheduled.length,0);
});
test('storage failure is retryable and cannot acknowledge or schedule incomplete ingress',async()=>{
 globalThis.__a32Boundary.fail=true;const originalError=console.error,logs=[];console.error=(...values)=>logs.push(values);
 try{const r=await POST(request(valid));assert.equal(r.status,503);const payload=await r.json();assert.equal(payload.code,'META_WEBHOOK_PERSISTENCE_UNAVAILABLE');assert.notEqual(payload.received,true);assert.equal(JSON.stringify([payload,logs]).includes('PRIVATE_STORAGE_CANARY'),false);assert.match(r.headers.get('cache-control'),/no-store/);assert.equal(globalThis.__a32Boundary.scheduled.length,0);}finally{console.error=originalError;}
 globalThis.__a32Boundary.fail=false;const retry=await POST(request(valid));assert.equal(retry.status,200);assert.equal((await retry.json()).received,true);assert.equal(globalThis.__a32Boundary.scheduled.length,1);
});
