'use client';
import {useEffect,useRef,useState} from 'react';
import styles from './site-register-panel.module.css';
const endpoint='/api/identity/site-register',photoEndpoint='/api/identity/site-photo';
const tabs={PEOPLE:'Equipo de la obra',ISSUES:'Incidencias',MATERIALS:'Pedidos de materiales'};
const stateLabel={OPEN:'Pendiente',ACKNOWLEDGED:'En seguimiento',RESOLVED:'Resuelto',REJECTED:'Rechazado'};
const severityLabel={INFO:'Informativa',LOW:'Baja',MEDIUM:'Media',HIGH:'Alta',CRITICAL:'Crítica'};
const errors={SITE_PHONE_INVALID:'Usá el teléfono internacional con + y código de país, sin espacios.',SITE_PHONE_ALREADY_REGISTERED:'Ese teléfono ya figura en esta obra, incluso si el registro está inactivo. No se duplicó.',SITE_REVISION_CHANGED:'El registro cambió. Conservamos lo que escribiste; actualizá antes de volver a decidir.',SITE_REPORT_ALREADY_CLOSED:'El registro ya está cerrado. No se repitió la decisión.',SITE_INPUT_INVALID:'Revisá los campos y completá los detalles requeridos.',SITE_QUANTITY_INVALID:'Ingresá una cantidad positiva con hasta tres decimales y una unidad válida.',SITE_OPERATION_CONFLICT:'Este intento ya corresponde a otra solicitud. No se sobreescribió.',WORKSPACE_CONTEXT_CHANGED:'Cambió tu organización o permiso. Volvé a abrir la obra.',WORKSPACE_INTEGRATION_PERMISSION_REQUIRED:'Tu rol no permite administrar estos registros.',SITE_RECORD_NOT_SUPPORTED:'Este registro anterior necesita revisión antes de modificarlo.'};
const explain=code=>errors[code]||'No se pudo confirmar la operación. No se muestran registros de ejemplo.';
async function api(params,options={},resource='register'){
 const response=await fetch((resource==='photo'?photoEndpoint:endpoint)+(params?'?'+new URLSearchParams(params):''),{credentials:'same-origin',cache:'no-store',...options});
 const body=await response.json();if(!response.ok){const error=new Error(explain(body.code));error.status=response.status;throw error;}return body;
}
const blank=section=>section==='PEOPLE'?{action:'ADD_PERSON',payload:{name:'',phone:'',job:'WORKER'}}:section==='ISSUES'?{action:'REPORT_ISSUE',payload:{title:'',details:'',sector:'',severity:'MEDIUM'}}:{action:'REQUEST_MATERIAL',payload:{material:'',quantity:'',unit:'unidad',sector:'',details:''}};
export function SiteRegisterPanel({projectId,scope}){
 const [opened,setOpened]=useState(false),[section,setSection]=useState('PEOPLE'),[data,setData]=useState(null),[draft,setDraft]=useState(null),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[attempt,setAttempt]=useState(null),[receipt,setReceipt]=useState(null);
 const [readingPhoto,setReadingPhoto]=useState(false);
 const mounted=useRef(true),sequence=useRef(0),abort=useRef(null),photoSequence=useRef(0);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;abort.current?.abort();};},[]);
 async function load(next=section,append=false){
  if(busy||attempt)return;const current=++sequence.current;abort.current?.abort();const controller=new AbortController();abort.current=controller;
  setBusy(true);setOpened(true);setNotice('');setSection(next);if(!append){setData(null);setDraft(null);}
  try{const result=await api({projectId,scope,section:next,...(append&&data?.nextCursor?{after:data.nextCursor}:{})},{signal:controller.signal});
   if(!mounted.current||current!==sequence.current)return;if(result.scope!==scope||result.projectId!==projectId||result.section!==next)throw new Error('Respuesta de otra obra.');
   setData(previous=>append?{...result,records:[...(previous?.records||[]),...result.records]}:result);
  }catch(error){if(mounted.current&&current===sequence.current&&error.name!=='AbortError')setNotice(error.message);}finally{if(mounted.current&&current===sequence.current)setBusy(false);}
 }
 function edit(key,value){setDraft(previous=>({...previous,payload:{...previous.payload,[key]:value}}));}
 async function confirmed(result){
  if(result.scope!==scope||result.saved!==true||!result.receiptId||(!result.person&&!result.report&&!result.photo))throw new Error('El recibo no permite confirmar el registro.');
  setReceipt(result.receiptId);setAttempt(null);setDraft(null);setNotice(result.photo?'Fotografía privada adjunta con recibo. No se aprobó avance ni identidad.':result.person?'Ficha guardada con recibo. Los permisos y la identidad se verifican por separado.':'Registro guardado con recibo. Podés continuar su seguimiento desde esta obra.');
  try{const refreshed=await api({projectId,scope,section});if(mounted.current&&refreshed.scope===scope&&refreshed.projectId===projectId)setData(refreshed);}
  catch{if(mounted.current)setNotice('El guardado está confirmado. Actualizá el listado para ver los registros vigentes.');}
 }
 async function choosePhoto(event){
  const file=event.target.files?.[0],current=++photoSequence.current;setNotice('');setReadingPhoto(false);
  setDraft(previous=>previous?.action==='ATTACH_PHOTO'?{...previous,payload:{...previous.payload,image:''}}:previous);
  if(!file)return;
  if(file.size>2*1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type)){setNotice('Elegí una imagen JPEG, PNG o WebP de hasta 2 MB. No se subió ningún archivo.');return;}
  setReadingPhoto(true);
  const reader=new FileReader();reader.onload=()=>{if(mounted.current&&current===photoSequence.current){setDraft(previous=>previous?.action==='ATTACH_PHOTO'?{...previous,payload:{...previous.payload,image:reader.result}}:previous);setReadingPhoto(false);}};
  reader.onerror=()=>{if(mounted.current&&current===photoSequence.current){setNotice('No se pudo leer el archivo. No se subió.');setReadingPhoto(false);}};
  reader.readAsDataURL(file);
 }
 async function save(event){
  event.preventDefault();if(busy||readingPhoto||attempt||!draft)return;
  const isPhoto=draft.action==='ATTACH_PHOTO',operationId=crypto.randomUUID();
  const command=isPhoto?{operationId,projectId,scope,...draft.payload}:{operationId,projectId,scope,...draft};
  setAttempt({command,isPhoto});setBusy(true);setNotice('');setReceipt(null);
  try{const result=await api(null,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(isPhoto?45000:20000)},isPhoto?'photo':'register');if(mounted.current)await confirmed(result);}
  catch(error){if(mounted.current){if(error.status&&error.status<500){setAttempt(null);setNotice(error.message);}else setNotice('El resultado quedó sin confirmar. Comprobá el recibo antes de volver a guardar.');}}
  finally{if(mounted.current)setBusy(false);}
 }
 async function recover(){
  if(busy||!attempt)return;setBusy(true);
  const {command,isPhoto}=attempt;
  try{const result=await api({projectId,scope,operationId:command.operationId,...(isPhoto?{reportId:command.reportId}:{})},{signal:AbortSignal.timeout(15000)},isPhoto?'photo':'register');if(mounted.current){if(result.state==='RECORDED')await confirmed(result);else setNotice('Todavía no se observa un recibo. No se reenvió ni se declaró perdida la operación.');}}
  catch(error){if(mounted.current)setNotice(error.message);}finally{if(mounted.current)setBusy(false);}
 }
 const locked=busy||readingPhoto||Boolean(attempt),p=draft?.payload;
 return <section className={styles.panel} aria-labelledby="site-register-title">
  <div className={styles.heading}><div><p className={styles.eyebrow}>GESTIÓN DE LA OBRA</p><h3 id="site-register-title">Equipo, incidencias y materiales</h3></div><button type="button" disabled={locked} onClick={()=>load()}>Abrir registro</button></div>
  <p className={styles.intro}>Registros de esta obra cargados por sus responsables. Dar de alta una persona no verifica su identidad ni le habilita WhatsApp, fichajes o acceso al sistema.</p>
  <p role="status" aria-live="polite" className={notice?styles.notice:styles.silent}>{notice}</p>
  {opened&&<><nav className={styles.tabs} aria-label="Registros de obra">{Object.entries(tabs).map(([key,label])=><button type="button" key={key} aria-pressed={section===key} disabled={locked} onClick={()=>load(key)}>{label}</button>)}</nav>
   {busy&&!data&&<p>Consultando registros autorizados…</p>}
   {data&&<><div className={styles.toolbar}><span>{data.records.length} de {data.total} registros</span><button type="button" disabled={locked} onClick={()=>{setDraft(blank(section));setReceipt(null);setNotice('');}}>{section==='PEOPLE'?'Agregar persona':section==='ISSUES'?'Registrar incidencia':'Solicitar material'}</button><button type="button" disabled={locked} onClick={()=>load()}>Actualizar registro</button></div>
    {!data.records.length&&<p className={styles.empty}>Todavía no hay registros de este tipo. No se crearon datos de ejemplo.</p>}
    <div className={styles.list}>{data.records.map(record=><article key={record.id} className={styles.card}>
     {section==='PEOPLE'?<><div className={styles.cardHeader}><strong>{record.name}</strong><span>{record.active?'En nómina de obra':'Inactivo'}</span></div><p>{record.roleLabel||'Función sin indicar'} · {record.phone}</p><small>Identidad y canal pendientes de verificación.</small>{record.editable&&<button type="button" disabled={locked} onClick={()=>setDraft({action:'SET_PERSON_ACTIVE',payload:{personId:record.id,revision:record.revision,active:!record.active,reason:''}})}>{record.active?'Dar de baja en esta obra':'Reactivar registro'}</button>}</>:
      <><div className={styles.cardHeader}><strong>{record.title}</strong><span>{stateLabel[record.state]||record.state}</span></div><p>{record.sector}{record.type==='MATERIAL_REQUEST'?` · ${record.quantity} ${record.unit}`:` · Prioridad ${severityLabel[record.severity]||record.severity}`}</p><p className={styles.detail}>{record.details}</p>{(record.photos||[]).length>0&&<div className={styles.photos}>{record.photos.map((photo,index)=><a key={photo.id} href={photoEndpoint+'?'+new URLSearchParams({projectId,scope,reportId:record.id,photoId:photo.id})}>Descargar foto {index+1} · {Math.ceil(photo.bytes/1024)} KB</a>)}</div>}{['OPEN','ACKNOWLEDGED'].includes(record.state)&&(record.photos||[]).length<10&&<button type="button" disabled={locked} onClick={()=>setDraft({action:'ATTACH_PHOTO',payload:{reportId:record.id,revision:record.revision,image:''}})}>Adjuntar foto privada</button>}{record.review&&<small>Última decisión: {stateLabel[record.review.decision]}. {record.review.reason}</small>}{['OPEN','ACKNOWLEDGED'].includes(record.state)&&<button type="button" disabled={locked} onClick={()=>setDraft({action:'REVIEW_REPORT',payload:{reportId:record.id,revision:record.revision,decision:record.state==='OPEN'?'ACKNOWLEDGED':'RESOLVED',reason:''}})}>Gestionar registro</button>}</>}
    </article>)}</div>
    {data.nextCursor&&<button type="button" disabled={locked} onClick={()=>load(section,true)}>Cargar más registros</button>}
    {section==='MATERIALS'&&<p className={styles.note}>Un pedido no es una orden de compra. Su seguimiento no mueve inventario, autoriza gastos ni certifica una entrega física.</p>}
    {draft&&<form className={styles.form} onSubmit={save} aria-label="Editar registro de obra">
     {draft.action==='ATTACH_PHOTO'&&<><h4>Adjuntar fotografía privada</h4><p>JPEG, PNG o WebP, hasta 2 MB. No adjuntes documentos de identidad: esta es evidencia del registro, no un trámite de KYC. La carga no certifica cantidades ni avance.</p><label>Fotografía<input type="file" accept="image/jpeg,image/png,image/webp" required disabled={locked} onChange={choosePhoto}/></label>{readingPhoto&&<p>Leyendo el archivo…</p>}</>}
     {draft.action==='ADD_PERSON'&&<><h4>Registrar una persona de la obra</h4><label>Nombre<input required minLength={2} maxLength={100} value={p.name} disabled={locked} onChange={e=>edit('name',e.target.value)}/></label><label>Teléfono internacional<input required type="tel" placeholder="+549…" pattern="\+[1-9][0-9]{7,14}" value={p.phone} disabled={locked} onChange={e=>edit('phone',e.target.value)}/></label><label>Función en obra<select value={p.job} disabled={locked} onChange={e=>edit('job',e.target.value)}>{Object.entries(data.roles).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><p>La función declarada no otorga permisos de administrador, acceso ni KYC aprobado.</p></>}
     {draft.action==='SET_PERSON_ACTIVE'&&<><h4>{p.active?'Reactivar registro':'Dar de baja en esta obra'}</h4><p>Se conserva el historial. No se borran registros ni se conceden permisos a la cuenta.</p></>}
     {draft.action==='REPORT_ISSUE'&&<><h4>Nueva incidencia</h4><label>Título<input required minLength={3} maxLength={160} value={p.title} disabled={locked} onChange={e=>edit('title',e.target.value)}/></label><label>Prioridad<select value={p.severity} disabled={locked} onChange={e=>edit('severity',e.target.value)}>{Object.entries(severityLabel).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label></>}
     {draft.action==='REQUEST_MATERIAL'&&<><h4>Pedido de materiales</h4><label>Material<input required minLength={2} maxLength={160} value={p.material} disabled={locked} onChange={e=>edit('material',e.target.value)}/></label><div className={styles.columns}><label>Cantidad<input required inputMode="decimal" pattern="[0-9]{1,9}(\.[0-9]{1,3})?" value={p.quantity} disabled={locked} onChange={e=>edit('quantity',e.target.value)}/></label><label>Unidad<select value={p.unit} disabled={locked} onChange={e=>edit('unit',e.target.value)}>{data.units.map(unit=><option key={unit}>{unit}</option>)}</select></label></div></>}
     {['REPORT_ISSUE','REQUEST_MATERIAL'].includes(draft.action)&&<><label>Sector<input required minLength={2} maxLength={100} value={p.sector} disabled={locked} onChange={e=>edit('sector',e.target.value)}/></label><label>Detalle<textarea required minLength={8} maxLength={2000} rows={3} value={p.details} disabled={locked} onChange={e=>edit('details',e.target.value)}/></label></>}
     {draft.action==='REVIEW_REPORT'&&<><h4>Gestión del registro</h4><label>Estado<select value={p.decision} disabled={locked} onChange={e=>edit('decision',e.target.value)}>{Object.entries(stateLabel).filter(([key])=>key!=='OPEN').map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label></>}
     {['SET_PERSON_ACTIVE','REVIEW_REPORT'].includes(draft.action)&&<label>Motivo<textarea required minLength={8} maxLength={500} rows={3} value={p.reason} disabled={locked} onChange={e=>edit('reason',e.target.value)}/></label>}
     <div className={styles.actions}>{attempt?<button type="button" disabled={busy} onClick={recover}>Comprobar guardado</button>:<><button type="submit" disabled={busy||readingPhoto||(draft.action==='ATTACH_PHOTO'&&!p.image)}>Guardar registro</button><button type="button" disabled={locked} onClick={()=>setDraft(null)}>Cancelar</button></>}</div>
    </form>}
    {receipt&&<p className={styles.receipt}>Recibo confirmado: <code>{receipt}</code></p>}
   </>}
  </>}
 </section>;
}
