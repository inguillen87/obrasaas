import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {loadBindings,transform} from 'next/dist/build/swc/index.js';
import {createKycQualityMonitor,evaluateKycImageQuality,inspectKycPhotoQuality,KYC_QUALITY_SAMPLE_LIMIT} from '../src/app/(identity)/cuenta/kyc-image-quality.mjs';

const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
function pixels(width=480,height=320,value=225,alpha=255){const data=new Uint8ClampedArray(width*height*4);for(let at=0;at<data.length;at+=4){data[at]=data[at+1]=data[at+2]=value;data[at+3]=alpha;}return{data,width,height};}
function textPixels(width=480,height=320){
 const frame=pixels(width,height),glyphs=['10001110011010110011100011000110001','11111100001000011110100001000011111','10001010100010000100010101000110001'];
 for(let line=0;line<5;line++)for(let column=0;column<11;column++){
  const glyph=glyphs[(line+column)%glyphs.length];
  for(let y=0;y<7;y++)for(let x=0;x<5;x++)if(glyph[y*5+x]==='1')for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
   const px=15+column*25+x*2+dx,py=20+line*38+y*2+dy;if(px>=width||py>=height)continue;const at=(py*width+px)*4;frame.data[at]=frame.data[at+1]=frame.data[at+2]=40;
  }
 }
 return frame;
}
function blur(frame,radius=12,rounds=3){
 let values=Float64Array.from({length:frame.width*frame.height},(_,index)=>frame.data[index*4]);
 for(let round=0;round<rounds;round++)for(const horizontal of [true,false]){
  const output=new Float64Array(values.length);
  for(let y=0;y<frame.height;y++)for(let x=0;x<frame.width;x++){
   let sum=0,count=0;for(let offset=-radius;offset<=radius;offset++){const px=horizontal?x+offset:x,py=horizontal?y:y+offset;if(px>=0&&px<frame.width&&py>=0&&py<frame.height){sum+=values[py*frame.width+px];count++;}}
   output[y*frame.width+x]=sum/count;
  }
  values=output;
 }
 const result=pixels(frame.width,frame.height);for(let index=0;index<values.length;index++)result.data[index*4]=result.data[index*4+1]=result.data[index*4+2]=values[index];return result;
}
function canvasFixture(makePixels=(width,height)=>textPixels(width,height)){
 const canvases=[],draws=[],reads=[];
 const createCanvas=()=>{const canvas={width:0,height:0,getContext(type,options){assert.equal(type,'2d');assert.deepEqual(options,{willReadFrequently:true});return{fillRect(){},drawImage(...args){draws.push(args);},getImageData(x,y,width,height){assert.deepEqual([x,y],[0,0]);reads.push({width,height});return makePixels(width,height);}};}};canvases.push(canvas);return canvas;};
 return{createCanvas,canvases,draws,reads};
}

