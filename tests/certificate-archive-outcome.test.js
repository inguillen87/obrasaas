import assert from 'node:assert/strict';
import test from 'node:test';
import { isControlledArchiveLoser } from '../scripts/lib/certificate-archive-outcome.mjs';
const archived = { status:'ARCHIVED', actorActive:true, preparerEligible:false, versions:0, pending:null };
const pending = { status:'ACTIVE', actorActive:true, preparerEligible:true, versions:1, pending:'certificate-fixture' };
const error = (code, marker) => ({ code, message:marker + ': governed rejection' });
const preparer = error('42501','PROJECT_CERTIFICATE_PREPARER_REQUIRED');

test('the logged archive-first rejection is controlled only with unchanged active membership and no pending facts',()=>{
  assert.equal(isControlledArchiveLoser({prepareWon:false,error:preparer,state:archived}),true);
});
for(const change of [{status:'ACTIVE'},{actorActive:false},{preparerEligible:true},{versions:1},{pending:'unexpected'}, {pending:undefined}])test('preparer denial never conceals a wrong final state '+JSON.stringify(change),()=>{
  assert.equal(isControlledArchiveLoser({prepareWon:false,error:preparer,state:{...archived,...change}}),false);
});
for(const bad of [error('55000','PROJECT_CERTIFICATE_PREPARER_REQUIRED'),error('42501','PROJECT_CERTIFICATE_SCOPE_INVALID'),error('40P01','deadlock detected'),error('23505','duplicate key'),error('57014','statement timeout'),error('40001','PROJECT_ARCHIVE_BUSY'),{code:'42501',message:'prefix PROJECT_CERTIFICATE_PREPARER_REQUIRED: anything'},{code:'42501',message:'PROJECT_CERTIFICATE_PREPARER_REQUIRED_FOR_OTHER_SCOPE'},{}])test('unrelated error identity is rejected '+JSON.stringify(bad),()=>{
  assert.equal(isControlledArchiveLoser({prepareWon:false,error:bad,state:archived}),false);
});
for(const [code,marker] of [['55000','PROJECT_ARCHIVE_BLOCKED_BY_PENDING_GOVERNANCE'],['40001','PROJECT_ARCHIVE_BUSY']])test('prepare winner retains pending-review or contention protection '+marker,()=>{
  assert.equal(isControlledArchiveLoser({prepareWon:true,error:error(code,marker),state:pending}),true);
  assert.equal(isControlledArchiveLoser({prepareWon:false,error:error(code,marker),state:archived}),false);
});
for(const change of [{status:'ARCHIVED'},{actorActive:false},{preparerEligible:false},{versions:0},{versions:2},{pending:null},{pending:''}])test('archive rejection requires an intact pending certificate '+JSON.stringify(change),()=>{
  assert.equal(isControlledArchiveLoser({prepareWon:true,error:error('55000','PROJECT_ARCHIVE_BLOCKED_BY_PENDING_GOVERNANCE'),state:{...pending,...change}}),false);
});
test('prior not-ready result remains valid only for the archived winner',()=>{
  assert.equal(isControlledArchiveLoser({prepareWon:false,error:error('55000','PROJECT_CERTIFICATE_NOT_READY'),state:archived}),true);
  assert.equal(isControlledArchiveLoser({prepareWon:true,error:preparer,state:pending}),false);
  assert.equal(isControlledArchiveLoser(),false);
  assert.equal(isControlledArchiveLoser({prepareWon:'false',error:preparer,state:archived}),false);
});
