const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const FIXED_OFFSET_TIME_ZONE_PATTERN = /^[+-]\d{2}:\d{2}(?::\d{2})?$/;
const OFFSET_SAMPLE_HOURS = [-36, -24, -12, -6, 0, 6, 12, 24, 36];

const timeZoneValidationCache = new Map();
const dateTimeFormatterCache = new Map();

function utcDateFromParts(year, month, day, hour = 0, minute = 0, second = 0) {
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, 0);
  return date;
}

function formatDateKey({ year, month, day }) {
  if (year < 1 || year > 9_999) {
    throw new RangeError('Date keys must use years between 0001 and 9999.');
  }
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function validInstant(value) {
  if (!(value instanceof Date) && typeof value !== 'string' && typeof value !== 'number') {
    throw new TypeError('An instant must be a Date, timestamp, or parseable ISO string.');
  }
  const instant = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(instant.getTime())) {
    throw new RangeError('The instant is invalid.');
  }
  return instant;
}

function zonedDateTimeFormatter(timeZone) {
  assertTimeZone(timeZone);
  let formatter = dateTimeFormatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US-u-ca-iso8601-nu-latn', {
      timeZone,
      calendar: 'iso8601',
      numberingSystem: 'latn',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    dateTimeFormatterCache.set(timeZone, formatter);
  }
  return formatter;
}

function localParts(instant, timeZone) {
  const values = {};
  for (const part of zonedDateTimeFormatter(timeZone).formatToParts(instant)) {
    if (['year', 'month', 'day', 'hour', 'minute', 'second'].includes(part.type)) {
      values[part.type] = Number(part.value);
    }
  }
  const required = ['year', 'month', 'day', 'hour', 'minute', 'second'];
  if (required.some((key) => !Number.isInteger(values[key]))) {
    throw new RangeError(`Could not resolve civil time in ${timeZone}.`);
  }
  return values;
}

function offsetMillisecondsAt(instantMilliseconds, timeZone) {
  const wholeSecond = Math.floor(instantMilliseconds / 1_000) * 1_000;
  const parts = localParts(new Date(wholeSecond), timeZone);
  const representedAsUtc = utcDateFromParts(
    parts.year,
    parts.month,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  ).getTime();
  return representedAsUtc - wholeSecond;
}

function matchesLocalMinute(instantMilliseconds, target, timeZone) {
  const parts = localParts(new Date(instantMilliseconds), timeZone);
  return parts.year === target.year
    && parts.month === target.month
    && parts.day === target.day
    && parts.hour === target.hour
    && parts.minute === target.minute
    && parts.second === 0;
}

export function isValidTimeZone(value) {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value !== value.trim()
    || FIXED_OFFSET_TIME_ZONE_PATTERN.test(value)
  ) {
    return false;
  }
  if (timeZoneValidationCache.has(value)) return timeZoneValidationCache.get(value);

  let valid = false;
  try {
    const resolved = new Intl.DateTimeFormat('en-US', { timeZone: value })
      .resolvedOptions().timeZone;
    valid = typeof resolved === 'string' && resolved.length > 0;
  } catch {
    valid = false;
  }
  timeZoneValidationCache.set(value, valid);
  return valid;
}

export function assertTimeZone(value) {
  if (!isValidTimeZone(value)) {
    throw new RangeError(`Unsupported IANA time zone: ${String(value)}`);
  }
  return value;
}

export function parseDateKey(value) {
  if (typeof value !== 'string') {
    throw new TypeError('A date key must be a YYYY-MM-DD string.');
  }
  const match = DATE_KEY_PATTERN.exec(value);
  if (!match) {
    throw new RangeError(`Invalid date key: ${value}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || year > 9_999) {
    throw new RangeError(`Invalid date key: ${value}`);
  }
  const date = utcDateFromParts(year, month, day);
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    throw new RangeError(`Invalid date key: ${value}`);
  }
  return { year, month, day };
}

export function shiftDateKey(dateKey, days) {
  if (!Number.isSafeInteger(days)) {
    throw new TypeError('Date-key shifts require a safe integer number of days.');
  }
  const parts = parseDateKey(dateKey);
  const shifted = utcDateFromParts(parts.year, parts.month, parts.day);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  if (Number.isNaN(shifted.getTime())) {
    throw new RangeError('The shifted date is outside the supported range.');
  }
  return formatDateKey({
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  });
}

export function isoWeekday(dateKey) {
  const parts = parseDateKey(dateKey);
  const weekday = utcDateFromParts(parts.year, parts.month, parts.day).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

export function localDateKey(instant, timeZone) {
  assertTimeZone(timeZone);
  const parts = localParts(validInstant(instant), timeZone);
  return formatDateKey(parts);
}

export function zonedMinuteToUtc(
  dateKey,
  minuteOfDay,
  timeZone,
  endsNextDay = false,
) {
  if (!Number.isSafeInteger(minuteOfDay) || minuteOfDay < 0 || minuteOfDay > 1_439) {
    throw new RangeError('minuteOfDay must be an integer between 0 and 1439.');
  }
  if (typeof endsNextDay !== 'boolean') {
    throw new TypeError('endsNextDay must be a boolean.');
  }
  assertTimeZone(timeZone);

  const effectiveDateKey = endsNextDay ? shiftDateKey(dateKey, 1) : dateKey;
  const date = parseDateKey(effectiveDateKey);
  const target = {
    ...date,
    hour: Math.floor(minuteOfDay / 60),
    minute: minuteOfDay % 60,
  };
  const wallClockAsUtc = utcDateFromParts(
    target.year,
    target.month,
    target.day,
    target.hour,
    target.minute,
  ).getTime();

  // A civil timestamp can map to zero, one or two instants. Sampling both
  // sides of the requested day discovers every offset active around a normal
  // DST transition, including offsets containing 30 or 45 minutes.
  const offsets = new Set(
    OFFSET_SAMPLE_HOURS.map((hours) => offsetMillisecondsAt(
      wallClockAsUtc + (hours * 60 * 60 * 1_000),
      timeZone,
    )),
  );
  const candidates = [...offsets]
    .map((offset) => wallClockAsUtc - offset)
    .filter((instantMilliseconds) => (
      matchesLocalMinute(instantMilliseconds, target, timeZone)
    ))
    .sort((left, right) => left - right);

  if (candidates.length === 0) {
    throw new RangeError(
      `The local time ${effectiveDateKey} ${String(target.hour).padStart(2, '0')}:${String(target.minute).padStart(2, '0')} does not exist in ${timeZone}.`,
    );
  }
  return new Date(candidates[0]);
}

export const zonedDateTimeToUtc = zonedMinuteToUtc;
