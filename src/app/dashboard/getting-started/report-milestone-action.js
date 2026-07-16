'use client';

import { useState } from 'react';

import styles from './getting-started.module.css';

export default function ReportMilestoneAction({ compact = false, generated = false }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function generateReport() {
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/reports/weekly', { method: 'POST' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'No se pudo preparar el reporte.');
      window.location.assign(payload.href || '/dashboard/report');
    } catch (requestError) {
      setError(requestError.message);
      setPending(false);
    }
  }

  return (
    <div className={compact ? styles.compactReportAction : styles.reportAction}>
      <button type="button" disabled={pending} onClick={generateReport}>
        <i className="fa-solid fa-file-arrow-down" aria-hidden="true" />
        {pending
          ? 'Preparando reporte...'
          : generated ? 'Generar versión actualizada' : 'Generar y abrir reporte'}
      </button>
      {error && <span role="alert">{error}</span>}
    </div>
  );
}
