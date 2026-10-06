import {companyChannelSchemaReady} from './company-channel-schema.mjs';
import {WorkspaceError} from './workspace-policy.mjs';

export async function assertLegacyProjectChannel(client,member,projectId) {
 const ready=await companyChannelSchemaReady(client);
 if(!ready){const partial=(await client.query(`SELECT to_regclass('public."WhatsAppCompanyChannel"') IS NOT NULL AS present`)).rows[0]?.present;if(partial)throw new WorkspaceError('COMPANY_CHANNEL_CATALOG_REQUIRED',409);return;}
 const assigned=(await client.query(`SELECT cc."connectionId",cc."anchorProjectId",cc.mode FROM public."WhatsAppChannelProjectAssignment" a JOIN public."WhatsAppCompanyChannel" cc ON cc."connectionId"=a."connectionId" AND cc."organizationId"=a."organizationId" WHERE a."projectId"=$1 AND a."organizationId"=$2 AND a.status='ACTIVE'`,[projectId,member.organizationId])).rows[0];
 if(assigned&&(assigned.anchorProjectId!==projectId||['COMPANY','SUSPENDED'].includes(assigned.mode)))throw new WorkspaceError('COMPANY_CHANNEL_USE_EXISTING',409);
}

// Trusted DB lookup. An assignment supplies the channel; its original project
// remains the credential AAD. No caller can provide this owner/grant object.
export async function companyConnectionForProject(client,organizationId,projectId,lock=false) {
 if(!await companyChannelSchemaReady(client))return null;
 const owners=(await client.query(`SELECT cc."connectionId",cc."anchorProjectId",cc.mode,cc.revision,a.revision AS "assignmentRevision"
  FROM public."WhatsAppCompanyChannel" cc JOIN public."WhatsAppChannelProjectAssignment" a ON a."connectionId"=cc."connectionId" AND a."organizationId"=cc."organizationId"
  WHERE cc."organizationId"=$1 AND a."projectId"=$2 AND a.status='ACTIVE' AND cc.mode IN ('PREPARED','COMPANY','SUSPENDED')`,[organizationId,projectId])).rows;
 if(owners.length!==1)return null;
 const owner=owners[0],connection=(await client.query(`SELECT id,"projectId","whatsappBusinessId","phoneNumberId",enabled,"connectionStatus"::text AS "connectionStatus","encryptedAccessToken",metadata,"displayPhoneNumber" FROM public."WhatsAppConnection" WHERE id=$1 AND "projectId"=$2 ${lock?'FOR SHARE':''}`,[owner.connectionId,owner.anchorProjectId])).rows[0];
 if(!connection)return null;
 if(lock){const current=(await client.query(`SELECT cc.revision,a.revision AS "assignmentRevision" FROM public."WhatsAppCompanyChannel" cc JOIN public."WhatsAppChannelProjectAssignment" a ON a."connectionId"=cc."connectionId" AND a."organizationId"=cc."organizationId" WHERE cc."connectionId"=$1 AND cc."organizationId"=$2 AND cc.revision=$3 AND a."projectId"=$4 AND a.status='ACTIVE' AND a.revision=$5 AND cc.mode=$6 FOR SHARE OF cc,a`,[owner.connectionId,organizationId,owner.revision,projectId,owner.assignmentRevision,owner.mode])).rows;if(current.length!==1)return null;}
 return {...connection,organizationId,company:{...owner,targetProjectId:projectId,organizationId}};
}
