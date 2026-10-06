import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,readFile,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import ffmpegPath from 'ffmpeg-static';
import {createVideoFrameExtractor,VIDEO_LIMITS,VIDEO_SAMPLING_VERSION} from '../src/lib/video-frame-extractor.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
let directory,mp4,fractionalFpsVideo,webm,longVideo,longWebm,largeVideo,oversizedDimensions,audioOnly,unsupported;
function generate(args,maxBuffer=4*1024*1024){const result=spawnSync(ffmpegPath,['-nostdin','-hide_banner','-loglevel','error','-threads','1','-filter_threads','1',...args],{windowsHide:true,timeout:15000,maxBuffer});assert.equal(result.status,0,result.stderr?.toString());return result.stdout;}
before(async()=>{
 directory=await mkdtemp(join(tmpdir(),'obrasaas-synthetic-video-test-'));
 const file=join(directory,'source.mp4');generate(['-f','lavfi','-i','testsrc2=size=320x180:rate=10','-t','2','-c:v','libx264','-threads','1','-pix_fmt','yuv420p',file]);mp4=await readFile(file);
 const fractional=join(directory,'fractional-fps.mp4');generate(['-f','lavfi','-i','testsrc2=size=320x180:rate=30','-t','2','-c:v','libx264','-threads','1',fractional]);fractionalFpsVideo=await readFile(fractional);
 // Pipe output has no seekable header and commonly has no declared duration,
 // matching MediaRecorder WebM rather than merely accepting an EBML signature.
 webm=generate(['-f','lavfi','-i','testsrc2=size=320x180:rate=10','-t','2','-c:v','libvpx-vp9','-threads','1','-f','webm','pipe:1']);
 longWebm=generate(['-f','lavfi','-i','color=c=blue:size=64x64:rate=1','-t','41','-c:v','libvpx-vp9','-threads','1','-f','webm','pipe:1']);
 const large=join(directory,'large.mp4');generate(['-f','lavfi','-i','testsrc2=size=1920x1080:rate=2','-t','1','-c:v','libx264','-threads','1',large]);largeVideo=await readFile(large);
 const wide=join(directory,'wide.mp4');generate(['-f','lavfi','-i','color=c=blue:size=4098x64:rate=2','-t','1','-c:v','libx264','-threads','1',wide]);oversizedDimensions=await readFile(wide);
 const long=join(directory,'long.mp4');generate(['-f','lavfi','-i','color=c=blue:size=64x64:rate=1','-t','41','-c:v','libx264','-threads','1',long]);longVideo=await readFile(long);
 const sound=join(directory,'audio.mp4');generate(['-f','lavfi','-i','sine=frequency=440:sample_rate=16000','-t','1','-c:a','aac',sound]);audioOnly=await readFile(sound);
 const old=join(directory,'unsupported.mp4');generate(['-f','lavfi','-i','color=c=green:size=64x64:rate=2','-t','1','-c:v','mpeg4',old]);unsupported=await readFile(old);
});
after(async()=>{if(directory)await rm(directory,{recursive:true,force:true});});
test('real MP4 decode yields bounded JPEG samples bound to the exact synthetic original',async()=>{
 const result=await createVideoFrameExtractor()({buffer:mp4,mimeType:'video/mp4'});
 assert.equal(result.sampling.sourceSha256,hash(mp4));assert.equal(result.sampling.sourceBytes,mp4.length);assert.equal(result.sampling.durationSeconds,2);assert.equal(result.sampling.version,VIDEO_SAMPLING_VERSION);assert.equal(result.sampling.audioAnalyzed,false);assert.equal(result.frames.length,VIDEO_LIMITS.frames);
 assert.ok(new Set(result.frames.map(frame=>frame.sha256)).size>1,'Moving generated fixture must produce different sampled frames');
 for(const [index,frame] of result.frames.entries()){const bytes=Buffer.from(frame.base64,'base64');assert.equal(frame.sha256,hash(bytes));assert.equal(frame.mimeType,'image/jpeg');assert.ok(bytes.length<=VIDEO_LIMITS.frameBytes);assert.equal(frame.capturedAtSeconds,result.sampling.frames[index].capturedAtSeconds);assert.ok(frame.capturedAtSeconds<2);assert.equal(bytes.subarray(0,2).toString('hex'),'ffd8');}
 const repeated=await createVideoFrameExtractor()({buffer:mp4,mimeType:'video/mp4'});assert.deepEqual(repeated,result);
});
test('real streamed WebM without declared duration is decoded and sampled',async()=>{
 const result=await createVideoFrameExtractor()({buffer:webm,mimeType:'video/webm'});assert.equal(result.sampling.sourceSha256,hash(webm));assert.equal(result.frames.length,4);assert.equal(result.sampling.durationSeconds,2);
});
test('30 FPS input retains exact decoded duration and never seeks past its final frame',async()=>{
 const result=await createVideoFrameExtractor()({buffer:fractionalFpsVideo,mimeType:'video/mp4'});assert.equal(result.sampling.durationSeconds,2);assert.equal(result.frames.length,4);assert.equal(result.frames.at(-1).capturedAtSeconds,1.966);
});
test('decoded duration rejects an overlong streamed WebM without trusting a header',async()=>{
 await assert.rejects(createVideoFrameExtractor()({buffer:longWebm,mimeType:'video/webm'}),{code:'FIELD_VIDEO_DURATION_INVALID'});
});
test('actual 1080p decode produces JPEGs no larger than 768 pixels and rejects excessive source dimensions',async()=>{
 const result=await createVideoFrameExtractor()({buffer:largeVideo,mimeType:'video/mp4'});
 for(const frame of result.frames){const probe=spawnSync(ffmpegPath,['-hide_banner','-i','pipe:0'],{input:Buffer.from(frame.base64,'base64'),windowsHide:true,timeout:15000,maxBuffer:128*1024});assert.equal(probe.status,1);const size=/Video: mjpeg[^\r\n]*?\b([0-9]+)x([0-9]+)\b/.exec(probe.stderr.toString());assert.ok(size);assert.equal(Number(size[1]),768);assert.equal(Number(size[2]),432);assert.ok(frame.bytes<=VIDEO_LIMITS.frameBytes);}
 await assert.rejects(createVideoFrameExtractor()({buffer:oversizedDimensions,mimeType:'video/mp4'}),{code:'FIELD_VIDEO_UNSUPPORTED'});
});
test('overlong, audio-only, unsupported codec and malformed containers fail closed',async()=>{
 for(const [buffer,code] of [[longVideo,'FIELD_VIDEO_DURATION_INVALID'],[audioOnly,'FIELD_VIDEO_UNSUPPORTED'],[unsupported,'FIELD_VIDEO_UNSUPPORTED'],[Buffer.from('0000ftypisom000000000000'),'FIELD_VIDEO_DECODE_INVALID']])await assert.rejects(createVideoFrameExtractor()({buffer,mimeType:'video/mp4'}),{code});
 for(const [buffer,mimeType] of [[mp4,'video/webm'],[Buffer.alloc(0),'video/mp4'],[Buffer.alloc(VIDEO_LIMITS.bytes+1),'video/mp4']])await assert.rejects(createVideoFrameExtractor()({buffer,mimeType}),{code:'FIELD_VIDEO_INPUT_INVALID'});
});
test('decoder deadline kills actual process and removes its private temporary input',async()=>{
 const before=new Set((await readdir(tmpdir())).filter(name=>name.startsWith('obrasaas-video-')));
 await assert.rejects(createVideoFrameExtractor({timeoutMs:1})({buffer:mp4,mimeType:'video/mp4'}),{code:'FIELD_VIDEO_DECODE_TIMEOUT'});
 const remaining=(await readdir(tmpdir())).filter(name=>name.startsWith('obrasaas-video-')&&!before.has(name));assert.deepEqual(remaining,[]);
});
