import {WorkspaceError,workspaceId,digest} from './workspace-policy.mjs';

export const PARTICIPANT_ACCOUNT_PAGE_SIZE=100;
export const PARTICIPANT_ACCOUNT_QUERY_LIMIT=80;
const invalid=()=>{throw new WorkspaceError('PARTICIPANT_ACCOUNT_QUERY_INVALID');};
const unavailable=()=>{throw new WorkspaceError('PARTICIPANT_ACCOUNT_CURSOR_UNAVAILABLE',404);};
const validRevision=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/.test(value);

export function participantAccountQuery(value=''){
 if(typeof value!=='string'||value.length>PARTICIPANT_ACCOUNT_QUERY_LIMIT||/[\u0000-\u001f\u007f-\u009f]/.test(value)||!value.isWellFormed())invalid();
 return value.normalize('NFC').trim();
}

export function participantAccountRequest(context){
 if(!context||typeof context!=='object'||Array.isArray(context)||Object.keys(context).some(key=>!['projectId','scope','query','afterAccount','accountId'].includes(key))||!workspaceId(context.projectId)||!/^[a-f0-9]{64}$/.test(context.scope||''))invalid();
 const query=participantAccountQuery(context.query),afterAccount=context.afterAccount??null,accountId=context.accountId??null;
 if(accountId!==null&&(!workspaceId(accountId)||Object.hasOwn(context,'query')||afterAccount!==null)||afterAccount!==null&&(typeof afterAccount!=='string'||afterAccount.length>1024||!/^[A-Za-z0-9_-]+~[a-f0-9]{64}$/.test(afterAccount)))invalid();
 return {query,afterAccount,accountId};
}

const binding=(member,context,scope,query)=>digest(['participant-accounts-v1',member.actorId,member.membershipId,member.organizationId,context.projectId,scope,query]);

// Like the journey cursor, this is a canonical row reference, not authority.
// The store rechecks current membership, project, query and anchor revision.
export function participantAccountCursor(row,member,context,scope,query){
 if(!workspaceId(row.membershipId)||!validRevision(row.revision))throw new WorkspaceError('PARTICIPANT_ACCOUNT_RESULT_INVALID',503);
 const body=[1,binding(member,context,scope,query),row.membershipId,row.revision];
 return Buffer.from(JSON.stringify(body)).toString('base64url')+'~'+digest(body);
}

export function parseParticipantAccountCursor(value,member,context,scope,query){
 if(value===null)return null;
 if(typeof value!=='string'||value.length>1024||!/^[A-Za-z0-9_-]+~[a-f0-9]{64}$/.test(value))invalid();
 const [encoded,stamp]=value.split('~');let body;
 try{const bytes=Buffer.from(encoded,'base64url'),json=bytes.toString('utf8');body=JSON.parse(json);if(bytes.toString('base64url')!==encoded||JSON.stringify(body)!==json)invalid();}catch{invalid();}
 if(!Array.isArray(body)||body.length!==4||body[0]!==1||!/^[a-f0-9]{64}$/.test(body[1]||'')||!workspaceId(body[2])||!validRevision(body[3])||digest(body)!==stamp)invalid();
 if(body[1]!==binding(member,context,scope,query))unavailable();
 return {membershipId:body[2],revision:body[3]};
}

// Literal name/email lookup. Explicit Spanish case pairs also work with C locale.
const searchText=expression=>`lower(translate(${expression},'ÁÉÍÓÚÜÑ','áéíóúüñ'))`;
export const participantAccountSearchPredicate=parameter=>`(${parameter}::text='' OR strpos(${searchText('COALESCE(u."fullName",\'\')')},${searchText(parameter)})>0 OR strpos(${searchText('COALESCE(u."primaryEmail",\'\')')},${searchText(parameter)})>0)`;
