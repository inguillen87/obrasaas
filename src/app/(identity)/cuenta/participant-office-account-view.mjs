export const PARTICIPANT_OFFICE_ASSIGN_ACTION='ASSIGN_VERIFIED_OFFICE';
const officeRoles=['DIRECTOR','SITE_MANAGER','FINANCE','AUDITOR'];
const accountRoles=['ADMIN',...officeRoles];
const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===[...keys].sort().join('|');
const precommitRejections=['PARTICIPANT_OFFICE_PROOF_CHANGED','PARTICIPANT_OFFICE_ACCOUNT_EXISTS','PARTICIPANT_OFFICE_HISTORY_UNCONFIRMED','PARTICIPANT_OFFICE_ACCOUNT_FIELD_BOUND','PARTICIPANT_OFFICE_ACCOUNT_RESTRICTED','PARTICIPANT_IDENTITY_CONFLICT'];
const invalid=()=>{throw Object.assign(new Error('No se pudo comprobar esta cuenta de oficina. Volvé a consultar su estado vigente.'),{code:'PARTICIPANT_OFFICE_PROJECTION_INVALID',status:409});};
const codes={PARTICIPANT_PROVIDER_MEMBERSHIP_REQUIRED:'La persona todavía no tiene una membresía aceptada en esta organización de Clerk. Pedile que acepte la invitación y volvé a consultar.',PARTICIPANT_VERIFIED_EMAIL_REQUIRED:'La persona debe verificar este correo en Clerk antes de incorporarse.',PARTICIPANT_OFFICE_ACCOUNT_EXISTS:'La cuenta ya pertenece a esta empresa. Consultá sus permisos en la lista de cuentas existentes.',PARTICIPANT_OFFICE_TARGET_PROTECTED:'Esta cuenta tiene un acceso protegido. No se puede incorporar desde esta decisión.',PARTICIPANT_OFFICE_ACCOUNT_FIELD_BOUND:'Esta cuenta tiene una participación de campo. Continuá desde su ficha y sus permisos vigentes.',PARTICIPANT_OFFICE_HISTORY_UNCONFIRMED:'Hay un alta de campo anterior sin vínculo verificable en esta empresa. Requiere revisión del administrador; no borres registros ni crees otro espacio.',PARTICIPANT_OFFICE_ACCOUNT_RESTRICTED:'Esta cuenta tiene un acceso limitado de revisión. No se convierte automáticamente en Dirección.',PARTICIPANT_IDENTITY_CONFLICT:'La identidad coincide con otro registro y necesita revisión. No se fusionaron cuentas.',PARTICIPANT_OFFICE_ACCOUNT_AMBIGUOUS:'No encontramos una única identidad aceptada para este correo. Revisá la cuenta en Clerk.'};

export function participantOfficeEmail(value){
 if(typeof value!=='string'||value.length>254||!value.isWellFormed()||/[\u0000-\u001f\u007f-\u009f]/.test(value))throw new Error('Escribí el correo exacto de la cuenta invitada.');
 const email=value.trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Escribí el correo exacto de la cuenta invitada.');return email;
}
export function participantOfficeSnapshot(value,{scope,projectId,email}){
 if(!exact(value,['scope','projectId','verifiedOfficeAccount'])||value.scope!==scope||!hash(scope)||value.projectId!==projectId||!id(projectId))invalid();
 const row=value.verifiedOfficeAccount;if(!exact(row,['version','email','state','code','account'])||row.version!==1||row.email!==participantOfficeEmail(email)||!['READY','NOT_READY','BLOCKED'].includes(row.state))invalid();
 if(row.state==='READY'){
  const account=row.account;if(row.code!==null||!exact(account,['clerkUserId','name','email','clerkRole','proofDigest'])||!/^user_[A-Za-z0-9]+$/.test(account.clerkUserId||'')||typeof account.name!=='string'||!account.name||account.email!==row.email||account.clerkRole!=='org:member'||!hash(account.proofDigest))invalid();
 }else if(row.account!==null||typeof row.code!=='string'||!/^PARTICIPANT_[A-Z0-9_]{1,100}$/.test(row.code))invalid();
 return row;
}
export const participantOfficeSelectionStamp=row=>row?.state==='READY'?JSON.stringify([row.email,row.account.clerkUserId,row.account.name,row.account.clerkRole,row.account.proofDigest]):null;
export const participantOfficeStateMessage=row=>row?.state==='READY'?'Cuenta aceptada y correo verificado en Clerk. Revisá su identidad y elegí los permisos de oficina.':codes[row?.code]||'Esta cuenta no permite la incorporación. Consultá su estado en Clerk antes de continuar.';

