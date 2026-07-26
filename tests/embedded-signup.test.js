import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDisabledWhatsAppConnectionData,
  completeEmbeddedSignup,
  createAppSecretProof,
  isMetaAppSubscribed,
  isValidMetaResourceId,
  isValidRegistrationPin,
  mergeWhatsAppConnectionMetadata,
  missingRequiredMetaScopes,
  preparePilotWhatsAppCredential,
  verifyConnectedWhatsAppAccount,
  whatsAppConnectionIdentityChanged,
} from "../src/lib/whatsapp/embedded-signup.js";

test("Embedded Signup validates Meta resource IDs and six-digit PINs", () => {
  assert.equal(isValidMetaResourceId("1556998679107747"), true);
  assert.equal(isValidMetaResourceId("other-app"), false);
  assert.equal(isValidRegistrationPin("731902"), true);
  assert.equal(isValidRegistrationPin("12345"), false);
});

test("appsecret proof is deterministic and token-bound", () => {
  const proof = createAppSecretProof("tenant-token", "app-secret");
  assert.equal(proof.length, 64);
  assert.notEqual(proof, createAppSecretProof("other-token", "app-secret"));
});

test("Meta readiness requires both operational scopes and recognizes nested subscriptions", () => {
  assert.deepEqual(
    missingRequiredMetaScopes(["whatsapp_business_management"]),
    ["whatsapp_business_messaging"],
  );
  assert.deepEqual(
    missingRequiredMetaScopes([
      "whatsapp_business_management",
      "whatsapp_business_messaging",
    ]),
    [],
  );
  assert.equal(
    isMetaAppSubscribed(
      {
        data: [{ whatsapp_business_api_data: { id: "1665088767899217" } }],
      },
      "1665088767899217",
    ),
    true,
  );
  assert.equal(
    isMetaAppSubscribed({ data: [{ id: "other-app" }] }, "1665088767899217"),
    false,
  );
});

test("Embedded Signup refresh preserves Flow and endpoint provisioning metadata", () => {
  const identity = {
    phoneNumberId: "987654321",
    whatsappBusinessId: "123456789",
  };
  const existing = {
    whatsappFlows: { "incident-report": { id: "12345", status: "PUBLISHED" } },
    whatsappFlowDrafts: { "incident-report": { id: "67890", status: "DRAFT" } },
    whatsappFlowEndpoint: { id: "endpoint-a", keyFingerprint: "abc" },
    tokenType: "old",
  };
  const identityChanged = whatsAppConnectionIdentityChanged(identity, {
    ...identity,
  });
  assert.equal(identityChanged, false);
  assert.deepEqual(
    mergeWhatsAppConnectionMetadata(
      existing,
      {
        tokenType: "bearer",
        scopes: ["whatsapp_business_management"],
      },
      { identityChanged },
    ),
    {
      ...existing,
      tokenType: "bearer",
      scopes: ["whatsapp_business_management"],
    },
  );
});

test("Embedded Signup identity changes clear every Flow binding and stale provisioning lease", () => {
  const previousIdentity = {
    phoneNumberId: "987654321",
    whatsappBusinessId: "123456789",
  };
  const nextIdentity = {
    phoneNumberId: "987654322",
    whatsappBusinessId: "123456780",
  };
  const identityChanged = whatsAppConnectionIdentityChanged(
    previousIdentity,
    nextIdentity,
  );
  assert.equal(identityChanged, true);
  assert.equal(whatsAppConnectionIdentityChanged(null, nextIdentity), false);

  const merged = mergeWhatsAppConnectionMetadata(
    {
      whatsappFlows: {
        "incident-report": { id: "12345", status: "PUBLISHED" },
      },
      whatsappFlowDrafts: {
        "incident-report": { id: "67890", status: "DRAFT" },
      },
      whatsappFlowEndpoint: { id: "endpoint-a", keyFingerprint: "abc" },
      whatsappFlowProvisioningLease: { id: "stale-lease" },
      unrelated: { preserved: true },
    },
    {
      tokenType: "bearer",
      whatsappFlows: { attacker: { id: "99999" } },
    },
    { identityChanged },
  );

  for (const key of [
    "whatsappFlows",
    "whatsappFlowDrafts",
    "whatsappFlowEndpoint",
    "whatsappFlowProvisioningLease",
  ]) {
    assert.equal(Object.hasOwn(merged, key), false);
  }
  assert.equal(merged.unrelated.preserved, true);
  assert.equal(merged.tokenType, "bearer");
});

