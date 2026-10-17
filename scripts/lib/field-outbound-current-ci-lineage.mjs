import {restoreWeeklyCypPreviousContract,weeklyCypCurrentSourcePin} from './home-decisions-current-ci-lineage.mjs';
import {createHash} from 'node:crypto';
import {restoreParticipantPreanalysisPreviousContract,participantPreanalysisPriorValidationPin} from './participant-preanalysis-current-ci-lineage.mjs';
import {restoreOoxmlAccountingPreviousContract,ooxmlAccountingCurrentSourcePin,verifyOoxmlAccountingCurrentSources} from './ooxml-accounting-current-ci-lineage.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex');
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const fail=message=>{throw Object.assign(new Error(message),{code:'PLAN_MEASUREMENT_CURRENT_CI_LINEAGE_REJECTED'});};
const requireLineage=(value,message)=>{if(!value)fail(message);};
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
export const FIELD_OUTBOUND_CURRENT_VALIDATION_PATHS=Object.freeze([
 'scripts/lib/field-outbound-current-ci-lineage.mjs',
 'tests/production-field-outbound-current-ci-lineage.test.mjs',
]);
export const FIELD_OUTBOUND_CURRENT_REVISION=Object.freeze({
 version:1,
 referenceHead:'9d65c743bfaa2fbc0cf964ff4a21e8c27028c12f',
 referenceTree:'8ed2c3a9e0519edbbc405888781cdb52a3ccf22c',
 previousContractSha256:'5cfa4ffc63c260b2ab158f769ce95cde88a69b6d0365ea2b9cca35f0cf2605bb',
 validationDeltas:[
  {path:'scripts/lib/plan-measurement-current-ci-lineage.mjs',previousSha256:'b672e9830733b0759104acf12b1ca7d9f02f49d7c8420dfd046931b3c8f8fc0e',currentSha256:'2706bd16d34d44b647161ad73441aad3d07b6def741e0075a928db9ca6a063b4'},
  {path:'scripts/verify-company-kyc-outbound-compact-ci.mjs',previousSha256:'5c0af6f13c767cb4bb809388a45b3d6a671c0519679c9c7e9e82c301d8375920',currentSha256:'4b643f0af2909511b38dea9d1c66dc59b70ea06cab8f9638440e223da970033a'},
 ],
 reviewedSourceChanges:[
  {path:'src/lib/meta-customer-processing.mjs',previousSha256:'f2bb4443d149895e9c69beac5b148f7733a9951a292289c4f2ac2a420e5d54c2',currentSha256:'e4a52dbd2ce86793b66c4af5963c288b13d7b2b2f656c4c6f795bcac8074f4ad'},
  {path:'src/lib/meta-kyc-identity.mjs',previousSha256:'5b65901dc449288516535312569fd69198d6699c98204e3c0146d13fcd26d160',currentSha256:'b647de9ee86b32848d689a153658e8c34b98699287ad9758332531300470a5a8'},
 ],
 limits:{sourceLeaseMs:60000,statementDelayMs:225,graphDelayMs:200,compactSources:127,consumptionSources:110},
});

function revision(contract){
 requireLineage(plain(contract),'Workspace contract required');
 if(!Object.hasOwn(contract,'fieldOutboundCurrentRevision'))return null;
 const section=contract.fieldOutboundCurrentRevision;
 requireLineage(plain(section)&&same(Object.keys(section).sort(),[...Object.keys(FIELD_OUTBOUND_CURRENT_REVISION),'validationSources'].sort()),'Exact outbound source revision required');
 for(const [key,value] of Object.entries(FIELD_OUTBOUND_CURRENT_REVISION))requireLineage(same(section[key],value),'Unreviewed outbound source revision: '+key);
 requireLineage(Array.isArray(section.validationSources)&&same(section.validationSources.map(row=>row?.path),FIELD_OUTBOUND_CURRENT_VALIDATION_PATHS),'Exact outbound validation source paths required');
 for(const row of section.validationSources)requireLineage(plain(row)&&same(Object.keys(row).sort(),['path','sha256'])&&hash(row.sha256),'Invalid outbound validation pin');
 return section;
}

// Metadata restoration authenticates the exact previous contract. It never
// changes readSource bytes or a native receipt's source manifest.
export function restoreFieldOutboundPreviousContract(contract){
 contract=restoreOoxmlAccountingPreviousContract(contract);
 const section=revision(contract);if(!section)return contract;
 const previous=structuredClone(contract);delete previous.fieldOutboundCurrentRevision;
 for(const delta of section.validationDeltas){
  const matches=previous.planMeasurementCurrentLineage?.currentValidationSources?.filter(row=>row.path===delta.path);
  requireLineage(matches?.length===1&&matches[0].sha256===delta.currentSha256,'Outbound helper revision and current validation pin must advance together');
  matches[0].sha256=delta.previousSha256;
 }
 requireLineage(sha(JSON.stringify(previous,null,2)+'\n')===section.previousContractSha256,'Outbound revision must restore the complete previous contract');
 return previous;
}

export function fieldOutboundCurrentSourcePin(contract,ref){
 const ooxmlPin=ooxmlAccountingCurrentSourcePin(contract,ref);if(ooxmlPin!==ref.sha256)return ooxmlPin;
 const section=revision(contract);if(!section)return ref.sha256;
 const change=section.reviewedSourceChanges.find(row=>row.path===ref.path);
 if(!change)return ref.sha256;
 requireLineage(ref.sha256===change.previousSha256,'The original reviewed source pin must remain unchanged');
 return change.currentSha256;
}

export function verifyFieldOutboundCurrentSources(contract,readSource){
 try{
 verifyOoxmlAccountingCurrentSources(contract,readSource);
 const section=revision(contract);if(!section)return null;
 restoreFieldOutboundPreviousContract(contract);
 requireLineage(typeof readSource==='function','Current source reader required');
 const priorValidationContract=restoreWeeklyCypPreviousContract(contract),priorParticipantContract=restoreParticipantPreanalysisPreviousContract(priorValidationContract);
 for(const row of [...section.reviewedSourceChanges.map(row=>({path:row.path,sha256:row.currentSha256})),...section.validationDeltas.map(row=>({path:row.path,sha256:row.currentSha256})),...section.validationSources]){
  const bytes=readSource(row.path);requireLineage(Buffer.isBuffer(bytes),'Missing current outbound source: '+row.path);
  const text=bytes.toString('utf8'),priorPin=ooxmlAccountingCurrentSourcePin(priorParticipantContract,row);requireLineage(bytes.equals(Buffer.from(text))&&sha(text.replaceAll('\r\n','\n'))===weeklyCypCurrentSourcePin(contract,{...row,sha256:participantPreanalysisPriorValidationPin(priorValidationContract,{...row,sha256:priorPin})}),'Stale current outbound source: '+row.path);
 }
 return {version:1,previousContractSha256:section.previousContractSha256,reviewedSourceChanges:section.reviewedSourceChanges.map(row=>row.path),historicalPinsPreserved:true,nativeAcceptance:false};
 }catch(error){if(error.code==='HOME_DECISIONS_CURRENT_CI_LINEAGE_REJECTED')requireLineage(false,error.message);throw error;}
}
