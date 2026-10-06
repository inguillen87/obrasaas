import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtemp,writeFile,readFile,stat,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import {decodePrivateImage} from './private-image-upload.mjs';

export const VIDEO_SAMPLING_VERSION='server-video-frames-v1';
export const VIDEO_LIMITS=Object.freeze({bytes:3*1024*1024,seconds:40,frames:4,dimension:768,sourceDimension:4096,frameBytes:256*1024,totalFrameBytes:1024*1024});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export class VideoFrameError extends Error {
 constructor(code){super('No se pudo confirmar el análisis del video. Conservamos el original para revisión.');this.name='VideoFrameError';this.code=code;}
}
const fail=code=>{throw new VideoFrameError(code);};
function inputVideo(buffer,mimeType){
 if(!(buffer instanceof Uint8Array)||!buffer.length||buffer.length>VIDEO_LIMITS.bytes)fail('FIELD_VIDEO_INPUT_INVALID');
 const bytes=Buffer.from(buffer),mime=String(mimeType||'').split(';')[0].trim().toLowerCase();
 const mp4=bytes.length>12&&bytes.subarray(4,8).toString()==='ftyp',webm=bytes.length>8&&bytes.subarray(0,4).equals(Buffer.from('1a45dfa3','hex'));
 if(!(mime==='video/mp4'&&mp4)&&!(mime==='video/webm'&&webm))fail('FIELD_VIDEO_INPUT_INVALID');
 return {bytes,mime,extension:mime==='video/mp4'?'mp4':'webm'};
}
// Only a packaged local binary and generated local paths reach the subprocess.
// Neither shell interpolation nor remote/playlist input is supported.
function execute(binary,args,{deadline,acceptProbeExit=false,keepStderrTail=false}){
 const remaining=deadline-Date.now();if(remaining<=0)fail('FIELD_VIDEO_DECODE_TIMEOUT');
 return new Promise((resolve,reject)=>{
  const child=spawn(binary,args,{shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']});
  const output=[],errors=[];let size=0,terminalError=null;
  const stop=code=>{terminalError ||= new VideoFrameError(code);child.kill('SIGKILL');};
  const timer=setTimeout(()=>stop('FIELD_VIDEO_DECODE_TIMEOUT'),remaining);
  const collect=target=>chunk=>{size+=chunk.length;if(size>128*1024)stop('FIELD_VIDEO_OUTPUT_INVALID');else target.push(chunk);};
  child.stdout.on('data',collect(output));child.stderr.on('data',chunk=>{
   if(!keepStderrTail)return collect(errors)(chunk);
   const tail=Buffer.concat([...errors,chunk]);errors.splice(0,errors.length,tail.subarray(Math.max(0,tail.length-32768)));
  });
  child.once('error',()=>{clearTimeout(timer);reject(new VideoFrameError('FIELD_VIDEO_DECODER_UNAVAILABLE'));});
  child.once('close',code=>{clearTimeout(timer);if(terminalError)return reject(terminalError);const stdout=Buffer.concat(output).toString('utf8'),stderr=Buffer.concat(errors).toString('utf8');
   if(code!==0&&!(acceptProbeExit&&code===1&&stderr.includes('At least one output file must be specified')))return reject(new VideoFrameError('FIELD_VIDEO_DECODE_INVALID'));
   resolve({stdout,stderr});
  });
 });
}
export function createVideoFrameExtractor({binaryPath=ffmpegPath,timeoutMs=20000}={}){
 if(typeof binaryPath!=='string'||!binaryPath||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000)throw new Error('Invalid video decoder adapter');
 return async function extractVideoFrames({buffer,mimeType}={}){
  const input=inputVideo(buffer,mimeType),deadline=Date.now()+timeoutMs;
  const directory=await mkdtemp(join(tmpdir(),'obrasaas-video-'));
  try{
   const file=join(directory,'original.'+input.extension);await writeFile(file,input.bytes,{mode:0o600,flag:'wx'});
   const common=['-nostdin','-hide_banner','-loglevel','info','-max_alloc','67108864','-threads','1','-filter_threads','1','-protocol_whitelist','file','-format_whitelist','mov,matroska,webm'];
   const probe=await execute(binaryPath,[...common,'-i',file],{deadline,acceptProbeExit:true});
   const stream=/Stream #[^\r\n]*Video: ([a-z0-9_]+)[^\r\n]*?\b([0-9]{1,5})x([0-9]{1,5})\b/.exec(probe.stderr);
   if(!stream||!['h264','hevc','vp8','vp9','av1'].includes(stream[1])||Number(stream[2])<1||Number(stream[3])<1||Number(stream[2])>VIDEO_LIMITS.sourceDimension||Number(stream[3])>VIDEO_LIMITS.sourceDimension)fail('FIELD_VIDEO_UNSUPPORTED');
   const declared=/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(probe.stderr);
   if(declared&&Number(declared[1])*3600+Number(declared[2])*60+Number(declared[3])>VIDEO_LIMITS.seconds)fail('FIELD_VIDEO_DURATION_INVALID');
   // Decode the visual stream before sampling, including WebM with no declared
   // duration. The extra fraction detects overlong input instead of silently
   // describing the first 40 seconds as the complete uploaded video.
   const decoded=await execute(binaryPath,[...common,'-i',file,'-t','40.1','-map','0:v:0','-an','-sn','-dn','-vf','settb=AVTB,setpts=PTS-STARTPTS,showinfo','-fps_mode','passthrough','-nostats','-f','null','-'],{deadline,keepStderrTail:true});
   // Integer microseconds avoid the rounded pts_time text overstating 30 FPS
   // input duration (for example 1.96667 + .033333 is printed as 2.000003).
   const times=[...decoded.stderr.matchAll(/\bn:\s*\d+\s+pts:\s*([0-9]+)\s+pts_time:\S+\s+duration:\s*([0-9]+)/g)],last=times.at(-1);
   const durationSeconds=last?(Number(last[1])+Number(last[2]))/1000000:NaN;
   if(!Number.isFinite(durationSeconds)||durationSeconds<.1||durationSeconds>VIDEO_LIMITS.seconds)fail('FIELD_VIDEO_DURATION_INVALID');
   // The final frame starts before the container ends, especially at low FPS.
   // Seeking into its remaining display time can otherwise return no frame.
   const lastFrameStart=Number(last[1])/1000000;
   if(!Number.isFinite(lastFrameStart)||lastFrameStart<.01)fail('FIELD_VIDEO_UNSUPPORTED');
   const timestamps=[0,lastFrameStart/3,2*lastFrameStart/3,lastFrameStart].map(value=>Math.floor(value*1000)/1000);
   const frames=[];let total=0;
   for(const [index,capturedAtSeconds] of timestamps.entries()){
    const output=join(directory,`frame-${index}.jpg`);
    await execute(binaryPath,[...common,'-ss',String(capturedAtSeconds),'-i',file,'-map','0:v:0','-an','-sn','-dn','-frames:v','1','-vf','scale=w=min(768\\,iw):h=min(768\\,ih):force_original_aspect_ratio=decrease','-q:v','4','-threads','1','-f','image2',output],{deadline});
    const info=await stat(output).catch(()=>null);if(!info?.isFile()||info.size<1||info.size>VIDEO_LIMITS.frameBytes)fail('FIELD_VIDEO_OUTPUT_INVALID');
    const bytes=await readFile(output);total+=bytes.length;if(total>VIDEO_LIMITS.totalFrameBytes)fail('FIELD_VIDEO_OUTPUT_INVALID');
    let image;try{image=decodePrivateImage(bytes.toString('base64'),'image/jpeg');}catch{fail('FIELD_VIDEO_OUTPUT_INVALID');}
    frames.push({base64:image.bytes.toString('base64'),mimeType:image.contentType,capturedAtSeconds,sha256:image.digest,bytes:image.bytes.length});
   }
   return {frames,sampling:{version:VIDEO_SAMPLING_VERSION,sourceSha256:hash(input.bytes),sourceContentType:input.mime,sourceBytes:input.bytes.length,durationSeconds,frameCount:frames.length,maxDimension:VIDEO_LIMITS.dimension,timestampAuthority:'REQUESTED_SEEK_POSITION',audioAnalyzed:false,
    frames:frames.map(({base64,mimeType,...frame})=>({...frame,contentType:mimeType}))}};
  }catch(error){if(error instanceof VideoFrameError)throw error;throw new VideoFrameError('FIELD_VIDEO_DECODE_INVALID');}
  finally{await rm(directory,{recursive:true,force:true});}
 };
}
