export const PROGRESS_LOG_FILTERS = Object.freeze([
  { value: 'ALL', label: 'Todos' },
  { value: 'DRAFT', label: 'Borradores' },
  { value: 'SUBMITTED', label: 'En revisión' },
  { value: 'APPROVED', label: 'Aprobados' },
  { value: 'REJECTED', label: 'Rechazados' },
]);

const normalize = value => typeof value === 'string'
  ? value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-AR').replace(/\s+/g, ' ').trim()
  : '';

export function progressJournalSummary(data) {
  const logs = Array.isArray(data?.dailyLogs) ? data.dailyLogs : [];
  const evidence = Array.isArray(data?.evidence) ? data.evidence : [];
  return {
    records: logs.length,
    drafts: logs.filter(row => row?.status === 'DRAFT').length,
    inReview: logs.filter(row => row?.status === 'SUBMITTED').length,
    approved: logs.filter(row => row?.status === 'APPROVED').length,
    unassigned: logs.filter(row => !row?.taskId).length,
    evidence: evidence.length,
  };
}

export function filterProgressLogs(rows, { query = '', status = 'ALL', unassignedOnly = false } = {}) {
  if (!Array.isArray(rows)) return [];
  const tokens = normalize(query).split(' ').filter(Boolean);
  return rows.filter(row => {
    if (unassignedOnly && row?.taskId) return false;
    if (status !== 'ALL' && row?.status !== status) return false;
    if (!tokens.length) return true;
    const haystack = normalize([row?.id, row?.title, row?.summary, row?.workDate].filter(Boolean).join(' '));
    return tokens.every(token => haystack.includes(token));
  });
}