test("Embedded Signup exchanges code, validates ownership, subscribes, and registers", async () => {
  const previousAppId = process.env.NEXT_PUBLIC_META_APP_ID;
  const previousSecret = process.env.META_APP_SECRET;
  process.env.NEXT_PUBLIC_META_APP_ID = "1665088767899217";
  process.env.META_APP_SECRET = "unit-test-secret";
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const parsed = new URL(url);
    calls.push({
      path: parsed.pathname,
      search: parsed.search,
      method: options.method || "GET",
      body: options.body,
    });
    if (parsed.pathname.endsWith("/oauth/access_token")) {
      return Response.json({
        access_token: "tenant-token",
        token_type: "bearer",
      });
    }
    if (parsed.pathname.endsWith("/debug_token")) {
      return Response.json({
        data: {
          is_valid: true,
          app_id: "1665088767899217",
          scopes: [
            "whatsapp_business_management",
            "whatsapp_business_messaging",
          ],
        },
      });
    }
    if (parsed.pathname.endsWith("/123456789/phone_numbers")) {
      return Response.json({
        data: [
          {
            id: "987654321",
            display_phone_number: "+54 9 11 5555 5555",
            verified_name: "Constructora Sur",
            quality_rating: "GREEN",
            code_verification_status: "VERIFIED",
            status: "CONNECTED",
          },
        ],
      });
    }
    if (
      parsed.pathname.endsWith("/123456789/subscribed_apps") &&
      (options.method || "GET") === "GET"
    ) {
      return Response.json({
        data: [
          {
            whatsapp_business_api_data: {
              id: "1665088767899217",
              name: "ObraSaaS",
            },
          },
        ],
      });
    }
    return Response.json({ success: true });
  };

  try {
    const result = await completeEmbeddedSignup({
      code: "short-lived-code",
      whatsappBusinessId: "123456789",
      phoneNumberId: "987654321",
      registrationPin: "731902",
      fetchImpl,
    });
    assert.equal(result.accessToken, "tenant-token");
    assert.equal(result.verifiedBusinessName, "Constructora Sur");
    assert.equal(result.subscribed, true);
    assert.equal(result.phoneStatus, "CONNECTED");
    assert.match(calls[2].search, /limit=100/);
    assert.deepEqual(
      calls.map(({ path, method }) => [path, method]),
      [
        ["/v25.0/oauth/access_token", "GET"],
        ["/v25.0/debug_token", "GET"],
        ["/v25.0/123456789/phone_numbers", "GET"],
        ["/v25.0/123456789/subscribed_apps", "POST"],
        ["/v25.0/123456789/subscribed_apps", "GET"],
        ["/v25.0/987654321/register", "POST"],
        ["/v25.0/123456789/phone_numbers", "GET"],
      ],
    );
  } finally {
    if (previousAppId === undefined) delete process.env.NEXT_PUBLIC_META_APP_ID;
    else process.env.NEXT_PUBLIC_META_APP_ID = previousAppId;
    if (previousSecret === undefined) delete process.env.META_APP_SECRET;
    else process.env.META_APP_SECRET = previousSecret;
  }
});

