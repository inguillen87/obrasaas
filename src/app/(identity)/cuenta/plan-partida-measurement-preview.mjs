// Read-only binding of publicDraft DTOs which the canonical API has already
// normalized. This is not an extractor, a review decision or an access grant.
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const sha=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const text=(value,max)=>typeof value==='string'&&value.length>0&&value.length<=max&&!/[\u0000-\u001f\u007f-\u009f<>]/.test(value);
const canonical=value=>Array.isArray(value)?value.map(canonical):record(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const exact=(value,keys)=>record(value)&&Object.keys(value).sort().join('|')===[...keys].sort().join('|');
const failure=status=>({status});
const excelTypes=['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-excel.sheet.macroenabled.12'];

export function planPartidaMeasurementCatalog(listing,{projectId,scope,owner,canonicalAccess}){
 if(canonicalAccess!==true||listing?.canApprove!==true)return null;
 if(!owner||!text(projectId,180)||!sha(scope)||listing.projectId!==projectId||listing.scope!==scope||!Array.isArray(listing.drafts)||listing.drafts.length>20||typeof listing.truncated!=='boolean')throw new Error('La lista no corresponde a esta obra o no está completa.');
 // Review reasons, destination tasks and proposed decisions are not retained.
 const entries=listing.drafts.filter(draft=>draft?.measurementImport===true).map(draft=>({id:draft.id,revision:draft.revision,status:draft.status,measurementImport:true,source:draft.source?{...draft.source}:null,sourceDigest:draft.sourceDigest,measurementSource:draft.measurementSource,...(Object.hasOwn(draft,'projectId')?{projectId:draft.projectId}:{})}));
 return {owner,projectId,scope,canApprove:true,truncated:listing.truncated,entries};
}

// Exactly the canonical serializer, applied only to an already-normalized DTO.
// Do not import the Node/OOXML normalizer into the browser bundle.
export async function planPartidaNormalizedMeasurementDigest(source){
 const json=JSON.stringify(canonical(source)),bytes=new TextEncoder().encode(json);
 if(bytes.length>2*1024*1024)throw new Error('La fuente supera el límite de lectura.');
 const digest=await globalThis.crypto.subtle.digest('SHA-256',bytes);
 return Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,'0')).join('');
}

export function planPartidaMeasurementResultCurrent(answer,{catalog,view,selected}){
 return Boolean(catalog&&answer?.catalog===catalog&&answer.contextKey===view?.contextKey&&answer.code===selected?.code&&answer.sourceRange===selected?.sourceRange);
}

export function planPartidaMeasurementRequestCurrent(stamp,{owner,generation,accepted}){
 return Boolean(stamp&&stamp.owner===owner&&stamp.generation===generation&&(!accepted||accepted.owner!==owner||accepted.generation!==generation||accepted.sequence<=stamp.sequence));
}

function checkedSource(source,sourceSha256,contentType){
 if(!exact(source,['version','profile','purpose','sourceSha256','contentType','format','rows','excludedRows','warnings'])||source.version!==1||source.profile!=='SOURCE_QUANTITIES_V1'||source.purpose!=='PHYSICAL_TASK_MEASUREMENT'||source.format!=='CYP_PARTIDAS'||source.sourceSha256!==sourceSha256||source.contentType!==contentType||!Array.isArray(source.rows)||source.rows.length<1||source.rows.length>200||!Array.isArray(source.excludedRows)||!Array.isArray(source.warnings))return false;
 const codes=new Set(),ranges=new Set();
 return source.rows.every(row=>{
  const p=row?.provenance,match=/^Plan de trabajo!A([1-9]\d{0,5}):D\1$/.exec(row?.sourceRowId||'');
  if(!match||!text(row.code,128)||!/^[AB]\.1\.\d{1,3}\.\d{1,3}$/.test(row.code)||codes.has(row.code)||ranges.has(row.sourceRowId)||!text(row.sourceTitle,500)||row.parentCode!==row.code.slice(0,row.code.lastIndexOf('.'))||!record(p)||p.worksheet!=='Plan de trabajo'||p.row!==match[1]||p.sameRow!==true||p.sourceRange!==row.sourceRowId||p.codeCell!=='A'+p.row||p.titleCell!=='B'+p.row||p.quantityCell!=='D'+p.row||p.unitCell!=='C'+p.row||p.codeFact?.value!==row.code||!record(p.matchingSource)||p.matchingSource.worksheet!=='CyP Integral completo'||p.matchingSource.codeFact?.value!==row.code||!record(row.quantity)||row.quantity.address!==p.quantityCell||!record(row.unit)||row.unit.address!==p.unitCell||!Array.isArray(row.candidate?.issues)||row.candidate.issues.length>30||row.candidate.issues.some(issue=>typeof issue!=='string'||!/^[A-Z_]{1,80}$/.test(issue)))return false;
  codes.add(row.code);ranges.add(row.sourceRowId);return true;
 });
}

