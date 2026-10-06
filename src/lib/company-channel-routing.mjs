import {createHmac} from 'node:crypto';
import {WorkspaceError,digest} from './workspace-policy.mjs';
import {companyChannelSchemaReady,COMPANY_CHANNEL_SCHEMA_CONTRACT} from './company-channel-schema.mjs';
import {decodeWorkerChannelProof,workerChannelCodeDigest,lockParticipantMember,approvedParticipant,signedBinding,assignment,assertWorkerCustomerConnection,resolveWorkerChannelIdentity} from './worker-channel-identity.mjs';
import {lockPersonWorksiteJourney} from './person-worksite-journey.mjs';
import {encryptCustomerSecret,decryptCustomerSecret} from './meta-customer-credentials.mjs';
import {customerJobTransaction,customerOutboundId} from './meta-customer-outbound.mjs';
import {createMetaFieldBridge,readMetaFieldConversation} from './meta-field-bridge.mjs';

const fault=(code,status=403)=>{throw new WorkspaceError(code,status);};
const text=body=>({type:'text',body});
const result=(kind,reply,extra={})=>({kind,identityStatus:'CHANNEL_VERIFIED',reviewState:'OBSERVED',businessApplied:false,replySent:false,reply,...extra});
function senderKey(connection,phone,environment){const key=environment.META_CUSTOMER_CREDENTIALS_KEY||environment.WHATSAPP_CREDENTIALS_ENCRYPTION_KEY;if(!/^[A-Za-z0-9+/]{43}=$/.test(key||''))fault('META_CUSTOMER_VAULT_UNAVAILABLE',503);return createHmac('sha256',Buffer.from(key,'base64')).update(JSON.stringify(['company-sender-v1',connection.organizationId,connection.id,phone])).digest('hex');}
const cryptContext=(r,purpose,id)=>({organizationId:r.member.organizationId,projectId:r.connection.projectId,purpose,resourceId:id});
const seal=(r,purpose,id,value,env)=>encryptCustomerSecret(JSON.stringify(value),cryptContext(r,purpose,id),env);
const unseal=(r,purpose,id,value,env)=>JSON.parse(decryptCustomerSecret(value,cryptContext(r,purpose,id),env));
function sourceLease(event,context,now){if(event.status!=='PENDING'||event.projectId!==context.projectId||event.payload.channelId!==context.channelId||event.payload.payloadDigest!==context.payloadDigest||event.leaseToken!==context.leaseToken||!Number.isFinite(Date.parse(event.leaseExpiresAt))||Date.parse(event.leaseExpiresAt)<=now.getTime())fault('META_CUSTOMER_INBOX_LEASE_CHANGED',409);}