test("Embedded Signup rejects a token that cannot send WhatsApp messages", async () => {
  const previousAppId = process.env.NEXT_PUBLIC_META_APP_ID;
  const previousSecret = process.env.META_APP_SECRET;
  process.env.NEXT_PUBLIC_META_APP_ID = "1665088767899217";
  process.env.META_APP_SECRET = "unit-test-secret";
  try {
    await assert.rejects(
      completeEmbeddedSignup({
        code: "short-lived-code",
        whatsappBusinessId: "123456789",
        phoneNumberId: "987654321",
        registrationPin: "731902",
        fetchImpl: async (url) => {
          const path = new URL(url).pathname;
          if (path.endsWith("/oauth/access_token"))
            return Response.json({ access_token: "tenant-token" });
          return Response.json({
            data: {
              is_valid: true,
              app_id: "1665088767899217",
              scopes: ["whatsapp_business_management"],
            },
          });
        },
      }),
      (error) =>
        error.code === "META_SCOPES_INCOMPLETE" && error.status === 403,
    );
  } finally {
    if (previousAppId === undefined) delete process.env.NEXT_PUBLIC_META_APP_ID;
    else process.env.NEXT_PUBLIC_META_APP_ID = previousAppId;
    if (previousSecret === undefined) delete process.env.META_APP_SECRET;
    else process.env.META_APP_SECRET = previousSecret;
  }
});

test("connected account verification is read-only and fails closed when the app is unsubscribed", async () => {
  const previousAppId = process.env.NEXT_PUBLIC_META_APP_ID;
  const previousSecret = process.env.META_APP_SECRET;
  process.env.NEXT_PUBLIC_META_APP_ID = "1665088767899217";
  process.env.META_APP_SECRET = "unit-test-secret";
  const methods = [];
  try {
    await assert.rejects(
      verifyConnectedWhatsAppAccount({
        accessToken: "tenant-token",
        whatsappBusinessId: "123456789",
        phoneNumberId: "987654321",
        fetchImpl: async (url, options = {}) => {
          const path = new URL(url).pathname;
          methods.push(options.method || "GET");
          if (path.endsWith("/debug_token"))
            return Response.json({
              data: {
                is_valid: true,
                app_id: "1665088767899217",
                scopes: [
                  "whatsapp_business_management",
                  "whatsapp_business_messaging",
                ],
              },
            });
          if (path.endsWith("/phone_numbers"))
            return Response.json({ data: [{ id: "987654321" }] });
          return Response.json({ data: [] });
        },
      }),
      (error) =>
        error.code === "META_APP_NOT_SUBSCRIBED" && error.status === 409,
    );
    assert.deepEqual(methods, ["GET", "GET", "GET"]);
  } finally {
    if (previousAppId === undefined) delete process.env.NEXT_PUBLIC_META_APP_ID;
    else process.env.NEXT_PUBLIC_META_APP_ID = previousAppId;
    if (previousSecret === undefined) delete process.env.META_APP_SECRET;
    else process.env.META_APP_SECRET = previousSecret;
  }
});

test("Embedded Signup refresh invalidates a stale pilot replay marker", () => {
  const operation = {
    operationKeyHash: "a".repeat(64),
    requestFingerprint: "b".repeat(64),
  };
  const merged = mergeWhatsAppConnectionMetadata(
    {
      pilotImportReservation: {
        version: 2,
        registrationPinEscrow: "encrypted-pin-candidate",
      },
      pilotImport: {
        version: 1,
        currentOperationKeyHash: operation.operationKeyHash,
        operations: [operation],
      },
    },
    { tokenType: "bearer" },
  );
  assert.equal(Object.hasOwn(merged, "pilotImportReservation"), false);
  assert.equal(
    Object.hasOwn(merged.pilotImport, "currentOperationKeyHash"),
    false,
  );
  assert.deepEqual(merged.pilotImport.operations, [operation]);
});

