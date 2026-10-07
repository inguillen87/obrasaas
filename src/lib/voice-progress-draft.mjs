import {normalizeProgressMeasurementQuantity} from './progress-measurement-quantity.js';
import {fieldVideoAudioAnalysisAllowed} from './field-media-privacy.mjs';

export const VOICE_PROGRESS_DRAFT_VERSION='voice-progress-draft-v1';
export const VIDEO_AUDIO_RESULT_VERSION='field-video-audio-result-v1';
export const UNKNOWN_VOICE_VALUE='DESCONOCIDO';
export const voiceProgressUnitLabel=value=>({M:'m',M2:'m²',M3:'m³',KG:'kg',T:'toneladas',L:'litros',UNIT:'unidades',HOUR:'horas',DAY:'días',LOT:'lotes'}[value]||'Sin identificar');
export const voiceQuantityScopeLabel=value=>({ACUMULADA:'Acumulada hasta el momento',DELTA:'Del día o adicional'}[value]||'Por confirmar');
export const voiceProgressQuantityLabel=value=>value===UNKNOWN_VOICE_VALUE?'Por confirmar':String(value).replace(/(\.\d*?)0+$/,'$1').replace(/\.$/,'').replace('.',',');
const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
const revision=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/.test(value);
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const fold=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function searchableTranscript(raw){
 let normalized='';const starts=[],ends=[];
 for(const {segment,index} of new Intl.Segmenter('es',{granularity:'grapheme'}).segment(raw)){
  const folded=fold(segment);normalized+=folded;
  for(let offset=0;offset<folded.length;offset++){starts.push(index);ends.push(index+segment.length);}
 }
 return {normalized,starts,ends};
}
const units=Object.freeze({'m':'M','metro':'M','metros':'M','m2':'M2','m²':'M2','metro cuadrado':'M2','metros cuadrados':'M2','m3':'M3','m³':'M3','metro cubico':'M3','metros cubicos':'M3','kg':'KG','kilo':'KG','kilos':'KG','kilogramo':'KG','kilogramos':'KG','t':'T','tonelada':'T','toneladas':'T','l':'L','litro':'L','litros':'L','unidad':'UNIT','unidades':'UNIT','hora':'HOUR','horas':'HOUR','dia':'DAY','dias':'DAY','lote':'LOT','lotes':'LOT'});
const quantityPattern=/(?<![\p{L}\d.,+-])(\d+(?:[.,]\d+)?)\s*(metros?\s+cuadrados?|metros?\s+cubicos?|m[23²³]|kilogramos?|toneladas?|unidades?|litros?|metros?|horas?|dias?|lotes?|kilos?|kg|m|t|l)(?![\p{L}\d])/gu;
const execution=/\b(?:hicimos|hice|ejecutamos|ejecute|colocamos|coloque|instalamos|instale|completamos|complete|terminamos|termine|avanzamos|acumulamos|revocamos|pintamos|pinte)\b/;
// Conservative text extraction, after transcription. Text is data and can
// never choose an action, a person, a permission or an approval. Unsupported
// speech remains unknown; this helper does not call a provider or a store.
export function createVoiceProgressDraft({transcript,evidenceId,evidenceRevision,mediaSha256,transcriptSha256,task}){
 if(typeof transcript!=='string'||!transcript.trim()||transcript.length>32000||!id(evidenceId)||!revision(evidenceRevision)||!hash(mediaSha256)||!hash(transcriptSha256)||!id(task?.id)||!revision(task?.revision)||typeof task.title!=='string'||!task.title.trim()||task.title.length>500)throw new Error('Invalid voice progress context');
 const raw=transcript.trim(),search=searchableTranscript(raw),normalized=search.normalized,unknown=UNKNOWN_VOICE_VALUE,uncertainties=[];
 let quantity=unknown,unit=unknown,quantitySemantics=unknown,quantityQuote=unknown,activity=unknown;
 const hostile=/\b(?:ignora|ignorar|omite|omitir|instrucciones|instructions?|ignore|override|system|developer|prompt|autorizo|aprueba|aproba|aprobar|approve|grant|fichar|fichaje|check_in|administrador|permiso|identidad|dni|cuil|token|workerid|taskid|scope|operationid)\b/.test(normalized);
 const uncertain=/\b(?:no|nunca|tampoco|jamas|ningun[ao]?s?|ni|sin|dejamos de|cancel[ao]d[ao]s?|cancelo|anulad[ao]s?|anulo|revirtio|revertid[ao]s?|perdon|corrijo|correccion|rectifico|quise decir|pendiente|falta|faltan|manana|haremos|vamos a|por hacer|por ejecutar|aproximad[ao]s?|aprox|casi|quizas|tal vez|creo|entre|menos de|mas de|unos|unas|estimad[ao]s?|o)\b|\?|[<>~]|\d\s*[-–]\s*\d/.test(normalized);
 const consumption=/\b(?:usamos|use|consumimos|consumi|gastamos|gaste|compramos|compre|necesitamos|pedimos|recibimos|llevamos|trasladamos|transportamos|entregamos|depositamos|material usado|material consumido)\b/.test(normalized);
 const matches=[...normalized.matchAll(quantityPattern)];
 const numbers=[...normalized.matchAll(/(?<![\p{L}\d])\d+(?:[.,]\d+)?/gu)];
 if(hostile)uncertainties.push('INSTRUCCIONES_O_DATOS_AJENOS');
 if(uncertain)uncertainties.push('NEGACION_O_INCERTIDUMBRE');
 if(consumption)uncertainties.push('CONSUMO_NO_ES_METRADO');
 if(!execution.test(normalized))uncertainties.push('ACTIVIDAD_EJECUTADA_NO_EXPLICITA');
 if(matches.length!==1||numbers.length!==1)uncertainties.push(matches.length?'VARIAS_CANTIDADES':'CANTIDAD_O_UNIDAD_NO_EXPLICITA');
 if(!hostile&&!uncertain&&!consumption&&execution.test(normalized)&&matches.length===1&&numbers.length===1){
  const match=matches[0];
  try{if(/^\d{1,3}\.\d{3}$/.test(match[1]))throw new Error('Ambiguous separator');quantity=normalizeProgressMeasurementQuantity(match[1].replace(',','.'));unit=units[match[2].replace(/\s+/g,' ')];if(!unit)throw new Error('Unknown unit');const sourceEnd=search.ends[match.index+match[0].length-1];quantityQuote=raw.slice(search.starts[match.index],sourceEnd);
   const accumulated=/\b(?:acumulamos|acumulad[ao]s?|en total|total ejecutado|hasta ahora|hasta la fecha)\b/.test(normalized),delta=/\b(?:hoy|esta jornada|en esta jornada|adicionales|mas que ayer)\b/.test(normalized);
   quantitySemantics=accumulated&&!delta?'ACUMULADA':delta&&!accumulated?'DELTA':unknown;
   if(quantitySemantics===unknown)uncertainties.push('ACUMULADA_O_DELTA_NO_CONFIRMADA');
   const tail=raw.slice(sourceEnd).trim(),reported=/^(?:de|en)\s+(.+?)[.!;]?$/i.exec(tail);
   activity=reported?.[1]?.slice(0,240)||unknown;
  }catch{quantity=unknown;unit=unknown;quantityQuote=unknown;uncertainties.push('DECIMAL_NO_ADMITIDO');}
 }
 if(activity===unknown)uncertainties.push('ACTIVIDAD_NO_EXPLICITA');
 uncertainties.push('CORRESPONDENCIA_TAREA_REQUIERE_REVISION');
 return {version:VOICE_PROGRESS_DRAFT_VERSION,status:'DRAFT_UNREVIEWED',humanReviewRequired:true,
  source:{evidenceId,evidenceRevision,mediaSha256,transcriptSha256},task:{id:task.id,title:task.title,revision:task.revision,selection:'HUMAN_SELECTED_CONTEXT'},
  activity,quantity,unit,quantitySemantics,quantityQuote,baseline:null,progress:null,uncertainties};
}

