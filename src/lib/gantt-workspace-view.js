const normalize = value => typeof value === 'string'
  ? value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-AR').replace(/\s+/g, ' ').trim()
  : '';

function safeProgress(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(100, Math.max(0, Math.round(number))) : 0;
}

export function ganttProgressAverage(tasks) {
  const values = Object.values(tasks && typeof tasks === 'object' ? tasks : {});
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, task) => sum + safeProgress(task?.progress), 0) / values.length);
}

export function ganttWorkspaceSummary(model, tasks) {
  const rows = Array.isArray(model?.tasks) ? model.tasks : [];
  const complete = Number.isSafeInteger(model?.completeTasks) ? model.completeTasks : rows.filter(row => safeProgress(row?.progress) >= 100).length;
  return {
    total: rows.length,
    open: Math.max(0, rows.length - complete),
    complete,
    dependencies: Number.isSafeInteger(model?.dependencyCount) ? model.dependencyCount : 0,
    conflicts: Number.isSafeInteger(model?.dependencyConflicts) ? model.dependencyConflicts : 0,
    delayed: Number.isSafeInteger(model?.delayedTasks) ? model.delayedTasks : 0,
    progressAverage: ganttProgressAverage(tasks),
  };
}

export function ganttTaskSearchIds(rows, query) {
  if (!Array.isArray(rows)) return [];
  const tokens = normalize(query).split(' ').filter(Boolean);
  if (!tokens.length) return rows.map(row => row.id).filter(Boolean);
  return rows.filter(row => {
    const haystack = normalize([
      row?.id,
      row?.name,
      row?.assignee,
      row?.status,
      ...(Array.isArray(row?.dependencyNames) ? row.dependencyNames : []),
    ].filter(Boolean).join(' '));
    return tokens.every(token => haystack.includes(token));
  }).map(row => row.id).filter(Boolean);
}
