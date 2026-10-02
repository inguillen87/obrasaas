import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createPilotMediaAnalyzer,normalizeDniExtraction,normalizeSitePhoto,unavailableBiometricAssessment} from '../src/lib/pilot-media.mjs';
import {createKycPilotBoundary} from '../src/lib/kyc-pilot-boundary.mjs';
const PNG=Buffer.from('89504e470d0a1a0a0000000a','hex').toString('base64');
const env={OPENAI_API_KEY:'unit-only-not-a-real-key'};
const validDni={isDni:true,nombreCompleto:'Persona de prueba',dni:'12.345.678'};
const photo={isWorksitePhoto:true,phase:'General',aiAnalysis:'Imagen sintética de ensayo.',isIncident:false};
function harness({raw=validDni,status=200,finish='stop',throwError=false,audio=false}={}){
 const calls=[];const client=createPilotMediaAnalyzer({environment:()=>env,fetchImpl:async(url,options)=>{
  calls.push({url,options});if(throwError)throw new Error('PRIVATE_PROVIDER_DETAIL');
  return Response.json(audio?raw:{choices:[{finish_reason:finish,message:{content:JSON.stringify(raw)}}]},{status});
 }});return {client,calls};
}
test('no key cannot return placeholder identity, photo or transcript',async()=>{
 let requests=0;const client=createPilotMediaAnalyzer({environment:()=>({}),fetchImpl:()=>{requests++;throw new Error('not allowed');}});
 for(const result of [await client.analyzeDni({base64:PNG}),await client.analyzePhoto({base64:PNG}),await client.transcribeAudio({buffer:Buffer.from('unit')})]){
  assert.equal(result.success,false);assert.equal(result.identityVerified,false);assert.equal(result.code,'AI_PROVIDER_NOT_CONFIGURED');assert.doesNotMatch(JSON.stringify(result),/97.4|96.5|00.000.000|Operario Verificado/);
 }assert.equal(requests,0);
});
for(const raw of [{},{success:true},{...validDni,isDni:false},{...validDni,dni:'00.000.000'}, {...validDni,dni:null},{...validDni,nombreCompleto:''},{...validDni,dni:'abc123'},null])
 test('DNI extraction rejects invalid evidence '+JSON.stringify(raw),()=>{assert.equal(normalizeDniExtraction(raw).success,false);});
test('text extraction is explicitly not identity verification and never invents CUIL',()=>{
 const result=normalizeDniExtraction({...validDni,success:true,verified:true,identityVerified:true,ocrConfidence:0});
 assert.equal(result.dni,'12345678');assert.equal(result.cuil,null);assert.equal(result.ocrConfidence,0);assert.equal(result.verified,false);assert.equal(result.identityVerified,false);assert.equal(result.requiresHumanReview,true);
});
for(const value of [null,undefined,'99',-1,101,NaN,Infinity])test('unreliable score '+String(value)+' stays unknown',()=>{assert.equal(normalizeDniExtraction({...validDni,ocrConfidence:value}).ocrConfidence,null);});
for(const raw of [{},{...photo,isWorksitePhoto:false},{...photo,isIncident:undefined},{...photo,isIncident:'false'},{...photo,aiAnalysis:''},{success:true,confidence:99}])
 test('photo incomplete output cannot be successful '+JSON.stringify(raw),()=>{assert.equal(normalizeSitePhoto(raw).success,false);});
test('photo advice is not archival, inspection approval or automatic progress',()=>{
 const result=normalizeSitePhoto({...photo,archived:true,verified:true,confidence:'95',estimatedProgressPercentage:500});
 assert.equal(result.success,true);assert.equal(result.archived,false);assert.equal(result.verified,false);assert.equal(result.confidence,null);assert.equal(result.estimatedProgressPercentage,null);assert.equal(result.requiresHumanReview,true);
});
test('image payload uses its verified MIME and a bounded timeout',async()=>{
 const {client,calls}=harness();const result=await client.analyzeDni({base64:PNG,mimeType:'image/png'});assert.equal(result.success,true);
 const request=JSON.parse(calls[0].options.body);assert.ok(request.messages[1].content[1].image_url.url.startsWith('data:image/png;base64,'));assert.equal(calls[0].options.redirect,'error');assert.ok(calls[0].options.signal);assert.equal(request.model,'gpt-4o');
});
for(const args of [{imageUrl:'http://127.0.0.1/secret'},{base64:'bad'}, {base64:PNG,mimeType:'image/jpeg'}])
 test('invalid image never contacts provider '+JSON.stringify(args),async()=>{const {client,calls}=harness();assert.equal((await client.analyzeDni(args)).success,false);assert.equal(calls.length,0);});