test('actual pixels reject black, white, transparent and featureless frames with actionable exposure/detail guidance',()=>{
 for(const [value,alpha,code]of[[0,255,'DARK'],[255,255,'BRIGHT'],[0,0,'BRIGHT'],[120,255,'DETAIL']]){
  const quality=evaluateKycImageQuality(pixels(480,320,value,alpha));assert.equal(quality.ok,false);assert.equal(quality.code,code);assert.match(quality.message,/luz|reflejo|enfoque/i);assert.ok(Number.isFinite(quality.metrics.laplacianVariance));
 }
});
test('four-neighbor Laplacian variance measures synthetic sharp text and rejects the same pixels after strong optical-style blur',()=>{
 const sharp=evaluateKycImageQuality(textPixels()),soft=evaluateKycImageQuality(blur(textPixels()));
 assert.equal(sharp.ok,true);assert.match(sharp.message,/Luz y nitidez adecuadas/);assert.equal(soft.code,'DETAIL');assert.ok(sharp.metrics.laplacianVariance>soft.metrics.laplacianVariance*50);assert.ok(sharp.metrics.lumaVariance>soft.metrics.lumaVariance);
 assert.doesNotMatch(sharp.message,/verificad|identidad|auténtic|aprobada|rostro detectado/i);
});
test('conservative exposure checks admit detailed low/high tone images and reject almost totally clipped frames',()=>{
 for(const [background,ink]of[[55,20],[235,180]]){const frame=textPixels();for(let at=0;at<frame.data.length;at+=4){const value=frame.data[at]===40?ink:background;frame.data[at]=frame.data[at+1]=frame.data[at+2]=value;}assert.equal(evaluateKycImageQuality(frame).ok,true);}
 for(const [value,code]of[[8,'DARK'],[252,'BRIGHT']]){const frame=pixels(480,320,value);frame.data[0]=frame.data[1]=frame.data[2]=128;assert.equal(evaluateKycImageQuality(frame).code,code);}
});
test('source resolution is checked independently of the bounded sample and malformed dimensions/data fail closed',()=>{
 const sample=textPixels();for(const [sourceWidth,sourceHeight]of[[319,480],[480,319],[320,479],[479,320]])assert.equal(evaluateKycImageQuality({...sample,sourceWidth,sourceHeight}).code,'RESOLUTION');for(const [sourceWidth,sourceHeight]of[[320,480],[480,320]])assert.equal(evaluateKycImageQuality({...sample,sourceWidth,sourceHeight}).ok,true);
 const small=textPixels(160,120);assert.equal(evaluateKycImageQuality({...small,sourceWidth:1280,sourceHeight:960}).ok,true);
 for(const invalid of [null,{}, {...sample,width:NaN},{...sample,height:0},{...sample,width:2},{...sample,width:641},{...sample,sourceWidth:12001},{...sample,sourceWidth:8000,sourceHeight:8000},{...sample,data:sample.data.subarray(1)},{...sample,data:Array.from(sample.data)}])assert.equal(evaluateKycImageQuality(invalid).code,'UNAVAILABLE');
});
test('local decode samples at most 640 pixels per side, releases canvas and bitmap, and never modifies the original',async()=>{
 const renderer=canvasFixture(),file=new File(['synthetic original'],'source.png',{type:'image/png'}),before=await file.arrayBuffer();let closed=0;
 const image={width:4000,height:3000,close(){closed++;}},quality=await inspectKycPhotoQuality(file,{decode:async received=>{assert.equal(received,file);return image;},createCanvas:renderer.createCanvas});
 assert.equal(quality.ok,true);assert.deepEqual(renderer.reads,[{width:640,height:480}]);assert.deepEqual(renderer.draws,[[image,0,0,640,480]]);assert.ok(renderer.reads.every(({width,height})=>width<=KYC_QUALITY_SAMPLE_LIMIT&&height<=KYC_QUALITY_SAMPLE_LIMIT));assert.equal(renderer.canvases[0].width,0);assert.equal(renderer.canvases[0].height,0);assert.equal(closed,1);assert.deepEqual(await file.arrayBuffer(),before);
});
test('small/malformed decoded dimensions reject before canvas allocation and decoder/canvas errors expose no private detail',async()=>{
 for(const dimensions of [{width:319,height:480},{width:320,height:479},{width:0,height:400},{width:12001,height:400},{width:8000,height:8000}]){const renderer=canvasFixture();let closed=0;const quality=await inspectKycPhotoQuality({}, {decode:async()=>({...dimensions,close(){closed++;}}),createCanvas:renderer.createCanvas});assert.equal(quality.ok,false);assert.equal(renderer.canvases.length,0);assert.equal(closed,1);}
 const decoder=await inspectKycPhotoQuality({}, {decode:async()=>{throw Error('private device detail');}});assert.equal(decoder.code,'UNAVAILABLE');assert.doesNotMatch(decoder.message,/private device/);
 const failed=canvasFixture(()=>{throw Error('tainted private bytes');});const quality=await inspectKycPhotoQuality({}, {decode:async()=>({width:480,height:320}),createCanvas:failed.createCanvas});assert.equal(quality.code,'UNAVAILABLE');assert.equal(failed.canvases[0].width,0);assert.doesNotMatch(quality.message,/tainted/);
});
test('abort before or during decode suppresses quality results, closes a late bitmap and allocates no sample canvas',async()=>{
 const controller=new AbortController(),renderer=canvasFixture();controller.abort();let calls=0;await assert.rejects(inspectKycPhotoQuality({}, {signal:controller.signal,decode:async()=>{calls++;},createCanvas:renderer.createCanvas}),{name:'AbortError'});assert.equal(calls,0);
 const pending=deferred(),current=new AbortController();let closed=0;const checking=inspectKycPhotoQuality({}, {signal:current.signal,decode:()=>pending.promise,createCanvas:renderer.createCanvas});current.abort();pending.resolve({width:320,height:240,close(){closed++;}});await assert.rejects(checking,{name:'AbortError'});assert.equal(closed,1);assert.deepEqual(renderer.canvases,[]);
 const stopped=new AbortController();let reads=0;const signal={get aborted(){reads++;return reads>2;}};assert.throws(()=>evaluateKycImageQuality(textPixels(),{signal}),{name:'AbortError'});stopped.abort();assert.throws(()=>evaluateKycImageQuality(textPixels(),{signal:stopped.signal}),{name:'AbortError'});
});
test('Image fallback abort revokes its local object URL and a stale decode completion cannot sample pixels',async()=>{
 const saved={bitmap:globalThis.createImageBitmap,Image:globalThis.Image,create:URL.createObjectURL,revoke:URL.revokeObjectURL},pending=deferred(),renderer=canvasFixture(),revoked=[];let image;
 delete globalThis.createImageBitmap;URL.createObjectURL=()=> 'blob:synthetic-local-only';URL.revokeObjectURL=url=>revoked.push(url);globalThis.Image=class{constructor(){image=this;}decode(){return pending.promise;}};
 try{const controller=new AbortController(),checking=inspectKycPhotoQuality({}, {signal:controller.signal,createCanvas:renderer.createCanvas});controller.abort();await assert.rejects(checking,{name:'AbortError'});assert.equal(image.src,'');assert.deepEqual(revoked,['blob:synthetic-local-only']);pending.resolve();await Promise.resolve();assert.deepEqual(renderer.canvases,[]);assert.equal(revoked.length,1);}
 finally{if(saved.bitmap===undefined)delete globalThis.createImageBitmap;else globalThis.createImageBitmap=saved.bitmap;if(saved.Image===undefined)delete globalThis.Image;else globalThis.Image=saved.Image;URL.createObjectURL=saved.create;URL.revokeObjectURL=saved.revoke;}
});
function monitorFixture(overrides={}){
 const scheduled=new Map(),cancelled=[],results=[],renderer=canvasFixture();let next=0,allowed=true;
 const video={readyState:4,videoWidth:1280,videoHeight:960},monitor=createKycQualityMonitor({getVideo:()=>video,isAllowed:()=>allowed,onResult:quality=>results.push(quality),createCanvas:renderer.createCanvas,schedule:callback=>{scheduled.set(++next,callback);return next;},cancel:timer=>{cancelled.push(timer);scheduled.delete(timer);},...overrides});
 const tick=()=>{const [id,callback]=scheduled.entries().next().value;scheduled.delete(id);callback();};return{monitor,scheduled,cancelled,results,renderer,video,tick,setAllowed:value=>{allowed=value;}};
}
test('a LIVE lifetime only samples explicitly started visible frames and owns one scheduled callback at a time',()=>{
 const f=monitorFixture();assert.equal(f.scheduled.size,0);assert.equal(f.renderer.canvases.length,0);f.monitor.start();f.monitor.start();assert.equal(f.scheduled.size,1);f.tick();assert.equal(f.results.length,1);assert.equal(f.results[0].ok,true);assert.deepEqual(f.renderer.reads,[{width:640,height:480}]);assert.equal(f.scheduled.size,1);f.monitor.dispose();assert.equal(f.scheduled.size,0);assert.equal(f.cancelled.length,1);f.monitor.start();assert.equal(f.scheduled.size,0);
});
test('cleanup rejects retained stale timer callbacks; disabled context and unavailable video cannot read or emit a frame',()=>{
 const old=monitorFixture();old.monitor.start();const stale=old.scheduled.values().next().value;old.monitor.dispose();stale();assert.equal(old.renderer.canvases.length,0);assert.deepEqual(old.results,[]);assert.equal(old.scheduled.size,0);
 const disabled=monitorFixture();disabled.monitor.start();disabled.setAllowed(false);disabled.tick();assert.equal(disabled.renderer.canvases.length,0);assert.deepEqual(disabled.results,[]);assert.equal(disabled.scheduled.size,0);
 const loading=monitorFixture();loading.video.readyState=1;loading.monitor.start();loading.tick();assert.equal(loading.renderer.canvases.length,0);assert.deepEqual(loading.results,[]);loading.monitor.dispose();
});
test('effect cleanup/setup replay owns a fresh monitor and disposal during sampling suppresses late feedback',()=>{
 const old=monitorFixture();old.monitor.start();const stale=old.scheduled.values().next().value;old.monitor.dispose();const fresh=monitorFixture();fresh.monitor.start();stale();fresh.tick();assert.deepEqual(old.results,[]);assert.equal(fresh.results.length,1);fresh.monitor.dispose();
 let monitor;const f=monitorFixture({createCanvas:()=>{monitor.dispose();return canvasFixture().createCanvas();}});monitor=f.monitor;monitor.start();f.tick();assert.deepEqual(f.results,[]);assert.equal(f.scheduled.size,0);
});

