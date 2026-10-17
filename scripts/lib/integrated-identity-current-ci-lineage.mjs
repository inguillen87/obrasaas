import {restoreDocumentTaskAssociationPreviousContract as documentOuter0,documentTaskAssociationCurrentSourcePin as documentOuter1,verifyDocumentTaskAssociationCurrentSources as documentOuter2,restoreDocumentTaskAssociationSourceSet as documentOuter3,documentTaskAssociationProofSourceAdditions as documentOuter4} from './plan-measurement-document-association-ci-lineage.mjs';
// Existing APIs keep their original precise denial category; the additive
// module retains its distinct code when invoked directly. No error is accepted.
function documentOuterCall(fn,args){try{return fn(...args);}catch(error){if(error.code==='PLAN_MEASUREMENT_DOCUMENT_ASSOCIATION_CI_LINEAGE_REJECTED')throw Object.assign(new Error(error.message),{code:'INTEGRATED_IDENTITY_CURRENT_CI_LINEAGE_REJECTED'});throw error;}}
const restoreDocumentTaskAssociationPreviousContract=(...args)=>documentOuterCall(documentOuter0,args);
const documentTaskAssociationCurrentSourcePin=(...args)=>documentOuterCall(documentOuter1,args);
const verifyDocumentTaskAssociationCurrentSources=(...args)=>documentOuterCall(documentOuter2,args);
const restoreDocumentTaskAssociationSourceSet=(...args)=>documentOuterCall(documentOuter3,args);
const documentTaskAssociationProofSourceAdditions=(...args)=>documentOuterCall(documentOuter4,args);

import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import checkpoint from '../../tests/fixtures/integrated-identity-contract-27aa.json' with {type:'json'};

const sha=value=>createHash('sha256').update(value).digest('hex'),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const requireLineage=(ok,message)=>{if(!ok)throw Object.assign(new Error(message),{code:'INTEGRATED_IDENTITY_CURRENT_CI_LINEAGE_REJECTED'});};
const previousContractSha256='3c1a184f2e6839bba6bd7116ccf6c062fbb015500ec4900583dbd15f82fe7270';
requireLineage(sha(JSON.stringify(checkpoint,null,2)+'\n')===previousContractSha256,'The full clean AI checkpoint contract is immutable');
function freeze(value){if(value&&typeof value==='object'){for(const item of Object.values(value))freeze(item);Object.freeze(value);}return value;}freeze(checkpoint);

