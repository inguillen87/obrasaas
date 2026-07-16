import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertProjectStateVersion,
  deriveProjectStateActivities,
  flagStockRisks,
  formatProjectStateEtag,
  parseProjectStateVersion,
  parseProjectStateWriteRequest,
  ProjectStateInputError,
  ProjectStateVersionConflictError,
  validateProjectStateInput,
} from '../src/lib/project-state.js';

function state(overrides = {}) {
  return {
    operariosCount: 2,
    avancePercentage: 20,
    alertsCount: 0,
    diasEstimados: 'Día 2/10',
    tasks: {
      1: {
        name: 'Fundaciones',
        progress: 20,
        duration: 5,
        startOffset: 0,
        assignee: 'Ana Pérez',
      },
    },
    incidents: [],
    stockpiles: {
      cemento: {
        name: 'Cemento',
        current: 50,
        min: 20,
        max: 200,
        unit: 'bolsas',
      },
    },
    hrBonuses: [],
    ...overrides,
  };
}

function incident(overrides = {}) {
  return {
    id: 'inc-1',
    title: 'Incidencia de obra',
    description: 'Detalle operativo validado.',
    type: 'info',
    badge: 'Bitácora',
    timestamp: 'Hoy, 10:30',
    reporter: 'Equipo de obra',
    icon: 'fa-solid fa-circle-info',
    ...overrides,
  };
}

test('project state validation accepts a bounded operational snapshot and clones it', () => {
  const input = state();
  const validated = validateProjectStateInput(input);
  assert.deepEqual(validated, input);
  assert.notEqual(validated, input);
});

test('project state validation preserves every current persisted snapshot shape', () => {
  const protectedAssetUrl = 'https://blob.example/private/certificado.pdf';
  const input = state({
    diasEstimados: '',
    tasks: {
      1: {
        ...state().tasks[1],
        isDelayed: false,
        isShifted: true,
      },
    },
    incidents: [
      incident({
        id: 'inc-medical',
        title: 'Certificado médico recibido',
        description: 'Licencia médica registrada con acceso restringido.',
        type: 'warning',
        badge: 'Evidencia protegida',
        sensitivity: 'medical',
        metadata: {
          kind: 'sensitive-medical-report',
          sourceContentRestricted: true,
          detailRestricted: true,
        },
        evidence: {
          kind: 'document',
          url: protectedAssetUrl,
          filename: 'certificado.pdf',
          mimeType: 'application/pdf',
          size: 1_024,
          sha256: `${'A'.repeat(43)}=`,
          provider: 'vercel-blob',
          storageStatus: 'stored',
          assetId: protectedAssetUrl,
          publicId: 'obrasaas/medical-certificates/certificado.pdf',
          pathname: 'obrasaas/medical-certificates/certificado.pdf',
        },
      }),
      incident({
        id: 'stock-risk-cemento',
        title: 'Stock normalizado: Cemento',
        description: '50 bolsas disponibles; el mínimo operativo es 20.',
        type: 'success',
        badge: 'Stock normalizado',
        status: 'resolved',
        metadata: {
          kind: 'stock-risk',
          stockpileKey: 'cemento',
          stockRiskStatus: 'resolved',
          resolvedAt: '2026-07-16T12:00:00.000Z',
          updatedAt: '2026-07-16T11:00:00.000Z',
        },
      }),
      {
        id: 'legacy-incident',
        title: 'Registro heredado',
      },
      incident({
        id: 'private-incident-0123456789abcdef',
        title: 'Licencia médica registrada',
        description: 'Licencia médica registrada con acceso restringido.',
        type: 'warning',
        badge: 'Licencia',
        timestamp: 'Registro protegido',
        reporter: 'Canal protegido',
        icon: 'fa-solid fa-notes-medical',
        status: 'closed',
        sensitivity: 'medical',
        metadata: {
          kind: 'medical-leave',
          proposalId: 'proposal-safe-1',
          rawContentRestricted: true,
          detailRestricted: true,
          redacted: true,
        },
      }),
    ],
    attendance: {
      'worker-a': {
        workerId: 'worker-a',
        name: 'Ana Pérez',
        role: 'Operaria',
        checkin: '--:--',
        status: 'Licencia informada con certificado (3 días)',
        latitude: -34.6037,
        longitude: -58.3816,
        accuracy: 12,
        distanceMeters: 45,
      },
      'Juan Gómez': {
        role: 'Albañilería principal',
        checkin: '08:02',
        status: 'Presente',
      },
    },
    hrAttendance: {
      'Ana Pérez': {
        workerId: 'worker-a',
        name: 'Ana Pérez',
        role: 'Operaria',
        presents: 20,
        excused: 1,
        unexcused: 0,
        status: 'Ausente Justificado',
      },
    },
    hrBonuses: [{
      name: 'Ana Pérez',
      type: 'Reconocimiento de presentismo',
      amount: null,
      date: '16/7/2026, 10:30:00',
    }, {
      assignee: 'Equipo de obra',
      type: 'Bono de Puntualidad',
      description: 'Reconocimiento de desempeño.',
    }],
    stockpiles: {
      cemento: {
        name: 'Cemento',
        current: 50,
        min: 20,
        max: 200,
        unit: 'bolsas',
        supplier: 'Proveedor asignado',
        status: 'Stock OK',
      },
    },
    budget: {
      total: 100_000,
      executed: 35_000,
      currency: 'USD',
    },
    budgetTotal: 100_000,
    budgetExecuted: 35_000,
    budgetCurrency: 'USD',
  });

  assert.deepEqual(validateProjectStateInput(input), input);
});

