'use client';
/* eslint-disable @next/next/no-img-element -- Authorized object URLs must remain local to the browser. */
import {useEffect,useRef,useState} from 'react';
import styles from './field-operations-panel.module.css';
function FieldMediaPreviewInner({projectId,scope,evidence,disabled}) {
  const [url,setUrl]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const current=useRef(null),request=useRef(null),generation=useRef({value:0});
  function close(){generation.current.value++;request.current?.abort();request.current=null;if(current.current)URL.revokeObjectURL(current.current);current.current=null;setUrl(null);setBusy(false);}
  useEffect(()=>{const counter=generation.current;return()=>{counter.value++;request.current?.abort();if(current.current)URL.revokeObjectURL(current.current);current.current=null;};},[]);
  async function open(){if(busy||disabled)return;close();const token=generation.current.value,controller=new AbortController();request.current=controller;setBusy(true);setError('');const timeout=setTimeout(()=>controller.abort(),20000);
    try {const response=await fetch('/api/identity/field-media?'+new URLSearchParams({projectId,scope,evidenceId:evidence.id}),{credentials:'same-origin',cache:'no-store',signal:controller.signal});if(!response.ok)throw new Error(response.status===403||response.status===404?'El archivo privado ya no está disponible para esta cuenta. Actualizá la obra.':'No se pudo leer el archivo privado. Podés volver a intentarlo.');const blob=await response.blob();if(blob.size!==evidence.media.bytes||blob.size>3*1024*1024||blob.type.split(';')[0]!==evidence.media.contentType.split(';')[0])throw new Error('El archivo no coincide con la versión de este listado. Actualizá antes de revisarlo.');if(token!==generation.current.value)return;current.current=URL.createObjectURL(blob);setUrl(current.current);
    }catch(failure){if(token===generation.current.value)setError(failure.name==='AbortError'?'La lectura privada no se completó. Podés volver a intentarlo.':failure.message);}finally{clearTimeout(timeout);if(token===generation.current.value)setBusy(false);}
  }
  return <div className={styles.privatePreview}>{!url?<button type="button" disabled={disabled||busy} onClick={open}>{busy?'Leyendo archivo privado…':error?'Reintentar reproducción privada':'Ver archivo privado'}</button>:<><p>Archivo obtenido con autorización de esta obra. Revisá el contenido antes de decidir.</p>{evidence.media.kind==='image'?<img src={url} alt={evidence.caption||evidence.title} className={styles.mediaPlayer}/>:evidence.media.kind==='audio'?<audio src={url} controls preload="metadata" className={styles.mediaPlayer}/>:<video src={url} controls playsInline preload="metadata" className={styles.mediaPlayer}/>}<button type="button" onClick={close}>Cerrar reproducción</button></>}{error&&<p role="alert">{error}</p>}</div>;
}

export function FieldMediaPreview(props){return <FieldMediaPreviewInner key={[props.projectId,props.scope,props.evidence.id,props.evidence.revision].join(':')} {...props}/>;}
