import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  CONVERSATION_READ_PERMISSION,
  conversationScopeKey,
  loadDashboardConversationMessages,
  scopedConversationState,
  visibleConversationMessages,
} from '../src/lib/conversation-access.js';
import { roleHasPermission } from '../src/lib/tenant-roles.js';

const PROJECT_READ_PERMISSION = 'org:projects:read';

test('project readers without conversation access never materialize dashboard messages', async () => {
  for (const role of ['FINANCE', 'AUDITOR']) {
    assert.equal(roleHasPermission(role, PROJECT_READ_PERMISSION), true, role);
    assert.equal(roleHasPermission(role, CONVERSATION_READ_PERMISSION), false, role);

    let loadCount = 0;
    const messages = await loadDashboardConversationMessages({
      access: { tenantRole: role },
      allowed: roleHasPermission(role, CONVERSATION_READ_PERMISSION),
      loadMessages: async () => {
        loadCount += 1;
        return [{ id: 'must-not-leak' }];
      },
    });

    assert.deepEqual(messages, [], role);
    assert.equal(loadCount, 0, role);
  }
});

test('only conversation-enabled operational roles load dashboard messages', async () => {
  for (const role of ['ADMIN', 'DIRECTOR', 'SITE_MANAGER']) {
    assert.equal(roleHasPermission(role, CONVERSATION_READ_PERMISSION), true, role);

    const access = { tenantRole: role };
    let receivedAccess = null;
    let receivedOptions = null;
    const messages = await loadDashboardConversationMessages({
      access,
      allowed: roleHasPermission(role, CONVERSATION_READ_PERMISSION),
      includeMedicalEvidence: role === 'DIRECTOR',
      includeSourceEvidence: role === 'DIRECTOR',
      loadMessages: async (candidateAccess, options) => {
        receivedAccess = candidateAccess;
        receivedOptions = options;
        return [{ id: `${role.toLowerCase()}-message` }];
      },
    });

    assert.equal(receivedAccess, access, role);
    assert.deepEqual(receivedOptions, {
      includeMedicalEvidence: role === 'DIRECTOR',
      includeSourceEvidence: role === 'DIRECTOR',
    }, role);
    assert.deepEqual(messages, [{ id: `${role.toLowerCase()}-message` }], role);
  }
});

test('a permission downgrade or project switch hides already materialized messages synchronously', () => {
  const scopeA = conversationScopeKey({
    allowed: true,
    organizationId: 'org-a',
    projectId: 'project-a',
  });
  const scopeB = conversationScopeKey({
    allowed: true,
    organizationId: 'org-a',
    projectId: 'project-b',
  });
  const prior = scopedConversationState(scopeA, [{ id: 'message-from-project-a' }]);

  assert.deepEqual(visibleConversationMessages(prior, scopeA), [
    { id: 'message-from-project-a' },
  ]);
  assert.deepEqual(visibleConversationMessages(prior, scopeB), []);
  assert.deepEqual(visibleConversationMessages(prior, null), []);
  assert.equal(conversationScopeKey({
    allowed: false,
    organizationId: 'org-a',
    projectId: 'project-a',
  }), null);
});

test('WhatsApp API and all dashboard loading paths enforce the conversation boundary', async () => {
  const [routeSource, pageSource, clientSource, activitySource] = await Promise.all([
    readFile(new URL('../src/app/api/whatsapp/route.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/dashboard/page.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/dashboard/dashboard-client.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/dashboard/activity/page.js', import.meta.url), 'utf8'),
  ]);
  const getHandler = routeSource.slice(
    routeSource.indexOf('export async function GET()'),
    routeSource.indexOf('export async function POST('),
  );

  assert.match(
    getHandler,
    /requireTenantPermission\(access, CONVERSATION_READ_PERMISSION,\s*\{\s*subscriptionMode: "read",\s*\}\)/,
  );
  assert.doesNotMatch(getHandler, /org:projects:read/);
  assert.match(getHandler, /"Cache-Control": "private, no-store"/);
  assert.match(pageSource, /allowed: canReadConversations/);
  assert.match(pageSource, /canReadConversations,/);
  assert.match(pageSource, /organization:\s*\{\s*id: access\.organization\.id,/);
  assert.match(
    clientSource,
    /setup\.canReadConversations\s*\? fetch\('\/api\/whatsapp'/,
  );
  assert.match(
    clientSource,
    /setup\.canReadConversations \? \(async \(\) => \{\s*const messageRequestSequence = \+\+chatRefreshSequenceRef\.current;\s*const response = await fetch\('\/api\/whatsapp'/,
  );
  assert.match(clientSource, /const currentConversationScopeKey = conversationScopeKey\(/);
  assert.match(clientSource, /visibleConversationMessages\(chatState, currentConversationScopeKey\)/);
  assert.match(clientSource, /scopedConversationState\(currentConversationScopeKey, messages\)/);
  assert.match(clientSource, /const chatRefreshSequenceRef = useRef\(0\)/);
  assert.match(
    clientSource,
    /sequence !== null && sequence !== chatRefreshSequenceRef\.current/,
  );
  assert.match(
    clientSource,
    /chatRefreshSequenceRef\.current \+= 1;\s*commitChatMessages\(/,
  );
  assert.match(
    clientSource,
    /setup\.canReadConversations\s*\? \+\+chatRefreshSequenceRef\.current\s*: null/,
  );
  assert.match(
    clientSource,
    /const messageRequestSequence = \+\+chatRefreshSequenceRef\.current;\s*const response = await fetch\('\/api\/whatsapp'/,
  );
  assert.equal(
    (clientSource.match(/\{ sequence: messageRequestSequence \}/g) || []).length,
    2,
  );
  assert.match(clientSource, /\[commitChatMessages, initialMessages\]/);
  assert.match(
    activitySource,
    /canReadConversations\s*\? prisma\.message\.findMany\(/,
  );
  assert.match(
    activitySource,
    /canReadConversations: hasTenantPermission\(access, CONVERSATION_READ_PERMISSION\)/,
  );
});
