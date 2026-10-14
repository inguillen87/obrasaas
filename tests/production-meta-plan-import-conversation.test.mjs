import test from 'node:test';
import assert from 'node:assert/strict';
import {
 startMetaPlanImportConversation,continueMetaPlanImportConversation,
 validMetaPlanImportReferenceContext,metaPlanImportAuthorizationValid,
 META_PLAN_IMPORT_REFERENCE_TTL_MS,
} from '../src/lib/meta-plan-import-conversation.mjs';
import {
 PLAN_IMPORT_CONSENT,PLAN_IMPORT_SPREADSHEET_CONSENT,PLAN_IMPORT_CYP_CONSENT,
 PLAN_IMPORT_MONTHLY_CURVE_CONSENT,PLAN_IMPORT_CYP_CURVE_CONSENT,PLAN_IMPORT_DOCUMENT_CURVE_CONSENT,
} from '../src/lib/plan-import-policy.mjs';
import {digest} from '../src/lib/workspace-policy.mjs';
import {requireMetaPlanImportRole} from '../src/lib/meta-plan-import-origin.mjs';

const now=new Date('2026-10-12T04:00:00.000Z');
const xlsx='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const xlsm='application/vnd.ms-excel.sheet.macroenabled.12';
const consents={DOCUMENT:PLAN_IMPORT_CONSENT,MONTHLY:PLAN_IMPORT_SPREADSHEET_CONSENT,CYP:PLAN_IMPORT_CYP_CONSENT,MONTHLY_CURVE:PLAN_IMPORT_MONTHLY_CURVE_CONSENT,CYP_CURVE:PLAN_IMPORT_CYP_CURVE_CONSENT};
let sequence=0;
const event=()=>`synthetic_plan_event_${++sequence}`;
const factsFor=(eventId,extra={})=>({planImportRole:'ADMIN',...extra,planImportReferenceContext:{eventId,payloadDigest:digest(['signed-synthetic-message',eventId]),contextDigest:'c'.repeat(64),sourceProjectId:'synthetic-source-project',...extra.planImportReferenceContext}});
function start(extra={}){
 const eventId=Object.hasOwn(extra,'eventId')?extra.eventId:event(),facts=Object.hasOwn(extra,'facts')?extra.facts:factsFor(eventId,{planImportRole:Object.hasOwn(extra,'role')?extra.role:'ADMIN'});
 return {...startMetaPlanImportConversation({eventId,facts,now:Object.hasOwn(extra,'now')?extra.now:now}),eventId,facts};
}
function run(message,state,extra={}){
 const eventId=extra.eventId??event(),facts=extra.facts??factsFor(eventId,{planImportRole:state?.planImportRole??'ADMIN',...extra.factChanges});
 return {...continueMetaPlanImportConversation({message,state,eventId,facts,now:extra.now??now}),eventId,facts,input:message};
}
const say=(body,state,extra)=>run({type:'text',text:{body}},state,extra);
function choose(plan,value,extra={}){
 const index=plan.state.choices.findIndex(row=>row.value===value);assert.ok(index>=0,`missing ${value}`);
 return run({type:'interactive',interactive:{type:'list_reply',list_reply:{id:plan.reply.sections[0].rows[index].id}}},plan.state,extra);
}
const file=(kind='document',contentType=xlsx,extra={})=>({type:kind,[kind]:{id:'123456789012345',mime_type:contentType,...extra}});
function waiting(profile='DOCUMENT',role='ADMIN'){return choose(start({role}),profile);}
function notice(profile='DOCUMENT',extra={}){return run(file(extra.kind??'document',extra.contentType??(profile==='DOCUMENT'?'application/pdf':xlsx),extra.asset),waiting(profile,extra.role).state,extra);}
function authorized(profile='DOCUMENT',extra={}){const pending=notice(profile,extra);return {pending,result:choose(pending,'EXTRACT',extra)};}
function noEffect(result){assert.equal(result.planImport,undefined);assert.equal(result.command,undefined);assert.equal(result.media,undefined);assert.equal(result.deposit,undefined);}
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}

