import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createStockpile,
  receiveStockpile,
  StockpileInputError,
  updateStockpile,
  validateStockpileCatalog,
} from '../src/lib/stockpiles.js';
import {
  ProjectStateInputError,
  validateProjectStateInput,
} from '../src/lib/project-state.js';

function catalog() {
  return {
    cemento: {
      name: 'Cemento CPC40',
      unit: 'bolsas',
      current: 40,
      min: 20,
      max: 100,
      status: 'Stock OK',
      supplier: 'Dato heredado',
    },
  };
}

function snapshot(stockpiles) {
  return {
    tasks: {},
    incidents: [],
    stockpiles,
  };
}

test('creates the first stockpile material from an empty catalog without inventing a supplier', () => {
  const initial = {};
  const result = createStockpile(initial, 'material-1', {
    name: 'Arena fina',
    unit: 'm³',
    current: '4.5',
    min: '8',
    max: '20',
  });

  assert.deepEqual(initial, {});
  assert.deepEqual(result['material-1'], {
    name: 'Arena fina',
    unit: 'm³',
    current: 4.5,
    min: 8,
    max: 20,
    status: 'Crítico',
  });
  assert.equal(Object.hasOwn(result['material-1'], 'supplier'), false);
});

test('rejects duplicate material names after normalizing case, accents and spacing', () => {
  assert.throws(
    () => createStockpile(catalog(), 'material-2', {
      name: '  ceménto   cpc40 ',
      unit: 'kg',
      current: 0,
      min: 0,
      max: 10,
    }),
    (error) => (
      error instanceof StockpileInputError
      && error.code === 'STOCKPILE_NAME_DUPLICATE'
    ),
  );
});

test('rejects incoherent minimum, current and maximum ranges', () => {
  assert.throws(
    () => createStockpile({}, 'material-1', {
      name: 'Hierro', unit: 'barras', current: 0, min: 101, max: 100,
    }),
    /mínimo no puede superar/,
  );
  assert.throws(
    () => createStockpile({}, 'material-1', {
      name: 'Hierro', unit: 'barras', current: 101, min: 10, max: 100,
    }),
    /actual no puede superar/,
  );
  assert.throws(
    () => createStockpile({}, 'material-1', {
      name: 'Hierro', unit: 'barras', current: 0, min: 0, max: 0,
    }),
    /capacidad máxima debe ser mayor que 0/,
  );
});

test('edits material settings while preserving stock and compatible legacy metadata', () => {
  const initial = catalog();
  const result = updateStockpile(initial, 'cemento', {
    name: 'Cemento estructural',
    unit: 'bolsas',
    min: 50,
    max: 120,
  });

  assert.equal(result.cemento.current, 40);
  assert.equal(result.cemento.status, 'Crítico');
  assert.equal(result.cemento.supplier, 'Dato heredado');
  assert.equal(initial.cemento.name, 'Cemento CPC40');
  assert.equal(initial.cemento.status, 'Stock OK');
});

test('repairs an invalid legacy material without inventing quantities or metadata', () => {
  const initial = {
    cemento: {
      name: 'Cemento heredado',
      unit: '',
      current: 40,
      min: 80,
      max: 0,
      supplier: 'Proveedor histórico',
    },
  };
  const result = updateStockpile(initial, 'cemento', {
    name: 'Cemento heredado',
    unit: 'bolsas',
    min: 20,
    max: 100,
  });

  assert.deepEqual(result.cemento, {
    name: 'Cemento heredado',
    unit: 'bolsas',
    current: 40,
    min: 20,
    max: 100,
    status: 'Stock OK',
    supplier: 'Proveedor histórico',
  });
  assert.equal(initial.cemento.unit, '');
  assert.equal(initial.cemento.max, 0);
  assert.throws(
    () => receiveStockpile(initial, 'cemento', 10),
    StockpileInputError,
  );
});

test('receives decimal stock exactly and refuses to silently exceed capacity', () => {
  const initial = catalog();
  const received = receiveStockpile(initial, 'cemento', '12.75');

  assert.equal(received.cemento.current, 52.75);
  assert.equal(received.cemento.status, 'Stock OK');
  assert.equal(initial.cemento.current, 40);
  assert.throws(
    () => receiveStockpile(initial, 'cemento', 61),
    (error) => (
      error instanceof StockpileInputError
      && error.code === 'STOCKPILE_CAPACITY_EXCEEDED'
    ),
  );
  assert.throws(() => receiveStockpile(initial, 'cemento', 0), /mayor que 0/);
});

test('project-state validation applies stockpile duplicate, range and capacity rules to API payloads', () => {
  assert.throws(
    () => validateProjectStateInput(snapshot({
      one: { name: 'Arena', unit: 'm³', current: 1, min: 2, max: 10 },
      two: { name: 'ARENA', unit: 'bolsas', current: 1, min: 2, max: 10 },
    })),
    (error) => error instanceof ProjectStateInputError && error.code === 'STOCKPILE_NAME_DUPLICATE',
  );
  assert.throws(
    () => validateProjectStateInput(snapshot({
      arena: { name: 'Arena', unit: 'm³', current: 1, min: 11, max: 10 },
    })),
    ProjectStateInputError,
  );
  assert.throws(
    () => validateProjectStateInput(snapshot({
      arena: { name: 'Arena', unit: 'm³', current: 11, min: 2, max: 10 },
    })),
    (error) => error instanceof ProjectStateInputError && error.code === 'STOCKPILE_CAPACITY_EXCEEDED',
  );
  assert.throws(
    () => validateProjectStateInput(snapshot({
      arena: { name: 'Arena', unit: 'm³', current: true, min: 2, max: 10 },
    })),
    (error) => error instanceof ProjectStateInputError && error.code === 'STOCKPILE_QUANTITY_INVALID',
  );
  assert.doesNotThrow(() => validateStockpileCatalog(catalog()));
});

test('project-state only tolerates unchanged legacy stockpile defects', () => {
  const previous = snapshot({
    legacy: {
      name: 'Arena heredada',
      unit: '',
      current: 12,
      min: 20,
      max: 0,
    },
  });
  const unrelatedWrite = {
    ...previous,
    avancePercentage: 35,
  };

  assert.doesNotThrow(() => validateProjectStateInput(
    unrelatedWrite,
    { previousState: previous },
  ));
  assert.throws(
    () => validateProjectStateInput({
      ...unrelatedWrite,
      stockpiles: {
        legacy: {
          ...unrelatedWrite.stockpiles.legacy,
          current: 13,
        },
      },
    }, { previousState: previous }),
    ProjectStateInputError,
  );
});

test('pre-existing duplicate names remain writable but new duplicate names stay blocked', () => {
  const previous = snapshot({
    one: { name: 'Arena', unit: 'm³', current: 1, min: 0, max: 10 },
    two: { name: 'ARENA', unit: 'bolsas', current: 2, min: 0, max: 10 },
  });

  assert.doesNotThrow(() => validateProjectStateInput(
    { ...previous, avancePercentage: 15 },
    { previousState: previous },
  ));
  assert.throws(
    () => validateProjectStateInput({
      ...previous,
      stockpiles: {
        ...previous.stockpiles,
        three: { name: 'Árena', unit: 'kg', current: 0, min: 0, max: 10 },
      },
    }, { previousState: previous }),
    (error) => error instanceof ProjectStateInputError && error.code === 'STOCKPILE_NAME_DUPLICATE',
  );
});
