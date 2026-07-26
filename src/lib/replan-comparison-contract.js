const MAX_REFERENCE_TASKS = 500;

/**
 * @typedef {object} ReplanComparisonScenario
 * @property {string} id
 * @property {string} name
 * @property {string} status
 * @property {number} revision
 */

/**
 * @typedef {object} ReplanComparisonTask
 * @property {string} id
 * @property {string | null} code
 * @property {string} title
 * @property {string} status
 */

/**
 * @typedef {object} ReplanComparisonResponse
 * @property {ReplanComparisonScenario & Record<string, unknown>} scenario
 * @property {(ReplanComparisonTask & Record<string, unknown>)[]} baselineTasks
 */

export class ReplanComparisonContractError extends Error {
  constructor(message = 'La respuesta de comparación no tiene un formato válido.') {
    super(message);
    this.name = 'ReplanComparisonContractError';
    this.code = 'REPLAN_COMPARISON_CONTRACT_INVALID';
  }
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === 'string' && Boolean(value.trim());
}

function assertScenario(value) {
  if (
    !isRecord(value)
    || !nonEmptyString(value.id)
    || !nonEmptyString(value.name)
    || !nonEmptyString(value.status)
    || !Number.isSafeInteger(value.revision)
    || value.revision < 0
  ) {
    throw new ReplanComparisonContractError();
  }
}

function assertTask(value) {
  if (
    !isRecord(value)
    || !nonEmptyString(value.id)
    || !nonEmptyString(value.title)
    || !nonEmptyString(value.status)
    || (value.code !== null && value.code !== undefined && typeof value.code !== 'string')
  ) {
    throw new ReplanComparisonContractError();
  }
}

/**
 * Validates the shared Route Handler/Client Component response contract.
 * The canonical task query has no immutable baseline version, so the contract
 * intentionally exposes the reference task list without a fabricated version.
 *
 * @param {unknown} value
 * @param {{ expectedScenarioId?: string }} [options]
 * @returns {ReplanComparisonResponse}
 */
export function parseReplanComparisonResponse(value, { expectedScenarioId } = {}) {
  if (!isRecord(value) || !Array.isArray(value.baselineTasks) || value.baselineTasks.length > MAX_REFERENCE_TASKS) {
    throw new ReplanComparisonContractError();
  }

  assertScenario(value.scenario);
  value.baselineTasks.forEach(assertTask);

  if (expectedScenarioId !== undefined && value.scenario.id !== expectedScenarioId) {
    throw new ReplanComparisonContractError('La comparación recibida no corresponde al escenario solicitado.');
  }

  return /** @type {ReplanComparisonResponse} */ ({
    scenario: value.scenario,
    baselineTasks: value.baselineTasks,
  });
}

/**
 * @param {ReplanComparisonResponse} value
 * @returns {ReplanComparisonResponse}
 */
export function createReplanComparisonResponse(value) {
  return parseReplanComparisonResponse(value);
}
