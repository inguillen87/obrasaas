import { buildOwnedWhatsAppFlowTemplate, provisionOwnedWhatsAppFlowTemplate, synchronizeOwnedWhatsAppFlowTemplates } from '../../src/lib/whatsapp/templates.js';
export const templateScope = { organizationId: 'org-a', projectId: 'project-a' };
export const templateFlow = { key: 'incident-report', title: 'Incidencia de obra', runtimeActive: true };
export function templateWorkbenchFixture() {
  const connection = { id: 'connection-template-a', projectId: templateScope.projectId, whatsappBusinessId: '123456789012345', phoneNumberId: '444444444444444', encryptedAccessToken: 'synthetic-ciphertext', updatedAt: new Date('2026-09-23T12:00:00Z'), metadata: { whatsappFlows: { 'incident-report': { id: '987654321012345', name: 'ObraSaaS | Incidencia de obra', status: 'PUBLISHED', dataExchange: false } } } };
  const rows = [], remote = [], calls = [];
  const prisma = { whatsAppFlowTemplate: {
    findUnique: async ({ where }) => rows.find(row => ['connectionId', 'name', 'language'].every(key => row[key] === where.connectionId_name_language[key])) || null,
    upsert: async ({ where, create, update }) => {
      const found = rows.find(row => ['connectionId', 'name', 'language'].every(key => row[key] === where.connectionId_name_language[key]));
      if (found) { Object.assign(found, update); return found; }
      const row = { id: 'local-' + (rows.length + 1), ...create }; rows.push(row); return row;
    },
    updateMany: async ({ where, data }) => { const selected = rows.filter(row => Object.entries(where).every(([key, value]) => row[key] === value)); selected.forEach(row => Object.assign(row, data)); return { count: selected.length }; },
  } };
  const fetchImpl = async (url, options) => {
    calls.push({ method: options.method, path: new URL(url).pathname });
    if (options.method === 'GET') return Response.json({ data: structuredClone(remote) });
    const body = JSON.parse(options.body), row = { id: '555555555555555', ...body, status: 'PENDING' };
    if (remote.some(item => item.name === body.name && item.language === body.language)) return Response.json({ error: { code: 100 } }, { status: 400 });
    remote.push(row); return Response.json({ id: row.id, status: row.status, category: row.category });
  };
  const options = { prisma, connection, accessToken: 'synthetic-template-access-token', appSecret: 'synthetic-meta-secret', version: 'v25.0', fetchImpl, now: new Date('2026-09-23T12:10:00Z') };
  const definition = () => buildOwnedWhatsAppFlowTemplate({ connection, blueprintKey: templateFlow.key });
  return { connection, rows, remote, calls, prisma, options, definition, sync: () => synchronizeOwnedWhatsAppFlowTemplates(options), provision: () => provisionOwnedWhatsAppFlowTemplate({ ...options, blueprintKey: templateFlow.key }) };
}
