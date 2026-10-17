import {restoreWeeklyCypPreviousContract,weeklyCypCurrentSourcePin} from './home-decisions-current-ci-lineage.mjs';
import {documentTaskAssociationValidationFiles} from './plan-measurement-document-association-ci-lineage.mjs';
import {createHash} from 'node:crypto';
import {restoreIntegratedIdentityPreviousContract as integratedRestore,integratedIdentityCurrentSourcePin as integratedPin,verifyIntegratedIdentityCurrentSources as integratedVerify,restoreIntegratedIdentitySourceSet as integratedSourceSet,integratedIdentityProofSourceAdditions as integratedAdditions} from './integrated-identity-current-ci-lineage.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex');
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const requireLineage=(ok,message)=>{if(!ok)throw Object.assign(new Error(message),{code:'PLAN_MEASUREMENT_CURRENT_CI_LINEAGE_REJECTED'});};
// This existing API retains its original denial code. The new outer layer has
// its own distinct error identity when invoked directly by its own validator.
function currentCall(fn,args){try{return fn(...args);}catch(error){if(error.code==='INTEGRATED_IDENTITY_CURRENT_CI_LINEAGE_REJECTED')requireLineage(false,error.message);throw error;}}
const restoreIntegratedIdentityPreviousContract=(...args)=>currentCall(integratedRestore,args);
const integratedIdentityCurrentSourcePin=(...args)=>currentCall(integratedPin,args);
const verifyIntegratedIdentityCurrentSources=(...args)=>currentCall(integratedVerify,args);
const restoreIntegratedIdentitySourceSet=(...args)=>currentCall(integratedSourceSet,args);
const integratedIdentityProofSourceAdditions=(...args)=>currentCall(integratedAdditions,args);
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
export const PARTICIPANT_PREANALYSIS_CONTRACT_PATH='.github/workspace-acceptance-contract.json';
export const PARTICIPANT_PREANALYSIS_EVIDENCE='.vercel/private/participant-kyc-preanalysis-evidence/';
export const PARTICIPANT_PREANALYSIS_PROOF_ID='participant-kyc-preanalysis-postgres';
export const PARTICIPANT_PREANALYSIS_KIND='PG_PARTICIPANT_KYC_PREANALYSIS';
export const PARTICIPANT_PREANALYSIS_STEP=Object.freeze({
 name:'AI-first participant preanalysis with personal consent and owned PostgreSQL evidence',
 run:'npx eslint scripts/verify-participant-kyc-preanalysis-ci.mjs scripts/verify-participant-kyc-preanalysis-postgres.mjs scripts/lib/participant-preanalysis-current-ci-lineage.mjs src/lib/participant-analysis-consent.mjs src/lib/participant-kyc-preanalysis*.mjs \"src/app/(identity)/cuenta/participant-kyc-preanalysis-view.mjs\" tests/production-participant-preanalysis-current-ci-lineage.test.mjs tests/production-participant-kyc-preanalysis*.test.mjs tests/fixtures/participant-preanalysis-memory.mjs --max-warnings 0\nnode --test tests/production-participant-preanalysis-current-ci-lineage.test.mjs\nnode scripts/verify-participant-kyc-preanalysis-postgres.mjs --guard-self-test\nnode scripts/verify-participant-kyc-preanalysis-ci.mjs native --expected-head "$GITHUB_SHA"\nnode scripts/verify-participant-kyc-preanalysis-ci.mjs verify --expected-head "$GITHUB_SHA"\n',
});
export const PARTICIPANT_PREANALYSIS_VALIDATION_PATHS=Object.freeze([
 'scripts/lib/participant-preanalysis-current-ci-lineage.mjs',
 'tests/production-participant-preanalysis-current-ci-lineage.test.mjs',
 'scripts/verify-participant-kyc-preanalysis-ci.mjs',
]);

