import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {EventEmitter} from 'node:events';
import {runInNewContext} from 'node:vm';
import path from 'node:path';
import {parse} from '@babel/parser';

// UNIT source/IPC controls only. In-memory children never run project oracles,
// access Git/PG/providers, issue real phase receipts or terminate real processes.
const source=readFileSync(new URL('../.github/scripts/verify-workspace-ci-parallelization.mjs',import.meta.url),'utf8').replaceAll('\r\n','\n');
const ast=parse(source,{sourceType:'module'});
const hash=value=>createHash('sha256').update(value).digest('hex');
function declaration(name){
 const rows=ast.program.body.map(node=>node.type==='ExportNamedDeclaration'?node.declaration:node).filter(Boolean);
 const match=rows.filter(node=>node.type==='FunctionDeclaration'&&node.id.name===name);
 assert.equal(match.length,1,'Exactly one actual function '+name);
 return source.slice(match[0].start,match[0].end);
}
function variable(name){
 const rows=ast.program.body.filter(node=>node.type==='VariableDeclaration').flatMap(node=>node.declarations).filter(node=>node.id.type==='Identifier'&&node.id.name===name);
 assert.equal(rows.length,1);return 'const '+name+'='+source.slice(rows[0].init.start,rows[0].init.end)+';';
}
const originalSerialHash='c755169b50bbfdfb2f9603735a3f7205d4645055af628b366a090c9c52d92c39',originalWorkerBHash='e407062a33b136bb6d0a96291e170dc623b7db2ab98c0cd5c8afd7866a9713a7';
const phaseHashes={F0:'3507897acb2ffc3cc625c6accd9181116ac0ccf943b10b401a2f2821d9544a1d',F1:'58cf05b1d9a94fc70e76471fa1498a50d56fb9707ec8ddf7e5f97680c0ed3b3a',F3:'e26474c0a195e7c7e97fcc674fe83420b3d71298e7bee044c5a10ec172d269ef'};
const expectedPhases={A:['F0','F3'],B:['F2'],C:['F1']};
const phaseRows={F0:[{name:'unit-F0-a',result:'PASS'},{name:'unit-F0-b',result:'PASS'}],F1:[{name:'unit-F1-a',result:'PASS'},{name:'unit-F1-negative',result:'PASS',expectedDenial:'UNIT_REJECTION'}],F2:[{name:'unit-F2',result:'PASS'}],F3:[{name:'unit-F3',result:'PASS'}]};
const canonicalRows=()=>['F0','F1','F2','F3'].flatMap(phase=>phaseRows[phase]);

