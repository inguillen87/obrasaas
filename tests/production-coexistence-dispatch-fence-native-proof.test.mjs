import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {normalizeCustomerPhoneSelectionNativeProof,restoreCustomerPhoneSelectionPreviousContract} from '../scripts/lib/home-decisions-current-ci-lineage.mjs';

// Pure decoder shadows over the actual current candidate source reader. No
// database/provider run, private receipt, fabricated HEAD or historical body alias.
const readSource=file=>readFileSync(new URL('../'+file,import.meta.url));
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const producer='scripts/verify-meta-customer-coexistence-postgres.mjs';
const added=[
 'native-sync-membership-changed-after-reservation-denies-POST-and-keeps-nonreplayable-receipt',
 'native-sync-token-changed-after-reservation-denies-POST-and-keeps-nonreplayable-receipt',
 'native-sync-lease-changed-after-reservation-denies-POST-and-keeps-nonreplayable-receipt',
 'native-six-second-signed-callback-timeout-during-eight-second-accepted-sync-re-delivers-durably-and-idempotently-with-one-POST',
 'native-six-second-signed-callback-timeout-during-eight-second-lost-sync-response-preserves-uncertainty-and-re-delivers-without-repeated-POST'
];
function fixture(){
 const contract=JSON.parse(readSource('.github/workspace-acceptance-contract.json')),previous=restoreCustomerPhoneSelectionPreviousContract(contract),api=previous.existingApiPlanCurrentRevision.native.currentCheckNames,historical=[...api,...contract.customerPhoneSelectionCurrentRevision.native.addedCheckNames];
 assert.equal(api.length,41);assert.equal(historical.length,52);assert.equal(hash(historical),'017a754bed3aba7d628c453bbe3dd2ac2bc39d7340d6452cdf6941c6f6d5bc6c');assert.equal(hash(added),'ea567c7e6383371f509871eb0000f0a1d4fba726fb27127f4a2754dbd72c5967');
 return {contract,api,historical,proof:{status:'PASS',environment:'local-disposable-postgresql17',checks:[...historical,...added],slowSyncCallbackTimings:['accepted','response-lost'].map(variant=>({variant,firstCallbackStatus:503,retryStatus:200,firstCallbackElapsedMs:6000,postElapsedMs:8000,posts:1,reDeliveredSameSignedBytes:true,realProviderCalls:0})),realProviderCalls:0,physicalNumberTested:false,productionDataTouched:false}};
}
function deny(edit,reader=readSource){const {contract,proof}=fixture();edit(proof,contract);const before=structuredClone(proof);assert.throws(()=>normalizeCustomerPhoneSelectionNativeProof(proof,contract,reader),{code:'HOME_DECISIONS_CURRENT_CI_LINEAGE_REJECTED'});assert.deepEqual(proof,before);}

test('sync fence native decoder validates57 before projecting52 and41 without mutating the raw shadow',()=>{const {contract,proof,api}=fixture(),before=structuredClone(proof);assert.equal(hash(proof.checks),'05624d5b0440a8f6fa7e80bdaccf76b4b1ba9902ab0b71f261cabdadb24ae45a');const result=normalizeCustomerPhoneSelectionNativeProof(proof,contract,readSource);assert.deepEqual(result,{...proof,checks:api});assert.deepEqual(proof,before);});
test('sync fence native decoder rejects historical52 alone with the current005 producer',()=>deny(p=>{p.checks=p.checks.slice(0,52);}));
test('sync fence native decoder rejects one missing membership fence control',()=>deny(p=>{p.checks.splice(52,1);}));
test('sync fence native decoder rejects duplicate additive controls',()=>deny(p=>{p.checks[53]=p.checks[52];}));
test('sync fence native decoder rejects reordered additive controls',()=>deny(p=>{p.checks.splice(52,5,...p.checks.slice(52).reverse());}));
test('sync fence native decoder rejects reordered historical controls',()=>deny(p=>{[p.checks[0],p.checks[1]]=[p.checks[1],p.checks[0]];}));
test('sync fence native decoder rejects unreviewed extra controls',()=>deny(p=>{p.checks.push('foreign-native-control');}));
test('sync fence native decoder rejects substituted historical controls',()=>deny(p=>{p.checks[0]='foreign-native-control';}));
test('sync fence native decoder rejects a stale or foreign current producer body',()=>deny(()=>{},file=>file===producer?Buffer.from('foreign producer body'):readSource(file)));
test('sync fence native decoder rejects a missing current producer body',()=>deny(()=>{},file=>file===producer?undefined:readSource(file)));
test('sync fence native decoder rejects missing slow callback observations',()=>deny(p=>{delete p.slowSyncCallbackTimings;}));
test('sync fence native decoder rejects reordered accepted and lost response observations',()=>deny(p=>{p.slowSyncCallbackTimings.reverse();}));
test('sync fence native decoder rejects a falsely successful first callback',()=>deny(p=>{p.slowSyncCallbackTimings[0].firstCallbackStatus=200;}));
test('sync fence native decoder rejects failed callback re-delivery',()=>deny(p=>{p.slowSyncCallbackTimings[1].retryStatus=503;}));
test('sync fence native decoder rejects a repeated external POST',()=>deny(p=>{p.slowSyncCallbackTimings[0].posts=2;}));
test('sync fence native decoder rejects a different signed callback on retry',()=>deny(p=>{p.slowSyncCallbackTimings[1].reDeliveredSameSignedBytes=false;}));
test('sync fence native decoder rejects durations outside observed native bounds',()=>deny(p=>{p.slowSyncCallbackTimings[0].firstCallbackElapsedMs=5899;}));
test('sync fence native decoder rejects nonnumeric dispatch duration data',()=>deny(p=>{p.slowSyncCallbackTimings[0].postElapsedMs='8000';}));
test('sync fence native decoder rejects provider or human acceptance claims',()=>deny(p=>{p.realProviderCalls=1;p.physicalNumberTested=true;}));
test('sync fence native decoder rejects extra private data in a timing observation',()=>deny(p=>{p.slowSyncCallbackTimings[0].privateDto={unreviewed:'value'};}));
test('sync fence native decoder rejects extra private data in the raw proof',()=>deny(p=>{p.privateDto={unreviewed:'value'};}));
test('sync fence native decoder rejects removed current producer aliases in the companion',()=>deny((p,c)=>{c.planBudgetCurrentRevision.references=c.planBudgetCurrentRevision.references.filter(row=>row.path!==producer);}));
