import { randomUUID } from 'node:crypto';
import { WorkspaceError, workspaceId, operationId } from './workspace-policy.mjs';
import { SITE_ROLES, MATERIAL_UNITS, normalizeSiteCommand, siteOperationId, siteCommandDigest, cleanMetadata, siteTransition } from './site-register-policy.mjs';
const revision = column => `to_char(${column},'YYYY-MM-DD"T"HH24:MI:SS.US')`;
const workerSelect = `id,name,phone,role,active,metadata,${revision('"updatedAt"')} AS revision`;
const reportSelect = `id,title,description,severity::text AS severity,status,metadata,${revision('"updatedAt"')} AS revision,${revision('"createdAt"')} AS "createdAt"`;
const recordId = prefix => prefix + '_' + randomUUID().replaceAll('-', '');
function publicWorker(row) {
  return { id:row.id, name:row.name, phone:row.phone, job:row.metadata?.siteRegister?.job || null,
    roleLabel:row.role || null, active:row.active, revision:row.revision,
    editable:row.metadata?.siteRegister?.version===1, identityVerified:false, whatsappAccessGranted:false, loginAccessGranted:false };
}
export function publicSiteReport(row) {
  const details = row.metadata?.siteRegister;
  if (!details || details.version !== 1) throw new WorkspaceError('SITE_RECORD_NOT_SUPPORTED',409);
  return { id:row.id,title:row.title,details:row.description,severity:row.severity,state:details.state,
    type:details.type,sector:details.sector,material:details.material || null,quantity:details.quantity || null,
    unit:details.unit || null,photos:Array.isArray(details.photos)?details.photos.map(photo=>({id:photo.id,contentType:photo.contentType,bytes:photo.bytes})):[],revision:row.revision,createdAt:row.createdAt,
    workerId:details.workerId||null,taskId:details.taskId||null,evidenceIds:details.evidenceIds||[],
    review:details.review ? {decision:details.review.decision,reason:details.review.reason,recordedAt:details.review.recordedAt}:null };
}
const publicReport=publicSiteReport;
// Both office entry and participant self-service use the same worksite register.
export async function insertSiteReport(client,{id,projectId,actorId,type,title,description,severity,sector,material=null,quantity=null,unit=null,origin='responsible-entry',workerId=null,taskId=null,evidenceIds=[]}) {
  const metadata={siteRegister:{version:1,type,state:'OPEN',sector,submittedBy:actorId,
    ...(type==='MATERIAL_REQUEST'?{material,quantity,unit,purchaseAuthorized:false,stockChanged:false}:{}),
    ...(workerId?{workerId,taskId,evidenceIds}:{}),source:origin}};
  await client.query(`INSERT INTO public."Incident"(id,"projectId",title,description,severity,status,reporter,metadata,"updatedAt") VALUES($1,$2,$3,$4,$5::"IncidentSeverity",'open',$6,$7::jsonb,clock_timestamp())`,[id,projectId,title,description,severity,actorId,JSON.stringify(metadata)]);
  return (await client.query(`SELECT ${reportSelect} FROM public."Incident" WHERE id=$1 AND "projectId"=$2`,[id,projectId])).rows[0];
}
export function createSiteRegister({ workspace }) {
  const run = (session, context, writable, callback) => workspace.integrationProject(session, context, writable, callback);
  const readWorker = async (client, projectId, id, lock=false) => {
    const rows=await client.query(`SELECT ${workerSelect} FROM public."Worker" WHERE id=$1 AND "projectId"=$2 ${lock?'FOR UPDATE':''}`,[id,projectId]);
    if(rows.rows.length!==1)throw new WorkspaceError('SITE_PERSON_UNAVAILABLE',404);return rows.rows[0];
  };
  const readReport = async (client, projectId, id, lock=false) => {
    const rows=await client.query(`SELECT ${reportSelect} FROM public."Incident" WHERE id=$1 AND "projectId"=$2 ${lock?'FOR UPDATE':''}`,[id,projectId]);
    if(rows.rows.length!==1)throw new WorkspaceError('SITE_REPORT_UNAVAILABLE',404);return rows.rows[0];
  };
  const findReceipt = async (client, member, id) => (await client.query(`SELECT id,metadata FROM public."AuditLog"
    WHERE id=$1 AND "organizationId"=$2 AND "actorId"=$3 AND action='site.register.changed'`,[id,member.organizationId,member.actorId])).rows[0];
  async function outcome(client,projectId,receipt,replayed) {
    const meta=receipt.metadata;if(meta?.projectId!==projectId)throw new WorkspaceError('SITE_RECEIPT_INTEGRITY',409);
    const result={saved:true,replayed,receiptId:receipt.id,kind:meta.kind};
    if(meta.kind==='PERSON')result.person=publicWorker(await readWorker(client,projectId,meta.entityId));
    else if(meta.kind==='REPORT')result.report=publicReport(await readReport(client,projectId,meta.entityId));
    else throw new WorkspaceError('SITE_RECEIPT_INTEGRITY',409);
    return result;
  }
  return {
    read(session,context) {
      const {section,after=null}=context;
      if(!['PEOPLE','ISSUES','MATERIALS'].includes(section)||(after!==null&&!workspaceId(after)))throw new WorkspaceError('SITE_QUERY_INVALID');
      return run(session,context,false,async(client,member,scope)=>{
        let rows,total;
        if(section==='PEOPLE') {
          rows=(await client.query(`SELECT ${workerSelect} FROM public."Worker" WHERE "projectId"=$1 AND ($2::text IS NULL OR id>$2) ORDER BY id LIMIT 101`,[context.projectId,after])).rows.map(publicWorker);
          total=(await client.query('SELECT count(*)::int AS n FROM public."Worker" WHERE "projectId"=$1',[context.projectId])).rows[0].n;
        }else{
          const type=section==='ISSUES'?'ISSUE':'MATERIAL_REQUEST';
          rows=(await client.query(`SELECT ${reportSelect} FROM public."Incident" WHERE "projectId"=$1 AND metadata->'siteRegister'->>'type'=$2 AND ($3::text IS NULL OR id>$3) ORDER BY id LIMIT 101`,[context.projectId,type,after])).rows.map(publicReport);
          total=(await client.query(`SELECT count(*)::int AS n FROM public."Incident" WHERE "projectId"=$1 AND metadata->'siteRegister'->>'type'=$2`,[context.projectId,type])).rows[0].n;
        }
        return {scope,projectId:context.projectId,section,records:rows.slice(0,100),total,nextCursor:rows.length>100?rows[99].id:null,
          canManage:true,roles:SITE_ROLES,units:MATERIAL_UNITS,workerSelfServiceEnabled:false};
      });
    },
    save(session,input) {
      const command=normalizeSiteCommand(input);
      return run(session,command,true,async(client,member,scope)=>{
        const id=siteOperationId(member.actorId,command),requestDigest=siteCommandDigest(command),p=command.payload;
        const previous=await findReceipt(client,member,id);
        if(previous){if(previous.metadata.requestDigest!==requestDigest)throw new WorkspaceError('SITE_OPERATION_CONFLICT',409);return {scope,...await outcome(client,command.projectId,previous,true)};}
        let kind,entityId,audit;
        if(command.action==='ADD_PERSON'){
          const duplicate=await client.query(`SELECT id FROM public."Worker" WHERE "projectId"=$1 AND regexp_replace(phone,'[^0-9]','','g')=$2 LIMIT 1`,[command.projectId,p.phone.slice(1)]);
          if(duplicate.rows.length)throw new WorkspaceError('SITE_PHONE_ALREADY_REGISTERED',409);
          entityId=recordId('worker');kind='PERSON';
          const metadata={siteRegister:{version:1,job:p.job,identityStatus:'UNVERIFIED',channelVerified:false,source:'responsible-entry'}};
          await client.query(`INSERT INTO public."Worker"(id,"projectId",name,phone,role,active,metadata,"updatedAt") VALUES($1,$2,$3,$4,$5,true,$6::jsonb,clock_timestamp())`,
            [entityId,command.projectId,p.name,p.phone,SITE_ROLES[p.job],JSON.stringify(metadata)]);
          audit={job:p.job,channelVerified:false,loginAccessGranted:false};
        }else if(command.action==='SET_PERSON_ACTIVE'){
          const row=await readWorker(client,command.projectId,p.personId,true);
          if(row.revision!==p.revision)throw new WorkspaceError('SITE_REVISION_CHANGED',409);
          if(row.active===p.active)throw new WorkspaceError('SITE_UNCHANGED',409);
          const metadata=cleanMetadata(row.metadata);
          if(metadata.siteRegister?.version!==1)throw new WorkspaceError('SITE_RECORD_NOT_SUPPORTED',409);
          await client.query(`UPDATE public."Worker" SET active=$3,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[row.id,command.projectId,p.active]);
          kind='PERSON';entityId=row.id;audit={before:row.active,after:p.active,reason:p.reason,identityStatus:metadata.siteRegister?.identityStatus||'NOT_EVALUATED'};
        }else if(['REPORT_ISSUE','REQUEST_MATERIAL'].includes(command.action)){
          const type=command.action==='REPORT_ISSUE'?'ISSUE':'MATERIAL_REQUEST';
          entityId=recordId('incident');kind='REPORT';
          await insertSiteReport(client,{id:entityId,projectId:command.projectId,actorId:member.actorId,type,title:type==='ISSUE'?p.title:p.material,description:p.details,severity:type==='ISSUE'?p.severity:'INFO',sector:p.sector,material:p.material,quantity:p.quantity,unit:p.unit});
          audit={type,state:'OPEN'};
        }else{
          const row=await readReport(client,command.projectId,p.reportId,true),metadata=cleanMetadata(row.metadata),record=metadata.siteRegister;
          if(metadata.procurement?.version===1&&!['REJECTED','CANCELLED'].includes(metadata.procurement.state))throw new WorkspaceError('SITE_PURCHASE_WORKFLOW_REQUIRED',409);
          if(record?.version!==1)throw new WorkspaceError('SITE_RECORD_NOT_SUPPORTED',409);
          if(row.revision!==p.revision)throw new WorkspaceError('SITE_REVISION_CHANGED',409);
          const state=siteTransition(record.type,record.state,p.decision);
          const serverNow=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now.toISOString();
          const updated={...metadata,siteRegister:{...record,state,review:{decision:state,reason:p.reason,actorId:member.actorId,recordedAt:serverNow}}};
          await client.query(`UPDATE public."Incident" SET status=$3,metadata=$4::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,
            [row.id,command.projectId,state==='ACKNOWLEDGED'?'in_review':state==='RESOLVED'?'resolved':'rejected',JSON.stringify(updated)]);
          kind='REPORT';entityId=row.id;audit={before:record.state,after:state,reason:p.reason,purchaseAuthorized:false,stockChanged:false};
        }
        await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata)
          VALUES($1,$2,$3,'site.register.changed',$4,$5,$6::jsonb)`,[id,member.organizationId,member.actorId,kind,entityId,
          JSON.stringify({version:1,projectId:command.projectId,command:command.action,requestDigest,kind,entityId,details:audit})]);
        const recorded=await findReceipt(client,member,id);
        if(!recorded)throw new WorkspaceError('SITE_WRITE_UNCONFIRMED',503);
        return {scope,...await outcome(client,command.projectId,recorded,false)};
      });
    },
    status(session,context){
      if(!operationId(context.operationId))throw new WorkspaceError('SITE_INPUT_INVALID');
      return run(session,context,false,async(client,member,scope)=>{
        const receipt=await findReceipt(client,member,siteOperationId(member.actorId,context));
        return receipt?{scope,state:'RECORDED',...await outcome(client,context.projectId,receipt,true)}:{scope,state:'NOT_OBSERVED',definitive:false};
      });
    },
  };
}
