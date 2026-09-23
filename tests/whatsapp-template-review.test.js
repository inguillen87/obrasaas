import assert from 'node:assert/strict';
import test from 'node:test';
import { assertTemplateReviewDefinition, normalizeTemplateReview, templateCatalogMatches, templateEntryMatches, templateProvisionMatches, templateStatusPresentation, templateRequestRejectedBeforeProvider } from '../src/lib/whatsapp/template-review-policy.js';
import { listWhatsAppMessageTemplates, provisionOwnedWhatsAppFlowTemplate, remoteTemplateMatchesDefinition } from '../src/lib/whatsapp/templates.js';
import { templateWorkbenchFixture, templateScope } from './helpers/template-workbench-fixture.js';
const reviewFor = f => { const d = f.definition(); return { blueprintKey: d.blueprintKey, expectedName: d.name, contentSha256: d.contentSha256, confirmed: true }; };

test('catalog carries only the scoped exact body and button before submission', async () => {
  const f = templateWorkbenchFixture(), templates = await f.sync();
  assert.equal(templateCatalogMatches({ context: templateScope, templates }, templateScope), true);
  assert.equal(templates[0].preview.bodyText, f.definition().bodyText); assert.equal(templates[0].preview.buttonText, 'Reportar');
  assert.equal(templates[0].template, null); assert.equal(f.calls.filter(row => row.method === 'POST').length, 0);
  assert.ok(!JSON.stringify(templates).includes('synthetic-template-access-token'));
});
test('reviewed submission returns the same definition and an explicit pending state', async () => {
  const f = templateWorkbenchFixture(), review = reviewFor(f), result = await f.provision();
  assert.equal(templateProvisionMatches({ context: templateScope, result }, review, templateScope), true);
  assert.equal(result.template.status, 'PENDING'); assert.equal(result.template.canSend, false);
  assert.equal(f.remote.length, 1); assert.equal(f.rows.length, 1);
});
test('a lost response can be reconciled with GET without another provider POST', async () => {
  const f = templateWorkbenchFixture(); await f.provision(); const templates = await f.sync();
  assert.equal(templates[0].template.status, 'PENDING'); assert.equal(f.calls.filter(row => row.method === 'POST').length, 1);
  const again = await f.provision(); assert.equal(again.created, false); assert.equal(f.calls.filter(row => row.method === 'POST').length, 1);
});
for (const status of ['PENDING', 'PAUSED', 'REJECTED', 'DISABLED', 'FLAGGED', 'DELETED', 'IN_APPEAL', 'UNKNOWN']) test('nonapproved ' + status + ' cannot advertise sending', async () => {
  const f = templateWorkbenchFixture(); await f.provision(); f.remote[0].status = status;
  const [entry] = await f.sync(); assert.equal(entry.template.canSend, false); assert.equal(templateEntryMatches(entry), true);
  assert.notEqual(templateStatusPresentation(entry.template).tone, 'ready');
});
test('recategorized approved template is visible but not eligible for the utility circuit', async () => {
  const f = templateWorkbenchFixture(); await f.provision(); Object.assign(f.remote[0], { status: 'APPROVED', category: 'MARKETING' });
  const [entry] = await f.sync(); assert.equal(entry.template.canSend, false); assert.equal(templateStatusPresentation(entry.template).label, 'Categoría distinta');
});
test('a complete approved utility record is recognized without claiming delivery', async () => {
  const f = templateWorkbenchFixture(); await f.provision(); f.remote[0].status = 'APPROVED';
  const [entry] = await f.sync(); assert.equal(entry.template.canSend, true);
  assert.match(templateStatusPresentation(entry.template).detail, /Cada envío requiere/);
});
for (const patch of [{ confirmed: false }, { confirmed: 'true' }, { expectedName: '' }, { expectedName: '../other' }, { contentSha256: 'wrong' }, { blueprintKey: 'BAD' }, { to: 'private-phone' }, { projectId: 'other' }]) test('review rejects unapproved or extra fields ' + JSON.stringify(patch), () => {
  assert.throws(() => normalizeTemplateReview({ ...reviewFor(templateWorkbenchFixture()), ...patch }), { code: 'WHATSAPP_TEMPLATE_REVIEW_INVALID' });
});
for (const field of ['name', 'contentSha256', 'blueprintKey']) test('changed ' + field + ' rejects the old review', () => {
  const f = templateWorkbenchFixture(); assert.throws(() => assertTemplateReviewDefinition(reviewFor(f), { ...f.definition(), [field]: 'changed' }), { code: 'WHATSAPP_TEMPLATE_REVIEW_CHANGED' });
});
test('catalog and provision cannot substitute tenant, worksite, blueprint or body', async () => {
  const f = templateWorkbenchFixture(), result = await f.provision(), entry = (await f.sync())[0];
  for (const context of [{ ...templateScope, organizationId: 'other' }, { ...templateScope, projectId: 'other' }, null]) assert.equal(templateCatalogMatches({ context, templates: [entry] }, templateScope), false);
  for (const bad of [{ ...entry, expectedName: 'different' }, { ...entry, preview: { ...entry.preview, bodyText: '' } }, { ...entry, preview: { ...entry.preview, language: 'en_US' } }, { ...entry, template: { ...entry.template, canSend: true } }]) assert.equal(templateEntryMatches(bad), false);
  assert.equal(templateCatalogMatches({ context: templateScope, templates: [entry, entry] }, templateScope), false);
  assert.equal(templateProvisionMatches({ context: templateScope, result: { ...result, contentSha256: 'a'.repeat(64) } }, reviewFor(f), templateScope), false);
});
for (const extra of ['HEADER', 'FOOTER', 'BODY', 'BUTTONS']) test('an extra ' + extra + ' cannot be adopted as the reviewed message', () => {
  const f = templateWorkbenchFixture(), d = f.definition(); const remote = { ...d, components: [...d.components, { type: extra, text: 'Extra content', buttons: [] }] };
  assert.equal(remoteTemplateMatchesDefinition(remote, d), false);
});
test('a second button in the expected container cannot silently change message behavior', () => {
  const f = templateWorkbenchFixture(), d = f.definition(), components = structuredClone(d.components);
  components[1].buttons.push({ type: 'URL', text: 'Extra action', url: 'https://example.test' });
  assert.equal(remoteTemplateMatchesDefinition({ ...d, components }, d), false);
  assert.equal(remoteTemplateMatchesDefinition({ ...d, components: [...d.components].reverse() }, d), true);
});
test('provider extras and content changes fail before local adoption', async () => {
  const f = templateWorkbenchFixture(), d = f.definition();
  const remote = { id: '555555555555555', ...d, status: 'APPROVED', components: [...d.components, { type: 'FOOTER', text: 'Unexpected terms' }] };
  await assert.rejects(provisionOwnedWhatsAppFlowTemplate({ ...f.options, blueprintKey: d.blueprintKey, fetchImpl: async () => Response.json({ data: [remote] }) }), { code: 'WHATSAPP_TEMPLATE_OWNERSHIP_CONFLICT' });
  assert.equal(f.rows.length, 0);
});
test('missing provider status or category does not authorize sending', async () => {
  const f = templateWorkbenchFixture(), d = f.definition();
  const rows = await listWhatsAppMessageTemplates({ ...f.options, whatsappBusinessId: f.connection.whatsappBusinessId, fetchImpl: async () => Response.json({ data: [{ id: '555555555555555', name: d.name, language: d.language, components: d.components }] }) });
  assert.equal(rows[0].status, 'UNKNOWN'); assert.equal(rows[0].category, 'UNKNOWN');
});

