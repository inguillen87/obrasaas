import { createHash } from 'node:crypto';

export const MAX_PRIVATE_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_PRIVATE_KYC_BODY_BYTES = 4 * 1024 * 1024;
const MIME = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const fail = code => { throw new PrivateImageError(code); };
const hash = value => createHash('sha256').update(value).digest('hex');
const text = value => typeof value === 'string' && value === value.trim() && value.length > 0 && !value.includes('\0');
export class PrivateImageError extends Error {
  constructor(code = 'PRIVATE_IMAGE_STORAGE_UNAVAILABLE') {
    super('No se pudo confirmar el almacenamiento privado de las imágenes.');
    this.name = 'PrivateImageError'; this.code = code;
  }
}
export function assertPrivateImageConfigured(environment = process.env) {
  if (environment.PRIVATE_MEDIA_PROVIDER !== 'vercel-blob') fail('PRIVATE_IMAGE_PROVIDER_REQUIRED');
  const staticToken = text(environment.BLOB_READ_WRITE_TOKEN) && environment.BLOB_READ_WRITE_TOKEN !== '[SENSITIVE]';
  const oidcStore = text(environment.BLOB_STORE_ID) &&
    (environment.VERCEL === '1' || text(environment.VERCEL_OIDC_TOKEN));
  if (!staticToken && !oidcStore) fail('PRIVATE_IMAGE_STORAGE_NOT_CONFIGURED');
}
export function decodePrivateImage(value, expectedType = null) {
  if (typeof value !== 'string' || !value.length) fail('PRIVATE_IMAGE_INVALID');
  if (value.length > Math.ceil(MAX_PRIVATE_IMAGE_BYTES / 3) * 4 + 64) fail('PRIVATE_IMAGE_TOO_LARGE');
  const data = value.startsWith('data:') ? /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]*={0,2})$/.exec(value) : null;
  if (value.startsWith('data:') && !data) fail('PRIVATE_IMAGE_INVALID');
  const encoded = data ? data[2] : value;
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) fail('PRIVATE_IMAGE_INVALID');
  const bytes = Buffer.from(encoded, 'base64');
  if (!bytes.length || bytes.toString('base64') !== encoded) fail('PRIVATE_IMAGE_INVALID');
  if (bytes.length > MAX_PRIVATE_IMAGE_BYTES) fail('PRIVATE_IMAGE_TOO_LARGE');
  let format = null;
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) format = 'jpeg';
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a','hex'))) format = 'png';
  if (bytes.length >= 12 && bytes.subarray(0,4).toString() === 'RIFF' && bytes.subarray(8,12).toString() === 'WEBP') format = 'webp';
  if (!format || (data && data[1] !== MIME[format]) || (expectedType && expectedType !== MIME[format])) fail('PRIVATE_IMAGE_TYPE_MISMATCH');
  // Signature checking is an input boundary, not an image decoder, malware scan or biometric validation.
  return { bytes, contentType: MIME[format], extension: format === 'jpeg' ? 'jpg' : format, digest: hash(bytes) };
}
export function preparePrivateKycImages(workerId, front, selfie) {
  if (!text(workerId) || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(workerId) || workerId === 'unknown') fail('PRIVATE_IMAGE_IDENTITY_REQUIRED');
  const images = [decodePrivateImage(front), decodePrivateImage(selfie)];
  const batch = hash(JSON.stringify(['legacy-kyc-private-v1',workerId,...images.map(image=>image.digest)]));
  return images.map((image,index) => ({...image,pathname:`obrasaas/legacy-kyc/v1/${batch}/${index===0?'dni-front':'selfie'}.${image.extension}`}));
}
function assertPrivateIdentity(blob, pathname) {
  let url; try { url = new URL(blob?.url); } catch { fail('PRIVATE_IMAGE_RECEIPT_MISMATCH'); }
  if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.private\.blob\.vercel-storage\.com$/.test(url.hostname) ||
      url.username || url.password || url.port || url.search || url.hash ||
      url.pathname !== '/' + pathname || blob.pathname !== pathname) fail('PRIVATE_IMAGE_RECEIPT_MISMATCH');
}
async function digestStoredStream(stream, image) {
  if (!stream?.getReader) fail('PRIVATE_IMAGE_RECEIPT_MISMATCH');
  const reader = stream.getReader(), digest = createHash('sha256'); let size = 0;
  try {
    while (true) {
      const next = await reader.read(); if (next.done) break;
      if (!(next.value instanceof Uint8Array)) fail('PRIVATE_IMAGE_RECEIPT_MISMATCH');
      size += next.value.byteLength;
      if (size > image.bytes.length) fail('PRIVATE_IMAGE_RECEIPT_MISMATCH');
      digest.update(next.value);
    }
    if (size !== image.bytes.length || digest.digest('hex') !== image.digest) fail('PRIVATE_IMAGE_RECEIPT_MISMATCH');
  } finally { await reader.cancel().catch(()=>{}); reader.releaseLock(); }
}
export function createPrivateImageUploader({put,get,environment=()=>process.env,timeoutMs=15000}) {
  if (typeof put !== 'function' || typeof get !== 'function' || !Number.isInteger(timeoutMs) || timeoutMs<1 || timeoutMs>60000) fail('PRIVATE_IMAGE_ADAPTER_INVALID');
  const read = async image => {
    const result = await get(image.pathname,{access:'private',useCache:false,abortSignal:AbortSignal.timeout(timeoutMs)});
    if (result === null) return null;
    try { assertPrivateIdentity(result?.blob,image.pathname); }
    catch(error){await result?.stream?.cancel?.().catch(()=>{});throw error;}
    if (result.statusCode !== 200 || result.blob.size !== image.bytes.length ||
        result.blob.contentType?.split(';')[0].trim().toLowerCase() !== image.contentType) {
      await result?.stream?.cancel?.().catch(()=>{}); fail('PRIVATE_IMAGE_RECEIPT_MISMATCH');
    }
    await digestStoredStream(result.stream,image);
    return result.blob.url;
  };
  const upload = async image => {
    assertPrivateImageConfigured(environment());
    try {
      const existing = await read(image); if (existing) return existing;
      let result;
      try { result = await put(image.pathname,image.bytes,{access:'private',contentType:image.contentType,
        addRandomSuffix:false,allowOverwrite:false,cacheControlMaxAge:60,abortSignal:AbortSignal.timeout(timeoutMs)}); }
      catch {
        // A write timeout can follow a successful store operation. Only re-read
        // the deterministic private path; never switch access or overwrite.
        try { const recovered = await read(image); if (recovered) return recovered; }
        catch(error) { if(error instanceof PrivateImageError) throw error; }
        fail('PRIVATE_IMAGE_CONFIRMATION_PENDING');
      }
      assertPrivateIdentity(result,image.pathname);
      const confirmed = await read(image); if (!confirmed) fail('PRIVATE_IMAGE_CONFIRMATION_PENDING');
      return confirmed;
    } catch(error) { if(error instanceof PrivateImageError)throw error;throw new PrivateImageError(); }
  };
  return {
    async uploadImageToBlob(value,filename,contentType=null) {
      if(!text(filename)||filename.length>256||filename.split('/').some(part=>!part||part==='.'||part==='..'||!/^[A-Za-z0-9._-]+$/.test(part)))fail('PRIVATE_IMAGE_FILENAME_INVALID');
      const image=decodePrivateImage(value,contentType);
      const identity=hash(JSON.stringify(['legacy-private-image-v1',filename,image.digest]));
      return upload({...image,pathname:`obrasaas/legacy-images/v1/${identity}/image.${image.extension}`});
    },
    async uploadKycImages(workerId,front,selfie) {
      assertPrivateImageConfigured(environment());
      const [frontImage,selfieImage]=preparePrivateKycImages(workerId,front,selfie);
      // Validate both inputs before writing either. Successful private objects
      // survive partial failure for an exact retry; do not delete a concurrent
      // caller's object or claim that Blob offers an atomic two-file commit.
      const dniFrontUrl=await upload(frontImage),selfieUrl=await upload(selfieImage);
      return {dniFrontUrl,selfieUrl};
    },
  };
}
export async function readPrivateKycBody(request) {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') fail('PRIVATE_IMAGE_REQUEST_INVALID');
  const length=request.headers.get('content-length');
  if(length!==null&&(!/^\d+$/.test(length)||Number(length)>MAX_PRIVATE_KYC_BODY_BYTES)) fail('PRIVATE_IMAGE_TOO_LARGE');
  if(!request.body?.getReader)fail('PRIVATE_IMAGE_REQUEST_INVALID');
  const reader=request.body.getReader(),chunks=[];let size=0;
  try {
    while(true){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;
      if(size>MAX_PRIVATE_KYC_BODY_BYTES)fail('PRIVATE_IMAGE_TOO_LARGE');chunks.push(Buffer.from(next.value));}
    const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));
    if(!value||typeof value!=='object'||Array.isArray(value))fail('PRIVATE_IMAGE_REQUEST_INVALID');return value;
  } catch(error){if(error instanceof PrivateImageError)throw error;fail('PRIVATE_IMAGE_REQUEST_INVALID');}
  finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
export function privateImageErrorResponse(error) {
  if(!(error instanceof PrivateImageError))return null;
  const status=error.code==='PRIVATE_IMAGE_TOO_LARGE'?413:
    /INVALID|TYPE_MISMATCH|IDENTITY_REQUIRED|FILENAME_INVALID/.test(error.code)?400:
    error.code==='PRIVATE_IMAGE_RECEIPT_MISMATCH'?502:503;
  return Response.json({success:false,verified:false,error:'No se pudo completar el almacenamiento privado. No se confirmó el registro.',code:error.code},
    {status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
