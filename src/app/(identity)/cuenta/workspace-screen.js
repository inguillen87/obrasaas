'use client';
import {useLayoutEffect,useSyncExternalStore} from 'react';
import {workspaceLocationView,workspaceViewAllowed} from './workspace-view-routing.mjs';

function subscribe(callback){window.addEventListener('hashchange',callback);window.addEventListener('popstate',callback);return()=>{window.removeEventListener('hashchange',callback);window.removeEventListener('popstate',callback);};}
const snapshot=()=>window.location.search+window.location.hash;
const serverSnapshot=()=>'';
export function revealWorkspaceDestination(id){
 if(typeof window==='undefined')return;
 const next=new URL(window.location.href);next.hash=id;
 if(next.hash===window.location.hash){document.getElementById(id)?.scrollIntoView({block:'start'});return;}
 window.history.pushState(null,'',next.pathname+next.search+next.hash);
 window.dispatchEvent(new Event('hashchange'));
}
export function useWorkspaceView(capabilities,readyKey){
 const location=useSyncExternalStore(subscribe,snapshot,serverSnapshot);
 const selected=workspaceLocationView(location);
 const section=workspaceViewAllowed(selected.section,capabilities)?selected.section:'inicio';
 useLayoutEffect(()=>{
  if(!location)return;
  const frame=window.requestAnimationFrame(()=>{
   const target=document.getElementById(selected.target);
   // Do not focus a hidden or unauthorized panel, nor create any business action.
   if(!target||!target.getClientRects().length)return;
   if(!target.hasAttribute('tabindex')){target.setAttribute('tabindex','-1');target.addEventListener('blur',()=>target.removeAttribute('tabindex'),{once:true});}
   target.focus({preventScroll:true});target.scrollIntoView({block:'start',behavior:'auto'});
  });
  return()=>window.cancelAnimationFrame(frame);
 },[location,section,selected.target,readyKey]);
 return section;
}
export function WorkspaceScreen({name,active,children}){
 // Remain mounted: moving around must not discard a draft or uncertain receipt.
 return <div data-workspace-screen={name} hidden={active!==name}>{children}</div>;
}
