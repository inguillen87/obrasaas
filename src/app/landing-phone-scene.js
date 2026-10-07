'use client';

import {useCallback,useEffect,useRef,useState,useSyncExternalStore} from 'react';
import Image from 'next/image';
import {useAnimate} from 'framer-motion/mini';
import styles from './landing-phone-scene.module.css';

const examples=[
 {id:'audio',label:'Audio',title:'Tu voz también deja evidencia.',kind:'audio',prompt:'Elegiste Mampostería · Sector A. Podés guardar tu audio en privado para revisión.',sent:'Terminamos el paño del sector A. Dejo el audio como evidencia.',reply:'Audio guardado en privado. El responsable debe revisarlo antes de aprobar avances.',record:'Evidencia con audio',detail:'Tarea y sector vinculados',status:'Pendiente de revisión'},
 {id:'photo',label:'Foto',title:'Una foto, en la tarea correcta.',kind:'photo',prompt:'Mampostería · Sector A. Enviá la foto de la tarea para que el responsable pueda revisarla.',sent:'Foto del paño terminado, para revisión.',reply:'Foto guardada con su referencia. La evidencia y el avance se revisan por separado.',record:'Evidencia de la tarea',detail:'Archivo privado · Sector A',status:'Pendiente de revisión'},
 {id:'location',label:'Ubicación',title:'El lugar también cuenta.',kind:'location',prompt:'Compartí tu ubicación para registrar la entrada en esta obra y sector.',sent:'Comparto mi ubicación actual para registrar la entrada.',reply:'Ubicación recibida · Sector A. Tu entrada queda pendiente de revisión del responsable.',record:'Entrada de jornada',detail:'Ubicación recibida · Sector A',status:'Pendiente de revisión'},
 {id:'journey',label:'Jornada',title:'Cada momento de la jornada.',kind:'journey',prompt:'Tu jornada está abierta. Podés registrar pausa, regreso y salida, en ese orden.',sent:'Registré la pausa y el regreso. Ahora confirmo la salida.',reply:'Salida registrada con su recibo. Consultá los fichajes y sus revisiones en Mi cuenta.',record:'Salida de jornada',detail:'Entrada · pausa · regreso · salida',status:'Consultar revisión'},
];
const subscribeMotion=notify=>{const query=window.matchMedia('(prefers-reduced-motion: reduce)');query.addEventListener('change',notify);return()=>query.removeEventListener('change',notify);};
const motionSnapshot=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const serverMotion=()=>false;

