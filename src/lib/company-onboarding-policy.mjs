import {WorkspaceError,operationId,calendarDate,requireWorkspaceIdentity,digest,workspaceId} from './workspace-policy.mjs';
import {companyPhoneE164} from './company-phone-format.mjs';
export const BOOTSTRAP_PROFILE_TEMPLATE='obrasaas-bootstrap-v1';
export const BOOTSTRAP_PROFILE_AUDIENCE='https://obrasaas.com/company-onboarding';
const plain=value=>value&&typeof value==='object'&&!Array.isArray(value);
const keys=(value,list)=>plain(value)&&Object.keys(value).sort().join('|')===[...list].sort().join('|');
const label=(value,max)=>typeof value==='string'&&value.trim().length>=2&&value.length<=max&&!/[\u0000-\u001f\u007f<>]/.test(value);
export function validProfileEmail(value){return typeof value==='string'&&value.length<=254&&/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,63}$/.test(value)&&!value.includes('..');}
export function requireNewCompanyAdmin(session){
 requireWorkspaceIdentity(session);
 if(session.organizationRole!=='org:admin')throw new WorkspaceError('COMPANY_CREATOR_ROLE_REQUIRED',403);
}
export function normalizeCompanyOnboarding(input,session){
 requireNewCompanyAdmin(session);
 const phone=plain(input)&&Object.hasOwn(input,'companyPhone');
 if(!keys(input,['operationId','expectedClerkOrganizationId','companyName','project','initialTasks','confirmNewCompany',...(phone?['companyPhone']:[])])||!operationId(input.operationId)||input.expectedClerkOrganizationId!==session.organizationId||input.confirmNewCompany!==true)throw new WorkspaceError('COMPANY_ONBOARDING_INPUT_INVALID');
 if(!label(input.companyName,120)||!keys(input.project,['name','address'])||!label(input.project.name,120)||typeof input.project.address!=='string'||input.project.address.length>300||/[\u0000-\u001f\u007f<>]/.test(input.project.address))throw new WorkspaceError('COMPANY_ONBOARDING_INPUT_INVALID');
 if(!Array.isArray(input.initialTasks)||input.initialTasks.length>25)throw new WorkspaceError('COMPANY_INITIAL_TASKS_INVALID');
 const titles=new Set();
 const initialTasks=input.initialTasks.map(task=>{
  if(!keys(task,['title','startsOn','endsOn'])||!label(task.title,160))throw new WorkspaceError('COMPANY_INITIAL_TASKS_INVALID');
  const title=task.title.trim(),key=title.toLocaleLowerCase('es');if(titles.has(key))throw new WorkspaceError('COMPANY_INITIAL_TASKS_DUPLICATED');titles.add(key);
  const empty=task.startsOn===''&&task.endsOn==='';
  if(!empty&&(!calendarDate(task.startsOn)||!calendarDate(task.endsOn)||task.endsOn<task.startsOn))throw new WorkspaceError('COMPANY_INITIAL_DATES_INVALID');
  return {title,startsOn:empty?null:task.startsOn,endsOn:empty?null:task.endsOn};
 });
 return {operationId:input.operationId.toLowerCase(),expectedClerkOrganizationId:input.expectedClerkOrganizationId,companyName:input.companyName.trim(),project:{name:input.project.name.trim(),address:input.project.address.trim()||null},initialTasks,confirmNewCompany:true,...(phone?{companyPhone:normalizeCompanyPhone(input.companyPhone)}:{})};
}
export const bootstrapReceiptId=(session,id)=>'company_bootstrap_'+digest([session.userId,session.organizationId,id.toLowerCase()]);
export const bootstrapRequestDigest=input=>digest([input.expectedClerkOrganizationId,input.companyName,input.project,input.initialTasks,input.confirmNewCompany,...(Object.hasOwn(input,'companyPhone')?['company-phone-v1',input.companyPhone]:[])]);
// Only formatting is removed. Neither a country nor an Argentine mobile alias
// can be inferred from a local number, suffix, organization country or pilot.
export function normalizeCompanyPhone(value,provider=false){
 const normalized=companyPhoneE164(value,{provider});if(!normalized)throw new WorkspaceError('COMPANY_PHONE_INVALID');return normalized;
}
export function readCompanyPhoneDeclaration(metadata){
 if(metadata!=null&&!plain(metadata))throw new WorkspaceError('COMPANY_PHONE_INTEGRITY',409);
 const value=metadata?.companyPhoneDeclaration;if(value===undefined)return null;
 if(!keys(value,['version','status','e164','revision','declaredAt','receiptId'])||value.version!==1||value.status!=='UNVERIFIED'||!Number.isSafeInteger(value.revision)||value.revision<1||typeof value.declaredAt!=='string'||value.declaredAt.length>40||!Number.isFinite(Date.parse(value.declaredAt))||!/^company_(?:phone|bootstrap)_[a-f0-9]{64}$/.test(value.receiptId))throw new WorkspaceError('COMPANY_PHONE_INTEGRITY',409);
 try{if(normalizeCompanyPhone(value.e164)!==value.e164)throw new Error();}catch{throw new WorkspaceError('COMPANY_PHONE_INTEGRITY',409);}return {...value};
}
export function companyPhoneContract(metadata){const phone=readCompanyPhoneDeclaration(metadata);return phone?{version:1,e164:phone.e164,revision:phone.revision,digest:digest(['company-phone-v1',phone.e164,phone.revision])}:null;}
export function assertCompanyPhoneMatch(contract,metadata,displayNumber){
 if(contract===undefined)return; // Historical authorizations keep their exact contract.
 const current=companyPhoneContract(metadata);
 if(!keys(contract,['version','e164','revision','digest'])||contract.version!==1||!current||['version','e164','revision','digest'].some(key=>contract[key]!==current[key]))throw new WorkspaceError('META_CUSTOMER_COMPANY_PHONE_CHANGED',409);
 let normalized;try{normalized=normalizeCompanyPhone(displayNumber,true);}catch{throw new WorkspaceError('META_CUSTOMER_COMPANY_PHONE_UNCONFIRMED',409);}
 if(normalized!==contract.e164)throw new WorkspaceError('META_CUSTOMER_COMPANY_PHONE_MISMATCH',409);
}
export function normalizeCompanyPhoneCommand(input,session){
 requireNewCompanyAdmin(session);
 if(!keys(input,['action','operationId','expectedClerkOrganizationId','companyPhone','expectedRevision','confirmDeclaration','projectId','scope'])||input.action!=='declare_company_phone'||!workspaceId(input.projectId)||typeof input.scope!=='string'||!/^[a-f0-9]{64}$/.test(input.scope)||!operationId(input.operationId)||input.expectedClerkOrganizationId!==session.organizationId||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0||input.confirmDeclaration!==true)throw new WorkspaceError('COMPANY_PHONE_INPUT_INVALID');
 return {...input,operationId:input.operationId.toLowerCase(),companyPhone:normalizeCompanyPhone(input.companyPhone)};
}
export const companyPhoneReceiptId=(session,id)=>'company_phone_'+digest([session.userId,session.organizationId,id.toLowerCase()]);

