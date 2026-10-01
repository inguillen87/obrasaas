import {WorkspaceError} from './workspace-policy.mjs';
import {boundedBody} from './workspace-http.mjs';
import {requireNewCompanyAdmin,normalizeCompanyOnboarding} from './company-onboarding-policy.mjs';
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie, Authorization','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});
export function createCompanyOnboardingHandlers({verifySession,verifyProfile,store}){
 async function handle(request){
  try{
   const session=await verifySession(request.headers);
   if(!session.authenticated&&['IDENTITY_PROVIDER_UNAVAILABLE','IDENTITY_CONFIGURATION_PENDING'].includes(session.code))throw new WorkspaceError('COMPANY_IDENTITY_PROVIDER_UNAVAILABLE',503);
   requireNewCompanyAdmin(session);
   if(request.headers.get('sec-fetch-site')==='cross-site')throw new WorkspaceError('WORKSPACE_ORIGIN_REJECTED',403);
   const params=new URL(request.url).searchParams;
   if(request.method==='GET'){
    for(const name of params.keys())if(!['expectedClerkOrganizationId','operationId'].includes(name)||params.getAll(name).length!==1)throw new WorkspaceError('COMPANY_ONBOARDING_INPUT_INVALID');
    if(params.get('expectedClerkOrganizationId')!==session.organizationId)throw new WorkspaceError('WORKSPACE_CONTEXT_CHANGED',409);
    return reply(await store.status(session,params.has('operationId')?{operationId:params.get('operationId')}:{}));
   }
   if(request.method!=='POST')return reply({code:'METHOD_NOT_ALLOWED'},405);
   if(params.size||request.headers.get('origin')!=='https://obrasaas.com')throw new WorkspaceError('WORKSPACE_ORIGIN_REJECTED',403);
   const body=await boundedBody(request);normalizeCompanyOnboarding(body,session);
   const profile=await verifyProfile(request.headers.get('x-obrasaas-bootstrap-profile'),session);
   return reply(await store.create(session,body,profile));
  }catch(error){return reply({created:false,code:error instanceof WorkspaceError?error.code:'COMPANY_CREATION_UNCONFIRMED'},error instanceof WorkspaceError?error.status:503);}
 }
 return {GET:handle,POST:handle};
}
