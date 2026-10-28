// Browser-independent scheduler used by useWorksiteLiveRefresh.
export function worksiteLiveRefreshPresentation(status,{contextKey,viewKey='',enabled}){
 return status.contextKey===contextKey&&(status.viewKey===viewKey||['LIMITED','ACCESS'].includes(status.state))?status:{state:enabled?'PAUSED':'IDLE',checkedAt:null,updates:false};
}
export function createWorksiteLiveRefreshController({contextKey,getCurrent,onState,setTimer=setTimeout,clearTimer=clearTimeout,now=Date.now,random=Math.random,isVisible=()=>true,isOnline=()=>true,observedAt=null}){
 // observedAt: when this context was just read canonically, that read is the latest observation,
 // so the first live check keeps the five-second spacing instead of repeating it.
 let disposed=false,timer=null,active=null,lastStart=observedAt,failures=0,lastChecked=null,limited=false,settledStart=observedAt,lockRetry=true;
 const jitter=base=>Math.round(base*(.9+random()*.2));
 const same=()=>!disposed&&getCurrent()?.contextKey===contextKey;
 const eligible=()=>same()&&getCurrent().enabled===true&&!getCurrent().blocked&&isVisible()&&isOnline();
 const publish=value=>{if(same())onState({contextKey,viewKey:getCurrent().viewKey||'',checkedAt:lastChecked,updates:false,...value});};
 const stopTimer=()=>{if(timer!==null)clearTimer(timer);timer=null;};
 // A read cancelled by this client's own lock is not an observation: the first such
 // cancellation releases its start from the spacing, so unlocking retries at once.
 // A second consecutive cancellation keeps the spacing and cannot become a GET storm.
 const pause=()=>{stopTimer();if(active&&!active.signal.aborted&&lockRetry){lockRetry=false;lastStart=settledStart;}active?.abort();publish({state:'PAUSED'});};
 function schedule(delay=45000){stopTimer();if(same()&&getCurrent().enabled&&!limited)timer=setTimer(run,jitter(Math.max(5000,delay)));}
 async function run(){
  timer=null;
  if(limited)return false;
  if(!eligible()){publish({state:!isOnline()?'OFFLINE':!isVisible()?'HIDDEN':'PAUSED'});return false;}
  if(active)return false;
  const remaining=lastStart===null?0:5000-(now()-lastStart);
  if(remaining>0){schedule(remaining);return false;}
  const captured=getCurrent(),authorityStamp=captured.getAuthorityStamp?.(),abort=new AbortController(),startedAt=now();active=abort;lastStart=startedAt;
  const settle=()=>{if(!abort.signal.aborted&&active===abort){settledStart=startedAt;lockRetry=true;}};
  const timeout=setTimer(()=>abort.abort(),30000);
  publish({state:'CONSULTING'});
  try{
   const value=await captured.read(abort.signal);settle();
   if(!same()||active!==abort||abort.signal.aborted||!eligible()||captured.isCurrent?.(authorityStamp)===false)return false;
   const accepted=captured.apply(value);if(accepted===false)return false;
   failures=0;lastChecked=new Date(now()).toISOString();publish({state:'CURRENT',updates:accepted?.updates===true,message:accepted?.message||''});return true;
  }catch(error){
   settle();
   if(!same()||active!==abort)return false;
   const denied=error?.status===401||error?.status===403||['WORKSPACE_CONTEXT_CHANGED','WORKSPACE_PROJECT_UNAVAILABLE','FIELD_REVIEW_CURSOR_UNAVAILABLE'].includes(error?.code);
   if(denied){
    if(captured.isAuthorityCurrent?.(authorityStamp)===false)return false;
    if(captured.onAccessRejected?.(error)===false)return false;
    publish({state:'ACCESS',message:'Tu acceso cambió. Volvé a consultar la obra antes de continuar.'});
   }else if(captured.isCurrent?.(authorityStamp)!==false){
    if(error?.code==='WORKSITE_LIVE_READ_INCOMPLETE'){limited=true;publish({state:'LIMITED',message:error.message});}
    else if(error?.name==='AbortError'){if(eligible())publish({state:'STALE',message:'La consulta venció. Podés comprobar otra vez; los datos y los borradores siguen conservados.'});}
    else{failures=Math.min(3,failures+1);publish({state:'STALE',message:'No pudimos actualizar esta consulta. Conservamos los datos; podés comprobar otra vez o usar su actualización manual.'});}
   }
   return false;
  }finally{
   clearTimer(timeout);if(active===abort)active=null;
   if(same()&&eligible()&&!limited&&timer===null)schedule(Math.min(180000,45000*2**failures));
  }
 }
 return {
  start(){publish({state:getCurrent()?.enabled?'PAUSED':'IDLE'});if(eligible())schedule(5000);},
  check({manual=false}={}){if(manual)limited=false;if(!eligible()||limited)return Promise.resolve(false);stopTimer();return run();},
  pause,
  environmentChanged(){if(!eligible()){pause();publish({state:!isOnline()?'OFFLINE':!isVisible()?'HIDDEN':'PAUSED'});return;}if(!active&&!limited)schedule(5000);},
  dispose(){disposed=true;stopTimer();active?.abort();}
 };
}

// Presentation of the browser's completed check, not a server observation or authority.
export function worksiteLiveCheckedAtLabel(value){
 const unknown='Fecha y hora sin confirmar';
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value))return unknown;
 const instant=new Date(value);
 if(!Number.isFinite(instant.getTime())||instant.toISOString()!==value)return unknown;
 try{return new Intl.DateTimeFormat('es-AR',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(instant)+' (hora de Argentina)';}
 catch{return unknown;}
}
