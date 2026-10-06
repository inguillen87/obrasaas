import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {legacyBoundaryKind} from '../src/lib/legacy-access-boundary.js';
import {DEMO_TASKS,DEMO_OPPORTUNITIES} from '../src/app/demo/demo-example.mjs';
import {loadedScheduleOverview,selectLoadedTasks} from '../src/app/(identity)/cuenta/schedule-workbench.mjs';
import {constructorCrmRecord,CRM_STAGE_LABELS} from '../src/app/(identity)/cuenta/constructor-crm-view.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
for(const method of ['GET','HEAD'])test('demo read is public: '+method,()=>assert.equal(legacyBoundaryKind('/demo',method),'public'));
for(const method of ['POST','PUT','PATCH','DELETE','OPTIONS'])test('demo cannot become a public write: '+method,()=>assert.equal(legacyBoundaryKind('/demo',method),'private-api'));
for(const path of ['/demo/private','/demo-data','/demo.json','/api/demo'])test('no broad public prefix: '+path,()=>assert.ok(['private-page','private-api'].includes(legacyBoundaryKind(path))));
test('demonstration has no business I/O, credential collection, persistence or actor claims',()=>{
 const source=read('src/app/demo/demo-client.js');
 assert.doesNotMatch(source,/fetch\(|localStorage|sessionStorage|indexedDB|setCookie|useUser|useAuth|<input|<form|type=["']file|navigator.mediaDevices|verified:\s*true/);
 assert.ok(source.includes('data-demo-only="true"'));assert.ok(source.includes('Sólo ejemplos ficticios.'));assert.ok(source.includes('No solicita DNI, fotos, audios ni datos de empleados.'));assert.ok(source.includes('0 operaciones reales'));
});
test('home demo destinations do not point to protected dashboard and lead receipts are not fabricated',()=>{
 const source=read('src/app/page.js');assert.ok((source.match(/href="\/demo"/g)||[]).length>=2);
 assert.doesNotMatch(source,/href="\/dashboard"|setLeadSubmitted|handleLeadSubmit|fetch\(['"]\/api\/state|Plataforma activa — 5 obras|Compliance normativo|Setup en 3 minutos/);
 assert.ok(source.includes('La conexión requiere un número autorizado y completar los requisitos de Meta.'));
 assert.ok(source.includes('Ejemplo ilustrativo'));assert.ok(source.includes('Conversación de ejemplo'));
});
test('demonstration retains the approved brand and independent account path',()=>{
 const source=read('src/app/demo/demo-client.js');assert.ok(source.includes('ObraSaasLogo'));assert.ok(source.includes('href="/sign-in"'));
 assert.ok(source.includes('Reiniciar demo'));assert.ok(source.includes('se reinicia al recargar'));
});
test('public example sources cannot acquire legacy state, identity or business I/O',()=>{
 for(const file of ['src/app/demo/demo-client.js','src/app/demo/demo-explorer.js','src/app/demo/demo-example.mjs']){
  const source=read(file);
  assert.doesNotMatch(source,/(?:from\s*|import\s*\()["'][^"']*(?:defaultState|dashboard|\/lib\/)/);
  assert.doesNotMatch(source,/fetch\(|localStorage|sessionStorage|indexedDB|useUser|useAuth|navigator\.mediaDevices|<form|type=["'](?:file|email|password)|2613168608|32877851/);
 }
});
test('sample planning uses canonical task validation, range and accent insensitive filters',()=>{
 const overview=loadedScheduleOverview(DEMO_TASKS,DEMO_TASKS.length,null);
 assert.equal(overview.loaded,4);assert.equal(overview.partial,false);assert.equal(overview.blocked,1);
 for(const key of ['missingDates','invalidDates','unrecognizedStatus','invalidProgress'])assert.equal(overview[key],0);
 assert.equal(new Date(overview.range.start).toISOString().slice(0,10),'2026-08-01');
 assert.equal(new Date(overview.range.end).toISOString().slice(0,10),'2026-08-24');
 assert.equal(selectLoadedTasks(DEMO_TASKS,{search:'caneria'}).length,1);
 assert.equal(selectLoadedTasks(DEMO_TASKS,{status:'BLOCKED'}).length,1);
 assert.ok(Object.isFrozen(DEMO_TASKS)&&DEMO_TASKS.every(Object.isFrozen));
});
test('public CRM examples validate through the canonical parser and contain no personal contacts',()=>{
 assert.equal(DEMO_OPPORTUNITIES.length,3);
 for(const record of DEMO_OPPORTUNITIES){
  assert.deepEqual(constructorCrmRecord(record),record);assert.ok(CRM_STAGE_LABELS[record.stage]);
  for(const field of ['contactName','email','phone'])assert.equal(record[field],null);
  assert.equal(Object.isFrozen(record),true);
 }
});
