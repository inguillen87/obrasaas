import assert from "node:assert/strict";
import test from "node:test";

import { protectedUploadPathname } from "../src/lib/storage.js";

test("protected storage uses a deterministic opaque pathname for an idempotent upload", () => {
  const options = {
    folder: "obrasaas/whatsapp/phone-1",
    fileName: "audio de obra.ogg",
    idempotencyKey: "tenant-sensitive-provider-identity",
  };
  const first = protectedUploadPathname(options);

  assert.equal(first, protectedUploadPathname(options));
  assert.match(first, /^obrasaas\/whatsapp\/phone-1\/[a-f0-9]{40}-audio-de-obra\.ogg$/);
  assert.doesNotMatch(first, /tenant-sensitive-provider-identity/);
  assert.notEqual(first, protectedUploadPathname({ ...options, idempotencyKey: "another-object" }));
});

test("protected storage keeps unique timestamped paths when no idempotency key is supplied", () => {
  assert.equal(
    protectedUploadPathname({
      folder: "obrasaas/protected",
      fileName: "evidence.pdf",
      now: 1_234,
    }),
    "obrasaas/protected/1234-evidence.pdf",
  );
});
