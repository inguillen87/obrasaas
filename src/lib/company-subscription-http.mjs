import {WorkspaceError,operationId,requireWorkspaceIdentity} from './workspace-policy.mjs';
import {boundedBody} from './workspace-http.mjs';

const headers=Object.freeze({'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie, Authorization','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow, noarchive'});
const reply=(body,status=200)=>Response.json(body,{status,headers});
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const exact=(value,keys)=>record(value)&&Object.keys(value).sort().join('|')===[...keys].sort().join('|');
const invalid=()=>{throw new WorkspaceError('COMPANY_SUBSCRIPTION_INPUT_INVALID');};
async function body(request){
  try{return await boundedBody(request);}catch(error){
    if(error instanceof WorkspaceError)throw new WorkspaceError('COMPANY_SUBSCRIPTION_INPUT_INVALID',error.status);
    throw error;
  }
}
function queryContext(request){
  const params=new URL(request.url).searchParams;
  for(const key of params.keys())if(!['scope','operationId'].includes(key)||params.getAll(key).length!==1)invalid();
  const scope=params.get('scope');
  if(!/^[a-f0-9]{64}$/.test(scope||'')||params.has('operationId')&&!operationId(params.get('operationId')))invalid();
  return {scope,...(params.has('operationId')?{operationId:params.get('operationId').toLowerCase()}:{})};
}
export function createCompanySubscriptionHandlers({verifySession,store}){
  if(typeof verifySession!=='function'||!store)throw new TypeError('Explicit company subscription composition required');
  async function handle(request){
    try{
      if(!['GET','POST'].includes(request.method))return reply({code:'METHOD_NOT_ALLOWED'},405);
      const session=await verifySession(request.headers);
      if(!session?.authenticated&&['IDENTITY_PROVIDER_UNAVAILABLE','IDENTITY_CONFIGURATION_PENDING'].includes(session?.code))throw new WorkspaceError('IDENTITY_PROVIDER_UNAVAILABLE',503);
      requireWorkspaceIdentity(session);
      if(request.headers.get('sec-fetch-site')==='cross-site')throw new WorkspaceError('WORKSPACE_ORIGIN_REJECTED',403);
      if(request.method==='GET')return reply(await store.read(session,queryContext(request)));
      if(request.headers.get('origin')!=='https://obrasaas.com'||new URL(request.url).searchParams.size)throw new WorkspaceError('WORKSPACE_ORIGIN_REJECTED',403);
      const value=await body(request);
      if(!record(value)||!/^[a-f0-9]{64}$/.test(value.scope||'')||!operationId(value.operationId))invalid();
      let command;
      if(value.action==='begin'){
        if(!exact(value,['action','scope','operationId','offerId','catalogVersion']))invalid();
        command={scope:value.scope,operationId:value.operationId,offerId:value.offerId,catalogVersion:value.catalogVersion};
        return reply(await store.begin(session,command));
      }
      if(value.action==='recover'){
        if(!exact(value,['action','scope','operationId']))invalid();
        return reply(await store.recover(session,{scope:value.scope,operationId:value.operationId}));
      }
      if(value.action==='cancel_renewal'){
        if(!exact(value,['action','scope','operationId','subscriptionAttemptId']))invalid();
        return reply(await store.cancelAtPeriodEnd(session,{scope:value.scope,operationId:value.operationId,subscriptionAttemptId:value.subscriptionAttemptId}));
      }
      invalid();
    }catch(error){
      if(!(error instanceof WorkspaceError))console.error('COMPANY_SUBSCRIPTION_REQUEST_UNCONFIRMED');
      return reply({code:error instanceof WorkspaceError?error.code:'COMPANY_SUBSCRIPTION_UNCONFIRMED'},error instanceof WorkspaceError?error.status:503);
    }
  }
  return {GET:handle,POST:handle};
}

export function createCompanySubscriptionWebhookHandlers({provider,store}){
  if(!provider||!store)throw new TypeError('Explicit subscription notification composition required');
  async function handle(request){
    try{
      if(request.method!=='POST')return reply({code:'METHOD_NOT_ALLOWED'},405);
      // Only the server-side provider verifier can create a trusted event. A
      // request body, customer session or success URL cannot grant that proof.
      const event=await provider.verifyNotification({headers:request.headers,url:request.url,body:await body(request)});
      if(!provider.isVerifiedEvent(event))throw new WorkspaceError('COMPANY_SUBSCRIPTION_NOTIFICATION_REJECTED',401);
      return reply(await store.processVerifiedEvent(event));
    }catch(error){
      if(!(error instanceof WorkspaceError))console.error('COMPANY_SUBSCRIPTION_NOTIFICATION_UNCONFIRMED');
      return reply({code:error instanceof WorkspaceError?error.code:'COMPANY_SUBSCRIPTION_NOTIFICATION_UNCONFIRMED'},error instanceof WorkspaceError?error.status:503);
    }
  }
  return {GET:handle,POST:handle};
}
