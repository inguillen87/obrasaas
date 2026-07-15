'use client';

import { useEffect } from 'react';
import styles from './report.module.css';

export default function ReportActions({ autoPrint = false }) {
  useEffect(() => {
    if (!autoPrint) return undefined;
    const timer = window.setTimeout(() => window.print(), 450);
    return () => window.clearTimeout(timer);
  }, [autoPrint]);

  return (
    <button className={styles.printButton} type="button" onClick={() => window.print()}>
      Imprimir / Guardar PDF
    </button>
  );
}
