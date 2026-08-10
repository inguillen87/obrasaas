'use client';

import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import styles from './inbox.module.css';
import ContactOnboardingAction, {
  normalizeContactOnboarding,
} from './contact-onboarding-action';
import ProactiveFlowLauncher from './proactive-flow-launcher';

const DEFAULT_TIME_ZONE = 'America/Argentina/Buenos_Aires';
const DELIVERY_STATES = new Set([
  'PREPARED',
  'SENDING',
  'ACCEPTED',
  'SENT',
  'DELIVERED',
  'READ',
  'FAILED',
  'UNKNOWN',
]);
const UNRESOLVED_SEND_STATES = new Set(['SENDING', 'UNKNOWN']);
const ATTACHMENT_PRESENTATIONS = Object.freeze({
  image: { icon: 'fa-regular fa-image', label: 'Imagen' },
  audio: { icon: 'fa-solid fa-microphone', label: 'Audio' },
  video: { icon: 'fa-solid fa-video', label: 'Video' },
  document: { icon: 'fa-regular fa-file-lines', label: 'Documento' },
});
const MOBILE_INBOX_QUERY = '(max-width: 760px)';
const STICK_TO_BOTTOM_THRESHOLD = 96;
const CONVERSATION_PAGE_SIZE = 30;
const CONVERSATION_REFRESH_LIMIT = 80;
const MESSAGE_PAGE_SIZE = 60;
const TASK_STATUS_LABELS = Object.freeze({
  BACKLOG: 'Pendiente',
  READY: 'Lista',
  IN_PROGRESS: 'En curso',
  BLOCKED: 'Bloqueada',
  DONE: 'Finalizada',
});
const UNVERIFIED_COMPOSER_CAPABILITY = Object.freeze({
  allowed: false,
  code: 'CAPABILITY_UNAVAILABLE',
  reason: 'No pudimos verificar si esta obra permite enviar mensajes.',
});

function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function textValue(...values) {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const normalized = value.trim();
    if (normalized) return normalized;
  }
  return '';
}

function numberValue(...values) {
  for (const value of values) {
    const normalized = Number(value);
    if (Number.isFinite(normalized)) return normalized;
  }
  return null;
}

function safeDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function deliveryStatus(value) {
  const normalized = textValue(value).toUpperCase();
  return DELIVERY_STATES.has(normalized) ? normalized : 'UNKNOWN';
}

function normalizeDeliveryFailure(value) {
  const source = objectValue(value);
  const providerCode = typeof source.providerCode === 'number'
    ? source.providerCode
    : null;
  const title = textValue(source.title).slice(0, 120);
  const detail = textValue(source.detail).slice(0, 360);
  if (
    !Number.isSafeInteger(providerCode)
    || providerCode < 1
    || providerCode > 999_999
    || !title
    || !detail
  ) return null;
  return {
    providerCode,
    title,
    detail,
  };
}

function directionValue(value) {
  return textValue(value).toUpperCase() === 'OUTBOUND' ? 'OUTBOUND' : 'INBOUND';
}

function normalizeMessage(raw) {
  const source = objectValue(raw);
  const id = textValue(source.id, source.externalId, source.providerMessageId);
  if (!id) return null;
  const media = objectValue(source.media);
  const kind = textValue(source.kind, media.kind, 'text').toLowerCase();
  const hasMediaMetadata = Boolean(
    textValue(media.kind, media.mimeType, media.filename),
  );

  return {
    id,
    body: textValue(source.body, source.text, source.preview),
    direction: directionValue(source.direction),
    kind,
    media: hasMediaMetadata
      ? {
          kind: textValue(media.kind, kind).toLowerCase(),
          mimeType: textValue(media.mimeType),
          filename: textValue(media.filename),
        }
      : null,
    sentAt: source.sentAt || source.createdAt || source.timestamp || null,
    recordedAt: source.recordedAt || source.createdAt || source.sentAt || null,
    status: deliveryStatus(source.status || source.deliveryStatus),
    deliveryFailure: normalizeDeliveryFailure(source.deliveryFailure),
    sourceEvidenceViewable: source.sourceEvidenceViewable === true,
    progressEvidenceEligible: source.progressEvidenceEligible === true,
    progressEvidenceLinked: source.progressEvidenceLinked === true,
  };
}

function normalizeConversation(raw) {
  const source = objectValue(raw);
  const lastMessage = normalizeMessage(source.lastMessage || source.latestMessage || {});
  const id = textValue(source.id, source.conversationId);
  if (!id) return null;

  return {
    id,
    displayName: textValue(source.displayName, source.contactName, source.name),
    phone: textValue(source.phone, source.phoneNumber, source.externalId),
    unreadCount: Math.max(0, numberValue(source.unreadCount, source.unread) || 0),
    lastMessage,
    lastMessageAt: source.lastMessageAt
      || source.updatedAt
      || lastMessage?.sentAt
      || source.createdAt
      || null,
  };
}

function normalizeConnection(raw) {
  const source = objectValue(raw);
  const status = textValue(source.status, source.connectionStatus).toUpperCase() || 'NOT_CONNECTED';
  const operational = source.operational === true;

  return {
    operational,
    status,
    reason: textValue(source.reason),
    displayPhoneNumber: textValue(source.displayPhoneNumber, source.phoneNumber),
    verifiedBusinessName: textValue(source.verifiedBusinessName, source.businessName),
  };
}

function normalizeWindow(raw) {
  const source = objectValue(raw);
  const isOpen = source.isOpen === true;
  return {
    isOpen,
    expiresAt: source.expiresAt || null,
    remainingSeconds: Math.max(0, numberValue(source.remainingSeconds) || 0),
    reason: textValue(source.reason),
  };
}

function normalizeComposerCapability(raw) {
  const source = objectValue(raw);
  if (typeof source.allowed !== 'boolean') return null;
  return {
    allowed: source.allowed,
    reason: textValue(source.reason),
    code: textValue(source.code).toUpperCase(),
  };
}

function normalizeConversationList(payload) {
  const source = objectValue(payload);
  const conversations = Array.isArray(source.conversations) ? source.conversations : [];
  return conversations.map(normalizeConversation).filter(Boolean);
}

function normalizeMessageList(payload) {
  const source = objectValue(payload);
  const messages = Array.isArray(source.messages) ? source.messages : [];
  return messages
    .map(normalizeMessage)
    .filter(Boolean)
    .sort((left, right) => (
      (safeDate(left.recordedAt)?.getTime() || 0)
      - (safeDate(right.recordedAt)?.getTime() || 0)
      || left.id.localeCompare(right.id)
    ));
}

function normalizePageInfo(payload) {
  const source = objectValue(payload?.pageInfo);
  return {
    hasMore: source.hasMore === true,
    nextCursor: textValue(source.nextCursor),
  };
}

function mergeConversationPage(current, incoming, append) {
  const nextById = new Map(current.map((conversation) => [conversation.id, conversation]));
  for (const conversation of incoming) {
    nextById.set(conversation.id, {
      ...nextById.get(conversation.id),
      ...conversation,
    });
  }
  const orderedIds = append
    ? [...current.map((conversation) => conversation.id), ...incoming.map((conversation) => conversation.id)]
    : [...incoming.map((conversation) => conversation.id), ...current.map((conversation) => conversation.id)];
  return [...new Set(orderedIds)]
    .map((id) => nextById.get(id))
    .filter(Boolean);
}

function mergeMessagePage(current, incoming) {
  const nextById = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) nextById.set(message.id, message);
  return [...nextById.values()].sort((left, right) => (
    (safeDate(left.recordedAt)?.getTime() || 0)
    - (safeDate(right.recordedAt)?.getTime() || 0)
    || left.id.localeCompare(right.id)
  ));
}

function responseMessage(payload, fallback) {
  return textValue(payload?.error, payload?.message, fallback);
}

function safeErrorMessage(error, fallback) {
  const message = textValue(error?.message);
  if (!message || /failed to fetch|networkerror|load failed/i.test(message)) return fallback;
  return message;
}

async function readResponse(response, fallback) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(responseMessage(payload, fallback));
    error.status = response.status;
    error.code = textValue(payload?.code, payload?.outcome);
    throw error;
  }
  return payload;
}

function sendFailureResolution(error) {
  const code = textValue(error?.code).toUpperCase();
  if (code === 'WHATSAPP_SEND_REJECTED') return 'FAILED';
  if (code === 'WHATSAPP_DELIVERY_UNKNOWN') return 'UNKNOWN';
  if (Number(error?.status) >= 500 || error instanceof TypeError) return 'UNKNOWN';
  return '';
}

