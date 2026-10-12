import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarSuggestionBinding, buildPlanCalendarSuggestions, applyPlanCalendarSuggestions} from '../src/app/(identity)/cuenta/plan-import-calendar-suggestions.mjs';

const copy = value => structuredClone(value);
const distribution = (entries = {}, fill = null) => Array.from({length: 48}, (_, index) => Object.hasOwn(entries, index + 1) ? entries[index + 1] : fill);
function fixture({count = 1, version = 2, values = distribution({1: 1}), anchor = '2026-11-03'} = {}) {
 const rows = Array.from({length: count}, (_, index) => ({
  code: `A.1.1.${index + 1}`, parentCode: 'A.1.1', sourceIssueReviewed: false,
  title: `Partida sintética ${index + 1}`, startsOn: null, endsOn: null,
  evidence: `Plan de trabajo!A${index + 10}:BE${index + 10}; partida A.1.1.${index + 1}`,
  uncertainty: 'Confirmar la descripción y fechas con la fuente.',
  metadata: {review: {human: false, notes: ['Mantener original', null, 0]}}
 }));
 const spreadsheet = {
  version, profile: version === 4 ? 'CYP_PARTIDAS_CURVE' : 'CYP_PARTIDAS',
  worksheet: 'Plan de trabajo', level: 'PARTIDA', rowCount: count,
  groups: [
   {code: 'A', parentCode: '', title: 'Grupo A', sourceRange: 'Plan de trabajo!A1:B1'},
   {code: 'A.1', parentCode: 'A', title: 'Alcance A', sourceRange: 'Plan de trabajo!A2:B2'},
   {code: 'A.1.1', parentCode: 'A.1', title: 'Rubro A', sourceRange: 'Plan de trabajo!A3:B3'},
   {code: 'B', parentCode: '', title: 'Grupo B', sourceRange: 'Plan de trabajo!A4:B4'},
   {code: 'B.1', parentCode: 'B', title: 'Alcance B', sourceRange: 'Plan de trabajo!A5:B5'}
  ],
  items: rows.map((row, index) => ({code: row.code, parentCode: row.parentCode, sourceTitle: row.title, sourceRange: `Plan de trabajo!A${index + 10}:BE${index + 10}`, missingUnit: false, missingQuantity: index === 0, ordinalDistribution: [...values]})),
  budgetCodeCount: count + 5 + 2, excludedBudgetLeafCount: 2, excludedBudgetGroupingCount: 0,
  periodOrdinals: Array.from({length: 12}, (_, index) => index + 1), weeksPerPeriod: 4,
  duplicateViewExcluded: true, hiddenSheetsIgnored: true, externalReferencesIgnored: true,
  usesCachedValues: true, formulasRecalculated: false, macrosExecuted: false,
  quantityImported: false, dependenciesImported: false, progressImported: false,
  reviewed: false,
  ...(version === 4 ? {curve: {kind: 'PLANNED_MONETARY_INVESTMENT', currency: null, calendarStart: null, total: {sourceCell: 'Plan de trabajo!I300', cachedValue: '1250.00', hasFormula: true}, initialCumulative: {sourceCell: 'Plan de trabajo!I303', cachedValue: null, hasFormula: false}, periods: []}} : {})
 };
 return {context: {projectId: 'p-synthetic', scope: 'a'.repeat(64), draftId: 'plan_fixture_1', revision: 7, sourceSha256: 'b'.repeat(64)}, rows, spreadsheet, anchor, criterionConfirmed: true};
}

function freeze(value) {
 if (value && typeof value === 'object') {
  for (const child of Object.values(value)) freeze(child);
  Object.freeze(value);
 }
 return value;
}

