import {createRemoteJWKSet,decodeProtectedHeader,jwtVerify} from 'jose';
import {IDENTITY_JWKS_URL,IDENTITY_ISSUER,IDENTITY_ORIGIN} from './production-identity-config.mjs';
import {BOOTSTRAP_PROFILE_AUDIENCE,validProfileEmail,requireNewCompanyAdmin} from './company-onboarding-policy.mjs';
import {WorkspaceError} from './workspace-policy.mjs';
const keys=createRemoteJWKSet(new URL(IDENTITY_JWKS_URL),{timeoutDuration:5000,cooldownDuration:10000,cacheMaxAge:300000});
export function createBootstrapProfileVerifier(keyResolver,{now=()=>new Date()}={}){
 return async function verify(token,session){
  requireNewCompanyAdmin(session);
  if(typeof token!=='string'||token.length>8192||!token)throw new WorkspaceError('COMPANY_VERIFIED_PROFILE_REQUIRED',403);
  try{
   const header=decodeProtectedHeader(token);
   if(header.alg!=='RS256'||header.typ!=='JWT'||typeof header.kid!=='string'||!/^[A-Za-z0-9_-]{1,160}$/.test(header.kid)||['jku','jwk','x5u','x5c','crit','b64'].some(key=>Object.hasOwn(header,key)))throw new Error();
   const {payload}=await jwtVerify(token,keyResolver,{algorithms:['RS256'],issuer:IDENTITY_ISSUER,audience:BOOTSTRAP_PROFILE_AUDIENCE,requiredClaims:['sub','iss','aud','exp','iat','nbf','jti','email','email_verified'],clockTolerance:5,maxTokenAge:'90s',currentDate:now()});
   if(payload.sub!==session.userId||payload.aud!==BOOTSTRAP_PROFILE_AUDIENCE||payload.purpose!=='new-constructor-profile'||payload.profile_version!==1||payload.email_verified!==true||!validProfileEmail(payload.email)||
      !Number.isSafeInteger(payload.exp)||!Number.isSafeInteger(payload.iat)||!Number.isSafeInteger(payload.nbf)||payload.exp<=payload.iat||payload.exp-payload.iat>90||payload.nbf>payload.exp||
      typeof payload.jti!=='string'||payload.jti.length<8||payload.jti.length>200||payload.act!==undefined||(payload.azp!==undefined&&payload.azp!==IDENTITY_ORIGIN))throw new Error();
   return {userId:session.userId,primaryEmail:payload.email,verified:true,proofType:'clerk-signed-bootstrap-profile',expiresAt:payload.exp};
  }catch(error){
   if(['ERR_JWKS_TIMEOUT','ECONNRESET','ENOTFOUND','ETIMEDOUT'].includes(error?.code))throw new WorkspaceError('COMPANY_IDENTITY_PROVIDER_UNAVAILABLE',503);
   throw new WorkspaceError('COMPANY_VERIFIED_PROFILE_REQUIRED',403);
  }
 };
}
export const verifyBootstrapProfile=createBootstrapProfileVerifier(keys);
