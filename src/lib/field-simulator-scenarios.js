export const FIRST_VALUE_APPROVAL_SIMULATOR_SCENARIO = 'first-value-delay-proposal-v1';
export const FIRST_VALUE_APPROVAL_SIMULATION_MESSAGE = 'El proveedor informó una demora de entrega. Dejo el aviso para que el responsable evalúe el cronograma.';

const SCENARIO_REQUEST_FIELDS = new Set(['scenario', 'workerId']);

const FIELD_SIMULATOR_SCENARIOS = Object.freeze({
  [FIRST_VALUE_APPROVAL_SIMULATOR_SCENARIO]: Object.freeze({
    id: FIRST_VALUE_APPROVAL_SIMULATOR_SCENARIO,
    kind: 'audio',
    text: FIRST_VALUE_APPROVAL_SIMULATION_MESSAGE,
  }),
});

export function resolveFieldSimulatorScenario(value) {
  const scenario = FIELD_SIMULATOR_SCENARIOS[String(value || '').trim()];
  return scenario ? { ...scenario } : null;
}

export function parseFieldSimulatorScenarioRequest(body) {
  if (
    !body
    || typeof body !== 'object'
    || Array.isArray(body)
    || !Object.hasOwn(body, 'scenario')
  ) {
    return { requested: false, scenario: null, error: null };
  }
  if (Object.keys(body).some((field) => !SCENARIO_REQUEST_FIELDS.has(field))) {
    return {
      requested: true,
      scenario: null,
      error: 'Un escenario de prueba no admite contenido libre ni adjuntos.',
    };
  }
  const scenario = resolveFieldSimulatorScenario(body.scenario);
  if (!scenario) {
    return {
      requested: true,
      scenario: null,
      error: 'El escenario de prueba solicitado no existe.',
    };
  }
  return { requested: true, scenario, error: null };
}