test('week one begins at the exact chosen weekday and its end is inclusive', () => {
 const input = fixture(), preview = buildPlanCalendarSuggestions(input), proposal = preview.proposals[0];
 assert.equal(preview.status, 'READY');
 assert.equal(preview.anchor, '2026-11-03');
 assert.deepEqual([proposal.startsOn, proposal.endsOn, proposal.firstWeek, proposal.lastWeek], ['2026-11-03', '2026-11-09', 1, 1]);
 assert.deepEqual(proposal.positiveBlocks, [{firstWeek: 1, lastWeek: 1}]);
 assert.equal(proposal.positiveWeekCount, 1);
 assert.equal(proposal.blankAfterCount, 47);
 assert.equal(proposal.zeroWithinCount, 0);
 assert.equal(preview.binding, calendarSuggestionBinding(input));
});

test('first and last positive weeks define the interval; zero and blanks never define its edges', () => {
 const input = fixture({values: distribution({1: 0, 3: 0.25, 4: 0.75, 5: 0})});
 const proposal = buildPlanCalendarSuggestions(input).proposals[0];
 assert.deepEqual([proposal.startsOn, proposal.endsOn, proposal.firstWeek, proposal.lastWeek], ['2026-11-17', '2026-11-30', 3, 4]);
 assert.deepEqual(proposal.positiveBlocks, [{firstWeek: 3, lastWeek: 4}]);
 assert.equal(proposal.blankBeforeCount, 1);
 assert.equal(proposal.blankAfterCount, 43);
 assert.equal(proposal.blankWithinCount, 0);
 assert.equal(proposal.zeroWithinCount, 0);
});

test('leap days, century leap rules and year transitions use UTC calendar days', () => {
 for (const [anchor, expectedEnd] of [['2024-02-26', '2024-03-03'], ['2000-02-27', '2000-03-04'], ['2099-12-29', '2100-01-04']]) {
  const proposal = buildPlanCalendarSuggestions(fixture({anchor})).proposals[0];
  assert.equal(proposal.startsOn, anchor);
  assert.equal(proposal.endsOn, expectedEnd);
 }
 const century = buildPlanCalendarSuggestions(fixture({anchor: '2100-02-26'})).proposals[0];
 assert.equal(century.endsOn, '2100-03-04');
});

test('weeks crossing spring and autumn DST keep seven inclusive UTC dates', () => {
 for (const [anchor, expectedStart, expectedEnd] of [['2026-03-02', '2026-03-09', '2026-03-15'], ['2026-10-26', '2026-11-02', '2026-11-08']]) {
  const proposal = buildPlanCalendarSuggestions(fixture({anchor, values: distribution({2: 1})})).proposals[0];
  assert.deepEqual([proposal.startsOn, proposal.endsOn], [expectedStart, expectedEnd]);
 }
});

test('48 weeks are 336 inclusive days rather than twelve calendar months', () => {
 const proposal = buildPlanCalendarSuggestions(fixture({anchor: '2026-01-01', values: distribution({}, 1)})).proposals[0];
 assert.equal(proposal.startsOn, '2026-01-01');
 assert.equal(proposal.endsOn, '2026-12-02');
 assert.deepEqual(proposal.positiveBlocks, [{firstWeek: 1, lastWeek: 48}]);
 assert.equal(proposal.positiveWeekCount, 48);
 assert.deepEqual(proposal.blankWeeks, []);
 const lastWeek = buildPlanCalendarSuggestions(fixture({anchor: '2026-01-01', values: distribution({48: 1})})).proposals[0];
 assert.deepEqual([lastWeek.startsOn, lastWeek.endsOn], ['2026-11-26', '2026-12-02']);
});

