import { readFile } from 'node:fs/promises';
import path from 'node:path';

import fontkit from '@pdf-lib/fontkit';
import {
  LineCapStyle,
  PDFDocument,
  StandardFonts,
  rgb,
} from 'pdf-lib';

import {
  OBRA_SAAS_STRUCTURE_PATH,
  OBRA_SAAS_TRACE_PATH,
} from '../app/brand/brand-geometry.js';

const A4 = Object.freeze({ width: 595.28, height: 841.89 });
const MARGIN = 44;
const CONTENT_WIDTH = A4.width - (MARGIN * 2);
const CONTENT_BOTTOM = 52;
const REPORT_FONT_PATHS = Object.freeze({
  regular: path.join(process.cwd(), 'node_modules', 'source-sans', 'TTF', 'SourceSans3-Regular.ttf'),
  bold: path.join(process.cwd(), 'node_modules', 'source-sans', 'TTF', 'SourceSans3-Bold.ttf'),
});
let reportFontBytesPromise;
const FONT_CHARACTER_SETS = new WeakMap();

const LIMITS = Object.freeze({
  tasks: 80,
  attendance: 120,
  stockpiles: 120,
  incidents: 40,
});

const COLOR = Object.freeze({
  ink: rgb(0.09, 0.125, 0.2),
  body: rgb(0.25, 0.3, 0.39),
  muted: rgb(0.44, 0.49, 0.57),
  line: rgb(0.86, 0.89, 0.92),
  panel: rgb(0.965, 0.973, 0.981),
  paper: rgb(0.995, 0.995, 0.99),
  orange: rgb(0.95, 0.47, 0.075),
  orangeSoft: rgb(1, 0.96, 0.9),
  green: rgb(0.1, 0.58, 0.43),
  greenSoft: rgb(0.91, 0.98, 0.95),
  red: rgb(0.68, 0.19, 0.19),
  redSoft: rgb(1, 0.93, 0.93),
  white: rgb(1, 1, 1),
});

const REPLACEMENTS = Object.freeze({
  '\u2010': '-',
  '\u2011': '-',
  '\u2012': '-',
  '\u2013': '-',
  '\u2014': '-',
  '\u2018': "'",
  '\u2019': "'",
  '\u201c': '"',
  '\u201d': '"',
  '\u2022': '-',
  '\u2026': '...',
  '\u2192': '->',
  '\u00b7': '-',
});

export function pdfSafeText(value, maximumLength = 2_000) {
  const output = String(value ?? '')
    .replace(/[\u2010-\u2014\u2018\u2019\u201c\u201d\u2022\u2026\u2192\u00b7]/g, (character) => (
      REPLACEMENTS[character] || '-'
    ))
    .replace(/\s+/g, ' ')
    .replace(/[\p{Cc}\p{Cs}]/gu, '?')
    .trim();
  const limit = Math.max(3, Number(maximumLength) || 2_000);
  const characters = Array.from(output);
  return characters.length > limit
    ? `${characters.slice(0, limit - 3).join('')}...`
    : output;
}

function fontCharacterSet(font) {
  let supported = FONT_CHARACTER_SETS.get(font);
  if (!supported) {
    supported = new Set(font.getCharacterSet());
    FONT_CHARACTER_SETS.set(font, supported);
  }
  return supported;
}

function fontSafeText(value, font, maximumLength = 2_000) {
  const supported = fontCharacterSet(font);
  return Array.from(pdfSafeText(value, maximumLength), (character) => (
    supported.has(character.codePointAt(0)) ? character : '?'
  )).join('');
}

async function loadReportFontBytes() {
  if (!reportFontBytesPromise) {
    reportFontBytesPromise = Promise.all([
      readFile(REPORT_FONT_PATHS.regular),
      readFile(REPORT_FONT_PATHS.bold),
    ]).catch((error) => {
      reportFontBytesPromise = undefined;
      throw error;
    });
  }
  return reportFontBytesPromise;
}

function slug(value, fallback = 'obra') {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return normalized || fallback;
}

