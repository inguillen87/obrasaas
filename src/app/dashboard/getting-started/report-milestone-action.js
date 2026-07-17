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
      const response = await fetch('/api/reports/weekly/pdf', { method: 'POST' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'No se pudo generar el PDF.');
      }
      if (!response.headers.get('content-type')?.includes('application/pdf')) {
        throw new Error('El servidor no devolvió un PDF válido. Volvé a iniciar sesión e intentá nuevamente.');
      }

      const disposition = response.headers.get('content-disposition') || '';
      const filename = disposition.match(/filename="([^"]+)"/i)?.[1]
        || 'reporte-semanal-obrasaas.pdf';
      const objectUrl = URL.createObjectURL(await response.blob());
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
      window.setTimeout(() => window.location.assign('/dashboard/report'), 500);
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
          : generated ? 'Generar PDF actualizado' : 'Generar PDF y abrir control'}
      </button>
      {error && <span role="alert">{error}</span>}
    </div>
  );
}
