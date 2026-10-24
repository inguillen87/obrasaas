import assert from 'node:assert/strict';
import test from 'node:test';
import {generateKeyPair,exportJWK,createLocalJWKSet,SignJWT} from 'jose';
import {createSessionVerifier} from '../src/lib/verified-session.mjs';
import {createPlatformOperatorAuthority,productionPlatformOperatorAuthority} from '../src/lib/platform-operator-authority.mjs';
import {IDENTITY_ORIGIN,IDENTITY_ISSUER,IDENTITY_PUBLIC_KEY,IDENTITY_INSTANCE} from '../src/lib/production-identity-config.mjs';

const NOW=1900000000;
const config={NEXT_PUBLIC_APP_URL:IDENTITY_ORIGIN,NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:IDENTITY_PUBLIC_KEY,CLERK_EXPECTED_INSTANCE_ID:IDENTITY_INSTANCE,CLERK_AUTHORIZED_PARTIES:IDENTITY_ORIGIN};
const pair=await generateKeyPair('RS256',{modulusLength:2048}),jwk={...await exportJWK(pair.publicKey),kid:'platform_unit_key',alg:'RS256',use:'sig'},keys=createLocalJWKSet({keys:[jwk]});
const fixedNow=()=>new Date(NOW*1000),claims=()=>({iss:IDENTITY_ISSUER,sub:'user_operator',sid:'sess_operator',azp:IDENTITY_ORIGIN,iat:NOW-5,nbf:NOW-5,exp:NOW+55});
const signedHeaders=async patch=>new Headers({authorization:'Bearer '+await new SignJWT({...claims(),...patch}).setProtectedHeader({alg:'RS256',typ:'JWT',kid:jwk.kid}).sign(pair.privateKey)});
const strict=createSessionVerifier(keys,{now:fixedNow,rejectImpersonation:true});
const operator=()=>({id:'platform_operator',clerkUserId:'user_operator',systemRole:'SUPERADMIN'});
const session=()=>({authenticated:true,userId:'user_operator',sessionId:'sess_operator',expiresAt:NOW+55,verification:'clerk-production-jwt',impersonationRejected:true,businessAccessEnabled:false});
const denied=(code,status)=>error=>error?.name==='WorkspaceError'&&error.code===code&&error.status===status;
function database(resolve=()=>[operator()]){const calls=[];return {calls,async query(sql,params){calls.push({sql,params});return {rows:await resolve(sql,params)};}};}

test('a strict signed personal session resolves a fresh canonical operator without company membership',async()=>{
 const authority=createPlatformOperatorAuthority({verifySession:strict,now:fixedNow}),db=database();
 const capability=await authority.authenticate(await signedHeaders(),config);assert.equal(db.calls.length,0);assert.deepEqual(Object.keys(capability),[]);assert.equal(Object.isFrozen(capability),true);
 const result=await authority.requireCurrent(db,capability);assert.deepEqual(result,{actorId:'platform_operator',clerkUserId:'user_operator',sessionId:'sess_operator'});assert.equal(Object.isFrozen(result),true);
 assert.equal(db.calls.length,1);assert.match(db.calls[0].sql,/public\."PlatformUser"/);assert.match(db.calls[0].sql,/"systemRole"='SUPERADMIN'/);assert.match(db.calls[0].sql,/FOR SHARE$/);assert.doesNotMatch(db.calls[0].sql,/TenantMembership|INSERT|UPDATE|DELETE/);assert.deepEqual(db.calls[0].params,['user_operator']);
 for(const name of ['authenticate','requireCurrent','requireIssuerCurrent'])assert.equal(typeof productionPlatformOperatorAuthority[name],'function');
});

test('signed organization administrator and role claims do not grant platform authority',async()=>{
 const authority=createPlatformOperatorAuthority({verifySession:strict,now:fixedNow}),db=database(()=>[]),capability=await authority.authenticate(await signedHeaders({o:{id:'org_customer',rol:'admin'},systemRole:'SUPERADMIN'}),config);
 await assert.rejects(()=>authority.requireCurrent(db,capability),denied('PLATFORM_OPERATOR_REQUIRED',403));assert.equal(db.calls.length,1);
});

