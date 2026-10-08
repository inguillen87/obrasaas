import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
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
