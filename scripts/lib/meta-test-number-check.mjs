import {readMetaJson,resolveMetaTransport,metaErrorCode,createMetaSender,normalizeWhatsAppRecipient} from '../../src/lib/meta-whatsapp-transport.mjs';
export const META_TEST_NUMBER='15551533706';
export const META_TEST_CHECK_PROJECT='prj_68NErbCqCFsDVaMak81gcwsGI9pF';
const numeric=value=>typeof value==='string'&&/^[1-9]\d{4,31}$/.test(value);
export async function inspectMetaTestNumber({environment=process.env,fetchImpl=fetch}={}){
 const config=resolveMetaTransport(environment),proof={version:1,channel:'META_TEST_NUMBER',numberPurchaseRequired:false,
  testNumberMatched:false,phoneBelongsToWaba:false,appSubscribed:false,approvedHelloWorld:false,
  incomingSignatureConfigured:Boolean(environment.META_APP_SECRET&&environment.META_APP_SECRET!=='[SENSITIVE]'),
  verificationChallengeConfigured:Boolean(environment.META_VERIFY_TOKEN&&environment.META_VERIFY_TOKEN!=='[SENSITIVE]'),
  actualWebhookVerified:false,recipientVerificationChecked:false,physicalDeliveryTested:false,sentMessages:0,requests:0,checks:[]};
 const waba=environment.META_WABA_ID,app=environment.NEXT_PUBLIC_META_APP_ID||environment.META_APP_ID;
 if(config.error||!numeric(waba)||!numeric(app))return {...proof,status:'CONFIGURATION_INCOMPLETE',code:config.error||'META_TEST_ASSET_ID_REQUIRED'};
 const query=async(path,params)=>{
  const url=new URL(`https://graph.facebook.com/${config.version}/${path}`);
  for(const [key,value]of Object.entries(params))url.searchParams.set(key,value);
  proof.requests++;
  const response=await fetchImpl(url.toString(),{headers:{Authorization:'Bearer '+config.token},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)});
  const data=await readMetaJson(response,262144);
  if(!response.ok||data.error){const error=new Error('Meta request not confirmed');error.meta=metaErrorCode(data.error);error.httpStatus=response.status;throw error;}
  return data;
 };
 try{
  const phone=await query(config.phoneNumberId,{fields:'id,display_phone_number,verified_name'});
  proof.testNumberMatched=phone.id===config.phoneNumberId&&phone.display_phone_number?.replace(/\D/g,'')===META_TEST_NUMBER&&phone.verified_name==='Test Number';
  if(!proof.testNumberMatched)return {...proof,status:'SENDER_MISMATCH',code:'META_TEST_NUMBER_NOT_CONFIRMED'};
  proof.testNumberDisplay=phone.display_phone_number;proof.phoneNumberId=config.phoneNumberId;proof.wabaId=waba;proof.appId=app;
  const numbers=await query(`${waba}/phone_numbers`,{fields:'id,display_phone_number,verified_name',limit:'100'});
  proof.phoneBelongsToWaba=Array.isArray(numbers.data)&&numbers.data.some(row=>row.id===config.phoneNumberId&&row.display_phone_number?.replace(/\D/g,'')===META_TEST_NUMBER);
  if(!proof.phoneBelongsToWaba)return {...proof,status:'WABA_MISMATCH',code:'META_TEST_WABA_NOT_CONFIRMED'};
  const subscribed=await query(`${waba}/subscribed_apps`,{limit:'100'});
  proof.appSubscribed=Array.isArray(subscribed.data)&&subscribed.data.some(row=>row.whatsapp_business_api_data?.id===app||row.id===app);
  const templates=await query(`${waba}/message_templates`,{name:'hello_world',fields:'id,name,status,language',limit:'100'});
  proof.approvedHelloWorld=Array.isArray(templates.data)&&templates.data.some(t=>t.name==='hello_world'&&t.language==='en_US'&&t.status==='APPROVED');
  proof.status=proof.appSubscribed&&proof.approvedHelloWorld?'TEST_ASSETS_VERIFIED':'TEST_SETUP_INCOMPLETE';
  proof.code=proof.status==='TEST_ASSETS_VERIFIED'?null:!proof.appSubscribed?'META_APP_NOT_SUBSCRIBED':'META_TEST_TEMPLATE_UNAVAILABLE';
  return proof;
 }catch(error){return {...proof,status:'META_UNCONFIRMED',code:error.meta?.code||'META_PROVIDER_UNAVAILABLE',providerCode:error.meta?.providerCode??null,httpStatus:error.httpStatus??null};}
}
export function metaTestCheckEnabled(environment=process.env){
 if(!environment.OBRASAAS_RUN_META_TEST_CHECK)return false;
 if(!['read-only-v1','send-hello-world-once-v1'].includes(environment.OBRASAAS_RUN_META_TEST_CHECK)||environment.VERCEL_ENV!=='production'||environment.VERCEL_PROJECT_ID!==META_TEST_CHECK_PROJECT||environment.NEXT_PUBLIC_APP_URL!=='https://obrasaas.com')throw new Error('META_TEST_CHECK_CONTEXT_REJECTED');
 return true;
}

export async function runMetaTestCheck({environment=process.env,fetchImpl=fetch}={}){
 if(!metaTestCheckEnabled(environment))return {status:'NOT_REQUESTED',sentMessages:0};
 const proof=await inspectMetaTestNumber({environment,fetchImpl});
 if(environment.OBRASAAS_RUN_META_TEST_CHECK==='read-only-v1')return proof;
 const recipient=environment.OBRASAAS_META_TEST_RECIPIENT;
 if(normalizeWhatsAppRecipient(recipient)!==recipient)return {...proof,probeSend:{attempted:false,code:'META_EXPLICIT_TEST_RECIPIENT_REQUIRED'}};
 if(proof.status!=='TEST_ASSETS_VERIFIED')return {...proof,probeSend:{attempted:false,code:'META_TEST_ASSETS_NOT_VERIFIED'}};
 // One deliberate hello_world to the explicitly selected test recipient.
 // No loops, alternative numbers, messages, or retries on provider uncertainty.
 const send=createMetaSender({environment:()=>environment,fetchImpl});
 const result=await send(recipient,{type:'template',template:{name:'hello_world',language:{code:'en_US'}}});
 return {...proof,submissionAttempts:1,acceptedMessages:result.accepted?1:0,probeSend:{attempted:true,recipientSuffix:recipient.slice(-4),template:'hello_world',language:'en_US',...result}};
}
