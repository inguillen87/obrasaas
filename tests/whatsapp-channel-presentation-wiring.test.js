import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('server surfaces derive the safe WhatsApp projection from stored health evidence', async () => {
  const [shell, dashboard, onboarding, projects, lifecycle, superadmin] = await Promise.all([
    source('src/lib/dashboard-shell.js'),
    source('src/app/dashboard/page.js'),
    source('src/app/dashboard/getting-started/page.js'),
    source('src/lib/projects.js'),
    source('src/lib/project-lifecycle.js'),
    source('src/app/superadmin/page.js'),
  ]);

  for (const candidate of [shell, dashboard, onboarding, projects, superadmin]) {
    assert.match(candidate, /deriveWhatsAppChannelPresentation/);
  }
  for (const candidate of [shell, dashboard, onboarding, projects, lifecycle, superadmin]) {
    assert.match(candidate, /metadata: true/);
    assert.match(candidate, /lastError: true/);
  }
  assert.match(shell, /whatsappConnected: whatsappChannel\.connected/);
  assert.match(dashboard, /whatsappStatus: whatsappChannel\.state/);
  assert.match(projects, /channel: whatsappChannel/);
  assert.match(superadmin, /whatsappRequiresAttention: attentionChannels > 0/);
  assert.match(superadmin, /pendingChannels/);
  assert.match(superadmin, /disabledChannels/);
});

test('client surfaces consume the projection instead of promoting raw CONNECTED rows', async () => {
  const [shell, readiness, onboarding, projects, superadmin] = await Promise.all([
    source('src/app/dashboard/dashboard-shell.js'),
    source('src/app/dashboard/platform-readiness.js'),
    source('src/app/dashboard/getting-started/page.js'),
    source('src/app/dashboard/projects/projects-client.js'),
    source('src/app/superadmin/superadmin-console.js'),
  ]);

  assert.match(shell, /whatsappChannel\.label/);
  assert.match(readiness, /whatsappChannel\.requiresAttention/);
  assert.match(onboarding, /whatsappChannel\.label/);
  assert.match(projects, /project\.whatsapp\?\.channel/);
  assert.doesNotMatch(projects, /project\.whatsapp\?\.status === 'CONNECTED'/);
  assert.match(superadmin, /whatsappTenantSummary/);
});
