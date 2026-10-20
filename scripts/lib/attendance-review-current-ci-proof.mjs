import {createHash} from 'node:crypto';
import path from 'node:path';
import {verifyPlanBudgetCurrentSources,restorePlanBudgetAttendanceReviewProducerText,restorePlanBudgetConsumptionEvidenceSource,restorePlanBudgetIntakeWithdrawalSource} from './plan-budget-current-ci-lineage.mjs';

// A decoder supplement, never a PostgreSQL execution or CI acceptance receipt.
// These public source bindings are derived from the actual 7bc4243 producer and
// its literal roots plus the canonical KYC fixture walk; no private proof data.
const PRODUCER='scripts/verify-field-operations-postgres.mjs';
const CURRENT_PRODUCER='4eb11afda80e9274e3fecdc229d12f21d53d29d444e6932e44837f257800ccc2';
const PREVIOUS_PRODUCER='c3cf9eed8983b9ab43ad9b11cf0f59af206b08ba70f5e6697133bb448b940662';
const CORE_SOURCE='src/lib/consumption-evidence-catalog.mjs';
const QUERY_SOURCE='tests/production-field-attendance-review-query.test.mjs';
export const ATTENDANCE_REVIEW_CHECK_NAMES=Object.freeze([
  "attendance-pending-older-than-101-resolved-events-is-complete-and-reviewable-for-current-authorized-roles-with-same-query-worker-names",
  "attendance-203-pending-keyset-pages-preserve-equal-microsecond-order-exact-total-directed-old-row-and-readonly-two-query-joined-names-without-N-plus-one",
  "attendance-review-current-tenant-project-role-author-and-field-permission-scope-revocation-denials-never-write-ledger-or-receipts",
  "attendance-old-row-decision-is-independent-current-authorized-atomic-once-under-replay-and-remains-a-usable-cursor-after-review"
]);
const HISTORICAL_NAMES_SHA256='f1e846044e855a94d416d1b7edef89850a51131a5cd2fe1d7bbc0f0809dea3a0';
const SOURCE_PATHS_SHA256='862157348d275beb0b84b2b4e4c7ab35cd644a560dff85594706ed98bd9aa571';
const SOURCE_BINDINGS=Object.freeze({
  "scripts/fixtures/canonical-participant-kyc.mjs": "09928b417f3319d76ba34fac91f89a1888f3a8e613bfde3775cac424cc441ccb",
  "scripts/verify-field-operations-postgres.mjs": "4eb11afda80e9274e3fecdc229d12f21d53d29d444e6932e44837f257800ccc2",
  "scripts/verify-field-operations-ui.mjs": "e73541c962d7dab349b4ce3425591472ecce51b7ad1b74bdb483adacd786a5cc",
  "src/app/(identity)/cuenta/field-operations-panel.js": "5477d459da2e68688ce3bcf68f8f928ab0a4155144696abb2736f0c511fcd455",
  "src/app/(identity)/cuenta/field-review-page-view.mjs": "a1187150e0a3344666418b0191a898a6cf019ad2e8e5c46be2be721aee969634",
  "src/app/(identity)/cuenta/private-bank-account-format.mjs": "4dcf7f2de2f49f97f155e14128b20815f538d659d5e82806fa45a18d541adeea",
  "src/app/api/identity/field-operations/route.js": "63e2f7a1dfe3a2acdcc42dc4c4009cb890f1592c66abbf1c5dca650829d951ae",
  "src/lib/bindx-civil-data-client.mjs": "20da64b82d14fb3d4055b9852ed8712d33b01d1bc9f50709cb55084c7d0433a2",
  "src/lib/brand-assets.mjs": "7da49f3f4d8c2f9d2cce36cc2902b5f46e044b98e67bace09e240f5b007fd4c1",
  "src/lib/canonical-invited-account.mjs": "94652997c4e6717e875041c859de9caaaeeabd9d166666d9dfbf899c51d98c7b",
  "src/lib/company-channel-connection.mjs": "f2c44860383bb49df67f7999fbe3c0a5aa57c91ebbde0cf9a3b5b367784f2c45",
  "src/lib/company-channel-kyc.mjs": "5b46276ad3aa5d656a0027be4a6bf58aa3fba4f557dd86e0c13d0d5b0cecba85",
  "src/lib/company-channel-routing.mjs": "9ed740dbb4ae1ca7d44171f176f0001d824b056a0f17a8f58ed1ea5a5a2e2f68",
  "src/lib/company-channel-schema.mjs": "96c0385fa3b6d60c8d1f92ca38dcdf32e7779f1200512806bf6d220e6be57022",
  "src/lib/company-entitlement.mjs": "65d41dfb796ef12be38b1220a99ccd3dfe277419a5e5a27e125beb29fe7e2cde",
  "src/lib/company-onboarding-policy.mjs": "cf557c7837d6264c78207028c668f8f8a2218f9632a8092cfcb8692ef11053d1",
  "src/lib/company-phone-format.mjs": "67b31114f517253961c6a774210f157867b1e2e318e6b700089eef03ef1b7209",
  "src/lib/employee-intake-channel-continuity.mjs": "59dffe3800f26cd979bd12c4cff0010ca72779e1dc62030a6f0117b6ef3fb64d",
  "src/lib/field-hours-report.mjs": "b55b767d61278bde31cb9ce4ef64faee5320fc7fe1b1bcc54559860bb4576731",
  "src/lib/field-media-privacy.mjs": "5ec7fc7dd71f9303a42bfb4889e02541de8a3cf356e8e1203cfeeefd56220515",
  "src/lib/field-media.mjs": "d221ab87c4639aadb6eb8788a7203cee072f6eb1deca40605fc3d02742ab9d65",
  "src/lib/field-operations-http.mjs": "cd1773bc3b9fba01821cd4494b8559bdcdcc3a4ce886228622bb800349dcfd39",
  "src/lib/field-operations-policy.mjs": "bb33655b622a081de656f24c2e369fe7a2e05a0a0a9da7ffe455c2f39fd8fbd5",
  "src/lib/field-operations-store.mjs": "517267adb96c69bce58350b98b3a4e335ca1304a72a824e35998590e95b8987c",
  "src/lib/field-overtime-policy.mjs": "76848bd0861d6cecccb682b774599f03d3fe1322eed3cc58f5f1db5d9b1e24f8",
  "src/lib/field-overtime-store.mjs": "f29b67fff29949d5a8b14c4aed3f484ae1ce16d2ed42de486a6d5868361b1526",
  "src/lib/field-report-feedback.mjs": "70b966ae5f382abe6b5446daf1092c3f66b8f46f80ce5a0c006cffeba1cfa64c",
  "src/lib/field-shift-summary.mjs": "41f47aa7a0826ba1fe29b554c7575ec60c9861f0c18c863f06e8c3d00cb0f83c",
  "src/lib/geo.js": "fa47424540f953adf56e0c3069780c0c8876a2f69e944a80caddefa974b5b6bf",
  "src/lib/legacy-access-boundary.js": "e1af7e83dac3c18bcf3b235d111d936d6dd6167925a3e1459d70a33913035370",
  "src/lib/material-inventory.mjs": "3af0b0e9c9003d09582ec4e8b21d1e35746dd3839fc7f01071935b9a4ea95333",
  "src/lib/meta-callback-diagnostics.mjs": "b16fcfbeabe02b119d0337485504490a0c8e60363e841e378ae4c7722816d3bc",
  "src/lib/meta-channel-binding.mjs": "0ba9e9de3b6dcca46524ab2df22236dbbcd5be5e6cef571df1ec47a01633672e",
  "src/lib/meta-cloud-protocol.mjs": "c6d5f1e1b4119dd2529860e3bd61a1b22d602f71ad301b2f04cec3ab4bbbed3c",
  "src/lib/meta-consumption-evidence-catalog.mjs": "cd4eb1ccf8617060aa2bb352cc9467981f7d17649be8b24233413c133c407bff",
  "src/lib/meta-customer-app-projection.mjs": "7b4b95712f143555a0e23b8ac98fc0e1d2f108e9fbefb4e861d20d9b464ef003",
  "src/lib/meta-customer-callback.mjs": "da90e3ed097c287a7c080d05daf5e4b0c0bb82544d2f7dab4cb1ee99880c3fd0",
  "src/lib/meta-customer-coexistence.mjs": "2cf704b2d3842d4ff7ae48a438c1271ad610ccf4e92a6214d97338e91e999c8e",
  "src/lib/meta-customer-credentials.mjs": "44a05a0b46417de835eb289882b0b2c6d71158f207c16c48228f1ac4b67cca0f",
  "src/lib/meta-customer-inbox-review.mjs": "250bd69c487dc8dffed5500c1ca0f9adb77843352902c41e4a63da7656bf2eaa",
  "src/lib/meta-customer-outbound.mjs": "84a249b3777d3be843b20b09d0c6cd81b6fab7415dc22f124477d87475eead09",
  "src/lib/meta-customer-permissions.mjs": "ce3671bd46af8e487c45319facbca8e6b522620fd16ee3163e5048b5ecb6585d",
  "src/lib/meta-customer-processing.mjs": "e4a52dbd2ce86793b66c4af5963c288b13d7b2b2f656c4c6f795bcac8074f4ad",
  "src/lib/meta-customer-provider.mjs": "102ae45ad7d0a1054d2c65cdbfa3a6a96accfcd982bebce8d6c32c7bf24b21a2",
  "src/lib/meta-customer-templates.mjs": "ca9e491b8b1b4c25c89585408cb53eae13e2423fdf48a93deed0846126e1c46c",
  "src/lib/meta-development-pilot-policy.mjs": "6f3a854898ea28d108341f35fe7f5f23facf3d574e586b96a2343a8038cc8c79",
  "src/lib/meta-employee-intake.mjs": "72e80601323adbe35c9ec1f61e49e3428007da55e567c724ca8dce3c42de042b",
  "src/lib/meta-field-bridge.mjs": "7f3bb80ba828e202f24e1d768b855131642dcc89fde39fcac4b81d64aa632955",
  "src/lib/meta-field-conversation.mjs": "c68887db8fa04f5806d1c0f4c29e829befb89931b8371041ad65334deb1dab4d",
  "src/lib/meta-kyc-challenge.mjs": "f5a03ec770e6d85de095393bf38c331c0803a7fe3c7f1b72a2addd9cac7484eb",
  "src/lib/meta-kyc-conversation.mjs": "17d1e52e826dcaa899e2e6b846e2856c73f73b18b7abfe30e951de0de8623ef6",
  "src/lib/meta-kyc-current-image.mjs": "03ef3966025f520b373e937a6230f846185f3b4845830da5a38c0d8f02e155c2",
  "src/lib/meta-kyc-identity.mjs": "295f87ecb3b4586313a4f9c48a2d5c9acf8fa263682d99d44a966be243af2319",
  "src/lib/meta-kyc-rejection-policy.mjs": "e6c96aba8077d75e152f45dc49fe32d41e103658d4bff4281c8c8a98e3fff0c1",
  "src/lib/meta-kyc-rejection.mjs": "5477adafd994a54c9e7bbcc196b6af4fbe0b9cc03ab563775b8258290e31f3d0",
  "src/lib/meta-own-company-policy.mjs": "7db3875cd0f31fec077f4d9a4f8875be1ddf4a5772acff4559069ae950ff0821",
  "src/lib/meta-plan-import-conversation.mjs": "6f3c261cb2cde943e0202ab5097d664958f5702975cdf5914aeac35e5a1bac1c",
  "src/lib/meta-plan-import-origin.mjs": "cdb619d1709a982323c9892383def1428db2ade771babdb18e4032b3535d953e",
  "src/lib/meta-plan-import-transport.mjs": "e42f48f0175dd697bac3de61d7d9893d35c2b1696c1ae276a4698eb3c36a4634",
  "src/lib/meta-test-recipient-binding.mjs": "2aea6f5815bd2d90fe891b45a79b48d339a3eebc681ac40b3347244e546c4b66",
  "src/lib/meta-whatsapp-transport.mjs": "f99569c7f587e9be1268aa254d2368226346a7ebf7e48fa6ca63a0064cf41310",
  "src/lib/organization-resource-usage-policy.mjs": "089ac1ee2ca6afd30aab1d0abd38274698ca56991d1c5225ea8e44c8b9fdc449",
  "src/lib/organization-usage-policy.mjs": "94997530d6c1fd420f0233172b07f8ba7dd7546a2ac9af75eaa30736400237ae",
  "src/lib/participant-account-discovery.mjs": "11b37ca397fdb195aac7addc1c16842fb28a9c83a73a82a57bf2791ed3038738",
  "src/lib/participant-admission.mjs": "2cbb466e49d742cd23da1bb85a4e89b7e411dc724c8d1f2eb66b39717f283dd9",
  "src/lib/participant-analysis-consent.mjs": "7f7d371914d1e46ac799cd1683afdc0418186c15a20156e697ecd879c81bf8c1",
  "src/lib/participant-approved-identity.mjs": "834d81e70cedbd967ff84d880ea9d697c2168d2220fb23d9eb14c1aba1cdbbf1",
  "src/lib/participant-bank-account.mjs": "29980527a6eda3bbc0125098a4b616082034a71fb1afb772ff87f476bc0ce981",
  "src/lib/participant-bank-format.mjs": "ebbb206a14eaac57230b53ec1afae99c4be60c8739baf0d1d047d4a47ba464db",
  "src/lib/participant-bank-vault.mjs": "06e990ab79c896628756f3c74a50dcc7e8062f4fa296f56a31e4150b5badc16a",
  "src/lib/participant-channel-kyc.mjs": "2ac9414429238162a9b16d4adea421df0bff9fb93ea4fbf2f9d6677f2659fb2d",
  "src/lib/participant-civil-policy.mjs": "e180a64c788d6cd20e766cb4fd32dbba1c7cb3954c01405ac8675ec023eef278",
  "src/lib/participant-civil-store.mjs": "5f440c0c76ca67b87a7e5d4e90e7a48f18ea3603b16434b35beeddd3bdf168a4",
  "src/lib/participant-kyc-chat-attempt.mjs": "d3f0a65f866fa027ee008963fcb6ffcad0cd33de94cace7603cf40bc78c21aeb",
  "src/lib/participant-kyc-chat-closure.mjs": "4a6a368910de95582c2baabc70bab7f4b4afa4413e8ebdb75a1e8b867c098a19",
  "src/lib/participant-kyc-chat-copy.mjs": "d886219584d5e8b9d9db1ad16a36c726f6982fa0e8400c3be51af2623574ab96",
  "src/lib/participant-kyc-image-set.mjs": "190ce2560286a58d42668da7b912aeabcfa76ee14086503bf1609304e5f0e8fb",
  "src/lib/participant-kyc-notice-links.mjs": "3547f3fc2ebdefc2522971467d4c77498160dde7806a25bf9fa18c527c8658fc",
  "src/lib/participant-kyc-preanalysis-policy.mjs": "8c5286a0a5d41364e92e60f2ce2ba96caccc8667960f966b5caead37acafab49",
  "src/lib/participant-onboarding-authority.mjs": "dad5d9fd0a61c493ff02331d5333982627cdeb3a7addb74a3c86d44da931f916",
  "src/lib/participant-onboarding-current-kyc.mjs": "232fecca4f6cf775e5151ec460560e0c1abd6646dc3c532140cabe26dfb42119",
  "src/lib/participant-onboarding-delivery.mjs": "615592cc1a6215e24c48e8873a27211421853f99ca9093e6f490f77532b3d013",
  "src/lib/participant-onboarding-intent.mjs": "07114f6066e10617357c4e5d8e2db2b9dc846e5f4cffbc5aef09f2b7bfada9de",
  "src/lib/participant-onboarding-policy.mjs": "59409797ce3e13b7cfe63fe21d8d7e2c848ee49e0766015939242a9f43687c03",
  "src/lib/participant-onboarding-reactive.mjs": "666a8c27f3ab7d6fdbe66c91f22ace4e25b04b98e865f401d19c72212916104d",
  "src/lib/participant-policy.mjs": "7f3969ab1ebac5f01696149d76337199eb64c2fd09015c44c07e8b7e7088d62f",
  "src/lib/participant-store.mjs": "2296495e366b9ea0c2511066584e93ddf1cff51b5eefd05c6121d2143d78f5c9",
  "src/lib/participant-verified-office.mjs": "4922f392490aa6d49b8a8a45a56ac0b03831a8ad2efe89ce1e3adfd77d603d89",
  "src/lib/person-worksite-journey.mjs": "d3174df793150125c0b6a5d9f37d56336e72cab1efb43a361065b78ac54c210a",
  "src/lib/pilot-media.mjs": "55e35757cea03c312df68cebad100ee8b7d904b418eca9082359ea34e68f8fa9",
  "src/lib/plan-baseline-policy.mjs": "e9217a41a87057f437439420d56f3b7a0f973ae37c250c07b335634fef308560",
  "src/lib/plan-budget-source.mjs": "7ebeabf62d8fb89c6ab941b8130d196ca2e008959a9599f2db0c71d75dd3382a",
  "src/lib/plan-import-cyp-curve.mjs": "7e1d6c9d87df5e74e0a340361e1e66fdf0cfd5c82f1e44030ba2e85b5fa9c342",
  "src/lib/plan-import-document-curve.mjs": "7f63d62b9f1ae6d139c627a978ef56d7eafea0e0f4271167daa4c00bf7fda013",
  "src/lib/plan-import-monthly-curve.mjs": "6ce785f9c24c47f0e291b0bac40bd96a691fae68a309e4cb7a1917db31f9e6b6",
  "src/lib/plan-import-ooxml.mjs": "662abaa7523d74961c6873a8b0beb3eb7e3d3b52988fad9cc55e76c0e540a3bd",
  "src/lib/plan-import-policy.mjs": "1946b2793d0db11519d154acdb5bf0f7e8be5dc26ecd1971b846eed284d7d50f",
  "src/lib/plan-import-store.mjs": "da047723f790c0f5e7eeff855782e4db7463670d1875caf0bab1c6cce9b1a920",
  "src/lib/plan-measurement-policy.mjs": "3d6b0bce58a7f89612878310f534d8cf02f6a222c778cd4294b415c1f61157b7",
  "src/lib/plan-measurement-source.mjs": "ecf33b67a333d8ce73bfb51610218a1658cd94a26b62eb35d2290b795f826f36",
  "src/lib/private-image-upload.mjs": "1eaeda2fa79104cfe00a8736c466d8568d216c8682bd44031d3bf9d4f35e3f60",
  "src/lib/procurement-quantity.js": "53439844051cc1dbd679220d695e60e54bc1629b2f1ddb33fc125981da9326b3",
  "src/lib/progress-measurement-quantity.js": "e194f461d482dec666c090a19aabbd3498bc08964cbbbc31b8db6eeb39cb1be2",
  "src/lib/site-register-policy.mjs": "d529c4f2225e0ec851ef7df60f8c5b182a88b384958ebfd15b194683d1590434",
  "src/lib/site-register-store.mjs": "6b744c86f47dbb6dc081132675888615d76421701f96151b00646b5e1d2529c6",
  "src/lib/task-progress-measurement.js": "10361a0e30df34f9c90f915d9fdbfc0912a610ab3ce851503c32549b7049a8b9",
  "src/lib/video-audio-extractor.mjs": "0c85dfd39c10fdb782eca4fe57dc665c29bd7211ab7aba0dda3f8945abcb1988",
  "src/lib/video-frame-extractor.mjs": "33425a184cf097884982c43a90e3b515726027adbeb51c2cdbfc794e79dee6e6",
  "src/lib/voice-consumption-draft.mjs": "b9af424825674ca6f24a729e9ba89bae6e67adf433de10837a05e58900584c82",
  "src/lib/voice-progress-draft.mjs": "56ddbad919a1ad77e13105f1a125914674c1a149a88e28fa2f8b831a4d14bd69",
  "src/lib/whatsapp/field-worker-intent-policy.js": "0fdf205af1c2185a16f99c4f1aaba6c36d95722ea914915a0eefe6a10d443ef9",
  "src/lib/whatsapp/obra-intent-policy.js": "cd01054ba81be6552f58dc91758e08166ea099482f28355cae570d15f3ccf8da",
  "src/lib/whatsapp/operational-proposal-decision-policy.js": "996ed641c090267679ce0fc3cb7a23f39b31ce88e761135feb0dd0c852eb74fc",
  "src/lib/whatsapp/project-workspace-profile.js": "e13473baa4ca5b4dc9851bb202f400ba174ccbfce2589be65ce8458aafa998f4",
  "src/lib/whatsapp/template-review-policy.js": "0ec4a7e544f8c2c2409d2c84ecf69fab663334dd5a5cef0ee1b1cbec82de0a08",
  "src/lib/whatsapp/tenant-workspace-policy.js": "d3416ff993fbfd70f75404166cdcd8f0b9b2e5a6741f6cde03725aab16abcd5e",
  "src/lib/worker-channel-consent-policy.mjs": "95c8393e7f2603694c5c15cfe34c9eead43007927aed0d5b633859b14c7448a9",
  "src/lib/worker-channel-identity.mjs": "1cddd58a2cd656abaca25752481fe1ca760d2bcd385a0fffbe0e685c15d59e0a",
  "src/lib/workspace-policy.mjs": "ba51cc5c4a6e4f5ce1c9382cae2c8ea903ab4373668c05384c7f1e9253c7041e",
  "src/lib/workspace-store.mjs": "5f25092121a31a06eefa59d69866db82fa3cd28afdcbd0e066e52d916478bc50",
  "tests/production-field-attendance-review-query.test.mjs": "c0a2d6aa4d0b8418d23392ace1024b7654f153f2627326f95649f04d53279d17",
  "tests/production-field-canonical-kyc.test.mjs": "d4259fae4d0ffcbf91a70f3db07084194f010b44973fdba66d685181e00c8e2c",
  "tests/production-field-media-lease.test.mjs": "14044a7da5d28acbc51eaa689eb28990db20beacfb76e012554662a2a3507169",
  "tests/production-field-media-privacy-v2.test.mjs": "7e39b17c31bdc64d933c8ab95bdc1d1aca8030f6f2244632d9268d3932404951",
  "tests/production-field-media-projection.test.mjs": "ce3a6a7bda32fa0ef4e4b0389d877585e268bfb75d71a247b8623b8e64456916",
  "tests/production-field-media.test.mjs": "db020d591bddb7968802b2a62123cc100bc05ccdfb5dca6f1cbb4047aeb81def",
  "tests/production-field-review-pagination.test.mjs": "41dcf035f557a9f200a5da5b864dee9322077f3591f1b791903e6f48188310d3",
  "tests/production-field-video-audio-processing.test.mjs": "dc660bdfefa04a9958e60ed3e04a0062ec2a87928d6dd48bfda1f562fe4acabd",
  "tests/production-pilot-video-context.test.mjs": "3981fe693aaa0afa81ca592914454603b03dcc3631c43d5ac8af56a38ffe2ca2",
  "tests/production-video-audio-extractor.test.mjs": "f036b6071190253c4870f7b8c08d6c9debef662cba425025818af9e9341ec27a",
  "tests/production-video-voice-progress.test.mjs": "9c9847a9a2faafc056de4cff992274e584942fe3fb6a6407071c6b0bf24df598",
  "tests/production-voice-progress-draft.test.mjs": "44334b71445c00a43ba33ec477477f5c70a4938c18f2cbb374b192688f6a6c7e",
  "vercel.json": "6dcec370175c30f808680a22a2b050944c009b4b234f4c96318a5cb2ac9cf1b5"
});

