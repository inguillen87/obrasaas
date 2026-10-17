import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadBindings,transform} from 'next/dist/build/swc/index.js';

// Render the actual controlled selector with React. These tests cover markup
// and displayed state; the owned browser fixture covers edits and paging.
const source=readFileSync(new URL('../src/app/(identity)/cuenta/worksite-task-selector.js',import.meta.url),'utf8');
await loadBindings();
const compiled=await transform(`import React from ${JSON.stringify(import.meta.resolve('react'))};\n${source.replace("'use client';",'').replace("from 'react'",`from ${JSON.stringify(import.meta.resolve('react'))}`).replace(/^import styles from .*;\r?\n/m,"const styles={selector:'selector',description:'description',error:'error',more:'more'};\n")}`,{filename:'actual-worksite-task-selector.js',jsc:{parser:{syntax:'ecmascript',jsx:true},target:'es2022',transform:{react:{runtime:'classic'}}},module:{type:'es6'}});
const {WorksiteTaskSelector}=await import('data:text/javascript;base64,'+Buffer.from(compiled.code).toString('base64'));
const rows=Array.from({length:205},(_,index)=>({id:'task-'+String(index+1).padStart(3,'0'),title:'Partida sintética '+(index+1),progress:0}));
const render=props=>renderToStaticMarkup(React.createElement(WorksiteTaskSelector,{tasks:rows.slice(0,100),value:'task-017',onChange:()=>assert.fail('Rendering must not choose a task'),onLoadMoreTasks:()=>assert.fail('Rendering must not request a page'),...props}));

test('100, 200 and 205 task pages preserve the explicit selected value without choosing new rows',()=>{
 for(const count of [100,200,205]){
  const html=render({tasks:rows.slice(0,count),taskPaging:{totalTasks:205,nextCursor:count<205?rows[count-1].id:null,loading:false,error:null}});
  assert.equal((html.match(/<option\b/g)||[]).length,count+1);
  assert.match(html,/<option value="task-017" selected="">Partida sintética 17<\/option>/);
  assert.equal((html.match(/ selected=""/g)||[]).length,1);
  assert.ok(html.includes(`${count} de 205 tareas cargadas.`));
  if(count<205)assert.match(html,/type="button"[^>]*>Cargar más tareas<\/button>/);else{assert.doesNotMatch(html,/Cargar más tareas/);assert.match(html,/Lista completa de esta consulta/);}
 }
});

test('native label, descriptive live count and optional empty choice remain accessible',()=>{
 const html=render({value:'',label:'Tarea relacionada (opcional)',emptyLabel:'Sin tarea específica',taskPaging:{totalTasks:205,nextCursor:'task-100'}});
 assert.match(html,/<label for="[^"]+">Tarea relacionada \(opcional\)<select id="[^"]+"/);
 assert.match(html,/<option value="" selected="">Sin tarea específica<\/option>/);
 assert.match(html,/aria-describedby="[^"]+-description"/);
 assert.match(html,/role="status" aria-live="polite" aria-atomic="true"/);
 assert.doesNotMatch(html,/<select[^>]*required/);
 assert.match(html,/Hay más tareas de esta obra por consultar/);
});

test('pending read disables further paging and an actionable error keeps the selection available',()=>{
 const pending=render({required:true,taskPaging:{totalTasks:205,nextCursor:'task-100',loading:true,error:null}});
 assert.match(pending,/data-worksite-task-selector="true" aria-busy="true"/);
 assert.match(pending,/<select[^>]*required=""/);
 assert.match(pending,/<button[^>]*disabled=""[^>]*>Consultando tareas…<\/button>/);
 const failed=render({taskPaging:{totalTasks:205,nextCursor:'task-100',loading:false,error:'No pudimos consultar esta página.'}});
 assert.match(failed,/role="alert">No pudimos consultar esta página\.<\/p>/);
 assert.match(failed,/Reintentar cargar más tareas/);
 assert.match(failed,/<option value="task-017" selected="">/);
 assert.doesNotMatch(failed,/<select[^>]*disabled/);
});

test('uncertain operation blocks changes and missing pagination metadata never claims a complete list',()=>{
 const locked=render({disabled:true,taskPaging:{totalTasks:205,nextCursor:'task-100'}});
 assert.match(locked,/<select[^>]*disabled=""/);assert.match(locked,/<button[^>]*disabled=""/);
 const legacy=render();assert.match(legacy,/100 tareas cargadas\./);assert.doesNotMatch(legacy,/Lista completa|Cargar más tareas/);
 const unavailable=render({value:'task-205'});assert.match(unavailable,/<option value="task-205" disabled="" selected="">Tarea seleccionada pendiente de consulta/);assert.equal((unavailable.match(/ selected=""/g)||[]).length,1);
});
