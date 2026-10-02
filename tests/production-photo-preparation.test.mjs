import assert from 'node:assert/strict';
import test from 'node:test';
import {inspectPhoto,preparePhoto,verifyPhoto,PHOTO_LIMIT} from '../src/app/(identity)/cuenta/field-media-preparation.mjs';

const limits={maxOriginalBytes:20*1024*1024,maxPixels:24_000_000,maxDimension:12000};
function png(width=4032,height=3024){const bytes=new Uint8Array(24);bytes.set([137,80,78,71,13,10,26,10]);bytes.set([73,72,68,82],12);new DataView(bytes.buffer).setUint32(16,width);new DataView(bytes.buffer).setUint32(20,height);return new File([bytes],'synthetic.png',{type:'image/png'});}
test('bounded preflight admits a twelve megapixel phone photo and reads at most 256KiB',async()=>{
 let end;const file=png();const wrapped={size:file.size,type:file.type,slice(start,finish){assert.equal(start,0);end=finish;return file.slice(start,finish);}};
 assert.deepEqual(await inspectPhoto(wrapped,limits),{width:4032,height:3024});assert.equal(end,256*1024);
});
test('oversized bytes and unsupported HEIC fail before any header read or decoding',async()=>{
 let reads=0;const slice=()=>{reads++;throw Error('Must not read');};
 await assert.rejects(inspectPhoto({size:limits.maxOriginalBytes+1,type:'image/jpeg',slice},limits),/tamaño seguro/);
 await assert.rejects(inspectPhoto({size:100,type:'image/heic',slice},limits),/HEIC/);assert.equal(reads,0);
});
test('pixel bounds, dimension bounds, missing headers and truncated metadata fail closed',async()=>{
 await assert.rejects(inspectPhoto(png(8000,8000),limits),/tamaño seguro/);
 await assert.rejects(inspectPhoto(png(12001,1),limits),/tamaño seguro/);
 await assert.rejects(inspectPhoto(new File([new Uint8Array(12)],'invalid.png',{type:'image/png'}),limits),/comprobar/);
 await assert.rejects(inspectPhoto(png(0,2),limits),/comprobar/);
});
test('JPEG SOF and both WebP dimension headers are checked without a decoder',async()=>{
 const jpeg=Uint8Array.from([255,216,255,224,0,4,0,0,255,192,0,8,8,11,208,15,160,3]);
 assert.deepEqual(await inspectPhoto(new File([jpeg],'phone.jpg',{type:'image/jpeg'}),limits),{width:4000,height:3024});
 for(const chunk of ['VP8X','VP8L','VP8 ']){
  const bytes=new Uint8Array(32);bytes.set(new TextEncoder().encode('RIFF'),0);bytes.set(new TextEncoder().encode('WEBP'+chunk),8);
  if(chunk==='VP8X'){bytes.set([143,1,0],24);bytes.set([43,1,0],27);}
  else if(chunk==='VP8L'){bytes[20]=47;new DataView(bytes.buffer).setUint32(21,399+(299<<14),true);}
  else{bytes.set([157,1,42],23);new DataView(bytes.buffer).setUint16(26,400,true);new DataView(bytes.buffer).setUint16(28,300,true);}
  assert.deepEqual(await inspectPhoto(new File([bytes],'phone.webp',{type:'image/webp'}),limits),{width:400,height:300});
 }
});
async function renderer(run){
 const saved={bitmap:globalThis.createImageBitmap,document:globalThis.document};const seen={closed:0,decodes:0,canvases:[],qualities:[]};
 globalThis.createImageBitmap=async(_file,options)=>{seen.decodes++;assert.equal(options.imageOrientation,'from-image');return{width:4000,height:3000,close(){seen.closed++;}};};
 globalThis.document={createElement(tag){assert.equal(tag,'canvas');const canvas={getContext:()=>({fillRect(){},translate(){},rotate(){},drawImage(){}}),toBlob(callback,type,quality){seen.qualities.push(quality);assert.equal(type,'image/jpeg');callback(new Blob([new Uint8Array(quality>.8?1_500_000:900_000)],{type}));}};seen.canvases.push(canvas);return canvas;}};
 try{await run(seen);}finally{if(saved.bitmap===undefined)delete globalThis.createImageBitmap;else globalThis.createImageBitmap=saved.bitmap;if(saved.document===undefined)delete globalThis.document;else globalThis.document=saved.document;}
}
test('field default still allows a two MiB photo; KYC one MiB uses the same renderer and closes the decoder',async()=>renderer(async seen=>{
 const file=png(4000,3000),original=new Uint8Array(await file.arrayBuffer());
 const field=await preparePhoto(file);assert.equal(PHOTO_LIMIT,2*1024*1024);assert.equal(field.file.size,1_500_000);
 const kyc=await preparePhoto(file,{maxBytes:1024*1024,originalLimits:limits,rotation:90});
 assert.equal(kyc.file.size,900_000);assert.equal(kyc.width,1920);assert.equal(kyc.height,2560);assert.equal(kyc.file.type,'image/jpeg');assert.equal(seen.closed,2);assert.deepEqual(new Uint8Array(await file.arrayBuffer()),original);
}));
test('invalid copy settings and oversized pixel headers cannot allocate a decoder or canvas',async()=>renderer(async seen=>{
 await assert.rejects(preparePhoto(png(),{maxBytes:PHOTO_LIMIT+1}),/configuración/);
 await assert.rejects(preparePhoto(png(8000,8000),{maxBytes:1024*1024,originalLimits:limits}),/tamaño seguro/);
 assert.equal(seen.decodes,0);assert.equal(seen.canvases.length,0);
}));
test('cancelling a pending decode closes it and never allocates a canvas',async()=>renderer(async seen=>{
 let resolve;globalThis.createImageBitmap=()=>new Promise(done=>{resolve=done;});const controller=new AbortController();
 const pending=preparePhoto(png(),{signal:controller.signal});await Promise.resolve();controller.abort();resolve({width:4032,height:3024,close(){seen.closed++;}});
 await assert.rejects(pending,{name:'AbortError'});assert.equal(seen.closed,1);assert.equal(seen.canvases.length,0);
}));
test('a valid header cannot authorize a corrupt small image; successful verification closes without recompressing',async()=>renderer(async seen=>{
 const file=png();const checked=await verifyPhoto(file,{originalLimits:limits});assert.deepEqual(checked,{width:4000,height:3000});assert.equal(seen.closed,1);assert.equal(seen.canvases.length,0);
 globalThis.createImageBitmap=async()=>{throw new DOMException('Corrupt pixels','InvalidStateError');};await assert.rejects(verifyPhoto(file,{originalLimits:limits}),/No se pudo abrir/);
}));
test('fallback cancellation revokes its temporary URL before a pending image decode settles',async()=>renderer(async seen=>{
 const saved={Image:globalThis.Image,create:URL.createObjectURL,revoke:URL.revokeObjectURL};let settle,instance;const created=[],revoked=[];delete globalThis.createImageBitmap;
 URL.createObjectURL=()=>{created.push('blob:controlled-private');return created.at(-1);};URL.revokeObjectURL=url=>revoked.push(url);
 globalThis.Image=class{constructor(){instance=this;}decode(){return new Promise(resolve=>{settle=resolve;});}};
 try{const controller=new AbortController(),pending=verifyPhoto(png(),{originalLimits:limits,signal:controller.signal});while(!settle)await Promise.resolve();controller.abort();await assert.rejects(pending,{name:'AbortError'});assert.equal(instance.src,'');assert.deepEqual(revoked,created);assert.equal(seen.canvases.length,0);settle();await Promise.resolve();assert.deepEqual(revoked,created);}
 finally{if(saved.Image===undefined)delete globalThis.Image;else globalThis.Image=saved.Image;URL.createObjectURL=saved.create;URL.revokeObjectURL=saved.revoke;}
}));
