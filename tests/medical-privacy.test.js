import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MEDICAL_EVIDENCE_PERMISSION,
  SOURCE_EVIDENCE_PERMISSION,
  isMedicalEvidenceRecord,
  isRestrictedEvidenceRecord,
  isRestrictedOperationalIncident,
  isSensitiveMedicalText,
  sanitizeMessagesForMedicalPrivacy,
  sanitizeObraEngineResultForMedicalPrivacy,
  sanitizeProjectStateMedicalData,
} from '../src/lib/medical-privacy.js';
import { roleHasPermission } from '../src/lib/tenant-roles.js';

function medicalMessage(overrides = {}) {
  return {
    id: 'message-medical-1',
    externalId: 'webview-medical-private-fingerprint',
    text: 'Diagnóstico que no debe circular',
    body: 'Diagnóstico que no debe circular',
    mediaUrl: 'https://tenant.private.blob.vercel-storage.com/certificado.pdf',
    media: {
      kind: 'document',
      sensitivity: 'medical',
      filename: 'certificado.pdf',
      storage: {
        provider: 'vercel-blob',
        status: 'stored',
        sensitivity: 'medical',
        pathname: 'obrasaas/medical-certificates/private-certificado.pdf',
      },
    },
    transcription: { status: 'completed', text: 'Diagnóstico privado' },
    metadata: { intent: 'MEDICAL', media: { sensitivity: 'medical' } },
    ...overrides,
  };
}

test('medical evidence requires a permission distinct from general project read access', () => {
  assert.equal(roleHasPermission('ADMIN', MEDICAL_EVIDENCE_PERMISSION), true);
  assert.equal(roleHasPermission('DIRECTOR', MEDICAL_EVIDENCE_PERMISSION), true);
  assert.equal(roleHasPermission('DIRECTOR', SOURCE_EVIDENCE_PERMISSION), true);
  assert.equal(roleHasPermission('SITE_MANAGER', MEDICAL_EVIDENCE_PERMISSION), false);
  assert.equal(roleHasPermission('SITE_MANAGER', SOURCE_EVIDENCE_PERMISSION), false);
  assert.equal(roleHasPermission('FINANCE', MEDICAL_EVIDENCE_PERMISSION), false);
  assert.equal(roleHasPermission('FINANCE', SOURCE_EVIDENCE_PERMISSION), false);
  assert.equal(roleHasPermission('AUDITOR', MEDICAL_EVIDENCE_PERMISSION), false);
  assert.equal(roleHasPermission('FINANCE', 'org:projects:read'), true);
  assert.equal(roleHasPermission('AUDITOR', 'org:projects:read'), true);
});

test('medical evidence classification protects current and legacy stored records', () => {
  assert.equal(isMedicalEvidenceRecord(medicalMessage()), true);
  assert.equal(isMedicalEvidenceRecord({
    metadata: {
      media: {
        storage: {
          provider: 'cloudinary',
          publicId: 'obrasaas/medical-certificates/legacy-certificate',
        },
      },
    },
  }), true);
  assert.equal(isMedicalEvidenceRecord({
    externalId: 'whatsapp-photo-1',
    metadata: { intent: 'EVIDENCE' },
  }), false);
  assert.equal(isMedicalEvidenceRecord({
    body: '[document]',
    metadata: {
      media: {
        filename: 'certificado-VIH-Juan.pdf',
      },
    },
  }), true);
  assert.equal(isMedicalEvidenceRecord({
    sender: 'bot',
    text: 'Condición privada XQ-17 de Juan.',
    metadata: { sensitivity: 'MEDICAL' },
  }), true);
});