test('current canonical import roles receive only their permitted formats',()=>{
 for(const role of ['ADMIN','DIRECTOR','SITE_MANAGER']){
  const result=start({role});noEffect(result);
  const values=role==='SITE_MANAGER'?['DOCUMENT','MONTHLY','CYP']:[...Object.keys(consents),'DOC_CURVE'];
  assert.deepEqual(result.state.choices.map(row=>row.value),values);
  assert.equal(result.state.purpose,'PLAN_IMPORT');assert.equal(result.state.version,1);assert.equal(result.state.step,'PLAN_IMPORT_FORMAT');
  assert.equal(result.state.lastEventId,result.eventId);assert.equal(result.state.pendingFile,undefined);assert.equal(result.state.consent,undefined);
  assert.equal(result.state.nonce,digest([result.eventId,'PLAN_IMPORT_FORMAT']).slice(0,20));
  assert.equal(Date.parse(result.state.expiresAt)-now.getTime(),900000);
  assert.ok(result.reply.sections[0].rows.every((row,i)=>row.id===`obra:${result.state.nonce}:${i}`&&row.title.length<=24));
 }
 for(const role of ['FINANCE','AUDITOR','WORKER',null,undefined,'admin']){const result=start({role});noEffect(result);assert.equal(result.state,null);}
});

test('financial PDF/photo purpose has its own notice and current administrative authority',()=>{
 for(const role of ['ADMIN','DIRECTOR'])for(const [kind,type] of [['document','application/pdf'],['image','image/png'],['image','image/jpeg'],['image','image/webp']]){
  const pending=notice('DOC_CURVE',{role,kind,contentType:type});noEffect(pending);
  assert.equal(pending.state.consent,PLAN_IMPORT_DOCUMENT_CURVE_CONSENT);
  assert.match(pending.reply.body,/archivo financiero.*OpenAI.*36 meses/);
  assert.match(pending.reply.body,/referencias al texto y la página/);
  assert.match(pending.reply.body,/sin valores impresos/);
  assert.match(pending.reply.body,/inversión monetaria planificada, no avance físico/);
  assert.ok(pending.reply.body.length<=1024);
  const result=choose(pending,'EXTRACT');assert.equal(metaPlanImportAuthorizationValid(result.input,result.planImport,result.state),true);
  const changed=structuredClone(result.state);changed.consent=PLAN_IMPORT_CONSENT;
  assert.equal(metaPlanImportAuthorizationValid(result.input,{...result.planImport,consent:PLAN_IMPORT_CONSENT},changed),false);
  const revoked=say('continuar',pending.state,{factChanges:{planImportRole:'SITE_MANAGER'}});noEffect(revoked);assert.equal(revoked.state,null);
 }
 assert.equal(start({role:'SITE_MANAGER'}).state.choices.some(row=>row.value==='DOC_CURVE'),false);
 const pending=waiting('DOC_CURVE').state;
 for(const type of [xlsx,xlsm]){const rejected=run(file('document',type),pending);noEffect(rejected);assert.equal(rejected.state,pending);}
 for(const role of ['ADMIN','DIRECTOR'])assert.doesNotThrow(()=>requireMetaPlanImportRole({connection:{metadata:{}},member:{role}},PLAN_IMPORT_DOCUMENT_CURVE_CONSENT));
 for(const role of ['SITE_MANAGER','FINANCE','AUDITOR'])assert.throws(()=>requireMetaPlanImportRole({connection:{metadata:{}},member:{role}},PLAN_IMPORT_DOCUMENT_CURVE_CONSENT),{code:'PLAN_IMPORT_PERMISSION_REQUIRED'});
});

