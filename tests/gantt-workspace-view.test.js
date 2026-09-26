import assert from 'node:assert/strict';
import test from 'node:test';
import { ganttProgressAverage, ganttTaskSearchIds, ganttWorkspaceSummary } from '../src/lib/gantt-workspace-view.js';

const tasks={
  a:{progress:100}, b:{progress:50}, c:{progress:0}, d:{progress:'bad'},
};
const rows=[
  {id:'a',name:'Excavación bases',assignee:'Ana Pérez',status:'Finalizada',dependencyNames:[]},
  {id:'b',name:'Hormigonado losa',assignee:'Juan Silva',status:'En curso',dependencyNames:['Excavación bases']},
  {id:'c',name:'Tablero eléctrico',assignee:'María Gómez',status:'Conflicto de secuencia',dependencyNames:['Hormigonado losa']},
];

test('average progress is a simple bounded average over supplied task catalog',()=>{
  assert.equal(ganttProgressAverage(tasks),38);
  assert.equal(ganttProgressAverage(null),0);
});
test('workspace summary never invents totals outside the supplied model',()=>{
  assert.deepEqual(ganttWorkspaceSummary({tasks:rows,completeTasks:1,dependencyCount:2,dependencyConflicts:1,delayedTasks:1},tasks),{
    total:3,open:2,complete:1,dependencies:2,conflicts:1,delayed:1,progressAverage:38,
  });
});
for(const query of ['hormigonado','HORMIGONADO','maria gomez','excavacion bases','conflicto secuencia']){
  test('literal accent-insensitive gantt search: '+query,()=>{
    assert.ok(ganttTaskSearchIds(rows,query).length>=1);
  });
}
test('search can match predecessor names while preserving graph rows',()=>{
  assert.deepEqual(ganttTaskSearchIds(rows,'hormigonado').sort(),['b','c']);
});
test('empty search returns all task ids in model order',()=>assert.deepEqual(ganttTaskSearchIds(rows,''),['a','b','c']));
test('regex and markup are literal',()=>{for(const q of ['.*','[a-z]','<script>'])assert.deepEqual(ganttTaskSearchIds(rows,q),[]);});
