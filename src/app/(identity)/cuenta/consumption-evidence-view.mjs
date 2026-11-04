const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===keys.slice().sort().join('|');
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const instant=value=>{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/.test(value)||value.startsWith('0000-'))return false;
 const parsed=new Date(value+'Z');return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,19)===value.slice(0,19);
};
const fail=()=>{throw Object.assign(new Error('No pudimos comprobar esta lista de archivos. Conservamos tu selección; volvé a consultarla.'),{code:'CONSUMPTION_EVIDENCE_UNCONFIRMED'});};
function entry(value,context){
 if(!exact(value,['id','title','taskId','workerId','sectorId','revision','status','media'])||!id(value.id)||typeof value.title!=='string'||value.title.length>500||value.workerId!==context.workerId||value.sectorId!==context.sectorId||value.taskId!==context.taskId||!instant(value.revision)||!['PENDING','APPROVED'].includes(value.status))fail();
 const media=value.media;
 if(!exact(media,['kind','contentType','bytes','sha256'])||!['image','audio'].includes(media.kind)||typeof media.contentType!=='string'||!media.contentType.startsWith(media.kind+'/')||!Number.isSafeInteger(media.bytes)||media.bytes<1||media.bytes>3*1024*1024||!hash(media.sha256))fail();
}
export function consumptionEvidenceSnapshot(value,expected){
 if(!value||['projectId','scope','workerId','taskId','sectorId'].some(key=>value[key]!==expected[key]))throw Object.assign(new Error('Cambió el contexto de los archivos. Volvé a consultar la obra con tu acceso vigente.'),{code:'WORKSPACE_CONTEXT_CHANGED'});
 if(!exact(value,['projectId','scope','workerId','taskId','sectorId','entries','evidence','page','unavailableIds'])||!Array.isArray(value.unavailableIds)||value.unavailableIds.length>10||new Set(value.unavailableIds).size!==value.unavailableIds.length||!Array.isArray(value.entries)||value.entries.length>6||!Array.isArray(value.evidence)||value.evidence.length>16||!Array.isArray(expected.selectedIds)||expected.selectedIds.length>10||new Set(expected.selectedIds).size!==expected.selectedIds.length||expected.selectedIds.some(value=>!id(value)))fail();
 for(const rows of [value.entries,value.evidence]){if(new Set(rows.map(row=>row?.id)).size!==rows.length)fail();for(const row of rows)entry(row,expected);}
 const byId=new Map(value.evidence.map(row=>[row.id,row])),listed=new Set(value.entries.map(row=>row.id));
 if(value.entries.some(row=>{const retained=byId.get(row.id);return !retained||['id','title','taskId','workerId','sectorId','revision','status'].some(key=>row[key]!==retained[key])||['kind','contentType','bytes','sha256'].some(key=>row.media[key]!==retained.media[key]);})||value.evidence.some(row=>!listed.has(row.id)&&!expected.selectedIds.includes(row.id)))fail();
 // Every selected ID is accounted for exactly once: still visible, or named as unavailable.
 if(value.unavailableIds.some(item=>!id(item)||!expected.selectedIds.includes(item)||byId.has(item))||expected.selectedIds.some(item=>!byId.has(item)&&!value.unavailableIds.includes(item)))fail();
 const page=value.page;
 if(!exact(page,['contextDigest','first','last','hasPrevious','hasNext'])||!hash(page.contextDigest)||typeof page.hasPrevious!=='boolean'||typeof page.hasNext!=='boolean'||(page.first===null)!==(page.last===null))fail();
 if(!value.entries.length){if(page.first!==null||page.last!==null||page.hasPrevious||page.hasNext)fail();}
 else if(![page.first,page.last].every(cursor=>exact(cursor,['id','createdAt'])&&id(cursor.id)&&instant(cursor.createdAt))||page.first.id!==value.entries[0].id||page.last.id!==value.entries.at(-1).id||page.first.createdAt+'|'+page.first.id<page.last.createdAt+'|'+page.last.id)fail();
 if(expected.page&&expected.page.contextDigest!==page.contextDigest)fail();
 return value;
}