// These six backend guards run before writes or roll back the atomic SQL
// transaction. This classifies the received rejection, never a missing receipt.
// Callers may release only the first POST reservation, not a previous attempt.
export function participantOfficePrecommitRejected(error){
 const value=error?.result;return Boolean(error?.retainAttempt!==true&&error?.status===409&&precommitRejections.includes(error.code)&&exact(value,['saved','identityCertified','code'])&&value.saved===false&&value.identityCertified===false&&value.code===error.code);
}

export function participantOfficeReceiptOutcome(value,reference,command=null){
 if(!reference||reference.action!==PARTICIPANT_OFFICE_ASSIGN_ACTION||!hash(reference.scope)||!id(reference.projectId)||!uuid(reference.operationId)||value?.scope!==reference.scope)return null;
 if(value.state==='NOT_OBSERVED')return exact(value,['scope','state','definitive'])&&value.definitive===false?{state:'NOT_OBSERVED'}:null;
 const keys=['scope','saved','replayed','receiptId','account','officeAssignmentReceipt',...(value.state===undefined?[]:['state'])];
 if(!exact(value,keys)||value.state!==undefined&&value.state!=='RECORDED'||value.saved!==true||typeof value.replayed!=='boolean'||!/^participant_[a-f0-9]{64}$/.test(value.receiptId||''))return null;
 const row=value.officeAssignmentReceipt,fields=['version','operationId','action','projectId','scope','receiptId','membershipId','clerkUserId','email','role','assignedProjectId','recordedAt','proofDigest','identityCertified','fieldPermissionsGranted'];
 if(!exact(row,fields)||row.version!==1||row.operationId!==reference.operationId||row.action!==reference.action||row.projectId!==reference.projectId||row.scope!==reference.scope||row.receiptId!==value.receiptId||!id(row.membershipId)||!/^user_[A-Za-z0-9]+$/.test(row.clerkUserId||'')||!officeRoles.includes(row.role)||row.assignedProjectId!==(row.role==='DIRECTOR'?null:reference.projectId)||!hash(row.proofDigest)||row.identityCertified!==false||row.fieldPermissionsGranted!==false||typeof row.recordedAt!=='string'||!Number.isFinite(Date.parse(row.recordedAt))||new Date(row.recordedAt).toISOString()!==row.recordedAt)return null;
 try{if(row.email!==participantOfficeEmail(row.email))return null;}catch{return null;}
 const account=value.account;if(!exact(account,['membershipId','name','email','role','roleLabel','roleScope','revision','status','self','canChangeRole'])||account.membershipId!==row.membershipId||typeof account.name!=='string'||!account.name||!(account.email===null||typeof account.email==='string')||!accountRoles.includes(account.role)||typeof account.roleLabel!=='string'||typeof account.roleScope!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/.test(account.revision||'')||!['ACTIVE','INVITED','DISABLED'].includes(account.status)||typeof account.self!=='boolean'||typeof account.canChangeRole!=='boolean')return null;
 if(command){const p=command.payload;if(command.operationId!==reference.operationId||command.action!==reference.action||command.scope!==reference.scope||command.projectId!==reference.projectId||!p||p.email!==row.email||p.clerkUserId!==row.clerkUserId||p.expectedProofDigest!==row.proofDigest||p.role!==row.role||p.confirmOfficePermissions!==true)return null;}
 return {state:'RECORDED',receiptId:row.receiptId};
}
