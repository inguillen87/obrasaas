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
async function decodeImage(file) {
  if(typeof createImageBitmap==='function')return createImageBitmap(file,{imageOrientation:'from-image'});
  const url=URL.createObjectURL(file);
  try {const image=new Image();image.src=url;await image.decode();return image;}finally{URL.revokeObjectURL(url);}
}
const toBlob=(canvas,quality)=>new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Este navegador no pudo preparar la foto. Conservá el original y elegí otra copia.')),'image/jpeg',quality));
export async function preparePhoto(file,{rotation=0}={}) {
  validateLocalMedia(file);
  if(!normalizedType(file.type).startsWith('image/'))throw new Error('La preparación local se aplica a fotografías.');
  const image=await decodeImage(file);
  try {
    const width=image.width||image.naturalWidth,height=image.height||image.naturalHeight;
    if(!width||!height||width*height>100000000)throw new Error('La foto es demasiado grande para prepararla con seguridad en este teléfono. Elegí una resolución menor; el original se conserva.');
    const quarter=((rotation%360)+360)%360,sideways=quarter===90||quarter===270;
    let scale=Math.min(1,2560/Math.max(width,height));
    for(let round=0;round<7;round++) {
      const w=Math.max(1,Math.round(width*scale)),h=Math.max(1,Math.round(height*scale)),canvas=document.createElement('canvas');
      canvas.width=sideways?h:w;canvas.height=sideways?w:h;
      const context=canvas.getContext('2d');if(!context)throw new Error('No se pudo preparar la foto en este navegador.');
      context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.translate(canvas.width/2,canvas.height/2);context.rotate(quarter*Math.PI/180);context.drawImage(image,-w/2,-h/2,w,h);
      for(const quality of [.88,.76,.64,.5]) {
        const blob=await toBlob(canvas,quality);
        if(blob.size<=PHOTO_LIMIT)return {file:new File([blob],(file.name?.replace(/\.[^.]*$/,'')||'foto')+'-copia.jpg',{type:'image/jpeg',lastModified:Date.now()}),width:canvas.width,height:canvas.height,rotation:quarter};
      }
      scale*=.75;
    }
    throw new Error('No se logró una copia menor a 2 MiB. Elegí una foto con menor resolución; el original se conserva.');
  } finally {image.close?.();}
}
