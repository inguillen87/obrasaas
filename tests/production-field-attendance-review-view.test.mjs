import test from 'node:test';
import assert from 'node:assert/strict';
import {fieldReviewPage,mergeFieldReviewRows} from '../src/app/(identity)/cuenta/field-review-page-view.mjs';

const context={projectId:'project-attendance',scope:'a'.repeat(64),reviewAccessStamp:'c'.repeat(64),reviewSection:'ATTENDANCE',reviewFilter:'PENDING'};
const all={...context,reviewFilter:'ALL'};
const location={latitude:0,longitude:0,accuracyMeters:null,distanceMeters:0,geofenceRadiusMeters:100,locationCapturedAt:'2026-10-20T12:00:00.000Z',noticeVersion:'field-location-v1',verificationStatus:'REVIEW_REQUIRED'};
const event={id:'attendance-a',workerId:'worker-a',workerName:null,recordedAt:'2026-10-20T12:00:00.000Z',version:1,eventType:'CHECK_IN',phase:'WORKING',shiftId:'shift-a',sequence:1,previousEventId:null,sectorId:'sector-a',sectorName:'Sector de prueba',configRevision:'config-a',qrStatus:'NOT_PROVIDED',verificationStatus:'REVIEW_REQUIRED',location,recordedBy:'author-a',source:'account',review:null};
const approved={decision:'APPROVE',reason:'Revisión independiente de prueba',actorId:'reviewer-b',recordedAt:'2026-10-20T13:00:00.000Z'};
const page=(records=[event],expected=context)=>({scope:expected.scope,projectId:expected.projectId,reviewAccessStamp:expected.reviewAccessStamp??context.reviewAccessStamp,reviewSection:'ATTENDANCE',reviewFilter:expected.reviewFilter,afterReview:expected.afterReview??null,reviewId:expected.reviewId??null,records,total:records.length,nextCursor:null,canReview:true,canApproveProgress:true});
const unconfirmed=run=>assert.throws(run,{code:'FIELD_REVIEW_PAGE_UNCONFIRMED'});

test('attendance DTO accepts the canonical public event without inventing a revision or a worker name',()=>{
 const value=page();assert.equal(fieldReviewPage(value,context),value);assert.equal(Object.hasOwn(value.records[0],'revision'),false);assert.equal(value.records[0].workerName,null);assert.equal(value.records[0].location.accuracyMeters,null);assert.deepEqual(value.records[0],event);
});

test('attendance DTO accepts all canonical event phases and nullable break locations in ALL history',()=>{
 for(const [eventType,phase,verificationStatus] of [['CHECK_IN','WORKING','REVIEW_REQUIRED'],['BREAK_START','ON_BREAK','NOT_REQUIRED'],['BREAK_END','WORKING','NOT_REQUIRED'],['CHECK_OUT','WORKING','VERIFIED']]){
  const row={...event,eventType,phase,verificationStatus,workerName:'Persona de prueba',qrStatus:verificationStatus==='VERIFIED'?'MATCHED':event.qrStatus,location:eventType.startsWith('BREAK_')?null:verificationStatus==='VERIFIED'?{...location,accuracyMeters:5,verificationStatus:'VERIFIED'}:event.location},value=page([row],all);
  assert.equal(fieldReviewPage(value,all),value);assert.equal(value.records[0].workerName,'Persona de prueba');assert.equal(Object.hasOwn(row,'revision'),false);
 }
});

test('attendance DTO rejects foreign project scope and stale access stamps before rendering records',()=>{
 for(const update of [{projectId:'project-other'},{scope:'b'.repeat(64)},{reviewAccessStamp:'d'.repeat(64)},{reviewAccessStamp:undefined}])assert.throws(()=>fieldReviewPage({...page(),...update},context),{code:'WORKSPACE_CONTEXT_CHANGED'});
});

test('attendance first page still requires a server access stamp when the caller has not supplied one',()=>{
 const {reviewAccessStamp:ignored,...first}=context;void ignored;assert.equal(fieldReviewPage(page([event],first),first).reviewAccessStamp,context.reviewAccessStamp);
 for(const reviewAccessStamp of [undefined,null,'','C'.repeat(64),'c'.repeat(63)])unconfirmed(()=>fieldReviewPage({...page([event],first),reviewAccessStamp},first));
});

test('attendance envelope rejects added fields and mismatched section filter cursor or capability flags',()=>{
 for(const update of [{extra:true},{reviewSection:'EVIDENCE'},{reviewFilter:'ALL'},{afterReview:'attendance-old'},{reviewId:event.id},{canReview:'true'},{canApproveProgress:'false'},{canReview:false,canApproveProgress:true}])unconfirmed(()=>fieldReviewPage({...page(),...update},context));
});

test('attendance exact ALL recovery must return only the selected canonical event',()=>{
 const selected={...all,reviewId:event.id},value=page([event],selected);assert.equal(fieldReviewPage(value,selected),value);
 for(const update of [{records:[],total:0},{records:[{...event,id:'attendance-other'}]},{records:[event,{...event,id:'attendance-other'}],total:2},{total:2},{nextCursor:event.id}])unconfirmed(()=>fieldReviewPage({...value,...update},selected));
});

test('attendance page bounds require unique IDs and the exact last row cursor without claiming completeness',()=>{
 const records=Array.from({length:100},(_,index)=>({...event,id:'attendance-'+index,workerId:'worker-'+index})),value={...page(records),total:203,nextCursor:records.at(-1).id};
 assert.equal(fieldReviewPage(value,context),value);assert.equal(value.total,203);
 for(const update of [{records:[...records,{...event,id:'attendance-extra'}]},{records:[event,event],total:203,nextCursor:null},{nextCursor:records[0].id},{records:[event],nextCursor:event.id},{total:99},{total:203.5}])unconfirmed(()=>fieldReviewPage({...value,...update},context));
});

