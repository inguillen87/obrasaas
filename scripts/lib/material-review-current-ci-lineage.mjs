import {createHash} from 'node:crypto';
import {parse} from '@babel/parser';
import {homeDecisionsLegacyOperationsAst} from './home-decisions-current-ci-lineage.mjs';
import {restoreExistingApiPlanPreviousContract as planOuter0,existingApiPlanPreviousSourcePin as planOuter1,existingApiPlanCurrentSourcePin as planOuter2,existingApiPlanValidationFiles as planOuter3,verifyExistingApiPlanCurrentSources as planOuter4,restoreExistingApiPlanSourceSet as planOuter5,existingApiPlanProofSourceAdditions as planOuter6} from './meta-existing-api-plan-current-ci-lineage.mjs';
function planOuterCall(fn,args){try{return fn(...args);}catch(error){if(error.code==='EXISTING_API_PLAN_CURRENT_CI_LINEAGE_REJECTED')throw Object.assign(new Error(error.message),{code:'MATERIAL_REVIEW_CURRENT_CI_LINEAGE_REJECTED'});throw error;}}
const restoreExistingApiPlanPreviousContract=(...args)=>planOuterCall(planOuter0,args);
const existingApiPlanPreviousSourcePin=(...args)=>planOuterCall(planOuter1,args);
const existingApiPlanCurrentSourcePin=(...args)=>planOuterCall(planOuter2,args);
const existingApiPlanValidationFiles=(...args)=>planOuterCall(planOuter3,args);
const verifyExistingApiPlanCurrentSources=(...args)=>planOuterCall(planOuter4,args);
const restoreExistingApiPlanSourceSet=(...args)=>planOuterCall(planOuter5,args);
const existingApiPlanProofSourceAdditions=(...args)=>planOuterCall(planOuter6,args);