test('general message readers never receive medical body, certificate identity or transcription', () => {
  const original = medicalMessage();
  const [redacted] = sanitizeMessagesForMedicalPrivacy([original]);

  assert.notEqual(redacted, original);
  assert.doesNotMatch(redacted.text, /diagnóstico/i);
  assert.equal(redacted.mediaUrl, null);
  assert.equal(redacted.media, null);
  assert.equal(redacted.transcription, null);
  assert.equal(redacted.metadata.media, undefined);
  assert.equal(redacted.metadata.redacted, true);

  const [authorized] = sanitizeMessagesForMedicalPrivacy([original], {
    includeMedicalEvidence: true,
  });
  assert.equal(authorized, original);
});

test('project state exposes license status without diagnosis or certificate storage identity', () => {
  const state = {
    incidents: [{
      id: 'inc-medical-1',
      title: 'Licencia Médica Registrada',
      description: 'Motivo informado: diagnóstico privado. Duración: 3 días.',
      evidence: {
        provider: 'vercel-blob',
        assetId: 'https://tenant.private.blob.vercel-storage.com/certificado.pdf',
      },
    }, {
      id: 'inc-general-1',
      title: 'Demora de materiales',
      description: 'Faltan bolsas de cemento.',
    }],
  };

  const sanitized = sanitizeProjectStateMedicalData(state);
  assert.doesNotMatch(sanitized.incidents[0].description, /diagnóstico|motivo informado/i);
  assert.equal(Object.hasOwn(sanitized.incidents[0], 'evidence'), false);
  assert.equal(sanitized.incidents[0].sensitivity, 'medical');
  assert.deepEqual(sanitized.incidents[1], state.incidents[1]);
  assert.match(sanitized.incidents[1].description, /cemento/);
});

test('shared state keeps the complete public attendance journey projection', () => {
  const attendance = {
    'worker-a': {
      workerId: 'worker-a',
      name: 'Ana Pérez',
      role: 'Operaria',
      checkin: '08:02',
      checkout: '17:10',
      breakStartedAt: '12:00',
      breakEndedAt: '12:30',
      status: 'Jornada cerrada',
      shiftId: 'shift-a',
      shiftState: 'CLOSED',
      lastEventType: 'CHECK_OUT',
      reviewRequired: false,
      latitude: -34.6037,
      longitude: -58.3816,
      accuracy: 12,
      distanceMeters: 45,
    },
  };

  const publicAttendance = sanitizeProjectStateMedicalData({ attendance }).attendance;
  assert.equal(publicAttendance['worker-a'].checkout, '17:10');
  assert.equal(publicAttendance['worker-a'].breakStartedAt, '12:00');
  assert.equal(publicAttendance['worker-a'].shiftId, 'shift-a');
  assert.equal(publicAttendance['worker-a'].lastEventType, 'CHECK_OUT');
  assert.equal(Object.hasOwn(publicAttendance['worker-a'], 'latitude'), false);
  assert.equal(Object.hasOwn(publicAttendance['worker-a'], 'longitude'), false);
  assert.equal(Object.hasOwn(publicAttendance['worker-a'], 'accuracy'), false);
  assert.equal(publicAttendance['worker-a'].distanceMeters, 45);

  assert.deepEqual(
    sanitizeProjectStateMedicalData({ attendance }, {
      includeAttendanceLocation: true,
    }).attendance,
    attendance,
  );
});

