"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ObraSaasLogo } from "@/app/brand/brand-logo";

import styles from "./worker-payment-receipt.module.css";

const API_PATH = "/api/webviews/worker-payment-receipt";
const MAX_RESPONSE_BYTES = 8 * 1_024;
const MAX_PDF_BYTES = 1024 * 1_024;
const MAX_TOKEN_LENGTH = 4_096;
const TOKEN_FRAGMENT_PREFIX = "#token=";
const TOKEN_TTL_MS = 15 * 60 * 1_000;
const INIT_RESPONSE_FIELDS = new Set(["success", "action", "receipt"]);
const RECEIPT_FIELDS = new Set([
  "reference",
  "receivedAt",
  "issuedAt",
  "paymentPurpose",
  "destinationType",
  "maskedReference",
  "status",
  "integritySha256",
]);
const PAYMENT_PURPOSES = new Set(["SALARY", "REIMBURSEMENT"]);
const DESTINATION_TYPES = new Set(["CBU", "CVU", "ALIAS"]);
const OPAQUE_REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,95}$/;
const MASKED_BANK_REFERENCE_PATTERN = /^•••• [0-9]{4}$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const PURPOSE_LABELS = Object.freeze({
  SALARY: "Haberes",
  REIMBURSEMENT: "Reintegro",
});

function hasExactFields(value, fields) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === fields.size && keys.every((key) => fields.has(key));
}

function canonicalTimestamp(value) {
  if (typeof value !== "string" || value.length > 40) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  const canonical = new Date(timestamp).toISOString();
  return canonical === value ? canonical : null;
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
  let bearer;
  try {
    bearer = decodeURIComponent(encodedToken);
  } catch {
    return null;
  }
  if (
    typeof bearer !== "string"
    || bearer.length < 1
    || bearer.length > MAX_TOKEN_LENGTH
    || bearer.trim() !== bearer
    || encodeURIComponent(bearer) !== encodedToken
  ) {
    return null;
  }
  return bearer;
}

function safeMaskedReference(destinationType, value) {
  if (value === null) return null;
  if (
    (destinationType === "CBU" || destinationType === "CVU")
    && typeof value === "string"
    && MASKED_BANK_REFERENCE_PATTERN.test(value)
  ) {
    return value;
  }
  return null;
}

function safeInitReceipt(result) {
  if (
    !hasExactFields(result, INIT_RESPONSE_FIELDS)
    || result.success !== true
    || result.action !== "INIT"
    || !hasExactFields(result.receipt, RECEIPT_FIELDS)
  ) {
    return null;
  }
  const value = result.receipt;
  const receivedAt = canonicalTimestamp(value.receivedAt);
  const issuedAt = canonicalTimestamp(value.issuedAt);
  const maskedReference = safeMaskedReference(value.destinationType, value.maskedReference);
  if (
    !OPAQUE_REFERENCE_PATTERN.test(value.reference || "")
    || !receivedAt
    || !issuedAt
    || Date.parse(issuedAt) < Date.parse(receivedAt)
    || !PAYMENT_PURPOSES.has(value.paymentPurpose)
    || !DESTINATION_TYPES.has(value.destinationType)
    || value.status !== "RECEIVED_FOR_REVIEW"
    || !SHA256_PATTERN.test(value.integritySha256 || "")
    || (value.maskedReference !== null && maskedReference === null)
    || (value.destinationType === "ALIAS" && value.maskedReference !== null)
  ) {
    return null;
  }
  return {
    reference: value.reference,
    receivedAt,
    issuedAt,
    paymentPurpose: value.paymentPurpose,
    destinationType: value.destinationType,
    maskedReference,
    status: value.status,
    integritySha256: value.integritySha256,
  };
}

function safeFilename(reference) {
  const suffix = String(reference || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "privada";
  return `constancia-recepcion-${suffix}.pdf`;
}

function formatTimestamp(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(parsed);
}

function requestFailure(message) {
  const error = new Error(message);
  error.workerPaymentReceiptRequest = true;
  return error;
}

async function readJsonResponse(response) {
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) {
    throw requestFailure("El servidor no devolvió una constancia válida.");
  }
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    return parsed;
  } catch {
    throw requestFailure("El servidor no devolvió una constancia válida.");
  }
}

