import {participantIdentityNoticeSummary} from '../src/lib/participant-kyc-notice-links.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {beginMetaKycConversation,planMetaKycConversation} from '../src/lib/meta-kyc-conversation.mjs';
import {participantIdentityUrl,PARTICIPANT_KYC_CHAT_NOTICE_CATALOGUE,participantKycStepReminder} from '../src/lib/participant-kyc-chat-copy.mjs';
import {PARTICIPANT_OCR_NOTICE,PARTICIPANT_BIOMETRIC_NOTICE} from '../src/lib/participant-policy.mjs';
import {participantOcrNotice,participantBiometricNotice,PARTICIPANT_AUTO_OCR_NOTICE_VERSION,PARTICIPANT_AUTO_BIOMETRIC_NOTICE_VERSION} from '../src/lib/participant-analysis-consent.mjs';

const photo={type:'image',image:{id:'150000011',mime_type:'image/png'}};
let seq=0;const next=(state,message)=>planMetaKycConversation({state,message,eventId:'guided_'+(++seq)});
const choose=(state,title)=>next(state,{type:'interactive',interactive:{list_reply:{id:'kyc:'+state.nonce+':'+state.choices.findIndex(row=>row.title===title)}}});
test('guided schema2 numbers each authorized photo and keeps three separate sources until explicit confirmation',()=>{
 let plan=beginMetaKycConversation('start',{captureImageSetVersion:2});assert.match(plan.reply.body,/3 pasos: frente, dorso y selfie/);
 for(const title of ['Autorizar imágenes','Autorizar dorso','Sin lectura asistida','Sin comparación facial'])plan=choose(plan.state,title);
 assert.equal(plan.state.step,'FRONT');assert.match(plan.reply.body,/Paso 1 de 3/);
 plan=next(plan.state,photo);assert.equal(plan.state.step,'BACK');assert.match(plan.reply.body,/Paso 2 de 3/);assert.match(plan.reply.body,/frente ya está preparado/);
 const front=plan.state.front;plan=next(plan.state,photo);assert.equal(plan.state.step,'SELFIE');assert.match(plan.reply.body,/Paso 3 de 3/);assert.match(plan.reply.body,/rostro solo/);assert.match(plan.reply.body,/frente y el dorso ya están preparados/);
 plan=next(plan.state,photo);assert.equal(plan.state.step,'CONFIRM');assert.notEqual(plan.state.front.eventId,plan.state.back.eventId);assert.notEqual(plan.state.back.eventId,plan.state.selfie.eventId);assert.deepEqual(plan.state.front,front);assert.equal(plan.deposit,undefined);
 const before=structuredClone(plan.state);plan=next(plan.state,photo);assert.equal(plan.state.step,'CONFIRM');assert.deepEqual(plan.state.front,before.front);assert.deepEqual(plan.state.back,before.back);assert.deepEqual(plan.state.selfie,before.selfie);assert.equal(plan.deposit,undefined);
 plan=choose(plan.state,'Guardar identidad');assert.equal(plan.deposit,true);assert.equal(plan.state.step,'FINALIZING');
});
for(const [step,titles]of [['CONSENT',[]],['BACK_CONSENT',['Autorizar imágenes']],['OCR',['Autorizar imágenes','Autorizar dorso']],['BIOMETRIC',['Autorizar imágenes','Autorizar dorso','Sin lectura asistida']]])test('unexpected photo at '+step+' repeats its exact choice without storing a source or granting consent',()=>{
 let plan=beginMetaKycConversation('start',{captureImageSetVersion:2});for(const title of titles)plan=choose(plan.state,title);assert.equal(plan.state.step,step);const before=structuredClone(plan.state);plan=next(plan.state,photo);
 assert.equal(plan.state.step,step);for(const key of ['consent','backConsent','ocrConsent','biometricConsent','front','back','selfie'])assert.deepEqual(plan.state[key],before[key]);assert.match(plan.reply.body,/foto todavía no se guardó/);assert.equal(plan.reply.type,'interactive');assert.equal(plan.deposit,undefined);
 if(step==='OCR')assert.ok(plan.reply.body.includes(PARTICIPANT_OCR_NOTICE));if(step==='BIOMETRIC')assert.ok(plan.reply.body.includes(PARTICIPANT_BIOMETRIC_NOTICE));
});
test('image stages cannot capture without their preceding authorizations and sources',()=>{
 let plan=beginMetaKycConversation('start',{captureImageSetVersion:2});for(const step of ['FRONT','BACK','SELFIE'])assert.throws(()=>next({...plan.state,step},photo),{code:'META_KYC_CONVERSATION_REQUIRED'});
});
test('historical two-image sequence stays two images with truthful progress',()=>{
 let plan=beginMetaKycConversation('legacy');for(const title of ['Autorizar imágenes','Sin lectura asistida','Sin comparación facial'])plan=choose(plan.state,title);assert.match(plan.reply.body,/Paso 1 de 2/);plan=next(plan.state,photo);assert.equal(plan.state.step,'SELFIE');assert.match(plan.reply.body,/Paso 2 de 2/);assert.equal(plan.state.back,undefined);
});

