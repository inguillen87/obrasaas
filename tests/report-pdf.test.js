import assert from 'node:assert/strict';
import test from 'node:test';

import { PDFDocument } from 'pdf-lib';

import {
  pdfSafeText,
  renderWeeklyReportPdf,
  weeklyReportPdfFilename,
} from '../src/lib/report-pdf.js';
import { buildWeeklyReportModel } from '../src/lib/reporting.js';

function reportFixture(overrides = {}) {
  return buildWeeklyReportModel({
    organization: { name: 'Constructora Río de la Plata' },
    project: {
      id: 'project_pdf_1234567',
      name: 'Hospital Regional Norte',
      address: 'Rosario, Santa Fe',
      startsAt: new Date('2026-07-01T00:00:00.000Z'),
      endsAt: new Date('2026-12-20T00:00:00.000Z'),
    },
    actorEmail: 'direccion@constructora.example',
    generatedAt: new Date('2026-07-16T18:30:00.000Z'),
    snapshot: {
      version: 7,
      updatedAt: new Date('2026-07-16T18:00:00.000Z'),
    },
    state: {
      avancePercentage: 42,
      diasEstimados: 'Día 41/120',
      alertsCount: 2,
      budget: { total: 2_400_000, executed: 985_000, currency: 'USD' },
      tasks: {
        foundations: { name: 'Fundaciones sector norte', assignee: 'Cuadrilla A', progress: 100, duration: 12, startDay: 1 },
        structure: { name: 'Estructura nivel 1', assignee: 'Equipo hormigón', progress: 38, duration: 18, startDay: 13, dependencies: ['foundations'] },
      },
      attendance: {
        'Ana Pérez': { role: 'Jefa de obra', status: 'Presente' },
        'Luis Gómez': { role: 'Capataz', status: 'Licencia' },
      },
      stockpiles: {
        cement: { name: 'Cemento', current: 18, min: 25, unit: 'bolsas', status: 'Crítico' },
      },
      incidents: [{
        id: 'incident-pdf',
        title: 'Entrega de acero demorada',
        description: 'El proveedor reprogramó la entrega para el viernes.',
        reporter: 'Capataz',
        severity: 'warning',
      }],
    },
    messages: [
      { sender: 'user', kind: 'audio', transcription: 'Reporte de avance', mediaUrl: '/audio' },
      { sender: 'user', kind: 'image', mediaUrl: '/photo' },
    ],
    ...overrides,
  });
}

test('weekly report renderer emits a valid versioned A4 PDF', async () => {
  const report = reportFixture();
  const bytes = await renderWeeklyReportPdf(report);
  const loaded = await PDFDocument.load(bytes);

  assert.equal(Buffer.from(bytes.subarray(0, 5)).toString('ascii'), '%PDF-');
  assert.ok(bytes.byteLength > 5_000);
  assert.ok(loaded.getPageCount() >= 2);
  assert.match(loaded.getTitle(), /Hospital Regional Norte/);
  assert.equal(loaded.getAuthor(), 'Constructora Río de la Plata');
  for (const page of loaded.getPages()) {
    assert.ok(Math.abs(page.getWidth() - 595.28) < 0.1);
    assert.ok(Math.abs(page.getHeight() - 841.89) < 0.1);
  }
  assert.equal(
    weeklyReportPdfFilename(report),
    'reporte-semanal-hospital-regional-norte-os-1234567-20260716-153000000-v7.pdf',
  );
});

test('PDF generation remains valid for an empty tenant and hostile Unicode text', async () => {
  const report = reportFixture({
    organization: { name: 'Tenant 👷‍♀️ 中文 Łódź' },
    project: { id: 'project_empty', name: `Obra 👷‍♀️ 中文 Łódź ${'X'.repeat(3_000)}` },
    state: {},
    messages: [],
    snapshot: null,
  });
  const bytes = await renderWeeklyReportPdf(report);
  const loaded = await PDFDocument.load(bytes);

  assert.ok(loaded.getPageCount() >= 2);
  assert.ok(bytes.byteLength < 1_000_000);
  assert.match(weeklyReportPdfFilename(report), /^reporte-semanal-obra-odz-x+-os-t-empty-/);
});

test('PDF generation normalizes an invalid requested generation date', async () => {
  const report = reportFixture({ generatedAt: new Date('invalid') });
  const bytes = await renderWeeklyReportPdf(report);

  assert.ok(Number.isFinite(report.generatedAt.getTime()));
  assert.equal(Buffer.from(bytes.subarray(0, 5)).toString('ascii'), '%PDF-');
});

test('PDF text normalization removes unsupported controls and risky filenames', () => {
  assert.equal(pdfSafeText('avance\n->\u0000 riesgo \u2014 ok'), 'avance ->? riesgo - ok');
  assert.equal(pdfSafeText('Obra 👷‍♀️ 中文 Łódź'), 'Obra 👷‍♀️ 中文 Łódź');
  assert.equal(
    weeklyReportPdfFilename({
      projectName: '../../Obra Núñez\r\n',
      reportId: 'OS/ABC',
      snapshotVersion: 3,
    }),
    'reporte-semanal-obra-nunez-os-abc-v3.pdf',
  );
});
