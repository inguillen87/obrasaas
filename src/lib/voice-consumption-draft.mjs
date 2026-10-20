import {createHash} from 'node:crypto';
import {inventoryQuantity} from './material-inventory.mjs';
import {validFieldMediaAnalysisConsent} from './field-media-privacy.mjs';
import {workspaceId} from './workspace-policy.mjs';

export const VOICE_CONSUMPTION_DRAFT_VERSION='voice-consumption-draft-v1';
const sha=value=>createHash('sha256').update(value).digest('hex');
const fold=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const revision=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/.test(value);
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const units={bolsa:'bolsa',bolsas:'bolsa',kg:'kg',kilo:'kg',kilos:'kg',kilogramo:'kg',kilogramos:'kg',litro:'litro',litros:'litro',l:'litro',unidad:'unidad',unidades:'unidad',m:'m',metro:'m',metros:'m',m2:'m2','m²':'m2','metro cuadrado':'m2','metros cuadrados':'m2',m3:'m3','m³':'m3','metro cubico':'m3','metros cubicos':'m3'};
const quantityPattern=/(?<![\p{L}\d.,+-])(\d+(?:[.,]\d+)?)\s*(metros?\s+cuadrados?|metros?\s+cubicos?|kilogramos?|unidades?|litros?|bolsas?|metros?|kilos?|m[23²³]|kg|m|l)(?![\p{L}\d])/gu;

// Only an existing, explicitly authorized, persisted audio transcription is
// read. This helper has no provider, file, identity or write capability.
export function consumptionTranscript(evidence){
 const processing=evidence?.processing,result=processing?.result;
 if(evidence?.media?.kind!=='audio'||evidence.status==='REJECTED'||processing?.status!=='TRANSCRIBED_UNREVIEWED'||!validFieldMediaAnalysisConsent(processing.analysisConsent)||processing.analysisConsent.allowed!==true||result?.success!==true||result.status!=='TRANSCRIBED_UNREVIEWED'||typeof result.text!=='string')return null;
 const transcript=result.text.trim();
 return transcript&&transcript.length<=32000&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f<>]/.test(transcript)?transcript:null;
}

export function createVoiceConsumptionDraft(evidence,material,context){
 const transcript=consumptionTranscript(evidence);
 if(!transcript||!workspaceId(evidence.id)||!revision(evidence.revision)||!hash(evidence.media.sha256)||!workspaceId(material?.id)||typeof material.name!=='string'||!material.name.trim()||!workspaceId(context?.projectId)||!workspaceId(context.workerId)||!workspaceId(context.sectorId)||context.taskId!==null&&!workspaceId(context.taskId)||evidence.workerId!==context.workerId||evidence.taskId!==context.taskId||evidence.sectorId!==context.sectorId||!hash(context.catalogHash))return null;
 const normalized=fold(transcript).replace(/\s+/g,' '),uncertainties=[],matches=[...normalized.matchAll(quantityPattern)],numbers=[...normalized.matchAll(/(?<![\p{L}\d])\d+(?:[.,]\d+)?/gu)];
 const hostile=/\b(?:ignora|ignorar|omite|omitir|instrucciones|instructions?|ignore|override|system|developer|prompt|aprueba|aproba|aprobar|approve|grant|administrador|permiso|identidad|dni|cuil|token|workerid|taskid|scope|operationid)\b/.test(normalized);
 const uncertain=/\b(?:no|nunca|tampoco|sin|cancel[ao]d[ao]s?|anulad[ao]s?|perdon|corrijo|correccion|rectifico|pendiente|falta|faltan|manana|usaremos|vamos a|aproximad[ao]s?|aprox|casi|quizas|tal vez|creo|entre|menos de|mas de|unos|unas|o)\b|\?|[<>~]|\d\s*[-–]\s*\d/.test(normalized);
 if(hostile)uncertainties.push('INSTRUCCIONES_O_DATOS_AJENOS');
 if(uncertain)uncertainties.push('CANTIDAD_NO_CONFIRMADA');
 if(!/\b(?:usamos|use|consumimos|consumi|gastamos|gaste)\b/.test(normalized))uncertainties.push('CONSUMO_NO_EXPLICITO');
 if(matches.length!==1||numbers.length!==1)uncertainties.push('CANTIDAD_UNICA_NO_CONFIRMADA');
 let quantity=null;
 if(!uncertainties.length){
  const match=matches[0],unit=units[match[2].replace(/\s+/g,' ')],name=fold(material.name).replace(/\s+/g,' ').trim(),tail=normalized.slice(match.index+match[0].length).trim();
  if(unit!==material.unit)uncertainties.push('UNIDAD_DISTINTA_SIN_CONVERSION');
  if(!tail.startsWith('de '+name)||/[\p{L}\d]/u.test(tail.slice(3+name.length,4+name.length)))uncertainties.push('MATERIAL_NO_CONFIRMADO');
  try{if(/^\d{1,3}\.\d{3}$/.test(match[1]))throw new Error('Ambiguous decimal');quantity=inventoryQuantity(match[1].replace(',','.'));}catch{uncertainties.push('CANTIDAD_NO_ADMITIDA');}
 }
 if(uncertainties.length)quantity=null;
 return {version:VOICE_CONSUMPTION_DRAFT_VERSION,status:'DRAFT_UNREVIEWED',humanReviewRequired:true,source:{evidenceId:evidence.id,evidenceRevision:evidence.revision,mediaSha256:evidence.media.sha256,transcriptSha256:sha(transcript)},context:{...context,materialId:material.id,unit:material.unit},quantity,reason:('Consumo informado en audio: '+transcript).slice(0,1000),transcriptExcerpt:transcript.slice(0,400),uncertainties,progress:null,baseline:null,stockApplied:false};
}

export function voiceConsumptionDraftCurrent(source,evidence,material,context){
 const current=createVoiceConsumptionDraft(evidence,material,context);
 return Boolean(current&&source?.version===VOICE_CONSUMPTION_DRAFT_VERSION&&source.confirmed===true&&source.quantity===current.quantity&&current.quantity!==null&&source.source?.evidenceId===current.source.evidenceId&&source.source.evidenceRevision===current.source.evidenceRevision&&source.source.mediaSha256===current.source.mediaSha256&&source.source.transcriptSha256===current.source.transcriptSha256&&Object.keys(current.context).every(key=>source.context?.[key]===current.context[key]));
}
