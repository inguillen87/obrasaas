import assert from 'node:assert/strict';
import test from 'node:test';

import { FIELD_WORKER_INTENTS } from '../src/lib/field-workers.js';
import {
  attendanceStatusCountsAsPresent,
  classifyObraIntent,
  countPresentAttendanceEntries,
  prependUniqueEventIncident,
  replaceWorkerAttendance,
  requestedAttendanceAction,
  setWorkerAttendance,
} from '../src/lib/whatsapp/obra-policy.js';

test('voice transcriptions are always evidence and never executable commands', () => {
  assert.equal(classifyObraIntent({
    kind: 'audio',
    transcription: { text: 'avance 95% tarea 1' },
  }), FIELD_WORKER_INTENTS.EVIDENCE);
  assert.equal(classifyObraIntent({
    kind: 'text',
    text: 'avance 95% tarea 1',
  }), FIELD_WORKER_INTENTS.TASK_PROGRESS);
});

test('only exact proposal decisions become command confirmations', () => {
  assert.equal(classifyObraIntent({
    kind: 'text',
    text: 'CONFIRMAR VP-ABCDEF123456',
  }), FIELD_WORKER_INTENTS.COMMAND_CONFIRMATION);
  assert.equal(classifyObraIntent({
    kind: 'text',
    text: 'RECHAZAR VP-ABCDEF123456',
  }), FIELD_WORKER_INTENTS.COMMAND_CONFIRMATION);
  assert.equal(classifyObraIntent({
    kind: 'text',
    text: 'sí, dale',
  }), FIELD_WORKER_INTENTS.EVIDENCE);
  assert.equal(classifyObraIntent({
    kind: 'audio',
    transcription: { text: 'CONFIRMAR VP-ABCDEF123456' },
  }), FIELD_WORKER_INTENTS.EVIDENCE);
});

test('attendance, incident and medical inputs classify before mutation', () => {
  assert.equal(
    classifyObraIntent({ kind: 'location', location: { latitude: -34, longitude: -58 } }),
    FIELD_WORKER_INTENTS.ATTENDANCE_LOCATION,
  );
  assert.equal(classifyObraIntent({ kind: 'text', text: 'quiero fichar' }), FIELD_WORKER_INTENTS.ATTENDANCE_START);
  assert.equal(classifyObraIntent({ kind: 'text', text: 'accidente urgente' }), FIELD_WORKER_INTENTS.INCIDENT);
  assert.equal(classifyObraIntent({ kind: 'text', text: 'certificado médico' }), FIELD_WORKER_INTENTS.MEDICAL);
});

test('attendance action commands distinguish journey transitions without using audio', () => {
  assert.equal(requestedAttendanceAction('quiero fichar'), 'CHECK_IN');
  assert.equal(requestedAttendanceAction('almuerzo'), 'BREAK_START');
  assert.equal(requestedAttendanceAction('volví'), 'BREAK_END');
  assert.equal(requestedAttendanceAction('chau'), 'CHECK_OUT');
  assert.equal(requestedAttendanceAction('salida de materiales'), null);
  for (const text of ['almuerzo', 'volví', 'chau']) {
    assert.equal(
      classifyObraIntent({ kind: 'text', text }),
      FIELD_WORKER_INTENTS.ATTENDANCE_START,
    );
  }
});

test('Meta Flow intent comes from the trusted session, never client flow_type', () => {
  const event = {
    provider: 'meta',
    kind: 'interactive',
    interactive: {
      type: 'flow',
      response: { flow_type: 'incident' },
    },
  };
  assert.equal(
    classifyObraIntent(event),
    FIELD_WORKER_INTENTS.EVIDENCE,
  );
  assert.equal(
    classifyObraIntent(event, { trustedFlowType: 'attendance' }),
    FIELD_WORKER_INTENTS.ATTENDANCE_START,
  );
  assert.equal(
    classifyObraIntent(event, { trustedFlowType: 'worker_payment_destination' }),
    FIELD_WORKER_INTENTS.PAYMENT_DESTINATION,
  );
  assert.equal(
    classifyObraIntent({
      ...event,
      provider: 'webview',
      interactive: {
        type: 'flow',
        name: 'medical_leave',
        response: {},
      },
    }),
    FIELD_WORKER_INTENTS.MEDICAL,
  );
});

