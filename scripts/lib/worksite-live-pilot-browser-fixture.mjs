import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {copyFileSync,existsSync,lstatSync,mkdirSync,readFileSync,realpathSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {parse} from '@babel/parser';

// Preparation only until this helper is applied and its explicit browser focus is run.
// Uses the existing owned custom-Next fixture pattern; copies the exact canonical Field UI closure.
export const PILOT_SCOPE='a'.repeat(64),PILOT_PROJECT='project-live-pilot';
export const PILOT_REVISION='2026-10-18T10:00:00.000001';
export const PILOT_TASKS=['a','b','c'].map((name,index)=>({id:'task-'+name,title:'Tarea piloto '+name.toUpperCase(),progress:0,status:'BACKLOG',revision:PILOT_REVISION,startsOn:'2026-10-19',endsOn:'2026-10-'+(21+index)}));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const inside=(file,root)=>{const rel=path.relative(root,file);return rel!==''&&!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel);};

export function prepareWorksiteLivePilotFixture({root,fixture,sourceManifest}){
 const src=realpathSync(path.join(root,'src')),seen=new Set(),external=new Set();
 function copy(file){
  file=realpathSync(file);assert.ok(inside(file,src),'Fixture sources must stay within canonical src');if(seen.has(file))return;seen.add(file);
  const rel=path.relative(root,file),bytes=readFileSync(file),dest=path.join(fixture,rel);assert.ok(inside(dest,fixture));mkdirSync(path.dirname(dest),{recursive:true});copyFileSync(file,dest);assert.deepEqual(readFileSync(dest),bytes);
  const portable=rel.split(path.sep).join('/'),old=sourceManifest.find(row=>row.path===portable);if(old)assert.equal(old.sha256,hash(bytes));else sourceManifest.push({path:portable,sha256:hash(bytes)});
  if(file.endsWith('.css')){assert.ok(!/@import\s|url\(\s*['"]?(?!data:|#)/i.test(bytes.toString()));return;}
  const ast=parse(bytes.toString(),{sourceType:'module',plugins:['jsx']}),imports=[];
  function visit(node){if(!node||typeof node!=='object')return;if(['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration'].includes(node.type)&&node.source)imports.push(node.source.value);if(node.type==='ImportExpression'){assert.equal(node.source.type,'StringLiteral');imports.push(node.source.value);}if(node.type==='CallExpression'&&node.callee?.type==='Import'){assert.equal(node.arguments[0]?.type,'StringLiteral');imports.push(node.arguments[0].value);}for(const value of Object.values(node)){if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);}}
  visit(ast);
  for(const specifier of imports){if(!specifier.startsWith('.')){assert.ok(['react','lucide-react','jsqr','next/navigation'].includes(specifier),'Unexpected browser import '+specifier);external.add(specifier);continue;}const fileBase=path.resolve(path.dirname(file),specifier),dep=[fileBase,fileBase+'.js',fileBase+'.mjs',fileBase+'.css',path.join(fileBase,'index.js')].find(name=>existsSync(name)&&lstatSync(name).isFile());assert.ok(dep,'Missing canonical source '+specifier);copy(dep);}
 }
 for(const entry of ['field-operations-panel.js','schedule-workbench.js','workspace-task-page.mjs','workspace-live-read.mjs','workspace-live-refresh.js'])copy(path.join(src,'app/(identity)/cuenta',entry));
 const relative='src/app/(identity)/cuenta/workspace-client.js',source=readFileSync(path.join(root,relative),'utf8'),ast=parse(source,{sourceType:'module',plugins:['jsx']}),decls=new Map();
 function visit(node,parent){if(!node||typeof node!=='object')return;if(node.type==='VariableDeclarator'&&node.id?.type==='Identifier'){const list=decls.get(node.id.name)||[];list.push({node,parent});decls.set(node.id.name,list);}for(const value of Object.values(node)){if(Array.isArray(value))value.forEach(child=>visit(child,node));else if(value&&typeof value==='object')visit(value,node);}}
 visit(ast);
 const one=name=>{const matches=decls.get(name)||[];assert.equal(matches.length,1,'One current canonical declaration '+name);return matches[0];};
 const live=one('scheduleLive'),context=one('scheduleLiveContext'),blocked=one('scheduleLiveBlocked');assert.equal(live.node.init?.callee?.name,'useWorksiteLiveRefresh');
 // Includes the committed useLayoutEffect context update added during lint review.
 assert.ok(blocked.parent.start<context.parent.start,'The production blocked declaration must precede the context');
 const schedule=source.slice(blocked.parent.start,live.parent.end);
 assert.match(schedule,/useLayoutEffect/);assert.match(schedule,/scheduleLiveContext\.current=/);
 const topNames=['endpoint','messages','describe','query'],top=topNames.map(name=>source.slice(one(name).parent.start,one(name).parent.end));
 const requestNodes=ast.program.body.filter(node=>node.type==='FunctionDeclaration'&&node.id?.name==='requestWorkspace');assert.equal(requestNodes.length,1);top.push(source.slice(requestNodes[0].start,requestNodes[0].end));
 const old=sourceManifest.find(row=>row.path===relative);if(old)assert.equal(old.sha256,hash(source));else sourceManifest.push({path:relative,sha256:hash(source)});
 const initial={scope:PILOT_SCOPE,project:{id:PILOT_PROJECT,name:'Piloto sintético compartido',status:'ACTIVE'},tasks:PILOT_TASKS,totalTasks:3,nextCursor:null,canPlanSchedule:false,roleLabel:'DIRECTOR'};
 const page=`'use client';
import {useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {FieldOperationsPanel} from '../(identity)/cuenta/field-operations-panel';
import {ScheduleWorkbench} from '../(identity)/cuenta/schedule-workbench';
import {useWorkspaceRequest} from '../(identity)/cuenta/workspace-request-lifecycle';
import {collectRetainedPages,retainedRows} from '../(identity)/cuenta/workspace-live-read.mjs';
import {confirmedWorksiteTaskPage} from '../(identity)/cuenta/workspace-task-page.mjs';
import {useWorksiteLiveRefresh,WorksiteLiveRefreshStatus} from '../(identity)/cuenta/workspace-live-refresh';
${top.join('\n')}
const initial=${JSON.stringify(initial)},fixtureAccount={scope:initial.scope,officeReviewOnly:false};
export default function LivePilot(){
 const [view,setView]=useState(initial),[activeSection,setActiveSection]=useState('cronograma'),[contextLocked,setContextLocked]=useState(false),[access,setAccess]=useState(false);
 const account=fixtureAccount,loading=false,planReadbackMatches=false,observationEpoch=1,generation=useRef(1),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const getSessionToken=useCallback(async()=> 'synthetic-pilot-'+window.__pilotActor,[]),transport=useWorkspaceRequest(getSessionToken);
 const request=useCallback((suffix='',options={})=>requestWorkspace(transport,suffix,options),[transport]);
 const restrictProject=()=>{setView(null);setAccess(true);};
 ${schedule}
 return <main data-live-pilot-fixture style={{maxWidth:1000,margin:'0 auto'}}><button data-pilot-section='cronograma' disabled={contextLocked} onClick={()=>setActiveSection('cronograma')}>Ver cronograma piloto</button><button data-pilot-section='campo' disabled={contextLocked} onClick={()=>setActiveSection('campo')}>Ver campo piloto</button>{access&&<p data-pilot-access>Cambió el acceso de la consulta piloto.</p>}<section hidden={activeSection!=='cronograma'} data-pilot-schedule><WorksiteLiveRefreshStatus refresh={scheduleLive} paused={contextLocked} label='Cronograma'/><ScheduleWorkbench tasks={view?.tasks||[]} totalTasks={view?.totalTasks||0} nextCursor={view?.nextCursor??null} canPlan={false} locked={contextLocked}/></section><section hidden={activeSection!=='campo'} data-pilot-field><FieldOperationsPanel projectId={initial.project.id} scope={initial.scope} active={activeSection==='campo'} backgroundBlocked={contextLocked} tasks={view?.tasks||[]} getSessionToken={getSessionToken} onPending={setContextLocked} onTasksChanged={task=>setView(old=>old?{...old,tasks:old.tasks.map(row=>row.id===task.id?{...row,...task}:row)}:old)}/></section></main>;
}
`;
 const target=path.join(fixture,'src/app/pilot-live-refresh/page.js');mkdirSync(path.dirname(target),{recursive:true});writeFileSync(target,page);
 sourceManifest.sort((a,b)=>a.path.localeCompare(b.path));
 return {pageSha256:hash(page),canonicalScheduleSnippetSha256:hash(schedule),externalImports:[...external].sort(),scope:PILOT_SCOPE,projectId:PILOT_PROJECT,taskCount:3,accountWorkspaceMounted:false,scheduleCallbacksAndStatusHook:'exact current canonical source',scheduleWorkbenchMounted:true};
}