// Deliberately unbound while the independent runtime/native/UI authors freeze
// their source. A pending revision cannot authenticate any new current source.
// Historical rows and receipts are never rewritten by this outer extension.
export const PARTICIPANT_PREANALYSIS_CURRENT_REVISION=Object.freeze({
  "version": 1,
  "status": "REVIEWED_FROZEN_CURRENT_SOURCE",
  "referenceHead": "58a32079fdc3a9bb2ff4fda5d0405fa339859e27",
  "referenceTree": "05772b6e0226ace062f1c4dc9dcf768e52529b92",
  "previousContractSha256": "c2ba8944d4b004d31451f5bd248132295b4c4539704b87cca3d1305bef9160bb",
  "reviewedSourceChanges": [
    {
      "path": "src/lib/meta-customer-processing-runtime.mjs",
      "originalSha256": "a866e8af6c142feea9ccb2594ee4a066b26ff13f89bb51b3e5982fb3994e4a52",
      "previousSha256": "a866e8af6c142feea9ccb2594ee4a066b26ff13f89bb51b3e5982fb3994e4a52",
      "currentSha256": "68c0712464738bff2abfdd9e7310266056b7685bb22976b21e3ce325082a0fdd"
    },
    {
      "path": "src/lib/meta-kyc-identity.mjs",
      "originalSha256": "5b65901dc449288516535312569fd69198d6699c98204e3c0146d13fcd26d160",
      "previousSha256": "b647de9ee86b32848d689a153658e8c34b98699287ad9758332531300470a5a8",
      "currentSha256": "b372b5b89c0712d52ca298ddfff1e63c834eddc0b53bca02e64dac458c12932f"
    }
  ],
  "validationDeltas": [
    {
      "path": "tests/production-company-kyc-outbound-compact-ci.test.mjs",
      "originalSha256": "c561cdb41002ec2717af76351b9dcb0758c4faa7c0ec2318e4b489c59bb37ee3",
      "previousSha256": "c561cdb41002ec2717af76351b9dcb0758c4faa7c0ec2318e4b489c59bb37ee3",
      "currentSha256": "db82126b261227d68b2c7851bdd10af77b6bf45dbddc0be2016d620783ca293e"
    },
    {
      "path": "scripts/lib/plan-measurement-consumer-ci-lineage.mjs",
      "originalSha256": "49b5d012969c39b837de2d43804072da9ce3ffe492a6bc1b3d9a8de6e43668a0",
      "previousSha256": "49b5d012969c39b837de2d43804072da9ce3ffe492a6bc1b3d9a8de6e43668a0",
      "currentSha256": "31341253f4f86e6b922abdb23d50ba4219a64c751c7e7518c5d212fdb8314e5a"
    },
    {
      "path": "scripts/lib/plan-measurement-current-ci-lineage.mjs",
      "originalSha256": "2706bd16d34d44b647161ad73441aad3d07b6def741e0075a928db9ca6a063b4",
      "previousSha256": "2706bd16d34d44b647161ad73441aad3d07b6def741e0075a928db9ca6a063b4",
      "currentSha256": "97fdbefc6a2a43627c7298d456574265d964bb84336066e2dbb09c047fb0d9b8"
    },
    {
      "path": "scripts/verify-company-kyc-outbound-compact-ci.mjs",
      "originalSha256": "4b643f0af2909511b38dea9d1c66dc59b70ea06cab8f9638440e223da970033a",
      "previousSha256": "1ab190ed268eecf39fed2614f1cebe038f910403b2f2bbc7fa7c081d209153bd",
      "currentSha256": "c5ec8368ccd3e1e72bd9fe78f85b0e27c87f0109bb77fc09ece17d15dff57f84"
    },
    {
      "path": "scripts/verify-consumption-feedback-ci.mjs",
      "originalSha256": "40b8bc71e33fdb72ce8dc3c82bcf175835eb39e2384c2be875841f070048aa72",
      "previousSha256": "40b8bc71e33fdb72ce8dc3c82bcf175835eb39e2384c2be875841f070048aa72",
      "currentSha256": "bbfb704366ffc9dda85f75bf586c1519f9017b38f478cb89847f467619be5d79"
    },
    {
      "path": "scripts/verify-kyc-reply-feedback-ci.mjs",
      "originalSha256": "d65c338ea9f896fc9a0e37f57f1672b3a974974dc8dde9d1085be21537b87b15",
      "previousSha256": "d65c338ea9f896fc9a0e37f57f1672b3a974974dc8dde9d1085be21537b87b15",
      "currentSha256": "3505ee35890a32bf8f3f1f29f84367ffe4501e9be36b5c41eae9e08f8f078a22"
    },
    {
      "path": "scripts/verify-organization-usage-ci.mjs",
      "originalSha256": "be7458395db29bf5cbbcd71736192cb59cd15b61b16c3f742a07a946753b220a",
      "previousSha256": "be7458395db29bf5cbbcd71736192cb59cd15b61b16c3f742a07a946753b220a",
      "currentSha256": "9f96613faf467b39b456c17b1169ed589faa186aa3e8081ec203370533ccf4ea"
    },
    {
      "path": "scripts/verify-plan-measurement-ci.mjs",
      "originalSha256": "38fe0338a778cffbeaac94860cf35f8c15e72de8813964015986ddb2f3eab57f",
      "previousSha256": "38fe0338a778cffbeaac94860cf35f8c15e72de8813964015986ddb2f3eab57f",
      "currentSha256": "f5fd8d89179b267f672431a95b7410d2fd4de92c9706c7658c4b3d2160561ad0"
    },
    {
      "path": "tests/fixtures/plan-measurement-ci-unit.mjs",
      "originalSha256": "3cd11413ac598fad5fc20f4ba612c347add7c174eb97e43041fb4c7bc5dc2aea",
      "previousSha256": "3cd11413ac598fad5fc20f4ba612c347add7c174eb97e43041fb4c7bc5dc2aea",
      "currentSha256": "24c6494d8fb4bb6230df133faf1fd68e64fd0eefa7e0f83ad17c80ed07f567e4"
    },
    {
      "path": "tests/production-kyc-reply-feedback-ci.test.mjs",
      "originalSha256": "b2197d10ce6cd3c422c0d3ea0f6c090a7ad9390f71c1ea65192ea699001dda21",
      "previousSha256": "b2197d10ce6cd3c422c0d3ea0f6c090a7ad9390f71c1ea65192ea699001dda21",
      "currentSha256": "e380b84f6a4c1368a16c5f88c58a3a210b15f63699b1c62cbf9fcc869eb9d3af"
    },
    {
      "path": "tests/production-kyc-reply-feedback-current-lineage.test.mjs",
      "originalSha256": "ce117547798ac459d772218b30270224f92b2bd7cd947b9097a9789fcec1f1c0",
      "previousSha256": "ce117547798ac459d772218b30270224f92b2bd7cd947b9097a9789fcec1f1c0",
      "currentSha256": "768a94b9d62638bad3c87e3a47fb6453061e73f2bd590ebc49c427709395c63a"
    },
    {
      "path": "tests/production-material-consumption-feedback-ci.test.mjs",
      "originalSha256": "724dae07b355ea971bd0ca87355bda49998d6ff2dc65467e1d35bd7b27a550a9",
      "previousSha256": "724dae07b355ea971bd0ca87355bda49998d6ff2dc65467e1d35bd7b27a550a9",
      "currentSha256": "f0b1f387fd7df15f56b24b936a1a848bdbcc437202a5e29e4c65f1b972f566e2"
    },
    {
      "path": "tests/production-organization-usage-ci.test.mjs",
      "originalSha256": "d73ec704f98bcd8bf737cfef9c0e2bfedf7d9b6a7acacc38d38e6e1e7ae39137",
      "previousSha256": "d73ec704f98bcd8bf737cfef9c0e2bfedf7d9b6a7acacc38d38e6e1e7ae39137",
      "currentSha256": "beb0410375d71f2a725e677c1a90083d2a2dc69f4b49f525806d124f1f2b723f"
    },
    {
      "path": "tests/production-plan-measurement-ci.test.mjs",
      "originalSha256": "e5c5a0413eafa50e76e2a29c2f6aa7f743485bb02a07594fc51f48c514de0494",
      "previousSha256": "e5c5a0413eafa50e76e2a29c2f6aa7f743485bb02a07594fc51f48c514de0494",
      "currentSha256": "dfe24918646dcf5390bff1c44cc7056a994e18641ffb5d21b3a9925398a5379b"
    },
    {
      "path": "tests/production-plan-measurement-consumer-ci-lineage.test.mjs",
      "originalSha256": "48644c40affef358aa76ecbd0531689888a7382062a82730665e3048bd11ce26",
      "previousSha256": "48644c40affef358aa76ecbd0531689888a7382062a82730665e3048bd11ce26",
      "currentSha256": "8de50b257e9e1ef3af85653e752b626d907d885cd9d705be78d59f40ae95389a"
    },
    {
      "path": "tests/production-plan-measurement-current-ci-lineage.test.mjs",
      "originalSha256": "e8e37a1998d3990190e1a802ace1ea6fde2a291c4effea69613b600c6bd09cfe",
      "previousSha256": "e8e37a1998d3990190e1a802ace1ea6fde2a291c4effea69613b600c6bd09cfe",
      "currentSha256": "9552a531d027a4c331fbc0ca46d382562e9f7ad3ae311800368332daa1a7f401"
    },
    {
      "path": "tests/production-whatsapp-feedback-workspace-ci.test.mjs",
      "originalSha256": "e6d609c407425087b5cebf14abdf96f92dfc49535d7c85e7d27f846052208c75",
      "previousSha256": "e6d609c407425087b5cebf14abdf96f92dfc49535d7c85e7d27f846052208c75",
      "currentSha256": "90e18193fb365fffac6fca6f591a2ff7fe9501bbbb3c54249037c324adc2f7c1"
    },
    {
      "path": "scripts/lib/field-outbound-current-ci-lineage.mjs",
      "originalSha256": "1537ffbb1ddfcb582f4c06dea4887c7558321e3f60eba65a15a4ba3e7714cd21",
      "previousSha256": "b9dcbb4283c2092913f02cf98b9bb5550bdae2ab54551f03cc502f13c454ca8e",
      "currentSha256": "13656381f1e032bb82b43d3c6ea9a7db04b42ec15359e758e729d9edb7165afa"
    },
    {
      "path": "tests/production-field-outbound-current-ci-lineage.test.mjs",
      "originalSha256": "b3aac294e6baa10d94a6cf5dfc95611560a86ee4bf40d71bf2f0c6553f945925",
      "previousSha256": "b3aac294e6baa10d94a6cf5dfc95611560a86ee4bf40d71bf2f0c6553f945925",
      "currentSha256": "dbe78f301d5c87b9cfec76c315c181ff44c6df3e93611ce40df1eaac6c3098cc"
    },
    {
      "path": "scripts/lib/ooxml-accounting-current-ci-lineage.mjs",
      "originalSha256": "da926d18f6e71037405ef5e9220097eb2eaec3167d759dad5175578ad9d1b82e",
      "previousSha256": "da926d18f6e71037405ef5e9220097eb2eaec3167d759dad5175578ad9d1b82e",
      "currentSha256": "bd078b7faa74affff2e78f86d1c26270f3a78bdf2b8b20b56352ff1da4953104"
    },
    {
      "path": "tests/production-ooxml-accounting-current-ci-lineage.test.mjs",
      "originalSha256": "fe2e7766f2cd8178f703d36f765820820bfe3e42dd9002e6f8d84ae8ef167640",
      "previousSha256": "fe2e7766f2cd8178f703d36f765820820bfe3e42dd9002e6f8d84ae8ef167640",
      "currentSha256": "22dc0989b4c3aea4486f2b89df931a768ed0685ca2eef90d796fa28562a2ac04"
    }
  ],
  "proofSourceDeltas": [
    {
      "id": "bank-intake-units",
      "kind": "UNIT",
      "family": "WORKSPACE_UNIT",
      "previousCount": 134,
      "previousPathsSha256": "811727640bf501ae3b7b918a0330e4289e014dd8ec4a250448b954584338823d",
      "currentCount": 136,
      "currentPathsSha256": "bbc1ef863877e5005b695db70c94aecf9104b3894b2b558eaa858ccb1bc40849",
      "additions": [
        "src/lib/participant-analysis-consent.mjs",
        "src/lib/participant-kyc-preanalysis-policy.mjs"
      ]
    },
    {
      "id": "bank-ui",
      "kind": "UI_BANK",
      "family": "WORKSPACE_UI_BANK",
      "previousCount": 135,
      "previousPathsSha256": "3e21912a4dc7fc2cd5277a2191e4fdf02e0f9eb6243f67e7633d4c6f7e515d3d",
      "currentCount": 138,
      "currentPathsSha256": "c11e8b4ada424f8cb5d84fd708bdf294ee5aed7ee78e6055aafc52a6f2b0d439",
      "additions": [
        "src/app/(identity)/cuenta/participant-kyc-preanalysis-view.mjs",
        "src/lib/participant-analysis-consent.mjs",
        "src/lib/participant-kyc-preanalysis-policy.mjs"
      ]
    },
    {
      "id": "joint-ui",
      "kind": "UI_JOINT",
      "family": "WORKSPACE_UI_JOINT",
      "previousCount": 137,
      "previousPathsSha256": "fb5fd3ad5c020fc7ba83169c2e5cdf8d7d85dfffdea7b20fa5bae08ca8e63f33",
      "currentCount": 139,
      "currentPathsSha256": "0bbeaf4446b55bd70b885088497979923ecf0ea78687fea81016169c60d316f5",
      "additions": [
        "src/lib/participant-analysis-consent.mjs",
        "src/lib/participant-kyc-preanalysis-policy.mjs"
      ]
    },
    {
      "id": "joint-causal",
      "kind": "UI_CAUSAL",
      "family": "WORKSPACE_UI_CAUSAL",
      "previousCount": 137,
      "previousPathsSha256": "fb5fd3ad5c020fc7ba83169c2e5cdf8d7d85dfffdea7b20fa5bae08ca8e63f33",
      "currentCount": 139,
      "currentPathsSha256": "0bbeaf4446b55bd70b885088497979923ecf0ea78687fea81016169c60d316f5",
      "additions": [
        "src/lib/participant-analysis-consent.mjs",
        "src/lib/participant-kyc-preanalysis-policy.mjs"
      ]
    },
    {
      "id": "company-kyc-postgres",
      "kind": "PG_COMPANY_KYC",
      "family": "WORKSPACE_PG_COMPANY_KYC",
      "previousCount": 226,
      "previousPathsSha256": "879ffc9bb14310d4b2e23d911290690002f0bf479644573f7a6b019fe3d3222b",
      "currentCount": 230,
      "currentPathsSha256": "ea9f247c2dd0d5e0273cedf6c5972a752287d5e454ee6c8725ea9d7718788063",
      "additions": [
        "src/lib/participant-analysis-consent.mjs",
        "src/lib/participant-kyc-preanalysis-policy.mjs",
        "src/lib/participant-kyc-preanalysis-runtime.mjs",
        "src/lib/participant-kyc-preanalysis.mjs"
      ]
    },
    {
      "id": "identity-only-ui",
      "kind": "UI_IDENTITY_ONLY",
      "family": "WORKSPACE_UI_IDENTITY_ONLY",
      "previousCount": 137,
      "previousPathsSha256": "23a81982442eefb1597338a82793a745c8894bc38f8bcf44121991641d50c214",
      "currentCount": 139,
      "currentPathsSha256": "216e5505cc07b407d220179430ef7300100825f21729d14049e9ad711136b102",
      "additions": [
        "src/app/(identity)/cuenta/participant-kyc-preanalysis-view.mjs",
        "src/lib/participant-analysis-consent.mjs"
      ]
    },
    {
      "id": "field-canonical-postgres",
      "kind": "PG_FIELD",
      "family": "WORKSPACE_PG_FIELD",
      "previousCount": 123,
      "previousPathsSha256": "b968f65896faae226720facc5abf003fb748924ba21c6a596ce8e5b1a39ef845",
      "currentCount": 125,
      "currentPathsSha256": "a6bbff882e8a27bb30a074c3a7b4f0fc5d2455fa2d6ab1da2c607ead7bfe3462",
      "additions": [
        "src/lib/participant-analysis-consent.mjs",
        "src/lib/participant-kyc-preanalysis-policy.mjs"
      ]
    },
    {
      "id": "overtime-canonical-postgres",
      "kind": "PG_OVERTIME",
      "family": "WORKSPACE_PG_OVERTIME",
      "previousCount": 108,
      "previousPathsSha256": "0d636950bdbbe956f747ca5f4d135ae53807a3aeb30f4a823121d78b1a6253a5",
      "currentCount": 110,
      "currentPathsSha256": "b2ec20559b2bb25eeded0151b1b10e978a9a0e8ad9b23cc3de5f8b2d3c9db72d",
      "additions": [
        "src/lib/participant-analysis-consent.mjs",
        "src/lib/participant-kyc-preanalysis-policy.mjs"
      ]
    }
  ],
  "consumerSourceDeltas": [
    {
      "family": "COMPACT",
      "previousCount": 127,
      "previousPathsSha256": "62cbd74c5eb900695b98ac79981ec3b841236a1a23f260d1fb8e2d9df1dba305",
      "currentCount": 132,
      "currentPathsSha256": "c01e1fa46c7e58cca89c6802061e3bddb328cbc025d3bb66c18184baacbc7b7f",
      "additions": [
        "src/lib/participant-analysis-consent.mjs",
        "src/lib/participant-kyc-preanalysis-policy.mjs",
        "src/lib/participant-kyc-preanalysis-runtime.mjs",
        "src/lib/participant-kyc-preanalysis.mjs",
        "src/lib/private-biometric-analyzer.mjs"
      ]
    },
    {
      "family": "CONSUMPTION_FEEDBACK",
      "previousCount": 110,
      "previousPathsSha256": "f10ea8939e36ac1011b73338ffa0fee3ebf1871a6cc04b4700034689e53061be",
      "currentCount": 112,
      "currentPathsSha256": "acaceb360e3f19ac337ff3652a1f639ae5f62ab8a67ce2f22f4e9ab034023097",
      "additions": [
        "src/lib/participant-analysis-consent.mjs",
        "src/lib/participant-kyc-preanalysis-policy.mjs"
      ]
    },
    {
      "family": "KYC_REPLY_FEEDBACK",
      "previousCount": 111,
      "previousPathsSha256": "6fd8563baf288562b093d7ae982669449cb98c4bfa93955939802f32a747a9c1",
      "currentCount": 113,
      "currentPathsSha256": "0c085cf49bbb44b7b0209ccf0c403fbbf849842bd694d90ccd5ebeacf9cdf454",
      "additions": [
        "src/lib/participant-analysis-consent.mjs",
        "src/lib/participant-kyc-preanalysis-policy.mjs"
      ]
    },
    {
      "family": "ORGANIZATION_USAGE",
      "previousCount": 115,
      "previousPathsSha256": "15b39f104ac2f363dcce7952130f7fbd149490122718d8a93eaf0e3b030e3a37",
      "currentCount": 117,
      "currentPathsSha256": "4659886a7718823575816a16f9cc387384825273cb23bbaf55bf0b42103a482c",
      "additions": [
        "src/lib/participant-analysis-consent.mjs",
        "src/lib/participant-kyc-preanalysis-policy.mjs"
      ]
    },
    {
      "family": "PLAN_MEASUREMENT",
      "previousCount": 113,
      "previousPathsSha256": "d4107d17d5270dc8d0de8f3d49a9b5a7d824d2e648b520bceffed658a2336cff",
      "currentCount": 115,
      "currentPathsSha256": "ddd8820928b43e671c75f6c6a2451fdddaed24f32fc75330335787e0f5ac71c1",
      "additions": [
        "src/lib/participant-analysis-consent.mjs",
        "src/lib/participant-kyc-preanalysis-policy.mjs"
      ]
    }
  ],
  "nativeSourceFiles": [
    "api/_biometric_core.py",
    "package-lock.json",
    "package.json",
    "scripts/fixtures/meta-signup-field-lifecycle-fixture.mjs",
    "scripts/lib/disposable-postgres-cleanup.mjs",
    "scripts/verify-participant-kyc-preanalysis-postgres.mjs",
    "src/app/(identity)/cuenta/private-bank-account-format.mjs",
    "src/app/api/identity/participants/route.js",
    "src/app/api/meta/customer-process/route.js",
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
    "src/lib/meta-app-recovery.mjs",
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
    "src/lib/meta-demo-pilot-policy.mjs",
    "src/lib/meta-demo-pilot-runtime.mjs",
    "src/lib/meta-demo-pilot-store.mjs",
    "src/lib/meta-demo-pilot.mjs",
    "src/lib/meta-development-pilot-policy.mjs",
    "src/lib/meta-employee-intake.mjs",
    "src/lib/meta-field-bridge.mjs",
    "src/lib/meta-field-conversation.mjs",
    "src/lib/meta-kyc-bridge.mjs",
    "src/lib/meta-kyc-challenge.mjs",
    "src/lib/meta-kyc-context-feedback.mjs",
    "src/lib/meta-kyc-context-outbound.mjs",
    "src/lib/meta-kyc-conversation.mjs",
    "src/lib/meta-kyc-expiry-feedback.mjs",
    "src/lib/meta-kyc-identity.mjs",
    "src/lib/meta-kyc-outbound.mjs",
    "src/lib/meta-kyc-rejection-policy.mjs",
    "src/lib/meta-kyc-rejection.mjs",
    "src/lib/meta-own-company-policy.mjs",
    "src/lib/meta-plan-import-conversation.mjs",
    "src/lib/meta-plan-import-origin.mjs",
    "src/lib/meta-plan-import-recovery.mjs",
    "src/lib/meta-plan-import-transport.mjs",
    "src/lib/meta-recovery-diagnostics.mjs",
    "src/lib/meta-test-dispatch.mjs",
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
    "src/lib/participant-http.mjs",
    "src/lib/participant-identity-provider.mjs",
    "src/lib/participant-kyc-chat-attempt.mjs",
    "src/lib/participant-kyc-chat-closure.mjs",
    "src/lib/participant-kyc-image-set.mjs",
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
    "src/lib/participant-runtime.mjs",
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
    "src/lib/production-identity-config.mjs",
    "src/lib/progress-measurement-quantity.js",
    "src/lib/site-register-policy.mjs",
    "src/lib/site-register-store.mjs",
    "src/lib/task-progress-measurement.js",
    "src/lib/verified-session.mjs",
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
    "src/lib/workspace-http.mjs",
    "src/lib/workspace-policy.mjs",
    "src/lib/workspace-runtime.mjs",
    "src/lib/workspace-store.mjs"
  ],
  "nativeProducerSha256": "d2fabf981cd77c28ebf4be49867f07dcf1a23ae8616848e9c0c038b8291f83d8",
  "nativeCheckNames": [
    "web-v1-consent-is-not-reinterpreted-or-queued-and-budget-recovery-does-not-read-sources",
    "web-v2-intent-is-atomic-personal-and-replay-keeps-the-original-source-and-wakeup",
    "explicit-v2-refusal-is-terminal-with-no-private-read-or-provider-or-permission-change",
    "three-image-web-source-sends-only-front-to-OCR-and-front-selfie-to-private-advisory",
    "parallel-workers-and-cron-cannot-dispatch-a-live-claim-twice",
    "configuration-wait-is-durable-and-cron-recovers-once-after-explicit-recheck-time",
    "expired-OCR-DISPATCHED-reclaims-only-current-pending-biometric-without-retrying-OCR-or-accepting-late-fields",
    "uncertain-OCR-with-biometric-configuration-wait-is-recoverable-only-for-that-independent-pending-stage",
    "expired-coverage-holds-without-dispatch-and-renewed-trial-recovers-the-same-bound-operation",
    "transport-uncertainty-records-UNKNOWN-and-reload-or-cron-never-retries-a-dispatched-request",
    "canonical-DISPATCHED-and-UNKNOWN-resource-receipts-block-before-private-reads-without-a-new-paid-attempt",
    "cron-skips-old-held-and-backs-off-invalid-source-without-starving-the-next-valid-reference",
    "unique-original-submission-and-exact-project-actor-consent-evidence-are-required-before-private-reads",
    "current-membership-revocation-during-private-read-denies-before-reservation-or-provider-dispatch",
    "late-submission-change-cannot-store-results-or-overwrite-the-current-capture",
    "fresh-SQL-clock-rejects-an-expired-claim-after-await-with-zero-provider-and-no-lease-extension",
    "expired-durable-DISPATCHED-claim-becomes-UNCERTAIN-once-and-late-provider-result-cannot-rewrite-current-state",
    "signed-WhatsApp-three-image-capture-enqueues-current-v2-consent-once-with-original-issuer-and-no-account-or-field-grant",
    "only-technical-preanalysis-and-usage-records-are-created-no-review-permission-attendance-or-task-effect"
  ],
  "ciSourceFiles": [
    ".github/scripts/verify-workspace-ci-parallelization.mjs",
    "api/_biometric_core.py",
    "package-lock.json",
    "package.json",
    "scripts/fixtures/meta-signup-field-lifecycle-fixture.mjs",
    "scripts/lib/disposable-postgres-cleanup.mjs",
    "scripts/lib/field-outbound-current-ci-lineage.mjs",
    "scripts/lib/kyc-expired-current-ci-lineage.mjs",
    "scripts/lib/ooxml-accounting-current-ci-lineage.mjs",
    "scripts/lib/participant-preanalysis-current-ci-lineage.mjs",
    "scripts/lib/plan-measurement-consumer-ci-lineage.mjs",
    "scripts/lib/plan-measurement-current-ci-lineage.mjs",
    "scripts/verify-company-kyc-outbound-compact-ci.mjs",
    "scripts/verify-consumption-feedback-ci.mjs",
    "scripts/verify-kyc-reply-feedback-ci.mjs",
    "scripts/verify-organization-usage-ci.mjs",
    "scripts/verify-participant-kyc-preanalysis-ci.mjs",
    "scripts/verify-participant-kyc-preanalysis-postgres.mjs",
    "scripts/verify-plan-measurement-ci.mjs",
    "src/app/(identity)/cuenta/company-channel-view.mjs",
    "src/app/(identity)/cuenta/employee-intake-continuity.mjs",
    "src/app/(identity)/cuenta/employee-intake-panel.js",
    "src/app/(identity)/cuenta/field-media-preparation.mjs",
    "src/app/(identity)/cuenta/kyc-photo-preparation.js",
    "src/app/(identity)/cuenta/own-company-number-view.mjs",
    "src/app/(identity)/cuenta/own-company-templates-view.mjs",
    "src/app/(identity)/cuenta/participant-account-discovery-format.mjs",
    "src/app/(identity)/cuenta/participant-account-discovery.js",
    "src/app/(identity)/cuenta/participant-civil-data-panel.js",
    "src/app/(identity)/cuenta/participant-civil-data-view.mjs",
    "src/app/(identity)/cuenta/participant-kyc-chat-attempt-panel.js",
    "src/app/(identity)/cuenta/participant-kyc-chat-attempt-view.mjs",
    "src/app/(identity)/cuenta/participant-kyc-preanalysis-view.mjs",
    "src/app/(identity)/cuenta/participant-ocr-usage-view.mjs",
    "src/app/(identity)/cuenta/participant-office-account-view.mjs",
    "src/app/(identity)/cuenta/participant-onboarding-next-step.mjs",
    "src/app/(identity)/cuenta/participant-panel.js",
    "src/app/(identity)/cuenta/participant-panel.module.css",
    "src/app/(identity)/cuenta/plan-baseline-view.mjs",
    "src/app/(identity)/cuenta/plan-source-curve.mjs",
    "src/app/(identity)/cuenta/private-bank-account-format.mjs",
    "src/app/(identity)/cuenta/private-bank-account-panel.js",
    "src/app/(identity)/cuenta/private-bank-account-panel.module.css",
    "src/app/(identity)/cuenta/site-purchase-view.mjs",
    "src/app/(identity)/cuenta/workspace-recovery-journal.mjs",
    "src/app/(identity)/cuenta/workspace-recovery-storage.mjs",
    "src/app/(identity)/cuenta/workspace-request-lifecycle.js",
    "src/app/(identity)/cuenta/workspace-request-lifecycle.mjs",
    "src/app/(identity)/cuenta/workspace-session-request.mjs",
    "src/app/api/identity/participants/route.js",
    "src/app/api/meta/customer-process/route.js",
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
    "src/lib/meta-app-recovery.mjs",
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
    "src/lib/meta-demo-pilot-policy.mjs",
    "src/lib/meta-demo-pilot-runtime.mjs",
    "src/lib/meta-demo-pilot-store.mjs",
    "src/lib/meta-demo-pilot.mjs",
    "src/lib/meta-development-pilot-policy.mjs",
    "src/lib/meta-employee-intake.mjs",
    "src/lib/meta-field-bridge.mjs",
    "src/lib/meta-field-conversation.mjs",
    "src/lib/meta-kyc-bridge.mjs",
    "src/lib/meta-kyc-challenge.mjs",
    "src/lib/meta-kyc-context-feedback.mjs",
    "src/lib/meta-kyc-context-outbound.mjs",
    "src/lib/meta-kyc-conversation.mjs",
    "src/lib/meta-kyc-expiry-feedback.mjs",
    "src/lib/meta-kyc-identity.mjs",
    "src/lib/meta-kyc-outbound.mjs",
    "src/lib/meta-kyc-rejection-policy.mjs",
    "src/lib/meta-kyc-rejection.mjs",
    "src/lib/meta-own-company-policy.mjs",
    "src/lib/meta-plan-import-conversation.mjs",
    "src/lib/meta-plan-import-origin.mjs",
    "src/lib/meta-plan-import-recovery.mjs",
    "src/lib/meta-plan-import-transport.mjs",
    "src/lib/meta-recovery-diagnostics.mjs",
    "src/lib/meta-test-dispatch.mjs",
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
    "src/lib/participant-http.mjs",
    "src/lib/participant-identity-provider.mjs",
    "src/lib/participant-kyc-chat-attempt.mjs",
    "src/lib/participant-kyc-chat-closure.mjs",
    "src/lib/participant-kyc-image-set.mjs",
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
    "src/lib/participant-runtime.mjs",
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
    "src/lib/production-identity-config.mjs",
    "src/lib/progress-measurement-quantity.js",
    "src/lib/site-register-policy.mjs",
    "src/lib/site-register-store.mjs",
    "src/lib/task-progress-measurement.js",
    "src/lib/verified-session.mjs",
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
    "src/lib/workspace-http.mjs",
    "src/lib/workspace-policy.mjs",
    "src/lib/workspace-runtime.mjs",
    "src/lib/workspace-store.mjs",
    "tests/fixtures/participant-preanalysis-memory.mjs",
    "tests/fixtures/plan-measurement-ci-unit.mjs",
    "tests/production-company-kyc-outbound-compact-ci.test.mjs",
    "tests/production-field-outbound-current-ci-lineage.test.mjs",
    "tests/production-kyc-reply-feedback-ci.test.mjs",
    "tests/production-kyc-reply-feedback-current-lineage.test.mjs",
    "tests/production-material-consumption-feedback-ci.test.mjs",
    "tests/production-ooxml-accounting-current-ci-lineage.test.mjs",
    "tests/production-organization-usage-ci.test.mjs",
    "tests/production-participant-kyc-preanalysis-view.test.mjs",
    "tests/production-participant-kyc-preanalysis.test.mjs",
    "tests/production-participant-preanalysis-current-ci-lineage.test.mjs",
    "tests/production-plan-measurement-ci.test.mjs",
    "tests/production-plan-measurement-consumer-ci-lineage.test.mjs",
    "tests/production-plan-measurement-current-ci-lineage.test.mjs",
    "tests/production-whatsapp-feedback-workspace-ci.test.mjs"
  ],
  "unitSuites": [
    {
      "file": "tests/production-participant-kyc-preanalysis.test.mjs",
      "sourceLfSha256": "f1600e811e654e176940a0e0d1c559bacae103f3e8059e0132f7e3d0a48aafaa",
      "caseNames": [
        "historical notices retain their original immutable hashes and never enqueue automatically",
        "new independently granted stages run from canonical source, keep business status and replay without new I/O",
        "PostgreSQL JSONB object key ordering preserves the exact source binding, consent fingerprint and deterministic operation",
        "JSONB canonicalization preserves strict semantic tamper rejection: extra-auto-key",
        "JSONB canonicalization preserves strict semantic tamper rejection: changed-operation",
        "JSONB canonicalization preserves strict semantic tamper rejection: changed-notice-proof",
        "JSONB canonicalization preserves strict semantic tamper rejection: changed-consent-time",
        "independent consent false/false never discloses an unauthorized image",
        "independent consent true/false never discloses an unauthorized image",
        "independent consent false/true never discloses an unauthorized image",
        "configuration absence remains durable and automatic recovery uses the same operation after configuration returns",
        "commercial expired coverage holds only paid OCR while authorized private comparison still completes",
        "concurrent processing obtains one durable claim and no second provider or biometric dispatch",
        "unknown paid dispatch remains uncertain across replay and cron, without another charge or analysis",
        "an expired OCR dispatch remains uncertain while a new claim completes only the independently authorized pending facial stage",
        "an uncertain OCR stage preserves a waiting facial stage and recovers it after configuration without a second paid dispatch or receipt",
        "a new independent facial claim that also crashes cannot redispatch either fenced stage",
        "a reclaimed pending stage rechecks source after awaiting its first storage read and does not transfer the next image",
        "a completed OCR partial result is normalized for another authorized reviewer independently of the aggregate status",
        "source authority receipt stops before image reads or provider calls",
        "source authority source-actor stops before image reads or provider calls",
        "source authority consent stops before image reads or provider calls",
        "source authority set stops before image reads or provider calls",
        "source authority tenant stops before image reads or provider calls",
        "source authority principal stops before image reads or provider calls",
        "source authority assignment stops before image reads or provider calls",
        "revocation while private storage is read prevents every subsequent provider transfer",
        "provider-declared success cannot smuggle certification or embeddings into private biometrics",
        "malformed scheduling timestamps fail before private I/O without a PostgreSQL date cast",
        "issue codes stay informational, closed and independent of any identity or access verdict",
        "the existing cron recovers AI alongside Meta while signed event jobs preserve their own scope"
      ]
    },
    {
      "file": "tests/production-participant-kyc-preanalysis-view.test.mjs",
      "sourceLfSha256": "2449020588b28f8dcf63f106066725eab839ddeba58f9cad32c612829325e089",
      "caseNames": [
        "automatic results and failures never offer a duplicate manual provider dispatch",
        "uncertain or held provider results do not claim completion or authorize another attempt",
        "document extraction and facial assistance stay distinct from verified identity",
        "a person without automatic authorization retains the historical manual route",
        "lack of optional consent and unavailable configuration do not masquerade as analysis success",
        "only closed informative issue messages are displayed, without private provider payloads",
        "a finalized human review does not display an old pending analysis as still running",
        "reviewers can see a completed OCR result while another automatic stage remains pending"
      ]
    }
  ]
});

