import {withCaptureRuntimePreviousSources} from './plan-budget-current-ci-lineage.mjs';
import {restoreWorkspaceContinuityPreviousContract as continuity0,workspaceContinuityCurrentSourcePin as continuity1,verifyWorkspaceContinuityCurrentSources as continuity2,restoreWorkspaceContinuitySourceSet as continuity3,workspaceContinuityProofSourceAdditions as continuity4,workspaceContinuityValidationFiles as continuity5} from './workspace-continuity-current-ci-lineage.mjs';
// Preserve the inherited API's precise rejection code. A new outer rejection
// remains a rejection, and unrelated errors retain their original identity.
function continuityCall(fn,args){try{return fn(...args);}catch(error){if(error.code==='WORKSPACE_CONTINUITY_CURRENT_CI_LINEAGE_REJECTED')throw Object.assign(new Error(error.message),{code:'PLAN_MEASUREMENT_DOCUMENT_ASSOCIATION_CI_LINEAGE_REJECTED'});throw error;}}
const restoreWorkspaceContinuityPreviousContract=(...args)=>continuityCall(continuity0,args);
const workspaceContinuityCurrentSourcePin=(...args)=>continuityCall(continuity1,args);
const verifyWorkspaceContinuityCurrentSources=(...args)=>continuityCall(continuity2,args);
const restoreWorkspaceContinuitySourceSet=(...args)=>continuityCall(continuity3,args);
const workspaceContinuityProofSourceAdditions=(...args)=>continuityCall(continuity4,args);
const workspaceContinuityValidationFiles=(...args)=>continuityCall(continuity5,args);

import {createHash} from 'node:crypto';
import checkpoint from '../../tests/fixtures/plan-measurement-contract-a203.json' with {type:'json'};

