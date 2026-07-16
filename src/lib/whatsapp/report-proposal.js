const MAX_INPUT_LENGTH = 4096;
const MAX_SUMMARY_LENGTH = 280;
const MAX_TASK_REFERENCE_LENGTH = 64;
const MAX_SIGNALS_PER_KIND = 6;

export const REPORT_PROPOSAL_TYPES = Object.freeze({
  CRITICAL_INCIDENT: 'CRITICAL_INCIDENT',
  DELAY_REPORT: 'DELAY_REPORT',
  TASK_PROGRESS: 'TASK_PROGRESS',
  ATTENDANCE_REQUEST: 'ATTENDANCE_REQUEST',
  GENERAL_NOTE: 'GENERAL_NOTE',
});

const HARD_RISK_PATTERNS = Object.freeze([
  ['ACCIDENTE', /(?:^|[^a-z0-9])accidentes?(?=$|[^a-z0-9])/g],
  ['INCENDIO', /(?:^|[^a-z0-9])incendios?(?=$|[^a-z0-9])/g],
  ['EXPLOSION', /(?:^|[^a-z0-9])explosiones?(?=$|[^a-z0-9])/g],
  ['DERRUMBE', /(?:^|[^a-z0-9])derrumbes?(?=$|[^a-z0-9])/g],
  ['COLAPSO', /(?:^|[^a-z0-9])colapsos?(?=$|[^a-z0-9])/g],
  ['ELECTROCUCION', /(?:^|[^a-z0-9])electroc(?:ucion|utado|utada|utados|utadas)(?=$|[^a-z0-9])/g],
  ['PERSONA_HERIDA', /(?:^|[^a-z0-9])(?:herid[oa]s?|lesionad[oa]s?)(?=$|[^a-z0-9])/g],
  ['PELIGRO', /(?:^|[^a-z0-9])peligros?(?=$|[^a-z0-9])/g],
  ['RIESGO', /(?:^|[^a-z0-9])riesgos?(?=$|[^a-z0-9])/g],
  ['FUGA', /(?:^|[^a-z0-9])fugas?(?=$|[^a-z0-9])/g],
  ['CAIDA_DE_PERSONA', /(?:^|[^a-z0-9])caida\s+(?:de\s+)?(?:persona|operario|trabajador|altura)(?=$|[^a-z0-9])/g],
]);

const RISK_MODIFIER_PATTERNS = Object.freeze([
  ['URGENTE', /(?:^|[^a-z0-9])urgente(?:s)?(?=$|[^a-z0-9])/g],
  ['EMERGENCIA', /(?:^|[^a-z0-9])emergencias?(?=$|[^a-z0-9])/g],
]);

const DELAY_PATTERNS = Object.freeze([
  ['DEMORA', /(?:^|[^a-z0-9])demoras?(?=$|[^a-z0-9])/g],
  ['RETRASO', /(?:^|[^a-z0-9])(?:retras[oa]s?|retrasad[oa]s?)(?=$|[^a-z0-9])/g],
  ['ATRASO', /(?:^|[^a-z0-9])(?:atras[oa]s?|atrasad[oa]s?)(?=$|[^a-z0-9])/g],
  ['ENTREGA_NO_LLEGA', /(?:^|[^a-z0-9])(?:no\s+(?:llega|llego|llegan|llegaron)|todavia\s+no\s+(?:llega|llego))(?=$|[^a-z0-9])/g],
  ['FALTA_MATERIAL', /(?:^|[^a-z0-9])(?:falta(?:n)?|sin)\s+(?:el\s+|los\s+|la\s+|las\s+)?(?:material(?:es)?|insumos?|stock)(?=$|[^a-z0-9])/g],
  ['ESPERA_DE_MATERIAL', /(?:^|[^a-z0-9])(?:esperando|a\s+la\s+espera\s+de)\s+(?:el\s+|los\s+|la\s+|las\s+)?(?:material(?:es)?|insumos?|suministros?)(?=$|[^a-z0-9])/g],
]);

