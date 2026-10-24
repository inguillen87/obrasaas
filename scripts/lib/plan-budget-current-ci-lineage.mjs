import {createHash} from 'node:crypto';
import path from 'node:path';
import {PLAN_BUDGET_CURRENT_REVISION as reviewed} from './plan-budget-current-ci-reviewed.mjs';
export {PLAN_BUDGET_CURRENT_REVISION} from './plan-budget-current-ci-reviewed.mjs';
// Literal Git731565 parent: only import declarations and export keywords removed.
function createCaptureQualityParentGate(reviewed){




const PLAN_BUDGET_CURRENT_SECTION='planBudgetCurrentRevision';
const PLAN_BUDGET_CI_KIND='UI_PLAN_BUDGET_SOURCE';
const PLAN_BUDGET_CI_PROOF_PATH='.vercel/private/plan-budget-ui-ci.json';
// Historical bodies remain private and unchanged after export-keyword removal.
function createAuthenticatedParentGate(reviewed){
const anchor='scripts/lib/plan-budget-current-ci-reviewed.mjs',previousHash='8b19235b22aa3c208098283537511fe1c816f7ff86404790a98999f0e818f839';
const declaration=value=>'// Exact budget-source CI declaration; compiler fills immutable reviewed source bindings.\nexport const PLAN_BUDGET_CURRENT_REVISION=Object.freeze('+JSON.stringify(value,null,2)+');\n';
const sha=value=>createHash('sha256').update(value).digest('hex'),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value),hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const safe=file=>typeof file==='string'&&file.length>0&&path.posix.normalize(file)===file&&!path.posix.isAbsolute(file)&&!/[\\:\x00-\x1f]/.test(file)&&!file.split('/').includes('..');
const reject=(ok,reason)=>{if(!ok)throw Object.assign(new Error('Budget current CI lineage rejected: '+reason),{code:'PLAN_BUDGET_CURRENT_CI_LINEAGE_REJECTED',reason});};
const exact=(value,names,reason)=>reject(plain(value)&&same(Object.keys(value).sort(),[...names].sort()),reason);
const sorted=files=>reject(Array.isArray(files)&&files.every(safe)&&same(files,[...new Set(files)].sort()),'SORTED_SOURCE_PATHS');
const read=(reader,file)=>{reject(typeof reader==='function'&&safe(file),'SOURCE_READER');let bytes;try{bytes=reader(file);}catch{}reject(Buffer.isBuffer(bytes)&&Buffer.from(bytes.toString('utf8')).equals(bytes),'UTF8_SOURCE_'+file);return Buffer.from(bytes.toString('utf8').replaceAll('\r\n','\n'));};
// Exact successor of Git65d. Current proofs retain actual bytes and maps;
// these inverses are local values for the unchanged historical validators.
function integrationParentRevision(value){
 const r=value.pilotIntegrationRuntime;
 exact(r,['version','parentHead','previousContractSha256','sourceAliases','referenceAdvances','validationSourceAdvance','familyManifestAdvances','sourceHistory','nativeOrHumanAcceptance'],'INTEGRATION_KEYS');
 reject(r.version===1&&r.parentHead==='65d7962b9638ca7931d01cdb499583127779aeb3'&&r.previousContractSha256==='6cb040ad517b8a87b86a0466f23fe822dd570227392aff6209eeff037e840c71'&&r.nativeOrHumanAcceptance===false,'INTEGRATION_PARENT');
 const predecessors=[{"path":"scripts/lib/attendance-review-current-ci-proof.mjs","previousSha256":"999d5daeecd597f87d01dcad2fb84701d443636d86d812eaf66ad09bb20a4805"},{"path":"scripts/lib/plan-budget-current-ci-lineage.mjs","previousSha256":"40f82005d0fbca72d1491f0100a8395f61dcbe1455f3eaf086c39e12d1a2dcdb"},{"path":"src/app/(identity)/cuenta/company-subscription-panel.js","previousSha256":"0b208fdcbea4900bd6adf86ad80f8524b5afa647d78a24fbf5731d3d7d79c749"},{"path":"src/app/(identity)/cuenta/company-subscription-panel.module.css","previousSha256":"fdede43a09f48b011f7e3cb184ea16bf0be0e98069e7a953b71b8e391b3dfa3e"},{"path":"src/lib/meta-field-bridge.mjs","previousSha256":"7f3bb80ba828e202f24e1d768b855131642dcc89fde39fcac4b81d64aa632955"},{"path":"src/lib/meta-field-conversation.mjs","previousSha256":"c68887db8fa04f5806d1c0f4c29e829befb89931b8371041ad65334deb1dab4d"},{"path":"src/lib/meta-kyc-conversation.mjs","previousSha256":"14960607758ad6481e7b32ee356357e16dc8bbc95d03ffb3b64cc1f9e7775892"},{"path":"tests/production-field-attendance-current-ci-proof.test.mjs","previousSha256":"bb73abaf901512de92b8afdbd47c0e8a589af63ef8bb038d410d850122877237"},{"path":"tests/production-meta-field.test.mjs","previousSha256":"fdc0ddf2cf5fab717654860bdd89543a70c161cb9fac7ab3fdd0cbc96d1c1e18"},{"path":"tests/production-pilot-whatsapp-current-lineage.test.mjs","previousSha256":"a489da83106dbd282d81007330f42aaa741a75ded10fbd2dcff4fcbba894ced0"},{"path":"tests/production-plan-measurement-current-source-binding.test.mjs","previousSha256":"5f59acca1c079f393c681979b951f660709c67dcba7bedeff319cbdc9743f8ec"}];
 const byPath=new Map(predecessors.map(row=>[row.path,row.previousSha256]));
 const aliases=['src/app/(identity)/cuenta/company-subscription-panel.js','src/app/(identity)/cuenta/company-subscription-panel.module.css','tests/production-meta-field.test.mjs'];
 const validation='tests/production-plan-measurement-current-source-binding.test.mjs';
 const advances=predecessors.map(row=>row.path).filter(file=>!aliases.includes(file)&&file!==validation);
 reject(Array.isArray(r.sourceAliases)&&same(r.sourceAliases.map(row=>row.path),aliases)&&Array.isArray(r.referenceAdvances)&&same(r.referenceAdvances.map(row=>row.path),advances),'INTEGRATION_EXACT_REFERENCES');
 exact(r.validationSourceAdvance,['path','previousSha256','currentSha256'],'INTEGRATION_VALIDATION_KEYS');reject(r.validationSourceAdvance.path===validation,'INTEGRATION_VALIDATION');
 const refs=[...r.sourceAliases,...r.referenceAdvances,r.validationSourceAdvance];
 for(const row of refs){exact(row,['path','previousSha256','currentSha256'],'INTEGRATION_REFERENCE_KEYS');reject(row.previousSha256===byPath.get(row.path)&&hash(row.currentSha256)&&row.currentSha256!==row.previousSha256,'INTEGRATION_REFERENCE_PIN');}
 reject(Array.isArray(r.sourceHistory)&&same(r.sourceHistory.map(row=>row.path),predecessors.map(row=>row.path)),'INTEGRATION_EXACT_HISTORY');
 for(const h of r.sourceHistory){exact(h,['path','previousSha256','currentSha256','previousBytes','currentBytes','inverseHunks'],'INTEGRATION_HISTORY_KEYS');const ref=refs.find(row=>row.path===h.path);reject(ref&&h.previousSha256===ref.previousSha256&&h.currentSha256===ref.currentSha256&&[h.previousBytes,h.currentBytes].every(n=>Number.isSafeInteger(n)&&n>0)&&Array.isArray(h.inverseHunks)&&h.inverseHunks.length>0,'INTEGRATION_HISTORY_PIN');let end=0;for(const b of h.inverseHunks){exact(b,['currentOffsetCharacters','currentText','previousText'],'INTEGRATION_HUNK_KEYS');reject(Number.isSafeInteger(b.currentOffsetCharacters)&&b.currentOffsetCharacters>=end&&typeof b.currentText==='string'&&typeof b.previousText==='string'&&b.currentText!==b.previousText,'INTEGRATION_ORDERED_HUNKS');end=b.currentOffsetCharacters+b.currentText.length;}}
 const pairs=value.sourceFamilies.flatMap(f=>f.currentManifest.filter(row=>byPath.has(row.path)).map(row=>[f.family,row.path]));
 reject(Array.isArray(r.familyManifestAdvances)&&same(r.familyManifestAdvances.map(row=>[row.family,row.path]),pairs),'INTEGRATION_EXACT_FAMILIES');
 const parent=structuredClone(value);delete parent.pilotIntegrationRuntime;
 for(const row of r.sourceAliases){const found=parent.references.filter(ref=>ref.path===row.path);reject(found.length===1&&same(found[0],row),'INTEGRATION_ADDED_ALIAS');parent.references=parent.references.filter(ref=>ref.path!==row.path);}
 for(const row of r.referenceAdvances){const ref=parent.references.find(ref=>ref.path===row.path);reject(ref?.currentSha256===row.currentSha256,'INTEGRATION_REFERENCE_RESTORE');ref.currentSha256=row.previousSha256;}
 reject(!parent.references.some(row=>row.path===validation),'INTEGRATION_VALIDATION_OUTSIDE_REFERENCES');
 for(const row of r.familyManifestAdvances){exact(row,['family','path','previousSha256','currentSha256'],'INTEGRATION_FAMILY_KEYS');const h=refs.find(ref=>ref.path===row.path),ref=parent.sourceFamilies.find(f=>f.family===row.family)?.currentManifest.find(ref=>ref.path===row.path);reject(h&&h.previousSha256===row.previousSha256&&h.currentSha256===row.currentSha256&&ref?.sha256===row.currentSha256,'INTEGRATION_FAMILY_JOIN');ref.sha256=row.previousSha256;}
 reject(value.references.length===120&&parent.references.length===117&&parent.sourceFamilies.length===16,'INTEGRATION_SOURCE_COUNTS');return parent;
}
function integrationParentContract(contract){
 const out=structuredClone(contract);out[PLAN_BUDGET_CURRENT_SECTION]=integrationParentRevision(out[PLAN_BUDGET_CURRENT_SECTION]);
 reject(sha(JSON.stringify(out,null,2)+'\n')===currentExpected.pilotIntegrationRuntime.previousContractSha256,'INTEGRATION_COMPLETE_65D_CONTRACT');return out;
}
function integrationParentSource(file,bytes,allowParent=false){
 const h=currentExpected.pilotIntegrationRuntime.sourceHistory.find(row=>row.path===file);if(!h)return bytes;
 reject(Buffer.isBuffer(bytes)&&bytes.equals(Buffer.from(bytes.toString('utf8'))),'INTEGRATION_UTF8_SOURCE_'+file);let text=bytes.toString('utf8').replaceAll('\r\n','\n');
 if(allowParent&&sha(text)===h.previousSha256&&Buffer.byteLength(text)===h.previousBytes)return Buffer.from(text);
 reject(sha(text)===h.currentSha256&&Buffer.byteLength(text)===h.currentBytes,'INTEGRATION_CURRENT_SOURCE_'+file);
 for(const b of [...h.inverseHunks].reverse()){const at=b.currentOffsetCharacters;reject(text.slice(at,at+b.currentText.length)===b.currentText,'INTEGRATION_EXACT_HUNK_'+file);text=text.slice(0,at)+b.previousText+text.slice(at+b.currentText.length);}
 reject(sha(text)===h.previousSha256&&Buffer.byteLength(text)===h.previousBytes,'INTEGRATION_COMPLETE_SOURCE_INVERSE_'+file);return Buffer.from(text);
}
function integrationParentReader(reader){return file=>file===anchor?Buffer.from(declaration(expected)):integrationParentSource(file,reader(file));}
function verifyIntegrationActualSources(contract,reader){
 integrationParentContract(contract);reject(read(reader,anchor).toString()===declaration(currentExpected),'INTEGRATION_DECLARATION_BYTES');
 for(const row of currentExpected.references)reject(sha(read(reader,row.path))===row.currentSha256,'INTEGRATION_CURRENT_REFERENCE_'+row.path);
 for(const row of currentExpected.pilotIntegrationRuntime.sourceHistory)integrationParentSource(row.path,read(reader,row.path));
}
function integrationAdvancedPin(ref){const h=currentExpected.pilotIntegrationRuntime.sourceHistory.find(row=>row.path===ref.path);return h&&ref.sha256===h.previousSha256?h.currentSha256:ref.sha256;}
function integrationInputPin(ref){const h=currentExpected.pilotIntegrationRuntime.sourceHistory.find(row=>row.path===ref.path);return h&&ref.sha256===h.currentSha256?{...ref,sha256:h.previousSha256}:ref;}
function restorePlanBudgetPilotIntegrationPreviousContract(contract){section(contract,true);return integrationParentContract(contract);}
function restorePlanBudgetPilotIntegrationSource(contract,file,bytes){section(contract,true);return integrationParentSource(file,bytes);}

const currentExpected=structuredClone(reviewed),expected=integrationParentRevision(currentExpected);let compiled=null;
const currentExpectedJson=JSON.stringify(currentExpected);
// Bounded current pilot advancement. The complete parent ledger remains pinned;
// this declaration never grants business authority or certifies a native run.
// The current field-review addition is a separate exact successor. Its source
// sets return to the authenticated ad435 ledger before the thirteen WhatsApp
// unions below are considered; the immutable 380e checkpoint is not rewritten.
// Exact successor of the committed24128 catalog/picker source graph. Current
// sets restore to that complete parent before attendance/ad435 and WhatsApp380e.
function consumptionParentSourceSets(v){
 const f=v.consumptionEvidenceRuntime;
 exact(f,['version','parentHead','sourceAdditions','sourceSetAdvances','sourceHistory','materialNative','nativeOrHumanAcceptance'],'CONSUMPTION_EVIDENCE_KEYS');
 const additions=['src/app/(identity)/cuenta/consumption-evidence-picker.js','src/app/(identity)/cuenta/consumption-evidence-picker.module.css','src/app/(identity)/cuenta/consumption-evidence-view.mjs','src/app/api/identity/consumption-evidence/route.js','src/lib/consumption-evidence-catalog.mjs','src/lib/consumption-evidence-http.mjs'];
 reject(f.version===1&&f.parentHead==='24128f6fe6eaee16dad98025202db5bd905a6942'&&same(f.sourceAdditions,additions)&&f.nativeOrHumanAcceptance===false,'CONSUMPTION_EVIDENCE_PARENT');
 const families=['UNIT','UI_BANK','UI_JOINT','UI_CAUSAL','PG_COMPANY_KYC','UI_IDENTITY_ONLY','PG_FIELD','PG_OVERTIME','PG_PARTICIPANT_KYC_PREANALYSIS','UI_FOCUSED_WORKSPACE','UI_FIELD_TASK_PAGINATION','LIVE_HOURS_RUNTIME','PLAN_MEASUREMENT','CONSUMPTION_FEEDBACK','CONSUMPTION_FEEDBACK_UI','COMPACT','ORGANIZATION_USAGE','KYC_REPLY_FEEDBACK'];
 reject(Array.isArray(f.sourceSetAdvances)&&same(f.sourceSetAdvances.map(a=>a.family),families),'CONSUMPTION_EVIDENCE_EXACT_UNIONS');const parents=new Map();
 for(const a of f.sourceSetAdvances){
  exact(a,['family','previousDelta','additions'],'CONSUMPTION_EVIDENCE_ADVANCE_KEYS');const before=a.previousDelta;
  exact(before,['family','contractPointer','previousCount','previousPathsSha256','currentCount','currentPathsSha256','additions'],'CONSUMPTION_EVIDENCE_PARENT_DELTA_KEYS');sorted(before.additions);sorted(a.additions);
  const row=v.sourceSetDeltas.find(row=>row.family===a.family);
  reject(row&&before.family===a.family&&a.additions.length>0&&a.additions.every(file=>additions.includes(file)&&!before.additions.includes(file))&&same(row,{...before,currentCount:before.currentCount+a.additions.length,currentPathsSha256:row.currentPathsSha256,additions:[...before.additions,...a.additions].sort()}),'CONSUMPTION_EVIDENCE_EXACT_UNION');parents.set(a.family,before);
 }
 const restored=v.sourceSetDeltas.map(row=>parents.get(row.family)||row);reject(sha(JSON.stringify(restored))==='822a71aaba8e8d711335a6a7fc3d17d2342fd0ace42579749888f621a6ca7203','CONSUMPTION_EVIDENCE_COMPLETE_PARENT_LEDGER');
 const h=f.sourceHistory;exact(h,['path','previousSha256','currentSha256','previousBytes','currentBytes','inverseHunks'],'CONSUMPTION_EVIDENCE_HISTORY_KEYS');
 reject(h.path==='src/lib/meta-consumption-evidence-catalog.mjs'&&h.previousSha256==='cd4eb1ccf8617060aa2bb352cc9467981f7d17649be8b24233413c133c407bff'&&hash(h.currentSha256)&&[h.previousBytes,h.currentBytes].every(n=>Number.isSafeInteger(n)&&n>0)&&Array.isArray(h.inverseHunks)&&h.inverseHunks.length===1,'CONSUMPTION_EVIDENCE_HISTORY');
 const chunk=h.inverseHunks[0];exact(chunk,['currentOffsetCharacters','currentText','previousText'],'CONSUMPTION_EVIDENCE_HUNK_KEYS');reject(chunk.currentOffsetCharacters===0&&typeof chunk.currentText==='string'&&typeof chunk.previousText==='string'&&chunk.currentText!==chunk.previousText&&sha(chunk.currentText)===h.currentSha256&&sha(chunk.previousText)===h.previousSha256&&Buffer.byteLength(chunk.currentText)===h.currentBytes&&Buffer.byteLength(chunk.previousText)===h.previousBytes,'CONSUMPTION_EVIDENCE_COMPLETE_SOURCE_INVERSE');
 const m=f.materialNative;exact(m,['producer','previousFiles','currentFiles','currentManifest','sourceHistory'],'CONSUMPTION_EVIDENCE_NATIVE_KEYS');sorted(m.previousFiles);sorted(m.currentFiles);
 reject(m.producer==='scripts/verify-material-inventory-postgres.mjs'&&same(m.previousFiles,v.pilotWhatsAppRuntime.nativeSupplements[1].sourceManifestAdvance.currentFiles)&&same(m.currentFiles,[...m.previousFiles,'src/lib/consumption-evidence-catalog.mjs'].sort())&&same(m.currentManifest.map(ref=>ref.path),m.currentFiles),'CONSUMPTION_EVIDENCE_NATIVE_UNION');for(const ref of m.currentManifest){exact(ref,['path','sha256'],'CONSUMPTION_EVIDENCE_NATIVE_REFERENCE');reject(hash(ref.sha256),'CONSUMPTION_EVIDENCE_NATIVE_HASH');}
 const advance=m.sourceHistory,parent=v.pilotWhatsAppRuntime.producerDeltas.find(row=>row.producer===m.producer);exact(advance,['parentHead','previousSha256','currentSha256','previousBytes','currentBytes','inverseHunks'],'MATERIAL_NATIVE_ADVANCE_KEYS');
 reject(advance.parentHead==='1b654e24ff968014fb96adc56cf06b33ccf1599f'&&advance.previousSha256===parent.currentSha256&&advance.previousBytes===parent.sourceHistory.currentBytes&&hash(advance.currentSha256)&&advance.currentSha256!==advance.previousSha256&&Number.isSafeInteger(advance.currentBytes)&&advance.currentBytes>0&&Array.isArray(advance.inverseHunks)&&advance.inverseHunks.length===2&&m.currentManifest.find(ref=>ref.path===m.producer)?.sha256===advance.currentSha256,'MATERIAL_NATIVE_EXACT_PARENT_ADVANCE');
 let end=0;for(const block of advance.inverseHunks){exact(block,['currentOffsetCharacters','currentText','previousText'],'MATERIAL_NATIVE_HUNK_KEYS');reject(Number.isSafeInteger(block.currentOffsetCharacters)&&block.currentOffsetCharacters>=end&&typeof block.currentText==='string'&&typeof block.previousText==='string'&&block.currentText!==block.previousText,'MATERIAL_NATIVE_ORDERED_HUNK');end=block.currentOffsetCharacters+block.currentText.length;}
 return restored;
}
function consumptionParentFiles(files,row){
 const a=expected.consumptionEvidenceRuntime.sourceSetAdvances.find(a=>a.family===row.family);if(!a)return files;
 const parent=files.filter(file=>!a.additions.includes(file));reject(parent.length===a.previousDelta.currentCount&&sha(JSON.stringify(parent))===a.previousDelta.currentPathsSha256,'CONSUMPTION_EVIDENCE_EXACT_PARENT_SET_'+row.family);return parent;
}
function fieldReviewParentSourceSets(v){
 const sourceSets=consumptionParentSourceSets(v);
 const f=v.attendanceReviewRuntime;
 exact(f,['version','parentHead','sourceAdditions','sourceSetAdvances','producer','nativeOrHumanAcceptance'],'ATTENDANCE_REVIEW_KEYS');
 reject(f.version===1&&f.parentHead==='ad435c1ac3cd6bdb43ee6b51051c0ec2af312adb'&&f.nativeOrHumanAcceptance===false&&same(f.sourceAdditions,['tests/production-field-attendance-review-query.test.mjs']),'ATTENDANCE_REVIEW_PARENT');
 reject(Array.isArray(f.sourceSetAdvances)&&f.sourceSetAdvances.length>0&&new Set(f.sourceSetAdvances.map(row=>row.family)).size===f.sourceSetAdvances.length,'ATTENDANCE_REVIEW_SOURCE_ADVANCES');
 const parents=new Map();
 for(const a of f.sourceSetAdvances){
  exact(a,['family','previousDelta','additions'],'ATTENDANCE_REVIEW_ADVANCE_KEYS');const before=a.previousDelta;
  exact(before,['family','contractPointer','previousCount','previousPathsSha256','currentCount','currentPathsSha256','additions'],'ATTENDANCE_REVIEW_PARENT_DELTA_KEYS');sorted(before.additions);sorted(a.additions);
  const row=sourceSets.find(row=>row.family===a.family);
  reject(row&&a.family===before.family&&a.additions.length>0&&a.additions.every(file=>f.sourceAdditions.includes(file))&&a.additions.every(file=>!before.additions.includes(file))&&same(row,{...before,currentCount:before.currentCount+a.additions.length,currentPathsSha256:row.currentPathsSha256,additions:[...before.additions,...a.additions].sort()}),'ATTENDANCE_REVIEW_EXACT_UNION');parents.set(a.family,before);
 }
 const restored=sourceSets.map(row=>parents.get(row.family)||row);
 reject(sha(JSON.stringify(restored))==='8296e6c92c896b1fe991aaaf9a66b38836c56c34bcb4d4321cdb263cac6432d4','ATTENDANCE_REVIEW_COMPLETE_PARENT_LEDGER');
 const row=f.producer;exact(row,['producer','previousSha256','currentSha256','contractPointers','sourceHistory'],'ATTENDANCE_REVIEW_PRODUCER_KEYS');
 reject(row.producer==='scripts/verify-field-operations-postgres.mjs'&&row.previousSha256==='c3cf9eed8983b9ab43ad9b11cf0f59af206b08ba70f5e6697133bb448b940662'&&row.currentSha256==='4eb11afda80e9274e3fecdc229d12f21d53d29d444e6932e44837f257800ccc2'&&same(row.contractPointers,['/extension/proofs/14/producerSha256']),'ATTENDANCE_REVIEW_PRODUCER_PINS');
 const h=row.sourceHistory;exact(h,['previousBytes','currentBytes','inverseHunks'],'ATTENDANCE_REVIEW_HISTORY_KEYS');
 reject([h.previousBytes,h.currentBytes].every(n=>Number.isSafeInteger(n)&&n>0)&&Array.isArray(h.inverseHunks)&&h.inverseHunks.length>0&&h.inverseHunks.length<=10,'ATTENDANCE_REVIEW_HISTORY_BOUNDS');let end=0;
 for(const block of h.inverseHunks){exact(block,['currentOffsetCharacters','currentText','previousText'],'ATTENDANCE_REVIEW_HUNK_KEYS');reject(Number.isSafeInteger(block.currentOffsetCharacters)&&block.currentOffsetCharacters>=end&&typeof block.currentText==='string'&&typeof block.previousText==='string'&&block.currentText!==block.previousText,'ATTENDANCE_REVIEW_HUNK');end=block.currentOffsetCharacters+block.currentText.length;}
 return restored;
}
function fieldReviewParentFiles(files,row){
 files=consumptionParentFiles(files,row);const a=expected.attendanceReviewRuntime.sourceSetAdvances.find(value=>value.family===row.family);if(!a)return files;
 const parent=files.filter(file=>!a.additions.includes(file));reject(parent.length===a.previousDelta.currentCount&&sha(JSON.stringify(parent))===a.previousDelta.currentPathsSha256,'ATTENDANCE_REVIEW_EXACT_PARENT_SET_'+row.family);return parent;
}
function pilotParentSourceSets(v){
 const p=v.pilotWhatsAppRuntime;
 exact(p,['version','parentHead','sourceAdditions','sourceSetAdvances','producerDeltas','nativeSupplements','nativeOrHumanAcceptance'],'PILOT_KEYS');
 const additions=['src/lib/meta-consumption-evidence-catalog.mjs','src/lib/voice-consumption-draft.mjs'],names=['UNIT','UI_BANK','UI_JOINT','UI_CAUSAL','PG_COMPANY_KYC','PG_FIELD','PG_OVERTIME','PG_PARTICIPANT_KYC_PREANALYSIS','PLAN_MEASUREMENT','CONSUMPTION_FEEDBACK','COMPACT','ORGANIZATION_USAGE','KYC_REPLY_FEEDBACK'];
 reject(p.version===1&&p.parentHead==='756b788f30ac6d778db3a0867548f0c3c27c5c9f'&&same(p.sourceAdditions,additions)&&p.nativeOrHumanAcceptance===false,'PILOT_PARENT');
 reject(Array.isArray(p.sourceSetAdvances)&&same(p.sourceSetAdvances.map(row=>row.family),names),'PILOT_EXACT_THIRTEEN_UNIONS');
 const parentRows=fieldReviewParentSourceSets(v),parents=new Map();for(const a of p.sourceSetAdvances){exact(a,['family','previousDelta'],'PILOT_ADVANCE_KEYS');const before=a.previousDelta;exact(before,['family','contractPointer','previousCount','previousPathsSha256','currentCount','currentPathsSha256','additions'],'PILOT_PARENT_DELTA_KEYS');const row=parentRows.find(row=>row.family===a.family);sorted(before.additions);reject(row&&before.family===a.family&&same(row,{...before,currentCount:before.currentCount+2,currentPathsSha256:row.currentPathsSha256,additions:[...before.additions,...additions].sort()}),'PILOT_ADDITIVE_UNION');parents.set(a.family,before);}
 reject(Array.isArray(p.producerDeltas)&&same(p.producerDeltas.map(row=>row.producer),['scripts/verify-employee-intake-postgres.mjs','scripts/verify-meta-field-bridge-postgres.mjs','scripts/verify-material-inventory-postgres.mjs']),'PILOT_EXACT_PRODUCERS');
 for(const row of p.producerDeltas){exact(row,['producer','previousSha256','currentSha256','contractPointers','sourceHistory'],'PILOT_PRODUCER_KEYS');reject(hash(row.previousSha256)&&hash(row.currentSha256)&&row.previousSha256!==row.currentSha256&&same(row.contractPointers,row.producer==='scripts/verify-employee-intake-postgres.mjs'?['/extension/proofs/2/producerSha256']:[]),'PILOT_PRODUCER_BINDING');const h=row.sourceHistory;exact(h,['previousBytes','currentBytes','inverseHunks'],'PILOT_HISTORY_KEYS');reject([h.previousBytes,h.currentBytes].every(n=>Number.isSafeInteger(n)&&n>0)&&Array.isArray(h.inverseHunks)&&h.inverseHunks.length>0&&h.inverseHunks.length<=3&&(row.producer!=='scripts/verify-employee-intake-postgres.mjs'||h.inverseHunks.length===2),'PILOT_HISTORY_BOUNDS');let end=0;for(const block of h.inverseHunks){exact(block,['currentOffsetCharacters','currentText','previousText'],'PILOT_HUNK_KEYS');reject(Number.isSafeInteger(block.currentOffsetCharacters)&&block.currentOffsetCharacters>=end&&typeof block.currentText==='string'&&typeof block.previousText==='string'&&block.currentText!==block.previousText,'PILOT_HUNK');end=block.currentOffsetCharacters+block.currentText.length;}}
 reject(Array.isArray(p.nativeSupplements)&&same(p.nativeSupplements.map(row=>row.producer),p.producerDeltas.slice(1).map(row=>row.producer)),'PILOT_NATIVE_PRODUCERS');
 for(const row of p.nativeSupplements){exact(row,['producer','previousCheckNames','addedCheckNames','previousChecksSha256','currentChecksSha256','sourceManifestAdvance'],'PILOT_NATIVE_KEYS');const count=row.producer==='scripts/verify-meta-field-bridge-postgres.mjs'?46:24;reject(Array.isArray(row.previousCheckNames)&&row.previousCheckNames.length===count&&Array.isArray(row.addedCheckNames)&&row.addedCheckNames.length===2&&new Set([...row.previousCheckNames,...row.addedCheckNames]).size===count+2&&sha(JSON.stringify(row.previousCheckNames))===row.previousChecksSha256&&sha(JSON.stringify([...row.previousCheckNames,...row.addedCheckNames]))===row.currentChecksSha256,'PILOT_NATIVE_LEDGERS');
  const m=row.sourceManifestAdvance;if(count===46){reject(m===null,'PILOT_BRIDGE_MANIFEST_UNCHANGED');continue;}exact(m,['parentHead','previousFiles','parentFiles','currentFiles','currentManifest'],'PILOT_NATIVE_MANIFEST_KEYS');for(const files of [m.previousFiles,m.parentFiles,m.currentFiles])sorted(files);reject(m.parentHead===p.parentHead&&m.previousFiles.length===125&&m.parentFiles.length===127&&m.currentFiles.length===129&&same(m.parentFiles,[...m.previousFiles,'src/lib/field-hours-report.mjs','src/lib/plan-budget-source.mjs'].sort())&&same(m.currentFiles,[...m.parentFiles,...additions].sort())&&same(m.currentManifest.map(ref=>ref.path),m.currentFiles),'PILOT_NATIVE_MANIFEST_UNION');for(const ref of m.currentManifest){exact(ref,['path','sha256'],'PILOT_NATIVE_CONTENT_KEYS');reject(hash(ref.sha256),'PILOT_NATIVE_CONTENT_HASH');}}
 return parentRows.map(row=>parents.get(row.family)||row);
}
function pilotParentFiles(files,row){
 const p=expected.pilotWhatsAppRuntime,a=p.sourceSetAdvances.find(a=>a.family===row.family);if(!a)return;
 const parent=fieldReviewParentFiles(files,row).filter(file=>!p.sourceAdditions.includes(file));reject(parent.length===a.previousDelta.currentCount&&sha(JSON.stringify(parent))===a.previousDelta.currentPathsSha256,'PILOT_EXACT_PARENT_SET_'+row.family);
}
// This exact current successor preserves every inherited source set and ledger.
const INTAKE_WITHDRAWAL_CHECK_NAMES=Object.freeze([
 'real-PG-signed-pending-withdrawal-preserves-original-envelope-replays-once-and-denies-old-and-current-admission-revisions',
 'real-PG-admission-first-CANCELAR-preserves-person-and-reviewed-permissions-without-revocation'
]);
function intakeWithdrawalDeclaration(v,refs){
 const f=v.intakeWithdrawalRuntime;
 exact(f,['version','parentHead','conversation','producer','native','nativeOrHumanAcceptance','unitProducer'],'INTAKE_RUNTIME_KEYS');
 reject(f.version===1&&f.parentHead==='6058085dcd906251352a7a2cee75bce51d74ae57'&&f.nativeOrHumanAcceptance===false,'INTAKE_PARENT');
 const h=f.conversation;exact(h,['path','previousSha256','currentSha256','previousBytes','currentBytes','inverseHunks'],'INTAKE_CONVERSATION_KEYS');
 reject(h.path==='src/lib/meta-kyc-conversation.mjs'&&h.previousSha256==='17d1e52e826dcaa899e2e6b846e2856c73f73b18b7abfe30e951de0de8623ef6'&&hash(h.currentSha256),'INTAKE_CONVERSATION_PARENT');
 const p=f.producer,parent=v.pilotWhatsAppRuntime.producerDeltas[0];exact(p,['producer','previousSha256','currentSha256','contractPointers','sourceHistory'],'INTAKE_PRODUCER_KEYS');
 reject(p.producer===parent.producer&&p.previousSha256===parent.currentSha256&&p.previousSha256==='66e406926448dc904316728d33c1d1f6cbc38a356e13bc0adee535b0c8427caf'&&hash(p.currentSha256)&&p.currentSha256!==p.previousSha256&&same(p.contractPointers,parent.contractPointers),'INTAKE_PRODUCER_PARENT');
 exact(p.sourceHistory,['previousBytes','currentBytes','inverseHunks'],'INTAKE_PRODUCER_HISTORY_KEYS');reject(p.sourceHistory.previousBytes===parent.sourceHistory.currentBytes,'INTAKE_PRODUCER_PARENT_BYTES');
 const u=f.unitProducer;exact(u,['producer','previousSha256','currentSha256','contractPointers','sourceHistory'],'INTAKE_UNIT_KEYS');exact(u.sourceHistory,['previousBytes','currentBytes','inverseHunks'],'INTAKE_UNIT_HISTORY_KEYS');reject(u.producer==='scripts/verify-participant-bank-intake-contracts.mjs'&&u.previousSha256==='470cdeddcce7ddf8117ca4bffeb45fc2733135aac59b399b468fd915b4b5628f'&&hash(u.currentSha256)&&u.currentSha256!==u.previousSha256&&same(u.contractPointers,['/extension/proofs/0/producerSha256'])&&u.sourceHistory.inverseHunks.length===2,'INTAKE_UNIT_PARENT');
 for(const [name,history] of [['CONVERSATION',h],['PRODUCER',p.sourceHistory],['UNIT_PRODUCER',u.sourceHistory]]){
  reject([history.previousBytes,history.currentBytes].every(n=>Number.isSafeInteger(n)&&n>0)&&Array.isArray(history.inverseHunks)&&history.inverseHunks.length>0&&history.inverseHunks.length<=3,'INTAKE_'+name+'_HISTORY_BOUNDS');let end=0;
  for(const block of history.inverseHunks){exact(block,['currentOffsetCharacters','currentText','previousText'],'INTAKE_'+name+'_HUNK_KEYS');reject(Number.isSafeInteger(block.currentOffsetCharacters)&&block.currentOffsetCharacters>=end&&typeof block.currentText==='string'&&typeof block.previousText==='string'&&block.currentText!==block.previousText,'INTAKE_'+name+'_ORDERED_HUNK');end=block.currentOffsetCharacters+block.currentText.length;}
 }
 const n=f.native;exact(n,['previousCheckNames','addedCheckNames','previousChecksSha256','currentChecksSha256','sourceCount','sourcePathsSha256','currentManifest'],'INTAKE_NATIVE_KEYS');
 reject(Array.isArray(n.previousCheckNames)&&n.previousCheckNames.length===33&&new Set(n.previousCheckNames).size===33&&sha(JSON.stringify(n.previousCheckNames))===n.previousChecksSha256&&same(n.addedCheckNames,INTAKE_WITHDRAWAL_CHECK_NAMES)&&sha(JSON.stringify([...n.previousCheckNames,...n.addedCheckNames]))===n.currentChecksSha256,'INTAKE_NATIVE_LEDGERS');
 reject(n.sourceCount===32&&Array.isArray(n.currentManifest)&&n.currentManifest.length===32,'INTAKE_SOURCE_COUNT');const files=n.currentManifest.map(row=>row.path);sorted(files);reject(sha(JSON.stringify(files))===n.sourcePathsSha256,'INTAKE_SOURCE_PATHS');
 for(const row of n.currentManifest){exact(row,['path','sha256'],'INTAKE_SOURCE_REFERENCE');reject(hash(row.sha256),'INTAKE_SOURCE_DIGEST');}
 reject(n.currentManifest.find(row=>row.path===h.path)?.sha256===h.currentSha256&&refs.get(h.path)?.currentSha256===h.currentSha256&&refs.get(p.producer)?.currentSha256===p.currentSha256,'INTAKE_CURRENT_REFERENCE_JOIN');
}
function intakeWithdrawalSpec(spec){
 const f=compile()&&expected.intakeWithdrawalRuntime,n=f.native;
 return spec?.kind==='PG_INTAKE'&&spec.producer===f.producer.producer&&spec.producerSha256===f.producer.currentSha256&&same(spec.checkNames,n.previousCheckNames)&&same(spec.sourceFiles,n.currentManifest.map(row=>row.path));
}
function intakeWithdrawalCurrentCheckCount(spec){return intakeWithdrawalSpec(spec)?35:null;}
function restoreIntakeWithdrawalText(h,bytes,reason){
 reject(Buffer.isBuffer(bytes)&&bytes.equals(Buffer.from(bytes.toString('utf8'))),'INTAKE_'+reason+'_SOURCE_READER');let text=bytes.toString('utf8').replaceAll('\r\n','\n');reject(sha(text)===h.currentSha256&&Buffer.byteLength(text)===h.currentBytes,'INTAKE_'+reason+'_CURRENT_SOURCE');
 for(const block of [...h.inverseHunks].reverse()){const at=block.currentOffsetCharacters;reject(text.slice(at,at+block.currentText.length)===block.currentText,'INTAKE_'+reason+'_EXACT_SOURCE_HUNK');text=text.slice(0,at)+block.previousText+text.slice(at+block.currentText.length);}
 reject(sha(text)===h.previousSha256&&Buffer.byteLength(text)===h.previousBytes,'INTAKE_'+reason+'_COMPLETE_SOURCE_INVERSE');return Buffer.from(text);
}
function restorePlanBudgetIntakeWithdrawalSource(contract,file,bytes){bytes=integrationParentSource(file,bytes,true);const h=section(contract,true).intakeWithdrawalRuntime.conversation;return file===h.path?restoreIntakeWithdrawalText(h,bytes,'CONVERSATION'):bytes;}
function restorePlanBudgetIntakeWithdrawalProducerText(contract,bytes){const p=section(contract,true).intakeWithdrawalRuntime.producer;return restoreIntakeWithdrawalText({...p.sourceHistory,previousSha256:p.previousSha256,currentSha256:p.currentSha256},bytes,'PRODUCER');}
function restorePlanBudgetIntakeWithdrawalUnitProducerText(contract,bytes){const p=section(contract,true).intakeWithdrawalRuntime.unitProducer;return restoreIntakeWithdrawalText({...p.sourceHistory,previousSha256:p.previousSha256,currentSha256:p.currentSha256},bytes,'UNIT_PRODUCER');}
// Actual source bytes and the complete35 ledger authenticate before the clone
// is projected solely for the unchanged33-check historical consumer.
function normalizePlanBudgetIntakeWithdrawalNativeProof(raw,contract,readSource,spec){
 const current=compile()&&expected.intakeWithdrawalRuntime,historical=contract?.planBudgetCurrentRevision?.intakeWithdrawalRuntime===undefined;
 const captured=new Map(),reader=file=>{if(!captured.has(file)){let bytes;try{bytes=readSource(file);}catch{}reject(Buffer.isBuffer(bytes)&&bytes.equals(Buffer.from(bytes.toString('utf8'))),'INTAKE_SOURCE_READER_'+file);captured.set(file,Buffer.from(bytes));}return Buffer.from(captured.get(file));};
 if(historical){
  reject(plain(contract)&&sha(JSON.stringify(contract,null,2)+'\n')==='2276c0033ba8d429c770d6c6a774344ac8fd8b58a1db805c098ceee4e526a4ad','INTAKE_HISTORICAL_COMPANION');
  reject(spec?.kind==='PG_INTAKE'&&spec.producer===current.producer.producer&&spec.producerSha256===current.producer.previousSha256&&same(spec.checkNames,current.native.previousCheckNames)&&same(spec.sourceFiles,current.native.currentManifest.map(row=>row.path)),'INTAKE_HISTORICAL_SPEC');
  reject(sha(read(reader,spec.producer))===current.producer.previousSha256&&plain(raw)&&raw.harnessSha256===sha(reader(spec.producer)),'INTAKE_HISTORICAL_HARNESS');
  authenticateIntakeManifest(raw,reader,current.native.currentManifest.map(row=>row.path===current.conversation.path?{...row,sha256:current.conversation.previousSha256}:row));
  reject(same(raw.checks,current.native.previousCheckNames),'INTAKE_CHECK_NAMES');for(const key of ['checkCount','totalCheckCount'])if(Object.hasOwn(raw,key))reject(raw[key]===33,'INTAKE_CHECK_NAMES');return {...raw,checks:[...raw.checks]};
 }
 const f=section(contract,true).intakeWithdrawalRuntime;reject(intakeWithdrawalSpec(spec),'INTAKE_CURRENT_SPEC');
 verifyPlanBudgetCurrentSources(contract,reader);restorePlanBudgetIntakeWithdrawalProducerText(contract,reader(f.producer.producer));
 reject(plain(raw)&&raw.harnessSha256===sha(reader(f.producer.producer)),'INTAKE_CURRENT_HARNESS');
 authenticateIntakeManifest(raw,reader,trialExpiryCurrentNativeManifest(section(contract,true),f.native.currentManifest));
 reject(same(raw.checks,[...f.native.previousCheckNames,...f.native.addedCheckNames]),'INTAKE_CHECK_NAMES');for(const key of ['checkCount','totalCheckCount'])if(Object.hasOwn(raw,key))reject(raw[key]===35,'INTAKE_CHECK_NAMES');
 const out={...raw,checks:[...f.native.previousCheckNames]};for(const key of ['checkCount','totalCheckCount'])if(Object.hasOwn(raw,key))out[key]=33;return out;
}
function authenticateIntakeManifest(raw,reader,manifest){
 reject(Array.isArray(raw.sourceManifest)&&raw.sourceManifest.length===32,'INTAKE_SOURCE_MANIFEST');const rows=new Map();
 for(const row of raw.sourceManifest){exact(row,['path','sha256'],'INTAKE_SOURCE_ROW');reject(safe(row.path)&&hash(row.sha256)&&!rows.has(row.path),'INTAKE_SOURCE_ROW');rows.set(row.path,row.sha256);}
 for(const ref of manifest)reject(rows.get(ref.path)===sha(reader(ref.path))&&sha(read(reader,ref.path))===ref.sha256,'INTAKE_CURRENT_SOURCE_'+ref.path);
}

// A closed successor of the accepted efb8 sources. Its two business bodies and
// the changed validator restore independently before any older comparison.
const TRIAL_EXPIRY_SOURCES=[
 {path:'src/lib/participant-onboarding-authority.mjs',previousSha256:'dad5d9fd0a61c493ff02331d5333982627cdeb3a7addb74a3c86d44da931f916'},
 {path:'src/lib/participant-onboarding-reactive.mjs',previousSha256:'666a8c27f3ab7d6fdbe66c91f22ace4e25b04b98e865f401d19c72212916104d'},
];
const TRIAL_EXPIRY_REFERENCES=[
 {path:'scripts/lib/plan-budget-current-ci-lineage.mjs',previousSha256:'007cece11a0b31c7cd2123702b883897019f3af613c9ccaaf680659aa0bb623e'},
 {path:'scripts/lib/attendance-review-current-ci-proof.mjs',previousSha256:'41c08553c902a71c4976d10c94146437974ad37057c4fbdc75411573c884d20d'},
 {path:'tests/production-pilot-whatsapp-current-lineage.test.mjs',previousSha256:'7688f1cd24556f0fae85d722654096b6a1019c77c343f75ece01decb92267a62'},
 {path:'tests/production-field-attendance-current-ci-proof.test.mjs',previousSha256:'765477c84ba9899783cb5f0840d63bae4b129d936a9154ec1e26f97f5c85eed1'},
];
const TRIAL_EXPIRY_VALIDATION={path:'tests/production-plan-measurement-current-source-binding.test.mjs',previousSha256:'e3d963f9740e4d17b3d4e15bcf9b6c34adc569fb988493ec7b10268a42514779'};
function trialExpiryDeclaration(v,refs){
 const r=v.trialExpiryNoticeRuntime;
 exact(r,['version','parentHead','previousContractSha256','sourceAliases','referenceAdvances','validationSourceAdvance','familyManifestAdvances','sourceHistory','nativeOrHumanAcceptance'],'TRIAL_EXPIRY_KEYS');
 reject(r.version===1&&r.parentHead==='efb8ca7ab60923d792c16fe04fcafb90ba4e0815'&&r.previousContractSha256==='22669e9212813ccd711dbfb554e17d274bad7007db8c3dfdbc08bdbbc1847266'&&r.nativeOrHumanAcceptance===false,'TRIAL_EXPIRY_PARENT');
 reject(Array.isArray(r.sourceAliases)&&same(r.sourceAliases.map(a=>({path:a.path,previousSha256:a.previousSha256})),TRIAL_EXPIRY_SOURCES),'TRIAL_EXPIRY_EXACT_ALIASES');
 reject(Array.isArray(r.referenceAdvances)&&same(r.referenceAdvances.map(a=>({path:a.path,previousSha256:a.previousSha256})),TRIAL_EXPIRY_REFERENCES),'TRIAL_EXPIRY_EXACT_REFERENCES');
 for(const a of [...r.sourceAliases,...r.referenceAdvances]){exact(a,['path','previousSha256','currentSha256'],'TRIAL_EXPIRY_REFERENCE_KEYS');reject(hash(a.currentSha256)&&a.currentSha256!==a.previousSha256&&refs.get(a.path)?.currentSha256===a.currentSha256,'TRIAL_EXPIRY_CURRENT_REFERENCE');}
 for(const a of r.sourceAliases)reject(refs.get(a.path)?.previousSha256===a.previousSha256,'TRIAL_EXPIRY_ALIAS_PARENT');
 const validation=r.validationSourceAdvance;exact(validation,['path','previousSha256','currentSha256'],'TRIAL_EXPIRY_VALIDATION_KEYS');reject(same({path:validation.path,previousSha256:validation.previousSha256},TRIAL_EXPIRY_VALIDATION)&&hash(validation.currentSha256)&&validation.currentSha256!==validation.previousSha256&&!refs.has(validation.path)&&same(v.measurementPrivacyRuntime.validationSource,{path:validation.path,sha256:validation.previousSha256}),'TRIAL_EXPIRY_VALIDATION_ADVANCE');
 const histories=[...r.sourceAliases,r.referenceAdvances[0],validation];
 reject(Array.isArray(r.sourceHistory)&&same(r.sourceHistory.map(h=>({path:h.path,previousSha256:h.previousSha256,currentSha256:h.currentSha256})),histories),'TRIAL_EXPIRY_EXACT_HISTORY');
 for(const h of r.sourceHistory){exact(h,['path','previousSha256','currentSha256','previousBytes','currentBytes','inverseHunks'],'TRIAL_EXPIRY_HISTORY_KEYS');reject([h.previousBytes,h.currentBytes].every(n=>Number.isSafeInteger(n)&&n>0)&&Array.isArray(h.inverseHunks)&&h.inverseHunks.length>0,'TRIAL_EXPIRY_HISTORY_BOUNDS');let end=0;for(const b of h.inverseHunks){exact(b,['currentOffsetCharacters','currentText','previousText'],'TRIAL_EXPIRY_HUNK_KEYS');reject(Number.isSafeInteger(b.currentOffsetCharacters)&&b.currentOffsetCharacters>=end&&typeof b.currentText==='string'&&typeof b.previousText==='string'&&b.currentText!==b.previousText,'TRIAL_EXPIRY_ORDERED_HUNKS');end=b.currentOffsetCharacters+b.currentText.length;}}
 const families=['PLAN_MEASUREMENT','CONSUMPTION_FEEDBACK','COMPACT','ORGANIZATION_USAGE','KYC_REPLY_FEEDBACK'];
 const pairs=[...families.flatMap(family=>r.sourceAliases.map(a=>[family,a.path])),...['UI_FOCUSED_WORKSPACE','UI_FIELD_TASK_PAGINATION','PLAN_BUDGET_UI'].map(family=>[family,r.referenceAdvances[0].path])];
 reject(Array.isArray(r.familyManifestAdvances)&&same(r.familyManifestAdvances.map(a=>[a.family,a.path]),pairs),'TRIAL_EXPIRY_EXACT_FAMILIES');
 for(const a of r.familyManifestAdvances){exact(a,['family','path','previousSha256','currentSha256'],'TRIAL_EXPIRY_FAMILY_KEYS');const h=[...r.sourceAliases,r.referenceAdvances[0]].find(h=>h.path===a.path);reject(h&&a.previousSha256===h.previousSha256&&a.currentSha256===h.currentSha256&&v.sourceFamilies.find(f=>f.family===a.family)?.currentManifest.find(h=>h.path===a.path)?.sha256===a.currentSha256,'TRIAL_EXPIRY_FAMILY_JOIN');}
 return trialExpiryParentRevision(v,r);
}
function trialExpiryParentRevision(value,r){
 const parent=structuredClone(value);delete parent.trialExpiryNoticeRuntime;
 for(const a of r.sourceAliases){const rows=parent.references.filter(ref=>ref.path===a.path);reject(rows.length===1&&same(rows[0],{path:a.path,previousSha256:a.previousSha256,currentSha256:a.currentSha256}),'TRIAL_EXPIRY_ADDED_ALIAS');parent.references=parent.references.filter(ref=>ref.path!==a.path);reject(!parent.references.some(ref=>ref.path===a.path),'TRIAL_EXPIRY_PARENT_ALIAS_ABSENT');}
 for(const a of r.referenceAdvances){const ref=parent.references.find(h=>h.path===a.path);reject(ref?.currentSha256===a.currentSha256,'TRIAL_EXPIRY_REFERENCE_RESTORE');ref.currentSha256=a.previousSha256;}
 for(const a of r.familyManifestAdvances){const ref=parent.sourceFamilies.find(f=>f.family===a.family)?.currentManifest.find(h=>h.path===a.path);reject(ref?.sha256===a.currentSha256,'TRIAL_EXPIRY_FAMILY_RESTORE');ref.sha256=a.previousSha256;}
 reject(value.references.length===117&&parent.references.length===115,'TRIAL_EXPIRY_REFERENCE_COUNTS');return parent;
}
function trialExpiryParentContract(contract,r){const out=integrationParentContract(contract);out[PLAN_BUDGET_CURRENT_SECTION]=trialExpiryParentRevision(out[PLAN_BUDGET_CURRENT_SECTION],r);reject(sha(JSON.stringify(out,null,2)+'\n')===r.previousContractSha256,'TRIAL_EXPIRY_COMPLETE_EFB8_CONTRACT');return out;}
function trialExpirySource(r,file,bytes){
 bytes=integrationParentSource(file,bytes,true);
 const h=r.sourceHistory.find(a=>a.path===file);reject(h&&Buffer.isBuffer(bytes)&&bytes.equals(Buffer.from(bytes.toString('utf8'))),'TRIAL_EXPIRY_UTF8_SOURCE');let text=bytes.toString('utf8').replaceAll('\r\n','\n');
 reject(sha(text)===h.currentSha256&&Buffer.byteLength(text)===h.currentBytes,'TRIAL_EXPIRY_CURRENT_SOURCE_'+file);
 for(const b of [...h.inverseHunks].reverse()){const at=b.currentOffsetCharacters;reject(text.slice(at,at+b.currentText.length)===b.currentText,'TRIAL_EXPIRY_EXACT_HUNK_'+file);text=text.slice(0,at)+b.previousText+text.slice(at+b.currentText.length);}
 reject(sha(text)===h.previousSha256&&Buffer.byteLength(text)===h.previousBytes,'TRIAL_EXPIRY_COMPLETE_SOURCE_INVERSE_'+file);return Buffer.from(text);
}
function verifyTrialExpirySources(v,reader){for(const h of v.trialExpiryNoticeRuntime.sourceHistory)trialExpirySource(v.trialExpiryNoticeRuntime,h.path,read(reader,h.path));}
function trialExpiryAdvancedPin(ref){const r=expected.trialExpiryNoticeRuntime,a=[...r.sourceAliases,...r.referenceAdvances,r.validationSourceAdvance].find(a=>a.path===ref.path);if(a?.path===r.validationSourceAdvance.path)reject([a.previousSha256,a.currentSha256].includes(ref.sha256),'TRIAL_EXPIRY_EXACT_VALIDATION_PIN');return a&&ref.sha256===a.previousSha256?a.currentSha256:ref.sha256;}
function trialExpiryPreviousPin(ref){const r=expected.trialExpiryNoticeRuntime,a=[...r.sourceAliases,...r.referenceAdvances,r.validationSourceAdvance].find(a=>a.path===ref.path);if(!a)return ref.sha256;exact(ref,['path','sha256'],'TRIAL_EXPIRY_PREVIOUS_PIN');reject([a.previousSha256,a.currentSha256].includes(ref.sha256),'TRIAL_EXPIRY_EXACT_PREVIOUS_PIN');return a.previousSha256;}
function trialExpiryCurrentNativeManifest(v,manifest){return manifest.map(ref=>{const a=v.trialExpiryNoticeRuntime.sourceAliases.find(a=>a.path===ref.path);if(!a)return ref;reject(ref.sha256===a.previousSha256,'TRIAL_EXPIRY_NATIVE_PARENT_'+ref.path);return {...ref,sha256:a.currentSha256};}).map(ref=>({...ref,sha256:integrationAdvancedPin(ref)}));}
function restorePlanBudgetTrialExpiryNoticePreviousContract(contract){const v=section(contract,true);return trialExpiryParentContract(contract,v.trialExpiryNoticeRuntime);}
function restorePlanBudgetTrialExpiryNoticeSource(contract,file,bytes){const v=section(contract,true);reject(TRIAL_EXPIRY_SOURCES.some(row=>row.path===file),'TRIAL_EXPIRY_BUSINESS_SOURCE');trialExpiryParentContract(contract,v.trialExpiryNoticeRuntime);return trialExpirySource(v.trialExpiryNoticeRuntime,file,bytes);}
function restorePlanBudgetTrialExpiryNoticeValidatorSource(contract,file,bytes){const v=section(contract,true);reject([TRIAL_EXPIRY_REFERENCES[0].path,TRIAL_EXPIRY_VALIDATION.path].includes(file),'TRIAL_EXPIRY_VALIDATOR_SOURCE');trialExpiryParentContract(contract,v.trialExpiryNoticeRuntime);return trialExpirySource(v.trialExpiryNoticeRuntime,file,bytes);}


// Closed binding successor of9248. No accepted Time9537 history is rewritten.
function measurementPrivacyDeclaration(v,refs){
 const r=v.measurementPrivacyRuntime;
 exact(r,['version','parentHead','previousContractSha256','referenceAdvances','familyManifestAdvances','sourceHistory','validationSource','nativeOrHumanAcceptance'],'MEASUREMENT_PRIVACY_KEYS');
 reject(r.version===1&&r.parentHead==='9248b8c521456f586dd8ffb3226136ff6828011a'&&r.previousContractSha256==='eeebf3df17dfc1ab432101c2137b75742323bdce85d3412c67582c84f0cd0c7e'&&r.nativeOrHumanAcceptance===false,'MEASUREMENT_PRIVACY_PARENT');
 const predecessors=[{path:'scripts/lib/plan-budget-current-ci-lineage.mjs',previousSha256:'f018098ba7e12e3b7d144e0ae1ca6ce49af6895dfef372f7cee51ed5083eae8e'},{path:'scripts/lib/plan-measurement-current-ci-lineage.mjs',previousSha256:'d8fb88fffd808ba4fa0ceeb561a8224589adf1f01a4258ee896d8a94dd3e93c9'},{path:'tests/production-plan-measurement-current-ci-lineage.test.mjs',previousSha256:'19704b7e14b3405d0aa1348fd24ddeeae67cac5dc5a52d20bb6936ebf1e98816'}];
 reject(Array.isArray(r.referenceAdvances)&&same(r.referenceAdvances.map(a=>({path:a.path,previousSha256:a.previousSha256})),predecessors),'MEASUREMENT_PRIVACY_EXACT_REFERENCES');
 for(const a of r.referenceAdvances){exact(a,['path','previousSha256','currentSha256'],'MEASUREMENT_PRIVACY_REFERENCE_KEYS');reject(hash(a.currentSha256)&&a.currentSha256!==a.previousSha256&&refs.get(a.path)?.currentSha256===a.currentSha256,'MEASUREMENT_PRIVACY_CURRENT_REFERENCE');}
 reject(Array.isArray(r.sourceHistory)&&same(r.sourceHistory.map(h=>({path:h.path,previousSha256:h.previousSha256,currentSha256:h.currentSha256})),r.referenceAdvances),'MEASUREMENT_PRIVACY_EXACT_HISTORY');
 for(const h of r.sourceHistory){exact(h,['path','previousSha256','currentSha256','previousBytes','currentBytes','inverseHunks'],'MEASUREMENT_PRIVACY_HISTORY_KEYS');reject([h.previousBytes,h.currentBytes].every(n=>Number.isSafeInteger(n)&&n>0)&&Array.isArray(h.inverseHunks)&&h.inverseHunks.length>0,'MEASUREMENT_PRIVACY_HISTORY_BOUNDS');let end=0;for(const b of h.inverseHunks){exact(b,['currentOffsetCharacters','currentText','previousText'],'MEASUREMENT_PRIVACY_HUNK_KEYS');reject(Number.isSafeInteger(b.currentOffsetCharacters)&&b.currentOffsetCharacters>=end&&typeof b.currentText==='string'&&typeof b.previousText==='string'&&b.currentText!==b.previousText,'MEASUREMENT_PRIVACY_ORDERED_HUNKS');end=b.currentOffsetCharacters+b.currentText.length;}}
 exact(r.validationSource,['path','sha256'],'MEASUREMENT_PRIVACY_VALIDATION_KEYS');reject(r.validationSource.path==='tests/production-plan-measurement-current-source-binding.test.mjs'&&hash(r.validationSource.sha256)&&!refs.has(r.validationSource.path),'MEASUREMENT_PRIVACY_VALIDATION_SOURCE');
 const expectedFamilies=[['UI_FOCUSED_WORKSPACE','scripts/lib/plan-budget-current-ci-lineage.mjs'],['UI_FIELD_TASK_PAGINATION','scripts/lib/plan-budget-current-ci-lineage.mjs'],['UI_FIELD_TASK_PAGINATION','scripts/lib/plan-measurement-current-ci-lineage.mjs'],['PLAN_BUDGET_UI','scripts/lib/plan-budget-current-ci-lineage.mjs']];
 reject(Array.isArray(r.familyManifestAdvances)&&same(r.familyManifestAdvances.map(a=>[a.family,a.path]),expectedFamilies),'MEASUREMENT_PRIVACY_EXACT_FAMILIES');
 for(const a of r.familyManifestAdvances){exact(a,['family','path','previousSha256','currentSha256'],'MEASUREMENT_PRIVACY_FAMILY_KEYS');const h=r.referenceAdvances.find(h=>h.path===a.path);reject(h&&a.previousSha256===h.previousSha256&&a.currentSha256===h.currentSha256&&v.sourceFamilies.find(f=>f.family===a.family)?.currentManifest.find(h=>h.path===a.path)?.sha256===a.currentSha256,'MEASUREMENT_PRIVACY_FAMILY_JOIN');}
 return measurementPrivacyParentRevision(v,r);
}
function measurementPrivacyParentRevision(value,r){const parent=structuredClone(value);delete parent.measurementPrivacyRuntime;for(const a of r.referenceAdvances){const ref=parent.references.find(h=>h.path===a.path);reject(ref?.currentSha256===a.currentSha256,'MEASUREMENT_PRIVACY_REFERENCE_RESTORE');ref.currentSha256=a.previousSha256;}for(const a of r.familyManifestAdvances){const ref=parent.sourceFamilies.find(f=>f.family===a.family)?.currentManifest.find(h=>h.path===a.path);reject(ref?.sha256===a.currentSha256,'MEASUREMENT_PRIVACY_FAMILY_RESTORE');ref.sha256=a.previousSha256;}return parent;}
function measurementPrivacyParentContract(contract,r){const out=trialExpiryParentContract(contract,contract[PLAN_BUDGET_CURRENT_SECTION].trialExpiryNoticeRuntime);out[PLAN_BUDGET_CURRENT_SECTION]=measurementPrivacyParentRevision(out[PLAN_BUDGET_CURRENT_SECTION],r);reject(sha(JSON.stringify(out,null,2)+'\n')===r.previousContractSha256,'MEASUREMENT_PRIVACY_COMPLETE_9248_CONTRACT');return out;}
function measurementPrivacySource(r,file,bytes){if(file==='scripts/lib/plan-budget-current-ci-lineage.mjs')bytes=trialExpirySource(expected.trialExpiryNoticeRuntime,file,bytes);const h=r.sourceHistory.find(a=>a.path===file);reject(h&&Buffer.isBuffer(bytes)&&bytes.equals(Buffer.from(bytes.toString('utf8'))),'MEASUREMENT_PRIVACY_UTF8_SOURCE');let text=bytes.toString('utf8').replaceAll('\r\n','\n');reject(sha(text)===h.currentSha256&&Buffer.byteLength(text)===h.currentBytes,'MEASUREMENT_PRIVACY_CURRENT_SOURCE_'+file);for(const b of [...h.inverseHunks].reverse()){const at=b.currentOffsetCharacters;reject(text.slice(at,at+b.currentText.length)===b.currentText,'MEASUREMENT_PRIVACY_EXACT_HUNK_'+file);text=text.slice(0,at)+b.previousText+text.slice(at+b.currentText.length);}reject(sha(text)===h.previousSha256&&Buffer.byteLength(text)===h.previousBytes,'MEASUREMENT_PRIVACY_COMPLETE_SOURCE_INVERSE_'+file);return Buffer.from(text);}
function verifyMeasurementPrivacySources(v,reader){for(const h of v.measurementPrivacyRuntime.sourceHistory)measurementPrivacySource(v.measurementPrivacyRuntime,h.path,read(reader,h.path));const ref=v.measurementPrivacyRuntime.validationSource;reject(sha(trialExpirySource(v.trialExpiryNoticeRuntime,ref.path,read(reader,ref.path)))===ref.sha256,'MEASUREMENT_PRIVACY_VALIDATION_BYTES');}
function measurementPrivacyAdvancedPin(ref){const h=expected.measurementPrivacyRuntime.referenceAdvances.find(h=>h.path===ref.path);return h&&ref.sha256===h.previousSha256?h.currentSha256:ref.sha256;}
function restorePlanBudgetMeasurementPrivacyPreviousContract(contract){const v=section(contract,true);return measurementPrivacyParentContract(contract,v.measurementPrivacyRuntime);}
function restorePlanBudgetMeasurementPrivacySource(contract,file,bytes){return measurementPrivacySource(section(contract,true).measurementPrivacyRuntime,file,bytes);}

// Exact display-only successor of Git9537. Current readers always retain actual
// bytes; only fully authenticated local values may project into older lineage.
function checkTimeDeclaration(v,refs){
 const r=v.checkTimeRuntime;
 exact(r,['version','parentHead','previousContractSha256','sourceHistory','frozenLiveHoursPins','referenceAdvances','familyManifestAdvances','nativeOrHumanAcceptance'],'CHECK_TIME_KEYS');
 reject(r.version===1&&r.parentHead==='9537a0a68cfffff6c68de6f71696aca20ed94ae7'&&r.previousContractSha256==='18eaa0eec2d952cbfa130d1d245322e779c3b7eabffc704c453cdde834933c4c'&&r.nativeOrHumanAcceptance===false,'CHECK_TIME_PARENT');
 reject(sha(JSON.stringify(r.sourceHistory))==='9e24953f0d6577c99aa9e305459b9e280fa1b0039420bd1033ff3fa13b14b019'&&same(r.frozenLiveHoursPins,[{"index":11,"path":"src/app/(identity)/cuenta/workspace-live-refresh-controller.mjs","sha256":"a61c2d017bc8dadb79fab4b0630b0404b65132d355e153bcb6a2042f5fd49511"},{"index":12,"path":"src/app/(identity)/cuenta/workspace-live-refresh.js","sha256":"78b056667e89f56fd9e1185c3addc6a8d40b331a0cd82146cbba17771662510a"},{"index":23,"path":"tests/production-worksite-live-refresh-controller.test.mjs","sha256":"2774f4fe72e2f3ebc59e73f833e50ea46ad920fabb7e66460021ac82c5f5ed38"}]),'CHECK_TIME_EXACT_FOUR_SOURCES');
 for(const h of r.sourceHistory){exact(h,['path','previousSha256','currentSha256','previousBytes','currentBytes','inverseHunks'],'CHECK_TIME_HISTORY_KEYS');reject(!refs.has(h.path)&&safe(h.path)&&hash(h.previousSha256)&&hash(h.currentSha256)&&h.previousSha256!==h.currentSha256&&[h.previousBytes,h.currentBytes].every(n=>Number.isSafeInteger(n)&&n>0),'CHECK_TIME_SOURCE_PINS');let end=0;for(const b of h.inverseHunks){exact(b,['currentOffsetCharacters','currentText','previousText'],'CHECK_TIME_HUNK_KEYS');reject(Number.isSafeInteger(b.currentOffsetCharacters)&&b.currentOffsetCharacters>=end&&typeof b.currentText==='string'&&typeof b.previousText==='string'&&b.currentText!==b.previousText,'CHECK_TIME_ORDERED_HUNKS');end=b.currentOffsetCharacters+b.currentText.length;}}
 reject(Array.isArray(r.referenceAdvances)&&same(r.referenceAdvances.map(row=>({path:row.path,previousSha256:row.previousSha256})),[{"path":"scripts/lib/plan-budget-current-ci-lineage.mjs","previousSha256":"66f58fe1a4e9ed93da214243d6ff6d94038ed2151a2c0b9b765c517007462597"},{"path":"tests/production-pilot-whatsapp-current-lineage.test.mjs","previousSha256":"ddc238a6e9c128a5df2e772ee702fc935903c2e03fcb8f3f29879412bf6e02c2"}]),'CHECK_TIME_REFERENCE_PREDECESSORS');
 for(const a of r.referenceAdvances){exact(a,['path','previousSha256','currentSha256'],'CHECK_TIME_REFERENCE_KEYS');reject(hash(a.currentSha256)&&a.currentSha256!==a.previousSha256&&refs.get(a.path)?.currentSha256===a.currentSha256,'CHECK_TIME_CURRENT_REFERENCE');}
 reject(Array.isArray(r.familyManifestAdvances)&&r.familyManifestAdvances.length>0,'CHECK_TIME_FAMILY_ADVANCES');const unique=new Set();for(const a of r.familyManifestAdvances){exact(a,['family','path','previousSha256','currentSha256'],'CHECK_TIME_FAMILY_KEYS');const id=a.family+'\0'+a.path,h=[...r.sourceHistory,...r.referenceAdvances].find(row=>row.path===a.path);reject(!unique.has(id)&&h&&a.previousSha256===h.previousSha256&&a.currentSha256===h.currentSha256&&v.sourceFamilies.find(row=>row.family===a.family)?.currentManifest.find(row=>row.path===a.path)?.sha256===a.currentSha256,'CHECK_TIME_EXACT_FAMILY_PIN');unique.add(id);}
 for(const family of v.sourceFamilies)for(const ref of family.currentManifest)if([...r.sourceHistory,...r.referenceAdvances].some(h=>h.path===ref.path))reject(unique.has(family.family+'\0'+ref.path),'CHECK_TIME_COMPLETE_FAMILY_ADVANCES');
}
function checkTimeSource(r,file,bytes){
 const h=r.sourceHistory.find(row=>row.path===file);reject(Boolean(h),'CHECK_TIME_LISTED_SOURCE');
 reject(Buffer.isBuffer(bytes)&&bytes.equals(Buffer.from(bytes.toString('utf8'))),'CHECK_TIME_UTF8_SOURCE');let text=bytes.toString('utf8').replaceAll('\r\n','\n');reject(sha(text)===h.currentSha256&&Buffer.byteLength(text)===h.currentBytes,'CHECK_TIME_CURRENT_SOURCE_'+file);
 for(const b of [...h.inverseHunks].reverse()){const at=b.currentOffsetCharacters;reject(text.slice(at,at+b.currentText.length)===b.currentText,'CHECK_TIME_EXACT_HUNK_'+file);text=text.slice(0,at)+b.previousText+text.slice(at+b.currentText.length);}
 reject(sha(text)===h.previousSha256&&Buffer.byteLength(text)===h.previousBytes,'CHECK_TIME_COMPLETE_SOURCE_INVERSE_'+file);return Buffer.from(text);
}
function restorePlanBudgetCheckTimeSource(contract,file,bytes){return checkTimeSource(section(contract,true).checkTimeRuntime,file,bytes);}
function verifyCheckTimeSources(v,readSource){for(const h of v.checkTimeRuntime.sourceHistory)checkTimeSource(v.checkTimeRuntime,h.path,read(readSource,h.path));}
// Authenticate the entire parent contract before the existing9537→8b inverse.
// No historical source text is ever installed as the caller's current reader.
function restorePlanBudgetCheckTimePreviousContract(contract){
 const v=section(contract,true),r=v.checkTimeRuntime,out=measurementPrivacyParentContract(contract,v.measurementPrivacyRuntime),p=out[PLAN_BUDGET_CURRENT_SECTION];
 for(const pin of r.frozenLiveHoursPins)reject(same(out.worksiteLiveHoursCurrentRevision?.newSources?.[pin.index],{path:pin.path,sha256:pin.sha256}),'CHECK_TIME_FROZEN_LIVE_HOURS_PIN');
 delete p.checkTimeRuntime;
 for(const a of r.referenceAdvances){const ref=p.references.find(row=>row.path===a.path);reject(ref?.currentSha256===a.currentSha256,'CHECK_TIME_REFERENCE_RESTORE');ref.currentSha256=a.previousSha256;}
 for(const a of r.familyManifestAdvances){const ref=p.sourceFamilies.find(row=>row.family===a.family)?.currentManifest.find(row=>row.path===a.path);reject(ref?.sha256===a.currentSha256,'CHECK_TIME_FAMILY_RESTORE');ref.sha256=a.previousSha256;}
 reject(sha(JSON.stringify(out,null,2)+'\n')===r.previousContractSha256,'CHECK_TIME_COMPLETE_9537_CONTRACT');return out;
}

function compile(){
 if(compiled)return compiled;const v=expected;
 exact(v,['version','status','finalAstDerived','predecessorSource','previousContractSha256','references','sourceSetDeltas','sourceFamilies','ownership','browser','nativeOrBrowserAcceptance','pilotWhatsAppRuntime','attendanceReviewRuntime','consumptionEvidenceRuntime','intakeWithdrawalRuntime','checkTimeRuntime','measurementPrivacyRuntime','trialExpiryNoticeRuntime'],'COMPILED_KEYS');
 reject(v.version===1&&v.status==='REVIEWED_SOURCE_ONLY'&&v.finalAstDerived===true&&v.previousContractSha256===previousHash&&v.nativeOrBrowserAcceptance===false,'FINAL_BINDINGS_PENDING');
 reject(same(v.predecessorSource,{baseCommit:'2148772241e9ed724d46a4e8f3f4888e4677fa1e',reviewedCorrectionResultSha256:'d0960e36ee385cf5d92e19bbf7b6798e1a832a29bffe9fe193bee57b58277463'}),'PREDECESSOR_SOURCE');
 reject(Array.isArray(v.references)&&v.references.length>=6&&Array.isArray(v.sourceSetDeltas)&&Array.isArray(v.sourceFamilies)&&v.sourceFamilies.length===16,'COMPLETE_BINDINGS');
 // Preserve the complete inherited delta ledger; only this AST-derived UI advance is authorized.
 const consumptionUiDelta={"family":"CONSUMPTION_FEEDBACK_UI","contractPointer":null,"previousCount":26,"previousPathsSha256":"710e01893f5a62e3889bdaddca949989edac48b312c75ea419ea822b744c864a","currentCount":28,"currentPathsSha256":"ac29e18d380c5706e620702b48fd9510f5d358bc857a5cb4a08d0c49561de16e","additions":["src/app/(identity)/cuenta/field-media-preview.js","src/app/(identity)/cuenta/field-operations-panel.module.css"]};
 reject(same(consumptionParentSourceSets(v).filter(row=>row?.family==='CONSUMPTION_FEEDBACK_UI'),[consumptionUiDelta])&&sha(JSON.stringify(pilotParentSourceSets(v).filter(row=>row?.family!=='CONSUMPTION_FEEDBACK_UI')))==='380e99f8cf321760f4b64c8e52810d4ceb9e0890d8059dce1ca549a568b56cbd','EXACT_CONSUMPTION_UI_ADVANCEMENT');
 const refs=new Map(),sets=new Map(),families=new Map();for(const row of v.references){exact(row,['path','previousSha256','currentSha256'],'REFERENCE_KEYS');reject(safe(row.path)&&row.path!==anchor&&!refs.has(row.path)&&hash(row.currentSha256)&&(row.previousSha256===null||hash(row.previousSha256)),'REFERENCE');refs.set(row.path,row);}
 for(const file of v.consumptionEvidenceRuntime.sourceAdditions)reject(refs.has(file),'CONSUMPTION_EVIDENCE_CURRENT_REFERENCE_'+file);reject(refs.get(v.consumptionEvidenceRuntime.sourceHistory.path)?.currentSha256===v.consumptionEvidenceRuntime.sourceHistory.currentSha256,'CONSUMPTION_EVIDENCE_CURRENT_WRAPPER_REFERENCE');reject(refs.get(v.consumptionEvidenceRuntime.materialNative.producer)?.currentSha256===v.consumptionEvidenceRuntime.materialNative.sourceHistory.currentSha256,'MATERIAL_NATIVE_CURRENT_REFERENCE');
 intakeWithdrawalDeclaration(v,refs);const trialParent=trialExpiryDeclaration(v,refs),timeParent=measurementPrivacyDeclaration(trialParent,new Map(trialParent.references.map(row=>[row.path,row])));checkTimeDeclaration(timeParent,new Map(timeParent.references.map(row=>[row.path,row])));
 for(const row of v.sourceSetDeltas){exact(row,['family','contractPointer','previousCount','previousPathsSha256','currentCount','currentPathsSha256','additions'],'SOURCE_SET_KEYS');sorted(row.additions);reject(typeof row.family==='string'&&!sets.has(row.family)&&row.additions.length>0&&row.currentCount===row.previousCount+row.additions.length&&hash(row.previousPathsSha256)&&hash(row.currentPathsSha256)&&(row.contractPointer===null||/^\/extension\/proofs\/(?:[0-9]|1[0-9]|20)\/sourceFiles$/.test(row.contractPointer)),'SOURCE_SET');sets.set(row.family,row);}
 for(const row of v.sourceFamilies){exact(row,['family','previousFiles','previousExternalImports','currentFiles','externalImports','currentManifest'],'FAMILY_KEYS');sorted(row.previousFiles);sorted(row.currentFiles);reject(!families.has(row.family)&&Array.isArray(row.externalImports)&&Array.isArray(row.previousExternalImports)&&same(row.currentManifest.map(x=>x.path),row.currentFiles),'FAMILY');for(const ref of row.currentManifest){exact(ref,['path','sha256'],'MANIFEST_REFERENCE');reject(ref.path===anchor?ref.sha256==='REVIEWED_DECLARATION_TRUST_ANCHOR':hash(ref.sha256),'MANIFEST_DIGEST');}const delta=sets.get(row.family);if(delta)reject(same(previousFiles(row.currentFiles,delta),row.previousFiles),'FAMILY_SOURCE_DELTA_JOIN');families.set(row.family,row);}
 reject(families.has('PLAN_BUDGET_UI'),'BUDGET_FAMILY');
 const o=v.ownership;exact(o,['block','producer','proof','retainedArtifact'],'OWNERSHIP_KEYS');reject(o.block.id===66&&typeof o.block.step?.run==='string'&&sha(o.block.step.run)===o.block.commandSha256&&o.retainedArtifact===PLAN_BUDGET_CI_PROOF_PATH,'BLOCK');
 exact(o.proof,['id','lane','blockId','path','kind','producer','producerSha256','sourceFiles','checkNames'],'PROOF_KEYS');sorted(o.proof.sourceFiles);reject(o.proof.id==='budget-source-ui'&&o.proof.lane==='plans'&&o.proof.blockId===66&&o.proof.path===PLAN_BUDGET_CI_PROOF_PATH&&o.proof.kind===PLAN_BUDGET_CI_KIND&&o.proof.producer==='scripts/verify-plan-budget-ui.mjs'&&hash(o.proof.producerSha256)&&same(o.proof.sourceFiles,families.get('PLAN_BUDGET_UI').currentFiles)&&Array.isArray(o.proof.checkNames)&&o.proof.checkNames.length===23&&new Set(o.proof.checkNames).size===23,'PROOF');
 exact(o.producer,['producer','path','retained','blockId','lane','sourceLine','producerSha256','sourceBasis'],'PRODUCER_KEYS');reject(o.producer.producer===o.proof.producer&&o.producer.path===o.proof.path&&o.producer.retained===true&&o.producer.blockId===66&&o.producer.lane==='plans'&&Number.isSafeInteger(o.producer.sourceLine)&&o.producer.sourceLine>0&&o.producer.producerSha256===o.proof.producerSha256&&o.producer.sourceBasis==='EXPECTED_HEAD_GIT_BYTES','PRODUCER');
 const b=v.browser;exact(b,['producer','producerLfSha256','investmentSourceCount','investmentSourcePathsSha256','historicalCheckCount','supplementCheckCount','combinedCheckCount','rawSupplementPath','ciProofPath','retainedScreenshots'],'BROWSER_KEYS');reject(b.producer==='scripts/verify-plan-import-ui.mjs'&&hash(b.producerLfSha256)&&Number.isSafeInteger(b.investmentSourceCount)&&b.investmentSourceCount>0&&hash(b.investmentSourcePathsSha256)&&b.historicalCheckCount===180&&b.supplementCheckCount===23&&b.combinedCheckCount===203&&b.rawSupplementPath==='.vercel/private/plan-budget-ui-validation.json'&&b.ciProofPath===PLAN_BUDGET_CI_PROOF_PATH&&b.retainedScreenshots.length===23,'BROWSER');
 for(const row of b.retainedScreenshots)reject(same(Object.keys(row).sort(),['mode','path','width'])&&['UPLOAD_ADMIN','UPLOAD_DIRECTOR','THREE_VIEWS_EXACT_JOIN','AMBIGUOUS_SOURCE','TRUNCATED_LIST','ROLE_DOWNGRADE','HTML_403','CONTEXT_LATE_SUCCESS','OLD_OWNER_LATE_403','DETAIL_FALSE_AUTHORITY'].includes(row.mode)&&[320,390,768,1280].includes(row.width)&&row.path==='.vercel/private/plan-import-ui-budget-'+row.mode.toLowerCase()+'-'+row.width+'.png','SCREENSHOT');
 compiled={refs,sets,families,text:declaration(v)};return compiled;
}
function section(contract,required=false){reject(plain(contract),'CONTRACT');if(!Object.hasOwn(contract,PLAN_BUDGET_CURRENT_SECTION)){reject(!required,'BUDGET_COMPANION_REQUIRED');return null;}compile();reject(JSON.stringify(contract[PLAN_BUDGET_CURRENT_SECTION])===currentExpectedJson,'IMMUTABLE_COMPANION');return expected;}
function previousFiles(files,row){sorted(files);reject(files.length===row.currentCount&&sha(JSON.stringify(files))===row.currentPathsSha256&&row.additions.every(file=>files.includes(file)),'CURRENT_SOURCE_SET_'+row.family);pilotParentFiles(files,row);const old=files.filter(file=>!row.additions.includes(file));reject(old.length===row.previousCount&&sha(JSON.stringify(old))===row.previousPathsSha256,'PREVIOUS_SOURCE_SET_'+row.family);return old;}
function restorePlanBudgetPreviousContract(contract){
 const v=section(contract);if(!v)return contract;const out=restorePlanBudgetCheckTimePreviousContract(contract),o=v.ownership;delete out[PLAN_BUDGET_CURRENT_SECTION];
 for(const intake of [v.intakeWithdrawalRuntime.producer,v.intakeWithdrawalRuntime.unitProducer])for(const pointer of intake.contractPointers){const index=Number(/^\/extension\/proofs\/(\d+)\/producerSha256$/.exec(pointer)[1]),spec=out.extension.proofs[index];reject(spec?.producer===intake.producer&&spec.producerSha256===intake.currentSha256,'INTAKE_CURRENT_PRODUCER');spec.producerSha256=intake.previousSha256;}
 for(const row of [...v.pilotWhatsAppRuntime.producerDeltas,v.attendanceReviewRuntime.producer])for(const pointer of row.contractPointers){const index=Number(/^\/extension\/proofs\/(\d+)\/producerSha256$/.exec(pointer)[1]),spec=out.extension.proofs[index];reject(spec?.producer===row.producer&&spec.producerSha256===row.currentSha256,'PILOT_CURRENT_PRODUCER');spec.producerSha256=row.previousSha256;}
 const remove=(array,wanted,reason)=>{reject(Array.isArray(array)&&same(array.at(-1),wanted)&&array.filter(row=>same(row,wanted)).length===1,reason);array.pop();};
 remove(out.blocks,o.block,'BLOCK_APPEND');remove(out.lanes.plans.blocks,66,'LANE_BLOCK_APPEND');remove(out.artifactPatterns,o.retainedArtifact,'GLOBAL_ARTIFACT_APPEND');remove(out.lanes.plans.artifacts,o.retainedArtifact,'LANE_ARTIFACT_APPEND');remove(out.lanes.plans.requiredRetainedEvidence,o.retainedArtifact,'REQUIRED_ARTIFACT_APPEND');remove(out.evidenceProducers,o.producer,'PRODUCER_APPEND');remove(out.extension.proofs,o.proof,'PROOF_APPEND');
 for(const row of v.sourceSetDeltas)if(row.contractPointer){const index=Number(/^\/extension\/proofs\/(\d+)\/sourceFiles$/.exec(row.contractPointer)[1]),spec=out.extension.proofs[index];reject(spec?.kind===row.family,'TYPED_SOURCE_POINTER');spec.sourceFiles=previousFiles(spec.sourceFiles,row);}
 reject(sha(JSON.stringify(out,null,2)+'\n')===previousHash,'EXACT_COMPOSED11_CONTRACT_INVERSE');return out;
}
// Pin aliases read only the immutable reviewed index. Full contract validation
// remains mandatory at validate/verify/restore boundaries; caller data is never an oracle.
function parentPlanBudgetCurrentSourcePin(contract,ref){if(!plain(contract)||!Object.hasOwn(contract,PLAN_BUDGET_CURRENT_SECTION))return ref.sha256;exact(ref,['path','sha256'],'SOURCE_PIN');ref={...ref,sha256:trialExpiryAdvancedPin({...ref,sha256:measurementPrivacyAdvancedPin(ref)})};const time=(compile()&&expected.checkTimeRuntime.sourceHistory).find(row=>row.path===ref.path);if(time){reject([time.previousSha256,time.currentSha256].includes(ref.sha256),'CHECK_TIME_EXACT_SOURCE_PIN');return time.currentSha256;}const row=compile().refs.get(ref.path);if(!row)return ref.sha256;reject([row.previousSha256,row.currentSha256].filter(Boolean).includes(ref.sha256),'EXACT_PREVIOUS_CURRENT_PIN_'+ref.path);return row.currentSha256;}
function parentPlanBudgetPreviousSourcePin(contract,ref){if(!plain(contract)||!Object.hasOwn(contract,PLAN_BUDGET_CURRENT_SECTION))return ref.sha256;ref={...ref,sha256:trialExpiryPreviousPin({...ref,sha256:measurementPrivacyAdvancedPin(ref)})};const time=(compile()&&expected.checkTimeRuntime.sourceHistory).find(row=>row.path===ref.path);if(time){exact(ref,['path','sha256'],'CHECK_TIME_PREVIOUS_SOURCE_PIN');reject([time.previousSha256,time.currentSha256].includes(ref.sha256),'CHECK_TIME_EXACT_PREVIOUS_PIN');return time.previousSha256;}const row=compile().refs.get(ref.path);return row?.previousSha256&&ref.sha256===row.currentSha256?row.previousSha256:ref.sha256;}
function restorePlanBudgetSourceSet(contract,family,files){if(!section(contract))return files;const row=compile().sets.get(family);if(!row)return files;sorted(files);if(files.length===row.previousCount&&sha(JSON.stringify(files))===row.previousPathsSha256)return [...files];return previousFiles(files,row);}
function planBudgetProofSourceAdditions(spec){const row=compile().sets.get(spec?.kind);if(!row)return[];sorted(spec.sourceFiles);const files=spec.sourceFiles;if(files.length===row.currentCount&&sha(JSON.stringify(files))===row.currentPathsSha256){previousFiles(files,row);return [...row.additions];}if(files.length===row.previousCount&&sha(JSON.stringify(files))===row.previousPathsSha256)return[];reject(files.length<row.previousCount&&!row.additions.some(file=>files.includes(file)),'UNKNOWN_EARLIER_SOURCE_SET');return[];}
function verifyPlanBudgetCurrentSources(contract,readSource){const v=section(contract,true);verifyIntegrationActualSources(contract,readSource);readSource=integrationParentReader(readSource);verifyTrialExpirySources(v,readSource);verifyMeasurementPrivacySources(v,readSource);verifyCheckTimeSources(v,readSource);restorePlanBudgetPreviousContract(contract);reject(read(readSource,anchor).toString()===compile().text,'DECLARATION_BYTES');for(const row of v.references)reject(sha(read(readSource,row.path))===row.currentSha256,'CURRENT_SOURCE_'+row.path);for(const row of v.pilotWhatsAppRuntime.producerDeltas)restorePlanBudgetPilotProducerText(contract,row.producer,read(readSource,row.producer));restorePlanBudgetAttendanceReviewProducerText(contract,read(readSource,v.attendanceReviewRuntime.producer.producer));restorePlanBudgetIntakeWithdrawalSource(contract,v.intakeWithdrawalRuntime.conversation.path,read(readSource,v.intakeWithdrawalRuntime.conversation.path));restorePlanBudgetIntakeWithdrawalUnitProducerText(contract,read(readSource,v.intakeWithdrawalRuntime.unitProducer.producer));return {completePreviousContractRestored:true,previousContractSha256:previousHash,referenceCount:currentExpected.references.length,nativeOrBrowserAcceptance:false};}
function verifyPlanBudgetActualClosure(contract,family,closure,readSource){const v=section(contract,true);verifyIntegrationActualSources(contract,readSource);const actual=currentExpected.sourceFamilies.find(row=>row.family===family);reject(Boolean(actual),'INTEGRATION_CURRENT_FAMILY');for(const ref of actual.currentManifest){const bytes=read(readSource,ref.path);reject(ref.path===anchor?bytes.toString()===declaration(currentExpected):sha(bytes)===ref.sha256,'INTEGRATION_CURRENT_FAMILY_SOURCE_'+ref.path);}readSource=integrationParentReader(readSource);verifyTrialExpirySources(v,readSource);verifyMeasurementPrivacySources(v,readSource);verifyCheckTimeSources(v,readSource);restorePlanBudgetPreviousContract(contract);const row=compile().families.get(family);reject(Boolean(row),'EXPLICIT_FAMILY');exact(closure,['files','externalImports'],'CLOSURE_KEYS');reject(same(closure.files,row.currentFiles)&&same(closure.externalImports,row.externalImports),'EXACT_CURRENT_CLOSURE');for(const ref of row.currentManifest){const bytes=read(readSource,ref.path);reject(ref.path===anchor?bytes.toString()===compile().text:sha(bytes)===ref.sha256,'CURRENT_FAMILY_SOURCE_'+ref.path);}return {family,sourceCount:row.currentFiles.length,sourcePathsSha256:sha(JSON.stringify(row.currentFiles)),nativeOrBrowserAcceptance:false};}
function restorePlanBudgetClosure(contract,family,closure){if(!section(contract))return closure;const row=compile().families.get(family);reject(Boolean(row),'EXPLICIT_FAMILY');reject(same(closure.files,row.currentFiles)&&same(closure.externalImports,row.externalImports),'EXACT_CURRENT_CLOSURE');return {files:[...row.previousFiles],externalImports:[...row.previousExternalImports]};}
function planBudgetValidationFiles(contract){const v=section(contract);return v?[...new Set([anchor,...currentExpected.references.map(row=>row.path),...v.checkTimeRuntime.sourceHistory.map(row=>row.path),v.measurementPrivacyRuntime.validationSource.path])].sort():[];}
function planBudgetCurrentBrowserBinding(contract,fallback){const v=section(contract);return v?{...fallback,producerLfSha256:v.browser.producerLfSha256,investmentSourceCount:v.browser.investmentSourceCount,investmentSourcePathsSha256:v.browser.investmentSourcePathsSha256}:fallback;}
function planBudgetCompiledProof(contract){const v=section(contract,true);restorePlanBudgetPreviousContract(contract);return structuredClone(v.ownership.proof);}
function planBudgetRetainedScreenshotPaths(contract){const v=section(contract,true);return v.browser.retainedScreenshots.map(row=>row.path);}

// Historical source reconstruction only. Actual receipts keep the current raw
// harness hash and manifest; no old source is substituted into current readers.
function restorePlanBudgetPilotProducerText(contract,producer,bytes){
 const v=section(contract,true),row=v.pilotWhatsAppRuntime.producerDeltas.find(row=>row.producer===producer);if(producer===v.intakeWithdrawalRuntime.producer.producer)bytes=restorePlanBudgetIntakeWithdrawalProducerText(contract,bytes);if(producer===v.consumptionEvidenceRuntime.materialNative.producer)bytes=restorePlanBudgetMaterialNativeProducerText(contract,bytes);reject(row&&Buffer.isBuffer(bytes)&&bytes.equals(Buffer.from(bytes.toString('utf8'))),'PILOT_SOURCE_READER');let text=bytes.toString('utf8').replaceAll('\r\n','\n');reject(sha(text)===row.currentSha256&&Buffer.byteLength(text)===row.sourceHistory.currentBytes,'PILOT_CURRENT_SOURCE');
 for(const h of [...row.sourceHistory.inverseHunks].reverse()){const at=h.currentOffsetCharacters;reject(text.slice(at,at+h.currentText.length)===h.currentText,'PILOT_EXACT_SOURCE_HUNK');text=text.slice(0,at)+h.previousText+text.slice(at+h.currentText.length);}
 reject(sha(text)===row.previousSha256&&Buffer.byteLength(text)===row.sourceHistory.previousBytes,'PILOT_COMPLETE_SOURCE_INVERSE');return Buffer.from(text);
}
// Require the new producer's complete 48/26 ledger before projecting only for
// its existing historical decoder. This never mutates or relabels the raw proof.
function normalizePlanBudgetPilotNativeProof(contract,producer,proof,readSource){
 const v=section(contract);if(!v)return proof;verifyPlanBudgetCurrentSources(contract,readSource);const n=v.pilotWhatsAppRuntime.nativeSupplements.find(row=>row.producer===producer);reject(Boolean(n),'PILOT_NATIVE_PRODUCER');const bytes=read(readSource,producer);restorePlanBudgetPilotProducerText(contract,producer,bytes);
 reject(plain(proof)&&Array.isArray(proof.checks)&&same(proof.checks,[...n.previousCheckNames,...n.addedCheckNames]),'PILOT_COMPLETE_NATIVE_LEDGER');if(Object.hasOwn(proof,'checkCount'))reject(proof.checkCount===proof.checks.length,'PILOT_NATIVE_COUNT');
 const projected={...proof,checks:[...n.previousCheckNames]};if(Object.hasOwn(proof,'checkCount'))projected.checkCount=n.previousCheckNames.length;
 const parentManifest=n.sourceManifestAdvance,m=parentManifest?{...parentManifest,...v.consumptionEvidenceRuntime.materialNative}:null;if(m){const actual=[];for(const ref of trialExpiryCurrentNativeManifest(v,m.currentManifest)){let bytes;try{bytes=readSource(ref.path);}catch{}reject(Buffer.isBuffer(bytes)&&bytes.equals(Buffer.from(bytes.toString('utf8')))&&sha(bytes.toString('utf8').replaceAll('\r\n','\n'))===ref.sha256,'PILOT_CURRENT_NATIVE_SOURCE_'+ref.path);actual.push({path:ref.path,sha256:sha(bytes)});}reject(same(proof.sourceManifest,actual)&&proof.harnessSha256===actual.find(ref=>ref.path===producer)?.sha256,'PILOT_COMPLETE_NATIVE_MANIFEST');projected.sourceManifest=proof.sourceManifest.filter(ref=>parentManifest.previousFiles.includes(ref.path));}
 return projected;
}

// Current-to-parent projections are local data operations only. They never
// replace the caller's actual source reader or declare native acceptance.
function restorePlanBudgetFieldReviewSourceSet(contract,family,files){
 if(!section(contract))return files;sorted(files);files=restorePlanBudgetConsumptionEvidenceSourceSet(contract,family,files);const a=expected.attendanceReviewRuntime.sourceSetAdvances.find(row=>row.family===family);if(!a)return [...files];
 const row=consumptionParentSourceSets(expected).find(row=>row.family===family);reject(Boolean(row),'ATTENDANCE_REVIEW_SOURCE_FAMILY');
 if(files.length===a.previousDelta.currentCount&&sha(JSON.stringify(files))===a.previousDelta.currentPathsSha256)return [...files];
 reject(files.length===row.currentCount&&sha(JSON.stringify(files))===row.currentPathsSha256,'ATTENDANCE_REVIEW_CURRENT_SOURCE_SET');return fieldReviewParentFiles(files,row);
}
function restorePlanBudgetAttendanceReviewProducerText(contract,bytes){
 const v=section(contract,true),row=v.attendanceReviewRuntime.producer;reject(Buffer.isBuffer(bytes)&&bytes.equals(Buffer.from(bytes.toString('utf8'))),'ATTENDANCE_REVIEW_SOURCE_READER');let text=bytes.toString('utf8').replaceAll('\r\n','\n');
 reject(sha(text)===row.currentSha256&&Buffer.byteLength(text)===row.sourceHistory.currentBytes,'ATTENDANCE_REVIEW_CURRENT_SOURCE');
 for(const h of [...row.sourceHistory.inverseHunks].reverse()){const at=h.currentOffsetCharacters;reject(text.slice(at,at+h.currentText.length)===h.currentText,'ATTENDANCE_REVIEW_EXACT_SOURCE_HUNK');text=text.slice(0,at)+h.previousText+text.slice(at+h.currentText.length);}
 reject(sha(text)===row.previousSha256&&Buffer.byteLength(text)===row.sourceHistory.previousBytes,'ATTENDANCE_REVIEW_COMPLETE_SOURCE_INVERSE');return Buffer.from(text);
}

// Exact local source inverse to the committed field-review predecessor.
// The actual source reader is never substituted; only fully authenticated LF
// bytes reach this historical AST projection. The complete parent digest must match.
const FIELD_REVIEW_BUSINESS_SOURCE=Object.freeze({"src/lib/field-operations-http.mjs":{"predecessorCommit":"ad435c1ac3cd6bdb43ee6b51051c0ec2af312adb","previousSourceSha256":"d3dffce08238141f672a8af0c1b956da15809e18608084b9bdf57d50ae166ceb","currentSourceSha256":"cd1773bc3b9fba01821cd4494b8559bdcdcc3a4ce886228622bb800349dcfd39","previousBytes":13747,"currentBytes":13760,"inverseHunks":[{"currentOffsetCharacters":4559,"currentText":"      if([...params.keys()].some(key=>!['projectId','scope','reviewSection','reviewFilter','afterReview','reviewId','reviewAccessStamp'].includes(key))||!['EVIDENCE','PROGRESS','ATTENDANCE'].includes(params.get('reviewSection'))||!['PENDING','ALL'].includes(params.get('reviewFilter'))||['afterReview','reviewId'].some(key=>params.has(key)&&!workspaceId(params.get(key)))||params.has('afterReview')&&params.has('reviewId')||params.has('reviewId')&&params.get('reviewFilter')!=='ALL'||['afterReview','reviewId','reviewAccessStamp'].some(key=>params.has(key))&&!/^[a-f0-9]{64}$/.test(params.get('reviewAccessStamp')||''))throw new WorkspaceError('FIELD_QUERY_INVALID');\n","previousText":"      if([...params.keys()].some(key=>!['projectId','scope','reviewSection','reviewFilter','afterReview','reviewId','reviewAccessStamp'].includes(key))||!['EVIDENCE','PROGRESS'].includes(params.get('reviewSection'))||!['PENDING','ALL'].includes(params.get('reviewFilter'))||['afterReview','reviewId'].some(key=>params.has(key)&&!workspaceId(params.get(key)))||params.has('afterReview')&&params.has('reviewId')||params.has('reviewId')&&params.get('reviewFilter')!=='ALL'||['afterReview','reviewId','reviewAccessStamp'].some(key=>params.has(key))&&!/^[a-f0-9]{64}$/.test(params.get('reviewAccessStamp')||''))throw new WorkspaceError('FIELD_QUERY_INVALID');\n"}]},"src/lib/field-operations-store.mjs":{"predecessorCommit":"ad435c1ac3cd6bdb43ee6b51051c0ec2af312adb","previousSourceSha256":"8f54edfb613fcf90f099015d42c89e993e5d3ca74f5bd11e9743830324547604","currentSourceSha256":"517267adb96c69bce58350b98b3a4e335ca1304a72a824e35998590e95b8987c","previousBytes":54880,"currentBytes":57154,"inverseHunks":[{"currentOffsetCharacters":20398,"currentText":"      if(!['EVIDENCE','PROGRESS','ATTENDANCE'].includes(reviewSection)||!['PENDING','ALL'].includes(reviewFilter)||[afterReview,reviewId].some(value=>value!==null&&!workspaceId(value))||afterReview&&reviewId||reviewId&&reviewFilter!=='ALL'||(afterReview||reviewId||expectedAccess!==undefined)&&!/^[a-f0-9]{64}$/.test(expectedAccess||''))throw new WorkspaceError('FIELD_QUERY_INVALID');\n","previousText":"      if(!['EVIDENCE','PROGRESS'].includes(reviewSection)||!['PENDING','ALL'].includes(reviewFilter)||[afterReview,reviewId].some(value=>value!==null&&!workspaceId(value))||afterReview&&reviewId||reviewId&&reviewFilter!=='ALL'||(afterReview||reviewId||expectedAccess!==undefined)&&!/^[a-f0-9]{64}$/.test(expectedAccess||''))throw new WorkspaceError('FIELD_QUERY_INVALID');\n"},{"currentOffsetCharacters":21101,"currentText":"        const reviewer=canReviewField(member.role),attendance=reviewSection==='ATTENDANCE',owned=access.owned.filter(row=>row.metadata.participant.permissions?.[attendance?'attendance':'report']===true).map(row=>row.id);\n        if(attendance){\n          // Review the canonical ledger independently of the recent history and\n          // worker display windows. Names share this read-only project snapshot.\n          const visible=`a.\"projectId\"=$1 AND a.metadata->'fieldOperations'->>'version'='1' AND ($2::boolean OR (a.\"workerId\"=ANY($3::text[]) AND a.metadata->'fieldOperations'->>'recordedBy'=$4))`,values=[context.projectId,reviewer,owned,member.actorId];\n          // Validate against ALL visible events, so a decision does not retire a\n          // cursor before the next pending page or a directed readback.\n          if(afterReview||reviewId){const found=(await client.query(`SELECT a.id FROM public.\"AttendanceEntry\" a WHERE ${visible} AND a.id=$5`,[...values,afterReview||reviewId])).rows;if(found.length!==1)throw new WorkspaceError('FIELD_REVIEW_CURSOR_UNAVAILABLE',404);}\n          const pending=`a.metadata->'fieldOperations'->>'verificationStatus'='REVIEW_REQUIRED' AND (a.metadata->'fieldOperations'->'review' IS NULL OR a.metadata->'fieldOperations'->'review'='null'::jsonb)`,filtered=visible+(reviewFilter==='PENDING'?` AND ${pending}`:'');\n          const rows=(await client.query(`SELECT a.id,a.\"workerId\",a.metadata,${revision('a.\"checkedInAt\"')} AS \"recordedAt\",w.name AS \"workerName\" FROM public.\"AttendanceEntry\" a LEFT JOIN public.\"Worker\" w ON w.id=a.\"workerId\" AND w.\"projectId\"=a.\"projectId\" WHERE ${filtered} AND ($5::text IS NULL OR (a.\"checkedInAt\",a.id)<(SELECT \"checkedInAt\",id FROM public.\"AttendanceEntry\" WHERE \"projectId\"=$1 AND id=$5)) AND ($6::text IS NULL OR a.id=$6) ORDER BY a.\"checkedInAt\" DESC,a.id DESC LIMIT 101`,[...values,afterReview,reviewId])).rows;\n          const total=reviewId?rows.length:(await client.query(`SELECT count(*)::int AS total FROM public.\"AttendanceEntry\" a WHERE ${filtered}`,values)).rows[0].total;\n          return {scope,projectId:context.projectId,reviewAccessStamp,reviewSection,reviewFilter,afterReview,reviewId,records:rows.slice(0,100).map(row=>({...publicEvent(row),workerName:row.workerName||null})),total,nextCursor:rows.length>100?rows[99].id:null,canReview:reviewer,canApproveProgress:canApproveProgress(member.role)};\n        }\n","previousText":"        const reviewer=canReviewField(member.role),owned=access.owned.filter(row=>row.metadata.participant.permissions?.report===true).map(row=>row.id);\n"}]},"src/lib/operations-status.mjs":{"predecessorCommit":"ad435c1ac3cd6bdb43ee6b51051c0ec2af312adb","previousSourceSha256":"cdee54c539106c384a92c70c730c91cd3058e872d5d855c57150b8ad246e666a","currentSourceSha256":"ce05f2b18facdaa2df35274004ee2111be366056ef1ff2c593660b8490782cd6","previousBytes":10576,"currentBytes":10989,"inverseHunks":[{"currentOffsetCharacters":959,"currentText":"   const totals=(await client.query(`SELECT count(*)::int AS pending,\n     (SELECT count(*)::int FROM public.\"Incident\" WHERE \"projectId\"=$1 AND metadata->'fieldOperations'->>'version'='1' AND metadata->'fieldOperations'->>'kind'='EVIDENCE' AND (metadata->'fieldOperations'->'review' IS NULL OR metadata->'fieldOperations'->'review'='null'::jsonb)) AS \"evidencePending\"\n     FROM public.\"OperationalProposal\" WHERE \"projectId\"=$1 AND type='TASK_PROGRESS' AND \"sourceProvider\"='account-field' AND status='PENDING' AND \"expiresAt\">transaction_timestamp() AND action->>'fieldOperationsVersion'='1'`,[context.projectId])).rows[0];\n   if(!totals||![totals.pending,totals.evidencePending].every(value=>Number.isSafeInteger(value)&&value>=0))throw new WorkspaceError('OPERATIONS_STATUS_UNAVAILABLE',503);\n","previousText":"   const pending=(await client.query(`SELECT count(*)::int AS pending FROM public.\"OperationalProposal\" WHERE \"projectId\"=$1 AND type='TASK_PROGRESS' AND \"sourceProvider\"='account-field' AND status='PENDING' AND \"expiresAt\">transaction_timestamp() AND action->>'fieldOperationsVersion'='1'`,[context.projectId])).rows[0]?.pending;\n   if(!Number.isSafeInteger(pending)||pending<0)throw new WorkspaceError('OPERATIONS_STATUS_UNAVAILABLE',503);\n"},{"currentOffsetCharacters":1852,"currentText":"   return {scope,projectId:context.projectId,view:'decisions',observedAt:new Date().toISOString(),evidence:{pending:totals.evidencePending},proposals:{pending:totals.pending},inventory:{canManage:true,pendingCounts}};\n","previousText":"   return {scope,projectId:context.projectId,view:'decisions',observedAt:new Date().toISOString(),proposals:{pending},inventory:{canManage:true,pendingCounts}};\n"}]}});
function restorePlanBudgetFieldReviewBusinessSource(file,bytes){
 const row=FIELD_REVIEW_BUSINESS_SOURCE[file];
 if(!row)return bytes;
 reject(Buffer.isBuffer(bytes)&&bytes.equals(Buffer.from(bytes.toString('utf8'))),'Actual UTF8 field-review source required: '+file);
 let text=bytes.toString('utf8').replaceAll('\r\n','\n');
 if(sha(text)!==row.currentSourceSha256)return bytes;
 reject(row.predecessorCommit==='ad435c1ac3cd6bdb43ee6b51051c0ec2af312adb'&&Buffer.byteLength(text)===row.currentBytes,'Exact field-review predecessor required: '+file);
 for(const h of [...row.inverseHunks].reverse()){const at=h.currentOffsetCharacters;reject(text.slice(at,at+h.currentText.length)===h.currentText,'Exact field-review source hunk required: '+file);text=text.slice(0,at)+h.previousText+text.slice(at+h.currentText.length);}
 reject(sha(text)===row.previousSourceSha256&&Buffer.byteLength(text)===row.previousBytes,'Complete field-review source inverse required: '+file);return Buffer.from(text);
}

// Local projections only; actual source readers and RAW native maps stay current.
function restorePlanBudgetConsumptionEvidenceSourceSet(contract,family,files){
 if(!section(contract))return files;sorted(files);const a=expected.consumptionEvidenceRuntime.sourceSetAdvances.find(a=>a.family===family);if(!a)return [...files];
 if(files.length===a.previousDelta.currentCount&&sha(JSON.stringify(files))===a.previousDelta.currentPathsSha256)return [...files];const row=compile().sets.get(family);
 reject(row&&files.length===row.currentCount&&sha(JSON.stringify(files))===row.currentPathsSha256,'CONSUMPTION_EVIDENCE_CURRENT_SOURCE_SET');return consumptionParentFiles(files,row);
}
function restorePlanBudgetConsumptionEvidenceSource(contract,file,bytes){
 const v=section(contract,true),h=v.consumptionEvidenceRuntime.sourceHistory;if(file!==h.path)return bytes;
 reject(Buffer.isBuffer(bytes)&&bytes.equals(Buffer.from(bytes.toString('utf8'))),'CONSUMPTION_EVIDENCE_SOURCE_READER');const text=bytes.toString('utf8').replaceAll('\r\n','\n');reject(sha(text)===h.currentSha256&&Buffer.byteLength(text)===h.currentBytes,'CONSUMPTION_EVIDENCE_CURRENT_SOURCE');
 const chunk=h.inverseHunks[0];reject(text===chunk.currentText,'CONSUMPTION_EVIDENCE_EXACT_SOURCE_HUNK');const previous=Buffer.from(chunk.previousText);reject(sha(previous)===h.previousSha256&&previous.length===h.previousBytes,'CONSUMPTION_EVIDENCE_COMPLETE_SOURCE_INVERSE');return previous;
}

// Exact current material source to committed1b only. The unchanged pilot inverse
// authenticates that complete parent before reconstructing its older history.
function restorePlanBudgetMaterialNativeProducerText(contract,bytes){
 const h=section(contract,true).consumptionEvidenceRuntime.materialNative.sourceHistory;
 reject(Buffer.isBuffer(bytes)&&bytes.equals(Buffer.from(bytes.toString('utf8'))),'MATERIAL_NATIVE_SOURCE_READER');let text=bytes.toString('utf8').replaceAll('\r\n','\n');reject(sha(text)===h.currentSha256&&Buffer.byteLength(text)===h.currentBytes,'MATERIAL_NATIVE_CURRENT_SOURCE');
 for(const block of [...h.inverseHunks].reverse()){const at=block.currentOffsetCharacters;reject(text.slice(at,at+block.currentText.length)===block.currentText,'MATERIAL_NATIVE_EXACT_SOURCE_HUNK');text=text.slice(0,at)+block.previousText+text.slice(at+block.currentText.length);}
 reject(sha(text)===h.previousSha256&&Buffer.byteLength(text)===h.previousBytes,'MATERIAL_NATIVE_COMPLETE_SOURCE_INVERSE');return Buffer.from(text);
}

function planBudgetCurrentSourcePin(contract,ref){if(!plain(contract)||!Object.hasOwn(contract,PLAN_BUDGET_CURRENT_SECTION))return ref.sha256;return integrationAdvancedPin({path:ref.path,sha256:parentPlanBudgetCurrentSourcePin(contract,integrationInputPin(ref))});}
function planBudgetPreviousSourcePin(contract,ref){if(!plain(contract)||!Object.hasOwn(contract,PLAN_BUDGET_CURRENT_SECTION))return ref.sha256;return parentPlanBudgetPreviousSourcePin(contract,integrationInputPin(ref));}

return Object.freeze({restorePlanBudgetPilotIntegrationPreviousContract,restorePlanBudgetPilotIntegrationSource,intakeWithdrawalCurrentCheckCount,restorePlanBudgetIntakeWithdrawalSource,restorePlanBudgetIntakeWithdrawalProducerText,restorePlanBudgetIntakeWithdrawalUnitProducerText,normalizePlanBudgetIntakeWithdrawalNativeProof,restorePlanBudgetTrialExpiryNoticePreviousContract,restorePlanBudgetTrialExpiryNoticeSource,restorePlanBudgetTrialExpiryNoticeValidatorSource,restorePlanBudgetMeasurementPrivacyPreviousContract,restorePlanBudgetMeasurementPrivacySource,restorePlanBudgetCheckTimeSource,restorePlanBudgetCheckTimePreviousContract,restorePlanBudgetPreviousContract,restorePlanBudgetSourceSet,planBudgetProofSourceAdditions,verifyPlanBudgetCurrentSources,verifyPlanBudgetActualClosure,restorePlanBudgetClosure,planBudgetValidationFiles,planBudgetCurrentBrowserBinding,planBudgetCompiledProof,planBudgetRetainedScreenshotPaths,restorePlanBudgetPilotProducerText,normalizePlanBudgetPilotNativeProof,restorePlanBudgetFieldReviewSourceSet,restorePlanBudgetAttendanceReviewProducerText,restorePlanBudgetFieldReviewBusinessSource,restorePlanBudgetConsumptionEvidenceSourceSet,restorePlanBudgetConsumptionEvidenceSource,restorePlanBudgetMaterialNativeProducerText,planBudgetCurrentSourcePin,planBudgetPreviousSourcePin,INTAKE_WITHDRAWAL_CHECK_NAMES});
}

