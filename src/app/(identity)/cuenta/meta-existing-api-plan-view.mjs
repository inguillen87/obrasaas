export {EXISTING_API_PLAN_ACTIONS,EXISTING_API_PLAN_REJECTION_CODES,existingApiPlanAction,existingApiPlanCommandReference,existingApiPlanReceiptOutcome} from './workspace-recovery-journal.mjs';
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const exact=(value,keys)=>object(value)&&Object.keys(value).sort().join('|')===keys.slice().sort().join('|');
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const revision=value=>Number.isSafeInteger(value)&&value>=1;
const timestamp=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const invalid=()=>Object.assign(new Error('No se pudo comprobar el plan del proveedor existente. Conservamos el intento para consultar su recibo.'),{code:'META_CUSTOMER_EXISTING_API_PLAN_RESPONSE_INVALID'});
export function existingApiPlanSnapshot(value,{numberMode,preparedRevision}={}){
 if(value===null||value===undefined)return null;
 const keys=['id','state','preparedRevision','preparedAt','currentPreparationRevision','preparationCurrent','connectionCurrent','canClose','closedAt','preserveProvider','providerChanged','authorizationGranted','remoteMutationDispatched'];
 if(!exact(value,keys)||!uuid(value.id)||!['ADDITIONAL_AUTHORIZATION_REVIEW_REQUIRED','CLOSED'].includes(value.state)||!revision(value.preparedRevision)||!timestamp(value.preparedAt)||!Number.isSafeInteger(value.currentPreparationRevision)||value.currentPreparationRevision<0||
   ['preparationCurrent','connectionCurrent','canClose'].some(key=>typeof value[key]!=='boolean')||value.preserveProvider!==true||value.providerChanged!==false||value.authorizationGranted!==false||value.remoteMutationDispatched!==false||
   value.canClose!==(value.state!=='CLOSED')||(value.state==='CLOSED'?!timestamp(value.closedAt)||Date.parse(value.closedAt)<Date.parse(value.preparedAt):value.closedAt!==null)||
   value.preparationCurrent&&(value.currentPreparationRevision!==value.preparedRevision||numberMode!==undefined&&numberMode!=='EXISTING_API')||preparedRevision!==undefined&&value.currentPreparationRevision!==preparedRevision)throw invalid();
 return value;
}

