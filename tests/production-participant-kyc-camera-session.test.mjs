import assert from 'node:assert/strict';
import test from 'node:test';
import {createKycCameraSession} from '../src/app/(identity)/cuenta/kyc-camera-session.mjs';

const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
function stream(){
 const tracks=Array.from({length:2},()=>({stopped:0,ended:null,stop(){this.stopped++;},addEventListener(name,callback){assert.equal(name,'ended');this.ended=callback;},removeEventListener(name,callback){assert.equal(name,'ended');if(this.ended===callback)this.ended=null;}}));
 return{getTracks:()=>tracks,tracks};
}
function fixture(overrides={}){
 const states=[],requests=[],draws=[],canvases=[],files=[],device=stream();let allowed=true;
 const video={srcObject:null,readyState:4,videoWidth:3840,videoHeight:2160,plays:0,pauses:0,async play(){this.plays++;},pause(){this.pauses++;}};
 const session=createKycCameraSession({getVideo:()=>video,isAllowed:()=>allowed,onState:state=>states.push(state),cameraAvailable:()=>true,getUserMedia:async constraints=>{requests.push(constraints);return device;},createCanvas:()=>{const canvas={getContext:()=>({drawImage(...args){draws.push(args);}}),toBlob(done,type){done(new Blob(['synthetic pixels'],{type}));}};canvases.push(canvas);return canvas;},createFile:(parts,name,options)=>{const file=new File(parts,name,options);files.push(file);return file;},...overrides});
 return{session,states,requests,draws,canvases,files,device,video,setAllowed:value=>{allowed=value;}};
}
const stopped=device=>device.tracks.every(track=>track.stopped>0);

