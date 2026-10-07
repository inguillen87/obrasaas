import test from 'node:test';
import assert from 'node:assert/strict';
import {lifecycleDisposableUrl,lifecycleEnvironment,createControlledLifecycleGraph} from '../scripts/fixtures/meta-signup-field-lifecycle-fixture.mjs';
import {createMetaCustomerProvider,META_CUSTOMER_INSPECTION_PHASE} from '../src/lib/meta-customer-provider.mjs';

const permitted={CUTOVER_TEST_DISPOSABLE:'1',CUTOVER_TEST_DATABASE_URL:'postgresql://cutover_test@127.0.0.1:6549/obrasaas_cutover_ci'};
test('lifecycle harness requires explicit disposable opt-in and rejects production context before creating a client',()=>{
 assert.equal(lifecycleDisposableUrl(permitted).hostname,'127.0.0.1');
 for(const environment of [{...permitted,CUTOVER_TEST_DISPOSABLE:undefined},{...permitted,CUTOVER_TEST_DISPOSABLE:'true'},{...permitted,VERCEL:'1'},{...permitted,VERCEL_ENV:'production'},{...permitted,VERCEL_ENV:'preview'}])assert.throws(()=>lifecycleDisposableUrl(environment));
});
test('lifecycle harness rejects remote, wrong-name, non-Postgres and URL-option targets',()=>{
 for(const source of ['postgresql://cutover_test@ep-synthetic.neon.tech/obrasaas_cutover_ci','postgresql://cutover_test@127.0.0.1/neondb','https://127.0.0.1/obrasaas_cutover_ci','postgresql://cutover_test@127.0.0.1/obrasaas_cutover_ci?sslmode=require','postgresql://cutover_test@127.0.0.1/obrasaas_cutover_ci#production','postgresql://cutover_test@localhost/obrasaas_cutover_ci_backup'])assert.throws(()=>lifecycleDisposableUrl({...permitted,CUTOVER_TEST_DATABASE_URL:source}));
});
test('controlled Graph fixture refuses requests outside its exact synthetic allowlist without network fallback',async()=>{
 const graph=createControlledLifecycleGraph();
 await assert.rejects(graph.fetchImpl('https://attacker.example/v25.0/oauth/access_token',{redirect:'error'}));
 await assert.rejects(graph.fetchImpl('https://graph.facebook.com/v25.0/uncontrolled-endpoint',{redirect:'error'}));
 assert.equal(graph.unexpected.length,2);assert.equal(graph.messages.size,0);assert.ok([...graph.assets.values()].every(asset=>asset.exchanges===0&&asset.registrations===0&&asset.sends===0));
});
test('controlled dedicated provisioning and Cloud registration require a fresh real adapter inspection before one register POST',async()=>{
 const graph=createControlledLifecycleGraph(),asset=graph.assets.get('a'),provider=createMetaCustomerProvider({environment:lifecycleEnvironment,fetchImpl:graph.fetchImpl}),input={token:asset.token,wabaId:asset.wabaId,phoneNumberId:asset.phoneNumberId,numberMode:'DEDICATED'},preflight=await provider.inspect({...input,inspectionPhase:META_CUSTOMER_INSPECTION_PHASE.PRE_REGISTRATION});
 assert.deepEqual({isOnBizApp:preflight.isOnBizApp,platformType:preflight.platformType,phoneStatus:preflight.phoneStatus,registered:preflight.registered},{isOnBizApp:false,platformType:'NOT_APPLICABLE',phoneStatus:'PENDING',registered:false});assert.equal(asset.phoneInspections,1);assert.equal(asset.registrations,0);
 graph.setBeforeRequest(async(_asset,endpoint)=>{if(endpoint===asset.phoneNumberId+'/register')assert.equal(asset.phoneInspections,2);});
 assert.equal(await provider.register({token:asset.token,phoneNumberId:asset.phoneNumberId,pin:'731902',inspection:preflight}),true);assert.equal(asset.registrations,1);
 const connected=await provider.inspect(input);assert.deepEqual({isOnBizApp:connected.isOnBizApp,platformType:connected.platformType,phoneStatus:connected.phoneStatus,registered:connected.registered},{isOnBizApp:false,platformType:'CLOUD_API',phoneStatus:'CONNECTED',registered:true});assert.equal(asset.phoneInspections,3);
 await assert.rejects(provider.register({token:asset.token,phoneNumberId:asset.phoneNumberId,pin:'731902',inspection:preflight}),{code:'META_CUSTOMER_REGISTRATION_INSPECTION_REQUIRED'});assert.equal(asset.registrations,1);assert.deepEqual(graph.unexpected,[]);
});