test('medical text detection catches clinical data without confusing construction language', () => {
  assert.equal(
    isSensitiveMedicalText('Hay una demora porque Juan tiene cáncer y está bajo tratamiento médico.'),
    true,
  );
  assert.equal(isSensitiveMedicalText('Fractura expuesta con hemorragia.'), true);
  assert.equal(isSensitiveMedicalText('Licencia por depresión y tratamiento psiquiátrico.'), true);
  assert.equal(isSensitiveMedicalText('Demora porque Juan tiene VIH y requiere diálisis.'), true);
  assert.equal(isSensitiveMedicalText('Está internado por un infarto y un ACV.'), true);
  assert.equal(isSensitiveMedicalText('Tiene hepatitis y un turno médico mañana.'), true);
  assert.equal(isSensitiveMedicalText('Demora porque Juan tiene tuberculosis.'), true);
  assert.equal(isSensitiveMedicalText('Demora porque Juan tiene EPOC.'), true);
  assert.equal(isSensitiveMedicalText('Demora porque Juan tiene esclerosis múltiple.'), true);
  assert.equal(isSensitiveMedicalText('Demora porque Juan tiene insuficiencia renal.'), true);
  assert.equal(isSensitiveMedicalText('Demora porque Juan recibió un trasplante.'), true);
  assert.equal(isSensitiveMedicalText('Demora porque Juan es seropositivo.'), true);
  assert.equal(isSensitiveMedicalText('Demora porque Juan va al médico.'), true);
  assert.equal(
    isSensitiveMedicalText(`${'Reporte operativo sin novedad. '.repeat(350)}Juan tiene VIH.`),
    true,
  );
  assert.equal(
    isSensitiveMedicalText(`${'Reporte operativo sin novedad. '.repeat(3_000)}Juan tiene VIH.`),
    true,
  );
  assert.equal(
    isSensitiveMedicalText('Reporte operativo sin novedad. '.repeat(3_000)),
    false,
  );
  assert.equal(isSensitiveMedicalText('Aplicamos tratamiento hidrófugo en la losa.'), false);
  assert.equal(isSensitiveMedicalText('La operación de la grúa quedó demorada.'), false);
  assert.equal(isSensitiveMedicalText('Falta material para el hospital municipal.'), false);
  assert.equal(isSensitiveMedicalText('Detectamos una patología constructiva en el hormigón.'), false);
  assert.equal(isSensitiveMedicalText('Hay sangrado del hormigón fresco.'), false);
  assert.equal(isSensitiveMedicalText('Encontramos una fractura en la cañería principal.'), false);
  assert.equal(isSensitiveMedicalText('Trasplante de árboles en el parque de la obra.'), false);
  assert.equal(isSensitiveMedicalText('El camión va al hospital municipal con las aberturas.'), false);
  assert.equal(isSensitiveMedicalText('La cuadrilla fue al sanatorio a reparar el cielorraso.'), false);
  assert.equal(isSensitiveMedicalText('El hormigón tiene aluminosis por cemento aluminoso.'), false);
  assert.equal(isSensitiveMedicalText('La fachada padece aluminosis y requiere reparación.'), false);
  assert.equal(isSensitiveMedicalText('Detectamos fibrosis superficial en el composite reforzado.'), false);
  assert.equal(isSensitiveMedicalText('Juan padece aluminosis por exposición industrial.'), true);
  assert.equal(isSensitiveMedicalText('Juan tiene fibrosis pulmonar.'), true);
});

test('free-form source markers fail closed even when a medical vocabulary misses the phrase', () => {
  const original = {
    id: 'restricted-free-form-message',
    text: 'Demora por una condición privada XQ-17 de Juan.',
    metadata: {
      intent: 'DELAY_REPORT',
      sourceContentRestricted: true,
      sensitivity: 'restricted',
    },
  };

  assert.equal(isRestrictedEvidenceRecord(original), true);
  const [redacted] = sanitizeMessagesForMedicalPrivacy([original]);
  assert.doesNotMatch(JSON.stringify(redacted), /Juan|XQ-17/i);

  const incident = {
    id: 'inc-event-legacy-free-form-delay',
    title: 'Demora reportada',
    description: 'Demora por una condición privada XQ-17 de Juan.',
    badge: 'Planificación',
  };
  assert.equal(isRestrictedOperationalIncident(incident), true);
  const state = sanitizeProjectStateMedicalData({ incidents: [incident] });
  assert.doesNotMatch(JSON.stringify(state), /Juan|XQ-17/i);
  assert.equal(state.incidents[0].sensitivity, 'restricted');
});

