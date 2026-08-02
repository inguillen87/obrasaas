import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const [page, client, css] = await Promise.all([
  readFile(new URL('src/app/dashboard/purchases/page.js', root), 'utf8'),
  readFile(new URL('src/app/dashboard/purchases/supplier-commitments-client.js', root), 'utf8'),
  readFile(new URL('src/app/dashboard/purchases/supplier-commitments.module.css', root), 'utf8'),
]);

test('purchases loads a bounded tenant-civil 90-day task calendar', () => {
  assert.match(page, /const tenantToday = todayInTimezone\(access\.organization\.timezone\)/);
  assert.match(page, /const taskHorizonEnd = addCivilDays\(tenantToday, 89\)/);
  assert.match(page, /\{ endsAt: null, startsAt: \{ gte: taskRangeStart \} \}/);
  assert.match(page, /take: 5_001/);
  assert.match(page, /tasksTruncated=\{tasks\.length > 5_000\}/);
});

test('true fortnight groups render scheduled tasks and supplier commitments together', () => {
  assert.match(client, /for \(const task of tasks\)/);
  assert.match(client, /groupFor\(group\)\.tasks\.push\(task\)/);
  assert.match(client, /groupFor\(group\)\.commitments\.push\(commitment\)/);
  assert.match(client, /Tareas planificadas · próximos 90 días/);
  assert.match(client, /group\.commitments\.map/);
  assert.match(client, /Exportar próximos 90 días \(\.ics\)/);
  assert.match(css, /\.taskScheduleList/);
});

test('material attestation and external email incidents remain explicit in the UI', () => {
  assert.match(client, /ADMIN_ATTESTED: "Cumplimiento declarado"/);
  assert.match(client, /un envío quedó incierto y no se reintentará solo/);
  assert.match(client, /Confirmo que este email es operativo y autorizo avisar siete días antes/);
});
