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
const captureFields=['front','back','selfie'];
const captureLabels={front:'Frente del documento',back:'Dorso del documento',selfie:'Selfie'};
// Presentation only: the actual request consumer decides whether a rejected
// attempt can be corrected. This view never clears or retries an operation.
export function participantCaptureRetakeView(value,captureRetakes,step){
 const field=captureFields[step];
 if(!field||!Number.isSafeInteger(captureRetakes?.[field])||captureRetakes[field]<1)return null;
 const retained=captureFields.filter(name=>name!==field&&Boolean(value?.[name])&&(name!=='back'||value.backConsent===true));
 return {field,label:captureLabels[field],replaced:Boolean(value?.[field]),retained:retained.map(name=>({field:name,label:captureLabels[name]})),readyForReview:Boolean(value?.front&&value.selfie&&(value.backConsent!==true||value.back))};
}
// An explicit final choice authorizes this one presentation. Rendering never selects a mode.
export function participantKycSubmitIntent(value,notices,mode,{step=2,locked=false}={}){
 if(locked||step!==2||!['MANUAL','ASSISTED'].includes(mode)||value?.biometricNoticeVersion!==precommitFacialNotice||notices?.privateBiometricNotice?.version!==precommitFacialNotice||typeof notices.privateBiometricNotice.text!=='string'||!notices.privateBiometricNotice.text.trim()||notices?.privacyNotice?.version!==value.noticeVersion||typeof notices.privacyNotice.text!=='string'||!notices.privacyNotice.text.trim()||!value.front||!value.selfie||value.backConsent===true&&!value.back)return null;
 if(value.ocrConsent===true&&(notices?.externalOcrNotice?.version!==value.ocrNoticeVersion||typeof notices.externalOcrNotice.text!=='string'||!notices.externalOcrNotice.text.trim()))return null;
 return {...value,consent:true,biometricMode:mode,biometricConsent:mode==='ASSISTED'};
}
export function ParticipantKycCapture({active=true,step,onStep,captureRetakes={},value,notices,backAvailable,locked,onFile,onBackConsent,onEdit,onSubmitChoice,submitBlocked=false}){
 const precommit=value.biometricNoticeVersion===precommitFacialNotice,matchingBiometricNotice=notices.privateBiometricNotice?.version===value.biometricNoticeVersion?notices.privateBiometricNotice:null;
 const backReady=value.backConsent!==true||Boolean(value.back),retake=locked?null:participantCaptureRetakeView(value,captureRetakes,step);
 const submitReady=precommit&&Boolean(matchingBiometricNotice?.text)&&notices.privacyNotice?.version===value.noticeVersion&&Boolean(value.front)&&Boolean(value.selfie)&&backReady;
 const completion=[Boolean(value.front),value.backConsent===true?Boolean(value.back):step>1,Boolean(value.selfie)];
 return <div className={styles.capture} data-kyc-capture-step={step+1}>
  <ol className={styles.steps} aria-label="Pasos de presentación de identidad">{steps.map((label,index)=><li key={label} aria-current={step===index?'step':undefined} data-complete={completion[index]}><span>{index+1}</span><strong>{label}</strong></li>)}</ol>
  <p className={styles.progress} role="status" aria-live="polite">Paso {step+1} de 3 · {steps[step]}</p>
  {retake&&<div className={styles.privacy} role="status" aria-live="polite" data-kyc-capture-recovery={retake.field}>
   <strong>{retake.replaced?'Fotografía reemplazada':'Repetí sólo esta fotografía'} · {retake.label}</strong>
   {retake.retained.length>0&&<div className={styles.checklist} role="list" aria-label="Fotografías que conservamos">{retake.retained.map(image=><span key={image.field} role="listitem">✓ {image.label} conservad{image.field==='selfie'?'a':'o'}</span>)}</div>}
   <p className={styles.note}>Las fotografías siguen en esta pantalla. No hace falta volver a cargarlas todas.</p>
  </div>}
  <div hidden={step!==0}>
   <KycPhotoPreparation key={'front:'+(captureRetakes.front||0)} kind="front" active={active&&step===0} disabled={locked} onChange={(file,options)=>onFile('front',file,options)}/>
   <details className={styles.privacy}><summary>Cómo se tratan mis imágenes</summary><p>{notices.privacyNotice.text}</p><a href="/privacidad" target="_blank" rel="noopener noreferrer">Política de privacidad ↗</a></details>
   <div className={styles.actions}><button type="button" disabled={locked||!value.front} onClick={()=>onStep(retake?.readyForReview?2:1)}>{retake?.readyForReview?'Revisar presentación':'Continuar al dorso'}</button></div>
  </div>
  <div hidden={step!==1}>
   {backAvailable?<>
    <p>Podés agregar el dorso para completar la documentación. Elegí si querés incluirlo.</p>
    <details className={styles.privacy}><summary>Leer el aviso del dorso</summary><p>{notices.documentBackNotice.text}</p></details>
    <label className={styles.choice}><input type="checkbox" disabled={locked} checked={value.backConsent===true} onChange={event=>onBackConsent(event.target.checked)}/><span>Leí el aviso y autorizo agregar el dorso para su revisión.</span></label>
    {value.backConsent===true&&<KycPhotoPreparation key={'back:'+(captureRetakes.back||0)} kind="back" active={active&&step===1} disabled={locked} onChange={(file,options)=>onFile('back',file,options)}/>}
   </>:<p>En esta presentación podés continuar con el frente y tu selfie.</p>}
   <div className={styles.actions}><button type="button" disabled={locked} onClick={()=>onStep(0)}>Volver al frente</button><button type="button" disabled={locked||!value.front||!backReady} onClick={()=>onStep(2)}>{retake?.readyForReview?'Revisar presentación':value.backConsent===true?'Continuar a la selfie':'Continuar sin dorso'}</button></div>
  </div>
  <div hidden={step!==2}>
   <p>Mostrá sólo tu rostro, de frente y con buena luz. No sostengas el documento en esta foto.</p>
   <KycPhotoPreparation key={'selfie:'+(captureRetakes.selfie||0)} kind="selfie" active={active&&step===2} disabled={locked} onChange={(file,options)=>onFile('selfie',file,options)}/>
   <div className={styles.checklist} aria-label="Imágenes preparadas"><span>{value.front?'✓':'○'} Frente</span><span>{value.backConsent===true?(value.back?'✓ Dorso':'○ Dorso'):'Dorso omitido'}</span><span>{value.selfie?'✓':'○'} Selfie</span></div>
   <p className={styles.note}>Al enviar comprobamos el encuadre y la calidad antes de guardar las fotos. «Enviar para verificar» autoriza comparar el rostro del documento con tu selfie. También podés enviarlas sin comparación facial. Esto no habilita el acceso automáticamente.</p>
   <details className={styles.optional}><summary>Privacidad y opciones</summary>
    <p><strong>Presentación de imágenes</strong></p><p>{notices.privacyNotice.text}</p>
    <p>{CAPTURE_QUALITY_NOTICE}</p>
    <p><strong>Comparación facial opcional</strong></p><p>{matchingBiometricNotice?.text||'Este intento conserva un aviso anterior. Consultá el estado vigente antes de preparar otra presentación.'}</p>
    {value.backConsent===true&&notices.documentBackNotice&&<><p><strong>Dorso del documento</strong></p><p>{notices.documentBackNotice.text}</p></>}
    {notices.externalOcrNotice&&<div><p><strong>Lectura opcional del documento</strong></p><p>{notices.externalOcrNotice.text}</p><label className={styles.choice}><input type="checkbox" disabled={locked} checked={value.ocrConsent===true} onChange={event=>onEdit('ocrConsent',event.target.checked)}/><span>Autorizo la lectura asistida del frente de mi documento según este aviso.</span></label></div>}
    <a href="/privacidad" target="_blank" rel="noopener noreferrer">Política de privacidad ↗</a>
   </details>
   {!locked&&!submitReady&&value.front&&value.selfie&&<p role="status" className={styles.note}>Comprobá los avisos vigentes antes de enviar. Tus imágenes siguen preparadas en esta pantalla.</p>}
   <div className={styles.actions+' '+styles.submitChoices}><button type="button" disabled={locked||submitBlocked||!submitReady} onClick={event=>onSubmitChoice(event,'ASSISTED')}>Enviar para verificar</button><button type="button" disabled={locked||submitBlocked||!submitReady} onClick={event=>onSubmitChoice(event,'MANUAL')}>Solicitar revisión sin comparación facial</button></div>
   <div className={styles.actions}><button type="button" disabled={locked} onClick={()=>onStep(1)}>Volver al dorso</button></div>
  </div>
 </div>;
}