export const MATERIAL_REVIEW_CURRENT_SECTION='materialReviewCurrentRevision';
export const MATERIAL_REVIEW_CURRENT_HELPER='scripts/lib/material-review-current-ci-lineage.mjs';
export const MATERIAL_REVIEW_CURRENT_TEST='tests/production-material-review-current-ci-lineage.test.mjs';
export const MATERIAL_REVIEW_CURRENT_REVISION=Object.freeze({
  "version": 1,
  "status": "REVIEWED_MATERIAL_READS_AND_UI",
  "predecessorCommit": "3c853aa6baf900b123efb7cbdd95ea86508bdb8a",
  "previousContractSha256": "1bb5e262dac06377590ea983a9c800163726cb6510ae0fbbbdca17309253c6af",
  "reviewedSourceChanges": [
    {
      "path": "scripts/verify-material-inventory-postgres.mjs",
      "previousSha256": "aa743a8181cb2db8d18a024cd8f666247f4232376b5b60f20234c106f0e73289",
      "currentSha256": "727d5d4841f787dc92d4b08b8d316a673c3e119dfe5ce70cbb332a80945ead47"
    },
    {
      "path": "scripts/verify-material-inventory-ui.mjs",
      "previousSha256": "d3793a6122a6ecd0c15dc0ba6d55d57bb7e0bb01756d77fd5c8bb6822c960cc8",
      "currentSha256": "1a092c5165fc3323e05b939d332892e89dc687a5d46412d1b651c4053003892a"
    },
    {
      "path": "scripts/verify-operations-status-ui.mjs",
      "previousSha256": "26f6b27024ee51aae910435774de8c61ad19b4fa823348289b973e6227a08b07",
      "currentSha256": "631e92a4149f78b4a903a212ee22c25141af29910fcf66ee68b4366da1c6f1a3"
    },
    {
      "path": "src/app/(identity)/cuenta/material-inventory-panel.js",
      "previousSha256": "4d62e1542deaa10e218237e507eba13823e0d8601b4d755969dc96a9fc26081c",
      "currentSha256": "f03cbf48429283b6184c24682c005714180e4777fc8b9f8af0f702d4ac138bb2"
    },
    {
      "path": "src/app/(identity)/cuenta/material-inventory-panel.module.css",
      "previousSha256": "1e7b6dab78b04008a0ea08670cd33396a95b6f76a1b43d49e1f76b85e6148804",
      "currentSha256": "1d7eec4afc275ee403674b187acb7844e3df519f24cd537af2e05f7b8032611c"
    },
    {
      "path": "src/app/(identity)/cuenta/material-inventory-view.mjs",
      "previousSha256": "ec71bacde17b7b9742a0e9a1423ff4573a7d2629f09fe644e586fbe5b5d6fc3c",
      "currentSha256": "8b987424dd1db2332cbb26f792e51c8fea286bd5440f4d3235809e3869722b83"
    },
    {
      "path": "src/app/(identity)/cuenta/operations-status-panel.js",
      "previousSha256": "67564edace3295413dc80d3fc7bdc5f792c52042e8904dda87e2e3735c2eb4bc",
      "currentSha256": "e069565737378ca2583609a4b978d1ac6efdf9da922736b1bcf70d4674e84b5e"
    },
    {
      "path": "src/app/(identity)/cuenta/operations-status-panel.module.css",
      "previousSha256": "81aac31bf27b5a0253e0d51ae5b66bb04a6d07c267c19b30b3a44c26f9bf01a0",
      "currentSha256": "73d25fe9f75c2144aeb337dd0737c3cae3f07fb98c9acb39d6e6c88a4e6053ef"
    },
    {
      "path": "src/lib/field-operations-http.mjs",
      "previousSha256": "3a3692547dda6dbc46d7fd9cc3034851f6aba125d50d4d5bc69d22b5e86b2da2",
      "currentSha256": "abcb0371eb77495ca5a5e8c82d0d6d8d53aa89508af783be31406a884bdb93ea",
      "unchangedSurfaceSha256": "102e8889b530ebbe028f629f346eb14d7a2ad97e0223fc7decfd00834f9e0693"
    },
    {
      "path": "src/lib/field-operations-store.mjs",
      "previousSha256": "9950d43fe27eb1b5e234e7994a266cdbf5b7ede18db06530642c8a51f0af9a95",
      "currentSha256": "62d83e35824cff2c8b722c2b379b6d5485b1249452d578415e13a019a5588bcd",
      "unchangedSurfaceSha256": "d03a9e83e8f0492ab48b19ac4131830aa191a97787265141e0d86f12be24e81c"
    },
    {
      "path": "src/lib/material-inventory.mjs",
      "previousSha256": "ec1463895419b7806e32b434b3f57a61ab1f6c7c1b968dc13d89fcdcfe07da6a",
      "currentSha256": "4b599d273c4cadcdf76202554757583152da8c11b0a754be386bffb830f0c65b",
      "unchangedSurfaceSha256": "4391e277bb18267809b57c1496ee66fb3e33df9076290589fa2706793b6c82d5"
    },
    {
      "path": "src/lib/operations-status.mjs",
      "previousSha256": "941ad0d08725007fc4be98a617c84f2a82a844a2a06ac9488b9fc9d428d8d9ce",
      "currentSha256": "11a821f858e24a81208d1a3196703f6b4c29330e931ee3ae5998fd0d49dbf5bd",
      "unchangedSurfaceSha256": "153aa0e2be248108dd3f7c96dd42bef1c5ccb895cef2ad90b873634e67a9c4c8"
    },
    {
      "path": "tests/production-integrated-identity-current-ci-lineage.test.mjs",
      "previousSha256": "8496a01877f9de82945b4d0ff0cf6431b71e70e9a320319f8acd66a1aa09d982",
      "currentSha256": "b3400215a6a79397b80454ef5f6a052f6db3f11f7a94763ffa30a7eb93457d1e"
    },
    {
      "path": "tests/production-operations-status.test.mjs",
      "previousSha256": "749b683ded3a7b9239dee1669a47e0e924afa3a6cc91dd603ef9dbfd6a00c0b8",
      "currentSha256": "3b94ae535c03942e29bc09db7e9f9d074e18930a38fe6c56bfdb36c4c68d6a4e"
    },
    {
      "path": "tests/production-plan-measurement-current-ci-lineage.test.mjs",
      "previousSha256": "c55ffae0870fde49a795842c77fca3a9657b0efb687ea3487787ded2ebdb21ee",
      "currentSha256": "09719c4910dda130e3965a6d3a28cce56881963fbe40e1b5922006777494cc7e"
    },
    {
      "path": "tests/production-workspace-continuity-current-ci-lineage.test.mjs",
      "previousSha256": "b68b3ebacd8cdf29c9d2f7b791c24d05e748c9c1d603fe7953c31de18c8fc990",
      "currentSha256": "4d38db92300211adb8c02340c495ad5aed68d4ae326ffc3f5f6f8d3af2854eda"
    }
  ],
  "addedSources": [
    {
      "path": "tests/production-material-inventory-queue-panel.test.mjs",
      "sha256": "56908d483002a7f22f2bd97fbc3bb42ae8e0696eac9728c8cf742e5a3e039f31"
    },
    {
      "path": "tests/production-material-inventory-queue-view.test.mjs",
      "sha256": "46d6e05c3d0ce27f82c9f801dee09af31f02920d8bbe411ff91d496363310dc6"
    },
    {
      "path": "tests/production-material-inventory-review-queue.test.mjs",
      "sha256": "22e981046a285a84ed2da2e5e187e006d4a503d9c3ae1852151f5644b23eac08"
    }
  ],
  "validationDeltas": [
    {
      "path": "scripts/lib/whatsapp-field-continuity-current-ci-lineage.mjs",
      "previousSha256": "77186c957020c61a74cfddd8de1d5c80835c37e7714016e7d9fe4b0e7cceac5b",
      "currentSha256": "21c44aea395219b2d3c289e617b535a24f7565c139ded824764b33639e38981d"
    },
    {
      "path": "tests/production-whatsapp-field-continuity-current-ci-lineage.test.mjs",
      "previousSha256": "15c2404c6ae43b86207f8e26915e642c6b1efa752e579e59d76fc50655e14b9b",
      "currentSha256": "6e8a12fc32a3eb57f146d31788ff2a2c8396f72763953e7ee0d9e76a4c896c71"
    }
  ],
  "proofSourceDeltas": [
    {
      "id": "participant-kyc-preanalysis-postgres",
      "family": "PG_PARTICIPANT_KYC_PREANALYSIS",
      "previousCount": 235,
      "previousPathsSha256": "71c09c50336b9e87cd1da0de7618209175846b70f6d5d890432d274ca039aed2",
      "currentCount": 236,
      "currentPathsSha256": "3bb953705acc389789b7c2cf465ebe39dbd89be683c36f29ce64d5356d946aa0",
      "additions": [
        "scripts/lib/material-review-current-ci-lineage.mjs"
      ]
    },
    {
      "id": "focused-workspace-ui",
      "family": "UI_FOCUSED_WORKSPACE",
      "previousCount": 180,
      "previousPathsSha256": "5163b57706633f09f8f66345b4694326b36d208b3f21206191cd388d23505961",
      "currentCount": 181,
      "currentPathsSha256": "5bfe95440c584af2c30487188ca644dbd05434f9eb15ee60a98dc71a3cdf5578",
      "additions": [
        "scripts/lib/material-review-current-ci-lineage.mjs"
      ]
    },
    {
      "id": "field-task-pagination-ui",
      "family": "UI_FIELD_TASK_PAGINATION",
      "previousCount": 62,
      "previousPathsSha256": "6fb541e46adac1ed66a262398b26b8af73ce5de2fd267b584a6bf1308f8f9fd7",
      "currentCount": 63,
      "currentPathsSha256": "718c812e30061467b52a99c9d7383463b02bc2ae4c69eafb5015c8c396aff7ca",
      "additions": [
        "scripts/lib/material-review-current-ci-lineage.mjs"
      ]
    }
  ],
  "sourceSetDeltas": [],
  "nativeOrBrowserAcceptance": false
}); // REVIEWED_REVISION_DATA
const sha=value=>createHash('sha256').update(value).digest('hex');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const plain=value=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const safe=value=>typeof value==='string'&&/^(?:src|scripts|tests)\//.test(value)&&!value.includes('..')&&!value.includes('\\');
const reject=(ok,message)=>{if(!ok)throw Object.assign(new Error(message),{code:'MATERIAL_REVIEW_CURRENT_CI_LINEAGE_REJECTED'});};
const exactKeys=(value,keys,message)=>reject(plain(value)&&same(Object.keys(value).sort(),[...keys].sort()),message);
const ignored=new Set(['start','end','loc','extra','comments','leadingComments','innerComments','trailingComments']);
const name=node=>node?.name??node?.value;
const filterBranch=node=>node?.type==='IfStatement'&&node.test?.type==='CallExpression'&&node.test.callee?.type==='MemberExpression'&&node.test.callee.object?.name==='params'&&node.test.callee.property?.name==='has'&&node.test.arguments?.length===1&&node.test.arguments[0]?.value==='inventoryFilter';

