'use client';
import {useEffect,useRef,useState} from 'react';
import {preparePhoto,verifyPhoto} from './field-media-preparation.mjs';
import styles from './participant-panel.module.css';

export const KYC_PHOTO_LIMIT=1024*1024;
export const KYC_ORIGINAL_LIMITS={maxOriginalBytes:20*1024*1024,maxPixels:24_000_000,maxDimension:12000};
const size=bytes=>bytes>=1024*1024?(bytes/1024/1024).toFixed(2)+' MiB':Math.ceil(bytes/1024)+' KiB';

export function KycPhotoPreparation({kind,disabled,onChange}){
 const documentPhoto=kind==='front',title=documentPhoto?'Frente del documento':'Fotografía del rostro';
 const [photo,setPhoto]=useState(null),[phase,setPhase]=useState('EMPTY'),[reviewed,setReviewed]=useState(false),[notice,setNotice]=useState('');
 const original=useRef(null),generation=useRef(0),controller=useRef(null),urls=useRef(new Set()),alive=useRef(true);
 const revoke=()=>{urls.current.forEach(url=>URL.revokeObjectURL(url));urls.current.clear();};
 useEffect(()=>{alive.current=true;const allocated=urls.current;return()=>{alive.current=false;controller.current?.abort();allocated.forEach(url=>URL.revokeObjectURL(url));allocated.clear();};},[]);
 function reset(){generation.current++;controller.current?.abort();revoke();original.current=null;setPhoto(null);setReviewed(false);setPhase('EMPTY');setNotice('');onChange(null);}
 async function prepare(file,rotation=0){
  const current=++generation.current;controller.current?.abort();controller.current=new AbortController();const signal=controller.current.signal;
  revoke();setPhoto(null);setReviewed(false);setPhase('PREPARING');setNotice('');onChange(null);
  try{
   const copy=file.size>KYC_PHOTO_LIMIT||rotation!==0?await preparePhoto(file,{maxBytes:KYC_PHOTO_LIMIT,originalLimits:KYC_ORIGINAL_LIMITS,rotation,signal}):{file,...await verifyPhoto(file,{originalLimits:KYC_ORIGINAL_LIMITS,signal}),rotation:0};
   if(!alive.current||current!==generation.current||signal.aborted)return;
   const preview=URL.createObjectURL(copy.file),originalUrl=copy.file===file?preview:URL.createObjectURL(file);urls.current.add(preview);urls.current.add(originalUrl);
   original.current=file;setPhoto({...copy,preview,originalUrl,originalBytes:file.size,originalName:file.name,reduced:copy.file!==file});setPhase('READY');
  }catch(error){if(alive.current&&current===generation.current&&!signal.aborted){original.current=null;setPhase('EMPTY');setNotice(error.message);}}
 }
 async function accept(){
  if(!photo||!reviewed||disabled||phase!=='READY')return;
  const current=generation.current;setPhase('USING');setNotice('');
  try{const accepted=await onChange(photo.file);if(alive.current&&current===generation.current){setPhase(accepted?'ACCEPTED':'READY');if(!accepted)setNotice('No se pudo usar la copia. Volvé a intentarlo.');}}
  catch{if(alive.current&&current===generation.current){setPhase('READY');setNotice('No se pudo usar la copia. Volvé a intentarlo.');}}
 }
 return <fieldset className={styles.photo} aria-label={title}>
  <legend>{title}</legend>
  <p>{documentPhoto?'Fotografiá el frente completo, con luz pareja y sin reflejos. Revisá que se lean los datos.':'Mirando a la cámara, con luz de frente y el rostro completo. Esta foto se presenta para revisión humana.'}</p>
  <label>Tomar o elegir una fotografía<input disabled={disabled||phase==='USING'} type="file" accept="image/jpeg,image/png,image/webp" capture={documentPhoto?'environment':'user'} onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)prepare(file);}}/></label>
  <p className={styles.photoHint}>JPEG, PNG o WebP. Original hasta 20 MiB y 24 megapíxeles. La imagen a enviar será de hasta 1 MiB; el original se conserva.</p>
  <p role="status" aria-live="polite">{notice|| (phase==='PREPARING'?'Preparando una copia en este teléfono…':phase==='ACCEPTED'?'Imagen revisada y lista para presentar.':'')}</p>
  {phase==='PREPARING'&&<button type="button" disabled={disabled} onClick={reset}>Cancelar preparación</button>}
  {photo&&<>
   {/* Only browser-local object URLs are shown; these images are not uploaded here. */}
   {/* eslint-disable-next-line @next/next/no-img-element */}
   <img className={styles.photoPreview} src={photo.preview} alt={'Vista previa privada: '+title.toLowerCase()}/>
   <p className={styles.photoHint}>{photo.reduced?'Copia JPEG: '+size(photo.file.size)+' · '+photo.width+' × '+photo.height+' px. Original: '+size(photo.originalBytes)+'. '+(photo.file.size<photo.originalBytes?'Reducción de '+Math.round(100*(1-photo.file.size/photo.originalBytes))+'%.':'Se cambió la orientación; no se redujo el tamaño.'):'Se usará la imagen original: '+size(photo.file.size)+'. No fue reducida.'}</p>
   <a className={styles.photoLink} href={photo.originalUrl} download={photo.originalName}>Conservar original</a>
   {phase!=='ACCEPTED'&&<label className={styles.consent}><input disabled={disabled||phase==='USING'} type="checkbox" checked={reviewed} onChange={event=>setReviewed(event.target.checked)}/>{documentPhoto?'Revisé la orientación y los datos del documento se leen con claridad.':'Revisé la orientación y el rostro se ve con claridad.'}</label>}
   <div className={styles.actions}>
    {phase!=='ACCEPTED'&&<button type="button" disabled={disabled||phase==='USING'||!reviewed} onClick={accept}>{documentPhoto?'Usar documento revisado':'Usar fotografía revisada'}</button>}
    <button type="button" disabled={disabled||phase==='USING'} onClick={()=>prepare(original.current,(photo.rotation+90)%360)}>Girar 90°</button>
    <button type="button" disabled={disabled||phase==='USING'} onClick={reset}>Descartar fotografía</button>
   </div>
  </>}
 </fieldset>;
}
