import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {customerWhatsAppReadiness,createCustomerWhatsAppSetup} from '../src/lib/customer-whatsapp-setup.mjs';
import {createCustomerWhatsAppHandlers} from '../src/lib/customer-whatsapp-http.mjs';
import {normalizeTenantWorkspace,tenantWorkspaceFromMetadata} from '../src/lib/whatsapp/tenant-workspace-policy.js';
import {readProjectWorkspaceProfile,projectWorkspaceMetadata} from '../src/lib/whatsapp/project-workspace-profile.js';
const scope='a'.repeat(64),projectId='project-a',operationId='12345678-1234-4234-8234-123456789012';
const identity={authenticated:true,verification:'clerk-production-jwt',userId:'user_TestA',organizationId:'org_TestA',organizationRole:'org:admin'};
const profile=()=>({assistantName:'Asistente de obra',numberMode:'DEDICATED',initialProjectId:projectId,useCases:['FIELD_REPORTS'],expectedRevision:0,confirmOwnership:true});
const stored=()=>({schemaVersion:2,assistantName:'Asistente de obra',numberMode:'DEDICATED',initialProjectId:projectId,useCases:['FIELD_REPORTS'],revision:1,mode:'REVIEW_REQUIRED',ownership:'CUSTOMER',updatedAt:'2026-10-01T00:00:00.000Z'});

test('stored template approvals or connection flags cannot certify self-service',()=>{
 const result=customerWhatsAppReadiness({configured:true},{enabled:true,storedStatus:'CONNECTED',templatesApproved:true,delivered:true});
 assert.equal(result.operational,false);assert.equal(result.canLaunchMeta,false);assert.equal(result.asksForTokens,false);assert.equal(result.founderAssistanceIsStandardStep,false);
 assert.equal(result.steps.find(step=>step.key==='TEMPLATES').state,'NOT_VERIFIED');assert.equal(result.steps.find(step=>step.key==='ROUND_TRIP').state,'NOT_VERIFIED');
});
test('empty setup has no fabricated number, template approval or connected state',()=>{
 const result=customerWhatsAppReadiness(tenantWorkspaceFromMetadata(null),null);assert.equal(result.steps[0].state,'PENDING');assert.equal(result.steps[2].state,'NOT_LINKED');assert.equal(result.operational,false);
});
for(const mode of ['DEDICATED','BUSINESS_APP','EXISTING_API'])test('customer may save intended number mode without losing existing service '+mode,()=>{assert.equal(normalizeTenantWorkspace({...profile(),numberMode:mode}).numberMode,mode);});
for(const patch of [{confirmOwnership:false},{assistantName:'<script>'},{useCases:[]},{accessToken:'never-store-this'},{phoneNumberId:'123456'},{tenantRole:'ADMIN'},{approval:'APPROVED'}])test('rejects invalid preparation or injected authority '+JSON.stringify(patch),()=>assert.throws(()=>normalizeTenantWorkspace({...profile(),...patch})));
test('same schema keeps existing project profile compatible and preserves unrelated metadata',()=>{
 const metadata=projectWorkspaceMetadata({other:{keep:true}},stored(),projectId);assert.deepEqual(metadata.other,{keep:true});assert.equal(readProjectWorkspaceProfile(metadata,null,projectId).profile.revision,1);
});
test('legacy organization profile is not copied into another project',()=>{
 const legacy={whatsappWorkspace:{...stored(),schemaVersion:1}};
 assert.equal(readProjectWorkspaceProfile(null,legacy,'project-b').profile.configured,false);
 assert.equal(readProjectWorkspaceProfile(null,legacy,projectId).profileSource,'LEGACY_ORGANIZATION');
});
test('foreign or malformed project metadata is never replaced with an empty profile',()=>{
 assert.throws(()=>readProjectWorkspaceProfile({whatsappWorkspace:{...stored(),initialProjectId:'other'}},null,projectId));
 assert.throws(()=>readProjectWorkspaceProfile({whatsappWorkspace:{}},null,projectId));
});
const request=(method='GET',body=null,headers={},query='?'+new URLSearchParams({projectId,scope}))=>new Request('https://obrasaas.com/api/identity/whatsapp-setup'+query,{method,headers:{...(method==='POST'?{'Content-Type':'application/json',origin:'https://obrasaas.com'}:{}),...headers},...(body===null?{}:{body:typeof body==='string'?body:JSON.stringify(body)})});
function handlers(user=identity){
 const calls=[];
 const call=name=>async(...args)=>{calls.push([name,...args]);return name==='status'?{state:'NOT_OBSERVED',definitive:false}:{scope,saved:name==='save'};};
 const api=createCustomerWhatsAppHandlers({verify:async()=>user,service:{read:call('read'),save:call('save'),status:call('status')}});
 return {calls,api};
}