test('project state validation rejects unknown fields before they can enter the snapshot', () => {
  const cases = [
    {
      label: 'top-level',
      input: state({ integrationSecrets: { token: 'hidden' } }),
      field: 'state.integrationSecrets',
    },
    {
      label: 'task',
      input: state({
        tasks: {
          1: {
            ...state().tasks[1],
            medicalDetails: 'Diagnóstico privado',
          },
        },
      }),
      field: 'tasks.1.medicalDetails',
    },
    {
      label: 'incident',
      input: state({ incidents: [incident({ diagnosis: 'Dato privado' })] }),
      field: 'incidents[0].diagnosis',
    },
    {
      label: 'incident metadata',
      input: state({
        incidents: [incident({
          metadata: {
            kind: 'source-content-restricted',
            detailRestricted: true,
            diagnosis: 'Dato privado',
          },
        })],
      }),
      field: 'incidents[0].metadata.diagnosis',
    },
    {
      label: 'incident evidence',
      input: state({
        incidents: [incident({
          evidence: {
            kind: 'document',
            url: 'https://blob.example/evidence.pdf',
            provider: 'vercel-blob',
            storageStatus: 'stored',
            certificate: 'Dato privado',
          },
        })],
      }),
      field: 'incidents[0].evidence.certificate',
    },
    {
      label: 'hr attendance',
      input: state({
        hrAttendance: {
          'Ana Pérez': {
            role: 'Operaria',
            presents: 20,
            excused: 1,
            unexcused: 0,
            status: 'Ausente Justificado',
            medicalDetails: 'Dato privado',
          },
        },
      }),
      field: 'hrAttendance.Ana Pérez.medicalDetails',
    },
    {
      label: 'hr bonus',
      input: state({
        hrBonuses: [{
          name: 'Ana Pérez',
          type: 'Bono de Puntualidad',
          amount: null,
          date: '16/7/2026, 10:30:00',
          nested: { clinical: 'Dato privado' },
        }],
      }),
      field: 'hrBonuses[0].nested',
    },
    {
      label: 'stockpile',
      input: state({
        stockpiles: {
          cemento: {
            ...state().stockpiles.cemento,
            certificate: 'Dato privado',
          },
        },
      }),
      field: 'stockpiles.cemento.certificate',
    },
    {
      label: 'budget',
      input: state({
        budget: {
          total: 100_000,
          executed: 35_000,
          currency: 'USD',
          notes: 'Dato privado',
        },
      }),
      field: 'budget.notes',
    },
  ];

  for (const { label, input, field } of cases) {
    assert.throws(
      () => validateProjectStateInput(input),
      (error) => (
        error instanceof ProjectStateInputError
        && error.message.includes(field)
      ),
      label,
    );
  }
});

test('attendance rejects hidden medical fields instead of returning a persistable clone', () => {
  for (const field of ['medicalDetails', 'nested', 'certificate']) {
    const input = state({
      attendance: {
        'worker-a': {
          workerId: 'worker-a',
          name: 'Ana Pérez',
          role: 'Operaria',
          checkin: '08:02',
          status: 'Presente',
          [field]: field === 'nested'
            ? { diagnosis: 'Dato clínico privado' }
            : 'Dato clínico privado',
        },
      },
    });

    let persistable = false;
    assert.throws(
      () => {
        validateProjectStateInput(input);
        persistable = true;
      },
      (error) => (
        error instanceof ProjectStateInputError
        && error.message.includes(`attendance.worker-a.${field}`)
      ),
    );
    assert.equal(persistable, false);
  }
});

