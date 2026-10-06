import {normalizeTenantWorkspace,WORKSPACE_NUMBER_MODES,WORKSPACE_USE_CASES,TenantWorkspaceError} from './whatsapp/tenant-workspace-policy.js';
import {readProjectWorkspaceProfile,projectWorkspaceMetadata} from './whatsapp/project-workspace-profile.js';
import {WorkspaceError,operationId,digest} from './workspace-policy.mjs';
import {companyConnectionForProject,assertLegacyProjectChannel} from './company-channel-connection.mjs';
const publicError=error=>{if(error instanceof TenantWorkspaceError)throw new WorkspaceError(error.code,error.status);throw error;};
const same=(current,command)=>['assistantName','numberMode','initialProjectId'].every(key=>current[key]===command[key])&&JSON.stringify(current.useCases)===JSON.stringify(command.useCases);
const receiptId=(member,projectId,id)=>'wa_preparation_'+digest([member.actorId,projectId,id.toLowerCase()]);
export function customerWhatsAppReadiness(profile,connection){
  // A stored connection is not proof of consent, delivery or a customer journey.
  // Do not reuse the demo token/number, or global template flags, for any customer.
  return {
    customerOwnsAssets:true,founderAssistanceIsStandardStep:false,asksForTokens:false,
    canLaunchMeta:false,launchCode:'CUSTOMER_AUTHORIZATION_NOT_RELEASED',operational:false,
    steps:[
      {key:'PREPARATION',title:'Preparar el asistente',state:profile.configured?'SAVED':'PENDING'},
      {key:'AUTHORIZATION',title:'Autorizar tu empresa en Meta',state:'NOT_VERIFIED'},
      {key:'CONNECTION',title:'Conectar el número de esta obra',state:connection?'RECORD_PRESENT':'NOT_LINKED'},
      {key:'TEMPLATES',title:'Comprobar las plantillas de tu cuenta',state:'NOT_VERIFIED'},
      {key:'ROUND_TRIP',title:'Verificar recepción y respuesta',state:'NOT_VERIFIED'},
      {key:'FIELD_ACCEPTANCE',title:'Probar el circuito con tus participantes',state:'NOT_VERIFIED'},
    ],
  };
}
export function createCustomerWhatsAppSetup({workspace}){
  async function response(client,member,scope,project){
    const {profile,profileSource}=readProjectWorkspaceProfile(project.metadata,project.organizationMetadata,project.id);
    const rows=await client.query(`SELECT id,"displayPhoneNumber",enabled,"connectionStatus"::text AS status
      FROM public."WhatsAppConnection" WHERE "projectId"=$1`,[project.id]);
    if(rows.rows.length>1)throw new WorkspaceError('WHATSAPP_PREPARATION_INTEGRITY',409);
    const corporate=await companyConnectionForProject(client,member.organizationId,project.id),found=corporate?{...corporate,status:corporate.connectionStatus}:rows.rows[0];
    const connection=found?{recordPresent:true,displayNumber:found.displayPhoneNumber||null,storedStatus:found.status,enabled:found.enabled===true}:null;
    return {scope,projectId:project.id,projectName:project.name,companyName:member.organizationName,
      profile,profileSource,connection,...(corporate?{companyRouting:{mode:corporate.company.mode,connectionId:corporate.id,anchorProjectId:corporate.projectId,legacyActionsBlocked:corporate.projectId!==project.id||['COMPANY','SUSPENDED'].includes(corporate.company.mode),accepted:false}}:{}),readiness:customerWhatsAppReadiness(profile,connection),
      options:{numberModes:WORKSPACE_NUMBER_MODES,useCases:WORKSPACE_USE_CASES}};
  }
  async function findReceipt(client,member,id){
    const result=await client.query(`SELECT id,metadata FROM public."AuditLog"
      WHERE id=$1 AND "organizationId"=$2 AND "actorId"=$3 AND action='project.whatsapp_workspace.prepared.self_service'`,[id,member.organizationId,member.actorId]);
    return result.rows[0]||null;
  }
  async function within(session,context,writable,run){
    try{return await workspace.integrationProject(session,context,writable,async (...args)=>{try{if(writable)await assertLegacyProjectChannel(args[0],args[1],args[3].id);return await run(...args);}catch(error){return publicError(error);}});}catch(error){return publicError(error);}
  }
  return {
    read(session,context){return within(session,context,false,(client,member,scope,project)=>response(client,member,scope,project));},
    async save(session,input){
      if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join('|')!=='operationId|profile|projectId|scope'||!operationId(input.operationId))throw new WorkspaceError('WHATSAPP_PREPARATION_INVALID');
      let command;try{command=normalizeTenantWorkspace(input.profile);}catch(error){return publicError(error);}
      if(command.initialProjectId!==input.projectId)throw new WorkspaceError('WORKSPACE_PROJECT_MISMATCH',409);
      return within(session,input,true,async(client,member,scope,project)=>{
        const id=receiptId(member,project.id,input.operationId),requestDigest=digest([input.projectId,input.scope,command]);
        const previous=await findReceipt(client,member,id);
        if(previous){
          if(previous.metadata.requestDigest!==requestDigest)throw new WorkspaceError('WHATSAPP_PREPARATION_OPERATION_CONFLICT',409);
          const current=await response(client,member,scope,project);
          return {...current,saved:true,replayed:true,receipt:{id,savedRevision:previous.metadata.revision},savedProfileIsCurrent:current.profile.revision===previous.metadata.revision};
        }
        const {profile:current}=readProjectWorkspaceProfile(project.metadata,project.organizationMetadata,project.id);
        if(current.revision!==command.expectedRevision)throw new WorkspaceError('WORKSPACE_CONFLICT',409);
        if(current.revision>=Number.MAX_SAFE_INTEGER)throw new WorkspaceError('WORKSPACE_INTEGRITY',409);
        const unchanged=current.configured&&same(current,command);
        const stored={schemaVersion:2,assistantName:command.assistantName,numberMode:command.numberMode,initialProjectId:project.id,
          useCases:command.useCases,mode:'REVIEW_REQUIRED',ownership:'CUSTOMER',revision:current.revision+(unchanged?0:1),updatedAt:unchanged?current.updatedAt:new Date().toISOString()};
        if(!unchanged){
          const metadata=projectWorkspaceMetadata(project.metadata,stored,project.id);
          const result=await client.query(`UPDATE public."Project" SET metadata=$3::jsonb,"updatedAt"=clock_timestamp()
            WHERE id=$1 AND "organizationId"=$2 AND status='ACTIVE'`,[project.id,member.organizationId,JSON.stringify(metadata)]);
          if(result.rowCount!==1)throw new WorkspaceError('WORKSPACE_CONFLICT',409);project={...project,metadata};
        }
        await client.query(`INSERT INTO public."AuditLog" (id,"organizationId","actorId",action,"entityType","entityId",metadata)
          VALUES ($1,$2,$3,'project.whatsapp_workspace.prepared.self_service','Project',$4,$5::jsonb)`,
          [id,member.organizationId,member.actorId,project.id,JSON.stringify({requestDigest,projectId:project.id,revision:stored.revision,
            numberMode:command.numberMode,useCases:command.useCases,ownership:'CUSTOMER',automationActivated:false,unchanged})]);
        return {...await response(client,member,scope,project),saved:true,replayed:false,unchanged,savedProfileIsCurrent:true,receipt:{id,savedRevision:stored.revision}};
      });
    },
    status(session,context){
      if(!operationId(context.operationId))throw new WorkspaceError('WHATSAPP_PREPARATION_INVALID');
      return within(session,context,false,async(client,member,scope,project)=>{
        const found=await findReceipt(client,member,receiptId(member,project.id,context.operationId));
        const current=await response(client,member,scope,project);
        return found?{...current,state:'RECORDED',saved:true,receipt:{id:found.id,savedRevision:found.metadata.revision},savedProfileIsCurrent:current.profile.revision===found.metadata.revision}
          :{...current,state:'NOT_OBSERVED',definitive:false};
      });
    },
  };
}