test('start rejects missing or nonexact host reference context and invalid clocks/events',()=>{
 const eventId=event(),facts=factsFor(eventId);
 const variants=[{...facts,planImportReferenceContext:null},{...facts,planImportReferenceContext:{...facts.planImportReferenceContext,extra:true}},{...facts,planImportReferenceContext:{...facts.planImportReferenceContext,eventId:'other-event'}},{...facts,planImportReferenceContext:{...facts.planImportReferenceContext,payloadDigest:'A'.repeat(64)}},{...facts,planImportReferenceContext:{...facts.planImportReferenceContext,contextDigest:'x'}},{...facts,planImportReferenceContext:{...facts.planImportReferenceContext,sourceProjectId:'../private'}}];
 for(const invalidFacts of variants){const result=start({eventId,facts:invalidFacts});noEffect(result);assert.equal(result.state,null);}
 for(const badNow of [null,new Date(NaN),'2026-10-12'])assert.equal(start({now:badNow}).state,null);
 assert.equal(start({eventId:'bad event'}).state,null);
});

test('unsolicited files and text cannot skip format selection or consent',()=>{
 const initial=start();
 for(const input of [file(),file('image','image/png'),{type:'text',text:{body:'EXTRACT'}},{type:'text',text:{body:'sí'}},{type:'interactive',interactive:{type:'button_reply',button_reply:{id:'EXTRACT'}}}]){
  const result=run(input,initial.state);noEffect(result);assert.deepEqual(result.state,initial.state);assert.equal(result.preserveConversation,true);
 }
 noEffect(run(file(),null));
});

for(const profile of Object.keys(consents))test(`${profile}: explicit format, file notice and bound EXTRACT produce only a private-reference intent`,()=>{
 const selected=waiting(profile);noEffect(selected);assert.equal(selected.state.step,'PLAN_IMPORT_FILE');assert.equal(selected.state.profile,profile);assert.equal(selected.state.consent,consents[profile]);assert.equal(selected.state.nonce,undefined);assert.equal(selected.state.choices,undefined);assert.equal(selected.state.pendingFile,undefined);
 const pending=run(file('document',profile==='DOCUMENT'?'application/pdf':xlsx),selected.state);noEffect(pending);
 assert.equal(pending.state.step,'PLAN_IMPORT_NOTICE');assert.equal(pending.state.pendingFile.eventId,pending.eventId);assert.equal(pending.state.lastEventId,pending.eventId);
 assert.deepEqual(pending.state.choices,[{value:'EXTRACT',title:'Extraer borrador'},{value:'CANCEL',title:'Cancelar'}]);
 assert.match(pending.reply.body,/almacenamiento privado/);assert.ok(pending.reply.body.length<=1024);
 if(profile==='DOCUMENT')assert.match(pending.reply.body,/OpenAI.*50 tareas/);
 else{assert.match(pending.reply.body,/localmente, sin enviarlo a OpenAI, sin ejecutar macros ni recalcular fórmulas/);assert.match(pending.reply.body,profile.startsWith('CYP')?/200 partidas CyP/:/50 rubros mensuales/);}
 if(profile.endsWith('CURVE'))assert.match(pending.reply.body,/inversión monetaria planificada, no avance físico/);
 const result=choose(pending,'EXTRACT');assert.equal(result.command,undefined);assert.equal(result.state.step,'PLAN_IMPORT_AUTHORIZED');assert.equal(result.state.mediaAuthorizationStep,'PLAN_IMPORT_NOTICE');assert.equal(result.state.lastEventId,pending.eventId);assert.equal(result.state.nonce,pending.state.nonce);assert.deepEqual(result.state.choices,pending.state.choices);
 assert.deepEqual(Object.keys(result.planImport).sort(),['sourceOrigin','consent','analysisConsentEventId'].sort());assert.deepEqual(result.planImport.sourceOrigin,pending.state.pendingFile);assert.equal(result.planImport.consent,consents[profile]);assert.equal(result.planImport.analysisConsentEventId,result.eventId);assert.equal(result.state.analysisConsentEventId,result.eventId);
 assert.equal(metaPlanImportAuthorizationValid(result.input,result.planImport,result.state),true);
 assert.equal(metaPlanImportAuthorizationValid(result.input,result.planImport,result.state,{facts:result.facts,now,eventId:result.eventId}),true);
});