// Canonical outer source bridge. Actual reviewed metadata and current readers
// authenticate the complete Git1b parent before historical projections.
const acceptanceKey=PLAN_BUDGET_CURRENT_SECTION,acceptanceRevision='pilotAcceptanceRuntime';
const acceptanceAnchor='scripts/lib/plan-budget-current-ci-reviewed.mjs';
const acceptanceContractPath='.github/workspace-acceptance-contract.json';
const acceptanceParentHash='a89d1a6c820b811359af23359e587f9110e7341bfa0c2b558b5ee452d9ac1042';
const acceptanceParentDeclarationHash='e1be620f5040e7cba3ebaa0fc34190da0d0d2e1e7a164014e8c2ec3ba17f2a3c';
const acceptanceSha=value=>createHash('sha256').update(value).digest('hex');
const acceptanceSerialize=value=>JSON.stringify(value,null,2)+'\n';
const acceptanceSame=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const acceptancePlain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const acceptanceReject=(ok,reason)=>{if(!ok)throw Object.assign(new Error('Budget current CI lineage rejected: '+reason),{code:'PLAN_BUDGET_CURRENT_CI_LINEAGE_REJECTED',reason});};
const acceptanceSafe=file=>typeof file==='string'&&file.length>0&&path.posix.normalize(file)===file&&!path.posix.isAbsolute(file)&&!/[\\:\x00-\x1f]/.test(file)&&!file.split('/').includes('..');
const acceptanceDeclaration=value=>'// Exact budget-source CI declaration; compiler fills immutable reviewed source bindings.\nexport const PLAN_BUDGET_CURRENT_REVISION=Object.freeze('+JSON.stringify(value,null,2)+');\n';
const acceptanceExpected=structuredClone(reviewed),acceptanceExpectedJson=JSON.stringify(acceptanceExpected);
const acceptanceRuntime=acceptanceExpected[acceptanceRevision];
acceptanceReject(acceptancePlain(acceptanceRuntime)&&acceptanceRuntime.version===1&&acceptanceRuntime.parentHead==='1b3315b0054a3f84447c64ba674403e3fe74eb79'&&acceptanceRuntime.previousContractSha256===acceptanceParentHash&&acceptanceRuntime.nativeOrHumanAcceptance===false,'ACCEPTANCE_PARENT');
acceptanceReject(acceptanceSame(Object.keys(acceptanceRuntime).sort(),['version','parentHead','previousContractSha256','sourceAliases','referenceAdvances','sourceHistory','familyAdvances','proofSourceSetAdvances','contractPatches','nativeOrHumanAcceptance'].sort()),'ACCEPTANCE_KEYS');
for(const name of ['sourceAliases','referenceAdvances','sourceHistory','familyAdvances','proofSourceSetAdvances','contractPatches'])acceptanceReject(Array.isArray(acceptanceRuntime[name]),'ACCEPTANCE_ARRAY_'+name);
function acceptancePointer(value,pointer){
 acceptanceReject(typeof pointer==='string'&&/^\/(?:planBudgetCurrentRevision\/(?:references(?:\/\d+\/currentSha256)?|sourceFamilies\/\d+\/(?:currentFiles|externalImports|currentManifest))|extension\/proofs\/\d+\/(?:sourceFiles|producerSha256))$/.test(pointer),'ACCEPTANCE_POINTER');
 const parts=pointer.slice(1).split('/');let at=value;
 for(const part of parts.slice(0,-1)){acceptanceReject(at!==null&&typeof at==='object'&&Object.hasOwn(at,part),'ACCEPTANCE_POINTER');at=at[part];}
 const key=parts.at(-1);acceptanceReject(at!==null&&typeof at==='object'&&Object.hasOwn(at,key),'ACCEPTANCE_POINTER');return {at,key};
}
function acceptanceApplyInverse(out,patches){
 for(const patch of [...patches].reverse()){
  acceptanceReject(acceptancePlain(patch)&&acceptanceSame(Object.keys(patch).sort(),['pointer','previous','current'].sort()),'ACCEPTANCE_PATCH_KEYS');
  const target=acceptancePointer(out,patch.pointer);acceptanceReject(acceptanceSame(target.at[target.key],patch.current),'ACCEPTANCE_PATCH_CURRENT_VALUE');target.at[target.key]=structuredClone(patch.previous);
 }
 return out;
}
// This private value is pinned to the literal complete 1b declaration. No public
// function or mutable caller can supply the legacy gate's expected declaration.
const acceptanceParentContainer={[acceptanceKey]:structuredClone(acceptanceExpected)};
delete acceptanceParentContainer[acceptanceKey][acceptanceRevision];
acceptanceApplyInverse(acceptanceParentContainer,acceptanceRuntime.contractPatches.filter(row=>row.pointer.startsWith('/'+acceptanceKey+'/')));
const acceptanceParentExpected=acceptanceParentContainer[acceptanceKey];
acceptanceReject(acceptanceSha(acceptanceDeclaration(acceptanceParentExpected))===acceptanceParentDeclarationHash,'ACCEPTANCE_COMPLETE_1B_DECLARATION');
const acceptanceParentGate=createAuthenticatedParentGate(acceptanceParentExpected);
const acceptanceHistories=new Map();
for(const history of acceptanceRuntime.sourceHistory){
 acceptanceReject(acceptancePlain(history)&&acceptanceSafe(history.path)&&!acceptanceHistories.has(history.path),'ACCEPTANCE_HISTORY_PATH');
 acceptanceReject(acceptanceSame(Object.keys(history).sort(),['path','status','previousSha256','currentSha256','previousBytes','currentBytes','inverseHunks'].sort()),'ACCEPTANCE_HISTORY_KEYS');
 acceptanceReject(/^[a-f0-9]{64}$/.test(history.currentSha256||'')&&(history.previousSha256===null||/^[a-f0-9]{64}$/.test(history.previousSha256||''))&&Number.isSafeInteger(history.currentBytes)&&history.currentBytes>0&&Number.isSafeInteger(history.previousBytes)&&history.previousBytes>=0&&Array.isArray(history.inverseHunks)&&history.inverseHunks.length>0,'ACCEPTANCE_HISTORY_PIN');
 acceptanceReject(history.status===(history.previousSha256===null?'ADDED':'MODIFIED')&&(history.previousSha256===null?history.previousBytes===0:history.previousBytes>0),'ACCEPTANCE_HISTORY_STATUS');
 let end=0;for(const hunk of history.inverseHunks){acceptanceReject(acceptancePlain(hunk)&&acceptanceSame(Object.keys(hunk).sort(),['currentOffsetCharacters','currentText','previousText'].sort())&&Number.isSafeInteger(hunk.currentOffsetCharacters)&&hunk.currentOffsetCharacters>=end&&typeof hunk.currentText==='string'&&typeof hunk.previousText==='string'&&hunk.currentText!==hunk.previousText,'ACCEPTANCE_ORDERED_HUNKS');end=hunk.currentOffsetCharacters+hunk.currentText.length;}
 acceptanceReject(acceptanceExpected.references.filter(ref=>ref.path===history.path&&ref.currentSha256===history.currentSha256).length===1,'ACCEPTANCE_CURRENT_HISTORY_REFERENCE');acceptanceHistories.set(history.path,history);
}
function acceptanceParentContract(contract,required=false){
 acceptanceReject(acceptancePlain(contract),'CONTRACT');
 if(!Object.hasOwn(contract,acceptanceKey)){acceptanceReject(!required,'BUDGET_COMPANION_REQUIRED');return contract;}
 acceptanceReject(JSON.stringify(contract[acceptanceKey])===acceptanceExpectedJson,'IMMUTABLE_COMPANION');
 const out=structuredClone(contract);delete out[acceptanceKey][acceptanceRevision];acceptanceApplyInverse(out,acceptanceRuntime.contractPatches);
 acceptanceReject(acceptanceSha(acceptanceSerialize(out))===acceptanceParentHash,'ACCEPTANCE_COMPLETE_1B_CONTRACT');return out;
}
// These lookups make no claim about full-contract or current-source authority.
// Serialize each caller section afresh; only expected metadata is private/cached.
function acceptanceMetadataSection(contract,required=false){
 acceptanceReject(acceptancePlain(contract),'CONTRACT');if(!Object.hasOwn(contract,acceptanceKey)){acceptanceReject(!required,'BUDGET_COMPANION_REQUIRED');return false;}
 acceptanceReject(JSON.stringify(contract[acceptanceKey])===acceptanceExpectedJson,'IMMUTABLE_COMPANION');return true;
}
const acceptanceMetadataCarrier=Object.freeze({[acceptanceKey]:acceptanceParentExpected});
function acceptanceBytes(bytes,file){
 acceptanceReject(acceptanceSafe(file)&&Buffer.isBuffer(bytes)&&Buffer.from(bytes.toString('utf8')).equals(bytes),'ACCEPTANCE_UTF8_SOURCE_'+file);return Buffer.from(bytes.toString('utf8').replaceAll('\r\n','\n'));
}
function acceptanceParentSource(file,bytes){
 const history=acceptanceHistories.get(file);if(!history)return bytes;
 let text=acceptanceBytes(bytes,file).toString('utf8');acceptanceReject(acceptanceSha(text)===history.currentSha256&&Buffer.byteLength(text)===history.currentBytes,'ACCEPTANCE_CURRENT_SOURCE_'+file);
 for(const hunk of [...history.inverseHunks].reverse()){const at=hunk.currentOffsetCharacters;acceptanceReject(text.slice(at,at+hunk.currentText.length)===hunk.currentText,'ACCEPTANCE_EXACT_SOURCE_HUNK_'+file);text=text.slice(0,at)+hunk.previousText+text.slice(at+hunk.currentText.length);}
 acceptanceReject(Buffer.byteLength(text)===history.previousBytes&&(history.previousSha256===null?text==='':acceptanceSha(text)===history.previousSha256),'ACCEPTANCE_COMPLETE_SOURCE_INVERSE_'+file);return history.previousSha256===null?null:Buffer.from(text);
}
function acceptanceRead(reader,file){let bytes;acceptanceReject(typeof reader==='function','SOURCE_READER');try{bytes=reader(file);}catch{}return acceptanceBytes(bytes,file);}
function acceptanceReader(contract,parent,reader){
 const text=acceptanceSerialize(contract),parentText=acceptanceSerialize(parent);
 return file=>{
  const bytes=acceptanceRead(reader,file);
  if(file===acceptanceContractPath){acceptanceReject(bytes.toString('utf8')===text,'ACCEPTANCE_CONTRACT_BYTES');return Buffer.from(parentText);}
  if(file===acceptanceAnchor){acceptanceReject(bytes.toString('utf8')===acceptanceDeclaration(acceptanceExpected),'ACCEPTANCE_DECLARATION_BYTES');return Buffer.from(acceptanceDeclaration(acceptanceParentExpected));}
  return acceptanceParentSource(file,bytes);
 };
}
function acceptanceVerifyActual(contract,parent,reader){
 acceptanceReject(acceptanceRead(reader,acceptanceContractPath).toString('utf8')===acceptanceSerialize(contract),'ACCEPTANCE_CONTRACT_BYTES');
 acceptanceReject(acceptanceRead(reader,acceptanceAnchor).toString('utf8')===acceptanceDeclaration(acceptanceExpected),'ACCEPTANCE_DECLARATION_BYTES');
 for(const ref of acceptanceExpected.references)acceptanceReject(acceptanceSha(acceptanceRead(reader,ref.path))===ref.currentSha256,'ACCEPTANCE_CURRENT_REFERENCE_'+ref.path);
 for(const history of acceptanceRuntime.sourceHistory)acceptanceParentSource(history.path,acceptanceRead(reader,history.path));
 acceptanceReject(acceptanceSha(acceptanceSerialize(parent))===acceptanceParentHash,'ACCEPTANCE_COMPLETE_1B_CONTRACT');
}
function acceptanceProofSet(family){
 const advance=acceptanceRuntime.proofSourceSetAdvances.find(row=>row.kind===family);if(!advance)return null;
 const patches=acceptanceRuntime.contractPatches.filter(row=>/^\/extension\/proofs\/\d+\/sourceFiles$/.test(row.pointer)&&row.current.length===advance.currentCount&&row.previous.length===advance.previousCount&&acceptanceSame(row.current.filter(file=>!row.previous.includes(file)),advance.additions)&&acceptanceSame(row.previous.filter(file=>!row.current.includes(file)),advance.removals));
 acceptanceReject(patches.length>0&&patches.every(row=>acceptanceSame(row.current,patches[0].current)&&acceptanceSame(row.previous,patches[0].previous)),'ACCEPTANCE_EXACT_SOURCE_SET_JOIN');return {advance,...patches[0]};
}
function acceptanceProjectedSet(family){
 const proof=acceptanceProofSet(family),current=acceptanceExpected.sourceFamilies.find(row=>row.family===family),previous=acceptanceParentExpected.sourceFamilies.find(row=>row.family===family);
 if(!current||!previous||acceptanceSame(current.currentFiles,previous.currentFiles))return proof;
 const row={current:current.currentFiles,previous:previous.currentFiles,advance:{additions:current.currentFiles.filter(file=>!previous.currentFiles.includes(file)),removals:previous.currentFiles.filter(file=>!current.currentFiles.includes(file))}};
 acceptanceReject(!proof||acceptanceSame(proof.current,row.current)&&acceptanceSame(proof.previous,row.previous),'ACCEPTANCE_FAMILY_PROOF_SOURCE_SET_JOIN');return row;
}
function acceptancePreviousFiles(family,files){
 const row=acceptanceProjectedSet(family);if(!row)return files;
 acceptanceReject(Array.isArray(files)&&files.every(acceptanceSafe)&&acceptanceSame(files,[...new Set(files)].sort()),'SORTED_SOURCE_PATHS');
 if(acceptanceSame(files,row.current))return [...row.previous];
 // Earlier exact path sets remain the unchanged legacy metadata validator's
 // responsibility. A mixed set containing a new outer source is never allowed.
 acceptanceReject(!row.advance.additions.some(file=>files.includes(file)),'ACCEPTANCE_CURRENT_SOURCE_SET_'+family);return files;
}
function acceptanceSourceCall(name,contract,file,bytes){const parent=acceptanceParentContract(contract,true);return acceptanceParentGate[name](parent,file,acceptanceParentSource(file,bytes));}
function acceptanceProducerCall(name,contract,file,bytes){const parent=acceptanceParentContract(contract,true);return acceptanceParentGate[name](parent,acceptanceParentSource(file,bytes));}
function acceptanceContractCall(name,contract,...args){return acceptanceParentGate[name](acceptanceParentContract(contract),...args);}

