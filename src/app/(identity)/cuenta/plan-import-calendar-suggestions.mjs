// Calendar proposals stay in memory. This module does not save, approve or
// interpret financial curves, quantities, dependencies or executed progress.
const DAY = 24 * 60 * 60 * 1000;
const WEEK_COUNT = 48;
const MAX_ROWS = 200;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const partidaCode = value => typeof value === 'string' && /^[AB]\.1\.\d{1,3}\.\d{1,3}$/.test(value);
const parentCode = code => code.slice(0, code.lastIndexOf('.'));
const missingDate = value => value === null || value === '';

function calendarStamp(value) {
 if (typeof value !== 'string' || !/^(20\d\d|2100)-\d{2}-\d{2}$/.test(value)) return null;
 const stamp = Date.parse(value + 'T00:00:00.000Z');
 return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === value ? stamp : null;
}

// Sorting object keys makes JSON snapshots independent of property insertion
// order. Arrays keep their order, including retained rows and source weeks.
// Reject values that JSON would silently discard or convert, rather than bind
// an incomplete snapshot. Inputs are ordinary JSON from the draft response.
function snapshotJson(value, ancestors = new Set(), depth = 0) {
 if (depth > 32) throw new TypeError('INVALID_SNAPSHOT');
 if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
 if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
 if (typeof value !== 'object' || value === null || ancestors.has(value)) throw new TypeError('INVALID_SNAPSHOT');
 const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
 if (!array && prototype !== Object.prototype && prototype !== null) throw new TypeError('INVALID_SNAPSHOT');
 const descriptors = Object.getOwnPropertyDescriptors(value);
 const keys = Reflect.ownKeys(descriptors).filter(key => !(array && key === 'length'));
 if (keys.some(key => typeof key !== 'string' || !descriptors[key].enumerable || !Object.hasOwn(descriptors[key], 'value'))) throw new TypeError('INVALID_SNAPSHOT');
 if (array && (keys.length !== value.length || keys.some((key, index) => key !== String(index)))) throw new TypeError('INVALID_SNAPSHOT');
 ancestors.add(value);
 const ordered = array ? keys : keys.sort();
 const entries = ordered.map(key => (array ? '' : JSON.stringify(key) + ':') + snapshotJson(descriptors[key].value, ancestors, depth + 1));
 ancestors.delete(value);
 return (array ? '[' : '{') + entries.join(',') + (array ? ']' : '}');
}

/** Exact local snapshot, not a cryptographic digest or an authorization token. */
export function calendarSuggestionBinding({context, rows, spreadsheet, anchor, criterionConfirmed = false} = {}) {
 try {
  if (typeof criterionConfirmed !== 'boolean') return null;
  return snapshotJson(['plan-import-calendar-suggestions-v1', {context, rows, spreadsheet, anchor, criterionConfirmed}]);
 } catch {
  return null;
 }
}

function validationReason({context, rows, spreadsheet, anchor}) {
 if (!record(context) || !id(context.projectId) || !hash(context.scope) || !id(context.draftId) || !Number.isSafeInteger(context.revision) || context.revision < 1 || !hash(context.sourceSha256)) return 'CONTEXT_INVALID';
 if (calendarStamp(anchor) === null) return 'ANCHOR_INVALID';
 if (!record(spreadsheet) || !(spreadsheet.version === 2 && spreadsheet.profile === 'CYP_PARTIDAS' || spreadsheet.version === 4 && spreadsheet.profile === 'CYP_PARTIDAS_CURVE')) return 'SPREADSHEET_PROFILE_INVALID';
 if (spreadsheet.worksheet !== 'Plan de trabajo' || spreadsheet.level !== 'PARTIDA' || !Number.isSafeInteger(spreadsheet.rowCount) || spreadsheet.rowCount < 1 || spreadsheet.rowCount > MAX_ROWS || !Array.isArray(spreadsheet.items) || spreadsheet.items.length !== spreadsheet.rowCount || !Array.isArray(spreadsheet.groups) || spreadsheet.version === 4 && !record(spreadsheet.curve)) return 'SPREADSHEET_SCHEMA_INVALID';
 if (spreadsheet.weeksPerPeriod !== 4 || !Array.isArray(spreadsheet.periodOrdinals) || spreadsheet.periodOrdinals.length !== 12 || spreadsheet.periodOrdinals.some((value, index) => value !== index + 1)) return 'SPREADSHEET_WEEKS_INVALID';
 const items = new Map();
 for (const item of spreadsheet.items) {
  if (!record(item) || !partidaCode(item.code) || item.parentCode !== parentCode(item.code) || items.has(item.code) || !Array.isArray(item.ordinalDistribution) || item.ordinalDistribution.length !== WEEK_COUNT || item.ordinalDistribution.some(value => value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1))) return 'SPREADSHEET_ITEM_INVALID';
  items.set(item.code, item);
 }
 if (!Array.isArray(rows) || rows.length < 1 || rows.length > MAX_ROWS || rows.length > items.size) return 'ROWS_INVALID';
 const retained = new Set();
 for (const row of rows) {
  if (!record(row) || !partidaCode(row.code) || retained.has(row.code)) return 'ROW_CODE_INVALID';
  const item = items.get(row.code);
  if (!item || row.parentCode !== item.parentCode) return 'ROW_SOURCE_MISMATCH';
  if ([row.startsOn, row.endsOn].some(value => !missingDate(value) && calendarStamp(value) === null) || !missingDate(row.startsOn) && !missingDate(row.endsOn) && row.endsOn < row.startsOn) return 'ROW_DATES_INVALID';
  retained.add(row.code);
 }
 return null;
}

