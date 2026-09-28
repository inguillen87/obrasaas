import { mkdir, realpath, lstat, open, unlink, rmdir } from 'node:fs/promises';
import { resolve, relative, isAbsolute, dirname } from 'node:path';
import { CutoverAuditError } from './legacy-cutover-audit.mjs';
const fail=code=>{throw new CutoverAuditError(code);};
const MAX_BYTES=16*1024*1024;
async function location(root,input,{createBase=false}={}) {
  if(typeof input!=='string'||input.includes('\0'))fail('PLAN_FILE_LOCATION_INVALID');
  const base=await realpath(root),folder=resolve(base,'.vercel'),target=resolve(base,input),rel=relative(folder,target);
  if(!rel||rel.startsWith('..')||isAbsolute(rel))fail('PLAN_FILE_LOCATION_INVALID');
  const parts=rel.split(/[\\/]/);
  if(parts.some(part=>! /^[A-Za-z0-9][A-Za-z0-9_.-]{0,100}$/.test(part)))fail('PLAN_FILE_LOCATION_INVALID');
  if(createBase)await mkdir(folder,{recursive:true,mode:0o700});
  const folderInfo=await lstat(folder);if(folderInfo.isSymbolicLink()||!folderInfo.isDirectory())fail('PLAN_FILE_LOCATION_INVALID');
  let current=folder;
  for(const part of parts.slice(0,-1)) {
    current=resolve(current,part);const entry=await lstat(current);
    if(entry.isSymbolicLink()||!entry.isDirectory())fail('PLAN_FILE_LOCATION_INVALID');
  }
  if(await realpath(dirname(target))!==dirname(target))fail('PLAN_FILE_LOCATION_INVALID');
  return target;
}
export async function readPrivateMappingReview(root,input) {
  try {
    const target=await location(root,input);
    if(!target.endsWith('.json'))fail('PLAN_REVIEW_FILE_INVALID');
    const info=await lstat(target);
    if(info.isSymbolicLink()||!info.isFile()||info.size>MAX_BYTES)fail('PLAN_REVIEW_FILE_INVALID');
    const file=await open(target,'r');

    try {
      const opened=await file.stat();
      if(!opened.isFile()||opened.size>MAX_BYTES||opened.ino!==info.ino||opened.dev!==info.dev)fail('PLAN_REVIEW_FILE_CHANGED');
      const text=await file.readFile('utf8');if(Buffer.byteLength(text)>MAX_BYTES)fail('PLAN_REVIEW_FILE_INVALID');
      return JSON.parse(text);
    } finally {await file.close();}
  } catch(error) {
    if(error instanceof CutoverAuditError)throw error;
    fail('PLAN_REVIEW_UNAVAILABLE');
  }
}
export async function writePrivateMappingBundle(root,input,{manifest,report,html}) {
  const contents=[['manifest.json',JSON.stringify(manifest,null,2)+'\n'],['check.json',JSON.stringify(report,null,2)+'\n'],['review.html',html]];
  for(const [,text] of contents)if(typeof text!=='string'||Buffer.byteLength(text)>MAX_BYTES)fail('PLAN_BUNDLE_TOO_LARGE');
  const created=[];let folder,owned=false;
  try {
    folder=await location(root,input,{createBase:true});
    await mkdir(folder,{mode:0o700});owned=true;
    for(const [name,text] of contents) {
      const path=resolve(folder,name),file=await open(path,'wx',0o600);created.push(path);
      try {await file.writeFile(text,'utf8');await file.sync();} finally {await file.close();}
    }
    return folder;
  } catch(error) {
    for(const path of created)await unlink(path).catch(()=>{});
    if(owned)await rmdir(folder).catch(()=>{});
    if(error instanceof CutoverAuditError)throw error;
    fail(error.code==='EEXIST'?'PLAN_BUNDLE_EXISTS':'PLAN_BUNDLE_WRITE_FAILED');
  }
}
