// Use the active tab's Clerk token. The shared __session cookie can belong to
// a different organization after another tab switches its active context.
const unsent = error => Object.assign(error, {requestDispatched:false});
export async function workspaceActiveToken(getSessionToken, {signal, tokenTimeoutMs = 15000} = {}) {
  if (!Number.isInteger(tokenTimeoutMs) || tokenTimeoutMs < 1 || tokenTimeoutMs > 15000) throw unsent(new TypeError('A bounded token deadline is required'));
  if (signal?.aborted) throw unsent(new DOMException('La consulta se canceló.', 'AbortError'));
  return new Promise((resolve, reject) => {
    let finished = false;
    const finish = (callback, value) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      callback(value);
    };
    const unavailable = () => unsent(Object.assign(new Error('No se pudo renovar tu sesión. Volvé a consultar.'), {code:'IDENTITY_PROVIDER_UNAVAILABLE',status:503}));
    const abort = () => finish(reject, unsent(new DOMException('La consulta se canceló.', 'AbortError')));
    const timer = setTimeout(() => finish(reject, unavailable()), tokenTimeoutMs);
    signal?.addEventListener('abort', abort, {once:true});
    Promise.resolve().then(() => finished ? undefined : getSessionToken()).then(token => finish(resolve, token), () => finish(reject, unavailable()));
  });
}


// A longer, still bounded identity request does not grant authorization or
// permit a retry. Other requests retain the existing sixty-second ceiling.
export function workspaceRequestTimeoutLimit(url,options){
 if(url!=='/api/identity/participants'||options?.method!=='POST'||typeof options.body!=='string')return 60000;
 try{
  const b=JSON.parse(options.body),plain=v=>v&&typeof v==='object'&&!Array.isArray(v),uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v),id=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(v),hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v),image=v=>typeof v==='string'&&v.length>0&&v.length<=Math.ceil(2*1024*1024/3)*4+64;
  if(!plain(b))return 60000;
  const ocr=['ocrConsent','ocrNoticeVersion'].some(k=>Object.hasOwn(b,k)),back=['back','backConsent','backNoticeVersion','backNoticeSha256'].some(k=>Object.hasOwn(b,k)),manual=Object.hasOwn(b,'biometricManualFromOperationId');
  const keys=['operationId','projectId','scope','workerId','revision','noticeVersion','consent','front','selfie','biometricNoticeVersion','biometricConsent','biometricMode',...(ocr?['ocrConsent','ocrNoticeVersion']:[]),...(back?['back','backConsent','backNoticeVersion','backNoticeSha256']:[]),...(manual?['biometricManualFromOperationId']:[])];
  if(Object.keys(b).sort().join('|')!==keys.sort().join('|')||!uuid(b.operationId)||!id(b.projectId)||!hash(b.scope)||!id(b.workerId)||typeof b.revision!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/.test(b.revision)||b.noticeVersion!=='participant-kyc-v1'||b.consent!==true||!image(b.front)||!image(b.selfie)||b.biometricNoticeVersion!=='participant-private-biometric-v3'||!['ASSISTED','MANUAL'].includes(b.biometricMode)||b.biometricConsent!==(b.biometricMode==='ASSISTED')||ocr&&(typeof b.ocrConsent!=='boolean'||!['participant-external-ocr-v1','participant-external-ocr-v2'].includes(b.ocrNoticeVersion))||back&&(!image(b.back)||b.backConsent!==true||b.backNoticeVersion!=='participant-kyc-document-back-v1'||!hash(b.backNoticeSha256))||manual&&(b.biometricMode!=='MANUAL'||!uuid(b.biometricManualFromOperationId)||b.biometricManualFromOperationId.toLowerCase()===b.operationId.toLowerCase()))return 60000;
  return 150000;
 }catch{return 60000;}
}

export async function workspaceSessionRequest(url, options, {getSessionToken, fetchImpl = fetch, tokenTimeoutMs = 15000, requestTimeoutMs = 20000} = {}) {
  if (!Number.isInteger(tokenTimeoutMs) || tokenTimeoutMs < 1 || tokenTimeoutMs > 15000) throw unsent(new TypeError('A bounded token deadline is required'));
  if (!Number.isInteger(requestTimeoutMs) || requestTimeoutMs < 1 || requestTimeoutMs > workspaceRequestTimeoutLimit(url,options)) throw unsent(new TypeError('A bounded request deadline is required'));
  const signal = AbortSignal.any([...(options?.signal ? [options.signal] : []), AbortSignal.timeout(requestTimeoutMs)]);
  const headers = new Headers(options?.headers);
  if (typeof getSessionToken !== 'function') throw unsent(Object.assign(new Error('Tu sesión terminó. Volvé a ingresar.'), {code:'SESSION_REQUIRED',status:401}));
  const token = await workspaceActiveToken(getSessionToken, {signal, tokenTimeoutMs});
  if (!token) throw unsent(Object.assign(new Error('Tu sesión terminó. Volvé a ingresar.'), {code:'SESSION_REQUIRED',status:401}));
  headers.set('Authorization', 'Bearer ' + token);
  if (signal.aborted) throw unsent(new DOMException('La consulta se canceló.', 'AbortError'));
  // Never retry a mutation here. A lost confirmation must use its receipt.
  return fetchImpl(url, {...options, signal, headers, credentials:'same-origin', cache:'no-store'});
}
