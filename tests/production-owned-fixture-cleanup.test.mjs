import test from 'node:test';
import assert from 'node:assert/strict';
import {lstatSync, realpathSync, rmSync, mkdtempSync, mkdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {captureOwnedFixture, removeOwnedFixture} from '../scripts/lib/owned-fixture-cleanup.mjs';

const workspaceRoot = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const privateRoot = path.join(workspaceRoot, '.vercel', 'private');
const prefix = 'owned-cleanup-unit-fixture-';
const missing = () => Object.assign(new Error('Synthetic fixture absent'), {code:'ENOENT'});
const stats = (ino, kind = 'directory') => ({dev:1n, ino:BigInt(ino),
  isSymbolicLink:() => kind === 'symlink', isDirectory:() => kind === 'directory'});

function preparePrivateRoot(filesystem = {lstatSync, realpathSync, mkdirSync}) {
  const validate = (filename, stat) => {
    assert.ok(!stat.isSymbolicLink() && stat.isDirectory());
    assert.equal(filesystem.realpathSync(filename), filename);
  };
  validate(workspaceRoot, filesystem.lstatSync(workspaceRoot));
  for (const parent of [path.join(workspaceRoot, '.vercel'), privateRoot]) {
    let stat;
    try { stat = filesystem.lstatSync(parent); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      try { filesystem.mkdirSync(parent); }
      catch (creationError) { if (creationError.code !== 'EEXIST') throw creationError; }
      stat = filesystem.lstatSync(parent);
    }
    validate(parent, stat);
  }
}

function fixture() {
  const target = path.join(privateRoot, prefix + 'abc123');
  const nodes = new Map([[workspaceRoot,stats(1)], [path.join(workspaceRoot,'.vercel'),stats(2)], [privateRoot,stats(3)], [target,stats(4)]]);
  const controls = {afterRemove:null, removeError:null, lstatError:null, realpathError:null, resolvedPath:null, returnValue:undefined};
  const calls = {remove:[], delay:[]};
  const filesystem = {
    lstatSync(filename, options) {
      assert.deepEqual(options,{bigint:true});
      if (controls.lstatError?.path === filename) throw controls.lstatError.error;
      const stat = nodes.get(filename); if (!stat) throw missing(); return stat;
    },
    realpathSync(filename) {
      if (controls.realpathError?.path === filename) throw controls.realpathError.error;
      return controls.resolvedPath?.path === filename ? controls.resolvedPath.value : filename;
    },
    rmSync(filename, options) {
      assert.equal(filename,target); assert.deepEqual(options,{recursive:true,force:false});
      calls.remove.push({filename,options});
      if (controls.removeError) throw controls.removeError;
      nodes.delete(target); controls.afterRemove?.(calls.remove.length); return controls.returnValue;
    },
  };
  const descriptor = captureOwnedFixture({workspaceRoot,privateRoot,fixture:target,prefix},{filesystem});
  const delay = async milliseconds => {calls.delay.push(milliseconds);};
  const remove = (options={}) => removeOwnedFixture(descriptor,{serverClosedBeforeFixtureRemoval:true,delay,...options});
  return {target,nodes,controls,calls,filesystem,descriptor,delay,remove};
}
const rejectedGuard = error => error.code === 'OWNED_FIXTURE_GUARD_REJECTED' && error.cleanupProof?.fixtureRemoved === false;

test('one successful removal proves absence and returns immutable exact attempts',async()=>{
  const f=fixture(),value=await f.remove();
  assert.equal(value.fixtureRemoved,true); assert.deepEqual(value.postcondition,{absent:true});
  assert.equal(value.attempts.length,1); assert.equal(value.attempts[0].removalAttempted,true); assert.equal(value.attempts[0].rmCompleted,true); assert.equal(value.attempts[0].postcondition,'ABSENT');
  assert.equal(f.calls.remove.length,1); assert.deepEqual(f.calls.delay,[]);
  assert.ok(Object.isFrozen(value)&&Object.isFrozen(value.attempts)&&Object.isFrozen(value.attempts[0])&&Object.isFrozen(value.postcondition));
});
test('exact post-rm recreation with a new fixture inode receives one guarded retry',async()=>{
  const f=fixture();f.controls.afterRemove=number=>{if(number===1)f.nodes.set(f.target,stats(99));};
  const value=await f.remove();assert.equal(value.fixtureRemoved,true);assert.deepEqual(f.calls.delay,[100]);assert.equal(f.calls.remove.length,2);
  assert.deepEqual(value.attempts.map(row=>row.postcondition),['PRESENT','ABSENT']);assert.ok(f.calls.remove.every(row=>row.filename===f.target));
});
test('three successful rm calls with persistent residual never certify removal',async()=>{
  const f=fixture();f.controls.afterRemove=number=>f.nodes.set(f.target,stats(100+number));
  await assert.rejects(f.remove(),error=>{assert.equal(error.code,'OWNED_FIXTURE_RESIDUAL');assert.equal(error.cleanupProof.fixtureRemoved,false);assert.deepEqual(error.cleanupProof.postcondition,{absent:false});assert.equal(error.cleanupProof.attempts.length,3);assert.ok(error.cleanupProof.attempts.every(row=>row.rmCompleted&&row.postcondition==='PRESENT'));return true;});
  assert.equal(f.calls.remove.length,3);assert.deepEqual(f.calls.delay,[100,100]);assert.ok(f.nodes.has(f.target));
});
test('an arbitrary rm return value cannot replace the lstat postcondition',async()=>{
  const f=fixture();f.controls.returnValue={removed:true};f.controls.afterRemove=()=>f.nodes.set(f.target,stats(77));
  await assert.rejects(f.remove(),{code:'OWNED_FIXTURE_RESIDUAL'});assert.equal(f.calls.remove.length,3);
});
test('a previously removed fixture succeeds without another rm only after parent checks',async()=>{
  const f=fixture();f.nodes.delete(f.target);const value=await f.remove();
  assert.equal(value.fixtureRemoved,true);assert.equal(value.attempts[0].removalAttempted,false);assert.equal(f.calls.remove.length,0);
  const changed=fixture();changed.nodes.delete(changed.target);changed.nodes.set(privateRoot,stats(123));await assert.rejects(changed.remove(),rejectedGuard);assert.equal(changed.calls.remove.length,0);
});
for(const closed of [false,undefined,null,'true',1])test('server-close guard rejects '+String(closed)+' before any removal',async()=>{
  const f=fixture();await assert.rejects(f.remove({serverClosedBeforeFixtureRemoval:closed}),rejectedGuard);assert.equal(f.calls.remove.length,0);assert.deepEqual(f.calls.delay,[]);
});
for(const parent of [workspaceRoot,path.join(workspaceRoot,'.vercel'),privateRoot])test('changed identity at '+path.basename(parent)+' cannot redirect removal',async()=>{
  const f=fixture();f.nodes.set(parent,stats(88));await assert.rejects(f.remove(),rejectedGuard);assert.equal(f.calls.remove.length,0);
});
for(const parent of [workspaceRoot,path.join(workspaceRoot,'.vercel'),privateRoot])test('symlink parent '+path.basename(parent)+' is rejected even if its realpath appears unchanged',async()=>{
  const f=fixture();f.nodes.set(parent,stats(88,'symlink'));await assert.rejects(f.remove(),rejectedGuard);assert.equal(f.calls.remove.length,0);
});
for(const kind of ['symlink','file'])test('a '+kind+' substituted at the owned fixture is never removed',async()=>{
  const f=fixture();f.nodes.set(f.target,stats(4,kind));await assert.rejects(f.remove(),rejectedGuard);assert.equal(f.calls.remove.length,0);
});
for(const destination of [path.join(privateRoot,'other-target'),path.join(workspaceRoot,'outside-private'),path.dirname(workspaceRoot)])test('target realpath substitution cannot remove '+path.basename(destination),async()=>{
  const f=fixture();f.controls.resolvedPath={path:f.target,value:destination};await assert.rejects(f.remove(),rejectedGuard);assert.equal(f.calls.remove.length,0);
});
test('a parent realpath change is rejected before touching the fixture',async()=>{
  const f=fixture();f.controls.resolvedPath={path:privateRoot,value:path.join(workspaceRoot,'other-private')};await assert.rejects(f.remove(),rejectedGuard);assert.equal(f.calls.remove.length,0);
});
test('parent replacement after rm cannot certify an absent fixture',async()=>{
  const f=fixture();f.controls.afterRemove=()=>f.nodes.set(privateRoot,stats(99));
  await assert.rejects(f.remove(),rejectedGuard);assert.equal(f.calls.remove.length,1);assert.deepEqual(f.calls.delay,[]);
});
test('a recreated symlink after rm is a failure and is never retried',async()=>{
  const f=fixture();f.controls.afterRemove=()=>f.nodes.set(f.target,stats(99,'symlink'));
  await assert.rejects(f.remove(),rejectedGuard);assert.equal(f.calls.remove.length,1);assert.deepEqual(f.calls.delay,[]);
});
test('ownership is copied at capture and forged path/nonce descriptors cannot be used',async()=>{
  const f=fixture();assert.ok(Object.isFrozen(f.descriptor));assert.equal(f.descriptor.nonce,'abc123');
  for(const patch of [{fixture:path.join(privateRoot,prefix+'xyz789')},{nonce:'xyz789'},{privateRoot:path.dirname(privateRoot)},{basename:prefix+'xyz789'},{}]){
    await assert.rejects(removeOwnedFixture({...f.descriptor,...patch},{serverClosedBeforeFixtureRemoval:true,delay:f.delay}),rejectedGuard);
  }
  assert.equal(f.calls.remove.length,0);
});
test('capture rejects wrong workspace, outside, nested, nonabsolute and non-mkdtemp paths',()=>{
  const f=fixture(),valid={workspaceRoot,privateRoot,fixture:f.target,prefix};
  for(const patch of [{workspaceRoot:path.dirname(workspaceRoot)},{privateRoot:path.join(workspaceRoot,'other-private')},{fixture:path.join(workspaceRoot,prefix+'abc123')},{fixture:path.join(privateRoot,'nested',prefix+'abc123')},{fixture:prefix+'abc123'},{fixture:path.join(privateRoot,prefix+'bad')},{fixture:path.join(privateRoot,prefix+'abc123-extra')},{prefix:'different-prefix-'},{fixture:privateRoot+path.sep+'..'+path.sep+'private'+path.sep+prefix+'abc123'}]){
    assert.throws(()=>captureOwnedFixture({...valid,...patch},{filesystem:f.filesystem}),{code:'OWNED_FIXTURE_GUARD_REJECTED'});
  }
  assert.equal(f.calls.remove.length,0);
});
for(const code of ['EBUSY','ENOTEMPTY','EPERM','EACCES'])test('rm '+code+' stays a failure without retries or absence inference',async()=>{
  const f=fixture(),original=Object.assign(new Error('Synthetic removal '+code),{code});f.controls.removeError=original;
  await assert.rejects(f.remove(),error=>{assert.equal(error,original);assert.equal(error.cleanupProof.fixtureRemoved,false);assert.equal(error.cleanupProof.attempts[0].rmCompleted,false);return true;});
  assert.equal(f.calls.remove.length,1);assert.deepEqual(f.calls.delay,[]);assert.ok(f.nodes.has(f.target));
});
for(const code of ['EACCES','EPERM','ENOTDIR'])test('postcondition lstat '+code+' never means absent',async()=>{
  const f=fixture(),original=Object.assign(new Error('Synthetic lstat '+code),{code});f.controls.afterRemove=()=>{f.controls.lstatError={path:f.target,error:original};};
  await assert.rejects(f.remove(),error=>error===original&&error.cleanupProof.fixtureRemoved===false);assert.equal(f.calls.remove.length,1);assert.deepEqual(f.calls.delay,[]);
});
test('a realpath error is preserved and never retried',async()=>{
  const f=fixture(),original=Object.assign(new Error('Synthetic realpath failure'),{code:'EACCES'});f.controls.realpathError={path:privateRoot,error:original};
  await assert.rejects(f.remove(),error=>error===original);assert.equal(f.calls.remove.length,0);assert.deepEqual(f.calls.delay,[]);
});
test('sleep errors stop bounded retries and preserve the original failure',async()=>{
  const f=fixture(),original=new Error('Synthetic sleep failure');f.controls.afterRemove=()=>f.nodes.set(f.target,stats(99));
  await assert.rejects(f.remove({delay:async milliseconds=>{assert.equal(milliseconds,100);throw original;}}),error=>error===original&&error.cleanupProof.attempts[0].phase==='DELAY');
  assert.equal(f.calls.remove.length,1);assert.ok(f.nodes.has(f.target));
});
test('a parent changed during delay fails before the second rm',async()=>{
  const f=fixture();f.controls.afterRemove=()=>f.nodes.set(f.target,stats(99));
  await assert.rejects(f.remove({delay:async milliseconds=>{assert.equal(milliseconds,100);f.nodes.set(privateRoot,stats(88));}}),rejectedGuard);assert.equal(f.calls.remove.length,1);
});
test('an existing nonconfigurable cleanupProof cannot obscure the original error',async()=>{
  const f=fixture(),original=Object.assign(new Error('Original removal failure'),{code:'EPERM'});Object.defineProperty(original,'cleanupProof',{value:{old:true},configurable:false});f.controls.removeError=original;
  await assert.rejects(f.remove(),error=>{assert.notEqual(error,original);assert.equal(error.cause,original);assert.equal(error.message,original.message);assert.equal(error.code,'EPERM');assert.equal(error.cleanupProof.fixtureRemoved,false);assert.equal(error.cleanupProof.attempts.length,1);return true;});
  assert.equal(f.calls.remove.length,1);assert.deepEqual(f.calls.delay,[]);
});
test('clean-checkout setup creates and validates each exact parent without recursive mkdir',()=>{
  const nodes=new Map([[workspaceRoot,stats(1)]]),created=[],validated=[];
  const filesystem={
    lstatSync(filename){if(!nodes.has(filename))throw missing();return nodes.get(filename);},
    realpathSync(filename){validated.push(filename);return filename;},
    mkdirSync(filename,...options){
      assert.deepEqual(options,[]);
      assert.equal(filename,[path.join(workspaceRoot,'.vercel'),privateRoot][created.length]);
      if(filename===privateRoot)assert.ok(validated.includes(path.join(workspaceRoot,'.vercel')));
      created.push(filename);nodes.set(filename,stats(created.length+1));
    },
  };
  preparePrivateRoot(filesystem);
  assert.deepEqual(created,[path.join(workspaceRoot,'.vercel'),privateRoot]);
  assert.deepEqual(validated,[workspaceRoot,path.join(workspaceRoot,'.vercel'),privateRoot]);
  filesystem.mkdirSync=()=>assert.fail('Existing parents must not be created again');preparePrivateRoot(filesystem);
});

test('a concurrent EEXIST still requires canonical non-symlink directory validation',()=>{
  const nodes=new Map([[workspaceRoot,stats(1)]]),created=[],validated=[];
  const filesystem={
    lstatSync(filename){if(!nodes.has(filename))throw missing();return nodes.get(filename);},
    realpathSync(filename){validated.push(filename);return filename;},
    mkdirSync(filename,...options){
      assert.deepEqual(options,[]);created.push(filename);nodes.set(filename,stats(created.length+1));
      throw Object.assign(new Error('Synthetic concurrent mkdir'),{code:'EEXIST'});
    },
  };
  preparePrivateRoot(filesystem);
  assert.deepEqual(created,[path.join(workspaceRoot,'.vercel'),privateRoot]);
  assert.deepEqual(validated,[workspaceRoot,path.join(workspaceRoot,'.vercel'),privateRoot]);
});

for(const kind of ['symlink','file'])test('private-root setup rejects a '+kind+' parent before creating its child',()=>{
  const parent=path.join(workspaceRoot,'.vercel');
  for(const concurrent of [false,true]){
    const nodes=new Map([[workspaceRoot,stats(1)]]),created=[];
    if(!concurrent)nodes.set(parent,stats(2,kind));
    const filesystem={
      lstatSync(filename){if(!nodes.has(filename))throw missing();return nodes.get(filename);},
      realpathSync:filename=>filename,
      mkdirSync(filename){created.push(filename);nodes.set(filename,stats(2,kind));throw Object.assign(new Error('Synthetic concurrent invalid parent'),{code:'EEXIST'});},
    };
    assert.throws(()=>preparePrivateRoot(filesystem),{code:'ERR_ASSERTION'});
    assert.deepEqual(created,concurrent?[parent]:[]);assert.ok(!nodes.has(privateRoot));
  }
});

test('private-root setup does not treat inaccessible parents as absent',()=>{
  const original=Object.assign(new Error('Synthetic parent access denial'),{code:'EACCES'}),created=[];
  const filesystem={
    lstatSync:filename=>{if(filename===workspaceRoot)return stats(1);throw original;},
    realpathSync:filename=>filename,mkdirSync:filename=>created.push(filename),
  };
  assert.throws(()=>preparePrivateRoot(filesystem),error=>error===original);assert.deepEqual(created,[]);
});

test('real filesystem removal is confined to one captured mkdtemp under this repository private root',async()=>{
  preparePrivateRoot();
  const realFixture=mkdtempSync(path.join(privateRoot,prefix));
  assert.equal(path.dirname(realFixture),privateRoot);assert.ok(path.basename(realFixture).startsWith(prefix));
  const captured=captureOwnedFixture({workspaceRoot,privateRoot,fixture:realFixture,prefix},{filesystem:{lstatSync,realpathSync,rmSync}});
  try{
    mkdirSync(path.join(realFixture,'nested'));writeFileSync(path.join(realFixture,'nested','synthetic.txt'),'Synthetic fixture only');
    const value=await removeOwnedFixture(captured,{serverClosedBeforeFixtureRemoval:true});assert.equal(value.fixtureRemoved,true);assert.equal(value.attempts.length,1);
    assert.throws(()=>lstatSync(realFixture),{code:'ENOENT'});
  }finally{
    let remains=true;
    try{lstatSync(realFixture);}catch(error){if(error.code==='ENOENT')remains=false;else throw error;}
    if(remains)await removeOwnedFixture(captured,{serverClosedBeforeFixtureRemoval:true});
  }
});
