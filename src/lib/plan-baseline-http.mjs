import {WorkspaceError,requireWorkspaceIdentity} from './workspace-policy.mjs';
import {planBaselineContext} from './plan-baseline-policy.mjs';
const headers={'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie, Authorization','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'};
const reply=(value,status=200)=>Response.json(value,{status,headers});
async function command(request){
 const limit=4096,length=request.headers.get('content-length');
 if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json'||request.headers.has('content-encoding'))throw new WorkspaceError('PLAN_BASELINE_INPUT_INVALID');
 if(length!==null&&(!/^\d+$/.test(length)||Number(length)>limit))throw new WorkspaceError('PLAN_BASELINE_INPUT_INVALID',413);
 const reader=request.body?.getReader();if(!reader)throw new WorkspaceError('PLAN_BASELINE_INPUT_INVALID');let size=0;const chunks=[];
 try{while(true){const item=await reader.read();if(item.done)break;size+=item.value.byteLength;if(size>limit)throw new WorkspaceError('PLAN_BASELINE_INPUT_INVALID',413);chunks.push(Buffer.from(item.value));}return JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(Buffer.concat(chunks)));}
 catch(error){if(error instanceof WorkspaceError)throw error;throw new WorkspaceError('PLAN_BASELINE_INPUT_INVALID');}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
export function createPlanBaselineHandlers({verify,baselines}){
 if(typeof verify!=='function'||typeof baselines?.read!=='function'||typeof baselines?.select!=='function')throw new TypeError('Explicit baseline adapters required');
 const handle=async request=>{try{
  const session=await verify(request.headers);if(!session.authenticated&&['IDENTITY_CONFIGURATION_PENDING','IDENTITY_PROVIDER_UNAVAILABLE'].includes(session.code))throw new WorkspaceError('IDENTITY_PROVIDER_UNAVAILABLE',503);requireWorkspaceIdentity(session);
  if(request.headers.get('sec-fetch-site')==='cross-site'||request.method==='POST'&&request.headers.get('origin')!=='https://obrasaas.com')throw new WorkspaceError('WORKSPACE_ORIGIN_REJECTED',403);
  const params=new URL(request.url).searchParams;
  if(request.method==='POST'){if(params.size)throw new WorkspaceError('PLAN_BASELINE_INPUT_INVALID');return reply(await baselines.select(session,await command(request)));}
  if(request.method!=='GET')return reply({saved:false,code:'METHOD_NOT_ALLOWED'},405);
  for(const key of params.keys())if(!['scope','projectId','operationId','cursor'].includes(key)||params.getAll(key).length!==1)throw new WorkspaceError('PLAN_BASELINE_INPUT_INVALID');
  const context=Object.fromEntries(params);planBaselineContext(context);return reply(await baselines.read(session,context));
 }catch(error){return reply({saved:false,code:error instanceof WorkspaceError?error.code:'PLAN_BASELINE_UNCONFIRMED'},error instanceof WorkspaceError?error.status:503);}};
 return {GET:handle,POST:handle};
}
