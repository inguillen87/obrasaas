// Browser-only preparation. The selected original is never overwritten or sent.
export const PHOTO_LIMIT = 2 * 1024 * 1024;
export const RECORDING_LIMIT = 3 * 1024 * 1024;
export const FIELD_MEDIA_TYPES = ['image/jpeg','image/png','image/webp','audio/ogg','audio/wav','audio/mpeg','audio/mp4','audio/webm','video/mp4','video/webm'];
export const RECORDING_PROFILES = {
  audio: {seconds:120, audioBitsPerSecond:64000, types:['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus']},
  video: {seconds:40, audioBitsPerSecond:48000, videoBitsPerSecond:256000, types:['video/webm;codecs=vp8,opus','video/mp4','video/webm']},
};
export const normalizedType = value => String(value||'').toLowerCase().split(';')[0];
export const mediaLimit = type => normalizedType(type).startsWith('image/') ? PHOTO_LIMIT : RECORDING_LIMIT;
export function validateLocalMedia(file) {
  if(!file?.size)throw new Error('El archivo está vacío. Elegí otro o volvé a grabar.');
  if(!FIELD_MEDIA_TYPES.includes(normalizedType(file.type)))throw new Error('Formato no admitido. Fotos JPG, PNG o WebP; audio OGG, WAV, MP3, M4A o WebM; video MP4 o WebM. HEIC y MOV necesitan una copia compatible.');
  if(file.size>mediaLimit(file.type)&&!normalizedType(file.type).startsWith('image/'))throw new Error('El audio o video supera 3 MiB. Elegí un fragmento más corto o usá la grabación de esta pantalla.');
}
export function recordingType(kind,Recorder=globalThis.MediaRecorder) {
  return RECORDING_PROFILES[kind]?.types.find(type=>Recorder?.isTypeSupported?.(type))||null;
}
async function decodeImage(file,signal) {
  if(typeof createImageBitmap==='function'){try{return await createImageBitmap(file,{imageOrientation:'from-image'});}catch{throw new Error('No se pudo abrir la fotografía. Elegí otra imagen JPEG, PNG o WebP válida.');}}
  const url=URL.createObjectURL(file);
  try {
    const image=new Image();image.src=url;
    await new Promise((resolve,reject)=>{
      const cancelled=()=>{cleanup();image.src='';reject(new DOMException('Preparación cancelada.','AbortError'));};
      const cleanup=()=>signal?.removeEventListener('abort',cancelled);
      signal?.addEventListener('abort',cancelled,{once:true});
      if(signal?.aborted){cancelled();cleanup();return;}
      try{image.decode().then(()=>{cleanup();resolve();},error=>{cleanup();reject(error);});}catch(error){cleanup();reject(error);}
    });
    return image;
  }catch(error){if(error.name==='AbortError')throw error;throw new Error('No se pudo abrir la fotografía. Elegí otra imagen JPEG, PNG o WebP válida.');}finally{URL.revokeObjectURL(url);}
}
const toBlob=(canvas,quality)=>new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Este navegador no pudo preparar la foto. Conservá el original y elegí otra copia.')),'image/jpeg',quality));
const photoBoundsMessage='La foto supera el tamaño seguro para este teléfono. Elegí una resolución menor; el original se conserva.';
const photoFormatMessage='Elegí JPEG, PNG o WebP. HEIC no se admite: guardá una copia JPEG desde tu teléfono.';
function checkCancelled(signal){if(signal?.aborted)throw new DOMException('Preparación cancelada.','AbortError');}
// Read only a bounded header before decoding. KYC callers supply stricter original limits.
export async function inspectPhoto(file,{maxOriginalBytes,maxPixels,maxDimension}={},signal) {
  if(!file?.size)throw new Error('El archivo está vacío. Elegí otra fotografía.');
  if(!['image/jpeg','image/png','image/webp'].includes(normalizedType(file.type)))throw new Error(photoFormatMessage);
  if(!Number.isSafeInteger(maxOriginalBytes)||maxOriginalBytes<1||!Number.isSafeInteger(maxPixels)||maxPixels<1||!Number.isSafeInteger(maxDimension)||maxDimension<1)throw new Error('No se pudo comprobar el límite seguro de la fotografía.');
  if(file.size>maxOriginalBytes)throw new Error(photoBoundsMessage);
  checkCancelled(signal);
  const bytes=new Uint8Array(await file.slice(0,256*1024).arrayBuffer()),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  checkCancelled(signal);
  let width=0,height=0;
  const ascii=(start,length)=>String.fromCharCode(...bytes.subarray(start,start+length));
  if(bytes.length>=24&&bytes[0]===137&&ascii(1,3)==='PNG'&&bytes[4]===13&&bytes[5]===10&&bytes[6]===26&&bytes[7]===10&&ascii(12,4)==='IHDR'){
    width=view.getUint32(16);height=view.getUint32(20);
  }else if(bytes.length>=4&&bytes[0]===255&&bytes[1]===216){
    let at=2;
    while(at+3<bytes.length){
      if(bytes[at++]!==255)break;
      while(bytes[at]===255)at++;
      const marker=bytes[at++];if(marker===217||marker===218)break;
      if(marker===1||marker>=208&&marker<=215)continue;
      if(at+2>bytes.length)break;
      const length=view.getUint16(at);if(length<2||at+length>bytes.length)break;
      if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)&&length>=8){height=view.getUint16(at+3);width=view.getUint16(at+5);break;}
      at+=length;
    }
  }else if(bytes.length>=30&&ascii(0,4)==='RIFF'&&ascii(8,4)==='WEBP'){
    const chunk=ascii(12,4),uint24=at=>bytes[at]+bytes[at+1]*256+bytes[at+2]*65536;
    if(chunk==='VP8X'){width=1+uint24(24);height=1+uint24(27);}
    else if(chunk==='VP8 '&&bytes[23]===157&&bytes[24]===1&&bytes[25]===42){width=view.getUint16(26,true)&16383;height=view.getUint16(28,true)&16383;}
    else if(chunk==='VP8L'&&bytes[20]===47){const bits=view.getUint32(21,true);width=1+(bits&16383);height=1+((bits>>>14)&16383);}
  }
  if(!width||!height)throw new Error('No se pudo comprobar la fotografía. Elegí un JPEG, PNG o WebP válido con menor tamaño.');
  if(width>maxDimension||height>maxDimension||width*height>maxPixels)throw new Error(photoBoundsMessage);
  return {width,height};
}
function decodedPhotoDimensions(image,originalLimits){
  const width=image.width||image.naturalWidth,height=image.height||image.naturalHeight;
  if(!width||!height||width*height>(originalLimits?.maxPixels??100000000)||originalLimits&&(width>originalLimits.maxDimension||height>originalLimits.maxDimension))throw new Error(photoBoundsMessage);
  return {width,height};
}
export async function verifyPhoto(file,{originalLimits,signal}={}){
  await inspectPhoto(file,originalLimits,signal);checkCancelled(signal);
  const image=await decodeImage(file,signal);
  try{checkCancelled(signal);return decodedPhotoDimensions(image,originalLimits);}finally{image.close?.();}
}
export async function preparePhoto(file,{rotation=0,maxBytes=PHOTO_LIMIT,originalLimits,signal}={}) {
  validateLocalMedia(file);
  if(!normalizedType(file.type).startsWith('image/'))throw new Error('La preparación local se aplica a fotografías.');
  if(!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>PHOTO_LIMIT||!Number.isFinite(rotation)||rotation%90!==0)throw new Error('La configuración de la copia no es válida.');
  if(originalLimits)await inspectPhoto(file,originalLimits,signal);
  checkCancelled(signal);
  const image=await decodeImage(file,signal);
  try {
    checkCancelled(signal);
    const {width,height}=decodedPhotoDimensions(image,originalLimits);
    const quarter=((rotation%360)+360)%360,sideways=quarter===90||quarter===270;
    let scale=Math.min(1,2560/Math.max(width,height));
    for(let round=0;round<7;round++) {
      const w=Math.max(1,Math.round(width*scale)),h=Math.max(1,Math.round(height*scale)),canvas=document.createElement('canvas');
      canvas.width=sideways?h:w;canvas.height=sideways?w:h;
      const context=canvas.getContext('2d');if(!context)throw new Error('No se pudo preparar la foto en este navegador.');
      context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.translate(canvas.width/2,canvas.height/2);context.rotate(quarter*Math.PI/180);context.drawImage(image,-w/2,-h/2,w,h);
      for(const quality of [.88,.76,.64,.5]) {
        checkCancelled(signal);
        const blob=await toBlob(canvas,quality);
        checkCancelled(signal);
        if(blob.size<=maxBytes)return {file:new File([blob],(file.name?.replace(/\.[^.]*$/,'')||'foto')+'-copia.jpg',{type:'image/jpeg',lastModified:Date.now()}),width:canvas.width,height:canvas.height,rotation:quarter};
      }
      scale*=.75;
    }
    throw new Error('No se logró una copia menor a '+(maxBytes/1024/1024)+' MiB. Elegí una foto con menor resolución; el original se conserva.');
  } finally {image.close?.();}
}