const INTAKE_WITHDRAWAL_CHECK_NAMES=acceptanceParentGate.INTAKE_WITHDRAWAL_CHECK_NAMES;
function restorePlanBudgetAcceptancePreviousContract(contract){return acceptanceParentContract(contract,true);}
function restorePlanBudgetAcceptancePreviousSource(contract,file,bytes){
 acceptanceParentContract(contract,true);return acceptanceParentSource(file,acceptanceBytes(bytes,file));
}
function restorePlanBudgetPilotIntegrationPreviousContract(contract){return acceptanceContractCall('restorePlanBudgetPilotIntegrationPreviousContract',contract);}
function restorePlanBudgetPilotIntegrationSource(contract,file,bytes){return acceptanceSourceCall('restorePlanBudgetPilotIntegrationSource',contract,file,bytes);}
function restorePlanBudgetTrialExpiryNoticePreviousContract(contract){return acceptanceContractCall('restorePlanBudgetTrialExpiryNoticePreviousContract',contract);}
function restorePlanBudgetTrialExpiryNoticeSource(contract,file,bytes){return acceptanceSourceCall('restorePlanBudgetTrialExpiryNoticeSource',contract,file,bytes);}
function restorePlanBudgetTrialExpiryNoticeValidatorSource(contract,file,bytes){return acceptanceSourceCall('restorePlanBudgetTrialExpiryNoticeValidatorSource',contract,file,bytes);}
function restorePlanBudgetMeasurementPrivacyPreviousContract(contract){return acceptanceContractCall('restorePlanBudgetMeasurementPrivacyPreviousContract',contract);}
function restorePlanBudgetMeasurementPrivacySource(contract,file,bytes){return acceptanceSourceCall('restorePlanBudgetMeasurementPrivacySource',contract,file,bytes);}
function restorePlanBudgetCheckTimePreviousContract(contract){return acceptanceContractCall('restorePlanBudgetCheckTimePreviousContract',contract);}
function restorePlanBudgetCheckTimeSource(contract,file,bytes){return acceptanceSourceCall('restorePlanBudgetCheckTimeSource',contract,file,bytes);}
function restorePlanBudgetPreviousContract(contract){return acceptanceContractCall('restorePlanBudgetPreviousContract',contract);}
function restorePlanBudgetIntakeWithdrawalSource(contract,file,bytes){return acceptanceSourceCall('restorePlanBudgetIntakeWithdrawalSource',contract,file,bytes);}
function restorePlanBudgetIntakeWithdrawalProducerText(contract,bytes){return acceptanceProducerCall('restorePlanBudgetIntakeWithdrawalProducerText',contract,acceptanceParentExpected.intakeWithdrawalRuntime.producer.producer,bytes);}
function restorePlanBudgetIntakeWithdrawalUnitProducerText(contract,bytes){return acceptanceProducerCall('restorePlanBudgetIntakeWithdrawalUnitProducerText',contract,acceptanceParentExpected.intakeWithdrawalRuntime.unitProducer.producer,bytes);}
function restorePlanBudgetMaterialNativeProducerText(contract,bytes){return acceptanceProducerCall('restorePlanBudgetMaterialNativeProducerText',contract,acceptanceParentExpected.consumptionEvidenceRuntime.materialNative.producer,bytes);}
function restorePlanBudgetAttendanceReviewProducerText(contract,bytes){return acceptanceProducerCall('restorePlanBudgetAttendanceReviewProducerText',contract,acceptanceParentExpected.attendanceReviewRuntime.producer.producer,bytes);}
function restorePlanBudgetConsumptionEvidenceSource(contract,file,bytes){return acceptanceSourceCall('restorePlanBudgetConsumptionEvidenceSource',contract,file,bytes);}
function restorePlanBudgetPilotProducerText(contract,producer,bytes){const parent=acceptanceParentContract(contract,true);return acceptanceParentGate.restorePlanBudgetPilotProducerText(parent,producer,acceptanceParentSource(producer,bytes));}
function restorePlanBudgetFieldReviewBusinessSource(file,bytes){return acceptanceParentGate.restorePlanBudgetFieldReviewBusinessSource(file,acceptanceParentSource(file,bytes));}
function restorePlanBudgetSourceSet(contract,family,files){const parent=acceptanceParentContract(contract);return acceptanceParentGate.restorePlanBudgetSourceSet(parent,family,Object.hasOwn(contract,acceptanceKey)?acceptancePreviousFiles(family,files):files);}
function restorePlanBudgetFieldReviewSourceSet(contract,family,files){const parent=acceptanceParentContract(contract);return acceptanceParentGate.restorePlanBudgetFieldReviewSourceSet(parent,family,Object.hasOwn(contract,acceptanceKey)?acceptancePreviousFiles(family,files):files);}
function restorePlanBudgetConsumptionEvidenceSourceSet(contract,family,files){const parent=acceptanceParentContract(contract);return acceptanceParentGate.restorePlanBudgetConsumptionEvidenceSourceSet(parent,family,Object.hasOwn(contract,acceptanceKey)?acceptancePreviousFiles(family,files):files);}
function planBudgetProofSourceAdditions(spec){
 const row=acceptanceProjectedSet(spec?.kind);if(!row)return acceptanceParentGate.planBudgetProofSourceAdditions(spec);
 if(acceptanceSame(spec.sourceFiles,row.current))return [...new Set([...acceptanceParentGate.planBudgetProofSourceAdditions({...spec,sourceFiles:[...row.previous]}),...row.advance.additions])].sort();
 acceptanceReject(Array.isArray(spec.sourceFiles)&&!row.advance.additions.some(file=>spec.sourceFiles.includes(file)),'ACCEPTANCE_CURRENT_SOURCE_SET_'+spec.kind);return acceptanceParentGate.planBudgetProofSourceAdditions(spec);
}
function intakeWithdrawalCurrentCheckCount(spec){return acceptanceParentGate.intakeWithdrawalCurrentCheckCount(spec);}
function verifyPlanBudgetCurrentSources(contract,reader){
 const parent=acceptanceParentContract(contract,true);acceptanceVerifyActual(contract,parent,reader);
 const result=acceptanceParentGate.verifyPlanBudgetCurrentSources(parent,acceptanceReader(contract,parent,reader));acceptanceParentContract(contract,true);return {...result,referenceCount:acceptanceExpected.references.length};
}
function verifyPlanBudgetActualClosure(contract,family,closure,reader){
 const parent=acceptanceParentContract(contract,true);acceptanceVerifyActual(contract,parent,reader);
 const current=acceptanceExpected.sourceFamilies.find(row=>row.family===family),previous=acceptanceParentExpected.sourceFamilies.find(row=>row.family===family);
 acceptanceReject(Boolean(current&&previous),'ACCEPTANCE_CURRENT_FAMILY');acceptanceReject(acceptancePlain(closure)&&acceptanceSame(Object.keys(closure).sort(),['files','externalImports'].sort())&&acceptanceSame(closure.files,current.currentFiles)&&acceptanceSame(closure.externalImports,current.externalImports),'ACCEPTANCE_EXACT_CURRENT_CLOSURE');
 for(const ref of current.currentManifest){const bytes=acceptanceRead(reader,ref.path);acceptanceReject(ref.path===acceptanceAnchor?bytes.toString('utf8')===acceptanceDeclaration(acceptanceExpected):acceptanceSha(bytes)===ref.sha256,'ACCEPTANCE_CURRENT_FAMILY_SOURCE_'+ref.path);}
 acceptanceParentGate.verifyPlanBudgetActualClosure(parent,family,{files:[...previous.currentFiles],externalImports:[...previous.externalImports]},acceptanceReader(contract,parent,reader));acceptanceParentContract(contract,true);
 return {family,sourceCount:current.currentFiles.length,sourcePathsSha256:acceptanceSha(JSON.stringify(current.currentFiles)),nativeOrBrowserAcceptance:false};
}
function restorePlanBudgetClosure(contract,family,closure){
 const parent=acceptanceParentContract(contract);if(!Object.hasOwn(contract,acceptanceKey))return acceptanceParentGate.restorePlanBudgetClosure(parent,family,closure);
 const current=acceptanceExpected.sourceFamilies.find(row=>row.family===family),previous=acceptanceParentExpected.sourceFamilies.find(row=>row.family===family);acceptanceReject(Boolean(current&&previous)&&acceptancePlain(closure)&&acceptanceSame(closure.files,current.currentFiles)&&acceptanceSame(closure.externalImports,current.externalImports),'ACCEPTANCE_EXACT_CURRENT_CLOSURE');
 return acceptanceParentGate.restorePlanBudgetClosure(parent,family,{files:[...previous.currentFiles],externalImports:[...previous.externalImports]});
}
function planBudgetValidationFiles(contract){return acceptanceMetadataSection(contract)?[...new Set([acceptanceAnchor,...acceptanceExpected.references.map(row=>row.path),...acceptanceParentExpected.checkTimeRuntime.sourceHistory.map(row=>row.path),acceptanceParentExpected.measurementPrivacyRuntime.validationSource.path])].sort():[];}
function planBudgetCurrentBrowserBinding(contract,fallback){if(!acceptanceMetadataSection(contract))return fallback;const value=acceptanceExpected.browser;return {...fallback,producerLfSha256:value.producerLfSha256,investmentSourceCount:value.investmentSourceCount,investmentSourcePathsSha256:value.investmentSourcePathsSha256};}
function planBudgetCompiledProof(contract){return acceptanceContractCall('planBudgetCompiledProof',contract);}
function planBudgetRetainedScreenshotPaths(contract){acceptanceMetadataSection(contract,true);return acceptanceExpected.browser.retainedScreenshots.map(row=>row.path);}
function acceptanceInputPin(ref){const history=acceptanceHistories.get(ref.path);return history&&history.previousSha256!==null&&ref.sha256===history.currentSha256?{...ref,sha256:history.previousSha256}:ref;}
function planBudgetCurrentSourcePin(contract,ref){if(!acceptancePlain(contract)||!Object.hasOwn(contract,acceptanceKey))return ref.sha256;const value=acceptanceParentGate.planBudgetCurrentSourcePin(acceptanceMetadataCarrier,acceptanceInputPin(ref)),history=acceptanceHistories.get(ref.path);return history&&history.previousSha256===value?history.currentSha256:value;}
function planBudgetPreviousSourcePin(contract,ref){if(!acceptancePlain(contract)||!Object.hasOwn(contract,acceptanceKey))return ref.sha256;return acceptanceParentGate.planBudgetPreviousSourcePin(acceptanceMetadataCarrier,acceptanceInputPin(ref));}
// Native proof hashes bind RAW bytes. Only this adapter preserves owned RAW
// copies for unchanged files; metadata and changed bodies retain exact inverses.
// Every access reads the actual callback afresh, after full current authentication.
function acceptanceNativeReader(contract,parent,reader){
 const projected=acceptanceReader(contract,parent,reader);
 return file=>{
  if(file===acceptanceContractPath||file===acceptanceAnchor||acceptanceHistories.has(file))return projected(file);
  let bytes;acceptanceReject(typeof reader==='function','SOURCE_READER');try{bytes=reader(file);}catch{}
  acceptanceReject(acceptanceSafe(file)&&Buffer.isBuffer(bytes)&&Buffer.from(bytes.toString('utf8')).equals(bytes),'ACCEPTANCE_UTF8_SOURCE_'+file);return Buffer.from(bytes);
 };
}
function normalizePlanBudgetPilotNativeProof(contract,producer,proof,reader){
 const parent=acceptanceParentContract(contract);if(!Object.hasOwn(contract,acceptanceKey))return acceptanceParentGate.normalizePlanBudgetPilotNativeProof(parent,producer,proof,reader);
 acceptanceVerifyActual(contract,parent,reader);const result=acceptanceParentGate.normalizePlanBudgetPilotNativeProof(parent,producer,proof,acceptanceNativeReader(contract,parent,reader));acceptanceParentContract(contract,true);return result;
}
function normalizePlanBudgetIntakeWithdrawalNativeProof(raw,contract,reader,spec){
 const parent=acceptanceParentContract(contract);if(!Object.hasOwn(contract,acceptanceKey))return acceptanceParentGate.normalizePlanBudgetIntakeWithdrawalNativeProof(raw,parent,reader,spec);
 acceptanceVerifyActual(contract,parent,reader);const result=acceptanceParentGate.normalizePlanBudgetIntakeWithdrawalNativeProof(raw,parent,acceptanceNativeReader(contract,parent,reader),spec);acceptanceParentContract(contract,true);return result;
}

