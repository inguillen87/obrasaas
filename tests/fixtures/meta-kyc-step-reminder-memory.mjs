import assert from 'node:assert/strict';
import {contextFeedbackFixture} from './meta-kyc-context-feedback-memory.mjs';
import {createMetaKycContextFeedback} from '../../src/lib/meta-kyc-context-feedback.mjs';
import {createMetaCustomerProvider} from '../../src/lib/meta-customer-provider.mjs';

// Reuse the full signed corporate fixture, transaction serialization and compact
// outbound fences. Only the new discovery SELECT is adapted to the memory table.
export async function stepReminderFixture(step='CONSENT',options={}){
 let fixture,actual,currentConnect;const requests=[],controls={ambiguous:false,afterFirstFence:null,loseAck:false,extraDiscoveryRows:[],discoveryRows:null,discoveryCalls:[]};
 const t=await contextFeedbackFixture('COMPANY',{...options,stale:false,factory:({connect,environment,afterReserve})=>createMetaKycContextFeedback({environment,afterReserve,connect:currentConnect=async()=>{
  const client=await connect();return {...client,query:async(sql,args=[])=>{
   if(!sql.startsWith('SELECT w.id AS "reminderWorkerId"')){const result=await client.query(sql,args);if(sql.startsWith('SELECT')&&sql.includes('FROM public."WebhookEvent"')&&sql.includes('"processedAt"'))for(const row of result.rows)if(row.processedAt===undefined&&row.outcome?.completedAt)row.processedAt=new Date(row.outcome.completedAt);return result;}
   const f=fixture,c=f.worker.metadata.participant.kycChatChallenge;assert.deepEqual(args.slice(0,2),[f.connection.id,f.target.organizationId]);
   assert.match(sql,/ORDER BY w.id$/);assert.doesNotMatch(sql,/LIMIT/);assert.equal(args.length,3);controls.discoveryCalls.push([...args]);
   const eligible=args[2]===f.worker.phone&&f.control.assignment&&f.controls.projectActive&&f.worker.active&&c.connectionId===args[0]&&c.status==='CLAIMED';
   const values=eligible?(controls.discoveryRows||[{reminderWorkerId:f.worker.id,projectId:f.worker.projectId,metadata:f.worker.metadata},...controls.extraDiscoveryRows]):[];
   const all=controls.ambiguous?[...values,...values]:values,rows=structuredClone(all.sort((a,b)=>a.reminderWorkerId<b.reminderWorkerId?-1:a.reminderWorkerId>b.reminderWorkerId?1:0));
   return {rows,rowCount:rows.length};
  }};
 },provider:{sendReply:input=>actual.sendReply({...input,beforeExternal:async()=>{await input.beforeExternal();const hook=controls.afterFirstFence;controls.afterFirstFence=null;if(hook)await hook();}})}})});
 fixture=t.f;
 actual=createMetaCustomerProvider({environment:fixture.environment,now:()=>fixture.now.getTime(),fetchImpl:async(url,options)=>{
  assert.equal(new URL(url).hostname,'graph.facebook.com');assert.equal(options.method,'POST');const body=JSON.parse(options.body);assert.equal(body.type,'text');assert.match(body.text.body,/foto todavía no se guardó/);assert.doesNotMatch(body.text.body,/OpenAI|OpenCV|ONNX|\bAPI\b|\bOCR\b/);requests.push(body);if(controls.loseAck)throw new Error('Synthetic accepted send with lost ACK');return new Response(JSON.stringify({messages:[{id:'wamid.GuidedReminder_'+requests.length}]}),{status:200,headers:{'Content-Type':'application/json'}});
 }});
 for(const [target,title]of [['BACK_CONSENT','Autorizar imágenes'],['OCR','Autorizar dorso'],['BIOMETRIC',options.ocrConsent===true?'Con lectura asistida':'Sin lectura asistida'],['FRONT',fixture.state().biometricNoticeVersion==='participant-private-biometric-v3'?(options.biometricConsent===true?'Comparar antes de guardar':'Revisión manual'):(options.biometricConsent===true?'Con comparación facial':'Sin comparación facial')]]){
  if(fixture.state().step===step)break;await fixture.choose(title);if(target===step)break;
 }
 while(fixture.state().step!==step&&['FRONT','BACK','SELFIE'].includes(fixture.state().step))await fixture.image();
 assert.equal(fixture.state().step,step);
 // Equal-second photos intentionally exercise the conservative reminder path.
 // CURRENT capture fixtures create a later signed image after the prompt.
 const context=fixture.receive({type:'image',timestamp:String(fixture.state().lastMessageTimestamp),image:{id:'150000011',mime_type:'image/png'}},{contextId:null});
 return {...t,context,currentConnect,requests,reminderControls:controls};
}
