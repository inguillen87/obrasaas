import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { CREDENTIAL_VERIFICATION_TTL_MS } from '../src/lib/whatsapp/credential-lifecycle.js';
import { WHATSAPP_REMOTE_HEALTH_SNAPSHOT_TTL_MS } from '../src/lib/whatsapp/channel-health.js';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
test('recovery uses the existing verification freshness window',()=>assert.equal(CREDENTIAL_VERIFICATION_TTL_MS,WHATSAPP_REMOTE_HEALTH_SNAPSHOT_TTL_MS));
test('recovery is bound to company/project and does not replace canonical Graph gates',()=>{
 const source=read('src/app/dashboard/integrations/integrations-client.js');
 assert.match(source,/lifecycleView\?\.organizationId === organizationId/);assert.match(source,/lifecycleView\?\.projectId === projectId/);
 assert.match(source,/whatsappGraphAccessReady\(connection, channelHealth\) && !lifecycleBlocked/);
 assert.match(source,/whatsappReconnectRequired\(connection, channelHealth\) \|\| lifecycleReauthorization/);
 assert.match(source,/channelHealth && !lifecycleBlocked/);assert.match(source,/setLifecycleView\(null\)/);
});
test('customer recovery points to the existing explicit Meta form, not pilot import or automatic sends',()=>{
 const source=read('src/app/dashboard/integrations/channel-recovery-panel.js');
 assert.match(source,/customer-whatsapp-authorization/);assert.match(source,/method: 'GET'/);assert.doesNotMatch(source,/method: '(POST|PATCH|DELETE)'|FB\.login|pilot-import/);
 const client=read('src/app/dashboard/integrations/integrations-client.js');assert.match(client,/linked && !internalWorkspace && <ChannelRecoveryPanel/);assert.match(client,/onStatus=\{setLifecycleView\} onVerify=\{verifyChannel\}/);
});
test('new state reads do not remount or discard the preparation form',()=>{
 const source=read('src/app/dashboard/integrations/integrations-client.js');assert.match(source,/onState=\{setPreparedWorkspace\} connectionPending=\{pending\}/);
 const panel=read('src/app/dashboard/integrations/channel-recovery-panel.js');assert.doesNotMatch(panel,/setPreparedWorkspace|localStorage|sessionStorage|indexedDB|onPinChange/);
});