const GROUPS=[['checks','checkCount',19],['reviewPaginationChecks','reviewPaginationCheckCount',26],['voiceProgressChecks','voiceProgressCheckCount',4],['mediaLeaseChecks','mediaLeaseCheckCount',6],['videoAudioChecks','videoAudioCheckCount',8],['canonicalOwnFieldChecks','canonicalOwnFieldCheckCount',3]];
const MAP_ARRAYS={sourceSha256:'sourceFiles',voiceProgressSourceSha256:'voiceProgressSourceFiles',mediaLeaseSourceSha256:'mediaLeaseSourceFiles',videoAudioSourceSha256:'videoAudioSourceFiles'};
const hash=value=>createHash('sha256').update(value).digest('hex');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const reject=(ok,reason)=>{if(!ok)throw Object.assign(new Error('Attendance review native proof rejected: '+reason),{code:'ATTENDANCE_REVIEW_CURRENT_CI_PROOF_REJECTED',reason});};
const safe=file=>typeof file==='string'&&file.length>0&&path.posix.normalize(file)===file&&!path.posix.isAbsolute(file)&&!/[\\:\x00-\x1f]/.test(file)&&!file.split('/').includes('..');
const lf=bytes=>Buffer.from(bytes.toString('utf8').replaceAll('\r\n','\n'));
const at=(value,key)=>key.split('.').reduce((item,part)=>item?.[part],value);
const exact=(value,keys,reason)=>reject(plain(value)&&same(Object.keys(value).sort(),[...keys].sort()),reason);
const list=(value,length,reason)=>reject(Array.isArray(value)&&value.length===length&&Object.keys(value).length===length&&value.every(item=>typeof item==='string'),reason);
function snapshotReader(readSource){
 reject(typeof readSource==='function','SOURCE_READER');const cache=new Map();
 return file=>{
  reject(safe(file),'SOURCE_PATH');
  if(!cache.has(file)){let value;try{value=readSource(file);}catch{}reject(Buffer.isBuffer(value)&&Buffer.from(value.toString('utf8')).equals(value),'SOURCE_BYTES_'+file);cache.set(file,Buffer.from(value));}
  return Buffer.from(cache.get(file));
 };
}
function currentSpec(spec){
 const files=[...Object.keys(SOURCE_BINDINGS),CORE_SOURCE].sort();
 return plain(spec)&&spec.kind==='PG_FIELD'&&spec.producer===PRODUCER&&spec.producerSha256===CURRENT_PRODUCER&&
  Array.isArray(spec.checkNames)&&spec.checkNames.length===67&&hash(JSON.stringify(spec.checkNames))===HISTORICAL_NAMES_SHA256&&
  Array.isArray(spec.sourceFiles)&&same(spec.sourceFiles,files)&&hash(JSON.stringify(Object.keys(SOURCE_BINDINGS).sort()))===SOURCE_PATHS_SHA256&&hash(JSON.stringify(spec.sourceFiles))==='19c54254b4b02db8c837bc891b15566d9c88d0ff8e28db5a7e2718eeb82be80a';
}
// Declarative summary only. A caller must validate the RAW71 supplement first.
export function attendanceReviewCurrentCheckCount(spec){return currentSpec(spec)?71:null;}
function sourceSets(read){
 const text=lf(read(PRODUCER)).toString('utf8');
 const roots=name=>{
  const matches=[...text.matchAll(new RegExp('\\b'+name+'=\\[([^\\]]+)\\]','g'))];reject(matches.length===1,'SOURCE_ROOTS');
  const body=matches[0][1],files=[...body.matchAll(/['"]([^'"]+)['"]/g)].map(row=>row[1]);
  reject(files.length>0&&!body.replace(/['"][^'"]+['"]/g,'').replace(/[\s,]/g,''),'SOURCE_ROOTS');files.forEach(file=>reject(safe(file),'SOURCE_ROOTS'));return files;
 };
 const seen=new Set(),visit=file=>{if(seen.has(file))return;seen.add(file);for(const row of lf(read(file)).toString('utf8').matchAll(/(?:import|export)\s[^;]*?from\s*['"](\.[^'"]+)['"]/g)){const next=path.posix.normalize(path.posix.join(path.posix.dirname(file),row[1]));reject(next.startsWith('src/')||next.startsWith('scripts/fixtures/'),'FIXTURE_IMPORT');visit(next);}};
 visit('scripts/fixtures/canonical-participant-kyc.mjs');const fixture=[...seen].sort();
 return {...Object.fromEntries(Object.entries(MAP_ARRAYS).map(([key,array])=>[key,[...new Set([...roots(array),...fixture])].sort()])),'participantKycFixture.sourceSha256':fixture};
}
export function normalizeAttendanceReviewNativeProof(raw,contract,readSource,spec){
 reject(plain(raw)&&plain(contract)&&plain(spec)&&spec.kind==='PG_FIELD'&&spec.producer===PRODUCER,'INPUT');
 let proof,c;try{proof=structuredClone(raw);c=structuredClone(contract);}catch{reject(false,'JSON_DATA');}
 const read=snapshotReader(readSource),runtime=c.planBudgetCurrentRevision?.attendanceReviewRuntime;
 if(runtime===undefined){
  // Explicit historical delegation only; unchanged legacy validators still run.
  reject(spec.producerSha256!==CURRENT_PRODUCER&&!spec.sourceFiles?.includes(QUERY_SOURCE)&&
   !Object.hasOwn(proof,'attendanceReviewChecks')&&!Object.hasOwn(proof,'attendanceReviewCheckCount'),'CURRENT_RUNTIME_REQUIRED');
  for(const key of [...Object.keys(MAP_ARRAYS),'participantKycFixture.sourceSha256'])reject(!Object.hasOwn(at(proof,key)||{},QUERY_SOURCE),'CURRENT_RUNTIME_REQUIRED');
  reject(hash(read(PRODUCER))===spec.producerSha256&&proof.harnessSha256===spec.producerSha256,'HISTORICAL_PRODUCER');return proof;
 }
 reject(plain(runtime)&&currentSpec(spec),'CURRENT_SPEC');
 const declared=c.extension?.proofs?.filter(value=>value?.kind==='PG_FIELD');reject(declared?.length===1&&same(Object.keys(declared[0]).sort(),Object.keys(spec).sort())&&Object.keys(spec).every(key=>same(declared[0][key],spec[key])),'CURRENT_SPEC_BINDING');
 reject(runtime.producer?.producer===PRODUCER&&runtime.producer.currentSha256===CURRENT_PRODUCER&&runtime.producer.previousSha256===PREVIOUS_PRODUCER,'CURRENT_PRODUCER_BINDING');
 // Capture each current source once per invocation, never cache authorization or
 // mutable callers between calls. The same private bytes are authenticated/used.
 for(const [file,digest] of Object.entries(SOURCE_BINDINGS)){const bytes=lf(read(file));let parent=bytes;if(file==='src/lib/meta-consumption-evidence-catalog.mjs')try{parent=restorePlanBudgetConsumptionEvidenceSource(c,file,bytes);}catch{reject(false,'CURRENT_SOURCE_'+file);}if(file==='src/lib/meta-kyc-conversation.mjs')try{parent=restorePlanBudgetIntakeWithdrawalSource(c,file,bytes);}catch{reject(false,'CURRENT_SOURCE_'+file);}reject(hash(parent)===digest,'CURRENT_SOURCE_'+file);}
 try{verifyPlanBudgetCurrentSources(c,read);const previous=restorePlanBudgetAttendanceReviewProducerText(c,read(PRODUCER));reject(Buffer.isBuffer(previous)&&hash(lf(previous))===PREVIOUS_PRODUCER,'PRODUCER_INVERSE');}catch(error){if(error.code==='ATTENDANCE_REVIEW_CURRENT_CI_PROOF_REJECTED')throw error;reject(false,'CURRENT_AUTHORITY');}
 reject(proof.status==='PASS'&&proof.harnessSha256===hash(read(PRODUCER)),'CURRENT_HARNESS');
 reject(proof.totalChecks===71&&proof.attendanceReviewCheckCount===4,'CURRENT_COUNTS');
 list(proof.attendanceReviewChecks,4,'ADDITIVE_CHECKS');reject(same(proof.attendanceReviewChecks,ATTENDANCE_REVIEW_CHECK_NAMES),'ADDITIVE_CHECKS');
 const historical=[];
 for(const [group,countKey,count] of GROUPS){list(proof[group],count,'HISTORICAL_CHECKS');reject(proof[countKey]===count,'HISTORICAL_COUNTS');historical.push(...proof[group].map(name=>JSON.stringify({group,name})));}
 list(proof.ownHistoryPrivacy?.checks,1,'PRIVACY_CHECKS');historical.push(...proof.ownHistoryPrivacy.checks.map(name=>JSON.stringify({group:'ownHistoryPrivacy.checks',name})));
 reject(same(historical,spec.checkNames),'HISTORICAL_CHECKS');
 const privacy=proof.ownHistoryPrivacy?.participantKycFixture;
 exact(privacy,['records','syntheticPrivateCalls','providerCalls','biometricIdentityCertified'],'PRIVACY_FIXTURE');
 reject(privacy.providerCalls===0&&privacy.biometricIdentityCertified===false,'PRIVACY_FIXTURE');
 reject(proof.productionDataWritten===false&&proof.databaseRemoved===true&&typeof proof.databaseEngineVersion==='string'&&proof.environment==='disposable-local-postgresql'+proof.databaseEngineVersion.split('.')[0],'NATIVE_BOUNDARY');
 reject(['providerCalls','reviewPaginationProviderCalls','voiceProgressProviderCalls','mediaLeaseProviderCalls','videoAudioProviderCalls'].every(key=>proof[key]===0)&&['physicalAttendanceAccepted','whatsAppTested','videoAudioFfmpegExecuted'].every(key=>proof[key]===false),'NATIVE_BOUNDARY');
 reject(!Object.hasOwn(proof,'sourceManifest'),'SOURCE_MAPS');
 const sets=sourceSets(read),union=new Set();reject(same(Object.values(sets).map(files=>files.length),[125,118,118,121,115]),'SOURCE_SETS');
 for(const [key,files] of Object.entries(sets)){
  const map=at(proof,key);reject(plain(map)&&same(Object.keys(map).sort(),files),'SOURCE_MAPS_'+key);
  for(const file of files){reject((Object.hasOwn(SOURCE_BINDINGS,file)||file===CORE_SOURCE)&&map[file]===hash(read(file)),'SOURCE_HASH_'+file);union.add(file);}
 }
 reject(same([...union].sort(),spec.sourceFiles)&&union.size===134,'SOURCE_UNION');
 const projected=structuredClone(proof);delete projected.attendanceReviewChecks;delete projected.attendanceReviewCheckCount;projected.totalChecks=67;
 return projected;
}
