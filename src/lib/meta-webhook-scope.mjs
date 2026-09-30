import {normalizeWhatsAppRecipient} from './meta-whatsapp-transport.mjs';
import {testRecipients} from './meta-test-dispatch.mjs';
export function validateMetaEnvelope(payload,environment=process.env){
 const waba=environment.META_WABA_ID,phone=environment.META_PHONE_NUMBER_ID||environment.WHATSAPP_PHONE_NUMBER_ID;
 if(!/^[1-9]\d{4,31}$/.test(waba||'')||!/^[1-9]\d{4,31}$/.test(phone||''))return {ok:false,status:503,code:'META_WEBHOOK_SCOPE_NOT_CONFIGURED'};
 if(payload?.object!=='whatsapp_business_account'||!Array.isArray(payload.entry)||!payload.entry.length)return {ok:false,status:400,code:'META_WEBHOOK_ENVELOPE_INVALID'};
 for(const entry of payload.entry){
  if(entry.id!==waba)return {ok:false,status:403,code:'META_WEBHOOK_WABA_MISMATCH'};
  if(!Array.isArray(entry.changes)||!entry.changes.length)return {ok:false,status:400,code:'META_WEBHOOK_ENVELOPE_INVALID'};
  for(const change of entry.changes){
   if(change.field!=='messages'||change.value?.metadata?.phone_number_id!==phone)return {ok:false,status:403,code:'META_WEBHOOK_PHONE_MISMATCH'};
  }
 }
 if(payload.entry.length!==1||payload.entry[0].changes.length!==1)return {ok:false,status:503,code:'META_BATCH_REQUIRES_DURABLE_INGRESS'};
 const value=payload.entry[0].changes[0].value,messages=value.messages||[],statuses=value.statuses||[];
 if(!Array.isArray(messages)||!Array.isArray(statuses)||messages.length+statuses.length!==1)return {ok:false,status:503,code:'META_BATCH_REQUIRES_DURABLE_INGRESS'};
 if(environment.META_CHANNEL_MODE==='test'&&messages.length){
  const allowed=testRecipients(environment),sender=normalizeWhatsAppRecipient(messages[0].from);
  if(!allowed.length)return {ok:false,status:503,code:'META_TEST_RECIPIENTS_REQUIRED'};
  if(!sender||!allowed.includes(sender))return {ok:false,status:403,code:'META_LOCAL_TEST_RECIPIENT_NOT_ALLOWED'};
 }
 return {ok:true};
}
