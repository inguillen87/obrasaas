import assert from 'node:assert/strict';
import test from 'node:test';
import {participantKycPreanalysisView,participantKycManualAnalysisAvailable,participantKycExtractionVisible} from '../src/app/(identity)/cuenta/participant-kyc-preanalysis-view.mjs';

test('automatic results and failures never offer a duplicate manual provider dispatch',()=>{
 for(const status of ['QUEUED','RUNNING','WAITING_CONFIGURATION','USAGE_HELD','EXTRACTED_UNVERIFIED','ADVISORY_UNREVIEWED','FAILED_RETRYABLE','UNCERTAIN','SKIPPED_CONSENT','FOREIGN_STATE']){
  const kyc={status:'PENDING_REVIEW',processing:{automatic:true,status}};
  assert.equal(participantKycManualAnalysisAvailable(kyc),false,status);
  assert.equal(participantKycPreanalysisView(kyc).notice,'El análisis no aprueba la identidad ni habilita permisos de trabajo.');
 }
});

test('uncertain or held provider results do not claim completion or authorize another attempt',()=>{
 for(const status of ['UNCERTAIN','USAGE_HELD','FOREIGN_STATE']){
  const value=participantKycPreanalysisView({processing:{automatic:true,status,code:'private-provider-detail',fields:{document:'private-document'},biometrics:{faceSimilarity:1}}});
  assert.match(value.title,/comprobación|confirmar/);
  assert.doesNotMatch(JSON.stringify(value),/private-provider-detail|private-document|faceSimilarity/);
  assert.equal(value.state,status==='FOREIGN_STATE'?'UNCONFIRMED':status);
 }
});

test('document extraction and facial assistance stay distinct from verified identity',()=>{
 assert.equal(participantKycPreanalysisView({processing:{automatic:true,status:'EXTRACTED_UNVERIFIED'}}).title,'Lectura automática preparada');
 assert.equal(participantKycPreanalysisView({processing:{automatic:true,status:'ADVISORY_UNREVIEWED'}}).title,'Comparación facial preparada');
 assert.match(participantKycPreanalysisView({processing:{automatic:true,status:'ADVISORY_UNREVIEWED'}}).description,/orientativas/);
});

test('a person without automatic authorization retains the historical manual route',()=>{
 for(const kyc of [undefined,{}, {processing:null},{processing:{status:'FAILED_RETRYABLE'}},{processing:{automatic:false,status:'FAILED_RETRYABLE'}}]){
  assert.equal(participantKycPreanalysisView(kyc),null);
  assert.equal(participantKycManualAnalysisAvailable(kyc),true);
 }
 for(const status of ['RUNNING','EXTRACTED_UNVERIFIED','ADVISORY_UNREVIEWED'])assert.equal(participantKycManualAnalysisAvailable({processing:{status}}),false);
});

test('lack of optional consent and unavailable configuration do not masquerade as analysis success',()=>{
 assert.match(participantKycPreanalysisView({processing:{automatic:true,status:'SKIPPED_CONSENT'}}).description,/No se iniciaron/);
 assert.match(participantKycPreanalysisView({processing:{automatic:true,status:'WAITING_CONFIGURATION'}}).description,/todavía no está disponible/);
 assert.match(participantKycPreanalysisView({processing:{automatic:true,status:'QUEUED'}}).description,/comenzará/);
});

test('only closed informative issue messages are displayed, without private provider payloads',()=>{
 const value=participantKycPreanalysisView({processing:{automatic:true,status:'EXTRACTED_UNVERIFIED',issueCodes:['CUIL_NOT_READ','private-provider-detail','CUIL_NOT_READ',{},'FACIAL_NOT_AUTHORIZED']}});
 assert.deepEqual(value.issues,['El CUIL no se pudo leer. Comprobalo por separado si lo necesitás.','Comparación facial: sin autorización.']);
 assert.doesNotMatch(JSON.stringify(value),/private-provider-detail|rechazad|inhabilitad/i);
 assert.deepEqual(participantKycPreanalysisView({processing:{automatic:true,status:'RUNNING',issueCodes:'private-provider-detail'}}).issues,[]);
});

test('a finalized human review does not display an old pending analysis as still running',()=>{
 for(const status of ['APPROVED','REJECTED'])for(const analysisStatus of ['QUEUED','RUNNING','WAITING_CONFIGURATION','USAGE_HELD']){
  const kyc={status,processing:{automatic:true,status:analysisStatus}},before=structuredClone(kyc),view=participantKycPreanalysisView(kyc);
  assert.equal(view.state,'REVIEWED_WITHOUT_ANALYSIS_RESULT');
  assert.match(view.description,/anterior sigue sin confirmar/);
  assert.equal(participantKycManualAnalysisAvailable(kyc),false);
  assert.deepEqual(kyc,before);
 }
 assert.equal(participantKycPreanalysisView({status:'APPROVED',processing:{automatic:true,status:'EXTRACTED_UNVERIFIED'}}).title,'Lectura automática preparada');
});

test('reviewers can see a completed OCR result while another automatic stage remains pending',()=>{
 const fields={nombreCompleto:'Persona de prueba',dni:'00000000',cuil:null};
 for(const status of ['WAITING_CONFIGURATION','USAGE_HELD','UNCERTAIN','EXTRACTED_UNVERIFIED']){
  const kyc={status:'PENDING_REVIEW',processing:{automatic:true,status,fields}};
  assert.equal(participantKycExtractionVisible(kyc,true),true);
  assert.equal(participantKycExtractionVisible(kyc,false),false);
  assert.equal(participantKycExtractionVisible({processing:{automatic:true,status}},true),false);
 }
 assert.equal(participantKycExtractionVisible({processing:{status:'FAILED_RETRYABLE',fields}},true),false);
 assert.equal(participantKycExtractionVisible({processing:{status:'EXTRACTED_UNVERIFIED',fields}},true),true);
});
