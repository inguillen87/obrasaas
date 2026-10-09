import {WorkspaceError,requireWorkspaceIdentity,workspaceId,operationId} from './workspace-policy.mjs';
import {boundedBody} from './workspace-http.mjs';
const headers={'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie, Authorization','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'};
export function createCompanyChannelHandlers({verify,store}){
 const reply=(body,status=200)=>Response.json(body,{status,headers});
 async function handle(request){try{
  const session=await verify(request.headers);requireWorkspaceIdentity(session);
  if(request.headers.get('sec-fetch-site')==='cross-site')throw new WorkspaceError('WORKSPACE_ORIGIN_REJECTED',403);
  const params=new URL(request.url).searchParams;
  if(request.method==='POST'){if(params.size||request.headers.get('origin')!=='https://obrasaas.com'||request.headers.has('content-encoding'))throw new WorkspaceError('WORKSPACE_ORIGIN_REJECTED',403);return reply(await store.command(session,await boundedBody(request)));}
  if(request.method!=='GET')return reply({code:'METHOD_NOT_ALLOWED'},405);
   if(![2,3].includes(params.size)||[...params.keys()].some(key=>!['projectId','scope','operationId','discovery'].includes(key)||params.getAll(key).length!==1)||!workspaceId(params.get('projectId'))||!/^[a-f0-9]{64}$/.test(params.get('scope')||'')||params.has('operationId')&&!operationId(params.get('operationId'))||params.has('discovery')&&(params.get('discovery')!=='OWN_NUMBER'||params.has('operationId')))throw new WorkspaceError('COMPANY_CHANNEL_INPUT_INVALID');
   return reply(await store.read(session,{projectId:params.get('projectId'),scope:params.get('scope'),...(params.has('operationId')?{operationId:params.get('operationId').toLowerCase()}: {}),...(params.has('discovery')?{discovery:'OWN_NUMBER'}:{})}));
 }catch(error){return reply({saved:false,code:error instanceof WorkspaceError?error.code:'COMPANY_CHANNEL_OPERATION_UNCONFIRMED'},error instanceof WorkspaceError?error.status:503);}}
 return {GET:handle,POST:handle};
}
