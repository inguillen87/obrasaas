import { redactSensitiveText } from './sensitive-text.js';

const TEXT_FIELDS = Object.freeze([
  'group',
  'category',
  'severity',
  'title',
  'description',
  'actor',
  'source',
  'reference',
]);

export function sanitizeActivityEntry(entry) {
  return {
    ...entry,
    ...Object.fromEntries(
      TEXT_FIELDS.map((field) => [field, redactSensitiveText(entry?.[field])]),
    ),
  };
}

export function formatActivityDate(value, timezone, options = {}) {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
    ...options,
  }).format(new Date(value));
}

function csvCell(value) {
  const redacted = redactSensitiveText(value);
  const spreadsheetSafe = /^[\t\r ]*[=+\-@]/u.test(redacted)
    ? `'${redacted}`
    : redacted;
  return `"${spreadsheetSafe.replaceAll('"', '""')}"`;
}

export function buildActivityCsv(entries, {
  timezone,
  groupLabels = {},
  categoryLabels = {},
} = {}) {
  const header = [
    'Fecha',
    'Grupo',
    'Categoría',
    'Severidad',
    'Título',
    'Detalle',
    'Actor',
    'Fuente',
    'Referencia',
  ];
  const rows = entries.map((rawEntry) => {
    const entry = sanitizeActivityEntry(rawEntry);
    return [
      formatActivityDate(entry.occurredAt, timezone),
      groupLabels[entry.group] || entry.group,
      categoryLabels[entry.category] || entry.category,
      entry.severity,
      entry.title,
      entry.description,
      entry.actor,
      entry.source,
      entry.reference,
    ];
  });
  return [header, ...rows]
    .map((row) => row.map(csvCell).join(','))
    .join('\r\n');
}