export function companyPhoneAuthorizationContract(binding){
 if(!Object.hasOwn(binding||{},'declaredCompanyPhone')){if(Object.hasOwn(binding||{},'companyPhoneCorrections'))throw new WorkspaceError('COMPANY_PHONE_INTEGRITY',409);return undefined;}
 const validate=contract=>{if(!keys(contract,['version','e164','revision','digest'])||contract.version!==1||!Number.isSafeInteger(contract.revision)||contract.revision<1||normalizeCompanyPhone(contract.e164)!==contract.e164||contract.digest!==digest(['company-phone-v1',contract.e164,contract.revision]))throw new WorkspaceError('COMPANY_PHONE_INTEGRITY',409);};
 try{
  let contract=binding.declaredCompanyPhone;validate(contract);const original=contract.digest,history=binding.companyPhoneCorrections||[];
  if(!Array.isArray(history)||history.length>20)throw new Error();
  for(const correction of history){if(!keys(correction,['version','operationId','receiptId','signupId','actorId','organizationId','projectId','originalDigest','previousDigest','contract','correctedAt'])||correction.version!==1||!operationId(correction.operationId)||!operationId(correction.signupId)||!workspaceId(correction.actorId)||!workspaceId(correction.organizationId)||!workspaceId(correction.projectId)||!/^meta_company_phone_[a-f0-9]{64}$/.test(correction.receiptId)||correction.originalDigest!==original||correction.previousDigest!==contract.digest||!Number.isFinite(Date.parse(correction.correctedAt)))throw new Error();validate(correction.contract);if(correction.contract.revision<=contract.revision)throw new Error();contract=correction.contract;}
  return contract;
 }catch{throw new WorkspaceError('COMPANY_PHONE_INTEGRITY',409);}
}