test('separate positive blocks expose internal unknowns and explicit zero weeks separately', () => {
 const input = fixture({values: distribution({1: 0, 3: 0.2, 4: 0.3, 6: 0, 7: 0.5, 8: 0.1, 10: 0.2, 11: 0})});
 const preview = buildPlanCalendarSuggestions(input), proposal = preview.proposals[0];
 assert.deepEqual(proposal.positiveBlocks, [{firstWeek: 3, lastWeek: 4}, {firstWeek: 7, lastWeek: 8}, {firstWeek: 10, lastWeek: 10}]);
 assert.equal(proposal.positiveWeekCount, 5);
 assert.equal(proposal.blankBeforeCount, 1);
 assert.equal(proposal.blankWithinCount, 2);
 assert.equal(proposal.blankAfterCount, 37);
 assert.equal(proposal.zeroWithinCount, 1);
 assert.ok(proposal.blankWeeks.includes(5) && proposal.blankWeeks.includes(9));
 assert.ok(!proposal.blankWeeks.includes(6));
 assert.equal(preview.counts.withInternalGaps, 1);
 assert.equal(preview.counts.withBlankWeeks, 1);
 assert.deepEqual(input.spreadsheet.items[0].ordinalDistribution.slice(0, 11), [0, null, 0.2, 0.3, null, 0, 0.5, 0.1, null, 0.2, 0]);
});

test('all unknown, all zero, and zero mixed with unknown produce no guessed dates', () => {
 for (const [values, reason] of [[distribution(), 'NO_VALUES'], [distribution({}, 0), 'NO_POSITIVE_VALUES'], [distribution({2: 0}), 'NO_POSITIVE_VALUES']]) {
  const input = fixture({values}), preview = buildPlanCalendarSuggestions(input);
  assert.equal(preview.status, 'EMPTY');
  assert.deepEqual(preview.proposals, []);
  assert.deepEqual(preview.skipped, [{code: 'A.1.1.1', reason}]);
  assert.equal(preview.counts.proposed, 0);
  const result = applyPlanCalendarSuggestions(preview, input);
  assert.equal(result.applied, false);
  assert.deepEqual(result.rows, input.rows);
 }
});

test('both null and empty dates are eligible while every partial or existing date is preserved', () => {
 const input = fixture({count: 5});
 input.rows[1].startsOn = ''; input.rows[1].endsOn = '';
 input.rows[2].startsOn = '2026-11-05';
 input.rows[3].endsOn = '2026-12-05';
 input.rows[4].startsOn = '2026-11-10'; input.rows[4].endsOn = '2026-11-12';
 const preview = buildPlanCalendarSuggestions(input), result = applyPlanCalendarSuggestions(preview, input);
 assert.deepEqual(preview.proposals.map(proposal => proposal.code), ['A.1.1.1', 'A.1.1.2']);
 assert.ok(preview.skipped.every(row => row.reason === 'DATES_ALREADY_PRESENT'));
 assert.equal(result.applied, true);
 assert.equal(result.changedCount, 2);
 assert.deepEqual(result.rows.slice(2), input.rows.slice(2));
});

test('retained rows are the only proposal targets; exclusions and row order remain explicit', () => {
 const input = fixture({count: 5});
 input.rows = [input.rows[3], input.rows[1]];
 const preview = buildPlanCalendarSuggestions(input), result = applyPlanCalendarSuggestions(preview, input);
 assert.deepEqual(preview.counts, {retained: 2, proposed: 2, skipped: 0, excluded: 3, withBlankWeeks: 2, withInternalGaps: 0});
 assert.deepEqual(preview.proposals.map(proposal => proposal.code), ['A.1.1.4', 'A.1.1.2']);
 assert.deepEqual(result.rows.map(row => row.code), ['A.1.1.4', 'A.1.1.2']);
 assert.equal(input.spreadsheet.items.length, 5);
});

test('proposal and apply require explicit confirmation, including the binding', () => {
 const confirmed = fixture(), preview = buildPlanCalendarSuggestions(confirmed);
 for (const criterionConfirmed of [false, undefined, null, 'true', 1]) {
  const input = {...confirmed, criterionConfirmed};
  assert.equal(buildPlanCalendarSuggestions(input).status, 'INVALID');
  assert.equal(applyPlanCalendarSuggestions(preview, input).applied, false);
 }
 const noConfirmation = {...confirmed}; delete noConfirmation.criterionConfirmed;
 assert.notEqual(calendarSuggestionBinding(noConfirmation), preview.binding);
 assert.equal(buildPlanCalendarSuggestions(noConfirmation).reason, 'CRITERION_CONFIRMATION_REQUIRED');
});

