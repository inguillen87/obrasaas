import test from 'node:test';
import assert from 'node:assert/strict';
import {copyFileSync,existsSync,lstatSync,mkdirSync,mkdtempSync,readFileSync,readdirSync,realpathSync,unlinkSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse} from '@babel/parser';
import {copyPlanDocumentCurveFixture} from '../scripts/lib/plan-document-curve-fixture-copy.mjs';
import {applyCivilBankIntakeDeadlockControl} from '../scripts/lib/participant-bank-intake-fixture.mjs';
import {captureOwnedFixture,removeOwnedFixture} from '../scripts/lib/owned-fixture-cleanup.mjs';

const root=realpathSync(fileURLToPath(new URL('../',import.meta.url)));
const componentRoot=path.join(root,'src/app/(identity)/cuenta');
const harnesses=[
 'scripts/verify-employee-intake-ui.mjs',
 'scripts/verify-mobile-identity-ui.mjs',
 'scripts/verify-participant-bank-intake-ui.mjs',
 'scripts/verify-participant-field-permissions-ui.mjs',
 'scripts/verify-participant-office-account-ui.mjs',
 'scripts/verify-participant-onboarding-delivery-ui.mjs',
 'scripts/verify-participant-kyc-chat-closure-ui.mjs',
 'scripts/verify-participants-ui.mjs',
];
const entries=['participant-panel.js','kyc-photo-preparation.js'];
const omissions=['kyc-camera-session.mjs','participant-kyc-capture.js','participant-kyc-capture.module.css','participant-kyc-preanalysis-view.mjs'];
function inside(parent,target){const relative=path.relative(parent,target);return relative!==''&&relative!=='..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative);}
function walk(node,visit){if(!node||typeof node!=='object')return;visit(node);for(const [key,value]of Object.entries(node)){if(['loc','start','end','extra','comments','tokens'].includes(key))continue;if(Array.isArray(value))value.forEach(child=>walk(child,visit));else if(value&&typeof value==='object')walk(value,visit);}}
const ast=source=>parse(source,{sourceType:'module',plugins:['jsx']});
const pathJoin=(node,args)=>node?.type==='CallExpression'&&node.callee.type==='MemberExpression'&&node.callee.object.name==='path'&&node.callee.property.name==='join'&&node.arguments.length===args.length&&node.arguments.every((arg,index)=>typeof args[index]==='string'?arg.type==='Identifier'&&arg.name===args[index]:arg.type==='StringLiteral'&&arg.value===args[index].literal);

// Read only literal data connected to the harness's actual copy loop. Never
// import or evaluate the harness: its browser/server preamble must not execute.
function copiedNames(harness){
 const tree=ast(readFileSync(path.join(root,harness),'utf8')),matches=[];
 walk(tree,node=>{
  if(node.type!=='ForOfStatement'||node.right.type!=='Identifier')return;
  const variable=node.left.declarations?.[0]?.id?.name;if(!variable)return;
  let copies=false;
  walk(node.body,child=>{if(child.type==='CallExpression'&&child.callee.name==='copyFileSync'&&pathJoin(child.arguments[0],['root',{literal:'src/app/(identity)/cuenta'},variable])&&pathJoin(child.arguments[1],['app',variable]))copies=true;});
  if(copies)matches.push(node.right.name);
 });
 assert.equal(matches.length,1,'One real account-component copy loop: '+harness);
 const declarations=[];
 walk(tree,node=>{if(node.type==='VariableDeclarator'&&node.id.name===matches[0])declarations.push(node.init);});
 assert.equal(declarations.length,1,'Unambiguous copy-list declaration: '+harness);
 assert.equal(declarations[0].type,'ArrayExpression');
 const names=declarations[0].elements.map(node=>{assert.equal(node?.type,'StringLiteral','Copy list must remain literal');assert.match(node.value,/^[a-z0-9][a-z0-9.-]*\.(?:js|mjs|css)$/);return node.value;});
 assert.equal(new Set(names).size,names.length);assert.ok(entries.every(entry=>names.includes(entry)));
 return names;
}
function importsOf(file){
 const source=readFileSync(file,'utf8');
 if(file.endsWith('.css')){assert.doesNotMatch(source,/@import\b|url\s*\(/i,'CSS dependencies need explicit fixture resolution');return [];}
 assert.match(file,/\.(?:js|mjs)$/);
 const imports=[];walk(ast(source),node=>{
  if(['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration'].includes(node.type)&&node.source)imports.push(node.source.value);
  if(node.type==='ImportExpression'){assert.equal(node.source.type,'StringLiteral');imports.push(node.source.value);}
  if(node.type==='CallExpression'&&node.callee.type==='Import'){assert.equal(node.arguments[0]?.type,'StringLiteral');imports.push(node.arguments[0].value);}
 });return imports;
}
function closure(directory,initial){
 const files=new Set();
 function visit(file){
  assert.ok(inside(directory,file));if(files.has(file))return;
  const stat=lstatSync(file);assert.ok(stat.isFile()&&!stat.isSymbolicLink());assert.equal(realpathSync(file),file);files.add(file);
  for(const specifier of importsOf(file)){
   if(!specifier.startsWith('.'))continue;
   const base=path.resolve(path.dirname(file),specifier),target=[base,base+'.js',base+'.mjs',base+'.css',path.join(base,'index.js')].find(candidate=>existsSync(candidate)&&lstatSync(candidate).isFile());
   if(!target)throw Object.assign(Error('Generated fixture relative import missing: '+path.relative(directory,file)+' -> '+specifier),{code:'FIXTURE_RELATIVE_IMPORT_MISSING'});
   visit(target);
  }
 }
 initial.forEach(visit);return [...files].sort();
}
function noReparseTree(directory){
 assert.ok(!lstatSync(directory).isSymbolicLink());assert.equal(realpathSync(directory),directory);
 for(const item of readdirSync(directory)){const file=path.join(directory,item),stat=lstatSync(file);assert.ok(inside(directory,file)&&!stat.isSymbolicLink());assert.equal(realpathSync(file),file);if(stat.isDirectory())noReparseTree(file);}
}
async function withFixture(harness,run){
 const privateRoot=path.join(root,'.vercel','private'),prefix='participant-kyc-closure-unit-';mkdirSync(privateRoot,{recursive:true});
 const fixture=mkdtempSync(path.join(privateRoot,prefix)),ownership=captureOwnedFixture({workspaceRoot:root,privateRoot,fixture,prefix});
 try{
  const app=path.join(fixture,'app'),mapping=new Map();mkdirSync(app);
  for(const name of copiedNames(harness)){const original=path.join(componentRoot,name),target=path.join(app,name);copyFileSync(original,target);assert.deepEqual(readFileSync(target),readFileSync(original));mapping.set(target,original);}
  const result=copyPlanDocumentCurveFixture({root,fixture,components:app,sourceManifest:[]});
  for(const row of result.moduleFixturePaths){assert.equal(row.copiedExactly,true);mapping.set(row.fixturePath,path.join(root,row.sourcePath));}
  const generatedEntries=entries.map(name=>path.join(app,name));
  const actual=()=>closure(fixture,generatedEntries).map(file=>{assert.ok(mapping.has(file),'Every generated source has canonical provenance');return mapping.get(file);}).sort();
  await run({fixture,app,actual});
 }finally{
  // No server or browser is created. Reject links in the complete owned tree
  // before invoking the canonical identity-pinned removal helper.
  noReparseTree(fixture);
  const result=await removeOwnedFixture(ownership,{serverClosedBeforeFixtureRemoval:true});
  assert.equal(result.fixtureRemoved,true);assert.equal(existsSync(fixture),false);
 }
}

for(const harness of harnesses)test(harness+' generates the real KYC import closure and rejects omitted camera/capture dependencies',async()=>{
 const expected=closure(root,entries.map(name=>path.join(componentRoot,name)));
 const sourceBytes=new Map([...expected,path.join(root,harness)].map(file=>[file,readFileSync(file)]));
 await withFixture(harness,async({app,actual})=>{
  assert.deepEqual(actual(),expected);
  for(const name of omissions){
   const file=path.join(app,name),bytes=readFileSync(file);unlinkSync(file);
   try{assert.throws(actual,{code:'FIXTURE_RELATIVE_IMPORT_MISSING'},'Omission must break the generated graph: '+name);}
   finally{writeFileSync(file,bytes);}
   assert.deepEqual(actual(),expected,'Restoring the exact omitted bytes repairs fixture closure');
  }
 });
 for(const [file,bytes]of sourceBytes)assert.deepEqual(readFileSync(file),bytes,'Original source stays unchanged: '+file);
});

test('bank causal bad-resolution control applies to the current generated panel and retains the complete import closure',async()=>{
 await withFixture('scripts/verify-participant-bank-intake-ui.mjs',async({app,actual})=>{
  const before=actual(),result=applyCivilBankIntakeDeadlockControl(app);
  assert.equal(result.runtimeSourceEdited,false);assert.notEqual(result.originalSha256,result.fixtureSha256);
  assert.deepEqual(actual(),before);
 });
});