export function weeklyReportPdfFilename(report = {}) {
  const reportId = slug(report.reportId, 'sin-id');
  const version = Number(report.snapshotVersion);
  const versionLabel = Number.isSafeInteger(version) && version > 0
    ? `v${version}`
    : 'sin-snapshot';
  return `reporte-semanal-${slug(report.projectName)}-${reportId}-${versionLabel}.pdf`;
}

function snapshotLabel(value) {
  const version = Number(value);
  return Number.isSafeInteger(version) && version > 0
    ? `Snapshot ${version}`
    : 'Sin snapshot';
}

function formatDate(value, options = {}) {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    ...options,
  }).format(parsed);
}

function taskDate(value) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
  }).format(parsed);
}

function fitEllipsis(line, font, size, maxWidth) {
  let output = fontSafeText(line, font);
  while (output.length > 1 && font.widthOfTextAtSize(`${output}...`, size) > maxWidth) {
    output = output.slice(0, -1);
  }
  return `${output.trimEnd()}...`;
}

function splitLongWord(word, font, size, maxWidth) {
  const parts = [];
  let current = '';
  for (const character of word) {
    const candidate = `${current}${character}`;
    if (current && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      parts.push(current);
      current = character;
    } else {
      current = candidate;
    }
  }
  if (current) parts.push(current);
  return parts;
}

function wrapText(value, font, size, maxWidth, maximumLines = Number.POSITIVE_INFINITY) {
  const words = fontSafeText(value, font).split(' ').filter(Boolean);
  const lines = [];
  let line = '';

  for (const originalWord of words) {
    const pieces = font.widthOfTextAtSize(originalWord, size) > maxWidth
      ? splitLongWord(originalWord, font, size, maxWidth)
      : [originalWord];
    for (const word of pieces) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
  }

  if (line || lines.length === 0) lines.push(line || '-');
  if (lines.length <= maximumLines) return lines;
  const limited = lines.slice(0, maximumLines);
  limited[limited.length - 1] = fitEllipsis(limited.at(-1), font, size, maxWidth);
  return limited;
}

function toneColor(tone) {
  if (tone === 'danger') return COLOR.red;
  if (tone === 'warning') return COLOR.orange;
  if (tone === 'success') return COLOR.green;
  return COLOR.muted;
}

function taskPlan(task) {
  const startsAt = taskDate(task.startDate);
  const endsAt = taskDate(task.endDate);
  if (startsAt && endsAt) return `${startsAt} - ${endsAt}`;
  return `Dia ${Number(task.startDay) || 0} - ${Number(task.endDay) || 0}`;
}