test("disconnect removes every credential and unfinished pilot PIN escrow", () => {
  const disabled = buildDisabledWhatsAppConnectionData({
    metadata: {
      pilotImportReservation: {
        version: 2,
        remoteAttemptedAt: "2026-07-26T12:00:00.000Z",
        registrationPinEscrow: "encrypted-pin-candidate",
      },
      pilotImport: {
        version: 1,
        currentOperationKeyHash: "a".repeat(64),
        operations: [
          {
            operationKeyHash: "a".repeat(64),
            requestFingerprint: "b".repeat(64),
          },
        ],
      },
      whatsappFlows: { attendance: { id: "owned-flow" } },
    },
  });

  assert.equal(disabled.enabled, false);
  assert.equal(disabled.connectionStatus, "DISABLED");
  assert.equal(disabled.encryptedAccessToken, null);
  assert.equal(disabled.encryptedPin, null);
  assert.equal(disabled.tokenLastFour, null);
  assert.equal(
    Object.hasOwn(disabled.metadata, "pilotImportReservation"),
    false,
  );
  assert.equal(
    Object.hasOwn(disabled.metadata.pilotImport, "currentOperationKeyHash"),
    false,
  );
  assert.equal(disabled.metadata.whatsappFlows.attendance.id, "owned-flow");
});

test("pilot credential validation subscribes a registered phone without returning or registering the token", async () => {
  const previousAppId = process.env.NEXT_PUBLIC_META_APP_ID;
  const previousSecret = process.env.META_APP_SECRET;
  process.env.NEXT_PUBLIC_META_APP_ID = "1665088767899217";
  process.env.META_APP_SECRET = "unit-test-secret";
  const now = new Date("2026-07-26T12:00:00.000Z");
  const calls = [];
  let mutationFenceCalls = 0;
  try {
    const result = await preparePilotWhatsAppCredential({
      accessToken: "temporary-pilot-token-value",
      whatsappBusinessId: "123456789",
      phoneNumberId: "987654321",
      now,
      beforeRemoteMutation: async ({ registrationRequired }) => {
        assert.equal(registrationRequired, false);
        assert.deepEqual(calls, [
          ["/v25.0/debug_token", "GET"],
          ["/v25.0/123456789/phone_numbers", "GET"],
        ]);
        mutationFenceCalls += 1;
      },
      fetchImpl: async (url, options = {}) => {
        const path = new URL(url).pathname;
        calls.push([path, options.method || "GET"]);
        if ((options.method || "GET") === "POST") {
          assert.equal(mutationFenceCalls, 1);
        }
        if (path.endsWith("/debug_token"))
          return Response.json({
            data: {
              is_valid: true,
              app_id: "1665088767899217",
              expires_at: Math.floor(now.getTime() / 1_000) + 3_600,
              scopes: [
                "whatsapp_business_management",
                "whatsapp_business_messaging",
              ],
            },
          });
        if (path.endsWith("/phone_numbers"))
          return Response.json({
            data: [
              {
                id: "987654321",
                status: "CONNECTED",
                code_verification_status: "VERIFIED",
                display_phone_number: "+54 9 11 5555 5555",
              },
            ],
          });
        if (
          path.endsWith("/subscribed_apps") &&
          (options.method || "GET") === "GET"
        ) {
          return Response.json({ data: [{ app_id: "1665088767899217" }] });
        }
        return Response.json({ success: true });
      },
    });
    assert.equal(result.registrationPerformed, false);
    assert.equal(mutationFenceCalls, 1);
    assert.equal(result.expiresAt, Math.floor(now.getTime() / 1_000) + 3_600);
    assert.equal(Object.hasOwn(result, "accessToken"), false);
    assert.deepEqual(calls, [
      ["/v25.0/debug_token", "GET"],
      ["/v25.0/123456789/phone_numbers", "GET"],
      ["/v25.0/123456789/subscribed_apps", "POST"],
      ["/v25.0/123456789/subscribed_apps", "GET"],
    ]);
  } finally {
    if (previousAppId === undefined) delete process.env.NEXT_PUBLIC_META_APP_ID;
    else process.env.NEXT_PUBLIC_META_APP_ID = previousAppId;
    if (previousSecret === undefined) delete process.env.META_APP_SECRET;
    else process.env.META_APP_SECRET = previousSecret;
  }
});