export const INTEGRATED_IDENTITY_UI_PRODUCER_MIGRATION_PATH='tests/fixtures/integrated-identity-ui-producer-migration-86f2.json';
export const INTEGRATED_IDENTITY_UI_PRODUCER_MIGRATION_SHA256='00026e577701bbf8c0120a958262e5d12f88d96bd85bdf8355e70aa350640522';
export function authenticateIntegratedIdentityUiProducerMigrationSource(bytes){
 requireLineage(Buffer.isBuffer(bytes),'Exact reviewed UI producer migration bytes required');const decoded=bytes.toString('utf8');requireLineage(bytes.equals(Buffer.from(decoded)),'Invalid reviewed UI migration UTF-8');const text=decoded.replaceAll('\r\n','\n');
 requireLineage(sha(text)===INTEGRATED_IDENTITY_UI_PRODUCER_MIGRATION_SHA256,'The complete reviewed UI producer migration is immutable');return freeze(JSON.parse(text));
}
// This fs/new URL input is an explicitly enumerated validation dependency.
// Current verification also authenticates readSource bytes; it is not claimed
// as an inferred JavaScript import closure or a native application dependency.
const uiProducerMigration=authenticateIntegratedIdentityUiProducerMigrationSource(readFileSync(new URL('../../tests/fixtures/integrated-identity-ui-producer-migration-86f2.json',import.meta.url)));
export const INTEGRATED_IDENTITY_UI_PRODUCER_PATHS=Object.freeze(uiProducerMigration.producers.map(row=>row.path));
// Reconstruct source history only. Real current-source gates always require
// the reviewed current SHA first and never substitute these historical bytes.
export function restoreIntegratedIdentityUiProducerText(producer,bytes){
 const row=uiProducerMigration.producers.find(ref=>ref.path===producer);requireLineage(Boolean(row)&&Buffer.isBuffer(bytes),'Only exact reviewed UI producer bytes can be restored');const decoded=bytes.toString('utf8');requireLineage(bytes.equals(Buffer.from(decoded)),'Invalid UI producer UTF-8');let text=decoded.replaceAll('\r\n','\n');
 if(sha(text)===row.previousSha256&&Buffer.byteLength(text)===row.previousBytes)return Buffer.from(text);
 requireLineage(sha(text)===row.currentSha256&&Buffer.byteLength(text)===row.currentBytes,'The current UI producer differs from its reviewed body');
 for(const hunk of [...row.inverseHunks].reverse()){const offset=hunk.currentOffsetCharacters;requireLineage(text.slice(offset,offset+hunk.currentText.length)===hunk.currentText,'An exact inverse UI producer hunk changed');text=text.slice(0,offset)+hunk.previousText+text.slice(offset+hunk.currentText.length);}
 requireLineage(sha(text)===row.previousSha256&&Buffer.byteLength(text)===row.previousBytes,'The complete predecessor UI producer body must restore exactly');return Buffer.from(text);
}
export const INTEGRATED_IDENTITY_CONTRACT_PATH='.github/workspace-acceptance-contract.json';
export const INTEGRATED_IDENTITY_CHECKPOINT_PATH='tests/fixtures/integrated-identity-contract-27aa.json';
export const INTEGRATED_IDENTITY_VALIDATION_PATHS=Object.freeze([
 'scripts/lib/integrated-identity-current-ci-lineage.mjs',
 'tests/production-integrated-identity-current-ci-lineage.test.mjs',
 INTEGRATED_IDENTITY_CHECKPOINT_PATH,
 'scripts/verify-focused-workspace-ci.mjs',
 'tests/production-focused-workspace-ci.test.mjs',
 'scripts/verify-focused-workspace-ui.mjs',
 'tests/production-focused-workspace-ui.test.mjs',
 INTEGRATED_IDENTITY_UI_PRODUCER_MIGRATION_PATH,
 'tests/production-integrated-identity-ui-producer-migration.test.mjs'
]);
export const INTEGRATED_FOCUSED_STEP=Object.freeze({
 name:'Focused worksite navigation and three-step synthetic identity browser evidence',
 run:'npx eslint scripts/verify-focused-workspace-ci.mjs scripts/verify-focused-workspace-ui.mjs scripts/lib/integrated-identity-current-ci-lineage.mjs tests/production-focused-workspace-ci.test.mjs tests/production-focused-workspace-ui.test.mjs tests/production-focused-workspace-navigation.test.mjs tests/production-integrated-identity-current-ci-lineage.test.mjs --max-warnings 0\nnode --test tests/production-integrated-identity-current-ci-lineage.test.mjs\nnode scripts/verify-focused-workspace-ci.mjs browser --expected-head "$GITHUB_SHA"\nnode scripts/verify-focused-workspace-ci.mjs verify --expected-head "$GITHUB_SHA"\n'
});
// Intentionally pending until the independently owned runtime/native sources
// have frozen. No current source, proof or receipt can pass a pending revision.
export const INTEGRATED_IDENTITY_CURRENT_REVISION=Object.freeze({
  "version": 1,
  "status": "REVIEWED_FROZEN_CURRENT_SOURCE",
  "referenceHead": "27aa8e004c6d34452bd7c8726ec87bdd7e50b8e5",
  "referenceTree": "ed32a9a1382c246f7fa1b9a5e93601c322cc0871",
  "previousContractSha256": "3c1a184f2e6839bba6bd7116ccf6c062fbb015500ec4900583dbd15f82fe7270",
  "reviewedSourceChanges": [
    {
      "path": "src/app/(identity)/cuenta/kyc-photo-preparation.js",
      "previousSha256": "794999ccbafafb029c85a94f946eaa6f3e126a8642db47f1df9f1f0ddee1ce3d",
      "currentSha256": "88137686826cc411d6fcc103b0085390c0cc16f69572cf45c2385bcde69f943d"
    },
    {
      "path": "src/app/(identity)/cuenta/onboarding-guide.js",
      "previousSha256": "dcd7a1e6af02df7e2cfdb56f98de93288435c1e0a0855f5c48fd9d9b4b2df364",
      "currentSha256": "ef6d6c9ecbe942ec53df8b64610908533aebdbce0bc879d1a77218f26d83221c"
    },
    {
      "path": "src/app/(identity)/cuenta/page.js",
      "previousSha256": "3ce34cb6374685a6fd384eae04155abe2a1d0196d9d355b6f74deeb8cd67acf0",
      "currentSha256": "eaa1eed27b9e3ff49a3b012b4eb50ed98ac9af90b183ae46129c96562b273667"
    },
    {
      "path": "src/app/(identity)/cuenta/participant-panel.js",
      "previousSha256": "4e10ff5f05942b9704f247e13972968cc2a441b6ba09bca277694e85a94cd56e",
      "currentSha256": "d16ee3ba394be011c5d338599d01653eec7d462705a2414821e02db3b44e38aa"
    },
    {
      "path": "src/app/(identity)/cuenta/participant-panel.module.css",
      "previousSha256": "3f8f1ff1a2a95dc0288e8b9877f1260753944f8a7fa075a96baf8b5a1e92a1fa",
      "currentSha256": "c1626d1a678f1060b1ccb9df106f32b041da2c3b2bd92ede3e65537aaf794c02"
    },
    {
      "path": "src/app/(identity)/cuenta/workspace-client.js",
      "previousSha256": "4f3ccde7f433c98e63f0ada92cd1346f0757bea06ea8bf93abf9ac0ff62b79f8",
      "currentSha256": "4143cf960157d8bd5f642842ee1672a3555c0e415c3dc4579763e2e8eabf84fb"
    },
    {
      "path": "src/app/(identity)/cuenta/workspace-identity.js",
      "previousSha256": "c5a533e7e912d05d6c94d0e5908f908b32eee6cc40eefabd4e7b523388ac9627",
      "currentSha256": "c3867723ef4ef76a38dd52d19be76f2d78752e49110c8c36648130452879c8c2"
    },
    {
      "path": "src/app/(identity)/cuenta/workspace-recovery-panel.js",
      "previousSha256": "a6745d3eac8ba028ceac2c1f9a8cb098ff67db4200fade630ed8b76d993e83a7",
      "currentSha256": "063361bf78293a61a246195d5734f69a17b08c5781ae5c9f502b85dcc51ef883"
    },
    {
      "path": "src/app/(identity)/cuenta/workspace-tools-navigation.js",
      "previousSha256": "2247f489d60ec0a05c8fb62fe2428c3d5ba2476d4a799bb0c861bdb56764a6e8",
      "currentSha256": "6e3bc5b9d14973153e080a55ba55a51f1c36838641c8510af4f2f664e676ddc9"
    },
    {
      "path": "src/app/(identity)/cuenta/workspace-tools-navigation.module.css",
      "previousSha256": "429bca3d9340c99f14001b479cffd121cb5d988416112845864399260781ccd3",
      "currentSha256": "25e6e54bc34821a658490e0276f92aae48675fdcca8f9a4b563acb49b81d5b06"
    },
    {
      "path": "src/app/(identity)/cuenta/workspace.module.css",
      "previousSha256": "3710a4cc648a07e6c60825af9a199d9fbd7b29a06cce5c866fc2173a06b2854a",
      "currentSha256": "8870cb4905c5d2f44751a5c502bed1001f6a3627c2cd6ec34b331c28b193c787"
    },
    {
      "path": "src/lib/company-channel-kyc.mjs",
      "previousSha256": "aef85f4d87561e613906ce57cadff638f6fdd19e0d9dd13cfa557cc2f4b28b33",
      "currentSha256": "5b18997e19675f3d08852485749c2482a1bb8412649747b512202915c61f2259"
    },
    {
      "path": "src/lib/identity-return-path.mjs",
      "previousSha256": "330a826e473d7de38a84dd0b54ad06f896fb6a3a0db7fbfd80ceacb8b4899252",
      "currentSha256": "91f04f80b1a2dbc7d56b8dd4b532c0540d643c2b8f48cebc25c8fcbee8ab9cf0"
    },
    {
      "path": "src/lib/legacy-access-boundary.js",
      "previousSha256": "92c5815b80b017f9faa54fee5d82781b4d234f24d2a4964d0550eb918624405b",
      "currentSha256": "e1af7e83dac3c18bcf3b235d111d936d6dd6167925a3e1459d70a33913035370"
    },
    {
      "path": "src/lib/meta-kyc-bridge.mjs",
      "previousSha256": "31d707fe3df0d00f01c22a75e3271e179b2afc5cb5adb131a84b4092b84343aa",
      "currentSha256": "33368028c42baf9f720390de4fc03cbed1448368079415850a41f3adadfebed3"
    },
    {
      "path": "src/lib/meta-kyc-context-feedback.mjs",
      "previousSha256": "dfd5b4cb18a379cffdecb437b2f89ab0aaa6d32660840b0cc76b81bf018758eb",
      "currentSha256": "45d3fe19bcd40c302a7b0bd24a29fb996583ed9cfaa50232803b4f4c95b232b9"
    },
    {
      "path": "src/lib/meta-kyc-context-outbound.mjs",
      "previousSha256": "0f1a77de34ab57e7a987e6e7305641cc1c9774c18d8653934f0414c259fc0629",
      "currentSha256": "d9679d579f3f9994e36e3412cdf2cddc29db2c9ad2946cc8f48a767f417078c1"
    },
    {
      "path": "src/lib/meta-kyc-conversation.mjs",
      "previousSha256": "36d8164bfcbda5167981d4b8009bade450b10db4f946b19557a9efbaa2baf6bb",
      "currentSha256": "75870a6359385ae83df0d154b57c3f6738f2bde62fbe4974da7e38e5b0de2902"
    },
    {
      "path": "src/lib/meta-kyc-identity.mjs",
      "previousSha256": "b372b5b89c0712d52ca298ddfff1e63c834eddc0b53bca02e64dac458c12932f",
      "currentSha256": "427292fe2d4e08ea973eba880a5060dce64ba7d284f353601ed00ee4d5cce7b4"
    }
  ],
  "validationDeltas": [
    {
      "path": "scripts/lib/participant-preanalysis-current-ci-lineage.mjs",
      "previousSha256": "b2d26d253faac6b4ada5cfc8acadb224689989d4b512ef0df2e9cb79f8ac6548",
      "currentSha256": "1a2dc8dc09a2b52d6b9fd1a814a2e71464c2f9d63491d5077c4431fa45c4c0e7"
    },
    {
      "path": "scripts/lib/plan-measurement-current-ci-lineage.mjs",
      "previousSha256": "97fdbefc6a2a43627c7298d456574265d964bb84336066e2dbb09c047fb0d9b8",
      "currentSha256": "0ef5c541e380a67d8d19bbf0b225af768e3f0fca557cb32c993bbe9f496ce9cb"
    },
    {
      "path": "scripts/verify-company-channel-kyc-postgres.mjs",
      "previousSha256": "825da6466a7f1ec4c500028785424a005be207e0ec25f894a96e6b9469fa1438",
      "currentSha256": "a1410e44be6b7aaaf5a2e036263cbf1106cbe928551b2ceabe465d3576cd5973"
    },
    {
      "path": "scripts/verify-company-kyc-outbound-compact-ci.mjs",
      "previousSha256": "c5ec8368ccd3e1e72bd9fe78f85b0e27c87f0109bb77fc09ece17d15dff57f84",
      "currentSha256": "53b09460a0efe5c95db25ec9cbba9b59a53a8534dceef75d026b3f609d57c66e"
    },
    {
      "path": "scripts/verify-company-kyc-outbound-compact-postgres.mjs",
      "previousSha256": "d3ebc8f96007213b5fe25f9c4853178ddc9b79408076ffe3f83f9fa29dea64c4",
      "currentSha256": "f6196154ce1c8563b974a99f3feda5eeea4f33082436629ed7924ba3dbbb51a4"
    },
    {
      "path": "scripts/verify-consumption-feedback-ci.mjs",
      "previousSha256": "bbfb704366ffc9dda85f75bf586c1519f9017b38f478cb89847f467619be5d79",
      "currentSha256": "33eafd467efbd607111ccc933b0e138cef249ba9c096c634f0c6ecd1509a8c09"
    },
    {
      "path": "scripts/verify-kyc-reply-feedback-ci.mjs",
      "previousSha256": "3505ee35890a32bf8f3f1f29f84367ffe4501e9be36b5c41eae9e08f8f078a22",
      "currentSha256": "5ad4d5c5bda1584c20385d3f2564a97f35edd26f5d23d1a144f83910767bba8c"
    },
    {
      "path": "scripts/verify-organization-usage-ci.mjs",
      "previousSha256": "9f96613faf467b39b456c17b1169ed589faa186aa3e8081ec203370533ccf4ea",
      "currentSha256": "a2e716b6e9199996d0425986b98f17e5a333003b6d3144b7dee12dbd7a80d659"
    },
    {
      "path": "scripts/verify-participant-kyc-preanalysis-ci.mjs",
      "previousSha256": "fba95d2e56b6900e5bc37064a3b1910c161ca5627a89cc97d0b2a1f0dbfd2081",
      "currentSha256": "1b420bfd0ef59638c6caa23cee4e54a4e6b4df69616b43f2782375118ea52198"
    },
    {
      "path": "scripts/verify-plan-measurement-ci.mjs",
      "previousSha256": "f5fd8d89179b267f672431a95b7410d2fd4de92c9706c7658c4b3d2160561ad0",
      "currentSha256": "d192c3b4d29bcd44262ba93c5bc8ca69b87693081704ac1309ebd57ada0199a8"
    },
    {
      "path": "tests/production-company-kyc-outbound-compact-ci.test.mjs",
      "previousSha256": "db82126b261227d68b2c7851bdd10af77b6bf45dbddc0be2016d620783ca293e",
      "currentSha256": "65d64e2d68a371310893c12073f1cb3e186753a4bf4f85e1171d922ceff262b2"
    },
    {
      "path": "tests/production-field-outbound-current-ci-lineage.test.mjs",
      "previousSha256": "dbe78f301d5c87b9cfec76c315c181ff44c6df3e93611ce40df1eaac6c3098cc",
      "currentSha256": "43b095e245845dbf4636bed107bae08a841956b5c304a6cee13b721a8d24989c"
    },
    {
      "path": "tests/production-kyc-reply-feedback-ci.test.mjs",
      "previousSha256": "e380b84f6a4c1368a16c5f88c58a3a210b15f63699b1c62cbf9fcc869eb9d3af",
      "currentSha256": "2fa8d14f7872d20342f1bdafec73cd9e008a729b034f7a29a339b9f0cb3efe66"
    },
    {
      "path": "tests/production-kyc-reply-feedback-current-lineage.test.mjs",
      "previousSha256": "768a94b9d62638bad3c87e3a47fb6453061e73f2bd590ebc49c427709395c63a",
      "currentSha256": "43649a2c500301f4e3e872f086a3dff327c72591d1251dd59bc067b1292ef282"
    },
    {
      "path": "tests/production-material-consumption-feedback-ci.test.mjs",
      "previousSha256": "f0b1f387fd7df15f56b24b936a1a848bdbcc437202a5e29e4c65f1b972f566e2",
      "currentSha256": "4342158578f2589c07b6e605582395549c45cf634e5a412ebab8ce5f4bf990ea"
    },
    {
      "path": "tests/production-meta-customer-composition.test.mjs",
      "previousSha256": "c0425600caa47d4ccdc86798aa01c18456f19cc85e8411487f5c990b67c91717",
      "currentSha256": "5820c8eb8d54275ca8970e18d25e16b1b59fd3b08a7d5439186851748dae4654"
    },
    {
      "path": "tests/production-ooxml-accounting-current-ci-lineage.test.mjs",
      "previousSha256": "22dc0989b4c3aea4486f2b89df931a768ed0685ca2eef90d796fa28562a2ac04",
      "currentSha256": "cbda38fcd5bb0220f433ec03d9152984786d2656b53c8ccc26b90b9ff108ba07"
    },
    {
      "path": "tests/production-organization-usage-ci.test.mjs",
      "previousSha256": "beb0410375d71f2a725e677c1a90083d2a2dc69f4b49f525806d124f1f2b723f",
      "currentSha256": "6acf018a2c19559ee7a895e0de9eaa0508b52bc19d0a2d738783f8cdc47ba418"
    },
    {
      "path": "tests/production-participant-preanalysis-current-ci-lineage.test.mjs",
      "previousSha256": "c6fd915fe04bd3ee48c9490c8e1e43e8ad44f0d2597bf1675c79e8db6880dd46",
      "currentSha256": "6cb2d234dd3eee662cab7d713da8477c9c4933f176b519ee3f456c0619cccaca"
    },
    {
      "path": "tests/production-plan-import-link-ui.test.mjs",
      "previousSha256": "936a1dc56d2713cb9fc69827b6acbeca522dbb06c3da1e60ea658ca9e434c7ae",
      "currentSha256": "294ccb99a5758ad710358f8896cd7277c7f22694914e836b06dc4ce25fa04133"
    },
    {
      "path": "tests/production-plan-measurement-ci.test.mjs",
      "previousSha256": "dfe24918646dcf5390bff1c44cc7056a994e18641ffb5d21b3a9925398a5379b",
      "currentSha256": "2388c7639b46b47cb5d0597bb854c9f250c1f6638f372f69689007769f67c6e4"
    },
    {
      "path": "tests/production-plan-measurement-current-ci-lineage.test.mjs",
      "previousSha256": "9552a531d027a4c331fbc0ca46d382562e9f7ad3ae311800368332daa1a7f401",
      "currentSha256": "b0cafe723a23cf47e59ae24f76a68ccc051a7ee7ac93ce8b7cbbfb6a22959a85"
    },
    {
      "path": "tests/production-whatsapp-feedback-workspace-ci.test.mjs",
      "previousSha256": "90e18193fb365fffac6fca6f591a2ff7fe9501bbbb3c54249037c324adc2f7c1",
      "currentSha256": "e3729bc7083843ae395f189e9ede2e80cc973794d0a164eaa9dc011e702930d8"
    },
    {
      "path": "tests/production-workspace-tools-navigation.test.mjs",
      "previousSha256": "3da761320723d221139edf9d46fe76c99ae12ec78849e580984c51b461f6597a",
      "currentSha256": "a2e52b1e323c65f592cc338e275c73a9de1d231e695e50b1e08a5822f8052eb1"
    },
    {
      "path": "scripts/verify-company-onboarding-ui.mjs",
      "previousSha256": "1237874587a756ddb67a15c09525887f29215fe76df7708aeee35d472716b676",
      "currentSha256": "1c269e2386a70c34e43089187cfd88829a6663814be60dfb02b673b099d61511"
    },
    {
      "path": "scripts/verify-mobile-workspace-review-ui.mjs",
      "previousSha256": "14178c269b9032442f40712d6928f7cb68ee43b2e84b3348e6519953cbdee594",
      "currentSha256": "7739e28a2ed86fbc8ed496306f4f682e776ea2cfee573be9e7f32d28f4f26449"
    },
    {
      "path": "scripts/verify-onboarding-guide-ui.mjs",
      "previousSha256": "7690c9d459858491a236c2caa360f5bbdf989a56b8c4298a35e4aea057287b31",
      "currentSha256": "3fa4a862e815896444a500144bbdd77a4e49b86d9bfd477c03f2696ebe6c2c02"
    },
    {
      "path": "scripts/verify-participant-project-navigation-ui.mjs",
      "previousSha256": "4946126fcc2e3408fe823a9094debe6aa362b5f5c232a67712990dad0058e695",
      "currentSha256": "be3227c09712878995410fea5ef1e713fb0d86fca63627940234f4a45f09d799"
    },
    {
      "path": "scripts/verify-task-progress-measurement-ui.mjs",
      "previousSha256": "3cd593333b735c7def545e1410bb4c2a6c7539f38167eb98ef156196854c40ec",
      "currentSha256": "49c4071a94e5dca5c2e8a5ee6517ce7ccab129bc318241a974e5b8ecf1224204"
    },
    {
      "path": "scripts/verify-workspace-identity-only-ui.mjs",
      "previousSha256": "f9b07f016b0ae9fe15497a63f6bc23ce996b42c45e29e19ef6c9e9f1a582e7d9",
      "currentSha256": "e11ed3c52c998f84c0e7ed21ebbe806a1aa8816007b7819203e7d6c4ef4add19"
    },
    {
      "path": "scripts/verify-workspace-plan-recovery-ui.mjs",
      "previousSha256": "9978062c966ed599d6d65783813169da48b6fd39fdc65ea6691144598f8c3413",
      "currentSha256": "ef7a5f0e099e468d5f0ec903ae78f6b9df4cf8dc48e1ed272e7ef9e31010c6c8"
    },
    {
      "path": "scripts/verify-workspace-reload-ui.mjs",
      "previousSha256": "ccaddad1d15827bcc3c1c3413c40ad959da95063c2961155d48d97935f739096",
      "currentSha256": "7b90b86b5b341edde5a792782fafbe07193fcf4250b2fc922c17ec011f4b423a"
    },
    {
      "path": "scripts/verify-workspace-ui.mjs",
      "previousSha256": "1d5de4cd92f799f8034531e9e44f70798ba137ff8d656a7152fa738cb9e266f2",
      "currentSha256": "cac2856aa357d6805da6438c995e5dd26748d5c92ab415ab2039b4508bbf79dd"
    }
  ],
  "addedSources": [
    {
      "path": "scripts/lib/kyc-current-image-native.mjs",
      "sha256": "87ad6932bbb4ed264947b0ba527965080e4f38a7cc0bb0f945b471e88ee06bbb"
    },
    {
      "path": "scripts/lib/kyc-current-image-own-native.mjs",
      "sha256": "2458c91bda08fe36d409e9c229c19f06dfe9d113aa8c8df4d6f11502b0d1e5fe"
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
      "path": "src/app/(identity)/cuenta/workspace-overview.js",
      "sha256": "eae7613778d7f12c0851e6412a1c5806890ef9b6f5e64d73c1647d8902e704f8"
    },
    {
      "path": "src/app/(identity)/cuenta/workspace-screen.js",
      "sha256": "b5c217095badf8db73842b98d86b6ae498da9f01b793ccda3683dc46be040b4a"
    },
    {
      "path": "src/app/(identity)/cuenta/workspace-view-routing.mjs",
      "sha256": "1f5d2827d0ad76282331d77b368d19c260d355eb37b1f56860a5ac485a7c9793"
    },
    {
      "path": "src/app/privacidad/identidad/page.js",
      "sha256": "7d69fb5e9327426e4ca9b7e856d38811babe5f43bfdad4b5bcb40266b88cc401"
    },
    {
      "path": "src/lib/meta-kyc-current-image.mjs",
      "sha256": "03ef3966025f520b373e937a6230f846185f3b4845830da5a38c0d8f02e155c2"
    },
    {
      "path": "src/lib/participant-kyc-chat-copy.mjs",
      "sha256": "82eda34190a5eb38e92a13167e1f1de1b5bb4ff6f817e5c2ec93cc658eb44927"
    },
    {
      "path": "src/lib/participant-kyc-notice-links.mjs",
      "sha256": "1a10acf655796ebf4f08175158ea3dc2a1d0a0fdb3d13bb88573d6a0e5f4375e"
    },
    {
      "path": "tests/fixtures/meta-kyc-current-image-memory.mjs",
      "sha256": "20b288fa6b96bc5e3f833751ca00196b825fb5845b1460e3f6eef7806bced9d9"
    },
    {
      "path": "tests/fixtures/meta-kyc-step-reminder-memory.mjs",
      "sha256": "cd7cdf861042d1bbd6b72c139b782764c6e545f4db5209b8a235d583e21d886d"
    },
    {
      "path": "tests/production-focused-workspace-navigation.test.mjs",
      "sha256": "87ac26aa97c3efcb89bf2ce96abb0e9a2da9773f40fd3907f64815eaf8429b72"
    },
    {
      "path": "tests/production-meta-kyc-current-image.test.mjs",
      "sha256": "a3cc4671ee60b750426368363bcf3db12ead8316b25f5fdaeae8bcf6810587c6"
    },
    {
      "path": "tests/production-meta-kyc-guided-flow.test.mjs",
      "sha256": "9302ffe17168e59ac84d48693c47dd9cae8d9648e891f08168db6960c456bc1e"
    },
    {
      "path": "tests/production-meta-kyc-step-reminder.test.mjs",
      "sha256": "700093a70d2be869d42f26cd33bae9d5b729028413bc4cb5cab6b7af1b709e0f"
    },
    {
      "path": "tests/production-participant-kyc-notice-links.test.mjs",
      "sha256": "f2096aceb507eec4782e3c457e49c11089805a92d09f13b9669c41e5c458e737"
    },
    {
      "path": "tests/production-participant-kyc-notice-page.test.mjs",
      "sha256": "4bbd193893af0f8fef000cfdc35276cff1caad796f7246372f3d874de40ea184"
    },
    {
      "path": "tests/fixtures/integrated-identity-ui-producer-migration-86f2.json",
      "sha256": "00026e577701bbf8c0120a958262e5d12f88d96bd85bdf8355e70aa350640522"
    }
  ],
  "proofSourceDeltas": [
    {
      "id": "bank-intake-units",
      "family": "WORKSPACE_UNIT",
      "previousCount": 136,
      "previousPathsSha256": "bbc1ef863877e5005b695db70c94aecf9104b3894b2b558eaa858ccb1bc40849",
      "currentCount": 139,
      "currentPathsSha256": "4903f545a3b30380477561563262496477b10fc30eed030053083321b2b8dcf4",
      "additions": [
        "src/lib/meta-kyc-current-image.mjs",
        "src/lib/participant-kyc-chat-copy.mjs",
        "src/lib/participant-kyc-notice-links.mjs"
      ]
    },
    {
      "id": "bank-ui",
      "family": "WORKSPACE_UI_BANK",
      "previousCount": 138,
      "previousPathsSha256": "c11e8b4ada424f8cb5d84fd708bdf294ee5aed7ee78e6055aafc52a6f2b0d439",
      "currentCount": 143,
      "currentPathsSha256": "cae04a2e0c16e266bd5ae879e150ccff8e2ec0c155b5cb09ea050dc2836a6de6",
      "additions": [
        "src/app/(identity)/cuenta/participant-kyc-capture.js",
        "src/app/(identity)/cuenta/participant-kyc-capture.module.css",
        "src/lib/meta-kyc-current-image.mjs",
        "src/lib/participant-kyc-chat-copy.mjs",
        "src/lib/participant-kyc-notice-links.mjs"
      ]
    },
    {
      "id": "joint-ui",
      "family": "WORKSPACE_UI_JOINT",
      "previousCount": 139,
      "previousPathsSha256": "0bbeaf4446b55bd70b885088497979923ecf0ea78687fea81016169c60d316f5",
      "currentCount": 142,
      "currentPathsSha256": "c34d375a88ae4fe2be1624fdf4b98b4d2788401b3d2e0a9915b8976426abdab3",
      "additions": [
        "src/lib/meta-kyc-current-image.mjs",
        "src/lib/participant-kyc-chat-copy.mjs",
        "src/lib/participant-kyc-notice-links.mjs"
      ]
    },
    {
      "id": "joint-causal",
      "family": "WORKSPACE_UI_CAUSAL",
      "previousCount": 139,
      "previousPathsSha256": "0bbeaf4446b55bd70b885088497979923ecf0ea78687fea81016169c60d316f5",
      "currentCount": 142,
      "currentPathsSha256": "c34d375a88ae4fe2be1624fdf4b98b4d2788401b3d2e0a9915b8976426abdab3",
      "additions": [
        "src/lib/meta-kyc-current-image.mjs",
        "src/lib/participant-kyc-chat-copy.mjs",
        "src/lib/participant-kyc-notice-links.mjs"
      ]
    },
    {
      "id": "company-kyc-postgres",
      "family": "WORKSPACE_PG_COMPANY_KYC",
      "previousCount": 230,
      "previousPathsSha256": "ea9f247c2dd0d5e0273cedf6c5972a752287d5e454ee6c8725ea9d7718788063",
      "currentCount": 234,
      "currentPathsSha256": "8518028e316557ff1920c4395e6cf9c5a3a3b682e0f3dc5646f74d3224dd16b8",
      "additions": [
        "scripts/lib/kyc-current-image-native.mjs",
        "src/lib/meta-kyc-current-image.mjs",
        "src/lib/participant-kyc-chat-copy.mjs",
        "src/lib/participant-kyc-notice-links.mjs"
      ]
    },
    {
      "id": "identity-only-ui",
      "family": "WORKSPACE_UI_IDENTITY_ONLY",
      "previousCount": 139,
      "previousPathsSha256": "216e5505cc07b407d220179430ef7300100825f21729d14049e9ad711136b102",
      "currentCount": 144,
      "currentPathsSha256": "35aa758b5c040065d0d104c2a75ca049294b8823c8da9e41693359c1941e8e57",
      "additions": [
        "src/app/(identity)/cuenta/participant-kyc-capture.js",
        "src/app/(identity)/cuenta/participant-kyc-capture.module.css",
        "src/app/(identity)/cuenta/workspace-overview.js",
        "src/app/(identity)/cuenta/workspace-screen.js",
        "src/app/(identity)/cuenta/workspace-view-routing.mjs"
      ]
    },
    {
      "id": "field-canonical-postgres",
      "family": "WORKSPACE_PG_FIELD",
      "previousCount": 125,
      "previousPathsSha256": "a6bbff882e8a27bb30a074c3a7b4f0fc5d2455fa2d6ab1da2c607ead7bfe3462",
      "currentCount": 128,
      "currentPathsSha256": "4655f7b2e71f4fb5f3e9f6d71e00a5ccb828b9e87292566798cbc657ff812446",
      "additions": [
        "src/lib/meta-kyc-current-image.mjs",
        "src/lib/participant-kyc-chat-copy.mjs",
        "src/lib/participant-kyc-notice-links.mjs"
      ]
    },
    {
      "id": "overtime-canonical-postgres",
      "family": "WORKSPACE_PG_OVERTIME",
      "previousCount": 110,
      "previousPathsSha256": "b2ec20559b2bb25eeded0151b1b10e978a9a0e8ad9b23cc3de5f8b2d3c9db72d",
      "currentCount": 113,
      "currentPathsSha256": "d68a4ef55c57de688cf210a033da50f59cc2833be5f6cbfb4221dba58121ae0a",
      "additions": [
        "src/lib/meta-kyc-current-image.mjs",
        "src/lib/participant-kyc-chat-copy.mjs",
        "src/lib/participant-kyc-notice-links.mjs"
      ]
    },
    {
      "id": "participant-kyc-preanalysis-postgres",
      "family": "WORKSPACE_PG_PARTICIPANT_KYC_PREANALYSIS",
      "previousCount": 200,
      "previousPathsSha256": "64012c5b7be1d291bff1f861c7d81cf8480e2492e4fdfd101cafff42485d47d1",
      "currentCount": 229,
      "currentPathsSha256": "935ce4042c36639e55046301a2c72c93200cdc72f8a8d989ca7a8b403cffddee",
      "additions": [
        "scripts/lib/integrated-identity-current-ci-lineage.mjs",
        "scripts/lib/owned-fixture-cleanup.mjs",
        "scripts/verify-company-channel-kyc-postgres.mjs",
        "scripts/verify-company-kyc-outbound-compact-postgres.mjs",
        "scripts/verify-company-onboarding-ui.mjs",
        "scripts/verify-focused-workspace-ci.mjs",
        "scripts/verify-focused-workspace-ui.mjs",
        "scripts/verify-mobile-workspace-review-ui.mjs",
        "scripts/verify-onboarding-guide-ui.mjs",
        "scripts/verify-participant-project-navigation-ui.mjs",
        "scripts/verify-task-progress-measurement-ui.mjs",
        "scripts/verify-workspace-identity-only-ui.mjs",
        "scripts/verify-workspace-plan-recovery-ui.mjs",
        "scripts/verify-workspace-reload-ui.mjs",
        "scripts/verify-workspace-ui.mjs",
        "src/app/(identity)/cuenta/participant-kyc-capture.js",
        "src/app/(identity)/cuenta/participant-kyc-capture.module.css",
        "src/lib/meta-kyc-current-image.mjs",
        "src/lib/participant-kyc-chat-copy.mjs",
        "src/lib/participant-kyc-notice-links.mjs",
        "tests/fixtures/integrated-identity-contract-27aa.json",
        "tests/fixtures/integrated-identity-ui-producer-migration-86f2.json",
        "tests/production-focused-workspace-ci.test.mjs",
        "tests/production-focused-workspace-ui.test.mjs",
        "tests/production-integrated-identity-current-ci-lineage.test.mjs",
        "tests/production-integrated-identity-ui-producer-migration.test.mjs",
        "tests/production-meta-customer-composition.test.mjs",
        "tests/production-plan-import-link-ui.test.mjs",
        "tests/production-workspace-tools-navigation.test.mjs"
      ]
    }
  ],
  "consumerSourceDeltas": [
    {
      "family": "COMPACT",
      "previousCount": 132,
      "previousPathsSha256": "c01e1fa46c7e58cca89c6802061e3bddb328cbc025d3bb66c18184baacbc7b7f",
      "currentCount": 137,
      "currentPathsSha256": "ab60b810e098f47892e1a17cb01ce1f7f8e1796c1687776b528100e62cb3083f",
      "additions": [
        "scripts/lib/kyc-current-image-native.mjs",
        "scripts/lib/kyc-current-image-own-native.mjs",
        "src/lib/meta-kyc-current-image.mjs",
        "src/lib/participant-kyc-chat-copy.mjs",
        "src/lib/participant-kyc-notice-links.mjs"
      ],
      "previousFiles": [
        "package-lock.json",
        "package.json",
        "scripts/lib/company-channel-disposable-fixture.mjs",
        "scripts/lib/company-channel-migration.mjs",
        "scripts/lib/disposable-postgres-cleanup.mjs",
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
      ]
    },
    {
      "family": "CONSUMPTION_FEEDBACK",
      "previousCount": 112,
      "previousPathsSha256": "acaceb360e3f19ac337ff3652a1f639ae5f62ab8a67ce2f22f4e9ab034023097",
      "currentCount": 115,
      "currentPathsSha256": "06931a6d16cb815811453ba1bd84805eff33e85d330e4cd8734545ea609b5293",
      "additions": [
        "src/lib/meta-kyc-current-image.mjs",
        "src/lib/participant-kyc-chat-copy.mjs",
        "src/lib/participant-kyc-notice-links.mjs"
      ],
      "previousFiles": [
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
        "src/lib/participant-kyc-image-set.mjs",
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
      ]
    },
    {
      "family": "KYC_REPLY_FEEDBACK",
      "previousCount": 113,
      "previousPathsSha256": "0c085cf49bbb44b7b0209ccf0c403fbbf849842bd694d90ccd5ebeacf9cdf454",
      "currentCount": 116,
      "currentPathsSha256": "7da31ffc588909c21b24419726df66542847e84574eb77cf0f0abfc0360f6d74",
      "additions": [
        "src/lib/meta-kyc-current-image.mjs",
        "src/lib/participant-kyc-chat-copy.mjs",
        "src/lib/participant-kyc-notice-links.mjs"
      ],
      "previousFiles": [
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
        "src/lib/participant-kyc-image-set.mjs",
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
      ]
    },
    {
      "family": "ORGANIZATION_USAGE",
      "previousCount": 117,
      "previousPathsSha256": "4659886a7718823575816a16f9cc387384825273cb23bbaf55bf0b42103a482c",
      "currentCount": 120,
      "currentPathsSha256": "05bbc5d54c631590c7eb566e00f3df237a54d5ddf6d31b80b426e82aeb33d716",
      "additions": [
        "src/lib/meta-kyc-current-image.mjs",
        "src/lib/participant-kyc-chat-copy.mjs",
        "src/lib/participant-kyc-notice-links.mjs"
      ],
      "previousFiles": [
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
        "src/lib/participant-kyc-image-set.mjs",
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
      ]
    },
    {
      "family": "PLAN_MEASUREMENT",
      "previousCount": 115,
      "previousPathsSha256": "ddd8820928b43e671c75f6c6a2451fdddaed24f32fc75330335787e0f5ac71c1",
      "currentCount": 118,
      "currentPathsSha256": "46de4c3a85a638f039549525c031efbd0b75f72d4853a3024fe9d904d1c7e585",
      "additions": [
        "src/lib/meta-kyc-current-image.mjs",
        "src/lib/participant-kyc-chat-copy.mjs",
        "src/lib/participant-kyc-notice-links.mjs"
      ],
      "previousFiles": [
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
        "src/lib/participant-kyc-image-set.mjs",
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
      ]
    }
  ],
  "currentProofChanges": [
    {
      "id": "company-kyc-postgres",
      "previousProducerSha256": "825da6466a7f1ec4c500028785424a005be207e0ec25f894a96e6b9469fa1438",
      "currentProducerSha256": "a1410e44be6b7aaaf5a2e036263cbf1106cbe928551b2ceabe465d3576cd5973",
      "previousCheckNames": [
        "canonical-manager-prepares-B-with-original-A-channel-and-replay-never-reveals-a-new-code",
        "signed-callback-and-durable-A-prompt-required-no-guest-FIELD-route-or-cross-phone-target",
        "A-source-and-secret-AAD-with-B-capture-one-submission-two-private-images-and-lost-commit-recovery",
        "canonical-Clerk-invitation-acceptance-adopts-original-capture-other-reviewer-and-own-signed-VINCULAR",
        "canonical-current-revocation-denies-new-corporate-field-use-with-no-IO-or-business-write",
        "canonical-acceptance-before-original-IDENTIDAD-keeps-TTL-and-unit-once-own-capture-distinct-review-and-VINCULAR",
        "schema2-corporate-dorso-consent-and-three-images-require-immutable-A-source-B-target-with-no-FIELD-or-auto-grants",
        "schema2-corporate-incomplete-receipt-denies-and-lost-ACK-recovers-before-second-Graph-CDN-Blob",
        "schema2-corporate-canonical-Clerk-claim-adopts-three-original-images-and-private-back-download-before-distinct-human-review",
        "schema2-corporate-revocation-denies-private-dorso-with-original-capture-receipt-immutable",
        "COMPANY-schema2-expired-SENT-prompt-native-row-lock-race-one-receipt-outbox-HTTP-no-media-or-Worker-change",
        "COMPANY-expiry-native-COMMIT-applied-ACK-loss-vs-ROLLBACK-recovery-unknown-HTTP-never-retransmitted",
        "COMPANY-expiry-native-current-issuer-revocation-after-reserve-retains-marker-with-zero-HTTP-or-media",
        "COMPANY-context-native-old-signed-source-concurrent-single-outbox-HTTP-no-capture-writes",
        "COMPANY-context-native-neutral-ESTADO-IDENTIDAD-no-consent-or-private-media",
        "COMPANY-context-native-current-issuer-revocation-no-HTTP-no-media",
        "COMPANY-context-native-processor-pre-dispatch-no-capture-or-replay",
        "COMPANY-context-native-original-60s-lease-225ms-SQL-200ms-Graph-single-POST"
      ],
      "currentCheckNames": [
        "canonical-manager-prepares-B-with-original-A-channel-and-replay-never-reveals-a-new-code",
        "signed-callback-and-durable-A-prompt-required-no-guest-FIELD-route-or-cross-phone-target",
        "A-source-and-secret-AAD-with-B-capture-one-submission-two-private-images-and-lost-commit-recovery",
        "canonical-Clerk-invitation-acceptance-adopts-original-capture-other-reviewer-and-own-signed-VINCULAR",
        "canonical-current-revocation-denies-new-corporate-field-use-with-no-IO-or-business-write",
        "canonical-acceptance-before-original-IDENTIDAD-keeps-TTL-and-unit-once-own-capture-distinct-review-and-VINCULAR",
        "schema2-corporate-dorso-consent-and-three-images-require-immutable-A-source-B-target-with-no-FIELD-or-auto-grants",
        "schema2-corporate-incomplete-receipt-denies-and-lost-ACK-recovers-before-second-Graph-CDN-Blob",
        "schema2-corporate-canonical-Clerk-claim-adopts-three-original-images-and-private-back-download-before-distinct-human-review",
        "schema2-corporate-revocation-denies-private-dorso-with-original-capture-receipt-immutable",
        "COMPANY-schema2-expired-SENT-prompt-native-row-lock-race-one-receipt-outbox-HTTP-no-media-or-Worker-change",
        "COMPANY-expiry-native-COMMIT-applied-ACK-loss-vs-ROLLBACK-recovery-unknown-HTTP-never-retransmitted",
        "COMPANY-expiry-native-current-issuer-revocation-after-reserve-retains-marker-with-zero-HTTP-or-media",
        "COMPANY-context-native-old-signed-source-concurrent-single-outbox-HTTP-no-capture-writes",
        "COMPANY-context-native-neutral-ESTADO-IDENTIDAD-no-consent-or-private-media",
        "COMPANY-context-native-current-issuer-revocation-no-HTTP-no-media",
        "COMPANY-context-native-processor-pre-dispatch-no-capture-or-replay",
        "COMPANY-context-native-original-60s-lease-225ms-SQL-200ms-Graph-single-POST",
        "COMPANY-CURRENT-image-native-signed-production-priority-three-images-causal-receipts-locks-rollback-recovery-and-current-fences"
      ]
    },
    {
      "id": "participant-kyc-preanalysis-postgres",
      "previousProducerSha256": "fba95d2e56b6900e5bc37064a3b1910c161ca5627a89cc97d0b2a1f0dbfd2081",
      "currentProducerSha256": "1b420bfd0ef59638c6caa23cee4e54a4e6b4df69616b43f2782375118ea52198",
      "previousCheckNames": [
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
      "currentCheckNames": [
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
      ]
    },
    {
      "id": "identity-only-ui",
      "previousProducerSha256": "f9b07f016b0ae9fe15497a63f6bc23ce996b42c45e29e19ef6c9e9f1a582e7d9",
      "currentProducerSha256": "e11ed3c52c998f84c0e7ed21ebbe806a1aa8816007b7819203e7d6c4ef4add19",
      "previousCheckNames": [
        "{\"director\":false,\"name\":\"private-identity-submission-uncertain-receipt-and-explicit-approval-refresh\",\"posts\":1,\"receiptGets\":1,\"reload\":false,\"width\":320}",
        "{\"code\":\"WORKSPACE_PROJECT_UNAVAILABLE\",\"name\":\"noncanonical-denial-cannot-open-private-or-operative-ui\",\"status\":403,\"type\":\"application/json\",\"width\":320}",
        "{\"code\":\"WORKSPACE_PROJECT_UNAVAILABLE\",\"name\":\"noncanonical-denial-cannot-open-private-or-operative-ui\",\"status\":403,\"type\":\"text/html\",\"width\":320}",
        "{\"name\":\"revoked-workspace-hides-loaded-tasks-and-only-own-private-read-remains\",\"ownDenied\":false,\"width\":320}",
        "{\"name\":\"late-prior-project-denial-cannot-replace-authorized-project\",\"width\":320}",
        "{\"name\":\"late-prior-company-response-cannot-restore-private-context\",\"width\":320}",
        "{\"name\":\"token-held-prior-company-never-dispatches-after-context-change\",\"width\":320}",
        "{\"action\":\"REVOKE_TEMPLATE_MESSAGES\",\"name\":\"own-private-withdrawal-without-KYC-admission\",\"posts\":1,\"receiptGets\":0,\"reload\":false,\"status\":\"PENDING_REVIEW\",\"width\":320}",
        "{\"action\":\"UNLINK\",\"name\":\"own-private-withdrawal-without-KYC-admission\",\"posts\":1,\"receiptGets\":0,\"reload\":false,\"status\":\"PENDING_REVIEW\",\"width\":320}",
        "{\"action\":\"REVOKE_TEMPLATE_MESSAGES\",\"name\":\"own-private-withdrawal-without-KYC-admission\",\"posts\":1,\"receiptGets\":0,\"reload\":false,\"status\":\"REJECTED\",\"width\":320}",
        "{\"action\":\"UNLINK\",\"name\":\"own-private-withdrawal-without-KYC-admission\",\"posts\":1,\"receiptGets\":0,\"reload\":false,\"status\":\"REJECTED\",\"width\":320}",
        "{\"action\":\"REVOKE_TEMPLATE_MESSAGES\",\"durableReference\":true,\"name\":\"own-withdrawal-lost-response-reload-recovers-same-UUID-without-second-POST\",\"posts\":1,\"receiptGets\":1,\"reload\":true,\"sameOperationId\":true,\"status\":\"PENDING_REVIEW\",\"width\":320}",
        "{\"action\":\"UNLINK\",\"durableReference\":true,\"name\":\"own-withdrawal-lost-response-reload-recovers-same-UUID-without-second-POST\",\"posts\":1,\"receiptGets\":1,\"reload\":true,\"sameOperationId\":true,\"status\":\"REJECTED\",\"width\":320}",
        "{\"name\":\"late-approved-channel-DTO-never-exposes-codes-grant-chat-or-workspace\",\"width\":320}",
        "{\"name\":\"late-channel-read-cannot-cross-project\",\"width\":320}",
        "{\"name\":\"late-channel-read-cannot-cross-account\",\"width\":320}",
        "{\"name\":\"withdrawal-held-token-cancels-before-POST-on-account-change\",\"width\":320}",
        "{\"name\":\"dispatched-withdrawal-account-change-keeps-durable-receipt-without-rePOST\",\"width\":320}",
        "{\"code\":\"WORKSPACE_PROJECT_UNAVAILABLE\",\"name\":\"revoked-private-channel-assignment-or-membership-hides-current-records\",\"status\":403,\"width\":320}",
        "{\"code\":\"WORKSPACE_MEMBERSHIP_REQUIRED\",\"name\":\"revoked-private-channel-assignment-or-membership-hides-current-records\",\"status\":403,\"width\":320}",
        "{\"code\":\"WORKSPACE_PROJECT_UNAVAILABLE\",\"name\":\"revoked-private-channel-assignment-or-membership-hides-current-records\",\"status\":404,\"width\":320}",
        "{\"durableReference\":true,\"name\":\"canonical-project-404-after-withdrawal-dispatch-keeps-UUID-and-receipt-reference\",\"receiptGets\":1,\"sameOperationId\":true,\"width\":320}",
        "{\"durableReference\":true,\"name\":\"canonical-reference-GET-404-hides-loaded-record-and-retains-original-cross-tab-UUID\",\"posts\":1,\"receiptGets\":2,\"sameOperationId\":true,\"width\":320}",
        "{\"name\":\"own-APPROVED-requires-explicit-fresh-canonical-project-check-before-workspace\",\"width\":320}",
        "{\"director\":false,\"name\":\"private-identity-submission-uncertain-receipt-and-explicit-approval-refresh\",\"posts\":1,\"receiptGets\":1,\"reload\":false,\"width\":390}",
        "{\"code\":\"WORKSPACE_PROJECT_UNAVAILABLE\",\"name\":\"noncanonical-denial-cannot-open-private-or-operative-ui\",\"status\":403,\"type\":\"application/json\",\"width\":390}",
        "{\"code\":\"WORKSPACE_PROJECT_UNAVAILABLE\",\"name\":\"noncanonical-denial-cannot-open-private-or-operative-ui\",\"status\":403,\"type\":\"text/html\",\"width\":390}",
        "{\"name\":\"revoked-workspace-hides-loaded-tasks-and-only-own-private-read-remains\",\"ownDenied\":false,\"width\":390}",
        "{\"name\":\"late-prior-project-denial-cannot-replace-authorized-project\",\"width\":390}",
        "{\"name\":\"late-prior-company-response-cannot-restore-private-context\",\"width\":390}",
        "{\"name\":\"token-held-prior-company-never-dispatches-after-context-change\",\"width\":390}",
        "{\"action\":\"REVOKE_TEMPLATE_MESSAGES\",\"name\":\"own-private-withdrawal-without-KYC-admission\",\"posts\":1,\"receiptGets\":0,\"reload\":false,\"status\":\"PENDING_REVIEW\",\"width\":390}",
        "{\"action\":\"UNLINK\",\"name\":\"own-private-withdrawal-without-KYC-admission\",\"posts\":1,\"receiptGets\":0,\"reload\":false,\"status\":\"PENDING_REVIEW\",\"width\":390}",
        "{\"action\":\"REVOKE_TEMPLATE_MESSAGES\",\"name\":\"own-private-withdrawal-without-KYC-admission\",\"posts\":1,\"receiptGets\":0,\"reload\":false,\"status\":\"REJECTED\",\"width\":390}",
        "{\"action\":\"UNLINK\",\"name\":\"own-private-withdrawal-without-KYC-admission\",\"posts\":1,\"receiptGets\":0,\"reload\":false,\"status\":\"REJECTED\",\"width\":390}",
        "{\"action\":\"REVOKE_TEMPLATE_MESSAGES\",\"durableReference\":true,\"name\":\"own-withdrawal-lost-response-reload-recovers-same-UUID-without-second-POST\",\"posts\":1,\"receiptGets\":1,\"reload\":true,\"sameOperationId\":true,\"status\":\"PENDING_REVIEW\",\"width\":390}",
        "{\"action\":\"UNLINK\",\"durableReference\":true,\"name\":\"own-withdrawal-lost-response-reload-recovers-same-UUID-without-second-POST\",\"posts\":1,\"receiptGets\":1,\"reload\":true,\"sameOperationId\":true,\"status\":\"REJECTED\",\"width\":390}",
        "{\"name\":\"late-approved-channel-DTO-never-exposes-codes-grant-chat-or-workspace\",\"width\":390}",
        "{\"name\":\"late-channel-read-cannot-cross-project\",\"width\":390}",
        "{\"name\":\"late-channel-read-cannot-cross-account\",\"width\":390}",
        "{\"name\":\"withdrawal-held-token-cancels-before-POST-on-account-change\",\"width\":390}",
        "{\"name\":\"dispatched-withdrawal-account-change-keeps-durable-receipt-without-rePOST\",\"width\":390}",
        "{\"code\":\"WORKSPACE_PROJECT_UNAVAILABLE\",\"name\":\"revoked-private-channel-assignment-or-membership-hides-current-records\",\"status\":403,\"width\":390}",
        "{\"code\":\"WORKSPACE_MEMBERSHIP_REQUIRED\",\"name\":\"revoked-private-channel-assignment-or-membership-hides-current-records\",\"status\":403,\"width\":390}",
        "{\"code\":\"WORKSPACE_PROJECT_UNAVAILABLE\",\"name\":\"revoked-private-channel-assignment-or-membership-hides-current-records\",\"status\":404,\"width\":390}",
        "{\"durableReference\":true,\"name\":\"canonical-project-404-after-withdrawal-dispatch-keeps-UUID-and-receipt-reference\",\"receiptGets\":1,\"sameOperationId\":true,\"width\":390}",
        "{\"durableReference\":true,\"name\":\"canonical-reference-GET-404-hides-loaded-record-and-retains-original-cross-tab-UUID\",\"posts\":1,\"receiptGets\":2,\"sameOperationId\":true,\"width\":390}",
        "{\"name\":\"own-APPROVED-requires-explicit-fresh-canonical-project-check-before-workspace\",\"width\":390}",
        "{\"director\":false,\"name\":\"private-identity-submission-uncertain-receipt-and-explicit-approval-refresh\",\"posts\":1,\"receiptGets\":1,\"reload\":false,\"width\":768}",
        "{\"code\":\"WORKSPACE_PROJECT_UNAVAILABLE\",\"name\":\"noncanonical-denial-cannot-open-private-or-operative-ui\",\"status\":403,\"type\":\"application/json\",\"width\":768}",
        "{\"code\":\"WORKSPACE_PROJECT_UNAVAILABLE\",\"name\":\"noncanonical-denial-cannot-open-private-or-operative-ui\",\"status\":403,\"type\":\"text/html\",\"width\":768}",
        "{\"name\":\"revoked-workspace-hides-loaded-tasks-and-only-own-private-read-remains\",\"ownDenied\":false,\"width\":768}",
        "{\"name\":\"late-prior-project-denial-cannot-replace-authorized-project\",\"width\":768}",
        "{\"name\":\"late-prior-company-response-cannot-restore-private-context\",\"width\":768}",
        "{\"name\":\"token-held-prior-company-never-dispatches-after-context-change\",\"width\":768}",
        "{\"action\":\"REVOKE_TEMPLATE_MESSAGES\",\"name\":\"own-private-withdrawal-without-KYC-admission\",\"posts\":1,\"receiptGets\":0,\"reload\":false,\"status\":\"PENDING_REVIEW\",\"width\":768}",
        "{\"action\":\"UNLINK\",\"name\":\"own-private-withdrawal-without-KYC-admission\",\"posts\":1,\"receiptGets\":0,\"reload\":false,\"status\":\"PENDING_REVIEW\",\"width\":768}",
        "{\"action\":\"REVOKE_TEMPLATE_MESSAGES\",\"name\":\"own-private-withdrawal-without-KYC-admission\",\"posts\":1,\"receiptGets\":0,\"reload\":false,\"status\":\"REJECTED\",\"width\":768}",
        "{\"action\":\"UNLINK\",\"name\":\"own-private-withdrawal-without-KYC-admission\",\"posts\":1,\"receiptGets\":0,\"reload\":false,\"status\":\"REJECTED\",\"width\":768}",
        "{\"action\":\"REVOKE_TEMPLATE_MESSAGES\",\"durableReference\":true,\"name\":\"own-withdrawal-lost-response-reload-recovers-same-UUID-without-second-POST\",\"posts\":1,\"receiptGets\":1,\"reload\":true,\"sameOperationId\":true,\"status\":\"PENDING_REVIEW\",\"width\":768}",
        "{\"action\":\"UNLINK\",\"durableReference\":true,\"name\":\"own-withdrawal-lost-response-reload-recovers-same-UUID-without-second-POST\",\"posts\":1,\"receiptGets\":1,\"reload\":true,\"sameOperationId\":true,\"status\":\"REJECTED\",\"width\":768}",
        "{\"name\":\"late-approved-channel-DTO-never-exposes-codes-grant-chat-or-workspace\",\"width\":768}",
        "{\"name\":\"late-channel-read-cannot-cross-project\",\"width\":768}",
        "{\"name\":\"late-channel-read-cannot-cross-account\",\"width\":768}",
        "{\"name\":\"withdrawal-held-token-cancels-before-POST-on-account-change\",\"width\":768}",
        "{\"name\":\"dispatched-withdrawal-account-change-keeps-durable-receipt-without-rePOST\",\"width\":768}",
        "{\"code\":\"WORKSPACE_PROJECT_UNAVAILABLE\",\"name\":\"revoked-private-channel-assignment-or-membership-hides-current-records\",\"status\":403,\"width\":768}",
        "{\"code\":\"WORKSPACE_MEMBERSHIP_REQUIRED\",\"name\":\"revoked-private-channel-assignment-or-membership-hides-current-records\",\"status\":403,\"width\":768}",
        "{\"code\":\"WORKSPACE_PROJECT_UNAVAILABLE\",\"name\":\"revoked-private-channel-assignment-or-membership-hides-current-records\",\"status\":404,\"width\":768}",
        "{\"durableReference\":true,\"name\":\"canonical-project-404-after-withdrawal-dispatch-keeps-UUID-and-receipt-reference\",\"receiptGets\":1,\"sameOperationId\":true,\"width\":768}",
        "{\"durableReference\":true,\"name\":\"canonical-reference-GET-404-hides-loaded-record-and-retains-original-cross-tab-UUID\",\"posts\":1,\"receiptGets\":2,\"sameOperationId\":true,\"width\":768}",
        "{\"name\":\"own-APPROVED-requires-explicit-fresh-canonical-project-check-before-workspace\",\"width\":768}",
        "{\"director\":false,\"name\":\"private-identity-submission-uncertain-receipt-and-explicit-approval-refresh\",\"posts\":1,\"receiptGets\":1,\"reload\":false,\"width\":1280}",
        "{\"code\":\"WORKSPACE_PROJECT_UNAVAILABLE\",\"name\":\"noncanonical-denial-cannot-open-private-or-operative-ui\",\"status\":403,\"type\":\"application/json\",\"width\":1280}",
        "{\"code\":\"WORKSPACE_PROJECT_UNAVAILABLE\",\"name\":\"noncanonical-denial-cannot-open-private-or-operative-ui\",\"status\":403,\"type\":\"text/html\",\"width\":1280}",
        "{\"name\":\"revoked-workspace-hides-loaded-tasks-and-only-own-private-read-remains\",\"ownDenied\":false,\"width\":1280}",
        "{\"name\":\"late-prior-project-denial-cannot-replace-authorized-project\",\"width\":1280}",
        "{\"name\":\"late-prior-company-response-cannot-restore-private-context\",\"width\":1280}",
        "{\"name\":\"token-held-prior-company-never-dispatches-after-context-change\",\"width\":1280}",
        "{\"action\":\"REVOKE_TEMPLATE_MESSAGES\",\"name\":\"own-private-withdrawal-without-KYC-admission\",\"posts\":1,\"receiptGets\":0,\"reload\":false,\"status\":\"PENDING_REVIEW\",\"width\":1280}",
        "{\"action\":\"UNLINK\",\"name\":\"own-private-withdrawal-without-KYC-admission\",\"posts\":1,\"receiptGets\":0,\"reload\":false,\"status\":\"PENDING_REVIEW\",\"width\":1280}",
        "{\"action\":\"REVOKE_TEMPLATE_MESSAGES\",\"name\":\"own-private-withdrawal-without-KYC-admission\",\"posts\":1,\"receiptGets\":0,\"reload\":false,\"status\":\"REJECTED\",\"width\":1280}",
        "{\"action\":\"UNLINK\",\"name\":\"own-private-withdrawal-without-KYC-admission\",\"posts\":1,\"receiptGets\":0,\"reload\":false,\"status\":\"REJECTED\",\"width\":1280}",
        "{\"action\":\"REVOKE_TEMPLATE_MESSAGES\",\"durableReference\":true,\"name\":\"own-withdrawal-lost-response-reload-recovers-same-UUID-without-second-POST\",\"posts\":1,\"receiptGets\":1,\"reload\":true,\"sameOperationId\":true,\"status\":\"PENDING_REVIEW\",\"width\":1280}",
        "{\"action\":\"UNLINK\",\"durableReference\":true,\"name\":\"own-withdrawal-lost-response-reload-recovers-same-UUID-without-second-POST\",\"posts\":1,\"receiptGets\":1,\"reload\":true,\"sameOperationId\":true,\"status\":\"REJECTED\",\"width\":1280}",
        "{\"name\":\"late-approved-channel-DTO-never-exposes-codes-grant-chat-or-workspace\",\"width\":1280}",
        "{\"name\":\"late-channel-read-cannot-cross-project\",\"width\":1280}",
        "{\"name\":\"late-channel-read-cannot-cross-account\",\"width\":1280}",
        "{\"name\":\"withdrawal-held-token-cancels-before-POST-on-account-change\",\"width\":1280}",
        "{\"name\":\"dispatched-withdrawal-account-change-keeps-durable-receipt-without-rePOST\",\"width\":1280}",
        "{\"code\":\"WORKSPACE_PROJECT_UNAVAILABLE\",\"name\":\"revoked-private-channel-assignment-or-membership-hides-current-records\",\"status\":403,\"width\":1280}",
        "{\"code\":\"WORKSPACE_MEMBERSHIP_REQUIRED\",\"name\":\"revoked-private-channel-assignment-or-membership-hides-current-records\",\"status\":403,\"width\":1280}",
        "{\"code\":\"WORKSPACE_PROJECT_UNAVAILABLE\",\"name\":\"revoked-private-channel-assignment-or-membership-hides-current-records\",\"status\":404,\"width\":1280}",
        "{\"durableReference\":true,\"name\":\"canonical-project-404-after-withdrawal-dispatch-keeps-UUID-and-receipt-reference\",\"receiptGets\":1,\"sameOperationId\":true,\"width\":1280}",
        "{\"durableReference\":true,\"name\":\"canonical-reference-GET-404-hides-loaded-record-and-retains-original-cross-tab-UUID\",\"posts\":1,\"receiptGets\":2,\"sameOperationId\":true,\"width\":1280}",
        "{\"name\":\"own-APPROVED-requires-explicit-fresh-canonical-project-check-before-workspace\",\"width\":1280}",
        "{\"director\":false,\"name\":\"private-identity-submission-uncertain-receipt-and-explicit-approval-refresh\",\"posts\":1,\"receiptGets\":1,\"reload\":true,\"width\":390}",
        "{\"director\":true,\"name\":\"private-identity-submission-uncertain-receipt-and-explicit-approval-refresh\",\"posts\":1,\"receiptGets\":1,\"reload\":false,\"width\":390}",
        "{\"name\":\"revoked-workspace-hides-loaded-tasks-and-only-own-private-read-remains\",\"ownDenied\":true,\"width\":390}",
        "{\"name\":\"bootstrap-administrator-without-worker-keeps-server-authorized-operation\",\"width\":390}",
        "{\"code\":\"PARTICIPANT_KYC_REVIEW_REQUIRED\",\"name\":\"noncanonical-denial-cannot-open-private-or-operative-ui\",\"status\":401,\"type\":\"application/json\",\"width\":390}",
        "{\"code\":\"PARTICIPANT_KYC_REVIEW_REQUIRED\",\"name\":\"noncanonical-denial-cannot-open-private-or-operative-ui\",\"status\":409,\"type\":\"application/json\",\"width\":390}",
        "{\"code\":\"PARTICIPANT_KYC_REVIEW_REQUIRED\",\"name\":\"noncanonical-denial-cannot-open-private-or-operative-ui\",\"status\":500,\"type\":\"application/json\",\"width\":390}"
      ],
      "currentCheckNames": [
        "{\"director\":false,\"name\":\"private-identity-submission-uncertain-receipt-and-explicit-approval-refresh\",\"posts\":1,\"receiptGets\":1,\"reload\":false,\"width\":320}",
        "{\"code\":\"WORKSPACE_PROJECT_UNAVAILABLE\",\"name\":\"noncanonical-denial-cannot-open-private-or-operative-ui\",\"status\":403,\"type\":\"application/json\",\"width\":320}",
        "{\"code\":\"WORKSPACE_PROJECT_UNAVAILABLE\",\"name\":\"noncanonical-denial-cannot-open-private-or-operative-ui\",\"status\":403,\"type\":\"text/html\",\"width\":320}",
        "{\"name\":\"revoked-workspace-hides-loaded-tasks-and-only-own-private-read-remains\",\"ownDenied\":false,\"width\":320}",
        "{\"name\":\"late-prior-project-denial-cannot-replace-authorized-project\",\"width\":320}",
        "{\"name\":\"late-prior-company-response-cannot-restore-private-context\",\"width\":320}",
        "{\"name\":\"token-held-prior-company-never-dispatches-after-context-change\",\"width\":320}",
        "{\"action\":\"REVOKE_TEMPLATE_MESSAGES\",\"name\":\"own-private-withdrawal-without-KYC-admission\",\"posts\":1,\"receiptGets\":0,\"reload\":false,\"status\":\"PENDING_REVIEW\",\"width\":320}",
        "{\"action\":\"UNLINK\",\"name\":\"own-private-withdrawal-without-KYC-admission\",\"posts\":1,\"receiptGets\":0,\"reload\":false,\"status\":\"PENDING_REVIEW\",\"width\":320}",
        "{\"action\":\"REVOKE_TEMPLATE_MESSAGES\",\"name\":\"own-private-withdrawal-without-KYC-admission\",\"posts\":1,\"receiptGets\":0,\"reload\":false,\"status\":\"REJECTED\",\"width\":320}",
        "{\"action\":\"UNLINK\",\"name\":\"own-private-withdrawal-without-KYC-admission\",\"posts\":1,\"receiptGets\":0,\"reload\":false,\"status\":\"REJECTED\",\"width\":320}",
        "{\"action\":\"REVOKE_TEMPLATE_MESSAGES\",\"durableReference\":true,\"name\":\"own-withdrawal-lost-response-reload-recovers-same-UUID-without-second-POST\",\"posts\":1,\"receiptGets\":1,\"reload\":true,\"sameOperationId\":true,\"status\":\"PENDING_REVIEW\",\"width\":320}",
        "{\"action\":\"UNLINK\",\"durableReference\":true,\"name\":\"own-withdrawal-lost-response-reload-recovers-same-UUID-without-second-POST\",\"posts\":1,\"receiptGets\":1,\"reload\":true,\"sameOperationId\":true,\"status\":\"REJECTED\",\"width\":320}",
        "{\"name\":\"late-approved-channel-DTO-never-exposes-codes-grant-chat-or-workspace\",\"width\":320}",
        "{\"name\":\"late-channel-read-cannot-cross-project\",\"width\":320}",
        "{\"name\":\"late-channel-read-cannot-cross-account\",\"width\":320}",
        "{\"name\":\"withdrawal-held-token-cancels-before-POST-on-account-change\",\"width\":320}",
        "{\"name\":\"dispatched-withdrawal-account-change-keeps-durable-receipt-without-rePOST\",\"width\":320}",
        "{\"code\":\"WORKSPACE_PROJECT_UNAVAILABLE\",\"name\":\"revoked-private-channel-assignment-or-membership-hides-current-records\",\"status\":403,\"width\":320}",
        "{\"code\":\"WORKSPACE_MEMBERSHIP_REQUIRED\",\"name\":\"revoked-private-channel-assignment-or-membership-hides-current-records\",\"status\":403,\"width\":320}",
        "{\"code\":\"WORKSPACE_PROJECT_UNAVAILABLE\",\"name\":\"revoked-private-channel-assignment-or-membership-hides-current-records\",\"status\":404,\"width\":320}",
        "{\"durableReference\":true,\"name\":\"canonical-project-404-after-withdrawal-dispatch-keeps-UUID-and-receipt-reference\",\"receiptGets\":1,\"sameOperationId\":true,\"width\":320}",
        "{\"durableReference\":true,\"name\":\"canonical-reference-GET-404-hides-loaded-record-and-retains-original-cross-tab-UUID\",\"posts\":1,\"receiptGets\":2,\"sameOperationId\":true,\"width\":320}",
        "{\"name\":\"own-APPROVED-requires-explicit-fresh-canonical-project-check-before-workspace\",\"width\":320}",
        "{\"director\":false,\"name\":\"private-identity-submission-uncertain-receipt-and-explicit-approval-refresh\",\"posts\":1,\"receiptGets\":1,\"reload\":false,\"width\":390}",
        "{\"code\":\"WORKSPACE_PROJECT_UNAVAILABLE\",\"name\":\"noncanonical-denial-cannot-open-private-or-operative-ui\",\"status\":403,\"type\":\"application/json\",\"width\":390}",
        "{\"code\":\"WORKSPACE_PROJECT_UNAVAILABLE\",\"name\":\"noncanonical-denial-cannot-open-private-or-operative-ui\",\"status\":403,\"type\":\"text/html\",\"width\":390}",
        "{\"name\":\"revoked-workspace-hides-loaded-tasks-and-only-own-private-read-remains\",\"ownDenied\":false,\"width\":390}",
        "{\"name\":\"late-prior-project-denial-cannot-replace-authorized-project\",\"width\":390}",
        "{\"name\":\"late-prior-company-response-cannot-restore-private-context\",\"width\":390}",
        "{\"name\":\"token-held-prior-company-never-dispatches-after-context-change\",\"width\":390}",
        "{\"action\":\"REVOKE_TEMPLATE_MESSAGES\",\"name\":\"own-private-withdrawal-without-KYC-admission\",\"posts\":1,\"receiptGets\":0,\"reload\":false,\"status\":\"PENDING_REVIEW\",\"width\":390}",
        "{\"action\":\"UNLINK\",\"name\":\"own-private-withdrawal-without-KYC-admission\",\"posts\":1,\"receiptGets\":0,\"reload\":false,\"status\":\"PENDING_REVIEW\",\"width\":390}",
        "{\"action\":\"REVOKE_TEMPLATE_MESSAGES\",\"name\":\"own-private-withdrawal-without-KYC-admission\",\"posts\":1,\"receiptGets\":0,\"reload\":false,\"status\":\"REJECTED\",\"width\":390}",
        "{\"action\":\"UNLINK\",\"name\":\"own-private-withdrawal-without-KYC-admission\",\"posts\":1,\"receiptGets\":0,\"reload\":false,\"status\":\"REJECTED\",\"width\":390}",
        "{\"action\":\"REVOKE_TEMPLATE_MESSAGES\",\"durableReference\":true,\"name\":\"own-withdrawal-lost-response-reload-recovers-same-UUID-without-second-POST\",\"posts\":1,\"receiptGets\":1,\"reload\":true,\"sameOperationId\":true,\"status\":\"PENDING_REVIEW\",\"width\":390}",
        "{\"action\":\"UNLINK\",\"durableReference\":true,\"name\":\"own-withdrawal-lost-response-reload-recovers-same-UUID-without-second-POST\",\"posts\":1,\"receiptGets\":1,\"reload\":true,\"sameOperationId\":true,\"status\":\"REJECTED\",\"width\":390}",
        "{\"name\":\"late-approved-channel-DTO-never-exposes-codes-grant-chat-or-workspace\",\"width\":390}",
        "{\"name\":\"late-channel-read-cannot-cross-project\",\"width\":390}",
        "{\"name\":\"late-channel-read-cannot-cross-account\",\"width\":390}",
        "{\"name\":\"withdrawal-held-token-cancels-before-POST-on-account-change\",\"width\":390}",
        "{\"name\":\"dispatched-withdrawal-account-change-keeps-durable-receipt-without-rePOST\",\"width\":390}",
        "{\"code\":\"WORKSPACE_PROJECT_UNAVAILABLE\",\"name\":\"revoked-private-channel-assignment-or-membership-hides-current-records\",\"status\":403,\"width\":390}",
        "{\"code\":\"WORKSPACE_MEMBERSHIP_REQUIRED\",\"name\":\"revoked-private-channel-assignment-or-membership-hides-current-records\",\"status\":403,\"width\":390}",
        "{\"code\":\"WORKSPACE_PROJECT_UNAVAILABLE\",\"name\":\"revoked-private-channel-assignment-or-membership-hides-current-records\",\"status\":404,\"width\":390}",
        "{\"durableReference\":true,\"name\":\"canonical-project-404-after-withdrawal-dispatch-keeps-UUID-and-receipt-reference\",\"receiptGets\":1,\"sameOperationId\":true,\"width\":390}",
        "{\"durableReference\":true,\"name\":\"canonical-reference-GET-404-hides-loaded-record-and-retains-original-cross-tab-UUID\",\"posts\":1,\"receiptGets\":2,\"sameOperationId\":true,\"width\":390}",
        "{\"name\":\"own-APPROVED-requires-explicit-fresh-canonical-project-check-before-workspace\",\"width\":390}",
        "{\"director\":false,\"name\":\"private-identity-submission-uncertain-receipt-and-explicit-approval-refresh\",\"posts\":1,\"receiptGets\":1,\"reload\":false,\"width\":768}",
        "{\"code\":\"WORKSPACE_PROJECT_UNAVAILABLE\",\"name\":\"noncanonical-denial-cannot-open-private-or-operative-ui\",\"status\":403,\"type\":\"application/json\",\"width\":768}",
        "{\"code\":\"WORKSPACE_PROJECT_UNAVAILABLE\",\"name\":\"noncanonical-denial-cannot-open-private-or-operative-ui\",\"status\":403,\"type\":\"text/html\",\"width\":768}",
        "{\"name\":\"revoked-workspace-hides-loaded-tasks-and-only-own-private-read-remains\",\"ownDenied\":false,\"width\":768}",
        "{\"name\":\"late-prior-project-denial-cannot-replace-authorized-project\",\"width\":768}",
        "{\"name\":\"late-prior-company-response-cannot-restore-private-context\",\"width\":768}",
        "{\"name\":\"token-held-prior-company-never-dispatches-after-context-change\",\"width\":768}",
        "{\"action\":\"REVOKE_TEMPLATE_MESSAGES\",\"name\":\"own-private-withdrawal-without-KYC-admission\",\"posts\":1,\"receiptGets\":0,\"reload\":false,\"status\":\"PENDING_REVIEW\",\"width\":768}",
        "{\"action\":\"UNLINK\",\"name\":\"own-private-withdrawal-without-KYC-admission\",\"posts\":1,\"receiptGets\":0,\"reload\":false,\"status\":\"PENDING_REVIEW\",\"width\":768}",
        "{\"action\":\"REVOKE_TEMPLATE_MESSAGES\",\"name\":\"own-private-withdrawal-without-KYC-admission\",\"posts\":1,\"receiptGets\":0,\"reload\":false,\"status\":\"REJECTED\",\"width\":768}",
        "{\"action\":\"UNLINK\",\"name\":\"own-private-withdrawal-without-KYC-admission\",\"posts\":1,\"receiptGets\":0,\"reload\":false,\"status\":\"REJECTED\",\"width\":768}",
        "{\"action\":\"REVOKE_TEMPLATE_MESSAGES\",\"durableReference\":true,\"name\":\"own-withdrawal-lost-response-reload-recovers-same-UUID-without-second-POST\",\"posts\":1,\"receiptGets\":1,\"reload\":true,\"sameOperationId\":true,\"status\":\"PENDING_REVIEW\",\"width\":768}",
        "{\"action\":\"UNLINK\",\"durableReference\":true,\"name\":\"own-withdrawal-lost-response-reload-recovers-same-UUID-without-second-POST\",\"posts\":1,\"receiptGets\":1,\"reload\":true,\"sameOperationId\":true,\"status\":\"REJECTED\",\"width\":768}",
        "{\"name\":\"late-approved-channel-DTO-never-exposes-codes-grant-chat-or-workspace\",\"width\":768}",
        "{\"name\":\"late-channel-read-cannot-cross-project\",\"width\":768}",
        "{\"name\":\"late-channel-read-cannot-cross-account\",\"width\":768}",
        "{\"name\":\"withdrawal-held-token-cancels-before-POST-on-account-change\",\"width\":768}",
        "{\"name\":\"dispatched-withdrawal-account-change-keeps-durable-receipt-without-rePOST\",\"width\":768}",
        "{\"code\":\"WORKSPACE_PROJECT_UNAVAILABLE\",\"name\":\"revoked-private-channel-assignment-or-membership-hides-current-records\",\"status\":403,\"width\":768}",
        "{\"code\":\"WORKSPACE_MEMBERSHIP_REQUIRED\",\"name\":\"revoked-private-channel-assignment-or-membership-hides-current-records\",\"status\":403,\"width\":768}",
        "{\"code\":\"WORKSPACE_PROJECT_UNAVAILABLE\",\"name\":\"revoked-private-channel-assignment-or-membership-hides-current-records\",\"status\":404,\"width\":768}",
        "{\"durableReference\":true,\"name\":\"canonical-project-404-after-withdrawal-dispatch-keeps-UUID-and-receipt-reference\",\"receiptGets\":1,\"sameOperationId\":true,\"width\":768}",
        "{\"durableReference\":true,\"name\":\"canonical-reference-GET-404-hides-loaded-record-and-retains-original-cross-tab-UUID\",\"posts\":1,\"receiptGets\":2,\"sameOperationId\":true,\"width\":768}",
        "{\"name\":\"own-APPROVED-requires-explicit-fresh-canonical-project-check-before-workspace\",\"width\":768}",
        "{\"director\":false,\"name\":\"private-identity-submission-uncertain-receipt-and-explicit-approval-refresh\",\"posts\":1,\"receiptGets\":1,\"reload\":false,\"width\":1280}",
        "{\"code\":\"WORKSPACE_PROJECT_UNAVAILABLE\",\"name\":\"noncanonical-denial-cannot-open-private-or-operative-ui\",\"status\":403,\"type\":\"application/json\",\"width\":1280}",
        "{\"code\":\"WORKSPACE_PROJECT_UNAVAILABLE\",\"name\":\"noncanonical-denial-cannot-open-private-or-operative-ui\",\"status\":403,\"type\":\"text/html\",\"width\":1280}",
        "{\"name\":\"revoked-workspace-hides-loaded-tasks-and-only-own-private-read-remains\",\"ownDenied\":false,\"width\":1280}",
        "{\"name\":\"late-prior-project-denial-cannot-replace-authorized-project\",\"width\":1280}",
        "{\"name\":\"late-prior-company-response-cannot-restore-private-context\",\"width\":1280}",
        "{\"name\":\"token-held-prior-company-never-dispatches-after-context-change\",\"width\":1280}",
        "{\"action\":\"REVOKE_TEMPLATE_MESSAGES\",\"name\":\"own-private-withdrawal-without-KYC-admission\",\"posts\":1,\"receiptGets\":0,\"reload\":false,\"status\":\"PENDING_REVIEW\",\"width\":1280}",
        "{\"action\":\"UNLINK\",\"name\":\"own-private-withdrawal-without-KYC-admission\",\"posts\":1,\"receiptGets\":0,\"reload\":false,\"status\":\"PENDING_REVIEW\",\"width\":1280}",
        "{\"action\":\"REVOKE_TEMPLATE_MESSAGES\",\"name\":\"own-private-withdrawal-without-KYC-admission\",\"posts\":1,\"receiptGets\":0,\"reload\":false,\"status\":\"REJECTED\",\"width\":1280}",
        "{\"action\":\"UNLINK\",\"name\":\"own-private-withdrawal-without-KYC-admission\",\"posts\":1,\"receiptGets\":0,\"reload\":false,\"status\":\"REJECTED\",\"width\":1280}",
        "{\"action\":\"REVOKE_TEMPLATE_MESSAGES\",\"durableReference\":true,\"name\":\"own-withdrawal-lost-response-reload-recovers-same-UUID-without-second-POST\",\"posts\":1,\"receiptGets\":1,\"reload\":true,\"sameOperationId\":true,\"status\":\"PENDING_REVIEW\",\"width\":1280}",
        "{\"action\":\"UNLINK\",\"durableReference\":true,\"name\":\"own-withdrawal-lost-response-reload-recovers-same-UUID-without-second-POST\",\"posts\":1,\"receiptGets\":1,\"reload\":true,\"sameOperationId\":true,\"status\":\"REJECTED\",\"width\":1280}",
        "{\"name\":\"late-approved-channel-DTO-never-exposes-codes-grant-chat-or-workspace\",\"width\":1280}",
        "{\"name\":\"late-channel-read-cannot-cross-project\",\"width\":1280}",
        "{\"name\":\"late-channel-read-cannot-cross-account\",\"width\":1280}",
        "{\"name\":\"withdrawal-held-token-cancels-before-POST-on-account-change\",\"width\":1280}",
        "{\"name\":\"dispatched-withdrawal-account-change-keeps-durable-receipt-without-rePOST\",\"width\":1280}",
        "{\"code\":\"WORKSPACE_PROJECT_UNAVAILABLE\",\"name\":\"revoked-private-channel-assignment-or-membership-hides-current-records\",\"status\":403,\"width\":1280}",
        "{\"code\":\"WORKSPACE_MEMBERSHIP_REQUIRED\",\"name\":\"revoked-private-channel-assignment-or-membership-hides-current-records\",\"status\":403,\"width\":1280}",
        "{\"code\":\"WORKSPACE_PROJECT_UNAVAILABLE\",\"name\":\"revoked-private-channel-assignment-or-membership-hides-current-records\",\"status\":404,\"width\":1280}",
        "{\"durableReference\":true,\"name\":\"canonical-project-404-after-withdrawal-dispatch-keeps-UUID-and-receipt-reference\",\"receiptGets\":1,\"sameOperationId\":true,\"width\":1280}",
        "{\"durableReference\":true,\"name\":\"canonical-reference-GET-404-hides-loaded-record-and-retains-original-cross-tab-UUID\",\"posts\":1,\"receiptGets\":2,\"sameOperationId\":true,\"width\":1280}",
        "{\"name\":\"own-APPROVED-requires-explicit-fresh-canonical-project-check-before-workspace\",\"width\":1280}",
        "{\"director\":false,\"name\":\"private-identity-submission-uncertain-receipt-and-explicit-approval-refresh\",\"posts\":1,\"receiptGets\":1,\"reload\":true,\"width\":390}",
        "{\"director\":true,\"name\":\"private-identity-submission-uncertain-receipt-and-explicit-approval-refresh\",\"posts\":1,\"receiptGets\":1,\"reload\":false,\"width\":390}",
        "{\"name\":\"revoked-workspace-hides-loaded-tasks-and-only-own-private-read-remains\",\"ownDenied\":true,\"width\":390}",
        "{\"name\":\"bootstrap-administrator-without-worker-keeps-server-authorized-operation\",\"width\":390}",
        "{\"code\":\"PARTICIPANT_KYC_REVIEW_REQUIRED\",\"name\":\"noncanonical-denial-cannot-open-private-or-operative-ui\",\"status\":401,\"type\":\"application/json\",\"width\":390}",
        "{\"code\":\"PARTICIPANT_KYC_REVIEW_REQUIRED\",\"name\":\"noncanonical-denial-cannot-open-private-or-operative-ui\",\"status\":409,\"type\":\"application/json\",\"width\":390}",
        "{\"code\":\"PARTICIPANT_KYC_REVIEW_REQUIRED\",\"name\":\"noncanonical-denial-cannot-open-private-or-operative-ui\",\"status\":500,\"type\":\"application/json\",\"width\":390}"
      ]
    }
  ],
  "preanalysisSourceDeltas": [
    {
      "key": "nativeSourceFiles",
      "family": "AI_nativeSourceFiles",
      "previousCount": 142,
      "previousPathsSha256": "ab2dda6db1220e19718532137922bc5dba9128d8db86abb4383746deba0d909f",
      "currentCount": 145,
      "currentPathsSha256": "d50ac02c6324d003eef09a6a03c6ee7aeacdb0760602a94602916a71c66e71cf",
      "additions": [
        "src/lib/meta-kyc-current-image.mjs",
        "src/lib/participant-kyc-chat-copy.mjs",
        "src/lib/participant-kyc-notice-links.mjs"
      ]
    },
    {
      "key": "ciSourceFiles",
      "family": "AI_ciSourceFiles",
      "previousCount": 200,
      "previousPathsSha256": "64012c5b7be1d291bff1f861c7d81cf8480e2492e4fdfd101cafff42485d47d1",
      "currentCount": 229,
      "currentPathsSha256": "935ce4042c36639e55046301a2c72c93200cdc72f8a8d989ca7a8b403cffddee",
      "additions": [
        "scripts/lib/integrated-identity-current-ci-lineage.mjs",
        "scripts/lib/owned-fixture-cleanup.mjs",
        "scripts/verify-company-channel-kyc-postgres.mjs",
        "scripts/verify-company-kyc-outbound-compact-postgres.mjs",
        "scripts/verify-company-onboarding-ui.mjs",
        "scripts/verify-focused-workspace-ci.mjs",
        "scripts/verify-focused-workspace-ui.mjs",
        "scripts/verify-mobile-workspace-review-ui.mjs",
        "scripts/verify-onboarding-guide-ui.mjs",
        "scripts/verify-participant-project-navigation-ui.mjs",
        "scripts/verify-task-progress-measurement-ui.mjs",
        "scripts/verify-workspace-identity-only-ui.mjs",
        "scripts/verify-workspace-plan-recovery-ui.mjs",
        "scripts/verify-workspace-reload-ui.mjs",
        "scripts/verify-workspace-ui.mjs",
        "src/app/(identity)/cuenta/participant-kyc-capture.js",
        "src/app/(identity)/cuenta/participant-kyc-capture.module.css",
        "src/lib/meta-kyc-current-image.mjs",
        "src/lib/participant-kyc-chat-copy.mjs",
        "src/lib/participant-kyc-notice-links.mjs",
        "tests/fixtures/integrated-identity-contract-27aa.json",
        "tests/fixtures/integrated-identity-ui-producer-migration-86f2.json",
        "tests/production-focused-workspace-ci.test.mjs",
        "tests/production-focused-workspace-ui.test.mjs",
        "tests/production-integrated-identity-current-ci-lineage.test.mjs",
        "tests/production-integrated-identity-ui-producer-migration.test.mjs",
        "tests/production-meta-customer-composition.test.mjs",
        "tests/production-plan-import-link-ui.test.mjs",
        "tests/production-workspace-tools-navigation.test.mjs"
      ]
    }
  ],
  "focusedSourceFiles": [
    "package-lock.json",
    "package.json",
    "scripts/lib/integrated-identity-current-ci-lineage.mjs",
    "scripts/lib/owned-fixture-cleanup.mjs",
    "scripts/lib/participant-preanalysis-current-ci-lineage.mjs",
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
    "src/app/(identity)/cuenta/workspace-client.js",
    "src/app/(identity)/cuenta/workspace-identity.js",
    "src/app/(identity)/cuenta/workspace-overview.js",
    "src/app/(identity)/cuenta/workspace-recovery-journal.mjs",
    "src/app/(identity)/cuenta/workspace-recovery-panel.js",
    "src/app/(identity)/cuenta/workspace-recovery-storage.mjs",
    "src/app/(identity)/cuenta/workspace-request-lifecycle.js",
    "src/app/(identity)/cuenta/workspace-request-lifecycle.mjs",
    "src/app/(identity)/cuenta/workspace-screen.js",
    "src/app/(identity)/cuenta/workspace-session-request.mjs",
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
    "tests/production-focused-workspace-ci.test.mjs",
    "tests/production-focused-workspace-navigation.test.mjs",
    "tests/production-focused-workspace-ui.test.mjs",
    "tests/production-integrated-identity-current-ci-lineage.test.mjs"
  ],
  "focusedCheckNames": [
    "hidden-panel-headings-absent-from-accessibility-tree-390",
    "one-mounted-visible-overview-and-hidden-panels-390",
    "identity-deep-link-history-no-mutation-390",
    "legacy-plan-import-fragment-opens-schedule-390",
    "nonadmin-cannot-see-billing-or-integration-navigation-390",
    "schedule-draft-survives-section-navigation-without-POST-390",
    "no-project-hint-keeps-an-explicit-usable-project-picker-390",
    "company-plan-and-recovery-without-selected-project-company-without-selection-390",
    "company-plan-and-recovery-without-selected-project-empty-company-390",
    "three-step-synthetic-identity-explicit-consents-and-unknown-receipt-survive-navigation-390",
    "hidden-panel-headings-absent-from-accessibility-tree-1440",
    "one-mounted-visible-overview-and-hidden-panels-1440",
    "identity-deep-link-history-no-mutation-1440",
    "legacy-plan-import-fragment-opens-schedule-1440",
    "nonadmin-cannot-see-billing-or-integration-navigation-1440",
    "schedule-draft-survives-section-navigation-without-POST-1440",
    "no-project-hint-keeps-an-explicit-usable-project-picker-1440",
    "company-plan-and-recovery-without-selected-project-company-without-selection-1440",
    "company-plan-and-recovery-without-selected-project-empty-company-1440",
    "three-step-synthetic-identity-explicit-consents-and-unknown-receipt-survive-navigation-1440"
  ],
  "companyCurrentCaseNames": [
    "production-signed-unquoted-FRONT-BACK-SELFIE-distinct-geometric-PNG-current-receipts-and-explicit-deposit",
    "unquoted-image-before-personal-consents-is-reminder-only",
    "equal-prompt-second-is-closed-with-no-capture-or-consent",
    "same-media-cannot-fill-the-next-image-slot",
    "foreign-phone-does-not-reuse-another-current-challenge",
    "actual-PG-source-row-lock-same-WAMID-one-stage-and-one-outbox",
    "real-rollback-atomic-current-projection-dispatch-state",
    "actual-current-COMMIT-ACK-loss-reuses-sealed-receipt-before-second-advance",
    "committed-issuer-revocation-after-reserve-before-POST-retains-marker",
    "committed-member-revocation-after-reserve-before-POST-retains-marker",
    "committed-source_lease-revocation-after-reserve-before-POST-retains-marker",
    "delivery-status-mutable-processedAt-does-not-retag-durable-prompt-causality",
    "status-without-durable-confirmation-time-does-not-mint-current-capture",
    "canonically-issued-past-conversation-does-not-resume-current-images",
    "declared-current-image-SHA-is-checked-against-actual-download-before-private-put",
    "current-three-image-deposit-actual-COMMIT-ACK-loss-no-second-download-put-or-submission",
    "integrated-CURRENT-three-unquoted-images-independent-v2-OCR-facial-consents-committed-JSONB-auto-intent"
  ],
  "ownCurrentCaseNames": [
    "OWN-CURRENT-HMAC-callback-production-priority-real-v2-grant-JSONB-receipt-fresh-compact-send",
    "OWN-CURRENT-delivery-read-keeps-durable-completion-and-current-compact-authority",
    "OWN-CURRENT-receipt-mutated-in-locked-TX-after-Graph-await-denied-before-POST",
    "OWN-CURRENT-original-prompt-failed-in-locked-TX-after-Graph-await-denied-before-POST"
  ],
  "companyCurrentCaseFacts": [
    {
      "name": "production-signed-unquoted-FRONT-BACK-SELFIE-distinct-geometric-PNG-current-receipts-and-explicit-deposit",
      "imageReceipts": 3,
      "submissions": 1,
      "downloads": 3,
      "privatePuts": 3,
      "replaySideEffects": 0,
      "optionalConsents": false,
      "kyc": "PENDING_REVIEW",
      "permissionsGranted": false
    },
    {
      "name": "unquoted-image-before-personal-consents-is-reminder-only",
      "captureWrites": 0,
      "downloads": 0,
      "privatePuts": 0,
      "reminderPosts": 1
    },
    {
      "name": "equal-prompt-second-is-closed-with-no-capture-or-consent",
      "createdAtUnmodified": true,
      "captureWrites": 0
    },
    {
      "name": "same-media-cannot-fill-the-next-image-slot",
      "secondImageReceipts": 0,
      "downloads": 0,
      "privatePuts": 0
    },
    {
      "name": "foreign-phone-does-not-reuse-another-current-challenge",
      "privateWrites": 0,
      "providerTransfers": 0
    },
    {
      "name": "actual-PG-source-row-lock-same-WAMID-one-stage-and-one-outbox",
      "blockingSql": "canonical WebhookEvent FOR UPDATE",
      "uncommittedReceiptInvisible": true,
      "imageReceipts": 1,
      "posts": 1,
      "duplicateCallbackSameEvent": true
    },
    {
      "name": "real-rollback-atomic-current-projection-dispatch-state",
      "commitApplied": false,
      "imageReceipts": 1,
      "recoveredPosts": 1,
      "downloads": 0,
      "privatePuts": 0
    },
    {
      "name": "actual-current-COMMIT-ACK-loss-reuses-sealed-receipt-before-second-advance",
      "commitApplied": true,
      "imageReceipts": 1,
      "recoveredPosts": 1,
      "downloads": 0,
      "privatePuts": 0
    },
    {
      "name": "committed-issuer-revocation-after-reserve-before-POST-retains-marker",
      "hookCalls": 1,
      "posts": 0,
      "downloads": 0,
      "privatePuts": 0,
      "currentReceiptPreserved": true,
      "replayRetransmits": 0,
      "denialCode": "META_KYC_CHALLENGE_REVOKED"
    },
    {
      "name": "committed-member-revocation-after-reserve-before-POST-retains-marker",
      "hookCalls": 1,
      "posts": 0,
      "downloads": 0,
      "privatePuts": 0,
      "currentReceiptPreserved": true,
      "replayRetransmits": 0,
      "denialCode": "META_KYC_CHALLENGE_REVOKED"
    },
    {
      "name": "committed-source_lease-revocation-after-reserve-before-POST-retains-marker",
      "hookCalls": 1,
      "posts": 0,
      "downloads": 0,
      "privatePuts": 0,
      "currentReceiptPreserved": true,
      "replayRetransmits": 0,
      "denialCode": "META_CUSTOMER_INBOX_LEASE_CHANGED"
    },
    {
      "name": "delivery-status-mutable-processedAt-does-not-retag-durable-prompt-causality",
      "stageAdvancedExactlyOnce": true
    },
    {
      "name": "status-without-durable-confirmation-time-does-not-mint-current-capture",
      "captureWrites": 0,
      "downloads": 0,
      "privatePuts": 0
    },
    {
      "name": "canonically-issued-past-conversation-does-not-resume-current-images",
      "issuanceClockOffsetMs": -1860000,
      "continuationClock": "actual PostgreSQL",
      "sourceBytesRewritten": false,
      "captureWrites": 0
    },
    {
      "name": "declared-current-image-SHA-is-checked-against-actual-download-before-private-put",
      "submissions": 0,
      "privatePuts": 0,
      "downloadsBeforeDenial": 1
    },
    {
      "name": "current-three-image-deposit-actual-COMMIT-ACK-loss-no-second-download-put-or-submission",
      "submissions": 1,
      "downloads": 3,
      "privatePuts": 3,
      "recoveryMediaTransfers": 0,
      "originalReceiptUnchanged": true
    },
    {
      "name": "integrated-CURRENT-three-unquoted-images-independent-v2-OCR-facial-consents-committed-JSONB-auto-intent",
      "imageReceipts": 3,
      "submissions": 1,
      "downloads": 3,
      "privatePuts": 3,
      "ocrNoticeVersion": "participant-external-ocr-v2",
      "biometricNoticeVersion": "participant-private-biometric-v2",
      "independentExplicitChoices": true,
      "automaticState": "QUEUED",
      "stages": {
        "ocr": "PENDING",
        "biometric": "PENDING"
      },
      "sourceActorCanonical": true,
      "committedJsonbObservedAtWakeup": true,
      "scheduleWakeups": 1,
      "replayWakeups": 0,
      "replaySideEffects": 0,
      "analysisProviderCalls": 0,
      "identityCertified": false,
      "permissionsGranted": false
    }
  ],
  "ownCurrentCaseFacts": [
    {
      "name": "OWN-CURRENT-HMAC-callback-production-priority-real-v2-grant-JSONB-receipt-fresh-compact-send",
      "actualPostSameLockedTransaction": true,
      "posts": 1,
      "replayTransfers": 0,
      "currentReceiptMode": "CURRENT",
      "grantMintedBy": "ACTIVATE_OWN_NUMBER",
      "anchorDistinctFromTarget": true,
      "identityCertified": false,
      "permissionsGranted": false
    },
    {
      "name": "OWN-CURRENT-delivery-read-keeps-durable-completion-and-current-compact-authority",
      "actualPostSameLockedTransaction": true,
      "posts": 1,
      "replayTransfers": 0,
      "currentReceiptMode": "CURRENT",
      "grantMintedBy": "ACTIVATE_OWN_NUMBER",
      "anchorDistinctFromTarget": true,
      "identityCertified": false,
      "permissionsGranted": false
    },
    {
      "name": "OWN-CURRENT-receipt-mutated-in-locked-TX-after-Graph-await-denied-before-POST",
      "realRollback": true,
      "receiptAndPromptRestored": true,
      "posts": 0,
      "replayTransfers": 0,
      "state": "SEND_STARTED"
    },
    {
      "name": "OWN-CURRENT-original-prompt-failed-in-locked-TX-after-Graph-await-denied-before-POST",
      "realRollback": true,
      "receiptAndPromptRestored": true,
      "posts": 0,
      "replayTransfers": 0,
      "state": "SEND_STARTED"
    }
  ],
  "companyCurrentSummary": {
    "kind": "COMPANY",
    "postgresExecuted": true,
    "sourceBytesUnchanged": true,
    "productionFactory": "createMetaCustomerProductionProcessor",
    "signedCallback": true,
    "ownContextProperty": false,
    "realTimestamps": true,
    "fixture": "generated-8x8-RGB-geometric-PNG-no-personal-document-or-face",
    "realProviderCalls": 0,
    "databaseCreated": false,
    "cleanupOwnedByParentProducer": true,
    "humanAccepted": false,
    "identityCertified": false,
    "permissionsGranted": false
  },
  "ownCurrentSummary": {
    "version": 1,
    "status": "PASS",
    "kind": "OWN_COMPANY_RUNTIME_CURRENT_IMAGE",
    "checks": [
      "native-OWN-CURRENT-real-v2-grant-production-factory-fresh-compact-snapshot-after-Graph-source-receipt-tamper-zero-POST-and-no-replay"
    ],
    "postgresExecuted": true,
    "compositionFactory": "createMetaCustomerProductionProcessor",
    "originalGrantAndIssuerUnchanged": true,
    "providerFixture": "ownCompanyFixture with identical policy/time/assets, independent call log",
    "syntheticMessagePostCount": 22,
    "downloads": 0,
    "privatePuts": 0,
    "realProviderCalls": 0,
    "identityCertified": false,
    "permissionsGranted": false,
    "humanAccepted": false
  }
});
const lf=(reader,file)=>{const bytes=reader(file);requireLineage(Buffer.isBuffer(bytes),'Missing current source: '+file);const text=bytes.toString('utf8');requireLineage(bytes.equals(Buffer.from(text)),'Invalid UTF-8 source: '+file);return sha(text.replaceAll('\r\n','\n'));};
function revision(contract){
 requireLineage(plain(contract),'Workspace contract required');if(!Object.hasOwn(contract,'integratedIdentityCurrentRevision'))return null;
 const value=contract.integratedIdentityCurrentRevision;
 requireLineage(plain(value)&&same(Object.keys(value).sort(),[...Object.keys(INTEGRATED_IDENTITY_CURRENT_REVISION),'validationSources'].sort()),'Exact integrated revision shape required');
 for(const [key,expected]of Object.entries(INTEGRATED_IDENTITY_CURRENT_REVISION))requireLineage(same(value[key],expected),'Unreviewed integrated revision: '+key);
 requireLineage(value.status==='REVIEWED_FROZEN_CURRENT_SOURCE','Integrated source revision is not frozen');
 requireLineage(Array.isArray(value.validationSources)&&same(value.validationSources.map(row=>row?.path),INTEGRATED_IDENTITY_VALIDATION_PATHS),'Exact integrated validation leaves required');
 for(const row of value.validationSources)requireLineage(plain(row)&&same(Object.keys(row).sort(),['path','sha256'])&&/^[a-f0-9]{64}$/.test(row.sha256),'Invalid integrated validation source');
 return value;
}
function union(previous,delta){
 requireLineage(Array.isArray(previous)&&previous.length===delta.previousCount&&sha(JSON.stringify(previous))===delta.previousPathsSha256,'Exact predecessor path set required: '+delta.family);
 requireLineage(Array.isArray(delta.additions)&&new Set(delta.additions).size===delta.additions.length&&delta.additions.every(file=>!previous.includes(file)),'Only distinct additive source paths are allowed: '+delta.family);
 const current=[...previous,...delta.additions].sort();requireLineage(current.length===delta.currentCount&&sha(JSON.stringify(current))===delta.currentPathsSha256,'Exact current path set required: '+delta.family);return current;
}
// This metadata inverse never edits an original native/browser proof. The
// entire previous JSON is authenticated, including all original 49 pin rows.
export function composeIntegratedIdentityContract(value){
 const current=structuredClone(checkpoint);
 for(const delta of value.proofSourceDeltas){const proof=current.extension.proofs.find(row=>row.id===delta.id);requireLineage(Boolean(proof),'Unknown predecessor proof: '+delta.id);proof.sourceFiles=union(proof.sourceFiles,delta);}
 for(const change of value.currentProofChanges){const proof=current.extension.proofs.find(row=>row.id===change.id);requireLineage(proof&&proof.producerSha256===change.previousProducerSha256&&same(proof.checkNames,change.previousCheckNames),'Exact previous native producer and checks required');proof.producerSha256=change.currentProducerSha256;proof.checkNames=[...change.currentCheckNames];requireLineage(same(change.currentCheckNames.slice(0,change.previousCheckNames.length),change.previousCheckNames),'Original native checks must remain in order');const records=current.evidenceProducers.filter(row=>row.path===proof.path);requireLineage(records.length===1,'Exact original producer record required');records[0].producerSha256=change.currentProducerSha256;}
 for(const delta of value.preanalysisSourceDeltas){requireLineage(['nativeSourceFiles','ciSourceFiles'].includes(delta.key),'Unknown AI checkpoint source field');current.participantPreanalysisCurrentRevision[delta.key]=union(current.participantPreanalysisCurrentRevision[delta.key],delta);}
 const proof={id:'focused-workspace-ui',lane:'workspace-ui',blockId:64,path:'.vercel/private/focused-workspace-ui-evidence/current-ci.json',kind:'UI_FOCUSED_WORKSPACE',producer:'scripts/verify-focused-workspace-ci.mjs',producerSha256:value.validationSources.find(row=>row.path==='scripts/verify-focused-workspace-ci.mjs')?.sha256,sourceFiles:[...value.focusedSourceFiles],checkNames:[...value.focusedCheckNames]};
 current.blocks.push({id:64,step:structuredClone(INTEGRATED_FOCUSED_STEP),commandSha256:sha(INTEGRATED_FOCUSED_STEP.run)});current.extension.proofs.push(proof);
 current.evidenceProducers.push({producer:proof.producer,path:proof.path,retained:true,blockId:64,lane:'workspace-ui',producerSha256:proof.producerSha256,sourceBasis:'EXPECTED_HEAD_GIT_BYTES'});
 const artifact='.vercel/private/focused-workspace-ui-evidence/';current.artifactPatterns.push(artifact);current.lanes['workspace-ui'].blocks.push(64);current.lanes['workspace-ui'].artifacts.push(artifact);current.lanes['workspace-ui'].requiredRetainedEvidence.push(proof.path);
 current.integratedIdentityCurrentRevision=structuredClone(value);return current;
}
export function restoreIntegratedIdentityPreviousContract(contract){
 contract=restoreDocumentTaskAssociationPreviousContract(contract);
 if(!plain(contract)||!Object.hasOwn(contract,'integratedIdentityCurrentRevision'))return contract;
 const value=revision(contract);if(!value)return contract;
 requireLineage(same(contract,composeIntegratedIdentityContract(value)),'The integrated delta must restore the complete clean AI checkpoint exactly');return structuredClone(checkpoint);
}
export function integratedIdentityCurrentRevision(contract){return revision(contract);}
export function integratedIdentityCurrentSourcePin(contract,ref){
 const outerPin=documentTaskAssociationCurrentSourcePin(contract,ref);if(outerPin!==ref.sha256)return outerPin;
 const value=revision(contract);if(!value)return ref.sha256;const row=[...value.reviewedSourceChanges,...value.validationDeltas].find(row=>row.path===ref.path);if(!row)return ref.sha256;
 if(ref.path==='scripts/verify-workspace-identity-only-ui.mjs'&&ref.sha256===row.currentSha256)return integratedIdentityCurrentUiProducerPin(contract,ref);
 requireLineage(ref.sha256===row.previousSha256,'A previous exact checkpoint pin must remain unchanged: '+ref.path);return row.currentSha256;
}

// This one producer is already CURRENT in the composed extension proof. It may
// cross older accessors without applying its historical delta a second time.
// No other current SHA is accepted as a historical input by the generic pin.
export function integratedIdentityCurrentUiProducerPin(contract,ref){
 const value=revision(contract),row=uiProducerMigration.producers.find(item=>item.path===ref?.path);requireLineage(Boolean(value)&&ref?.path==='scripts/verify-workspace-identity-only-ui.mjs'&&Boolean(row),'Only the reviewed current identity UI producer is accepted');
 const change=value.currentProofChanges.find(item=>item.id==='identity-only-ui'),proof=contract.extension?.proofs?.find(item=>item.id==='identity-only-ui');
 requireLineage(change?.previousProducerSha256===row.previousSha256&&change?.currentProducerSha256===row.currentSha256&&ref.sha256===row.currentSha256&&proof?.producer===row.path&&proof?.producerSha256===row.currentSha256&&same(proof.checkNames,change.currentCheckNames),'Exact current identity UI proof binding required');return row.currentSha256;
}
export function verifyIntegratedIdentityCurrentSources(contract,readSource){
 verifyDocumentTaskAssociationCurrentSources(contract,readSource);
 const value=revision(contract);if(!value)return null;restoreIntegratedIdentityPreviousContract(contract);requireLineage(typeof readSource==='function','Current committed source reader required');
 authenticateIntegratedIdentityUiProducerMigrationSource(readSource(INTEGRATED_IDENTITY_UI_PRODUCER_MIGRATION_PATH));
 for(const row of [...value.reviewedSourceChanges,...value.validationDeltas])requireLineage(lf(readSource,row.path)===documentTaskAssociationCurrentSourcePin(contract,{path:row.path,sha256:row.currentSha256}),'Stale integrated current source: '+row.path);
 for(const row of [...value.addedSources,...value.validationSources])requireLineage(lf(readSource,row.path)===documentTaskAssociationCurrentSourcePin(contract,row),'Stale integrated added or validation source: '+row.path);
 requireLineage(lf(readSource,INTEGRATED_IDENTITY_CHECKPOINT_PATH)===previousContractSha256,'The original checkpoint fixture bytes cannot change');
 return{version:1,previousContractSha256,completeCheckpointRestored:true,historicalPinsPreserved:true,nativeOrBrowserAcceptance:false};
}
export function restoreIntegratedIdentitySourceSet(family,files,contract){
 files=restoreDocumentTaskAssociationSourceSet(family,files,contract);
 const value=revision(contract);if(!value)return files;const delta=[...value.proofSourceDeltas,...value.consumerSourceDeltas].find(row=>row.family===family);if(!delta)return files;
 requireLineage(Array.isArray(files)&&files.length===delta.currentCount&&sha(JSON.stringify(files))===delta.currentPathsSha256,'Exact integrated current source set required: '+family);
 const previous=files.filter(file=>!delta.additions.includes(file));requireLineage(previous.length===delta.previousCount&&sha(JSON.stringify(previous))===delta.previousPathsSha256,'Exact checkpoint sources must remain present: '+family);return previous;
}
export function integratedIdentityProofSourceAdditions(spec){
 const outer=documentTaskAssociationProofSourceAdditions(spec);if(outer.length)spec={...spec,sourceFiles:spec.sourceFiles.filter(file=>!outer.includes(file))};
 const delta=INTEGRATED_IDENTITY_CURRENT_REVISION.proofSourceDeltas.find(row=>row.id===spec?.id);if(!delta)return outer;
 const historical=checkpoint.participantPreanalysisCurrentRevision.proofSourceDeltas.find(row=>row.id===spec?.id);
 if(historical&&spec.sourceFiles?.length===historical.previousCount&&sha(JSON.stringify(spec.sourceFiles))===historical.previousPathsSha256)return outer;
 if(spec.sourceFiles?.length===delta.previousCount&&sha(JSON.stringify(spec.sourceFiles))===delta.previousPathsSha256)return outer;
 requireLineage(spec.sourceFiles?.length===delta.currentCount&&sha(JSON.stringify(spec.sourceFiles))===delta.currentPathsSha256,'Unknown integrated proof source set');return[...delta.additions,...outer];
}
// Only metadata is reconstructed for older check-lineage assertions. Actual
// native checks and their original raw evidence still require the new matrix.
export function integratedIdentityPreviousProofChecks(spec){
 const change=INTEGRATED_IDENTITY_CURRENT_REVISION.currentProofChanges.find(row=>row.id===spec?.id);if(!change)return spec?.checkNames;
 if(same(spec.checkNames,change.previousCheckNames))return spec.checkNames;
 requireLineage(same(spec.checkNames,change.currentCheckNames)&&spec.producerSha256===change.currentProducerSha256,'Exact integrated current producer and check metadata required');return [...change.previousCheckNames];
}
export function integratedIdentityConsumerSourceFiles(family,files,readSource){
 const raw=readSource(INTEGRATED_IDENTITY_CONTRACT_PATH);if(!Buffer.isBuffer(raw))return files;const contract=JSON.parse(raw);if(!Object.hasOwn(contract,'integratedIdentityCurrentRevision'))return files;
 verifyIntegratedIdentityCurrentSources(contract,readSource);return restoreIntegratedIdentitySourceSet(family,files,contract);
}
export function validateIntegratedIdentityWorkspaceContract(contract){
 const value=revision(contract);if(!value)return null;restoreIntegratedIdentityPreviousContract(contract);
 const historicalMetadata=restoreDocumentTaskAssociationPreviousContract(contract);
 requireLineage(historicalMetadata.blocks.length===58&&historicalMetadata.extension.proofs.length===20&&historicalMetadata.artifactPatterns.length===62,'All checkpoint blocks proofs and artifact patterns plus one focused proof are required');
 requireLineage(value.companyCurrentCaseNames.length===17&&value.ownCurrentCaseNames.length===4,'All additive CURRENT scenarios must remain declared');
 requireLineage(value.companyCurrentSummary.kind==='COMPANY'&&value.companyCurrentSummary.postgresExecuted===true&&value.companyCurrentSummary.identityCertified===false&&value.companyCurrentSummary.permissionsGranted===false&&value.ownCurrentSummary.kind==='OWN_COMPANY_RUNTIME_CURRENT_IMAGE'&&value.ownCurrentSummary.postgresExecuted===true&&value.ownCurrentSummary.identityCertified===false&&value.ownCurrentSummary.permissionsGranted===false,'Current native summaries remain synthetic and cannot grant identity or permissions');
 requireLineage(same(contract.participantPreanalysisCurrentRevision.nativeCheckNames,checkpoint.participantPreanalysisCurrentRevision.nativeCheckNames)&&contract.participantPreanalysisCurrentRevision.nativeProducerSha256===checkpoint.participantPreanalysisCurrentRevision.nativeProducerSha256,'Original AI19 producer and scenario order are immutable');
 return{version:1,commandBlocks:58,typedProofs:20,artifactPatterns:62,aiNativeChecks:19,companyCurrentCases:17,ownCurrentCases:4,checkpointRestored:true};
}
function facts(actual,expected,label){
 requireLineage(plain(actual),'Actual '+label+' required');for(const [key,value]of Object.entries(expected))requireLineage(same(actual[key],value),'Current native fact differs: '+label+'.'+key);
}
export function validateIntegratedCompanyCurrentNative(proof,contract,readSource){
 const value=revision(contract);if(!value)return null;verifyIntegratedIdentityCurrentSources(contract,readSource);
 const native=proof?.currentImageNative;facts(native,value.companyCurrentSummary,'COMPANY CURRENT');
 requireLineage(Array.isArray(native.cases)&&same(native.cases.map(row=>row?.name),value.companyCurrentCaseNames),'All seventeen actual COMPANY CURRENT cases are required in order');
 requireLineage(value.companyCurrentCaseFacts.length===17,'Exact current COMPANY case fact matrix required');native.cases.forEach((row,index)=>facts(row,value.companyCurrentCaseFacts[index],'COMPANY CURRENT '+index));
 const local=['scripts/lib/kyc-current-image-native.mjs','scripts/verify-company-channel-kyc-postgres.mjs','package.json','package-lock.json'].map(file=>({path:file,sha256:sha(readSource(file))}));requireLineage(same(native.sourceManifest,local),'Original CURRENT helper and parent native RAW source references required');
 requireLineage(native.identityCertified===false&&native.permissionsGranted===false&&native.humanAccepted===false&&native.realProviderCalls===0,'CURRENT capture cannot certify identity or grant permissions');
 return{version:1,cases:17,postgresExecuted:true,proofRewritten:false,realIdentityCertified:false};
}
export function validateIntegratedOwnCurrentNative(proof,contract,readSource){
 const value=revision(contract);if(!value)return null;verifyIntegratedIdentityCurrentSources(contract,readSource);
 const native=proof?.currentImageOwnNative;facts(native,value.ownCurrentSummary,'OWN CURRENT');
 requireLineage(Array.isArray(native.cases)&&same(native.cases.map(row=>row?.name),value.ownCurrentCaseNames),'All four actual OWN CURRENT cases are required in order');
 requireLineage(value.ownCurrentCaseFacts.length===4,'Exact current OWN case fact matrix required');native.cases.forEach((row,index)=>facts(row,value.ownCurrentCaseFacts[index],'OWN CURRENT '+index));
 requireLineage(typeof native.originalV2ActivationReceipt==='string'&&native.originalV2ActivationReceipt.length>0&&native.syntheticMessagePostCount===22,'Original v2 activation, twenty setup prompt POSTs and two synthetic CURRENT positive POSTs required');
 requireLineage(native.downloads===0&&native.privatePuts===0&&native.realProviderCalls===0&&native.identityCertified===false&&native.permissionsGranted===false&&native.humanAccepted===false,'OWN CURRENT feedback cannot transfer private media or grant authority');
 return{version:1,cases:4,postgresExecuted:true,proofRewritten:false,realIdentityCertified:false};
}
// Pure adversarial shadows belong only to the index selftest. They are never
// emitted as native/browser evidence and do not claim a PostgreSQL execution.
export function integratedCompanyCurrentShadowFixture(contract,readSource){
 const value=revision(contract);if(!value)return null;
 return{...structuredClone(value.companyCurrentSummary),cases:structuredClone(value.companyCurrentCaseFacts),sourceManifest:['scripts/lib/kyc-current-image-native.mjs','scripts/verify-company-channel-kyc-postgres.mjs','package.json','package-lock.json'].map(file=>({path:file,sha256:sha(readSource(file))})),sqlStatements:1};
}
export function integratedOwnCurrentShadowFixture(contract){
 const value=revision(contract);if(!value)return null;
 return{...structuredClone(value.ownCurrentSummary),cases:structuredClone(value.ownCurrentCaseFacts),originalV2ActivationReceipt:'synthetic-unit-shadow-only',syntheticMessagePostCount:22};
}
export function integratedIdentityCurrentSelftest(contract,readSource){
 const value=revision(contract);if(!value)return[];const checks=[],prefix='integrated-identity-current-';
 const good=(name,run)=>{run();checks.push({name:prefix+name,result:'PASS',boundary:'pure source and metadata shadow; no PG or browser execution'});};
 const bad=(name,edit)=>{const changed=structuredClone(contract);edit(changed);let denied=false;try{restoreIntegratedIdentityPreviousContract(changed);}catch(error){if(error.code!=='INTEGRATED_IDENTITY_CURRENT_CI_LINEAGE_REJECTED')throw error;denied=true;}requireLineage(denied,'Adversarial integrated contract was accepted');checks.push({name:prefix+name,result:'PASS',expectedDenial:'INTEGRATED_IDENTITY_CURRENT_CI_LINEAGE_REJECTED',boundary:'pure metadata shadow; original proofs untouched'});};
 good('complete-clean-AI-checkpoint-restored',()=>restoreIntegratedIdentityPreviousContract(contract));good('all-current-raw-source-leaves-authenticated',()=>verifyIntegratedIdentityCurrentSources(contract,readSource));good('new-focused-binding-and-seventeen-plus-four-native-matrices',()=>validateIntegratedIdentityWorkspaceContract(contract));
 bad('pending-freeze-denied',c=>{c.integratedIdentityCurrentRevision.status='PENDING_INDEPENDENT_SOURCE_FREEZES';});bad('foreign-head-denied',c=>{c.integratedIdentityCurrentRevision.referenceHead='f'.repeat(40);});bad('foreign-tree-denied',c=>{c.integratedIdentityCurrentRevision.referenceTree='f'.repeat(40);});bad('foreign-checkpoint-denied',c=>{c.integratedIdentityCurrentRevision.previousContractSha256='f'.repeat(64);});
 bad('runtime-delta-omitted-denied',c=>{c.integratedIdentityCurrentRevision.reviewedSourceChanges.pop();});bad('validation-delta-omitted-denied',c=>{c.integratedIdentityCurrentRevision.validationDeltas.pop();});bad('source-addition-omitted-denied',c=>{c.integratedIdentityCurrentRevision.addedSources.pop();});bad('proof-delta-omitted-denied',c=>{c.integratedIdentityCurrentRevision.proofSourceDeltas.pop();});
 bad('historical-pin-edit-denied',c=>{c.kycExpiredCurrentComposition.reviewedSources[0].sha256='f'.repeat(64);});bad('AI19-check-edit-denied',c=>{c.participantPreanalysisCurrentRevision.nativeCheckNames.pop();});bad('CURRENT17-check-omission-denied',c=>{c.integratedIdentityCurrentRevision.companyCurrentCaseNames.pop();});bad('OWN4-check-omission-denied',c=>{c.integratedIdentityCurrentRevision.ownCurrentCaseNames.pop();});
 bad('focused-block-omission-denied',c=>{c.blocks=c.blocks.filter(row=>row.id!==64);});bad('focused-proof-duplication-denied',c=>{c.extension.proofs.push(c.extension.proofs.find(row=>row.kind==='UI_FOCUSED_WORKSPACE'));});bad('focused-artifact-omission-denied',c=>{c.artifactPatterns=c.artifactPatterns.filter(row=>row!=='.vercel/private/focused-workspace-ui-evidence/');});bad('source-metadata-superset-denied',c=>{c.integratedIdentityCurrentRevision.validationSources[0].trusted=true;});
 return checks;
}