function fixture(mode='success'){
 const children=[],writes=new Map(),events=[],sourceFences={before:0,after:0};
 const fakeProcess=new EventEmitter();fakeProcess.pid=12000;fakeProcess.env={};
 const context={session:'11111111-1111-4111-8111-111111111111',parentPid:12000,sourceHead:'a'.repeat(40),workflowPath:'.github/workflows/workspace-acceptance.yml',contractPath:'.github/workspace-acceptance-contract.json',run:{runId:null,runAttempt:null}};
 const contextSha256='c'.repeat(64),root=path.resolve('synthetic-owned-workspace');
 let realm;
 const sandbox={Buffer,createHash,path,process:fakeProcess,setTimeout,clearTimeout,fileURLToPath:()=>path.join(root,'.github/scripts/verify-workspace-ci-parallelization.mjs'),randomUUID:()=>context.session,
  snapshotSelftestPhysicalSource:(_root,_head,execution)=>{sourceFences.before++;assert.equal(_root,root);assert.equal(_head,context.sourceHead);assert.equal(execution.session,context.session);return{root,context,contextSha256};},
  verifySelftestPhysicalSourceFinal:()=>{sourceFences.after++;if(mode==='dirty-final')throw Object.assign(new Error('changed'),{code:'SELFTEST_SOURCE_CHANGED'});return contextSha256;},
  mkdirSync:()=>{},realpathSync:value=>value,mkdtempSync:value=>value+'owned-unit',
  writeFileSync:(filename,bytes,options)=>{assert.equal(options.flag,'wx');assert.equal(writes.has(filename),false);writes.set(filename,Buffer.from(bytes));},
  fork:(_filename,args,options)=>{
   const worker=args[args.indexOf('--worker')+1];
   assert.deepEqual([...options.execArgv],[]);assert.equal(options.env.NODE_OPTIONS,'');assert.equal(options.env.NODE_PATH,'');
   assert.equal(options.detached,false);assert.equal(options.windowsHide,true);
   if(mode==='fork-C'&&worker==='C')throw new Error('unit fork C failure');
   assert.equal(children.some(child=>child.worker===worker),false);assert.ok(children.length<3);
   const child=new EventEmitter();Object.assign(child,{worker,pid:12001+children.length,stdout:new EventEmitter(),stderr:new EventEmitter(),closed:false,killSignals:[]});children.push(child);
   const base={version:1,worker,session:context.session,contextSha256,pid:child.pid,parentPid:context.parentPid};
   const packet=value=>{if(!child.closed)child.emit('message',realm(JSON.stringify({...base,...value})));};
   const close=(code,signal=null)=>{if(child.closed)return;child.closed=true;child.emit('disconnect');child.emit('close',code,signal);};
   child.kill=signal=>{child.killSignals.push(signal);queueMicrotask(()=>close(null,signal));return true;};
   child.send=(control,callback)=>{
    queueMicrotask(()=>callback(null));
    if(control.kind==='finish'){queueMicrotask(()=>close(child.failure?1:0));return true;}
    assert.equal(control.kind,'start');events.push('start-'+worker);
    if(mode==='stall-C'&&worker==='C')return true;
    queueMicrotask(()=>{
     if(child.closed)return;
     child.stdout.emit('data',Buffer.from('stdout-'+worker));child.stderr.emit('data',Buffer.from('stderr-'+worker));
     if(mode==='fail-C'&&worker==='C'){
      child.failure=true;packet({kind:'failure',scope:'oracle',phase:'F1',statement:12,error:{code:'UNIT_C_PHASE_FAILURE',operator:null,frames:[]},sourceFinalSha256:contextSha256});return;
     }
     const own=[];
     for(const phase of expectedPhases[worker]){
      const rows=phaseRows[phase];
      packet({kind:'progress',phase,statement:{F0:4,F1:12,F2:136,F3:153}[phase],stage:'start',elapsedNs:'1'});
      packet({kind:'receipt',phase,count:rows.length,rowsSha256:mode==='tamper-C'&&worker==='C'?'f'.repeat(64):hash(JSON.stringify(rows))});
      packet({kind:'rows',phase,chunk:0,rows});own.push(...rows);
     }
     packet({kind:'done',phases:expectedPhases[worker],count:own.length,rowsSha256:hash(JSON.stringify(own)),sourceFinalSha256:contextSha256});
    });return true;
   };
   queueMicrotask(()=>packet({kind:'ready'}));return child;
  }
 };
 const parent=declaration('runParallelSelftest');
 assert.equal(parent.split('fileURLToPath(import.meta.url)').length-1,1);
 const transportedParent=parent.replace('fileURLToPath(import.meta.url)',"fileURLToPath('unit-source-only-target')");
 const program=variable('SELFTEST_WORKER_PROTOCOL')+'\n'+declaration('validateSelftestWorkerPacket')+'\n'+declaration('mergeSelftestWorkerChecks')+'\n'+transportedParent+`\n({
 protocol:JSON.parse(JSON.stringify(SELFTEST_WORKER_PROTOCOL)),
 realm:text=>JSON.parse(text),
 validate:text=>JSON.stringify(validateSelftestWorkerPacket(...JSON.parse(text))),
 merge:records=>JSON.stringify(mergeSelftestWorkerChecks(records)),
 run:options=>runParallelSelftest(${JSON.stringify(root)},options)
})`;
 const api=runInNewContext(program,sandbox);realm=api.realm;
 // Bound only the in-memory transport harness. The authentic default remains70min.
 return{api,children,writes,events,sourceFences,context,contextSha256,run:timeoutMs=>api.run({expectedHead:context.sourceHead,workflowFile:context.workflowPath,contractFile:context.contractPath,timeoutMs:timeoutMs??500})};
}
function records(){return Object.entries(expectedPhases).map(([worker,phases])=>{
 const own=phases.flatMap(phase=>phaseRows[phase]);
 return{worker,ready:true,closed:true,disconnected:true,code:0,signal:null,executionError:null,phases:new Map(phases.map(phase=>[phase,{rows:structuredClone(phaseRows[phase]),receipt:{count:phaseRows[phase].length,rowsSha256:hash(JSON.stringify(phaseRows[phase]))}}])),terminal:{kind:'done',count:own.length,rowsSha256:hash(JSON.stringify(own))}};
});}
const denied=(run,code)=>assert.throws(run,error=>error.code===code);

