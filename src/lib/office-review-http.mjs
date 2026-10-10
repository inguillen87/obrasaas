import {WorkspaceError,operationId,requireWorkspaceIdentity} from './workspace-policy.mjs';
import {boundedBody} from './workspace-http.mjs';
import {officeKeys,officeContext,officeInvitationId} from './office-review-policy.mjs';
const headers={'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie, Authorization','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'};
const reply=(value,status=200)=>Response.json(value,{status,headers});
export function createOfficeReviewHandlers({verify,store,join=false}){
 async function handle(request){try{
  const session=await verify(request.headers);if(!session.authenticated&&['IDENTITY_CONFIGURATION_PENDING','IDENTITY_PROVIDER_UNAVAILABLE'].includes(session.code))throw new WorkspaceError('IDENTITY_PROVIDER_UNAVAILABLE',503);requireWorkspaceIdentity(session);
  if(request.headers.get('sec-fetch-site')==='cross-site')throw new WorkspaceError('WORKSPACE_ORIGIN_REJECTED',403);
  const params=new URL(request.url).searchParams;
  if(request.method==='POST'){
   if(request.headers.get('origin')!=='https://obrasaas.com'||params.size)throw new WorkspaceError('WORKSPACE_ORIGIN_REJECTED',403);
   const body=await boundedBody(request);
   if(join)return reply(await store.join(session,body,{accept:true}));
   if(body.action==='RECOVER_INVITATION'){officeKeys(body,['action','projectId','scope','operationId','invitationId']);const {action:_action,...input}=body;return reply(await store.reconcile(session,input));}
   return reply(await store.command(session,body));
  }
  if(request.method!=='GET')return reply({code:'METHOD_NOT_ALLOWED'},405);
  if(join){if(params.size!==1||params.getAll('invitationId').length!==1||!officeInvitationId(params.get('invitationId')))throw new WorkspaceError('OFFICE_REVIEW_INPUT_INVALID');return reply(await store.join(session,{invitationId:params.get('invitationId')}));}
  for(const key of params.keys())if(!['projectId','scope','operationId','view'].includes(key)||params.getAll(key).length!==1)throw new WorkspaceError('OFFICE_REVIEW_INPUT_INVALID');
  const input={projectId:params.get('projectId'),scope:params.get('scope')};officeContext(input);
  if(params.has('operationId')){if(params.has('view')||params.size!==3||!operationId(params.get('operationId')))throw new WorkspaceError('OFFICE_REVIEW_INPUT_INVALID');return reply(await store.status(session,{...input,operationId:params.get('operationId').toLowerCase()}));}
  if(params.has('view')&&params.get('view')!=='review')throw new WorkspaceError('OFFICE_REVIEW_INPUT_INVALID');
  return reply(await (params.has('view')?store.review:store.read)(session,input));
 }catch(error){return reply({code:error instanceof WorkspaceError?error.code:'OFFICE_REVIEW_OPERATION_UNCONFIRMED',saved:false},error instanceof WorkspaceError?error.status:503);}}
 return {GET:handle,POST:handle};
}