return Object.freeze({PLAN_BUDGET_CURRENT_REVISION:reviewed,PLAN_BUDGET_CURRENT_SECTION,PLAN_BUDGET_CI_KIND,PLAN_BUDGET_CI_PROOF_PATH,INTAKE_WITHDRAWAL_CHECK_NAMES,restorePlanBudgetAcceptancePreviousContract,restorePlanBudgetAcceptancePreviousSource,restorePlanBudgetPilotIntegrationPreviousContract,restorePlanBudgetPilotIntegrationSource,restorePlanBudgetTrialExpiryNoticePreviousContract,restorePlanBudgetTrialExpiryNoticeSource,restorePlanBudgetTrialExpiryNoticeValidatorSource,restorePlanBudgetMeasurementPrivacyPreviousContract,restorePlanBudgetMeasurementPrivacySource,restorePlanBudgetCheckTimePreviousContract,restorePlanBudgetCheckTimeSource,restorePlanBudgetPreviousContract,restorePlanBudgetIntakeWithdrawalSource,restorePlanBudgetIntakeWithdrawalProducerText,restorePlanBudgetIntakeWithdrawalUnitProducerText,restorePlanBudgetMaterialNativeProducerText,restorePlanBudgetAttendanceReviewProducerText,restorePlanBudgetConsumptionEvidenceSource,restorePlanBudgetPilotProducerText,restorePlanBudgetFieldReviewBusinessSource,restorePlanBudgetSourceSet,restorePlanBudgetFieldReviewSourceSet,restorePlanBudgetConsumptionEvidenceSourceSet,planBudgetProofSourceAdditions,intakeWithdrawalCurrentCheckCount,verifyPlanBudgetCurrentSources,verifyPlanBudgetActualClosure,restorePlanBudgetClosure,planBudgetValidationFiles,planBudgetCurrentBrowserBinding,planBudgetCompiledProof,planBudgetRetainedScreenshotPaths,planBudgetCurrentSourcePin,planBudgetPreviousSourcePin,normalizePlanBudgetPilotNativeProof,normalizePlanBudgetIntakeWithdrawalNativeProof});
}

