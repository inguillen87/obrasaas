const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===[...keys].sort().join('|');
const utc=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const decimal=value=>typeof value==='string'&&/^(?:0|[1-9]\d{0,13})\.\d{4}$/.test(value);
const invalid=()=>{throw Object.assign(new Error('La historia no coincide con la tarea o sus páginas.'),{code:'APPROVED_PROGRESS_RESPONSE_INVALID'});};
const pointKeys=['id','at','snapshotRevision','origin','timeMeaning','progress','measurement','receiptId','executionId','segment'];
function point(row){
 if(!exact(row,pointKeys)||![row.id,row.receiptId].every(id)||!utc(row.at)||typeof row.snapshotRevision!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/.test(row.snapshotRevision)||!Number.isInteger(row.progress)||row.progress<0||row.progress>100||!Number.isSafeInteger(row.segment)||row.segment<0)return false;
 if(row.origin==='HUMAN_APPROVAL'){if(row.timeMeaning!=='APPROVED_AT'||row.executionId!==null)return false;}
 else if(row.origin!=='AUTHORIZED_EXECUTION'||row.timeMeaning!=='AUTHORIZED_RECORDED_AT'||!id(row.executionId))return false;
 const m=row.measurement;
 if(m===null)return true;
 if(!exact(m,['definitionId','executed','baseline','unit'])||m.definitionId!==null&&!id(m.definitionId)||!decimal(m.executed)||!decimal(m.baseline)||!['M','M2','M3','KG','T','L','UNIT','HOUR','DAY','LOT'].includes(m.unit))return false;
 const integer=value=>BigInt(value.replace('.',''));const baseline=integer(m.baseline),executed=integer(m.executed);
 return baseline>0n&&executed<=baseline&&Number(executed*100n/baseline)===row.progress;
}
export function confirmedApprovedProgressPage(value,context){
 const keys=['version','kind','scope','projectId','taskId','state','sourceScanComplete','coverage','beforeFirst','timeMeaning','snapshot','offset','total','rows','nextCursor',...(value?.state==='INCOMPLETE'?['reason']:[])];
 if(!exact(value,keys)||value.version!==1||value.kind!=='APPROVED_PROGRESS_CURVE'||value.scope!==context.scope||value.projectId!==context.projectId||value.taskId!==context.taskId||value.coverage!=='RETAINED_ACCOUNT_FIELD_AND_FIELD_EXECUTION_V1_ONLY'||value.beforeFirst!=='UNOBSERVED'||value.timeMeaning!=='APPROVAL_OR_AUTHORIZED_RECORD_TIME'||!Array.isArray(value.rows))invalid();
 if(value.state==='INCOMPLETE'){
  if(value.sourceScanComplete!==false||value.snapshot!==null||value.offset!==0||value.total!==null||value.rows.length||value.nextCursor!==null||typeof value.reason!=='string')invalid();
  return value;
 }
 if(value.state!=='CONFIRMED'||value.sourceScanComplete!==true||!hash(value.snapshot)||!Number.isSafeInteger(value.offset)||value.offset<0||!Number.isSafeInteger(value.total)||value.total<0||value.rows.length>100||value.offset+value.rows.length>value.total||value.nextCursor!==null&&(typeof value.nextCursor!=='string'||value.nextCursor.length>1200)||value.nextCursor===null&&value.offset+value.rows.length!==value.total||value.nextCursor!==null&&(value.rows.length!==100||value.offset+value.rows.length>=value.total)||!value.rows.every(point))invalid();
 return value;
}
export function mergeApprovedProgressPage(previous,raw,context){
 const page=confirmedApprovedProgressPage(raw,context);
 if(page.state==='INCOMPLETE')return {...page,complete:false};
 if(previous){if(previous.state!=='CONFIRMED'||previous.nextCursor===null||page.snapshot!==previous.snapshot||page.total!==previous.total||page.offset!==previous.rows.length||previous.scope!==page.scope||previous.projectId!==page.projectId||previous.taskId!==page.taskId)invalid();}
 else if(page.offset!==0)invalid();
 const rows=[...(previous?.rows||[]),...page.rows],ids=new Set();let last=null;
 for(const row of rows){if(ids.has(row.id)||last&&(row.at<last.at||row.at===last.at&&row.snapshotRevision<=last.snapshotRevision||row.segment<last.segment))invalid();ids.add(row.id);last=row;}
 return {...page,offset:0,rows,complete:page.nextCursor===null};
}

export function createApprovedProgressRead({request,getContext,onState,onAccessDenied}){
 let sequence=0,controller=null,value=null,closed=false;
 const same=captured=>{const current=getContext();return !closed&&captured&&current?.eligible&&['key','scope','projectId','taskId'].every(k=>current[k]===captured[k]);};
 return {
  invalidate(){sequence++;controller?.abort();controller=null;value=null;if(!closed)onState({value:null,busy:false,notice:''});},
  dispose(){closed=true;sequence++;controller?.abort();value=null;},
  async read(more=false){
   const captured=getContext();if(!captured?.eligible||more&&!value?.nextCursor)return;
   const previous=more?value:null,cursor=previous?.nextCursor,current=++sequence;controller?.abort();controller=new AbortController();
   if(!more)value=null;onState({value,busy:true,notice:''});
   try{
    const params=new URLSearchParams({projectId:captured.projectId,scope:captured.scope,progressCurveTaskId:captured.taskId,...(cursor?{progressCurveCursor:cursor}:{})});
    const page=await request('/api/identity/field-operations?'+params,{signal:controller.signal,requestTimeoutMs:15000},async response=>{
     if(!response.ok){let body;try{body=await response.json();}catch{}throw Object.assign(new Error('No se pudo consultar la historia.'),{status:response.status,code:body?.code});}
     return confirmedApprovedProgressPage(await response.json(),captured);
    });
    if(current!==sequence||!same(captured))return;
    value=mergeApprovedProgressPage(previous,page,captured);onState({value,busy:false,notice:value.state==='INCOMPLETE'?'No se confirmó la historia completa. No se dibuja una curva parcial.':''});
   }catch(error){
    if(current!==sequence||!same(captured))return;
    value=null;onState({value:null,busy:false,notice:error.code==='APPROVED_PROGRESS_SOURCE_CHANGED'?'La historia cambió entre páginas. Consultá otra vez desde el inicio.':'No se pudo confirmar la historia con tu acceso actual.'});
    if([401,403].includes(error.status)||['WORKSPACE_CONTEXT_CHANGED','WORKSPACE_PROJECT_UNAVAILABLE'].includes(error.code))onAccessDenied?.(error);
   }
  }
 };
}
