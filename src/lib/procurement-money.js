import {
  PROCUREMENT_QUANTITY_MAX_SCALED,
  PROCUREMENT_QUANTITY_SCALE_FACTOR,
} from './procurement-quantity.js';

const MONEY_SCALE_FACTOR = 100n;
const MAX_SCALED_MONEY = 99_999_999_999_999n;
const MONEY_PATTERN = /^\d+(?:\.\d{1,2})?$/;

export const PROCUREMENT_MONEY_SCALE = 2;
export const PROCUREMENT_MONEY_SCALE_FACTOR = MONEY_SCALE_FACTOR;
export const PROCUREMENT_MONEY_MAX_SCALED = MAX_SCALED_MONEY;

export class ProcurementMoneyError extends Error {
  constructor(message, code = 'PROCUREMENT_MONEY_INVALID') {
    super(message);
    this.name = 'ProcurementMoneyError';
    this.code = code;
  }
}

function moneyError(message, code) {
  return new ProcurementMoneyError(message, code);
}

function assertScaledMoney(value) {
  if (typeof value !== 'bigint') {
    throw moneyError(
      'El importe escalado debe representarse como bigint.',
      'PROCUREMENT_MONEY_SCALED_TYPE',
    );
  }
  if (value < 0n) {
    throw moneyError(
      'El importe no puede ser negativo.',
      'PROCUREMENT_MONEY_NEGATIVE',
    );
  }
  if (value > MAX_SCALED_MONEY) {
    throw moneyError(
      'El importe supera Decimal(14,2).',
      'PROCUREMENT_MONEY_OVERFLOW',
    );
  }
  return value;
}

function assertScaledQuantity(value) {
  if (typeof value !== 'bigint') {
    throw moneyError(
      'La cantidad escalada debe representarse como bigint.',
      'PROCUREMENT_TOTAL_QUANTITY_TYPE',
    );
  }
  if (value < 0n || value > PROCUREMENT_QUANTITY_MAX_SCALED) {
    throw moneyError(
      'La cantidad escalada queda fuera de Decimal(14,3).',
      'PROCUREMENT_TOTAL_QUANTITY_RANGE',
    );
  }
  return value;
}

/** Parses one external Decimal(14,2) amount into exact cents. */
export function parseProcurementMoney(value, { allowZero = false } = {}) {
  if (typeof value !== 'string') {
    throw moneyError(
      'El importe debe enviarse como texto decimal.',
      'PROCUREMENT_MONEY_TYPE',
    );
  }
  if (!MONEY_PATTERN.test(value)) {
    throw moneyError(
      'El importe debe usar punto decimal y hasta dos decimales, sin signo ni exponente.',
      'PROCUREMENT_MONEY_FORMAT',
    );
  }

  const [whole, fraction = ''] = value.split('.');
  const scaled = (BigInt(whole) * MONEY_SCALE_FACTOR)
    + BigInt(fraction.padEnd(PROCUREMENT_MONEY_SCALE, '0') || '0');
  if (scaled > MAX_SCALED_MONEY) {
    throw moneyError(
      'El importe supera Decimal(14,2).',
      'PROCUREMENT_MONEY_OVERFLOW',
    );
  }
  if (scaled === 0n && !allowZero) {
    throw moneyError(
      'El importe debe ser mayor que cero.',
      'PROCUREMENT_MONEY_ZERO',
    );
  }
  return scaled;
}

/** Formats exact cents as the canonical fixed-scale database value. */
export function formatProcurementMoney(value) {
  const scaled = assertScaledMoney(value);
  const whole = scaled / MONEY_SCALE_FACTOR;
  const fraction = (scaled % MONEY_SCALE_FACTOR).toString().padStart(2, '0');
  return `${whole}.${fraction}`;
}

/**
 * Calculates an order total without binary floating point.
 *
 * Every quantity x unit-price product is kept at its exact five-decimal
 * precision. Products are summed first and the order total is rounded once to
 * cents using round-half-up (non-negative values: 0.005 becomes 0.01). This
 * deliberately avoids accumulating one rounding decision per line.
 */
export function calculateProcurementOrderTotal(lines) {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw moneyError(
      'El total requiere al menos una línea.',
      'PROCUREMENT_TOTAL_LINES_INVALID',
    );
  }

  let exactScaledTotal = 0n;
  for (const line of lines) {
    const quantityScaled = assertScaledQuantity(line?.quantityScaled);
    const unitPriceScaled = assertScaledMoney(line?.unitPriceScaled);
    exactScaledTotal += quantityScaled * unitPriceScaled;
  }

  const wholeCents = exactScaledTotal / PROCUREMENT_QUANTITY_SCALE_FACTOR;
  const subCentRemainder = exactScaledTotal % PROCUREMENT_QUANTITY_SCALE_FACTOR;
  const roundedCents = wholeCents
    + (subCentRemainder * 2n >= PROCUREMENT_QUANTITY_SCALE_FACTOR ? 1n : 0n);
  if (roundedCents > MAX_SCALED_MONEY) {
    throw moneyError(
      'El total de la orden supera Decimal(14,2).',
      'PROCUREMENT_TOTAL_OVERFLOW',
    );
  }
  return roundedCents;
}