const countsFor = (rows, spreadsheet, proposals, skipped) => ({
 retained: Array.isArray(rows) ? rows.length : 0,
 proposed: proposals.length,
 skipped: skipped.length,
 excluded: Array.isArray(spreadsheet?.items) && Array.isArray(rows) ? Math.max(0, spreadsheet.items.length - rows.length) : 0,
 withBlankWeeks: proposals.filter(proposal => proposal.blankWeeks.length > 0).length,
 withInternalGaps: proposals.filter(proposal => proposal.positiveBlocks.length > 1).length
});

export function buildPlanCalendarSuggestions({context, rows, spreadsheet, anchor, criterionConfirmed = false} = {}) {
 const binding = calendarSuggestionBinding({context, rows, spreadsheet, anchor, criterionConfirmed});
 const result = (status, reason, proposals = [], skipped = []) => ({status, ...(reason ? {reason} : {}), binding, anchor: typeof anchor === 'string' ? anchor : null, proposals, skipped, counts: countsFor(rows, spreadsheet, proposals, skipped)});
 if (binding === null) return result('INVALID', 'INVALID_SNAPSHOT');
 // Calculate only from the captured JSON, so the preview and its binding have
 // the same snapshot and no original row or source array is ever modified.
 const snapshot = JSON.parse(binding)[1];
 const invalid = validationReason(snapshot);
 if (invalid) return result('INVALID', invalid);
 if (criterionConfirmed !== true) return result('INVALID', 'CRITERION_CONFIRMATION_REQUIRED');
 const items = new Map(snapshot.spreadsheet.items.map(item => [item.code, item]));
 const anchorStamp = calendarStamp(snapshot.anchor), proposals = [], skipped = [];
 for (const row of snapshot.rows) {
  if (!missingDate(row.startsOn) || !missingDate(row.endsOn)) {
   skipped.push({code: row.code, reason: 'DATES_ALREADY_PRESENT'});
   continue;
  }
  const values = items.get(row.code).ordinalDistribution;
  const positives = values.flatMap((value, index) => value !== null && value > 0 ? [index] : []);
  if (!positives.length) {
   skipped.push({code: row.code, reason: values.every(value => value === null) ? 'NO_VALUES' : 'NO_POSITIVE_VALUES'});
   continue;
  }
  const first = positives[0], last = positives.at(-1);
  const startsOn = new Date(anchorStamp + first * 7 * DAY).toISOString().slice(0, 10);
  const endsOn = new Date(anchorStamp + ((last + 1) * 7 - 1) * DAY).toISOString().slice(0, 10);
  if (calendarStamp(startsOn) === null || calendarStamp(endsOn) === null) {
   skipped.push({code: row.code, reason: 'DATE_RANGE_OVERFLOW'});
   continue;
  }
  const positiveBlocks = [];
  for (const index of positives) {
   const previous = positiveBlocks.at(-1), week = index + 1;
   if (previous && previous.lastWeek + 1 === week) previous.lastWeek = week;
   else positiveBlocks.push({firstWeek: week, lastWeek: week});
  }
  const blankWeeks = values.flatMap((value, index) => value === null ? [index + 1] : []);
  proposals.push({
   code: row.code, startsOn, endsOn, firstWeek: first + 1, lastWeek: last + 1,
   positiveBlocks, positiveWeekCount: positives.length, blankWeeks,
   blankBeforeCount: blankWeeks.filter(week => week < first + 1).length,
   blankWithinCount: blankWeeks.filter(week => week >= first + 1 && week <= last + 1).length,
   blankAfterCount: blankWeeks.filter(week => week > last + 1).length,
   zeroWithinCount: values.slice(first, last + 1).filter(value => value === 0).length
  });
 }
 return result(proposals.length ? 'READY' : 'EMPTY', proposals.length ? null : 'NO_ELIGIBLE_ROWS', proposals, skipped);
}

function copiedRows(rows) {
 try { return JSON.parse(snapshotJson(rows)); } catch { return rows; }
}

export function applyPlanCalendarSuggestions(preview, input = {}) {
 const unchanged = reason => ({applied: false, rows: copiedRows(input.rows), changedCount: 0, reason});
 if (input.criterionConfirmed !== true) return unchanged('CRITERION_CONFIRMATION_REQUIRED');
 if (!record(preview) || preview.status !== 'READY') return unchanged('PREVIEW_REQUIRED');
 const current = buildPlanCalendarSuggestions(input);
 if (current.status !== 'READY' || !preview.binding || current.binding !== preview.binding) return unchanged('STALE_PREVIEW');
 // Recompute the proposals as well as the binding: changing preview dates or
 // removing a proposal cannot turn a displayed preview into another action.
 try {
  if (snapshotJson(preview) !== snapshotJson(current)) return unchanged('PREVIEW_CHANGED');
 } catch { return unchanged('PREVIEW_CHANGED'); }
 const proposals = new Map(current.proposals.map(proposal => [proposal.code, proposal]));
 const rows = copiedRows(input.rows).map(row => {
  const proposal = proposals.get(row.code);
  return proposal ? {...row, startsOn: proposal.startsOn, endsOn: proposal.endsOn} : row;
 });
 return {applied: true, rows, changedCount: proposals.size};
}
