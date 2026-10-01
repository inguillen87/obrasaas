export const COMPANY_SCHEMA_REQUIREMENTS=Object.freeze({
 Organization:['id','name','slug','clerkOrganizationId','country','timezone','metadata','updatedAt','trialEndsAt','subscriptionPlan','subscriptionStatus'],
 PlatformUser:['id','clerkUserId','primaryEmail','fullName','systemRole','updatedAt'],
 TenantMembership:['id','organizationId','userId','clerkRole','tenantRole','status','updatedAt'],
 Project:['id','organizationId','name','slug','status','address','metadata','updatedAt'],
 ProjectMembership:['id','projectId','tenantMembershipId','status','updatedAt'],
 Task:['id','projectId','title','status','progress','startsAt','endsAt','metadata','updatedAt'],
 AuditLog:['id','organizationId','actorId','action','entityType','entityId','metadata','createdAt'],
 Worker:['id','projectId','phone','name','role','active','metadata','createdAt','updatedAt'],
 Incident:['id','projectId','externalId','title','description','severity','status','reporter','metadata','createdAt','updatedAt'],
 AttendanceEntry:['id','projectId','workerId','status','latitude','longitude','distanceMeters','source','checkedInAt','metadata'],
 OperationalProposal:['id','projectId','type','status','sourceProvider','sourceExternalId','resolverProvider','resolverExternalId','confirmationCode','summary','action','precondition','result','proposedByWorkerId','resolvedByWorkerId','expiresAt','createdAt','updatedAt'],
 WhatsAppConnection:['id','projectId','phoneNumberId','whatsappBusinessId','displayPhoneNumber','enabled','connectionStatus','encryptedAccessToken','verifiedBusinessName','metadata','updatedAt'],
 WebhookEvent:['id','projectId','provider','externalId','eventType','status','attempts','payload','createdAt','updatedAt'],
});
export function checkCompanySchema(rows){
 const present=new Set(rows.map(row=>row.table_name+'.'+row.column_name)),missing=[];
 for(const [table,columns]of Object.entries(COMPANY_SCHEMA_REQUIREMENTS))for(const column of columns)if(!present.has(table+'.'+column))missing.push(table+'.'+column);
 return {compatible:missing.length===0,requiredTables:Object.keys(COMPANY_SCHEMA_REQUIREMENTS).length,missing};
}
export function companyPreflightEnabled(environment=process.env){
 if(!environment.OBRASAAS_CHECK_COMPANY_SCHEMA)return false;
 if(environment.OBRASAAS_CHECK_COMPANY_SCHEMA!=='read-only-v1'||environment.VERCEL_ENV!=='production'||environment.VERCEL_PROJECT_ID!=='prj_68NErbCqCFsDVaMak81gcwsGI9pF'||environment.NEXT_PUBLIC_APP_URL!=='https://obrasaas.com')throw new Error('COMPANY_PREFLIGHT_CONTEXT_INVALID');
 return true;
}
