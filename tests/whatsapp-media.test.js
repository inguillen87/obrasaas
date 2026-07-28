import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  ingestAndPersistInboundWhatsAppMedia,
  ingestInboundWhatsAppMedia,
  isEnrichedInboundWhatsAppMediaEvent,
  whatsAppMediaUploadIdempotencyKey,
} from "../src/lib/whatsapp/media.js";
import { downloadWhatsAppMedia } from "../src/lib/whatsapp/meta.js";

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
  let uploadOptions;
  const event = await ingestInboundWhatsAppMedia(baseEvent, {
    transcriptionEnabled: true,
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
      uploadOptions = options;
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
  assert.match(uploadOptions.idempotencyKey, /^whatsapp-media:v1:[a-f0-9]{64}$/);
  assert.equal(event.media.storage.status, "stored");
  assert.equal(event.media.storage.assetId, "asset-1");
  assert.equal(event.transcription.status, "completed");
  assert.equal(isEnrichedInboundWhatsAppMediaEvent(event), true);
  assert.equal(event.text, "Hay una demora con el hormigón.");
});

test("Meta Base64 media integrity becomes canonical hex before durable ingestion", async () => {
  const content = Buffer.from("realistic jpeg bytes from Meta");
  const providerSha256 = crypto.createHash("sha256").update(content).digest("base64");
  const canonicalSha256 = crypto.createHash("sha256").update(content).digest("hex");
  const inbound = {
    ...baseEvent,
    externalId: "wamid.image-1",
    kind: "image",
    text: "Pared norte a medio terminar",
    media: {
      ...baseEvent.media,
      id: "223456789012345",
      mimeType: "image/jpeg",
      filename: "pared-norte.jpg",
      sha256: providerSha256,
    },
  };
  const fetchImpl = async (input) => {
    const url = new URL(input);
    if (url.hostname === "graph.facebook.com") {
      return Response.json({
        id: inbound.media.id,
        url: "https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=223",
        mime_type: inbound.media.mimeType,
        sha256: providerSha256,
        file_size: content.length,
      });
    }
    return new Response(content, {
      status: 200,
      headers: { "content-type": inbound.media.mimeType },
    });
  };

  const event = await ingestInboundWhatsAppMedia(inbound, {
    storageConfigured: () => true,
    download: (options) => downloadWhatsAppMedia({
      ...options,
      fetchImpl,
      credentials: {
        version: "v25.0",
        accessToken: "test-access-token",
        phoneNumberId: inbound.phoneNumberId,
        appSecret: "test-app-secret",
      },
    }),
    upload: async (file, options) => {
      assert.equal(Buffer.from(await file.arrayBuffer()).compare(content), 0);
      assert.match(options.idempotencyKey, /^whatsapp-media:v1:[a-f0-9]{64}$/);
      return {
        provider: "cloudinary",
        assetId: "asset-image-1",
        publicId: "tenant/image-1",
        resourceType: "image",
        format: "jpg",
        bytes: content.length,
        secureUrl: "https://res.cloudinary.com/obrasaas/authenticated/image-1.jpg",
      };
    },
  });

  assert.equal(event.media.sha256, canonicalSha256);
  assert.notEqual(event.media.sha256, providerSha256);
  assert.match(event.media.sha256, /^[a-f0-9]{64}$/);
  assert.equal(isEnrichedInboundWhatsAppMediaEvent(event), true);
});

test("enriched WhatsApp media is reused without another download, upload or transcription", async () => {
  const enriched = {
    ...baseEvent,
    text: "Avance confirmado.",
    transcription: {
      status: "completed",
      provider: "openai",
      model: "gpt-4o-transcribe",
      text: "Avance confirmado.",
    },
    media: {
      ...baseEvent.media,
      filename: "123456789012345.ogg",
      sha256: "verified-sha",
      size: 5,
      url: "https://blob.example/private/audio.ogg",
      storage: {
        provider: "vercel-blob",
        status: "stored",
        assetId: "https://blob.example/private/audio.ogg",
        pathname: "obrasaas/whatsapp/audio.ogg",
      },
    },
  };
  const mustNotRun = async () => assert.fail("enriched media must not be processed again");
  const result = await ingestInboundWhatsAppMedia(enriched, {
    storageConfigured: () => assert.fail("stored media does not require current provider config"),
    aiConfigured: () => assert.fail("stored transcription does not require current AI config"),
    download: mustNotRun,
    upload: mustNotRun,
    transcribe: mustNotRun,
  });

  assert.equal(result, enriched);
});