// Execute the actual component's handlers with controlled hooks and browser
// ports. This checks async acceptance boundaries without a browser or devices.
async function componentFixture({quality=async()=>({ok:true,code:'READY',message:'Luz y nitidez adecuadas.'})}={}){
 await loadBindings();
 const source=readFileSync(new URL('../src/app/(identity)/cuenta/kyc-photo-preparation.js',import.meta.url),'utf8')+'\nexport const LocalComponent=KycPhotoPreparationInner;';
 const compiled=await transform(source,{filename:'kyc-photo-preparation.js',jsc:{parser:{syntax:'ecmascript',jsx:true},target:'es2022',transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});
 let cursor=0,tree,mounted=false,disposed=false;const hooks=[],effects=[],calls=[],created=[],revoked=[],scheduled=new Map(),cancelled=[],renderer=canvasFixture();let changes=0,nextTimer=0;
 const localVideo={readyState:4,videoWidth:1280,videoHeight:960,srcObject:null};
 const react={useState(initial){const index=cursor++;if(!(index in hooks))hooks[index]=typeof initial==='function'?initial():initial;return[hooks[index],value=>{hooks[index]=typeof value==='function'?value(hooks[index]):value;changes++;}];},useRef(initial){const index=cursor++;if(!(index in hooks))hooks[index]={current:initial};return hooks[index];},useEffect(setup,deps){const index=cursor++,prior=hooks[index];if(!prior||!deps||deps.some((value,at)=>!Object.is(value,prior.deps?.[at])))effects.push(()=>{prior?.cleanup?.();hooks[index]={deps,cleanup:setup()};});}};react.useLayoutEffect=react.useEffect;
 const element=(type,props)=>({type,props:props||{}}),compiledModule={exports:{}},field={verifyPhoto:async()=>({width:320,height:240}),preparePhoto:async file=>({file,width:320,height:240,rotation:0})};
 const require=name=>{if(name==='react')return react;if(name==='react/jsx-runtime')return{jsx:element,jsxs:element,Fragment:'fragment'};if(name==='./field-media-preparation.mjs')return field;if(name==='./kyc-image-quality.mjs')return{inspectKycPhotoQuality:quality,createKycQualityMonitor:options=>createKycQualityMonitor({...options,createCanvas:renderer.createCanvas,schedule:callback=>{scheduled.set(++nextTimer,callback);return nextTimer;},cancel:timer=>{cancelled.push(timer);scheduled.delete(timer);}})};if(name==='./kyc-camera-session.mjs')return{createKycCameraSession:options=>({close(){localVideo.srcObject=null;options.onState({phase:'CLOSED',error:null});},dispose(){localVideo.srcObject=null;},async open(){localVideo.srcObject={synthetic:true};options.onState({phase:'LIVE',error:null});return true;},async capture(){return null;}})};if(name.endsWith('.css'))return new Proxy({},{get:(_target,key)=>key});throw Error('Unexpected component import '+name);};
 new Function('require','module','exports',compiled.code)(require,compiledModule,compiledModule.exports);
 const render=()=>{cursor=0;tree=compiledModule.exports.LocalComponent({kind:'front',disabled:false,active:true,onChange:(...args)=>{calls.push(args);return true;}});walk(tree,node=>{if(node.type==='video'&&node.props.ref)node.props.ref.current=localVideo;});while(effects.length)effects.shift()();mounted=true;return tree;};
 const walk=(node,visit)=>{if(!node||typeof node!=='object')return;visit(node);for(const child of [node.props?.children].flat(Infinity))walk(child,visit);},find=predicate=>{const found=[];walk(tree,node=>{if(predicate(node))found.push(node);});assert.ok(found.length,'Expected component element');return found[0];};
 const saved={window:globalThis.window,document:globalThis.document,create:URL.createObjectURL,revoke:URL.revokeObjectURL};globalThis.window={addEventListener(){},removeEventListener(){}};globalThis.document={addEventListener(){},removeEventListener(){},hidden:false};URL.createObjectURL=file=>{created.push(file);return 'blob:local-'+created.length;};URL.revokeObjectURL=url=>revoked.push(url);
 const flush=async()=>{for(let step=0;step<8;step++)await Promise.resolve();render();};
 return{render,flush,calls,created,revoked,scheduled,cancelled,renderer,get changes(){return changes;},open(){find(node=>node.type==='button'&&node.props.children==='Usar cámara').props.onClick();},close(){find(node=>node.type==='button'&&node.props.children==='Cerrar cámara').props.onClick();},pick(file){const input=find(node=>node.type==='input'&&node.props.type==='file');input.props.onChange({target:{files:[file],value:'synthetic'}});},review(){find(node=>node.type==='input'&&node.props.type==='checkbox').props.onChange({target:{checked:true}});render();},use(){return find(node=>node.type==='button'&&node.props.children==='Usar documento revisado').props.onClick();},text(){const values=[];walk(tree,node=>{for(const child of [node.props?.children].flat(Infinity))if(typeof child==='string')values.push(child);});return values.join(' ');},dispose(){if(disposed)return;disposed=true;if(mounted)for(const hook of hooks)hook?.cleanup?.();if(saved.window===undefined)delete globalThis.window;else globalThis.window=saved.window;if(saved.document===undefined)delete globalThis.document;else globalThis.document=saved.document;URL.createObjectURL=saved.create;URL.revokeObjectURL=saved.revoke;}};
}
test('the actual component blocks failed local quality before review, preview URL creation or onChange(file)',async()=>{
 const f=await componentFixture({quality:async()=>({ok:false,code:'DARK',message:'La imagen está muy oscura. Buscá luz pareja.'})});try{f.render();const file=new File(['synthetic'],'source.png',{type:'image/png'});f.pick(file);await f.flush();assert.match(f.text(),/muy oscura/);assert.doesNotMatch(f.text(),/Usar documento revisado/);assert.deepEqual(f.created,[]);assert.equal(f.calls.some(([value])=>value instanceof File),false);}finally{f.dispose();}
});
test('successful local quality still requires manual review before the actual component hands off the original File',async()=>{
 const f=await componentFixture();try{f.render();const file=new File(['synthetic'],'source.png',{type:'image/png'});f.pick(file);await f.flush();await f.use();assert.equal(f.calls.some(([value])=>value instanceof File),false);f.review();await f.use();assert.equal(f.calls.at(-1)[0],file);assert.equal(f.calls.at(-1)[1].signal.aborted,false);}finally{f.dispose();}
});
test('a replaced or unmounted preparation cannot use a stale local quality callback or emit a preview',async()=>{
 const old=deferred();let oldSignal,calls=0;const f=await componentFixture({quality:(_file,{signal})=>{if(++calls===1){oldSignal=signal;return old.promise;}return Promise.resolve({ok:false,message:'La imagen está muy oscura.'});}});
 try{f.render();f.pick(new File(['first'],'first.png',{type:'image/png'}));await f.flush();f.pick(new File(['second'],'second.png',{type:'image/png'}));await f.flush();assert.equal(oldSignal.aborted,true);old.resolve({ok:true});await f.flush();assert.deepEqual(f.created,[]);assert.equal(f.calls.some(([value])=>value instanceof File),false);assert.match(f.text(),/muy oscura/);}finally{f.dispose();}
 const late=deferred();const unmounted=await componentFixture({quality:()=>late.promise});unmounted.render();unmounted.pick(new File(['late'],'late.png',{type:'image/png'}));await unmounted.flush();unmounted.dispose();const before=unmounted.changes;late.resolve({ok:true});for(let step=0;step<8;step++)await Promise.resolve();assert.equal(unmounted.changes,before);assert.deepEqual(unmounted.created,[]);
});
test('the actual LIVE effect samples only its visible stream, closes immediately and cancels its timer on cleanup',async()=>{
 const f=await componentFixture();try{
  f.render();assert.equal(f.scheduled.size,0);f.open();await f.flush();assert.equal(f.scheduled.size,1);
  let [id,tick]=f.scheduled.entries().next().value;f.scheduled.delete(id);tick();f.render();assert.match(f.text(),/Luz y nitidez adecuadas/);assert.equal(f.renderer.canvases.length,1);assert.equal(f.created.length,0);assert.equal(f.calls.length,0);
  [id,tick]=f.scheduled.entries().next().value;f.close();f.scheduled.delete(id);tick();assert.equal(f.renderer.canvases.length,1);await f.flush();assert.equal(f.scheduled.size,0);
  f.open();await f.flush();const stale=f.scheduled.values().next().value;assert.equal(f.scheduled.size,1);f.dispose();const changes=f.changes;stale();assert.equal(f.renderer.canvases.length,1);assert.equal(f.changes,changes);assert.equal(f.scheduled.size,0);
 }finally{f.dispose();}
});
test('the local quality module has no transport, persistence, model or telemetry operations',()=>{
 const qualitySource=readFileSync(new URL('../src/app/(identity)/cuenta/kyc-image-quality.mjs',import.meta.url),'utf8');assert.doesNotMatch(qualitySource,/\bfetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|indexedDB|\.toBlob\s*\(|\.toDataURL\s*\(|FaceDetector|https?:\/\//);const component=readFileSync(new URL('../src/app/(identity)/cuenta/kyc-photo-preparation.js',import.meta.url),'utf8');assert.doesNotMatch(component,/data-.*metrics|JSON\.stringify\(.*metrics/);
});
