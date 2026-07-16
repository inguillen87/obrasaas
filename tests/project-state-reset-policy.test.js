import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { after, test } from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      const extension = specifier.startsWith('@/generated/') ? '.ts' : '.js';
      const sourcePath = new URL(`../src/${specifier.slice(2)}${extension}`, import.meta.url);
      return nextResolve(sourcePath.href, context);
    }
    return nextResolve(specifier, context);
  },
});

const originalDatabaseUrl = process.env.DATABASE_URL;
process.env.DATABASE_URL = 'postgresql://unit-test.invalid/obrasaas';

const { resetState } = await import('../src/lib/db.js');

after(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  delete globalThis.__obraSaasPrisma;
});

test('a stale active context cannot reset state after the project is completed', async () => {
  const calls = [];
  const project = {
    id: 'project-a',
    organizationId: 'organization-a',
    status: 'ACTIVE',
    organization: { id: 'organization-a' },
    whatsapp: null,
  };
  const transaction = {
    async $executeRawUnsafe(query, projectId) {
      calls.push(['lock', query, projectId]);
    },
    project: {
      async findFirst(args) {
        calls.push(['locked-project', args]);
        return { ...project, status: 'COMPLETED' };
      },
    },
    projectSnapshot: {
      async findUnique() {
        calls.push(['snapshot-read']);
        return { state: {}, version: 0, updatedAt: new Date() };
      },
      async upsert() {
        calls.push(['snapshot-write']);
        return null;
      },
    },
    conversation: {
      async upsert() {
        calls.push(['conversation']);
        return { id: 'conversation-a' };
      },
    },
    message: {
      async deleteMany() {
        calls.push(['message-delete']);
      },
      async createMany() {
        calls.push(['message-create']);
      },
    },
  };
  globalThis.__obraSaasPrisma = {
    project: {
      async findFirst(args) {
        calls.push(['stale-project', args]);
        return project;
      },
    },
    async $transaction(callback) {
      calls.push(['transaction']);
      return callback(transaction);
    },
  };

  await assert.rejects(
    resetState({
      organization: { id: project.organizationId },
      project: { id: project.id },
    }, { expectedVersion: 0 }),
    (error) => (
      error.code === 'PROJECT_READ_ONLY'
      && error.projectStatus === 'COMPLETED'
      && error.status === 409
    ),
  );
  assert.deepEqual(calls.map(([name]) => name), [
    'stale-project',
    'transaction',
    'lock',
    'locked-project',
  ]);
});
