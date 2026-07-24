import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertTimeZone,
  isValidTimeZone,
  isoWeekday,
  localDateKey,
  parseDateKey,
  shiftDateKey,
  zonedDateTimeToUtc,
  zonedMinuteToUtc,
} from '../src/lib/zoned-time.js';

const BUENOS_AIRES = 'America/Argentina/Buenos_Aires';

test('IANA time zones are validated without accepting numeric offset identifiers', () => {
  assert.equal(isValidTimeZone(BUENOS_AIRES), true);
  assert.equal(isValidTimeZone('Asia/Kathmandu'), true);
  assert.equal(isValidTimeZone('UTC'), true);
  assert.equal(isValidTimeZone('+03:00'), false);
  assert.equal(isValidTimeZone('Not/A_Zone'), false);
  assert.equal(isValidTimeZone(` ${BUENOS_AIRES}`), false);
  assert.equal(assertTimeZone(BUENOS_AIRES), BUENOS_AIRES);
  assert.throws(() => assertTimeZone('Mars/Olympus'), /Unsupported IANA time zone/);
});

test('date keys parse strictly, shift across calendar boundaries and expose ISO weekdays', () => {
  assert.deepEqual(parseDateKey('2026-07-24'), { year: 2026, month: 7, day: 24 });
  assert.equal(shiftDateKey('2024-02-28', 1), '2024-02-29');
  assert.equal(shiftDateKey('2026-12-31', 1), '2027-01-01');
  assert.equal(shiftDateKey('2026-01-01', -1), '2025-12-31');
  assert.equal(isoWeekday('2026-07-24'), 5);
  assert.equal(isoWeekday('2026-07-26'), 7);
  assert.throws(() => parseDateKey('2026-02-29'), /Invalid date key/);
  assert.throws(() => parseDateKey('24-07-2026'), /Invalid date key/);
  assert.throws(() => shiftDateKey('2026-07-24', 0.5), /safe integer/);
});

test('localDateKey uses the requested civil timezone instead of the host timezone', () => {
  const instant = new Date('2026-07-24T02:30:00.000Z');
  assert.equal(localDateKey(instant, BUENOS_AIRES), '2026-07-23');
  assert.equal(localDateKey(instant, 'Asia/Kathmandu'), '2026-07-24');
  assert.throws(() => localDateKey(new Date(Number.NaN), BUENOS_AIRES), /instant is invalid/);
});

test('zoned minutes convert Buenos Aires civil time and overnight shift ends to UTC', () => {
  assert.equal(
    zonedMinuteToUtc('2026-07-24', 8 * 60, BUENOS_AIRES).toISOString(),
    '2026-07-24T11:00:00.000Z',
  );
  assert.equal(
    zonedMinuteToUtc('2026-07-24', 60, BUENOS_AIRES, true).toISOString(),
    '2026-07-25T04:00:00.000Z',
  );
  assert.equal(
    zonedDateTimeToUtc('2026-07-24', 17 * 60, BUENOS_AIRES).toISOString(),
    '2026-07-24T20:00:00.000Z',
  );
});

test('non-integer timezone offsets are preserved exactly', () => {
  assert.equal(
    zonedMinuteToUtc('2026-07-24', (8 * 60) + 15, 'Asia/Kathmandu').toISOString(),
    '2026-07-24T02:30:00.000Z',
  );
});

test('an ambiguous Santiago wall time selects its earliest matching instant', () => {
  // At the end of DST, 23:30 occurs first at UTC-03 and then at UTC-04.
  assert.equal(
    zonedMinuteToUtc('2026-04-04', (23 * 60) + 30, 'America/Santiago').toISOString(),
    '2026-04-05T02:30:00.000Z',
  );
});

test('a nonexistent Santiago wall time is rejected instead of silently shifted', () => {
  // At the start of DST, Santiago jumps from 23:59 to 01:00.
  assert.throws(
    () => zonedMinuteToUtc('2026-09-06', 30, 'America/Santiago'),
    /does not exist in America\/Santiago/,
  );
});

test('zoned conversion rejects malformed dates, minutes and overnight flags', () => {
  assert.throws(
    () => zonedMinuteToUtc('2026-02-29', 8 * 60, BUENOS_AIRES),
    /Invalid date key/,
  );
  assert.throws(
    () => zonedMinuteToUtc('2026-07-24', -1, BUENOS_AIRES),
    /between 0 and 1439/,
  );
  assert.throws(
    () => zonedMinuteToUtc('2026-07-24', 1_440, BUENOS_AIRES),
    /between 0 and 1439/,
  );
  assert.throws(
    () => zonedMinuteToUtc('2026-07-24', 480.5, BUENOS_AIRES),
    /between 0 and 1439/,
  );
  assert.throws(
    () => zonedMinuteToUtc('2026-07-24', 480, BUENOS_AIRES, 'yes'),
    /endsNextDay must be a boolean/,
  );
});
