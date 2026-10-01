import { WorkspaceError, workspaceId, requireWorkspaceIdentity, digest } from './workspace-policy.mjs';
import { boundedBody } from './workspace-http.mjs';
import { boundedFieldMultipart } from './field-media.mjs';
import { canApproveProgress } from './field-operations-policy.mjs';
export const fieldHeaders={'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie, Authorization','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'};
const reply=(body,status=200)=>Response.json(body,{status,headers:fieldHeaders});
async function identity(request,verify) {
  const session=await verify(request.headers);
  if(!session.authenticated&&['IDENTITY_PROVIDER_UNAVAILABLE','IDENTITY_CONFIGURATION_PENDING','IDENTITY_CONFIGURATION_PENDING'].includes(session.code))throw new WorkspaceError('IDENTITY_PROVIDER_UNAVAILABLE',503);
  requireWorkspaceIdentity(session);
  if(request.headers.get('sec-fetch-site')==='cross-site'||(request.method==='POST'&&request.headers.get('origin')!=='https://obrasaas.com'))throw new WorkspaceError('WORKSPACE_ORIGIN_REJECTED',403);
  return session;
}
function context(params,extra=[]) {
  for(const key of params.keys())if(!['projectId','scope',...extra].includes(key)||params.getAll(key).length!==1)throw new WorkspaceError('FIELD_QUERY_INVALID');
  const input={projectId:params.get('projectId'),scope:params.get('scope')};
  if(!workspaceId(input.projectId)||!/^[a-f0-9]{64}$/.test(input.scope||''))throw new WorkspaceError('FIELD_QUERY_INVALID');return input;
}
const failed=error=>reply({saved:false,code:error instanceof WorkspaceError?error.code:'FIELD_OPERATION_UNCONFIRMED'},error instanceof WorkspaceError?error.status:503);
export function createFieldHandlers({verify,operations}) {
  const handle=async request=>{try{
    const session=await identity(request,verify),params=new URL(request.url).searchParams;
    if(request.method==='POST'){if(params.size)throw new WorkspaceError('FIELD_QUERY_INVALID');return reply(await operations.save(session,await boundedBody(request)));}
    if(request.method!=='GET')return reply({code:'METHOD_NOT_ALLOWED'},405);
    const input=context(params,['operationId']);return reply(params.has('operationId')?await operations.status(session,{...input,operationId:params.get('operationId')}):await operations.read(session,input));
  }catch(error){return failed(error);}};
  return {GET:handle,POST:handle};
}
export function createFieldMediaHandlers({verify,media}) {
  const handle=async request=>{try{
    const session=await identity(request,verify),params=new URL(request.url).searchParams;
    if(request.method==='POST'){
      if(params.size)throw new WorkspaceError('FIELD_QUERY_INVALID');
      return reply(request.headers.get('content-type')?.startsWith('multipart/form-data;')?await media.attach(session,await boundedFieldMultipart(request)):await media.process(session,await boundedBody(request)));
    }
    if(request.method!=='GET')return reply({code:'METHOD_NOT_ALLOWED'},405);
    const input=context(params,['operationId','evidenceId']);
    if(params.has('operationId')){if(params.has('evidenceId'))throw new WorkspaceError('FIELD_QUERY_INVALID');return reply(await media.status(session,{...input,operationId:params.get('operationId')}));}
    const file=await media.download(session,{...input,evidenceId:params.get('evidenceId')});
    return new Response(file.bytes,{headers:{...fieldHeaders,'Content-Type':file.contentType,'Content-Length':String(file.bytes.length),'Content-Disposition':`attachment; filename="evidencia.${file.extension}"`,'Content-Security-Policy':"default-src 'none'; sandbox"}});
  }catch(error){return failed(error);}};
  return {GET:handle,POST:handle};
}
export function createFieldQrHandler({verify,workspace,toSvg}) {
  return async request=>{try{
    const session=await identity(request,verify),params=new URL(request.url).searchParams,input=context(params,['sectorId','token']);
    if(!workspaceId(params.get('sectorId'))||!/^[a-f0-9]{64}$/.test(params.get('token')||''))throw new WorkspaceError('FIELD_QR_INVALID');
    await workspace.projectOperation(session,input,false,async(client,member,scope,project)=>{
      if(!canApproveProgress(member.role))throw new WorkspaceError('FIELD_PERMISSION_REQUIRED',403);
      const c=project.metadata?.fieldOperations,sector=c?.sectors?.find(s=>s.id===params.get('sectorId'));
      if(!sector||digest([input.projectId,sector.id,c.configRevision,params.get('token')])!==sector.qrHash)throw new WorkspaceError('FIELD_QR_INVALID',422);
    });
    const payload=JSON.stringify({version:1,projectId:input.projectId,sectorId:params.get('sectorId'),token:params.get('token')});
    const svg=await toSvg(payload);
    return new Response(svg,{headers:{...fieldHeaders,'Content-Type':'image/svg+xml','Content-Disposition':'attachment; filename="qr-sector.svg"','Content-Security-Policy':"default-src 'none'; sandbox"}});
  }catch(error){return failed(error);}};
}
