import { metaCustomerReadiness } from './meta-customer-provider.mjs';
import { readDevelopmentPilotPolicy } from './meta-development-pilot-policy.mjs';

export const META_RELEASE_OBSERVATION_MODE = 'GENERAL_META_CLOSED';

// These are release configuration observations. They do not verify an owner,
// authorize a participant, inspect a connection, or make a channel operational.
export function observeMetaRelease(environment = process.env, now = Date.now()) {
  if (!environment || typeof environment !== 'object' || Array.isArray(environment) ||
      !Number.isSafeInteger(now) || Math.abs(now) > 8640000000000000) {
    throw new Error('META_RELEASE_OBSERVATION_INVALID');
  }
  const readiness = metaCustomerReadiness(environment);
  return Object.freeze({
    customerSignup: readiness.gates.review ? 'RELEASE_ENABLED' : 'CLOSED',
    // A configured release stays visible even when another readiness gate is
    // missing. Missing credentials must not disguise an enabled release as OFF.
    businessAppCoexistence: environment.OBRASAAS_META_COEXISTENCE_RELEASE === 'business-app-coexistence-v1'
      ? 'RELEASE_ENABLED' : 'CLOSED',
    developmentPilotAuthorization: readDevelopmentPilotPolicy(environment, now) ? 'CURRENT_POLICY' : 'CLOSED',
  });
}
