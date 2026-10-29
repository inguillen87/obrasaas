// Device-local image guidance only. These checks measure exposure and detail;
// they do not recognize a face, document type, identity, or authenticity.
export const KYC_QUALITY_SAMPLE_LIMIT=640;
export const KYC_QUALITY_MIN_SHORT_SIDE=320;
export const KYC_QUALITY_MIN_LONG_SIDE=480;
const messages={
 READY:'Luz y nitidez adecuadas para preparar la foto. El encuadre se comprobará al enviar.',
 RESOLUTION:'La imagen es demasiado pequeña. Tomá otra fotografía con al menos 320 píxeles en su lado menor y 480 en su lado mayor.',
 DARK:'La imagen está muy oscura. Buscá luz pareja de frente y volvé a tomarla.',
 BRIGHT:'La imagen está casi toda blanca o sobreexpuesta. Evitá el reflejo y la luz directa y volvé a tomarla.',
 DETAIL:'No se distinguen detalles suficientes. Limpiá la lente, acercate y esperá a que enfoque antes de tomar otra fotografía.',
 UNAVAILABLE:'No pudimos comprobar la luz y la nitidez. Elegí otra imagen o volvé a tomar la fotografía.',
};
const result=(code,metrics=null)=>({ok:code==='READY',code,message:messages[code]||messages.UNAVAILABLE,metrics});
const checkCancelled=signal=>{if(signal?.aborted)throw new DOMException('Preparación cancelada.','AbortError');};
const dimensions=(width,height)=>Number.isSafeInteger(width)&&Number.isSafeInteger(height)&&width>0&&height>0&&width<=12000&&height<=12000&&width*height<=24_000_000;

export function evaluateKycImageQuality(sample={}, {signal}={}){
 checkCancelled(signal);
 const {data,width,height,sourceWidth=width,sourceHeight=height}=sample||{};
 if(!dimensions(sourceWidth,sourceHeight)||!dimensions(width,height)||width<3||height<3||width>KYC_QUALITY_SAMPLE_LIMIT||height>KYC_QUALITY_SAMPLE_LIMIT||!(data instanceof Uint8ClampedArray||data instanceof Uint8Array)||data.length!==width*height*4)return result('UNAVAILABLE');
 if(Math.min(sourceWidth,sourceHeight)<KYC_QUALITY_MIN_SHORT_SIDE||Math.max(sourceWidth,sourceHeight)<KYC_QUALITY_MIN_LONG_SIDE)return result('RESOLUTION');
 const count=width*height,luma=new Float32Array(count);let total=0,squares=0,dark=0,bright=0;
 for(let y=0;y<height;y++){
  checkCancelled(signal);
  for(let x=0;x<width;x++){
   const index=y*width+x,at=index*4,alpha=data[at+3]/255;
   // Match the white canvas background used for transparent PNG/WebP pixels.
   const value=(.2126*data[at]+.7152*data[at+1]+.0722*data[at+2])*alpha+255*(1-alpha);
   luma[index]=value;total+=value;squares+=value*value;if(value<=8)dark++;if(value>=250)bright++;
  }
 }
 const meanLuma=total/count,lumaVariance=Math.max(0,squares/count-meanLuma*meanLuma);let laplacian=0,laplacianSquares=0;
 for(let y=1;y<height-1;y++){
  checkCancelled(signal);
  for(let x=1;x<width-1;x++){
   const at=y*width+x,value=luma[at-1]+luma[at+1]+luma[at-width]+luma[at+width]-4*luma[at];
   laplacian+=value;laplacianSquares+=value*value;
  }
 }
 const interior=(width-2)*(height-2),laplacianVariance=Math.max(0,laplacianSquares/interior-(laplacian/interior)**2);
 const metrics={meanLuma,darkFraction:dark/count,brightFraction:bright/count,lumaVariance,laplacianVariance,sampleWidth:width,sampleHeight:height};
 // Deliberately reject only extreme exposure and missing detail. These are
 // conservative image-wide heuristics, not calibrated readability guarantees.
 if(metrics.darkFraction>=.985||meanLuma<14)return result('DARK',metrics);
 if(metrics.brightFraction>=.995||meanLuma>248&&lumaVariance<25)return result('BRIGHT',metrics);
 if(lumaVariance<18||laplacianVariance<10)return result('DETAIL',metrics);
 return result('READY',metrics);
}