// Current capture-runtime boundary. Historical parent bodies above are unchanged.

export const CAPTURE_QUALITY_PARENT='731565e11ce8d67e6a4310f491273626fe73c6f9';
export const CAPTURE_QUALITY_PARENT_CONTRACT_SHA256='d5ef59b111dd3e25b8f08854d3e8e4df4838a7913e3e22b76299c1916b9913d2';
export const CAPTURE_QUALITY_PARENT_DECLARATION_SHA256='cb5b5dbe197defccf1f8ee7c166ccc8e750c339ea612c015e80856cc34dee63f';
export const CAPTURE_QUALITY_PARENT_COMPILER_SHA256='0ba932090392ee957357d303ac8c4acd11fec9da46b4f01a9e5390e47d563510';
export const CAPTURE_QUALITY_COMPILER_STATE='CURRENT_RUNTIME_EXACT_PARENT_WRAPPER';
const section='planBudgetCurrentRevision',revision='captureQualityRuntime';
const contractPath='.github/workspace-acceptance-contract.json',anchor='scripts/lib/plan-budget-current-ci-reviewed.mjs';
const serialize=value=>JSON.stringify(value,null,2)+'\n',same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),sha=value=>createHash('sha256').update(value).digest('hex');
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value),hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const reject=(ok,reason)=>{if(!ok)throw Object.assign(new Error('Capture quality lineage rejected: '+reason),{code:'PLAN_BUDGET_CURRENT_CI_LINEAGE_REJECTED',reason});};
const exact=(value,keys,reason)=>reject(plain(value)&&same(Object.keys(value).sort(),[...keys].sort()),reason);
const safe=file=>typeof file==='string'&&file.length>0&&path.posix.normalize(file)===file&&!path.posix.isAbsolute(file)&&!/[\\:\x00-\x1f]/.test(file)&&!file.split('/').includes('..');
const bytes=(value,file)=>{reject(Buffer.isBuffer(value)&&Buffer.from(value.toString('utf8')).equals(value),'UTF8_'+file);return Buffer.from(value.toString('utf8').replaceAll('\r\n','\n'));};
const declaration=value=>'// Exact budget-source CI declaration; compiler fills immutable reviewed source bindings.\nexport const PLAN_BUDGET_CURRENT_REVISION=Object.freeze('+JSON.stringify(value,null,2)+');\n';
const sorted=(files,reason)=>reject(Array.isArray(files)&&files.every(safe)&&same(files,[...new Set(files)].sort()),reason);
const bridges=new WeakSet();
export const isCaptureQualityBridge=value=>bridges.has(value);
// One reviewed oracle-data advance. It grants neither native nor browser proof.
// The current pair is exact; descendants and alternate current matrices fail.
const fieldPaginationOracleAdvanceV1=Object.freeze({
 pointers:Object.freeze(['/whatsappFieldContinuityCurrentRevision/paginationUi/requestMatrix','/whatsappFieldContinuityCurrentRevision/paginationUi/commandEqualityGroups']),
 previousMatrixSha256:'8bbce7584e6c2c838f178b1585ce708ac4d366e9217ab7306faaa5615578255e',currentMatrixSha256:'db9a5685375c203cbb7f5e5204cb0ee06abdb9966785fec68401a7cb9e26447f',
 previousGroupsSha256:'8bd39d017dc56bd79c72e2b2518979e7c9c385408e6eccae269ce177dbf375e9',currentGroupsSha256:'574432d259b731e489f7f34139c8cc2b7bb7e9aaa24b5be1e84c46d8bfd70373',
 sourcePins:Object.freeze([
  Object.freeze({path:'scripts/lib/whatsapp-field-continuity-current-ci-lineage.mjs',previousSha256:'a1de3a73617de7c4eb2f9db8665650abe5798accb44b886cd8d2220fe5295bbf',currentSha256:'69ce909a5dc107718bfc91ece769bea47d96183bed51ce1ab7e1668dccc17b1b'}),
  Object.freeze({path:'scripts/verify-field-task-pagination-ui.mjs',previousSha256:'4b98ee409dfca7fa78ffac58c82796c9013f34286691e19e4993149ffd0ad604',currentSha256:'f5fb5468225bf0d0db4e084af6d500db78f61740985238eaa7c243bc902b8dba'}),
 ]),
});
// Only this exact old compiled declaration enables the preparation bootstrap.
// It never authenticates old source bytes as current v2 execution.
const fieldPaginationOracleReviewedV1Sha256='6ff7294132842d6a46c91c8b160222a3cd80776a58e263d5c620d6f7632c77cc';
const fieldPaginationOracleAdvanceV2=Object.freeze({
  "pointers": [
    "/whatsappFieldContinuityCurrentRevision/paginationUi/rawVersion",
    "/whatsappFieldContinuityCurrentRevision/paginationUi/requestMatrix",
    "/whatsappFieldContinuityCurrentRevision/paginationUi/commandEqualityGroups"
  ],
  "previousRawVersion": 1,
  "currentRawVersion": 2,
  "previousMatrixSha256": "8bbce7584e6c2c838f178b1585ce708ac4d366e9217ab7306faaa5615578255e",
  "currentMatrixSha256": "db9a5685375c203cbb7f5e5204cb0ee06abdb9966785fec68401a7cb9e26447f",
  "previousGroupsSha256": "8bd39d017dc56bd79c72e2b2518979e7c9c385408e6eccae269ce177dbf375e9",
  "currentGroupsSha256": "d0c69aaa8f06c2db70c45c7eeb66533022f87d89f18dd89fc24940cce63514f5",
 sourcePins:Object.freeze([
  Object.freeze({"path":"scripts/lib/whatsapp-field-continuity-current-ci-lineage.mjs","previousSha256":"a1de3a73617de7c4eb2f9db8665650abe5798accb44b886cd8d2220fe5295bbf","currentSha256":"34b6d5aabeb36566b3bb12bb4c464995432ac02b770206372b352cc25cd7841e"}),
  Object.freeze({"path":"scripts/verify-field-task-pagination-ui.mjs","previousSha256":"4b98ee409dfca7fa78ffac58c82796c9013f34286691e19e4993149ffd0ad604","currentSha256":"65e64823c5a4e44af04d83f618ef34c6627338e4b384d4ea72b395cd9a8d35f7"}),
  Object.freeze({"path":"scripts/verify-field-task-pagination-ci.mjs","previousSha256":"1e366a583be909323327524a8fe04db9eb962724ec5073bdf3eb36140ddcdecc","currentSha256":"dada467f6fdfebb36e2a15d44909febea5faa4a9d565d387c6f28ef864103746"}),
 ]),
});
function fieldPaginationOraclePatches(patches){
 const selected=patches.filter(row=>typeof row?.pointer==='string'&&(row.pointer==='/whatsappFieldContinuityCurrentRevision'||row.pointer.startsWith('/whatsappFieldContinuityCurrentRevision/')));
 if(selected.length===0)return selected;
 reject(same(selected.map(row=>row.pointer),fieldPaginationOracleAdvanceV1.pointers),'FIELD_PAGINATION_ORACLE_PATCH_PAIR');
 for(const patch of selected)exact(patch,['pointer','previous','current'],'FIELD_PAGINATION_ORACLE_PATCH_KEYS');
 const [matrix,groups]=selected;
 reject(Array.isArray(matrix.previous)&&matrix.previous.length===99&&Array.isArray(matrix.current)&&matrix.current.length===108,'FIELD_PAGINATION_ORACLE_MATRIX_SHAPE');
 reject(Array.isArray(groups.previous)&&groups.previous.length===7&&Array.isArray(groups.current)&&groups.current.length===7,'FIELD_PAGINATION_ORACLE_GROUP_SHAPE');
 reject(sha(JSON.stringify(matrix.previous))===fieldPaginationOracleAdvanceV1.previousMatrixSha256&&sha(JSON.stringify(matrix.current))===fieldPaginationOracleAdvanceV1.currentMatrixSha256,'FIELD_PAGINATION_ORACLE_EXACT_MATRIX_V1');
 reject(sha(JSON.stringify(groups.previous))===fieldPaginationOracleAdvanceV1.previousGroupsSha256&&sha(JSON.stringify(groups.current))===fieldPaginationOracleAdvanceV1.currentGroupsSha256,'FIELD_PAGINATION_ORACLE_EXACT_GROUPS_V1');
 const expected=[],indexMap=[],added=[];
 for(const[index,row]of matrix.previous.entries()){
  indexMap[index]=expected.length;
  if(row.mode==='consumption'&&row.path==='/api/identity/field-operations'&&row.method==='GET'){
   const {responseStatus,...base}=row,observed={...base,inventoryFilter:null,responseStatus};expected.push(observed);added.push(expected.length);expected.push({...observed,inventoryFilter:'PENDING'});
  }else expected.push(structuredClone(row));
 }
 reject(same(added,[10,23,36,49,62,75,85,95,105])&&same(matrix.current,expected),'FIELD_PAGINATION_ORACLE_EXACT_NINE_READ_ADVANCE');
 reject(same(groups.current,groups.previous.map(group=>group.map(index=>indexMap[index]))),'FIELD_PAGINATION_ORACLE_GROUP_REINDEX');
 const removed=new Set(added),restored=matrix.current.flatMap((row,index)=>{if(removed.has(index))return[];const value=structuredClone(row);if(value.mode==='consumption'&&value.path==='/api/identity/field-operations'&&value.method==='GET'){reject(value.inventoryFilter===null,'FIELD_PAGINATION_ORACLE_BASE_FILTER');delete value.inventoryFilter;}return[value];});
 reject(same(restored,matrix.previous),'FIELD_PAGINATION_ORACLE_COMPLETE_MATRIX_INVERSE');
 const previousPosts=matrix.previous.filter(row=>row.method==='POST'),currentPosts=matrix.current.filter(row=>row.method==='POST');reject(previousPosts.length===9&&same(previousPosts,currentPosts),'FIELD_PAGINATION_ORACLE_NINE_POSTS_UNCHANGED');
 return selected;
}
function fieldPaginationOraclePatchesV2(patches){
 const selected=patches.filter(row=>typeof row?.pointer==='string'&&(row.pointer==='/whatsappFieldContinuityCurrentRevision'||row.pointer.startsWith('/whatsappFieldContinuityCurrentRevision/')));
 reject(same(selected.map(row=>row.pointer),fieldPaginationOracleAdvanceV2.pointers),'FIELD_PAGINATION_ORACLE_PATCH_TRIPLE_V2');
 for(const patch of selected)exact(patch,['pointer','previous','current'],'FIELD_PAGINATION_ORACLE_PATCH_KEYS');
 const [version,matrix,groups]=selected;
 reject(version.previous===fieldPaginationOracleAdvanceV2.previousRawVersion&&version.current===fieldPaginationOracleAdvanceV2.currentRawVersion,'FIELD_PAGINATION_ORACLE_EXACT_RAW_VERSION_V2');
 reject(Array.isArray(matrix.previous)&&matrix.previous.length===99&&Array.isArray(matrix.current)&&matrix.current.length===108,'FIELD_PAGINATION_ORACLE_MATRIX_SHAPE');
 reject(Array.isArray(groups.previous)&&groups.previous.length===7&&Array.isArray(groups.current)&&groups.current.length===9,'FIELD_PAGINATION_ORACLE_GROUP_SHAPE');
 reject(sha(JSON.stringify(matrix.previous))===fieldPaginationOracleAdvanceV2.previousMatrixSha256&&sha(JSON.stringify(matrix.current))===fieldPaginationOracleAdvanceV2.currentMatrixSha256,'FIELD_PAGINATION_ORACLE_EXACT_MATRIX_V2');
 reject(sha(JSON.stringify(groups.previous))===fieldPaginationOracleAdvanceV2.previousGroupsSha256&&sha(JSON.stringify(groups.current))===fieldPaginationOracleAdvanceV2.currentGroupsSha256,'FIELD_PAGINATION_ORACLE_EXACT_GROUPS_V2');
 const expected=[],indexMap=[],added=[];
 for(const[index,row]of matrix.previous.entries()){
  indexMap[index]=expected.length;
  if(row.mode==='consumption'&&row.path==='/api/identity/field-operations'&&row.method==='GET'){
   const {responseStatus,...base}=row,observed={...base,inventoryFilter:null,responseStatus};expected.push(observed);added.push(expected.length);expected.push({...observed,inventoryFilter:'PENDING'});
  }else expected.push(structuredClone(row));
 }
 reject(same(added,[10,23,36,49,62,75,85,95,105])&&same(matrix.current,expected),'FIELD_PAGINATION_ORACLE_EXACT_NINE_READ_ADVANCE');
 reject(same(groups.current,[[80],[83],[87],[90],[93],[97],[100],[103],[107]])&&same(groups.current.flat(),matrix.current.flatMap((row,index)=>row.method==='POST'?[index]:[])),'FIELD_PAGINATION_ORACLE_EXACT_NINE_INDEPENDENT_POST_GROUPS_V2');
 const removed=new Set(added),restored=matrix.current.flatMap((row,index)=>{if(removed.has(index))return[];const value=structuredClone(row);if(value.mode==='consumption'&&value.path==='/api/identity/field-operations'&&value.method==='GET'){reject(value.inventoryFilter===null,'FIELD_PAGINATION_ORACLE_BASE_FILTER');delete value.inventoryFilter;}return[value];});
 reject(same(restored,matrix.previous),'FIELD_PAGINATION_ORACLE_COMPLETE_MATRIX_INVERSE');
 const previousPosts=matrix.previous.filter(row=>row.method==='POST'),currentPosts=matrix.current.filter(row=>row.method==='POST');reject(previousPosts.length===9&&same(previousPosts,currentPosts),'FIELD_PAGINATION_ORACLE_NINE_POSTS_UNCHANGED');
 return selected;
}
const dependencyLockPointer='/packageLockSha256',dependencyLockParentSha256='dfa3ff3914547f35828a0b697e6007c6cf856546be86bf8a7810cdce59e60449',dependencyLockParentBytes=334076;
const mobileReviewValidationPointer='/integratedIdentityCurrentRevision/validationDeltas/25/currentSha256',mobileReviewFile='scripts/verify-mobile-workspace-review-ui.mjs',mobileReviewParentSha256='7739e28a2ed86fbc8ed496306f4f682e776ea2cfee573be9e7f32d28f4f26449',mobileReviewParentBytes=20130,mobileReviewCurrentSha256='e363ec0b6888b93c87db9711cb00457597f02cfbc53937bbcdcba3827b23126d',mobileReviewAncestorSha256='14178c269b9032442f40712d6928f7cb68ee43b2e84b3348e6519953cbdee594';
const identityOnlyAdvancePointers=['/evidenceProducers/68/producerSha256','/identityDestinationUxCurrentRevision/browser/producerDelta/currentProducerSha256'],identityOnlyProofPointer='/extension/proofs/13/producerSha256',identityOnlyFile='scripts/verify-workspace-identity-only-ui.mjs',identityOnlyProofPath='.vercel/workspace-identity-only-evidence/browser.json',identityOnlyParentSha256='9e236a07c14417f23209a889de850820810f2ea978c1d44a4fe94688869ff3d8',identityOnlyParentBytes=77713,identityOnlyCurrentSha256='8f2425aac2fa82068a242125d3e8d694be1540ca75a90c531e5330d3715a2931',identityOnlyAncestorSha256='e11ed3c52c998f84c0e7ed21ebbe806a1aa8816007b7819203e7d6c4ef4add19';
// Two exact CURRENT producer/evidence repairs; historical values remain inverse data.
const currentProducerRepairPairs=Object.freeze([
  {
    "proofIndex": 18,
    "evidenceIndex": 71,
    "referenceIndex": 172,
    "historyIndex": 42,
    "producer": "scripts/verify-participant-kyc-preanalysis-ci.mjs",
    "id": "participant-kyc-preanalysis-postgres",
    "kind": "PG_PARTICIPANT_KYC_PREANALYSIS",
    "path": ".vercel/private/participant-kyc-preanalysis-evidence/current-ci.json",
    "blockId": 63,
    "lane": "people",
    "previousSha256": "1924e2cfb1aca511c692913ea9bde8115e145dd45a133757038a088fbb37363b",
    "currentSha256": "474f85dbc6523d29a067aa49254fb08649b7575b4cdb6dbd60b97fa43d62c8a9",
    "previousBytes": 20641,
    "currentBytes": 23111,
    "proofPointer": "/extension/proofs/18/producerSha256",
    "evidencePointer": "/evidenceProducers/71/producerSha256"
  },
  {
    "proofIndex": 20,
    "evidenceIndex": 73,
    "referenceIndex": 166,
    "historyIndex": 30,
    "producer": "scripts/verify-field-task-pagination-ci.mjs",
    "id": "field-task-pagination-ui",
    "kind": "UI_FIELD_TASK_PAGINATION",
    "path": ".vercel/private/field-task-pagination-ui-evidence/current-ci.json",
    "blockId": 65,
    "lane": "field",
    "previousSha256": "1e366a583be909323327524a8fe04db9eb962724ec5073bdf3eb36140ddcdecc",
    "currentSha256": "dada467f6fdfebb36e2a15d44909febea5faa4a9d565d387c6f28ef864103746",
    "previousBytes": 31564,
    "currentBytes": 37945,
    "proofPointer": "/extension/proofs/20/producerSha256",
    "evidencePointer": "/evidenceProducers/73/producerSha256"
  }
].map(Object.freeze));
const currentProducerRepairEvidencePointers=Object.freeze(currentProducerRepairPairs.map(row=>row.evidencePointer));
const focusedProducerFile='scripts/verify-focused-workspace-ci.mjs',focusedProducerProofPointer='/extension/proofs/19/producerSha256',focusedProducerEvidencePointer='/evidenceProducers/72/producerSha256',focusedProducerPointers=[focusedProducerProofPointer,focusedProducerEvidencePointer],focusedProducerPreviousSha256='532e37e994540a6fecd8c70d067730cddec4a66403686113cef4087828c2229c',focusedProducerCurrentSha256='1c88802d83a1910ca7b79c833be198a25ccfcbda8b816ed94729fd4cc7e2b539',focusedProducerPreviousBytes=35789,focusedProducerCurrentBytes=36967;
const identityScenarioMainFile='.github/scripts/verify-workspace-ci-parallelization.mjs',identityScenarioMainCurrentSha256='82997e7e3e006f8ec51eb9c29fe4ea5a44aba8e8e877f90cc833f2bbf2f75946',identityScenarioMainParentSha256='7f6e61638298e3df1d291c429cc4349a7fa0d1c7b68d1efca43851c2dd7b9307',identityScenarioMainParentBytes=408348,identityScenarioMainReferencePreviousSha256='8d65b7fb1446dc0533f69097ae28598a7c748f50c19eb586614ce078bf3aebac';
const pointer=(value,key)=>{
 reject(typeof key==='string'&&(key===dependencyLockPointer||key===mobileReviewValidationPointer||key===focusedProducerEvidencePointer||currentProducerRepairEvidencePointers.includes(key)||identityOnlyAdvancePointers.includes(key)||/^\/(?:planBudgetCurrentRevision\/(?:references(?:\/\d+\/currentSha256)?|sourceFamilies\/\d+\/(?:currentFiles|externalImports|currentManifest))|extension\/proofs\/\d+\/(?:sourceFiles|producerSha256))$/.test(key)||fieldPaginationOracleAdvanceV2.pointers.includes(key)),'PATCH_POINTER');
 const parts=key.slice(1).split('/');let owner=value;for(const part of parts.slice(0,-1)){reject(owner!==null&&typeof owner==='object'&&Object.hasOwn(owner,part),'PATCH_POINTER');owner=owner[part];}const final=parts.at(-1);reject(owner!==null&&typeof owner==='object'&&Object.hasOwn(owner,final),'PATCH_POINTER');return{owner,key:final};
};