test("WhatsApp media upload identity is stable per verified provider object and tenant phone", () => {
  const downloaded = {
    sha256: "verified-sha",
    size: 5,
    mimeType: "audio/ogg",
  };
  const first = whatsAppMediaUploadIdempotencyKey(baseEvent, downloaded);
  assert.equal(first, whatsAppMediaUploadIdempotencyKey(baseEvent, downloaded));
  assert.notEqual(
    first,
    whatsAppMediaUploadIdempotencyKey(
      { ...baseEvent, phoneNumberId: "111111111111111" },
      downloaded,
    ),
  );
  assert.notEqual(
    first,
    whatsAppMediaUploadIdempotencyKey(baseEvent, { ...downloaded, sha256: "other-sha" }),
  );
});

test("audio is stored but never sent to OpenAI before tenant activation", async () => {
  let aiConfigurationChecked = false;
  let transcribeCalled = false;
  const event = await ingestInboundWhatsAppMedia(baseEvent, {
    storageConfigured: () => true,
    aiConfigured: () => {
      aiConfigurationChecked = true;
      return true;
    },
    download: async () => ({
      id: "123456789012345",
      buffer: Buffer.from("voice"),
      kind: "audio",
      mimeType: "audio/ogg",
      size: 5,
      sha256: "verified-sha",
    }),
    upload: async () => ({
      assetId: "asset-disabled",
      provider: "vercel-blob",
      bytes: 5,
      secureUrl: "https://blob.example/private/audio-disabled.ogg",
    }),
    transcribe: async () => {
      transcribeCalled = true;
    },
  });

  assert.equal(event.media.storage.status, "stored");
  assert.deepEqual(event.transcription, {
    status: "disabled_by_tenant",
    provider: "openai",
    text: null,
  });
  assert.equal(aiConfigurationChecked, false);
  assert.equal(transcribeCalled, false);
  assert.equal(isEnrichedInboundWhatsAppMediaEvent(event), true);
});

test("audio revalidates the subscription immediately before OpenAI transcription", async () => {
  const calls = [];
  const subscriptionError = Object.assign(new Error("subscription blocked"), {
    code: "WEBHOOK_SUBSCRIPTION_BLOCKED",
  });

  await assert.rejects(
    ingestInboundWhatsAppMedia(baseEvent, {
      transcriptionEnabled: true,
      storageConfigured: () => true,
      aiConfigured: () => true,
      download: async () => {
        calls.push("download");
        return {
          id: "123456789012345",
          buffer: Buffer.from("voice"),
          kind: "audio",
          mimeType: "audio/ogg",
          size: 5,
          sha256: "verified-sha",
        };
      },
      upload: async () => {
        calls.push("upload");
        return {
          assetId: "asset-before-transcription-fence",
          provider: "vercel-blob",
          bytes: 5,
          secureUrl: "https://blob.example/private/audio-fenced.ogg",
        };
      },
      beforeTranscribe: async () => {
        calls.push("subscription-fence");
        throw subscriptionError;
      },
      transcribe: async () => {
        calls.push("transcribe");
        return { provider: "openai", text: "must not exist" };
      },
    }),
    (error) => error === subscriptionError,
  );

  assert.deepEqual(calls, ["download", "upload", "subscription-fence"]);
});

test("freshly enriched webhook media is persisted under the active lease before application", async () => {
  const calls = [];
  const enriched = {
    ...baseEvent,
    text: "Avance confirmado.",
    transcription: { status: "completed", text: "Avance confirmado." },
    media: {
      ...baseEvent.media,
      filename: "123456789012345.ogg",
      sha256: "verified-sha",
      size: 5,
      url: "https://blob.example/private/audio.ogg",
      storage: {
        provider: "vercel-blob",
        status: "stored",
        assetId: "https://blob.example/private/audio.ogg",
      },
    },
  };
  const result = await ingestAndPersistInboundWhatsAppMedia({
    leasedEvent: { id: "webhook-1", leaseToken: "lease-1" },
    event: baseEvent,
    scope: { projectId: "project-1", organizationId: "org-1" },
  }, {
    ingest: async () => {
      calls.push("ingest");
      return enriched;
    },
    persist: async (input) => {
      calls.push("persist");
      assert.deepEqual(input, {
        eventId: "webhook-1",
        leaseToken: "lease-1",
        event: enriched,
        scope: { projectId: "project-1", organizationId: "org-1" },
      });
    },
  });

  assert.equal(result, enriched);
  assert.deepEqual(calls, ["ingest", "persist"]);
});

