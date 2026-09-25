import { tsImport } from 'tsx/esm/api';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { getWhatsAppFlowBlueprint } from '../../src/lib/whatsapp/flows.js';
// Called exclusively inside the guarded disposable SQL/authentication verifiers.
// Uses the actual engine but does not exercise provider ingress or outbound dispatch.
export async function seedFlowIncidentFixture(tx,{scope,prefix,now}) {
  assert.ok(['sql_incident','s11e2e_incident'].includes(prefix));
  assert.ok(now instanceof Date&&Number.isFinite(now.getTime()));
  const {processIncomingObraMessage}=await tsImport('../../src/lib/whatsapp/obra-engine.js',{parentURL:import.meta.url,tsconfig:'./jsconfig.json'});
  const workerId=prefix+'_worker',conversationId=prefix+'_conversation',phoneNumberId='777777777111111';
  const worker=await tx.worker.create({data:{id:workerId,...scope,name:'Encargado sintético de incidencias',active:true,metadata:{whatsappRole:'SITE_MANAGER'}}});
  await tx.conversation.create({data:{id:conversationId,projectId:scope.projectId,channel:'whatsapp',externalId:'meta:5497777711111',displayName:'Incidencia vinculada de ensayo'}});
  const previous=await tx.projectSnapshot.findUnique({where:{projectId:scope.projectId}});
  const state=structuredClone(previous?.state||{attendance:{},incidents:[],tasks:{},alertsCount:0,operariosCount:0});
  const rows=[];
  for(let i=0;i<2;i++){
    const createdAt=new Date(now.getTime()-(5-i)*60000),consumedAt=new Date(now.getTime()-(3-i)*30000);
    const id=(prefix==='sql_incident'?'65000000':'66000000')+'-0000-4000-8000-'+String(i).padStart(12,'0');
    const sourceId=prefix+'_source_'+i,replyId=prefix+'_reply_'+i,externalId='obrasaas-flow-template:'+prefix+'-'+i,consumedExternalId='wamid.synthetic.'+prefix+'.reply.'+i,providerMessageId='wamid.synthetic.'+prefix+'.sent.'+i;
    const session=await tx.whatsAppFlowSession.create({data:{id,...scope,workerId,phoneNumberId,recipientPhone:'5497777711111',blueprintKey:'incident-report',flowId:'888888888111111',screenId:getWhatsAppFlowBlueprint('incident-report').screenId,flowType:'incident',sourceExternalId:externalId,tokenSha256:createHash('sha256').update(prefix+'-'+i).digest('hex'),createdAt,expiresAt:new Date(now.getTime()+3600000),deliveryAttemptedAt:createdAt,sentAt:createdAt,providerMessageId,consumedAt,consumedExternalId}});
    const event={provider:'meta',externalId:consumedExternalId,phoneNumberId,from:'5497777711111',kind:'interactive',interactive:{type:'flow',response:{flow_type:'incident',severity:'high',area:'Frente sintético',description:'Demora de materiales de ensayo.'}},timestamp:consumedAt};
    const outcome=await processIncomingObraMessage(event,scope,{prisma:tx,state,projectSettings:{id:scope.projectId,organizationId:scope.organizationId,timezone:'America/Argentina/Buenos_Aires'},worker,flowSession:session,persist:false,environment:{}});
    const inbound=outcome.newMessages.find(item=>item.sender==='user');assert.ok(inbound?.metadata?.flowIncidentReceipt);
    const incidentId=inbound.metadata.flowIncidentReceipt.incidentId;
    if(i===1)delete inbound.metadata.flowIncidentReceipt;
    await tx.message.create({data:{id:sourceId,conversationId,direction:'OUTBOUND',kind:'INTERACTIVE',externalId,providerMessageId,status:'delivered',body:'Solicitud de incidencia de ensayo',createdAt,sentAt:createdAt,metadata:{messageType:'whatsapp_flow_template',blueprintKey:'incident-report',flowSessionId:id,recipient:'PRIVATE_INCIDENT_CANARY'}}});
    await tx.message.create({data:{id:replyId,conversationId,direction:'INBOUND',kind:'INTERACTIVE',externalId:consumedExternalId,body:inbound.text,createdAt:consumedAt,sentAt:consumedAt,metadata:{...inbound.metadata,recipient:'PRIVATE_INCIDENT_CANARY'}}});
    rows.push({sourceId,replyId,incidentId,legacy:i===1});
  }
  state.unrelatedPrivateValue='PRIVATE_INCIDENT_CANARY';
  await tx.projectSnapshot.upsert({where:{projectId:scope.projectId},create:{projectId:scope.projectId,state,version:1,updatedAt:new Date(now.getTime()-500)},update:{state,version:{increment:1},updatedAt:new Date(now.getTime()-500)}});
  return {rows,workerId,conversationId,scope};
}
export async function flowIncidentFixtureSnapshot(db,fixture){
 return JSON.parse(JSON.stringify({snapshot:await db.projectSnapshot.findUnique({where:{projectId:fixture.scope.projectId}}),messages:await db.message.findMany({where:{conversationId:fixture.conversationId},orderBy:{id:'asc'}}),sessions:await db.whatsAppFlowSession.findMany({where:{projectId:fixture.scope.projectId,workerId:fixture.workerId},orderBy:{id:'asc'}}),audits:await db.auditLog.count()}));
}
