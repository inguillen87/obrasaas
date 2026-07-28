import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const pageSource = readFileSync(
  new URL('../src/app/dashboard/inbox/page.js', import.meta.url),
  'utf8',
);
const clientSource = readFileSync(
  new URL('../src/app/dashboard/inbox/inbox-client.js', import.meta.url),
  'utf8',
);
const inboxSource = readFileSync(
  new URL('../src/lib/whatsapp/inbox.js', import.meta.url),
  'utf8',
);
const evidenceRouteSource = readFileSync(
  new URL('../src/app/api/evidence/[messageId]/route.js', import.meta.url),
  'utf8',
);

test('Inbox server page only loads canonical tasks behind both evidence-link permissions', () => {
  assert.match(
    pageSource,
    /hasTenantPermission\(access, 'org:execution:manage'\)[\s\S]{0,160}hasTenantPermission\(access, SOURCE_EVIDENCE_PERMISSION\)/,
  );
  assert.match(
    pageSource,
    /const progressEvidenceTasks = canLinkProgressEvidence\s*\?\s*\(await listCanonicalTasks\(getPrisma\(\),/,
  );
  assert.match(pageSource, /import \{ listCanonicalTasks \} from '@\/lib\/canonical-tasks'/);
  assert.match(pageSource, /canLinkProgressEvidence=\{canLinkProgressEvidence\}/);
  assert.match(pageSource, /const canViewSourceEvidence = hasTenantPermission\(access, SOURCE_EVIDENCE_PERMISSION\)/);
  assert.match(pageSource, /canViewSourceEvidence=\{canViewSourceEvidence\}/);
  assert.match(pageSource, /progressEvidenceTasks=\{progressEvidenceTasks\}/);
});

test('Inbox opens authorized inbound media only through the protected evidence endpoint', () => {
  assert.match(clientSource, /sourceEvidenceViewable: source\.sourceEvidenceViewable === true/);
  assert.match(
    clientSource,
    /canOpenSourceEvidence && message\.sourceEvidenceViewable[\s\S]{0,220}href=\{`\/api\/evidence\/\$\{encodeURIComponent\(message\.id\)\}\?preview=1`\}/,
  );
  const attachmentAction = clientSource.indexOf('canOpenSourceEvidence={canViewSourceEvidence}');
  const progressAction = clientSource.indexOf('<ProgressEvidenceAction', attachmentAction);
  assert.ok(attachmentAction >= 0);
  assert.ok(progressAction > attachmentAction);
  assert.doesNotMatch(clientSource, /href=\{message\.(?:mediaUrl|storage)/);
  assert.match(evidenceRouteSource, /authorize\(access, SOURCE_EVIDENCE_PERMISSION\)/);
  assert.match(evidenceRouteSource, /SAFE_INLINE_EVIDENCE_TYPES\.has\(normalizedContentType\)/);
  assert.match(evidenceRouteSource, /"Cache-Control": "private, no-store"/);
  assert.match(evidenceRouteSource, /"Content-Security-Policy": "sandbox"/);
});

test('Inbox image action calls the progress-evidence contract with one reusable key per attempt', () => {
  assert.match(
    clientSource,
    /message\.progressEvidenceLinked[\s\S]{0,180}<ProgressEvidenceLinkedState[\s\S]{0,180}message\.progressEvidenceEligible[\s\S]{0,220}<ProgressEvidenceAction/,
  );
  assert.match(
    clientSource,
    /\/progress-evidence\?projectId=\$\{encodeURIComponent\(projectId\)\}/,
  );
  assert.match(clientSource, /'Idempotency-Key': attempt\.idempotencyKey/);
  assert.match(clientSource, /body: JSON\.stringify\(\{\s*projectId,\s*taskId: selectedTask\.id/);
  assert.match(
    clientSource,
    /attemptRef\.current\?\.taskId === selectedTask\.id[\s\S]{0,220}createIdempotencyKey\('progress-evidence'\)[\s\S]{0,120}attemptRef\.current = attempt/,
  );
  assert.match(clientSource, /requestPendingRef\.current[\s\S]{0,80}confirmedRef\.current/);
  assert.match(clientSource, /payload\.replayed === true/);
  assert.match(clientSource, /No se creó un duplicado/);
  assert.match(clientSource, /disabled=\{!online \|\| !selectedTask \|\| pending \|\| confirmed\}/);
});

test('Inbox DTO never advertises unauthorized, quarantined, medical, or hidden images', () => {
  assert.match(
    inboxSource,
    /includeSourceEvidence[\s\S]{0,240}kind === 'IMAGE'[\s\S]{0,160}metadata\.authorized === true[\s\S]{0,120}metadata\.quarantined !== true/,
  );
  assert.match(inboxSource, /!isMedicalEvidenceRecord\(safeMessage\)/);
  assert.match(
    inboxSource,
    /const sourceEvidenceViewable = Boolean\([\s\S]{0,240}includeSourceEvidence[\s\S]{0,200}safeMessage\.mediaUrl[\s\S]{0,120}metadata\.quarantined !== true/,
  );
  assert.match(inboxSource, /sourceEvidenceViewable,/);
  assert.match(inboxSource, /progressEvidenceEligible,/);
});

test('Inbox reload recognizes an already-linked image without offering another POST', () => {
  const relationSelections = inboxSource.match(
    /progressEvidenceSource: \{ select: \{ id: true \} \}/g,
  ) || [];
  assert.equal(relationSelections.length, 3);
  assert.match(
    inboxSource,
    /const progressEvidenceLinked = Boolean\(\s*includeSourceEvidence\s*&& safeMessage\.progressEvidenceSource\?\.id\s*\)/,
  );
  assert.match(
    inboxSource,
    /const progressEvidenceEligible = Boolean\(\s*includeSourceEvidence\s*&& !progressEvidenceLinked/,
  );
  assert.match(clientSource, /progressEvidenceLinked: source\.progressEvidenceLinked === true/);
  assert.match(clientSource, /Foto ya incorporada al avance/);
  assert.match(
    clientSource,
    /message\.progressEvidenceLinked \? \(\s*<ProgressEvidenceLinkedState \/>\s*\) : canLinkProgressEvidence && message\.progressEvidenceEligible/,
  );
});
