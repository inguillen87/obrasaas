'use client';
import {useEffect,useRef,useState} from 'react';
import {useWorkspaceRequest} from './workspace-request-lifecycle';
import {PrivateWorkspaceDownload} from './private-workspace-download';
import {PHOTO_LIMIT,preparePhoto,verifyPhoto} from './field-media-preparation.mjs';
import styles from './site-register-panel.module.css';
const endpoint='/api/identity/site-register',photoEndpoint='/api/identity/site-photo';
const tabs={PEOPLE:'Equipo de la obra',ISSUES:'Incidencias',MATERIALS:'Pedidos de materiales'};
const stateLabel={OPEN:'Pendiente',ACKNOWLEDGED:'En seguimiento',RESOLVED:'Resuelto',REJECTED:'Rechazado'};
const severityLabel={INFO:'Informativa',LOW:'Baja',MEDIUM:'Media',HIGH:'Alta',CRITICAL:'Crítica'};
const errors={SITE_PHONE_INVALID:'Usá el teléfono internacional con + y código de país, sin espacios.',SITE_PHONE_ALREADY_REGISTERED:'Ese teléfono ya figura en esta obra, incluso si el registro está inactivo. No se duplicó.',SITE_REVISION_CHANGED:'El registro cambió. Conservamos lo que escribiste; actualizá antes de volver a decidir.',SITE_REPORT_ALREADY_CLOSED:'El registro ya está cerrado. No se repitió la decisión.',SITE_INPUT_INVALID:'Revisá los campos y completá los detalles requeridos.',SITE_QUANTITY_INVALID:'Ingresá una cantidad positiva con hasta tres decimales y una unidad válida.',SITE_OPERATION_CONFLICT:'Este intento ya corresponde a otra solicitud. No se sobreescribió.',WORKSPACE_CONTEXT_CHANGED:'Cambió tu organización o permiso. Volvé a abrir la obra.',WORKSPACE_INTEGRATION_PERMISSION_REQUIRED:'Tu rol no permite administrar estos registros.',SITE_RECORD_NOT_SUPPORTED:'Este registro anterior necesita revisión antes de modificarlo.'};
const explain=code=>errors[code]||'No se pudo confirmar la operación. No se muestran registros de ejemplo.';
const photoOriginalLimits={maxOriginalBytes:20*1024*1024,maxPixels:24_000_000,maxDimension:12000};
const photoSize=bytes=>bytes>=1024*1024?(bytes/1024/1024).toFixed(2)+' MiB':Math.ceil(bytes/1024)+' KiB';
const accessDenied=error=>[401,403].includes(error.status)||['WORKSPACE_CONTEXT_CHANGED','WORKSPACE_PROJECT_UNAVAILABLE'].includes(error.code);
async function api(sessionRequest,params,options={},resource='register',validate=value=>value){
 let retainedError;
 const result=await sessionRequest((resource==='photo'?photoEndpoint:endpoint)+(params?'?'+new URLSearchParams(params):''),options,async response=>{
  if(!response.ok){
   let body;try{body=await response.json();}catch{/* HTML denials still revoke visible access. */}
   const code=body?.code||(response.status===401?'SESSION_REQUIRED':undefined);
   const error=Object.assign(new Error(response.status===401?'Tu sesión terminó. Volvé a ingresar.':response.status===403||['WORKSPACE_CONTEXT_CHANGED','WORKSPACE_PROJECT_UNAVAILABLE'].includes(code)?errors[code]||'Tu acceso cambió. Volvé a consultar la obra cuando se restablezca.':explain(code)),{status:response.status,code});
   // A photo may have reached storage before access was revoked. Keep its journal.
   if(options.method==='POST'&&accessDenied(error)){retainedError=Object.assign(error,{retainAttempt:true});return undefined;}
   throw error;
  }
  return validate(await response.json());
 });
 if(retainedError)throw retainedError;
 return result;
}
const blank=section=>section==='PEOPLE'?{action:'ADD_PERSON',payload:{name:'',phone:'',job:'WORKER'}}:section==='ISSUES'?{action:'REPORT_ISSUE',payload:{title:'',details:'',sector:'',severity:'MEDIUM'}}:{action:'REQUEST_MATERIAL',payload:{material:'',quantity:'',unit:'unidad',sector:'',details:''}};
function SiteRegisterPanelInner({projectId,scope,onPending,getSessionToken}){
 const sessionRequest=useWorkspaceRequest(getSessionToken);
 const [opened,setOpened]=useState(false),[section,setSection]=useState('PEOPLE'),[data,setData]=useState(null),[draft,setDraft]=useState(null),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[attempt,setAttempt]=useState(null),[retryAllowed,setRetryAllowed]=useState(false),[receipt,setReceipt]=useState(null);
 const [readingPhoto,setReadingPhoto]=useState(false),[photoInfo,setPhotoInfo]=useState(null),[accessBlocked,setAccessBlocked]=useState(false);
 const mounted=useRef(true),sequence=useRef(0),abort=useRef(null),photoSequence=useRef(0),photoController=useRef(null),photoReader=useRef(null),draftIdentity=useRef(null),blocked=useRef(false);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;photoController.current?.abort();photoReader.current?.abort();abort.current?.abort();};},[]);
 useEffect(()=>{onPending?.(busy||Boolean(attempt)||readingPhoto||Boolean(draft));return()=>onPending?.(false);},[busy,attempt,readingPhoto,draft,onPending]);
 function invalidatePhoto(){photoSequence.current++;photoController.current?.abort();photoReader.current?.abort();photoController.current=null;photoReader.current=null;setReadingPhoto(false);}
 function beginDraft(value){if(blocked.current)return;invalidatePhoto();draftIdentity.current=value;setPhotoInfo(null);setDraft(value);setReceipt(null);setNotice('');}
 function cancelDraft(){invalidatePhoto();draftIdentity.current=null;setPhotoInfo(null);setDraft(null);setNotice('');}
 function hidePrivate(error){
  if(!accessDenied(error))return false;
  sequence.current++;invalidatePhoto();draftIdentity.current=null;blocked.current=true;setAccessBlocked(true);setData(null);setDraft(null);setPhotoInfo(null);setReceipt(null);setRetryAllowed(false);return true;
 }
 function scoped(result){
  if(result?.scope!==scope||result.projectId!==undefined&&result.projectId!==projectId)throw Object.assign(new Error('Cambió el contexto de esta respuesta. Volvé a consultar la obra.'),{code:'WORKSPACE_CONTEXT_CHANGED'});
  return result;
 }
 function saved(result,retained){
  scoped(result);
  if(result.saved!==true||typeof result.receiptId!=='string'||!result.receiptId.trim())throw new Error('El recibo no permite confirmar el registro.');
  if(result.operationId!==undefined&&result.operationId!==retained.command.operationId||result.reportId!==undefined&&result.reportId!==retained.command.reportId)throw Object.assign(new Error('El recibo corresponde a otro registro.'),{code:'WORKSPACE_CONTEXT_CHANGED'});
  if(retained.isPhoto){const photo=result.photo;if(!photo||photo.id!==result.receiptId||!/^sitephoto_[a-f0-9]{64}$/.test(photo.id)||!Number.isSafeInteger(photo.bytes)||photo.bytes<1||photo.bytes>PHOTO_LIMIT||!['image/jpeg','image/png','image/webp'].includes(photo.contentType)||!/^[a-f0-9]{64}$/.test(photo.sha256))throw new Error('El recibo no permite confirmar la fotografía privada.');}
  else if(!result.person&&!result.report)throw new Error('El recibo no permite confirmar el registro.');
  return result;
 }
 function recovered(result,retained){
  scoped(result);if(result.state==='RECORDED')return saved(result,retained);
  if(result.state==='NOT_OBSERVED'&&result.definitive===false&&result.saved!==true&&!result.receiptId&&!result.photo&&!result.person&&!result.report)return result;
  throw new Error('Todavía no se pudo validar el recibo. Conservamos el intento.');
 }
 async function load(next=section,append=false){
  if(busy||attempt)return;const current=++sequence.current;abort.current?.abort();const controller=new AbortController();abort.current=controller;
  setBusy(true);setOpened(true);setNotice('');setSection(next);if(!append){cancelDraft();setData(null);}
  try{const result=await api(sessionRequest,{projectId,scope,section:next,...(append&&data?.nextCursor?{after:data.nextCursor}:{})},{signal:controller.signal});
   if(!mounted.current||current!==sequence.current)return;scoped(result);if(result.projectId!==projectId||result.section!==next)throw Object.assign(new Error('Respuesta de otra obra.'),{code:'WORKSPACE_CONTEXT_CHANGED'});
   blocked.current=false;setAccessBlocked(false);
   setData(previous=>append?{...result,records:[...(previous?.records||[]),...result.records]}:result);
  }catch(error){if(mounted.current&&current===sequence.current&&error.name!=='AbortError'){hidePrivate(error);setNotice(error.message);}}finally{if(mounted.current&&abort.current===controller)setBusy(false);}
 }
 function edit(key,value){setDraft(previous=>({...previous,payload:{...previous.payload,[key]:value}}));}
 async function confirmed(result,retained){
  saved(result,retained);cancelDraft();blocked.current=false;setAccessBlocked(false);setReceipt(result.receiptId);setAttempt(null);setRetryAllowed(false);setNotice(result.photo?'Fotografía privada adjunta con recibo. No se aprobó avance ni identidad.':result.person?'Ficha guardada con recibo. Los permisos y la identidad se verifican por separado.':'Registro guardado con recibo. Podés continuar su seguimiento desde esta obra.');
  const current=sequence.current;
  try{const refreshed=await api(sessionRequest,{projectId,scope,section},{requestTimeoutMs:15000});scoped(refreshed);if(refreshed.projectId!==projectId||refreshed.section!==section)throw Object.assign(new Error('Respuesta de otra obra.'),{code:'WORKSPACE_CONTEXT_CHANGED'});if(mounted.current&&current===sequence.current)setData(refreshed);}
  catch(error){if(mounted.current&&current===sequence.current)setNotice(hidePrivate(error)?'El guardado está confirmado, pero tu acceso vigente no permite consultar esta obra. Volvé a ingresar o consultá cuando se restablezca.':'El guardado está confirmado. Actualizá el listado para ver los registros vigentes.');}
 }
 async function choosePhoto(event){
  const file=event.target.files?.[0];event.target.value='';if(!file||busy||attempt||blocked.current||draft?.action!=='ATTACH_PHOTO')return;
  invalidatePhoto();const current=photoSequence.current,identity=draftIdentity.current,reportId=draft.payload.reportId,revision=draft.payload.revision;
  const controller=new AbortController();photoController.current=controller;const signal=controller.signal;
  const active=()=>mounted.current&&!signal.aborted&&!blocked.current&&current===photoSequence.current&&draftIdentity.current===identity&&identity?.action==='ATTACH_PHOTO'&&identity.payload.reportId===reportId&&identity.payload.revision===revision;
  setNotice('');setPhotoInfo(null);
  setDraft(previous=>previous?.action==='ATTACH_PHOTO'?{...previous,payload:{...previous.payload,image:''}}:previous);
  setReadingPhoto(true);
  try{
   const prepared=file.size>PHOTO_LIMIT?await preparePhoto(file,{maxBytes:PHOTO_LIMIT,originalLimits:photoOriginalLimits,signal}):{file,...await verifyPhoto(file,{originalLimits:photoOriginalLimits,signal})};
   if(!active())return;
   const reader=new FileReader();photoReader.current=reader;
   reader.onload=()=>{if(active()){setDraft(previous=>previous?.action==='ATTACH_PHOTO'&&previous.payload.reportId===reportId&&previous.payload.revision===revision?{...previous,payload:{...previous.payload,image:reader.result}}:previous);setPhotoInfo({originalBytes:file.size,bytes:prepared.file.size,width:prepared.width,height:prepared.height,reduced:prepared.file!==file});setReadingPhoto(false);}};
   reader.onerror=()=>{if(active()){setNotice('No se pudo leer la copia. Conservamos el borrador; elegí otra fotografía. No se subió ningún archivo.');setReadingPhoto(false);}};
   reader.readAsDataURL(prepared.file);
  }catch(error){if(active()){setNotice(error.message+' Conservamos el borrador. No se subió ningún archivo.');setReadingPhoto(false);}}
 }
 async function sendAttempt(retained,retrying=false){
  const {command,isPhoto}=retained;
  setAttempt(retained);setRetryAllowed(false);setBusy(true);setNotice('');setReceipt(null);
  try{const result=await api(sessionRequest,null,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(command),requestTimeoutMs:isPhoto?45000:20000},isPhoto?'photo':'register',value=>saved(value,retained));if(mounted.current)await confirmed(result,retained);}
  catch(error){if(mounted.current){const denied=hidePrivate(error);if(!error.retainAttempt&&(error.requestDispatched===false||error.status&&error.status<500)){if(!retrying)setAttempt(null);setNotice(error.message);}else setNotice(denied?error.message+' El resultado sigue sin confirmar. Comprobá el mismo intento cuando se restablezca tu acceso.':'El resultado quedó sin confirmar. Comprobá el recibo antes de volver a guardar.');}}
  finally{if(mounted.current)setBusy(false);}
 }
 async function save(event){
  event.preventDefault();if(busy||readingPhoto||attempt||accessBlocked||!draft)return;
  const isPhoto=draft.action==='ATTACH_PHOTO',operationId=crypto.randomUUID();
  if(isPhoto&&!draft.payload.image)return;
  const command=isPhoto?{operationId,projectId,scope,...draft.payload}:{operationId,projectId,scope,...draft};
  await sendAttempt({command,isPhoto});
 }
 async function retry(){
  if(busy||readingPhoto||accessBlocked||!attempt||!retryAllowed)return;
  await sendAttempt(attempt,true);
 }
 async function recover(){
  if(busy||!attempt)return;setBusy(true);setRetryAllowed(false);
  const {command,isPhoto}=attempt;
  try{const result=await api(sessionRequest,{projectId:command.projectId,scope:command.scope,operationId:command.operationId,...(isPhoto?{reportId:command.reportId}:{})},{requestTimeoutMs:15000},isPhoto?'photo':'register',value=>recovered(value,attempt));if(mounted.current){if(result.state==='RECORDED')await confirmed(result,attempt);else{blocked.current=false;setAccessBlocked(false);setRetryAllowed(true);setNotice('No se observa un recibo todavía. Podés comprobar otra vez o reintentar exactamente la misma operación; conservamos sus datos para evitar duplicados.');}}}
  catch(error){if(mounted.current){hidePrivate(error);setNotice(error.message);}}finally{if(mounted.current)setBusy(false);}
 }
 const locked=busy||readingPhoto||Boolean(attempt)||accessBlocked,p=draft?.payload;
 return <section className={styles.panel} aria-labelledby="site-register-title">
  <div className={styles.heading}><div><p className={styles.eyebrow}>GESTIÓN DE LA OBRA</p><h3 id="site-register-title">Equipo, incidencias y materiales</h3></div><button type="button" disabled={busy||readingPhoto||Boolean(attempt)} onClick={()=>load()}>Abrir registro</button></div>
  <p className={styles.intro}>Registros de esta obra cargados por sus responsables. Dar de alta una persona no verifica su identidad ni le habilita WhatsApp, fichajes o acceso al sistema.</p>
  <p role="status" aria-live="polite" className={notice?styles.notice:styles.silent}>{notice}</p>
  {opened&&<><nav className={styles.tabs} aria-label="Registros de obra">{Object.entries(tabs).map(([key,label])=><button type="button" key={key} aria-pressed={section===key} disabled={locked} onClick={()=>load(key)}>{label}</button>)}</nav>
   {busy&&!data&&<p>Consultando registros autorizados…</p>}
   {data&&<><div className={styles.toolbar}><span>{data.records.length} de {data.total} registros</span><button type="button" disabled={locked} onClick={()=>beginDraft(blank(section))}>{section==='PEOPLE'?'Agregar persona':section==='ISSUES'?'Registrar incidencia':'Solicitar material'}</button><button type="button" disabled={locked} onClick={()=>load()}>Actualizar registro</button></div>
    {!data.records.length&&<p className={styles.empty}>Todavía no hay registros de este tipo. No se crearon datos de ejemplo.</p>}
    <div className={styles.list}>{data.records.map(record=><article key={record.id} className={styles.card}>
     {section==='PEOPLE'?<><div className={styles.cardHeader}><strong>{record.name}</strong><span>{record.active?'En nómina de obra':'Inactivo'}</span></div><p>{record.roleLabel||'Función sin indicar'} · {record.phone}</p><small>La ficha no certifica identidad. Consultá participantes para ver el acceso y la revisión vigentes.</small>{record.editable&&<button type="button" disabled={locked} onClick={()=>beginDraft({action:'SET_PERSON_ACTIVE',payload:{personId:record.id,revision:record.revision,active:!record.active,reason:''}})}>{record.active?'Dar de baja en esta obra':'Reactivar registro'}</button>}</>:
      <><div className={styles.cardHeader}><strong>{record.title}</strong><span>{stateLabel[record.state]||record.state}</span></div><p>{record.sector}{record.type==='MATERIAL_REQUEST'?` · ${record.quantity} ${record.unit}`:` · Prioridad ${severityLabel[record.severity]||record.severity}`}</p><p className={styles.detail}>{record.details}</p>{(record.photos||[]).length>0&&<div className={styles.photos}>{record.photos.map((photo,index)=><PrivateWorkspaceDownload key={photo.id} url={photoEndpoint+'?'+new URLSearchParams({projectId,scope,reportId:record.id,photoId:photo.id})} getSessionToken={getSessionToken} filename='obrasaas-foto' expectedBytes={photo.bytes} expectedContentType={photo.contentType} maxBytes={PHOTO_LIMIT} disabled={locked}>Descargar foto {index+1} · {Math.ceil(photo.bytes/1024)} KB</PrivateWorkspaceDownload>)}</div>}{['OPEN','ACKNOWLEDGED'].includes(record.state)&&(record.photos||[]).length<10&&<button type="button" disabled={locked} onClick={()=>beginDraft({action:'ATTACH_PHOTO',reportTitle:record.title,payload:{reportId:record.id,revision:record.revision,image:''}})}>Adjuntar foto privada</button>}{record.review&&<small>Última decisión: {stateLabel[record.review.decision]}. {record.review.reason}</small>}{['OPEN','ACKNOWLEDGED'].includes(record.state)&&<button type="button" disabled={locked} onClick={()=>beginDraft({action:'REVIEW_REPORT',payload:{reportId:record.id,revision:record.revision,decision:record.state==='OPEN'?'ACKNOWLEDGED':'RESOLVED',reason:''}})}>Gestionar registro</button>}</>}
    </article>)}</div>
    {data.nextCursor&&<button type="button" disabled={locked} onClick={()=>load(section,true)}>Cargar más registros</button>}
    {section==='MATERIALS'&&<p className={styles.note}>Un pedido no es una orden de compra. Su seguimiento no mueve inventario, autoriza gastos ni certifica una entrega física.</p>}
    {draft&&<form className={styles.form} onSubmit={save} aria-label="Editar registro de obra">
     {draft.action==='ATTACH_PHOTO'&&<><h4>Adjuntar fotografía privada</h4><p>Registro: <strong>{draft.reportTitle}</strong></p><p>Tomá o elegí una foto JPEG, PNG o WebP. Original hasta 20 MiB y 24 megapíxeles; prepararemos una copia de hasta 2 MiB en este teléfono. El original se conserva. No adjuntes documentos de identidad: esta es evidencia del registro, no un trámite de KYC. La carga no certifica cantidades ni avance.</p><label>Fotografía<input type="file" accept="image/jpeg,image/png,image/webp" disabled={locked} onChange={choosePhoto}/></label>{readingPhoto&&<p role="status">Preparando la fotografía en este teléfono… Todavía no se subió.</p>}{p.image&&photoInfo&&<div className={styles.photoReview}>
      {/* The same local data URL is reviewed and sent only after explicit save. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.photoPreview} src={p.image} alt="Vista previa privada de la fotografía del registro"/>
      <p>{photoInfo.reduced?'Copia JPEG preparada: '+photoSize(photoInfo.bytes):'Fotografía verificada sin reducir: '+photoSize(photoInfo.bytes)} · {photoInfo.width} × {photoInfo.height} px. Original: {photoSize(photoInfo.originalBytes)}. Revisá que se vea con claridad antes de guardar. Todavía no se subió.</p>
     </div>}</>}
     {draft.action==='ADD_PERSON'&&<><h4>Registrar una persona de la obra</h4><label>Nombre<input required minLength={2} maxLength={100} value={p.name} disabled={locked} onChange={e=>edit('name',e.target.value)}/></label><label>Teléfono internacional<input required type="tel" placeholder="+549…" pattern="\+[1-9][0-9]{7,14}" value={p.phone} disabled={locked} onChange={e=>edit('phone',e.target.value)}/></label><label>Función en obra<select value={p.job} disabled={locked} onChange={e=>edit('job',e.target.value)}>{Object.entries(data.roles).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><p>La función declarada no otorga permisos de administrador, acceso ni KYC aprobado.</p></>}
     {draft.action==='SET_PERSON_ACTIVE'&&<><h4>{p.active?'Reactivar registro':'Dar de baja en esta obra'}</h4><p>Se conserva el historial. No se borran registros ni se conceden permisos a la cuenta.</p></>}
     {draft.action==='REPORT_ISSUE'&&<><h4>Nueva incidencia</h4><label>Título<input required minLength={3} maxLength={160} value={p.title} disabled={locked} onChange={e=>edit('title',e.target.value)}/></label><label>Prioridad<select value={p.severity} disabled={locked} onChange={e=>edit('severity',e.target.value)}>{Object.entries(severityLabel).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label></>}
     {draft.action==='REQUEST_MATERIAL'&&<><h4>Pedido de materiales</h4><label>Material<input required minLength={2} maxLength={160} value={p.material} disabled={locked} onChange={e=>edit('material',e.target.value)}/></label><div className={styles.columns}><label>Cantidad<input required inputMode="decimal" pattern="[0-9]{1,9}(\.[0-9]{1,3})?" value={p.quantity} disabled={locked} onChange={e=>edit('quantity',e.target.value)}/></label><label>Unidad<select value={p.unit} disabled={locked} onChange={e=>edit('unit',e.target.value)}>{data.units.map(unit=><option key={unit}>{unit}</option>)}</select></label></div></>}
     {['REPORT_ISSUE','REQUEST_MATERIAL'].includes(draft.action)&&<><label>Sector<input required minLength={2} maxLength={100} value={p.sector} disabled={locked} onChange={e=>edit('sector',e.target.value)}/></label><label>Detalle<textarea required minLength={8} maxLength={2000} rows={3} value={p.details} disabled={locked} onChange={e=>edit('details',e.target.value)}/></label></>}
     {draft.action==='REVIEW_REPORT'&&<><h4>Gestión del registro</h4><label>Estado<select value={p.decision} disabled={locked} onChange={e=>edit('decision',e.target.value)}>{Object.entries(stateLabel).filter(([key])=>key!=='OPEN').map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label></>}
     {['SET_PERSON_ACTIVE','REVIEW_REPORT'].includes(draft.action)&&<label>Motivo<textarea required minLength={8} maxLength={500} rows={3} value={p.reason} disabled={locked} onChange={e=>edit('reason',e.target.value)}/></label>}
     {!attempt&&<div className={styles.actions}><button type="submit" disabled={locked||(draft.action==='ATTACH_PHOTO'&&!p.image)}>Guardar registro</button><button type="button" disabled={busy} onClick={cancelDraft}>{readingPhoto?'Cancelar preparación':'Cancelar'}</button></div>}
    </form>}
   </>}
   {attempt&&<div className={styles.recovery} aria-label="Recuperar registro enviado"><p>Conservamos la referencia del intento enviado. Comprobá su recibo antes de volver a guardar.</p><div className={styles.actions}><button type="button" disabled={busy} onClick={recover}>Comprobar guardado</button>{retryAllowed&&!accessBlocked&&<button type="button" disabled={busy} onClick={retry}>Reintentar la misma operación</button>}</div></div>}
   {receipt&&<p className={styles.receipt}>Recibo confirmado: <code>{receipt}</code></p>}
  </>}
 </section>;
}
export function SiteRegisterPanel(props){return <SiteRegisterPanelInner key={props.projectId+':'+props.scope} {...props}/>;}