test('legacy inbound evidence is restricted structurally and manual incidents keep their content', () => {
  const legacyInbound = {
    direction: 'INBOUND',
    sender: 'user',
    kind: 'document',
    body: '[document]',
    mediaUrl: 'https://private.example/certificate.pdf',
    metadata: {
      intent: 'EVIDENCE',
      media: {
        filename: 'archivo.pdf',
        storage: {
          provider: 'vercel-blob',
          assetId: 'https://private.example/certificate.pdf',
        },
      },
    },
  };

  assert.equal(isRestrictedEvidenceRecord(legacyInbound), true);
  const [redacted] = sanitizeMessagesForMedicalPrivacy([legacyInbound]);
  assert.equal(redacted.mediaUrl, null);
  assert.equal(redacted.media, null);
  assert.equal(redacted.metadata.media, undefined);

  const manualIncident = {
    id: 'manual-delay-a',
    title: 'Demora reportada',
    description: 'Faltan 40 bolsas de cemento.',
    badge: 'Planificación',
  };
  assert.equal(isRestrictedOperationalIncident(manualIncident), false);
  const manualState = sanitizeProjectStateMedicalData({ incidents: [manualIncident] });
  assert.deepEqual(manualState.incidents[0], manualIncident);
});

test('state writes preserve ambiguous construction diagnoses without weakening explicit privacy markers', () => {
  const constructionState = {
    incidents: [
      {
        id: 'manual-aluminosis',
        title: 'Diagnóstico de fachada',
        description: 'La fachada padece aluminosis por cemento aluminoso.',
        badge: 'Calidad',
      },
      {
        id: 'manual-fibrosis',
        title: 'Inspección de composite',
        description: 'Detectamos fibrosis superficial en el composite reforzado.',
        badge: 'Calidad',
      },
    ],
  };
  const writeSafe = sanitizeProjectStateMedicalData(constructionState, {
    inferLegacyMedicalText: false,
  });
  assert.deepEqual(writeSafe, constructionState);
  assert.match(writeSafe.incidents[0].description, /aluminosis/i);
  assert.match(writeSafe.incidents[1].description, /fibrosis/i);

  const explicitMedicalState = {
    incidents: [{
      id: 'manual-explicit-medical',
      title: 'Reporte reservado',
      description: 'Detalle clínico privado.',
      sensitivity: 'medical',
    }],
  };
  const explicitSanitized = sanitizeProjectStateMedicalData(
    explicitMedicalState,
    { inferLegacyMedicalText: false },
  );
  assert.doesNotMatch(JSON.stringify(explicitSanitized), /Detalle clínico/i);
  assert.equal(explicitSanitized.incidents[0].sensitivity, 'medical');
});

test('restricted state incidents serialize from a canonical allowlist with no nested leak path', () => {
  const raw = {
    incidents: [{
      id: 'patient-Juan-VIH',
      title: 'Juan tiene VIH y requiere diálisis',
      description: 'Condición privada XQ-17 de Juan.',
      reporter: 'Paciente Juan - hepatitis C',
      badge: 'Cáncer',
      sensitivity: 'MEDICAL',
      text: 'Juan tiene VIH',
      body: 'Diagnóstico: hepatitis C',
      transcription: { text: 'Juan requiere diálisis' },
      summary: 'Tratamiento oncológico de Juan',
      evidence: {
        assetId: 'private-certificate-Juan',
        pathname: 'obrasaas/medical-certificates/Juan.pdf',
      },
      nested: {
        patient: 'Juan',
        diagnosis: 'VIH',
      },
      attachments: [{
        filename: 'certificado-Juan-VIH.pdf',
      }],
      metadata: {
        kind: 'medical-leave',
        proposalId: 'proposal-safe-1',
        privateNote: 'Juan tiene cáncer',
      },
    }],
    patientRecord: {
      name: 'Juan',
      diagnosis: 'VIH',
    },
  };

  const sanitized = sanitizeProjectStateMedicalData(raw);
  const serialized = JSON.stringify(sanitized);
  assert.doesNotMatch(
    serialized,
    /Juan|VIH|diálisis|hepatitis|cáncer|XQ-17|certificate|privateNote|patientRecord/i,
  );
  assert.deepEqual(Object.keys(sanitized), ['incidents']);
  assert.deepEqual(
    Object.keys(sanitized.incidents[0]).sort(),
    [
      'badge',
      'description',
      'icon',
      'id',
      'metadata',
      'reporter',
      'sensitivity',
      'timestamp',
      'title',
      'type',
    ],
  );
  assert.match(sanitized.incidents[0].id, /^private-incident-[a-f0-9]{16}$/);
  assert.equal(sanitized.incidents[0].sensitivity, 'medical');
  assert.equal(sanitized.incidents[0].metadata.kind, 'medical-leave');
  assert.equal(sanitized.incidents[0].metadata.proposalId, 'proposal-safe-1');
  assert.equal(sanitized.incidents[0].metadata.detailRestricted, true);
});

