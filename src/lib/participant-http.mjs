import {WorkspaceError,workspaceId,operationId,requireWorkspaceIdentity} from './workspace-policy.mjs';
import {boundedBody} from './workspace-http.mjs';
import {readPrivateKycBody,PrivateImageError} from './private-image-upload.mjs';
import {participantAccountRequest} from './participant-account-discovery.mjs';
const headers={'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie, Authorization','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'};
const reply=(value,status=200)=>Response.json(value,{status,headers});
export function createParticipantHandlers({verify,store,join=false,scheduleOnboarding=()=>{}}){
 async function handle(request){try{
  const session=await verify(request.headers);if(!session.authenticated&&['IDENTITY_CONFIGURATION_PENDING','IDENTITY_PROVIDER_UNAVAILABLE'].includes(session.code))throw new WorkspaceError('IDENTITY_PROVIDER_UNAVAILABLE',503);requireWorkspaceIdentity(session);
  if(request.headers.get('sec-fetch-site')==='cross-site')throw new WorkspaceError('WORKSPACE_ORIGIN_REJECTED',403);
  const params=new URL(request.url).searchParams;
  if(request.method==='POST'){
   if(params.size||request.headers.get('origin')!=='https://obrasaas.com'||request.headers.has('content-encoding'))throw new WorkspaceError('WORKSPACE_ORIGIN_REJECTED',403);
   if(join)return reply(await store.join(session,await boundedBody(request),{accept:true}));
   // Images have their own bounded reader. The exact command contract rejects
   // mixing KYC submissions with administrative mutation payloads.
   const body=await readPrivateKycBody(request),result=body.front!==undefined||body.selfie!==undefined?await store.submitKyc(session,body):await store.save(session,body);
   if(['INVITE','SEND_ONBOARDING_WHATSAPP'].includes(body.action)&&result.saved===true&&result.replayed===false&&workspaceId(body.projectId)&&workspaceId(body.payload?.workerId)&&result.participant?.id===body.payload.workerId&&['SENT','ACCEPTED'].includes(result.participant.invitation?.state)&&result.participant.onboardingDelivery?.contactAuthorized===true){
    // The durable intent was committed by the store. This wake-up is optional;
    // cron recovers it if the HTTP response or runtime scheduling is lost.
    try{Promise.resolve(scheduleOnboarding({projectId:body.projectId,workerId:result.participant.id})).catch(()=>{});}catch{}
   }
   return reply(result);
  }
  if(request.method!=='GET')return reply({code:'METHOD_NOT_ALLOWED'},405);
  if(join){if(params.size!==1||params.getAll('invitationId').length!==1)throw new WorkspaceError('PARTICIPANT_INPUT_INVALID');return reply(await store.join(session,{invitationId:params.get('invitationId')}));}
  for(const key of params.keys())if(!['projectId','scope','after','intakeAfter','operationId','workerId','imageId','detail','action','query','afterAccount','accountId'].includes(key)||params.getAll(key).length!==1)throw new WorkspaceError('PARTICIPANT_INPUT_INVALID');
  const context={projectId:params.get('projectId'),scope:params.get('scope')};if(!workspaceId(context.projectId)||!/^[a-f0-9]{64}$/.test(context.scope||''))throw new WorkspaceError('PARTICIPANT_INPUT_INVALID');
  if(params.get('detail')==='existing-accounts'){
   if([...params.keys()].some(key=>!['projectId','scope','detail','query','afterAccount','accountId'].includes(key)))throw new WorkspaceError('PARTICIPANT_ACCOUNT_QUERY_INVALID');
   const input={...context,...Object.fromEntries(['query','afterAccount','accountId'].filter(key=>params.has(key)).map(key=>[key,params.get(key)]))};
   participantAccountRequest(input);return reply(await store.accounts(session,input));
  }
  if(['query','afterAccount','accountId'].some(key=>params.has(key)))throw new WorkspaceError('PARTICIPANT_INPUT_INVALID');
  if(params.has('detail')||params.has('action')){
   const checking=params.has('operationId'),keys=checking?['projectId','scope','detail','workerId','operationId','action']:['projectId','scope','detail','workerId'];
   if(params.get('detail')!=='private-bank-account'||params.size!==keys.length||keys.some(key=>!params.has(key))||!workspaceId(params.get('workerId'))||checking&&!operationId(params.get('operationId')))throw new WorkspaceError('PARTICIPANT_INPUT_INVALID');
   const input={...context,workerId:params.get('workerId'),...(checking?{operationId:params.get('operationId').toLowerCase(),action:params.get('action')}:{})};
   return reply(checking?await store.privateBankStatus(session,input):await store.privateBankRead(session,input));
  }
  if(params.has('imageId')||params.has('workerId')){if(params.has('operationId')||params.has('after')||params.size!==4)throw new WorkspaceError('PARTICIPANT_INPUT_INVALID');const value=await store.downloadKyc(session,{...context,workerId:params.get('workerId'),imageId:params.get('imageId')});return new Response(value.bytes,{headers:{...headers,'Content-Type':value.contentType,'Content-Disposition':'attachment; filename="identity-review.'+(value.contentType==='image/png'?'png':value.contentType==='image/webp'?'webp':'jpg')+'"'}});}
  if(params.has('operationId')){if(params.has('after')||params.has('intakeAfter')||!operationId(params.get('operationId')))throw new WorkspaceError('PARTICIPANT_INPUT_INVALID');return reply(await store.status(session,{...context,operationId:params.get('operationId')}));}
  if(params.has('intakeAfter')&&!/^customer_webhook_[a-f0-9]{64}$/.test(params.get('intakeAfter')))throw new WorkspaceError('PARTICIPANT_INPUT_INVALID');
  return reply(await store.read(session,{...context,after:params.get('after'),...(params.has('intakeAfter')?{intakeAfter:params.get('intakeAfter')}:{})}));
 }catch(error){const known=error instanceof WorkspaceError||error instanceof PrivateImageError;return reply({saved:false,identityCertified:false,code:known?error.code:'PARTICIPANT_OPERATION_UNCONFIRMED'},error instanceof WorkspaceError?error.status:error instanceof PrivateImageError?(error.code==='PRIVATE_IMAGE_TOO_LARGE'?413:400):503);}}
 return {GET:handle,POST:handle};
}