function Symbol({name}){
 const paths={audio:<><path d="M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0Z"/><path d="M6 11v1a6 6 0 0 0 12 0v-1M12 18v4m-4 0h8"/></>,photo:<><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8" cy="9" r="1.5"/><path d="m4 17 5-5 4 4 3-3 5 5"/></>,location:<><path d="M19 9c0 5-7 12-7 12S5 14 5 9a7 7 0 1 1 14 0Z"/><circle cx="12" cy="9" r="2"/></>,journey:<><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></>,receipt:<><path d="M6 3h12v18l-3-2-3 2-3-2-3 2Z"/><path d="m9 10 2 2 4-4m-6 8h6"/></>};
 return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function Attachment({kind}){
 if(kind==='audio')return <div className={styles.voice}><Symbol name="audio"/><div className={styles.wave} data-audio-wave aria-hidden="true">{[8,18,12,25,32,17,23,10,28,35,20,12,24,16,8].map((height,index)=><i key={index} style={{height}}/>)}</div><span>0:12</span><small>Audio ilustrativo · sin sonido</small></div>;
 if(kind==='photo')return <figure className={styles.photo}><Image src="/media/launch/obra-registro-evidencia.webp" width={941} height={1672} sizes="220px" loading="lazy" unoptimized alt="Foto ilustrativa de seguimiento de una obra"/><figcaption>Ejemplo ilustrativo · Sector A</figcaption></figure>;
 if(kind==='location')return <div className={styles.map}><div className={styles.mapDrawing} aria-hidden="true"><span/><i/><b><Symbol name="location"/></b></div><strong>Ubicación compartida</strong><small>Sector A · ejemplo ilustrativo</small></div>;
 return <div className={styles.journey}>{['Entrada','Pausa','Regreso','Salida'].map((label,index)=><span key={label}><i aria-hidden="true">{index+1}</i>{label}</span>)}</div>;
}

export function LandingPhoneScene(){
 const [selected,setSelected]=useState(3),[device,setDevice]=useState('iphone'),[step,setStep]=useState(1),[playing,setPlaying]=useState(false),[inView,setInView]=useState(false);
 const [root,animate]=useAnimate(),controls=useRef([]),lastEntrance=useRef(''),visible=useRef(false),started=useRef(false),reduced=useSyncExternalStore(subscribeMotion,motionSnapshot,serverMotion),example=examples[selected];
 const shown=reduced?3:step;
 // Cancelling the scoped WAAPI animations restores the fully readable CSS state.
 // The sequence clock and its visual entrances stop together on every pause path.
 const stopMotion=useCallback(()=>{for(const control of controls.current)control.cancel();controls.current=[];},[]);
 useEffect(()=>{
  const pause=()=>{stopMotion();setPlaying(false);};
  const observer=new IntersectionObserver(entries=>{const current=entries[0].isIntersecting&&entries[0].intersectionRatio>=.35;visible.current=current;setInView(current);if(!current)pause();else if(!started.current){started.current=true;if(!document.hidden&&!motionSnapshot())setPlaying(true);}},{threshold:[0,.35]});
  observer.observe(root.current);
  const visibility=()=>{if(document.hidden)pause();};
  const preference=window.matchMedia('(prefers-reduced-motion: reduce)'),motionChange=()=>{if(preference.matches){pause();setStep(3);}};
  if(preference.matches)motionChange();
  document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',pause);
  preference.addEventListener('change',motionChange);
  return()=>{visible.current=false;stopMotion();observer.disconnect();document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',pause);preference.removeEventListener('change',motionChange);};
 },[root,stopMotion]);
 useEffect(()=>{
  const entrance=example.id+':'+shown;
  if(!inView||document.hidden)return;
  if(lastEntrance.current===entrance)return;
  lastEntrance.current=entrance;stopMotion();
  const chat=root.current.querySelector('[data-phone-chat]');
  chat.scrollTop=shown===1?0:chat.scrollHeight;
  // Consult the live preference too: hydration first renders the server snapshot.
  if(reduced||motionSnapshot())return;
  const bubble=root.current.querySelector('[data-message-step="'+shown+'"]');
  if(bubble)controls.current.push(animate(bubble,{opacity:[.45,1],transform:['translateY(13px) scale(.98)','translateY(0px) scale(1)']},{duration:.48,ease:[.22,1,.36,1]}));
  if(shown===1)controls.current.push(animate('[data-phone-draft]',{opacity:[.6,1],transform:['translateY(9px)','translateY(0px)']},{duration:.55,delay:.12,ease:[.22,1,.36,1]}));
  if(shown===2&&example.kind==='audio')controls.current.push(animate('[data-audio-wave] i',{opacity:[.45,1,.7,1],transform:['scaleY(.55)','scaleY(1)','scaleY(.7)','scaleY(1)']},{duration:.8,ease:'easeInOut'}));
  if(shown===3)controls.current.push(animate('[data-phone-receipt]',{opacity:[0,1],transform:['translateY(18px) scale(.97)','translateY(0px) scale(1)']},{duration:.65,delay:.12,ease:[.22,1,.36,1]}));
 },[animate,root,example.id,example.kind,shown,inView,reduced,stopMotion]);
 useEffect(()=>{
  if(!playing||!inView||reduced||step>=3)return;
  const timer=setTimeout(function advanceLandingScene(){if(document.hidden||!visible.current)return;const next=step+1;setStep(next);if(next===3)setPlaying(false);},step===1?1700:2100);
  return()=>clearTimeout(timer);
 },[playing,inView,reduced,step,selected]);
 function choose(index){stopMotion();setPlaying(false);lastEntrance.current='';setSelected(index);setStep(reduced?3:1);}
 function play(){if(playing){stopMotion();setPlaying(false);return;}if(reduced||!inView||document.hidden)return;if(step>=3)setStep(1);setPlaying(true);}
 function next(){stopMotion();setPlaying(false);setStep(value=>Math.min(3,value+1));}
 const running=playing&&inView&&!reduced&&step<3;
 return <section ref={root} className={styles.scene} aria-label="Ejemplo de WhatsApp en obra" data-landing-example="phone" data-phone-scene={example.id} data-phone-device={device} data-phone-step={shown} data-phone-playing={running?'true':'false'} data-phone-in-view={inView?'true':'false'}>
  <div className={styles.topline}><span>Ejemplo ilustrativo</span></div>
  <div className={styles.stage}>
   <div className={styles.halo} aria-hidden="true"/>
   <div className={styles.deviceChoice} aria-label="Apariencia del teléfono">{[['iphone','iPhone'],['android','Android']].map(([value,label])=><button key={value} type="button" aria-pressed={device===value} onClick={()=>setDevice(value)}>{label}</button>)}</div>
   <div className={styles.phone+' '+(device==='android'?styles.android:styles.iphone)}>
    <div className={styles.phoneTop} aria-hidden="true"><span>9:41</span><i/><span>▰</span></div>
    <div className={styles.chatHeader}><span className={styles.avatar}>O</span><div><strong>ObraSaaS</strong><span>Torre Palermo Soho · ejemplo</span></div><Symbol name={example.kind}/></div>
    <div className={styles.chat} data-phone-chat key={example.id} tabIndex={0} role="region" aria-label="Conversación ilustrativa, desplazable">
     <span className={styles.day}>CONVERSACIÓN DE EJEMPLO</span>
     <div className={styles.context}><Symbol name={example.kind}/><span><strong>{example.kind==='journey'||example.kind==='location'?'Jornada de obra':'Mampostería'}</strong>Sector A · Torre Palermo Soho</span></div>
     <div className={styles.received} data-message-step="1"><small>OBRASAAS · 09:41</small><p>{example.prompt}</p></div>
     {shown===1&&<div className={styles.draft} data-phone-draft><small>LISTO PARA COMPARTIR</small><Attachment kind={example.kind}/><p>{example.sent}</p></div>}
     {shown>=2&&<div className={styles.sent} data-message-step="2"><Attachment kind={example.kind}/><p>{example.sent}</p><small>Participante · 09:42</small></div>}
     {shown>=3&&<div className={styles.received} data-message-step="3"><p>{example.reply}</p><span className={styles.reference}>Registro OB-024 · 09:42</span></div>}
     {shown<3&&<div className={styles.waiting}><span aria-hidden="true">•••</span><span>{running?'El recorrido continúa…':'Reproducí o avanzá para ver el recorrido.'}</span></div>}
    </div>
    <div className={styles.phoneFoot}><span aria-hidden="true">+</span><span>Demostración sin envío</span><Symbol name="audio"/></div>
   </div>
   <div className={styles.officeSlot}>{shown>=3?<aside className={styles.record} data-phone-receipt aria-label="Ejemplo de registro para la oficina"><div className={styles.recordTop}><Symbol name="receipt"/><span>EN MI CUENTA</span><i aria-hidden="true"/></div><strong>{example.record}</strong><p>{example.detail}</p><span className={styles.status}>{example.status}</span><small>Registro OB-024 · 09:42</small></aside>:<div className={styles.recordPreview}><Symbol name="receipt"/><strong>Del mensaje al registro.</strong><span>El recorrido termina con un recibo para consultar y revisar.</span><small>Paso {shown} de 3</small></div>}</div>
  </div>
  <div className={styles.caption}><h3>{example.title}</h3><p>El equipo registra. El responsable revisa.</p></div>
  <div className={styles.scenarios} aria-label="Elegir ejemplo de conversación">{examples.map((item,index)=><button type="button" key={item.id} aria-pressed={index===selected} onClick={()=>choose(index)}><Symbol name={item.kind}/><span>{item.label}</span></button>)}</div>
  <div className={styles.playback}><button type="button" onClick={play} disabled={reduced} aria-label={running?'Pausar conversación ilustrativa':shown===3?'Reproducir nuevamente la conversación ilustrativa':'Reproducir conversación ilustrativa'}><span aria-hidden="true">{running?'Ⅱ':'▷'}</span>{reduced?'Movimiento reducido':running?'Pausar':shown===3?'Repetir':'Reproducir'}</button><button type="button" onClick={next} disabled={shown===3}>Siguiente paso <span aria-hidden="true">→</span></button><span>{shown}/3</span></div>
  <details className={styles.transcript}><summary>Leer el ejemplo completo</summary><ol><li>{example.prompt}</li><li>{example.sent}</li><li>{example.reply}</li></ol><p>Vista ilustrativa para iPhone y Android, con horarios y referencia ficticios. No envía mensajes, no reproduce audio ni solicita tu ubicación.{example.kind==='location'?' Una ubicación compartida por WhatsApp no informa precisión GPS ni lectura de QR: el fichaje requiere revisión.':''}</p></details>
 </section>;
}
