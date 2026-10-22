'use client';
import {KycPhotoPreparation} from './kyc-photo-preparation';
import {CAPTURE_QUALITY_NOTICE} from '../../../lib/capture-quality-policy.mjs';
import styles from './participant-kyc-capture.module.css';
const steps=['Frente del documento','Dorso del documento','Selfie'];
export function ParticipantKycCapture({active=true,step,onStep,value,notices,backAvailable,locked,onFile,onBackConsent,onEdit}){
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
   <KycPhotoPreparation kind="selfie" active={active&&step===2} disabled={locked} onChange={(file,options)=>onFile('selfie',file,options)}/>
   <div className={styles.checklist} aria-label="Imágenes preparadas"><span>{value.front?'✓':'○'} Frente</span><span>{value.backConsent===true?(value.back?'✓ Dorso':'○ Dorso'):'Dorso omitido'}</span><span>{value.selfie?'✓':'○'} Selfie</span></div>
   <details className={styles.privacy}><summary>Leer el aviso de presentación</summary><p>{notices.privacyNotice.text}</p><a href="/privacidad" target="_blank" rel="noopener noreferrer">Política de privacidad ↗</a></details>
   <p className={styles.note}>{CAPTURE_QUALITY_NOTICE}</p>
   <label className={styles.choice}><input required={step===2} type="checkbox" disabled={locked} checked={value.consent} onChange={event=>onEdit('consent',event.target.checked)}/><span>Leí el aviso y autorizo presentar estas imágenes para su revisión.</span></label>
   {(notices.externalOcrNotice||notices.privateBiometricNotice)&&<details className={styles.optional}><summary>Opciones de análisis de la presentación</summary>
    <p>Estas opciones son independientes y podés continuar sin activarlas.</p>
    {notices.externalOcrNotice&&<div><details className={styles.privacy}><summary>Cómo se realiza la lectura del documento</summary><p>{notices.externalOcrNotice.text}</p></details><label className={styles.choice}><input type="checkbox" disabled={locked} checked={value.ocrConsent===true} onChange={event=>onEdit('ocrConsent',event.target.checked)}/><span>Autorizo la lectura asistida del frente de mi documento según el aviso.</span></label></div>}
    {notices.privateBiometricNotice&&<div><details className={styles.privacy}><summary>Cómo se comparan las fotografías</summary><p>{notices.privateBiometricNotice.text}</p></details><label className={styles.choice}><input type="checkbox" disabled={locked} checked={value.biometricConsent===true} onChange={event=>onEdit('biometricConsent',event.target.checked)}/><span>Autorizo la comparación facial privada según el aviso.</span></label></div>}
   </details>}
   <p className={styles.note}>Al presentar, las imágenes quedan pendientes de revisión.</p>
   <div className={styles.actions}><button type="button" disabled={locked} onClick={()=>onStep(1)}>Volver al dorso</button></div>
  </div>
 </div>;
}
