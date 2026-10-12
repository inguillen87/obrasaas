import assert from 'node:assert/strict';
import test from 'node:test';
import {taskProgressMeasurementDisposableUrl} from '../scripts/verify-task-progress-measurement-postgres.mjs';

const target={CUTOVER_TEST_DISPOSABLE:'1',CUTOVER_TEST_DATABASE_URL:'postgresql://cutover_test:cutover_test@127.0.0.1:5432/obrasaas_cutover_ci'};
const denied=value=>assert.throws(()=>taskProgressMeasurementDisposableUrl(value),{code:'TASK_PROGRESS_DISPOSABLE_TARGET_REJECTED'});

test('native measurement fixture requires an explicit disposable marker before any connection',()=>{
  for(const value of [{},{CUTOVER_TEST_DATABASE_URL:target.CUTOVER_TEST_DATABASE_URL},{...target,CUTOVER_TEST_DISPOSABLE:'true'},{...target,CUTOVER_TEST_DISPOSABLE:'0'}])denied(value);
});

test('only named local cutover databases with bounded fixture identities are accepted',()=>{
  assert.equal(taskProgressMeasurementDisposableUrl(target).href,target.CUTOVER_TEST_DATABASE_URL);
  for(const host of ['localhost','127.0.0.1'])assert.equal(taskProgressMeasurementDisposableUrl({...target,CUTOVER_TEST_DATABASE_URL:`postgresql://cutover_test@${host}:6549/obrasaas_cutover_ci`}).hostname,host);
});

test('remote, production, foreign local databases, credentials and URL options fail closed',()=>{
  for(const value of [
    'postgresql://cutover_test:cutover_test@ep-synthetic.neon.tech:5432/neondb',
    'postgresql://cutover_test:cutover_test@example.invalid:5432/obrasaas_cutover_ci',
    'postgresql://cutover_test:cutover_test@127.0.0.1:5432/neondb',
    'postgresql://production_account:synthetic@127.0.0.1:5432/obrasaas_cutover_ci',
    'postgresql://cutover_test:private@127.0.0.1:5432/obrasaas_cutover_ci',
    'postgresql://cutover_test:cutover_test@127.0.0.1:6549/obrasaas_cutover_ci',
    'postgresql://cutover_test:cutover_test@127.0.0.1:5433/obrasaas_cutover_ci',
    'postgresql://cutover_test:cutover_test@127.0.0.1/obrasaas_cutover_ci',
    target.CUTOVER_TEST_DATABASE_URL+'?sslmode=require',
    target.CUTOVER_TEST_DATABASE_URL+'#other',
    'https://127.0.0.1:5432/obrasaas_cutover_ci',
  ])denied({...target,CUTOVER_TEST_DATABASE_URL:value});
  for(const key of ['VERCEL','VERCEL_ENV','VERCEL_TARGET_ENV'])denied({...target,[key]:'production'});
});

test('ordinary application database configuration cannot opt into this fixture',()=>{
  denied({DATABASE_URL:target.CUTOVER_TEST_DATABASE_URL,CUTOVER_TEST_DISPOSABLE:'1'});
  denied({DATABASE_URL:target.CUTOVER_TEST_DATABASE_URL,CUTOVER_TEST_DATABASE_URL:target.CUTOVER_TEST_DATABASE_URL});
});