test('PDF/image profile accepts exact bounded image/document types, spreadsheets accept only OOXML',()=>{
 for(const [kind,type] of [['document','application/pdf'],['image','image/png'],['image','image/jpeg'],['image','image/webp']])assert.equal(notice('DOCUMENT',{kind,contentType:type}).state.step,'PLAN_IMPORT_NOTICE');
 for(const profile of ['MONTHLY','CYP','MONTHLY_CURVE','CYP_CURVE'])for(const type of [xlsx,xlsm])assert.equal(notice(profile,{contentType:type}).state.step,'PLAN_IMPORT_NOTICE');
 const cases=[['DOCUMENT','document',xlsx],['DOCUMENT','document',xlsm],['DOCUMENT','image','image/gif'],['DOCUMENT','image','image/jpg'],['DOCUMENT','image','IMAGE/PNG'],['DOCUMENT','image','image/png; charset=binary'],['DOCUMENT','document','Application/Pdf'],['MONTHLY','document','application/pdf'],['CYP','image','image/png'],['MONTHLY_CURVE','document','application/vnd.ms-excel'],['CYP_CURVE','video','video/mp4'],['CYP','document','application/vnd.ms-excel.sheet.macroEnabled.12']];
 for(const [profile,kind,type] of cases){const state=waiting(profile).state,result=run(file(kind,type),state);noEffect(result);assert.equal(result.state,state);assert.match(result.reply.body,/no corresponde/);}
});

test('declared file sizes only reject; absent size is not invented or claimed verified',()=>{
 for(const [kind,type,limit] of [['image','image/png',2*1024*1024],['document','application/pdf',3*1024*1024],['document',xlsx,3*1024*1024]]){
  const profile=type===xlsx?'CYP':'DOCUMENT';
  for(const size of [1,limit])assert.equal(notice(profile,{kind,contentType:type,asset:{file_size:size}}).state.step,'PLAN_IMPORT_NOTICE');
  for(const size of [limit+1,0,-1,1.5,'1',null,Infinity,NaN]){const state=waiting(profile).state,result=run(file(kind,type,{file_size:size}),state);noEffect(result);assert.equal(result.state,state);assert.match(result.reply.body,/tamaño declarado/);}
  const absent=notice(profile,{kind,contentType:type});assert.equal(absent.state.step,'PLAN_IMPORT_NOTICE');assert.equal(absent.state.pendingFile.file_size,undefined);
 }
});

test('reference contains exactly bounded signed-event facts and no URL, filename, caption or bytes',()=>{
 const pending=notice('CYP',{asset:{url:'https://invalid.example/private',filename:'not-required.xlsx',caption:'not-required',bytes:'not-private-bytes'}}),ref=pending.state.pendingFile;
 assert.deepEqual(Object.keys(ref).sort(),['version','eventId','payloadDigest','contextDigest','sourceProjectId','kind','mediaId','contentType','receivedAt','expiresAt'].sort());
 assert.equal(ref.payloadDigest,pending.facts.planImportReferenceContext.payloadDigest);assert.equal(ref.contextDigest,pending.facts.planImportReferenceContext.contextDigest);assert.equal(ref.sourceProjectId,pending.facts.planImportReferenceContext.sourceProjectId);
 assert.equal(ref.receivedAt,now.toISOString());assert.equal(Date.parse(ref.expiresAt)-Date.parse(ref.receivedAt),META_PLAN_IMPORT_REFERENCE_TTL_MS);
 assert.equal(validMetaPlanImportReferenceContext(ref,{state:pending.state,facts:pending.facts,now}),true);
 assert.equal(JSON.stringify(pending.state).includes('invalid.example'),false);assert.equal(JSON.stringify(pending.state).includes('not-required'),false);assert.equal(JSON.stringify(pending.state).includes('not-private-bytes'),false);
});