test('shared state projection removes unknown nested fields from every collection', () => {
  const raw = {
    operariosCount: 1,
    tasks: {
      taskA: {
        name: 'Fundaciones',
        progress: 20,
        duration: 5,
        hidden: { diagnosis: 'VIH' },
      },
    },
    attendance: {
      workerA: {
        workerId: 'workerA',
        name: 'Persona de obra',
        role: 'Capataz',
        status: 'Presente',
        medicalDetails: { diagnosis: 'VIH' },
        certificate: { assetId: 'private-certificate' },
      },
    },
    hrAttendance: {
      workerA: {
        role: 'Capataz',
        presents: 4,
        excused: 1,
        unexcused: 0,
        status: 'Presente',
        treatment: 'diálisis',
      },
    },
    stockpiles: {
      cemento: {
        name: 'Cemento',
        current: 30,
        min: 20,
        max: 100,
        unit: 'bolsas',
        nested: { patient: 'Juan', diagnosis: 'VIH' },
      },
    },
    hrBonuses: [{
      name: 'Persona de obra',
      type: 'Reconocimiento de avance',
      hidden: { diagnosis: 'VIH' },
    }],
    budget: {
      total: 1000,
      executed: 250,
      currency: 'USD',
      clinicalNote: 'Juan requiere diálisis',
    },
  };

  const sanitized = sanitizeProjectStateMedicalData(raw);
  const serialized = JSON.stringify(sanitized);
  assert.doesNotMatch(
    serialized,
    /medicalDetails|certificate|diagnosis|treatment|clinicalNote|diálisis|VIH|Juan/i,
  );
  assert.equal(sanitized.tasks.taskA.name, 'Fundaciones');
  assert.equal(sanitized.attendance.workerA.status, 'Presente');
  assert.equal(sanitized.stockpiles.cemento.name, 'Cemento');
  assert.equal(sanitized.budget.total, 1000);
});

test('source evidence and medical evidence use distinct high-trust permissions', () => {
  const sourceRecord = {
    direction: 'INBOUND',
    sender: 'user',
    text: 'Llegaron 40 bolsas de cemento.',
    metadata: { intent: 'EVIDENCE' },
  };
  const medicalRecord = medicalMessage();
  const [sourceAllowed, medicalStillRedacted] = sanitizeMessagesForMedicalPrivacy(
    [sourceRecord, medicalRecord],
    {
      includeSourceEvidence: true,
      includeMedicalEvidence: false,
    },
  );

  assert.equal(sourceAllowed, sourceRecord);
  assert.notEqual(medicalStillRedacted, medicalRecord);
  assert.equal(medicalStillRedacted.metadata.redacted, true);
});

test('general readers never receive nested clinical proposal details', () => {
  const original = medicalMessage({
    metadata: {
      intent: 'EVIDENCE',
      provider: 'meta',
      time: '12:00',
      audioProposal: {
        summary: 'Juan tiene cáncer y está bajo tratamiento médico.',
      },
      media: { sensitivity: 'medical' },
    },
  });
  const [redacted] = sanitizeMessagesForMedicalPrivacy([original]);

  assert.doesNotMatch(
    JSON.stringify(redacted),
    /Juan|cáncer|tratamiento médico|audioProposal/i,
  );
  assert.equal(redacted.metadata.provider, 'meta');
  assert.equal(redacted.metadata.time, '12:00');
});

