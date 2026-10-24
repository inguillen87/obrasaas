import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,createHmac} from 'node:crypto';
import {createPrivateCaptureQuality,CAPTURE_QUALITY_NOTICE_VERSION,CAPTURE_QUALITY_MODEL_MANIFEST_SHA256,CAPTURE_QUALITY_REASON_CODES} from '../src/lib/private-capture-quality.mjs';

const secret='7'.repeat(64),environment={OBRASAAS_BIOMETRIC_SERVICE_KEY:secret},clock=()=>1791248000000;
const picture=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==','base64');
const input={kind:'DOCUMENT_FRONT',image:{buffer:picture,mimeType:'image/png'},consentVersion:CAPTURE_QUALITY_NOTICE_VERSION};
const sha=value=>createHash('sha256').update(value).digest('hex');
const output=(value=input,state='QUALITY_PASS',reasonCodes=[])=>({version:1,mode:'capture-quality-v1',kind:value.kind,state,reasonCodes,imageSha256:sha(value.image.buffer),modelManifestSha256:CAPTURE_QUALITY_MODEL_MANIFEST_SHA256,identityCertified:false,livenessVerified:false,documentAuthenticityVerified:false});
const factory=fetchImpl=>createPrivateCaptureQuality({environment,clock,fetchImpl});
function uncertain(result,code){assert.equal(result.state,'UNCERTAIN');assert.equal(result.code,code);assert.deepEqual(result.reasonCodes,['QUALITY_SERVICE_UNAVAILABLE']);assert.equal(result.identityCertified,false);assert.equal(result.livenessVerified,false);assert.equal(result.documentAuthenticityVerified,false);assert.equal(Object.hasOwn(result,'image'),false);}

test('quality requests sign one exact source to the existing private worker without cookies redirects or cache',async()=>{
 const result=await factory(async(url,request)=>{
  assert.equal(url,'https://obrasaas.com/api/internal/biometric-analysis');assert.equal(request.method,'POST');assert.equal(request.redirect,'error');assert.equal(request.cache,'no-store');assert.equal(request.credentials,'omit');assert.ok(request.signal instanceof AbortSignal);assert.equal(request.signal.aborted,false);
  assert.equal(request.headers['Content-Type'],'application/json');assert.equal(request.headers.Accept,'application/json');assert.equal(request.headers['X-Obrasaas-Timestamp'],'1791248000');assert.match(request.headers['X-Obrasaas-Nonce'],/^[a-f0-9]{32}$/);
  const expected=createHmac('sha256',Buffer.from(secret,'hex')).update('obrasaas-biometric-v1\n1791248000\n'+request.headers['X-Obrasaas-Nonce']+'\n'+sha(request.body)).digest('hex');assert.equal(request.headers['X-Obrasaas-Signature'],expected);
  const payload=JSON.parse(request.body);assert.deepEqual(Object.keys(payload).sort(),['version','mode','kind','consentVersion','image'].sort());assert.equal(payload.version,1);assert.equal(payload.mode,'capture-quality-v1');assert.equal(payload.kind,input.kind);assert.equal(payload.consentVersion,CAPTURE_QUALITY_NOTICE_VERSION);assert.deepEqual(Object.keys(payload.image).sort(),['data','mimeType','sha256']);assert.equal(payload.image.mimeType,'image/png');assert.equal(payload.image.sha256,sha(picture));assert.ok(payload.image.data===picture.toString('base64'),'Transfers only the exact synthetic capture');
  return Response.json(output());
 }).assess(input);
 assert.deepEqual(result,output());
});

test('all capture kinds retain native pass retake and uncertainty reasons without claiming identity',async()=>{
 for(const kind of ['DOCUMENT_FRONT','DOCUMENT_BACK','SELFIE'])for(const [state,reasons] of [['QUALITY_PASS',[]],['RETAKE_REQUIRED',['IMAGE_BLURRED','IMAGE_TOO_DARK']],['UNCERTAIN',['QUALITY_SERVICE_UNAVAILABLE']]]){
  const value={...input,kind},expected=output(value,state,reasons);assert.deepEqual(await factory(async()=>Response.json(expected)).assess(value),expected);
 }
 const uncertainFrame=output(input,'UNCERTAIN',['DOCUMENT_FRAME_UNCONFIRMED']);assert.deepEqual(await factory(async()=>Response.json(uncertainFrame)).assess(input),uncertainFrame);
 assert.equal(CAPTURE_QUALITY_NOTICE_VERSION,'participant-capture-quality-v1');assert.equal(CAPTURE_QUALITY_MODEL_MANIFEST_SHA256,'49b52aefe0f0247ff19b0445af1ab173550163d701fd2a2dd7959289bbbd42e3');assert.equal(Object.isFrozen(CAPTURE_QUALITY_REASON_CODES),true);assert.equal(CAPTURE_QUALITY_REASON_CODES.length,14);
});