test('exact reference schema, ids, digest, canonical dates, media type and fixed TTL reject mutations',()=>{
 const pending=notice('CYP'),ref=pending.state.pendingFile;
 const changes=[r=>{r.extra=true;},r=>{delete r.version;},r=>{r.version=2;},r=>{r.eventId='../event';},r=>{r.sourceProjectId='other-project';},r=>{r.payloadDigest='d'.repeat(63);},r=>{r.contextDigest='D'.repeat(64);},r=>{r.mediaId=123456;},r=>{r.mediaId='1234';},r=>{r.mediaId='1'.repeat(33);},r=>{r.kind='image';},r=>{r.contentType='application/pdf';},r=>{r.receivedAt='2026-10-12T04:00:00Z';},r=>{r.expiresAt='2026-10-12T04:15:00+00:00';},r=>{r.expiresAt=new Date(now.getTime()+900001).toISOString();},r=>{r.receivedAt=new Date(now.getTime()+1).toISOString();r.expiresAt=new Date(now.getTime()+900001).toISOString();},r=>{r.expiresAt='not-a-date';}];
 for(const mutate of changes){const changed=structuredClone(ref);mutate(changed);assert.equal(validMetaPlanImportReferenceContext(changed,{state:pending.state,facts:pending.facts,now}),false);}
 for(const invalidRef of [null,[],{},'reference'])assert.equal(validMetaPlanImportReferenceContext(invalidRef,{state:pending.state,facts:pending.facts,now}),false);
 assert.equal(validMetaPlanImportReferenceContext(ref),false);
 assert.equal(validMetaPlanImportReferenceContext(ref,{state:pending.state,facts:pending.facts,now:new Date(now.getTime()+900000)}),false);
});

test('old format/notice nonce and noncanonical indices cannot authorize or change the profile',()=>{
 const first=start(),selected=choose(first,'CYP'),pending=run(file(),selected.state);
 for(const id of [first.reply.sections[0].rows[0].id,'obra:'+'a'.repeat(20)+':0',`obra:${pending.state.nonce}:00`,`obra:${pending.state.nonce}:2`,`obra:${pending.state.nonce}:99`]){
  const result=run({type:'interactive',interactive:{type:'list_reply',list_reply:{id}}},pending.state);noEffect(result);assert.equal(result.state,pending.state);assert.equal(result.preserveConversation,true);
 }
 const newer=notice('CYP'),old=run({type:'interactive',interactive:{type:'list_reply',list_reply:{id:pending.reply.sections[0].rows[0].id}}},newer.state);noEffect(old);assert.equal(old.state,newer.state);
 const plain=say('Extraer borrador',pending.state);noEffect(plain);assert.equal(plain.state,pending.state);
 const hidden=run({type:'text',text:{body:'sí'},interactive:{type:'list_reply',list_reply:{id:pending.reply.sections[0].rows[0].id}}},pending.state);noEffect(hidden);
});

test('the original prompt event cannot be reused as a new selection or extraction authorization',()=>{
 for(const plan of [start(),notice('CYP')]){
  const result=run({type:'interactive',interactive:{type:'list_reply',list_reply:{id:plan.reply.sections[0].rows[0].id}}},plan.state,{eventId:plan.state.lastEventId});
  noEffect(result);assert.equal(result.state,plan.state);assert.equal(result.preserveConversation,true);assert.match(result.reply.body,/paso anterior/);
 }
});

test('host-only current context is required on receipt and confirmation without mistaking the new payload for the old file',()=>{
 const selected=waiting('CYP'),pending=notice('CYP');
 for(const state of [selected.state,pending.state]){
  for(const change of [{contextDigest:'d'.repeat(64)},{sourceProjectId:'another-source-project'},{extra:'not-host-contract'},{eventId:'another-current-event'},{payloadDigest:'invalid'}]){
   const eventId=event(),facts=factsFor(eventId,{planImportReferenceContext:change}),input=state.step==='PLAN_IMPORT_FILE'?file():{type:'interactive',interactive:{type:'list_reply',list_reply:{id:pending.reply.sections[0].rows[0].id}}};
   const result=run(input,state,{eventId,facts});noEffect(result);assert.equal(result.state,null);
  }
 }
 const current=choose(pending,'EXTRACT');assert.notEqual(current.facts.planImportReferenceContext.payloadDigest,pending.state.pendingFile.payloadDigest);assert.equal(metaPlanImportAuthorizationValid(current.input,current.planImport,current.state,{facts:current.facts,now,eventId:current.eventId}),true);
});

