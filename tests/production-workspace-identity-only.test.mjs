import assert from 'node:assert/strict';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createContext,runInContext} from 'node:vm';
import {test} from 'node:test';
import {parse} from '@babel/parser';
import {loadBindings,transform} from 'next/dist/build/swc/index.js';

await loadBindings();
const source=readFileSync(new URL('../src/app/(identity)/cuenta/workspace-client.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
const compiled=await transform(source+'\nexport {requestWorkspace,workspaceIdentityOnlyProject};\n',{filename:'workspace-client.js',jsc:{parser:{syntax:'ecmascript',jsx:true},target:'es2022',transform:{react:{runtime:'classic'}}},module:{type:'es6'}});
const {requestWorkspace,workspaceIdentityOnlyProject}=await import('data:text/javascript;base64,'+Buffer.from(compiled.code).toString('base64'));
const scope='a'.repeat(64),account={scope,projects:[{id:'p-a',name:'Obra propia',status:'ACTIVE'}],privateDiagnostic:'must not be projected'};
const errorFrom=async(status,body,contentType='application/json')=>{
 try{await requestWorkspace(async(_url,_options,consume)=>consume(new Response(contentType==='application/json'?JSON.stringify(body):body,{status,headers:{'content-type':contentType}})));assert.fail('A denial must throw');}catch(error){return error;}
};

test('canonical KYC denial opens only the assigned minimal identity context',async()=>{
 const error=await errorFrom(403,{code:'PARTICIPANT_KYC_REVIEW_REQUIRED',projectId:'foreign',scope:'foreign',tasks:[{title:'must not be projected'}]});
 assert.deepEqual(workspaceIdentityOnlyProject(error,account,'p-a'),{scope,projectId:'p-a',name:'Obra propia'});
 assert.equal(workspaceIdentityOnlyProject(error,account,'foreign'),null);
});
test('other HTTP denials and gateway bodies never grant identity self-service',async()=>{
 for(const [status,body,type]of [[401,{code:'PARTICIPANT_KYC_REVIEW_REQUIRED'},'application/json'],[409,{code:'PARTICIPANT_KYC_REVIEW_REQUIRED'},'application/json'],[500,{code:'PARTICIPANT_KYC_REVIEW_REQUIRED'},'application/json'],[403,{code:'WORKSPACE_PROJECT_UNAVAILABLE'},'application/json'],[403,'private gateway','text/html']]){
  assert.equal(workspaceIdentityOnlyProject(await errorFrom(status,body,type),account,'p-a'),null);
 }
});
test('missing, malformed or ambiguous observed account context stays restricted',async()=>{
 const error=await errorFrom(403,{code:'PARTICIPANT_KYC_REVIEW_REQUIRED'});
 for(const current of [null,{...account,scope:'unknown'},{...account,projects:[]},{...account,projects:[...account.projects,...account.projects]},{...account,projects:[{id:'p-a',name:null}]}])assert.equal(workspaceIdentityOnlyProject(error,current,'p-a'),null);
});
test('a different account cannot reuse the prior project selection',async()=>{
 const error=await errorFrom(403,{code:'PARTICIPANT_KYC_REVIEW_REQUIRED'});
 assert.equal(workspaceIdentityOnlyProject(error,{scope:'b'.repeat(64),projects:[{id:'p-b',name:'Otra empresa'}]},'p-a'),null);
});

test('actual identity producer emits and rechecks the complete fixture graph; single-reference mutant reproduces the missing catalog',()=>{
 const root=fileURLToPath(new URL('../',import.meta.url)),producerPath=path.join(root,'scripts/verify-workspace-identity-only-ui.mjs'),producer=readFileSync(producerPath,'utf8'),ast=parse(producer,{sourceType:'module'}),fixtureSource='scripts/lib/company-subscription-ui-fixture.mjs',catalogSource='src/lib/company-subscription-catalog.mjs';
 const contract=JSON.parse(readFileSync(path.join(root,'.github/workspace-acceptance-contract.json'),'utf8')),spec=contract.extension.proofs.find(proof=>proof.kind==='UI_IDENTITY_ONLY'),expected=[...spec.sourceFiles].sort(),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
 const walk=(node,visit)=>{if(!node||typeof node!=='object')return;visit(node);for(const value of Object.values(node))if(Array.isArray(value))value.forEach(child=>walk(child,visit));else if(value&&typeof value==='object')walk(value,visit);};
 const starts=ast.program.body.filter(node=>node.type==='VariableDeclaration'&&node.declarations.some(declaration=>declaration.id.name==='sourceManifest'));
 const stops=ast.program.body.filter(node=>node.type==='ExpressionStatement'&&node.expression.type==='CallExpression'&&node.expression.callee.name==='writeFileSync'&&node.expression.arguments[0]?.type==='CallExpression'&&node.expression.arguments[0].arguments.at(-1)?.value==='package.json');
 assert.equal(starts.length,1);assert.equal(stops.length,1);assert.ok(starts[0].start<stops[0].start);
 const emission=producer.slice(starts[0].start,stops[0].start),postLoops=[];
 walk(ast,node=>{if(node.type==='ForOfStatement'&&node.right.type==='Identifier'&&node.right.name==='sourceManifest')postLoops.push(node);});assert.equal(postLoops.length,1);
 const recheck=producer.slice(postLoops[0].start,postLoops[0].end);assert.match(recheck,/sourceBytes\(file\.path\)/);
 const fixtureCall=ast.program.body.filter(node=>node.type==='ExpressionStatement'&&node.expression.type==='CallExpression'&&node.expression.callee.name==='pinFixtureGraph'&&node.expression.arguments.length===1&&node.expression.arguments[0].value===fixtureSource);assert.equal(fixtureCall.length,1);
 const historicalReference="sourceManifest.push({path:'scripts/lib/company-subscription-ui-fixture.mjs',sha256:sha256(sourceBytes('scripts/lib/company-subscription-ui-fixture.mjs'))});";
 const mutant=emission.slice(0,fixtureCall[0].start-starts[0].start)+historicalReference+emission.slice(fixtureCall[0].end-starts[0].start);
 function execute(code){
  const overrides=new Map(),writes=new Map(),reads=[],fixture=path.join(root,'.vercel/controlled-identity-emitter-no-files-created');
  const sourceBytes=relative=>{assert.ok(!path.isAbsolute(relative)&&!relative.split(/[\\/]/).includes('..'));reads.push(relative);return overrides.get(relative)??readFileSync(path.join(root,relative));};
  const inside=target=>{const relative=path.relative(fixture,target);assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative));return relative.split(path.sep).join('/');};
  const context=createContext({assert,root,fixture,path,createHash,existsSync,statSync,sourceBytes,mkdirSync:target=>{inside(target);},writeFileSync:(target,bytes)=>{writes.set(inside(target),Buffer.from(bytes));}});
  runInContext(code+'\nglobalThis.emittedManifest=sourceManifest;',context,{timeout:10000});
  const manifest=JSON.parse(JSON.stringify(context.emittedManifest));
  return {manifest,reads,writes,change:relative=>overrides.set(relative,Buffer.concat([readFileSync(path.join(root,relative)),Buffer.from('\n// controlled source change\n')])),recheck:()=>runInContext(recheck,context,{timeout:10000})};
 }
 // Execute the actual pre-browser emitter and its actual post-browser byte
 // loop. FS writes remain in memory; no browser, server or proof is invented.
 const actual=execute(emission),names=actual.manifest.map(ref=>ref.path).sort();assert.deepEqual(names,expected);assert.equal(new Set(names).size,names.length);
 for(const ref of actual.manifest)assert.equal(ref.sha256,hash(readFileSync(path.join(root,ref.path))),ref.path);
 const closure=new Set();
 function fixtureGraph(relative){
  if(closure.has(relative))return;closure.add(relative);const moduleAst=parse(readFileSync(path.join(root,relative),'utf8'),{sourceType:'module'});
  for(const node of moduleAst.program.body)if(['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration'].includes(node.type)&&node.source?.value.startsWith('.')){
   const base=path.resolve(root,path.dirname(relative),node.source.value),resolved=[base,base+'.js',base+'.mjs',path.join(base,'index.js')].find(file=>existsSync(file)&&statSync(file).isFile());assert.ok(resolved);fixtureGraph(path.relative(root,resolved).split(path.sep).join('/'));
  }
 }
 fixtureGraph(fixtureSource);assert.ok(closure.has(catalogSource));for(const relative of closure){assert.equal(names.filter(name=>name===relative).length,1);assert.ok(actual.reads.includes(relative));}
 actual.recheck();actual.change(catalogSource);assert.throws(actual.recheck,/Copied UI source changed during validation: src\/lib\/company-subscription-catalog\.mjs/);
 const old=execute(mutant),oldNames=old.manifest.map(ref=>ref.path).sort();assert.deepEqual(expected.filter(name=>!oldNames.includes(name)),[catalogSource]);assert.deepEqual(oldNames.filter(name=>!expected.includes(name)),[]);assert.equal(oldNames.length,expected.length-1);assert.throws(()=>assert.deepEqual(oldNames,expected));
 old.change(catalogSource);assert.doesNotThrow(old.recheck,'The former emitter also missed the catalog in its real post-browser check');
 assert.ok(actual.writes.size>0);assert.equal(actual.writes.has(catalogSource),false,'The server fixture catalog is bound without copying it into the browser bundle');
});
