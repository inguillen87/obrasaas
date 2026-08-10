"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  createPilotImportIdempotencyKey,
  pilotImportErrorMessage,
  pilotImportRequestBody,
  pilotTargetIdSuffix,
  validatePilotImportDraft,
} from "./pilot-import-helpers";
import styles from "./integrations.module.css";

const EMPTY_DRAFT = Object.freeze({
  accessToken: "",
  phoneNumberId: "",
  projectId: "",
  registrationPin: "",
  whatsappBusinessId: "",
});

function assetKey(asset) {
  return `${asset.whatsappBusinessId}:${asset.phoneNumberId}`;
}

export default function WhatsAppPilotImportPanel({
  currentProjectId,
  targets,
  targetEmptyState,
  assets,
}) {
  const router = useRouter();
  const [organizationId, setOrganizationId] = useState("");
  const [draft, setDraft] = useState({ ...EMPTY_DRAFT });
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState(null);
  const attemptKeyRef = useRef(null);

  const selectedOrganization = useMemo(
    () =>
      targets.find((target) => target.organizationId === organizationId) ||
      null,
    [organizationId, targets],
  );
  const selectedProject =
    selectedOrganization?.projects.find(
      (project) => project.id === draft.projectId,
    ) || null;
  const selectedAsset =
    assets.find(
      (asset) =>
        asset.whatsappBusinessId === draft.whatsappBusinessId &&
        asset.phoneNumberId === draft.phoneNumberId,
    ) || null;
  const allowedProjectIds = useMemo(
    () =>
      new Set(
        selectedOrganization?.projects.map((project) => project.id) || [],
      ),
    [selectedOrganization],
  );

  function invalidateAttempt() {
    attemptKeyRef.current = null;
    setNotice(null);
  }

  function updateDraft(field, value) {
    invalidateAttempt();
    setDraft((current) => ({ ...current, [field]: value }));
    setConfirmed(false);
  }

  function selectAsset(nextAssetKey) {
    invalidateAttempt();
    const nextAsset =
      assets.find((asset) => assetKey(asset) === nextAssetKey) || null;
    setDraft((current) => ({
      ...current,
      whatsappBusinessId: nextAsset?.whatsappBusinessId || "",
      phoneNumberId: nextAsset?.phoneNumberId || "",
    }));
    setConfirmed(false);
  }

  function selectOrganization(nextOrganizationId) {
    invalidateAttempt();
    setOrganizationId(nextOrganizationId);
    setDraft((current) => ({
      ...current,
      projectId: "",
    }));
    setConfirmed(false);
  }

  function clearSecrets({ cancelled = false } = {}) {
    attemptKeyRef.current = null;
    setDraft((current) => ({
      ...current,
      accessToken: "",
      registrationPin: "",
    }));
    setConfirmed(false);
    if (cancelled) {
      setNotice({
        type: "info",
        text: "Los secretos se borraron del formulario. Para reintentar tendrás que ingresarlos de nuevo.",
      });
    }
  }

  async function submitPilotImport(event) {
    event.preventDefault();
    if (pending) return;

    const validationError = validatePilotImportDraft(draft, {
      confirmed,
      allowedProjectIds,
      allowedAssetPairs: new Set(assets.map(assetKey)),
    });
    if (validationError) {
      setNotice({ type: "error", text: validationError });
      return;
    }

    let idempotencyKey = attemptKeyRef.current;
    if (!idempotencyKey) {
      try {
        idempotencyKey = createPilotImportIdempotencyKey();
        attemptKeyRef.current = idempotencyKey;
      } catch {
        setNotice({
          type: "error",
          text: "Este navegador no puede generar una operación segura. Actualizalo antes de continuar.",
        });
        return;
      }
    }

    setPending(true);
    setNotice({
      type: "progress",
      text: "Validando el token y los activos directamente con Meta…",
    });
    try {
      const response = await fetch("/api/integrations/whatsapp/pilot-import", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(pilotImportRequestBody(draft)),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNotice({
          type: "error",
          text: pilotImportErrorMessage(response.status, payload?.code),
        });
        return;
      }
      if (payload?.connection?.projectId !== draft.projectId) {
        setNotice({
          type: "error",
          text: "La confirmación del servidor no coincide con la obra seleccionada.",
        });
        return;
      }

      clearSecrets();
      setNotice({
        type: "success",
        text: "Conexión piloto validada y guardada cifrada en este Preview.",
      });
      if (payload.connection.projectId === currentProjectId) router.refresh();
    } catch {
      setNotice({
        type: "error",
        text: "Se interrumpió la comunicación. Reintentá para continuar la misma operación segura.",
      });
    } finally {
      setPending(false);
    }
  }

  if (targets.length === 0 || assets.length === 0) {
    return (
      <section
        className={styles.pilotSection}
        aria-labelledby="pilot-import-title"
      >
        <header className={styles.pilotHeader}>
          <div>
            <p className={styles.eyebrow}>Herramienta controlada de Preview</p>
            <h2 id="pilot-import-title">Importación piloto de Meta</h2>
          </div>
          <span className={styles.previewBadge}>Solo Preview</span>
        </header>
        <div className={styles.pilotEmpty} role="status">
          <i className="fa-solid fa-user-shield" aria-hidden="true" />
          <div>
            <strong>
              {targets.length === 0
                ? targetEmptyState?.title || "No hay un destino piloto habilitado"
                : "No hay activos de prueba habilitados"}
            </strong>
            <p>
              {targets.length === 0
                ? targetEmptyState?.description ||
                  "Revisá la asignación, los permisos, la suscripción y las obras activas del tenant piloto."
                : "Configurá en este Preview la lista exacta de pares WABA y Phone Number ID emitidos por Meta para pruebas."}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className={styles.pilotSection}
      aria-labelledby="pilot-import-title"
    >
      <header className={styles.pilotHeader}>
        <div>
          <p className={styles.eyebrow}>Herramienta controlada de Preview</p>
          <h2 id="pilot-import-title">Importación piloto de Meta</h2>
          <p>
            Vincula el número de prueba sólo con un destino autorizado por el
            servidor. El token se valida con Meta y se guarda cifrado; esta
            herramienta no existe en Producción.
          </p>
        </div>
        <span className={styles.previewBadge}>Solo Preview</span>
      </header>

      <div className={styles.pilotGuardrail}>
        <i className="fa-solid fa-flask" aria-hidden="true" />
        <div>
          <strong>Credencial temporal para pruebas</strong>
          <span>
            No pegues una credencial de producción. El token puede vencer y
            deberá reemplazarse antes de cada ciclo de validación real.
          </span>
        </div>
      </div>

      <form
        className={styles.pilotForm}
        onSubmit={submitPilotImport}
        autoComplete="off"
        aria-busy={pending}
      >
        <fieldset disabled={pending}>
          <legend>Destino autorizado</legend>
          <div className={styles.pilotTargetGrid}>
            <label>
              <span>Tenant piloto</span>
              <select
                value={organizationId}
                onChange={(event) => selectOrganization(event.target.value)}
              >
                <option value="" disabled>
                  Seleccioná un tenant piloto
                </option>
                {targets.map((target) => (
                  <option
                    key={target.organizationId}
                    value={target.organizationId}
                  >
                    {target.organizationName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Obra activa</span>
              <select
                value={draft.projectId}
                disabled={!selectedOrganization}
                onChange={(event) =>
                  updateDraft("projectId", event.target.value)
                }
              >
                <option value="" disabled>
                  Seleccioná una obra activa
                </option>
                {selectedOrganization?.projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {selectedOrganization && selectedProject ? (
            <p className={styles.pilotTargetSummary}>
              <i className="fa-solid fa-lock" aria-hidden="true" />
              Destino: <strong>
                {selectedOrganization.organizationName}
              </strong>{" "}
              <span>
                ({pilotTargetIdSuffix(selectedOrganization.organizationId)})
              </span>
              {" · "}
              <strong>{selectedProject.name}</strong>{" "}
              <span>({pilotTargetIdSuffix(selectedProject.id)})</span>
            </p>
          ) : (
            <p className={styles.pilotTargetSummary}>
              <i className="fa-solid fa-lock" aria-hidden="true" />
              Elegí explícitamente el tenant y la obra antes de habilitar la
              confirmación.
            </p>
          )}
        </fieldset>

        <fieldset disabled={pending}>
          <legend>Activos de WhatsApp</legend>
          <label>
            <span>Número de prueba autorizado</span>
            <select
              value={selectedAsset ? assetKey(selectedAsset) : ""}
              onChange={(event) => selectAsset(event.target.value)}
              required
            >
              <option value="" disabled>
                Seleccioná un activo emitido por Meta
              </option>
              {assets.map((asset) => (
                <option key={assetKey(asset)} value={assetKey(asset)}>
                  WABA {pilotTargetIdSuffix(asset.whatsappBusinessId)}
                  {" · "}
                  Teléfono {pilotTargetIdSuffix(asset.phoneNumberId)}
                </option>
              ))}
            </select>
          </label>
          <small>
            La lista es de sólo lectura y proviene de la allowlist segura de
            este Preview.
          </small>
        </fieldset>

        <fieldset disabled={pending}>
          <legend>Credencial efímera</legend>
          <div className={styles.pilotSecretGrid}>
            <label>
              <span>Access token temporal</span>
              <input
                type="password"
                name="metaPilotTemporaryCredential"
                value={draft.accessToken}
                onChange={(event) =>
                  updateDraft("accessToken", event.target.value)
                }
                minLength={20}
                maxLength={4096}
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                data-1p-ignore="true"
                data-lpignore="true"
                required
              />
              <small>
                No se muestra ni se incorpora a la URL o al estado visible.
              </small>
            </label>
            <label>
              <span>
                PIN de registro <em>opcional</em>
              </span>
              <input
                type="password"
                name="metaPilotRegistrationCode"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={draft.registrationPin}
                onChange={(event) =>
                  updateDraft(
                    "registrationPin",
                    event.target.value.replace(/\D/g, "").slice(0, 6),
                  )
                }
                autoComplete="off"
                spellCheck={false}
                data-1p-ignore="true"
                data-lpignore="true"
              />
              <small>
                Ingresalo sólo si Meta necesita registrar el número.
              </small>
            </label>
          </div>
        </fieldset>

        <label className={styles.pilotAttestation}>
          <input
            type="checkbox"
            checked={confirmed}
            disabled={
              pending ||
              !selectedOrganization ||
              !selectedProject ||
              !selectedAsset
            }
            onChange={(event) => {
              setConfirmed(event.target.checked);
              setNotice(null);
            }}
          />
          <span>
            {selectedOrganization && selectedProject && selectedAsset ? (
              <>
                Confirmo que son activos temporales de prueba de ObraSaaS y
                autorizo su vinculación cifrada exclusivamente en este Preview
                con el tenant{" "}
                <strong>{selectedOrganization.organizationName}</strong> (
                {pilotTargetIdSuffix(selectedOrganization.organizationId)}) y la
                obra <strong>{selectedProject.name}</strong> (
                {pilotTargetIdSuffix(selectedProject.id)}), usando WABA (
                {pilotTargetIdSuffix(selectedAsset.whatsappBusinessId)}) y
                teléfono ({pilotTargetIdSuffix(selectedAsset.phoneNumberId)}).
              </>
            ) : (
              "Seleccioná explícitamente un tenant, una obra y un activo de prueba para confirmar el destino."
            )}
          </span>
        </label>

        <div className={styles.pilotActions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => clearSecrets({ cancelled: true })}
            disabled={pending || (!draft.accessToken && !draft.registrationPin)}
          >
            Borrar secretos
          </button>
          <button
            type="submit"
            className={styles.primaryButton}
            disabled={
              pending ||
              !confirmed ||
              !selectedOrganization ||
              !selectedProject ||
              !selectedAsset
            }
          >
            {pending
              ? "Validando con Meta…"
              : notice?.type === "error"
                ? "Reintentar importación"
                : "Importar conexión piloto"}
          </button>
        </div>
      </form>

      {notice && (
        <div
          className={`${styles.notice} ${styles[notice.type]}`}
          role={notice.type === "error" ? "alert" : "status"}
          aria-live={notice.type === "error" ? "assertive" : "polite"}
        >
          {notice.text}
        </div>
      )}
    </section>
  );
}
