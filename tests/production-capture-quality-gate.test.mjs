import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {WorkspaceError} from '../src/lib/workspace-policy.mjs';
import {createCaptureQualityGate} from '../src/lib/capture-quality-gate.mjs';
import {CAPTURE_QUALITY_NOTICE_VERSION,CAPTURE_QUALITY_MODEL_MANIFEST_SHA256} from '../src/lib/private-capture-quality.mjs';
import {captureQualityFeedback,captureQualityRejection} from '../src/lib/capture-quality-policy.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex');
const picture=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==','base64');
function fixture(back=true){return ['DOCUMENT_FRONT','SELFIE',...(back?['DOCUMENT_BACK']:[])].map((kind,index)=>{const bytes=Buffer.concat([picture,Buffer.from('synthetic-capture-'+index)]);return {kind,image:{bytes,contentType:'image/png',digest:sha(bytes)}};});}
const pass=input=>({version:1,mode:'capture-quality-v1',kind:input.kind,state:'QUALITY_PASS',reasonCodes:[],imageSha256:sha(input.image.buffer),modelManifestSha256:CAPTURE_QUALITY_MODEL_MANIFEST_SHA256,identityCertified:false,livenessVerified:false,documentAuthenticityVerified:false});
const denied=(code,status)=>error=>error instanceof WorkspaceError&&error.code===code&&error.status===status;
function presentation(gate,images,options){const effects={blob:0,record:0};return {effects,run:async()=>{const quality=await gate(images,options);effects.blob+=images.length;effects.record++;return quality;}};}

test('a complete two or three image set is validated before persistence and returns only source-bound metadata',async()=>{
 for(const back of [false,true]){
  const images=fixture(back),sourceCopies=images.map(value=>Buffer.from(value.image.bytes)),events=[],gate=createCaptureQualityGate({assess:async input=>{events.push('assess:'+input.kind);assert.equal(input.consentVersion,CAPTURE_QUALITY_NOTICE_VERSION);assert.equal(Object.hasOwn(input,'workerId'),false);return pass(input);}});
  const flow=presentation(gate,images,{beforeAssess:async()=>{events.push('authority');assert.equal(flow.effects.blob,0);assert.equal(flow.effects.record,0);}}),result=await flow.run();
  assert.deepEqual(result,{version:1,policyVersion:CAPTURE_QUALITY_NOTICE_VERSION,modelManifestSha256:CAPTURE_QUALITY_MODEL_MANIFEST_SHA256,images:images.map(value=>({kind:value.kind,imageSha256:value.image.digest})),identityCertified:false,livenessVerified:false,documentAuthenticityVerified:false});
  assert.deepEqual(events,[...images.flatMap(value=>['authority','assess:'+value.kind]),'authority']);assert.deepEqual(flow.effects,{blob:images.length,record:1});
  images.forEach((value,index)=>assert.deepEqual(value.image.bytes,sourceCopies[index]));
  const serialized=JSON.stringify(result);assert.doesNotMatch(serialized,/data|buffer|contentType|embedding|faceSimilarity|captureRiskSignal|workerId|dni|url/i);assert.ok(sourceCopies.every(bytes=>!serialized.includes(bytes.toString('base64'))));
 }
});

test('a failure on the final image blocks every Blob and the KYC record',async()=>{
 const images=fixture(),calls=[],gate=createCaptureQualityGate({assess:async input=>{calls.push(input.kind);return input.kind==='DOCUMENT_BACK'?{...pass(input),state:'RETAKE_REQUIRED',reasonCodes:['IMAGE_BLURRED']}:pass(input);}}),flow=presentation(gate,images);
 await assert.rejects(flow.run(),denied('PARTICIPANT_CAPTURE_DOCUMENT_BACK_IMAGE_BLURRED',422));assert.deepEqual(calls,['DOCUMENT_FRONT','SELFIE','DOCUMENT_BACK']);assert.deepEqual(flow.effects,{blob:0,record:0});
 const feedback=captureQualityFeedback('PARTICIPANT_CAPTURE_DOCUMENT_BACK_IMAGE_BLURRED');assert.equal(feedback.kind,'DOCUMENT_BACK');assert.match(feedback.message,/dorso/);assert.match(feedback.message,/todavía no se guardó/);
});

test('source kind digest manifest and certification tampering never authorize persistence',async()=>{
 for(const patch of [{kind:'SELFIE'},{imageSha256:'0'.repeat(64)},{modelManifestSha256:'0'.repeat(64)},{identityCertified:true},{livenessVerified:true},{documentAuthenticityVerified:true},{version:2},{mode:'other'},{image:'private-image'},{reasonCodes:['IMAGE_BLURRED']},{reasonCodes:['UNKNOWN_REASON']},{state:'APPROVED'}]){
  const flow=presentation(createCaptureQualityGate({assess:async input=>({...pass(input),...patch})}),fixture());await assert.rejects(flow.run(),error=>error instanceof WorkspaceError&&error.code.startsWith('PARTICIPANT_CAPTURE_DOCUMENT_FRONT_'));assert.deepEqual(flow.effects,{blob:0,record:0});
 }
});

