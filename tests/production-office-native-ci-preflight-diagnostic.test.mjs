import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {formatOfficeNativeCiPreflightError} from '../scripts/lib/office-chat-native-ci-preflight-error.mjs';
const context='OFFICE_NATIVE_CI_CONTEXT_REJECTED';
const envelope='OFFICE_NATIVE_CI_ENVELOPE_REJECTED';
const error=(code,message)=>Object.assign(new Error(message),{code});

test('known initial context guards retain their error code and a bounded public label',()=>{
 for(const [message,label]of [['Reviewed Node version with no preload required','NODE_RUNTIME'],['Ambient DB/provider configuration forbidden','AMBIENT_DB_PROVIDER'],['Actual owned SQL PostgreSQL17 identity required','SQL_IDENTITY']]){
  assert.equal(formatOfficeNativeCiPreflightError(error(context,message)),context+' guard='+label);
 }
});
test('envelope argument errors retain the independent envelope error code',()=>{
 assert.equal(formatOfficeNativeCiPreflightError(error(envelope,'Use --expected-head <actual commit>')),envelope+' guard=EXPECTED_HEAD_ARGUMENT');
 assert.equal(formatOfficeNativeCiPreflightError(error(envelope,'Reviewed Node version with no preload required')),envelope+' guard=UNCLASSIFIED');
});
test('unknown context messages never expose connection strings, tokens, env, or stack',()=>{
 const secret='postgresql://private:password@host/db?token=private-token';
 const e=error(context,secret+'\nDATABASE_URL='+secret);e.stack=secret;e.stderr=secret;e.env={DATABASE_URL:secret};
 assert.equal(formatOfficeNativeCiPreflightError(e),context+' guard=UNCLASSIFIED');
});
test('known dynamic guards redact secret suffixes and inspect counts expose only fixed labels',()=>{
 const secret='postgresql://private:password@host/db?token=private-token';
 for(const [message,label]of [
  ['Checkout RAW differs from committed Git blob: '+secret,'CHECKOUT_RAW_BLOB_MISMATCH'],
  ['Missing committed CI source: '+secret,'COMMITTED_CI_SOURCE_MISSING'],
  ['One inspected container required','INSPECT_CONTAINER_COUNT'],
  ['One inspected image required','INSPECT_IMAGE_COUNT'],
  ['One inspected network required','INSPECT_NETWORK_COUNT'],
 ]){
  const output=formatOfficeNativeCiPreflightError(error(context,message));
  assert.equal(output,context+' guard='+label);assert.equal(output.includes(secret),false);
  assert.equal(formatOfficeNativeCiPreflightError(error('FOREIGN_ERROR_CODE',message)),'OFFICE_NATIVE_CI_PREFLIGHT_FAILED guard=UNCLASSIFIED');
 }
 for(const message of ['One inspected volume required',secret+' Checkout RAW differs from committed Git blob: private-file','Reviewed Node version with no preload required\nprivate-token']){
  assert.equal(formatOfficeNativeCiPreflightError(error(context,message)),context+' guard=UNCLASSIFIED');
 }
});
test('foreign exception codes cannot become diagnostic output even with a known message',()=>{
 for(const code of ['ECONNREFUSED','private-token\nPASSWORD=secret',{},null]){
  assert.equal(formatOfficeNativeCiPreflightError(error(code,'Actual owned SQL PostgreSQL17 identity required')),'OFFICE_NATIVE_CI_PREFLIGHT_FAILED guard=UNCLASSIFIED');
 }
});
test('accessors and coercion are not invoked when examining errors',()=>{
 let reads=0;const e={toString(){reads++;throw new Error('private-token');}};
 for(const key of ['code','message','stack','stderr'])Object.defineProperty(e,key,{get(){reads++;throw new Error('private-token');}});
 assert.equal(formatOfficeNativeCiPreflightError(e),'OFFICE_NATIVE_CI_PREFLIGHT_FAILED guard=UNCLASSIFIED');assert.equal(reads,0);
 const inherited=Object.create({code:context,message:'Reviewed Node version with no preload required'});
 assert.equal(formatOfficeNativeCiPreflightError(inherited),'OFFICE_NATIVE_CI_PREFLIGHT_FAILED guard=UNCLASSIFIED');
});
test('non-errors and hostile descriptors produce the fixed fallback without throwing',()=>{
 for(const e of [null,undefined,42,'private-token',new Proxy({},{getOwnPropertyDescriptor(){throw new Error('private-token');}})]){
  assert.equal(formatOfficeNativeCiPreflightError(e),'OFFICE_NATIVE_CI_PREFLIGHT_FAILED guard=UNCLASSIFIED');
 }
 const output=formatOfficeNativeCiPreflightError(error(context,'private-token'.repeat(10000)));assert.equal(output,context+' guard=UNCLASSIFIED');assert.ok(output.length<100);
});
test('real entrypoint rejects an invalid argument with safe stderr before context or evidence creation',()=>{
 const root=fileURLToPath(new URL('../',import.meta.url));
 const entry=fileURLToPath(new URL('../scripts/verify-office-chat-native-ci.mjs',import.meta.url));
 const evidence=new URL('../.vercel/office-chat-native-ci/',import.meta.url),existed=existsSync(evidence);
 const env={TZ:'UTC',NO_COLOR:'1'};
 for(const key of ['SystemRoot','WINDIR','TEMP','TMP'])if(typeof process.env[key]==='string')env[key]=process.env[key];
 const child=spawnSync(process.execPath,[entry,'--invalid-preflight-argument'],{cwd:root,env,encoding:'utf8',maxBuffer:64*1024});
 assert.equal(child.error,undefined);assert.equal(child.signal,null);assert.equal(child.status,1);
 assert.equal(child.stdout,'');
 assert.equal(child.stderr.trim(),'OFFICE_NATIVE_CI_ENVELOPE_REJECTED guard=EXPECTED_HEAD_ARGUMENT');
 assert.equal(existsSync(evidence),existed,'Argument rejection must not create the native evidence directory');
});