test('only matching v2 and v4 physical profiles can supply suggestions; v1 cannot be promoted', () => {
 assert.equal(buildPlanCalendarSuggestions(fixture({version: 4})).status, 'READY');
 for (const [version, profile] of [[1, 'MONTHLY_RUBROS'], [3, 'MONTHLY_RUBROS_CURVE'], [2, 'CYP_PARTIDAS_CURVE'], [4, 'CYP_PARTIDAS'], [1, 'CYP_PARTIDAS']]) {
  const input = fixture(); Object.assign(input.spreadsheet, {version, profile});
  assert.equal(buildPlanCalendarSuggestions(input).reason, 'SPREADSHEET_PROFILE_INVALID');
 }
});

test('strict calendar anchors reject impossible dates, strings with times and range overflow', () => {
 for (const anchor of ['1999-12-31', '2101-01-01', '2026-02-29', '2100-02-29', '2026-13-01', '2026-04-31', '2026-11-03T00:00:00Z', '2026-1-01', '', null]) {
  assert.equal(buildPlanCalendarSuggestions(fixture({anchor})).reason, 'ANCHOR_INVALID');
 }
 const atBoundary = buildPlanCalendarSuggestions(fixture({anchor: '2100-12-25'}));
 assert.equal(atBoundary.status, 'READY');
 assert.equal(atBoundary.proposals[0].endsOn, '2100-12-31');
 const overflow = buildPlanCalendarSuggestions(fixture({anchor: '2100-12-26'}));
 assert.equal(overflow.status, 'EMPTY');
 assert.deepEqual(overflow.skipped, [{code: 'A.1.1.1', reason: 'DATE_RANGE_OVERFLOW'}]);
});

test('190 and 200 retained rows are complete; 201, empty and duplicate rows fail explicitly', () => {
 for (const count of [190, 200]) {
  const input = fixture({count}), preview = buildPlanCalendarSuggestions(input);
  assert.equal(preview.status, 'READY');
  assert.equal(preview.proposals.length, count);
  assert.equal(preview.proposals.at(-1).code, `A.1.1.${count}`);
  assert.equal(applyPlanCalendarSuggestions(preview, input).changedCount, count);
 }
 assert.equal(buildPlanCalendarSuggestions(fixture({count: 201})).status, 'INVALID');
 const empty = fixture(); empty.rows = []; assert.equal(buildPlanCalendarSuggestions(empty).reason, 'ROWS_INVALID');
 const duplicate = fixture({count: 2}); duplicate.rows[1] = copy(duplicate.rows[0]);
 assert.equal(buildPlanCalendarSuggestions(duplicate).reason, 'ROW_CODE_INVALID');
 duplicate.rows = [copy(duplicate.rows[0])]; duplicate.spreadsheet.items[1] = copy(duplicate.spreadsheet.items[0]);
 assert.equal(buildPlanCalendarSuggestions(duplicate).reason, 'SPREADSHEET_ITEM_INVALID');
});