test('construction never asks permission or captures; an explicit open requests video only and preferred facing mode',async()=>{
 for(const [kind,facing]of[['selfie','user'],['front','environment'],['back','environment']]){
  const f=fixture();assert.deepEqual(f.requests,[]);assert.deepEqual(f.states,[]);assert.equal(await f.session.capture(),null);
  assert.equal(await f.session.open(kind),true);assert.equal(f.requests.length,1);assert.equal(f.requests[0].audio,false);assert.deepEqual(f.requests[0].video.facingMode,{ideal:facing});assert.equal(f.video.srcObject,f.device);assert.equal(f.video.plays,1);assert.equal(f.states.at(-1).phase,'LIVE');assert.deepEqual(f.files,[]);f.session.dispose();
 }
});
test('an unavailable device or forbidden context cannot ask for camera permission',async()=>{
 const unavailable=fixture({cameraAvailable:()=>false});assert.equal(await unavailable.session.open('selfie'),false);assert.deepEqual(unavailable.requests,[]);assert.equal(unavailable.states.at(-1).error,'UNAVAILABLE');
 const forbidden=fixture();forbidden.setAllowed(false);assert.equal(await forbidden.session.open('front'),false);assert.deepEqual(forbidden.requests,[]);assert.deepEqual(forbidden.states,[]);
});
test('repeated clicks during a permission request cannot create a second permission operation',async()=>{
 const pending=deferred();let requests=0;const f=fixture({getUserMedia:()=>{requests++;return pending.promise;}}),opening=f.session.open('selfie');
 assert.equal(await f.session.open('selfie'),false);assert.equal(requests,1);assert.equal(await f.session.capture(),null);f.session.close();pending.resolve(f.device);assert.equal(await opening,false);assert.ok(stopped(f.device));
});
test('closing while permission is pending stops a late grant without attaching or reading the camera',async()=>{
 const pending=deferred(),f=fixture({getUserMedia:()=>pending.promise}),opening=f.session.open('selfie');f.session.close();const afterClose=f.states.length;
 pending.resolve(f.device);assert.equal(await opening,false);assert.ok(stopped(f.device));assert.equal(f.video.srcObject,null);assert.equal(f.video.plays,0);assert.equal(f.states.length,afterClose);assert.deepEqual(f.canvases,[]);
});
test('a late grant from the old request cannot detach or close a newer camera session',async()=>{
 const first=deferred(),second=deferred(),old=stream(),fresh=stream();let calls=0;const f=fixture({getUserMedia:()=>++calls===1?first.promise:second.promise});
 const openingOld=f.session.open('front');f.session.close();const openingFresh=f.session.open('selfie');second.resolve(fresh);assert.equal(await openingFresh,true);const states=f.states.length;
 first.resolve(old);assert.equal(await openingOld,false);assert.ok(stopped(old));assert.equal(stopped(fresh),false);assert.equal(f.video.srcObject,fresh);assert.equal(f.states.length,states);f.session.dispose();assert.ok(stopped(fresh));
});
test('denied permission is recoverable through a new explicit click without leaking the provider error',async()=>{
 let attempts=0;const f=fixture({getUserMedia:async()=>{if(++attempts===1)throw new DOMException('Private device detail','NotAllowedError');return f.device;}});
 assert.equal(await f.session.open('selfie'),false);assert.deepEqual(f.states.at(-1),{phase:'CLOSED',error:'PERMISSION_DENIED'});assert.doesNotMatch(JSON.stringify(f.states),/Private device/);assert.equal(await f.session.open('selfie'),true);f.session.dispose();assert.ok(stopped(f.device));
});
test('permission granted after unmount is stopped and cannot send state updates',async()=>{
 const pending=deferred(),f=fixture({getUserMedia:()=>pending.promise}),opening=f.session.open('front');f.session.dispose();const states=f.states.length;pending.resolve(f.device);
 assert.equal(await opening,false);assert.ok(stopped(f.device));assert.equal(f.video.srcObject,null);assert.equal(f.states.length,states);assert.equal(await f.session.open('selfie'),false);assert.equal(await f.session.capture(),null);
});
test('revoked active step or disabled context during permission cannot attach the late stream',async()=>{
 const pending=deferred(),f=fixture({getUserMedia:()=>pending.promise}),opening=f.session.open('back');f.setAllowed(false);pending.resolve(f.device);
 assert.equal(await opening,false);assert.ok(stopped(f.device));assert.equal(f.video.srcObject,null);assert.equal(f.video.plays,0);assert.equal(f.states.at(-1).phase,'CLOSED');
});
test('closing during pending playback releases the stream and suppresses a late LIVE state',async()=>{
 const playing=deferred(),f=fixture();f.video.play=()=>playing.promise;const opening=f.session.open('selfie');await Promise.resolve();assert.equal(f.video.srcObject,f.device);assert.equal(await f.session.capture(),null);
 f.session.close();const states=f.states.length;assert.ok(stopped(f.device));assert.equal(f.video.srcObject,null);playing.resolve();assert.equal(await opening,false);assert.equal(f.states.length,states);
});
test('teardown stops every track even if one device stop throws and removes ended listeners',async()=>{
 const f=fixture();await f.session.open('front');f.device.tracks[0].stop=()=>{throw Error('Device disappeared');};f.session.close();assert.equal(f.device.tracks[1].stopped,1);assert.ok(f.device.tracks.every(track=>track.ended===null));assert.equal(f.video.srcObject,null);
});
test('a device ending releases all remaining tracks and permits an explicit retry',async()=>{
 const f=fixture();await f.session.open('front');f.device.tracks[0].ended();assert.ok(stopped(f.device));assert.equal(f.video.srcObject,null);assert.deepEqual(f.states.at(-1),{phase:'CLOSED',error:'ENDED'});assert.equal(await f.session.open('front'),true);f.session.dispose();
});
test('capture draws original unmirrored video pixels, bounds resolution and only returns a local File',async()=>{
 const f=fixture();await f.session.open('selfie');assert.deepEqual(f.files,[]);const file=await f.session.capture();assert.ok(file instanceof File);assert.equal(file.name,'selfie.jpg');assert.equal(file.type,'image/jpeg');assert.equal(f.canvases[0].width,2560);assert.equal(f.canvases[0].height,1440);assert.deepEqual(f.draws,[[f.video,0,0,2560,1440]]);assert.ok(stopped(f.device));assert.equal(f.video.srcObject,null);assert.equal(f.states.at(-1).phase,'CLOSED');assert.equal(f.states.some(state=>Object.values(state).includes(file)),false);assert.equal(await f.session.capture(),null);
});
test('invalid or not ready frames cannot allocate a canvas and can be retried when ready',async()=>{
 for(const values of[{readyState:1},{videoWidth:0},{videoWidth:12001},{videoWidth:8000,videoHeight:8000}]){
  const f=fixture();await f.session.open('front');Object.assign(f.video,values);assert.equal(await f.session.capture(),null);assert.deepEqual(f.canvases,[]);assert.equal(f.states.at(-1).error,'FRAME_UNAVAILABLE');assert.equal(stopped(f.device),false);Object.assign(f.video,{readyState:4,videoWidth:640,videoHeight:480});assert.ok(await f.session.capture());
 }
});
test('canvas failure keeps a live camera available for retry and never creates a File',async()=>{
 let attempts=0;const f=fixture({createCanvas:()=>({getContext:()=>++attempts===1?null:{drawImage(){}},toBlob:done=>done(new Blob(['synthetic'],{type:'image/jpeg'}))})});await f.session.open('back');assert.equal(await f.session.capture(),null);assert.deepEqual(f.files,[]);assert.equal(f.states.at(-1).error,'CAPTURE_FAILED');assert.equal(stopped(f.device),false);const file=await f.session.capture();assert.equal(file.name,'documento-dorso.jpg');assert.ok(stopped(f.device));
});
test('closing or unmounting during encoding discards the local frame and never creates a File',async()=>{
 for(const method of['close','dispose']){
  let encode;const f=fixture({createCanvas:()=>({getContext:()=>({drawImage(){}}),toBlob:done=>{encode=done;}})});await f.session.open('selfie');const capture=f.session.capture();assert.equal(await f.session.capture(),null);f.session[method]();const states=f.states.length;encode(new Blob(['synthetic'],{type:'image/jpeg'}));assert.equal(await capture,null);assert.deepEqual(f.files,[]);assert.equal(f.states.length,states);assert.ok(stopped(f.device));
 }
});
test('context invalidation during encoding releases the stream and discards the captured image',async()=>{
 let encode;const f=fixture({createCanvas:()=>({getContext:()=>({drawImage(){}}),toBlob:done=>{encode=done;}})});await f.session.open('front');const capture=f.session.capture();f.setAllowed(false);encode(new Blob(['synthetic'],{type:'image/jpeg'}));assert.equal(await capture,null);assert.deepEqual(f.files,[]);assert.ok(stopped(f.device));assert.equal(f.video.srcObject,null);
});
test('a cancelled old encoding cannot return a File or interfere with a newly opened camera',async()=>{
 let encode;const fresh=stream();let requests=0;const f=fixture({getUserMedia:async()=>++requests===1?f.device:fresh,createCanvas:()=>({getContext:()=>({drawImage(){}}),toBlob:done=>{encode=done;}})});
 await f.session.open('front');const capture=f.session.capture();f.session.close();await f.session.open('selfie');const states=f.states.length;encode(new Blob(['old frame'],{type:'image/jpeg'}));assert.equal(await capture,null);assert.deepEqual(f.files,[]);assert.equal(f.video.srcObject,fresh);assert.equal(stopped(fresh),false);assert.equal(f.states.length,states);f.session.dispose();
});
test('React cleanup/re-setup can own a fresh session while a disposed predecessor settles',async()=>{
 const old=deferred(),f=fixture({getUserMedia:()=>old.promise}),opening=f.session.open('selfie');f.session.dispose();const remounted=fixture();assert.equal(await remounted.session.open('selfie'),true);old.resolve(f.device);assert.equal(await opening,false);assert.ok(stopped(f.device));assert.equal(stopped(remounted.device),false);assert.equal(remounted.video.srcObject,remounted.device);remounted.session.dispose();
});