test("pilot credential validation rejects expiry at the exact boundary before reading the WABA", async () => {
  const previousAppId = process.env.NEXT_PUBLIC_META_APP_ID;
  const previousSecret = process.env.META_APP_SECRET;
  process.env.NEXT_PUBLIC_META_APP_ID = "1665088767899217";
  process.env.META_APP_SECRET = "unit-test-secret";
  const now = new Date("2026-07-26T12:00:00.000Z");
  let calls = 0;
  try {
    await assert.rejects(
      preparePilotWhatsAppCredential({
        accessToken: "temporary-expired-token",
        whatsappBusinessId: "123456789",
        phoneNumberId: "987654321",
        now,
        fetchImpl: async () => {
          calls += 1;
          return Response.json({
            data: {
              is_valid: true,
              app_id: "1665088767899217",
              expires_at: Math.floor(now.getTime() / 1_000),
              scopes: [
                "whatsapp_business_management",
                "whatsapp_business_messaging",
              ],
            },
          });
        },
      }),
      (error) =>
        error.code === "META_PILOT_TOKEN_EXPIRED" && error.status === 403,
    );
    assert.equal(calls, 1);
  } finally {
    if (previousAppId === undefined) delete process.env.NEXT_PUBLIC_META_APP_ID;
    else process.env.NEXT_PUBLIC_META_APP_ID = previousAppId;
    if (previousSecret === undefined) delete process.env.META_APP_SECRET;
    else process.env.META_APP_SECRET = previousSecret;
  }
});

test("pilot credential validation requires five minutes of TTL and reuses one Graph deadline", async () => {
  const previousAppId = process.env.NEXT_PUBLIC_META_APP_ID;
  const previousSecret = process.env.META_APP_SECRET;
  process.env.NEXT_PUBLIC_META_APP_ID = "1665088767899217";
  process.env.META_APP_SECRET = "unit-test-secret";
  const now = new Date("2026-07-26T12:00:00.000Z");
  const nowSeconds = Math.floor(now.getTime() / 1_000);
  try {
    let belowLimitCalls = 0;
    await assert.rejects(
      preparePilotWhatsAppCredential({
        accessToken: "temporary-short-lived-token",
        whatsappBusinessId: "123456789",
        phoneNumberId: "987654321",
        now,
        fetchImpl: async () => {
          belowLimitCalls += 1;
          return Response.json({
            data: {
              is_valid: true,
              app_id: "1665088767899217",
              expires_at: nowSeconds + 299,
              scopes: [
                "whatsapp_business_management",
                "whatsapp_business_messaging",
              ],
            },
          });
        },
      }),
      (error) =>
        error.code === "META_PILOT_TOKEN_TTL_INSUFFICIENT" &&
        error.status === 403,
    );
    assert.equal(belowLimitCalls, 1);

    const signals = [];
    const result = await preparePilotWhatsAppCredential({
      accessToken: "temporary-boundary-ttl-token",
      whatsappBusinessId: "123456789",
      phoneNumberId: "987654321",
      now,
      fetchImpl: async (url, options = {}) => {
        const path = new URL(url).pathname;
        signals.push(options.signal);
        if (path.endsWith("/debug_token"))
          return Response.json({
            data: {
              is_valid: true,
              app_id: "1665088767899217",
              expires_at: nowSeconds + 300,
              scopes: [
                "whatsapp_business_management",
                "whatsapp_business_messaging",
              ],
            },
          });
        if (path.endsWith("/phone_numbers"))
          return Response.json({
            data: [
              {
                id: "987654321",
                status: "CONNECTED",
                code_verification_status: "VERIFIED",
              },
            ],
          });
        if (
          path.endsWith("/subscribed_apps") &&
          (options.method || "GET") === "GET"
        ) {
          return Response.json({ data: [{ id: "1665088767899217" }] });
        }
        return Response.json({ success: true });
      },
    });
    assert.equal(result.expiresAt, nowSeconds + 300);
    assert.equal(signals.length, 4);
    assert.ok(signals[0] instanceof AbortSignal);
    assert.ok(signals.every((signal) => signal === signals[0]));
  } finally {
    if (previousAppId === undefined) delete process.env.NEXT_PUBLIC_META_APP_ID;
    else process.env.NEXT_PUBLIC_META_APP_ID = previousAppId;
    if (previousSecret === undefined) delete process.env.META_APP_SECRET;
    else process.env.META_APP_SECRET = previousSecret;
  }
});

