const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
const revision=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/.test(value);
const decimal=value=>typeof value==='string'&&/^(?:0|[1-9]\d{0,13})(?:\.\d{1,4})?$/.test(value);
const fail=()=>{throw Object.assign(new Error('La página no permite comprobar estos registros. Conservamos tu selección; volvé a consultarla.'),{code:'FIELD_REVIEW_PAGE_UNCONFIRMED'});};
export function mergeFieldReviewRows(previous,incoming){
 const rows=new Map(previous.map(row=>[row.id,row]));
 for(const row of incoming){const old=rows.get(row.id);if(!old||row.revision>=old.revision)rows.set(row.id,row);}
 return [...rows.values()];
}
export function fieldReviewPage(value,expected){
 if(value?.scope!==expected.scope||value.projectId!==expected.projectId||expected.reviewAccessStamp!==undefined&&value.reviewAccessStamp!==expected.reviewAccessStamp)throw Object.assign(new Error('Cambió el contexto de esta obra. Volvé a consultar con tu acceso vigente.'),{code:'WORKSPACE_CONTEXT_CHANGED'});
 if(!value||Object.keys(value).sort().join('|')!=='afterReview|canApproveProgress|canReview|nextCursor|projectId|records|reviewAccessStamp|reviewFilter|reviewId|reviewSection|scope|total'||!/^[a-f0-9]{64}$/.test(value.reviewAccessStamp||'')||value.reviewSection!==expected.reviewSection||value.reviewFilter!==expected.reviewFilter||value.afterReview!==(expected.afterReview??null)||value.reviewId!==(expected.reviewId??null)||!['EVIDENCE','PROGRESS'].includes(value.reviewSection)||!['ALL','PENDING'].includes(value.reviewFilter)||typeof value.canReview!=='boolean'||typeof value.canApproveProgress!=='boolean'||value.canApproveProgress&&!value.canReview||!Array.isArray(value.records)||value.records.length>100||!Number.isSafeInteger(value.total)||value.total<value.records.length||value.nextCursor!==null&&(!id(value.nextCursor)||value.records.length!==100||value.nextCursor!==value.records.at(-1).id)||new Set(value.records.map(row=>row?.id)).size!==value.records.length)fail();
 if(expected.reviewId&&(value.records.length!==1||value.records[0].id!==expected.reviewId||value.nextCursor!==null||value.total!==1))fail();
 for(const row of value.records){
  if(!id(row?.id)||!id(row.workerId)||!id(row.taskId)||!revision(row.revision))fail();
  if(value.reviewSection==='EVIDENCE'){
   if(!['PENDING','APPROVED','REJECTED'].includes(row.status)||typeof row.title!=='string'||typeof row.caption!=='string'||!id(row.sectorId)||!['image','audio','video'].includes(row.media?.kind)||typeof row.media.contentType!=='string'||!Number.isSafeInteger(row.media.bytes)||row.media.bytes<1||!/^[a-f0-9]{64}$/.test(row.media.sha256||'')||typeof row.processing?.status!=='string'||value.reviewFilter==='PENDING'&&(row.status!=='PENDING'||row.review!==null))fail();
  }else{
   if(!['PENDING','APPLIED','REJECTED','EXPIRED','INVALIDATED'].includes(row.status)||typeof row.reason!=='string'||typeof row.summary!=='string'||!Number.isInteger(row.progress)||row.progress<0||row.progress>100||!Array.isArray(row.evidenceIds)||row.evidenceIds.length>10||row.evidenceIds.some(value=>!id(value))||new Set(row.evidenceIds).size!==row.evidenceIds.length||value.reviewFilter==='PENDING'&&row.status!=='PENDING')fail();
   if(row.quantity===null){if(row.baseline!==null||row.unit!==null)fail();}
   else if(!decimal(row.quantity)||!decimal(row.baseline)||!/[1-9]/.test(row.baseline)||!['M','M2','M3','KG','T','L','UNIT','HOUR','DAY','LOT'].includes(row.unit))fail();
  }
 }
 return value;
}
