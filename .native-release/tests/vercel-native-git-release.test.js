import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { selectNativeGitBuild, PREVIEW_RELEASE_BRANCH, PREVIEW_RELEASE_MARKER } from '../scripts/vercel-native-git-release.mjs';

const release = extra => ({ VERCEL_ENV: 'preview', VERCEL_TARGET_ENV: 'preview',
  VERCEL_GIT_COMMIT_REF: PREVIEW_RELEASE_BRANCH, VERCEL_PROJECT_ID: 'prj_68NErbCqCFsDVaMak81gcwsGI9pF',
  VERCEL_GIT_PROVIDER: 'github', VERCEL_GIT_REPO_ID: '1282374475', VERCEL_GIT_REPO_OWNER: 'inguillen87',
  VERCEL_GIT_REPO_SLUG: 'obrasaas', VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40),
  VERCEL_GIT_COMMIT_MESSAGE: 'release: validated candidate\n\n' + PREVIEW_RELEASE_MARKER, ...extra });

test('only an explicit grouped release continues the recovery Preview build', () => {
  assert.deepEqual(selectNativeGitBuild(release()), { build: true, ignoreExitCode: 1, reason: 'GROUPED_PREVIEW_RELEASE' });
  assert.equal(selectNativeGitBuild(release({ VERCEL_GIT_COMMIT_MESSAGE: 'work in progress' })).build, false);
});
test('native release cannot turn the recovery branch into Production or another custom environment', () => {
  for (const override of [{ VERCEL_ENV: 'production' }, { VERCEL_TARGET_ENV: 'production' }, { VERCEL_ENV: 'staging' }, { VERCEL_ENV: undefined }]) {
    assert.equal(selectNativeGitBuild(release(override)).build, false);
  }
});
test('another linked project, repository or missing system metadata cannot trigger this candidate', () => {
  for (const field of ['VERCEL_PROJECT_ID', 'VERCEL_GIT_PROVIDER', 'VERCEL_GIT_REPO_ID', 'VERCEL_GIT_REPO_OWNER', 'VERCEL_GIT_REPO_SLUG']) {
    for (const value of ['other', undefined]) assert.equal(selectNativeGitBuild(release({ [field]: value })).build, false, field);
  }
});
test('ambiguous or malformed release markers do not create builds', () => {
  for (const message of [PREVIEW_RELEASE_MARKER + '\n' + PREVIEW_RELEASE_MARKER, 'example ' + PREVIEW_RELEASE_MARKER,
    PREVIEW_RELEASE_MARKER + ' no', 'ObraSaaS-Preview-Release: denied', PREVIEW_RELEASE_MARKER + '\0', 'x'.repeat(2049), undefined]) {
    assert.equal(selectNativeGitBuild(release({ VERCEL_GIT_COMMIT_MESSAGE: message })).build, false);
  }
  assert.equal(selectNativeGitBuild(release({ VERCEL_GIT_COMMIT_MESSAGE: 'release\r\n\r\n' + PREVIEW_RELEASE_MARKER })).build, true);
});
test('a full commit identity is required but no arbitrary input is logged', () => {
  for (const sha of ['', 'a'.repeat(39), 'g'.repeat(40), undefined]) assert.equal(selectNativeGitBuild(release({ VERCEL_GIT_COMMIT_SHA: sha })).build, false);
  const env = Object.freeze(release({ UNRELATED_SECRET: 'do-not-expose-this' }));
  assert.ok(!JSON.stringify(selectNativeGitBuild(env)).includes('do-not-expose-this'));
});
test('internal validation branches stay skipped and master behavior is not weakened', () => {
  for (const branch of ['validation/check', 'operations/check']) assert.equal(selectNativeGitBuild(release({ VERCEL_GIT_COMMIT_REF: branch })).ignoreExitCode, 0);
  for (const branch of ['master', 'codex/platform-ux-foundation', 'feature/unrelated']) {
    assert.deepEqual(selectNativeGitBuild({ VERCEL_GIT_COMMIT_REF: branch, VERCEL_ENV: 'production' }), { build: true, ignoreExitCode: 1, reason: 'EXISTING_BRANCH_POLICY' });
  }
  assert.equal(selectNativeGitBuild({}).build, false);
});
test('CLI uses Vercel ignore semantics rather than marking a skipped build as a failed compilation', () => {
  const script = fileURLToPath(new URL('../scripts/vercel-native-git-release.mjs', import.meta.url));
  for (const [env, expected] of [[release(), 1], [release({ VERCEL_GIT_COMMIT_MESSAGE: 'not a release' }), 0], [{}, 0]]) {
    const result = spawnSync(process.execPath, [script], { env, encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status, expected); assert.equal(JSON.parse(result.stdout).ignoreExitCode, expected); assert.equal(result.stderr, '');
  }
});
test('native configuration leaves build and migration controls unchanged', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.equal(config.ignoreCommand, 'node scripts/vercel-native-git-release.mjs');
  assert.equal(config.git.deploymentEnabled[PREVIEW_RELEASE_BRANCH], true);
  assert.equal(config.git.deploymentEnabled['validation/*'], false);
  assert.equal(config.git.deploymentEnabled['operations/*'], false);
  assert.equal(config.git.deploymentEnabled.master, undefined);
  assert.equal(config.buildCommand, 'node scripts/inspect-release-configuration.mjs && npm run build:vercel');
  assert.equal(config.crons.length, 4);
  assert.equal(config.installCommand, undefined); assert.equal(config.framework, 'nextjs');
});
