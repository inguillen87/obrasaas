'use client';
import { useCallback,useState } from 'react';
import { tokens } from '@/lib/design-system';
import CrewRosterDialog from './crew-roster-dialog';
import styles from './crew-roster.module.css';
export default function CrewRosterPanel({teams,organizationId,projectId,canManage}){
  const [selected,setSelected]=useState(null),[summaries,setSummaries]=useState({});
  const summarize=useCallback(snapshot=>setSummaries(previous=>({...previous,[snapshot.team.id]:snapshot.summary})),[]);
  return <div className={styles.panel} style={{'--crew-bg':tokens.colors.bg.secondary,'--crew-accent':tokens.colors.accent.primary,'--crew-border':tokens.colors.border.default,'--crew-muted':tokens.colors.text.secondary}}>
    <p className={styles.hint}>Organizá las personas de cada cuadrilla y conservá sus participaciones anteriores. La función interna no cambia los permisos del usuario.</p>
    {teams.length===0?<p className={styles.empty}>Todavía no hay cuadrillas. Creá una y después incorporá personas registradas en esta obra.</p>:<ul className={styles.teams}>{teams.map(team=><li key={team.id}>
      <div><strong>{team.name}</strong><span>{team.status==='ACTIVE'?'Activa':'Archivada'} · revisión {team.revision}</span>
      {summaries[team.id]?<small>{summaries[team.id].current} participaciones vigentes · {summaries[team.id].past} finalizadas</small>:<small>{team.members.length} participaciones registradas · consultar vigencia e historial</small>}</div>
      <button type="button" onClick={()=>setSelected(team)}>Ver integrantes</button>
    </li>)}</ul>}
    {selected&&<CrewRosterDialog key={organizationId+':'+projectId+':'+selected.id} team={selected} organizationId={organizationId} projectId={projectId} canManage={canManage} onClose={()=>setSelected(null)} onSummary={summarize}/>}
  </div>;
}
