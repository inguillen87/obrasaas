import fs from 'node:fs';import path from 'node:path';
// Diagnostic only: no source reader, test, exit-status or approval monkeypatch.
const root=process.cwd(),argument=process.argv[1];
if(typeof argument==='string'){
 let phase='membership';
 try{
  const actual=path.resolve(root,argument),relative=path.relative(root,actual).split(path.sep).join('/');
  if(relative.startsWith('tests/')&&!relative.includes('../')){
   const directory=path.join(root,'.vercel/unit4-probe'),manifest=JSON.parse(fs.readFileSync(path.join(directory,'selection.json'),'utf8'));
   const allowed=manifest.version===1&&Array.isArray(manifest.paths)&&manifest.paths.length===22&&new Set(manifest.paths).size===22&&manifest.paths.every(file=>typeof file==='string'&&file.startsWith('tests/')&&!file.includes('\\')&&!file.includes('../')&&path.posix.normalize(file)===file);
   if(allowed&&manifest.paths.includes(relative)){
    const trace=path.join(directory,'lifecycle.original.jsonl'),start=process.hrtime.bigint(),base={version:1,pid:process.pid,ppid:process.ppid,file:relative};
    const append=value=>fs.appendFileSync(trace,JSON.stringify(value)+'\n',{encoding:'utf8',flag:'a'});
    phase='start';append({...base,event:'START',at:new Date().toISOString(),elapsedMs:0});
    process.once('exit',exitCode=>{try{append({...base,event:'EXIT',at:new Date().toISOString(),elapsedMs:Number(process.hrtime.bigint()-start)/1e6,exitCode})}catch{process.stderr.write(JSON.stringify({event:'UNIT4_PROBE_WRITE_FAILED',phase:'exit',pid:process.pid,file:relative})+'\n')}});
   }
  }
 }catch{process.stderr.write(JSON.stringify({event:'UNIT4_PROBE_WRITE_FAILED',phase,pid:process.pid})+'\n')}
}