test('role loss or changes invalidate previously offered choices and financial profiles stay denied to SITE_MANAGER',()=>{
 for(const plan of [start(),waiting('DOCUMENT'),notice('DOCUMENT'),notice('CYP_CURVE')])for(const role of ['AUDITOR','FINANCE','SITE_MANAGER','DIRECTOR',null]){
  const message=plan.state.choices?{type:'interactive',interactive:{type:'list_reply',list_reply:{id:plan.reply.sections[0].rows[0].id}}}:file('document','application/pdf');
  const result=run(message,plan.state,{factChanges:{planImportRole:role}});noEffect(result);assert.equal(result.state,null);
 }
 const site=start({role:'SITE_MANAGER'}),tampered=structuredClone(site.state);tampered.choices.push({value:'CYP_CURVE',title:'Curva CyP v4'});
 const result=run({type:'interactive',interactive:{type:'list_reply',list_reply:{id:`obra:${site.state.nonce}:3`}}},tampered,{factChanges:{planImportRole:'SITE_MANAGER'}});noEffect(result);assert.equal(result.state.step,'PLAN_IMPORT_FORMAT');
 const financial=notice('CYP_CURVE'),changed={...financial.state,planImportRole:'SITE_MANAGER'};noEffect(run({type:'interactive',interactive:{type:'list_reply',list_reply:{id:financial.reply.sections[0].rows[0].id}}},changed,{factChanges:{planImportRole:'SITE_MANAGER'}}));
});

test('source TTL never slides on greetings/retries and late EXTRACT cannot emit an intent',()=>{
 const pending=notice('CYP'),before=JSON.stringify(pending.state);
 for(const body of ['HOLA','AYUDA','CRONOGRAMA','CYP']){const result=say(body,pending.state,{now:new Date(now.getTime()+899999)});noEffect(result);assert.equal(result.state,pending.state);assert.equal(result.preserveConversation,true);assert.equal(JSON.stringify(pending.state),before);}
 const early=choose(pending,'EXTRACT',{now:new Date(now.getTime()+899999)});assert.ok(early.planImport);
 for(const milliseconds of [900000,900001]){const expired=choose(pending,'EXTRACT',{now:new Date(now.getTime()+milliseconds)});noEffect(expired);assert.equal(expired.state,null);assert.match(expired.reply.body,/MENU.*Importar cronograma/);}
 const extended={...pending.state,expiresAt:new Date(now.getTime()+1800000).toISOString()},late=run({type:'interactive',interactive:{type:'list_reply',list_reply:{id:pending.reply.sections[0].rows[0].id}}},extended,{now:new Date(now.getTime()+900000)});noEffect(late);assert.equal(late.state,null);
});

test('authorization requires original NOTICE choices, profile, file and current confirmation event',()=>{
 const {result}=authorized('CYP');
 const mutations=[r=>{r.state.lastEventId='other-notice';r.state.nonce=digest([r.state.lastEventId,'PLAN_IMPORT_NOTICE']).slice(0,20);r.input.interactive.list_reply.id=`obra:${r.state.nonce}:0`;},r=>{r.state.nonce='a'.repeat(20);},r=>{r.state.choices.reverse();},r=>{r.state.choices[0].title='Otro aviso';},r=>{r.state.choices[0].value='APPLY';},r=>{r.state.mediaAuthorizationStep='PLAN_IMPORT_FORMAT';},r=>{r.state.authorizationProfile='MONTHLY';},r=>{r.state.profile='MONTHLY';},r=>{r.state.consent=PLAN_IMPORT_CONSENT;},r=>{r.state.pendingFile.mediaId='987654321';},r=>{r.planImport.sourceOrigin.eventId='other-source-event';},r=>{r.planImport.sourceOrigin.caption='not-allowed';},r=>{r.planImport.consent=PLAN_IMPORT_MONTHLY_CURVE_CONSENT;},r=>{r.planImport.analysisConsentEventId='other-confirm';},r=>{r.planImport.extra=true;},r=>{r.state.analysisConsentEventId=r.state.lastEventId;r.planImport.analysisConsentEventId=r.state.lastEventId;},r=>{r.state.planImportRole='FINANCE';},r=>{r.state.step='PLAN_IMPORT_NOTICE';},r=>{r.input.interactive.list_reply.id=`obra:${r.state.nonce}:1`;},r=>{r.input.type='text';},r=>{r.input.interactive.type='flow_reply';}];
 for(const mutate of mutations){const changed=structuredClone(result);mutate(changed);assert.equal(metaPlanImportAuthorizationValid(changed.input,changed.planImport,changed.state),false);}
 assert.equal(metaPlanImportAuthorizationValid(result.input,result.planImport,result.state,{facts:result.facts,now,eventId:'wrong-confirm'}),false);
 assert.equal(metaPlanImportAuthorizationValid(result.input,result.planImport,result.state,{facts:factsFor('wrong-current-event'),now,eventId:result.eventId}),false);
 assert.equal(metaPlanImportAuthorizationValid(result.input,result.planImport,result.state,{facts:{...result.facts,planImportRole:'SITE_MANAGER'},now,eventId:result.eventId}),false);
 assert.equal(metaPlanImportAuthorizationValid(result.input,result.planImport,result.state,{facts:result.facts,now:new Date(now.getTime()+900000),eventId:result.eventId}),false);
 assert.equal(metaPlanImportAuthorizationValid(null,null,null),false);
});

