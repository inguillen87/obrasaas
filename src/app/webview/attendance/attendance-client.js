"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ObraSaasLogo } from "@/app/brand/brand-logo";
import styles from "../webview.module.css";

const LOCATION_NOTICE_VERSION = "2026-07-23";
const IDEMPOTENCY_STORAGE_PREFIX = "obrasaas:attendance:v2";
const OPERATION_STORAGE_VERSION = 2;
const OPERATION_TTL_MS = 10 * 60 * 1_000;
const PRESERVE_OPERATION_CODES = new Set([
  "ATTENDANCE_OPERATION_IN_PROGRESS",
  "IDEMPOTENCY_IN_PROGRESS",
]);

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Este dispositivo no permite obtener ubicación GPS."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15_000,
      maximumAge: 0,
    });
  });
}

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

async function idempotencyStorageKey(token, action) {
  const input = new TextEncoder().encode(`${token}\0${action}`);
  if (globalThis.crypto?.subtle) {
    const digest = new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", input));
    const fingerprint = Array.from(digest.slice(0, 16), (value) => (
      value.toString(16).padStart(2, "0")
    )).join("");
    return `${IDEMPOTENCY_STORAGE_PREFIX}:${fingerprint}`;
  }
  const signature = String(token).split(".")[1] || String(token);
  return `${IDEMPOTENCY_STORAGE_PREFIX}:${action}:${signature.slice(-16)}`;
}

function requestFailure(message, { code = null, retryable = false } = {}) {
  const error = new Error(message);
  error.attendanceRequest = true;
  error.code = code;
  error.retryable = retryable;
  return error;
}

function storedOperation(rawValue, storageKey) {
  if (!rawValue) return null;
  try {
    const parsed = JSON.parse(rawValue);
    if (
      parsed?.version === OPERATION_STORAGE_VERSION
      && typeof parsed.idempotencyKey === "string"
      && parsed.idempotencyKey.length >= 16
      && Number.isFinite(parsed.createdAt)
      && Date.now() - parsed.createdAt <= OPERATION_TTL_MS
    ) {
      return {
        storageKey,
        idempotencyKey: parsed.idempotencyKey,
        createdAt: parsed.createdAt,
        payload: parsed.payload && typeof parsed.payload === "object"
          ? parsed.payload
          : null,
      };
    }
  } catch {
    // Versiones anteriores guardaban únicamente la clave como texto.
    if (rawValue.length >= 16 && rawValue.length <= 190) {
      return {
        storageKey,
        idempotencyKey: rawValue,
        createdAt: Date.now(),
        payload: null,
      };
    }
  }
  return null;
}

function serializedOperation(operation) {
  return JSON.stringify({
    version: OPERATION_STORAGE_VERSION,
    idempotencyKey: operation.idempotencyKey,
    createdAt: operation.createdAt,
    payload: operation.payload,
  });
}

async function readResponseBody(response) {
  try {
    return await response.json();
  } catch {
    throw requestFailure(
      "El servidor no devolvió una confirmación válida. Reintentá para verificar la operación sin duplicarla.",
      { code: "INVALID_SERVER_RESPONSE", retryable: true },
    );
  }
}

