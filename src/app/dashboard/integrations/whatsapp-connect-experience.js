'use client';
import { useState } from 'react';
import Link from 'next/link';
import { tokens } from '@/lib/design-system';
import styles from './whatsapp-connect-experience.module.css';
export default function WhatsAppConnectExperience({ companyName, projectName, internalWorkspace = false, linked, reconnectRequired, configured, sdkReady, pending, blocked, pin, onPinChange, onConnect, diagnostics, canReadInbox }) {
  const [preparing, setPreparing] = useState(false);
  const needsConnect = !internalWorkspace && (!linked || reconnectRequired);
  const inbound = Boolean(diagnostics?.lastSignedInboundAt);
  const outbound = Boolean(diagnostics?.lastConfirmedOutboundAt);
  const css = { '--connect-bg': tokens.colors.bg.secondary, '--connect-border': tokens.colors.border.default, '--connect-accent': tokens.colors.accent.primary, '--connect-muted': tokens.colors.text.secondary, '--connect-text': tokens.colors.text.primary };
  return <section className={styles.panel} style={css} aria-label="Conectar WhatsApp paso a paso">
    <header><span className={styles.eyebrow}>CONEXIÓN GUIADA</span><h2>{internalWorkspace ? 'Administración de canales de clientes' : needsConnect ? (reconnectRequired ? 'Recuperá el WhatsApp de esta obra' : 'Conectá el WhatsApp de tu empresa') : 'Tu número ya está vinculado'}</h2><p>{companyName} · {projectName}</p></header>
    {internalWorkspace && <p className={styles.notice}>Estás en la administración interna de ObraSaaS. Cada empresa autoriza su número desde su propio espacio. Para el ensayo, usá el destino piloto ya preparado en Administración técnica.</p>}
    <p className={styles.lead}>Vos autorizás la cuenta y elegís el número en Meta. ObraSaaS se encarga de validar y guardar la conexión. No tenés que copiar tokens ni claves de la app.</p>
    <ol className={styles.steps}>
      <li data-done={linked && !reconnectRequired}><b>1</b><div><strong>Autorizar en Meta</strong><span>Elegí la cuenta de tu empresa y verificá su número cuando Meta lo solicite.</span></div></li>
      <li data-done={linked}><b>2</b><div><strong>Vincular a la obra</strong><span>La conexión se guarda en el destino que estás viendo, no en otra empresa.</span></div></li>
      <li data-done={inbound && outbound}><b>3</b><div><strong>Comprobar una conversación</strong><span>{inbound ? 'Hay entrada registrada. ' : 'Falta recibir un mensaje en esta obra. '}{outbound ? 'Hay salida confirmada desde ObraSaaS.' : 'Falta confirmar la respuesta de ObraSaaS.'}</span></div></li>
    </ol>
    {needsConnect && !preparing && <button className={styles.primary} type="button" disabled={!configured || blocked || pending} onClick={() => setPreparing(true)}>{reconnectRequired ? 'Reconectar WhatsApp' : 'Conectar WhatsApp'}</button>}
    {needsConnect && preparing && <div className={styles.prepare}>
      <h3>Protegé el número antes de autorizar</h3><label>PIN de protección<input aria-label="PIN de protección" type="password" autoComplete="new-password" inputMode="numeric" maxLength={6} value={pin} disabled={pending || blocked} onChange={event => onPinChange(event.target.value.replace(/\D/g, '').slice(0, 6))} /></label>
      <p>Elegí 6 números y guardalos de forma segura. Es la protección del número en Meta, no la contraseña de Facebook ni el código que recibís por SMS. No se envía por el chat.</p>
      <div className={styles.actions}><button className={styles.primary} type="button" disabled={!configured || !sdkReady || blocked || pending || !/^\d{6}$/.test(pin)} onClick={onConnect}>{pending ? 'Completando autorización…' : 'Continuar en Meta'}</button><button type="button" disabled={pending} onClick={() => { setPreparing(false); onPinChange(''); }}>Volver</button></div>
    </div>}
    {needsConnect && !configured && <p role="status" className={styles.notice}>El alta con Meta todavía necesita una configuración de ObraSaaS. No es un error de tu empresa: no repitas el registro ni pegues credenciales. La administración de la plataforma debe completar la habilitación.</p>}
    {needsConnect && preparing && configured && !sdkReady && <p role="status">Cargando la ventana segura de Meta. Revisá el bloqueo de ventanas si no se abre.</p>}
    {!internalWorkspace && !needsConnect && canReadInbox && <Link className={styles.primary} href="/dashboard/inbox">Abrir conversaciones y revisar participantes</Link>}
    <p className={styles.boundary}>Un mensaje enviado desde la consola de Meta no acredita una respuesta del asistente. Para operar sobre una obra, el remitente debe tener acceso autorizado.</p>
  </section>;
}
