'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
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
  if(kind==='receipt'){
   controls.set({opacity:.9,x:18});
   void controls.start({opacity:1,x:0,transition:{duration:.42,ease:[.22,1,.36,1]}});
  }else void controls.start({opacity:[1,.96,1],y:[0,6,0],transition:{duration:.65,ease:[.22,1,.36,1]}});
 },[reduced,controls,trigger,kind]);
 useEffect(()=>()=>controls.stop(),[controls]);
 return <LazyMotion features={domAnimation} strict><m.div ref={element} className={className} initial={false} animate={controls} onAnimationComplete={()=>setFinished(true)} data-landing-motion="assisted" data-landing-transition={kind} data-landing-transition-state={finished?'finished':'idle'}>{children}</m.div></LazyMotion>;
}
