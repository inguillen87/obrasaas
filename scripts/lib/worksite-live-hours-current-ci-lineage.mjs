import {createHash} from 'node:crypto';
import path from 'node:path';
import {WORKSITE_LIVE_HOURS_CURRENT_REVISION} from './worksite-live-hours-current-ci-reviewed.mjs';

export const WORKSITE_LIVE_HOURS_CURRENT_SECTION='worksiteLiveHoursCurrentRevision';
export const WORKSITE_LIVE_HOURS_DECLARATION_TRUST_ANCHOR='scripts/lib/worksite-live-hours-current-ci-reviewed.mjs';
const declarationText=value=>'// Exact reviewed current-source declaration; this file is the explicit trust anchor.\nexport const WORKSITE_LIVE_HOURS_CURRENT_REVISION=Object.freeze('+JSON.stringify(value,null,2)+');\n';
const code='WORKSITE_LIVE_HOURS_CURRENT_CI_LINEAGE_REJECTED';
const reject=(ok,reason)=>{if(!ok)throw Object.assign(new Error('Worksite live/hours source revision rejected: '+reason),{code,reason});};
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const sha=value=>createHash('sha256').update(value).digest('hex');
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const safe=value=>typeof value==='string'&&(/^(?:src|scripts|tests|\.github)\//.test(value)||['package.json','package-lock.json','vercel.json','api/_biometric_core.py'].includes(value))&&!/[\\\x00-\x1f]/.test(value)&&path.posix.normalize(value)===value&&!value.split('/').includes('..');
const exact=(value,keys,reason)=>reject(plain(value)&&same(Object.keys(value).sort(),[...keys].sort()),reason);
const sorted=(files,reason)=>reject(Array.isArray(files)&&files.every(safe)&&same(files,[...new Set(files)].sort()),reason);
const pathsHash=files=>sha(JSON.stringify(files));
const refKeys=['path','sha256'];
const deepFreeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))deepFreeze(child);Object.freeze(value);}return value;};
const readUtf8=(readSource,file)=>{reject(safe(file),'Unsafe source path');const bytes=readSource(file);reject(Buffer.isBuffer(bytes)&&bytes.equals(Buffer.from(bytes.toString('utf8'))),'Missing or invalid UTF-8 source: '+file);return bytes.toString('utf8').replaceAll('\r\n','\n');};
function pointer(object,value){
 reject(typeof value==='string'&&/^\/(?:extension\/proofs|evidenceProducers)\/\d+\/(?:sourceFiles|producerSha256|checkNames)$/.test(value),'Bounded contract pointer required');
 const keys=value.slice(1).split('/');let parent=object;
 for(const key of keys.slice(0,-1)){reject(parent!==null&&typeof parent==='object'&&Object.hasOwn(parent,key),'Missing contract pointer: '+value);parent=parent[key];}
 const key=keys.at(-1);reject(Object.hasOwn(parent,key),'Missing contract leaf: '+value);return {parent,key,value:parent[key]};
}
function validateReviewed(value){
 exact(value,['version','status','predecessorCommit','previousContractSha256','reviewedSourceChanges','newSources','producerDeltas','sourceSetDeltas','sourceFamilies','historicalCheckLedgers','validationPredecessors','newValidationPaths','validationSources','declarationTrustAnchorPath','nativeOrBrowserAcceptance'],'Exact reviewed revision fields');
 reject(value.version===1&&value.status==='REVIEWED_SOURCE_ONLY'&&/^[a-f0-9]{40}$/.test(value.predecessorCommit||'')&&hash(value.previousContractSha256)&&value.nativeOrBrowserAcceptance===false,'Final source freeze required; draft/unset pins cannot pass');
 for(const key of ['reviewedSourceChanges','newSources','producerDeltas','sourceSetDeltas','sourceFamilies','historicalCheckLedgers','validationPredecessors','newValidationPaths'])reject(Array.isArray(value[key]),'Array required: '+key);
 reject(value.reviewedSourceChanges.length>0&&value.newSources.length>0&&value.sourceFamilies.length>0,'A source revision must bind changed, added and consumer sources');
 for(const row of value.reviewedSourceChanges){exact(row,['path','previousSha256','currentSha256'],'Exact reviewed source change');reject(safe(row.path)&&hash(row.previousSha256)&&hash(row.currentSha256)&&row.previousSha256!==row.currentSha256,'Exact distinct source hashes required');}
 for(const row of value.newSources){exact(row,refKeys,'Exact new source reference');reject(safe(row.path)&&hash(row.sha256),'Exact new source hash required');}
 for(const row of value.validationPredecessors){exact(row,refKeys,'Exact validator predecessor');reject(safe(row.path)&&hash(row.sha256),'Exact validator predecessor hash required');}
 sorted(value.newValidationPaths,'Distinct sorted new validator paths');
 reject(value.declarationTrustAnchorPath===WORKSITE_LIVE_HOURS_DECLARATION_TRUST_ANCHOR,'One explicit reviewed declaration trust anchor required');
 const validatorPaths=[...value.validationPredecessors.map(row=>row.path),...value.newValidationPaths];reject(Array.isArray(value.validationSources)&&same(value.validationSources.map(row=>row?.path),validatorPaths),'Exact compiled current validator paths required');for(const row of value.validationSources){exact(row,refKeys,'Exact compiled current validator pin');reject(hash(row.sha256),'Compiled current validator hash required');}
 reject(!validatorPaths.includes(value.declarationTrustAnchorPath),'The declaration is a trust anchor, never a self-hash supplied by a proof');
 for(const row of value.producerDeltas){
  exact(row,['producer','previousSha256','currentSha256','contractPointers','sourceHistory'],'Exact producer delta');reject(safe(row.producer)&&hash(row.previousSha256)&&hash(row.currentSha256)&&row.previousSha256!==row.currentSha256,'Exact producer hashes required');
  reject(Array.isArray(row.contractPointers)&&new Set(row.contractPointers).size===row.contractPointers.length&&row.contractPointers.every(ref=>/^\/(?:extension\/proofs|evidenceProducers)\/\d+\/producerSha256$/.test(ref)),'Only declared current producer pins may restore');
  exact(row.sourceHistory,['previousBytes','currentBytes','inverseHunks'],'Exact inverse producer history');reject([row.sourceHistory.previousBytes,row.sourceHistory.currentBytes].every(n=>Number.isSafeInteger(n)&&n>0)&&Array.isArray(row.sourceHistory.inverseHunks),'Bounded source history');let after=0;
  for(const h of row.sourceHistory.inverseHunks){exact(h,['currentOffsetCharacters','currentText','previousText'],'Exact inverse source hunk');reject(Number.isSafeInteger(h.currentOffsetCharacters)&&h.currentOffsetCharacters>=after&&typeof h.currentText==='string'&&typeof h.previousText==='string'&&h.currentText!==h.previousText,'Sorted nonoverlapping exact inverse hunks');after=h.currentOffsetCharacters+h.currentText.length;}
 }
 const families=new Set();for(const row of value.sourceSetDeltas){
  exact(row,['family','contractPointer','previousCount','previousPathsSha256','currentCount','currentPathsSha256','additions'],'Exact source-set delta');reject(typeof row.family==='string'&&/^[A-Z][A-Z0-9_]+$/.test(row.family)&&!families.has(row.family),'Unique named source family');families.add(row.family);
  reject(row.contractPointer===null||/^\/extension\/proofs\/\d+\/sourceFiles$/.test(row.contractPointer),'Only proof sourceFiles may restore');sorted(row.additions,'Exact sorted source additions');reject(row.additions.length>0&&Number.isSafeInteger(row.previousCount)&&row.previousCount>0&&row.currentCount===row.previousCount+row.additions.length&&hash(row.previousPathsSha256)&&hash(row.currentPathsSha256),'Source counts must match the exact additive delta');
 }
 const consumers=new Set();for(const row of value.sourceFamilies){exact(row,['family','currentFiles','externalImports','currentManifest'],'Exact actual consumer closure');reject(typeof row.family==='string'&&/^[A-Z][A-Z0-9_]+$/.test(row.family)&&!consumers.has(row.family),'Unique consumer family');consumers.add(row.family);sorted(row.currentFiles,'Exact sorted current consumer closure');reject(row.currentFiles.length>0&&Array.isArray(row.externalImports)&&row.externalImports.every(ref=>typeof ref==='string'&&ref&&!/^(?:https?:|file:|data:)/.test(ref))&&same(row.externalImports,[...new Set(row.externalImports)].sort()),'Bounded exact external imports');reject(Array.isArray(row.currentManifest)&&same(row.currentManifest.map(ref=>ref?.path),row.currentFiles),'Every actual consumer source needs a compiled content pin');for(const ref of row.currentManifest){exact(ref,refKeys,'Exact consumer content reference');reject(ref.path===value.declarationTrustAnchorPath?ref.sha256==='REVIEWED_DECLARATION_TRUST_ANCHOR':hash(ref.sha256),'Only the declaration trust anchor may omit a recursive self hash');}}
 for(const delta of value.sourceSetDeltas){const family=value.sourceFamilies.find(row=>row.family===delta.family);if(family)reject(family.currentFiles.length===delta.currentCount&&pathsHash(family.currentFiles)===delta.currentPathsSha256,'Typed source delta and actual closure must agree');}
 for(const row of value.historicalCheckLedgers){exact(row,['contractPointer','count','sha256'],'Exact historical ledger reference');reject(/^\/extension\/proofs\/\d+\/checkNames$/.test(row.contractPointer)&&Number.isSafeInteger(row.count)&&row.count>0&&hash(row.sha256),'Historical check ledger pin required');}
 const paths=[...value.reviewedSourceChanges.map(row=>row.path),...value.newSources.map(row=>row.path),...value.producerDeltas.map(row=>row.producer),...value.validationPredecessors.map(row=>row.path),...value.newValidationPaths];reject(new Set(paths).size===paths.length,'Source/producer/validator references must not overlap');
 const ptrs=[...value.sourceSetDeltas.map(row=>row.contractPointer).filter(Boolean),...value.producerDeltas.flatMap(row=>row.contractPointers)];reject(new Set(ptrs).size===ptrs.length,'Contract mutation pointers must be unique');
 return value;
}
function priorPaths(current,row){
 sorted(current,'Actual current source set must be distinct and sorted');reject(current.length===row.currentCount&&pathsHash(current)===row.currentPathsSha256&&row.additions.every(file=>current.includes(file)),'Exact current source set required: '+row.family);
 const previous=current.filter(file=>!row.additions.includes(file));reject(previous.length===row.previousCount&&pathsHash(previous)===row.previousPathsSha256,'Exact predecessor source set required: '+row.family);return previous;
}

