// Diagnostic-only loader for the existing disposable fixture. Never used by app code.
import {registerHooks} from 'node:module';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import path from 'node:path';

const target=pathToFileURL(path.join(process.cwd(),'scripts/verify-meta-development-pilot-postgres.mjs')).href;
const expected='eff7c2abeae73ae34f9e5ad68f27935481479db0bab611e008ff647269e9a377';
assert.equal(process.env.PILOT_FIXTURE_DIAGNOSTIC_ONLY,'1');
assert.equal(process.env.CUTOVER_TEST_DISPOSABLE,'1');
assert.ok(!process.env.VERCEL&&!process.env.VERCEL_ENV&&!process.env.VERCEL_TARGET_ENV);
registerHooks({load(url,context,nextLoad){
 const result=nextLoad(url,context);if(url!==target)return result;
 const source=Buffer.from(result.source).toString('utf8').replaceAll('\r\n','\n');
 assert.equal(createHash('sha256').update(source).digest('hex'),expected);
 const start='const fetchImpl=async(input,options)=>{\n';
 const end="\n};\ntry{\n await admin.connect();";
 assert.equal(source.split(start).length,2);assert.equal(source.split(end).length,2);
 const instrumented=source.replace(start,start+' try{\n').replace(end,`
 }catch(error){
  const site=typeof error?.stack==='string'?error.stack.split('\\n').filter(line=>line.includes('verify-meta-development-pilot-postgres.mjs:')).map(line=>line.trim().replace(/file:\\/\\/[^ )]*\\//g,'fixture/')).slice(0,3):[];
  console.error(JSON.stringify({event:'DISPOSABLE_PILOT_FETCH_CAUSE',diagnosticOnly:true,endpoint:new URL(input).pathname.split('/').at(-1),method:options.method,code:typeof error?.code==='string'?error.code:null,operator:typeof error?.operator==='string'?error.operator:null,site,transactionOpen:transactions.getStore()?.open??0,customerCredentialMatches:options.headers?.Authorization==='Bearer '+customerToken}));
  throw error;
 }
};
try{
 await admin.connect();`);
 assert.notEqual(instrumented,source);return {...result,source:instrumented};
}});