// These projections preserve every pre-existing write, KYC, membership and
// transport expression. Only the four explicitly reviewed read surfaces vanish.
// Their digests were compared with the complete 3c853aa Git source, not a proof.
// Exact inverse of the independently reviewed live/hours read-only additions.
// This projects AST metadata, never historical source bytes. Unknown source
// bodies receive no inverse and must still satisfy the original source/surface
// checks. Each approved body must remove exactly its two reviewed nodes and
// recover the entire predecessor AST before the inherited surface is checked.
const WORKSITE_LIVE_HOURS_MATERIAL_AST=Object.freeze({
  "src/lib/field-operations-http.mjs": {
    "previousSourceSha256": "abcb0371eb77495ca5a5e8c82d0d6d8d53aa89508af783be31406a884bdb93ea",
    "currentSourceSha256": "df60181e3d852efe42d86a284ced3c0ff9cf4c7fbcaf863de8da4d47c2f7aeaf",
    "previousAstSha256": "a30efc1e1fae7b1ace855b1e75edd882d9100db6934124c7aed3f501bf457d24",
    "removedNodes": [
      {
        "type": "ImportDeclaration",
        "sha256": "c636f56a3e2ddaf65ace3524beaef471948d2e1e702de64229b9d24639a5ac19"
      },
      {
        "type": "IfStatement",
        "sha256": "fa8a55ba9ed0bfff00ac152e25a30d1d7bbe9618e6b1b77eb2fc35d74aceb0ca"
      }
    ]
  },
  "src/lib/field-operations-store.mjs": {
    "previousSourceSha256": "62d83e35824cff2c8b722c2b379b6d5485b1249452d578415e13a019a5588bcd",
    "currentSourceSha256": "dbf96641349efae61808a2d66a02d491ad06e2226885e6efa928dba53ce5034e",
    "previousAstSha256": "96bd56b857493a2231bef9647d62a17b8a689e75b79b83ce8f6bc121b1e59894",
    "removedNodes": [
      {
        "type": "ImportDeclaration",
        "sha256": "2ce43abc39ef43a3552c456ba01e2f348f74b032350c6b62f00d63e9b6c1220d"
      },
      {
        "type": "ObjectMethod",
        "sha256": "c620c0d42d81d37615bb5206be09459b21ef2ae7921a7d8829bdb424a466899b"
      }
    ]
  }
});
const materialSurfaceSyntax=value=>Array.isArray(value)?value.map(materialSurfaceSyntax):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([key])=>!ignored.has(key)).map(([key,child])=>[key,materialSurfaceSyntax(child)])):value;
function worksiteLiveHoursLegacyMaterialAst(file,bytes,tree){
 const row=WORKSITE_LIVE_HOURS_MATERIAL_AST[file];if(!row||sha(bytes.toString('utf8').replaceAll('\r\n','\n'))!==row.currentSourceSha256)return tree;
 const removed=new Set();
 function restore(node){
  if(Array.isArray(node))return node.map(restore).filter(value=>value!==null);
  if(!node||typeof node!=='object')return node;
  const candidates=row.removedNodes.filter(ref=>ref.type===node.type);
  if(candidates.length){const digest=sha(JSON.stringify(materialSurfaceSyntax(node))),matched=candidates.find(ref=>ref.sha256===digest);if(matched){reject(!removed.has(digest),'Repeated live/hours read AST node: '+file);removed.add(digest);return null;}}
  return Object.fromEntries(Object.entries(node).map(([key,child])=>[key,restore(child)]));
 }
 const previous=restore(tree);reject(removed.size===row.removedNodes.length,'Incomplete exact live/hours read AST inverse: '+file);
 reject(sha(JSON.stringify(materialSurfaceSyntax(previous)))===row.previousAstSha256,'Live/hours inverse changed predecessor business syntax: '+file);return previous;
}