export default function AttendanceClient({
  worker,
  token,
  action,
  name,
  projectName,
  copy,
}) {
  const locationNoticeId = useId();
  const [status, setStatus] = useState({ type: "idle", message: copy.initialStatus });
  const [locationNoticeAcknowledged, setLocationNoticeAcknowledged] = useState(false);
  const fallbackOperation = useRef(null);
  const expiryTimer = useRef(null);
  const submitting = useRef(false);

  useEffect(() => () => {
    if (expiryTimer.current) globalThis.clearTimeout(expiryTimer.current);
    const operation = fallbackOperation.current;
    if (operation) {
      try {
        globalThis.sessionStorage?.removeItem(operation.storageKey);
      } catch {
        // Salir de la pantalla descarta igualmente la copia sensible en memoria.
      }
      fallbackOperation.current = null;
    }
    submitting.current = false;
  }, []);

  function scheduleOperationExpiry(operation) {
    if (expiryTimer.current) globalThis.clearTimeout(expiryTimer.current);
    const remaining = Math.max(0, OPERATION_TTL_MS - (Date.now() - operation.createdAt));
    expiryTimer.current = globalThis.setTimeout(() => {
      try {
        globalThis.sessionStorage?.removeItem(operation.storageKey);
      } catch {
        // La copia en memoria también se elimina aunque storage esté bloqueado.
      }
      if (fallbackOperation.current?.storageKey === operation.storageKey) {
        fallbackOperation.current = null;
      }
      expiryTimer.current = null;
    }, remaining);
  }

  async function operationIdentity() {
    const storageKey = await idempotencyStorageKey(token, action);
    let operation = null;
    let rawOperation = null;
    try {
      rawOperation = globalThis.sessionStorage?.getItem(storageKey) || null;
      operation = storedOperation(
        rawOperation,
        storageKey,
      );
      if (rawOperation && !operation) {
        globalThis.sessionStorage?.removeItem(storageKey);
      }
    } catch {
      // Algunos modos de privacidad bloquean storage; el fallback de la pestaña sigue siendo estable.
    }
    if (!operation && fallbackOperation.current?.storageKey === storageKey) {
      operation = fallbackOperation.current;
    }
    if (!operation) {
      operation = {
        storageKey,
        idempotencyKey: createIdempotencyKey(),
        createdAt: Date.now(),
        payload: null,
      };
    }
    fallbackOperation.current = operation;
    scheduleOperationExpiry(operation);
    try {
      globalThis.sessionStorage?.setItem(storageKey, serializedOperation(operation));
    } catch {
      // El request conserva la misma identidad mientras esta pestaña permanezca abierta.
    }
    return operation;
  }

  function persistOperationPayload(operation, payload) {
    const nextOperation = { ...operation, payload };
    fallbackOperation.current = nextOperation;
    scheduleOperationExpiry(nextOperation);
    try {
      globalThis.sessionStorage?.setItem(
        operation.storageKey,
        serializedOperation(nextOperation),
      );
    } catch {
      // El payload exacto permanece en memoria para reintentos dentro de esta pestaña.
    }
    return nextOperation;
  }

  function completeOperation(storageKey) {
    try {
      globalThis.sessionStorage?.removeItem(storageKey);
    } catch {
      // Una respuesta terminal sigue siendo autoritativa aunque storage no esté disponible.
    }
    if (fallbackOperation.current?.storageKey === storageKey) {
      fallbackOperation.current = null;
    }
    if (expiryTimer.current) {
      globalThis.clearTimeout(expiryTimer.current);
      expiryTimer.current = null;
    }
  }

  async function requestPayload(identity) {
    if (identity.payload) return identity;
    let location = null;
    if (copy.locationRequired) {
      setStatus({ type: "loading", message: copy.requestingLocation });
      const position = await getCurrentPosition();
      const capturedAtMs = Number(position.timestamp);
      if (!Number.isFinite(capturedAtMs)) {
        throw new Error("El navegador no informó cuándo obtuvo la ubicación. Volvé a intentarlo.");
      }
      const capturedAt = new Date(capturedAtMs);
      if (Number.isNaN(capturedAt.getTime())) {
        throw new Error("El navegador no informó una hora válida para la ubicación. Volvé a intentarlo.");
      }
      location = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        capturedAt: capturedAt.toISOString(),
      };
    }
    return persistOperationPayload(identity, {
      location,
      locationNoticeAcknowledged: copy.locationRequired
        ? locationNoticeAcknowledged
        : false,
      locationNoticeVersion: LOCATION_NOTICE_VERSION,
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting.current) return;
    if (copy.locationRequired && !locationNoticeAcknowledged) {
      setStatus({
        type: "error",
        message: "Confirmá la autorización de lectura puntual antes de continuar.",
      });
      return;
    }
    submitting.current = true;

    let identity = null;
    let completed = false;
    try {
      identity = await operationIdentity();
      identity = await requestPayload(identity);
      setStatus({ type: "loading", message: copy.submitting });
      const response = await fetch("/api/webviews/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          worker,
          token,
          action,
          idempotencyKey: identity.idempotencyKey,
          ...identity.payload,
        }),
      });
      const result = await readResponseBody(response);
      if (!response.ok || result.success === false) {
        const code = typeof result.code === "string" ? result.code : null;
        throw requestFailure(
          result.error || "No pudimos registrar esta acción.",
          {
            code,
            retryable: response.status >= 500
              || PRESERVE_OPERATION_CODES.has(code),
          },
        );
      }

      completeOperation(identity.storageKey);
      completed = true;
      setStatus({
        type: "success",
        message: result.message || "La acción quedó registrada.",
      });
    } catch (error) {
      const permissionDenied = error?.code === 1;
      const requestError = error?.attendanceRequest === true;
      if (identity && requestError && !error.retryable) {
        completeOperation(identity.storageKey);
      }
      setStatus({
        type: "error",
        message: permissionDenied
          ? "Necesitamos tu autorización para esta lectura puntual. Habilitá la ubicación en el navegador y reintentá."
          : requestError
            ? error.message
            : copy.locationRequired && !identity?.payload
              ? error?.message || "No pudimos obtener una ubicación confiable. Reintentá desde un lugar con mejor señal."
              : "No pudimos confirmar la operación. Reintentá: conservaremos exactamente la misma solicitud para evitar duplicados.",
      });
    } finally {
      if (!completed) submitting.current = false;
    }
  }

  const loading = status.type === "loading";
  const completed = status.type === "success";
  const actionDisabled = loading
    || completed
    || (copy.locationRequired && !locationNoticeAcknowledged);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <Link className={styles.brand} href="/" aria-label="ObraSaaS, inicio">
            <ObraSaasLogo markClassName={styles.brandMark} markSize={32} />
          </Link>
          <span className={styles.secureBadge}>Enlace cifrado · 2 h</span>
        </header>

        <section className={styles.heroCard}>
          <div>
            <p className={styles.eyebrow}>{copy.eyebrow}</p>
            <h1>{copy.title}</h1>
            <p className={styles.lead}>Hola, {name}. {copy.lead}</p>
            <p className={styles.projectContext}>{projectName}</p>
          </div>
          {copy.locationRequired ? (
            <div className={styles.locationVisual} aria-hidden="true">
              <span className={styles.locationPulse} />
              <span className={styles.locationPin}>●</span>
            </div>
          ) : (
            <div className={styles.timeVisual} aria-hidden="true">
              <span>◷</span>
            </div>
          )}
        </section>

        <form className={styles.actionCard} onSubmit={handleSubmit}>
          <div className={styles.steps}>
            {copy.steps.map((step, index) => (
              <span key={step}><b>{index + 1}</b> {step}</span>
            ))}
          </div>

          {copy.locationRequired && (
            <label className={styles.locationConsent} htmlFor={locationNoticeId}>
              <input
                id={locationNoticeId}
                type="checkbox"
                checked={locationNoticeAcknowledged}
                onChange={(event) => setLocationNoticeAcknowledged(event.target.checked)}
                disabled={loading || completed}
              />
              <span>
                <strong>Autorizo una lectura puntual de ubicación.</strong>
                Se usará sólo para registrar esta acción y contrastarla con la geocerca de la obra.
              </span>
            </label>
          )}

          <div className={`${styles.status} ${styles[status.type]}`} role="status" aria-live="polite">
            <span aria-hidden="true">{status.type === "success" ? "✓" : status.type === "error" ? "!" : "i"}</span>
            {status.message}
          </div>

          <button className={styles.primaryButton} type="submit" disabled={actionDisabled}>
            {loading ? <span className={styles.spinner} aria-hidden="true" /> : <span aria-hidden="true">{copy.locationRequired ? "⌖" : "◷"}</span>}
            {loading ? "Procesando…" : completed ? copy.completedButton : copy.button}
          </button>
          <p className={styles.privacy}>
            {copy.locationRequired
              ? "La autorización cubre una sola lectura al confirmar. Para resolver una respuesta ambigua, se conserva sólo en esta pestaña hasta 10 minutos y luego se elimina. No activa seguimiento en segundo plano."
              : "Registramos esta acción con la hora del servidor. No solicitamos ubicación para este paso."}
          </p>
        </form>
      </div>
    </main>
  );
}
