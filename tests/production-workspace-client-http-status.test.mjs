import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {loadBindings,transform} from 'next/dist/build/swc/index.js';

await loadBindings();
const source=readFileSync(new URL('../src/app/(identity)/cuenta/workspace-client.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
const compiled=await transform(source+'\nexport {requestWorkspace,guideAccessDenied};\n',{filename:'workspace-client.js',jsc:{parser:{syntax:'ecmascript',jsx:true},target:'es2022',transform:{react:{runtime:'classic'}}},module:{type:'es6'}});
const {requestWorkspace,guideAccessDenied}=await import('data:text/javascript;base64,'+Buffer.from(compiled.code).toString('base64'));
const transport=response=>async(_endpoint,_options,consume)=>consume(response);

for(const status of [401,403])test('HTML '+status+' preserves authority denial without parsing the gateway body',async()=>{
 const response=new Response('<html>private gateway diagnostic</html>',{status,headers:{'content-type':'text/html'}});let jsonReads=0;
 response.json=async()=>{jsonReads++;throw new SyntaxError('private diagnostic must not be displayed');};
 await assert.rejects(requestWorkspace(transport(response),'?scope=current&projectId=assigned'),error=>error.status===status&&guideAccessDenied(error)&&!error.message.includes('diagnostic'));
 assert.equal(jsonReads,0);
});
test('JSON context conflict retains its canonical code and invalidates the observed context',async()=>{
 const response=new Response(JSON.stringify({code:'WORKSPACE_CONTEXT_CHANGED'}),{status:409,headers:{'content-type':'application/json'}});
 await assert.rejects(requestWorkspace(transport(response)),error=>error.status===409&&error.code==='WORKSPACE_CONTEXT_CHANGED'&&guideAccessDenied(error));
});
test('JSON schedule revision conflict keeps the original recovery behavior',async()=>{
 const response=new Response(JSON.stringify({code:'SCHEDULE_REVISION_CHANGED'}),{status:409,headers:{'content-type':'application/json'}});
 await assert.rejects(requestWorkspace(transport(response)),error=>error.status===409&&error.code==='SCHEDULE_REVISION_CHANGED'&&!guideAccessDenied(error)&&error.message.includes('Otra persona modificó'));
});
test('malformed JSON server failure remains a 500 rather than a parser diagnostic',async()=>{
 const response=new Response('private malformed gateway payload',{status:500,headers:{'content-type':'application/json'}});
 await assert.rejects(requestWorkspace(transport(response)),error=>error.status===500&&!guideAccessDenied(error)&&!error.message.includes('payload')&&error.name!=='SyntaxError');
});
test('malformed successful body shows a readable failed consultation',async()=>{
 const response=new Response('private malformed success',{status:200,headers:{'content-type':'application/json'}});
 await assert.rejects(requestWorkspace(transport(response)),error=>error.message.includes('Volvé a consultar')&&!error.message.includes('private')&&error.name!=='SyntaxError');
});
test('successful read uses the original query and options and returns the canonical body',async()=>{
 const body={scope:'current',project:{id:'assigned'},tasks:[]},options={signal:new AbortController().signal};let calls=0;
 const result=await requestWorkspace(async(endpoint,actualOptions,consume)=>{calls++;assert.equal(endpoint,'/api/identity/workspace?scope=current&projectId=assigned');assert.equal(actualOptions,options);return consume(new Response(JSON.stringify(body),{headers:{'content-type':'application/json'}}));},'?scope=current&projectId=assigned',options);
 assert.equal(calls,1);assert.deepEqual(result,body);
});
