import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const routeSource = await readFile(
  new URL('../src/app/api/progress/upload/route.js', import.meta.url),
  'utf8',
);
const journalSource = await readFile(
  new URL('../src/lib/progress-journal.js', import.meta.url),
  'utf8',
);
const visualSource = await readFile(
  new URL('../src/lib/visual-progress-assessments.js', import.meta.url),
  'utf8',
);

test('progress uploads use a server-owned protected reservation without forcing Cloudinary', () => {
  assert.match(routeSource, /from '@\/lib\/protected-uploads'/);
  assert.match(routeSource, /stageProtectedUpload/);
  assert.match(routeSource, /normalizeProtectedUploadIdempotencyKey/);
  assert.doesNotMatch(routeSource, /from '@\/lib\/cloudinary'/);
  assert.match(routeSource, /return json\(\{ uploadId: result\.uploadId \}/);
  assert.doesNotMatch(routeSource, /return json\(\{ media:/);
  assert.match(routeSource, /progressBytesMatchMime\(fileBuffer, file\.type\)/);
  assert.match(routeSource, /PROGRESS_FILE_CONTENT_INVALID/);
});

test('progress deletion receives only uploadId and uses delete-vs-claim CAS', () => {
  assert.match(routeSource, /const uploadId = .*\?\.uploadId/);
  assert.match(routeSource, /deleteProtectedUpload/);
  assert.match(routeSource, /request\.headers\.get\('Idempotency-Key'\)/);
  assert.doesNotMatch(routeSource, /body\?\.media|media\?\.storage/);
});

test('progress provenance is claimed server-side and revalidated before visual provider access', () => {
  assert.match(journalSource, /claimProtectedUpload\(tx/);
  assert.match(journalSource, /PROTECTED_UPLOAD_PURPOSE\.PROGRESS/);
  assert.match(journalSource, /PROGRESS_MEDIA_DESCRIPTOR_FORBIDDEN/);
  assert.match(visualSource, /isWhatsAppProgressMediaForProject/);
  assert.match(visualSource, /isDashboardProgressMediaForProject/);
  assert.match(visualSource, /freshSource\?\.identity !== context\.sourceIdentity/);
  assert.match(visualSource, /await freshProviderGate\(prisma, context, (?:now|dispatchAt)\)/);
});
