import {WorkspaceError,workspaceId,requireWorkspaceIdentity} from './workspace-policy.mjs';
import {boundedBody} from './workspace-http.mjs';
const headers={'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie, Authorization','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'};
export function createOfficeChatHandlers({verify,store}){
 const response=(value,status=200)=>Response.json(value,{status,headers});
 async function handle(request){try{
  const session=await verify(request.headers);requireWorkspaceIdentity(session);
  if(request.headers.get('sec-fetch-site')==='cross-site')throw new WorkspaceError('WORKSPACE_ORIGIN_REJECTED',403);
  const params=new URL(request.url).searchParams;
  if(request.method==='POST'){
   if(params.size||request.headers.get('origin')!=='https://obrasaas.com'||request.headers.has('content-encoding'))throw new WorkspaceError('WORKSPACE_ORIGIN_REJECTED',403);
   return response(await store.command(session,await boundedBody(request)));
  }
  if(request.method!=='GET')return response({code:'METHOD_NOT_ALLOWED'},405);
  if(params.size!==2||[...params.keys()].some(k=>!['projectId','scope'].includes(k)||params.getAll(k).length!==1)||!workspaceId(params.get('projectId'))||!/^[a-f0-9]{64}$/.test(params.get('scope')||''))throw new WorkspaceError('OFFICE_CHAT_INPUT_INVALID');
  return response(await store.read(session,{projectId:params.get('projectId'),scope:params.get('scope')}));
 }catch(error){return response({saved:false,code:error instanceof WorkspaceError?error.code:'OFFICE_CHAT_UNCONFIRMED'},error instanceof WorkspaceError?error.status:503);}}
 return {GET:handle,POST:handle};
}
