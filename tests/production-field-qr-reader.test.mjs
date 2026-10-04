import test from 'node:test';
import assert from 'node:assert/strict';
import QRCode from 'qrcode';
import {createFieldQrReader,parseFieldQr} from '../src/app/(identity)/cuenta/field-qr-reader.mjs';

const target={projectId:'project-fixture',sectorId:'sector-fixture'};
const raw=JSON.stringify({version:1,...target,token:'b'.repeat(64)});
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const tick=async()=>{for(let n=0;n<8;n++)await Promise.resolve();};
const bounded=async promise=>{let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Cancellation did not settle the reader')),250);})]);}finally{clearTimeout(timer);}};

// The decoder sees actual QR modules encoded by qrcode, rasterized as RGBA.
// Only the browser's local canvas/video boundary is simulated here.
function frame(content=raw,{invert=false,blank=false,width,height,scale=4}={}){
 const qr=QRCode.create(content,{errorCorrectionLevel:'M'}),edge=(qr.modules.size+8)*scale;
 width??=edge;height??=edge;assert.ok(width>=edge&&height>=edge);
 const data=new Uint8ClampedArray(width*height*4),background=invert?0:255,foreground=invert?255:0;
 for(let p=0;p<data.length;p+=4){data[p]=data[p+1]=data[p+2]=background;data[p+3]=255;}
 if(!blank)for(let y=0;y<qr.modules.size;y++)for(let x=0;x<qr.modules.size;x++)if(qr.modules.get(y,x)){
  for(let dy=0;dy<scale;dy++)for(let dx=0;dx<scale;dx++){const p=(((y+4)*scale+dy)*width+(x+4)*scale+dx)*4;data[p]=data[p+1]=data[p+2]=foreground;}
 }
 return {data,width,height};
}
function canvasFixture(image=frame()){
 const draws=[],reads=[];let allocations=0;
 const canvas={width:0,height:0,getContext(type,options){assert.equal(type,'2d');assert.deepEqual(options,{willReadFrequently:true});return {drawImage(...args){draws.push(args);},getImageData(x,y,width,height){reads.push({x,y,width,height});assert.equal(width,image.width);assert.equal(height,image.height);return image;}};}};
 const video={videoWidth:image.width,videoHeight:image.height,readyState:2};
 return {video,canvas,draws,reads,makeCanvas(){allocations++;return canvas;},allocations:()=>allocations};
}

test('QR parsing retains the original valid JSON, including harmless whitespace',()=>{
 assert.equal(parseFieldQr(' '+raw+'\n',target),' '+raw+'\n');
});
test('foreign project/sector and unbounded or malformed QR are rejected without exposing contents',()=>{
 const malformed=['{',JSON.stringify([]),JSON.stringify(null),JSON.stringify({...JSON.parse(raw),version:2}),JSON.stringify({...JSON.parse(raw),projectId:'other-project'}),JSON.stringify({...JSON.parse(raw),sectorId:'other-sector'}),JSON.stringify({...JSON.parse(raw),token:'private-invalid-token'}),JSON.stringify({...JSON.parse(raw),token:'B'.repeat(64)}),JSON.stringify({...JSON.parse(raw),extra:true}),' '.repeat(2048)+raw,'b'.repeat(64)];
 for(const content of malformed)assert.throws(()=>parseFieldQr(content,target),error=>error.code==='FIELD_QR_INVALID'&&!error.message.includes(content)&&!error.message.includes('private-invalid-token'));
 for(const expected of [{...target,projectId:''},{...target,sectorId:'x'.repeat(129)},{}])assert.throws(()=>parseFieldQr(raw,expected),{code:'FIELD_QR_INVALID'});
});
test('factory and disposal do not access DOM or camera APIs at import or construction',()=>{
 const reader=createFieldQrReader({nativeDetector:null,makeCanvas:()=>assert.fail('No DOM during construction'),loadDecoder:()=>assert.fail('No decoder load during construction')});reader.dispose();reader.dispose();
});
test('native QR capability uses a bounded local canvas without loading fallback',async()=>{
 const f=canvasFixture();let calls=0;
 class Native{static async getSupportedFormats(){return ['qr_code'];}constructor(options){assert.deepEqual(options,{formats:['qr_code']});}async detect(input){calls++;assert.equal(input,f.canvas);return [{rawValue:raw}];}}
 const reader=createFieldQrReader({nativeDetector:Native,makeCanvas:f.makeCanvas,loadDecoder:()=>assert.fail('Native QR must not load fallback')});assert.equal(await reader.read(f.video),raw);assert.equal(calls,1);assert.equal(f.reads.length,0);reader.dispose();assert.equal(f.canvas.width,0);assert.equal(f.canvas.height,0);
});
test('native interface without capability method remains compatible',async()=>{
 const f=canvasFixture();class Native{async detect(){return [{rawValue:raw}];}}
 const reader=createFieldQrReader({nativeDetector:Native,makeCanvas:f.makeCanvas});assert.equal(await reader.read(f.video),raw);reader.dispose();
});
for(const mode of ['absent','unsupported-format','formats-reject','constructor-throw','detect-reject','detect-throw','malformed-result'])test(`real jsQR fallback decodes sector content when native path is ${mode}`,async()=>{
 const f=canvasFixture();let nativeCalls=0;
 class Native{static async getSupportedFormats(){if(mode==='formats-reject')throw Error('Controlled capabilities failure');return mode==='unsupported-format'?['ean_13']:['qr_code'];}constructor(){if(mode==='constructor-throw')throw Error('Controlled constructor failure');}detect(){nativeCalls++;if(mode==='detect-throw')throw Error('Controlled native synchronous failure');if(mode==='malformed-result')return Promise.resolve(null);return Promise.reject(Error('Controlled native asynchronous failure'));}}
 const reader=createFieldQrReader({nativeDetector:mode==='absent'?null:Native,makeCanvas:f.makeCanvas});assert.equal(await reader.read(f.video),raw);assert.equal(parseFieldQr(await reader.read(f.video),target),raw);assert.equal(f.reads.length,2);if(mode.startsWith('detect-')||mode==='malformed-result')assert.equal(nativeCalls,1,'Failed native path must not keep failing on subsequent frames');reader.dispose();
});
for(const invert of [false,true])test(`real qrcode RGBA is decoded locally with inversion=${invert}`,async()=>{
 const f=canvasFixture(frame(raw,{invert})),reader=createFieldQrReader({nativeDetector:null,makeCanvas:f.makeCanvas});assert.equal(parseFieldQr(await reader.read(f.video),target),raw);reader.dispose();
});
test('a real blank frame is not treated as a QR',async()=>{
 const f=canvasFixture(frame(raw,{blank:true})),reader=createFieldQrReader({nativeDetector:null,makeCanvas:f.makeCanvas});assert.equal(await reader.read(f.video),null);reader.dispose();
});
test('a real foreign QR decodes but cannot be adopted for the current sector',async()=>{
 const foreign=JSON.stringify({...JSON.parse(raw),projectId:'other-project'}),f=canvasFixture(frame(foreign)),reader=createFieldQrReader({nativeDetector:null,makeCanvas:f.makeCanvas});const value=await reader.read(f.video);assert.equal(value,foreign);assert.throws(()=>parseFieldQr(value,target),{code:'FIELD_QR_INVALID'});reader.dispose();
});
test('oversized real QR content is not returned by the reader',async()=>{
 const f=canvasFixture(frame('x'.repeat(2049),{scale:3})),reader=createFieldQrReader({nativeDetector:null,makeCanvas:f.makeCanvas});assert.equal(await reader.read(f.video),null);reader.dispose();
});
test('both native and fallback paths cap the longest frame edge at 960',async()=>{
 for(const native of [false,true]){
  const f=canvasFixture(frame(raw,{width:960,height:540}));f.video.videoWidth=3840;f.video.videoHeight=2160;
  class Native{async detect(input){assert.equal(input.width,960);assert.equal(input.height,540);return [{rawValue:raw}];}}
  const reader=createFieldQrReader({nativeDetector:native?Native:null,makeCanvas:f.makeCanvas});assert.equal(await reader.read(f.video),raw);assert.deepEqual(f.draws[0],[f.video,0,0,960,540]);reader.dispose();
 }
});
test('missing/currently unready or unsafe intrinsic dimensions do not allocate or decode',async()=>{
 for(const video of [null,{videoWidth:0,videoHeight:100},{videoWidth:Infinity,videoHeight:100},{videoWidth:16385,videoHeight:100},{videoWidth:-1,videoHeight:100},{videoWidth:5.5,videoHeight:100},{videoWidth:100,videoHeight:100,readyState:0}]){
  const reader=createFieldQrReader({nativeDetector:null,makeCanvas:()=>assert.fail('No invalid frame allocation'),loadDecoder:()=>assert.fail('No decoder for invalid frame')});assert.equal(await reader.read(video),null);reader.dispose();
 }
});
test('dispose releases a pending native capability lookup without adopting its late detector',async()=>{
 const pending=deferred(),f=canvasFixture();let constructions=0;
 class Native{static getSupportedFormats(){return pending.promise;}constructor(){constructions++;}}
 const reader=createFieldQrReader({nativeDetector:Native,makeCanvas:f.makeCanvas});const reading=reader.read(f.video);await tick();reader.dispose();assert.equal(await bounded(reading),null);pending.resolve(['qr_code']);await tick();assert.equal(constructions,0);assert.equal(f.allocations(),0);assert.equal(await reader.read(f.video),null);
});
test('dispose settles pending native detection immediately and discards late content',async()=>{
 const pending=deferred(),f=canvasFixture();class Native{detect(){return pending.promise;}}
 const reader=createFieldQrReader({nativeDetector:Native,makeCanvas:f.makeCanvas});const reading=reader.read(f.video);await tick();assert.equal(f.allocations(),1);reader.dispose();assert.equal(await bounded(reading),null);assert.equal(f.canvas.width,0);assert.equal(f.canvas.height,0);pending.resolve([{rawValue:raw}]);await tick();assert.equal(await reader.read(f.video),null);reader.dispose();
});
test('abort while the lazy local decoder loads settles without allocating a frame',async()=>{
 const pending=deferred(),controller=new AbortController(),f=canvasFixture(),reader=createFieldQrReader({nativeDetector:null,makeCanvas:f.makeCanvas,loadDecoder:()=>pending.promise,signal:controller.signal});const reading=reader.read(f.video);await tick();controller.abort();assert.equal(await bounded(reading),null);pending.resolve(await import('jsqr'));await tick();assert.equal(f.allocations(),0);assert.equal(await reader.read(f.video),null);reader.dispose();
});
test('already aborted signal and repeated dispose prevent any subsequent work',async()=>{
 const controller=new AbortController();controller.abort();const reader=createFieldQrReader({signal:controller.signal,makeCanvas:()=>assert.fail('No aborted allocation'),loadDecoder:()=>assert.fail('No aborted decoder load')});assert.equal(await reader.read({videoWidth:10,videoHeight:10}),null);reader.dispose();reader.dispose();
});
test('concurrent reads do not interleave canvases or adopt a second decode',async()=>{
 const pending=deferred(),f=canvasFixture();let calls=0;class Native{detect(){calls++;return pending.promise;}}
 const reader=createFieldQrReader({nativeDetector:Native,makeCanvas:f.makeCanvas});const first=reader.read(f.video);await tick();assert.equal(await reader.read(f.video),null);pending.resolve([{rawValue:raw}]);assert.equal(await first,raw);assert.equal(calls,1);reader.dispose();
});
test('a native empty frame does not eagerly load the fallback decoder',async()=>{
 const f=canvasFixture();class Native{async detect(){return [];}}
 const reader=createFieldQrReader({nativeDetector:Native,makeCanvas:f.makeCanvas,loadDecoder:()=>assert.fail('Empty native frame is not a native failure')});assert.equal(await reader.read(f.video),null);reader.dispose();
});
test('decoder import failure and unusable canvas return no QR without exposing internal errors',async()=>{
 const f=canvasFixture(),failed=createFieldQrReader({nativeDetector:null,makeCanvas:f.makeCanvas,loadDecoder:()=>Promise.reject(Error('Sensitive internal diagnostic'))});assert.equal(await failed.read(f.video),null);failed.dispose();
 const missing=createFieldQrReader({nativeDetector:null,makeCanvas:()=>({getContext:()=>null})});assert.equal(await missing.read(f.video),null);missing.dispose();
});
