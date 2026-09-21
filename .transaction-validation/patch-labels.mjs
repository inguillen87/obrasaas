import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import ts from 'typescript';
function replaceOnce(source,before,after){assert.equal(source.split(before).length,2,'Anchor changed: '+before.slice(0,100));return source.replace(before,after);}
const path='src/lib/assignment-overlap-review.js';let source=readFileSync(path,'utf8');
const parsed=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);const edits=[];
function visit(node){
  if(ts.isCallExpression(node)&&node.expression.getText(parsed)==='tx.taskAssignment.findMany'){
    const argument=node.arguments[0];assert.ok(ts.isObjectLiteralExpression(argument));
    const property=argument.properties.find(prop=>prop.name?.getText(parsed)==='select');
    assert.ok(property&&ts.isPropertyAssignment(property)&&ts.isObjectLiteralExpression(property.initializer));
    const fields=property.initializer.properties;const excluded=['task','worker','team'];
    assert.equal(fields.filter(prop=>excluded.includes(prop.name?.getText(parsed))).length,3);
    edits.push({start:property.initializer.getStart(parsed),end:property.initializer.end,text:'{'+fields.filter(prop=>!excluded.includes(prop.name?.getText(parsed))).map(prop=>prop.getText(parsed)).join(',')+'}'});
  }
  ts.forEachChild(node,visit);
}
visit(parsed);assert.equal(edits.length,1);const edit=edits[0];source=source.slice(0,edit.start)+edit.text+source.slice(edit.end);
source="import { readAssignmentReviewLabels } from './assignment-review-labels.js';\n"+source;
source=replaceOnce(source,'row.projectId!==scope.projectId||!row.task','row.projectId!==scope.projectId');
source=replaceOnce(source,'  const assignments = rows.map(row =>','  const labeledRows = await readAssignmentReviewLabels(tx, scope, rows);\n  const assignments = labeledRows.map(row =>');
writeFileSync(path,source);
const fixturePath='tests/helpers/assignment-overlap-fixture.js';let fixture=readFileSync(fixturePath,'utf8');
fixture=replaceOnce(fixture,'    task:{findFirst:',"    task:{findMany:async options=>{assert.equal(options.where.projectId,scope.projectId);assert.equal(options.take,options.where.id.in.length);return options.where.id.in.map(id=>({id,projectId:scope.projectId,title:'Actividad '+id}));},findFirst:");
const prefix='findMany:async options=>{assert.equal(options.where.projectId,scope.projectId);assert.equal(options.take,101);';
assert.equal(fixture.split(prefix).length,3);
fixture=fixture.replace(prefix,"findMany:async options=>{assert.equal(options.where.projectId,scope.projectId);if(options.where.id){assert.equal(options.take,options.where.id.in.length);return options.where.id.in.map(id=>({id,projectId:scope.projectId,name:'Persona de ensayo'}));}assert.equal(options.take,101);");
fixture=fixture.replace(prefix,"findMany:async options=>{assert.equal(options.where.projectId,scope.projectId);if(options.where.id){assert.equal(options.take,options.where.id.in.length);return options.where.id.in.map(id=>({id,projectId:scope.projectId,name:'Cuadrilla de ensayo'}));}assert.equal(options.take,101);");
fixture=replaceOnce(fixture,'taskAssignment:{findMany:async options=>{',"taskAssignment:{findMany:async options=>{assert.equal(options.select.task,undefined);assert.equal(options.select.worker,undefined);assert.equal(options.select.team,undefined);");
writeFileSync(fixturePath,fixture);
console.log('Assignment overlap labels now use three sequential, ID-bounded reads; legacy representation preserved.');
