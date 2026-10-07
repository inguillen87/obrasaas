import {voiceProgressDraftForEvidence,UNKNOWN_VOICE_VALUE,voiceQuantityScopeLabel,voiceProgressQuantityLabel,voiceProgressUnitLabel} from '../../../lib/voice-progress-draft.mjs';
import styles from './field-operations-panel.module.css';

export function VoiceProgressDraftView({evidence,task,disabled,canPrepare,onPrepare}){
 const draft=voiceProgressDraftForEvidence(evidence,task);if(!draft)return null;
 const changed=draft.task.revision!==task.revision;
 return <div className={styles.localReview} data-voice-progress-draft>
  <h4>{evidence.media.kind==='video'?'Borrador desde el audio del video':'Borrador desde el audio'}</h4>
  <p>Revisá la transcripción contra el original. Se reconocen expresiones explícitas; los datos dudosos quedan por confirmar.</p>
  <p>Tarea elegida al registrar: <strong>{draft.task.title}</strong>. Confirmá que la actividad corresponde a esta tarea.</p>
  <p>Actividad mencionada: {draft.activity===UNKNOWN_VOICE_VALUE?'Sin identificar':draft.activity}</p>
  <p>Cantidad mencionada: {voiceProgressQuantityLabel(draft.quantity)} · Unidad: {voiceProgressUnitLabel(draft.unit)}</p>
  <p>Alcance: {voiceQuantityScopeLabel(draft.quantitySemantics)}</p>
  {draft.quantityQuote!==UNKNOWN_VOICE_VALUE&&<p>Fragmento: «{draft.quantityQuote}»</p>}
  <p>La cantidad base y el porcentaje quedan para completar. Una cantidad del día no se suma automáticamente.</p>
  {changed?<p role="alert">La tarea cambió desde la transcripción. Consultá el audio y prepará una medición manual con la tarea vigente.</p>:evidence.status!=='APPROVED'?<p>Otra persona autorizada debe aprobar esta evidencia antes de preparar el avance.</p>:canPrepare&&<button type="button" disabled={disabled} onClick={onPrepare}>Revisar borrador de avance</button>}
 </div>;
}
