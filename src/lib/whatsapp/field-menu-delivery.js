import { FIELD_WORKER_RESOLUTION, resolveActiveFieldWorkerByPhone, fieldWorkerWhatsAppRole } from '../field-workers.js';
import { normalizeFieldMenuDescriptor, buildFieldMenuPayload, FieldMenuError } from './field-interactive-menu.js';

// The persisted descriptor is not authority. Resolve the current participant again.
export async function materializeFieldMenuDelivery(prisma, {
  descriptor, scope, recipientPhone, replyToMessageId,
}, { resolveWorker = resolveActiveFieldWorkerByPhone } = {}) {
  const menu = normalizeFieldMenuDescriptor(descriptor);
  if (!menu || menu.organizationId !== scope?.organizationId || menu.projectId !== scope?.projectId
    || menu.phoneNumberId !== scope?.phoneNumberId) throw new FieldMenuError('WHATSAPP_FIELD_MENU_SCOPE');
  const project = await prisma.project.findFirst({
    where:{id:menu.projectId,organizationId:menu.organizationId,status:'ACTIVE'},
    select:{id:true,name:true,organizationId:true,whatsapp:{select:{phoneNumberId:true,enabled:true,connectionStatus:true}}},
  });
  if (!project || !project.whatsapp?.enabled || project.whatsapp.connectionStatus !== 'CONNECTED'
    || project.whatsapp.phoneNumberId !== menu.phoneNumberId) throw new FieldMenuError('WHATSAPP_FIELD_MENU_SCOPE');
  const resolution=await resolveWorker(prisma,{organizationId:menu.organizationId,projectId:menu.projectId},recipientPhone);
  if (resolution.status !== FIELD_WORKER_RESOLUTION.RESOLVED || resolution.worker?.id !== menu.workerId
    || resolution.worker?.projectId !== menu.projectId || resolution.worker?.active !== true) {
    throw new FieldMenuError('WHATSAPP_FIELD_MENU_PARTICIPANT_REVOKED');
  }
  return buildFieldMenuPayload({to:recipientPhone,scope:menu,section:menu.section,
    role:fieldWorkerWhatsAppRole(resolution.worker),projectName:project.name,replyToMessageId});
}