test("pilot credential validation maps aborts and network failures without leaking provider errors", async () => {
  const previousAppId = process.env.NEXT_PUBLIC_META_APP_ID;
  const previousSecret = process.env.META_APP_SECRET;
  process.env.NEXT_PUBLIC_META_APP_ID = "1665088767899217";
  process.env.META_APP_SECRET = "unit-test-secret";
  const accessToken = "temporary-network-sensitive-token";
  try {
    for (const scenario of [
      { name: "AbortError", code: "META_GRAPH_TIMEOUT" },
      { name: "TypeError", code: "META_GRAPH_NETWORK_ERROR" },
    ]) {
      await assert.rejects(
        preparePilotWhatsAppCredential({
          accessToken,
          whatsappBusinessId: "123456789",
          phoneNumberId: "987654321",
          fetchImpl: async () => {
            const error = new Error(
              `unsafe provider failure containing ${accessToken}`,
            );
            error.name = scenario.name;
            throw error;
          },
        }),
        (error) =>
          error.code === scenario.code &&
          error.status === 502 &&
          !error.message.includes(accessToken) &&
          error.name === "MetaIntegrationError",
      );
    }
  } finally {
    if (previousAppId === undefined) delete process.env.NEXT_PUBLIC_META_APP_ID;
    else process.env.NEXT_PUBLIC_META_APP_ID = previousAppId;
    if (previousSecret === undefined) delete process.env.META_APP_SECRET;
    else process.env.META_APP_SECRET = previousSecret;
  }
});

test("pilot credential validation registers only when Meta explicitly requires a PIN", async () => {
  const previousAppId = process.env.NEXT_PUBLIC_META_APP_ID;
  const previousSecret = process.env.META_APP_SECRET;
  process.env.NEXT_PUBLIC_META_APP_ID = "1665088767899217";
  process.env.META_APP_SECRET = "unit-test-secret";
  const now = new Date("2026-07-26T12:00:00.000Z");
  const calls = [];
  let phoneReads = 0;
  try {
    const result = await preparePilotWhatsAppCredential({
      accessToken: "temporary-registration-token",
      whatsappBusinessId: "123456789",
      phoneNumberId: "987654321",
      registrationPin: "731902",
      now,
      fetchImpl: async (url, options = {}) => {
        const path = new URL(url).pathname;
        calls.push({
          path,
          method: options.method || "GET",
          body: options.body,
        });
        if (path.endsWith("/debug_token"))
          return Response.json({
            data: {
              is_valid: true,
              app_id: "1665088767899217",
              expires_at: Math.floor(now.getTime() / 1_000) + 3_600,
              scopes: [
                "whatsapp_business_management",
                "whatsapp_business_messaging",
              ],
            },
          });
        if (path.endsWith("/phone_numbers")) {
          phoneReads += 1;
          return Response.json({
            data: [
              {
                id: "987654321",
                status: phoneReads === 1 ? "DISCONNECTED" : "CONNECTED",
                code_verification_status:
                  phoneReads === 1 ? "UNREGISTERED" : "VERIFIED",
              },
            ],
          });
        }
        if (
          path.endsWith("/subscribed_apps") &&
          (options.method || "GET") === "GET"
        ) {
          return Response.json({ data: [{ id: "1665088767899217" }] });
        }
        return Response.json({ success: true });
      },
    });
    assert.equal(result.registrationPerformed, true);
    const registration = calls.find(({ path }) =>
      path.endsWith("/987654321/register"),
    );
    assert.equal(registration.method, "POST");
    assert.deepEqual(JSON.parse(registration.body), {
      messaging_product: "whatsapp",
      pin: "731902",
    });
  } finally {
    if (previousAppId === undefined) delete process.env.NEXT_PUBLIC_META_APP_ID;
    else process.env.NEXT_PUBLIC_META_APP_ID = previousAppId;
    if (previousSecret === undefined) delete process.env.META_APP_SECRET;
    else process.env.META_APP_SECRET = previousSecret;
  }
});

