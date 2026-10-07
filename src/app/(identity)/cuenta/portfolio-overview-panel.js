'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {ArrowUpRight,Layers3,LoaderCircle,RefreshCw} from 'lucide-react';
import {useWorkspaceRequest} from './workspace-request-lifecycle';
import {portfolioDateLabel,portfolioOverviewMatches,mergePortfolioPages} from './portfolio-overview-view.mjs';
import styles from './portfolio-overview-panel.module.css';

export function PortfolioOverviewPanel(props) {
  return <PortfolioOverviewContent key={`${props.scope}:${props.role}`} {...props}/>;
}
function PortfolioOverviewContent({scope,role,getSessionToken,onOpenProject,onAccessRejected,locked=false}) {
  const request=useWorkspaceRequest(getSessionToken);
  const [expanded,setExpanded]=useState(false),[snapshot,setSnapshot]=useState(null),[loading,setLoading]=useState(false),[notice,setNotice]=useState('');
  const mounted=useRef(false),generation=useRef(0),controller=useRef(null),latest=useRef(null);
  useEffect(()=>{const epoch=generation;mounted.current=true;return()=>{mounted.current=false;epoch.current++;controller.current?.abort();};},[]);
  const consult=useCallback(async(append=false)=>{
    if(locked||loading)return;
    controller.current?.abort();const abort=new AbortController();controller.current=abort;
    const current=++generation.current,prior=latest.current,cursor=append?prior?.nextCursor:null;
    if(append&&!cursor)return;
    setExpanded(true);setSnapshot(null);setNotice('');setLoading(true);
    try{
      const params=new URLSearchParams({portfolio:'1',scope,...(cursor?{afterProject:cursor}:{})});
      const value=await request('/api/identity/workspace?'+params,{signal:abort.signal},async response=>{
        // A proxy or expired session can return HTML. The HTTP denial still
        // invalidates account context even when there is no JSON body to parse.
        if(!response.ok){const error=new Error([401,403].includes(response.status)?'Tu acceso cambió. Volvé a consultar las obras desde tu cuenta.':response.status===409?'Cambió el contexto de consulta. Actualizá las obras antes de continuar.':'No se pudo consultar el resumen. Podés volver a intentarlo.');error.status=response.status;throw error;}
        try{return await response.json();}catch{throw new Error('La respuesta del resumen no pudo leerse. Volvé a consultar las obras.');}
      });
      if(!mounted.current||current!==generation.current)return;
      if(!portfolioOverviewMatches(value,{scope,role}))throw new Error('La respuesta no coincide con tu organización y permisos. Volvé a consultar las obras.');
      const result={...value,projects:mergePortfolioPages(prior,value,cursor)};
      latest.current=result;setSnapshot(result);
    }catch(error){
      if(error.name!=='AbortError'&&mounted.current&&current===generation.current){latest.current=null;setSnapshot(null);setNotice(error.message);if([401,403,409].includes(error.status))onAccessRejected?.();}
    }finally{if(mounted.current&&current===generation.current)setLoading(false);}
  },[locked,loading,request,scope,role,onAccessRejected]);
  return <section className={styles.panel} aria-labelledby="portfolio-overview-title" aria-busy={loading}>
    <div className={styles.heading}><div><h3 id="portfolio-overview-title"><Layers3 size={19} aria-hidden="true"/>Resumen de obras</h3><p>Revisá la planificación y los bloqueos de las obras disponibles para tu cuenta.</p></div><button type="button" disabled={locked||loading} onClick={()=>consult()}><RefreshCw size={16} aria-hidden="true"/>{expanded?'Actualizar resumen':'Consultar resumen'}</button></div>
    {expanded&&<div className={styles.body}>
      <div role="status" aria-live="polite">{notice&&<p className={styles.notice}>{notice}</p>}{loading&&<p className={styles.loading}><LoaderCircle size={17} aria-hidden="true"/>Consultando obras autorizadas…</p>}</div>
      {snapshot&&<><p className={styles.caption}>{snapshot.projects.length} {snapshot.projects.length===1?'obra consultada':'obras consultadas'}{snapshot.nextCursor?' · Hay más obras para consultar':''}. Estado de las tareas al consultar.</p>
        {!snapshot.projects.length&&<p>No hay obras activas disponibles con tus permisos actuales.</p>}
        <div className={styles.grid}>{snapshot.projects.map(project=><article className={styles.card} key={project.id}>
          <h4>{project.name}</h4>
          <dl><div><dt>Tareas completadas</dt><dd>{project.completedTasks} de {project.totalTasks}</dd></div><div><dt>En ejecución</dt><dd>{project.inProgressTasks}</dd></div><div className={project.blockedTasks?styles.attention:undefined}><dt>Bloqueadas</dt><dd>{project.blockedTasks}</dd></div><div className={project.unscheduledTasks?styles.attention:undefined}><dt>Por planificar</dt><dd>{project.unscheduledTasks}</dd></div></dl>
          <p className={styles.date}>Próximo fin previsto<strong>{portfolioDateLabel(project.nextEndsOn)}</strong></p>
          <button type="button" disabled={locked||loading} onClick={()=>onOpenProject?.(project.id)}>Abrir {project.name}<ArrowUpRight size={16} aria-hidden="true"/></button>
        </article>)}</div>
        {snapshot.nextCursor&&<button className={styles.more} type="button" disabled={locked||loading} onClick={()=>consult(true)}>Consultar más obras</button>}
      </>}
    </div>}
  </section>;
}
