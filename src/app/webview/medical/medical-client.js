"use client";

import { useState } from "react";
import Link from "next/link";
import {
  MAX_MEDICAL_CERTIFICATE_BYTES,
  MAX_MEDICAL_CERTIFICATE_MEGABYTES,
} from "@/lib/medical-upload";
import styles from "../webview.module.css";

export default function MedicalClient({ worker, token, name }) {
  const [days, setDays] = useState(1);
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState({
    type: "idle",
    message: `PDF, JPG, PNG o WebP · máximo ${MAX_MEDICAL_CERTIFICATE_MEGABYTES} MB`,
  });

  async function handleSubmit(event) {
    event.preventDefault();
    if (!file) {
      setStatus({ type: "error", message: "Adjuntá una foto o PDF legible del certificado." });
      return;
    }

    setStatus({ type: "loading", message: "Guardando en el repositorio protegido…" });
    try {
      const formData = new FormData();
      formData.append("worker", worker);
      formData.append("token", token);
      formData.append("days", String(days));
      formData.append("certificate", file);
      const response = await fetch("/api/webviews/medical", { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No pudimos guardar el certificado.");
      setStatus({ type: "success", message: result.message });
    } catch (error) {
      setStatus({ type: "error", message: error.message || "No pudimos guardar el certificado." });
    }
  }

  const loading = status.type === "loading";
  const completed = status.type === "success";
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <Link className={styles.brand} href="/" aria-label="ObraSaaS, inicio"><span>OS</span> ObraSaaS</Link>
          <span className={styles.secureBadge}>Documento protegido</span>
        </header>

        <section className={styles.heroCard}>
          <div>
            <p className={styles.eyebrow}>Legajo digital</p>
            <h1>Cargá tu certificado</h1>
            <p className={styles.lead}>{name}, registramos sólo los datos administrativos necesarios. El diagnóstico no se publica en la bitácora general.</p>
          </div>
          <div className={styles.documentVisual} aria-hidden="true"><span>PDF</span><i /></div>
        </section>

        <form className={styles.actionCard} onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span>Días de licencia</span>
            <input type="number" min="1" max="30" value={days} onChange={(event) => setDays(Number(event.target.value) || 1)} disabled={loading || completed} />
          </label>

          <label className={`${styles.uploadBox} ${file ? styles.hasFile : ""}`}>
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              onChange={(event) => {
                const selected = event.target.files?.[0] || null;
                if (selected?.size > MAX_MEDICAL_CERTIFICATE_BYTES) {
                  event.target.value = "";
                  setFile(null);
                  setStatus({
                    type: "error",
                    message: `El archivo supera el máximo permitido de ${MAX_MEDICAL_CERTIFICATE_MEGABYTES} MB.`,
                  });
                  return;
                }
                setFile(selected);
                setStatus({
                  type: "idle",
                  message: selected
                    ? `${selected.name} · ${(selected.size / 1024 / 1024).toFixed(1)} MB`
                    : `PDF, JPG, PNG o WebP · máximo ${MAX_MEDICAL_CERTIFICATE_MEGABYTES} MB`,
                });
              }}
              disabled={loading || completed}
            />
            <span className={styles.uploadIcon} aria-hidden="true">↑</span>
            <b>{file ? "Documento listo" : "Tomar foto o elegir archivo"}</b>
            <small>{file ? file.name : "Debe verse completo y legible"}</small>
          </label>

          <div className={`${styles.status} ${styles[status.type]}`} role="status" aria-live="polite">
            <span aria-hidden="true">{status.type === "success" ? "✓" : status.type === "error" ? "!" : "i"}</span>
            {status.message}
          </div>

          <button className={styles.primaryButton} type="submit" disabled={loading || completed}>
            {loading && <span className={styles.spinner} aria-hidden="true" />}
            {completed ? "Certificado registrado" : loading ? "Protegiendo documento…" : "Registrar certificado"}
          </button>
          <p className={styles.privacy}>El archivo se almacena como recurso autenticado. El acceso queda limitado a personal autorizado de la organización.</p>
        </form>
      </div>
    </main>
  );
}