for(const automatic of [false,true])test('guided notices keep the exact '+(automatic?'automatic v2':'historical v1')+' version and purpose through every choice',()=>{
 let plan=beginMetaKycConversation('notice-start',{captureImageSetVersion:2,...(automatic?{analysisConsentVersion:2}:{})}),original=plan.state;
 const ocr=participantOcrNotice(original.ocrNoticeVersion),biometric=participantBiometricNotice(original.biometricNoticeVersion);assert.equal(ocr.automatic,automatic);assert.equal(biometric.automatic,automatic);assert.equal(original.ocrNoticeSha256,ocr.sha256);assert.equal(original.biometricNoticeSha256,biometric.sha256);
 if(automatic){assert.equal(ocr.version,PARTICIPANT_AUTO_OCR_NOTICE_VERSION);assert.equal(biometric.version,PARTICIPANT_AUTO_BIOMETRIC_NOTICE_VERSION);assert.match(ocr.text,/automáticamente al completar/);assert.match(biometric.text,/automáticamente al completar/);}else {assert.equal(ocr.text,PARTICIPANT_OCR_NOTICE);assert.equal(biometric.text,PARTICIPANT_BIOMETRIC_NOTICE);assert.match(ocr.text,/un responsable podrá/);}
 plan=choose(plan.state,'Autorizar imágenes');plan=choose(plan.state,'Autorizar dorso');assert.equal(plan.reply.body,automatic?participantIdentityNoticeSummary(ocr.version):ocr.text);plan=choose(plan.state,'Con lectura asistida');assert.equal(plan.reply.body,automatic?participantIdentityNoticeSummary(biometric.version):biometric.text);plan=choose(plan.state,'Con comparación facial');
 assert.equal(plan.state.step,'FRONT');assert.equal(plan.state.ocrNoticeVersion,original.ocrNoticeVersion);assert.equal(plan.state.ocrNoticeSha256,original.ocrNoticeSha256);assert.equal(plan.state.biometricNoticeVersion,original.biometricNoticeVersion);assert.equal(plan.state.biometricNoticeSha256,original.biometricNoticeSha256);
 for(const field of ['ocrNoticeSha256','biometricNoticeSha256'])assert.throws(()=>next({...plan.state,[field]:'0'.repeat(64)},photo),{code:'META_KYC_CONVERSATION_REQUIRED'});
 assert.throws(()=>next({...plan.state,ocrNoticeVersion:'participant-external-ocr-v3'},photo),{code:'META_KYC_CONVERSATION_REQUIRED'});
});
test('identity navigation is a focused read hint with only a canonical project identifier',()=>{
 const id=randomUUID(),url=new URL(participantIdentityUrl(id));assert.equal(url.pathname,'/cuenta');assert.equal(url.searchParams.get('seccion'),'identidad');assert.equal(url.hash,'#participant-title');assert.equal(url.searchParams.get('obra'),id);assert.equal(new URL(participantIdentityUrl('https://evil.example')).searchParams.has('obra'),false);
 assert.equal(participantKycStepReminder('UNKNOWN',id),null);assert.equal(participantKycStepReminder('FRONT','invalid/project'),null);
});
test('new short notice catalogue is separately versioned and linked; active historical notices remain full original text',()=>{
 const catalogue=PARTICIPANT_KYC_CHAT_NOTICE_CATALOGUE;assert.equal(catalogue.version,'participant-kyc-guided-notices-v3');for(const key of ['capture','ocr','biometric']){assert.match(catalogue[key].summary,/https:\/\/obrasaas.com\/privacidad/);assert.doesNotMatch(catalogue[key].summary,/OpenAI|OpenCV|ONNX|\bAPI\b|\bOCR\b/);assert.match(catalogue[key].version,/-v3$/);}
 assert.match(catalogue.ocr.summary,/servicio externo/);assert.match(catalogue.ocr.summary,/al completar/);assert.match(PARTICIPANT_OCR_NOTICE,/OpenAI/);assert.match(PARTICIPANT_BIOMETRIC_NOTICE,/Hugging Face/);
});
