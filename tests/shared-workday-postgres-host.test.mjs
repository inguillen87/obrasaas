import assert from 'node:assert/strict';
import test from 'node:test';
import { expectedDatabaseHosts } from '../scripts/lib/shared-workday-scenario.mjs';

const url = new URL('postgresql://cutover_test@127.0.0.1:6549/obrasaas_cutover_ci');
const serviceId = 'a'.repeat(64);
const network = 'github_network_' + 'b'.repeat(32);
const context = {
  GITHUB_ACTIONS: 'true',
  GITHUB_JOB: 'workday',
  GITHUB_WORKFLOW: 'Shared construction workday',
  WORKDAY_POSTGRES_SERVICE_ID: serviceId,
  WORKDAY_POSTGRES_NETWORK: network
};
const boundPort = [{ HostIp: '127.0.0.1', HostPort: '6549' }];
const inspection = (networks, binding = boundPort) =>
  JSON.stringify(networks) + '\n' + JSON.stringify({ '5432/tcp': binding }) + '\n';

test('only the address of the inspected job service is accepted behind the loopback port', () => {
  const hosts = expectedDatabaseHosts(url, context, (command, args) => {
    assert.equal(command, '/usr/bin/docker');
    assert.deepEqual(args.slice(0, 4), ['--host=unix:///var/run/docker.sock', 'inspect', '--type=container', '--format']);
    assert.equal(args.at(-1), serviceId);
    return inspection({ [network]: { IPAddress: '172.18.0.2' }, other: { IPAddress: '172.18.0.3' } });
  });
  assert.deepEqual(hosts, ['172.18.0.2/32']);
});

test('missing context, a different binding or the wrong network fails closed', () => {
  for (const override of [{ GITHUB_JOB: 'other' }, { WORKDAY_POSTGRES_SERVICE_ID: undefined }, { WORKDAY_POSTGRES_NETWORK: 'bridge' }]) {
    assert.throws(() => expectedDatabaseHosts(url, { ...context, ...override }, () => { throw new Error('unexpected inspection'); }), { name: 'AssertionError' });
  }
  for (const observed of [
    inspection({ other: { IPAddress: '172.18.0.2' } }),
    inspection({ [network]: { IPAddress: 'invalid' } }),
    inspection({ [network]: { IPAddress: '172.18.0.2' } }, [{ HostIp: '0.0.0.0', HostPort: '6549' }]),
    inspection({ [network]: { IPAddress: '172.18.0.2' } }, [{ HostIp: '127.0.0.1', HostPort: '5432' }])
  ]) assert.throws(() => expectedDatabaseHosts(url, context, () => observed), { name: 'AssertionError' });
});

test('local runs retain the native PostgreSQL loopback requirement', () => {
  assert.deepEqual(expectedDatabaseHosts(url, {}, () => assert.fail('unexpected inspection')), ['127.0.0.1/32', '::1/128']);
});
