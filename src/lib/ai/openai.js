const OPENAI_TRANSCRIPTION_URL = "https://api.openai.com/v1/audio/transcriptions";
const MAX_TRANSCRIPTION_BYTES = 25 * 1024 * 1024;

const TRANSCRIPTION_FILE_EXTENSIONS = new Map([
  ["audio/flac", "flac"],
  ["audio/mpeg", "mp3"],
  ["audio/mp4", "m4a"],
  ["video/mp4", "mp4"],
  ["audio/ogg", "ogg"],
  ["audio/wav", "wav"],
  ["audio/x-wav", "wav"],
  ["audio/webm", "webm"],
  ["video/webm", "webm"],
]);

function normalizeMimeType(value) {
  return String(value || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
}

export function isOpenAIConfigured() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function canTranscribeMimeType(mimeType) {
  return TRANSCRIPTION_FILE_EXTENSIONS.has(normalizeMimeType(mimeType));
}

export async function transcribeAudio({
  buffer,
  mimeType,
  fileName,
  language = "es",
  fetchImpl = fetch,
}) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OpenAI transcription is not configured.");
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error("A non-empty audio buffer is required for transcription.");
  }
  if (buffer.length > MAX_TRANSCRIPTION_BYTES) {
    throw new Error("Audio exceeds the OpenAI transcription size limit.");
  }

  const normalizedMimeType = normalizeMimeType(mimeType);
  const extension = TRANSCRIPTION_FILE_EXTENSIONS.get(normalizedMimeType);
  if (!extension) {
    throw new Error(`Audio MIME type ${normalizedMimeType || "unknown"} requires conversion before transcription.`);
  }

  const model = process.env.OPENAI_TRANSCRIPTION_MODEL || "gpt-4o-transcribe";
  const safeBaseName = String(fileName || "whatsapp-audio")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "whatsapp-audio";
  const uploadName = safeBaseName.toLowerCase().endsWith(`.${extension}`)
    ? safeBaseName
    : `${safeBaseName}.${extension}`;

  const formData = new FormData();
  formData.append("file", new File([buffer], uploadName, { type: normalizedMimeType }));
  formData.append("model", model);
  formData.append("language", language);
  formData.append("response_format", "json");
  formData.append(
    "prompt",
    "Español rioplatense. Contexto: construcción, arquitectura, avance de obra, seguridad, materiales, cuadrillas y contratistas.",
  );

  const response = await fetchImpl(OPENAI_TRANSCRIPTION_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
    signal: AbortSignal.timeout(55_000),
  });
  const requestId = response.headers.get("x-request-id");
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      `OpenAI transcription failed (${response.status}${requestId ? `, request ${requestId}` : ""}).`,
    );
  }

  const text = String(result.text || "").trim();
  if (!text) throw new Error("OpenAI returned an empty transcription.");
  return {
    provider: "openai",
    model,
    text,
    requestId: requestId || null,
  };
}
