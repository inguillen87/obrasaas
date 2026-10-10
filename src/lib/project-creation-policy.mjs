import {WorkspaceError,workspaceId,operationId,digest} from './workspace-policy.mjs';

export const PROJECT_CREATION_ACTION='CREATE_PROJECT';
const invalid=()=>{throw new WorkspaceError('PROJECT_CREATION_INPUT_INVALID',422);};
function keys(value,fields){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join('|')!==[...fields].sort().join('|'))invalid();}
export function projectCreationText(value,max,min=0){
 if(typeof value!=='string'||value.length>max||/[\u0000-\u001f\u007f<>\u202a-\u202e\u2066-\u2069]/.test(value)||/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value))invalid();
 const text=value.trim().normalize('NFC');if(text.length<min||text.length>max)invalid();return text;
}
export function projectCreationContext(input){
 if(!workspaceId(input?.projectId)||!/^[a-f0-9]{64}$/.test(input?.scope||''))throw new WorkspaceError('PROJECT_CREATION_QUERY_INVALID',400);
 return {projectId:input.projectId,scope:input.scope};
}
export function normalizeProjectCreation(input){
 keys(input,['operationId','scope','projectId','action','payload']);projectCreationContext(input);
 if(!operationId(input.operationId)||input.action!==PROJECT_CREATION_ACTION)invalid();
 keys(input.payload,['name','address','reason']);
 return {operationId:input.operationId.toLowerCase(),scope:input.scope,projectId:input.projectId,action:PROJECT_CREATION_ACTION,payload:{name:projectCreationText(input.payload.name,120,2),address:projectCreationText(input.payload.address,300),reason:projectCreationText(input.payload.reason,500,8)}};
}
export const projectCreationReceiptId=(member,projectId,op)=>'project_creation_'+digest([member.organizationId,member.actorId,projectId,op.toLowerCase()]);
export const projectCreationRequestDigest=input=>digest(['project-creation-v1',input.projectId,input.scope,input.action,input.payload]);
