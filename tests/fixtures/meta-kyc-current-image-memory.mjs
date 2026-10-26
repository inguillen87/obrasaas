import {stepReminderFixture} from './meta-kyc-step-reminder-memory.mjs';
import {createMetaKycBridge} from '../../src/lib/meta-kyc-bridge.mjs';
import {createMetaKycOutbound} from '../../src/lib/meta-kyc-outbound.mjs';
import {createParticipantChannelKycDeposit} from '../../src/lib/participant-channel-kyc.mjs';
import {resolveMetaKycAuthority} from '../../src/lib/meta-kyc-identity.mjs';
import {syntheticCaptureQuality} from './capture-quality-synthetic.mjs';
import {createFacialChatAuditPort} from './participant-facial-chat-audit-memory.mjs';

export async function currentImageFixture(step='FRONT',options={}){
 const t=await stepReminderFixture(step,options),f=t.f,currentControls={commit:null,afterReserve:null,commits:0,scheduled:[]};
 const facialAudit=createFacialChatAuditPort(f);
 const connect=async()=>{const client=await facialAudit(await t.currentConnect());return {...client,query:async(sql,args=[])=>{const current=[...f.audits.values()].some(a=>a.action==='participant.kyc_chat.image_context');if(sql==='COMMIT'&&current&&currentControls.commit==='ROLLBACK'){currentControls.commit=null;throw Error('SYNTHETIC_CURRENT_COMMIT_REJECTED');}const result=await client.query(sql,args);if(sql==='COMMIT')currentControls.commits++;if(sql==='COMMIT'&&current&&currentControls.commit==='LOST_ACK'){currentControls.commit=null;throw Error('SYNTHETIC_CURRENT_COMMIT_ACK_LOST');}return result;}};};
 const scheduleAnalysis=ref=>{currentControls.scheduled.push({ref,commits:currentControls.commits,processing:structuredClone(f.worker.metadata.participant.kyc.processing),receipts:structuredClone([...f.audits.values()].filter(a=>a.metadata.kind==='KYC_SUBMITTED'))});};
 const deposit=createParticipantChannelKycDeposit({connect,resolveAuthority:resolveMetaKycAuthority,upload:f.upload,assessCaptureQuality:value=>(f.controls.quality||syntheticCaptureQuality)(value),environment:f.environment}),bridge=createMetaKycBridge({connect,provider:f.provider,deposit,scheduleAnalysis,environment:f.environment}),outbound=createMetaKycOutbound({connect,provider:f.provider,environment:f.environment,afterReserve:async()=>{if(currentControls.afterReserve)await currentControls.afterReserve();}});
 const receive=(message,options={})=>{f.now.setTime(Date.now());return f.receive(message,{contextId:null,...options});};
 const execute=async(message,options)=>{const context=receive(message,options),result=await bridge.execute(context);if(result?.reply)await outbound.send(context,result.reply);return {context,result};};
 const image=(id='150000211',extra={})=>execute({type:'image',image:{id,mime_type:'image/png',...extra}});
 const confirm=async()=>{const s=f.state(),row=s.choices.findIndex(c=>c.value==='CONFIRM');return execute({type:'interactive',interactive:{list_reply:{id:'kyc:'+s.nonce+':'+row}}},{contextId:[...f.outbounds.values()].filter(o=>o.payload.kycContextFeedback!==true).at(-1).outcome.messageId});};
 return {...t,connect,deposit,bridge,outbound,receive,execute,image,confirm,currentControls};
}
