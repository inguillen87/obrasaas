import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { PDFDocument } from "pdf-lib";

import {
  WORKER_PAYMENT_RECEIPT_DISCLAIMER,
  normalizeWorkerPaymentReceiptPdfDto,
  renderWorkerPaymentReceiptPdf,
  workerPaymentReceiptPdfFilename,
} from "../src/lib/worker-payment-receipt-pdf.js";

const source = await readFile(
  new URL("../src/lib/worker-payment-receipt-pdf.js", import.meta.url),
  "utf8",
);

function receiptFixture(overrides = {}) {
  return {
    reference: "opr-7c447c50-52d4-4c9b-aea0-442f9c42cd81",
    receivedAt: "2026-07-30T04:12:00.000Z",
    issuedAt: "2026-07-30T04:12:03.000Z",
    paymentPurpose: "SALARY",
    destinationType: "CBU",
    maskedReference: "•••• 4321",
    status: "RECEIVED_FOR_REVIEW",
    integritySha256: "a".repeat(64),
    ...overrides,
  };
}

test("private receipt renderer emits one deterministic A4 PDF with controlled metadata", async () => {
  const receipt = receiptFixture();
  const [first, second] = await Promise.all([
    renderWorkerPaymentReceiptPdf(receipt),
    renderWorkerPaymentReceiptPdf(receipt),
  ]);
  const loaded = await PDFDocument.load(first, { updateMetadata: false });

  assert.equal(Buffer.from(first.subarray(0, 5)).toString("ascii"), "%PDF-");
  assert.ok(first.byteLength > 5_000);
  assert.ok(first.byteLength < 1024 * 1_024);
  assert.equal(loaded.getPageCount(), 1);
  assert.ok(Math.abs(loaded.getPage(0).getWidth() - 595.28) < 0.1);
  assert.ok(Math.abs(loaded.getPage(0).getHeight() - 841.89) < 0.1);
  assert.equal(loaded.getTitle(), `Constancia privada de recepción - ${receipt.reference}`);
  assert.equal(loaded.getAuthor(), "ObraSaaS");
  assert.equal(loaded.getSubject(), WORKER_PAYMENT_RECEIPT_DISCLAIMER);
  assert.equal(loaded.getCreationDate().toISOString(), receipt.issuedAt);
  assert.equal(loaded.getModificationDate().toISOString(), receipt.issuedAt);
  assert.equal(
    createHash("sha256").update(first).digest("hex"),
    createHash("sha256").update(second).digest("hex"),
  );
  assert.equal(
    workerPaymentReceiptPdfFilename(receipt),
    "constancia-recepcion-opr-7c447c50-52d4-4c9b-aea0-442f9c42cd81.pdf",
  );
});

test("PDF DTO is exact, immutable and permits only a genuinely masked bank reference", () => {
  const input = receiptFixture();
  const normalized = normalizeWorkerPaymentReceiptPdfDto(input);

  assert.deepEqual(normalized, input);
  assert.equal(Object.isFrozen(normalized), true);
  assert.throws(
    () => normalizeWorkerPaymentReceiptPdfDto(receiptFixture({ maskedReference: "2850590940090418135201" })),
    /DTO is invalid/,
  );
  assert.throws(
    () => normalizeWorkerPaymentReceiptPdfDto(receiptFixture({ destinationType: "ALIAS", maskedReference: "mi.alias" })),
    /DTO is invalid/,
  );
  assert.deepEqual(
    normalizeWorkerPaymentReceiptPdfDto(receiptFixture({
      destinationType: "ALIAS",
      maskedReference: null,
    })).maskedReference,
    null,
  );
});

test("PDF DTO rejects full financial, identity, bearer and internal-domain fields", () => {
  const forbiddenFields = {
    destinationValue: "2850590940090418135201",
    cbu: "2850590940090418135201",
    cvu: "0000003100012345678901",
    alias: "nombre.apellido.banco",
    holderName: "Persona Ejemplo",
    cuil: "20123456789",
    token: "signed-private-bearer",
    destinationId: "internal-destination-id",
    encryptedPayload: "ciphertext",
  };

  for (const [field, value] of Object.entries(forbiddenFields)) {
    assert.throws(
      () => normalizeWorkerPaymentReceiptPdfDto({ ...receiptFixture(), [field]: value }),
      /DTO is invalid/,
      field,
    );
  }
});

test("PDF DTO rejects malformed chronology, enums, references and integrity hashes", () => {
  for (const invalid of [
    receiptFixture({ reference: "../raw-bank-value" }),
    receiptFixture({ receivedAt: "2026-07-30 04:12:00Z" }),
    receiptFixture({ issuedAt: "2026-07-30T04:11:59.000Z" }),
    receiptFixture({ paymentPurpose: "LOAN" }),
    receiptFixture({ destinationType: "CUIL" }),
    receiptFixture({ status: "PAID" }),
    receiptFixture({ integritySha256: "A".repeat(64) }),
    { ...receiptFixture(), extra: "forbidden" },
  ]) {
    assert.throws(() => normalizeWorkerPaymentReceiptPdfDto(invalid), /DTO is invalid/);
  }
});

test("rendered layout visibly uses the safe fields, integrity hash and complete disclaimer", () => {
  assert.match(source, /Destino de cobro recibido/);
  assert.match(source, /Recibido para revisión/);
  assert.match(source, /value\.maskedReference \|\| "No exhibida por seguridad"/);
  assert.match(source, /page\.drawText\(value\.integritySha256/);
  assert.match(source, /wrapText\(WORKER_PAYMENT_RECEIPT_DISCLAIMER/);
  assert.match(source, /No contiene el CBU, CVU o alias completo/);
  assert.doesNotMatch(source, /destinationValue|holderName|cuil|encryptedPayload|tokenSha256/);
});