test('default non-strict production verification cannot mint an operator capability',async()=>{
 const authority=createPlatformOperatorAuthority({verifySession:createSessionVerifier(keys,{now:fixedNow}),now:fixedNow}),db=database();
 await assert.rejects(async()=>authority.authenticate(await signedHeaders(),config),denied('PLATFORM_OPERATOR_PROOF_REQUIRED',403));assert.equal(db.calls.length,0);
});

test('an actual signed impersonation claim is rejected before any operator database lookup',async()=>{
 const authority=createPlatformOperatorAuthority({verifySession:strict,now:fixedNow}),db=database();
 await assert.rejects(async()=>authority.authenticate(await signedHeaders({act:{sub:'user_other'}}),config),denied('SESSION_IMPERSONATION_REJECTED',401));assert.equal(db.calls.length,0);
});

test('missing session and provider failure remain distinct without exposing diagnostics',async()=>{
 for(const [code,status]of [['SESSION_REQUIRED',401],['SESSION_INVALID',401],['IDENTITY_PROVIDER_UNAVAILABLE',503],['IDENTITY_CONFIGURATION_PENDING',503]]){
  const authority=createPlatformOperatorAuthority({verifySession:async()=>({authenticated:false,code}),now:fixedNow});await assert.rejects(()=>authority.authenticate(new Headers()),denied(status===401?'SESSION_REQUIRED':code,status));
 }
 const authority=createPlatformOperatorAuthority({verifySession:async()=>{throw Error('private provider response');},now:fixedNow});
 await assert.rejects(()=>authority.authenticate(new Headers()),error=>denied('PLATFORM_OPERATOR_UNCONFIRMED',503)(error)&&!error.message.includes('private'));
});

test('a forged, copied or other-instance capability is never accepted',async()=>{
 const authority=createPlatformOperatorAuthority({verifySession:async()=>session(),now:fixedNow}),other=createPlatformOperatorAuthority({verifySession:async()=>session(),now:fixedNow}),db=database(),capability=await authority.authenticate(new Headers()),foreign=await other.authenticate(new Headers());
 for(const forged of [{},session(),{...capability},foreign,null])await assert.rejects(()=>authority.requireCurrent(db,forged),denied('PLATFORM_OPERATOR_PROOF_REQUIRED',403));assert.equal(db.calls.length,0);
});

test('minted identity is captured independently of later verifier-result mutation',async()=>{
 const supplied=session(),authority=createPlatformOperatorAuthority({verifySession:async()=>supplied,now:fixedNow}),db=database(),capability=await authority.authenticate(new Headers());supplied.userId='user_other';supplied.sessionId='sess_other';supplied.expiresAt=NOW-1;
 assert.deepEqual(await authority.requireCurrent(db,capability),{actorId:'platform_operator',clerkUserId:'user_operator',sessionId:'sess_operator'});assert.deepEqual(db.calls[0].params,['user_operator']);
});

test('role revocation is observed on every repeated transactional authorization',async()=>{
 let revoked=false;const db=database(()=>revoked?[]:[operator()]),authority=createPlatformOperatorAuthority({verifySession:async()=>session(),now:fixedNow}),capability=await authority.authenticate(new Headers());
 await authority.requireCurrent(db,capability);revoked=true;await assert.rejects(()=>authority.requireCurrent(db,capability),denied('PLATFORM_OPERATOR_REQUIRED',403));assert.equal(db.calls.length,2);
});

test('expiry is checked before and after asynchronous canonical lookup',async()=>{
 let clock=NOW*1000;const authority=createPlatformOperatorAuthority({verifySession:async()=>session(),now:()=>new Date(clock)}),capability=await authority.authenticate(new Headers()),db=database();clock=(NOW+55)*1000;
 await assert.rejects(()=>authority.requireCurrent(db,capability),denied('SESSION_REQUIRED',401));assert.equal(db.calls.length,0);
 clock=NOW*1000;const next=await authority.authenticate(new Headers()),slow=database(()=>{clock=(NOW+55)*1000;return [operator()];});await assert.rejects(()=>authority.requireCurrent(slow,next),denied('SESSION_REQUIRED',401));assert.equal(slow.calls.length,1);
});

