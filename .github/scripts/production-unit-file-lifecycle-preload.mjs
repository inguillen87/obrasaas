import {readFileSync,lstatSync,realpathSync,writeSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {isMainThread} from 'node:worker_threads';

// Diagnostic only: no test imports, wrappers, exitCode changes or async work.
// A missing/invalid observation must never be interpreted as a passing test.
const startWall=Date.now(),startNs=process.hrtime.bigint();
const wallNow=Date.now,monoNow=process.hrtime.bigint,serialize=JSON.stringify;
const write=writeSync,pid=process.pid;
const marker='OBRASAAS_UNIT_FILE_LIFECYCLE_V1 ';
function observe(){
 if(!isMainThread||typeof process.argv[1]!=='string')return;
 const encoded=process.env.OBRASAAS_UNIT_FILE_LIFECYCLE;
 if(typeof encoded!=='string'||encoded.length>131072)return;
 const config=JSON.parse(encoded);
 if(!config||Object.keys(config).sort().join(',')!=='root,selected,version'||config.version!==1||typeof config.root!=='string'||!path.isAbsolute(config.root)||!Array.isArray(config.selected)||config.selected.length<1||config.selected.length>392)return;
 const root=realpathSync(config.root),seen=new Set();
 for(const row of config.selected){
  if(!row||Object.keys(row).sort().join(',')!=='path,sha256'||typeof row.path!=='string'||!row.path.endsWith('.test.mjs')||row.path.includes('\\')||path.posix.normalize(row.path)!==row.path||path.posix.isAbsolute(row.path)||row.path.split('/').some(part=>!part||part==='.'||part==='..')||typeof row.sha256!=='string'||!/^[a-f0-9]{64}$/.test(row.sha256)||seen.has(row.path))return;
  seen.add(row.path);
 }
 const entry=realpathSync(process.argv[1]),relative=path.relative(root,entry);
 if(relative===''||path.isAbsolute(relative)||relative.split(path.sep).includes('..'))return;
 const file=relative.split(path.sep).join('/'),selected=config.selected.find(row=>row.path===file);
 if(!selected)return;
 const stat=lstatSync(path.join(root,file));
 if(!stat.isFile()||stat.isSymbolicLink())return;
 const source=readFileSync(entry),sourceSha256=createHash('sha256').update(source).digest('hex');
 const common={version:1,file,pid,sourceSha256,expectedSourceSha256:selected.sha256,sourceMatches:sourceSha256===selected.sha256};
 function emit(record){try{write(2,marker+serialize(record)+'\n');}catch{/* Observation failure does not change test/process outcome. */}}
 emit({...common,event:'START',wallTimeUnixMs:startWall,hrtimeNs:startNs.toString()});
 process.on('exit',code=>{
  try{const endNs=monoNow();emit({...common,event:'EXIT',wallTimeUnixMs:wallNow(),hrtimeNs:endNs.toString(),elapsedNs:(endNs-startNs).toString(),exitCode:code});}catch{/* Leave incomplete metadata; do not replace the original exit. */}
 });
}
try{observe();}catch{/* Fail passive: no diagnostic evidence, no change to unit status. */}