export function materialReviewUnchangedSurface(file,bytes){
 const mode=({
  'src/lib/material-inventory.mjs':'MATERIAL_READS',
  'src/lib/field-operations-store.mjs':'INVENTORY_HISTORY',
  'src/lib/field-operations-http.mjs':'INVENTORY_GET',
  'src/lib/operations-status.mjs':'INVENTORY_COUNTS',
 })[file];
 if(!mode)return null;
 reject(Buffer.isBuffer(bytes),'Actual reviewed source bytes required');
 const parsed=worksiteLiveHoursLegacyMaterialAst(file,bytes,parse(bytes.toString('utf8'),{sourceType:'module'})),tree=mode==='INVENTORY_COUNTS'?homeDecisionsLegacyOperationsAst(parsed):parsed;
 function project(node){
  if(Array.isArray(node))return node.map(project).filter(value=>value!==null);
  if(!node||typeof node!=='object')return node;
  if(mode==='MATERIAL_READS'&&node.type==='ExportNamedDeclaration'&&node.declaration?.type==='FunctionDeclaration'&&['readInventory','readInventoryPendingCounts'].includes(node.declaration.id?.name))return null;
  if(mode==='INVENTORY_HISTORY'&&node.type==='ObjectMethod'&&name(node.key)==='inventoryHistory')return {type:'ReviewedReadMethod',name:'inventoryHistory'};
  if(mode==='INVENTORY_GET'&&filterBranch(node))return null;
  if(mode==='INVENTORY_COUNTS'&&node.type==='ImportDeclaration'&&['./field-operations-policy.mjs','./material-inventory.mjs'].includes(node.source?.value))return null;
  if(mode==='INVENTORY_COUNTS'&&node.type==='VariableDeclaration'){
   const declarations=node.declarations.filter(row=>!['inventoryCanManage','inventory'].includes(row.id?.name));
   if(!declarations.length)return null;
   node={...node,declarations};
  }
  if(mode==='INVENTORY_COUNTS'&&node.type==='ObjectProperty'&&name(node.key)==='inventory')return null;
  const result={};
  for(const[key,value]of Object.entries(node))if(!ignored.has(key)){
   const input=mode==='INVENTORY_GET'&&node.type==='ArrayExpression'&&key==='elements'?value.filter(row=>row?.type!=='StringLiteral'||row.value!=='inventoryFilter'):value;
   result[key]=project(input);
  }
  return result;
 }
 return sha(JSON.stringify(project(tree)));
}

