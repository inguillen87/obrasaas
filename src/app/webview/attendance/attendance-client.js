"use client";

import { useState } from "react";
import Link from "next/link";
import { ObraSaasLogo } from "@/app/brand/brand-logo";
import styles from "../webview.module.css";

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

export default function AttendanceClient({ worker, token, name }) {
  const [status, setStatus] = useState({ type: "idle", message: "Listo para validar tu ubicación." });

  async function handleCheckin() {
    setStatus({ type: "loading", message: "Obteniendo ubicación precisa…" });
    try {
      const position = await getCurrentPosition();
      setStatus({ type: "loading", message: "Contrastando la ubicación informada con la geocerca…" });
      const response = await fetch("/api/webviews/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          worker,
          token,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No pudimos registrar el fichaje.");
      setStatus({ type: "success", message: result.message });
    } catch (error) {
      const denied = error?.code === 1;
      setStatus({
        type: "error",
        message: denied
          ? "Necesitamos permiso de ubicación para validar el fichaje. Habilitalo en el navegador y reintentá."
          : error.message || "No pudimos obtener una ubicación confiable.",
      });
    }
  }

  const loading = status.type === "loading";
  const completed = status.type === "success";
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
            <p className={styles.eyebrow}>Presentismo de campo</p>
            <h1>Informá tu ubicación para completar el ingreso</h1>
            <p className={styles.lead}>Hola, {name}. Tomaremos una lectura puntual del dispositivo para compararla con la geocerca activa.</p>
          </div>
          <div className={styles.locationVisual} aria-hidden="true">
            <span className={styles.locationPulse} />
            <span className={styles.locationPin}>●</span>
          </div>
        </section>

        <section className={styles.actionCard}>
          <div className={styles.steps}>
            <span><b>1</b> Autorizás la ubicación</span>
            <span><b>2</b> Contrastamos la geocerca</span>
            <span><b>3</b> Registramos la evidencia</span>
          </div>

          <div className={`${styles.status} ${styles[status.type]}`} role="status" aria-live="polite">
            <span aria-hidden="true">{status.type === "success" ? "✓" : status.type === "error" ? "!" : "i"}</span>
            {status.message}
          </div>

          <button className={styles.primaryButton} onClick={handleCheckin} disabled={loading || completed}>
            {loading ? <span className={styles.spinner} aria-hidden="true" /> : <span aria-hidden="true">⌖</span>}
            {loading ? "Contrastando…" : completed ? "Ubicación informada" : "Informar ubicación y fichar"}
          </button>
          <p className={styles.privacy}>ObraSaaS no sigue tu ubicación en segundo plano. Guardamos coordenada, precisión, hora y resultado para auditoría.</p>
        </section>
      </div>
    </main>
  );
}
