const SCALE_FACTOR = 1_000n;
const MAX_SCALED_QUANTITY = 99_999_999_999_999n;
const DECIMAL_PATTERN = /^\d+(?:\.\d{1,3})?$/;

export const PROCUREMENT_QUANTITY_SCALE = 3;
export const PROCUREMENT_QUANTITY_SCALE_FACTOR = SCALE_FACTOR;
export const PROCUREMENT_QUANTITY_MAX_SCALED = MAX_SCALED_QUANTITY;

export class ProcurementQuantityError extends Error {
  constructor(message, code = 'PROCUREMENT_QUANTITY_INVALID') {
    super(message);
    this.name = 'ProcurementQuantityError';
    this.code = code;
  }
}

function quantityError(message, code) {
  return new ProcurementQuantityError(message, code);
}

function assertScaledQuantity(value) {
  if (typeof value !== 'bigint') {
    throw quantityError(
      'La cantidad escalada debe representarse como bigint.',
      'PROCUREMENT_QUANTITY_SCALED_TYPE',
    );
  }
  if (value < 0n) {
    throw quantityError(
      'La cantidad no puede ser negativa.',
      'PROCUREMENT_QUANTITY_NEGATIVE',
    );
  }
  if (value > MAX_SCALED_QUANTITY) {
    throw quantityError(
      'La cantidad supera Decimal(14,3).',
      'PROCUREMENT_QUANTITY_OVERFLOW',
    );
  }
  return value;
}

/**
 * Parses one external Decimal(14,3) quantity into exact thousandths.
 *
 * External quantities must be strings. Accepting JavaScript numbers here
 * would make it impossible to distinguish an intended decimal from a value
 * that was already rounded by binary floating-point arithmetic.
 */
export function parseProcurementQuantity(value, { allowZero = false } = {}) {
  if (typeof value !== 'string') {
    throw quantityError(
      'La cantidad debe enviarse como texto decimal.',
      'PROCUREMENT_QUANTITY_TYPE',
    );
  }
  if (!DECIMAL_PATTERN.test(value)) {
    throw quantityError(
      'La cantidad debe usar punto decimal y hasta tres decimales, sin signo ni exponente.',
      'PROCUREMENT_QUANTITY_FORMAT',
    );
  }

  const [whole, fraction = ''] = value.split('.');
  const fractionScaled = fraction.padEnd(PROCUREMENT_QUANTITY_SCALE, '0');
  const scaled = (BigInt(whole) * SCALE_FACTOR) + BigInt(fractionScaled || '0');

  if (scaled > MAX_SCALED_QUANTITY) {
    throw quantityError(
      'La cantidad supera Decimal(14,3).',
      'PROCUREMENT_QUANTITY_OVERFLOW',
    );
  }
  if (scaled === 0n && !allowZero) {
    throw quantityError(
      'La cantidad debe ser mayor que cero.',
      'PROCUREMENT_QUANTITY_ZERO',
    );
  }
  return scaled;
}

/** Formats exact thousandths as the canonical fixed-scale database value. */
export function formatProcurementQuantity(value) {
  const scaled = assertScaledQuantity(value);
  const whole = scaled / SCALE_FACTOR;
  const fraction = (scaled % SCALE_FACTOR)
    .toString()
    .padStart(PROCUREMENT_QUANTITY_SCALE, '0');
  return `${whole}.${fraction}`;
}

/** Adds valid scaled quantities without crossing the Decimal(14,3) boundary. */
export function sumProcurementQuantities(values) {
  if (
    values === null
    || values === undefined
    || typeof values === 'string'
    || typeof values[Symbol.iterator] !== 'function'
  ) {
    throw quantityError(
      'Las cantidades a sumar deben ser iterables.',
      'PROCUREMENT_QUANTITY_COLLECTION',
    );
  }

  let total = 0n;
  for (const value of values) {
    total += assertScaledQuantity(value);
    if (total > MAX_SCALED_QUANTITY) {
      throw quantityError(
        'La suma supera Decimal(14,3).',
        'PROCUREMENT_QUANTITY_OVERFLOW',
      );
    }
  }
  return total;
}

/** Returns -1, 0 or 1 for two valid scaled quantities. */
export function compareProcurementQuantities(left, right) {
  const trustedLeft = assertScaledQuantity(left);
  const trustedRight = assertScaledQuantity(right);
  if (trustedLeft < trustedRight) return -1;
  if (trustedLeft > trustedRight) return 1;
  return 0;
}

/** Subtracts two valid scaled quantities and fails closed on underflow. */
export function subtractProcurementQuantities(left, right) {
  const trustedLeft = assertScaledQuantity(left);
  const trustedRight = assertScaledQuantity(right);
  if (trustedRight > trustedLeft) {
    throw quantityError(
      'La resta produciria una cantidad negativa.',
      'PROCUREMENT_QUANTITY_UNDERFLOW',
    );
  }
  return trustedLeft - trustedRight;
}