test('legacy unmarked clinical messages are redacted from general readers', () => {
  const original = {
    id: 'legacy-clinical-message',
    text: 'La demora se debe a que Juan tiene cáncer.',
    transcription: {
      status: 'completed',
      text: 'La demora se debe a que Juan tiene cáncer.',
    },
    metadata: { intent: 'DELAY_REPORT' },
  };

  assert.equal(isMedicalEvidenceRecord(original), true);
  const [redacted] = sanitizeMessagesForMedicalPrivacy([original]);
  assert.doesNotMatch(JSON.stringify(redacted), /Juan|cáncer/i);
});

test('evidence-route message projections detect clinical body and metadata transcription', () => {
  assert.equal(isMedicalEvidenceRecord({
    id: 'projected-audio-message',
    body: 'Audio recibido.',
    mediaUrl: 'https://blob.example/private/audio.ogg',
    metadata: {
      transcription: {
        status: 'completed',
        text: 'Demora porque Juan tiene VIH y requiere diálisis.',
      },
    },
  }), true);
});

test('legacy clinical delay incidents are sanitized without relabeling them as medical leave', () => {
  const state = {
    incidents: [{
      id: 'legacy-clinical-delay',
      title: 'Demora reportada',
      description: 'La demora se debe a que Juan tiene cáncer y está bajo tratamiento médico.',
      type: 'warning',
      badge: 'Planificación',
    }],
  };

  const sanitized = sanitizeProjectStateMedicalData(state);
  assert.doesNotMatch(JSON.stringify(sanitized), /Juan|cáncer|tratamiento médico/i);
  assert.match(sanitized.incidents[0].description, /detalle médico|acceso restringido/i);
  assert.doesNotMatch(sanitized.incidents[0].description, /licencia médica/i);
  assert.equal(sanitized.incidents[0].sensitivity, 'medical');
});

test('dashboard simulator results are redacted unless the caller has medical evidence access', () => {
  const raw = {
    reply: 'Reporte registrado.',
    state: {
      incidents: [{
        id: 'clinical-incident',
        title: 'Demora reportada',
        description: 'Juan tiene cáncer.',
        metadata: { description: 'Tratamiento médico privado.' },
      }],
    },
    newMessages: [{
      text: 'Juan tiene cáncer.',
      transcription: { text: 'Juan tiene cáncer.' },
      metadata: {
        sensitivity: 'medical',
        audioProposal: { summary: 'Juan tiene cáncer.' },
      },
    }],
  };

  const redacted = sanitizeObraEngineResultForMedicalPrivacy(raw);
  assert.doesNotMatch(JSON.stringify(redacted), /Juan|cáncer|tratamiento médico/i);
  assert.equal(
    sanitizeObraEngineResultForMedicalPrivacy(raw, {
      includeMedicalEvidence: true,
    }),
    raw,
  );
});

test('dashboard simulator never returns a restricted audio reply outside the trusted role', () => {
  const raw = {
    reply: 'Guardé y transcribí el audio: condicion privada XQ-17 de Juan.',
    state: { incidents: [] },
    newMessages: [{
      sender: 'bot',
      text: 'Guardé y transcribí el audio: condicion privada XQ-17 de Juan.',
      metadata: {
        sensitivity: 'restricted',
        sourceContentRestricted: true,
      },
    }],
  };

  const redacted = sanitizeObraEngineResultForMedicalPrivacy(raw);
  assert.doesNotMatch(JSON.stringify(redacted), /Juan|XQ-17/i);
  assert.match(redacted.reply, /contenido original permanece restringido/i);
});
