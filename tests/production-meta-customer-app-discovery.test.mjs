import test from 'node:test';
import assert from 'node:assert/strict';
import {createMetaCustomerAppProjection} from '../src/lib/meta-customer-app-projection.mjs';
import {encryptCustomerSecret} from '../src/lib/meta-customer-credentials.mjs';
import {metaCustomerContentDigest} from '../src/lib/meta-customer-callback.mjs';
import {OBRASAAS_META_CHANNEL} from '../src/lib/meta-channel-binding.mjs';

// Real signed decoder and projection. This SQL double rejects unlisted work;
// it cannot contact Graph or authorize a participant from discovery data.
const instant=Date.parse('2026-10-15T20:00:00.000Z');
function fixture({payload=null,changeDiscovery=()=>{},beforeLocked=()=>{}}={}){
 const environment={META_CUSTOMER_CREDENTIALS_KEY:Buffer.alloc(32,49).toString('base64')},eventId='customer_webhook_'+'d'.repeat(64),context={eventId,projectId:'project-a',channelId:'channel-a',leaseToken:'lease-a'},channel={id:'channel-a',projectId:'project-a',organizationId:'org-a',whatsappBusinessId:'8888888801',phoneNumberId:'9999999901',enabled:true,connectionStatus:'CONNECTED',metadata:{credentialFormat:'tenant-aad-v2',credentialOrganizationId:'org-a'}},queries=[],writes=[];
 const signed=payload||{wabaId:channel.whatsappBusinessId,phoneNumberId:channel.phoneNumberId,field:'messages',type:'message',value:{id:'wamid.AppDiscoverySynthetic01',from:'5491112345678',timestamp:String(instant/1000),type:'text',text:{body:'CONSUMO'}}};
 const aad={organizationId:'org-a',projectId:'project-a',resourceId:eventId},payloadDigest=metaCustomerContentDigest(signed);context.payloadDigest=payloadDigest;
 const event={id:eventId,projectId:'project-a',provider:'meta-customer-v1',eventType:'message',status:'PENDING',leaseToken:'lease-a',leaseExpiresAt:new Date(instant+60000),payload:{signatureVerified:true,signatureScheme:'meta-hmac-sha256-v1',organizationId:'org-a',channelId:'channel-a',payloadDigest,encryptedPayload:encryptCustomerSecret(JSON.stringify(signed),{...aad,purpose:'webhook'},environment),encryptedProof:encryptCustomerSecret(JSON.stringify({scheme:'meta-hmac-sha256-v1',appId:OBRASAAS_META_CHANNEL.appId,payloadDigest,organizationId:'org-a',channelId:'channel-a'}),{...aad,purpose:'webhook-proof'},environment)}};
 let clock=instant,commits=0,open=0,release=0,external=0,locked=0;
 const rows=values=>({rows:structuredClone(values),rowCount:values.length});
 const client={async query(sql,args=[]){
  queries.push({sql,args:structuredClone(args)});
  if(sql==='BEGIN'){assert.equal(open,0);open++;return rows([]);}
  if(sql==='COMMIT'){open--;commits++;if(commits===1)beforeLocked({event,channel,context,setClock:value=>{clock=value;}});return rows([]);}
  if(sql==='ROLLBACK'){open--;return rows([]);}
  if(sql.startsWith('SET LOCAL'))return rows([]);
  if(sql.includes('AS "discoveryEvent"')){assert.deepEqual(args,[eventId,'project-a','channel-a']);const observed={discoveryEvent:structuredClone(event),discoveryConnection:structuredClone(channel),discoveryNow:new Date(clock)};changeDiscovery(observed);return rows([observed]);}
  if(sql.startsWith('SELECT "whatsappBusinessId","phoneNumberId"')){locked++;return rows([{whatsappBusinessId:channel.whatsappBusinessId,phoneNumberId:channel.phoneNumberId}]);}
  if(sql.includes('to_regclass'))return rows([{present:false}]);
  if(sql.startsWith('SELECT c.id,c."projectId",p."organizationId"'))return rows([{id:channel.id,projectId:channel.projectId,organizationId:channel.organizationId}]);
  if(sql.startsWith('SELECT id FROM public."Organization"'))return rows([{id:channel.organizationId}]);
  if(sql.startsWith('SELECT id,"organizationId" FROM public."Project"'))return rows([{id:channel.projectId,organizationId:channel.organizationId}]);
  if(sql.startsWith('SELECT id,"projectId",metadata,"whatsappBusinessId"'))return rows([channel]);
  if(sql.startsWith('SELECT id,"projectId",provider,payload,status::text'))return rows([event]);
  if(sql.startsWith('UPDATE public."WhatsAppConnection"')){writes.push({sql,args});return {rows:[],rowCount:1};}
  throw Error('Unexpected app discovery SQL: '+sql);
 },release(){assert.equal(open,0);release++;}};
 const provider=new Proxy({}, {get(){external++;throw Error('No Graph call is permitted');}}),projection=createMetaCustomerAppProjection({connect:async()=>client,environment,provider,now:()=>clock});
 return {event,channel,context,queries,writes,execute:()=>projection.execute(context),stats:()=>({open,release,external,locked,commits})};
}

