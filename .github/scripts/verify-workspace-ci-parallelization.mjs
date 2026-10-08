import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,readdirSync,lstatSync,realpathSync,mkdtempSync,rmSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import yaml from 'js-yaml';
import {parseTap,TEST_SUITES,RECOVERY_CASES,EXPECTED_SUITE_COUNTS,EXPECTED_TOTAL_TESTS,sourceFiles as bankUnitSourceFiles} from '../../scripts/verify-participant-bank-intake-contracts.mjs';
import {TEST_FILE as PORTFOLIO_TEST_FILE,EXPECTED_TESTS as PORTFOLIO_TESTS,sourceFiles as portfolioUnitSourceFiles} from '../../scripts/verify-portfolio-overview-contracts.mjs';

export const EXPECTED_CONTRACT_SHA256='60e8df3b97d8d1f9ee60a408f9fb56367c8c8c0c7411d80ff0f05b8d24a0f262';
const BASELINE_BLOCKS_SHA256='97abbb70282f13efede473f08954e3a233cb77c76efe7178c0de981310c6f8bd';
const BASELINE_OWNERSHIP_SHA256='26c7acdbb7d3a5eb6e75355c3c4af715c8f07ce27b12248d6028160c76fa77a4';
const BASELINE_PRODUCERS_SHA256='07d0016608332c0775f86bee6d005e60d4686d2ffe33a3065dfd9fd8e974ab20';
const PREPARATION_BASELINE_BLOCKS_SHA256='8faaf5e69185f49da4c797d21613c7a34705be074fa3890398be37a8559ca409';
const PREPARATION_BASELINE_OWNERSHIP_SHA256='d98be6976ef7772633f5e8697fef3786855199e60dd0d522dc392b01097d602f';
const PREPARATION_BASELINE_PRODUCERS_SHA256='a314f2640330bd4bc0615e0b13a7393dc8f8e8d94d4cdb74a728a1785d31a9c8';
const PREPARATION_ARTIFACTS=['.vercel/private/project-preparation-postgres-validation.json','.vercel/private/project-preparation-ui-*.json','.vercel/private/project-preparation-ui-*.png'];
const PREPARATION_MODES=['save','recover','reload','cancel','conflict','denied'];
const PORTFOLIO_BASELINE_BLOCKS_SHA256='fdb9d500f6e96981887bc1f7e74d55875c870239c198296466d4a362f63d68d7';
const PORTFOLIO_BASELINE_OWNERSHIP_SHA256='81608969b6edbf08690ea31011d6c526f65bfae91468933e496f0cc52be5fab4';
const PORTFOLIO_BASELINE_PRODUCERS_SHA256='f727810f0b923c95623fab858aa72da8ecccb21edded6278b972872aeb7a411e';
const PORTFOLIO_BLOCK_DIGEST='87166cb8289ff7e7380bdb6b1954746b65c26a1955d4b3985f312c7fdeccf8f0';
const PORTFOLIO_ARTIFACTS=['.vercel/portfolio-overview-contract-evidence/','.vercel/private/portfolio-overview-ui-validation.json','.vercel/private/portfolio-*.png'];
const PORTFOLIO_MODES=['success','pagination','503','401','403','409','503-html','401-html','403-html','409-html','invalid-json','wrong-scope','wrong-role','stale','unmount','locked','dark'];
const IDENTITY_ARTIFACTS=['.vercel/workspace-identity-only-evidence/'];
const IDENTITY_BASELINE_BLOCKS_SHA256='1ec5faa63519324e8b21611559622161522e5c05d37dfb63bd3065c4bdb5c4f9';
const IDENTITY_BASELINE_OWNERSHIP_SHA256='78694a31aa081eaa44e2680a7b84512b9fc00a348fa4e57e01afdc7946be150f';
const IDENTITY_BASELINE_PRODUCERS_SHA256='c84dfb43d147837ae604682617817be2b0463fc7178b2fac340a845acc21b516';
const IDENTITY_BLOCK_DIGEST='238695242b62319edb2feb2ff7b8e8dbf59c844292784e11cdbb18c70cd5d5b8';
const PREPARATION_PG_BASELINE_PRODUCER={"producer":"scripts/verify-project-preparation-postgres.mjs","path":".vercel/private/project-preparation-postgres-validation.json","retained":true,"blockId":58,"lane":"business","sourceLine":73,"producerSha256":"f9cb6908a4062fbfaed2eba92e6e46b6cfe5672d9466a69d650468e85d461294","sourceBasis":"EXPECTED_HEAD_GIT_BYTES"};
const COMPANY_KYC_PG_BASELINE_PRODUCER={"producer":"scripts/verify-company-channel-kyc-postgres.mjs","path":".vercel/company-kyc-evidence/postgres.json","retained":true,"blockId":57,"lane":"people","sourceLine":139,"producerSha256":"ca2aa4d683d9e2aa61557497354bb772fba96b0b9ba496262da73ccbb473ffd5","sourceBasis":"EXPECTED_HEAD_GIT_BYTES"};
const identityDependenciesFor=kind=>['UNIT','UI_BANK','UI_JOINT','UI_CAUSAL','PG_COMPANY_KYC'].includes(kind)?['src/lib/participant-admission.mjs']:[];
const isIdentity=spec=>spec.kind==='UI_IDENTITY_ONLY';
const isCanonicalField=spec=>['PG_FIELD','PG_OVERTIME'].includes(spec.kind);
const FIELD_PG_BASELINE_PRODUCER={producer:'scripts/verify-field-operations-postgres.mjs',path:'.vercel/field-operations-evidence/postgres.json',retained:true,blockId:20,lane:'field',baselineSourceLine:216,baselineProducerGitBlobSha256:'b91778574d63bc9dffb83af1b5aeb7a2666e7fb23e0d923ea79b435de7b265d8'};
const OVERTIME_PG_BASELINE_PRODUCER={producer:'scripts/verify-field-overtime-postgres.mjs',path:'.vercel/private/field-overtime-postgres-proof.json',retained:true,blockId:52,lane:'field',baselineSourceLine:127,baselineProducerGitBlobSha256:'bd3c8a27cb9f5af6556fe25e35cb3b32f78eb7e600851fbdb6490ed9d232042b'};
const FIELD_CHECK_GROUPS=[['checks','checkCount',19],['reviewPaginationChecks','reviewPaginationCheckCount',26],['voiceProgressChecks','voiceProgressCheckCount',4],['mediaLeaseChecks','mediaLeaseCheckCount',6],['videoAudioChecks','videoAudioCheckCount',8],['canonicalOwnFieldChecks','canonicalOwnFieldCheckCount',3]];
const FIELD_CANONICAL_CHECKS=['administrator-own-post-replay-read-only-receipt-and-media-review-decision-corrupt-denied-with-zero-database-or-private-provider-effects','administrator-own-post-replay-read-only-receipt-and-media-submission-content-digest-corrupt-denied-with-zero-database-or-private-provider-effects','administrator-own-complete-independent-kyc-admits-field-save-and-exact-read-only-recovery-with-no-repeat-effects'];
const IDENTITY_ONLY_CHECK_COUNT=103;
const identityPrivacyChecks=width=>[
 {
  "name": "own-private-withdrawal-without-KYC-admission",
  "status": "PENDING_REVIEW",
  "action": "REVOKE_TEMPLATE_MESSAGES",
  "reload": false,
  "posts": 1,
  "receiptGets": 0
 },
 {
  "name": "own-private-withdrawal-without-KYC-admission",
  "status": "PENDING_REVIEW",
  "action": "UNLINK",
  "reload": false,
  "posts": 1,
  "receiptGets": 0
 },
 {
  "name": "own-private-withdrawal-without-KYC-admission",
  "status": "REJECTED",
  "action": "REVOKE_TEMPLATE_MESSAGES",
  "reload": false,
  "posts": 1,
  "receiptGets": 0
 },
 {
  "name": "own-private-withdrawal-without-KYC-admission",
  "status": "REJECTED",
  "action": "UNLINK",
  "reload": false,
  "posts": 1,
  "receiptGets": 0
 },
 {
  "name": "own-withdrawal-lost-response-reload-recovers-same-UUID-without-second-POST",
  "status": "PENDING_REVIEW",
  "action": "REVOKE_TEMPLATE_MESSAGES",
  "reload": true,
  "posts": 1,
  "receiptGets": 1,
  "sameOperationId": true,
  "durableReference": true
 },
 {
  "name": "own-withdrawal-lost-response-reload-recovers-same-UUID-without-second-POST",
  "status": "REJECTED",
  "action": "UNLINK",
  "reload": true,
  "posts": 1,
  "receiptGets": 1,
  "sameOperationId": true,
  "durableReference": true
 },
 {
  "name": "late-approved-channel-DTO-never-exposes-codes-grant-chat-or-workspace"
 },
 {
  "name": "late-channel-read-cannot-cross-project"
 },
 {
  "name": "late-channel-read-cannot-cross-account"
 },
 {
  "name": "withdrawal-held-token-cancels-before-POST-on-account-change"
 },
 {
  "name": "dispatched-withdrawal-account-change-keeps-durable-receipt-without-rePOST"
 },
 {
  "name": "revoked-private-channel-assignment-or-membership-hides-current-records",
  "status": 403,
  "code": "WORKSPACE_PROJECT_UNAVAILABLE"
 },
 {
  "name": "revoked-private-channel-assignment-or-membership-hides-current-records",
  "status": 403,
  "code": "WORKSPACE_MEMBERSHIP_REQUIRED"
 },
 {
  "name": "revoked-private-channel-assignment-or-membership-hides-current-records",
  "status": 404,
  "code": "WORKSPACE_PROJECT_UNAVAILABLE"
 },
 {
  "name": "canonical-project-404-after-withdrawal-dispatch-keeps-UUID-and-receipt-reference",
  "sameOperationId": true,
  "durableReference": true,
  "receiptGets": 1
 },
 {
  "name": "canonical-reference-GET-404-hides-loaded-record-and-retains-original-cross-tab-UUID",
  "sameOperationId": true,
  "durableReference": true,
  "posts": 1,
  "receiptGets": 2
 },
 {
  "name": "own-APPROVED-requires-explicit-fresh-canonical-project-check-before-workspace"
 }
].map(row=>({...row,width}));
const identityScreenshotNames=[...[320,390,768,1280].flatMap(width=>[
 'identity-private-'+width+'.png','identity-approved-'+width+'.png',
 ...['PENDING_REVIEW','REJECTED'].flatMap(status=>['REVOKE_TEMPLATE_MESSAGES','UNLINK'].map(action=>'privacy-'+status+'-'+action+'-'+width+'.png')),
 ...['REVOKE_TEMPLATE_MESSAGES','UNLINK'].map(action=>'privacy-'+(action==='UNLINK'?'REJECTED':'PENDING_REVIEW')+'-'+action+'-'+width+'-reload.png')
]),'identity-private-390-reload.png','identity-approved-390-reload.png','identity-private-390-director.png','identity-approved-390-director.png'];
export const IDENTITY_ONLY_CHECKS=[
 ...[320,390,768,1280].flatMap(width=>[
  {name:'private-identity-submission-uncertain-receipt-and-explicit-approval-refresh',width,reload:false,director:false,posts:1,receiptGets:1},
  {name:'noncanonical-denial-cannot-open-private-or-operative-ui',width,status:403,code:'WORKSPACE_PROJECT_UNAVAILABLE',type:'application/json'},
  {name:'noncanonical-denial-cannot-open-private-or-operative-ui',width,status:403,code:'WORKSPACE_PROJECT_UNAVAILABLE',type:'text/html'},
  {name:'revoked-workspace-hides-loaded-tasks-and-only-own-private-read-remains',width,ownDenied:false},
  {name:'late-prior-project-denial-cannot-replace-authorized-project',width},
  {name:'late-prior-company-response-cannot-restore-private-context',width},
  {name:'token-held-prior-company-never-dispatches-after-context-change',width},
  ...identityPrivacyChecks(width)
 ]),
 {name:'private-identity-submission-uncertain-receipt-and-explicit-approval-refresh',width:390,reload:true,director:false,posts:1,receiptGets:1},
 {name:'private-identity-submission-uncertain-receipt-and-explicit-approval-refresh',width:390,reload:false,director:true,posts:1,receiptGets:1},
 {name:'revoked-workspace-hides-loaded-tasks-and-only-own-private-read-remains',width:390,ownDenied:true},
 {name:'bootstrap-administrator-without-worker-keeps-server-authorized-operation',width:390},
 ...[401,409,500].map(status=>({name:'noncanonical-denial-cannot-open-private-or-operative-ui',width:390,status,code:'PARTICIPANT_KYC_REVIEW_REQUIRED',type:'application/json'}))
];
const PORTFOLIO_PG_BASELINE_PRODUCER={producer:'scripts/verify-workspace-postgres.mjs',path:'.vercel/workspace-evidence/postgres.json',retained:true,blockId:10,lane:'workspace-ui',baselineSourceLine:134,baselineProducerGitBlobSha256:'c49525d41783f2258ea6cbf33ef3d7561f2219d703d52aebe4f860f397e97a2f'};
const isPortfolio=spec=>['PORTFOLIO_UNIT','UI_PORTFOLIO','PG_PORTFOLIO'].includes(spec.kind);
const isPortfolioEvidence=filename=>PORTFOLIO_ARTIFACTS.some(pattern=>matches(filename,pattern));
const preparationDependenciesFor=kind=>['UNIT','UI_BANK','UI_JOINT','UI_CAUSAL','PG_COMPANY_KYC'].includes(kind)?['src/lib/participant-kyc-image-set.mjs',...(kind==='PG_COMPANY_KYC'?['src/lib/project-preparation-http.mjs','src/lib/project-preparation-policy.mjs','src/lib/project-preparation-store.mjs']:[])]:[];
const planImportDependenciesFor=kind=>kind==='PG_COMPANY_KYC'?['src/lib/plan-import-ooxml.mjs']:[];
export const LANES=['contracts','plans','people','field','meta','channels','business','workspace-ui'];
// Keep each serialized lane below Linux's 128 KiB per-environment-string limit.
// Leave room for the environment key and GitHub's outer JSON formatting while
// retaining every screenshot, source digest and proof binding in the artifact.
const LANE_ENV_BYTES=96*1024;
const LANE_OUTPUT_BYTES=92*1024;
const laneEnvironmentKey=lane=>'WORKSPACE_LANE_'+lane.toUpperCase().replaceAll('-','_')+'_JSON';
const script='.github/scripts/verify-workspace-ci-parallelization.mjs';
const contractPath='.github/workspace-acceptance-contract.json';
const workflowPath='.github/workflows/workspace-acceptance.yml';
const hash=value=>createHash('sha256').update(value).digest('hex');
const canonical=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
const clone=value=>structuredClone(value);
const deny=code=>{throw Object.assign(new Error(code),{code});};
const equal=(actual,expected,code)=>{if(canonical(actual)!==canonical(expected))deny(code);};
const exactKeys=(value,keys,code)=>{if(!value||typeof value!=='object'||Array.isArray(value))deny(code);equal(Object.keys(value).sort(),[...keys].sort(),code);};
const sha=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const head=value=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value);
const positive=value=>typeof value==='string'&&/^[1-9][0-9]*$/.test(value);

