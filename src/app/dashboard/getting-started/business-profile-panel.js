'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { tokens } from '@/lib/design-system';
import { BUSINESS_PROFILE_KINDS, BUSINESS_MARKETS, confirmsBusinessProfileUpdate } from '@/lib/organization-business-profile';
import { evidenceScopeHeaders } from '@/lib/evidence-capture-policy';
import { requestWorkspaceNavigation } from '@/lib/workspace-leave-policy';
import { useWorkspaceLeaveGuard } from '../use-workspace-leave-guard';
import styles from './business-profile-panel.module.css';
export default function BusinessProfilePanel({ organizationId, projectId, organizationName, initialProfile, canManage, pathsByKind }) {
  const [profile,setProfile] = useState(initialProfile), [kind,setKind] = useState(initialProfile?.kind || ''), [market,setMarket] = useState(initialProfile?.market || '');
  const [state,setState] = useState(initialProfile ? 'idle' : 'blocked'), [notice,setNotice] = useState(initialProfile ? '' : 'No se pudo verificar el perfil guardado. El resto de la puesta en marcha sigue disponible.');
  const busy = state === 'saving', uncertain = state === 'uncertain', blocked = state === 'blocked';
  const attempt = useRef(null), controller = useRef(null), active = useRef(true), inFlight = useRef(false);
  const dirty = kind !== (profile?.kind || '') || market !== (profile?.market || '');
  useWorkspaceLeaveGuard({ dirty: dirty || uncertain, busy, message: 'Hay cambios del perfil sin confirmar. ¿Descartarlos y salir?' });
  useEffect(() => { active.current = true; return () => { active.current = false; controller.current?.abort(); }; }, []);
  useEffect(() => { const leave = event => { if (dirty || busy || uncertain) { event.preventDefault(); event.returnValue=''; } }; window.addEventListener('beforeunload',leave); return () => window.removeEventListener('beforeunload',leave); }, [dirty,busy,uncertain]);
  function valid(body) { return body?.organizationId === organizationId && body.projectId === projectId && body.profile?.configured === true && BUSINESS_PROFILE_KINDS.some(item => item.key === body.profile.kind) && BUSINESS_MARKETS.some(item => item.key === body.profile.market) && Number.isSafeInteger(body.profile.revision) && body.profile.revision > 0; }
  async function save(event) {
    event.preventDefault(); if (!canManage || inFlight.current || blocked || !kind || !market) return;
    attempt.current ||= { kind, market, expectedRevision: profile.revision };
    inFlight.current=true;setState('saving');setNotice('');controller.current=new AbortController();const timer=setTimeout(()=>controller.current?.abort(),15000);
    try {
      const response=await fetch('/api/tenant/business-profile',{ method:'PATCH',cache:'no-store',signal:controller.current.signal,headers:{ 'Content-Type':'application/json',...evidenceScopeHeaders({organizationId,projectId}) },body:JSON.stringify(attempt.current) });
      const body=await response.json().catch(()=>null); if (!active.current) return;
      if (!response.ok) { const error=new Error(body?.error || 'No se confirmó el guardado.');error.status=response.status;throw error; }
      if (!valid(body) || !confirmsBusinessProfileUpdate(body, attempt.current, { organizationId, projectId })) throw new Error('La respuesta no confirma el perfil solicitado. Verificá el mismo intento.');
      setProfile(body.profile);setKind(body.profile.kind);setMarket(body.profile.market);attempt.current=null;setState('saved');setNotice('Perfil guardado en la organización. Los roles y permisos no se modificaron.');
    } catch(error) { if (active.current) { setState([401,402,403,404,409].includes(error.status)?'blocked':[400,422].includes(error.status)?'idle':'uncertain'); if([400,422].includes(error.status))attempt.current=null;setNotice(error.name==='AbortError'?'La respuesta demoró. Se conserva el mismo intento sin reenviarlo automáticamente.':error.message); } }
    finally {clearTimeout(timer);inFlight.current=false;}
  }
  const selected=BUSINESS_PROFILE_KINDS.find(item=>item.key===kind);
  const paths=pathsByKind[kind] || [];
  const css={ '--profile-bg':tokens.colors.bg.secondary,'--profile-border':tokens.colors.border.default,'--profile-accent':tokens.colors.accent.primary,'--profile-text':tokens.colors.text.primary,'--profile-muted':tokens.colors.text.secondary };
  return <section className={styles.panel} style={css} aria-label="Perfil operativo de la organización">
    <header><div><span>UNA ORGANIZACIÓN · VARIAS OBRAS</span><h2>Una puesta en marcha para tu actividad</h2><p>{organizationName}</p></div><small>{profile?.configured ? 'Perfil confirmado · v'+profile.revision : 'Perfil por configurar'}</small></header>
    <p className={styles.scope}>Este perfil se guarda para toda la organización. Ordena sus primeros pasos; no cambia los permisos, no comparte datos entre empresas y no activa módulos pendientes.</p>
    <form onSubmit={save}>
      <fieldset disabled={!canManage || busy || uncertain || blocked}><legend>¿Cómo participa tu organización en las obras?</legend>
        <div className={styles.kinds}>{BUSINESS_PROFILE_KINDS.map(item=><label key={item.key} className={styles.choice} data-selected={kind===item.key}>
          <input type="radio" name="business-kind" value={item.key} checked={kind===item.key} onChange={()=>setKind(item.key)} />
          <i className={item.icon} aria-hidden="true"/><strong>{item.label}</strong><span>{item.detail}</span>
        </label>)}</div>
        <h3 className={styles.marketTitle}>Ámbito de trabajo</h3><div className={styles.markets}>{BUSINESS_MARKETS.map(item=><label key={item.key} data-selected={market===item.key}><input type="radio" name="business-market" value={item.key} checked={market===item.key} onChange={()=>setMarket(item.key)}/>{item.label}</label>)}</div>
      </fieldset>
      {canManage ? <footer><span>{dirty ? 'Selección pendiente de guardar' : profile?.configured ? 'Coincide con el perfil guardado' : 'Elegí tipo y ámbito para comenzar'}</span><button type="submit" disabled={busy || blocked || !kind || !market || (!dirty && !uncertain)}>{busy?'Guardando perfil…':uncertain?'Verificar el mismo intento':'Guardar perfil de la organización'}</button></footer> : <p className={styles.notice}>Tu rol puede consultar el perfil. Sólo la administración de esta organización puede modificarlo.</p>}
    </form>
    {notice && <p className={styles.notice} role={state==='saved'?'status':'alert'}>{notice}</p>}
    {blocked && <div className={styles.scope}><p>No se reenviará esta selección. La consulta actualiza el contexto y descarta cambios locales sólo después de confirmarlos.</p><button type="button" onClick={()=>{if(requestWorkspaceNavigation('reload'))window.location.reload();}}>Consultar versión actual</button></div>}
    {selected && <section className={styles.next} aria-label="Primeros pasos para el perfil"><h3>{dirty?'Recorrido propuesto':'Recorrido de la organización'} · {selected.label}</h3><p>Accesos disponibles para tu rol actual. Elegir un perfil nunca concede permisos nuevos.</p><nav>{paths.map(path=><Link key={path.key} href={path.href} prefetch={false} onNavigate={event=>{if(!requestWorkspaceNavigation('route'))event.preventDefault();}}>{path.label}<span aria-hidden="true"> →</span></Link>)}</nav></section>}
    <aside className={styles.participants}><strong>Empresa operadora no es lo mismo que participante de una obra</strong><p>El comprador en pozo, el inversor individual y el comitente invitado necesitan acceso específico a su obra y a la información publicada para ellos. No se les asigna acceso administrativo ni de auditor por elegir este perfil.</p></aside>
  </section>;
}