test('explicit button replies are accepted only for the exact current extraction notice',()=>{
 const pending=notice('DOCUMENT'),input={type:'interactive',interactive:{type:'button_reply',button_reply:{id:pending.reply.sections[0].rows[0].id}}},result=run(input,pending.state);
 assert.equal(metaPlanImportAuthorizationValid(input,result.planImport,result.state),true);
});

test('cancel before authorization has no intent and does not mutate the previous pending state',()=>{
 const pending=notice('CYP'),before=JSON.stringify(pending.state);
 for(const plan of [start(),waiting('CYP'),pending]){const result=say('cancelar',plan.state);noEffect(result);assert.equal(result.state,null);assert.equal(result.cancelled,true);}
 const selected=choose(pending,'CANCEL');noEffect(selected);assert.equal(selected.state,null);assert.equal(selected.cancelled,true);assert.equal(JSON.stringify(pending.state),before);
});

test('already authorized attempts do not reissue extraction or erase an uncertain receipt on retry/cancel',()=>{
 const {result}=authorized(),before=JSON.stringify(result.state);
 for(const input of [result.input,{type:'text',text:{body:'CANCELAR'}},file('document','application/pdf')]){
  const next=run(input,result.state);noEffect(next);assert.equal(next.state,result.state);assert.equal(next.preserveConversation,true);assert.equal(next.cancelled,undefined);assert.match(next.reply.body,/mismo intento/);assert.equal(JSON.stringify(result.state),before);
 }
});

test('pure planner preserves frozen inputs and copies only the authorized reference',()=>{
 const pending=notice('CYP'),state=freeze(structuredClone(pending.state)),message=freeze({type:'interactive',interactive:{type:'list_reply',list_reply:{id:pending.reply.sections[0].rows[0].id}}}),eventId=event(),facts=freeze(factsFor(eventId)),before=JSON.stringify({state,message,facts});
 const result=continueMetaPlanImportConversation({message,state,eventId,facts,now});assert.ok(result.planImport);assert.equal(JSON.stringify({state,message,facts}),before);assert.notEqual(result.planImport.sourceOrigin,state.pendingFile);assert.notEqual(result.state,state);
});

test('unknown profiles and malformed message bodies fail closed without prototype profile access',()=>{
 const selected=waiting('CYP');
 for(const profile of ['toString','__proto__','constructor','UNKNOWN',null]){
  const result=run(file(),{...selected.state,profile,consent:undefined});noEffect(result);assert.equal(result.state,null);
 }
 const initial=start();
 for(const message of [{type:'text',text:{body:1}},{type:'text',text:{}},{type:'text'},null]){
  const result=run(message,initial.state);noEffect(result);assert.equal(result.state,initial.state);
 }
});
