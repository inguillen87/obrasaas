const accountKeys=['membershipId','name','email','role','roleLabel','roleScope','revision','status','self','canChangeRole'];
const pageKeys=['detail','scope','projectId','accountQuery','accountId','existingAccounts','existingAccountsTruncated','nextAccountCursor','canManage','canInvite','canManageOfficeRoles'];
const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===[...keys].sort().join('|');
const invalid=()=>{throw Object.assign(new Error('No se pudo comprobar esta lista de cuentas. Volvé a consultar tu acceso.'),{code:'WORKSPACE_CONTEXT_CHANGED',status:409});};

export function participantAccountSearch(value=''){
 if(typeof value!=='string'||value.length>80||/[\u0000-\u001f\u007f-\u009f]/.test(value)||!value.isWellFormed())throw new Error('Buscá por nombre o correo, con hasta 80 caracteres.');
 return value.normalize('NFC').trim();
}

export function participantAccount(value){
 if(!exact(value,accountKeys)||!id(value.membershipId)||typeof value.name!=='string'||!value.name||!(value.email===null||typeof value.email==='string')||!['ADMIN','DIRECTOR','SITE_MANAGER','FINANCE','AUDITOR'].includes(value.role)||typeof value.roleLabel!=='string'||typeof value.roleScope!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/.test(value.revision||'')||value.status!=='ACTIVE'||typeof value.self!=='boolean'||typeof value.canChangeRole!=='boolean'||value.canChangeRole&&(value.self||value.role==='ADMIN'))invalid();
 return value;
}

export function participantAccountPage(value,{scope,projectId,query='',accountId=null}){
 if(!exact(value,pageKeys)||value.detail!=='existing-accounts'||value.scope!==scope||value.projectId!==projectId||value.accountQuery!==participantAccountSearch(query)||value.accountId!==accountId||value.canManage!==true||value.canManageOfficeRoles!==true||typeof value.canInvite!=='boolean'||!Array.isArray(value.existingAccounts)||value.existingAccounts.length>100||typeof value.existingAccountsTruncated!=='boolean'||!(value.nextAccountCursor===null||typeof value.nextAccountCursor==='string'&&value.nextAccountCursor.length<=1024&&/^[A-Za-z0-9_-]+~[a-f0-9]{64}$/.test(value.nextAccountCursor))||value.existingAccountsTruncated!==(value.nextAccountCursor!==null)||value.existingAccountsTruncated&&value.existingAccounts.length!==100)invalid();
 const ids=new Set();for(const row of value.existingAccounts){participantAccount(row);if(ids.has(row.membershipId))invalid();ids.add(row.membershipId);}
 if(accountId!==null&&(value.existingAccounts.length!==1||value.existingAccounts[0].membershipId!==accountId||value.nextAccountCursor!==null))invalid();
 return value;
}

export function participantAccountStamp(account){participantAccount(account);return JSON.stringify(accountKeys.map(key=>account[key]));}

export const participantAccountSelectionAllowed=(action,account,snapshot)=>account?.status==='ACTIVE'&&(action==='SET_OFFICE_ROLE'?snapshot?.canManageOfficeRoles===true&&account.canChangeRole===true:action==='ASSIGN_EXISTING'&&snapshot?.canInvite===true);

export const participantAccountReadDenied=error=>[401,403,409].includes(error?.status)||['WORKSPACE_CONTEXT_CHANGED','WORKSPACE_PROJECT_UNAVAILABLE'].includes(error?.code);
