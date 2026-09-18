import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
const read = name => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');
test('Gantt field panel is mounted only on the active authorized schedule', () => {
  const code = read('src/app/dashboard/dashboard-client.js');
  assert.match(code, /activeTab === 'sec-gantt' && setup.canReadFieldStatus/);
  assert.match(code, /fieldSnapshot\?\.projectId === platformAccess.project.id/);
  assert.match(code, /fieldSnapshot\?\.organizationId === platformAccess.organization.id/);
});
test('journal task selection is resolved in the active project without fallback', () => {
  const page = read('src/app/dashboard/progress/page.js');
  assert.match(page, /requestedTaskId && !selectedTask\) notFound/);
  assert.match(page, /id: requestedTaskId, projectId: access.project.id/);
  assert.match(page, /taskId: requestedTaskId/);
  assert.match(page, /filteredTaskId=\{requestedTaskId\}/);
});
test('journal reload and pagination preserve the selected task filter', () => {
  const client = read('src/app/dashboard/progress/progress-client.js');
  assert.equal((client.match(/if \(filteredTaskId\) query.set\("taskId", filteredTaskId\)/g) || []).length, 2);
  assert.match(client, /api\/progress\?limit=50' \+ \(filteredTaskId/);
  assert.match(client, /useState\(filteredTaskId \|\| ""\)/);
});
test('committed journal mutations signal invalidation without adding remote writes', () => {
  const client = read('src/app/dashboard/progress/progress-client.js');
  assert.match(client, /confirmedProgressLog\(result\);\s+publishFieldInvalidation/);
  assert.match(client, /confirmedProgressReview\(result,[^\n]+\);\s+publishFieldInvalidation/);
  assert.match(read('src/app/dashboard/campo/field-client.js'), /publishFieldInvalidation\(\{ organizationId: project.organizationId, projectId: project.id \}\)/);
});
