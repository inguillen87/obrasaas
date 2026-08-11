const DECIMAL_PATTERN = /^(?:0|[1-9]\d{0,13})(?:\.\d{1,4})?$/;
const SCALE = 10_000n;

export class ProgressMeasurementQuantityError extends Error {
  constructor(message = 'La cantidad debe ser un decimal exacto con hasta 4 decimales.') {
    super(message);
    this.name = 'ProgressMeasurementQuantityError';
    this.code = 'PROGRESS_MEASUREMENT_QUANTITY_INVALID';
    this.status = 400;
  }
}

export function parseProgressMeasurementQuantity(value, {
  allowZero = true,
  field = 'quantity',
} = {}) {
  if (typeof value !== 'string' || value !== value.trim() || !DECIMAL_PATTERN.test(value)) {
    throw new ProgressMeasurementQuantityError(`${field} debe ser un decimal exacto con hasta 4 decimales.`);
  }
  const [whole, fraction = ''] = value.split('.');
  const scaled = (BigInt(whole) * SCALE) + BigInt(fraction.padEnd(4, '0'));
  if (!allowZero && scaled === 0n) {
    throw new ProgressMeasurementQuantityError(`${field} debe ser mayor que cero.`);
  }
  return scaled;
}

export function formatProgressMeasurementQuantity(value) {
  const scaled = typeof value === 'bigint'
    ? value
    : parseProgressMeasurementQuantity(value);
  if (scaled < 0n) throw new ProgressMeasurementQuantityError();
  const whole = scaled / SCALE;
  const fraction = String(scaled % SCALE).padStart(4, '0');
  return `${whole}.${fraction}`;
}

export function normalizeProgressMeasurementQuantity(value, options) {
  return formatProgressMeasurementQuantity(
    parseProgressMeasurementQuantity(value, options),
  );
}

export function compareProgressMeasurementQuantities(left, right) {
  const a = parseProgressMeasurementQuantity(left);
  const b = parseProgressMeasurementQuantity(right);
  return a === b ? 0 : (a < b ? -1 : 1);
}

export function progressMeasurementPercent(quantity, baseline) {
  const numerator = parseProgressMeasurementQuantity(quantity);
  const denominator = parseProgressMeasurementQuantity(baseline, { allowZero: false });
  const basisPoints = (numerator * 1_000_000n) / denominator;
  return `${basisPoints / 10_000n}.${String(basisPoints % 10_000n).padStart(4, '0')}`;
}
