'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { track } from '@vercel/analytics';

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
  const [step, setStep] = useState(1);
  const [status, setStatus] = useState('idle');
  const [feedback, setFeedback] = useState('');
  const startedAtRef = useRef(null);
  const analyticsStartedRef = useRef(false);
  const organizationRef = useRef(null);
  const challengeRef = useRef(null);

  useEffect(() => {
    startedAtRef.current = Date.now();
  }, []);

  const updateField = (event) => {
    const { name, value } = event.target;
    setFields((current) => ({ ...current, [name]: value }));
  };

  const markStarted = () => {
    if (analyticsStartedRef.current) return;
    analyticsStartedRef.current = true;
    track('Lead Form Started', { source: 'landing' });
  };

  const submitLead = async (event) => {
    event.preventDefault();
    if (step === 1) {
      setStep(2);
      track('Lead Form Advanced', { source: 'landing' });
      requestAnimationFrame(() => challengeRef.current?.focus());
      return;
    }
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
      setStep(1);
      startedAtRef.current = Date.now();
      analyticsStartedRef.current = false;
      track('Lead Form Submitted', { source: 'landing', segment: fields.segment });
    } catch (error) {
      setStatus('error');
      setFeedback(error.message || 'No pudimos registrar la solicitud. Probá nuevamente.');
      track('Lead Form Error', { source: 'landing' });
    }
  };

  const returnToIdentity = () => {
    setStep(1);
    requestAnimationFrame(() => organizationRef.current?.focus());
  };

  return (
    <form className={styles.leadForm} onSubmit={submitLead} onFocusCapture={markStarted}>
      <div className={styles.leadFormHeader}>
        <div><span>Solicitud de piloto</span><small>Respuesta personalizada · sin tarjeta</small></div>
        <p><strong>0{step}</strong> / 02</p>
      </div>
      <div className={styles.leadStep} key={step}>
        {step === 1 ? (
          <>
            <div className={styles.leadStepIntro}><span>Empecemos por lo esencial</span><p>Contanos quién sos. En el siguiente paso definimos el flujo que vale la pena probar.</p></div>
            <div className={styles.leadFormGrid}>
              <label>
                <span>Organización</span>
                <input ref={organizationRef} name="organization" value={fields.organization} onChange={updateField} required maxLength={120} autoComplete="organization" placeholder="Constructora, estudio u organismo" />
              </label>
              <label>
                <span>Nombre y apellido</span>
                <input name="contactName" value={fields.contactName} onChange={updateField} required maxLength={120} autoComplete="name" placeholder="Tu nombre" />
              </label>
              <label className={styles.leadWideField}>
                <span>Email laboral</span>
                <input type="email" name="email" value={fields.email} onChange={updateField} required maxLength={254} autoComplete="email" placeholder="nombre@empresa.com" />
              </label>
            </div>
          </>
        ) : (
          <>
            <div className={styles.leadStepIntro}><span>Diseñemos una prueba útil</span><p>Elegí el contexto y describí el problema operativo que querés medir primero.</p></div>
            <div className={styles.leadFormGrid}>
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
                <span>WhatsApp o teléfono <small>Opcional</small></span>
                <input type="tel" name="phone" value={fields.phone} onChange={updateField} maxLength={40} autoComplete="tel" placeholder="+54 9 11…" />
              </label>
              <label>
                <span>Usuarios estimados <small>Opcional</small></span>
                <input type="number" name="estimatedSeats" value={fields.estimatedSeats} onChange={updateField} min="1" max="100000" inputMode="numeric" placeholder="Ej. 25" />
              </label>
              <label className={styles.leadChallenge}>
                <span>¿Qué problema querés resolver primero?</span>
                <textarea ref={challengeRef} name="primaryChallenge" value={fields.primaryChallenge} onChange={updateField} required minLength={10} maxLength={1200} rows={4} placeholder="Ej. Los avances llegan por WhatsApp pero después nadie actualiza el cronograma ni la bitácora." />
              </label>
            </div>
          </>
        )}
      </div>
      <label className={styles.leadHoneypot} aria-hidden="true">
        <span>Sitio web</span>
        <input name="website" value={fields.website} onChange={updateField} tabIndex={-1} autoComplete="off" />
      </label>
      <div className={styles.leadFormFooter}>
        <p>Al enviar aceptás que usemos estos datos para contactarte sobre ObraSaaS. Ver <Link href="/privacy">Privacidad</Link>.</p>
        <div className={styles.leadFormActions}>
          {step === 2 && <button type="button" className={styles.leadBack} onClick={returnToIdentity}>Volver</button>}
          <button type="submit" disabled={status === 'submitting'}>
            {status === 'submitting' ? 'Registrando…' : step === 1 ? 'Continuar' : 'Solicitar demo'}
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
      {feedback && (
        <p className={`${styles.leadFeedback} ${status === 'success' ? styles.leadSuccess : styles.leadError}`} role="status">
          {status === 'success' ? '✓ ' : ''}{feedback}
        </p>
      )}
    </form>
  );
}
