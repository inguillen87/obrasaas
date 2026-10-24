import {verifyPlatformSession} from './verified-session.mjs';
import {WorkspaceError,workspaceId} from './workspace-policy.mjs';

const fail=(code='PLATFORM_OPERATOR_REQUIRED',status=403)=>{throw new WorkspaceError(code,status);};
const subject=value=>typeof value==='string'&&/^user_[A-Za-z0-9]+$/.test(value);
const sessionId=value=>typeof value==='string'&&/^sess_[A-Za-z0-9]+$/.test(value);

// Only authenticate() mints a request capability. Neither a customer DTO nor a
// copied identity can be reused as a platform operator proof.
export function createPlatformOperatorAuthority({verifySession=verifyPlatformSession,now=()=>new Date()}={}){
 if(typeof verifySession!=='function'||typeof now!=='function')throw new TypeError('Trusted platform session and clock ports required');
 const capabilities=new WeakMap();
 function currentTime(){const value=now();if(!(value instanceof Date)||!Number.isFinite(value.getTime()))fail('PLATFORM_OPERATOR_UNCONFIRMED',503);return value.getTime();}
 async function lookup(client,clerkUserId,actorId,locked=true){
  if(typeof client?.query!=='function')fail('PLATFORM_OPERATOR_UNCONFIRMED',503);
  let result;try{result=await client.query(`SELECT id,"clerkUserId","systemRole"::text AS "systemRole" FROM public."PlatformUser" WHERE "clerkUserId"=$1 AND "systemRole"='SUPERADMIN'${actorId?' AND id=$2':''}${locked?' FOR SHARE':''}`,actorId?[clerkUserId,actorId]:[clerkUserId]);}catch{fail('PLATFORM_OPERATOR_UNCONFIRMED',503);}
  if(!Array.isArray(result?.rows)||result.rows.length>1)fail('PLATFORM_OPERATOR_UNCONFIRMED',503);
  const row=result.rows[0];if(!row)fail();
  if(!workspaceId(row.id)||row.clerkUserId!==clerkUserId||row.systemRole!=='SUPERADMIN'||actorId&&row.id!==actorId)fail('PLATFORM_OPERATOR_UNCONFIRMED',503);
  return Object.freeze({actorId:row.id,clerkUserId:row.clerkUserId});
 }
 return Object.freeze({
  async authenticate(headers,environment){
   let session;try{session=await verifySession(headers,environment);}catch{fail('PLATFORM_OPERATOR_UNCONFIRMED',503);}
   if(session?.authenticated!==true){if(['IDENTITY_PROVIDER_UNAVAILABLE','IDENTITY_CONFIGURATION_PENDING'].includes(session?.code))fail(session.code,503);fail(session?.code==='SESSION_IMPERSONATION_REJECTED'?session.code:'SESSION_REQUIRED',401);}
   if(session.verification!=='clerk-production-jwt'||session.impersonationRejected!==true||Object.hasOwn(session,'act')||!subject(session.userId)||!sessionId(session.sessionId)||!Number.isSafeInteger(session.expiresAt)||session.expiresAt*1000<=currentTime())fail('PLATFORM_OPERATOR_PROOF_REQUIRED',403);
   const capability=Object.freeze(Object.create(null));capabilities.set(capability,Object.freeze({clerkUserId:session.userId,sessionId:session.sessionId,expiresAt:session.expiresAt}));return capability;
  },
  async requireCurrent(client,capability){
   const captured=capabilities.get(capability);if(!captured)fail('PLATFORM_OPERATOR_PROOF_REQUIRED',403);
   if(captured.expiresAt*1000<=currentTime())fail('SESSION_REQUIRED',401);
   const actor=await lookup(client,captured.clerkUserId);
   if(captured.expiresAt*1000<=currentTime())fail('SESSION_REQUIRED',401);
   // The caller keeps this shared row lock inside its grant transaction. Role
   // removal and identity changes must be checked afresh on the next operation.
   return Object.freeze({...actor,sessionId:captured.sessionId});
  },
  async requireIssuerCurrent(client,issuer){
   if(!issuer||typeof issuer!=='object'||Array.isArray(issuer)||Object.keys(issuer).sort().join('|')!=='actorId|clerkUserId'||!workspaceId(issuer.actorId)||!subject(issuer.clerkUserId))fail('PLATFORM_OPERATOR_PROOF_REQUIRED',403);
   // For persisted grant issuers only; this lookup does not authenticate the
   // caller of an HTTP request. Creation/revocation still require a capability.
   return lookup(client,issuer.clerkUserId,issuer.actorId);
  },
  async readIssuerCurrent(client,issuer){
   if(!issuer||typeof issuer!=='object'||Array.isArray(issuer)||Object.keys(issuer).sort().join('|')!=='actorId|clerkUserId'||!workspaceId(issuer.actorId)||!subject(issuer.clerkUserId))fail('PLATFORM_OPERATOR_PROOF_REQUIRED',403);
   // Read-only company projections never mint capabilities or authorize a
   // dispatch. PostgreSQL READ ONLY transactions cannot acquire row locks.
   return lookup(client,issuer.clerkUserId,issuer.actorId,false);
  },
 });
}

export const productionPlatformOperatorAuthority=createPlatformOperatorAuthority();
