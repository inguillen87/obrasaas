'use client';
import { tokens } from '@/lib/design-system';
import { REPLY_STATUS_LABELS } from '@/lib/whatsapp/inbox-composer-book';
import styles from './inbox-composer-context.module.css';
export default function InboxComposerContext({ recipient, projectName, entry, notice, onDiscard, onCopy }) {
  const waiting = entry.sending || ['UNKNOWN', 'BLOCKED'].includes(entry.resolution);
  const style = { '--draft-bg': tokens.colors.bg.secondary, '--draft-border': tokens.colors.border.default,
    '--draft-text': tokens.colors.text.primary, '--draft-muted': tokens.colors.text.secondary,
    '--draft-accent': tokens.colors.accent.primary, '--draft-success': tokens.colors.accent.success };
  return <div className={styles.context} style={style} aria-label="Destinatario y continuidad de la respuesta">
    <div className={styles.recipient}><span>RESPONDER A</span><strong>{recipient}</strong><small>{projectName}</small></div>
    {entry.receipt && <p className={styles.receipt} data-final={['DELIVERED', 'READ'].includes(entry.receipt.status)} role="status">
      <strong>Ãšltimo envÃ­o Â· {REPLY_STATUS_LABELS[entry.receipt.status]}</strong>
      <span>{['ACCEPTED', 'SENT'].includes(entry.receipt.status) ? 'La entrega todavía no está confirmada.'
        : entry.receipt.status === 'FAILED' ? 'El texto no se pierde; un reenvío requiere confirmación.'
          : ['DELIVERED', 'READ'].includes(entry.receipt.status) ? 'Estado confirmado en el historial del canal.' : 'No envíes otra copia mientras se verifica este intento.'}</span>
    </p>}
    {(entry.draft || entry.attempt) && <div className={styles.retention}>
      <p><strong>{waiting ? 'Intento conservado para este contacto' : 'Borrador de esta conversación'}</strong><span>Podés cambiar de chat y volver. Sólo se conserva en esta pantalla; cerrar o recargar puede perder el texto.</span></p>
      <div className={styles.actions}><button type="button" onClick={onCopy} disabled={!entry.draft}>Copiar texto</button>
        <button type="button" onClick={onDiscard} disabled={waiting || Boolean(entry.attempt)}>Descartar borrador</button></div>
    </div>}
    {notice && <p className={styles.notice} role="status">{notice}</p>}
  </div>;
}
