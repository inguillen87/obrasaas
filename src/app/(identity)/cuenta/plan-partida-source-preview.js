'use client';
import {useId,useState} from 'react';
import {PlanSourceCurve} from './plan-source-curve';
import {PlanPartidaMeasurementPreview} from './plan-partida-measurement-preview';
import {PlanPartidaBudgetPreview} from './plan-partida-budget-preview';
import {planPartidaSourcePreview,planPartidaPreviewSelection,planPartidaSourceShare} from './plan-partida-source-preview.mjs';
import styles from './plan-partida-source-preview.module.css';

const views=[['DIAGRAM','Diagrama'],['CURVE','Curva'],['QUANTITIES','Cómputo']];

export function PlanPartidaSourcePreview({draft,reviewRows,projectId,scope,disabled=false,measurementCatalog=null,mayConsultMeasurement=false,onConsultMeasurements,budgetCatalog=null,onReadBudget}){
 const id=useId(),[choice,setChoice]=useState({});
 let view,current;
 try{view=planPartidaSourcePreview(draft,{projectId,scope,reviewRows});if(view)current=planPartidaPreviewSelection(view,choice);}catch{return <p className={styles.unavailable} role="status">No se puede comprobar la vista por partida con esta fuente. Las correcciones y decisiones del importador siguen separadas.</p>;}
 if(!view)return null;
 const {selected}=current,retained=view.retainedCodes?.includes(selected.code),panelId=id+'-view';
 const choose=patch=>{if(!disabled)setChoice({contextKey:current.contextKey,group:current.group,code:current.code,tab:current.tab,...patch});};
 return <section className={styles.preview} aria-labelledby={id+'-title'} data-plan-partida-preview data-source-sha={view.sourceSha256} data-selected-code={selected.code}>
  <div className={styles.heading}><h5 id={id+'-title'}>Fuente por partida</h5><span>Solo lectura</span></div>
  <div className={styles.selectors}>
   <label>Grupo<select data-partida-group value={current.group} disabled={disabled} onChange={event=>choose({group:event.target.value})}><option value="">Todos ({view.items.length})</option>{view.groups.map(group=><option key={group.code} value={group.code}>{group.code} · {group.title}</option>)}</select></label>
   <label>Partida<select data-partida-selection value={selected.code} disabled={disabled} onChange={event=>choose({code:event.target.value})}>{current.items.map(item=><option key={item.code} value={item.code}>{item.code} · {item.title}</option>)}</select></label>
  </div>
  <div className={styles.navigation}><button type="button" aria-label="Partida anterior" disabled={disabled||current.index===0} onClick={()=>choose({code:current.items[current.index-1].code})}>Anterior</button><span>{current.index+1} de {current.items.length}</span><button type="button" aria-label="Partida siguiente" disabled={disabled||current.index===current.items.length-1} onClick={()=>choose({code:current.items[current.index+1].code})}>Siguiente</button></div>
  <div className={styles.partida}><strong>{selected.code} · {selected.title}</strong></div>
  <div className={styles.views} role="group" aria-label="Vista de la partida">{views.map(([key,label])=><button type="button" key={key} data-partida-view={key} aria-pressed={current.tab===key} aria-controls={panelId} disabled={disabled} onClick={()=>choose({tab:key})}>{label}</button>)}</div>
  <div id={panelId} className={styles.content} role="region" aria-label={views.find(([key])=>key===current.tab)[1]+' de la fuente'}>
   {current.tab==='DIAGRAM'&&<>
    <h6>Distribución prevista · 48 semanas</h6>
    <p className={styles.scope}>Períodos ordinales del archivo; no son fechas ni avance ejecutado.</p>
    <div className={styles.weekChart}><svg viewBox="0 0 480 92" role="img" aria-labelledby={id+'-weeks-title '+id+'-weeks-description'}>
     <title id={id+'-weeks-title'}>Distribución prevista de {selected.code}</title><desc id={id+'-weeks-description'}>48 semanas ordinales, con escala de 0 a 100 por ciento. Un contorno punteado indica Sin dato; un valor cero conserva su rótulo en la tabla original.</desc>
     <line x1="0" x2="480" y1="64" y2="64" className={styles.weekBaseline}/>
     {selected.months.flatMap(month=>month.weeks.map(week=><g key={week.ordinal} data-source-week-bar={week.ordinal}><title>Semana {week.ordinal}: {planPartidaSourceShare(week.value)}</title>{week.value===null?<rect className={styles.weekMissing} x={(week.ordinal-1)*10+1} y="57" width="8" height="7"/>:<rect className={week.value===0?styles.weekZero:styles.weekValue} x={(week.ordinal-1)*10+1} y={week.value===0?63:64-week.value*52} width="8" height={week.value===0?1:week.value*52}/>}</g>))}
    </svg><div className={styles.nativeMonths} data-partida-native-months role="list" aria-label="Meses ordinales del diagrama">{selected.months.map(month=><span key={month.ordinal} role="listitem" data-partida-native-month={month.ordinal}>{month.ordinal}</span>)}</div><p className={styles.nativeAxis} data-partida-native-scale>Mes ordinal · escala 0–100 %</p></div>
    <details className={styles.provenance} data-partida-week-table><summary>Ver 12 meses y sus 48 valores</summary><div className={styles.tableScroll} role="region" aria-label="Distribución semanal original de la partida" tabIndex={0}><table className={styles.distribution}><caption>48 semanas ordinales · valores leídos del archivo</caption><thead><tr><th scope="col">Mes</th>{[1,2,3,4].map(week=><th key={week} scope="col">Semana {week}</th>)}</tr></thead><tbody>{selected.months.map(month=><tr key={month.ordinal}><th scope="row">Mes {month.ordinal}</th>{month.weeks.map(week=><td key={week.ordinal} data-source-week={week.ordinal}><span>{planPartidaSourceShare(week.value)}</span>{week.value!==null&&<span className={styles.shareTrack} aria-hidden="true"><span style={{width:(week.value*100)+'%'}}/></span>}</td>)}</tr>)}</tbody></table></div></details>
   </>}
   {current.tab==='CURVE'&&<>
    <p className={styles.scope}>Archivo completo. Elegir una partida no recalcula esta curva.</p>
    {view.curve?<PlanSourceCurve curve={view.curve} profile={view.profile} status={view.status} sourceRowCount={view.items.length} selectedRowCount={view.retainedCodes?.length} compact/>:<p className={styles.unavailable} data-partida-curve-unavailable>Este borrador físico no incluye una curva financiera. No se deduce inversión desde la distribución semanal; la fuente financiera se revisa por separado.</p>}
   </>}
   {current.tab==='QUANTITIES'&&<PlanPartidaBudgetPreview catalog={budgetCatalog} view={view} selected={selected} mayConsult={mayConsultMeasurement} disabled={disabled} onRead={onReadBudget} onRefresh={onConsultMeasurements}/>}
   {current.tab==='QUANTITIES'&&<PlanPartidaMeasurementPreview catalog={measurementCatalog} view={view} selected={selected} mayConsult={mayConsultMeasurement} disabled={disabled} onConsult={onConsultMeasurements}/>}
  </div>
  <details className={styles.provenance} data-partida-source-details><summary>Procedencia y selección de la partida</summary><p>Agrupador: {selected.parentCode}. {view.retainedCodes===null?'Selección del borrador sin comprobar.':retained?'Incluida en las filas del borrador.':'Fuera de las filas del borrador; el original se conserva.'} {view.items.length} partidas en la fuente completa.</p><p>{selected.sourceRange}</p><p>Archivo SHA-256: <code>{view.sourceSha256}</code></p><p>El avance registrado se consulta en el Gantt de la obra. Las correcciones del título, fechas, exclusiones y aprobaciones del borrador se deciden en el importador; esta consulta conserva los originales.</p></details>
 </section>;
}
