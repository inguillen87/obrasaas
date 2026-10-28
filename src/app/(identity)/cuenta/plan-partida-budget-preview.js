'use client';
import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {planPartidaBudgetCandidate,validatePlanPartidaBudgetDetail,resolvePlanPartidaBudgetRow,planPartidaBudgetNotices} from './plan-partida-budget-preview.mjs';
import styles from './plan-partida-source-preview.module.css';

const budgetFieldLabels={code:'Código',title:'Descripción',unit:'Unidad',quantity:'Cantidad',unitPrice:'Precio unitario',lineAmount:'Importe de partida'};
const budgetCellTypes={n:'Número',s:'Texto del archivo',inlineStr:'Texto del archivo',str:'Texto',e:'Error del archivo',b:'Valor lógico',d:'Fecha del archivo'};
const budgetReferenceStates={RESOLVED:'Referencia leída',MISSING:'Sin referencia',UNSUPPORTED:'Referencia no resuelta',SHARED_MASTER_UNRESOLVED:'Fórmula compartida sin origen resuelto'};
const budgetObservationIssues={CELL_ABSENT:'Celda ausente',FORMULA_CACHE_MISSING:'La fórmula no tiene resultado guardado',CELL_ERROR:'El archivo guarda un error',NON_NUMERIC_CELL_TYPE:'El tipo de celda no es numérico',SAVED_VALUE_MISSING:'Sin valor guardado',SHARED_MASTER_UNRESOLVED:'No se resolvió el origen de la fórmula compartida',FORMULA_SOURCE_UNRESOLVED:'La fórmula requiere revisión de su origen',NON_DECIMAL_SAVED_VALUE:'El valor guardado no es un número decimal legible'};
const budgetControlClassifications={GROUPING_ROW:'Agrupador de partidas',MONETARY_COST_ROW:'Costo monetario separado',UNCLASSIFIED_CONTROL:'Control sin clasificar'};
const budgetRowIssueLabels={UNIT_LITERAL_MISMATCH:'La unidad de Plan difiere de la unidad del cómputo',UNIT_MISSING:'Falta la unidad original'};
const budgetIssueFields={QUANTITY:'Cantidad',UNITPRICE:'Precio unitario',LINEAMOUNT:'Importe de partida'};
function budgetRowIssueLabel(issue){
 if(Object.hasOwn(budgetRowIssueLabels,issue))return budgetRowIssueLabels[issue];
 const match=/^(BUDGET|PLAN)_(QUANTITY|UNITPRICE|LINEAMOUNT)_(.+)$/.exec(issue);
 if(match){const reason=match[3]==='REFERENCE_UNRESOLVED'?'La referencia no coincide o no pudo resolverse':match[3]==='CACHE_MISMATCH'?'El valor guardado difiere del cómputo':Object.hasOwn(budgetObservationIssues,match[3])?budgetObservationIssues[match[3]]:null;if(reason)return (match[1]==='BUDGET'?'Cómputo':'Plan')+' · '+budgetIssueFields[match[2]]+': '+reason;}
 return 'Observación de la fuente no reconocida; revisá el código original.';
}
function budgetCellStatus(cell,observation){
 if(!cell.present)return 'Celda ausente';
 if(cell.type==='e')return 'Error guardado en el archivo';
 if(cell.formulaAttributes!==null){
  if(!cell.cachePresent)return 'Fórmula sin resultado guardado';
  if(!observation)return 'Fórmula con resultado guardado';
  if(observation.decimal!==null)return 'Fórmula con valor numérico guardado';
  if(cell.rawValue==='')return 'Fórmula con resultado vacío';
  return observation.issues.some(issue=>['NON_NUMERIC_CELL_TYPE','NON_DECIMAL_SAVED_VALUE'].includes(issue))?'Fórmula sin resultado numérico legible':'Fórmula con resultado pendiente de revisión';
 }
 if(observation){if(observation.decimal!==null)return 'Valor numérico guardado';if(cell.rawValue==='')return 'Valor guardado vacío';return observation.savedValuePresent?'Sin valor numérico legible':'Sin valor numérico guardado';}
 return cell.value===null?'Sin valor guardado':'Valor original guardado';
}
function budgetLiteral(value){return value===null||value===undefined?<span>Sin valor guardado</span>:value===''?<span>Vacío en el archivo</span>:<code className={styles.budgetLiteral}>{value}</code>;}
function budgetAttributes(value){return value===null?<span>Sin atributos guardados</span>:Object.keys(value).length?<dl className={styles.budgetAttributes}>{Object.entries(value).map(([key,item])=><div key={key}><dt><code>{key}</code></dt><dd>{budgetLiteral(item)}</dd></div>)}</dl>:<span>Sin atributos adicionales</span>;}
function budgetCellEvidence(source,cell){
 const format=source.styleTable[cell.styleRef];
 return <>
  <dl className={styles.budgetFieldFacts}>
   <div><dt>Celda presente en el archivo</dt><dd>{cell.present?'Sí':'No'}</dd></div>
   <div><dt>Contenido original</dt><dd>{budgetLiteral(cell.value)}</dd></div>
   <div><dt>Valor guardado sin formato</dt><dd>{budgetLiteral(cell.rawValue)}</dd></div>
   <div><dt>Tipo de contenido</dt><dd>{budgetCellTypes[cell.type]||'Tipo de contenido no declarado'}</dd></div>
   <div><dt>Fórmula original</dt><dd>{cell.formulaAttributes===null?'Sin fórmula':budgetLiteral(cell.formulaText)}</dd></div>
   <div><dt>Resultado guardado en el archivo</dt><dd>{cell.cachePresent?'Presente; no recalculado':'Ausente; no recalculado'}</dd></div>
   <div><dt>Celdas combinadas</dt><dd>{cell.mergedRanges.length?cell.mergedRanges.map(range=><code key={range} className={styles.budgetReference}>{range}</code>):'Sin combinaciones guardadas'}</dd></div>
  </dl>
  {cell.sharedFormulaMaster&&<details className={styles.budgetFieldDetails}><summary>Origen de la fórmula compartida</summary><dl className={styles.budgetFieldFacts}><div><dt>Celda de origen</dt><dd>{budgetLiteral(cell.sharedFormulaMaster.address)}</dd></div><div><dt>Fórmula guardada en el origen</dt><dd>{budgetLiteral(cell.sharedFormulaMaster.text)}</dd></div><div><dt>Atributos originales de la fórmula de origen</dt><dd>{budgetAttributes(cell.sharedFormulaMaster.attributes)}</dd></div></dl></details>}
  <details className={styles.budgetFieldDetails} data-budget-field-format><summary>Formato y atributos originales</summary>
   <p className={styles.scope}>Se muestran tal como están guardados. El formato no confirma moneda ni cambia el valor.</p>
   <dl className={styles.budgetFieldFacts}>
    <div><dt>Formato de visualización</dt><dd>{budgetLiteral(format.formatCode)}</dd></div>
    <div><dt>Formato tomado de</dt><dd>{{CELL:'Celda',ROW:'Fila',COLUMN:'Columna',DEFAULT:'Formato predeterminado del archivo',AMBIGUOUS:'Origen ambiguo; requiere revisión'}[format.source]}</dd></div>
    <div><dt>Identificador del estilo</dt><dd>{budgetLiteral(format.index)}</dd></div>
    <div><dt>Identificador del formato numérico</dt><dd>{budgetLiteral(format.numFmtId)}</dd></div>
    <div><dt>Huella del estilo original</dt><dd>{budgetLiteral(cell.styleRef)}</dd></div>
    <div><dt>Atributos de la fórmula</dt><dd>{budgetAttributes(cell.formulaAttributes)}</dd></div>
    <div><dt>Atributos de la celda</dt><dd>{budgetAttributes(cell.cellAttributes)}</dd></div>
    <div><dt>Atributos de la fila</dt><dd>{budgetAttributes(cell.rowAttributes)}</dd></div>
    <div><dt>Atributos de las columnas</dt><dd>{cell.columnAttributes.length?cell.columnAttributes.map((attributes,index)=><div key={index}><p>Columna {index+1}</p>{budgetAttributes(attributes)}</div>):'Sin atributos de columna guardados'}</dd></div>
    <div><dt>Atributos del formato</dt><dd>{budgetAttributes(format.attributes)}</dd></div>
    <div><dt>Atributos del formato base</dt><dd>{budgetAttributes(format.baseAttributes)}</dd></div>
   </dl>
  </details>
 </>;
}
function BudgetCell({source,cell,name,origin,worksheet,budgetWorksheet,link=null,observation=null}){
 const status=budgetCellStatus(cell,observation);
 return <tr data-budget-evidence-field={origin+'-'+name}>
  <th scope="row" data-label="Campo"><details className={styles.budgetFieldDetails} data-budget-field-detail><summary>{budgetFieldLabels[name]}</summary>{budgetCellEvidence(source,cell)}
   {link&&<details className={styles.budgetFieldDetails}><summary>Referencia y comparación con el cómputo</summary><dl className={styles.budgetFieldFacts}>
    <div><dt>Estado de la referencia</dt><dd>{budgetReferenceStates[link.reference.status]}</dd></div>
    <div><dt>Referencia leída en Plan</dt><dd>{link.reference.address?<code className={styles.budgetReference}>{link.reference.worksheet}!{link.reference.address}</code>:'Sin referencia resuelta'}</dd></div>
    <div><dt>Celda esperada en cómputo</dt><dd><code className={styles.budgetReference}>{budgetWorksheet}!{link.expectedAddress}</code></dd></div>
    <div><dt>Coincidencia de referencia</dt><dd>{link.referenceMatches?'La referencia coincide; pendiente de revisión':'La referencia no coincide o no pudo resolverse'}</dd></div>
    <div><dt>Comparación de valores guardados</dt><dd>{link.cacheMatchesBudget===true?'Coinciden; sin aprobación':link.cacheMatchesBudget===false?'Son diferentes; revisar ambas celdas':'No se pudo comparar; falta un valor numérico legible'}</dd></div>
    <div><dt>Referencia por fórmula compartida</dt><dd>{link.reference.shared?'Sí':'No'}</dd></div>
    <div><dt>Lectura guardada en Plan</dt><dd>{status}</dd></div>
    <div><dt>Valor numérico leído en Plan</dt><dd>{budgetLiteral(link.observation.decimal)}</dd></div>
    <div><dt>Valor presente en Plan</dt><dd>{link.observation.savedValuePresent?'Sí':'No'}</dd></div>
    <div><dt>Resultado de fórmula presente en Plan</dt><dd>{link.observation.formulaCachePresent?'Sí':'No'}</dd></div>
   </dl>{link.observation.issues.length>0&&<ul className={styles.issues}>{link.observation.issues.map(issue=><li key={issue}>{budgetObservationIssues[issue]}</li>)}</ul>}
   {link.observedTarget&&<details className={styles.budgetFieldDetails}><summary>Otra celda referenciada: {link.observedTarget.address}</summary>{budgetCellEvidence(source,link.observedTarget)}</details>}</details>}
  </details></th>
  <td data-label="Origen">{origin}</td>
  <td data-label="Referencia"><code className={styles.budgetReference}>{worksheet}!{cell.address}</code></td>
  <td data-label="Estado">{status}{link&&<span className={styles.budgetReferenceState}>{link.referenceMatches?'Referencia coincidente; sin aprobar':'Referencia pendiente de revisión'}{link.cacheMatchesBudget===false?' · Valores diferentes':''}</span>}</td>
 </tr>;
}
function csvBudgetTitleSummary(title){const characters=Array.from(title.replace(/\s+/gu,' ').trim());return characters.slice(0,144).join('')+(characters.length>144?'…':'');}
function CsvBudgetHeading({row}){
 const summary=csvBudgetTitleSummary(row.sourceTitle);
 return <div className={styles.csvHeading}>
  <code data-csv-budget-original-code>{row.code}</code>
  <p className={styles.csvTitleSummary} data-csv-budget-title-summary>{summary}</p>
  {summary!==row.sourceTitle&&<details className={styles.provenance} data-csv-budget-description><summary>Ver descripción completa</summary><p className={styles.csvDescription} data-csv-budget-original-description>{row.sourceTitle}</p></details>}
 </div>;
}
function CsvBudgetFields({source,row}){
 return <div className={styles.csvReading} data-csv-budget-reading>
  <dl className={styles.facts}>
   <div><dt>Cantidad original</dt><dd><code data-csv-budget-quantity>{row.rawQuantity===''?'Sin valor en la fuente':row.rawQuantity}</code></dd></div>
   <div><dt>Unidad original</dt><dd><code data-csv-budget-unit>{row.rawUnit===''?'Sin unidad en la fuente':row.rawUnit}</code></dd></div>
   <div><dt>Precio unitario original</dt><dd><code data-csv-budget-unit-price>{row.rawUnitPrice===''?'Sin valor en la fuente':row.rawUnitPrice}</code></dd></div>
   <div><dt>Importe original (IVA incluido)</dt><dd><code data-csv-budget-line-amount>{row.rawLineAmount===''?'Sin valor en la fuente':row.rawLineAmount}</code></dd></div>
  </dl>
  <p className={styles.scope}>Se conserva el texto original, incluidos ceros y separadores. Moneda y vigencia sin confirmar. No se calculan totales ni se adoptan estos valores como aprobados.</p>
  {row.issues.length>0&&<p className={styles.unavailable}>La fuente contiene texto que parece una fórmula. Se conserva como texto, sin ejecutarlo ni calcularlo.</p>}
  <details className={styles.provenance} data-csv-budget-provenance><summary>Procedencia de esta partida</summary>
   <dl className={styles.budgetFieldFacts}>
    <div><dt>Código original</dt><dd><code>{row.code}</code></dd></div>
    <div><dt>Página declarada en la fuente</dt><dd><code>{row.provenance.pageLiteral===''?'Sin página declarada':row.provenance.pageLiteral}</code></dd></div>
    <div><dt>Registro del CSV</dt><dd>{row.provenance.record}</dd></div>
    <div><dt>Líneas del CSV</dt><dd>{row.provenance.lineStart}–{row.provenance.lineEnd}</dd></div>
    <div><dt>Referencia de origen</dt><dd><code>{row.sourceRowId}</code></dd></div>
   </dl>
   <p className={styles.scope}>Encabezados originales: {source.headers.join(' · ')}.</p>
   <p className={styles.scope}>La procedencia corresponde al CSV conservado. Esta lectura no certifica su coincidencia con otro documento.</p>
  </details>
 </div>;
}
function BudgetReading({entry,initialDetail=null,owner,projectId,scope,view=null,selected=null,mayConsult=false,disabled=false,onRead,onRefresh}){
 const [answer,setAnswer]=useState(null),[choice,setChoice]=useState(''),active=useRef(null);
 const identity=useMemo(()=>({entry,owner,projectId,scope,mayConsult}),[entry,owner,projectId,scope,mayConsult]);
 useLayoutEffect(()=>{active.current=identity;return()=>{active.current=null;};},[identity]);
 if(answer&&(!mayConsult||answer.identity!==identity))setAnswer(null);
 useEffect(()=>{let live=true;if(!mayConsult||!initialDetail?.budgetSource)return()=>{live=false;};void validatePlanPartidaBudgetDetail(initialDetail,{projectId,descriptor:entry.budgetDescriptor,expectedId:entry.id,expectedRevision:entry.revision}).then(result=>{if(live&&active.current===identity)setAnswer({identity,result});});return()=>{live=false;};},[initialDetail,entry,identity,mayConsult,projectId]);
 async function consult(){if(disabled||!mayConsult||active.current!==identity||typeof onRead!=='function')return;const ticket=identity;setAnswer({identity:ticket,result:{status:'CHECKING'}});try{const draft=await onRead(entry.id);if(active.current!==ticket)return;const result=await validatePlanPartidaBudgetDetail(draft,{projectId,descriptor:entry.budgetDescriptor,expectedId:entry.id,expectedRevision:entry.revision});if(active.current===ticket)setAnswer({identity:ticket,result});}catch{if(active.current===ticket)setAnswer({identity:ticket,result:{status:'UNCONFIRMED'}});}}
 const result=mayConsult&&answer?.identity===identity?answer.result:{status:'UNREAD'},source=result.status==='BOUND'?result.source:null;
 const selectedRow=source&&(selected?resolvePlanPartidaBudgetRow(source,{view,selected}):{status:'BOUND',row:source.rows.find(row=>row.code===choice)||source.rows[0]}),row=selectedRow?.status==='BOUND'?selectedRow.row:null;
 const unavailable=selectedRow&&selectedRow.status!=='BOUND'?selectedRow.status:result.status,csv=entry.source?.contentType==='text/csv',rowIndex=row?source.rows.indexOf(row):-1;
 return <section className={styles.measurement} data-partida-budget-status={row?'BOUND':unavailable} aria-label={csv?'Presupuesto de obra (lectura)':'Presupuesto original de la partida'}>
  <div className={styles.measurementHeading}><h6>{csv?'Presupuesto de obra (lectura)':'Cómputo y presupuesto'}</h6><span className={styles.pending}>Lectura sin aprobar</span></div>
  <p className={styles.scope}>Valores guardados del archivo. Moneda sin confirmar; no son precios actuales ni importes aprobados.</p>
  {row?<>
   {!selected&&<label className={styles.budgetSelector}>Partida del presupuesto<select data-budget-partida-selection value={row.code} disabled={disabled} onChange={event=>setChoice(event.target.value)}>{source.rows.map(item=><option key={item.code} value={item.code}>{item.code} · {csv?csvBudgetTitleSummary(item.sourceTitle):item.sourceTitle}</option>)}</select></label>}
   {csv&&<div className={styles.measurementActions} aria-label="Recorrer partidas originales"><span role="status">Partida {rowIndex+1} de {source.rows.length}</span><button type="button" disabled={disabled||rowIndex<=0} onClick={()=>setChoice(source.rows[rowIndex-1].code)}>Anterior</button><button type="button" disabled={disabled||rowIndex>=source.rows.length-1} onClick={()=>setChoice(source.rows[rowIndex+1].code)}>Siguiente</button></div>}
   {csv?<CsvBudgetHeading row={row}/>:<p className={styles.partida}><strong>{row.code} · {row.sourceTitle}</strong></p>}
   {csv?<CsvBudgetFields source={source} row={row}/>:<>
   <dl className={styles.facts}><div><dt>Cantidad en cómputo</dt><dd><code data-budget-quantity>{row.observed.quantity.decimal??'Sin valor numérico guardado'}</code></dd></div><div><dt>Unidad original</dt><dd><code data-budget-unit>{row.originalRawUnit??'Sin unidad guardada'}</code></dd></div><div><dt>Precio unitario guardado</dt><dd><code data-budget-unit-price>{row.observed.unitPrice.decimal??'Sin valor numérico guardado'}</code></dd></div><div><dt>Importe de partida guardado</dt><dd><code data-budget-line-amount>{row.observed.lineAmount.decimal??'Sin valor numérico guardado'}</code></dd></div></dl>
   <p className={styles.scope} data-budget-month-base>Mes base declarado: {source.monthBase?.declaredText||'Sin mes base legible'}. Referencia de precios: {source.priceBasis?.declaredText||'Sin referencia legible'}. No se infiere moneda del símbolo $.</p>
   {(!row.plan.links.quantity.referenceMatches||row.plan.links.quantity.observation.decimal===null)&&<p className={styles.unavailable} data-budget-quantity-conflict>La cantidad de Plan no está confirmada: {row.plan.links.quantity.observation.decimal??'sin valor numérico guardado'}. Su referencia es {row.plan.links.quantity.reference.address||'no resuelta'}; el cómputo conserva {row.budget.cells.quantity.address}. No sustituimos ni adoptamos cantidades.</p>}
   {row.issues.length>0&&<details className={styles.provenance}><summary>{row.issues.length} observaciones de la fuente</summary><ul className={styles.issues}>{row.issues.map(issue=><li key={issue}>{budgetRowIssueLabel(issue)}<details className={styles.budgetFieldDetails}><summary>Código original de la observación</summary><code>{issue}</code></details></li>)}</ul></details>}
   <details className={styles.provenance} data-budget-evidence><summary>Celdas, fórmulas y procedencia</summary>
    <p>{row.sourceRowId} · {row.physicalSourceRowId}. Cada fórmula conserva su resultado guardado, incluso si está vacío o no es numérico. No se recalculan fórmulas ni se convierten unidades.</p>
    <p className={styles.scope}>Abrí un campo para consultar su valor original. Las coincidencias son observaciones del archivo, pendientes de revisión.</p>
    <table className={styles.budgetSourceTable}><caption>Origen de los seis campos de esta partida en cómputo y Plan</caption><thead><tr><th scope="col">Campo</th><th scope="col">Origen</th><th scope="col">Referencia</th><th scope="col">Estado</th></tr></thead><tbody>{Object.entries(budgetFieldLabels).flatMap(([name])=>[<BudgetCell key={'budget-'+name} source={source} cell={row.budget.cells[name]} observation={row.observed[name]||null} name={name} origin="Cómputo" worksheet={row.budget.worksheet}/>,<BudgetCell key={'plan-'+name} source={source} cell={row.plan.cells[name]} observation={row.plan.links[name]?.observation||null} name={name} origin="Plan" worksheet={row.plan.worksheet} budgetWorksheet={row.budget.worksheet} link={row.plan.links[name]||null}/>])}</tbody></table>
    <details className={styles.budgetFieldDetails}><summary>Identificación de esta lectura</summary><dl className={styles.budgetFieldFacts}><div><dt>Referencia del código en cómputo</dt><dd><code className={styles.budgetReference}>{row.plan.identityReference.worksheet}!{row.plan.identityReference.address}</code></dd></div><div><dt>Borrador</dt><dd>{budgetLiteral(entry.id)}</dd></div><div><dt>Revisión</dt><dd>{entry.revision}</dd></div><div><dt>Huella del archivo (SHA-256)</dt><dd>{budgetLiteral(source.sourceSha256)}</dd></div><div><dt>Huella de esta lectura</dt><dd>{budgetLiteral(source.sourceDigest)}</dd></div></dl><p className={styles.scope}>Es la lectura consultada, sin suscripción a cambios. No aprueba cantidades ni importes.</p></details>
   </details>
   <details className={styles.provenance} data-budget-controls><summary>Agrupadores, indirectos y controles separados</summary><p>{source.nonPhysicalRows?.length||0} filas no físicas y {source.controlCells?.length||0} celdas de control. No se suman a las partidas ni se registra un total aprobado.</p><ul>{source.controlCells?.map(item=><li key={item.worksheet+'!'+item.address}>{item.code||'Sin código'} · {item.address}: <code>{item.observation?.decimal??'Sin valor numérico guardado'}</code> · {Object.hasOwn(budgetControlClassifications,item.classification)?budgetControlClassifications[item.classification]:'Clasificación no reconocida; revisá el código original.'}<details className={styles.budgetFieldDetails}><summary>Código de clasificación original</summary><code>{item.classification}</code></details></li>)}</ul></details>
   </>}
  </>:<p className={styles.unavailable} role="status">{unavailable==='CHECKING'?'Comprobando el detalle y su huella…':unavailable==='UNREAD'?'Consultá el detalle privado de esta lectura para ver sus valores.':planPartidaBudgetNotices[unavailable]||planPartidaBudgetNotices.UNCONFIRMED}</p>}
  {mayConsult&&<div className={styles.measurementActions}><button type="button" data-budget-consult disabled={disabled||!entry.budgetDescriptor} onClick={consult}>{row?'Actualizar detalle del presupuesto':'Consultar detalle del presupuesto'}</button>{onRefresh&&<button type="button" disabled={disabled} onClick={onRefresh}>Actualizar estado de la lectura</button>}</div>}
 </section>;
}
export function PlanPartidaBudgetPreview({catalog,view,selected,mayConsult=false,disabled=false,onRead,onRefresh}){
 const candidate=mayConsult?planPartidaBudgetCandidate({catalog,view,selected}):{status:'NO_ACCESS_OR_LIST'};
 if(!mayConsult||!catalog?.entries.length)return null;
 if(candidate.status!=='MATCH')return <section className={styles.measurement} data-partida-budget-status={candidate.status}><h6>Cómputo y presupuesto</h6><p className={styles.unavailable} role="status">{planPartidaBudgetNotices[candidate.status]}</p>{onRefresh&&<button type="button" disabled={disabled} onClick={onRefresh}>Actualizar lista de presupuestos</button>}</section>;
 return <BudgetReading key={view.contextKey} entry={candidate.entry} owner={catalog.owner} projectId={view.projectId} scope={view.scope} view={view} selected={selected} mayConsult={mayConsult} disabled={disabled} onRead={onRead} onRefresh={onRefresh}/>;
}
export function PlanBudgetDraftPreview({draft,projectId,scope,owner,mayConsult=false,disabled=false,onRead,onRefresh}){
 const entry=useMemo(()=>({id:draft.id,revision:draft.revision,status:draft.status,source:draft.source,budgetDescriptor:draft.budgetDescriptor}),[draft]);
 return <BudgetReading entry={entry} initialDetail={draft} owner={owner} projectId={projectId} scope={scope} mayConsult={mayConsult} disabled={disabled} onRead={onRead} onRefresh={onRefresh}/>;
}