function revision(contract){
 contract=restoreIntegratedIdentityPreviousContract(contract);
 requireLineage(plain(contract),'Workspace contract required');
 if(!Object.hasOwn(contract,'participantPreanalysisCurrentRevision'))return null;
 const value=contract.participantPreanalysisCurrentRevision;
 requireLineage(plain(value)&&same(Object.keys(value).sort(),[...Object.keys(PARTICIPANT_PREANALYSIS_CURRENT_REVISION),'validationSources'].sort()),'Exact preanalysis revision shape required');
 for(const [key,expected]of Object.entries(PARTICIPANT_PREANALYSIS_CURRENT_REVISION))requireLineage(same(value[key],expected),'Unreviewed preanalysis revision: '+key);
 requireLineage(value.status==='REVIEWED_FROZEN_CURRENT_SOURCE','Preanalysis revision is not bound to a final source freeze');
 requireLineage(Array.isArray(value.validationSources)&&same(value.validationSources.map(row=>row?.path),PARTICIPANT_PREANALYSIS_VALIDATION_PATHS),'Exact preanalysis validation sources required');
 for(const row of value.validationSources)requireLineage(plain(row)&&same(Object.keys(row).sort(),['path','sha256'])&&hash(row.sha256),'Invalid preanalysis validation pin');
 for(const row of [...value.reviewedSourceChanges,...value.validationDeltas])requireLineage(hash(row.previousSha256)&&hash(row.originalSha256)&&hash(row.currentSha256)&&row.previousSha256!==row.currentSha256,'An explicit reviewed source delta is required');
 return value;
}

