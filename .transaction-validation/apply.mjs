// One-off, bounded source transformation for the inspected execution baseline.
// This file belongs only to the validation harness, not the product.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import ts from 'typescript';
const targetGroups = { 'src/lib/project-execution.js':3, 'src/lib/task-assignments.js':2, 'src/lib/crew-memberships.js':2, 'src/lib/schedule-field-status.js':1 };
for (const [path, expectedCount] of Object.entries(targetGroups)) {
  let source = readFileSync(path, 'utf8');
  if (path === 'src/lib/crew-memberships.js') {
    const before = "...['current','past','scheduled'].map(view=>tx.workTeamMember.count({where:{...base,...period(view,now)}})),";
    assert.equal(source.split(before).length, 2, 'Unexpected roster count expression');
    source = source.replace(before, ['current','past','scheduled'].map(view => "tx.workTeamMember.count({where:{...base,...period('" + view + "',now)}}),").join('\n      '));
  }
  const parsed = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const edits=[];
  function walk(node) {
    if (ts.isAwaitExpression(node) && ts.isCallExpression(node.expression)) {
      const call=node.expression;
      if (ts.isPropertyAccessExpression(call.expression) && call.expression.getText(parsed)==='Promise.all'
          && call.arguments.length===1 && ts.isArrayLiteralExpression(call.arguments[0])
          && /\btx\./.test(call.arguments[0].getText(parsed))) {
        assert.ok(call.arguments[0].elements.every(element=>!ts.isSpreadElement(element)), 'Unexpected dynamic query group');
        const lineStart=source.lastIndexOf('\n',node.getStart(parsed))+1;
        const indentation=source.slice(lineStart).match(/^\s*/)[0];
        const replacement='[\n'+call.arguments[0].elements.map(element=>indentation+'  await ('+element.getText(parsed)+'),').join('\n')+'\n'+indentation+']';
        edits.push({start:node.getStart(parsed),end:node.end,replacement});
      }
    }
    ts.forEachChild(node,walk);
  }
  walk(parsed);
  assert.equal(edits.length,expectedCount,path+' transaction group count changed');
  for (const edit of edits.sort((a,b)=>b.start-a.start)) source=source.slice(0,edit.start)+edit.replacement+source.slice(edit.end);
  const note='// A transaction owns one PostgreSQL connection: await its reads in order.\n// Independent pooled operations outside a transaction may remain concurrent.\n';
  writeFileSync(path,note+source);
  console.log(path+': '+edits.length+' transaction query groups serialized');
}
const path='scripts/verify-execution-release-postgres.mjs';
let source=readFileSync(path,'utf8');
const anchor="const connectionString = executionTestConnection();";
assert.equal(source.split(anchor).length,2);
source=source.replace(anchor,anchor+"\nconst concurrentQueryWarnings = [];\nprocess.on('warning', warning => {\n  if (warning.name === 'DeprecationWarning' && warning.message.includes('already executing a query')) concurrentQueryWarnings.push(warning.message);\n});");
const pass="  report.status = 'PASS';";
assert.equal(source.split(pass).length,2);
source=source.replace(pass,"  await pause(0);\n  assert.equal(concurrentQueryWarnings.length, 0, 'Execution still issued concurrent queries on one PostgreSQL transaction client.');\n  report.concurrentTransactionQueryWarnings = concurrentQueryWarnings.length;\n"+pass);
writeFileSync(path,source);