test('attendance event IDs sequence ISO time and nullable display name are checked before use',()=>{
 for(const update of [{id:'bad/id'},{workerId:''},{shiftId:null},{sectorId:'../sector'},{version:2},{sequence:0},{sequence:1.5},{sequence:Number.MAX_SAFE_INTEGER+1},{recordedAt:'2026-10-20T12:00:00'},{recordedAt:'not-a-time'},{workerName:undefined},{workerName:{name:'unsafe'}},{sectorName:null}])unconfirmed(()=>fieldReviewPage(page([{...event,...update}]),context));
});

test('attendance event phase must match its canonical transition and breaks cannot carry location',()=>{
 for(const row of [{...event,eventType:'BREAK_START',phase:'WORKING',location:null},{...event,eventType:'CHECK_IN',phase:'ON_BREAK'},{...event,eventType:'BREAK_END',phase:'ON_BREAK',location:null},{...event,eventType:'BREAK_START',phase:'ON_BREAK',location},{...event,eventType:'BREAK_END',phase:'WORKING',location}])unconfirmed(()=>fieldReviewPage(page([row],all),all));
});

test('attendance enum and pending-review rules reject completed or malformed records in a pending page',()=>{
 for(const update of [{eventType:'CLOCK_IN'},{phase:'PAUSED'},{qrStatus:'UNKNOWN'},{verificationStatus:'APPROVED'},{verificationStatus:'VERIFIED'},{verificationStatus:'NOT_REQUIRED'},{review:approved},{review:{decision:'REJECT',reason:'Revisión de prueba',actorId:'reviewer-b',recordedAt:approved.recordedAt}}])unconfirmed(()=>fieldReviewPage(page([{...event,...update}]),context));
});

test('attendance ALL review decisions retain their actor and time and reject incomplete decision metadata',()=>{
 for(const decision of ['APPROVE','REJECT']){const row={...event,review:{...approved,decision}},value=page([row],all);assert.equal(fieldReviewPage(value,all),value);assert.deepEqual(value.records[0].review,row.review);}
 for(const review of [{...approved,decision:'APPROVED'},{...approved,reason:null},{...approved,actorId:undefined},{...approved,actorId:'bad/id'},{...approved,recordedAt:undefined},{...approved,recordedAt:'not-a-time'}])unconfirmed(()=>fieldReviewPage(page([{...event,review}],all),all));
});

test('attendance rendered location rejects nonfinite values invalid coordinates and missing precision fields',()=>{
 for(const candidate of [undefined,true,[],{}, {...location,latitude:NaN},{...location,latitude:91},{...location,longitude:-181},{...location,accuracyMeters:0},{...location,accuracyMeters:Infinity},{...location,accuracyMeters:undefined},{...location,distanceMeters:-1},{...location,distanceMeters:undefined}])unconfirmed(()=>fieldReviewPage(page([{...event,location:candidate}],all),all));
 const unknown={...event,location:{...location,accuracyMeters:null,distanceMeters:null}},value=page([unknown],all);assert.equal(fieldReviewPage(value,all),value);
});

test('attendance merging adopts a newly confirmed review without any revision field',()=>{
 const decided={...event,review:approved},previous=[event],incoming=[decided],before=structuredClone({previous,incoming});
 const merged=mergeFieldReviewRows(previous,incoming);assert.deepEqual(merged,[decided]);assert.equal(merged[0],decided);assert.equal(Object.hasOwn(merged[0],'revision'),false);assert.deepEqual({previous,incoming},before);
});

test('attendance late pending pages cannot erase an irreversible review or replace the original event',()=>{
 const decided={...event,review:approved},late={...event,workerName:'Nombre de una página anterior'},other={...event,id:'attendance-other',workerId:'worker-other'},previous=[decided],incoming=[late,other];
 const merged=mergeFieldReviewRows(previous,incoming);assert.deepEqual(merged,[decided,other]);assert.equal(merged[0],decided);assert.equal(decided.review,approved);assert.deepEqual(previous,[decided]);assert.deepEqual(incoming,[late,other]);
});

test('attendance identical decision readbacks preserve the already confirmed row and caller arrays',()=>{
 const decided={...event,review:approved},duplicate=structuredClone(decided),previous=[decided],incoming=[duplicate],before=structuredClone({previous,incoming});
 const merged=mergeFieldReviewRows(previous,incoming);assert.equal(merged.length,1);assert.equal(merged[0],decided);assert.deepEqual({previous,incoming},before);
});

test('attendance conflicting irreversible decision reason actor or time fails closed without mutating callers',()=>{
 const decided={...event,review:approved};
 for(const change of [{decision:'REJECT'},{reason:'Otro motivo confirmado'},{actorId:'reviewer-c'},{recordedAt:'2026-10-20T14:00:00.000Z'}]){
  const previous=[decided],incoming=[{...event,review:{...approved,...change}}],before=structuredClone({previous,incoming});
  unconfirmed(()=>mergeFieldReviewRows(previous,incoming));assert.deepEqual({previous,incoming},before);
 }
});

test('attendance unreviewed page merging keeps stable order and deduplicates canonical event IDs',()=>{
 const other={...event,id:'attendance-other'},newest={...event,workerName:'Nombre vigente de prueba'},third={...event,id:'attendance-third'},previous=[event,other],incoming=[newest,third];
 assert.deepEqual(mergeFieldReviewRows(previous,incoming),[newest,other,third]);assert.deepEqual(previous,[event,other]);assert.deepEqual(incoming,[newest,third]);
});
