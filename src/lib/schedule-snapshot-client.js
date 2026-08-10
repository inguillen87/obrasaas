function rowsWithStableIds(rows) {
  if (!Array.isArray(rows)) {
    throw new Error('La respuesta del cronograma no contiene una lista válida.');
  }
  for (const row of rows) {
    if (!row || typeof row.id !== 'string' || !row.id.trim()) {
      throw new Error('La respuesta del cronograma contiene un registro sin identificador.');
    }
  }
  return rows;
}

export function uniqueScheduleRows(rows) {
  const seen = new Set();
  return rowsWithStableIds(rows).filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

export function mergeConfirmedBaselineRows(rows, confirmedBaseline) {
  if (
    !confirmedBaseline
    || typeof confirmedBaseline.id !== 'string'
    || !confirmedBaseline.id.trim()
  ) {
    throw new Error('La respuesta confirmada no contiene una línea base identificable.');
  }
  const current = uniqueScheduleRows(rows);
  const normalized = confirmedBaseline.status === 'ACTIVE'
    ? current.map((baseline) => (
        baseline.id !== confirmedBaseline.id && baseline.status === 'ACTIVE'
          ? {
              ...baseline,
              status: 'SUPERSEDED',
              supersededById: confirmedBaseline.id,
              supersededAt: confirmedBaseline.publishedAt || baseline.supersededAt || null,
            }
          : baseline
      ))
    : current;
  return uniqueScheduleRows([
    confirmedBaseline,
    ...normalized.filter((baseline) => baseline.id !== confirmedBaseline.id),
  ]);
}

export function mergeConfirmedForecastRows(rows, confirmedForecast) {
  if (
    !confirmedForecast
    || typeof confirmedForecast.id !== 'string'
    || !confirmedForecast.id.trim()
  ) {
    throw new Error('La respuesta confirmada no contiene un forecast identificable.');
  }
  const confirmedCreatedAt = Date.parse(String(confirmedForecast.createdAt || ''));
  if (!Number.isFinite(confirmedCreatedAt)) {
    throw new Error('La respuesta confirmada no contiene la fecha de creación del forecast.');
  }
  return uniqueScheduleRows([
    confirmedForecast,
    ...rowsWithStableIds(rows).filter((forecast) => forecast.id !== confirmedForecast.id),
  ]).sort((left, right) => {
    const leftCreatedAt = Date.parse(String(left.createdAt || ''));
    const rightCreatedAt = Date.parse(String(right.createdAt || ''));
    if (Number.isFinite(leftCreatedAt) && Number.isFinite(rightCreatedAt)) {
      return rightCreatedAt - leftCreatedAt || right.id.localeCompare(left.id);
    }
    if (Number.isFinite(leftCreatedAt)) return -1;
    if (Number.isFinite(rightCreatedAt)) return 1;
    return right.id.localeCompare(left.id);
  });
}

export function startFailSoftScheduleRefreshes(refreshers, {
  onFulfilled = () => undefined,
  onRejected = () => undefined,
} = {}) {
  const entries = Object.entries(refreshers || {})
    .filter(([, refresh]) => typeof refresh === 'function');

  return Promise.all(entries.map(async ([resource, refresh]) => {
    try {
      const value = await refresh();
      onFulfilled(resource, value);
      return { resource, status: 'fulfilled', value };
    } catch (reason) {
      onRejected(resource, reason);
      return { resource, status: 'rejected', reason };
    }
  }));
}
