import { pathToFileURL } from 'node:url';

import { PrismaNeon } from '@prisma/adapter-neon';
import dotenv from 'dotenv';

import { PrismaClient } from '../src/generated/prisma/client.ts';
import {
  authorizePreviewReconciliationDatabase,
  createClerkBapiReadClient,
  parseClerkMembershipReconciliationArgs,
  reconcileClerkMembership,
  safeClerkMembershipReconciliationError,
} from './lib/clerk-membership-reconciler.mjs';

dotenv.config({ path: '.env.local', quiet: true });

const HELP = `ObraSaaS Clerk membership reconciler (Preview only)

Required:
  --organization-id <org_...>
  --user-id <user_...>
  --expected-instance-id <ins_...>

Environment gates:
  VERCEL_ENV=preview, CLERK_SECRET_KEY, DATABASE_URL and the independent
  OBRASAAS_PREVIEW_DATABASE_IDENTITY_SHA256 allowlist are required. Existing
  production-identity and same-Neon-branch gates remain mandatory.

Behavior:
  Dry-run is the default. Add --apply to upsert only the platform user,
  organization and tenant membership in the authorized Neon Preview branch.
  Clerk is read with GET requests only. Transitions requiring project-access
  revocation are rejected.
`;

export async function runClerkMembershipReconciliationCli({
  args = process.argv.slice(2),
  environment = process.env,
  fetchImpl = globalThis.fetch,
  output = console,
} = {}) {
  const options = parseClerkMembershipReconciliationArgs(args);
  if (options.help) {
    output.log(HELP);
    return { help: true };
  }

  const databaseAuthorization = authorizePreviewReconciliationDatabase(environment);
  const clerk = createClerkBapiReadClient({
    secretKey: environment.CLERK_SECRET_KEY,
    fetchImpl,
  });
  const database = new PrismaClient({
    adapter: new PrismaNeon({ connectionString: databaseAuthorization.databaseUrl }),
  });

  try {
    const result = await reconcileClerkMembership({
      database,
      clerk,
      organizationId: options.organizationId,
      userId: options.userId,
      expectedInstanceId: options.expectedInstanceId,
      apply: options.apply,
      databaseAuthorization,
      internalClerkOrganizationId: environment.OBRASAAS_INTERNAL_CLERK_ORG_ID || null,
    });
    output.log(JSON.stringify(result, null, 2));
    return result;
  } finally {
    await database.$disconnect();
  }
}

const isMain = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  runClerkMembershipReconciliationCli().catch((error) => {
    console.error(JSON.stringify({
      ok: false,
      error: safeClerkMembershipReconciliationError(error),
    }));
    process.exitCode = 1;
  });
}
