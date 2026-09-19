import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
test('el acceso de la página exige los permisos del nuevo circuito', () => {
  assert.match(read('src/app/dashboard/inbox/page.js'), /canCreateProgressReport=\{canLinkProgressEvidence && hasTenantPermission\(access, 'org:tasks:read'\)\}/);
  assert.match(read('src/app/dashboard/inbox/page.js'), /organizationId=\{access.organization.id\}/);
});
test('la fuente sólo se ofrece desde la proyección autorizada del servidor', () => {
  assert.match(read('src/lib/whatsapp/inbox.js'), /progressReportKind: includeSourceEvidence \? reportSourceKind\(safeMessage\) : null/);
  assert.match(read('src/app/dashboard/inbox/inbox-client.js'), /canCreateProgressReport && message.progressReportKind/);
});
test('el editor vive fuera de la lista paginada de mensajes', () => {
  const client = read('src/app/dashboard/inbox/inbox-client.js');
  assert.match(client, /const \[reportSource, setReportSource\] = useState\(null\)/);
  assert.ok(client.indexOf('<MessageReportDialog') < client.indexOf('<div className={styles.workspace}>'));
  assert.match(client, /reportSource.conversationId/);
});
test('las notificaciones del cronograma se emiten después de confirmar el registro', () => {
  assert.match(read('src/app/dashboard/inbox/message-report-action.js'), /const confirmed = confirmedMessageReport[\s\S]*?publishFieldInvalidation/);
  assert.doesNotMatch(read('src/lib/whatsapp/progress-report.js'), /sendWhatsApp|transcribe|task\.update|stock.*update/i);
});
