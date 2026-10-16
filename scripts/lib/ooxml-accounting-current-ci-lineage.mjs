import {createHash} from 'node:crypto';

const sha=value=>createHash('sha256').update(value).digest('hex');
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const requireLineage=(value,message)=>{if(!value)throw Object.assign(new Error(message),{code:'PLAN_MEASUREMENT_CURRENT_CI_LINEAGE_REJECTED'});};
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
export const OOXML_ACCOUNTING_CURRENT_VALIDATION_PATHS=Object.freeze([
 'scripts/lib/ooxml-accounting-current-ci-lineage.mjs',
 'tests/production-ooxml-accounting-current-ci-lineage.test.mjs',
]);
// Current pins authorize only frozen reviewed bytes; pending pins are rejected.
// Historical contract pins and native source manifests remain unchanged.
export const OOXML_ACCOUNTING_CURRENT_REVISION=Object.freeze({
 version:1,
 referenceHead:'a130e976a1566053b5fda96f875a1e9df776d037',
 referenceTree:'93ce47d45296cec9b1719619db673c742129cf92',
 previousContractSha256:'63252e3af6a5e595f731302d33cf32e18182f24c75ac144cc062b0911efeda17',
 reviewedSourceChanges:[
  {path:'src/lib/plan-import-ooxml.mjs',previousSha256:'00c14c85a01734f9b77e508ef8c30fd1b1fa9e1d921b632649f93c534cc9cdd5',currentSha256:'473a0ac3199ef044107a2847059a6fea1c04f9716af4b8c4008623f0deb80b4d'},
  {path:'src/lib/plan-measurement-source.mjs',previousSha256:'37f3c1e16f01392794b486079c74e458d953006bb05ac9b732e75c019db248ba',currentSha256:'ecf33b67a333d8ce73bfb51610218a1658cd94a26b62eb35d2290b795f826f36'},
  {path:'tests/production-plan-measurement-analyzer-http.test.mjs',previousSha256:'ee7d0e1b1631a5fc79ce56931d0168abc531b6816496fb4018d407f826c2332a',currentSha256:'f9441c1e09e20ccad42608003e8f410b43cabc10ec37da33285d2c98ccc23d24'},
  {path:'tests/production-plan-measurement-source.test.mjs',previousSha256:'1207ee60d31ddd28e74a33ca887a2addf051d7e229989a366f167abeb77703f1',currentSha256:'8dba7384fd57882e13f3d148395ed46e445c5b7fceb0260f937d7de05f92d35c'},
  {path:'src/app/(identity)/cuenta/plan-measurement-view.mjs',previousSha256:'1c980824bc38e7fcaec42812e205e774fa3d849b63da9adf620a5447de256816',currentSha256:'ba6c55a030fe53174825b620bc7f0b349d6fb66b6c827f5e8ca0eda393e8ff5d'},
  {path:'src/app/(identity)/cuenta/plan-measurement-panel.js',previousSha256:'7558e7c27b03229e422b1ae8b00ffb78f7115371ee6571d5ac6ee9e7d584c0a4',currentSha256:'08214cdfbf5fdf921a0ac6527437367cb5dff7e7b0de724b149d8483900da042'},
  {path:'tests/production-plan-measurement-view.test.mjs',previousSha256:'b84a051be31a7bc5c0d15f3ff5a0f6a0d47b9752034db92237f4df7e610faddc',currentSha256:'04ec71570ce229ef5b0355aa2bc96f030c56977c2e422bf5336f210cca5c63f5'},
 ],
 validationDeltas:[
  {path:'scripts/lib/field-outbound-current-ci-lineage.mjs',previousSha256:'1537ffbb1ddfcb582f4c06dea4887c7558321e3f60eba65a15a4ba3e7714cd21',currentSha256:'b9dcbb4283c2092913f02cf98b9bb5550bdae2ab54551f03cc502f13c454ca8e'},
  {path:'scripts/verify-company-kyc-outbound-compact-ci.mjs',previousSha256:'4b643f0af2909511b38dea9d1c66dc59b70ea06cab8f9638440e223da970033a',currentSha256:'1ab190ed268eecf39fed2614f1cebe038f910403b2f2bbc7fa7c081d209153bd'},
 ],
 limits:{currentValidationPaths:49,compactSources:127,consumptionSources:110,kycSources:111,measurementSources:113,organizationSources:115},
});

function revision(contract){
 requireLineage(plain(contract),'Workspace contract required');
 if(!Object.hasOwn(contract,'ooxmlAccountingCurrentRevision'))return null;
 const section=contract.ooxmlAccountingCurrentRevision;
 requireLineage(plain(section)&&same(Object.keys(section).sort(),[...Object.keys(OOXML_ACCOUNTING_CURRENT_REVISION),'validationSources'].sort()),'Exact OOXML source revision required');
 for(const [key,value]of Object.entries(OOXML_ACCOUNTING_CURRENT_REVISION))requireLineage(same(section[key],value),'Unreviewed OOXML source revision: '+key);
 for(const row of [...section.reviewedSourceChanges,...section.validationDeltas])requireLineage(hash(row.currentSha256)&&row.currentSha256!==row.previousSha256,'A frozen current OOXML revision is required');
 requireLineage(Array.isArray(section.validationSources)&&same(section.validationSources.map(row=>row?.path),OOXML_ACCOUNTING_CURRENT_VALIDATION_PATHS),'Exact OOXML validation source paths required');
 for(const row of section.validationSources)requireLineage(plain(row)&&same(Object.keys(row).sort(),['path','sha256'])&&hash(row.sha256),'Invalid OOXML validation pin');
 return section;
}

// This restores metadata only. The complete previous contract, including all
// 49 reviewed pins and the Q revision, must remain byte-authenticatable.
export function restoreOoxmlAccountingPreviousContract(contract){
 const section=revision(contract);if(!section)return contract;
 const previous=structuredClone(contract);delete previous.ooxmlAccountingCurrentRevision;
 requireLineage(sha(JSON.stringify(previous,null,2)+'\n')===section.previousContractSha256,'OOXML revision must restore the complete previous contract');
 return previous;
}

export function ooxmlAccountingCurrentSourcePin(contract,ref){
 const section=revision(contract);if(!section)return ref.sha256;
 const change=[...section.reviewedSourceChanges,...section.validationDeltas].find(row=>row.path===ref.path);
 if(!change)return ref.sha256;
 requireLineage(ref.sha256===change.previousSha256,'The original OOXML reviewed source pin must remain unchanged');
 return change.currentSha256;
}

export function verifyOoxmlAccountingCurrentSources(contract,readSource){
 const section=revision(contract);if(!section)return null;
 restoreOoxmlAccountingPreviousContract(contract);
 requireLineage(typeof readSource==='function','Current OOXML source reader required');
 for(const row of [...section.reviewedSourceChanges.map(row=>({path:row.path,sha256:row.currentSha256})),...section.validationDeltas.map(row=>({path:row.path,sha256:row.currentSha256})),...section.validationSources]){
  const bytes=readSource(row.path);requireLineage(Buffer.isBuffer(bytes),'Missing current OOXML source: '+row.path);
  const text=bytes.toString('utf8');requireLineage(bytes.equals(Buffer.from(text))&&sha(text.replaceAll('\r\n','\n'))===row.sha256,'Stale current OOXML source: '+row.path);
 }
 return {version:1,previousContractSha256:section.previousContractSha256,reviewedSourceChanges:section.reviewedSourceChanges.map(row=>row.path),historicalPinsPreserved:true,nativeAcceptance:false};
}
