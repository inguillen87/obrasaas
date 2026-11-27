export const ATTENDANCE_CLOSURE_ACTIONS=Object.freeze(['PROPOSE_ATTENDANCE_CLOSURE','DECIDE_ATTENDANCE_CLOSURE']);
const id=x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(x),hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x),instant=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString()===x;
const invalid=()=>{throw new Error('Revisá la hora, la zona y el motivo sobre la jornada consultada.');};
const localAt=(at,timeZone)=>{const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(at)).map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}.000`;};
// Resolve the entered wall time explicitly in the chosen zone. Ambiguous and
// nonexistent DST times are rejected instead of relying on the office PC zone.
export function closureUtcFromLocal(local,timeZone){
 if(typeof local!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)||typeof timeZone!=='string'||!timeZone.trim()||timeZone!==timeZone.trim()||timeZone.length>100)invalid();
 const requested=local+':00.000',guess=Date.parse(requested+'Z');if(!Number.isFinite(guess)||new Date(guess).toISOString().slice(0,23)!==requested)invalid();
 let candidates=[];try{for(let minutes=-14*60;minutes<=14*60;minutes+=15){const at=guess+minutes*60000;if(localAt(at,timeZone)===requested)candidates.push(at);}}catch{invalid();}
 if(candidates.length!==1)throw new Error('Esa hora no es única en la zona elegida. Elegí una hora válida y sin cambio de horario.');
 return {effectiveEndAt:new Date(candidates[0]).toISOString(),effectiveLocalEnd:requested,effectiveTimeZone:timeZone};
}
export function attendanceClosureViewMatches(value,{projectId,scope,workerId,shiftId}){
 const p=value?.chronology,c=value?.capabilities;
 if(value?.scope!==scope||value.projectId!==projectId||value.readOnly!==true||!instant(value.observedAt)||p?.projectId!==projectId||p.workerId!==workerId||p.shiftId!==shiftId||!['RECORDED_OPEN','RECORDED_CLOSED','HUMAN_CORRECTED_CLOSED'].includes(p.effective?.state)||!hash(p.temporalDigest)||!Array.isArray(value.proposals)||value.proposals.length>1000||typeof c?.canPropose!=='boolean'||!Array.isArray(c.decisions)||c.decisions.length!==value.proposals.length||value.paymentCalculated!==false||value.paymentEnabled!==false)return false;
 const ids=new Set();return value.proposals.every(row=>{const a=row.proposalEnvelope?.proposal;if(!id(a?.id)||ids.has(a.id)||a.workerId!==workerId||a.shiftId!==shiftId||a.projectId!==projectId||!hash(a.proposalDigest)||!hash(a.sourceDigest)||!['PENDING','APPROVED','REJECTED','SUPERSEDED'].includes(row.state)||typeof row.currentSource!=='boolean')return false;ids.add(a.id);return c.decisions.filter(x=>x.proposalId===a.id&&typeof x.canDecide==='boolean').length===1;});
}
function reasonText(reason){if(typeof reason!=='string'||reason.trim().length<8||reason.trim().length>1000||/[\u0000-\u001f\u007f<>]/.test(reason))invalid();return reason.trim();}
export function attendanceClosurePayload(action,payload,view){
 const s=view?.source;
 if(action==='PROPOSE_ATTENDANCE_CLOSURE'){
  if(view.capabilities?.canPropose!==true||!s||payload.workerId!==s.workerId||payload.shiftId!==s.shiftId||payload.anchorEventId!==s.anchorEventId||payload.expectedHeadEventId!==s.headEventId||payload.sourceDigest!==s.sourceDigest)throw new Error('La jornada cambió. Conservamos tu borrador; cancelá y consultá la fuente vigente.');
  const time=closureUtcFromLocal(payload.effectiveLocalInput,payload.effectiveTimeZone),end=Date.parse(time.effectiveEndAt);
  if(end<Date.parse(s.lastWorkingAt)||end>Date.parse(view.observedAt)||s.recordedSummary.complete&&end>Date.parse(s.recordedSummary.endedAt))throw new Error('La hora debe estar después del último regreso y dentro del período registrado.');
  return {workerId:s.workerId,shiftId:s.shiftId,anchorEventId:s.anchorEventId,expectedHeadEventId:s.headEventId,sourceDigest:s.sourceDigest,...time,reason:reasonText(payload.reason)};
 }
 if(action!=='DECIDE_ATTENDANCE_CLOSURE')invalid();
 const row=view.proposals.find(r=>r.proposalEnvelope.proposal.id===payload.proposalId),p=row?.proposalEnvelope?.proposal,cap=view.capabilities.decisions.find(r=>r.proposalId===payload.proposalId);
 if(!p||row.state!=='PENDING'||!row.currentSource||!cap?.canDecide||payload.proposalRevision!==p.revision||payload.proposalDigest!==p.proposalDigest||payload.sourceDigest!==p.sourceDigest||!['APPROVE','REJECT'].includes(payload.decision))throw new Error('Esta propuesta no admite esa decisión con tu cuenta o cambió su fuente. Consultala de nuevo.');
 return {proposalId:p.id,proposalRevision:p.revision,proposalDigest:p.proposalDigest,sourceDigest:p.sourceDigest,decision:payload.decision,reason:reasonText(payload.reason)};
}
export function attendanceClosureOutcome(value,reference){
 if(!ATTENDANCE_CLOSURE_ACTIONS.includes(reference?.action)||value?.projectId!==reference.projectId||value.scope!==reference.scope||value.operationId!==reference.operationId)return false;
 if(value.state==='NOT_OBSERVED')return value.saved!==true&&value.definitive===false&&!value.receiptId;
 if(value.state!=='RECORDED'||value.saved!==true||value.action!==reference.action||!/^field_[a-f0-9]{64}$/.test(value.receiptId||''))return false;
 const p=value.proposalEnvelope?.proposal,d=value.decisionEnvelope?.decision;
 return reference.action==='PROPOSE_ATTENDANCE_CLOSURE'?value.kind==='ATTENDANCE_CHRONOLOGY_CLOSURE_PROPOSAL'&&p?.operationId===reference.operationId&&p.projectId===reference.projectId&&hash(p.proposalDigest):value.kind==='ATTENDANCE_CHRONOLOGY_CLOSURE_DECISION'&&d?.operationId===reference.operationId&&d.projectId===reference.projectId&&hash(d.decisionDigest);
}
