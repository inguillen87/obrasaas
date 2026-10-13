const exact=(value,keys)=>Boolean(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===[...keys].sort().join('|'));
const identifier=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
const scopeValid=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const text=(value,max=512)=>typeof value==='string'&&value.trim()===value&&value.length>0&&value.length<=max&&!/[\u0000-\u001f\u007f<>]/.test(value);
const integer=value=>Number.isSafeInteger(value)&&value>=0;
const token=value=>typeof value==='string'&&/^(0|[1-9]\d{0,29})$/.test(value);
const receipt=value=>typeof value==='string'&&/^organization_usage_[a-f0-9]{64}$/.test(value);
const seconds=value=>typeof value==='string'&&/^(?:0|[1-9]\d{0,14})(?:\.\d{1,6})?$/.test(value)&&(!value.includes('.')||!value.endsWith('0'));
const stageLabels=Object.freeze({PLAN_OPENAI_EXTRACTION:'Cronograma',IDENTITY_OPENAI_OCR:'Lectura de documento',FIELD_OPENAI_VISION:'Foto de obra',FIELD_OPENAI_TRANSCRIPTION:'Nota de audio',FIELD_VIDEO_TRANSCRIPTION:'Audio de video',FIELD_VIDEO_VISION:'Cuadros de video'});
const coverageStates=new Set(['TRIAL_CURRENT','PAID_PERIOD_OBSERVED','EXPIRED','UNCONFIRMED']);
const stateLabels=Object.freeze({RESERVED:'Uso reservado',DISPATCHED:'Resultado por comprobar',UNKNOWN:'Resultado por comprobar',OBSERVED:'Uso comprobado',UNMEASURED:'Uso sin medición del proveedor'});
const fail=()=>{throw Object.assign(new Error('No pudimos confirmar el uso registrado de esta empresa.'),{code:'COMPANY_USAGE_RESULT_UNCONFIRMED'});};
export function companyUsageInstant(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value))return false;
 const date=new Date(value);return Number.isFinite(date.getTime())&&date.toISOString()===value;
}
const dateLabel=value=>new Intl.DateTimeFormat('es-AR',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Argentina/Buenos_Aires'}).format(new Date(value));
const quantity=value=>new Intl.NumberFormat('es-AR').format(typeof value==='string'?BigInt(value):value);
const quantitySeconds=value=>{const [whole,fraction]=value.split('.');return quantity(whole)+(fraction?','+fraction:'');};
function measuredUsage(value){
 if(!exact(value,['inputTokens','outputTokens','totalTokens','cachedInputTokens','reasoningOutputTokens'])||!['inputTokens','outputTokens','totalTokens'].every(key=>token(value[key]))||!['cachedInputTokens','reasoningOutputTokens'].every(key=>value[key]===null||token(value[key])))fail();
 if(BigInt(value.totalTokens)!==BigInt(value.inputTokens)+BigInt(value.outputTokens)||value.cachedInputTokens!==null&&BigInt(value.cachedInputTokens)>BigInt(value.inputTokens)||value.reasoningOutputTokens!==null&&BigInt(value.reasoningOutputTokens)>BigInt(value.outputTokens))fail();
 return {...value,totalLabel:quantity(value.totalTokens)};
}
function coverage(value,observedAt){
 if(!exact(value,['state','startsAt','endsAt'])||!coverageStates.has(value.state)||value.startsAt!==null&&!companyUsageInstant(value.startsAt)||value.endsAt!==null&&!companyUsageInstant(value.endsAt))fail();
 const now=Date.parse(observedAt),start=value.startsAt===null?null:Date.parse(value.startsAt),end=value.endsAt===null?null:Date.parse(value.endsAt);
 if(start!==null&&end!==null&&start>=end)fail();
 if(value.state==='UNCONFIRMED'&&(start!==null||end!==null)||value.state==='TRIAL_CURRENT'&&(start!==null||end===null||end<=now)||value.state==='PAID_PERIOD_OBSERVED'&&(start===null||end===null||start>now||end<=now)||value.state==='EXPIRED'&&(end===null||end>now))fail();
 return {...value,label:value.state==='TRIAL_CURRENT'?'Prueba vigente':value.state==='PAID_PERIOD_OBSERVED'?'Período pagado observado':value.state==='EXPIRED'?'Cobertura finalizada':'Cobertura por comprobar',startsLabel:start===null?null:dateLabel(value.startsAt),endsLabel:end===null?null:dateLabel(value.endsAt)};
}

// This is an independent read contract. It never broadens the financial v1
// envelope, derives prices, grants capacity or certifies provider financing.
export function companyUsageView(value,{scope,organizationId}={}){
 if(!scopeValid(scope)||!identifier(organizationId)||!exact(value,['version','scope','organization','observedAt','capacity','funding','coverage','summary','recent','truncated'])||![1,2].includes(value.version)||value.scope!==scope||!exact(value.organization,['id','name'])||value.organization.id!==organizationId||!text(value.organization.name)||!companyUsageInstant(value.observedAt))fail();
 if(!exact(value.capacity,['state','cost'])||value.capacity.state!=='CONTRACT_PENDING'||value.capacity.cost!==null||!exact(value.funding,['state'])||value.funding.state!=='UNCONFIRMED')fail();
 const summary=value.summary;
 if(!exact(summary,['total','reserved','pending','observed','unmeasured','inputTokens','outputTokens','totalTokens',...(value.version===2?['audioSeconds']:[])])||!['total','reserved','pending','observed','unmeasured'].every(key=>integer(summary[key]))||!['inputTokens','outputTokens','totalTokens'].every(key=>token(summary[key]))||value.version===2&&!seconds(summary.audioSeconds)||BigInt(summary.total)!==['reserved','pending','observed','unmeasured'].reduce((total,key)=>total+BigInt(summary[key]),0n)||BigInt(summary.totalTokens)!==BigInt(summary.inputTokens)+BigInt(summary.outputTokens))fail();
 if(!Array.isArray(value.recent)||value.recent.length>20||value.recent.length>summary.total||typeof value.truncated!=='boolean')fail();
 const recent=value.recent.map(record=>{
  if(!exact(record,['receiptId','state','recordedAt','coverageState','model','usage',...(value.version===2?['stage','measurement']:[])])||!receipt(record.receiptId)||!Object.hasOwn(stateLabels,record.state)||!companyUsageInstant(record.recordedAt)||Date.parse(record.recordedAt)>Date.parse(value.observedAt)||!coverageStates.has(record.coverageState)||record.model!==null&&(typeof record.model!=='string'||! /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(record.model)))fail();
  if(value.version===1){if((record.state==='OBSERVED')!==(record.usage!==null))fail();}
  else {
   if(!Object.hasOwn(stageLabels,record.stage)||!exact(record.measurement,['unit','audioSeconds']))fail();
   const measured=record.measurement;
   if(record.state==='OBSERVED'){
    if(measured.unit==='TOKENS'){if(record.usage===null||measured.audioSeconds!==null)fail();}
    else if(measured.unit==='AUDIO_SECONDS'){if(record.usage!==null||!seconds(measured.audioSeconds)||!['FIELD_OPENAI_TRANSCRIPTION','FIELD_VIDEO_TRANSCRIPTION'].includes(record.stage))fail();}
    else fail();
   }else if(record.usage!==null||measured.unit!=='UNMEASURED'||measured.audioSeconds!==null)fail();
  }
  return {...record,stageLabel:value.version===1?'Cronograma':stageLabels[record.stage],audioSecondsLabel:record.measurement?.unit==='AUDIO_SECONDS'?quantitySeconds(record.measurement.audioSeconds):null,usage:record.usage===null?null:measuredUsage(record.usage),stateLabel:stateLabels[record.state],recordedLabel:dateLabel(record.recordedAt)};
 });
 if(new Set(recent.map(record=>record.receiptId)).size!==recent.length)fail();
 return {organizationId,companyName:value.organization.name,observedAt:value.observedAt,observedLabel:dateLabel(value.observedAt),coverage:coverage(value.coverage,value.observedAt),capacityLabel:'Límites de uso pendientes de aprobación',costLabel:'Costo no determinado',fundingLabel:'Financiación de proveedores sin confirmar',summary:{...summary,totalLabel:quantity(summary.total),reservedLabel:quantity(summary.reserved),pendingLabel:quantity(summary.pending),observedLabel:quantity(summary.observed),unmeasuredLabel:quantity(summary.unmeasured),tokensLabel:quantity(summary.totalTokens),audioSecondsLabel:value.version===2?quantitySeconds(summary.audioSeconds):null},recent,truncated:value.truncated};
}
export function companyUsageErrorMessage(error){
 if([401,403].includes(error?.status)||['SESSION_REQUIRED','WORKSPACE_ORGANIZATION_PERMISSION_REQUIRED','WORKSPACE_MEMBERSHIP_REQUIRED','OFFICE_REVIEW_ONLY','WORKSPACE_CONTEXT_CHANGED'].includes(error?.code))return 'Tu acceso a esta empresa cambió. Volvé a ingresar y consultá el uso con tus permisos actuales.';
 return 'No se pudo comprobar el uso registrado. Volvé a consultar; esta acción no procesa archivos ni envía solicitudes a la IA.';
}