export async function renderWeeklyReportPdf(report) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const [regularBytes, boldBytes] = await loadReportFontBytes();
  const regular = await pdfDoc.embedFont(regularBytes, { subset: true });
  const bold = await pdfDoc.embedFont(boldBytes, { subset: true });
  const mono = await pdfDoc.embedFont(StandardFonts.Courier);
  const generatedAt = report.generatedAt instanceof Date
    ? report.generatedAt
    : new Date(report.generatedAt || Date.now());

  pdfDoc.setTitle(pdfSafeText(`Reporte semanal - ${report.projectName}`, 160));
  pdfDoc.setAuthor(pdfSafeText(report.issuedBy || 'ObraSaaS', 120));
  pdfDoc.setSubject('Control operativo, evidencia y trazabilidad de obra');
  pdfDoc.setKeywords(['ObraSaaS', 'reporte semanal', 'control de obra', 'evidencia']);
  pdfDoc.setProducer('ObraSaaS Report Engine');
  pdfDoc.setCreator('ObraSaaS');
  pdfDoc.setCreationDate(Number.isNaN(generatedAt.getTime()) ? new Date() : generatedAt);
  pdfDoc.setModificationDate(Number.isNaN(generatedAt.getTime()) ? new Date() : generatedAt);
  if (typeof pdfDoc.setLanguage === 'function') pdfDoc.setLanguage('es-AR');

  let page;
  let cursorY;

  function addPage(continuationLabel = '') {
    page = pdfDoc.addPage([A4.width, A4.height]);
    page.drawRectangle({ x: 0, y: 0, width: A4.width, height: A4.height, color: COLOR.paper });
    page.drawRectangle({ x: 0, y: A4.height - 5, width: A4.width, height: 5, color: COLOR.orange });
    page.drawSvgPath(OBRA_SAAS_STRUCTURE_PATH, {
      x: MARGIN,
      y: A4.height - 31,
      scale: 0.34,
      color: COLOR.ink,
    });
    page.drawSvgPath(OBRA_SAAS_TRACE_PATH, {
      x: MARGIN,
      y: A4.height - 31,
      scale: 0.34,
      borderColor: COLOR.orange,
      borderLineCap: LineCapStyle.Round,
      borderWidth: 7,
    });
    page.drawText('ObraSaaS', {
      x: MARGIN + 31,
      y: A4.height - 52,
      size: 12,
      font: bold,
      color: COLOR.ink,
    });
    const headerLabel = continuationLabel
      ? `REPORTE SEMANAL - ${fontSafeText(continuationLabel, bold, 46).toUpperCase()}`
      : 'REPORTE EJECUTIVO SEMANAL';
    page.drawText(headerLabel, {
      x: A4.width - MARGIN - bold.widthOfTextAtSize(headerLabel, 7),
      y: A4.height - 50,
      size: 7,
      font: bold,
      color: COLOR.orange,
    });
    page.drawLine({
      start: { x: MARGIN, y: A4.height - 68 },
      end: { x: A4.width - MARGIN, y: A4.height - 68 },
      thickness: 0.7,
      color: COLOR.line,
    });
    cursorY = A4.height - 92;
  }

  function ensureSpace(height, continuationLabel = 'Continuacion') {
    if (cursorY - height < CONTENT_BOTTOM) addPage(continuationLabel);
  }

  function drawLines(lines, {
    x = MARGIN,
    y = cursorY,
    size = 9,
    lineHeight = size * 1.35,
    font = regular,
    color = COLOR.body,
  } = {}) {
    lines.forEach((line, index) => {
      page.drawText(fontSafeText(line, font), {
        x,
        y: y - (index * lineHeight),
        size,
        font,
        color,
      });
    });
    return lines.length * lineHeight;
  }

  function drawSectionHeading(kicker, title, continuationLabel = title) {
    // Keep the heading with at least the first row/card that follows it.
    ensureSpace(118, continuationLabel);
    page.drawText(fontSafeText(kicker, bold, 80).toUpperCase(), {
      x: MARGIN,
      y: cursorY,
      size: 7,
      font: bold,
      color: COLOR.orange,
    });
    cursorY -= 18;
    const lines = wrapText(title, bold, 15, CONTENT_WIDTH, 2);
    cursorY -= drawLines(lines, {
      size: 15,
      lineHeight: 17,
      font: bold,
      color: COLOR.ink,
    }) + 10;
  }

  function drawNotice(value, tone = 'warning') {
    const isDanger = tone === 'danger';
    const lines = wrapText(value, regular, 8.5, CONTENT_WIDTH - 28, 5);
    const height = Math.max(42, (lines.length * 12) + 20);
    ensureSpace(height + 8, 'Avisos');
    page.drawRectangle({
      x: MARGIN,
      y: cursorY - height,
      width: CONTENT_WIDTH,
      height,
      color: isDanger ? COLOR.redSoft : COLOR.orangeSoft,
      borderColor: isDanger ? COLOR.red : COLOR.orange,
      borderWidth: 0.8,
    });
    drawLines(lines, {
      x: MARGIN + 14,
      y: cursorY - 15,
      size: 8.5,
      lineHeight: 12,
      color: isDanger ? COLOR.red : COLOR.body,
    });
    cursorY -= height + 10;
  }

  function drawTable({ title, columns, rows, emptyLabel, omitted = 0 }) {
    const headerHeight = 24;

    function drawHeader() {
      page.drawRectangle({
        x: MARGIN,
        y: cursorY - headerHeight,
        width: CONTENT_WIDTH,
        height: headerHeight,
        color: COLOR.ink,
      });
      let x = MARGIN;
      columns.forEach((column) => {
        page.drawText(fontSafeText(column.label, bold).toUpperCase(), {
          x: x + 8,
          y: cursorY - 15,
          size: 6.4,
          font: bold,
          color: COLOR.white,
        });
        x += column.width;
      });
      cursorY -= headerHeight;
    }

    ensureSpace(headerHeight + 38, title);
    drawHeader();

    if (rows.length === 0) {
      const height = 38;
      page.drawRectangle({
        x: MARGIN,
        y: cursorY - height,
        width: CONTENT_WIDTH,
        height,
        color: COLOR.panel,
        borderColor: COLOR.line,
        borderWidth: 0.6,
      });
      const label = fontSafeText(emptyLabel, regular);
      page.drawText(label, {
        x: MARGIN + ((CONTENT_WIDTH - regular.widthOfTextAtSize(label, 8)) / 2),
        y: cursorY - 23,
        size: 8,
        font: regular,
        color: COLOR.muted,
      });
      cursorY -= height + 12;
      return;
    }

    rows.forEach((row, rowIndex) => {
      const cellLines = row.cells.map((cell, index) => wrapText(
        cell,
        index === 0 ? bold : regular,
        7.4,
        columns[index].width - 16,
        columns[index].maximumLines || 3,
      ));
      const lineCount = Math.max(...cellLines.map((lines) => lines.length));
      const rowHeight = Math.max(30, (lineCount * 10) + 14);
      if (cursorY - rowHeight < CONTENT_BOTTOM) {
        addPage(title);
        drawHeader();
      }
      page.drawRectangle({
        x: MARGIN,
        y: cursorY - rowHeight,
        width: CONTENT_WIDTH,
        height: rowHeight,
        color: rowIndex % 2 === 0 ? COLOR.white : COLOR.panel,
        borderColor: COLOR.line,
        borderWidth: 0.45,
      });
      page.drawRectangle({
        x: MARGIN,
        y: cursorY - rowHeight,
        width: 3,
        height: rowHeight,
        color: toneColor(row.tone),
      });
      let x = MARGIN;
      cellLines.forEach((lines, index) => {
        drawLines(lines, {
          x: x + 8,
          y: cursorY - 12,
          size: 7.4,
          lineHeight: 10,
          font: index === 0 ? bold : regular,
          color: index === cellLines.length - 1 ? toneColor(row.tone) : COLOR.body,
        });
        x += columns[index].width;
      });
      cursorY -= rowHeight;
    });
    cursorY -= 10;

    if (omitted > 0) {
      ensureSpace(24, title);
      const plural = omitted === 1 ? '' : 's';
      page.drawText(`${omitted} registro${plural} adicional${plural} no incluido${plural} para mantener el documento acotado.`, {
        x: MARGIN,
        y: cursorY,
        size: 7,
        font: regular,
        color: COLOR.muted,
      });
      cursorY -= 18;
    }
  }

  addPage();
  page.drawText('CONTROL OPERATIVO Y EVIDENCIA', {
    x: MARGIN,
    y: cursorY,
    size: 7,
    font: bold,
    color: COLOR.orange,
  });
  cursorY -= 24;
  const projectLines = wrapText(report.projectName, bold, 25, CONTENT_WIDTH * 0.78, 3);
  cursorY -= drawLines(projectLines, {
    size: 25,
    lineHeight: 28,
    font: bold,
    color: COLOR.ink,
  }) + 8;
  const contextLine = `${pdfSafeText(report.organizationName, 100)} - ${pdfSafeText(report.projectAddress, 140)}`;
  const contextLines = wrapText(contextLine, regular, 9, CONTENT_WIDTH, 2);
  cursorY -= drawLines(contextLines, {
    size: 9,
    lineHeight: 12,
    color: COLOR.muted,
  }) + 20;

  const contextHeight = 58;
  page.drawRectangle({
    x: MARGIN,
    y: cursorY - contextHeight,
    width: CONTENT_WIDTH,
    height: contextHeight,
    color: COLOR.ink,
  });
  const contextItems = [
    ['DOCUMENTO', report.reportId],
    ['PERIODO', `${formatDate(report.periodStart, { timeZone: report.timeZone, day: '2-digit', month: 'short' })} - ${formatDate(report.generatedAt, { timeZone: report.timeZone, day: '2-digit', month: 'short', year: 'numeric' })}`],
    ['VERSION', snapshotLabel(report.snapshotVersion)],
  ];
  const contextColumnWidth = CONTENT_WIDTH / contextItems.length;
  contextItems.forEach(([label, value], index) => {
    const x = MARGIN + (index * contextColumnWidth) + 14;
    page.drawText(label, { x, y: cursorY - 18, size: 6.3, font: bold, color: COLOR.orange });
    drawLines(wrapText(value, index === 0 ? mono : bold, 8, contextColumnWidth - 28, 2), {
      x,
      y: cursorY - 36,
      size: 8,
      lineHeight: 10,
      font: index === 0 ? mono : bold,
      color: COLOR.white,
    });
  });
  cursorY -= contextHeight + 20;

  const metricGap = 8;
  const metricWidth = (CONTENT_WIDTH - (metricGap * 3)) / 4;
  const metrics = [
    ['Avance fisico', `${Number(report.progress) || 0}%`, `${Number(report.tasksDone) || 0}/${Array.isArray(report.tasks) ? report.tasks.length : 0} tareas`],
    ['Plazo consumido', `${Number(report.timelinePercentage) || 0}%`, `Dia ${Number(report.currentDay) || 0} de ${Number(report.totalDays) || 0}`],
    ['Alertas activas', String(Number(report.alertsCount) || 0), `${Number(report.criticalIncidents) || 0} prioridad alta`],
    ['Ingresos verificados', `${Number(report.presentWorkers) || 0}/${Array.isArray(report.attendance) ? report.attendance.length : 0}`, 'personas del periodo'],
  ];
  metrics.forEach(([label, value, detail], index) => {
    const x = MARGIN + (index * (metricWidth + metricGap));
    page.drawRectangle({
      x,
      y: cursorY - 68,
      width: metricWidth,
      height: 68,
      color: COLOR.panel,
      borderColor: COLOR.line,
      borderWidth: 0.6,
    });
    page.drawText(label.toUpperCase(), { x: x + 11, y: cursorY - 16, size: 6.2, font: bold, color: COLOR.muted });
    page.drawText(value, { x: x + 11, y: cursorY - 39, size: 17, font: bold, color: COLOR.ink });
    page.drawText(fontSafeText(detail, regular, 42), { x: x + 11, y: cursorY - 55, size: 6.7, font: regular, color: COLOR.muted });
  });
  cursorY -= 88;

  if (report.isEmptyState) {
    drawNotice('Reporte sin actividad operativa persistida. Los indicadores permanecen vacios o en cero y no representan una obra real.');
  }

  const summaryLines = wrapText(report.executiveSummary, regular, 9.2, CONTENT_WIDTH - 36, 8);
  const summaryHeight = Math.max(88, (summaryLines.length * 13) + 42);
  ensureSpace(summaryHeight, 'Resumen ejecutivo');
  page.drawRectangle({
    x: MARGIN,
    y: cursorY - summaryHeight,
    width: CONTENT_WIDTH,
    height: summaryHeight,
    color: COLOR.ink,
  });
  page.drawRectangle({ x: MARGIN, y: cursorY - summaryHeight, width: 5, height: summaryHeight, color: COLOR.orange });
  page.drawText('LECTURA EJECUTIVA', { x: MARGIN + 20, y: cursorY - 22, size: 6.5, font: bold, color: COLOR.orange });
  drawLines(summaryLines, {
    x: MARGIN + 20,
    y: cursorY - 43,
    size: 9.2,
    lineHeight: 13,
    color: COLOR.white,
  });
  cursorY -= summaryHeight + 22;

  const pulse = [
    `${Number(report.evidenceCount) || 0}${report.evidenceTruncated ? '+' : ''} evidencias`,
    `${Number(report.audioCount) || 0}${report.evidenceTruncated ? '+' : ''} audios procesados`,
    `${Number(report.dependencyCount) || 0} dependencias`,
    `${Number(report.scheduleConflicts) || 0} conflictos de secuencia`,
  ];
  ensureSpace(52, 'Indicadores');
  page.drawText('TRAZABILIDAD DISPONIBLE', { x: MARGIN, y: cursorY, size: 6.6, font: bold, color: COLOR.orange });
  cursorY -= 19;
  const pulseWidth = CONTENT_WIDTH / pulse.length;
  pulse.forEach((value, index) => {
    page.drawText(fontSafeText(value, bold), {
      x: MARGIN + (index * pulseWidth),
      y: cursorY,
      size: 7.4,
      font: bold,
      color: COLOR.body,
    });
  });

  addPage('Planificacion');
  drawSectionHeading('Planificacion', 'Cronograma y responsables');
  const tasks = Array.isArray(report.tasks) ? report.tasks : [];
  const visibleTasks = tasks.slice(0, LIMITS.tasks);
  drawTable({
    title: 'Planificacion',
    columns: [
      { label: 'Actividad', width: 188, maximumLines: 3 },
      { label: 'Responsable', width: 104, maximumLines: 3 },
      { label: 'Plan', width: 100, maximumLines: 2 },
      { label: 'Estado', width: CONTENT_WIDTH - 392, maximumLines: 2 },
    ],
    rows: visibleTasks.map((task) => ({
      tone: task.tone,
      cells: [
        task.dependencyNames?.length
          ? `${task.name} / Predecesoras: ${task.dependencyNames.join(', ')}`
          : task.name,
        task.assignee,
        taskPlan(task),
        `${task.status} - ${Number(task.progress) || 0}%`,
      ],
    })),
    emptyLabel: 'No hay tareas registradas.',
    omitted: Math.max(0, tasks.length - visibleTasks.length),
  });

  drawSectionHeading('Campo', 'Asistencia registrada');
  const attendance = Array.isArray(report.attendance) ? report.attendance : [];
  const visibleAttendance = attendance.slice(0, LIMITS.attendance);
  drawTable({
    title: 'Asistencia',
    columns: [
      { label: 'Persona', width: 118, maximumLines: 2 },
      { label: 'Funcion', width: 95, maximumLines: 2 },
      { label: 'Ultima jornada', width: 190, maximumLines: 3 },
      { label: 'Estado', width: CONTENT_WIDTH - 403, maximumLines: 3 },
    ],
    rows: visibleAttendance.map((entry) => ({
      tone: entry.tone,
      cells: [entry.name, entry.role, entry.journeyLabel, entry.status],
    })),
    emptyLabel: 'No hay registros de asistencia.',
    omitted: Math.max(0, attendance.length - visibleAttendance.length),
  });

  drawSectionHeading('Abastecimiento', 'Materiales y acopios');
  const stockpiles = Array.isArray(report.stockpiles) ? report.stockpiles : [];
  const visibleStockpiles = stockpiles.slice(0, LIMITS.stockpiles);
  drawTable({
    title: 'Abastecimiento',
    columns: [
      { label: 'Material', width: 220, maximumLines: 2 },
      { label: 'Disponible', width: 137, maximumLines: 2 },
      { label: 'Estado', width: CONTENT_WIDTH - 357, maximumLines: 2 },
    ],
    rows: visibleStockpiles.map((item) => ({
      tone: item.tone,
      cells: [item.name, `${item.current} ${item.unit}`, item.status],
    })),
    emptyLabel: 'No hay materiales registrados.',
    omitted: Math.max(0, stockpiles.length - visibleStockpiles.length),
  });

  drawSectionHeading('Trazabilidad', 'Incidencias y evidencia');
  const incidents = Array.isArray(report.incidents) ? report.incidents : [];
  const visibleIncidents = incidents.slice(0, LIMITS.incidents);
  drawTable({
    title: 'Incidencias',
    columns: [
      { label: 'Evento', width: 142, maximumLines: 3 },
      { label: 'Detalle', width: 225, maximumLines: 4 },
      { label: 'Origen', width: 84, maximumLines: 3 },
      { label: 'Prioridad', width: CONTENT_WIDTH - 451, maximumLines: 2 },
    ],
    rows: visibleIncidents.map((incident) => ({
      tone: incident.tone,
      cells: [incident.title, incident.description, incident.reporter, incident.label],
    })),
    emptyLabel: 'No hay incidencias registradas en el estado actual.',
    omitted: Math.max(0, Number(report.incidentTotal) - visibleIncidents.length),
  });
  if (report.evidenceTruncated) {
    drawNotice(`La semana supera ${Number(report.evidenceMessageLimit) || 500} mensajes. Los conteos de evidencia corresponden a los mensajes mas recientes del periodo y se muestran como minimos.`);
  }

  drawSectionHeading('Control economico', report.budget
    ? 'Presupuesto operativo informado'
    : 'Presupuesto pendiente de configuracion');
  if (report.budget) {
    ensureSpace(72, 'Control economico');
    const budgetItems = [
      ['TOTAL', report.budget.formattedTotal],
      ['EJECUTADO', report.budget.formattedExecuted],
      ['DISPONIBLE', report.budget.formattedRemaining],
    ];
    const budgetWidth = CONTENT_WIDTH / budgetItems.length;
    budgetItems.forEach(([label, value], index) => {
      const x = MARGIN + (index * budgetWidth);
      page.drawRectangle({
        x,
        y: cursorY - 58,
        width: budgetWidth - 6,
        height: 58,
        color: COLOR.panel,
        borderColor: COLOR.line,
        borderWidth: 0.6,
      });
      page.drawText(label, { x: x + 12, y: cursorY - 18, size: 6.4, font: bold, color: COLOR.muted });
      page.drawText(fontSafeText(value, bold), { x: x + 12, y: cursorY - 40, size: 12, font: bold, color: COLOR.ink });
    });
    cursorY -= 75;
  } else {
    drawNotice('ObraSaaS no inventa montos: el tenant debe cargar el presupuesto contractual antes de incorporarlo a reportes ejecutivos.');
  }

  ensureSpace(100, 'Control documental');
  page.drawRectangle({
    x: MARGIN,
    y: cursorY - 82,
    width: CONTENT_WIDTH,
    height: 82,
    color: COLOR.greenSoft,
    borderColor: COLOR.green,
    borderWidth: 0.7,
  });
  page.drawText('CONTROL DOCUMENTAL', { x: MARGIN + 16, y: cursorY - 19, size: 6.6, font: bold, color: COLOR.green });
  drawLines([
    `Emitido por: ${pdfSafeText(report.issuedBy, 100)} (${pdfSafeText(report.issuedByEmail, 140)})`,
    `Generado: ${formatDate(report.generatedAt, { timeZone: report.timeZone, dateStyle: 'short', timeStyle: 'short' })} - ${report.timeZone}`,
    `Version de datos: ${snapshotLabel(report.snapshotVersion)} - Documento aislado por tenant y proyecto`,
  ], {
    x: MARGIN + 16,
    y: cursorY - 38,
    size: 7.4,
    lineHeight: 13,
    color: COLOR.body,
  });

  const pages = pdfDoc.getPages();
  pages.forEach((currentPage, index) => {
    currentPage.drawLine({
      start: { x: MARGIN, y: 37 },
      end: { x: A4.width - MARGIN, y: 37 },
      thickness: 0.55,
      color: COLOR.line,
    });
    currentPage.drawText(fontSafeText(report.reportId, mono, 60), {
      x: MARGIN,
      y: 22,
      size: 6.5,
      font: mono,
      color: COLOR.muted,
    });
    const pageLabel = `${index + 1} / ${pages.length}`;
    currentPage.drawText(pageLabel, {
      x: A4.width - MARGIN - bold.widthOfTextAtSize(pageLabel, 6.5),
      y: 22,
      size: 6.5,
      font: bold,
      color: COLOR.muted,
    });
  });

  return pdfDoc.save();
}
