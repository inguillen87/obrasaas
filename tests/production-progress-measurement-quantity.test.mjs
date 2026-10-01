import assert from 'node:assert/strict';
import test from 'node:test';

import {
  compareProgressMeasurementQuantities,
  normalizeProgressMeasurementQuantity,
  parseProgressMeasurementQuantity,
  progressMeasurementPercent,
} from '../src/lib/progress-measurement-quantity.js';

test('Decimal(18,4) quantities normalize without JavaScript Number', () => {
  assert.equal(normalizeProgressMeasurementQuantity('0'), '0.0000');
  assert.equal(normalizeProgressMeasurementQuantity('12.3'), '12.3000');
  assert.equal(normalizeProgressMeasurementQuantity('99999999999999.9999'), '99999999999999.9999');
  assert.equal(compareProgressMeasurementQuantities('1.0000', '1'), 0);
  assert.equal(progressMeasurementPercent('2.5000', '10.0000'), '25.0000');
});

test('Decimal parser rejects lossy, signed, exponential, overflow and non-string inputs', () => {
  for (const value of [1, '01', '+1', '-1', '1e3', '1,5', '.5', '1.', '0.00000', '100000000000000', ' 1']) {
    assert.throws(() => parseProgressMeasurementQuantity(value), /decimal exacto/);
  }
  assert.throws(
    () => parseProgressMeasurementQuantity('0', { allowZero: false, field: 'baseQuantity' }),
    /mayor que cero/,
  );
});