test('project state validation rejects arbitrary nested values and invalid closed enums', () => {
  const cases = [
    state({
      attendance: {
        'worker-a': {
          role: { public: 'Operaria', private: 'Dato clínico' },
          status: 'Presente',
        },
      },
    }),
    state({
      attendance: {
        'worker-a': {
          role: 'Operaria',
          status: 'En tratamiento',
        },
      },
    }),
    state({
      tasks: {
        a: {
          name: 'Tarea A',
          progress: 10,
          duration: 2,
          dependencies: [{ id: 'b' }],
        },
        b: {
          name: 'Tarea B',
          progress: 0,
          duration: 2,
        },
      },
    }),
    state({
      incidents: [incident({
        type: 'medical',
      })],
    }),
    state({
      incidents: [incident({
        sensitivity: 'private',
      })],
    }),
    state({
      incidents: [incident({
        metadata: {
          kind: 'source-content-restricted',
          detailRestricted: 'true',
        },
      })],
    }),
    state({
      hrAttendance: {
        'Ana Pérez': {
          role: 'Operaria',
          presents: 20,
          excused: 1,
          unexcused: 0,
          status: 'Licencia médica',
        },
      },
    }),
    state({
      budget: {
        total: { amount: 100_000 },
        executed: 35_000,
        currency: 'USD',
      },
    }),
  ];

  for (const input of cases) {
    assert.throws(
      () => validateProjectStateInput(input),
      ProjectStateInputError,
    );
  }
});

test('project state write parsing accepts matching body and If-Match versions', () => {
  const input = state();
  assert.deepEqual(
    parseProjectStateWriteRequest(
      { state: input, expectedVersion: 7 },
      formatProjectStateEtag(7),
    ),
    { state: input, expectedVersion: 7 },
  );
  assert.equal(parseProjectStateVersion('"project-state-12"'), 12);
});

test('project state writes require a version and reject inconsistent preconditions', () => {
  assert.throws(
    () => parseProjectStateWriteRequest(state()),
    (error) => (
      error instanceof ProjectStateInputError
      && error.status === 428
      && error.code === 'STATE_VERSION_REQUIRED'
    ),
  );
  assert.throws(
    () => parseProjectStateWriteRequest(
      { state: state(), expectedVersion: 3 },
      formatProjectStateEtag(4),
    ),
    /misma versi/,
  );
});

test('project state version assertion exposes a machine-readable conflict', () => {
  assert.equal(assertProjectStateVersion(4, 4), 4);
  assert.throws(
    () => assertProjectStateVersion(4, 5),
    (error) => (
      error instanceof ProjectStateVersionConflictError
      && error.status === 409
      && error.code === 'STATE_VERSION_CONFLICT'
      && error.expectedVersion === 4
      && error.currentVersion === 5
    ),
  );
});

test('project state validation rejects invalid task progress and dangerous object shapes', () => {
  assert.throws(
    () => validateProjectStateInput(state({
      tasks: {
        1: { name: 'Fundaciones', progress: 140, duration: 5, startOffset: 0 },
      },
    })),
    ProjectStateInputError,
  );

  const polluted = JSON.parse('{"tasks":{},"__proto__":{"admin":true}}');
  assert.throws(() => validateProjectStateInput(polluted), /no está permitida/);
});

test('project state validation rejects oversized collections', () => {
  assert.throws(
    () => validateProjectStateInput(state({ incidents: Array.from({ length: 1_001 }, (_, id) => ({ id })) })),
    /hasta 1000 registros/,
  );
});

test('project state accepts real task dependencies and rejects broken schedule graphs', () => {
  const valid = state({
    tasks: {
      foundations: {
        name: 'Fundaciones', progress: 100, duration: 5, startDay: 1, startOffset: 0,
      },
      structure: {
        name: 'Estructura', progress: 0, duration: 10, startDay: 6, startOffset: 20,
        dependencies: ['foundations'],
      },
    },
  });
  assert.deepEqual(validateProjectStateInput(valid), valid);

  assert.throws(
    () => validateProjectStateInput(state({
      tasks: {
        structure: {
          name: 'Estructura', progress: 0, duration: 10, startDay: 1,
          dependencies: ['missing'],
        },
      },
    })),
    /tarea inexistente/,
  );

  assert.throws(
    () => validateProjectStateInput(state({
      tasks: {
        a: { name: 'A', progress: 0, duration: 1, startDay: 1, dependencies: ['b'] },
        b: { name: 'B', progress: 0, duration: 1, startDay: 2, dependencies: ['a'] },
      },
    })),
    /dependencia circular/,
  );
});

