'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {formatSourceCurveDecimal,planSourceCurveView,sourceCurveKeyboardIndex,planDocumentCurveView,documentCurveKeyboardIndex,documentCurvePlot,DOCUMENT_CURVE_PROFILE,PLAN_CYP_INVESTMENT_PROFILE,planInvestmentCurveView,investmentWeeklyPlot,investmentWeekKeyboardIndex} from './plan-source-curve.mjs';
import styles from './plan-source-curve.module.css';

const columns=[['monthlyAmount','Importe mensual previsto'],['cumulativeAmount','Importe acumulado previsto'],['monthlyPercentage','Porcentaje mensual previsto'],['cumulativePercentage','Porcentaje acumulado previsto']];
const label=(cell,percentage=false)=>formatSourceCurveDecimal(cell.cachedValue,{percentage});

export function PlanSourceCurve({curve,status,sourceRowCount,selectedRowCount,profile='MONTHLY_RUBROS_CURVE',presentation='import'}){
 const id=useId(),controls=useRef([]),[selected,setSelected]=useState(0);
 if(profile===PLAN_CYP_INVESTMENT_PROFILE)return <InvestmentSourceCurves curve={curve} status={status} presentation={presentation}/>;
 if(profile===DOCUMENT_CURVE_PROFILE)return <DocumentSourceCurve curve={curve} status={status} presentation={presentation}/>;
 let view;try{view=planSourceCurveView(curve,{profile});}catch{return <p className={styles.unavailable} role="status">No se puede mostrar la curva prevista: faltan valores originales válidos del archivo.</p>;}
 if(!view)return null;
 const index=Math.min(selected,view.periods.length-1),period=view.periods[index],point=view.points[index];
 const counts=Number.isSafeInteger(sourceRowCount)&&sourceRowCount>0&&Number.isSafeInteger(selectedRowCount)&&selectedRowCount>=0&&selectedRowCount<=sourceRowCount;
 const compact=presentation==='baseline';
 function keyboard(event,current){
  const next=sourceCurveKeyboardIndex(event.key,current,view.periods.length);
  if(next!==null){event.preventDefault();setSelected(next);controls.current[next]?.focus();}
  else if(event.key==='Enter'||event.key===' '){event.preventDefault();setSelected(current);controls.current[current]?.focus();}
 }
 const originalCells=[['Total previsto',view.total],['Acumulado inicial (antes del mes 1)',view.initialCumulative],...view.periods.flatMap(month=>columns.map(([field,title])=>[`Mes ${month.ordinal} · ${title}`,month[field]]))];
 const completeTable=<div className={styles.tableScroll} role="region" aria-label="Tabla completa de inversión prevista" tabIndex={0}>
   <table className={styles.table}><caption>Valores previstos del archivo completo · meses ordinales · moneda por confirmar</caption><thead><tr><th scope="col">Mes</th>{columns.map(([field,title])=><th key={field} scope="col">{title}</th>)}</tr></thead><tbody>{view.periods.map(month=><tr key={month.ordinal}><th scope="row">Mes {month.ordinal}</th>{columns.map(([field])=><td key={field}>{label(month[field],field.endsWith('Percentage'))}</td>)}</tr>)}</tbody></table>
  </div>;
 return <section className={styles.panel} aria-labelledby={`${id}-heading`}>
  <div className={styles.heading}><h5 id={`${id}-heading`}>Inversión prevista del archivo</h5><span className={styles.currency}>Moneda por confirmar</span></div>
  <p className={styles.context}>{compact?`${view.periods.length} meses ordinales · calendario por confirmar · previsión de la fuente completa.`:'Fuente completa del archivo. Se muestran los valores guardados, sin recalcular fórmulas. Los meses son ordinales, sin fechas calendario.'}</p>
  {counts&&<p className={styles.context}>Fuente original: {sourceRowCount} {profile==='CYP_PARTIDAS_CURVE'?(sourceRowCount===1?'partida física':'partidas físicas'):(sourceRowCount===1?'rubro':'rubros')}. Tareas elegidas: {selectedRowCount}.{!compact&&' La selección de tareas no recalcula esta curva.'}</p>}
  {!compact&&profile==='CYP_PARTIDAS_CURVE'&&<p className={styles.context}>La curva conserva el presupuesto completo del archivo, incluidos sus costos adicionales. Esos costos no se convierten en tareas físicas.</p>}
  {!compact&&status==='APPLIED'&&<p className={styles.context}>Esta curva conserva la previsión del archivo original del plan aplicado.</p>}
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
  {compact?<details className={styles.originals}><summary>Tabla de inversión de todos los meses</summary>{completeTable}</details>:completeTable}
  <details className={styles.originals}><summary>Valores y referencias originales del archivo</summary>{compact&&<><p>Se conservan los valores guardados del archivo, sin recalcular fórmulas ni ajustar la curva por las tareas elegidas.</p>{profile==='CYP_PARTIDAS_CURVE'&&<p>La previsión incluye el presupuesto completo y sus costos adicionales; esos costos no son tareas físicas.</p>}</>}<p>Los valores originales conservan todos sus decimales. Una celda sin dato no se interpreta como cero.</p><div className={styles.tableScroll} role="region" aria-label="Valores originales y celdas de la fuente" tabIndex={0}><table className={styles.table}><caption>Procedencia de los valores guardados del archivo</caption><thead><tr><th scope="col">Valor previsto</th><th scope="col">Celda de origen</th><th scope="col">Valor original</th><th scope="col">Origen del valor</th></tr></thead><tbody>{originalCells.map(([title,cell])=><tr key={title}><th scope="row">{title}</th><td>{cell.sourceCell}</td><td><code>{cell.cachedValue??'Sin dato'}</code></td><td>{cell.hasFormula?'Valor guardado de una fórmula':'Valor de la celda'}</td></tr>)}</tbody></table></div></details>
 </section>;
}