const EXTENSION_PROOFS=[
 ['bank-intake-units','contracts',53,'.vercel/participant-bank-intake-contract-evidence/proof.json','UNIT'],
 ['bank-postgres','people',54,'.vercel/private-bank-evidence/postgres.json','PG_BANK'],
 ['intake-postgres','people',54,'.vercel/private/employee-intake-postgres.json','PG_INTAKE'],
 ['bank-ui','people',55,'.vercel/private-bank-evidence/proof.json','UI_BANK'],
 ['intake-ui','people',55,'.vercel/private/employee-intake-ui/browser.json','UI_INTAKE'],
 ['joint-ui','people',56,'.vercel/private/participant-bank-intake-integration/current/browser.json','UI_JOINT'],
 ['joint-causal','people',56,'.vercel/private/participant-bank-intake-integration/bad-resolution/browser.json','UI_CAUSAL'],
 ['company-kyc-postgres','people',57,'.vercel/company-kyc-evidence/postgres.json','PG_COMPANY_KYC'],
 ['project-preparation-postgres','business',58,'.vercel/private/project-preparation-postgres-validation.json','PG_PREPARATION'],
 ['project-preparation-ui','business',58,'.vercel/private/project-preparation-ui-validation.json','UI_PREPARATION'],
 ['portfolio-units','workspace-ui',59,'.vercel/portfolio-overview-contract-evidence/proof.json','PORTFOLIO_UNIT'],
 ['portfolio-ui','workspace-ui',59,'.vercel/private/portfolio-overview-ui-validation.json','UI_PORTFOLIO'],
 ['portfolio-postgres','workspace-ui',10,'.vercel/workspace-evidence/postgres.json','PG_PORTFOLIO'],
 ['identity-only-ui','workspace-ui',60,'.vercel/workspace-identity-only-evidence/browser.json','UI_IDENTITY_ONLY'],
 ['field-canonical-postgres','field',20,'.vercel/field-operations-evidence/postgres.json','PG_FIELD'],
 ['overtime-canonical-postgres','field',52,'.vercel/private/field-overtime-postgres-proof.json','PG_OVERTIME']
];
function sourcePath(value){if(typeof value!=='string'||value.length>500||/[\\\x00-\x1f]/.test(value)||value.startsWith('/')||value.split('/').some(part=>!part||part==='.'||part==='..'))deny('UNSAFE_SOURCE_PATH');return value;}
function gitSource(root,expectedHead){if(!head(expectedHead))deny('EXPECTED_HEAD_INVALID');const cache=new Map();return filename=>{sourcePath(filename);if(!cache.has(filename))cache.set(filename,execFileSync('git',['show',expectedHead+':'+filename],{cwd:root,maxBuffer:8*1024*1024}));return cache.get(filename);};}
function manifestDigest(references){return hash(canonical([...references].sort((a,b)=>a.path.localeCompare(b.path))));}
function expectedSourceDigest(spec,readSource){if(typeof readSource!=='function')deny('PROOF_SOURCE_RESOLVER');return manifestDigest(spec.sourceFiles.map(file=>{const bytes=readSource(file);if(!Buffer.isBuffer(bytes))deny('PROOF_SOURCE_BYTES');return {path:file,sha256:hash(bytes)};}));}
const utf8=bytes=>{if(!Buffer.isBuffer(bytes))deny('PROOF_BYTES');const text=bytes.toString('utf8');if(!bytes.equals(Buffer.from(text)))deny('PROOF_ENCODING');return text;};
function matrix(rows,widths,modes){if(!Array.isArray(rows))deny('PROOF_MATRIX');const keys=rows.map(row=>row&&row.width+':'+row.mode);equal(keys.toSorted(),widths.flatMap(width=>modes.map(mode=>width+':'+mode)).toSorted(),'PROOF_MATRIX');}
function summary(spec){return isCanonicalField(spec)?spec.checkNames.length:isIdentity(spec)?IDENTITY_ONLY_CHECK_COUNT:spec.kind==='PORTFOLIO_UNIT'?PORTFOLIO_TESTS:spec.kind==='UI_PORTFOLIO'?4*PORTFOLIO_MODES.length:spec.kind==='PG_PORTFOLIO'?spec.checkNames.length:spec.kind==='PG_PREPARATION'?spec.checkNames.length:spec.kind==='UI_PREPARATION'?4*PREPARATION_MODES.length:spec.kind==='UNIT'?{suites:7,tests:EXPECTED_TOTAL_TESTS,recovery:7,corporateKyc:EXPECTED_SUITE_COUNTS['tests/production-company-channel-kyc.test.mjs'],nextSteps:EXPECTED_SUITE_COUNTS['tests/production-participant-onboarding-next-step.test.mjs']}:spec.kind==='PG_COMPANY_KYC'?spec.checkNames.length:spec.kind==='UI_CAUSAL'?0:spec.kind==='UI_JOINT'?8:spec.kind.startsWith('UI_')?32:spec.kind==='PG_BANK'?10:8;}
function validateExtension(contract){
 const extension=contract.extension;exactKeys(extension,['baseHead','baselineBlocksSha256','baselineOwnershipSha256','baselineProducersSha256','proofs'],'EXTENSION_SHAPE');
 if(extension.baseHead!=='a4b79d7a7f75427ed1d0b0e1e9b247e1188adf3f')deny('EXTENSION_BASE');
 equal(extension.proofs.map(p=>[p.id,p.lane,p.blockId,p.path,p.kind]),EXTENSION_PROOFS,'EXTENSION_PROOF_COVERAGE');
 for(const spec of extension.proofs){exactKeys(spec,['id','lane','blockId','path','kind','producer','producerSha256','sourceFiles','checkNames'],'EXTENSION_PROOF_SHAPE');if(!sha(spec.producerSha256)||!Array.isArray(spec.sourceFiles)||!spec.sourceFiles.length||new Set(spec.sourceFiles).size!==spec.sourceFiles.length)deny('EXTENSION_SOURCE_CONTRACT');spec.sourceFiles.forEach(sourcePath);sourcePath(spec.producer);if(!Array.isArray(spec.checkNames))deny('EXTENSION_CHECK_NAMES');}
 for(const spec of extension.proofs){const record=contract.evidenceProducers.find(p=>p.path===spec.path);if(spec.kind==='PG_FIELD'||spec.kind==='PG_OVERTIME'){equal(record,spec.kind==='PG_FIELD'?FIELD_PG_BASELINE_PRODUCER:OVERTIME_PG_BASELINE_PRODUCER,'EXTENSION_PRODUCER_CONTRACT');continue;}if(spec.kind==='PG_PORTFOLIO'){equal(record,PORTFOLIO_PG_BASELINE_PRODUCER,'EXTENSION_PRODUCER_CONTRACT');continue;}if(spec.kind==='PG_PREPARATION'){equal(record,PREPARATION_PG_BASELINE_PRODUCER,'EXTENSION_PRODUCER_CONTRACT');continue;}if(spec.kind==='PG_COMPANY_KYC'){equal(record,COMPANY_KYC_PG_BASELINE_PRODUCER,'EXTENSION_PRODUCER_CONTRACT');continue;}equal(record&&{producer:record.producer,path:record.path,retained:record.retained,blockId:record.blockId,lane:record.lane,producerSha256:record.producerSha256,sourceBasis:record.sourceBasis},{producer:spec.producer,path:spec.path,retained:true,blockId:spec.blockId,lane:spec.lane,producerSha256:spec.producerSha256,sourceBasis:'EXPECTED_HEAD_GIT_BYTES'},'EXTENSION_PRODUCER_CONTRACT');}
 if(hash(canonical(contract.blocks.slice(0,46)))!==extension.baselineBlocksSha256||extension.baselineBlocksSha256!==BASELINE_BLOCKS_SHA256)deny('BASELINE_BLOCKS_CHANGED');
 const newPatterns=new Set([...PREPARATION_ARTIFACTS,...PORTFOLIO_ARTIFACTS,...extension.proofs.filter(spec=>spec.kind!=='PG_PORTFOLIO'&&!isCanonicalField(spec)).flatMap(spec=>contract.lanes[spec.lane].artifacts.filter(pattern=>matches(spec.path,pattern)))]);
 const ownership=Object.fromEntries(LANES.map(lane=>[lane,{blocks:contract.lanes[lane].blocks.filter(id=>id<=52),artifacts:contract.lanes[lane].artifacts.filter(pattern=>!newPatterns.has(pattern))}]));
 if(hash(canonical(ownership))!==extension.baselineOwnershipSha256||extension.baselineOwnershipSha256!==BASELINE_OWNERSHIP_SHA256)deny('BASELINE_OWNERSHIP_CHANGED');
 if(hash(canonical(contract.evidenceProducers.filter(p=>p.blockId<=52)))!==extension.baselineProducersSha256||extension.baselineProducersSha256!==BASELINE_PRODUCERS_SHA256)deny('BASELINE_PRODUCERS_CHANGED');
 if(hash(canonical(contract.blocks.slice(0,51)))!==PREPARATION_BASELINE_BLOCKS_SHA256)deny('PREPARATION_BASELINE_BLOCKS_CHANGED');
 const previousOwnership=Object.fromEntries(LANES.map(lane=>[lane,{blocks:contract.lanes[lane].blocks.filter(id=>id<=57),artifacts:contract.lanes[lane].artifacts.filter(pattern=>!PREPARATION_ARTIFACTS.includes(pattern)&&!PORTFOLIO_ARTIFACTS.includes(pattern)&&!IDENTITY_ARTIFACTS.includes(pattern))}]));
 if(hash(canonical(previousOwnership))!==PREPARATION_BASELINE_OWNERSHIP_SHA256)deny('PREPARATION_BASELINE_OWNERSHIP_CHANGED');
 if(hash(canonical(contract.evidenceProducers.filter(p=>p.blockId<=57)))!==PREPARATION_BASELINE_PRODUCERS_SHA256)deny('PREPARATION_BASELINE_PRODUCERS_CHANGED');
 if(hash(canonical(contract.blocks.slice(0,52)))!==PORTFOLIO_BASELINE_BLOCKS_SHA256)deny('PORTFOLIO_BASELINE_BLOCKS_CHANGED');
 const portfolioPreviousOwnership=Object.fromEntries(LANES.map(lane=>[lane,{blocks:contract.lanes[lane].blocks.filter(id=>id<=58),artifacts:contract.lanes[lane].artifacts.filter(pattern=>!PORTFOLIO_ARTIFACTS.includes(pattern)&&!IDENTITY_ARTIFACTS.includes(pattern))}]));
 if(hash(canonical(portfolioPreviousOwnership))!==PORTFOLIO_BASELINE_OWNERSHIP_SHA256)deny('PORTFOLIO_BASELINE_OWNERSHIP_CHANGED');
 if(hash(canonical(contract.evidenceProducers.filter(p=>p.blockId<=58)))!==PORTFOLIO_BASELINE_PRODUCERS_SHA256)deny('PORTFOLIO_BASELINE_PRODUCERS_CHANGED');
 if(contract.blocks.find(block=>block.id===59).commandSha256!==PORTFOLIO_BLOCK_DIGEST)deny('PORTFOLIO_BLOCK_COMMAND');
 if(hash(canonical(contract.blocks.slice(0,53)))!==IDENTITY_BASELINE_BLOCKS_SHA256)deny('IDENTITY_BASELINE_BLOCKS_CHANGED');
 const identityPreviousOwnership=Object.fromEntries(LANES.map(lane=>[lane,{blocks:contract.lanes[lane].blocks.filter(id=>id<=59),artifacts:contract.lanes[lane].artifacts.filter(pattern=>!IDENTITY_ARTIFACTS.includes(pattern))}]));
 if(hash(canonical(identityPreviousOwnership))!==IDENTITY_BASELINE_OWNERSHIP_SHA256)deny('IDENTITY_BASELINE_OWNERSHIP_CHANGED');
 if(hash(canonical(contract.evidenceProducers.filter(p=>p.blockId<=59)))!==IDENTITY_BASELINE_PRODUCERS_SHA256)deny('IDENTITY_BASELINE_PRODUCERS_CHANGED');
 if(contract.blocks.find(block=>block.id===60).commandSha256!==IDENTITY_BLOCK_DIGEST)deny('IDENTITY_BLOCK_COMMAND');
 equal(extension.proofs.find(isIdentity).checkNames,IDENTITY_ONLY_CHECKS.map(canonical),'EXTENSION_CHECK_NAMES');
 const field=extension.proofs.find(spec=>spec.kind==='PG_FIELD'),overtime=extension.proofs.find(spec=>spec.kind==='PG_OVERTIME');if(field.checkNames.length!==66||overtime.checkNames.length!==29)deny('EXTENSION_CHECK_NAMES');
 equal(field.checkNames.slice(-3),FIELD_CANONICAL_CHECKS.map(name=>canonical({group:'canonicalOwnFieldChecks',name})),'EXTENSION_CHECK_NAMES');
}
function canonicalFieldSourceSets(spec,readSource){
 const text=utf8(readSource(spec.producer));
 const array=name=>{const rows=[...text.matchAll(new RegExp('\\b'+name+'=\\[([^\\]]+)\\]','g'))];if(rows.length!==1)deny('PROOF_FIELD_SOURCE_ROOTS');const body=rows[0][1],files=[...body.matchAll(/['"]([^'"]+)['"]/g)].map(match=>sourcePath(match[1]));if(!files.length||body.replace(/['"][^'"]+['"]/g,'').replace(/[\s,]/g,''))deny('PROOF_FIELD_SOURCE_ROOTS');return files;};
 const found=new Set(),visit=file=>{if(found.has(file))return;sourcePath(file);found.add(file);for(const match of utf8(readSource(file)).matchAll(/(?:import|export)\s[^;]*?from\s*['"](\.[^'"]+)['"]/g))visit(path.posix.normalize(path.posix.join(path.posix.dirname(file),match[1])));};
 visit('scripts/fixtures/canonical-participant-kyc.mjs');const fixture=[...found].sort(),withFixture=name=>[...new Set([...array(name),...fixture])].sort();
 return spec.kind==='PG_OVERTIME'?{sourceManifest:withFixture('sourceFiles')}:{sourceSha256:withFixture('sourceFiles'),voiceProgressSourceSha256:withFixture('voiceProgressSourceFiles'),mediaLeaseSourceSha256:withFixture('mediaLeaseSourceFiles'),videoAudioSourceSha256:withFixture('videoAudioSourceFiles'),fixture};
}
function canonicalFieldManifest(spec,proof){
 if(spec.kind==='PG_OVERTIME'){if(!Array.isArray(proof.sourceManifest))deny('PROOF_SOURCE_MANIFEST');return proof.sourceManifest.map(ref=>{exactKeys(ref,['file','sha256'],'PROOF_SOURCE_REFERENCE');return {path:ref.file,sha256:ref.sha256};});}
 if(Object.hasOwn(proof,'sourceManifest'))deny('PROOF_FIELD_SOURCE_MAP');const references=new Map();
 for(const map of [proof.sourceSha256,proof.voiceProgressSourceSha256,proof.mediaLeaseSourceSha256,proof.videoAudioSourceSha256,proof.participantKycFixture?.sourceSha256]){if(!map||typeof map!=='object'||Array.isArray(map)||!Object.keys(map).length)deny('PROOF_FIELD_SOURCE_MAP');for(const [file,digest] of Object.entries(map)){sourcePath(file);if(!sha(digest)||references.has(file)&&references.get(file)!==digest)deny('PROOF_FIELD_SOURCE_MAP');references.set(file,digest);}}
 return [...references].map(([path,sha256])=>({path,sha256}));
}
function validateCanonicalFieldProof(spec,proof,readSource){
 const fixture=proof.participantKycFixture;exactKeys(fixture,spec.kind==='PG_FIELD'?['sourceSha256','records','syntheticPrivateCalls','providerCalls','biometricIdentityCertified']:['records','syntheticPrivateCalls','providerCalls','biometricIdentityCertified'],'PROOF_FIELD_KYC_FIXTURE');
 if(fixture.providerCalls!==0||fixture.biometricIdentityCertified!==false||proof.providerCalls!==0)deny('PROOF_PROVIDER_IO');
 if(!Array.isArray(fixture.records)||!fixture.records.length)deny('PROOF_FIELD_KYC_FIXTURE');exactKeys(fixture.syntheticPrivateCalls,['privatePuts','privateReads'],'PROOF_FIELD_KYC_FIXTURE');
 if(fixture.syntheticPrivateCalls.privatePuts!==fixture.records.length*2||fixture.syntheticPrivateCalls.privateReads!==fixture.records.length*6)deny('PROOF_FIELD_KYC_FIXTURE');
 for(const record of fixture.records){exactKeys(record,['projectId','workerId','submissionId','submissionReceiptId','reviewReceiptId','actorId','reviewerActorId','contentHash','canonicalAdmissionConfirmed','identityCertified','providerCalls'],'PROOF_FIELD_KYC_FIXTURE');if(record.canonicalAdmissionConfirmed!==true||record.identityCertified!==false||record.providerCalls!==0||!sha(record.contentHash)||typeof record.actorId!=='string'||typeof record.reviewerActorId!=='string'||!record.actorId||!record.reviewerActorId||record.actorId===record.reviewerActorId||!/^participant_[a-f0-9]{64}$/.test(record.submissionReceiptId)||!/^participant_[a-f0-9]{64}$/.test(record.reviewReceiptId))deny('PROOF_FIELD_KYC_FIXTURE');}
 const sets=canonicalFieldSourceSets(spec,readSource);
 if(spec.kind==='PG_OVERTIME'){
  if(proof.environment!=='disposable-random-schema-on-approved-local-postgres'||!/^obrasaas_overtime_[a-f0-9]{32}$/.test(proof.schema)||proof.disposableSchemaRemoved!==true)deny('PROOF_CLEANUP');
  if(proof.newOvertimeEnum!==false||proof.paymentEngineUsed!==false||proof.humanAccepted!==false)deny('PROOF_PROVIDER_IO');equal(proof.sqlFailures,[],'PROOF_SQL_ERRORS');equal(proof.checks,spec.checkNames,'PROOF_CHECK_NAMES');equal(proof.sourceManifest.map(ref=>ref.path).toSorted(),sets.sourceManifest,'PROOF_SOURCE_MANIFEST');
 }else{
  if(typeof proof.databaseEngineVersion!=='string'||proof.environment!=='disposable-local-postgresql'+proof.databaseEngineVersion.split('.')[0]||proof.databaseRemoved!==true)deny('PROOF_CLEANUP');
  for(const key of ['reviewPaginationProviderCalls','voiceProgressProviderCalls','mediaLeaseProviderCalls','videoAudioProviderCalls'])if(proof[key]!==0)deny('PROOF_PROVIDER_IO');
  if(proof.physicalAttendanceAccepted!==false||proof.whatsAppTested!==false||proof.videoAudioFfmpegExecuted!==false)deny('PROOF_PROVIDER_IO');
  for(const [group,countKey,count] of FIELD_CHECK_GROUPS){if(!Array.isArray(proof[group])||proof[group].length!==count||proof[countKey]!==count)deny('PROOF_CHECK_NAMES');}
  equal(FIELD_CHECK_GROUPS.flatMap(([group])=>proof[group].map(name=>canonical({group,name}))),spec.checkNames,'PROOF_CHECK_NAMES');equal(proof.canonicalOwnFieldChecks,FIELD_CANONICAL_CHECKS,'PROOF_CHECK_NAMES');if(proof.totalChecks!==66)deny('PROOF_CHECK_NAMES');
  for(const [key,files] of Object.entries(sets)){const map=key==='fixture'?fixture.sourceSha256:proof[key];equal(Object.keys(map).toSorted(),files,'PROOF_FIELD_SOURCE_MAP');}
 }
}
function validateIdentityProof(spec,proof,expectedHead){
 exactKeys(proof,['status','environment','sourceRevision','sourceState','trackedClean','dirtyTrackedPaths','widths','totalCheckCount','checks','sourceManifest','harnessSha256','pageErrors','requestErrors','screenshots','actualPageReloadTested','nativeIndexedDbReceiptReferencesTested','automaticRecoveryPostCount','postgresExecuted','realClerkLogin','realEmailDelivery','productionDataWritten','realProviderCalls','physicalWhatsAppVerified','fixtureRemoved','browserClosed','serverStopped'],'PROOF_IDENTITY_SHAPE');
 if(proof.sourceRevision!==expectedHead||proof.sourceState!=='EXACT_CI_SOURCE'||proof.trackedClean!==true)deny('PROOF_SOURCE_STATE');equal(proof.dirtyTrackedPaths,[],'PROOF_SOURCE_STATE');
 if(proof.environment!=='isolated-browser-real-components-with-controlled-session-and-http')deny('PROOF_IDENTITY_ENVIRONMENT');
 if(proof.realProviderCalls!==0||proof.postgresExecuted!==false||proof.realClerkLogin!==false||proof.realEmailDelivery!==false||proof.physicalWhatsAppVerified!==false)deny('PROOF_PROVIDER_IO');
 if(proof.fixtureRemoved!==true||proof.browserClosed!==true||proof.serverStopped!==true)deny('PROOF_CLEANUP');
 equal(proof.pageErrors,[],'PROOF_UI_ERRORS');equal(proof.requestErrors,[],'PROOF_UI_ERRORS');
 equal(proof.widths,[320,390,768,1280],'PROOF_MATRIX');if(proof.totalCheckCount!==IDENTITY_ONLY_CHECK_COUNT)deny('PROOF_MATRIX');equal(proof.checks,IDENTITY_ONLY_CHECKS,'PROOF_IDENTITY_CHECKS');equal(proof.checks.map(canonical),spec.checkNames,'PROOF_IDENTITY_CHECKS');
 if(proof.actualPageReloadTested!==true||proof.nativeIndexedDbReceiptReferencesTested!==true||proof.automaticRecoveryPostCount!==0)deny('PROOF_IDENTITY_RECOVERY');
 equal(proof.screenshots,identityScreenshotNames.map(name=>IDENTITY_ARTIFACTS[0]+name),'PROOF_IDENTITY_SCREENSHOTS');
}
function validatePortfolioProof(spec,proof,{expectedHead,readEvidence}){
 if(proof.sourceRevision!==expectedHead)deny('PROOF_SOURCE_STATE');
 if(proof.providerCalls!==0)deny('PROOF_PROVIDER_IO');
 if(spec.kind==='PORTFOLIO_UNIT'){
  if(proof.sourceState!=='committed exact Git HEAD'||proof.trackedClean!==true||proof.postgresExecuted!==false)deny('PROOF_SOURCE_STATE');
  const suite=proof.suite;exactKeys(suite,['file','exitCode','tests','pass','fail','cancelled','skipped','todo','caseNames','tap'],'PROOF_UNIT_SUITE_SHAPE');exactKeys(suite.tap,['path','bytes','sha256'],'PROOF_UNIT_TAP_SHAPE');
  if(suite.file!==PORTFOLIO_TEST_FILE||suite.exitCode!==0||suite.tap.path!=='.vercel/portfolio-overview-contract-evidence/suite.tap')deny('PROOF_UNIT_EXECUTION');
  if(typeof readEvidence!=='function')deny('PROOF_TAP_RESOLVER');const tap=readEvidence(suite.tap.path);if(!Buffer.isBuffer(tap)||tap.length!==suite.tap.bytes||hash(tap)!==suite.tap.sha256)deny('PROOF_TAP_DIGEST');
  let parsed;try{parsed=parseTap(tap,{expectedTests:PORTFOLIO_TESTS});}catch{deny('PROOF_UNIT_RESULTS');}equal(parsed,Object.fromEntries(['tests','pass','fail','cancelled','skipped','todo','caseNames'].map(k=>[k,suite[k]])),'PROOF_UNIT_RESULTS');
 }else if(spec.kind==='UI_PORTFOLIO'){
  if(proof.fixtureRemoved!==true)deny('PROOF_CLEANUP');equal(proof.errors,[],'PROOF_UI_ERRORS');equal(proof.widths,[320,390,768,1280],'PROOF_MATRIX');matrix(proof.checks,proof.widths,PORTFOLIO_MODES);
  if(proof.checks.some(c=>c.providerCalls!==0||c.mutations!==0||c.horizontalOverflow!==false||c.reads!==(['pagination','503','401','403','409','503-html','401-html','403-html','409-html','invalid-json'].includes(c.mode)?2:1)))deny('PROOF_PORTFOLIO_GUARDS');
 }else{
  if(proof.sourceState!=='EXACT_CI_SOURCE'||proof.trackedClean!==true)deny('PROOF_SOURCE_STATE');equal(proof.dirtyTrackedPaths,[],'PROOF_SOURCE_STATE');
  if(proof.environment!=='local-disposable-postgresql'||proof.databaseRemoved!==true||proof.connectionClosed!==true)deny('PROOF_CLEANUP');
  equal(proof.checks,spec.checkNames,'PROOF_CHECK_NAMES');if(proof.totalCheckCount!==spec.checkNames.length)deny('PROOF_CHECK_NAMES');if(proof.physicalWhatsAppTested!==false)deny('PROOF_PROVIDER_IO');
 }
}
export function validateExtensionProof(spec,bytes,{expectedHead,readSource,readEvidence}){
 if(!head(expectedHead)||typeof readSource!=='function')deny('PROOF_SOURCE_RESOLVER');let proof;try{proof=JSON.parse(utf8(bytes));}catch(error){if(error.code)throw error;deny('PROOF_JSON');}if(!proof||typeof proof!=='object'||Array.isArray(proof))deny('PROOF_SHAPE');
 const expectedStatus=spec.kind==='UI_CAUSAL'?'EXPECTED_CAUSAL_FAILURE':'PASS',actualStatus=spec.kind==='UI_PORTFOLIO'?(proof.state==='PASS_LOCAL_UI_NOT_RELEASE_ACCEPTANCE'?'PASS':'FAIL'):spec.kind==='PG_PREPARATION'?(proof.ok===true?'PASS':'FAIL'):spec.kind==='UI_PREPARATION'?(proof.validated===true?'PASS':'FAIL'):proof.status;if(actualStatus!==expectedStatus)deny('PROOF_STATUS');if((spec.kind==='PG_OVERTIME'?proof.realBusinessDatabaseUsed:['PG_COMPANY_KYC','PG_PORTFOLIO'].includes(spec.kind)?proof.productionDataTouched:proof.productionDataWritten)!==false)deny('PROOF_PRODUCTION_BOUNDARY');
 if(isCanonicalField(spec))proof.sourceManifest=canonicalFieldManifest(spec,proof);
 const producerBytes=readSource(spec.producer);if(!Buffer.isBuffer(producerBytes)||hash(producerBytes)!==spec.producerSha256||proof.harnessSha256!==spec.producerSha256)deny('PROOF_HARNESS_SOURCE');
 if(!Array.isArray(proof.sourceManifest))deny('PROOF_SOURCE_MANIFEST');equal(proof.sourceManifest.map(r=>r?.path).toSorted(),spec.sourceFiles.toSorted(),'PROOF_SOURCE_MANIFEST');
 for(const ref of proof.sourceManifest){exactKeys(ref,['path','sha256'],'PROOF_SOURCE_REFERENCE');sourcePath(ref.path);if(!sha(ref.sha256)||hash(readSource(ref.path))!==ref.sha256)deny('PROOF_SOURCE_HASH');}
 if(proof.sourceRevision!==undefined&&proof.sourceRevision!==expectedHead)deny('PROOF_SOURCE_HEAD');
 if(isCanonicalField(spec)){validateCanonicalFieldProof(spec,proof,readSource);}
 else if(isIdentity(spec)){validateIdentityProof(spec,proof,expectedHead);}
 else if(isPortfolio(spec)){validatePortfolioProof(spec,proof,{expectedHead,readEvidence});}
 else if(spec.kind==='PG_PREPARATION'||spec.kind==='UI_PREPARATION'){
  if(proof.sourceRevision!==expectedHead||proof.sourceState!=='EXACT_CI_SOURCE'||proof.trackedClean!==true)deny('PROOF_SOURCE_STATE');
  if(proof.providerCalls!==0)deny('PROOF_PROVIDER_IO');
  if(spec.kind==='PG_PREPARATION'){
   if(proof.databaseRemoved!==true||proof.fixture!=='disposable-local-postgres-canonical-workspace-with-synthetic-sessions')deny('PROOF_CLEANUP');equal(proof.checks,spec.checkNames,'PROOF_CHECK_NAMES');if(proof.totalCheckCount!==spec.checkNames.length)deny('PROOF_CHECK_NAMES');
  }else{
   if(proof.fixtureRemoved!==true)deny('PROOF_CLEANUP');if(proof.synthetic!==true||proof.realProviderCalls!==false)deny('PROOF_PROVIDER_IO');equal(proof.errors,[],'PROOF_UI_ERRORS');equal(proof.widths,[320,390,768,1280],'PROOF_MATRIX');matrix(proof.checks,proof.widths,PREPARATION_MODES);
   if(proof.totalCheckCount!==24)deny('PROOF_MATRIX');if(proof.checks.some(c=>c.posts!==(c.mode==='cancel'?2:1)||!Number.isSafeInteger(c.recoveryReads)||c.recoveryReads<0||c.currentSessionToken!==true||c.placeholdersOnly!==true||c.tasksUnchanged!==true||c.noPayloadPersistence!==true||c.horizontalOverflow!==false))deny('PROOF_PREPARATION_GUARDS');
  }
 }
 else if(spec.kind==='PG_COMPANY_KYC'){
  if(proof.databaseCreated!==false||proof.schemaRemoved!==true||proof.environment!=='schema-only-localhost-postgresql-corporate-KYC')deny('PROOF_CLEANUP');equal(proof.checks,spec.checkNames,'PROOF_CHECK_NAMES');if(proof.realProviderCalls!==0||proof.unexpectedNetworkCalls!==0||proof.realClerkLogin!==false||proof.realMetaAccepted!==false||proof.humanAccepted!==false)deny('PROOF_PROVIDER_IO');
 }
 else if(spec.kind==='PG_BANK'||spec.kind==='PG_INTAKE'){if(proof.schemaRemoved!==true)deny('PROOF_CLEANUP');equal(proof.checks,spec.checkNames,'PROOF_CHECK_NAMES');if(spec.kind==='PG_BANK'){if(proof.realProviderCalls!==0)deny('PROOF_PROVIDER_IO');}else{if(proof.providerCalls!==0||proof.unexpectedNetworkCalls!==0)deny('PROOF_PROVIDER_IO');equal(proof.sqlFailures,[],'PROOF_SQL_ERRORS');}}
 else if(spec.kind==='UNIT'){
  if(proof.sourceRevision!==expectedHead||proof.sourceState!=='committed exact Git HEAD'||proof.trackedClean!==true||proof.postgresExecuted!==false)deny('PROOF_SOURCE_STATE');if(!Array.isArray(proof.suites))deny('PROOF_UNIT_SUITES');equal(proof.suites.map(s=>s.file),TEST_SUITES,'PROOF_UNIT_SUITES');if(typeof readEvidence!=='function')deny('PROOF_TAP_RESOLVER');
  for(const [index,suite] of proof.suites.entries()){exactKeys(suite,['file','exitCode','tests','pass','fail','cancelled','skipped','todo','caseNames','tap'],'PROOF_UNIT_SUITE_SHAPE');exactKeys(suite.tap,['path','bytes','sha256'],'PROOF_UNIT_TAP_SHAPE');if(suite.exitCode!==0||suite.tap.path!=='.vercel/participant-bank-intake-contract-evidence/suite-'+index+'.tap')deny('PROOF_UNIT_EXECUTION');const tap=readEvidence(suite.tap.path);if(!Buffer.isBuffer(tap)||tap.length!==suite.tap.bytes||hash(tap)!==suite.tap.sha256)deny('PROOF_TAP_DIGEST');let parsed;try{parsed=parseTap(tap,{recovery:index===4,expectedTests:EXPECTED_SUITE_COUNTS[suite.file]??null});}catch{deny('PROOF_UNIT_RESULTS');}equal(parsed,Object.fromEntries(['tests','pass','fail','cancelled','skipped','todo','caseNames'].map(k=>[k,suite[k]])),'PROOF_UNIT_RESULTS');}
  if(proof.suites.reduce((total,suite)=>total+suite.tests,0)!==EXPECTED_TOTAL_TESTS)deny('PROOF_UNIT_RESULTS');
 }else{
  equal(proof.errors,[],'PROOF_UI_ERRORS');if(spec.kind==='UI_INTAKE'){if(proof.providerCalls!==0||proof.realIdentityAccepted!==false)deny('PROOF_PROVIDER_IO');}else if(proof.realProviderCalls!==0||proof.postgresExecuted!==false)deny('PROOF_PROVIDER_IO');
  if(spec.kind==='UI_BANK'){if(proof.sourceRevision!==expectedHead||proof.fullSuite!==true)deny('PROOF_SOURCE_STATE');equal(proof.widths,[320,390,768,1280],'PROOF_MATRIX');matrix(proof.checks,proof.widths,['normal','invalid-cancel','lost-reload','unknown-close-reload','same-retry','stale','denied-forged','integrated']);}
  if(spec.kind==='UI_INTAKE'){equal(proof.widths,[320,390,768,1280],'PROOF_MATRIX');matrix(proof.checks,proof.widths,['success','unknown','wrong-receipt','html403','scope-switch','paging','config','invite']);}
  if(spec.kind==='UI_JOINT'||spec.kind==='UI_CAUSAL'){
   if(proof.sourceRevision!==expectedHead||proof.sourceState!=='committed exact Git HEAD'||proof.trackedClean!==true)deny('PROOF_SOURCE_STATE');equal(proof.dirtyTrackedPaths,[],'PROOF_SOURCE_STATE');if(proof.realIdentityAccepted!==false)deny('PROOF_PROVIDER_IO');
   if(spec.kind==='UI_JOINT'){equal(proof.widths,[320,390,768,1280],'PROOF_MATRIX');matrix(proof.checks,proof.widths,['bank','intake']);if(proof.badTransform!==null||proof.causalFailure!==null||proof.checks.some(c=>c.parentAndSiblingBlocked!==true||c.ownRecoveryAndLocalCloseEnabled!==true||c.noFeedbackDeadlock!==true||c.automaticPost!==false||c.storagePrivate!==true))deny('PROOF_JOINT_GUARDS');}
   else{equal(proof.widths,[320],'PROOF_MATRIX');equal(proof.checks,[],'PROOF_MATRIX');const transform=proof.badTransform,needle='locked={busy||Boolean(attempt)||Boolean(durableReference)||!recoveryReady||Boolean(draft)||intakePending}',replacement='locked={busy||Boolean(attempt)||Boolean(durableReference)||!recoveryReady||Boolean(draft)||intakePending||hasBankPending}';exactKeys(transform,['source','originalSha256','fixtureSha256','needle','replacement','runtimeSourceEdited'],'PROOF_CAUSAL_TRANSFORM');if(transform.source!=='src/app/(identity)/cuenta/participant-panel.js'||transform.needle!==needle||transform.replacement!==replacement||transform.runtimeSourceEdited!==false)deny('PROOF_CAUSAL_TRANSFORM');const original=readSource(transform.source),text=utf8(original);if(text.split(needle).length!==2||transform.originalSha256!==hash(original)||transform.fixtureSha256!==hash(Buffer.from(text.replace(needle,replacement))))deny('PROOF_CAUSAL_TRANSFORM');exactKeys(proof.causalFailure,['stage','message','expectedFailure'],'PROOF_CAUSAL_FAILURE');if(proof.causalFailure.stage!=='own-bank-save'||proof.causalFailure.expectedFailure!==true||typeof proof.causalFailure.message!=='string'||!proof.causalFailure.message.startsWith('own bank save must remain enabled while its own pending gates siblings'))deny('PROOF_CAUSAL_FAILURE');}
  }
 }
 return {id:spec.id,path:spec.path,producer:spec.producer,kind:spec.kind,result:expectedStatus,sourceRevision:expectedHead,harnessSha256:spec.producerSha256,sourceManifestSha256:manifestDigest(proof.sourceManifest),sourceReferences:spec.sourceFiles.length,proofSha256:hash(bytes),bytes:bytes.length,checks:summary(spec)};
}
function proofBindings(contract,lane,files,expectedHead,readSource){return contract.extension.proofs.filter(p=>p.lane===lane).map(spec=>{if(hash(readSource(spec.producer))!==spec.producerSha256)deny('PROOF_HARNESS_SOURCE');return {id:spec.id,path:spec.path,producer:spec.producer,kind:spec.kind,result:spec.kind==='UI_CAUSAL'?'EXPECTED_CAUSAL_FAILURE':'PASS',sourceRevision:expectedHead,harnessSha256:spec.producerSha256,sourceManifestSha256:expectedSourceDigest(spec,readSource),sourceReferences:spec.sourceFiles.length,proofSha256:files.find(f=>f.path===spec.path).sha256,bytes:files.find(f=>f.path===spec.path).bytes,checks:summary(spec)};});}
function assertProofBindings(bindings,contract,lane,files,expectedHead,readSource){
 if(!Array.isArray(bindings))deny('PROOF_BINDINGS');const specs=contract.extension.proofs.filter(p=>p.lane===lane);equal(bindings.map(b=>b?.id),specs.map(p=>p.id),'PROOF_BINDINGS');const expectedBindings=proofBindings(contract,lane,files,expectedHead,readSource);for(const [index,binding] of bindings.entries()){exactKeys(binding,['id','path','producer','kind','result','sourceRevision','harnessSha256','sourceManifestSha256','sourceReferences','proofSha256','bytes','checks'],'PROOF_BINDING_SHAPE');const expected=expectedBindings[index];if(!sha(binding.sourceManifestSha256)||binding.sourceManifestSha256!==expected.sourceManifestSha256)deny('PROOF_BINDING_SOURCE');equal(binding,expected,'PROOF_BINDING_IDENTITY');if(binding.bytes<1)deny('PROOF_BINDING_EMPTY');}
}
// Read producer manifests without executing PG, browsers or provider adapters.
// Literal arrays and relative-import walks mirror the current producer rules;
// changing a producer rule requires a corresponding reviewed selftest update.
export function currentProducerSourceFiles(spec,root){
 if(isCanonicalField(spec))return [...new Set(Object.values(canonicalFieldSourceSets(spec,file=>readFileSync(path.join(root,file)))).flat())].sort();
 const text=readFileSync(path.join(root,spec.producer),'utf8');
 const literals=pattern=>{const rows=[...text.matchAll(pattern)];assert.equal(rows.length,1,'One literal producer array: '+spec.id);const body=rows[0][1],files=[...body.matchAll(/['"]([^'"]+)['"]/g)].map(match=>match[1]);assert.ok(files.length);assert.equal(body.replace(/['"][^'"]+['"]/g,'').replace(/[\s,]/g,''),'','Only literal producer sources');files.forEach(sourcePath);return files;};
 const array=name=>literals(new RegExp('\\b'+name+'=\\[([^\\]]+)\\]','g'));
 const walk=(seeds,initial=[])=>{
  const found=new Set(initial);
  function visit(file){if(found.has(file))return;sourcePath(file);found.add(file);if(!/\.(?:js|mjs)$/.test(file))return;for(const match of readFileSync(path.join(root,file),'utf8').matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)){const relative=path.posix.normalize(path.posix.join(path.posix.dirname(file),match[1])),dependency=[relative,relative+'.js',relative+'.mjs',...(isIdentity(spec)?[relative+'.css',relative+'/index.js']:[])].find(value=>{try{return lstatSync(path.join(root,value)).isFile();}catch{return false;}});assert.ok(dependency,'Resolvable producer source: '+file);visit(dependency);}}
  seeds.forEach(visit);return [...found].sort();
 };
 if(spec.kind==='UNIT')return bankUnitSourceFiles(root);
 if(isIdentity(spec)){const seeds=[...text.matchAll(/\bcopyGraph\('([^']+)'\)/g)].map(match=>match[1]);equal(seeds,['src/app/(identity)/cuenta/workspace-client.js','src/app/(identity)/cuenta/workspace-recovery-journal.mjs','src/lib/participant-policy.mjs'],'PROOF_IDENTITY_SOURCE_ROOTS');return walk(seeds);}
 if(spec.kind==='PORTFOLIO_UNIT')return portfolioUnitSourceFiles(root);
 if(spec.kind==='UI_PORTFOLIO')return array('files').map(file=>'src/app/(identity)/cuenta/'+file).sort();
 if(spec.kind==='PG_PORTFOLIO')return walk(array('sourcePaths'));
 if(spec.kind==='PG_BANK')return array('sourceFiles').sort();
 if(spec.kind==='PG_INTAKE')return array('sourcePaths').sort();
 if(spec.kind==='PG_PREPARATION')return array('sourcePaths').sort();
 if(spec.kind==='UI_PREPARATION')return array('copiedFiles').map(file=>'src/app/(identity)/cuenta/'+file).sort();
 if(spec.kind==='UI_BANK'){const seeds=[...text.matchAll(/\bvisit\('([^']+)'(?:,true)?\)/g)].map(match=>match[1]);assert.equal(seeds.length,3,'Exact current bank producer roots');return walk(seeds);}
 if(spec.kind==='UI_INTAKE')return [...array('files').map(file=>'src/app/(identity)/cuenta/'+file),...literals(/\.\.\.\[([^\]]+)\]\.map\(file=>/g)].sort();
 if(spec.kind==='UI_JOINT'||spec.kind==='UI_CAUSAL')return walk(literals(/for\(const file of \[([^\]]+)\]\)visit\(file\);/g),array('files').map(file=>'src/app/(identity)/cuenta/'+file));
 assert.equal(spec.kind,'PG_COMPANY_KYC');assert.ok(text.includes("const sourceManifest=[...sources('src/lib'),'scripts/fixtures/meta-signup-field-lifecycle-fixture.mjs']"),'Exact current company producer roots');
 const files=relative=>readdirSync(path.join(root,relative),{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(relative+'/'+entry.name):[relative+'/'+entry.name]);
 return [...files('src/lib'),'scripts/fixtures/meta-signup-field-lifecycle-fixture.mjs'].sort();
}
function extensionSelftest(contract,root,currentCompanyChecks=[]){
 const checks=[],discoveryChecks=[],videoChecks=[],preparationChecks=[],preparationProofChecks=[],identityClosureChecks=[],billingClosureChecks=[],expectedHead=contract.extension.baseHead;
 const discoveryBackend=['src/lib/participant-account-discovery.mjs'],discoveryUi=['src/app/(identity)/cuenta/participant-account-discovery-format.mjs','src/app/(identity)/cuenta/participant-account-discovery.js'];
 const discoveryDependenciesFor=kind=>kind==='UI_INTAKE'?discoveryUi:['UI_BANK','UI_JOINT','UI_CAUSAL'].includes(kind)?[...discoveryBackend,...discoveryUi]:discoveryBackend;
 const beforeDiscoveryCounts={UNIT:94,PG_BANK:12,PG_INTAKE:21,UI_BANK:87,UI_INTAKE:19,UI_JOINT:87,UI_CAUSAL:87,PG_COMPANY_KYC:155};
 const videoDependenciesFor=kind=>['UNIT','UI_BANK','UI_JOINT','UI_CAUSAL','PG_COMPANY_KYC'].includes(kind)?['src/lib/video-audio-extractor.mjs']:[];
 const beforeVideoCounts={UNIT:95,UI_BANK:90,UI_JOINT:90,UI_CAUSAL:90,PG_COMPANY_KYC:156};
 const companyBillingDependenciesFor=kind=>kind==='PG_COMPANY_KYC'?['src/lib/company-billing-http.mjs','src/lib/company-billing.mjs','src/lib/retired-billing.mjs']:[];
 const good=(name,run)=>{run();checks.push({name,result:'PASS',boundary:'pure shadow fixture, no Git/PG/UI/provider execution'});},bad=(name,code,run)=>{assert.throws(run,error=>error.code===code);checks.push({name,result:'PASS',expectedDenial:code,boundary:'pure shadow fixture'});};
 // Normalize only these shadow source fixtures to Linux Git text. The actual proof validator never normalizes bytes.
 const readSource=file=>{const bytes=readFileSync(path.join(root,sourcePath(file))),text=bytes.toString('utf8');assert.ok(bytes.equals(Buffer.from(text)));return Buffer.from(text.replaceAll('\r\n','\n'));};
 const tap=names=>Buffer.from('TAP version 13\n'+names.map((name,i)=>'ok '+(i+1)+' - '+name+'\n').join('')+'1..'+names.length+'\n# tests '+names.length+'\n# pass '+names.length+'\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n');
 for(const spec of contract.extension.proofs.filter(spec=>!isPortfolio(spec)&&!isIdentity(spec)&&!isCanonicalField(spec))){
   const originalCheckCount=checks.length;
  const evidence=new Map(),base={status:spec.kind==='UI_CAUSAL'?'EXPECTED_CAUSAL_FAILURE':'PASS',productionDataWritten:false,sourceManifest:spec.sourceFiles.map(file=>({path:file,sha256:hash(readSource(file))})),harnessSha256:spec.producerSha256};
  let proof={...base};
  if(spec.kind.startsWith('PG_'))Object.assign(proof,{schemaRemoved:true,checks:[...spec.checkNames],realProviderCalls:0,providerCalls:0,unexpectedNetworkCalls:0,sqlFailures:[],...(spec.kind==='PG_COMPANY_KYC'?{productionDataTouched:false,databaseCreated:false,environment:'schema-only-localhost-postgresql-corporate-KYC',realClerkLogin:false,realMetaAccepted:false,humanAccepted:false}:{})});
  else if(spec.kind==='UNIT'){Object.assign(proof,{sourceRevision:expectedHead,sourceState:'committed exact Git HEAD',trackedClean:true,postgresExecuted:false,suites:TEST_SUITES.map((file,index)=>{const bytes=tap(index===4?RECOVERY_CASES:Array.from({length:EXPECTED_SUITE_COUNTS[file]||1},(_,i)=>'shadow fixture '+index+' case '+i)),filename='.vercel/participant-bank-intake-contract-evidence/suite-'+index+'.tap';evidence.set(filename,bytes);return {file,exitCode:0,...parseTap(bytes,{recovery:index===4,expectedTests:EXPECTED_SUITE_COUNTS[file]??null}),tap:{path:filename,bytes:bytes.length,sha256:hash(bytes)}};})});}
  else{Object.assign(proof,{errors:[],realProviderCalls:0,providerCalls:0,postgresExecuted:false,realIdentityAccepted:false,widths:[320,390,768,1280],sourceRevision:expectedHead,sourceState:'committed exact Git HEAD',trackedClean:true,dirtyTrackedPaths:[],fullSuite:true,badTransform:null,causalFailure:null});const modes=spec.kind==='UI_BANK'?['normal','invalid-cancel','lost-reload','unknown-close-reload','same-retry','stale','denied-forged','integrated']:spec.kind==='UI_INTAKE'?['success','unknown','wrong-receipt','html403','scope-switch','paging','config','invite']:['bank','intake'];proof.checks=proof.widths.flatMap(width=>modes.map(mode=>({width,mode,parentAndSiblingBlocked:true,ownRecoveryAndLocalCloseEnabled:true,noFeedbackDeadlock:true,automaticPost:false,storagePrivate:true})));
   if(spec.kind==='UI_CAUSAL'){const source='src/app/(identity)/cuenta/participant-panel.js',original=readSource(source),needle='locked={busy||Boolean(attempt)||Boolean(durableReference)||!recoveryReady||Boolean(draft)||intakePending}',replacement='locked={busy||Boolean(attempt)||Boolean(durableReference)||!recoveryReady||Boolean(draft)||intakePending||hasBankPending}';Object.assign(proof,{widths:[320],checks:[],badTransform:{source,originalSha256:hash(original),fixtureSha256:hash(Buffer.from(original.toString().replace(needle,replacement))),needle,replacement,runtimeSourceEdited:false},causalFailure:{stage:'own-bank-save',message:'own bank save must remain enabled while its own pending gates siblings (shadow fixture)',expectedFailure:true}});}
  }
   if(spec.kind==='PG_PREPARATION')Object.assign(proof,{ok:true,sourceRevision:expectedHead,sourceState:'EXACT_CI_SOURCE',trackedClean:true,databaseRemoved:true,fixture:'disposable-local-postgres-canonical-workspace-with-synthetic-sessions',totalCheckCount:spec.checkNames.length});
   if(spec.kind==='UI_PREPARATION')Object.assign(proof,{validated:true,synthetic:true,realProviderCalls:false,sourceState:'EXACT_CI_SOURCE',fixtureRemoved:true,totalCheckCount:24,checks:proof.widths.flatMap(width=>PREPARATION_MODES.map(mode=>({width,mode,posts:mode==='cancel'?2:1,recoveryReads:0,currentSessionToken:true,placeholdersOnly:true,tasksUnchanged:true,noPayloadPersistence:true,horizontalOverflow:false})))});
   const validate=value=>validateExtensionProof(spec,Buffer.from(JSON.stringify(value)),{expectedHead,readSource,readEvidence:file=>evidence.get(file)}),mutate=(name,code,edit)=>{const value=clone(proof);edit(value);bad(spec.id+'-'+name,code,()=>validate(value));};
  good(spec.id+'-complete-proof',()=>validate(proof));
  if(spec.kind!=='UNIT')good(spec.id+'-real-current-producer-source-manifest-exact',()=>equal(currentProducerSourceFiles(spec,root),spec.sourceFiles.toSorted(),'PROOF_SOURCE_MANIFEST'));
  good(spec.id+'-reordered-source-manifest',()=>{const reordered=clone(proof);reordered.sourceManifest.reverse();assert.equal(validate(reordered).sourceManifestSha256,validate(proof).sourceManifestSha256);});
  bad(spec.id+'-malformed-json','PROOF_JSON',()=>validateExtensionProof(spec,Buffer.from('{'),{expectedHead,readSource}));bad(spec.id+'-invalid-utf8','PROOF_ENCODING',()=>validateExtensionProof(spec,Buffer.from([255]),{expectedHead,readSource}));
   mutate('wrong-status','PROOF_STATUS',p=>{if(spec.kind==='PG_PREPARATION')p.ok=false;else if(spec.kind==='UI_PREPARATION')p.validated=false;else p.status='FAIL';});mutate('production-write','PROOF_PRODUCTION_BOUNDARY',p=>{if(spec.kind==='PG_COMPANY_KYC')p.productionDataTouched=true;else p.productionDataWritten=true;});mutate('wrong-source-head','PROOF_SOURCE_HEAD',p=>{p.sourceRevision='f'.repeat(40);});mutate('wrong-harness','PROOF_HARNESS_SOURCE',p=>{p.harnessSha256='f'.repeat(64);});mutate('missing-source','PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest.pop();});mutate('foreign-source','PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest.push({path:'src/foreign.mjs',sha256:'f'.repeat(64)});});mutate('wrong-source-hash','PROOF_SOURCE_HASH',p=>{p.sourceManifest[0].sha256='f'.repeat(64);});
   if(spec.kind.startsWith('PG_')){mutate('cleanup-failure','PROOF_CLEANUP',p=>{if(spec.kind==='PG_PREPARATION')p.databaseRemoved=false;else p.schemaRemoved=false;});mutate('missing-check','PROOF_CHECK_NAMES',p=>{p.checks.pop();});mutate('provider-call','PROOF_PROVIDER_IO',p=>{p.realProviderCalls=1;p.providerCalls=1;});}
  if(spec.kind==='PG_COMPANY_KYC'){
   mutate('database-created','PROOF_CLEANUP',p=>{p.databaseCreated=true;});mutate('wrong-engine','PROOF_CLEANUP',p=>{p.environment='database-created-fixture';});mutate('network-call','PROOF_PROVIDER_IO',p=>{p.unexpectedNetworkCalls=1;});mutate('network-array-is-not-zero','PROOF_PROVIDER_IO',p=>{p.unexpectedNetworkCalls=[];});for(const key of ['realClerkLogin','realMetaAccepted','humanAccepted'])mutate('accepted-'+key,'PROOF_PROVIDER_IO',p=>{p[key]=true;});
  }
   if(['UI_BANK','UI_INTAKE','UI_JOINT','UI_PREPARATION'].includes(spec.kind)){mutate('partial-matrix','PROOF_MATRIX',p=>{p.checks.pop();});mutate('duplicate-matrix','PROOF_MATRIX',p=>{p.checks[0]=p.checks[1];});mutate('ui-error','PROOF_UI_ERRORS',p=>{p.errors=['shadow error'];});}
   if(spec.kind==='PG_PREPARATION'||spec.kind==='UI_PREPARATION'){
    mutate('dirty-tracked','PROOF_SOURCE_STATE',p=>{p.trackedClean=false;});mutate('uncommitted-source','PROOF_SOURCE_STATE',p=>{p.sourceState='LOCAL_REVIEW_SOURCE';});mutate('missing-head','PROOF_SOURCE_STATE',p=>{delete p.sourceRevision;});mutate('wrong-total',spec.kind==='UI_PREPARATION'?'PROOF_MATRIX':'PROOF_CHECK_NAMES',p=>{p.totalCheckCount=0;});
    if(spec.kind==='UI_PREPARATION'){mutate('fixture-not-removed','PROOF_CLEANUP',p=>{p.fixtureRemoved=false;});mutate('provider-call','PROOF_PROVIDER_IO',p=>{p.providerCalls=1;});mutate('private-payload-stored','PROOF_PREPARATION_GUARDS',p=>{p.checks[0].noPayloadPersistence=false;});mutate('tasks-mutated','PROOF_PREPARATION_GUARDS',p=>{p.checks[0].tasksUnchanged=false;});}
   }
  if(spec.kind==='UI_JOINT'){mutate('dirty-tracked','PROOF_SOURCE_STATE',p=>{p.trackedClean=false;});mutate('uncommitted-source','PROOF_SOURCE_STATE',p=>{p.sourceState='uncommitted';});mutate('null-head','PROOF_SOURCE_HEAD',p=>{p.sourceRevision=null;});for(const key of ['parentAndSiblingBlocked','ownRecoveryAndLocalCloseEnabled','noFeedbackDeadlock','storagePrivate'])mutate('missing-'+key,'PROOF_JOINT_GUARDS',p=>{p.checks[0][key]=false;});mutate('auto-post','PROOF_JOINT_GUARDS',p=>{p.checks[0].automaticPost=true;});}
  if(spec.kind==='UI_CAUSAL'){mutate('wrong-stage','PROOF_CAUSAL_FAILURE',p=>{p.causalFailure.stage='unrelated';});mutate('runtime-mutated','PROOF_CAUSAL_TRANSFORM',p=>{p.badTransform.runtimeSourceEdited=true;});mutate('wrong-fixture-hash','PROOF_CAUSAL_TRANSFORM',p=>{p.badTransform.fixtureSha256='f'.repeat(64);});}
  if(spec.kind==='UNIT'){mutate('missing-suite','PROOF_UNIT_SUITES',p=>{p.suites.pop();});mutate('changed-tap-digest','PROOF_TAP_DIGEST',p=>{p.suites[4].tap.sha256='f'.repeat(64);});for(const names of [RECOVERY_CASES.slice(0,6),[...RECOVERY_CASES,'extra shadow case'],[...RECOVERY_CASES.slice(0,6),'wrong case']]){const bytes=tap(names),filename=proof.suites[4].tap.path,original=evidence.get(filename);evidence.set(filename,bytes);mutate('recovery-exact7-'+names.length+'-'+names.at(-1),'PROOF_UNIT_RESULTS',p=>{p.suites[4].tap={path:filename,bytes:bytes.length,sha256:hash(bytes)};});evidence.set(filename,original);}for(const key of ['fail','cancelled','skipped','todo']){const filename=proof.suites[4].tap.path,original=evidence.get(filename),bytes=Buffer.from(original.toString().replace('# '+key+' 0','# '+key+' 1'));evidence.set(filename,bytes);mutate('recovery-'+key,'PROOF_UNIT_RESULTS',p=>{p.suites[4].tap={path:filename,bytes:bytes.length,sha256:hash(bytes)};});evidence.set(filename,original);}}
  const historicalSuiteCounts={...EXPECTED_SUITE_COUNTS,'tests/production-company-channel-kyc.test.mjs':76,'tests/production-participant-onboarding-next-step.test.mjs':35};
  if(spec.kind==='UNIT')for(const [file,count] of Object.entries(historicalSuiteCounts)){
   const index=TEST_SUITES.indexOf(file),filename=proof.suites[index].tap.path,original=evidence.get(filename);
   for(const size of [count-1,count+1]){const bytes=tap(Array.from({length:size},(_,i)=>'shadow exact suite '+i));evidence.set(filename,bytes);mutate('exact-suite-count-'+file+'-'+size,'PROOF_UNIT_RESULTS',p=>{p.suites[index]={file,exitCode:0,...parseTap(bytes),tap:{path:filename,bytes:bytes.length,sha256:hash(bytes)}};});}
   evidence.set(filename,original);
  }
  // Append current schema2 controls after the entire historical and portfolio sequence.
  if(spec.kind==='UNIT')currentCompanyChecks.push(()=>{
   const start=checks.length;
   for(const [file,previous] of [['tests/production-company-channel-kyc.test.mjs',76],['tests/production-participant-onboarding-next-step.test.mjs',35]]){
    const count=EXPECTED_SUITE_COUNTS[file],index=TEST_SUITES.indexOf(file),filename=proof.suites[index].tap.path,original=evidence.get(filename);
    for(const size of [previous,count-1,count+1]){const bytes=tap(Array.from({length:size},(_,i)=>'current schema2 suite '+i));evidence.set(filename,bytes);mutate('current-suite-count-'+file+'-'+size,'PROOF_UNIT_RESULTS',p=>{p.suites[index]={file,exitCode:0,...parseTap(bytes),tap:{path:filename,bytes:bytes.length,sha256:hash(bytes)}};});}
    evidence.set(filename,original);
   }
   return checks.splice(start);
  });
  if(spec.kind==='PG_COMPANY_KYC')currentCompanyChecks.push(()=>{
   const start=checks.length;
   const staleSpec={...spec,producerSha256:COMPANY_KYC_PG_BASELINE_PRODUCER.producerSha256};bad('company-kyc-postgres-historical-pin-cannot-certify-current-harness','PROOF_HARNESS_SOURCE',()=>validateExtensionProof(staleSpec,Buffer.from(JSON.stringify({...proof,harnessSha256:staleSpec.producerSha256})),{expectedHead,readSource}));
   const changed=clone(contract);changed.evidenceProducers.find(record=>record.path===spec.path).producerSha256=spec.producerSha256;bad('company-kyc-postgres-historical-record-cannot-be-overwritten','EXTENSION_PRODUCER_CONTRACT',()=>validateContract(changed));
   good('company-kyc-postgres-current-ten-SQL-checks-exact',()=>{assert.equal(spec.checkNames.length,10);equal([...readFileSync(path.join(root,spec.producer),'utf8').matchAll(/checks\.push\('([^']+)'\)/g)].map(match=>match[1]),spec.checkNames,'PROOF_CHECK_NAMES');});
   mutate('legacy-six-checks','PROOF_CHECK_NAMES',p=>{p.checks=spec.checkNames.slice(0,6);});
   for(const file of planImportDependenciesFor(spec.kind)){
    mutate('missing-plan-import-source-'+file,'PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>ref.path!==file);});
    mutate('changed-plan-import-hash-'+file,'PROOF_SOURCE_HASH',p=>{p.sourceManifest.find(ref=>ref.path===file).sha256='f'.repeat(64);});
   }
   return checks.splice(start);
  });
  if(['bank-intake-units','bank-ui','joint-ui','joint-causal','company-kyc-postgres'].includes(spec.id)){
   const allOnboardingDependencies=['src/lib/company-entitlement.mjs','src/lib/meta-customer-templates.mjs','src/lib/participant-onboarding-authority.mjs','src/lib/participant-onboarding-delivery.mjs','src/lib/participant-onboarding-intent.mjs','src/lib/participant-onboarding-policy.mjs','src/lib/whatsapp/template-review-policy.js'];
   const onboardingDependencies=spec.kind==='PG_COMPANY_KYC'?allOnboardingDependencies.filter(file=>!['src/lib/meta-customer-templates.mjs','src/lib/whatsapp/template-review-policy.js'].includes(file)):allOnboardingDependencies;
    const voiceDependencies=['src/lib/voice-progress-draft.mjs'],videoDependencies=videoDependenciesFor(spec.kind),preparationDependencies=preparationDependenciesFor(spec.kind),planImportDependencies=planImportDependenciesFor(spec.kind),currentDependencies=[...onboardingDependencies,...voiceDependencies,...videoDependencies,...preparationDependencies,...planImportDependencies,...identityDependenciesFor(spec.kind),...companyBillingDependenciesFor(spec.kind)];
   const previousCount=spec.kind==='UNIT'?86:spec.kind==='PG_COMPANY_KYC'?149:79;
   assert.equal(spec.sourceFiles.length,previousCount+currentDependencies.length+discoveryDependenciesFor(spec.kind).length,'Exact canonical transitive source count: '+spec.id);
   if(spec.kind==='UNIT')good('bank-intake-units-real-current-transitive-manifest-exact',()=>equal(bankUnitSourceFiles(root),spec.sourceFiles.toSorted(),'PROOF_SOURCE_MANIFEST'));
   for(const file of onboardingDependencies){
    assert.ok(spec.sourceFiles.includes(file),'Canonical onboarding transitive source must be pinned: '+file);
    mutate('missing-transitive-source-'+file,'PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>ref.path!==file);});
    mutate('changed-transitive-hash-'+file,'PROOF_SOURCE_HASH',p=>{p.sourceManifest.find(ref=>ref.path===file).sha256='f'.repeat(64);});
   }
   for(const file of voiceDependencies){
    assert.ok(spec.sourceFiles.includes(file),'Canonical voice transitive source must be pinned: '+file);
    mutate('missing-transitive-source-'+file,'PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>ref.path!==file);});
    mutate('changed-transitive-hash-'+file,'PROOF_SOURCE_HASH',p=>{p.sourceManifest.find(ref=>ref.path===file).sha256='f'.repeat(64);});
   }
   const beforeVoiceCount=previousCount+onboardingDependencies.length;
    mutate('old-'+beforeVoiceCount+'-source-manifest-without-voice','PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>![...voiceDependencies,...discoveryDependenciesFor(spec.kind),...videoDependencies,...preparationDependencies,...planImportDependencies,...identityDependenciesFor(spec.kind),...companyBillingDependenciesFor(spec.kind)].includes(ref.path));assert.equal(p.sourceManifest.length,beforeVoiceCount);});
   mutate('old-'+previousCount+'-source-manifest','PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>![...currentDependencies,...discoveryDependenciesFor(spec.kind)].includes(ref.path));assert.equal(p.sourceManifest.length,previousCount);});
  }
  // Append discovery controls after the complete historical check sequence.
   if(!['PG_PREPARATION','UI_PREPARATION'].includes(spec.kind))discoveryChecks.push(()=>{
    const dependencies=discoveryDependenciesFor(spec.kind),previousCount=beforeDiscoveryCounts[spec.kind],videoDependencies=videoDependenciesFor(spec.kind),preparationDependencies=preparationDependenciesFor(spec.kind),planImportDependencies=planImportDependenciesFor(spec.kind);
    assert.equal(spec.sourceFiles.length,previousCount+dependencies.length+videoDependencies.length+preparationDependencies.length+planImportDependencies.length+identityDependenciesFor(spec.kind).length+companyBillingDependenciesFor(spec.kind).length,'Exact current discovery source count: '+spec.id);
   for(const file of dependencies){
    assert.ok(spec.sourceFiles.includes(file),'Canonical account discovery source must be pinned: '+file);
    mutate('missing-discovery-source-'+file,'PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>ref.path!==file);});
    mutate('changed-discovery-hash-'+file,'PROOF_SOURCE_HASH',p=>{p.sourceManifest.find(ref=>ref.path===file).sha256='f'.repeat(64);});
   }
    mutate('old-'+previousCount+'-source-manifest-without-discovery','PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>![...dependencies,...videoDependencies,...preparationDependencies,...planImportDependencies,...identityDependenciesFor(spec.kind),...companyBillingDependenciesFor(spec.kind)].includes(ref.path));assert.equal(p.sourceManifest.length,previousCount);});
  });
  // Append only the extractor's causal controls after all 553 historical checks.
  if(videoDependenciesFor(spec.kind).length)videoChecks.push(()=>{
   const dependencies=videoDependenciesFor(spec.kind),previousCount=beforeVideoCounts[spec.kind],preparationDependencies=preparationDependenciesFor(spec.kind),planImportDependencies=planImportDependenciesFor(spec.kind);
   assert.equal(spec.sourceFiles.length,previousCount+dependencies.length+preparationDependencies.length+planImportDependencies.length+identityDependenciesFor(spec.kind).length+companyBillingDependenciesFor(spec.kind).length,'Exact current video source count: '+spec.id);
   for(const file of dependencies){
    assert.ok(spec.sourceFiles.includes(file),'Canonical contextual video source must be pinned: '+file);
    mutate('missing-video-source-'+file,'PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>ref.path!==file);});
    mutate('changed-video-hash-'+file,'PROOF_SOURCE_HASH',p=>{p.sourceManifest.find(ref=>ref.path===file).sha256='f'.repeat(64);});
   }
   mutate('old-'+previousCount+'-source-manifest-without-video','PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>![...dependencies,...preparationDependencies,...planImportDependencies,...identityDependenciesFor(spec.kind),...companyBillingDependenciesFor(spec.kind)].includes(ref.path));assert.equal(p.sourceManifest.length,previousCount);});
  });
   if(preparationDependenciesFor(spec.kind).length)preparationChecks.push(()=>{for(const file of preparationDependenciesFor(spec.kind)){assert.ok(spec.sourceFiles.includes(file),'Current KYC/preparation source must be pinned: '+file);mutate('missing-kyc-preparation-source-'+file,'PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>ref.path!==file);});mutate('changed-kyc-preparation-hash-'+file,'PROOF_SOURCE_HASH',p=>{p.sourceManifest.find(ref=>ref.path===file).sha256='f'.repeat(64);});}});
   if(identityDependenciesFor(spec.kind).length)identityClosureChecks.push(()=>{for(const file of identityDependenciesFor(spec.kind)){assert.ok(spec.sourceFiles.includes(file),'Current participant admission source must be pinned: '+file);mutate('missing-admission-source-'+file,'PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>ref.path!==file);});mutate('changed-admission-hash-'+file,'PROOF_SOURCE_HASH',p=>{p.sourceManifest.find(ref=>ref.path===file).sha256='f'.repeat(64);});}});
   if(companyBillingDependenciesFor(spec.kind).length)billingClosureChecks.push(()=>{
    const dependencies=companyBillingDependenciesFor(spec.kind);
    for(const file of dependencies){assert.ok(spec.sourceFiles.includes(file),'Current company billing source must be pinned: '+file);mutate('missing-company-billing-source-'+file,'PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>ref.path!==file);});mutate('changed-company-billing-hash-'+file,'PROOF_SOURCE_HASH',p=>{p.sourceManifest.find(ref=>ref.path===file).sha256='f'.repeat(64);});}
    mutate('old-163-source-manifest-without-company-billing','PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>!dependencies.includes(ref.path));assert.equal(p.sourceManifest.length,163);});
   });
   if(spec.kind==='PG_PREPARATION')identityClosureChecks.push(()=>{
    good('project-preparation-existing-fifteen-SQL-checks-exact',()=>equal([...readFileSync(path.join(root,spec.producer),'utf8').matchAll(/checks\.push\('([^']+)'\)/g)].map(match=>match[1]),spec.checkNames,'PROOF_CHECK_NAMES'));
    for(const file of ['src/lib/participant-admission.mjs','src/lib/participant-approved-identity.mjs','src/lib/participant-kyc-image-set.mjs']){assert.ok(spec.sourceFiles.includes(file),'Current project preparation admission dependency must be pinned: '+file);mutate('missing-admission-source-'+file,'PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>ref.path!==file);});mutate('changed-admission-hash-'+file,'PROOF_SOURCE_HASH',p=>{p.sourceManifest.find(ref=>ref.path===file).sha256='f'.repeat(64);});}
    const staleSpec={...spec,producerSha256:PREPARATION_PG_BASELINE_PRODUCER.producerSha256};bad('project-preparation-historical-pin-cannot-certify-current-harness','PROOF_HARNESS_SOURCE',()=>validateExtensionProof(staleSpec,Buffer.from(JSON.stringify({...proof,harnessSha256:staleSpec.producerSha256})),{expectedHead,readSource}));
    const changed=clone(contract);changed.evidenceProducers.find(record=>record.path===spec.path).producerSha256=spec.producerSha256;bad('project-preparation-historical-record-cannot-be-overwritten','EXTENSION_PRODUCER_CONTRACT',()=>validateContract(changed));
   });
   if(['PG_PREPARATION','UI_PREPARATION'].includes(spec.kind))preparationProofChecks.push(...checks.splice(originalCheckCount));
 }
 for(const run of discoveryChecks)run();
 for(const run of videoChecks)run();
 for(const run of preparationChecks)run();
 checks.push(...preparationProofChecks);
 for(const run of identityClosureChecks)run();
 for(const run of billingClosureChecks)run();
 return checks;
}

export function cleanPath(value){
 if(typeof value!=='string'||value.length>500||!value||! /^[A-Za-z0-9._/-]+$/.test(value)||value.startsWith('/')||value.split('/').some(part=>!part||part==='.'||part==='..'))deny('UNSAFE_PATH');
 return value;
}
function patternValid(value){
 if(typeof value!=='string'||value.includes('**'))deny('INVALID_ARTIFACT_PATTERN');
 cleanPath(value.replaceAll('*','fixture').replace(/\/$/,''));
}
function matches(value,pattern){
 if(pattern.endsWith('/'))return value.startsWith(pattern);
 const regex=new RegExp('^'+pattern.replace(/[.+?^${}()|[\]\\]/g,'\\$&').replaceAll('*','[^/]*')+'$');
 return regex.test(value);
}
const verifierSha256=()=>hash(readFileSync(fileURLToPath(import.meta.url)));
function requireEvidence(files,required,code){if(required.some(filename=>!files.some(file=>file.path===filename)))deny(code);}
function executedProducers(contract){return contract.blocks.flatMap(block=>[...block.step.run.matchAll(/(?:^|\n)(?:node|python)\s+(scripts\/[A-Za-z0-9._/-]+\.(?:mjs|py))(?=\s|$)/g)].map(match=>({producer:match[1],blockId:block.id,lane:LANES.find(lane=>contract.lanes[lane].blocks.includes(block.id))})));}
export function assertSourceIdentity({actualHead,expectedHead,dirtyTrackedPaths}){
 if(!head(expectedHead))deny('EXPECTED_HEAD_INVALID');
 if(actualHead!==expectedHead)deny('SOURCE_HEAD_MISMATCH');
 if(!Array.isArray(dirtyTrackedPaths)||dirtyTrackedPaths.some(value=>typeof value!=='string'))deny('INVALID_TRACKED_SOURCE_STATE');
 if(dirtyTrackedPaths.length)deny('TRACKED_SOURCE_DIRTY');
 return actualHead;
}
function validateEvidenceContract(contract){
 const infra=contract.infrastructureCheck;
 exactKeys(infra,['id','lane','producer','step','producedNotUploaded'],'INFRASTRUCTURE_CHECK_SHAPE');
 if(infra.id!=='ci-gate-selftest'||infra.lane!=='contracts'||infra.producer!==script)deny('INFRASTRUCTURE_CHECK_IDENTITY');
 equal(infra.step,{name:'CI gate helper lint and negative controls',run:'npx eslint '+script+' --max-warnings 0\nnode '+script+' selftest --expected-head "$GITHUB_SHA"\n'},'INFRASTRUCTURE_CHECK_COMMAND');
 equal(infra.producedNotUploaded,['.vercel/workspace-ci-evidence/selftest.json','.vercel/workspace-ci-evidence/selftest.xml'],'INFRASTRUCTURE_EVIDENCE');
 if(!Array.isArray(contract.evidenceProducers)||!Array.isArray(contract.stdoutOnlyProducers))deny('EVIDENCE_PRODUCER_SHAPE');
 const declared=[...contract.evidenceProducers,...contract.stdoutOnlyProducers].map(({producer,blockId,lane})=>({producer,blockId,lane}));
 const byKey=items=>items.map(x=>JSON.stringify(x)).sort();
 equal(byKey(declared),byKey(executedProducers(contract)),'EVIDENCE_PRODUCER_COVERAGE');
 const allPaths=new Set();
 for(const producer of contract.evidenceProducers){
  exactKeys(producer,producer.blockId<=52?['producer','path','retained','blockId','lane','baselineSourceLine','baselineProducerGitBlobSha256']:['producer','path','retained','blockId','lane','sourceLine','producerSha256','sourceBasis'],'EVIDENCE_PRODUCER_SHAPE');
  cleanPath(producer.path);if(!producer.path.endsWith('.json')||typeof producer.retained!=='boolean'||!(producer.blockId<=52?sha(producer.baselineProducerGitBlobSha256)&&Number.isSafeInteger(producer.baselineSourceLine)&&producer.baselineSourceLine>0:sha(producer.producerSha256)&&Number.isSafeInteger(producer.sourceLine)&&producer.sourceLine>0&&producer.sourceBasis==='EXPECTED_HEAD_GIT_BYTES'))deny('EVIDENCE_PRODUCER_SHAPE');
  if(allPaths.has(producer.path))deny('DUPLICATE_REQUIRED_EVIDENCE');allPaths.add(producer.path);
  if(!contract.lanes[producer.lane]?.blocks.includes(producer.blockId))deny('EVIDENCE_PRODUCER_LANE');
 }
 for(const producer of contract.stdoutOnlyProducers){
  exactKeys(producer,['producer','blockId','lane','reason'],'STDOUT_PRODUCER_SHAPE');
  if(!contract.lanes[producer.lane]?.blocks.includes(producer.blockId)||typeof producer.reason!=='string'||!producer.reason)deny('STDOUT_PRODUCER_SHAPE');
 }
 for(const lane of LANES){
  const owner=contract.lanes[lane];
  equal(owner.optionalArtifactPatterns,owner.artifacts.filter(pattern=>pattern.includes('*')),'OPTIONAL_ARTIFACT_COVERAGE');
  equal(owner.requiredRetainedEvidence,contract.evidenceProducers.filter(p=>p.lane===lane&&p.retained).map(p=>p.path),'RETAINED_PRODUCER_COVERAGE');
  equal(owner.requiredProducedEvidence,[...contract.evidenceProducers.filter(p=>p.lane===lane&&!p.retained).map(p=>p.path),...(lane==='contracts'?infra.producedNotUploaded:[])],'PRODUCED_PRODUCER_COVERAGE');
  for(const filename of owner.requiredRetainedEvidence){cleanPath(filename);if(!owner.artifacts.some(pattern=>matches(filename,pattern)))deny('RETAINED_EVIDENCE_NOT_OWNED');}
  for(const filename of owner.requiredProducedEvidence){cleanPath(filename);if(owner.artifacts.some(pattern=>matches(filename,pattern)))deny('PRODUCED_EVIDENCE_IS_UPLOAD_OWNED');}
  if(owner.artifacts.filter(pattern=>!owner.optionalArtifactPatterns.includes(pattern)).some(pattern=>!owner.requiredRetainedEvidence.some(filename=>matches(filename,pattern))))deny('MANDATORY_PATTERN_WITHOUT_MAIN_PROOF');
 }
 if(Object.values(contract.lanes).flatMap(owner=>owner.optionalArtifactPatterns).length!==6)deny('OPTIONAL_ARTIFACT_COVERAGE');
}
export function validateContract(contract){
 if(contract?.version!==2||contract.sourceCommit!=='61d316a8983c268d43f8af6de10df9743a46278e')deny('CONTRACT_BASE');
 equal(Object.keys(contract.lanes).sort(),[...LANES].sort(),'CONTRACT_LANES');
 const ids=contract.blocks.map(block=>block.id);
 equal(ids,Array.from({length:54},(_,i)=>i+7),'CONTRACT_BLOCKS');
 for(const block of contract.blocks){if(typeof block.step.run!=='string'||hash(block.step.run)!==block.commandSha256)deny('CONTRACT_COMMAND');}
 const assigned=Object.values(contract.lanes).flatMap(lane=>lane.blocks);
 equal([...assigned].sort((a,b)=>a-b),ids,'CONTRACT_COVERAGE');
 if(new Set(assigned).size!==54)deny('CONTRACT_DUPLICATE_BLOCK');
 const patterns=Object.values(contract.lanes).flatMap(lane=>lane.artifacts);
 equal([...patterns].sort(),[...contract.artifactPatterns].sort(),'CONTRACT_ARTIFACT_COVERAGE');
 if(patterns.length!==58||new Set(patterns).size!==58)deny('CONTRACT_ARTIFACT_DUPLICATE');
 patterns.forEach(patternValid);
 validateEvidenceContract(contract);validateExtension(contract);
 return contract;
}
export function loadContract(filename){
 const bytes=readFileSync(filename);if(hash(bytes)!==EXPECTED_CONTRACT_SHA256)deny('CONTRACT_CHECKSUM');
 return validateContract(JSON.parse(bytes.toString('utf8')));
}
export function buildWorkflow(contract){
 validateContract(contract);
 const base=contract.workflow;
 const jobs={};
 const setup=clone(contract.setup);
 setup[0].with.ref='${{ github.sha }}';
 for(const lane of LANES){
  const ownership=contract.lanes[lane];
  const manifest='.vercel/workspace-ci-evidence/lane-'+lane+'.json';
  jobs[lane]={
   'runs-on':base.runner,'timeout-minutes':base.timeout,services:clone(base.services),env:clone(base.env),
   outputs:{provenance:'${{ steps.provenance.outputs.record }}',artifactId:'${{ steps.evidence.outputs.artifact-id }}',artifactDigest:'${{ steps.evidence.outputs.artifact-digest }}'},
   steps:[...clone(setup),
    {name:'Verify exact source, workflow and fresh evidence',run:`node ${script} preflight --lane ${lane} --expected-head "$GITHUB_SHA"`},
    {name:'Pinned Python dependencies',run:'python -m pip install --disable-pip-version-check -r requirements.txt'},
    ...(lane===contract.infrastructureCheck.lane?[clone(contract.infrastructureCheck.step)]:[]),
    ...ownership.blocks.map(id=>clone(contract.blocks.find(block=>block.id===id).step)),
    {name:'Record bounded synthetic provenance',id:'provenance',run:`node ${script} provenance --lane ${lane} --expected-head "$GITHUB_SHA"`},
    {uses:base.uploadAction,id:'evidence',if:'always()',with:{name:'workspace-acceptance-${{ github.run_id }}-${{ github.run_attempt }}-'+lane,path:[...ownership.artifacts,manifest].join('\n')+'\n','include-hidden-files':true,'retention-days':7}}
   ]};
 }
 jobs.workspace={name:'workspace',if:'always()',needs:[...LANES],'runs-on':base.runner,'timeout-minutes':base.timeout,env:clone(base.env),steps:[...clone(setup),
  {name:'Require every lane, artifact and exact provenance',env:Object.fromEntries(LANES.map(lane=>[laneEnvironmentKey(lane),'${{ toJSON(needs.'+lane+') }}'])),run:`node ${script} gate --expected-head "$GITHUB_SHA"`},
  {uses:base.uploadAction,if:'always()',with:{name:'workspace-acceptance-${{ github.run_id }}-${{ github.run_attempt }}-index',path:'.vercel/workspace-ci-evidence/gate.json','include-hidden-files':true,'retention-days':7}}
 ]};
 return {name:base.name,on:clone(base.on),permissions:clone(base.permissions),jobs};
}
export function equivalent(workflow,contract){
 equal(workflow,buildWorkflow(contract),'WORKFLOW_NOT_EQUIVALENT');
 return {blocks:54,artifactPatterns:58,lanes:8};
}
function collect(root,patterns){
 const files=new Map();
 function visit(filename){
  const stat=lstatSync(filename);if(stat.isSymbolicLink())deny('EVIDENCE_SYMLINK');
  const relative=cleanPath(path.relative(root,filename).split(path.sep).join('/'));
  if(!realpathSync(filename).startsWith(realpathSync(root)+path.sep))deny('EVIDENCE_OUTSIDE_ROOT');
  if(stat.isDirectory()){for(const entry of readdirSync(filename).sort())visit(path.join(filename,entry));return;}
  if(!stat.isFile())deny('EVIDENCE_NOT_REGULAR_FILE');
  if(stat.size>64*1024*1024)deny('EVIDENCE_TOO_LARGE');
  files.set(relative,{path:relative,sha256:hash(readFileSync(filename)),bytes:stat.size});
 }
 for(const pattern of patterns){
  if(pattern.endsWith('/')){const filename=path.join(root,pattern);try{lstatSync(filename);}catch(error){if(error.code==='ENOENT')continue;throw error;}visit(filename);}
  else if(pattern.includes('*')){const directory=path.dirname(pattern);let names;try{names=readdirSync(path.join(root,directory));}catch(error){if(error.code==='ENOENT')continue;throw error;}for(const name of names)if(matches(directory+'/'+name,pattern))visit(path.join(root,directory,name));}
  else {const filename=path.join(root,pattern);try{lstatSync(filename);}catch(error){if(error.code==='ENOENT')continue;throw error;}visit(filename);}
 }
 const values=[...files.values()].sort((a,b)=>a.path.localeCompare(b.path));
 if(values.length>2000||values.reduce((n,item)=>n+item.bytes,0)>200*1024*1024)deny('EVIDENCE_LIMIT');
 return values;
}
export function assertFreshEvidence({root,lane,contract}){
 if(!LANES.includes(lane))deny('UNKNOWN_LANE');
 const owner=contract.lanes[lane];
 if(collect(root,[...owner.artifacts,...owner.requiredProducedEvidence]).length)deny('STALE_EVIDENCE');
 return {state:'PASS',lane};
}
function seal(record){return {...record,manifestSha256:hash(JSON.stringify(record)+'\n')};}
function unseal(record){const copy=clone(record);delete copy.manifestSha256;return copy;}
function identity(root,expected){const actual=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();const dirty=execFileSync('git',['diff','--name-only','HEAD','--'],{cwd:root,encoding:'utf8'}).trim();return assertSourceIdentity({actualHead:actual,expectedHead:expected,dirtyTrackedPaths:dirty?dirty.split(/\r?\n/):[]});}
export function canonicalDependencyTextSha256(bytes){
 if(!Buffer.isBuffer(bytes))deny('DEPENDENCY_TEXT_BYTES');
 const text=bytes.toString('utf8');if(!bytes.equals(Buffer.from(text,'utf8')))deny('DEPENDENCY_TEXT_ENCODING');
 return hash(text.replace(/\r\n/g,'\n'));
}
export function assertDependencies({packageLockBytes,requirementsBytes,contract}){
 if(canonicalDependencyTextSha256(packageLockBytes)!==contract.packageLockSha256)deny('PACKAGE_LOCK_CHANGED');
 if(canonicalDependencyTextSha256(requirementsBytes)!==contract.requirementsSha256)deny('PYTHON_REQUIREMENTS_CHANGED');
 return {packageLockSha256:contract.packageLockSha256,requirementsSha256:contract.requirementsSha256};
}
function dependencies(root,contract){return assertDependencies({packageLockBytes:readFileSync(path.join(root,'package-lock.json')),requirementsBytes:readFileSync(path.join(root,'requirements.txt')),contract});}
function clocks(env){if(!positive(env.GITHUB_RUN_ID)||!positive(env.GITHUB_RUN_ATTEMPT))deny('RUN_IDENTITY');return {runId:env.GITHUB_RUN_ID,runAttempt:env.GITHUB_RUN_ATTEMPT};}
export function assertLaneOutputSize(provenance){
 if(typeof provenance!=='string')deny('PROVENANCE_LIMIT');
 const transport={result:'success',outputs:{artifactId:'9'.repeat(64),artifactDigest:'a'.repeat(64),provenance}};
 const bytes=Buffer.byteLength(JSON.stringify(transport));
 if(bytes>LANE_OUTPUT_BYTES)deny('LANE_OUTPUT_TRANSPORT_LIMIT');
 return bytes;
}
export function readLaneNeedsEnvironment(env){
 if(Object.hasOwn(env,'WORKSPACE_NEEDS_JSON'))deny('LEGACY_AGGREGATE_ENV_DENIED');
 const keys=LANES.map(laneEnvironmentKey);
 equal(Object.keys(env).filter(key=>key.startsWith('WORKSPACE_LANE_')).sort(),keys.toSorted(),'LANE_ENV_COVERAGE');
 const needs={};let bytes=0;
 for(const lane of LANES){
  const value=env[laneEnvironmentKey(lane)];
  if(typeof value!=='string'||!value||Buffer.byteLength(value)>LANE_ENV_BYTES)deny('LANE_ENV_LIMIT');
  if(Buffer.from(value,'utf8').toString('utf8')!==value)deny('LANE_ENV_ENCODING');
  bytes+=Buffer.byteLength(value);
  try{needs[lane]=JSON.parse(value);}catch{deny('INVALID_LANE_ENV_JSON');}
  exactKeys(needs[lane],['result','outputs'],'INVALID_LANE_JOB_SHAPE');
 }
 if(bytes>LANES.length*LANE_ENV_BYTES)deny('LANE_ENV_TOTAL_LIMIT');
 return needs;
}
export function provenance({root,lane,contract,expectedHead,workflowSha256,env=process.env}){
 if(!LANES.includes(lane))deny('UNKNOWN_LANE');
 const actual=identity(root,expectedHead),clock=clocks(env),owner=contract.lanes[lane];
 const files=collect(root,owner.artifacts);
 requireEvidence(files,owner.requiredRetainedEvidence,'MISSING_REQUIRED_RETAINED_EVIDENCE');
 const producedNotUploaded=collect(root,owner.requiredProducedEvidence);
 requireEvidence(producedNotUploaded,owner.requiredProducedEvidence,'MISSING_REQUIRED_PRODUCED_EVIDENCE');
 const readSource=gitSource(root,actual),extensionProofBindings=contract.extension.proofs.filter(p=>p.lane===lane).map(spec=>validateExtensionProof(spec,readFileSync(path.join(root,spec.path)),{expectedHead:actual,readSource,readEvidence:file=>readFileSync(path.join(root,cleanPath(file)))}));
 const record=seal({version:2,proofBindings:extensionProofBindings,lane,head:actual,...clock,workflowSha256,contractSha256:EXPECTED_CONTRACT_SHA256,blockIds:[...owner.blocks],commandDigests:owner.blocks.map(id=>contract.blocks.find(block=>block.id===id).commandSha256),artifactPatterns:[...owner.artifacts],requiredRetainedEvidence:[...owner.requiredRetainedEvidence],requiredProducedEvidence:[...owner.requiredProducedEvidence],producedNotUploaded,verifierSha256:verifierSha256(),packageLockSha256:contract.packageLockSha256,requirementsSha256:contract.requirementsSha256,files});
 if(Buffer.byteLength(JSON.stringify(record))>400*1024)deny('PROVENANCE_LIMIT');
 assertLaneOutputSize(JSON.stringify(record));
 return record;
}
export function gate({needs,contract,expectedHead,workflowSha256,runId,runAttempt,readSource}){
 validateContract(contract);if(!head(expectedHead)||!sha(workflowSha256)||!positive(runId)||!positive(runAttempt))deny('EXPECTED_IDENTITY_INVALID');
 if(typeof readSource!=='function')deny('PROOF_SOURCE_RESOLVER');
 exactKeys(needs,LANES,'MISSING_OR_EXTRA_LANE');
 const paths=new Set(),artifacts=new Set();let fileCount=0;
 const records=[];
 for(const lane of LANES){
  const job=needs[lane];if(job?.result!=='success')deny('LANE_NOT_SUCCESS');
  exactKeys(job.outputs,['provenance','artifactId','artifactDigest'],'MISSING_LANE_OUTPUT');
  if(!positive(job.outputs.artifactId)||!sha(job.outputs.artifactDigest))deny('MISSING_ARTIFACT');
  if(artifacts.has(job.outputs.artifactId))deny('ARTIFACT_COLLISION');artifacts.add(job.outputs.artifactId);
  if(typeof job.outputs.provenance!=='string'||Buffer.byteLength(job.outputs.provenance)>400*1024)deny('PROVENANCE_LIMIT');
  let record;try{record=JSON.parse(job.outputs.provenance);}catch{deny('INVALID_PROVENANCE_JSON');}
  exactKeys(record,['version','lane','head','runId','runAttempt','workflowSha256','contractSha256','blockIds','commandDigests','artifactPatterns','requiredRetainedEvidence','requiredProducedEvidence','producedNotUploaded','verifierSha256','packageLockSha256','requirementsSha256','files','proofBindings','manifestSha256'],'INVALID_PROVENANCE_SHAPE');
  if(record.version!==2||record.lane!==lane||record.head!==expectedHead||record.runId!==runId||record.runAttempt!==runAttempt||record.workflowSha256!==workflowSha256||record.contractSha256!==EXPECTED_CONTRACT_SHA256||record.verifierSha256!==verifierSha256()||record.packageLockSha256!==contract.packageLockSha256||record.requirementsSha256!==contract.requirementsSha256)deny('PROVENANCE_IDENTITY');
  if(!sha(record.manifestSha256)||hash(JSON.stringify(unseal(record))+'\n')!==record.manifestSha256)deny('PROVENANCE_DIGEST');
  equal(record.blockIds,contract.lanes[lane].blocks,'BLOCK_COVERAGE');
  equal(record.commandDigests,record.blockIds.map(id=>contract.blocks.find(block=>block.id===id).commandSha256),'COMMAND_DIGEST');
  equal(record.artifactPatterns,contract.lanes[lane].artifacts,'ARTIFACT_PATTERN_COVERAGE');
  if(!Array.isArray(record.files)||!record.files.length||record.files.length>2000)deny('EMPTY_EVIDENCE');
  for(const file of record.files){
   exactKeys(file,['path','sha256','bytes'],'INVALID_EVIDENCE_SHAPE');cleanPath(file.path);
   if(paths.has(file.path))deny('PATH_COLLISION');paths.add(file.path);
   if(!sha(file.sha256)||!Number.isSafeInteger(file.bytes)||file.bytes<0||file.bytes>64*1024*1024)deny('INVALID_EVIDENCE_DIGEST');
   if(!record.artifactPatterns.some(pattern=>matches(file.path,pattern)))deny('PATH_NOT_OWNED');
  }
  equal(record.requiredRetainedEvidence,contract.lanes[lane].requiredRetainedEvidence,'RETAINED_EVIDENCE_CONTRACT');
  equal(record.requiredProducedEvidence,contract.lanes[lane].requiredProducedEvidence,'PRODUCED_EVIDENCE_CONTRACT');
  requireEvidence(record.files,record.requiredRetainedEvidence,'MISSING_REQUIRED_RETAINED_EVIDENCE');
  if(!Array.isArray(record.producedNotUploaded)||record.producedNotUploaded.length!==record.requiredProducedEvidence.length)deny('MISSING_REQUIRED_PRODUCED_EVIDENCE');
  for(const file of record.producedNotUploaded){
   exactKeys(file,['path','sha256','bytes'],'INVALID_EVIDENCE_SHAPE');cleanPath(file.path);
   if(paths.has(file.path))deny('PATH_COLLISION');paths.add(file.path);
   if(!sha(file.sha256)||!Number.isSafeInteger(file.bytes)||file.bytes<0||file.bytes>64*1024*1024)deny('INVALID_EVIDENCE_DIGEST');
   if(!record.requiredProducedEvidence.includes(file.path))deny('PRODUCED_EVIDENCE_NOT_OWNED');
  }
  requireEvidence(record.producedNotUploaded,record.requiredProducedEvidence,'MISSING_REQUIRED_PRODUCED_EVIDENCE');
  if(record.files.reduce((n,item)=>n+item.bytes,0)>200*1024*1024)deny('EVIDENCE_LIMIT');
  assertProofBindings(record.proofBindings,contract,lane,record.files,expectedHead,readSource);
  fileCount+=record.files.length;
  records.push({lane,artifactId:job.outputs.artifactId,artifactDigest:job.outputs.artifactDigest,manifestSha256:record.manifestSha256,fileCount:record.files.length,producedNotUploaded:record.producedNotUploaded,blockIds:record.blockIds,proofBindings:record.proofBindings});
 }
 equal(records.flatMap(record=>record.blockIds).sort((a,b)=>a-b),contract.blocks.map(block=>block.id),'TOTAL_BLOCK_COVERAGE');
 return {version:1,state:'PASS',head:expectedHead,runId,runAttempt,workflowSha256,contractSha256:EXPECTED_CONTRACT_SHA256,verifierSha256:verifierSha256(),packageLockSha256:contract.packageLockSha256,requirementsSha256:contract.requirementsSha256,lanes:records,commandBlocks:54,artifactPatterns:58,requiredRetainedFiles:Object.values(contract.lanes).flatMap(owner=>owner.requiredRetainedEvidence).length,producedNotUploadedFiles:Object.values(contract.lanes).flatMap(owner=>owner.requiredProducedEvidence).length,fileCount};
}
function expectedNeeds(contract,expectedHead,workflowSha256,readSource){
 return Object.fromEntries(LANES.map((lane,i)=>{
  const owner=contract.lanes[lane],file=filename=>({path:filename,sha256:'1'.repeat(64),bytes:128});
  const record=seal({version:2,proofBindings:proofBindings(contract,lane,owner.requiredRetainedEvidence.map(file),expectedHead,readSource),lane,head:expectedHead,runId:'100',runAttempt:'1',workflowSha256,contractSha256:EXPECTED_CONTRACT_SHA256,blockIds:[...owner.blocks],commandDigests:owner.blocks.map(id=>contract.blocks.find(block=>block.id===id).commandSha256),artifactPatterns:[...owner.artifacts],requiredRetainedEvidence:[...owner.requiredRetainedEvidence],requiredProducedEvidence:[...owner.requiredProducedEvidence],producedNotUploaded:owner.requiredProducedEvidence.map(file),verifierSha256:verifierSha256(),packageLockSha256:contract.packageLockSha256,requirementsSha256:contract.requirementsSha256,files:owner.requiredRetainedEvidence.map(file)});
  return [lane,{result:'success',outputs:{provenance:JSON.stringify(record),artifactId:String(i+1),artifactDigest:'2'.repeat(64)}}];
 }));
}
export function selftest(workflow,contract,root=process.cwd()){
 const checks=[];
 function good(name,run){run();checks.push({name,result:'PASS'});}
 function bad(name,code,run){assert.throws(run,error=>error.code===code);checks.push({name,result:'PASS',expectedDenial:code});}
 good('yaml-parsed-and-full-baseline-equivalent',()=>equivalent(workflow,contract));
 const shadowSource=file=>Buffer.from(utf8(readFileSync(path.join(root,sourcePath(file)))).replaceAll('\r\n','\n'));
 const original=buildWorkflow(contract),expectedHead='a'.repeat(40),workflowSha256='b'.repeat(64),needs=expectedNeeds(contract,expectedHead,workflowSha256,shadowSource),input={needs,contract,expectedHead,workflowSha256,runId:'100',runAttempt:'1',readSource:shadowSource};
 bad('gate-source-resolver-required','PROOF_SOURCE_RESOLVER',()=>gate({...input,readSource:undefined}));
 good('gate-all-eight-lanes-and-50-blocks',()=>{assert.equal(contract.blocks.filter(block=>block.id<=56).length,50);assert.equal(gate(input).commandBlocks,54);});
 good('gate-all-eight-lanes-and-additive-KYC-57',()=>assert.equal(gate(input).commandBlocks,54));
 const laneEnv=Object.fromEntries(LANES.map(lane=>[laneEnvironmentKey(lane),JSON.stringify(needs[lane])]));
 good('lane-environment-preserves-exact-eight-records',()=>equal(readLaneNeedsEnvironment({...laneEnv,PATH:'controlled'}),needs,'ENV_TRANSPORT_CHANGED'));
 good('lane-environment-still-runs-exact-gate',()=>assert.equal(gate({...input,needs:readLaneNeedsEnvironment(laneEnv)}).commandBlocks,54));
 bad('legacy-aggregate-environment-denied','LEGACY_AGGREGATE_ENV_DENIED',()=>readLaneNeedsEnvironment({...laneEnv,WORKSPACE_NEEDS_JSON:JSON.stringify(needs)}));
 const missingEnv={...laneEnv};delete missingEnv.WORKSPACE_LANE_META_JSON;
 bad('missing-lane-environment-denied','LANE_ENV_COVERAGE',()=>readLaneNeedsEnvironment(missingEnv));
 bad('extra-lane-environment-denied','LANE_ENV_COVERAGE',()=>readLaneNeedsEnvironment({...laneEnv,WORKSPACE_LANE_UNKNOWN_JSON:'{}'}));
 bad('invalid-lane-environment-json-denied','INVALID_LANE_ENV_JSON',()=>readLaneNeedsEnvironment({...laneEnv,WORKSPACE_LANE_META_JSON:'{'}));
 bad('empty-lane-environment-denied','LANE_ENV_LIMIT',()=>readLaneNeedsEnvironment({...laneEnv,WORKSPACE_LANE_META_JSON:''}));
 bad('non-string-lane-environment-denied','LANE_ENV_LIMIT',()=>readLaneNeedsEnvironment({...laneEnv,WORKSPACE_LANE_META_JSON:17}));
 bad('null-lane-job-denied','INVALID_LANE_JOB_SHAPE',()=>readLaneNeedsEnvironment({...laneEnv,WORKSPACE_LANE_META_JSON:'null'}));
 bad('array-lane-job-denied','INVALID_LANE_JOB_SHAPE',()=>readLaneNeedsEnvironment({...laneEnv,WORKSPACE_LANE_META_JSON:'[]'}));
 bad('extra-lane-job-field-denied','INVALID_LANE_JOB_SHAPE',()=>readLaneNeedsEnvironment({...laneEnv,WORKSPACE_LANE_META_JSON:JSON.stringify({...needs.meta,extra:true})}));
 bad('oversized-lane-environment-denied','LANE_ENV_LIMIT',()=>readLaneNeedsEnvironment({...laneEnv,WORKSPACE_LANE_META_JSON:'x'.repeat(LANE_ENV_BYTES+1)}));
 bad('invalid-lane-environment-unicode-denied','LANE_ENV_ENCODING',()=>readLaneNeedsEnvironment({...laneEnv,WORKSPACE_LANE_META_JSON:'"\ud800"'}));
 good('lane-output-size-bounds-every-fixture',()=>{
  for(const lane of LANES)assert.ok(assertLaneOutputSize(needs[lane].outputs.provenance)<LANE_OUTPUT_BYTES);
  const overhead=assertLaneOutputSize(''),boundary='x'.repeat(92*1024-overhead);
  assert.equal(assertLaneOutputSize(boundary),92*1024);
  assert.throws(()=>assertLaneOutputSize(boundary+'x'),error=>error.code==='LANE_OUTPUT_TRANSPORT_LIMIT');
  assert.throws(()=>assertLaneOutputSize('ñ'.repeat(46*1024)),error=>error.code==='LANE_OUTPUT_TRANSPORT_LIMIT');
  const padded={...laneEnv},key=laneEnvironmentKey('people');padded[key]+=' '.repeat(96*1024-Buffer.byteLength(padded[key]));
  equal(readLaneNeedsEnvironment(padded),needs,'PADDED_LANE_ENVIRONMENT');
  assert.ok(Buffer.byteLength(key+'='+padded[key])+1<128*1024);
  assert.throws(()=>readLaneNeedsEnvironment({...padded,[key]:padded[key]+' '}),error=>error.code==='LANE_ENV_LIMIT');
 });
 bad('oversized-output-blocked-before-github-output','LANE_OUTPUT_TRANSPORT_LIMIT',()=>assertLaneOutputSize('x'.repeat(LANE_OUTPUT_BYTES)));
 bad('escaped-output-size-uses-wire-bytes','LANE_OUTPUT_TRANSPORT_LIMIT',()=>assertLaneOutputSize('"'.repeat(LANE_OUTPUT_BYTES/2)));
 bad('non-string-output-size-denied','PROVENANCE_LIMIT',()=>assertLaneOutputSize(null));
 for(const result of ['failure','cancelled','skipped']){const n=clone(needs);n.people.result=result;bad('gate-'+result,'LANE_NOT_SUCCESS',()=>gate({...input,needs:n}));}
 let n=clone(needs);delete n.meta;bad('missing-lane','MISSING_OR_EXTRA_LANE',()=>gate({...input,needs:n}));
 n=clone(needs);n.unexpected=n.meta;bad('extra-lane','MISSING_OR_EXTRA_LANE',()=>gate({...input,needs:n}));
 n=clone(needs);n.meta.outputs.artifactId='';bad('missing-artifact','MISSING_ARTIFACT',()=>gate({...input,needs:n}));
 n=clone(needs);delete n.meta.outputs.provenance;bad('missing-output','MISSING_LANE_OUTPUT',()=>gate({...input,needs:n}));
 n=clone(needs);n.meta.outputs.artifactDigest='';bad('missing-artifact-digest','MISSING_ARTIFACT',()=>gate({...input,needs:n}));
 n=clone(needs);n.meta.outputs.artifactId=n.contracts.outputs.artifactId;bad('artifact-id-collision','ARTIFACT_COLLISION',()=>gate({...input,needs:n}));
 function altered(name,code,edit){const n=clone(needs),r=JSON.parse(n.people.outputs.provenance);edit(r);delete r.manifestSha256;n.people.outputs.provenance=JSON.stringify(seal(r));bad(name,code,()=>gate({...input,needs:n}));}
 altered('wrong-source-sha','PROVENANCE_IDENTITY',r=>{r.head='c'.repeat(40);});
 altered('wrong-workflow-sha','PROVENANCE_IDENTITY',r=>{r.workflowSha256='c'.repeat(64);});
 altered('wrong-contract-sha','PROVENANCE_IDENTITY',r=>{r.contractSha256='c'.repeat(64);});
 altered('wrong-run','PROVENANCE_IDENTITY',r=>{r.runId='101';});
 altered('old-attempt','PROVENANCE_IDENTITY',r=>{r.runAttempt='2';});
 altered('omitted-block','BLOCK_COVERAGE',r=>{r.blockIds.pop();});
 altered('duplicate-block','BLOCK_COVERAGE',r=>{r.blockIds.push(r.blockIds[0]);});
 altered('changed-command','COMMAND_DIGEST',r=>{r.commandDigests[0]='3'.repeat(64);});
 altered('omitted-artifact-pattern','ARTIFACT_PATTERN_COVERAGE',r=>{r.artifactPatterns.pop();});
 altered('omitted-evidence-file','MISSING_REQUIRED_RETAINED_EVIDENCE',r=>{r.files.pop();});
 altered('empty-evidence','EMPTY_EVIDENCE',r=>{r.files=[];});
 altered('invalid-file-digest','INVALID_EVIDENCE_DIGEST',r=>{r.files[0].sha256='';});
 altered('oversized-file','INVALID_EVIDENCE_DIGEST',r=>{r.files[0].bytes=64*1024*1024+1;});
 altered('duplicate-evidence-path','PATH_COLLISION',r=>{r.files.push(clone(r.files[0]));});
 altered('foreign-artifact-path','PATH_NOT_OWNED',r=>{r.files[0].path='.vercel/private/foreign.json';});
 altered('traversal-relative','UNSAFE_PATH',r=>{r.files[0].path='.vercel/private/../foreign.json';});
 altered('traversal-absolute','UNSAFE_PATH',r=>{r.files[0].path='/tmp/foreign.json';});
 altered('traversal-backslash','UNSAFE_PATH',r=>{r.files[0].path='C:\\private\\foreign.json';});
 n=clone(needs);n.people.outputs.provenance='{}';bad('empty-provenance','INVALID_PROVENANCE_SHAPE',()=>gate({...input,needs:n}));
 n=clone(needs);let r=JSON.parse(n.people.outputs.provenance);r.files[0].bytes++;n.people.outputs.provenance=JSON.stringify(r);bad('unsealed-provenance-change','PROVENANCE_DIGEST',()=>gate({...input,needs:n}));
 for(const [name,edit] of [
  ['omitted-workflow-block',w=>{w.jobs.people.steps.splice(6,1);}],
  ['duplicate-workflow-block',w=>{w.jobs.people.steps.splice(6,0,clone(w.jobs.people.steps[6]));}],
  ['changed-workflow-command',w=>{w.jobs.plans.steps[6].run+='\ntrue';}],
  ['changed-service',w=>{w.jobs.field.services.postgres.image='postgres:latest';}],
  ['changed-trigger',w=>{w.on.push.branches=['master'];}],
  ['missing-needed-lane',w=>{w.jobs.workspace.needs.pop();}],
  ['always-green-gate',w=>{w.jobs.workspace.steps[4].run='true';}],
  ['changed-upload-path',w=>{w.jobs.channels.steps.at(-1).with.path+='.vercel/private/**\n';}]
 ]){const w=clone(original);edit(w);bad(name,'WORKFLOW_NOT_EQUIVALENT',()=>equivalent(w,contract));}
 good('all-three-optional-PNG-patterns-absent',()=>assert.equal(gate(input).state,'PASS'));
 for(const lane of LANES)for(const pattern of contract.lanes[lane].optionalArtifactPatterns.filter(pattern=>!PORTFOLIO_ARTIFACTS.includes(pattern))){
  const n=clone(needs),r=JSON.parse(n[lane].outputs.provenance);
  r.files.push({path:pattern.replaceAll('*','fixture'),sha256:'4'.repeat(64),bytes:128});
  delete r.manifestSha256;n[lane].outputs.provenance=JSON.stringify(seal(r));
  good('optional-PNG-present-'+lane,()=>assert.equal(gate({...input,needs:n}).state,'PASS'));
 }
 for(const lane of LANES)for(const filename of contract.lanes[lane].requiredRetainedEvidence.filter(filename=>!isPortfolioEvidence(filename))){
  const n=clone(needs),r=JSON.parse(n[lane].outputs.provenance);
  r.files=r.files.filter(file=>file.path!==filename);
  if(!r.files.length){const owned=contract.lanes[lane].artifacts.find(pattern=>pattern.endsWith('/'));if(owned)r.files.push({path:owned+'diagnostic.json',sha256:'4'.repeat(64),bytes:128});}
  delete r.manifestSha256;n[lane].outputs.provenance=JSON.stringify(seal(r));
   const historicalEmpty=lane==='contracts'&&filename==='.vercel/private/biometric-real-model-proof.json';
   bad((historicalEmpty?'missing-main-proof-with-other-artifact-':'missing-main-proof-')+lane+'-'+filename,r.files.length?'MISSING_REQUIRED_RETAINED_EVIDENCE':'EMPTY_EVIDENCE',()=>gate({...input,needs:n}));
   if(historicalEmpty){const prior=clone(needs),empty=JSON.parse(prior[lane].outputs.provenance);empty.files=[];delete empty.manifestSha256;prior[lane].outputs.provenance=JSON.stringify(seal(empty));bad('missing-main-proof-'+lane+'-'+filename,'EMPTY_EVIDENCE',()=>gate({...input,needs:prior}));}
 }
 for(const lane of LANES)for(const filename of contract.lanes[lane].requiredProducedEvidence){
  const n=clone(needs),r=JSON.parse(n[lane].outputs.provenance);
  r.producedNotUploaded=r.producedNotUploaded.filter(file=>file.path!==filename);
  delete r.manifestSha256;n[lane].outputs.provenance=JSON.stringify(seal(r));
  bad('missing-produced-not-uploaded-'+filename,'MISSING_REQUIRED_PRODUCED_EVIDENCE',()=>gate({...input,needs:n}));
 }
 altered('required-retained-list-omitted','RETAINED_EVIDENCE_CONTRACT',r=>{r.requiredRetainedEvidence.pop();});
 altered('required-produced-list-omitted','PRODUCED_EVIDENCE_CONTRACT',r=>{r.requiredProducedEvidence.pop();});
 altered('wrong-helper-digest','PROVENANCE_IDENTITY',r=>{r.verifierSha256='c'.repeat(64);});
 altered('wrong-package-lock-digest','PROVENANCE_IDENTITY',r=>{r.packageLockSha256='c'.repeat(64);});
 altered('wrong-python-requirements-digest','PROVENANCE_IDENTITY',r=>{r.requirementsSha256='c'.repeat(64);});
 altered('produced-file-foreign','PRODUCED_EVIDENCE_NOT_OWNED',r=>{r.producedNotUploaded[0].path='.vercel/foreign-produced.json';});
 for(const file of ['scripts/verify-participants-ui.mjs','src/lib/field-operations-store.mjs','AGENTS.md']){
  bad('dirty-tracked-source-'+file,'TRACKED_SOURCE_DIRTY',()=>assertSourceIdentity({expectedHead,actualHead:expectedHead,dirtyTrackedPaths:[file]}));
 }
 bad('dirty-staged-source','TRACKED_SOURCE_DIRTY',()=>assertSourceIdentity({expectedHead,actualHead:expectedHead,dirtyTrackedPaths:['src/lib/verified-session.mjs']}));
 bad('source-HEAD-mismatch-before-provenance','SOURCE_HEAD_MISMATCH',()=>assertSourceIdentity({expectedHead,actualHead:'c'.repeat(40),dirtyTrackedPaths:[]}));
 good('clean-source-identity',()=>assert.equal(assertSourceIdentity({expectedHead,actualHead:expectedHead,dirtyTrackedPaths:[]}),expectedHead));
 const wrongLane=clone(contract),wa='.vercel/customer-whatsapp-evidence/';
 wrongLane.lanes.meta.artifacts=wrongLane.lanes.meta.artifacts.filter(pattern=>pattern!==wa);
 wrongLane.lanes['workspace-ui'].artifacts.push(wa);
 bad('wrong-upload-lane-for-canonical-producer','RETAINED_EVIDENCE_NOT_OWNED',()=>validateContract(wrongLane));
 const wrongProducer=clone(contract);wrongProducer.evidenceProducers[0].producer='scripts/verify-workspace-ui.mjs';
 bad('wrong-principal-proof-producer','EVIDENCE_PRODUCER_COVERAGE',()=>validateContract(wrongProducer));
 const overtimeProducers=contract.evidenceProducers.filter(producer=>producer.blockId===52);
 good('overtime-block-52-three-canonical-proofs',()=>{
  equal(overtimeProducers.map(producer=>({path:producer.path,lane:producer.lane,retained:producer.retained})),[
   {path:'.vercel/private/field-overtime-unit-proof.json',lane:'field',retained:true},
   {path:'.vercel/private/field-overtime-postgres-proof.json',lane:'field',retained:true},
   {path:'.vercel/private/field-overtime-ui-proof.json',lane:'field',retained:true}
  ],'OVERTIME_PRODUCER_CONTRACT');
  equal(contract.lanes.field.blocks,[20,39,40,52],'OVERTIME_BLOCK_ASSIGNMENT');
 });
 for(const [name,code,edit] of [
  ['omitted','CONTRACT_BLOCKS',c=>{c.blocks=c.blocks.filter(block=>block.id!==52);}],
  ['duplicate','CONTRACT_BLOCKS',c=>{c.blocks.push(clone(c.blocks.find(block=>block.id===52)));}],
  ['duplicate-assignment','CONTRACT_COVERAGE',c=>{c.lanes.field.blocks.push(52);}],
  ['foreign-lane','EVIDENCE_PRODUCER_COVERAGE',c=>{c.lanes.field.blocks=c.lanes.field.blocks.filter(id=>id!==52);c.lanes.meta.blocks.push(52);}],
  ['changed-command','CONTRACT_COMMAND',c=>{c.blocks.find(block=>block.id===52).step.run+='\ntrue';}]
 ]){const c=clone(contract);edit(c);bad('overtime-52-'+name,code,()=>validateContract(c));}
 function alteredField(name,code,edit){const n=clone(needs),r=JSON.parse(n.field.outputs.provenance);edit(r);delete r.manifestSha256;n.field.outputs.provenance=JSON.stringify(seal(r));bad(name,code,()=>gate({...input,needs:n}));}
 alteredField('overtime-52-omitted-from-provenance','BLOCK_COVERAGE',r=>{r.blockIds=r.blockIds.filter(id=>id!==52);});
 alteredField('overtime-52-duplicate-in-provenance','BLOCK_COVERAGE',r=>{r.blockIds.push(52);});
 alteredField('overtime-52-command-digest-changed','COMMAND_DIGEST',r=>{r.commandDigests[r.blockIds.indexOf(52)]='3'.repeat(64);});
 for(const producer of overtimeProducers){
  const omitted=clone(contract);omitted.evidenceProducers=omitted.evidenceProducers.filter(item=>item.path!==producer.path);
  bad('overtime-producer-omitted-'+producer.path,'EVIDENCE_PRODUCER_COVERAGE',()=>validateContract(omitted));
  const notRetained=clone(contract);notRetained.evidenceProducers.find(item=>item.path===producer.path).retained=false;
  bad('overtime-producer-not-retained-'+producer.path,'RETAINED_PRODUCER_COVERAGE',()=>validateContract(notRetained));
  const foreign=clone(contract);foreign.evidenceProducers.find(item=>item.path===producer.path).lane='meta';
  bad('overtime-producer-foreign-lane-'+producer.path,'EVIDENCE_PRODUCER_COVERAGE',()=>validateContract(foreign));
  const colliding=clone(contract);colliding.evidenceProducers.find(item=>item.path===producer.path).path=contract.evidenceProducers[0].path;
  bad('overtime-producer-path-collision-'+producer.path,'DUPLICATE_REQUIRED_EVIDENCE',()=>validateContract(colliding));
 }
 const packageLf=Buffer.from('{"controlledLock":1}\n'),requirementsLf=Buffer.from('controlled-fixture==1.0\n');
 const fixtureContract={packageLockSha256:hash(packageLf),requirementsSha256:hash(requirementsLf)};
 const fixtureDependencies={packageLockBytes:packageLf,requirementsBytes:requirementsLf,contract:fixtureContract};
 good('canonical-dependencies-LF-accepted',()=>equal(assertDependencies(fixtureDependencies),fixtureContract,'DEPENDENCY_FIXTURE_RESULT'));
 good('canonical-dependencies-CRLF-accepted',()=>equal(assertDependencies({...fixtureDependencies,packageLockBytes:Buffer.from(packageLf.toString().replaceAll('\n','\r\n')),requirementsBytes:Buffer.from(requirementsLf.toString().replaceAll('\n','\r\n'))}),fixtureContract,'DEPENDENCY_FIXTURE_RESULT'));
 bad('dependency-package-content-altered','PACKAGE_LOCK_CHANGED',()=>assertDependencies({...fixtureDependencies,packageLockBytes:Buffer.from('{"controlledLock":2}\n')}));
 bad('dependency-requirements-content-altered','PYTHON_REQUIREMENTS_CHANGED',()=>assertDependencies({...fixtureDependencies,requirementsBytes:Buffer.from('controlled-fixture==2.0\n')}));
 bad('dependency-invalid-UTF8-denied','DEPENDENCY_TEXT_ENCODING',()=>assertDependencies({...fixtureDependencies,packageLockBytes:Buffer.from([0xff])}));
 bad('dependency-lone-CR-is-content','PACKAGE_LOCK_CHANGED',()=>assertDependencies({...fixtureDependencies,packageLockBytes:Buffer.from(packageLf.toString().replaceAll('\n','\r'))}));
 bad('dependency-BOM-is-content','PACKAGE_LOCK_CHANGED',()=>assertDependencies({...fixtureDependencies,packageLockBytes:Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),packageLf])}));
 const parent=path.resolve(root,'.vercel/workspace-ci-evidence');
 mkdirSync(parent,{recursive:true});
 const fixture=mkdtempSync(path.join(parent,'ci-gate-selftest-fixture-'));
 const ownedFile=relative=>{cleanPath(relative);const filename=path.resolve(fixture,relative);assert.ok(filename.startsWith(fixture+path.sep));return filename;};
 try{
  good('filesystem-preflight-clean-retained-and-produced',()=>assert.equal(assertFreshEvidence({root:fixture,lane:'people',contract}).state,'PASS'));
  for(const lane of LANES)for(const filename of contract.lanes[lane].requiredProducedEvidence){
   const target=ownedFile(filename);mkdirSync(path.dirname(target),{recursive:true});writeFileSync(target,'controlled stale evidence; not a real producer proof');
   bad('filesystem-preflight-stale-produced-'+filename,'STALE_EVIDENCE',()=>assertFreshEvidence({root:fixture,lane,contract}));
   rmSync(target);
  }
  const retained=ownedFile(contract.lanes.people.requiredRetainedEvidence[0]);mkdirSync(path.dirname(retained),{recursive:true});writeFileSync(retained,'controlled stale retained evidence');
  bad('filesystem-preflight-stale-main-retained','STALE_EVIDENCE',()=>assertFreshEvidence({root:fixture,lane:'people',contract}));
  rmSync(retained);
  for(const producer of overtimeProducers){
   const target=ownedFile(producer.path);mkdirSync(path.dirname(target),{recursive:true});writeFileSync(target,'controlled stale overtime proof');
   bad('filesystem-preflight-stale-overtime-'+producer.path,'STALE_EVIDENCE',()=>assertFreshEvidence({root:fixture,lane:'field',contract}));
   rmSync(target);
  }
 }finally{
  const resolved=path.resolve(fixture);assert.ok(resolved.startsWith(parent+path.sep)&&path.basename(resolved).startsWith('ci-gate-selftest-fixture-'));
  rmSync(resolved,{recursive:true,force:true});
 }
  for(const spec of contract.extension.proofs.filter(spec=>!isPortfolio(spec)&&!isIdentity(spec)&&!isCanonicalField(spec))){
   for(const [name,code,edit] of [
    ['binding-omitted','PROOF_BINDINGS',r=>{r.proofBindings=r.proofBindings.filter(b=>b.id!==spec.id);}],
    ['binding-head','PROOF_BINDING_IDENTITY',r=>{r.proofBindings.find(b=>b.id===spec.id).sourceRevision='f'.repeat(40);}],
    ['binding-proof-digest','PROOF_BINDING_IDENTITY',r=>{r.proofBindings.find(b=>b.id===spec.id).proofSha256='f'.repeat(64);}],
    ['binding-source-manifest','PROOF_BINDING_SOURCE',r=>{r.proofBindings.find(b=>b.id===spec.id).sourceManifestSha256='invalid';}],
    ['binding-source-manifest-valid64-wrong','PROOF_BINDING_SOURCE',r=>{r.proofBindings.find(b=>b.id===spec.id).sourceManifestSha256='f'.repeat(64);}],
    ['binding-harness','PROOF_BINDING_IDENTITY',r=>{r.proofBindings.find(b=>b.id===spec.id).harnessSha256='f'.repeat(64);}],
    ['binding-checks','PROOF_BINDING_IDENTITY',r=>{r.proofBindings.find(b=>b.id===spec.id).checks=0;}]
   ]){if(spec.kind==='UI_CAUSAL'&&name==='binding-checks')continue;const n=clone(needs),r=JSON.parse(n[spec.lane].outputs.provenance);edit(r);delete r.manifestSha256;n[spec.lane].outputs.provenance=JSON.stringify(seal(r));bad(spec.id+'-'+name,code,()=>gate({...input,needs:n}));}
   bad(spec.id+'-current-source-bytes-tampered','PROOF_BINDING_SOURCE',()=>gate({...input,readSource:file=>file===spec.sourceFiles[0]?Buffer.concat([shadowSource(file),Buffer.from('altered shadow source')]):shadowSource(file)}));
   const changedPath=clone(contract);changedPath.extension.proofs.find(p=>p.id===spec.id).sourceFiles[0]=spec.producer;bad(spec.id+'-current-source-path-tampered','PROOF_BINDING_SOURCE',()=>gate({...input,contract:changedPath}));
  }
  for(const id of [53,54,55,56,57])for(const [name,code,edit] of [
   ['omitted','CONTRACT_BLOCKS',c=>{c.blocks=c.blocks.filter(b=>b.id!==id);}],
   ['duplicate','CONTRACT_BLOCKS',c=>{c.blocks.push(clone(c.blocks.find(b=>b.id===id)));}],
   ['command-changed','CONTRACT_COMMAND',c=>{c.blocks.find(b=>b.id===id).step.run+='\ntrue';}]
  ]){const c=clone(contract);edit(c);bad('extension-block-'+id+'-'+name,code,()=>validateContract(c));}
  const changedBaseline=clone(contract);changedBaseline.blocks[0].step.run+='\ntrue';changedBaseline.blocks[0].commandSha256=hash(changedBaseline.blocks[0].step.run);bad('old-block-changed-with-recomputed-digest','BASELINE_BLOCKS_CHANGED',()=>validateContract(changedBaseline));
  const freshFixture=mkdtempSync(path.join(parent,'ci-bank-intake-selftest-fixture-'));
  try{for(const spec of contract.extension.proofs.filter(spec=>!isPortfolio(spec)&&!isIdentity(spec)&&!isCanonicalField(spec))){const filename=path.join(freshFixture,spec.path);mkdirSync(path.dirname(filename),{recursive:true});writeFileSync(filename,'shadow stale evidence\n');bad(spec.id+'-stale-main-before-execution','STALE_EVIDENCE',()=>assertFreshEvidence({root:freshFixture,lane:spec.lane,contract}));rmSync(filename);}}
  finally{const resolved=path.resolve(freshFixture);assert.ok(path.dirname(resolved)===path.resolve(parent)&&path.basename(resolved).startsWith('ci-bank-intake-selftest-fixture-'));rmSync(resolved,{recursive:true,force:true});}
  const currentCompanyChecks=[];checks.push(...extensionSelftest(contract,root,currentCompanyChecks));checks.push(...portfolioSelftest(workflow,contract,root));for(const run of currentCompanyChecks)checks.push(...run());checks.push(...identitySelftest(workflow,contract,root));checks.push(...canonicalFieldSelftest(workflow,contract,root));return checks;
}
function canonicalFieldSelftest(workflow,contract,root){
 const checks=[],expectedHead=contract.extension.baseHead,cache=new Map();
 const readSource=file=>{if(!cache.has(file))cache.set(file,Buffer.from(utf8(readFileSync(path.join(root,sourcePath(file)))).replaceAll('\r\n','\n')));return cache.get(file);};
 const good=(name,run)=>{run();checks.push({name,result:'PASS',boundary:'pure canonical field shadow fixture; no Git/PG/UI/provider execution'});};
 const bad=(name,code,run)=>{assert.throws(run,error=>error.code===code);checks.push({name,result:'PASS',expectedDenial:code,boundary:'pure canonical field shadow fixture'});};
 const workflowSha256=hash(canonical(workflow)),needs=expectedNeeds(contract,expectedHead,workflowSha256,readSource),input={needs,contract,expectedHead,workflowSha256,runId:'100',runAttempt:'1',readSource};
 for(const spec of contract.extension.proofs.filter(isCanonicalField)){
  const sets=canonicalFieldSourceSets(spec,readSource),map=files=>Object.fromEntries(files.map(file=>[file,hash(readSource(file))]));
  const fixture={records:[{projectId:'p-shadow',workerId:'w-shadow',submissionId:'kyc-shadow',submissionReceiptId:'participant_'+'1'.repeat(64),reviewReceiptId:'participant_'+'2'.repeat(64),actorId:'worker',reviewerActorId:'reviewer',contentHash:'3'.repeat(64),canonicalAdmissionConfirmed:true,identityCertified:false,providerCalls:0}],syntheticPrivateCalls:{privatePuts:2,privateReads:6},providerCalls:0,biometricIdentityCertified:false};
  const proof={status:'PASS',harnessSha256:spec.producerSha256,providerCalls:0,participantKycFixture:fixture};
  if(spec.kind==='PG_FIELD'){
   for(const [key,files] of Object.entries(sets)){if(key==='fixture')fixture.sourceSha256=map(files);else proof[key]=map(files);}
   for(const [group,countKey,count] of FIELD_CHECK_GROUPS){proof[group]=spec.checkNames.map(row=>JSON.parse(row)).filter(row=>row.group===group).map(row=>row.name);proof[countKey]=count;}
   Object.assign(proof,{environment:'disposable-local-postgresql17',databaseEngineVersion:'17.6',databaseRemoved:true,totalChecks:66,productionDataWritten:false,reviewPaginationProviderCalls:0,voiceProgressProviderCalls:0,mediaLeaseProviderCalls:0,videoAudioProviderCalls:0,physicalAttendanceAccepted:false,whatsAppTested:false,videoAudioFfmpegExecuted:false});
  }else Object.assign(proof,{environment:'disposable-random-schema-on-approved-local-postgres',schema:'obrasaas_overtime_'+'a'.repeat(32),disposableSchemaRemoved:true,realBusinessDatabaseUsed:false,newOvertimeEnum:false,paymentEngineUsed:false,humanAccepted:false,sqlFailures:[],checks:[...spec.checkNames],sourceManifest:sets.sourceManifest.map(file=>({file,sha256:hash(readSource(file))}))});
  const validate=value=>validateExtensionProof(spec,Buffer.from(JSON.stringify(value)),{expectedHead,readSource}),mutate=(name,code,edit)=>{const value=clone(proof);edit(value);bad(spec.id+'-'+name,code,()=>validate(value));};
  good(spec.id+'-complete-current-proof',()=>assert.equal(validate(proof).checks,spec.kind==='PG_FIELD'?66:29));
  good(spec.id+'-current-manifest-closure-exact',()=>equal(currentProducerSourceFiles(spec,root),spec.sourceFiles.toSorted(),'PROOF_SOURCE_MANIFEST'));
  bad(spec.id+'-invalid-json','PROOF_JSON',()=>validateExtensionProof(spec,Buffer.from('{'),{expectedHead,readSource}));
  mutate('wrong-status','PROOF_STATUS',p=>{p.status='FAIL';});mutate('wrong-producer','PROOF_HARNESS_SOURCE',p=>{p.harnessSha256='f'.repeat(64);});
  mutate('wrong-head','PROOF_SOURCE_HEAD',p=>{p.sourceRevision='f'.repeat(40);});mutate('real-database','PROOF_PRODUCTION_BOUNDARY',p=>{if(spec.kind==='PG_FIELD')p.productionDataWritten=true;else p.realBusinessDatabaseUsed=true;});
  mutate('provider-call','PROOF_PROVIDER_IO',p=>{p.providerCalls=1;});mutate('fixture-provider-call','PROOF_PROVIDER_IO',p=>{p.participantKycFixture.providerCalls=1;});mutate('claims-biometric-certification','PROOF_PROVIDER_IO',p=>{p.participantKycFixture.biometricIdentityCertified=true;});
  mutate('fixture-no-records','PROOF_FIELD_KYC_FIXTURE',p=>{p.participantKycFixture.records=[];});mutate('fixture-private-calls-forged','PROOF_FIELD_KYC_FIXTURE',p=>{p.participantKycFixture.syntheticPrivateCalls.privateReads++;});
  for(const [key,value] of [['canonicalAdmissionConfirmed',false],['identityCertified',true],['providerCalls',1],['contentHash','not-a-sha256'],['reviewerActorId','worker'],['reviewReceiptId','missing'],['submissionReceiptId','missing']])mutate('fixture-record-'+key,'PROOF_FIELD_KYC_FIXTURE',p=>{p.participantKycFixture.records[0][key]=value;});
  for(const file of spec.sourceFiles){
   mutate('source-omitted-'+file,'PROOF_SOURCE_MANIFEST',p=>{if(spec.kind==='PG_FIELD'){for(const key of Object.keys(sets)){const source=key==='fixture'?p.participantKycFixture.sourceSha256:p[key];delete source[file];}}else p.sourceManifest=p.sourceManifest.filter(ref=>ref.file!==file);});
   mutate('source-hash-altered-'+file,'PROOF_SOURCE_HASH',p=>{if(spec.kind==='PG_FIELD'){for(const key of Object.keys(sets)){const source=key==='fixture'?p.participantKycFixture.sourceSha256:p[key];if(Object.hasOwn(source,file))source[file]='f'.repeat(64);}}else p.sourceManifest.find(ref=>ref.file===file).sha256='f'.repeat(64);});
  }
  if(spec.kind==='PG_FIELD'){
   mutate('legacy63-total','PROOF_CHECK_NAMES',p=>{p.totalChecks=63;});mutate('cleanup','PROOF_CLEANUP',p=>{p.databaseRemoved=false;});mutate('external-engine','PROOF_CLEANUP',p=>{p.environment='external-postgresql';});
   for(const [group,countKey] of FIELD_CHECK_GROUPS){mutate('group-omitted-'+group,'PROOF_CHECK_NAMES',p=>{delete p[group];});mutate('group-short-'+group,'PROOF_CHECK_NAMES',p=>{p[group].pop();});mutate('group-count-'+countKey,'PROOF_CHECK_NAMES',p=>{p[countKey]--;});mutate('group-name-'+group,'PROOF_CHECK_NAMES',p=>{p[group][0]='changed control';});}
   for(const key of ['reviewPaginationProviderCalls','voiceProgressProviderCalls','mediaLeaseProviderCalls','videoAudioProviderCalls'])mutate('provider-'+key,'PROOF_PROVIDER_IO',p=>{p[key]=1;});
   for(const key of ['physicalAttendanceAccepted','whatsAppTested','videoAudioFfmpegExecuted'])mutate('acceptance-'+key,'PROOF_PROVIDER_IO',p=>{p[key]=true;});
   mutate('map-single-source-omitted','PROOF_FIELD_SOURCE_MAP',p=>{delete p.sourceSha256['src/lib/workspace-store.mjs'];});mutate('conflicting-source-maps','PROOF_FIELD_SOURCE_MAP',p=>{p.sourceSha256['src/lib/workspace-store.mjs']='f'.repeat(64);});mutate('injected-manifest','PROOF_FIELD_SOURCE_MAP',p=>{p.sourceManifest=[];});
  }else{
   mutate('cleanup','PROOF_CLEANUP',p=>{p.disposableSchemaRemoved=false;});mutate('external-schema','PROOF_CLEANUP',p=>{p.schema='business';});mutate('external-engine','PROOF_CLEANUP',p=>{p.environment='external-postgresql';});
   for(const key of ['newOvertimeEnum','paymentEngineUsed','humanAccepted'])mutate('acceptance-'+key,'PROOF_PROVIDER_IO',p=>{p[key]=true;});
   mutate('SQL-failure','PROOF_SQL_ERRORS',p=>{p.sqlFailures=['shadow SQL failure'];});mutate('legacy-checks-short','PROOF_CHECK_NAMES',p=>{p.checks.pop();});mutate('legacy-checks-duplicate','PROOF_CHECK_NAMES',p=>{p.checks[0]=p.checks[1];});mutate('source-extra-attribute','PROOF_SOURCE_REFERENCE',p=>{p.sourceManifest[0].path=p.sourceManifest[0].file;});
  }
  for(const [name,code,edit] of [
   ['binding-omitted','PROOF_BINDINGS',r=>{r.proofBindings=r.proofBindings.filter(b=>b.id!==spec.id);}],
   ['binding-source','PROOF_BINDING_SOURCE',r=>{r.proofBindings.find(b=>b.id===spec.id).sourceManifestSha256='f'.repeat(64);}],
   ['binding-harness','PROOF_BINDING_IDENTITY',r=>{r.proofBindings.find(b=>b.id===spec.id).harnessSha256='f'.repeat(64);}],
   ['binding-checks','PROOF_BINDING_IDENTITY',r=>{r.proofBindings.find(b=>b.id===spec.id).checks=0;}],
   ['evidence-omitted','MISSING_REQUIRED_RETAINED_EVIDENCE',r=>{r.files=r.files.filter(f=>f.path!==spec.path);}]
  ]){const value=clone(needs),record=JSON.parse(value[spec.lane].outputs.provenance);edit(record);delete record.manifestSha256;value[spec.lane].outputs.provenance=JSON.stringify(seal(record));bad(spec.id+'-'+name,code,()=>gate({...input,needs:value}));}
  const changed=clone(contract);changed.evidenceProducers.find(record=>record.path===spec.path).baselineProducerGitBlobSha256=spec.producerSha256;bad(spec.id+'-historical-record-not-overwritten','EXTENSION_PRODUCER_CONTRACT',()=>validateContract(changed));
  const omitted=clone(contract);omitted.extension.proofs=omitted.extension.proofs.filter(p=>p.id!==spec.id);bad(spec.id+'-typed-proof-not-optional','EXTENSION_PROOF_COVERAGE',()=>validateContract(omitted));
  const parent=path.resolve(root,'.vercel/workspace-ci-evidence'),scratch=mkdtempSync(path.join(parent,'ci-canonical-field-selftest-'));
  try{const target=path.join(scratch,spec.path);mkdirSync(path.dirname(target),{recursive:true});writeFileSync(target,'stale canonical field proof');bad(spec.id+'-stale-before-execution','STALE_EVIDENCE',()=>assertFreshEvidence({root:scratch,lane:spec.lane,contract}));}
  finally{assert.equal(path.dirname(path.resolve(scratch)),parent);rmSync(scratch,{recursive:true,force:true});}
 }
 return checks;
}
function identitySelftest(workflow,contract,root){
 const checks=[],expectedHead=contract.extension.baseHead,spec=contract.extension.proofs.find(isIdentity);
 const good=(name,run)=>{run();checks.push({name:'identity-only-ui-'+name,result:'PASS',boundary:'pure identity shadow fixture; no Git/PG/UI/provider execution'});};
 const bad=(name,code,run)=>{assert.throws(run,error=>error.code===code);checks.push({name:'identity-only-ui-'+name,result:'PASS',expectedDenial:code,boundary:'pure identity shadow fixture'});};
 // Shadow fixtures model Linux Git bytes. The native validator compares exact Git bytes.
 const readSource=file=>Buffer.from(utf8(readFileSync(path.join(root,sourcePath(file)))).replaceAll('\r\n','\n'));
 const proof={status:'PASS',environment:'isolated-browser-real-components-with-controlled-session-and-http',sourceRevision:expectedHead,sourceState:'EXACT_CI_SOURCE',trackedClean:true,dirtyTrackedPaths:[],widths:[320,390,768,1280],totalCheckCount:IDENTITY_ONLY_CHECK_COUNT,checks:clone(IDENTITY_ONLY_CHECKS),sourceManifest:spec.sourceFiles.map(file=>({path:file,sha256:hash(readSource(file))})),harnessSha256:spec.producerSha256,pageErrors:[],requestErrors:[],screenshots:identityScreenshotNames.map(name=>IDENTITY_ARTIFACTS[0]+name),actualPageReloadTested:true,nativeIndexedDbReceiptReferencesTested:true,automaticRecoveryPostCount:0,postgresExecuted:false,realClerkLogin:false,realEmailDelivery:false,productionDataWritten:false,realProviderCalls:0,physicalWhatsAppVerified:false,fixtureRemoved:true,browserClosed:true,serverStopped:true};
 const validate=value=>validateExtensionProof(spec,Buffer.from(JSON.stringify(value)),{expectedHead,readSource});
 const mutate=(name,code,edit)=>{const value=clone(proof);edit(value);bad(name,code,()=>validate(value));};
 good('complete-103-exact-source-proof',()=>assert.equal(validate(proof).checks,IDENTITY_ONLY_CHECK_COUNT));
 good('current-source-closure-exact',()=>equal(currentProducerSourceFiles(spec,root),spec.sourceFiles.toSorted(),'PROOF_SOURCE_MANIFEST'));
 good('manifest-order-independent',()=>{const value=clone(proof);value.sourceManifest.reverse();assert.equal(validate(value).sourceManifestSha256,validate(proof).sourceManifestSha256);});
 bad('malformed-json','PROOF_JSON',()=>validateExtensionProof(spec,Buffer.from('{'),{expectedHead,readSource}));bad('invalid-utf8','PROOF_ENCODING',()=>validateExtensionProof(spec,Buffer.from([255]),{expectedHead,readSource}));
 mutate('wrong-status','PROOF_STATUS',p=>{p.status='FAIL';});mutate('production-write','PROOF_PRODUCTION_BOUNDARY',p=>{p.productionDataWritten=true;});
 mutate('wrong-head','PROOF_SOURCE_HEAD',p=>{p.sourceRevision='f'.repeat(40);});mutate('missing-head','PROOF_IDENTITY_SHAPE',p=>{delete p.sourceRevision;});
 mutate('dirty-source','PROOF_SOURCE_STATE',p=>{p.trackedClean=false;});mutate('dirty-path','PROOF_SOURCE_STATE',p=>{p.dirtyTrackedPaths=['src/lib/participant-admission.mjs'];});mutate('local-review-source','PROOF_SOURCE_STATE',p=>{p.sourceState='LOCAL_REVIEW_SOURCE';});
 mutate('wrong-harness','PROOF_HARNESS_SOURCE',p=>{p.harnessSha256='f'.repeat(64);});
 mutate('foreign-environment','PROOF_IDENTITY_ENVIRONMENT',p=>{p.environment='production-browser';});
 for(const [key,value] of [['realProviderCalls',1],['postgresExecuted',true],['realClerkLogin',true],['realEmailDelivery',true],['physicalWhatsAppVerified',true]])mutate('provider-'+key,'PROOF_PROVIDER_IO',p=>{p[key]=value;});
 mutate('provider-array-not-zero','PROOF_PROVIDER_IO',p=>{p.realProviderCalls=[];});
 for(const key of ['fixtureRemoved','browserClosed','serverStopped'])mutate('cleanup-'+key,'PROOF_CLEANUP',p=>{p[key]=false;});
 for(const key of ['pageErrors','requestErrors'])mutate('error-'+key,'PROOF_UI_ERRORS',p=>{p[key]=['shadow failure'];});
 mutate('wrong-width','PROOF_MATRIX',p=>{p.widths[0]=321;});mutate('wrong-total','PROOF_MATRIX',p=>{p.totalCheckCount=34;});
 for(const [index,row] of IDENTITY_ONLY_CHECKS.entries()){
  mutate('scenario-'+index+'-omitted','PROOF_IDENTITY_CHECKS',p=>{p.checks.splice(index,1);});
  mutate('scenario-'+index+'-altered','PROOF_IDENTITY_CHECKS',p=>{p.checks[index]={...row,width:321};});
 }
 mutate('scenario-duplicated','PROOF_IDENTITY_CHECKS',p=>{p.checks[0]=clone(p.checks[1]);});mutate('scenario-extra','PROOF_IDENTITY_CHECKS',p=>{p.checks.push(clone(p.checks[0]));});
 mutate('scenario-reordered','PROOF_IDENTITY_CHECKS',p=>{p.checks.reverse();});mutate('scenario-extra-field','PROOF_IDENTITY_CHECKS',p=>{p.checks[0].accepted=true;});
 for(const key of ['actualPageReloadTested','nativeIndexedDbReceiptReferencesTested'])mutate('recovery-'+key,'PROOF_IDENTITY_RECOVERY',p=>{p[key]=false;});
 mutate('recovery-automatic-post','PROOF_IDENTITY_RECOVERY',p=>{p.automaticRecoveryPostCount=1;});
 mutate('screenshot-omitted','PROOF_IDENTITY_SCREENSHOTS',p=>{p.screenshots.pop();});mutate('screenshot-foreign','PROOF_IDENTITY_SCREENSHOTS',p=>{p.screenshots[0]='.vercel/foreign.png';});
 for(const [index,name] of identityScreenshotNames.entries()){mutate('screenshot-'+index+'-omitted','PROOF_IDENTITY_SCREENSHOTS',p=>{p.screenshots.splice(index,1);});mutate('screenshot-'+index+'-altered','PROOF_IDENTITY_SCREENSHOTS',p=>{p.screenshots[index]='.vercel/foreign-'+name;});}
 mutate('extra-proof-key','PROOF_IDENTITY_SHAPE',p=>{p.humanAccepted=true;});
 for(const file of spec.sourceFiles){
  mutate('source-omitted-'+file,'PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>ref.path!==file);});
  mutate('source-hash-altered-'+file,'PROOF_SOURCE_HASH',p=>{p.sourceManifest.find(ref=>ref.path===file).sha256='f'.repeat(64);});
 }
 mutate('source-duplicate','PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest.push(clone(p.sourceManifest[0]));});mutate('source-foreign','PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest.push({path:'src/foreign.mjs',sha256:'f'.repeat(64)});});
 mutate('source-path-unsafe','PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest[0].path='../private';});mutate('source-reference-extra-key','PROOF_SOURCE_REFERENCE',p=>{p.sourceManifest[0].ignored=true;});
 const workflowSha256=hash(canonical(workflow)),needs=expectedNeeds(contract,expectedHead,workflowSha256,readSource),input={needs,contract,expectedHead,workflowSha256,runId:'100',runAttempt:'1',readSource};
 good('gate-binds-103-checks',()=>assert.equal(gate(input).lanes.find(lane=>lane.lane==='workspace-ui').proofBindings.find(binding=>binding.id===spec.id).checks,IDENTITY_ONLY_CHECK_COUNT));
 for(const [name,code,edit] of [
  ['binding-omitted','PROOF_BINDINGS',r=>{r.proofBindings=r.proofBindings.filter(b=>b.id!==spec.id);}],
  ['binding-head','PROOF_BINDING_IDENTITY',r=>{r.proofBindings.find(b=>b.id===spec.id).sourceRevision='f'.repeat(40);}],
  ['binding-source','PROOF_BINDING_SOURCE',r=>{r.proofBindings.find(b=>b.id===spec.id).sourceManifestSha256='f'.repeat(64);}],
  ['binding-proof','PROOF_BINDING_IDENTITY',r=>{r.proofBindings.find(b=>b.id===spec.id).proofSha256='f'.repeat(64);}],
  ['binding-harness','PROOF_BINDING_IDENTITY',r=>{r.proofBindings.find(b=>b.id===spec.id).harnessSha256='f'.repeat(64);}],
  ['binding-checks','PROOF_BINDING_IDENTITY',r=>{r.proofBindings.find(b=>b.id===spec.id).checks=34;}],
  ['binding-closure-count','PROOF_BINDING_IDENTITY',r=>{r.proofBindings.find(b=>b.id===spec.id).sourceReferences--; }],
  ['evidence-omitted','MISSING_REQUIRED_RETAINED_EVIDENCE',r=>{r.files=r.files.filter(f=>f.path!==spec.path);}]
 ]){const value=clone(needs),record=JSON.parse(value[spec.lane].outputs.provenance);edit(record);delete record.manifestSha256;value[spec.lane].outputs.provenance=JSON.stringify(seal(record));bad(name,code,()=>gate({...input,needs:value}));}
 bad('current-source-tampered','PROOF_BINDING_SOURCE',()=>gate({...input,readSource:file=>file===spec.sourceFiles[0]?Buffer.concat([readSource(file),Buffer.from('changed identity source')]):readSource(file)}));
 for(const [name,code,edit] of [
  ['block-omitted','CONTRACT_BLOCKS',c=>{c.blocks=c.blocks.filter(block=>block.id!==60);}],
  ['block-duplicate','CONTRACT_BLOCKS',c=>{c.blocks.push(clone(c.blocks.find(block=>block.id===60)));}],
  ['block-foreign-lane','EVIDENCE_PRODUCER_COVERAGE',c=>{c.lanes['workspace-ui'].blocks=c.lanes['workspace-ui'].blocks.filter(id=>id!==60);c.lanes.people.blocks.push(60);}],
  ['command-changed','CONTRACT_COMMAND',c=>{c.blocks.find(block=>block.id===60).step.run+='\ntrue';}],
  ['command-resealed','IDENTITY_BLOCK_COMMAND',c=>{const block=c.blocks.find(block=>block.id===60);block.step.run+='\ntrue';block.commandSha256=hash(block.step.run);}],
  ['baseline-59-command-resealed','PORTFOLIO_BLOCK_COMMAND',c=>{const block=c.blocks.find(block=>block.id===59);block.step.run+='\ntrue';block.commandSha256=hash(block.step.run);}],
  ['proof-contract-omitted','EXTENSION_PROOF_COVERAGE',c=>{c.extension.proofs=c.extension.proofs.filter(p=>p.id!==spec.id);}],
  ['check-contract-omitted','EXTENSION_CHECK_NAMES',c=>{c.extension.proofs.find(isIdentity).checkNames.pop();}]
 ]){const value=clone(contract);edit(value);bad(name,code,()=>validateContract(value));}
 const parent=path.resolve(root,'.vercel/workspace-ci-evidence'),fixture=mkdtempSync(path.join(parent,'ci-identity-selftest-fixture-'));
 try{const target=path.join(fixture,spec.path);mkdirSync(path.dirname(target),{recursive:true});writeFileSync(target,'stale identity shadow proof');bad('stale-proof-before-execution','STALE_EVIDENCE',()=>assertFreshEvidence({root:fixture,lane:spec.lane,contract}));}
 finally{const resolved=path.resolve(fixture);assert.ok(path.dirname(resolved)===parent&&path.basename(resolved).startsWith('ci-identity-selftest-fixture-'));rmSync(resolved,{recursive:true,force:true});}
 return checks;
}
function portfolioSelftest(workflow,contract,root){
 const checks=[],expectedHead=contract.extension.baseHead,specs=contract.extension.proofs.filter(isPortfolio);
 const good=(name,run)=>{run();checks.push({name,result:'PASS',boundary:'pure portfolio shadow fixture; no Git/PG/UI/provider execution'});};
 const bad=(name,code,run)=>{assert.throws(run,error=>error.code===code);checks.push({name,result:'PASS',expectedDenial:code,boundary:'pure portfolio shadow fixture'});};
 // These shadow bytes model a Linux checkout. Real proof bytes are never normalized.
 const readSource=file=>Buffer.from(utf8(readFileSync(path.join(root,sourcePath(file)))).replaceAll('\r\n','\n'));
 const tap=names=>Buffer.from('TAP version 13\n'+names.map((name,i)=>'ok '+(i+1)+' - '+name+'\n').join('')+'1..'+names.length+'\n# tests '+names.length+'\n# pass '+names.length+'\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n');
 for(const spec of specs){
  const evidence=new Map(),proof={status:'PASS',sourceRevision:expectedHead,sourceManifest:spec.sourceFiles.map(file=>({path:file,sha256:hash(readSource(file))})),harnessSha256:spec.producerSha256,providerCalls:0,productionDataWritten:false};
  if(spec.kind==='PORTFOLIO_UNIT'){
   const bytes=tap(Array.from({length:PORTFOLIO_TESTS},(_,i)=>'portfolio shadow case '+i)),filename='.vercel/portfolio-overview-contract-evidence/suite.tap';evidence.set(filename,bytes);
   Object.assign(proof,{sourceState:'committed exact Git HEAD',trackedClean:true,postgresExecuted:false,suite:{file:PORTFOLIO_TEST_FILE,exitCode:0,...parseTap(bytes),tap:{path:filename,bytes:bytes.length,sha256:hash(bytes)}}});
  }else if(spec.kind==='UI_PORTFOLIO')Object.assign(proof,{state:'PASS_LOCAL_UI_NOT_RELEASE_ACCEPTANCE',fixtureRemoved:true,errors:[],widths:[320,390,768,1280],checks:[320,390,768,1280].flatMap(width=>PORTFOLIO_MODES.map(mode=>({width,mode,reads:['pagination','503','401','403','409','503-html','401-html','403-html','409-html','invalid-json'].includes(mode)?2:1,providerCalls:0,mutations:0,horizontalOverflow:false})))});
  else Object.assign(proof,{sourceState:'EXACT_CI_SOURCE',trackedClean:true,dirtyTrackedPaths:[],productionDataTouched:false,environment:'local-disposable-postgresql',databaseRemoved:true,connectionClosed:true,physicalWhatsAppTested:false,checks:[...spec.checkNames],totalCheckCount:spec.checkNames.length});
  const validate=value=>validateExtensionProof(spec,Buffer.from(JSON.stringify(value)),{expectedHead,readSource,readEvidence:file=>evidence.get(file)});
  const mutate=(name,code,edit)=>{const value=clone(proof);edit(value);bad(spec.id+'-'+name,code,()=>validate(value));};
  good(spec.id+'-complete-native-proof',()=>assert.equal(validate(proof).checks,summary(spec)));
  good(spec.id+'-current-source-closure-exact',()=>equal(currentProducerSourceFiles(spec,root),spec.sourceFiles.toSorted(),'PROOF_SOURCE_MANIFEST'));
  good(spec.id+'-manifest-order-independent',()=>{const value=clone(proof);value.sourceManifest.reverse();assert.equal(validate(value).sourceManifestSha256,validate(proof).sourceManifestSha256);});
  mutate('wrong-status','PROOF_STATUS',p=>{if(spec.kind==='UI_PORTFOLIO')p.state='PASS';else p.status='FAIL';});
  mutate('wrong-head','PROOF_SOURCE_HEAD',p=>{p.sourceRevision='f'.repeat(40);});mutate('missing-head','PROOF_SOURCE_STATE',p=>{delete p.sourceRevision;});
  mutate('wrong-producer','PROOF_HARNESS_SOURCE',p=>{p.harnessSha256='f'.repeat(64);});mutate('provider-IO','PROOF_PROVIDER_IO',p=>{p.providerCalls=1;});
  mutate('production-written','PROOF_PRODUCTION_BOUNDARY',p=>{if(spec.kind==='PG_PORTFOLIO')p.productionDataTouched=true;else p.productionDataWritten=true;});
  for(const file of spec.sourceFiles){
   mutate('source-omitted-'+file,'PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>ref.path!==file);});
   mutate('source-hash-altered-'+file,'PROOF_SOURCE_HASH',p=>{p.sourceManifest.find(ref=>ref.path===file).sha256='f'.repeat(64);});
  }
  mutate('source-duplicate','PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest.push(clone(p.sourceManifest[0]));});
  if(spec.kind==='PORTFOLIO_UNIT'){
   mutate('dirty-source','PROOF_SOURCE_STATE',p=>{p.trackedClean=false;});mutate('local-uncommitted','PROOF_SOURCE_STATE',p=>{p.sourceState='LOCAL_REVIEW_SOURCE';});mutate('PG-executed','PROOF_SOURCE_STATE',p=>{p.postgresExecuted=true;});
   mutate('wrong-suite','PROOF_UNIT_EXECUTION',p=>{p.suite.file='tests/production-workspace.test.mjs';});mutate('nonzero-exit','PROOF_UNIT_EXECUTION',p=>{p.suite.exitCode=1;});mutate('tap-digest','PROOF_TAP_DIGEST',p=>{p.suite.tap.sha256='f'.repeat(64);});
   const filename=proof.suite.tap.path,original=evidence.get(filename);
   for(const size of [16,18]){const bytes=tap(Array.from({length:size},(_,i)=>'changed shadow case '+i));evidence.set(filename,bytes);mutate('exact-count-'+size,'PROOF_UNIT_RESULTS',p=>{p.suite={file:PORTFOLIO_TEST_FILE,exitCode:0,...parseTap(bytes),tap:{path:filename,bytes:bytes.length,sha256:hash(bytes)}};});}
   for(const key of ['fail','cancelled','skipped','todo']){const bytes=Buffer.from(original.toString().replace('# '+key+' 0','# '+key+' 1'));evidence.set(filename,bytes);mutate('tap-'+key,'PROOF_UNIT_RESULTS',p=>{p.suite.tap={path:filename,bytes:bytes.length,sha256:hash(bytes)};});}
   evidence.set(filename,original);mutate('declared-result-altered','PROOF_UNIT_RESULTS',p=>{p.suite.caseNames[0]='different assertion';});
  }else if(spec.kind==='UI_PORTFOLIO'){
   mutate('partial-matrix','PROOF_MATRIX',p=>{p.checks.pop();});mutate('duplicate-matrix','PROOF_MATRIX',p=>{p.checks[0]=clone(p.checks[1]);});mutate('wrong-width','PROOF_MATRIX',p=>{p.widths[0]=321;});mutate('ui-error','PROOF_UI_ERRORS',p=>{p.errors=['shadow UI failure'];});mutate('fixture-retained','PROOF_CLEANUP',p=>{p.fixtureRemoved=false;});
   for(const [key,value] of [['providerCalls',1],['mutations',1],['horizontalOverflow',true],['reads',0]])mutate('row-'+key,'PROOF_PORTFOLIO_GUARDS',p=>{p.checks[0][key]=value;});
   mutate('HTML-denial-modes-omitted','PROOF_MATRIX',p=>{p.checks=p.checks.filter(c=>!['401-html','403-html','409-html'].includes(c.mode));});
  }else{
   good('portfolio-postgres-existing-seventeen-SQL-checks-exact',()=>equal([...readFileSync(path.join(root,spec.producer),'utf8').matchAll(/checks\.push\('([^']+)'\)/g)].map(match=>match[1]),spec.checkNames,'PROOF_CHECK_NAMES'));
   mutate('database-not-removed','PROOF_CLEANUP',p=>{p.databaseRemoved=false;});mutate('connection-not-closed','PROOF_CLEANUP',p=>{p.connectionClosed=false;});mutate('foreign-fixture','PROOF_CLEANUP',p=>{p.environment='external-postgresql';});
   mutate('dirty-source','PROOF_SOURCE_STATE',p=>{p.trackedClean=false;});mutate('dirty-path','PROOF_SOURCE_STATE',p=>{p.dirtyTrackedPaths=['src/lib/workspace-store.mjs'];});mutate('local-proof','PROOF_SOURCE_STATE',p=>{p.sourceState='LOCAL_REVIEW_SOURCE';});mutate('wrong-total','PROOF_CHECK_NAMES',p=>{p.totalCheckCount=0;});mutate('omitted-check','PROOF_CHECK_NAMES',p=>{p.checks.pop();});mutate('duplicated-check','PROOF_CHECK_NAMES',p=>{p.checks[0]=p.checks[1];});mutate('claims-physical-acceptance','PROOF_PROVIDER_IO',p=>{p.physicalWhatsAppTested=true;});
  }
 }
 const workflowSha256=hash(canonical(workflow)),needs=expectedNeeds(contract,expectedHead,workflowSha256,readSource),input={needs,contract,expectedHead,workflowSha256,runId:'100',runAttempt:'1',readSource};
 for(const spec of specs){
  for(const [name,code,edit] of [
   ['binding-omitted','PROOF_BINDINGS',r=>{r.proofBindings=r.proofBindings.filter(b=>b.id!==spec.id);}],
   ['binding-head','PROOF_BINDING_IDENTITY',r=>{r.proofBindings.find(b=>b.id===spec.id).sourceRevision='f'.repeat(40);}],
   ['binding-source','PROOF_BINDING_SOURCE',r=>{r.proofBindings.find(b=>b.id===spec.id).sourceManifestSha256='f'.repeat(64);}],
   ['binding-proof','PROOF_BINDING_IDENTITY',r=>{r.proofBindings.find(b=>b.id===spec.id).proofSha256='f'.repeat(64);}],
   ['binding-harness','PROOF_BINDING_IDENTITY',r=>{r.proofBindings.find(b=>b.id===spec.id).harnessSha256='f'.repeat(64);}],
   ['binding-checks','PROOF_BINDING_IDENTITY',r=>{r.proofBindings.find(b=>b.id===spec.id).checks=0;}],
   ['evidence-omitted','MISSING_REQUIRED_RETAINED_EVIDENCE',r=>{r.files=r.files.filter(f=>f.path!==spec.path);}]
  ]){const value=clone(needs),record=JSON.parse(value[spec.lane].outputs.provenance);edit(record);delete record.manifestSha256;value[spec.lane].outputs.provenance=JSON.stringify(seal(record));bad(spec.id+'-'+name,code,()=>gate({...input,needs:value}));}
  bad(spec.id+'-current-Git-source-altered','PROOF_BINDING_SOURCE',()=>gate({...input,readSource:file=>file===spec.sourceFiles.at(-1)?Buffer.concat([readSource(file),Buffer.from('changed shadow source')]):readSource(file)}));
 }
 for(const [name,code,edit] of [
  ['block-omitted','CONTRACT_BLOCKS',c=>{c.blocks=c.blocks.filter(block=>block.id!==59);}],['block-duplicated','CONTRACT_BLOCKS',c=>{c.blocks.push(clone(c.blocks.find(block=>block.id===59)));}],
  ['command-changed','CONTRACT_COMMAND',c=>{c.blocks.find(block=>block.id===59).step.run+='\ntrue';}],
  ['command-resealed','PORTFOLIO_BLOCK_COMMAND',c=>{const block=c.blocks.find(block=>block.id===59);block.step.run+='\ntrue';block.commandSha256=hash(block.step.run);}],
  ['baseline-58-command-resealed','PORTFOLIO_BASELINE_BLOCKS_CHANGED',c=>{const b=c.blocks.find(b=>b.id===58);b.step.run+='\ntrue';b.commandSha256=hash(b.step.run);}]
 ]){const value=clone(contract);edit(value);bad('portfolio-'+name,code,()=>validateContract(value));}
 for(const spec of specs){const value=clone(contract);value.extension.proofs=value.extension.proofs.filter(p=>p.id!==spec.id);bad(spec.id+'-contract-binding-omitted','EXTENSION_PROOF_COVERAGE',()=>validateContract(value));}
 const parent=path.resolve(root,'.vercel/workspace-ci-evidence'),fixture=mkdtempSync(path.join(parent,'ci-portfolio-selftest-fixture-'));
 try{for(const spec of specs){const target=path.join(fixture,spec.path);mkdirSync(path.dirname(target),{recursive:true});writeFileSync(target,'stale portfolio shadow proof');bad(spec.id+'-stale-before-execution','STALE_EVIDENCE',()=>assertFreshEvidence({root:fixture,lane:spec.lane,contract}));rmSync(target);}}
 finally{const resolved=path.resolve(fixture);assert.ok(path.dirname(resolved)===parent&&path.basename(resolved).startsWith('ci-portfolio-selftest-fixture-'));rmSync(resolved,{recursive:true,force:true});}
 return checks;
}
function writeJson(filename,value){mkdirSync(path.dirname(filename),{recursive:true});writeFileSync(filename,JSON.stringify(value,null,2)+'\n');}
function options(argv){const parsed={};for(let i=0;i<argv.length;i+=2){if(!argv[i]?.startsWith('--')||!argv[i+1])deny('CLI_ARGUMENT');parsed[argv[i].slice(2)]=argv[i+1];}return parsed;}
function main(){
 const [mode,...args]=process.argv.slice(2),opts=options(args),root=path.resolve(opts.root||process.cwd()),contract=loadContract(path.resolve(root,opts.contract||contractPath)),file=path.resolve(root,opts.workflow||workflowPath),bytes=readFileSync(file),workflow=yaml.load(bytes.toString('utf8'));
 equivalent(workflow,contract);dependencies(root,contract);
 if(mode==='equivalence'){if(opts['expected-head'])identity(root,opts['expected-head']);console.log(JSON.stringify({state:'PASS',commandBlocks:54,artifactPatterns:58,lanes:8}));return;}
 if(mode==='selftest'){
  const sourceHead=opts['expected-head']?identity(root,opts['expected-head']):identity(root,execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim());
   const checks=selftest(workflow,contract,root),output=path.resolve(root,opts.output||'.vercel/workspace-ci-evidence/selftest.json');writeJson(output,{version:1,state:'PASS',head:sourceHead,workflowSha256:hash(bytes),contractSha256:EXPECTED_CONTRACT_SHA256,verifierSha256:verifierSha256(),packageLockSha256:contract.packageLockSha256,requirementsSha256:contract.requirementsSha256,checks});
  const escape=value=>value.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  writeFileSync(output.replace(/\.json$/,'.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="workspace-ci-private-design" tests="${checks.length}" failures="0">${checks.map(check=>`<testcase name="${escape(check.name)}"/>`).join('')}</testsuite>\n`);
  console.log(JSON.stringify({state:'PASS',checks:checks.length,commandBlocks:54,artifactPatterns:58,lanes:8}));return;
 }
 if(mode==='preflight'){
  identity(root,opts['expected-head']);clocks(process.env);if(!LANES.includes(opts.lane))deny('UNKNOWN_LANE');
  assertFreshEvidence({root,lane:opts.lane,contract});
  console.log(JSON.stringify({state:'PASS',lane:opts.lane}));return;
 }
 if(mode==='provenance'){
  const record=provenance({root,lane:opts.lane,contract,expectedHead:opts['expected-head'],workflowSha256:hash(bytes)}),manifest=path.join(root,'.vercel/workspace-ci-evidence/lane-'+opts.lane+'.json');mkdirSync(path.dirname(manifest),{recursive:true});writeFileSync(manifest,JSON.stringify(unseal(record))+'\n');
  if(!process.env.GITHUB_OUTPUT)deny('OUTPUT_FILE_REQUIRED');writeFileSync(process.env.GITHUB_OUTPUT,'record='+JSON.stringify(record)+'\n',{flag:'a'});return;
 }
 if(mode==='gate'){
  identity(root,opts['expected-head']);const filename=path.join(root,'.vercel/workspace-ci-evidence/gate.json');
  try{const report=gate({needs:readLaneNeedsEnvironment(process.env),contract,expectedHead:opts['expected-head'],workflowSha256:hash(bytes),...clocks(process.env),readSource:gitSource(root,opts['expected-head'])});writeJson(filename,report);console.log(JSON.stringify({state:'PASS',lanes:8,commandBlocks:54,artifactPatterns:58,fileCount:report.fileCount}));}
  catch(error){writeJson(filename,{version:1,state:'FAIL',code:error.code||'GATE_FAILED'});throw error;}return;
 }
 deny('UNKNOWN_COMMAND');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{main();}catch(error){console.error(JSON.stringify({state:'FAIL',code:error.code||'VERIFIER_FAILED'}));process.exitCode=1;}}
