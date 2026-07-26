"use client";

import { useMemo, useRef, useState } from "react";
import {
  discardProtectedUploadAttempt,
  isProtectedUploadFileSizeAllowed,
  isTerminalProtectedUploadClientError,
  protectedUploadAttemptForPayload,
  protectedUploadFileIdentity,
  protectedUploadFileSizeMessage,
  protectedUploadPayloadKey,
  rememberProtectedUploadId,
} from "@/lib/protected-upload-policy";
import styles from "./progress.module.css";

const TERMINAL_VISUAL_STATUSES = new Set(["COMPLETED", "ABSTAINED", "FAILED"]);
const VISUAL_STATUS_LABELS = Object.freeze({
  PENDING: "En cola",
  RUNNING: "Analizando",
  COMPLETED: "Evaluación disponible",
  ABSTAINED: "Sin estimación responsable",
  FAILED: "Análisis no completado",
});
const REVIEW_STATUS_LABELS = Object.freeze({
  PENDING: "Revisión humana pendiente",
  APPROVED: "Validada por una persona",
  CORRECTED: "Corregida por una persona",
  REJECTED: "Descartada por una persona",
});
const QUALITY_LABELS = Object.freeze({
  overall: "Calidad general",
  angle: "Ángulo",
  lighting: "Iluminación",
  occlusion: "Obstrucción",
});
const QUALITY_VALUES = Object.freeze({
  good: "Buena",
  limited: "Limitada",
  insufficient: "Insuficiente",
  none: "Ninguna",
  partial: "Parcial",
  severe: "Severa",
});

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || "No se pudo completar la operación.");
    error.status = response.status;
    error.code = body.code || null;
    error.assessmentCreated = Boolean(body.assessmentId);
    throw error;
  }
  return body;
}

function createVisualIdempotencyKey() {
  const suffix = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `visual-progress-${suffix}`;
}

function mergeVisualAssessments(current, incoming) {
  const byId = new Map(current.map((assessment) => [assessment.id, assessment]));
  for (const assessment of incoming) {
    if (assessment?.id) byId.set(assessment.id, assessment);
  }
  return [...byId.values()].sort((left, right) => (
    String(right.createdAt || "").localeCompare(String(left.createdAt || ""))
    || String(right.id).localeCompare(String(left.id))
  ));
}

function visualFeedback(assessment, replayed = false) {
  if (assessment?.status === "COMPLETED") {
    return replayed
      ? "La evaluación ya estaba confirmada; no se generó un análisis duplicado."
      : "La evaluación orientativa está lista y requiere revisión humana.";
  }
  if (assessment?.status === "ABSTAINED") {
    return "La IA se abstuvo de estimar porque la evidencia no permite una conclusión responsable.";
  }
  if (assessment?.status === "FAILED") {
    return "El análisis no pudo completarse. Podés iniciar un nuevo intento seguro.";
  }
  return "La evaluación sigue en proceso. Esta pantalla consultará su estado sin reenviar la imagen.";
}

function percentConfidence(value) {
  const confidence = Number(value);
  if (!Number.isFinite(confidence)) return null;
  return `${Math.round(Math.max(0, Math.min(1, confidence)) * 100)}%`;
}

function safeList(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.trim()) : [];
}

function visualAssessmentForUi(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    id: source.id,
    evidenceId: source.evidenceId,
    status: source.status,
    summary: source.summary || null,
    elementType: source.elementType || null,
    progressMin: source.progressMin ?? null,
    progressMax: source.progressMax ?? null,
    confidence: source.confidence ?? null,
    quality: {
      overall: source.quality?.overall || null,
      angle: source.quality?.angle || null,
      lighting: source.quality?.lighting || null,
      occlusion: source.quality?.occlusion || null,
    },
    observations: safeList(source.observations),
    limitations: safeList(source.limitations),
    reviewStatus: source.reviewStatus || null,
    reviewNote: source.reviewNote || null,
    correctedProgressMin: source.correctedProgressMin ?? null,
    correctedProgressMax: source.correctedProgressMax ?? null,
    revision: source.revision,
    completedAt: source.completedAt || null,
    reviewedAt: source.reviewedAt || null,
    createdAt: source.createdAt || null,
  };
}

