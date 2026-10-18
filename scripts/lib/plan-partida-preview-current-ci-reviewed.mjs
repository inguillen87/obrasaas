// Exact source-preview CI declaration; explicit trust anchor, never proof-supplied.
export const PLAN_PARTIDA_PREVIEW_CURRENT_REVISION=Object.freeze({
  "version": 1,
  "status": "REVIEWED_SOURCE_ONLY",
  "finalAstDerived": true,
  "predecessorCommit": "3cccea99e7074cdb3b707c1d876f02009c19b4d5",
  "previousContractSha256": "e8067f73d1e1a48ace92af3bfc34e5b775e16c49d3833df43bb03510a59bcf34",
  "sourceStage": {
    "manifestSha256": "af69d0515fb724aad84e6aa175c8b29a9b0ba112a1f73747c76e618cec0f7d0d",
    "metadataSha256": "9a1b8c4ad11556e788e5fed9e764a6d75e7652c8ed5bd2c4ef27419ee94b4c24",
    "scope": "SOURCE_PATCH_ONLY_CI_PENDING"
  },
  "references": [
    {
      "path": ".github/scripts/verify-workspace-ci-parallelization.mjs",
      "previousSha256": "7e4e994d4c13ebd82cedd8fe482ca6090a78526b0f52cbf205f23c82d190f3b7",
      "currentSha256": "8d65b7fb1446dc0533f69097ae28598a7c748f50c19eb586614ce078bf3aebac"
    },
    {
      "path": "scripts/lib/home-decisions-current-ci-lineage.mjs",
      "previousSha256": "805bccca43cc197201dc6c97844ff153a8d2548fe3fd6ebe11d25953b3060a29",
      "currentSha256": "46653e34f0b0ab46617578525e4f0b71e295f240eceeec87ccb0944cd5db21a8"
    },
    {
      "path": "scripts/lib/plan-compact-full-suite-ui.mjs",
      "previousSha256": null,
      "currentSha256": "53169c4a6fd9636daf6172f71b39bb9a759bc9dd48adb6544a31a6d018691b28"
    },
    {
      "path": "scripts/lib/plan-partida-measurement-privacy-ui.mjs",
      "previousSha256": null,
      "currentSha256": "816b9a435d37194e91660bfd3157560f66409ca0499396df9ab1e9fea0f4e27c"
    },
    {
      "path": "scripts/lib/plan-partida-preview-current-ci-lineage.mjs",
      "previousSha256": null,
      "currentSha256": "e793dbc5e5096926f71cc14ba60696b1becb2d3ed775aa75b00ad412c4e85e7e"
    },
    {
      "path": "scripts/lib/plan-partida-source-preview-ui.mjs",
      "previousSha256": null,
      "currentSha256": "f20fb29956212a459890e119c242f0bdb9e0fd67ced7fca32e2c2d06cad14057"
    },
    {
      "path": "scripts/lib/worksite-live-hours-current-ci-lineage.mjs",
      "previousSha256": "0d152bf95e2544e2536531acedf94200850c3060311b209d565b753aa857bdc1",
      "currentSha256": "86c626156b82419640b4dc45520a7dcca330810949a346ae60f50566a136f2e6"
    },
    {
      "path": "scripts/verify-plan-import-ui.mjs",
      "previousSha256": "cb76ddce38c6221effa78aba6ae5ce716bead59f587a42d74a2f2724ff453734",
      "currentSha256": "57534d93a1e0b675e11faec0750a51d1867f9c823e2b91a11143c0f8d297b38f"
    },
    {
      "path": "src/app/(identity)/cuenta/plan-import-panel.js",
      "previousSha256": "a532eefe56961ba7a9c3a33e5a888f7b4b4affee837412a2aba4066fb0ee1882",
      "currentSha256": "d74f0cdff0da1c173bc2ef566fed973ca02dd6bcc449aa8c3842d5109954d5f6"
    },
    {
      "path": "src/app/(identity)/cuenta/plan-partida-measurement-preview.js",
      "previousSha256": null,
      "currentSha256": "e68aa0851e4d415408c21df76d3716c4e4196925223c155a96194d7db85566d8"
    },
    {
      "path": "src/app/(identity)/cuenta/plan-partida-measurement-preview.mjs",
      "previousSha256": null,
      "currentSha256": "f30a1c21396f61a1808446d9660554132b5df654e633d128dfe2f76336a9adc5"
    },
    {
      "path": "src/app/(identity)/cuenta/plan-partida-source-preview.js",
      "previousSha256": null,
      "currentSha256": "0869d7e7a5efe5e05e7b5f5f729da9e58d9f106329e31baf6ea79cabf990d3a9"
    },
    {
      "path": "src/app/(identity)/cuenta/plan-partida-source-preview.mjs",
      "previousSha256": null,
      "currentSha256": "fcd3a41c62138e77fc026c6651a0a228d9f4507b0a87c82a3b113b0e4fc26e8d"
    },
    {
      "path": "src/app/(identity)/cuenta/plan-partida-source-preview.module.css",
      "previousSha256": null,
      "currentSha256": "da7cfec61d043d0f217e706701994fb41ed1973733ccd37a35698f743aefd9ee"
    },
    {
      "path": "src/app/(identity)/cuenta/plan-source-curve.js",
      "previousSha256": "e7355083e1d6f65e00493d93df740753d0c8a1913c14cf3f21acb68df6c5fc34",
      "currentSha256": "b0f1ef1fee082e82f18d4bd2fb13377b27d8f9849e831f2c34120164f93f9a12"
    },
    {
      "path": "src/app/(identity)/cuenta/plan-source-curve.module.css",
      "previousSha256": "0ee5ff38574aed81d9aee18fcac1dcda05046b3ce59a8f71d5b99fc3bee6eb3b",
      "currentSha256": "92f94328baac3fb0416002db12b5c19923fc28e6f89cb625df10038e0a96a180"
    },
    {
      "path": "tests/fixtures/plan-native-labels-curve-before.txt",
      "previousSha256": null,
      "currentSha256": "a6e38f58e1ea51a335e409e180b016155e0cb92e859dc8d969d22c84564dc81f"
    },
    {
      "path": "tests/fixtures/plan-partida-preview-weekly-164-producer.txt",
      "previousSha256": null,
      "currentSha256": "cb76ddce38c6221effa78aba6ae5ce716bead59f587a42d74a2f2724ff453734"
    },
    {
      "path": "tests/fixtures/plan-source-curve-compact-preimage.css.txt",
      "previousSha256": null,
      "currentSha256": "0ee5ff38574aed81d9aee18fcac1dcda05046b3ce59a8f71d5b99fc3bee6eb3b"
    },
    {
      "path": "tests/fixtures/plan-source-curve-compact-preimage.txt",
      "previousSha256": null,
      "currentSha256": "e7355083e1d6f65e00493d93df740753d0c8a1913c14cf3f21acb68df6c5fc34"
    },
    {
      "path": "tests/production-home-decisions-current-ci-lineage.test.mjs",
      "previousSha256": "2cfcfb2c07f4df01e72ca65ae33928849521ddfaa89434b9610752a4f98d0978",
      "currentSha256": "511f6c45d33d66a22a7f583fd48c7ea7d4933dab26473d2106ece15056e4f6c7"
    },
    {
      "path": "tests/production-plan-import-source-curve-compact.test.mjs",
      "previousSha256": null,
      "currentSha256": "7b6b0d38ae3736fa108694a95923d514f4f8afa89d48594a91e81ea25eb5e36c"
    },
    {
      "path": "tests/production-plan-import-source-curve-native-labels.test.mjs",
      "previousSha256": null,
      "currentSha256": "88f82e17197de6a8decd6106a29677c6063e99f9bd776bf3069f1862e05ac9e4"
    },
    {
      "path": "tests/production-plan-source-curve-ui.test.mjs",
      "previousSha256": "e5166819e4d0cd8624311e1169cd63ed003f2feea7e319d0ce707f7380ba337f",
      "currentSha256": "30f9ecb970983cc4d9872feb7e89f301c1c6c899bda91055f7262dd2922bcb13"
    },
    {
      "path": "tests/production-workspace-plan-partida-measurement-preview.test.mjs",
      "previousSha256": null,
      "currentSha256": "d7746cd9f6bd805584531b91c92033f0672b0e050798fefe0645bec079bc6265"
    },
    {
      "path": "tests/production-workspace-plan-partida-preview-current-ci-lineage.test.mjs",
      "previousSha256": null,
      "currentSha256": "f8a9b32eb299df07d9b4a0c8e706567df649a2ea771bd2d0c7105ee4e8f12a69"
    },
    {
      "path": "tests/production-workspace-plan-partida-source-preview.test.mjs",
      "previousSha256": null,
      "currentSha256": "78c32462f41120189b21f3527e05d21196d66ccadce98f4631d8b5aa8ad178a5"
    }
  ],
  "sourceSetDeltas": [
    {
      "family": "UI_IDENTITY_ONLY",
      "contractPointer": "/extension/proofs/13/sourceFiles",
      "previousCount": 156,
      "previousPathsSha256": "a6e9f08dcb39bec33202140165334069f774663c376aa02de2f779dc12fef2fb",
      "currentCount": 161,
      "currentPathsSha256": "8e0a4daa7b9829e96f8a984a846235038a541e2e0fbfe599d0a8b592222bb1c6",
      "additions": [
        "src/app/(identity)/cuenta/plan-partida-measurement-preview.js",
        "src/app/(identity)/cuenta/plan-partida-measurement-preview.mjs",
        "src/app/(identity)/cuenta/plan-partida-source-preview.js",
        "src/app/(identity)/cuenta/plan-partida-source-preview.mjs",
        "src/app/(identity)/cuenta/plan-partida-source-preview.module.css"
      ]
    },
    {
      "family": "UI_DOCUMENT_CURVE",
      "contractPointer": "/extension/proofs/17/sourceFiles",
      "previousCount": 36,
      "previousPathsSha256": "9c8ce105438aa20faa75408f1e4be895c6c0ef144faacd410968aa9b70438fa5",
      "currentCount": 41,
      "currentPathsSha256": "1522cefb0897fd89cc0482fff34ebab41492c16e187b57e50801496bd898a44d",
      "additions": [
        "src/app/(identity)/cuenta/plan-partida-measurement-preview.js",
        "src/app/(identity)/cuenta/plan-partida-measurement-preview.mjs",
        "src/app/(identity)/cuenta/plan-partida-source-preview.js",
        "src/app/(identity)/cuenta/plan-partida-source-preview.mjs",
        "src/app/(identity)/cuenta/plan-partida-source-preview.module.css"
      ]
    },
    {
      "family": "PG_PARTICIPANT_KYC_PREANALYSIS",
      "contractPointer": "/extension/proofs/18/sourceFiles",
      "previousCount": 241,
      "previousPathsSha256": "dc65223fd15e1e8c40877673895cf4a9d738c52c0c7373708f8537256375de96",
      "currentCount": 243,
      "currentPathsSha256": "404123db2d7b89f77f508aa9840a93803b878dfc9a9df5dbd9805d5f1426f1b9",
      "additions": [
        "scripts/lib/plan-partida-preview-current-ci-lineage.mjs",
        "scripts/lib/plan-partida-preview-current-ci-reviewed.mjs"
      ]
    },
    {
      "family": "UI_FOCUSED_WORKSPACE",
      "contractPointer": "/extension/proofs/19/sourceFiles",
      "previousCount": 192,
      "previousPathsSha256": "c1633614bc588d860682fc84b16be3d56e5ca72dbc90205e8471b94265c7975d",
      "currentCount": 199,
      "currentPathsSha256": "a8c90fd0e156e464f44cd5657d008e8e15b29fb4812d8b47a13f994235a22b8f",
      "additions": [
        "scripts/lib/plan-partida-preview-current-ci-lineage.mjs",
        "scripts/lib/plan-partida-preview-current-ci-reviewed.mjs",
        "src/app/(identity)/cuenta/plan-partida-measurement-preview.js",
        "src/app/(identity)/cuenta/plan-partida-measurement-preview.mjs",
        "src/app/(identity)/cuenta/plan-partida-source-preview.js",
        "src/app/(identity)/cuenta/plan-partida-source-preview.mjs",
        "src/app/(identity)/cuenta/plan-partida-source-preview.module.css"
      ]
    },
    {
      "family": "UI_FIELD_TASK_PAGINATION",
      "contractPointer": "/extension/proofs/20/sourceFiles",
      "previousCount": 73,
      "previousPathsSha256": "64f37c895bc52d4a74c09d53faf1c3652dc93d7b92b5408ca817afb95b216868",
      "currentCount": 75,
      "currentPathsSha256": "5624848f060138e2071b22e4bb606a9c5b726ab0c02cde39dc1fd8e0a1627895",
      "additions": [
        "scripts/lib/plan-partida-preview-current-ci-lineage.mjs",
        "scripts/lib/plan-partida-preview-current-ci-reviewed.mjs"
      ]
    },
    {
      "family": "LIVE_HOURS_RUNTIME",
      "contractPointer": null,
      "previousCount": 164,
      "previousPathsSha256": "94ccefda3d5812e411dce447d80164c4c0ef9a2011f9eade0dd16fdffa706fec",
      "currentCount": 169,
      "currentPathsSha256": "f6391decdcdcb680c3bd8bd220493e224e4fc1aea4ad53188f54b07216f711ad",
      "additions": [
        "src/app/(identity)/cuenta/plan-partida-measurement-preview.js",
        "src/app/(identity)/cuenta/plan-partida-measurement-preview.mjs",
        "src/app/(identity)/cuenta/plan-partida-source-preview.js",
        "src/app/(identity)/cuenta/plan-partida-source-preview.mjs",
        "src/app/(identity)/cuenta/plan-partida-source-preview.module.css"
      ]
    }
  ],
  "sourceFamilies": [
    {
      "family": "LIVE_HOURS_RUNTIME",
      "previousExternalImports": [
        "ffmpeg-static",
        "jsqr",
        "lucide-react",
        "next/navigation",
        "node:child_process",
        "node:crypto",
        "node:fs/promises",
        "node:os",
        "node:path",
        "node:perf_hooks",
        "react"
      ],
      "currentFiles": [
        "src/app/(identity)/cuenta/company-bootstrap-panel.js",
        "src/app/(identity)/cuenta/company-bootstrap-panel.module.css",
        "src/app/(identity)/cuenta/company-channel-panel.js",
        "src/app/(identity)/cuenta/company-channel-panel.module.css",
        "src/app/(identity)/cuenta/company-channel-view.mjs",
        "src/app/(identity)/cuenta/company-subscription-panel.js",
        "src/app/(identity)/cuenta/company-subscription-panel.module.css",
        "src/app/(identity)/cuenta/company-subscription-view.mjs",
        "src/app/(identity)/cuenta/company-usage-panel.js",
        "src/app/(identity)/cuenta/company-usage-view.mjs",
        "src/app/(identity)/cuenta/constructor-crm-panel.js",
        "src/app/(identity)/cuenta/constructor-crm-panel.module.css",
        "src/app/(identity)/cuenta/constructor-crm-view.mjs",
        "src/app/(identity)/cuenta/customer-inbox-panel.js",
        "src/app/(identity)/cuenta/customer-inbox-panel.module.css",
        "src/app/(identity)/cuenta/customer-inbox-view.mjs",
        "src/app/(identity)/cuenta/customer-whatsapp-panel.js",
        "src/app/(identity)/cuenta/customer-whatsapp-panel.module.css",
        "src/app/(identity)/cuenta/customer-whatsapp-view.mjs",
        "src/app/(identity)/cuenta/demo-pilot-panel.js",
        "src/app/(identity)/cuenta/demo-pilot-view.mjs",
        "src/app/(identity)/cuenta/employee-intake-continuity.mjs",
        "src/app/(identity)/cuenta/employee-intake-panel.js",
        "src/app/(identity)/cuenta/field-hours-report-panel.js",
        "src/app/(identity)/cuenta/field-hours-report-panel.module.css",
        "src/app/(identity)/cuenta/field-media-capture.js",
        "src/app/(identity)/cuenta/field-media-held-view.mjs",
        "src/app/(identity)/cuenta/field-media-preparation.mjs",
        "src/app/(identity)/cuenta/field-media-preview.js",
        "src/app/(identity)/cuenta/field-operations-panel.js",
        "src/app/(identity)/cuenta/field-operations-panel.module.css",
        "src/app/(identity)/cuenta/field-overtime-view.js",
        "src/app/(identity)/cuenta/field-overtime-view.module.css",
        "src/app/(identity)/cuenta/field-qr-capture.js",
        "src/app/(identity)/cuenta/field-qr-reader.mjs",
        "src/app/(identity)/cuenta/field-review-page-view.mjs",
        "src/app/(identity)/cuenta/kyc-photo-preparation.js",
        "src/app/(identity)/cuenta/material-inventory-panel.js",
        "src/app/(identity)/cuenta/material-inventory-panel.module.css",
        "src/app/(identity)/cuenta/material-inventory-view.mjs",
        "src/app/(identity)/cuenta/meta-existing-api-plan-view.mjs",
        "src/app/(identity)/cuenta/meta-onboarding-panel.js",
        "src/app/(identity)/cuenta/meta-onboarding-panel.module.css",
        "src/app/(identity)/cuenta/meta-onboarding-readiness-view.mjs",
        "src/app/(identity)/cuenta/meta-sdk-loader.mjs",
        "src/app/(identity)/cuenta/office-review-panel.js",
        "src/app/(identity)/cuenta/office-review-panel.module.css",
        "src/app/(identity)/cuenta/office-review-view.mjs",
        "src/app/(identity)/cuenta/operations-status-panel.js",
        "src/app/(identity)/cuenta/operations-status-panel.module.css",
        "src/app/(identity)/cuenta/own-company-number-panel.js",
        "src/app/(identity)/cuenta/own-company-number-view.mjs",
        "src/app/(identity)/cuenta/own-company-templates-panel.js",
        "src/app/(identity)/cuenta/own-company-templates-view.mjs",
        "src/app/(identity)/cuenta/participant-account-discovery-format.mjs",
        "src/app/(identity)/cuenta/participant-account-discovery.js",
        "src/app/(identity)/cuenta/participant-civil-data-panel.js",
        "src/app/(identity)/cuenta/participant-civil-data-view.mjs",
        "src/app/(identity)/cuenta/participant-kyc-capture.js",
        "src/app/(identity)/cuenta/participant-kyc-capture.module.css",
        "src/app/(identity)/cuenta/participant-kyc-chat-attempt-panel.js",
        "src/app/(identity)/cuenta/participant-kyc-chat-attempt-view.mjs",
        "src/app/(identity)/cuenta/participant-kyc-preanalysis-view.mjs",
        "src/app/(identity)/cuenta/participant-ocr-usage-view.mjs",
        "src/app/(identity)/cuenta/participant-office-account-view.mjs",
        "src/app/(identity)/cuenta/participant-onboarding-next-step.mjs",
        "src/app/(identity)/cuenta/participant-panel.js",
        "src/app/(identity)/cuenta/participant-panel.module.css",
        "src/app/(identity)/cuenta/plan-baseline-panel.js",
        "src/app/(identity)/cuenta/plan-baseline-view.mjs",
        "src/app/(identity)/cuenta/plan-baseline.module.css",
        "src/app/(identity)/cuenta/plan-import-calendar-suggestions.mjs",
        "src/app/(identity)/cuenta/plan-import-panel.js",
        "src/app/(identity)/cuenta/plan-import-panel.module.css",
        "src/app/(identity)/cuenta/plan-import-usage-view.mjs",
        "src/app/(identity)/cuenta/plan-measurement-panel.js",
        "src/app/(identity)/cuenta/plan-measurement-panel.module.css",
        "src/app/(identity)/cuenta/plan-measurement-view.mjs",
        "src/app/(identity)/cuenta/plan-partida-measurement-preview.js",
        "src/app/(identity)/cuenta/plan-partida-measurement-preview.mjs",
        "src/app/(identity)/cuenta/plan-partida-source-preview.js",
        "src/app/(identity)/cuenta/plan-partida-source-preview.mjs",
        "src/app/(identity)/cuenta/plan-partida-source-preview.module.css",
        "src/app/(identity)/cuenta/plan-source-curve.js",
        "src/app/(identity)/cuenta/plan-source-curve.mjs",
        "src/app/(identity)/cuenta/plan-source-curve.module.css",
        "src/app/(identity)/cuenta/portfolio-overview-panel.js",
        "src/app/(identity)/cuenta/portfolio-overview-panel.module.css",
        "src/app/(identity)/cuenta/portfolio-overview-view.mjs",
        "src/app/(identity)/cuenta/private-bank-account-format.mjs",
        "src/app/(identity)/cuenta/private-bank-account-panel.js",
        "src/app/(identity)/cuenta/private-bank-account-panel.module.css",
        "src/app/(identity)/cuenta/private-workspace-download.js",
        "src/app/(identity)/cuenta/project-creation-format.mjs",
        "src/app/(identity)/cuenta/project-creation-panel.js",
        "src/app/(identity)/cuenta/project-creation-panel.module.css",
        "src/app/(identity)/cuenta/project-preparation-format.mjs",
        "src/app/(identity)/cuenta/project-preparation-panel.js",
        "src/app/(identity)/cuenta/project-preparation-panel.module.css",
        "src/app/(identity)/cuenta/schedule-workbench.js",
        "src/app/(identity)/cuenta/schedule-workbench.mjs",
        "src/app/(identity)/cuenta/schedule-workbench.module.css",
        "src/app/(identity)/cuenta/site-purchase-panel.js",
        "src/app/(identity)/cuenta/site-purchase-panel.module.css",
        "src/app/(identity)/cuenta/site-purchase-view.mjs",
        "src/app/(identity)/cuenta/site-register-panel.js",
        "src/app/(identity)/cuenta/site-register-panel.module.css",
        "src/app/(identity)/cuenta/task-create-panel.js",
        "src/app/(identity)/cuenta/task-progress-measurement-editor.js",
        "src/app/(identity)/cuenta/task-progress-measurement-editor.module.css",
        "src/app/(identity)/cuenta/task-progress-measurement-view.mjs",
        "src/app/(identity)/cuenta/template-send-panel.js",
        "src/app/(identity)/cuenta/template-send-panel.module.css",
        "src/app/(identity)/cuenta/template-send-view.mjs",
        "src/app/(identity)/cuenta/voice-progress-draft-view.js",
        "src/app/(identity)/cuenta/worker-channel-panel.js",
        "src/app/(identity)/cuenta/worker-channel-panel.module.css",
        "src/app/(identity)/cuenta/worksite-task-selector.js",
        "src/app/(identity)/cuenta/worksite-task-selector.module.css",
        "src/app/(identity)/cuenta/workspace-client.js",
        "src/app/(identity)/cuenta/workspace-live-read.mjs",
        "src/app/(identity)/cuenta/workspace-live-refresh-controller.mjs",
        "src/app/(identity)/cuenta/workspace-live-refresh.js",
        "src/app/(identity)/cuenta/workspace-overview.js",
        "src/app/(identity)/cuenta/workspace-recovery-journal.mjs",
        "src/app/(identity)/cuenta/workspace-recovery-panel.js",
        "src/app/(identity)/cuenta/workspace-recovery-storage.mjs",
        "src/app/(identity)/cuenta/workspace-request-lifecycle.js",
        "src/app/(identity)/cuenta/workspace-request-lifecycle.mjs",
        "src/app/(identity)/cuenta/workspace-screen.js",
        "src/app/(identity)/cuenta/workspace-session-request.mjs",
        "src/app/(identity)/cuenta/workspace-task-page.mjs",
        "src/app/(identity)/cuenta/workspace-tools-navigation.js",
        "src/app/(identity)/cuenta/workspace-tools-navigation.module.css",
        "src/app/(identity)/cuenta/workspace-view-routing.mjs",
        "src/app/(identity)/cuenta/workspace.module.css",
        "src/lib/company-entitlement.mjs",
        "src/lib/company-phone-format.mjs",
        "src/lib/field-hours-report.mjs",
        "src/lib/field-media-privacy.mjs",
        "src/lib/field-media.mjs",
        "src/lib/field-operations-http.mjs",
        "src/lib/field-operations-policy.mjs",
        "src/lib/field-operations-store.mjs",
        "src/lib/field-overtime-policy.mjs",
        "src/lib/field-overtime-store.mjs",
        "src/lib/field-report-feedback.mjs",
        "src/lib/field-shift-summary.mjs",
        "src/lib/geo.js",
        "src/lib/identity-return-path.mjs",
        "src/lib/material-inventory.mjs",
        "src/lib/meta-cloud-protocol.mjs",
        "src/lib/participant-approved-identity.mjs",
        "src/lib/participant-kyc-image-set.mjs",
        "src/lib/person-worksite-journey.mjs",
        "src/lib/plan-import-cyp-curve.mjs",
        "src/lib/plan-import-document-curve.mjs",
        "src/lib/private-image-upload.mjs",
        "src/lib/procurement-quantity.js",
        "src/lib/progress-measurement-quantity.js",
        "src/lib/site-register-policy.mjs",
        "src/lib/site-register-store.mjs",
        "src/lib/task-progress-measurement.js",
        "src/lib/video-audio-extractor.mjs",
        "src/lib/video-frame-extractor.mjs",
        "src/lib/voice-progress-draft.mjs",
        "src/lib/whatsapp/tenant-workspace-policy.js",
        "src/lib/workspace-http.mjs",
        "src/lib/workspace-policy.mjs"
      ],
      "externalImports": [
        "ffmpeg-static",
        "jsqr",
        "lucide-react",
        "next/navigation",
        "node:child_process",
        "node:crypto",
        "node:fs/promises",
        "node:os",
        "node:path",
        "node:perf_hooks",
        "react"
      ],
      "currentManifest": [
        {
          "path": "src/app/(identity)/cuenta/company-bootstrap-panel.js",
          "sha256": "f8fabe5917469d3303328ebdfc447fc4c6f3bd2e1f407abbd97c4ba7b8e713d3"
        },
        {
          "path": "src/app/(identity)/cuenta/company-bootstrap-panel.module.css",
          "sha256": "a8cadc4631ef54a18578344d93b8bed8568fbd847abce0cd02c57b2e7969dcdf"
        },
        {
          "path": "src/app/(identity)/cuenta/company-channel-panel.js",
          "sha256": "b41b9fd9a0fa16a25914b8d074ffbac1588b5d26dcca0310a8626ee211154a24"
        },
        {
          "path": "src/app/(identity)/cuenta/company-channel-panel.module.css",
          "sha256": "365d5f5884c39e239e0e0bf2ce5da2d37791a2d2ce5ce2e3c5d3021cc96db66e"
        },
        {
          "path": "src/app/(identity)/cuenta/company-channel-view.mjs",
          "sha256": "c79c473999e444b84e2a1d58e0d03f030069c24f9749f2c84450318b0b237e4d"
        },
        {
          "path": "src/app/(identity)/cuenta/company-subscription-panel.js",
          "sha256": "0b208fdcbea4900bd6adf86ad80f8524b5afa647d78a24fbf5731d3d7d79c749"
        },
        {
          "path": "src/app/(identity)/cuenta/company-subscription-panel.module.css",
          "sha256": "fdede43a09f48b011f7e3cb184ea16bf0be0e98069e7a953b71b8e391b3dfa3e"
        },
        {
          "path": "src/app/(identity)/cuenta/company-subscription-view.mjs",
          "sha256": "d009632c97d18084a1907bd7dedcf140f1a5d4ee0b55dd95f33d83be152dfc9c"
        },
        {
          "path": "src/app/(identity)/cuenta/company-usage-panel.js",
          "sha256": "01beddb3b88861bda1549169cc885bc682bd5446e4289521e5a36a6386ac37aa"
        },
        {
          "path": "src/app/(identity)/cuenta/company-usage-view.mjs",
          "sha256": "27cb4b607405186f57d70ffa7d78b1b2f9456486a4bfeb40b0157c9c52a2dc29"
        },
        {
          "path": "src/app/(identity)/cuenta/constructor-crm-panel.js",
          "sha256": "9447f5d87002193e34b99c1276a958b0e00539a901e372ce4e16584358d54554"
        },
        {
          "path": "src/app/(identity)/cuenta/constructor-crm-panel.module.css",
          "sha256": "8d99b34339e2f4d434cda5abbd9a1bf11c13d1335cb407fcfad6629810d98bf4"
        },
        {
          "path": "src/app/(identity)/cuenta/constructor-crm-view.mjs",
          "sha256": "9e0520a9f15c86d9b79b85bad2067b4dcdba3c82b1d3e6b32b86f811f79bf885"
        },
        {
          "path": "src/app/(identity)/cuenta/customer-inbox-panel.js",
          "sha256": "a933afae1cecb3e523d37904ee6f9543c958b738f6abbb4eb013cf12c1535909"
        },
        {
          "path": "src/app/(identity)/cuenta/customer-inbox-panel.module.css",
          "sha256": "abfcade899997a72ad9789020d8223257cc35128657cae6a74df386dc22381f3"
        },
        {
          "path": "src/app/(identity)/cuenta/customer-inbox-view.mjs",
          "sha256": "c38e1d18d59fa2be870fc90cdd748dcb3d3b24e805aa5924f4a79ae5733a001f"
        },
        {
          "path": "src/app/(identity)/cuenta/customer-whatsapp-panel.js",
          "sha256": "d129c4aa22e8048e03674382828222e5141e219f5d12368139a75ae735c9b247"
        },
        {
          "path": "src/app/(identity)/cuenta/customer-whatsapp-panel.module.css",
          "sha256": "00e35b2fcea0140d639c6207ae7c33476e8075c297ffec1aebebefaae3ccc136"
        },
        {
          "path": "src/app/(identity)/cuenta/customer-whatsapp-view.mjs",
          "sha256": "baae13c4e846d6e9787a58dc9ca83ee45e3a79cafd87d104dc68c16da4b31437"
        },
        {
          "path": "src/app/(identity)/cuenta/demo-pilot-panel.js",
          "sha256": "f2d9b7bfaf481c4ca1f8b9b2120bfe688375f745508c249cf04112178dab9270"
        },
        {
          "path": "src/app/(identity)/cuenta/demo-pilot-view.mjs",
          "sha256": "8816f95d81094b0a44c8e1dec5b94b4886ee493e4dd8caaec0d9eb95adbdbf01"
        },
        {
          "path": "src/app/(identity)/cuenta/employee-intake-continuity.mjs",
          "sha256": "11ca9957e2d04545485617e2cefa939673e2ad5b3e45943b5c9ba24b28f5b8ee"
        },
        {
          "path": "src/app/(identity)/cuenta/employee-intake-panel.js",
          "sha256": "111fc1e7918fe28d2e9aa9f1dd3abc63c7d18c45e8dc6d328d1b0b3c64361b46"
        },
        {
          "path": "src/app/(identity)/cuenta/field-hours-report-panel.js",
          "sha256": "d91074b8b1693c95dcf80a86fc73711fbd98a7ba482251ade68fd227166fb748"
        },
        {
          "path": "src/app/(identity)/cuenta/field-hours-report-panel.module.css",
          "sha256": "0c8eefb85891cade983a42b7f4463962319c9fe27c0c5d157011108255c2bd75"
        },
        {
          "path": "src/app/(identity)/cuenta/field-media-capture.js",
          "sha256": "f8019225870bc6ccf04818ad7ff305798d53ea9b523400385816ba7fe2117559"
        },
        {
          "path": "src/app/(identity)/cuenta/field-media-held-view.mjs",
          "sha256": "cfc01204f973281e77a49627c7c5e32c6bdd04a1bc4c6e0a9e93773eca4faf71"
        },
        {
          "path": "src/app/(identity)/cuenta/field-media-preparation.mjs",
          "sha256": "df03121d9a7beb6b4a77946cefb09ce00710a6e22b5c8b680b180dd5a2e64a6f"
        },
        {
          "path": "src/app/(identity)/cuenta/field-media-preview.js",
          "sha256": "d39d47da18f60c69a38eee22b62929087a7cc0b379a620af8a83b62573161110"
        },
        {
          "path": "src/app/(identity)/cuenta/field-operations-panel.js",
          "sha256": "69af7d8b95378f0b7f26f880eaec61d891c38744e9e6781eca9fe539776a91ed"
        },
        {
          "path": "src/app/(identity)/cuenta/field-operations-panel.module.css",
          "sha256": "5ccd8b5beae691b9ab6ee2dc0c0ae876a5fdffe15d31d24c6807f117bd76949c"
        },
        {
          "path": "src/app/(identity)/cuenta/field-overtime-view.js",
          "sha256": "161a09cb92b09695c4007cf99c3c7755586bf8e05d7f93e147fe9f1bfb45ca60"
        },
        {
          "path": "src/app/(identity)/cuenta/field-overtime-view.module.css",
          "sha256": "e7f9e4ff4216fdb18b333d0b8cd40a5b3158e5f2e398f6207ab5cea2789fcf7a"
        },
        {
          "path": "src/app/(identity)/cuenta/field-qr-capture.js",
          "sha256": "3bc42cb87ec6554a9ac6001b199f434f087e4156139d76428d1ebaf43d12e37d"
        },
        {
          "path": "src/app/(identity)/cuenta/field-qr-reader.mjs",
          "sha256": "04157b9fc7a197271bac76d41217db8876b42dc6fbc6cb068a7052d2ea2b5b31"
        },
        {
          "path": "src/app/(identity)/cuenta/field-review-page-view.mjs",
          "sha256": "18f3616144c03aacf9c9859ae210150d92f6838de7332cee2550fa5fe91603fb"
        },
        {
          "path": "src/app/(identity)/cuenta/kyc-photo-preparation.js",
          "sha256": "88137686826cc411d6fcc103b0085390c0cc16f69572cf45c2385bcde69f943d"
        },
        {
          "path": "src/app/(identity)/cuenta/material-inventory-panel.js",
          "sha256": "0faadb854099ef161b9c869cc2b4c0aeb16d102e59fcaca8ef27fecd614d2924"
        },
        {
          "path": "src/app/(identity)/cuenta/material-inventory-panel.module.css",
          "sha256": "1d7eec4afc275ee403674b187acb7844e3df519f24cd537af2e05f7b8032611c"
        },
        {
          "path": "src/app/(identity)/cuenta/material-inventory-view.mjs",
          "sha256": "8b987424dd1db2332cbb26f792e51c8fea286bd5440f4d3235809e3869722b83"
        },
        {
          "path": "src/app/(identity)/cuenta/meta-existing-api-plan-view.mjs",
          "sha256": "c44cbf28f4642b7c60109668d60354acc298439653e34fd13aa6610e5e9e5588"
        },
        {
          "path": "src/app/(identity)/cuenta/meta-onboarding-panel.js",
          "sha256": "314f7b6b6e160a4c58f9f373ff6970d049ad4feefea7501a5d29ad4d63613af8"
        },
        {
          "path": "src/app/(identity)/cuenta/meta-onboarding-panel.module.css",
          "sha256": "47ddd495c465ce9c9c4d75df19c722fb35f3e9873396f95d948f43031efe760b"
        },
        {
          "path": "src/app/(identity)/cuenta/meta-onboarding-readiness-view.mjs",
          "sha256": "78d15f464576d77c5a676a8c9a682dea4a3f43113fdaa898237b75478ec5132c"
        },
        {
          "path": "src/app/(identity)/cuenta/meta-sdk-loader.mjs",
          "sha256": "3a2dcc3d99a29e7b1adffb833ae206e14990d18cc32025b4a31b21728a7c4d88"
        },
        {
          "path": "src/app/(identity)/cuenta/office-review-panel.js",
          "sha256": "6743f03b2a01fcb80f1b63069717fff0daa68e9c76bc97eed90fc7c270622ce1"
        },
        {
          "path": "src/app/(identity)/cuenta/office-review-panel.module.css",
          "sha256": "4e1ca532b4cf582d13dbd9a3de1b54f1c2ae97b360a69a5df628ad34780d9725"
        },
        {
          "path": "src/app/(identity)/cuenta/office-review-view.mjs",
          "sha256": "84762ddace81533b1684f23f9abafe8a06a3847fdd01fbbf67c84014c4e396f3"
        },
        {
          "path": "src/app/(identity)/cuenta/operations-status-panel.js",
          "sha256": "e069565737378ca2583609a4b978d1ac6efdf9da922736b1bcf70d4674e84b5e"
        },
        {
          "path": "src/app/(identity)/cuenta/operations-status-panel.module.css",
          "sha256": "73d25fe9f75c2144aeb337dd0737c3cae3f07fb98c9acb39d6e6c88a4e6053ef"
        },
        {
          "path": "src/app/(identity)/cuenta/own-company-number-panel.js",
          "sha256": "d2146290e43adb77dc14b707787023a24ffe80c39e69eaa49fc876dcab3d267b"
        },
        {
          "path": "src/app/(identity)/cuenta/own-company-number-view.mjs",
          "sha256": "6940f11e30d2958d7f6771463ce28ca83c0e2d2f41e81aa220c8efe669580300"
        },
        {
          "path": "src/app/(identity)/cuenta/own-company-templates-panel.js",
          "sha256": "bf75e0cd2444493f07a90923ea73c4d0251e5cef0ab8516b8693cff395d5e91d"
        },
        {
          "path": "src/app/(identity)/cuenta/own-company-templates-view.mjs",
          "sha256": "3bf758b150336613a437e2b01d3b6a79645a024b771f1515f4ec2ae58a1b8bc3"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-account-discovery-format.mjs",
          "sha256": "3b9908b1a5e348dc7379a026f4e1d81942a7fa6b2b51e509fc5736586ed9fa1a"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-account-discovery.js",
          "sha256": "e53350614d51a51ba4f0d9b39a5a91bccd799fe65f3365d7746beb3fec3f6909"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-civil-data-panel.js",
          "sha256": "ea4a133fbf95065ca7a4a5ce2635cb60f80557d3f7f0c82e4129a68c42694807"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-civil-data-view.mjs",
          "sha256": "b475b011c2466d722ceecf64460b8b97eb5eedafd2fd873d5d8d97c889dcc1ff"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-kyc-capture.js",
          "sha256": "83ee427bbbecbf74aee901fd77c6981232a2cd07e235180566938c2c0201647d"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-kyc-capture.module.css",
          "sha256": "51b47533e4e6e1ce53038fc776fcd15f30e5893af472ccebd80f5e19d5e23f0f"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-kyc-chat-attempt-panel.js",
          "sha256": "153d39988f1b82e143e2c3c99b72ed0791687a70432246e16ae4c91c1fb395ee"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-kyc-chat-attempt-view.mjs",
          "sha256": "0a6aa93d1646bc7eedecf56b1dc84deb0b146f7386017eafa5affe255e40c52b"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-kyc-preanalysis-view.mjs",
          "sha256": "0e57a89f39f1ad3c0a00c27524d9c7b6a1b92d4610d7927c33f0afc791c63213"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-ocr-usage-view.mjs",
          "sha256": "29d3eecf963a9569cfc692f0f35f404c431b844d2e7f6476d62a38ad4c8ec2f9"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-office-account-view.mjs",
          "sha256": "f2716f72297a1277946bafa03a82d4c1fb7f2fcff7f4c4bbe155a86ed7e4e379"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-onboarding-next-step.mjs",
          "sha256": "18481bd2c61887a04321523aad36aa22c43406089e29f1450ff0874133a6d4ae"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-panel.js",
          "sha256": "a9d5934c7bda61c49362ac53cfb339a5d66497566f71415ecc4621686ce17519"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-panel.module.css",
          "sha256": "c1626d1a678f1060b1ccb9df106f32b041da2c3b2bd92ede3e65537aaf794c02"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-baseline-panel.js",
          "sha256": "d2d4bb3d3129e30d9181ab56b297723e105bde52aef6be9f907914340638329d"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-baseline-view.mjs",
          "sha256": "0c696eba748a7441440e23be5085dc42d4954427def5adc1e2de686b4b11711d"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-baseline.module.css",
          "sha256": "e33df0e4af4217f0516fecf5efef8eefef4278522ccfe1f97a1ad76390441b60"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-import-calendar-suggestions.mjs",
          "sha256": "be73d51220557e395295700a238024d9896ef627a305718518214fc7bd227457"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-import-panel.js",
          "sha256": "d74f0cdff0da1c173bc2ef566fed973ca02dd6bcc449aa8c3842d5109954d5f6"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-import-panel.module.css",
          "sha256": "c64771e75e83b6708ede012f90636bac1d13c19a3c1088c685513e702cc69061"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-import-usage-view.mjs",
          "sha256": "666668e0267f77599f191ca5ffa038da11232ad8bb08806d2b46d9193994a186"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-measurement-panel.js",
          "sha256": "d9d1cd683a8aaf0ad1ea5656c03c12c00935c3653f54d9326196617b60039832"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-measurement-panel.module.css",
          "sha256": "8290affa492be1699acb568c2ee4c8c5c672b3f2b06e2917f541c72bdacbde3a"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-measurement-view.mjs",
          "sha256": "02a80449af709fdda97dfaf48b0335bd96ab7dc363804f59a5d9ea8579581d30"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-partida-measurement-preview.js",
          "sha256": "e68aa0851e4d415408c21df76d3716c4e4196925223c155a96194d7db85566d8"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-partida-measurement-preview.mjs",
          "sha256": "f30a1c21396f61a1808446d9660554132b5df654e633d128dfe2f76336a9adc5"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-partida-source-preview.js",
          "sha256": "0869d7e7a5efe5e05e7b5f5f729da9e58d9f106329e31baf6ea79cabf990d3a9"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-partida-source-preview.mjs",
          "sha256": "fcd3a41c62138e77fc026c6651a0a228d9f4507b0a87c82a3b113b0e4fc26e8d"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-partida-source-preview.module.css",
          "sha256": "da7cfec61d043d0f217e706701994fb41ed1973733ccd37a35698f743aefd9ee"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-source-curve.js",
          "sha256": "b0f1ef1fee082e82f18d4bd2fb13377b27d8f9849e831f2c34120164f93f9a12"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-source-curve.mjs",
          "sha256": "689402d373744d159a62e2e5975ddfdf79053c528a838879dd5df3e43a0efdc9"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-source-curve.module.css",
          "sha256": "92f94328baac3fb0416002db12b5c19923fc28e6f89cb625df10038e0a96a180"
        },
        {
          "path": "src/app/(identity)/cuenta/portfolio-overview-panel.js",
          "sha256": "91940070e73099386731e669d3f4059564b72d1ad82691434d64dcac17adc318"
        },
        {
          "path": "src/app/(identity)/cuenta/portfolio-overview-panel.module.css",
          "sha256": "af5230820ce3c994d93e2262bc676ae5e3d69ffa380a866095fb88d997527c8c"
        },
        {
          "path": "src/app/(identity)/cuenta/portfolio-overview-view.mjs",
          "sha256": "8446fc933db4a867235a61ffbafdbbd0bcdc94d97000d5990c795df9e884739e"
        },
        {
          "path": "src/app/(identity)/cuenta/private-bank-account-format.mjs",
          "sha256": "4dcf7f2de2f49f97f155e14128b20815f538d659d5e82806fa45a18d541adeea"
        },
        {
          "path": "src/app/(identity)/cuenta/private-bank-account-panel.js",
          "sha256": "8c419e76293791fc441dc8685386d12498a3d3cca2938ae0cba0f7dc7c0c1180"
        },
        {
          "path": "src/app/(identity)/cuenta/private-bank-account-panel.module.css",
          "sha256": "269dd7c7c5e43bc959ef80dd94e3ab1cfd42b96b02d9c648ab21c281329796db"
        },
        {
          "path": "src/app/(identity)/cuenta/private-workspace-download.js",
          "sha256": "d86399de71069a9ca9a1fb330692f87728bf44b8b0b59ca691d457357a0eddab"
        },
        {
          "path": "src/app/(identity)/cuenta/project-creation-format.mjs",
          "sha256": "7cef11fff2447564b56b253d2105c3589b100d8374e4633321be1b96e7e75d8f"
        },
        {
          "path": "src/app/(identity)/cuenta/project-creation-panel.js",
          "sha256": "5c0cec226b92fa2a59d1e03cb2aea489bf8016304a43bd6259e35fd45fef2d92"
        },
        {
          "path": "src/app/(identity)/cuenta/project-creation-panel.module.css",
          "sha256": "a111badb3ae7bd4c1189a19670d2096bef482c3789d01bd7400677f13dd46d06"
        },
        {
          "path": "src/app/(identity)/cuenta/project-preparation-format.mjs",
          "sha256": "7833eea1fd3b0c86733172c580b2d0178aa76cc3acae1a0b80e54e51dcb06a19"
        },
        {
          "path": "src/app/(identity)/cuenta/project-preparation-panel.js",
          "sha256": "a8d6086ce10a40c44b74e5472ee6f0a05946118014cfa93dfc4ceff4611dc2ac"
        },
        {
          "path": "src/app/(identity)/cuenta/project-preparation-panel.module.css",
          "sha256": "a7766d92df0049fa05ce4d28baf30c655bd8f268e6fbf3a8462ae2cda326ee64"
        },
        {
          "path": "src/app/(identity)/cuenta/schedule-workbench.js",
          "sha256": "b214b66dcd910728798a3084b5d3698296e458db67855f38bc820aaebee75d8c"
        },
        {
          "path": "src/app/(identity)/cuenta/schedule-workbench.mjs",
          "sha256": "12a01f0ec44b65b70ca50f5fabcba2483e964d87556dcf62db92c84d4c2ee022"
        },
        {
          "path": "src/app/(identity)/cuenta/schedule-workbench.module.css",
          "sha256": "6643a7082034e523d9aaa9ba23195634dbfdd7a37cdf0cb3b9f02cbd13f5e11b"
        },
        {
          "path": "src/app/(identity)/cuenta/site-purchase-panel.js",
          "sha256": "398697fb4d8850ca7f0738fc93a3f17b4313e7afdbbe9e9d1a87e9b613bd0225"
        },
        {
          "path": "src/app/(identity)/cuenta/site-purchase-panel.module.css",
          "sha256": "3fe757c073165128724352333e73a04f6741ac70b4c59fc0d100af025c284f04"
        },
        {
          "path": "src/app/(identity)/cuenta/site-purchase-view.mjs",
          "sha256": "58ebd978e8e39423901cb811ecf2ab851160b78f7cd5cb441075d66d7819dee9"
        },
        {
          "path": "src/app/(identity)/cuenta/site-register-panel.js",
          "sha256": "e8c0c456e09e9da3432dcbf01c1f4659540a596112fe28946889ae369d08d76e"
        },
        {
          "path": "src/app/(identity)/cuenta/site-register-panel.module.css",
          "sha256": "7d86974d7db3279116895cde681e231f135fb1a86e7e8b52bf74e7bb965fd0e2"
        },
        {
          "path": "src/app/(identity)/cuenta/task-create-panel.js",
          "sha256": "3d4b8f9865cdfa73b1f8c3543c4c4400babc09fe56cd21083d0bb96035445bee"
        },
        {
          "path": "src/app/(identity)/cuenta/task-progress-measurement-editor.js",
          "sha256": "2e95b587d9b6f4bfa1beb1eacdba44c4db8a7220cb6584befc6b4de79bf11eac"
        },
        {
          "path": "src/app/(identity)/cuenta/task-progress-measurement-editor.module.css",
          "sha256": "ca9b2e0432724c74a194d2648ff8dd3e7814ff192046ec02ab9f23e31d778b79"
        },
        {
          "path": "src/app/(identity)/cuenta/task-progress-measurement-view.mjs",
          "sha256": "b4b1e2645a7b4b853ba84525692b4d73596ea5490a6c000bbe9d2555cc286634"
        },
        {
          "path": "src/app/(identity)/cuenta/template-send-panel.js",
          "sha256": "c2ed4900b2f842031b713ce1d859e69e23e6278ca012c4d7b6011058c5bdc2ea"
        },
        {
          "path": "src/app/(identity)/cuenta/template-send-panel.module.css",
          "sha256": "de30d752855458140928f677e00ada91b80ad7ba574b3183b62b3d45f1e5eb56"
        },
        {
          "path": "src/app/(identity)/cuenta/template-send-view.mjs",
          "sha256": "703415b8dab1a575ebb54c9273049d2b940f93994add7177255ae26918672940"
        },
        {
          "path": "src/app/(identity)/cuenta/voice-progress-draft-view.js",
          "sha256": "a21b205b409cbbf6321036b23bc8a873d5d32388f4bad883793278531cec8d9a"
        },
        {
          "path": "src/app/(identity)/cuenta/worker-channel-panel.js",
          "sha256": "7325f3b80c5737fd39a266d0c77de703ff5515177b8945ecfa33c5250213903d"
        },
        {
          "path": "src/app/(identity)/cuenta/worker-channel-panel.module.css",
          "sha256": "28d5e1754f9345073d9a34d737f4e8b89c2f2f04e610e85c285ba81ea4f6e9ff"
        },
        {
          "path": "src/app/(identity)/cuenta/worksite-task-selector.js",
          "sha256": "d790aeec929ed1ef2ac724883988b03f6640f3882133d917760f0ddeb2a2488c"
        },
        {
          "path": "src/app/(identity)/cuenta/worksite-task-selector.module.css",
          "sha256": "12351228e827ea0e9a42a45f4d40a3fb713edd01bf0aab3ab6f58efbde7fa434"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-client.js",
          "sha256": "2fe5a56a7caf7d46f11e4292d2e145e3e72072198a09f9951ace42c2613e8db9"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-live-read.mjs",
          "sha256": "a73e558f46b86a78cbe4f22783403af17061fe03e79f8e184f967448041909ec"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-live-refresh-controller.mjs",
          "sha256": "a61c2d017bc8dadb79fab4b0630b0404b65132d355e153bcb6a2042f5fd49511"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-live-refresh.js",
          "sha256": "78b056667e89f56fd9e1185c3addc6a8d40b331a0cd82146cbba17771662510a"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-overview.js",
          "sha256": "456e78d9e5c729182e65cd30141af37a5a6571d05261896ab5e19e39c4951c1b"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-recovery-journal.mjs",
          "sha256": "060e128b54eefdadfbabac45c3ec696934f5e74d79b9e26e905081128e8e99c5"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-recovery-panel.js",
          "sha256": "063361bf78293a61a246195d5734f69a17b08c5781ae5c9f502b85dcc51ef883"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-recovery-storage.mjs",
          "sha256": "d8cf1e7e8d88d66f722aaf52deb45f95829c226468d3f37a2b23d171cc1ecbb8"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-request-lifecycle.js",
          "sha256": "b3004538de2cc7cbc829bf5518c4f4b2a5eb2935d0b4e60f9c88840c8ede3797"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-request-lifecycle.mjs",
          "sha256": "590cd7691d8b6beb82929bdd18dd9909c2d2cfa1c3d4111ff4d478d57daf532f"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-screen.js",
          "sha256": "b5c217095badf8db73842b98d86b6ae498da9f01b793ccda3683dc46be040b4a"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-session-request.mjs",
          "sha256": "29d294ac1d973317d6a3df225a64a8a9115c6ea51c587f297114e7992af97520"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-task-page.mjs",
          "sha256": "9dde484ab352b4d64d0301e735ae511d7a75ef9633439e77558dd273de1d9aa6"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-tools-navigation.js",
          "sha256": "6e3bc5b9d14973153e080a55ba55a51f1c36838641c8510af4f2f664e676ddc9"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-tools-navigation.module.css",
          "sha256": "25e6e54bc34821a658490e0276f92aae48675fdcca8f9a4b563acb49b81d5b06"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-view-routing.mjs",
          "sha256": "d02f2d11ec5ce4a1419ed79c9639cdad40174c236382853778fc984f071e4df4"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace.module.css",
          "sha256": "339fee2591a341bbb7839a19d55a5c298c728ef1de38a2efc3680999f4636db4"
        },
        {
          "path": "src/lib/company-entitlement.mjs",
          "sha256": "65d41dfb796ef12be38b1220a99ccd3dfe277419a5e5a27e125beb29fe7e2cde"
        },
        {
          "path": "src/lib/company-phone-format.mjs",
          "sha256": "67b31114f517253961c6a774210f157867b1e2e318e6b700089eef03ef1b7209"
        },
        {
          "path": "src/lib/field-hours-report.mjs",
          "sha256": "b55b767d61278bde31cb9ce4ef64faee5320fc7fe1b1bcc54559860bb4576731"
        },
        {
          "path": "src/lib/field-media-privacy.mjs",
          "sha256": "5ec7fc7dd71f9303a42bfb4889e02541de8a3cf356e8e1203cfeeefd56220515"
        },
        {
          "path": "src/lib/field-media.mjs",
          "sha256": "940e681d1430fc211093b16f5407637fcd31d270a3d99234f748fe7db73cc0bb"
        },
        {
          "path": "src/lib/field-operations-http.mjs",
          "sha256": "df60181e3d852efe42d86a284ced3c0ff9cf4c7fbcaf863de8da4d47c2f7aeaf"
        },
        {
          "path": "src/lib/field-operations-policy.mjs",
          "sha256": "01eb863d7db4446eeb8dab990d7e0602a19d581d5615a0b1e5d50c02f3d70173"
        },
        {
          "path": "src/lib/field-operations-store.mjs",
          "sha256": "dbf96641349efae61808a2d66a02d491ad06e2226885e6efa928dba53ce5034e"
        },
        {
          "path": "src/lib/field-overtime-policy.mjs",
          "sha256": "76848bd0861d6cecccb682b774599f03d3fe1322eed3cc58f5f1db5d9b1e24f8"
        },
        {
          "path": "src/lib/field-overtime-store.mjs",
          "sha256": "f29b67fff29949d5a8b14c4aed3f484ae1ce16d2ed42de486a6d5868361b1526"
        },
        {
          "path": "src/lib/field-report-feedback.mjs",
          "sha256": "70b966ae5f382abe6b5446daf1092c3f66b8f46f80ce5a0c006cffeba1cfa64c"
        },
        {
          "path": "src/lib/field-shift-summary.mjs",
          "sha256": "41f47aa7a0826ba1fe29b554c7575ec60c9861f0c18c863f06e8c3d00cb0f83c"
        },
        {
          "path": "src/lib/geo.js",
          "sha256": "fa47424540f953adf56e0c3069780c0c8876a2f69e944a80caddefa974b5b6bf"
        },
        {
          "path": "src/lib/identity-return-path.mjs",
          "sha256": "91f04f80b1a2dbc7d56b8dd4b532c0540d643c2b8f48cebc25c8fcbee8ab9cf0"
        },
        {
          "path": "src/lib/material-inventory.mjs",
          "sha256": "4b599d273c4cadcdf76202554757583152da8c11b0a754be386bffb830f0c65b"
        },
        {
          "path": "src/lib/meta-cloud-protocol.mjs",
          "sha256": "c6d5f1e1b4119dd2529860e3bd61a1b22d602f71ad301b2f04cec3ab4bbbed3c"
        },
        {
          "path": "src/lib/participant-approved-identity.mjs",
          "sha256": "834d81e70cedbd967ff84d880ea9d697c2168d2220fb23d9eb14c1aba1cdbbf1"
        },
        {
          "path": "src/lib/participant-kyc-image-set.mjs",
          "sha256": "190ce2560286a58d42668da7b912aeabcfa76ee14086503bf1609304e5f0e8fb"
        },
        {
          "path": "src/lib/person-worksite-journey.mjs",
          "sha256": "d3174df793150125c0b6a5d9f37d56336e72cab1efb43a361065b78ac54c210a"
        },
        {
          "path": "src/lib/plan-import-cyp-curve.mjs",
          "sha256": "7e1d6c9d87df5e74e0a340361e1e66fdf0cfd5c82f1e44030ba2e85b5fa9c342"
        },
        {
          "path": "src/lib/plan-import-document-curve.mjs",
          "sha256": "7f63d62b9f1ae6d139c627a978ef56d7eafea0e0f4271167daa4c00bf7fda013"
        },
        {
          "path": "src/lib/private-image-upload.mjs",
          "sha256": "1eaeda2fa79104cfe00a8736c466d8568d216c8682bd44031d3bf9d4f35e3f60"
        },
        {
          "path": "src/lib/procurement-quantity.js",
          "sha256": "53439844051cc1dbd679220d695e60e54bc1629b2f1ddb33fc125981da9326b3"
        },
        {
          "path": "src/lib/progress-measurement-quantity.js",
          "sha256": "e194f461d482dec666c090a19aabbd3498bc08964cbbbc31b8db6eeb39cb1be2"
        },
        {
          "path": "src/lib/site-register-policy.mjs",
          "sha256": "d529c4f2225e0ec851ef7df60f8c5b182a88b384958ebfd15b194683d1590434"
        },
        {
          "path": "src/lib/site-register-store.mjs",
          "sha256": "6b744c86f47dbb6dc081132675888615d76421701f96151b00646b5e1d2529c6"
        },
        {
          "path": "src/lib/task-progress-measurement.js",
          "sha256": "10361a0e30df34f9c90f915d9fdbfc0912a610ab3ce851503c32549b7049a8b9"
        },
        {
          "path": "src/lib/video-audio-extractor.mjs",
          "sha256": "0c85dfd39c10fdb782eca4fe57dc665c29bd7211ab7aba0dda3f8945abcb1988"
        },
        {
          "path": "src/lib/video-frame-extractor.mjs",
          "sha256": "33425a184cf097884982c43a90e3b515726027adbeb51c2cdbfc794e79dee6e6"
        },
        {
          "path": "src/lib/voice-progress-draft.mjs",
          "sha256": "56ddbad919a1ad77e13105f1a125914674c1a149a88e28fa2f8b831a4d14bd69"
        },
        {
          "path": "src/lib/whatsapp/tenant-workspace-policy.js",
          "sha256": "d3416ff993fbfd70f75404166cdcd8f0b9b2e5a6741f6cde03725aab16abcd5e"
        },
        {
          "path": "src/lib/workspace-http.mjs",
          "sha256": "b4e56dcd8ecbbc40c9b5f7d0e610e6f16eeb69143d46397279044e69ca5b8429"
        },
        {
          "path": "src/lib/workspace-policy.mjs",
          "sha256": "ba51cc5c4a6e4f5ce1c9382cae2c8ea903ab4373668c05384c7f1e9253c7041e"
        }
      ]
    },
    {
      "family": "PILOT_LIVE_BROWSER",
      "previousExternalImports": [
        "@babel/parser",
        "jsqr",
        "lucide-react",
        "node:assert/strict",
        "node:child_process",
        "node:crypto",
        "node:fs",
        "node:net",
        "node:path",
        "node:timers/promises",
        "node:url",
        "puppeteer",
        "react"
      ],
      "currentFiles": [
        "package-lock.json",
        "package.json",
        "scripts/lib/owned-fixture-cleanup.mjs",
        "scripts/lib/worksite-live-pilot-browser-fixture.mjs",
        "scripts/lib/worksite-live-pilot-browser-scenarios.mjs",
        "scripts/verify-worksite-live-refresh-ui.mjs",
        "src/app/(identity)/cuenta/company-channel-view.mjs",
        "src/app/(identity)/cuenta/field-hours-report-panel.js",
        "src/app/(identity)/cuenta/field-hours-report-panel.module.css",
        "src/app/(identity)/cuenta/field-media-capture.js",
        "src/app/(identity)/cuenta/field-media-held-view.mjs",
        "src/app/(identity)/cuenta/field-media-preparation.mjs",
        "src/app/(identity)/cuenta/field-media-preview.js",
        "src/app/(identity)/cuenta/field-operations-panel.js",
        "src/app/(identity)/cuenta/field-operations-panel.module.css",
        "src/app/(identity)/cuenta/field-overtime-view.js",
        "src/app/(identity)/cuenta/field-overtime-view.module.css",
        "src/app/(identity)/cuenta/field-qr-capture.js",
        "src/app/(identity)/cuenta/field-qr-reader.mjs",
        "src/app/(identity)/cuenta/field-review-page-view.mjs",
        "src/app/(identity)/cuenta/own-company-number-view.mjs",
        "src/app/(identity)/cuenta/own-company-templates-view.mjs",
        "src/app/(identity)/cuenta/participant-office-account-view.mjs",
        "src/app/(identity)/cuenta/plan-baseline-view.mjs",
        "src/app/(identity)/cuenta/plan-source-curve.mjs",
        "src/app/(identity)/cuenta/private-bank-account-format.mjs",
        "src/app/(identity)/cuenta/private-workspace-download.js",
        "src/app/(identity)/cuenta/schedule-workbench.js",
        "src/app/(identity)/cuenta/schedule-workbench.mjs",
        "src/app/(identity)/cuenta/schedule-workbench.module.css",
        "src/app/(identity)/cuenta/site-purchase-view.mjs",
        "src/app/(identity)/cuenta/task-progress-measurement-view.mjs",
        "src/app/(identity)/cuenta/voice-progress-draft-view.js",
        "src/app/(identity)/cuenta/worksite-task-selector.js",
        "src/app/(identity)/cuenta/worksite-task-selector.module.css",
        "src/app/(identity)/cuenta/workspace-client.js",
        "src/app/(identity)/cuenta/workspace-live-read.mjs",
        "src/app/(identity)/cuenta/workspace-live-refresh-controller.mjs",
        "src/app/(identity)/cuenta/workspace-live-refresh.js",
        "src/app/(identity)/cuenta/workspace-recovery-journal.mjs",
        "src/app/(identity)/cuenta/workspace-recovery-storage.mjs",
        "src/app/(identity)/cuenta/workspace-request-lifecycle.js",
        "src/app/(identity)/cuenta/workspace-request-lifecycle.mjs",
        "src/app/(identity)/cuenta/workspace-session-request.mjs",
        "src/app/(identity)/cuenta/workspace-task-page.mjs",
        "src/lib/field-media-privacy.mjs",
        "src/lib/geo.js",
        "src/lib/plan-import-cyp-curve.mjs",
        "src/lib/plan-import-document-curve.mjs",
        "src/lib/progress-measurement-quantity.js",
        "src/lib/task-progress-measurement.js",
        "src/lib/voice-progress-draft.mjs"
      ],
      "externalImports": [
        "@babel/parser",
        "jsqr",
        "lucide-react",
        "node:assert/strict",
        "node:child_process",
        "node:crypto",
        "node:fs",
        "node:net",
        "node:path",
        "node:timers/promises",
        "node:url",
        "puppeteer",
        "react"
      ],
      "currentManifest": [
        {
          "path": "package-lock.json",
          "sha256": "dfa3ff3914547f35828a0b697e6007c6cf856546be86bf8a7810cdce59e60449"
        },
        {
          "path": "package.json",
          "sha256": "6b7918c67edddee946d9455aa71913987f54f8abe441e0c3e560560a89061c4d"
        },
        {
          "path": "scripts/lib/owned-fixture-cleanup.mjs",
          "sha256": "44a9df241dd8426fe8d148b1b33110fe1e103960814e81f1f9a41638d8613844"
        },
        {
          "path": "scripts/lib/worksite-live-pilot-browser-fixture.mjs",
          "sha256": "000d2a83a3506c9ffdac0b99b7ac15194f22a5dc983308c450f90d5e601da979"
        },
        {
          "path": "scripts/lib/worksite-live-pilot-browser-scenarios.mjs",
          "sha256": "44148fa89d677a5fd15954cbf3299187c9f8e4f8afbcefb7c079529c380364e2"
        },
        {
          "path": "scripts/verify-worksite-live-refresh-ui.mjs",
          "sha256": "572658b88e7fea6d58c64567e9cfc53927347ccc2e7f462d670eb5f3b6cd9b71"
        },
        {
          "path": "src/app/(identity)/cuenta/company-channel-view.mjs",
          "sha256": "c79c473999e444b84e2a1d58e0d03f030069c24f9749f2c84450318b0b237e4d"
        },
        {
          "path": "src/app/(identity)/cuenta/field-hours-report-panel.js",
          "sha256": "d91074b8b1693c95dcf80a86fc73711fbd98a7ba482251ade68fd227166fb748"
        },
        {
          "path": "src/app/(identity)/cuenta/field-hours-report-panel.module.css",
          "sha256": "0c8eefb85891cade983a42b7f4463962319c9fe27c0c5d157011108255c2bd75"
        },
        {
          "path": "src/app/(identity)/cuenta/field-media-capture.js",
          "sha256": "f8019225870bc6ccf04818ad7ff305798d53ea9b523400385816ba7fe2117559"
        },
        {
          "path": "src/app/(identity)/cuenta/field-media-held-view.mjs",
          "sha256": "cfc01204f973281e77a49627c7c5e32c6bdd04a1bc4c6e0a9e93773eca4faf71"
        },
        {
          "path": "src/app/(identity)/cuenta/field-media-preparation.mjs",
          "sha256": "df03121d9a7beb6b4a77946cefb09ce00710a6e22b5c8b680b180dd5a2e64a6f"
        },
        {
          "path": "src/app/(identity)/cuenta/field-media-preview.js",
          "sha256": "d39d47da18f60c69a38eee22b62929087a7cc0b379a620af8a83b62573161110"
        },
        {
          "path": "src/app/(identity)/cuenta/field-operations-panel.js",
          "sha256": "69af7d8b95378f0b7f26f880eaec61d891c38744e9e6781eca9fe539776a91ed"
        },
        {
          "path": "src/app/(identity)/cuenta/field-operations-panel.module.css",
          "sha256": "5ccd8b5beae691b9ab6ee2dc0c0ae876a5fdffe15d31d24c6807f117bd76949c"
        },
        {
          "path": "src/app/(identity)/cuenta/field-overtime-view.js",
          "sha256": "161a09cb92b09695c4007cf99c3c7755586bf8e05d7f93e147fe9f1bfb45ca60"
        },
        {
          "path": "src/app/(identity)/cuenta/field-overtime-view.module.css",
          "sha256": "e7f9e4ff4216fdb18b333d0b8cd40a5b3158e5f2e398f6207ab5cea2789fcf7a"
        },
        {
          "path": "src/app/(identity)/cuenta/field-qr-capture.js",
          "sha256": "3bc42cb87ec6554a9ac6001b199f434f087e4156139d76428d1ebaf43d12e37d"
        },
        {
          "path": "src/app/(identity)/cuenta/field-qr-reader.mjs",
          "sha256": "04157b9fc7a197271bac76d41217db8876b42dc6fbc6cb068a7052d2ea2b5b31"
        },
        {
          "path": "src/app/(identity)/cuenta/field-review-page-view.mjs",
          "sha256": "18f3616144c03aacf9c9859ae210150d92f6838de7332cee2550fa5fe91603fb"
        },
        {
          "path": "src/app/(identity)/cuenta/own-company-number-view.mjs",
          "sha256": "6940f11e30d2958d7f6771463ce28ca83c0e2d2f41e81aa220c8efe669580300"
        },
        {
          "path": "src/app/(identity)/cuenta/own-company-templates-view.mjs",
          "sha256": "3bf758b150336613a437e2b01d3b6a79645a024b771f1515f4ec2ae58a1b8bc3"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-office-account-view.mjs",
          "sha256": "f2716f72297a1277946bafa03a82d4c1fb7f2fcff7f4c4bbe155a86ed7e4e379"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-baseline-view.mjs",
          "sha256": "0c696eba748a7441440e23be5085dc42d4954427def5adc1e2de686b4b11711d"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-source-curve.mjs",
          "sha256": "689402d373744d159a62e2e5975ddfdf79053c528a838879dd5df3e43a0efdc9"
        },
        {
          "path": "src/app/(identity)/cuenta/private-bank-account-format.mjs",
          "sha256": "4dcf7f2de2f49f97f155e14128b20815f538d659d5e82806fa45a18d541adeea"
        },
        {
          "path": "src/app/(identity)/cuenta/private-workspace-download.js",
          "sha256": "d86399de71069a9ca9a1fb330692f87728bf44b8b0b59ca691d457357a0eddab"
        },
        {
          "path": "src/app/(identity)/cuenta/schedule-workbench.js",
          "sha256": "b214b66dcd910728798a3084b5d3698296e458db67855f38bc820aaebee75d8c"
        },
        {
          "path": "src/app/(identity)/cuenta/schedule-workbench.mjs",
          "sha256": "12a01f0ec44b65b70ca50f5fabcba2483e964d87556dcf62db92c84d4c2ee022"
        },
        {
          "path": "src/app/(identity)/cuenta/schedule-workbench.module.css",
          "sha256": "6643a7082034e523d9aaa9ba23195634dbfdd7a37cdf0cb3b9f02cbd13f5e11b"
        },
        {
          "path": "src/app/(identity)/cuenta/site-purchase-view.mjs",
          "sha256": "58ebd978e8e39423901cb811ecf2ab851160b78f7cd5cb441075d66d7819dee9"
        },
        {
          "path": "src/app/(identity)/cuenta/task-progress-measurement-view.mjs",
          "sha256": "b4b1e2645a7b4b853ba84525692b4d73596ea5490a6c000bbe9d2555cc286634"
        },
        {
          "path": "src/app/(identity)/cuenta/voice-progress-draft-view.js",
          "sha256": "a21b205b409cbbf6321036b23bc8a873d5d32388f4bad883793278531cec8d9a"
        },
        {
          "path": "src/app/(identity)/cuenta/worksite-task-selector.js",
          "sha256": "d790aeec929ed1ef2ac724883988b03f6640f3882133d917760f0ddeb2a2488c"
        },
        {
          "path": "src/app/(identity)/cuenta/worksite-task-selector.module.css",
          "sha256": "12351228e827ea0e9a42a45f4d40a3fb713edd01bf0aab3ab6f58efbde7fa434"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-client.js",
          "sha256": "2fe5a56a7caf7d46f11e4292d2e145e3e72072198a09f9951ace42c2613e8db9"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-live-read.mjs",
          "sha256": "a73e558f46b86a78cbe4f22783403af17061fe03e79f8e184f967448041909ec"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-live-refresh-controller.mjs",
          "sha256": "a61c2d017bc8dadb79fab4b0630b0404b65132d355e153bcb6a2042f5fd49511"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-live-refresh.js",
          "sha256": "78b056667e89f56fd9e1185c3addc6a8d40b331a0cd82146cbba17771662510a"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-recovery-journal.mjs",
          "sha256": "060e128b54eefdadfbabac45c3ec696934f5e74d79b9e26e905081128e8e99c5"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-recovery-storage.mjs",
          "sha256": "d8cf1e7e8d88d66f722aaf52deb45f95829c226468d3f37a2b23d171cc1ecbb8"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-request-lifecycle.js",
          "sha256": "b3004538de2cc7cbc829bf5518c4f4b2a5eb2935d0b4e60f9c88840c8ede3797"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-request-lifecycle.mjs",
          "sha256": "590cd7691d8b6beb82929bdd18dd9909c2d2cfa1c3d4111ff4d478d57daf532f"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-session-request.mjs",
          "sha256": "29d294ac1d973317d6a3df225a64a8a9115c6ea51c587f297114e7992af97520"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-task-page.mjs",
          "sha256": "9dde484ab352b4d64d0301e735ae511d7a75ef9633439e77558dd273de1d9aa6"
        },
        {
          "path": "src/lib/field-media-privacy.mjs",
          "sha256": "5ec7fc7dd71f9303a42bfb4889e02541de8a3cf356e8e1203cfeeefd56220515"
        },
        {
          "path": "src/lib/geo.js",
          "sha256": "fa47424540f953adf56e0c3069780c0c8876a2f69e944a80caddefa974b5b6bf"
        },
        {
          "path": "src/lib/plan-import-cyp-curve.mjs",
          "sha256": "7e1d6c9d87df5e74e0a340361e1e66fdf0cfd5c82f1e44030ba2e85b5fa9c342"
        },
        {
          "path": "src/lib/plan-import-document-curve.mjs",
          "sha256": "7f63d62b9f1ae6d139c627a978ef56d7eafea0e0f4271167daa4c00bf7fda013"
        },
        {
          "path": "src/lib/progress-measurement-quantity.js",
          "sha256": "e194f461d482dec666c090a19aabbd3498bc08964cbbbc31b8db6eeb39cb1be2"
        },
        {
          "path": "src/lib/task-progress-measurement.js",
          "sha256": "10361a0e30df34f9c90f915d9fdbfc0912a610ab3ce851503c32549b7049a8b9"
        },
        {
          "path": "src/lib/voice-progress-draft.mjs",
          "sha256": "56ddbad919a1ad77e13105f1a125914674c1a149a88e28fa2f8b831a4d14bd69"
        }
      ]
    },
    {
      "family": "HOURS_POSTGRES_NATIVE",
      "previousExternalImports": [
        "ffmpeg-static",
        "node:assert/strict",
        "node:child_process",
        "node:crypto",
        "node:fs",
        "node:fs/promises",
        "node:os",
        "node:path",
        "node:perf_hooks",
        "node:url",
        "pg"
      ],
      "currentFiles": [
        "scripts/lib/disposable-postgres-cleanup.mjs",
        "scripts/verify-field-hours-postgres.mjs",
        "scripts/verify-field-operations-postgres.mjs",
        "src/lib/field-hours-report.mjs",
        "src/lib/field-media-privacy.mjs",
        "src/lib/field-media.mjs",
        "src/lib/field-operations-http.mjs",
        "src/lib/field-operations-policy.mjs",
        "src/lib/field-operations-store.mjs",
        "src/lib/field-overtime-policy.mjs",
        "src/lib/field-overtime-store.mjs",
        "src/lib/field-report-feedback.mjs",
        "src/lib/field-shift-summary.mjs",
        "src/lib/geo.js",
        "src/lib/material-inventory.mjs",
        "src/lib/meta-cloud-protocol.mjs",
        "src/lib/participant-admission.mjs",
        "src/lib/participant-approved-identity.mjs",
        "src/lib/participant-kyc-image-set.mjs",
        "src/lib/person-worksite-journey.mjs",
        "src/lib/private-image-upload.mjs",
        "src/lib/procurement-quantity.js",
        "src/lib/progress-measurement-quantity.js",
        "src/lib/site-register-policy.mjs",
        "src/lib/site-register-store.mjs",
        "src/lib/task-progress-measurement.js",
        "src/lib/video-audio-extractor.mjs",
        "src/lib/video-frame-extractor.mjs",
        "src/lib/voice-progress-draft.mjs",
        "src/lib/workspace-http.mjs",
        "src/lib/workspace-policy.mjs",
        "src/lib/workspace-store.mjs"
      ],
      "externalImports": [
        "ffmpeg-static",
        "node:assert/strict",
        "node:child_process",
        "node:crypto",
        "node:fs",
        "node:fs/promises",
        "node:os",
        "node:path",
        "node:perf_hooks",
        "node:url",
        "pg"
      ],
      "currentManifest": [
        {
          "path": "scripts/lib/disposable-postgres-cleanup.mjs",
          "sha256": "df8d9f36b79cdd5f2d940c0dc4bbc88acbb0bec6e66c9ee5ae93ad5c6e4ab89e"
        },
        {
          "path": "scripts/verify-field-hours-postgres.mjs",
          "sha256": "b71ba90dff2a61d45151792c353c012e42debbaf1bf3a497f5ce638f5396783c"
        },
        {
          "path": "scripts/verify-field-operations-postgres.mjs",
          "sha256": "c3cf9eed8983b9ab43ad9b11cf0f59af206b08ba70f5e6697133bb448b940662"
        },
        {
          "path": "src/lib/field-hours-report.mjs",
          "sha256": "b55b767d61278bde31cb9ce4ef64faee5320fc7fe1b1bcc54559860bb4576731"
        },
        {
          "path": "src/lib/field-media-privacy.mjs",
          "sha256": "5ec7fc7dd71f9303a42bfb4889e02541de8a3cf356e8e1203cfeeefd56220515"
        },
        {
          "path": "src/lib/field-media.mjs",
          "sha256": "940e681d1430fc211093b16f5407637fcd31d270a3d99234f748fe7db73cc0bb"
        },
        {
          "path": "src/lib/field-operations-http.mjs",
          "sha256": "df60181e3d852efe42d86a284ced3c0ff9cf4c7fbcaf863de8da4d47c2f7aeaf"
        },
        {
          "path": "src/lib/field-operations-policy.mjs",
          "sha256": "01eb863d7db4446eeb8dab990d7e0602a19d581d5615a0b1e5d50c02f3d70173"
        },
        {
          "path": "src/lib/field-operations-store.mjs",
          "sha256": "dbf96641349efae61808a2d66a02d491ad06e2226885e6efa928dba53ce5034e"
        },
        {
          "path": "src/lib/field-overtime-policy.mjs",
          "sha256": "76848bd0861d6cecccb682b774599f03d3fe1322eed3cc58f5f1db5d9b1e24f8"
        },
        {
          "path": "src/lib/field-overtime-store.mjs",
          "sha256": "f29b67fff29949d5a8b14c4aed3f484ae1ce16d2ed42de486a6d5868361b1526"
        },
        {
          "path": "src/lib/field-report-feedback.mjs",
          "sha256": "70b966ae5f382abe6b5446daf1092c3f66b8f46f80ce5a0c006cffeba1cfa64c"
        },
        {
          "path": "src/lib/field-shift-summary.mjs",
          "sha256": "41f47aa7a0826ba1fe29b554c7575ec60c9861f0c18c863f06e8c3d00cb0f83c"
        },
        {
          "path": "src/lib/geo.js",
          "sha256": "fa47424540f953adf56e0c3069780c0c8876a2f69e944a80caddefa974b5b6bf"
        },
        {
          "path": "src/lib/material-inventory.mjs",
          "sha256": "4b599d273c4cadcdf76202554757583152da8c11b0a754be386bffb830f0c65b"
        },
        {
          "path": "src/lib/meta-cloud-protocol.mjs",
          "sha256": "c6d5f1e1b4119dd2529860e3bd61a1b22d602f71ad301b2f04cec3ab4bbbed3c"
        },
        {
          "path": "src/lib/participant-admission.mjs",
          "sha256": "2cbb466e49d742cd23da1bb85a4e89b7e411dc724c8d1f2eb66b39717f283dd9"
        },
        {
          "path": "src/lib/participant-approved-identity.mjs",
          "sha256": "834d81e70cedbd967ff84d880ea9d697c2168d2220fb23d9eb14c1aba1cdbbf1"
        },
        {
          "path": "src/lib/participant-kyc-image-set.mjs",
          "sha256": "190ce2560286a58d42668da7b912aeabcfa76ee14086503bf1609304e5f0e8fb"
        },
        {
          "path": "src/lib/person-worksite-journey.mjs",
          "sha256": "d3174df793150125c0b6a5d9f37d56336e72cab1efb43a361065b78ac54c210a"
        },
        {
          "path": "src/lib/private-image-upload.mjs",
          "sha256": "1eaeda2fa79104cfe00a8736c466d8568d216c8682bd44031d3bf9d4f35e3f60"
        },
        {
          "path": "src/lib/procurement-quantity.js",
          "sha256": "53439844051cc1dbd679220d695e60e54bc1629b2f1ddb33fc125981da9326b3"
        },
        {
          "path": "src/lib/progress-measurement-quantity.js",
          "sha256": "e194f461d482dec666c090a19aabbd3498bc08964cbbbc31b8db6eeb39cb1be2"
        },
        {
          "path": "src/lib/site-register-policy.mjs",
          "sha256": "d529c4f2225e0ec851ef7df60f8c5b182a88b384958ebfd15b194683d1590434"
        },
        {
          "path": "src/lib/site-register-store.mjs",
          "sha256": "6b744c86f47dbb6dc081132675888615d76421701f96151b00646b5e1d2529c6"
        },
        {
          "path": "src/lib/task-progress-measurement.js",
          "sha256": "10361a0e30df34f9c90f915d9fdbfc0912a610ab3ce851503c32549b7049a8b9"
        },
        {
          "path": "src/lib/video-audio-extractor.mjs",
          "sha256": "0c85dfd39c10fdb782eca4fe57dc665c29bd7211ab7aba0dda3f8945abcb1988"
        },
        {
          "path": "src/lib/video-frame-extractor.mjs",
          "sha256": "33425a184cf097884982c43a90e3b515726027adbeb51c2cdbfc794e79dee6e6"
        },
        {
          "path": "src/lib/voice-progress-draft.mjs",
          "sha256": "56ddbad919a1ad77e13105f1a125914674c1a149a88e28fa2f8b831a4d14bd69"
        },
        {
          "path": "src/lib/workspace-http.mjs",
          "sha256": "b4e56dcd8ecbbc40c9b5f7d0e610e6f16eeb69143d46397279044e69ca5b8429"
        },
        {
          "path": "src/lib/workspace-policy.mjs",
          "sha256": "ba51cc5c4a6e4f5ce1c9382cae2c8ea903ab4373668c05384c7f1e9253c7041e"
        },
        {
          "path": "src/lib/workspace-store.mjs",
          "sha256": "5f25092121a31a06eefa59d69866db82fa3cd28afdcbd0e066e52d916478bc50"
        }
      ]
    },
    {
      "family": "HOURS_BROWSER",
      "previousExternalImports": [
        "@babel/parser",
        "ffmpeg-static",
        "node:assert/strict",
        "node:child_process",
        "node:crypto",
        "node:dgram",
        "node:fs",
        "node:fs/promises",
        "node:http",
        "node:https",
        "node:module",
        "node:net",
        "node:os",
        "node:path",
        "node:perf_hooks",
        "node:test",
        "node:timers/promises",
        "node:tls",
        "node:url",
        "puppeteer",
        "react"
      ],
      "currentFiles": [
        "package-lock.json",
        "package.json",
        "scripts/lib/owned-fixture-cleanup.mjs",
        "scripts/lib/worksite-hours-browser-data.mjs",
        "scripts/lib/worksite-hours-browser-fixture.mjs",
        "scripts/verify-field-hours-report-ui.mjs",
        "src/app/(identity)/cuenta/company-channel-view.mjs",
        "src/app/(identity)/cuenta/field-hours-report-panel.js",
        "src/app/(identity)/cuenta/field-hours-report-panel.module.css",
        "src/app/(identity)/cuenta/field-operations-panel.module.css",
        "src/app/(identity)/cuenta/field-overtime-view.js",
        "src/app/(identity)/cuenta/field-overtime-view.module.css",
        "src/app/(identity)/cuenta/own-company-number-view.mjs",
        "src/app/(identity)/cuenta/own-company-templates-view.mjs",
        "src/app/(identity)/cuenta/participant-office-account-view.mjs",
        "src/app/(identity)/cuenta/plan-baseline-view.mjs",
        "src/app/(identity)/cuenta/plan-source-curve.mjs",
        "src/app/(identity)/cuenta/private-bank-account-format.mjs",
        "src/app/(identity)/cuenta/site-purchase-view.mjs",
        "src/app/(identity)/cuenta/workspace-recovery-journal.mjs",
        "src/app/(identity)/cuenta/workspace-recovery-storage.mjs",
        "src/app/(identity)/cuenta/workspace-request-lifecycle.js",
        "src/app/(identity)/cuenta/workspace-request-lifecycle.mjs",
        "src/app/(identity)/cuenta/workspace-session-request.mjs",
        "src/lib/field-hours-report.mjs",
        "src/lib/field-media-privacy.mjs",
        "src/lib/field-media.mjs",
        "src/lib/field-operations-http.mjs",
        "src/lib/field-operations-policy.mjs",
        "src/lib/field-operations-store.mjs",
        "src/lib/field-overtime-policy.mjs",
        "src/lib/field-overtime-store.mjs",
        "src/lib/field-report-feedback.mjs",
        "src/lib/field-shift-summary.mjs",
        "src/lib/geo.js",
        "src/lib/material-inventory.mjs",
        "src/lib/meta-cloud-protocol.mjs",
        "src/lib/participant-admission.mjs",
        "src/lib/participant-approved-identity.mjs",
        "src/lib/participant-kyc-image-set.mjs",
        "src/lib/person-worksite-journey.mjs",
        "src/lib/plan-import-cyp-curve.mjs",
        "src/lib/plan-import-document-curve.mjs",
        "src/lib/private-image-upload.mjs",
        "src/lib/procurement-quantity.js",
        "src/lib/progress-measurement-quantity.js",
        "src/lib/site-register-policy.mjs",
        "src/lib/site-register-store.mjs",
        "src/lib/task-progress-measurement.js",
        "src/lib/video-audio-extractor.mjs",
        "src/lib/video-frame-extractor.mjs",
        "src/lib/voice-progress-draft.mjs",
        "src/lib/workspace-http.mjs",
        "src/lib/workspace-policy.mjs",
        "src/lib/workspace-store.mjs",
        "tests/helpers/field-hours-fixture.mjs",
        "tests/helpers/field-hours-network-guard.mjs"
      ],
      "externalImports": [
        "@babel/parser",
        "ffmpeg-static",
        "node:assert/strict",
        "node:child_process",
        "node:crypto",
        "node:dgram",
        "node:fs",
        "node:fs/promises",
        "node:http",
        "node:https",
        "node:module",
        "node:net",
        "node:os",
        "node:path",
        "node:perf_hooks",
        "node:test",
        "node:timers/promises",
        "node:tls",
        "node:url",
        "puppeteer",
        "react"
      ],
      "currentManifest": [
        {
          "path": "package-lock.json",
          "sha256": "dfa3ff3914547f35828a0b697e6007c6cf856546be86bf8a7810cdce59e60449"
        },
        {
          "path": "package.json",
          "sha256": "6b7918c67edddee946d9455aa71913987f54f8abe441e0c3e560560a89061c4d"
        },
        {
          "path": "scripts/lib/owned-fixture-cleanup.mjs",
          "sha256": "44a9df241dd8426fe8d148b1b33110fe1e103960814e81f1f9a41638d8613844"
        },
        {
          "path": "scripts/lib/worksite-hours-browser-data.mjs",
          "sha256": "7f9bc36ae2054fc3b780133daa004788e4e0d1f151132a7c563a40947ea6d6e3"
        },
        {
          "path": "scripts/lib/worksite-hours-browser-fixture.mjs",
          "sha256": "38bfa5aa95b13482f4ad57ec1f13ea7f75e8b6d034ab8cc9b04181883e98be42"
        },
        {
          "path": "scripts/verify-field-hours-report-ui.mjs",
          "sha256": "ef9b8db8a20964b891002db3cdc03ea0b439f3fe855d98edaf775a7a461edd34"
        },
        {
          "path": "src/app/(identity)/cuenta/company-channel-view.mjs",
          "sha256": "c79c473999e444b84e2a1d58e0d03f030069c24f9749f2c84450318b0b237e4d"
        },
        {
          "path": "src/app/(identity)/cuenta/field-hours-report-panel.js",
          "sha256": "d91074b8b1693c95dcf80a86fc73711fbd98a7ba482251ade68fd227166fb748"
        },
        {
          "path": "src/app/(identity)/cuenta/field-hours-report-panel.module.css",
          "sha256": "0c8eefb85891cade983a42b7f4463962319c9fe27c0c5d157011108255c2bd75"
        },
        {
          "path": "src/app/(identity)/cuenta/field-operations-panel.module.css",
          "sha256": "5ccd8b5beae691b9ab6ee2dc0c0ae876a5fdffe15d31d24c6807f117bd76949c"
        },
        {
          "path": "src/app/(identity)/cuenta/field-overtime-view.js",
          "sha256": "161a09cb92b09695c4007cf99c3c7755586bf8e05d7f93e147fe9f1bfb45ca60"
        },
        {
          "path": "src/app/(identity)/cuenta/field-overtime-view.module.css",
          "sha256": "e7f9e4ff4216fdb18b333d0b8cd40a5b3158e5f2e398f6207ab5cea2789fcf7a"
        },
        {
          "path": "src/app/(identity)/cuenta/own-company-number-view.mjs",
          "sha256": "6940f11e30d2958d7f6771463ce28ca83c0e2d2f41e81aa220c8efe669580300"
        },
        {
          "path": "src/app/(identity)/cuenta/own-company-templates-view.mjs",
          "sha256": "3bf758b150336613a437e2b01d3b6a79645a024b771f1515f4ec2ae58a1b8bc3"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-office-account-view.mjs",
          "sha256": "f2716f72297a1277946bafa03a82d4c1fb7f2fcff7f4c4bbe155a86ed7e4e379"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-baseline-view.mjs",
          "sha256": "0c696eba748a7441440e23be5085dc42d4954427def5adc1e2de686b4b11711d"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-source-curve.mjs",
          "sha256": "689402d373744d159a62e2e5975ddfdf79053c528a838879dd5df3e43a0efdc9"
        },
        {
          "path": "src/app/(identity)/cuenta/private-bank-account-format.mjs",
          "sha256": "4dcf7f2de2f49f97f155e14128b20815f538d659d5e82806fa45a18d541adeea"
        },
        {
          "path": "src/app/(identity)/cuenta/site-purchase-view.mjs",
          "sha256": "58ebd978e8e39423901cb811ecf2ab851160b78f7cd5cb441075d66d7819dee9"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-recovery-journal.mjs",
          "sha256": "060e128b54eefdadfbabac45c3ec696934f5e74d79b9e26e905081128e8e99c5"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-recovery-storage.mjs",
          "sha256": "d8cf1e7e8d88d66f722aaf52deb45f95829c226468d3f37a2b23d171cc1ecbb8"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-request-lifecycle.js",
          "sha256": "b3004538de2cc7cbc829bf5518c4f4b2a5eb2935d0b4e60f9c88840c8ede3797"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-request-lifecycle.mjs",
          "sha256": "590cd7691d8b6beb82929bdd18dd9909c2d2cfa1c3d4111ff4d478d57daf532f"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-session-request.mjs",
          "sha256": "29d294ac1d973317d6a3df225a64a8a9115c6ea51c587f297114e7992af97520"
        },
        {
          "path": "src/lib/field-hours-report.mjs",
          "sha256": "b55b767d61278bde31cb9ce4ef64faee5320fc7fe1b1bcc54559860bb4576731"
        },
        {
          "path": "src/lib/field-media-privacy.mjs",
          "sha256": "5ec7fc7dd71f9303a42bfb4889e02541de8a3cf356e8e1203cfeeefd56220515"
        },
        {
          "path": "src/lib/field-media.mjs",
          "sha256": "940e681d1430fc211093b16f5407637fcd31d270a3d99234f748fe7db73cc0bb"
        },
        {
          "path": "src/lib/field-operations-http.mjs",
          "sha256": "df60181e3d852efe42d86a284ced3c0ff9cf4c7fbcaf863de8da4d47c2f7aeaf"
        },
        {
          "path": "src/lib/field-operations-policy.mjs",
          "sha256": "01eb863d7db4446eeb8dab990d7e0602a19d581d5615a0b1e5d50c02f3d70173"
        },
        {
          "path": "src/lib/field-operations-store.mjs",
          "sha256": "dbf96641349efae61808a2d66a02d491ad06e2226885e6efa928dba53ce5034e"
        },
        {
          "path": "src/lib/field-overtime-policy.mjs",
          "sha256": "76848bd0861d6cecccb682b774599f03d3fe1322eed3cc58f5f1db5d9b1e24f8"
        },
        {
          "path": "src/lib/field-overtime-store.mjs",
          "sha256": "f29b67fff29949d5a8b14c4aed3f484ae1ce16d2ed42de486a6d5868361b1526"
        },
        {
          "path": "src/lib/field-report-feedback.mjs",
          "sha256": "70b966ae5f382abe6b5446daf1092c3f66b8f46f80ce5a0c006cffeba1cfa64c"
        },
        {
          "path": "src/lib/field-shift-summary.mjs",
          "sha256": "41f47aa7a0826ba1fe29b554c7575ec60c9861f0c18c863f06e8c3d00cb0f83c"
        },
        {
          "path": "src/lib/geo.js",
          "sha256": "fa47424540f953adf56e0c3069780c0c8876a2f69e944a80caddefa974b5b6bf"
        },
        {
          "path": "src/lib/material-inventory.mjs",
          "sha256": "4b599d273c4cadcdf76202554757583152da8c11b0a754be386bffb830f0c65b"
        },
        {
          "path": "src/lib/meta-cloud-protocol.mjs",
          "sha256": "c6d5f1e1b4119dd2529860e3bd61a1b22d602f71ad301b2f04cec3ab4bbbed3c"
        },
        {
          "path": "src/lib/participant-admission.mjs",
          "sha256": "2cbb466e49d742cd23da1bb85a4e89b7e411dc724c8d1f2eb66b39717f283dd9"
        },
        {
          "path": "src/lib/participant-approved-identity.mjs",
          "sha256": "834d81e70cedbd967ff84d880ea9d697c2168d2220fb23d9eb14c1aba1cdbbf1"
        },
        {
          "path": "src/lib/participant-kyc-image-set.mjs",
          "sha256": "190ce2560286a58d42668da7b912aeabcfa76ee14086503bf1609304e5f0e8fb"
        },
        {
          "path": "src/lib/person-worksite-journey.mjs",
          "sha256": "d3174df793150125c0b6a5d9f37d56336e72cab1efb43a361065b78ac54c210a"
        },
        {
          "path": "src/lib/plan-import-cyp-curve.mjs",
          "sha256": "7e1d6c9d87df5e74e0a340361e1e66fdf0cfd5c82f1e44030ba2e85b5fa9c342"
        },
        {
          "path": "src/lib/plan-import-document-curve.mjs",
          "sha256": "7f63d62b9f1ae6d139c627a978ef56d7eafea0e0f4271167daa4c00bf7fda013"
        },
        {
          "path": "src/lib/private-image-upload.mjs",
          "sha256": "1eaeda2fa79104cfe00a8736c466d8568d216c8682bd44031d3bf9d4f35e3f60"
        },
        {
          "path": "src/lib/procurement-quantity.js",
          "sha256": "53439844051cc1dbd679220d695e60e54bc1629b2f1ddb33fc125981da9326b3"
        },
        {
          "path": "src/lib/progress-measurement-quantity.js",
          "sha256": "e194f461d482dec666c090a19aabbd3498bc08964cbbbc31b8db6eeb39cb1be2"
        },
        {
          "path": "src/lib/site-register-policy.mjs",
          "sha256": "d529c4f2225e0ec851ef7df60f8c5b182a88b384958ebfd15b194683d1590434"
        },
        {
          "path": "src/lib/site-register-store.mjs",
          "sha256": "6b744c86f47dbb6dc081132675888615d76421701f96151b00646b5e1d2529c6"
        },
        {
          "path": "src/lib/task-progress-measurement.js",
          "sha256": "10361a0e30df34f9c90f915d9fdbfc0912a610ab3ce851503c32549b7049a8b9"
        },
        {
          "path": "src/lib/video-audio-extractor.mjs",
          "sha256": "0c85dfd39c10fdb782eca4fe57dc665c29bd7211ab7aba0dda3f8945abcb1988"
        },
        {
          "path": "src/lib/video-frame-extractor.mjs",
          "sha256": "33425a184cf097884982c43a90e3b515726027adbeb51c2cdbfc794e79dee6e6"
        },
        {
          "path": "src/lib/voice-progress-draft.mjs",
          "sha256": "56ddbad919a1ad77e13105f1a125914674c1a149a88e28fa2f8b831a4d14bd69"
        },
        {
          "path": "src/lib/workspace-http.mjs",
          "sha256": "b4e56dcd8ecbbc40c9b5f7d0e610e6f16eeb69143d46397279044e69ca5b8429"
        },
        {
          "path": "src/lib/workspace-policy.mjs",
          "sha256": "ba51cc5c4a6e4f5ce1c9382cae2c8ea903ab4373668c05384c7f1e9253c7041e"
        },
        {
          "path": "src/lib/workspace-store.mjs",
          "sha256": "5f25092121a31a06eefa59d69866db82fa3cd28afdcbd0e066e52d916478bc50"
        },
        {
          "path": "tests/helpers/field-hours-fixture.mjs",
          "sha256": "4c6be9a5f41069ee712a6920ca70833d666472ee70c46f0ba8765b98992ca803"
        },
        {
          "path": "tests/helpers/field-hours-network-guard.mjs",
          "sha256": "ff150436eac8bb9be3462df17f1be7b9330aac9501687d68c7ae30265d2a66bd"
        }
      ]
    },
    {
      "family": "UI_FOCUSED_WORKSPACE",
      "previousExternalImports": [
        "@babel/parser",
        "@clerk/nextjs",
        "jose",
        "jsqr",
        "lucide-react",
        "next/dist/build/swc/index.js",
        "next/headers",
        "next/link",
        "next/navigation",
        "node:assert/strict",
        "node:child_process",
        "node:crypto",
        "node:fs",
        "node:net",
        "node:path",
        "node:test",
        "node:timers/promises",
        "node:url",
        "puppeteer",
        "react",
        "react-dom/server"
      ],
      "currentFiles": [
        "package-lock.json",
        "package.json",
        "scripts/lib/home-decisions-current-ci-lineage.mjs",
        "scripts/lib/integrated-identity-current-ci-lineage.mjs",
        "scripts/lib/material-review-current-ci-lineage.mjs",
        "scripts/lib/meta-existing-api-plan-current-ci-lineage.mjs",
        "scripts/lib/owned-fixture-cleanup.mjs",
        "scripts/lib/participant-preanalysis-current-ci-lineage.mjs",
        "scripts/lib/plan-measurement-document-association-ci-lineage.mjs",
        "scripts/lib/plan-partida-preview-current-ci-lineage.mjs",
        "scripts/lib/plan-partida-preview-current-ci-reviewed.mjs",
        "scripts/lib/whatsapp-field-continuity-current-ci-lineage.mjs",
        "scripts/lib/worksite-live-hours-current-ci-lineage.mjs",
        "scripts/lib/worksite-live-hours-current-ci-reviewed.mjs",
        "scripts/lib/workspace-continuity-current-ci-lineage.mjs",
        "scripts/verify-focused-workspace-ci.mjs",
        "scripts/verify-focused-workspace-ui.mjs",
        "src/app/(identity)/cuenta/company-bootstrap-panel.js",
        "src/app/(identity)/cuenta/company-bootstrap-panel.module.css",
        "src/app/(identity)/cuenta/company-channel-panel.js",
        "src/app/(identity)/cuenta/company-channel-panel.module.css",
        "src/app/(identity)/cuenta/company-channel-view.mjs",
        "src/app/(identity)/cuenta/company-subscription-panel.js",
        "src/app/(identity)/cuenta/company-subscription-panel.module.css",
        "src/app/(identity)/cuenta/company-subscription-view.mjs",
        "src/app/(identity)/cuenta/company-usage-panel.js",
        "src/app/(identity)/cuenta/company-usage-view.mjs",
        "src/app/(identity)/cuenta/constructor-crm-panel.js",
        "src/app/(identity)/cuenta/constructor-crm-panel.module.css",
        "src/app/(identity)/cuenta/constructor-crm-view.mjs",
        "src/app/(identity)/cuenta/customer-inbox-panel.js",
        "src/app/(identity)/cuenta/customer-inbox-panel.module.css",
        "src/app/(identity)/cuenta/customer-inbox-view.mjs",
        "src/app/(identity)/cuenta/customer-whatsapp-panel.js",
        "src/app/(identity)/cuenta/customer-whatsapp-panel.module.css",
        "src/app/(identity)/cuenta/customer-whatsapp-view.mjs",
        "src/app/(identity)/cuenta/demo-pilot-panel.js",
        "src/app/(identity)/cuenta/demo-pilot-view.mjs",
        "src/app/(identity)/cuenta/employee-intake-continuity.mjs",
        "src/app/(identity)/cuenta/employee-intake-panel.js",
        "src/app/(identity)/cuenta/field-hours-report-panel.js",
        "src/app/(identity)/cuenta/field-hours-report-panel.module.css",
        "src/app/(identity)/cuenta/field-media-capture.js",
        "src/app/(identity)/cuenta/field-media-held-view.mjs",
        "src/app/(identity)/cuenta/field-media-preparation.mjs",
        "src/app/(identity)/cuenta/field-media-preview.js",
        "src/app/(identity)/cuenta/field-operations-panel.js",
        "src/app/(identity)/cuenta/field-operations-panel.module.css",
        "src/app/(identity)/cuenta/field-overtime-view.js",
        "src/app/(identity)/cuenta/field-overtime-view.module.css",
        "src/app/(identity)/cuenta/field-qr-capture.js",
        "src/app/(identity)/cuenta/field-qr-reader.mjs",
        "src/app/(identity)/cuenta/field-review-page-view.mjs",
        "src/app/(identity)/cuenta/invitation-entry.js",
        "src/app/(identity)/cuenta/kyc-photo-preparation.js",
        "src/app/(identity)/cuenta/material-inventory-panel.js",
        "src/app/(identity)/cuenta/material-inventory-panel.module.css",
        "src/app/(identity)/cuenta/material-inventory-view.mjs",
        "src/app/(identity)/cuenta/meta-existing-api-plan-view.mjs",
        "src/app/(identity)/cuenta/meta-onboarding-panel.js",
        "src/app/(identity)/cuenta/meta-onboarding-panel.module.css",
        "src/app/(identity)/cuenta/meta-onboarding-readiness-view.mjs",
        "src/app/(identity)/cuenta/meta-sdk-loader.mjs",
        "src/app/(identity)/cuenta/office-review-panel.js",
        "src/app/(identity)/cuenta/office-review-panel.module.css",
        "src/app/(identity)/cuenta/office-review-view.mjs",
        "src/app/(identity)/cuenta/onboarding-guide.js",
        "src/app/(identity)/cuenta/onboarding-guide.module.css",
        "src/app/(identity)/cuenta/operations-status-panel.js",
        "src/app/(identity)/cuenta/operations-status-panel.module.css",
        "src/app/(identity)/cuenta/own-company-number-panel.js",
        "src/app/(identity)/cuenta/own-company-number-view.mjs",
        "src/app/(identity)/cuenta/own-company-templates-panel.js",
        "src/app/(identity)/cuenta/own-company-templates-view.mjs",
        "src/app/(identity)/cuenta/page.js",
        "src/app/(identity)/cuenta/participant-account-discovery-format.mjs",
        "src/app/(identity)/cuenta/participant-account-discovery.js",
        "src/app/(identity)/cuenta/participant-civil-data-panel.js",
        "src/app/(identity)/cuenta/participant-civil-data-view.mjs",
        "src/app/(identity)/cuenta/participant-kyc-capture.js",
        "src/app/(identity)/cuenta/participant-kyc-capture.module.css",
        "src/app/(identity)/cuenta/participant-kyc-chat-attempt-panel.js",
        "src/app/(identity)/cuenta/participant-kyc-chat-attempt-view.mjs",
        "src/app/(identity)/cuenta/participant-kyc-preanalysis-view.mjs",
        "src/app/(identity)/cuenta/participant-ocr-usage-view.mjs",
        "src/app/(identity)/cuenta/participant-office-account-view.mjs",
        "src/app/(identity)/cuenta/participant-onboarding-next-step.mjs",
        "src/app/(identity)/cuenta/participant-panel.js",
        "src/app/(identity)/cuenta/participant-panel.module.css",
        "src/app/(identity)/cuenta/plan-baseline-panel.js",
        "src/app/(identity)/cuenta/plan-baseline-view.mjs",
        "src/app/(identity)/cuenta/plan-baseline.module.css",
        "src/app/(identity)/cuenta/plan-import-calendar-suggestions.mjs",
        "src/app/(identity)/cuenta/plan-import-panel.js",
        "src/app/(identity)/cuenta/plan-import-panel.module.css",
        "src/app/(identity)/cuenta/plan-import-usage-view.mjs",
        "src/app/(identity)/cuenta/plan-measurement-panel.js",
        "src/app/(identity)/cuenta/plan-measurement-panel.module.css",
        "src/app/(identity)/cuenta/plan-measurement-view.mjs",
        "src/app/(identity)/cuenta/plan-partida-measurement-preview.js",
        "src/app/(identity)/cuenta/plan-partida-measurement-preview.mjs",
        "src/app/(identity)/cuenta/plan-partida-source-preview.js",
        "src/app/(identity)/cuenta/plan-partida-source-preview.mjs",
        "src/app/(identity)/cuenta/plan-partida-source-preview.module.css",
        "src/app/(identity)/cuenta/plan-source-curve.js",
        "src/app/(identity)/cuenta/plan-source-curve.mjs",
        "src/app/(identity)/cuenta/plan-source-curve.module.css",
        "src/app/(identity)/cuenta/portfolio-overview-panel.js",
        "src/app/(identity)/cuenta/portfolio-overview-panel.module.css",
        "src/app/(identity)/cuenta/portfolio-overview-view.mjs",
        "src/app/(identity)/cuenta/private-bank-account-format.mjs",
        "src/app/(identity)/cuenta/private-bank-account-panel.js",
        "src/app/(identity)/cuenta/private-bank-account-panel.module.css",
        "src/app/(identity)/cuenta/private-workspace-download.js",
        "src/app/(identity)/cuenta/project-creation-format.mjs",
        "src/app/(identity)/cuenta/project-creation-panel.js",
        "src/app/(identity)/cuenta/project-creation-panel.module.css",
        "src/app/(identity)/cuenta/project-preparation-format.mjs",
        "src/app/(identity)/cuenta/project-preparation-panel.js",
        "src/app/(identity)/cuenta/project-preparation-panel.module.css",
        "src/app/(identity)/cuenta/schedule-workbench.js",
        "src/app/(identity)/cuenta/schedule-workbench.mjs",
        "src/app/(identity)/cuenta/schedule-workbench.module.css",
        "src/app/(identity)/cuenta/session-recovery.js",
        "src/app/(identity)/cuenta/site-purchase-panel.js",
        "src/app/(identity)/cuenta/site-purchase-panel.module.css",
        "src/app/(identity)/cuenta/site-purchase-view.mjs",
        "src/app/(identity)/cuenta/site-register-panel.js",
        "src/app/(identity)/cuenta/site-register-panel.module.css",
        "src/app/(identity)/cuenta/task-create-panel.js",
        "src/app/(identity)/cuenta/task-progress-measurement-editor.js",
        "src/app/(identity)/cuenta/task-progress-measurement-editor.module.css",
        "src/app/(identity)/cuenta/task-progress-measurement-view.mjs",
        "src/app/(identity)/cuenta/template-send-panel.js",
        "src/app/(identity)/cuenta/template-send-panel.module.css",
        "src/app/(identity)/cuenta/template-send-view.mjs",
        "src/app/(identity)/cuenta/voice-progress-draft-view.js",
        "src/app/(identity)/cuenta/worker-channel-panel.js",
        "src/app/(identity)/cuenta/worker-channel-panel.module.css",
        "src/app/(identity)/cuenta/worksite-task-selector.js",
        "src/app/(identity)/cuenta/worksite-task-selector.module.css",
        "src/app/(identity)/cuenta/workspace-client.js",
        "src/app/(identity)/cuenta/workspace-identity.js",
        "src/app/(identity)/cuenta/workspace-live-read.mjs",
        "src/app/(identity)/cuenta/workspace-live-refresh-controller.mjs",
        "src/app/(identity)/cuenta/workspace-live-refresh.js",
        "src/app/(identity)/cuenta/workspace-overview.js",
        "src/app/(identity)/cuenta/workspace-recovery-journal.mjs",
        "src/app/(identity)/cuenta/workspace-recovery-panel.js",
        "src/app/(identity)/cuenta/workspace-recovery-storage.mjs",
        "src/app/(identity)/cuenta/workspace-request-lifecycle.js",
        "src/app/(identity)/cuenta/workspace-request-lifecycle.mjs",
        "src/app/(identity)/cuenta/workspace-screen.js",
        "src/app/(identity)/cuenta/workspace-session-request.mjs",
        "src/app/(identity)/cuenta/workspace-task-page.mjs",
        "src/app/(identity)/cuenta/workspace-tools-navigation.js",
        "src/app/(identity)/cuenta/workspace-tools-navigation.module.css",
        "src/app/(identity)/cuenta/workspace-view-routing.mjs",
        "src/app/(identity)/cuenta/workspace.module.css",
        "src/app/(identity)/identity-load-guard.js",
        "src/app/(identity)/identity.module.css",
        "src/app/brand/brand-geometry.js",
        "src/app/brand/brand-logo.js",
        "src/app/brand/brand-logo.module.css",
        "src/lib/company-entitlement.mjs",
        "src/lib/company-phone-format.mjs",
        "src/lib/field-media-privacy.mjs",
        "src/lib/geo.js",
        "src/lib/identity-return-path.mjs",
        "src/lib/participant-analysis-consent.mjs",
        "src/lib/participant-approved-identity.mjs",
        "src/lib/participant-bank-format.mjs",
        "src/lib/participant-kyc-image-set.mjs",
        "src/lib/participant-onboarding-policy.mjs",
        "src/lib/participant-policy.mjs",
        "src/lib/participant-verified-office.mjs",
        "src/lib/plan-import-cyp-curve.mjs",
        "src/lib/plan-import-document-curve.mjs",
        "src/lib/private-image-upload.mjs",
        "src/lib/production-identity-config.mjs",
        "src/lib/progress-measurement-quantity.js",
        "src/lib/session-recovery.mjs",
        "src/lib/site-register-policy.mjs",
        "src/lib/task-progress-measurement.js",
        "src/lib/verified-session.mjs",
        "src/lib/voice-progress-draft.mjs",
        "src/lib/whatsapp/tenant-workspace-policy.js",
        "src/lib/workspace-policy.mjs",
        "tests/fixtures/integrated-identity-contract-27aa.json",
        "tests/fixtures/plan-measurement-contract-a203.json",
        "tests/fixtures/whatsapp-field-continuity-contract-052.json",
        "tests/fixtures/workspace-continuity-contract-d5d.json",
        "tests/production-company-bootstrap-receipt.test.mjs",
        "tests/production-focused-workspace-ci.test.mjs",
        "tests/production-focused-workspace-continuity-ui.test.mjs",
        "tests/production-focused-workspace-navigation.test.mjs",
        "tests/production-focused-workspace-task-pagination.test.mjs",
        "tests/production-focused-workspace-ui.test.mjs",
        "tests/production-integrated-identity-current-ci-lineage.test.mjs"
      ],
      "externalImports": [
        "@babel/parser",
        "@clerk/nextjs",
        "jose",
        "jsqr",
        "lucide-react",
        "next/dist/build/swc/index.js",
        "next/headers",
        "next/link",
        "next/navigation",
        "node:assert/strict",
        "node:child_process",
        "node:crypto",
        "node:fs",
        "node:net",
        "node:path",
        "node:test",
        "node:timers/promises",
        "node:url",
        "node:zlib",
        "puppeteer",
        "react",
        "react-dom/server"
      ],
      "currentManifest": [
        {
          "path": "package-lock.json",
          "sha256": "dfa3ff3914547f35828a0b697e6007c6cf856546be86bf8a7810cdce59e60449"
        },
        {
          "path": "package.json",
          "sha256": "6b7918c67edddee946d9455aa71913987f54f8abe441e0c3e560560a89061c4d"
        },
        {
          "path": "scripts/lib/home-decisions-current-ci-lineage.mjs",
          "sha256": "46653e34f0b0ab46617578525e4f0b71e295f240eceeec87ccb0944cd5db21a8"
        },
        {
          "path": "scripts/lib/integrated-identity-current-ci-lineage.mjs",
          "sha256": "aaf23ee0e97231520f29669136d969ffc513bd6b52067df751d3dc6cf9c86bb8"
        },
        {
          "path": "scripts/lib/material-review-current-ci-lineage.mjs",
          "sha256": "805e35504f147f017b4e70889c29c92175a4673f03916630319f6f25d040c4b4"
        },
        {
          "path": "scripts/lib/meta-existing-api-plan-current-ci-lineage.mjs",
          "sha256": "93763476c4dc0b193cf1e4d174f7eae71c0daf1081827d18d21cc7ee22f7d586"
        },
        {
          "path": "scripts/lib/owned-fixture-cleanup.mjs",
          "sha256": "44a9df241dd8426fe8d148b1b33110fe1e103960814e81f1f9a41638d8613844"
        },
        {
          "path": "scripts/lib/participant-preanalysis-current-ci-lineage.mjs",
          "sha256": "3c330d4f821d7f2c998dd17064c67ffdcc52dc3cfbd033c165af39e071333f7b"
        },
        {
          "path": "scripts/lib/plan-measurement-document-association-ci-lineage.mjs",
          "sha256": "0a14f5211348d30d3a16b441a126880aeed8c7e196973ecceda7ee00307f0ef4"
        },
        {
          "path": "scripts/lib/plan-partida-preview-current-ci-lineage.mjs",
          "sha256": "e793dbc5e5096926f71cc14ba60696b1becb2d3ed775aa75b00ad412c4e85e7e"
        },
        {
          "path": "scripts/lib/plan-partida-preview-current-ci-reviewed.mjs",
          "sha256": "REVIEWED_DECLARATION_TRUST_ANCHOR"
        },
        {
          "path": "scripts/lib/whatsapp-field-continuity-current-ci-lineage.mjs",
          "sha256": "5960b4acedd880ac0a49f157e57007863c2478ad218e504eb81bf993ad54b147"
        },
        {
          "path": "scripts/lib/worksite-live-hours-current-ci-lineage.mjs",
          "sha256": "86c626156b82419640b4dc45520a7dcca330810949a346ae60f50566a136f2e6"
        },
        {
          "path": "scripts/lib/worksite-live-hours-current-ci-reviewed.mjs",
          "sha256": "8da86cb1eeb978e37843d4f722da44968e4a089fd719aa35ebd966395f784758"
        },
        {
          "path": "scripts/lib/workspace-continuity-current-ci-lineage.mjs",
          "sha256": "cb26d5ea9922fb9a3fb72d1a35010229a1d4b49f4784783294a4d1d503fdc81a"
        },
        {
          "path": "scripts/verify-focused-workspace-ci.mjs",
          "sha256": "532e37e994540a6fecd8c70d067730cddec4a66403686113cef4087828c2229c"
        },
        {
          "path": "scripts/verify-focused-workspace-ui.mjs",
          "sha256": "940bc05e5aa47d19e2251bc5559eed34e29275afff0d025f76f73a8fde41649f"
        },
        {
          "path": "src/app/(identity)/cuenta/company-bootstrap-panel.js",
          "sha256": "f8fabe5917469d3303328ebdfc447fc4c6f3bd2e1f407abbd97c4ba7b8e713d3"
        },
        {
          "path": "src/app/(identity)/cuenta/company-bootstrap-panel.module.css",
          "sha256": "a8cadc4631ef54a18578344d93b8bed8568fbd847abce0cd02c57b2e7969dcdf"
        },
        {
          "path": "src/app/(identity)/cuenta/company-channel-panel.js",
          "sha256": "b41b9fd9a0fa16a25914b8d074ffbac1588b5d26dcca0310a8626ee211154a24"
        },
        {
          "path": "src/app/(identity)/cuenta/company-channel-panel.module.css",
          "sha256": "365d5f5884c39e239e0e0bf2ce5da2d37791a2d2ce5ce2e3c5d3021cc96db66e"
        },
        {
          "path": "src/app/(identity)/cuenta/company-channel-view.mjs",
          "sha256": "c79c473999e444b84e2a1d58e0d03f030069c24f9749f2c84450318b0b237e4d"
        },
        {
          "path": "src/app/(identity)/cuenta/company-subscription-panel.js",
          "sha256": "0b208fdcbea4900bd6adf86ad80f8524b5afa647d78a24fbf5731d3d7d79c749"
        },
        {
          "path": "src/app/(identity)/cuenta/company-subscription-panel.module.css",
          "sha256": "fdede43a09f48b011f7e3cb184ea16bf0be0e98069e7a953b71b8e391b3dfa3e"
        },
        {
          "path": "src/app/(identity)/cuenta/company-subscription-view.mjs",
          "sha256": "d009632c97d18084a1907bd7dedcf140f1a5d4ee0b55dd95f33d83be152dfc9c"
        },
        {
          "path": "src/app/(identity)/cuenta/company-usage-panel.js",
          "sha256": "01beddb3b88861bda1549169cc885bc682bd5446e4289521e5a36a6386ac37aa"
        },
        {
          "path": "src/app/(identity)/cuenta/company-usage-view.mjs",
          "sha256": "27cb4b607405186f57d70ffa7d78b1b2f9456486a4bfeb40b0157c9c52a2dc29"
        },
        {
          "path": "src/app/(identity)/cuenta/constructor-crm-panel.js",
          "sha256": "9447f5d87002193e34b99c1276a958b0e00539a901e372ce4e16584358d54554"
        },
        {
          "path": "src/app/(identity)/cuenta/constructor-crm-panel.module.css",
          "sha256": "8d99b34339e2f4d434cda5abbd9a1bf11c13d1335cb407fcfad6629810d98bf4"
        },
        {
          "path": "src/app/(identity)/cuenta/constructor-crm-view.mjs",
          "sha256": "9e0520a9f15c86d9b79b85bad2067b4dcdba3c82b1d3e6b32b86f811f79bf885"
        },
        {
          "path": "src/app/(identity)/cuenta/customer-inbox-panel.js",
          "sha256": "a933afae1cecb3e523d37904ee6f9543c958b738f6abbb4eb013cf12c1535909"
        },
        {
          "path": "src/app/(identity)/cuenta/customer-inbox-panel.module.css",
          "sha256": "abfcade899997a72ad9789020d8223257cc35128657cae6a74df386dc22381f3"
        },
        {
          "path": "src/app/(identity)/cuenta/customer-inbox-view.mjs",
          "sha256": "c38e1d18d59fa2be870fc90cdd748dcb3d3b24e805aa5924f4a79ae5733a001f"
        },
        {
          "path": "src/app/(identity)/cuenta/customer-whatsapp-panel.js",
          "sha256": "d129c4aa22e8048e03674382828222e5141e219f5d12368139a75ae735c9b247"
        },
        {
          "path": "src/app/(identity)/cuenta/customer-whatsapp-panel.module.css",
          "sha256": "00e35b2fcea0140d639c6207ae7c33476e8075c297ffec1aebebefaae3ccc136"
        },
        {
          "path": "src/app/(identity)/cuenta/customer-whatsapp-view.mjs",
          "sha256": "baae13c4e846d6e9787a58dc9ca83ee45e3a79cafd87d104dc68c16da4b31437"
        },
        {
          "path": "src/app/(identity)/cuenta/demo-pilot-panel.js",
          "sha256": "f2d9b7bfaf481c4ca1f8b9b2120bfe688375f745508c249cf04112178dab9270"
        },
        {
          "path": "src/app/(identity)/cuenta/demo-pilot-view.mjs",
          "sha256": "8816f95d81094b0a44c8e1dec5b94b4886ee493e4dd8caaec0d9eb95adbdbf01"
        },
        {
          "path": "src/app/(identity)/cuenta/employee-intake-continuity.mjs",
          "sha256": "11ca9957e2d04545485617e2cefa939673e2ad5b3e45943b5c9ba24b28f5b8ee"
        },
        {
          "path": "src/app/(identity)/cuenta/employee-intake-panel.js",
          "sha256": "111fc1e7918fe28d2e9aa9f1dd3abc63c7d18c45e8dc6d328d1b0b3c64361b46"
        },
        {
          "path": "src/app/(identity)/cuenta/field-hours-report-panel.js",
          "sha256": "d91074b8b1693c95dcf80a86fc73711fbd98a7ba482251ade68fd227166fb748"
        },
        {
          "path": "src/app/(identity)/cuenta/field-hours-report-panel.module.css",
          "sha256": "0c8eefb85891cade983a42b7f4463962319c9fe27c0c5d157011108255c2bd75"
        },
        {
          "path": "src/app/(identity)/cuenta/field-media-capture.js",
          "sha256": "f8019225870bc6ccf04818ad7ff305798d53ea9b523400385816ba7fe2117559"
        },
        {
          "path": "src/app/(identity)/cuenta/field-media-held-view.mjs",
          "sha256": "cfc01204f973281e77a49627c7c5e32c6bdd04a1bc4c6e0a9e93773eca4faf71"
        },
        {
          "path": "src/app/(identity)/cuenta/field-media-preparation.mjs",
          "sha256": "df03121d9a7beb6b4a77946cefb09ce00710a6e22b5c8b680b180dd5a2e64a6f"
        },
        {
          "path": "src/app/(identity)/cuenta/field-media-preview.js",
          "sha256": "d39d47da18f60c69a38eee22b62929087a7cc0b379a620af8a83b62573161110"
        },
        {
          "path": "src/app/(identity)/cuenta/field-operations-panel.js",
          "sha256": "69af7d8b95378f0b7f26f880eaec61d891c38744e9e6781eca9fe539776a91ed"
        },
        {
          "path": "src/app/(identity)/cuenta/field-operations-panel.module.css",
          "sha256": "5ccd8b5beae691b9ab6ee2dc0c0ae876a5fdffe15d31d24c6807f117bd76949c"
        },
        {
          "path": "src/app/(identity)/cuenta/field-overtime-view.js",
          "sha256": "161a09cb92b09695c4007cf99c3c7755586bf8e05d7f93e147fe9f1bfb45ca60"
        },
        {
          "path": "src/app/(identity)/cuenta/field-overtime-view.module.css",
          "sha256": "e7f9e4ff4216fdb18b333d0b8cd40a5b3158e5f2e398f6207ab5cea2789fcf7a"
        },
        {
          "path": "src/app/(identity)/cuenta/field-qr-capture.js",
          "sha256": "3bc42cb87ec6554a9ac6001b199f434f087e4156139d76428d1ebaf43d12e37d"
        },
        {
          "path": "src/app/(identity)/cuenta/field-qr-reader.mjs",
          "sha256": "04157b9fc7a197271bac76d41217db8876b42dc6fbc6cb068a7052d2ea2b5b31"
        },
        {
          "path": "src/app/(identity)/cuenta/field-review-page-view.mjs",
          "sha256": "18f3616144c03aacf9c9859ae210150d92f6838de7332cee2550fa5fe91603fb"
        },
        {
          "path": "src/app/(identity)/cuenta/invitation-entry.js",
          "sha256": "a6c8a1499bcd170afb52120d56ecbddb1241a34d2aa483528d03f306e2c2a481"
        },
        {
          "path": "src/app/(identity)/cuenta/kyc-photo-preparation.js",
          "sha256": "88137686826cc411d6fcc103b0085390c0cc16f69572cf45c2385bcde69f943d"
        },
        {
          "path": "src/app/(identity)/cuenta/material-inventory-panel.js",
          "sha256": "0faadb854099ef161b9c869cc2b4c0aeb16d102e59fcaca8ef27fecd614d2924"
        },
        {
          "path": "src/app/(identity)/cuenta/material-inventory-panel.module.css",
          "sha256": "1d7eec4afc275ee403674b187acb7844e3df519f24cd537af2e05f7b8032611c"
        },
        {
          "path": "src/app/(identity)/cuenta/material-inventory-view.mjs",
          "sha256": "8b987424dd1db2332cbb26f792e51c8fea286bd5440f4d3235809e3869722b83"
        },
        {
          "path": "src/app/(identity)/cuenta/meta-existing-api-plan-view.mjs",
          "sha256": "c44cbf28f4642b7c60109668d60354acc298439653e34fd13aa6610e5e9e5588"
        },
        {
          "path": "src/app/(identity)/cuenta/meta-onboarding-panel.js",
          "sha256": "314f7b6b6e160a4c58f9f373ff6970d049ad4feefea7501a5d29ad4d63613af8"
        },
        {
          "path": "src/app/(identity)/cuenta/meta-onboarding-panel.module.css",
          "sha256": "47ddd495c465ce9c9c4d75df19c722fb35f3e9873396f95d948f43031efe760b"
        },
        {
          "path": "src/app/(identity)/cuenta/meta-onboarding-readiness-view.mjs",
          "sha256": "78d15f464576d77c5a676a8c9a682dea4a3f43113fdaa898237b75478ec5132c"
        },
        {
          "path": "src/app/(identity)/cuenta/meta-sdk-loader.mjs",
          "sha256": "3a2dcc3d99a29e7b1adffb833ae206e14990d18cc32025b4a31b21728a7c4d88"
        },
        {
          "path": "src/app/(identity)/cuenta/office-review-panel.js",
          "sha256": "6743f03b2a01fcb80f1b63069717fff0daa68e9c76bc97eed90fc7c270622ce1"
        },
        {
          "path": "src/app/(identity)/cuenta/office-review-panel.module.css",
          "sha256": "4e1ca532b4cf582d13dbd9a3de1b54f1c2ae97b360a69a5df628ad34780d9725"
        },
        {
          "path": "src/app/(identity)/cuenta/office-review-view.mjs",
          "sha256": "84762ddace81533b1684f23f9abafe8a06a3847fdd01fbbf67c84014c4e396f3"
        },
        {
          "path": "src/app/(identity)/cuenta/onboarding-guide.js",
          "sha256": "ef6d6c9ecbe942ec53df8b64610908533aebdbce0bc879d1a77218f26d83221c"
        },
        {
          "path": "src/app/(identity)/cuenta/onboarding-guide.module.css",
          "sha256": "12b7266039af5122e322ea712b9a54497bc5073eaa9037911760684d79c5dacc"
        },
        {
          "path": "src/app/(identity)/cuenta/operations-status-panel.js",
          "sha256": "e069565737378ca2583609a4b978d1ac6efdf9da922736b1bcf70d4674e84b5e"
        },
        {
          "path": "src/app/(identity)/cuenta/operations-status-panel.module.css",
          "sha256": "73d25fe9f75c2144aeb337dd0737c3cae3f07fb98c9acb39d6e6c88a4e6053ef"
        },
        {
          "path": "src/app/(identity)/cuenta/own-company-number-panel.js",
          "sha256": "d2146290e43adb77dc14b707787023a24ffe80c39e69eaa49fc876dcab3d267b"
        },
        {
          "path": "src/app/(identity)/cuenta/own-company-number-view.mjs",
          "sha256": "6940f11e30d2958d7f6771463ce28ca83c0e2d2f41e81aa220c8efe669580300"
        },
        {
          "path": "src/app/(identity)/cuenta/own-company-templates-panel.js",
          "sha256": "bf75e0cd2444493f07a90923ea73c4d0251e5cef0ab8516b8693cff395d5e91d"
        },
        {
          "path": "src/app/(identity)/cuenta/own-company-templates-view.mjs",
          "sha256": "3bf758b150336613a437e2b01d3b6a79645a024b771f1515f4ec2ae58a1b8bc3"
        },
        {
          "path": "src/app/(identity)/cuenta/page.js",
          "sha256": "eaa1eed27b9e3ff49a3b012b4eb50ed98ac9af90b183ae46129c96562b273667"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-account-discovery-format.mjs",
          "sha256": "3b9908b1a5e348dc7379a026f4e1d81942a7fa6b2b51e509fc5736586ed9fa1a"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-account-discovery.js",
          "sha256": "e53350614d51a51ba4f0d9b39a5a91bccd799fe65f3365d7746beb3fec3f6909"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-civil-data-panel.js",
          "sha256": "ea4a133fbf95065ca7a4a5ce2635cb60f80557d3f7f0c82e4129a68c42694807"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-civil-data-view.mjs",
          "sha256": "b475b011c2466d722ceecf64460b8b97eb5eedafd2fd873d5d8d97c889dcc1ff"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-kyc-capture.js",
          "sha256": "83ee427bbbecbf74aee901fd77c6981232a2cd07e235180566938c2c0201647d"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-kyc-capture.module.css",
          "sha256": "51b47533e4e6e1ce53038fc776fcd15f30e5893af472ccebd80f5e19d5e23f0f"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-kyc-chat-attempt-panel.js",
          "sha256": "153d39988f1b82e143e2c3c99b72ed0791687a70432246e16ae4c91c1fb395ee"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-kyc-chat-attempt-view.mjs",
          "sha256": "0a6aa93d1646bc7eedecf56b1dc84deb0b146f7386017eafa5affe255e40c52b"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-kyc-preanalysis-view.mjs",
          "sha256": "0e57a89f39f1ad3c0a00c27524d9c7b6a1b92d4610d7927c33f0afc791c63213"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-ocr-usage-view.mjs",
          "sha256": "29d3eecf963a9569cfc692f0f35f404c431b844d2e7f6476d62a38ad4c8ec2f9"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-office-account-view.mjs",
          "sha256": "f2716f72297a1277946bafa03a82d4c1fb7f2fcff7f4c4bbe155a86ed7e4e379"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-onboarding-next-step.mjs",
          "sha256": "18481bd2c61887a04321523aad36aa22c43406089e29f1450ff0874133a6d4ae"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-panel.js",
          "sha256": "a9d5934c7bda61c49362ac53cfb339a5d66497566f71415ecc4621686ce17519"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-panel.module.css",
          "sha256": "c1626d1a678f1060b1ccb9df106f32b041da2c3b2bd92ede3e65537aaf794c02"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-baseline-panel.js",
          "sha256": "d2d4bb3d3129e30d9181ab56b297723e105bde52aef6be9f907914340638329d"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-baseline-view.mjs",
          "sha256": "0c696eba748a7441440e23be5085dc42d4954427def5adc1e2de686b4b11711d"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-baseline.module.css",
          "sha256": "e33df0e4af4217f0516fecf5efef8eefef4278522ccfe1f97a1ad76390441b60"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-import-calendar-suggestions.mjs",
          "sha256": "be73d51220557e395295700a238024d9896ef627a305718518214fc7bd227457"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-import-panel.js",
          "sha256": "d74f0cdff0da1c173bc2ef566fed973ca02dd6bcc449aa8c3842d5109954d5f6"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-import-panel.module.css",
          "sha256": "c64771e75e83b6708ede012f90636bac1d13c19a3c1088c685513e702cc69061"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-import-usage-view.mjs",
          "sha256": "666668e0267f77599f191ca5ffa038da11232ad8bb08806d2b46d9193994a186"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-measurement-panel.js",
          "sha256": "d9d1cd683a8aaf0ad1ea5656c03c12c00935c3653f54d9326196617b60039832"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-measurement-panel.module.css",
          "sha256": "8290affa492be1699acb568c2ee4c8c5c672b3f2b06e2917f541c72bdacbde3a"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-measurement-view.mjs",
          "sha256": "02a80449af709fdda97dfaf48b0335bd96ab7dc363804f59a5d9ea8579581d30"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-partida-measurement-preview.js",
          "sha256": "e68aa0851e4d415408c21df76d3716c4e4196925223c155a96194d7db85566d8"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-partida-measurement-preview.mjs",
          "sha256": "f30a1c21396f61a1808446d9660554132b5df654e633d128dfe2f76336a9adc5"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-partida-source-preview.js",
          "sha256": "0869d7e7a5efe5e05e7b5f5f729da9e58d9f106329e31baf6ea79cabf990d3a9"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-partida-source-preview.mjs",
          "sha256": "fcd3a41c62138e77fc026c6651a0a228d9f4507b0a87c82a3b113b0e4fc26e8d"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-partida-source-preview.module.css",
          "sha256": "da7cfec61d043d0f217e706701994fb41ed1973733ccd37a35698f743aefd9ee"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-source-curve.js",
          "sha256": "b0f1ef1fee082e82f18d4bd2fb13377b27d8f9849e831f2c34120164f93f9a12"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-source-curve.mjs",
          "sha256": "689402d373744d159a62e2e5975ddfdf79053c528a838879dd5df3e43a0efdc9"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-source-curve.module.css",
          "sha256": "92f94328baac3fb0416002db12b5c19923fc28e6f89cb625df10038e0a96a180"
        },
        {
          "path": "src/app/(identity)/cuenta/portfolio-overview-panel.js",
          "sha256": "91940070e73099386731e669d3f4059564b72d1ad82691434d64dcac17adc318"
        },
        {
          "path": "src/app/(identity)/cuenta/portfolio-overview-panel.module.css",
          "sha256": "af5230820ce3c994d93e2262bc676ae5e3d69ffa380a866095fb88d997527c8c"
        },
        {
          "path": "src/app/(identity)/cuenta/portfolio-overview-view.mjs",
          "sha256": "8446fc933db4a867235a61ffbafdbbd0bcdc94d97000d5990c795df9e884739e"
        },
        {
          "path": "src/app/(identity)/cuenta/private-bank-account-format.mjs",
          "sha256": "4dcf7f2de2f49f97f155e14128b20815f538d659d5e82806fa45a18d541adeea"
        },
        {
          "path": "src/app/(identity)/cuenta/private-bank-account-panel.js",
          "sha256": "8c419e76293791fc441dc8685386d12498a3d3cca2938ae0cba0f7dc7c0c1180"
        },
        {
          "path": "src/app/(identity)/cuenta/private-bank-account-panel.module.css",
          "sha256": "269dd7c7c5e43bc959ef80dd94e3ab1cfd42b96b02d9c648ab21c281329796db"
        },
        {
          "path": "src/app/(identity)/cuenta/private-workspace-download.js",
          "sha256": "d86399de71069a9ca9a1fb330692f87728bf44b8b0b59ca691d457357a0eddab"
        },
        {
          "path": "src/app/(identity)/cuenta/project-creation-format.mjs",
          "sha256": "7cef11fff2447564b56b253d2105c3589b100d8374e4633321be1b96e7e75d8f"
        },
        {
          "path": "src/app/(identity)/cuenta/project-creation-panel.js",
          "sha256": "5c0cec226b92fa2a59d1e03cb2aea489bf8016304a43bd6259e35fd45fef2d92"
        },
        {
          "path": "src/app/(identity)/cuenta/project-creation-panel.module.css",
          "sha256": "a111badb3ae7bd4c1189a19670d2096bef482c3789d01bd7400677f13dd46d06"
        },
        {
          "path": "src/app/(identity)/cuenta/project-preparation-format.mjs",
          "sha256": "7833eea1fd3b0c86733172c580b2d0178aa76cc3acae1a0b80e54e51dcb06a19"
        },
        {
          "path": "src/app/(identity)/cuenta/project-preparation-panel.js",
          "sha256": "a8d6086ce10a40c44b74e5472ee6f0a05946118014cfa93dfc4ceff4611dc2ac"
        },
        {
          "path": "src/app/(identity)/cuenta/project-preparation-panel.module.css",
          "sha256": "a7766d92df0049fa05ce4d28baf30c655bd8f268e6fbf3a8462ae2cda326ee64"
        },
        {
          "path": "src/app/(identity)/cuenta/schedule-workbench.js",
          "sha256": "b214b66dcd910728798a3084b5d3698296e458db67855f38bc820aaebee75d8c"
        },
        {
          "path": "src/app/(identity)/cuenta/schedule-workbench.mjs",
          "sha256": "12a01f0ec44b65b70ca50f5fabcba2483e964d87556dcf62db92c84d4c2ee022"
        },
        {
          "path": "src/app/(identity)/cuenta/schedule-workbench.module.css",
          "sha256": "6643a7082034e523d9aaa9ba23195634dbfdd7a37cdf0cb3b9f02cbd13f5e11b"
        },
        {
          "path": "src/app/(identity)/cuenta/session-recovery.js",
          "sha256": "166582cb087e6ffb16ef294605f97545b5c1cfc22835fa4a358c3584804fee0f"
        },
        {
          "path": "src/app/(identity)/cuenta/site-purchase-panel.js",
          "sha256": "398697fb4d8850ca7f0738fc93a3f17b4313e7afdbbe9e9d1a87e9b613bd0225"
        },
        {
          "path": "src/app/(identity)/cuenta/site-purchase-panel.module.css",
          "sha256": "3fe757c073165128724352333e73a04f6741ac70b4c59fc0d100af025c284f04"
        },
        {
          "path": "src/app/(identity)/cuenta/site-purchase-view.mjs",
          "sha256": "58ebd978e8e39423901cb811ecf2ab851160b78f7cd5cb441075d66d7819dee9"
        },
        {
          "path": "src/app/(identity)/cuenta/site-register-panel.js",
          "sha256": "e8c0c456e09e9da3432dcbf01c1f4659540a596112fe28946889ae369d08d76e"
        },
        {
          "path": "src/app/(identity)/cuenta/site-register-panel.module.css",
          "sha256": "7d86974d7db3279116895cde681e231f135fb1a86e7e8b52bf74e7bb965fd0e2"
        },
        {
          "path": "src/app/(identity)/cuenta/task-create-panel.js",
          "sha256": "3d4b8f9865cdfa73b1f8c3543c4c4400babc09fe56cd21083d0bb96035445bee"
        },
        {
          "path": "src/app/(identity)/cuenta/task-progress-measurement-editor.js",
          "sha256": "2e95b587d9b6f4bfa1beb1eacdba44c4db8a7220cb6584befc6b4de79bf11eac"
        },
        {
          "path": "src/app/(identity)/cuenta/task-progress-measurement-editor.module.css",
          "sha256": "ca9b2e0432724c74a194d2648ff8dd3e7814ff192046ec02ab9f23e31d778b79"
        },
        {
          "path": "src/app/(identity)/cuenta/task-progress-measurement-view.mjs",
          "sha256": "b4b1e2645a7b4b853ba84525692b4d73596ea5490a6c000bbe9d2555cc286634"
        },
        {
          "path": "src/app/(identity)/cuenta/template-send-panel.js",
          "sha256": "c2ed4900b2f842031b713ce1d859e69e23e6278ca012c4d7b6011058c5bdc2ea"
        },
        {
          "path": "src/app/(identity)/cuenta/template-send-panel.module.css",
          "sha256": "de30d752855458140928f677e00ada91b80ad7ba574b3183b62b3d45f1e5eb56"
        },
        {
          "path": "src/app/(identity)/cuenta/template-send-view.mjs",
          "sha256": "703415b8dab1a575ebb54c9273049d2b940f93994add7177255ae26918672940"
        },
        {
          "path": "src/app/(identity)/cuenta/voice-progress-draft-view.js",
          "sha256": "a21b205b409cbbf6321036b23bc8a873d5d32388f4bad883793278531cec8d9a"
        },
        {
          "path": "src/app/(identity)/cuenta/worker-channel-panel.js",
          "sha256": "7325f3b80c5737fd39a266d0c77de703ff5515177b8945ecfa33c5250213903d"
        },
        {
          "path": "src/app/(identity)/cuenta/worker-channel-panel.module.css",
          "sha256": "28d5e1754f9345073d9a34d737f4e8b89c2f2f04e610e85c285ba81ea4f6e9ff"
        },
        {
          "path": "src/app/(identity)/cuenta/worksite-task-selector.js",
          "sha256": "d790aeec929ed1ef2ac724883988b03f6640f3882133d917760f0ddeb2a2488c"
        },
        {
          "path": "src/app/(identity)/cuenta/worksite-task-selector.module.css",
          "sha256": "12351228e827ea0e9a42a45f4d40a3fb713edd01bf0aab3ab6f58efbde7fa434"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-client.js",
          "sha256": "2fe5a56a7caf7d46f11e4292d2e145e3e72072198a09f9951ace42c2613e8db9"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-identity.js",
          "sha256": "c3867723ef4ef76a38dd52d19be76f2d78752e49110c8c36648130452879c8c2"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-live-read.mjs",
          "sha256": "a73e558f46b86a78cbe4f22783403af17061fe03e79f8e184f967448041909ec"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-live-refresh-controller.mjs",
          "sha256": "a61c2d017bc8dadb79fab4b0630b0404b65132d355e153bcb6a2042f5fd49511"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-live-refresh.js",
          "sha256": "78b056667e89f56fd9e1185c3addc6a8d40b331a0cd82146cbba17771662510a"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-overview.js",
          "sha256": "456e78d9e5c729182e65cd30141af37a5a6571d05261896ab5e19e39c4951c1b"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-recovery-journal.mjs",
          "sha256": "060e128b54eefdadfbabac45c3ec696934f5e74d79b9e26e905081128e8e99c5"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-recovery-panel.js",
          "sha256": "063361bf78293a61a246195d5734f69a17b08c5781ae5c9f502b85dcc51ef883"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-recovery-storage.mjs",
          "sha256": "d8cf1e7e8d88d66f722aaf52deb45f95829c226468d3f37a2b23d171cc1ecbb8"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-request-lifecycle.js",
          "sha256": "b3004538de2cc7cbc829bf5518c4f4b2a5eb2935d0b4e60f9c88840c8ede3797"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-request-lifecycle.mjs",
          "sha256": "590cd7691d8b6beb82929bdd18dd9909c2d2cfa1c3d4111ff4d478d57daf532f"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-screen.js",
          "sha256": "b5c217095badf8db73842b98d86b6ae498da9f01b793ccda3683dc46be040b4a"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-session-request.mjs",
          "sha256": "29d294ac1d973317d6a3df225a64a8a9115c6ea51c587f297114e7992af97520"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-task-page.mjs",
          "sha256": "9dde484ab352b4d64d0301e735ae511d7a75ef9633439e77558dd273de1d9aa6"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-tools-navigation.js",
          "sha256": "6e3bc5b9d14973153e080a55ba55a51f1c36838641c8510af4f2f664e676ddc9"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-tools-navigation.module.css",
          "sha256": "25e6e54bc34821a658490e0276f92aae48675fdcca8f9a4b563acb49b81d5b06"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-view-routing.mjs",
          "sha256": "d02f2d11ec5ce4a1419ed79c9639cdad40174c236382853778fc984f071e4df4"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace.module.css",
          "sha256": "339fee2591a341bbb7839a19d55a5c298c728ef1de38a2efc3680999f4636db4"
        },
        {
          "path": "src/app/(identity)/identity-load-guard.js",
          "sha256": "7fcc70f299551b2ba8aa13394b55139832f93630d93dd8f54630d58a86464543"
        },
        {
          "path": "src/app/(identity)/identity.module.css",
          "sha256": "3b8b7d36f1f52eff3329a22b8e1ad9708d865360cff10d75641fcf0a986030ce"
        },
        {
          "path": "src/app/brand/brand-geometry.js",
          "sha256": "73c97fb1bba20ee373c59971d7207122020557192acebd33192774e9724fcaf6"
        },
        {
          "path": "src/app/brand/brand-logo.js",
          "sha256": "2218b0d3551de28698c2dc56507d5d744cb19ccdfc78260d0c08e375face9d3b"
        },
        {
          "path": "src/app/brand/brand-logo.module.css",
          "sha256": "94bc6e069d56c477b4dd0e46d894217f411afc375267afd707af962ab5ce6ea3"
        },
        {
          "path": "src/lib/company-entitlement.mjs",
          "sha256": "65d41dfb796ef12be38b1220a99ccd3dfe277419a5e5a27e125beb29fe7e2cde"
        },
        {
          "path": "src/lib/company-phone-format.mjs",
          "sha256": "67b31114f517253961c6a774210f157867b1e2e318e6b700089eef03ef1b7209"
        },
        {
          "path": "src/lib/field-media-privacy.mjs",
          "sha256": "5ec7fc7dd71f9303a42bfb4889e02541de8a3cf356e8e1203cfeeefd56220515"
        },
        {
          "path": "src/lib/geo.js",
          "sha256": "fa47424540f953adf56e0c3069780c0c8876a2f69e944a80caddefa974b5b6bf"
        },
        {
          "path": "src/lib/identity-return-path.mjs",
          "sha256": "91f04f80b1a2dbc7d56b8dd4b532c0540d643c2b8f48cebc25c8fcbee8ab9cf0"
        },
        {
          "path": "src/lib/participant-analysis-consent.mjs",
          "sha256": "7f7d371914d1e46ac799cd1683afdc0418186c15a20156e697ecd879c81bf8c1"
        },
        {
          "path": "src/lib/participant-approved-identity.mjs",
          "sha256": "834d81e70cedbd967ff84d880ea9d697c2168d2220fb23d9eb14c1aba1cdbbf1"
        },
        {
          "path": "src/lib/participant-bank-format.mjs",
          "sha256": "ebbb206a14eaac57230b53ec1afae99c4be60c8739baf0d1d047d4a47ba464db"
        },
        {
          "path": "src/lib/participant-kyc-image-set.mjs",
          "sha256": "190ce2560286a58d42668da7b912aeabcfa76ee14086503bf1609304e5f0e8fb"
        },
        {
          "path": "src/lib/participant-onboarding-policy.mjs",
          "sha256": "59409797ce3e13b7cfe63fe21d8d7e2c848ee49e0766015939242a9f43687c03"
        },
        {
          "path": "src/lib/participant-policy.mjs",
          "sha256": "7f3969ab1ebac5f01696149d76337199eb64c2fd09015c44c07e8b7e7088d62f"
        },
        {
          "path": "src/lib/participant-verified-office.mjs",
          "sha256": "4922f392490aa6d49b8a8a45a56ac0b03831a8ad2efe89ce1e3adfd77d603d89"
        },
        {
          "path": "src/lib/plan-import-cyp-curve.mjs",
          "sha256": "7e1d6c9d87df5e74e0a340361e1e66fdf0cfd5c82f1e44030ba2e85b5fa9c342"
        },
        {
          "path": "src/lib/plan-import-document-curve.mjs",
          "sha256": "7f63d62b9f1ae6d139c627a978ef56d7eafea0e0f4271167daa4c00bf7fda013"
        },
        {
          "path": "src/lib/private-image-upload.mjs",
          "sha256": "1eaeda2fa79104cfe00a8736c466d8568d216c8682bd44031d3bf9d4f35e3f60"
        },
        {
          "path": "src/lib/production-identity-config.mjs",
          "sha256": "3738a8544a7e26af4f03befe9afd0dee3ec70ae0e8c89d456dd81a1b87dfdee1"
        },
        {
          "path": "src/lib/progress-measurement-quantity.js",
          "sha256": "e194f461d482dec666c090a19aabbd3498bc08964cbbbc31b8db6eeb39cb1be2"
        },
        {
          "path": "src/lib/session-recovery.mjs",
          "sha256": "a44cf530faefa0fd74961d30993897f24f9e929237c01d0ebde4badd6c90ba07"
        },
        {
          "path": "src/lib/site-register-policy.mjs",
          "sha256": "d529c4f2225e0ec851ef7df60f8c5b182a88b384958ebfd15b194683d1590434"
        },
        {
          "path": "src/lib/task-progress-measurement.js",
          "sha256": "10361a0e30df34f9c90f915d9fdbfc0912a610ab3ce851503c32549b7049a8b9"
        },
        {
          "path": "src/lib/verified-session.mjs",
          "sha256": "744fe1ebe8c250aee7bf5e7ff1c07c89b37b42dd9f6ada29b82258995fdd296d"
        },
        {
          "path": "src/lib/voice-progress-draft.mjs",
          "sha256": "56ddbad919a1ad77e13105f1a125914674c1a149a88e28fa2f8b831a4d14bd69"
        },
        {
          "path": "src/lib/whatsapp/tenant-workspace-policy.js",
          "sha256": "d3416ff993fbfd70f75404166cdcd8f0b9b2e5a6741f6cde03725aab16abcd5e"
        },
        {
          "path": "src/lib/workspace-policy.mjs",
          "sha256": "ba51cc5c4a6e4f5ce1c9382cae2c8ea903ab4373668c05384c7f1e9253c7041e"
        },
        {
          "path": "tests/fixtures/integrated-identity-contract-27aa.json",
          "sha256": "3c1a184f2e6839bba6bd7116ccf6c062fbb015500ec4900583dbd15f82fe7270"
        },
        {
          "path": "tests/fixtures/plan-measurement-contract-a203.json",
          "sha256": "10319b1ab8a283b7c89cab96a279e20e25fe4be2736d91caaa915a4e62afa524"
        },
        {
          "path": "tests/fixtures/whatsapp-field-continuity-contract-052.json",
          "sha256": "f7a72979af7b789d92333d4f631d6bbbccf247c5c04ce6edd88f64f70b6099bb"
        },
        {
          "path": "tests/fixtures/workspace-continuity-contract-d5d.json",
          "sha256": "8c2afc33e9454b9c7a9d9fd2056f2c3de75f4657bbcbce4fb1bdf618e0590db3"
        },
        {
          "path": "tests/production-company-bootstrap-receipt.test.mjs",
          "sha256": "44676be514b092d8146f6f8ade5c4b0867f8bceb1b9f5c7ab204bb5f90e503af"
        },
        {
          "path": "tests/production-focused-workspace-ci.test.mjs",
          "sha256": "0319f722df958e9928d9ec8d27819f7e482cf66bc3c565c6743ced30f016921e"
        },
        {
          "path": "tests/production-focused-workspace-continuity-ui.test.mjs",
          "sha256": "d545f4361f513e3b1c7a3b3ca9db5bd6d12be0ae74b3df327880fb9954649a8d"
        },
        {
          "path": "tests/production-focused-workspace-navigation.test.mjs",
          "sha256": "5f6614ed798d02be2b99de9267c2766ec61e8d1b4d46c3fefed3aa69832bde7e"
        },
        {
          "path": "tests/production-focused-workspace-task-pagination.test.mjs",
          "sha256": "5afbb67627d790d41df2d9cde0270dcafe93ab5292d822c9a45534203acaed34"
        },
        {
          "path": "tests/production-focused-workspace-ui.test.mjs",
          "sha256": "70ae514cae438c367c30407b083c68121a9496323fe877a4c874f432bd7447ac"
        },
        {
          "path": "tests/production-integrated-identity-current-ci-lineage.test.mjs",
          "sha256": "c0e1179a42bc106ad08b24e20470670c61b0b83b52c62cf4533322ce1ae6a157"
        }
      ]
    },
    {
      "family": "UI_FIELD_TASK_PAGINATION",
      "previousExternalImports": [
        "@babel/parser",
        "jsqr",
        "next/dist/build/swc/index.js",
        "node:assert/strict",
        "node:child_process",
        "node:crypto",
        "node:fs",
        "node:net",
        "node:path",
        "node:test",
        "node:timers/promises",
        "node:url",
        "puppeteer",
        "react",
        "react-dom/server"
      ],
      "currentFiles": [
        "package-lock.json",
        "package.json",
        "scripts/lib/field-outbound-current-ci-lineage.mjs",
        "scripts/lib/home-decisions-current-ci-lineage.mjs",
        "scripts/lib/integrated-identity-current-ci-lineage.mjs",
        "scripts/lib/kyc-expired-current-ci-lineage.mjs",
        "scripts/lib/material-review-current-ci-lineage.mjs",
        "scripts/lib/meta-existing-api-plan-current-ci-lineage.mjs",
        "scripts/lib/ooxml-accounting-current-ci-lineage.mjs",
        "scripts/lib/owned-fixture-cleanup.mjs",
        "scripts/lib/participant-preanalysis-current-ci-lineage.mjs",
        "scripts/lib/plan-measurement-current-ci-lineage.mjs",
        "scripts/lib/plan-measurement-document-association-ci-lineage.mjs",
        "scripts/lib/plan-partida-preview-current-ci-lineage.mjs",
        "scripts/lib/plan-partida-preview-current-ci-reviewed.mjs",
        "scripts/lib/whatsapp-field-continuity-current-ci-lineage.mjs",
        "scripts/lib/worksite-live-hours-current-ci-lineage.mjs",
        "scripts/lib/worksite-live-hours-current-ci-reviewed.mjs",
        "scripts/lib/workspace-continuity-current-ci-lineage.mjs",
        "scripts/verify-field-task-pagination-ci.mjs",
        "scripts/verify-field-task-pagination-ui.mjs",
        "src/app/(identity)/cuenta/company-channel-view.mjs",
        "src/app/(identity)/cuenta/field-hours-report-panel.js",
        "src/app/(identity)/cuenta/field-hours-report-panel.module.css",
        "src/app/(identity)/cuenta/field-media-capture.js",
        "src/app/(identity)/cuenta/field-media-held-view.mjs",
        "src/app/(identity)/cuenta/field-media-preparation.mjs",
        "src/app/(identity)/cuenta/field-media-preview.js",
        "src/app/(identity)/cuenta/field-operations-panel.js",
        "src/app/(identity)/cuenta/field-operations-panel.module.css",
        "src/app/(identity)/cuenta/field-overtime-view.js",
        "src/app/(identity)/cuenta/field-overtime-view.module.css",
        "src/app/(identity)/cuenta/field-qr-capture.js",
        "src/app/(identity)/cuenta/field-qr-reader.mjs",
        "src/app/(identity)/cuenta/field-review-page-view.mjs",
        "src/app/(identity)/cuenta/material-inventory-panel.js",
        "src/app/(identity)/cuenta/material-inventory-panel.module.css",
        "src/app/(identity)/cuenta/material-inventory-view.mjs",
        "src/app/(identity)/cuenta/own-company-number-view.mjs",
        "src/app/(identity)/cuenta/own-company-templates-view.mjs",
        "src/app/(identity)/cuenta/participant-office-account-view.mjs",
        "src/app/(identity)/cuenta/plan-baseline-view.mjs",
        "src/app/(identity)/cuenta/plan-source-curve.mjs",
        "src/app/(identity)/cuenta/private-bank-account-format.mjs",
        "src/app/(identity)/cuenta/private-workspace-download.js",
        "src/app/(identity)/cuenta/schedule-workbench.mjs",
        "src/app/(identity)/cuenta/site-purchase-view.mjs",
        "src/app/(identity)/cuenta/task-progress-measurement-view.mjs",
        "src/app/(identity)/cuenta/voice-progress-draft-view.js",
        "src/app/(identity)/cuenta/worksite-task-selector.js",
        "src/app/(identity)/cuenta/worksite-task-selector.module.css",
        "src/app/(identity)/cuenta/workspace-live-read.mjs",
        "src/app/(identity)/cuenta/workspace-live-refresh-controller.mjs",
        "src/app/(identity)/cuenta/workspace-live-refresh.js",
        "src/app/(identity)/cuenta/workspace-recovery-journal.mjs",
        "src/app/(identity)/cuenta/workspace-recovery-storage.mjs",
        "src/app/(identity)/cuenta/workspace-request-lifecycle.js",
        "src/app/(identity)/cuenta/workspace-request-lifecycle.mjs",
        "src/app/(identity)/cuenta/workspace-session-request.mjs",
        "src/app/(identity)/cuenta/workspace-task-page.mjs",
        "src/lib/field-media-privacy.mjs",
        "src/lib/geo.js",
        "src/lib/plan-import-cyp-curve.mjs",
        "src/lib/plan-import-document-curve.mjs",
        "src/lib/progress-measurement-quantity.js",
        "src/lib/task-progress-measurement.js",
        "src/lib/voice-progress-draft.mjs",
        "tests/fixtures/integrated-identity-contract-27aa.json",
        "tests/fixtures/plan-measurement-contract-a203.json",
        "tests/fixtures/whatsapp-field-continuity-contract-052.json",
        "tests/fixtures/workspace-continuity-contract-d5d.json",
        "tests/production-field-task-pagination-ci.test.mjs",
        "tests/production-whatsapp-field-continuity-current-ci-lineage.test.mjs",
        "tests/production-worksite-task-selector.test.mjs",
        "tests/production-workspace-task-page.test.mjs"
      ],
      "externalImports": [
        "@babel/parser",
        "jsqr",
        "next/dist/build/swc/index.js",
        "node:assert/strict",
        "node:child_process",
        "node:crypto",
        "node:fs",
        "node:net",
        "node:path",
        "node:test",
        "node:timers/promises",
        "node:url",
        "node:zlib",
        "puppeteer",
        "react",
        "react-dom/server"
      ],
      "currentManifest": [
        {
          "path": "package-lock.json",
          "sha256": "dfa3ff3914547f35828a0b697e6007c6cf856546be86bf8a7810cdce59e60449"
        },
        {
          "path": "package.json",
          "sha256": "6b7918c67edddee946d9455aa71913987f54f8abe441e0c3e560560a89061c4d"
        },
        {
          "path": "scripts/lib/field-outbound-current-ci-lineage.mjs",
          "sha256": "7801d9d074c4451178d7900d605aa75c91ebf6b4a82a24f997e89d0284008c7b"
        },
        {
          "path": "scripts/lib/home-decisions-current-ci-lineage.mjs",
          "sha256": "46653e34f0b0ab46617578525e4f0b71e295f240eceeec87ccb0944cd5db21a8"
        },
        {
          "path": "scripts/lib/integrated-identity-current-ci-lineage.mjs",
          "sha256": "aaf23ee0e97231520f29669136d969ffc513bd6b52067df751d3dc6cf9c86bb8"
        },
        {
          "path": "scripts/lib/kyc-expired-current-ci-lineage.mjs",
          "sha256": "5077fde271911fa020e7751bfb27d20fbf3f07f10d6069c482c8739d2c3026ef"
        },
        {
          "path": "scripts/lib/material-review-current-ci-lineage.mjs",
          "sha256": "805e35504f147f017b4e70889c29c92175a4673f03916630319f6f25d040c4b4"
        },
        {
          "path": "scripts/lib/meta-existing-api-plan-current-ci-lineage.mjs",
          "sha256": "93763476c4dc0b193cf1e4d174f7eae71c0daf1081827d18d21cc7ee22f7d586"
        },
        {
          "path": "scripts/lib/ooxml-accounting-current-ci-lineage.mjs",
          "sha256": "481bd570fe9eb6b08db6568e830e5c74f4d07a3e0eebff9f95c4abc541db9681"
        },
        {
          "path": "scripts/lib/owned-fixture-cleanup.mjs",
          "sha256": "44a9df241dd8426fe8d148b1b33110fe1e103960814e81f1f9a41638d8613844"
        },
        {
          "path": "scripts/lib/participant-preanalysis-current-ci-lineage.mjs",
          "sha256": "3c330d4f821d7f2c998dd17064c67ffdcc52dc3cfbd033c165af39e071333f7b"
        },
        {
          "path": "scripts/lib/plan-measurement-current-ci-lineage.mjs",
          "sha256": "19addbc7ba23c963c2a1a9fae59fbc8cb2658f94d345cc7b731a5d9648dce818"
        },
        {
          "path": "scripts/lib/plan-measurement-document-association-ci-lineage.mjs",
          "sha256": "0a14f5211348d30d3a16b441a126880aeed8c7e196973ecceda7ee00307f0ef4"
        },
        {
          "path": "scripts/lib/plan-partida-preview-current-ci-lineage.mjs",
          "sha256": "e793dbc5e5096926f71cc14ba60696b1becb2d3ed775aa75b00ad412c4e85e7e"
        },
        {
          "path": "scripts/lib/plan-partida-preview-current-ci-reviewed.mjs",
          "sha256": "REVIEWED_DECLARATION_TRUST_ANCHOR"
        },
        {
          "path": "scripts/lib/whatsapp-field-continuity-current-ci-lineage.mjs",
          "sha256": "5960b4acedd880ac0a49f157e57007863c2478ad218e504eb81bf993ad54b147"
        },
        {
          "path": "scripts/lib/worksite-live-hours-current-ci-lineage.mjs",
          "sha256": "86c626156b82419640b4dc45520a7dcca330810949a346ae60f50566a136f2e6"
        },
        {
          "path": "scripts/lib/worksite-live-hours-current-ci-reviewed.mjs",
          "sha256": "8da86cb1eeb978e37843d4f722da44968e4a089fd719aa35ebd966395f784758"
        },
        {
          "path": "scripts/lib/workspace-continuity-current-ci-lineage.mjs",
          "sha256": "cb26d5ea9922fb9a3fb72d1a35010229a1d4b49f4784783294a4d1d503fdc81a"
        },
        {
          "path": "scripts/verify-field-task-pagination-ci.mjs",
          "sha256": "1e366a583be909323327524a8fe04db9eb962724ec5073bdf3eb36140ddcdecc"
        },
        {
          "path": "scripts/verify-field-task-pagination-ui.mjs",
          "sha256": "4b98ee409dfca7fa78ffac58c82796c9013f34286691e19e4993149ffd0ad604"
        },
        {
          "path": "src/app/(identity)/cuenta/company-channel-view.mjs",
          "sha256": "c79c473999e444b84e2a1d58e0d03f030069c24f9749f2c84450318b0b237e4d"
        },
        {
          "path": "src/app/(identity)/cuenta/field-hours-report-panel.js",
          "sha256": "d91074b8b1693c95dcf80a86fc73711fbd98a7ba482251ade68fd227166fb748"
        },
        {
          "path": "src/app/(identity)/cuenta/field-hours-report-panel.module.css",
          "sha256": "0c8eefb85891cade983a42b7f4463962319c9fe27c0c5d157011108255c2bd75"
        },
        {
          "path": "src/app/(identity)/cuenta/field-media-capture.js",
          "sha256": "f8019225870bc6ccf04818ad7ff305798d53ea9b523400385816ba7fe2117559"
        },
        {
          "path": "src/app/(identity)/cuenta/field-media-held-view.mjs",
          "sha256": "cfc01204f973281e77a49627c7c5e32c6bdd04a1bc4c6e0a9e93773eca4faf71"
        },
        {
          "path": "src/app/(identity)/cuenta/field-media-preparation.mjs",
          "sha256": "df03121d9a7beb6b4a77946cefb09ce00710a6e22b5c8b680b180dd5a2e64a6f"
        },
        {
          "path": "src/app/(identity)/cuenta/field-media-preview.js",
          "sha256": "d39d47da18f60c69a38eee22b62929087a7cc0b379a620af8a83b62573161110"
        },
        {
          "path": "src/app/(identity)/cuenta/field-operations-panel.js",
          "sha256": "69af7d8b95378f0b7f26f880eaec61d891c38744e9e6781eca9fe539776a91ed"
        },
        {
          "path": "src/app/(identity)/cuenta/field-operations-panel.module.css",
          "sha256": "5ccd8b5beae691b9ab6ee2dc0c0ae876a5fdffe15d31d24c6807f117bd76949c"
        },
        {
          "path": "src/app/(identity)/cuenta/field-overtime-view.js",
          "sha256": "161a09cb92b09695c4007cf99c3c7755586bf8e05d7f93e147fe9f1bfb45ca60"
        },
        {
          "path": "src/app/(identity)/cuenta/field-overtime-view.module.css",
          "sha256": "e7f9e4ff4216fdb18b333d0b8cd40a5b3158e5f2e398f6207ab5cea2789fcf7a"
        },
        {
          "path": "src/app/(identity)/cuenta/field-qr-capture.js",
          "sha256": "3bc42cb87ec6554a9ac6001b199f434f087e4156139d76428d1ebaf43d12e37d"
        },
        {
          "path": "src/app/(identity)/cuenta/field-qr-reader.mjs",
          "sha256": "04157b9fc7a197271bac76d41217db8876b42dc6fbc6cb068a7052d2ea2b5b31"
        },
        {
          "path": "src/app/(identity)/cuenta/field-review-page-view.mjs",
          "sha256": "18f3616144c03aacf9c9859ae210150d92f6838de7332cee2550fa5fe91603fb"
        },
        {
          "path": "src/app/(identity)/cuenta/material-inventory-panel.js",
          "sha256": "0faadb854099ef161b9c869cc2b4c0aeb16d102e59fcaca8ef27fecd614d2924"
        },
        {
          "path": "src/app/(identity)/cuenta/material-inventory-panel.module.css",
          "sha256": "1d7eec4afc275ee403674b187acb7844e3df519f24cd537af2e05f7b8032611c"
        },
        {
          "path": "src/app/(identity)/cuenta/material-inventory-view.mjs",
          "sha256": "8b987424dd1db2332cbb26f792e51c8fea286bd5440f4d3235809e3869722b83"
        },
        {
          "path": "src/app/(identity)/cuenta/own-company-number-view.mjs",
          "sha256": "6940f11e30d2958d7f6771463ce28ca83c0e2d2f41e81aa220c8efe669580300"
        },
        {
          "path": "src/app/(identity)/cuenta/own-company-templates-view.mjs",
          "sha256": "3bf758b150336613a437e2b01d3b6a79645a024b771f1515f4ec2ae58a1b8bc3"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-office-account-view.mjs",
          "sha256": "f2716f72297a1277946bafa03a82d4c1fb7f2fcff7f4c4bbe155a86ed7e4e379"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-baseline-view.mjs",
          "sha256": "0c696eba748a7441440e23be5085dc42d4954427def5adc1e2de686b4b11711d"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-source-curve.mjs",
          "sha256": "689402d373744d159a62e2e5975ddfdf79053c528a838879dd5df3e43a0efdc9"
        },
        {
          "path": "src/app/(identity)/cuenta/private-bank-account-format.mjs",
          "sha256": "4dcf7f2de2f49f97f155e14128b20815f538d659d5e82806fa45a18d541adeea"
        },
        {
          "path": "src/app/(identity)/cuenta/private-workspace-download.js",
          "sha256": "d86399de71069a9ca9a1fb330692f87728bf44b8b0b59ca691d457357a0eddab"
        },
        {
          "path": "src/app/(identity)/cuenta/schedule-workbench.mjs",
          "sha256": "12a01f0ec44b65b70ca50f5fabcba2483e964d87556dcf62db92c84d4c2ee022"
        },
        {
          "path": "src/app/(identity)/cuenta/site-purchase-view.mjs",
          "sha256": "58ebd978e8e39423901cb811ecf2ab851160b78f7cd5cb441075d66d7819dee9"
        },
        {
          "path": "src/app/(identity)/cuenta/task-progress-measurement-view.mjs",
          "sha256": "b4b1e2645a7b4b853ba84525692b4d73596ea5490a6c000bbe9d2555cc286634"
        },
        {
          "path": "src/app/(identity)/cuenta/voice-progress-draft-view.js",
          "sha256": "a21b205b409cbbf6321036b23bc8a873d5d32388f4bad883793278531cec8d9a"
        },
        {
          "path": "src/app/(identity)/cuenta/worksite-task-selector.js",
          "sha256": "d790aeec929ed1ef2ac724883988b03f6640f3882133d917760f0ddeb2a2488c"
        },
        {
          "path": "src/app/(identity)/cuenta/worksite-task-selector.module.css",
          "sha256": "12351228e827ea0e9a42a45f4d40a3fb713edd01bf0aab3ab6f58efbde7fa434"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-live-read.mjs",
          "sha256": "a73e558f46b86a78cbe4f22783403af17061fe03e79f8e184f967448041909ec"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-live-refresh-controller.mjs",
          "sha256": "a61c2d017bc8dadb79fab4b0630b0404b65132d355e153bcb6a2042f5fd49511"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-live-refresh.js",
          "sha256": "78b056667e89f56fd9e1185c3addc6a8d40b331a0cd82146cbba17771662510a"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-recovery-journal.mjs",
          "sha256": "060e128b54eefdadfbabac45c3ec696934f5e74d79b9e26e905081128e8e99c5"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-recovery-storage.mjs",
          "sha256": "d8cf1e7e8d88d66f722aaf52deb45f95829c226468d3f37a2b23d171cc1ecbb8"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-request-lifecycle.js",
          "sha256": "b3004538de2cc7cbc829bf5518c4f4b2a5eb2935d0b4e60f9c88840c8ede3797"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-request-lifecycle.mjs",
          "sha256": "590cd7691d8b6beb82929bdd18dd9909c2d2cfa1c3d4111ff4d478d57daf532f"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-session-request.mjs",
          "sha256": "29d294ac1d973317d6a3df225a64a8a9115c6ea51c587f297114e7992af97520"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-task-page.mjs",
          "sha256": "9dde484ab352b4d64d0301e735ae511d7a75ef9633439e77558dd273de1d9aa6"
        },
        {
          "path": "src/lib/field-media-privacy.mjs",
          "sha256": "5ec7fc7dd71f9303a42bfb4889e02541de8a3cf356e8e1203cfeeefd56220515"
        },
        {
          "path": "src/lib/geo.js",
          "sha256": "fa47424540f953adf56e0c3069780c0c8876a2f69e944a80caddefa974b5b6bf"
        },
        {
          "path": "src/lib/plan-import-cyp-curve.mjs",
          "sha256": "7e1d6c9d87df5e74e0a340361e1e66fdf0cfd5c82f1e44030ba2e85b5fa9c342"
        },
        {
          "path": "src/lib/plan-import-document-curve.mjs",
          "sha256": "7f63d62b9f1ae6d139c627a978ef56d7eafea0e0f4271167daa4c00bf7fda013"
        },
        {
          "path": "src/lib/progress-measurement-quantity.js",
          "sha256": "e194f461d482dec666c090a19aabbd3498bc08964cbbbc31b8db6eeb39cb1be2"
        },
        {
          "path": "src/lib/task-progress-measurement.js",
          "sha256": "10361a0e30df34f9c90f915d9fdbfc0912a610ab3ce851503c32549b7049a8b9"
        },
        {
          "path": "src/lib/voice-progress-draft.mjs",
          "sha256": "56ddbad919a1ad77e13105f1a125914674c1a149a88e28fa2f8b831a4d14bd69"
        },
        {
          "path": "tests/fixtures/integrated-identity-contract-27aa.json",
          "sha256": "3c1a184f2e6839bba6bd7116ccf6c062fbb015500ec4900583dbd15f82fe7270"
        },
        {
          "path": "tests/fixtures/plan-measurement-contract-a203.json",
          "sha256": "10319b1ab8a283b7c89cab96a279e20e25fe4be2736d91caaa915a4e62afa524"
        },
        {
          "path": "tests/fixtures/whatsapp-field-continuity-contract-052.json",
          "sha256": "f7a72979af7b789d92333d4f631d6bbbccf247c5c04ce6edd88f64f70b6099bb"
        },
        {
          "path": "tests/fixtures/workspace-continuity-contract-d5d.json",
          "sha256": "8c2afc33e9454b9c7a9d9fd2056f2c3de75f4657bbcbce4fb1bdf618e0590db3"
        },
        {
          "path": "tests/production-field-task-pagination-ci.test.mjs",
          "sha256": "0d8abfb43c696a007bbc676d8472599b24cc3d7edb465419f992d9811f988999"
        },
        {
          "path": "tests/production-whatsapp-field-continuity-current-ci-lineage.test.mjs",
          "sha256": "43e1b60497a81d1598674fc3500b8ed47fa9be807c03788641ff5cf12c129521"
        },
        {
          "path": "tests/production-worksite-task-selector.test.mjs",
          "sha256": "15d764467be94b0f84cc0988d969458ee52660d6f1d2f4c7c5cb96d5d9125a7f"
        },
        {
          "path": "tests/production-workspace-task-page.test.mjs",
          "sha256": "9bed3622f630c43c4069ce8cb0a8c4fa6a42a262a6550cc0f9e6ef83220e3fb6"
        }
      ]
    },
    {
      "family": "PLAN_MEASUREMENT",
      "previousExternalImports": [
        "ffmpeg-static",
        "node:assert/strict",
        "node:child_process",
        "node:crypto",
        "node:fs",
        "node:fs/promises",
        "node:os",
        "node:path",
        "node:perf_hooks",
        "node:url",
        "node:zlib",
        "pg",
        "saxes",
        "yauzl"
      ],
      "currentFiles": [
        "scripts/fixtures/canonical-participant-kyc.mjs",
        "scripts/lib/company-channel-disposable-fixture.mjs",
        "scripts/lib/disposable-postgres-cleanup.mjs",
        "scripts/verify-plan-measurement-postgres.mjs",
        "src/app/(identity)/cuenta/private-bank-account-format.mjs",
        "src/lib/bindx-civil-data-client.mjs",
        "src/lib/brand-assets.mjs",
        "src/lib/canonical-invited-account.mjs",
        "src/lib/company-channel-connection.mjs",
        "src/lib/company-channel-kyc.mjs",
        "src/lib/company-channel-routing.mjs",
        "src/lib/company-channel-schema.mjs",
        "src/lib/company-entitlement.mjs",
        "src/lib/company-onboarding-policy.mjs",
        "src/lib/company-phone-format.mjs",
        "src/lib/employee-intake-channel-continuity.mjs",
        "src/lib/field-hours-report.mjs",
        "src/lib/field-media-privacy.mjs",
        "src/lib/field-media.mjs",
        "src/lib/field-operations-policy.mjs",
        "src/lib/field-operations-store.mjs",
        "src/lib/field-overtime-policy.mjs",
        "src/lib/field-overtime-store.mjs",
        "src/lib/field-report-feedback.mjs",
        "src/lib/field-shift-summary.mjs",
        "src/lib/geo.js",
        "src/lib/legacy-access-boundary.js",
        "src/lib/material-inventory.mjs",
        "src/lib/meta-callback-diagnostics.mjs",
        "src/lib/meta-channel-binding.mjs",
        "src/lib/meta-cloud-protocol.mjs",
        "src/lib/meta-customer-app-projection.mjs",
        "src/lib/meta-customer-callback.mjs",
        "src/lib/meta-customer-coexistence.mjs",
        "src/lib/meta-customer-credentials.mjs",
        "src/lib/meta-customer-inbox-review.mjs",
        "src/lib/meta-customer-outbound.mjs",
        "src/lib/meta-customer-permissions.mjs",
        "src/lib/meta-customer-processing.mjs",
        "src/lib/meta-customer-provider.mjs",
        "src/lib/meta-customer-templates.mjs",
        "src/lib/meta-development-pilot-policy.mjs",
        "src/lib/meta-employee-intake.mjs",
        "src/lib/meta-field-bridge.mjs",
        "src/lib/meta-field-conversation.mjs",
        "src/lib/meta-kyc-challenge.mjs",
        "src/lib/meta-kyc-conversation.mjs",
        "src/lib/meta-kyc-current-image.mjs",
        "src/lib/meta-kyc-identity.mjs",
        "src/lib/meta-kyc-rejection-policy.mjs",
        "src/lib/meta-kyc-rejection.mjs",
        "src/lib/meta-own-company-policy.mjs",
        "src/lib/meta-plan-import-conversation.mjs",
        "src/lib/meta-plan-import-origin.mjs",
        "src/lib/meta-plan-import-transport.mjs",
        "src/lib/meta-test-recipient-binding.mjs",
        "src/lib/meta-whatsapp-transport.mjs",
        "src/lib/organization-resource-usage-policy.mjs",
        "src/lib/organization-usage-policy.mjs",
        "src/lib/participant-account-discovery.mjs",
        "src/lib/participant-admission.mjs",
        "src/lib/participant-analysis-consent.mjs",
        "src/lib/participant-approved-identity.mjs",
        "src/lib/participant-bank-account.mjs",
        "src/lib/participant-bank-format.mjs",
        "src/lib/participant-bank-vault.mjs",
        "src/lib/participant-channel-kyc.mjs",
        "src/lib/participant-civil-policy.mjs",
        "src/lib/participant-civil-store.mjs",
        "src/lib/participant-kyc-chat-attempt.mjs",
        "src/lib/participant-kyc-chat-closure.mjs",
        "src/lib/participant-kyc-chat-copy.mjs",
        "src/lib/participant-kyc-image-set.mjs",
        "src/lib/participant-kyc-notice-links.mjs",
        "src/lib/participant-kyc-preanalysis-policy.mjs",
        "src/lib/participant-onboarding-authority.mjs",
        "src/lib/participant-onboarding-current-kyc.mjs",
        "src/lib/participant-onboarding-delivery.mjs",
        "src/lib/participant-onboarding-intent.mjs",
        "src/lib/participant-onboarding-policy.mjs",
        "src/lib/participant-onboarding-reactive.mjs",
        "src/lib/participant-policy.mjs",
        "src/lib/participant-store.mjs",
        "src/lib/participant-verified-office.mjs",
        "src/lib/person-worksite-journey.mjs",
        "src/lib/pilot-media.mjs",
        "src/lib/plan-baseline-policy.mjs",
        "src/lib/plan-import-analyzer.mjs",
        "src/lib/plan-import-cyp-curve.mjs",
        "src/lib/plan-import-document-curve.mjs",
        "src/lib/plan-import-monthly-curve.mjs",
        "src/lib/plan-import-ooxml.mjs",
        "src/lib/plan-import-policy.mjs",
        "src/lib/plan-import-store.mjs",
        "src/lib/plan-measurement-configuration.mjs",
        "src/lib/plan-measurement-policy.mjs",
        "src/lib/plan-measurement-source.mjs",
        "src/lib/plan-measurement-store.mjs",
        "src/lib/private-image-upload.mjs",
        "src/lib/procurement-quantity.js",
        "src/lib/progress-measurement-quantity.js",
        "src/lib/site-register-policy.mjs",
        "src/lib/site-register-store.mjs",
        "src/lib/task-progress-measurement.js",
        "src/lib/video-audio-extractor.mjs",
        "src/lib/video-frame-extractor.mjs",
        "src/lib/voice-progress-draft.mjs",
        "src/lib/whatsapp/field-worker-intent-policy.js",
        "src/lib/whatsapp/obra-intent-policy.js",
        "src/lib/whatsapp/operational-proposal-decision-policy.js",
        "src/lib/whatsapp/project-workspace-profile.js",
        "src/lib/whatsapp/template-review-policy.js",
        "src/lib/whatsapp/tenant-workspace-policy.js",
        "src/lib/worker-channel-consent-policy.mjs",
        "src/lib/worker-channel-identity.mjs",
        "src/lib/workspace-policy.mjs",
        "src/lib/workspace-store.mjs",
        "tests/fixtures/plan-import-ooxml-synthetic.mjs",
        "tests/fixtures/plan-measurement-source-synthetic.mjs"
      ],
      "externalImports": [
        "ffmpeg-static",
        "node:assert/strict",
        "node:child_process",
        "node:crypto",
        "node:fs",
        "node:fs/promises",
        "node:os",
        "node:path",
        "node:perf_hooks",
        "node:url",
        "node:zlib",
        "pg",
        "saxes",
        "yauzl"
      ],
      "currentManifest": [
        {
          "path": "scripts/fixtures/canonical-participant-kyc.mjs",
          "sha256": "09928b417f3319d76ba34fac91f89a1888f3a8e613bfde3775cac424cc441ccb"
        },
        {
          "path": "scripts/lib/company-channel-disposable-fixture.mjs",
          "sha256": "717d87a6fb1dd7f6a8b2a2d19cd3b2fee652d536e958bd833bf8431c31076138"
        },
        {
          "path": "scripts/lib/disposable-postgres-cleanup.mjs",
          "sha256": "df8d9f36b79cdd5f2d940c0dc4bbc88acbb0bec6e66c9ee5ae93ad5c6e4ab89e"
        },
        {
          "path": "scripts/verify-plan-measurement-postgres.mjs",
          "sha256": "13a022b79f8b2934cb353b81aa1be0ed52d48af95ad457746d4b884aa3260ba4"
        },
        {
          "path": "src/app/(identity)/cuenta/private-bank-account-format.mjs",
          "sha256": "4dcf7f2de2f49f97f155e14128b20815f538d659d5e82806fa45a18d541adeea"
        },
        {
          "path": "src/lib/bindx-civil-data-client.mjs",
          "sha256": "20da64b82d14fb3d4055b9852ed8712d33b01d1bc9f50709cb55084c7d0433a2"
        },
        {
          "path": "src/lib/brand-assets.mjs",
          "sha256": "7da49f3f4d8c2f9d2cce36cc2902b5f46e044b98e67bace09e240f5b007fd4c1"
        },
        {
          "path": "src/lib/canonical-invited-account.mjs",
          "sha256": "94652997c4e6717e875041c859de9caaaeeabd9d166666d9dfbf899c51d98c7b"
        },
        {
          "path": "src/lib/company-channel-connection.mjs",
          "sha256": "f2c44860383bb49df67f7999fbe3c0a5aa57c91ebbde0cf9a3b5b367784f2c45"
        },
        {
          "path": "src/lib/company-channel-kyc.mjs",
          "sha256": "5b46276ad3aa5d656a0027be4a6bf58aa3fba4f557dd86e0c13d0d5b0cecba85"
        },
        {
          "path": "src/lib/company-channel-routing.mjs",
          "sha256": "9ed740dbb4ae1ca7d44171f176f0001d824b056a0f17a8f58ed1ea5a5a2e2f68"
        },
        {
          "path": "src/lib/company-channel-schema.mjs",
          "sha256": "96c0385fa3b6d60c8d1f92ca38dcdf32e7779f1200512806bf6d220e6be57022"
        },
        {
          "path": "src/lib/company-entitlement.mjs",
          "sha256": "65d41dfb796ef12be38b1220a99ccd3dfe277419a5e5a27e125beb29fe7e2cde"
        },
        {
          "path": "src/lib/company-onboarding-policy.mjs",
          "sha256": "cf557c7837d6264c78207028c668f8f8a2218f9632a8092cfcb8692ef11053d1"
        },
        {
          "path": "src/lib/company-phone-format.mjs",
          "sha256": "67b31114f517253961c6a774210f157867b1e2e318e6b700089eef03ef1b7209"
        },
        {
          "path": "src/lib/employee-intake-channel-continuity.mjs",
          "sha256": "59dffe3800f26cd979bd12c4cff0010ca72779e1dc62030a6f0117b6ef3fb64d"
        },
        {
          "path": "src/lib/field-hours-report.mjs",
          "sha256": "b55b767d61278bde31cb9ce4ef64faee5320fc7fe1b1bcc54559860bb4576731"
        },
        {
          "path": "src/lib/field-media-privacy.mjs",
          "sha256": "5ec7fc7dd71f9303a42bfb4889e02541de8a3cf356e8e1203cfeeefd56220515"
        },
        {
          "path": "src/lib/field-media.mjs",
          "sha256": "940e681d1430fc211093b16f5407637fcd31d270a3d99234f748fe7db73cc0bb"
        },
        {
          "path": "src/lib/field-operations-policy.mjs",
          "sha256": "01eb863d7db4446eeb8dab990d7e0602a19d581d5615a0b1e5d50c02f3d70173"
        },
        {
          "path": "src/lib/field-operations-store.mjs",
          "sha256": "dbf96641349efae61808a2d66a02d491ad06e2226885e6efa928dba53ce5034e"
        },
        {
          "path": "src/lib/field-overtime-policy.mjs",
          "sha256": "76848bd0861d6cecccb682b774599f03d3fe1322eed3cc58f5f1db5d9b1e24f8"
        },
        {
          "path": "src/lib/field-overtime-store.mjs",
          "sha256": "f29b67fff29949d5a8b14c4aed3f484ae1ce16d2ed42de486a6d5868361b1526"
        },
        {
          "path": "src/lib/field-report-feedback.mjs",
          "sha256": "70b966ae5f382abe6b5446daf1092c3f66b8f46f80ce5a0c006cffeba1cfa64c"
        },
        {
          "path": "src/lib/field-shift-summary.mjs",
          "sha256": "41f47aa7a0826ba1fe29b554c7575ec60c9861f0c18c863f06e8c3d00cb0f83c"
        },
        {
          "path": "src/lib/geo.js",
          "sha256": "fa47424540f953adf56e0c3069780c0c8876a2f69e944a80caddefa974b5b6bf"
        },
        {
          "path": "src/lib/legacy-access-boundary.js",
          "sha256": "e1af7e83dac3c18bcf3b235d111d936d6dd6167925a3e1459d70a33913035370"
        },
        {
          "path": "src/lib/material-inventory.mjs",
          "sha256": "4b599d273c4cadcdf76202554757583152da8c11b0a754be386bffb830f0c65b"
        },
        {
          "path": "src/lib/meta-callback-diagnostics.mjs",
          "sha256": "b16fcfbeabe02b119d0337485504490a0c8e60363e841e378ae4c7722816d3bc"
        },
        {
          "path": "src/lib/meta-channel-binding.mjs",
          "sha256": "0ba9e9de3b6dcca46524ab2df22236dbbcd5be5e6cef571df1ec47a01633672e"
        },
        {
          "path": "src/lib/meta-cloud-protocol.mjs",
          "sha256": "c6d5f1e1b4119dd2529860e3bd61a1b22d602f71ad301b2f04cec3ab4bbbed3c"
        },
        {
          "path": "src/lib/meta-customer-app-projection.mjs",
          "sha256": "7b4b95712f143555a0e23b8ac98fc0e1d2f108e9fbefb4e861d20d9b464ef003"
        },
        {
          "path": "src/lib/meta-customer-callback.mjs",
          "sha256": "da90e3ed097c287a7c080d05daf5e4b0c0bb82544d2f7dab4cb1ee99880c3fd0"
        },
        {
          "path": "src/lib/meta-customer-coexistence.mjs",
          "sha256": "30f5b950284b953fa853b37514cd768660cfc505a6e979ec51c947b6edce40da"
        },
        {
          "path": "src/lib/meta-customer-credentials.mjs",
          "sha256": "44a05a0b46417de835eb289882b0b2c6d71158f207c16c48228f1ac4b67cca0f"
        },
        {
          "path": "src/lib/meta-customer-inbox-review.mjs",
          "sha256": "250bd69c487dc8dffed5500c1ca0f9adb77843352902c41e4a63da7656bf2eaa"
        },
        {
          "path": "src/lib/meta-customer-outbound.mjs",
          "sha256": "84a249b3777d3be843b20b09d0c6cd81b6fab7415dc22f124477d87475eead09"
        },
        {
          "path": "src/lib/meta-customer-permissions.mjs",
          "sha256": "ce3671bd46af8e487c45319facbca8e6b522620fd16ee3163e5048b5ecb6585d"
        },
        {
          "path": "src/lib/meta-customer-processing.mjs",
          "sha256": "e4a52dbd2ce86793b66c4af5963c288b13d7b2b2f656c4c6f795bcac8074f4ad"
        },
        {
          "path": "src/lib/meta-customer-provider.mjs",
          "sha256": "b6cc572fb68ab4cb653ccee30cea754a6273b5631d13e61dd2c2f65535aa287f"
        },
        {
          "path": "src/lib/meta-customer-templates.mjs",
          "sha256": "ca9e491b8b1b4c25c89585408cb53eae13e2423fdf48a93deed0846126e1c46c"
        },
        {
          "path": "src/lib/meta-development-pilot-policy.mjs",
          "sha256": "6f3a854898ea28d108341f35fe7f5f23facf3d574e586b96a2343a8038cc8c79"
        },
        {
          "path": "src/lib/meta-employee-intake.mjs",
          "sha256": "77dc9f64814f995d21084606d705f26af65de4f4f9bea25a0f37a0d8dba1b928"
        },
        {
          "path": "src/lib/meta-field-bridge.mjs",
          "sha256": "79c961cf91f988e5d913cfb241a887c26a78d49e04ebf2c5fbb2bf6a74bc809b"
        },
        {
          "path": "src/lib/meta-field-conversation.mjs",
          "sha256": "2da5b4a58e4f62a912d4df4bd93574c9907c6561123fe5ffabdd12420b72047f"
        },
        {
          "path": "src/lib/meta-kyc-challenge.mjs",
          "sha256": "f5a03ec770e6d85de095393bf38c331c0803a7fe3c7f1b72a2addd9cac7484eb"
        },
        {
          "path": "src/lib/meta-kyc-conversation.mjs",
          "sha256": "75870a6359385ae83df0d154b57c3f6738f2bde62fbe4974da7e38e5b0de2902"
        },
        {
          "path": "src/lib/meta-kyc-current-image.mjs",
          "sha256": "03ef3966025f520b373e937a6230f846185f3b4845830da5a38c0d8f02e155c2"
        },
        {
          "path": "src/lib/meta-kyc-identity.mjs",
          "sha256": "295f87ecb3b4586313a4f9c48a2d5c9acf8fa263682d99d44a966be243af2319"
        },
        {
          "path": "src/lib/meta-kyc-rejection-policy.mjs",
          "sha256": "e6c96aba8077d75e152f45dc49fe32d41e103658d4bff4281c8c8a98e3fff0c1"
        },
        {
          "path": "src/lib/meta-kyc-rejection.mjs",
          "sha256": "5477adafd994a54c9e7bbcc196b6af4fbe0b9cc03ab563775b8258290e31f3d0"
        },
        {
          "path": "src/lib/meta-own-company-policy.mjs",
          "sha256": "7db3875cd0f31fec077f4d9a4f8875be1ddf4a5772acff4559069ae950ff0821"
        },
        {
          "path": "src/lib/meta-plan-import-conversation.mjs",
          "sha256": "6f3c261cb2cde943e0202ab5097d664958f5702975cdf5914aeac35e5a1bac1c"
        },
        {
          "path": "src/lib/meta-plan-import-origin.mjs",
          "sha256": "cdb619d1709a982323c9892383def1428db2ade771babdb18e4032b3535d953e"
        },
        {
          "path": "src/lib/meta-plan-import-transport.mjs",
          "sha256": "e42f48f0175dd697bac3de61d7d9893d35c2b1696c1ae276a4698eb3c36a4634"
        },
        {
          "path": "src/lib/meta-test-recipient-binding.mjs",
          "sha256": "2aea6f5815bd2d90fe891b45a79b48d339a3eebc681ac40b3347244e546c4b66"
        },
        {
          "path": "src/lib/meta-whatsapp-transport.mjs",
          "sha256": "f99569c7f587e9be1268aa254d2368226346a7ebf7e48fa6ca63a0064cf41310"
        },
        {
          "path": "src/lib/organization-resource-usage-policy.mjs",
          "sha256": "089ac1ee2ca6afd30aab1d0abd38274698ca56991d1c5225ea8e44c8b9fdc449"
        },
        {
          "path": "src/lib/organization-usage-policy.mjs",
          "sha256": "94997530d6c1fd420f0233172b07f8ba7dd7546a2ac9af75eaa30736400237ae"
        },
        {
          "path": "src/lib/participant-account-discovery.mjs",
          "sha256": "11b37ca397fdb195aac7addc1c16842fb28a9c83a73a82a57bf2791ed3038738"
        },
        {
          "path": "src/lib/participant-admission.mjs",
          "sha256": "2cbb466e49d742cd23da1bb85a4e89b7e411dc724c8d1f2eb66b39717f283dd9"
        },
        {
          "path": "src/lib/participant-analysis-consent.mjs",
          "sha256": "7f7d371914d1e46ac799cd1683afdc0418186c15a20156e697ecd879c81bf8c1"
        },
        {
          "path": "src/lib/participant-approved-identity.mjs",
          "sha256": "834d81e70cedbd967ff84d880ea9d697c2168d2220fb23d9eb14c1aba1cdbbf1"
        },
        {
          "path": "src/lib/participant-bank-account.mjs",
          "sha256": "29980527a6eda3bbc0125098a4b616082034a71fb1afb772ff87f476bc0ce981"
        },
        {
          "path": "src/lib/participant-bank-format.mjs",
          "sha256": "ebbb206a14eaac57230b53ec1afae99c4be60c8739baf0d1d047d4a47ba464db"
        },
        {
          "path": "src/lib/participant-bank-vault.mjs",
          "sha256": "06e990ab79c896628756f3c74a50dcc7e8062f4fa296f56a31e4150b5badc16a"
        },
        {
          "path": "src/lib/participant-channel-kyc.mjs",
          "sha256": "2ac9414429238162a9b16d4adea421df0bff9fb93ea4fbf2f9d6677f2659fb2d"
        },
        {
          "path": "src/lib/participant-civil-policy.mjs",
          "sha256": "e180a64c788d6cd20e766cb4fd32dbba1c7cb3954c01405ac8675ec023eef278"
        },
        {
          "path": "src/lib/participant-civil-store.mjs",
          "sha256": "5f440c0c76ca67b87a7e5d4e90e7a48f18ea3603b16434b35beeddd3bdf168a4"
        },
        {
          "path": "src/lib/participant-kyc-chat-attempt.mjs",
          "sha256": "d3f0a65f866fa027ee008963fcb6ffcad0cd33de94cace7603cf40bc78c21aeb"
        },
        {
          "path": "src/lib/participant-kyc-chat-closure.mjs",
          "sha256": "4a6a368910de95582c2baabc70bab7f4b4afa4413e8ebdb75a1e8b867c098a19"
        },
        {
          "path": "src/lib/participant-kyc-chat-copy.mjs",
          "sha256": "d886219584d5e8b9d9db1ad16a36c726f6982fa0e8400c3be51af2623574ab96"
        },
        {
          "path": "src/lib/participant-kyc-image-set.mjs",
          "sha256": "190ce2560286a58d42668da7b912aeabcfa76ee14086503bf1609304e5f0e8fb"
        },
        {
          "path": "src/lib/participant-kyc-notice-links.mjs",
          "sha256": "1a10acf655796ebf4f08175158ea3dc2a1d0a0fdb3d13bb88573d6a0e5f4375e"
        },
        {
          "path": "src/lib/participant-kyc-preanalysis-policy.mjs",
          "sha256": "8c5286a0a5d41364e92e60f2ce2ba96caccc8667960f966b5caead37acafab49"
        },
        {
          "path": "src/lib/participant-onboarding-authority.mjs",
          "sha256": "dad5d9fd0a61c493ff02331d5333982627cdeb3a7addb74a3c86d44da931f916"
        },
        {
          "path": "src/lib/participant-onboarding-current-kyc.mjs",
          "sha256": "232fecca4f6cf775e5151ec460560e0c1abd6646dc3c532140cabe26dfb42119"
        },
        {
          "path": "src/lib/participant-onboarding-delivery.mjs",
          "sha256": "615592cc1a6215e24c48e8873a27211421853f99ca9093e6f490f77532b3d013"
        },
        {
          "path": "src/lib/participant-onboarding-intent.mjs",
          "sha256": "07114f6066e10617357c4e5d8e2db2b9dc846e5f4cffbc5aef09f2b7bfada9de"
        },
        {
          "path": "src/lib/participant-onboarding-policy.mjs",
          "sha256": "59409797ce3e13b7cfe63fe21d8d7e2c848ee49e0766015939242a9f43687c03"
        },
        {
          "path": "src/lib/participant-onboarding-reactive.mjs",
          "sha256": "666a8c27f3ab7d6fdbe66c91f22ace4e25b04b98e865f401d19c72212916104d"
        },
        {
          "path": "src/lib/participant-policy.mjs",
          "sha256": "7f3969ab1ebac5f01696149d76337199eb64c2fd09015c44c07e8b7e7088d62f"
        },
        {
          "path": "src/lib/participant-store.mjs",
          "sha256": "2296495e366b9ea0c2511066584e93ddf1cff51b5eefd05c6121d2143d78f5c9"
        },
        {
          "path": "src/lib/participant-verified-office.mjs",
          "sha256": "4922f392490aa6d49b8a8a45a56ac0b03831a8ad2efe89ce1e3adfd77d603d89"
        },
        {
          "path": "src/lib/person-worksite-journey.mjs",
          "sha256": "d3174df793150125c0b6a5d9f37d56336e72cab1efb43a361065b78ac54c210a"
        },
        {
          "path": "src/lib/pilot-media.mjs",
          "sha256": "55e35757cea03c312df68cebad100ee8b7d904b418eca9082359ea34e68f8fa9"
        },
        {
          "path": "src/lib/plan-baseline-policy.mjs",
          "sha256": "e9217a41a87057f437439420d56f3b7a0f973ae37c250c07b335634fef308560"
        },
        {
          "path": "src/lib/plan-import-analyzer.mjs",
          "sha256": "0427c7fbdf0ba27b07c328661e52731c996e0a7b5f0749dcc6207410b28c52bb"
        },
        {
          "path": "src/lib/plan-import-cyp-curve.mjs",
          "sha256": "7e1d6c9d87df5e74e0a340361e1e66fdf0cfd5c82f1e44030ba2e85b5fa9c342"
        },
        {
          "path": "src/lib/plan-import-document-curve.mjs",
          "sha256": "7f63d62b9f1ae6d139c627a978ef56d7eafea0e0f4271167daa4c00bf7fda013"
        },
        {
          "path": "src/lib/plan-import-monthly-curve.mjs",
          "sha256": "6ce785f9c24c47f0e291b0bac40bd96a691fae68a309e4cb7a1917db31f9e6b6"
        },
        {
          "path": "src/lib/plan-import-ooxml.mjs",
          "sha256": "a146b9b300086bd8f44af6549d75611f7ac542a6c6c2f9eddf099cd8fc0f9251"
        },
        {
          "path": "src/lib/plan-import-policy.mjs",
          "sha256": "f2d73b8c58df571fb0dc6e5d76e2fb5d60daffa6ed6a41bc2be3c7e536458696"
        },
        {
          "path": "src/lib/plan-import-store.mjs",
          "sha256": "455c06e64301b2679e1278cc288cd4b06c875a222339e15c6720c58bc1f011c2"
        },
        {
          "path": "src/lib/plan-measurement-configuration.mjs",
          "sha256": "d016926aec29c0f3bf60f8b012e5c52e2bd1c7e2188d4534b7579f7aee28b08d"
        },
        {
          "path": "src/lib/plan-measurement-policy.mjs",
          "sha256": "3d6b0bce58a7f89612878310f534d8cf02f6a222c778cd4294b415c1f61157b7"
        },
        {
          "path": "src/lib/plan-measurement-source.mjs",
          "sha256": "ecf33b67a333d8ce73bfb51610218a1658cd94a26b62eb35d2290b795f826f36"
        },
        {
          "path": "src/lib/plan-measurement-store.mjs",
          "sha256": "f1267df1fcd5ddc7d5ce6bfbf6693cda124135350025579075ed2ba8460334f2"
        },
        {
          "path": "src/lib/private-image-upload.mjs",
          "sha256": "1eaeda2fa79104cfe00a8736c466d8568d216c8682bd44031d3bf9d4f35e3f60"
        },
        {
          "path": "src/lib/procurement-quantity.js",
          "sha256": "53439844051cc1dbd679220d695e60e54bc1629b2f1ddb33fc125981da9326b3"
        },
        {
          "path": "src/lib/progress-measurement-quantity.js",
          "sha256": "e194f461d482dec666c090a19aabbd3498bc08964cbbbc31b8db6eeb39cb1be2"
        },
        {
          "path": "src/lib/site-register-policy.mjs",
          "sha256": "d529c4f2225e0ec851ef7df60f8c5b182a88b384958ebfd15b194683d1590434"
        },
        {
          "path": "src/lib/site-register-store.mjs",
          "sha256": "6b744c86f47dbb6dc081132675888615d76421701f96151b00646b5e1d2529c6"
        },
        {
          "path": "src/lib/task-progress-measurement.js",
          "sha256": "10361a0e30df34f9c90f915d9fdbfc0912a610ab3ce851503c32549b7049a8b9"
        },
        {
          "path": "src/lib/video-audio-extractor.mjs",
          "sha256": "0c85dfd39c10fdb782eca4fe57dc665c29bd7211ab7aba0dda3f8945abcb1988"
        },
        {
          "path": "src/lib/video-frame-extractor.mjs",
          "sha256": "33425a184cf097884982c43a90e3b515726027adbeb51c2cdbfc794e79dee6e6"
        },
        {
          "path": "src/lib/voice-progress-draft.mjs",
          "sha256": "56ddbad919a1ad77e13105f1a125914674c1a149a88e28fa2f8b831a4d14bd69"
        },
        {
          "path": "src/lib/whatsapp/field-worker-intent-policy.js",
          "sha256": "0fdf205af1c2185a16f99c4f1aaba6c36d95722ea914915a0eefe6a10d443ef9"
        },
        {
          "path": "src/lib/whatsapp/obra-intent-policy.js",
          "sha256": "cd01054ba81be6552f58dc91758e08166ea099482f28355cae570d15f3ccf8da"
        },
        {
          "path": "src/lib/whatsapp/operational-proposal-decision-policy.js",
          "sha256": "996ed641c090267679ce0fc3cb7a23f39b31ce88e761135feb0dd0c852eb74fc"
        },
        {
          "path": "src/lib/whatsapp/project-workspace-profile.js",
          "sha256": "e13473baa4ca5b4dc9851bb202f400ba174ccbfce2589be65ce8458aafa998f4"
        },
        {
          "path": "src/lib/whatsapp/template-review-policy.js",
          "sha256": "0ec4a7e544f8c2c2409d2c84ecf69fab663334dd5a5cef0ee1b1cbec82de0a08"
        },
        {
          "path": "src/lib/whatsapp/tenant-workspace-policy.js",
          "sha256": "d3416ff993fbfd70f75404166cdcd8f0b9b2e5a6741f6cde03725aab16abcd5e"
        },
        {
          "path": "src/lib/worker-channel-consent-policy.mjs",
          "sha256": "95c8393e7f2603694c5c15cfe34c9eead43007927aed0d5b633859b14c7448a9"
        },
        {
          "path": "src/lib/worker-channel-identity.mjs",
          "sha256": "1cddd58a2cd656abaca25752481fe1ca760d2bcd385a0fffbe0e685c15d59e0a"
        },
        {
          "path": "src/lib/workspace-policy.mjs",
          "sha256": "ba51cc5c4a6e4f5ce1c9382cae2c8ea903ab4373668c05384c7f1e9253c7041e"
        },
        {
          "path": "src/lib/workspace-store.mjs",
          "sha256": "5f25092121a31a06eefa59d69866db82fa3cd28afdcbd0e066e52d916478bc50"
        },
        {
          "path": "tests/fixtures/plan-import-ooxml-synthetic.mjs",
          "sha256": "4157135abf5798807025a18abd121c7fdbc7be2a5e0099084bbb02ea28f20931"
        },
        {
          "path": "tests/fixtures/plan-measurement-source-synthetic.mjs",
          "sha256": "9e62b4d9caef2f739e3624e13f7c0cb14c6f1d9a7e2266801a45bf7fb367410c"
        }
      ]
    },
    {
      "family": "MEASUREMENT_UI",
      "previousExternalImports": [
        "react"
      ],
      "currentFiles": [
        "src/app/(identity)/cuenta/company-channel-view.mjs",
        "src/app/(identity)/cuenta/own-company-number-view.mjs",
        "src/app/(identity)/cuenta/own-company-templates-view.mjs",
        "src/app/(identity)/cuenta/participant-office-account-view.mjs",
        "src/app/(identity)/cuenta/plan-baseline-view.mjs",
        "src/app/(identity)/cuenta/plan-measurement-panel.js",
        "src/app/(identity)/cuenta/plan-measurement-panel.module.css",
        "src/app/(identity)/cuenta/plan-measurement-view.mjs",
        "src/app/(identity)/cuenta/plan-source-curve.mjs",
        "src/app/(identity)/cuenta/private-bank-account-format.mjs",
        "src/app/(identity)/cuenta/site-purchase-view.mjs",
        "src/app/(identity)/cuenta/workspace-recovery-journal.mjs",
        "src/app/(identity)/cuenta/workspace-recovery-storage.mjs",
        "src/app/(identity)/cuenta/workspace-request-lifecycle.js",
        "src/app/(identity)/cuenta/workspace-request-lifecycle.mjs",
        "src/app/(identity)/cuenta/workspace-session-request.mjs",
        "src/lib/plan-import-cyp-curve.mjs",
        "src/lib/plan-import-document-curve.mjs",
        "src/lib/progress-measurement-quantity.js"
      ],
      "externalImports": [
        "react"
      ],
      "currentManifest": [
        {
          "path": "src/app/(identity)/cuenta/company-channel-view.mjs",
          "sha256": "c79c473999e444b84e2a1d58e0d03f030069c24f9749f2c84450318b0b237e4d"
        },
        {
          "path": "src/app/(identity)/cuenta/own-company-number-view.mjs",
          "sha256": "6940f11e30d2958d7f6771463ce28ca83c0e2d2f41e81aa220c8efe669580300"
        },
        {
          "path": "src/app/(identity)/cuenta/own-company-templates-view.mjs",
          "sha256": "3bf758b150336613a437e2b01d3b6a79645a024b771f1515f4ec2ae58a1b8bc3"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-office-account-view.mjs",
          "sha256": "f2716f72297a1277946bafa03a82d4c1fb7f2fcff7f4c4bbe155a86ed7e4e379"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-baseline-view.mjs",
          "sha256": "0c696eba748a7441440e23be5085dc42d4954427def5adc1e2de686b4b11711d"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-measurement-panel.js",
          "sha256": "d9d1cd683a8aaf0ad1ea5656c03c12c00935c3653f54d9326196617b60039832"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-measurement-panel.module.css",
          "sha256": "8290affa492be1699acb568c2ee4c8c5c672b3f2b06e2917f541c72bdacbde3a"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-measurement-view.mjs",
          "sha256": "02a80449af709fdda97dfaf48b0335bd96ab7dc363804f59a5d9ea8579581d30"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-source-curve.mjs",
          "sha256": "689402d373744d159a62e2e5975ddfdf79053c528a838879dd5df3e43a0efdc9"
        },
        {
          "path": "src/app/(identity)/cuenta/private-bank-account-format.mjs",
          "sha256": "4dcf7f2de2f49f97f155e14128b20815f538d659d5e82806fa45a18d541adeea"
        },
        {
          "path": "src/app/(identity)/cuenta/site-purchase-view.mjs",
          "sha256": "58ebd978e8e39423901cb811ecf2ab851160b78f7cd5cb441075d66d7819dee9"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-recovery-journal.mjs",
          "sha256": "060e128b54eefdadfbabac45c3ec696934f5e74d79b9e26e905081128e8e99c5"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-recovery-storage.mjs",
          "sha256": "d8cf1e7e8d88d66f722aaf52deb45f95829c226468d3f37a2b23d171cc1ecbb8"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-request-lifecycle.js",
          "sha256": "b3004538de2cc7cbc829bf5518c4f4b2a5eb2935d0b4e60f9c88840c8ede3797"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-request-lifecycle.mjs",
          "sha256": "590cd7691d8b6beb82929bdd18dd9909c2d2cfa1c3d4111ff4d478d57daf532f"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-session-request.mjs",
          "sha256": "29d294ac1d973317d6a3df225a64a8a9115c6ea51c587f297114e7992af97520"
        },
        {
          "path": "src/lib/plan-import-cyp-curve.mjs",
          "sha256": "7e1d6c9d87df5e74e0a340361e1e66fdf0cfd5c82f1e44030ba2e85b5fa9c342"
        },
        {
          "path": "src/lib/plan-import-document-curve.mjs",
          "sha256": "7f63d62b9f1ae6d139c627a978ef56d7eafea0e0f4271167daa4c00bf7fda013"
        },
        {
          "path": "src/lib/progress-measurement-quantity.js",
          "sha256": "e194f461d482dec666c090a19aabbd3498bc08964cbbbc31b8db6eeb39cb1be2"
        }
      ]
    },
    {
      "family": "MEASUREMENT_UI_RUNTIME",
      "previousExternalImports": [
        "@babel/parser",
        "node:assert/strict",
        "node:child_process",
        "node:crypto",
        "node:fs",
        "node:net",
        "node:path",
        "node:timers/promises",
        "node:url",
        "node:zlib",
        "puppeteer",
        "saxes",
        "yauzl"
      ],
      "currentFiles": [
        "scripts/lib/owned-fixture-cleanup.mjs",
        "scripts/verify-plan-measurement-ui.mjs",
        "src/lib/plan-import-cyp-curve.mjs",
        "src/lib/plan-import-document-curve.mjs",
        "src/lib/plan-import-monthly-curve.mjs",
        "src/lib/plan-import-ooxml.mjs",
        "src/lib/plan-import-policy.mjs",
        "src/lib/plan-measurement-configuration.mjs",
        "src/lib/plan-measurement-http.mjs",
        "src/lib/plan-measurement-policy.mjs",
        "src/lib/plan-measurement-source.mjs",
        "src/lib/plan-measurement-store.mjs",
        "src/lib/private-image-upload.mjs",
        "src/lib/progress-measurement-quantity.js",
        "src/lib/task-progress-measurement.js",
        "src/lib/workspace-policy.mjs",
        "tests/fixtures/plan-measurement-document-association-synthetic.mjs"
      ],
      "externalImports": [
        "@babel/parser",
        "node:assert/strict",
        "node:child_process",
        "node:crypto",
        "node:fs",
        "node:net",
        "node:path",
        "node:timers/promises",
        "node:url",
        "node:zlib",
        "puppeteer",
        "saxes",
        "yauzl"
      ],
      "currentManifest": [
        {
          "path": "scripts/lib/owned-fixture-cleanup.mjs",
          "sha256": "44a9df241dd8426fe8d148b1b33110fe1e103960814e81f1f9a41638d8613844"
        },
        {
          "path": "scripts/verify-plan-measurement-ui.mjs",
          "sha256": "12dcd1879cde33a9d6b8d696d9de8907ce29ad29c8eb808f727be8206bc19f5c"
        },
        {
          "path": "src/lib/plan-import-cyp-curve.mjs",
          "sha256": "7e1d6c9d87df5e74e0a340361e1e66fdf0cfd5c82f1e44030ba2e85b5fa9c342"
        },
        {
          "path": "src/lib/plan-import-document-curve.mjs",
          "sha256": "7f63d62b9f1ae6d139c627a978ef56d7eafea0e0f4271167daa4c00bf7fda013"
        },
        {
          "path": "src/lib/plan-import-monthly-curve.mjs",
          "sha256": "6ce785f9c24c47f0e291b0bac40bd96a691fae68a309e4cb7a1917db31f9e6b6"
        },
        {
          "path": "src/lib/plan-import-ooxml.mjs",
          "sha256": "a146b9b300086bd8f44af6549d75611f7ac542a6c6c2f9eddf099cd8fc0f9251"
        },
        {
          "path": "src/lib/plan-import-policy.mjs",
          "sha256": "f2d73b8c58df571fb0dc6e5d76e2fb5d60daffa6ed6a41bc2be3c7e536458696"
        },
        {
          "path": "src/lib/plan-measurement-configuration.mjs",
          "sha256": "d016926aec29c0f3bf60f8b012e5c52e2bd1c7e2188d4534b7579f7aee28b08d"
        },
        {
          "path": "src/lib/plan-measurement-http.mjs",
          "sha256": "e53a2b218b9ea68c396fe6889f6981b01d9a879ec74d9cf8bafc0bf1920c8e76"
        },
        {
          "path": "src/lib/plan-measurement-policy.mjs",
          "sha256": "3d6b0bce58a7f89612878310f534d8cf02f6a222c778cd4294b415c1f61157b7"
        },
        {
          "path": "src/lib/plan-measurement-source.mjs",
          "sha256": "ecf33b67a333d8ce73bfb51610218a1658cd94a26b62eb35d2290b795f826f36"
        },
        {
          "path": "src/lib/plan-measurement-store.mjs",
          "sha256": "f1267df1fcd5ddc7d5ce6bfbf6693cda124135350025579075ed2ba8460334f2"
        },
        {
          "path": "src/lib/private-image-upload.mjs",
          "sha256": "1eaeda2fa79104cfe00a8736c466d8568d216c8682bd44031d3bf9d4f35e3f60"
        },
        {
          "path": "src/lib/progress-measurement-quantity.js",
          "sha256": "e194f461d482dec666c090a19aabbd3498bc08964cbbbc31b8db6eeb39cb1be2"
        },
        {
          "path": "src/lib/task-progress-measurement.js",
          "sha256": "10361a0e30df34f9c90f915d9fdbfc0912a610ab3ce851503c32549b7049a8b9"
        },
        {
          "path": "src/lib/workspace-policy.mjs",
          "sha256": "ba51cc5c4a6e4f5ce1c9382cae2c8ea903ab4373668c05384c7f1e9253c7041e"
        },
        {
          "path": "tests/fixtures/plan-measurement-document-association-synthetic.mjs",
          "sha256": "99608056326f95f963b99c8b2337227f5564411a35e03dcaa43d638bb085adfa"
        }
      ]
    },
    {
      "family": "CONSUMPTION_FEEDBACK",
      "previousExternalImports": [
        "ffmpeg-static",
        "node:assert/strict",
        "node:child_process",
        "node:crypto",
        "node:fs",
        "node:fs/promises",
        "node:os",
        "node:path",
        "node:perf_hooks",
        "node:url",
        "node:zlib",
        "pg",
        "saxes",
        "yauzl"
      ],
      "currentFiles": [
        "package-lock.json",
        "package.json",
        "scripts/fixtures/canonical-participant-kyc.mjs",
        "scripts/lib/company-channel-disposable-fixture.mjs",
        "scripts/lib/disposable-postgres-cleanup.mjs",
        "scripts/verify-material-consumption-feedback-postgres.mjs",
        "src/app/(identity)/cuenta/private-bank-account-format.mjs",
        "src/lib/bindx-civil-data-client.mjs",
        "src/lib/brand-assets.mjs",
        "src/lib/canonical-invited-account.mjs",
        "src/lib/company-channel-connection.mjs",
        "src/lib/company-channel-kyc.mjs",
        "src/lib/company-channel-routing.mjs",
        "src/lib/company-channel-schema.mjs",
        "src/lib/company-entitlement.mjs",
        "src/lib/company-onboarding-policy.mjs",
        "src/lib/company-phone-format.mjs",
        "src/lib/employee-intake-channel-continuity.mjs",
        "src/lib/field-hours-report.mjs",
        "src/lib/field-media-privacy.mjs",
        "src/lib/field-media.mjs",
        "src/lib/field-operations-policy.mjs",
        "src/lib/field-operations-store.mjs",
        "src/lib/field-overtime-policy.mjs",
        "src/lib/field-overtime-store.mjs",
        "src/lib/field-report-feedback.mjs",
        "src/lib/field-shift-summary.mjs",
        "src/lib/geo.js",
        "src/lib/legacy-access-boundary.js",
        "src/lib/material-inventory.mjs",
        "src/lib/meta-callback-diagnostics.mjs",
        "src/lib/meta-channel-binding.mjs",
        "src/lib/meta-cloud-protocol.mjs",
        "src/lib/meta-customer-app-projection.mjs",
        "src/lib/meta-customer-callback.mjs",
        "src/lib/meta-customer-coexistence.mjs",
        "src/lib/meta-customer-credentials.mjs",
        "src/lib/meta-customer-inbox-review.mjs",
        "src/lib/meta-customer-outbound.mjs",
        "src/lib/meta-customer-permissions.mjs",
        "src/lib/meta-customer-processing.mjs",
        "src/lib/meta-customer-provider.mjs",
        "src/lib/meta-customer-templates.mjs",
        "src/lib/meta-development-pilot-policy.mjs",
        "src/lib/meta-employee-intake.mjs",
        "src/lib/meta-field-bridge.mjs",
        "src/lib/meta-field-conversation.mjs",
        "src/lib/meta-kyc-challenge.mjs",
        "src/lib/meta-kyc-conversation.mjs",
        "src/lib/meta-kyc-current-image.mjs",
        "src/lib/meta-kyc-identity.mjs",
        "src/lib/meta-kyc-rejection-policy.mjs",
        "src/lib/meta-kyc-rejection.mjs",
        "src/lib/meta-own-company-policy.mjs",
        "src/lib/meta-plan-import-conversation.mjs",
        "src/lib/meta-plan-import-origin.mjs",
        "src/lib/meta-plan-import-transport.mjs",
        "src/lib/meta-test-recipient-binding.mjs",
        "src/lib/meta-whatsapp-transport.mjs",
        "src/lib/organization-resource-usage-policy.mjs",
        "src/lib/organization-usage-policy.mjs",
        "src/lib/participant-account-discovery.mjs",
        "src/lib/participant-admission.mjs",
        "src/lib/participant-analysis-consent.mjs",
        "src/lib/participant-approved-identity.mjs",
        "src/lib/participant-bank-account.mjs",
        "src/lib/participant-bank-format.mjs",
        "src/lib/participant-bank-vault.mjs",
        "src/lib/participant-channel-kyc.mjs",
        "src/lib/participant-civil-policy.mjs",
        "src/lib/participant-civil-store.mjs",
        "src/lib/participant-kyc-chat-attempt.mjs",
        "src/lib/participant-kyc-chat-closure.mjs",
        "src/lib/participant-kyc-chat-copy.mjs",
        "src/lib/participant-kyc-image-set.mjs",
        "src/lib/participant-kyc-notice-links.mjs",
        "src/lib/participant-kyc-preanalysis-policy.mjs",
        "src/lib/participant-onboarding-authority.mjs",
        "src/lib/participant-onboarding-current-kyc.mjs",
        "src/lib/participant-onboarding-delivery.mjs",
        "src/lib/participant-onboarding-intent.mjs",
        "src/lib/participant-onboarding-policy.mjs",
        "src/lib/participant-onboarding-reactive.mjs",
        "src/lib/participant-policy.mjs",
        "src/lib/participant-store.mjs",
        "src/lib/participant-verified-office.mjs",
        "src/lib/person-worksite-journey.mjs",
        "src/lib/pilot-media.mjs",
        "src/lib/plan-baseline-policy.mjs",
        "src/lib/plan-import-cyp-curve.mjs",
        "src/lib/plan-import-document-curve.mjs",
        "src/lib/plan-import-monthly-curve.mjs",
        "src/lib/plan-import-ooxml.mjs",
        "src/lib/plan-import-policy.mjs",
        "src/lib/plan-import-store.mjs",
        "src/lib/plan-measurement-policy.mjs",
        "src/lib/plan-measurement-source.mjs",
        "src/lib/private-image-upload.mjs",
        "src/lib/procurement-quantity.js",
        "src/lib/progress-measurement-quantity.js",
        "src/lib/site-register-policy.mjs",
        "src/lib/site-register-store.mjs",
        "src/lib/task-progress-measurement.js",
        "src/lib/video-audio-extractor.mjs",
        "src/lib/video-frame-extractor.mjs",
        "src/lib/voice-progress-draft.mjs",
        "src/lib/whatsapp/field-worker-intent-policy.js",
        "src/lib/whatsapp/obra-intent-policy.js",
        "src/lib/whatsapp/operational-proposal-decision-policy.js",
        "src/lib/whatsapp/project-workspace-profile.js",
        "src/lib/whatsapp/template-review-policy.js",
        "src/lib/whatsapp/tenant-workspace-policy.js",
        "src/lib/worker-channel-consent-policy.mjs",
        "src/lib/worker-channel-identity.mjs",
        "src/lib/workspace-policy.mjs",
        "src/lib/workspace-store.mjs"
      ],
      "externalImports": [
        "ffmpeg-static",
        "node:assert/strict",
        "node:child_process",
        "node:crypto",
        "node:fs",
        "node:fs/promises",
        "node:os",
        "node:path",
        "node:perf_hooks",
        "node:url",
        "node:zlib",
        "pg",
        "saxes",
        "yauzl"
      ],
      "currentManifest": [
        {
          "path": "package-lock.json",
          "sha256": "dfa3ff3914547f35828a0b697e6007c6cf856546be86bf8a7810cdce59e60449"
        },
        {
          "path": "package.json",
          "sha256": "6b7918c67edddee946d9455aa71913987f54f8abe441e0c3e560560a89061c4d"
        },
        {
          "path": "scripts/fixtures/canonical-participant-kyc.mjs",
          "sha256": "09928b417f3319d76ba34fac91f89a1888f3a8e613bfde3775cac424cc441ccb"
        },
        {
          "path": "scripts/lib/company-channel-disposable-fixture.mjs",
          "sha256": "717d87a6fb1dd7f6a8b2a2d19cd3b2fee652d536e958bd833bf8431c31076138"
        },
        {
          "path": "scripts/lib/disposable-postgres-cleanup.mjs",
          "sha256": "df8d9f36b79cdd5f2d940c0dc4bbc88acbb0bec6e66c9ee5ae93ad5c6e4ab89e"
        },
        {
          "path": "scripts/verify-material-consumption-feedback-postgres.mjs",
          "sha256": "263f778819bcd8edb078b22002781bf257e0febb670ad06a3006528d6df005b4"
        },
        {
          "path": "src/app/(identity)/cuenta/private-bank-account-format.mjs",
          "sha256": "4dcf7f2de2f49f97f155e14128b20815f538d659d5e82806fa45a18d541adeea"
        },
        {
          "path": "src/lib/bindx-civil-data-client.mjs",
          "sha256": "20da64b82d14fb3d4055b9852ed8712d33b01d1bc9f50709cb55084c7d0433a2"
        },
        {
          "path": "src/lib/brand-assets.mjs",
          "sha256": "7da49f3f4d8c2f9d2cce36cc2902b5f46e044b98e67bace09e240f5b007fd4c1"
        },
        {
          "path": "src/lib/canonical-invited-account.mjs",
          "sha256": "94652997c4e6717e875041c859de9caaaeeabd9d166666d9dfbf899c51d98c7b"
        },
        {
          "path": "src/lib/company-channel-connection.mjs",
          "sha256": "f2c44860383bb49df67f7999fbe3c0a5aa57c91ebbde0cf9a3b5b367784f2c45"
        },
        {
          "path": "src/lib/company-channel-kyc.mjs",
          "sha256": "5b46276ad3aa5d656a0027be4a6bf58aa3fba4f557dd86e0c13d0d5b0cecba85"
        },
        {
          "path": "src/lib/company-channel-routing.mjs",
          "sha256": "9ed740dbb4ae1ca7d44171f176f0001d824b056a0f17a8f58ed1ea5a5a2e2f68"
        },
        {
          "path": "src/lib/company-channel-schema.mjs",
          "sha256": "96c0385fa3b6d60c8d1f92ca38dcdf32e7779f1200512806bf6d220e6be57022"
        },
        {
          "path": "src/lib/company-entitlement.mjs",
          "sha256": "65d41dfb796ef12be38b1220a99ccd3dfe277419a5e5a27e125beb29fe7e2cde"
        },
        {
          "path": "src/lib/company-onboarding-policy.mjs",
          "sha256": "cf557c7837d6264c78207028c668f8f8a2218f9632a8092cfcb8692ef11053d1"
        },
        {
          "path": "src/lib/company-phone-format.mjs",
          "sha256": "67b31114f517253961c6a774210f157867b1e2e318e6b700089eef03ef1b7209"
        },
        {
          "path": "src/lib/employee-intake-channel-continuity.mjs",
          "sha256": "59dffe3800f26cd979bd12c4cff0010ca72779e1dc62030a6f0117b6ef3fb64d"
        },
        {
          "path": "src/lib/field-hours-report.mjs",
          "sha256": "b55b767d61278bde31cb9ce4ef64faee5320fc7fe1b1bcc54559860bb4576731"
        },
        {
          "path": "src/lib/field-media-privacy.mjs",
          "sha256": "5ec7fc7dd71f9303a42bfb4889e02541de8a3cf356e8e1203cfeeefd56220515"
        },
        {
          "path": "src/lib/field-media.mjs",
          "sha256": "940e681d1430fc211093b16f5407637fcd31d270a3d99234f748fe7db73cc0bb"
        },
        {
          "path": "src/lib/field-operations-policy.mjs",
          "sha256": "01eb863d7db4446eeb8dab990d7e0602a19d581d5615a0b1e5d50c02f3d70173"
        },
        {
          "path": "src/lib/field-operations-store.mjs",
          "sha256": "dbf96641349efae61808a2d66a02d491ad06e2226885e6efa928dba53ce5034e"
        },
        {
          "path": "src/lib/field-overtime-policy.mjs",
          "sha256": "76848bd0861d6cecccb682b774599f03d3fe1322eed3cc58f5f1db5d9b1e24f8"
        },
        {
          "path": "src/lib/field-overtime-store.mjs",
          "sha256": "f29b67fff29949d5a8b14c4aed3f484ae1ce16d2ed42de486a6d5868361b1526"
        },
        {
          "path": "src/lib/field-report-feedback.mjs",
          "sha256": "70b966ae5f382abe6b5446daf1092c3f66b8f46f80ce5a0c006cffeba1cfa64c"
        },
        {
          "path": "src/lib/field-shift-summary.mjs",
          "sha256": "41f47aa7a0826ba1fe29b554c7575ec60c9861f0c18c863f06e8c3d00cb0f83c"
        },
        {
          "path": "src/lib/geo.js",
          "sha256": "fa47424540f953adf56e0c3069780c0c8876a2f69e944a80caddefa974b5b6bf"
        },
        {
          "path": "src/lib/legacy-access-boundary.js",
          "sha256": "e1af7e83dac3c18bcf3b235d111d936d6dd6167925a3e1459d70a33913035370"
        },
        {
          "path": "src/lib/material-inventory.mjs",
          "sha256": "4b599d273c4cadcdf76202554757583152da8c11b0a754be386bffb830f0c65b"
        },
        {
          "path": "src/lib/meta-callback-diagnostics.mjs",
          "sha256": "b16fcfbeabe02b119d0337485504490a0c8e60363e841e378ae4c7722816d3bc"
        },
        {
          "path": "src/lib/meta-channel-binding.mjs",
          "sha256": "0ba9e9de3b6dcca46524ab2df22236dbbcd5be5e6cef571df1ec47a01633672e"
        },
        {
          "path": "src/lib/meta-cloud-protocol.mjs",
          "sha256": "c6d5f1e1b4119dd2529860e3bd61a1b22d602f71ad301b2f04cec3ab4bbbed3c"
        },
        {
          "path": "src/lib/meta-customer-app-projection.mjs",
          "sha256": "7b4b95712f143555a0e23b8ac98fc0e1d2f108e9fbefb4e861d20d9b464ef003"
        },
        {
          "path": "src/lib/meta-customer-callback.mjs",
          "sha256": "da90e3ed097c287a7c080d05daf5e4b0c0bb82544d2f7dab4cb1ee99880c3fd0"
        },
        {
          "path": "src/lib/meta-customer-coexistence.mjs",
          "sha256": "30f5b950284b953fa853b37514cd768660cfc505a6e979ec51c947b6edce40da"
        },
        {
          "path": "src/lib/meta-customer-credentials.mjs",
          "sha256": "44a05a0b46417de835eb289882b0b2c6d71158f207c16c48228f1ac4b67cca0f"
        },
        {
          "path": "src/lib/meta-customer-inbox-review.mjs",
          "sha256": "250bd69c487dc8dffed5500c1ca0f9adb77843352902c41e4a63da7656bf2eaa"
        },
        {
          "path": "src/lib/meta-customer-outbound.mjs",
          "sha256": "84a249b3777d3be843b20b09d0c6cd81b6fab7415dc22f124477d87475eead09"
        },
        {
          "path": "src/lib/meta-customer-permissions.mjs",
          "sha256": "ce3671bd46af8e487c45319facbca8e6b522620fd16ee3163e5048b5ecb6585d"
        },
        {
          "path": "src/lib/meta-customer-processing.mjs",
          "sha256": "e4a52dbd2ce86793b66c4af5963c288b13d7b2b2f656c4c6f795bcac8074f4ad"
        },
        {
          "path": "src/lib/meta-customer-provider.mjs",
          "sha256": "b6cc572fb68ab4cb653ccee30cea754a6273b5631d13e61dd2c2f65535aa287f"
        },
        {
          "path": "src/lib/meta-customer-templates.mjs",
          "sha256": "ca9e491b8b1b4c25c89585408cb53eae13e2423fdf48a93deed0846126e1c46c"
        },
        {
          "path": "src/lib/meta-development-pilot-policy.mjs",
          "sha256": "6f3a854898ea28d108341f35fe7f5f23facf3d574e586b96a2343a8038cc8c79"
        },
        {
          "path": "src/lib/meta-employee-intake.mjs",
          "sha256": "77dc9f64814f995d21084606d705f26af65de4f4f9bea25a0f37a0d8dba1b928"
        },
        {
          "path": "src/lib/meta-field-bridge.mjs",
          "sha256": "79c961cf91f988e5d913cfb241a887c26a78d49e04ebf2c5fbb2bf6a74bc809b"
        },
        {
          "path": "src/lib/meta-field-conversation.mjs",
          "sha256": "2da5b4a58e4f62a912d4df4bd93574c9907c6561123fe5ffabdd12420b72047f"
        },
        {
          "path": "src/lib/meta-kyc-challenge.mjs",
          "sha256": "f5a03ec770e6d85de095393bf38c331c0803a7fe3c7f1b72a2addd9cac7484eb"
        },
        {
          "path": "src/lib/meta-kyc-conversation.mjs",
          "sha256": "75870a6359385ae83df0d154b57c3f6738f2bde62fbe4974da7e38e5b0de2902"
        },
        {
          "path": "src/lib/meta-kyc-current-image.mjs",
          "sha256": "03ef3966025f520b373e937a6230f846185f3b4845830da5a38c0d8f02e155c2"
        },
        {
          "path": "src/lib/meta-kyc-identity.mjs",
          "sha256": "295f87ecb3b4586313a4f9c48a2d5c9acf8fa263682d99d44a966be243af2319"
        },
        {
          "path": "src/lib/meta-kyc-rejection-policy.mjs",
          "sha256": "e6c96aba8077d75e152f45dc49fe32d41e103658d4bff4281c8c8a98e3fff0c1"
        },
        {
          "path": "src/lib/meta-kyc-rejection.mjs",
          "sha256": "5477adafd994a54c9e7bbcc196b6af4fbe0b9cc03ab563775b8258290e31f3d0"
        },
        {
          "path": "src/lib/meta-own-company-policy.mjs",
          "sha256": "7db3875cd0f31fec077f4d9a4f8875be1ddf4a5772acff4559069ae950ff0821"
        },
        {
          "path": "src/lib/meta-plan-import-conversation.mjs",
          "sha256": "6f3c261cb2cde943e0202ab5097d664958f5702975cdf5914aeac35e5a1bac1c"
        },
        {
          "path": "src/lib/meta-plan-import-origin.mjs",
          "sha256": "cdb619d1709a982323c9892383def1428db2ade771babdb18e4032b3535d953e"
        },
        {
          "path": "src/lib/meta-plan-import-transport.mjs",
          "sha256": "e42f48f0175dd697bac3de61d7d9893d35c2b1696c1ae276a4698eb3c36a4634"
        },
        {
          "path": "src/lib/meta-test-recipient-binding.mjs",
          "sha256": "2aea6f5815bd2d90fe891b45a79b48d339a3eebc681ac40b3347244e546c4b66"
        },
        {
          "path": "src/lib/meta-whatsapp-transport.mjs",
          "sha256": "f99569c7f587e9be1268aa254d2368226346a7ebf7e48fa6ca63a0064cf41310"
        },
        {
          "path": "src/lib/organization-resource-usage-policy.mjs",
          "sha256": "089ac1ee2ca6afd30aab1d0abd38274698ca56991d1c5225ea8e44c8b9fdc449"
        },
        {
          "path": "src/lib/organization-usage-policy.mjs",
          "sha256": "94997530d6c1fd420f0233172b07f8ba7dd7546a2ac9af75eaa30736400237ae"
        },
        {
          "path": "src/lib/participant-account-discovery.mjs",
          "sha256": "11b37ca397fdb195aac7addc1c16842fb28a9c83a73a82a57bf2791ed3038738"
        },
        {
          "path": "src/lib/participant-admission.mjs",
          "sha256": "2cbb466e49d742cd23da1bb85a4e89b7e411dc724c8d1f2eb66b39717f283dd9"
        },
        {
          "path": "src/lib/participant-analysis-consent.mjs",
          "sha256": "7f7d371914d1e46ac799cd1683afdc0418186c15a20156e697ecd879c81bf8c1"
        },
        {
          "path": "src/lib/participant-approved-identity.mjs",
          "sha256": "834d81e70cedbd967ff84d880ea9d697c2168d2220fb23d9eb14c1aba1cdbbf1"
        },
        {
          "path": "src/lib/participant-bank-account.mjs",
          "sha256": "29980527a6eda3bbc0125098a4b616082034a71fb1afb772ff87f476bc0ce981"
        },
        {
          "path": "src/lib/participant-bank-format.mjs",
          "sha256": "ebbb206a14eaac57230b53ec1afae99c4be60c8739baf0d1d047d4a47ba464db"
        },
        {
          "path": "src/lib/participant-bank-vault.mjs",
          "sha256": "06e990ab79c896628756f3c74a50dcc7e8062f4fa296f56a31e4150b5badc16a"
        },
        {
          "path": "src/lib/participant-channel-kyc.mjs",
          "sha256": "2ac9414429238162a9b16d4adea421df0bff9fb93ea4fbf2f9d6677f2659fb2d"
        },
        {
          "path": "src/lib/participant-civil-policy.mjs",
          "sha256": "e180a64c788d6cd20e766cb4fd32dbba1c7cb3954c01405ac8675ec023eef278"
        },
        {
          "path": "src/lib/participant-civil-store.mjs",
          "sha256": "5f440c0c76ca67b87a7e5d4e90e7a48f18ea3603b16434b35beeddd3bdf168a4"
        },
        {
          "path": "src/lib/participant-kyc-chat-attempt.mjs",
          "sha256": "d3f0a65f866fa027ee008963fcb6ffcad0cd33de94cace7603cf40bc78c21aeb"
        },
        {
          "path": "src/lib/participant-kyc-chat-closure.mjs",
          "sha256": "4a6a368910de95582c2baabc70bab7f4b4afa4413e8ebdb75a1e8b867c098a19"
        },
        {
          "path": "src/lib/participant-kyc-chat-copy.mjs",
          "sha256": "d886219584d5e8b9d9db1ad16a36c726f6982fa0e8400c3be51af2623574ab96"
        },
        {
          "path": "src/lib/participant-kyc-image-set.mjs",
          "sha256": "190ce2560286a58d42668da7b912aeabcfa76ee14086503bf1609304e5f0e8fb"
        },
        {
          "path": "src/lib/participant-kyc-notice-links.mjs",
          "sha256": "1a10acf655796ebf4f08175158ea3dc2a1d0a0fdb3d13bb88573d6a0e5f4375e"
        },
        {
          "path": "src/lib/participant-kyc-preanalysis-policy.mjs",
          "sha256": "8c5286a0a5d41364e92e60f2ce2ba96caccc8667960f966b5caead37acafab49"
        },
        {
          "path": "src/lib/participant-onboarding-authority.mjs",
          "sha256": "dad5d9fd0a61c493ff02331d5333982627cdeb3a7addb74a3c86d44da931f916"
        },
        {
          "path": "src/lib/participant-onboarding-current-kyc.mjs",
          "sha256": "232fecca4f6cf775e5151ec460560e0c1abd6646dc3c532140cabe26dfb42119"
        },
        {
          "path": "src/lib/participant-onboarding-delivery.mjs",
          "sha256": "615592cc1a6215e24c48e8873a27211421853f99ca9093e6f490f77532b3d013"
        },
        {
          "path": "src/lib/participant-onboarding-intent.mjs",
          "sha256": "07114f6066e10617357c4e5d8e2db2b9dc846e5f4cffbc5aef09f2b7bfada9de"
        },
        {
          "path": "src/lib/participant-onboarding-policy.mjs",
          "sha256": "59409797ce3e13b7cfe63fe21d8d7e2c848ee49e0766015939242a9f43687c03"
        },
        {
          "path": "src/lib/participant-onboarding-reactive.mjs",
          "sha256": "666a8c27f3ab7d6fdbe66c91f22ace4e25b04b98e865f401d19c72212916104d"
        },
        {
          "path": "src/lib/participant-policy.mjs",
          "sha256": "7f3969ab1ebac5f01696149d76337199eb64c2fd09015c44c07e8b7e7088d62f"
        },
        {
          "path": "src/lib/participant-store.mjs",
          "sha256": "2296495e366b9ea0c2511066584e93ddf1cff51b5eefd05c6121d2143d78f5c9"
        },
        {
          "path": "src/lib/participant-verified-office.mjs",
          "sha256": "4922f392490aa6d49b8a8a45a56ac0b03831a8ad2efe89ce1e3adfd77d603d89"
        },
        {
          "path": "src/lib/person-worksite-journey.mjs",
          "sha256": "d3174df793150125c0b6a5d9f37d56336e72cab1efb43a361065b78ac54c210a"
        },
        {
          "path": "src/lib/pilot-media.mjs",
          "sha256": "55e35757cea03c312df68cebad100ee8b7d904b418eca9082359ea34e68f8fa9"
        },
        {
          "path": "src/lib/plan-baseline-policy.mjs",
          "sha256": "e9217a41a87057f437439420d56f3b7a0f973ae37c250c07b335634fef308560"
        },
        {
          "path": "src/lib/plan-import-cyp-curve.mjs",
          "sha256": "7e1d6c9d87df5e74e0a340361e1e66fdf0cfd5c82f1e44030ba2e85b5fa9c342"
        },
        {
          "path": "src/lib/plan-import-document-curve.mjs",
          "sha256": "7f63d62b9f1ae6d139c627a978ef56d7eafea0e0f4271167daa4c00bf7fda013"
        },
        {
          "path": "src/lib/plan-import-monthly-curve.mjs",
          "sha256": "6ce785f9c24c47f0e291b0bac40bd96a691fae68a309e4cb7a1917db31f9e6b6"
        },
        {
          "path": "src/lib/plan-import-ooxml.mjs",
          "sha256": "a146b9b300086bd8f44af6549d75611f7ac542a6c6c2f9eddf099cd8fc0f9251"
        },
        {
          "path": "src/lib/plan-import-policy.mjs",
          "sha256": "f2d73b8c58df571fb0dc6e5d76e2fb5d60daffa6ed6a41bc2be3c7e536458696"
        },
        {
          "path": "src/lib/plan-import-store.mjs",
          "sha256": "455c06e64301b2679e1278cc288cd4b06c875a222339e15c6720c58bc1f011c2"
        },
        {
          "path": "src/lib/plan-measurement-policy.mjs",
          "sha256": "3d6b0bce58a7f89612878310f534d8cf02f6a222c778cd4294b415c1f61157b7"
        },
        {
          "path": "src/lib/plan-measurement-source.mjs",
          "sha256": "ecf33b67a333d8ce73bfb51610218a1658cd94a26b62eb35d2290b795f826f36"
        },
        {
          "path": "src/lib/private-image-upload.mjs",
          "sha256": "1eaeda2fa79104cfe00a8736c466d8568d216c8682bd44031d3bf9d4f35e3f60"
        },
        {
          "path": "src/lib/procurement-quantity.js",
          "sha256": "53439844051cc1dbd679220d695e60e54bc1629b2f1ddb33fc125981da9326b3"
        },
        {
          "path": "src/lib/progress-measurement-quantity.js",
          "sha256": "e194f461d482dec666c090a19aabbd3498bc08964cbbbc31b8db6eeb39cb1be2"
        },
        {
          "path": "src/lib/site-register-policy.mjs",
          "sha256": "d529c4f2225e0ec851ef7df60f8c5b182a88b384958ebfd15b194683d1590434"
        },
        {
          "path": "src/lib/site-register-store.mjs",
          "sha256": "6b744c86f47dbb6dc081132675888615d76421701f96151b00646b5e1d2529c6"
        },
        {
          "path": "src/lib/task-progress-measurement.js",
          "sha256": "10361a0e30df34f9c90f915d9fdbfc0912a610ab3ce851503c32549b7049a8b9"
        },
        {
          "path": "src/lib/video-audio-extractor.mjs",
          "sha256": "0c85dfd39c10fdb782eca4fe57dc665c29bd7211ab7aba0dda3f8945abcb1988"
        },
        {
          "path": "src/lib/video-frame-extractor.mjs",
          "sha256": "33425a184cf097884982c43a90e3b515726027adbeb51c2cdbfc794e79dee6e6"
        },
        {
          "path": "src/lib/voice-progress-draft.mjs",
          "sha256": "56ddbad919a1ad77e13105f1a125914674c1a149a88e28fa2f8b831a4d14bd69"
        },
        {
          "path": "src/lib/whatsapp/field-worker-intent-policy.js",
          "sha256": "0fdf205af1c2185a16f99c4f1aaba6c36d95722ea914915a0eefe6a10d443ef9"
        },
        {
          "path": "src/lib/whatsapp/obra-intent-policy.js",
          "sha256": "cd01054ba81be6552f58dc91758e08166ea099482f28355cae570d15f3ccf8da"
        },
        {
          "path": "src/lib/whatsapp/operational-proposal-decision-policy.js",
          "sha256": "996ed641c090267679ce0fc3cb7a23f39b31ce88e761135feb0dd0c852eb74fc"
        },
        {
          "path": "src/lib/whatsapp/project-workspace-profile.js",
          "sha256": "e13473baa4ca5b4dc9851bb202f400ba174ccbfce2589be65ce8458aafa998f4"
        },
        {
          "path": "src/lib/whatsapp/template-review-policy.js",
          "sha256": "0ec4a7e544f8c2c2409d2c84ecf69fab663334dd5a5cef0ee1b1cbec82de0a08"
        },
        {
          "path": "src/lib/whatsapp/tenant-workspace-policy.js",
          "sha256": "d3416ff993fbfd70f75404166cdcd8f0b9b2e5a6741f6cde03725aab16abcd5e"
        },
        {
          "path": "src/lib/worker-channel-consent-policy.mjs",
          "sha256": "95c8393e7f2603694c5c15cfe34c9eead43007927aed0d5b633859b14c7448a9"
        },
        {
          "path": "src/lib/worker-channel-identity.mjs",
          "sha256": "1cddd58a2cd656abaca25752481fe1ca760d2bcd385a0fffbe0e685c15d59e0a"
        },
        {
          "path": "src/lib/workspace-policy.mjs",
          "sha256": "ba51cc5c4a6e4f5ce1c9382cae2c8ea903ab4373668c05384c7f1e9253c7041e"
        },
        {
          "path": "src/lib/workspace-store.mjs",
          "sha256": "5f25092121a31a06eefa59d69866db82fa3cd28afdcbd0e066e52d916478bc50"
        }
      ]
    },
    {
      "family": "CONSUMPTION_FEEDBACK_UI",
      "previousExternalImports": [
        "react"
      ],
      "currentFiles": [
        "src/app/(identity)/cuenta/company-channel-view.mjs",
        "src/app/(identity)/cuenta/material-inventory-panel.js",
        "src/app/(identity)/cuenta/material-inventory-panel.module.css",
        "src/app/(identity)/cuenta/material-inventory-view.mjs",
        "src/app/(identity)/cuenta/own-company-number-view.mjs",
        "src/app/(identity)/cuenta/own-company-templates-view.mjs",
        "src/app/(identity)/cuenta/participant-office-account-view.mjs",
        "src/app/(identity)/cuenta/plan-baseline-view.mjs",
        "src/app/(identity)/cuenta/plan-source-curve.mjs",
        "src/app/(identity)/cuenta/private-bank-account-format.mjs",
        "src/app/(identity)/cuenta/site-purchase-view.mjs",
        "src/app/(identity)/cuenta/template-send-view.mjs",
        "src/app/(identity)/cuenta/worksite-task-selector.js",
        "src/app/(identity)/cuenta/worksite-task-selector.module.css",
        "src/app/(identity)/cuenta/workspace-live-read.mjs",
        "src/app/(identity)/cuenta/workspace-live-refresh-controller.mjs",
        "src/app/(identity)/cuenta/workspace-live-refresh.js",
        "src/app/(identity)/cuenta/workspace-recovery-journal.mjs",
        "src/app/(identity)/cuenta/workspace-recovery-panel.js",
        "src/app/(identity)/cuenta/workspace-recovery-storage.mjs",
        "src/app/(identity)/cuenta/workspace-request-lifecycle.js",
        "src/app/(identity)/cuenta/workspace-request-lifecycle.mjs",
        "src/app/(identity)/cuenta/workspace-session-request.mjs",
        "src/app/(identity)/cuenta/workspace.module.css",
        "src/lib/plan-import-cyp-curve.mjs",
        "src/lib/plan-import-document-curve.mjs"
      ],
      "externalImports": [
        "react"
      ],
      "currentManifest": [
        {
          "path": "src/app/(identity)/cuenta/company-channel-view.mjs",
          "sha256": "c79c473999e444b84e2a1d58e0d03f030069c24f9749f2c84450318b0b237e4d"
        },
        {
          "path": "src/app/(identity)/cuenta/material-inventory-panel.js",
          "sha256": "0faadb854099ef161b9c869cc2b4c0aeb16d102e59fcaca8ef27fecd614d2924"
        },
        {
          "path": "src/app/(identity)/cuenta/material-inventory-panel.module.css",
          "sha256": "1d7eec4afc275ee403674b187acb7844e3df519f24cd537af2e05f7b8032611c"
        },
        {
          "path": "src/app/(identity)/cuenta/material-inventory-view.mjs",
          "sha256": "8b987424dd1db2332cbb26f792e51c8fea286bd5440f4d3235809e3869722b83"
        },
        {
          "path": "src/app/(identity)/cuenta/own-company-number-view.mjs",
          "sha256": "6940f11e30d2958d7f6771463ce28ca83c0e2d2f41e81aa220c8efe669580300"
        },
        {
          "path": "src/app/(identity)/cuenta/own-company-templates-view.mjs",
          "sha256": "3bf758b150336613a437e2b01d3b6a79645a024b771f1515f4ec2ae58a1b8bc3"
        },
        {
          "path": "src/app/(identity)/cuenta/participant-office-account-view.mjs",
          "sha256": "f2716f72297a1277946bafa03a82d4c1fb7f2fcff7f4c4bbe155a86ed7e4e379"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-baseline-view.mjs",
          "sha256": "0c696eba748a7441440e23be5085dc42d4954427def5adc1e2de686b4b11711d"
        },
        {
          "path": "src/app/(identity)/cuenta/plan-source-curve.mjs",
          "sha256": "689402d373744d159a62e2e5975ddfdf79053c528a838879dd5df3e43a0efdc9"
        },
        {
          "path": "src/app/(identity)/cuenta/private-bank-account-format.mjs",
          "sha256": "4dcf7f2de2f49f97f155e14128b20815f538d659d5e82806fa45a18d541adeea"
        },
        {
          "path": "src/app/(identity)/cuenta/site-purchase-view.mjs",
          "sha256": "58ebd978e8e39423901cb811ecf2ab851160b78f7cd5cb441075d66d7819dee9"
        },
        {
          "path": "src/app/(identity)/cuenta/template-send-view.mjs",
          "sha256": "703415b8dab1a575ebb54c9273049d2b940f93994add7177255ae26918672940"
        },
        {
          "path": "src/app/(identity)/cuenta/worksite-task-selector.js",
          "sha256": "d790aeec929ed1ef2ac724883988b03f6640f3882133d917760f0ddeb2a2488c"
        },
        {
          "path": "src/app/(identity)/cuenta/worksite-task-selector.module.css",
          "sha256": "12351228e827ea0e9a42a45f4d40a3fb713edd01bf0aab3ab6f58efbde7fa434"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-live-read.mjs",
          "sha256": "a73e558f46b86a78cbe4f22783403af17061fe03e79f8e184f967448041909ec"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-live-refresh-controller.mjs",
          "sha256": "a61c2d017bc8dadb79fab4b0630b0404b65132d355e153bcb6a2042f5fd49511"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-live-refresh.js",
          "sha256": "78b056667e89f56fd9e1185c3addc6a8d40b331a0cd82146cbba17771662510a"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-recovery-journal.mjs",
          "sha256": "060e128b54eefdadfbabac45c3ec696934f5e74d79b9e26e905081128e8e99c5"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-recovery-panel.js",
          "sha256": "063361bf78293a61a246195d5734f69a17b08c5781ae5c9f502b85dcc51ef883"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-recovery-storage.mjs",
          "sha256": "d8cf1e7e8d88d66f722aaf52deb45f95829c226468d3f37a2b23d171cc1ecbb8"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-request-lifecycle.js",
          "sha256": "b3004538de2cc7cbc829bf5518c4f4b2a5eb2935d0b4e60f9c88840c8ede3797"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-request-lifecycle.mjs",
          "sha256": "590cd7691d8b6beb82929bdd18dd9909c2d2cfa1c3d4111ff4d478d57daf532f"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace-session-request.mjs",
          "sha256": "29d294ac1d973317d6a3df225a64a8a9115c6ea51c587f297114e7992af97520"
        },
        {
          "path": "src/app/(identity)/cuenta/workspace.module.css",
          "sha256": "339fee2591a341bbb7839a19d55a5c298c728ef1de38a2efc3680999f4636db4"
        },
        {
          "path": "src/lib/plan-import-cyp-curve.mjs",
          "sha256": "7e1d6c9d87df5e74e0a340361e1e66fdf0cfd5c82f1e44030ba2e85b5fa9c342"
        },
        {
          "path": "src/lib/plan-import-document-curve.mjs",
          "sha256": "7f63d62b9f1ae6d139c627a978ef56d7eafea0e0f4271167daa4c00bf7fda013"
        }
      ]
    },
    {
      "family": "COMPACT",
      "previousExternalImports": [
        "@babel/parser",
        "@vercel/blob",
        "ffmpeg-static",
        "next/server",
        "node:assert/strict",
        "node:child_process",
        "node:crypto",
        "node:fs",
        "node:fs/promises",
        "node:os",
        "node:path",
        "node:perf_hooks",
        "node:url",
        "node:zlib",
        "pg",
        "saxes",
        "yauzl"
      ],
      "currentFiles": [
        "package-lock.json",
        "package.json",
        "scripts/lib/company-channel-disposable-fixture.mjs",
        "scripts/lib/company-channel-migration.mjs",
        "scripts/lib/disposable-postgres-cleanup.mjs",
        "scripts/lib/kyc-current-image-native.mjs",
        "scripts/lib/kyc-current-image-own-native.mjs",
        "scripts/lib/kyc-neutral-step-guidance-native.mjs",
        "scripts/lib/kyc-neutral-step-guidance-own-native.mjs",
        "scripts/verify-company-kyc-outbound-compact-postgres.mjs",
        "scripts/verify-company-kyc-rejection-feedback-postgres.mjs",
        "src/app/(identity)/cuenta/private-bank-account-format.mjs",
        "src/lib/bindx-civil-data-client.mjs",
        "src/lib/brand-assets.mjs",
        "src/lib/canonical-invited-account.mjs",
        "src/lib/company-channel-connection.mjs",
        "src/lib/company-channel-kyc.mjs",
        "src/lib/company-channel-routing.mjs",
        "src/lib/company-channel-schema.mjs",
        "src/lib/company-channel-store.mjs",
        "src/lib/company-entitlement.mjs",
        "src/lib/company-onboarding-policy.mjs",
        "src/lib/company-phone-format.mjs",
        "src/lib/employee-intake-channel-continuity.mjs",
        "src/lib/field-hours-report.mjs",
        "src/lib/field-media-privacy.mjs",
        "src/lib/field-media.mjs",
        "src/lib/field-operations-policy.mjs",
        "src/lib/field-operations-store.mjs",
        "src/lib/field-overtime-policy.mjs",
        "src/lib/field-overtime-store.mjs",
        "src/lib/field-report-feedback.mjs",
        "src/lib/field-shift-summary.mjs",
        "src/lib/geo.js",
        "src/lib/legacy-access-boundary.js",
        "src/lib/material-inventory.mjs",
        "src/lib/meta-callback-diagnostics.mjs",
        "src/lib/meta-channel-binding.mjs",
        "src/lib/meta-cloud-protocol.mjs",
        "src/lib/meta-customer-app-projection.mjs",
        "src/lib/meta-customer-callback.mjs",
        "src/lib/meta-customer-coexistence.mjs",
        "src/lib/meta-customer-credentials.mjs",
        "src/lib/meta-customer-inbox-review.mjs",
        "src/lib/meta-customer-outbound.mjs",
        "src/lib/meta-customer-permissions.mjs",
        "src/lib/meta-customer-processing-runtime.mjs",
        "src/lib/meta-customer-processing.mjs",
        "src/lib/meta-customer-provider.mjs",
        "src/lib/meta-customer-templates.mjs",
        "src/lib/meta-development-pilot-policy.mjs",
        "src/lib/meta-employee-intake.mjs",
        "src/lib/meta-field-bridge.mjs",
        "src/lib/meta-field-conversation.mjs",
        "src/lib/meta-kyc-bridge.mjs",
        "src/lib/meta-kyc-challenge.mjs",
        "src/lib/meta-kyc-context-feedback.mjs",
        "src/lib/meta-kyc-context-outbound.mjs",
        "src/lib/meta-kyc-conversation.mjs",
        "src/lib/meta-kyc-current-image.mjs",
        "src/lib/meta-kyc-expiry-feedback.mjs",
        "src/lib/meta-kyc-identity.mjs",
        "src/lib/meta-kyc-outbound.mjs",
        "src/lib/meta-kyc-rejection-policy.mjs",
        "src/lib/meta-kyc-rejection.mjs",
        "src/lib/meta-own-company-connection.mjs",
        "src/lib/meta-own-company-policy.mjs",
        "src/lib/meta-plan-import-conversation.mjs",
        "src/lib/meta-plan-import-origin.mjs",
        "src/lib/meta-plan-import-recovery.mjs",
        "src/lib/meta-plan-import-transport.mjs",
        "src/lib/meta-test-recipient-binding.mjs",
        "src/lib/meta-whatsapp-transport.mjs",
        "src/lib/organization-resource-usage-policy.mjs",
        "src/lib/organization-resource-usage-store.mjs",
        "src/lib/organization-usage-policy.mjs",
        "src/lib/organization-usage-runtime.mjs",
        "src/lib/organization-usage-store.mjs",
        "src/lib/participant-account-discovery.mjs",
        "src/lib/participant-admission.mjs",
        "src/lib/participant-analysis-consent.mjs",
        "src/lib/participant-approved-identity.mjs",
        "src/lib/participant-bank-account.mjs",
        "src/lib/participant-bank-format.mjs",
        "src/lib/participant-bank-vault.mjs",
        "src/lib/participant-channel-kyc.mjs",
        "src/lib/participant-civil-policy.mjs",
        "src/lib/participant-civil-store.mjs",
        "src/lib/participant-kyc-chat-attempt.mjs",
        "src/lib/participant-kyc-chat-closure.mjs",
        "src/lib/participant-kyc-chat-copy.mjs",
        "src/lib/participant-kyc-image-set.mjs",
        "src/lib/participant-kyc-notice-links.mjs",
        "src/lib/participant-kyc-preanalysis-policy.mjs",
        "src/lib/participant-kyc-preanalysis-runtime.mjs",
        "src/lib/participant-kyc-preanalysis.mjs",
        "src/lib/participant-onboarding-authority.mjs",
        "src/lib/participant-onboarding-current-kyc.mjs",
        "src/lib/participant-onboarding-delivery.mjs",
        "src/lib/participant-onboarding-intent.mjs",
        "src/lib/participant-onboarding-policy.mjs",
        "src/lib/participant-onboarding-reactive.mjs",
        "src/lib/participant-policy.mjs",
        "src/lib/participant-store.mjs",
        "src/lib/participant-verified-office.mjs",
        "src/lib/person-worksite-journey.mjs",
        "src/lib/pilot-media.mjs",
        "src/lib/plan-baseline-policy.mjs",
        "src/lib/plan-import-analyzer.mjs",
        "src/lib/plan-import-cyp-curve.mjs",
        "src/lib/plan-import-document-curve.mjs",
        "src/lib/plan-import-monthly-curve.mjs",
        "src/lib/plan-import-ooxml.mjs",
        "src/lib/plan-import-policy.mjs",
        "src/lib/plan-import-store.mjs",
        "src/lib/plan-measurement-policy.mjs",
        "src/lib/plan-measurement-source.mjs",
        "src/lib/private-biometric-analyzer.mjs",
        "src/lib/private-image-upload.mjs",
        "src/lib/procurement-quantity.js",
        "src/lib/progress-measurement-quantity.js",
        "src/lib/site-register-policy.mjs",
        "src/lib/site-register-store.mjs",
        "src/lib/task-progress-measurement.js",
        "src/lib/video-audio-extractor.mjs",
        "src/lib/video-frame-extractor.mjs",
        "src/lib/voice-progress-draft.mjs",
        "src/lib/whatsapp/field-worker-intent-policy.js",
        "src/lib/whatsapp/obra-intent-policy.js",
        "src/lib/whatsapp/operational-proposal-decision-policy.js",
        "src/lib/whatsapp/project-workspace-profile.js",
        "src/lib/whatsapp/template-review-policy.js",
        "src/lib/whatsapp/tenant-workspace-policy.js",
        "src/lib/worker-channel-consent-policy.mjs",
        "src/lib/worker-channel-identity.mjs",
        "src/lib/workspace-policy.mjs",
        "src/lib/workspace-runtime.mjs",
        "src/lib/workspace-store.mjs",
        "tests/fixtures/meta-kyc-outbound-baseline-b572.json",
        "tests/fixtures/own-company-meta.mjs"
      ],
      "externalImports": [
        "@babel/parser",
        "@vercel/blob",
        "ffmpeg-static",
        "next/server",
        "node:assert/strict",
        "node:child_process",
        "node:crypto",
        "node:fs",
        "node:fs/promises",
        "node:os",
        "node:path",
        "node:perf_hooks",
        "node:url",
        "node:zlib",
        "pg",
        "saxes",
        "yauzl"
      ],
      "currentManifest": [
        {
          "path": "package-lock.json",
          "sha256": "dfa3ff3914547f35828a0b697e6007c6cf856546be86bf8a7810cdce59e60449"
        },
        {
          "path": "package.json",
          "sha256": "6b7918c67edddee946d9455aa71913987f54f8abe441e0c3e560560a89061c4d"
        },
        {
          "path": "scripts/lib/company-channel-disposable-fixture.mjs",
          "sha256": "717d87a6fb1dd7f6a8b2a2d19cd3b2fee652d536e958bd833bf8431c31076138"
        },
        {
          "path": "scripts/lib/company-channel-migration.mjs",
          "sha256": "1ffb93c704636434f36b52367d3d21d8615ce9b516f350956c414c917e9d33c7"
        },
        {
          "path": "scripts/lib/disposable-postgres-cleanup.mjs",
          "sha256": "df8d9f36b79cdd5f2d940c0dc4bbc88acbb0bec6e66c9ee5ae93ad5c6e4ab89e"
        },
        {
          "path": "scripts/lib/kyc-current-image-native.mjs",
          "sha256": "87ad6932bbb4ed264947b0ba527965080e4f38a7cc0bb0f945b471e88ee06bbb"
        },
        {
          "path": "scripts/lib/kyc-current-image-own-native.mjs",
          "sha256": "2458c91bda08fe36d409e9c229c19f06dfe9d113aa8c8df4d6f11502b0d1e5fe"
        },
        {
          "path": "scripts/lib/kyc-neutral-step-guidance-native.mjs",
          "sha256": "ddfd08e00f35b3f33254eed513d7bba81ec9791b23ca0d078362132fd24d546e"
        },
        {
          "path": "scripts/lib/kyc-neutral-step-guidance-own-native.mjs",
          "sha256": "8e417c9d93d3a265b7ea7dc34b81737454286b573fd3738a6cfc37f0a5520955"
        },
        {
          "path": "scripts/verify-company-kyc-outbound-compact-postgres.mjs",
          "sha256": "362bdcc31bf9eb37197e3c21485dd6522ab3343ea2d01d9fe1db4b3f27b56700"
        },
        {
          "path": "scripts/verify-company-kyc-rejection-feedback-postgres.mjs",
          "sha256": "a64cd0fa267dda98f9c9430327ab39f2cfec304fadc7fddb6c804ba41091ba32"
        },
        {
          "path": "src/app/(identity)/cuenta/private-bank-account-format.mjs",
          "sha256": "4dcf7f2de2f49f97f155e14128b20815f538d659d5e82806fa45a18d541adeea"
        },
        {
          "path": "src/lib/bindx-civil-data-client.mjs",
          "sha256": "20da64b82d14fb3d4055b9852ed8712d33b01d1bc9f50709cb55084c7d0433a2"
        },
        {
          "path": "src/lib/brand-assets.mjs",
          "sha256": "7da49f3f4d8c2f9d2cce36cc2902b5f46e044b98e67bace09e240f5b007fd4c1"
        },
        {
          "path": "src/lib/canonical-invited-account.mjs",
          "sha256": "94652997c4e6717e875041c859de9caaaeeabd9d166666d9dfbf899c51d98c7b"
        },
        {
          "path": "src/lib/company-channel-connection.mjs",
          "sha256": "f2c44860383bb49df67f7999fbe3c0a5aa57c91ebbde0cf9a3b5b367784f2c45"
        },
        {
          "path": "src/lib/company-channel-kyc.mjs",
          "sha256": "5b46276ad3aa5d656a0027be4a6bf58aa3fba4f557dd86e0c13d0d5b0cecba85"
        },
        {
          "path": "src/lib/company-channel-routing.mjs",
          "sha256": "9ed740dbb4ae1ca7d44171f176f0001d824b056a0f17a8f58ed1ea5a5a2e2f68"
        },
        {
          "path": "src/lib/company-channel-schema.mjs",
          "sha256": "96c0385fa3b6d60c8d1f92ca38dcdf32e7779f1200512806bf6d220e6be57022"
        },
        {
          "path": "src/lib/company-channel-store.mjs",
          "sha256": "300c5e7e0abe65b97b86a200c6cc72444b9c65ce375d61975c56f5abbc6a453b"
        },
        {
          "path": "src/lib/company-entitlement.mjs",
          "sha256": "65d41dfb796ef12be38b1220a99ccd3dfe277419a5e5a27e125beb29fe7e2cde"
        },
        {
          "path": "src/lib/company-onboarding-policy.mjs",
          "sha256": "cf557c7837d6264c78207028c668f8f8a2218f9632a8092cfcb8692ef11053d1"
        },
        {
          "path": "src/lib/company-phone-format.mjs",
          "sha256": "67b31114f517253961c6a774210f157867b1e2e318e6b700089eef03ef1b7209"
        },
        {
          "path": "src/lib/employee-intake-channel-continuity.mjs",
          "sha256": "59dffe3800f26cd979bd12c4cff0010ca72779e1dc62030a6f0117b6ef3fb64d"
        },
        {
          "path": "src/lib/field-hours-report.mjs",
          "sha256": "b55b767d61278bde31cb9ce4ef64faee5320fc7fe1b1bcc54559860bb4576731"
        },
        {
          "path": "src/lib/field-media-privacy.mjs",
          "sha256": "5ec7fc7dd71f9303a42bfb4889e02541de8a3cf356e8e1203cfeeefd56220515"
        },
        {
          "path": "src/lib/field-media.mjs",
          "sha256": "940e681d1430fc211093b16f5407637fcd31d270a3d99234f748fe7db73cc0bb"
        },
        {
          "path": "src/lib/field-operations-policy.mjs",
          "sha256": "01eb863d7db4446eeb8dab990d7e0602a19d581d5615a0b1e5d50c02f3d70173"
        },
        {
          "path": "src/lib/field-operations-store.mjs",
          "sha256": "dbf96641349efae61808a2d66a02d491ad06e2226885e6efa928dba53ce5034e"
        },
        {
          "path": "src/lib/field-overtime-policy.mjs",
          "sha256": "76848bd0861d6cecccb682b774599f03d3fe1322eed3cc58f5f1db5d9b1e24f8"
        },
        {
          "path": "src/lib/field-overtime-store.mjs",
          "sha256": "f29b67fff29949d5a8b14c4aed3f484ae1ce16d2ed42de486a6d5868361b1526"
        },
        {
          "path": "src/lib/field-report-feedback.mjs",
          "sha256": "70b966ae5f382abe6b5446daf1092c3f66b8f46f80ce5a0c006cffeba1cfa64c"
        },
        {
          "path": "src/lib/field-shift-summary.mjs",
          "sha256": "41f47aa7a0826ba1fe29b554c7575ec60c9861f0c18c863f06e8c3d00cb0f83c"
        },
        {
          "path": "src/lib/geo.js",
          "sha256": "fa47424540f953adf56e0c3069780c0c8876a2f69e944a80caddefa974b5b6bf"
        },
        {
          "path": "src/lib/legacy-access-boundary.js",
          "sha256": "e1af7e83dac3c18bcf3b235d111d936d6dd6167925a3e1459d70a33913035370"
        },
        {
          "path": "src/lib/material-inventory.mjs",
          "sha256": "4b599d273c4cadcdf76202554757583152da8c11b0a754be386bffb830f0c65b"
        },
        {
          "path": "src/lib/meta-callback-diagnostics.mjs",
          "sha256": "b16fcfbeabe02b119d0337485504490a0c8e60363e841e378ae4c7722816d3bc"
        },
        {
          "path": "src/lib/meta-channel-binding.mjs",
          "sha256": "0ba9e9de3b6dcca46524ab2df22236dbbcd5be5e6cef571df1ec47a01633672e"
        },
        {
          "path": "src/lib/meta-cloud-protocol.mjs",
          "sha256": "c6d5f1e1b4119dd2529860e3bd61a1b22d602f71ad301b2f04cec3ab4bbbed3c"
        },
        {
          "path": "src/lib/meta-customer-app-projection.mjs",
          "sha256": "7b4b95712f143555a0e23b8ac98fc0e1d2f108e9fbefb4e861d20d9b464ef003"
        },
        {
          "path": "src/lib/meta-customer-callback.mjs",
          "sha256": "da90e3ed097c287a7c080d05daf5e4b0c0bb82544d2f7dab4cb1ee99880c3fd0"
        },
        {
          "path": "src/lib/meta-customer-coexistence.mjs",
          "sha256": "30f5b950284b953fa853b37514cd768660cfc505a6e979ec51c947b6edce40da"
        },
        {
          "path": "src/lib/meta-customer-credentials.mjs",
          "sha256": "44a05a0b46417de835eb289882b0b2c6d71158f207c16c48228f1ac4b67cca0f"
        },
        {
          "path": "src/lib/meta-customer-inbox-review.mjs",
          "sha256": "250bd69c487dc8dffed5500c1ca0f9adb77843352902c41e4a63da7656bf2eaa"
        },
        {
          "path": "src/lib/meta-customer-outbound.mjs",
          "sha256": "84a249b3777d3be843b20b09d0c6cd81b6fab7415dc22f124477d87475eead09"
        },
        {
          "path": "src/lib/meta-customer-permissions.mjs",
          "sha256": "ce3671bd46af8e487c45319facbca8e6b522620fd16ee3163e5048b5ecb6585d"
        },
        {
          "path": "src/lib/meta-customer-processing-runtime.mjs",
          "sha256": "68c0712464738bff2abfdd9e7310266056b7685bb22976b21e3ce325082a0fdd"
        },
        {
          "path": "src/lib/meta-customer-processing.mjs",
          "sha256": "e4a52dbd2ce86793b66c4af5963c288b13d7b2b2f656c4c6f795bcac8074f4ad"
        },
        {
          "path": "src/lib/meta-customer-provider.mjs",
          "sha256": "b6cc572fb68ab4cb653ccee30cea754a6273b5631d13e61dd2c2f65535aa287f"
        },
        {
          "path": "src/lib/meta-customer-templates.mjs",
          "sha256": "ca9e491b8b1b4c25c89585408cb53eae13e2423fdf48a93deed0846126e1c46c"
        },
        {
          "path": "src/lib/meta-development-pilot-policy.mjs",
          "sha256": "6f3a854898ea28d108341f35fe7f5f23facf3d574e586b96a2343a8038cc8c79"
        },
        {
          "path": "src/lib/meta-employee-intake.mjs",
          "sha256": "77dc9f64814f995d21084606d705f26af65de4f4f9bea25a0f37a0d8dba1b928"
        },
        {
          "path": "src/lib/meta-field-bridge.mjs",
          "sha256": "79c961cf91f988e5d913cfb241a887c26a78d49e04ebf2c5fbb2bf6a74bc809b"
        },
        {
          "path": "src/lib/meta-field-conversation.mjs",
          "sha256": "2da5b4a58e4f62a912d4df4bd93574c9907c6561123fe5ffabdd12420b72047f"
        },
        {
          "path": "src/lib/meta-kyc-bridge.mjs",
          "sha256": "33368028c42baf9f720390de4fc03cbed1448368079415850a41f3adadfebed3"
        },
        {
          "path": "src/lib/meta-kyc-challenge.mjs",
          "sha256": "f5a03ec770e6d85de095393bf38c331c0803a7fe3c7f1b72a2addd9cac7484eb"
        },
        {
          "path": "src/lib/meta-kyc-context-feedback.mjs",
          "sha256": "c8e549ba41e57e637e754e0bef5cd52c2e14a96bab5400f598e4e5aff2249668"
        },
        {
          "path": "src/lib/meta-kyc-context-outbound.mjs",
          "sha256": "cdcf9465f36960b9b9c1252733f7b063538adfe3d4d0b4b15faef5f0d4a0bbfc"
        },
        {
          "path": "src/lib/meta-kyc-conversation.mjs",
          "sha256": "75870a6359385ae83df0d154b57c3f6738f2bde62fbe4974da7e38e5b0de2902"
        },
        {
          "path": "src/lib/meta-kyc-current-image.mjs",
          "sha256": "03ef3966025f520b373e937a6230f846185f3b4845830da5a38c0d8f02e155c2"
        },
        {
          "path": "src/lib/meta-kyc-expiry-feedback.mjs",
          "sha256": "9734d647efc6daa72a2a69072d698f05d1edf3a0795b7476df4498aa1328e5a7"
        },
        {
          "path": "src/lib/meta-kyc-identity.mjs",
          "sha256": "295f87ecb3b4586313a4f9c48a2d5c9acf8fa263682d99d44a966be243af2319"
        },
        {
          "path": "src/lib/meta-kyc-outbound.mjs",
          "sha256": "e0766080e345b3777fc87a6f8014a34073beb48a3c9205aa4c1cb49251b4e589"
        },
        {
          "path": "src/lib/meta-kyc-rejection-policy.mjs",
          "sha256": "e6c96aba8077d75e152f45dc49fe32d41e103658d4bff4281c8c8a98e3fff0c1"
        },
        {
          "path": "src/lib/meta-kyc-rejection.mjs",
          "sha256": "5477adafd994a54c9e7bbcc196b6af4fbe0b9cc03ab563775b8258290e31f3d0"
        },
        {
          "path": "src/lib/meta-own-company-connection.mjs",
          "sha256": "5bdf8a2c6b1333efe0a12481174e433cd58c9e1583ae0972f4cb090892eaaf84"
        },
        {
          "path": "src/lib/meta-own-company-policy.mjs",
          "sha256": "7db3875cd0f31fec077f4d9a4f8875be1ddf4a5772acff4559069ae950ff0821"
        },
        {
          "path": "src/lib/meta-plan-import-conversation.mjs",
          "sha256": "6f3c261cb2cde943e0202ab5097d664958f5702975cdf5914aeac35e5a1bac1c"
        },
        {
          "path": "src/lib/meta-plan-import-origin.mjs",
          "sha256": "cdb619d1709a982323c9892383def1428db2ade771babdb18e4032b3535d953e"
        },
        {
          "path": "src/lib/meta-plan-import-recovery.mjs",
          "sha256": "01b77db7aba4a2d1736bf952f2056d95163d66dbb4f9e2ef8172bf41b756b23e"
        },
        {
          "path": "src/lib/meta-plan-import-transport.mjs",
          "sha256": "e42f48f0175dd697bac3de61d7d9893d35c2b1696c1ae276a4698eb3c36a4634"
        },
        {
          "path": "src/lib/meta-test-recipient-binding.mjs",
          "sha256": "2aea6f5815bd2d90fe891b45a79b48d339a3eebc681ac40b3347244e546c4b66"
        },
        {
          "path": "src/lib/meta-whatsapp-transport.mjs",
          "sha256": "f99569c7f587e9be1268aa254d2368226346a7ebf7e48fa6ca63a0064cf41310"
        },
        {
          "path": "src/lib/organization-resource-usage-policy.mjs",
          "sha256": "089ac1ee2ca6afd30aab1d0abd38274698ca56991d1c5225ea8e44c8b9fdc449"
        },
        {
          "path": "src/lib/organization-resource-usage-store.mjs",
          "sha256": "869502cd3b11d1625c4dbb843ebc53d92e43dd21d13fcb53f22538684ec4f2ef"
        },
        {
          "path": "src/lib/organization-usage-policy.mjs",
          "sha256": "94997530d6c1fd420f0233172b07f8ba7dd7546a2ac9af75eaa30736400237ae"
        },
        {
          "path": "src/lib/organization-usage-runtime.mjs",
          "sha256": "b9288de2dd937db0bffb9e9e5a8da08773f9a6e35d139713b98f925e462a5bc9"
        },
        {
          "path": "src/lib/organization-usage-store.mjs",
          "sha256": "9497c32b76ffda1d5456267d4fcdc90b674618df1d60bd84dbbd7bc3b2827347"
        },
        {
          "path": "src/lib/participant-account-discovery.mjs",
          "sha256": "11b37ca397fdb195aac7addc1c16842fb28a9c83a73a82a57bf2791ed3038738"
        },
        {
          "path": "src/lib/participant-admission.mjs",
          "sha256": "2cbb466e49d742cd23da1bb85a4e89b7e411dc724c8d1f2eb66b39717f283dd9"
        },
        {
          "path": "src/lib/participant-analysis-consent.mjs",
          "sha256": "7f7d371914d1e46ac799cd1683afdc0418186c15a20156e697ecd879c81bf8c1"
        },
        {
          "path": "src/lib/participant-approved-identity.mjs",
          "sha256": "834d81e70cedbd967ff84d880ea9d697c2168d2220fb23d9eb14c1aba1cdbbf1"
        },
        {
          "path": "src/lib/participant-bank-account.mjs",
          "sha256": "29980527a6eda3bbc0125098a4b616082034a71fb1afb772ff87f476bc0ce981"
        },
        {
          "path": "src/lib/participant-bank-format.mjs",
          "sha256": "ebbb206a14eaac57230b53ec1afae99c4be60c8739baf0d1d047d4a47ba464db"
        },
        {
          "path": "src/lib/participant-bank-vault.mjs",
          "sha256": "06e990ab79c896628756f3c74a50dcc7e8062f4fa296f56a31e4150b5badc16a"
        },
        {
          "path": "src/lib/participant-channel-kyc.mjs",
          "sha256": "2ac9414429238162a9b16d4adea421df0bff9fb93ea4fbf2f9d6677f2659fb2d"
        },
        {
          "path": "src/lib/participant-civil-policy.mjs",
          "sha256": "e180a64c788d6cd20e766cb4fd32dbba1c7cb3954c01405ac8675ec023eef278"
        },
        {
          "path": "src/lib/participant-civil-store.mjs",
          "sha256": "5f440c0c76ca67b87a7e5d4e90e7a48f18ea3603b16434b35beeddd3bdf168a4"
        },
        {
          "path": "src/lib/participant-kyc-chat-attempt.mjs",
          "sha256": "d3f0a65f866fa027ee008963fcb6ffcad0cd33de94cace7603cf40bc78c21aeb"
        },
        {
          "path": "src/lib/participant-kyc-chat-closure.mjs",
          "sha256": "4a6a368910de95582c2baabc70bab7f4b4afa4413e8ebdb75a1e8b867c098a19"
        },
        {
          "path": "src/lib/participant-kyc-chat-copy.mjs",
          "sha256": "d886219584d5e8b9d9db1ad16a36c726f6982fa0e8400c3be51af2623574ab96"
        },
        {
          "path": "src/lib/participant-kyc-image-set.mjs",
          "sha256": "190ce2560286a58d42668da7b912aeabcfa76ee14086503bf1609304e5f0e8fb"
        },
        {
          "path": "src/lib/participant-kyc-notice-links.mjs",
          "sha256": "1a10acf655796ebf4f08175158ea3dc2a1d0a0fdb3d13bb88573d6a0e5f4375e"
        },
        {
          "path": "src/lib/participant-kyc-preanalysis-policy.mjs",
          "sha256": "8c5286a0a5d41364e92e60f2ce2ba96caccc8667960f966b5caead37acafab49"
        },
        {
          "path": "src/lib/participant-kyc-preanalysis-runtime.mjs",
          "sha256": "ac91e8a9a0fbb559cbdb143daf8806217ece06f969140e4f0858cc3d759f40a3"
        },
        {
          "path": "src/lib/participant-kyc-preanalysis.mjs",
          "sha256": "4032950ecce3fd910225261d3e268160feb63893bc7d13a0f673b9e3d5d4fc87"
        },
        {
          "path": "src/lib/participant-onboarding-authority.mjs",
          "sha256": "dad5d9fd0a61c493ff02331d5333982627cdeb3a7addb74a3c86d44da931f916"
        },
        {
          "path": "src/lib/participant-onboarding-current-kyc.mjs",
          "sha256": "232fecca4f6cf775e5151ec460560e0c1abd6646dc3c532140cabe26dfb42119"
        },
        {
          "path": "src/lib/participant-onboarding-delivery.mjs",
          "sha256": "615592cc1a6215e24c48e8873a27211421853f99ca9093e6f490f77532b3d013"
        },
        {
          "path": "src/lib/participant-onboarding-intent.mjs",
          "sha256": "07114f6066e10617357c4e5d8e2db2b9dc846e5f4cffbc5aef09f2b7bfada9de"
        },
        {
          "path": "src/lib/participant-onboarding-policy.mjs",
          "sha256": "59409797ce3e13b7cfe63fe21d8d7e2c848ee49e0766015939242a9f43687c03"
        },
        {
          "path": "src/lib/participant-onboarding-reactive.mjs",
          "sha256": "666a8c27f3ab7d6fdbe66c91f22ace4e25b04b98e865f401d19c72212916104d"
        },
        {
          "path": "src/lib/participant-policy.mjs",
          "sha256": "7f3969ab1ebac5f01696149d76337199eb64c2fd09015c44c07e8b7e7088d62f"
        },
        {
          "path": "src/lib/participant-store.mjs",
          "sha256": "2296495e366b9ea0c2511066584e93ddf1cff51b5eefd05c6121d2143d78f5c9"
        },
        {
          "path": "src/lib/participant-verified-office.mjs",
          "sha256": "4922f392490aa6d49b8a8a45a56ac0b03831a8ad2efe89ce1e3adfd77d603d89"
        },
        {
          "path": "src/lib/person-worksite-journey.mjs",
          "sha256": "d3174df793150125c0b6a5d9f37d56336e72cab1efb43a361065b78ac54c210a"
        },
        {
          "path": "src/lib/pilot-media.mjs",
          "sha256": "55e35757cea03c312df68cebad100ee8b7d904b418eca9082359ea34e68f8fa9"
        },
        {
          "path": "src/lib/plan-baseline-policy.mjs",
          "sha256": "e9217a41a87057f437439420d56f3b7a0f973ae37c250c07b335634fef308560"
        },
        {
          "path": "src/lib/plan-import-analyzer.mjs",
          "sha256": "0427c7fbdf0ba27b07c328661e52731c996e0a7b5f0749dcc6207410b28c52bb"
        },
        {
          "path": "src/lib/plan-import-cyp-curve.mjs",
          "sha256": "7e1d6c9d87df5e74e0a340361e1e66fdf0cfd5c82f1e44030ba2e85b5fa9c342"
        },
        {
          "path": "src/lib/plan-import-document-curve.mjs",
          "sha256": "7f63d62b9f1ae6d139c627a978ef56d7eafea0e0f4271167daa4c00bf7fda013"
        },
        {
          "path": "src/lib/plan-import-monthly-curve.mjs",
          "sha256": "6ce785f9c24c47f0e291b0bac40bd96a691fae68a309e4cb7a1917db31f9e6b6"
        },
        {
          "path": "src/lib/plan-import-ooxml.mjs",
          "sha256": "a146b9b300086bd8f44af6549d75611f7ac542a6c6c2f9eddf099cd8fc0f9251"
        },
        {
          "path": "src/lib/plan-import-policy.mjs",
          "sha256": "f2d73b8c58df571fb0dc6e5d76e2fb5d60daffa6ed6a41bc2be3c7e536458696"
        },
        {
          "path": "src/lib/plan-import-store.mjs",
          "sha256": "455c06e64301b2679e1278cc288cd4b06c875a222339e15c6720c58bc1f011c2"
        },
        {
          "path": "src/lib/plan-measurement-policy.mjs",
          "sha256": "3d6b0bce58a7f89612878310f534d8cf02f6a222c778cd4294b415c1f61157b7"
        },
        {
          "path": "src/lib/plan-measurement-source.mjs",
          "sha256": "ecf33b67a333d8ce73bfb51610218a1658cd94a26b62eb35d2290b795f826f36"
        },
        {
          "path": "src/lib/private-biometric-analyzer.mjs",
          "sha256": "36f96c5d9d4c25ee8723187a310a76682b07a888f6332712c48ab99ff5e2abd8"
        },
        {
          "path": "src/lib/private-image-upload.mjs",
          "sha256": "1eaeda2fa79104cfe00a8736c466d8568d216c8682bd44031d3bf9d4f35e3f60"
        },
        {
          "path": "src/lib/procurement-quantity.js",
          "sha256": "53439844051cc1dbd679220d695e60e54bc1629b2f1ddb33fc125981da9326b3"
        },
        {
          "path": "src/lib/progress-measurement-quantity.js",
          "sha256": "e194f461d482dec666c090a19aabbd3498bc08964cbbbc31b8db6eeb39cb1be2"
        },
        {
          "path": "src/lib/site-register-policy.mjs",
          "sha256": "d529c4f2225e0ec851ef7df60f8c5b182a88b384958ebfd15b194683d1590434"
        },
        {
          "path": "src/lib/site-register-store.mjs",
          "sha256": "6b744c86f47dbb6dc081132675888615d76421701f96151b00646b5e1d2529c6"
        },
        {
          "path": "src/lib/task-progress-measurement.js",
          "sha256": "10361a0e30df34f9c90f915d9fdbfc0912a610ab3ce851503c32549b7049a8b9"
        },
        {
          "path": "src/lib/video-audio-extractor.mjs",
          "sha256": "0c85dfd39c10fdb782eca4fe57dc665c29bd7211ab7aba0dda3f8945abcb1988"
        },
        {
          "path": "src/lib/video-frame-extractor.mjs",
          "sha256": "33425a184cf097884982c43a90e3b515726027adbeb51c2cdbfc794e79dee6e6"
        },
        {
          "path": "src/lib/voice-progress-draft.mjs",
          "sha256": "56ddbad919a1ad77e13105f1a125914674c1a149a88e28fa2f8b831a4d14bd69"
        },
        {
          "path": "src/lib/whatsapp/field-worker-intent-policy.js",
          "sha256": "0fdf205af1c2185a16f99c4f1aaba6c36d95722ea914915a0eefe6a10d443ef9"
        },
        {
          "path": "src/lib/whatsapp/obra-intent-policy.js",
          "sha256": "cd01054ba81be6552f58dc91758e08166ea099482f28355cae570d15f3ccf8da"
        },
        {
          "path": "src/lib/whatsapp/operational-proposal-decision-policy.js",
          "sha256": "996ed641c090267679ce0fc3cb7a23f39b31ce88e761135feb0dd0c852eb74fc"
        },
        {
          "path": "src/lib/whatsapp/project-workspace-profile.js",
          "sha256": "e13473baa4ca5b4dc9851bb202f400ba174ccbfce2589be65ce8458aafa998f4"
        },
        {
          "path": "src/lib/whatsapp/template-review-policy.js",
          "sha256": "0ec4a7e544f8c2c2409d2c84ecf69fab663334dd5a5cef0ee1b1cbec82de0a08"
        },
        {
          "path": "src/lib/whatsapp/tenant-workspace-policy.js",
          "sha256": "d3416ff993fbfd70f75404166cdcd8f0b9b2e5a6741f6cde03725aab16abcd5e"
        },
        {
          "path": "src/lib/worker-channel-consent-policy.mjs",
          "sha256": "95c8393e7f2603694c5c15cfe34c9eead43007927aed0d5b633859b14c7448a9"
        },
        {
          "path": "src/lib/worker-channel-identity.mjs",
          "sha256": "1cddd58a2cd656abaca25752481fe1ca760d2bcd385a0fffbe0e685c15d59e0a"
        },
        {
          "path": "src/lib/workspace-policy.mjs",
          "sha256": "ba51cc5c4a6e4f5ce1c9382cae2c8ea903ab4373668c05384c7f1e9253c7041e"
        },
        {
          "path": "src/lib/workspace-runtime.mjs",
          "sha256": "bc9daa76b5eb6d66ea7a31c1efd9dbb17f39ecae53a89a684f83f18017606731"
        },
        {
          "path": "src/lib/workspace-store.mjs",
          "sha256": "5f25092121a31a06eefa59d69866db82fa3cd28afdcbd0e066e52d916478bc50"
        },
        {
          "path": "tests/fixtures/meta-kyc-outbound-baseline-b572.json",
          "sha256": "01f9954c58a6381be9f2917d1820f943da54c53542f4724570ca92267cf663e6"
        },
        {
          "path": "tests/fixtures/own-company-meta.mjs",
          "sha256": "48f9b9d63552285d3df733e0d173a19b0166d815d6b0259001876fef993092fa"
        }
      ]
    },
    {
      "family": "ORGANIZATION_USAGE",
      "previousExternalImports": [
        "@babel/parser",
        "ffmpeg-static",
        "node:assert/strict",
        "node:child_process",
        "node:crypto",
        "node:fs",
        "node:fs/promises",
        "node:os",
        "node:path",
        "node:perf_hooks",
        "node:url",
        "node:zlib",
        "pg",
        "saxes",
        "yauzl"
      ],
      "currentFiles": [
        "package-lock.json",
        "package.json",
        "scripts/fixtures/canonical-participant-kyc.mjs",
        "scripts/lib/company-channel-disposable-fixture.mjs",
        "scripts/lib/disposable-postgres-cleanup.mjs",
        "scripts/verify-organization-usage-postgres.mjs",
        "src/app/(identity)/cuenta/private-bank-account-format.mjs",
        "src/lib/bindx-civil-data-client.mjs",
        "src/lib/brand-assets.mjs",
        "src/lib/canonical-invited-account.mjs",
        "src/lib/company-channel-connection.mjs",
        "src/lib/company-channel-kyc.mjs",
        "src/lib/company-channel-routing.mjs",
        "src/lib/company-channel-schema.mjs",
        "src/lib/company-entitlement.mjs",
        "src/lib/company-onboarding-policy.mjs",
        "src/lib/company-phone-format.mjs",
        "src/lib/employee-intake-channel-continuity.mjs",
        "src/lib/field-hours-report.mjs",
        "src/lib/field-media-privacy.mjs",
        "src/lib/field-media.mjs",
        "src/lib/field-operations-policy.mjs",
        "src/lib/field-operations-store.mjs",
        "src/lib/field-overtime-policy.mjs",
        "src/lib/field-overtime-store.mjs",
        "src/lib/field-report-feedback.mjs",
        "src/lib/field-shift-summary.mjs",
        "src/lib/geo.js",
        "src/lib/legacy-access-boundary.js",
        "src/lib/material-inventory.mjs",
        "src/lib/meta-callback-diagnostics.mjs",
        "src/lib/meta-channel-binding.mjs",
        "src/lib/meta-cloud-protocol.mjs",
        "src/lib/meta-customer-app-projection.mjs",
        "src/lib/meta-customer-callback.mjs",
        "src/lib/meta-customer-coexistence.mjs",
        "src/lib/meta-customer-credentials.mjs",
        "src/lib/meta-customer-inbox-review.mjs",
        "src/lib/meta-customer-outbound.mjs",
        "src/lib/meta-customer-permissions.mjs",
        "src/lib/meta-customer-processing.mjs",
        "src/lib/meta-customer-provider.mjs",
        "src/lib/meta-customer-templates.mjs",
        "src/lib/meta-development-pilot-policy.mjs",
        "src/lib/meta-employee-intake.mjs",
        "src/lib/meta-field-bridge.mjs",
        "src/lib/meta-field-conversation.mjs",
        "src/lib/meta-kyc-challenge.mjs",
        "src/lib/meta-kyc-conversation.mjs",
        "src/lib/meta-kyc-current-image.mjs",
        "src/lib/meta-kyc-identity.mjs",
        "src/lib/meta-kyc-rejection-policy.mjs",
        "src/lib/meta-kyc-rejection.mjs",
        "src/lib/meta-own-company-policy.mjs",
        "src/lib/meta-plan-import-conversation.mjs",
        "src/lib/meta-plan-import-origin.mjs",
        "src/lib/meta-plan-import-transport.mjs",
        "src/lib/meta-test-recipient-binding.mjs",
        "src/lib/meta-whatsapp-transport.mjs",
        "src/lib/organization-resource-usage-policy.mjs",
        "src/lib/organization-resource-usage-store.mjs",
        "src/lib/organization-usage-http.mjs",
        "src/lib/organization-usage-policy.mjs",
        "src/lib/organization-usage-store.mjs",
        "src/lib/participant-account-discovery.mjs",
        "src/lib/participant-admission.mjs",
        "src/lib/participant-analysis-consent.mjs",
        "src/lib/participant-approved-identity.mjs",
        "src/lib/participant-bank-account.mjs",
        "src/lib/participant-bank-format.mjs",
        "src/lib/participant-bank-vault.mjs",
        "src/lib/participant-channel-kyc.mjs",
        "src/lib/participant-civil-policy.mjs",
        "src/lib/participant-civil-store.mjs",
        "src/lib/participant-kyc-chat-attempt.mjs",
        "src/lib/participant-kyc-chat-closure.mjs",
        "src/lib/participant-kyc-chat-copy.mjs",
        "src/lib/participant-kyc-image-set.mjs",
        "src/lib/participant-kyc-notice-links.mjs",
        "src/lib/participant-kyc-preanalysis-policy.mjs",
        "src/lib/participant-onboarding-authority.mjs",
        "src/lib/participant-onboarding-current-kyc.mjs",
        "src/lib/participant-onboarding-delivery.mjs",
        "src/lib/participant-onboarding-intent.mjs",
        "src/lib/participant-onboarding-policy.mjs",
        "src/lib/participant-onboarding-reactive.mjs",
        "src/lib/participant-policy.mjs",
        "src/lib/participant-store.mjs",
        "src/lib/participant-verified-office.mjs",
        "src/lib/person-worksite-journey.mjs",
        "src/lib/pilot-media.mjs",
        "src/lib/plan-baseline-policy.mjs",
        "src/lib/plan-import-analyzer.mjs",
        "src/lib/plan-import-cyp-curve.mjs",
        "src/lib/plan-import-document-curve.mjs",
        "src/lib/plan-import-monthly-curve.mjs",
        "src/lib/plan-import-ooxml.mjs",
        "src/lib/plan-import-policy.mjs",
        "src/lib/plan-import-store.mjs",
        "src/lib/plan-measurement-policy.mjs",
        "src/lib/plan-measurement-source.mjs",
        "src/lib/private-image-upload.mjs",
        "src/lib/procurement-quantity.js",
        "src/lib/progress-measurement-quantity.js",
        "src/lib/site-register-policy.mjs",
        "src/lib/site-register-store.mjs",
        "src/lib/task-progress-measurement.js",
        "src/lib/video-audio-extractor.mjs",
        "src/lib/video-frame-extractor.mjs",
        "src/lib/voice-progress-draft.mjs",
        "src/lib/whatsapp/field-worker-intent-policy.js",
        "src/lib/whatsapp/obra-intent-policy.js",
        "src/lib/whatsapp/operational-proposal-decision-policy.js",
        "src/lib/whatsapp/project-workspace-profile.js",
        "src/lib/whatsapp/template-review-policy.js",
        "src/lib/whatsapp/tenant-workspace-policy.js",
        "src/lib/worker-channel-consent-policy.mjs",
        "src/lib/worker-channel-identity.mjs",
        "src/lib/workspace-policy.mjs",
        "src/lib/workspace-store.mjs",
        "tests/fixtures/plan-import-ooxml-synthetic.mjs"
      ],
      "externalImports": [
        "@babel/parser",
        "ffmpeg-static",
        "node:assert/strict",
        "node:child_process",
        "node:crypto",
        "node:fs",
        "node:fs/promises",
        "node:os",
        "node:path",
        "node:perf_hooks",
        "node:url",
        "node:zlib",
        "pg",
        "saxes",
        "yauzl"
      ],
      "currentManifest": [
        {
          "path": "package-lock.json",
          "sha256": "dfa3ff3914547f35828a0b697e6007c6cf856546be86bf8a7810cdce59e60449"
        },
        {
          "path": "package.json",
          "sha256": "6b7918c67edddee946d9455aa71913987f54f8abe441e0c3e560560a89061c4d"
        },
        {
          "path": "scripts/fixtures/canonical-participant-kyc.mjs",
          "sha256": "09928b417f3319d76ba34fac91f89a1888f3a8e613bfde3775cac424cc441ccb"
        },
        {
          "path": "scripts/lib/company-channel-disposable-fixture.mjs",
          "sha256": "717d87a6fb1dd7f6a8b2a2d19cd3b2fee652d536e958bd833bf8431c31076138"
        },
        {
          "path": "scripts/lib/disposable-postgres-cleanup.mjs",
          "sha256": "df8d9f36b79cdd5f2d940c0dc4bbc88acbb0bec6e66c9ee5ae93ad5c6e4ab89e"
        },
        {
          "path": "scripts/verify-organization-usage-postgres.mjs",
          "sha256": "c75c023c6e8de0104b56e259545401e891d88de362bca9f444717b58c149c52b"
        },
        {
          "path": "src/app/(identity)/cuenta/private-bank-account-format.mjs",
          "sha256": "4dcf7f2de2f49f97f155e14128b20815f538d659d5e82806fa45a18d541adeea"
        },
        {
          "path": "src/lib/bindx-civil-data-client.mjs",
          "sha256": "20da64b82d14fb3d4055b9852ed8712d33b01d1bc9f50709cb55084c7d0433a2"
        },
        {
          "path": "src/lib/brand-assets.mjs",
          "sha256": "7da49f3f4d8c2f9d2cce36cc2902b5f46e044b98e67bace09e240f5b007fd4c1"
        },
        {
          "path": "src/lib/canonical-invited-account.mjs",
          "sha256": "94652997c4e6717e875041c859de9caaaeeabd9d166666d9dfbf899c51d98c7b"
        },
        {
          "path": "src/lib/company-channel-connection.mjs",
          "sha256": "f2c44860383bb49df67f7999fbe3c0a5aa57c91ebbde0cf9a3b5b367784f2c45"
        },
        {
          "path": "src/lib/company-channel-kyc.mjs",
          "sha256": "5b46276ad3aa5d656a0027be4a6bf58aa3fba4f557dd86e0c13d0d5b0cecba85"
        },
        {
          "path": "src/lib/company-channel-routing.mjs",
          "sha256": "9ed740dbb4ae1ca7d44171f176f0001d824b056a0f17a8f58ed1ea5a5a2e2f68"
        },
        {
          "path": "src/lib/company-channel-schema.mjs",
          "sha256": "96c0385fa3b6d60c8d1f92ca38dcdf32e7779f1200512806bf6d220e6be57022"
        },
        {
          "path": "src/lib/company-entitlement.mjs",
          "sha256": "65d41dfb796ef12be38b1220a99ccd3dfe277419a5e5a27e125beb29fe7e2cde"
        },
        {
          "path": "src/lib/company-onboarding-policy.mjs",
          "sha256": "cf557c7837d6264c78207028c668f8f8a2218f9632a8092cfcb8692ef11053d1"
        },
        {
          "path": "src/lib/company-phone-format.mjs",
          "sha256": "67b31114f517253961c6a774210f157867b1e2e318e6b700089eef03ef1b7209"
        },
        {
          "path": "src/lib/employee-intake-channel-continuity.mjs",
          "sha256": "59dffe3800f26cd979bd12c4cff0010ca72779e1dc62030a6f0117b6ef3fb64d"
        },
        {
          "path": "src/lib/field-hours-report.mjs",
          "sha256": "b55b767d61278bde31cb9ce4ef64faee5320fc7fe1b1bcc54559860bb4576731"
        },
        {
          "path": "src/lib/field-media-privacy.mjs",
          "sha256": "5ec7fc7dd71f9303a42bfb4889e02541de8a3cf356e8e1203cfeeefd56220515"
        },
        {
          "path": "src/lib/field-media.mjs",
          "sha256": "940e681d1430fc211093b16f5407637fcd31d270a3d99234f748fe7db73cc0bb"
        },
        {
          "path": "src/lib/field-operations-policy.mjs",
          "sha256": "01eb863d7db4446eeb8dab990d7e0602a19d581d5615a0b1e5d50c02f3d70173"
        },
        {
          "path": "src/lib/field-operations-store.mjs",
          "sha256": "dbf96641349efae61808a2d66a02d491ad06e2226885e6efa928dba53ce5034e"
        },
        {
          "path": "src/lib/field-overtime-policy.mjs",
          "sha256": "76848bd0861d6cecccb682b774599f03d3fe1322eed3cc58f5f1db5d9b1e24f8"
        },
        {
          "path": "src/lib/field-overtime-store.mjs",
          "sha256": "f29b67fff29949d5a8b14c4aed3f484ae1ce16d2ed42de486a6d5868361b1526"
        },
        {
          "path": "src/lib/field-report-feedback.mjs",
          "sha256": "70b966ae5f382abe6b5446daf1092c3f66b8f46f80ce5a0c006cffeba1cfa64c"
        },
        {
          "path": "src/lib/field-shift-summary.mjs",
          "sha256": "41f47aa7a0826ba1fe29b554c7575ec60c9861f0c18c863f06e8c3d00cb0f83c"
        },
        {
          "path": "src/lib/geo.js",
          "sha256": "fa47424540f953adf56e0c3069780c0c8876a2f69e944a80caddefa974b5b6bf"
        },
        {
          "path": "src/lib/legacy-access-boundary.js",
          "sha256": "e1af7e83dac3c18bcf3b235d111d936d6dd6167925a3e1459d70a33913035370"
        },
        {
          "path": "src/lib/material-inventory.mjs",
          "sha256": "4b599d273c4cadcdf76202554757583152da8c11b0a754be386bffb830f0c65b"
        },
        {
          "path": "src/lib/meta-callback-diagnostics.mjs",
          "sha256": "b16fcfbeabe02b119d0337485504490a0c8e60363e841e378ae4c7722816d3bc"
        },
        {
          "path": "src/lib/meta-channel-binding.mjs",
          "sha256": "0ba9e9de3b6dcca46524ab2df22236dbbcd5be5e6cef571df1ec47a01633672e"
        },
        {
          "path": "src/lib/meta-cloud-protocol.mjs",
          "sha256": "c6d5f1e1b4119dd2529860e3bd61a1b22d602f71ad301b2f04cec3ab4bbbed3c"
        },
        {
          "path": "src/lib/meta-customer-app-projection.mjs",
          "sha256": "7b4b95712f143555a0e23b8ac98fc0e1d2f108e9fbefb4e861d20d9b464ef003"
        },
        {
          "path": "src/lib/meta-customer-callback.mjs",
          "sha256": "da90e3ed097c287a7c080d05daf5e4b0c0bb82544d2f7dab4cb1ee99880c3fd0"
        },
        {
          "path": "src/lib/meta-customer-coexistence.mjs",
          "sha256": "30f5b950284b953fa853b37514cd768660cfc505a6e979ec51c947b6edce40da"
        },
        {
          "path": "src/lib/meta-customer-credentials.mjs",
          "sha256": "44a05a0b46417de835eb289882b0b2c6d71158f207c16c48228f1ac4b67cca0f"
        },
        {
          "path": "src/lib/meta-customer-inbox-review.mjs",
          "sha256": "250bd69c487dc8dffed5500c1ca0f9adb77843352902c41e4a63da7656bf2eaa"
        },
        {
          "path": "src/lib/meta-customer-outbound.mjs",
          "sha256": "84a249b3777d3be843b20b09d0c6cd81b6fab7415dc22f124477d87475eead09"
        },
        {
          "path": "src/lib/meta-customer-permissions.mjs",
          "sha256": "ce3671bd46af8e487c45319facbca8e6b522620fd16ee3163e5048b5ecb6585d"
        },
        {
          "path": "src/lib/meta-customer-processing.mjs",
          "sha256": "e4a52dbd2ce86793b66c4af5963c288b13d7b2b2f656c4c6f795bcac8074f4ad"
        },
        {
          "path": "src/lib/meta-customer-provider.mjs",
          "sha256": "b6cc572fb68ab4cb653ccee30cea754a6273b5631d13e61dd2c2f65535aa287f"
        },
        {
          "path": "src/lib/meta-customer-templates.mjs",
          "sha256": "ca9e491b8b1b4c25c89585408cb53eae13e2423fdf48a93deed0846126e1c46c"
        },
        {
          "path": "src/lib/meta-development-pilot-policy.mjs",
          "sha256": "6f3a854898ea28d108341f35fe7f5f23facf3d574e586b96a2343a8038cc8c79"
        },
        {
          "path": "src/lib/meta-employee-intake.mjs",
          "sha256": "77dc9f64814f995d21084606d705f26af65de4f4f9bea25a0f37a0d8dba1b928"
        },
        {
          "path": "src/lib/meta-field-bridge.mjs",
          "sha256": "79c961cf91f988e5d913cfb241a887c26a78d49e04ebf2c5fbb2bf6a74bc809b"
        },
        {
          "path": "src/lib/meta-field-conversation.mjs",
          "sha256": "2da5b4a58e4f62a912d4df4bd93574c9907c6561123fe5ffabdd12420b72047f"
        },
        {
          "path": "src/lib/meta-kyc-challenge.mjs",
          "sha256": "f5a03ec770e6d85de095393bf38c331c0803a7fe3c7f1b72a2addd9cac7484eb"
        },
        {
          "path": "src/lib/meta-kyc-conversation.mjs",
          "sha256": "75870a6359385ae83df0d154b57c3f6738f2bde62fbe4974da7e38e5b0de2902"
        },
        {
          "path": "src/lib/meta-kyc-current-image.mjs",
          "sha256": "03ef3966025f520b373e937a6230f846185f3b4845830da5a38c0d8f02e155c2"
        },
        {
          "path": "src/lib/meta-kyc-identity.mjs",
          "sha256": "295f87ecb3b4586313a4f9c48a2d5c9acf8fa263682d99d44a966be243af2319"
        },
        {
          "path": "src/lib/meta-kyc-rejection-policy.mjs",
          "sha256": "e6c96aba8077d75e152f45dc49fe32d41e103658d4bff4281c8c8a98e3fff0c1"
        },
        {
          "path": "src/lib/meta-kyc-rejection.mjs",
          "sha256": "5477adafd994a54c9e7bbcc196b6af4fbe0b9cc03ab563775b8258290e31f3d0"
        },
        {
          "path": "src/lib/meta-own-company-policy.mjs",
          "sha256": "7db3875cd0f31fec077f4d9a4f8875be1ddf4a5772acff4559069ae950ff0821"
        },
        {
          "path": "src/lib/meta-plan-import-conversation.mjs",
          "sha256": "6f3c261cb2cde943e0202ab5097d664958f5702975cdf5914aeac35e5a1bac1c"
        },
        {
          "path": "src/lib/meta-plan-import-origin.mjs",
          "sha256": "cdb619d1709a982323c9892383def1428db2ade771babdb18e4032b3535d953e"
        },
        {
          "path": "src/lib/meta-plan-import-transport.mjs",
          "sha256": "e42f48f0175dd697bac3de61d7d9893d35c2b1696c1ae276a4698eb3c36a4634"
        },
        {
          "path": "src/lib/meta-test-recipient-binding.mjs",
          "sha256": "2aea6f5815bd2d90fe891b45a79b48d339a3eebc681ac40b3347244e546c4b66"
        },
        {
          "path": "src/lib/meta-whatsapp-transport.mjs",
          "sha256": "f99569c7f587e9be1268aa254d2368226346a7ebf7e48fa6ca63a0064cf41310"
        },
        {
          "path": "src/lib/organization-resource-usage-policy.mjs",
          "sha256": "089ac1ee2ca6afd30aab1d0abd38274698ca56991d1c5225ea8e44c8b9fdc449"
        },
        {
          "path": "src/lib/organization-resource-usage-store.mjs",
          "sha256": "869502cd3b11d1625c4dbb843ebc53d92e43dd21d13fcb53f22538684ec4f2ef"
        },
        {
          "path": "src/lib/organization-usage-http.mjs",
          "sha256": "3c6ac61cd20a9743926e159aaf2662f1963ec56d8ca89c86f3a3ffdbd5bf2f20"
        },
        {
          "path": "src/lib/organization-usage-policy.mjs",
          "sha256": "94997530d6c1fd420f0233172b07f8ba7dd7546a2ac9af75eaa30736400237ae"
        },
        {
          "path": "src/lib/organization-usage-store.mjs",
          "sha256": "9497c32b76ffda1d5456267d4fcdc90b674618df1d60bd84dbbd7bc3b2827347"
        },
        {
          "path": "src/lib/participant-account-discovery.mjs",
          "sha256": "11b37ca397fdb195aac7addc1c16842fb28a9c83a73a82a57bf2791ed3038738"
        },
        {
          "path": "src/lib/participant-admission.mjs",
          "sha256": "2cbb466e49d742cd23da1bb85a4e89b7e411dc724c8d1f2eb66b39717f283dd9"
        },
        {
          "path": "src/lib/participant-analysis-consent.mjs",
          "sha256": "7f7d371914d1e46ac799cd1683afdc0418186c15a20156e697ecd879c81bf8c1"
        },
        {
          "path": "src/lib/participant-approved-identity.mjs",
          "sha256": "834d81e70cedbd967ff84d880ea9d697c2168d2220fb23d9eb14c1aba1cdbbf1"
        },
        {
          "path": "src/lib/participant-bank-account.mjs",
          "sha256": "29980527a6eda3bbc0125098a4b616082034a71fb1afb772ff87f476bc0ce981"
        },
        {
          "path": "src/lib/participant-bank-format.mjs",
          "sha256": "ebbb206a14eaac57230b53ec1afae99c4be60c8739baf0d1d047d4a47ba464db"
        },
        {
          "path": "src/lib/participant-bank-vault.mjs",
          "sha256": "06e990ab79c896628756f3c74a50dcc7e8062f4fa296f56a31e4150b5badc16a"
        },
        {
          "path": "src/lib/participant-channel-kyc.mjs",
          "sha256": "2ac9414429238162a9b16d4adea421df0bff9fb93ea4fbf2f9d6677f2659fb2d"
        },
        {
          "path": "src/lib/participant-civil-policy.mjs",
          "sha256": "e180a64c788d6cd20e766cb4fd32dbba1c7cb3954c01405ac8675ec023eef278"
        },
        {
          "path": "src/lib/participant-civil-store.mjs",
          "sha256": "5f440c0c76ca67b87a7e5d4e90e7a48f18ea3603b16434b35beeddd3bdf168a4"
        },
        {
          "path": "src/lib/participant-kyc-chat-attempt.mjs",
          "sha256": "d3f0a65f866fa027ee008963fcb6ffcad0cd33de94cace7603cf40bc78c21aeb"
        },
        {
          "path": "src/lib/participant-kyc-chat-closure.mjs",
          "sha256": "4a6a368910de95582c2baabc70bab7f4b4afa4413e8ebdb75a1e8b867c098a19"
        },
        {
          "path": "src/lib/participant-kyc-chat-copy.mjs",
          "sha256": "d886219584d5e8b9d9db1ad16a36c726f6982fa0e8400c3be51af2623574ab96"
        },
        {
          "path": "src/lib/participant-kyc-image-set.mjs",
          "sha256": "190ce2560286a58d42668da7b912aeabcfa76ee14086503bf1609304e5f0e8fb"
        },
        {
          "path": "src/lib/participant-kyc-notice-links.mjs",
          "sha256": "1a10acf655796ebf4f08175158ea3dc2a1d0a0fdb3d13bb88573d6a0e5f4375e"
        },
        {
          "path": "src/lib/participant-kyc-preanalysis-policy.mjs",
          "sha256": "8c5286a0a5d41364e92e60f2ce2ba96caccc8667960f966b5caead37acafab49"
        },
        {
          "path": "src/lib/participant-onboarding-authority.mjs",
          "sha256": "dad5d9fd0a61c493ff02331d5333982627cdeb3a7addb74a3c86d44da931f916"
        },
        {
          "path": "src/lib/participant-onboarding-current-kyc.mjs",
          "sha256": "232fecca4f6cf775e5151ec460560e0c1abd6646dc3c532140cabe26dfb42119"
        },
        {
          "path": "src/lib/participant-onboarding-delivery.mjs",
          "sha256": "615592cc1a6215e24c48e8873a27211421853f99ca9093e6f490f77532b3d013"
        },
        {
          "path": "src/lib/participant-onboarding-intent.mjs",
          "sha256": "07114f6066e10617357c4e5d8e2db2b9dc846e5f4cffbc5aef09f2b7bfada9de"
        },
        {
          "path": "src/lib/participant-onboarding-policy.mjs",
          "sha256": "59409797ce3e13b7cfe63fe21d8d7e2c848ee49e0766015939242a9f43687c03"
        },
        {
          "path": "src/lib/participant-onboarding-reactive.mjs",
          "sha256": "666a8c27f3ab7d6fdbe66c91f22ace4e25b04b98e865f401d19c72212916104d"
        },
        {
          "path": "src/lib/participant-policy.mjs",
          "sha256": "7f3969ab1ebac5f01696149d76337199eb64c2fd09015c44c07e8b7e7088d62f"
        },
        {
          "path": "src/lib/participant-store.mjs",
          "sha256": "2296495e366b9ea0c2511066584e93ddf1cff51b5eefd05c6121d2143d78f5c9"
        },
        {
          "path": "src/lib/participant-verified-office.mjs",
          "sha256": "4922f392490aa6d49b8a8a45a56ac0b03831a8ad2efe89ce1e3adfd77d603d89"
        },
        {
          "path": "src/lib/person-worksite-journey.mjs",
          "sha256": "d3174df793150125c0b6a5d9f37d56336e72cab1efb43a361065b78ac54c210a"
        },
        {
          "path": "src/lib/pilot-media.mjs",
          "sha256": "55e35757cea03c312df68cebad100ee8b7d904b418eca9082359ea34e68f8fa9"
        },
        {
          "path": "src/lib/plan-baseline-policy.mjs",
          "sha256": "e9217a41a87057f437439420d56f3b7a0f973ae37c250c07b335634fef308560"
        },
        {
          "path": "src/lib/plan-import-analyzer.mjs",
          "sha256": "0427c7fbdf0ba27b07c328661e52731c996e0a7b5f0749dcc6207410b28c52bb"
        },
        {
          "path": "src/lib/plan-import-cyp-curve.mjs",
          "sha256": "7e1d6c9d87df5e74e0a340361e1e66fdf0cfd5c82f1e44030ba2e85b5fa9c342"
        },
        {
          "path": "src/lib/plan-import-document-curve.mjs",
          "sha256": "7f63d62b9f1ae6d139c627a978ef56d7eafea0e0f4271167daa4c00bf7fda013"
        },
        {
          "path": "src/lib/plan-import-monthly-curve.mjs",
          "sha256": "6ce785f9c24c47f0e291b0bac40bd96a691fae68a309e4cb7a1917db31f9e6b6"
        },
        {
          "path": "src/lib/plan-import-ooxml.mjs",
          "sha256": "a146b9b300086bd8f44af6549d75611f7ac542a6c6c2f9eddf099cd8fc0f9251"
        },
        {
          "path": "src/lib/plan-import-policy.mjs",
          "sha256": "f2d73b8c58df571fb0dc6e5d76e2fb5d60daffa6ed6a41bc2be3c7e536458696"
        },
        {
          "path": "src/lib/plan-import-store.mjs",
          "sha256": "455c06e64301b2679e1278cc288cd4b06c875a222339e15c6720c58bc1f011c2"
        },
        {
          "path": "src/lib/plan-measurement-policy.mjs",
          "sha256": "3d6b0bce58a7f89612878310f534d8cf02f6a222c778cd4294b415c1f61157b7"
        },
        {
          "path": "src/lib/plan-measurement-source.mjs",
          "sha256": "ecf33b67a333d8ce73bfb51610218a1658cd94a26b62eb35d2290b795f826f36"
        },
        {
          "path": "src/lib/private-image-upload.mjs",
          "sha256": "1eaeda2fa79104cfe00a8736c466d8568d216c8682bd44031d3bf9d4f35e3f60"
        },
        {
          "path": "src/lib/procurement-quantity.js",
          "sha256": "53439844051cc1dbd679220d695e60e54bc1629b2f1ddb33fc125981da9326b3"
        },
        {
          "path": "src/lib/progress-measurement-quantity.js",
          "sha256": "e194f461d482dec666c090a19aabbd3498bc08964cbbbc31b8db6eeb39cb1be2"
        },
        {
          "path": "src/lib/site-register-policy.mjs",
          "sha256": "d529c4f2225e0ec851ef7df60f8c5b182a88b384958ebfd15b194683d1590434"
        },
        {
          "path": "src/lib/site-register-store.mjs",
          "sha256": "6b744c86f47dbb6dc081132675888615d76421701f96151b00646b5e1d2529c6"
        },
        {
          "path": "src/lib/task-progress-measurement.js",
          "sha256": "10361a0e30df34f9c90f915d9fdbfc0912a610ab3ce851503c32549b7049a8b9"
        },
        {
          "path": "src/lib/video-audio-extractor.mjs",
          "sha256": "0c85dfd39c10fdb782eca4fe57dc665c29bd7211ab7aba0dda3f8945abcb1988"
        },
        {
          "path": "src/lib/video-frame-extractor.mjs",
          "sha256": "33425a184cf097884982c43a90e3b515726027adbeb51c2cdbfc794e79dee6e6"
        },
        {
          "path": "src/lib/voice-progress-draft.mjs",
          "sha256": "56ddbad919a1ad77e13105f1a125914674c1a149a88e28fa2f8b831a4d14bd69"
        },
        {
          "path": "src/lib/whatsapp/field-worker-intent-policy.js",
          "sha256": "0fdf205af1c2185a16f99c4f1aaba6c36d95722ea914915a0eefe6a10d443ef9"
        },
        {
          "path": "src/lib/whatsapp/obra-intent-policy.js",
          "sha256": "cd01054ba81be6552f58dc91758e08166ea099482f28355cae570d15f3ccf8da"
        },
        {
          "path": "src/lib/whatsapp/operational-proposal-decision-policy.js",
          "sha256": "996ed641c090267679ce0fc3cb7a23f39b31ce88e761135feb0dd0c852eb74fc"
        },
        {
          "path": "src/lib/whatsapp/project-workspace-profile.js",
          "sha256": "e13473baa4ca5b4dc9851bb202f400ba174ccbfce2589be65ce8458aafa998f4"
        },
        {
          "path": "src/lib/whatsapp/template-review-policy.js",
          "sha256": "0ec4a7e544f8c2c2409d2c84ecf69fab663334dd5a5cef0ee1b1cbec82de0a08"
        },
        {
          "path": "src/lib/whatsapp/tenant-workspace-policy.js",
          "sha256": "d3416ff993fbfd70f75404166cdcd8f0b9b2e5a6741f6cde03725aab16abcd5e"
        },
        {
          "path": "src/lib/worker-channel-consent-policy.mjs",
          "sha256": "95c8393e7f2603694c5c15cfe34c9eead43007927aed0d5b633859b14c7448a9"
        },
        {
          "path": "src/lib/worker-channel-identity.mjs",
          "sha256": "1cddd58a2cd656abaca25752481fe1ca760d2bcd385a0fffbe0e685c15d59e0a"
        },
        {
          "path": "src/lib/workspace-policy.mjs",
          "sha256": "ba51cc5c4a6e4f5ce1c9382cae2c8ea903ab4373668c05384c7f1e9253c7041e"
        },
        {
          "path": "src/lib/workspace-store.mjs",
          "sha256": "5f25092121a31a06eefa59d69866db82fa3cd28afdcbd0e066e52d916478bc50"
        },
        {
          "path": "tests/fixtures/plan-import-ooxml-synthetic.mjs",
          "sha256": "4157135abf5798807025a18abd121c7fdbc7be2a5e0099084bbb02ea28f20931"
        }
      ]
    },
    {
      "family": "KYC_REPLY_FEEDBACK",
      "previousExternalImports": [
        "@babel/parser",
        "ffmpeg-static",
        "node:assert/strict",
        "node:child_process",
        "node:crypto",
        "node:fs",
        "node:fs/promises",
        "node:os",
        "node:path",
        "node:perf_hooks",
        "node:url",
        "node:zlib",
        "pg",
        "saxes",
        "yauzl"
      ],
      "currentFiles": [
        "package-lock.json",
        "package.json",
        "scripts/lib/company-channel-disposable-fixture.mjs",
        "scripts/lib/disposable-postgres-cleanup.mjs",
        "scripts/verify-company-kyc-rejection-feedback-postgres.mjs",
        "src/app/(identity)/cuenta/private-bank-account-format.mjs",
        "src/lib/bindx-civil-data-client.mjs",
        "src/lib/brand-assets.mjs",
        "src/lib/canonical-invited-account.mjs",
        "src/lib/company-channel-connection.mjs",
        "src/lib/company-channel-kyc.mjs",
        "src/lib/company-channel-routing.mjs",
        "src/lib/company-channel-schema.mjs",
        "src/lib/company-entitlement.mjs",
        "src/lib/company-onboarding-policy.mjs",
        "src/lib/company-phone-format.mjs",
        "src/lib/employee-intake-channel-continuity.mjs",
        "src/lib/field-hours-report.mjs",
        "src/lib/field-media-privacy.mjs",
        "src/lib/field-media.mjs",
        "src/lib/field-operations-policy.mjs",
        "src/lib/field-operations-store.mjs",
        "src/lib/field-overtime-policy.mjs",
        "src/lib/field-overtime-store.mjs",
        "src/lib/field-report-feedback.mjs",
        "src/lib/field-shift-summary.mjs",
        "src/lib/geo.js",
        "src/lib/legacy-access-boundary.js",
        "src/lib/material-inventory.mjs",
        "src/lib/meta-callback-diagnostics.mjs",
        "src/lib/meta-channel-binding.mjs",
        "src/lib/meta-cloud-protocol.mjs",
        "src/lib/meta-customer-app-projection.mjs",
        "src/lib/meta-customer-callback.mjs",
        "src/lib/meta-customer-coexistence.mjs",
        "src/lib/meta-customer-credentials.mjs",
        "src/lib/meta-customer-inbox-review.mjs",
        "src/lib/meta-customer-outbound.mjs",
        "src/lib/meta-customer-permissions.mjs",
        "src/lib/meta-customer-processing.mjs",
        "src/lib/meta-customer-provider.mjs",
        "src/lib/meta-customer-templates.mjs",
        "src/lib/meta-development-pilot-policy.mjs",
        "src/lib/meta-employee-intake.mjs",
        "src/lib/meta-field-bridge.mjs",
        "src/lib/meta-field-conversation.mjs",
        "src/lib/meta-kyc-bridge.mjs",
        "src/lib/meta-kyc-challenge.mjs",
        "src/lib/meta-kyc-conversation.mjs",
        "src/lib/meta-kyc-current-image.mjs",
        "src/lib/meta-kyc-identity.mjs",
        "src/lib/meta-kyc-outbound.mjs",
        "src/lib/meta-kyc-rejection-policy.mjs",
        "src/lib/meta-kyc-rejection.mjs",
        "src/lib/meta-own-company-policy.mjs",
        "src/lib/meta-plan-import-conversation.mjs",
        "src/lib/meta-plan-import-origin.mjs",
        "src/lib/meta-plan-import-transport.mjs",
        "src/lib/meta-test-recipient-binding.mjs",
        "src/lib/meta-whatsapp-transport.mjs",
        "src/lib/organization-resource-usage-policy.mjs",
        "src/lib/organization-usage-policy.mjs",
        "src/lib/participant-account-discovery.mjs",
        "src/lib/participant-admission.mjs",
        "src/lib/participant-analysis-consent.mjs",
        "src/lib/participant-approved-identity.mjs",
        "src/lib/participant-bank-account.mjs",
        "src/lib/participant-bank-format.mjs",
        "src/lib/participant-bank-vault.mjs",
        "src/lib/participant-channel-kyc.mjs",
        "src/lib/participant-civil-policy.mjs",
        "src/lib/participant-civil-store.mjs",
        "src/lib/participant-kyc-chat-attempt.mjs",
        "src/lib/participant-kyc-chat-closure.mjs",
        "src/lib/participant-kyc-chat-copy.mjs",
        "src/lib/participant-kyc-image-set.mjs",
        "src/lib/participant-kyc-notice-links.mjs",
        "src/lib/participant-kyc-preanalysis-policy.mjs",
        "src/lib/participant-onboarding-authority.mjs",
        "src/lib/participant-onboarding-current-kyc.mjs",
        "src/lib/participant-onboarding-delivery.mjs",
        "src/lib/participant-onboarding-intent.mjs",
        "src/lib/participant-onboarding-policy.mjs",
        "src/lib/participant-onboarding-reactive.mjs",
        "src/lib/participant-policy.mjs",
        "src/lib/participant-store.mjs",
        "src/lib/participant-verified-office.mjs",
        "src/lib/person-worksite-journey.mjs",
        "src/lib/pilot-media.mjs",
        "src/lib/plan-baseline-policy.mjs",
        "src/lib/plan-import-cyp-curve.mjs",
        "src/lib/plan-import-document-curve.mjs",
        "src/lib/plan-import-monthly-curve.mjs",
        "src/lib/plan-import-ooxml.mjs",
        "src/lib/plan-import-policy.mjs",
        "src/lib/plan-import-store.mjs",
        "src/lib/plan-measurement-policy.mjs",
        "src/lib/plan-measurement-source.mjs",
        "src/lib/private-image-upload.mjs",
        "src/lib/procurement-quantity.js",
        "src/lib/progress-measurement-quantity.js",
        "src/lib/site-register-policy.mjs",
        "src/lib/site-register-store.mjs",
        "src/lib/task-progress-measurement.js",
        "src/lib/video-audio-extractor.mjs",
        "src/lib/video-frame-extractor.mjs",
        "src/lib/voice-progress-draft.mjs",
        "src/lib/whatsapp/field-worker-intent-policy.js",
        "src/lib/whatsapp/obra-intent-policy.js",
        "src/lib/whatsapp/operational-proposal-decision-policy.js",
        "src/lib/whatsapp/project-workspace-profile.js",
        "src/lib/whatsapp/template-review-policy.js",
        "src/lib/whatsapp/tenant-workspace-policy.js",
        "src/lib/worker-channel-consent-policy.mjs",
        "src/lib/worker-channel-identity.mjs",
        "src/lib/workspace-policy.mjs",
        "src/lib/workspace-store.mjs"
      ],
      "externalImports": [
        "@babel/parser",
        "ffmpeg-static",
        "node:assert/strict",
        "node:child_process",
        "node:crypto",
        "node:fs",
        "node:fs/promises",
        "node:os",
        "node:path",
        "node:perf_hooks",
        "node:url",
        "node:zlib",
        "pg",
        "saxes",
        "yauzl"
      ],
      "currentManifest": [
        {
          "path": "package-lock.json",
          "sha256": "dfa3ff3914547f35828a0b697e6007c6cf856546be86bf8a7810cdce59e60449"
        },
        {
          "path": "package.json",
          "sha256": "6b7918c67edddee946d9455aa71913987f54f8abe441e0c3e560560a89061c4d"
        },
        {
          "path": "scripts/lib/company-channel-disposable-fixture.mjs",
          "sha256": "717d87a6fb1dd7f6a8b2a2d19cd3b2fee652d536e958bd833bf8431c31076138"
        },
        {
          "path": "scripts/lib/disposable-postgres-cleanup.mjs",
          "sha256": "df8d9f36b79cdd5f2d940c0dc4bbc88acbb0bec6e66c9ee5ae93ad5c6e4ab89e"
        },
        {
          "path": "scripts/verify-company-kyc-rejection-feedback-postgres.mjs",
          "sha256": "a64cd0fa267dda98f9c9430327ab39f2cfec304fadc7fddb6c804ba41091ba32"
        },
        {
          "path": "src/app/(identity)/cuenta/private-bank-account-format.mjs",
          "sha256": "4dcf7f2de2f49f97f155e14128b20815f538d659d5e82806fa45a18d541adeea"
        },
        {
          "path": "src/lib/bindx-civil-data-client.mjs",
          "sha256": "20da64b82d14fb3d4055b9852ed8712d33b01d1bc9f50709cb55084c7d0433a2"
        },
        {
          "path": "src/lib/brand-assets.mjs",
          "sha256": "7da49f3f4d8c2f9d2cce36cc2902b5f46e044b98e67bace09e240f5b007fd4c1"
        },
        {
          "path": "src/lib/canonical-invited-account.mjs",
          "sha256": "94652997c4e6717e875041c859de9caaaeeabd9d166666d9dfbf899c51d98c7b"
        },
        {
          "path": "src/lib/company-channel-connection.mjs",
          "sha256": "f2c44860383bb49df67f7999fbe3c0a5aa57c91ebbde0cf9a3b5b367784f2c45"
        },
        {
          "path": "src/lib/company-channel-kyc.mjs",
          "sha256": "5b46276ad3aa5d656a0027be4a6bf58aa3fba4f557dd86e0c13d0d5b0cecba85"
        },
        {
          "path": "src/lib/company-channel-routing.mjs",
          "sha256": "9ed740dbb4ae1ca7d44171f176f0001d824b056a0f17a8f58ed1ea5a5a2e2f68"
        },
        {
          "path": "src/lib/company-channel-schema.mjs",
          "sha256": "96c0385fa3b6d60c8d1f92ca38dcdf32e7779f1200512806bf6d220e6be57022"
        },
        {
          "path": "src/lib/company-entitlement.mjs",
          "sha256": "65d41dfb796ef12be38b1220a99ccd3dfe277419a5e5a27e125beb29fe7e2cde"
        },
        {
          "path": "src/lib/company-onboarding-policy.mjs",
          "sha256": "cf557c7837d6264c78207028c668f8f8a2218f9632a8092cfcb8692ef11053d1"
        },
        {
          "path": "src/lib/company-phone-format.mjs",
          "sha256": "67b31114f517253961c6a774210f157867b1e2e318e6b700089eef03ef1b7209"
        },
        {
          "path": "src/lib/employee-intake-channel-continuity.mjs",
          "sha256": "59dffe3800f26cd979bd12c4cff0010ca72779e1dc62030a6f0117b6ef3fb64d"
        },
        {
          "path": "src/lib/field-hours-report.mjs",
          "sha256": "b55b767d61278bde31cb9ce4ef64faee5320fc7fe1b1bcc54559860bb4576731"
        },
        {
          "path": "src/lib/field-media-privacy.mjs",
          "sha256": "5ec7fc7dd71f9303a42bfb4889e02541de8a3cf356e8e1203cfeeefd56220515"
        },
        {
          "path": "src/lib/field-media.mjs",
          "sha256": "940e681d1430fc211093b16f5407637fcd31d270a3d99234f748fe7db73cc0bb"
        },
        {
          "path": "src/lib/field-operations-policy.mjs",
          "sha256": "01eb863d7db4446eeb8dab990d7e0602a19d581d5615a0b1e5d50c02f3d70173"
        },
        {
          "path": "src/lib/field-operations-store.mjs",
          "sha256": "dbf96641349efae61808a2d66a02d491ad06e2226885e6efa928dba53ce5034e"
        },
        {
          "path": "src/lib/field-overtime-policy.mjs",
          "sha256": "76848bd0861d6cecccb682b774599f03d3fe1322eed3cc58f5f1db5d9b1e24f8"
        },
        {
          "path": "src/lib/field-overtime-store.mjs",
          "sha256": "f29b67fff29949d5a8b14c4aed3f484ae1ce16d2ed42de486a6d5868361b1526"
        },
        {
          "path": "src/lib/field-report-feedback.mjs",
          "sha256": "70b966ae5f382abe6b5446daf1092c3f66b8f46f80ce5a0c006cffeba1cfa64c"
        },
        {
          "path": "src/lib/field-shift-summary.mjs",
          "sha256": "41f47aa7a0826ba1fe29b554c7575ec60c9861f0c18c863f06e8c3d00cb0f83c"
        },
        {
          "path": "src/lib/geo.js",
          "sha256": "fa47424540f953adf56e0c3069780c0c8876a2f69e944a80caddefa974b5b6bf"
        },
        {
          "path": "src/lib/legacy-access-boundary.js",
          "sha256": "e1af7e83dac3c18bcf3b235d111d936d6dd6167925a3e1459d70a33913035370"
        },
        {
          "path": "src/lib/material-inventory.mjs",
          "sha256": "4b599d273c4cadcdf76202554757583152da8c11b0a754be386bffb830f0c65b"
        },
        {
          "path": "src/lib/meta-callback-diagnostics.mjs",
          "sha256": "b16fcfbeabe02b119d0337485504490a0c8e60363e841e378ae4c7722816d3bc"
        },
        {
          "path": "src/lib/meta-channel-binding.mjs",
          "sha256": "0ba9e9de3b6dcca46524ab2df22236dbbcd5be5e6cef571df1ec47a01633672e"
        },
        {
          "path": "src/lib/meta-cloud-protocol.mjs",
          "sha256": "c6d5f1e1b4119dd2529860e3bd61a1b22d602f71ad301b2f04cec3ab4bbbed3c"
        },
        {
          "path": "src/lib/meta-customer-app-projection.mjs",
          "sha256": "7b4b95712f143555a0e23b8ac98fc0e1d2f108e9fbefb4e861d20d9b464ef003"
        },
        {
          "path": "src/lib/meta-customer-callback.mjs",
          "sha256": "da90e3ed097c287a7c080d05daf5e4b0c0bb82544d2f7dab4cb1ee99880c3fd0"
        },
        {
          "path": "src/lib/meta-customer-coexistence.mjs",
          "sha256": "30f5b950284b953fa853b37514cd768660cfc505a6e979ec51c947b6edce40da"
        },
        {
          "path": "src/lib/meta-customer-credentials.mjs",
          "sha256": "44a05a0b46417de835eb289882b0b2c6d71158f207c16c48228f1ac4b67cca0f"
        },
        {
          "path": "src/lib/meta-customer-inbox-review.mjs",
          "sha256": "250bd69c487dc8dffed5500c1ca0f9adb77843352902c41e4a63da7656bf2eaa"
        },
        {
          "path": "src/lib/meta-customer-outbound.mjs",
          "sha256": "84a249b3777d3be843b20b09d0c6cd81b6fab7415dc22f124477d87475eead09"
        },
        {
          "path": "src/lib/meta-customer-permissions.mjs",
          "sha256": "ce3671bd46af8e487c45319facbca8e6b522620fd16ee3163e5048b5ecb6585d"
        },
        {
          "path": "src/lib/meta-customer-processing.mjs",
          "sha256": "e4a52dbd2ce86793b66c4af5963c288b13d7b2b2f656c4c6f795bcac8074f4ad"
        },
        {
          "path": "src/lib/meta-customer-provider.mjs",
          "sha256": "b6cc572fb68ab4cb653ccee30cea754a6273b5631d13e61dd2c2f65535aa287f"
        },
        {
          "path": "src/lib/meta-customer-templates.mjs",
          "sha256": "ca9e491b8b1b4c25c89585408cb53eae13e2423fdf48a93deed0846126e1c46c"
        },
        {
          "path": "src/lib/meta-development-pilot-policy.mjs",
          "sha256": "6f3a854898ea28d108341f35fe7f5f23facf3d574e586b96a2343a8038cc8c79"
        },
        {
          "path": "src/lib/meta-employee-intake.mjs",
          "sha256": "77dc9f64814f995d21084606d705f26af65de4f4f9bea25a0f37a0d8dba1b928"
        },
        {
          "path": "src/lib/meta-field-bridge.mjs",
          "sha256": "79c961cf91f988e5d913cfb241a887c26a78d49e04ebf2c5fbb2bf6a74bc809b"
        },
        {
          "path": "src/lib/meta-field-conversation.mjs",
          "sha256": "2da5b4a58e4f62a912d4df4bd93574c9907c6561123fe5ffabdd12420b72047f"
        },
        {
          "path": "src/lib/meta-kyc-bridge.mjs",
          "sha256": "33368028c42baf9f720390de4fc03cbed1448368079415850a41f3adadfebed3"
        },
        {
          "path": "src/lib/meta-kyc-challenge.mjs",
          "sha256": "f5a03ec770e6d85de095393bf38c331c0803a7fe3c7f1b72a2addd9cac7484eb"
        },
        {
          "path": "src/lib/meta-kyc-conversation.mjs",
          "sha256": "75870a6359385ae83df0d154b57c3f6738f2bde62fbe4974da7e38e5b0de2902"
        },
        {
          "path": "src/lib/meta-kyc-current-image.mjs",
          "sha256": "03ef3966025f520b373e937a6230f846185f3b4845830da5a38c0d8f02e155c2"
        },
        {
          "path": "src/lib/meta-kyc-identity.mjs",
          "sha256": "295f87ecb3b4586313a4f9c48a2d5c9acf8fa263682d99d44a966be243af2319"
        },
        {
          "path": "src/lib/meta-kyc-outbound.mjs",
          "sha256": "e0766080e345b3777fc87a6f8014a34073beb48a3c9205aa4c1cb49251b4e589"
        },
        {
          "path": "src/lib/meta-kyc-rejection-policy.mjs",
          "sha256": "e6c96aba8077d75e152f45dc49fe32d41e103658d4bff4281c8c8a98e3fff0c1"
        },
        {
          "path": "src/lib/meta-kyc-rejection.mjs",
          "sha256": "5477adafd994a54c9e7bbcc196b6af4fbe0b9cc03ab563775b8258290e31f3d0"
        },
        {
          "path": "src/lib/meta-own-company-policy.mjs",
          "sha256": "7db3875cd0f31fec077f4d9a4f8875be1ddf4a5772acff4559069ae950ff0821"
        },
        {
          "path": "src/lib/meta-plan-import-conversation.mjs",
          "sha256": "6f3c261cb2cde943e0202ab5097d664958f5702975cdf5914aeac35e5a1bac1c"
        },
        {
          "path": "src/lib/meta-plan-import-origin.mjs",
          "sha256": "cdb619d1709a982323c9892383def1428db2ade771babdb18e4032b3535d953e"
        },
        {
          "path": "src/lib/meta-plan-import-transport.mjs",
          "sha256": "e42f48f0175dd697bac3de61d7d9893d35c2b1696c1ae276a4698eb3c36a4634"
        },
        {
          "path": "src/lib/meta-test-recipient-binding.mjs",
          "sha256": "2aea6f5815bd2d90fe891b45a79b48d339a3eebc681ac40b3347244e546c4b66"
        },
        {
          "path": "src/lib/meta-whatsapp-transport.mjs",
          "sha256": "f99569c7f587e9be1268aa254d2368226346a7ebf7e48fa6ca63a0064cf41310"
        },
        {
          "path": "src/lib/organization-resource-usage-policy.mjs",
          "sha256": "089ac1ee2ca6afd30aab1d0abd38274698ca56991d1c5225ea8e44c8b9fdc449"
        },
        {
          "path": "src/lib/organization-usage-policy.mjs",
          "sha256": "94997530d6c1fd420f0233172b07f8ba7dd7546a2ac9af75eaa30736400237ae"
        },
        {
          "path": "src/lib/participant-account-discovery.mjs",
          "sha256": "11b37ca397fdb195aac7addc1c16842fb28a9c83a73a82a57bf2791ed3038738"
        },
        {
          "path": "src/lib/participant-admission.mjs",
          "sha256": "2cbb466e49d742cd23da1bb85a4e89b7e411dc724c8d1f2eb66b39717f283dd9"
        },
        {
          "path": "src/lib/participant-analysis-consent.mjs",
          "sha256": "7f7d371914d1e46ac799cd1683afdc0418186c15a20156e697ecd879c81bf8c1"
        },
        {
          "path": "src/lib/participant-approved-identity.mjs",
          "sha256": "834d81e70cedbd967ff84d880ea9d697c2168d2220fb23d9eb14c1aba1cdbbf1"
        },
        {
          "path": "src/lib/participant-bank-account.mjs",
          "sha256": "29980527a6eda3bbc0125098a4b616082034a71fb1afb772ff87f476bc0ce981"
        },
        {
          "path": "src/lib/participant-bank-format.mjs",
          "sha256": "ebbb206a14eaac57230b53ec1afae99c4be60c8739baf0d1d047d4a47ba464db"
        },
        {
          "path": "src/lib/participant-bank-vault.mjs",
          "sha256": "06e990ab79c896628756f3c74a50dcc7e8062f4fa296f56a31e4150b5badc16a"
        },
        {
          "path": "src/lib/participant-channel-kyc.mjs",
          "sha256": "2ac9414429238162a9b16d4adea421df0bff9fb93ea4fbf2f9d6677f2659fb2d"
        },
        {
          "path": "src/lib/participant-civil-policy.mjs",
          "sha256": "e180a64c788d6cd20e766cb4fd32dbba1c7cb3954c01405ac8675ec023eef278"
        },
        {
          "path": "src/lib/participant-civil-store.mjs",
          "sha256": "5f440c0c76ca67b87a7e5d4e90e7a48f18ea3603b16434b35beeddd3bdf168a4"
        },
        {
          "path": "src/lib/participant-kyc-chat-attempt.mjs",
          "sha256": "d3f0a65f866fa027ee008963fcb6ffcad0cd33de94cace7603cf40bc78c21aeb"
        },
        {
          "path": "src/lib/participant-kyc-chat-closure.mjs",
          "sha256": "4a6a368910de95582c2baabc70bab7f4b4afa4413e8ebdb75a1e8b867c098a19"
        },
        {
          "path": "src/lib/participant-kyc-chat-copy.mjs",
          "sha256": "d886219584d5e8b9d9db1ad16a36c726f6982fa0e8400c3be51af2623574ab96"
        },
        {
          "path": "src/lib/participant-kyc-image-set.mjs",
          "sha256": "190ce2560286a58d42668da7b912aeabcfa76ee14086503bf1609304e5f0e8fb"
        },
        {
          "path": "src/lib/participant-kyc-notice-links.mjs",
          "sha256": "1a10acf655796ebf4f08175158ea3dc2a1d0a0fdb3d13bb88573d6a0e5f4375e"
        },
        {
          "path": "src/lib/participant-kyc-preanalysis-policy.mjs",
          "sha256": "8c5286a0a5d41364e92e60f2ce2ba96caccc8667960f966b5caead37acafab49"
        },
        {
          "path": "src/lib/participant-onboarding-authority.mjs",
          "sha256": "dad5d9fd0a61c493ff02331d5333982627cdeb3a7addb74a3c86d44da931f916"
        },
        {
          "path": "src/lib/participant-onboarding-current-kyc.mjs",
          "sha256": "232fecca4f6cf775e5151ec460560e0c1abd6646dc3c532140cabe26dfb42119"
        },
        {
          "path": "src/lib/participant-onboarding-delivery.mjs",
          "sha256": "615592cc1a6215e24c48e8873a27211421853f99ca9093e6f490f77532b3d013"
        },
        {
          "path": "src/lib/participant-onboarding-intent.mjs",
          "sha256": "07114f6066e10617357c4e5d8e2db2b9dc846e5f4cffbc5aef09f2b7bfada9de"
        },
        {
          "path": "src/lib/participant-onboarding-policy.mjs",
          "sha256": "59409797ce3e13b7cfe63fe21d8d7e2c848ee49e0766015939242a9f43687c03"
        },
        {
          "path": "src/lib/participant-onboarding-reactive.mjs",
          "sha256": "666a8c27f3ab7d6fdbe66c91f22ace4e25b04b98e865f401d19c72212916104d"
        },
        {
          "path": "src/lib/participant-policy.mjs",
          "sha256": "7f3969ab1ebac5f01696149d76337199eb64c2fd09015c44c07e8b7e7088d62f"
        },
        {
          "path": "src/lib/participant-store.mjs",
          "sha256": "2296495e366b9ea0c2511066584e93ddf1cff51b5eefd05c6121d2143d78f5c9"
        },
        {
          "path": "src/lib/participant-verified-office.mjs",
          "sha256": "4922f392490aa6d49b8a8a45a56ac0b03831a8ad2efe89ce1e3adfd77d603d89"
        },
        {
          "path": "src/lib/person-worksite-journey.mjs",
          "sha256": "d3174df793150125c0b6a5d9f37d56336e72cab1efb43a361065b78ac54c210a"
        },
        {
          "path": "src/lib/pilot-media.mjs",
          "sha256": "55e35757cea03c312df68cebad100ee8b7d904b418eca9082359ea34e68f8fa9"
        },
        {
          "path": "src/lib/plan-baseline-policy.mjs",
          "sha256": "e9217a41a87057f437439420d56f3b7a0f973ae37c250c07b335634fef308560"
        },
        {
          "path": "src/lib/plan-import-cyp-curve.mjs",
          "sha256": "7e1d6c9d87df5e74e0a340361e1e66fdf0cfd5c82f1e44030ba2e85b5fa9c342"
        },
        {
          "path": "src/lib/plan-import-document-curve.mjs",
          "sha256": "7f63d62b9f1ae6d139c627a978ef56d7eafea0e0f4271167daa4c00bf7fda013"
        },
        {
          "path": "src/lib/plan-import-monthly-curve.mjs",
          "sha256": "6ce785f9c24c47f0e291b0bac40bd96a691fae68a309e4cb7a1917db31f9e6b6"
        },
        {
          "path": "src/lib/plan-import-ooxml.mjs",
          "sha256": "a146b9b300086bd8f44af6549d75611f7ac542a6c6c2f9eddf099cd8fc0f9251"
        },
        {
          "path": "src/lib/plan-import-policy.mjs",
          "sha256": "f2d73b8c58df571fb0dc6e5d76e2fb5d60daffa6ed6a41bc2be3c7e536458696"
        },
        {
          "path": "src/lib/plan-import-store.mjs",
          "sha256": "455c06e64301b2679e1278cc288cd4b06c875a222339e15c6720c58bc1f011c2"
        },
        {
          "path": "src/lib/plan-measurement-policy.mjs",
          "sha256": "3d6b0bce58a7f89612878310f534d8cf02f6a222c778cd4294b415c1f61157b7"
        },
        {
          "path": "src/lib/plan-measurement-source.mjs",
          "sha256": "ecf33b67a333d8ce73bfb51610218a1658cd94a26b62eb35d2290b795f826f36"
        },
        {
          "path": "src/lib/private-image-upload.mjs",
          "sha256": "1eaeda2fa79104cfe00a8736c466d8568d216c8682bd44031d3bf9d4f35e3f60"
        },
        {
          "path": "src/lib/procurement-quantity.js",
          "sha256": "53439844051cc1dbd679220d695e60e54bc1629b2f1ddb33fc125981da9326b3"
        },
        {
          "path": "src/lib/progress-measurement-quantity.js",
          "sha256": "e194f461d482dec666c090a19aabbd3498bc08964cbbbc31b8db6eeb39cb1be2"
        },
        {
          "path": "src/lib/site-register-policy.mjs",
          "sha256": "d529c4f2225e0ec851ef7df60f8c5b182a88b384958ebfd15b194683d1590434"
        },
        {
          "path": "src/lib/site-register-store.mjs",
          "sha256": "6b744c86f47dbb6dc081132675888615d76421701f96151b00646b5e1d2529c6"
        },
        {
          "path": "src/lib/task-progress-measurement.js",
          "sha256": "10361a0e30df34f9c90f915d9fdbfc0912a610ab3ce851503c32549b7049a8b9"
        },
        {
          "path": "src/lib/video-audio-extractor.mjs",
          "sha256": "0c85dfd39c10fdb782eca4fe57dc665c29bd7211ab7aba0dda3f8945abcb1988"
        },
        {
          "path": "src/lib/video-frame-extractor.mjs",
          "sha256": "33425a184cf097884982c43a90e3b515726027adbeb51c2cdbfc794e79dee6e6"
        },
        {
          "path": "src/lib/voice-progress-draft.mjs",
          "sha256": "56ddbad919a1ad77e13105f1a125914674c1a149a88e28fa2f8b831a4d14bd69"
        },
        {
          "path": "src/lib/whatsapp/field-worker-intent-policy.js",
          "sha256": "0fdf205af1c2185a16f99c4f1aaba6c36d95722ea914915a0eefe6a10d443ef9"
        },
        {
          "path": "src/lib/whatsapp/obra-intent-policy.js",
          "sha256": "cd01054ba81be6552f58dc91758e08166ea099482f28355cae570d15f3ccf8da"
        },
        {
          "path": "src/lib/whatsapp/operational-proposal-decision-policy.js",
          "sha256": "996ed641c090267679ce0fc3cb7a23f39b31ce88e761135feb0dd0c852eb74fc"
        },
        {
          "path": "src/lib/whatsapp/project-workspace-profile.js",
          "sha256": "e13473baa4ca5b4dc9851bb202f400ba174ccbfce2589be65ce8458aafa998f4"
        },
        {
          "path": "src/lib/whatsapp/template-review-policy.js",
          "sha256": "0ec4a7e544f8c2c2409d2c84ecf69fab663334dd5a5cef0ee1b1cbec82de0a08"
        },
        {
          "path": "src/lib/whatsapp/tenant-workspace-policy.js",
          "sha256": "d3416ff993fbfd70f75404166cdcd8f0b9b2e5a6741f6cde03725aab16abcd5e"
        },
        {
          "path": "src/lib/worker-channel-consent-policy.mjs",
          "sha256": "95c8393e7f2603694c5c15cfe34c9eead43007927aed0d5b633859b14c7448a9"
        },
        {
          "path": "src/lib/worker-channel-identity.mjs",
          "sha256": "1cddd58a2cd656abaca25752481fe1ca760d2bcd385a0fffbe0e685c15d59e0a"
        },
        {
          "path": "src/lib/workspace-policy.mjs",
          "sha256": "ba51cc5c4a6e4f5ce1c9382cae2c8ea903ab4373668c05384c7f1e9253c7041e"
        },
        {
          "path": "src/lib/workspace-store.mjs",
          "sha256": "5f25092121a31a06eefa59d69866db82fa3cd28afdcbd0e066e52d916478bc50"
        }
      ]
    }
  ],
  "browser": {
    "producer": "scripts/verify-plan-import-ui.mjs",
    "producerLfSha256": "57534d93a1e0b675e11faec0750a51d1867f9c823e2b91a11143c0f8d297b38f",
    "harnessFiles": [
      "scripts/lib/plan-partida-source-preview-ui.mjs",
      "scripts/lib/plan-partida-measurement-privacy-ui.mjs",
      "scripts/lib/plan-compact-full-suite-ui.mjs"
    ],
    "retainedTableScreenshots": [
      {
        "width": 320,
        "path": ".vercel/private/plan-import-ui-partida-table-320.png"
      },
      {
        "width": 390,
        "path": ".vercel/private/plan-import-ui-partida-table-390.png"
      },
      {
        "width": 768,
        "path": ".vercel/private/plan-import-ui-partida-table-768.png"
      },
      {
        "width": 1280,
        "path": ".vercel/private/plan-import-ui-partida-table-1280.png"
      }
    ]
  },
  "nativeOrBrowserAcceptance": false
});