const ATTENDANCE_PATTERNS = Object.freeze([
  /(?:^|[^a-z0-9])(?:quiero|necesito|debo|voy\s+a)\s+fichar(?=$|[^a-z0-9])/,
  /(?:^|[^a-z0-9])fichar(?=$|[^a-z0-9])/,
  /(?:^|[^a-z0-9])(?:marcar|registrar)\s+(?:mi\s+)?(?:entrada|salida|ingreso|egreso|asistencia)(?=$|[^a-z0-9])/,
  /(?:^|[^a-z0-9])(?:estoy\s+entrando|estoy\s+saliendo|arranco\s+(?:la\s+)?(?:obra|jornada|turno))(?=$|[^a-z0-9])/,
]);

const NEGATION_BEFORE_SIGNAL = /(?:^|\s)(?:sin|ningun[oa]?|no\s+hay|no\s+hubo|no\s+existe(?:n)?|no\s+se\s+(?:registro|registraron|reporto|reportaron|detecto|detectaron))\s+(?:[a-z0-9]+\s+){0,4}$/;
const SIMULATION_BEFORE_SIGNAL = /(?:^|\s)(?:simulacro|simulacion|ejercicio|prueba)\s+(?:[a-z0-9]+\s+){0,3}$/;

const SMALL_SPANISH_NUMBERS = Object.freeze({
  cero: 0,
  uno: 1,
  un: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciseis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veinte: 20,
  veintiuno: 21,
  veintiun: 21,
  veintidos: 22,
  veintitres: 23,
  veinticuatro: 24,
  veinticinco: 25,
  veintiseis: 26,
  veintisiete: 27,
  veintiocho: 28,
  veintinueve: 29,
  cien: 100,
});

const SPANISH_TENS = Object.freeze({
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
  sesenta: 60,
  setenta: 70,
  ochenta: 80,
  noventa: 90,
});

