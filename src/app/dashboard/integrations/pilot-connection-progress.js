'use client';

import { tokens } from '@/lib/design-system';
import styles from './whatsapp-connect-experience.module.css';
export default function PilotConnectionProgress({ progress }) {
  if (!progress?.channels?.length) return null;
  return <section className={styles.panel} style={{ '--connect-bg': tokens.colors.bg.secondary, '--connect-border': tokens.colors.border.default, '--connect-accent': tokens.colors.accent.primary, '--connect-text': tokens.colors.text.primary, '--connect-muted': tokens.colors.text.secondary }} aria-label="Resultado real de las conexiones piloto">
    <header><span className={styles.eyebrow}>PILOTO · RESULTADO EN EL BACKEND</span><h2>El número ya tiene un destino</h2></header>
    <p className={styles.lead}>Estos canales pertenecen a las empresas piloto indicadas abajo. No a la obra de administración que aparece en el menú lateral. No los importes otra vez para probar la recepción.</p>
    {progress.channels.map((channel, index) => <article key={index} className={styles.prepare}>
      <h3>{channel.companyName}</h3><p>{channel.projectName} · {channel.displayPhoneNumber || 'Número vinculado'}</p>
      <ol className={styles.steps}>
        <li><b>1</b><div><strong>{channel.linked ? 'Conexión guardada' : 'Conexión requiere revisión'}</strong><span>El activo está asociado a este destino. Eso no equivale a una conversación operativa.</span></div></li>
        <li><b>2</b><div><strong>{channel.received === null ? 'Recepción sin verificar' : channel.received + ' mensajes recibidos en el backend'}</strong><span>{channel.awaitingParticipant > 0 ? channel.awaitingParticipant + ' mensajes ingresaron sin un participante reconocido. Revisá su vinculación actual; ese registro de entrada no concede permisos.' : 'El registro de entrada se comprueba por separado del permiso del participante.'}</span></div></li>
        <li><b>3</b><div><strong>{channel.outboundRecorded === null ? 'Salida sin verificar' : channel.outboundRecorded + ' envíos registrados por ObraSaaS'}</strong><span>No cuenta plantillas enviadas desde la consola de Meta y no certifica lectura por el destinatario.</span></div></li>
      </ol>
      {channel.awaitingParticipant > 0 && <p className={styles.notice}>Revisá la vinculación actual del remitente dentro de esta empresa antes de autorizar acciones. No se lo incorpora a nómina ni se le asigna un rol por haber escrito al número.</p>}
      {channel.state === 'unavailable' && <p role="status">No se pudo consultar el tráfico. No significa que no haya mensajes.</p>}
    </article>)}
    {progress.hasMore && <p>Se muestran las cinco conexiones modificadas más recientemente de los destinos autorizados.</p>}
  </section>;
}