test('anonymous request is rejected before body or persistence',async()=>{const h=handlers({authenticated:false});assert.equal((await h.api.POST(request('POST','{',{},''))).status,401);assert.equal(h.calls.length,0);});
test('personal session cannot choose a business through request headers',async()=>{const h=handlers({...identity,organizationId:null});assert.equal((await h.api.GET(request('GET',null,{'x-clerk-org-id':'org_Forged'}))).status,403);assert.equal(h.calls.length,0);});
for(const query of ['?organizationId=forged','?projectId=a&projectId=b&scope='+scope,'?projectId=../other&scope='+scope,'?projectId=project-a','?projectId=project-a&scope='+scope+'&access_token=bad'])test('rejects arbitrary tenant/credential query '+query,async()=>{const h=handlers();assert.equal((await h.api.GET(request('GET',null,{},query))).status,400);assert.equal(h.calls.length,0);});
for(const origin of ['https://other.example','null','http://obrasaas.com',''])test('foreign origin cannot save configuration '+origin,async()=>{const h=handlers();assert.equal((await h.api.POST(request('POST',{},{origin},''))).status,403);assert.equal(h.calls.length,0);});
test('successful GET passes only verified identity to canonical service and is not cacheable',async()=>{const h=handlers();const result=await h.api.GET(request());assert.equal(result.status,200);assert.deepEqual(h.calls[0][1],identity);assert.equal(result.headers.get('cache-control'),'private, no-store, max-age=0');});
test('uncertain result recovery is GET-only and never resubmits',async()=>{const h=handlers();await h.api.GET(request('GET',null,{},'?'+new URLSearchParams({projectId,scope,operationId})));assert.equal(h.calls.length,1);assert.equal(h.calls[0][0],'status');});
test('body size bound applies before service entry',async()=>{const h=handlers();assert.equal((await h.api.POST(request('POST','X'.repeat(32769),{},''))).status,413);assert.equal(h.calls.length,0);});
test('mismatched project or invalid operation fails before persistence',async()=>{
 let calls=0;const service=createCustomerWhatsAppSetup({workspace:{integrationProject:()=>{calls++;}}});
 await assert.rejects(service.save(identity,{projectId,scope,operationId:'invalid',profile:profile()}),{code:'WHATSAPP_PREPARATION_INVALID'});
 await assert.rejects(service.save(identity,{projectId:'project-b',scope,operationId,profile:profile()}),{code:'WORKSPACE_PROJECT_MISMATCH'});assert.equal(calls,0);
});
test('preparation service neither calls Meta nor reads credentials nor changes provider records',()=>{
 const source=readFileSync(new URL('../src/lib/customer-whatsapp-setup.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/fetch\(|decryptCredential|access_token|encryptedAccessToken|META_WHATSAPP_ACCESS_TOKEN|UPDATE public\."WhatsAppConnection"|INSERT INTO public\."WhatsAppConnection"/);
 assert.match(source,/project.whatsapp_workspace.prepared.self_service/);
 const ui=readFileSync(new URL('../src/app/(identity)/cuenta/customer-whatsapp-panel.js',import.meta.url),'utf8');assert.doesNotMatch(ui,/FB\.login|localStorage|sessionStorage|type="password"/);
 assert.match(ui,/Autorizar WhatsApp con Meta/);assert.match(ui,/Preparación y pasos del alta/);assert.match(ui,/Consultar conexión Meta/);assert.match(ui,/guardar la preparación no confirma su aceptación/);
});
test('enterprise project-profile source was reused without a forked data format',()=>{
 const file=readFileSync(new URL('../src/lib/whatsapp/project-workspace-profile.js',import.meta.url));
 const normalized=Buffer.from(file.toString().replace(/\r\n/g,'\n'));const hash=createHash('sha1').update('blob '+normalized.length+'\0').update(normalized).digest('hex');
 assert.equal(hash,'8bdfe773c8a5138130ab880a7a8fdfa22ddfad8b');
});