function createIdempotencyKey(prefix = 'inbox') {
  const suffix = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${suffix}`;
}

function contactLabel(conversation) {
  return conversation?.displayName || conversation?.phone || 'Contacto de WhatsApp';
}

function contactSecondary(conversation) {
  if (!conversation) return '';
  if (conversation.displayName && conversation.phone) return conversation.phone;
  return 'Canal WhatsApp';
}

function contactInitials(conversation) {
  const words = textValue(conversation?.displayName)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  return words.map((word) => word.charAt(0).toUpperCase()).join('');
}

function formatTime(value, timeZone) {
  const date = safeDate(value);
  if (!date) return '';
  return new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(date);
}

function formatConversationTime(value, timeZone, now) {
  const date = safeDate(value);
  if (!date) return '';
  const dateParts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone,
  });
  const todayKey = dateParts.format(now);
  const dateKey = dateParts.format(date);
  if (dateKey === todayKey) return formatTime(date, timeZone);

  const yesterday = new Date(now.getTime() - 86_400_000);
  if (dateKey === dateParts.format(yesterday)) return 'Ayer';
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
    timeZone,
  }).format(date);
}

function dayKey(value, timeZone) {
  const date = safeDate(value);
  if (!date) return 'unknown';
  return new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone,
  }).format(date);
}

function dayLabel(value, timeZone, now) {
  const date = safeDate(value);
  if (!date) return 'Sin fecha registrada';
  const key = dayKey(date, timeZone);
  if (key === dayKey(now, timeZone)) return 'Hoy';
  const yesterday = new Date(now.getTime() - 86_400_000);
  if (key === dayKey(yesterday, timeZone)) return 'Ayer';
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone,
  }).format(date);
}

function durationLabel(seconds) {
  const remaining = Math.max(0, Number(seconds) || 0);
  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  if (hours > 0) return `${hours} h ${minutes} min`;
  if (minutes > 0) return `${minutes} min`;
  return 'menos de 1 min';
}

function closedWindowDetail(reason) {
  const normalized = textValue(reason).toUpperCase();
  if (normalized === 'NO_INBOUND_MESSAGE') {
    return 'Todavía no hay un mensaje entrante que habilite una respuesta manual.';
  }
  if (normalized === 'EXPIRED') {
    return 'La ventana de 24 horas venció. El contacto debe volver a escribir para responder manualmente.';
  }
  if (normalized === 'INVALID_CLOCK') {
    return 'No pudimos validar el horario del último mensaje entrante.';
  }
  if (normalized && !normalized.includes('_')) return reason;
  return 'El contacto debe volver a escribir para habilitar una respuesta manual.';
}

function windowPresentation(windowState, now) {
  const expiresAt = safeDate(windowState?.expiresAt);
  const isOpen = Boolean(windowState?.isOpen)
    && (expiresAt
      ? expiresAt.getTime() > now.getTime()
      : Number(windowState?.remainingSeconds) > 0);

  if (!isOpen) {
    return {
      isOpen: false,
      label: 'Ventana cerrada',
      detail: closedWindowDetail(
        windowState?.isOpen && expiresAt ? 'EXPIRED' : windowState?.reason,
      ),
      tone: 'closed',
    };
  }

  const seconds = expiresAt
    ? Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1_000))
    : windowState.remainingSeconds;
  return {
    isOpen: true,
    label: 'Ventana abierta',
    detail: `Respuesta manual disponible por ${durationLabel(seconds)}.`,
    tone: 'open',
  };
}

function connectionPresentation(connection) {
  if (connection.operational) {
    return {
      label: 'Mensajería habilitada',
      detail: connection.verifiedBusinessName
        || connection.displayPhoneNumber
        || 'Conexión verificada para esta obra',
      tone: 'connected',
    };
  }

  return {
    label: 'Canal no disponible',
    detail: connection.reason === 'PLATFORM_CONFIGURATION_INCOMPLETE'
      ? 'La configuración segura de Meta todavía está incompleta.'
      : connection.status === 'PENDING'
        ? 'La conexión todavía está pendiente de verificación.'
        : 'Conectá un activo de WhatsApp antes de responder.',
    tone: 'disconnected',
  };
}

function deliveryPresentation(status) {
  const normalized = deliveryStatus(status);
  return {
    PREPARED: { icon: 'fa-regular fa-clock', label: 'En cola' },
    SENDING: { icon: 'fa-regular fa-clock', label: 'Enviando' },
    ACCEPTED: { icon: 'fa-solid fa-check', label: 'Aceptado por Meta' },
    SENT: { icon: 'fa-solid fa-check', label: 'Enviado' },
    DELIVERED: { icon: 'fa-solid fa-check-double', label: 'Entregado' },
    READ: { icon: 'fa-solid fa-check-double', label: 'Leído' },
    FAILED: { icon: 'fa-solid fa-circle-exclamation', label: 'Falló' },
    UNKNOWN: { icon: 'fa-regular fa-clock', label: 'Sin confirmar' },
  }[normalized];
}

function DeliveryState({ status, compact = false }) {
  const normalized = deliveryStatus(status);
  const presentation = deliveryPresentation(normalized);

  return (
    <span
      className={styles.deliveryState}
      data-status={normalized.toLowerCase()}
      title={presentation.label}
    >
      <i className={presentation.icon} aria-hidden="true" />
      {compact ? (
        <span className={styles.srOnly}>{presentation.label}</span>
      ) : (
        <span className={styles.deliveryLabel}>{presentation.label}</span>
      )}
    </span>
  );
}

function attachmentPresentation(message) {
  const kind = textValue(message?.media?.kind, message?.kind).toLowerCase();
  const presentation = ATTACHMENT_PRESENTATIONS[kind];
  return presentation ? { ...presentation, kind } : null;
}

function AttachmentCard({ canOpenSourceEvidence = false, message }) {
  const presentation = attachmentPresentation(message);
  if (!presentation) return null;

  const filename = textValue(message?.media?.filename);
  const mimeType = textValue(message?.media?.mimeType);
  const restricted = !message?.media;

  return (
    <div className={styles.attachmentCard} aria-label={`Adjunto protegido: ${presentation.label}`}>
      <span className={styles.attachmentIcon} aria-hidden="true">
        <i className={presentation.icon} />
      </span>
      <span className={styles.attachmentCopy}>
        <strong>{filename || `Adjunto protegido · ${presentation.label}`}</strong>
        <small>
          {restricted
            ? 'Contenido restringido en esta bandeja'
            : mimeType || 'Adjunto protegido sin enlace directo'}
        </small>
      </span>
      {canOpenSourceEvidence && message.sourceEvidenceViewable ? (
        <a
          className={styles.attachmentOpenLink}
          href={`/api/evidence/${encodeURIComponent(message.id)}?preview=1`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" />
          <span>Abrir</span>
          <span className={styles.srOnly}> {presentation.label.toLowerCase()} protegida</span>
        </a>
      ) : (
        <i className={`fa-solid fa-shield-halved ${styles.attachmentShield}`} aria-hidden="true" />
      )}
    </div>
  );
}

function DeliveryFailure({ failure }) {
  if (!failure) return null;
  return (
    <aside className={styles.deliveryFailure} aria-label="Detalle del rechazo de Meta">
      <span aria-hidden="true"><i className="fa-solid fa-triangle-exclamation" /></span>
      <div>
        <strong>{failure.title}</strong>
        <small>{failure.detail}</small>
      </div>
      <code>Meta {failure.providerCode}</code>
    </aside>
  );
}

function canonicalTaskLabel(task) {
  const code = textValue(task?.code);
  const title = textValue(task?.title, 'Tarea sin título');
  const status = TASK_STATUS_LABELS[textValue(task?.status).toUpperCase()] || 'Estado sin confirmar';
  return `${code ? `${code} · ` : ''}${title} — ${status}`;
}

function ProgressEvidenceLinkedState() {
  return (
    <div className={styles.progressEvidenceLinked} role="status">
      <span aria-hidden="true"><i className="fa-solid fa-circle-check" /></span>
      <div>
        <strong>Foto ya incorporada al avance</strong>
        <small>
          El vínculo está confirmado. No hace falta reenviarla ni crear otra evidencia.
        </small>
      </div>
    </div>
  );
}

function ProgressEvidenceAction({
  conversationId,
  message,
  online,
  projectId,
  tasks,
}) {
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [linkState, setLinkState] = useState({ tone: 'idle', message: '' });
  const attemptRef = useRef(null);
  const requestPendingRef = useRef(false);
  const confirmedRef = useRef(false);
  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) || null,
    [selectedTaskId, tasks],
  );
  const pending = linkState.tone === 'pending';
  const confirmed = linkState.tone === 'success' || linkState.tone === 'replay';

  function changeTask(event) {
    if (pending || confirmed) return;
    setSelectedTaskId(event.target.value);
    attemptRef.current = null;
    setLinkState({ tone: 'idle', message: '' });
  }

  async function linkEvidence(event) {
    event.preventDefault();
    if (
      requestPendingRef.current
      || confirmedRef.current
      || !online
      || !selectedTask
    ) {
      return;
    }

    const attempt = attemptRef.current?.taskId === selectedTask.id
      ? attemptRef.current
      : {
          taskId: selectedTask.id,
          idempotencyKey: createIdempotencyKey('progress-evidence'),
        };
    attemptRef.current = attempt;
    requestPendingRef.current = true;
    setLinkState({ tone: 'pending', message: 'Vinculando la foto con la tarea…' });

    try {
      const response = await fetch(
        `/api/whatsapp/inbox/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(message.id)}/progress-evidence?projectId=${encodeURIComponent(projectId)}`,
        {
          method: 'POST',
          cache: 'no-store',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'Idempotency-Key': attempt.idempotencyKey,
          },
          body: JSON.stringify({
            projectId,
            taskId: selectedTask.id,
          }),
        },
      );
      const payload = await readResponse(
        response,
        'No pudimos confirmar el vínculo. Reintentá para consultar la misma operación segura.',
      );
      confirmedRef.current = true;
      setLinkState(payload.replayed === true
        ? {
            tone: 'replay',
            message: `El vínculo con “${selectedTask.title}” ya estaba confirmado. No se creó un duplicado.`,
          }
        : {
            tone: 'success',
            message: `Foto vinculada a “${selectedTask.title}”. Quedó pendiente de revisión en Progreso.`,
          });
    } catch (error) {
      setLinkState({
        tone: 'error',
        message: safeErrorMessage(
          error,
          'No pudimos confirmar el vínculo. Reintentá para consultar la misma operación segura.',
        ),
      });
    } finally {
      requestPendingRef.current = false;
    }
  }

  return (
    <form className={styles.progressEvidenceAction} onSubmit={linkEvidence}>
      <header>
        <span aria-hidden="true"><i className="fa-solid fa-link" /></span>
        <div>
          <strong>Incorporar al avance de obra</strong>
          <small>Elegí la tarea canónica. La foto no modifica el Gantt automáticamente.</small>
        </div>
      </header>

      {tasks.length > 0 ? (
        <div className={styles.progressEvidenceControls}>
          <label>
            <span>Tarea canónica</span>
            <select
              value={selectedTaskId}
              onChange={changeTask}
              disabled={pending || confirmed}
              aria-label="Tarea canónica para la evidencia"
            >
              <option value="">Seleccionar tarea…</option>
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>{canonicalTaskLabel(task)}</option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={!online || !selectedTask || pending || confirmed}
          >
            <i
              className={pending
                ? 'fa-solid fa-circle-notch fa-spin'
                : confirmed
                  ? 'fa-solid fa-check'
                  : 'fa-solid fa-link'}
              aria-hidden="true"
            />
            {pending
              ? 'Vinculando…'
              : confirmed
                ? 'Evidencia vinculada'
                : linkState.tone === 'error'
                  ? 'Reintentar vínculo'
                  : 'Vincular evidencia'}
          </button>
        </div>
      ) : (
        <p className={styles.progressEvidenceEmpty}>
          Primero creá una tarea canónica en Ejecución para poder clasificar esta evidencia.
        </p>
      )}

      {!online && !confirmed && (
        <p className={styles.progressEvidenceOffline}>Conectate a internet para guardar el vínculo.</p>
      )}
      {linkState.message && (
        <p
          className={styles.progressEvidenceState}
          data-tone={linkState.tone}
          role={linkState.tone === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          <i
            className={linkState.tone === 'error'
              ? 'fa-solid fa-circle-exclamation'
              : linkState.tone === 'pending'
                ? 'fa-regular fa-clock'
                : 'fa-solid fa-circle-check'}
            aria-hidden="true"
          />
          <span>{linkState.message}</span>
        </p>
      )}
    </form>
  );
}

function Avatar({ conversation, large = false }) {
  const initials = contactInitials(conversation);
  return (
    <span className={`${styles.avatar} ${large ? styles.avatarLarge : ''}`} aria-hidden="true">
      {initials || <i className="fa-regular fa-user" />}
    </span>
  );
}

function LoadingWorkspace() {
  return (
    <section className={styles.loadingWorkspace} aria-busy="true" aria-live="polite">
      <div className={styles.loadingSidebar} aria-hidden="true">
        <div className={`${styles.skeleton} ${styles.loadingSearch}`} />
        {Array.from({ length: 5 }, (_, index) => (
          <div className={styles.loadingConversation} key={index}>
            <span className={`${styles.skeleton} ${styles.loadingAvatar}`} />
            <div>
              <span className={`${styles.skeleton} ${styles.loadingLine}`} />
              <span className={`${styles.skeleton} ${styles.loadingLineShort}`} />
            </div>
          </div>
        ))}
      </div>
      <div className={styles.loadingDetail} aria-hidden="true">
        <div className={`${styles.skeleton} ${styles.loadingDetailHeader}`} />
        <div className={`${styles.skeleton} ${styles.loadingBubbleInbound}`} />
        <div className={`${styles.skeleton} ${styles.loadingBubbleOutbound}`} />
        <div className={`${styles.skeleton} ${styles.loadingComposer}`} />
      </div>
      <span className={styles.srOnly}>Cargando conversaciones de WhatsApp.</span>
    </section>
  );
}

export default function InboxClient({
  canLinkProgressEvidence = false,
  canManageIntegrations = false,
  canManageOnboarding = false,
  canViewSourceEvidence = false,
  organizationName,
  projectId,
  projectName,
  progressEvidenceTasks = [],
  timeZone = DEFAULT_TIME_ZONE,
}) {
  const [conversations, setConversations] = useState([]);
  const [connection, setConnection] = useState(() => normalizeConnection(null));
  const [selectedId, setSelectedId] = useState('');
  const [loadedConversationId, setLoadedConversationId] = useState('');
  const [messages, setMessages] = useState([]);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [conversationPageInfo, setConversationPageInfo] = useState(() => normalizePageInfo(null));
  const [messagePageInfo, setMessagePageInfo] = useState(() => normalizePageInfo(null));
  const [windowState, setWindowState] = useState(() => normalizeWindow(null));
  const [composerCapability, setComposerCapability] = useState(null);
  const [contactOnboarding, setContactOnboarding] = useState(() => (
    normalizeContactOnboarding(null)
  ));
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [messageLoading, setMessageLoading] = useState(false);
  const [loadingMoreConversations, setLoadingMoreConversations] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [messageError, setMessageError] = useState('');
  const [historyPageError, setHistoryPageError] = useState('');
  const [readStateError, setReadStateError] = useState('');
  const [sendError, setSendError] = useState('');
  const [sendResolution, setSendResolution] = useState('');
  const [messageAnnouncement, setMessageAnnouncement] = useState({ id: 'initial', text: '' });
  const [online, setOnline] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [historyAtBottom, setHistoryAtBottom] = useState(true);

  const listRequestRef = useRef(null);
  const messageRequestRef = useRef(null);
  const readStateAbortRef = useRef(null);
  const failedReadTargetRef = useRef(null);
  const draftKeyRef = useRef(createIdempotencyKey());
  const unresolvedSendRef = useRef(null);
  const knownMessageIdsRef = useRef(new Set());
  const knownMessageStatusRef = useRef(new Map());
  const shouldStickToBottomRef = useRef(true);
  const preserveHistoryScrollRef = useRef(null);
  const readThroughByConversationRef = useRef(new Map());
  const conversationCountRef = useRef(0);
  const conversationsRef = useRef([]);
  const conversationPageInfoRef = useRef(normalizePageInfo(null));
  const messagePageInfoRef = useRef(normalizePageInfo(null));
  const messageHistoryRef = useRef(null);
  const mobileDetailHeadingRef = useRef(null);
  const conversationButtonRefs = useRef(new Map());
  const restoreConversationFocusRef = useRef('');
  const selectedConversationIdRef = useRef('');

  const selectedConversation = useMemo(() => (
    conversations.find((conversation) => conversation.id === selectedId) || null
  ), [conversations, selectedId]);
  const selectedConversationId = selectedConversation?.id || '';

  useLayoutEffect(() => {
    selectedConversationIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  const filteredConversations = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('es');
    if (!needle) return conversations;
    return conversations.filter((conversation) => [
      conversation.displayName,
      conversation.phone,
      conversation.lastMessage?.body,
    ].some((value) => String(value || '').toLocaleLowerCase('es').includes(needle)));
  }, [conversations, query]);

  const connectedState = connectionPresentation(connection);
  const replyWindow = windowPresentation(windowState, now);
  const locallyReadyToCompose = online
    && connection.operational
    && Boolean(selectedConversation)
    && loadedConversationId === selectedId
    && !messageLoading
    && replyWindow.isOpen;
  const canCompose = locallyReadyToCompose && composerCapability?.allowed === true;
  const canSubmit = canCompose && !sendResolution;

  useEffect(() => {
    conversationsRef.current = conversations;
    conversationCountRef.current = conversations.length;
  }, [conversations]);

  const loadInbox = useCallback(async ({ initial = false, append = false } = {}) => {
    const mode = initial ? 'initial' : append ? 'append' : 'refresh';
    const cursor = append ? conversationPageInfoRef.current.nextCursor : '';
    if (append && !cursor) return;
    if (listRequestRef.current) {
      if (!initial) return;
      listRequestRef.current.controller.abort();
      if (listRequestRef.current.mode === 'append') setLoadingMoreConversations(false);
      if (listRequestRef.current.mode === 'refresh') setRefreshing(false);
    }
    const controller = new AbortController();
    listRequestRef.current = { controller, mode };
    if (initial) {
      const emptyPage = normalizePageInfo(null);
      conversationsRef.current = [];
      conversationCountRef.current = 0;
      conversationPageInfoRef.current = emptyPage;
      readThroughByConversationRef.current = new Map();
      failedReadTargetRef.current = null;
      setConversations([]);
      setSelectedId('');
      setUnreadTotal(0);
      setConversationPageInfo(emptyPage);
      setLoading(true);
    } else if (append) {
      setLoadingMoreConversations(true);
    } else {
      setRefreshing(true);
    }
    setLoadError('');

    try {
      const params = new URLSearchParams({
        projectId,
        limit: String(append
          ? CONVERSATION_PAGE_SIZE
          : Math.max(
              CONVERSATION_PAGE_SIZE,
              Math.min(
                CONVERSATION_REFRESH_LIMIT,
                conversationCountRef.current || CONVERSATION_PAGE_SIZE,
              ),
            )),
      });
      if (cursor) params.set('cursor', cursor);
      const response = await fetch(
        `/api/whatsapp/inbox?${params.toString()}`,
        {
          headers: { Accept: 'application/json' },
          cache: 'no-store',
          signal: controller.signal,
        },
      );
      const payload = await readResponse(
        response,
        'No pudimos consultar las conversaciones de esta obra.',
      );
      const nextConversations = normalizeConversationList(payload);
      const nextPageInfo = normalizePageInfo(payload);
      setConnection(normalizeConnection(payload.connection));
      setUnreadTotal(Math.max(0, numberValue(payload.unreadTotal) || 0));
      if (
        initial
        || append
        || conversationCountRef.current <= CONVERSATION_REFRESH_LIMIT
      ) {
        setConversationPageInfo(nextPageInfo);
        conversationPageInfoRef.current = nextPageInfo;
      }
      const mergedConversations = mergeConversationPage(
        initial ? [] : conversationsRef.current,
        nextConversations,
        append,
      );
      conversationsRef.current = mergedConversations;
      conversationCountRef.current = mergedConversations.length;
      setConversations(mergedConversations);
      setSelectedId((current) => (
        mergedConversations.some((conversation) => conversation.id === current)
          ? current
          : mergedConversations[0]?.id || ''
      ));
      setNow(new Date());
    } catch (error) {
      if (error.name !== 'AbortError') {
        setLoadError(safeErrorMessage(
          error,
          'No pudimos consultar las conversaciones de esta obra.',
        ));
      }
    } finally {
      if (listRequestRef.current?.controller === controller) {
        listRequestRef.current = null;
        if (initial) setLoading(false);
        else if (append) setLoadingMoreConversations(false);
        else setRefreshing(false);
      }
    }
  }, [projectId]);

  const loadMessages = useCallback(async (conversationId, { mode = 'replace' } = {}) => {
    if (!conversationId) return;
    const loadingOlder = mode === 'older';
    const refreshingMessages = mode === 'refresh';
    const cursor = loadingOlder ? messagePageInfoRef.current.nextCursor : '';
    if (loadingOlder && !cursor) return;
    const activeRequest = messageRequestRef.current;
    if (activeRequest) {
      const shouldSupersede = mode === 'replace'
        || (loadingOlder && activeRequest.mode === 'refresh');
      if (!shouldSupersede) return;
      activeRequest.controller.abort();
      if (activeRequest.mode === 'older') {
        preserveHistoryScrollRef.current = null;
        setLoadingOlderMessages(false);
      }
    }
    const controller = new AbortController();
    messageRequestRef.current = { controller, conversationId, mode };
    if (loadingOlder) {
      setLoadingOlderMessages(true);
      setHistoryPageError('');
    } else if (!refreshingMessages) {
      setLoadedConversationId('');
      setMessageLoading(true);
      setMessageError('');
      setComposerCapability(null);
    }

    try {
      const params = new URLSearchParams({
        projectId,
        limit: String(MESSAGE_PAGE_SIZE),
      });
      if (cursor) params.set('before', cursor);
      const response = await fetch(
        `/api/whatsapp/inbox/${encodeURIComponent(conversationId)}/messages?${params.toString()}`,
        {
          headers: { Accept: 'application/json' },
          cache: 'no-store',
          signal: controller.signal,
        },
      );
      const payload = await readResponse(
        response,
        'No pudimos consultar los mensajes de esta conversación.',
      );
      const detailConversation = normalizeConversation(payload.conversation);
      const nextMessages = normalizeMessageList(payload);
      const nextPageInfo = normalizePageInfo(payload);
      const nextOnboarding = normalizeContactOnboarding(payload.onboarding);
      const previousIds = knownMessageIdsRef.current;
      const previousStatuses = knownMessageStatusRef.current;
      const additions = refreshingMessages
        ? nextMessages.filter((message) => !previousIds.has(message.id))
        : [];
      const statusChanges = refreshingMessages
        ? nextMessages.filter((message) => (
            previousStatuses.has(message.id)
            && previousStatuses.get(message.id) !== message.status
          ))
        : [];
      knownMessageIdsRef.current = loadingOlder || refreshingMessages
        ? new Set([...previousIds, ...nextMessages.map((message) => message.id)])
        : new Set(nextMessages.map((message) => message.id));
      knownMessageStatusRef.current = new Map([
        ...(loadingOlder || refreshingMessages ? previousStatuses : new Map()),
        ...nextMessages.map((message) => [message.id, message.status]),
      ]);
      const history = messageHistoryRef.current;
      const isNearBottom = history
        ? history.scrollHeight - history.scrollTop - history.clientHeight
          <= STICK_TO_BOTTOM_THRESHOLD
        : true;
      if (loadingOlder && history) {
        preserveHistoryScrollRef.current = {
          height: history.scrollHeight,
          top: history.scrollTop,
        };
      }
      shouldStickToBottomRef.current = loadingOlder
        ? false
        : !refreshingMessages || isNearBottom;
      setMessages((current) => (
        loadingOlder || refreshingMessages
          ? mergeMessagePage(current, nextMessages)
          : nextMessages
      ));
      setMessageError('');
      setHistoryPageError('');
      setComposerCapability(
        normalizeComposerCapability(payload.composerCapability)
          || UNVERIFIED_COMPOSER_CAPABILITY,
      );
      if (!loadingOlder) setContactOnboarding(nextOnboarding);
      if (additions.length > 0) {
        const latestAddition = additions[additions.length - 1];
        const inboundCount = additions.filter((message) => message.direction === 'INBOUND').length;
        setMessageAnnouncement({
          id: latestAddition.id,
          text: inboundCount > 0
            ? `${inboundCount} ${inboundCount === 1 ? 'mensaje nuevo' : 'mensajes nuevos'} en esta conversación.`
            : 'Se actualizó el estado de la conversación.',
        });
      } else if (statusChanges.length > 0) {
        const latestChange = statusChanges[statusChanges.length - 1];
        setMessageAnnouncement({
          id: `${latestChange.id}-${latestChange.status}`,
          text: `Estado de entrega actualizado: ${deliveryPresentation(latestChange.status).label}.`,
        });
      } else if (loadingOlder && nextMessages.length > 0) {
        setMessageAnnouncement({
          id: `older-${nextMessages[0].id}`,
          text: `${nextMessages.length} ${nextMessages.length === 1 ? 'mensaje anterior cargado' : 'mensajes anteriores cargados'}.`,
        });
      }
      setWindowState(normalizeWindow(payload.window));
      setLoadedConversationId(conversationId);
      if (!loadingOlder) {
        setConversations((current) => {
          const nextConversations = current.map((conversation) => (
            detailConversation?.id === conversation.id
              ? { ...conversation, ...detailConversation }
              : conversation
          ));
          conversationsRef.current = nextConversations;
          conversationCountRef.current = nextConversations.length;
          return nextConversations;
        });
      }
      if (!refreshingMessages) {
        setMessagePageInfo(nextPageInfo);
        messagePageInfoRef.current = nextPageInfo;
      }
      setNow(new Date());
      return nextOnboarding;
    } catch (error) {
      if (error.name !== 'AbortError') {
        const safeMessage = safeErrorMessage(
          error,
          loadingOlder
            ? 'No pudimos cargar mensajes anteriores.'
            : 'No pudimos consultar los mensajes de esta conversación.',
        );
        if (loadingOlder) setHistoryPageError(safeMessage);
        else if (!refreshingMessages) setMessageError(safeMessage);
      }
      return null;
    } finally {
      if (messageRequestRef.current?.controller === controller) {
        messageRequestRef.current = null;
        if (loadingOlder) setLoadingOlderMessages(false);
        else if (!refreshingMessages) setMessageLoading(false);
      }
    }
  }, [projectId]);

  const markConversationRead = useCallback(async (conversationId, throughMessageId) => {
    if (!conversationId || !throughMessageId) return;
    if (readThroughByConversationRef.current.get(conversationId) === throughMessageId) return;
    readStateAbortRef.current?.abort();
    const controller = new AbortController();
    readStateAbortRef.current = controller;

    try {
      const response = await fetch(
        `/api/whatsapp/inbox/${encodeURIComponent(conversationId)}/read-state?projectId=${encodeURIComponent(projectId)}`,
        {
          method: 'PUT',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ projectId, throughMessageId }),
          signal: controller.signal,
        },
      );
      const payload = await readResponse(
        response,
        'No pudimos confirmar la lectura de esta conversación.',
      );
      const confirmedMessageId = textValue(payload?.readThrough?.messageId, throughMessageId);
      readThroughByConversationRef.current.set(conversationId, confirmedMessageId);
      const nextUnreadCount = Math.max(0, numberValue(payload.unreadCount) || 0);
      setConversations((current) => {
        const nextConversations = current.map((conversation) => (
          conversation.id === conversationId
            ? { ...conversation, unreadCount: nextUnreadCount }
            : conversation
        ));
        conversationsRef.current = nextConversations;
        conversationCountRef.current = nextConversations.length;
        return nextConversations;
      });
      const nextUnreadTotal = numberValue(payload.unreadTotal);
      if (nextUnreadTotal != null) setUnreadTotal(Math.max(0, nextUnreadTotal));
      failedReadTargetRef.current = null;
      setReadStateError('');
    } catch (error) {
      if (error.name !== 'AbortError') {
        failedReadTargetRef.current = { conversationId, throughMessageId };
        setReadStateError(safeErrorMessage(
          error,
          'No pudimos confirmar la lectura. Los mensajes seguirán marcados como pendientes.',
        ));
      }
    } finally {
      if (readStateAbortRef.current === controller) readStateAbortRef.current = null;
    }
  }, [projectId]);

  const abortAllRequests = useCallback(() => {
    const listRequest = listRequestRef.current;
    const messageRequest = messageRequestRef.current;
    const readStateRequest = readStateAbortRef.current;
    listRequestRef.current = null;
    messageRequestRef.current = null;
    readStateAbortRef.current = null;
    listRequest?.controller.abort();
    messageRequest?.controller.abort();
    readStateRequest?.abort();
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void loadInbox({ initial: true });
    });
    return () => {
      window.cancelAnimationFrame(frame);
      abortAllRequests();
    };
  }, [abortAllRequests, loadInbox]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (!selectedId) {
        unresolvedSendRef.current = null;
        setMessages([]);
        setWindowState(normalizeWindow(null));
        setComposerCapability(null);
        setContactOnboarding(normalizeContactOnboarding(null));
        setLoadedConversationId('');
        setMessagePageInfo(normalizePageInfo(null));
        messagePageInfoRef.current = normalizePageInfo(null);
        knownMessageIdsRef.current = new Set();
        knownMessageStatusRef.current = new Map();
        return;
      }
      readStateAbortRef.current?.abort();
      unresolvedSendRef.current = null;
      setDraft('');
      setSendError('');
      setSendResolution('');
      setReadStateError('');
      failedReadTargetRef.current = null;
      setHistoryPageError('');
      setComposerCapability(null);
      setContactOnboarding(normalizeContactOnboarding(null));
      setMessageAnnouncement({ id: `conversation-${selectedId}`, text: '' });
      knownMessageIdsRef.current = new Set();
      knownMessageStatusRef.current = new Map();
      shouldStickToBottomRef.current = true;
      preserveHistoryScrollRef.current = null;
      setHistoryAtBottom(true);
      setMessagePageInfo(normalizePageInfo(null));
      messagePageInfoRef.current = normalizePageInfo(null);
      draftKeyRef.current = createIdempotencyKey();
      void loadMessages(selectedId);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loadMessages, selectedId]);

  useEffect(() => {
    const updateOnline = () => setOnline(window.navigator.onLine);
    updateOnline();
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, []);

  useEffect(() => {
    if (sendResolution !== 'UNKNOWN') return;
    const unresolved = unresolvedSendRef.current;
    if (!unresolved?.messageId || unresolved.conversationId !== selectedId) return;
    const reconciled = messages.find((message) => message.id === unresolved.messageId);
    if (!reconciled || UNRESOLVED_SEND_STATES.has(reconciled.status)) return;

    unresolvedSendRef.current = null;
    draftKeyRef.current = createIdempotencyKey();
    if (reconciled.status === 'FAILED') {
      setSendResolution('FAILED');
      setSendError(
        'Meta confirmó que este intento falló. El borrador se conservó y podés enviarlo como una operación nueva.',
      );
      return;
    }

    setSendResolution('');
    setSendError('');
    if (draft.trim() === unresolved.body) setDraft('');
  }, [draft, messages, selectedId, sendResolution]);

  useEffect(() => {
    if (!online) return undefined;
    const refreshInterval = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void loadInbox();
      if (selectedId) void loadMessages(selectedId, { mode: 'refresh' });
    }, 20_000);
    return () => window.clearInterval(refreshInterval);
  }, [loadInbox, loadMessages, online, selectedId]);

  useEffect(() => {
    const refreshWhenAvailable = () => {
      if (!window.navigator.onLine || document.visibilityState !== 'visible') return;
      void loadInbox();
      if (selectedId) void loadMessages(selectedId, { mode: 'refresh' });
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refreshWhenAvailable();
    };
    window.addEventListener('online', refreshWhenAvailable);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('online', refreshWhenAvailable);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [loadInbox, loadMessages, selectedId]);

  useEffect(() => {
    const clock = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(clock);
  }, []);

  useEffect(() => {
    if (messageLoading) return;
    const history = messageHistoryRef.current;
    if (!history) return;
    const preserved = preserveHistoryScrollRef.current;
    if (preserved) {
      history.scrollTop = history.scrollHeight - preserved.height + preserved.top;
      preserveHistoryScrollRef.current = null;
    } else if (shouldStickToBottomRef.current) {
      history.scrollTop = history.scrollHeight;
    }
    shouldStickToBottomRef.current = false;
    const distance = history.scrollHeight - history.scrollTop - history.clientHeight;
    setHistoryAtBottom(distance <= STICK_TO_BOTTOM_THRESHOLD);
  }, [messageLoading, messages]);

  useEffect(() => {
    if (
      !online
      || !historyAtBottom
      || loadedConversationId !== selectedId
      || !selectedConversation
      || messages.length === 0
      || document.visibilityState !== 'visible'
    ) return undefined;
    if (window.matchMedia(MOBILE_INBOX_QUERY).matches && !mobileDetailOpen) {
      return undefined;
    }
    const latestMessage = messages[messages.length - 1];
    if (
      readThroughByConversationRef.current.get(selectedConversation.id)
      === latestMessage.id
    ) return undefined;
    const frame = window.requestAnimationFrame(() => {
      void markConversationRead(selectedConversation.id, latestMessage.id);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    historyAtBottom,
    loadedConversationId,
    markConversationRead,
    messages,
    mobileDetailOpen,
    online,
    selectedConversation,
    selectedId,
  ]);

  useEffect(() => {
    if (!mobileDetailOpen || !selectedConversationId) return undefined;
    if (!window.matchMedia(MOBILE_INBOX_QUERY).matches) return undefined;
    const frame = window.requestAnimationFrame(() => {
      mobileDetailHeadingRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [mobileDetailOpen, selectedConversationId]);

  useEffect(() => {
    if (mobileDetailOpen || !restoreConversationFocusRef.current) return undefined;
    const conversationId = restoreConversationFocusRef.current;
    restoreConversationFocusRef.current = '';
    const frame = window.requestAnimationFrame(() => {
      conversationButtonRefs.current.get(conversationId)?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [mobileDetailOpen]);

  function selectConversation(conversationId) {
    setSelectedId(conversationId);
    setMobileDetailOpen(true);
  }

  function closeMobileDetail() {
    restoreConversationFocusRef.current = selectedId;
    setMobileDetailOpen(false);
  }

  function handleConversationKeyDown(event, conversationId) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const ids = filteredConversations.map((conversation) => conversation.id);
    const currentIndex = ids.indexOf(conversationId);
    if (currentIndex < 0 || ids.length === 0) return;
    event.preventDefault();
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? ids.length - 1
        : event.key === 'ArrowDown'
          ? Math.min(ids.length - 1, currentIndex + 1)
          : Math.max(0, currentIndex - 1);
    conversationButtonRefs.current.get(ids[nextIndex])?.focus();
  }

  function handleHistoryScroll(event) {
    const history = event.currentTarget;
    const distance = history.scrollHeight - history.scrollTop - history.clientHeight;
    setHistoryAtBottom(distance <= STICK_TO_BOTTOM_THRESHOLD);
  }

  function scrollToLatestMessage() {
    const history = messageHistoryRef.current;
    if (!history) return;
    history.scrollTo({
      top: history.scrollHeight,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
    });
  }

  function retryReadState() {
    const failedTarget = failedReadTargetRef.current;
    if (!failedTarget || failedTarget.conversationId !== selectedConversation?.id) return;
    void markConversationRead(failedTarget.conversationId, failedTarget.throughMessageId);
  }

  function updateDraft(value) {
    if (sendError && !sendResolution) {
      setSendError('');
    }
    setDraft(value);
  }

  function sendMessage(event) {
    event.preventDefault();
    void submitMessage();
  }

  async function submitMessage({ asNewAttempt = false, reconcileUnknown = false } = {}) {
    const pendingAttempt = reconcileUnknown ? unresolvedSendRef.current : null;
    const body = pendingAttempt?.conversationId === selectedConversation?.id
      ? pendingAttempt.body
      : draft.trim();
    if (
      !body
      || !selectedConversation
      || sending
      || (!reconcileUnknown && !canCompose)
      || (reconcileUnknown && (!online || !pendingAttempt))
    ) return;
    if (sendResolution === 'UNKNOWN' && !reconcileUnknown) return;
    if (sendResolution === 'FAILED' && !asNewAttempt) return;

    const idempotencyKey = reconcileUnknown
      ? pendingAttempt.idempotencyKey
      : asNewAttempt
        ? createIdempotencyKey()
        : draftKeyRef.current;
    if (asNewAttempt) draftKeyRef.current = idempotencyKey;
    const attempt = {
      body,
      conversationId: selectedConversation.id,
      idempotencyKey,
      messageId: pendingAttempt?.messageId || null,
    };

    setSending(true);
    if (!reconcileUnknown) setSendError('');
    setSendResolution(reconcileUnknown ? 'UNKNOWN' : '');

    try {
      const response = await fetch(
        `/api/whatsapp/inbox/${encodeURIComponent(selectedConversation.id)}/messages?projectId=${encodeURIComponent(projectId)}`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey,
          },
          body: JSON.stringify({
            projectId,
            body,
            idempotencyKey,
          }),
        },
      );
      const payload = await readResponse(
        response,
        'No pudimos confirmar el envío. Reintentá sin cambiar el mensaje.',
      );
      if (reconcileUnknown && unresolvedSendRef.current === null) return;
      const sentMessage = normalizeMessage(payload.message);
      if (sentMessage) {
        attempt.messageId = sentMessage.id;
        shouldStickToBottomRef.current = true;
        knownMessageIdsRef.current = new Set([
          ...knownMessageIdsRef.current,
          sentMessage.id,
        ]);
        knownMessageStatusRef.current.set(sentMessage.id, sentMessage.status);
        setMessages((current) => mergeMessagePage(current, [sentMessage]));
        setMessageAnnouncement({
          id: sentMessage.id,
          text: sentMessage.status === 'FAILED'
            ? 'El mensaje fue rechazado.'
            : sentMessage.status === 'UNKNOWN'
              ? 'La entrega del mensaje sigue sin confirmación.'
              : 'Mensaje enviado.',
        });
      }
      setWindowState(normalizeWindow(payload.window));
      const nextComposerCapability = normalizeComposerCapability(payload.composerCapability);
      if (nextComposerCapability) setComposerCapability(nextComposerCapability);
      else void loadMessages(selectedConversation.id, { mode: 'refresh' });
      setNow(new Date());
      void loadInbox();

      if (sentMessage && UNRESOLVED_SEND_STATES.has(sentMessage.status)) {
        unresolvedSendRef.current = attempt;
        setSendResolution('UNKNOWN');
        setSendError(
          'Meta todavía no confirmó la entrega. Conservamos el borrador y la misma clave segura para comprobar o reintentar esta operación sin duplicarla.',
        );
        return;
      }

      if (sentMessage?.status === 'FAILED') {
        unresolvedSendRef.current = null;
        setSendResolution('FAILED');
        setSendError(
          'Meta confirmó que este intento falló. El borrador se conservó y podés enviarlo como una operación nueva.',
        );
        return;
      }

      unresolvedSendRef.current = null;
      setDraft((current) => (current.trim() === body ? '' : current));
      draftKeyRef.current = createIdempotencyKey();
    } catch (error) {
      const resolution = sendFailureResolution(error);
      if (resolution === 'UNKNOWN' || reconcileUnknown) {
        unresolvedSendRef.current = attempt;
        setSendResolution('UNKNOWN');
      } else {
        unresolvedSendRef.current = null;
        setSendResolution(resolution);
      }
      setSendError(safeErrorMessage(
        error,
        reconcileUnknown
          ? 'No pudimos obtener el estado final. La operación conserva su clave segura y el borrador sigue disponible.'
          : 'No pudimos confirmar el envío. El borrador queda en esta pantalla para un reintento seguro.',
      ));
    } finally {
      setSending(false);
    }
  }

  async function handleProactiveFlowSent(payload) {
    const targetConversationId = textValue(payload?.conversationId);
    const sentMessage = normalizeMessage(payload?.message);
    const isCurrentConversation = Boolean(
      targetConversationId
      && selectedConversationIdRef.current === targetConversationId,
    );
    if (sentMessage && isCurrentConversation) {
      shouldStickToBottomRef.current = true;
      knownMessageIdsRef.current = new Set([
        ...knownMessageIdsRef.current,
        sentMessage.id,
      ]);
      knownMessageStatusRef.current.set(sentMessage.id, sentMessage.status);
      setMessages((current) => mergeMessagePage(current, [sentMessage]));
      setMessageAnnouncement({
        id: sentMessage.id,
        text: sentMessage.status === 'FAILED'
          ? `${textValue(payload?.flow?.title, 'Formulario')} rechazado por Meta.`
          : sentMessage.status === 'UNKNOWN' || sentMessage.status === 'SENDING'
            ? `La entrega de ${textValue(payload?.flow?.title, 'formulario')} sigue sin confirmación.`
            : `${textValue(payload?.flow?.title, 'Formulario')} aceptado por Meta.`,
      });
    }
    setNow(new Date());
    void loadInbox();
    if (targetConversationId && selectedConversationIdRef.current === targetConversationId) {
      void loadMessages(targetConversationId, { mode: 'refresh' });
    }
  }

  function composerBlockReason() {
    if (!online) return 'Sin conexión a internet. El borrador queda en esta pantalla hasta que vuelvas a estar en línea.';
    if (!connection.operational) return 'La mensajería de WhatsApp no está habilitada para esta obra.';
    if (messageLoading || loadedConversationId !== selectedId) {
      return 'Verificando la conversación y su ventana de respuesta…';
    }
    if (!composerCapability) {
      return UNVERIFIED_COMPOSER_CAPABILITY.reason;
    }
    if (!composerCapability.allowed) {
      return composerCapability.reason || UNVERIFIED_COMPOSER_CAPABILITY.reason;
    }
    if (!replyWindow.isOpen) return replyWindow.detail;
    return '';
  }

  if (loading) return <LoadingWorkspace />;

  if (loadError && conversations.length === 0) {
    return (
      <section className={styles.fatalState} role="alert">
        <div className={styles.stateIcon}>
          <i className={online ? 'fa-solid fa-link-slash' : 'fa-solid fa-wifi'} aria-hidden="true" />
        </div>
        <p className={styles.eyebrow}>{online ? 'Inbox temporalmente inaccesible' : 'Equipo sin conexión'}</p>
        <h2>{online ? 'No pudimos abrir las conversaciones.' : 'Necesitás internet para abrir el inbox.'}</h2>
        <p>{loadError}</p>
        <button type="button" onClick={() => void loadInbox({ initial: true })}>
          <i className="fa-solid fa-arrows-rotate" aria-hidden="true" /> Reintentar
        </button>
      </section>
    );
  }

  return (
    <section
      className={styles.inbox}
      data-mobile-detail={mobileDetailOpen && selectedConversation ? 'open' : 'closed'}
      aria-label={`Inbox de WhatsApp de ${projectName}`}
    >
      <header className={styles.inboxTopbar}>
        <div className={styles.channelIdentity}>
          <span className={styles.whatsappMark}><i className="fa-brands fa-whatsapp" aria-hidden="true" /></span>
          <div>
            <span>Canal de la obra</span>
            <strong>{projectName}</strong>
            <small>{organizationName}</small>
          </div>
        </div>

        <div className={styles.channelStatus} data-tone={connectedState.tone}>
          <span><i aria-hidden="true" /> {connectedState.label}</span>
          <small>{connectedState.detail}</small>
        </div>

        <button
          className={styles.refreshButton}
          type="button"
          onClick={() => void loadInbox()}
          disabled={refreshing || loadingMoreConversations || !online}
          aria-label={refreshing ? 'Actualizando conversaciones' : 'Actualizar conversaciones'}
        >
          <i className="fa-solid fa-arrows-rotate" aria-hidden="true" />
          <span>{refreshing ? 'Actualizando…' : 'Actualizar'}</span>
        </button>
      </header>

      {!online && (
        <div className={styles.offlineBanner} role="status">
          <i className="fa-solid fa-wifi" aria-hidden="true" />
          <span>Sin conexión. Podés consultar lo ya cargado, pero no enviar ni actualizar mensajes.</span>
        </div>
      )}

      {loadError && conversations.length > 0 && (
        <div className={styles.warningBanner} role="alert">
          <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
          <span>{loadError} Se conserva la última versión cargada.</span>
          <button type="button" onClick={() => void loadInbox()} disabled={refreshing}>Reintentar</button>
        </div>
      )}

      <div className={styles.workspace}>
        <aside className={styles.conversationPanel} aria-label="Conversaciones">
          <div className={styles.conversationHeader}>
            <div>
              <span>Conversaciones recientes</span>
              <strong aria-label={`${conversations.length} conversaciones cargadas`}>
                {conversations.length}{conversationPageInfo.hasMore ? '+' : ''}
              </strong>
            </div>
            {unreadTotal > 0 && (
              <span className={styles.unreadSummary} aria-live="polite">
                {unreadTotal > 99 ? '99+' : unreadTotal} sin leer
              </span>
            )}
          </div>

          <label className={styles.search}>
            <span className={styles.srOnly}>Buscar conversaciones</span>
            <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar entre conversaciones cargadas…"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label="Limpiar búsqueda">
                <i className="fa-solid fa-xmark" aria-hidden="true" />
              </button>
            )}
          </label>

          <div className={styles.conversationResults}>
            {conversations.length === 0 ? (
              <div className={styles.emptyConversations}>
                <span>
                  <i
                    className={connection.operational
                      ? 'fa-regular fa-comments'
                      : 'fa-solid fa-plug-circle-xmark'}
                    aria-hidden="true"
                  />
                </span>
                <strong>
                  {connection.operational
                    ? 'Todavía no hay conversaciones.'
                    : 'Conectá WhatsApp para empezar.'}
                </strong>
                <p>
                  {connection.operational
                    ? 'Las conversaciones recientes aparecerán cuando llegue el primer mensaje a esta obra.'
                    : 'Esta obra necesita mensajería habilitada antes de poder recibir y atender mensajes.'}
                </p>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className={styles.noResults}>
                <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
                <strong>Sin coincidencias</strong>
                <button type="button" onClick={() => setQuery('')}>Limpiar búsqueda</button>
              </div>
            ) : (
              <>
                <ol className={styles.conversationList}>
                  {filteredConversations.map((conversation) => {
                  const active = conversation.id === selectedId;
                  return (
                    <li key={conversation.id}>
                      <button
                        ref={(node) => {
                          if (node) conversationButtonRefs.current.set(conversation.id, node);
                          else conversationButtonRefs.current.delete(conversation.id);
                        }}
                        type="button"
                        className={active ? styles.activeConversation : ''}
                        onClick={() => selectConversation(conversation.id)}
                        onKeyDown={(event) => handleConversationKeyDown(event, conversation.id)}
                        aria-current={active ? 'true' : undefined}
                      >
                        <Avatar conversation={conversation} />
                        <span className={styles.conversationCopy}>
                          <span className={styles.conversationTopline}>
                            <strong>{contactLabel(conversation)}</strong>
                            <time dateTime={safeDate(conversation.lastMessageAt)?.toISOString()}>
                              {formatConversationTime(conversation.lastMessageAt, timeZone, now)}
                            </time>
                          </span>
                          <span className={styles.conversationPreview}>
                            {conversation.lastMessage?.direction === 'OUTBOUND' && (
                              <DeliveryState status={conversation.lastMessage.status} compact />
                            )}
                            <span>
                              {conversation.lastMessage?.body
                                || attachmentPresentation(conversation.lastMessage)?.label
                                || 'Sin contenido de texto'}
                            </span>
                            {conversation.unreadCount > 0 && (
                              <b aria-label={`${conversation.unreadCount} mensajes sin leer`}>
                                {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                              </b>
                            )}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                  })}
                </ol>
                {conversationPageInfo.hasMore && !query && (
                  <button
                    className={styles.loadMoreConversations}
                    type="button"
                    onClick={() => void loadInbox({ append: true })}
                    disabled={loadingMoreConversations || refreshing || !online}
                  >
                    <i
                      className={loadingMoreConversations
                        ? 'fa-solid fa-circle-notch fa-spin'
                        : 'fa-solid fa-chevron-down'}
                      aria-hidden="true"
                    />
                    {loadingMoreConversations ? 'Cargando…' : 'Cargar conversaciones anteriores'}
                  </button>
                )}
              </>
            )}
          </div>

          {!connection.operational && (
            <div className={styles.connectionPrompt}>
              <i className="fa-solid fa-plug-circle-xmark" aria-hidden="true" />
              <div>
                <strong>Mensajería no disponible</strong>
                <span>Revisá el activo dedicado de esta obra antes de atender mensajes.</span>
              </div>
              {canManageIntegrations ? (
                <Link href="/dashboard/integrations">Ir a integraciones</Link>
              ) : (
                <span className={styles.connectionEscalation}>
                  Pedile a un administrador que complete la conexión.
                </span>
              )}
            </div>
          )}
        </aside>

        <section className={styles.messagePanel} aria-label="Detalle de conversación">
          {!selectedConversation ? (
            <div className={styles.noSelection}>
              <span><i className="fa-brands fa-whatsapp" aria-hidden="true" /></span>
              <p className={styles.eyebrow}>Atención por obra</p>
              <h2>Seleccioná una conversación.</h2>
              <p>Acá vas a ver el historial reciente, la ventana de 24 horas y el estado de cada envío.</p>
            </div>
          ) : (
            <>
              <header className={styles.messageHeader}>
                <button
                  className={styles.mobileBack}
                  type="button"
                  onClick={closeMobileDetail}
                  aria-label="Volver a conversaciones"
                >
                  <i className="fa-solid fa-arrow-left" aria-hidden="true" />
                </button>
                <Avatar conversation={selectedConversation} large />
                <div className={styles.contactIdentity}>
                  <h2 ref={mobileDetailHeadingRef} tabIndex={-1}>
                    {contactLabel(selectedConversation)}
                  </h2>
                  <span>{contactSecondary(selectedConversation)}</span>
                </div>
                <div className={styles.windowBadge} data-tone={replyWindow.tone}>
                  <span><i aria-hidden="true" /> {replyWindow.label}</span>
                  <small>{replyWindow.detail}</small>
                </div>
              </header>

              <ContactOnboardingAction
                canManageOnboarding={canManageOnboarding}
                conversationId={selectedConversation.id}
                key={`${selectedConversation.id}:${contactOnboarding.state}`}
                onboarding={contactOnboarding}
                online={online}
                onRefresh={() => loadMessages(selectedConversation.id, { mode: 'refresh' })}
                projectId={projectId}
              />

              <div className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">
                <span key={messageAnnouncement.id}>{messageAnnouncement.text}</span>
              </div>

              {readStateError && (
                <div className={styles.readStateWarning} role="status">
                  <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />
                  <span>{readStateError}</span>
                  <button type="button" onClick={retryReadState}>Reintentar</button>
                </div>
              )}

              <div
                ref={messageHistoryRef}
                className={styles.messageHistory}
                onScroll={handleHistoryScroll}
                role="log"
                aria-label={`Historial reciente con ${contactLabel(selectedConversation)}`}
                aria-live="off"
                aria-busy={messageLoading || loadedConversationId !== selectedId}
                tabIndex={0}
              >
                {messageLoading || loadedConversationId !== selectedId ? (
                  <div className={styles.messageLoading}>
                    <span className={`${styles.skeleton} ${styles.loadingBubbleInbound}`} />
                    <span className={`${styles.skeleton} ${styles.loadingBubbleOutbound}`} />
                    <span className={styles.srOnly}>Cargando mensajes.</span>
                  </div>
                ) : messageError ? (
                  <div className={styles.messageError} role="alert">
                    <span><i className="fa-solid fa-link-slash" aria-hidden="true" /></span>
                    <strong>No pudimos abrir el historial.</strong>
                    <p>{messageError}</p>
                    <button type="button" onClick={() => void loadMessages(selectedConversation.id)}>
                      Reintentar
                    </button>
                  </div>
                ) : messages.length === 0 ? (
                  <div className={styles.emptyMessages}>
                    <span><i className="fa-regular fa-message" aria-hidden="true" /></span>
                    <strong>Sin mensajes para mostrar.</strong>
                    <p>El historial reciente aparecerá cuando llegue la primera interacción.</p>
                  </div>
                ) : (
                  <>
                    <div className={styles.historyPagination}>
                      {messagePageInfo.hasMore && (
                        <button
                          type="button"
                          onClick={() => void loadMessages(selectedConversation.id, { mode: 'older' })}
                          disabled={loadingOlderMessages || !online}
                        >
                          <i
                            className={loadingOlderMessages
                              ? 'fa-solid fa-circle-notch fa-spin'
                              : 'fa-solid fa-clock-rotate-left'}
                            aria-hidden="true"
                          />
                          {loadingOlderMessages ? 'Cargando historial…' : 'Cargar mensajes anteriores'}
                        </button>
                      )}
                      {historyPageError && (
                        <span role="alert">
                          {historyPageError}{' '}
                          <button
                            type="button"
                            onClick={() => void loadMessages(selectedConversation.id, { mode: 'older' })}
                          >
                            Reintentar
                          </button>
                        </span>
                      )}
                    </div>
                    <ol className={styles.messageList}>
                      {messages.map((message, index) => {
                      const previous = messages[index - 1];
                      const showDay = !previous
                        || dayKey(previous.sentAt, timeZone) !== dayKey(message.sentAt, timeZone);
                      const outbound = message.direction === 'OUTBOUND';
                      return (
                        <li key={message.id}>
                          {showDay && (
                            <div className={styles.dayDivider}>
                              <span>{dayLabel(message.sentAt, timeZone, now)}</span>
                            </div>
                          )}
                          <article
                            className={outbound ? styles.outboundMessage : styles.inboundMessage}
                            aria-label={outbound ? 'Mensaje enviado' : 'Mensaje recibido'}
                          >
                            {message.body && <p>{message.body}</p>}
                            <DeliveryFailure failure={message.deliveryFailure} />
                            <AttachmentCard
                              canOpenSourceEvidence={canViewSourceEvidence}
                              message={message}
                            />
                            {canLinkProgressEvidence && message.progressEvidenceLinked ? (
                              <ProgressEvidenceLinkedState />
                            ) : canLinkProgressEvidence && message.progressEvidenceEligible ? (
                              <ProgressEvidenceAction
                                conversationId={selectedConversation.id}
                                message={message}
                                online={online}
                                projectId={projectId}
                                tasks={progressEvidenceTasks}
                              />
                            ) : null}
                            {!message.body
                              && !attachmentPresentation(message)
                              && <p>Contenido no disponible en esta bandeja.</p>}
                            <footer>
                              <time dateTime={safeDate(message.sentAt)?.toISOString()}>
                                {formatTime(message.sentAt, timeZone) || 'Sin hora'}
                              </time>
                              {outbound && <DeliveryState status={message.status} />}
                            </footer>
                          </article>
                        </li>
                      );
                      })}
                    </ol>
                  </>
                )}
              </div>

              {selectedConversation.unreadCount > 0 && !historyAtBottom && (
                <div className={styles.newMessagesDock}>
                  <button
                    className={styles.newMessagesButton}
                    type="button"
                    onClick={scrollToLatestMessage}
                  >
                    <i className="fa-solid fa-arrow-down" aria-hidden="true" />
                    {selectedConversation.unreadCount > 99
                      ? '99+ mensajes nuevos'
                      : `${selectedConversation.unreadCount} ${selectedConversation.unreadCount === 1 ? 'mensaje nuevo' : 'mensajes nuevos'}`}
                  </button>
                </div>
              )}

              <form className={styles.composer} onSubmit={sendMessage}>
                {sendError && (
                  <div className={styles.sendError} role="alert">
                    <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
                    <span className={styles.sendErrorCopy}>{sendError}</span>
                    {sendResolution === 'FAILED' && (
                      <button
                        className={styles.sendRetryButton}
                        type="button"
                        onClick={() => void submitMessage({ asNewAttempt: true })}
                        disabled={!canCompose || !draft.trim() || sending}
                      >
                        {sending ? 'Enviando…' : 'Enviar como nuevo intento'}
                      </button>
                    )}
                    {sendResolution === 'UNKNOWN' && (
                      <button
                        className={styles.sendRetryButton}
                        type="button"
                        onClick={() => void submitMessage({ reconcileUnknown: true })}
                        disabled={!online || sending}
                      >
                        {sending ? 'Comprobando…' : 'Comprobar / reintentar seguro'}
                      </button>
                    )}
                  </div>
                )}

                <ProactiveFlowLauncher
                  canManageIntegrations={canManageIntegrations}
                  conversationId={selectedConversation.id}
                  key={selectedConversation.id}
                  online={online}
                  onMessageSent={handleProactiveFlowSent}
                  projectId={projectId}
                  replyWindowOpen={replyWindow.isOpen}
                />

                {!canCompose && (
                  <div className={styles.composerGuard} role="status">
                    <i className={replyWindow.isOpen && composerCapability?.allowed !== false
                      ? 'fa-solid fa-circle-info'
                      : 'fa-solid fa-lock'} aria-hidden="true" />
                    <span>{composerBlockReason()}</span>
                  </div>
                )}

                <div className={styles.composerRow}>
                  <label>
                    <span className={styles.srOnly}>Escribir respuesta</span>
                    <textarea
                      value={draft}
                      onChange={(event) => updateDraft(event.target.value)}
                      placeholder={canCompose ? 'Escribí una respuesta…' : 'Respuesta no disponible'}
                      rows="1"
                      maxLength="4096"
                      disabled={!canCompose || sending}
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={!canSubmit || !draft.trim() || sending}
                    aria-label={sendResolution === 'UNKNOWN'
                      ? 'Envío pendiente de confirmación'
                      : sendResolution === 'FAILED'
                        ? 'Usá Enviar como nuevo intento'
                        : sending
                          ? 'Enviando mensaje'
                          : 'Enviar mensaje'}
                  >
                    <i className={sending
                      ? 'fa-solid fa-circle-notch fa-spin'
                      : 'fa-solid fa-paper-plane'} aria-hidden="true" />
                    <span>{sending ? 'Enviando…' : 'Enviar'}</span>
                  </button>
                </div>
                <div className={styles.composerMeta}>
                  <span><i className="fa-solid fa-shield-halved" aria-hidden="true" /> Envío aislado por tenant y obra</span>
                  <span>{draft.length.toLocaleString('es-AR')} / 4.096</span>
                </div>
              </form>
            </>
          )}
        </section>
      </div>
    </section>
  );
}
