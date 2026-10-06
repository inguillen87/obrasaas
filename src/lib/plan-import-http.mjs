import {WorkspaceError,requireWorkspaceIdentity,workspaceId,operationId} from './workspace-policy.mjs';
import {planContext,boundedPlanMultipart,planImportSourceRejection} from './plan-import-policy.mjs';
const headers={'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie, Authorization','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'};
const reply=(body,status=200)=>Response.json(body,{status,headers});
async function boundedDecision(request) {
 const length=request.headers.get('content-length'),limit=256*1024;
 if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json'||request.headers.has('content-encoding'))throw new WorkspaceError('PLAN_IMPORT_INPUT_INVALID');
 if(length!==null&&(!/^\d+$/.test(length)||Number(length)>limit))throw new WorkspaceError('PLAN_IMPORT_INPUT_INVALID',413);
 const reader=request.body?.getReader();if(!reader)throw new WorkspaceError('PLAN_IMPORT_INPUT_INVALID');let size=0;const chunks=[];
 try{while(true){const item=await reader.read();if(item.done)break;size+=item.value.byteLength;if(size>limit)throw new WorkspaceError('PLAN_IMPORT_INPUT_INVALID',413);chunks.push(Buffer.from(item.value));}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));}
 catch(error){if(error instanceof WorkspaceError)throw error;throw new WorkspaceError('PLAN_IMPORT_INPUT_INVALID');}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
export function createPlanImportHandlers({verify,imports}) {
 const handle=async request=>{try {
  const session=await verify(request.headers);if(!session.authenticated&&['IDENTITY_CONFIGURATION_PENDING','IDENTITY_PROVIDER_UNAVAILABLE'].includes(session.code))throw new WorkspaceError('IDENTITY_PROVIDER_UNAVAILABLE',503);requireWorkspaceIdentity(session);
  if(request.headers.get('sec-fetch-site')==='cross-site'||request.method==='POST'&&request.headers.get('origin')!=='https://obrasaas.com')throw new WorkspaceError('WORKSPACE_ORIGIN_REJECTED',403);
  const params=new URL(request.url).searchParams;
  if(request.method==='POST'){if(params.size)throw new WorkspaceError('PLAN_IMPORT_INPUT_INVALID');return reply(request.headers.get('content-type')?.startsWith('multipart/form-data;')?await imports.attach(session,await boundedPlanMultipart(request)):await imports.decide(session,await boundedDecision(request)));}
  if(request.method!=='GET')return reply({code:'METHOD_NOT_ALLOWED'},405);
  for(const key of params.keys())if(!['projectId','scope','draftId','operationId','source'].includes(key)||params.getAll(key).length!==1)throw new WorkspaceError('PLAN_IMPORT_INPUT_INVALID');
  const context=planContext(Object.fromEntries(params));
  if(params.has('draftId')){if(!workspaceId(params.get('draftId'))||params.has('operationId'))throw new WorkspaceError('PLAN_IMPORT_INPUT_INVALID');context.draftId=params.get('draftId');}
  if(params.has('operationId')){if(!operationId(params.get('operationId'))||params.has('source'))throw new WorkspaceError('PLAN_IMPORT_INPUT_INVALID');context.operationId=params.get('operationId');}
  if(params.has('source')){if(params.get('source')!=='1'||!context.draftId)throw new WorkspaceError('PLAN_IMPORT_INPUT_INVALID');const file=await imports.source(session,context);return new Response(file.bytes,{headers:{...headers,'Content-Type':file.contentType,'Content-Disposition':`attachment; filename="cronograma.${file.extension}"`,'Content-Length':String(file.bytes.length)}});}
  return reply(await imports.read(session,context));
 }catch(error){const rejection=request.method==='POST'&&planImportSourceRejection(error);return reply({saved:false,code:error instanceof WorkspaceError?error.code:'PLAN_IMPORT_UNCONFIRMED',...(rejection?{...rejection,state:'REJECTED',definitive:true,reservationStarted:false,phase:'PRE_RESERVATION'}:{})},error instanceof WorkspaceError?error.status:503);}};
 return {GET:handle,POST:handle};
}