export function voiceTranscriptForEvidence(evidence){
 const result=evidence?.processing?.result;
 if(evidence?.media?.kind==='audio'&&evidence.processing?.status==='TRANSCRIBED_UNREVIEWED')return typeof result?.text==='string'&&result.text.trim()&&result.text.length<=32000?result.text.trim():null;
 if(evidence?.media?.kind!=='video'||!['ANALYZED_UNREVIEWED','TRANSCRIBED_UNREVIEWED'].includes(evidence.processing?.status)||!fieldVideoAudioAnalysisAllowed(evidence.processing?.analysisConsent))return null;
 const a=result?.videoAudio,t=a?.transcription,x=a?.extraction,v=a?.visualSource,s=result?.sampling,m=evidence.media;
 if(!hash(t?.inputAudioSha256)||t.inputAudioSha256!==x?.pcm?.sha256)return null;
 if(a?.version!==VIDEO_AUDIO_RESULT_VERSION||a.status!=='TRANSCRIBED_UNREVIEWED'||t?.status!=='TRANSCRIBED_UNREVIEWED'||t.provider!=='openai'||typeof t.providerModel!=='string'||!/^gpt-transcribe(?:-[A-Za-z0-9.-]+)?$|^whisper-1$|^gpt-4o(?:-mini)?-transcribe(?:-[A-Za-z0-9.-]+)?$/.test(t.providerModel)||t.speakerVerified!==false||t.identityVerified!==false||t.attendanceRegistered!==false||t.requiresHumanReview!==true||!hash(t.transcriptSha256)||typeof t.text!=='string'||!t.text.trim()||t.text!==t.text.trim()||t.text.length>32000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(t.text)||x?.version!=='server-video-audio-v1'||x.sourceSha256!==m.sha256||x.sourceBytes!==m.bytes||x.sourceContentType!==m.contentType||x.sourceStream?.ordinal!==0||x.wordTimestampsAvailable!==false||x.sourceVideoFullDecodeVerified!==false||x.nativeEnergy?.allChannelsDigitalZero!==false||x.pcm?.sampleRate!==16000||x.pcm.channels!==1||x.pcm.bitsPerSample!==16||!Number.isSafeInteger(x.pcm.sampleCount)||x.pcm.sampleCount<1||x.pcm.sampleCount>640000||!Number.isSafeInteger(x.pcm.nonzeroSamples)||x.pcm.nonzeroSamples<1||x.pcm.nonzeroSamples>x.pcm.sampleCount||x.inputOrigin?.authority!=='FFMPEG_DEFAULT_INPUT_START_NORMALIZATION'||x.inputOrigin.audioOnlyRebaseApplied!==false||x.timing?.timestampAuthority!=='DECODED_AUDIO_FRAME_PTS_AFTER_FFMPEG_INPUT_NORMALIZATION'||v?.version!=='server-video-frames-v1'||v.decoded!==true||v.frameCount!==4||v.sourceSha256!==m.sha256||v.sourceBytes!==m.bytes||v.sourceContentType!==m.contentType||s?.version!==v.version||s.sourceSha256!==m.sha256||s.sourceBytes!==m.bytes||s.sourceContentType!==m.contentType||s.frameCount!==4||s.audioAnalyzed!==false)return null;
 return t.text;
}
export function voiceProgressDraftForEvidence(evidence,task){
 const draft=evidence?.processing?.result?.progressDraft,unknown=UNKNOWN_VOICE_VALUE;
 const transcript=voiceTranscriptForEvidence(evidence);
 if(!id(evidence?.id)||!transcript||draft?.version!==VOICE_PROGRESS_DRAFT_VERSION||draft.status!=='DRAFT_UNREVIEWED'||draft.humanReviewRequired!==true||draft.baseline!==null||draft.progress!==null||draft.source?.evidenceId!==evidence.id||draft.source.mediaSha256!==evidence.media.sha256||!revision(draft.source.evidenceRevision)||!hash(draft.source.transcriptSha256)||draft.task?.id!==evidence.taskId||draft.task.id!==task?.id||!revision(draft.task.revision)||draft.task.selection!=='HUMAN_SELECTED_CONTEXT'||typeof draft.task.title!=='string'||typeof draft.activity!=='string'||draft.activity.length>240||!['ACUMULADA','DELTA',unknown].includes(draft.quantitySemantics)||!Array.isArray(draft.uncertainties)||draft.uncertainties.some(value=>typeof value!=='string')||typeof draft.quantityQuote!=='string')return null;
 if(evidence.media.kind==='video'&&(draft.source.transcriptSha256!==evidence.processing.result.videoAudio.transcription.transcriptSha256||draft.quantityQuote!==unknown&&!transcript.includes(draft.quantityQuote)))return null;
 if(draft.quantity===unknown){if(draft.unit!==unknown||draft.quantitySemantics!==unknown)return null;}
 else {try{if(normalizeProgressMeasurementQuantity(draft.quantity)!==draft.quantity||!Object.values(units).includes(draft.unit))return null;}catch{return null;}}
 return draft;
}