test('portrait retake belongs only to the document front and preserves the no-certification result',async()=>{
 const expected=output(input,'RETAKE_REQUIRED',['DOCUMENT_PORTRAIT_UNCONFIRMED']);
 assert.deepEqual(await factory(async()=>Response.json(expected)).assess(input),expected);
 for(const kind of ['DOCUMENT_BACK','SELFIE']){const value={...input,kind};uncertain(await factory(async()=>Response.json(output(value,'RETAKE_REQUIRED',['DOCUMENT_PORTRAIT_UNCONFIRMED']))).assess(value),'CAPTURE_QUALITY_RESULT_UNCONFIRMED');}
});

test('explicit consent and an exact single-image input are required before any private request',async()=>{
 let calls=0;const service=factory(async()=>{calls++;throw Error();});
 for(const value of [undefined,null,[],{...input,kind:'OTHER'},{...input,front:input.image},{...input,selfie:input.image},{...input,images:[input.image,input.image]}])uncertain(await service.assess(value),'CAPTURE_QUALITY_REQUEST_INVALID');
 for(const consentVersion of [undefined,null,'participant-private-biometric-v2','participant-capture-quality-v0'])uncertain(await service.assess({...input,consentVersion}),'CAPTURE_QUALITY_PRIVACY_REQUIRED');
 for(const image of [null,[],{...input.image,url:'https://private.invalid/image.png'},{buffer:Buffer.alloc(0),mimeType:'image/png'},{buffer:picture,mimeType:'image/svg+xml'},{buffer:picture,mimeType:'image/jpeg'},{buffer:Buffer.from('invalid signature'),mimeType:'image/png'},{buffer:Buffer.alloc(2*1024*1024+1),mimeType:'image/png'}])uncertain(await service.assess({...input,image}),'CAPTURE_QUALITY_IMAGE_INVALID');
 assert.equal(calls,0);
});

test('missing keys foreign origins and invalid request clocks remain uncertain without network disclosure',async()=>{
 let calls=0;const fetchImpl=async()=>{calls++;throw Error();};
 for(const key of [undefined,'','bad','7'.repeat(63),'A'.repeat(64)])uncertain(await createPrivateCaptureQuality({environment:{OBRASAAS_BIOMETRIC_SERVICE_KEY:key},fetchImpl}).assess(input),'CAPTURE_QUALITY_SERVICE_NOT_CONFIGURED');
 for(const origin of ['https://foreign.invalid','http://obrasaas.com','https://obrasaas.com:8443','https://obrasaas.com/elsewhere','https://obrasaas.com/?secret=private','https://obrasaas.com/#private','https://user:private@obrasaas.com'])uncertain(await createPrivateCaptureQuality({environment:{...environment,APPLICATION_PUBLIC_ORIGIN:origin},fetchImpl}).assess(input),'CAPTURE_QUALITY_SERVICE_ORIGIN_INVALID');
 for(const now of [NaN,Infinity,0])uncertain(await createPrivateCaptureQuality({environment,fetchImpl,clock:()=>now}).assess(input),'CAPTURE_QUALITY_REQUEST_INVALID');
 assert.equal(calls,0);
});

