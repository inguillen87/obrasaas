import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildActivityCsv,
  sanitizeActivityEntry,
} from '../src/lib/activity-export.js';

const historicalToken = 'eyJ2IjoyLCJzdWIiOiJ3b3JrZXItYSJ9.historical-secret-signature';
const historicalEntry = {
  id: 'message-outbound-a',
  occurredAt: '2026-08-10T11:30:00.000Z',
  group: 'FIELD',
  category: 'MESSAGE',
  severity: 'INFO',
  title: 'Respuesta de ObraSaaS',
  description: `Registré tu ingreso. Abrí https://obra.test/webview/attendance?worker=worker-a&token=${historicalToken}`,
  actor: '=HYPERLINK("https://attacker.invalid")',
  source: 'whatsapp',
  reference: 'salida · mensaje',
};

test('historical activity rows are redacted at the serialization boundary', () => {
  const safe = sanitizeActivityEntry(historicalEntry);

  assert.equal(safe.id, historicalEntry.id);
  assert.equal(safe.occurredAt, historicalEntry.occurredAt);
  assert.match(safe.description, /^Registré tu ingreso\./);
  assert.match(safe.description, /enlace seguro omitido/i);
  assert.doesNotMatch(JSON.stringify(safe), /historical-secret|token=|\/webview\/attendance/i);
});

test('CSV export re-redacts historical rows and blocks spreadsheet formulas', () => {
  const csv = buildActivityCsv([historicalEntry], {
    timezone: 'America/Argentina/Buenos_Aires',
    groupLabels: { FIELD: 'Campo' },
    categoryLabels: { MESSAGE: 'Comunicación' },
  });

  assert.match(csv, /Registré tu ingreso\./);
  assert.match(csv, /enlace seguro omitido/i);
  assert.match(csv, /"'=HYPERLINK\(""https:\/\/attacker\.invalid""\)"/);
  assert.doesNotMatch(csv, /historical-secret|token=|\/webview\/attendance/i);
});
