import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const pageSource = readFileSync(
  new URL('../src/app/dashboard/team/page.js', import.meta.url),
  'utf8',
);
const clientSource = readFileSync(
  new URL('../src/app/dashboard/team/worker-payment-destinations-client.js', import.meta.url),
  'utf8',
);
const cssSource = readFileSync(
  new URL('../src/app/dashboard/team/team.module.css', import.meta.url),
  'utf8',
);

test('Equipo mounts the payment destination panel only with exact independent permissions', () => {
  assert.match(
    pageSource,
    /const canReadPaymentDestinations = hasTenantPermission\([\s\S]{0,80}'org:payroll:destinations:read'/,
  );
  assert.match(
    pageSource,
    /const canManagePaymentDestinations = hasTenantPermission\([\s\S]{0,80}'org:payroll:destinations:manage'/,
  );
  assert.match(
    pageSource,
    /const canActivatePaymentDestinations = hasTenantPermission\([\s\S]{0,80}'org:payroll:destinations:activate'/,
  );
  assert.match(
    pageSource,
    /\{canReadPaymentDestinations && \([\s\S]{0,120}<WorkerPaymentDestinationsClient/,
  );
  assert.match(pageSource, /canManage=\{canManagePaymentDestinations\}/);
  assert.match(pageSource, /canActivate=\{canActivatePaymentDestinations\}/);
});

test('worker projection passes existing IDs and operational labels without channel data', () => {
  assert.match(
    pageSource,
    /workers=\{workers[\s\S]{0,120}\.filter\(\(worker\) => Boolean\(worker\.personId\)\)[\s\S]{0,120}\.map\(\(worker\) => \(\{[\s\S]{0,180}id: worker\.id,[\s\S]{0,120}name: worker\.name,[\s\S]{0,120}role: worker\.role,[\s\S]{0,120}active: worker\.active/,
  );
  const paymentMount = pageSource.slice(pageSource.indexOf('<WorkerPaymentDestinationsClient'));
  const workerProjection = paymentMount.slice(
    paymentMount.indexOf('.map((worker) => ({'),
    paymentMount.indexOf('/>') + 2,
  );
  assert.doesNotMatch(
    workerProjection,
    /phone|channels|personId|address|providerSubject/,
  );
});

test('destinations load lazily for the selected worker and bypass browser caches', () => {
  assert.match(clientSource, /const \[selectedWorkerId, setSelectedWorkerId\] = useState\(''\)/);
  assert.match(
    clientSource,
    /function selectWorker\(workerId\)[\s\S]{0,260}!workerStates\[workerId\][\s\S]{0,80}loadDestinations\(workerId\)/,
  );
  assert.match(
    clientSource,
    /\/payment-destinations`,[\s\S]{0,80}\{ cache: 'no-store' \}/,
  );
  assert.doesNotMatch(clientSource, /useEffect|Promise\.all\(workers|workers\.map\([^)]*fetch/);
});

test('the client accepts only the masked destination DTO and never renders account inputs', () => {
  for (const field of [
    'maskedValue',
    'purpose',
    'status',
    'version',
    'revision',
    'createdAt',
    'updatedAt',
    'verifiedAt',
    'availableFrom',
    'privacyStatus',
    'paymentUsable',
  ]) {
    assert.match(clientSource, new RegExp(field));
  }
  assert.match(clientSource, /MASKED_VALUE_PATTERN/);
  assert.match(clientSource, /source\.currency !== 'ARS'/);
  assert.match(
    clientSource,
    /source\.paymentUsable !== \(status === 'ACTIVE' && privacyStatus === 'ATTESTED'\)/,
  );
  assert.doesNotMatch(
    clientSource,
    /holderCuil|holderName|encryptedPayload|fingerprint|wrappingKey|resolvedEncrypted|accountValue|cbuValue|cvuValue/,
  );
  assert.doesNotMatch(clientSource, /<input|type="password"|type="tel"/);
});

test('reject, revoke, and activate follow exact status and permission boundaries', () => {
  assert.match(
    clientSource,
    /selectedWorker\.active[\s\S]{0,100}canManage[\s\S]{0,100}destination\.status === 'PENDING_VERIFICATION'[\s\S]{0,360}'REJECT'/,
  );
  assert.match(
    clientSource,
    /selectedWorker\.active[\s\S]{0,100}canActivate[\s\S]{0,100}destination\.privacyStatus === 'ATTESTED'[\s\S]{0,100}destination\.status === 'VERIFIED'[\s\S]{0,360}'ACTIVATE'/,
  );
  assert.match(
    clientSource,
    /selectedWorker\.active[\s\S]{0,100}canManage[\s\S]{0,100}\['VERIFIED', 'ACTIVE'\]\.includes\(destination\.status\)[\s\S]{0,360}'REVOKE'/,
  );
  assert.match(clientSource, /\/activation`/);
  assert.match(clientSource, /\/revocation`/);
  assert.match(clientSource, /decision: 'REJECT'/);
  assert.match(clientSource, /rejectionReason: decision\.reason\.trim\(\)/);
  assert.match(clientSource, /reason: decision\.reason\.trim\(\)/);
  assert.match(clientSource, /maxLength=\{MAX_REASON_LENGTH\}/);
});

test('decision requests are replay-safe, revisioned, response-driven, and refresh stale views', () => {
  assert.match(clientSource, /globalThis\.crypto\?\.randomUUID\?\.\(\)/);
  assert.match(clientSource, /'Idempotency-Key': decision\.idempotencyKey/);
  assert.match(clientSource, /expectedRevision: decision\.destination\.revision/);
  assert.match(clientSource, /const updated = replaceDestination\(decision\.workerId, payload\.paymentDestination\)/);
  assert.match(clientSource, /await loadDestinations\(decision\.workerId, \{ silent: true \}\)/);
  assert.match(clientSource, /error\.code === 'WORKER_PAYMENT_REVISION_STALE'/);
  assert.doesNotMatch(clientSource, /Number\(error\.status\) === 409/);
  assert.match(
    clientSource,
    /function updateReason\(reason\)[\s\S]{0,200}idempotencyKey: operationKey\(current\.action\)/,
  );
  assert.doesNotMatch(clientSource, /setInterval|localStorage|sessionStorage|console\./);
});

test('verification stays visibly fail-closed and the panel is responsive and accessible', () => {
  assert.match(clientSource, /Verificación externa pendiente/);
  assert.match(clientSource, /No se ofrece “Verificar” hasta conectar un proveedor confiable/);
  assert.doesNotMatch(clientSource, />\s*Verificar\s*</);
  assert.match(clientSource, /aria-labelledby="payment-destinations-title"/);
  assert.match(clientSource, /role="region" aria-labelledby="payment-decision-title"/);
  assert.match(clientSource, /role=\{notice\.type === 'error' \? 'alert' : 'status'\}/);
  assert.match(cssSource, /\.paymentPanel/);
  assert.match(cssSource, /\.paymentDestinationCard\[data-status="ACTIVE"\]/);
  assert.match(clientSource, /El operario debe ratificarlo desde su WhatsApp verificado/);
  assert.match(clientSource, /Volvé a capturar exactamente el mismo destino/);
  assert.match(clientSource, /Este registro legado está cerrado y no puede reabrirse/);
  assert.match(cssSource, /\.paymentReattestationNotice/);
  assert.match(cssSource, /\.paymentWorkerPicker select:focus-visible/);
  assert.match(cssSource, /@media \(max-width: 620px\)[\s\S]*\.paymentPanel \{ padding: 16px; \}/);
});