// The public wrapper binds this gate to the compiled reviewed declaration.
// Source authentication and native business oracles retain separate scopes.
export function createCaptureRuntimeGate(reviewed){
 reject(plain(reviewed),'CONSTRUCTOR');
 reject(sha(createCaptureQualityParentGate.toString().replaceAll('\r\n','\n')+'\n')==='18ddf75e7f7849728670140880f318b7fc904c51b40eebb7286716a297ad064f','AUTHENTICATED_LITERAL_PARENT_FACTORY');
 const expected=structuredClone(reviewed),runtime=expected[revision],expectedJson=JSON.stringify(expected);
 exact(runtime,['version','parentHead','previousContractSha256','previousDeclarationSha256','sourceAliases','referenceAdvances','sourceHistory','familyAdvances','proofSourceSetAdvances','contractPatches','workflowAdditions','workflowParentSemanticSha256','nativeSourceAdvances','browserSourceAdvances','nativeOrHumanAcceptance'],'RUNTIME_KEYS');
 reject(runtime.version===1&&runtime.parentHead===CAPTURE_QUALITY_PARENT&&runtime.previousContractSha256===CAPTURE_QUALITY_PARENT_CONTRACT_SHA256&&runtime.previousDeclarationSha256===CAPTURE_QUALITY_PARENT_DECLARATION_SHA256&&runtime.nativeOrHumanAcceptance===false,'PARENT');
 for(const key of ['sourceAliases','referenceAdvances','sourceHistory','familyAdvances','proofSourceSetAdvances','contractPatches','workflowAdditions'])reject(Array.isArray(runtime[key]),'ARRAY_'+key);
 const paginationOracleV1=sha(declaration(expected))===fieldPaginationOracleReviewedV1Sha256;
 const paginationOracleAdvance=paginationOracleV1?fieldPaginationOracleAdvanceV1:fieldPaginationOracleAdvanceV2;
 const paginationOraclePatches=paginationOracleV1?fieldPaginationOraclePatches(runtime.contractPatches):fieldPaginationOraclePatchesV2(runtime.contractPatches);
 reject(hash(runtime.workflowParentSemanticSha256),'WORKFLOW_PARENT_PIN');
 const inverse=value=>{for(const patch of [...runtime.contractPatches].reverse()){exact(patch,['pointer','previous','current'],'PATCH_KEYS');const target=pointer(value,patch.pointer);reject(same(target.owner[target.key],patch.current),'PATCH_CURRENT');target.owner[target.key]=structuredClone(patch.previous);}return value;};
 const parentContainer={[section]:structuredClone(expected)};delete parentContainer[section][revision];
 for(const patch of [...runtime.contractPatches].reverse().filter(row=>row.pointer.startsWith('/'+section+'/'))){const target=pointer(parentContainer,patch.pointer);reject(same(target.owner[target.key],patch.current),'PARENT_DECLARATION_PATCH');target.owner[target.key]=structuredClone(patch.previous);}
 const parentExpected=parentContainer[section];reject(sha(declaration(parentExpected))===CAPTURE_QUALITY_PARENT_DECLARATION_SHA256,'COMPLETE_PARENT_DECLARATION');
 const parentGate=createCaptureQualityParentGate(structuredClone(parentExpected));
 const freezePinMetadata=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freezePinMetadata);Object.freeze(value);}return value;};
 const parentPinCarrier=freezePinMetadata({[section]:structuredClone(parentExpected)});
 const histories=new Map(),references=new Map();
 for(const ref of expected.references){reject(safe(ref.path)&&hash(ref.currentSha256)&&!references.has(ref.path),'REFERENCE');references.set(ref.path,ref);}
 for(const row of runtime.sourceHistory){
  exact(row,['path','status','previousSha256','currentSha256','previousBytes','currentBytes','inverseHunks'],'HISTORY_KEYS');
  reject(safe(row.path)&&row.path!==anchor&&row.path!==contractPath&&!histories.has(row.path)&&hash(row.currentSha256)&&(row.previousSha256===null||hash(row.previousSha256)),'HISTORY_PATH');
  reject(row.status===(row.previousSha256===null?'ADDED':'MODIFIED')&&Number.isSafeInteger(row.previousBytes)&&row.previousBytes>=0&&Number.isSafeInteger(row.currentBytes)&&row.currentBytes>0&&Array.isArray(row.inverseHunks)&&row.inverseHunks.length>0,'HISTORY_SHAPE');
  reject(row.previousSha256===null?row.previousBytes===0:row.previousBytes>0&&row.previousSha256!==row.currentSha256,'HISTORY_PARENT');
  let end=0;for(const hunk of row.inverseHunks){exact(hunk,['currentOffsetCharacters','currentText','previousText'],'HUNK_KEYS');reject(Number.isSafeInteger(hunk.currentOffsetCharacters)&&hunk.currentOffsetCharacters>=end&&typeof hunk.currentText==='string'&&typeof hunk.previousText==='string'&&hunk.currentText!==hunk.previousText,'ORDERED_HUNKS');end=hunk.currentOffsetCharacters+hunk.currentText.length;}
  reject(references.get(row.path)?.currentSha256===row.currentSha256,'CURRENT_HISTORY_REFERENCE');histories.set(row.path,row);
 }
 // A missing lock history must retain its own denial before position-bound producer checks.
 if(runtime.contractPatches.some(row=>row?.pointer===dependencyLockPointer))reject(histories.get('package-lock.json')?.status==='MODIFIED','DEPENDENCY_LOCK_HISTORY_REQUIRED');
 const activeProducerRepairs=paginationOracleV1?[]:currentProducerRepairPairs;
 if(paginationOracleV1)reject(!runtime.contractPatches.some(row=>currentProducerRepairEvidencePointers.includes(row?.pointer)),'SEALED_V1_HAS_NO_CURRENT_PRODUCER_REPAIR');
 for(const pair of activeProducerRepairs){
  const history=histories.get(pair.producer),reference=references.get(pair.producer),patches=runtime.contractPatches.filter(row=>row?.pointer===pair.proofPointer||row?.pointer===pair.evidencePointer);
  reject(history===runtime.sourceHistory[pair.historyIndex]&&history?.path===pair.producer&&history.status==='MODIFIED'&&history.previousSha256===pair.previousSha256&&history.currentSha256===pair.currentSha256&&history.previousBytes===pair.previousBytes&&history.currentBytes===pair.currentBytes,'CURRENT_PRODUCER_REPAIR_EXACT_HISTORY_'+pair.id);
  reject(reference===expected.references[pair.referenceIndex]&&reference?.path===pair.producer&&reference.previousSha256===pair.previousSha256&&reference.currentSha256===pair.currentSha256,'CURRENT_PRODUCER_REPAIR_EXACT_REFERENCE_'+pair.id);
  reject(patches.length===2&&same(patches.map(row=>row.pointer),[pair.proofPointer,pair.evidencePointer]),'CURRENT_PRODUCER_REPAIR_EXACT_PATCH_PAIR_'+pair.id);
  for(const patch of patches){exact(patch,['pointer','previous','current'],'CURRENT_PRODUCER_REPAIR_PATCH_KEYS');reject(patch.previous===pair.previousSha256&&patch.current===pair.currentSha256,'CURRENT_PRODUCER_REPAIR_EXACT_PATCH_PINS_'+pair.id);}
 }
 const focusedProducerPatches=runtime.contractPatches.filter(row=>focusedProducerPointers.includes(row?.pointer)),focusedProducerHistory=histories.get(focusedProducerFile),focusedProducerReference=references.get(focusedProducerFile);
 if(focusedProducerPatches.length||focusedProducerHistory||focusedProducerReference){
  reject(focusedProducerHistory===runtime.sourceHistory[175]&&focusedProducerHistory?.path===focusedProducerFile&&focusedProducerHistory.status==='MODIFIED'&&focusedProducerHistory.previousSha256===focusedProducerPreviousSha256&&focusedProducerHistory.currentSha256===focusedProducerCurrentSha256&&focusedProducerHistory.previousBytes===focusedProducerPreviousBytes&&focusedProducerHistory.currentBytes===focusedProducerCurrentBytes,'FOCUSED_CURRENT_PRODUCER_EXACT_SOURCE_HISTORY');
  reject(focusedProducerReference===expected.references[267]&&focusedProducerReference?.path===focusedProducerFile&&focusedProducerReference.previousSha256===focusedProducerPreviousSha256&&focusedProducerReference.currentSha256===focusedProducerCurrentSha256,'FOCUSED_CURRENT_PRODUCER_EXACT_REFERENCE');
  reject(focusedProducerPatches.length===2&&same(focusedProducerPatches.map(row=>row.pointer),focusedProducerPointers),'FOCUSED_CURRENT_PRODUCER_EXACT_PATCH_PAIR');
  for(const patch of focusedProducerPatches){exact(patch,['pointer','previous','current'],'FOCUSED_CURRENT_PRODUCER_PATCH_KEYS');reject(patch.previous===focusedProducerPreviousSha256&&patch.current===focusedProducerCurrentSha256,'FOCUSED_CURRENT_PRODUCER_EXACT_PATCH_PINS');}
 }
 if(paginationOraclePatches.length)for(const pin of paginationOracleAdvance.sourcePins){const history=histories.get(pin.path);reject(history?.status==='MODIFIED'&&history.previousSha256===pin.previousSha256&&history.currentSha256===pin.currentSha256&&references.get(pin.path)?.currentSha256===pin.currentSha256,'FIELD_PAGINATION_ORACLE_EXACT_SOURCE_HISTORY_'+pin.path);}
 else reject(paginationOracleAdvance.sourcePins.every(pin=>references.get(pin.path)?.currentSha256!==pin.currentSha256&&histories.get(pin.path)?.currentSha256!==pin.currentSha256),'FIELD_PAGINATION_ORACLE_PATCHES_REQUIRED');
 // Only these five exact leaf advances may cross the frozen literal731 contract.
 const lockPatches=runtime.contractPatches.filter(row=>row?.pointer===dependencyLockPointer),lockHistory=histories.get('package-lock.json');
 if(lockPatches.length){
  reject(lockHistory?.status==='MODIFIED','DEPENDENCY_LOCK_HISTORY_REQUIRED');
  reject(lockHistory.previousSha256===dependencyLockParentSha256&&lockHistory.previousBytes===dependencyLockParentBytes,'DEPENDENCY_LOCK_EXACT_731_PARENT');
  reject(lockPatches.length===1&&lockPatches[0].previous===dependencyLockParentSha256&&lockPatches[0].current===lockHistory.currentSha256&&references.get('package-lock.json')?.currentSha256===lockHistory.currentSha256,'DEPENDENCY_LOCK_EXACT_CURRENT_PATCH');
 }else reject(!lockHistory,'DEPENDENCY_LOCK_PATCH_REQUIRED');
 const mobilePatches=runtime.contractPatches.filter(row=>row?.pointer===mobileReviewValidationPointer),mobileHistory=histories.get(mobileReviewFile);
 if(mobilePatches.length){
  reject(mobileHistory?.status==='MODIFIED','MOBILE_REVIEW_HISTORY_REQUIRED');
  reject(mobileHistory.previousSha256===mobileReviewParentSha256&&mobileHistory.previousBytes===mobileReviewParentBytes&&mobileHistory.currentSha256===mobileReviewCurrentSha256,'MOBILE_REVIEW_EXACT_731_AND_CURRENT_SOURCE');
  reject(mobilePatches.length===1&&mobilePatches[0].previous===mobileReviewParentSha256&&mobilePatches[0].current===mobileReviewCurrentSha256&&references.get(mobileReviewFile)?.currentSha256===mobileReviewCurrentSha256,'MOBILE_REVIEW_EXACT_CURRENT_PATCH');
 }else reject(!mobileHistory,'MOBILE_REVIEW_PATCH_REQUIRED');
 const identityPatches=runtime.contractPatches.filter(row=>identityOnlyAdvancePointers.includes(row?.pointer)),identityProofPatches=runtime.contractPatches.filter(row=>row?.pointer===identityOnlyProofPointer),identityHistory=histories.get(identityOnlyFile);
 if(identityPatches.length||identityHistory){
  reject(identityHistory?.status==='MODIFIED'&&identityHistory.previousSha256===identityOnlyParentSha256&&identityHistory.previousBytes===identityOnlyParentBytes&&identityHistory.currentSha256===identityOnlyCurrentSha256&&references.get(identityOnlyFile)?.currentSha256===identityOnlyCurrentSha256,'IDENTITY_ONLY_EXACT_731_AND_CURRENT_SOURCE');
  reject(identityPatches.length===2&&same(identityPatches.map(row=>row.pointer),identityOnlyAdvancePointers)&&identityPatches.every(row=>row.previous===identityOnlyParentSha256&&row.current===identityOnlyCurrentSha256)&&identityProofPatches.length===1&&identityProofPatches[0].previous===identityOnlyParentSha256&&identityProofPatches[0].current===identityOnlyCurrentSha256,'IDENTITY_ONLY_EXACT_CURRENT_PATCHES');
 }else reject(identityProofPatches.length===0,'IDENTITY_ONLY_HISTORY_REQUIRED');
 // The reviewed security successor admits only this exact Main206 source.
 // Existing intermediate pins remain source-history data, never a hash whitelist.
 if(lockPatches.length){
  const h=runtime.sourceHistory[2],ref=expected.references[0],advance=runtime.referenceAdvances[0],patch=runtime.contractPatches[3],referencePatch=runtime.contractPatches[52];
  reject(h?.path===identityScenarioMainFile&&h.status==='MODIFIED'&&h.previousSha256===identityScenarioMainParentSha256&&h.previousBytes===identityScenarioMainParentBytes&&h.currentSha256===identityScenarioMainCurrentSha256,'IDENTITY_SCENARIO_SELFTEST_EXACT_CURRENT_HISTORY');
  reject(ref?.path===identityScenarioMainFile&&ref.previousSha256===identityScenarioMainReferencePreviousSha256&&ref.currentSha256===identityScenarioMainCurrentSha256&&advance?.path===identityScenarioMainFile&&advance.previousSha256===identityScenarioMainParentSha256&&advance.currentSha256===identityScenarioMainCurrentSha256,'IDENTITY_SCENARIO_SELFTEST_EXACT_REFERENCE_AND_ADVANCE');
  reject(patch?.pointer==='/planBudgetCurrentRevision/references/0/currentSha256'&&patch.previous===identityScenarioMainParentSha256&&patch.current===identityScenarioMainCurrentSha256&&referencePatch?.pointer==='/planBudgetCurrentRevision/references'&&referencePatch.previous[0]?.path===identityScenarioMainFile&&referencePatch.previous[0].currentSha256===identityScenarioMainCurrentSha256&&referencePatch.current[0]?.path===identityScenarioMainFile&&referencePatch.current[0].currentSha256===identityScenarioMainCurrentSha256,'IDENTITY_SCENARIO_SELFTEST_EXACT_SIX_BINDINGS');
 }
 const advances=[...runtime.referenceAdvances,...runtime.sourceAliases];reject(advances.length===histories.size&&new Set(advances.map(row=>row.path)).size===advances.length,'COMPLETE_REFERENCE_ADVANCES');
 for(const ref of advances){exact(ref,['path','previousSha256','currentSha256'],'ADVANCE_KEYS');const history=histories.get(ref.path);reject(history&&ref.previousSha256===history.previousSha256&&ref.currentSha256===history.currentSha256,'ADVANCE_HISTORY');const previous=parentExpected.references.find(row=>row.path===ref.path);reject(runtime.referenceAdvances.includes(ref)?previous?.currentSha256===ref.previousSha256:!previous,'EXACT_PREVIOUS_REFERENCE');}
 const changedFamilies=expected.sourceFamilies.filter(family=>!same(family,parentExpected.sourceFamilies.find(row=>row.family===family.family))).map(family=>family.family);
 reject(same(runtime.familyAdvances.map(row=>row.family),changedFamilies),'COMPLETE_FAMILY_ADVANCES');
 for(const row of runtime.familyAdvances){exact(row,['family','previousCount','currentCount','additions','removals'],'FAMILY_ADVANCE_KEYS');const prior=parentExpected.sourceFamilies.find(family=>family.family===row.family),current=expected.sourceFamilies.find(family=>family.family===row.family);sorted(row.additions,'FAMILY_ADDITIONS');sorted(row.removals,'FAMILY_REMOVALS');sorted(current?.currentFiles,'CURRENT_FAMILY_FILES');reject(prior&&current&&same(current.currentManifest.map(ref=>ref.path),current.currentFiles)&&current.currentManifest.every(ref=>ref.path===anchor||hash(ref.sha256))&&row.previousCount===prior.currentFiles.length&&row.currentCount===current.currentFiles.length&&row.removals.length===0&&same([...prior.currentFiles,...row.additions].sort(),current.currentFiles),'EXACT_ADDITIVE_FAMILY');}
 for(const row of runtime.proofSourceSetAdvances){exact(row,['id','kind','previousFiles','currentFiles','additions','removals'],'PROOF_ADVANCE_KEYS');for(const key of ['previousFiles','currentFiles','additions','removals'])sorted(row[key],'PROOF_'+key);reject(row.removals.length===0&&same([...row.previousFiles,...row.additions].sort(),row.currentFiles),'EXACT_ADDITIVE_PROOF');}
 const proofPatches=runtime.contractPatches.filter(row=>/^\/extension\/proofs\/\d+\/sourceFiles$/.test(row.pointer));reject(proofPatches.length===runtime.proofSourceSetAdvances.length&&new Set(runtime.proofSourceSetAdvances.map(row=>row.id)).size===runtime.proofSourceSetAdvances.length,'COMPLETE_PROOF_ADVANCES');
 for(const row of runtime.workflowAdditions){exact(row,['lane','index','step'],'WORKFLOW_ADDITION_KEYS');reject(typeof row.lane==='string'&&Number.isSafeInteger(row.index)&&row.index>=0&&plain(row.step)&&typeof row.step.run==='string'&&row.step.run.length>0,'WORKFLOW_ADDITION');}
 reject(runtime.workflowAdditions.length===0||histories.has('.github/workflows/workspace-acceptance.yml'),'WORKFLOW_CURRENT_SOURCE_HISTORY');
 function metadata(contract){reject(plain(contract),'CONTRACT');reject(Object.hasOwn(contract,section),'BUDGET_COMPANION_REQUIRED');reject(JSON.stringify(contract[section])===expectedJson,'IMMUTABLE_COMPANION');}
 function restoreParentContract(contract){metadata(contract);for(const pair of activeProducerRepairs){const proof=contract.extension?.proofs?.[pair.proofIndex],producer=contract.evidenceProducers?.[pair.evidenceIndex];exact(proof,['id','lane','blockId','path','kind','producer','producerSha256','sourceFiles','checkNames'],'CURRENT_PRODUCER_REPAIR_PROOF_KEYS');exact(producer,['producer','path','retained','blockId','lane','producerSha256','sourceBasis'],'CURRENT_PRODUCER_REPAIR_EVIDENCE_KEYS');reject(proof.id===pair.id&&proof.kind===pair.kind&&proof.producer===pair.producer&&proof.path===pair.path&&proof.lane===pair.lane&&proof.blockId===pair.blockId&&proof.producerSha256===pair.currentSha256,'CURRENT_PRODUCER_REPAIR_EXACT_PROOF_'+pair.id);reject(producer.producer===pair.producer&&producer.path===pair.path&&producer.blockId===pair.blockId&&producer.lane===pair.lane&&producer.retained===true&&producer.sourceBasis==='EXPECTED_HEAD_GIT_BYTES'&&producer.producerSha256===pair.currentSha256,'CURRENT_PRODUCER_REPAIR_EXACT_EVIDENCE_'+pair.id);}if(focusedProducerPatches.length){const proof=contract.extension?.proofs?.[19],producer=contract.evidenceProducers?.[72];exact(proof,['id','lane','blockId','path','kind','producer','producerSha256','sourceFiles','checkNames'],'FOCUSED_CURRENT_PRODUCER_PROOF_KEYS');exact(producer,['producer','path','retained','blockId','lane','producerSha256','sourceBasis'],'FOCUSED_CURRENT_PRODUCER_EVIDENCE_KEYS');reject(proof.id==='focused-workspace-ui'&&proof.kind==='UI_FOCUSED_WORKSPACE'&&proof.producer===focusedProducerFile&&proof.path==='.vercel/private/focused-workspace-ui-evidence/current-ci.json'&&proof.lane==='workspace-ui'&&proof.blockId===64&&proof.producerSha256===focusedProducerCurrentSha256,'FOCUSED_CURRENT_PRODUCER_EXACT_PROOF');reject(producer.producer===focusedProducerFile&&producer.path===proof.path&&producer.blockId===64&&producer.lane==='workspace-ui'&&producer.retained===true&&producer.sourceBasis==='EXPECTED_HEAD_GIT_BYTES'&&producer.producerSha256===focusedProducerCurrentSha256,'FOCUSED_CURRENT_PRODUCER_EXACT_EVIDENCE');}if(lockPatches.length)reject(contract.infrastructureCheck?.id==='ci-gate-selftest'&&contract.infrastructureCheck.producer===identityScenarioMainFile&&contract.infrastructureCheck.lane==='contracts','IDENTITY_SCENARIO_SELFTEST_EXACT_INFRASTRUCTURE');if(mobilePatches.length){const row=contract.integratedIdentityCurrentRevision?.validationDeltas?.[25];reject(row?.path===mobileReviewFile&&row.previousSha256===mobileReviewAncestorSha256&&row.currentSha256===mobileReviewCurrentSha256,'MOBILE_REVIEW_EXACT_VALIDATION_PATH_AND_CURRENT');}if(identityPatches.length){const proof=contract.extension?.proofs?.[13],producer=contract.evidenceProducers?.[68],delta=contract.identityDestinationUxCurrentRevision?.browser?.producerDelta;reject(proof?.id==='identity-only-ui'&&proof.kind==='UI_IDENTITY_ONLY'&&proof.producer===identityOnlyFile&&proof.path===identityOnlyProofPath&&proof.producerSha256===identityOnlyCurrentSha256,'IDENTITY_ONLY_EXACT_PROOF_PATH_AND_CURRENT');reject(producer?.producer===identityOnlyFile&&producer.path===identityOnlyProofPath&&producer.blockId===60&&producer.lane==='workspace-ui'&&producer.producerSha256===identityOnlyCurrentSha256,'IDENTITY_ONLY_EXACT_EVIDENCE_AND_CURRENT');reject(delta?.id==='identity-only-ui'&&delta.producer===identityOnlyFile&&delta.path===identityOnlyProofPath&&delta.previousProducerSha256===identityOnlyAncestorSha256&&delta.currentProducerSha256===identityOnlyCurrentSha256,'IDENTITY_ONLY_EXACT_BROWSER_DELTA_AND_CURRENT');}for(const patch of proofPatches){const index=Number(patch.pointer.split('/')[3]),spec=contract.extension?.proofs?.[index],row=runtime.proofSourceSetAdvances.find(value=>value.id===spec?.id);reject(row&&row.kind===spec.kind&&same(row.previousFiles,patch.previous)&&same(row.currentFiles,patch.current),'EXACT_PROOF_PATCH_JOIN');}for(const patch of runtime.contractPatches.filter(row=>/^\/extension\/proofs\/\d+\/producerSha256$/.test(row.pointer))){const spec=contract.extension?.proofs?.[Number(patch.pointer.split('/')[3])];reject(spec&&patch.current===references.get(spec.producer)?.currentSha256,'EXACT_PRODUCER_REFERENCE_JOIN');}const out=structuredClone(contract);delete out[section][revision];inverse(out);if(sha(serialize(out))!==CAPTURE_QUALITY_PARENT_CONTRACT_SHA256){parentGate.restorePlanBudgetAcceptancePreviousContract(out);reject(false,'COMPLETE_PARENT_CONTRACT');}return out;}
 function restorePreviousSource(file,value){const original=bytes(value,file),history=histories.get(file);if(!history)return Buffer.from(value);let text=original.toString('utf8');reject(sha(original)===history.currentSha256&&original.length===history.currentBytes,'CURRENT_SOURCE_'+file);for(const hunk of [...history.inverseHunks].reverse()){const at=hunk.currentOffsetCharacters;reject(text.slice(at,at+hunk.currentText.length)===hunk.currentText,'EXACT_HUNK_'+file);text=text.slice(0,at)+hunk.previousText+text.slice(at+hunk.currentText.length);}const previous=Buffer.from(text);reject(previous.length===history.previousBytes&&(history.previousSha256===null?previous.length===0:sha(previous)===history.previousSha256),'COMPLETE_SOURCE_INVERSE_'+file);return history.previousSha256===null?null:previous;}
 const read=(reader,file)=>{reject(safe(file)&&typeof reader==='function','SOURCE_READER');const value=reader(file);bytes(value,file);return Buffer.from(value);};
 function verifyActual(contract,reader){
  const parent=restoreParentContract(contract);reject(bytes(read(reader,contractPath),contractPath).toString('utf8')===serialize(contract),'CURRENT_CONTRACT_BYTES');reject(bytes(read(reader,anchor),anchor).toString('utf8')===declaration(expected),'CURRENT_DECLARATION_BYTES');
  for(const ref of expected.references)reject(sha(bytes(read(reader,ref.path),ref.path))===ref.currentSha256,'CURRENT_REFERENCE_'+ref.path);for(const file of histories.keys())restorePreviousSource(file,read(reader,file));for(const pin of browserAdvance.currentLfManifest)reject(sha(bytes(read(reader,pin.path),pin.path))===pin.sha256,'CURRENT_BROWSER_SOURCE_'+pin.path);return parent;
 }
 function projectedReader(contract,parent,reader){return file=>{const value=read(reader,file);if(file===contractPath){reject(bytes(value,file).toString('utf8')===serialize(contract),'CURRENT_CONTRACT_BYTES');return Buffer.from(serialize(parent));}if(file===anchor){reject(bytes(value,file).toString('utf8')===declaration(expected),'CURRENT_DECLARATION_BYTES');return Buffer.from(declaration(parentExpected));}return restorePreviousSource(file,value);};}
 function verifyCurrentSources(contract,reader){return withVerifiedParentReader(contract,reader,(parent,_projected,parentVerifyResult)=>{return{...parentVerifyResult,referenceCount:expected.references.length,captureQualityParentRestored:true,nativeOrHumanAcceptance:false};});}
 const activeScopes=[];
 function withVerifiedParentReader(contract,reader,run){reject(typeof run==='function','PARENT_READER_CALLBACK');const initialContract=JSON.stringify(contract),parent=verifyActual(contract,reader),parentJson=JSON.stringify(parent),projected=projectedReader(contract,parent,reader);const parentVerifyResult=structuredClone(parentGate.verifyPlanBudgetCurrentSources(parent,projected));const scope={outerContract:contract,outerReader:reader,parentJson};activeScopes.push(scope);try{const result=run(parent,projected,structuredClone(parentVerifyResult));reject(!result||typeof result.then!=='function','SYNCHRONOUS_PARENT_CALLBACK_REQUIRED');return result;}finally{reject(activeScopes.pop()===scope,'OWNED_SYNCHRONOUS_SCOPE');reject(JSON.stringify(contract)===initialContract&&JSON.stringify(parent)===parentJson,'CONTRACT_AND_PARENT_UNCHANGED');verifyActual(contract,reader);}}
 function historicalAuthority(name,contract,reader,...args){const scope=activeScopes.at(-1);reject(scope&&scope.parentJson===JSON.stringify(contract),'CURRENT_CAPTURE_RUNTIME_REQUIRED');verifyActual(scope.outerContract,scope.outerReader);try{return parentGate[name](contract,...args,reader);}finally{verifyActual(scope.outerContract,scope.outerReader);}}
 function verifyActualClosure(contract,family,closure,reader){const parent=verifyActual(contract,reader),current=expected.sourceFamilies.find(row=>row.family===family),previous=parentExpected.sourceFamilies.find(row=>row.family===family);exact(closure,['files','externalImports'],'CLOSURE_KEYS');reject(current&&previous&&same(closure.files,current.currentFiles)&&same(closure.externalImports,current.externalImports),'EXACT_CURRENT_CLOSURE');for(const ref of current.currentManifest){const value=bytes(read(reader,ref.path),ref.path);reject(ref.path===anchor?value.toString('utf8')===declaration(expected):sha(value)===ref.sha256,'CURRENT_FAMILY_SOURCE_'+ref.path);}parentGate.verifyPlanBudgetActualClosure(parent,family,{files:[...previous.currentFiles],externalImports:[...previous.externalImports]},projectedReader(contract,parent,reader));verifyActual(contract,reader);return{family,sourceCount:current.currentFiles.length,sourcePathsSha256:sha(JSON.stringify(current.currentFiles)),nativeOrBrowserAcceptance:false};}
 function applyWorkflowAdditions(parentWorkflow){reject(sha(JSON.stringify(parentWorkflow))===runtime.workflowParentSemanticSha256,'EXACT_PARENT_WORKFLOW');const out=structuredClone(parentWorkflow);for(const row of runtime.workflowAdditions){reject(Array.isArray(out.jobs?.[row.lane]?.steps)&&row.index<=out.jobs[row.lane].steps.length,'WORKFLOW_INSERTION');out.jobs[row.lane].steps.splice(row.index,0,structuredClone(row.step));}const restored=structuredClone(out);for(const row of [...runtime.workflowAdditions].reverse()){reject(same(restored.jobs[row.lane].steps[row.index],row.step),'WORKFLOW_EXACT_ADDITION');restored.jobs[row.lane].steps.splice(row.index,1);}reject(same(restored,parentWorkflow),'COMPLETE_PARENT_WORKFLOW');return out;}
 reject(Array.isArray(runtime.nativeSourceAdvances)&&same(runtime.nativeSourceAdvances.map(row=>row.kind),['MATERIAL','PG_BANK','PG_INTAKE','PG_FIELD','PG_COMPANY_KYC']),'EXACT_NATIVE_ADAPTER_KINDS');
 for(const row of runtime.nativeSourceAdvances){
  exact(row,['kind','producer','proofPath','previousProducerLfSha256','currentProducerLfSha256','previousFiles','currentFiles','currentLfManifest','nested'],'NATIVE_ADVANCE_KEYS');const material=row.kind==='MATERIAL',binding={MATERIAL:['scripts/verify-material-inventory-postgres.mjs','.vercel/material-inventory-evidence/postgres.json'],PG_BANK:['scripts/verify-private-bank-account-postgres.mjs','.vercel/private-bank-evidence/postgres.json'],PG_INTAKE:['scripts/verify-employee-intake-postgres.mjs','.vercel/private/employee-intake-postgres.json'],PG_FIELD:['scripts/verify-field-operations-postgres.mjs','.vercel/field-operations-evidence/postgres.json'],PG_COMPANY_KYC:['scripts/verify-company-channel-kyc-postgres.mjs','.vercel/company-kyc-evidence/postgres.json']},[producer,proofPath]=binding[row.kind],proofAdvance=runtime.proofSourceSetAdvances.find(value=>value.kind===row.kind);
  reject(row.producer===producer&&row.proofPath===proofPath&&hash(row.previousProducerLfSha256)&&hash(row.currentProducerLfSha256)&&row.currentProducerLfSha256===references.get(producer)?.currentSha256,'EXACT_NATIVE_PRODUCER');sorted(row.previousFiles,'NATIVE_PREVIOUS_FILES');sorted(row.currentFiles,'NATIVE_CURRENT_FILES');reject(row.previousFiles.every(file=>row.currentFiles.includes(file)),'ADDITIVE_NATIVE_FILES');reject(same(row.previousFiles,material?parentExpected.consumptionEvidenceRuntime.materialNative.currentFiles:proofAdvance?.previousFiles),'EXACT_NATIVE_PREVIOUS_SET');if(!material)reject(same(row.currentFiles,proofAdvance.currentFiles),'COMPANY_CURRENT_PROOF_SET_JOIN');
  reject(Array.isArray(row.currentLfManifest)&&same(row.currentLfManifest.map(value=>value.path),[...new Set([...row.currentFiles,producer])].sort()),'COMPLETE_NATIVE_LF_MANIFEST');for(const pin of row.currentLfManifest){exact(pin,['path','sha256'],'NATIVE_LF_PIN_KEYS');reject(hash(pin.sha256)&&(!references.has(pin.path)||references.get(pin.path).currentSha256===pin.sha256),'NATIVE_REFERENCE_JOIN');}reject(row.currentLfManifest.find(pin=>pin.path===producer)?.sha256===row.currentProducerLfSha256,'NATIVE_PRODUCER_LF_JOIN');reject(row.previousProducerLfSha256===(histories.get(producer)?.previousSha256??parentExpected.references.find(pin=>pin.path===producer)?.currentSha256),'NATIVE_PREVIOUS_PRODUCER_JOIN');reject(row.kind==='PG_COMPANY_KYC'?plain(row.nested):row.nested===null||row.kind==='PG_FIELD'&&plain(row.nested),'EXACT_NATIVE_NESTED_MODE');
 }
 reject(Array.isArray(runtime.browserSourceAdvances)&&runtime.browserSourceAdvances.length===1,'EXACT_BROWSER_ADVANCE');
 const browserAdvance=runtime.browserSourceAdvances[0],browserParent=parentExpected.browser,browserFamily=expected.sourceFamilies.find(row=>row.family==='PLAN_BUDGET_UI'),browserFamilyAdvance=runtime.familyAdvances.find(row=>row.family==='PLAN_BUDGET_UI');
 exact(browserAdvance,['kind','producer','previousProducerLfSha256','currentProducerLfSha256','previousFiles','currentFiles','additions','currentLfManifest'],'BROWSER_ADVANCE_KEYS');
 reject(browserAdvance.kind==='WEEKLY_CYP_INVESTMENT_UI'&&browserAdvance.producer===browserParent.producer&&browserAdvance.previousProducerLfSha256===browserParent.producerLfSha256&&hash(browserAdvance.currentProducerLfSha256),'EXACT_BROWSER_PRODUCER');
 for(const key of ['previousFiles','currentFiles','additions'])sorted(browserAdvance[key],'BROWSER_'+key);
 reject(browserAdvance.previousFiles.length===browserParent.investmentSourceCount&&sha(JSON.stringify(browserAdvance.previousFiles))===browserParent.investmentSourcePathsSha256,'EXACT_PREVIOUS_BROWSER_SOURCE_SET');
 reject(browserFamily&&browserFamilyAdvance&&same([...browserAdvance.previousFiles,...browserAdvance.additions].sort(),browserAdvance.currentFiles)&&same(browserAdvance.additions,browserFamilyAdvance.additions)&&browserAdvance.currentFiles.every(file=>browserFamily.currentFiles.includes(file)),'EXACT_ADDITIVE_BROWSER_SOURCE_SET');
 reject(Array.isArray(browserAdvance.currentLfManifest)&&same(browserAdvance.currentLfManifest.map(row=>row.path),[...new Set([...browserAdvance.currentFiles,browserAdvance.producer])].sort()),'COMPLETE_BROWSER_LF_MANIFEST');
 for(const pin of browserAdvance.currentLfManifest){exact(pin,['path','sha256'],'BROWSER_LF_PIN_KEYS');reject(hash(pin.sha256)&&browserFamily.currentManifest.find(row=>row.path===pin.path)?.sha256===pin.sha256&&(!references.has(pin.path)||references.get(pin.path).currentSha256===pin.sha256),'BROWSER_FAMILY_AND_REFERENCE_JOIN');}
 reject(browserAdvance.currentLfManifest.find(row=>row.path===browserAdvance.producer)?.sha256===browserAdvance.currentProducerLfSha256,'EXACT_CURRENT_BROWSER_PRODUCER');
 function browserBinding(contract,fallback){const previous=parentGate.planBudgetCurrentBrowserBinding(restoreParentContract(contract),fallback);return{...previous,producerLfSha256:browserAdvance.currentProducerLfSha256,investmentSourceCount:browserAdvance.currentFiles.length,investmentSourcePathsSha256:sha(JSON.stringify(browserAdvance.currentFiles))};}
 function isCurrent(contract){return plain(contract)&&plain(contract[section])&&Object.hasOwn(contract[section],revision);}
 function immediateSource(contract,file,value){metadata(contract);return restorePreviousSource(file,value);}
 function sourceCall(name,contract,file,value){const parent=restoreParentContract(contract);return parentGate[name](parent,file,restorePreviousSource(file,value));}
 function producerCall(name,contract,file,value){const parent=restoreParentContract(contract);return parentGate[name](parent,restorePreviousSource(file,value));}
 function contractCall(name,contract,...args){return parentGate[name](restoreParentContract(contract),...args);}
 function projectedSet(family){
  const current=expected.sourceFamilies.find(row=>row.family===family),previous=parentExpected.sourceFamilies.find(row=>row.family===family),proof=runtime.proofSourceSetAdvances.find(row=>row.kind===family);
  if(current&&proof)reject(same(current.currentFiles,proof.currentFiles)&&same(previous.currentFiles,proof.previousFiles),'FAMILY_AND_PROOF_SOURCE_SET_JOIN_'+family);
  return current?{current:current.currentFiles,previous:previous.currentFiles,additions:current.currentFiles.filter(file=>!previous.currentFiles.includes(file))}:proof?{current:proof.currentFiles,previous:proof.previousFiles,additions:proof.additions}:null;
 }
 function previousFiles(family,files){const row=projectedSet(family);if(!row)return structuredClone(files);if(same(files,row.current))return [...row.previous];reject(Array.isArray(files)&&!row.additions.some(file=>files.includes(file)),'EXACT_CURRENT_SOURCE_SET_'+family);return [...files];}
 function setCall(name,contract,family,files){return parentGate[name](restoreParentContract(contract),family,previousFiles(family,files));}
 function restoreClosure(contract,family,closure){const parent=restoreParentContract(contract),current=expected.sourceFamilies.find(row=>row.family===family),previous=parentExpected.sourceFamilies.find(row=>row.family===family);exact(closure,['files','externalImports'],'CLOSURE_KEYS');reject(current&&previous&&same(closure.files,current.currentFiles)&&same(closure.externalImports,current.externalImports),'EXACT_CURRENT_CLOSURE');return parentGate.restorePlanBudgetClosure(parent,family,{files:[...previous.currentFiles],externalImports:[...previous.externalImports]});}
 function currentSpec(spec){const row=runtime.proofSourceSetAdvances.find(row=>row.kind===spec?.kind),producer=histories.get(spec?.producer);if(!row&&!producer)return structuredClone(spec);reject(plain(spec)&&Array.isArray(spec.sourceFiles),'CURRENT_SPEC');if(row)reject(same(spec.sourceFiles,row.currentFiles),'EXACT_CURRENT_SPEC_SOURCE_SET_'+spec.kind);if(producer)reject(spec.producerSha256===producer.currentSha256,'EXACT_CURRENT_SPEC_PRODUCER_'+spec.kind);return {...structuredClone(spec),...(row?{sourceFiles:[...row.previousFiles]}:{}),...(producer?{producerSha256:producer.previousSha256}:{})};}
 function proofSourceAdditions(spec){const row=projectedSet(spec?.kind);if(!row)return parentGate.planBudgetProofSourceAdditions(spec);if(same(spec.sourceFiles,row.current))return [...new Set([...parentGate.planBudgetProofSourceAdditions(currentSpec(spec)),...row.additions])].sort();reject(Array.isArray(spec.sourceFiles)&&!row.additions.some(file=>spec.sourceFiles.includes(file)),'EXACT_CURRENT_SOURCE_SET_'+spec.kind);return parentGate.planBudgetProofSourceAdditions(spec);}
 function intakeCurrentCheckCount(spec){const row=projectedSet(spec?.kind);if(!row)return parentGate.intakeWithdrawalCurrentCheckCount(spec);if(same(spec.sourceFiles,row.current))return parentGate.intakeWithdrawalCurrentCheckCount(currentSpec(spec));reject(Array.isArray(spec.sourceFiles)&&!row.additions.some(file=>spec.sourceFiles.includes(file)),'EXACT_CURRENT_SOURCE_SET_'+spec.kind);return parentGate.intakeWithdrawalCurrentCheckCount(spec);}
 function compiledProof(contract){const parent=restoreParentContract(contract),prior=parentGate.planBudgetCompiledProof(parent);if(!prior)return prior;const actual=contract.extension?.proofs?.find(row=>row.id===prior.id||row.kind===prior.kind);if(!actual)return prior;reject(same(currentSpec(actual),prior),'EXACT_COMPILED_PROOF_JOIN');return structuredClone(actual);}
 function sourcePin(contract,ref,previous=false){
  // Pin aliases intentionally use the private compiled index, as historical
  // callers do. This lookup is not contract or source acceptance.
  reject(plain(ref)&&safe(ref.path)&&hash(ref.sha256),'SOURCE_PIN');const history=histories.get(ref.path),input=history&&history.previousSha256!==null&&ref.sha256===history.currentSha256?{...ref,sha256:history.previousSha256}:ref;
  if(history?.previousSha256===null&&ref.sha256===history.currentSha256)return previous?null:history.currentSha256;
  const value=parentGate[previous?'planBudgetPreviousSourcePin':'planBudgetCurrentSourcePin'](parentPinCarrier,input);return !previous&&history&&history.previousSha256===value?history.currentSha256:value;
 }
 function knownBusinessSource(file,value){const history=histories.get(file);if(!history)return parentGate.restorePlanBudgetFieldReviewBusinessSource(file,Buffer.from(value));const normalized=bytes(value,file);let projected;if(sha(normalized)===history.currentSha256)projected=restorePreviousSource(file,value);else{reject(history.previousSha256!==null&&sha(normalized)===history.previousSha256&&normalized.length===history.previousBytes,'EXACT_CURRENT_OR_LITERAL_PARENT_BUSINESS_SOURCE_'+file);projected=Buffer.from(value);}return parentGate.restorePlanBudgetFieldReviewBusinessSource(file,projected);}
 function validationFiles(contract){const parent=restoreParentContract(contract);return [...new Set([anchor,...expected.references.map(row=>row.path),...parentGate.planBudgetValidationFiles(parent)])].sort();}
 function proofSourceSet(contract,kind){restoreParentContract(contract);const spec=contract.extension?.proofs?.find(row=>row.kind===kind);reject(spec&&Array.isArray(spec.sourceFiles),'EXACT_CURRENT_PROOF_KIND');return [...spec.sourceFiles];}
 function workflowAdditions(contract){restoreParentContract(contract);return structuredClone(runtime.workflowAdditions);}
 function exactNativeProof(proof,contract,reader,producer){
  const proofPath=producer==='scripts/verify-employee-intake-postgres.mjs'?'.vercel/private/employee-intake-postgres.json':producer==='scripts/verify-meta-field-bridge-postgres.mjs'?'.vercel/meta-field-evidence/postgres.json':producer==='scripts/verify-material-inventory-postgres.mjs'?'.vercel/material-inventory-evidence/postgres.json':null;
  reject(proofPath,'EXACT_CURRENT_NATIVE_PRODUCER');let initial;try{initial=read(reader,proofPath);}catch{reject(false,'ACTUAL_NATIVE_PROOF_BYTES');}let parsed;try{parsed=JSON.parse(initial);}catch{reject(false,'ACTUAL_NATIVE_PROOF_JSON');}reject(same(parsed,proof)&&proof?.status==='PASS','ACTUAL_NATIVE_PROOF_BYTES');return{proofPath,raw:Buffer.from(initial),json:JSON.stringify(proof),owned:structuredClone(proof)};
 }
 function nativeManifest(proof,producer,reader,files){
  reject(hash(proof.harnessSha256)&&sha(read(reader,producer))===proof.harnessSha256&&Array.isArray(proof.sourceManifest),'ACTUAL_NATIVE_RAW_PRODUCER_AND_MANIFEST');const seen=new Map();for(const row of proof.sourceManifest){exact(row,['path','sha256'],'NATIVE_SOURCE_ROW');reject(safe(row.path)&&hash(row.sha256)&&!seen.has(row.path),'NATIVE_SOURCE_ROW');seen.set(row.path,row.sha256);}reject(same([...seen.keys()].sort(),files),'EXACT_NATIVE_SOURCE_SET');for(const [file,pin]of seen)reject(sha(read(reader,file))===pin,'ACTUAL_NATIVE_RAW_SOURCE_'+file);
 }
 function finishNative(snapshot,proof,reader){reject(JSON.stringify(proof)===snapshot.json&&read(reader,snapshot.proofPath).equals(snapshot.raw),'NATIVE_INPUT_AND_RAW_BYTES_UNCHANGED');}
 function intakeNative(raw,contract,reader,spec){
  const producer='scripts/verify-employee-intake-postgres.mjs',parent=restoreParentContract(contract),before=JSON.stringify(contract),parentSpec=currentSpec(spec);reject(spec?.kind==='PG_INTAKE'&&spec.producer===producer,'EXACT_INTAKE_SPEC');const files=proofSourceSet(contract,'PG_INTAKE');reject(same(spec.sourceFiles,files),'EXACT_INTAKE_SOURCE_JOIN');const snapshot=exactNativeProof(raw,contract,reader,producer);nativeManifest(snapshot.owned,producer,reader,files);
  const result=withVerifiedParentReader(contract,reader,(previous,projectedReader)=>{const projected=structuredClone(snapshot.owned);projected.harnessSha256=sha(projectedReader(producer));projected.sourceManifest=parentSpec.sourceFiles.map(path=>({path,sha256:sha(projectedReader(path))}));const restored={...projected,harnessSha256:snapshot.owned.harnessSha256,sourceManifest:snapshot.owned.sourceManifest};reject(same(restored,snapshot.owned),'ONLY_INTAKE_SOURCE_FIELDS_PROJECTED');return parentGate.normalizePlanBudgetIntakeWithdrawalNativeProof(projected,previous,projectedReader,parentSpec);});
  reject(JSON.stringify(contract)===before&&same(parent,restoreParentContract(contract)),'NATIVE_CONTRACT_UNCHANGED');nativeManifest(snapshot.owned,producer,reader,files);finishNative(snapshot,raw,reader);return result;
 }
 function pilotNative(contract,producer,proof,reader){
  restoreParentContract(contract);
  const snapshot=exactNativeProof(proof,contract,reader,producer);
  if(producer==='scripts/verify-material-inventory-postgres.mjs')return materialNative(contract,proof,reader,snapshot);
  reject(producer==='scripts/verify-meta-field-bridge-postgres.mjs','EXACT_PILOT_NATIVE_PRODUCER');
  const result=withVerifiedParentReader(contract,reader,(parent,projected)=>parentGate.normalizePlanBudgetPilotNativeProof(parent,producer,structuredClone(snapshot.owned),projected));finishNative(snapshot,proof,reader);return result;
 }
 function materialNative(contract,proof,reader,snapshot){const descriptor=runtime.nativeSourceAdvances.find(row=>row.kind==='MATERIAL'),producer=descriptor.producer;const verify=()=>{nativeManifest(snapshot.owned,producer,reader,descriptor.currentFiles);for(const pin of descriptor.currentLfManifest)reject(sha(bytes(read(reader,pin.path),pin.path))===pin.sha256,'ACTUAL_NATIVE_LF_SOURCE_'+pin.path);};verify();const result=withVerifiedParentReader(contract,reader,(parent,projectedReader)=>{const projected=structuredClone(snapshot.owned);projected.sourceManifest=descriptor.previousFiles.map(path=>({path,sha256:sha(projectedReader(path))}));projected.harnessSha256=sha(projectedReader(producer));reject(sha(bytes(projectedReader(producer),producer))===descriptor.previousProducerLfSha256,'EXACT_MATERIAL_PREVIOUS_PRODUCER');const restored={...projected,sourceManifest:snapshot.owned.sourceManifest,harnessSha256:snapshot.owned.harnessSha256};reject(same(restored,snapshot.owned),'ONLY_MATERIAL_SOURCE_FIELDS_PROJECTED');return parentGate.normalizePlanBudgetPilotNativeProof(parent,producer,projected,projectedReader);});verify();finishNative(snapshot,proof,reader);return result;}
 function companyNative(contract,proof,reader,readEvidence,normalizeParent){restoreParentContract(contract);const descriptor=runtime.nativeSourceAdvances.find(row=>row.kind==='PG_COMPANY_KYC');reject(typeof readEvidence==='function'&&typeof normalizeParent==='function','ACTUAL_COMPANY_EVIDENCE_AND_ORACLE_REQUIRED');const{kind,nested,...top}=descriptor;return createCaptureCompanyNestedAdapter({version:2,top:{version:1,...top},currentImageManifest:structuredClone(nested)}).normalize({contract,proof,reader,readEvidence,bridge,normalizeParent});}
 function extensionNative(contract,spec,proof,reader,readEvidence,callback){
  const parent=restoreParentContract(contract),actual=contract.extension?.proofs?.find(row=>row.id===spec?.id),previous=parent.extension?.proofs?.find(row=>row.id===spec?.id);reject(actual&&previous&&same(actual,spec)&&['PG_BANK','PG_INTAKE','PG_FIELD','PG_COMPANY_KYC'].includes(spec.kind),'EXACT_EXTENSION_NATIVE_SPEC');reject(typeof readEvidence==='function'&&typeof callback==='function','ACTUAL_EXTENSION_EVIDENCE_AND_ORACLE_REQUIRED');
  if(spec.kind==='PG_COMPANY_KYC')return companyNative(contract,proof,reader,readEvidence,(parentContract,producer,projected,parentReader)=>{reject(producer===spec.producer,'EXACT_COMPANY_CALLBACK_PRODUCER');return callback(parentContract,structuredClone(previous),projected,parentReader);});
  if(spec.kind==='PG_FIELD')return fieldNative(contract,spec,proof,reader,readEvidence,callback,previous);
  const initialRaw=readEvidence(spec.path);reject(Buffer.isBuffer(initialRaw)&&Buffer.from(initialRaw.toString('utf8')).equals(initialRaw),'ACTUAL_EXTENSION_NATIVE_PROOF_BYTES');let parsed;try{parsed=JSON.parse(initialRaw);}catch{reject(false,'ACTUAL_EXTENSION_NATIVE_PROOF_JSON');}reject(same(parsed,proof)&&proof?.status==='PASS','EXACT_EXTENSION_NATIVE_PROOF');const owned=structuredClone(parsed),json=JSON.stringify(parsed),raw=Buffer.from(initialRaw);nativeManifest(owned,spec.producer,reader,spec.sourceFiles);
  const descriptor=runtime.nativeSourceAdvances.find(row=>row.kind===spec.kind);reject(descriptor&&same(descriptor.currentFiles,spec.sourceFiles)&&descriptor.currentProducerLfSha256===spec.producerSha256,'EXTENSION_NATIVE_DESCRIPTOR_JOIN');const verifyLf=()=>{for(const pin of descriptor.currentLfManifest)reject(sha(bytes(read(reader,pin.path),pin.path))===pin.sha256,'ACTUAL_EXTENSION_SOURCE_LF_'+pin.path);};verifyLf();
  const result=withVerifiedParentReader(contract,reader,(parentContract,parentReader)=>{const projected=structuredClone(owned);projected.harnessSha256=sha(parentReader(spec.producer));projected.sourceManifest=previous.sourceFiles.map(path=>({path,sha256:sha(parentReader(path))}));reject(same({...projected,harnessSha256:owned.harnessSha256,sourceManifest:owned.sourceManifest},owned),'ONLY_EXTENSION_NATIVE_SOURCE_FIELDS_PROJECTED');return callback(parentContract,structuredClone(previous),projected,parentReader);});
  nativeManifest(owned,spec.producer,reader,spec.sourceFiles);verifyLf();const final=readEvidence(spec.path);reject(Buffer.isBuffer(final)&&final.equals(raw)&&JSON.stringify(proof)===json,'EXTENSION_NATIVE_INPUT_AND_RAW_UNCHANGED');return result;
 }
 function fieldNative(contract,spec,proof,reader,readEvidence,callback,previous){
  const descriptor=runtime.nativeSourceAdvances.find(row=>row.kind==='PG_FIELD'),nested=descriptor.nested;exact(nested,['maps'],'FIELD_MAP_DESCRIPTOR_KEYS');reject(Array.isArray(nested.maps)&&same(nested.maps.map(row=>row.field),['sourceSha256','voiceProgressSourceSha256','mediaLeaseSourceSha256','videoAudioSourceSha256','participantKycFixture.sourceSha256']),'EXACT_FIELD_MAP_NAMES');
  const field=(value,name)=>name==='participantKycFixture.sourceSha256'?value.participantKycFixture?.sourceSha256:value[name],setField=(value,name,map)=>{if(name==='participantKycFixture.sourceSha256')value.participantKycFixture.sourceSha256=map;else value[name]=map;};
  for(const map of nested.maps){exact(map,['field','previousFiles','currentFiles','currentLfManifest'],'FIELD_MAP_KEYS');sorted(map.previousFiles,'FIELD_PREVIOUS_MAP_FILES');sorted(map.currentFiles,'FIELD_CURRENT_MAP_FILES');reject(map.previousFiles.every(file=>map.currentFiles.includes(file))&&same(map.currentLfManifest.map(row=>row.path),map.currentFiles),'EXACT_ADDITIVE_FIELD_MAP');for(const row of map.currentLfManifest){exact(row,['path','sha256'],'FIELD_LF_ROW');reject(descriptor.currentLfManifest.find(pin=>pin.path===row.path)?.sha256===row.sha256,'FIELD_TOP_LF_JOIN');}}
  reject(same([...new Set(nested.maps.flatMap(row=>row.currentFiles))].sort(),spec.sourceFiles)&&same([...new Set(nested.maps.flatMap(row=>row.previousFiles))].sort(),previous.sourceFiles),'FIELD_MAPS_COMPLETE_CURRENT_AND_PREVIOUS_UNIONS');
  const initial=readEvidence(spec.path);reject(Buffer.isBuffer(initial)&&Buffer.from(initial.toString('utf8')).equals(initial),'ACTUAL_FIELD_RAW_PROOF');let parsed;try{parsed=JSON.parse(initial);}catch{reject(false,'ACTUAL_FIELD_PROOF_JSON');}reject(same(parsed,proof)&&proof?.status==='PASS'&&!Object.hasOwn(proof,'sourceManifest'),'ACTUAL_FIELD_FIVE_MAP_PROOF');const owned=structuredClone(parsed),json=JSON.stringify(parsed),raw=Buffer.from(initial);
  const verify=()=>{reject(hash(owned.harnessSha256)&&sha(read(reader,spec.producer))===owned.harnessSha256,'ACTUAL_FIELD_RAW_HARNESS');for(const map of nested.maps){const rows=field(owned,map.field);reject(plain(rows)&&same(Object.keys(rows).sort(),map.currentFiles),'EXACT_FIELD_RAW_MAP_'+map.field);for(const file of map.currentFiles)reject(hash(rows[file])&&sha(read(reader,file))===rows[file],'ACTUAL_FIELD_RAW_SOURCE_'+file);}for(const pin of descriptor.currentLfManifest)reject(sha(bytes(read(reader,pin.path),pin.path))===pin.sha256,'ACTUAL_FIELD_LF_SOURCE_'+pin.path);};verify();
  const result=withVerifiedParentReader(contract,reader,(parent,parentReader)=>{const projected=structuredClone(owned);for(const map of nested.maps)setField(projected,map.field,Object.fromEntries(map.previousFiles.map(file=>[file,sha(parentReader(file))])));projected.harnessSha256=sha(parentReader(spec.producer));const business=structuredClone(projected);for(const map of nested.maps)setField(business,map.field,structuredClone(field(owned,map.field)));business.harnessSha256=owned.harnessSha256;reject(same(business,owned),'ONLY_EXACT_FIELD_MAPS_AND_HARNESS_PROJECTED');return callback(parent,structuredClone(previous),projected,parentReader);});verify();const final=readEvidence(spec.path);reject(Buffer.isBuffer(final)&&final.equals(raw)&&JSON.stringify(proof)===json,'FIELD_INPUT_AND_RAW_UNCHANGED');return result;
 }
 const bridge=Object.freeze({parentGate,parentExpected:structuredClone(parentExpected),isCurrent,restoreParentContract,restorePreviousSource:immediateSource,verifyCurrentSources,withVerifiedParentReader,historicalAuthority,verifyActualClosure,applyWorkflowAdditions,sourceCall,producerCall,contractCall,setCall,restoreClosure,proofSourceAdditions,compiledProof,sourcePin,knownBusinessSource,validationFiles,proofSourceSet,workflowAdditions,browserBinding,intakeCurrentCheckCount,intakeNative,pilotNative,companyNative,extensionNative});bridges.add(bridge);return bridge;

}