test("pilot credential validation fails closed for missing expiry and safely recovers PIN retries", async () => {
  const previousAppId = process.env.NEXT_PUBLIC_META_APP_ID;
  const previousSecret = process.env.META_APP_SECRET;
  process.env.NEXT_PUBLIC_META_APP_ID = "1665088767899217";
  process.env.META_APP_SECRET = "unit-test-secret";
  const now = new Date("2026-07-26T12:00:00.000Z");
  const debug = (expiresAt) =>
    Response.json({
      data: {
        is_valid: true,
        app_id: "1665088767899217",
        expires_at: expiresAt,
        scopes: ["whatsapp_business_management", "whatsapp_business_messaging"],
      },
    });
  try {
    await assert.rejects(
      preparePilotWhatsAppCredential({
        accessToken: "temporary-no-expiry-token",
        whatsappBusinessId: "123456789",
        phoneNumberId: "987654321",
        now,
        fetchImpl: async () => debug(0),
      }),
      (error) => error.code === "META_PILOT_TOKEN_EXPIRY_REQUIRED",
    );

    for (const scenario of [
      {
        name: "unregistered phone without PIN",
        registrationPin: undefined,
        phone: {
          status: "DISCONNECTED",
          code_verification_status: "UNREGISTERED",
        },
        expectedCode: "META_PILOT_PIN_REQUIRED",
      },
    ]) {
      let calls = 0;
      await assert.rejects(
        preparePilotWhatsAppCredential({
          accessToken: "temporary-pin-policy-token",
          whatsappBusinessId: "123456789",
          phoneNumberId: "987654321",
          ...(scenario.registrationPin
            ? { registrationPin: scenario.registrationPin }
            : {}),
          now,
          fetchImpl: async (url) => {
            calls += 1;
            const path = new URL(url).pathname;
            if (path.endsWith("/debug_token")) {
              return debug(Math.floor(now.getTime() / 1_000) + 3_600);
            }
            return Response.json({
              data: [{ id: "987654321", ...scenario.phone }],
            });
          },
        }),
        (error) => error.code === scenario.expectedCode,
        scenario.name,
      );
      assert.equal(
        calls,
        2,
        `${scenario.name} must fail before subscribing or registering`,
      );
    }

    const calls = [];
    const recovered = await preparePilotWhatsAppCredential({
      accessToken: "temporary-pin-recovery-token",
      whatsappBusinessId: "123456789",
      phoneNumberId: "987654321",
      registrationPin: "731902",
      now,
      fetchImpl: async (url, options = {}) => {
        const path = new URL(url).pathname;
        calls.push([path, options.method || "GET"]);
        if (path.endsWith("/debug_token")) {
          return debug(Math.floor(now.getTime() / 1_000) + 3_600);
        }
        if (path.endsWith("/phone_numbers")) {
          return Response.json({
            data: [
              {
                id: "987654321",
                status: "CONNECTED",
                code_verification_status: "VERIFIED",
              },
            ],
          });
        }
        if (
          path.endsWith("/subscribed_apps") &&
          (options.method || "GET") === "GET"
        ) {
          return Response.json({ data: [{ id: "1665088767899217" }] });
        }
        return Response.json({ success: true });
      },
    });
    assert.equal(recovered.registrationPerformed, false);
    assert.equal(
      calls.some(([path]) => path.endsWith("/987654321/register")),
      false,
    );
  } finally {
    if (previousAppId === undefined) delete process.env.NEXT_PUBLIC_META_APP_ID;
    else process.env.NEXT_PUBLIC_META_APP_ID = previousAppId;
    if (previousSecret === undefined) delete process.env.META_APP_SECRET;
    else process.env.META_APP_SECRET = previousSecret;
  }
});