test('malformed source weeks, ordinal axis, row source and dates never yield a partial guess', () => {
 const bad = [
  input => {input.spreadsheet.items[0].ordinalDistribution.pop();},
  input => {input.spreadsheet.items[0].ordinalDistribution.push(0);},
  input => {input.spreadsheet.items[0].ordinalDistribution[0] = -0.01;},
  input => {input.spreadsheet.items[0].ordinalDistribution[0] = 1.01;},
  input => {input.spreadsheet.items[0].ordinalDistribution[0] = '0.5';},
  input => {input.spreadsheet.items[0].ordinalDistribution[0] = NaN;},
  input => {input.spreadsheet.items[0].ordinalDistribution[0] = Infinity;},
  input => {delete input.spreadsheet.items[0].ordinalDistribution[0];},
  input => {input.spreadsheet.weeksPerPeriod = 5;},
  input => {input.spreadsheet.periodOrdinals[1] = 1;},
  input => {input.spreadsheet.rowCount = 2;},
  input => {input.rows[0].code = 'A.1.2.1';},
  input => {input.rows[0].parentCode = 'B.1.1';},
  input => {input.rows[0].startsOn = '2026-02-30';},
  input => {input.rows[0].startsOn = '2026-11-12'; input.rows[0].endsOn = '2026-11-11';},
  input => {delete input.rows[0].startsOn;},
  input => {input.spreadsheet.items[0].code = 'H.1';}
 ];
 for (const change of bad) {
  const input = fixture(); change(input);
  const preview = buildPlanCalendarSuggestions(input);
  assert.equal(preview.status, 'INVALID'); assert.ok(preview.reason);
  assert.deepEqual(preview.proposals, []);
 }
});

test('malformed scope, draft revision, source hash and identifiers are invalid', () => {
 for (const patch of [{projectId: ''}, {projectId: 'x'.repeat(129)}, {projectId: '../project'}, {scope: 'a'.repeat(63)}, {scope: 'A'.repeat(64)}, {draftId: ''}, {revision: 0}, {revision: 1.5}, {revision: Number.MAX_SAFE_INTEGER + 1}, {sourceSha256: 'invalid'}, {sourceSha256: 'B'.repeat(64)}]) {
  const input = fixture(); Object.assign(input.context, patch);
  assert.equal(buildPlanCalendarSuggestions(input).reason, 'CONTEXT_INVALID');
 }
});

test('every context and snapshot edit invalidates a displayed preview before apply', () => {
 const original = fixture({count: 2}), preview = buildPlanCalendarSuggestions(original);
 const changes = [
  input => {input.context.projectId = 'other_project';},
  input => {input.context.scope = 'c'.repeat(64);},
  input => {input.context.draftId = 'other_draft';},
  input => {input.context.revision++;},
  input => {input.context.sourceSha256 = 'd'.repeat(64);},
  input => {input.anchor = '2026-11-04';},
  input => {input.rows[0].title += ' revisada';},
  input => {input.rows[0].uncertainty = '';},
  input => {input.rows[0].sourceIssueReviewed = true;},
  input => {input.rows[0].metadata.review.notes.push('Edición humana');},
  input => {input.rows[0].evidence += '; revisada';},
  input => {input.rows[0].startsOn = '2026-11-03';},
  input => {input.rows.pop();},
  input => {input.rows.reverse();},
  input => {input.spreadsheet.items[1].ordinalDistribution[1] = 0.5;},
  input => {input.spreadsheet.items[0].sourceTitle += ' editada';},
  input => {input.spreadsheet.groups[0].title += ' editado';},
  input => {input.spreadsheet.reviewed = true;},
  input => {input.spreadsheet.hiddenSheetsIgnored = false;}
 ];
 for (const change of changes) {
  const input = copy(original); change(input);
  const result = applyPlanCalendarSuggestions(preview, input);
  assert.equal(result.applied, false);
  assert.equal(result.reason, 'STALE_PREVIEW');
  assert.equal(result.changedCount, 0);
  assert.deepEqual(result.rows, input.rows);
 }
 const financial = fixture({version: 4}), financialPreview = buildPlanCalendarSuggestions(financial);
 financial.spreadsheet.curve.total.cachedValue = '1300.00';
 assert.equal(applyPlanCalendarSuggestions(financialPreview, financial).reason, 'STALE_PREVIEW');
});

