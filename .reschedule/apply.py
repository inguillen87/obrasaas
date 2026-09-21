from pathlib import Path
import json, subprocess
root=Path('candidate'); payload=Path('harness/.reschedule')
base='1712129d903eb0b690ca5ccef90af9de77f3750d'
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()==base
files={
 'src/lib/assignment-reschedule-policy.js':'2f154978403a0041ca7eb115848a462394a2d5de',
 'src/lib/assignment-reschedule.js':'17dac437bb6de0a71efc388bfc0c1b97ea88aa62',
 'src/lib/assignment-reschedule-handlers.js':'5acf661e03c4d02fad9d5535fcada06afa0680cf',
 'src/app/dashboard/execution/assignment-reschedule-dialog.js':'f8b907b4feae4b34384ec2c6a00105a0989e61a3',
 'src/app/dashboard/execution/assignment-reschedule.module.css':'f3264fab0499ce73dbb55d8973afd7a4c33f5974',
 'tests/assignment-reschedule-policy.test.js':'3b0c9b253bcbf36d8c77bd1bcb90cf627f819e1a',
 'tests/assignment-reschedule-handlers.test.js':'91dd1cc7cf6f561ea24155b85fe00ea871aa9ad6',
 'scripts/verify-assignment-reschedule-postgres.mjs':'9644f989d1ee18392a25010817469efa1fc2cbee',
 'scripts/verify-assignment-reschedule-ui.mjs':'edbc3f5ebd347016ddbe6519fee34252d730c68d',
 'docs/recovery/assignment-reschedule.md':'733fb05c62bc4500190e4b4c6677e7fb0c6ba71b',
}
for name,sha in files.items():
 source=payload/name
 assert subprocess.check_output(['git','hash-object',str(source)],text=True).strip()==sha
 target=root/name
 assert not target.exists(),name
 target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(source.read_bytes())
def replace(name,old,new):
 p=root/name;s=p.read_text()
 assert s.count(old)==1,(name,old[:60],s.count(old))
 p.write_text(s.replace(old,new,1))
originals={
 'src/lib/assignment-overlap-review.js':'8c2089c8cb5aec1bfdcd44b2bf33dfd01b0527a3',
 'src/app/dashboard/execution/assignment-card.js':'d5a4ec72e51ca34f68956a7f0005c3aa825586bd',
 'tests/proxy-sensitive-route-coverage.test.js':'2d6af360c1e01823be765d0b595a74a87417a08c',
}
for name,sha in originals.items():assert subprocess.check_output(['git','hash-object',name],cwd=root,text=True).strip()==sha
replace('src/lib/assignment-overlap-review.js',
 'export async function reviewAssignmentInTransaction(tx, scope, plan) {',
 'export async function reviewAssignmentInTransaction(tx, scope, plan, { excludeAssignmentId = null } = {}) {\n  if (excludeAssignmentId !== null) assignmentId(excludeAssignmentId);')
replace('src/lib/assignment-overlap-review.js',
 "const rows = await tx.taskAssignment.findMany({ where: { projectId:scope.projectId,project:",
 "const rows = await tx.taskAssignment.findMany({ where: { ...(excludeAssignmentId ? { id: { not: excludeAssignmentId } } : {}), projectId:scope.projectId,project:")
replace('src/lib/assignment-overlap-review.js',
 'if(rows.some(row=>row.projectId!==scope.projectId))',
 'if(rows.some(row=>row.projectId!==scope.projectId || excludeAssignmentId && row.id===excludeAssignmentId))')
replace('src/app/dashboard/execution/assignment-card.js',
 "import styles from './assignments.module.css';",
 "import AssignmentRescheduleDialog from './assignment-reschedule-dialog';\nimport styles from './assignments.module.css';")
replace('src/app/dashboard/execution/assignment-card.js',
 '  const alive=useRef(true),inFlight=useRef(false),attempt=useRef(null),controllerRef=useRef(null);',
 '  const [replanning,setReplanning]=useState(false);\n  const alive=useRef(true),inFlight=useRef(false),attempt=useRef(null),controllerRef=useRef(null);')