test("managed webhook media commits intent, provider result and durable payload in order", async () => {
  const calls = [];
  const managedEvent = {
    ...baseEvent,
    externalId: "wamid.managed-image-1",
    kind: "image",
    media: {
      ...baseEvent.media,
      id: "managed-image-1",
      mimeType: "image/jpeg",
      filename: "pared.jpg",
    },
  };
  const pathname = "obrasaas/projects/project-1/whatsapp/987654321098765/managed-image.jpg";
  const storage = {
    provider: "vercel-blob",
    assetId: `https://tenant.private.blob.vercel-storage.com/${pathname}`,
    publicId: pathname,
    pathname,
    resourceType: "image",
    format: "jpg",
    bytes: 5,
    reused: false,
  };
  const result = await ingestAndPersistInboundWhatsAppMedia({
    leasedEvent: { id: "webhook-managed-1", leaseToken: "lease-managed-1" },
    event: managedEvent,
    scope: { projectId: "project-1", organizationId: "org-1" },
  }, {
    ingest: (event, options) => ingestInboundWhatsAppMedia(event, {
      ...options,
      prisma: { source: "managed-test" },
      storageConfigured: () => true,
      download: async () => ({
        id: managedEvent.media.id,
        buffer: Buffer.from("photo"),
        kind: "image",
        mimeType: "image/jpeg",
        size: 5,
        sha256: "a".repeat(64),
      }),
      createMediaAssetIntent: async (_prisma, input) => {
        calls.push("intent");
        assert.equal(input.webhookEventId, "webhook-managed-1");
        assert.equal(input.webhookLeaseToken, "lease-managed-1");
        return {
          mediaAssetId: "asset-ledger-1",
          status: "UPLOADING",
          dispatch: true,
          uploadLeaseToken: "upload-lease-1",
          upload: { options: { provider: "vercel-blob", idempotencyKey: "managed-key" } },
        };
      },
      upload: async (_file, options) => {
        calls.push("upload");
        assert.equal(options.idempotencyKey, "managed-key");
        return { ...storage, secureUrl: storage.assetId };
      },
      finalizeMediaAsset: async () => {
        calls.push("finalize");
        return {
          mediaAssetId: "asset-ledger-1",
          status: "AVAILABLE",
          descriptor: {
            assetId: "asset-ledger-1",
            provider: "vercel-blob",
            storage,
            url: storage.assetId,
            visibility: "private",
            mimeType: "image/jpeg",
            filename: "pared.jpg",
            size: 5,
            sha256: "a".repeat(64),
          },
        };
      },
    }),
    persist: async ({ event }) => {
      calls.push("persist");
      assert.equal(event.media.assetId, "asset-ledger-1");
      assert.equal(event.media.storage.ledgerAssetId, "asset-ledger-1");
      assert.equal(isEnrichedInboundWhatsAppMediaEvent(event), true);
    },
  });

  assert.equal(result.media.assetId, "asset-ledger-1");
  assert.deepEqual(calls, ["intent", "upload", "finalize", "persist"]);
});

test("already-enriched webhook media does not perform a redundant durable payload write", async () => {
  const enriched = {
    ...baseEvent,
    transcription: { status: "failed", provider: "openai", text: null },
    media: {
      ...baseEvent.media,
      filename: "123456789012345.ogg",
      sha256: "verified-sha",
      size: 5,
      url: "https://blob.example/private/audio.ogg",
      storage: {
        provider: "vercel-blob",
        status: "stored",
        pathname: "obrasaas/whatsapp/audio.ogg",
      },
    },
  };
  let persistCalled = false;
  const result = await ingestAndPersistInboundWhatsAppMedia({
    leasedEvent: { id: "webhook-1", leaseToken: "lease-1" },
    event: enriched,
    scope: { projectId: "project-1", organizationId: "org-1" },
  }, {
    ingest: async (event) => event,
    persist: async () => {
      persistCalled = true;
    },
  });

  assert.equal(result, enriched);
  assert.equal(persistCalled, false);
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
    transcriptionEnabled: true,
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
