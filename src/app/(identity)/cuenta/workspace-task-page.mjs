import {calendarDay} from './schedule-workbench.mjs';
import {taskMeasurementView} from './task-progress-measurement-view.mjs';

// Client read coordination only. Every page is still authorized by the
// canonical workspace endpoint; this module never creates a permission.
const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const keys=value=>Object.keys(value).sort().join('|');
const revision=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d\.\d{6}$/.test(value)&&calendarDay(value.slice(0,10))!==null;
const invalid=()=>new Error('No pudimos confirmar la siguiente página de tareas. Conservamos tu borrador; volvé a consultar.');
const denied=error=>error?.status===401||error?.status===403||error?.code==='WORKSPACE_CONTEXT_CHANGED'||error?.status===404&&error?.code==='WORKSPACE_PROJECT_UNAVAILABLE';
function context(value){
 if(!object(value)||!/^[a-f0-9]{64}$/.test(value.scope||'')||!id(value.projectId)||typeof value.role!=='string'||!value.role.trim()||!Number.isSafeInteger(value.generation)||value.generation<0||value.officeReviewOnly!==false||typeof value.blocked!=='boolean'||value.cursor!==null&&!id(value.cursor))return null;
 return {scope:value.scope,projectId:value.projectId,role:value.role,generation:value.generation,cursor:value.cursor,blocked:value.blocked,officeReviewOnly:false};
}
const identity=value=>value&&[value.scope,value.projectId,value.role,value.generation].join(':');
export function confirmedWorksiteTaskPage(data,expected){
 if(!object(data)||keys(data)!=='canPlanSchedule|nextCursor|project|roleLabel|scope|tasks|totalTasks'||data.scope!==expected.scope||!object(data.project)||data.project.id!==expected.projectId||data.project.status!=='ACTIVE'||typeof data.project.name!=='string'||!data.project.name.trim()||typeof data.roleLabel!=='string'||!data.roleLabel.trim()||typeof data.canPlanSchedule!=='boolean'||!Array.isArray(data.tasks)||data.tasks.length>100||!Number.isSafeInteger(data.totalTasks)||data.totalTasks<data.tasks.length)throw invalid();
 const taskIds=new Set();
 for(const task of data.tasks){
  if(!object(task)||!['endsOn|id|progress|revision|startsOn|status|title','endsOn|id|measurement|progress|revision|startsOn|status|title'].includes(keys(task))||!id(task.id)||taskIds.has(task.id)||typeof task.title!=='string'||!task.title.trim()||typeof task.status!=='string'||!task.status.trim()||!Number.isInteger(task.progress)||task.progress<0||task.progress>100||!revision(task.revision)||(task.startsOn!==null&&calendarDay(task.startsOn)===null)||(task.endsOn!==null&&calendarDay(task.endsOn)===null)||Object.hasOwn(task,'measurement')&&taskMeasurementView(task).state==='UNCONFIRMED')throw invalid();
  taskIds.add(task.id);
 }
 if(data.nextCursor!==null&&(!id(data.nextCursor)||data.tasks.length!==100||data.nextCursor!==data.tasks.at(-1).id||data.nextCursor===expected.cursor))throw invalid();
 return data;
}

export function createWorksiteTaskPager({request,getContext,onState,onPage,onAccessRejected}){
 let active=null,epoch=0,disposed=false,seenContext=null;
 const consumed=new Set();
 const current=()=>disposed?null:context(getContext());
 const same=captured=>identity(current())===identity(captured);
 const publish=state=>{if(!disposed)onState(state);};
 function reset(){epoch++;const previous=active;active=null;consumed.clear();seenContext=null;previous?.abort.abort();}
 async function loadMore(){
  const captured=current();
  if(!captured||captured.blocked||!captured.cursor||active)return false;
  if(seenContext!==identity(captured)){consumed.clear();seenContext=identity(captured);}
  if(consumed.has(captured.cursor)){publish({loading:false,error:'La página de tareas ya se consultó. Actualizá el cronograma antes de continuar.'});return false;}
  const ticket={epoch:++epoch,abort:new AbortController(),captured};active=ticket;let notice='';
  publish({loading:true,error:''});
  try{
   const query='?'+new URLSearchParams({projectId:captured.projectId,scope:captured.scope,afterTask:captured.cursor});
   const page=await request(query,{signal:ticket.abort.signal});
   if(disposed||active!==ticket||epoch!==ticket.epoch||!same(captured)||current()?.cursor!==captured.cursor)return false;
   const confirmed=confirmedWorksiteTaskPage(page,captured);
   // A read captured before another module's write cannot append while that
   // module is saving or recovering an uncertain result. The cursor is reusable.
   if(current().blocked)return false;
   onPage(confirmed,captured);consumed.add(captured.cursor);return true;
  }catch(error){
   if(disposed||active!==ticket||epoch!==ticket.epoch||!same(captured))return false;
   if(error?.name!=='AbortError'){
    notice=denied(error)?'Tu acceso cambió. Volvé a consultar la obra antes de continuar.':'No se pudieron cargar más tareas. Conservamos tu borrador; intentá nuevamente.';
    if(denied(error))onAccessRejected?.(error,captured);
   }
   return false;
  }finally{
   if(active===ticket){active=null;if(!disposed&&same(captured))onState({loading:false,error:notice});}
  }
 }
 return {loadMore,reset,dispose(){reset();disposed=true;}};
}
