import assert from 'node:assert/strict';
import test from 'node:test';
import { filterInspectionRecords, inspectionListSummary, INSPECTION_LIST_FILTERS } from '../src/lib/inspection-workspace-view.js';
const rows=[
 {id:'i-a',title:'Pre-hormigonado losa',location:'Nivel 2',status:'DRAFT',templateKey:'HORMIGONADO'},
 {id:'i-b',title:'Seguridad semanal',location:'Acceso norte',status:'SUBMITTED',templateKey:'SEGURIDAD'},
 {id:'i-c',title:'Tablero eléctrico',location:'Sala técnica',status:'APPROVED',templateKey:'ELECTRICA'},
 {id:'i-d',title:'Instalación sanitaria',location:'PB',status:'OBSERVED',templateKey:'SANITARIA'},
 {id:'i-e',title:'Terminaciones',location:'Unidad 3',status:'REJECTED',templateKey:'TERMINACIONES'},
];
test('summary describes only loaded records',()=>assert.deepEqual(inspectionListSummary(rows),{records:5,drafts:1,inReview:1,approved:1,attention:2}));
test('invalid collection fails closed',()=>assert.deepEqual(inspectionListSummary(null),{records:0,drafts:0,inReview:0,approved:0,attention:0}));
for(const query of ['hormigonado','HORMIGONADO','eléctrico','sala tecnica','norte seguridad'])test('literal accent-insensitive search '+query,()=>assert.ok(filterInspectionRecords(rows,{query}).length>=1));
test('status and template compose',()=>{
 assert.deepEqual(filterInspectionRecords(rows,{status:'SUBMITTED',templateKey:'SEGURIDAD'}).map(row=>row.id),['i-b']);
 assert.deepEqual(filterInspectionRecords(rows,{status:'APPROVED',templateKey:'SEGURIDAD'}),[]);
});
test('query does not interpret regex or markup',()=>{for(const q of ['.*','[a-z]','<script>'])assert.equal(filterInspectionRecords(rows,{query:q}).length,0);});
test('source collection is never mutated',()=>{const before=structuredClone(rows);filterInspectionRecords(rows,{query:'norte',status:'SUBMITTED'});assert.deepEqual(rows,before);});
test('filter catalog covers workflow states',()=>assert.deepEqual(INSPECTION_LIST_FILTERS.map(row=>row.value),['ALL','DRAFT','SUBMITTED','APPROVED','OBSERVED','REJECTED']));
