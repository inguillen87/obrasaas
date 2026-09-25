import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { enterpriseAliasFor, ENTERPRISE_CONVERGENCE_VERSION, MASTER_ONLY_ROUTE_CONVERGENCE } from '../src/lib/enterprise-convergence.js';
const expectedMasterOnly = ['/api-docs','/bim','/calendario','/certificacion','/compliance','/coordinacion','/costos','/cronograma','/documentos','/ejecutivo','/libro-obra','/licitaciones','/marketplace','/onboarding','/planos','/portal','/poster','/pricing','/qa-report','/sostenibilidad'];
const approvedAliases = new Map([['/costos','/dashboard/budgets'],['/cronograma','/dashboard?tab=sec-gantt'],['/libro-obra','/dashboard/progress'],['/marketplace','/dashboard/purchases'],['/onboarding','/dashboard/getting-started']]);

test('C1 manifest accounts for every route that exists only in master', () => {
  assert.equal(ENTERPRISE_CONVERGENCE_VERSION, 'c2-2026-09-25');
  assert.deepEqual(MASTER_ONLY_ROUTE_CONVERGENCE.map(row => row.legacy), expectedMasterOnly);
  assert.equal(new Set(MASTER_ONLY_ROUTE_CONVERGENCE.map(row => row.legacy)).size, expectedMasterOnly.length);
});
test('only exact enterprise equivalents are enabled as temporary aliases', () => {
  for (const row of MASTER_ONLY_ROUTE_CONVERGENCE) {
    assert.ok(['alias','pending'].includes(row.status));
    if (approvedAliases.has(row.legacy)) {
      assert.equal(row.status, 'alias'); assert.equal(row.target, approvedAliases.get(row.legacy)); assert.equal(typeof row.label, 'string');
    } else { assert.equal(row.status, 'pending'); assert.equal(row.target, undefined); assert.ok(row.reason.length > 20); }
  }
});
test('convergence copy is valid UTF-8 Spanish without mojibake placeholders', () => {
  for (const row of MASTER_ONLY_ROUTE_CONVERGENCE) {
    const copy = [row.reason, row.label].filter(Boolean).join(' ');
    assert.doesNotMatch(copy, /Ã|Â|\?\p{L}/u);
  }
});
test('alias resolver never guesses a pending module', () => {
  for (const [legacy,target] of approvedAliases) assert.equal(enterpriseAliasFor(legacy), target);
  for (const row of MASTER_ONLY_ROUTE_CONVERGENCE.filter(row => row.status === 'pending')) assert.equal(enterpriseAliasFor(row.legacy), null);
  for (const path of ['/','/dashboard','/unknown','/licitaciones?fake=1']) assert.equal(enterpriseAliasFor(path), null);
});
test('approved compatibility routes are small server aliases and pending routes are not created by C1', () => {
  const helper = readFileSync('src/app/legacy-enterprise-alias.js','utf8');
  assert.match(helper, /redirect\(target\)/); assert.doesNotMatch(helper, /permanentRedirect/);
  for (const [legacy] of approvedAliases) {
    const source = readFileSync(`src/app${legacy}/page.js`,'utf8');
    assert.match(source, /LegacyEnterpriseAlias/); assert.match(source, new RegExp(`legacyPath=\"${legacy.replace('/','\/')}\"`));
  }
  for (const row of MASTER_ONLY_ROUTE_CONVERGENCE.filter(row => row.status === 'pending')) assert.equal(existsSync(`src/app${row.legacy}/page.js`), false, row.legacy);
});
