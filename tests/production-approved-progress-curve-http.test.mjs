import test from 'node:test';
import assert from 'node:assert/strict';
import {createFieldHandlers} from '../src/lib/field-operations-http.mjs';
import {WorkspaceError} from '../src/lib/workspace-policy.mjs';
import {context} from './fixtures/approved-progress-curve-fixture.mjs';
const session={authenticated:true,verification:'clerk-production-jwt',userId:'user_CurveSynthetic',organizationId:'org_CurveSynthetic',organizationRole:'org:admin'};
function harness({identity=session,problem=null}={}){const calls=[];return{calls,handlers:createFieldHandlers({verify:async()=>identity,operations:{async progressCurve(seen,input){calls.push({seen,input});if(problem)throw problem;return{synthetic:true,input};},async save(){throw Error('No write should occur in a curve GET');}}})};}
const url=extra=>'https://obrasaas.com/api/identity/field-operations?'+new URLSearchParams({projectId:context.projectId,scope:context.scope,progressCurveTaskId:context.taskId,...extra});
test('existing authenticated GET dispatches exact task and cursor with private no-store headers',async()=>{
 const h=harness(),response=await h.handlers.GET(new Request(url({progressCurveCursor:'synthetic-cursor'})));assert.equal(response.status,200);assert.equal(h.calls.length,1);assert.equal(h.calls[0].seen,session);assert.deepEqual(h.calls[0].input,{projectId:context.projectId,scope:context.scope,taskId:context.taskId,cursor:'synthetic-cursor'});assert.match(response.headers.get('cache-control'),/private, no-store/);assert.equal(response.headers.get('x-content-type-options'),'nosniff');
});
test('curve GET rejects mixed query families, duplicate fields, missing task and invalid cursor before dispatch',async()=>{
 for(const target of [url({hoursFormat:'json'}),url({operationId:'operation_other'}),url({progressCurveCursor:''}),url({})+'&progressCurveTaskId=other',url({}).replace('progressCurveTaskId=task_curve','progressCurveCursor=only'),url({progressCurveTaskId:'../foreign'})]){const h=harness(),response=await h.handlers.GET(new Request(target));assert.equal(response.status,400);assert.equal(h.calls.length,0);}
});
test('synthetic auth denial and cross-site GET are rejected; no credentials or real JWT are issued by this test',async()=>{
 const missing=harness({identity:{authenticated:false}});assert.equal((await missing.handlers.GET(new Request(url({})))).status,401);assert.equal(missing.calls.length,0);const cross=harness();assert.equal((await cross.handlers.GET(new Request(url({}),{headers:{'sec-fetch-site':'cross-site'}}))).status,403);assert.equal(cross.calls.length,0);
});
test('canonical operation denial is preserved and POST cannot reinterpret curve parameters as a write',async()=>{
 const denied=harness({problem:new WorkspaceError('APPROVED_PROGRESS_PERMISSION_REQUIRED',403)}),response=await denied.handlers.GET(new Request(url({})));assert.equal(response.status,403);assert.deepEqual(await response.json(),{saved:false,code:'APPROVED_PROGRESS_PERMISSION_REQUIRED'});const h=harness();assert.equal((await h.handlers.POST(new Request(url({}),{method:'POST',headers:{origin:'https://obrasaas.com','Content-Type':'application/json'},body:'{}'}))).status,400);assert.equal(h.calls.length,0);
});
