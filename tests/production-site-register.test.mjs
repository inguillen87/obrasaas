import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeSiteCommand,siteQuantity,siteTransition,siteOperationId,siteCommandDigest,cleanMetadata} from '../src/lib/site-register-policy.mjs';
import {createSiteRegisterHandlers} from '../src/lib/site-register-http.mjs';
import {createSiteRegister} from '../src/lib/site-register-store.mjs';
const scope='a'.repeat(64),projectId='project-a',op='12345678-1234-4234-8234-123456789012';
const identity={authenticated:true,verification:'clerk-production-jwt',userId:'user_TestA',organizationId:'org_TestA',organizationRole:'org:admin'};
const command=(action,payload)=>({scope,projectId,operationId:op,action,payload});
const person=()=>command('ADD_PERSON',{name:'Persona sintética',phone:'+5491100001111',job:'WORKER'});
const issue=()=>command('REPORT_ISSUE',{title:'Acceso a sector',details:'Detalle real a revisar por el responsable.',sector:'Planta baja',severity:'HIGH'});
const material=()=>command('REQUEST_MATERIAL',{material:'Cemento',quantity:'12.500',unit:'bolsa',sector:'Planta baja',details:'Pedido inicial de la obra.'});
const revision='2026-10-01T10:00:00.123456';
for(const job of ['WORKER','FOREMAN','ARCHITECT','OWNER','SAFETY','SUPPLIER'])test('registers declared function without account authorization '+job,()=>{
 const input=person();input.payload.job=job;const normalized=normalizeSiteCommand(input);assert.equal(normalized.payload.job,job);assert.equal(normalized.payload.tenantRole,undefined);
});
for(const phone of ['5491100001111','+54 9 1100001111','00115555555','+0'+ '1'.repeat(10),'../123456',12345678,null])test('ambiguous phone rejected '+String(phone),()=>{
 const input=person();input.payload.phone=phone;assert.throws(()=>normalizeSiteCommand(input),{code:'SITE_PHONE_INVALID'});
});
for(const extra of [{tenantRole:'ADMIN'},{verified:true},{kycStatus:'VERIFIED'},{accessToken:'never-accept'},{phoneVerified:true}])test('body cannot grant privileges '+JSON.stringify(extra),()=>{
 const input=person();Object.assign(input.payload,extra);assert.throws(()=>normalizeSiteCommand(input),{code:'SITE_INPUT_INVALID'});
});
for(const quantity of ['0','0.000','-1','NaN','Infinity','1e4','1,5','1.0001',5,null])test('invalid material amount '+String(quantity),()=>assert.throws(()=>siteQuantity(quantity),{code:'SITE_QUANTITY_INVALID'}));
test('quantities preserve decimal meaning without floating point rounding',()=>{assert.equal(siteQuantity('00012.500'),'12.5');assert.equal(siteQuantity('0.001'),'0.001');assert.equal(siteQuantity('999999999.999'),'999999999.999');});
test('issue and material requests are different bounded contracts',()=>{assert.equal(normalizeSiteCommand(issue()).payload.severity,'HIGH');assert.equal(normalizeSiteCommand(material()).payload.quantity,'12.5');});
for(const patch of [{title:'<script>'},{details:''},{severity:'URGENT'},{sector:''}])test('invalid issue '+JSON.stringify(patch),()=>{const input=issue();Object.assign(input.payload,patch);assert.throws(()=>normalizeSiteCommand(input));});
test('status changes require an exact revision and a reason',()=>{
 const valid=command('SET_PERSON_ACTIVE',{personId:'worker-a',revision,active:false,reason:'Fin de la participación.'});assert.equal(normalizeSiteCommand(valid).payload.active,false);
 for(const patch of [{revision:'2026-10-01T10:00:00.123'},{active:'false'},{reason:''},{personId:'../other'}])assert.throws(()=>normalizeSiteCommand({...valid,payload:{...valid.payload,...patch}}));
});
for(const state of ['RESOLVED','REJECTED','closed','unknown'])test('closed/unknown report never silently reopens '+state,()=>assert.throws(()=>siteTransition('ISSUE',state,'ACKNOWLEDGED')));
test('request lifecycle can follow up then close with no implicit purchasing authority',()=>{assert.equal(siteTransition('MATERIAL_REQUEST','OPEN','ACKNOWLEDGED'),'ACKNOWLEDGED');assert.equal(siteTransition('MATERIAL_REQUEST','ACKNOWLEDGED','RESOLVED'),'RESOLVED');assert.throws(()=>siteTransition('MATERIAL_REQUEST','ACKNOWLEDGED','ACKNOWLEDGED'));});
test('operation receipt binds actor project command and payload',()=>{
 const input=normalizeSiteCommand(person());assert.notEqual(siteOperationId('actor-a',input),siteOperationId('actor-b',input));
 assert.notEqual(siteCommandDigest(input),siteCommandDigest({...input,payload:{...input.payload,name:'Otra persona'}}));
 assert.notEqual(siteCommandDigest(input),siteCommandDigest({...input,projectId:'another'}));
});
test('invalid metadata fails instead of erasing historical data',()=>{assert.deepEqual(cleanMetadata(null),{});assert.throws(()=>cleanMetadata([]));assert.throws(()=>cleanMetadata('text'));});
function transport(session=identity){
 const calls=[];const method=name=>async(...args)=>{calls.push([name,...args]);return name==='status'?{state:'NOT_OBSERVED',definitive:false}:{scope};};
 const handlers=createSiteRegisterHandlers({verify:async()=>session,store:{read:method('read'),save:method('save'),status:method('status')}});return {calls,handlers};
}
const req=(method='GET',body=null,headers={},query='?'+new URLSearchParams({scope,projectId,section:'PEOPLE'}))=>new Request('https://obrasaas.com/api/identity/site-register'+query,{method,headers:{...(method==='POST'?{origin:'https://obrasaas.com','Content-Type':'application/json'}:{}),...headers},...(body===null?{}:{body:typeof body==='string'?body:JSON.stringify(body)})});
test('anonymous request is rejected before body and storage',async()=>{const t=transport({authenticated:false});assert.equal((await t.handlers.POST(req('POST','{',{},''))).status,401);assert.equal(t.calls.length,0);});
test('personal session cannot claim a company from headers',async()=>{const t=transport({...identity,organizationId:null});assert.equal((await t.handlers.GET(req('GET',null,{'x-clerk-org-id':'org_TestA'}))).status,403);assert.equal(t.calls.length,0);});
for(const origin of ['','null','http://obrasaas.com','https://other.example'])test('cross-origin write blocked '+origin,async()=>{const t=transport();assert.equal((await t.handlers.POST(req('POST',person(),{origin},''))).status,403);assert.equal(t.calls.length,0);});
for(const query of ['?projectId=../p&scope='+scope,'?projectId=p&scope='+scope+'&organizationId=other','?projectId=p&projectId=q&scope='+scope,'?projectId=p&scope='+scope+'&section=PEOPLE&operationId='+op])test('invalid query rejected '+query,async()=>{const t=transport();assert.equal((await t.handlers.GET(req('GET',null,{},query))).status,400);assert.equal(t.calls.length,0);});
test('bounded body does not let bulk imported data reach persistence',async()=>{const t=transport();assert.equal((await t.handlers.POST(req('POST','x'.repeat(32769),{},''))).status,413);assert.equal(t.calls.length,0);});
test('valid GET is private and passes verified context only',async()=>{const t=transport();const response=await t.handlers.GET(req());assert.equal(response.status,200);assert.deepEqual(t.calls[0][1],identity);assert.match(response.headers.get('cache-control'),/private, no-store/);});
test('result recovery uses GET, never repeats writes',async()=>{const t=transport();await t.handlers.GET(req('GET',null,{},'?'+new URLSearchParams({scope,projectId,operationId:op})));assert.equal(t.calls[0][0],'status');assert.equal(t.calls.length,1);});
test('all business methods reuse the existing integration authorization boundary',async()=>{
 let calls=0;const store=createSiteRegister({workspace:{integrationProject:async()=>{calls++;throw Object.assign(new Error('Denied'),{code:'EXPECTED_BOUNDARY'});}}});
 await assert.rejects(store.read(identity,{scope,projectId,section:'PEOPLE'}),{code:'EXPECTED_BOUNDARY'});
 await assert.rejects(store.save(identity,person()),{code:'EXPECTED_BOUNDARY'});
 await assert.rejects(store.status(identity,{scope,projectId,operationId:op}),{code:'EXPECTED_BOUNDARY'});assert.equal(calls,3);
});
test('no message sends, identity approvals or financial side effects in the store',()=>{
 const source=readFileSync(new URL('../src/lib/site-register-store.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/fetch\(|CLERK_SECRET|META_WHATSAPP|INSERT INTO public\."TenantMembership"|UPDATE public\."Task"|UPDATE public\."AttendanceEntry"/);
 assert.match(source,/loginAccessGranted:false/);assert.match(source,/whatsappAccessGranted:false/);assert.match(source,/purchaseAuthorized:false/);
 assert.match(source,/site\.register\.changed/);assert.match(source,/SITE_REVISION_CHANGED/);
});
test('route delegates to session verifier and does not accept client roles',()=>{
 const route=readFileSync(new URL('../src/app/api/identity/site-register/route.js',import.meta.url),'utf8');assert.match(route,/verifyWorkspaceSession/);assert.match(route,/productionWorkspace/);
 const proxy=readFileSync(new URL('../src/proxy.js',import.meta.url),'utf8');assert.match(proxy,/path === '\/api\/identity\/site-register'/);
 const ui=readFileSync(new URL('../src/app/(identity)/cuenta/site-register-panel.js',import.meta.url),'utf8');assert.doesNotMatch(ui,/localStorage|sessionStorage|setInterval/);assert.match(ui,/Comprobar guardado/);
});
