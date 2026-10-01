'use client';
/* eslint-disable @next/next/no-img-element -- Object URLs keep private files in this browser without an optimization upload. */
import {useEffect,useRef,useState} from 'react';
import {PHOTO_LIMIT,RECORDING_LIMIT,RECORDING_PROFILES,FIELD_MEDIA_TYPES,normalizedType,validateLocalMedia,recordingType,preparePhoto} from './field-media-preparation.mjs';
import styles from './field-operations-panel.module.css';
const size=bytes=>bytes>=1024*1024?(bytes/(1024*1024)).toFixed(2)+' MiB':Math.ceil(bytes/1024)+' KiB';
export function FieldMediaCapture({disabled,onChange,onBusyChange}) {
  const [selection,setSelection]=useState(null),[phase,setPhase]=useState('IDLE'),[message,setMessage]=useState(''),[recording,setRecording]=useState(null),[elapsed,setElapsed]=useState(0),[accepted,setAccepted]=useState(false);
  const generation=useRef({value:0}),mounted=useRef(true),stream=useRef(null),recorder=useRef(null),timer=useRef(null),preview=useRef(null),callbacks=useRef({onChange,onBusyChange}),urls=useRef([]);
  useEffect(()=>{callbacks.current={onChange,onBusyChange};},[onChange,onBusyChange]);
  const active=['PREPARING','PERMISSION','RECORDING'].includes(phase);
  useEffect(()=>{callbacks.current.onBusyChange?.(active);},[active]);
  function release(){clearInterval(timer.current);timer.current=null;stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;}
  function clearUrls(){urls.current.forEach(url=>URL.revokeObjectURL(url));urls.current=[];}
  function selectionUrls(original,prepared){const originalUrl=URL.createObjectURL(original),preparedUrl=prepared===original?originalUrl:URL.createObjectURL(prepared);urls.current=[...new Set([originalUrl,preparedUrl])];return {originalUrl,preparedUrl};}
  useEffect(()=>{mounted.current=true;const counter=generation.current;return()=>{mounted.current=false;counter.value++;clearUrls();if(recorder.current?.state==='recording')recorder.current.stop();release();callbacks.current.onBusyChange?.(false);};},[]);
  useEffect(()=>{if(preview.current&&stream.current){preview.current.srcObject=stream.current;preview.current.play().catch(()=>{});}},[phase]);
  async function choose(original) {
    if(!original)return;const token=++generation.current.value;callbacks.current.onChange?.(null);setAccepted(false);clearUrls();setSelection(null);setMessage('');
    try {validateLocalMedia(original);let prepared=original,details=null;
      if(original.type.startsWith('image/')&&original.size>PHOTO_LIMIT){setPhase('PREPARING');details=await preparePhoto(original);prepared=details.file;}
      if(mounted.current&&token===generation.current.value){setSelection({original,prepared,details,rotation:0,...selectionUrls(original,prepared)});setPhase('REVIEW');}
    }catch(error){if(mounted.current&&token===generation.current.value){setMessage(error.message);setPhase('IDLE');}}
  }
  async function rotate() {
    if(!selection||active||disabled)return;const token=++generation.current.value;callbacks.current.onChange?.(null);setAccepted(false);setPhase('PREPARING');setMessage('');
    try {const rotation=(selection.rotation+90)%360,details=await preparePhoto(selection.original,{rotation});if(mounted.current&&token===generation.current.value){clearUrls();setSelection({...selection,prepared:details.file,details,rotation,...selectionUrls(selection.original,details.file)});setPhase('REVIEW');}}
    catch(error){if(mounted.current&&token===generation.current.value){setMessage(error.message);setPhase('REVIEW');}}
  }
  function discard(){generation.current.value++;if(recorder.current?.state==='recording')recorder.current.stop();recorder.current=null;release();clearUrls();setSelection(null);setRecording(null);setAccepted(false);setMessage('');setPhase('IDLE');callbacks.current.onChange?.(null);}
  async function record(kind) {
    if(disabled||active)return;const type=recordingType(kind);
    if(!navigator.mediaDevices?.getUserMedia||!type){setMessage('Este navegador no ofrece grabación compatible. Podés adjuntar un archivo compatible hasta 3 MiB.');return;}
    discard();const token=++generation.current.value,profile=RECORDING_PROFILES[kind];setPhase('PERMISSION');setRecording(kind);setElapsed(0);setMessage('El navegador va a pedir permiso. La grabación queda en este dispositivo hasta que decidas enviarla.');
    try {
      const input=await navigator.mediaDevices.getUserMedia({audio:true,video:kind==='video'?{facingMode:{ideal:'environment'},width:{ideal:640,max:1280},height:{ideal:360,max:720},frameRate:{ideal:15,max:20}}:false});
      if(!mounted.current||token!==generation.current.value){input.getTracks().forEach(track=>track.stop());return;}
      stream.current=input;const chunks=[],instance=new MediaRecorder(input,{mimeType:type,audioBitsPerSecond:profile.audioBitsPerSecond,...(kind==='video'?{videoBitsPerSecond:profile.videoBitsPerSecond}:{})});recorder.current=instance;let bytes=0;const started=performance.now();
      instance.ondataavailable=event=>{if(event.data.size){chunks.push(event.data);bytes+=event.data.size;if(bytes>=RECORDING_LIMIT-256*1024&&instance.state==='recording')instance.stop();}};
      instance.onerror=()=>{if(token!==generation.current.value)return;generation.current.value++;release();setPhase('IDLE');setMessage('La grabación falló. No se envió ningún archivo; podés intentarlo de nuevo.');};
      instance.onstop=()=>{input.getTracks().forEach(track=>track.stop());if(recorder.current===instance){release();recorder.current=null;}if(!mounted.current||token!==generation.current.value)return;const mime=normalizedType(instance.mimeType||type),extension=mime.endsWith('mp4')?'mp4':mime.endsWith('ogg')?'ogg':'webm';setRecording(null);choose(new File(chunks,`campo-${kind}-${Date.now()}.${extension}`,{type:mime}));};
      instance.start(250);setPhase('RECORDING');setMessage('Grabando sólo en este dispositivo.');timer.current=setInterval(()=>{const seconds=Math.floor((performance.now()-started)/1000);setElapsed(seconds);if(seconds>=profile.seconds&&instance.state==='recording')instance.stop();},200);
    }catch(error){release();if(mounted.current&&token===generation.current.value){setPhase('IDLE');setRecording(null);setMessage(error.name==='NotAllowedError'?'No se otorgó permiso de cámara o micrófono. Podés habilitarlo y volver a intentar, o adjuntar un archivo.':'No se pudo iniciar la grabación. Probá otra vez o adjuntá un archivo compatible.');}}
  }
  const image=selection?.prepared.type.startsWith('image/'),audio=selection?.prepared.type.startsWith('audio/'),prepared=selection?.prepared;
  return <div className={styles.mediaCapture}>
    <p className={styles.mediaHelp}>Fotos JPG, PNG o WebP hasta 2 MiB. Audio OGG, WAV, MP3, M4A o WebM y video MP4 o WebM hasta 3 MiB. Las fotos grandes se preparan en este dispositivo; revisá la copia antes de usarla.</p>
    <div className={styles.captureChoices}>
      <label className={styles.captureInput}>Tomar foto<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={disabled||active} onChange={event=>{choose(event.target.files?.[0]);event.target.value='';}}/></label>
      <label className={styles.captureInput}>Adjuntar archivo<input type="file" accept={FIELD_MEDIA_TYPES.join(',')} disabled={disabled||active} onChange={event=>{choose(event.target.files?.[0]);event.target.value='';}}/></label>
      <button type="button" disabled={disabled||active} onClick={()=>record('audio')}>Grabar audio</button>
      <button type="button" disabled={disabled||active} onClick={()=>record('video')}>Grabar video</button>
    </div>
    <p className={styles.mediaHelp}>Audio: hasta 2 minutos, se solicita 64 kb/s. Video: hasta 40 segundos, se solicita 640 × 360 px y calidad reducida. El tamaño final se comprueba; estas opciones pueden variar según el navegador. Video: revisión humana.</p>
    <p role="status" aria-live="polite">{phase==='PREPARING'?'Preparando copia local. El original se conserva.':message}</p>
    {phase==='PREPARING'&&<button type="button" onClick={discard}>Cancelar preparación</button>}
    {['PERMISSION','RECORDING'].includes(phase)&&<div className={styles.recording}><strong>{phase==='PERMISSION'?'Esperando permiso':`Grabando ${recording==='audio'?'audio':'video'}: ${elapsed} / ${RECORDING_PROFILES[recording].seconds} segundos`}</strong>{recording==='video'&&phase==='RECORDING'&&<video ref={preview} autoPlay playsInline muted className={styles.mediaPlayer}/>}<div className={styles.actions}>{phase==='RECORDING'&&<button type="button" onClick={()=>recorder.current?.state==='recording'&&recorder.current.stop()}>Terminar y revisar</button>}<button type="button" onClick={discard}>Descartar grabación</button></div></div>}
    {selection&&<div className={styles.localReview}>
      <strong>{accepted?'Archivo elegido para guardar':'Revisá el archivo antes de elegirlo'}</strong>
      {image?<img src={selection.preparedUrl} alt="Vista previa local de la foto que se enviará" className={styles.mediaPlayer}/>:audio?<audio src={selection.preparedUrl} controls preload="metadata" className={styles.mediaPlayer}/>:<video src={selection.preparedUrl} controls playsInline preload="metadata" className={styles.mediaPlayer}/>}
      <p>{prepared?.name} · {size(prepared?.size||0)}{selection.details&&` · ${selection.details.width} × ${selection.details.height} px`}</p>
      {selection.prepared!==selection.original&&<p>Copia JPEG local de {size(selection.original.size)} a {size(prepared.size)}. {prepared.size<selection.original.size?`Reducción de ${Math.round((1-prepared.size/selection.original.size)*100)}%.`:'La copia ocupa más que el original.'} El fondo transparente pasa a blanco. <a href={selection.originalUrl} download={selection.original.name}>Conservar original</a></p>}
      <p>Revisá {image?'la orientación y el detalle':'la reproducción y que se entienda el registro'}. Sólo se enviará este archivo cuando guardes el formulario.</p>
      <div className={styles.actions}>{image&&<button type="button" disabled={disabled||active} onClick={rotate}>Girar foto 90°</button>}<button type="button" disabled={disabled||active||!selection.preparedUrl||accepted} onClick={()=>{setAccepted(true);callbacks.current.onChange?.(prepared);setMessage('Archivo elegido. Completá qué registra y guardá cuando esté listo.');}}>Usar este archivo</button><button type="button" disabled={disabled&&!active} onClick={discard}>Quitar archivo</button></div>
    </div>}
  </div>;
}