// Identity is discovered from account-owned, independently bound Workers. A
// corporate phone never identifies the author. No second inbound event exists.
export async function resolveCompanyEnvelope(client,{eventId,environment=process.env,context=null}){
 const initial=(await client.query(`SELECT * FROM public."WebhookEvent" WHERE id=$1`,[eventId])).rows[0];if(!initial||initial.provider!=='meta-customer-v1'||initial.eventType!=='message')return null;
 const raw=(await client.query(`SELECT c.*,p."organizationId" FROM public."WhatsAppConnection" c JOIN public."Project" p ON p.id=c."projectId" WHERE c.id=$1 AND c."projectId"=$2 AND p."organizationId"=$3`,[initial.payload?.channelId,initial.projectId,initial.payload?.organizationId])).rows[0];if(!raw)fault('WORKER_CHANNEL_SIGNED_PROOF_REQUIRED');
 const proof0=decodeWorkerChannelProof(initial,raw,environment),code=workerChannelCodeDigest(proof0.value.type==='text'?proof0.value.text?.body:null),ready=await companyChannelSchemaReady(client);
 if(!ready){if(proof0.companyRouting||raw.metadata?.companyRoutingVersion===1)fault('COMPANY_CHANNEL_CATALOG_REQUIRED',409);return null;}
 const owner0=(await client.query(`SELECT * FROM public."WhatsAppCompanyChannel" WHERE "connectionId"=$1 AND "organizationId"=$2 AND "anchorProjectId"=$3`,[raw.id,raw.organizationId,raw.projectId])).rows[0];
 const prior0=(await client.query(`SELECT * FROM public."WhatsAppCompanyEventRoute" WHERE "sourceEventId"=$1`,[eventId])).rows[0];
 if(!proof0.companyRouting&&!prior0&&!(code&&owner0?.mode==='PREPARED'))return null;
 if(!owner0||!['PREPARED','COMPANY'].includes(owner0.mode))fault('COMPANY_CHANNEL_SUSPENDED');
 if(proof0.companyRouting&&(proof0.companyRouting.mode!=='COMPANY'||proof0.companyRouting.contract!==COMPANY_CHANNEL_SCHEMA_CONTRACT))fault('COMPANY_CHANNEL_SOURCE_REQUIRED');
 const found=(await client.query(`SELECT w.*,u.id AS "actorId",u."clerkUserId",tm.id AS "membershipId",tm."organizationId",a.revision AS "assignmentRevision",p.name AS "projectName"
  FROM public."WhatsAppChannelProjectAssignment" a JOIN public."Project" p ON p.id=a."projectId" AND p."organizationId"=a."organizationId"
  JOIN public."Worker" w ON w."projectId"=p.id JOIN public."PlatformUser" u ON u."clerkUserId"=w.metadata->'participant'->>'clerkUserId'
  JOIN public."TenantMembership" tm ON tm."userId"=u.id AND tm."organizationId"=p."organizationId"
  WHERE a."connectionId"=$1 AND a."organizationId"=$2 AND a.status='ACTIVE' AND p.status='ACTIVE' AND w.active=true AND w.phone=$3
   AND (${code?"w.metadata->'participant'->'channelIdentity'->'challenge'->>'codeDigest'=$4":"w.metadata->'participant'->'channelIdentity'->'binding'->>'status'='VERIFIED' AND w.metadata->'participant'->'channelIdentity'->'binding'->>'connectionId'=$1"}) ORDER BY w."projectId",w.id LIMIT 101`,code?[raw.id,raw.organizationId,proof0.senderE164,code]:[raw.id,raw.organizationId,proof0.senderE164])).rows;
 const candidates=prior0?.kind==='FIELD'||prior0?.kind==='BINDING'?found.filter(w=>w.id===prior0.workerId&&w.actorId===prior0.actorId&&w.membershipId===prior0.membershipId):found;
 if(candidates.length===0||candidates.length>100||new Set(candidates.map(w=>w.actorId)).size!==1||new Set(candidates.map(w=>w.membershipId)).size!==1||code&&candidates.length!==1)fault(code?'WORKER_CHANNEL_CHALLENGE_REJECTED':'WORKER_CHANNEL_BINDING_REQUIRED',code?409:403);
 const member=await lockParticipantMember(client,candidates[0]);await lockPersonWorksiteJourney(client,member);
 const projects=new Map();for(const id of [...new Set([raw.projectId,...candidates.map(w=>w.projectId)])].sort()){const p=(await client.query(`SELECT id,name,"organizationId",status::text AS status,metadata FROM public."Project" WHERE id=$1 AND "organizationId"=$2 FOR UPDATE`,[id,member.organizationId])).rows[0];if(!p||id!==raw.projectId&&p.status!=='ACTIVE')fault('COMPANY_CHANNEL_CONTEXT_CHANGED',409);projects.set(id,p);}
 const workers=[];for(const candidate of candidates){await assignment(client,member,candidate.projectId,true);const w=(await client.query(`SELECT *,to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision FROM public."Worker" WHERE id=$1 AND "projectId"=$2 FOR UPDATE`,[candidate.id,candidate.projectId])).rows[0];try{await approvedParticipant(client,w,member,{permission:'attendance'});workers.push({...w,assignmentRevision:candidate.assignmentRevision,projectName:projects.get(candidate.projectId).name});}catch(error){if(!(error instanceof WorkspaceError)||prior0||code)throw error;}}
 if(!workers.length)fault('WORKER_CHANNEL_BINDING_REQUIRED');
 const connection=(await client.query(`SELECT * FROM public."WhatsAppConnection" WHERE id=$1 AND "projectId"=$2 FOR SHARE`,[raw.id,raw.projectId])).rows[0];connection.organizationId=member.organizationId;assertWorkerCustomerConnection(connection,member.organizationId,connection.projectId,Date.now(),{operational:!code});
 const owner=(await client.query(`SELECT * FROM public."WhatsAppCompanyChannel" WHERE "connectionId"=$1 AND "organizationId"=$2 FOR SHARE`,[connection.id,member.organizationId])).rows[0];if(owner?.anchorProjectId!==connection.projectId||owner.mode!==owner0.mode||owner.revision!==owner0.revision)fault('COMPANY_CHANNEL_CONTEXT_CHANGED',409);
 for(const w of workers){const a=(await client.query(`SELECT revision FROM public."WhatsAppChannelProjectAssignment" WHERE "connectionId"=$1 AND "organizationId"=$2 AND "projectId"=$3 AND status='ACTIVE' FOR SHARE`,[connection.id,member.organizationId,w.projectId])).rows[0];if(a?.revision!==w.assignmentRevision)fault('COMPANY_CHANNEL_CONTEXT_CHANGED',409);if(!code)w.channelBinding=await signedBinding(client,w,member,connection,environment,{lockProof:true});}
 const senderHmac=senderKey(connection,proof0.senderE164,environment),routeId='company_route_'+digest([member.organizationId,connection.id,senderHmac]),route=(await client.query(`SELECT * FROM public."WhatsAppCompanyRoute" WHERE id=$1 FOR UPDATE`,[routeId])).rows[0];
 if(route&&(route.actorId!==member.actorId||route.membershipId!==member.membershipId))fault('COMPANY_CHANNEL_IDENTITY_AMBIGUOUS');
 const event=(await client.query(`SELECT * FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 FOR UPDATE`,[eventId,connection.projectId])).rows[0],proof=decodeWorkerChannelProof(event,connection,environment),now=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now;
 if(context)sourceLease(event,context,now);if(event.payload.payloadDigest!==initial.payload.payloadDigest||proof.senderE164!==proof0.senderE164)fault('WORKER_CHANNEL_PROOF_INTEGRITY',409);
 const projection=(await client.query(`SELECT * FROM public."WhatsAppCompanyEventRoute" WHERE "sourceEventId"=$1 FOR UPDATE`,[eventId])).rows[0];if(projection&&(projection.payloadDigest!==event.payload.payloadDigest||projection.connectionId!==connection.id||projection.organizationId!==member.organizationId||projection.actorId!==member.actorId||projection.membershipId!==member.membershipId))fault('COMPANY_CHANNEL_SOURCE_REQUIRED');
 return {member,projects,workers,connection,owner,route,routeId,senderHmac,event,proof,projection,now,code};
}
async function reserve(client,r,kind,worker=null){
 if(r.projection)return r.projection;
 const bindingId=worker&&(kind==='BINDING'?worker.metadata.participant.channelIdentity.challenge.id:worker.channelBinding.id);
 await client.query(`INSERT INTO public."WhatsAppCompanyEventRoute"("sourceEventId","payloadDigest","organizationId","connectionId",kind,"routeId","routeEpoch","actorId","membershipId","projectId","workerId","assignmentRevision","bindingId") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,[r.event.id,r.event.payload.payloadDigest,r.member.organizationId,r.connection.id,kind,r.route?.id||null,r.route?.epoch||null,r.member.actorId,r.member.membershipId,worker?.projectId||null,worker?.id||null,worker?.assignmentRevision||null,bindingId]);
 return {...r.projection,sourceEventId:r.event.id,kind,projectId:worker?.projectId||null,workerId:worker?.id||null};
}
async function recordResult(client,r,value,env){await client.query(`UPDATE public."WhatsAppCompanyEventRoute" SET "encryptedResult"=$2 WHERE "sourceEventId"=$1 AND "payloadDigest"=$3`,[r.event.id,seal(r,'company-source-result',r.event.id,value,env),r.event.payload.payloadDigest]);return value;}
async function writeRoute(client,r,state,worker,env,{advance=false}={}){
 const epoch=(r.route?.epoch||1)+(advance&&r.route?1:0);
 await client.query(`INSERT INTO public."WhatsAppCompanyRoute"(id,"organizationId","connectionId","senderHmac","actorId","membershipId",epoch,"projectId","workerId","assignmentRevision","bindingId","encryptedState") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(id) DO UPDATE SET epoch=EXCLUDED.epoch,"projectId"=EXCLUDED."projectId","workerId"=EXCLUDED."workerId","assignmentRevision"=EXCLUDED."assignmentRevision","bindingId"=EXCLUDED."bindingId","encryptedState"=EXCLUDED."encryptedState","updatedAt"=clock_timestamp()`,[r.routeId,r.member.organizationId,r.connection.id,r.senderHmac,r.member.actorId,r.member.membershipId,epoch,worker?.projectId||null,worker?.id||null,worker?.assignmentRevision||null,worker?.channelBinding?.id||null,seal(r,'company-route',r.routeId,{...state,epoch},env)]);
}
function menu(r,eventId,offset=0){const choices=r.workers.slice(offset,offset+8).map(w=>({value:w.id,title:w.projectName,assignmentRevision:w.assignmentRevision,bindingId:w.channelBinding.id}));if(offset>0)choices.push({value:'PREVIOUS',title:'Obras anteriores'});if(offset+8<r.workers.length)choices.push({value:'NEXT',title:'Más obras'});const nonce=digest([eventId,r.routeId,(r.route?.epoch||0)+1,choices]).slice(0,20);return {state:{phase:'MENU',nonce,choices,offset,expiresAt:new Date(r.now.getTime()+300000).toISOString()},reply:{type:'interactive',body:'Elegí la obra autorizada. Después confirmá el destino; cambiar de obra no cierra una jornada.',button:'Elegir obra',sections:[{title:'Obras',rows:choices.map((c,i)=>({id:'empresa:'+nonce+':'+i,title:c.title.slice(0,24)}))}]}};}
async function selector(client,r,env){
 if(r.projection?.encryptedResult)return {done:unseal(r,'company-source-result',r.event.id,r.projection.encryptedResult,env)};
 if(r.projection?.kind==='FIELD'||r.projection?.kind==='BINDING')return {delegate:true};
 if(r.code){await reserve(client,r,'BINDING',r.workers[0]);return {delegate:true};}
 if(r.owner.mode!=='COMPANY'||r.proof.companyRouting?.mode!=='COMPANY')fault('COMPANY_CHANNEL_SOURCE_REQUIRED');
 const body=r.proof.value.type==='text'?r.proof.value.text?.body?.trim().toUpperCase():null,state=r.route?unseal(r,'company-route',r.routeId,r.route.encryptedState,env):null,active=state&&Date.parse(state.expiresAt)>r.now.getTime(),selected=r.route&&r.workers.find(w=>w.id===r.route.workerId&&w.projectId===r.route.projectId&&w.assignmentRevision===r.route.assignmentRevision&&w.channelBinding.id===r.route.bindingId);
 const id=r.proof.value.type==='interactive'?(r.proof.value.interactive?.list_reply?.id||r.proof.value.interactive?.button_reply?.id):null;
 const match=/^empresa:([a-f0-9]{20}):(\d{1,2})$/.exec(id||'');
 const fieldState=selected?readMetaFieldConversation({...r,worker:selected,project:r.projects.get(selected.projectId),channelBinding:selected.channelBinding},env):null;
 const activeField=fieldState&&Date.parse(fieldState.expiresAt)>r.now.getTime()?fieldState:null;
 const promptSource=async()=>{
  if(!activeField)return false;
  const source=(await client.query(`SELECT "routeId","routeEpoch","workerId","projectId","bindingId","actorId","membershipId" FROM public."WhatsAppCompanyEventRoute" WHERE "sourceEventId"=$1 AND "organizationId"=$2 AND "connectionId"=$3 AND kind='FIELD'`,[activeField.lastEventId,r.member.organizationId,r.connection.id])).rows[0];
  return Boolean(source&&source.routeId===r.routeId&&source.routeEpoch===r.route.epoch&&source.workerId===selected.id&&source.projectId===selected.projectId&&source.bindingId===selected.channelBinding.id&&source.actorId===r.member.actorId&&source.membershipId===r.member.membershipId);
 };
 const promptContext=async()=>{
  if(typeof r.proof.value.context?.id!=='string'||!(await promptSource()))return false;
  const outbound=(await client.query(`SELECT id,payload,outcome FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2 AND provider='meta-customer-outbound-v1'`,[customerOutboundId(activeField.lastEventId),r.connection.projectId])).rows[0];
  if(!outbound?.outcome?.messageId||r.proof.value.context.id!==outbound.outcome.messageId)return false;
  const request=unseal(r,'outbound',outbound.id,outbound.payload.encryptedPayload,env);return digest(request)===outbound.payload.requestDigest&&request.organizationId===r.member.organizationId&&request.channelId===r.connection.id&&request.targetProjectId===selected.projectId&&request.sourceRouteId===activeField.lastEventId;
 };
 const emit=async(value,newState=null,worker=selected,advance=false)=>{await reserve(client,r,'SELECTION');if(newState)await writeRoute(client,r,newState,worker,env,{advance});return {done:await recordResult(client,r,value,env)};};
 if(body==='OBRA'||body==='CAMBIAR OBRA'||!selected&&!match){
  if(selected){const pending=(await client.query(`SELECT EXISTS(SELECT 1 FROM public."WhatsAppCompanyEventRoute" er JOIN public."WebhookEvent" e ON e.id=er."sourceEventId" WHERE er."routeId"=$1 AND er.kind='FIELD' AND e.status='PENDING') AS pending`,[r.routeId])).rows[0].pending;if(pending)return emit(result('WORKSITE_PENDING',text('Hay una operación pendiente. Consultá su recibo antes de cambiar de obra.')));if(activeField&&activeField.purpose!=='MENU')return emit(result('WORKSITE_DRAFT_PENDING',text('Conservamos el borrador de la obra actual. Respondé al mensaje de ese paso con CANCELAR para descartarlo explícitamente y después CAMBIAR OBRA.')));}
  const next=menu(r,r.event.id);return emit(result('WORKSITE_SELECTION',next.reply),next.state,null,true);
 }
 if(match){
  if(!active||match[1]!==state.nonce||!state.choices?.[Number(match[2])])return emit(result('STALE_WORKSITE_SELECTION',text('Esta selección venció o cambió. Escribí OBRA para elegir y confirmar nuevamente.')));
  const choice=state.choices[Number(match[2])];
  if(choice.value==='NEXT'||choice.value==='PREVIOUS'){const next=menu(r,r.event.id,Math.max(0,state.offset+(choice.value==='NEXT'?8:-8)));return emit(result('WORKSITE_SELECTION',next.reply),next.state,null,true);}
  const worker=r.workers.find(w=>w.id===choice.value&&w.assignmentRevision===choice.assignmentRevision&&w.channelBinding.id===choice.bindingId);if(!worker)return emit(result('STALE_WORKSITE_SELECTION',text('La autorización de esa obra cambió. Escribí OBRA para renovar la selección.')));
  if(state.phase==='CONFIRM'){const next={phase:'SELECTED',expiresAt:new Date(r.now.getTime()+900000).toISOString()};return emit(result('WORKSITE_SELECTED',text('Obra confirmada: '+worker.projectName+'. Escribí MENU y elegí la acción de esa obra. KYC, archivos, Flow y avisos no están habilitados en este canal.')),next,worker,true);}
  const nonce=digest([r.event.id,r.routeId,state.epoch,worker.id,worker.assignmentRevision,worker.channelBinding.id,'confirm']).slice(0,20),next={phase:'CONFIRM',nonce,choices:[{...choice}],expiresAt:new Date(r.now.getTime()+300000).toISOString()};return emit(result('WORKSITE_CONFIRM', {type:'interactive',body:'¿Confirmar la obra '+worker.projectName+'? La jornada y los recibos conservarán este destino.',button:'Confirmar obra',sections:[{title:'Destino',rows:[{id:'empresa:'+nonce+':0',title:'Confirmar obra'}]}]}),next,null);
 }
 if(body==='CANCELAR'&&selected){if(activeField&&!(await promptContext()))return emit(result('WORKSITE_INPUT_CONTEXT_REQUIRED',text('Respondé al mensaje del paso actual con CANCELAR. Conservamos el borrador y no cambiamos la obra.')));await client.query(`UPDATE public."Worker" SET metadata=metadata-'fieldChannelConversation',"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[selected.id,selected.projectId]);return emit(result('WORKSITE_DRAFT_CANCELLED',text('Borrador cancelado en '+selected.projectName+'. La jornada y los recibos se conservan. Escribí CAMBIAR OBRA para elegir otro destino.')));}
 if(!selected||!active||state.phase!=='SELECTED')return emit(result('WORKSITE_SELECTION_REQUIRED',text('Elegí y confirmá una obra vigente. Escribí OBRA.')));
 if(activeField&&activeField.purpose!=='MENU'&&['MENU','AYUDA'].includes(body))return emit(result('WORKSITE_DRAFT_PENDING',text('Conservamos el borrador de '+selected.projectName+'. Respondé al mensaje del paso actual para continuar, o con CANCELAR para descartarlo explícitamente. ESTADO permite consultar la jornada sin borrar este paso.')));
 if(['image','audio','video','document','nfm_reply'].includes(r.proof.value.type)||['KYC','VERIFICAR','EVIDENCIA','TAREAS','INCIDENCIA','MATERIALES','CONSUMO','AVANCE'].includes(body))return emit(result('COMPANY_ADAPTER_DISABLED',text('Este canal permite jornada individual en la obra confirmada. Completá KYC, evidencia, tareas y otras operaciones desde Mi cuenta.')));
 // Free input/location must reply to the durable prompt; an uncorrelated late
 // message cannot be assigned by phone, current selection or provider time.
 if(!['MENU','AYUDA','ESTADO'].includes(body)){
  const fieldChoice=/^obra:([a-f0-9]{20}):(\d{1,2})$/.exec(id||'');
  if(id?(!fieldChoice||fieldChoice[1]!==activeField?.nonce||!activeField?.choices?.[Number(fieldChoice[2])]||!(await promptSource())):!(await promptContext()))return emit(result('WORKSITE_INPUT_CONTEXT_REQUIRED',text('Escribí MENU y elegí una acción vigente de la obra confirmada, o respondé al mensaje de su paso actual. Conservamos el borrador y no registramos otro fichaje.')));
 }
 await reserve(client,r,'FIELD',selected);return {delegate:true};
}
export function createCompanyChannelBridge({connect,environment=process.env}){
 const within=run=>customerJobTransaction(connect,run),field=createMetaFieldBridge({connect,environment,attendanceOnly:true,resolveIdentity:(client,options)=>resolveWorkerChannelIdentity(client,{...options,companyRouting:true})});
 return {async execute(context){const prepared=await within(async client=>{const r=await resolveCompanyEnvelope(client,{eventId:context.eventId,environment,context});return r?selector(client,r,environment):null;});if(!prepared)return null;if(prepared.done)return prepared.done;const value=await field.execute(context);await within(async client=>{const r=await resolveCompanyEnvelope(client,{eventId:context.eventId,environment,context});if(!r)fault('COMPANY_CHANNEL_SOURCE_REQUIRED');await recordResult(client,r,value,environment);});return value;}};
}
export async function resolveCompanyOutboundIdentity(client,options){
 const projection=(await client.query(`SELECT kind FROM public."WhatsAppCompanyEventRoute" WHERE "sourceEventId"=$1`,[options.eventId])).rows[0];if(projection?.kind==='FIELD'||projection?.kind==='BINDING')return resolveWorkerChannelIdentity(client,{...options,companyRouting:true});
 const r=await resolveCompanyEnvelope(client,options);if(!r)fault('COMPANY_CHANNEL_SOURCE_REQUIRED');
 if(!r.projection?.encryptedResult)fault('COMPANY_CHANNEL_SOURCE_REQUIRED');return {kind:'CHANNEL_VERIFIED',member:r.member,project:r.projects.get(r.connection.projectId),connection:r.connection,event:r.event,proof:r.proof,sourceProjectId:r.connection.projectId,companyProjection:r.projection};
}