test('serial reference and complete B deferred oracle retain their exact original canonical LF source',()=>{
 assert.equal(hash(declaration('selftest')),originalSerialHash);assert.equal(hash(declaration('selftestWorkerB')),originalWorkerBHash);
});
test('F0 F1 and F3 preserve every original canonical LF statement and phase-segment byte',()=>{
 const a=declaration('selftestWorkerA'),c=declaration('selftestWorkerC');
 const bodies={F0:a.slice(a.indexOf('tracker.mark("F0",4);'),a.indexOf('tracker.mark("F3",153);')),F1:c.slice(c.indexOf('tracker.mark("F1",12);'),c.lastIndexOf('return checks;')),F3:a.slice(a.indexOf('tracker.mark("F3",153);'),a.lastIndexOf('return checks;'))};
 for(const phase of ['F0','F1','F3'])assert.equal(hash(bodies[phase]),phaseHashes[phase]);
 assert.equal(c.includes("const shadowSource=file=>Buffer.from(utf8(readFileSync(path.join(root,sourcePath(file)))).replaceAll('\\r\\n','\\n'));"),true);
 assert.equal(c.includes('const historicalContractForNegativeFixtures=restoreParticipantPreanalysisPreviousContract(contract);'),true);
});
test('fixed three-worker topology preserves four canonical phases statement bounds and all transport budgets',()=>{
 const {protocol:p}=fixture().api;assert.equal(JSON.stringify(p.workers),JSON.stringify(expectedPhases));assert.equal(JSON.stringify(p.phases),JSON.stringify(['F0','F1','F2','F3']));
 assert.equal(JSON.stringify(p.statements),JSON.stringify({F0:[4,11],F1:[12,135],F2:[136,152],F3:[153,159]}));
 assert.equal(p.defaultBudgetMs,70*60*1000);assert.equal(p.maxBudgetMs,74*60*1000);assert.equal(p.startMs,30000);assert.equal(p.finishMs,30000);assert.equal(p.chunkRows,64);assert.equal(p.packetBytes,1024*1024);assert.equal(p.stdioBytes,8*1024*1024);
});
test('merge orders completed workers canonically with all rows and denial labels intact',()=>{
 const {api}=fixture();const rows=records();assert.equal(api.merge([rows[2],rows[1],rows[0]]),JSON.stringify(canonicalRows()));
});
test('missing or duplicate third worker cannot produce merged checks',()=>{
 const {api}=fixture();const rows=records();denied(()=>api.merge(rows.slice(0,2)),'SELFTEST_WORKERS_INCOMPLETE');denied(()=>api.merge([rows[0],rows[1],rows[1]]),'SELFTEST_WORKERS_DUPLICATE');
});
test('each phase and worker terminal must retain exact count digest successful close and disconnect',()=>{
 const {api}=fixture();
 for(const edit of [r=>{r[2].code=1;},r=>{r[2].disconnected=false;},r=>{r[2].signal='SIGTERM';},r=>{r[2].executionError={code:'UNIT'};}]){const r=records();edit(r);denied(()=>api.merge(r),'SELFTEST_WORKER_NOT_SUCCESS');}
 for(const edit of [r=>{r[2].phases.delete('F1');},r=>{r[2].phases.set('F0',r[0].phases.get('F0'));}]){const r=records();edit(r);denied(()=>api.merge(r),'SELFTEST_PHASE_MISSING');}
 for(const edit of [r=>{r[2].phases.get('F1').receipt.rowsSha256='f'.repeat(64);},r=>{r[2].phases.get('F1').receipt.count++;}]){const r=records();edit(r);denied(()=>api.merge(r),'SELFTEST_PHASE_INTEGRITY');}
 for(const edit of [r=>{r[2].terminal.count++;},r=>{r[2].terminal.rowsSha256='f'.repeat(64);}]){const r=records();edit(r);denied(()=>api.merge(r),'SELFTEST_EXECUTION_RECEIPT');}
});
test('C packet binding rejects foreign PID session and F0 or F2 payloads',()=>{
 const {api,context,contextSha256}=fixture(),binding={worker:'C',pid:12003,context,contextSha256},base={version:1,kind:'ready',worker:'C',session:context.session,contextSha256,pid:12003,parentPid:12000};
 const validate=packet=>api.validate(JSON.stringify([packet,binding]));assert.equal(validate(base),JSON.stringify(base));
 for(const edit of [p=>{p.pid++;},p=>{p.parentPid++;},p=>{p.worker='A';},p=>{p.session='22222222-2222-4222-8222-222222222222';},p=>{p.contextSha256='f'.repeat(64); }]){const p=structuredClone(base);edit(p);denied(()=>validate(p),'SELFTEST_IPC_FOREIGN');}
 for(const phase of ['F0','F2','F3'])denied(()=>validate({...base,kind:'receipt',phase,count:1,rowsSha256:'d'.repeat(64)}),'SELFTEST_IPC_RECEIPT');
 denied(()=>validate({...base,kind:'done',phases:['F1','F3'],count:1,rowsSha256:'d'.repeat(64),sourceFinalSha256:contextSha256}),'SELFTEST_IPC_DONE');
});
test('actual parent orchestration starts exactly three owned children and returns exact canonical rows',async()=>{
 const f=fixture();const rows=await f.run();assert.equal(JSON.stringify(rows),JSON.stringify(canonicalRows()));assert.deepEqual(f.events,['start-A','start-B','start-C']);
 assert.equal(f.children.length,3);assert.ok(f.children.every(child=>child.closed&&child.killSignals.length===0));assert.deepEqual(f.sourceFences,{before:1,after:1});
 for(const worker of ['A','B','C'])for(const stream of ['stdout','stderr']){const matches=[...f.writes].filter(([name])=>name.endsWith(worker+'.'+stream+'.log'));assert.equal(matches.length,1);assert.equal(matches[0][1].toString(),stream+'-'+worker);}
 const result=JSON.parse([...f.writes].find(([name])=>name.endsWith('execution.json'))[1]);assert.equal(result.workers.length,3);assert.deepEqual(result.workers.map(row=>row.worker),['A','B','C']);assert.ok(result.workers.every(row=>row.terminal.kind==='done'&&row.code===0));
});
test('a C oracle failure is durable and cannot become an A B success',async()=>{
 const f=fixture('fail-C');await assert.rejects(f.run(),error=>error.code==='UNIT_C_PHASE_FAILURE'&&error.worker==='C'&&error.phase==='F1');assert.equal(f.sourceFences.after,1);
 const receipt=JSON.parse([...f.writes].find(([name])=>name.endsWith('execution.json'))[1]);assert.equal(receipt.workers.find(row=>row.worker==='C').terminal.kind,'failure');assert.ok(f.children.every(child=>child.closed));
});
test('a missing C startup preserves failure and closes only the owned synthetic handles',async()=>{
 const f=fixture('fork-C');await assert.rejects(f.run(),error=>error.code==='SELFTEST_FORK_FAILED');assert.equal(f.children.length,2);assert.ok(f.children.every(child=>child.closed&&child.killSignals[0]==='SIGTERM'));assert.equal(f.sourceFences.after,1);
});
test('a stalled C is rejected under the existing minimum unit deadline without dropping its phase',async()=>{
 const f=fixture('stall-C');await assert.rejects(f.run(50),error=>error.code==='SELFTEST_TIMEOUT');assert.equal(f.children.length,3);assert.ok(f.children.every(child=>child.closed));assert.deepEqual(f.children.find(child=>child.worker==='C').killSignals,['SIGTERM']);assert.equal(f.sourceFences.after,1);
});
test('tampered C row digest stops all owned work and retains a failed execution record',async()=>{
 const f=fixture('tamper-C');await assert.rejects(f.run(),error=>error.code==='SELFTEST_IPC_ROWS_DIGEST');assert.ok(f.children.every(child=>child.closed));assert.equal(f.sourceFences.after,1);assert.equal([...f.writes.keys()].filter(name=>name.endsWith('execution.json')).length,1);
});
test('final full source fence dominates successful synthetic phase terminals',async()=>{
 const f=fixture('dirty-final');await assert.rejects(f.run(),error=>error.code==='SELFTEST_SOURCE_CHANGED');const receipt=JSON.parse([...f.writes].find(([name])=>name.endsWith('execution.json'))[1]);assert.equal(receipt.sourceFinalFailure,'SELFTEST_SOURCE_CHANGED');assert.equal(receipt.workers.length,3);
});