const createCompanyKycNativeAdapter=(()=>{

// An explicit proposal for the COMPANY proof shape already emitted by this
// producer. This does not authorize the manifest-only META field proof: that
// separate proof requires a canonical fresh-lane capability or added source
// binding, and remains blocked rather than silently rebased.
const producer='scripts/verify-company-channel-kyc-postgres.mjs',proofPath='.vercel/company-kyc-evidence/postgres.json';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),sha=value=>createHash('sha256').update(value).digest('hex'),hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value),safe=file=>typeof file==='string'&&path.posix.normalize(file)===file&&!path.posix.isAbsolute(file)&&!/[\\:\x00-\x1f]/.test(file)&&!file.split('/').includes('..');
const reject=(ok,reason)=>{if(!ok)throw Object.assign(new Error('Capture quality native adapter rejected: '+reason),{code:'CAPTURE_QUALITY_NATIVE_SOURCE_REJECTED',reason});};
const exact=(value,keys,reason)=>reject(plain(value)&&same(Object.keys(value).sort(),[...keys].sort()),reason),sorted=(files,reason)=>reject(Array.isArray(files)&&files.every(safe)&&same(files,[...new Set(files)].sort()),reason);
const lf=value=>Buffer.from(value.toString('utf8').replaceAll('\r\n','\n'));

