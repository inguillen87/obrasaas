const DEFAULT_MAX_CATALOG_ITEMS = 500;

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

export function validateTaskMaterialCatalogResponse(
  value,
  { maxItems = DEFAULT_MAX_CATALOG_ITEMS } = {},
) {
  const response = record(value);
  if (
    !response
    || !Array.isArray(response.items)
    || response.items.length > maxItems
    || response.hasMore !== false
    || (response.nextCursor !== undefined && response.nextCursor !== null)
  ) {
    throw new Error('El catálogo activo está incompleto; no se habilitó la publicación.');
  }

  const ids = new Set();
  return response.items.map((item) => {
    if (
      !record(item)
      || !nonEmptyString(item.id)
      || ids.has(item.id)
      || !nonEmptyString(item.code)
      || !nonEmptyString(item.name)
      || !nonEmptyString(item.baseUnit)
      || item.active !== true
    ) {
      throw new Error('El catálogo activo contiene materiales inválidos o duplicados.');
    }
    ids.add(item.id);
    return item;
  });
}

export function applyTaskMaterialHistoryPage(current, {
  taskId,
  expectedHeadId,
  history,
  hasMore,
  nextCursor,
}) {
  if (
    !current
    || current.task?.id !== taskId
    || (current.head?.id || null) !== expectedHeadId
  ) {
    return current;
  }

  const merged = [];
  const ids = new Set();
  for (const revision of [...current.history, ...history]) {
    if (!ids.has(revision.id)) {
      ids.add(revision.id);
      merged.push(revision);
    }
  }
  return {
    ...current,
    history: merged,
    hasMore,
    nextCursor,
  };
}

export const TASK_MATERIAL_CATALOG_MAX_ITEMS = DEFAULT_MAX_CATALOG_ITEMS;