export function participantPreanalysisCurrentRevision(contract){const value=revision(contract);return value?contract.participantPreanalysisCurrentRevision:null;}

export function validateParticipantPreanalysisWorkspaceContract(contract){
 contract=restoreIntegratedIdentityPreviousContract(contract);
 const value=revision(contract);if(!value)return null;
 restoreParticipantPreanalysisPreviousContract(contract);
 const block=contract.blocks.find(row=>row.id===63),spec=contract.extension.proofs.find(row=>row.id===PARTICIPANT_PREANALYSIS_PROOF_ID);
 requireLineage(same(Object.keys(block).sort(),['id','step','commandSha256'].sort()),'Exact preanalysis block shape required');
 requireLineage(same(Object.keys(spec).sort(),['id','lane','blockId','path','kind','producer','producerSha256','sourceFiles','checkNames'].sort()),'Exact preanalysis proof shape required');
 requireLineage(same(block.step,PARTICIPANT_PREANALYSIS_STEP)&&block.commandSha256===sha(PARTICIPANT_PREANALYSIS_STEP.run),'Exact preanalysis command required');
 requireLineage(spec.producer==='scripts/verify-participant-kyc-preanalysis-ci.mjs'&&spec.producerSha256===value.validationSources.find(row=>row.path===spec.producer)?.sha256,'Exact current preanalysis CI producer required');
 requireLineage(spec.path===PARTICIPANT_PREANALYSIS_EVIDENCE+'current-ci.json'&&same(spec.checkNames,value.nativeCheckNames)&&same(spec.sourceFiles,value.ciSourceFiles),'Exact preanalysis checks and complete source set required');
 const record=contract.evidenceProducers.find(row=>row.blockId===63);
 requireLineage(same(record,{producer:spec.producer,path:spec.path,retained:true,blockId:63,lane:'people',producerSha256:spec.producerSha256,sourceBasis:'EXPECTED_HEAD_GIT_BYTES'}),'Exact preanalysis evidence producer required');
 requireLineage(value.nativeSourceFiles.every(file=>value.ciSourceFiles.includes(file))&&value.validationSources.every(row=>value.ciSourceFiles.includes(row.path)),'Native and CI validation sources must remain independently covered');
 return {version:1,proofId:spec.id,nativeCheckCount:spec.checkNames.length,nativeSourceCount:value.nativeSourceFiles.length,ciSourceCount:spec.sourceFiles.length,historicalContractRestored:true,nativeAcceptance:false};
}

