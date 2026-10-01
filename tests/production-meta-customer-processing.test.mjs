import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,createHmac} from 'node:crypto';
import {customerChannelActive,assertCustomerReplyWindow} from '../src/lib/meta-customer-outbound.mjs';
import {createMetaCustomerJobHandlers,signMetaCustomerJob,decodeSignedCustomerEvent} from '../src/lib/meta-customer-processing.mjs';
import {createMetaCustomerProvider,customerReplyMessage} from '../src/lib/meta-customer-provider.mjs';
import {createMetaCustomerCallbackHandlers,metaCustomerContentDigest} from '../src/lib/meta-customer-callback.mjs';
import {encryptCustomerSecret} from '../src/lib/meta-customer-credentials.mjs';
import {OBRASAAS_META_CHANNEL} from '../src/lib/meta-channel-binding.mjs';
const time=Date.parse('2026-10-01T10:00:00Z'),id='customer_webhook_'+'a'.repeat(64),environment={NEXT_PUBLIC_META_APP_ID:OBRASAAS_META_CHANNEL.appId,META_APP_SECRET:'synthetic-customer-app-secret-only',META_CONFIG_ID:'123456789012345',META_GRAPH_API_VERSION:'v25.0',META_CUSTOMER_VERIFY_TOKEN:'test-verify-only-'.repeat(3),WHATSAPP_CREDENTIALS_ENCRYPTION_KEY:Buffer.alloc(32,29).toString('base64'),OBRASAAS_META_SIGNUP_RELEASE:'customer-self-service-v1',META_CUSTOMER_JOB_SECRET:'synthetic-job-secret-only-'.repeat(2),CRON_SECRET:'synthetic-cron-secret-only-'.repeat(2)};
const payload={wabaId:'12345678901234',phoneNumberId:'12345678901235',field:'messages',type:'message',value:{id:'wamid.SyntheticMessage01',from:'5491112345678',timestamp:String(time/1000),type:'text',text:{body:'ayuda'}}};
test('reply requires exact owned conversation timestamp and preserves absence of Meta location precision',()=>{
 assert.deepEqual(assertCustomerReplyWindow(payload,time),{to:payload.value.from,replyTo:payload.value.id});
 for(const value of [{...payload,type:'message_status'},{...payload,value:{...payload.value,from:'invalid'}},{...payload,value:{...payload.value,timestamp:String((time-86400000)/1000)}},{...payload,value:{...payload.value,timestamp:String((time+61000)/1000)}}])assert.throws(()=>assertCustomerReplyWindow(value,time),{code:'META_CUSTOMER_REPLY_WINDOW_CLOSED'});
 assert.deepEqual(customerReplyMessage({type:'text',body:'Entrada pendiente de revisión: Meta no informa precisión.'}),{type:'text',text:{preview_url:false,body:'Entrada pendiente de revisión: Meta no informa precisión.'}});
 assert.throws(()=>customerReplyMessage({type:'template',body:'invented'}));
});
test('activation is only operational after explicit acceptance and provider registration, subscription and all grants',()=>{
 const channel={enabled:true,connectionStatus:'CONNECTED',metadata:{customerActivation:{version:1,state:'ACTIVE',actorId:'u1'},customerSubscribed:true,customerVerification:{registered:true,scopes:['whatsapp_business_management','whatsapp_business_messaging'],expiresAt:null}}};
 assert.equal(customerChannelActive(channel,time),true);
 const verification=channel.metadata.customerVerification,withVerification=value=>({...channel,metadata:{...channel.metadata,customerVerification:value}});
 assert.equal(customerChannelActive(withVerification({...verification,scopes:[...verification.scopes,'business_management']}),time),true);
 for(const missing of verification.scopes)assert.equal(customerChannelActive(withVerification({...verification,scopes:[...verification.scopes.filter(scope=>scope!==missing),'business_management']}),time),false,missing);
 for(const invalid of [{...verification,scopes:verification.scopes.join(',')},{...verification,expiresAt:new Date(time+60000).toISOString()},{...verification,expiresAt:'invalid'}])assert.equal(customerChannelActive(withVerification(invalid),time),false);
 for(const variant of [{...channel,enabled:false},{...channel,metadata:{...channel.metadata,customerActivation:null}},{...channel,metadata:{...channel.metadata,customerSubscribed:false}},{...channel,metadata:{...channel.metadata,customerVerification:{registered:false,scopes:channel.metadata.customerVerification.scopes}}}])assert.equal(customerChannelActive(variant,time),false);
});
test('interactive list preserves durable choice identifiers and rejects foreign structure, oversized menus and duplicate choices',()=>{
 const menu={type:'interactive',body:'Elegí una opción de esta obra.\nLa revisión se conserva.',button:'Elegir',sections:[{title:'Opciones',rows:[{id:'obra:syntheticnonce:0',title:'Entrada',description:'Solicitar ubicación'}]}]};
 const normalized=customerReplyMessage(menu);assert.equal(normalized.interactive.type,'list');assert.equal(normalized.interactive.action.sections[0].rows[0].id,menu.sections[0].rows[0].id);
 for(const invalid of [{...menu,url:'https://evil.invalid'}, {...menu,sections:[{title:'Opciones',rows:Array.from({length:11},(_,index)=>({id:'obra:nonce:'+index,title:'Acción'}))}]}, {...menu,sections:[{title:'Opciones',rows:[menu.sections[0].rows[0],menu.sections[0].rows[0]]}]}])assert.throws(()=>customerReplyMessage(invalid),{code:'META_CUSTOMER_REPLY_INVALID'});
});
test('encrypted signing proof is bound to semantic event, tenant, channel, app and AAD, never a mutable boolean grant',()=>{
 const channel={id:'c1',projectId:'p1',organizationId:'o1',whatsappBusinessId:payload.wabaId,phoneNumberId:payload.phoneNumberId},context={organizationId:'o1',projectId:'p1',resourceId:id},payloadDigest=metaCustomerContentDigest(payload);
 const event={id,projectId:'p1',payload:{signatureVerified:true,signatureScheme:'meta-hmac-sha256-v1',organizationId:'o1',channelId:'c1',payloadDigest,encryptedPayload:encryptCustomerSecret(JSON.stringify(payload),{...context,purpose:'webhook'},environment),encryptedProof:encryptCustomerSecret(JSON.stringify({scheme:'meta-hmac-sha256-v1',appId:OBRASAAS_META_CHANNEL.appId,payloadDigest,organizationId:'o1',channelId:'c1'}),{...context,purpose:'webhook-proof'},environment)}};
 assert.deepEqual(decodeSignedCustomerEvent(event,channel,environment),payload);
 for(const changed of [{...event,payload:{...event.payload,encryptedProof:null}},{...event,payload:{...event.payload,payloadDigest:'mutated'}},{...event,projectId:'p2'}])assert.throws(()=>decodeSignedCustomerEvent(changed,channel,environment),{code:'META_CUSTOMER_EVENT_PROOF_REQUIRED'});
});
test('signed internal job binds bytes and explicit durable event ids, stale signatures and cross-body replays fail closed',async()=>{
 let calls=0;const handlers=createMetaCustomerJobHandlers({processor:{recover:async(input={})=>{calls++;return input;}},environment,now:()=>time}),body=JSON.stringify({version:1,eventIds:[id]}),sig=signMetaCustomerJob(body,time,environment);
 const request=(value=body,timestamp=time,signature=sig)=>new Request('https://obrasaas.com/api/meta/customer-process',{method:'POST',headers:{'Content-Type':'application/json','x-obrasaas-job-time':String(timestamp),'x-obrasaas-job-signature':'sha256='+signature},body:value});
 assert.equal((await handlers.POST(request())).status,200);assert.equal(calls,1);
 assert.equal((await handlers.POST(request(body+' '))).status,403);assert.equal((await handlers.POST(request(body,time-60001))).status,403);assert.equal(calls,1);
 assert.notEqual(signMetaCustomerJob(Buffer.from([255]),time,environment),signMetaCustomerJob(Buffer.from('\ufffd'),time,environment));
 assert.equal((await handlers.GET(new Request('https://obrasaas.com/api/meta/customer-process',{headers:{authorization:'Bearer '+environment.CRON_SECRET}}))).status,200);
});
test('callback schedules only after persisted ACK evidence; schedule failure never turns a committed event into rejection',async()=>{
 const raw=JSON.stringify({object:'whatsapp_business_account',entry:[{id:payload.wabaId,changes:[{field:'messages',value:{metadata:{phone_number_id:payload.phoneNumberId},messages:[payload.value]}}]}]}),signature='sha256='+createHmac('sha256',environment.META_APP_SECRET).update(raw).digest('hex'),order=[];
 const handler=createMetaCustomerCallbackHandlers({environment,inbox:{record:async(_,options)=>{assert.equal(options.signatureVerified,true);order.push('commit');return {durable:true,eventIds:[id]};}},schedule:ids=>{assert.deepEqual(ids,[id]);order.push('scheduled');throw new Error('controlled wake-up lost');}});
 const response=await handler.POST(new Request('https://obrasaas.com/api/meta/customer-callback',{method:'POST',headers:{'content-type':'application/json','x-hub-signature-256':signature},body:raw}));assert.equal(response.status,200);assert.deepEqual(order,['commit','scheduled']);
});
test('customer provider sends only through owned token/phone with outbound correlation; media comes from Graph lookup and digest checks',async()=>{
 const bytes=Buffer.from('OggS synthetic controlled media'),sha256=createHash('sha256').update(bytes).digest('hex'),calls=[];
 const provider=createMetaCustomerProvider({environment,fetchImpl:async(url,options)=>{calls.push({url:String(url),options});if(String(url).includes('/messages'))return Response.json({messages:[{id:'wamid.SyntheticOutbound01'}]});if(url.hostname==='graph.facebook.com')return Response.json({id:'12345678901236',url:'https://lookaside.fbsbx.com/whatsapp_business/attachments/?controlled=1',mime_type:'audio/ogg; codecs=opus',file_size:bytes.length,sha256});return new Response(bytes,{headers:{'Content-Type':'audio/ogg; codecs=opus','Content-Length':String(bytes.length)}});}});
 await provider.sendReply({token:'synthetic-customer-token',phoneNumberId:payload.phoneNumberId,to:payload.value.from,message:{type:'text',body:'Menú de obra'},correlationId:'customer_outbound_'+'b'.repeat(64),replyTo:payload.value.id});
 const body=JSON.parse(calls[0].options.body);assert.equal(body.biz_opaque_callback_data,'customer_outbound_'+'b'.repeat(64));assert.equal(body.context.message_id,payload.value.id);assert.equal(calls[0].options.headers.Authorization,'Bearer synthetic-customer-token');
 const media=await provider.downloadMedia({token:'synthetic-customer-token',phoneNumberId:payload.phoneNumberId,mediaId:'12345678901236'});assert.equal(media.sha256,sha256);assert.equal(media.contentType,'audio/ogg');assert.deepEqual(media.bytes,bytes);assert.match(calls[1].url,/phone_number_id=12345678901235/);
 const evil=createMetaCustomerProvider({environment,fetchImpl:async()=>Response.json({id:'12345678901236',url:'https://evil.invalid/private',mime_type:'audio/ogg',file_size:bytes.length,sha256})});await assert.rejects(evil.downloadMedia({token:'synthetic',phoneNumberId:payload.phoneNumberId,mediaId:'12345678901236'}),{code:'META_CUSTOMER_MEDIA_REJECTED'});
});
