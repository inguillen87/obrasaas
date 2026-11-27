import {WorkspaceError,workspaceId,operationId,requireWorkspaceIdentity} from './workspace-policy.mjs';
import {boundedBody} from './workspace-http.mjs';
const headers={'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie, Authorization','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'};
export function createCompanyNumberTransferHandlers({verify,store}){
 const reply=(body,status=200)=>Response.json(body,{status,headers});
 async function handle(request){try{
  const session=await verify(request.headers);requireWorkspaceIdentity(session);
  if(request.headers.get('sec-fetch-site')==='cross-site')throw new WorkspaceError('WORKSPACE_ORIGIN_REJECTED',403);
  const query=new URL(request.url).searchParams;
  if(request.method==='POST'){if(query.size||request.headers.get('origin')!=='https://obrasaas.com'||request.headers.has('content-encoding'))throw new WorkspaceError('WORKSPACE_ORIGIN_REJECTED',403);return reply(await store.command(session,await boundedBody(request)));}
  if(request.method!=='GET')return reply({code:'METHOD_NOT_ALLOWED'},405);
  if([...query.keys()].some(key=>!['projectId','scope','transferId','operationId','history'].includes(key)||query.getAll(key).length!==1)||!workspaceId(query.get('projectId'))||!/^[a-f0-9]{64}$/.test(query.get('scope')||'')||query.has('transferId')&&!/^asset_transfer_[a-f0-9]{64}$/.test(query.get('transferId'))||query.has('operationId')&&!operationId(query.get('operationId'))||query.has('history')&&query.get('history')!=='1'||['transferId','operationId','history'].filter(key=>query.has(key)).length>1)throw new WorkspaceError('COMPANY_TRANSFER_INPUT_INVALID',400);
  return reply(await store.read(session,{projectId:query.get('projectId'),scope:query.get('scope'),...(query.has('transferId')?{transferId:query.get('transferId')}:{}),...(query.has('operationId')?{operationId:query.get('operationId')}:{}),...(query.has('history')?{history:true}:{})}));
 }catch(error){return reply({saved:false,code:error instanceof WorkspaceError?error.code:'COMPANY_TRANSFER_UNCONFIRMED'},error instanceof WorkspaceError?error.status:503);}}
 return {GET:handle,POST:handle};
}
