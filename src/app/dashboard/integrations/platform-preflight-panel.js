'use client';
import { useEffect, useRef, useState } from 'react';
import { tokens } from '@/lib/design-system';
import { evidenceScopeHeaders } from '@/lib/evidence-capture-policy';
import styles from './platform-preflight-panel.module.css';
const LABELS = { appId: ['App de Meta', 'Identificador de la aplicación responsable.'], appSecret: ['Clave de la app', 'Que exista un valor no demuestra que Meta lo acepte.'], verifyToken: ['Verificación del webhook', 'La presencia no confirma el challenge ni la recepción.'], encryption: ['Cifrado de credenciales', 'Formato local requerido para guardar conexiones.'], publicOrigin: ['Destino del entorno', 'Origen HTTPS admitido, separado de producción en Preview.'], graphVersion: ['Versión de la API', 'Versión explícita usada por la integración.'] };
const STATUS = { PRESENT: 'Presente', PRESENT_UNVERIFIED: 'Presente · sin verificar', VALID_FORMAT: 'Formato válido', MISSING: 'Falta configurar', MISSING_OR_INVALID: 'Falta o es inválido', VERIFIED: 'Comprobado', BLOCKED: 'Requiere atención', NOT_CHECKED: 'No comprobado' };
const EXPLANATION = {
  APP_AUTHENTICATED: 'Meta aceptó la credencial de esta app. Esto no equivale a un token de mensajería operativo.',
  APP_CREDENTIAL_REJECTED: 'Meta rechazó la credencial de la app. Revisá la clave de esa misma aplicación en el entorno, sin reemplazarla por un token de WhatsApp.',
  APP_ID_MISMATCH: 'La identidad respondida no coincide con la app configurada. No se continuó.',
  PREREQUISITE_MISSING: 'Falta el identificador, la clave o una versión válida de API. No se contactó a Meta.',
  APP_NOT_VERIFIED: 'Primero debe verificarse la identidad de la app.',
  PUBLIC_ORIGIN_INVALID: 'El origen público no está habilitado para este entorno. No se comparó el callback.',
  CALLBACK_CONFIGURATION_MATCHES: 'El callback de la app está activo, coincide con el entorno e incluye messages. Falta comprobar el tráfico real y la vinculación de esta obra.',
  CALLBACK_MISMATCH: 'El callback registrado apunta a otro destino. No lo cambiamos automáticamente.',
  WEBHOOK_NOT_REGISTERED: 'No se encontró una suscripción de webhook de WhatsApp para la app.',
  WEBHOOK_INACTIVE: 'La suscripción del webhook existe pero no figura activa.',
  MESSAGES_FIELD_MISSING: 'La suscripción no incluye el campo messages.',
  SUBSCRIPTIONS_TRUNCATED: 'La respuesta está paginada y no permite concluir qué callback está registrado.',
  META_PERMISSION_DENIED: 'Meta no permitió consultar esta configuración con la credencial actual.',
  META_RATE_LIMIT: 'Meta limitó la consulta. Esperá antes de verificar otra vez.',
  META_TIMEOUT: 'Meta no respondió dentro del plazo. No se infiere que la configuración sea válida o inválida.',
  META_UNAVAILABLE: 'No se pudo consultar Meta. No se alteraron configuraciones ni conexiones.',
  REDIRECT_BLOCKED: 'La API intentó redirigir la consulta; no se enviaron credenciales al destino alternativo.',
  RESPONSE_TOO_LARGE: 'La respuesta superó el límite seguro de esta comprobación.',
  INVALID_RESPONSE: 'La respuesta de Meta no permite verificar el resultado.',
};
function validReport(body, scope) {
  return body?.version === 1 && body.organizationId === scope.organizationId && body.projectId === scope.projectId
    && body.provesOperationalTraffic === false && body.messagesSent === false && body.writesToMeta === false
    && Array.isArray(body.configuration) && body.configuration.length === 6 && new Set(body.configuration.map(row => row.key)).size === 6
    && body.configuration.every(row => LABELS[row.key] && STATUS[row.status])
    && [body.authentication, body.webhook].every(check => check && ['VERIFIED','BLOCKED','NOT_CHECKED'].includes(check.status) && EXPLANATION[check.code]);
}
export default function PlatformPreflightPanel({ organizationId, projectId, initialConfiguration }) {
  const [report, setReport] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [blocked, setBlocked] = useState(false);
  const inFlight = useRef(false), active = useRef(null), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; active.current?.abort(); }; }, []);
  async function verify() {
    if (inFlight.current || blocked) return;
    inFlight.current = true; setBusy(true); setError(''); setReport(null);
    const controller = new AbortController(); active.current = controller;
    const timeout = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch('/api/integrations/whatsapp/preflight', { method: 'POST', cache: 'no-store', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', ...evidenceScopeHeaders({ organizationId, projectId }) }, body: '{}' });
      const body = await response.json().catch(() => null);
      if (!alive.current) return;
      if (!response.ok) { if ([401,403,404,409].includes(response.status)) setBlocked(true); throw new Error(body?.error || 'No se confirmó la comprobación.'); }
      if (!validReport(body, { organizationId, projectId })) { setBlocked(true); throw new Error('El resultado no corresponde al contexto de esta pantalla.'); }
      setReport(body);
    } catch (failure) { if (alive.current) setError(failure.name === 'AbortError' ? 'La verificación demoró. No se reintentó automáticamente.' : failure.message); }
    finally { clearTimeout(timeout); inFlight.current = false; if (alive.current) setBusy(false); }
  }
  const configuration = report?.configuration || initialConfiguration;
  const css = { '--preflight-bg': tokens.colors.bg.secondary, '--preflight-border': tokens.colors.border.default, '--preflight-accent': tokens.colors.accent.primary, '--preflight-text': tokens.colors.text.primary, '--preflight-muted': tokens.colors.text.secondary };
  return <section className={styles.panel} style={css} aria-labelledby="meta-preflight-heading">
    <header className={styles.header}><div><span>ADMINISTRACIÓN DE PLATAFORMA</span><h2 id="meta-preflight-heading">Antes de vincular la obra</h2><p>Separá credenciales presentes, configuración aceptada y funcionamiento real. Son comprobaciones distintas.</p></div>
      <button type="button" disabled={busy || blocked} onClick={verify}>{busy ? 'Comprobando en Meta…' : 'Verificar app y webhook'}</button></header>
    <div className={styles.checks}>{configuration.map(row => <article key={row.key} data-status={row.status}><strong>{LABELS[row.key][0]}</strong><span>{STATUS[row.status]}</span><p>{LABELS[row.key][1]}</p></article>)}</div>
    <p className={styles.scope}>Esta acción consulta únicamente la configuración. No regenera claves, no suscribe cuentas, no cambia el callback y no envía WhatsApp. La solicitud y sus códigos de resultado quedan auditados.</p>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {blocked && <p className={styles.scope}>Volvé a abrir Integraciones desde la obra autorizada antes de repetir la comprobación.</p>}
    {report && <div className={styles.results} aria-label="Resultado de la comprobación de plataforma">
      {[['Autenticación de la app',report.authentication],['Callback de WhatsApp',report.webhook]].map(([label,check]) => <article key={label} data-status={check.status}><h3>{label}</h3><strong>{STATUS[check.status]}</strong><p>{EXPLANATION[check.code]}</p></article>)}
      <p role="status" className={styles.disclaimer}>Comprobación finalizada. Este resultado no prueba entrega, recepción firmada, procesamiento del mensaje ni vinculación con la tarea.</p>
    </div>}
    <ol className={styles.steps} aria-label="Orden de puesta en marcha"><li>1 · Verificar la app</li><li>2 · Vincular la obra</li><li>3 · Probar recepción y respuesta</li><li>4 · Confirmar registro y tarea</li></ol>
  </section>;
}
