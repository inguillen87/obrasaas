// The canonical journal owns reference validation. This adapter stores only its
// raw, validated references and resolves writes only after IDB tx.complete.
export const RECOVERY_DATABASE_NAME = 'obrasaas-pending-receipts-v1';
export const RECOVERY_DATABASE_VERSION = 1;
const stores = ['references', 'migrations'];
const maximumReferences = 64;
const needsMigration = Symbol('needs migration');
const scopeValid = scope => typeof scope === 'string' && /^[a-f0-9]{64}$/.test(scope);
const unavailable = () => Object.assign(new Error('No se pudo conservar la referencia del intento en este navegador. Habilitá el almacenamiento y volvé a intentar; la operación no se envió.'), { code: 'WORKSPACE_RECOVERY_STORAGE_UNAVAILABLE', status: 409, requestDispatched: false });
const cancelled = () => Object.assign(new DOMException('La consulta se canceló.', 'AbortError'), { requestDispatched: false });
const plainKeys = (row, keys) => row && typeof row === 'object' && !Array.isArray(row) && Object.keys(row).sort().join('|') === [...keys].sort().join('|');
const safeCallbackError = error => error?.name === 'AbortError' ? cancelled() : error?.requestDispatched === false && typeof error.code === 'string' && error.code.startsWith('WORKSPACE_RECOVERY_') ? error : unavailable();

function schemaValid(db, tx) {
  if (db.version !== RECOVERY_DATABASE_VERSION || [...db.objectStoreNames].sort().join('|') !== [...stores].sort().join('|')) throw unavailable();
  for (const [name, keyPath] of [['references', 'key'], ['migrations', 'scope']]) {
    const store = tx.objectStore(name);
    if (store.keyPath !== keyPath || store.autoIncrement !== false || store.indexNames.length !== 0) throw unavailable();
  }
}

function openDatabase(indexedDB, signal, timeoutMs) {
  return new Promise((resolve, reject) => {
    let request, settled = false, timer;
    const finish = (error, db) => {
      if (settled) { db?.close(); return; }
      settled = true; clearTimeout(timer); signal?.removeEventListener('abort', abort);
      if (error) reject(error); else resolve(db);
    };
    const abort = () => { try { request?.transaction?.abort(); } catch { /* An open request has no cancellable handle before upgrade. */ } finish(cancelled()); };
    if (signal?.aborted) { finish(cancelled()); return; }
    signal?.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => { try { request?.transaction?.abort(); } catch { /* A late open result is closed below. */ } finish(unavailable()); }, timeoutMs);
    try {
      if (!indexedDB?.open) throw unavailable();
      request = indexedDB.open(RECOVERY_DATABASE_NAME, RECOVERY_DATABASE_VERSION);
      request.onupgradeneeded = event => {
        try {
          // Only a genuinely new database may be initialized. Never repair,
          // erase or recreate an unexpected existing schema.
          if (settled || event.oldVersion !== 0 || request.result.objectStoreNames.length !== 0) throw unavailable();
          request.result.createObjectStore('references', { keyPath: 'key' });
          request.result.createObjectStore('migrations', { keyPath: 'scope' });
        } catch { try { request.transaction.abort(); } catch { /* The upgrade can already be aborted. */ } finish(unavailable()); }
      };
      request.onerror = () => finish(unavailable());
      request.onsuccess = () => {
        const db = request.result;
        if (settled) { db.close(); return; }
        if (db.version !== RECOVERY_DATABASE_VERSION || [...db.objectStoreNames].sort().join('|') !== [...stores].sort().join('|')) { db.close(); finish(unavailable()); return; }
        db.onversionchange = () => db.close();
        finish(null, db);
      };
      // blocked is allowed to wait only until the same bounded open deadline.
    } catch { finish(unavailable()); }
  });
}

function scopedView(rows, mode, prefix, validateRaw) {
  let active = true;
  const check = key => { if (!active || typeof key !== 'string' || !key.startsWith(prefix)) throw unavailable(); };
  const view = {
    get length() { if (!active) throw unavailable(); return rows.size; },
    key(index) { if (!active) throw unavailable(); return Number.isInteger(index) && index >= 0 ? [...rows.keys()][index] ?? null : null; },
    getItem(key) { check(key); return rows.get(key) ?? null; },
    setItem(key, value) {
      check(key); if (mode !== 'readwrite') throw unavailable(); validateRaw(key, value);
      if (!rows.has(key) && rows.size >= maximumReferences) throw unavailable(); rows.set(key, value);
    },
    removeItem(key) { check(key); if (mode !== 'readwrite') throw unavailable(); rows.delete(key); },
  };
  return { view, close: () => { active = false; } };
}

