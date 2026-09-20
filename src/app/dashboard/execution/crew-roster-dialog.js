'use client';
import { useCallback,useEffect,useId,useRef,useState } from 'react';
import { tokens } from '@/lib/design-system';
import { CREW_ROLES,crewMemberMatches,crewRosterMatches,normalizeCrewAddition,normalizeCrewDecision } from '@/lib/crew-membership-policy';
import { evidenceScopeHeaders } from '@/lib/evidence-capture-policy';
import { useWorkspaceLeaveGuard } from '../use-workspace-leave-guard';
import styles from './crew-roster.module.css';
const timestamp=value=>value?new Date(value).toLocaleString('es-AR',{dateStyle:'short',timeStyle:'short'}):'Sin finalización';
const STATES={CURRENT:'Vigente',ENDED:'Finalizada',SCHEDULED:'Programada'};
export default function CrewRosterDialog({team,organizationId,projectId,canManage,onClose,onSummary}){
  const dialog=useRef(null),alive=useRef(true),inFlight=useRef(false),attempt=useRef(null),requestRef=useRef(null),heading=useId();
  const [data,setData]=useState(null),[query,setQuery]=useState({view:'current',after:null}),[phase,setPhase]=useState('loading'),[message,setMessage]=useState('');
  const [mode,setMode]=useState('browse'),[selected,setSelected]=useState(null),[draft,setDraft]=useState({workerId:'',role:'MEMBER',operation:'CHANGE_ROLE',note:''}),[consent,setConsent]=useState(false),[search,setSearch]=useState('');
  const busy=['saving','checking','loading'].includes(phase),uncertain=phase==='uncertain',blocked=phase==='blocked';
  const dirty=mode!=='browse'&&Boolean(draft.workerId||draft.note||consent||phase==='uncertain');
  const endpoint='/api/execution/teams/'+encodeURIComponent(team.id)+'/members';
  useWorkspaceLeaveGuard({dirty,busy});
  useEffect(()=>{alive.current=true;const el=dialog.current,previous=document.activeElement;el.showModal();el.querySelector('[aria-label="Cerrar integrantes"]')?.focus();return()=>{alive.current=false;requestRef.current?.abort();el.close();if(previous?.isConnected)previous.focus();};},[]);
  useEffect(()=>{const warn=event=>{if(dirty||busy){event.preventDefault();event.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty,busy]);
  const load=useCallback(async(view,after)=>{
    requestRef.current?.abort();const controller=new AbortController();requestRef.current=controller;const timeout=setTimeout(()=>controller.abort(),15000);
    try{
      const params=new URLSearchParams({view,...(after?{after}:{})});
      const response=await fetch(endpoint+'?'+params,{cache:'no-store',signal:controller.signal,headers:evidenceScopeHeaders({organizationId,projectId})});const body=await response.json().catch(()=>null);
      if(!response.ok)throw Object.assign(new Error(body?.error||'No se pudo consultar la cuadrilla.'),{status:response.status});
      if(!crewRosterMatches(body,{organizationId,projectId},team.id,view))throw Object.assign(new Error('La consulta no corresponde a esta cuadrilla y obra.'),{status:409});
      if(alive.current&&!controller.signal.aborted){setData(body);setPhase('idle');onSummary?.(body);}
    }catch(error){if(alive.current&&!controller.signal.aborted){setData(null);setMessage(error.message);setPhase([401,402,403,404,409].includes(error.status)?'blocked':'error');}else if(alive.current&&requestRef.current===controller){setMessage('La consulta demoró. Volvé a consultar antes de operar.');setData(null);setPhase('error');}}
    finally{clearTimeout(timeout);}
  },[endpoint,organizationId,projectId,team.id,onSummary]);
  useEffect(()=>{const frame=window.requestAnimationFrame(()=>{void load(query.view,query.after);});return()=>{window.cancelAnimationFrame(frame);requestRef.current?.abort();};},[load,query]);
  function leave(close=false){if(inFlight.current)return;if(dirty&&!window.confirm('¿Salir sin confirmar este cambio? No se borrará el historial de la cuadrilla.'))return;if(close){onClose();return;}attempt.current=null;setMode('browse');setSelected(null);setDraft({workerId:'',role:'MEMBER',operation:'CHANGE_ROLE',note:''});setConsent(false);setMessage('');setPhase('idle');}
  function edit(member,operation){setSelected(member);setMode('edit');setDraft({workerId:'',role:member.role,operation,note:''});setConsent(false);setMessage('');attempt.current=null;}
  function memberFrom(body,original=null){if(body?.context?.organizationId!==organizationId||body.context.projectId!==projectId||!crewMemberMatches(body.member,{organizationId,projectId},team.id,original))throw new Error('No se confirmó la participación de esta cuadrilla.');return body.member;}
  async function submit(event){
    event.preventDefault();if(inFlight.current||!consent||blocked||!canManage||!data?.writable)return;
    try{if(!attempt.current){const input=mode==='add'?normalizeCrewAddition({workerId:draft.workerId,role:draft.role,expectedTeamRevision:data.team.revision}):normalizeCrewDecision({expectedRevision:selected.revision,operation:draft.operation,...(draft.operation==='CHANGE_ROLE'?{role:draft.role}:{}),note:draft.note});attempt.current={input,key:crypto.randomUUID(),mode,original:selected};}}catch(error){setMessage(error.message);return;}
    if(uncertain&&attempt.current.mode!=='add')return;inFlight.current=true;setPhase('saving');setMessage('');
    const controller=new AbortController();requestRef.current=controller;const timeout=setTimeout(()=>controller.abort(),20000);
    try{
      const current=attempt.current,adding=current.mode==='add';
      const response=await fetch(endpoint+(adding?'':'/'+encodeURIComponent(current.original.id)),{method:adding?'POST':'PATCH',cache:'no-store',signal:controller.signal,headers:{'Content-Type':'application/json',...evidenceScopeHeaders({organizationId,projectId}),'Idempotency-Key':current.key},body:JSON.stringify(current.input)});
      const body=await response.json().catch(()=>null);if(!response.ok)throw Object.assign(new Error(body?.error||'El cambio no quedó confirmado.'),{status:response.status});
      const saved=memberFrom(body,adding?null:current.original);
      if(adding?(typeof body.replayed!=='boolean'||saved.workerId!==current.input.workerId||!body.replayed&&(saved.role!==current.input.role||saved.state!=='CURRENT')):(saved.revision!==current.input.expectedRevision+1||saved.lastDecision?.note!==current.input.note||saved.lastDecision?.operation!==current.input.operation||current.input.operation==='END'&&saved.state!=='ENDED'||current.input.operation==='CHANGE_ROLE'&&saved.role!==current.input.role))throw new Error('La respuesta no confirmó el cambio revisado. Verificá el intento antes de repetir.');
      if(alive.current){attempt.current=null;setMode('browse');setConsent(false);setDraft({workerId:'',role:'MEMBER',operation:'CHANGE_ROLE',note:''});setMessage(adding?'Participación confirmada. Se conserva el historial y no cambian permisos del canal.':'Cambio confirmado y auditado. La persona y sus asignaciones no fueron eliminadas.');setQuery({view:saved.state==='ENDED'?'past':'current',after:null});}
    }catch(error){if(alive.current){setMessage(error.name==='AbortError'?'La respuesta demoró. El cambio podría estar guardado.':error.message);if([400,422].includes(error.status)){attempt.current=null;setConsent(false);setPhase('idle');}else setPhase([401,402,403,404,410].includes(error.status)?'blocked':error.status===409&&mode==='add'?'blocked':'uncertain');}}
    finally{clearTimeout(timeout);inFlight.current=false;}
  }
  async function verify(member){
    if(inFlight.current)return;const original=member||attempt.current?.original;if(!original)return;
    inFlight.current=true;setPhase('checking');const controller=new AbortController();requestRef.current=controller;const timeout=setTimeout(()=>controller.abort(),15000);
    try{
      const response=await fetch(endpoint+'/'+encodeURIComponent(original.id),{cache:'no-store',signal:controller.signal,headers:evidenceScopeHeaders({organizationId,projectId})});const body=await response.json().catch(()=>null);
      if(!response.ok)throw Object.assign(new Error(body?.error||'No se pudo consultar el resultado.'),{status:response.status});const saved=memberFrom(body,original);if(!alive.current)return;
      const expected=attempt.current?.input;
      if(expected&&saved.revision===expected.expectedRevision+1&&saved.lastDecision?.note===expected.note&&saved.lastDecision?.operation===expected.operation&&(expected.operation==='END'?saved.state==='ENDED':saved.role===expected.role)){attempt.current=null;setMode('browse');setConsent(false);setDraft({workerId:'',role:'MEMBER',operation:'CHANGE_ROLE',note:''});setMessage('Se recuperó la decisión registrada. No se envió otro cambio.');setQuery({view:saved.state==='ENDED'?'past':'current',after:null});}
      else if(member){setSelected(saved);setMode('inspect');setPhase('idle');setMessage('');}
      else{setSelected(saved);attempt.current=null;setConsent(false);setPhase('idle');setMessage('Estado consultado. Revisá la versión actual antes de confirmar otro cambio.');}
    }catch(error){if(alive.current){setMessage(error.message);setPhase([401,402,403,404].includes(error.status)?'blocked':attempt.current?'uncertain':'error');}}
    finally{clearTimeout(timeout);inFlight.current=false;}
  }
  const locked=busy||uncertain||blocked,editable=canManage&&data?.writable;
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby={heading} onCancel={event=>{event.preventDefault();leave(true);}}
    style={{'--crew-bg':tokens.colors.bg.secondary,'--crew-accent':tokens.colors.accent.primary,'--crew-border':tokens.colors.border.default,'--crew-muted':tokens.colors.text.secondary}}>
    <header className={styles.header}><div><span>PERSONAS → CUADRILLA → ASIGNACIONES</span><h2 id={heading}>Integrantes de {team.name}</h2><p>Esta cuadrilla pertenece a la obra activa.</p></div><button type="button" aria-label="Cerrar integrantes" disabled={phase==='saving'||phase==='checking'} onClick={()=>leave(true)}>×</button></header>
    <div className={styles.body}>
    {message&&<p className={styles.notice} role={blocked?'alert':'status'}>{message}</p>}
    {busy&&<p role="status">{phase==='loading'?'Consultando integrantes y vigencias…':'Confirmando la operación…'}</p>}
    {data&&!data.writable&&<p className={styles.notice}>La obra o empresa está en modo de lectura.</p>}
    {mode==='browse'&&<>
      {data&&<><div className={styles.metrics}><div><strong>{data.summary.current}</strong><span>Participaciones vigentes</span></div><div><strong>{data.summary.past}</strong><span>Participaciones finalizadas</span></div></div>
      <p className={styles.hint}>La vigencia pertenece a esta cuadrilla: no acredita presencia en obra ni disponibilidad laboral.</p>
      <div className={styles.toolbar}><label>Participaciones<select aria-label="Filtro de participaciones" value={query.view} disabled={busy||blocked} onChange={event=>{setMessage('');setPhase('loading');setQuery({view:event.target.value,after:null});}}><option value="current">Vigentes</option><option value="past">Historial finalizado</option><option value="scheduled">Programadas</option><option value="all">Todas</option></select></label><button type="button" disabled={busy||blocked} onClick={()=>{setPhase('loading');load(query.view,query.after);}}>Actualizar</button></div>
      <div className={styles.members}>{data.members.map(row=><article className={styles.member} key={row.id}>
        <header><h3>{row.worker.name}</h3><span>{STATES[row.state]} · v{row.revision}</span></header><strong>{CREW_ROLES[row.role]}</strong>
        <p>Desde {timestamp(row.startsAt)}<br />{row.endsAt?'Hasta '+timestamp(row.endsAt):'Sin finalización registrada'}</p>
        {!row.worker.active&&<p className={styles.notice}>La persona figura inactiva en la obra. Revisá el registro; esta participación no reactiva su acceso.</p>}
        <div className={styles.actions}><button type="button" disabled={busy||blocked} onClick={()=>verify(row)}>Consultar decisión</button>
          {editable&&row.state==='CURRENT'&&<><button type="button" disabled={busy||blocked||!row.worker.active||data.team.status!=='ACTIVE'} onClick={()=>edit(row,'CHANGE_ROLE')}>Cambiar función</button><button type="button" disabled={busy||blocked} onClick={()=>edit(row,'END')}>Finalizar participación</button></>}</div>
      </article>)}</div>
      {data.members.length===0&&<p className={styles.empty}>No hay participaciones registradas en este filtro. El historial se conserva por separado.</p>}
      <div className={styles.pagination}>{query.after&&<button type="button" disabled={busy||blocked} onClick={()=>{setPhase('loading');setQuery({...query,after:null});}}>Primera página</button>}<span>Hasta 50 participaciones por página</span>{data.page.hasMore&&<button type="button" disabled={busy||blocked} onClick={()=>{setPhase('loading');setQuery({...query,after:data.page.nextAfter});}}>Siguientes participaciones</button>}</div>
      <p className={styles.hint}>Las fechas se muestran en la zona horaria de este dispositivo.</p>
      {editable&&data.team.status==='ACTIVE'&&<button type="button" className={styles.primary} disabled={busy||blocked} onClick={()=>{setMode('add');setDraft({workerId:'',role:'MEMBER',operation:'CHANGE_ROLE',note:''});setConsent(false);setSearch('');setMessage('');attempt.current=null;}}>Incorporar integrante</button>}</>}
      {!data&&phase==='error'&&<button type="button" onClick={()=>{setPhase('loading');load(query.view,query.after);}}>Volver a consultar</button>}
    </>}
    {mode==='inspect'&&selected&&<section className={styles.confirmation}><h3>{selected.worker.name} · {STATES[selected.state]}</h3><p>{CREW_ROLES[selected.role]} · revisión {selected.revision}</p><p>Desde {timestamp(selected.startsAt)} · {timestamp(selected.endsAt)}</p><strong>Última decisión registrada</strong><p>{selected.lastDecision?.note||'No hay una explicación registrada por este circuito para la revisión actual.'}</p><button type="button" onClick={()=>leave()}>Volver a integrantes</button></section>}
    {(mode==='add'||mode==='edit')&&<form onSubmit={submit}>
      <h3>{mode==='add'?'Incorporar una persona':draft.operation==='END'?'Finalizar esta participación':'Cambiar función en la cuadrilla'}</h3>
      <fieldset className={styles.fields} disabled={locked}>
      {mode==='add'?<><label>Buscar en la obra<input type="search" value={search} maxLength={80} onChange={event=>setSearch(event.target.value)} placeholder="Nombre de una persona registrada" /></label><label>Persona<select aria-label="Persona a incorporar" required value={draft.workerId} onChange={event=>{setDraft({...draft,workerId:event.target.value});setConsent(false);}}><option value="">Seleccionar persona</option>{(data?.workers||[]).filter(row=>row.id===draft.workerId||row.name.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es'))).map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
      {data?.workersTruncated&&<p className={styles.notice}>Se muestran hasta 100 personas activas. No encontrar un nombre aquí no demuestra que no exista.</p>}
      {data?.workers.length===0&&<p>No hay personas activas registradas en esta obra. Registralas en Personal antes de incorporarlas.</p>}</>:<p><strong>{selected?.worker.name}</strong> · {STATES[selected?.state]} · revisión {selected?.revision}</p>}
      {(mode==='add'||draft.operation==='CHANGE_ROLE')&&<label>Función interna<select aria-label="Función en la cuadrilla" value={draft.role} onChange={event=>{setDraft({...draft,role:event.target.value});setConsent(false);}}>{Object.entries(CREW_ROLES).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>}
      {mode==='edit'&&<label>Motivo o resultado<textarea aria-label="Explicación del cambio de participación" value={draft.note} onChange={event=>{setDraft({...draft,note:event.target.value});setConsent(false);}} required maxLength={1000} rows={4}/></label>}
      </fieldset>
      <div className={styles.confirmation}><strong>Alcance de esta acción</strong><p>{mode==='add'?'La participación comienza ahora, según la hora del servidor. No se crea otro legajo.':draft.operation==='END'?'Se registra el final de la participación. No se elimina a la persona ni sus asignaciones o antecedentes.':'Cambia sólo la función interna de esta participación.'}</p><p>Ser encargado de cuadrilla no concede permisos administrativos ni de WhatsApp. No se calculan jornales ni asistencia.</p></div>
      {mode==='edit'&&selected?.state!=='CURRENT'&&<p className={styles.notice}>La participación ya no está vigente. El historial no se reabre desde este formulario.</p>}
      <label className={styles.consent}><input type="checkbox" checked={consent} disabled={locked} onChange={event=>setConsent(event.target.checked)} />Confirmo persona, cuadrilla y alcance del cambio. No se alteran permisos, salarios o avance de obra.</label>
      <footer className={styles.formFooter}><button type="button" disabled={busy} onClick={()=>leave()}>Volver sin cambiar</button>
      {uncertain&&mode==='edit'?<button type="button" onClick={()=>verify()}>Consultar estado sin reenviar</button>:<button className={styles.primary} type="submit" disabled={busy||blocked||!consent||mode==='add'&&!draft.workerId||mode==='edit'&&(selected?.state!=='CURRENT'||!draft.note.trim()||draft.operation==='CHANGE_ROLE'&&selected?.role===draft.role)}>{busy?'Confirmando…':uncertain?'Verificar el mismo intento':mode==='add'?'Confirmar incorporación':'Confirmar cambio'}</button>}</footer>
    </form>}
    </div>
  </dialog>;
}