export function prepareVoiceProgressDraft(evidence,task,workerId){
 const interpretation=voiceProgressDraftForEvidence(evidence,task);
 if(!interpretation||evidence.status!=='APPROVED'||!revision(evidence.revision)||!id(workerId))throw new Error('El audio necesita una revisión aprobada antes de preparar el avance.');
 if(interpretation.task.revision!==task.revision)throw new Error('La tarea cambió desde la transcripción. Revisá el audio con la tarea vigente y prepará la medición manual.');
 return {payload:{workerId,taskId:task.id,progress:'',quantity:interpretation.quantitySemantics==='ACUMULADA'&&interpretation.quantity!==UNKNOWN_VOICE_VALUE?interpretation.quantity:'',baseline:'',unit:interpretation.unit===UNKNOWN_VOICE_VALUE?'':interpretation.unit,reason:((evidence.media.kind==='video'?'Audio del video revisado: ':'Nota de audio revisada: ')+voiceTranscriptForEvidence(evidence)).slice(0,1000),evidenceIds:[evidence.id]},
  sourceVoice:{evidenceId:evidence.id,evidenceRevision:evidence.revision,taskId:task.id,taskRevision:task.revision,mediaSha256:evidence.media.sha256,transcriptSha256:interpretation.source.transcriptSha256,quantitySemantics:interpretation.quantitySemantics,...(evidence.media.kind==='video'?{mediaKind:'video'}:{}),confirmed:false}};
}

export function voiceProgressDraftReady(source,evidence,task,evidenceIds=[source?.evidenceId]){
 const draft=voiceProgressDraftForEvidence(evidence,task);
 return Boolean(source?.confirmed===true&&source.invalidated!==true&&Array.isArray(evidenceIds)&&evidenceIds.includes(source.evidenceId)&&draft&&evidence.status==='APPROVED'&&(evidence.media.kind!=='video'||source.mediaKind==='video')&&source.evidenceId===evidence.id&&source.evidenceRevision===evidence.revision&&source.taskId===task.id&&source.taskRevision===task.revision&&draft.task.revision===task.revision&&source.mediaSha256===evidence.media.sha256&&source.transcriptSha256===draft.source.transcriptSha256);
}
