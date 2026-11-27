import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {constants,deflateRawSync,gzipSync} from 'node:zlib';
import {PROVENANCE_RAW_BYTES,PROVENANCE_WIRE_BYTES,encodeWorkspaceProvenance,decodeWorkspaceProvenance} from '../.github/scripts/workspace-provenance-transport.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const packed=bytes=>deflateRawSync(bytes,{level:9,windowBits:15,memLevel:8,strategy:constants.Z_FIXED});
const frame=(bytes,{compressed=packed(bytes),length=bytes.length,digest=sha(bytes)}={})=>'wsp1.'+length+'.'+digest+'.'+compressed.toString('base64');
const denied=(run,code)=>assert.throws(run,error=>error.code===code);
test('all 767 file rows, proof metadata and the existing seal survive byte-for-byte',()=>{
 const files=Array.from({length:767},(_,i)=>({path:'.vercel/synthetic/browser-capture-'+i+'-390.png',sha256:sha(Buffer.from(String(i))),bytes:120000+i}));
 const text=JSON.stringify({version:2,lane:'business',head:'a'.repeat(40),files,proofBindings:[{kind:'synthetic',checks:767}],manifestSha256:'b'.repeat(64)}),wire=encodeWorkspaceProvenance(text);
 assert(Buffer.byteLength(text)>92*1024);assert(Buffer.byteLength(wire)<92*1024);assert.equal(decodeWorkspaceProvenance(wire),text);assert.deepEqual(JSON.parse(decodeWorkspaceProvenance(wire)).files,files);
});
test('UTF-8 accents, escaped quotes and line endings are preserved exactly',()=>{
 const text=JSON.stringify({path:'captura de revisión/ñ.png',notice:'línea uno\r\n"línea dos" 🙂',value:'a\\b'});assert.equal(decodeWorkspaceProvenance(encodeWorkspaceProvenance(text)),text);
});
test('the existing 400KiB raw boundary is exact and cannot be raised by compression',()=>{
 const text='x'.repeat(PROVENANCE_RAW_BYTES);assert.equal(decodeWorkspaceProvenance(encodeWorkspaceProvenance(text)),text);denied(()=>encodeWorkspaceProvenance(text+'x'),'PROVENANCE_LIMIT');
});
test('raw UTF-8 byte size, rather than JavaScript character count, bounds encode',()=>denied(()=>encodeWorkspaceProvenance('ñ'.repeat(PROVENANCE_RAW_BYTES/2+1)),'PROVENANCE_LIMIT'));
test('unpaired Unicode surrogates are never silently replaced on encode or legacy decode',()=>{
 denied(()=>encodeWorkspaceProvenance('"\ud800"'),'PROVENANCE_CODEC_UTF8');denied(()=>decodeWorkspaceProvenance('"\ud800"',{allowLegacyJson:true}),'PROVENANCE_CODEC_UTF8');
});
test('ordinary production decode rejects legacy JSON; explicit unit compatibility preserves it',()=>{
 for(const text of ['{}','null','[]','{']){denied(()=>decodeWorkspaceProvenance(text),'PROVENANCE_CODEC_FRAME');assert.equal(decodeWorkspaceProvenance(text,{allowLegacyJson:true}),text);}
});
test('legacy compatibility cannot be opted into by malformed or extra options',()=>{
 for(const options of [null,[],{allowLegacyJson:'true'},{allowLegacyJson:true,extra:true}])denied(()=>decodeWorkspaceProvenance('{}',options),'PROVENANCE_CODEC_OPTIONS');
});
test('unknown versions, noncanonical sizes, extra fields and frame whitespace are rejected',()=>{
 const bytes=Buffer.from('{}'),good=frame(bytes);
 for(const value of [good.replace('wsp1.','wsp2.'),good.replace('wsp1.2.','wsp1.02.'),good.replace('wsp1.2.','wsp1.0.'),good+'.extra',' '+good,good+'\n'])denied(()=>decodeWorkspaceProvenance(value),'PROVENANCE_CODEC_FRAME');
});
test('declared raw size above 400KiB is rejected before decompression',()=>denied(()=>decodeWorkspaceProvenance(frame(Buffer.from('{}'),{length:PROVENANCE_RAW_BYTES+1})),'PROVENANCE_LIMIT'));
test('base64 padding and pad bits must roundtrip canonically',()=>{
 const base='wsp1.2.'+sha(Buffer.from('{}'))+'.';for(const value of ['AA','AB==','AA===','AA A='])denied(()=>decodeWorkspaceProvenance(base+value),value==='AA==='||value.includes(' ')?'PROVENANCE_CODEC_FRAME':'PROVENANCE_CODEC_BASE64');
});
test('raw digest is independently verified after successful inflate',()=>denied(()=>decodeWorkspaceProvenance(frame(Buffer.from('{}'),{digest:'0'.repeat(64)})),'PROVENANCE_CODEC_DIGEST'));
test('a larger declared raw size still requires the exact resulting byte length',()=>denied(()=>decodeWorkspaceProvenance(frame(Buffer.from('{}'),{length:3})),'PROVENANCE_CODEC_LENGTH'));
test('a smaller declared size is the actual inflate maximum, not merely a postcheck',()=>denied(()=>decodeWorkspaceProvenance(frame(Buffer.from('x'.repeat(10000)),{length:2})),'PROVENANCE_CODEC_INFLATE'));
test('truncated raw DEFLATE is never accepted with a partial result',()=>{
 const raw=Buffer.from('x'.repeat(10000)),compressed=packed(raw);denied(()=>decodeWorkspaceProvenance(frame(raw,{compressed:compressed.subarray(0,-1)})),'PROVENANCE_CODEC_INFLATE');
});
test('trailing garbage, zero padding and a concatenated second stream are rejected',()=>{
 const raw=Buffer.from('{}'),compressed=packed(raw);for(const tail of [Buffer.from([0]),Buffer.from('junk'),packed(Buffer.from('{}'))])assert.throws(()=>decodeWorkspaceProvenance(frame(raw,{compressed:Buffer.concat([compressed,tail])})),error=>['PROVENANCE_CODEC_INFLATE','PROVENANCE_CODEC_TRAILING'].includes(error.code));
});
test('a compressed expansion beyond the retained 400KiB maximum cannot allocate its full output',()=>denied(()=>decodeWorkspaceProvenance(frame(Buffer.alloc(PROVENANCE_RAW_BYTES+1,120),{length:PROVENANCE_RAW_BYTES})),'PROVENANCE_CODEC_INFLATE'));
test('gzip is not an alternate accepted codec',()=>denied(()=>decodeWorkspaceProvenance(frame(Buffer.from('{}'),{compressed:gzipSync(Buffer.from('{}'))})),'PROVENANCE_CODEC_INFLATE'));
test('successful decompression cannot introduce malformed UTF-8',()=>denied(()=>decodeWorkspaceProvenance(frame(Buffer.from([0xc3,0x28]))),'PROVENANCE_CODEC_UTF8'));
test('oversized encoded input is rejected before parsing and inflate',()=>denied(()=>decodeWorkspaceProvenance('wsp1.2.'+'0'.repeat(64)+'.'+'AAAA'.repeat(PROVENANCE_WIRE_BYTES/4)),'PROVENANCE_CODEC_WIRE_LIMIT'));
test('uncompressible content fails within the same wire ceiling instead of dropping fields',()=>{
 const text=Array.from({length:3200},(_,i)=>sha(Buffer.from('deterministic-entropy-'+i))).join('');assert(Buffer.byteLength(text)<PROVENANCE_RAW_BYTES);denied(()=>encodeWorkspaceProvenance(text),'PROVENANCE_CODEC_WIRE_LIMIT');
});
