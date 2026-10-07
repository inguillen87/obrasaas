import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { IDENTITY_ORIGIN } from '../src/lib/production-identity-config.mjs';
import { META_RELEASE_OBSERVATION_MODE, observeMetaRelease } from '../src/lib/meta-release-observation.mjs';

export function observeGeneralMetaClosedBuild(environment = process.env, now = Date.now()) {
  const marker = environment.OBRASAAS_META_RELEASE_OBSERVATION;
  if (marker === undefined || marker === '') return null;
  if (marker !== META_RELEASE_OBSERVATION_MODE || environment.VERCEL_ENV !== 'production' ||
      environment.VERCEL_PROJECT_ID !== 'prj_68NErbCqCFsDVaMak81gcwsGI9pF' ||
      environment.NEXT_PUBLIC_APP_URL !== IDENTITY_ORIGIN) {
    throw new Error('META_RELEASE_CLOSED_BUILD_CONTEXT_INVALID');
  }
  const states = observeMetaRelease(environment, now);
  if (Object.values(states).some(state => state !== 'CLOSED')) {
    throw new Error('META_RELEASE_CLOSED_BUILD_NOT_CLOSED');
  }
  return {
    status: 'PASS', mode: META_RELEASE_OBSERVATION_MODE, observedAt: new Date(now).toISOString(),
    ...states, readOnly: true, providerCalls: 0, environmentValuesReturned: false,
    configurationValuesEqualClaimed: false, ownerVerified: false, existingConnectionsChecked: false,
  };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const observation = observeGeneralMetaClosedBuild();
    if (observation) console.log(JSON.stringify({ metaReleaseClosedBuildCheck: observation }));
  } catch {
    console.error(JSON.stringify({ metaReleaseClosedBuildCheck: {
      status: 'UNCONFIRMED', code: 'META_RELEASE_CLOSED_BUILD_UNCONFIRMED',
      readOnly: true, environmentValuesReturned: false,
    } }));
    process.exitCode = 1;
  }
}
