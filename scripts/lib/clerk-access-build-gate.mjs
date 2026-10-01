import { inspectIdentityProvider } from './production-identity-check.mjs';

const failureStatuses = new Set(['CONFIGURATION_PENDING', 'PROVIDER_CREDENTIAL_REJECTED', 'PROVIDER_INSTANCE_MISMATCH', 'PROVIDER_UNCONFIRMED']);

// A production deployment must prove its Backend API credential belongs to the
// already pinned instance. This read-only check grants no user or business access.
export async function inspectClerkAccessBuildGate({ environment = process.env, inspect = inspectIdentityProvider } = {}) {
  const base = { version: 1, readOnly: true, customerLoginVerified: false, businessAccessEnabled: false };
  if (environment.VERCEL_ENV !== 'production') {
    return { ...base, status: 'SKIPPED_NON_PRODUCTION', required: false, passed: false, instanceIdMatched: false };
  }
  let status = 'PROVIDER_UNCONFIRMED', passed = false;
  try {
    const result = await inspect({ environment });
    passed = result?.status === 'INSTANCE_VERIFIED' && result.instanceIdMatched === true;
    status = passed ? 'INSTANCE_VERIFIED' : failureStatuses.has(result?.status) ? result.status : 'PROVIDER_UNCONFIRMED';
  } catch {
    // Provider diagnostics and configuration values never enter build output.
  }
  return { ...base, status, required: true, passed, instanceIdMatched: passed };
}