function VisualAssessmentCard({ assessment, busy, canReview, onReview }) {
  const [decision, setDecision] = useState("APPROVED");
  const [reviewNote, setReviewNote] = useState("");
  const [correctedMin, setCorrectedMin] = useState("");
  const [correctedMax, setCorrectedMax] = useState("");
  const [formError, setFormError] = useState("");
  const facts = safeList(assessment.observations);
  const limitations = safeList(assessment.limitations);
  const confidence = percentConfidence(assessment.confidence);
  const terminal = assessment.status === "COMPLETED" || assessment.status === "ABSTAINED";
  const awaitingReview = terminal && assessment.reviewStatus === "PENDING";

  async function submitReview(event) {
    event.preventDefault();
    const note = reviewNote.trim();
    if ((decision === "CORRECTED" || decision === "REJECTED") && !note) {
      setFormError("Explicá la corrección o el motivo del rechazo.");
      return;
    }
    const minText = correctedMin.trim();
    const maxText = correctedMax.trim();
    const min = Number(minText);
    const max = Number(maxText);
    if (
      decision === "CORRECTED"
      && (
        !minText
        || !maxText
        || !Number.isSafeInteger(min)
        || !Number.isSafeInteger(max)
        || min < 0
        || max > 100
        || min > max
      )
    ) {
      setFormError("El rango corregido debe usar enteros entre 0 y 100, de menor a mayor.");
      return;
    }
    setFormError("");
    await onReview(assessment, {
      status: decision,
      reviewNote: note || undefined,
      ...(decision === "CORRECTED"
        ? { correctedProgressMin: min, correctedProgressMax: max }
        : {}),
    });
  }

  return (
    <section className={styles.visualAssessment} data-status={assessment.status.toLowerCase()}>
      <header className={styles.visualAssessmentHeader}>
        <div>
          <span className={styles.visualAssessmentIcon} aria-hidden="true">
            <i className={assessment.status === "RUNNING" || assessment.status === "PENDING"
              ? "fa-solid fa-circle-notch fa-spin"
              : assessment.status === "COMPLETED"
                ? "fa-solid fa-wand-magic-sparkles"
                : assessment.status === "ABSTAINED"
                  ? "fa-solid fa-eye-slash"
                  : "fa-solid fa-triangle-exclamation"}
            />
          </span>
          <div>
            <small>Lectura visual asistida</small>
            <strong>{VISUAL_STATUS_LABELS[assessment.status] || "Estado no disponible"}</strong>
          </div>
        </div>
        {assessment.reviewStatus && (
          <span className={styles.reviewBadge} data-review={assessment.reviewStatus.toLowerCase()}>
            {REVIEW_STATUS_LABELS[assessment.reviewStatus] || "Revisión registrada"}
          </span>
        )}
      </header>

      {(assessment.status === "RUNNING" || assessment.status === "PENDING") && (
        <p className={styles.visualRunning} role="status">
          La imagen se procesa de forma privada. No cierres esta evidencia si querés ver el resultado aquí.
        </p>
      )}

      {assessment.status === "FAILED" && (
        <p className={styles.visualFailure} role="status">
          No se obtuvo una lectura confiable. La evidencia original permanece intacta y revisable.
        </p>
      )}

      {terminal && (
        <div className={styles.visualResult}>
          {assessment.summary && <p className={styles.visualSummary}>{assessment.summary}</p>}
          {assessment.status === "COMPLETED" && (
            <div className={styles.visualMetrics}>
              <div>
                <small>Rango orientativo</small>
                <strong>{assessment.progressMin}%–{assessment.progressMax}%</strong>
              </div>
              <div>
                <small>Autoconfianza del modelo (orientativa, no calibrada)</small>
                <strong>{confidence || "No informada"}</strong>
              </div>
              <div>
                <small>Elemento observado</small>
                <strong>{assessment.elementType || "No determinado"}</strong>
              </div>
            </div>
          )}

          {Object.values(assessment.quality || {}).some(Boolean) && (
            <div className={styles.visualQuality} aria-label="Calidad de la evidencia">
              {Object.entries(QUALITY_LABELS).map(([key, label]) => assessment.quality?.[key] && (
                <span key={key}>
                  <small>{label}</small>
                  <strong>{QUALITY_VALUES[assessment.quality[key]] || assessment.quality[key]}</strong>
                </span>
              ))}
            </div>
          )}

          {facts.length > 0 && (
            <div className={styles.visualDetailList}>
              <strong>Hechos observables</strong>
              <ul>{facts.map((fact) => <li key={fact}>{fact}</li>)}</ul>
            </div>
          )}
          {limitations.length > 0 && (
            <div className={styles.visualDetailList} data-tone="warning">
              <strong>Limitaciones</strong>
              <ul>{limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul>
            </div>
          )}
        </div>
      )}

      {assessment.reviewStatus && assessment.reviewStatus !== "PENDING" && (
        <div className={styles.humanDecision} data-review={assessment.reviewStatus.toLowerCase()}>
          <strong>{REVIEW_STATUS_LABELS[assessment.reviewStatus]}</strong>
          {assessment.reviewStatus === "CORRECTED" && (
            <span>
              Rango corregido: {assessment.correctedProgressMin}%–{assessment.correctedProgressMax}%
            </span>
          )}
          {assessment.reviewNote && <p>{assessment.reviewNote}</p>}
        </div>
      )}

      {awaitingReview && canReview && (
        <form className={styles.visualReviewForm} onSubmit={submitReview}>
          <div className={styles.visualReviewHeading}>
            <div>
              <strong>Decisión humana obligatoria</strong>
              <small>La evaluación de IA no se aplica por sí sola.</small>
            </div>
            <select value={decision} onChange={(event) => setDecision(event.target.value)}>
              <option value="APPROVED">Aprobar lectura</option>
              <option value="CORRECTED">Corregir rango</option>
              <option value="REJECTED">Rechazar lectura</option>
            </select>
          </div>
          {decision === "CORRECTED" && (
            <div className={styles.correctedRange}>
              <label>
                <span>Mínimo corregido</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  required
                  value={correctedMin}
                  onChange={(event) => setCorrectedMin(event.target.value)}
                />
              </label>
              <label>
                <span>Máximo corregido</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  required
                  value={correctedMax}
                  onChange={(event) => setCorrectedMax(event.target.value)}
                />
              </label>
            </div>
          )}
          <label className={styles.reviewNoteField}>
            <span>
              Nota de revisión {decision === "APPROVED" ? "(opcional)" : "(obligatoria)"}
            </span>
            <textarea
              value={reviewNote}
              onChange={(event) => setReviewNote(event.target.value)}
              required={decision !== "APPROVED"}
              maxLength={10_000}
              placeholder="Fundamento técnico breve y verificable"
            />
          </label>
          {formError && <p className={styles.visualFormError} role="alert">{formError}</p>}
          <button type="submit" disabled={busy}>
            {busy ? "Guardando revisión…" : "Confirmar decisión humana"}
          </button>
        </form>
      )}

      {awaitingReview && !canReview && (
        <p className={styles.visualReviewPending}>Pendiente de revisión por un rol autorizado.</p>
      )}

      <p className={styles.visualDisclaimer}>
        Orientativo: no certifica avance, no autoriza pagos y no modifica el Gantt.
      </p>
    </section>
  );
}

export default function ProgressClient({
  initialData,
  initialVisualAssessments = [],
  tasks,
  workers,
  permissions,
  projectName,
  initialWorkDate,
}) {
  const [data, setData] = useState(initialData);
  const [visualAssessments, setVisualAssessments] = useState(() => (
    mergeVisualAssessments([], initialVisualAssessments)
  ));
  const [visualBusyIds, setVisualBusyIds] = useState(() => new Set());
  const [visualFeedbackByEvidence, setVisualFeedbackByEvidence] = useState(() => new Map());
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [taskId, setTaskId] = useState("");
  const [workDate, setWorkDate] = useState(initialWorkDate);
  const [authorWorkerId, setAuthorWorkerId] = useState("");
  const [evidenceTaskId, setEvidenceTaskId] = useState("");
  const [caption, setCaption] = useState("");
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [timelineKind, setTimelineKind] = useState("");
  const [timelineStatus, setTimelineStatus] = useState("");
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const operationRef = useRef(false);
  const evidenceUploadAttemptRef = useRef(null);
  const evidenceFileInputRef = useRef(null);
  const visualAttemptRef = useRef(new Map());
  const visualRequestLocksRef = useRef(new Set());
  const latestVisualByEvidence = useMemo(() => {
    const latest = new Map();
    for (const assessment of visualAssessments) {
      if (!latest.has(assessment.evidenceId)) latest.set(assessment.evidenceId, assessment);
    }
    return latest;
  }, [visualAssessments]);

  function setVisualBusy(evidenceId, active) {
    setVisualBusyIds((current) => {
      const next = new Set(current);
      if (active) next.add(evidenceId);
      else next.delete(evidenceId);
      return next;
    });
  }

  function setVisualFeedback(evidenceId, tone, message) {
    setVisualFeedbackByEvidence((current) => {
      const next = new Map(current);
      next.set(evidenceId, { tone, message });
      return next;
    });
  }

  function beginOperation() {
    if (operationRef.current) return false;
    operationRef.current = true;
    setBusy(true);
    return true;
  }

  function endOperation() {
    operationRef.current = false;
    setBusy(false);
  }

  async function refreshPrimaryRecords() {
    try {
      const latest = await api('/api/progress?limit=50');
      setData((current) => ({
        ...current,
        dailyLogs: latest.dailyLogs,
        evidence: latest.evidence,
      }));
      return true;
    } catch {
      return false;
    }
  }

  async function createLog(event) {
    event.preventDefault();
    if (!beginOperation()) return;
    try {
      const result = await api("/api/progress", {
        method: "POST",
        body: JSON.stringify({
          kind: "DAILY_LOG",
          title,
          summary,
          taskId: taskId || undefined,
          workDate,
          authorWorkerId: authorWorkerId || undefined,
        }),
      });
      setData((current) => ({
        ...current,
        dailyLogs: [result.dailyLog, ...current.dailyLogs],
      }));
      setTitle("");
      setSummary("");
      setNotice("Bitácora guardada como borrador.");
    } catch (error) {
      setNotice(error.message);
    } finally {
      endOperation();
    }
  }
  async function createEvidence(event) {
    event.preventDefault();
    if (!evidenceFile) {
      setNotice("Seleccioná una imagen, video o PDF.");
      return;
    }
    if (!isProtectedUploadFileSizeAllowed(evidenceFile)) {
      setNotice(`${protectedUploadFileSizeMessage("La evidencia")} Para video MP4 usá un clip breve.`);
      return;
    }
    if (!beginOperation()) return;
    let attempt;
    try {
      const payloadKey = protectedUploadPayloadKey({
        taskId: evidenceTaskId,
        caption,
        authorWorkerId: authorWorkerId || null,
        file: protectedUploadFileIdentity(evidenceFile),
      });
      attempt = await protectedUploadAttemptForPayload(
        evidenceUploadAttemptRef.current,
        payloadKey,
        { deleteEndpoint: "/api/progress/upload" },
      );
      evidenceUploadAttemptRef.current = attempt;
      if (!attempt.uploadId) {
        const form = new FormData();
        form.append("file", evidenceFile);
        const upload = await fetch("/api/progress/upload", {
          method: "POST",
          headers: { "Idempotency-Key": attempt.operationKey },
          body: form,
        });
        const uploaded = await upload.json().catch(() => ({}));
        if (!upload.ok) {
          const uploadError = new Error(
            uploaded.error || "No se pudo cargar la media.",
          );
          uploadError.status = upload.status;
          uploadError.code = uploaded.code;
          throw uploadError;
        }
        rememberProtectedUploadId(attempt, uploaded.uploadId);
      }
      const result = await api("/api/progress", {
        method: "POST",
        body: JSON.stringify({
          kind: "EVIDENCE",
          taskId: evidenceTaskId,
          caption,
          uploadId: attempt.uploadId,
          operationKey: attempt.operationKey,
          capturedAt: attempt.capturedAt,
          authorWorkerId: authorWorkerId || undefined,
        }),
      });
      setData((current) => ({
        ...current,
        evidence: [result.evidence, ...current.evidence],
      }));
      evidenceUploadAttemptRef.current = null;
      setCaption("");
      setEvidenceFile(null);
      if (evidenceFileInputRef.current) evidenceFileInputRef.current.value = "";
      setNotice("Evidencia privada guardada para revisión humana.");
    } catch (error) {
      if (attempt?.uploadId && isTerminalProtectedUploadClientError(error)) {
        try {
          await discardProtectedUploadAttempt(attempt, "/api/progress/upload");
          evidenceUploadAttemptRef.current = null;
        } catch (cleanupError) {
          setNotice(`${error.message} ${cleanupError.message}`);
          return;
        }
      }
      setNotice(error.message);
    } finally {
      endOperation();
    }
  }
  async function review(item, kind, status) {
    if (!beginOperation()) return;
    try {
      const result = await api(`/api/progress/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ kind, status, expectedRevision: item.revision }),
      });
      setData((current) => ({
        ...current,
        dailyLogs:
          kind === "DAILY_LOG"
            ? current.dailyLogs.map((entry) =>
                entry.id === item.id ? result.dailyLog : entry,
              )
            : current.dailyLogs,
        evidence:
          kind === "EVIDENCE"
            ? current.evidence.map((entry) =>
                entry.id === item.id ? result.evidence : entry,
              )
            : current.evidence,
      }));
    } catch (error) {
      if (error.status === 409) {
        const refreshed = await refreshPrimaryRecords();
        setNotice(refreshed
          ? "El registro cambió en otra sesión. Actualizamos el estado antes de reintentar."
          : "El registro cambió en otra sesión y no pudimos refrescarlo. Recargá la página antes de reintentar.");
      } else {
        setNotice(error.message);
      }
    } finally {
      endOperation();
    }
  }
  async function loadVisualAssessmentsForEvidence(evidenceId) {
    const result = await api(
      `/api/progress/${encodeURIComponent(evidenceId)}/visual-assessments`,
    );
    const incoming = Array.isArray(result.assessments)
      ? result.assessments.map(visualAssessmentForUi)
      : [];
    setVisualAssessments((current) => mergeVisualAssessments(current, incoming));
    return incoming;
  }
  async function pollVisualAssessment(evidenceId, assessmentId) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      await new Promise((resolve) => globalThis.setTimeout(resolve, 1250));
      const assessments = await loadVisualAssessmentsForEvidence(evidenceId);
      const refreshed = assessments.find((entry) => entry.id === assessmentId);
      if (refreshed && TERMINAL_VISUAL_STATUSES.has(refreshed.status)) return refreshed;
    }
    return null;
  }
  async function requestVisualAnalysis(item) {
    if (!permissions.canUseVisualProgress) {
      setVisualFeedback(
        item.id,
        "error",
        "Tu rol o la configuración del proyecto no permiten iniciar esta lectura visual.",
      );
      return;
    }
    if (visualRequestLocksRef.current.has(item.id)) return;
    visualRequestLocksRef.current.add(item.id);
    setVisualBusy(item.id, true);
    setVisualFeedback(item.id, "info", "Iniciando una lectura visual privada y orientativa…");
    const existingKey = visualAttemptRef.current.get(item.id);
    const idempotencyKey = existingKey || createVisualIdempotencyKey();
    visualAttemptRef.current.set(item.id, idempotencyKey);
    try {
      const result = await api(
        `/api/progress/${encodeURIComponent(item.id)}/visual-assessments`,
        {
          method: "POST",
          headers: { "Idempotency-Key": idempotencyKey },
        },
      );
      let assessment = visualAssessmentForUi(result.assessment);
      setVisualAssessments((current) => mergeVisualAssessments(current, [assessment]));
      if (result.pending || !TERMINAL_VISUAL_STATUSES.has(assessment.status)) {
        setVisualFeedback(
          item.id,
          "info",
          "El análisis sigue en proceso. Consultaremos su estado sin reenviar la imagen.",
        );
        assessment = await pollVisualAssessment(item.id, assessment.id) || assessment;
      }
      if (TERMINAL_VISUAL_STATUSES.has(assessment.status)) {
        visualAttemptRef.current.delete(item.id);
      }
      setVisualFeedback(
        item.id,
        assessment.status === "FAILED" ? "error" : "success",
        visualFeedback(assessment, result.replayed),
      );
    } catch (error) {
      if (error.code === "VISUAL_PROGRESS_EVIDENCE_BUSY") {
        visualAttemptRef.current.delete(item.id);
        await loadVisualAssessmentsForEvidence(item.id).catch(() => []);
        setVisualFeedback(
          item.id,
          "info",
          "Ya existe una lectura en curso o pendiente de revisión para esta evidencia. Actualizamos su estado sin duplicar el análisis.",
        );
        return;
      }
      if (error.assessmentCreated) {
        visualAttemptRef.current.delete(item.id);
        await loadVisualAssessmentsForEvidence(item.id).catch(() => []);
      }
      setVisualFeedback(
        item.id,
        "error",
        error.assessmentCreated
          ? "El intento quedó registrado, pero no pudo completarse. La evidencia original no fue modificada."
          : `${error.message} Podés reintentar: se conservará la misma clave para evitar duplicados.`,
      );
    } finally {
      visualRequestLocksRef.current.delete(item.id);
      setVisualBusy(item.id, false);
    }
  }
  async function refreshVisualState(item) {
    if (!permissions.canReadSourceEvidence || visualRequestLocksRef.current.has(item.id)) return;
    visualRequestLocksRef.current.add(item.id);
    setVisualBusy(item.id, true);
    try {
      const assessments = await loadVisualAssessmentsForEvidence(item.id);
      const current = assessments[0];
      if (current && TERMINAL_VISUAL_STATUSES.has(current.status)) {
        visualAttemptRef.current.delete(item.id);
      }
      setVisualFeedback(
        item.id,
        current && TERMINAL_VISUAL_STATUSES.has(current.status) ? "success" : "info",
        current
          ? visualFeedback(current)
          : "Todavía no hay una evaluación visual para esta evidencia.",
      );
    } catch (error) {
      setVisualFeedback(item.id, "error", error.message);
    } finally {
      visualRequestLocksRef.current.delete(item.id);
      setVisualBusy(item.id, false);
    }
  }
  async function reviewVisualAssessment(item, assessment, input) {
    if (!permissions.canUseVisualProgress || visualRequestLocksRef.current.has(item.id)) return;
    visualRequestLocksRef.current.add(item.id);
    setVisualBusy(item.id, true);
    try {
      const result = await api(
        `/api/progress/${encodeURIComponent(item.id)}/visual-assessments/${encodeURIComponent(assessment.id)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            ...input,
            expectedRevision: assessment.revision,
          }),
        },
      );
      const reviewed = visualAssessmentForUi(result.assessment || result);
      setVisualAssessments((current) => mergeVisualAssessments(current, [reviewed]));
      setVisualFeedback(
        item.id,
        "success",
        "Decisión humana registrada con trazabilidad y control de versión.",
      );
    } catch (error) {
      if (error.code === "VISUAL_PROGRESS_ASSESSMENT_STALE") {
        await loadVisualAssessmentsForEvidence(item.id).catch(() => []);
        setVisualFeedback(
          item.id,
          "error",
          "La evidencia o el plan cambió. Rechazá esta lectura obsoleta con una nota para habilitar un análisis nuevo.",
        );
      } else if (error.status === 409) {
        await loadVisualAssessmentsForEvidence(item.id).catch(() => []);
        setVisualFeedback(
          item.id,
          "error",
          "La evaluación cambió en otra sesión. Actualizamos su estado; revisala antes de decidir.",
        );
      } else {
        setVisualFeedback(item.id, "error", error.message);
      }
    } finally {
      visualRequestLocksRef.current.delete(item.id);
      setVisualBusy(item.id, false);
    }
  }
  async function reloadTimeline() {
    if (!beginOperation()) return;
    try {
      const query = new URLSearchParams({ limit: "50" });
      if (timelineKind) query.set("kind", timelineKind);
      if (timelineStatus) query.set("status", timelineStatus);
      const result = await api(`/api/progress?${query}`);
      setData((current) => ({
        ...current,
        timeline: result.timeline,
        page: result.page,
      }));
    } catch (error) {
      setNotice(error.message);
    } finally {
      endOperation();
    }
  }

  async function loadMoreTimeline() {
    if (!data.page?.nextBefore || !beginOperation()) return;
    try {
      const query = new URLSearchParams({
        limit: "50",
        before: data.page.nextBefore,
      });
      if (timelineKind) query.set("kind", timelineKind);
      if (timelineStatus) query.set("status", timelineStatus);
      const result = await api(`/api/progress?${query}`);
      setData((current) => {
        const known = new Set(current.timeline.map((item) => `${item.kind}:${item.id}`));
        const appended = result.timeline.filter((item) => !known.has(`${item.kind}:${item.id}`));
        return {
          ...current,
          timeline: [...current.timeline, ...appended],
          page: result.page,
        };
      });
    } catch (error) {
      setNotice(error.message);
    } finally {
      endOperation();
    }
  }
  return (
    <main className={styles.shell}>
      <header className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Avance verificable</span>
          <h1>Bitácora y evidencia</h1>
          <p>
            {projectName} · cada registro queda ligado a una tarea canónica y la
            evidencia requiere revisión humana.
          </p>
        </div>
      </header>
      {notice && (
        <div className={styles.notice} role="status" aria-live="polite">
          {notice}
          <button type="button" aria-label="Cerrar aviso" onClick={() => setNotice(null)}>
            ×
          </button>
        </div>
      )}
      <div className={styles.grid}>
        <section className={styles.panel}>
          <h2>Nueva bitácora</h2>
          {permissions.canManage ? (
            <form onSubmit={createLog}>
              <input
                aria-label="Título de la bitácora"
                required
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Título"
                maxLength={220}
              />
              <textarea
                aria-label="Resumen de la bitácora"
                required
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                placeholder="Qué ocurrió hoy"
                maxLength={10000}
              />
              <div className={styles.row}>
                <input
                  aria-label="Fecha de trabajo"
                  type="date"
                  required
                  value={workDate}
                  onChange={(event) => setWorkDate(event.target.value)}
                />
                <select
                  aria-label="Tarea vinculada a la bitácora"
                  value={taskId}
                  onChange={(event) => setTaskId(event.target.value)}
                >
                  <option value="">Sin tarea</option>
                  {tasks.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.title}
                    </option>
                  ))}
                </select>
              </div>
              <select
                aria-label="Autor de la bitácora o evidencia"
                value={authorWorkerId}
                onChange={(event) => setAuthorWorkerId(event.target.value)}
              >
                <option value="">Autor opcional</option>
                {workers.map((worker) => (
                  <option key={worker.id} value={worker.id}>
                    {worker.name}
                  </option>
                ))}
              </select>
              <button disabled={busy} type="submit">
                Guardar borrador
              </button>
            </form>
          ) : (
            <p>Tu rol puede consultar registros, pero no crearlos.</p>
          )}
        </section>
        <section className={styles.panel}>
          <h2>Nueva evidencia</h2>
          {permissions.canManage ? (
            <form onSubmit={createEvidence}>
              <select
                aria-label="Tarea vinculada a la evidencia"
                required
                value={evidenceTaskId}
                onChange={(event) => setEvidenceTaskId(event.target.value)}
              >
                <option value="">Elegí tarea canónica</option>
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
              <input
                ref={evidenceFileInputRef}
                aria-label="Archivo de evidencia"
                type="file"
                required
                accept="image/jpeg,image/png,image/webp,video/mp4,application/pdf"
                onChange={(event) =>
                  setEvidenceFile(event.target.files?.[0] || null)
                }
              />
              <input
                aria-label="Descripción de la evidencia"
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                placeholder="Descripción breve"
                maxLength={2000}
              />
              <small>
                Media privada de hasta 4 MiB; para video MP4 usá un clip breve.
                El archivo no queda expuesto públicamente.
              </small>
              <button disabled={busy} type="submit">
                Enviar a revisión
              </button>
            </form>
          ) : (
            <p>Tu rol puede consultar evidencia, pero no crearla.</p>
          )}
        </section>
      </div>
      <section className={styles.panel}>
        <h2>Bitácoras recientes</h2>
        {data.dailyLogs.length === 0 ? (
          <p>No hay bitácoras.</p>
        ) : (
          <ul>
            {data.dailyLogs.map((item) => (
              <li key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <span>
                    {item.workDate} · {item.status}
                  </span>
                  <p>{item.summary}</p>
                </div>
                {permissions.canManage && item.status === "DRAFT" && (
                  <div>
                    <button
                      disabled={busy}
                      onClick={() => review(item, "DAILY_LOG", "SUBMITTED")}
                    >
                      Enviar
                    </button>
                  </div>
                )}
                {permissions.canManage && item.status === "SUBMITTED" && (
                  <div>
                    <button
                      disabled={busy}
                      onClick={() => review(item, "DAILY_LOG", "APPROVED")}
                    >
                      Aprobar
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => review(item, "DAILY_LOG", "REJECTED")}
                    >
                      Rechazar
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className={styles.panel}>
        <h2>Evidencia pendiente/revisada</h2>
        {data.evidence.length === 0 ? (
          <p>No hay evidencia.</p>
        ) : (
          <ul className={styles.evidenceList}>
            {data.evidence.map((item) => {
              const assessment = latestVisualByEvidence.get(item.id) || null;
              const imageEvidence = item.attachment?.kind === "image";
              const visualBusy = visualBusyIds.has(item.id);
              const feedback = visualFeedbackByEvidence.get(item.id);
              const running = assessment
                && (assessment.status === "PENDING" || assessment.status === "RUNNING");
              const awaitingVisualReview = assessment
                && (assessment.status === "COMPLETED" || assessment.status === "ABSTAINED")
                && assessment.reviewStatus === "PENDING";
              const canStartVisual = permissions.canUseVisualProgress
                && imageEvidence
                && item.status !== "REJECTED"
                && !running
                && !awaitingVisualReview;

              return (
                <li className={styles.evidenceItem} key={item.id}>
                  <div className={styles.evidenceHeader}>
                    <div>
                      <strong>{item.caption || "Evidencia sin descripción"}</strong>
                      <span>
                        {item.capturedAt} · {item.status}
                        {item.source?.channel === "whatsapp" ? " · WhatsApp" : ""}
                      </span>
                      {item.attachment?.href && (
                        <a
                          className={styles.protectedLink}
                          href={item.attachment.href}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Abrir archivo protegido
                        </a>
                      )}
                    </div>
                    {permissions.canManage && item.status === "PENDING" && (
                      <div className={styles.evidenceActions}>
                        <button
                          disabled={busy}
                          onClick={() => review(item, "EVIDENCE", "APPROVED")}
                        >
                          Aprobar
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => review(item, "EVIDENCE", "REJECTED")}
                        >
                          Rechazar
                        </button>
                      </div>
                    )}
                  </div>

                  {permissions.canReadSourceEvidence && imageEvidence && (
                    <div className={styles.visualArea}>
                      <div className={styles.visualActionBar}>
                        <div>
                          <strong>Lectura visual asistida</strong>
                          <small>
                            Estimación orientativa con revisión humana; nunca reemplaza una certificación.
                          </small>
                        </div>
                        {permissions.canUseVisualProgress ? (
                          <div className={styles.visualButtons}>
                            {running ? (
                              <>
                                <button type="button" disabled>
                                  <i className="fa-solid fa-circle-notch fa-spin" aria-hidden="true" />
                                  Análisis en curso
                                </button>
                                <button
                                  type="button"
                                  className={styles.secondaryButton}
                                  disabled={visualBusy}
                                  onClick={() => refreshVisualState(item)}
                                >
                                  Actualizar estado
                                </button>
                              </>
                            ) : awaitingVisualReview ? (
                              <button type="button" disabled>Revisión humana pendiente</button>
                            ) : (
                              <button
                                type="button"
                                disabled={visualBusy || !canStartVisual}
                                onClick={() => requestVisualAnalysis(item)}
                              >
                                <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" />
                                {visualBusy
                                  ? "Iniciando…"
                                  : assessment
                                    ? "Analizar nuevamente"
                                    : "Analizar con IA"}
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className={styles.visualDisabled}>
                            Lectura visual desactivada para este proyecto o rol.
                          </span>
                        )}
                      </div>

                      {feedback && (
                        <p
                          className={styles.visualFeedback}
                          data-tone={feedback.tone}
                          role={feedback.tone === "error" ? "alert" : "status"}
                        >
                          {feedback.message}
                        </p>
                      )}

                      {assessment && (
                        <VisualAssessmentCard
                          key={assessment.id}
                          assessment={assessment}
                          busy={visualBusy}
                          canReview={permissions.canUseVisualProgress}
                          onReview={(currentAssessment, input) => (
                            reviewVisualAssessment(item, currentAssessment, input)
                          )}
                        />
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section className={styles.panel}>
        <div className={styles.timelineHead}>
          <div>
            <h2>Timeline operativo</h2>
            <small>
              {data.page?.hasMore
                ? "Hay más actividad histórica."
                : "Mostrando la actividad disponible."}
            </small>
          </div>
          <div className={styles.filters}>
            <select
              aria-label="Filtrar timeline por tipo"
              value={timelineKind}
              onChange={(event) => setTimelineKind(event.target.value)}
            >
              <option value="">Todos los tipos</option>
              <option value="DAILY_LOG">Bitácoras</option>
              <option value="EVIDENCE">Evidencia</option>
              <option value="BLOCKER">Blockers</option>
              <option value="INCIDENT">Incidentes</option>
            </select>
            <select
              aria-label="Filtrar timeline por estado"
              value={timelineStatus}
              onChange={(event) => setTimelineStatus(event.target.value)}
            >
              <option value="">Todos los estados</option>
              <option value="PENDING">Pendiente</option>
              <option value="OPEN">Abierto</option>
              <option value="APPROVED">Aprobado</option>
              <option value="RESOLVED">Resuelto</option>
              <option value="REJECTED">Rechazado</option>
            </select>
            <button disabled={busy} type="button" onClick={reloadTimeline}>
              Filtrar
            </button>
          </div>
        </div>
        {data.timeline?.length ? (
          <ul>
            {data.timeline.map((item) => (
              <li key={`${item.kind}-${item.id}`}>
                <div>
                  <strong>
                    {item.kind} · {item.title}
                  </strong>
                  <span>
                    {item.occurredAt || "Sin fecha"} · {item.status}
                    {item.severity ? ` · ${item.severity}` : ""}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p>No hay actividad operativa registrada.</p>
        )}
        {data.page?.hasMore && data.page?.nextBefore && (
          <button type="button" disabled={busy} onClick={loadMoreTimeline}>
            Cargar actividad anterior
          </button>
        )}
      </section>
    </main>
  );
}
