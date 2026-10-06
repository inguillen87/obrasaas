'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {LazyMotion,domAnimation,m,useAnimationControls,useInView,useReducedMotion} from 'framer-motion';
import styles from './page.module.css';

export function LandingMenu(){
 const menu=useRef(null);
 function close(){if(menu.current)menu.current.open=false;}
 function keyboard(event){if(event.key==='Escape'&&menu.current?.open){event.preventDefault();close();menu.current.querySelector('summary')?.focus();}}
 return <details ref={menu} className={styles.mobileMenu} onKeyDown={keyboard}><summary aria-label="Menú de navegación"><span>Menú</span><svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 6h14M3 13h14" stroke="currentColor" strokeWidth="1.5"/></svg></summary><nav aria-label="Navegación móvil"><a href="#plataforma" onClick={close}>La plataforma</a><a href="#whatsapp" onClick={close}>WhatsApp en obra</a><Link href="/manual" onClick={close}>Cómo empezar</Link><Link href="/demo" onClick={close}>Demo con ejemplos</Link><Link href="/sign-up" onClick={close}>Crear mi cuenta</Link></nav></details>;
}

export function LandingMotion({children,className,kind='settle'}){
 const reduced=useReducedMotion(),controls=useAnimationControls(),element=useRef(null),started=useRef(false),[finished,setFinished]=useState(false);
 const seen=useInView(element,{once:true,amount:.55}),trigger=kind==='receipt'?seen:true;
 useEffect(()=>{
  if(reduced===true){controls.stop();controls.set({opacity:1,x:0,y:0});return;}
  if(reduced!==false||!trigger||started.current)return;
  started.current=true;
  if(kind==='receipt'||kind==='brand'){
   controls.set({opacity:.9,x:18});
   void controls.start({opacity:1,x:0,transition:{duration:.42,ease:[.22,1,.36,1]}});
  }else void controls.start({opacity:[1,.96,1],y:[0,6,0],transition:{duration:.65,ease:[.22,1,.36,1]}});
 },[reduced,controls,trigger,kind]);
 useEffect(()=>()=>controls.stop(),[controls]);
 return <LazyMotion features={domAnimation} strict><m.div ref={element} className={className} initial={false} animate={controls} onAnimationComplete={()=>setFinished(true)} data-landing-motion="assisted" data-landing-transition={kind} data-landing-transition-state={finished?'finished':'idle'}>{children}</m.div></LazyMotion>;
}

const showcaseImages=[
 {src:'/media/launch/obra-vista-amplia.webp',title:'Tu equipo, en obra',alt:'Imagen ilustrativa de una obra en construcción'},
 {src:'/media/launch/obra-registro-evidencia.webp',title:'Cada parte, con evidencia',alt:'Imagen ilustrativa de registro y seguimiento en una obra'},
 {src:'/media/launch/obra-entrega-materiales.webp',title:'Materiales y seguimiento',alt:'Imagen ilustrativa de materiales para la obra'},
];
export function LandingShowcase(){
 const [selected,setSelected]=useState(0),reduced=useReducedMotion(),current=showcaseImages[selected];
 return <div className={styles.showcase} data-landing-example="worksite"><div className={styles.showcaseTop}><span>DEL CAMPO A TU EMPRESA</span><span className={styles.exampleLabel}>Ejemplo ilustrativo</span></div><LazyMotion features={domAnimation} strict><m.figure key={current.src} initial={false} animate={reduced?{opacity:1}:{opacity:[.84,1]}} transition={{duration:.28}} className={styles.showcaseImage}><Image src={current.src} alt={current.alt} width={941} height={1672} unoptimized loading={selected===0?'eager':'lazy'} sizes="(max-width: 620px) 100vw, 48vw"/><figcaption><span>OBRASAAS</span><strong>{current.title}</strong></figcaption></m.figure></LazyMotion><div className={styles.showcaseControls} aria-label="Imágenes de presentación">{showcaseImages.map((item,index)=><button key={item.src} type="button" aria-pressed={selected===index} aria-label={item.title} onClick={()=>setSelected(index)}><span aria-hidden="true">0{index+1}</span><span>{item.title}</span></button>)}</div><LandingMotion kind="receipt"><Link href="/demo" className={styles.showcaseLink}><span>Explorá <strong>Torre Palermo Soho</strong><small>Empresa y obra de ejemplo</small></span><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M6 18 18 6M6 6h12v12" stroke="currentColor" strokeWidth="1.5"/></svg></Link></LandingMotion></div>;
}
export function LandingVideo(){
 const video=useRef(null),attempt=useRef(0),[started,setStarted]=useState(false),[error,setError]=useState('');
 function release(){attempt.current+=1;if(video.current){video.current.pause();video.current.removeAttribute('src');video.current.load();}setStarted(false);}
 function close(){release();setError('');}
 function failed(){if(!video.current?.getAttribute('src'))return;release();setError('No pudimos reproducir el video. Podés volver a intentarlo o explorar la empresa de ejemplo.');}
 function play(){
  if(!video.current)return;
  const current=++attempt.current;setStarted(true);setError('');video.current.src='/media/launch/obrasaas-15s.mp4';
  void video.current.play().catch(()=>{if(attempt.current===current){release();setError('No pudimos iniciar el video. Volvé a intentarlo cuando quieras.');}});
 }
 useEffect(()=>{
  const player=video.current,pause=()=>player?.pause(),visibility=()=>{if(document.hidden)pause();};
  document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',pause);
  return()=>{attempt.current+=1;document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',pause);pause();};
 },[]);
 return <figure className={styles.launchVideo} data-landing-video><div className={styles.videoFrame}><video ref={video} controls={started} preload="none" playsInline onError={failed} poster="/media/launch/obrasaas-15s-poster.webp" aria-describedby="launch-video-caption"><track src="/media/launch/obrasaas-15s-es-AR.vtt" kind="captions" srcLang="es-AR" label="Español argentino"/>Tu navegador no puede reproducir este video.</video>{!started&&<button type="button" onClick={play} className={styles.videoPlay} aria-label="Reproducir presentación de ObraSaaS, 15 segundos"><svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="m8 5 11 7-11 7V5Z"/></svg><span>Ver presentación<small>15 segundos</small></span></button>}</div>{started&&<button type="button" className={styles.videoClose} onClick={close}>Cerrar video</button>}<figcaption id="launch-video-caption">Presentación ilustrativa · Voz sintética argentina.</figcaption>{error&&<p role="status">{error} <Link href="/demo">Explorar la demo</Link></p>}</figure>;
}