for (const code of ['WHATSAPP_TEMPLATE_REVIEW_CHANGED', 'WHATSAPP_FLOW_PROVISIONING_IN_PROGRESS', 'WHATSAPP_FLOW_PROVISIONING_CONNECTION_CHANGED']) test('confirmed pre-provider '+code+' permits a new reviewed read, not automatic submission', () => {
  assert.equal(templateRequestRejectedBeforeProvider({code,status:409}),true);
  assert.equal(templateRequestRejectedBeforeProvider({code,status:503}),false);
});
test('unknown POST outcomes never become known rejection from HTTP status alone', () => {
  for (const status of [409,422,400,500,503]) assert.equal(templateRequestRejectedBeforeProvider({code:'PROVIDER_UNKNOWN',status}),false);
  assert.equal(templateRequestRejectedBeforeProvider(new Error('network')),false);
  assert.equal(templateRequestRejectedBeforeProvider({code:'WHATSAPP_TEMPLATE_REVIEW_INVALID',status:422}),true);
});
test('review does not coerce arrays and numbers into identifier strings', () => {
  const good=reviewFor(templateWorkbenchFixture());
  for(const field of ['blueprintKey','expectedName','contentSha256']) assert.throws(()=>normalizeTemplateReview({...good,[field]:[good[field]]}),{code:'WHATSAPP_TEMPLATE_REVIEW_INVALID'});
});
