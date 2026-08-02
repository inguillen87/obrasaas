import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PROCUREMENT_QUANTITY_MAX_SCALED,
  ProcurementQuantityError,
  compareProcurementQuantities,
  formatProcurementQuantity,
  parseProcurementQuantity,
  subtractProcurementQuantities,
  sumProcurementQuantities,
} from '../src/lib/procurement-quantity.js';

test('procurement quantities parse exact Decimal(14,3) thousandths', () => {
  assert.equal(parseProcurementQuantity('0.001'), 1n);
  assert.equal(parseProcurementQuantity('0.1'), 100n);
  assert.equal(parseProcurementQuantity('0.12'), 120n);
  assert.equal(parseProcurementQuantity('1'), 1_000n);
  assert.equal(parseProcurementQuantity('1.234'), 1_234n);
  assert.equal(parseProcurementQuantity('0001.200'), 1_200n);
  assert.equal(
    parseProcurementQuantity('99999999999.999'),
    PROCUREMENT_QUANTITY_MAX_SCALED,
  );
});

test('zero is opt-in for external quantities but remains exactly representable', () => {
  for (const value of ['0', '0.0', '000.000']) {
    assert.throws(
      () => parseProcurementQuantity(value),
      (error) => (
        error instanceof ProcurementQuantityError
        && error.code === 'PROCUREMENT_QUANTITY_ZERO'
      ),
    );
    assert.equal(parseProcurementQuantity(value, { allowZero: true }), 0n);
  }
  assert.equal(formatProcurementQuantity(0n), '0.000');
});

test('formatting is canonical, fixed-scale and exact at the database boundary', () => {
  assert.equal(formatProcurementQuantity(1n), '0.001');
  assert.equal(formatProcurementQuantity(100n), '0.100');
  assert.equal(formatProcurementQuantity(1_000n), '1.000');
  assert.equal(formatProcurementQuantity(1_234n), '1.234');
  assert.equal(
    formatProcurementQuantity(PROCUREMENT_QUANTITY_MAX_SCALED),
    '99999999999.999',
  );
});

test('binary floating-point traps never enter exact quantity arithmetic', () => {
  const tenths = parseProcurementQuantity('0.1');
  const fifths = parseProcurementQuantity('0.2');
  const total = sumProcurementQuantities([tenths, fifths]);
  assert.equal(total, 300n);
  assert.equal(formatProcurementQuantity(total), '0.300');
});

test('parser rejects non-text input, signs, whitespace, exponent and comma decimals', () => {
  for (const value of [null, undefined, 1, 1.25, 1n, {}, ['1.000']]) {
    assert.throws(
      () => parseProcurementQuantity(value),
      (error) => error.code === 'PROCUREMENT_QUANTITY_TYPE',
    );
  }

  for (const value of [
    '',
    ' ',
    ' 1.000',
    '1.000 ',
    '+1',
    '-1',
    '-0',
    '.5',
    '1.',
    '1e3',
    '1E-3',
    '1,5',
    '1_000',
    'NaN',
    'Infinity',
  ]) {
    assert.throws(
      () => parseProcurementQuantity(value),
      (error) => error.code === 'PROCUREMENT_QUANTITY_FORMAT',
      value,
    );
  }
});

test('parser rejects scale beyond three decimals even when extra digits are zero', () => {
  for (const value of ['0.0001', '1.2340', '99999999999.9990']) {
    assert.throws(
      () => parseProcurementQuantity(value),
      (error) => error.code === 'PROCUREMENT_QUANTITY_FORMAT',
      value,
    );
  }
});

test('parser and arithmetic reject Decimal(14,3) overflow', () => {
  for (const value of ['100000000000', '100000000000.000', '99999999999.9999']) {
    assert.throws(
      () => parseProcurementQuantity(value),
      (error) => ['PROCUREMENT_QUANTITY_OVERFLOW', 'PROCUREMENT_QUANTITY_FORMAT'].includes(error.code),
      value,
    );
  }

  assert.throws(
    () => sumProcurementQuantities([PROCUREMENT_QUANTITY_MAX_SCALED, 1n]),
    (error) => error.code === 'PROCUREMENT_QUANTITY_OVERFLOW',
  );
  assert.throws(
    () => formatProcurementQuantity(PROCUREMENT_QUANTITY_MAX_SCALED + 1n),
    (error) => error.code === 'PROCUREMENT_QUANTITY_OVERFLOW',
  );
});

test('sum supports iterables and preserves exact valid bounds', () => {
  function* quantities() {
    yield parseProcurementQuantity('10.125');
    yield parseProcurementQuantity('0.875');
  }

  assert.equal(sumProcurementQuantities([]), 0n);
  assert.equal(sumProcurementQuantities(quantities()), 11_000n);
  assert.equal(
    sumProcurementQuantities([
      PROCUREMENT_QUANTITY_MAX_SCALED - 1n,
      1n,
    ]),
    PROCUREMENT_QUANTITY_MAX_SCALED,
  );
});

test('comparison and subtraction operate only on valid scaled quantities', () => {
  const one = parseProcurementQuantity('1.000');
  const partial = parseProcurementQuantity('0.375');
  assert.equal(compareProcurementQuantities(partial, one), -1);
  assert.equal(compareProcurementQuantities(one, one), 0);
  assert.equal(compareProcurementQuantities(one, partial), 1);
  assert.equal(subtractProcurementQuantities(one, partial), 625n);
  assert.equal(subtractProcurementQuantities(one, one), 0n);
  assert.throws(
    () => subtractProcurementQuantities(partial, one),
    (error) => error.code === 'PROCUREMENT_QUANTITY_UNDERFLOW',
  );
});

test('helpers reject negative, non-bigint and malformed collections', () => {
  for (const operation of [
    () => formatProcurementQuantity(-1n),
    () => sumProcurementQuantities([1n, -1n]),
    () => compareProcurementQuantities(-1n, 0n),
    () => subtractProcurementQuantities(1n, -1n),
  ]) {
    assert.throws(
      operation,
      (error) => error.code === 'PROCUREMENT_QUANTITY_NEGATIVE',
    );
  }

  for (const operation of [
    () => formatProcurementQuantity('1'),
    () => sumProcurementQuantities([1n, '2']),
    () => compareProcurementQuantities(1n, 2),
    () => subtractProcurementQuantities({}, 1n),
  ]) {
    assert.throws(
      operation,
      (error) => error.code === 'PROCUREMENT_QUANTITY_SCALED_TYPE',
    );
  }

  for (const value of [null, undefined, 7, {}, '1.000']) {
    assert.throws(
      () => sumProcurementQuantities(value),
      (error) => error.code === 'PROCUREMENT_QUANTITY_COLLECTION',
    );
  }
});
