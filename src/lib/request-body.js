export class RequestBodyError extends Error {
  constructor(message, { code = 'INVALID_REQUEST_BODY', status = 400 } = {}) {
    super(message);
    this.name = 'RequestBodyError';
    this.code = code;
    this.status = status;
  }
}

function contentTypeMediaType(request) {
  return String(request.headers.get('content-type') || '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase();
}

function isJsonMediaType(mediaType) {
  return mediaType === 'application/json'
    || (mediaType.startsWith('application/') && mediaType.endsWith('+json'));
}

function assertDeclaredLength(request, maxBytes) {
  const header = request.headers.get('content-length');
  if (header === null || header === '') return;
  if (!/^\d+$/.test(header.trim())) {
    throw new RequestBodyError('El encabezado Content-Length no es válido.', {
      code: 'INVALID_CONTENT_LENGTH',
    });
  }
  const declaredLength = Number(header);
  if (!Number.isSafeInteger(declaredLength)) {
    throw new RequestBodyError('El encabezado Content-Length no es válido.', {
      code: 'INVALID_CONTENT_LENGTH',
    });
  }
  if (declaredLength > maxBytes) {
    throw new RequestBodyError('La solicitud supera el tamaño permitido.', {
      code: 'REQUEST_BODY_TOO_LARGE',
      status: 413,
    });
  }
}

export async function readLimitedRequestBytes(request, { maxBytes, requireJson = false } = {}) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new TypeError('maxBytes must be a positive safe integer.');
  }
  if (requireJson && !isJsonMediaType(contentTypeMediaType(request))) {
    throw new RequestBodyError('El cuerpo debe enviarse como application/json.', {
      code: 'UNSUPPORTED_MEDIA_TYPE',
      status: 415,
    });
  }
  assertDeclaredLength(request, maxBytes);
  if (!request.body) return new Uint8Array();

  let reader;
  try {
    reader = request.body.getReader();
  } catch {
    throw new RequestBodyError('No se pudo leer el cuerpo de la solicitud.', {
      code: 'REQUEST_BODY_UNREADABLE',
    });
  }

  const chunks = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
      totalBytes += chunk.byteLength;
      if (totalBytes > maxBytes) {
        throw new RequestBodyError('La solicitud supera el tamaño permitido.', {
          code: 'REQUEST_BODY_TOO_LARGE',
          status: 413,
        });
      }
      chunks.push(chunk);
    }
  } catch (error) {
    if (error instanceof RequestBodyError) throw error;
    throw new RequestBodyError('No se pudo leer el cuerpo de la solicitud.', {
      code: 'REQUEST_BODY_UNREADABLE',
    });
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export function decodeUtf8RequestBytes(bytes) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new RequestBodyError('El cuerpo JSON no tiene una codificación UTF-8 válida.', {
      code: 'INVALID_JSON_ENCODING',
    });
  }
}

export async function readJsonRequest(request, { maxBytes }) {
  const bytes = await readLimitedRequestBytes(request, { maxBytes, requireJson: true });
  try {
    return JSON.parse(decodeUtf8RequestBytes(bytes));
  } catch (error) {
    if (error instanceof RequestBodyError) throw error;
    throw new RequestBodyError('El cuerpo JSON no es válido.', {
      code: 'INVALID_JSON',
    });
  }
}

export async function readMultipartFormDataRequest(request, { maxBytes }) {
  const contentType = String(request.headers.get('content-type') || '');
  if (contentTypeMediaType(request) !== 'multipart/form-data' || !/;\s*boundary=(?:"[^"]+"|[^;\s]+)/i.test(contentType)) {
    throw new RequestBodyError('El cuerpo debe enviarse como multipart/form-data.', {
      code: 'UNSUPPORTED_MEDIA_TYPE',
      status: 415,
    });
  }

  const bytes = await readLimitedRequestBytes(request, { maxBytes });
  try {
    const parsedRequest = new Request('http://localhost', {
      method: 'POST',
      headers: { 'content-type': contentType },
      body: bytes,
    });
    return await parsedRequest.formData();
  } catch {
    throw new RequestBodyError('El formulario multipart no es válido.', {
      code: 'INVALID_MULTIPART_BODY',
    });
  }
}

export function requestBodyErrorResponse(error) {
  return Response.json(
    { error: error.message, code: error.code },
    {
      status: error.status,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
