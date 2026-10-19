'use client';
import {useEffect,useState} from 'react';
import {resolvePlanPartidaMeasurement,planPartidaMeasurementResultCurrent,planPartidaMeasurementIssueLabel} from './plan-partida-measurement-preview.mjs';
import styles from './plan-partida-source-preview.module.css';

const notices={NO_ACCESS_OR_LIST:'No hay una lista vigente de metrados autorizados en esta consulta.',NO_MATCH:'No se encontró una lectura de metrados analizada de este mismo archivo.',INCOMPLETE_LIST:'La lista está limitada a los 20 borradores más recientes. No se puede comprobar un vínculo único.',AMBIGUOUS:'Hay más de un borrador de metrados para este archivo. Revisá sus referencias por separado; no elegimos el más reciente.',SOURCE_UNAVAILABLE:'El borrador de metrados no tiene una lectura comprobable lista para consultar.',SOURCE_MISMATCH:'La obra, la partida o las celdas de la lectura de metrados no coinciden con esta fuente.',CONTEXT_MISMATCH:'Cambió la obra o el permiso de esta consulta.',DIGEST_MISMATCH:'El contenido de la lectura no coincide con su huella normalizada.',UNCONFIRMED:'No se pudo comprobar esta lectura de metrados.'};

export function PlanPartidaMeasurementPreview({catalog,view,selected,mayConsult=false,disabled=false,onConsult}){
 const [answer,setAnswer]=useState(null);
 useEffect(()=>{
  let active=true;
  if(!catalog||!mayConsult)return()=>{active=false;};
  void resolvePlanPartidaMeasurement({catalog,view,selected}).then(result=>{if(active)setAnswer({catalog,contextKey:view.contextKey,code:selected.code,sourceRange:selected.sourceRange,result});}).catch(()=>{if(active)setAnswer({catalog,contextKey:view.contextKey,code:selected.code,sourceRange:selected.sourceRange,result:{status:'UNCONFIRMED'}});});
  return()=>{active=false;};
 },[catalog,view,selected,mayConsult]);
 // Drop the derived private row as well as masking it synchronously. The
 // digest Promise may finish later, but its effect owner has been cancelled.
 if(answer&&(!mayConsult||!planPartidaMeasurementResultCurrent(answer,{catalog,view,selected})))setAnswer(null);
 const current=mayConsult&&planPartidaMeasurementResultCurrent(answer,{catalog,view,selected}),result=current?answer.result:{status:catalog&&mayConsult?'CHECKING':'NO_ACCESS_OR_LIST'};
 return <section className={styles.measurement} data-partida-measurement-status={result.status} aria-label={'Cómputo original de '+selected.code}>
  <div className={styles.measurementHeading}><h6>Cómputo original</h6>{result.status==='BOUND'&&<span className={styles.pending} data-partida-measurement-pending>Pendiente de revisión</span>}</div>
  {result.status==='BOUND'?<>
   <p className={styles.scope}>Cantidad y unidad originales del archivo.</p>
   <dl className={styles.facts}><div><dt>Cantidad original</dt><dd><code data-partida-quantity>{result.quantity??'Sin cantidad legible'}</code></dd></div><div><dt>Unidad original</dt><dd><code data-partida-unit>{result.unit??'Sin unidad legible'}</code></dd></div></dl>
   {result.issues.length>0?<details className={styles.provenance} data-partida-measurement-issue-details><summary>{result.issues.length} {result.issues.length===1?'observación por revisar':'observaciones por revisar'}</summary><ul className={styles.issues} data-partida-measurement-issues>{result.issues.map(issue=><li key={issue} data-measurement-issue={issue}>{planPartidaMeasurementIssueLabel(issue)}</li>)}</ul></details>:<p className={styles.scope}>Sin observaciones automáticas; pendiente de revisión.</p>}
   <details className={styles.provenance} data-partida-measurement-evidence><summary>Descripción, celdas y evidencia</summary><dl className={styles.evidenceFacts}><div><dt>Descripción en la lectura de metrados</dt><dd data-partida-measurement-title>{result.sourceTitle}</dd></div><div><dt>Celdas de origen</dt><dd data-partida-measurement-range>{result.sourceRowId}</dd></div></dl><p>Lectura observada de la misma obra, archivo, código y fila. No confirma identidad, cantidad base, unidad revisada ni destino de tarea. Las fórmulas conservan su valor guardado; no se recalculan. No se convierten unidades, meses o stock.</p><p>Borrador: <code data-measurement-draft>{result.draftId}</code> · revisión {result.revision} · estado {result.draftStatus}. Es la versión consultada, no una suscripción a cambios.</p><p>SHA-256: <code>{result.sourceSha256}</code></p><p>Digest de la fuente normalizada: <code data-measurement-source-digest>{result.sourceDigest}</code></p><p>{result.provenance.worksheet} · fila {result.provenance.row} · cantidad {result.quantityCell.address} · unidad {result.unitCell.address}.</p>{result.quantityCell.formulaText!==null&&<p>Fórmula original: <code data-measurement-formula>{result.quantityCell.formulaText}</code> · caché {result.quantityCell.cachePresent?'presente':'ausente'}.</p>}<p>El código y la descripción se contrastaron en la extracción con {result.provenance.matchingSource.worksheet}. Las observaciones originales se conservan; esta consulta no las resuelve.</p><p>Revisar metrados abre el panel existente. No carga archivos ni inicia análisis. Si necesitás otra lectura, elegí allí el archivo y autorizá su análisis por separado; conservá o cerrá primero cualquier revisión pendiente.</p></details>
  </>:<p className={styles.unavailable} role="status" data-partida-measurement-unavailable>{result.status==='CHECKING'?'Comprobando la huella de la lectura registrada…':notices[result.status]||notices.UNCONFIRMED}</p>}
  {mayConsult&&<div className={styles.measurementActions}><a href="#plan-measurement" data-measurement-flow>Revisar metrados</a><button type="button" data-measurement-consult disabled={disabled} onClick={onConsult}>Actualizar lectura</button>{result.status!=='BOUND'&&<p>Para analizar este mismo archivo, abrí Metrados desde una fuente y autorizá allí el análisis por separado. Este enlace no carga archivos ni inicia análisis; conservá o cerrá primero cualquier revisión pendiente.</p>}</div>}
 </section>;
}