// Restoration is metadata-only and authenticates the entire published c2ba
// contract before the pre-existing OOXML -> Q -> P -> L/K/I/G/H chain runs.
export function restoreParticipantPreanalysisPreviousContract(contract){
 contract=restoreIntegratedIdentityPreviousContract(contract);
 const value=revision(contract);if(!value)return contract;
 const previous=structuredClone(contract);delete previous.participantPreanalysisCurrentRevision;
 const proof=previous.extension?.proofs?.filter(row=>row.id===PARTICIPANT_PREANALYSIS_PROOF_ID);
 requireLineage(proof?.length===1&&proof[0].kind===PARTICIPANT_PREANALYSIS_KIND&&proof[0].blockId===63&&proof[0].lane==='people','Exactly one current preanalysis proof is required');
 requireLineage(previous.blocks.filter(row=>row.id===63).length===1,'Exactly one preanalysis block is required');
 requireLineage(previous.evidenceProducers.filter(row=>row.blockId===63).length===1,'Exactly one preanalysis evidence producer is required');
 const removeOnce=(rows,item,label)=>{requireLineage(Array.isArray(rows)&&rows.filter(row=>row===item).length===1,'Exactly one '+label+' is required');return rows.filter(row=>row!==item);};
 previous.blocks=previous.blocks.filter(row=>row.id!==63);
 previous.extension.proofs=previous.extension.proofs.filter(row=>row.id!==PARTICIPANT_PREANALYSIS_PROOF_ID);
 previous.evidenceProducers=previous.evidenceProducers.filter(row=>row.blockId!==63);
 previous.artifactPatterns=removeOnce(previous.artifactPatterns,PARTICIPANT_PREANALYSIS_EVIDENCE,'preanalysis upload pattern');
 previous.lanes.people.blocks=removeOnce(previous.lanes.people.blocks,63,'people block assignment');
 previous.lanes.people.artifacts=removeOnce(previous.lanes.people.artifacts,PARTICIPANT_PREANALYSIS_EVIDENCE,'people upload pattern');
 previous.lanes.people.requiredRetainedEvidence=removeOnce(previous.lanes.people.requiredRetainedEvidence,proof[0].path,'retained preanalysis envelope');
 for(const delta of value.proofSourceDeltas){
  const matches=previous.extension.proofs.filter(row=>row.id===delta.id);
  requireLineage(matches.length===1,'An existing proof source delta is required: '+delta.id);
  matches[0].sourceFiles=restoreParticipantPreanalysisSourceSet(delta.family,matches[0].sourceFiles,contract);
 }
 requireLineage(sha(JSON.stringify(previous,null,2)+'\n')===value.previousContractSha256,'Preanalysis revision must restore the complete published contract');
 return previous;
}