function sampleQuality(image,width,height,{signal,createCanvas=()=>document.createElement('canvas')}={}){
 checkCancelled(signal);
 if(!dimensions(width,height))return result('UNAVAILABLE');
 if(Math.min(width,height)<KYC_QUALITY_MIN_SHORT_SIDE||Math.max(width,height)<KYC_QUALITY_MIN_LONG_SIDE)return result('RESOLUTION');
 const scale=Math.min(1,KYC_QUALITY_SAMPLE_LIMIT/Math.max(width,height)),canvas=createCanvas();
 try{
  canvas.width=Math.max(3,Math.round(width*scale));canvas.height=Math.max(3,Math.round(height*scale));
  const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)return result('UNAVAILABLE');
  context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
  checkCancelled(signal);
  const pixels=context.getImageData(0,0,canvas.width,canvas.height);
  return evaluateKycImageQuality({data:pixels.data,width:canvas.width,height:canvas.height,sourceWidth:width,sourceHeight:height},{signal});
 }finally{canvas.width=0;canvas.height=0;}
}

async function decodeLocalPhoto(file,{signal,decode}={}){
 checkCancelled(signal);
 if(decode||typeof globalThis.createImageBitmap==='function')return (decode||((source)=>globalThis.createImageBitmap(source,{imageOrientation:'from-image'})))(file);
 const url=URL.createObjectURL(file),image=new Image();
 try{
  image.src=url;
  await new Promise((resolve,reject)=>{
   let settled=false;
   const cleanup=()=>signal?.removeEventListener('abort',cancelled);
   const finish=(error)=>{if(settled)return;settled=true;cleanup();if(error)reject(error);else resolve();};
   const cancelled=()=>{image.src='';finish(new DOMException('Preparación cancelada.','AbortError'));};
   signal?.addEventListener('abort',cancelled,{once:true});
   if(signal?.aborted){cancelled();return;}
   try{image.decode().then(()=>finish(),error=>finish(error));}catch(error){finish(error);}
  });
  return image;
 }finally{URL.revokeObjectURL(url);}
}

export async function inspectKycPhotoQuality(file,{signal,decode,createCanvas}={}){
 let image;
 try{
  checkCancelled(signal);image=await decodeLocalPhoto(file,{signal,decode});checkCancelled(signal);
  return sampleQuality(image,image.width||image.naturalWidth,image.height||image.naturalHeight,{signal,createCanvas});
 }catch(error){if(error?.name==='AbortError'||signal?.aborted){checkCancelled(signal);throw error;}return result('UNAVAILABLE');}
 finally{image?.close?.();}
}

// A monitor belongs to one LIVE effect lifetime. It samples only the already
// visible stream; it never encodes a photograph, stores pixels, or captures it.
export function createKycQualityMonitor({getVideo,isAllowed=()=>true,onResult=()=>{},createCanvas,schedule=callback=>setTimeout(callback,1000),cancel=timer=>clearTimeout(timer)}={}){
 let timer=null,disposed=false,started=false;
 const allowed=()=>!disposed&&isAllowed();
 function tick(){
  timer=null;if(!allowed())return;
  const video=getVideo?.();
  if(video?.readyState>=2){
   let quality;try{quality=sampleQuality(video,video.videoWidth,video.videoHeight,{createCanvas});}catch{quality=result('UNAVAILABLE');}
   if(allowed())onResult(quality);
  }
  if(allowed())timer=schedule(tick);
 }
 function start(){if(started||!allowed())return;started=true;timer=schedule(tick);}
 function dispose(){disposed=true;if(timer!==null)cancel(timer);timer=null;}
 return Object.freeze({start,dispose});
}
