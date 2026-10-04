const MAX_CONTENT_LENGTH=2048,MAX_FRAME_EDGE=960,MAX_INTRINSIC_EDGE=16384;
const validId=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
const invalidQr=()=>Object.assign(new Error('El QR no corresponde a este sector o su contenido no es válido.'),{code:'FIELD_QR_INVALID'});
const boundedContent=value=>typeof value==='string'&&value.length>0&&value.length<=MAX_CONTENT_LENGTH?value:null;

export function parseFieldQr(raw,{projectId,sectorId}={}){
 if(!boundedContent(raw)||!validId(projectId)||!validId(sectorId))throw invalidQr();
 let value;try{value=JSON.parse(raw);}catch{throw invalidQr();}
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join('|')!=='projectId|sectorId|token|version'||value.version!==1||value.projectId!==projectId||value.sectorId!==sectorId||typeof value.token!=='string'||!/^[a-f0-9]{64}$/.test(value.token))throw invalidQr();
 return raw;
}

// Camera ownership stays in the component. This reader only inspects a local
// frame and has no network, upload, persistence or provider operation.
export function createFieldQrReader({nativeDetector=globalThis.BarcodeDetector,makeCanvas=()=>document.createElement('canvas'),loadDecoder=()=>import('jsqr'),signal}={}){
 let disposed=false,reading=false,canvas=null,context=null,nativePromise=null,decoderPromise=null,nativeFailed=false;
 let cancelRead;const cancelled=new Promise(resolve=>{cancelRead=resolve;});
 function dispose(){
  if(disposed)return;disposed=true;cancelRead();signal?.removeEventListener('abort',dispose);
  if(canvas){try{canvas.width=0;canvas.height=0;}catch{/* The detached frame is no longer used. */}}
  context=null;canvas=null;
 }
 const wait=promise=>Promise.race([
  Promise.resolve(promise).then(value=>({value}),()=>({failed:true})),
  cancelled.then(()=>({cancelled:true})),
 ]);
 function native(){
  if(nativePromise)return nativePromise;
  nativePromise=(async()=>{try{
   if(typeof nativeDetector!=='function')return null;
   if(typeof nativeDetector.getSupportedFormats==='function'){
    const formats=await nativeDetector.getSupportedFormats();
    if(!Array.isArray(formats)||!formats.includes('qr_code'))return null;
   }
   if(disposed)return null;
   return new nativeDetector({formats:['qr_code']});
  }catch{return null;}})();return nativePromise;
 }
 function decoder(){
  if(!decoderPromise)decoderPromise=(async()=>{const loaded=await loadDecoder();const decode=typeof loaded==='function'?loaded:loaded?.default;return typeof decode==='function'?decode:null;})();
  return decoderPromise;
 }
 function localFrame(video,width,height){
  if(!canvas){canvas=makeCanvas();context=canvas?.getContext('2d',{willReadFrequently:true});}if(!context)return null;
  const ratio=Math.min(1,MAX_FRAME_EDGE/Math.max(width,height)),frameWidth=Math.max(1,Math.round(width*ratio)),frameHeight=Math.max(1,Math.round(height*ratio));
  if(canvas.width!==frameWidth)canvas.width=frameWidth;if(canvas.height!==frameHeight)canvas.height=frameHeight;
  context.drawImage(video,0,0,frameWidth,frameHeight);return {width:frameWidth,height:frameHeight};
 }
 async function read(video){
  if(disposed||reading)return null;
  const width=video?.videoWidth,height=video?.videoHeight;
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<=0||height<=0||width>MAX_INTRINSIC_EDGE||height>MAX_INTRINSIC_EDGE||Number.isFinite(video?.readyState)&&video.readyState<2)return null;
  reading=true;
  try{
   if(!nativeFailed){
    const selected=await wait(native());if(disposed||selected.cancelled)return null;
    if(selected.value){
     const frame=localFrame(video,width,height);if(!frame)return null;
     let result;try{result=await wait(selected.value.detect(canvas));}catch{result={failed:true};}
     if(disposed||result.cancelled)return null;
     if(!result.failed&&Array.isArray(result.value))return result.value.map(item=>boundedContent(item?.rawValue)).find(Boolean)||null;
     nativeFailed=true;
    }
   }
   const selected=await wait(decoder());if(disposed||selected.cancelled||selected.failed||!selected.value)return null;
   const size=localFrame(video,width,height);if(!size)return null;
   const frame=context.getImageData(0,0,size.width,size.height);if(disposed||!frame?.data||frame.data.length!==size.width*size.height*4)return null;
   const result=selected.value(frame.data,size.width,size.height,{inversionAttempts:'attemptBoth'});return disposed?null:boundedContent(result?.data);
  }catch{return null;}finally{reading=false;}
 }
 if(signal?.aborted)dispose();else signal?.addEventListener('abort',dispose,{once:true});
 return {read,dispose};
}