export function participantPreanalysisCurrentSourcePin(contract,ref){
 const value=revision(contract);if(!value)return integratedIdentityCurrentSourcePin(contract,ref);
 const change=[...value.reviewedSourceChanges,...value.validationDeltas].find(row=>row.path===ref.path);
 if(!change)return integratedIdentityCurrentSourcePin(contract,ref);
 requireLineage(ref.sha256===change.originalSha256,'An original reviewed source pin must remain unchanged');
 return integratedIdentityCurrentSourcePin(contract,{...ref,sha256:change.currentSha256});
}

export function participantPreanalysisPriorValidationPin(contract,ref){
 const value=revision(contract);if(!value)return integratedIdentityCurrentSourcePin(contract,ref);
 const change=[...value.reviewedSourceChanges,...value.validationDeltas].find(row=>row.path===ref.path);
 if(!change)return integratedIdentityCurrentSourcePin(contract,ref);
 requireLineage(ref.sha256===change.previousSha256,'The previous complete reviewed validator pin must remain unchanged');
 return integratedIdentityCurrentSourcePin(contract,{...ref,sha256:change.currentSha256});
}

// The actual proof/source manifest remains untouched. This function only
// authenticates its current path set and reconstructs the historical path set
// used by an earlier independent contract assertion.
export function restoreParticipantPreanalysisSourceSet(family,files,contract){
 files=restoreIntegratedIdentitySourceSet(family,files,contract);
 const value=revision(contract);if(!value)return files;
 const rows=[...value.proofSourceDeltas,...value.consumerSourceDeltas].filter(row=>row.family===family);
 requireLineage(rows.length===1,'Exactly one reviewed current source family is required: '+family);
 const delta=rows[0];
 requireLineage(Array.isArray(files)&&files.every(file=>typeof file==='string')&&new Set(files).size===files.length&&same(files,[...files].sort()),'Unique sorted current source paths required');
 requireLineage(files.length===delta.currentCount&&sha(JSON.stringify(files))===delta.currentPathsSha256,'Current preanalysis source path set changed: '+family);
 requireLineage(Array.isArray(delta.additions)&&new Set(delta.additions).size===delta.additions.length&&delta.additions.every(file=>files.includes(file)),'Exact preanalysis source additions required: '+family);
 const prior=files.filter(file=>!delta.additions.includes(file));
 requireLineage(prior.length===delta.previousCount&&sha(JSON.stringify(prior))===delta.previousPathsSha256,'Published source path set changed: '+family);
 return prior;
}

