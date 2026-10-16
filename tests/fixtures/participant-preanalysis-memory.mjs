import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {digest} from '../../src/lib/workspace-policy.mjs';
import {PARTICIPANT_NOTICE_VERSION,PARTICIPANT_NOTICE} from '../../src/lib/participant-kyc-image-set.mjs';
import {participantOcrNotice,participantBiometricNotice} from '../../src/lib/participant-analysis-consent.mjs';
import {enqueueParticipantPreanalysis} from '../../src/lib/participant-kyc-preanalysis-policy.mjs';
import {createParticipantKycPreanalysis} from '../../src/lib/participant-kyc-preanalysis.mjs';
import {createPilotMediaAnalyzer} from '../../src/lib/pilot-media.mjs';
import {createOrganizationResourceUsage} from '../../src/lib/organization-resource-usage-store.mjs';

export function preanalysisMemoryFixture({ocr=true,biometric=true,legacy=false,configured=true,expired=false,provider,bioProvider,beforeGet}={}){
 const sha=b=>createHash('sha256').update(b).digest('hex'),picture=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==','base64'),pictures=[picture,Buffer.concat([picture,Buffer.from('synthetic-selfie')])];
 const organizationId='company-synthetic',projectId='project-synthetic',workerId='worker-synthetic',actorId='actor-synthetic',sourceReceiptId='participant_'+'a'.repeat(64),submissionId='kyc-synthetic';
 let clock=new Date('2026-10-16T12:00:00.000Z'),ocrAvailable=configured,biometricAvailable=configured,coverageExpired=expired,active=true,assigned=true,membership=true;
 const ocrNotice=participantOcrNotice(legacy?'participant-external-ocr-v1':'participant-external-ocr-v2'),biometricNotice=participantBiometricNotice(legacy?'participant-private-biometric-v1':'participant-private-biometric-v2');
 const images=['document-front','selfie'].map((id,i)=>({id,kind:i?'SELFIE':'DOCUMENT_FRONT',url:'https://fixture.private.blob.vercel-storage.com/obrasaas/legacy-images/v1/'+String(i+1).repeat(64)+'/image.png',contentType:'image/png',bytes:pictures[i].length,sha256:sha(pictures[i])}));
 const consent=(notice,allowed)=>({allowed,noticeVersion:notice.version,noticeSha256:notice.sha256,recordedAt:clock.toISOString()});
 const kyc={version:1,status:'PENDING_REVIEW',submissionId,submittedAt:clock.toISOString(),noticeVersion:PARTICIPANT_NOTICE_VERSION,noticeSha256:digest(PARTICIPANT_NOTICE),consentRecorded:true,contentHash:digest(images.map(i=>[i.kind,i.sha256,i.bytes,i.contentType])),images,ocrConsent:consent(ocrNotice,ocr),biometricConsent:consent(biometricNotice,biometric)};
 enqueueParticipantPreanalysis({kyc,organizationId,projectId,workerId,sourceReceiptId,sourceActorId:actorId});
 const row={id:workerId,projectId,organizationId,active:true,metadata:{unrelated:{keep:true},participant:{version:1,status:'ACTIVE',clerkUserId:'user_Synthetic',permissions:{attendance:false,report:false},kyc}}};
 const receipt={id:sourceReceiptId,organizationId,actorId,action:'participant.operation.recorded',entityType:'Worker',entityId:workerId,metadata:{version:1,kind:'KYC_SUBMITTED',projectId,submissionId,contentHash:kyc.contentHash,noticeVersion:kyc.noticeVersion,identityCertified:false,ocrConsentRecorded:ocr,ocrNoticeVersion:ocrNotice.version,ocrNoticeSha256:ocrNotice.sha256,biometricConsentRecorded:biometric,biometricNoticeVersion:biometricNotice.version,biometricNoticeSha256:biometricNotice.sha256}};
 const audits=new Map([[receipt.id,receipt]]),calls={get:0,provider:0,biometric:0,requests:[],sql:[]};
 let tail=Promise.resolve();
 async function connect(){let release,snapshot;return {release(){},async query(sql,args=[]){
  calls.sql.push(sql);
  if(sql.startsWith('BEGIN')){const previous=tail;tail=new Promise(resolve=>{release=resolve;});await previous;snapshot={row:structuredClone(row),audits:structuredClone([...audits])};return {rows:[]};}
  if(sql==='COMMIT'){release?.();release=null;return {rows:[]};}
  if(sql==='ROLLBACK'){Object.assign(row,structuredClone(snapshot.row));audits.clear();for(const [id,a] of snapshot.audits)audits.set(id,a);release?.();release=null;return {rows:[]};}
  if(sql.startsWith('SET LOCAL')||sql.startsWith('SELECT pg_advisory'))return {rows:[]};
  if(sql==='SELECT clock_timestamp() AS now')return {rows:[{now:new Date(clock)}]};
  if(sql.includes('FROM public."Worker" w JOIN public."Project"'))return {rows:active?[structuredClone(row)]:[]};
  if(sql.includes('FROM public."PlatformUser" u JOIN public."TenantMembership"'))return {rows:membership?[{actorId,clerkUserId:'user_Synthetic',membershipId:'membership-synthetic',role:'AUDITOR'}]:[]};
  if(sql.includes('FROM public."Project" p JOIN public."Organization"'))return {rows:active?[{id:projectId}]:[]};
  if(sql.startsWith('SELECT id,"projectId",active,metadata FROM public."Worker"'))return {rows:[structuredClone(row)]};
  if(sql.includes('FROM public."ProjectMembership"'))return {rows:assigned?[{id:'assignment-synthetic'}]:[]};
  if(sql.includes('FROM public."Organization"'))return {rows:[{id:organizationId}]};
  if(sql.includes('FROM public."AuditLog"')){
   if(sql.includes("metadata->>'kind'='KYC_SUBMITTED'"))return {rows:[...audits.values()].filter(a=>a.action==='participant.operation.recorded'&&a.metadata.submissionId===args[2]).map(a=>structuredClone(a))};
   if(sql.includes("metadata->>'pendingKey'=$2"))return {rows:[...audits.values()].filter(a=>a.action==='organization.usage.resource'&&a.metadata.pendingKey===args[1]&&['DISPATCHED','UNKNOWN'].includes(a.metadata.state)).map(a=>structuredClone(a)).slice(0,1)};
   return {rows:audits.has(args[0])?[structuredClone(audits.get(args[0]))]:[]};
  }
  if(sql.startsWith('UPDATE public."Worker"')){row.metadata=JSON.parse(args[2]);return {rows:[]};}
  if(sql.startsWith('UPDATE public."AuditLog"')){audits.get(args[0]).metadata=JSON.parse(args[1]);return {rows:[]};}
  if(sql.startsWith('INSERT INTO public."AuditLog"')){const action=sql.includes("'organization.usage.resource'")?'organization.usage.resource':'participant.kyc.preanalysis',a={id:args[0],organizationId:args[1],actorId:args[2],action,entityType:action==='organization.usage.resource'?args[3]:'Worker',entityId:action==='organization.usage.resource'?args[4]:args[3],metadata:JSON.parse(action==='organization.usage.resource'?args[5]:args[4])};if(!audits.has(a.id))audits.set(a.id,a);else if(!sql.includes('ON CONFLICT'))assert.fail('Duplicate receipt');return {rows:[]};}
  if(sql.includes('AS "workerId"')&&sql.includes('FROM public."Worker"'))return {rows:[{workerId,projectId,submissionId}]};
  assert.fail('Unhandled synthetic SQL: '+sql);
 }};}
 const usage=createOrganizationResourceUsage({connect,lock:async()=>{},company:async()=>({id:organizationId,observedAt:new Date(clock)}),coverage:async()=>({state:coverageExpired?'EXPIRED':'TRIAL_CURRENT',startsAt:null,endsAt:null})});
 usage.lockBeforeProject=async()=>{};
 const analyzer=createPilotMediaAnalyzer({environment:()=>({OPENAI_API_KEY:'synthetic-key-never-networked'}),fetchImpl:async(url,options)=>{
  assert.equal(url,'https://api.openai.com/v1/chat/completions');calls.provider++;calls.requests.push(JSON.parse(options.body));
  if(provider)return provider({row,audits,calls,advance,receipt});
  return Response.json({id:'chatcmpl-synthetic',model:'gpt-4o',usage:{prompt_tokens:20,completion_tokens:10,total_tokens:30},choices:[{finish_reason:'stop',message:{content:JSON.stringify({isDni:true,nombreCompleto:'Persona Sintética',dni:'12345678',cuil:null})}}]});
 }});
 const assessBiometrics=async input=>{calls.biometric++;assert.equal(input.consentVersion,'participant-private-biometric-v2');if(bioProvider)return bioProvider({row,audits,calls,advance,input});return {success:true,status:'ADVISORY_UNREVIEWED',provider:'private-opencv-onnx',modelManifestSha256:'c695e1a85db3ac933836562ce1f7d7e2b372ba2951dc9c4d0160b88cd448c860',frontSha256:images[0].sha256,selfieSha256:images[1].sha256,faceSimilarity:0.4,captureRiskSignal:0.3,identityCertified:false,livenessVerified:false,documentAuthenticityVerified:false,measurementCalibrated:false,requiresHumanReview:true};};
 const get=async path=>{calls.get++;await beforeGet?.({row,audits,calls});const index=path.includes('1'.repeat(64))?0:1;return {statusCode:200,blob:{url:'https://fixture.private.blob.vercel-storage.com/'+path,size:pictures[index].length,contentType:'image/png'},stream:new Response(pictures[index]).body};};
 const readiness=()=>({ocr:ocrAvailable,biometric:biometricAvailable}),service=createParticipantKycPreanalysis({connect,get,analyzer,assessBiometrics,usage,readiness});
 function advance(ms){clock=new Date(clock.getTime()+ms);}
 return {service,connect,row,receipt,audits,calls,usage,ref:{projectId,workerId,submissionId},advance,setAvailable:value=>{ocrAvailable=value;biometricAvailable=value;},setStageAvailable:(kind,value)=>{if(kind==='ocr')ocrAvailable=value;else if(kind==='biometric')biometricAvailable=value;else assert.fail('Unknown synthetic stage');},setExpired:value=>{coverageExpired=value;},revoke:()=>{active=false;},unassign:()=>{assigned=false;},disableMember:()=>{membership=false;},processing:()=>row.metadata.participant.kyc.processing,usageRows:()=>[...audits.values()].filter(a=>a.action==='organization.usage.resource')};
}
