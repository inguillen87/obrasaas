'use client';

import { useEffect, useState } from 'react';
import styles from './report.module.css';

function responseFilename(response) {
  const disposition = response.headers.get('content-disposition') || '';
  const match = disposition.match(/filename="([^"]+)"/i);
  return match?.[1] || 'reporte-semanal-obrasaas.pdf';
}

export default function ReportActions({ autoPrint = false }) {
  const [downloadState, setDownloadState] = useState({ status: 'idle', message: '' });

  useEffect(() => {
    if (!autoPrint) return undefined;
    const timer = window.setTimeout(() => window.print(), 450);
    return () => window.clearTimeout(timer);
  }, [autoPrint]);

  async function downloadPdf() {
    if (downloadState.status === 'loading') return;
    setDownloadState({ status: 'loading', message: 'Generando PDF versionado...' });

    try {
      const response = await fetch('/api/reports/weekly/pdf', { method: 'POST' });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'No pudimos generar el PDF.');
      }
      if (!response.headers.get('content-type')?.includes('application/pdf')) {
        throw new Error('El servidor no devolvió un PDF válido. Volvé a iniciar sesión e intentá nuevamente.');
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = responseFilename(response);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
      setDownloadState({ status: 'success', message: 'PDF generado y descargado.' });
    } catch (error) {
      setDownloadState({
        status: 'error',
        message: error instanceof Error ? error.message : 'No pudimos generar el PDF.',
      });
    }
  }

  return (
    <div className={styles.reportActions}>
      <div>
        <button
          aria-busy={downloadState.status === 'loading'}
          className={styles.downloadButton}
          disabled={downloadState.status === 'loading'}
          type="button"
          onClick={downloadPdf}
        >
          {downloadState.status === 'loading' ? 'Generando...' : 'Descargar PDF'}
        </button>
        <button className={styles.printButton} type="button" onClick={() => window.print()}>
          Imprimir vista
        </button>
      </div>
      {downloadState.message && (
        <p
          className={downloadState.status === 'error' ? styles.actionError : styles.actionStatus}
          role={downloadState.status === 'error' ? 'alert' : 'status'}
        >
          {downloadState.message}
        </p>
      )}
    </div>
  );
}
