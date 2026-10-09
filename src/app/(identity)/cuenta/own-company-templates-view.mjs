const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
export const OWN_TEMPLATE_ACTIONS=Object.freeze(['PREPARE_OWN_TEMPLATE','SUBMIT_OWN_TEMPLATE','RECOVER_OWN_TEMPLATE']);
const fail=()=>{throw new Error('La respuesta no permite confirmar la gestión de plantillas. Conservamos la referencia para comprobarla.');};
function context(value,expected){if(value?.scope!==expected.scope||value.projectId!==expected.projectId||!id(value.organization?.id)||!id(value.actor?.id)||value.actor.role!=='ADMIN'||expected.organizationId&&value.organization.id!==expected.organizationId||expected.actorId&&value.actor.id!==expected.actorId)fail();}
export function ownTemplatesSnapshot(value,expected){
 context(value,expected);
 if(value.canManage!==true||value.sendingAccepted!==false||!id(value.connectionId)||!Number.isSafeInteger(value.ownerRevision)||value.ownerRevision<1||!hash(value.grantDigest)||typeof value.validUntil!=='string'||new Date(value.validUntil).toISOString()!==value.validUntil||!value.workbench||value.workbench.sendingAccepted!==false||!Array.isArray(value.workbench.options)||!Array.isArray(value.workbench.drafts)||value.workbench.options.length>5||value.workbench.drafts.length>5)fail();
 const keys=['open_attendance_reminder','participant_invitation','participant_onboarding_v1','field_evidence_request','progress_review_notification'];
 for(const option of value.workbench.options)if(!keys.includes(option.key)||typeof option.title!=='string')fail();
 for(const draft of value.workbench.drafts)if(!keys.includes(draft.blueprintKey)||!/^obrasaas_[a-z0-9_]{1,200}$/.test(draft.name||'')||!hash(draft.contentSha256)||!['DRAFT','SUBMISSION_STARTED','SUBMISSION_UNKNOWN','SUBMITTED'].includes(draft.state)||draft.canSend!==false||typeof draft.canSubmit!=='boolean'||typeof draft.canRecover!=='boolean'||draft.canSubmit!==(draft.state==='DRAFT')||draft.canRecover!==['SUBMISSION_STARTED','SUBMISSION_UNKNOWN','SUBMITTED'].includes(draft.state)||typeof draft.bodyText!=='string'||draft.bodyText.length>2048||draft.language!=='es_AR'||draft.category!=='UTILITY')fail();
 if(new Set(value.workbench.options.map(row=>row.key)).size!==value.workbench.options.length||new Set(value.workbench.drafts.map(row=>row.blueprintKey)).size!==value.workbench.drafts.length)fail();return value;
}
export function ownTemplatesOutcome(value,expected){
 if(value?.state==='NOT_OBSERVED'&&value.scope===expected.scope&&value.projectId===expected.projectId&&value.saved===false&&value.definitive===false&&!value.receiptId)return value;
 context(value,expected);
 if(value.operationId!==expected.operationId||value.action!==expected.action||value.connectionId!==expected.connectionId||!/^company_own_template_[a-f0-9]{64}$/.test(value.receiptId||'')||!['PROVIDER_STARTED','RECORDED','REJECTED'].includes(value.state)||value.saved!==(value.state==='RECORDED')||value.definitive!==['RECORDED','REJECTED'].includes(value.state)||value.sendingAccepted!==false||typeof value.providerConfirmed!=='boolean'||!Number.isSafeInteger(value.ownerRevision)||value.ownerRevision<1||!hash(value.grantDigest)||!['open_attendance_reminder','participant_invitation','participant_onboarding_v1','field_evidence_request','progress_review_notification'].includes(value.blueprintKey)||(value.state==='REJECTED'?value.submissionState!==null||value.providerConfirmed||typeof value.code!=='string':!['DRAFT','SUBMISSION_STARTED','SUBMISSION_UNKNOWN','SUBMITTED'].includes(value.submissionState)||value.providerConfirmed&&value.submissionState!=='SUBMITTED'))fail();return value;
}
export function ownTemplateCommand(snapshot,{action,blueprintKey,confirmed=false,recoveryOf=null},expected){
 ownTemplatesSnapshot(snapshot,expected);if(Date.parse(snapshot.validUntil)<=Date.now()||!OWN_TEMPLATE_ACTIONS.includes(action))fail();
 const draft=snapshot.workbench.drafts.find(row=>row.blueprintKey===blueprintKey);
 if(action==='PREPARE_OWN_TEMPLATE'?!snapshot.workbench.options.some(row=>row.key===blueprintKey)||draft:action==='SUBMIT_OWN_TEMPLATE'?!draft?.canSubmit||!confirmed:!draft?.canRecover||!confirmed||![null,'SUBMIT_OWN_TEMPLATE','RECOVER_OWN_TEMPLATE'].includes(recoveryOf))fail();
 return {scope:expected.scope,projectId:expected.projectId,action,payload:{connectionId:snapshot.connectionId,ownerRevision:snapshot.ownerRevision,grantDigest:snapshot.grantDigest,...(action==='SUBMIT_OWN_TEMPLATE'?{review:{blueprintKey,expectedName:draft.name,contentSha256:draft.contentSha256,confirmed:true}}:{blueprintKey}),...(action==='RECOVER_OWN_TEMPLATE'?{recoveryOf}:{})}};
}