export const DOCUMENT_TASK_ASSOCIATION_CONTRACT_PATH='.github/workspace-acceptance-contract.json';
export const DOCUMENT_TASK_ASSOCIATION_CHECKPOINT_PATH='tests/fixtures/plan-measurement-contract-a203.json';
export const DOCUMENT_TASK_ASSOCIATION_HELPER_PATH='scripts/lib/plan-measurement-document-association-ci-lineage.mjs';
export const DOCUMENT_TASK_ASSOCIATION_TEST_PATH='tests/production-plan-measurement-document-association-ci-lineage.test.mjs';
export const DOCUMENT_TASK_ASSOCIATION_PREVIOUS_CONTRACT_SHA256='10319b1ab8a283b7c89cab96a279e20e25fe4be2736d91caaa915a4e62afa524';
export const DOCUMENT_TASK_ASSOCIATION_SECTION='planMeasurementDocumentAssociationRevision';
const sha=value=>createHash('sha256').update(value).digest('hex');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const plain=value=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const sourcePath=value=>typeof value==='string'&&/^(?:src|scripts|tests|\.github)\//.test(value)&&!value.includes('..')&&!value.includes('\\')&&!value.includes('\0');
function requireLineage(ok,message){if(!ok)throw Object.assign(new Error(message),{code:'PLAN_MEASUREMENT_DOCUMENT_ASSOCIATION_CI_LINEAGE_REJECTED'});}
function exactKeys(value,keys,label){requireLineage(plain(value)&&same(Object.keys(value).sort(),[...keys].sort()),label);}
export const DOCUMENT_TASK_ASSOCIATION_MEASUREMENT=Object.freeze({
  "nativeCheckNames": [
    "canonical-responsible-permission-scope-and-foreign-project-before-storage",
    "real-private-local-upload-retains-source-exact-quantity-provenance-without-task-or-provider-effects",
    "audited-predecision-rejection-replay-recovery-has-zero-task-draft-proposal-effects-and-allows-fresh-review",
    "source-draft-and-explicit-task-identity-CAS-deny-without-writes",
    "native-receipt-failure-rolls-back-whole-task-batch-and-review-state",
    "native-concurrent-apply-exact-replay-creates-once-with-execution-zero-and-maker-source-trail",
    "same-source-second-application-denied-and-unsealed-definition-requires-explicit-replacement",
    "imported-definition-enters-canonical-quantity-proposal-without-crediting-work-before-independent-review",
    "pending-even-expired-proposal-blocks-import-replacement-until-canonical-reconciliation",
    "independent-authorized-approval-seals-exact-baseline-and-prevents-import-source-relabel",
    "current-membership-revocation-denies-private-source-and-exact-receipt-recovery",
    "document-null-code-explicit-existing-review-apply-preserves-task-count-dates-status-progress-and-source-proof",
    "document-existing-native-COMMIT-ACK-loss-recovers-original-receipt-and-exact-UUID-without-second-write",
    "document-existing-Task-CAS-change-after-review-denies-apply-with-only-bound-rejection",
    "document-existing-real-pending-proposal-created-after-review-blocks-apply-without-crediting-progress",
    "document-existing-null-code-cannot-replace-another-source-despite-identical-null-row-and-title",
    "document-existing-second-row-SQL-failure-rolls-back-first-Task-draft-and-receipt-then-exact-retry-applies-once"
  ],
  "nativePreviousCount": 11,
  "nativeCount": 17,
  "previousUiVersion": "plan-measurement-ui-v2",
  "uiVersion": "plan-measurement-ui-v3",
  "uiPreviousCount": 19,
  "uiCount": 25,
  "browserSourceCount": 18,
  "previousRuntimeSourceCount": 14,
  "runtimeSourceCount": 17,
  "runtimeAdditions": [
    "src/lib/plan-measurement-configuration.mjs",
    "src/lib/plan-measurement-store.mjs",
    "tests/fixtures/plan-measurement-document-association-synthetic.mjs"
  ],
  "runtimePreviousPathsSha256": "c568a33fc8226eb64c1a09e1b5aef30a335abfb37fa603c49e3f99b3dd026f8a",
  "runtimeCurrentPathsSha256": "01f7fa11809ac25078bd09759bf50b30cd1f0e465d69919432aeddf6b7f6a756",
  "nativeCurrentCount": 118,
  "publishedNativeCount": 113,
  "aiNativeCount": 115
});
export const DOCUMENT_TASK_ASSOCIATION_CURRENT_REVISION=Object.freeze({
  "version": "plan-measurement-document-association-lineage-v1",
  "status": "REVIEWED_FROZEN_CURRENT_SOURCE",
  "referenceHead": "a203e7153135a206362fad3995ea115387df7032",
  "referenceTree": "e3479289f83931f480ff80c30b62108049543129",
  "previousContractSha256": "10319b1ab8a283b7c89cab96a279e20e25fe4be2736d91caaa915a4e62afa524",
  "reviewedSourceChanges": [
    {
      "path": "scripts/verify-plan-measurement-postgres.mjs",
      "previousSha256": "291dbb75b28d9c04a961891c758108735b61d60a2299a05e45b437ab32049446",
      "currentSha256": "13a022b79f8b2934cb353b81aa1be0ed52d48af95ad457746d4b884aa3260ba4"
    },
    {
      "path": "scripts/verify-plan-measurement-ui.mjs",
      "previousSha256": "db73562d27ff958c72558b38f1dcaed62efa1b6593fdfa00910fae40b3150a1e",
      "currentSha256": "12dcd1879cde33a9d6b8d696d9de8907ce29ad29c8eb808f727be8206bc19f5c"
    },
    {
      "path": "src/lib/plan-measurement-policy.mjs",
      "previousSha256": "add700716b50aeeaefbb3b5acf2675277140c2e117adbd36a0ac1190ce15b805",
      "currentSha256": "3d6b0bce58a7f89612878310f534d8cf02f6a222c778cd4294b415c1f61157b7"
    },
    {
      "path": "src/lib/plan-measurement-store.mjs",
      "previousSha256": "d8a8d25feb4f48dba4cdf3d87f08c2100d054e987be18652d6a9d2ce75396ca2",
      "currentSha256": "f1267df1fcd5ddc7d5ce6bfbf6693cda124135350025579075ed2ba8460334f2"
    },
    {
      "path": "src/lib/plan-measurement-configuration.mjs",
      "previousSha256": "1ac96b5d644173a9830a9b47b22381861ed1ddbb7e0a043165c2376e70bfd313",
      "currentSha256": "d016926aec29c0f3bf60f8b012e5c52e2bd1c7e2188d4534b7579f7aee28b08d"
    },
    {
      "path": "src/app/(identity)/cuenta/plan-measurement-view.mjs",
      "previousSha256": "ba6c55a030fe53174825b620bc7f0b349d6fb66b6c827f5e8ca0eda393e8ff5d",
      "currentSha256": "02a80449af709fdda97dfaf48b0335bd96ab7dc363804f59a5d9ea8579581d30"
    },
    {
      "path": "src/app/(identity)/cuenta/plan-measurement-panel.js",
      "previousSha256": "08214cdfbf5fdf921a0ac6527437367cb5dff7e7b0de724b149d8483900da042",
      "currentSha256": "d9d1cd683a8aaf0ad1ea5656c03c12c00935c3653f54d9326196617b60039832"
    }
  ],
  "validationDeltas": [
    {
      "path": "scripts/lib/integrated-identity-current-ci-lineage.mjs",
      "previousSha256": "8b9911e2f54cad5df7602ae54632ced337a8d4aeac1a31762e59129336db2782",
      "currentSha256": "0589622d1111637cf170657b52bf71c9b74f1fb2e65cb7258b0dc68db25fed98"
    },
    {
      "path": "scripts/lib/participant-preanalysis-current-ci-lineage.mjs",
      "previousSha256": "1a2dc8dc09a2b52d6b9fd1a814a2e71464c2f9d63491d5077c4431fa45c4c0e7",
      "currentSha256": "f1e94bbb3f370c769fa4ce74fb70310b4617605d890ffacc7113fc9fce736399"
    },
    {
      "path": "scripts/verify-plan-measurement-ci.mjs",
      "previousSha256": "d192c3b4d29bcd44262ba93c5bc8ca69b87693081704ac1309ebd57ada0199a8",
      "currentSha256": "86e9fe3dbe138caf327a2ea09c7b817cc0e8bf88b8ed273d0cf5363e95a0176f"
    },
    {
      "path": "tests/fixtures/plan-measurement-ci-unit.mjs",
      "previousSha256": "24c6494d8fb4bb6230df133faf1fd68e64fd0eefa7e0f83ad17c80ed07f567e4",
      "currentSha256": "0dc1675460a96cb54cc0da2bcc64bfccaa704295543c4f632b742a244d917d93"
    },
    {
      "path": "tests/production-plan-measurement-ci.test.mjs",
      "previousSha256": "2388c7639b46b47cb5d0597bb854c9f250c1f6638f372f69689007769f67c6e4",
      "currentSha256": "286ea19ff474a4bda4254650faa49cdc9b40dd54bcb5a878d61941f960a85a2b"
    },
    {
      "path": "tests/production-integrated-identity-current-ci-lineage.test.mjs",
      "previousSha256": "65b15aac2bccc46cb6a8dc7982e4a2566ac72edeef48cb40367706850b2b4c4e",
      "currentSha256": "c13b690839a47f7ddd3ff2004f731236248b9698e789dcbd7be0ef39da6462b9"
    },
    {
      "path": "tests/production-ooxml-accounting-current-ci-lineage.test.mjs",
      "previousSha256": "cbda38fcd5bb0220f433ec03d9152984786d2656b53c8ccc26b90b9ff108ba07",
      "currentSha256": "b21de4ac898eea69683adeba44d66aba170ad6cd8625c75203f307bef68d4762"
    },
    {
      "path": "tests/production-integrated-identity-ui-producer-migration.test.mjs",
      "previousSha256": "f419f907985fc8b9edbd6156bac719472137ac489a8b505df1177c3c619f4b7d",
      "currentSha256": "e3f47007ae8365064e8dc625aee4190fb44d8291a7e098cec0bcc8c19532282c"
    },
    {
      "path": "tests/production-plan-measurement-current-ci-lineage.test.mjs",
      "previousSha256": "b0cafe723a23cf47e59ae24f76a68ccc051a7ee7ac93ce8b7cbbfb6a22959a85",
      "currentSha256": "ed0fbc0ea043ba056df9b3cee093af63d16c9f56ea1bb999db0b7a77f0c54fb9"
    }
  ],
  "addedSources": [
    {
      "path": "tests/production-plan-measurement-document-association.test.mjs",
      "sha256": "9a46b2947b432227cd50e56c3552940a8de5e594a8d26ef7a9fa11193f539fb3"
    },
    {
      "path": "tests/production-plan-measurement-document-association-view.test.mjs",
      "sha256": "76bc724c475538296547559c2a7be0216d407c2e95faad39ed82d2a99f7f7143"
    },
    {
      "path": "tests/fixtures/plan-measurement-document-association-synthetic.mjs",
      "sha256": "99608056326f95f963b99c8b2337227f5564411a35e03dcaa43d638bb085adfa"
    }
  ],
  "proofSourceDeltas": [
    {
      "id": "participant-kyc-preanalysis-postgres",
      "family": "WORKSPACE_PG_PARTICIPANT_KYC_PREANALYSIS",
      "previousCount": 229,
      "previousPathsSha256": "935ce4042c36639e55046301a2c72c93200cdc72f8a8d989ca7a8b403cffddee",
      "currentCount": 231,
      "currentPathsSha256": "31655b2096aac71b78ab7471af7c538c75019a153beb40393d012a823b9f1835",
      "additions": [
        "scripts/lib/plan-measurement-document-association-ci-lineage.mjs",
        "tests/fixtures/plan-measurement-contract-a203.json"
      ]
    },
    {
      "id": "focused-workspace-ui",
      "family": "FOCUSED_WORKSPACE_CI",
      "previousCount": 168,
      "previousPathsSha256": "712011a79baf15b67f34d8dc521920795346612e347ac4b0e5eed3a47b48a770",
      "currentCount": 170,
      "currentPathsSha256": "aea278136cfc58258f3f92e081cbdf9066c4770a48371eaa079b5ce5a4a77a88",
      "additions": [
        "scripts/lib/plan-measurement-document-association-ci-lineage.mjs",
        "tests/fixtures/plan-measurement-contract-a203.json"
      ]
    }
  ],
  "sourceSetDeltas": [
    {
      "family": "MEASUREMENT_UI_RUNTIME",
      "previousCount": 14,
      "previousPathsSha256": "c568a33fc8226eb64c1a09e1b5aef30a335abfb37fa603c49e3f99b3dd026f8a",
      "currentCount": 17,
      "currentPathsSha256": "01f7fa11809ac25078bd09759bf50b30cd1f0e465d69919432aeddf6b7f6a756",
      "additions": [
        "src/lib/plan-measurement-configuration.mjs",
        "src/lib/plan-measurement-store.mjs",
        "tests/fixtures/plan-measurement-document-association-synthetic.mjs"
      ]
    }
  ],
  "measurement": {
    "nativeCheckNames": [
      "canonical-responsible-permission-scope-and-foreign-project-before-storage",
      "real-private-local-upload-retains-source-exact-quantity-provenance-without-task-or-provider-effects",
      "audited-predecision-rejection-replay-recovery-has-zero-task-draft-proposal-effects-and-allows-fresh-review",
      "source-draft-and-explicit-task-identity-CAS-deny-without-writes",
      "native-receipt-failure-rolls-back-whole-task-batch-and-review-state",
      "native-concurrent-apply-exact-replay-creates-once-with-execution-zero-and-maker-source-trail",
      "same-source-second-application-denied-and-unsealed-definition-requires-explicit-replacement",
      "imported-definition-enters-canonical-quantity-proposal-without-crediting-work-before-independent-review",
      "pending-even-expired-proposal-blocks-import-replacement-until-canonical-reconciliation",
      "independent-authorized-approval-seals-exact-baseline-and-prevents-import-source-relabel",
      "current-membership-revocation-denies-private-source-and-exact-receipt-recovery",
      "document-null-code-explicit-existing-review-apply-preserves-task-count-dates-status-progress-and-source-proof",
      "document-existing-native-COMMIT-ACK-loss-recovers-original-receipt-and-exact-UUID-without-second-write",
      "document-existing-Task-CAS-change-after-review-denies-apply-with-only-bound-rejection",
      "document-existing-real-pending-proposal-created-after-review-blocks-apply-without-crediting-progress",
      "document-existing-null-code-cannot-replace-another-source-despite-identical-null-row-and-title",
      "document-existing-second-row-SQL-failure-rolls-back-first-Task-draft-and-receipt-then-exact-retry-applies-once"
    ],
    "nativePreviousCount": 11,
    "nativeCount": 17,
    "previousUiVersion": "plan-measurement-ui-v2",
    "uiVersion": "plan-measurement-ui-v3",
    "uiPreviousCount": 19,
    "uiCount": 25,
    "browserSourceCount": 18,
    "previousRuntimeSourceCount": 14,
    "runtimeSourceCount": 17,
    "runtimeAdditions": [
      "src/lib/plan-measurement-configuration.mjs",
      "src/lib/plan-measurement-store.mjs",
      "tests/fixtures/plan-measurement-document-association-synthetic.mjs"
    ],
    "runtimePreviousPathsSha256": "c568a33fc8226eb64c1a09e1b5aef30a335abfb37fa603c49e3f99b3dd026f8a",
    "runtimeCurrentPathsSha256": "01f7fa11809ac25078bd09759bf50b30cd1f0e465d69919432aeddf6b7f6a756",
    "nativeCurrentCount": 118,
    "publishedNativeCount": 113,
    "aiNativeCount": 115
  },
  "limits": {
    "metadataInverseOnly": true,
    "originalRawProofsTransformed": false,
    "previousReceiptsReclassified": false,
    "canonicalGitLfSourcePins": true,
    "localRawCrLfProofsRemainLocalReview": true,
    "providerOrProductionAcceptance": false
  }
});
function deepFreeze(value){if(value&&typeof value==='object'){for(const child of Object.values(value))deepFreeze(child);Object.freeze(value);}return value;}
deepFreeze(checkpoint);deepFreeze(DOCUMENT_TASK_ASSOCIATION_MEASUREMENT);deepFreeze(DOCUMENT_TASK_ASSOCIATION_CURRENT_REVISION);
const historicalPinCache=new Map();
const checkpointDigest=sha(JSON.stringify(checkpoint,null,2)+'\n');
requireLineage(checkpointDigest===DOCUMENT_TASK_ASSOCIATION_PREVIOUS_CONTRACT_SHA256,'The complete a203 checkpoint is immutable');
function section(contract){
 if(!plain(contract)||!Object.hasOwn(contract,DOCUMENT_TASK_ASSOCIATION_SECTION))return null;
 const value=contract[DOCUMENT_TASK_ASSOCIATION_SECTION],expected=DOCUMENT_TASK_ASSOCIATION_CURRENT_REVISION;
 requireLineage(expected.status==='REVIEWED_FROZEN_CURRENT_SOURCE','Current document association source binding is not frozen');
 exactKeys(value,[...Object.keys(expected),'validationSources'],'Exact additive document association revision shape required');
 for(const[key,item]of Object.entries(expected))requireLineage(same(value[key],item),'Unreviewed document association revision: '+key);
 requireLineage(Array.isArray(value.validationSources)&&same(value.validationSources.map(row=>row?.path),[DOCUMENT_TASK_ASSOCIATION_HELPER_PATH,DOCUMENT_TASK_ASSOCIATION_TEST_PATH]),'Exact current outer validation source paths required');
 for(const row of value.validationSources){exactKeys(row,['path','sha256'],'Exact validation pin shape required');requireLineage(hash(row.sha256),'Current validation pin required');}
 return value;
}
function union(previous,delta){
 requireLineage(Array.isArray(previous)&&previous.length===delta.previousCount&&sha(JSON.stringify(previous))===delta.previousPathsSha256,'Exact a203 source set required: '+delta.family);
 requireLineage(Array.isArray(delta.additions)&&new Set(delta.additions).size===delta.additions.length&&delta.additions.every(file=>sourcePath(file)&&!previous.includes(file)),'Only exact additive source dependencies are allowed');
 const current=[...previous,...delta.additions].sort();requireLineage(current.length===delta.currentCount&&sha(JSON.stringify(current))===delta.currentPathsSha256,'Exact current source set required: '+delta.family);return current;
}
export function composeDocumentTaskAssociationContract(value){
 section({[DOCUMENT_TASK_ASSOCIATION_SECTION]:value});const current=structuredClone(checkpoint);
 for(const delta of value.proofSourceDeltas){const proof=current.extension.proofs.find(row=>row.id===delta.id);requireLineage(Boolean(proof),'Unknown a203 proof');proof.sourceFiles=union(proof.sourceFiles,delta);if(delta.id==='participant-kyc-preanalysis-postgres'){requireLineage(same(current.participantPreanalysisCurrentRevision.ciSourceFiles,checkpoint.extension.proofs.find(row=>row.id===delta.id).sourceFiles),'AI current metadata and proof sources must agree');current.participantPreanalysisCurrentRevision.ciSourceFiles=[...proof.sourceFiles];}}
 current[DOCUMENT_TASK_ASSOCIATION_SECTION]=structuredClone(value);return current;
}
// This is a metadata-only inverse. It never changes an original producer proof
// or exposes historical bytes as the current readSource result.
export function restoreDocumentTaskAssociationPreviousContract(contract){
 contract=restoreWorkspaceContinuityPreviousContract(contract);
 const value=section(contract);if(!value)return contract;
 requireLineage(same(contract,composeDocumentTaskAssociationContract(value)),'The outer delta must restore the complete a203 contract without altering history');return structuredClone(checkpoint);
}
function authenticatedSection(contract){const value=section(contract);if(value)restoreDocumentTaskAssociationPreviousContract(contract);return value;}
function historicalPins(file){
 if(historicalPinCache.has(file))return new Set(historicalPinCache.get(file));
 const result=new Set();function walk(value){if(!value||typeof value!=='object')return;if(!Array.isArray(value)&&(value.path===file||value.file===file||value.producer===file)){for(const key of ['sha256','sourceLfSha256','producerSha256','previousSha256','currentSha256','originalSha256','previousProducerSha256','currentProducerSha256'])if(hash(value[key]))result.add(value[key]);}for(const item of Object.values(value))if(item&&typeof item==='object')walk(item);}walk(checkpoint);historicalPinCache.set(file,[...result]);return result;
}
export function documentTaskAssociationCurrentSourcePin(contract,ref){
 const outerPin=workspaceContinuityCurrentSourcePin(contract,ref);if(outerPin!==ref.sha256)return outerPin;
 const value=section(contract);if(!value)return ref.sha256;
 const row=[...value.reviewedSourceChanges,...value.validationDeltas].find(item=>item.path===ref.path);if(!row)return ref.sha256;
 const expected=historicalPins(ref.path);expected.add(row.previousSha256);
 requireLineage(expected.has(ref.sha256),'Only an exact authenticated previous source pin may advance: '+ref.path);return row.currentSha256;
}
export function documentTaskAssociationValidationFiles(contract){
 const outer=workspaceContinuityValidationFiles(contract),value=authenticatedSection(contract);if(!value)return outer;
 return [...new Set([...outer,DOCUMENT_TASK_ASSOCIATION_CHECKPOINT_PATH,...value.reviewedSourceChanges.map(row=>row.path),...value.validationDeltas.map(row=>row.path),...value.addedSources.map(row=>row.path),...value.validationSources.map(row=>row.path)])].sort();
}
export function verifyDocumentTaskAssociationCurrentSources(contract,readSource){
 if(contract?.planBudgetCurrentRevision?.captureQualityRuntime){
  try{return withCaptureRuntimePreviousSources(contract,readSource,(parent,parentRead)=>verifyPreviousDocumentTaskAssociationCurrentSources(parent,parentRead));}
  catch(error){if(error.code==='PLAN_BUDGET_CURRENT_CI_LINEAGE_REJECTED')requireLineage(false,error.message);throw error;}
 }
 return verifyPreviousDocumentTaskAssociationCurrentSources(contract,readSource);
}
function verifyPreviousDocumentTaskAssociationCurrentSources(contract,readSource){
 verifyWorkspaceContinuityCurrentSources(contract,readSource);
 const value=authenticatedSection(contract);if(!value)return null;requireLineage(typeof readSource==='function','Current committed source reader required');
 const original=readSource(DOCUMENT_TASK_ASSOCIATION_CHECKPOINT_PATH);requireLineage(Buffer.isBuffer(original)&&sha(original)===DOCUMENT_TASK_ASSOCIATION_PREVIOUS_CONTRACT_SHA256,'Original a203 RAW checkpoint bytes required');
 const refs=[...value.reviewedSourceChanges.map(row=>({path:row.path,sha256:row.currentSha256})),...value.validationDeltas.map(row=>({path:row.path,sha256:row.currentSha256})),...value.addedSources,...value.validationSources];
 requireLineage(new Set(refs.map(row=>row.path)).size===refs.length,'Unique outer source references required');
 for(const row of refs){const bytes=readSource(row.path);requireLineage(Buffer.isBuffer(bytes),'Missing current outer source: '+row.path);const text=bytes.toString('utf8');requireLineage(bytes.equals(Buffer.from(text))&&sha(text.replaceAll('\r\n','\n'))===workspaceContinuityCurrentSourcePin(contract,row),'Stale current outer source: '+row.path);}
 return{version:1,previousContractSha256:DOCUMENT_TASK_ASSOCIATION_PREVIOUS_CONTRACT_SHA256,completeCheckpointRestored:true,historical49PinsPreserved:true,auxiliaryValidationSources:refs.map(row=>({...row})),nativeOrBrowserAcceptance:false};
}
export function restoreDocumentTaskAssociationSourceSet(family,files,contract){
 files=restoreWorkspaceContinuitySourceSet(family,files,contract);
 const value=authenticatedSection(contract);if(!value)return files;const delta=[...value.sourceSetDeltas,...value.proofSourceDeltas].find(row=>row.family===family);if(!delta)return files;
 requireLineage(Array.isArray(files)&&new Set(files).size===files.length&&same(files,[...files].sort())&&files.length===delta.currentCount&&sha(JSON.stringify(files))===delta.currentPathsSha256,'Exact current source set required: '+family);
 const previous=files.filter(file=>!delta.additions.includes(file));requireLineage(previous.length===delta.previousCount&&sha(JSON.stringify(previous))===delta.previousPathsSha256,'Exact a203 predecessor sources must remain present: '+family);return previous;
}
export function documentTaskAssociationProofSourceAdditions(spec){
 const outer=workspaceContinuityProofSourceAdditions(spec);if(outer.length)spec={...spec,sourceFiles:spec.sourceFiles.filter(file=>!outer.includes(file))};
 const delta=DOCUMENT_TASK_ASSOCIATION_CURRENT_REVISION.proofSourceDeltas?.find(row=>row.id===spec?.id);if(!delta)return outer;
 if(spec.sourceFiles?.length===delta.previousCount&&sha(JSON.stringify(spec.sourceFiles))===delta.previousPathsSha256)return outer;
 // The inner published helper retains its exact200 predecessor oracle. This
 // metadata-only exemption never changes the actual231 source contract.
 const inherited=checkpoint.integratedIdentityCurrentRevision.proofSourceDeltas.find(row=>row.id===spec.id);
 if(inherited&&spec.sourceFiles?.length===inherited.previousCount&&sha(JSON.stringify(spec.sourceFiles))===inherited.previousPathsSha256)return outer;
 requireLineage(spec.sourceFiles?.length===delta.currentCount&&sha(JSON.stringify(spec.sourceFiles))===delta.currentPathsSha256,'Unknown document association proof source set');return [...delta.additions,...outer];
}