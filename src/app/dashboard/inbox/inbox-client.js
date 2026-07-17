'use client';

import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import styles from './inbox.module.css';

const DEFAULT_TIME_ZONE = 'America/Argentina/Buenos_Aires';
const DELIVERY_STATES = new Set([
  'SENDING',
  'ACCEPTED',
  'SENT',
  'DELIVERED',
  'READ',
  'FAILED',
  'UNKNOWN',
]);
const ATTACHMENT_PRESENTATIONS = Object.freeze({
  image: { icon: 'fa-regular fa-image', label: 'Imagen' },
  audio: { icon: 'fa-solid fa-microphone', label: 'Audio' },
  video: { icon: 'fa-solid fa-video', label: 'Video' },
  document: { icon: 'fa-regular fa-file-lines', label: 'Documento' },
});
const MOBILE_INBOX_QUERY = '(max-width: 760px)';
const STICK_TO_BOTTOM_THRESHOLD = 96;
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
    status: deliveryStatus(source.status || source.deliveryStatus),
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
  const operational = source.operational === true
    || source.connected === true
    || (source.enabled === true && status === 'CONNECTED');

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
      (safeDate(left.sentAt)?.getTime() || 0) - (safeDate(right.sentAt)?.getTime() || 0)
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

function createIdempotencyKey() {
  const suffix = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `inbox-${suffix}`;
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
      label: 'Canal operativo',
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

function DeliveryState({ status }) {
  const normalized = deliveryStatus(status);
  const presentation = {
    SENDING: { icon: 'fa-regular fa-clock', label: 'Enviando' },
    ACCEPTED: { icon: 'fa-solid fa-check', label: 'Aceptado por Meta' },
    SENT: { icon: 'fa-solid fa-check', label: 'Enviado' },
    DELIVERED: { icon: 'fa-solid fa-check-double', label: 'Entregado' },
    READ: { icon: 'fa-solid fa-check-double', label: 'Leído' },
    FAILED: { icon: 'fa-solid fa-circle-exclamation', label: 'Falló' },
    UNKNOWN: { icon: 'fa-regular fa-clock', label: 'Estado pendiente' },
  }[normalized];

  return (
    <span className={styles.deliveryState} data-status={normalized.toLowerCase()}>
      <i className={presentation.icon} aria-hidden="true" />
      <span className={styles.srOnly}>{presentation.label}</span>
    </span>
  );
}

function attachmentPresentation(message) {
  const kind = textValue(message?.media?.kind, message?.kind).toLowerCase();
  const presentation = ATTACHMENT_PRESENTATIONS[kind];
  return presentation ? { ...presentation, kind } : null;
}

function AttachmentCard({ message }) {
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
      <i className={`fa-solid fa-shield-halved ${styles.attachmentShield}`} aria-hidden="true" />
    </div>
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
  canManageIntegrations = false,
  organizationName,
  projectId,
  projectName,
  timeZone = DEFAULT_TIME_ZONE,
}) {
  const [conversations, setConversations] = useState([]);
  const [connection, setConnection] = useState(() => normalizeConnection(null));
  const [selectedId, setSelectedId] = useState('');
  const [loadedConversationId, setLoadedConversationId] = useState('');
  const [messages, setMessages] = useState([]);
  const [windowState, setWindowState] = useState(() => normalizeWindow(null));
  const [composerCapability, setComposerCapability] = useState(null);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [messageLoading, setMessageLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [messageError, setMessageError] = useState('');
  const [sendError, setSendError] = useState('');
  const [sendResolution, setSendResolution] = useState('');
  const [messageAnnouncement, setMessageAnnouncement] = useState({ id: 'initial', text: '' });
  const [online, setOnline] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  const listAbortRef = useRef(null);
  const messageAbortRef = useRef(null);
  const draftKeyRef = useRef(createIdempotencyKey());
  const knownMessageIdsRef = useRef(new Set());
  const shouldStickToBottomRef = useRef(true);
  const messageHistoryRef = useRef(null);
  const mobileDetailHeadingRef = useRef(null);
  const conversationButtonRefs = useRef(new Map());
  const restoreConversationFocusRef = useRef('');

  const selectedConversation = useMemo(() => (
    conversations.find((conversation) => conversation.id === selectedId) || null
  ), [conversations, selectedId]);
  const selectedConversationId = selectedConversation?.id || '';

  const filteredConversations = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('es');
    if (!needle) return conversations;
    return conversations.filter((conversation) => [
      conversation.displayName,
      conversation.phone,
      conversation.lastMessage?.body,
    ].some((value) => String(value || '').toLocaleLowerCase('es').includes(needle)));
  }, [conversations, query]);

  const unreadTotal = useMemo(() => conversations.reduce(
    (total, conversation) => total + conversation.unreadCount,
    0,
  ), [conversations]);

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

  const loadInbox = useCallback(async ({ initial = false } = {}) => {
    listAbortRef.current?.abort();
    const controller = new AbortController();
    listAbortRef.current = controller;
    if (initial) setLoading(true);
    else setRefreshing(true);
    setLoadError('');

    try {
      const response = await fetch(
        `/api/whatsapp/inbox?projectId=${encodeURIComponent(projectId)}`,
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
      setConnection(normalizeConnection(payload.connection));
      setConversations(nextConversations);
      setSelectedId((current) => (
        nextConversations.some((conversation) => conversation.id === current)
          ? current
          : nextConversations[0]?.id || ''
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
      if (listAbortRef.current === controller) {
        listAbortRef.current = null;
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [projectId]);

  const loadMessages = useCallback(async (conversationId, { silent = false } = {}) => {
    if (!conversationId) return;
    const history = messageHistoryRef.current;
    const wasNearBottom = history
      ? history.scrollHeight - history.scrollTop - history.clientHeight <= STICK_TO_BOTTOM_THRESHOLD
      : true;
    messageAbortRef.current?.abort();
    const controller = new AbortController();
    messageAbortRef.current = controller;
    if (!silent) {
      setLoadedConversationId('');
      setMessageLoading(true);
      setMessageError('');
      setComposerCapability(null);
    }

    try {
      const response = await fetch(
        `/api/whatsapp/inbox/${encodeURIComponent(conversationId)}/messages?projectId=${encodeURIComponent(projectId)}`,
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
      const previousIds = knownMessageIdsRef.current;
      const additions = silent
        ? nextMessages.filter((message) => !previousIds.has(message.id))
        : [];
      knownMessageIdsRef.current = new Set(nextMessages.map((message) => message.id));
      shouldStickToBottomRef.current = !silent || wasNearBottom;
      setMessages(nextMessages);
      setMessageError('');
      setComposerCapability(
        normalizeComposerCapability(payload.composerCapability)
          || UNVERIFIED_COMPOSER_CAPABILITY,
      );
      if (additions.length > 0) {
        const latestAddition = additions[additions.length - 1];
        const inboundCount = additions.filter((message) => message.direction === 'INBOUND').length;
        setMessageAnnouncement({
          id: latestAddition.id,
          text: inboundCount > 0
            ? `${inboundCount} ${inboundCount === 1 ? 'mensaje nuevo' : 'mensajes nuevos'} en esta conversación.`
            : 'Se actualizó el estado de la conversación.',
        });
      }
      setWindowState(normalizeWindow(payload.window));
      setLoadedConversationId(conversationId);
      setConversations((current) => current.map((conversation) => (
        detailConversation?.id === conversation.id
          ? { ...conversation, ...detailConversation }
          : conversation
      )));
      setNow(new Date());
    } catch (error) {
      if (!silent && error.name !== 'AbortError') {
        setMessageError(safeErrorMessage(
          error,
          'No pudimos consultar los mensajes de esta conversación.',
        ));
      }
    } finally {
      if (messageAbortRef.current === controller) {
        messageAbortRef.current = null;
        if (!silent) setMessageLoading(false);
      }
    }
  }, [projectId]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void loadInbox({ initial: true });
    });
    return () => {
      window.cancelAnimationFrame(frame);
      listAbortRef.current?.abort();
      messageAbortRef.current?.abort();
    };
  }, [loadInbox]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (!selectedId) {
        setMessages([]);
        setWindowState(normalizeWindow(null));
        setComposerCapability(null);
        setLoadedConversationId('');
        knownMessageIdsRef.current = new Set();
        return;
      }
      setDraft('');
      setSendError('');
      setSendResolution('');
      setComposerCapability(null);
      setMessageAnnouncement({ id: `conversation-${selectedId}`, text: '' });
      knownMessageIdsRef.current = new Set();
      shouldStickToBottomRef.current = true;
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
    if (!online) return undefined;
    const refreshInterval = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void loadInbox();
      if (selectedId) void loadMessages(selectedId, { silent: true });
    }, 20_000);
    return () => window.clearInterval(refreshInterval);
  }, [loadInbox, loadMessages, online, selectedId]);

  useEffect(() => {
    const refreshWhenAvailable = () => {
      if (!window.navigator.onLine || document.visibilityState !== 'visible') return;
      void loadInbox();
      if (selectedId) void loadMessages(selectedId, { silent: true });
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
    if (!shouldStickToBottomRef.current) return;
    const history = messageHistoryRef.current;
    if (history) history.scrollTop = history.scrollHeight;
    shouldStickToBottomRef.current = false;
  }, [messageLoading, messages]);

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

  async function submitMessage({ asNewAttempt = false } = {}) {
    const body = draft.trim();
    if (!body || !selectedConversation || sending || !canCompose) return;
    if (sendResolution === 'UNKNOWN') return;
    if (sendResolution === 'FAILED' && !asNewAttempt) return;

    const idempotencyKey = asNewAttempt
      ? createIdempotencyKey()
      : draftKeyRef.current;
    if (asNewAttempt) draftKeyRef.current = idempotencyKey;

    setSending(true);
    setSendError('');
    setSendResolution('');

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
      const sentMessage = normalizeMessage(payload.message);
      if (sentMessage) {
        shouldStickToBottomRef.current = true;
        knownMessageIdsRef.current = new Set([
          ...knownMessageIdsRef.current,
          sentMessage.id,
        ]);
        setMessages((current) => {
          const existing = current.findIndex((message) => message.id === sentMessage.id);
          if (existing < 0) return [...current, sentMessage];
          return current.map((message, index) => (index === existing ? sentMessage : message));
        });
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
      else void loadMessages(selectedConversation.id, { silent: true });
      setNow(new Date());
      void loadInbox();

      if (sentMessage?.status === 'FAILED' || sentMessage?.status === 'UNKNOWN') {
        setSendResolution(sentMessage.status);
        setSendError(sentMessage.status === 'FAILED'
          ? 'Meta rechazó este intento. Podés revisarlo y enviarlo nuevamente como una operación nueva.'
          : 'Meta no confirmó la entrega. El borrador queda en esta pantalla y no lo reenviaremos para evitar duplicados.');
        return;
      }

      setDraft('');
      draftKeyRef.current = createIdempotencyKey();
    } catch (error) {
      const resolution = sendFailureResolution(error);
      setSendResolution(resolution);
      setSendError(safeErrorMessage(
        error,
        'No pudimos confirmar el envío. El borrador queda en esta pantalla para un reintento seguro.',
      ));
    } finally {
      setSending(false);
    }
  }

  function composerBlockReason() {
    if (!online) return 'Sin conexión a internet. El borrador queda en esta pantalla hasta que vuelvas a estar en línea.';
    if (!connection.operational) return 'El canal de WhatsApp de esta obra no está operativo.';
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
          disabled={refreshing || !online}
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
              <strong>{conversations.length}</strong>
            </div>
            {unreadTotal > 0 && (
              <span className={styles.unreadSummary}>{unreadTotal > 99 ? '99+' : unreadTotal} sin leer</span>
            )}
          </div>

          <label className={styles.search}>
            <span className={styles.srOnly}>Buscar conversaciones</span>
            <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar nombre, teléfono o mensaje…"
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
                    : 'Esta obra necesita un canal operativo antes de poder recibir y atender mensajes.'}
                </p>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className={styles.noResults}>
                <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
                <strong>Sin coincidencias</strong>
                <button type="button" onClick={() => setQuery('')}>Limpiar búsqueda</button>
              </div>
            ) : (
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
                              <DeliveryState status={conversation.lastMessage.status} />
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
            )}
          </div>

          {!connection.operational && (
            <div className={styles.connectionPrompt}>
              <i className="fa-solid fa-plug-circle-xmark" aria-hidden="true" />
              <div>
                <strong>Canal sin conexión operativa</strong>
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

              <div className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">
                <span key={messageAnnouncement.id}>{messageAnnouncement.text}</span>
              </div>

              <div
                ref={messageHistoryRef}
                className={styles.messageHistory}
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
                            <AttachmentCard message={message} />
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
                )}
              </div>

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
                  </div>
                )}

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
