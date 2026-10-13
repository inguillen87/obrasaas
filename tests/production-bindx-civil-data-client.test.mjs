import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createBindxCivilDataClient,bindxCivilContextDigest,BINDX_CIVIL_CONFIGURATION_VERSION,BINDX_CIVIL_CONSENT_VERSION,BINDX_CIVIL_RESPONSE_SCHEMA} from '../src/lib/bindx-civil-data-client.mjs';

// Synthetic contract fixtures only: no provider credential, person or wire I/O.
const origin='https://apistore.pcnt.io',now=Date.parse('2026-10-12T11:00:00.000Z'),token='synthetic.header.signature';
const context=()=>({organizationId:'synthetic-company',actorId:'synthetic-actor',subjectId:'synthetic-person',submissionId:'synthetic-submission',operationId:'01234567-89ab-4cde-8fab-0123456789ab',documentSha256:'a'.repeat(64),dni:'00000000',gender:'F'});
const civil=()=>({nombres:'PERSONA SINTÉTICA',apellido:'SIN IDENTIDAD REAL',ejemplar:'A',fecha_nacimiento:'12/02/2000',emision:'01/10/2025',vencimiento:'01/10/2030',codigo_fallecido:0});
function configuration(){
 const current=context();
 return {version:BINDX_CIVIL_CONFIGURATION_VERSION,state:'CONFIRMED',product:'RENAPER_CIVIL_DATA',origin,authentication:'JWT',credentials:{username:'synthetic-user-not-a-provider-credential',password:'synthetic-secret-not-a-provider-credential'},providerEvidence:{reference:'synthetic-provider-review',confirmedAt:'2026-10-12T10:00:00.000Z',confirmed:true,origin,product:'RENAPER_CIVIL_DATA',authentication:'JWT',responseSchema:BINDX_CIVIL_RESPONSE_SCHEMA,environmentConfirmed:true},renaperAgreement:{reference:'synthetic-agreement',confirmedAt:'2026-10-12T10:00:00.000Z',confirmed:true},context:current,consent:{version:BINDX_CIVIL_CONSENT_VERSION,reference:'synthetic-consent',acceptedAt:'2026-10-12T10:30:00.000Z',confirmed:true,provider:'BINDX_APISTORE',purpose:'RENAPER_CIVIL_DATA',contextDigest:bindxCivilContextDigest(current)}};
}
function fixture({config=configuration(),beforeExternal=async()=>true,onTechnicalObservation=null,technicalObservationTimeoutMs=6000,timeoutMs=1000,clock=()=>now,login,person,transport,clientFactory=createBindxCivilDataClient}={}){
 const calls=[];
 const fetchImpl=async(url,options)=>{calls.push({url,options});if(transport)return transport(url,options,calls.length);return calls.length===1?(login||Response.json({token,expires_in:600})):(person||Response.json(civil()));};
 return {calls,client:clientFactory({configuration:config,beforeExternal,onTechnicalObservation,technicalObservationTimeoutMs,fetchImpl,timeoutMs,clock})};
}
function closed(result){assert.equal(result.identityCertified,false);assert.equal(result.biometricsVerified,false);assert.equal(result.livenessVerified,false);assert.equal(result.permissionsGranted,false);assert.equal(result.requiresHumanReview,true);}

