import assert from 'node:assert/strict';
import test from 'node:test';

import { WHATSAPP_DEMO_AUDIO_TRANSCRIPTS } from '../src/lib/whatsapp/demo-audio.js';
import {
  REPORT_PROPOSAL_TYPES,
  classifyReportProposal,
} from '../src/lib/whatsapp/report-proposal.js';

test('dashboard demo audio labels match the proposal classifier contract', () => {
  const attendance = classifyReportProposal(WHATSAPP_DEMO_AUDIO_TRANSCRIPTS[1].text);
  const progress = classifyReportProposal(WHATSAPP_DEMO_AUDIO_TRANSCRIPTS[2].text);
  const critical = classifyReportProposal(WHATSAPP_DEMO_AUDIO_TRANSCRIPTS[3].text);
  const delay = classifyReportProposal(WHATSAPP_DEMO_AUDIO_TRANSCRIPTS[4].text);

  assert.equal(attendance.type, REPORT_PROPOSAL_TYPES.ATTENDANCE_REQUEST);
  assert.equal(progress.type, REPORT_PROPOSAL_TYPES.TASK_PROGRESS);
  assert.equal(progress.percentage, 75);
  assert.equal(progress.taskReference, 'tarea 3');
  assert.equal(critical.type, REPORT_PROPOSAL_TYPES.CRITICAL_INCIDENT);
  assert.equal(delay.type, REPORT_PROPOSAL_TYPES.DELAY_REPORT);
});
