import assert from 'node:assert/strict';
import test from 'node:test';
import {OBRASAAS_META_CHANNEL as CHANNEL} from '../src/lib/meta-channel-binding.mjs';
import {sameArgentineMobile,resolveMetaRecipientBinding,confirmBoundMetaRecipient} from '../src/lib/meta-test-recipient-binding.mjs';
import {createMetaSender,metaDispatchHttpStatus} from '../src/lib/meta-whatsapp-transport.mjs';
const waId='5492610001111',apiTo='54261150001111';
const document=()=>({version:1,appId:CHANNEL.appId,wabaId:CHANNEL.wabaId,phoneNumberId:CHANNEL.phoneNumberId,recipients:[{waId,apiTo}]});
const env=value=>({VERCEL_ENV:'production',NEXT_PUBLIC_META_APP_ID:CHANNEL.appId,META_WABA_ID:CHANNEL.wabaId,META_PHONE_NUMBER_ID:CHANNEL.phoneNumberId,
 META_WHATSAPP_ACCESS_TOKEN:'synthetic-only-unchanged-access-token',META_CHANNEL_MODE:'test',META_TEST_RECIPIENT_BINDINGS:JSON.stringify(value??document())});
const resolve=(value=document(),recipient=waId)=>resolveMetaRecipientBinding(recipient,env(value),CHANNEL.phoneNumberId);
const accepted={messaging_product:'whatsapp',messages:[{id:'wamid.'+'B'.repeat(32)}],contacts:[{input:apiTo,wa_id:waId}]};

test('only the explicit same-person mapping is used; inputs remain unchanged',()=>{
 const configured=env(),before=structuredClone(configured);assert.deepEqual(resolveMetaRecipientBinding(waId,configured,CHANNEL.phoneNumberId),{apiTo,waId,applied:true});assert.deepEqual(configured,before);
});
test('provider-form input resolves to the same canonical participant identity',()=>assert.deepEqual(resolve(document(),apiTo),{apiTo,waId,applied:true}));
test('an unlisted Argentine phone is never guessed or rewritten',()=>assert.deepEqual(resolve(document(),'5491112345678'),{apiTo:'5491112345678',waId:'5491112345678',applied:false}));
test('absent configuration does not rewrite existing identities',()=>assert.deepEqual(resolveMetaRecipientBinding(waId,{},CHANNEL.phoneNumberId),{apiTo:waId,waId,applied:false}));
for(const row of [['5491100001111','54111500001111'],['5492610001111','54261150001111'],['5492964001111','54296415001111']])test('explicit same-mobile identity with area length '+row[0],()=>assert.equal(sameArgentineMobile(...row),true));
for(const to of ['5492610001111','542610001111','54262150001111','54261150009999','15555550123','5426115000111'])test('unproven alternative cannot be silently bound '+to,()=>assert.equal(sameArgentineMobile(waId,to),false));
for(const change of [d=>{d.version=2;},d=>{d.appId='999999999';},d=>{d.wabaId='99999999';},d=>{d.phoneNumberId='99999999';},d=>{d.recipients=[];},d=>{d.recipients.push({...d.recipients[0]});},d=>{d.recipients[0].apiTo='54261159999999';},d=>{d.recipients[0].role='ADMIN';},d=>{d.secret='must-not-be-here';}])
 test('rejects invalid binding contract '+String(change),()=>{const value=document();change(value);assert.equal(resolve(value).error,'META_TEST_RECIPIENT_BINDING_INVALID');});
test('mapping is disabled outside the exact configured test sender',()=>{
 assert.equal(resolveMetaRecipientBinding(waId,{...env(),META_CHANNEL_MODE:'production'},CHANNEL.phoneNumberId).error,'META_TEST_RECIPIENT_BINDING_INVALID');
 assert.equal(resolveMetaRecipientBinding(waId,env(),'99999999').error,'META_TEST_RECIPIENT_BINDING_INVALID');
});
for(const raw of ['{','null','[]','x'.repeat(8193)])test('malformed bounded binding is rejected '+raw.slice(0,8),()=>assert.equal(resolveMetaRecipientBinding(waId,{...env(),META_TEST_RECIPIENT_BINDINGS:raw},CHANNEL.phoneNumberId).error,'META_TEST_RECIPIENT_BINDING_INVALID'));
test('Meta response must confirm the original wa_id, not the transport representation',()=>{
 const binding=resolve();assert.equal(confirmBoundMetaRecipient(accepted,binding),true);
 for(const contacts of [undefined,[],[{wa_id:apiTo}],[{wa_id:waId},{wa_id:waId}]])assert.equal(confirmBoundMetaRecipient({...accepted,contacts},binding),false);
});
test('sender makes one request with the same access token and bound destination',async()=>{
 const environment=env(),before=structuredClone(environment),calls=[];
 const send=createMetaSender({environment:()=>environment,fetchImpl:async(url,options)=>{calls.push({url,options});return Response.json(accepted);}});
 const payload={type:'text',text:{body:'Synthetic fixture'}};const result=await send(waId,payload);
 assert.equal(calls.length,1);assert.equal(JSON.parse(calls[0].options.body).to,apiTo);assert.equal(calls[0].options.headers.Authorization,'Bearer '+before.META_WHATSAPP_ACCESS_TOKEN);
 assert.deepEqual(environment,before);assert.deepEqual(payload,{type:'text',text:{body:'Synthetic fixture'}});
 assert.equal(result.accepted,true);assert.equal(result.recipientBindingVerified,true);assert.equal(result.delivered,false);assert.equal(metaDispatchHttpStatus(result),200);
});
test('missing recipient confirmation retains the accepted wamid but blocks success and never retries',async()=>{
 let requests=0;const send=createMetaSender({environment:()=>env(),fetchImpl:async()=>{requests++;return Response.json({...accepted,contacts:[]});}});
 const result=await send(waId,'test');assert.equal(requests,1);assert.equal(result.accepted,true);assert.equal(result.success,false);assert.equal(result.state,'ACCEPTED_RECIPIENT_UNCONFIRMED');assert.equal(result.messageId,accepted.messages[0].id);assert.equal(metaDispatchHttpStatus(result),502);
});
test('a rejected routed request is not retried with canonical digits or another number',async()=>{
 let requests=0;const send=createMetaSender({environment:()=>env(),fetchImpl:async()=>{requests++;return Response.json({error:{code:131030}},{status:400});}});
 const result=await send(waId,'test');assert.equal(requests,1);assert.equal(result.code,'META_TEST_RECIPIENT_NOT_ALLOWED');assert.equal(result.accepted,false);
});
test('invalid routing config fails before any request or secret change',async()=>{
 let requests=0;const configured=env({...document(),appId:'another-app'});const send=createMetaSender({environment:()=>configured,fetchImpl:async()=>{requests++;throw new Error();}});
 assert.equal((await send(waId,'test')).code,'META_TEST_RECIPIENT_BINDING_INVALID');assert.equal(requests,0);
});
