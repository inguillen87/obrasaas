"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ObraSaasLogo } from "@/app/brand/brand-logo";
import styles from "../webview.module.css";

const API_PATH = "/api/webviews/progress-evidence-location";
const OPERATION_TTL_MS = 15 * 60 * 1_000;
const MAX_RESPONSE_BYTES = 8 * 1_024;
const MAX_TOKEN_LENGTH = 4_096;
const TOKEN_FRAGMENT_PREFIX = "#token=";
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const INIT_RESPONSE_FIELDS = new Set([
  "success",
  "action",
  "worker",
  "project",
  "notice",
  "expiresAt",
  "status",
  "locationVerification",
]);
const INIT_PERSON_FIELDS = new Set(["id", "name"]);
const INIT_NOTICE_FIELDS = new Set(["version", "content", "contentSha256"]);
const INIT_STATUSES = new Set(["AWAITING_LOCATION", "LOCATION_CAPTURED", "CANCELLED"]);
const LOCATION_VERIFICATIONS = new Set(["IN_GEOFENCE", "REVIEW_REQUIRED"]);
const RETRYABLE_CODES = new Set([
  "IDEMPOTENCY_IN_PROGRESS",
  "PROGRESS_EVIDENCE_CAPTURE_IN_PROGRESS",
  "PROGRESS_EVIDENCE_CAPTURE_BUSY",
]);

function createIdempotencyKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("Este navegador no permite generar una solicitud segura.");
  }
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

function canonicalCaptureTime(value) {
  if (typeof value !== "string" || value.length > 40) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  const canonical = new Date(timestamp).toISOString();
  return canonical === value ? canonical : null;
}

function hasExactFields(value, fields) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === fields.size && keys.every((key) => fields.has(key));
}

function boundedText(value, maxLength) {
  if (typeof value !== "string" || value.length < 1 || value.length > maxLength) return null;
  return value.trim() === value ? value : null;
}

function tokenFromFragment(fragment) {
  if (
    typeof fragment !== "string"
    || !fragment.startsWith(TOKEN_FRAGMENT_PREFIX)
    || fragment.length <= TOKEN_FRAGMENT_PREFIX.length
    || fragment.length > TOKEN_FRAGMENT_PREFIX.length + (MAX_TOKEN_LENGTH * 3)
  ) {
    return null;
  }
  const encodedToken = fragment.slice(TOKEN_FRAGMENT_PREFIX.length);
  let token;
  try {
    token = decodeURIComponent(encodedToken);
  } catch {
    return null;
  }
  if (
    !boundedText(token, MAX_TOKEN_LENGTH)
    || encodeURIComponent(token) !== encodedToken
  ) {
    return null;
  }
  return token;
}

function safeInitContext(result, worker, session) {
  if (
    !hasExactFields(result, INIT_RESPONSE_FIELDS)
    || result.success !== true
    || result.action !== "INIT"
    || !hasExactFields(result.worker, INIT_PERSON_FIELDS)
    || !hasExactFields(result.project, INIT_PERSON_FIELDS)
    || !hasExactFields(result.notice, INIT_NOTICE_FIELDS)
    || result.worker.id !== worker
    || !boundedText(result.worker.name, 180)
    || !boundedText(result.project.id, 191)
    || !boundedText(result.project.name, 180)
    || !boundedText(result.notice.version, 80)
    || !boundedText(result.notice.content, 2_000)
    || !/^[a-f0-9]{64}$/.test(result.notice.contentSha256)
    || !INIT_STATUSES.has(result.status)
    || !canonicalCaptureTime(result.expiresAt)
  ) {
    return null;
  }
  const validVerification = result.status === "LOCATION_CAPTURED"
    ? LOCATION_VERIFICATIONS.has(result.locationVerification)
    : result.locationVerification === null;
  if (!validVerification) return null;
  return {
    worker: { id: worker, name: result.worker.name },
    project: { id: result.project.id, name: result.project.name },
    notice: {
      version: result.notice.version,
      content: result.notice.content,
      contentSha256: result.notice.contentSha256,
    },
    expiresAt: result.expiresAt,
    status: result.status,
    locationVerification: result.locationVerification,
    session,
  };
}