export function verifyParticipantPreanalysisCurrentSources(contract,readSource){
 try{
 verifyIntegratedIdentityCurrentSources(contract,readSource);
 const value=revision(contract);if(!value)return null;
 restoreParticipantPreanalysisPreviousContract(contract);
 requireLineage(typeof readSource==='function','Current preanalysis source reader required');
 const priorValidationContract=restoreWeeklyCypPreviousContract(contract);
 for(const row of [...value.reviewedSourceChanges.map(row=>({path:row.path,sha256:row.currentSha256})),...value.validationDeltas.map(row=>({path:row.path,sha256:row.currentSha256})),...value.validationSources]){
  const bytes=readSource(row.path);requireLineage(Buffer.isBuffer(bytes),'Missing current preanalysis source: '+row.path);
  const text=bytes.toString('utf8');requireLineage(bytes.equals(Buffer.from(text))&&sha(text.replaceAll('\r\n','\n'))===weeklyCypCurrentSourcePin(contract,{...row,sha256:integratedIdentityCurrentSourcePin(priorValidationContract,row)}),'Stale current preanalysis source: '+row.path);
 }
 for(const row of [{file:'scripts/verify-participant-kyc-preanalysis-postgres.mjs',sourceLfSha256:value.nativeProducerSha256},...value.unitSuites]){
  requireLineage(hash(row.sourceLfSha256),'Frozen native and executed unit producer pins required');
  const bytes=readSource(row.file);requireLineage(Buffer.isBuffer(bytes),'Missing frozen preanalysis producer: '+row.file);
  const text=bytes.toString('utf8');requireLineage(bytes.equals(Buffer.from(text))&&sha(text.replaceAll('\r\n','\n'))===row.sourceLfSha256,'Frozen native/unit producer changed: '+row.file);
 }
 return {version:1,previousContractSha256:value.previousContractSha256,historicalContractRestored:true,historicalPinsPreserved:true,nativeAcceptance:false};
 }catch(error){if(error.code==='HOME_DECISIONS_CURRENT_CI_LINEAGE_REJECTED')requireLineage(false,error.message);throw error;}
}

