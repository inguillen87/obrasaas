import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {copyFileSync,existsSync,mkdirSync,mkdtempSync,readFileSync,realpathSync,writeFileSync} from 'node:fs';
import {COMPANY_SUBSCRIPTION_UI_VERSION,COMPANY_SUBSCRIPTION_UI_CHECKS,COMPANY_SUBSCRIPTION_UI_WIDTHS,companySubscriptionUiOptions,companySubscriptionUiSourceFiles,companySubscriptionUiFixtureSourceFiles,companySubscriptionUiServerEnvironment} from '../scripts/verify-company-subscription-ui.mjs';
import {captureOwnedFixture,removeOwnedFixture} from '../scripts/lib/owned-fixture-cleanup.mjs';

const root = realpathSync(fileURLToPath(new URL('..',import.meta.url))),head = 'a'.repeat(40),privateRoot = path.join(root,'.vercel/private');
test('browser producer exports unique real causal groups and the required viewports without autorun',() => {
  assert.equal(COMPANY_SUBSCRIPTION_UI_VERSION,'company-subscription-ui-v2');
  assert.deepEqual(COMPANY_SUBSCRIPTION_UI_WIDTHS,[320,390,768,1280]);
  assert.equal(COMPANY_SUBSCRIPTION_UI_CHECKS.length,22);assert.equal(new Set(COMPANY_SUBSCRIPTION_UI_CHECKS).size,22);
  assert.ok(COMPANY_SUBSCRIPTION_UI_CHECKS.includes('acceptance-uncertainty-reload-get-only'));
});
test('expected source and private immutable output arguments reject foreign, partial or production targets',() => {
  const valid = companySubscriptionUiOptions(['--expected-head',head,'.vercel/private/company-subscription-ui-evidence/current-browser.json'],{repoRoot:root,environment:{GITHUB_SHA:head}});
  assert.equal(valid.expectedHead,head);assert.equal(valid.target,path.join(root,'.vercel/private/company-subscription-ui-evidence/current-browser.json'));
  for (const args of [['--expected-head','abc'],['--expected-head','b'.repeat(40)],['--port','3108'],['../outside.json'],['.vercel/private/company-subscription-ui-evidence/nested/result.json'],['.vercel/private/company-subscription-ui-evidence/result.txt'],['one','two']]) assert.throws(() => companySubscriptionUiOptions(args,{repoRoot:root,environment:{GITHUB_SHA:head}}));
  for (const environment of [{VERCEL:'1'},{VERCEL_ENV:'preview'},{VERCEL_TARGET_ENV:'production'}]) assert.throws(() => companySubscriptionUiOptions([],{repoRoot:root,environment}));
});
test('server subprocess receives operating-system inputs and no provider, database or authentication credentials',() => {
  const result = companySubscriptionUiServerEnvironment({PATH:'os-path',TEMP:'temporary',DATABASE_URL:'private',MERCADOPAGO_ACCESS_TOKEN:'private',CLERK_SECRET_KEY:'private',BINDX_PASSWORD:'private',NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:'private',VERCEL_TOKEN:'private',NODE_OPTIONS:'--inspect'});
  assert.deepEqual(result,{PATH:'os-path',TEMP:'temporary',NEXT_TELEMETRY_DISABLED:'1',NODE_ENV:'development'});
});
test('AST closure includes actual subscription, usage, session and durable recovery sources exactly once',() => {
  const files = companySubscriptionUiSourceFiles(root);assert.equal(new Set(files).size,files.length);assert.equal(files.length,19);
  const baselineDependencies = ['src/app/(identity)/cuenta/plan-baseline-view.mjs','src/app/(identity)/cuenta/plan-source-curve.mjs'];
  for (const file of baselineDependencies) assert.ok(files.includes(file),file);
  const legacySubscriptionSources = [
    'src/app/(identity)/cuenta/company-channel-view.mjs',
    'src/app/(identity)/cuenta/company-subscription-panel.js',
    'src/app/(identity)/cuenta/company-subscription-panel.module.css',
    'src/app/(identity)/cuenta/company-subscription-view.mjs',
    'src/app/(identity)/cuenta/company-usage-panel.js',
    'src/app/(identity)/cuenta/company-usage-view.mjs',
    'src/app/(identity)/cuenta/own-company-number-view.mjs',
    'src/app/(identity)/cuenta/own-company-templates-view.mjs',
    'src/app/(identity)/cuenta/participant-office-account-view.mjs',
    'src/app/(identity)/cuenta/private-bank-account-format.mjs',
    'src/app/(identity)/cuenta/site-purchase-view.mjs',
    'src/app/(identity)/cuenta/workspace-recovery-journal.mjs',
    'src/app/(identity)/cuenta/workspace-recovery-storage.mjs',
    'src/app/(identity)/cuenta/workspace-request-lifecycle.js',
    'src/app/(identity)/cuenta/workspace-request-lifecycle.mjs',
    'src/app/(identity)/cuenta/workspace-session-request.mjs',
    'src/lib/company-entitlement.mjs',
  ];
  assert.equal(legacySubscriptionSources.length,17);
  assert.deepEqual(files.filter(file => !baselineDependencies.includes(file)),legacySubscriptionSources);
  for (const suffix of ['company-subscription-panel.js','company-subscription-view.mjs','company-subscription-panel.module.css','workspace-session-request.mjs','workspace-recovery-storage.mjs','company-usage-panel.js']) assert.ok(files.some(file => file.endsWith(suffix)),suffix);
  assert.deepEqual(companySubscriptionUiFixtureSourceFiles(root),['scripts/lib/company-subscription-ui-fixture.mjs','scripts/lib/owned-fixture-cleanup.mjs','src/lib/company-subscription-catalog.mjs','src/lib/workspace-policy.mjs']);
});
test('actual AST closure rejects external stylesheet and unresolved import mutants, then proves owned removal',async () => {
  mkdirSync(privateRoot,{recursive:true});const fixture = mkdtempSync(path.join(privateRoot,'company-subscription-guard-'));
  const owned = captureOwnedFixture({workspaceRoot:root,privateRoot,fixture,prefix:'company-subscription-guard-'});
  try {
    const files = companySubscriptionUiSourceFiles(root);
    for (const relative of files) {const target = path.join(fixture,relative);mkdirSync(path.dirname(target),{recursive:true});copyFileSync(path.join(root,relative),target);}
    assert.deepEqual(companySubscriptionUiSourceFiles(fixture),files);
    const stylesheet = path.join(fixture,'src/app/(identity)/cuenta/company-subscription-panel.module.css'),original = readFileSync(stylesheet);
    writeFileSync(stylesheet,Buffer.concat([original,Buffer.from('\n.attack{background:url(https://foreign.example/private)}')]));assert.throws(() => companySubscriptionUiSourceFiles(fixture));writeFileSync(stylesheet,original);
    const component = path.join(fixture,'src/app/(identity)/cuenta/company-subscription-panel.js');writeFileSync(component,readFileSync(component,'utf8')+"\nconst unexpected=()=>import('./missing-source.mjs');\n");assert.throws(() => companySubscriptionUiSourceFiles(fixture));
  } finally {
    const cleanup = await removeOwnedFixture(owned,{serverClosedBeforeFixtureRemoval:true});assert.equal(cleanup.fixtureRemoved,true);assert.deepEqual(cleanup.postcondition,{absent:true});assert.equal(existsSync(fixture),false);
  }
});