function createCompanyKycNativeAdapter(input){
 const descriptor=structuredClone(input);exact(descriptor,['version','producer','proofPath','previousProducerLfSha256','currentProducerLfSha256','previousFiles','currentFiles','currentLfManifest'],'DESCRIPTOR_KEYS');
 reject(descriptor.version===1&&descriptor.producer===producer&&descriptor.proofPath===proofPath&&hash(descriptor.previousProducerLfSha256)&&hash(descriptor.currentProducerLfSha256),'EXACT_COMPANY_PRODUCER');
 sorted(descriptor.previousFiles,'PREVIOUS_FILES');sorted(descriptor.currentFiles,'CURRENT_FILES');reject(descriptor.previousFiles.length>0&&descriptor.previousFiles.every(file=>descriptor.currentFiles.includes(file)),'ADDITIVE_SOURCE_FILES');
 reject(Array.isArray(descriptor.currentLfManifest)&&same(descriptor.currentLfManifest.map(row=>row.path),[...new Set([...descriptor.currentFiles,producer])].sort()),'COMPLETE_LF_MANIFEST');
 for(const row of descriptor.currentLfManifest){exact(row,['path','sha256'],'LF_ROW');reject(hash(row.sha256),'LF_HASH');}
 const expected=new Map(descriptor.currentLfManifest.map(row=>[row.path,row.sha256]));reject(expected.get(producer)===descriptor.currentProducerLfSha256,'PRODUCER_MANIFEST_JOIN');
 return Object.freeze({
  normalize({contract,proof,reader,readEvidence,bridge,normalizeParent}={}){
   // These ports and actual receipt bytes are required before either oracle.
   reject(typeof reader==='function'&&typeof readEvidence==='function'&&typeof normalizeParent==='function','ACTUAL_BYTE_READERS_REQUIRED');reject(isCaptureQualityBridge(bridge),'AUTHENTICATED_BRIDGE_REQUIRED');
   const raw=readEvidence(proofPath);reject(Buffer.isBuffer(raw)&&raw.length>0&&Buffer.from(raw.toString('utf8')).equals(raw),'ACTUAL_PROOF_BYTES_REQUIRED');let actual;try{actual=JSON.parse(raw);}catch{reject(false,'ACTUAL_PROOF_JSON');}
   reject(plain(proof)&&same(actual,proof)&&proof.status==='PASS','EXACT_CURRENT_PROOF');const ownedProof=structuredClone(actual),initialProofJson=JSON.stringify(actual),initialRaw=Buffer.from(raw);reject(Array.isArray(ownedProof.sourceManifest)&&hash(ownedProof.harnessSha256),'CURRENT_PROOF_SOURCE_BINDING_REQUIRED');
   const rows=new Map();for(const row of ownedProof.sourceManifest){exact(row,['path','sha256'],'CURRENT_PROOF_SOURCE_ROW');reject(safe(row.path)&&hash(row.sha256)&&!rows.has(row.path),'CURRENT_PROOF_SOURCE_ROW');rows.set(row.path,row.sha256);}
   reject(same([...rows.keys()].sort(),descriptor.currentFiles),'EXACT_CURRENT_PROOF_SOURCE_SET');
   const verifyRaw=()=>{for(const [file,expectedLf]of expected){const value=reader(file);reject(Buffer.isBuffer(value)&&Buffer.from(value.toString('utf8')).equals(value)&&sha(lf(value))===expectedLf,'ACTUAL_CURRENT_LF_SOURCE_'+file);reject(sha(value)===(file===producer?ownedProof.harnessSha256:rows.get(file)),'ACTUAL_CURRENT_RAW_SOURCE_'+file);}};
   verifyRaw();
   const result=bridge.withVerifiedParentReader(contract,reader,(parentContract,parentReader)=>{
    const previousProducer=parentReader(producer);reject(Buffer.isBuffer(previousProducer)&&sha(lf(previousProducer))===descriptor.previousProducerLfSha256,'EXACT_PREVIOUS_PRODUCER');
    const projected=structuredClone(ownedProof),prior=new Set(descriptor.previousFiles);projected.sourceManifest=ownedProof.sourceManifest.filter(row=>prior.has(row.path)).map(row=>({path:row.path,sha256:sha(parentReader(row.path))}));projected.harnessSha256=sha(previousProducer);
    reject(same(projected.sourceManifest.map(row=>row.path).sort(),descriptor.previousFiles),'EXACT_PREVIOUS_PROOF_SOURCE_SET');
    const restoredBusiness={...projected,sourceManifest:ownedProof.sourceManifest,harnessSha256:ownedProof.harnessSha256};reject(same(restoredBusiness,ownedProof),'ONLY_SOURCE_BINDING_FIELDS_PROJECTED');
    const normalized=normalizeParent(parentContract,producer,projected,parentReader);reject(!normalized||typeof normalized.then!=='function','SYNCHRONOUS_NATIVE_CALLBACK_REQUIRED');return normalized;
   });
   verifyRaw();const finalRaw=readEvidence(proofPath);reject(Buffer.isBuffer(finalRaw)&&finalRaw.equals(initialRaw)&&JSON.stringify(proof)===initialProofJson,'ACTUAL_PROOF_BYTES_AND_INPUT_UNCHANGED');return result;
  },
  limits:Object.freeze({producer,proofPath,trackedCompilerIntegrated:false,currentReceiptExecuted:false,freshLaneAuthorityIntegrated:false,metadataOnlyAccepted:false,metaFieldProofAccepted:false,nativeOrHumanAcceptance:false}),
 });
}

return createCompanyKycNativeAdapter;
})();
const createCaptureCompanyNestedAdapter=(()=>{

// Exact adapter for the five actual CURRENT helper RAW references. The real
// 17-case ledger and every business fact survive byte-for-byte as JSON data.
const helper='scripts/lib/kyc-current-image-native.mjs',synthetic='scripts/lib/synthetic-capture-quality.mjs',producer='scripts/verify-company-channel-kyc-postgres.mjs',previousFiles=[helper,producer,'package.json','package-lock.json'],currentFiles=[helper,synthetic,producer,'package.json','package-lock.json'];
const sha=value=>createHash('sha256').update(value).digest('hex'),lf=value=>Buffer.from(value.toString('utf8').replaceAll('\r\n','\n')),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value),plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const reject=(ok,reason)=>{if(!ok)throw Object.assign(new Error('COMPANY CURRENT nested source adapter rejected: '+reason),{code:'CAPTURE_QUALITY_COMPANY_NESTED_SOURCE_REJECTED',reason});};
function createCompanyNestedNativeAdapter(input){
 const descriptor=structuredClone(input);reject(plain(descriptor)&&same(Object.keys(descriptor).sort(),['version','top','currentImageManifest'].sort())&&descriptor.version===2,'EXACT_V2_DESCRIPTOR');const nested=descriptor.currentImageManifest;reject(plain(nested)&&same(Object.keys(nested).sort(),['previousFiles','currentFiles','currentLfManifest'].sort())&&same(nested.previousFiles,previousFiles)&&same(nested.currentFiles,currentFiles),'EXACT_NESTED_PATHS');reject(Array.isArray(nested.currentLfManifest)&&same(nested.currentLfManifest.map(row=>row.path),currentFiles)&&nested.currentLfManifest.every(row=>plain(row)&&same(Object.keys(row).sort(),['path','sha256'])&&hash(row.sha256)),'EXACT_NESTED_LF_MANIFEST');const top=createCompanyKycNativeAdapter(descriptor.top),topPins=new Map(descriptor.top.currentLfManifest.map(row=>[row.path,row.sha256]));for(const row of nested.currentLfManifest)if(topPins.has(row.path))reject(topPins.get(row.path)===row.sha256,'NESTED_TOP_PIN_JOIN');
 return Object.freeze({normalize({contract,proof,reader,readEvidence,bridge,normalizeParent}={}){
  reject(typeof reader==='function'&&typeof readEvidence==='function'&&typeof normalizeParent==='function','ACTUAL_READERS_AND_ORACLE_REQUIRED');const initialRaw=readEvidence(descriptor.top.proofPath);reject(Buffer.isBuffer(initialRaw)&&Buffer.from(initialRaw.toString('utf8')).equals(initialRaw),'ACTUAL_PROOF_BYTES');let owned;try{owned=JSON.parse(initialRaw);}catch{reject(false,'PROOF_JSON');}reject(same(owned,proof),'EXACT_PROOF_INPUT');const initialJson=JSON.stringify(owned),ownedRaw=Buffer.from(initialRaw),native=owned.currentImageNative;reject(plain(native)&&Array.isArray(native.sourceManifest)&&same(native.sourceManifest.map(row=>row?.path),currentFiles),'COMPLETE_ACTUAL_NESTED_SOURCE_SET');
  const verify=()=>{for(const[index,pin]of nested.currentLfManifest.entries()){const row=native.sourceManifest[index],value=reader(pin.path);reject(plain(row)&&same(Object.keys(row).sort(),['path','sha256'])&&hash(row.sha256)&&Buffer.isBuffer(value)&&Buffer.from(value.toString('utf8')).equals(value)&&sha(lf(value))===pin.sha256&&sha(value)===row.sha256,'ACTUAL_NESTED_RAW_AND_LF_'+pin.path);}};verify();
  const result=top.normalize({contract,proof,reader,readEvidence,bridge,normalizeParent:(parentContract,producer,topProjected,parentReader)=>{
   const projected=structuredClone(topProjected);projected.currentImageNative.sourceManifest=previousFiles.map(path=>({path,sha256:sha(parentReader(path))}));
   const restoreNested=structuredClone(projected);restoreNested.currentImageNative.sourceManifest=topProjected.currentImageNative.sourceManifest;reject(same(restoreNested,topProjected),'ONLY_EXACT_NESTED_SOURCE_FIELD_PROJECTED');return normalizeParent(parentContract,producer,projected,parentReader);
  }});
  verify();const finalRaw=readEvidence(descriptor.top.proofPath);reject(Buffer.isBuffer(finalRaw)&&finalRaw.equals(ownedRaw)&&JSON.stringify(proof)===initialJson,'NESTED_PROOF_AND_INPUT_UNCHANGED');return result;
 },limits:Object.freeze({scope:'EXACT_COMPANY_CURRENT_SOURCE_BINDING_ONLY',businessFactsProjected:false,caseFactsProjected:false,trackedCompilerIntegrated:false,fullEightLaneCiAccepted:false,sourceAuthorityAccepted:false,nativeOrHumanAcceptance:false})});
}

return createCompanyNestedNativeAdapter;
})();

export const PLAN_BUDGET_CURRENT_SECTION='planBudgetCurrentRevision';
export const PLAN_BUDGET_CI_KIND='UI_PLAN_BUDGET_SOURCE';
export const PLAN_BUDGET_CI_PROOF_PATH='.vercel/private/plan-budget-ui-ci.json';
const captureRuntime=reviewed.captureQualityRuntime?createCaptureRuntimeGate(reviewed):null;
const captureParent=captureRuntime?captureRuntime.parentGate:createCaptureQualityParentGate(reviewed);
const captureActive=contract=>Boolean(captureRuntime?.isCurrent(contract));
export const INTAKE_WITHDRAWAL_CHECK_NAMES=captureParent.INTAKE_WITHDRAWAL_CHECK_NAMES;
export function restoreCaptureRuntimePreviousContract(contract){return captureActive(contract)?captureRuntime.restoreParentContract(contract):structuredClone(contract);}
export function restoreCaptureRuntimePreviousSource(contract,file,raw){return captureActive(contract)?captureRuntime.restorePreviousSource(contract,file,raw):Buffer.from(raw);}
export function withCaptureRuntimePreviousSources(contract,reader,callback){if(captureActive(contract))return captureRuntime.withVerifiedParentReader(contract,reader,callback);reject(!captureRuntime,'CURRENT_CAPTURE_RUNTIME_REQUIRED');const before=JSON.stringify(contract);captureParent.verifyPlanBudgetCurrentSources(contract,reader);const result=callback(structuredClone(contract),reader);reject(!result||typeof result.then!=='function','SYNCHRONOUS_PARENT_CALLBACK_REQUIRED');reject(JSON.stringify(contract)===before,'CONTRACT_UNCHANGED');captureParent.verifyPlanBudgetCurrentSources(contract,reader);return result;}
export function captureRuntimeProofSourceSet(contract,kind){if(captureActive(contract))return captureRuntime.proofSourceSet(contract,kind);const spec=contract.extension?.proofs?.find(row=>row.kind===kind);reject(spec&&Array.isArray(spec.sourceFiles),'EXACT_CURRENT_PROOF_KIND');return [...spec.sourceFiles];}
export function captureRuntimeWorkflowAdditions(contract){return captureActive(contract)?captureRuntime.workflowAdditions(contract):[];}
export function verifyCaptureRuntimeCurrentSources(contract,reader){return captureActive(contract)?captureRuntime.verifyCurrentSources(contract,reader):captureRuntime?captureRuntime.historicalAuthority('verifyPlanBudgetCurrentSources',contract,reader):captureParent.verifyPlanBudgetCurrentSources(contract,reader);}
export function restorePlanBudgetAcceptancePreviousContract(contract){return captureActive(contract)?captureRuntime.contractCall('restorePlanBudgetAcceptancePreviousContract',contract):captureParent.restorePlanBudgetAcceptancePreviousContract(contract);}
export function restorePlanBudgetAcceptancePreviousSource(contract,file,raw){return captureActive(contract)?captureRuntime.sourceCall('restorePlanBudgetAcceptancePreviousSource',contract,file,raw):captureParent.restorePlanBudgetAcceptancePreviousSource(contract,file,raw);}
export function restorePlanBudgetPilotIntegrationPreviousContract(contract){return captureActive(contract)?captureRuntime.contractCall('restorePlanBudgetPilotIntegrationPreviousContract',contract):captureParent.restorePlanBudgetPilotIntegrationPreviousContract(contract);}
export function restorePlanBudgetPilotIntegrationSource(contract,file,raw){return captureActive(contract)?captureRuntime.sourceCall('restorePlanBudgetPilotIntegrationSource',contract,file,raw):captureParent.restorePlanBudgetPilotIntegrationSource(contract,file,raw);}
export function restorePlanBudgetTrialExpiryNoticePreviousContract(contract){return captureActive(contract)?captureRuntime.contractCall('restorePlanBudgetTrialExpiryNoticePreviousContract',contract):captureParent.restorePlanBudgetTrialExpiryNoticePreviousContract(contract);}
export function restorePlanBudgetTrialExpiryNoticeSource(contract,file,raw){return captureActive(contract)?captureRuntime.sourceCall('restorePlanBudgetTrialExpiryNoticeSource',contract,file,raw):captureParent.restorePlanBudgetTrialExpiryNoticeSource(contract,file,raw);}
export function restorePlanBudgetTrialExpiryNoticeValidatorSource(contract,file,raw){return captureActive(contract)?captureRuntime.sourceCall('restorePlanBudgetTrialExpiryNoticeValidatorSource',contract,file,raw):captureParent.restorePlanBudgetTrialExpiryNoticeValidatorSource(contract,file,raw);}
export function restorePlanBudgetMeasurementPrivacyPreviousContract(contract){return captureActive(contract)?captureRuntime.contractCall('restorePlanBudgetMeasurementPrivacyPreviousContract',contract):captureParent.restorePlanBudgetMeasurementPrivacyPreviousContract(contract);}
export function restorePlanBudgetMeasurementPrivacySource(contract,file,raw){return captureActive(contract)?captureRuntime.sourceCall('restorePlanBudgetMeasurementPrivacySource',contract,file,raw):captureParent.restorePlanBudgetMeasurementPrivacySource(contract,file,raw);}
export function restorePlanBudgetCheckTimePreviousContract(contract){return captureActive(contract)?captureRuntime.contractCall('restorePlanBudgetCheckTimePreviousContract',contract):captureParent.restorePlanBudgetCheckTimePreviousContract(contract);}
export function restorePlanBudgetCheckTimeSource(contract,file,raw){return captureActive(contract)?captureRuntime.sourceCall('restorePlanBudgetCheckTimeSource',contract,file,raw):captureParent.restorePlanBudgetCheckTimeSource(contract,file,raw);}
export function restorePlanBudgetPreviousContract(contract){return captureActive(contract)?captureRuntime.contractCall('restorePlanBudgetPreviousContract',contract):captureParent.restorePlanBudgetPreviousContract(contract);}
export function restorePlanBudgetIntakeWithdrawalSource(contract,file,raw){return captureActive(contract)?captureRuntime.sourceCall('restorePlanBudgetIntakeWithdrawalSource',contract,file,raw):captureParent.restorePlanBudgetIntakeWithdrawalSource(contract,file,raw);}
export function restorePlanBudgetIntakeWithdrawalProducerText(contract,raw){return captureActive(contract)?captureRuntime.producerCall('restorePlanBudgetIntakeWithdrawalProducerText',contract,'scripts/verify-employee-intake-postgres.mjs',raw):captureParent.restorePlanBudgetIntakeWithdrawalProducerText(contract,raw);}
export function restorePlanBudgetIntakeWithdrawalUnitProducerText(contract,raw){return captureActive(contract)?captureRuntime.producerCall('restorePlanBudgetIntakeWithdrawalUnitProducerText',contract,'scripts/verify-participant-bank-intake-contracts.mjs',raw):captureParent.restorePlanBudgetIntakeWithdrawalUnitProducerText(contract,raw);}
export function restorePlanBudgetMaterialNativeProducerText(contract,raw){return captureActive(contract)?captureRuntime.producerCall('restorePlanBudgetMaterialNativeProducerText',contract,'scripts/verify-material-inventory-postgres.mjs',raw):captureParent.restorePlanBudgetMaterialNativeProducerText(contract,raw);}
export function restorePlanBudgetAttendanceReviewProducerText(contract,raw){return captureActive(contract)?captureRuntime.producerCall('restorePlanBudgetAttendanceReviewProducerText',contract,'scripts/verify-field-operations-postgres.mjs',raw):captureParent.restorePlanBudgetAttendanceReviewProducerText(contract,raw);}
export function restorePlanBudgetConsumptionEvidenceSource(contract,file,raw){return captureActive(contract)?captureRuntime.sourceCall('restorePlanBudgetConsumptionEvidenceSource',contract,file,raw):captureParent.restorePlanBudgetConsumptionEvidenceSource(contract,file,raw);}
export function restorePlanBudgetPilotProducerText(contract,producer,raw){return captureActive(contract)?captureRuntime.sourceCall('restorePlanBudgetPilotProducerText',contract,producer,raw):captureParent.restorePlanBudgetPilotProducerText(contract,producer,raw);}
export function restorePlanBudgetFieldReviewBusinessSource(file,raw){return captureRuntime?captureRuntime.knownBusinessSource(file,raw):captureParent.restorePlanBudgetFieldReviewBusinessSource(file,raw);}
export function restorePlanBudgetSourceSet(contract,family,files){return captureActive(contract)?captureRuntime.setCall('restorePlanBudgetSourceSet',contract,family,files):captureParent.restorePlanBudgetSourceSet(contract,family,files);}
export function restorePlanBudgetFieldReviewSourceSet(contract,family,files){return captureActive(contract)?captureRuntime.setCall('restorePlanBudgetFieldReviewSourceSet',contract,family,files):captureParent.restorePlanBudgetFieldReviewSourceSet(contract,family,files);}
export function restorePlanBudgetConsumptionEvidenceSourceSet(contract,family,files){return captureActive(contract)?captureRuntime.setCall('restorePlanBudgetConsumptionEvidenceSourceSet',contract,family,files):captureParent.restorePlanBudgetConsumptionEvidenceSourceSet(contract,family,files);}
export function planBudgetProofSourceAdditions(spec){return captureRuntime?captureRuntime.proofSourceAdditions(spec):captureParent.planBudgetProofSourceAdditions(spec);}
export function intakeWithdrawalCurrentCheckCount(spec){return captureRuntime?captureRuntime.intakeCurrentCheckCount(spec):captureParent.intakeWithdrawalCurrentCheckCount(spec);}
export function verifyPlanBudgetCurrentSources(contract,reader){return verifyCaptureRuntimeCurrentSources(contract,reader);}
export function verifyPlanBudgetActualClosure(contract,family,closure,reader){return captureActive(contract)?captureRuntime.verifyActualClosure(contract,family,closure,reader):captureRuntime?captureRuntime.historicalAuthority('verifyPlanBudgetActualClosure',contract,reader,family,closure):captureParent.verifyPlanBudgetActualClosure(contract,family,closure,reader);}
export function restorePlanBudgetClosure(contract,family,closure){return captureActive(contract)?captureRuntime.restoreClosure(contract,family,closure):captureParent.restorePlanBudgetClosure(contract,family,closure);}
export function planBudgetValidationFiles(contract){return captureActive(contract)?captureRuntime.validationFiles(contract):captureParent.planBudgetValidationFiles(contract);}
export function planBudgetCurrentBrowserBinding(contract,fallback){return captureActive(contract)?captureRuntime.browserBinding(contract,fallback):captureParent.planBudgetCurrentBrowserBinding(contract,fallback);}
export function planBudgetCompiledProof(contract){return captureActive(contract)?captureRuntime.compiledProof(contract):captureParent.planBudgetCompiledProof(contract);}
export function planBudgetRetainedScreenshotPaths(contract){return captureActive(contract)?captureRuntime.contractCall('planBudgetRetainedScreenshotPaths',contract):captureParent.planBudgetRetainedScreenshotPaths(contract);}
export function planBudgetCurrentSourcePin(contract,ref){return captureActive(contract)?captureRuntime.sourcePin(contract,ref):captureParent.planBudgetCurrentSourcePin(contract,ref);}
export function planBudgetPreviousSourcePin(contract,ref){return captureActive(contract)?captureRuntime.sourcePin(contract,ref,true):captureParent.planBudgetPreviousSourcePin(contract,ref);}
export function normalizePlanBudgetPilotNativeProof(contract,producer,proof,reader){return captureActive(contract)?captureRuntime.pilotNative(contract,producer,proof,reader):captureParent.normalizePlanBudgetPilotNativeProof(contract,producer,proof,reader);}
export function normalizePlanBudgetIntakeWithdrawalNativeProof(raw,contract,reader,spec){return captureActive(contract)?captureRuntime.intakeNative(raw,contract,reader,spec):captureParent.normalizePlanBudgetIntakeWithdrawalNativeProof(raw,contract,reader,spec);}
export function normalizeCaptureRuntimeCompanyNativeProof(contract,proof,reader,readEvidence,normalizeParent){reject(captureActive(contract),'CURRENT_CAPTURE_COMPANY_RUNTIME_REQUIRED');return captureRuntime.companyNative(contract,proof,reader,readEvidence,normalizeParent);}
export function normalizeCaptureRuntimeNativeProof(contract,spec,proof,reader,readEvidence,callback){reject(captureActive(contract),'CURRENT_CAPTURE_NATIVE_RUNTIME_REQUIRED');return captureRuntime.extensionNative(contract,spec,proof,reader,readEvidence,callback);}
