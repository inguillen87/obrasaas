import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
const targets = ['project-execution','task-assignments','crew-memberships','schedule-field-status'];
for (const name of targets) test('one transaction does not dispatch overlapping query groups: '+name,()=>{
  const path='../src/lib/'+name+'.js', source=readFileSync(new URL(path,import.meta.url),'utf8');
  const parsed=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  let sequentialGroups=0;
  function visit(node){
    if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)
      && ['Promise.all','Promise.allSettled'].includes(node.expression.getText(parsed))) {
      assert.doesNotMatch(node.arguments.map(argument=>argument.getText(parsed)).join(' '),/\btx\./,'Do not overlap statements on the same transaction client.');
    }
    if(ts.isArrayLiteralExpression(node)&&node.elements.length>1
      &&node.elements.every(element=>ts.isAwaitExpression(element))&&/\btx\./.test(node.getText(parsed))) sequentialGroups++;
    ts.forEachChild(node,visit);
  }
  visit(parsed);assert.equal(sequentialGroups,{'project-execution':3,'task-assignments':2,'crew-memberships':2,'schedule-field-status':1}[name]);
});
test('independent execution list queries retain their pooled concurrency',()=>{
  const source=readFileSync(new URL('../src/lib/project-execution.js',import.meta.url),'utf8');
  const begin=source.indexOf('export async function listProjectExecution('),end=source.indexOf('export async function createExecutionRecord(');
  assert.ok(begin>=0&&end>begin);assert.match(source.slice(begin,end),/await Promise\.all\(/);assert.doesNotMatch(source.slice(begin,end),/\btx\./);
});
test('the real database verifier fails if the driver warning returns',()=>{
  const source=readFileSync(new URL('../scripts/verify-execution-release-postgres.mjs',import.meta.url),'utf8');
  assert.match(source,/process\.on\('warning'/);assert.match(source,/already executing a query/);
  assert.match(source,/assert\.equal\(concurrentQueryWarnings\.length, 0/);
  assert.doesNotMatch(source,/removeAllListeners\('warning'\)|NODE_NO_WARNINGS|--no-warnings/);
});