test('pending GPS and geofence deviations never count as present', () => {
  assert.equal(attendanceStatusCountsAsPresent('GPS pendiente'), false);
  assert.equal(attendanceStatusCountsAsPresent('GPS pendiente · EPP verificado'), false);
  assert.equal(attendanceStatusCountsAsPresent('Desvío (GPS)'), false);
  assert.equal(attendanceStatusCountsAsPresent('Presente (GPS)'), true);
  assert.equal(attendanceStatusCountsAsPresent('Presente · EPP verificado'), true);
});

test('new attendance writes use worker IDs and migrate a matching legacy name key', () => {
  const attendance = {
    'Ana Pérez': { role: 'Capataz', status: 'GPS pendiente' },
    legacy: { role: 'Operario', status: 'Presente' },
  };
  setWorkerAttendance(attendance, {
    id: 'worker-ana',
    name: 'Ana Pérez',
    role: 'Capataz',
  }, {
    workerId: 'spoofed-worker',
    name: 'Nombre falso',
    role: 'Rol falso',
    checkin: '08:15',
    status: 'Presente (ubicación informada)',
  });

  assert.equal(attendance['Ana Pérez'], undefined);
  assert.deepEqual(attendance['worker-ana'], {
    workerId: 'worker-ana',
    name: 'Ana Pérez',
    role: 'Capataz',
    checkin: '08:15',
    status: 'Presente (ubicación informada)',
  });
  assert.equal(countPresentAttendanceEntries(attendance), 2);
});

test('workers with the same display name retain independent attendance records', () => {
  const attendance = {};
  setWorkerAttendance(attendance, { id: 'worker-a', name: 'Juan Gómez', role: 'Operario' }, {
    checkin: '08:00',
    status: 'Presente (ubicación informada)',
  });
  setWorkerAttendance(attendance, { id: 'worker-b', name: 'Juan Gómez', role: 'Capataz' }, {
    checkin: '08:10',
    status: 'GPS pendiente',
  });

  assert.deepEqual(Object.keys(attendance).sort(), ['worker-a', 'worker-b']);
  assert.equal(attendance['worker-a'].name, 'Juan Gómez');
  assert.equal(attendance['worker-b'].name, 'Juan Gómez');
  assert.equal(countPresentAttendanceEntries(attendance), 1);
});

test('a new check-in replaces every field from the matching legacy journey', () => {
  const attendance = {
    'Ana Pérez': {
      role: 'Capataz',
      status: 'Jornada cerrada',
      checkout: '18:10',
      breakStartedAt: '13:00',
      breakEndedAt: '13:30',
      shiftId: 'shift-old',
    },
  };

  replaceWorkerAttendance(attendance, {
    id: 'worker-ana',
    name: 'Ana Pérez',
    role: 'Capataz',
  }, {
    checkin: '08:05',
    status: 'Presente (ubicación informada)',
    shiftId: 'shift-new',
    shiftState: 'WORKING',
  });

  assert.equal(attendance['Ana Pérez'], undefined);
  assert.deepEqual(attendance['worker-ana'], {
    workerId: 'worker-ana',
    name: 'Ana Pérez',
    role: 'Capataz',
    checkin: '08:05',
    status: 'Presente (ubicación informada)',
    shiftId: 'shift-new',
    shiftState: 'WORKING',
  });
});

test('retried external events cannot append or count the same incident twice', () => {
  const incidents = [];
  const first = prependUniqueEventIncident(incidents, 'wamid.retry-a', {
    id: 'random-first',
    title: 'Incidencia crítica',
  });
  const retried = prependUniqueEventIncident(incidents, 'wamid.retry-a', {
    id: 'random-second',
    title: 'Incidencia crítica',
  });
  const distinct = prependUniqueEventIncident(incidents, 'wamid.distinct', {
    id: 'random-third',
    title: 'Otra incidencia',
  });

  assert.equal(first, true);
  assert.equal(retried, false);
  assert.equal(distinct, true);
  assert.equal(incidents.length, 2);
  assert.match(incidents[0].id, /^inc-event-[a-f0-9]{32}$/);
});
