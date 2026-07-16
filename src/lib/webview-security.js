import { createHash } from 'node:crypto';

export const MEDICAL_WEBVIEW_CLAIM_LIMIT = 5;
export const MEDICAL_WEBVIEW_CLAIM_WINDOW_MS = 60 * 60 * 1_000;
const MEDICAL_TOKEN_ACTION = 'webview.medical.token_consumed';

export class WebviewSecurityError extends Error {
  constructor(message, code, status) {
    super(message);
    this.name = 'WebviewSecurityError';
    this.code = code;
    this.status = status;
  }
}

export function medicalWebviewTokenFingerprint({ token, workerId, projectId }) {
  if (!token || !workerId || !projectId) {
    throw new Error('Token, worker and project are required for a medical webview claim.');
  }
  return createHash('sha256')
    .update(`medical\0${projectId}\0${workerId}\0${token}`)
    .digest('hex');
}

export async function claimMedicalWebviewToken(prisma, {
  token,
  workerId,
  projectId,
  organizationId,
  now = new Date(),
}) {
  const fingerprint = medicalWebviewTokenFingerprint({ token, workerId, projectId });
  const claimId = `medical-token-${fingerprint}`;
  const windowStartedAt = new Date(now.getTime() - MEDICAL_WEBVIEW_CLAIM_WINDOW_MS);
  const recentClaims = await prisma.auditLog.count({
    where: {
      action: MEDICAL_TOKEN_ACTION,
      entityType: 'Worker',
      entityId: workerId,
      createdAt: { gte: windowStartedAt },
    },
  });
  if (recentClaims >= MEDICAL_WEBVIEW_CLAIM_LIMIT) {
    throw new WebviewSecurityError(
      'Alcanzaste el límite de certificados por hora. Pedí asistencia al responsable de la obra.',
      'MEDICAL_WEBVIEW_RATE_LIMITED',
      429,
    );
  }

  try {
    await prisma.auditLog.create({
      data: {
        id: claimId,
        organizationId,
        action: MEDICAL_TOKEN_ACTION,
        entityType: 'Worker',
        entityId: workerId,
        metadata: {
          projectId,
          tokenFingerprint: fingerprint.slice(0, 16),
        },
      },
    });
  } catch (error) {
    if (error?.code === 'P2002') {
      throw new WebviewSecurityError(
        'Este enlace ya fue utilizado. Pedí uno nuevo desde el chat oficial de la obra.',
        'MEDICAL_WEBVIEW_TOKEN_USED',
        409,
      );
    }
    throw error;
  }

  return { claimId, fingerprint };
}
