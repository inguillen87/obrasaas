'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

import styles from './landing.module.css';

const initialFields = {
  organization: '',
  contactName: '',
  email: '',
  phone: '',
  segment: 'CONSTRUCTION',
  estimatedSeats: '',
  primaryChallenge: '',
  website: '',
};

export default function DemoForm() {
  const [fields, setFields] = useState(initialFields);
  const [status, setStatus] = useState('idle');
  const [feedback, setFeedback] = useState('');
  const startedAtRef = useRef(null);

  useEffect(() => {
    startedAtRef.current = Date.now();
  }, []);

  const updateField = (event) => {
    const { name, value } = event.target;
    setFields((current) => ({ ...current, [name]: value }));
  };

  const submitLead = async (event) => {
    event.preventDefault();
    if (status === 'submitting') return;
    setStatus('submitting');
    setFeedback('');
    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...fields, startedAt: startedAtRef.current ?? Date.now() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'No pudimos registrar la solicitud.');
      setStatus('success');
      setFeedback(data.message || 'Recibimos tu solicitud.');
      setFields(initialFields);
      startedAtRef.current = Date.now();
    } catch (error) {
      setStatus('error');
      setFeedback(error.message || 'No pudimos registrar la solicitud. Probá nuevamente.');
    }
  };

  return (
    <form className={styles.leadForm} onSubmit={submitLead}>
      <div className={styles.leadFormHeader}>
        <span>Solicitud de piloto</span>
        <small>Respuesta personalizada · sin tarjeta</small>
      </div>
      <div className={styles.leadFormGrid}>
        <label>
          <span>Organización</span>
          <input name="organization" value={fields.organization} onChange={updateField} required maxLength={120} autoComplete="organization" placeholder="Constructora, estudio u organismo" />
        </label>
        <label>
          <span>Nombre y apellido</span>
          <input name="contactName" value={fields.contactName} onChange={updateField} required maxLength={120} autoComplete="name" placeholder="Tu nombre" />
        </label>
        <label>
          <span>Email laboral</span>
          <input type="email" name="email" value={fields.email} onChange={updateField} required maxLength={254} autoComplete="email" placeholder="nombre@empresa.com" />
        </label>
        <label>
          <span>WhatsApp o teléfono <small>Opcional</small></span>
          <input type="tel" name="phone" value={fields.phone} onChange={updateField} maxLength={40} autoComplete="tel" placeholder="+54 9 11…" />
        </label>
        <label>
          <span>Tipo de organización</span>
          <select name="segment" value={fields.segment} onChange={updateField}>
            <option value="CONSTRUCTION">Constructora</option>
            <option value="ARCHITECTURE">Estudio de arquitectura</option>
            <option value="REAL_ESTATE">Desarrolladora inmobiliaria</option>
            <option value="GOVERNMENT">Gobierno / mandante público</option>
            <option value="INDUSTRIAL">Industria / mantenimiento</option>
            <option value="OTHER">Otro</option>
          </select>
        </label>
        <label>
          <span>Usuarios estimados <small>Opcional</small></span>
          <input type="number" name="estimatedSeats" value={fields.estimatedSeats} onChange={updateField} min="1" max="100000" inputMode="numeric" placeholder="Ej. 25" />
        </label>
      </div>
      <label className={styles.leadChallenge}>
        <span>¿Qué problema querés resolver primero?</span>
        <textarea name="primaryChallenge" value={fields.primaryChallenge} onChange={updateField} required minLength={10} maxLength={1200} rows={4} placeholder="Ej. Los avances llegan por WhatsApp pero después nadie actualiza el cronograma ni la bitácora." />
      </label>
      <label className={styles.leadHoneypot} aria-hidden="true">
        <span>Sitio web</span>
        <input name="website" value={fields.website} onChange={updateField} tabIndex={-1} autoComplete="off" />
      </label>
      <div className={styles.leadFormFooter}>
        <p>Al enviar aceptás que usemos estos datos para contactarte sobre ObraSaaS. Ver <Link href="/privacy">Privacidad</Link>.</p>
        <button type="submit" disabled={status === 'submitting'}>
          {status === 'submitting' ? 'Registrando…' : 'Solicitar demo'}
          <span aria-hidden="true">→</span>
        </button>
      </div>
      {feedback && (
        <p className={`${styles.leadFeedback} ${status === 'success' ? styles.leadSuccess : styles.leadError}`} role="status">
          {status === 'success' ? '✓ ' : ''}{feedback}
        </p>
      )}
    </form>
  );
}
