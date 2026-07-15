import test from "node:test";
import assert from "node:assert/strict";
import { ingestInboundWhatsAppMedia } from "../src/lib/whatsapp/media.js";

const baseEvent = {
  provider: "meta",
  eventType: "message",
  externalId: "wamid.audio-1",
  phoneNumberId: "987654321098765",
  from: "5491112345678",
  kind: "audio",
  text: "",
  media: {
    id: "123456789012345",
    mimeType: "audio/ogg",
    filename: null,
    sha256: "trusted-sha",
  },
};

test("WhatsApp media ingestion stores an authenticated asset and attaches its transcription", async () => {
  let uploadedFile;
  const event = await ingestInboundWhatsAppMedia(baseEvent, {
    storageConfigured: () => true,
    aiConfigured: () => true,
    download: async () => ({
      id: "123456789012345",
      buffer: Buffer.from("voice"),
      kind: "audio",
      mimeType: "audio/ogg",
      size: 5,
      sha256: "verified-sha",
    }),
    upload: async (file, options) => {
      uploadedFile = file;
      assert.match(options.folder, /^obrasaas\/whatsapp\//);
      assert.match(options.context, /message_id=wamid.audio-1/);
      return {
        assetId: "asset-1",
        publicId: "tenant/audio-1",
        resourceType: "video",
        format: "ogg",
        bytes: 5,
        secureUrl: "https://res.cloudinary.com/obrasaas/authenticated/audio-1.ogg",
      };
    },
    transcribe: async () => ({
      provider: "openai",
      model: "gpt-4o-transcribe",
      text: "Hay una demora con el hormigón.",
      requestId: "req-test",
    }),
  });

  assert.equal(uploadedFile.type, "audio/ogg");
  assert.equal(event.media.storage.status, "stored");
  assert.equal(event.media.storage.assetId, "asset-1");
  assert.equal(event.transcription.status, "completed");
  assert.equal(event.text, "Hay una demora con el hormigón.");
});

test("WhatsApp media ingestion fails closed when protected storage is unavailable", async () => {
  await assert.rejects(
    ingestInboundWhatsAppMedia(baseEvent, {
      storageConfigured: () => false,
    }),
    /storage is not configured/,
  );
});

test("WhatsApp AMR audio is stored and marked for conversion instead of being lost", async () => {
  let transcribeCalled = false;
  const event = await ingestInboundWhatsAppMedia({
    ...baseEvent,
    media: { ...baseEvent.media, mimeType: "audio/amr" },
  }, {
    storageConfigured: () => true,
    aiConfigured: () => true,
    download: async () => ({
      id: "123456789012345",
      buffer: Buffer.from("amr"),
      kind: "audio",
      mimeType: "audio/amr",
      size: 3,
      sha256: "verified-sha",
    }),
    upload: async () => ({
      assetId: "asset-amr",
      publicId: "tenant/audio-amr",
      resourceType: "video",
      format: "amr",
      bytes: 3,
      secureUrl: "https://res.cloudinary.com/obrasaas/authenticated/audio-amr.amr",
    }),
    transcribe: async () => {
      transcribeCalled = true;
    },
  });

  assert.equal(event.transcription.status, "pending_conversion");
  assert.equal(transcribeCalled, false);
});
