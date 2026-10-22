import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash,createHmac} from 'node:crypto';
import {createPrivateBiometricAnalyzer} from '../src/lib/private-biometric-analyzer.mjs';
import {participantOcrNotice,participantBiometricNotice,PARTICIPANT_PRECOMMIT_BIOMETRIC_NOTICE_SHA256} from '../src/lib/participant-analysis-consent.mjs';
import {digest} from '../src/lib/workspace-policy.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');
const version='participant-private-biometric-v3',secret='11'.repeat(32),timestamp='1710000000',nonce='ab'.repeat(16);
const captures=()=>({front:{buffer:Buffer.from('owned-front-fixture'),mimeType:'image/jpeg'},selfie:{buffer:Buffer.from('owned-selfie-fixture'),mimeType:'image/jpeg'},consentVersion:version});
const resultFor=input=>({success:true,status:'ADVISORY_UNREVIEWED',faceSimilarity:0.38,captureRiskSignal:0.2,identityCertified:false,livenessVerified:false,documentAuthenticityVerified:false,measurementCalibrated:false,requiresHumanReview:true,provider:'private-opencv-onnx',modelManifestSha256:'c695e1a85db3ac933836562ce1f7d7e2b372ba2951dc9c4d0160b88cd448c860',frontSha256:sha(input.front.buffer),selfieSha256:sha(input.selfie.buffer)});
const ack=proof=>({dispatched:true,bodySha256:proof.bodySha256});
const factory=(input,calls,extra={})=>createPrivateBiometricAnalyzer({environment:{OBRASAAS_BIOMETRIC_SERVICE_KEY:secret},clock:()=>Number(timestamp)*1000,nonce:()=>nonce,fetchImpl:async(url,options)=>{calls.push({url,...options});return new Response(JSON.stringify(resultFor(input)),{headers:{'Content-Type':'application/json'}});},...extra});
test('historical analysis notice records retain their four immutable digests',()=>{
 const pins={"participant-external-ocr-v1":"0e9715a7e47bf23679bf70571250c11d27ff03f687743f34496837fa384df143","participant-external-ocr-v2":"aa3fa6f1a267c2384cfacc7b18a83401b1809d110139dcc16e6848f0d1dda865","participant-private-biometric-v1":"dac01985b63bd18b521783f8ee9d855176c33a40ce99b78c5b464081fd5a645a","participant-private-biometric-v2":"aea57d7294acec64602ea0dc7c8b4ab8a79a213849e1a1769e0218b007294537"};
 for(const [key,pin]of Object.entries(pins)){const notice=(key.includes('-ocr-')?participantOcrNotice:participantBiometricNotice)(key);assert.equal(sha(JSON.stringify(notice)),pin);}
});
test('new facial notice is optional before persistence and uses neutral product wording',()=>{
 const notice=participantBiometricNotice(version);assert.equal(notice.timing,'BEFORE_PERSISTENCE');assert.equal(notice.automatic,false);assert.equal(notice.sha256,digest(notice.text));assert.equal(notice.sha256,PARTICIPANT_PRECOMMIT_BIOMETRIC_NOTICE_SHA256);assert.ok(Object.isFrozen(notice));assert.match(notice.text,/antes de guardar/);assert.match(notice.text,/revisión manual/);assert.doesNotMatch(notice.text,/OpenAI|Hugging|API/);
});
test('legacy facial transport retains exact version one wire payload and HMAC for both consent versions',async()=>{
 for(const consentVersion of ['participant-private-biometric-v1','participant-private-biometric-v2']){const input={...captures(),consentVersion},calls=[];assert.deepEqual(await factory(input,calls).analyzeBiometricPair(input),resultFor(input));assert.equal(calls.length,1);const call=calls[0],image=value=>({data:value.buffer.toString('base64'),mimeType:value.mimeType,sha256:sha(value.buffer)}),body=JSON.stringify({version:1,consentVersion,front:image(input.front),selfie:image(input.selfie)});assert.equal(call.body,body);assert.equal(call.url,'https://obrasaas.com/api/internal/biometric-analysis');assert.equal(call.redirect,'error');assert.deepEqual(call.headers,{'Content-Type':'application/json','X-Obrasaas-Timestamp':timestamp,'X-Obrasaas-Nonce':nonce,'X-Obrasaas-Signature':createHmac('sha256',Buffer.from(secret,'hex')).update('obrasaas-biometric-v1\n'+timestamp+'\n'+nonce+'\n'+sha(body)).digest('hex')});}
});
test('new facial transport requires the server dispatch fence before any network call',async()=>{
 const input=captures(),calls=[];assert.equal((await factory(input,calls).analyzeBiometricPair(input)).code,'BIOMETRIC_DISPATCH_FENCE_REQUIRED');assert.equal(calls.length,0);
});
test('invalid image or local configuration never reaches the dispatch fence',async()=>{
 for(const mode of ['mime','same-image','secret']){const input=captures(),calls=[];let fences=0;if(mode==='mime')input.front.mimeType='application/pdf';if(mode==='same-image')input.selfie.buffer=Buffer.from(input.front.buffer);const extra=mode==='secret'?{environment:{}}:{};const result=await factory(input,calls,extra).analyzeBiometricPair(input,{beforeDispatch:()=>{fences++;return{};}});assert.equal(result.success,false);assert.equal(calls.length,0);assert.equal(fences,0);}
});
test('new dispatch binds the immutable image snapshot and receipt before returning conservative advice',async()=>{
 const input=captures(),calls=[],order=[];const service=factory(input,calls,{fetchImpl:async(url,options)=>{order.push('fetch');calls.push({url,...options});return new Response(JSON.stringify(resultFor(input)),{headers:{'Content-Type':'application/json'}});}});const result=await service.analyzeBiometricPair(input,{beforeDispatch:async proof=>{order.push('fence');assert.ok(Object.isFrozen(proof));assert.equal(proof.frontSha256,sha(input.front.buffer));assert.equal(proof.selfieSha256,sha(input.selfie.buffer));assert.equal(proof.noticeSha256,PARTICIPANT_PRECOMMIT_BIOMETRIC_NOTICE_SHA256);return ack(proof);}});assert.deepEqual(order,['fence','fetch']);assert.deepEqual(result,resultFor(input));assert.equal(Object.keys(result).length,13);assert.equal(calls.length,1);
});
test('a malformed dispatch acknowledgement or changed image cannot trigger transport',async()=>{
 for(const mode of ['false','extra','digest','mutation']){const input=captures(),calls=[];await assert.rejects(factory(input,calls).analyzeBiometricPair(input,{beforeDispatch:proof=>{if(mode==='false')return{dispatched:false,bodySha256:proof.bodySha256};if(mode==='extra')return{...ack(proof),saved:true};if(mode==='digest')return{dispatched:true,bodySha256:'0'.repeat(64)};input.front.buffer[0]^=1;return ack(proof);}}),error=>error.code===(mode==='mutation'?'BIOMETRIC_SOURCE_CHANGED':'BIOMETRIC_DISPATCH_UNCONFIRMED'));assert.equal(calls.length,0);}
});
test('authority failures preserve the original error and never dispatch',async()=>{
 const input=captures(),calls=[],denial=Object.assign(new Error('source changed'),{code:'PARTICIPANT_REVISION_CHANGED'});await assert.rejects(factory(input,calls).analyzeBiometricPair(input,{beforeDispatch:()=>{throw denial;}}),error=>error===denial);assert.equal(calls.length,0);
});
test('an expired dispatch fence cannot start a late inference after its promise resolves',async()=>{
 const input=captures(),calls=[];let release;const deferred=new Promise(resolve=>{release=resolve;});await assert.rejects(factory(input,calls,{timeoutMs:5}).analyzeBiometricPair(input,{beforeDispatch:()=>deferred}),error=>error.code==='BIOMETRIC_DISPATCH_UNCONFIRMED');release({dispatched:true,bodySha256:'0'.repeat(64)});await Promise.resolve();await Promise.resolve();assert.equal(calls.length,0);
});
test('claims of certification or extra result fields are rejected after one request without retries',async()=>{
 for(const mode of ['certified','extra']){const input=captures(),calls=[];const service=factory(input,calls,{fetchImpl:async()=>{calls.push(true);const result=resultFor(input);if(mode==='certified')result.identityCertified=true;else result.saved=true;return new Response(JSON.stringify(result),{headers:{'Content-Type':'application/json'}});}});assert.equal((await service.analyzeBiometricPair(input,{beforeDispatch:ack})).code,'BIOMETRIC_RESULT_UNCONFIRMED');assert.equal(calls.length,1);}
});
