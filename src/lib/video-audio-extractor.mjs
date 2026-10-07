import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtemp,writeFile,readFile,stat,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {performance} from 'node:perf_hooks';
import ffmpegPath from 'ffmpeg-static';
import {VIDEO_LIMITS,VideoFrameError} from './video-frame-extractor.mjs';

export const VIDEO_AUDIO_EXTRACTION_VERSION='server-video-audio-v1';
export const VIDEO_AUDIO_LIMITS=Object.freeze({seconds:VIDEO_LIMITS.seconds,sampleRate:16000,samples:640000,dataBytes:1280000,wavBytes:1345536,sourceRate:192000,channels:8,frames:16384,gaps:256,stderrBytes:4*1024*1024});
export const VIDEO_AUDIO_FILTER='asettb=1/sr,ashowinfo,aresample=16000:async=1:first_pts=0:min_hard_comp=0:min_comp=0';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=code=>{throw new VideoFrameError(code);};
const invalid=()=>fail('FIELD_VIDEO_AUDIO_OUTPUT_INVALID');

// Integer PTS are measured BEFORE compensation in the native sample timebase.
// Retain a bounded summary of discontinuities, never a full decoder log.
export function createDecodedAudioTimingReader({sampleRate,channels}){
 if(!Number.isInteger(sampleRate)||sampleRate<8000||sampleRate>VIDEO_AUDIO_LIMITS.sourceRate||!Number.isInteger(channels)||channels<1||channels>VIDEO_AUDIO_LIMITS.channels)invalid();
 let pending='',count=0,totalSamples=0,firstPts=null,lastPts=null,lastEnd=null,maxEnd=-Infinity;
 const gaps=[];
 const line=value=>{
  if(!value.includes('ashowinfo')||! /\bn:\s*\d+/.test(value))return;
  const frame=/\bn:\s*(\d+)\s+pts:\s*(-?\d+)\s+pts_time:\S+.*\bchannels:(\d+).*\brate:(\d+)\s+nb_samples:(\d+)/.exec(value);
  if(!frame)invalid();
  const [index,pts,frameChannels,rate,samples]=frame.slice(1).map(Number),end=pts+samples;
  if(index!==count||count>=VIDEO_AUDIO_LIMITS.frames||![pts,samples,end].every(Number.isSafeInteger)||samples<=0||rate!==sampleRate||frameChannels!==channels||pts<-sampleRate||(lastPts!==null&&pts<lastPts))invalid();
  if(end>VIDEO_AUDIO_LIMITS.seconds*sampleRate)fail('FIELD_VIDEO_AUDIO_DURATION_INVALID');
  if(lastEnd!==null&&pts!==lastEnd){
   if(gaps.length>=VIDEO_AUDIO_LIMITS.gaps)invalid();
   const delta=pts-lastEnd;
   gaps.push({afterFrame:count-1,startPts:lastEnd,endPts:pts,deltaNativeSamples:delta,roundedOutputSamples:Math.round(delta*VIDEO_AUDIO_LIMITS.sampleRate/sampleRate)});
  }
  firstPts??=pts;lastPts=pts;lastEnd=end;maxEnd=Math.max(maxEnd,end);totalSamples+=samples;count++;
  if(!Number.isSafeInteger(totalSamples)||totalSamples>sampleRate*(VIDEO_AUDIO_LIMITS.seconds+1))invalid();
 };
 return {
  push(chunk){pending+=String(chunk);let end;while((end=pending.indexOf('\n'))>=0){if(end>8192)invalid();line(pending.slice(0,end));pending=pending.slice(end+1);}if(pending.length>8192)invalid();},
  finish(){if(pending)line(pending);pending='';if(!count||maxEnd<=0)invalid();return {timestampAuthority:'DECODED_AUDIO_FRAME_PTS_AFTER_FFMPEG_INPUT_NORMALIZATION',timeBase:{numerator:1,denominator:sampleRate},firstPts,lastEndPts:lastEnd,maxEndPts:maxEnd,decodedFrames:count,decodedSamplesPerChannel:totalSamples,gaps};}
 };
}

