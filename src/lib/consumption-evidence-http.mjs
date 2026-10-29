import {WorkspaceError,workspaceId,requireWorkspaceIdentity} from './workspace-policy.mjs';
import {assertApprovedParticipantKyc} from './participant-approved-identity.mjs';
import {readConsumptionEvidenceCatalog,consumptionEvidencePageShape} from './consumption-evidence-catalog.mjs';

export const consumptionEvidenceHeaders={'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie, Authorization','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'};
const queryInvalid=()=>{throw new WorkspaceError('CONSUMPTION_EVIDENCE_QUERY_INVALID');};
const unavailable=()=>{throw new WorkspaceError('FIELD_EVIDENCE_UNAVAILABLE',404);};
const keys=['projectId','scope','workerId','sectorId','taskId','page','direction','selectedIds'];
function input(value){
 if(!value||Object.keys(value).some(key=>!keys.includes(key))||!['projectId','workerId','sectorId'].every(key=>workspaceId(value[key]))||!/^[a-f0-9]{64}$/.test(value.scope||'')||value.taskId!==null&&!workspaceId(value.taskId))queryInvalid();
 const {projectId,scope,workerId,sectorId,taskId,page=null,direction='FIRST',selectedIds=[]}=value;
 if(!['FIRST','REFRESH','NEXT','PREVIOUS'].includes(direction)||page!==null&&!consumptionEvidencePageShape(page)||direction==='FIRST'&&page!==null||direction!=='FIRST'&&page===null||!Array.isArray(selectedIds)||selectedIds.length>10||new Set(selectedIds).size!==selectedIds.length||selectedIds.some(id=>!workspaceId(id)))queryInvalid();
 return {projectId,scope,workerId,sectorId,taskId,page,direction,selectedIds};
}
export function consumptionEvidenceQuery(params){
 for(const key of params.keys())if(!keys.includes(key)||params.getAll(key).length!==1)queryInvalid();
 if(!['projectId','scope','workerId','sectorId','taskId'].every(key=>params.has(key))||params.has('page')&&(!params.has('direction')||params.get('direction')==='FIRST'))queryInvalid();
 const parse=(key,max,fallback)=>{if(!params.has(key))return fallback;const text=params.get(key);if(!text||text.length>max)queryInvalid();try{return JSON.parse(text);}catch{queryInvalid();}};
 return input({projectId:params.get('projectId'),scope:params.get('scope'),workerId:params.get('workerId'),sectorId:params.get('sectorId'),taskId:params.get('taskId')===''?null:params.get('taskId'),page:parse('page',1200,null),direction:params.has('direction')?params.get('direction'):'FIRST',selectedIds:parse('selectedIds',2000,[])});
}
export function createConsumptionEvidenceCatalog({workspace}){
 if(typeof workspace?.projectOperation!=='function')throw new TypeError('Explicit canonical project reader required');
 return {read(session,value){
  const context=input(value);return workspace.projectOperation(session,context,false,async(client,member,scope,project)=>{
   if(project?.id!==context.projectId||!workspaceId(member?.actorId)||!workspaceId(member.organizationId))unavailable();
   const found=(await client.query(`SELECT id,"projectId",active,metadata FROM public."Worker" WHERE id=$1 AND "projectId"=$2 AND active=true`,[context.workerId,project.id])).rows,row=found[0],p=row?.metadata?.participant;
   if(found.length!==1||row.id!==context.workerId||row.projectId!==project.id||row.active!==true||p?.version!==1||p.status!=='ACTIVE'||p.clerkUserId!==session.userId||p.permissions?.report!==true)unavailable();
   await assertApprovedParticipantKyc(client,row,{...member,clerkUserId:session.userId},{code:'FIELD_KYC_REVIEW_REQUIRED'});
   if(!Array.isArray(project.metadata?.fieldOperations?.sectors)||project.metadata.fieldOperations.sectors.filter(sector=>sector?.id===context.sectorId).length!==1)throw new WorkspaceError('FIELD_SECTOR_UNAVAILABLE',404);
   if(context.taskId!==null){const tasks=(await client.query(`SELECT id FROM public."Task" WHERE id=$1 AND "projectId"=$2`,[context.taskId,project.id])).rows;if(tasks.length!==1||tasks[0].id!==context.taskId)throw new WorkspaceError('WORKSPACE_TASK_UNAVAILABLE',404);}
   const result=await readConsumptionEvidenceCatalog(client,{organizationId:member.organizationId,projectId:project.id,workerId:row.id,actorId:member.actorId,taskId:context.taskId,sectorId:context.sectorId,page:context.page,direction:context.direction,retainedIds:context.selectedIds},{lockRetained:false,includeRetainedProcessing:false,reportUnavailableRetained:true});
   return {projectId:project.id,scope,workerId:row.id,taskId:context.taskId,sectorId:context.sectorId,...result};
  });
 }};
}
const reply=(body,status=200)=>Response.json(body,{status,headers:consumptionEvidenceHeaders});
export function createConsumptionEvidenceHandler({verify,store}){
 if(typeof verify!=='function'||typeof store?.read!=='function')throw new TypeError('Explicit verified identity and canonical evidence reader required');
 return async request=>{try{
  if(request.method!=='GET')return reply({saved:false,code:'METHOD_NOT_ALLOWED'},405);
  const session=await verify(request.headers);
  if(!session?.authenticated&&['IDENTITY_PROVIDER_UNAVAILABLE','IDENTITY_CONFIGURATION_PENDING'].includes(session?.code))throw new WorkspaceError('IDENTITY_PROVIDER_UNAVAILABLE',503);
  requireWorkspaceIdentity(session);
  const url=new URL(request.url),origin=request.headers.get('origin');
  if(request.headers.get('sec-fetch-site')==='cross-site'||origin&&origin!==url.origin)throw new WorkspaceError('WORKSPACE_ORIGIN_REJECTED',403);
  return reply(await store.read(session,consumptionEvidenceQuery(url.searchParams)));
 }catch(error){return reply({saved:false,code:error instanceof WorkspaceError?error.code:'CONSUMPTION_EVIDENCE_UNCONFIRMED'},error instanceof WorkspaceError?error.status:503);}};
}
