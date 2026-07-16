import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyReportProposal,
  REPORT_PROPOSAL_TYPES,
} from '../src/lib/whatsapp/report-proposal.js';

test('classifies critical safety reports in accented and Rioplatense Spanish', () => {
  const proposal = classifyReportProposal(
    'Che, hubo una caída de trabajador y hay riesgo eléctrico urgente en el frente norte.',
  );

  assert.equal(proposal.type, REPORT_PROPOSAL_TYPES.CRITICAL_INCIDENT);
  assert.deepEqual(proposal.signals.risk, ['RIESGO', 'CAIDA_DE_PERSONA', 'URGENTE']);
  assert.equal(proposal.taskReference, 'frente norte');
  assert.equal(proposal.requiresTextConfirmation, true);
});

test('critical incidents take priority over delays and progress percentages', () => {
  const proposal = classifyReportProposal(
    'Accidente en tarea #A-12, además tenemos una demora y el avance quedó en 45%.',
  );

  assert.equal(proposal.type, REPORT_PROPOSAL_TYPES.CRITICAL_INCIDENT);
  assert.equal(proposal.percentage, 45);
  assert.equal(proposal.taskReference, 'tarea #a-12');
  assert.deepEqual(proposal.signals.delay, ['DEMORA']);
});

test('recognizes common delay language without treating urgency alone as an incident', () => {
  const proposal = classifyReportProposal(
    'Es urgente: el suministro todavía no llegó y estamos esperando los materiales.',
  );

  assert.equal(proposal.type, REPORT_PROPOSAL_TYPES.DELAY_REPORT);
  assert.deepEqual(proposal.signals.risk, ['URGENTE']);
  assert.deepEqual(proposal.signals.delay, ['ENTREGA_NO_LLEGA', 'ESPERA_DE_MATERIAL']);
});

test('extracts numeric percentages and coded task references', () => {
  const commaDecimal = classifyReportProposal('Actividad nro. 3.2: avance 87,5 por ciento.');
  const bounds = [
    classifyReportProposal('Tarea 1 al 0%.'),
    classifyReportProposal('Hito #99 al 100%.'),
  ];

  assert.equal(commaDecimal.type, REPORT_PROPOSAL_TYPES.TASK_PROGRESS);
  assert.equal(commaDecimal.percentage, 87.5);
  assert.equal(commaDecimal.taskReference, 'actividad nro. 3.2');
  assert.deepEqual(bounds.map((proposal) => proposal.percentage), [0, 100]);
});

test('extracts Spanish number words used in LATAM transcripts', () => {
  const proposal = classifyReportProposal(
    'La tarea 18 está al setenta y cinco por ciento.',
  );

  assert.equal(proposal.type, REPORT_PROPOSAL_TYPES.TASK_PROGRESS);
  assert.equal(proposal.percentage, 75);
  assert.equal(proposal.taskReference, 'tarea 18');
});

test('ignores invalid percentages and uses the first valid value deterministically', () => {
  const invalid = classifyReportProposal('Avance informado 125% en la tarea 4.');
  const mixed = classifyReportProposal('Estimaron 150%, luego corrigieron a 72%.');

  assert.equal(invalid.type, REPORT_PROPOSAL_TYPES.GENERAL_NOTE);
  assert.equal(invalid.percentage, null);
  assert.equal(mixed.type, REPORT_PROPOSAL_TYPES.TASK_PROGRESS);
  assert.equal(mixed.percentage, 72);
});

test('recognizes explicit attendance requests but not similar unrelated words', () => {
  const requests = [
    'Quiero fichar.',
    'Necesito registrar mi ingreso.',
    'Estoy entrando.',
    'Arranco la jornada.',
  ];
  for (const transcript of requests) {
    assert.equal(
      classifyReportProposal(transcript).type,
      REPORT_PROPOSAL_TYPES.ATTENDANCE_REQUEST,
    );
  }

  assert.equal(
    classifyReportProposal('Adjunto la ficha técnica del hormigón.').type,
    REPORT_PROPOSAL_TYPES.GENERAL_NOTE,
  );
});

test('negated risks and delays do not produce false positive mutations', () => {
  const proposal = classifyReportProposal(
    'No hay riesgo, no hubo accidente y estamos sin demora. Todo normal.',
  );

  assert.equal(proposal.type, REPORT_PROPOSAL_TYPES.GENERAL_NOTE);
  assert.deepEqual(proposal.signals, { risk: [], delay: [] });
});

test('simulations and drills do not become real critical incidents', () => {
  const proposal = classifyReportProposal(
    'Hicimos un simulacro de incendio y una prueba de emergencia.',
  );

  assert.equal(proposal.type, REPORT_PROPOSAL_TYPES.GENERAL_NOTE);
  assert.deepEqual(proposal.signals.risk, []);
});

test('ambiguous substrings do not match whole-word risk or delay signals', () => {
  const proposal = classifyReportProposal(
    'El demoradoide no existe; actualizamos el arriesgado diseño del fichero.',
  );

  assert.equal(proposal.type, REPORT_PROPOSAL_TYPES.GENERAL_NOTE);
  assert.deepEqual(proposal.signals, { risk: [], delay: [] });
});

test('invalid inputs return a safe general note and never throw', () => {
  for (const input of [null, undefined, 42, {}, [], Symbol('audio')]) {
    const proposal = classifyReportProposal(input);
    assert.deepEqual(proposal, {
      type: REPORT_PROPOSAL_TYPES.GENERAL_NOTE,
      summary: '',
      percentage: null,
      taskReference: null,
      signals: { risk: [], delay: [] },
      requiresTextConfirmation: true,
      truncated: false,
    });
  }
});

test('output fields and signal arrays remain bounded for giant transcripts', () => {
  const huge = `${'riesgo demora '.repeat(1000)}${'x'.repeat(10000)}`;
  const proposal = classifyReportProposal(huge);

  assert.equal(proposal.truncated, true);
  assert.ok(proposal.summary.length <= 280);
  assert.ok(proposal.taskReference === null || proposal.taskReference.length <= 64);
  assert.ok(proposal.signals.risk.length <= 6);
  assert.ok(proposal.signals.delay.length <= 6);
  assert.deepEqual(Object.keys(proposal), [
    'type',
    'summary',
    'percentage',
    'taskReference',
    'signals',
    'requiresTextConfirmation',
    'truncated',
  ]);
});

test('classification is deterministic and returns fresh nested values', () => {
  const transcript = 'Demora en tarea 7, avance 33%.';
  const first = classifyReportProposal(transcript);
  const second = classifyReportProposal(transcript);

  assert.deepEqual(first, second);
  first.signals.delay.push('MUTATED_BY_CALLER');
  assert.deepEqual(classifyReportProposal(transcript), second);
});