// A streaming float conversion preserves per-channel digital zero for the
// supported native integer/float32 codecs. No native PCM is accumulated.
export function createNativeAudioEnergyReader({sampleRate,channels}){
 if(!Number.isInteger(sampleRate)||sampleRate<8000||sampleRate>VIDEO_AUDIO_LIMITS.sourceRate||!Number.isInteger(channels)||channels<1||channels>VIDEO_AUDIO_LIMITS.channels)invalid();
 let carry=Buffer.alloc(0),values=0;
 const rows=Array.from({length:channels},()=>({nonzeroSamples:0,peak:0,sumSquares:0}));
 const limit=Math.ceil(sampleRate*(VIDEO_AUDIO_LIMITS.seconds+1))*channels;
 return {
  push(chunk){
   const input=carry.length?Buffer.concat([carry,chunk]):chunk,usable=input.length-input.length%4;
   for(let offset=0;offset<usable;offset+=4){
    if(values>=limit)invalid();const value=input.readFloatLE(offset);if(!Number.isFinite(value))invalid();
    const row=rows[values%channels];if(value!==0)row.nonzeroSamples++;row.peak=Math.max(row.peak,Math.abs(value));row.sumSquares+=value*value;if(!Number.isFinite(row.sumSquares))invalid();values++;
   }
   carry=Buffer.from(input.subarray(usable));
  },
  finish(){if(carry.length||!values||values%channels)invalid();const samplesPerChannel=values/channels;return {authority:'DECODED_NATIVE_CHANNELS_FLOAT32_STREAM',samplesPerChannel,allChannelsDigitalZero:rows.every(row=>row.nonzeroSamples===0),channels:rows.map(row=>({nonzeroSamples:row.nonzeroSamples,peak:row.peak,rms:Math.sqrt(row.sumSquares/samplesPerChannel)}))};}
 };
}

// RIFF chunks can contain metadata and padding; a 44-byte WAV assumption is unsafe.
export function readCanonicalVideoAudioWav(input){
 if(!(input instanceof Uint8Array)||input.length>VIDEO_AUDIO_LIMITS.wavBytes)invalid();
 const buffer=Buffer.from(input);if(buffer.length<44||buffer.toString('ascii',0,4)!=='RIFF'||buffer.toString('ascii',8,12)!=='WAVE'||buffer.readUInt32LE(4)+8!==buffer.length)invalid();
 let offset=12,format=null,data=null;
 while(offset<buffer.length){
  if(offset+8>buffer.length)invalid();const name=buffer.toString('ascii',offset,offset+4),size=buffer.readUInt32LE(offset+4),start=offset+8,end=start+size,next=end+size%2;
  if(end>buffer.length||next>buffer.length)invalid();
  if(name==='fmt '){if(format||size<16)invalid();format={encoding:buffer.readUInt16LE(start),channels:buffer.readUInt16LE(start+2),sampleRate:buffer.readUInt32LE(start+4),byteRate:buffer.readUInt32LE(start+8),blockAlign:buffer.readUInt16LE(start+12),bitsPerSample:buffer.readUInt16LE(start+14)};}
  if(name==='data'){if(data)invalid();data={offset:start,bytes:size};}offset=next;
 }
 if(!format||!data||format.encoding!==1||format.channels!==1||format.sampleRate!==16000||format.byteRate!==32000||format.blockAlign!==2||format.bitsPerSample!==16||!data.bytes||data.bytes%2||data.bytes>VIDEO_AUDIO_LIMITS.dataBytes)invalid();
 let peak=0,nonzeroSamples=0;for(let index=data.offset;index<data.offset+data.bytes;index+=2){const value=buffer.readInt16LE(index);if(value!==0)nonzeroSamples++;peak=Math.max(peak,Math.abs(value));}
 return {...format,dataBytes:data.bytes,sampleCount:data.bytes/2,durationSeconds:data.bytes/32000,nonzeroSamples,peak,dataOffset:data.offset};
}

