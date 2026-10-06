import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,createHmac} from 'node:crypto';
import {createPrivateBiometricAnalyzer,BIOMETRIC_NOTICE_VERSION} from '../src/lib/private-biometric-analyzer.mjs';
const secret='7'.repeat(64),clock=()=>1791248000000,nonce=()=> 'a'.repeat(32);
const environment={OBRASAAS_BIOMETRIC_SERVICE_KEY:secret};
const input={consentVersion:BIOMETRIC_NOTICE_VERSION,front:{buffer:Buffer.from('fixture front'),mimeType:'image/jpeg'},selfie:{buffer:Buffer.from('fixture selfie'),mimeType:'image/png'}};
const sha=v=>createHash('sha256').update(v).digest('hex');
const output={success:true,status:'ADVISORY_UNREVIEWED',faceSimilarity:0.52,captureRiskSignal:0.44,identityCertified:false,livenessVerified:false,documentAuthenticityVerified:false,measurementCalibrated:false,requiresHumanReview:true,provider:'private-opencv-onnx',modelManifestSha256:'c695e1a85db3ac933836562ce1f7d7e2b372ba2951dc9c4d0160b88cd448c860',frontSha256:sha(input.front.buffer),selfieSha256:sha(input.selfie.buffer)};
const factory=fetchImpl=>createPrivateBiometricAnalyzer({environment,fetchImpl,clock,nonce});
test('consent and independent private provider key required before disclosure',async()=>{
 let calls=0;const fetchImpl=async()=>{calls++;throw Error();};
 assert.equal((await factory(fetchImpl).analyzeBiometricPair({...input,consentVersion:'old'})).code,'BIOMETRIC_PRIVACY_REQUIRED');
 assert.equal((await createPrivateBiometricAnalyzer({environment:{},fetchImpl}).analyzeBiometricPair(input)).code,'BIOMETRIC_SERVICE_NOT_CONFIGURED');
 assert.equal(calls,0);
 assert.equal((await factory(fetchImpl).analyzeBiometricPair({...input,selfie:input.front})).code,'BIOMETRIC_DISTINCT_CAPTURES_REQUIRED');assert.equal(calls,0);
});
test('signs exact bounded evidence hashes to the fixed HTTPS internal worker',async()=>{
 const result=await factory(async(url,request)=>{
  assert.equal(url,'https://obrasaas.com/api/internal/biometric-analysis');assert.equal(request.redirect,'error');
  const expected=createHmac('sha256',Buffer.from(secret,'hex')).update('obrasaas-biometric-v1\n1791248000\n'+'a'.repeat(32)+'\n'+sha(request.body)).digest('hex');
  assert.equal(request.headers['X-Obrasaas-Signature'],expected);
  const payload=JSON.parse(request.body);assert.equal(payload.front.sha256,sha(input.front.buffer));assert.equal(payload.selfie.sha256,sha(input.selfie.buffer));
  return Response.json(output);
 }).analyzeBiometricPair(input);
 assert.deepEqual(result,output);
});
test('foreign origins and oversized evidence never produce a provider call',async()=>{
 let calls=0;const fetchImpl=async()=>{calls++;throw Error();};
 for(const origin of ['https://attacker.example','http://obrasaas.com','https://obrasaas.com:9999','https://obrasaas.com/fake'])assert.equal((await createPrivateBiometricAnalyzer({environment:{...environment,APPLICATION_PUBLIC_ORIGIN:origin},fetchImpl}).analyzeBiometricPair(input)).code,'BIOMETRIC_SERVICE_ORIGIN_INVALID');
 assert.equal((await factory(fetchImpl).analyzeBiometricPair({...input,front:{...input.front,buffer:Buffer.alloc(2*1024*1024+1)}})).code,'BIOMETRIC_IMAGE_INVALID');
 assert.equal((await factory(fetchImpl).analyzeBiometricPair({...input,front:{...input.front,buffer:Buffer.alloc(2*1024*1024)},selfie:{...input.selfie,buffer:Buffer.alloc(2*1024*1024,1)}})).code,'BIOMETRIC_INPUT_TOO_LARGE');assert.equal(calls,0);
});
test('does not accept certification, unknown fields, stale models or wrong source images',async()=>{
 for(const patch of [{identityCertified:true},{livenessVerified:true},{documentAuthenticityVerified:true},{measurementCalibrated:true},{requiresHumanReview:false},{modelManifestSha256:'0'.repeat(64)},{frontSha256:'0'.repeat(64)},{selfieSha256:'0'.repeat(64)},{faceSimilarity:2},{captureRiskSignal:-1},{embedding:[1,2,3]},{status:'APPROVED'}]){
  const result=await factory(async()=>Response.json({...output,...patch})).analyzeBiometricPair(input);assert.equal(result.code,'BIOMETRIC_RESULT_UNCONFIRMED');assert.equal(result.identityCertified,false);
 }
});
test('provider errors and unbounded responses remain recoverable human review failures',async()=>{
 for(const response of [new Response('denied',{status:403}),new Response('x'.repeat(5000),{headers:{'content-type':'application/json'}}),new Response(JSON.stringify(output),{headers:{'content-type':'text/html'}})]){
  const result=await factory(async()=>response).analyzeBiometricPair(input);assert.equal(result.success,false);assert.equal(result.livenessVerified,false);
 }
 assert.equal((await factory(async()=>{throw Error('private response');}).analyzeBiometricPair(input)).code,'BIOMETRIC_RESULT_UNCONFIRMED');
});