export function createBrowserRecoveryStorage({
  prefix, validateStored,
  getIndexedDB = () => globalThis.indexedDB,
  getKeyRange = () => globalThis.IDBKeyRange,
  getLegacyStorage = () => globalThis.window?.localStorage,
  timeoutMs = 5000,
} = {}) {
  if (typeof prefix !== 'string' || !/^[A-Za-z0-9._-]{1,127}\.$/.test(prefix) || typeof validateStored !== 'function' || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 5000) throw new TypeError('Invalid recovery storage adapter');
  const validateRaw = (key, value) => {
    if (typeof value !== 'string' || value.length > 2048) throw unavailable();
    try { const validated = validateStored(key, value); if (!validated || typeof validated !== 'object' || typeof validated.then === 'function') throw unavailable(); }
    catch { throw unavailable(); }
  };
  const legacySnapshot = scopedPrefix => {
    try {
      const storage = getLegacyStorage(); if (!storage) throw unavailable();
      const rows = new Map(), length = storage.length;
      if (!Number.isSafeInteger(length) || length < 0 || length > 100000) throw unavailable();
      for (let i = 0; i < length; i++) {
        const key = storage.key(i); if (typeof key !== 'string' || !key.startsWith(scopedPrefix)) continue;
        const value = storage.getItem(key); validateRaw(key, value); rows.set(key, value);
        if (rows.size > maximumReferences) throw unavailable();
      }
      return { storage, rows };
    } catch { throw unavailable(); }
  };
  const cleanLegacy = legacy => {
    if (!legacy) return;
    // Once the migration is committed, failure to remove an old value does not
    // undo it. The marker prevents its later reimport. Never remove changed or
    // unrelated legacy values.
    for (const [key, value] of legacy.rows) { try { if (legacy.storage.getItem(key) === value) legacy.storage.removeItem(key); } catch { /* IDB remains the committed authority. */ } }
  };
  function transact(db, mode, scope, callback, signal, allowMigration) {
    return new Promise((resolve, reject) => {
      let tx, result, legacy, failure, callbackRan = false, settled = false, markerReady = false, cursorReady = false, marker;
      const scopedPrefix = prefix + scope + '.', rows = new Map(), original = new Map();
      const finish = (error, committed) => {
        if (settled) return; settled = true; clearTimeout(timer); signal?.removeEventListener('abort', abort);
        if (error) reject(error); else { if (committed) cleanLegacy(legacy); resolve(result); }
      };
      const stop = error => {
        failure ||= error;
        if (!tx) { finish(error); return; }
        try { tx.abort(); } catch {
          // A completed transaction may be awaiting its complete event. Do not
          // turn a committed reservation into a lost ticket after cancellation.
        }
      };
      const abort = () => stop(cancelled());
      const timer = setTimeout(() => stop(unavailable()), timeoutMs);
      if (signal?.aborted) { finish(cancelled()); return; }
      signal?.addEventListener('abort', abort, { once: true });
      const ready = () => {
        if (!markerReady || !cursorReady || callbackRan || failure) return;
        callbackRan = true;
        let scoped;
        try {
          if (marker !== undefined) { if (!plainKeys(marker, ['scope', 'version']) || marker.scope !== scope || marker.version !== 1) throw unavailable(); }
          else if (!allowMigration) { result = needsMigration; return; }
          else {
            legacy = legacySnapshot(scopedPrefix);
            for (const [key, value] of legacy.rows) {
              if (rows.has(key) && rows.get(key) !== value) throw unavailable();
              rows.set(key, value); if (rows.size > maximumReferences) throw unavailable();
            }
            tx.objectStore('migrations').put({ scope, version: 1 });
          }
          if (signal?.aborted) throw cancelled();
          scoped = scopedView(rows, mode, scopedPrefix, validateRaw);
          result = callback(scoped.view);
          if (result && typeof result.then === 'function') throw unavailable();
          if (signal?.aborted) throw cancelled();
          scoped.close();
          const referenceStore = tx.objectStore('references');
          for (const key of original.keys()) if (!rows.has(key)) referenceStore.delete(key);
          for (const [key, value] of rows) if (original.get(key) !== value) referenceStore.put({ key, value });
        } catch (error) { scoped?.close(); stop(safeCallbackError(error)); }
      };
      try {
        tx = db.transaction(stores, allowMigration || mode === 'readwrite' ? 'readwrite' : 'readonly', { durability: 'strict' });
        tx.oncomplete = () => { if (!callbackRan) finish(unavailable()); else finish(null, true); };
        tx.onabort = () => finish(failure || unavailable());
        tx.onerror = () => { failure ||= unavailable(); };
        schemaValid(db, tx);
        const markerRequest = tx.objectStore('migrations').get(scope);
        markerRequest.onsuccess = () => { marker = markerRequest.result; markerReady = true; ready(); };
        // The exclusive upper prefix includes every key beginning with the
        // scoped '.', including malformed suffixes which must fail validation.
        const keyRange = getKeyRange(); if (!keyRange?.bound) throw unavailable();
        const cursorRequest = tx.objectStore('references').openCursor(keyRange.bound(scopedPrefix, prefix + scope + '/', false, true));
        cursorRequest.onsuccess = () => {
          try {
            const cursor = cursorRequest.result;
            if (!cursor) { cursorReady = true; ready(); return; }
            const row = cursor.value;
            if (!plainKeys(row, ['key', 'value']) || row.key !== cursor.key || typeof row.key !== 'string' || !row.key.startsWith(scopedPrefix)) throw unavailable();
            validateRaw(row.key, row.value); rows.set(row.key, row.value); original.set(row.key, row.value);
            if (rows.size > maximumReferences) throw unavailable(); cursor.continue();
          } catch { stop(unavailable()); }
        };
      } catch { stop(unavailable()); }
    });
  }
  return async function withStorage(mode, scope, callback, signal) {
    if (!['readonly', 'readwrite'].includes(mode) || !scopeValid(scope) || typeof callback !== 'function') throw unavailable();
    if (signal?.aborted) throw cancelled();
    let db;
    try {
      db = await openDatabase(getIndexedDB(), signal, timeoutMs);
      const result = await transact(db, mode, scope, callback, signal, mode === 'readwrite');
      if (result !== needsMigration) return result;
      return await transact(db, mode, scope, callback, signal, true);
    } catch (error) { throw safeCallbackError(error); }
    finally { db?.close(); }
  };
}
