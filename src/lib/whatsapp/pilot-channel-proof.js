import { createHash } from 'node:crypto';
import { databaseOrganizationIsInternal } from '../organization-policy.js';
import { roleHasPermission } from '../tenant-roles.js';
import { listAllowedWhatsAppPilotAssets } from './pilot-import.js';
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,189}$/;
export class PilotChannelProofError extends Error {
  constructor(code, message, status = 409) { super(message); this.code = code; this.status = status; }
}
const fail = (code, message, status) => { throw new PilotChannelProofError(code, message, status); };
export function pilotProofReplyText(project, inbound) {
  return `ObraSaaS | Prueba de canal. Recibimos tu mensaje en ${project.name}. Esta respuesta verifica la comunicacion; no crea fichajes, compras, pagos ni avances. Referencia: ${inbound.id}.`;
}
export async function resolvePilotProofContext({ prisma, clerk, principal, projectId, environment = process.env }) {
  if (environment.VERCEL_ENV !== 'preview' || environment.WHATSAPP_PILOT_IMPORT_ENABLED !== 'true' || principal?.isSuperadmin !== true) fail('NOT_FOUND', 'Recurso no disponible.', 404);
  if (typeof projectId !== 'string' || !ID.test(projectId)) fail('PILOT_PROOF_INPUT', 'Seleccioná una obra piloto válida.', 400);
  if (!ID.test(principal.databaseUserId || '') || !ID.test(principal.userId || '')) fail('PILOT_PROOF_PRINCIPAL', 'Identidad no disponible.', 403);
  const project = await prisma.project.findFirst({ where: { id: projectId }, include: { organization: true } });
  if (!project || databaseOrganizationIsInternal(project.organization) || !project.organization?.clerkOrganizationId) fail('PILOT_PROOF_TARGET', 'El destino no es una empresa piloto autorizada.', 404);
  const membership = await prisma.tenantMembership.findUnique({ where: { organizationId_userId: { organizationId: project.organizationId, userId: principal.databaseUserId } } });
  if (membership?.status !== 'ACTIVE' || !roleHasPermission(membership.tenantRole, 'org:conversations:manage') || !roleHasPermission(membership.tenantRole, 'org:integrations:manage')) fail('PILOT_PROOF_PERMISSION', 'Tu membresía no permite comprobar este canal.', 403);
  const remote = await clerk.organizations.getOrganizationMembershipList({ organizationId: project.organization.clerkOrganizationId, userId: [principal.userId] });
  if (!remote.data.some(m => m.role === 'org:admin' && m.publicUserData?.userId === principal.userId)) fail('PILOT_PROOF_MEMBERSHIP', 'La membresía administrativa ya no está vigente.', 403);
  const connection = await prisma.whatsAppConnection.findUnique({ where: { projectId }, select: { id: true, projectId: true, phoneNumberId: true, whatsappBusinessId: true, displayPhoneNumber: true, connectionStatus: true, enabled: true, embeddedSignupVersion: true } });
  const assets = listAllowedWhatsAppPilotAssets(environment.WHATSAPP_PILOT_ALLOWED_ASSETS);
  if (!connection || !assets.some(a => a.phoneNumberId === connection.phoneNumberId && a.whatsappBusinessId === connection.whatsappBusinessId) || connection.embeddedSignupVersion !== 'pilot-preview-v1') fail('PILOT_PROOF_ASSET', 'El número no corresponde al activo piloto autorizado.', 403);
  if (!connection.enabled || connection.connectionStatus !== 'CONNECTED') fail('PILOT_PROOF_NOT_CONNECTED', 'Completá primero la importación del número.');
  return { project, connection, access: { organization: project.organization, project, databaseUserId: principal.databaseUserId, userId: principal.userId, tenantRole: membership.tenantRole, tenantMembershipId: membership.id } };
}
async function lastInbound(prisma, projectId, id = null) {
  return prisma.message.findFirst({ where: { direction: 'INBOUND', ...(id ? { id } : {}), conversation: { projectId, channel: 'whatsapp' } }, include: { conversation: true }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
}
function publicReceipt(message) {
  if (!message) return null;
  const status = String(message.status || '').toLowerCase();
  return { id: message.id, status: ['prepared','sending','accepted','sent','delivered','read','failed','unknown'].includes(status) ? status : 'unknown' };
}
export async function readPilotChannelProof({ prisma, context, now = new Date() }) {
  const { project, connection } = context;
  const inbound = await lastInbound(prisma, project.id);
  const age = inbound ? now.getTime() - new Date(inbound.sentAt).getTime() : Infinity;
  const reply = inbound ? await prisma.message.findFirst({ where: { conversationId: inbound.conversationId, direction: 'OUTBOUND', body: pilotProofReplyText(project, inbound) }, orderBy: { createdAt: 'desc' } }) : null;
  return { projectId: project.id, organizationId: project.organizationId, projectName: project.name, connectionId: connection.id,
    sender: connection.displayPhoneNumber, checkedAt: now.toISOString(),
    inbound: inbound ? { id: inbound.id, receivedAt: new Date(inbound.createdAt).toISOString(), contactLast4: inbound.conversation.externalId.replace(/\D/g, '').slice(-4), canReply: age >= 0 && age < 24 * 60 * 60 * 1000 } : null,
    reply: publicReceipt(reply), workersAuthorizedByThisAction: false };
}
export async function sendPilotChannelProof({ prisma, context, input, sendMessage }) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(k => !['projectId','connectionId','inboundId','confirmSend'].includes(k)) || input.confirmSend !== true || !ID.test(input.inboundId || '')) fail('PILOT_PROOF_CONFIRMATION', 'Confirmá una respuesta al mensaje recibido.', 400);
  const { project, connection, access } = context;
  if (input.projectId !== project.id || input.connectionId !== connection.id) fail('PILOT_PROOF_CHANGED', 'El destino cambió. Volvé a consultar el canal.');
  const inbound = await lastInbound(prisma, project.id, input.inboundId);
  if (!inbound) fail('PILOT_PROOF_SOURCE', 'El mensaje no pertenece a esta obra.', 404);
  const key = 'pilot-proof-' + createHash('sha256').update(JSON.stringify([connection.id, inbound.id])).digest('hex');
  if (typeof sendMessage !== 'function') fail('PILOT_PROOF_SENDER', 'El envÃ­o del backend no estÃ¡ disponible.', 503);
  const result = await sendMessage({ prisma, access, conversationId: inbound.conversationId, body: pilotProofReplyText(project, inbound), idempotencyKey: key });
  if (!result.message?.id) fail('PILOT_PROOF_UNCONFIRMED', 'No se confirmó el envío. Consultá el estado o verificá el mismo intento.', 503);
  return { organizationId: project.organizationId, projectId: project.id, connectionId: connection.id, inboundId: inbound.id, reply: publicReceipt(result.message), idempotent: result.idempotent === true, workersAuthorizedByThisAction: false };
}