async function readBoundedPdf(response) {
  const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  const declaredLength = Number(response.headers.get("content-length"));
  if (
    !response.ok
    || contentType !== "application/pdf"
    || (Number.isFinite(declaredLength) && declaredLength > MAX_PDF_BYTES)
    || !response.body
  ) {
    throw requestFailure("No pudimos generar el PDF de esta constancia.");
  }

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_PDF_BYTES) {
        await reader.cancel();
        throw requestFailure("El PDF excede el tamaño permitido.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const header = new TextDecoder("ascii").decode(bytes.subarray(0, 5));
  const trailer = new TextDecoder("ascii").decode(bytes.subarray(Math.max(0, bytes.length - 1_024)));
  if (header !== "%PDF-" || !trailer.includes("%%EOF")) {
    throw requestFailure("El servidor no devolvió un PDF válido.");
  }
  return bytes;
}

function downloadPdf(bytes, filename) {
  const objectUrl = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  try {
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.rel = "noopener noreferrer";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    globalThis.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
  }
}

export default function WorkerPaymentReceiptClient({ receipt, worker }) {
  const [context, setContext] = useState(null);
  const [status, setStatus] = useState({
    type: "loading",
    message: "Validando esta constancia privada…",
  });
  const tokenRef = useRef(null);
  const purgeTimerRef = useRef(null);
  const downloadingRef = useRef(false);

  const clearBearer = useCallback(() => {
    tokenRef.current = null;
    if (purgeTimerRef.current !== null) {
      globalThis.clearTimeout(purgeTimerRef.current);
      purgeTimerRef.current = null;
    }
  }, []);

  const armBearerPurge = useCallback((issuedAt) => {
    if (purgeTimerRef.current !== null) globalThis.clearTimeout(purgeTimerRef.current);
    const delay = Math.min(
      TOKEN_TTL_MS,
      Math.max(0, Date.parse(issuedAt) + TOKEN_TTL_MS - Date.now()),
    );
    if (delay <= 0) {
      clearBearer();
      return false;
    }
    purgeTimerRef.current = globalThis.setTimeout(clearBearer, delay);
    return true;
  }, [clearBearer]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const fragment = typeof globalThis.location?.hash === "string"
      ? globalThis.location.hash
      : "";
    const bearer = tokenRef.current || tokenFromFragment(fragment);

    // Remove the bearer before the first network request. If this fails, do not
    // transmit it: the address bar and browser history must remain token-free.
    try {
      const safeRequestTarget = `${globalThis.location.pathname}${globalThis.location.search}`;
      globalThis.history.replaceState(null, "", safeRequestTarget);
    } catch {
      clearBearer();
      globalThis.queueMicrotask(() => {
        if (!active) return;
        setStatus({
          type: "error",
          message: "No pudimos proteger este enlace en el navegador. Abrilo nuevamente desde WhatsApp.",
        });
      });
      return () => {
        active = false;
        controller.abort();
      };
    }

    if (!bearer) {
      clearBearer();
      globalThis.queueMicrotask(() => {
        if (!active) return;
        setStatus({
          type: "error",
          message: "Este enlace no contiene una autorización válida. Contactá a la administración por el canal oficial.",
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
            receipt,
            token: bearer,
          }),
        });
        const result = await readJsonResponse(response);
        const initialized = response.ok ? safeInitReceipt(result) : null;
        if (!initialized || !armBearerPurge(initialized.issuedAt)) {
          throw requestFailure("No pudimos validar esta constancia privada.");
        }
        if (!active) return;
        setContext(initialized);
        setStatus({
          type: "ready",
          message: "Constancia validada. Podés revisar los datos enmascarados y descargar el PDF.",
        });
      } catch (error) {
        if (!active || error?.name === "AbortError") return;
        clearBearer();
        setContext(null);
        setStatus({
          type: "error",
          message: error?.workerPaymentReceiptRequest === true
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
  }, [armBearerPurge, clearBearer, receipt, worker]);

  async function handlePdfDownload() {
    if (downloadingRef.current) return;
    const bearer = tokenRef.current;
    if (!context || !bearer) {
      setStatus({
        type: "error",
        message: "Este enlace ya no está autorizado. Contactá a la administración por el canal oficial.",
      });
      return;
    }
    downloadingRef.current = true;
    setStatus({ type: "loading", message: "Generando el PDF privado…" });
    try {
      const response = await fetch(API_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        credentials: "same-origin",
        referrerPolicy: "no-referrer",
        body: JSON.stringify({
          action: "PDF",
          worker,
          receipt,
          token: bearer,
        }),
      });
      const bytes = await readBoundedPdf(response);
      downloadPdf(bytes, safeFilename(context.reference));
      setStatus({
        type: "success",
        message: "PDF descargado. Guardalo sólo en un dispositivo de confianza.",
      });
    } catch (error) {
      setStatus({
        type: "error",
        message: error?.workerPaymentReceiptRequest === true
          ? error.message
          : "No pudimos descargar el PDF. Volvé a abrir el enlace original desde WhatsApp.",
      });
    } finally {
      downloadingRef.current = false;
    }
  }

  const busy = status.type === "loading";
  const destinationReference = context?.maskedReference || "No exhibida por seguridad";

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <ObraSaasLogo markSize={31} variant="inverse" />
          <span className={styles.secureBadge}>Enlace privado y temporal</span>
        </header>

        <section className={styles.heroCard}>
          <div>
            <p className={styles.eyebrow}>Constancia privada de recepción</p>
            <h1>Recibimos tu destino de cobro</h1>
            <p className={styles.lead}>
              Mostramos únicamente una referencia protegida. El dato bancario completo no aparece en esta pantalla ni en el PDF.
            </p>
          </div>
          <div className={styles.documentVisual} aria-hidden="true">
            <span>RECIBIDO</span>
            <i />
          </div>
        </section>

        <section className={styles.receiptCard} aria-busy={busy}>
          <div
            className={`${styles.status} ${styles[status.type] || ""}`.trim()}
            role={status.type === "error" ? "alert" : "status"}
            aria-live="polite"
          >
            <span aria-hidden="true">{status.type === "error" ? "!" : status.type === "success" ? "✓" : "i"}</span>
            <p>{status.message}</p>
          </div>

          {context && (
            <>
              <div className={styles.reviewState}>
                <span aria-hidden="true">✓</span>
                <div>
                  <small>Estado</small>
                  <strong>Recibido para revisión</strong>
                </div>
              </div>

              <dl className={styles.details}>
                <div>
                  <dt>Referencia de constancia</dt>
                  <dd className={styles.reference}>{context.reference}</dd>
                </div>
                <div>
                  <dt>Recibido</dt>
                  <dd><time dateTime={context.receivedAt}>{formatTimestamp(context.receivedAt)}</time></dd>
                </div>
                <div>
                  <dt>Emitido</dt>
                  <dd><time dateTime={context.issuedAt}>{formatTimestamp(context.issuedAt)}</time></dd>
                </div>
                <div>
                  <dt>Finalidad</dt>
                  <dd>{PURPOSE_LABELS[context.paymentPurpose]}</dd>
                </div>
                <div>
                  <dt>Tipo de destino</dt>
                  <dd>{context.destinationType}</dd>
                </div>
                <div>
                  <dt>Referencia enmascarada</dt>
                  <dd>{destinationReference}</dd>
                </div>
              </dl>

              <div className={styles.integrity}>
                <span>Huella de integridad SHA-256</span>
                <code>{context.integritySha256}</code>
              </div>

              <aside className={styles.disclaimer}>
                <strong>Alcance de esta constancia</strong>
                <p>
                  Esta constancia no acredita titularidad, validación bancaria, activación, transferencia ni pago.
                  Confirma únicamente que ObraSaaS recibió un destino de cobro para revisión.
                </p>
              </aside>

              <button
                aria-busy={busy}
                className={styles.primaryButton}
                disabled={busy}
                type="button"
                onClick={handlePdfDownload}
              >
                {busy ? <span className={styles.spinner} aria-hidden="true" /> : <span aria-hidden="true">↓</span>}
                {busy ? "Generando PDF…" : "Descargar constancia en PDF"}
              </button>
            </>
          )}

          <p className={styles.privacy}>
            No compartas este enlace. La autorización vence automáticamente y nunca muestra el CBU, CVU o alias completo.
          </p>
        </section>
      </div>
    </main>
  );
}