test('activity derivation captures task, incident, material and people changes', () => {
  const before = state();
  const after = state({
    tasks: {
      1: {
        ...before.tasks[1],
        progress: 55,
        assignee: 'Luis Martínez',
      },
      2: {
        name: 'Mampostería',
        progress: 0,
        duration: 4,
        startOffset: 30,
        assignee: 'Equipo B',
      },
    },
    incidents: [{
      id: 'inc-new',
      title: 'Desvío de seguridad',
      description: 'Falta baranda provisoria.',
      type: 'critical',
    }],
    stockpiles: {
      cemento: { ...before.stockpiles.cemento, current: 90 },
    },
    hrBonuses: [{ assignee: 'Ana Pérez', type: 'Bono de seguridad' }],
  });

  const activities = deriveProjectStateActivities(before, after);
  assert.deepEqual(
    activities.map((entry) => entry.action),
    [
      'project.task.updated',
      'project.task.created',
      'project.incident.created',
      'project.material.received',
      'project.hr.bonus_awarded',
    ],
  );
  assert.equal(activities.find((entry) => entry.category === 'INCIDENT').severity, 'CRITICAL');
  assert.equal(activities.find((entry) => entry.category === 'MATERIAL').metadata.delta, 40);
});

test('activity derivation records removed tasks as warnings', () => {
  const activities = deriveProjectStateActivities(state(), state({ tasks: {} }));
  assert.equal(activities.length, 1);
  assert.equal(activities[0].action, 'project.task.deleted');
  assert.equal(activities[0].severity, 'WARNING');
});

test('stock risk detection reconciles existing alerts and avoids in-transit duplicates', () => {
  const current = state({
    incidents: [{
      id: 'existing-risk',
      title: 'Quiebre de stock crítico',
      description: 'Cemento por debajo del mínimo de seguridad.',
      badge: 'Stock bajo',
    }],
    stockpiles: {
      cemento: {
        name: 'Cemento', current: 10, min: 20, max: 200, unit: 'bolsas', status: 'Crítico',
      },
      arena: {
        name: 'Arena fina', current: 4, min: 8, max: 20, unit: 'm³', status: 'En camino',
      },
    },
  });

  flagStockRisks(current);
  assert.equal(current.incidents.length, 1);
  assert.equal(current.alertsCount, 1);
});

test('stock risk detection adds one traceable alert when no action exists', () => {
  const current = state({ incidents: [], alertsCount: 0 });
  current.stockpiles.cemento.current = 10;
  flagStockRisks(current);
  flagStockRisks(current);

  assert.equal(current.incidents.length, 1);
  assert.equal(current.incidents[0].metadata.stockpileKey, 'cemento');
  assert.equal(current.alertsCount, 1);
});

test('material receipts do not suppress a still-active low-stock alert', () => {
  const current = state({
    alertsCount: 0,
    incidents: [{
      id: 'inc-mat-receipt',
      title: 'Recepción de materiales',
      description: 'Se registraron 5 bolsas de Cemento. Stock actualizado a 10 bolsas.',
      type: 'success',
      badge: 'Ingreso',
      metadata: { stockpileKey: 'cemento' },
    }],
  });
  current.stockpiles.cemento.current = 10;

  flagStockRisks(current);

  assert.equal(current.incidents.length, 2);
  assert.equal(current.incidents[0].id, 'stock-risk-cemento');
  assert.equal(current.incidents[1].id, 'inc-mat-receipt');
  assert.equal(current.alertsCount, 1);
});

test('stock risk alerts update with the current quantity and resolve when stock recovers', () => {
  const current = state({ incidents: [], alertsCount: 0 });
  current.stockpiles.cemento.current = 10;
  flagStockRisks(current);

  current.stockpiles.cemento.current = 15;
  flagStockRisks(current);
  assert.equal(current.incidents.length, 1);
  assert.match(current.incidents[0].description, /^15 bolsas disponibles/);
  assert.equal(current.alertsCount, 1);

  current.stockpiles.cemento.current = 25;
  flagStockRisks(current);
  assert.equal(current.incidents.length, 1);
  assert.equal(current.incidents[0].type, 'success');
  assert.equal(current.incidents[0].status, 'resolved');
  assert.equal(current.incidents[0].metadata.stockRiskStatus, 'resolved');
  assert.equal(current.stockpiles.cemento.status, 'Stock OK');
  assert.equal(current.alertsCount, 0);
});

test('legacy stockpile configuration pauses automatic risk alerts until corrected', () => {
  const current = state({
    alertsCount: 1,
    stockpiles: {
      cemento: {
        name: 'Cemento',
        current: 10,
        min: 20,
        max: 0,
        unit: '',
      },
    },
    incidents: [{
      id: 'stock-risk-cemento',
      title: 'Stock bajo: Cemento',
      description: '10 bolsas disponibles frente a un mínimo de 20.',
      type: 'warning',
      metadata: {
        kind: 'stock-risk',
        stockpileKey: 'cemento',
        stockRiskStatus: 'active',
      },
    }],
  });

  flagStockRisks(current);

  assert.equal(current.stockpiles.cemento.status, 'Revisar configuración');
  assert.equal(current.incidents[0].type, 'info');
  assert.equal(current.incidents[0].status, 'resolved');
  assert.equal(current.alertsCount, 0);
});
