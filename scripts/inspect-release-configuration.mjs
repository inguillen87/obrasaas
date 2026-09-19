import { pathToFileURL } from 'node:url';
import { config } from 'dotenv';
import { databaseIdentityDigest, evaluateMigrationGate } from './vercel-build.mjs';
import { inspectProductionPrerequisites } from './lib/production-configuration-check.mjs';

const CONNECTION_KEYS = ['DIRECT_URL', 'DATABASE_URL_UNPOOLED', 'DATABASE_URL'];
const HEX = /^[a-f0-9]{64}$/i;

// This inspection never connects, mutates data, migrates or changes configuration.
// It deliberately omits URLs, hosts, usernames, hashes and credential values.
export function inspectReleaseConfiguration(environment) {
  const groups = new Map();
  const production = environment.OBRASAAS_PRODUCTION_DATABASE_IDENTITY_SHA256;
  const preview = environment.OBRASAAS_PREVIEW_DATABASE_IDENTITY_SHA256;
  const connections = CONNECTION_KEYS.map(key => {
    const value = environment[key];
    if (value === undefined || value === null) return { key, state: 'MISSING' };
    try {
      const digest = databaseIdentityDigest(value).toString('hex');
      if (!groups.has(digest)) groups.set(digest, groups.size + 1);
      return {
        key, state: 'PARSED', identityGroup: groups.get(digest),
        productionMatch: typeof production === 'string' && HEX.test(production) ? digest === production.toLowerCase() : null,
        expectedPreviewMatch: typeof preview === 'string' && HEX.test(preview) ? digest === preview.toLowerCase() : null,
      };
    } catch { return { key, state: 'INVALID' }; }
  });
  let migrationGate;
  try {
    const plan = evaluateMigrationGate(environment);
    migrationGate = { status: plan.migrate ? 'APPROVED_TO_ATTEMPT' : 'LOCAL_NO_MIGRATION', environment: plan.environment };
  } catch {
    migrationGate = { status: 'BLOCKED' };
  }
  return {
    version: 1, connections, distinctIdentities: groups.size,
    trustedReferences: {
      production: typeof production === 'string' && HEX.test(production) ? 'FORMAT_VALID' : 'UNAVAILABLE_OR_INVALID',
      preview: typeof preview === 'string' && HEX.test(preview) ? 'FORMAT_VALID' : 'UNAVAILABLE_OR_INVALID',
    },
    mixedDatabaseTargets: groups.size > 1, migrationGate,
    productionPrerequisites: inspectProductionPrerequisites(environment),
    runtimeVerified: false, providerVerified: false,
    note: 'Configuration inspection only; this is not a deployment or an end-to-end verification.',
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--local')) {
    console.error('Usage: node scripts/inspect-release-configuration.mjs [--local]');
    process.exitCode = 2;
  } else {
    if (args.includes('--local')) config({ path: '.env.local', quiet: true, override: false });
    const result = inspectReleaseConfiguration(process.env);
    console.log(JSON.stringify(result, null, 2));
    if (result.migrationGate.status === 'BLOCKED' || result.productionPrerequisites.status === 'BLOCKED') process.exitCode = 1;
  }
}
