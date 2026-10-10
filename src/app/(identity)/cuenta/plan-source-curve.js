'use client';
import {useId,useRef,useState} from 'react';
import {formatSourceCurveDecimal,planSourceCurveView,sourceCurveKeyboardIndex} from './plan-source-curve.mjs';
import styles from './plan-source-curve.module.css';

const columns=[['monthlyAmount','Importe mensual previsto'],['cumulativeAmount','Importe acumulado previsto'],['monthlyPercentage','Porcentaje mensual previsto'],['cumulativePercentage','Porcentaje acumulado previsto']];
const label=(cell,percentage=false)=>formatSourceCurveDecimal(cell.cachedValue,{percentage});

export function PlanSourceCurve({curve,status,sourceRowCount,selectedRowCount}){
 const id=useId(),controls=useRef([]),[selected,setSelected]=useState(0);
 let view;try{view=planSourceCurveView(curve);}catch{return <p className={styles.unavailable} role="status">No se puede mostrar la curva prevista: faltan valores originales válidos del archivo.</p>;}
 if(!view)return null;
 const index=Math.min(selected,view.periods.length-1),period=view.periods[index],point=view.points[index];
 const counts=Number.isSafeInteger(sourceRowCount)&&sourceRowCount>0&&Number.isSafeInteger(selectedRowCount)&&selectedRowCount>=0&&selectedRowCount<=sourceRowCount;
 function keyboard(event,current){
  const next=sourceCurveKeyboardIndex(event.key,current,view.periods.length);
  if(next!==null){event.preventDefault();setSelected(next);controls.current[next]?.focus();}
  else if(event.key==='Enter'||event.key===' '){event.preventDefault();setSelected(current);controls.current[current]?.focus();}
 }
 const originalCells=[['Total previsto',view.total],['Acumulado inicial (antes del mes 1)',view.initialCumulative],...view.periods.flatMap(month=>columns.map(([field,title])=>[`Mes ${month.ordinal} · ${title}`,month[field]]))];
 return <section className={styles.panel} aria-labelledby={`${id}-heading`}>
  <div className={styles.heading}><h5 id={`${id}-heading`}>Inversión prevista del archivo</h5><span className={styles.currency}>Moneda por confirmar</span></div>
  <p className={styles.context}>Fuente completa del archivo. Se muestran los valores guardados, sin recalcular fórmulas. Los meses son ordinales, sin fechas calendario.</p>
  {counts&&<p className={styles.context}>Fuente original: {sourceRowCount} {sourceRowCount===1?'rubro':'rubros'}. Tareas elegidas: {selectedRowCount}. La selección de tareas no recalcula esta curva.</p>}
  {status==='APPLIED'&&<p className={styles.context}>Esta curva conserva la previsión del archivo original del plan aplicado.</p>}
  <dl className={styles.totals}><div><dt>Total previsto del archivo</dt><dd>{label(view.total)}</dd></div><div><dt>Acumulado inicial, antes del mes 1</dt><dd>{label(view.initialCumulative)}</dd></div></dl>
  <div className={styles.chart}>
   <svg viewBox="0 0 900 310" role="group" aria-labelledby={`${id}-chart-title ${id}-chart-description`}>
    <title id={`${id}-chart-title`}>Porcentaje acumulado previsto del archivo</title><desc id={`${id}-chart-description`}>Meses ordinales. Los datos ausentes interrumpen la línea. Elegí un mes para consultar sus valores. También podés usar los botones de mes con las flechas, Inicio y Fin.</desc>
    {[0,.25,.5,.75,1].map(value=><g key={value} className={styles.grid} aria-hidden="true"><line x1="50" x2="850" y1={254-220*value} y2={254-220*value}/><text x="40" y={259-220*value} textAnchor="end">{value*100}%</text></g>)}
    <line className={styles.selectionLine} x1={point.x} x2={point.x} y1="34" y2="254" aria-hidden="true"/>
    {view.segments.filter(segment=>segment.length>1).map(segment=><polyline key={segment[0].ordinal} className={styles.curve} points={segment.map(p=>`${p.x},${p.y}`).join(' ')} aria-hidden="true"/>)}
    {view.points.map((p,i)=><g key={p.ordinal} role="button" tabIndex={-1} aria-label={`Mes ${p.ordinal}: porcentaje acumulado previsto ${label(view.periods[i].cumulativePercentage,true)}`} aria-pressed={i===index} onPointerEnter={()=>setSelected(i)} onClick={()=>{setSelected(i);controls.current[i]?.focus();}} onKeyDown={event=>keyboard(event,i)}>
     <rect x={p.x-22} y="30" width="44" height="260" fill="transparent"/>
     {p.y!==null&&<circle className={i===index?styles.selectedPoint:styles.point} cx={p.x} cy={p.y} r={i===index?7:5} aria-hidden="true"/>}
     <text className={styles.monthLabel} x={p.x} y="284" textAnchor="middle" aria-hidden="true">{p.ordinal}</text>
    </g>)}
   </svg>
  </div>
  <p className={styles.axisLabel}>Mes ordinal · porcentaje acumulado previsto</p>
  <div className={styles.months} role="group" aria-label="Elegir mes ordinal. Usá las flechas, Inicio o Fin.">
   {view.periods.map((month,i)=><button key={month.ordinal} ref={node=>{controls.current[i]=node;}} type="button" className={i===index?styles.selectedMonth:styles.month} aria-pressed={i===index} aria-controls={`${id}-selected`} tabIndex={i===index?0:-1} onFocus={()=>setSelected(i)} onClick={()=>setSelected(i)} onKeyDown={event=>keyboard(event,i)}>Mes {month.ordinal}</button>)}
  </div>
  <div id={`${id}-selected`} className={styles.selected} role="region" aria-label={`Valores previstos del mes ${period.ordinal}`}>
   <h6>Mes {period.ordinal}</h6><dl>{columns.map(([field,title])=><div key={field}><dt>{title}</dt><dd>{label(period[field],field.endsWith('Percentage'))}</dd></div>)}</dl>
  </div>
  <p className={styles.context}>No se importaron datos de inversión ejecutada para comparar. Esta previsión no acredita gastos, certificaciones ni avance físico.</p>
  <div className={styles.tableScroll} role="region" aria-label="Tabla completa de inversión prevista" tabIndex={0}>
   <table className={styles.table}><caption>Valores previstos del archivo completo · meses ordinales · moneda por confirmar</caption><thead><tr><th scope="col">Mes</th>{columns.map(([field,title])=><th key={field} scope="col">{title}</th>)}</tr></thead><tbody>{view.periods.map(month=><tr key={month.ordinal}><th scope="row">Mes {month.ordinal}</th>{columns.map(([field])=><td key={field}>{label(month[field],field.endsWith('Percentage'))}</td>)}</tr>)}</tbody></table>
  </div>
  <details className={styles.originals}><summary>Valores y referencias originales del archivo</summary><p>Los valores originales conservan todos sus decimales. Una celda sin dato no se interpreta como cero.</p><div className={styles.tableScroll} role="region" aria-label="Valores originales y celdas de la fuente" tabIndex={0}><table className={styles.table}><caption>Procedencia de los valores guardados del archivo</caption><thead><tr><th scope="col">Valor previsto</th><th scope="col">Celda de origen</th><th scope="col">Valor original</th><th scope="col">Origen del valor</th></tr></thead><tbody>{originalCells.map(([title,cell])=><tr key={title}><th scope="row">{title}</th><td>{cell.sourceCell}</td><td><code>{cell.cachedValue??'Sin dato'}</code></td><td>{cell.hasFormula?'Valor guardado de una fórmula':'Valor de la celda'}</td></tr>)}</tbody></table></div></details>
 </section>;
}
