const states=new Set(['RESERVED','DISPATCHED','UNKNOWN','OBSERVED','UNMEASURED']);
const coverageStates=new Set(['TRIAL_CURRENT','PAID_PERIOD_OBSERVED','EXPIRED','UNCONFIRMED']);
const pendingStates=new Set(['RESERVED','DISPATCHED','UNKNOWN']);
const receipt=value=>typeof value==='string'&&/^organization_usage_[a-f0-9]{64}$/.test(value);
const fail=()=>{throw Object.assign(new Error('No pudimos confirmar el registro de uso de este borrador.'),{code:'PLAN_IMPORT_USAGE_UNCONFIRMED'});};

export function planImportUsageView(draft){
 if(!draft||typeof draft!=='object')return null;
 const present=Object.hasOwn(draft,'usage'),value=draft.usage;
 if(present&&(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join('|')!=='coverageState|receiptId|state|version'||value.version!==1||!receipt(value.receiptId)||!states.has(value.state)||!coverageStates.has(value.coverageState)))fail();
 const coverageExpired=draft.status==='FAILED'&&draft.failure==='ORGANIZATION_USAGE_COVERAGE_EXPIRED';
 if(!present&&!coverageExpired)return null;
 const pending=present&&pendingStates.has(value.state),sourceAvailable=draft.sourceAvailable===true;
 const label=pending?'Uso pendiente de comprobación':coverageExpired?'Cobertura de uso finalizada':value?.state==='OBSERVED'?'Uso registrado y comprobado':'Uso registrado sin medición del proveedor';
 const description=pending?'Consultá el mismo intento; la consulta no vuelve a invocar la IA. Un plazo vencido no confirma que el procesamiento no haya ocurrido.':coverageExpired?'La cobertura actual no permite completar la extracción. Consultá Plan y pago antes de decidir otra operación.':'El registro técnico no aprueba el contenido ni modifica las tareas. Revisá el borrador y su fuente antes de decidir.';
 return {state:present?value.state:null,receiptId:present?value.receiptId:null,pending,coverageExpired,preserveWork:true,label,description,sourceAvailable,sourceLabel:sourceAvailable?'La fuente privada está comprobada y disponible para consultar.':'La fuente privada todavía no está comprobada. Conservá tu archivo original.'};
}

export function planImportPreservation({data,outcome,currentDraft,localRowsEdited=false}={}){
 const usage=planImportUsageView(data?.draft),expired=outcome?.state==='EXPIRED',processing=outcome?.state==='PROCESSING',decision=outcome?.state==='RECORDED'&&typeof data?.receiptId==='string'&&['EDIT','APPLY','REJECT'].includes(data.action),preserve=!decision&&(expired||processing||Boolean(usage));
 return {usage,preserveFile:preserve,preserveRows:preserve&&localRowsEdited&&currentDraft?.id===data?.draft?.id,retainReference:usage?.pending===true,expired};
}