test('unavailable analysis and unconfirmed document framing stay blocked with useful closed reasons',async()=>{
 for(const mode of ['throw','missing','unavailable','frame']){
  let calls=0;const flow=presentation(createCaptureQualityGate({assess:async input=>{calls++;if(mode==='throw')throw Error('private-provider-diagnostics');if(mode==='missing')return undefined;return {...pass(input),state:'UNCERTAIN',reasonCodes:[mode==='frame'?'DOCUMENT_FRAME_UNCONFIRMED':'QUALITY_SERVICE_UNAVAILABLE']};}}),fixture());
  await assert.rejects(flow.run(),denied('PARTICIPANT_CAPTURE_DOCUMENT_FRONT_'+(mode==='frame'?'DOCUMENT_FRAME_UNCONFIRMED':'QUALITY_SERVICE_UNAVAILABLE'),mode==='frame'?422:503));assert.equal(calls,1);assert.deepEqual(flow.effects,{blob:0,record:0});
 }
});

test('invalid image sets and mismatching source metadata are rejected before private analysis',async()=>{
 for(const mutate of [images=>images.pop(),images=>images.push(images[0]),images=>{images[0].kind='OTHER';},images=>{images[0].image.digest='0'.repeat(64);},images=>{images[0].image.bytes=undefined;},images=>{images[0].image.contentType='image/svg+xml';}]){
  const images=fixture(false);mutate(images);let calls=0;const flow=presentation(createCaptureQualityGate({assess:async input=>{calls++;return pass(input);}}),images);await assert.rejects(flow.run(),denied('PARTICIPANT_CAPTURE_SOURCE_CHANGED',409));assert.equal(calls,0);assert.deepEqual(flow.effects,{blob:0,record:0});
 }
});

test('source bytes and metadata changed during an awaited assessment cannot use its earlier pass',async()=>{
 for(const mutate of [images=>{images[0].image.bytes[0]^=1;},images=>{images[0].image.digest='0'.repeat(64);},images=>{images[0].image.contentType='image/jpeg';},images=>{images[0].image.bytes=undefined;},images=>{images[0].image={...images[0].image,bytes:Buffer.concat([picture,Buffer.from('replacement')])};}]){
  const images=fixture(),gate=createCaptureQualityGate({assess:async input=>{const result=pass(input);if(input.kind==='DOCUMENT_FRONT'){await Promise.resolve();mutate(images);}return result;}}),flow=presentation(gate,images);
  await assert.rejects(flow.run(),denied('PARTICIPANT_CAPTURE_SOURCE_CHANGED',409));assert.deepEqual(flow.effects,{blob:0,record:0});
 }
});

test('the private assessment receives an owned byte copy and cannot mutate persisted sources through that port',async()=>{
 const images=fixture(),before=images.map(value=>Buffer.from(value.image.bytes)),gate=createCaptureQualityGate({assess:async input=>{const result=pass(input);input.image.buffer.fill(0);await Promise.resolve();return result;}}),flow=presentation(gate,images);
 await flow.run();images.forEach((value,index)=>assert.deepEqual(value.image.bytes,before[index]));assert.equal(flow.effects.record,1);
});

test('authority revocation before assessment or at the final recheck preserves its exact error and blocks persistence',async()=>{
 for(const failAt of [1,2,4]){
  let authorityCalls=0,assessCalls=0;const authorityError=new WorkspaceError('PARTICIPANT_ACCESS_REQUIRED',403),flow=presentation(createCaptureQualityGate({assess:async input=>{assessCalls++;return pass(input);}}),fixture(),{beforeAssess:async()=>{authorityCalls++;if(authorityCalls===failAt)throw authorityError;}});
  await assert.rejects(flow.run(),error=>error===authorityError);assert.equal(assessCalls,Math.min(failAt-1,3));assert.deepEqual(flow.effects,{blob:0,record:0});
 }
});

test('capture correction copy requires the actual precommit HTTP envelope, never just a matching error code',()=>{
 const code='PARTICIPANT_CAPTURE_SELFIE_IMAGE_BLURRED',body={saved:false,identityCertified:false,code};
 for(const status of [422,503])assert.equal(captureQualityRejection(body,status).kind,'SELFIE');
 for(const value of [{code},{...body,saved:true},{...body,identityCertified:true},{...body,receiptId:'uncertain'},[],null])assert.equal(captureQualityRejection(value,503),null);
 for(const status of [200,400,409,500,502])assert.equal(captureQualityRejection(body,status),null);
 assert.equal(captureQualityRejection({...body,code:'PARTICIPANT_OTHER_FAILURE'},503),null);
});