export function participantPreanalysisConsumerSourceFiles(family,files,readSource){
 requireLineage(typeof readSource==='function','Committed consumer source reader required');
 const raw=readSource(PARTICIPANT_PREANALYSIS_CONTRACT_PATH);
 // Older isolated fixtures may provide only the historical native graph. They
 // still face all original count/path/hash assertions in their own validator.
 if(!Buffer.isBuffer(raw))return files;
 const contract=JSON.parse(raw);
 if(!Object.hasOwn(contract,'participantPreanalysisCurrentRevision'))return files;
 verifyParticipantPreanalysisCurrentSources(contract,readSource);
 return restoreParticipantPreanalysisSourceSet(family,files,contract);
}

// CLI consumers close their lazy Git map before entering the pure validator.
// Load every authenticated outer and checkpoint leaf first; a native import
// graph alone does not contain the contract or its current validation leaves.
export function participantPreanalysisConsumerValidationFiles(contract){
 const files=new Set([PARTICIPANT_PREANALYSIS_CONTRACT_PATH,...documentTaskAssociationValidationFiles(contract)]);
 const prior=restoreIntegratedIdentityPreviousContract(contract);
 const value=revision(prior);
 if(value){
  for(const row of [...value.reviewedSourceChanges,...value.validationDeltas,...value.validationSources])files.add(row.path);
  files.add('scripts/verify-participant-kyc-preanalysis-postgres.mjs');
  for(const row of value.unitSuites)files.add(row.file);
 }
 const integrated=contract.integratedIdentityCurrentRevision;
 if(integrated)for(const row of [...integrated.reviewedSourceChanges,...integrated.validationDeltas,...integrated.addedSources,...integrated.validationSources])files.add(row.path);
 return [...files].sort();
}
export function preloadParticipantPreanalysisConsumerSources({readSource,readCheckout}){
 requireLineage(typeof readSource==='function'&&typeof readCheckout==='function','Committed and actual checkout readers required');
 const bytes=readSource(PARTICIPANT_PREANALYSIS_CONTRACT_PATH);requireLineage(Buffer.isBuffer(bytes),'Current consumer contract must be preloaded');
 const contract=JSON.parse(bytes),files=participantPreanalysisConsumerValidationFiles(contract);
 for(const file of files){const committed=readSource(file),actual=readCheckout(file);requireLineage(Buffer.isBuffer(committed)&&Buffer.isBuffer(actual)&&actual.equals(committed),'Consumer current source must equal exact committed RAW bytes: '+file);}
 verifyParticipantPreanalysisCurrentSources(contract,readSource);
 return files;
}

export function participantPreanalysisProofSourceAdditions(spec){
 const integrated=integratedIdentityProofSourceAdditions(spec);if(integrated.length)spec={...spec,sourceFiles:spec.sourceFiles.filter(file=>!integrated.includes(file))};
 const delta=PARTICIPANT_PREANALYSIS_CURRENT_REVISION.proofSourceDeltas.find(row=>row.id===spec?.id);
 if(!delta)return integrated;
 requireLineage(Array.isArray(spec.sourceFiles),'Proof source paths required');
 if(spec.sourceFiles.length===delta.previousCount&&sha(JSON.stringify(spec.sourceFiles))===delta.previousPathsSha256)return integrated;
 return [...delta.additions,...integrated];
}
