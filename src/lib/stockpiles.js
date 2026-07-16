const MAX_STOCKPILE_ITEMS = 500;
const MAX_STOCKPILE_NAME = 160;
const MAX_STOCKPILE_UNIT = 40;
const MAX_STOCKPILE_ID = 160;
const MAX_STOCKPILE_QUANTITY = 1_000_000_000_000;
const MAX_DECIMAL_PLACES = 6;
const BLOCKED_IDS = new Set(['__proto__', 'constructor', 'prototype']);

export class StockpileInputError extends Error {
  constructor(message, { code = 'INVALID_STOCKPILE' } = {}) {
    super(message);
    this.name = 'StockpileInputError';
    this.code = code;
  }
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function fail(message, code) {
  throw new StockpileInputError(message, { code });
}

function cleanText(value, label, max) {
  if (typeof value !== 'string') fail(`${label} es obligatorio.`, 'STOCKPILE_FIELD_REQUIRED');
  const text = value.trim().replace(/\s+/g, ' ');
  if (!text) fail(`${label} es obligatorio.`, 'STOCKPILE_FIELD_REQUIRED');
  if (text.length > max) fail(`${label} admite hasta ${max} caracteres.`, 'STOCKPILE_FIELD_TOO_LONG');
  return text;
}

function optionalText(value, label, max) {
  if (value == null || value === '') return '';
  if (typeof value !== 'string') fail(`${label} no tiene un formato válido.`, 'STOCKPILE_FIELD_INVALID');
  const text = value.trim().replace(/\s+/g, ' ');
  if (text.length > max) fail(`${label} admite hasta ${max} caracteres.`, 'STOCKPILE_FIELD_TOO_LONG');
  return text;
}

function finiteQuantity(value, label, { min = 0, exclusiveMin = false } = {}) {
  if (value == null || value === '' || (typeof value === 'string' && !value.trim())) {
    fail(`${label} es obligatorio.`, 'STOCKPILE_QUANTITY_REQUIRED');
  }
  if (typeof value !== 'number' && typeof value !== 'string') {
    fail(`${label} no tiene un formato numérico válido.`, 'STOCKPILE_QUANTITY_INVALID');
  }
  const number = Number(value);
  const outsideLowerBound = exclusiveMin ? number <= min : number < min;
  if (!Number.isFinite(number) || outsideLowerBound || number > MAX_STOCKPILE_QUANTITY) {
    const lowerBound = exclusiveMin ? `mayor que ${min}` : `igual o mayor que ${min}`;
    fail(
      `${label} debe ser ${lowerBound} y no superar ${MAX_STOCKPILE_QUANTITY.toLocaleString('es-AR')}.`,
      'STOCKPILE_QUANTITY_INVALID',
    );
  }
  return Number(number.toFixed(MAX_DECIMAL_PLACES));
}

function assertMaterialId(materialId) {
  if (
    typeof materialId !== 'string'
    || !materialId.trim()
    || materialId.length > MAX_STOCKPILE_ID
    || BLOCKED_IDS.has(materialId)
  ) {
    fail('El identificador del material no es válido.', 'STOCKPILE_ID_INVALID');
  }
  return materialId;
}

function comparableName(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-AR');
}

function parseMaterial(item, path = 'material') {
  if (!isPlainObject(item)) fail(`${path} debe ser un objeto.`, 'STOCKPILE_ITEM_INVALID');
  const name = cleanText(item.name, 'El nombre del material', MAX_STOCKPILE_NAME);
  const unit = cleanText(item.unit, 'La unidad de medida', MAX_STOCKPILE_UNIT);
  const current = finiteQuantity(item.current, 'El stock actual');
  const min = finiteQuantity(item.min, 'El stock mínimo');
  const max = finiteQuantity(item.max, 'La capacidad máxima', { exclusiveMin: true });

  if (min > max) {
    fail('El stock mínimo no puede superar la capacidad máxima.', 'STOCKPILE_RANGE_INVALID');
  }
  if (current > max) {
    fail('El stock actual no puede superar la capacidad máxima.', 'STOCKPILE_CAPACITY_EXCEEDED');
  }
  if (item.status != null) optionalText(item.status, 'El estado del material', 80);

  return { name, unit, current, min, max };
}

function parseLegacyMaterial(item, path = 'material') {
  if (!isPlainObject(item)) fail(`${path} debe ser un objeto.`, 'STOCKPILE_ITEM_INVALID');
  const name = cleanText(item.name, 'El nombre del material', MAX_STOCKPILE_NAME);
  const unit = optionalText(item.unit, 'La unidad de medida', MAX_STOCKPILE_UNIT);
  const current = finiteQuantity(item.current, 'El stock actual');
  const min = finiteQuantity(item.min, 'El stock mínimo');
  const max = finiteQuantity(item.max, 'La capacidad máxima');
  if (item.status != null) optionalText(item.status, 'El estado del material', 80);
  return { name, unit, current, min, max };
}

function sameOperationalMaterial(left, right) {
  if (!isPlainObject(left) || !isPlainObject(right)) return false;
  return ['name', 'unit', 'current', 'min', 'max']
    .every((field) => Object.is(left[field], right[field]));
}

function previousComparableName(previousCatalog, materialId) {
  if (!isPlainObject(previousCatalog) || !Object.hasOwn(previousCatalog, materialId)) return null;
  try {
    return comparableName(
      parseLegacyMaterial(previousCatalog[materialId], `previousStockpiles.${materialId}`).name,
    );
  } catch (error) {
    if (error instanceof StockpileInputError) return null;
    throw error;
  }
}

export function stockpileStatus(current, min) {
  return Number(current) < Number(min) ? 'Crítico' : 'Stock OK';
}

export function stockpileNeedsConfiguration(item) {
  try {
    parseMaterial(item);
    return false;
  } catch (error) {
    if (error instanceof StockpileInputError) return true;
    throw error;
  }
}

export function validateStockpileCatalog(
  catalog,
  {
    maxItems = MAX_STOCKPILE_ITEMS,
    previousCatalog = null,
  } = {},
) {
  if (!isPlainObject(catalog)) {
    fail(`Acopios debe ser un catálogo de hasta ${maxItems} materiales.`, 'STOCKPILE_CATALOG_INVALID');
  }
  const entries = Object.entries(catalog);
  if (entries.length > maxItems) {
    fail(`Acopios admite hasta ${maxItems} materiales.`, 'STOCKPILE_CATALOG_TOO_LARGE');
  }

  const names = new Map();
  for (const [materialId, item] of entries) {
    assertMaterialId(materialId);
    let parsed;
    try {
      parsed = parseMaterial(item, `stockpiles.${materialId}`);
    } catch (error) {
      const previous = isPlainObject(previousCatalog) ? previousCatalog[materialId] : null;
      if (
        !(error instanceof StockpileInputError)
        || !sameOperationalMaterial(item, previous)
      ) {
        throw error;
      }
      parseLegacyMaterial(previous, `previousStockpiles.${materialId}`);
      parsed = parseLegacyMaterial(item, `stockpiles.${materialId}`);
    }
    const comparable = comparableName(parsed.name);
    const duplicateId = names.get(comparable);
    if (duplicateId) {
      const duplicateWasPreexisting = previousComparableName(previousCatalog, materialId) === comparable
        && previousComparableName(previousCatalog, duplicateId) === comparable;
      if (!duplicateWasPreexisting) {
        fail(
          `Ya existe otro material llamado “${parsed.name}”.`,
          'STOCKPILE_NAME_DUPLICATE',
        );
      }
    } else {
      names.set(comparable, materialId);
    }
  }
  return catalog;
}

function targetMaterial(catalog, materialId) {
  validateStockpileCatalog(catalog, { previousCatalog: catalog });
  const id = assertMaterialId(materialId);
  if (!Object.hasOwn(catalog, id)) {
    fail('El material seleccionado ya no existe.', 'STOCKPILE_NOT_FOUND');
  }
  return [id, catalog[id]];
}

function editableMaterial(draft, current = 0) {
  const material = parseMaterial({ ...draft, current });
  return {
    ...material,
    status: stockpileStatus(material.current, material.min),
  };
}

export function createStockpile(catalog, materialId, draft) {
  validateStockpileCatalog(catalog, { previousCatalog: catalog });
  const id = assertMaterialId(materialId);
  if (Object.hasOwn(catalog, id)) {
    fail('No se pudo generar un identificador único para el material.', 'STOCKPILE_ID_DUPLICATE');
  }
  if (Object.keys(catalog).length >= MAX_STOCKPILE_ITEMS) {
    fail(`Acopios admite hasta ${MAX_STOCKPILE_ITEMS} materiales.`, 'STOCKPILE_CATALOG_TOO_LARGE');
  }

  const material = editableMaterial(draft, draft?.current);
  const nextCatalog = { ...catalog, [id]: material };
  validateStockpileCatalog(nextCatalog, { previousCatalog: catalog });
  return nextCatalog;
}

export function updateStockpile(catalog, materialId, draft) {
  const [id, existing] = targetMaterial(catalog, materialId);
  const material = editableMaterial(draft, existing.current);
  const nextCatalog = {
    ...catalog,
    [id]: {
      ...existing,
      ...material,
    },
  };
  validateStockpileCatalog(nextCatalog, { previousCatalog: catalog });
  return nextCatalog;
}

export function receiveStockpile(catalog, materialId, quantity) {
  const [id, existing] = targetMaterial(catalog, materialId);
  parseMaterial(existing, `stockpiles.${id}`);
  const received = finiteQuantity(quantity, 'La cantidad recibida', { exclusiveMin: true });
  const current = Number((Number(existing.current) + received).toFixed(MAX_DECIMAL_PLACES));
  if (current > Number(existing.max)) {
    const available = Math.max(0, Number(existing.max) - Number(existing.current));
    fail(
      `La recepción supera la capacidad máxima. Podés ingresar hasta ${available.toLocaleString('es-AR')} ${existing.unit}.`,
      'STOCKPILE_CAPACITY_EXCEEDED',
    );
  }

  const nextCatalog = {
    ...catalog,
    [id]: {
      ...existing,
      current,
      status: stockpileStatus(current, existing.min),
    },
  };
  validateStockpileCatalog(nextCatalog, { previousCatalog: catalog });
  return nextCatalog;
}
