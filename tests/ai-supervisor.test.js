import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertSupervisorRateLimits,
  buildSupervisorContext,
  requestSupervisorAnswer,
  SupervisorInputError,
  SupervisorProviderError,
  validateSupervisorRequest,
} from '../src/lib/ai/supervisor.js';

function scopedContext(canRequestActions = true) {
  return buildSupervisorContext({
    access: {
      organization: { name: 'Constructora Norte' },
      project: { name: 'Hospital Sur', address: 'Córdoba', status: 'ACTIVE' },
    },
    state: {
      operariosCount: 3,
      avancePercentage: 44,
      alertsCount: 1,
      diasEstimados: 'Día 18/60',
      tasks: {
        t1: { name: 'Fundaciones', progress: 80, duration: 10, assignee: 'Equipo A' },
      },
      attendance: {
        'Ana Pérez': { role: 'Capataz', status: 'Presente', checkin: '07:55' },
      },
      stockpiles: {
        cemento: { name: 'Cemento', current: 10, min: 30, max: 100, unit: 'bolsas' },
      },
      incidents: [{ title: 'Stock bajo', description: 'Cemento bajo mínimo', type: 'warning' }],
    },
    messages: [{ sender: 'user', kind: 'text', text: 'Llegó el camión', time: '09:10' }],
    canRequestActions,
    hasOperationalData: true,
    snapshotUpdatedAt: new Date('2026-07-15T11:55:00.000Z'),
    now: new Date('2026-07-15T12:00:00.000Z'),
  });
}

test('supervisor request validation bounds the question and history', () => {
  assert.deepEqual(
    validateSupervisorRequest({
      question: '  ¿Cómo va la obra?  ',
      history: [{ role: 'assistant', content: 'Hay un alerta de stock.' }],
    }),
    {
      question: '¿Cómo va la obra?',
      history: [{ role: 'assistant', content: 'Hay un alerta de stock.' }],
    },
  );
  assert.throws(
    () => validateSupervisorRequest({ question: 'x'.repeat(2_001) }),
    SupervisorInputError,
  );
  assert.throws(
    () => validateSupervisorRequest({ question: 'hola', admin: true }),
    /no está permitido/,
  );
});

test('supervisor rate limits bound burst and organization-wide daily usage', () => {
  assert.doesNotThrow(() => assertSupervisorRateLimits({
    userMinuteCount: 11,
    organizationDayCount: 399,
  }));
  assert.throws(
    () => assertSupervisorRateLimits({ userMinuteCount: 12, organizationDayCount: 10 }),
    (error) => error instanceof SupervisorInputError && error.status === 429,
  );
  assert.throws(
    () => assertSupervisorRateLimits({ userMinuteCount: 1, organizationDayCount: 400 }),
    /límite diario/,
  );
});

test('supervisor context contains only the supplied active scope and bounded operational data', () => {
  const context = scopedContext();
  assert.equal(context.scope.organization, 'Constructora Norte');
  assert.equal(context.scope.project, 'Hospital Sur');
  assert.equal(context.metrics.progressPercentage, 44);
  assert.equal(context.dataStatus, 'operational');
  assert.equal(context.tasks[0].name, 'Fundaciones');
  assert.equal(context.recentOperationalMessages[0].text, 'Llegó el camión');
  assert.equal(JSON.stringify(context).includes('guillen.marce@gmail.com'), false);
});

test('supervisor marks a tenant without a snapshot as empty instead of demonstrative', () => {
  const context = buildSupervisorContext({
    access: {
      organization: { name: 'Tenant nuevo' },
      project: { name: 'Primera obra' },
    },
    state: {},
    hasOperationalData: false,
    now: new Date('2026-07-15T12:00:00.000Z'),
  });

  assert.equal(context.dataStatus, 'empty');
  assert.equal(JSON.stringify(context).includes('demonstrative'), false);
});

test('supervisor calls Responses with storage disabled and returns structured evidence', async () => {
  let call;
  const result = await requestSupervisorAnswer({
    question: '¿Qué bloquea la obra?',
    history: [],
    context: scopedContext(),
    apiKey: 'test-key',
    model: 'gpt-5-mini',
    fetchImpl: async (url, options) => {
      call = { url, options };
      return Response.json({
        model: 'gpt-5-mini-2025-08-07',
        output: [{
          type: 'message',
          content: [{
            type: 'output_text',
            text: JSON.stringify({
              answer: 'El cemento está por debajo del mínimo registrado.',
              confidence: 'high',
              evidence: ['10 bolsas actuales frente a un mínimo de 30.'],
              limitations: [],
              actions: [{
                type: 'REQUEST_MATERIAL_PURCHASE',
                label: 'Crear solicitud de compra',
                rationale: 'Evitar una detención por falta de cemento.',
              }],
            }),
          }],
        }],
        usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
      }, {
        headers: { 'x-request-id': 'req_supervisor_test' },
      });
    },
  });

  const body = JSON.parse(call.options.body);
  assert.equal(call.url, 'https://api.openai.com/v1/responses');
  assert.equal(call.options.headers.Authorization, 'Bearer test-key');
  assert.equal(body.store, false);
  assert.equal(body.reasoning.effort, 'low');
  assert.equal(body.text.format.type, 'json_schema');
  assert.equal(result.requestId, 'req_supervisor_test');
  assert.equal(result.actions[0].type, 'REQUEST_MATERIAL_PURCHASE');
  assert.equal(result.usage.totalTokens, 150);
});

test('supervisor strips model actions when the user lacks project manage permission', async () => {
  const result = await requestSupervisorAnswer({
    question: 'Comprá cemento',
    context: scopedContext(false),
    apiKey: 'test-key',
    fetchImpl: async () => Response.json({
      model: 'gpt-5-mini',
      output_text: JSON.stringify({
        answer: 'El stock requiere revisión.',
        confidence: 'medium',
        evidence: [],
        limitations: [],
        actions: [{
          type: 'REQUEST_MATERIAL_PURCHASE',
          label: 'Comprar',
          rationale: 'Stock bajo',
        }],
      }),
    }),
  });
  assert.deepEqual(result.actions, []);
});

test('supervisor provider failures never echo the API key', async () => {
  await assert.rejects(
    requestSupervisorAnswer({
      question: 'Estado',
      context: scopedContext(),
      apiKey: 'secret-that-must-not-leak',
      fetchImpl: async () => Response.json(
        { error: { code: 'rate_limit_exceeded', message: 'limited' } },
        { status: 429, headers: { 'x-request-id': 'req_limited' } },
      ),
    }),
    (error) => {
      assert.ok(error instanceof SupervisorProviderError);
      assert.equal(error.status, 429);
      assert.equal(error.requestId, 'req_limited');
      assert.equal(error.message.includes('secret-that-must-not-leak'), false);
      return true;
    },
  );
});
