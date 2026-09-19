// Ephemeral per-view composer state. Never stored in cookies, localStorage or IndexedDB.
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,189}$/;
const STATUSES = new Set(['PREPARED', 'SENDING', 'UNKNOWN', 'ACCEPTED', 'SENT', 'DELIVERED', 'READ', 'FAILED']);
const WAITING = new Set(['PREPARED', 'SENDING', 'UNKNOWN']);
export const INBOX_DRAFT_LIMIT = 40;
export const EMPTY_COMPOSER = Object.freeze({ draft: '', sending: false, resolution: '', error: '', attempt: null, receipt: null });
export const REPLY_STATUS_LABELS = Object.freeze({ PREPARED: 'Preparado', SENDING: 'Enviando', UNKNOWN: 'Sin confirmar', ACCEPTED: 'Aceptado por Meta', SENT: 'Enviado', DELIVERED: 'Entregado', READ: 'Leído', FAILED: 'Fallido' });
export function confirmInboxReply(payload, attempt) {
  const context = payload?.context, message = payload?.message;
  const status = typeof message?.status === 'string' ? message.status.toUpperCase() : '';
  if (!context || context.organizationId !== attempt.organizationId || context.projectId !== attempt.projectId
    || context.conversationId !== attempt.conversationId || context.idempotencyKey !== attempt.idempotencyKey
    || !message || typeof message.id !== 'string' || !ID.test(message.id)
    || String(message.direction).toUpperCase() !== 'OUTBOUND' || !STATUSES.has(status)) {
    const error = new Error('La respuesta no coincide con este envío. Conservamos el texto y el mismo intento para verificarlo.');
    error.code = 'WHATSAPP_DELIVERY_UNKNOWN'; throw error;
  }
  return Object.freeze({ id: message.id, status });
}
export function createInboxComposerBook(scope, makeKey = () => 'inbox-' + globalThis.crypto.randomUUID()) {
  if (![scope?.organizationId, scope?.projectId].every(value => typeof value === 'string' && ID.test(value))) throw new Error('Contexto de la bandeja inválido.');
  const identity = Object.freeze({ organizationId: scope.organizationId, projectId: scope.projectId });
  let snapshot = Object.freeze({ entries: Object.freeze({}), revision: 0 });
  const listeners = new Set();
  const get = id => Object.hasOwn(snapshot.entries, id) ? snapshot.entries[id] : EMPTY_COMPOSER;
  function store(id, value) {
    if (typeof id !== 'string' || !ID.test(id)) throw new Error('Conversación no válida.');
    const entries = { ...snapshot.entries };
    if (!Object.hasOwn(entries, id) && Object.keys(entries).length >= INBOX_DRAFT_LIMIT) {
      const disposable = Object.keys(entries).find(key => !entries[key].draft && !entries[key].attempt && !entries[key].sending);
      if (!disposable) throw new Error('Hay 40 conversaciones con trabajo pendiente. Terminá o descartá un borrador antes de preparar otro.');
      delete entries[disposable];
    }
    entries[id] = Object.freeze(value);
    snapshot = Object.freeze({ entries: Object.freeze(entries), revision: snapshot.revision + 1 });
    listeners.forEach(listener => listener());
    return entries[id];
  }
  function matches(attempt) { return attempt && get(attempt.conversationId).resolution !== 'BLOCKED' && get(attempt.conversationId).attempt === attempt; }
  function settle(attempt, receipt) {
    if (!matches(attempt)) return false;
    const current = get(attempt.conversationId);
    const waiting = WAITING.has(receipt.status), failed = receipt.status === 'FAILED';
    store(attempt.conversationId, { ...current, sending: false, receipt,
      draft: !waiting && !failed && current.draft.trim() === attempt.body ? '' : current.draft,
      resolution: waiting ? 'UNKNOWN' : failed ? 'FAILED' : '',
      attempt: waiting ? Object.freeze({ ...attempt, messageId: receipt.id }) : null,
      error: waiting ? 'El envío sigue sin confirmación. Verificá el mismo intento; no prepares una copia.'
        : failed ? 'Meta confirmó el fallo. El texto se conserva; un nuevo envío requiere tu confirmación.' : '',
    });
    return true;
  }
  return {
    get, getSnapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    edit(id, draft) {
      const current = get(id);
      if (current.sending || current.resolution === 'UNKNOWN' || current.resolution === 'BLOCKED') return false;
      if (typeof draft !== 'string' || draft.length > 4096) throw new Error('La respuesta admite hasta 4.096 caracteres.');
      store(id, { ...current, draft, error: current.resolution ? current.error : '' }); return true;
    },
    discard(id) {
      const current = get(id);
      if (current.sending || current.attempt || current.resolution === 'UNKNOWN' || current.resolution === 'BLOCKED') return false;
      store(id, EMPTY_COMPOSER); return true;
    },
    begin(id, { asNewAttempt = false, reconcileUnknown = false } = {}) {
      const current = get(id);
      if (current.sending || current.resolution === 'BLOCKED') return null;
      if (current.resolution === 'UNKNOWN' && !reconcileUnknown) return null;
      if (current.resolution === 'FAILED' && !asNewAttempt) return null;
      if (reconcileUnknown && !current.attempt) return null;
      const body = current.draft.trim(); if (!body) return null;
      const attempt = reconcileUnknown ? current.attempt : Object.freeze({ ...identity,
        conversationId: id, body, idempotencyKey: makeKey(), messageId: null });
      store(id, { ...current, sending: true, attempt, error: '', receipt: reconcileUnknown ? current.receipt : null });
      return attempt;
    },
    settle,
    block(id) {
      const current = get(id);
      if (!current.draft && !current.attempt) return;
      store(id, { ...current, sending: false, resolution: 'BLOCKED', error: 'El acceso a esta conversación cambió. No se reenviará el borrador.' });
    },
    fail(attempt, error) {
      if (!matches(attempt)) return false;
      const current = get(attempt.conversationId), status = Number(error?.status);
      const revoked = status === 401 || status === 403 || status === 404 || status === 409;
      const uncertain = current.resolution === 'UNKNOWN' || !status || status >= 500 || error?.code === 'WHATSAPP_DELIVERY_UNKNOWN';
      const failed = error?.code === 'WHATSAPP_SEND_REJECTED';
      store(attempt.conversationId, { ...current, sending: false,
        resolution: revoked ? 'BLOCKED' : uncertain ? 'UNKNOWN' : failed ? 'FAILED' : '',
        attempt: revoked || uncertain ? attempt : null,
        error: revoked ? 'El acceso o contexto cambió. No se reenviará este mensaje. Conservá el texto y volvé a abrir la obra autorizada.'
          : uncertain ? 'No se confirmó el envío. Conservamos el texto y la misma clave; verificá el intento antes de enviar otra copia.'
            : String(error?.message || 'No se pudo enviar. El borrador se conserva.').slice(0, 360),
      }); return true;
    },
    reconcile(id, messages) {
      const current = get(id), attempt = current.attempt;
      if (!attempt && current.receipt) {
        const known = messages.find(row => row.id === current.receipt.id && String(row.direction).toUpperCase() === 'OUTBOUND');
        const status = known?.status?.toUpperCase();
        const order = { ACCEPTED: 1, SENT: 2, DELIVERED: 3, READ: 4 };
        if (status === 'FAILED' && ['ACCEPTED', 'SENT'].includes(current.receipt.status)) {
          store(id, { ...current, receipt: Object.freeze({ id: known.id, status }) }); return true;
        }
        if (!order[status] || order[status] <= (order[current.receipt.status] || 0)) return false;
        const resolvedFailure = current.resolution === 'FAILED';
        store(id, { ...current, receipt: Object.freeze({ id: known.id, status }),
          ...(resolvedFailure ? { resolution: '', error: '', draft: current.draft.trim() === String(known.body || '').trim() ? '' : current.draft } : {}),
        }); return true;
      }
      if (current.sending || current.resolution !== 'UNKNOWN' || !attempt?.messageId) return false;
      const message = messages.find(row => row.id === attempt.messageId && String(row.direction).toUpperCase() === 'OUTBOUND');
      const status = message?.status?.toUpperCase();
      if (!STATUSES.has(status) || WAITING.has(status)) return false;
      return settle(attempt, Object.freeze({ id: message.id, status }));
    },
  };
}
