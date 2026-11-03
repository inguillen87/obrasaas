// Lossless transport only. The existing lane gate still validates the full
// sealed JSON record, every file/proof binding, and the exact Git/run identity.
// Node >=24.19 provides rejectGarbageAfterEnd; CI pins24.21/24.22 separately.
import {createHash} from 'node:crypto';
import {constants,deflateRawSync,inflateRawSync} from 'node:zlib';

export const PROVENANCE_RAW_BYTES=400*1024;
export const PROVENANCE_WIRE_BYTES=92*1024;
const prefix='wsp1.';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const sha=value=>createHash('sha256').update(value).digest('hex');
function rawBytes(text){
 if(typeof text!=='string'||text.length===0)fail('PROVENANCE_CODEC_TYPE');
 if(text.length>PROVENANCE_RAW_BYTES)fail('PROVENANCE_LIMIT');
 const bytes=Buffer.from(text,'utf8');
 if(bytes.length>PROVENANCE_RAW_BYTES)fail('PROVENANCE_LIMIT');
 if(bytes.toString('utf8')!==text)fail('PROVENANCE_CODEC_UTF8');
 return bytes;
}
function wireBytes(value){
 if(typeof value!=='string'||value.length===0)fail('PROVENANCE_CODEC_TYPE');
 if(value.length>PROVENANCE_WIRE_BYTES||Buffer.byteLength(value)>PROVENANCE_WIRE_BYTES)fail('PROVENANCE_CODEC_WIRE_LIMIT');
 return value;
}
export function encodeWorkspaceProvenance(text){
 const raw=rawBytes(text),packed=deflateRawSync(raw,{level:9,windowBits:15,memLevel:8,strategy:constants.Z_FIXED});
 return wireBytes(prefix+raw.length+'.'+sha(raw)+'.'+packed.toString('base64'));
}
export function decodeWorkspaceProvenance(value,options={}){
 if(options===null||typeof options!=='object'||Array.isArray(options)||Object.keys(options).some(key=>key!=='allowLegacyJson')||Object.hasOwn(options,'allowLegacyJson')&&typeof options.allowLegacyJson!=='boolean')fail('PROVENANCE_CODEC_OPTIONS');
 if(typeof value!=='string'||value.length===0)fail('PROVENANCE_CODEC_TYPE');
 // This is an explicit unit-model compatibility port, outside evidence data.
 // The production CLI gate omits it and therefore accepts only wsp1 frames.
 if(options.allowLegacyJson===true&&!value.startsWith(prefix)){rawBytes(value);return value;}
 wireBytes(value);
 const match=/^wsp1\.([1-9][0-9]{0,5})\.([a-f0-9]{64})\.([A-Za-z0-9+/]+={0,2})$/.exec(value);
 if(!match||match[0]!==value)fail('PROVENANCE_CODEC_FRAME');
 const length=Number(match[1]),payload=match[3];
 if(!Number.isSafeInteger(length)||length<1||length>PROVENANCE_RAW_BYTES)fail('PROVENANCE_LIMIT');
 if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(payload))fail('PROVENANCE_CODEC_BASE64');
 const packed=Buffer.from(payload,'base64');
 if(!packed.length||packed.toString('base64')!==payload)fail('PROVENANCE_CODEC_BASE64');
 let observed;
 try{observed=inflateRawSync(packed,{windowBits:15,finishFlush:constants.Z_FINISH,maxOutputLength:length,rejectGarbageAfterEnd:true,info:true});}
 catch{fail('PROVENANCE_CODEC_INFLATE');}
 if(!observed||!Buffer.isBuffer(observed.buffer)||observed.engine?.bytesWritten!==packed.length)fail('PROVENANCE_CODEC_TRAILING');
 const raw=observed.buffer;
 if(raw.length!==length)fail('PROVENANCE_CODEC_LENGTH');
 if(sha(raw)!==match[2])fail('PROVENANCE_CODEC_DIGEST');
 const text=raw.toString('utf8');
 if(!Buffer.from(text,'utf8').equals(raw))fail('PROVENANCE_CODEC_UTF8');
 return text;
}
