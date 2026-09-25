import { templateEntryMatches, templateStatusPresentation } from './template-review-policy.js';

export function initialTemplateCatalogObservation() {
  return { generation: 0, phase: 'unverified', catalog: [], verifiedKeys: [], fullSnapshot: false };
}
const validGeneration = value => Number.isSafeInteger(value) && value > 0;
const validItems = items => Array.isArray(items) && items.length <= 32 && items.every(templateEntryMatches)
  && new Set(items.map(item => item.blueprintKey)).size === items.length;

// Generations are local request identities, not provider versions or credentials.
// Starting any read/review removes display confidence without changing backend data.
export function templateCatalogObservationReducer(state, action) {
  if (!action || !validGeneration(action.generation)) return state;
  if (action.type === 'begin' || action.type === 'reset') {
    if (action.generation <= state.generation) return state;
    return { ...initialTemplateCatalogObservation(), generation: action.generation,
      phase: action.type === 'begin' ? 'loading' : 'unverified',
      catalog: action.type === 'begin' ? state.catalog : [] };
  }
  if (action.generation !== state.generation || state.phase !== 'loading') return state;
  if (action.type === 'resolved') {
    if (!validItems(action.items) || typeof action.partial !== 'boolean') {
      return { ...state, phase: 'error', verifiedKeys: [], fullSnapshot: false };
    }
    const verifiedKeys = action.items.map(item => item.blueprintKey);
    const catalog = action.partial
      ? [...state.catalog.filter(item => !verifiedKeys.includes(item.blueprintKey)), ...action.items]
      : action.items;
    return { ...state, phase: 'ready', catalog, verifiedKeys, fullSnapshot: !action.partial };
  }
  if (action.type === 'failed' || action.type === 'settled') {
    return { ...state, phase: action.type === 'failed' ? 'error' : 'unverified', verifiedKeys: [], fullSnapshot: false };
  }
  return state;
}

export function templateCatalogObservationPresentation(state, blueprintKey, channelReady) {
  if (!channelReady) return { label: 'Estado Meta no verificado', tone: 'blocked' };
  if (state.phase === 'loading') return { label: 'Consultando plantilla…', tone: 'pending' };
  if (state.phase === 'ready' && state.verifiedKeys.includes(blueprintKey)) {
    const entry = state.catalog.find(item => item.blueprintKey === blueprintKey);
    if (entry) return templateStatusPresentation(entry.template);
  }
  if (state.phase === 'ready' && state.fullSnapshot && !state.catalog.some(item => item.blueprintKey === blueprintKey)) {
    return { label: 'Sin versión de plantilla', tone: 'idle' };
  }
  return { label: 'Plantilla sin verificar', tone: 'pending' };
}
