import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import ffmpegPath from 'ffmpeg-static';
import {createVideoAudioExtractor,createDecodedAudioTimingReader,createNativeAudioEnergyReader,readCanonicalVideoAudioWav,VIDEO_AUDIO_LIMITS,VIDEO_AUDIO_FILTER,VIDEO_AUDIO_EXTRACTION_VERSION} from '../src/lib/video-audio-extractor.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
let directory;
const fixtures=new Map();
function generate(args){const result=spawnSync(ffmpegPath,['-nostdin','-n','-hide_banner','-loglevel','error','-threads','1','-filter_threads','1',...args],{windowsHide:true,timeout:15000,maxBuffer:4*1024*1024});assert.equal(result.status,0,result.stderr?.toString());return result.stdout;}
const visual=['-f','lavfi','-i','testsrc2=size=160x90:rate=10:duration=5'];
const encoding=['-map','0:v:0','-c:v','libx264','-pix_fmt','yuv420p','-threads','1','-fps_mode','passthrough'];
const signal=rate=>`aevalsrc=0.12*(sin(2*PI*430*t)+0.3*sin(2*PI*997*t)+0.2*sin(2*PI*1451*t)):s=${rate}:d=4`;
async function fixture(name,args){const path=join(directory,`${name}.mp4`);generate([...args,path]);const value={path,buffer:await readFile(path)};fixtures.set(name,value);return value;}
before(async()=>{
 directory=await mkdtemp(join(tmpdir(),'obrasaas-synthetic-video-audio-test-'));
 await fixture('base',[...visual,'-f','lavfi','-i',signal(48000),...encoding,'-map','1:a:0','-c:a','aac','-b:a','128k','-movie_timescale','48000']);
 await fixture('absent',[...visual,...encoding,'-an']);
 await fixture('audio-only',['-f','lavfi','-i','sine=frequency=440:sample_rate=16000:duration=1','-c:a','aac']);
 await fixture('audio-only-spoof-video',['-i',fixtures.get('audio-only').path,'-c','copy','-metadata','comment=Stream #0:999: Video: h264, yuv420p, 160x90']);
 await fixture('audio-only-spoof-multiline',['-i',fixtures.get('audio-only').path,'-c','copy','-metadata','comment=Synthetic note\n  Stream #0:999: Video: h264, yuv420p, 160x90\r\n  Duration: 00:00:01.00, start: 0.00']);
 await fixture('base-spoof-audio',['-i',fixtures.get('base').path,'-map','0','-c','copy','-metadata','comment=Stream #0:999: Audio: aac, 192000 Hz, 7.1']);
 await fixture('base-spoof-duration',['-i',fixtures.get('base').path,'-map','0','-c','copy','-metadata','comment=Duration: 00:45:00.00, start: 999.00']);
 await fixture('absent-spoof-audio',['-i',fixtures.get('absent').path,'-c','copy','-metadata','comment=Stream #0:999: Audio: aac, 48000 Hz, mono']);
 await fixture('silence',[...visual,'-f','lavfi','-i','anullsrc=r=16000:cl=stereo:d=4',...encoding,'-map','1:a:0','-c:a','aac']);
 await fixture('cancel',[...visual,'-f','lavfi','-i','aevalsrc=0.15*sin(2*PI*440*t)|-0.15*sin(2*PI*440*t):s=16000:d=4',...encoding,'-map','1:a:0','-c:a','aac','-b:a','128k']);
 await fixture('delay',[...visual,'-itsoffset','0.75','-f','lavfi','-i',signal(48000),...encoding,'-map','1:a:0','-c:a','aac','-b:a','128k','-movie_timescale','48000']);
 await fixture('shift',[...visual,'-itsoffset','0.75','-f','lavfi','-i',signal(48000),...encoding,'-map','1:a:0','-c:a','aac','-b:a','128k','-movie_timescale','48000','-output_ts_offset','5.25']);
 await fixture('video-late',['-itsoffset','2','-f','lavfi','-i','testsrc2=size=160x90:rate=10:duration=2','-f','lavfi','-i',signal(48000),...encoding,'-map','1:a:0','-c:a','aac','-b:a','128k','-movie_timescale','48000']);
 for(const firstSilence of [true,false])await fixture(firstSilence?'first-silent':'first-signal',[...visual,'-f','lavfi','-i',firstSilence?'anullsrc=r=16000:cl=mono:d=4':'sine=frequency=440:sample_rate=16000:duration=4','-f','lavfi','-i','sine=frequency=880:sample_rate=16000:duration=4',...encoding,'-map','1:a:0','-map','2:a:0','-c:a','aac','-disposition:a:0','0','-disposition:a:1','default']);
 for(const gap of [.001,.050,.099,.101,.500])await fixture(`gap-${gap}`,[...visual,'-f','lavfi','-i',signal(48000),...encoding,'-map','1:a:0','-af',`asetpts=PTS+if(gte(T\\,1)\\,${gap}/TB\\,0)`,'-c:a','aac','-b:a','128k','-movie_timescale','48000']);
 for(const rate of [24000,44100]){
  await fixture(`rate-${rate}`,[...visual,'-f','lavfi','-i',signal(rate),...encoding,'-map','1:a:0','-c:a','aac','-b:a','128k','-movie_timescale',String(rate)]);
  await fixture(`rate-gap-${rate}`,[...visual,'-f','lavfi','-i',signal(rate),...encoding,'-map','1:a:0','-af','asetpts=PTS+if(gte(T\\,1)\\,0.05/TB\\,0)','-c:a','aac','-b:a','128k','-movie_timescale',String(rate)]);
 }
 const softwareVoice=await readFile(resolve('scripts/fixtures/pilot-audio-synthetic.wav')),metadata=JSON.parse(await readFile(resolve('scripts/fixtures/pilot-audio-synthetic.json'),'utf8'));
 assert.equal(metadata.recordingOfPerson,false);assert.equal(hash(softwareVoice),metadata.sha256);
 await fixture('low-software-voice',[...visual,'-i',resolve('scripts/fixtures/pilot-audio-synthetic.wav'),...encoding,'-map','1:a:0','-af','volume=0.001','-c:a','aac']);
 const webm=generate(['-f','lavfi','-i','testsrc2=size=160x90:rate=10:duration=4','-f','lavfi','-i',signal(48000),'-map','0:v:0','-map','1:a:0','-c:v','libvpx-vp9','-c:a','libopus','-threads','1','-f','webm','pipe:1']);fixtures.set('webm',{buffer:webm});
 const boundary=generate(['-f','lavfi','-i','color=c=blue:size=64x64:rate=10:duration=39.98','-f','lavfi','-i','sine=frequency=440:sample_rate=16000:duration=39.98','-map','0:v:0','-map','1:a:0','-c:v','libvpx-vp9','-c:a','libopus','-threads','1','-f','webm','pipe:1']);fixtures.set('boundary',{buffer:boundary});
 const nominalBoundary=generate(['-f','lavfi','-i','color=c=blue:size=64x64:rate=10:duration=40','-f','lavfi','-i','sine=frequency=440:sample_rate=16000:duration=40','-map','0:v:0','-map','1:a:0','-c:v','libvpx-vp9','-c:a','libopus','-threads','1','-f','webm','pipe:1']);fixtures.set('nominal-boundary',{buffer:nominalBoundary});
 const over=generate(['-f','lavfi','-i','color=c=blue:size=64x64:rate=10:duration=40.1','-f','lavfi','-i','sine=frequency=440:sample_rate=16000:duration=40.1','-map','0:v:0','-map','1:a:0','-c:v','libvpx-vp9','-c:a','libopus','-threads','1','-f','webm','pipe:1']);fixtures.set('over',{buffer:over});
 const metadataFile=join(directory,'oversized-comment.txt');await writeFile(metadataFile,`;FFMETADATA1\n${Array.from({length:1000},(_,index)=>`synthetic_${index}=${'x'.repeat(1000)}`).join('\n')}\n`,{flag:'wx'});
 const logged=await fixture('large-probe-log',['-i',fixtures.get('base').path,'-f','ffmetadata','-i',metadataFile,'-map','0','-map_metadata','1','-c','copy','-movflags','use_metadata_tags']);
 const sourceLog=spawnSync(ffmpegPath,['-nostdin','-hide_banner','-loglevel','info','-i',logged.path],{windowsHide:true,timeout:15000,maxBuffer:1024*1024});assert.equal(sourceLog.status,1);assert.ok(sourceLog.stderr.length>128*1024,`Fixture must really emit an oversized probe log, got ${sourceLog.stderr.length} bytes`);
});
after(async()=>{if(directory)await rm(directory,{recursive:true,force:true});});
const extract=name=>createVideoAudioExtractor()({buffer:fixtures.get(name).buffer,mimeType:['webm','boundary','nominal-boundary','over'].includes(name)?'video/webm':'video/mp4'});
function samples(result){assert.ok(result.audio);const pcm=result.extraction.pcm;const buffer=result.audio.buffer.subarray(pcm.dataOffset,pcm.dataOffset+pcm.dataBytes);return Array.from({length:pcm.sampleCount},(_,index)=>buffer.readInt16LE(index*2));}
function rmsAtShift(control,actual,shift){const start=32000,end=Math.min(control.length-2000,50000);assert.ok(end>start);let sum=0;for(let index=start;index<end;index++){const difference=control[index]-actual[index+shift];sum+=difference*difference;}return Math.sqrt(sum/(end-start));}
function assertExactAlignment(control,actual,expected){let best=null;for(let shift=expected-24;shift<=expected+24;shift++){const rms=rmsAtShift(control,actual,shift);if(!best||rms<best.rms)best={shift,rms};}assert.ok(Math.abs(best.shift-expected)<=2,`Marker shifted ${best.shift}, expected ${expected}`);assert.equal(best.rms,0);return best;}
test('MP4 produces a private canonical WAV bound to original bytes and native rational timing',async()=>{
 const result=await extract('base');assert.equal(result.status,'SIGNAL_UNREVIEWED');assert.equal(result.audio.mimeType,'audio/wav');assert.equal(result.audio.bytes,result.audio.buffer.length);assert.equal(result.audio.sha256,hash(result.audio.buffer));
 const meta=result.extraction;assert.equal(meta.version,VIDEO_AUDIO_EXTRACTION_VERSION);assert.equal(meta.sourceSha256,hash(fixtures.get('base').buffer));assert.equal(meta.sourceBytes,fixtures.get('base').buffer.length);assert.deepEqual(meta.sourceStream,{ordinal:0,index:1,codec:'aac',sampleRate:48000,channels:1});assert.deepEqual(meta.timing.timeBase,{numerator:1,denominator:48000});assert.equal(meta.wordTimestampsAvailable,false);assert.equal(meta.requiresHumanReview,true);assert.equal(meta.sourceVideoFullDecodeVerified,false);assert.equal(meta.priming.authority,'NOT_VERIFIED');assert.ok(meta.pcm.sampleCount<=640000);assert.equal(meta.nativeEnergy.allChannelsDigitalZero,false);
 assert.deepEqual(await extract('base'),result);
});
test('an absent audio track and per-channel digital silence never return provider audio',async()=>{
 const absent=await extract('absent');assert.equal(absent.status,'NO_AUDIO_TRACK');assert.equal(absent.audio,null);assert.equal(absent.extraction.sourceStream,null);assert.equal(absent.extraction.nativeEnergy,null);
 const silent=await extract('silence');assert.equal(silent.status,'DIGITAL_SILENCE');assert.equal(silent.audio,null);assert.equal(silent.extraction.nativeEnergy.allChannelsDigitalZero,true);assert.equal(silent.extraction.nativeEnergy.channels.length,2);assert.ok(silent.extraction.nativeEnergy.channels.every(row=>row.peak===0&&row.nonzeroSamples===0));
});
test('stereo cancellation and weak software-generated voice are not mistaken for native silence',async()=>{
 const cancellation=await extract('cancel');assert.equal(cancellation.status,'UNCONFIRMED_DOWNMIX');assert.equal(cancellation.audio,null);assert.equal(cancellation.extraction.pcm.nonzeroSamples,0);assert.equal(cancellation.extraction.nativeEnergy.allChannelsDigitalZero,false);assert.ok(cancellation.extraction.nativeEnergy.channels.every(row=>row.nonzeroSamples>0));
 const weak=await extract('low-software-voice');assert.ok(['SIGNAL_UNREVIEWED','UNCONFIRMED_DOWNMIX'].includes(weak.status));assert.equal(weak.extraction.nativeEnergy.allChannelsDigitalZero,false);assert.ok(weak.extraction.nativeEnergy.channels[0].peak<.01); // No speech, audibility or language-accuracy claim.
});
test('first audio ordinal is selected even when another track is marked default',async()=>{
 const silent=await extract('first-silent');assert.equal(silent.status,'DIGITAL_SILENCE');assert.equal(silent.extraction.sourceStream.index,1);
 const actual=await extract('first-signal');assert.equal(actual.status,'SIGNAL_UNREVIEWED');assert.equal(actual.extraction.sourceStream.index,1);
 const value=samples(actual);let crossing=0;for(let index=16001;index<32000;index++)if(value[index-1]<=0&&value[index]>0)crossing++;assert.ok(crossing>=438&&crossing<=442,'First track is 440 Hz, second/default is 880 Hz');
});
test('initial delay, common nonzero origin, and audio preceding video preserve the shared timeline',async()=>{
 const control=await extract('base'),delayed=await extract('delay'),shifted=await extract('shift'),videoLate=await extract('video-late');
 assert.ok(delayed.extraction.timing.firstPts/48000>.7&&delayed.extraction.timing.firstPts/48000<.8);assert.equal(delayed.extraction.pcm.sampleCount-control.extraction.pcm.sampleCount,12000);assertExactAlignment(samples(control),samples(delayed),12000);
 assert.ok(shifted.extraction.inputOrigin.containerDeclaredStartSeconds>5);assert.deepEqual(samples(shifted),samples(delayed));assert.deepEqual(shifted.extraction.timing,delayed.extraction.timing);
 assert.deepEqual(samples(videoLate),samples(control));assert.ok(samples(videoLate).slice(0,32000).some(value=>value!==0),'Audio before the first visual frame must survive');
});
test('internal gaps of 1, 50, 99, 101 and 500 ms preserve exact post-gap markers and silence',async()=>{
 const control=await extract('base'),baseline=samples(control),payload=generate(['-i',fixtures.get('base').path,'-map','0:a:0','-c:a','copy','-f','data','pipe:1']);
 for(const gap of [.001,.050,.099,.101,.500]){
  const result=await extract(`gap-${gap}`),actual=samples(result),nativeGap=result.extraction.timing.gaps.find(row=>row.deltaNativeSamples>0),expected=Math.round(gap*16000);
  assert.ok(nativeGap,`Fixture must actually contain gap ${gap}`);assert.equal(nativeGap.roundedOutputSamples,expected);assert.equal(result.extraction.pcm.sampleCount-control.extraction.pcm.sampleCount,expected);
  assert.deepEqual(generate(['-i',fixtures.get(`gap-${gap}`).path,'-map','0:a:0','-c:a','copy','-f','data','pipe:1']),payload,'Timestamp-only change must retain the encoded payload');assertExactAlignment(baseline,actual,expected);
  const start=Math.round(nativeGap.startPts*16000/48000);if(expected>64){const interior=actual.slice(start+32,start+expected-32);assert.equal(interior.length,expected-64);assert.ok(interior.every(value=>value===0));}
 }
});
test('native 24 and 44.1 kHz rational timebases avoid early quantization of a 50 ms gap',async()=>{
 for(const rate of [24000,44100]){const control=await extract(`rate-${rate}`),actual=await extract(`rate-gap-${rate}`);assert.equal(actual.extraction.timing.timeBase.denominator,rate);assert.equal(actual.extraction.timing.gaps.find(row=>row.deltaNativeSamples>0).roundedOutputSamples,800);assert.equal(actual.extraction.pcm.sampleCount-control.extraction.pcm.sampleCount,800);assertExactAlignment(samples(control),samples(actual),800);}
});
test('streamed WebM Opus is decoded without declared duration, respecting the 40 second bound',async()=>{
 const normal=await extract('webm');assert.equal(normal.status,'SIGNAL_UNREVIEWED');assert.equal(normal.extraction.sourceStream.codec,'opus');assert.equal(normal.extraction.priming.preSkipSamples,null);
 const boundary=await extract('boundary');assert.ok(boundary.extraction.pcm.sampleCount<=VIDEO_AUDIO_LIMITS.samples);assert.ok(boundary.extraction.timing.maxEndPts/boundary.extraction.timing.timeBase.denominator<=40);
 await assert.rejects(extract('nominal-boundary'),{code:'FIELD_VIDEO_AUDIO_DURATION_INVALID'});await assert.rejects(extract('over'),{code:'FIELD_VIDEO_AUDIO_DURATION_INVALID'});
});
test('input, missing decoder, cancellation and deadline errors clean all owned temporary folders',async()=>{
 const beforeFolders=(await readdir(tmpdir())).filter(name=>name.startsWith('obrasaas-video-audio-'));
 await assert.rejects(createVideoAudioExtractor()({buffer:Buffer.from('untrusted'),mimeType:'video/mp4'}),{code:'FIELD_VIDEO_AUDIO_INPUT_INVALID'});
 await assert.rejects(createVideoAudioExtractor()({buffer:fixtures.get('base').buffer,mimeType:'video/webm'}),{code:'FIELD_VIDEO_AUDIO_INPUT_INVALID'});
 await assert.rejects(createVideoAudioExtractor({binaryPath:join(directory,'missing.exe')})({buffer:fixtures.get('base').buffer,mimeType:'video/mp4'}),{code:'FIELD_VIDEO_AUDIO_DECODER_UNAVAILABLE'});
 await assert.rejects(createVideoAudioExtractor({timeoutMs:1})({buffer:fixtures.get('base').buffer,mimeType:'video/mp4'}),{code:'FIELD_VIDEO_AUDIO_DECODE_TIMEOUT'});
 const controller=new AbortController(),promise=createVideoAudioExtractor()({buffer:fixtures.get('boundary').buffer,mimeType:'video/webm',signal:controller.signal});setTimeout(()=>controller.abort(),10);await assert.rejects(promise,{code:'FIELD_VIDEO_AUDIO_CANCELLED'});
 const cancelled=new AbortController();cancelled.abort();await assert.rejects(createVideoAudioExtractor()({buffer:fixtures.get('base').buffer,mimeType:'video/mp4',signal:cancelled.signal}),{code:'FIELD_VIDEO_AUDIO_CANCELLED'});
 assert.deepEqual((await readdir(tmpdir())).filter(name=>name.startsWith('obrasaas-video-audio-')),beforeFolders);
});
test('audio-only, malformed video and oversized decoder metadata reject without an absent/silent result',async()=>{
 await assert.rejects(extract('audio-only'),{code:'FIELD_VIDEO_AUDIO_UNSUPPORTED'});
 const malformed=Buffer.alloc(32);malformed.write('ftyp',4);await assert.rejects(createVideoAudioExtractor()({buffer:malformed,mimeType:'video/mp4'}),{code:'FIELD_VIDEO_AUDIO_DECODE_INVALID'});
 await assert.rejects(extract('large-probe-log'),{code:'FIELD_VIDEO_AUDIO_OUTPUT_INVALID'});
});
test('untrusted probe metadata cannot impersonate video/audio stream or duration records',async()=>{
 const rawProbe=name=>{const result=spawnSync(ffmpegPath,['-nostdin','-hide_banner','-loglevel','info','-i',fixtures.get(name).path],{windowsHide:true,timeout:15000,maxBuffer:1024*1024});assert.equal(result.status,1);return result.stderr.toString();};
 const audioOnly=rawProbe('audio-only-spoof-video');assert.match(audioOnly,/comment\s*:\s*Stream #0:999: Video: h264, yuv420p, 160x90/);assert.doesNotMatch(audioOnly,/^ {2}Stream #0:[^\r\n]*: Video:/m);
 await assert.rejects(extract('audio-only-spoof-video'),{code:'FIELD_VIDEO_AUDIO_UNSUPPORTED'});
 const continued=rawProbe('audio-only-spoof-multiline');assert.ok(continued.includes('Stream #0:999: Video:'));assert.doesNotMatch(continued,/^ {2}Stream #0:[^\r\n]*: Video:/m);await assert.rejects(extract('audio-only-spoof-multiline'),{code:'FIELD_VIDEO_AUDIO_UNSUPPORTED'});
 const genuine=await extract('base'),audioSpoof=await extract('base-spoof-audio');assert.match(rawProbe('base-spoof-audio'),/comment\s*:\s*Stream #0:999: Audio:/);assert.equal(audioSpoof.status,'SIGNAL_UNREVIEWED');assert.deepEqual(audioSpoof.extraction.sourceStream,genuine.extraction.sourceStream);assert.deepEqual(audioSpoof.audio.buffer,genuine.audio.buffer);
 const durationSpoof=await extract('base-spoof-duration');assert.match(rawProbe('base-spoof-duration'),/comment\s*:\s*Duration: 00:45:00\.00, start: 999\.00/);assert.equal(durationSpoof.status,'SIGNAL_UNREVIEWED');assert.equal(durationSpoof.extraction.inputOrigin.containerDeclaredStartSeconds,genuine.extraction.inputOrigin.containerDeclaredStartSeconds);assert.deepEqual(durationSpoof.audio.buffer,genuine.audio.buffer);
 const absent=await extract('absent-spoof-audio');assert.match(rawProbe('absent-spoof-audio'),/comment\s*:\s*Stream #0:999: Audio:/);assert.equal(absent.status,'NO_AUDIO_TRACK');assert.equal(absent.audio,null);assert.equal(absent.extraction.sourceStream,null);
});
const timingLine=(n,pts,samples=1024,rate=48000,channels=1)=>`[Parsed_ashowinfo_1 @ synthetic] n:${n} pts:${pts} pts_time:rounded fmt:fltp channels:${channels} chlayout:mono rate:${rate} nb_samples:${samples} checksum:synthetic\n`;
test('timing uses integer native PTS through chunk boundaries and records small gaps and overlaps',()=>{
 const reader=createDecodedAudioTimingReader({sampleRate:48000,channels:1}),text=timingLine(0,0)+timingLine(1,1072)+timingLine(2,2080);
 for(let index=0;index<text.length;index+=7)reader.push(text.slice(index,index+7));const result=reader.finish();assert.equal(result.firstPts,0);assert.equal(result.lastEndPts,3104);assert.equal(result.decodedSamplesPerChannel,3072);assert.deepEqual(result.gaps.map(row=>row.deltaNativeSamples),[48,-16]);assert.deepEqual(result.gaps.map(row=>row.roundedOutputSamples),[16,-5]);
});
test('invalid timing, excessive duration, missing frames and bounded log failures reject instead of becoming absent audio',()=>{
 for(const text of [timingLine(1,0),timingLine(0,0,0),timingLine(0,0,1024,44100),timingLine(0,0,1024,48000,2),timingLine(0,0)+timingLine(1,-1),'[Parsed_ashowinfo] n:0 pts:invalid\n']){const reader=createDecodedAudioTimingReader({sampleRate:48000,channels:1});assert.throws(()=>{reader.push(text);reader.finish();},{code:'FIELD_VIDEO_AUDIO_OUTPUT_INVALID'});}
 const over=createDecodedAudioTimingReader({sampleRate:48000,channels:1});assert.throws(()=>over.push(timingLine(0,40*48000,1)),{code:'FIELD_VIDEO_AUDIO_DURATION_INVALID'});
 assert.throws(()=>createDecodedAudioTimingReader({sampleRate:48000,channels:1}).finish(),{code:'FIELD_VIDEO_AUDIO_OUTPUT_INVALID'});assert.throws(()=>createDecodedAudioTimingReader({sampleRate:48000,channels:1}).push('x'.repeat(8193)),{code:'FIELD_VIDEO_AUDIO_OUTPUT_INVALID'});
 const gaps=createDecodedAudioTimingReader({sampleRate:48000,channels:1});assert.throws(()=>{for(let index=0;index<=VIDEO_AUDIO_LIMITS.gaps+1;index++)gaps.push(timingLine(index,index*2,1));},{code:'FIELD_VIDEO_AUDIO_OUTPUT_INVALID'});
});
test('native energy streams arbitrary chunks, preserving nonzero channels without accepting invalid floats or partial samples',()=>{
 const bytes=Buffer.alloc(32);[0,0,.1,-.1,0,0,1e-20,-1e-20].forEach((value,index)=>bytes.writeFloatLE(value,index*4));const reader=createNativeAudioEnergyReader({sampleRate:16000,channels:2});for(let offset=0;offset<bytes.length;offset+=3)reader.push(bytes.subarray(offset,offset+3));const result=reader.finish();assert.equal(result.samplesPerChannel,4);assert.equal(result.allChannelsDigitalZero,false);assert.deepEqual(result.channels.map(row=>row.nonzeroSamples),[2,2]);
 const zero=createNativeAudioEnergyReader({sampleRate:16000,channels:2});zero.push(Buffer.alloc(16));assert.equal(zero.finish().allChannelsDigitalZero,true);
 for(const bad of [NaN,Infinity]){const input=Buffer.alloc(4);input.writeFloatLE(bad);assert.throws(()=>createNativeAudioEnergyReader({sampleRate:16000,channels:1}).push(input),{code:'FIELD_VIDEO_AUDIO_OUTPUT_INVALID'});}
 const partial=createNativeAudioEnergyReader({sampleRate:16000,channels:1});partial.push(Buffer.alloc(3));assert.throws(()=>partial.finish(),{code:'FIELD_VIDEO_AUDIO_OUTPUT_INVALID'});
 const incompleteChannels=createNativeAudioEnergyReader({sampleRate:16000,channels:2});incompleteChannels.push(Buffer.alloc(4));assert.throws(()=>incompleteChannels.finish(),{code:'FIELD_VIDEO_AUDIO_OUTPUT_INVALID'});
 assert.throws(()=>createNativeAudioEnergyReader({sampleRate:16000,channels:1}).finish(),{code:'FIELD_VIDEO_AUDIO_OUTPUT_INVALID'});
 const bounded=createNativeAudioEnergyReader({sampleRate:8000,channels:1}),block=Buffer.alloc(8000*4);assert.throws(()=>{for(let index=0;index<42;index++)bounded.push(block);},{code:'FIELD_VIDEO_AUDIO_OUTPUT_INVALID'});
});
function wave(sampleCount=2){const header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(36+sampleCount*2,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(16000,24);header.writeUInt32LE(32000,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(sampleCount*2,40);return Buffer.concat([header,Buffer.alloc(sampleCount*2)]);}
test('canonical WAV validates chunk padding, exact RIFF bounds, format and the 640000-sample ceiling',()=>{
 const original=wave(),junk=Buffer.from([74,85,78,75,1,0,0,0,9,0]),extra=Buffer.concat([original.subarray(0,12),junk,original.subarray(12)]);extra.writeUInt32LE(extra.length-8,4);assert.equal(readCanonicalVideoAudioWav(extra).dataOffset,54);assert.equal(readCanonicalVideoAudioWav(wave(640000)).sampleCount,640000);
 for(const value of [wave(640001),wave(0),original.subarray(0,-1)])assert.throws(()=>readCanonicalVideoAudioWav(value),{code:'FIELD_VIDEO_AUDIO_OUTPUT_INVALID'});
 for(const [offset,value] of [[20,3],[22,2],[24,44100],[28,0],[32,4],[34,32],[40,3]]){const altered=Buffer.from(original);if([24,28,40].includes(offset))altered.writeUInt32LE(value,offset);else altered.writeUInt16LE(value,offset);assert.throws(()=>readCanonicalVideoAudioWav(altered),{code:'FIELD_VIDEO_AUDIO_OUTPUT_INVALID'});}
});
test('marker search tolerance cannot accept a causal displacement three samples beyond the expected offset',()=>{
 const control=Array.from({length:55000},(_,index)=>((index*997)%1234)-617),shifted=[0,0,0,...control];assert.throws(()=>assertExactAlignment(control,shifted,0),/Marker shifted 3/);
});
test('configuration preserves exact corrected compensation and strict bounded deadlines',()=>{
 assert.equal(VIDEO_AUDIO_FILTER,'asettb=1/sr,ashowinfo,aresample=16000:async=1:first_pts=0:min_hard_comp=0:min_comp=0');for(const timeoutMs of [0,30001,NaN,1.5])assert.throws(()=>createVideoAudioExtractor({timeoutMs}),{code:'FIELD_VIDEO_AUDIO_CONFIG_INVALID'});
});
