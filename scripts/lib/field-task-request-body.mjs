import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

// Synthetic fixture body observation only. This does not parse customer uploads.
// Keep binary bytes: CDP postData text can omit files or replace non-UTF8 bytes.
export const FIELD_TASK_BODY_LIMIT=256*1024;
const hash=value=>createHash('sha256').update(value).digest('hex');
const utf8=value=>{const text=value.toString('utf8');assert.ok(Buffer.from(text).equals(value),'Lossless UTF8 text required');return text;};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const exact=(value,keys)=>assert.deepEqual(Object.keys(value).sort(),[...keys].sort());

function multipart(body,contentType){
 const match=/^multipart\/form-data;\s*boundary=(?:"([A-Za-z0-9_-]{1,70})"|([A-Za-z0-9_-]{1,70}))$/i.exec(contentType);
 assert.ok(match,'One bounded multipart boundary required');const boundary=match[1]||match[2],first=Buffer.from('--'+boundary+'\r\n'),delimiter=Buffer.from('\r\n--'+boundary),fields=new Map();let file=null,count=0;
 assert.ok(body.subarray(0,first.length).equals(first),'Exact initial multipart delimiter required');let offset=first.length;
 while(true){
  const headerEnd=body.indexOf(Buffer.from('\r\n\r\n'),offset);assert.ok(headerEnd>=offset&&headerEnd-offset<=4096,'Bounded multipart headers required');
  const lines=utf8(body.subarray(offset,headerEnd)).split('\r\n'),disposition=/^Content-Disposition: form-data; name="([A-Za-z][A-Za-z0-9_]*)"(?:; filename="([^"\r\n]*)")?$/i.exec(lines[0]);
  assert.ok(disposition,'Exact fixture Content-Disposition required');const name=disposition[1],filename=disposition[2];assert.ok(!fields.has(name)&&!(name==='file'&&file),'Duplicate multipart fields rejected');
  const start=headerEnd+4,end=body.indexOf(delimiter,start);assert.ok(end>=start,'Complete multipart part required');const value=body.subarray(start,end);
  if(filename!==undefined){assert.equal(name,'file');assert.equal(lines.length,2);assert.equal(lines[1].toLowerCase(),'content-type: image/png');assert.ok(filename.length>0&&filename.length<=200&&value.length>0);file={name:filename,type:'image/png',size:value.length,sha256:hash(value)};}
  else{assert.equal(lines.length,1);assert.notEqual(name,'file');assert.ok(value.length<=4096);fields.set(name,utf8(value));}
  assert.ok(++count<=16,'Bounded multipart parts required');offset=end+delimiter.length;
  if(body.subarray(offset,offset+2).equals(Buffer.from('--'))){const tail=body.subarray(offset+2);assert.ok(tail.length===0||tail.equals(Buffer.from('\r\n')),'No trailing multipart bytes allowed');break;}
  assert.ok(body.subarray(offset,offset+2).equals(Buffer.from('\r\n')),'Exact next multipart delimiter required');offset+=2;
 }
 assert.ok(file,'An actual binary file part is required');return{command:Object.fromEntries(fields),file};
}

export function observeFieldTaskRequestBody(body,{path,contentType}){
 assert.ok(Buffer.isBuffer(body)&&body.length>0&&body.length<=FIELD_TASK_BODY_LIMIT,'Bounded actual HTTP body bytes required');
 assert.ok(['/api/identity/field-operations','/api/identity/field-media'].includes(path));assert.equal(typeof contentType,'string');let command,file=null;
 if(/^application\/json(?:;\s*charset=utf-8)?$/i.test(contentType)){const text=utf8(body);command=JSON.parse(text);assert.ok(command&&typeof command==='object'&&!Array.isArray(command));assert.equal(JSON.stringify(command),text,'Canonical JSON without duplicate keys required');assert.equal(path,'/api/identity/field-operations');}
 else{assert.equal(path,'/api/identity/field-media');({command,file}=multipart(body,contentType));}
 assert.match(command.operationId,uuid);assert.equal(command.projectId,'project-page-fixture');assert.equal(command.scope,'a'.repeat(64));
 return{bodyBytes:body.length,bodySha256:hash(body),operationId:command.operationId,projectId:command.projectId,scope:command.scope,file};
}

export function validateFieldTaskCapturedBodies(raw,{directory,readEvidence}){
 assert.equal(raw.version,3,'Only current raw3 captures may certify body bytes');assert.ok(Array.isArray(raw.requestBodies));const posts=raw.requests.map((row,index)=>({row,index})).filter(({row})=>row.method==='POST');assert.equal(raw.requestBodies.length,posts.length);
 for(const[index,{row,index:requestIndex}]of posts.entries()){
  const capture=raw.requestBodies[index];exact(capture,['requestIndex','path','contentType','bytes','sha256']);assert.equal(capture.requestIndex,requestIndex);assert.equal(capture.path,'request-body-'+(index+1)+'.bin');assert.equal(typeof capture.contentType,'string');assert.ok(Number.isSafeInteger(capture.bytes)&&capture.bytes>0&&capture.bytes<=FIELD_TASK_BODY_LIMIT);assert.match(capture.sha256,/^[a-f0-9]{64}$/);
  const body=readEvidence(directory+'/'+capture.path);assert.ok(Buffer.isBuffer(body));assert.equal(body.length,capture.bytes);assert.equal(hash(body),capture.sha256);assert.equal(capture.sha256,row.bodySha256);const observed=observeFieldTaskRequestBody(body,{path:row.path,contentType:capture.contentType});assert.equal(observed.operationId,row.operationId);
 }
 return{capturedBodies:posts.length,exactBinaryBytesRehashed:true};
}
