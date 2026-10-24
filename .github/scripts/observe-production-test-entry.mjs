import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

// Observe native process-isolated test entries; never replace node:test or its exit.
const context = process.env.NODE_TEST_CONTEXT;
const output = process.env.BOUNDARY_UNIT_OUTPUT;
const error = code => {
  try {
    writeFileSync(path.join(output, `observer-error-${process.pid}.json`), JSON.stringify({ code }) + '\n', { flag: 'wx' });
  } catch { /* Missing evidence is rejected separately; preserve the native exit. */ }
};

if (context !== undefined) {
  try {
    if (context !== 'child-v8') throw new Error('OBSERVER_PROTOCOL');
    if (!/^v24\.\d+\.\d+$/.test(process.version)) throw new Error('OBSERVER_NODE');
    const manifest = JSON.parse(readFileSync(path.join(output, 'manifest.json'), 'utf8'));
    if (manifest.nodeVersion !== process.version) throw new Error('OBSERVER_NODE');
    const entry = typeof process.argv[1] === 'string'
      ? path.relative(process.cwd(), path.resolve(process.argv[1])).replaceAll('\\', '/')
      : '';
    if (!entry || entry.startsWith('../') || path.isAbsolute(entry)) throw new Error('OBSERVER_ENTRY');
    const expected = manifest.files.find(file => file.entry === entry);
    if (!expected) throw new Error('OBSERVER_ENTRY');
    const sourceSha256 = createHash('sha256').update(readFileSync(entry)).digest('hex');
    if (sourceSha256 !== expected.sourceSha256) throw new Error('OBSERVER_SOURCE');
    const startedAt = new Date().toISOString();
    const receipt = { entry, pid: process.pid, sourceSha256, startedAt, exitCode: null };
    const entryId = createHash('sha256').update(entry).digest('hex');
    const prefix = path.join(output, 'entries', `entry-${process.pid}-${entryId}`);
    writeFileSync(prefix + '.start.json', JSON.stringify(receipt) + '\n', { flag: 'wx' });
    process.on('exit', exitCode => {
      try {
        const finalSha256 = createHash('sha256').update(readFileSync(entry)).digest('hex');
        writeFileSync(prefix + '.exit.json', JSON.stringify({ ...receipt, sourceSha256: finalSha256, exitCode }) + '\n', { flag: 'wx' });
      } catch { error('OBSERVER_EXIT'); }
    });
  } catch (cause) {
    const code = typeof cause?.message === 'string' && /^OBSERVER_[A-Z]+$/.test(cause.message)
      ? cause.message : 'OBSERVER_IO';
    error(code);
  }
}
