import assert from 'node:assert/strict';
import test from 'node:test';
import { computeMatchSummary } from '../src/lib/supplier-invoices.js';

test('permite factura dentro del saldo recibido', () => {
  const result = computeMatchSummary(1000, 400, 600);
  assert.equal(result.matched, true);
  assert.equal(result.availableValue, 600);
});

test('bloquea factura que excede recepción o saldo restante', () => {
  assert.equal(computeMatchSummary(1000, 400, 600.01).matched, false);
  assert.equal(computeMatchSummary(1000, 900, 101).matched, false);
});

test('no permite saldo negativo', () => {
  const result = computeMatchSummary(1000, 1200, 1);
  assert.equal(result.availableValue, 0);
  assert.equal(result.matched, false);
});