function validCoordinatePayload(payload, noticeVersion, noticeContentSha256) {
  return Boolean(
    payload
    && typeof payload === "object"
    && !Array.isArray(payload)
    && payload.privacyAccepted === true
    && payload.noticeVersion === noticeVersion
    && payload.noticeContentSha256 === noticeContentSha256
    && typeof payload.latitude === "number"
    && Number.isFinite(payload.latitude)
    && payload.latitude >= -90
    && payload.latitude <= 90
    && typeof payload.longitude === "number"
    && Number.isFinite(payload.longitude)
    && payload.longitude >= -180
    && payload.longitude <= 180
    && typeof payload.accuracyMeters === "number"
    && Number.isFinite(payload.accuracyMeters)
    && payload.accuracyMeters >= 0.01
    && payload.accuracyMeters <= 10_000
    && canonicalCaptureTime(payload.capturedAt)
  );
}

function operationExpiryAt(operation, sessionExpiresAt) {
  const operationDeadline = Number(operation?.createdAt) + OPERATION_TTL_MS;
  const sessionDeadline = Date.parse(sessionExpiresAt);
  return Number.isFinite(sessionDeadline)
    ? Math.min(operationDeadline, sessionDeadline)
    : operationDeadline;
}

function captureCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Este dispositivo no permite obtener una lectura de geolocalización."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        try {
          const latitude = Number(position?.coords?.latitude);
          const longitude = Number(position?.coords?.longitude);
          const accuracyMeters = Number(position?.coords?.accuracy);
          if (
            !Number.isFinite(latitude)
            || latitude < -90
            || latitude > 90
            || !Number.isFinite(longitude)
            || longitude < -180
            || longitude > 180
            || !Number.isFinite(accuracyMeters)
            || accuracyMeters < 0.01
            || accuracyMeters > 10_000
          ) {
            reject(new Error("El dispositivo no devolvió una ubicación válida."));
            return;
          }
          const positionTimestamp = Number(position?.timestamp);
          const positionDate = Number.isFinite(positionTimestamp) && positionTimestamp > 0
            ? new Date(positionTimestamp)
            : null;
          const capturedAt = positionDate && !Number.isNaN(positionDate.getTime())
            ? positionDate.toISOString()
            : new Date(Date.now()).toISOString();
          resolve({
            latitude,
            longitude,
            accuracyMeters,
            capturedAt,
          });
        } catch {
          reject(new Error("No pudimos leer la ubicación del dispositivo."));
        }
      },
      reject,
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15_000,
      },
    );
  });
}

function requestFailure(message, { code = null, retryable = false } = {}) {
  const error = new Error(message);
  error.progressEvidenceRequest = true;
  error.code = code;
  error.retryable = retryable;
  return error;
}

async function readResponseBody(response) {
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) {
    throw requestFailure(
      "El servidor no devolvió una confirmación válida. Reintentá sin cambiar la solicitud.",
      { code: "INVALID_SERVER_RESPONSE", retryable: true },
    );
  }
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    return parsed;
  } catch {
    throw requestFailure(
      "El servidor no devolvió una confirmación válida. Reintentá sin cambiar la solicitud.",
      { code: "INVALID_SERVER_RESPONSE", retryable: true },
    );
  }
}

function completedMessage(result) {
  if (result.action === "CANCEL") {
    return "Continuaste sin compartir ubicación. La foto queda disponible para revisión manual y no afecta tu asistencia.";
  }
  if (result.locationVerification === "IN_GEOFENCE") {
    return "Ubicación vinculada a la foto. La lectura reportada es compatible con la geocerca informada, pero no certifica presencia física.";
  }
  return "Ubicación vinculada a la foto. La evidencia quedó pendiente de revisión, sin afectar tu asistencia.";
}

