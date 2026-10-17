import {createHash} from 'node:crypto';

export const EXISTING_API_PLAN_CURRENT_SECTION='existingApiPlanCurrentRevision';
export const EXISTING_API_PLAN_CURRENT_HELPER='scripts/lib/meta-existing-api-plan-current-ci-lineage.mjs';
export const EXISTING_API_PLAN_CURRENT_TEST='tests/production-meta-existing-api-plan-current-ci-lineage.test.mjs';
export const EXISTING_API_PLAN_CURRENT_REVISION=Object.freeze({
  "version": 1,
  "status": "REVIEWED_LOCAL_PLAN_LIFECYCLE_ONLY",
  "predecessorCommit": "5d0c4303cbced786f2ec8a0a10edaa72b3aff02d",
  "previousContractSha256": "8ec3226f985366168e3a6eb873a6f282bfa91778260e15c724ee208814f88b09",
  "reviewedSourceChanges": [
    {
      "path": "scripts/verify-company-channel-ui.mjs",
      "previousSha256": "591f43f5792a4bde5a53962522ac54174c79460d602125f2f2187d44b1e13794",
      "currentSha256": "8fb58b5accb1f61f8862736f468a40bcd5e0b59be078f9468244dea6285095d6"
    },
    {
      "path": "scripts/verify-company-phone-ui.mjs",
      "previousSha256": "f58ad8c6c7bacd0d7143fe5c01879f014e688d323da3eb7627f7f79283286016",
      "currentSha256": "c849c112652722cef01e6f44bc0020b39e9110a7070964fbd557e8002b5cc8b2"
    },
    {
      "path": "scripts/verify-meta-customer-coexistence-postgres.mjs",
      "previousSha256": "a597518e9e0641c65badb5dad6d7189644b63a7001ad41846a200e55d126a695",
      "currentSha256": "20aae77b10b62c5bbdddb2d4568177bd51052a1272621ea78ecea6a3a1a8773e"
    },
    {
      "path": "scripts/verify-meta-customer-ui.mjs",
      "previousSha256": "98d7d101c93ba44eca90e9484bd88d60f44fcbb7aa8e761726d0a6c940fa7c3d",
      "currentSha256": "6451efa0544197692bc6f61fede28feb9ab88202e573f99ed4a5705b7fc948b5"
    },
    {
      "path": "scripts/verify-meta-development-pilot-ui.mjs",
      "previousSha256": "82db5869b600b66601e3c5730a2501c7440cb29e85ca7b33c44947112ba65570",
      "currentSha256": "24f07b42975e0208eafd05262dbcb0ce76f05c9be727d958512bc0bcaad49c87"
    },
    {
      "path": "src/app/(identity)/cuenta/meta-onboarding-panel.js",
      "previousSha256": "f23b5c77a6b658fcd72beaba79795772888f81b4701e8537a4424a04bb8519a7",
      "currentSha256": "6dd8eda06e40816270a707b01c71e468327c5659a480bce720d6db987893b57d"
    },
    {
      "path": "src/app/(identity)/cuenta/workspace-recovery-journal.mjs",
      "previousSha256": "a522852b7c82cd978a3f758137d8505c43b8d4edae269f215dda4ca51d787b2f",
      "currentSha256": "625c33c7b957dc922a5d9132fc0385c968dc573af4ff7a2f52a4fe111d0b42a2"
    },
    {
      "path": "src/lib/meta-customer-coexistence.mjs",
      "previousSha256": "68f1679940aadac13f06c4d2418695536ee96927324b8bc3e0edaa9882389b9f",
      "currentSha256": "30f5b950284b953fa853b37514cd768660cfc505a6e979ec51c947b6edce40da"
    },
    {
      "path": "src/lib/meta-customer-http.mjs",
      "previousSha256": "b07e3e839af1420215255a5834f87e83687ca118cbec0197a507413d727f7ec8",
      "currentSha256": "f279af2e6a104d3fa49e5a4c730d0f7c8d94b01315abc474f4c317051de96be1"
    },
    {
      "path": "src/lib/meta-customer-onboarding.mjs",
      "previousSha256": "aaed01d6fe8a0d2539f60bc51f0df85c2e5b0354aac0ccb964e2f2c295e0d79b",
      "currentSha256": "4f8cd0f93a731871444d3f6d5d2c39285c84641b1141bc83b708cec1483306d8"
    },
    {
      "path": "tests/production-field-video-audio-processing.test.mjs",
      "previousSha256": "2c0819d6d2f2f745ed3799a056ae1de8cda74519ede61ec66d80b5d1bb222dae",
      "currentSha256": "0cd556481ec95fd7bb32f0aeee203d81b69f3fb45683b882b9b9b53fa72eedb9"
    },
    {
      "path": "tests/production-integrated-identity-current-ci-lineage.test.mjs",
      "previousSha256": "b3400215a6a79397b80454ef5f6a052f6db3f11f7a94763ffa30a7eb93457d1e",
      "currentSha256": "287964d63ceb3ac3c96cf6a7cc3321575ea7e0fa95827e1440955b67fdc5b1a5"
    },
    {
      "path": "tests/production-kyc-reply-feedback-current-lineage.test.mjs",
      "previousSha256": "4f78c3c6f93460cb4764358c4fc2fee1480df851af6aea9d53037e6314bccde4",
      "currentSha256": "367cd32ed160358daeebb1f98040e174d5892efdda4ee5888252e45a6ec7cdb6"
    },
    {
      "path": "tests/production-material-review-current-ci-lineage.test.mjs",
      "previousSha256": "09507a383397841240acc1a800da5fda19f2bab4a6e9f803ec73c37aa307f9f5",
      "currentSha256": "38012a323a305bd8e41dcc04bc698b50dcac04110cec2cb7db93c8fa0f1e7ffa"
    },
    {
      "path": "tests/production-plan-measurement-current-ci-lineage.test.mjs",
      "previousSha256": "09719c4910dda130e3965a6d3a28cce56881963fbe40e1b5922006777494cc7e",
      "currentSha256": "4dfbc2f58044ddbcde52a00ae1017e810c1c9893c01164c90beb1b03c371aaf7"
    },
    {
      "path": "tests/production-whatsapp-feedback-workspace-ci.test.mjs",
      "previousSha256": "6ea3caa05bd7847b13c0d48cc4883e1bbe8cbba07e6f8849125d9544c509445a",
      "currentSha256": "6604b797f3466aad51028091fcddbcf3de1c86e9fec78b895c8156047d3f6c67"
    },
    {
      "path": "tests/production-whatsapp-field-continuity-current-ci-lineage.test.mjs",
      "previousSha256": "6e8a12fc32a3eb57f146d31788ff2a2c8396f72763953e7ee0d9e76a4c896c71",
      "currentSha256": "63d8b5b1c3e8f3f38add5c66b0901ea4477a7e7c9eb394ed6f02a4a4ee2b8acb"
    },
    {
      "path": "tests/production-workspace-continuity-current-ci-lineage.test.mjs",
      "previousSha256": "4d38db92300211adb8c02340c495ad5aed68d4ae326ffc3f5f6f8d3af2854eda",
      "currentSha256": "43f8948d518c55da5bef74e0c48b596847426cc973cc44dc96bdb0f777f43f3b"
    }
  ],
  "addedSources": [
    {
      "path": "src/app/(identity)/cuenta/meta-existing-api-plan-view.mjs",
      "sha256": "c44cbf28f4642b7c60109668d60354acc298439653e34fd13aa6610e5e9e5588"
    },
    {
      "path": "src/lib/meta-existing-api-plan.mjs",
      "sha256": "c2cf7f2cda9535fa0942ddcf90619f1b3b9ea4a029dd38612322db2ee46f21af"
    },
    {
      "path": "tests/production-meta-existing-api-plan-recovery.test.mjs",
      "sha256": "bb43c357a05c1df7d3b4253b5af0ad8099d35b6db69c705a84903e6c35c7123e"
    },
    {
      "path": "tests/production-meta-existing-api-plan-view.test.mjs",
      "sha256": "cbb4ea689cb0353d032fc871a9451ea12b0ea1f6ce7a1c1661a56460b9389e1a"
    },
    {
      "path": "tests/production-meta-existing-api-plan.test.mjs",
      "sha256": "d9a39b655d59a1ead68f390f02775ef5bebaf7dacb6d0676806f5096beeef2eb"
    }
  ],
  "validationDeltas": [
    {
      "path": "scripts/lib/material-review-current-ci-lineage.mjs",
      "previousSha256": "e6ef236345dff9e24945d4e608cdbdfc4e880739feed0998db24c6d985f9e253",
      "currentSha256": "a20327c78db66275e998937e599178722f29790f0238e7323221ad765bc3e28d"
    },
    {
      "path": "scripts/lib/whatsapp-field-continuity-current-ci-lineage.mjs",
      "previousSha256": "21c44aea395219b2d3c289e617b535a24f7565c139ded824764b33639e38981d",
      "currentSha256": "0f0f19ea4880f34aa7976626b3ab6630371bfd3542b15250f251f24774962060"
    }
  ],
  "proofSourceDeltas": [
    {
      "id": "company-kyc-postgres",
      "family": "PG_COMPANY_KYC",
      "previousCount": 235,
      "previousPathsSha256": "1a26e97cd22fbf77d620e29b20e50c3b01365d205160c2e476a38fc7dc072899",
      "currentCount": 236,
      "currentPathsSha256": "ead9d712f7d5bf0561efc2a0b7e971f6e55a82677c2a08cb16641686e37bdf38",
      "additions": [
        "src/lib/meta-existing-api-plan.mjs"
      ],
      "inheritedSets": [
        {
          "count": 226,
          "pathsSha256": "879ffc9bb14310d4b2e23d911290690002f0bf479644573f7a6b019fe3d3222b"
        },
        {
          "count": 230,
          "pathsSha256": "ea9f247c2dd0d5e0273cedf6c5972a752287d5e454ee6c8725ea9d7718788063"
        },
        {
          "count": 234,
          "pathsSha256": "8518028e316557ff1920c4395e6cf9c5a3a3b682e0f3dc5646f74d3224dd16b8"
        },
        {
          "count": 235,
          "pathsSha256": "1a26e97cd22fbf77d620e29b20e50c3b01365d205160c2e476a38fc7dc072899"
        }
      ]
    },
    {
      "id": "identity-only-ui",
      "family": "UI_IDENTITY_ONLY",
      "previousCount": 147,
      "previousPathsSha256": "d157ca1cec4db1f3139cd33c9674f998655f8ad83c740ae942dd769ffdd5abf0",
      "currentCount": 148,
      "currentPathsSha256": "bdbd7164a1191259bc6a414e327027e97796cc74e3e5f6e8970d3ac752b70a06",
      "additions": [
        "src/app/(identity)/cuenta/meta-existing-api-plan-view.mjs"
      ],
      "inheritedSets": [
        {
          "count": 137,
          "pathsSha256": "23a81982442eefb1597338a82793a745c8894bc38f8bcf44121991641d50c214"
        },
        {
          "count": 139,
          "pathsSha256": "216e5505cc07b407d220179430ef7300100825f21729d14049e9ad711136b102"
        },
        {
          "count": 144,
          "pathsSha256": "35aa758b5c040065d0d104c2a75ca049294b8823c8da9e41693359c1941e8e57"
        },
        {
          "count": 147,
          "pathsSha256": "d157ca1cec4db1f3139cd33c9674f998655f8ad83c740ae942dd769ffdd5abf0"
        }
      ]
    },
    {
      "id": "participant-kyc-preanalysis-postgres",
      "family": "PG_PARTICIPANT_KYC_PREANALYSIS",
      "previousCount": 236,
      "previousPathsSha256": "3bb953705acc389789b7c2cf465ebe39dbd89be683c36f29ce64d5356d946aa0",
      "currentCount": 237,
      "currentPathsSha256": "80777809d188cac7e1c58c08186bff41eb023fb85cafa27775e16231cc4bede4",
      "additions": [
        "scripts/lib/meta-existing-api-plan-current-ci-lineage.mjs"
      ],
      "inheritedSets": [
        {
          "count": 200,
          "pathsSha256": "64012c5b7be1d291bff1f861c7d81cf8480e2492e4fdfd101cafff42485d47d1"
        },
        {
          "count": 229,
          "pathsSha256": "935ce4042c36639e55046301a2c72c93200cdc72f8a8d989ca7a8b403cffddee"
        },
        {
          "count": 231,
          "pathsSha256": "31655b2096aac71b78ab7471af7c538c75019a153beb40393d012a823b9f1835"
        },
        {
          "count": 233,
          "pathsSha256": "9844cc0014597fcedda24f4ac25cf6a7c1a7c3bfdb8a37f9510e76388aa5642f"
        },
        {
          "count": 235,
          "pathsSha256": "71c09c50336b9e87cd1da0de7618209175846b70f6d5d890432d274ca039aed2"
        },
        {
          "count": 236,
          "pathsSha256": "3bb953705acc389789b7c2cf465ebe39dbd89be683c36f29ce64d5356d946aa0"
        }
      ]
    },
    {
      "id": "focused-workspace-ui",
      "family": "UI_FOCUSED_WORKSPACE",
      "previousCount": 181,
      "previousPathsSha256": "5bfe95440c584af2c30487188ca644dbd05434f9eb15ee60a98dc71a3cdf5578",
      "currentCount": 183,
      "currentPathsSha256": "5e672ad9f2fef063d1472fe2ce49516ba708fd25a2b602f001a10e60cfb589e6",
      "additions": [
        "scripts/lib/meta-existing-api-plan-current-ci-lineage.mjs",
        "src/app/(identity)/cuenta/meta-existing-api-plan-view.mjs"
      ],
      "inheritedSets": [
        {
          "count": 168,
          "pathsSha256": "712011a79baf15b67f34d8dc521920795346612e347ac4b0e5eed3a47b48a770"
        },
        {
          "count": 170,
          "pathsSha256": "aea278136cfc58258f3f92e081cbdf9066c4770a48371eaa079b5ce5a4a77a88"
        },
        {
          "count": 174,
          "pathsSha256": "e0d4ef354cade414d88d8d0348ed818d9bd0447b26a3bba38d8a7c8cbebf51d4"
        },
        {
          "count": 180,
          "pathsSha256": "5163b57706633f09f8f66345b4694326b36d208b3f21206191cd388d23505961"
        },
        {
          "count": 181,
          "pathsSha256": "5bfe95440c584af2c30487188ca644dbd05434f9eb15ee60a98dc71a3cdf5578"
        }
      ]
    },
    {
      "id": "field-task-pagination-ui",
      "family": "UI_FIELD_TASK_PAGINATION",
      "previousCount": 63,
      "previousPathsSha256": "718c812e30061467b52a99c9d7383463b02bc2ae4c69eafb5015c8c396aff7ca",
      "currentCount": 64,
      "currentPathsSha256": "ebf85a9a6d749b9d6f8dcdcb69963c41d49e2289db6bc5d7e793279227105fb2",
      "additions": [
        "scripts/lib/meta-existing-api-plan-current-ci-lineage.mjs"
      ],
      "inheritedSets": [
        {
          "count": 62,
          "pathsSha256": "6fb541e46adac1ed66a262398b26b8af73ce5de2fd267b584a6bf1308f8f9fd7"
        },
        {
          "count": 63,
          "pathsSha256": "718c812e30061467b52a99c9d7383463b02bc2ae4c69eafb5015c8c396aff7ca"
        }
      ]
    }
  ],
  "nativeSourceDeltas": [
    {
      "family": "WA_NATIVE_COMPANY",
      "previousCount": 235,
      "previousPathsSha256": "1a26e97cd22fbf77d620e29b20e50c3b01365d205160c2e476a38fc7dc072899",
      "currentCount": 236,
      "currentPathsSha256": "ead9d712f7d5bf0561efc2a0b7e971f6e55a82677c2a08cb16641686e37bdf38",
      "additions": [
        "src/lib/meta-existing-api-plan.mjs"
      ]
    }
  ],
  "native": {
    "producer": "scripts/verify-meta-customer-coexistence-postgres.mjs",
    "previousProducerSha256": "a597518e9e0641c65badb5dad6d7189644b63a7001ad41846a200e55d126a695",
    "currentProducerSha256": "20aae77b10b62c5bbdddb2d4568177bd51052a1272621ea78ecea6a3a1a8773e",
    "previousCheckNames": [
      "waba-only-v4-exact-event-single-phone-binding-no-register-no-pin-no-auto-activation",
      "business-app-activation-requires-stored-and-fresh-coexistence-proof-passes-mode-and-uses-existing-seven-gates-without-v4-or-register",
      "bad-signature-and-cross-tenant-session-rejected-before-source-write",
      "history-without-explicit-tenant-consent-never-enters-private-projection",
      "callback-before-lost-response-preserved-reordered-replay-no-post-explicit-continuation-only-unsent-history",
      "bounded-out-of-order-fragments-concurrent-projection-stable-checkpoint-encrypted-immutable-source-replay",
      "changed-repeat-message-refused-without-overwriting-original-private-source",
      "history-media-placeholder-and-later-media-reference-kept-as-distinct-private-source-no-live-action",
      "projection-source-proof-tampering-hides-private-content-and-never-grants-an-action",
      "history-contact-removal-and-app-echo-preserve-CRM-sales-no-KYC-field-outbound-or-reply-window",
      "uncertain-first-request-never-retried-but-explicit-unsent-second-request-can-continue",
      "expired-import-window-has-zero-provider-mutation-and-does-not-offboard",
      "same-existing-connection-preserved-until-new-grants-and-subscription-confirmed-no-disable-or-replace",
      "previous-grant-preserved-old-code-reuse-and-number-WABA-mismatch-refused-before-code-exchange",
      "expired-trial-keeps-existing-BUSINESS_APP-reauthorization-reconciliation-and-old-provider-preservation",
      "existing-api-plan-is-durable-idempotent-and-preserves-current-provider-and-assets",
      "signed-WABA-only-offboard-pause-and-reconnect-fresh-same-channel-GETs-restore-only-prior-enablement-replay-preserves-all-imports-assets-and-cipher",
      "distinct-reconnect-after-settlement-is-observation-and-cannot-reuse-closed-pause-or-run-provider",
      "signed-timestamps-distinguish-two-identical-cycles-and-older-disconnect-cannot-undo-later-reconnect",
      "both-timestamp-tie-orders-pause-fail-closed-and-cannot-be-bypassed-by-human-ACTIVATE",
      "ADMIN-can-permanently-disable-a-paused-auto-recovery-through-canonical-action-before-reconnect",
      "manual-disable-before-offboard-or-during-fresh-inspection-is-never-restored-by-callback",
      "identity-capabilities-scopes-expiry-subscription-and-unknown-GET-fail-closed-with-durable-status-and-safe-same-event-recovery",
      "credential-replacement-and-local-coexistence-revocation-during-GET-prevent-stale-restoration",
      "partner-removal-during-GET-supersedes-automatic-pause-and-cannot-be-restored-by-old-new-or-human-reconnect",
      "lost-restoration-COMMIT-ack-recovers-original-event-without-new-GET-action-or-import",
      "new-canonical-same-assets-authorization-and-explicit-ADMIN-activation-can-clear-definitive-pause-without-resetting-import",
      "a-new-pause-or-timestamp-tie-after-reauthorization-seals-current-grant-and-cannot-reuse-older-authorization",
      "legacy-direct-reauthorization-materializes-old-grant-before-replacement-allows-explicit-ADMIN-only-after-completion-and-cannot-clear-subsequent-removal",
      "official-signed-partner-removed-disables-active-channel-preserves-sources-and-reconnect-does-not-enable",
      "partner-removal-also-fails-closed-for-active-dedicated-channel-without-creating-import-state",
      "signed-partner-removal-during-fresh-activation-prevents-stale-verification-from-re-enabling",
      "legacy-published-disconnect-without-recovery-remains-restricted-after-new-observational-callback",
      "dedicated-removal-guard-survives-subsequent-observational-account-event-without-inventing-coexistence",
      "already-granted-dedicated-channel-can-explicitly-activate-with-seven-gates-without-new-signup-version-but-live-removal-cannot",
      "dedicated-timestamp-tie-pauses-and-persists-a-guard-that-benign-events-and-human-ACTIVATE-cannot-clear",
      "reconnect-without-a-prior-pause-closes-channel-and-canonical-transport-enforces-same-guard-against-stale-enabled-flags",
      "WABA-only-callback-with-multiple-worksites-or-tenants-rejected-atomically-without-arbitrary-project-provider-or-source-write"
    ],
    "addedCheckNames": [
      "existing-api-revision-change-explicit-close-and-reprepare-preserve-provider-and-audited-history",
      "existing-api-exact-actor-scoped-receipts-recover-lost-commit-and-historical-replay-without-latest-state-substitution",
      "existing-api-concurrent-close-rejects-stale-plan-and-operation-conflicts-and-keeps-native-legacy-receipt"
    ],
    "currentCheckNames": [
      "waba-only-v4-exact-event-single-phone-binding-no-register-no-pin-no-auto-activation",
      "business-app-activation-requires-stored-and-fresh-coexistence-proof-passes-mode-and-uses-existing-seven-gates-without-v4-or-register",
      "bad-signature-and-cross-tenant-session-rejected-before-source-write",
      "history-without-explicit-tenant-consent-never-enters-private-projection",
      "callback-before-lost-response-preserved-reordered-replay-no-post-explicit-continuation-only-unsent-history",
      "bounded-out-of-order-fragments-concurrent-projection-stable-checkpoint-encrypted-immutable-source-replay",
      "changed-repeat-message-refused-without-overwriting-original-private-source",
      "history-media-placeholder-and-later-media-reference-kept-as-distinct-private-source-no-live-action",
      "projection-source-proof-tampering-hides-private-content-and-never-grants-an-action",
      "history-contact-removal-and-app-echo-preserve-CRM-sales-no-KYC-field-outbound-or-reply-window",
      "uncertain-first-request-never-retried-but-explicit-unsent-second-request-can-continue",
      "expired-import-window-has-zero-provider-mutation-and-does-not-offboard",
      "same-existing-connection-preserved-until-new-grants-and-subscription-confirmed-no-disable-or-replace",
      "previous-grant-preserved-old-code-reuse-and-number-WABA-mismatch-refused-before-code-exchange",
      "expired-trial-keeps-existing-BUSINESS_APP-reauthorization-reconciliation-and-old-provider-preservation",
      "existing-api-plan-is-durable-idempotent-and-preserves-current-provider-and-assets",
      "existing-api-revision-change-explicit-close-and-reprepare-preserve-provider-and-audited-history",
      "existing-api-exact-actor-scoped-receipts-recover-lost-commit-and-historical-replay-without-latest-state-substitution",
      "existing-api-concurrent-close-rejects-stale-plan-and-operation-conflicts-and-keeps-native-legacy-receipt",
      "signed-WABA-only-offboard-pause-and-reconnect-fresh-same-channel-GETs-restore-only-prior-enablement-replay-preserves-all-imports-assets-and-cipher",
      "distinct-reconnect-after-settlement-is-observation-and-cannot-reuse-closed-pause-or-run-provider",
      "signed-timestamps-distinguish-two-identical-cycles-and-older-disconnect-cannot-undo-later-reconnect",
      "both-timestamp-tie-orders-pause-fail-closed-and-cannot-be-bypassed-by-human-ACTIVATE",
      "ADMIN-can-permanently-disable-a-paused-auto-recovery-through-canonical-action-before-reconnect",
      "manual-disable-before-offboard-or-during-fresh-inspection-is-never-restored-by-callback",
      "identity-capabilities-scopes-expiry-subscription-and-unknown-GET-fail-closed-with-durable-status-and-safe-same-event-recovery",
      "credential-replacement-and-local-coexistence-revocation-during-GET-prevent-stale-restoration",
      "partner-removal-during-GET-supersedes-automatic-pause-and-cannot-be-restored-by-old-new-or-human-reconnect",
      "lost-restoration-COMMIT-ack-recovers-original-event-without-new-GET-action-or-import",
      "new-canonical-same-assets-authorization-and-explicit-ADMIN-activation-can-clear-definitive-pause-without-resetting-import",
      "a-new-pause-or-timestamp-tie-after-reauthorization-seals-current-grant-and-cannot-reuse-older-authorization",
      "legacy-direct-reauthorization-materializes-old-grant-before-replacement-allows-explicit-ADMIN-only-after-completion-and-cannot-clear-subsequent-removal",
      "official-signed-partner-removed-disables-active-channel-preserves-sources-and-reconnect-does-not-enable",
      "partner-removal-also-fails-closed-for-active-dedicated-channel-without-creating-import-state",
      "signed-partner-removal-during-fresh-activation-prevents-stale-verification-from-re-enabling",
      "legacy-published-disconnect-without-recovery-remains-restricted-after-new-observational-callback",
      "dedicated-removal-guard-survives-subsequent-observational-account-event-without-inventing-coexistence",
      "already-granted-dedicated-channel-can-explicitly-activate-with-seven-gates-without-new-signup-version-but-live-removal-cannot",
      "dedicated-timestamp-tie-pauses-and-persists-a-guard-that-benign-events-and-human-ACTIVATE-cannot-clear",
      "reconnect-without-a-prior-pause-closes-channel-and-canonical-transport-enforces-same-guard-against-stale-enabled-flags",
      "WABA-only-callback-with-multiple-worksites-or-tenants-rejected-atomically-without-arbitrary-project-provider-or-source-write"
    ]
  },
  "nativeOrBrowserAcceptance": false
}); // REVIEWED_REVISION_DATA
function freezeRevision(value){if(value&&typeof value==='object'){for(const child of Object.values(value))freezeRevision(child);Object.freeze(value);}}
freezeRevision(EXISTING_API_PLAN_CURRENT_REVISION);
const sha=value=>createHash('sha256').update(value).digest('hex');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const reject=(ok,message)=>{if(!ok)throw Object.assign(new Error(message),{code:'EXISTING_API_PLAN_CURRENT_CI_LINEAGE_REJECTED'});};
const exact=(value,keys,message)=>reject(plain(value)&&same(Object.keys(value).sort(),keys.slice().sort()),message);
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const safe=value=>typeof value==='string'&&/^(src|scripts|tests)\//.test(value)&&!value.includes('..')&&!value.includes('\\');
function section(contract){
 if(!plain(contract)||!Object.hasOwn(contract,EXISTING_API_PLAN_CURRENT_SECTION))return null;
 const value=contract[EXISTING_API_PLAN_CURRENT_SECTION];exact(value,[...Object.keys(EXISTING_API_PLAN_CURRENT_REVISION),'validationSources'],'Exact API plan revision required');
 for(const[key,expected]of Object.entries(EXISTING_API_PLAN_CURRENT_REVISION))reject(same(value[key],expected),'Unreviewed API plan declaration: '+key);
 reject(Array.isArray(value.validationSources)&&same(value.validationSources.map(row=>row?.path),[EXISTING_API_PLAN_CURRENT_HELPER,EXISTING_API_PLAN_CURRENT_TEST]),'Exact API plan validator sources required');
 for(const row of value.validationSources){exact(row,['path','sha256'],'Exact API plan validator pin required');reject(hash(row.sha256),'API plan source hash required');}
 return value;
}
function previousPaths(files,delta){
 reject(Array.isArray(files)&&files.every(file=>typeof file==='string')&&new Set(files).size===files.length&&same(files,[...files].sort())&&files.length===delta.currentCount&&sha(JSON.stringify(files))===delta.currentPathsSha256,'Exact current API plan source set required: '+delta.family);
 const previous=files.filter(file=>!delta.additions.includes(file));
 reject(previous.length===delta.previousCount&&sha(JSON.stringify(previous))===delta.previousPathsSha256,'Exact API plan predecessor source set required: '+delta.family);return previous;
}
export function restoreExistingApiPlanPreviousContract(contract){
 const value=section(contract);if(!value)return contract;
 const previous=structuredClone(contract);delete previous[EXISTING_API_PLAN_CURRENT_SECTION];
 for(const delta of value.proofSourceDeltas){
  const proofs=previous.extension?.proofs?.filter(row=>row.id===delta.id);reject(proofs?.length===1,'One exact API plan proof required: '+delta.id);
  const files=previousPaths(proofs[0].sourceFiles,delta);
  if(delta.id==='participant-kyc-preanalysis-postgres'){reject(same(previous.participantPreanalysisCurrentRevision.ciSourceFiles,proofs[0].sourceFiles),'Preanalysis current source declarations must agree');previous.participantPreanalysisCurrentRevision.ciSourceFiles=[...files];}
  proofs[0].sourceFiles=files;
 }
 reject(sha(JSON.stringify(previous,null,2)+'\n')===value.previousContractSha256,'The complete published 5d0 contract must restore exactly');return previous;
}
export function existingApiPlanPreviousSourcePin(contract,ref){
 const value=section(contract),row=value&&[...value.reviewedSourceChanges,...value.validationDeltas].find(row=>row.path===ref.path);
 return row&&ref.sha256===row.currentSha256?row.previousSha256:ref.sha256;
}
export function existingApiPlanCurrentSourcePin(contract,ref){
 const value=section(contract),row=value&&[...value.reviewedSourceChanges,...value.validationDeltas].find(row=>row.path===ref.path);if(!row)return ref.sha256;
 reject([row.previousSha256,row.currentSha256].includes(ref.sha256),'Only an exact authenticated API plan predecessor or current pin may advance: '+ref.path);return row.currentSha256;
}
export function existingApiPlanValidationFiles(contract){
 const value=section(contract);if(!value)return[];restoreExistingApiPlanPreviousContract(contract);
 return [...new Set([...value.reviewedSourceChanges,...value.validationDeltas,...value.addedSources,...value.validationSources].map(row=>row.path))].sort();
}
export function verifyExistingApiPlanCurrentSources(contract,readSource){
 const value=section(contract);if(!value)return null;restoreExistingApiPlanPreviousContract(contract);reject(typeof readSource==='function','Actual API plan source reader required');
 const refs=[...value.reviewedSourceChanges,...value.validationDeltas].map(row=>({path:row.path,sha256:row.currentSha256})).concat(value.addedSources,value.validationSources);
 reject(new Set(refs.map(row=>row.path)).size===refs.length,'Unique API plan current source references required');
 for(const row of refs){reject(safe(row.path)&&hash(row.sha256),'Safe exact API plan source pin required');const bytes=readSource(row.path);reject(Buffer.isBuffer(bytes),'Missing current API plan source: '+row.path);const text=bytes.toString('utf8');reject(bytes.equals(Buffer.from(text))&&sha(text.replaceAll('\r\n','\n'))===row.sha256,'Stale current API plan source: '+row.path);}
 return {version:1,completePreviousContractRestored:true,previousContractSha256:value.previousContractSha256,historicalPinsPreserved:true,nativeOrBrowserAcceptance:false};
}
export function restoreExistingApiPlanSourceSet(family,files,contract){
 const value=section(contract);if(!value)return files;restoreExistingApiPlanPreviousContract(contract);
 const delta=[...value.proofSourceDeltas,...value.nativeSourceDeltas].find(row=>row.family===family);return delta?previousPaths(files,delta):files;
}
export function existingApiPlanProofSourceAdditions(spec){
 const delta=EXISTING_API_PLAN_CURRENT_REVISION.proofSourceDeltas.find(row=>row.id===spec?.id);if(!delta)return[];
 const files=spec.sourceFiles;reject(Array.isArray(files)&&new Set(files).size===files.length&&same(files,[...files].sort()),'Distinct sorted API plan proof sources required');
 const count=files.length,digest=sha(JSON.stringify(files));if(count===delta.currentCount&&digest===delta.currentPathsSha256)return [...delta.additions];
 reject((delta.inheritedSets||[]).some(row=>row.count===count&&row.pathsSha256===digest),'Unknown API plan proof source set: '+delta.id);return[];
}
export function existingApiPlanCurrentNativeSourceFiles(contract,family,previous){
 const value=section(contract);if(!value)return previous;restoreExistingApiPlanPreviousContract(contract);
 const delta=value.nativeSourceDeltas.find(row=>row.family==='WA_NATIVE_'+family);if(!delta)return previous;
 reject(Array.isArray(previous)&&previous.length===delta.previousCount&&sha(JSON.stringify(previous))===delta.previousPathsSha256,'Exact API plan historical native paths required');
 const current=[...previous,...delta.additions].sort();previousPaths(current,delta);return current;
}
export function existingApiPlanNativeSourceFilesFromReader(readSource,family,previous){
 const bytes=readSource('.github/workspace-acceptance-contract.json');if(!Buffer.isBuffer(bytes))return previous;
 return existingApiPlanCurrentNativeSourceFiles(JSON.parse(bytes),family,previous);
}
export function validateExistingApiPlanNativeProof(proof,contract,readSource){
 const value=section(contract);if(!value)return null;verifyExistingApiPlanCurrentSources(contract,readSource);
 reject(plain(proof)&&proof.status==='PASS'&&proof.environment==='local-disposable-postgresql17'&&same(proof.checks,value.native.currentCheckNames)&&proof.realProviderCalls===0&&proof.physicalNumberTested===false&&proof.productionDataTouched===false,'Exact inherited plus additive local API plan observations required');
 return {version:1,status:'PASS',historicalChecksPreserved:value.native.previousCheckNames.length,addedChecks:value.native.addedCheckNames.length,nativeOrBrowserAcceptance:false};
}
