import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const [pageSource, clientSource] = await Promise.all([
  readFile(new URL("src/app/webview/worker-payment-receipt/page.js", root), "utf8"),
  readFile(
    new URL(
      "src/app/webview/worker-payment-receipt/worker-payment-receipt-client.js",
      root,
    ),
    "utf8",
  ),
]);

test("private receipt page accepts only opaque worker and receipt bindings", () => {
  assert.match(pageSource, /const QUERY_FIELDS = new Set\(\["worker", "receipt"\]\)/);
  assert.match(pageSource, /keys\.length !== QUERY_FIELDS\.size/);
  assert.match(pageSource, /receipt=\{query\.receipt\}/);
  assert.match(pageSource, /worker=\{query\.worker\}/);
  assert.match(pageSource, /dynamic = "force-dynamic"/);
  assert.match(pageSource, /index: false/);
  assert.match(pageSource, /follow: false/);
  assert.match(pageSource, /noarchive: true/);
  assert.match(pageSource, /nocache: true/);
  assert.match(pageSource, /noimageindex: true/);
  assert.match(pageSource, /nosnippet: true/);
  assert.match(pageSource, /referrer: "no-referrer"/);
  assert.doesNotMatch(
    pageSource,
    /getPrisma|readWebviewToken|token|destinationValue|holderName|cuil|console\./i,
  );
});

test("client scrubs the fragment before INIT and never persists or reports its bearer", () => {
  assert.match(clientSource, /const TOKEN_FRAGMENT_PREFIX = "#token="/);
  assert.match(clientSource, /const bearer = tokenRef\.current \|\| tokenFromFragment\(fragment\)/);
  assert.match(clientSource, /globalThis\.history\.replaceState\(null, "", safeRequestTarget\)/);
  assert.ok(clientSource.indexOf("history.replaceState") < clientSource.indexOf("await fetch"));
  assert.match(clientSource, /const API_PATH = "\/api\/webviews\/worker-payment-receipt"/);
  assert.match(clientSource, /action: "INIT"/);
  assert.match(clientSource, /action: "PDF"/);
  assert.match(clientSource, /referrerPolicy: "no-referrer"/);
  assert.match(clientSource, /cache: "no-store"/);
  assert.doesNotMatch(
    clientSource,
    /localStorage|sessionStorage|indexedDB|document\.cookie|sendBeacon|analytics|console\./,
  );
  assert.doesNotMatch(clientSource, /URLSearchParams|[?&]token=|result\.error/);
});

test("client validates an exact masked receipt and communicates its limited legal scope", () => {
  assert.match(clientSource, /const INIT_RESPONSE_FIELDS = new Set\(\["success", "action", "receipt"\]\)/);
  for (const field of [
    "reference",
    "receivedAt",
    "issuedAt",
    "paymentPurpose",
    "destinationType",
    "maskedReference",
    "status",
    "integritySha256",
  ]) {
    assert.match(clientSource, new RegExp(`"${field}"`));
  }
  assert.match(clientSource, /value\.status !== "RECEIVED_FOR_REVIEW"/);
  assert.match(clientSource, /value\.destinationType === "ALIAS" && value\.maskedReference !== null/);
  assert.match(clientSource, /\^•••• \[0-9\]\{4\}\$/u);
  assert.match(clientSource, /Recibido para revisión/);
  assert.match(
    clientSource,
    /no acredita titularidad, validación bancaria, activación, transferencia ni pago/i,
  );
  assert.match(clientSource, /El dato bancario completo no aparece en esta pantalla ni en el PDF/i);
  assert.match(clientSource, /nunca muestra el CBU, CVU o alias completo/i);
});

test("PDF download is content-type checked, size bounded and uses a local safe filename", () => {
  assert.match(clientSource, /const MAX_PDF_BYTES = 1024 \* 1_024/);
  assert.match(clientSource, /contentType !== "application\/pdf"/);
  assert.match(clientSource, /total > MAX_PDF_BYTES/);
  assert.match(clientSource, /header !== "%PDF-" \|\| !trailer\.includes\("%%EOF"\)/);
  assert.match(clientSource, /downloadPdf\(bytes, safeFilename\(context\.reference\)\)/);
  assert.match(clientSource, /URL\.revokeObjectURL\(objectUrl\)/);
  assert.doesNotMatch(clientSource, /content-disposition|responseFilename/);
});