test('default and explicit pending contracts perform no global or injected HTTP',async()=>{
 let calls=0;const original=globalThis.fetch;globalThis.fetch=async()=>{calls++;throw Error('Real provider forbidden');};
 try{for(const client of [createBindxCivilDataClient(),createBindxCivilDataClient({configuration:{state:'CONTRACT_PENDING'}}),createBindxCivilDataClient({fetchImpl:globalThis.fetch})]){assert.equal(client.readiness().state,'CONTRACT_PENDING');assert.equal(client.readiness().providerAcceptanceVerified,false);const result=await client.lookup();assert.equal(result.state,'CONTRACT_PENDING');assert.equal(result.data,null);assert.equal(result.bindingDigest,null);closed(result);}assert.equal(calls,0);}finally{globalThis.fetch=original;}
});
test('only the server-bound public login and civil query are sent with exact credentials and JWT scheme',async()=>{
 const stages=[],f=fixture({beforeExternal:async value=>{stages.push(value);assert.equal(value.subjectId,'synthetic-person');assert.equal(value.documentSha256,'a'.repeat(64));assert.equal(value.consentReference,'synthetic-consent');assert.equal(value.dni,undefined);return true;}}),result=await f.client.lookup();
 assert.equal(f.client.readiness().state,'TRANSPORT_CONFIGURED');assert.equal(f.client.readiness().providerAcceptanceVerified,false);assert.deepEqual(f.calls.map(row=>[row.url,row.options.method]),[[origin+'/v1/login/jwt','POST'],[origin+'/v1/information/person-renaper/00000000/gender/F','GET']]);assert.deepEqual(JSON.parse(f.calls[0].options.body),configuration().credentials);assert.equal(f.calls[0].options.headers.Authorization,undefined);assert.equal(f.calls[1].options.headers.Authorization,'JWT '+token);assert.equal(f.calls[1].options.body,undefined);
 for(const call of f.calls){assert.equal(call.options.redirect,'error');assert.equal(call.options.credentials,'omit');assert.equal(call.options.cache,'no-store');assert.equal(call.options.referrerPolicy,'no-referrer');assert.equal(call.options.signal.aborted,true);}
 assert.deepEqual(stages.map(value=>value.stage),['LOGIN','LOOKUP','RETURN_RESULT']);assert.ok(stages.every(value=>Object.isFrozen(value)));assert.equal(result.state,'OBSERVED');assert.equal(result.queryAttempted,true);assert.equal(result.observedAt,'2026-10-12T11:00:00.000Z');assert.deepEqual(result.data,civil());assert.equal(Object.isFrozen(result.data),true);closed(result);
 assert.doesNotMatch(JSON.stringify(result),/00000000|synthetic-secret|synthetic-user|synthetic\.header|https:|\/v1\//);
});
test('private observed facts carry the immutable digest of their exact actor and document submission',async()=>{
 const digests=[];
 for(const changed of [{},{actorId:'different-synthetic-actor'},{documentSha256:'b'.repeat(64)}]){const config=configuration();Object.assign(config.context,changed);const expected=bindxCivilContextDigest(config.context);config.consent.contextDigest=expected;const f=fixture({config}),result=await f.client.lookup();assert.equal(result.state,'OBSERVED');assert.equal(result.bindingDigest,expected);assert.match(result.bindingDigest,/^[a-f0-9]{64}$/);assert.equal(Object.isFrozen(result),true);assert.throws(()=>{result.bindingDigest='0'.repeat(64);},TypeError);assert.doesNotMatch(JSON.stringify(result),/different-synthetic-actor|synthetic-submission|synthetic-company|00000000/);closed(result);digests.push(result.bindingDigest);}
 assert.equal(new Set(digests).size,3);
});
test('HTTP inputs cannot replace server context consent origin auth or a captured DNI',async()=>{
 const f=fixture();for(const input of [{dni:'99999999',gender:'M'},{origin:'https://foreign.invalid'},{consent:{confirmed:true}},undefined]){assert.equal((await f.client.lookup(input)).code,'BINDX_CIVIL_SERVER_CONTEXT_REQUIRED');assert.equal(f.calls.length,0);}assert.equal((await f.client.lookup()).state,'OBSERVED');assert.equal(f.calls.length,2);
});
test('foreign origins ports redirects paths and PSP account products stay closed before HTTP',async()=>{
 for(const changed of [{origin:'http://apistore.pcnt.io'},{origin:'https://apistore.pcnt.io/'},{origin:'https://apistore.pcnt.io:443'},{origin:'https://apistore.pcnt.io.'},{origin:'https://user:pass@apistore.pcnt.io'},{origin:'https://apistore.pcnt.io/v1/login/jwt'},{origin:'https://api.bindpagos.com.ar'},{origin:'https://foreign.invalid'},{origin:undefined},{product:'WALLET'},{product:'ONBOARDING'},{authentication:'Bearer'}]){const f=fixture({config:{...configuration(),...changed}}),result=await f.client.lookup();assert.equal(result.state,'CONFIGURATION_REJECTED');assert.equal(f.calls.length,0);closed(result);}
});
test('provider contract environment schema and separate RENAPER agreement require confirmed server evidence',async()=>{
 const changes=[c=>delete c.providerEvidence,c=>c.providerEvidence.confirmed=false,c=>c.providerEvidence.environmentConfirmed=false,c=>c.providerEvidence.origin='https://foreign.invalid',c=>c.providerEvidence.product='WALLET',c=>c.providerEvidence.authentication='Bearer',c=>c.providerEvidence.responseSchema='guessed-schema',c=>c.providerEvidence.confirmedAt='2026-10-13T10:00:00.000Z',c=>delete c.renaperAgreement,c=>c.renaperAgreement.confirmed=false,c=>c.renaperAgreement.reference='',c=>c.renaperAgreement.confirmedAt='invalid',c=>delete c.credentials.password,c=>c.credentials.password='x'.repeat(4097),c=>c.credentials.username+='\n'];
 for(const change of changes){const config=configuration();change(config);const f=fixture({config});assert.equal((await f.client.lookup()).state,'CONFIGURATION_REJECTED');assert.equal(f.calls.length,0);}
});
test('consent must bind the exact current company actor person operation submission bytes DNI and gender',async()=>{
 for(const [key,value] of [['organizationId','other-company'],['actorId','other-actor'],['subjectId','other-person'],['submissionId','other-submission'],['operationId','01234567-89ab-4cde-8fab-0123456789ac'],['documentSha256','b'.repeat(64)],['dni','99999999'],['gender','M']]){const config=configuration();config.context[key]=value;const f=fixture({config});assert.equal((await f.client.lookup()).code,'BINDX_CIVIL_CONSENT_REQUIRED');assert.equal(f.calls.length,0);}
 for(const changed of [{confirmed:false},{version:'participant-private-biometric-v1'},{version:'participant-ocr-v1'},{provider:'OTHER'},{purpose:'WALLET'},{contextDigest:'b'.repeat(64)},{acceptedAt:'2026-10-13T00:00:00.000Z'}]){const config=configuration();Object.assign(config.consent,changed);const f=fixture({config});assert.equal((await f.client.lookup()).code,'BINDX_CIVIL_CONSENT_REQUIRED');assert.equal(f.calls.length,0);}
});
test('unsupported or malformed source context is not guessed normalized or sent',async()=>{
 for(const changed of [{gender:'X'},{gender:'f'},{dni:' 00000000'},{dni:'00000000?query=x'},{dni:'00000000/gender/M'},{dni:''},{dni:'1'.repeat(21)},{documentSha256:'A'.repeat(64)},{operationId:'________-____-4abc-8abc-abcdef123456'},{subjectId:'person@example.invalid'}]){const config=configuration();Object.assign(config.context,changed);const f=fixture({config});assert.equal((await f.client.lookup()).code,'BINDX_CIVIL_CONTEXT_INVALID');assert.equal(f.calls.length,0);}
});
test('configuration is captured immutably and credential whitespace is preserved rather than rewritten',async()=>{
 const config=configuration();config.credentials.password='  synthetic private secret  ';const expected=config.credentials.password,f=fixture({config});config.origin='https://foreign.invalid';config.context.dni='99999999';config.context.gender='M';config.credentials.password='changed';config.consent.contextDigest='b'.repeat(64);
 assert.equal((await f.client.lookup()).state,'OBSERVED');assert.equal(JSON.parse(f.calls[0].options.body).password,expected);assert.equal(f.calls[1].url,origin+'/v1/information/person-renaper/00000000/gender/F');
});
test('fresh canonical denial before login never discloses credentials and before lookup never discloses DNI',async()=>{
 for(const [stage,count] of [['LOGIN',0],['LOOKUP',1]]){const f=fixture({beforeExternal:async value=>{if(value.stage===stage)throw Error('private canonical authority details');return true;}}),result=await f.client.lookup();assert.equal(result.state,'AUTHORITY_DENIED');assert.equal(result.data,null);assert.equal(result.queryAttempted,false);assert.equal(f.calls.length,count);assert.doesNotMatch(JSON.stringify(result),/private canonical/);}
 const f=fixture({beforeExternal:async()=>undefined});assert.equal((await f.client.lookup()).state,'AUTHORITY_DENIED');assert.equal(f.calls.length,0);
});
test('revocation during a provider response denies the private result and no retry occurs',async()=>{
 let allowed=true;const f=fixture({beforeExternal:async()=>allowed,transport:async(_url,_options,count)=>{if(count===1)return Response.json({token});allowed=false;return Response.json(civil());}}),result=await f.client.lookup();assert.equal(result.state,'AUTHORITY_DENIED');assert.equal(result.data,null);assert.equal(result.queryAttempted,true);assert.equal(f.calls.length,2);const replay=await f.client.lookup();assert.equal(replay.code,'BINDX_CIVIL_OPERATION_ALREADY_ATTEMPTED');assert.equal(replay.queryAttempted,true);assert.equal(replay.data,null);assert.equal(f.calls.length,2);
});
test('concurrent and repeated calls on the same transport never dispatch another login or query',async()=>{
 let release,entered;const atLogin=new Promise(resolve=>{entered=resolve;}),wait=new Promise(resolve=>{release=resolve;}),f=fixture({transport:async(_url,_options,count)=>{if(count===1){entered();await wait;return Response.json({token});}return Response.json(civil());}}),first=f.client.lookup();await atLogin;const second=await f.client.lookup();assert.equal(second.code,'BINDX_CIVIL_OPERATION_ALREADY_ATTEMPTED');assert.equal(f.calls.length,1);release();assert.equal((await first).state,'OBSERVED');assert.equal((await f.client.lookup()).code,'BINDX_CIVIL_OPERATION_ALREADY_ATTEMPTED');assert.equal(f.calls.length,2);
});
test('empty-body errors redirects and arbitrary provider messages are sanitized without automatic reauth',async()=>{
 for(const [stage,status] of [['LOGIN',401],['LOGIN',409],['LOOKUP',401],['LOOKUP',409],['LOOKUP',500]]){let read=0;const rejected=new Response('private provider error',{status}),original=rejected.body.getReader.bind(rejected.body);rejected.body.getReader=(...args)=>{read++;return original(...args);};const f=fixture(stage==='LOGIN'?{login:rejected}:{person:rejected}),result=await f.client.lookup();assert.equal(result.state,stage==='LOGIN'?'AUTH_REJECTED':'REQUEST_REJECTED');assert.equal(result.httpStatus,status);assert.equal(result.data,null);assert.equal(f.calls.length,stage==='LOGIN'?1:2);assert.equal(read,0);closed(result);await f.client.lookup();assert.equal(f.calls.length,stage==='LOGIN'?1:2);}
 for(const patch of [{redirected:true},{url:'https://foreign.invalid/private-dni'}]){const response=Response.json(civil());for(const[key,value]of Object.entries(patch))Object.defineProperty(response,key,{value});const f=fixture({person:response}),result=await f.client.lookup();assert.equal(result.state,'UNKNOWN');assert.equal(result.code,'BINDX_CIVIL_RESPONSE_INVALID');assert.doesNotMatch(JSON.stringify(result),/foreign|private-dni/);}
});
test('login schema never guesses OAuth credentials token types or unsafe header strings',async()=>{
 for(const data of [{access_token:token},{token:'raw-secret'},{token:'header.payload.signature\r\nInjected: secret'},{token:'a'.repeat(8193)},{token,expires_in:0},{token,expires_in:'600'},{token:null}]){const f=fixture({login:Response.json(data)}),result=await f.client.lookup();assert.equal(result.code,'BINDX_CIVIL_AUTH_SCHEMA_UNCONFIRMED');assert.equal(f.calls.length,1);assert.equal(result.data,null);assert.doesNotMatch(JSON.stringify(result),/raw-secret|Injected/);}
});
test('civil response projects minimal private fields without liveness approval tokens addresses or raw IDs',async()=>{
 const f=fixture({person:Response.json({...civil(),codigo_fallecido:99,token:'private-provider-token',rawResponse:'private body',id_ciudadano:'private-id',calle:'private address',identityCertified:true,livenessVerified:true,permissionsGranted:true,addaliaPruebaVida:true})}),result=await f.client.lookup();assert.equal(result.state,'OBSERVED');assert.equal(result.data.codigo_fallecido,99);assert.deepEqual(Object.keys(result.data).sort(),Object.keys(civil()).sort());closed(result);assert.doesNotMatch(JSON.stringify(result),/private-provider-token|private body|private-id|private address|addalia/);
});
test('HTTP 200 with missing wrong-type error or ambiguous date fields remains UNKNOWN without certification',async()=>{
 const changes=[{nombres:''},{apellido:null},{ejemplar:1},{fecha_nacimiento:'2000-02-12'},{fecha_nacimiento:'31/02/2000'},{emision:'01/13/2025'},{vencimiento:'00/10/2030'},{codigo_fallecido:'0'},{codigo_fallecido:-1},{codigo_fallecido:Number.MAX_SAFE_INTEGER},{codigo_fallecido:.5}];
 for(const data of [null,[],{code:'GENERAL_ERROR',message:'private upstream error'},...changes.map(patch=>({...civil(),...patch}))]){const f=fixture({person:Response.json(data)}),result=await f.client.lookup();assert.equal(result.state,'UNKNOWN');assert.equal(result.code,'BINDX_CIVIL_RESPONSE_SCHEMA_UNCONFIRMED');assert.equal(result.data,null);assert.equal(result.queryAttempted,true);closed(result);assert.equal(f.calls.length,2);}
});
test('JSON content type size UTF8 and declared lengths are bounded for both responses',async()=>{
 const bad=[()=>new Response('{}',{headers:{'Content-Type':'text/html'}}),()=>new Response('{invalid',{headers:{'Content-Type':'application/json'}}),()=>new Response(new Uint8Array([0xc3,0x28]),{headers:{'Content-Type':'application/json'}}),()=>new Response('{}',{headers:{'Content-Type':'application/json','Content-Length':'999999'}}),()=>new Response('x'.repeat(32769),{headers:{'Content-Type':'application/json'}})];
 for(const stage of ['LOGIN','LOOKUP'])for(const response of bad){const f=fixture(stage==='LOGIN'?{login:response()}:{person:response()}),result=await f.client.lookup();assert.equal(result.state,'UNKNOWN');assert.equal(result.data,null);assert.equal(f.calls.length,stage==='LOGIN'?1:2);assert.ok(['BINDX_CIVIL_RESPONSE_INVALID','BINDX_CIVIL_RESPONSE_TOO_LARGE'].includes(result.code));closed(result);}
});
test('timeout covers stalled transport and authorization and cannot dispatch after its deadline',async()=>{
 for(const stage of ['LOGIN','LOOKUP']){const f=fixture({timeoutMs:15,transport:async(_url,_options,count)=>count===1&&stage==='LOOKUP'?Response.json({token}):new Promise(()=>{})}),result=await f.client.lookup();assert.equal(result.code,'BINDX_CIVIL_TIMEOUT');assert.equal(result.queryAttempted,stage==='LOOKUP');assert.equal(f.calls.length,stage==='LOGIN'?1:2);assert.ok(f.calls.every(value=>value.options.signal.aborted));await f.client.lookup();assert.equal(f.calls.length,stage==='LOGIN'?1:2);}
 let finish;const held=new Promise(resolve=>{finish=resolve;}),f=fixture({timeoutMs:15,beforeExternal:async()=>{await held;return true;}});assert.equal((await f.client.lookup()).code,'BINDX_CIVIL_TIMEOUT');finish();await new Promise(resolve=>setTimeout(resolve,5));assert.equal(f.calls.length,0);
});
test('timeout also aborts a stalled response body and releases its reader without returning private data',async()=>{
 let cancelled=0;const f=fixture({timeoutMs:15,person:new Response(new ReadableStream({pull:()=>new Promise(()=>{}),cancel(){cancelled++;}}),{headers:{'Content-Type':'application/json'}})}),result=await f.client.lookup();assert.equal(result.code,'BINDX_CIVIL_TIMEOUT');assert.equal(result.queryAttempted,true);assert.equal(result.data,null);assert.ok(cancelled>=1);assert.equal(f.calls.length,2);
});
test('one deadline spans login and lookup and cancels a late response from an uncooperative transport',async()=>{
 // Control the monotonic timeline instead of assuming that a 15 ms timer gets
 // a CPU slice before a 25 ms deadline while other test files run in parallel.
 const own=Object.getOwnPropertyDescriptor(performance,'now');let elapsed=0,cancelCount=0,finish;Object.defineProperty(performance,'now',{configurable:true,value:()=>elapsed});
 try{const late=new Promise(resolve=>{finish=resolve;}),f=fixture({timeoutMs:25,transport:async(_url,_options,count)=>{if(count===1){elapsed=15;return Response.json({token});}elapsed=26;return late;}}),result=await f.client.lookup();assert.equal(result.code,'BINDX_CIVIL_TIMEOUT');assert.equal(result.queryAttempted,true);assert.equal(f.calls.length,2);finish(new Response(new ReadableStream({cancel(){cancelCount++;}}),{headers:{'Content-Type':'application/json'}}));await new Promise(resolve=>setImmediate(resolve));assert.equal(cancelCount,1);assert.equal(result.data,null);await f.client.lookup();assert.equal(f.calls.length,2);}
 finally{if(own)Object.defineProperty(performance,'now',own);else delete performance.now;}
});
test('an elapsed synchronous canonical fence cannot dispatch after blocking the timer callback',async()=>{
 const f=fixture({timeoutMs:5,beforeExternal:()=>{const until=performance.now()+15;while(performance.now()<until){/* Controlled synchronous fixture delay. */}return true;}}),result=await f.client.lookup();assert.equal(result.code,'BINDX_CIVIL_TIMEOUT');assert.equal(f.calls.length,0);
});
test('a slow final clock cannot turn an elapsed deadline into observed private data',async()=>{
 let clockCalls=0;const f=fixture({timeoutMs:100,clock:()=>{if(++clockCalls===2){const until=performance.now()+120;while(performance.now()<until){/* Controlled final timestamp delay. */}}return now;}}),result=await f.client.lookup();assert.equal(clockCalls,2);assert.equal(f.calls.length,2);assert.equal(result.code,'BINDX_CIVIL_TIMEOUT');assert.equal(result.data,null);assert.equal(result.queryAttempted,true);
});
test('raw transport failures and option errors never contain private data or create extra requests',async()=>{
 const f=fixture({transport:async()=>{throw Error('secret password 00000000 /v1/private');}}),result=await f.client.lookup();assert.equal(result.code,'BINDX_CIVIL_TRANSPORT_UNCONFIRMED');assert.doesNotMatch(JSON.stringify(result),/secret|password|00000000|private/);assert.equal(f.calls.length,1);
 for(const options of [{timeoutMs:0},{timeoutMs:30001},{timeoutMs:1.5},{fetchImpl:null},{clock:null}])assert.throws(()=>createBindxCivilDataClient(options),{message:'BINDX_CIVIL_CLIENT_OPTIONS_INVALID'});
});

test('technical observation is awaited once after projection and before private result authority',async()=>{
 const events=[],observations=[],f=fixture({beforeExternal:async value=>{events.push(value.stage);return true;},transport:async(_url,_options,count)=>{events.push(count===1?'LOGIN_HTTP':'LOOKUP_HTTP');return Response.json(count===1?{token}:{...civil(),calle:'PRIVATE_ADDRESS',token:'PRIVATE_PROVIDER_TOKEN',identityCertified:true});},onTechnicalObservation:async value=>{events.push('TECHNICAL_BEGIN');await Promise.resolve();observations.push(value);events.push('TECHNICAL_COMMITTED');}}),result=await f.client.lookup();
 assert.deepEqual(events,['LOGIN','LOGIN_HTTP','LOOKUP','LOOKUP_HTTP','TECHNICAL_BEGIN','TECHNICAL_COMMITTED','RETURN_RESULT']);assert.equal(observations.length,1);assert.equal(observations[0],result);assert.equal(result.state,'OBSERVED');assert.equal(result.httpStatus,200);assert.equal(result.queryAttempted,true);assert.equal(Object.isFrozen(result),true);assert.equal(Object.isFrozen(result.data),true);assert.deepEqual(result.data,civil());closed(result);assert.doesNotMatch(JSON.stringify(observations),/PRIVATE_ADDRESS|PRIVATE_PROVIDER_TOKEN|00000000|synthetic-secret|synthetic\.header|https:|\/v1\//);
 assert.equal((await f.client.lookup()).code,'BINDX_CIVIL_OPERATION_ALREADY_ATTEMPTED');assert.equal(observations.length,1);assert.equal(f.calls.length,2);
});

test('post-query revocation preserves technical OBSERVED while the private result remains denied',async()=>{
 let allowed=true;const observations=[],stages=[],f=fixture({beforeExternal:async value=>{stages.push(value.stage);return allowed;},transport:async(_url,_options,count)=>{if(count===1)return Response.json({token});allowed=false;return Response.json(civil());},onTechnicalObservation:async value=>{assert.equal(allowed,false);observations.push(value);}}),result=await f.client.lookup();
 assert.equal(result.state,'AUTHORITY_DENIED');assert.equal(result.data,null);assert.equal(result.queryAttempted,true);assert.deepEqual(stages,['LOGIN','LOOKUP','RETURN_RESULT']);assert.equal(observations.length,1);assert.equal(observations[0].state,'OBSERVED');assert.deepEqual(observations[0].data,civil());closed(observations[0]);await f.client.lookup();assert.equal(f.calls.length,2);assert.equal(observations.length,1);
});

test('revocation inside the awaited technical callback cannot bypass the later private fence',async()=>{
 let allowed=true,committed=0;const f=fixture({beforeExternal:async()=>allowed,onTechnicalObservation:async value=>{assert.equal(value.state,'OBSERVED');committed++;await Promise.resolve();allowed=false;}}),result=await f.client.lookup();
 assert.equal(committed,1);assert.equal(result.state,'AUTHORITY_DENIED');assert.equal(result.data,null);assert.equal(result.queryAttempted,true);assert.equal(f.calls.length,2);closed(result);
});

test('pending rejected and pre-query authority states do not manufacture a technical civil observation',async()=>{
 let observations=0,calls=0;const observer=async()=>{observations++;},fetchImpl=async()=>{calls++;throw Error('Synthetic transport must stay closed');};
 for(const config of [null,{state:'CONTRACT_PENDING'},{...configuration(),origin:'https://foreign.invalid'}]){const client=createBindxCivilDataClient({configuration:config,beforeExternal:async()=>true,onTechnicalObservation:observer,fetchImpl,clock:()=>now});assert.equal((await client.lookup()).queryAttempted,false);}
 assert.equal(calls,0);assert.equal(observations,0);
 for(const stage of ['LOGIN','LOOKUP']){const f=fixture({beforeExternal:async value=>value.stage!==stage,onTechnicalObservation:observer}),result=await f.client.lookup();assert.equal(result.state,'AUTHORITY_DENIED');assert.equal(result.queryAttempted,false);assert.equal(f.calls.length,stage==='LOGIN'?0:1);}
 const login=fixture({login:new Response(null,{status:401}),onTechnicalObservation:observer});assert.equal((await login.client.lookup()).state,'AUTH_REJECTED');assert.equal(login.calls.length,1);
 const invalid=fixture({onTechnicalObservation:observer});assert.equal((await invalid.client.lookup({dni:'99999999'})).state,'INPUT_REJECTED');assert.equal(invalid.calls.length,0);assert.equal(observations,0);
});

test('actual query failures observe UNKNOWN once without trusting a successful HTTP body as civil evidence',async()=>{
 const cases=[
  ['schema',()=>Response.json({state:'OBSERVED',identityCertified:true,code:'PRIVATE_ERROR'}),'BINDX_CIVIL_RESPONSE_SCHEMA_UNCONFIRMED'],
  ['json',()=>new Response('{PRIVATE_INVALID',{headers:{'Content-Type':'application/json'}}),'BINDX_CIVIL_RESPONSE_INVALID'],
  ['http',()=>new Response('PRIVATE_REJECTED',{status:429}),'BINDX_CIVIL_REQUEST_REJECTED'],
  ['transport',()=>{throw Error('PRIVATE_PASSWORD synthetic.header.signature');},'BINDX_CIVIL_TRANSPORT_UNCONFIRMED'],
 ];
 for(const [mode,person,code] of cases){const observations=[],f=fixture({transport:async(_url,_options,count)=>count===1?Response.json({token}):person(),onTechnicalObservation:async value=>observations.push(value)}),result=await f.client.lookup();assert.equal(result.state,mode==='http'?'REQUEST_REJECTED':'UNKNOWN');assert.equal(result.code,code);assert.equal(observations.length,1);assert.equal(observations[0].state,'UNKNOWN');assert.equal(observations[0].code,code);assert.equal(observations[0].httpStatus,mode==='http'?429:null);assert.equal(observations[0].queryAttempted,true);assert.equal(observations[0].data,null);assert.equal(observations[0].observedAt,null);closed(observations[0]);assert.equal(Object.isFrozen(observations[0]),true);assert.doesNotMatch(JSON.stringify([result,...observations]),/PRIVATE_|synthetic\.header/);await f.client.lookup();assert.equal(observations.length,1);assert.equal(f.calls.length,2);}
});

test('query timeout still attempts local UNKNOWN settlement after the wire deadline without another request',async()=>{
 const observations=[],f=fixture({timeoutMs:10,technicalObservationTimeoutMs:100,transport:async(_url,_options,count)=>count===1?Response.json({token}):new Promise(()=>{}),onTechnicalObservation:async value=>{await Promise.resolve();observations.push(value);}}),result=await f.client.lookup();
 assert.equal(result.code,'BINDX_CIVIL_TIMEOUT');assert.equal(result.data,null);assert.equal(observations.length,1);assert.equal(observations[0].state,'UNKNOWN');assert.equal(observations[0].code,'BINDX_CIVIL_TIMEOUT');assert.equal(observations[0].queryAttempted,true);assert.equal(f.calls.length,2);assert.equal(f.calls[1].options.signal.aborted,true);await f.client.lookup();assert.equal(f.calls.length,2);assert.equal(observations.length,1);
});

test('technical callback failure never leaks private data exceptions or a second observation and cannot re-dispatch',async()=>{
 for(const valid of [true,false]){const observations=[],f=fixture({person:valid?Response.json(civil()):Response.json({code:'PRIVATE_BODY'}),onTechnicalObservation:async value=>{observations.push(value);throw Error('PRIVATE_TOKEN synthetic.header.signature 00000000');}}),result=await f.client.lookup();assert.equal(result.state,'UNKNOWN');assert.equal(result.code,'BINDX_CIVIL_TECHNICAL_OBSERVATION_UNCONFIRMED');assert.equal(result.data,null);assert.equal(result.queryAttempted,true);assert.equal(observations.length,1);assert.equal(observations[0].state,valid?'OBSERVED':'UNKNOWN');assert.doesNotMatch(JSON.stringify(result),/PRIVATE_|synthetic\.header|00000000|PERSONA SINTÉTICA/);closed(result);await f.client.lookup();assert.equal(f.calls.length,2);assert.equal(observations.length,1);}
});

test('a hung technical observer is bounded and its late commit cannot return private data or overwrite OBSERVED with UNKNOWN',async()=>{
 let release,committed=null;const held=new Promise(resolve=>{release=resolve;}),observations=[],stages=[],f=fixture({technicalObservationTimeoutMs:10,beforeExternal:async value=>{stages.push(value.stage);return true;},onTechnicalObservation:async value=>{observations.push(value);await held;committed=value.state;}}),started=performance.now(),result=await f.client.lookup();
 assert.ok(performance.now()-started<500);assert.equal(result.state,'UNKNOWN');assert.equal(result.code,'BINDX_CIVIL_TECHNICAL_OBSERVATION_UNCONFIRMED');assert.equal(result.data,null);assert.equal(observations.length,1);assert.equal(observations[0].state,'OBSERVED');assert.deepEqual(stages,['LOGIN','LOOKUP']);assert.equal(committed,null);assert.equal((await f.client.lookup()).code,'BINDX_CIVIL_OPERATION_ALREADY_ATTEMPTED');release();await new Promise(resolve=>setImmediate(resolve));assert.equal(committed,'OBSERVED');assert.equal(observations.length,1);assert.equal(f.calls.length,2);assert.equal(result.data,null);
});

test('local technical settlement can finish after the wire budget but cannot authorize a private result',async()=>{
 const observations=[],f=fixture({timeoutMs:10,technicalObservationTimeoutMs:100,onTechnicalObservation:async value=>{await new Promise(resolve=>setTimeout(resolve,20));observations.push(value);}}),result=await f.client.lookup();
 assert.equal(observations.length,1);assert.equal(observations[0].state,'OBSERVED');assert.equal(result.state,'UNKNOWN');assert.equal(result.code,'BINDX_CIVIL_TIMEOUT');assert.equal(result.data,null);assert.equal(result.queryAttempted,true);await f.client.lookup();assert.equal(observations.length,1);assert.equal(f.calls.length,2);
});

test('captured technical and return contexts remain immutable when configuration changes inside the observer',async()=>{
 const config=configuration(),bindingDigest=bindxCivilContextDigest(config.context),stages=[],observations=[],f=fixture({config,beforeExternal:async value=>{stages.push(value);return true;},onTechnicalObservation:async value=>{observations.push(value);assert.throws(()=>{value.bindingDigest='b'.repeat(64);},TypeError);assert.throws(()=>{value.data.nombres='PRIVATE_MUTATED';},TypeError);config.context.actorId='other-synthetic-actor';config.context.documentSha256='b'.repeat(64);config.context.dni='99999999';config.credentials.password='PRIVATE_CHANGED';config.consent.contextDigest='b'.repeat(64);}}),result=await f.client.lookup();
 assert.equal(result.state,'OBSERVED');assert.equal(result.bindingDigest,bindingDigest);assert.equal(observations.length,1);assert.ok(stages.every(value=>Object.isFrozen(value)&&value.bindingDigest===bindingDigest&&value.actorId==='synthetic-actor'&&value.documentSha256==='a'.repeat(64)));assert.equal(f.calls[1].url,origin+'/v1/information/person-renaper/00000000/gender/F');assert.deepEqual(result.data,civil());assert.doesNotMatch(JSON.stringify(result),/PRIVATE_MUTATED|PRIVATE_CHANGED|other-synthetic-actor|99999999/);
});

test('technical observer options reject malformed callbacks and unbounded local deadlines before HTTP',()=>{
 for(const options of [{onTechnicalObservation:true},{onTechnicalObservation:'callback'},{onTechnicalObservation:{}},{technicalObservationTimeoutMs:0},{technicalObservationTimeoutMs:6001},{technicalObservationTimeoutMs:1.5},{technicalObservationTimeoutMs:NaN}])assert.throws(()=>createBindxCivilDataClient(options),{message:'BINDX_CIVIL_CLIENT_OPTIONS_INVALID'});
 assert.equal(createBindxCivilDataClient({technicalObservationTimeoutMs:6000,onTechnicalObservation:async()=>{}}).readiness().state,'CONTRACT_PENDING');
});

test('moving technical observation after private authority causally loses the observed fact on revocation',async()=>{
 const source=readFileSync(new URL('../src/lib/bindx-civil-data-client.mjs',import.meta.url),'utf8'),needle="await observeTechnical(technical);await fence('RETURN_RESULT');return technical;";assert.equal(source.split(needle).length,2);const mutated=source.replace(needle,"await fence('RETURN_RESULT');await observeTechnical(technical);return technical;"),wrong=await import('data:text/javascript;base64,'+Buffer.from(mutated).toString('base64'));
 for(const [clientFactory,state] of [[createBindxCivilDataClient,'OBSERVED'],[wrong.createBindxCivilDataClient,'UNKNOWN']]){let allowed=true;const observations=[],f=fixture({clientFactory,beforeExternal:async()=>allowed,transport:async(_url,_options,count)=>{if(count===1)return Response.json({token});allowed=false;return Response.json(civil());},onTechnicalObservation:async value=>observations.push(value)}),result=await f.client.lookup();assert.equal(result.state,'AUTHORITY_DENIED');assert.equal(result.data,null);assert.equal(observations.length,1);assert.equal(observations[0].state,state);await f.client.lookup();assert.equal(f.calls.length,2);assert.equal(observations.length,1);}
});
