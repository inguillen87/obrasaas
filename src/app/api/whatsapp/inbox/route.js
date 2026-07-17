import {
  AccessError,
  accessErrorResponse,
  getPlatformAccess,
  hasTenantPermission,
  requireTenantPermission,
} from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import {
  MEDICAL_EVIDENCE_PERMISSION,
  SOURCE_EVIDENCE_PERMISSION,
} from '@/lib/medical-privacy';
import {
  listWhatsAppInbox,
  WhatsAppInboxError,
} from '@/lib/whatsapp/inbox';

export const runtime = 'nodejs';

function json(payload, init = {}) {
  return Response.json(payload, {
    ...init,
    headers: {
      'Cache-Control': 'private, no-store, max-age=0',
      ...init.headers,
    },
  });
}

function projectIdFromRequest(request) {
  const value = new URL(request.url).searchParams.get('projectId');
  const projectId = String(value || '').trim();
  if (!projectId) {
    throw new WhatsAppInboxError('Seleccioná una obra para abrir la bandeja.', {
      code: 'PROJECT_ID_REQUIRED',
      status: 400,
    });
  }
  return projectId;
}

async function assertActiveProject(prisma, access, projectId) {
  if (projectId !== access.project.id) {
    throw new WhatsAppInboxError('La obra solicitada no coincide con el contexto activo.', {
      code: 'PROJECT_SCOPE_MISMATCH',
      status: 403,
    });
  }
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      organizationId: access.organization.id,
    },
    select: { id: true },
  });
  if (!project) {
    throw new WhatsAppInboxError('La obra ya no está disponible.', {
      code: 'PROJECT_NOT_FOUND',
      status: 404,
    });
  }
}

function inboxErrorResponse(error) {
  if (error instanceof AccessError) return accessErrorResponse(error);
  if (error instanceof WhatsAppInboxError) {
    return json({ error: error.message, code: error.code }, { status: error.status });
  }
  return null;
}

export function createWhatsAppInboxHandlers({
  resolveAccess = getPlatformAccess,
  authorize = requireTenantPermission,
  prismaFactory = getPrisma,
  loadInbox = listWhatsAppInbox,
  clock = () => new Date(),
  env = process.env,
} = {}) {
  async function GET(request) {
    try {
      const access = await resolveAccess();
      authorize(access, 'org:conversations:read');
      const projectId = projectIdFromRequest(request);
      const prisma = prismaFactory();
      await assertActiveProject(prisma, access, projectId);
      return json(await loadInbox({
        prisma,
        access,
        includeMedicalEvidence: hasTenantPermission(
          access,
          MEDICAL_EVIDENCE_PERMISSION,
        ),
        includeSourceEvidence: hasTenantPermission(
          access,
          SOURCE_EVIDENCE_PERMISSION,
        ),
        clock,
        env,
      }));
    } catch (error) {
      const response = inboxErrorResponse(error);
      if (response) return response;
      console.error('WhatsApp inbox read failed:', error);
      return json({ error: 'No se pudo cargar la bandeja de WhatsApp.' }, { status: 500 });
    }
  }

  return { GET };
}

export const { GET } = createWhatsAppInboxHandlers();