function inputVideo(buffer,mimeType){
 if(!(buffer instanceof Uint8Array)||!buffer.length||buffer.length>VIDEO_LIMITS.bytes)fail('FIELD_VIDEO_AUDIO_INPUT_INVALID');
 const bytes=Buffer.from(buffer),mime=String(mimeType||'').split(';')[0].trim().toLowerCase();
 const mp4=bytes.length>12&&bytes.subarray(4,8).toString()==='ftyp',webm=bytes.length>8&&bytes.subarray(0,4).equals(Buffer.from('1a45dfa3','hex'));
 if(!(mime==='video/mp4'&&mp4)&&!(mime==='video/webm'&&webm))fail('FIELD_VIDEO_AUDIO_INPUT_INVALID');return {bytes,mime,extension:mime==='video/mp4'?'mp4':'webm'};
}
function readProbe(stderr){
 // FFmpeg records have exactly two leading spaces; metadata values have a
 // key/colon prefix (including continuation lines). Never parse substrings.
 const video=/^ {2}Stream #0:(\d+)[^\r\n]*: Video: (\w+)[^\r\n]*?\b(\d{2,5})x(\d{2,5})\b/m.exec(stderr);
 if(!video||!['h264','hevc','vp8','vp9','av1'].includes(video[2])||Number(video[3])>VIDEO_LIMITS.sourceDimension||Number(video[4])>VIDEO_LIMITS.sourceDimension)fail('FIELD_VIDEO_AUDIO_UNSUPPORTED');
 const declared=/^ {2}Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/m.exec(stderr),start=/^ {2}Duration:[^\r\n]*\bstart:\s*(-?\d+(?:\.\d+)?)/m.exec(stderr);
 if(declared&&Number(declared[1])*3600+Number(declared[2])*60+Number(declared[3])>VIDEO_LIMITS.seconds)fail('FIELD_VIDEO_AUDIO_DURATION_INVALID');
 const rows=[...stderr.matchAll(/^ {2}Stream #0:(\d+)[^\r\n]*: Audio: ([\w]+)[^\r\n]*?, (\d+) Hz, ([^,\r\n]+)/gm)];
 if(!rows.length){if(/^ {2}Stream #0:[^\r\n]*: Audio:/m.test(stderr))fail('FIELD_VIDEO_AUDIO_UNSUPPORTED');return {stream:null,containerStartSeconds:start?Number(start[1]):null};}
 const first=rows[0],layout=first[4].trim(),layouts={mono:1,stereo:2,'2.1':3,'3.0':3,quad:4,'4.0':4,'5.0':5,'5.0(side)':5,'5.1':6,'5.1(side)':6,'6.1':7,'7.1':8,'7.1(wide)':8};
 const channels=layouts[layout]??Number(/^(\d+) channels(?:\s|$)/.exec(layout)?.[1]),sampleRate=Number(first[3]);
 // Float64-to-float32 underflow cannot justify a digital-silence assertion.
 const supported=['aac','opus','vorbis','mp3','ac3','eac3','alac','flac','pcm_s16le','pcm_s24le','pcm_s32le','pcm_u8','pcm_s16be','pcm_f32le'];
 if(!supported.includes(first[2])||!Number.isInteger(sampleRate)||sampleRate<8000||sampleRate>VIDEO_AUDIO_LIMITS.sourceRate||!Number.isInteger(channels)||channels<1||channels>VIDEO_AUDIO_LIMITS.channels)fail('FIELD_VIDEO_AUDIO_UNSUPPORTED');
 return {stream:{ordinal:0,index:Number(first[1]),codec:first[2],sampleRate,channels},containerStartSeconds:start?Number(start[1]):null};
}
const common=['-nostdin','-hide_banner','-loglevel','info','-xerror','-max_alloc','67108864','-threads','1','-filter_threads','1','-protocol_whitelist','file','-format_whitelist','mov,matroska,webm'];
function execute(binary,args,{deadline,signal,probe=false,onStdout,timing,streamIndex,streamCodec}){
 if(signal?.aborted)fail('FIELD_VIDEO_AUDIO_CANCELLED');const remaining=deadline-performance.now();if(remaining<=0)fail('FIELD_VIDEO_AUDIO_DECODE_TIMEOUT');
 return new Promise((resolve,reject)=>{
  const child=spawn(binary,args,{shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let stdoutBytes=0,stderrBytes=0,tail=Buffer.alloc(0),terminalError=null,mappingPending='',mappingStarted=false,mappedRows=[];
  const stop=error=>{terminalError ||= error instanceof VideoFrameError?error:new VideoFrameError(error);child.kill('SIGKILL');};
  const onAbort=()=>stop('FIELD_VIDEO_AUDIO_CANCELLED'),timer=setTimeout(()=>stop('FIELD_VIDEO_AUDIO_DECODE_TIMEOUT'),remaining);
  signal?.addEventListener('abort',onAbort,{once:true});if(signal?.aborted)onAbort();
  const clean=()=>{clearTimeout(timer);signal?.removeEventListener('abort',onAbort);};
  child.stdout.on('data',chunk=>{if(terminalError)return;try{if(onStdout)onStdout(chunk);else {stdoutBytes+=chunk.length;if(stdoutBytes>128*1024)invalid();}}catch(error){stop(error);}});
  child.stderr.on('data',chunk=>{
   if(terminalError)return;try{
    stderrBytes+=chunk.length;if(stderrBytes>(probe?128*1024:VIDEO_AUDIO_LIMITS.stderrBytes))invalid();
    const text=chunk.toString('utf8');timing?.push(text);
    if(streamIndex!==undefined){mappingPending+=text;let end;while((end=mappingPending.indexOf('\n'))>=0){if(end>8192)invalid();const line=mappingPending.slice(0,end);if(line.trim()==='Stream mapping:')mappingStarted=true;const match=/^\s*Stream #0:(\d+)\s*->\s*#0:0\s+\((\w+)\s/.exec(line);if(mappingStarted&&match){mappedRows.push({index:Number(match[1]),codec:match[2]});if(mappedRows.length>1)invalid();}mappingPending=mappingPending.slice(end+1);}if(mappingPending.length>8192)invalid();}
    const next=Buffer.concat([tail,chunk]);tail=next.subarray(Math.max(0,next.length-(probe?128*1024:32768)));
   }catch(error){stop(error);}
  });
  child.once('error',()=>{terminalError ||= new VideoFrameError('FIELD_VIDEO_AUDIO_DECODER_UNAVAILABLE');});
  child.once('close',code=>{
   clean();if(terminalError)return reject(terminalError);const stderr=tail.toString('utf8');
   if(code!==0&&!(probe&&code===1&&stderr.includes('At least one output file must be specified')))return reject(new VideoFrameError('FIELD_VIDEO_AUDIO_DECODE_INVALID'));
   try{if(streamIndex!==undefined&&(mappedRows.length!==1||mappedRows[0].index!==streamIndex||mappedRows[0].codec!==streamCodec))invalid();resolve({stderr,timing:timing?.finish()});}catch(error){reject(error);}
  });
 });
}

export function createVideoAudioExtractor({binaryPath=ffmpegPath,timeoutMs=20000}={}){
 if(typeof binaryPath!=='string'||!binaryPath||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000)fail('FIELD_VIDEO_AUDIO_CONFIG_INVALID');
 return async({buffer,mimeType,signal}={})=>{
  if(signal!==undefined&&(!(signal instanceof AbortSignal)))fail('FIELD_VIDEO_AUDIO_INPUT_INVALID');
  if(signal?.aborted)fail('FIELD_VIDEO_AUDIO_CANCELLED');const source=inputVideo(buffer,mimeType),deadline=performance.now()+timeoutMs;
  const directory=await mkdtemp(join(tmpdir(),'obrasaas-video-audio-'));
  try{
   const input=join(directory,`source.${source.extension}`),output=join(directory,'audio.wav');await writeFile(input,source.bytes,{mode:0o600,flag:'wx'});
   const probe=await execute(binaryPath,[...common,'-i',input],{deadline,signal,probe:true}),facts=readProbe(probe.stderr);
   const extraction={version:VIDEO_AUDIO_EXTRACTION_VERSION,sourceSha256:hash(source.bytes),sourceBytes:source.bytes.length,sourceContentType:source.mime,sourceStream:facts.stream,inputOrigin:{authority:'FFMPEG_DEFAULT_INPUT_START_NORMALIZATION',containerDeclaredStartSeconds:facts.containerStartSeconds,audioOnlyRebaseApplied:false},priming:{authority:'NOT_VERIFIED',codecDelaySamples:null,preSkipSamples:null,editListVerified:false},sourceVideoFullDecodeVerified:false,wordTimestampsAvailable:false,requiresHumanReview:true,nativeEnergy:null,timing:null,pcm:null};
   if(!facts.stream)return {status:'NO_AUDIO_TRACK',audio:null,extraction};
   const native=createNativeAudioEnergyReader(facts.stream),timing=createDecodedAudioTimingReader(facts.stream),selection=['-i',input,'-t',String(VIDEO_LIMITS.seconds+.1),'-map','0:a:0','-vn','-sn','-dn','-map_metadata','-1'];
   const decoded=await execute(binaryPath,[...common,...selection,'-af','asettb=1/sr,ashowinfo','-c:a','pcm_f32le','-f','f32le','pipe:1'],{deadline,signal,onStdout:chunk=>native.push(chunk),timing,streamIndex:facts.stream.index,streamCodec:facts.stream.codec});
   extraction.nativeEnergy=native.finish();extraction.timing=decoded.timing;
   if(extraction.nativeEnergy.samplesPerChannel!==extraction.timing.decodedSamplesPerChannel)invalid();
   if(extraction.nativeEnergy.allChannelsDigitalZero)return {status:'DIGITAL_SILENCE',audio:null,extraction};
   const canonical=await execute(binaryPath,[...common,...selection,'-af',VIDEO_AUDIO_FILTER,'-ac','1','-c:a','pcm_s16le','-fs',String(VIDEO_AUDIO_LIMITS.wavBytes+2),'-f','wav',output],{deadline,signal,timing:createDecodedAudioTimingReader(facts.stream),streamIndex:facts.stream.index,streamCodec:facts.stream.codec});
   if(JSON.stringify(canonical.timing)!==JSON.stringify(extraction.timing))invalid();
   if(signal?.aborted)fail('FIELD_VIDEO_AUDIO_CANCELLED');if(performance.now()>=deadline)fail('FIELD_VIDEO_AUDIO_DECODE_TIMEOUT');
   const size=(await stat(output)).size;if(!size||size>VIDEO_AUDIO_LIMITS.wavBytes)invalid();const audio=await readFile(output),pcm=readCanonicalVideoAudioWav(audio);extraction.pcm=pcm;
   if(signal?.aborted)fail('FIELD_VIDEO_AUDIO_CANCELLED');if(performance.now()>=deadline)fail('FIELD_VIDEO_AUDIO_DECODE_TIMEOUT');
   if(!pcm.nonzeroSamples)return {status:'UNCONFIRMED_DOWNMIX',audio:null,extraction};
   return {status:'SIGNAL_UNREVIEWED',audio:{buffer:audio,mimeType:'audio/wav',bytes:audio.length,sha256:hash(audio)},extraction};
  }finally{await rm(directory,{recursive:true,force:true});}
 };
}
