import assert from 'node:assert/strict';
import test from 'node:test';
import { evidenceSelectionIssue, evidenceFailureState, evidenceScopeHeaders, requestEvidenceStep, EVIDENCE_MIME_TYPES } from '../src/lib/evidence-capture-policy.js';
import { assertEvidenceRequestContext, EvidenceContextError } from '../src/lib/evidence-context.js';
const file = (type = 'image/png', size = 120) => ({ name: 'ensayo.png', type, size });
for (const type of EVIDENCE_MIME_TYPES) test('admite selección ' + type, () => assert.equal(evidenceSelectionIssue(file(type)), null));
for (const type of ['image/svg+xml', 'text/html', 'image/heic', '']) test('rechaza tipo no admitido ' + type, () => assert.ok(evidenceSelectionIssue(file(type))));
test('comprueba tamaños antes de transferir', () => {
  assert.ok(evidenceSelectionIssue(null)); assert.ok(evidenceSelectionIssue(file('image/png', 0)));
  assert.equal(evidenceSelectionIssue(file('image/png', 4 * 1024 * 1024)), null);
  assert.ok(evidenceSelectionIssue(file('image/png', 4 * 1024 * 1024 + 1)));
});
test('se conservan los errores inciertos como no confirmados', () => {
  for (const error of [new Error('network'), { status: 503 }, { status: 429 }, { status: 409 }]) assert.equal(evidenceFailureState(error), 'unconfirmed');
  assert.equal(evidenceFailureState({ status: 422 }), 'error');
  assert.equal(evidenceFailureState({ status: 422 }, { uploadId: 'pending' }), 'unconfirmed');
});
test('el cambio de contexto no permite continuar como una carga común', () => {
  assert.equal(evidenceFailureState({ code: 'EVIDENCE_CONTEXT_CHANGED', status: 409 }), 'context');
  assert.equal(evidenceFailureState({ status: 403 }), 'context');
});
const access = { organization: { id: 'org-a' }, project: { id: 'project-a' } };
const req = headers => new Request('https://obra.test/api/progress/upload', { headers });
test('cabeceras del editor se comparan con la sesión', () => {
  const headers = evidenceScopeHeaders({ organizationId: 'org-a', projectId: 'project-a' });
  assert.doesNotThrow(() => assertEvidenceRequestContext(req(headers), access));
  assert.throws(() => assertEvidenceRequestContext(req({ ...headers, 'X-ObraSaaS-Project': 'project-b' }), access), EvidenceContextError);
});
test('otra empresa, pares incompletos y cabeceras vacías se rechazan', () => {
  for (const headers of [{ 'X-ObraSaaS-Organization': 'org-b', 'X-ObraSaaS-Project': 'project-a' }, { 'X-ObraSaaS-Project': 'project-a' }, { 'X-ObraSaaS-Organization': '', 'X-ObraSaaS-Project': '' }]) assert.throws(() => assertEvidenceRequestContext(req(headers), access), EvidenceContextError);
});
test('cliente legacy sin hints no cambia el scope ni inventa autoridad', () => {
  assert.doesNotThrow(() => assertEvidenceRequestContext(req({}), access));
  assert.throws(() => evidenceScopeHeaders({ projectId: 'project-a' }));
});
test('uploadId confirmado se devuelve sin cambiar la solicitud', async () => {
  const headers = evidenceScopeHeaders({ organizationId: 'org-a', projectId: 'project-a' });
  const result = await requestEvidenceStep('/api/progress/upload', { method: 'POST', headers }, { phase: 'upload', fetchImpl: async (url, options) => {
    assert.equal(url, '/api/progress/upload'); assert.equal(options.cache, 'no-store'); assert.deepEqual(options.headers, headers);
    return Response.json({ uploadId: 'upload-a' }, { status: 201 });
  } });
  assert.equal(result.uploadId, 'upload-a');
});
for (const body of [{}, { uploadId: '' }, { uploadId: 12 }]) test('200 de carga incompleto no se presenta como guardado: ' + JSON.stringify(body), async () => {
  await assert.rejects(requestEvidenceStep('/api/progress/upload', {}, { phase: 'upload', fetchImpl: async () => Response.json(body) }), { code: 'EVIDENCE_RESPONSE_UNCONFIRMED' });
});
test('200 no JSON conserva un resultado no confirmado', async () => {
  await assert.rejects(requestEvidenceStep('/api/progress', {}, { phase: 'attach', fetchImpl: async () => new Response('<html>Sign in</html>') }), { code: 'EVIDENCE_RESPONSE_UNCONFIRMED' });
});
test('guardar requiere identidad, tarea y estado en la respuesta', async () => {
  await assert.rejects(requestEvidenceStep('/api/progress', {}, { phase: 'attach', fetchImpl: async () => Response.json({ evidence: { id: 'e-a' } }) }), { code: 'EVIDENCE_RESPONSE_UNCONFIRMED' });
  const evidence = { id: 'e-a', taskId: 'task-a', status: 'PENDING' };
  assert.deepEqual(await requestEvidenceStep('/api/progress', {}, { phase: 'attach', fetchImpl: async () => Response.json({ evidence }) }), { evidence });
});
test('timeout no confirma ni borra el intento', async () => {
  await assert.rejects(requestEvidenceStep('/api/progress', {}, { phase: 'attach', timeoutMs: 5,
    fetchImpl: (url, options) => new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))),
  }), { code: 'EVIDENCE_RESPONSE_UNCONFIRMED' });
});
test('un 413 incluye límite legible y conserva el código HTTP', async () => {
  await assert.rejects(requestEvidenceStep('/api/progress/upload', {}, { phase: 'upload', fetchImpl: async () => new Response('too large', { status: 413 }) }), error => error.status === 413 && error.message.includes('4 MiB'));
});
test('el error contextual del servidor se preserva', async () => {
  await assert.rejects(requestEvidenceStep('/api/progress', {}, { phase: 'attach', fetchImpl: async () => Response.json({ code: 'EVIDENCE_CONTEXT_CHANGED', error: 'Reabrí la obra' }, { status: 409 }) }), { code: 'EVIDENCE_CONTEXT_CHANGED', status: 409 });
});