const literalQuantity=quantity=>['s','inlineStr','str'].includes(quantity?.type)&&typeof quantity.value==='string'?quantity.value:typeof quantity?.rawValue==='string'?quantity.rawValue:null;
const literalUnit=unit=>typeof unit?.value==='string'?unit.value:typeof unit?.rawValue==='string'?unit.rawValue:null;
export async function resolvePlanPartidaMeasurement({catalog,view,selected}){
 if(!catalog||catalog.canApprove!==true)return failure('NO_ACCESS_OR_LIST');
 if(!view||catalog.projectId!==view.projectId||catalog.scope!==view.scope||!sha(view.sourceSha256)||!view.items.some(item=>item.code===selected?.code&&item.sourceRange===selected?.sourceRange))return failure('CONTEXT_MISMATCH');
 if(catalog.truncated)return failure('INCOMPLETE_LIST');
 const physical=/^Plan de trabajo!A([1-9]\d{0,5}):BE\1$/.exec(selected.sourceRange);
 if(!physical)return failure('SOURCE_MISMATCH');
 const candidates=catalog.entries.filter(draft=>draft.source?.sha256===view.sourceSha256);
 if(candidates.length===0)return failure('NO_MATCH');
 if(candidates.length!==1)return failure('AMBIGUOUS');
 const draft=candidates[0],source=draft.measurementSource;
 if(draft.projectId!==undefined&&draft.projectId!==catalog.projectId||draft.measurementImport!==true||!text(draft.id,180)||!Number.isSafeInteger(draft.revision)||draft.revision<1||!['READY','APPLIED'].includes(draft.status)||!sha(draft.sourceDigest)||!excelTypes.includes(draft.source?.contentType))return failure('SOURCE_UNAVAILABLE');
 if(!checkedSource(source,view.sourceSha256,draft.source.contentType))return failure('SOURCE_MISMATCH');
 if(await planPartidaNormalizedMeasurementDigest(source)!==draft.sourceDigest)return failure('DIGEST_MISMATCH');
 const matches=source.rows.filter(row=>row.code===selected.code);
 if(matches.length!==1||matches[0].sourceRowId!==`Plan de trabajo!A${physical[1]}:D${physical[1]}`||matches[0].parentCode!==selected.parentCode)return failure('SOURCE_MISMATCH');
 const row=matches[0];
 return {status:'BOUND',draftId:draft.id,revision:draft.revision,draftStatus:draft.status,sourceSha256:view.sourceSha256,sourceDigest:draft.sourceDigest,code:row.code,sourceTitle:row.sourceTitle,sourceRowId:row.sourceRowId,quantity:literalQuantity(row.quantity),unit:literalUnit(row.unit),issues:[...row.candidate.issues],provenance:row.provenance,quantityCell:row.quantity,unitCell:row.unit};
}

export const planPartidaMeasurementIssueLabel=issue=>({IDENTITY_REVIEW_REQUIRED:'Código o descripción por revisar con las celdas originales.',HIDDEN_SOURCE_CELL:'Hay una celda oculta en la fuente.',SOURCE_VISIBILITY_UNKNOWN:'Visibilidad de la fuente sin comprobar.',FORMULA_CACHE_REVIEW_REQUIRED:'Se muestra el valor guardado de una fórmula; no se recalculó.',FORMULA_UNSUPPORTED:'Fórmula no comprobada; requiere revisión separada.',QUANTITY_MISSING:'Falta una cantidad legible.',UNIT_MISSING:'Falta una unidad legible.',QUANTITY_REQUIRES_CORRECTION:'La cantidad necesita una corrección revisada.',UNIT_REQUIRES_CORRECTION:'La unidad necesita una corrección revisada.',QUANTITY_FORMAT_UNSUPPORTED:'Formato de cantidad ambiguo o no físico.',UNIT_FORMAT_UNSUPPORTED:'Formato de unidad por revisar.',QUANTITY_TYPE_UNSUPPORTED:'Tipo de cantidad no comprobado.',UNIT_TYPE_UNSUPPORTED:'Tipo de unidad no comprobado.',MERGED_SOURCE_CELL:'Celda combinada: compará el rango original.'})[issue]||'Observación conservada: '+issue;
