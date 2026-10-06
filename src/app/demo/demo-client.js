'use client';
import {useState} from 'react';
import Link from 'next/link';
import {ObraSaasLogo} from '../brand/brand-logo';
import DemoExplorer from './demo-explorer';
import styles from './demo.module.css';
const VIEWS=[['worker','Operario','Preparar una captura'],['foreman','Encargado','Revisar lo recibido'],['director','Director','Ver el seguimiento']];
const CASES=[
 {id:'identity',label:'Identidad',symbol:'01',title:'Documentación pendiente de revisión',sample:'Ejemplo sin DNI, selfie ni datos personales.',detail:'Cargar imágenes no aprueba una identidad ni registra presentismo. En el piloto se necesita una revisión vinculada a la empresa y obra.',type:'Documentación de ejemplo'},
 {id:'photo',label:'Foto de obra',symbol:'02',title:'Evidencia de un avance',sample:'Ejemplo: avance de mampostería en el sector norte.',detail:'Una foto debe conservar su vínculo con la obra y el parte. El análisis es una sugerencia; no reemplaza la revisión del encargado.',type:'Evidencia de ejemplo'},
 {id:'audio',label:'Nota de voz',symbol:'03',title:'Un aviso para el encargado',sample:'Texto preparado para la demo: “Faltan dos bolsas de cemento para continuar el trabajo”.',detail:'En esta pantalla no se recibe ni transcribe audio. El circuito real debe confirmar recepción, transcripción y registro; la voz no identifica por sí sola al trabajador.',type:'Aviso de ejemplo'}
];
export default function DemoClient(){
 const [screen,setScreen]=useState('explore');
 const [view,setView]=useState('worker'),[selected,setSelected]=useState('identity'),[items,setItems]=useState([]);
 const scenario=CASES.find(item=>item.id===selected),pending=items.filter(item=>item.status==='PENDING').length;
 const reviewed=items.length-pending,alreadyAdded=items.some(item=>item.id===selected);
 function addExample(){setItems(current=>current.some(item=>item.id===selected)?current:[...current,{id:selected,type:scenario.type,title:scenario.title,status:'PENDING'}]);}
 function reviewExample(id){setItems(current=>current.map(item=>item.id===id?{...item,status:'REVIEWED_EXAMPLE'}:item));}
 return <div className={styles.shell} data-demo-only="true">
  <header className={styles.header}><Link href="/" aria-label="ObraSaaS, inicio"><ObraSaasLogo markSize={38} variant="inverse"/></Link><span className={styles.demoBadge}>DEMO</span><Link href="/sign-in" className={styles.account}>Ingresar a mi cuenta <span aria-hidden="true">↗</span></Link></header>
  {screen==='explore'?<DemoExplorer onTour={()=>{setSelected('identity');setView('worker');setScreen('tour');}}/>:<>
  <main className={styles.main}>
   <button type="button" className={styles.backToWorkspace} onClick={()=>setScreen('explore')}>← Explorar la empresa de ejemplo</button>
   <div className={styles.intro}><div><p className={styles.eyebrow}>DEMO GUIADA</p><h1>Del aviso en campo<br/>a la revisión en obra.</h1><p className={styles.lead}>Probá el recorrido desde tres perspectivas. Cada paso está identificado como un ejemplo, no como una operación confirmada.</p></div><span className={styles.pill}>Entorno ilustrativo</span></div>
   <aside className={styles.notice} aria-label="Alcance de la demo"><strong>Sólo ejemplos ficticios.</strong> No solicita DNI, fotos, audios ni datos de empleados. No envía WhatsApp, no crea cuentas y no modifica obras. La demo se reinicia al recargar.</aside>
   <nav className={styles.views} aria-label="Perspectiva de la demostración">{VIEWS.map(([id,title,subtitle])=><button key={id} type="button" aria-pressed={view===id} onClick={()=>setView(id)}><strong>{title}</strong><span>{subtitle}</span></button>)}</nav>
   <section className={styles.metrics} aria-label="Resumen de esta demostración"><div><span>Ejemplos preparados</span><strong data-demo-count="total">{items.length}</strong></div><div><span>Pendientes de revisar</span><strong data-demo-count="pending">{pending}</strong></div><div><span>Revisiones de ejemplo</span><strong data-demo-count="reviewed">{reviewed}</strong></div></section>
   {view==='worker'?<section className={styles.panel} aria-labelledby="worker-title"><div className={styles.panelHeader}><div><p className={styles.eyebrow}>PERSPECTIVA · OPERARIO</p><h2 id="worker-title">Preparar un ejemplo</h2></div><span className={styles.smallPill}>Sin captura real</span></div>
     <div className={styles.cases} aria-label="Tipos de ejemplo">{CASES.map(item=><button key={item.id} type="button" aria-pressed={selected===item.id} onClick={()=>setSelected(item.id)}>{item.label}</button>)}</div>
     <div className={styles.scenario}><span className={styles.step} aria-hidden="true">{scenario.symbol}</span><div><h3>{scenario.title}</h3><p className={styles.sample}>{scenario.sample}</p><p>{scenario.detail}</p></div></div>
     <div className={styles.actions}><button type="button" className={styles.primary} disabled={alreadyAdded} onClick={addExample}>{alreadyAdded?'Ejemplo añadido':'Añadir ejemplo a la bandeja'}</button><button type="button" className={styles.secondary} onClick={()=>setView('foreman')}>Ver como encargado →</button></div>
    </section>:view==='foreman'?<section className={styles.panel} aria-labelledby="foreman-title"><div className={styles.panelHeader}><div><p className={styles.eyebrow}>PERSPECTIVA · ENCARGADO</p><h2 id="foreman-title">Bandeja de ejemplos</h2></div><span className={styles.smallPill}>Revisión simulada</span></div>
     <p className={styles.help}>Esta acción sólo cambia el ejemplo de esta pantalla. No valida identidad, seguros, horas ni avances de una obra.</p>
     {!items.length?<div className={styles.empty}>Todavía no agregaste ejemplos. Volvé a la perspectiva de operario para preparar uno.</div>:<ul className={styles.items}>{items.map(item=><li key={item.id}><div><span className={styles.itemType}>{item.type}</span><h3>{item.title}</h3><span className={item.status==='PENDING'?styles.pending:styles.reviewed}>{item.status==='PENDING'?'Pendiente en demo':'Revisado en demo'}</span></div><button type="button" className={styles.secondary} disabled={item.status!=='PENDING'} onClick={()=>reviewExample(item.id)}>{item.status==='PENDING'?'Simular revisión':'Revisión de ejemplo realizada'}</button></li>)}</ul>}
     <div className={styles.actions}><button type="button" className={styles.secondary} onClick={()=>setView('director')}>Ver seguimiento como director →</button></div>
    </section>:<section className={styles.panel} aria-labelledby="director-title"><div className={styles.panelHeader}><div><p className={styles.eyebrow}>PERSPECTIVA · DIRECTOR</p><h2 id="director-title">Seguimiento del recorrido</h2></div><span className={styles.smallPill}>Sólo esta sesión</span></div>
     <p className={styles.help}>Los números provienen exclusivamente de los ejemplos que acabás de usar. No son indicadores productivos.</p>
     <div className={styles.summary}><strong>{reviewed} de {items.length} ejemplos revisados</strong><p>{pending?`${pending} ejemplos siguen pendientes en esta demo.`:'No quedan ejemplos pendientes en esta demo.'}</p><p>Un piloto real requiere cuentas verificadas, una obra definida, participantes autorizados y confirmación de cada operación.</p></div>
     <div className={styles.actions}><button type="button" className={styles.secondary} onClick={()=>setView('worker')}>Volver al recorrido</button><Link href="/sign-in" className={styles.primary}>Ir al acceso personal</Link></div>
    </section>}
   <div className={styles.bottom}><p role="status" aria-live="polite">{items.length} ejemplos locales · {reviewed} revisados · 0 operaciones reales</p><button type="button" className={styles.reset} onClick={()=>{setItems([]);setSelected('identity');setView('worker');}}>Reiniciar demo</button></div>
   <footer className={styles.footer}>Cambiar de perspectiva aquí no asigna un rol de usuario. El acceso a una empresa u obra se verifica por separado.</footer>
  </main>
  </>}
 </div>;
}
