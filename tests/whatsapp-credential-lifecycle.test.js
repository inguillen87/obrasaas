import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectWhatsAppCredentialLifecycle as inspect, advanceCredentialSnapshot, confirmCredentialSnapshot,
  validCredentialSnapshot, credentialRecoveryCopy, CREDENTIAL_WARNING_MS, CREDENTIAL_VERIFICATION_TTL_MS } from '../src/lib/whatsapp/credential-lifecycle.js';
const NOW = new Date('2026-09-19T18:00:00.000Z');
const scope = { organizationId: 'org-a', projectId: 'project-a' };
function connection(patch = {}) {
  return { enabled: true, connectionStatus: 'CONNECTED', encryptedAccessToken: 'must-not-leak', phoneNumberId: 'private-id',
    metadata: { channelHealth: { tokenStatus: 'VALID', checkedAt: NOW.toISOString(), expiresAt: NOW.getTime()/1000 + 172800, ...patch } } };
}
const read = row => inspect(row, { now: NOW });
test('a valid snapshot reports its deadlines without asserting a new provider check', () => {
  const result = read(connection()); assert.equal(result.state, 'CURRENT'); assert.equal(result.expirationKnown, true);
  assert.equal(result.blocksProviderActions, false); assert.equal(result.providerVerifiedByThisRead, false); assert.equal(validCredentialSnapshot(result), true);
});
test('projection never returns source IDs, secrets or arbitrary provider errors', () => {
  const row = connection(); row.metadata.error = 'a-sensitive-provider-message';
  const result = JSON.stringify(read(row));
  for (const value of ['must-not-leak','private-id','a-sensitive-provider-message','channelHealth','metadata']) assert.ok(!result.includes(value));
});
test('reading does not mutate the connection or create state', () => {
  const row = connection(); const before = JSON.stringify(row); read(row); assert.equal(JSON.stringify(row), before);
});
test('CONNECTED is overridden by the exact inclusive expiry boundary', () => {
  const result = read(connection({ expiresAt: NOW.getTime()/1000 }));
  assert.equal(result.state, 'EXPIRED'); assert.equal(result.blocksProviderActions, true); assert.equal(result.reauthorizationRequired, true);
});
test('one second before expiry warns instead of claiming delivery', () => {
  const result = read(connection({ expiresAt: NOW.getTime()/1000 + 1 })); assert.equal(result.state, 'EXPIRING'); assert.equal(result.reauthorizationRequired, false);
});
test('warning threshold is explicit and inclusive at 24 hours', () => {
  assert.equal(read(connection({ expiresAt: (NOW.getTime()+CREDENTIAL_WARNING_MS)/1000 })).state, 'EXPIRING');
  assert.equal(read(connection({ expiresAt: (NOW.getTime()+CREDENTIAL_WARNING_MS+1000)/1000 })).state, 'CURRENT');
});
for (const explicit of ['EXPIRED','INVALID']) test('explicit credential rejection overrides a future deadline: ' + explicit, () => {
  assert.equal(read(connection({ tokenStatus: explicit })).state, explicit);
});
for (const expiresAt of [null,undefined,0,'0']) test('no deadline does not mean a permanent credential: ' + String(expiresAt), () => {
  const result = read(connection({ expiresAt })); assert.equal(result.state, 'CURRENT'); assert.equal(result.expiresAt, null); assert.equal(result.expirationKnown, false);
});
test('a new modern snapshot does not inherit expiration of an earlier token', () => {
  const row = connection({ expiresAt: null }); row.metadata.expiresAt = NOW.getTime()/1000 - 1;
  assert.equal(read(row).state, 'CURRENT'); assert.equal(read(row).expirationKnown, false);
});
test('legacy verification retains its own expiration only when no modern snapshot exists', () => {
  const row = connection(); row.metadata = { scopes: ['a'], lastRemoteVerifiedAt: NOW.toISOString(), expiresAt: NOW.getTime()/1000-1 };
  assert.equal(read(row).state, 'EXPIRED');
});
for (const expiresAt of ['',false,true,{},[],-1,'-1','123wrong',1.5,Infinity,8640000000001]) test('malformed deadline is not healthy: ' + JSON.stringify(expiresAt), () => {
  const result = read(connection({ expiresAt })); assert.equal(result.state, 'UNKNOWN'); assert.equal(result.blocksProviderActions, true);
});
test('missing or future verification cannot be treated as current', () => {
  for (const checkedAt of [undefined,null,'yesterday',new Date(NOW.getTime()+301000).toISOString()]) assert.equal(read(connection({ checkedAt })).state, 'UNKNOWN');
});
test('freshness expires only after the canonical fifteen-minute interval', () => {
  const row = connection({ checkedAt: new Date(NOW.getTime()-CREDENTIAL_VERIFICATION_TTL_MS).toISOString() });
  assert.equal(read(row).state, 'CURRENT'); assert.equal(inspect(row,{now:new Date(NOW.getTime()+1)}).state,'RECHECK');
});
test('missing and disabled connections stay closed', () => {
  assert.equal(read(null).state,'UNLINKED'); assert.equal(read({...connection(),enabled:false}).state,'DISABLED'); assert.equal(read({...connection(),connectionStatus:'DISABLED'}).state,'DISABLED');
});
test('client advances from server time, not a browser wall clock', () => {
  const result = read(connection({ expiresAt: NOW.getTime()/1000 + 2 }));
  assert.equal(advanceCredentialSnapshot(result, 1999).state, 'EXPIRING'); assert.equal(advanceCredentialSnapshot(result, 2000).state, 'EXPIRED');
});
test('clock advancement cannot restore expired, unknown or revoked authorization', () => {
  for (const patch of [{tokenStatus:'INVALID'}, {tokenStatus:'UNKNOWN'}, {expiresAt:NOW.getTime()/1000}]) {
    const result=read(connection(patch)); assert.equal(advanceCredentialSnapshot(result,10000).state,result.state);
  }
  for (const duration of [-1,NaN,Infinity]) assert.equal(advanceCredentialSnapshot(read(connection()),duration),null);
});
test('scope is verified before exposing a credential snapshot', () => {
  const credential=read(connection()); assert.equal(confirmCredentialSnapshot({context:scope,credential},scope),credential);
  for (const context of [null,{...scope,projectId:'other'},{...scope,organizationId:'other'}]) assert.throws(()=>confirmCredentialSnapshot({context,credential},scope));
});
test('partial responses and contradictory grants fail closed', () => {
  const valid=read(connection());
  for (const patch of [{state:'BOGUS'},{expiresAt:'bad'},{providerVerifiedByThisRead:true},{version:9},{blocksProviderActions:true},{reauthorizationRequired:true}]) {
    assert.throws(()=>confirmCredentialSnapshot({context:scope,credential:{...valid,...patch}},scope));
  }
});
test('friendly copy offers reauthorization, not another company or forced send', () => {
  const copy=credentialRecoveryCopy(read(connection({tokenStatus:'EXPIRED'})));
  assert.match(copy.title,/venció/); assert.match(copy.description,/mismo número/); assert.match(copy.description,/no los crees otra vez/);
});
