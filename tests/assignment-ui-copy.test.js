import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const sources = ['src/app/dashboard/execution/assignment-overlap-check.js','src/lib/assignment-overlap-policy.js','src/lib/assignment-overlap-review.js','src/app/dashboard/execution/assignment-board.js','src/app/dashboard/execution/assignment-card.js','src/app/dashboard/execution/assignment-planner.js','src/app/dashboard/schedule-field-panel.js'];
test('assignment and schedule labels do not contain UTF-8 decoded as Latin-1 artifacts', () => {
  for (const file of sources) {
    const source = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /\u00c3[\u0080-\u00bf]|\u00c2[\u0080-\u00bf]|\ufffd/, file);
  }
});
