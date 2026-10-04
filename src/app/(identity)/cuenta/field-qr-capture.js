'use client';

import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createFieldQrReader,parseFieldQr} from './field-qr-reader.mjs';
import styles from './field-operations-panel.module.css';

const SCAN_TIMEOUT_MS=30000;
const stopStream=stream=>stream?.getTracks().forEach(track=>track.stop());

function releaseCapture(run){
  if(!run)return;
  clearTimeout(run.timeout);
  run.controller.abort();
  run.reader?.dispose();
  stopStream(run.stream);
  if(run.stream&&run.video?.srcObject===run.stream){
    run.video.pause();
    run.video.srcObject=null;
  }
  run.stream=null;
}

// Camera frames stay in the device. Only a validated sector QR is returned to
// the existing attendance draft; reading never submits an operation.
function FieldQrCaptureInner({projectId,sectorId,sectorName,disabled=false,onRead,onBusyChange}){
  const [phase,setPhase]=useState('IDLE'),[message,setMessage]=useState('');
  const preview=useRef(null),active=useRef(null),mounted=useRef(false);
  const callbacks=useRef({onRead,onBusyChange});
  useLayoutEffect(()=>{callbacks.current={onRead,onBusyChange};},[onRead,onBusyChange]);
  useLayoutEffect(()=>{
    mounted.current=true;
    return()=>{
      mounted.current=false;
      const run=active.current;
      active.current=null;
      releaseCapture(run);
      callbacks.current.onBusyChange?.(false);
    };
  },[]);

  function finish(run,notice){
    const current=active.current===run;
    if(current)active.current=null;
    releaseCapture(run);
    if(current&&mounted.current){
      setPhase('IDLE');
      setMessage(notice);
      callbacks.current.onBusyChange?.(false);
    }
  }
  function cancel(notice='Lectura detenida. No se registró ningún fichaje. Podés volver a intentar.'){
    const run=active.current;
    if(run)finish(run,notice);
  }
  useEffect(()=>{
    const stop=()=>{
      const run=active.current;
      if(!run)return;
      active.current=null;
      releaseCapture(run);
      if(mounted.current){
        setPhase('IDLE');
        setMessage('Lectura detenida al salir de esta pantalla. Volvé a iniciarla cuando estés listo.');
        callbacks.current.onBusyChange?.(false);
      }
    };
    const visibility=()=>{if(document.hidden)stop();};
    document.addEventListener('visibilitychange',visibility);
    window.addEventListener('pagehide',stop);
    return()=>{document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',stop);};
  },[]);

  async function scan(){
    if(disabled||active.current)return;
    if(!navigator.mediaDevices?.getUserMedia){
      setMessage('Este navegador no permite usar la cámara. Podés pegar el contenido del QR leído con otra aplicación.');
      return;
    }
    const run={controller:new AbortController(),video:preview.current,stream:null,reader:null,timeout:null};
    const current=()=>mounted.current&&active.current===run&&!run.controller.signal.aborted;
    active.current=run;
    setPhase('PERMISSION');
    setMessage('Esperando permiso de cámara. Podés detener la lectura sin perder el formulario.');
    callbacks.current.onBusyChange?.(true);
    run.timeout=setTimeout(()=>{
      if(current())finish(run,'No se leyó un QR en 30 segundos. Podés intentar otra vez o pegar su contenido.');
    },SCAN_TIMEOUT_MS);
    try{
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:640,max:1280},height:{ideal:480,max:960}},audio:false});
      if(!current()){stopStream(stream);return;}
      run.stream=stream;
      run.video.srcObject=stream;
      run.reader=createFieldQrReader({signal:run.controller.signal});
      await run.video.play();
      if(!current())return;
      setPhase('SCANNING');
      setMessage('Acercá el QR del sector a la cámara, con buena luz y sin reflejos.');
      while(current()){
        const raw=await run.reader.read(run.video);
        if(!current())return;
        if(raw!==null){
          const validated=parseFieldQr(raw,{projectId,sectorId});
          finish(run,'QR leído para el sector elegido. Revisalo antes de guardar el fichaje.');
          callbacks.current.onRead?.(validated);
          return;
        }
        await new Promise(resolve=>setTimeout(resolve,250));
      }
    }catch(error){
      if(current())finish(run,error.code==='FIELD_QR_INVALID'
        ?'Este QR no corresponde a la obra y al sector elegidos, o no tiene un formato válido. Revisá el sector y volvé a leerlo.'
        :error.name==='NotAllowedError'
          ?'No se otorgó permiso de cámara. Podés habilitarlo y volver a intentar, o pegar el contenido del QR.'
          :'No se pudo leer el QR. Revisá el permiso y la iluminación, o pegá su contenido.');
    }finally{
      // An older permission/detection promise cannot close a newer capture or
      // unlock a different request. Its own tracks are still always released.
      if(active.current===run&&mounted.current)finish(run,'No se pudo completar la lectura. Podés volver a intentarlo.');
      else releaseCapture(run);
    }
  }

  return <div className={styles.qrCapture}>
    <p>Leer QR de <strong>{sectorName||'este sector'}</strong></p>
    <p className={styles.qrHelp}>La cámara se usa sólo para leer el código en este dispositivo. La imagen no se guarda ni se envía.</p>
    <div className={styles.qrActions}>
      <button type="button" disabled={disabled||phase!=='IDLE'} onClick={scan}>Leer QR con cámara</button>
      {phase!=='IDLE'&&<button type="button" onClick={()=>cancel()}>Detener lectura QR</button>}
    </div>
    <div className={styles.qrFrame} hidden={phase!=='SCANNING'}>
      <video ref={preview} playsInline muted aria-label="Cámara para leer el QR del sector"/>
      <span aria-hidden="true" className={styles.qrAim}/>
    </div>
    {message&&<p className={styles.qrStatus} role="status" aria-live="polite">{message}</p>}
  </div>;
}

// A changed sector or withdrawn availability owns a fresh capture. React
// unmounts the previous owner before any permission or read can be adopted.
export function FieldQrCapture(props){
  return <FieldQrCaptureInner key={props.projectId+':'+props.sectorId+':'+Boolean(props.disabled)} {...props}/>;
}
