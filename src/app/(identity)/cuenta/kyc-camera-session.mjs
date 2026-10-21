// Device-local camera ownership only. Capturing returns a File for the existing
// photo preparation/review; this module has no transport or consent operation.
const stopTracks=stream=>{for(const track of stream?.getTracks()||[]){try{track.stop();}catch{/* Release the remaining tracks even if a device has already disappeared. */}}};
export function createKycCameraSession({
 getVideo,
 isAllowed=()=>true,
 onState=()=>{},
 getUserMedia=constraints=>navigator.mediaDevices.getUserMedia(constraints),
 cameraAvailable=()=>Boolean(globalThis.navigator?.mediaDevices?.getUserMedia),
 createCanvas=()=>document.createElement('canvas'),
 createFile=(parts,name,options)=>new File(parts,name,options),
}={}){
 let run=null,disposed=false,generation=0;
 const allowed=()=>!disposed&&isAllowed();
 const current=value=>allowed()&&run===value&&value.generation===generation;
 const emit=(phase,error=null)=>{if(!disposed)onState({phase,error});};
 function release(value){
  if(!value)return;
  for(const track of value.stream?.getTracks()||[])track.removeEventListener?.('ended',value.ended);
  stopTracks(value.stream);
  if(value.video?.srcObject===value.stream){value.video.pause?.();value.video.srcObject=null;}
  value.stream=null;
 }
 function close(){generation++;const previous=run;run=null;release(previous);emit('CLOSED');}
 function fail(value,error){if(run!==value){release(value);return;}generation++;run=null;release(value);emit('CLOSED',error);}
 async function open(kind){
  if(!allowed()||run)return false;
  if(!cameraAvailable()){emit('CLOSED','UNAVAILABLE');return false;}
  const value={generation:++generation,stream:null,video:null,capturing:false,kind};run=value;emit('PERMISSION');
  try{
   const stream=await getUserMedia({audio:false,video:{facingMode:{ideal:kind==='selfie'?'user':'environment'},width:{ideal:1920},height:{ideal:1440}}});
   if(!current(value)){stopTracks(stream);if(run===value)close();return false;}
   value.stream=stream;value.video=getVideo?.();
   if(!value.video){fail(value,'UNAVAILABLE');return false;}
   value.ended=()=>{if(current(value))fail(value,'ENDED');};
   for(const track of stream.getTracks())track.addEventListener?.('ended',value.ended);
   value.video.srcObject=stream;await value.video.play();
   if(!current(value)){release(value);if(run===value)close();return false;}
   value.live=true;emit('LIVE');return true;
  }catch(error){if(run===value)fail(value,error?.name==='NotAllowedError'||error?.name==='SecurityError'?'PERMISSION_DENIED':'UNAVAILABLE');return false;}
 }
 async function capture(){
  const value=run;if(!value||!current(value)||!value.stream||!value.live||value.capturing)return null;
  const width=value.video.videoWidth,height=value.video.videoHeight;
  if(value.video.readyState<2||!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||width>12000||height>12000||width*height>24_000_000){emit('LIVE','FRAME_UNAVAILABLE');return null;}
  value.capturing=true;emit('CAPTURING');
  try{
   const canvas=createCanvas(),scale=Math.min(1,2560/Math.max(width,height));canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
   const context=canvas.getContext('2d');if(!context)throw new Error('CAPTURE_UNAVAILABLE');
   // The video element may be mirrored by CSS for comfort. The pixels drawn
   // here always retain the camera's original, unmirrored orientation.
   context.drawImage(value.video,0,0,canvas.width,canvas.height);
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.92));
   if(!current(value)){if(run===value)close();return null;}
   if(!blob?.size||blob.type!=='image/jpeg')throw new Error('CAPTURE_UNAVAILABLE');
   const file=createFile([blob],value.kind==='selfie'?'selfie.jpg':value.kind==='back'?'documento-dorso.jpg':'documento-frente.jpg',{type:'image/jpeg'});
   close();return file;
  }catch{if(current(value)){value.capturing=false;emit('LIVE','CAPTURE_FAILED');}return null;}
 }
 function dispose(){disposed=true;generation++;const previous=run;run=null;release(previous);}
 return Object.freeze({open,capture,close,dispose});
}
