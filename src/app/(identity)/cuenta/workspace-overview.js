import {ArrowUpRight,CalendarDays,UsersRound,Package,HardHat} from 'lucide-react';
import {loadedScheduleOverview} from './schedule-workbench.mjs';
import styles from './workspace.module.css';
export function WorkspaceOverview({project,tasks,totalTasks,nextCursor,roleLabel,canPlan}){
 const overview=loadedScheduleOverview(tasks,totalTasks,nextCursor);
 return <section aria-labelledby="workspace-home-title" className={styles.overview}>
  <div className={styles.overviewHeading}><p className={styles.eyebrow}>RESUMEN DE LA OBRA</p><h3 id="workspace-home-title">{project.name}</h3><p>Elegí una tarea para continuar.</p></div>
  <div className={styles.quickActions}>
   <a className={styles.featuredAction} href="#participant-title"><UsersRound size={23} aria-hidden="true"/><span><strong>Equipo e identidad</strong><small>Continuar una presentación o revisar al equipo</small></span><ArrowUpRight size={18} aria-hidden="true"/></a>
   <a href="#field-title"><HardHat size={23} aria-hidden="true"/><span><strong>Registrar el trabajo</strong><small>Jornada, fotos y avances de obra</small></span><ArrowUpRight size={18} aria-hidden="true"/></a>
   <a href="#schedule-title"><CalendarDays size={23} aria-hidden="true"/><span><strong>Ver el cronograma</strong><small>{canPlan?'Consultar tareas y organizar las próximas fechas':'Consultar las tareas de esta obra'}</small></span><ArrowUpRight size={18} aria-hidden="true"/></a>
   <a href="#inventory-title"><Package size={23} aria-hidden="true"/><span><strong>Consultar materiales</strong><small>Inventario y consumos registrados</small></span><ArrowUpRight size={18} aria-hidden="true"/></a>
  </div>
  <dl className={styles.overviewMetrics}><div><dt>Tareas cargadas</dt><dd>{overview.loaded}{overview.partial?<small> de {overview.total??'total sin confirmar'}</small>:null}</dd></div><div><dt>Sin fechas previstas</dt><dd>{overview.missingDates}</dd></div><div><dt>Tu acceso</dt><dd className={styles.roleMetric}>{roleLabel}</dd></div></dl>
  {overview.partial&&<p className={styles.caption}>Los indicadores corresponden a las tareas cargadas. Consultá el cronograma para cargar más.</p>}
  {overview.missingDates>0&&<p className={styles.overviewNote}>Hay tareas con fechas pendientes de definir. Podés consultarlas en el cronograma.</p>}
 </section>;
}
