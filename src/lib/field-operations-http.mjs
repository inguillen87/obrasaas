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
    const input=context(params,['operationId','proposalId']);
    if(params.has('proposalId')){
      if(params.has('operationId')||!workspaceId(params.get('proposalId')))throw new WorkspaceError('FIELD_QUERY_INVALID');
      return reply(await operations.proposalEvidence(session,{...input,proposalId:params.get('proposalId')}));
    }
    return reply(params.has('operationId')?await operations.status(session,{...input,operationId:params.get('operationId')}):await operations.read(session,input));
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
async function currentConfigurationQrToken(client,member,projectId,configuration,sectorId) {
  const unavailable=()=>{throw new WorkspaceError('FIELD_QR_RECEIPT_UNAVAILABLE',409);};
  const c=configuration;
  if(c?.version!==1||!workspaceId(c.configRevision)||!workspaceId(c.configuredBy)||
    typeof c.configuredAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(c.configuredAt)||
    !Number.isFinite(Date.parse(c.configuredAt))||new Date(c.configuredAt).toISOString()!==c.configuredAt||
    !Array.isArray(c.sectors)||!c.sectors.length||c.sectors.length>20||
    c.sectors.some(s=>!workspaceId(s?.id)||!/^[a-f0-9]{64}$/.test(s.qrHash||''))||
    new Set(c.sectors.map(s=>s.id)).size!==c.sectors.length)unavailable();
  // Configuration and its receipt were committed together. Match its exact
  // author/time in this authorized read-only project snapshot, rather than
  // scanning a recent-history window or falling back to an older token.
  const rows=(await client.query(`SELECT id,"organizationId","actorId",action,"entityType","entityId",metadata
    FROM public."AuditLog" WHERE "organizationId"=$1 AND "entityId"=$2 AND "actorId"=$3
      AND action='field.operation.recorded' AND "entityType"='Project'
      AND metadata->>'version'='1' AND metadata->>'projectId'=$2 AND metadata->>'command'='CONFIGURE_SITE'
      AND metadata->'outcome'->>'kind'='CONFIGURATION' AND metadata->'outcome'->>'recordedAt'=$4
    LIMIT 3`,[member.organizationId,projectId,c.configuredBy,c.configuredAt])).rows;
  // Two configurations can share the same millisecond. Hashes distinguish them;
  // a third row is a sentinel: uniqueness beyond this bound cannot be proven.
  if(!rows.length||rows.length>2)unavailable();
  const matches=[];
  for(const row of rows) {
    const m=row.metadata,tokens=m?.outcome?.qrTokens;
    if(!/^field_[a-f0-9]{64}$/.test(row.id||'')||row.organizationId!==member.organizationId||
      row.actorId!==c.configuredBy||row.action!=='field.operation.recorded'||row.entityType!=='Project'||row.entityId!==projectId||
      m?.version!==1||m.projectId!==projectId||m.command!=='CONFIGURE_SITE'||!/^[a-f0-9]{64}$/.test(m.requestDigest||'')||
      m.outcome?.kind!=='CONFIGURATION'||m.outcome.recordedAt!==c.configuredAt||
      !Array.isArray(tokens)||!tokens.length||tokens.length>20||
      tokens.some(t=>!t||Object.keys(t).sort().join('|')!=='sectorId|token'||!workspaceId(t.sectorId)||!/^[a-f0-9]{64}$/.test(t.token||''))||
      new Set(tokens.map(t=>t.sectorId)).size!==tokens.length)unavailable();
    if(tokens.length===c.sectors.length&&tokens.every(token=>{
      const sector=c.sectors.find(s=>s.id===token.sectorId);
      return sector&&digest([projectId,sector.id,c.configRevision,token.token])===sector.qrHash;
    }))matches.push(tokens);
  }
  if(matches.length!==1)unavailable();
  const token=matches[0].find(t=>t.sectorId===sectorId);
  if(!token)unavailable();
  return token.token;
}
export function createFieldQrHandler({verify,workspace,toSvg}) {
  return async request=>{try{
    const session=await identity(request,verify),params=new URL(request.url).searchParams,input=context(params,['sectorId','token','expectedConfigRevision']);
    if(request.method!=='GET')return reply({code:'METHOD_NOT_ALLOWED'},405);
    if(!workspaceId(params.get('sectorId'))||(params.has('token')&&!/^[a-f0-9]{64}$/.test(params.get('token')||'')))throw new WorkspaceError('FIELD_QR_INVALID');
    if(params.has('token')?params.has('expectedConfigRevision'):!workspaceId(params.get('expectedConfigRevision')))throw new WorkspaceError('FIELD_QUERY_INVALID');
    const token=await workspace.projectOperation(session,input,false,async(client,member,scope,project)=>{
      if(!canApproveProgress(member.role))throw new WorkspaceError('FIELD_PERMISSION_REQUIRED',403);
      const c=project.metadata?.fieldOperations;
      if(!params.has('token')&&params.get('expectedConfigRevision')!==c?.configRevision)throw new WorkspaceError('FIELD_REVISION_CHANGED',409);
      const sector=Array.isArray(c?.sectors)?c.sectors.find(s=>s.id===params.get('sectorId')):null;
      if(!sector)throw new WorkspaceError('FIELD_QR_INVALID',422);
      const selected=params.has('token')?params.get('token'):await currentConfigurationQrToken(client,member,input.projectId,c,sector.id);
      if(digest([input.projectId,sector.id,c.configRevision,selected])!==sector.qrHash)throw new WorkspaceError('FIELD_QR_INVALID',422);
      return selected;
    });
    const payload=JSON.stringify({version:1,projectId:input.projectId,sectorId:params.get('sectorId'),token});
    const svg=await toSvg(payload);
    return new Response(svg,{headers:{...fieldHeaders,'Content-Type':'image/svg+xml','Content-Disposition':'attachment; filename="qr-sector.svg"','Content-Security-Policy':"default-src 'none'; sandbox"}});
  }catch(error){return failed(error);}};
}