function normalizeText(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function boundedText(value, limit) {
  const normalizedWhitespace = value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (normalizedWhitespace.length <= limit) return normalizedWhitespace;
  return `${normalizedWhitespace.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

function matchStart(match) {
  const leadingBoundary = match[0].match(/^[^a-z0-9]/)?.[0]?.length || 0;
  return match.index + leadingBoundary;
}

function isNegatedOrSimulated(text, index) {
  const prefix = text.slice(Math.max(0, index - 96), index);
  const clause = prefix.split(/[.!?;,:\n]|\bpero\b/).at(-1).trimStart();
  return NEGATION_BEFORE_SIGNAL.test(clause) || SIMULATION_BEFORE_SIGNAL.test(clause);
}

function collectSignals(text, definitions, { contextual = true } = {}) {
  const found = [];
  for (const [code, expression] of definitions) {
    expression.lastIndex = 0;
    let match = expression.exec(text);
    while (match) {
      if (!contextual || !isNegatedOrSimulated(text, matchStart(match))) {
        found.push(code);
        break;
      }
      match = expression.exec(text);
    }
    if (found.length === MAX_SIGNALS_PER_KIND) break;
  }
  return found;
}

function parseSpanishNumber(phrase) {
  const words = phrase.trim().split(/\s+/).filter((word) => word !== 'y');
  if (words.length === 1 && Object.hasOwn(SMALL_SPANISH_NUMBERS, words[0])) {
    return SMALL_SPANISH_NUMBERS[words[0]];
  }
  if (words.length === 2 && Object.hasOwn(SPANISH_TENS, words[0])) {
    const unit = SMALL_SPANISH_NUMBERS[words[1]];
    if (Number.isInteger(unit) && unit >= 1 && unit <= 9) return SPANISH_TENS[words[0]] + unit;
  }
  return null;
}

function extractPercentage(text) {
  const numericExpression = /(?:^|[^0-9])([0-9]{1,3}(?:[.,][0-9]{1,2})?)\s*(?:%|por\s+ciento)(?![a-z])/g;
  let numericMatch = numericExpression.exec(text);
  while (numericMatch) {
    const value = Number(numericMatch[1].replace(',', '.'));
    if (Number.isFinite(value) && value >= 0 && value <= 100) return value;
    numericMatch = numericExpression.exec(text);
  }

  const numberWords = [
    ...Object.keys(SMALL_SPANISH_NUMBERS),
    ...Object.keys(SPANISH_TENS),
  ].sort((left, right) => right.length - left.length).join('|');
  const wordExpression = new RegExp(
    `(?:^|[^a-z])((?:${numberWords})(?:\\s+y\\s+(?:uno|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve))?)\\s+por\\s+ciento(?![a-z])`,
    'g',
  );
  let wordMatch = wordExpression.exec(text);
  while (wordMatch) {
    const value = parseSpanishNumber(wordMatch[1]);
    if (Number.isInteger(value) && value >= 0 && value <= 100) return value;
    wordMatch = wordExpression.exec(text);
  }
  return null;
}

function extractTaskReference(text) {
  const codedReference = /(?:^|[^a-z0-9])((?:tarea|actividad|item|hito)\s*(?:(?:nro|numero)\.?\s*)?#?\s*[:\-]?\s*([a-z0-9][a-z0-9._/-]{0,39}))(?=$|[^a-z0-9._/-])/;
  const codedMatch = codedReference.exec(text);
  if (codedMatch && /[0-9]/.test(codedMatch[2])) {
    return boundedText(codedMatch[1], MAX_TASK_REFERENCE_LENGTH);
  }

  const quotedReference = /(?:^|[^a-z0-9])(?:tarea|actividad)\s+["']([^"'\n]{2,80})["']/;
  const quotedMatch = quotedReference.exec(text);
  if (quotedMatch) return boundedText(quotedMatch[1], MAX_TASK_REFERENCE_LENGTH);

  const frontReference = /(?:^|[^a-z0-9])(frente\s+[a-z0-9][a-z0-9_-]{1,39})(?=$|[^a-z0-9_-])/;
  const frontMatch = frontReference.exec(text);
  return frontMatch ? boundedText(frontMatch[1], MAX_TASK_REFERENCE_LENGTH) : null;
}

function isAttendanceRequest(text) {
  return ATTENDANCE_PATTERNS.some((expression) => expression.test(text));
}

/**
 * Converts an already-produced transcript into a bounded proposal. It never
 * authorizes or performs an operation; consumers must request text confirmation.
 */
export function classifyReportProposal(transcription) {
  const validInput = typeof transcription === 'string';
  const source = validInput ? transcription.slice(0, MAX_INPUT_LENGTH) : '';
  const summary = boundedText(source, MAX_SUMMARY_LENGTH);
  const text = normalizeText(source);
  const hardRiskSignals = collectSignals(text, HARD_RISK_PATTERNS);
  const riskSignals = [
    ...hardRiskSignals,
    ...collectSignals(text, RISK_MODIFIER_PATTERNS),
  ].slice(0, MAX_SIGNALS_PER_KIND);
  const delaySignals = collectSignals(text, DELAY_PATTERNS);
  const percentage = extractPercentage(text);
  const taskReference = extractTaskReference(text);

  let type = REPORT_PROPOSAL_TYPES.GENERAL_NOTE;
  if (hardRiskSignals.length > 0) type = REPORT_PROPOSAL_TYPES.CRITICAL_INCIDENT;
  else if (delaySignals.length > 0) type = REPORT_PROPOSAL_TYPES.DELAY_REPORT;
  else if (percentage !== null) type = REPORT_PROPOSAL_TYPES.TASK_PROGRESS;
  else if (isAttendanceRequest(text)) type = REPORT_PROPOSAL_TYPES.ATTENDANCE_REQUEST;

  return {
    type,
    summary,
    percentage,
    taskReference,
    signals: {
      risk: riskSignals,
      delay: delaySignals,
    },
    requiresTextConfirmation: true,
    truncated: validInput && transcription.length > MAX_INPUT_LENGTH,
  };
}