// A committed reviewed declaration is the trust anchor. The factory exists for
// synthetic parser/negative tests; production exports below always use the
// fixed companion declaration, never a declaration supplied by the contract.
export function createWorksiteLiveHoursRevisionGate(reviewed){
 const expected=deepFreeze(structuredClone(reviewed));
 function section(contract,required=true){
  reject(plain(contract),'Contract must be an object');if(!Object.hasOwn(contract,WORKSITE_LIVE_HOURS_CURRENT_SECTION)){reject(!required,'Current live/hours companion is required');return null;}
  validateReviewed(expected);const value=contract[WORKSITE_LIVE_HOURS_CURRENT_SECTION];exact(value,Object.keys(expected),'Exact current companion keys');for(const [key,wanted]of Object.entries(expected))reject(same(value[key],wanted),'Unreviewed companion declaration: '+key);return value;
 }
 function references(value){return [...value.reviewedSourceChanges,...value.newSources.map(row=>({path:row.path,previousSha256:null,currentSha256:row.sha256})),...value.producerDeltas.map(row=>({path:row.producer,previousSha256:row.previousSha256,currentSha256:row.currentSha256})),...value.validationSources.map(row=>({path:row.path,previousSha256:value.validationPredecessors.find(prior=>prior.path===row.path)?.sha256??null,currentSha256:row.sha256}))];}
 function restorePreviousContract(contract){
  const value=section(contract,false);if(!value)return contract;const previous=structuredClone(contract);delete previous[WORKSITE_LIVE_HOURS_CURRENT_SECTION];
  for(const row of value.historicalCheckLedgers){const ledger=pointer(previous,row.contractPointer).value;reject(Array.isArray(ledger)&&ledger.length===row.count&&sha(JSON.stringify(ledger))===row.sha256,'Historical check names must remain exact');}
  for(const row of value.producerDeltas)for(const target of row.contractPointers){const at=pointer(previous,target);reject(at.value===row.currentSha256,'Exact current producer pin required');at.parent[at.key]=row.previousSha256;}
  for(const row of value.sourceSetDeltas)if(row.contractPointer){const at=pointer(previous,row.contractPointer);at.parent[at.key]=priorPaths(at.value,row);}
  reject(sha(JSON.stringify(previous,null,2)+'\n')===value.previousContractSha256,'Complete predecessor contract must restore exactly');return previous;
 }
 function currentSourcePin(contract,ref){
  const value=section(contract,false);if(!value)return ref.sha256;reject(plain(ref)&&safe(ref.path)&&hash(ref.sha256),'Exact source pin reference required');const row=references(value).find(row=>row.path===ref.path);if(!row)return ref.sha256;
  reject([row.previousSha256,row.currentSha256].filter(Boolean).includes(ref.sha256),'Only reviewed predecessor/current source pins may advance: '+ref.path);return row.currentSha256;
 }
 function previousSourcePin(contract,ref){const value=section(contract,false);if(!value)return ref.sha256;const row=references(value).find(row=>row.path===ref.path);return row&&row.previousSha256&&ref.sha256===row.currentSha256?row.previousSha256:ref.sha256;}
 function restoreSourceSet(contract,family,files){const value=section(contract,false);if(!value)return files;restorePreviousContract(contract);const row=value.sourceSetDeltas.find(row=>row.family===family);if(!row)return files;sorted(files,'Actual source set must be distinct and sorted');if(files.length===row.previousCount&&pathsHash(files)===row.previousPathsSha256)return [...files];return priorPaths(files,row);}
 function proofSourceAdditions(spec){
  validateReviewed(expected);const row=expected.sourceSetDeltas.find(row=>row.family===spec?.kind);if(!row)return[];const files=spec.sourceFiles;sorted(files,'Distinct sorted proof source paths required');
  if(files.length===row.currentCount&&pathsHash(files)===row.currentPathsSha256){priorPaths(files,row);return [...row.additions];}
  if(files.length===row.previousCount&&pathsHash(files)===row.previousPathsSha256)return[];
  // Earlier historical layers authenticate their own immutable source matrix.
  // Returning no additions here is a projection, never current-proof acceptance.
  reject(files.length<row.previousCount&&!row.additions.some(file=>files.includes(file)),'Unknown live/hours proof source set: '+row.family);return[];
 }
 function verifyCurrentSources(contract,readSource){
  const value=section(contract);reject(typeof readSource==='function','Actual committed Git source reader required');restorePreviousContract(contract);
  reject(readUtf8(readSource,value.declarationTrustAnchorPath)===declarationText(expected),'Actual reviewed declaration differs from the compiled trust anchor');
  for(const row of references(value))reject(sha(readUtf8(readSource,row.path))===row.currentSha256,'Stale current source: '+row.path);
  return {version:1,completePreviousContractRestored:true,previousContractSha256:value.previousContractSha256,reviewedReferenceCount:references(value).length,nativeOrBrowserAcceptance:false};
 }
 function verifyActualClosure(contract,family,closure,readSource){
  const value=section(contract);restorePreviousContract(contract);const row=value.sourceFamilies.find(row=>row.family===family);reject(Boolean(row),'An explicitly reviewed consumer family is required');exact(closure,['files','externalImports'],'Actual AST closure result');sorted(closure.files,'Actual AST source paths must be distinct and sorted');reject(same(closure.files,row.currentFiles)&&same(closure.externalImports,row.externalImports),'Exact actual AST source/external closure required');reject(typeof readSource==='function','Actual committed Git source reader required for consumer contents');for(const ref of row.currentManifest){const text=readUtf8(readSource,ref.path);reject(ref.path===value.declarationTrustAnchorPath?text===declarationText(expected):sha(text)===ref.sha256,'Stale actual consumer source: '+ref.path);}return {family,sourceCount:row.currentFiles.length,sourcePathsSha256:pathsHash(row.currentFiles),nativeOrBrowserAcceptance:false};
 }
 function validationFiles(contract){const value=section(contract,false);return value?[...new Set([...references(value).map(row=>row.path),value.declarationTrustAnchorPath])].sort():[];}
 function restorePreviousProducerText(contract,producer,bytes){
  const value=section(contract);restorePreviousContract(contract);const row=value.producerDeltas.find(row=>row.producer===producer);reject(Boolean(row)&&Buffer.isBuffer(bytes)&&bytes.equals(Buffer.from(bytes.toString('utf8'))),'Only a bound producer UTF-8 source may restore');let text=bytes.toString('utf8').replaceAll('\r\n','\n');reject(sha(text)===row.currentSha256&&Buffer.byteLength(text)===row.sourceHistory.currentBytes,'Exact current producer bytes required');
  for(const h of [...row.sourceHistory.inverseHunks].reverse()){const at=h.currentOffsetCharacters;reject(text.slice(at,at+h.currentText.length)===h.currentText,'Exact current inverse hunk required');text=text.slice(0,at)+h.previousText+text.slice(at+h.currentText.length);}
  reject(sha(text)===row.previousSha256&&Buffer.byteLength(text)===row.sourceHistory.previousBytes,'Entire predecessor producer must restore exactly');return Buffer.from(text);
 }
 return Object.freeze({restorePreviousContract,currentSourcePin,previousSourcePin,restoreSourceSet,proofSourceAdditions,verifyCurrentSources,verifyActualClosure,validationFiles,restorePreviousProducerText});
}
const currentGate=createWorksiteLiveHoursRevisionGate(WORKSITE_LIVE_HOURS_CURRENT_REVISION);
export const restoreWorksiteLiveHoursPreviousContract=currentGate.restorePreviousContract;
export const worksiteLiveHoursCurrentSourcePin=currentGate.currentSourcePin;
export const worksiteLiveHoursPreviousSourcePin=currentGate.previousSourcePin;
export const restoreWorksiteLiveHoursSourceSet=currentGate.restoreSourceSet;
export const verifyWorksiteLiveHoursCurrentSources=currentGate.verifyCurrentSources;
export const verifyWorksiteLiveHoursActualClosure=currentGate.verifyActualClosure;
export const restoreWorksiteLiveHoursPreviousProducerText=currentGate.restorePreviousProducerText;
export const worksiteLiveHoursProofSourceAdditions=currentGate.proofSourceAdditions;
export const worksiteLiveHoursValidationFiles=currentGate.validationFiles;
