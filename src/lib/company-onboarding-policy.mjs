import {WorkspaceError,operationId,calendarDate,requireWorkspaceIdentity,digest} from './workspace-policy.mjs';
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
 if(!keys(input,['operationId','expectedClerkOrganizationId','companyName','project','initialTasks','confirmNewCompany'])||!operationId(input.operationId)||input.expectedClerkOrganizationId!==session.organizationId||input.confirmNewCompany!==true)throw new WorkspaceError('COMPANY_ONBOARDING_INPUT_INVALID');
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
 return {operationId:input.operationId.toLowerCase(),expectedClerkOrganizationId:input.expectedClerkOrganizationId,companyName:input.companyName.trim(),project:{name:input.project.name.trim(),address:input.project.address.trim()||null},initialTasks,confirmNewCompany:true};
}
export const bootstrapReceiptId=(session,id)=>'company_bootstrap_'+digest([session.userId,session.organizationId,id.toLowerCase()]);
export const bootstrapRequestDigest=input=>digest([input.expectedClerkOrganizationId,input.companyName,input.project,input.initialTasks,input.confirmNewCompany]);
