import {lstatSync, realpathSync, rmSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as wait} from 'node:timers/promises';

const workspacePath = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const filesystemDefault = Object.freeze({lstatSync, realpathSync, rmSync});
const captures = new WeakMap();
const maximumAttempts = 3, retryDelayMs = 100;

function guard(condition, message) {
  if (!condition) throw Object.assign(new Error(message), {code:'OWNED_FIXTURE_GUARD_REJECTED'});
}
function absolute(value) {
  return typeof value === 'string' && path.isAbsolute(value) && path.resolve(value) === value;
}
function identity(stat) {
  const integer = value => typeof value === 'bigint' || Number.isSafeInteger(value);
  guard(integer(stat.dev) && integer(stat.ino), 'Directory identity is unavailable');
  return {dev:String(stat.dev), ino:String(stat.ino)};
}
function directory(filesystem, filename) {
  const stat = filesystem.lstatSync(filename, {bigint:true});
  guard(!stat.isSymbolicLink() && stat.isDirectory(), 'Owned cleanup path must be a non-symlink directory');
  guard(filesystem.realpathSync(filename) === filename, 'Owned cleanup path resolved to a different location');
  return identity(stat);
}
function validateParents(capture) {
  for (const parent of capture.parents) {
    const current = directory(capture.filesystem, parent.path);
    guard(current.dev === parent.dev && current.ino === parent.ino, 'Owned cleanup parent identity changed');
  }
}
function validateTarget(capture) {
  const {fixture, privateRoot, prefix, basename, nonce} = capture.descriptor;
  guard(absolute(fixture) && path.dirname(fixture) === privateRoot &&
    path.basename(fixture) === basename && basename === prefix + nonce &&
    /^[A-Za-z0-9]{6}$/.test(nonce), 'Owned fixture path or creation nonce changed');
  let stat;
  try { stat = capture.filesystem.lstatSync(fixture, {bigint:true}); }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
  guard(!stat.isSymbolicLink() && stat.isDirectory(), 'Owned fixture must remain a non-symlink directory');
  guard(capture.filesystem.realpathSync(fixture) === fixture, 'Owned fixture resolved to a different location');
  // Re-creation after rm can change the fixture inode. Its exact path, nonce
  // and pinned parents remain authoritative; another path is never substituted.
  return true;
}
function proof(attempts, absent = false) {
  return Object.freeze({fixtureRemoved:absent,
    attempts:Object.freeze(attempts.map(attempt => Object.freeze({...attempt}))),
    postcondition:Object.freeze({absent})});
}
function failureWithProof(error, attempts) {
  const failure = error instanceof Error && Object.isExtensible(error) && !Object.hasOwn(error, 'cleanupProof') ? error
    : new Error(error?.message || 'Owned fixture cleanup failed', {cause:error});
  if (failure !== error && typeof error?.code === 'string') failure.code = error.code;
  Object.defineProperty(failure, 'cleanupProof', {value:proof(attempts), enumerable:true});
  return failure;
}

// Capture immediately after mkdtemp and before any process starts. The opaque
// descriptor cannot be recreated, redirected or modified by cleanup callers.
export function captureOwnedFixture({workspaceRoot, privateRoot, fixture, prefix}, {filesystem = filesystemDefault} = {}) {
  guard(absolute(workspaceRoot) && workspaceRoot === workspacePath, 'Cleanup workspace must be this repository');
  guard(absolute(privateRoot) && privateRoot === path.join(workspaceRoot, '.vercel', 'private'), 'Cleanup root must be the exact workspace private directory');
  guard(absolute(fixture) && path.dirname(fixture) === privateRoot, 'Fixture must be an immediate child of the private root');
  guard(typeof prefix === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,119}-$/.test(prefix), 'Fixture prefix is invalid');
  const basename = path.basename(fixture), nonce = basename.slice(prefix.length);
  guard(basename === prefix + nonce && /^[A-Za-z0-9]{6}$/.test(nonce), 'Fixture must retain its exact mkdtemp nonce');
  guard(filesystem && ['lstatSync', 'realpathSync', 'rmSync'].every(name => typeof filesystem[name] === 'function'), 'Explicit cleanup filesystem is invalid');
  const io = Object.freeze(Object.fromEntries(['lstatSync', 'realpathSync', 'rmSync'].map(name => [name, filesystem[name].bind(filesystem)])));
  const descriptor = Object.freeze({version:1, workspaceRoot, privateRoot, fixture, prefix, basename, nonce});
  const parents = [workspaceRoot, path.join(workspaceRoot, '.vercel'), privateRoot].map(filename => ({path:filename, ...directory(io, filename)}));
  const capture = {descriptor, parents, filesystem:io};
  guard(validateTarget(capture), 'Fixture must exist when its ownership is captured');
  captures.set(descriptor, capture);
  return descriptor;
}

// Only a surviving directory after a successful rm is retried. Filesystem,
// ownership and delay errors retain their failure; no process/PID is inspected.
export async function removeOwnedFixture(descriptor, {serverClosedBeforeFixtureRemoval, delay = wait} = {}) {
  const attempts = [];
  try {
    const capture = captures.get(descriptor);
    guard(capture && serverClosedBeforeFixtureRemoval === true, 'An owned capture and completed server close are required');
    guard(typeof delay === 'function', 'Cleanup delay must be a function');
    for (let number = 1; number <= maximumAttempts; number++) {
      const attempt = {attempt:number, phase:'GUARD', removalAttempted:false, rmCompleted:false, postcondition:'UNOBSERVED', retryScheduled:false};
      attempts.push(attempt);
      validateParents(capture);
      if (!validateTarget(capture)) { attempt.postcondition = 'ABSENT'; return proof(attempts, true); }
      attempt.phase = 'REMOVE'; attempt.removalAttempted = true;
      capture.filesystem.rmSync(capture.descriptor.fixture, {recursive:true, force:false});
      attempt.rmCompleted = true; attempt.phase = 'POSTCONDITION';
      validateParents(capture);
      if (!validateTarget(capture)) { attempt.postcondition = 'ABSENT'; return proof(attempts, true); }
      attempt.postcondition = 'PRESENT';
      if (number === maximumAttempts) throw Object.assign(new Error('Owned fixture remains after three guarded removals'), {code:'OWNED_FIXTURE_RESIDUAL'});
      attempt.phase = 'DELAY'; attempt.retryScheduled = true;
      await delay(retryDelayMs);
    }
  } catch (error) { throw failureWithProof(error, attempts); }
}