test('ordinary signed conversation is excluded without schema, roster or projection reads and without writes',async()=>{
 const f=fixture(),before=structuredClone({event:f.event,channel:f.channel});assert.equal(await f.execute(),null);
 assert.deepEqual({event:f.event,channel:f.channel},before);assert.equal(f.queries.length,4);assert.ok(f.queries.every(row=>!/FOR UPDATE|FOR SHARE|AuditLog|Worker|INSERT|UPDATE public/.test(row.sql)));
 assert.deepEqual(f.stats(),{open:0,release:1,external:0,locked:0,commits:1});assert.deepEqual(f.writes,[]);
});

for(const [name,mutate] of [
 ['provider',r=>{r.discoveryEvent.provider='other';}],
 ['project',r=>{r.discoveryEvent.projectId='project-b';}],
 ['event',r=>{r.discoveryEvent.id='customer_webhook_'+'e'.repeat(64);}],
 ['channel',r=>{r.discoveryConnection.id='channel-b';}],
 ['organization',r=>{r.discoveryConnection.organizationId='org-b';}],
 ['source channel',r=>{r.discoveryEvent.payload.channelId='channel-b';}],
 ['source digest',r=>{r.discoveryEvent.payload.payloadDigest='a'.repeat(64);}],
 ['lease token',r=>{r.discoveryEvent.leaseToken='another-lease';}],
 ['finished source',r=>{r.discoveryEvent.status='PROCESSED';}],
 ['invalid expiry',r=>{r.discoveryEvent.leaseExpiresAt='invalid';}],
 ['expired exactly',r=>{r.discoveryEvent.leaseExpiresAt=new Date(instant);}],
 ['invalid clock',r=>{r.discoveryNow='not-a-database-date';}],
])test('ordinary discovery rejects changed '+name+' instead of silently skipping validation',async()=>{
 const f=fixture({changeDiscovery:mutate});await assert.rejects(f.execute(),{code:'META_CUSTOMER_INBOX_LEASE_CHANGED'});assert.equal(f.stats().locked,0);assert.equal(f.stats().external,0);assert.equal(f.stats().open,0);assert.deepEqual(f.writes,[]);
});

for(const [name,mutate] of [
 ['proof',r=>{r.discoveryEvent.payload.encryptedProof='corrupt';}],
 ['payload',r=>{r.discoveryEvent.payload.encryptedPayload='corrupt';}],
 ['signature',r=>{r.discoveryEvent.payload.signatureVerified=false;}],
 ['WABA',r=>{r.discoveryConnection.whatsappBusinessId='8888888802';}],
 ['phone',r=>{r.discoveryConnection.phoneNumberId='9999999902';}],
])test('discovery still authenticates '+name+' using the original decoder',async()=>{
 const f=fixture({changeDiscovery:mutate});await assert.rejects(f.execute(),{code:'META_CUSTOMER_EVENT_PROOF_REQUIRED'});assert.equal(f.stats().external,0);assert.equal(f.stats().locked,0);assert.deepEqual(f.writes,[]);
});

const app=(field,value)=>({wabaId:'8888888801',phoneNumberId:'9999999901',field,type:'app_source',value});
for(const [field,value] of [
 ['history',{messages:[]}],
 ['smb_app_state_sync',{state_sync:[]}],
 ['smb_message_echoes',{message_echoes:[]}],
 ['account_update',{event:'ACCOUNT_OFFBOARDED'}],
])test('signed '+field+' retains complete locked projection processing',async()=>{
 const f=fixture({payload:app(field,value)}),result=await f.execute();assert.equal(f.stats().locked,1);assert.equal(f.stats().commits,2);assert.equal(f.stats().release,2);assert.equal(f.stats().external,0);assert.ok(f.queries.some(row=>row.sql.includes('FOR UPDATE')));
 assert.equal(result.kind,field==='account_update'?'CUSTOMER_ACCOUNT_LIFECYCLE':'COEXISTENCE_SOURCE_REVIEW');assert.equal(f.writes.length,field==='account_update'?1:0);
});

for(const [name,mutate,code] of [
 ['lease replaced',f=>{f.event.leaseToken='new-token';},'META_CUSTOMER_INBOX_LEASE_CHANGED'],
 ['lease elapsed',f=>{f.setClock(instant+60000);},'META_CUSTOMER_INBOX_LEASE_CHANGED'],
 ['proof replaced',f=>{f.event.payload.encryptedProof='corrupt-after-discovery';},'META_CUSTOMER_EVENT_PROOF_REQUIRED'],
 ['connection replaced',f=>{f.channel.metadata.credentialOrganizationId='org-b';},'META_CUSTOMER_CALLBACK_SCOPE_REJECTED'],
])test('positive discovery never substitutes for fresh locked validation after '+name,async()=>{
 const f=fixture({payload:app('history',{messages:[]}),beforeLocked:mutate});await assert.rejects(f.execute(),{code});assert.equal(f.stats().locked,1);assert.equal(f.stats().open,0);assert.equal(f.stats().external,0);assert.deepEqual(f.writes,[]);
});