function geolocationFailureMessage(error) {
  if (error?.code === 1) {
    return "No autorizaste esta lectura puntual. La foto queda pendiente de revisión y no se registra asistencia.";
  }
  if (error?.code === 3) {
    return "La ubicación tardó demasiado. Buscá mejor señal y reintentá; la foto sigue pendiente de revisión.";
  }
  return error?.message || "No pudimos obtener una ubicación confiable. La foto sigue pendiente de revisión.";
}

export default function ProgressEvidenceLocationClient({
  worker,
  session,
}) {
  const consentId = useId();
  const consentHelpId = useId();
  const [context, setContext] = useState(null);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [status, setStatus] = useState({
    type: "loading",
    action: "INIT",
    message: "Validando este enlace protegido…",
  });
  const tokenRef = useRef(null);
  const fallbackOperation = useRef(null);
  const operationPurgeTimer = useRef(null);
  const submitting = useRef(false);
  const name = context?.worker?.name || "";
  const projectName = context?.project?.name || "";
  const noticeVersion = context?.notice?.version || "";
  const noticeContent = context?.notice?.content || "";
  const noticeContentSha256 = context?.notice?.contentSha256 || "";
  const expiresAt = context?.expiresAt || "";
  const clearOperationPurgeTimer = useCallback(() => {
    if (operationPurgeTimer.current !== null) {
      globalThis.clearTimeout(operationPurgeTimer.current);
      operationPurgeTimer.current = null;
    }
  }, []);

  const discardOperation = useCallback(() => {
    clearOperationPurgeTimer();
    fallbackOperation.current = null;
  }, [clearOperationPurgeTimer]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let fragment = typeof globalThis.location?.hash === "string"
      ? globalThis.location.hash
      : "";
    const bearer = tokenRef.current || tokenFromFragment(fragment);

    // Scrub the fragment synchronously before INIT. If browser history cannot
    // remove it, fail closed and never transmit the bearer.
    try {
      const safeRequestTarget = `${globalThis.location.pathname}${globalThis.location.search}`;
      globalThis.history.replaceState(null, "", safeRequestTarget);
      fragment = "";
    } catch {
      tokenRef.current = null;
      globalThis.queueMicrotask(() => {
        if (!active) return;
        setStatus({
          type: "error",
          action: "INIT",
          message: "No pudimos proteger este enlace en el navegador. Abrilo de nuevo desde WhatsApp.",
        });
      });
      return () => {
        active = false;
        controller.abort();
      };
    }

    if (!bearer) {
      tokenRef.current = null;
      discardOperation();
      globalThis.queueMicrotask(() => {
        if (!active) return;
        setStatus({
          type: "error",
          action: "INIT",
          message: "Este enlace no contiene una autorización válida. Pedí uno nuevo desde WhatsApp.",
        });
      });
      return () => {
        active = false;
        controller.abort();
      };
    }
    tokenRef.current = bearer;

    async function initialize() {
      try {
        const response = await fetch(API_PATH, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          credentials: "same-origin",
          referrerPolicy: "no-referrer",
          signal: controller.signal,
          body: JSON.stringify({
            action: "INIT",
            worker,
            session,
            token: bearer,
          }),
        });
        const result = await readResponseBody(response);
        const initialized = response.ok ? safeInitContext(result, worker, session) : null;
        if (!response.ok || !initialized) {
          const safeMessage = typeof result.error === "string" && result.error.length <= 300
            ? result.error
            : "No pudimos validar este enlace protegido.";
          throw requestFailure(safeMessage, {
            code: typeof result.code === "string" ? result.code : "INVALID_SERVER_RESPONSE",
            retryable: false,
          });
        }
        if (!active) return;

        setContext(initialized);
        if (initialized.status === "LOCATION_CAPTURED") {
          tokenRef.current = null;
          discardOperation();
          setStatus({
            type: "success",
            action: "CAPTURE",
            message: completedMessage({
              action: "CAPTURE",
              locationVerification: initialized.locationVerification,
            }),
          });
        } else if (initialized.status === "CANCELLED") {
          tokenRef.current = null;
          discardOperation();
          setStatus({
            type: "success",
            action: "CANCEL",
            message: completedMessage({ action: "CANCEL", locationVerification: null }),
          });
        } else {
          setStatus({
            type: "idle",
            message: "La foto está recibida. Elegí si querés vincular una lectura puntual de ubicación.",
          });
        }
      } catch (error) {
        if (!active || error?.name === "AbortError") return;
        tokenRef.current = null;
        discardOperation();
        setContext(null);
        setStatus({
          type: "error",
          action: "INIT",
          message: error?.progressEvidenceRequest === true
            ? error.message
            : "No recibimos una validación segura. Abrí nuevamente el enlace original desde WhatsApp.",
        });
      }
    }

    void initialize();
    return () => {
      active = false;
      controller.abort();
    };
  }, [discardOperation, session, worker]);

  const armOperationPurge = useCallback((operation) => {
    clearOperationPurgeTimer();
    const delay = operationExpiryAt(operation, expiresAt) - Date.now();
    if (!Number.isFinite(delay) || delay <= 0) {
      discardOperation();
      return false;
    }
    operationPurgeTimer.current = globalThis.setTimeout(() => {
      discardOperation();
    }, delay);
    return true;
  }, [clearOperationPurgeTimer, discardOperation, expiresAt]);

  const persistOperation = useCallback((operation) => {
    fallbackOperation.current = operation;
    armOperationPurge(operation);
    return operation;
  }, [armOperationPurge]);

  function operationIdentity() {
    let operation = fallbackOperation.current;
    if (operation) {
      const validPayload = operation.payload == null
        || validCoordinatePayload(operation.payload, noticeVersion, noticeContentSha256);
      const validIdentity = IDEMPOTENCY_KEY_PATTERN.test(operation.idempotencyKey || "")
        && Number.isFinite(operation.createdAt)
        && operationExpiryAt(operation, expiresAt) > Date.now();
      if (!validPayload || !validIdentity) {
        discardOperation();
        operation = null;
      }
    }
    if (!operation) {
      operation = {
        idempotencyKey: createIdempotencyKey(),
        createdAt: Date.now(),
        payload: null,
      };
    }
    return persistOperation(operation);
  }

  async function operationWithLocation(operation) {
    if (operation.payload) return operation;
    setStatus({
      type: "loading",
      action: "CAPTURE",
      message: "Obteniendo una única lectura de geolocalización reportada por el dispositivo…",
    });
    const location = await captureCurrentLocation();
    return persistOperation({
      ...operation,
      payload: {
        noticeVersion,
        noticeContentSha256,
        privacyAccepted: true,
        ...location,
      },
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting.current) return;
    const bearer = tokenRef.current;
    if (!context || !bearer) {
      setStatus({
        type: "error",
        message: "Este enlace ya no está autorizado. Abrilo de nuevo desde WhatsApp.",
      });
      return;
    }
    if (!consentAccepted) {
      setStatus({
        type: "error",
        message: "Marcá la autorización sólo si querés compartir esta lectura puntual. La foto puede quedar pendiente sin autorizarla.",
      });
      return;
    }
    const sessionDeadline = Date.parse(expiresAt);
    if (!Number.isFinite(sessionDeadline) || sessionDeadline <= Date.now()) {
      discardOperation();
      setStatus({
        type: "error",
        message: "Este enlace ya venció. La foto se conserva sin ubicación; pedí uno nuevo si todavía querés compartirla.",
      });
      return;
    }
    submitting.current = true;
    let operation = null;
    let completed = false;
    try {
      operation = operationIdentity();
      operation = await operationWithLocation(operation);
      setStatus({ type: "loading", action: "CAPTURE", message: "Vinculando la ubicación con esta foto…" });
      const response = await fetch(API_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        credentials: "same-origin",
        referrerPolicy: "no-referrer",
        body: JSON.stringify({
          action: "CAPTURE",
          worker,
          session,
          token: bearer,
          idempotencyKey: operation.idempotencyKey,
          privacyAccepted: operation.payload.privacyAccepted,
          noticeVersion: operation.payload.noticeVersion,
          noticeContentSha256: operation.payload.noticeContentSha256,
          latitude: operation.payload.latitude,
          longitude: operation.payload.longitude,
          accuracyMeters: operation.payload.accuracyMeters,
          capturedAt: operation.payload.capturedAt,
        }),
      });
      const result = await readResponseBody(response);
      const malformedSuccess = response.ok && (
        result.success !== true
        || result.action !== "CAPTURE"
        || !["LOCATION_CAPTURED", "CONSUMED"].includes(result.status)
        || !["IN_GEOFENCE", "REVIEW_REQUIRED"].includes(result.locationVerification)
      );
      if (
        !response.ok
        || malformedSuccess
      ) {
        const code = typeof result.code === "string" ? result.code : null;
        const safeMessage = typeof result.error === "string" && result.error.length <= 300
          ? result.error
          : "No pudimos vincular la ubicación con esta foto.";
        throw requestFailure(safeMessage, {
          code,
          retryable: response.status >= 500
            || response.status === 408
            || response.status === 429
            || malformedSuccess
            || RETRYABLE_CODES.has(code),
        });
      }
      discardOperation();
      tokenRef.current = null;
      completed = true;
      setStatus({ type: "success", action: "CAPTURE", message: completedMessage(result) });
    } catch (error) {
      const requestError = error?.progressEvidenceRequest === true;
      if (operation && requestError && !error.retryable) {
        discardOperation();
      }
      setStatus({
        type: "error",
        message: requestError
          ? error.message
          : operation?.payload
            ? "No recibimos una confirmación segura. Reintentá: enviaremos exactamente la misma solicitud para evitar duplicados."
            : geolocationFailureMessage(error),
      });
    } finally {
      if (!completed) submitting.current = false;
    }
  }

  async function handleCancel() {
    if (submitting.current) return;
    const bearer = tokenRef.current;
    if (!context || !bearer) {
      setStatus({
        type: "error",
        message: "Este enlace ya no está autorizado. Abrilo de nuevo desde WhatsApp.",
      });
      return;
    }
    submitting.current = true;
    // Opting out must discard any retry payload immediately. The CANCEL
    // request is token-bound and never needs coordinates, even if its network
    // response is interrupted and the user has to retry it.
    discardOperation();
    setConsentAccepted(false);
    let completed = false;
    try {
      setStatus({
        type: "loading",
        action: "CANCEL",
        message: "Guardando tu decisión sin solicitar ubicación…",
      });
      const response = await fetch(API_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        credentials: "same-origin",
        referrerPolicy: "no-referrer",
        body: JSON.stringify({
          action: "CANCEL",
          worker,
          session,
          token: bearer,
        }),
      });
      const result = await readResponseBody(response);
      const malformedSuccess = response.ok && (
        result.success !== true
        || result.action !== "CANCEL"
        || result.status !== "CANCELLED"
        || Object.hasOwn(result, "locationVerification")
      );
      if (!response.ok || malformedSuccess) {
        const code = typeof result.code === "string" ? result.code : null;
        const safeMessage = typeof result.error === "string" && result.error.length <= 300
          ? result.error
          : "No pudimos guardar tu decisión sobre esta foto.";
        throw requestFailure(safeMessage, {
          code,
          retryable: response.status >= 500
            || response.status === 408
            || response.status === 429
            || malformedSuccess
            || RETRYABLE_CODES.has(code),
        });
      }
      tokenRef.current = null;
      completed = true;
      setStatus({ type: "success", action: "CANCEL", message: completedMessage(result) });
    } catch (error) {
      setStatus({
        type: "error",
        message: error?.progressEvidenceRequest === true
          ? error.message
          : "No recibimos una confirmación segura. Reintentá continuar sin ubicación.",
      });
    } finally {
      if (!completed) submitting.current = false;
    }
  }

  const loading = status.type === "loading";
  const completed = status.type === "success";
  const captureLoading = loading && status.action === "CAPTURE";
  const cancelLoading = loading && status.action === "CANCEL";

  if (!context) {
    return (
      <main className={styles.centeredPage}>
        <section className={styles.deniedCard}>
          <span className={styles.deniedIcon} aria-hidden="true">
            {status.type === "loading" ? "…" : "!"}
          </span>
          <p className={styles.eyebrow}>Acceso protegido</p>
          <h1>{status.type === "loading" ? "Validando enlace" : "No pudimos abrir este enlace"}</h1>
          <p role={status.type === "error" ? "alert" : "status"}>{status.message}</p>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <span className={styles.brand} aria-label="ObraSaaS">
            <ObraSaasLogo markClassName={styles.brandMark} markSize={32} />
          </span>
          <span className={styles.secureBadge}>Lectura puntual · enlace protegido</span>
        </header>

        <section className={styles.heroCard}>
          <div>
            <p className={styles.eyebrow}>Evidencia de avance</p>
            <h1>Elegí si querés vincular una ubicación a esta foto</h1>
            <p className={styles.lead}>
              Hola, {name}. La ubicación se usará exclusivamente para contextualizar esta foto.
            </p>
            <p className={styles.projectContext}>{projectName}</p>
          </div>
          <div className={styles.locationVisual} aria-hidden="true">
            <span className={styles.locationPulse} />
            <span className={styles.locationPin}>●</span>
          </div>
        </section>

        <form className={styles.actionCard} onSubmit={handleSubmit}>
          <div className={styles.steps} aria-label="Pasos">
            <span><b>1</b>Leé y elegí</span>
            <span><b>2</b>Permití sólo si querés</span>
            <span><b>3</b>Vinculamos la foto</span>
          </div>

          {!completed && (
            <>
              <label className={styles.locationConsent} htmlFor={consentId}>
                <input
                  id={consentId}
                  type="checkbox"
                  checked={consentAccepted}
                  onChange={(event) => setConsentAccepted(event.target.checked)}
                  disabled={loading}
                  aria-describedby={consentHelpId}
                />
                <span>
                  <strong>Autorizo una sola lectura puntual de ubicación para esta foto.</strong>
                  {" "}{noticeContent}
                </span>
              </label>

              <p id={consentHelpId} className={styles.privacy}>
                No registra asistencia ni activa rastreo continuo. Si no autorizás, la foto no se descarta:
                queda disponible para revisión manual. La geolocalización reportada por el dispositivo aporta
                contexto para corroborar cercanía, pero no certifica presencia física, identidad, sensor utilizado
                ni impide una manipulación del dispositivo.
              </p>
            </>
          )}

          <div
            className={`${styles.status} ${styles[status.type]}`}
            role={status.type === "error" ? "alert" : "status"}
            aria-live={status.type === "error" ? "assertive" : "polite"}
            aria-atomic="true"
          >
            <span aria-hidden="true">{status.type === "success" ? "✓" : status.type === "error" ? "!" : "i"}</span>
            {status.message}
          </div>

          {!completed && (
            <>
              <button
                className={styles.primaryButton}
                type="submit"
                disabled={loading || !consentAccepted}
              >
                {captureLoading
                  ? <span className={styles.spinner} aria-hidden="true" />
                  : <span aria-hidden="true">⌖</span>}
                {captureLoading ? "Procesando…" : "Compartir ubicación para esta foto"}
              </button>
              <button
                className={styles.primaryButton}
                type="button"
                onClick={handleCancel}
                disabled={loading}
                aria-describedby={consentHelpId}
              >
                {cancelLoading
                  ? <span className={styles.spinner} aria-hidden="true" />
                  : <span aria-hidden="true">→</span>}
                {cancelLoading ? "Guardando decisión…" : "Continuar sin ubicación"}
              </button>
            </>
          )}
          <p className={styles.privacy}>
            Si una respuesta se interrumpe, esta pestaña conserva la misma operación sólo en memoria hasta su
            vencimiento para reintentar sin duplicarla. Al cerrar o recargar se elimina; el servidor vuelve a
            conciliar el estado al abrir el enlace. No enviamos coordenadas en la URL.
          </p>
        </form>
      </div>
    </main>
  );
}