test('malformed strict session outputs cannot authenticate an operator',async()=>{
 for(const patch of [{verification:'decoded-token'},{impersonationRejected:false},{impersonationRejected:undefined},{act:null},{userId:'client_machine'},{sessionId:'bad'},{expiresAt:NOW},{expiresAt:NaN}]){
  const authority=createPlatformOperatorAuthority({verifySession:async()=>({...session(),...patch}),now:fixedNow});await assert.rejects(()=>authority.authenticate(new Headers()),denied('PLATFORM_OPERATOR_PROOF_REQUIRED',403));
 }
});

test('ambiguous, malformed or inconsistent canonical rows fail closed',async()=>{
 for(const rows of [[operator(),operator()],undefined,[{...operator(),id:'invalid id'}],[{...operator(),clerkUserId:'user_other'}],[{...operator(),systemRole:'TENANT_USER'}]]){
  const authority=createPlatformOperatorAuthority({verifySession:async()=>session(),now:fixedNow}),capability=await authority.authenticate(new Headers()),db={query:async()=>({rows})};await assert.rejects(()=>authority.requireCurrent(db,capability),denied('PLATFORM_OPERATOR_UNCONFIRMED',503));
 }
});

test('database and clock errors are sanitized and never fall back to organization authority',async()=>{
 const authority=createPlatformOperatorAuthority({verifySession:async()=>session(),now:fixedNow}),capability=await authority.authenticate(new Headers());
 for(const db of [null,{query:async()=>{throw Error('private database details');}}])await assert.rejects(()=>authority.requireCurrent(db,capability),error=>denied('PLATFORM_OPERATOR_UNCONFIRMED',503)(error)&&!error.message.includes('private'));
 const noClock=createPlatformOperatorAuthority({verifySession:async()=>session(),now:()=>new Date(NaN)});await assert.rejects(()=>noClock.authenticate(new Headers()),denied('PLATFORM_OPERATOR_UNCONFIRMED',503));
});

test('persisted issuer revalidation binds actor and subject and repeats fresh role lookup',async()=>{
 let revoked=false;const authority=createPlatformOperatorAuthority({verifySession:async()=>session(),now:fixedNow}),db=database(()=>revoked?[]:[operator()]),issuer={actorId:'platform_operator',clerkUserId:'user_operator'};
 assert.deepEqual(await authority.requireIssuerCurrent(db,issuer),issuer);assert.deepEqual(db.calls[0].params,['user_operator','platform_operator']);assert.match(db.calls[0].sql,/AND id=\$2 FOR SHARE$/);revoked=true;await assert.rejects(()=>authority.requireIssuerCurrent(db,issuer),denied('PLATFORM_OPERATOR_REQUIRED',403));assert.equal(db.calls.length,2);
});

test('issuer DTO is not an authenticated caller and malformed issuer references never query',async()=>{
 const authority=createPlatformOperatorAuthority({verifySession:async()=>session(),now:fixedNow}),db=database(),issuer={actorId:'platform_operator',clerkUserId:'user_operator'};
 await assert.rejects(()=>authority.requireCurrent(db,issuer),denied('PLATFORM_OPERATOR_PROOF_REQUIRED',403));
 for(const bad of [{...issuer,systemRole:'SUPERADMIN'},{...issuer,clerkUserId:'machine'},null,[],{actorId:'another'}])await assert.rejects(()=>authority.requireIssuerCurrent(db,bad),denied('PLATFORM_OPERATOR_PROOF_REQUIRED',403));assert.equal(db.calls.length,0);
 const inconsistent=database(()=>[{...operator(),id:'another_operator'}]);await assert.rejects(()=>authority.requireIssuerCurrent(inconsistent,issuer),denied('PLATFORM_OPERATOR_UNCONFIRMED',503));
});

test('read-only issuer projection never acquires a lock or becomes a caller capability',async()=>{
 const authority=createPlatformOperatorAuthority({verifySession:async()=>session(),now:fixedNow}),db=database(),issuer={actorId:'platform_operator',clerkUserId:'user_operator'};
 assert.deepEqual(await authority.readIssuerCurrent(db,issuer),issuer);assert.doesNotMatch(db.calls[0].sql,/FOR SHARE|FOR UPDATE/);
 await assert.rejects(()=>authority.requireCurrent(db,issuer),denied('PLATFORM_OPERATOR_PROOF_REQUIRED',403));
 await authority.requireIssuerCurrent(db,issuer);assert.match(db.calls[1].sql,/FOR SHARE$/);
});
