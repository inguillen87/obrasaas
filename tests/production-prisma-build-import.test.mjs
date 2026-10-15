import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const moduleUrl = new URL('../src/lib/prisma.js', import.meta.url).href;
const disconnectedUrl = 'postgresql://fixture:fixture@127.0.0.1:9/disabled';

function importInFreshProcess({ connectionString = '', alternate = false, development = false } = {}) {
  const source = `
    import assert from 'node:assert/strict';
    import { Socket } from 'node:net';
    let connectionAttempts = 0;
    Socket.prototype.connect = function () {
      connectionAttempts++;
      throw new Error('Database import must not open a socket');
    };
    const first = await import(${JSON.stringify(moduleUrl)});
    assert.equal(typeof first.syncStateToRelationalDb, 'function');
    if (${Boolean(connectionString)}) {
      assert.equal(typeof first.prisma.$disconnect, 'function');
      if (${development}) {
        const second = await import(${JSON.stringify(moduleUrl + '?fresh-module')});
        assert.equal(second.prisma, first.prisma);
      }
      await first.prisma.$disconnect();
    } else {
      assert.equal(first.prisma, null);
    }
    assert.equal(connectionAttempts, 0);
  `;
  return spawnSync(process.execPath, ['--input-type=module', '-e', source], {
    env: {
      ...process.env,
      DATABASE_URL: alternate ? '' : connectionString,
      POSTGRES_PRISMA_URL: alternate ? connectionString : '',
      POSTGRES_URL: '',
      NODE_ENV: development ? 'development' : 'production',
    },
    encoding: 'utf8',
    timeout: 15000,
    maxBuffer: 1024 * 1024,
  });
}

for (const [name, options] of [
  ['a build without a database', {}],
  ['a configured primary URL', { connectionString: disconnectedUrl }],
  ['the alternate Prisma URL', { connectionString: disconnectedUrl, alternate: true }],
  ['development module reloads', { connectionString: disconnectedUrl, development: true }],
]) {
  test('Prisma import supports ' + name + ' without network access', () => {
    const result = importInFreshProcess(options);
    assert.ifError(result.error);
    assert.equal(result.signal, null);
    assert.equal(result.status, 0, result.stderr);
  });
}
