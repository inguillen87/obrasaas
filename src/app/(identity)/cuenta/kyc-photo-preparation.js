'use client';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {preparePhoto,verifyPhoto} from './field-media-preparation.mjs';
import {createKycCameraSession} from './kyc-camera-session.mjs';
import {createKycQualityMonitor,inspectKycPhotoQuality} from './kyc-image-quality.mjs';
import styles from './participant-panel.module.css';

export const KYC_PHOTO_LIMIT=1024*1024;
export const KYC_ORIGINAL_LIMITS={maxOriginalBytes:20*1024*1024,maxPixels:24_000_000,maxDimension:12000};
const size=bytes=>bytes>=1024*1024?(bytes/1024/1024).toFixed(2)+' MiB':Math.ceil(bytes/1024)+' KiB';

const cameraMessages={PERMISSION_DENIED:'No se habilitó la cámara. Podés dar permiso en el navegador y volver a intentar, o elegir un archivo.',UNAVAILABLE:'No pudimos abrir una cámara en este dispositivo. Revisá que esté disponible o elegí un archivo.',ENDED:'La cámara se desconectó. Podés volver a abrirla o elegir un archivo.',FRAME_UNAVAILABLE:'La imagen todavía no está lista. Esperá un momento y volvé a tomar la fotografía.',CAPTURE_FAILED:'No se pudo tomar la fotografía. La cámara sigue abierta para volver a intentar.'};
export function KycPhotoPreparation(props){return <KycPhotoPreparationInner key={props.kind} {...props}/>;}
function KycPhotoPreparationInner({kind,disabled,active=true,onChange}){
 const documentPhoto=kind==='front'||kind==='back',title=kind==='back'?'Dorso del documento':kind==='front'?'Frente del documento':'Fotografía del rostro';
 const [photo,setPhoto]=useState(null),[phase,setPhase]=useState('EMPTY'),[reviewed,setReviewed]=useState(false),[notice,setNotice]=useState('');
 const [cameraState,setCameraState]=useState({phase:'CLOSED',error:null});
 const [liveQuality,setLiveQuality]=useState(null);
 const original=useRef(null),generation=useRef(0),controller=useRef(null),acceptance=useRef(null),useButton=useRef(null),urls=useRef(new Set()),alive=useRef(true);
 const video=useRef(null),camera=useRef(null),cameraContext=useRef({disabled,active}),cameraButton=useRef(null),reviewChoice=useRef(null),cameraFocus=useRef(0),pendingCameraFocus=useRef(null);
 useLayoutEffect(()=>{
  // Each effect lifetime owns its session, including React's setup/cleanup replay.
  const focusGeneration=cameraFocus;
  const session=createKycCameraSession({getVideo:()=>video.current,isAllowed:()=>alive.current&&!cameraContext.current.disabled&&cameraContext.current.active,onState:value=>setCameraState(prior=>prior.phase===value.phase&&prior.error===value.error?prior:value)});
  camera.current=session;return()=>{focusGeneration.current++;pendingCameraFocus.current=null;session.dispose();if(camera.current===session)camera.current=null;};
 },[]);
 useLayoutEffect(()=>{cameraContext.current={disabled,active};if(disabled||!active){cameraFocus.current++;pendingCameraFocus.current=null;camera.current?.close();}},[disabled,active]);
 useLayoutEffect(()=>{
  const target=pendingCameraFocus.current;if(!target)return;
  if(!alive.current||!active||disabled||target.ticket!==cameraFocus.current||target.generation!==generation.current){pendingCameraFocus.current=null;return;}
  const element=target.review?(phase==='READY'?reviewChoice.current:null):(cameraState.phase==='CLOSED'?cameraButton.current:null);
  if(element?.getClientRects().length){pendingCameraFocus.current=null;element.focus();}
 });
 const revoke=()=>{urls.current.forEach(url=>URL.revokeObjectURL(url));urls.current.clear();};
 useEffect(()=>{alive.current=true;const allocated=urls.current,localGeneration=generation;return()=>{alive.current=false;localGeneration.current++;acceptance.current?.abort();acceptance.current=null;controller.current?.abort();allocated.forEach(url=>URL.revokeObjectURL(url));allocated.clear();};},[]);
 useEffect(()=>{
  if(cameraState.phase!=='LIVE'||disabled||!active)return;
  const monitor=createKycQualityMonitor({getVideo:()=>video.current,isAllowed:()=>alive.current&&cameraContext.current.active&&!cameraContext.current.disabled&&Boolean(video.current?.srcObject),onResult:value=>setLiveQuality(prior=>prior?.code===value.code?prior:{ok:value.ok,code:value.code,message:value.message})});
  monitor.start();return()=>monitor.dispose();
 },[cameraState.phase,disabled,active]);
 useEffect(()=>{const stop=()=>{cameraFocus.current++;pendingCameraFocus.current=null;camera.current?.close();},visibility=()=>{if(document.hidden)stop();};window.addEventListener('pagehide',stop);document.addEventListener('visibilitychange',visibility);return()=>{window.removeEventListener('pagehide',stop);document.removeEventListener('visibilitychange',visibility);};},[]);
 function reset(){cameraFocus.current++;pendingCameraFocus.current=null;camera.current?.close();generation.current++;acceptance.current?.abort();acceptance.current=null;controller.current?.abort();revoke();original.current=null;setPhoto(null);setReviewed(false);setPhase('EMPTY');setNotice('');onChange(null);}
 function openCamera(){if(disabled||!active||phase==='USING'||phase==='PREPARING')return;cameraFocus.current++;pendingCameraFocus.current=null;setLiveQuality(null);setNotice('');void camera.current?.open(kind);}
 function closeCamera(){pendingCameraFocus.current={ticket:++cameraFocus.current,generation:generation.current,review:false};camera.current?.close();}
 async function captureCamera(){const ticket=++cameraFocus.current;pendingCameraFocus.current=null;const file=await camera.current?.capture();if(file&&alive.current&&cameraContext.current.active&&!cameraContext.current.disabled)void prepare(file,0,ticket);}
 async function prepare(file,rotation=0,focusTicket=null){
  if(disabled||!active||!file)return;camera.current?.close();
  if(focusTicket===null){cameraFocus.current++;pendingCameraFocus.current=null;}
  const current=++generation.current;acceptance.current?.abort();acceptance.current=null;controller.current?.abort();controller.current=new AbortController();const signal=controller.current.signal;
  revoke();setPhoto(null);setReviewed(false);setPhase('PREPARING');setNotice('');onChange(null);
  try{
   const copy=file.size>KYC_PHOTO_LIMIT||rotation!==0?await preparePhoto(file,{maxBytes:KYC_PHOTO_LIMIT,originalLimits:KYC_ORIGINAL_LIMITS,rotation,signal}):{file,...await verifyPhoto(file,{originalLimits:KYC_ORIGINAL_LIMITS,signal}),rotation:0};
   if(!alive.current||current!==generation.current||signal.aborted)return;
   const quality=await inspectKycPhotoQuality(copy.file,{kind,signal});
   if(!alive.current||current!==generation.current||signal.aborted)return;
   if(!quality.ok)throw new Error(quality.message);
   const preview=URL.createObjectURL(copy.file),originalUrl=copy.file===file?preview:URL.createObjectURL(file);urls.current.add(preview);urls.current.add(originalUrl);
   original.current=file;if(focusTicket!==null)pendingCameraFocus.current={ticket:focusTicket,generation:current,review:true};setPhoto({...copy,preview,originalUrl,originalBytes:file.size,originalName:file.name,reduced:copy.file!==file});setPhase('READY');
  }catch(error){if(alive.current&&current===generation.current&&!signal.aborted){original.current=null;setPhase('EMPTY');setNotice(error.message);}}
 }
 async function accept(){
  if(!photo||!reviewed||disabled||phase!=='READY')return;
  cameraFocus.current++;pendingCameraFocus.current=null;camera.current?.close();
  const current=++generation.current,attempt=new AbortController();acceptance.current=attempt;setPhase('USING');setNotice('');
  try{const accepted=await onChange(photo.file,{signal:attempt.signal});if(alive.current&&current===generation.current&&!attempt.signal.aborted){setPhase(accepted?'ACCEPTED':'READY');if(!accepted)setNotice('No se completó la lectura. Conservamos esta copia y tu revisión. Volvé a usarla o descartá la fotografía.');}}
  catch{if(alive.current&&current===generation.current&&!attempt.signal.aborted){setPhase('READY');setNotice('No se completó la lectura. Conservamos esta copia y tu revisión. Volvé a usarla o descartá la fotografía.');}}
  finally{if(acceptance.current===attempt)acceptance.current=null;}
 }
 function cancelAcceptance(){
  const attempt=acceptance.current;if(phase!=='USING'||!attempt)return;
  const current=++generation.current;acceptance.current=null;attempt.abort();setPhase('READY');setNotice('Lectura detenida. Conservamos esta copia y tu revisión. Podés volver a usarla.');
  requestAnimationFrame(()=>{if(alive.current&&current===generation.current)useButton.current?.focus();});
 }
 const cameraOpen=cameraState.phase!=='CLOSED';
 const picker=<><div className={styles.cameraChoices}><button ref={cameraButton} type="button" disabled={disabled||!active||phase==='USING'||phase==='PREPARING'||cameraOpen} onClick={openCamera}>{photo?'Repetir con cámara':'Usar cámara'}</button><span>o elegí una imagen de tu dispositivo</span></div><label>Elegir archivo<input disabled={disabled||!active||phase==='USING'||cameraState.phase==='CAPTURING'} type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)prepare(file);}}/></label><details className={styles.photoDetails}><summary>Formatos y tamaño admitidos</summary><p className={styles.photoHint}>JPEG, PNG o WebP. Original hasta 20 MiB y 24 megapíxeles. La imagen a enviar será de hasta 1 MiB; el original se conserva.</p></details></>;
 const editing=<><button type="button" disabled={disabled||phase==='USING'} onClick={()=>prepare(original.current,(photo.rotation+90)%360)}>Girar 90°</button><button type="button" disabled={disabled||phase==='USING'} onClick={reset}>Descartar fotografía</button></>;
 return <fieldset className={styles.photo} aria-label={title}>
  <legend>{title}</legend>
  <p>{documentPhoto?'Fotografiá el '+(kind==='back'?'dorso':'frente')+' sobre un fondo que contraste. Mostrá sus cuatro bordes completos y dejá un pequeño margen de fondo alrededor, sin recortar. Usá luz pareja y sin reflejos. Revisá que se lean los datos.':'Mirando a la cámara, con luz de frente y el rostro completo. Esta foto se presenta para revisión humana.'}</p>
  {phase!=='ACCEPTED'&&picker}
  <div className={styles.cameraBox} hidden={!cameraOpen} aria-label={'Cámara: '+title.toLowerCase()}>
   <div className={styles.cameraViewport}><video ref={video} autoPlay playsInline muted className={styles.cameraVideo} data-mirrored={!documentPhoto} aria-label={'Vista previa de cámara: '+title.toLowerCase()}/><span className={documentPhoto?styles.cameraDocumentFrame:styles.cameraFaceFrame} aria-hidden="true"/></div>
   <p className={styles.cameraHint}>{cameraState.phase==='PERMISSION'?'Esperando tu permiso de cámara…':cameraState.phase==='CAPTURING'?'Tomando la fotografía…':documentPhoto?'Ubicá el documento completo dentro del marco.':'Centrala frente a tu rostro y mirá a la cámara.'}</p>
   {cameraState.phase==='LIVE'&&<p className={styles.photoHint} role="status" aria-live="polite">{liveQuality?.message||'Comprobando luz y nitidez en este dispositivo…'}</p>}
   <p className={styles.photoHint}>La vista previa queda en este dispositivo. Después vas a revisar la fotografía antes de usarla.</p>
   <div className={styles.actions}><button type="button" disabled={disabled||!active||cameraState.phase!=='LIVE'} onClick={captureCamera}>Tomar fotografía</button><button type="button" onClick={closeCamera}>Cerrar cámara</button></div>
  </div>
  <p role="status" aria-live="polite">{cameraState.error?cameraMessages[cameraState.error]:notice|| (phase==='PREPARING'?'Preparando una copia en este dispositivo…':phase==='USING'?'Leyendo la copia revisada… Todavía no se presentó.':phase==='ACCEPTED'?'Imagen revisada y lista para presentar.':'')}</p>
  {phase==='PREPARING'&&<button type="button" disabled={disabled} onClick={reset}>Cancelar preparación</button>}
  {photo&&<>
   {/* Only browser-local object URLs are shown; these images are not uploaded here. */}
   {/* eslint-disable-next-line @next/next/no-img-element */}
   <img className={styles.photoPreview} src={photo.preview} alt={'Vista previa privada: '+title.toLowerCase()}/>
   <details className={styles.photoDetails}><summary>Detalles de la imagen</summary><p className={styles.photoHint}>{photo.reduced?'Copia JPEG: '+size(photo.file.size)+' · '+photo.width+' × '+photo.height+' px. Original: '+size(photo.originalBytes)+'. '+(photo.file.size<photo.originalBytes?'Reducción de '+Math.round(100*(1-photo.file.size/photo.originalBytes))+'%.':'Se cambió la orientación; no se redujo el tamaño.'):'Se usará la imagen original: '+size(photo.file.size)+'. No fue reducida.'}</p><a className={styles.photoLink} href={photo.originalUrl} download={photo.originalName}>Conservar original</a></details>
   {phase!=='ACCEPTED'&&<label className={styles.consent}><input ref={reviewChoice} disabled={disabled||phase==='USING'} type="checkbox" checked={reviewed} onChange={event=>setReviewed(event.target.checked)}/>{documentPhoto?'Revisé la orientación y los datos del documento se leen con claridad.':'Revisé la orientación y el rostro se ve con claridad.'}</label>}
   {phase==='ACCEPTED'?<details className={styles.photoDetails}><summary>Cambiar fotografía</summary>{picker}<div className={styles.actions}>{editing}</div></details>:<div className={styles.actions}>
    {phase==='USING'&&<button type="button" onClick={cancelAcceptance}>Cancelar lectura local</button>}
    {phase!=='ACCEPTED'&&<button ref={useButton} type="button" disabled={disabled||phase==='USING'||!reviewed} onClick={accept}>{documentPhoto?'Usar documento revisado':'Usar fotografía revisada'}</button>}
    {editing}
   </div>}
  </>}
 </fieldset>;
}
