// Presentation of an existing physical import DTO. No source parsing, identity
// association, unit/date conversion, cumulative curve, persistence or authority.
export const PLAN_PARTIDA_PREVIEW_VIEWS=Object.freeze(['DIAGRAM','CURVE','QUANTITIES']);
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const identifier=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const code=value=>typeof value==='string'&&/^[AB]\.1\.\d{1,3}\.\d{1,3}$/.test(value);
const groupCode=value=>typeof value==='string'&&/^[AB](?:\.1(?:\.\d{1,3})?)?$/.test(value);
const text=(value,max)=>typeof value==='string'&&value.length>0&&value.length<=max&&!/[\u0000-\u001f\u007f<>]/.test(value);
const reject=()=>{throw new Error('PLAN_PARTIDA_PREVIEW_UNAVAILABLE');};

export function planPartidaSourcePreview(draft,{projectId,scope,reviewRows=draft?.rows}={}){
 const source=draft?.spreadsheet;
 if(![2,4].includes(source?.version))return null;
 if(!identifier(projectId)||!hash(scope)||!identifier(draft.id)||!Number.isSafeInteger(draft.revision)||draft.revision<1||!hash(draft.source?.sha256)||source.profile!==(source.version===2?'CYP_PARTIDAS':'CYP_PARTIDAS_CURVE')||source.worksheet!=='Plan de trabajo'||source.level!=='PARTIDA'||!Number.isSafeInteger(source.rowCount)||source.rowCount<1||source.rowCount>200||!Array.isArray(source.items)||source.items.length!==source.rowCount||!Array.isArray(source.groups)||source.groups.length>200||source.weeksPerPeriod!==4||!Array.isArray(source.periodOrdinals)||source.periodOrdinals.length!==12||source.periodOrdinals.some((value,index)=>value!==index+1))reject();
 const seen=new Set(),items=source.items.map(item=>{
  const range=/^Plan de trabajo!A([1-9]\d{0,5}):BE([1-9]\d{0,5})$/.exec(item?.sourceRange||'');
  if(!object(item)||!code(item.code)||seen.has(item.code)||item.parentCode!==item.code.slice(0,item.code.lastIndexOf('.'))||!text(item.sourceTitle,2000)||!range||range[1]!==range[2]||typeof item.missingUnit!=='boolean'||typeof item.missingQuantity!=='boolean'||!Array.isArray(item.ordinalDistribution)||item.ordinalDistribution.length!==48||item.ordinalDistribution.some(value=>value!==null&&(typeof value!=='number'||!Number.isFinite(value)||value<0||value>1)))reject();
  seen.add(item.code);
  return {code:item.code,parentCode:item.parentCode,title:item.sourceTitle,sourceRange:item.sourceRange,missingUnit:item.missingUnit,missingQuantity:item.missingQuantity,months:Array.from({length:12},(_,index)=>({ordinal:index+1,weeks:item.ordinalDistribution.slice(index*4,index*4+4).map((value,week)=>({ordinal:index*4+week+1,withinMonth:week+1,value}))}))};
 });
 const groups=[],seenGroups=new Set();
 for(const group of source.groups){
  if(!object(group)||!groupCode(group.code)||seenGroups.has(group.code)||!text(group.title,2000))reject();
  seenGroups.add(group.code);if(items.some(item=>item.code.startsWith(group.code+'.')))groups.push({code:group.code,title:group.title});
 }
 if(items.some(item=>!seenGroups.has(item.parentCode)))reject();
 const retained=new Set();let selectionAvailable=Array.isArray(reviewRows)&&reviewRows.length<=items.length;
 if(selectionAvailable)for(const row of reviewRows){if(!object(row)||!seen.has(row.code)||retained.has(row.code)){selectionAvailable=false;break;}retained.add(row.code);}
 return {projectId,scope,contextKey:JSON.stringify([projectId,scope,draft.id,draft.revision,draft.source.sha256]),sourceSha256:draft.source.sha256,items,groups,retainedCodes:selectionAvailable?[...retained]:null,curve:source.version===4?source.curve:null,profile:source.profile,status:draft.status};
}

export function planPartidaPreviewSelection(view,previous={}){
 if(!view?.items?.length)reject();
 const current=previous?.contextKey===view.contextKey?previous:{};
 const group=view.groups.some(row=>row.code===current.group)?current.group:'';
 const items=group?view.items.filter(row=>row.code.startsWith(group+'.')):view.items;
 const selected=items.find(row=>row.code===current.code)||items[0];
 // Curve imports retain their existing initial visible financial overview.
 const tab=PLAN_PARTIDA_PREVIEW_VIEWS.includes(current.tab)?current.tab:view.profile==='CYP_PARTIDAS_CURVE'?'CURVE':'DIAGRAM';
 return {contextKey:view.contextKey,group,code:selected.code,tab,items,index:items.findIndex(row=>row.code===selected.code),selected};
}

export function planPartidaSourceShare(value){
 if(value===null)return 'Sin dato';
 if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>1)reject();
 // Only the visible percentage is formatted; the DTO value remains unchanged.
 return new Intl.NumberFormat('es-AR',{style:'percent',maximumFractionDigits:10}).format(value);
}