replace('src/app/dashboard/execution/assignment-card.js',
 'Ver actividad en el Gantt →</Link>}</div>',
 'Ver actividad en el Gantt →</Link>}{canReadTasks&&!action&&<button type="button" disabled={busy||blocked} onClick={()=>setReplanning(true)}>{canManage&&assignment.status===\'PLANNED\'?\'Reprogramar fechas\':\'Ver fechas y cambios\'}</button>}</div>')
replace('src/app/dashboard/execution/assignment-card.js',
 '    {message&&<p className={styles.warning} role="status">{message}</p>}',
 '    {replanning&&<AssignmentRescheduleDialog key={organizationId+\':\'+projectId+\':\'+assignment.id} assignmentId={assignment.id} organizationId={organizationId} projectId={projectId} canManage={canManage} onClose={()=>setReplanning(false)} onSaved={saved=>{onChanged(saved);setReplanning(false);setMessage(\'Fechas confirmadas y auditadas. Se conserva la misma asignación; no cambió el avance de la actividad.\');}}/>}\n    {message&&<p className={styles.warning} role="status">{message}</p>}')
replace('tests/proxy-sensitive-route-coverage.test.js','assert.equal(protectedRouteCount, 132,','assert.equal(protectedRouteCount, 133,')
replace('src/lib/assignment-reschedule.js',
 "return prisma.$transaction(async tx=>{const {snapshot:_snapshot,...result}=await reviewIn(tx,scope,id,command);return result;},{isolationLevel:'RepeatableRead',timeout:10000});",
 "return prisma.$transaction(async tx=>{const result=await reviewIn(tx,scope,id,command);delete result.snapshot;return result;},{isolationLevel:'RepeatableRead',timeout:10000});")
replace('src/lib/assignment-reschedule.js',
 'const matches = meta?.revision === row.revision && meta.startsAt === assignment.startsAt && meta.endsAt === assignment.endsAt;',
 'const matches = Number.isSafeInteger(meta?.revision) && meta.revision <= row.revision && meta.startsAt === assignment.startsAt && meta.endsAt === assignment.endsAt && typeof meta.note === \'string\';')
replace('src/app/dashboard/execution/assignment-reschedule-dialog.js',
 ".catch(error=>{if(alive.current){setMessage(error.name==='AbortError'?",
 ".catch(error=>{if(alive.current&&active.current===controller){setMessage(error.name==='AbortError'?")
replace('scripts/verify-assignment-reschedule-ui.mjs',
 " const start=modal.getByRole('textbox',{name:'unused'});void start;\n",'')
route='src/app/api/execution/assignments/[assignmentId]/reschedule/route.js'
p=root/route;assert not p.exists();p.parent.mkdir(parents=True,exist_ok=True)
p.write_text("import { getPlatformAccess } from '@/lib/access';\nimport { createAssignmentRescheduleHandlers } from '@/lib/assignment-reschedule-handlers';\nexport const runtime = 'nodejs';\nexport const dynamic = 'force-dynamic';\nconst handlers = createAssignmentRescheduleHandlers({ resolveAccess: getPlatformAccess });\nexport const GET = handlers.GET;\nexport const POST = handlers.POST;\nexport const PATCH = handlers.PATCH;\n")
handoff='docs/recovery/HANDOFF_TENANT_WHATSAPP.md'
p=root/handoff
p.write_text(p.read_text()+'''\n## Continuación S11.A14: reprogramar fechas de una asignación\nLeer `assignment-reschedule.md`. La tarjeta conserva la misma asignación y su responsable al revisar/cambiar fechas previstas. Sólo PLANNED, revisión y motivo obligatorios, coincidencias verificadas nuevamente bajo transacción y recuperación por GET de respuestas inciertas. No modifica Task, avance, asistencia o WhatsApp. Ejecutar `verify-assignment-reschedule-postgres.mjs` y `verify-assignment-reschedule-ui.mjs` contra PostgreSQL desechable; la sesión del browser es sintética. Publicación y pruebas reales del canal siguen separadas.\n''')
changed=[*files,*originals,route,handoff]
Path('evidence/changed-files.json').write_text(json.dumps(changed))
Path('evidence/source-manifest.json').write_text(json.dumps({'base':base,'files':{name:subprocess.check_output(['git','hash-object',name],cwd=root,text=True).strip() for name in changed}},indent=2))
print('Applied',len(changed),'reviewed product files; no changes to deployment credentials or migrations.')
