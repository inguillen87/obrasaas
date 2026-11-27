'use client';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createWorksiteLiveRefreshController,worksiteLiveRefreshPresentation,worksiteLiveCheckedAtLabel} from './workspace-live-refresh-controller.mjs';

// Existing authenticated GETs; canonical authority and data commits use separate fences.
// canonicalRead: reserve initial live spacing for this canonical context. The controller seeds
// it only when the context becomes eligible; request/loading time is not a fresh live observation.
export function useWorksiteLiveRefresh({contextKey,viewKey='',enabled,blocked,read,apply,isCurrent,isAuthorityCurrent,getAuthorityStamp,onAccessRejected,canonicalRead=false}){
 const latest=useRef(null),control=useRef(null),[status,setStatus]=useState({state:'IDLE',checkedAt:null,updates:false});
 useLayoutEffect(()=>{latest.current={contextKey,viewKey,enabled,blocked,read,apply,isCurrent,isAuthorityCurrent,getAuthorityStamp,onAccessRejected,canonicalRead};},[contextKey,viewKey,enabled,blocked,read,apply,isCurrent,isAuthorityCurrent,getAuthorityStamp,onAccessRejected,canonicalRead]);
 useEffect(()=>{
  const controller=createWorksiteLiveRefreshController({contextKey,getCurrent:()=>latest.current,onState:setStatus,isVisible:()=>document.visibilityState==='visible',isOnline:()=>navigator.onLine!==false,observedAt:latest.current?.canonicalRead===true?Date.now():null});
  control.current=controller;controller.start();
  const changed=()=>controller.environmentChanged();
  window.addEventListener('online',changed);window.addEventListener('offline',changed);window.addEventListener('focus',changed);document.addEventListener('visibilitychange',changed);
  return()=>{controller.dispose();if(control.current===controller)control.current=null;window.removeEventListener('online',changed);window.removeEventListener('offline',changed);window.removeEventListener('focus',changed);document.removeEventListener('visibilitychange',changed);};
 },[contextKey]);
 useEffect(()=>{if(blocked||!enabled){control.current?.pause();return;}void control.current?.check();},[blocked,enabled,viewKey]);
 const currentStatus=worksiteLiveRefreshPresentation(status,{contextKey,viewKey,enabled});
 return {status:currentStatus,check:()=>{void control.current?.check({manual:true});}};
}
export function WorksiteLiveRefreshStatus({refresh,paused=false,label='Consulta',manualLabel,manual}){
 const {status}=refresh;if(status.state==='IDLE')return null;
 const text=status.state==='ACCESS'?status.message:
 paused?'La actualización automática está en pausa mientras terminás lo preparado.':
 status.state==='CONSULTING'?'Comprobando cambios de esta obra…':
 status.state==='OFFLINE'?'Sin conexión. Conservamos la consulta; se comprobará al volver a estar en línea.':
 status.state==='HIDDEN'?'La consulta automática está en pausa mientras esta pestaña no está visible.':
 ['STALE','LIMITED'].includes(status.state)?status.message:
 status.updates?status.message||'Hay registros nuevos para consultar. Las páginas abiertas siguen conservadas.':
 status.checkedAt!==null&&status.checkedAt!==undefined?label+' · última comprobación: '+worksiteLiveCheckedAtLabel(status.checkedAt)+'.':'Se comprobarán los cambios de esta obra cuando no haya una operación en curso.';
 return <div data-worksite-live-refresh={status.state==='ACCESS'?'ACCESS':paused?'PAUSED':status.state}><p role="status">{text}</p>{!paused&&status.state!=='CONSULTING'&&status.state!=='ACCESS'&&<button type="button" onClick={refresh.check}>Comprobar cambios</button>}{!paused&&status.updates&&manual&&<button type="button" onClick={manual}>{manualLabel||'Consultar registros nuevos'}</button>}</div>;
}
