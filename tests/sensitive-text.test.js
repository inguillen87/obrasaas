import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SECURE_LINK_REDACTION,
  redactSensitiveText,
} from '../src/lib/sensitive-text.js';

test('historical secure webview links are redacted without losing the operational meaning', () => {
  const secret = 'eyJ2IjoyLCJzdWIiOiJ3b3JrZXItYSJ9.super-secret-signature';
  const text = `Registré tu ingreso. Compartí la ubicación desde https://obra.test/webview/attendance?worker=worker-a&token=${secret}`;

  const redacted = redactSensitiveText(text);

  assert.equal(redacted, `Registré tu ingreso. Compartí la ubicación desde ${SECURE_LINK_REDACTION}`);
  assert.doesNotMatch(redacted, /super-secret|token=|\/webview\/attendance/i);
});

test('generic bearer and query secrets are removed while ordinary audit copy is unchanged', () => {
  assert.equal(
    redactSensitiveText('Authorization: Bearer abcdefghijklmnop'),
    'Authorization: [secreto omitido]',
  );
  assert.equal(
    redactSensitiveText('Reintento https://api.test/send?id=42&token=abcdefghijk&mode=safe'),
    'Reintento https://api.test/send?id=42&token=[secreto omitido]&mode=safe',
  );
  assert.equal(
    redactSensitiveText('Ingreso registrado por Carlos a las 08:03.'),
    'Ingreso registrado por Carlos a las 08:03.',
  );
});