function section(contract){
 if(!plain(contract)||!Object.hasOwn(contract,MATERIAL_REVIEW_CURRENT_SECTION))return null;
 const value=contract[MATERIAL_REVIEW_CURRENT_SECTION];
 exactKeys(value,[...Object.keys(MATERIAL_REVIEW_CURRENT_REVISION),'validationSources'],'Exact material review source revision required');
 for(const[key,expected]of Object.entries(MATERIAL_REVIEW_CURRENT_REVISION))reject(same(value[key],expected),'Unreviewed material review revision: '+key);
 reject(Array.isArray(value.validationSources)&&same(value.validationSources.map(row=>row?.path),[MATERIAL_REVIEW_CURRENT_HELPER,MATERIAL_REVIEW_CURRENT_TEST]),'Exact material review validation paths required');
 for(const row of value.validationSources){exactKeys(row,['path','sha256'],'Exact material review validation reference required');reject(hash(row.sha256),'Material review validation hash required');}
 return value;
}
export function restoreMaterialReviewPreviousContract(contract){
 contract=restoreExistingApiPlanPreviousContract(contract);
 const value=section(contract);if(!value)return contract;
 const previous=structuredClone(contract);delete previous[MATERIAL_REVIEW_CURRENT_SECTION];
 for(const delta of value.proofSourceDeltas||[]){
  const proofs=previous.extension?.proofs?.filter(row=>row.id===delta.id);
  reject(proofs?.length===1,'Exactly one material CI proof required: '+delta.id);
  const files=restoreMaterialSourcePaths(proofs[0].sourceFiles,delta);
  if(delta.id==='participant-kyc-preanalysis-postgres'){
   reject(same(previous.participantPreanalysisCurrentRevision?.ciSourceFiles,proofs[0].sourceFiles),'Material preanalysis CI metadata and proof must agree');
   previous.participantPreanalysisCurrentRevision.ciSourceFiles=[...files];
  }
  proofs[0].sourceFiles=files;
 }
 for(const delta of value.validationDeltas){
  const references=previous.whatsappFieldContinuityCurrentRevision?.validationSources?.filter(row=>row.path===delta.path);
  reject(references?.length===1&&references[0].sha256===delta.currentSha256,'Material review outer helper pin must advance with its declaration');
  references[0].sha256=delta.previousSha256;
 }
 reject(sha(JSON.stringify(previous,null,2)+'\n')===value.previousContractSha256,'The complete 3c853aa contract must restore without historical changes');
 return previous;
}
function restoreMaterialSourcePaths(files,delta){
 reject(Array.isArray(files)&&files.every(file=>typeof file==='string')&&new Set(files).size===files.length&&same(files,[...files].sort())&&files.length===delta.currentCount&&sha(JSON.stringify(files))===delta.currentPathsSha256,'Exact current material CI source set required: '+delta.family);
 const previous=files.filter(file=>!delta.additions.includes(file));
 reject(previous.length===delta.previousCount&&sha(JSON.stringify(previous))===delta.previousPathsSha256,'Exact material CI predecessor sources required: '+delta.family);
 return previous;
}
export function restoreMaterialReviewSourceSet(family,files,contract){
 files=restoreExistingApiPlanSourceSet(family,files,contract);
 const value=section(contract);if(!value)return files;
 restoreMaterialReviewPreviousContract(contract);
 const delta=[...(value.sourceSetDeltas||[]),...(value.proofSourceDeltas||[])].find(row=>row.family===family);
 return delta?restoreMaterialSourcePaths(files,delta):files;
}
export function materialReviewProofSourceAdditions(spec){
 const outer=existingApiPlanProofSourceAdditions(spec);if(outer.length)spec={...spec,sourceFiles:spec.sourceFiles.filter(file=>!outer.includes(file))};
 const delta=MATERIAL_REVIEW_CURRENT_REVISION.proofSourceDeltas?.find(row=>row.id===spec?.id);if(!delta)return outer;
 const files=spec.sourceFiles;
 reject(Array.isArray(files)&&new Set(files).size===files.length&&same(files,[...files].sort()),'Unique sorted material proof sources required');
 if(files.length===delta.currentCount&&sha(JSON.stringify(files))===delta.currentPathsSha256)return[...delta.additions,...outer];
 reject(files.length===delta.previousCount&&sha(JSON.stringify(files))===delta.previousPathsSha256,'Unknown material CI proof source set: '+delta.id);
 return outer;
}
export function materialReviewCurrentSourcePin(contract,ref){
 ref={...ref,sha256:existingApiPlanPreviousSourcePin(contract,ref)};
 const value=section(contract);if(!value)return existingApiPlanCurrentSourcePin(contract,ref);
 // This resolves a pin, not a proof. The source verifier and inverse authenticate
 // the complete predecessor once before accepting a source set.
 const change=[...value.reviewedSourceChanges,...value.validationDeltas].find(row=>row.path===ref.path);
 if(!change)return existingApiPlanCurrentSourcePin(contract,ref);
 reject(ref.sha256===change.previousSha256||ref.sha256===change.currentSha256,'Only the exact material review predecessor or current pin may be used: '+ref.path);
 return existingApiPlanCurrentSourcePin(contract,{...ref,sha256:change.currentSha256});
}
export function materialReviewValidationFiles(contract){
 const value=section(contract);if(!value)return[];
 restoreMaterialReviewPreviousContract(contract);
 return [...new Set([...existingApiPlanValidationFiles(contract),...value.reviewedSourceChanges.map(row=>row.path),...value.addedSources.map(row=>row.path),...value.validationDeltas.map(row=>row.path),...value.validationSources.map(row=>row.path)])].sort();
}
export function verifyMaterialReviewCurrentSources(contract,readSource){
 verifyExistingApiPlanCurrentSources(contract,readSource);
 const value=section(contract);if(!value)return null;
 restoreMaterialReviewPreviousContract(contract);reject(typeof readSource==='function','Actual current material review source reader required');
 const refs=[...value.reviewedSourceChanges,...value.validationDeltas].map(row=>({path:row.path,sha256:row.currentSha256,unchangedSurfaceSha256:row.unchangedSurfaceSha256})).concat(value.addedSources,value.validationSources);
 reject(new Set(refs.map(row=>row.path)).size===refs.length,'Unique material review source references required');
 for(const row of refs){
  reject(safe(row.path)&&hash(row.sha256),'Exact safe material review source pin required');
  const bytes=readSource(row.path);reject(Buffer.isBuffer(bytes),'Missing current material review source: '+row.path);
  const text=bytes.toString('utf8');reject(bytes.equals(Buffer.from(text))&&sha(text.replaceAll('\r\n','\n'))===existingApiPlanCurrentSourcePin(contract,row),'Stale current material review source: '+row.path);
  if(row.unchangedSurfaceSha256)reject(materialReviewUnchangedSurface(row.path,bytes)===row.unchangedSurfaceSha256,'Material review changed an inherited business surface: '+row.path);
 }
 return {version:1,previousContractSha256:value.previousContractSha256,completePreviousContractRestored:true,unchangedBusinessSurfaces:value.reviewedSourceChanges.filter(row=>row.unchangedSurfaceSha256).map(row=>row.path),historicalPinsPreserved:true,nativeOrBrowserAcceptance:false};
}
