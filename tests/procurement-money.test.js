import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PROCUREMENT_MONEY_MAX_SCALED,
  ProcurementMoneyError,
  calculateProcurementOrderTotal,
  formatProcurementMoney,
  parseProcurementMoney,
} from '../src/lib/procurement-money.js';
import { parseProcurementQuantity } from '../src/lib/procurement-quantity.js';

test('procurement money parses and formats exact Decimal(14,2) cents', () => {
  assert.equal(parseProcurementMoney('0', { allowZero: true }), 0n);
  assert.equal(parseProcurementMoney('0.1'), 10n);
  assert.equal(parseProcurementMoney('0001.20'), 120n);
  assert.equal(parseProcurementMoney('999999999999.99'), PROCUREMENT_MONEY_MAX_SCALED);
  assert.equal(formatProcurementMoney(1n), '0.01');
  assert.equal(formatProcurementMoney(120n), '1.20');
});

test('external money rejects numbers, whitespace, signs, exponent and excess scale', () => {
  for (const value of [null, undefined, 1, 1.25, 1n, {}, ['1.00']]) {
    assert.throws(
      () => parseProcurementMoney(value, { allowZero: true }),
      (error) => error instanceof ProcurementMoneyError && error.code === 'PROCUREMENT_MONEY_TYPE',
    );
  }
  for (const value of ['', ' ', ' 1.00', '1.00 ', '+1', '-1', '.5', '1.', '1e3', '1,5', '1.001']) {
    assert.throws(
      () => parseProcurementMoney(value, { allowZero: true }),
      (error) => error instanceof ProcurementMoneyError && error.code === 'PROCUREMENT_MONEY_FORMAT',
      value,
    );
  }
});

test('order total sums exact extended amounts and rounds half-up once at the cent', () => {
  const total = calculateProcurementOrderTotal([
    {
      quantityScaled: parseProcurementQuantity('0.005'),
      unitPriceScaled: parseProcurementMoney('1.00'),
    },
    {
      quantityScaled: parseProcurementQuantity('0.005'),
      unitPriceScaled: parseProcurementMoney('1.00'),
    },
  ]);
  assert.equal(formatProcurementMoney(total), '0.01');

  const halfCent = calculateProcurementOrderTotal([{
    quantityScaled: parseProcurementQuantity('0.005'),
    unitPriceScaled: parseProcurementMoney('1.00'),
  }]);
  assert.equal(formatProcurementMoney(halfCent), '0.01');
});

test('order total fails closed when the rounded result exceeds Decimal(14,2)', () => {
  assert.throws(
    () => calculateProcurementOrderTotal([{
      quantityScaled: parseProcurementQuantity('99999999999.999'),
      unitPriceScaled: parseProcurementMoney('999999999999.99'),
    }]),
    (error) => error instanceof ProcurementMoneyError && error.code === 'PROCUREMENT_TOTAL_OVERFLOW',
  );
});
