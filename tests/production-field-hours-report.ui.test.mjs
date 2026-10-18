import test from 'node:test';
import assert from 'node:assert/strict';
import {scopeStamp} from '../src/lib/workspace-policy.mjs';
import {reportFixture,shift} from './helpers/field-hours-fixture.mjs';
import {createHoursUiHarness,nodes,text,one,change,configure,deferred,json,dispatched} from './helpers/field-hours-ui-harness.mjs';
// Actual JSX and request lifecycle; React hooks, HTTP and mount lifetime are
// controlled. This is not a browser, layout, GPS or physical-phone acceptance.
const {panel,parent}=await createHoursUiHarness();
const token=async()=> 'synthetic-hours-ui-token';
const props={projectId:'project-a',scope:'a'.repeat(64),disabled:false,getSessionToken:token};
async function fixture(){const f=reportFixture();f.add(shift());return f.read();}
const submit=tree=>one(tree,node=>node.type==='form').props.onSubmit({preventDefault(){}});
const insideReference=(node,ancestors,label)=>{const parent=ancestors.filter(ancestor=>ancestor.type==='details').at(-1);return Boolean(parent)&&text(nodes(parent,child=>child.type==='summary')[0])===label;};

test('the actual form starts with no timezone choice and makes the common choice friendly without automatic HTTP',()=>{
 panel.reset({},[]);let tree=panel.render(props);assert.equal(one(tree,node=>node.type==='select').props.value,'');assert.equal(panel.state().timeZone,'');assert.equal(panel.state().confirmed,false);assert.deepEqual(panel.requests(),[]);assert.doesNotMatch(text(tree),/Zona horaria IANA/);assert.ok(nodes(tree,node=>node.type==='option'&&text(node)==='Argentina (Buenos Aires)').length===1);assert.equal(nodes(tree,node=>node.type==='input'&&node.props.placeholder?.includes('Europe/Madrid')).length,0);
 change(tree,node=>node.type==='select','America/Argentina/Buenos_Aires');tree=panel.render(props);assert.equal(panel.state().timeZone,'America/Argentina/Buenos_Aires');assert.equal(panel.state().confirmed,false);assert.deepEqual(panel.requests(),[]);
 change(tree,node=>node.type==='select','OTHER');tree=panel.render(props);assert.equal(panel.state().timeZone,'');assert.equal(nodes(tree,node=>node.type==='input'&&node.props.placeholder?.includes('Europe/Madrid')).length,1);panel.unmount();
});
test('explicit consultation uses the current scope/period and keeps technical references in secondary details',async()=>{
 const body=await fixture();panel.reset({},[json(body)]);let tree=configure(panel,props);await submit(tree);tree=panel.render(props);assert.equal(panel.state().result.reportDigest,body.reportDigest);assert.equal(panel.requests().length,1);const params=new URL(panel.requests()[0].url,'https://synthetic.invalid').searchParams;assert.equal(params.get('projectId'),props.projectId);assert.equal(params.get('scope'),props.scope);assert.equal(params.get('hoursTimeZone'),'America/Argentina/Buenos_Aires');assert.equal(panel.requests()[0].headers.authorization,'Bearer synthetic-hours-ui-token');assert.match(text(tree),/fichajes verificados o aprobados/);assert.ok(nodes(tree,node=>node.type==='p'&&text(node).includes('Zona: Argentina (Buenos Aires)')).length===1);
 const technical=nodes(tree,(node,ancestors)=>node.type==='small'&&text(node).includes(body.reportDigest)&&insideReference(node,ancestors,'Referencias de la consulta'));assert.equal(technical.length,1);assert.ok(nodes(tree,(node,ancestors)=>node.type==='small'&&text(node).includes('actor-worker')&&insideReference(node,ancestors,'Referencias del registro')).length===1);panel.unmount();
});
test('editing the chosen zone invalidates the previous report and confirmation without another request',async()=>{
 panel.reset({},[json(await fixture())]);await submit(configure(panel,props));let tree=panel.render(props);assert.ok(panel.state().result);change(tree,node=>node.type==='select','OTHER');tree=panel.render(props);assert.equal(panel.state().result,null);assert.equal(panel.state().confirmed,false);assert.equal(panel.requests().length,1);assert.equal(nodes(tree,node=>node.type==='button'&&text(node)==='Descargar CSV de esta consulta').length,0);panel.unmount();
});
for(const [name,changeBody]of [
 ['other project',body=>body.projectId='project-foreign'],['other scope',body=>body.scope='f'.repeat(64)],['other period',body=>body.period.fromDate='2026-10-02'],['other zone',body=>body.period.timeZone='UTC'],['negative duration',body=>body.rows[0].netMs=-1],['invented salary',body=>body.salaryCalculated=true],['incomplete selection with totals',body=>{body.state='INCOMPLETE';body.complete=false;body.exportable=false;}]
])test('actual UI never offers a download for '+name+' in the returned preview',async()=>{
 const body=await fixture();changeBody(body);panel.reset({},[json(body)]);await submit(configure(panel,props));const tree=panel.render(props);assert.equal(panel.state().result,null);assert.equal(nodes(tree,node=>node.type==='button'&&text(node)==='Descargar CSV de esta consulta').length,0);assert.equal(panel.requests().length,1);panel.unmount();
});
for(const status of [401,403])test('actual hours UI clears private report and notifies its parent on '+status+' before any download',async()=>{
 const errors=[],p={...props,onAccessDenied:error=>errors.push(error)};panel.reset({},[json(await fixture()),json({saved:false,code:status===401?'SESSION_REQUIRED':'FIELD_HOURS_PERMISSION_REQUIRED'},status)]);await submit(configure(panel,p));let tree=panel.render(p);await one(tree,node=>node.type==='button'&&text(node)==='Descargar CSV de esta consulta').props.onClick();tree=panel.render(p);assert.equal(panel.state().result,null);assert.equal(errors.length,1);assert.equal(errors[0].status,status);assert.equal(panel.requests().length,2);assert.equal(nodes(tree,node=>node.type==='button'&&text(node)==='Descargar CSV de esta consulta').length,0);panel.unmount();
});
test('a stale CSV digest clears the preview and requires another deliberate consultation',async()=>{
 panel.reset({},[json(await fixture()),json({saved:false,code:'FIELD_HOURS_SOURCE_CHANGED'},409)]);await submit(configure(panel,props));let tree=panel.render(props);await one(tree,node=>node.type==='button'&&text(node)==='Descargar CSV de esta consulta').props.onClick();tree=panel.render(props);assert.equal(panel.state().result,null);assert.match(text(tree),/fichajes o sus revisiones cambiaron/);assert.equal(panel.requests().length,2);panel.unmount();
});
test('a source becoming incomplete after preview clears old totals and requires another explicit consultation',async()=>{
 panel.reset({},[json(await fixture()),json({saved:false,code:'FIELD_HOURS_INCOMPLETE'},409)]);await submit(configure(panel,props));let tree=panel.render(props);assert.ok(panel.state().result);assert.match(text(tree),/Netas observadas/);await one(tree,node=>node.type==='button'&&text(node)==='Descargar CSV de esta consulta').props.onClick();tree=panel.render(props);assert.equal(panel.state().result,null);assert.match(text(tree),/La fuente no está completa/);assert.doesNotMatch(text(tree),/Netas observadas|jornadas? en la consulta completa/);assert.equal(nodes(tree,node=>node.type==='button'&&text(node)==='Descargar CSV de esta consulta').length,0);assert.equal(panel.requests().length,2,'No automatic reconsultation or repeated CSV request');assert.equal(panel.state().fromDate,'2026-10-01');assert.equal(panel.state().untilDate,'2026-11-01');assert.equal(panel.state().timeZone,'America/Argentina/Buenos_Aires');panel.unmount();
});
test('actual FieldOperationsPanel key remounts private state on project and canonical role/scope changes',()=>{
 const session={userId:'user_UI',organizationId:'org_UI',organizationRole:'org:admin'},member={membershipId:'membership-ui',organizationId:'company-a',role:'ADMIN'},firstScope=scopeStamp(session,member),otherRoleScope=scopeStamp(session,{...member,role:'DIRECTOR'});
 const first=parent.FieldOperationsPanel({...props,scope:firstScope}),changedProject=parent.FieldOperationsPanel({...props,projectId:'project-b',scope:firstScope}),changedRole=parent.FieldOperationsPanel({...props,scope:otherRoleScope});assert.notEqual(first.key,changedProject.key);assert.notEqual(first.key,changedRole.key);assert.equal(first.key,'project-a:'+firstScope);
});
for(const changeContext of ['project','role-scope'])test('late old '+changeContext+' response cannot restore a report after the actual keyed context unmounts',async()=>{
 const pending=deferred(),body=await fixture();panel.reset({},[pending.promise]);const oldTree=configure(panel,props),operation=submit(oldTree);await dispatched(panel);const oldKey=parent.FieldOperationsPanel(props).key,newProps=changeContext==='project'?{...props,projectId:'project-b'}:{...props,scope:'b'.repeat(64)};assert.notEqual(oldKey,parent.FieldOperationsPanel(newProps).key);panel.unmount();panel.reset({},[]);panel.render(newProps);pending.resolve(json(body));await operation;const tree=panel.render(newProps);assert.equal(panel.state().result,null);assert.equal(nodes(tree,node=>node.type==='button'&&text(node)==='Descargar CSV de esta consulta').length,0);assert.equal(panel.requests().length,0);panel.unmount();
});
test('replacing the token getter aborts the previous transport before an old response can become a result',async()=>{
 const pending=deferred();panel.reset({},[pending.promise]);const operation=submit(configure(panel,props));await dispatched(panel);panel.render({...props,getSessionToken:async()=> 'synthetic-renewed-token'});pending.resolve(json(await fixture()));await operation;assert.equal(panel.state().result,null);assert.equal(panel.requests().length,1);panel.unmount();
});
test('a missing current worker name does not place a technical worker ID in the primary person label',async()=>{
 const body=await fixture();body.rows[0].workerCurrentName=null;panel.reset({},[json(body)]);await submit(configure(panel,props));const tree=panel.render(props);assert.equal(one(tree,node=>node.type==='strong').props.children,'Ficha sin nombre disponible');panel.unmount();
});