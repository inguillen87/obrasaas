import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MEDICAL_EVIDENCE_PERMISSION,
  isMedicalEvidenceRecord,
  sanitizeMessagesForMedicalPrivacy,
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
  assert.equal(roleHasPermission('SITE_MANAGER', MEDICAL_EVIDENCE_PERMISSION), false);
  assert.equal(roleHasPermission('FINANCE', MEDICAL_EVIDENCE_PERMISSION), false);
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
  assert.equal(sanitized.incidents[1], state.incidents[1]);
  assert.match(sanitized.incidents[1].description, /cemento/);
});