test('tampered model source kind claims and unclosed response fields never pass the prefilter',async()=>{
 for(const patch of [{version:2},{mode:'other'},{kind:'SELFIE'},{state:'APPROVED'},{imageSha256:'0'.repeat(64)},{modelManifestSha256:'0'.repeat(64)},{identityCertified:true},{livenessVerified:true},{documentAuthenticityVerified:true},{previewImage:'private-image'},{metrics:{blur:1}},{dni:'private-personal-value'},{success:true}])uncertain(await factory(async()=>Response.json({...output(),...patch})).assess(input),'CAPTURE_QUALITY_RESULT_UNCONFIRMED');
 for(const value of [null,[],{},Object.fromEntries(Object.entries(output()).filter(([key])=>key!=='imageSha256'))])uncertain(await factory(async()=>Response.json(value)).assess(input),'CAPTURE_QUALITY_RESULT_UNCONFIRMED');
 for(const [state,reasonCodes] of [['QUALITY_PASS',['IMAGE_BLURRED']],['RETAKE_REQUIRED',[]],['RETAKE_REQUIRED',['UNKNOWN_REASON']],['RETAKE_REQUIRED',['IMAGE_BLURRED','IMAGE_BLURRED']],['RETAKE_REQUIRED',['QUALITY_SERVICE_UNAVAILABLE']],['UNCERTAIN',[]],['UNCERTAIN',['IMAGE_BLURRED']],['UNCERTAIN',['QUALITY_SERVICE_UNAVAILABLE','DOCUMENT_FRAME_UNCONFIRMED']],['QUALITY_PASS',null]])uncertain(await factory(async()=>Response.json({...output(),state,reasonCodes})).assess(input),'CAPTURE_QUALITY_RESULT_UNCONFIRMED');
});

test('bounded JSON parsing rejects malformed oversized wrong-type and invalid UTF8 responses',async()=>{
 let cancelled=0;
 const stream=()=>new ReadableStream({start(controller){controller.enqueue(new Uint8Array(5000));},cancel(){cancelled++;}});
 const responses=[new Response('private malformed body',{headers:{'content-type':'application/json'}}),new Response(JSON.stringify(output()),{headers:{'content-type':'text/html'}}),new Response(null,{headers:{'content-type':'application/json'}}),new Response(new Uint8Array([0xff,0xfe]),{headers:{'content-type':'application/json'}}),new Response(' '.repeat(4097),{headers:{'content-type':'application/json'}}),new Response(stream(),{headers:{'content-type':'application/json','content-length':'5000'}}),new Response(stream(),{headers:{'content-type':'application/json'}})];
 for(const response of responses)uncertain(await factory(async()=>response).assess(input),'CAPTURE_QUALITY_RESULT_UNCONFIRMED');
 assert.equal(cancelled,2);
});

test('native closed error codes survive but arbitrary service text and timeout details stay private',async()=>{
 for(const code of ['CAPTURE_QUALITY_REQUEST_INVALID','CAPTURE_QUALITY_PRIVACY_REQUIRED','BIOMETRIC_IMAGE_INVALID','BIOMETRIC_IMAGE_INTEGRITY','BIOMETRIC_SERVICE_BUSY','BIOMETRIC_SERVICE_ACCESS_REQUIRED'])uncertain(await factory(async()=>Response.json({success:false,code},{status:422})).assess(input),code);
 for(const body of [{success:false,code:'private-provider-error'},{success:false,code:'BIOMETRIC_IMAGE_INVALID',detail:picture.toString('base64')},output()])uncertain(await factory(async()=>Response.json(body,{status:503})).assess(input),'CAPTURE_QUALITY_SERVICE_UNCONFIRMED');
 for(const error of [new Error('private-image-and-provider-details'),new DOMException('private timeout details','TimeoutError')])uncertain(await factory(async()=>{throw error;}).assess(input),'CAPTURE_QUALITY_SERVICE_UNCONFIRMED');
});

test('separate concurrent captures keep independent source hashes nonces and bounded single-image payloads',async()=>{
 const values=[input,{...input,kind:'SELFIE',image:{...input.image,buffer:Buffer.concat([picture,Buffer.from('synthetic-second-capture')])}}],seen=[];
 const service=factory(async(_url,request)=>{const payload=JSON.parse(request.body);seen.push({kind:payload.kind,hash:payload.image.sha256,nonce:request.headers['X-Obrasaas-Nonce']});assert.deepEqual(Object.keys(payload).sort(),['version','mode','kind','consentVersion','image'].sort());const value=values.find(item=>item.kind===payload.kind);assert.ok(payload.image.data===value.image.buffer.toString('base64'),'Each request contains its own synthetic capture only');return Response.json(output(value));});
 const results=await Promise.all(values.map(value=>service.assess(value)));assert.equal(seen.length,2);assert.equal(new Set(seen.map(item=>item.nonce)).size,2);assert.equal(new Set(seen.map(item=>item.hash)).size,2);for(let index=0;index<values.length;index++)assert.equal(results[index].imageSha256,sha(values[index].image.buffer));
});
