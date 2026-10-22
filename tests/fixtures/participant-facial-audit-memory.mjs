// SQL/transaction semantics only. Business transitions remain in the candidate.
import assert from 'node:assert/strict';
const copy=value=>structuredClone(value);
const jsonb=value=>Array.isArray(value)?value.map(jsonb):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,jsonb(value[k])])):value;
export function createFakeAuditSql(){
 const db={rows:new Map(),workers:new Map(),locks:new Map(),at:Date.parse('2026-10-22T00:00:00.000Z'),statements:[],active:0,releases:0,onQuery:null,loseCommit:false};let nextId=0;
 function unlock(c){for(const key of c.held){const lock=db.locks.get(key),next=lock.wait.shift();if(next){lock.owner=next.c;next.c.held.add(key);next.resolve();}else db.locks.delete(key);}c.held.clear();}
 async function acquire(c,key){const old=db.locks.get(key);if(!old){db.locks.set(key,{owner:c,wait:[]});c.held.add(key);return;}if(old.owner!==c)await new Promise(resolve=>old.wait.push({c,resolve}));}
 db.connect=async()=>{const c={id:++nextId,tx:false,staged:new Map(),stagedWorkers:new Map(),held:new Set(),async query(sql,args=[]){db.statements.push({client:c.id,sql});await db.onQuery?.(sql,args,c);
  if(sql.startsWith('BEGIN')){assert.equal(c.tx,false);c.tx=true;db.active++;return{rows:[],rowCount:0};}
  if(sql==='COMMIT'||sql==='ROLLBACK'){if(c.tx){if(sql==='COMMIT'){for(const [k,v]of c.staged)db.rows.set(k,copy(v));for(const [k,v]of c.stagedWorkers)db.workers.set(k,copy(v));}c.staged.clear();c.stagedWorkers.clear();c.tx=false;db.active--;unlock(c);}if(sql==='COMMIT'&&db.loseCommit){db.loseCommit=false;throw Error('synthetic COMMIT acknowledgement lost');}return{rows:[],rowCount:0};}
  assert.equal(c.tx,true,'Every journal SQL query requires an explicit transaction');
  if(sql.startsWith('SET LOCAL '))return{rows:[],rowCount:0};
  if(sql==='SELECT clock_timestamp() AS now')return{rows:[{now:new Date(db.at)}],rowCount:1};
  if(sql.startsWith('SELECT pg_advisory_xact_lock')){await acquire(c,args[0]);return{rows:[],rowCount:1};}
  const all=()=>new Map([...db.rows,...c.staged]);
  if(sql.startsWith('SELECT id,"organizationId"')){
   if(sql.includes("metadata->>'pendingPairSha256'")){const rows=[...all().values()].filter(r=>r.organizationId===args[0]&&r.action==='participant.kyc.facial.attempt'&&r.metadata.pendingPairSha256===args[1]&&!['COMMITTED','REJECTED'].includes(r.metadata.state)).sort((a,b)=>a.id.localeCompare(b.id)).slice(0,16);return{rows:copy(rows),rowCount:rows.length};}
   const row=all().get(args[0]),wanted=sql.includes("action='participant.operation.recorded'")?'participant.operation.recorded':'participant.kyc.facial.attempt',found=row&&row.organizationId===args[1]&&row.action===wanted&&(args.length<3||row.actorId===args[2])?[copy(row)]:[];return{rows:found,rowCount:found.length};
  }
  if(sql.startsWith('SELECT metadata FROM public."Worker"')){const row=c.stagedWorkers.get(args[0])||db.workers.get(args[0]);return{rows:row&&row.projectId===args[1]?[copy(row)]:[],rowCount:row?1:0};}
  if(sql.startsWith('UPDATE public."Worker"')){const old=c.stagedWorkers.get(args[0])||db.workers.get(args[0]);assert.ok(old);c.stagedWorkers.set(args[0],{...old,metadata:JSON.parse(args[2])});return{rows:[],rowCount:1};}
  if(sql.startsWith('INSERT INTO public."AuditLog"')){const r={id:args[0],organizationId:args[1],actorId:args[2],action:args[3],entityType:'Worker',entityId:args[4],metadata:jsonb(JSON.parse(args[5]))};assert.equal(all().has(r.id),false,'AuditLog primary key conflict');c.staged.set(r.id,r);return{rows:[],rowCount:1};}
  if(sql.startsWith('UPDATE public."AuditLog" SET metadata=')){const row=all().get(args[0]);if(!row||args[2]!==undefined&&db.at>=Date.parse(args[2]))return{rows:[],rowCount:0};c.staged.set(row.id,{...copy(row),metadata:jsonb(JSON.parse(args[1]))});return{rows:[{id:row.id}],rowCount:1};}
  assert.fail('Unexpected synthetic SQL shape');
 },release(){assert.equal(c.tx,false);db.releases++;}};return c;};
 return db;
}