export function InvestmentSourceCurves({curve,status,presentation='import'}){
 const id=useId(),[mode,setMode]=useState('WEEK'),[selected,setSelected]=useState(0),controls=useRef([]),keyboardFocus=useRef(false);
 useEffect(()=>{if(keyboardFocus.current){controls.current[selected]?.focus();keyboardFocus.current=false;}},[selected]);
 let view;try{view=planInvestmentCurveView(curve);}catch{return <p className={styles.unavailable} role="status">No pudimos confirmar la inversión mensual y semanal de esta fuente.</p>;}
 const plot=investmentWeeklyPlot(view),period=view.weekly.periods[selected],month=Math.floor(selected/4),different=view.comparison.status==='DIFFERENT';
 const completeTable=<div className={styles.tableScroll} role="region" aria-label="Importes de las 48 semanas previstas" tabIndex={0}><table className={styles.table}><caption>Importes previstos originales · 12 grupos de cuatro semanas</caption><thead><tr><th scope="col">Período</th><th scope="col">Importe previsto</th><th scope="col">Celda original</th><th scope="col">Valor guardado</th></tr></thead><tbody>{view.weekly.periods.map(p=><tr key={p.ordinal}><th scope="row">Mes {p.monthOrdinal} · semana {p.weekInMonth}</th><td>{label(p.amount)}</td><td>{p.amount.sourceCell}</td><td><code>{p.amount.cachedValue}</code></td></tr>)}</tbody></table></div>;
 function keyboard(event){const next=investmentWeekKeyboardIndex(event.key,selected);if(next!==null){event.preventDefault();keyboardFocus.current=true;if(next===selected){controls.current[next]?.focus();keyboardFocus.current=false;}else setSelected(next);}}
 return <section className={styles.panel} aria-labelledby={`${id}-heading`} data-investment-curves>
  <div className={styles.heading}><h5 id={`${id}-heading`}>Inversión prevista</h5><span className={styles.currency}>Moneda por confirmar</span></div>
  <p className={styles.context}>Previsión original del archivo. Los meses y las semanas son ordinales; todavía no tienen fechas de calendario.</p>
  <div className={styles.months} role="group" aria-label="Vista de la inversión"><button type="button" aria-pressed={mode==='WEEK'} className={mode==='WEEK'?styles.selectedMonth:styles.month} onClick={()=>setMode('WEEK')}>Semanas</button><button type="button" aria-pressed={mode==='MONTH'} className={mode==='MONTH'?styles.selectedMonth:styles.month} onClick={()=>setMode('MONTH')}>Meses</button></div>
  {different&&<div className={styles.unavailable} role="note"><strong>La suma semanal y el total declarado no coinciden</strong><p>Suma de los 48 períodos: {formatSourceCurveDecimal(view.comparison.weeklySumDecimalText)}. Total declarado: {formatSourceCurveDecimal(view.comparison.totalDecimalText)}. Diferencia exacta (suma menos total): {formatSourceCurveDecimal(view.comparison.differenceDecimalText)}.</p><p>Se conservan ambos valores. La revisión debe dejar constancia de esta diferencia; no se presenta como una suma conciliada.</p></div>}
  {mode==='MONTH'?<PlanSourceCurve curve={view.monthly} profile="CYP_PARTIDAS_CURVE" status={status} presentation={presentation}/>:<>
   <dl className={styles.totals}><div><dt>Total declarado en el archivo</dt><dd>{label(view.weekly.total)}</dd></div><div><dt>Suma exacta de los períodos semanales</dt><dd>{formatSourceCurveDecimal(view.comparison.weeklySumDecimalText)}</dd></div></dl>
   <p className={styles.context}>Importe previsto por semana · escala visual de 0 a {formatSourceCurveDecimal(plot.maximumRaw)}. Cada rótulo conserva el valor original.</p>
   <div className={styles.chart}><svg viewBox="0 0 900 310" role="img" aria-labelledby={`${id}-chart-title ${id}-chart-description`}><title id={`${id}-chart-title`}>Inversión semanal prevista · 48 períodos ordinales</title><desc id={`${id}-chart-description`}>Importes guardados del archivo, sin inversión ejecutada. Consultá cada período con el selector de mes y los botones de semana.</desc>{[0,.25,.5,.75,1].map(v=><g key={v} className={styles.grid} aria-hidden="true"><line x1="50" x2="850" y1={254-220*v} y2={254-220*v}/></g>)}<polyline className={styles.curve} points={plot.points.map(p=>`${p.x},${p.y}`).join(' ')} aria-hidden="true"/><line className={styles.selectionLine} x1={plot.points[selected].x} x2={plot.points[selected].x} y1="34" y2="254" aria-hidden="true"/>{plot.points.map((p,i)=><g key={p.ordinal} aria-hidden="true"><circle className={i===selected?styles.selectedPoint:styles.point} cx={p.x} cy={p.y} r={i===selected?7:3}/>{(i%4===0||i===47)&&<text className={styles.monthLabel} x={p.x} y="284" textAnchor="middle">{p.ordinal}</text>}</g>)}</svg></div>
   <label className={styles.documentSeries}>Mes del plan<select aria-label="Mes del plan semanal" value={month} onChange={event=>setSelected(Number(event.target.value)*4+selected%4)}>{Array.from({length:12},(_,i)=><option key={i} value={i}>Mes {i+1}</option>)}</select></label>
   <div className={styles.months} role="group" aria-label="Elegir semana. Flechas para recorrer los 48 períodos; Inicio y Fin.">{view.weekly.periods.slice(month*4,month*4+4).map(p=><button key={p.ordinal} type="button" ref={node=>{controls.current[p.ordinal-1]=node;}} className={selected===p.ordinal-1?styles.selectedMonth:styles.month} tabIndex={selected===p.ordinal-1?0:-1} aria-pressed={selected===p.ordinal-1} aria-controls={`${id}-selected`} onFocus={()=>setSelected(p.ordinal-1)} onClick={()=>setSelected(p.ordinal-1)} onKeyDown={keyboard}>Semana {p.weekInMonth}</button>)}</div>
   <div id={`${id}-selected`} className={styles.selected} role="region" aria-live="polite" aria-label={`Período ${period.ordinal} de 48`}><h6>Mes {period.monthOrdinal} · semana {period.weekInMonth}</h6><p>Período {period.ordinal} de 48</p><dl><div><dt>Importe previsto original</dt><dd>{label(period.amount)}</dd></div><div><dt>Celda de origen</dt><dd>{period.amount.sourceCell}</dd></div></dl></div>
   <details className={styles.originals}><summary>Consultar los 48 períodos y sus valores originales</summary>{completeTable}<p>Los importes proceden de valores guardados; no se ejecutan las fórmulas. Encabezados del período seleccionado: {period.monthHeaderCell} y {period.weekHeaderCell}. Total: {view.weekly.total.sourceCell}. La denominación «Certificado semanal ($)» pertenece al modelo y no acredita una certificación operativa.</p></details>
  </>}
  <p className={styles.context}>Esta previsión no registra pagos, gastos, certificaciones ni avance físico. Su aprobación conserva una fuente financiera y la elección de línea base se confirma por separado.</p>
 </section>;
}

