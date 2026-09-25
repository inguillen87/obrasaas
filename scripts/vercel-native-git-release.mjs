import { pathToFileURL } from 'node:url';

// Vercel Ignored Build Step: 0 skips the build, 1 continues it.
// This selects grouped Preview releases; it is not an authorization or migration gate.
export const PREVIEW_RELEASE_BRANCH = 'codex/saas-recovery-20260917';
export const PREVIEW_RELEASE_MARKER = 'ObraSaaS-Preview-Release: approved';
const PROJECT = 'prj_68NErbCqCFsDVaMak81gcwsGI9pF';
const REPOSITORY = '1282374475';
const decision = (build, reason) => ({ build, ignoreExitCode: build ? 1 : 0, reason });

export function selectNativeGitBuild(env = {}) {
  const branch = env.VERCEL_GIT_COMMIT_REF;
  if (typeof branch !== 'string' || !branch) return decision(false, 'GIT_CONTEXT_UNAVAILABLE');
  if (/^(?:validation|operations)\//.test(branch)) return decision(false, 'INTERNAL_VALIDATION_BRANCH');
  // Other branches retain their existing build behavior. The existing production
  // configuration/database/SHA checks remain in buildCommand, unchanged.
  if (branch !== PREVIEW_RELEASE_BRANCH) return decision(true, 'EXISTING_BRANCH_POLICY');
  if (env.VERCEL_ENV !== 'preview' || env.VERCEL_TARGET_ENV && env.VERCEL_TARGET_ENV !== 'preview') {
    return decision(false, 'RECOVERY_REQUIRES_PREVIEW');
  }
  if (env.VERCEL_PROJECT_ID !== PROJECT || env.VERCEL_GIT_PROVIDER !== 'github'
    || env.VERCEL_GIT_REPO_ID !== REPOSITORY || env.VERCEL_GIT_REPO_OWNER !== 'inguillen87'
    || env.VERCEL_GIT_REPO_SLUG !== 'obrasaas') return decision(false, 'PREVIEW_TARGET_MISMATCH');
  if (!/^[a-f0-9]{40}$/.test(env.VERCEL_GIT_COMMIT_SHA || '')) return decision(false, 'COMMIT_UNCONFIRMED');
  const message = env.VERCEL_GIT_COMMIT_MESSAGE;
  if (typeof message !== 'string' || Buffer.byteLength(message, 'utf8') > 2048 || message.includes('\0')) {
    return decision(false, 'RELEASE_MESSAGE_UNCONFIRMED');
  }
  const markers = message.replace(/\r\n/g, '\n').split('\n').filter(line => line.startsWith('ObraSaaS-Preview-Release:'));
  if (markers.length !== 1 || markers[0] !== PREVIEW_RELEASE_MARKER) return decision(false, 'NOT_A_GROUPED_RELEASE');
  return decision(true, 'GROUPED_PREVIEW_RELEASE');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // No credentials, remote requests, package installation or database access.
  const result = selectNativeGitBuild(process.env);
  console.log(JSON.stringify(result));
  process.exitCode = result.ignoreExitCode;
}
