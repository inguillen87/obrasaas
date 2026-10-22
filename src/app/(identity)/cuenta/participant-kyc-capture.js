'use client';
import {KycPhotoPreparation} from './kyc-photo-preparation';
import {CAPTURE_QUALITY_NOTICE} from '../../../lib/capture-quality-policy.mjs';
import styles from './participant-kyc-capture.module.css';
const steps=['Frente del documento','Dorso del documento','Selfie'];
const precommitFacialNotice='participant-private-biometric-v3';
export function participantFacialModeValid(value){return value?.biometricNoticeVersion!==precommitFacialNotice||['MANUAL','ASSISTED'].includes(value.biometricMode)&&value.biometricConsent===(value.biometricMode==='ASSISTED');}
export function participantFacialModePatch(value,mode){return value?.biometricNoticeVersion===precommitFacialNotice&&['MANUAL','ASSISTED'].includes(mode)?{biometricMode:mode,biometricConsent:mode==='ASSISTED'}:null;}
const facialUuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
const facialKeys=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===[...keys].sort().join('|');
export function participantFacialStatusValid(value,command,{scope,projectId}){
 if(command?.biometricNoticeVersion!==precommitFacialNotice||!facialUuid(command.operationId)||!facialKeys(value,['scope','projectId','operationId','state','saved','definitive','facial'])||value.scope!==scope||value.projectId!==projectId||value.operationId!==command.operationId||value.state!=='FACIAL_PRECOMMIT'||value.saved!==false||value.definitive!==false)return false;
 const f=value.facial,closed=f?.phase==='CLOSED_MANUAL';
 return facialKeys(f,['phase','canContinueManual','privateObjectsMayExist',...(closed?['closedReceiptId','successorOperationId']:[])])&&['PREPARING','MODEL_UNKNOWN','PERSISTENCE_UNKNOWN','READY','REJECTED','CLOSED_MANUAL'].includes(f.phase)&&typeof f.canContinueManual==='boolean'&&typeof f.privateObjectsMayExist==='boolean'&&(!f.canContinueManual||['PREPARING','MODEL_UNKNOWN','PERSISTENCE_UNKNOWN','READY','REJECTED'].includes(f.phase))&&(!closed||!f.canContinueManual&&/^participant_facial_[a-f0-9]{64}$/.test(f.closedReceiptId)&&facialUuid(f.successorOperationId)&&f.successorOperationId!==value.operationId);
}
export function participantFacialManualSuccessor(command,status,nextOperationId,context){
 if(!participantFacialStatusValid(status,command,context)||!status.facial.canContinueManual||!facialUuid(nextOperationId)||nextOperationId===command.operationId||!command.front||!command.selfie||command.backConsent===true&&!command.back)return null;
 return {...command,operationId:nextOperationId,biometricMode:'MANUAL',biometricConsent:false,biometricManualFromOperationId:command.operationId};
}
export function ParticipantKycCapture({active=true,step,onStep,value,notices,backAvailable,locked,onFile,onBackConsent,onBiometricMode,onEdit}){
 const precommit=value.biometricNoticeVersion===precommitFacialNotice,matchingBiometricNotice=notices.privateBiometricNotice?.version===value.biometricNoticeVersion?notices.privateBiometricNotice:null;
 const backReady=value.backConsent!==true||Boolean(value.back);
 return <div className={styles.capture} data-kyc-capture-step={step+1}>
  <ol className={styles.steps} aria-label="Pasos de presentación de identidad">{steps.map((label,index)=><li key={label} aria-current={step===index?'step':undefined} data-complete={index===0?Boolean(value.front):index===1?step>1&&backReady:Boolean(value.selfie)}><span>{index+1}</span><strong>{label}</strong></li>)}</ol>
  <p className={styles.progress} role="status" aria-live="polite">Paso {step+1} de 3 · {steps[step]}</p>
  <div hidden={step!==0}>
   <KycPhotoPreparation kind="front" active={active&&step===0} disabled={locked} onChange={(file,options)=>onFile('front',file,options)}/>
   <details className={styles.privacy}><summary>Cómo se tratan mis imágenes</summary><p>{notices.privacyNotice.text}</p><a href="/privacidad" target="_blank" rel="noopener noreferrer">Política de privacidad ↗</a></details>
   <div className={styles.actions}><button type="button" disabled={locked||!value.front} onClick={()=>onStep(1)}>Continuar al dorso</button></div>
  </div>
  <div hidden={step!==1}>
   {backAvailable?<>
    <p>Podés agregar el dorso para completar la documentación. Elegí si querés incluirlo.</p>
    <details className={styles.privacy}><summary>Leer el aviso del dorso</summary><p>{notices.documentBackNotice.text}</p></details>
    <label className={styles.choice}><input type="checkbox" disabled={locked} checked={value.backConsent===true} onChange={event=>onBackConsent(event.target.checked)}/><span>Leí el aviso y autorizo agregar el dorso para su revisión.</span></label>
    {value.backConsent===true&&<KycPhotoPreparation kind="back" active={active&&step===1} disabled={locked} onChange={(file,options)=>onFile('back',file,options)}/>}
   </>:<p>En esta presentación podés continuar con el frente y tu selfie.</p>}
   <div className={styles.actions}><button type="button" disabled={locked} onClick={()=>onStep(0)}>Volver al frente</button><button type="button" disabled={locked||!value.front||!backReady} onClick={()=>onStep(2)}>{value.backConsent===true?'Continuar a la selfie':'Continuar sin dorso'}</button></div>
  </div>
  <div hidden={step!==2}>
   <p>Mostrá sólo tu rostro, de frente y con buena luz. No sostengas el documento en esta foto.</p>
   <KycPhotoPreparation kind="selfie" active={active&&step===2} disabled={locked} onChange={(file,options)=>onFile('selfie',file,options)}/>
   <div className={styles.checklist} aria-label="Imágenes preparadas"><span>{value.front?'✓':'○'} Frente</span><span>{value.backConsent===true?(value.back?'✓ Dorso':'○ Dorso'):'Dorso omitido'}</span><span>{value.selfie?'✓':'○'} Selfie</span></div>
   <details className={styles.privacy}><summary>Leer el aviso de presentación</summary><p>{notices.privacyNotice.text}</p><a href="/privacidad" target="_blank" rel="noopener noreferrer">Política de privacidad ↗</a></details>
   <p className={styles.note}>{CAPTURE_QUALITY_NOTICE}</p>
   <label className={styles.choice}><input required={step===2} type="checkbox" disabled={locked} checked={value.consent} onChange={event=>onEdit('consent',event.target.checked)}/><span>Leí el aviso y autorizo presentar estas imágenes para su revisión.</span></label>
   {precommit&&<fieldset className={styles.privacy}><legend>Elegí cómo presentar las fotografías</legend><p>Las dos opciones requieren revisión humana y no habilitan permisos.</p><details><summary>Leer el aviso de comparación</summary><p>{matchingBiometricNotice?.text||'Conservamos el aviso de esta solicitud. Consultá el estado antes de cambiar este intento.'}</p></details><label className={styles.choice}><input required={step===2} type="radio" name="biometric-mode" disabled={locked} checked={value.biometricMode==='MANUAL'} onChange={()=>onBiometricMode('MANUAL')}/><span>Presentar para revisión manual, sin comparación facial.</span></label><label className={styles.choice}><input required={step===2} type="radio" name="biometric-mode" disabled={locked||!matchingBiometricNotice} checked={value.biometricMode==='ASSISTED'} onChange={()=>onBiometricMode('ASSISTED')}/><span>Autorizo comparar el frente y la selfie antes de guardar.</span></label></fieldset>}
   {(notices.externalOcrNotice||!precommit&&notices.privateBiometricNotice)&&<details className={styles.optional}><summary>Opciones de análisis de la presentación</summary>
    <p>Estas opciones son independientes y podés continuar sin activarlas.</p>
    {notices.externalOcrNotice&&<div><details className={styles.privacy}><summary>Cómo se realiza la lectura del documento</summary><p>{notices.externalOcrNotice.text}</p></details><label className={styles.choice}><input type="checkbox" disabled={locked} checked={value.ocrConsent===true} onChange={event=>onEdit('ocrConsent',event.target.checked)}/><span>Autorizo la lectura asistida del frente de mi documento según el aviso.</span></label></div>}
    {!precommit&&notices.privateBiometricNotice&&<div><details className={styles.privacy}><summary>Cómo se comparan las fotografías</summary><p>{matchingBiometricNotice?.text||'Este intento conserva el aviso que elegiste al prepararlo. Podés consultar su versión en la política de privacidad.'}</p></details><label className={styles.choice}><input type="checkbox" disabled={locked} checked={value.biometricConsent===true} onChange={event=>onEdit('biometricConsent',event.target.checked)}/><span>Autorizo la comparación facial privada según el aviso.</span></label></div>}
   </details>}
   <p className={styles.note}>Al presentar, las imágenes quedan pendientes de revisión.</p>
   <div className={styles.actions}><button type="button" disabled={locked} onClick={()=>onStep(1)}>Volver al dorso</button></div>
  </div>
 </div>;
}