export function DocumentCurveEvidence({evidence=[]}){
 return <ul className={styles.documentEvidence}>{evidence.length?evidence.map((item,index)=><li key={index}><strong>Página {item.page}</strong><p>{item.quote}</p>{item.bbox&&<small>Zona propuesta: {item.bbox.join(' · ')}. Comparala con el archivo.</small>}</li>):<li>Sin referencia legible. Conservá esta observación al revisar.</li>}</ul>;
}

export function DocumentSourceCurve({curve,status,presentation='import'}){
 const id=useId(),controls=useRef([]),[selected,setSelected]=useState(0),[series,setSeries]=useState(null);
 let view;try{view=planDocumentCurveView(curve);}catch{return <p className={styles.unavailable} role="status">No pudimos confirmar la lectura financiera de este documento.</p>;}
 if(!view)return null;
 const plot=documentCurvePlot(curve,{series}),seriesTitle=Object.fromEntries(columns),index=Math.min(selected,view.periods.length-1),period=view.periods[index],point=plot.points[index],compact=presentation==='baseline';
 const amount=(field,percentage=false)=>formatSourceCurveDecimal(field.decimalText,{percentage});
 function keyboard(event,current){const next=documentCurveKeyboardIndex(event.key,current,view.periods.length);if(next!==null){event.preventDefault();setSelected(next);controls.current[next]?.focus();}}
 const originals=[['Total previsto',view.total],['Acumulado inicial',view.initialCumulative],...view.periods.flatMap(month=>columns.map(([field,title])=>[`Mes ${month.ordinal} · ${title}`,month[field]]))];
 return <section className={styles.panel} aria-labelledby={`${id}-heading`} data-document-curve>
  <div className={styles.heading}><h5 id={`${id}-heading`}>Inversión mensual prevista</h5><span className={styles.currency}>{view.currency.code?`${status==='APPLIED'?'Moneda revisada':'Moneda propuesta'}: ${view.currency.code}`:'Moneda por confirmar'}</span></div>
  <p className={styles.context}>{compact?'Previsión del documento revisado.':'Lectura propuesta del documento: compará cada dato con el archivo.'} {view.periods.length} meses ordinales. Sólo se muestran fechas cuando el año figura en la fuente y quedó registrado.</p>
  <p className={styles.context}>Documento financiero. Esta aprobación no crea tareas ni selecciona una línea base automáticamente.</p>
  <p className={view.coherence.status==='INCONSISTENT'?styles.unavailable:styles.context}>{view.coherence.status==='INCONSISTENT'?'Los importes no coinciden. Corregí la lectura comparándola con el archivo.':view.coherence.status==='INCOMPLETE'?'Hay datos sin confirmar. Los faltantes interrumpen la curva; no se completan con estimaciones.':'Los valores conocidos son coherentes entre sí. Esto no reemplaza la revisión del archivo.'}</p>
  {view.coherence.checks.some(check=>check.status==='MATCH_PRINTED_PRECISION')&&<p className={styles.context}>Los porcentajes respetan la precisión impresa; los importes se conservan.</p>}
  <details className={styles.originals}><summary>Comparaciones de importes y meses</summary><ul>{view.coherence.checks.filter(check=>['MISMATCH','INCOMPLETE'].includes(check.status)).map((check,i)=><li key={i}>{check.ordinal?`Mes ${check.ordinal}: `:''}{({MONTHLY_TOTAL:'total y suma mensual',CUMULATIVE_AMOUNT:'importe acumulado',CUMULATIVE_MONOTONIC:'orden de acumulados',MONTHLY_PERCENTAGE:'porcentaje mensual',CUMULATIVE_PERCENTAGE:'porcentaje acumulado',CUMULATIVE_PERCENTAGE_MONOTONIC:'orden de porcentajes acumulados',FINAL_TOTAL:'total final',CALENDAR_SEQUENCE:'secuencia de meses'})[check.kind]} · {check.status==='MISMATCH'?'los valores no coinciden':'faltan datos para comparar'}</li>)}</ul></details>
  <dl className={styles.totals}><div><dt>Total previsto leído</dt><dd>{amount(view.total)}</dd></div><div><dt>Acumulado inicial leído</dt><dd>{amount(view.initialCumulative)}</dd></div></dl>
  <label className={styles.documentSeries}>Serie prevista del documento<select value={plot.series} onChange={event=>setSeries(event.target.value)}>{columns.map(([field,title])=><option key={field} value={field} disabled={!plot.available.includes(field)}>{title}</option>)}</select></label>
  <p className={styles.context}>{seriesTitle[plot.series]} · {plot.percentage?'escala de 0 a 100%':`escala visual de 0 a ${formatSourceCurveDecimal(plot.maximumRaw)}`}. Los rótulos conservan los valores exactos de la fuente.</p>
  {!plot.available.length&&<p className={styles.unavailable}>No hay una serie mensual legible para trazar. Un total aislado no permite dibujar una curva.</p>}
  <div className={styles.chart}><svg viewBox="0 0 900 310" role="img" aria-labelledby={`${id}-chart-title ${id}-chart-description`}><title id={`${id}-chart-title`}>{seriesTitle[plot.series]+' del documento'}</title><desc id={`${id}-chart-description`}>Los datos ausentes interrumpen la línea. La escala visual no cambia los valores guardados y no representa inversión ejecutada.</desc>{[0,.25,.5,.75,1].map(value=><g key={value} className={styles.grid} aria-hidden="true"><line x1="50" x2="850" y1={254-220*value} y2={254-220*value}/>{plot.percentage&&<text x="40" y={259-220*value} textAnchor="end">{value*100}%</text>}</g>)}{plot.segments.filter(segment=>segment.length>1).map(segment=><polyline key={segment[0].ordinal} className={styles.curve} points={segment.map(p=>`${p.x},${p.y}`).join(' ')} aria-hidden="true"/>)}<line className={styles.selectionLine} x1={point.x} x2={point.x} y1="34" y2="254" aria-hidden="true"/>{plot.points.map((p,i)=>p.y===null?null:<circle key={p.ordinal} className={i===index?styles.selectedPoint:styles.point} cx={p.x} cy={p.y} r={i===index?7:5} aria-hidden="true"/>)}</svg></div>
  <div className={styles.months} role="group" aria-label="Elegir mes del documento. Usá las flechas, Inicio o Fin.">{view.periods.map((month,i)=><button key={month.ordinal} ref={node=>{controls.current[i]=node;}} type="button" className={i===index?styles.selectedMonth:styles.month} aria-pressed={i===index} aria-controls={`${id}-selected`} tabIndex={i===index?0:-1} onFocus={()=>setSelected(i)} onClick={()=>setSelected(i)} onKeyDown={event=>keyboard(event,i)}>Mes {month.ordinal}</button>)}</div>
  <div id={`${id}-selected`} className={styles.selected} role="region" aria-label={`Lectura del mes ${period.ordinal}`}><h6>Mes {period.ordinal} · {period.label}</h6><p>{period.calendarMonth?`Mes de calendario leído: ${period.calendarMonth}`:'Año o mes calendario sin confirmar.'}</p><dl>{columns.map(([field,title])=><div key={field}><dt>{title}</dt><dd>{amount(period[field],field.endsWith('Percentage'))}</dd></div>)}</dl></div>
  <p className={styles.context}>Sin inversión ejecutada, certificaciones o avance físico para comparar.</p>
  <details className={styles.originals}><summary>Valores y páginas del documento</summary><p>Los decimales originales se conservan. «Sin dato» es distinto de cero.</p><div className={styles.tableScroll} role="region" aria-label="Datos financieros y procedencia" tabIndex={0}><table className={styles.table}><caption>Lectura financiera revisable, sin celdas de Excel</caption><thead><tr><th scope="col">Dato</th><th scope="col">Lectura</th><th scope="col">Texto y procedencia</th><th scope="col">Observación</th></tr></thead><tbody>{originals.map(([title,field])=><tr key={title}><th scope="row">{title}</th><td><code>{field.decimalText??'Sin dato'}</code></td><td><p>{field.rawText??'Sin texto legible'}</p><DocumentCurveEvidence evidence={field.evidence}/></td><td>{field.uncertainty||'Sin duda indicada; comparar con la fuente.'}</td></tr>)}</tbody></table></div><h6>Moneda propuesta</h6><p>{view.currency.rawText??'Sin moneda explícita'}</p><DocumentCurveEvidence evidence={view.currency.evidence}/></details>
 </section>;
}
