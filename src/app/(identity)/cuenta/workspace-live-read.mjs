// Read-only reconciliation for the canonical workspace endpoints.
// Preserve membership, ordering and cursor of mounted lists. Unknown rows are
// announced, never silently inserted into or substituted for a loaded page.
export const LIVE_READ_MAX_PAGES=6;
const stale=(message,code='WORKSITE_LIVE_READ_INCOMPLETE')=>Object.assign(new Error(message),{code});
const aborted=()=>new DOMException('La consulta se canceló.','AbortError');
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
export const liveReadSignature=value=>JSON.stringify(canonical(value));
export function retainedRows(previous,incoming,{pending=false,stateKey='status'}={}){
 const current=new Map(incoming.map(row=>[row.id,row]));
 return previous.flatMap(old=>{
  const next=current.get(old.id);
  if(!next)throw stale('No se pudo comprobar toda la lista. Usá su botón de actualización para consultarla nuevamente.');
  if(typeof next.revision!=='string'||typeof old.revision!=='string'||next.revision<old.revision)throw stale('La consulta devolvió una revisión anterior. Conservamos los registros vigentes; volvé a comprobarlos.');
  const row=next;
  return pending&&row[stateKey]!=='PENDING'?[]:[row];
 });
}
export async function collectRetainedPages({ids,readPage,signal,isCurrent,maxPages=LIVE_READ_MAX_PAGES}){
 if(!Number.isSafeInteger(maxPages)||maxPages<1||maxPages>LIVE_READ_MAX_PAGES||!Array.isArray(ids)||new Set(ids).size!==ids.length||ids.length>maxPages*100)throw stale('La lista supera el límite de actualización automática. Usá la consulta manual para recorrerla.');
 const check=()=>{if(signal.aborted||isCurrent?.()===false)throw aborted();};
 const wanted=new Set(ids),found=new Map(),seen=new Set(),seenCursors=new Set();
 const unloadedRows=[];
 let cursor=null,first=null,hasUnloaded=false;
 for(let pageNumber=0;pageNumber<maxPages;pageNumber++){
  check();
  if(seenCursors.has(cursor))throw stale('La consulta repitió un cursor. Usá la actualización manual.');
  seenCursors.add(cursor);
  const page=await readPage(cursor,signal);
  check();
  if(!Array.isArray(page?.rows)||page.rows.length>100||page.cursor!==null&&(typeof page.cursor!=='string'||!page.cursor.length||seenCursors.has(page.cursor)))throw stale('La respuesta de actualización necesita otra consulta.');
  if(!first)first=page;
  for(const row of page.rows){
   if(!row||typeof row.id!=='string'||typeof row.revision!=='string'||seen.has(row.id))throw stale('La lista cambió mientras se consultaba. Actualizala antes de continuar.');
   seen.add(row.id);
   if(wanted.has(row.id))found.set(row.id,row);else if(wanted.size===0||found.size<wanted.size){hasUnloaded=true;unloadedRows.push(row);}
  }
  if(found.size===wanted.size)return {rows:[...found.values()],first,hasUnloaded,unloadedRows,pages:pageNumber+1};
  if(!page.cursor)break;
  if(page.cursor===cursor)throw stale('La consulta repitió una página. Usá la actualización manual.');
  cursor=page.cursor;
 }
 throw stale('No se pudo comprobar toda la lista dentro de esta consulta. Conservamos las páginas cargadas; usá la actualización manual.');
}
export const liveContextChanged=()=>stale('Cambió tu acceso a esta obra. Volvé a consultarla.','WORKSPACE_CONTEXT_CHANGED');
