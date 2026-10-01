import { WorkspaceError, workspaceId, operationId, requireWorkspaceIdentity } from './workspace-policy.mjs';
const origin = 'https://obrasaas.com';
const headers = { 'Cache-Control':'private, no-store, max-age=0', 'Vary':'Cookie, Authorization', 'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'no-referrer', 'X-Robots-Tag':'noindex, nofollow' };
const reply = (body, status=200) => Response.json(body, {status,headers});
export async function boundedBody(request) {
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json' || request.headers.has('content-encoding')) throw new WorkspaceError('SCHEDULE_INPUT_INVALID');
  const size=request.headers.get('content-length');
  if(size!==null&&(!/^\d+$/.test(size)||Number(size)>32768))throw new WorkspaceError('SCHEDULE_INPUT_INVALID',413);
  if(!request.body)throw new WorkspaceError('SCHEDULE_INPUT_INVALID');
  const reader=request.body.getReader(),parts=[];let length=0;
  try{
    while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>32768)throw new WorkspaceError('SCHEDULE_INPUT_INVALID',413);parts.push(value);}
    const bytes=new Uint8Array(length);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.byteLength;}
    return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  }catch(error){if(error instanceof WorkspaceError)throw error;throw new WorkspaceError('SCHEDULE_INPUT_INVALID');}
  finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
export function createWorkspaceHandlers({verify,store}){
  async function handle(request){
    try{
      const session=await verify(request.headers);
      if(!session.authenticated&&['IDENTITY_CONFIGURATION_PENDING','IDENTITY_PROVIDER_UNAVAILABLE'].includes(session.code))throw new WorkspaceError('IDENTITY_PROVIDER_UNAVAILABLE',503);
      requireWorkspaceIdentity(session);
      if(request.headers.get('sec-fetch-site')==='cross-site')throw new WorkspaceError('WORKSPACE_ORIGIN_REJECTED',403);
      const params=new URL(request.url).searchParams;
      if(request.method==='POST'){
        if(request.headers.get('origin')!==origin||params.size)throw new WorkspaceError('WORKSPACE_ORIGIN_REJECTED',403);
        return reply(await store.schedule(session,await boundedBody(request)));
      }
      if(request.method!=='GET')return reply({code:'METHOD_NOT_ALLOWED'},405);
      for(const key of params.keys())if(!['projectId','scope','afterTask','operationId'].includes(key)||params.getAll(key).length!==1)throw new WorkspaceError('WORKSPACE_QUERY_INVALID');
      if(!params.size)return reply(await store.list(session));
      const projectId=params.get('projectId'),scope=params.get('scope');
      if(!workspaceId(projectId)||!/^[a-f0-9]{64}$/.test(scope||''))throw new WorkspaceError('WORKSPACE_QUERY_INVALID');
      if(params.has('operationId')){
        if(params.has('afterTask')||!operationId(params.get('operationId')))throw new WorkspaceError('WORKSPACE_QUERY_INVALID');
        return reply(await store.status(session,{projectId,scope,operationId:params.get('operationId')}));
      }
      return reply(await store.read(session,{projectId,scope,afterTask:params.get('afterTask')}));
    }catch(error){return reply({code:error instanceof WorkspaceError?error.code:'WORKSPACE_OPERATION_UNCONFIRMED',saved:false},error instanceof WorkspaceError?error.status:503);}
  }
  return {GET:handle,POST:handle};
}
