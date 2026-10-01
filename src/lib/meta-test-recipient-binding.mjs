import { OBRASAAS_META_CHANNEL } from './meta-channel-binding.mjs';
const failure=()=>({error:'META_TEST_RECIPIENT_BINDING_INVALID'});
const digits=value=>typeof value==='string'&&/^[1-9]\d{6,14}$/.test(value);
const exactKeys=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===[...keys].sort().join('|');
// Only explicit provider-observed routing aliases, not suffix matches or a
// global Argentina normalizer. This does not change participant identity.
export function sameArgentineMobile(waId,apiTo){
 if(!/^549\d{10}$/.test(waId||'')||!/^54\d{12}$/.test(apiTo||''))return false;
 const national=waId.slice(3);
 return [2,3,4].some(areaLength=>apiTo==='54'+national.slice(0,areaLength)+'15'+national.slice(areaLength));
}
export function resolveMetaRecipientBinding(recipient,environment,phoneNumberId){
 const raw=environment.META_TEST_RECIPIENT_BINDINGS;
 if(!raw)return {apiTo:recipient,waId:recipient,applied:false};
 if(environment.META_CHANNEL_MODE!=='test'||phoneNumberId!==OBRASAAS_META_CHANNEL.phoneNumberId||typeof raw!=='string'||raw.length>8192)return failure();
 let document;try{document=JSON.parse(raw);}catch{return failure();}
 if(!exactKeys(document,['version','appId','wabaId','phoneNumberId','recipients'])||document.version!==1||
    document.appId!==OBRASAAS_META_CHANNEL.appId||document.wabaId!==OBRASAAS_META_CHANNEL.wabaId||document.phoneNumberId!==phoneNumberId||
    !Array.isArray(document.recipients)||document.recipients.length<1||document.recipients.length>20)return failure();
 const waIds=new Set(),apiNumbers=new Set();
 for(const row of document.recipients){
  if(!exactKeys(row,['waId','apiTo'])||!digits(row.waId)||!digits(row.apiTo)||!sameArgentineMobile(row.waId,row.apiTo)||waIds.has(row.waId)||apiNumbers.has(row.apiTo))return failure();
  waIds.add(row.waId);apiNumbers.add(row.apiTo);
 }
 if([...waIds].some(value=>apiNumbers.has(value)))return failure();
 const row=document.recipients.find(value=>value.waId===recipient||value.apiTo===recipient);
 return row?{apiTo:row.apiTo,waId:row.waId,applied:true}:{apiTo:recipient,waId:recipient,applied:false};
}
export function confirmBoundMetaRecipient(data,binding){
 return !binding.applied||Array.isArray(data?.contacts)&&data.contacts.length===1&&data.contacts[0]?.wa_id===binding.waId;
}