test('a preview cannot be altered to apply dates or rows different from those displayed', () => {
 const input = fixture(), preview = buildPlanCalendarSuggestions(input);
 for (const change of [candidate => {candidate.proposals[0].endsOn = '2026-12-31';}, candidate => {candidate.proposals = [];}, candidate => {candidate.proposals[0].blankWeeks = [];}, candidate => {candidate.counts.proposed = 7;}]) {
  const candidate = copy(preview); change(candidate);
  assert.equal(applyPlanCalendarSuggestions(candidate, input).reason, 'PREVIEW_CHANGED');
 }
 assert.equal(applyPlanCalendarSuggestions(null, input).reason, 'PREVIEW_REQUIRED');
});

test('output is pure, deep cloned, deterministic and preserves all human review/source fields', () => {
 const input = fixture({version: 4}), before = copy(input); freeze(input);
 const preview = buildPlanCalendarSuggestions(input), result = applyPlanCalendarSuggestions(preview, input);
 assert.deepEqual(input, before);
 assert.equal(result.applied, true);
 const {startsOn, endsOn, ...preserved} = result.rows[0];
 const {startsOn: originalStart, endsOn: originalEnd, ...originalFields} = before.rows[0];
 assert.deepEqual(preserved, originalFields);
 assert.deepEqual([originalStart, originalEnd], [null, null]);
 assert.deepEqual([startsOn, endsOn], ['2026-11-03', '2026-11-09']);
 assert.equal(result.rows[0].sourceIssueReviewed, false);
 assert.equal(result.rows[0].uncertainty, before.rows[0].uncertainty);
 assert.deepEqual(input.spreadsheet, before.spreadsheet);
 assert.deepEqual(buildPlanCalendarSuggestions(input), preview);
 assert.deepEqual(applyPlanCalendarSuggestions(preview, input), result);
 result.rows[0].metadata.review.notes.push('Sólo copia');
 preview.proposals[0].blankWeeks.push(999);
 assert.deepEqual(input, before);
});

test('reapplying after local dates were populated is rejected, while a fresh preview is empty', () => {
 const input = fixture(), preview = buildPlanCalendarSuggestions(input), first = applyPlanCalendarSuggestions(preview, input);
 const updated = {...input, rows: first.rows};
 const repeat = applyPlanCalendarSuggestions(preview, updated);
 assert.equal(repeat.applied, false); assert.equal(repeat.reason, 'STALE_PREVIEW');
 assert.deepEqual(repeat.rows, first.rows);
 assert.equal(buildPlanCalendarSuggestions(updated).status, 'EMPTY');
});

test('binding includes all JSON source fields and confirmation but is stable under object key order', () => {
 const input = fixture(), reordered = copy(input);
 reordered.context = Object.fromEntries(Object.entries(reordered.context).reverse());
 reordered.rows[0] = Object.fromEntries(Object.entries(reordered.rows[0]).reverse());
 assert.equal(calendarSuggestionBinding(input), calendarSuggestionBinding(reordered));
 reordered.rows.reverse(); // A one-row order remains the same snapshot.
 assert.equal(calendarSuggestionBinding(input), calendarSuggestionBinding(reordered));
 const sourceOnly = copy(input); sourceOnly.spreadsheet.items[0].missingQuantity = false;
 assert.notEqual(calendarSuggestionBinding(input), calendarSuggestionBinding(sourceOnly));
});

test('unserializable or cyclic metadata is rejected rather than silently dropped from the binding', () => {
 for (const change of [input => {input.rows[0].metadata.extra = undefined;}, input => {input.rows[0].metadata.extra = () => 1;}, input => {input.rows[0].metadata.extra = 1n;}, input => {input.rows[0].metadata.extra = input.rows[0];}, input => {input.rows[0].metadata.extra = new Date('2026-11-03');}]) {
  const input = fixture(); change(input);
  assert.equal(calendarSuggestionBinding(input), null);
  assert.equal(buildPlanCalendarSuggestions(input).reason, 'INVALID_SNAPSHOT');
 }
});