for(const status of [400,401,429,500])test('provider error '+status+' never becomes a default score',async()=>{
 const {client}=harness({status});for(const result of [await client.analyzeDni({base64:PNG}),await client.analyzePhoto({base64:PNG})])assert.equal(result.success,false);
});
for(const finish of ['length','content_filter',null])test('truncated/refused generation '+finish+' rejected',async()=>{assert.equal((await harness({finish}).client.analyzeDni({base64:PNG})).success,false);});
test('unexpected provider exceptions are not reflected to caller',async()=>{
 const result=await harness({throwError:true}).client.analyzeDni({base64:PNG});assert.equal(result.success,false);assert.ok(!JSON.stringify(result).includes('PRIVATE_PROVIDER_DETAIL'));
});
test('unbounded provider response is cancelled',async()=>{
 const client=createPilotMediaAnalyzer({environment:()=>env,fetchImpl:async()=>new Response('x'.repeat(70000))});assert.equal((await client.analyzeDni({base64:PNG})).success,false);
});
test('biometric helper cannot fabricate a match or liveness even with a vision key',()=>{
 const result=unavailableBiometricAssessment();assert.equal(result.success,false);for(const key of ['isMatch','confidenceScore','livenessDetected','isDniGenuine'])assert.equal(result[key],null);assert.equal(result.requiresHumanReview,true);
});
for(const [mime,suffix] of [['audio/ogg; codecs=opus','.ogg'],['audio/mpeg','.mp3'],['audio/mp4','.m4a'],['audio/wav','.wav'],['audio/webm','.webm']])
 test('transcription file type is preserved '+mime,async()=>{
  const {client,calls}=harness({audio:true,raw:{text:'Faltan dos bolsas de cemento.'}});const result=await client.transcribeAudio({buffer:Buffer.from('synthetic audio'),mimeType:mime});
  assert.equal(result.success,true);assert.equal(result.speakerVerified,false);assert.equal(result.attendanceRegistered,false);assert.ok(calls[0].options.body.get('file').name.endsWith(suffix));assert.equal(calls[0].options.body.get('language'),'es');
 });
for(const input of [{buffer:Buffer.alloc(0)},{buffer:'not bytes'},{buffer:new Uint8Array(16*1024*1024+1)},{buffer:Buffer.from('x'),mimeType:'video/executable'}])
 test('invalid audio refused without provider calls '+String(input.mimeType||typeof input.buffer),async()=>{const {client,calls}=harness();assert.equal((await client.transcribeAudio(input)).success,false);assert.equal(calls.length,0);});
for(const raw of [{},{text:''},{text:'   '},{text:123},{text:'x'.repeat(33000)}])
 test('missing/unbounded transcript rejected '+(typeof raw.text),async()=>{assert.equal((await harness({audio:true,raw}).client.transcribeAudio({buffer:Buffer.from('unit')})).success,false);});
const request=body=>new Request('https://app.test/api/webview/kyc',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
const storageEnv={PRIVATE_MEDIA_PROVIDER:'vercel-blob',BLOB_READ_WRITE_TOKEN:'unit-only'};
test('unauthorized KYC request does not read an image body',async()=>{
 const handler=createKycPilotBoundary({authorize:()=>({authorized:false}),verifyToken:()=>false});
 const response=await handler({get body(){throw new Error('must not read');}});assert.equal(response.status,401);
});
test('valid private image pair cannot auto-approve, enroll voice, register attendance or fabricate a worker',async()=>{
 const handler=createKycPilotBoundary({authorize:()=>({authorized:true}),verifyToken:()=>true,environment:()=>storageEnv});
 const response=await handler(request({workerId:'unit-worker',dniFrontBase64:PNG,selfieBase64:PNG,voiceEnrolled:true,verified:true,latitude:1,longitude:1,role:'admin'}));
 const result=await response.json();assert.equal(response.status,503);assert.equal(result.code,'KYC_REVIEW_WORKFLOW_REQUIRED');
 for(const flag of ['success','verified','evidenceStored','attendanceRegistered','autoRetry'])assert.equal(result[flag],false);assert.match(response.headers.get('cache-control'),/private, no-store/);
});
test('invalid worker link stays forbidden',async()=>{
 const handler=createKycPilotBoundary({authorize:()=>({authorized:true}),verifyToken:()=>false,environment:()=>storageEnv});
 const response=await handler(request({workerId:'unit-worker',dniFrontBase64:PNG,selfieBase64:PNG,token:'bad'}));assert.equal(response.status,403);
});
test('no global state or biometric model is called by the legacy KYC boundary',()=>{
 const code=readFileSync(new URL('../src/lib/kyc-pilot-boundary.mjs',import.meta.url),'utf8');assert.doesNotMatch(code,/getAppState|saveAppState|uploadKycImages|fetch\(|analyzeDniWithAI|verifyFacialMatchAndLiveness/);
});
test('WhatsApp no longer auto-enrolls from OCR or prints transcripts',()=>{
 const code=readFileSync(new URL('../src/app/api/whatsapp/route.js',import.meta.url),'utf8');
 assert.doesNotMatch(code,/dniAnalysis|registration_completed|97\.4|livenessScore: 98\.2|Whisper Transcribed Audio|KYC_DNI_VERIFICADO/);
 assert.doesNotMatch(code,/analyzeDni|transcribeAudio|verifyFacial|uploadKyc|registerAttendance|getAppState|saveAppState/);
});

test('provider HTTP failure retains only a status, not its private body',async()=>{
 const result=await harness({status:403}).client.analyzeDni({base64:PNG});assert.equal(result.providerStatus,403);assert.equal(result.code,'AI_PROVIDER_REQUEST_REJECTED');assert.equal(result.success,false);assert.equal(result.dni,undefined);
});
