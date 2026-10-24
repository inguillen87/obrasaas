import {PLAN_BUDGET_CURRENT_SECTION,PLAN_BUDGET_CI_KIND,PLAN_BUDGET_CI_PROOF_PATH,restorePlanBudgetPreviousContract,verifyPlanBudgetCurrentSources,planBudgetCompiledProof,planBudgetRetainedScreenshotPaths,restorePlanBudgetAttendanceReviewProducerText,restorePlanBudgetFieldReviewSourceSet,normalizePlanBudgetIntakeWithdrawalNativeProof,intakeWithdrawalCurrentCheckCount,INTAKE_WITHDRAWAL_CHECK_NAMES,restorePlanBudgetIntakeWithdrawalProducerText} from '../../scripts/lib/plan-budget-current-ci-lineage.mjs';
import * as captureBudget from '../../scripts/lib/plan-budget-current-ci-lineage.mjs';
import {hasCaptureRuntime,captureRuntimeProducerSourceFiles,buildCaptureRuntimeWorkflow,normalizeCaptureCompanyCoreNativeProof} from '../../scripts/lib/capture-runtime-canonical-collectors.mjs';
import {normalizeAttendanceReviewNativeProof,attendanceReviewCurrentCheckCount,ATTENDANCE_REVIEW_CHECK_NAMES} from '../../scripts/lib/attendance-review-current-ci-proof.mjs';
import {PLAN_BUDGET_UI_MATRIX,validatePlanBudgetUiProofBytes,planBudgetUiSourceBinding,planBudgetUiRetainedScreenshotPath} from '../../scripts/lib/plan-budget-ui-contract.mjs';
import {WORKSITE_LIVE_HOURS_CURRENT_SECTION,restoreWorksiteLiveHoursPreviousContract,verifyWorksiteLiveHoursCurrentSources} from '../../scripts/lib/worksite-live-hours-current-ci-lineage.mjs';
import {IDENTITY_DESTINATION_UX_CURRENT_REVISION,validateIdentityDestinationUxBrowserSupplement,identityDestinationUxBrowserShadow} from '../../scripts/lib/home-decisions-current-ci-lineage.mjs';
import {validateProgressEvidenceWaitNativeProofBytes} from '../../scripts/lib/home-decisions-current-ci-lineage.mjs';
import {WEEKLY_CYP_CURRENT_REVISION,verifyWeeklyCypCurrentSources,validateWeeklyCypImportUiProofBytes} from '../../scripts/lib/home-decisions-current-ci-lineage.mjs';
import {validatePlanPartidaPreviewImportUiProofBytes} from '../../scripts/lib/home-decisions-current-ci-lineage.mjs';
import {PLAN_PARTIDA_PREVIEW_CURRENT_SECTION,PLAN_PARTIDA_PREVIEW_CURRENT_REVISION} from '../../scripts/lib/plan-partida-preview-current-ci-lineage.mjs';
import {validateCompanyOnboardingUxNativeProofBytes} from '../../scripts/lib/home-decisions-current-ci-lineage.mjs';
import assert from 'node:assert/strict';
import {WHATSAPP_FIELD_CONTINUITY_CURRENT_REVISION,WHATSAPP_FIELD_CONTINUITY_PREVIOUS_CONTRACT_SHA256,restoreWhatsappFieldContinuityPreviousContract,verifyWhatsappFieldContinuityCurrentSources,whatsappFieldCompanyNativeSourceFiles,validateWhatsappFieldNeutralStepNative,whatsappFieldNeutralStepShadowFixture} from '../../scripts/lib/whatsapp-field-continuity-current-ci-lineage.mjs';
import {FIELD_TASK_PAGINATION_CI_KIND,validateFieldTaskPaginationCi,fieldTaskPaginationCiSourceClosure} from '../../scripts/verify-field-task-pagination-ci.mjs';
import {WORKSPACE_CONTINUITY_PREVIOUS_CONTRACT_SHA256,restoreWorkspaceContinuityPreviousContract,verifyWorkspaceContinuityCurrentSources} from '../../scripts/lib/workspace-continuity-current-ci-lineage.mjs';
import {DOCUMENT_TASK_ASSOCIATION_PREVIOUS_CONTRACT_SHA256,restoreDocumentTaskAssociationPreviousContract,verifyDocumentTaskAssociationCurrentSources} from '../../scripts/lib/plan-measurement-document-association-ci-lineage.mjs';
import {createHash} from 'node:crypto';
import {INTEGRATED_IDENTITY_CURRENT_REVISION,integratedIdentityCurrentSourcePin,restoreIntegratedIdentityPreviousContract,validateIntegratedIdentityWorkspaceContract,verifyIntegratedIdentityCurrentSources,validateIntegratedCompanyCurrentNative,integratedCompanyCurrentShadowFixture,integratedIdentityCurrentSelftest,integratedIdentityPreviousProofChecks} from '../../scripts/lib/integrated-identity-current-ci-lineage.mjs';
import {FOCUSED_WORKSPACE_CI_KIND,validateFocusedWorkspaceCi,focusedWorkspaceCiSourceClosure} from '../../scripts/verify-focused-workspace-ci.mjs';
import {PARTICIPANT_PREANALYSIS_KIND,restoreParticipantPreanalysisPreviousContract,validateParticipantPreanalysisWorkspaceContract,participantPreanalysisProofSourceAdditions,restoreParticipantPreanalysisSourceSet} from '../../scripts/lib/participant-preanalysis-current-ci-lineage.mjs';
import {validateParticipantKycPreanalysisCi,participantPreanalysisCiSourceClosure} from '../../scripts/verify-participant-kyc-preanalysis-ci.mjs';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,readdirSync,lstatSync,realpathSync,mkdtempSync,rmSync,existsSync} from 'node:fs';
import {writeSync as writeSelftestProgressSync} from 'node:fs';

import {runInNewContext} from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import yaml from 'js-yaml';
import {parse} from '@babel/parser';
import {parseTap,TEST_SUITES,RECOVERY_CASES,EXPECTED_SUITE_COUNTS,EXPECTED_TOTAL_TESTS,sourceFiles as bankUnitSourceFiles} from '../../scripts/verify-participant-bank-intake-contracts.mjs';
import {TEST_FILE as PORTFOLIO_TEST_FILE,EXPECTED_TESTS as PORTFOLIO_TESTS,sourceFiles as portfolioUnitSourceFiles} from '../../scripts/verify-portfolio-overview-contracts.mjs';
import {KYC_EXPIRED_CURRENT_ADDITIONS,KYC_EXPIRED_CURRENT_VALIDATION_SOURCES,validateKycExpiredCurrentWorkspaceContract as validatePublishedKycWorkspaceContract,verifyKycExpiredCurrentSources as verifyPublishedKycSources} from '../../scripts/lib/kyc-expired-current-ci-lineage.mjs';
import {PLAN_MEASUREMENT_CURRENT_PROOF_CHANGES,planMeasurementCurrentDependencies,reconstructPublishedHContract,verifyPlanMeasurementCurrentSources,currentFieldPrivacyRevision,currentFieldPrivacySpecRevision} from '../../scripts/lib/plan-measurement-current-ci-lineage.mjs';

export const EXPECTED_CONTRACT_SHA256="6f2f60136a3d9ec69dd0a72aad062e802c8c76efddce55e058541d9303573a7e";
function validateKycExpiredCurrentWorkspaceContract(contract){return validatePublishedKycWorkspaceContract(contract.planMeasurementCurrentLineage?reconstructPublishedHContract(contract):contract);}
function verifyKycExpiredCurrentSources(section,readSource){
 const current=JSON.parse(readSource('.github/workspace-acceptance-contract.json'));
 if(current[WORKSITE_LIVE_HOURS_CURRENT_SECTION]){try{verifyWorksiteLiveHoursCurrentSources(current,readSource);}catch(error){if(error.code==='WORKSITE_LIVE_HOURS_CURRENT_CI_LINEAGE_REJECTED')throw Object.assign(new Error(error.message),{code:'PLAN_MEASUREMENT_CURRENT_CI_LINEAGE_REJECTED'});throw error;}}
 try{verifyIntegratedIdentityCurrentSources(current,readSource);}catch(error){if(error.code==='INTEGRATED_IDENTITY_CURRENT_CI_LINEAGE_REJECTED')throw Object.assign(new Error(error.message),{code:'PLAN_MEASUREMENT_CURRENT_CI_LINEAGE_REJECTED'});throw error;}
 if(current.planMeasurementCurrentLineage){if(canonical(current.kycExpiredCurrentComposition)!==canonical(section))throw Object.assign(new Error('Published KYC section changed'),{code:'PLAN_MEASUREMENT_CURRENT_CI_LINEAGE_REJECTED'});return hasCaptureRuntime(current)?captureBudget.withCaptureRuntimePreviousSources(current,readSource,(parent,parentRead)=>verifyPlanMeasurementCurrentSources(parent,parentRead)):verifyPlanMeasurementCurrentSources(current,readSource);}
 return verifyPublishedKycSources(section,readSource);
}
const POSTGRES_SERVICE_IMAGE='docker.io/library/postgres:17-alpine@sha256:742f40ea20b9ff2ff31db5458d127452988a2164df9e17441e191f3b72252193';
const BASELINE_BLOCKS_SHA256='97abbb70282f13efede473f08954e3a233cb77c76efe7178c0de981310c6f8bd';
const BASELINE_OWNERSHIP_SHA256='26c7acdbb7d3a5eb6e75355c3c4af715c8f07ce27b12248d6028160c76fa77a4';
const BASELINE_PRODUCERS_SHA256='07d0016608332c0775f86bee6d005e60d4686d2ffe33a3065dfd9fd8e974ab20';
const PREPARATION_BASELINE_BLOCKS_SHA256='8faaf5e69185f49da4c797d21613c7a34705be074fa3890398be37a8559ca409';
const PREPARATION_BASELINE_OWNERSHIP_SHA256='d98be6976ef7772633f5e8697fef3786855199e60dd0d522dc392b01097d602f';
const PREPARATION_BASELINE_PRODUCERS_SHA256='a314f2640330bd4bc0615e0b13a7393dc8f8e8d94d4cdb74a728a1785d31a9c8';
const PREPARATION_ARTIFACTS=['.vercel/private/project-preparation-postgres-validation.json','.vercel/private/project-preparation-ui-*.json','.vercel/private/project-preparation-ui-*.png'];
const PREPARATION_MODES=['save','recover','reload','cancel','conflict','denied'];
const INTAKE_UI_MODES=['success','unknown','wrong-receipt','html403','scope-switch','paging','config','invite','paged-worker','continuation-crossed','continuation-denied','continuation-existing','continuation-missing','continuation-missing-refresh','continuation-missing-confirm','existing-profile','existing-profile-unknown','existing-profile-blocked','existing-profile-invalid','existing-profile-stale'];
const INTAKE_UI_FOCUSED_404_MODES=['continuation-missing','continuation-missing-refresh','continuation-missing-confirm'];
const INTAKE_UI_EXISTING_BLOCKED_MODES=['existing-profile-blocked','existing-profile-invalid'];
const INTAKE_UI_EXISTING_SELECTION_MODES=['existing-profile','existing-profile-unknown','existing-profile-stale'];
const intakeUiExpectedPosts=mode=>['invite',...INTAKE_UI_EXISTING_BLOCKED_MODES].includes(mode)?0:['paged-worker','continuation-missing-refresh','continuation-missing-confirm'].includes(mode)?2:1;
const intakeUiExistingGuards=mode=>({...(INTAKE_UI_EXISTING_BLOCKED_MODES.includes(mode)?{unsafeSelectionBlocked:true}:{}),...(INTAKE_UI_EXISTING_SELECTION_MODES.includes(mode)?{explicitCurrentProfileSelection:true,profileUnselectedInitially:true,currentJobPreserved:true}:{}),...(mode==='existing-profile-stale'?{staleSelectionRejected:true}:{})});
const INTAKE_CONTINUITY_SOURCE='src/app/(identity)/cuenta/employee-intake-continuity.mjs';
const intakeContinuityDependenciesFor=kind=>['UI_BANK','UI_INTAKE','UI_JOINT','UI_CAUSAL'].includes(kind)?[INTAKE_CONTINUITY_SOURCE]:[];
// Historical producer receipts remain immutable. Current proof pins below are
// still checked against the exact reviewed Git bytes by validateExtensionProof.
const INTAKE_CONTINUITY_BASELINE_PRODUCERS={
 PG_INTAKE:{producer:'scripts/verify-employee-intake-postgres.mjs',path:'.vercel/private/employee-intake-postgres.json',retained:true,blockId:54,lane:'people',sourceLine:61,producerSha256:'a2ac3da85d42558c97fc0fdb43b28df99c6b9d6feee4f0890654d11251447a86',sourceBasis:'EXPECTED_HEAD_GIT_BYTES'},
 UI_INTAKE:{producer:'scripts/verify-employee-intake-ui.mjs',path:'.vercel/private/employee-intake-ui/browser.json',retained:true,blockId:55,lane:'people',sourceLine:54,producerSha256:'ff80525919b69eff1209146c36388e2c4eb88d9cf19cf9ea9d46bace9d0a9584',sourceBasis:'EXPECTED_HEAD_GIT_BYTES'},
 UI_JOINT:{producer:'scripts/verify-participant-bank-intake-ui.mjs',path:'.vercel/private/participant-bank-intake-integration/current/browser.json',retained:true,blockId:56,lane:'people',sourceLine:73,producerSha256:'2fa7ebd95079638a1753e9156617c317b688601c8cfa82a5da8a9b044b070c5f',sourceBasis:'EXPECTED_HEAD_GIT_BYTES'},
 UI_CAUSAL:{producer:'scripts/verify-participant-bank-intake-ui.mjs',path:'.vercel/private/participant-bank-intake-integration/bad-resolution/browser.json',retained:true,blockId:56,lane:'people',sourceLine:73,producerSha256:'2fa7ebd95079638a1753e9156617c317b688601c8cfa82a5da8a9b044b070c5f',sourceBasis:'EXPECTED_HEAD_GIT_BYTES'}
};
const INTAKE_PLAIN_TEXT_UNIT_BASELINE_PRODUCER={producer:'scripts/verify-participant-bank-intake-contracts.mjs',path:'.vercel/participant-bank-intake-contract-evidence/proof.json',retained:true,blockId:53,lane:'contracts',sourceLine:57,producerSha256:'7066bea65970f0a8e959af59cb9ef7ded715b259aab9d58f3eeb7e2a514a736a',sourceBasis:'EXPECTED_HEAD_GIT_BYTES'};
const KYC_RETRY_PREVIOUS_UNIT_PRODUCER_SHA256='b14443033c1e66c2baaa0048b13961216d46dc01ecc9916819e482fe239ddace';
const ADMITTED_GUIDANCE_PREVIOUS_UNIT_PRODUCER_SHA256='e35b1b8138c1d47803600445ccd223dabc8fa4055de29d91a71ddeffdf6246f0';
const ADMITTED_GUIDANCE_PREVIOUS_UNIT_TEST_COUNTS=Object.freeze({intake:91,total:285});
const PORTFOLIO_BASELINE_BLOCKS_SHA256='fdb9d500f6e96981887bc1f7e74d55875c870239c198296466d4a362f63d68d7';
const PORTFOLIO_BASELINE_OWNERSHIP_SHA256='81608969b6edbf08690ea31011d6c526f65bfae91468933e496f0cc52be5fab4';
const PORTFOLIO_BASELINE_PRODUCERS_SHA256='f727810f0b923c95623fab858aa72da8ecccb21edded6278b972872aeb7a411e';
const PORTFOLIO_BLOCK_DIGEST='87166cb8289ff7e7380bdb6b1954746b65c26a1955d4b3985f312c7fdeccf8f0';
const PORTFOLIO_ARTIFACTS=['.vercel/portfolio-overview-contract-evidence/','.vercel/private/portfolio-overview-ui-validation.json','.vercel/private/portfolio-*.png'];
const PORTFOLIO_MODES=['success','pagination','503','401','403','409','503-html','401-html','403-html','409-html','invalid-json','wrong-scope','wrong-role','stale','unmount','locked','dark'];
const IDENTITY_ARTIFACTS=['.vercel/workspace-identity-only-evidence/'];
const IDENTITY_UI_BASELINE_PRODUCER={producer:'scripts/verify-workspace-identity-only-ui.mjs',path:'.vercel/workspace-identity-only-evidence/browser.json',retained:true,blockId:60,lane:'workspace-ui',sourceLine:240,producerSha256:'af286c0382dc5bb062fd13ec0d7e40f2e6e4da040c18fce351658ee4e9bcaa92',sourceBasis:'EXPECTED_HEAD_GIT_BYTES'};
const IDENTITY_BASELINE_BLOCKS_SHA256='1ec5faa63519324e8b21611559622161522e5c05d37dfb63bd3065c4bdb5c4f9';
const IDENTITY_BASELINE_OWNERSHIP_SHA256='78694a31aa081eaa44e2680a7b84512b9fc00a348fa4e57e01afdc7946be150f';
const IDENTITY_BASELINE_PRODUCERS_SHA256='c84dfb43d147837ae604682617817be2b0463fc7178b2fac340a845acc21b516';
const IDENTITY_BLOCK_DIGEST='238695242b62319edb2feb2ff7b8e8dbf59c844292784e11cdbb18c70cd5d5b8';
const PREPARATION_PG_BASELINE_PRODUCER={"producer":"scripts/verify-project-preparation-postgres.mjs","path":".vercel/private/project-preparation-postgres-validation.json","retained":true,"blockId":58,"lane":"business","sourceLine":73,"producerSha256":"f9cb6908a4062fbfaed2eba92e6e46b6cfe5672d9466a69d650468e85d461294","sourceBasis":"EXPECTED_HEAD_GIT_BYTES"};
const COMPANY_KYC_PG_BASELINE_PRODUCER={"producer":"scripts/verify-company-channel-kyc-postgres.mjs","path":".vercel/company-kyc-evidence/postgres.json","retained":true,"blockId":57,"lane":"people","sourceLine":139,"producerSha256":"ca2aa4d683d9e2aa61557497354bb772fba96b0b9ba496262da73ccbb473ffd5","sourceBasis":"EXPECTED_HEAD_GIT_BYTES"};
const COPY_CLOSURE_UI_BASELINE_PRODUCERS={"UI_PREPARATION":{"producer":"scripts/verify-project-preparation-ui.mjs","path":".vercel/private/project-preparation-ui-validation.json","retained":true,"blockId":58,"lane":"business","sourceLine":55,"producerSha256":"04030e76b8ce12bde95f098b6c9b3a2b0c4b8785cd662baae12f469ce140d842","sourceBasis":"EXPECTED_HEAD_GIT_BYTES"},"UI_PORTFOLIO":{"producer":"scripts/verify-portfolio-overview-ui.mjs","path":".vercel/private/portfolio-overview-ui-validation.json","retained":true,"blockId":59,"lane":"workspace-ui","sourceLine":84,"producerSha256":"99169d6eda91765fa5dbf55b37ccf3653974d070d2211a44fcb9c6a0990c2a49","sourceBasis":"EXPECTED_HEAD_GIT_BYTES"}};
const identityDependenciesFor=kind=>['UNIT','UI_BANK','UI_JOINT','UI_CAUSAL','PG_COMPANY_KYC'].includes(kind)?['src/lib/participant-admission.mjs']:[];
const REACTIVE_IDENTITY_SOURCE='src/lib/participant-onboarding-reactive.mjs';
const reactiveIdentityDependenciesFor=kind=>['UNIT','UI_BANK','UI_JOINT','UI_CAUSAL','PG_COMPANY_KYC','PG_FIELD','PG_OVERTIME'].includes(kind)?[REACTIVE_IDENTITY_SOURCE]:[];
const REACTIVE_SOURCE_COUNTS={UNIT:99,UI_BANK:95,UI_JOINT:95,UI_CAUSAL:95,PG_COMPANY_KYC:167,PG_FIELD:93,PG_OVERTIME:78};
const ownCompanyDependenciesFor=kind=>({
 UNIT:['src/app/(identity)/cuenta/own-company-number-view.mjs','src/lib/company-onboarding-policy.mjs','src/lib/company-phone-format.mjs','src/lib/meta-own-company-policy.mjs'],
 UI_BANK:['src/app/(identity)/cuenta/own-company-number-view.mjs','src/lib/company-onboarding-policy.mjs','src/lib/company-phone-format.mjs','src/lib/meta-own-company-policy.mjs'],
 UI_JOINT:['src/app/(identity)/cuenta/own-company-number-view.mjs','src/lib/company-onboarding-policy.mjs','src/lib/company-phone-format.mjs','src/lib/meta-own-company-policy.mjs'],
 UI_CAUSAL:['src/app/(identity)/cuenta/own-company-number-view.mjs','src/lib/company-onboarding-policy.mjs','src/lib/company-phone-format.mjs','src/lib/meta-own-company-policy.mjs'],
 PG_COMPANY_KYC:['src/lib/meta-own-company-connection.mjs','src/lib/meta-own-company-policy.mjs'],
 PG_FIELD:['src/lib/company-onboarding-policy.mjs','src/lib/company-phone-format.mjs','src/lib/meta-own-company-policy.mjs'],
 PG_OVERTIME:['src/lib/company-onboarding-policy.mjs','src/lib/company-phone-format.mjs','src/lib/meta-own-company-policy.mjs'],
 UI_INTAKE:['src/app/(identity)/cuenta/own-company-number-view.mjs'],
 PG_PREPARATION:['src/app/(identity)/cuenta/own-company-number-view.mjs'],
 UI_PREPARATION:['src/app/(identity)/cuenta/own-company-number-view.mjs'],
 UI_PORTFOLIO:['src/app/(identity)/cuenta/own-company-number-view.mjs'],
 UI_IDENTITY_ONLY:['src/app/(identity)/cuenta/own-company-number-panel.js','src/app/(identity)/cuenta/own-company-number-view.mjs']
 }[kind]||[]);
// Current reviewer composition only. Historical commands and producer pins stay
// immutable; these additions follow the current producers' exact source walks.
const reviewerDependenciesFor=kind=>({
 UNIT:['src/lib/canonical-invited-account.mjs'],
 UI_BANK:['src/lib/canonical-invited-account.mjs'],
 UI_JOINT:['src/lib/canonical-invited-account.mjs'],
 UI_CAUSAL:['src/lib/canonical-invited-account.mjs'],
 PG_COMPANY_KYC:['src/lib/canonical-invited-account.mjs','src/lib/office-review-http.mjs','src/lib/office-review-policy.mjs','src/lib/office-review-runtime.mjs','src/lib/office-review-store.mjs','src/lib/project-creation-http.mjs','src/lib/project-creation-policy.mjs','src/lib/project-creation-runtime.mjs','src/lib/project-creation-store.mjs'],
 PG_FIELD:['src/lib/canonical-invited-account.mjs'],
 PG_OVERTIME:['src/lib/canonical-invited-account.mjs'],
 UI_IDENTITY_ONLY:['src/app/(identity)/cuenta/office-review-panel.js','src/app/(identity)/cuenta/office-review-panel.module.css','src/app/(identity)/cuenta/office-review-view.mjs','src/app/(identity)/cuenta/project-creation-format.mjs','src/app/(identity)/cuenta/project-creation-panel.js','src/app/(identity)/cuenta/project-creation-panel.module.css','src/lib/identity-return-path.mjs']
 }[kind]||[]);
const ownTemplateDependenciesFor=kind=>({
 UI_INTAKE:['src/app/(identity)/cuenta/own-company-templates-view.mjs'],
 UI_JOINT:['src/app/(identity)/cuenta/own-company-templates-view.mjs'],
 UI_CAUSAL:['src/app/(identity)/cuenta/own-company-templates-view.mjs'],
 UI_PREPARATION:['src/app/(identity)/cuenta/own-company-templates-view.mjs'],
 UI_PORTFOLIO:['src/app/(identity)/cuenta/own-company-templates-view.mjs'],
 UNIT:['src/app/(identity)/cuenta/own-company-templates-view.mjs'],
 UI_BANK:['src/app/(identity)/cuenta/own-company-templates-view.mjs'],
 PG_COMPANY_KYC:['src/lib/meta-own-company-templates.mjs'],
 UI_IDENTITY_ONLY:['src/app/(identity)/cuenta/own-company-templates-panel.js','src/app/(identity)/cuenta/own-company-templates-view.mjs']
 }[kind]||[]);
// Current subscription composition follows the real lib walk and account
// mount. Historical counts, commands and producer receipts remain unchanged.
const COMPANY_SUBSCRIPTION_BACKEND_SOURCES=['src/lib/company-subscription-catalog.mjs','src/lib/company-subscription-http.mjs','src/lib/company-subscription-policy.mjs','src/lib/company-subscription-provider.mjs','src/lib/company-subscription-routing.mjs','src/lib/company-subscription-runtime-config.mjs','src/lib/company-subscription-runtime.mjs','src/lib/company-subscription-store.mjs'];
const COMPANY_SUBSCRIPTION_UI_SOURCES=['src/app/(identity)/cuenta/company-subscription-panel.js','src/app/(identity)/cuenta/company-subscription-panel.module.css','src/app/(identity)/cuenta/company-subscription-view.mjs'];
// The new commercial acceptance is additive to the frozen organization-usage
// and civil source lineages. Their historical counts remain unchanged.
const commercialAcceptanceDependenciesFor=kind=>['PG_COMPANY_KYC','UI_IDENTITY_ONLY'].includes(kind)?['src/lib/company-subscription-catalog.mjs']:[];
const PREVIOUS_COMPANY_BILLING_UI_SOURCES=['src/app/(identity)/cuenta/company-billing-panel.js','src/app/(identity)/cuenta/company-billing-panel.module.css','src/app/(identity)/cuenta/company-billing-view.mjs'];
const COMPANY_SUBSCRIPTION_UI_FIXTURE='scripts/lib/company-subscription-ui-fixture.mjs';
const companySubscriptionBackendDependenciesFor=kind=>kind==='PG_COMPANY_KYC'?COMPANY_SUBSCRIPTION_BACKEND_SOURCES:[];
const companySubscriptionFixtureDependenciesFor=kind=>kind==='UI_IDENTITY_ONLY'?[COMPANY_SUBSCRIPTION_UI_FIXTURE,'src/lib/company-subscription-catalog.mjs']:[];
const companySubscriptionProofDependenciesFor=kind=>kind==='UI_IDENTITY_ONLY'?[...COMPANY_SUBSCRIPTION_UI_SOURCES,...companySubscriptionFixtureDependenciesFor(kind)]:companySubscriptionBackendDependenciesFor(kind);
const TASK_MEASUREMENT_SOURCE='src/lib/task-progress-measurement.js';
const TASK_MEASUREMENT_UI_SOURCES=['src/app/(identity)/cuenta/task-progress-measurement-editor.js','src/app/(identity)/cuenta/task-progress-measurement-editor.module.css','src/app/(identity)/cuenta/task-progress-measurement-view.mjs'];
const taskMeasurementDependenciesFor=kind=>kind==='UI_IDENTITY_ONLY'?[...TASK_MEASUREMENT_UI_SOURCES,TASK_MEASUREMENT_SOURCE]:['PORTFOLIO_UNIT','PG_PORTFOLIO'].includes(kind)?['src/lib/progress-measurement-quantity.js',TASK_MEASUREMENT_SOURCE]:['UNIT','UI_BANK','UI_JOINT','UI_CAUSAL','PG_COMPANY_KYC','PG_FIELD','PG_OVERTIME'].includes(kind)?[TASK_MEASUREMENT_SOURCE]:[];
const currentOwnDependenciesFor=kind=>[...ownCompanyDependenciesFor(kind),...ownTemplateDependenciesFor(kind),...companySubscriptionBackendDependenciesFor(kind),...taskMeasurementDependenciesFor(kind)];
// Current additive intake sources; historical source counts stay unchanged.
const intakeAssignmentDependenciesFor=kind=>kind==='UNIT'?['src/lib/employee-intake-channel-continuity.mjs','tests/production-employee-intake-assignment-continuity.test.mjs']:['PG_INTAKE','UI_BANK','UI_JOINT','UI_CAUSAL','PG_COMPANY_KYC','PG_FIELD','PG_OVERTIME'].includes(kind)?['src/lib/employee-intake-channel-continuity.mjs']:[];
const OWN_TEMPLATE_SOURCE_COUNTS={UNIT:107,UI_BANK:102,PG_COMPANY_KYC:180,UI_IDENTITY_ONLY:109,UI_INTAKE:24,UI_JOINT:102,UI_CAUSAL:102,UI_PREPARATION:16,UI_PORTFOLIO:13};
// Current KYC status closure is additive. The previous CURRENT counts and all
// historical producer records remain immutable; actual closures corroborate it.
const CURRENT_KYC_STATUS_BASE_COUNTS={"UNIT":109,"UI_BANK":104,"UI_JOINT":104,"UI_CAUSAL":104,"PG_COMPANY_KYC":183,"PG_FIELD":99,"PG_OVERTIME":84,"PG_INTAKE":23};
// These additions follow the reviewed producers' current imports. Historical
// counts and producer receipts above stay frozen; omission is still rejected.
const KYC_ATTEMPT_BACKEND_SOURCE='src/lib/participant-kyc-chat-attempt.mjs';
const KYC_ATTEMPT_CLIENT_SOURCES=['src/app/(identity)/cuenta/participant-kyc-chat-attempt-panel.js','src/app/(identity)/cuenta/participant-kyc-chat-attempt-view.mjs'];
const currentKycFeedbackDependenciesFor=kind=>({
 UNIT:[KYC_ATTEMPT_BACKEND_SOURCE],
 UI_BANK:[...KYC_ATTEMPT_CLIENT_SOURCES,KYC_ATTEMPT_BACKEND_SOURCE],
 UI_INTAKE:KYC_ATTEMPT_CLIENT_SOURCES,
 UI_JOINT:[...KYC_ATTEMPT_CLIENT_SOURCES,KYC_ATTEMPT_BACKEND_SOURCE],
 UI_CAUSAL:[...KYC_ATTEMPT_CLIENT_SOURCES,KYC_ATTEMPT_BACKEND_SOURCE],
 PG_COMPANY_KYC:['src/lib/meta-kyc-rejection-policy.mjs','src/lib/meta-kyc-rejection.mjs',KYC_ATTEMPT_BACKEND_SOURCE],
 UI_IDENTITY_ONLY:KYC_ATTEMPT_CLIENT_SOURCES,
 PG_FIELD:[KYC_ATTEMPT_BACKEND_SOURCE],PG_OVERTIME:[KYC_ATTEMPT_BACKEND_SOURCE]
 }[kind]||[]);
const CURRENT_KYC_FEEDBACK_ONLY_BASE_COUNTS={UI_INTAKE:25,UI_IDENTITY_ONLY:114};
const KYC_FEEDBACK_PREVIOUS_PRODUCER_PINS={UI_INTAKE:'07dd870b22df1ea2ae54cb13498bb868bf38f3e26047a0fab6f20c884afa1020',UI_JOINT:'814263fb2ce01f977e404f5e330e2e89aee102d5ad2f20a7c4468608420c94de',UI_CAUSAL:'814263fb2ce01f977e404f5e330e2e89aee102d5ad2f20a7c4468608420c94de'};
// The reply diagnostic follows these actual imports. Earlier KYC closures and
// producer receipts remain frozen; these dependencies only extend CURRENT proofs.
const KYC_REPLY_REJECTION_SOURCES=['src/lib/meta-kyc-rejection-policy.mjs','src/lib/meta-kyc-rejection.mjs'];
const currentKycReplyFeedbackDependenciesFor=kind=>kind==='UNIT'?KYC_REPLY_REJECTION_SOURCES:['UI_BANK','UI_JOINT','UI_CAUSAL','PG_FIELD','PG_OVERTIME'].includes(kind)?['src/lib/meta-kyc-identity.mjs',...KYC_REPLY_REJECTION_SOURCES]:[];
const KYC_REPLY_PREVIOUS_UNIT_PRODUCER_SHA256='a024c6a26dcdfaf01719e51ee450ffe4e0a36b2ba04cb28a95d2eaa4a62e0a75';
// The new read-only WhatsApp paths extend CURRENT execution graphs only. The
// published PR142 path sets remain frozen below, independently of older bases.
const FIELD_REPORT_FEEDBACK_SOURCE='src/lib/field-report-feedback.mjs';
const KYC_CONTEXT_FEEDBACK_SOURCE='src/lib/meta-kyc-context-feedback.mjs';
const KYC_CONTEXT_OUTBOUND_SOURCE='src/lib/meta-kyc-context-outbound.mjs';
const KYC_CONTEXT_NATIVE_HELPER='scripts/lib/kyc-context-feedback-native.mjs';
const currentWhatsappFeedbackDependenciesFor=kind=>kind==='PG_COMPANY_KYC'?[FIELD_REPORT_FEEDBACK_SOURCE,KYC_CONTEXT_FEEDBACK_SOURCE,KYC_CONTEXT_OUTBOUND_SOURCE,KYC_CONTEXT_NATIVE_HELPER]:['UNIT','UI_BANK','UI_JOINT','UI_CAUSAL','PG_FIELD','PG_OVERTIME'].includes(kind)?[FIELD_REPORT_FEEDBACK_SOURCE]:[];
export const WHATSAPP_FEEDBACK_PREVIOUS_SOURCE_COUNTS=Object.freeze({UNIT:131,UI_BANK:132,UI_JOINT:134,UI_CAUSAL:134,PG_COMPANY_KYC:216,PG_FIELD:120,PG_OVERTIME:105});
const WHATSAPP_FEEDBACK_PREVIOUS_PATHS_SHA256=Object.freeze({UNIT:'b0d7794135c4ce3fe63fa5afe32a80eac8e71018df832d912980fd4650399f47',UI_BANK:'907d7169c4cd8925f97e26b04f0cd98962052394bfdc53b0c41425ceb556debc',UI_JOINT:'8f4c9570bbe628025476dba3a69cab9d97e52b2b2a6cf809b95b8a102551e1ec',UI_CAUSAL:'8f4c9570bbe628025476dba3a69cab9d97e52b2b2a6cf809b95b8a102551e1ec',PG_COMPANY_KYC:'59e04b75c7e14d785562869dea526db64273dc488c84882fee897ac6f4eb03a3',PG_FIELD:'4f1db7b51c2694e6e175309d039d80d2dbf211d4f0677ac85492533e4ef89073',PG_OVERTIME:'78f45233dbc7c8adca07f637054dfd5191612af27bc399c40aa4c9f5e9fc1c3e'});
const WHATSAPP_FEEDBACK_PREVIOUS_COMPANY_CHECKS_SHA256='cca2d12d4788581a1a1dc6774f5dc885c1cedb766b0dd275337cfb40d27f881c';
const COMPANY_KYC_CONTEXT_CHECK_SUFFIXES=Object.freeze(['-context-native-old-signed-source-concurrent-single-outbox-HTTP-no-capture-writes','-context-native-neutral-ESTADO-IDENTIDAD-no-consent-or-private-media','-context-native-current-issuer-revocation-no-HTTP-no-media','-context-native-processor-pre-dispatch-no-capture-or-replay','-context-native-original-60s-lease-225ms-SQL-200ms-Graph-single-POST']);
const currentKycStatusDependenciesFor=kind=>[...({"UNIT":["src/lib/participant-onboarding-current-kyc.mjs"],"UI_BANK":["src/lib/participant-onboarding-current-kyc.mjs"],"UI_JOINT":["src/lib/participant-onboarding-current-kyc.mjs"],"UI_CAUSAL":["src/lib/participant-onboarding-current-kyc.mjs"],"PG_COMPANY_KYC":["src/lib/participant-onboarding-current-kyc.mjs"],"PG_FIELD":["src/lib/participant-onboarding-current-kyc.mjs"],"PG_OVERTIME":["src/lib/participant-onboarding-current-kyc.mjs"],"PG_INTAKE":["src/lib/company-channel-kyc.mjs","src/lib/participant-onboarding-authority.mjs","src/lib/participant-onboarding-current-kyc.mjs","src/lib/participant-onboarding-reactive.mjs"]}[kind]||[]),...currentKycFeedbackDependenciesFor(kind),...currentKycReplyFeedbackDependenciesFor(kind),...currentWhatsappFeedbackDependenciesFor(kind)];
// Additive v3/v4 sources do not replace the historical counts or producer records.
const MONTHLY_CURVE_DEPENDENCIES={PG_COMPANY_KYC:['src/lib/plan-import-monthly-curve.mjs','src/lib/plan-import-cyp-curve.mjs'],UI_IDENTITY_ONLY:['src/app/(identity)/cuenta/plan-source-curve.js','src/app/(identity)/cuenta/plan-source-curve.mjs','src/app/(identity)/cuenta/plan-source-curve.module.css']};
const monthlyCurveDependenciesFor=kind=>MONTHLY_CURVE_DEPENDENCIES[kind]||[];
const CALENDAR_PREPARATION_SOURCE='src/app/(identity)/cuenta/plan-import-calendar-suggestions.mjs';
const CALENDAR_PREPARATION_DEPENDENCIES={UI_IDENTITY_ONLY:[CALENDAR_PREPARATION_SOURCE]};
const CALENDAR_PREPARATION_PREVIOUS_SOURCE_COUNTS={UI_IDENTITY_ONLY:116};
const calendarPreparationDependenciesFor=kind=>CALENDAR_PREPARATION_DEPENDENCIES[kind]||[];
const WHATSAPP_PLAN_IMPORT_SHARED_DEPENDENCIES=['src/lib/meta-plan-import-conversation.mjs','src/lib/meta-plan-import-origin.mjs','src/lib/meta-plan-import-transport.mjs','src/lib/plan-import-cyp-curve.mjs','src/lib/plan-import-monthly-curve.mjs','src/lib/plan-import-ooxml.mjs','src/lib/plan-import-policy.mjs','src/lib/plan-import-store.mjs'];
const WHATSAPP_PLAN_IMPORT_DEPENDENCIES={UNIT:WHATSAPP_PLAN_IMPORT_SHARED_DEPENDENCIES,UI_BANK:WHATSAPP_PLAN_IMPORT_SHARED_DEPENDENCIES,UI_JOINT:WHATSAPP_PLAN_IMPORT_SHARED_DEPENDENCIES,UI_CAUSAL:WHATSAPP_PLAN_IMPORT_SHARED_DEPENDENCIES,PG_FIELD:WHATSAPP_PLAN_IMPORT_SHARED_DEPENDENCIES,PG_OVERTIME:WHATSAPP_PLAN_IMPORT_SHARED_DEPENDENCIES,PG_COMPANY_KYC:['src/lib/meta-plan-import-conversation.mjs','src/lib/meta-plan-import-origin.mjs','src/lib/meta-plan-import-recovery.mjs','src/lib/meta-plan-import-transport.mjs']};
const WHATSAPP_PLAN_IMPORT_PREVIOUS_SOURCE_COUNTS={UNIT:111,UI_BANK:108,UI_JOINT:108,UI_CAUSAL:108,PG_COMPANY_KYC:187,PG_FIELD:101,PG_OVERTIME:86};
const WHATSAPP_PLAN_IMPORT_PRE_DOCUMENT_TEST_FILES=['tests/production-meta-plan-import-conversation.test.mjs','tests/production-meta-plan-source-provider.test.mjs','tests/production-meta-plan-import-transport.test.mjs','tests/production-plan-import-link-ui.test.mjs'];
const WHATSAPP_PLAN_IMPORT_TEST_FILES=[...WHATSAPP_PLAN_IMPORT_PRE_DOCUMENT_TEST_FILES,'tests/production-meta-plan-document-curve.test.mjs'];
const WHATSAPP_PLAN_IMPORT_TEST_SOURCE_PATHS=[...WHATSAPP_PLAN_IMPORT_TEST_FILES,'tests/fixtures/meta-plan-import-transport-synthetic.mjs','tests/fixtures/own-company-runtime.mjs','tests/fixtures/plan-import-document-curve-synthetic.mjs'];
const EXPIRY_FEEDBACK_PREVIOUS_OWN_RUNTIME_FIXTURE_SHA256='6e734325c36db9e9d957699632a9b5b6d551cd22533a26eff8f55d388a3d92aa';
const SCHEDULE_READ_PREVIOUS_PLAN_TRANSPORT_TEST_SHA256='5d7b26ad5f9c4ee980c4a47774919b525cd16dbe63df405a8e87abd98d6f3cee';
const WHATSAPP_PLAN_IMPORT_LINT_SOURCES=['src/lib/meta-plan-import-*.mjs',...WHATSAPP_PLAN_IMPORT_TEST_FILES,'tests/fixtures/meta-plan-import-transport-synthetic.mjs'];
const whatsappPlanImportDependenciesFor=kind=>WHATSAPP_PLAN_IMPORT_DEPENDENCIES[kind]||[];
// These CURRENT additions follow the actual plan/analyzer and account graphs.
// Earlier source counts and serialized producer receipts remain immutable.
const ORGANIZATION_USAGE_POLICY_SOURCE='src/lib/organization-usage-policy.mjs';
const ORGANIZATION_USAGE_BACKEND_SOURCES=[ORGANIZATION_USAGE_POLICY_SOURCE,'src/lib/organization-usage-store.mjs','src/lib/organization-usage-http.mjs','src/lib/organization-usage-runtime.mjs'];
const ORGANIZATION_USAGE_UI_SOURCES=['src/app/(identity)/cuenta/company-usage-panel.js','src/app/(identity)/cuenta/company-usage-view.mjs','src/app/(identity)/cuenta/plan-import-usage-view.mjs'];
// Resource accounting extends the reviewed runtime and account graphs. These
// additions never replace the previous usage counts or historical producer pins.
const ORGANIZATION_RESOURCE_USAGE_POLICY_SOURCE='src/lib/organization-resource-usage-policy.mjs';
const PARTICIPANT_OCR_USAGE_SOURCE='src/app/(identity)/cuenta/participant-ocr-usage-view.mjs';
const FIELD_MEDIA_HELD_SOURCE='src/app/(identity)/cuenta/field-media-held-view.mjs';
const resourceUsageDependenciesFor=kind=>kind==='PG_COMPANY_KYC'?[ORGANIZATION_RESOURCE_USAGE_POLICY_SOURCE,'src/lib/organization-resource-usage-store.mjs']:kind==='UI_IDENTITY_ONLY'?[PARTICIPANT_OCR_USAGE_SOURCE,FIELD_MEDIA_HELD_SOURCE]:kind==='UI_INTAKE'?[PARTICIPANT_OCR_USAGE_SOURCE]:['UI_BANK','UI_JOINT','UI_CAUSAL'].includes(kind)?[ORGANIZATION_RESOURCE_USAGE_POLICY_SOURCE,PARTICIPANT_OCR_USAGE_SOURCE]:['UNIT','PG_FIELD','PG_OVERTIME'].includes(kind)?[ORGANIZATION_RESOURCE_USAGE_POLICY_SOURCE]:[];
const ORGANIZATION_USAGE_PREVIOUS_SOURCE_COUNTS={UNIT:122,UI_BANK:120,UI_INTAKE:27,UI_JOINT:120,UI_CAUSAL:120,PG_COMPANY_KYC:199,PG_FIELD:113,PG_OVERTIME:98,UI_IDENTITY_ONLY:122};
const organizationUsageDependenciesFor=kind=>[...(kind==='PG_COMPANY_KYC'?ORGANIZATION_USAGE_BACKEND_SOURCES:kind==='UI_IDENTITY_ONLY'?ORGANIZATION_USAGE_UI_SOURCES:['UNIT','UI_BANK','UI_JOINT','UI_CAUSAL','PG_FIELD','PG_OVERTIME'].includes(kind)?[ORGANIZATION_USAGE_POLICY_SOURCE]:[]),...resourceUsageDependenciesFor(kind)];
const RESOURCE_USAGE_PREVIOUS_PRODUCER_PINS={UI_INTAKE:'c26662f73153290bf7def41b6fe5fa6d3a976f0833b01f58e4000a32b306d1da',UI_JOINT:'059187f68012fb621e3e099b78d5190ab4dadb0029536f00fd935808de7e642c',UI_CAUSAL:'059187f68012fb621e3e099b78d5190ab4dadb0029536f00fd935808de7e642c'};
// The joint producer records the executed causal transform helper. Its source
// is additive to CURRENT proofs; every earlier source count remains frozen.
const INTAKE_CAUSAL_FIXTURE_SOURCE='scripts/lib/participant-bank-intake-fixture.mjs';
const proofFixtureDependenciesFor=kind=>['UI_JOINT','UI_CAUSAL'].includes(kind)?[INTAKE_CAUSAL_FIXTURE_SOURCE]:[];
const INTAKE_CAUSAL_FIXTURE_PREVIOUS_PRODUCER_SHA256='457f06d73435ccdac3a45e8b304f04973c5d0ac1dfc1706ae1b940539b93f94b';
// CURRENT civil-data imports extend the reviewed browser and participant-store
// graphs. Earlier counts and serialized producer receipts remain immutable.
const CIVIL_BACKEND_SOURCES=['src/lib/bindx-civil-data-client.mjs','src/lib/participant-civil-policy.mjs','src/lib/participant-civil-store.mjs'];
const CIVIL_UI_SOURCES=['src/app/(identity)/cuenta/participant-civil-data-panel.js','src/app/(identity)/cuenta/participant-civil-data-view.mjs'];
const civilDataDependenciesFor=kind=>['UI_BANK','UI_JOINT','UI_CAUSAL'].includes(kind)?[...CIVIL_BACKEND_SOURCES,...CIVIL_UI_SOURCES]:['UI_INTAKE','UI_IDENTITY_ONLY'].includes(kind)?CIVIL_UI_SOURCES:['UNIT','PG_BANK','PG_INTAKE','PG_COMPANY_KYC','PG_FIELD','PG_OVERTIME'].includes(kind)?CIVIL_BACKEND_SOURCES:[];
const CIVIL_PREVIOUS_SOURCE_COUNTS={UNIT:124,PG_BANK:13,PG_INTAKE:27,UI_BANK:123,UI_INTAKE:28,UI_JOINT:124,UI_CAUSAL:124,PG_COMPANY_KYC:205,UI_IDENTITY_ONLY:127,PG_FIELD:115,PG_OVERTIME:100};
const CIVIL_PREVIOUS_PRODUCER_PINS={PG_BANK:'9e074c88eb911a8c39c84275447cb28005ea0b045615d452ca0d7ae742dca243',PG_INTAKE:'d89c154157a12880dc7395cec783dfd52e703ed3a2ddf8b72a3a7882ff5069b0',UI_INTAKE:'6b4b5a5050dffba671a24958ae3f2e8c503a6bea2146a97e07f77500400da6c6',UI_JOINT:'4b7fb30829d45f788322a6871d116ef6005f93064b854c8ff783a462e83c9553',UI_CAUSAL:'4b7fb30829d45f788322a6871d116ef6005f93064b854c8ff783a462e83c9553'};
const PRIVATE_BANK_PG_BASELINE_PRODUCER={producer:'scripts/verify-private-bank-account-postgres.mjs',path:'.vercel/private-bank-evidence/postgres.json',retained:true,blockId:54,lane:'people',sourceLine:49,producerSha256:CIVIL_PREVIOUS_PRODUCER_PINS.PG_BANK,sourceBasis:'EXPECTED_HEAD_GIT_BYTES'};
const CIVIL_CURRENT_BANK_LOCK='locked={busy||Boolean(attempt)||Boolean(durableReference)||!recoveryReady||Boolean(draft)||intakePending||civilPending}';
const CIVIL_CURRENT_CAUSAL_BANK_LOCK='locked={busy||Boolean(attempt)||Boolean(durableReference)||!recoveryReady||Boolean(draft)||intakePending||civilPending||hasBankPending}';
const ORGANIZATION_USAGE_PREVIOUS_TRANSPORT_FIXTURE_SHA256='9e2cdcc22b34d465486a74b831acc48ddab179729989d553c9c074234c1bdf29';
const ORGANIZATION_USAGE_PREVIOUS_LINK_TEST_SHA256='c9d790f1ff67010374cc84a431ab68ddeaf7770da2b5e1de41e4e593265458fc';
// The 209-source producer at 2d25721 stays a historical declared corpus. The
// initial expiry working tree declared 210, but omitted a pre-existing import
// from participant-bank-format. Current proofs pin both distinct additions.
const COMPANY_KYC_EXPIRY_PREVIOUS_SOURCE_COUNTS=Object.freeze({PG_COMPANY_KYC:209});
const COMPANY_KYC_EXPIRY_PREVIOUS_SOURCE_PATHS_SHA256='1d1c1a1d88656c169275a0c98c9e5161d8b6e2c609b959d03d60d3b14b94d946';
const COMPANY_KYC_EXPIRY_PREVIOUS_PRODUCER_SHA256='16b162181c10751f219140725fed55c56a5042bbf1e8e1b4ae938933713ce747';
const COMPANY_KYC_EXPIRY_PREVIOUS_CHECK_NAMES_SHA256='0359d9929ec05660d0f93ecc25b0b4342baa44de1ff6e3bda83b11a9aec66d39';
const COMPANY_KYC_EXPIRY_PREVIOUS_CHECK_COUNT=10;
const COMPANY_KYC_EXPIRY_NATIVE_CHECK_COUNT=3;
const COMPANY_KYC_EXPIRY_SOURCE='src/lib/meta-kyc-expiry-feedback.mjs';
const COMPANY_KYC_FORMAT_CLOSURE_SOURCE='src/app/(identity)/cuenta/private-bank-account-format.mjs';
const companyKycCurrentSourceClosureDependenciesFor=kind=>kind==='PG_COMPANY_KYC'?[COMPANY_KYC_EXPIRY_SOURCE,COMPANY_KYC_FORMAT_CLOSURE_SOURCE]:[];
// Only CURRENT execution graphs gain these paths. Earlier corpus counts and
// historical receipts remain immutable and cannot stand in for the new proof.
const DOCUMENT_CURVE_UI_ARTIFACTS=['.vercel/private/plan-document-curve-evidence/'];
const DOCUMENT_CURVE_UI_PRODUCER='scripts/verify-plan-document-curve-ui.mjs';
const DOCUMENT_CURVE_UI_RENDER_ROOTS=['src/app/(identity)/cuenta/plan-import-panel.js','src/app/(identity)/cuenta/plan-baseline-panel.js'];
const DOCUMENT_CURVE_UI_FIXTURE_ROOT='scripts/lib/plan-document-curve-ui-fixture.mjs';
const DOCUMENT_CURVE_UI_CHECKS=[320,390,1280].map(width=>'document-review-apply-explicit-baseline:'+width).concat(['amount-only-exact-money-and-gaps','inconsistent-review-blocks-apply','site-manager-tasks-only','lost-apply-ack-reload-get-only','unknown-upload-reload-get-only','crossed-source-hides-private-result','scope-change-purges-private-review']);
const DOCUMENT_CURVE_UI_STEP={name:'Document monthly curve explicit review and isolated browser receipts',run:'npx eslint scripts/verify-plan-document-curve-ui.mjs scripts/lib/plan-document-curve-ui-fixture.mjs scripts/lib/plan-document-curve-fixture-copy.mjs tests/production-plan-document-curve*.test.mjs tests/production-plan-import-document-curve*.test.mjs tests/fixtures/plan-import-document-curve-synthetic.mjs --max-warnings 0\nnode --test tests/production-plan-document-curve*.test.mjs\nnode scripts/verify-plan-document-curve-ui.mjs --expected-head "$GITHUB_SHA" .vercel/private/plan-document-curve-evidence/current-browser.json\n'};
const PLAN_BASELINE_ARTIFACTS=['.vercel/private/approved-plan-baseline-evidence/'];
const PLAN_BASELINE_SOURCE_ROOTS=['scripts/verify-plan-baseline-postgres.mjs','tests/production-plan-baseline-postgres-target.test.mjs','src/app/api/identity/plan-baseline/route.js'];
const PLAN_BASELINE_UI_SOURCES=['src/app/(identity)/cuenta/plan-baseline-panel.js','src/app/(identity)/cuenta/plan-baseline-view.mjs','src/app/(identity)/cuenta/plan-baseline.module.css'];
const PLAN_BASELINE_BACKEND_SOURCES=['src/lib/plan-baseline-http.mjs','src/lib/plan-baseline-policy.mjs','src/lib/plan-baseline-runtime.mjs','src/lib/plan-baseline-store.mjs'];
const PLAN_BASELINE_PRE_DOCUMENT_CHECKS=['real-local-OOXML-APPLIED-receipts-no-automatic-baseline','explicit-HTTP-selection-preserves-original-financial-curve','native-held-Project-lock-blocks-selection-before-CAS','concurrent-same-operation-one-immutable-selection','concurrent-stale-CAS-one-winner-one-audited-rejection','replacement-old-replay-original-snapshot-no-reactivation','actual-COMMIT-lost-ACK-recovers-durable-selection','actual-ROLLBACK-remains-uncertain-same-operation-retry','active-write-failure-rolls-back-selection-receipt','current-role-membership-project-tenant-scope-deny-private-data','tampered-active-pointer-APPLY-receipt-and-source-fail-closed','native-candidate-pagination-bound-to-current-project-scope','all-selection-reads-preserve-Tasks-imports-and-original-curve'];
const PLAN_BASELINE_PRE_DOCUMENT_PRODUCER_SHA256='eb93f212a94b2ea0de4476d529035fa7cd5565e4468ba09c210c2864a89afd57';
const PLAN_BASELINE_PRE_DOCUMENT_SOURCE_PATHS_SHA256='5019ab4a0ed40629c935e4c8fbd29daa06e2881402f61597a983ff2940a37874';
const PLAN_BASELINE_DOCUMENT_CHECKS=["document-reviewed-APPLY-curve-zero-Task-SQL-no-automatic-baseline-explicit-SELECT", "document-native-selection-COMMIT-ACK-ROLLBACK-same-UUID-current-financial-authority", "document-original-review-APPLY-receipt-source-tamper-fail-closed-Task-state-preserved"];
const PLAN_BASELINE_CHECKS=[...PLAN_BASELINE_PRE_DOCUMENT_CHECKS,...PLAN_BASELINE_DOCUMENT_CHECKS];
const PLAN_BASELINE_STEP={name:'Approved plan baseline explicit selection and native receipts',run:"npx eslint src/lib/plan-baseline-*.mjs src/app/api/identity/plan-baseline/route.js 'src/app/(identity)/cuenta/plan-baseline-panel.js' 'src/app/(identity)/cuenta/plan-baseline-view.mjs' scripts/verify-plan-baseline-postgres.mjs tests/production-plan-baseline*.test.mjs tests/fixtures/plan-baseline-synthetic.mjs --max-warnings 0\nnode --test tests/production-plan-baseline*.test.mjs\nnode scripts/verify-plan-baseline-postgres.mjs\n"};
const PLAN_BASELINE_PREVIOUS_SOURCE_COUNTS=Object.freeze({UNIT:127,UI_BANK:128,UI_INTAKE:30,UI_JOINT:129,UI_CAUSAL:129,PG_COMPANY_KYC:211,UI_IDENTITY_ONLY:130,UI_PREPARATION:17,UI_PORTFOLIO:14});
const PLAN_BASELINE_PREVIOUS_SOURCE_PATHS_SHA256=Object.freeze({UNIT:'8e7a814017d2679731a74dfb3019619d6070baab91a5826727c731b05572e916',UI_BANK:'b2a89ed5a958c5ca486afad583282ab7695d7ddd143ebf19519673ff2bef8323',UI_INTAKE:'6820b9ea36b655044e95ff600dabf08e4c31999ee16ab6801edeae47b8a12da1',UI_JOINT:'1d1fad5f683060aee4daf7c56a97fdc848c6607f4e5e3e49a1487ff486fb650a',UI_CAUSAL:'1d1fad5f683060aee4daf7c56a97fdc848c6607f4e5e3e49a1487ff486fb650a',PG_COMPANY_KYC:'aa926760b024fb845e3b7fd0ad2b33e8118fd933a2d625d9385f79867849bb0b',UI_PREPARATION:'62736873de8e198281300291a2ede3e275e2b12531e4d95aa471645f4a5f0d58',UI_PORTFOLIO:'854a2ea5fbf384dbd1f914091f2c64e5c4fa60b33393ee9c1cb1fcf9e162a043',UI_IDENTITY_ONLY:'9922788f54cc14778c027ca2322bcd5aa7f9f3d45433fe08268e3020b090fa75'});
const historicalPlanBaselineDependenciesFor=kind=>kind==='PG_COMPANY_KYC'?PLAN_BASELINE_BACKEND_SOURCES:kind==='UI_IDENTITY_ONLY'?PLAN_BASELINE_UI_SOURCES:['UNIT','UI_BANK','UI_INTAKE','UI_JOINT','UI_CAUSAL','UI_PREPARATION','UI_PORTFOLIO'].includes(kind)?[PLAN_BASELINE_UI_SOURCES[1],'src/app/(identity)/cuenta/plan-source-curve.mjs']:[];
const DOCUMENT_CURVE_SOURCE='src/lib/plan-import-document-curve.mjs';
const DOCUMENT_CURVE_COPY_HELPER='scripts/lib/plan-document-curve-fixture-copy.mjs';
const DOCUMENT_CURVE_CURRENT_DEPENDENCIES=Object.freeze({UNIT:['src/lib/plan-baseline-policy.mjs',DOCUMENT_CURVE_SOURCE],UI_BANK:['src/lib/plan-baseline-policy.mjs',DOCUMENT_CURVE_SOURCE],UI_JOINT:['src/lib/plan-baseline-policy.mjs',DOCUMENT_CURVE_SOURCE,DOCUMENT_CURVE_COPY_HELPER],UI_CAUSAL:['src/lib/plan-baseline-policy.mjs',DOCUMENT_CURVE_SOURCE,DOCUMENT_CURVE_COPY_HELPER],PG_FIELD:['src/lib/plan-baseline-policy.mjs',DOCUMENT_CURVE_SOURCE],PG_OVERTIME:['src/lib/plan-baseline-policy.mjs',DOCUMENT_CURVE_SOURCE],PG_COMPANY_KYC:[DOCUMENT_CURVE_SOURCE],UI_IDENTITY_ONLY:[DOCUMENT_CURVE_SOURCE],UI_INTAKE:[DOCUMENT_CURVE_COPY_HELPER,DOCUMENT_CURVE_SOURCE],UI_PREPARATION:[DOCUMENT_CURVE_COPY_HELPER,DOCUMENT_CURVE_SOURCE],UI_PORTFOLIO:[DOCUMENT_CURVE_COPY_HELPER,DOCUMENT_CURVE_SOURCE]});
// The 133-reference corpus and producer before the physical joint relocation remain immutable.
const JOINT_DOCUMENT_RELOCATION_PREVIOUS_COUNT=133;
const JOINT_DOCUMENT_RELOCATION_PREVIOUS_PATHS_SHA256='f466331c42ff59d238f01523214aa60b4a6872f7cbf7ff0c7574b2fe0de18f7b';
const JOINT_DOCUMENT_RELOCATION_PREVIOUS_PRODUCER_SHA256='5785f9d5e9f3a4e8c329ccba804ab6fe453308b6ccfeaa1e60f26720259c10cd';
const documentCurveDependenciesFor=kind=>DOCUMENT_CURVE_CURRENT_DEPENDENCIES[kind]||[];
const planBaselineDependenciesFor=kind=>[...historicalPlanBaselineDependenciesFor(kind),...documentCurveDependenciesFor(kind)];
const DOCUMENT_CURVE_PREVIOUS_CURRENT_COUNTS=Object.freeze({"UNIT":129,"UI_BANK":130,"UI_INTAKE":32,"UI_JOINT":131,"UI_CAUSAL":131,"PG_COMPANY_KYC":215,"UI_PREPARATION":19,"UI_PORTFOLIO":16,"UI_IDENTITY_ONLY":133,"PG_FIELD":118,"PG_OVERTIME":103,"PG_PLAN_BASELINE":31});
const DOCUMENT_CURVE_PREVIOUS_CURRENT_PATHS_SHA256=Object.freeze({"UNIT":"b2d760e7259afe2049c69cf6de0a450fe8916c46d20747b7849949fa60c4b10a","UI_BANK":"946b6b1876c9902e19bc41bdfdcb1f239d68d695694a36abea3593444fe0f8ea","UI_INTAKE":"5ae6b49d52ab92af2b8eea6ec760a86fb560466979a72262fdba2a4c78e20038","UI_JOINT":"59096c7613b5cc115105fbec0e3901b1e06152067fc87162067247c3d65f875f","UI_CAUSAL":"59096c7613b5cc115105fbec0e3901b1e06152067fc87162067247c3d65f875f","PG_COMPANY_KYC":"9eecaa9ee4331ea4b1096554079ecc1c9d43e096761d0562eacbceff8b44b449","UI_PREPARATION":"65d8305627e1151b972ee8006b16ff193f7a44f91a30b3d0664c88d8d70143b0","UI_PORTFOLIO":"e648d14573a14a695cb83a253ba7e88514494b9123027dd97dcbbba9d8090d75","UI_IDENTITY_ONLY":"f614157f9c9f8978a1b16672ee628d2352ed99c4d02f7ba14075ca4c9d7a1b76","PG_FIELD":"bb7be8d80fb21a83ad7559caf186933b77ebd11bce8fb513a134533083a4dd6b","PG_OVERTIME":"24b300e5c0b887aeb1f9ea0451c7b7ac138a7f2b492a3defdcabed75ffe36c90","PG_PLAN_BASELINE":"5019ab4a0ed40629c935e4c8fbd29daa06e2881402f61597a983ff2940a37874"});
const currentPlanDependenciesFor=kind=>[...monthlyCurveDependenciesFor(kind),...calendarPreparationDependenciesFor(kind),...whatsappPlanImportDependenciesFor(kind),...organizationUsageDependenciesFor(kind),...proofFixtureDependenciesFor(kind),...civilDataDependenciesFor(kind),...companyKycCurrentSourceClosureDependenciesFor(kind),...planBaselineDependenciesFor(kind),...planMeasurementCurrentDependencies(kind)];
// Current verified office sources are additive; frozen historical records remain unchanged.
const VERIFIED_OFFICE_DEPENDENCIES={"UNIT":["src/app/(identity)/cuenta/participant-office-account-view.mjs","src/lib/participant-verified-office.mjs"],"UI_BANK":["src/app/(identity)/cuenta/participant-office-account-view.mjs","src/lib/participant-verified-office.mjs"],"UI_INTAKE":["src/app/(identity)/cuenta/participant-office-account-view.mjs"],"UI_JOINT":["src/app/(identity)/cuenta/participant-office-account-view.mjs","src/lib/participant-verified-office.mjs"],"UI_CAUSAL":["src/app/(identity)/cuenta/participant-office-account-view.mjs","src/lib/participant-verified-office.mjs"],"PG_COMPANY_KYC":["src/lib/participant-verified-office.mjs"],"UI_PREPARATION":["src/app/(identity)/cuenta/participant-office-account-view.mjs"],"UI_PORTFOLIO":["src/app/(identity)/cuenta/participant-office-account-view.mjs"],"UI_IDENTITY_ONLY":["src/app/(identity)/cuenta/participant-office-account-view.mjs","src/lib/participant-verified-office.mjs"],"PG_FIELD":["src/lib/participant-verified-office.mjs"],"PG_OVERTIME":["src/lib/participant-verified-office.mjs"]};
const officeAccountDependenciesFor=kind=>VERIFIED_OFFICE_DEPENDENCIES[kind]||[];
const currentOwnTemplateSourceCount=(kind,spec)=>OWN_TEMPLATE_SOURCE_COUNTS[kind]+currentPlanDependenciesFor(kind).length+officeAccountDependenciesFor(kind).length+currentKycStatusDependenciesFor(kind).length+companySubscriptionBackendDependenciesFor(kind).length+companySubscriptionFixtureDependenciesFor(kind).length+taskMeasurementDependenciesFor(kind).length+participantPreanalysisProofSourceAdditions(spec).length;
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
 ['overtime-canonical-postgres','field',52,'.vercel/private/field-overtime-postgres-proof.json','PG_OVERTIME'],
 ['plan-baseline-postgres','plans',61,'.vercel/private/approved-plan-baseline-evidence/postgres.json','PG_PLAN_BASELINE'],
 ['document-curve-ui','plans',62,'.vercel/private/plan-document-curve-evidence/current-browser.json','UI_DOCUMENT_CURVE']
];
function sourcePath(value){if(typeof value!=='string'||value.length>500||/[\\\x00-\x1f]/.test(value)||value.startsWith('/')||value.split('/').some(part=>!part||part==='.'||part==='..'))deny('UNSAFE_SOURCE_PATH');return value;}
function gitSource(root,expectedHead){
 if(!head(expectedHead))deny('EXPECTED_HEAD_INVALID');
 const committed=new Set(execFileSync('git',['ls-tree','-r','--name-only','-z',expectedHead],{cwd:root,maxBuffer:8*1024*1024}).toString('utf8').split('\0').filter(Boolean)),cache=new Map();
 return filename=>{
  sourcePath(filename);if(!committed.has(filename))return null;
  if(!cache.has(filename)){
   const object=expectedHead+':'+filename;let maxBuffer=8*1024*1024,metadataSize=null;
   // Only this literal metadata object has a separate, explicitly bounded transport.
   // Both commands address the same immutable commit:path; UI text limits are separate.
   if(filename==='.github/workspace-acceptance-contract.json'){
    const output=execFileSync('git',['cat-file','-s',object],{cwd:root,maxBuffer:128,windowsHide:true}).toString('utf8');
    if(!/^(?:0|[1-9][0-9]*)\n$/.test(output))deny('GIT_SOURCE_METADATA_SIZE');
    metadataSize=Number(output.slice(0,-1));if(!Number.isSafeInteger(metadataSize)||metadataSize>16*1024*1024)deny('GIT_SOURCE_METADATA_SIZE');maxBuffer=Math.max(1,metadataSize);
   }
   const value=execFileSync('git',['show',object],{cwd:root,maxBuffer});
   if(metadataSize!==null){if(!Buffer.isBuffer(value)||value.length!==metadataSize)deny('GIT_SOURCE_METADATA_LENGTH');if(!value.equals(Buffer.from(value.toString('utf8'))))deny('GIT_SOURCE_METADATA_UTF8');}
   cache.set(filename,value);
  }
  return cache.get(filename);
 };
}
function gitSourceReaderSelftest(){
 const checks=[],root='/owned-git-reader-unit-fixture',revision='a'.repeat(40),known='src/app/(identity)/cuenta/workspace-request-lifecycle.mjs',missing='src/app/(identity)/cuenta/workspace-request-lifecycle';
 const unit=(name,run)=>{run();checks.push({name:'git-source-reader-'+name,result:'PASS',boundary:'pure gitSource function with closed Git stub; no filesystem, source authority or CI acceptance'});};
 const fixture=(settings={})=>{
  const calls=[],stored=Buffer.from('owned synthetic source bytes\n'),inventory=Buffer.from(known+'\0');
  const closedExec=(command,args,options)=>{
   assert.equal(command,'git');assert.equal(options.cwd,root);assert.equal(options.maxBuffer,8*1024*1024);assert.ok(Array.isArray(args));calls.push(args[0]);
   if(args[0]==='ls-tree'){assert.equal(args.length,5);assert.equal(args[1],'-r');assert.equal(args[2],'--name-only');assert.equal(args[3],'-z');assert.equal(args[4],revision);if(settings.listError)throw settings.listError;return inventory;}
   assert.equal(args[0],'show');assert.equal(args.length,2);assert.equal(args[1],revision+':'+known);if(settings.showError)throw settings.showError;return stored;
  };
  // The function under test is the real current lexical binding. Only its Git
  // process boundary is replaced; path/head rejection functions remain real.
  const create=runInNewContext('('+gitSource.toString()+')',{head,sourcePath,deny,Map,Set,Buffer,execFileSync:closedExec},{timeout:1000});return {create,calls,stored};
 };
 unit('confirmed-absent-without-show',()=>{const f=fixture(),reader=f.create(root,revision);assert.equal(reader(missing),null);assert.deepEqual(f.calls,['ls-tree']);});
 unit('known-bytes-and-existing-cache',()=>{const f=fixture(),reader=f.create(root,revision);assert.equal(reader(known),f.stored);assert.equal(reader(known),f.stored);assert.deepEqual(f.calls,['ls-tree','show']);});
 unit('unsafe-source-path-rejected',()=>{const f=fixture(),reader=f.create(root,revision);for(const file of ['../source.mjs','/source.mjs','src\\source.mjs','src//source.mjs','src/./source.mjs','src/../source.mjs','src/\nsource.mjs','x'.repeat(501),''])assert.throws(()=>reader(file),error=>error.code==='UNSAFE_SOURCE_PATH');assert.deepEqual(f.calls,['ls-tree']);});
 unit('invalid-head-before-git',()=>{const f=fixture();assert.throws(()=>f.create(root,'not-a-commit'),error=>error.code==='EXPECTED_HEAD_INVALID');assert.deepEqual(f.calls,[]);});
 unit('inventory-git-error-propagates',()=>{const sentinel=Object.assign(new Error('GIT_LIST_SENTINEL'),{code:'GIT_LIST_SENTINEL'}),f=fixture({listError:sentinel});assert.throws(()=>f.create(root,revision),error=>error===sentinel);assert.deepEqual(f.calls,['ls-tree']);});
 unit('known-path-git-error-propagates',()=>{const sentinel=Object.assign(new Error('GIT_SHOW_SENTINEL'),{code:'GIT_SHOW_SENTINEL'}),f=fixture({showError:sentinel}),reader=f.create(root,revision);assert.throws(()=>reader(known),error=>error===sentinel);assert.throws(()=>reader(known),error=>error===sentinel);assert.deepEqual(f.calls,['ls-tree','show','show']);});

 // Additional closed transport controls. The six existing reader controls above
 // keep their original names and assertions; none is a source-authority claim.
 const metadataFile='.github/workspace-acceptance-contract.json';
 const metadataFixture=(settings={})=>{
  const file=settings.file??metadataFile,calls=[],stored=settings.stored??Buffer.from('{"synthetic":true}\n');
  const closedExec=(command,args,options)=>{
   assert.equal(command,'git');assert.equal(options.cwd,root);calls.push(args[0]);
   if(args[0]==='ls-tree'){assert.deepEqual(Array.from(args),['ls-tree','-r','--name-only','-z',revision]);assert.equal(options.maxBuffer,8*1024*1024);return Buffer.from(file+'\0');}
   if(args[0]==='cat-file'){assert.equal(file,metadataFile);assert.deepEqual(Array.from(args),['cat-file','-s',revision+':'+file]);assert.equal(options.maxBuffer,128);if(settings.sizeError)throw settings.sizeError;return Buffer.from(settings.sizeText??String(settings.declaredSize??stored.length)+'\n');}
   assert.deepEqual(Array.from(args),['show',revision+':'+file]);assert.equal(options.maxBuffer,file===metadataFile?Math.max(1,settings.declaredSize??stored.length):8*1024*1024);if(settings.showError)throw settings.showError;return stored;
  };
  const create=runInNewContext('('+gitSource.toString()+')',{head,sourcePath,deny,Map,Set,Buffer,execFileSync:closedExec},{timeout:1000});return{reader:create(root,revision),calls,stored,file};
 };
 unit('metadata-above-eight-MiB-uses-exact-bounded-object-size',()=>{for(const stored of [Buffer.alloc(0),Buffer.alloc(8*1024*1024+1,120),Buffer.alloc(16*1024*1024,120),Buffer.from([123,34,120,34,58,34,195,177,34,125,13,10])]){const f=metadataFixture({stored});assert.equal(f.reader(f.file),f.stored);assert.equal(f.reader(f.file),f.stored);assert.deepEqual(f.calls,['ls-tree','cat-file','show']);}});
 unit('metadata-oversize-rejected-before-content-read',()=>{const f=metadataFixture({sizeText:String(16*1024*1024+1)+'\n'});assert.throws(()=>f.reader(f.file),error=>error.code==='GIT_SOURCE_METADATA_SIZE');assert.throws(()=>f.reader(f.file),error=>error.code==='GIT_SOURCE_METADATA_SIZE');assert.deepEqual(f.calls,['ls-tree','cat-file','cat-file']);});
 unit('metadata-size-output-must-be-canonical',()=>{for(const sizeText of ['-1\n','01\n','1.5\n','1\r\n','1\nextra','not-a-size\n','9007199254740992\n','']){const f=metadataFixture({sizeText});assert.throws(()=>f.reader(f.file),error=>error.code==='GIT_SOURCE_METADATA_SIZE');assert.deepEqual(f.calls,['ls-tree','cat-file']);}});
 unit('metadata-content-length-must-match-Git-size',()=>{const f=metadataFixture({declaredSize:99});assert.throws(()=>f.reader(f.file),error=>error.code==='GIT_SOURCE_METADATA_LENGTH');assert.throws(()=>f.reader(f.file),error=>error.code==='GIT_SOURCE_METADATA_LENGTH');assert.deepEqual(f.calls,['ls-tree','cat-file','show','cat-file','show']);});
 unit('metadata-content-must-remain-exact-UTF8',()=>{const f=metadataFixture({stored:Buffer.from([255])});assert.throws(()=>f.reader(f.file),error=>error.code==='GIT_SOURCE_METADATA_UTF8');assert.throws(()=>f.reader(f.file),error=>error.code==='GIT_SOURCE_METADATA_UTF8');assert.deepEqual(f.calls,['ls-tree','cat-file','show','cat-file','show']);});
 unit('metadata-size-Git-error-propagates',()=>{const sentinel=Object.assign(new Error('GIT_SIZE_SENTINEL'),{code:'GIT_SIZE_SENTINEL'}),f=metadataFixture({sizeError:sentinel});assert.throws(()=>f.reader(f.file),error=>error===sentinel);assert.throws(()=>f.reader(f.file),error=>error===sentinel);assert.deepEqual(f.calls,['ls-tree','cat-file','cat-file']);});
 unit('metadata-show-Git-error-propagates-without-negative-cache',()=>{const sentinel=Object.assign(new Error('GIT_METADATA_SHOW_SENTINEL'),{code:'GIT_METADATA_SHOW_SENTINEL'}),f=metadataFixture({showError:sentinel});assert.throws(()=>f.reader(f.file),error=>error===sentinel);assert.throws(()=>f.reader(f.file),error=>error===sentinel);assert.deepEqual(f.calls,['ls-tree','cat-file','show','cat-file','show']);});
 unit('metadata-exception-does-not-extend-to-neighbor-path',()=>{const sentinel=Object.assign(new Error('OUT_OF_PATH_EIGHT_MIB'),{code:'ENOBUFS'}),f=metadataFixture({file:metadataFile+'.copy',showError:sentinel});assert.throws(()=>f.reader(f.file),error=>error===sentinel);assert.deepEqual(f.calls,['ls-tree','show']);});
 return checks;
}
function manifestDigest(references){return hash(canonical([...references].sort((a,b)=>a.path.localeCompare(b.path))));}
function expectedSourceDigest(spec,readSource){if(typeof readSource!=='function')deny('PROOF_SOURCE_RESOLVER');return manifestDigest(spec.sourceFiles.map(file=>{const bytes=readSource(file);if(!Buffer.isBuffer(bytes))deny('PROOF_SOURCE_BYTES');return {path:file,sha256:hash(bytes)};}));}
const utf8=bytes=>{if(!Buffer.isBuffer(bytes))deny('PROOF_BYTES');const text=bytes.toString('utf8');if(!bytes.equals(Buffer.from(text)))deny('PROOF_ENCODING');return text;};
function matrix(rows,widths,modes){if(!Array.isArray(rows))deny('PROOF_MATRIX');const keys=rows.map(row=>row&&row.width+':'+row.mode);equal(keys.toSorted(),widths.flatMap(width=>modes.map(mode=>width+':'+mode)).toSorted(),'PROOF_MATRIX');}
function budgetScreenshotSummary(files){
 if(!Array.isArray(files))deny('PROOF_BUDGET_UI_SCREENSHOT_BINDING');const selected=PLAN_BUDGET_UI_MATRIX.map(row=>{const path=planBudgetUiRetainedScreenshotPath(row),matches=files.filter(file=>file.path===path);if(matches.length!==1||!sha(matches[0].sha256)||!Number.isSafeInteger(matches[0].bytes)||matches[0].bytes<=45)deny('PROOF_BUDGET_UI_SCREENSHOT_BINDING');return {path,sha256:matches[0].sha256,bytes:matches[0].bytes};});
 return {cases:23,screenshots:23,screenshotManifestSha256:hash(canonical(selected))};
}
function summary(spec,files=null,contract=null){
 if(contract&&hasCaptureRuntime(contract)&&['PG_COMPANY_KYC','PG_BANK','PG_INTAKE','PG_FIELD'].includes(spec.kind)){
  equal(contract.extension.proofs.find(row=>row.id===spec.id),spec,'PROOF_NATIVE_CURRENT_SPEC');
  const parent=captureBudget.restoreCaptureRuntimePreviousContract(contract),parentSpec=parent.extension.proofs.find(row=>row.id===spec.id);
  if(!parentSpec)deny('PROOF_NATIVE_PARENT_SPEC');
  return summary(parentSpec,files);
 }
 if(spec.kind===PLAN_BUDGET_CI_KIND)return budgetScreenshotSummary(files);return spec.kind===FIELD_TASK_PAGINATION_CI_KIND?spec.checkNames.length:spec.kind===FOCUSED_WORKSPACE_CI_KIND?spec.checkNames.length:spec.kind===PARTICIPANT_PREANALYSIS_KIND?spec.checkNames.length:spec.kind==='UI_DOCUMENT_CURVE'?DOCUMENT_CURVE_UI_CHECKS.length:spec.kind==='PG_PLAN_BASELINE'?spec.checkNames.length:isCanonicalField(spec)?(attendanceReviewCurrentCheckCount(spec)??spec.checkNames.length):isIdentity(spec)?IDENTITY_ONLY_CHECK_COUNT:spec.kind==='PORTFOLIO_UNIT'?PORTFOLIO_TESTS:spec.kind==='UI_PORTFOLIO'?4*PORTFOLIO_MODES.length:spec.kind==='PG_PORTFOLIO'?spec.checkNames.length:spec.kind==='PG_PREPARATION'?spec.checkNames.length:spec.kind==='UI_PREPARATION'?4*PREPARATION_MODES.length:spec.kind==='UNIT'?{suites:TEST_SUITES.length,tests:EXPECTED_TOTAL_TESTS,recovery:7,corporateKyc:EXPECTED_SUITE_COUNTS['tests/production-company-channel-kyc.test.mjs'],nextSteps:EXPECTED_SUITE_COUNTS['tests/production-participant-onboarding-next-step.test.mjs']}:spec.kind==='PG_INTAKE'?(intakeWithdrawalCurrentCheckCount(spec)??spec.checkNames.length):spec.kind==='PG_COMPANY_KYC'?spec.checkNames.length:spec.kind==='UI_CAUSAL'?0:spec.kind==='UI_JOINT'?8:spec.kind==='UI_INTAKE'?4*INTAKE_UI_MODES.length:spec.kind.startsWith('UI_')?32:spec.kind==='PG_BANK'?10:8;}
function validateExtension(contract){
 const extension=contract.extension;exactKeys(extension,['baseHead','baselineBlocksSha256','baselineOwnershipSha256','baselineProducersSha256','proofs'],'EXTENSION_SHAPE');
 if(extension.baseHead!=='a4b79d7a7f75427ed1d0b0e1e9b247e1188adf3f')deny('EXTENSION_BASE');
 equal(extension.proofs.map(p=>[p.id,p.lane,p.blockId,p.path,p.kind]),EXTENSION_PROOFS,'EXTENSION_PROOF_COVERAGE');
 for(const spec of extension.proofs){exactKeys(spec,['id','lane','blockId','path','kind','producer','producerSha256','sourceFiles','checkNames'],'EXTENSION_PROOF_SHAPE');if(!sha(spec.producerSha256)||!Array.isArray(spec.sourceFiles)||!spec.sourceFiles.length||new Set(spec.sourceFiles).size!==spec.sourceFiles.length)deny('EXTENSION_SOURCE_CONTRACT');spec.sourceFiles.forEach(sourcePath);sourcePath(spec.producer);if(!Array.isArray(spec.checkNames))deny('EXTENSION_CHECK_NAMES');}
 for(const spec of extension.proofs){
  const record=contract.evidenceProducers.find(p=>p.path===spec.path);
  if(spec.kind==='UNIT'){equal(record,INTAKE_PLAIN_TEXT_UNIT_BASELINE_PRODUCER,'EXTENSION_PRODUCER_CONTRACT');continue;}
  if(spec.kind==='PG_BANK'){equal(record,PRIVATE_BANK_PG_BASELINE_PRODUCER,'EXTENSION_PRODUCER_CONTRACT');continue;}
  if(Object.hasOwn(INTAKE_CONTINUITY_BASELINE_PRODUCERS,spec.kind)){equal(record,INTAKE_CONTINUITY_BASELINE_PRODUCERS[spec.kind],'EXTENSION_PRODUCER_CONTRACT');continue;}
  if(spec.kind==='PG_FIELD'||spec.kind==='PG_OVERTIME'){equal(record,spec.kind==='PG_FIELD'?FIELD_PG_BASELINE_PRODUCER:OVERTIME_PG_BASELINE_PRODUCER,'EXTENSION_PRODUCER_CONTRACT');continue;}
  if(spec.kind==='PG_PORTFOLIO'){equal(record,PORTFOLIO_PG_BASELINE_PRODUCER,'EXTENSION_PRODUCER_CONTRACT');continue;}
  if(spec.kind==='PG_PREPARATION'){equal(record,PREPARATION_PG_BASELINE_PRODUCER,'EXTENSION_PRODUCER_CONTRACT');continue;}
  if(spec.kind==='PG_COMPANY_KYC'){equal(record,COMPANY_KYC_PG_BASELINE_PRODUCER,'EXTENSION_PRODUCER_CONTRACT');continue;}
  if(isIdentity(spec)){equal(record,IDENTITY_UI_BASELINE_PRODUCER,'EXTENSION_PRODUCER_CONTRACT');continue;}
  if(Object.hasOwn(COPY_CLOSURE_UI_BASELINE_PRODUCERS,spec.kind)){equal(record,COPY_CLOSURE_UI_BASELINE_PRODUCERS[spec.kind],'EXTENSION_PRODUCER_CONTRACT');continue;}
  equal(record&&{producer:record.producer,path:record.path,retained:record.retained,blockId:record.blockId,lane:record.lane,producerSha256:record.producerSha256,sourceBasis:record.sourceBasis},{producer:spec.producer,path:spec.path,retained:true,blockId:spec.blockId,lane:spec.lane,producerSha256:spec.producerSha256,sourceBasis:'EXPECTED_HEAD_GIT_BYTES'},'EXTENSION_PRODUCER_CONTRACT');
 }
 if(hash(canonical(contract.blocks.slice(0,46)))!==extension.baselineBlocksSha256||extension.baselineBlocksSha256!==BASELINE_BLOCKS_SHA256)deny('BASELINE_BLOCKS_CHANGED');
 const newPatterns=new Set([...PREPARATION_ARTIFACTS,...PORTFOLIO_ARTIFACTS,...extension.proofs.filter(spec=>spec.kind!=='PG_PORTFOLIO'&&!isCanonicalField(spec)).flatMap(spec=>contract.lanes[spec.lane].artifacts.filter(pattern=>matches(spec.path,pattern)))]);
 const ownership=Object.fromEntries(LANES.map(lane=>[lane,{blocks:contract.lanes[lane].blocks.filter(id=>id<=52),artifacts:contract.lanes[lane].artifacts.filter(pattern=>!newPatterns.has(pattern))}]));
 if(hash(canonical(ownership))!==extension.baselineOwnershipSha256||extension.baselineOwnershipSha256!==BASELINE_OWNERSHIP_SHA256)deny('BASELINE_OWNERSHIP_CHANGED');
 if(hash(canonical(contract.evidenceProducers.filter(p=>p.blockId<=52)))!==extension.baselineProducersSha256||extension.baselineProducersSha256!==BASELINE_PRODUCERS_SHA256)deny('BASELINE_PRODUCERS_CHANGED');
 if(hash(canonical(contract.blocks.slice(0,51)))!==PREPARATION_BASELINE_BLOCKS_SHA256)deny('PREPARATION_BASELINE_BLOCKS_CHANGED');
 const previousOwnership=Object.fromEntries(LANES.map(lane=>[lane,{blocks:contract.lanes[lane].blocks.filter(id=>id<=57),artifacts:contract.lanes[lane].artifacts.filter(pattern=>!DOCUMENT_CURVE_UI_ARTIFACTS.includes(pattern)&&!PLAN_BASELINE_ARTIFACTS.includes(pattern)&&!PREPARATION_ARTIFACTS.includes(pattern)&&!PORTFOLIO_ARTIFACTS.includes(pattern)&&!IDENTITY_ARTIFACTS.includes(pattern))}]));
 if(hash(canonical(previousOwnership))!==PREPARATION_BASELINE_OWNERSHIP_SHA256)deny('PREPARATION_BASELINE_OWNERSHIP_CHANGED');
 if(hash(canonical(contract.evidenceProducers.filter(p=>p.blockId<=57)))!==PREPARATION_BASELINE_PRODUCERS_SHA256)deny('PREPARATION_BASELINE_PRODUCERS_CHANGED');
 if(hash(canonical(contract.blocks.slice(0,52)))!==PORTFOLIO_BASELINE_BLOCKS_SHA256)deny('PORTFOLIO_BASELINE_BLOCKS_CHANGED');
 const portfolioPreviousOwnership=Object.fromEntries(LANES.map(lane=>[lane,{blocks:contract.lanes[lane].blocks.filter(id=>id<=58),artifacts:contract.lanes[lane].artifacts.filter(pattern=>!DOCUMENT_CURVE_UI_ARTIFACTS.includes(pattern)&&!PLAN_BASELINE_ARTIFACTS.includes(pattern)&&!PORTFOLIO_ARTIFACTS.includes(pattern)&&!IDENTITY_ARTIFACTS.includes(pattern))}]));
 if(hash(canonical(portfolioPreviousOwnership))!==PORTFOLIO_BASELINE_OWNERSHIP_SHA256)deny('PORTFOLIO_BASELINE_OWNERSHIP_CHANGED');
 if(hash(canonical(contract.evidenceProducers.filter(p=>p.blockId<=58)))!==PORTFOLIO_BASELINE_PRODUCERS_SHA256)deny('PORTFOLIO_BASELINE_PRODUCERS_CHANGED');
 if(contract.blocks.find(block=>block.id===59).commandSha256!==PORTFOLIO_BLOCK_DIGEST)deny('PORTFOLIO_BLOCK_COMMAND');
 if(hash(canonical(contract.blocks.slice(0,53)))!==IDENTITY_BASELINE_BLOCKS_SHA256)deny('IDENTITY_BASELINE_BLOCKS_CHANGED');
 const identityPreviousOwnership=Object.fromEntries(LANES.map(lane=>[lane,{blocks:contract.lanes[lane].blocks.filter(id=>id<=59),artifacts:contract.lanes[lane].artifacts.filter(pattern=>!DOCUMENT_CURVE_UI_ARTIFACTS.includes(pattern)&&!PLAN_BASELINE_ARTIFACTS.includes(pattern)&&!IDENTITY_ARTIFACTS.includes(pattern))}]));
 if(hash(canonical(identityPreviousOwnership))!==IDENTITY_BASELINE_OWNERSHIP_SHA256)deny('IDENTITY_BASELINE_OWNERSHIP_CHANGED');
 if(hash(canonical(contract.evidenceProducers.filter(p=>p.blockId<=59)))!==IDENTITY_BASELINE_PRODUCERS_SHA256)deny('IDENTITY_BASELINE_PRODUCERS_CHANGED');
 if(contract.blocks.find(block=>block.id===60).commandSha256!==IDENTITY_BLOCK_DIGEST)deny('IDENTITY_BLOCK_COMMAND');
 equal(extension.proofs.find(isIdentity).checkNames,IDENTITY_ONLY_CHECKS.map(canonical),'EXTENSION_CHECK_NAMES');
 const field=extension.proofs.find(spec=>spec.kind==='PG_FIELD'),overtime=extension.proofs.find(spec=>spec.kind==='PG_OVERTIME');
 let fieldPrivacy,overtimePrivacy;try{fieldPrivacy=currentFieldPrivacyRevision(contract,field.id);overtimePrivacy=currentFieldPrivacyRevision(contract,overtime.id);}catch{deny('EXTENSION_FIELD_PRIVACY_REVISION');}
 if(field.checkNames.length!==(fieldPrivacy?.currentCheckCount??66)||overtime.checkNames.length!==(overtimePrivacy?.currentCheckCount??29))deny('EXTENSION_CHECK_NAMES');
 equal(field.checkNames.slice(0,fieldPrivacy?.previousCheckCount??66).slice(-3),FIELD_CANONICAL_CHECKS.map(name=>canonical({group:'canonicalOwnFieldChecks',name})),'EXTENSION_CHECK_NAMES');
}
function expectedMonthlyCurveStep(contract){
 const baseline=contract.blocks.find(block=>block.id===12).step;
 return {...clone(baseline),run:baseline.run
  .replace("'src/app/(identity)/cuenta/plan-import-panel.js'","'src/app/(identity)/cuenta/plan-import-panel.js' 'src/app/(identity)/cuenta/plan-source-curve.js' 'src/app/(identity)/cuenta/plan-source-curve.mjs'")
  .replace('tests/production-plan-import*.test.mjs --max-warnings 0','tests/production-plan-import*.test.mjs tests/production-plan-source-curve-ui.test.mjs --max-warnings 0')
  .replace('node --test tests/production-plan-import*.test.mjs\n','node --test tests/production-plan-import*.test.mjs tests/production-plan-source-curve-ui.test.mjs\n')};
}
function validateMonthlyCurveExtension(contract){
 const extension=contract.monthlySourceCurve;
 exactKeys(extension,['version','blockId','lane','baselineCommandSha256','step','commandSha256','sourceDependencies'],'MONTHLY_CURVE_EXTENSION_SHAPE');
 if(extension.version!==3||extension.blockId!==12||extension.lane!=='plans')deny('MONTHLY_CURVE_EXTENSION_IDENTITY');
 if(extension.baselineCommandSha256!==contract.blocks.find(block=>block.id===12).commandSha256)deny('MONTHLY_CURVE_BASELINE_COMMAND');
 equal(extension.step,expectedMonthlyCurveStep(contract),'MONTHLY_CURVE_EXTENSION_COMMAND');
 if(hash(extension.step.run)!==extension.commandSha256)deny('MONTHLY_CURVE_COMMAND_DIGEST');
 equal(extension.sourceDependencies,MONTHLY_CURVE_DEPENDENCIES,'MONTHLY_CURVE_SOURCE_DEPENDENCIES');
 for(const [kind,dependencies] of Object.entries(MONTHLY_CURVE_DEPENDENCIES)){
  const spec=contract.extension.proofs.find(proof=>proof.kind===kind);
  if(dependencies.some(file=>!spec.sourceFiles.includes(file)))deny('MONTHLY_CURVE_SOURCE_DEPENDENCIES');
 }
}
function expectedCalendarPreparationStep(contract){
 const baseline=contract.monthlySourceCurve.step;
 return {...clone(baseline),run:baseline.run.replace("'src/app/(identity)/cuenta/plan-import-panel.js'","'src/app/(identity)/cuenta/plan-import-panel.js' '"+CALENDAR_PREPARATION_SOURCE+"'")};
}
function validateCalendarPreparationExtension(contract){
 const extension=contract.calendarPreparation;
 exactKeys(extension,['version','blockId','lane','baselineCommandSha256','step','commandSha256','sourceDependencies'],'CALENDAR_PREPARATION_EXTENSION_SHAPE');
 if(extension.version!==1||extension.blockId!==12||extension.lane!=='plans')deny('CALENDAR_PREPARATION_EXTENSION_IDENTITY');
 if(extension.baselineCommandSha256!==contract.monthlySourceCurve.commandSha256)deny('CALENDAR_PREPARATION_BASELINE_COMMAND');
 equal(extension.step,expectedCalendarPreparationStep(contract),'CALENDAR_PREPARATION_EXTENSION_COMMAND');
 if(hash(extension.step.run)!==extension.commandSha256)deny('CALENDAR_PREPARATION_COMMAND_DIGEST');
 equal(extension.sourceDependencies,CALENDAR_PREPARATION_DEPENDENCIES,'CALENDAR_PREPARATION_SOURCE_DEPENDENCIES');
 for(const [kind,dependencies] of Object.entries(CALENDAR_PREPARATION_DEPENDENCIES)){
  const spec=contract.extension.proofs.find(proof=>proof.kind===kind);
  if(dependencies.some(file=>!spec.sourceFiles.includes(file)))deny('CALENDAR_PREPARATION_SOURCE_DEPENDENCIES');
 }
}
function expectedWhatsappPlanImportStep(contract){
 const baseline=contract.blocks.find(block=>block.id===26).step;
 const additions='npx eslint '+WHATSAPP_PLAN_IMPORT_LINT_SOURCES.join(' ')+' --max-warnings 0\nnode --test '+WHATSAPP_PLAN_IMPORT_TEST_FILES.join(' ')+'\n';
 return {...clone(baseline),run:baseline.run.replace('node scripts/verify-worker-channel-postgres.mjs\n',additions+'node scripts/verify-worker-channel-postgres.mjs\n')};
}
function validateWhatsappPlanImportExtension(contract){
 const extension=contract.whatsappPlanImport;
 exactKeys(extension,['version','blockId','lane','baselineCommandSha256','step','commandSha256','sourceDependencies','testSources'],'WHATSAPP_PLAN_IMPORT_EXTENSION_SHAPE');
 if(extension.version!==1||extension.blockId!==26||extension.lane!=='meta')deny('WHATSAPP_PLAN_IMPORT_EXTENSION_IDENTITY');
 if(extension.baselineCommandSha256!==contract.blocks.find(block=>block.id===26).commandSha256)deny('WHATSAPP_PLAN_IMPORT_BASELINE_COMMAND');
 equal(extension.step,expectedWhatsappPlanImportStep(contract),'WHATSAPP_PLAN_IMPORT_EXTENSION_COMMAND');
 if(hash(extension.step.run)!==extension.commandSha256)deny('WHATSAPP_PLAN_IMPORT_COMMAND_DIGEST');
 equal(extension.sourceDependencies,WHATSAPP_PLAN_IMPORT_DEPENDENCIES,'WHATSAPP_PLAN_IMPORT_SOURCE_DEPENDENCIES');
 if(!Array.isArray(extension.testSources)||extension.testSources.length!==WHATSAPP_PLAN_IMPORT_TEST_SOURCE_PATHS.length)deny('WHATSAPP_PLAN_IMPORT_TEST_SOURCES');
 equal(extension.testSources.map(source=>source?.path),WHATSAPP_PLAN_IMPORT_TEST_SOURCE_PATHS,'WHATSAPP_PLAN_IMPORT_TEST_SOURCES');
 for(const source of extension.testSources){exactKeys(source,['path','sha256'],'WHATSAPP_PLAN_IMPORT_TEST_SOURCES');if(!sha(source.sha256))deny('WHATSAPP_PLAN_IMPORT_TEST_SOURCES');}
 for(const [kind,dependencies] of Object.entries(WHATSAPP_PLAN_IMPORT_DEPENDENCIES)){
  const spec=contract.extension.proofs.find(proof=>proof.kind===kind);
  if(dependencies.some(file=>!spec.sourceFiles.includes(file)))deny('WHATSAPP_PLAN_IMPORT_SOURCE_DEPENDENCIES');
 }
}
function verifyWhatsappPlanTestSources(contract,readSource){
 if(typeof readSource!=='function')deny('PROOF_SOURCE_RESOLVER');
 if(!hasCaptureRuntime(contract))return verifyPreviousWhatsappPlanTestSources(contract,readSource);
 try{return captureBudget.withCaptureRuntimePreviousSources(contract,readSource,(parent,parentRead)=>verifyPreviousWhatsappPlanTestSources(parent,parentRead));}
 catch(error){if(error.code==='PLAN_BUDGET_CURRENT_CI_LINEAGE_REJECTED')deny('WHATSAPP_PLAN_IMPORT_TEST_SOURCE_HASH');throw error;}
}
function verifyPreviousWhatsappPlanTestSources(contract,readSource){
 if(typeof readSource!=='function')deny('PROOF_SOURCE_RESOLVER');
 for(const source of contract.whatsappPlanImport.testSources){const bytes=readSource(source.path);if(!Buffer.isBuffer(bytes))deny('PROOF_SOURCE_BYTES');let expected;try{expected=integratedIdentityCurrentSourcePin(contract,source);}catch(error){if(error.code==='INTEGRATED_IDENTITY_CURRENT_CI_LINEAGE_REJECTED')deny('WHATSAPP_PLAN_IMPORT_TEST_SOURCE_HASH');throw error;}if(hash(bytes)!==expected)deny('WHATSAPP_PLAN_IMPORT_TEST_SOURCE_HASH');}
}
const currentCommandBlock=(contract,id)=>id===12?{...contract.blocks.find(block=>block.id===id),...contract.calendarPreparation}:id===26?{...contract.blocks.find(block=>block.id===id),...contract.whatsappPlanImport}:contract.blocks.find(block=>block.id===id);
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
function validateCanonicalFieldKycFixture(fixture,sourceMap=false){
 exactKeys(fixture,sourceMap?['sourceSha256','records','syntheticPrivateCalls','providerCalls','biometricIdentityCertified']:['records','syntheticPrivateCalls','providerCalls','biometricIdentityCertified'],'PROOF_FIELD_KYC_FIXTURE');
 if(fixture.providerCalls!==0||fixture.biometricIdentityCertified!==false)deny('PROOF_PROVIDER_IO');
 if(!Array.isArray(fixture.records)||!fixture.records.length)deny('PROOF_FIELD_KYC_FIXTURE');exactKeys(fixture.syntheticPrivateCalls,['privatePuts','privateReads'],'PROOF_FIELD_KYC_FIXTURE');
 if(fixture.syntheticPrivateCalls.privatePuts!==fixture.records.length*2||fixture.syntheticPrivateCalls.privateReads!==fixture.records.length*6)deny('PROOF_FIELD_KYC_FIXTURE');
 for(const record of fixture.records){exactKeys(record,['projectId','workerId','submissionId','submissionReceiptId','reviewReceiptId','actorId','reviewerActorId','contentHash','canonicalAdmissionConfirmed','identityCertified','providerCalls'],'PROOF_FIELD_KYC_FIXTURE');if(record.canonicalAdmissionConfirmed!==true||record.identityCertified!==false||record.providerCalls!==0||!sha(record.contentHash)||typeof record.actorId!=='string'||typeof record.reviewerActorId!=='string'||!record.actorId||!record.reviewerActorId||record.actorId===record.reviewerActorId||!/^participant_[a-f0-9]{64}$/.test(record.submissionReceiptId)||!/^participant_[a-f0-9]{64}$/.test(record.reviewReceiptId))deny('PROOF_FIELD_KYC_FIXTURE');}
}
function fieldPrivacySpecRevision(spec,readSource){try{
 let privacySpec=spec;
 if(attendanceReviewCurrentCheckCount(spec)!==null){
  const contract=JSON.parse(utf8(readSource('.github/workspace-acceptance-contract.json')));
  verifyPlanBudgetCurrentSources(contract,readSource);
  const parent=restorePlanBudgetAttendanceReviewProducerText(contract,readSource(spec.producer));
  privacySpec={...spec,producerSha256:hash(parent),sourceFiles:restorePlanBudgetFieldReviewSourceSet(contract,'PG_FIELD',spec.sourceFiles)};
 }
 return currentFieldPrivacySpecRevision(privacySpec);
}catch{deny('PROOF_FIELD_PRIVACY_REVISION');}}
function validateFieldHistoryPrivacy(spec,proof,readSource){
 const revision=fieldPrivacySpecRevision(spec,readSource);
 if(!revision){if(Object.hasOwn(proof,'ownHistoryPrivacy'))deny('PROOF_FIELD_PRIVACY_REVISION');return null;}
 const value=proof.ownHistoryPrivacy,common=['version','currentAccountKycCanonical','originalAuthorRestored','reviewerRoles','readBusinessWrites','participantKycFixture'];
 exactKeys(value,spec.kind==='PG_FIELD'?[...common,'checks','deniedBeforePrivateRead','postReadAuthorityRaces','providerCalls']:[...common,'sameWorkerReassigned','newAuthorOwnShiftWithForeignPredecessorReadable'],'PROOF_FIELD_HISTORY_PRIVACY');
 if(value.version!==1||value.currentAccountKycCanonical!==true||value.originalAuthorRestored!==true||value.readBusinessWrites!==0)deny('PROOF_FIELD_HISTORY_PRIVACY');
 equal(value.reviewerRoles,['ADMIN','DIRECTOR','SITE_MANAGER'],'PROOF_FIELD_HISTORY_PRIVACY');validateCanonicalFieldKycFixture(value.participantKycFixture);
 if(spec.kind==='PG_FIELD'){
  if(value.deniedBeforePrivateRead!==true||value.providerCalls!==0)deny('PROOF_FIELD_HISTORY_PRIVACY');equal(value.postReadAuthorityRaces,['REASSIGNED','REVOKED'],'PROOF_FIELD_HISTORY_PRIVACY');
  if(!Array.isArray(value.checks))deny('PROOF_FIELD_HISTORY_PRIVACY');equal(value.checks.map(name=>canonical({group:'ownHistoryPrivacy.checks',name})),revision.addedChecks,'PROOF_FIELD_HISTORY_PRIVACY');
 }else if(value.sameWorkerReassigned!==true||value.newAuthorOwnShiftWithForeignPredecessorReadable!==true)deny('PROOF_FIELD_HISTORY_PRIVACY');
 return revision;
}
function validateCanonicalFieldProof(spec,proof,readSource){
 const fixture=proof.participantKycFixture;validateCanonicalFieldKycFixture(fixture,spec.kind==='PG_FIELD');if(proof.providerCalls!==0)deny('PROOF_PROVIDER_IO');
 const revision=validateFieldHistoryPrivacy(spec,proof,readSource),sets=canonicalFieldSourceSets(spec,readSource);
 if(spec.kind==='PG_OVERTIME'){
  if(proof.environment!=='disposable-random-schema-on-approved-local-postgres'||!/^obrasaas_overtime_[a-f0-9]{32}$/.test(proof.schema)||proof.disposableSchemaRemoved!==true)deny('PROOF_CLEANUP');
  if(proof.newOvertimeEnum!==false||proof.paymentEngineUsed!==false||proof.humanAccepted!==false)deny('PROOF_PROVIDER_IO');equal(proof.sqlFailures,[],'PROOF_SQL_ERRORS');equal(proof.checks,spec.checkNames,'PROOF_CHECK_NAMES');equal(proof.sourceManifest.map(ref=>ref.path).toSorted(),sets.sourceManifest,'PROOF_SOURCE_MANIFEST');
 }else{
  if(typeof proof.databaseEngineVersion!=='string'||proof.environment!=='disposable-local-postgresql'+proof.databaseEngineVersion.split('.')[0]||proof.databaseRemoved!==true)deny('PROOF_CLEANUP');
  for(const key of ['reviewPaginationProviderCalls','voiceProgressProviderCalls','mediaLeaseProviderCalls','videoAudioProviderCalls'])if(proof[key]!==0)deny('PROOF_PROVIDER_IO');
  if(proof.physicalAttendanceAccepted!==false||proof.whatsAppTested!==false||proof.videoAudioFfmpegExecuted!==false)deny('PROOF_PROVIDER_IO');
  for(const [group,countKey,count] of FIELD_CHECK_GROUPS){if(!Array.isArray(proof[group])||proof[group].length!==count||proof[countKey]!==count)deny('PROOF_CHECK_NAMES');}
  const allChecks=FIELD_CHECK_GROUPS.flatMap(([group])=>proof[group].map(name=>canonical({group,name})));if(revision)allChecks.push(...proof.ownHistoryPrivacy.checks.map(name=>canonical({group:'ownHistoryPrivacy.checks',name})));
  equal(allChecks,spec.checkNames,'PROOF_CHECK_NAMES');equal(proof.canonicalOwnFieldChecks,FIELD_CANONICAL_CHECKS,'PROOF_CHECK_NAMES');if(proof.totalChecks!==(attendanceReviewCurrentCheckCount(spec)??revision?.currentCheckCount??66))deny('PROOF_CHECK_NAMES');
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
function validateCompanyKycExpiryNativeProof(proof){
 if(['poolClosed','adminClosed','ownConnectionsClosed'].some(key=>proof[key]!==true))deny('PROOF_CLEANUP');
 const e=proof.expiryFeedbackNative;
 exactKeys(e,['kind','postgresExecuted','controlledIssuanceClockOffsetMs','continuationClock','preparedClaimPromptBytesRewritten','cases','provider','realProviderCalls'],'PROOF_KYC_EXPIRY_NATIVE');
 if(e.kind!=='COMPANY'||e.postgresExecuted!==true||e.controlledIssuanceClockOffsetMs!==-1860000||e.continuationClock!=='actual-PostgreSQL-clock'||e.preparedClaimPromptBytesRewritten!==false||e.provider!=='real-adapter-controlled-Graph-fetch'||e.realProviderCalls!==0)deny('PROOF_KYC_EXPIRY_NATIVE');
 if(!Array.isArray(e.cases)||e.cases.length!==3)deny('PROOF_KYC_EXPIRY_NATIVE');
 const [race,commits,revoked]=e.cases;
 if([race,commits,revoked].some(row=>!row||typeof row!=='object'||Array.isArray(row)))deny('PROOF_KYC_EXPIRY_NATIVE');
 if(race.name!=='native-row-lock-concurrent-receipt-single-outbox-and-HTTP'||!Array.isArray(race.distinctBackendPids)||race.distinctBackendPids.length!==2||race.distinctBackendPids.some(pid=>!Number.isSafeInteger(pid)||pid<=0)||new Set(race.distinctBackendPids).size!==2||!race.distinctBackendPids.includes(race.blockedPid)||!Array.isArray(race.blockers)||!race.blockers.includes(race.distinctBackendPids.find(pid=>pid!==race.blockedPid))||race.uncommittedReceiptInvisible!==true||race.receiptCount!==1||race.outboxCount!==1||race.httpTransfers!==1||race.workerBytesUnchanged!==true||race.mediaAndDepositDelta!==0)deny('PROOF_KYC_EXPIRY_NATIVE');
 if(commits.name!=='actual-COMMIT-ACK-loss-versus-ROLLBACK-and-unknown-wire-recovery'||!Array.isArray(commits.outcomes)||commits.outcomes.length!==2)deny('PROOF_KYC_EXPIRY_NATIVE');
 for(const [index,mode]of ['LOST_ACK','ROLLBACK'].entries()){const row=commits.outcomes[index],applied=mode==='LOST_ACK';if(!row||typeof row!=='object'||Array.isArray(row)||row.mode!==mode||row.actualCommitApplied!==applied||row.realRollback!==!applied||row.recoveryReturnedReceipt!==applied||row.sendState!==(applied?'SEND_UNKNOWN':'SENT')||row.httpTransfers!==1||row.workerBytesUnchanged!==true||row.mediaAndDepositDelta!==0)deny('PROOF_KYC_EXPIRY_NATIVE');}
 if(revoked.name!=='current-native-issuer-revocation-after-reservation-no-HTTP'||revoked.receiptCount!==1||revoked.outboxCount!==1||revoked.httpTransfers!==0||revoked.workerBytesUnchanged!==true||revoked.mediaAndDepositDelta!==0)deny('PROOF_KYC_EXPIRY_NATIVE');
}
export function validateCompanyKycContextNativeProof(proof){
 const e=proof.contextFeedbackNative;
 exactKeys(e,['kind','postgresExecuted','cases','provider','realProviderCalls','humanAccepted','identityCertified','permissionsGranted'],'PROOF_KYC_CONTEXT_NATIVE');
 if(e.kind!=='COMPANY'||e.postgresExecuted!==true||e.provider!=='actual-adapter-controlled-Graph-fetch'||e.realProviderCalls!==0||e.humanAccepted!==false||e.identityCertified!==false||e.permissionsGranted!==false||!Array.isArray(e.cases)||e.cases.length!==5)deny('PROOF_KYC_CONTEXT_NATIVE');
 const [concurrent,status,revoked,processor,lease]=e.cases;
 const keys=[['name','receiptCount','outboxCount','httpTransfers','workerBytesUnchanged','mediaDelta'],['name','receiptCount','outboxCount','httpTransfers','consentChosen','workerBytesUnchanged','mediaDelta'],['name','receiptCount','outboxCount','httpTransfers','workerBytesUnchanged','mediaDelta'],['name','captureDispatches','httpTransfers','workerBytesUnchanged','mediaDelta'],['name','sqlStatements','compactFences','fullResolutions','elapsedMs','prePostMs','statementDelayMs','graphDelayMs','sourceLeaseMs','marginMs','leaseExtended','httpTransfers','workerBytesUnchanged','mediaDelta','productionLatencyMeasured']];
 e.cases.forEach((row,index)=>exactKeys(row,keys[index],'PROOF_KYC_CONTEXT_NATIVE'));
 const names=['native-prior-prompt-concurrent-receipt-one-HTTP-private-state-unchanged','native-neutral-status-exact-expired-source-without-consent-choice','native-current-issuer-revoked-after-reservation-no-HTTP','native-processor-intercepts-before-capture-without-replay-dispatch','native-original-60s-lease-controlled-225ms-SQL-200ms-Graph'];
 if(e.cases.some((row,index)=>row.name!==names[index]||row.workerBytesUnchanged!==true||row.mediaDelta!==0||row.httpTransfers!==(index===2?0:1)))deny('PROOF_KYC_CONTEXT_NATIVE');
 if([concurrent,status,revoked].some(row=>row.receiptCount!==1||row.outboxCount!==1)||status.consentChosen!==false||processor.captureDispatches!==0)deny('PROOF_KYC_CONTEXT_NATIVE');
 if(['sqlStatements','compactFences','fullResolutions'].some(key=>!Number.isSafeInteger(lease[key])||lease[key]<=0)||!Number.isFinite(lease.elapsedMs)||!Number.isFinite(lease.prePostMs)||lease.prePostMs<=0||lease.prePostMs>lease.elapsedMs||lease.elapsedMs>=60000||lease.marginMs!==60000-lease.elapsedMs||lease.statementDelayMs!==225||lease.graphDelayMs!==200||lease.sourceLeaseMs!==60000||lease.leaseExtended!==false||lease.productionLatencyMeasured!==false)deny('PROOF_KYC_CONTEXT_NATIVE');
}
// Validator-only shadow input. This is never a native execution receipt.
function companyKycContextNativeShadowFixture(){
 return {kind:'COMPANY',postgresExecuted:true,provider:'actual-adapter-controlled-Graph-fetch',realProviderCalls:0,humanAccepted:false,identityCertified:false,permissionsGranted:false,cases:[
  {name:'native-prior-prompt-concurrent-receipt-one-HTTP-private-state-unchanged',receiptCount:1,outboxCount:1,httpTransfers:1,workerBytesUnchanged:true,mediaDelta:0},
  {name:'native-neutral-status-exact-expired-source-without-consent-choice',receiptCount:1,outboxCount:1,httpTransfers:1,consentChosen:false,workerBytesUnchanged:true,mediaDelta:0},
  {name:'native-current-issuer-revoked-after-reservation-no-HTTP',receiptCount:1,outboxCount:1,httpTransfers:0,workerBytesUnchanged:true,mediaDelta:0},
  {name:'native-processor-intercepts-before-capture-without-replay-dispatch',captureDispatches:0,httpTransfers:1,workerBytesUnchanged:true,mediaDelta:0},
  {name:'native-original-60s-lease-controlled-225ms-SQL-200ms-Graph',sqlStatements:140,compactFences:8,fullResolutions:8,elapsedMs:35000,prePostMs:33000,statementDelayMs:225,graphDelayMs:200,sourceLeaseMs:60000,marginMs:25000,leaseExtended:false,httpTransfers:1,workerBytesUnchanged:true,mediaDelta:0,productionLatencyMeasured:false},
 ]};
}
// Positive validator input only. This fixture is never written as execution
// evidence; every enclosing selftest records its no-PG shadow boundary.
function companyKycExpiryNativeShadowFixture(){
 return {kind:'COMPANY',postgresExecuted:true,controlledIssuanceClockOffsetMs:-1860000,continuationClock:'actual-PostgreSQL-clock',preparedClaimPromptBytesRewritten:false,provider:'real-adapter-controlled-Graph-fetch',realProviderCalls:0,cases:[
  {name:'native-row-lock-concurrent-receipt-single-outbox-and-HTTP',distinctBackendPids:[101,102],blockedPid:102,blockers:[101],uncommittedReceiptInvisible:true,receiptCount:1,outboxCount:1,httpTransfers:1,workerBytesUnchanged:true,mediaAndDepositDelta:0},
  {name:'actual-COMMIT-ACK-loss-versus-ROLLBACK-and-unknown-wire-recovery',outcomes:['LOST_ACK','ROLLBACK'].map(mode=>({mode,actualCommitApplied:mode==='LOST_ACK',realRollback:mode==='ROLLBACK',recoveryReturnedReceipt:mode==='LOST_ACK',sendState:mode==='LOST_ACK'?'SEND_UNKNOWN':'SENT',httpTransfers:1,workerBytesUnchanged:true,mediaAndDepositDelta:0}))},
  {name:'current-native-issuer-revocation-after-reservation-no-HTTP',receiptCount:1,outboxCount:1,httpTransfers:0,workerBytesUnchanged:true,mediaAndDepositDelta:0},
 ]};
}
function validatePlanBaselineNativeProof(spec,proof,{expectedHead,expectedTree,readSource}){
 const weekly=JSON.parse(readSource('.github/workspace-acceptance-contract.json')).weeklyCypCurrentRevision;
 if(!head(expectedTree))deny('PROOF_SOURCE_TREE_RESOLVER');
 if(proof.version!=='plan-baseline-postgres-v1'||proof.sourceState!=='EXACT_CI_SOURCE'||proof.trackedClean!==true)deny('PROOF_SOURCE_STATE');
 if(proof.sourceRevision!==expectedHead||proof.baseRevision!==expectedHead)deny('PROOF_SOURCE_HEAD');
 if(proof.sourceTree!==expectedTree||proof.baseTree!==expectedTree)deny('PROOF_SOURCE_TREE');
 if(proof.postgresExecuted!==true||proof.syntheticOnly!==true||proof.engine?.timezone!=='UTC'||typeof proof.engine?.number!=='string'||!/^17[0-9]{4}$/.test(proof.engine.number)||typeof proof.engine?.version!=='string'||!proof.engine.version.startsWith('PostgreSQL 17.'))deny('PROOF_POSTGRES_EXECUTION');
 if(proof.realProviderRequests!==0||proof.uncontrolledFetchAttempts!==0||['realProviderAcceptanceVerified','realWorkbookImported','realHumanSelectionVerified','currencyConfirmed','calendarConfirmed','actualCurveCreated'].some(key=>proof[key]!==false))deny('PROOF_PROVIDER_IO');
 if(proof.poolClosed!==true||proof.databaseRemoved!==true)deny('PROOF_CLEANUP');
 exactKeys(proof.cleanup,['poolClosed','databaseRemoved','adminClosed','pgStatActivityBeforeDrop'],'PROOF_CLEANUP');
 if(proof.cleanup.poolClosed!==true||proof.cleanup.databaseRemoved!==true||proof.cleanup.adminClosed!==true||proof.cleanup.pgStatActivityBeforeDrop!==0)deny('PROOF_CLEANUP');
 if(!Array.isArray(proof.nativeLockObservations)||proof.nativeLockObservations.length!==1)deny('PROOF_NATIVE_LOCK');
 const lock=proof.nativeLockObservations[0];exactKeys(lock,['pid','wait_event_type','wait_event'],'PROOF_NATIVE_LOCK');
 if(!Number.isSafeInteger(lock.pid)||lock.pid<=0||lock.wait_event_type!=='Lock'||typeof lock.wait_event!=='string'||!lock.wait_event)deny('PROOF_NATIVE_LOCK');
 if(!Array.isArray(proof.checks)||proof.totalCheckCount!==(weekly?WEEKLY_CYP_CURRENT_REVISION.baselineNative.totalCheckCount:spec.checkNames.length)||proof.checks.length!==spec.checkNames.length)deny('PROOF_CHECK_NAMES');
 for(const row of proof.checks){exactKeys(row,['check','status'],'PROOF_CHECK_NAMES');if(row.status!=='PASS')deny('PROOF_CHECK_NAMES');}
 equal(proof.checks.map(row=>row.check),spec.checkNames,'PROOF_CHECK_NAMES');
 if(['syntheticBlobWrites','syntheticBlobReads','localOoxmlAnalyses'].some(key=>!Number.isSafeInteger(proof[key])||proof[key]<=0))deny('PROOF_NATIVE_FIXTURE');
 if(!Array.isArray(proof.sourceManifest)||!Array.isArray(proof.sourceManifestAfter))deny('PROOF_SOURCE_MANIFEST');
 equal(proof.sourceManifest.map(ref=>ref?.path).toSorted(),spec.sourceFiles.toSorted(),'PROOF_SOURCE_MANIFEST');
 equal(proof.sourceManifestAfter,proof.sourceManifest,'PROOF_SOURCE_AFTER');
 for(const ref of proof.sourceManifest){
  exactKeys(ref,['path','sha256','bytes','worktreeGitBlobOid'],'PROOF_SOURCE_REFERENCE');sourcePath(ref.path);const bytes=readSource(ref.path);
  if(!Buffer.isBuffer(bytes)||!sha(ref.sha256)||hash(bytes)!==ref.sha256)deny('PROOF_SOURCE_HASH');
  if(ref.bytes!==bytes.length||ref.worktreeGitBlobOid!==createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex'))deny('PROOF_SOURCE_GIT_BLOB');
 }
 if(weekly)validateWeeklyCypBaselineSupplement(proof,readSource);
 // The gate digest uses the common immutable path/hash projection; all richer
 // before/after byte and Git-object facts have already been checked above.
 proof.sourceManifest=proof.sourceManifest.map(({path,sha256})=>({path,sha256}));
}
function validateWeeklyCypBaselineSupplement(proof,readSource){
 try{verifyWeeklyCypCurrentSources(JSON.parse(readSource('.github/workspace-acceptance-contract.json')),readSource);}catch{deny('PROOF_WEEKLY_CYP_SOURCE');}
 const current=WEEKLY_CYP_CURRENT_REVISION.baselineNative;
 if(proof.historicalCheckCount!==current.historicalCheckCount||proof.supplementalCheckCount!==current.addedCheckNames.length||proof.totalCheckCount!==current.totalCheckCount||!Array.isArray(proof.supplementalChecks))deny('PROOF_WEEKLY_CYP_CHECK_NAMES');
 for(const row of proof.supplementalChecks){exactKeys(row,['check','status'],'PROOF_WEEKLY_CYP_CHECK_NAMES');if(row.status!=='PASS')deny('PROOF_WEEKLY_CYP_CHECK_NAMES');}
 equal(proof.supplementalChecks.map(row=>row.check),current.addedCheckNames,'PROOF_WEEKLY_CYP_CHECK_NAMES');
 const value=proof.investment;exactKeys(value,['status','sourceSha256','sourceCurveDigest','draftId','reviewReceiptId','applyReceiptId','selectionReceiptId','monthlyPeriodCount','weeklyPeriodCount','comparison','differenceAcknowledged','taskEffects','baselineAutomaticallySelected','taskSqlAttempts','tasksPreserved','nativeLockObservations','commitObservations','tamperCases','limits'],'PROOF_WEEKLY_CYP_NATIVE');
 if(value.status!=='PASS'||!sha(value.sourceSha256)||!sha(value.sourceCurveDigest)||['draftId','reviewReceiptId','applyReceiptId','selectionReceiptId'].some(key=>typeof value[key]!=='string'||!value[key])||new Set([value.reviewReceiptId,value.applyReceiptId,value.selectionReceiptId]).size!==3||value.monthlyPeriodCount!==12||value.weeklyPeriodCount!==48||value.differenceAcknowledged!==true||value.taskEffects!==false||value.baselineAutomaticallySelected!==false||value.taskSqlAttempts!==0||!Number.isSafeInteger(value.tasksPreserved)||value.tasksPreserved<0||proof.financialTaskSqlAttempts!==0||!Number.isSafeInteger(proof.syntheticDocumentResponses)||proof.syntheticDocumentResponses<=0)deny('PROOF_WEEKLY_CYP_NATIVE');
 equal(value.comparison,{status:'DIFFERENT',weeklySumDecimalText:'48.0480000',totalDecimalText:'12345678901234567890.1234500',differenceDecimalText:'-12345678901234567842.0754500'},'PROOF_WEEKLY_CYP_NATIVE');
 if(!Array.isArray(value.nativeLockObservations)||value.nativeLockObservations.length!==1)deny('PROOF_WEEKLY_CYP_NATIVE');
 for(const row of value.nativeLockObservations){exactKeys(row,['pid','wait_event_type','wait_event'],'PROOF_WEEKLY_CYP_NATIVE');if(!Number.isSafeInteger(row.pid)||row.pid<=0||row.wait_event_type!=='Lock'||typeof row.wait_event!=='string'||!row.wait_event)deny('PROOF_WEEKLY_CYP_NATIVE');}
 const expected=['REVIEW_INVESTMENT','APPLY_INVESTMENT','SELECT'].flatMap(action=>['ACK_LOST','ROLLBACK'].map(mode=>({action,mode,recoveredState:mode==='ACK_LOST'?'RECORDED':'NOT_OBSERVED',replayed:mode==='ACK_LOST'})));
 if(!Array.isArray(value.commitObservations)||value.commitObservations.length!==expected.length)deny('PROOF_WEEKLY_CYP_NATIVE');
 value.commitObservations.forEach((row,index)=>{exactKeys(row,['action','mode','recoveredState','receiptId','replayed'],'PROOF_WEEKLY_CYP_NATIVE');const{receiptId,...facts}=row;if(typeof receiptId!=='string'||!receiptId)deny('PROOF_WEEKLY_CYP_NATIVE');equal(facts,expected[index],'PROOF_WEEKLY_CYP_NATIVE');});
 equal(value.tamperCases,['weekly-cache','review-ack','review-receipt','apply-receipt','source-hash','active-pointer'],'PROOF_WEEKLY_CYP_NATIVE');
 equal(value.limits,{syntheticWorkbook:true,syntheticSessions:true,syntheticBlob:true,realProviderRequests:0,realWorkbookImported:false,realHumanSelectionVerified:false,productionDataWritten:false,currencyConfirmed:false,calendarConfirmed:false,actualExecutionRecorded:false,paymentRecorded:false},'PROOF_WEEKLY_CYP_NATIVE');
}
// Decoder-only input, never a PostgreSQL execution or acceptance receipt.
function weeklyCypBaselineShadow(){return {historicalCheckCount:16,supplementalCheckCount:7,totalCheckCount:23,supplementalChecks:WEEKLY_CYP_CURRENT_REVISION.baselineNative.addedCheckNames.map(check=>({check,status:'PASS'})),financialTaskSqlAttempts:0,syntheticDocumentResponses:1,investment:{status:'PASS',sourceSha256:'a'.repeat(64),sourceCurveDigest:'b'.repeat(64),draftId:'synthetic-draft',reviewReceiptId:'synthetic-review',applyReceiptId:'synthetic-apply',selectionReceiptId:'synthetic-select',monthlyPeriodCount:12,weeklyPeriodCount:48,comparison:{status:'DIFFERENT',weeklySumDecimalText:'48.0480000',totalDecimalText:'12345678901234567890.1234500',differenceDecimalText:'-12345678901234567842.0754500'},differenceAcknowledged:true,taskEffects:false,baselineAutomaticallySelected:false,taskSqlAttempts:0,tasksPreserved:1,nativeLockObservations:[{pid:102,wait_event_type:'Lock',wait_event:'transactionid'}],commitObservations:['REVIEW_INVESTMENT','APPLY_INVESTMENT','SELECT'].flatMap(action=>['ACK_LOST','ROLLBACK'].map(mode=>({action,mode,recoveredState:mode==='ACK_LOST'?'RECORDED':'NOT_OBSERVED',receiptId:'synthetic-'+action+'-'+mode,replayed:mode==='ACK_LOST'}))),tamperCases:['weekly-cache','review-ack','review-receipt','apply-receipt','source-hash','active-pointer'],limits:{syntheticWorkbook:true,syntheticSessions:true,syntheticBlob:true,realProviderRequests:0,realWorkbookImported:false,realHumanSelectionVerified:false,productionDataWritten:false,currencyConfirmed:false,calendarConfirmed:false,actualExecutionRecorded:false,paymentRecorded:false}}};}
function documentCurveCurrentSourceLineageSelftest(contract,root){
 const checks=[];
 for(const spec of contract.extension.proofs){const dependencies=spec.kind==='PG_PLAN_BASELINE'?[DOCUMENT_CURVE_SOURCE,'tests/fixtures/plan-import-document-curve-synthetic.mjs']:documentCurveDependenciesFor(spec.kind);if(!dependencies.length)continue;
   const previous=spec.sourceFiles.filter(file=>!dependencies.includes(file)&&!currentWhatsappFeedbackDependenciesFor(spec.kind).includes(file)&&!planMeasurementCurrentDependencies(spec.kind).includes(file)&&!participantPreanalysisProofSourceAdditions(spec).includes(file)).sort();assert.equal(previous.length,DOCUMENT_CURVE_PREVIOUS_CURRENT_COUNTS[spec.kind]);assert.equal(hash(canonical(previous)),DOCUMENT_CURVE_PREVIOUS_CURRENT_PATHS_SHA256[spec.kind]);equal(currentProducerSourceFiles(spec,root),spec.sourceFiles,'PROOF_SOURCE_MANIFEST');checks.push({name:spec.id+'-document-current-additions-preserve-frozen-5fb-path-lineage',result:'PASS',boundary:'pure actual source graph and immutable path definitions; no producer execution'});
   if(['UI_JOINT','UI_CAUSAL'].includes(spec.kind)){const old=spec.sourceFiles.filter(file=>file!==DOCUMENT_CURVE_COPY_HELPER&&!currentWhatsappFeedbackDependenciesFor(spec.kind).includes(file)&&!planMeasurementCurrentDependencies(spec.kind).includes(file)&&!participantPreanalysisProofSourceAdditions(spec).includes(file)).sort();assert.equal(old.length,JOINT_DOCUMENT_RELOCATION_PREVIOUS_COUNT);assert.equal(hash(canonical(old)),JOINT_DOCUMENT_RELOCATION_PREVIOUS_PATHS_SHA256);checks.push({name:spec.id+'-physical-document-relocation-preserves-frozen-133-path-lineage',result:'PASS',boundary:'pure source lineage; no browser execution'});}
  for(const file of dependencies){assert.equal(spec.sourceFiles.filter(source=>source===file).length,1);const substituted=spec.sourceFiles.map(source=>source===file?'src/lib/foreign-document-curve.mjs':source);assert.equal(substituted.length,spec.sourceFiles.length);assert.throws(()=>equal(substituted,currentProducerSourceFiles(spec,root),'PROOF_SOURCE_MANIFEST'),error=>error.code==='PROOF_SOURCE_MANIFEST');checks.push({name:spec.id+'-document-same-count-source-substitution-denied-'+file,result:'PASS',expectedDenial:'PROOF_SOURCE_MANIFEST',boundary:'pure exact AST/source emitter comparison'});}
 }
 return checks;
}
function documentCurveUiSourceSets(readSource){
 const closure=seeds=>{const found=new Set();function visit(file){sourcePath(file);if(found.has(file))return;const bytes=readSource(file);if(!Buffer.isBuffer(bytes))deny('PROOF_SOURCE_HASH');found.add(file);if(file.endsWith('.css')){if(/@import\s|url\(\s*['"]?(?!data:|#)/i.test(utf8(bytes)))deny('PROOF_DOCUMENT_SOURCE_IMPORT');return;}const ast=parse(utf8(bytes),{sourceType:'module',plugins:['jsx'],createImportExpressions:true}),refs=[];function walk(node){if(!node||typeof node!=='object')return;if(['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration'].includes(node.type)&&node.source)refs.push(node.source.value);if(node.type==='ImportExpression'){if(node.source.type!=='StringLiteral')deny('PROOF_DOCUMENT_SOURCE_IMPORT');refs.push(node.source.value);}if(node.type==='CallExpression'&&node.callee?.type==='Import'){if(node.arguments[0]?.type!=='StringLiteral')deny('PROOF_DOCUMENT_SOURCE_IMPORT');refs.push(node.arguments[0].value);}for(const value of Object.values(node))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);}walk(ast.program);for(const ref of refs.filter(ref=>ref.startsWith('.'))){const base=path.posix.normalize(path.posix.join(path.posix.dirname(file),ref)),resolved=[base,base+'.js',base+'.mjs',base+'.css',base+'/index.js'].find(candidate=>{try{return Buffer.isBuffer(readSource(candidate));}catch{return false;}});if(!resolved)deny('PROOF_SOURCE_HASH');visit(resolved);}}seeds.forEach(visit);return [...found].sort();};
 const rendered=closure(DOCUMENT_CURVE_UI_RENDER_ROOTS),fixture=closure([DOCUMENT_CURVE_UI_FIXTURE_ROOT]),dependencies=['package-lock.json','package.json'];return {rendered,fixture,dependencies,combined:[...new Set([...rendered,...fixture,...dependencies,'scripts/lib/owned-fixture-cleanup.mjs'])].sort()};
}
export function validateDocumentCurveUiContract(contract){
 const spec=contract.extension.proofs.find(spec=>spec.kind==='UI_DOCUMENT_CURVE'),block=contract.blocks.find(block=>block.id===62);equal(block.step,DOCUMENT_CURVE_UI_STEP,'DOCUMENT_CURVE_UI_COMMAND');equal(spec.checkNames,DOCUMENT_CURVE_UI_CHECKS,'DOCUMENT_CURVE_UI_CHECK_NAMES');
 if(spec.producer!==DOCUMENT_CURVE_UI_PRODUCER||[...DOCUMENT_CURVE_UI_RENDER_ROOTS,DOCUMENT_CURVE_UI_FIXTURE_ROOT,DOCUMENT_CURVE_SOURCE,'scripts/lib/owned-fixture-cleanup.mjs','package.json','package-lock.json'].some(file=>spec.sourceFiles.filter(value=>value===file).length!==1))deny('DOCUMENT_CURVE_UI_SOURCE_CONTRACT');
 if(spec.sourceFiles.length!==33+planMeasurementCurrentDependencies(spec.kind).length+participantPreanalysisProofSourceAdditions(spec).length)deny('DOCUMENT_CURVE_UI_SOURCE_CONTRACT');
}
function validateDocumentCurveUiProof(spec,proof,{expectedHead,expectedTree,readSource,readEvidence}){
 if(!head(expectedTree))deny('PROOF_SOURCE_TREE_RESOLVER');if(proof.version!=='plan-document-curve-ui-v1'||proof.sourceState!=='EXACT_CI_SOURCE'||proof.trackedClean!==true)deny('PROOF_SOURCE_STATE');if(proof.sourceRevision!==expectedHead||proof.sourceBaseRevision!==expectedHead)deny('PROOF_SOURCE_HEAD');if(proof.sourceTree!==expectedTree)deny('PROOF_SOURCE_TREE');if(proof.environment!=='isolated-localhost-next-exact-jsx-synthetic-document-wire'||proof.fixtureVersion!=='synthetic-document-monthly-curve-wire-v1')deny('PROOF_DOCUMENT_UI_ENVIRONMENT');
 if(proof.providerRequests!==0||proof.automaticPostCount!==0||['actualOcrVerified','productionLoginVerified','realPlanDocuments','realFinancialReview','physicalDeviceAccepted'].some(key=>proof[key]!==false))deny('PROOF_PROVIDER_IO');for(const key of ['pageErrors','interceptErrors','externalRequests'])equal(proof[key],[],'PROOF_UI_ERRORS');
 const sets=documentCurveUiSourceSets(readSource),combined=new Map();equal(sets.combined,spec.sourceFiles,'PROOF_SOURCE_MANIFEST');
 for(const [key,files] of [['sourceManifest',sets.rendered],['fixtureSourceManifest',sets.fixture],['dependencyManifest',sets.dependencies]]){if(!Array.isArray(proof[key]))deny('PROOF_SOURCE_MANIFEST');equal(proof[key].map(ref=>ref?.path).sort(),files,'PROOF_SOURCE_MANIFEST');for(const ref of proof[key]){exactKeys(ref,['path','sha256','gitBlobOid'],'PROOF_SOURCE_REFERENCE');const bytes=readSource(ref.path);if(!Buffer.isBuffer(bytes)||ref.sha256!==hash(bytes))deny('PROOF_SOURCE_HASH');if(ref.gitBlobOid!==createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex'))deny('PROOF_SOURCE_GIT_BLOB');if(combined.has(ref.path)&&combined.get(ref.path).sha256!==ref.sha256)deny('PROOF_SOURCE_HASH');combined.set(ref.path,{path:ref.path,sha256:ref.sha256});}}
 const cleanupHelper='scripts/lib/owned-fixture-cleanup.mjs',cleanupBytes=readSource(cleanupHelper);if(!Buffer.isBuffer(cleanupBytes)||proof.cleanupHelperSha256!==hash(cleanupBytes))deny('PROOF_HARNESS_SOURCE');combined.set(cleanupHelper,{path:cleanupHelper,sha256:proof.cleanupHelperSha256});
 equal(proof.widths,[320,390,1280],'PROOF_MATRIX');if(proof.totalCheckCount!==10||!Array.isArray(proof.checks))deny('PROOF_CHECK_NAMES');equal(proof.checks.map(row=>row?.check),spec.checkNames,'PROOF_CHECK_NAMES');
 for(const [index,width] of proof.widths.entries()){const row=proof.checks[index];if(row.width!==width||!Number.isSafeInteger(row.documentWidth)||row.documentWidth<=0||row.documentWidth>width||row.taskWrites!==0||row.baselineSelections!==1)deny('PROOF_DOCUMENT_UI_GUARDS');equal(row.postActions,['UPLOAD','REVIEW_CURVE','APPLY_CURVE','SELECT'],'PROOF_DOCUMENT_UI_GUARDS');if(!Array.isArray(row.targets)||row.targets.length<=6||row.targets.some(target=>!Number.isFinite(target.width)||target.width<44||!Number.isFinite(target.height)||target.height<44))deny('PROOF_DOCUMENT_UI_GUARDS');}
 const [amount,inconsistent,limited,lost,unknown,crossed,scope]=proof.checks.slice(3);if(amount.postCount!==1||['unknownCurrency','unknownCalendar','exactMoney','missingAmountInterruptsLine'].some(key=>amount[key]!==true)||inconsistent.postCount!==2||inconsistent.applyCount!==0||limited.financialPosts!==0||limited.taskUploadCount!==1||lost.postCount!==3||unknown.postCount!==1||crossed.postCount!==1||crossed.privateFactsShown!==false||scope.postCount!==1||scope.privateDraftCleared!==true)deny('PROOF_DOCUMENT_UI_GUARDS');
 const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);if(!uuid(lost.recoveredOperationId)||!uuid(unknown.retainedOperationId)||lost.recoveredOperationId===unknown.retainedOperationId)deny('PROOF_DOCUMENT_UI_REQUESTS');
 if(!Array.isArray(proof.apiRequests)||proof.apiRequests.length===0)deny('PROOF_DOCUMENT_UI_REQUESTS');const actions=new Map([...[320,390,1280].map(width=>['journey-'+width,['UPLOAD','REVIEW_CURVE','APPLY_CURVE','SELECT']]),['amount-only',['UPLOAD']],['amount-gaps',['UPLOAD']],['inconsistent',['UPLOAD','REVIEW_CURVE']],['site-manager',['UPLOAD']],['lost-ack',['UPLOAD','REVIEW_CURVE','APPLY_CURVE']],['unknown',['UPLOAD']],['crossed-source',['UPLOAD']],['scope-change',['UPLOAD']]]),observed=new Map([...actions.keys()].map(key=>[key,[]]));
 for(const request of proof.apiRequests){exactKeys(request,['kind','path','method','operationId','action'],'PROOF_DOCUMENT_UI_REQUESTS');if(!actions.has(request.kind)||!['GET','POST'].includes(request.method)||!['/api/identity/plan-import','/api/identity/plan-baseline'].includes(request.path))deny('PROOF_DOCUMENT_UI_REQUESTS');if(request.method==='POST'){if(!uuid(request.operationId)||!['UPLOAD','REVIEW_CURVE','APPLY_CURVE','SELECT'].includes(request.action)||request.path!==(request.action==='SELECT'?'/api/identity/plan-baseline':'/api/identity/plan-import'))deny('PROOF_DOCUMENT_UI_REQUESTS');observed.get(request.kind).push(request.action);}else if(request.action!==null||request.operationId!==null&&!uuid(request.operationId))deny('PROOF_DOCUMENT_UI_REQUESTS');}
 for(const [kind,expected] of actions)equal(observed.get(kind),expected,'PROOF_DOCUMENT_UI_REQUESTS');for(const [kind,id] of [['lost-ack',lost.recoveredOperationId],['unknown',unknown.retainedOperationId]])if(!proof.apiRequests.some(row=>row.kind===kind&&row.method==='GET'&&row.operationId===id&&row.path==='/api/identity/plan-import')||!proof.apiRequests.some(row=>row.kind===kind&&row.method==='POST'&&row.operationId===id&&row.action===(kind==='lost-ack'?'APPLY_CURVE':'UPLOAD')))deny('PROOF_DOCUMENT_UI_REQUESTS');
 const postIds=proof.apiRequests.filter(row=>row.method==='POST').map(row=>row.operationId);if(postIds.length!==23||new Set(postIds).size!==23)deny('PROOF_DOCUMENT_UI_REQUESTS');
 const cleanup=proof.cleanup;if(!cleanup||['browserClosed','serverClosed','gracefulCloseAcknowledged','fixtureRemoved'].some(key=>cleanup[key]!==true)||cleanup.fixtureCleanupProof?.fixtureRemoved!==true||cleanup.fixtureCleanupProof?.postcondition?.absent!==true)deny('PROOF_CLEANUP');
 if(typeof readEvidence!=='function')deny('PROOF_SCREENSHOT_RESOLVER');if(!Array.isArray(proof.screenshotManifest)||proof.screenshotManifest.length!==4)deny('PROOF_SCREENSHOTS');const names=['320-document-baseline.png','390-document-baseline.png','1280-document-baseline.png','390-amount-only-exact-money.png'];
 for(const [index,ref] of proof.screenshotManifest.entries()){exactKeys(ref,['path','sha256'],'PROOF_SCREENSHOTS');cleanPath(ref.path);if(!ref.path.startsWith(DOCUMENT_CURVE_UI_ARTIFACTS[0]+'screenshots-')||path.posix.basename(ref.path)!==names[index])deny('PROOF_SCREENSHOTS');const bytes=readEvidence(ref.path);if(!Buffer.isBuffer(bytes)||bytes.length<24||hash(bytes)!==ref.sha256||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||bytes.toString('ascii',12,16)!=='IHDR'||bytes.readUInt32BE(16)!==[320,390,1280,390][index]||bytes.readUInt32BE(20)<1)deny('PROOF_SCREENSHOTS');}
 // The common binding is a hash projection of the validated, distinct browser,
 // Node fixture, dependency and cleanup maps. It never claims Node copying.
 proof.sourceManifest=[...combined.values()].sort((a,b)=>a.path.localeCompare(b.path));
}
function documentCurveUiSelftest(workflow,contract,root){
 const checks=[],spec=contract.extension.proofs.find(spec=>spec.kind==='UI_DOCUMENT_CURVE'),expectedHead='a'.repeat(40),expectedTree='b'.repeat(40),sourceCache=new Map(),readSource=file=>{if(!sourceCache.has(file))sourceCache.set(file,Buffer.from(readFileSync(path.join(root,sourcePath(file)),'utf8').replaceAll('\r\n','\n')));return sourceCache.get(file);};
 const good=(name,run)=>{run();checks.push({name:'document-curve-ui-'+name,result:'PASS',boundary:'pure AST and DOM-proof/PNG-header shadow; no browser/provider execution'});},bad=(name,code,run)=>{assert.throws(run,error=>error.code===code);checks.push({name:'document-curve-ui-'+name,result:'PASS',expectedDenial:code,boundary:'pure adversarial shadow; not browser/CI execution evidence'});};
 const sets=documentCurveUiSourceSets(readSource),manifest=files=>files.map(file=>{const bytes=readSource(file);return {path:file,sha256:hash(bytes),gitBlobOid:createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex')};}),evidence=new Map(),actions=new Map([...[320,390,1280].map(width=>['journey-'+width,['UPLOAD','REVIEW_CURVE','APPLY_CURVE','SELECT']]),['amount-only',['UPLOAD']],['amount-gaps',['UPLOAD']],['inconsistent',['UPLOAD','REVIEW_CURVE']],['site-manager',['UPLOAD']],['lost-ack',['UPLOAD','REVIEW_CURVE','APPLY_CURVE']],['unknown',['UPLOAD']],['crossed-source',['UPLOAD']],['scope-change',['UPLOAD']]]);let sequence=1;
 const requests=[...actions].flatMap(([kind,values])=>[{kind,path:'/api/identity/plan-import',method:'GET',operationId:null,action:null},...values.map(action=>({kind,path:action==='SELECT'?'/api/identity/plan-baseline':'/api/identity/plan-import',method:'POST',operationId:'20000000-0000-4000-8000-'+String(sequence++).padStart(12,'0'),action}))]);const lostId=requests.find(row=>row.kind==='lost-ack'&&row.action==='APPLY_CURVE').operationId,unknownId=requests.find(row=>row.kind==='unknown'&&row.action==='UPLOAD').operationId;requests.push(...[['lost-ack',lostId],['unknown',unknownId]].map(([kind,operationId])=>({kind,path:'/api/identity/plan-import',method:'GET',operationId,action:null})));
 const screenshotManifest=['320-document-baseline.png','390-document-baseline.png','1280-document-baseline.png','390-amount-only-exact-money.png'].map((name,index)=>{const bytes=Buffer.alloc(24);Buffer.from([137,80,78,71,13,10,26,10]).copy(bytes);bytes.write('IHDR',12);bytes.writeUInt32BE([320,390,1280,390][index],16);bytes.writeUInt32BE(900,20);const path=DOCUMENT_CURVE_UI_ARTIFACTS[0]+'screenshots-shadow/'+name;evidence.set(path,bytes);return {path,sha256:hash(bytes)};});
 const proof={version:'plan-document-curve-ui-v1',status:'PASS',sourceState:'EXACT_CI_SOURCE',sourceRevision:expectedHead,sourceBaseRevision:expectedHead,sourceTree:expectedTree,trackedClean:true,environment:'isolated-localhost-next-exact-jsx-synthetic-document-wire',fixtureVersion:'synthetic-document-monthly-curve-wire-v1',widths:[320,390,1280],totalCheckCount:10,checks:[...[320,390,1280].map(width=>({check:'document-review-apply-explicit-baseline:'+width,width,documentWidth:width,targets:Array.from({length:7},()=>({width:44,height:44})),postActions:['UPLOAD','REVIEW_CURVE','APPLY_CURVE','SELECT'],taskWrites:0,baselineSelections:1})),{check:DOCUMENT_CURVE_UI_CHECKS[3],postCount:1,unknownCurrency:true,unknownCalendar:true,exactMoney:true,missingAmountInterruptsLine:true},{check:DOCUMENT_CURVE_UI_CHECKS[4],postCount:2,applyCount:0},{check:DOCUMENT_CURVE_UI_CHECKS[5],financialPosts:0,taskUploadCount:1},{check:DOCUMENT_CURVE_UI_CHECKS[6],postCount:3,recoveredOperationId:lostId},{check:DOCUMENT_CURVE_UI_CHECKS[7],postCount:1,retainedOperationId:unknownId},{check:DOCUMENT_CURVE_UI_CHECKS[8],postCount:1,privateFactsShown:false},{check:DOCUMENT_CURVE_UI_CHECKS[9],postCount:1,privateDraftCleared:true}],sourceManifest:manifest(sets.rendered),fixtureSourceManifest:manifest(sets.fixture),dependencyManifest:manifest(sets.dependencies),harnessSha256:spec.producerSha256,cleanupHelperSha256:hash(readSource('scripts/lib/owned-fixture-cleanup.mjs')),screenshotManifest,pageErrors:[],interceptErrors:[],externalRequests:[],apiRequests:requests,automaticPostCount:0,providerRequests:0,actualOcrVerified:false,productionLoginVerified:false,productionDataWritten:false,realPlanDocuments:false,realFinancialReview:false,physicalDeviceAccepted:false,cleanup:{browserClosed:true,serverClosed:true,gracefulCloseAcknowledged:true,fixtureRemoved:true,fixtureCleanupProof:{fixtureRemoved:true,postcondition:{absent:true}}}};
 const validate=(value,options={})=>validateExtensionProof(spec,Buffer.from(JSON.stringify(value)),{expectedHead,expectedTree,readSource,readEvidence:file=>evidence.get(file),...options}),mutate=(name,code,edit)=>{const value=clone(proof);edit(value);bad(name,code,()=>validate(value));};
 good('complete-shadow-contract-not-browser-evidence',()=>assert.equal(validate(proof).checks,10));good('exact-current-browser23-retains-frozen22-and-fixture-combined-prior9-and33',()=>{
  const beforeBudget=restorePlanBudgetPreviousContract(contract),budget=contract[PLAN_BUDGET_CURRENT_SECTION].sourceSetDeltas.find(row=>row.family===spec.kind),partida=beforeBudget[PLAN_PARTIDA_PREVIEW_CURRENT_SECTION].sourceSetDeltas.find(row=>row.family===spec.kind),native=PLAN_MEASUREMENT_CURRENT_PROOF_CHANGES.find(row=>row.kind===spec.kind),nativeAdditions=planMeasurementCurrentDependencies(spec.kind),outerAdditions=participantPreanalysisProofSourceAdditions(spec),additions=[...new Set([...nativeAdditions,...outerAdditions])].sort(),cyp='src/lib/plan-import-cyp-curve.mjs';
  equal(partida,PLAN_PARTIDA_PREVIEW_CURRENT_REVISION.sourceSetDeltas.find(row=>row.family===spec.kind),'PROOF_SOURCE_MANIFEST');equal(nativeAdditions,native.sourceAdditions,'PROOF_SOURCE_MANIFEST');equal([...outerAdditions].sort(),[...partida.additions,...budget.additions].sort(),'PROOF_SOURCE_MANIFEST');assert.equal(additions.length,nativeAdditions.length+outerAdditions.length);
  equal(sets.combined,spec.sourceFiles,'PROOF_SOURCE_MANIFEST');assert.equal(sets.combined.length,budget.currentCount);assert.equal(hash(canonical(sets.combined)),budget.currentPathsSha256);
  const beforeBudgetSources=sets.combined.filter(file=>!budget.additions.includes(file)),beforePartidaSources=beforeBudgetSources.filter(file=>!partida.additions.includes(file));equal(beforeBudgetSources,beforeBudget.extension.proofs.find(row=>row.kind===spec.kind).sourceFiles,'PROOF_SOURCE_MANIFEST');assert.equal(beforeBudgetSources.length,budget.previousCount);assert.equal(hash(canonical(beforeBudgetSources)),budget.previousPathsSha256);assert.equal(beforeBudgetSources.length,partida.currentCount);assert.equal(hash(canonical(beforeBudgetSources)),partida.currentPathsSha256);assert.equal(beforePartidaSources.length,partida.previousCount);assert.equal(hash(canonical(beforePartidaSources)),partida.previousPathsSha256);assert.equal(beforePartidaSources.length,native.currentSourceCount);assert.equal(hash(canonical(beforePartidaSources)),native.currentSourcePathsSha256);
  const renderedAdditions=[...partida.additions,...budget.additions.filter(file=>file.startsWith('src/app/'))].sort(),previousRendered=sets.rendered.filter(file=>!renderedAdditions.includes(file)),frozenRendered=previousRendered.filter(file=>file!==cyp);equal(sets.rendered.filter(file=>outerAdditions.includes(file)),renderedAdditions,'PROOF_SOURCE_MANIFEST');assert.equal(renderedAdditions.length,7);assert.equal(sets.rendered.length,23+renderedAdditions.length);assert.equal(previousRendered.length,23);assert.equal(previousRendered.filter(file=>file===cyp).length,1);assert.equal(frozenRendered.length,22);assert.equal(hash(canonical(frozenRendered)),'0f5221bb8af053c18d8387492141378df09a9780845539b5bdd6fa3206e06efa');
  const fixtureOuterAdditions=budget.additions.filter(file=>!renderedAdditions.includes(file)),previousCombined=sets.combined.filter(file=>!additions.includes(file));equal(sets.fixture.filter(file=>outerAdditions.includes(file)),fixtureOuterAdditions,'PROOF_SOURCE_MANIFEST');assert.equal(sets.fixture.length,9+nativeAdditions.length+fixtureOuterAdditions.length);assert.equal(sets.fixture.filter(file=>!additions.includes(file)).length,9);assert.equal(sets.combined.length,33+additions.length);assert.equal(previousCombined.length,33);assert.equal(previousCombined.length,native.previousSourceCount);assert.equal(hash(canonical(previousCombined)),native.previousSourcePathsSha256);
 });good('eighteenth-binding-command-and-retained-artifact',()=>{assert.equal(restoreParticipantPreanalysisPreviousContract(contract).extension.proofs.length,18);equal(workflow.jobs.plans.steps.find(step=>step.name===DOCUMENT_CURVE_UI_STEP.name),DOCUMENT_CURVE_UI_STEP,'WORKFLOW_NOT_EQUIVALENT');assert.ok(contract.lanes.plans.requiredRetainedEvidence.includes(spec.path));assert.ok(contract.lanes.plans.artifacts.includes(DOCUMENT_CURVE_UI_ARTIFACTS[0]));});
 bad('missing-tree','PROOF_SOURCE_TREE_RESOLVER',()=>validate(proof,{expectedTree:undefined}));bad('missing-screenshot-reader','PROOF_SCREENSHOT_RESOLVER',()=>validate(proof,{readEvidence:undefined}));bad('invalid-json','PROOF_JSON',()=>validateExtensionProof(spec,Buffer.from('{'),{expectedHead,expectedTree,readSource}));
 for(const [key,files] of [['sourceManifest',sets.rendered],['fixtureSourceManifest',sets.fixture],['dependencyManifest',sets.dependencies]])for(const file of files){mutate('missing-'+key+'-'+file,'PROOF_SOURCE_MANIFEST',p=>{p[key]=p[key].filter(ref=>ref.path!==file);});mutate('substituted-'+key+'-'+file,'PROOF_SOURCE_MANIFEST',p=>{p[key].find(ref=>ref.path===file).path='src/lib/foreign-document-curve.mjs';});mutate('stale-'+key+'-'+file,'PROOF_SOURCE_HASH',p=>{p[key].find(ref=>ref.path===file).sha256='f'.repeat(64);});mutate('wrong-GitOID-'+key+'-'+file,'PROOF_SOURCE_GIT_BLOB',p=>{p[key].find(ref=>ref.path===file).gitBlobOid='f'.repeat(40);});}
 bad('external-stylesheet-dependency','PROOF_DOCUMENT_SOURCE_IMPORT',()=>validate(proof,{readSource:file=>file==='src/app/(identity)/cuenta/plan-import-panel.module.css'?Buffer.from('@import \"https://foreign.invalid/private.css\";'):readSource(file)}));
 bad('nonliteral-private-import','PROOF_DOCUMENT_SOURCE_IMPORT',()=>validate(proof,{readSource:file=>file===DOCUMENT_CURVE_UI_RENDER_ROOTS[0]?Buffer.from('const hidden=\"foreign\";import(hidden);'):readSource(file)}));
 bad('missing-current-document-Git-node','PROOF_SOURCE_HASH',()=>validate(proof,{readSource:file=>file===DOCUMENT_CURVE_SOURCE?undefined:readSource(file)}));mutate('cleanup-helper-stale','PROOF_HARNESS_SOURCE',p=>{p.cleanupHelperSha256='f'.repeat(64);});mutate('wrong-harness','PROOF_HARNESS_SOURCE',p=>{p.harnessSha256='f'.repeat(64);});mutate('duplicate-browser-map','PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest[1]=clone(p.sourceManifest[0]);});mutate('local-dirty-is-not-CI','PROOF_SOURCE_STATE',p=>{p.sourceRevision=null;p.sourceState='LOCAL_DIRTY_REVIEW_SOURCE';p.trackedClean=false;});for(const key of ['sourceRevision','sourceBaseRevision'])mutate('foreign-'+key,'PROOF_SOURCE_HEAD',p=>{p[key]='f'.repeat(40);});mutate('foreign-tree','PROOF_SOURCE_TREE',p=>{p.sourceTree='f'.repeat(40);});mutate('previous-UI-version-cannot-certify-new-type','PROOF_SOURCE_STATE',p=>{p.version='plan-import-ui-v1';});mutate('wrong-environment','PROOF_DOCUMENT_UI_ENVIRONMENT',p=>{p.environment='production';});
 for(const key of ['providerRequests','automaticPostCount'])mutate('provider-'+key,'PROOF_PROVIDER_IO',p=>{p[key]=1;});for(const key of ['actualOcrVerified','productionLoginVerified','realPlanDocuments','realFinancialReview','physicalDeviceAccepted'])mutate('false-human-claim-'+key,'PROOF_PROVIDER_IO',p=>{p[key]=true;});for(const key of ['pageErrors','interceptErrors','externalRequests'])mutate('errors-'+key,'PROOF_UI_ERRORS',p=>{p[key]=['controlled failure'];});mutate('production-write','PROOF_PRODUCTION_BOUNDARY',p=>{p.productionDataWritten=true;});
 mutate('group-omitted','PROOF_CHECK_NAMES',p=>{p.checks.pop();});mutate('group-duplicated','PROOF_CHECK_NAMES',p=>{p.checks[1]=clone(p.checks[0]);});mutate('group-reordered','PROOF_CHECK_NAMES',p=>{p.checks.reverse();});mutate('wrong-viewport','PROOF_MATRIX',p=>{p.widths[0]=319;});for(const [key,value] of [['taskWrites',1],['baselineSelections',0],['documentWidth',321]])mutate('journey-'+key,'PROOF_DOCUMENT_UI_GUARDS',p=>{p.checks[0][key]=value;});mutate('target-too-small','PROOF_DOCUMENT_UI_GUARDS',p=>{p.checks[0].targets[0].height=43;});for(const key of ['unknownCurrency','unknownCalendar','exactMoney','missingAmountInterruptsLine'])mutate('amount-'+key,'PROOF_DOCUMENT_UI_GUARDS',p=>{p.checks[3][key]=false;});mutate('inconsistent-auto-apply','PROOF_DOCUMENT_UI_GUARDS',p=>{p.checks[4].applyCount=1;});mutate('limited-role-financial-upload','PROOF_DOCUMENT_UI_GUARDS',p=>{p.checks[5].financialPosts=1;});mutate('crossed-private-facts','PROOF_DOCUMENT_UI_GUARDS',p=>{p.checks[8].privateFactsShown=true;});mutate('scope-not-cleared','PROOF_DOCUMENT_UI_GUARDS',p=>{p.checks[9].privateDraftCleared=false;});
 mutate('gap-case-HTTP-omitted','PROOF_DOCUMENT_UI_REQUESTS',p=>{p.apiRequests=p.apiRequests.filter(row=>row.kind!=='amount-gaps');});mutate('recovery-UUID-crossed','PROOF_DOCUMENT_UI_REQUESTS',p=>{p.checks[6].recoveredOperationId=unknownId;});mutate('recovery-no-GET','PROOF_DOCUMENT_UI_REQUESTS',p=>{p.apiRequests=p.apiRequests.filter(row=>!(row.kind==='lost-ack'&&row.method==='GET'&&row.operationId));});mutate('recover-by-POST','PROOF_DOCUMENT_UI_REQUESTS',p=>{const row=p.apiRequests.find(row=>row.kind==='unknown'&&row.method==='GET'&&row.operationId);row.method='POST';row.action='UPLOAD';});mutate('foreign-endpoint','PROOF_DOCUMENT_UI_REQUESTS',p=>{p.apiRequests[0].path='/api/identity/participants';});mutate('two-POSTs-one-UUID','PROOF_DOCUMENT_UI_REQUESTS',p=>{const posts=p.apiRequests.filter(row=>row.method==='POST');posts[1].operationId=posts[0].operationId;});
 for(const key of ['browserClosed','serverClosed','gracefulCloseAcknowledged','fixtureRemoved'])mutate('cleanup-'+key,'PROOF_CLEANUP',p=>{p.cleanup[key]=false;});mutate('fixture-still-present','PROOF_CLEANUP',p=>{p.cleanup.fixtureCleanupProof.postcondition.absent=false;});mutate('screenshot-omitted','PROOF_SCREENSHOTS',p=>{p.screenshotManifest.pop();});mutate('screenshot-substituted','PROOF_SCREENSHOTS',p=>{p.screenshotManifest[0].sha256='f'.repeat(64);});mutate('screenshot-foreign-path','PROOF_SCREENSHOTS',p=>{p.screenshotManifest[0].path='foreign/320-document-baseline.png';});bad('screenshot-bytes-wrong','PROOF_SCREENSHOTS',()=>validate(proof,{readEvidence:file=>{const bytes=Buffer.from(evidence.get(file));bytes[16]^=1;return bytes;}}));
 for(const [name,code,edit] of [['command-removed','DOCUMENT_CURVE_UI_COMMAND',c=>{const block=c.blocks.find(row=>row.id===62);block.step.run=block.step.run.replace('node scripts/verify-plan-document-curve-ui.mjs','node scripts/foreign.mjs');block.commandSha256=hash(block.step.run);}],['source-substituted','DOCUMENT_CURVE_UI_SOURCE_CONTRACT',c=>{const target=c.extension.proofs.find(row=>row.kind==='UI_DOCUMENT_CURVE');target.sourceFiles[target.sourceFiles.indexOf(DOCUMENT_CURVE_SOURCE)]='src/lib/foreign-document-curve.mjs';}],['checks-substituted','DOCUMENT_CURVE_UI_CHECK_NAMES',c=>{c.extension.proofs.find(row=>row.kind==='UI_DOCUMENT_CURVE').checkNames[0]='foreign';}]]){const changed=clone(contract);edit(changed);bad('contract-'+name,code,()=>validateDocumentCurveUiContract(changed));}
 return checks;
}
function documentCurveCopyV1Shadow(readSource){
 const view='src/app/(identity)/cuenta/plan-source-curve.mjs',original=readSource(view),text=utf8(original),needle='../../../lib/plan-import-document-curve.mjs';
 if(text.split(needle).length!==2)deny('PROOF_DOCUMENT_CURVE_COPY');
 return {documentCurveSourceManifest:[view,DOCUMENT_CURVE_SOURCE,DOCUMENT_CURVE_COPY_HELPER].map(file=>({path:file,sha256:hash(readSource(file))})),fixtureTransforms:[{path:view,kind:'FLATTENED_FIXTURE_RELATIVE_IMPORT',sourceSha256:hash(original),copiedBeforeSha256:hash(original),fixtureSha256:hash(Buffer.from(text.replace(needle,'./plan-import-document-curve.mjs'))),fixtureRelativePath:'app/plan-source-curve.mjs',dependencySourcePath:DOCUMENT_CURVE_SOURCE,dependencyFixturePath:'app/plan-import-document-curve.mjs'}]};
}
function previousDocumentCurveCopyShadow(readSource){
 const view='src/app/(identity)/cuenta/plan-source-curve.mjs',original=readSource(view),text=utf8(original),cyp='../../../lib/plan-import-cyp-curve.mjs';
 if(!text.includes(cyp))return documentCurveCopyV1Shadow(readSource);
 if(hash(Buffer.from(utf8(readSource(DOCUMENT_CURVE_COPY_HELPER)).replaceAll('\r\n','\n')))!==WEEKLY_CYP_CURRENT_REVISION.documentCurveCopy.helperLfSha256)deny('PROOF_DOCUMENT_CURVE_COPY');
 let generated=original;const fixtureTransforms=[];
 for(const dependency of WEEKLY_CYP_CURRENT_REVISION.documentCurveCopy.dependencies){const needle='../../../lib/'+path.posix.basename(dependency);if(text.split(needle).length!==2)deny('PROOF_DOCUMENT_CURVE_COPY');const before=generated;generated=Buffer.from(utf8(before).replace(needle,'./'+path.posix.basename(dependency)));fixtureTransforms.push({path:view,kind:'FLATTENED_FIXTURE_RELATIVE_IMPORT',sourceSha256:hash(original),copiedBeforeSha256:hash(before),fixtureSha256:hash(generated),fixtureRelativePath:'app/plan-source-curve.mjs',dependencySourcePath:dependency,dependencyFixturePath:'app/'+path.posix.basename(dependency)});}
 return {documentCurveSourceManifest:[view,DOCUMENT_CURVE_SOURCE,DOCUMENT_CURVE_COPY_HELPER,'src/lib/plan-import-cyp-curve.mjs'].map(file=>({path:file,sha256:hash(readSource(file))})),fixtureTransforms};
}

// The historical two-dependency oracle remains literal. This adapter binds
// its exact helper inverse and the current copier's additional RAW rows.
const CAPTURE_DOCUMENT_COPY_HELPER_LF='f9125c97ff397d7cb058386080e7d842f59d7a5ed072bd87419615eebe135940';
const CAPTURE_DOCUMENT_COPY_PRODUCERS=Object.freeze({
 UI_INTAKE:['scripts/verify-employee-intake-ui.mjs','d8ee5bb420d2f46415cb4bf2ac6973a3d7b1eb03d7cde0baece00e64692f8043','files',true],
 UI_JOINT:['scripts/verify-participant-bank-intake-ui.mjs','3166df0525e9363f07487ff924b53ab73b1a571673b5bc3f71cf1446d27ba7b5','files',true],
 UI_CAUSAL:['scripts/verify-participant-bank-intake-ui.mjs','3166df0525e9363f07487ff924b53ab73b1a571673b5bc3f71cf1446d27ba7b5','files',true],
 UI_PREPARATION:['scripts/verify-project-preparation-ui.mjs','cd5c76caa731d7df4e73298adcf76096deab7935d3cc08efa916815b55a9a727','copiedFiles',false],
 UI_PORTFOLIO:['scripts/verify-portfolio-overview-ui.mjs','516d3399aaa8d437208cede178fd06de177d241a3b17bfc29013974624f6e8d1','files',false]
});
function documentCurveCopyShadow(readSource,spec){
 const rawContract=readSource('.github/workspace-acceptance-contract.json'),contract=JSON.parse(utf8(rawContract));
 // Even the historical branch is only callable in the explicit owned scope.
 captureBudget.verifyPlanBudgetCurrentSources(contract,readSource);
 if(!hasCaptureRuntime(contract))return previousDocumentCurveCopyShadow(readSource);
 return captureBudget.withCaptureRuntimePreviousSources(contract,readSource,(parent,parentRead)=>{
  const declared=contract.extension.proofs.find(row=>row.kind===spec?.kind),descriptor=CAPTURE_DOCUMENT_COPY_PRODUCERS[spec?.kind];
  if(!declared||!descriptor)deny('PROOF_DOCUMENT_CURVE_COPY');equal(spec,declared,'PROOF_DOCUMENT_CURVE_COPY');
  const used=new Map(),raw=file=>{const value=readSource(file);if(!Buffer.isBuffer(value))deny('PROOF_DOCUMENT_CURVE_COPY');const owned=Buffer.from(value);if(used.has(file)&&!used.get(file).equals(owned))deny('PROOF_DOCUMENT_CURVE_COPY');used.set(file,owned);return owned;};
  const lf=value=>Buffer.from(utf8(value).replaceAll('\r\n','\n')),helper=raw(DOCUMENT_CURVE_COPY_HELPER),previousHelper=parentRead(DOCUMENT_CURVE_COPY_HELPER);
  if(hash(lf(helper))!==CAPTURE_DOCUMENT_COPY_HELPER_LF||hash(previousHelper)!==WEEKLY_CYP_CURRENT_REVISION.documentCurveCopy.helperLfSha256)deny('PROOF_DOCUMENT_CURVE_COPY');
  const inverse=captureBudget.restoreCaptureRuntimePreviousSource(contract,DOCUMENT_CURVE_COPY_HELPER,helper);if(!inverse.equals(previousHelper))deny('PROOF_DOCUMENT_CURVE_COPY');
  const [producer,producerLf,filesName,capture]=descriptor,producerRaw=raw(producer);if(spec.producer!==producer||spec.producerSha256!==producerLf||hash(lf(producerRaw))!==producerLf)deny('PROOF_DOCUMENT_CURVE_COPY');
  const ast=parse(utf8(producerRaw),{sourceType:'module'}),imports=ast.program.body.filter(node=>node.type==='ImportDeclaration'&&node.source.value==='./lib/plan-document-curve-fixture-copy.mjs');
  if(imports.length!==1||!imports[0].specifiers.some(node=>node.type==='ImportSpecifier'&&node.imported.name==='copyPlanDocumentCurveFixture'&&node.local.name==='copyPlanDocumentCurveFixture'))deny('PROOF_DOCUMENT_CURVE_COPY');
  const declarations=ast.program.body.flatMap(node=>node.type==='VariableDeclaration'?node.declarations:[]),files=declarations.filter(node=>node.id.type==='Identifier'&&node.id.name===filesName);
  if(files.length!==1||files[0].init?.type!=='ArrayExpression'||files[0].init.elements.some(node=>node?.type!=='StringLiteral'))deny('PROOF_DOCUMENT_CURVE_COPY');
  const names=files[0].init.elements.map(node=>node.value),captureFiles=['participant-panel.js','participant-kyc-capture.js'];if(names.filter(name=>name==='plan-source-curve.mjs').length!==1||captureFiles.some(name=>names.includes(name)!==capture))deny('PROOF_DOCUMENT_CURVE_COPY');
  // Only the helper is projected. Actual curve source/dependency RAW bytes
  // continue through the original oracle and retain the original transforms.
  const expected=previousDocumentCurveCopyShadow(file=>file===DOCUMENT_CURVE_COPY_HELPER?previousHelper:raw(file));
  expected.documentCurveSourceManifest=expected.documentCurveSourceManifest.map(row=>row.path===DOCUMENT_CURVE_COPY_HELPER?{path:row.path,sha256:hash(helper)}:row);
  if(capture){
   const dependency='src/lib/capture-quality-policy.mjs',needle='../../../lib/capture-quality-policy.mjs';
   raw(dependency);const components=captureFiles.map(name=>'src/app/(identity)/cuenta/'+name);
   expected.documentCurveSourceManifest.push(...[dependency,...components].map(file=>({path:file,sha256:hash(raw(file))})));
   for(const file of components){const original=raw(file),text=utf8(original);if(text.split(needle).length!==2||!new RegExp('\\bfrom\\s+[\x27\x22]'+needle.replaceAll('.','\\.')+'[\x27\x22]').test(text))deny('PROOF_DOCUMENT_CURVE_COPY');const generated=Buffer.from(text.replace(needle,'./capture-quality-policy.mjs'));expected.fixtureTransforms.push({path:file,kind:'FLATTENED_FIXTURE_RELATIVE_IMPORT',sourceSha256:hash(original),copiedBeforeSha256:hash(original),fixtureSha256:hash(generated),fixtureRelativePath:'app/'+path.posix.basename(file),dependencySourcePath:dependency,dependencyFixturePath:'app/capture-quality-policy.mjs'});}
  }
  for(const[file,owned]of used){const value=readSource(file);if(!Buffer.isBuffer(value)||!value.equals(owned))deny('PROOF_DOCUMENT_CURVE_COPY');}
  equal(parent.extension.proofs.find(row=>row.kind===spec.kind).producer,producer,'PROOF_DOCUMENT_CURVE_COPY');
  return expected;
 });
}
function validateDocumentCurveCopyProof(spec,proof,readSource){
 if(!['UI_INTAKE','UI_PREPARATION','UI_PORTFOLIO','UI_JOINT','UI_CAUSAL'].includes(spec.kind))return;
 const expected=documentCurveCopyShadow(readSource,spec);
 if(!Array.isArray(proof.documentCurveSourceManifest)||!Array.isArray(proof.fixtureTransforms))deny('PROOF_DOCUMENT_CURVE_COPY');
 for(const ref of proof.documentCurveSourceManifest)exactKeys(ref,['path','sha256'],'PROOF_DOCUMENT_CURVE_COPY');
 equal([...proof.documentCurveSourceManifest].sort((a,b)=>a.path.localeCompare(b.path)),expected.documentCurveSourceManifest.sort((a,b)=>a.path.localeCompare(b.path)),'PROOF_DOCUMENT_CURVE_COPY');
 if(proof.fixtureTransforms.length!==expected.fixtureTransforms.length)deny('PROOF_DOCUMENT_CURVE_COPY');proof.fixtureTransforms.forEach((row,index)=>exactKeys(row,Object.keys(expected.fixtureTransforms[index]),'PROOF_DOCUMENT_CURVE_COPY'));equal(proof.fixtureTransforms,expected.fixtureTransforms,'PROOF_DOCUMENT_CURVE_COPY');
}
function documentCurveCopySelftest(spec,proof,validate){
 if(!['UI_INTAKE','UI_PREPARATION','UI_PORTFOLIO','UI_JOINT','UI_CAUSAL'].includes(spec.kind))return [];
 const checks=[],bad=(name,edit)=>{const value=clone(proof);edit(value);assert.throws(()=>validate(value),error=>error.code==='PROOF_DOCUMENT_CURVE_COPY');checks.push({name:spec.id+'-document-copy-'+name,result:'PASS',expectedDenial:'PROOF_DOCUMENT_CURVE_COPY',boundary:'pure source/relocation shadow; no UI execution'});};
 bad('source-map-missing',p=>{delete p.documentCurveSourceManifest;});bad('source-map-substituted',p=>{p.documentCurveSourceManifest[1].path='src/lib/foreign-document-curve.mjs';});bad('source-map-stale',p=>{p.documentCurveSourceManifest[1].sha256='f'.repeat(64);});bad('source-map-duplicate',p=>{p.documentCurveSourceManifest[1]=clone(p.documentCurveSourceManifest[0]);});bad('relocation-missing',p=>{p.fixtureTransforms=[];});
 for(const key of ['sourceSha256','copiedBeforeSha256','fixtureSha256'])bad('relocation-'+key,p=>{p.fixtureTransforms[0][key]='f'.repeat(64);});bad('relocation-foreign-root',p=>{p.fixtureTransforms[0].fixtureRelativePath='../foreign.mjs';});bad('relocation-wrong-module',p=>{p.fixtureTransforms[0].dependencySourcePath='src/lib/foreign-document-curve.mjs';});bad('relocation-untracked-fields',p=>{p.fixtureTransforms[0].exactCopied=true;});
 if(proof.fixtureTransforms.length>=2){bad('cyp-module-omitted',p=>{p.documentCurveSourceManifest=p.documentCurveSourceManifest.filter(row=>row.path!=='src/lib/plan-import-cyp-curve.mjs');});bad('second-relocation-omitted',p=>{p.fixtureTransforms.splice(1,1);});bad('relocations-reordered',p=>{p.fixtureTransforms.reverse();});for(const key of ['sourceSha256','copiedBeforeSha256','fixtureSha256'])bad('second-relocation-'+key,p=>{p.fixtureTransforms[1][key]='f'.repeat(64);});}
 return checks;
}
export function validateExtensionProof(spec,bytes,options){
 const {readSource,readEvidence,expectedHead}=options;
 if(['PG_COMPANY_KYC','PG_BANK','PG_INTAKE','PG_FIELD'].includes(spec.kind)&&typeof readSource==='function'){
  const rawContract=readSource('.github/workspace-acceptance-contract.json');
  const contract=Buffer.isBuffer(rawContract)?JSON.parse(utf8(rawContract)):null;
  captureBudget.verifyCaptureRuntimeCurrentSources(contract,readSource);
  if(hasCaptureRuntime(contract)){
   if(!head(expectedHead))deny('PROOF_SOURCE_RESOLVER');
   const owned=Buffer.from(bytes);let proof;try{proof=JSON.parse(utf8(owned));}catch(error){if(error.code)throw error;deny('PROOF_JSON');}
   // Bind every artifact read to the exact caller-owned RAW bytes. Rechecking
   // only at the endpoints would miss an A/B/A artifact-reader substitution.
   const boundEvidence=file=>{
    let actual;try{actual=typeof readEvidence==='function'?readEvidence(file):null;}catch(error){if(file===spec.path)deny('PROOF_NATIVE_RAW_BINDING');throw error;}
    if(file===spec.path&&(!Buffer.isBuffer(actual)||!actual.equals(owned)))deny('PROOF_NATIVE_RAW_BINDING');
    return actual;
   };
   boundEvidence(spec.path);
   const result=captureBudget.normalizeCaptureRuntimeNativeProof(contract,spec,proof,readSource,boundEvidence,(parent,parentSpec,projected,parentRead)=>{
    equal(parent.extension.proofs.find(row=>row.kind===spec.kind),parentSpec,'PROOF_NATIVE_PARENT_SPEC');
    return validatePreviousExtensionProof(parentSpec,Buffer.from(JSON.stringify(projected)),{...options,readSource:parentRead,readEvidence:boundEvidence});
   });
   boundEvidence(spec.path);
   if(!bytes.equals(owned))deny('PROOF_NATIVE_INPUT_CHANGED');
   const manifest=spec.kind==='PG_FIELD'?canonicalFieldManifest(spec,proof):proof.sourceManifest;
   return {...result,harnessSha256:spec.producerSha256,sourceManifestSha256:manifestDigest(manifest),sourceReferences:spec.sourceFiles.length,proofSha256:hash(owned),bytes:owned.length,checks:summary(spec,null,contract)};
  }
 }
 return validatePreviousExtensionProof(spec,bytes,options);
}
function validatePreviousExtensionProof(spec,bytes,{expectedHead,expectedTree,readSource,readEvidence,runId,runAttempt,expectedRoot}){
 if(spec.kind===PLAN_BUDGET_CI_KIND){
  const contract=JSON.parse(utf8(readSource('.github/workspace-acceptance-contract.json')));try{verifyPlanBudgetCurrentSources(contract,readSource);}catch{deny('PROOF_BINDING_SOURCE');}equal(spec,planBudgetCompiledProof(contract),'PROOF_BUDGET_UI_SPEC');if(hash(readSource(spec.producer))!==spec.producerSha256)deny('PROOF_HARNESS_SOURCE');
  const binding=planBudgetUiSourceBinding(readSource);equal(binding.sourceManifest.map(row=>row.path),spec.sourceFiles,'PROOF_SOURCE_MANIFEST');let result;try{result=validatePlanBudgetUiProofBytes(bytes,readSource,{expectedHead,expectedTree,expectedRoot,readEvidence});}catch(error){if(error.code==='PLAN_BUDGET_UI_REJECTED'||error.code==='PLAN_PARTIDA_PREVIEW_UI_PROOF_REJECTED')deny('PROOF_BUDGET_UI_BOUNDARY');throw error;}
  equal(result.screenshots.map(row=>row.path),planBudgetRetainedScreenshotPaths(contract),'PROOF_BUDGET_UI_SCREENSHOT_BINDING');
  return {id:spec.id,path:spec.path,producer:spec.producer,kind:spec.kind,result:'PASS',sourceRevision:expectedHead,harnessSha256:spec.producerSha256,sourceManifestSha256:expectedSourceDigest(spec,readSource),sourceReferences:spec.sourceFiles.length,proofSha256:hash(bytes),bytes:bytes.length,checks:budgetScreenshotSummary(result.screenshots)};
 }

 if(spec.kind===FIELD_TASK_PAGINATION_CI_KIND){
  let proof;try{proof=JSON.parse(utf8(bytes));}catch{deny('PROOF_JSON');}
  const result=validateFieldTaskPaginationCi(proof,{expectedHead,expectedTree,readSource,readEvidence,spec,runId,runAttempt});
  return {id:spec.id,path:spec.path,producer:spec.producer,kind:spec.kind,result:result.status,sourceRevision:expectedHead,harnessSha256:spec.producerSha256,sourceManifestSha256:manifestDigest(proof.sourceManifest),sourceReferences:spec.sourceFiles.length,proofSha256:hash(bytes),bytes:bytes.length,checks:spec.checkNames.length};
 }
 if(spec.kind===FOCUSED_WORKSPACE_CI_KIND){
  let proof;try{proof=JSON.parse(utf8(bytes));}catch{deny('PROOF_JSON');}
  const result=validateFocusedWorkspaceCi(proof,{expectedHead,expectedTree,readSource,readEvidence,spec,runId,runAttempt});
  return {id:spec.id,path:spec.path,producer:spec.producer,kind:spec.kind,result:result.status,sourceRevision:expectedHead,harnessSha256:spec.producerSha256,sourceManifestSha256:manifestDigest(proof.sourceManifest),sourceReferences:spec.sourceFiles.length,proofSha256:hash(bytes),bytes:bytes.length,checks:spec.checkNames.length};
 }
 if(spec.kind===PARTICIPANT_PREANALYSIS_KIND){
  let proof;try{proof=JSON.parse(utf8(bytes));}catch{deny('PROOF_JSON');}
  const result=validateParticipantKycPreanalysisCi(proof,{expectedHead,expectedTree,readSource,readEvidence,spec,runId,runAttempt});
  return {id:spec.id,path:spec.path,producer:spec.producer,kind:spec.kind,result:result.status,sourceRevision:expectedHead,harnessSha256:spec.producerSha256,sourceManifestSha256:manifestDigest(proof.sourceManifest),sourceReferences:spec.sourceFiles.length,proofSha256:hash(bytes),bytes:bytes.length,checks:summary(spec)};
 }
 if(!head(expectedHead)||typeof readSource!=='function')deny('PROOF_SOURCE_RESOLVER');let proof;try{proof=JSON.parse(utf8(bytes));}catch(error){if(error.code)throw error;deny('PROOF_JSON');}if(!proof||typeof proof!=='object'||Array.isArray(proof))deny('PROOF_SHAPE');
 const expectedStatus=spec.kind==='UI_CAUSAL'?'EXPECTED_CAUSAL_FAILURE':'PASS',actualStatus=spec.kind==='UI_PORTFOLIO'?(proof.state==='PASS_LOCAL_UI_NOT_RELEASE_ACCEPTANCE'?'PASS':'FAIL'):spec.kind==='PG_PREPARATION'?(proof.ok===true?'PASS':'FAIL'):spec.kind==='UI_PREPARATION'?(proof.validated===true?'PASS':'FAIL'):proof.status;if(actualStatus!==expectedStatus)deny('PROOF_STATUS');if((spec.kind==='PG_OVERTIME'?proof.realBusinessDatabaseUsed:['PG_COMPANY_KYC','PG_PORTFOLIO'].includes(spec.kind)?proof.productionDataTouched:proof.productionDataWritten)!==false)deny('PROOF_PRODUCTION_BOUNDARY');
 const canonicalFieldRaw=spec.kind==='PG_FIELD'?structuredClone(proof):null;
 if(isCanonicalField(spec))proof.sourceManifest=canonicalFieldManifest(spec,proof);
 const producerBytes=readSource(spec.producer);if(!Buffer.isBuffer(producerBytes)||hash(producerBytes)!==spec.producerSha256||proof.harnessSha256!==spec.producerSha256)deny('PROOF_HARNESS_SOURCE');
 if(spec.kind==='UI_DOCUMENT_CURVE')validateDocumentCurveUiProof(spec,proof,{expectedHead,expectedTree,readSource,readEvidence});
 if(spec.kind==='PG_PLAN_BASELINE')validatePlanBaselineNativeProof(spec,proof,{expectedHead,expectedTree,readSource});
 if(!Array.isArray(proof.sourceManifest))deny('PROOF_SOURCE_MANIFEST');equal(proof.sourceManifest.map(r=>r?.path).toSorted(),spec.sourceFiles.toSorted(),'PROOF_SOURCE_MANIFEST');
 for(const ref of proof.sourceManifest){exactKeys(ref,['path','sha256'],'PROOF_SOURCE_REFERENCE');sourcePath(ref.path);if(!sha(ref.sha256)||hash(readSource(ref.path))!==ref.sha256)deny('PROOF_SOURCE_HASH');}
 validateDocumentCurveCopyProof(spec,proof,readSource);
 if(proof.sourceRevision!==undefined&&proof.sourceRevision!==expectedHead)deny('PROOF_SOURCE_HEAD');
 if(spec.kind==='UI_DOCUMENT_CURVE'){/* DOM/source/cleanup facts validated above. */}
 else if(spec.kind==='PG_PLAN_BASELINE'){/* Native facts and rich manifests validated above. */}
 else if(isCanonicalField(spec)){
  validateCanonicalFieldProof(spec,proof,readSource);
  if(spec.kind==='PG_FIELD')normalizeAttendanceReviewNativeProof(canonicalFieldRaw,JSON.parse(utf8(readSource('.github/workspace-acceptance-contract.json'))),readSource,spec);
 }
 else if(isIdentity(spec)){try{proof=validateIdentityDestinationUxBrowserSupplement(proof,JSON.parse(readSource('.github/workspace-acceptance-contract.json')),{readSource,readEvidence});}catch(error){if(error.code==='IDENTITY_DESTINATION_UX_PROOF_REJECTED')deny('PROOF_IDENTITY_DESTINATION_'+error.reason);throw error;}validateIdentityProof(spec,proof,expectedHead);}
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
   validateCompanyKycExpiryNativeProof(proof);validateCompanyKycContextNativeProof(proof);
   validateIntegratedCompanyCurrentNative(proof,JSON.parse(readSource('.github/workspace-acceptance-contract.json')),readSource);
   validateWhatsappFieldNeutralStepNative(proof,'COMPANY',JSON.parse(readSource('.github/workspace-acceptance-contract.json')),readSource);
 }
 else if(spec.kind==='PG_BANK'||spec.kind==='PG_INTAKE'){if(proof.schemaRemoved!==true)deny('PROOF_CLEANUP');if(spec.kind==='PG_INTAKE'){try{proof=normalizePlanBudgetIntakeWithdrawalNativeProof(proof,JSON.parse(utf8(readSource('.github/workspace-acceptance-contract.json'))),readSource,spec);}catch(error){if(error.code==='PLAN_BUDGET_CURRENT_CI_LINEAGE_REJECTED'&&error.reason==='INTAKE_CHECK_NAMES')deny('PROOF_CHECK_NAMES');throw error;}}equal(proof.checks,spec.checkNames,'PROOF_CHECK_NAMES');if(spec.kind==='PG_BANK'){if(proof.realProviderCalls!==0)deny('PROOF_PROVIDER_IO');}else{if(proof.providerCalls!==0||proof.unexpectedNetworkCalls!==0)deny('PROOF_PROVIDER_IO');equal(proof.sqlFailures,[],'PROOF_SQL_ERRORS');}}
 else if(spec.kind==='UNIT'){
  if(proof.sourceRevision!==expectedHead||proof.sourceState!=='committed exact Git HEAD'||proof.trackedClean!==true||proof.postgresExecuted!==false)deny('PROOF_SOURCE_STATE');if(!Array.isArray(proof.suites))deny('PROOF_UNIT_SUITES');equal(proof.suites.map(s=>s.file),TEST_SUITES,'PROOF_UNIT_SUITES');if(typeof readEvidence!=='function')deny('PROOF_TAP_RESOLVER');
  for(const [index,suite] of proof.suites.entries()){exactKeys(suite,['file','exitCode','tests','pass','fail','cancelled','skipped','todo','caseNames','tap'],'PROOF_UNIT_SUITE_SHAPE');exactKeys(suite.tap,['path','bytes','sha256'],'PROOF_UNIT_TAP_SHAPE');if(suite.exitCode!==0||suite.tap.path!=='.vercel/participant-bank-intake-contract-evidence/suite-'+index+'.tap')deny('PROOF_UNIT_EXECUTION');const tap=readEvidence(suite.tap.path);if(!Buffer.isBuffer(tap)||tap.length!==suite.tap.bytes||hash(tap)!==suite.tap.sha256)deny('PROOF_TAP_DIGEST');let parsed;try{parsed=parseTap(tap,{recovery:index===4,expectedTests:EXPECTED_SUITE_COUNTS[suite.file]??null});}catch{deny('PROOF_UNIT_RESULTS');}equal(parsed,Object.fromEntries(['tests','pass','fail','cancelled','skipped','todo','caseNames'].map(k=>[k,suite[k]])),'PROOF_UNIT_RESULTS');}
  if(proof.suites.reduce((total,suite)=>total+suite.tests,0)!==EXPECTED_TOTAL_TESTS)deny('PROOF_UNIT_RESULTS');
 }else{
  equal(proof.errors,[],'PROOF_UI_ERRORS');if(spec.kind==='UI_INTAKE'){if(proof.providerCalls!==0||proof.realIdentityAccepted!==false)deny('PROOF_PROVIDER_IO');}else if(proof.realProviderCalls!==0||proof.postgresExecuted!==false)deny('PROOF_PROVIDER_IO');
  if(spec.kind==='UI_BANK'){if(proof.sourceRevision!==expectedHead||proof.fullSuite!==true)deny('PROOF_SOURCE_STATE');equal(proof.widths,[320,390,768,1280],'PROOF_MATRIX');matrix(proof.checks,proof.widths,['normal','invalid-cancel','lost-reload','unknown-close-reload','same-retry','stale','denied-forged','integrated']);}
  if(spec.kind==='UI_INTAKE'){
   equal(proof.widths,[320,390,768,1280],'PROOF_MATRIX');matrix(proof.checks,proof.widths,INTAKE_UI_MODES);
   if(proof.checks.some(row=>Object.keys(intakeUiExistingGuards(row.mode)).some(key=>row[key]!==true)))deny('PROOF_INTAKE_GUARDS');
   if(proof.checks.some(row=>row.posts!==intakeUiExpectedPosts(row.mode)||row.mode==='invite'&&row.canonicalInvitationPrepared!==true||row.mode==='scope-switch'&&row.scopeIsolated!==true||!['invite','scope-switch'].includes(row.mode)&&(row.privateStored!==false||row.automaticPost!==false)||row.mode==='paged-worker'&&['canonicalInvitationConfirmed','focusRetainedAfterInvite','focusedRefresh','fullListExplicit'].some(key=>row[key]!==true)||INTAKE_UI_FOCUSED_404_MODES.includes(row.mode)&&(row.focused404Cleared!==true||row.explicitListReconsulted!==true||row.confirmedReceiptRetained!==(row.mode!=='continuation-missing'))))deny('PROOF_INTAKE_GUARDS');
  }
  if(spec.kind==='UI_JOINT'||spec.kind==='UI_CAUSAL'){
   if(proof.sourceRevision!==expectedHead||proof.sourceState!=='committed exact Git HEAD'||proof.trackedClean!==true)deny('PROOF_SOURCE_STATE');equal(proof.dirtyTrackedPaths,[],'PROOF_SOURCE_STATE');if(proof.realIdentityAccepted!==false)deny('PROOF_PROVIDER_IO');
   if(spec.kind==='UI_JOINT'){equal(proof.widths,[320,390,768,1280],'PROOF_MATRIX');matrix(proof.checks,proof.widths,['bank','intake']);if(proof.badTransform!==null||proof.causalFailure!==null||proof.checks.some(c=>c.parentAndSiblingBlocked!==true||c.ownRecoveryAndLocalCloseEnabled!==true||c.noFeedbackDeadlock!==true||c.automaticPost!==false||c.storagePrivate!==true))deny('PROOF_JOINT_GUARDS');}
   else{equal(proof.widths,[320],'PROOF_MATRIX');equal(proof.checks,[],'PROOF_MATRIX');const transform=proof.badTransform,needle=CIVIL_CURRENT_BANK_LOCK,replacement=CIVIL_CURRENT_CAUSAL_BANK_LOCK;exactKeys(transform,['source','originalSha256','fixtureSha256','needle','replacement','runtimeSourceEdited'],'PROOF_CAUSAL_TRANSFORM');if(transform.source!=='src/app/(identity)/cuenta/participant-panel.js'||transform.needle!==needle||transform.replacement!==replacement||transform.runtimeSourceEdited!==false)deny('PROOF_CAUSAL_TRANSFORM');const original=readSource(transform.source),text=utf8(original);if(text.split(needle).length!==2||transform.originalSha256!==hash(original)||transform.fixtureSha256!==hash(Buffer.from(text.replace(needle,replacement))))deny('PROOF_CAUSAL_TRANSFORM');exactKeys(proof.causalFailure,['stage','message','expectedFailure'],'PROOF_CAUSAL_FAILURE');if(proof.causalFailure.stage!=='own-bank-save'||proof.causalFailure.expectedFailure!==true||typeof proof.causalFailure.message!=='string'||!proof.causalFailure.message.startsWith('own bank save must remain enabled while its own pending gates siblings'))deny('PROOF_CAUSAL_FAILURE');}
  }
 }
 return {id:spec.id,path:spec.path,producer:spec.producer,kind:spec.kind,result:expectedStatus,sourceRevision:expectedHead,harnessSha256:spec.producerSha256,sourceManifestSha256:manifestDigest(proof.sourceManifest),sourceReferences:spec.sourceFiles.length,proofSha256:hash(bytes),bytes:bytes.length,checks:summary(spec)};
}
function proofBindings(contract,lane,files,expectedHead,readSource){verifyWhatsappPlanTestSources(contract,readSource);return contract.extension.proofs.filter(p=>p.lane===lane).map(spec=>{if(hash(readSource(spec.producer))!==spec.producerSha256)deny('PROOF_HARNESS_SOURCE');return {id:spec.id,path:spec.path,producer:spec.producer,kind:spec.kind,result:spec.kind==='UI_CAUSAL'?'EXPECTED_CAUSAL_FAILURE':'PASS',sourceRevision:expectedHead,harnessSha256:spec.producerSha256,sourceManifestSha256:expectedSourceDigest(spec,readSource),sourceReferences:spec.sourceFiles.length,proofSha256:files.find(f=>f.path===spec.path).sha256,bytes:files.find(f=>f.path===spec.path).bytes,checks:summary(spec,files,contract)};});}
function assertProofBindings(bindings,contract,lane,files,expectedHead,readSource){
 return assertProofBindingsWithExpected(bindings,contract,lane,()=>proofBindings(contract,lane,files,expectedHead,readSource));
}
function assertProofBindingsWithExpected(bindings,contract,lane,expectedBindingsForLane){
 if(!Array.isArray(bindings))deny('PROOF_BINDINGS');const specs=contract.extension.proofs.filter(p=>p.lane===lane);equal(bindings.map(b=>b?.id),specs.map(p=>p.id),'PROOF_BINDINGS');const expectedBindings=expectedBindingsForLane();for(const [index,binding] of bindings.entries()){exactKeys(binding,['id','path','producer','kind','result','sourceRevision','harnessSha256','sourceManifestSha256','sourceReferences','proofSha256','bytes','checks'],'PROOF_BINDING_SHAPE');const expected=expectedBindings[index];if(!sha(binding.sourceManifestSha256)||binding.sourceManifestSha256!==expected.sourceManifestSha256)deny('PROOF_BINDING_SOURCE');equal(binding,expected,'PROOF_BINDING_IDENTITY');if(binding.bytes<1)deny('PROOF_BINDING_EMPTY');}
}
// Read producer manifests without executing PG, browsers or provider adapters.
// Literal arrays and relative-import walks mirror the current producer rules;
// changing a producer rule requires a corresponding reviewed selftest update.
function planBaselineCurrentSourceFiles(root){
 const files=new Set(['package.json','package-lock.json']);
 function visit(file){
  sourcePath(file);if(files.has(file))return;files.add(file);if(!/\.(mjs|js)$/.test(file))return;
  const ast=parse(readFileSync(path.join(root,file),'utf8'),{sourceType:'unambiguous',plugins:['jsx']}),imports=[];
  function walk(node){if(!node||typeof node!=='object')return;if(['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration'].includes(node.type)&&node.source?.value)imports.push(node.source.value);if(node.type==='ImportExpression'){if(node.source.type!=='StringLiteral')deny('PLAN_BASELINE_DYNAMIC_SOURCE');imports.push(node.source.value);}if(node.type==='CallExpression'&&node.callee?.type==='Import'){if(node.arguments[0]?.type!=='StringLiteral')deny('PLAN_BASELINE_DYNAMIC_SOURCE');imports.push(node.arguments[0].value);}for(const value of Object.values(node))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);}
  walk(ast.program);for(const ref of imports.filter(value=>value.startsWith('.'))){const base=path.posix.normalize(path.posix.join(path.posix.dirname(file),ref)),found=[base,base+'.mjs',base+'.js'].find(file=>existsSync(path.join(root,file)));if(!found)deny('PLAN_BASELINE_SOURCE_IMPORT');visit(found);}
 }
 PLAN_BASELINE_SOURCE_ROOTS.forEach(visit);return [...files].sort();
}
function planBaselineActualManifestEmitter(root,mutate=source=>source){
 const text=readFileSync(path.join(root,PLAN_BASELINE_SOURCE_ROOTS[0]),'utf8'),ast=parse(text,{sourceType:'module'});
 const nodes=ast.program.body.filter(node=>node.type==='ExportNamedDeclaration'&&node.declaration?.type==='FunctionDeclaration'&&node.declaration.id.name==='planBaselinePostgresSourceFiles');assert.equal(nodes.length,1);
 const declaration=nodes[0].declaration,source=mutate(text.slice(declaration.start,declaration.end));
 const result=runInNewContext('('+source+')',{assert,path,parse,readFileSync,existsSync},{timeout:5000})(root);
 return [...result];
}
export function validatePlanBaselineContract(contract){
 const spec=contract.extension.proofs.find(spec=>spec.kind==='PG_PLAN_BASELINE'),block=contract.blocks.find(block=>block.id===61);
 equal(block.step,PLAN_BASELINE_STEP,'PLAN_BASELINE_COMMAND');equal(spec.checkNames,PLAN_BASELINE_CHECKS,'PLAN_BASELINE_CHECK_NAMES');
 if([...PLAN_BASELINE_SOURCE_ROOTS,...PLAN_BASELINE_BACKEND_SOURCES,'package.json','package-lock.json'].some(file=>spec.sourceFiles.filter(value=>value===file).length!==1))deny('PLAN_BASELINE_SOURCE_CONTRACT');
 if(spec.sourceFiles.length!==33+planMeasurementCurrentDependencies(spec.kind).length+participantPreanalysisProofSourceAdditions(spec).length)deny('PLAN_BASELINE_SOURCE_CONTRACT');
 for(const current of contract.extension.proofs){const dependencies=planBaselineDependenciesFor(current.kind);if(dependencies.some(file=>current.sourceFiles.filter(source=>source===file).length!==1))deny('PLAN_BASELINE_CURRENT_SOURCE_DEPENDENCIES');}
}
function validatePlanBaselinePreviousSourceLineage(spec){
 let currentAdditions;try{currentAdditions=participantPreanalysisProofSourceAdditions(spec);}catch(error){if(error.code==='PLAN_MEASUREMENT_CURRENT_CI_LINEAGE_REJECTED')deny('PLAN_BASELINE_PREVIOUS_SOURCE_LINEAGE');throw error;}
  const dependencies=[...planBaselineDependenciesFor(spec.kind),...currentWhatsappFeedbackDependenciesFor(spec.kind),...planMeasurementCurrentDependencies(spec.kind),...currentAdditions],previous=spec.sourceFiles.filter(file=>!dependencies.includes(file)).toSorted();
 if(previous.length!==PLAN_BASELINE_PREVIOUS_SOURCE_COUNTS[spec.kind]||hash(canonical(previous))!==PLAN_BASELINE_PREVIOUS_SOURCE_PATHS_SHA256[spec.kind])deny('PLAN_BASELINE_PREVIOUS_SOURCE_LINEAGE');
}
function planBaselineSelftest(workflow,contract,root){
 const checks=[],spec=contract.extension.proofs.find(spec=>spec.kind==='PG_PLAN_BASELINE'),expectedHead='a'.repeat(40),expectedTree='b'.repeat(40);
 const readSource=file=>Buffer.from(readFileSync(path.join(root,sourcePath(file)),'utf8').replaceAll('\r\n','\n'));
 const good=(name,run)=>{run();checks.push({name:'plan-baseline-'+name,result:'PASS',boundary:'pure AST/emitter and native-proof shadow; no PG/browser/provider execution'});};
 const bad=(name,code,run)=>{assert.throws(run,error=>error.code===code);checks.push({name:'plan-baseline-'+name,result:'PASS',expectedDenial:code,boundary:'pure adversarial AST/emitter and native-proof shadow; no native execution'});};
 const refs=spec.sourceFiles.map(file=>{const bytes=readSource(file);return {path:file,sha256:hash(bytes),bytes:bytes.length,worktreeGitBlobOid:createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex')};});
 const proof={version:'plan-baseline-postgres-v1',status:'PASS',postgresExecuted:true,syntheticOnly:true,engine:{version:'PostgreSQL 17.6 shadow validator input',number:'170006',timezone:'UTC'},totalCheckCount:spec.checkNames.length,checks:spec.checkNames.map(check=>({check,status:'PASS'})),nativeLockObservations:[{pid:101,wait_event_type:'Lock',wait_event:'transactionid'}],sourceRevision:expectedHead,sourceTree:expectedTree,baseRevision:expectedHead,baseTree:expectedTree,sourceState:'EXACT_CI_SOURCE',trackedClean:true,sourceManifest:refs,sourceManifestAfter:clone(refs),harnessSha256:spec.producerSha256,syntheticBlobWrites:1,syntheticBlobReads:1,localOoxmlAnalyses:1,uncontrolledFetchAttempts:0,realProviderRequests:0,realProviderAcceptanceVerified:false,productionDataWritten:false,realWorkbookImported:false,realHumanSelectionVerified:false,currencyConfirmed:false,calendarConfirmed:false,actualCurveCreated:false,poolClosed:true,databaseRemoved:true,cleanup:{poolClosed:true,databaseRemoved:true,adminClosed:true,pgStatActivityBeforeDrop:0}};
 if(contract.weeklyCypCurrentRevision)Object.assign(proof,weeklyCypBaselineShadow());
 const validate=(value,options={})=>validateExtensionProof(spec,Buffer.from(JSON.stringify(value)),{expectedHead,expectedTree,readSource,...options});
 const mutate=(name,code,edit)=>{const value=clone(proof);edit(value);bad(name,code,()=>validate(value));};
 good('full-shadow-input-validates-not-execution-evidence',()=>assert.equal(validate(proof).checks,16));
 if(contract.weeklyCypCurrentRevision){
  good('weekly-seven-additional-native-names-bound-to-actual-producer-AST',()=>{const tree=parse(readFileSync(path.join(root,spec.producer),'utf8'),{sourceType:'module'}),names=tree.program.body.filter(node=>node.type==='ExportNamedDeclaration'&&node.declaration?.type==='VariableDeclaration').flatMap(node=>node.declaration.declarations).find(node=>node.id.name==='PLAN_BASELINE_INVESTMENT_POSTGRES_CHECKS');assert.ok(names);equal(names.init.arguments[0].elements.map(node=>node.value),WEEKLY_CYP_CURRENT_REVISION.baselineNative.addedCheckNames,'PROOF_WEEKLY_CYP_CHECK_NAMES');});
  for(const[name,edit]of [['omitted',p=>p.supplementalChecks.pop()],['duplicate',p=>p.supplementalChecks.push(clone(p.supplementalChecks[0]))],['reordered',p=>p.supplementalChecks.reverse()],['same-count-foreign',p=>{p.supplementalChecks[0].check='foreign';}]])mutate('weekly-'+name,'PROOF_WEEKLY_CYP_CHECK_NAMES',edit);
  mutate('weekly-historical-only','PROOF_CHECK_NAMES',p=>{p.totalCheckCount=16;delete p.investment;delete p.supplementalChecks;});
  for(const[name,edit]of [['missing-lock',p=>{p.investment.nativeLockObservations=[];}],['task-SQL',p=>{p.investment.taskSqlAttempts=1;}],['automatic-baseline',p=>{p.investment.baselineAutomaticallySelected=true;}],['missing-ACK-observation',p=>p.investment.commitObservations.pop()],['wrong-decimal',p=>{p.investment.comparison.differenceDecimalText='0';}],['tamper-case-omitted',p=>p.investment.tamperCases.pop()],['real-workbook-claim',p=>{p.investment.limits.realWorkbookImported=true;}]])mutate('weekly-'+name,'PROOF_WEEKLY_CYP_NATIVE',edit);
 }
 good('actual-emitter-and-independent-AST-both-exact33',()=>{equal(planBaselineActualManifestEmitter(root),spec.sourceFiles,'PROOF_SOURCE_MANIFEST');equal(planBaselineCurrentSourceFiles(root),spec.sourceFiles,'PROOF_SOURCE_MANIFEST');});
 good('native-version-and-current-sixteen-names-from-actual-producer-AST',()=>{const ast=parse(readFileSync(path.join(root,spec.producer),'utf8'),{sourceType:'module'}),declarations=ast.program.body.filter(node=>node.type==='ExportNamedDeclaration'&&node.declaration?.type==='VariableDeclaration').flatMap(node=>node.declaration.declarations),version=declarations.find(node=>node.id.name==='PLAN_BASELINE_POSTGRES_VERSION'),names=declarations.find(node=>node.id.name==='PLAN_BASELINE_POSTGRES_CHECKS');assert.equal(version.init.value,'plan-baseline-postgres-v1');const array=names.init.arguments[0];assert.equal(array.type,'ArrayExpression');assert.ok(array.elements.every(node=>node.type==='StringLiteral'));equal(array.elements.map(node=>node.value),spec.checkNames,'PROOF_CHECK_NAMES');});
 good('pre-document-native13-and-source31-lineage-retained',()=>{assert.equal(PLAN_BASELINE_PRE_DOCUMENT_CHECKS.length,13);equal(spec.checkNames.slice(0,13),PLAN_BASELINE_PRE_DOCUMENT_CHECKS,'PROOF_CHECK_NAMES');const previous=spec.sourceFiles.filter(file=>![DOCUMENT_CURVE_SOURCE,'tests/fixtures/plan-import-document-curve-synthetic.mjs',...planMeasurementCurrentDependencies(spec.kind),...participantPreanalysisProofSourceAdditions(spec)].includes(file));assert.equal(previous.length,31);assert.equal(hash(canonical(previous)),PLAN_BASELINE_PRE_DOCUMENT_SOURCE_PATHS_SHA256);});
 mutate('pre-document-producer-cannot-certify-current-native-documents','PROOF_HARNESS_SOURCE',p=>{p.harnessSha256=PLAN_BASELINE_PRE_DOCUMENT_PRODUCER_SHA256;});
 mutate('pre-document-native13-cannot-certify-document-native16','PROOF_CHECK_NAMES',p=>{p.checks=p.checks.slice(0,13);p.totalCheckCount=13;});
 mutate('pre-document-source31-cannot-certify-current-source33','PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>![DOCUMENT_CURVE_SOURCE,'tests/fixtures/plan-import-document-curve-synthetic.mjs',...planMeasurementCurrentDependencies(spec.kind),...participantPreanalysisProofSourceAdditions(spec)].includes(ref.path));p.sourceManifestAfter=clone(p.sourceManifest);assert.equal(p.sourceManifest.length,31);});
 good('new-step-in-plans-and-required-retained-output',()=>{equal(workflow.jobs.plans.steps.find(step=>step.name===PLAN_BASELINE_STEP.name),PLAN_BASELINE_STEP,'WORKFLOW_NOT_EQUIVALENT');assert.ok(contract.lanes.plans.requiredRetainedEvidence.includes(spec.path));assert.ok(workflow.jobs.plans.steps.at(-1).with.path.includes(PLAN_BASELINE_ARTIFACTS[0]));assert.equal(restoreParticipantPreanalysisPreviousContract(contract).extension.proofs.length,18);});
 bad('new-native-command-removal-cannot-be-resealed','PLAN_BASELINE_COMMAND',()=>{const changed=clone(contract),block=changed.blocks.find(block=>block.id===61);block.step.run=block.step.run.replace('node scripts/verify-plan-baseline-postgres.mjs\n','');block.commandSha256=hash(block.step.run);validatePlanBaselineContract(changed);});
 bad('native-guard-source-cannot-be-substituted-at-same-count','PLAN_BASELINE_SOURCE_CONTRACT',()=>{const changed=clone(contract),target=changed.extension.proofs.find(spec=>spec.kind==='PG_PLAN_BASELINE');target.sourceFiles[target.sourceFiles.indexOf(PLAN_BASELINE_SOURCE_ROOTS[1])]='tests/production-foreign-plan-baseline.test.mjs';validatePlanBaselineContract(changed);});
 const guardSeed="visit('tests/production-plan-baseline-postgres-target.test.mjs');";
 bad('actual-emitter-guard-root-omitted-causally-denied','PROOF_SOURCE_MANIFEST',()=>{const emitted=planBaselineActualManifestEmitter(root,source=>{assert.equal(source.split(guardSeed).length,2);return source.replace(guardSeed,'');});assert.equal(emitted.length,spec.sourceFiles.length-1);equal(emitted,spec.sourceFiles,'PROOF_SOURCE_MANIFEST');});
 bad('missing-tree-resolver','PROOF_SOURCE_TREE_RESOLVER',()=>validate(proof,{expectedTree:undefined}));
 bad('real-source-resolver-required','PROOF_SOURCE_RESOLVER',()=>validate(proof,{readSource:undefined}));
 bad('invalid-json','PROOF_JSON',()=>validateExtensionProof(spec,Buffer.from('{'),{expectedHead,expectedTree,readSource}));
 bad('invalid-UTF8','PROOF_ENCODING',()=>validateExtensionProof(spec,Buffer.from([255]),{expectedHead,expectedTree,readSource}));
 for(const file of spec.sourceFiles){
  mutate('missing-source-'+file,'PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>ref.path!==file);p.sourceManifestAfter=clone(p.sourceManifest);});
  mutate('same-count-substituted-source-'+file,'PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest.find(ref=>ref.path===file).path='src/lib/foreign-plan-baseline.mjs';p.sourceManifestAfter=clone(p.sourceManifest);});
  mutate('stale-source-hash-'+file,'PROOF_SOURCE_HASH',p=>{p.sourceManifest.find(ref=>ref.path===file).sha256='f'.repeat(64);p.sourceManifestAfter=clone(p.sourceManifest);});
  bad('missing-current-Git-node-'+file,file===spec.producer?'PROOF_HARNESS_SOURCE':'PROOF_SOURCE_HASH',()=>validate(proof,{readSource:ref=>ref===file?undefined:readSource(ref)}));
 }
 mutate('duplicate-source-same-count','PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest[1]=clone(p.sourceManifest[0]);p.sourceManifestAfter=clone(p.sourceManifest);});
 mutate('source-byte-length-forged','PROOF_SOURCE_GIT_BLOB',p=>{p.sourceManifest[0].bytes++;p.sourceManifestAfter=clone(p.sourceManifest);});
 mutate('source-GitOID-forged','PROOF_SOURCE_GIT_BLOB',p=>{p.sourceManifest[0].worktreeGitBlobOid='f'.repeat(40);p.sourceManifestAfter=clone(p.sourceManifest);});
 mutate('after-source-hash-changed','PROOF_SOURCE_AFTER',p=>{p.sourceManifestAfter[0].sha256='f'.repeat(64);});
 mutate('after-source-omitted','PROOF_SOURCE_AFTER',p=>{p.sourceManifestAfter.pop();});
 mutate('harness-substituted','PROOF_HARNESS_SOURCE',p=>{p.harnessSha256='f'.repeat(64);});
 mutate('wrong-status','PROOF_STATUS',p=>{p.status='FAIL';});
 mutate('local-dirty-native-receipt-is-not-CI','PROOF_SOURCE_STATE',p=>{p.sourceState='LOCAL_DIRTY_REVIEW_SOURCE';p.trackedClean=false;p.sourceRevision=null;p.sourceTree=null;});
 mutate('committed-local-native-is-not-CI','PROOF_SOURCE_STATE',p=>{p.sourceState='COMMITTED_LOCAL_SOURCE';});
 mutate('clean-required','PROOF_SOURCE_STATE',p=>{p.trackedClean=false;});
 for(const key of ['sourceRevision','baseRevision'])mutate('wrong-'+key,'PROOF_SOURCE_HEAD',p=>{p[key]='f'.repeat(40);});
 for(const key of ['sourceTree','baseTree'])mutate('wrong-'+key,'PROOF_SOURCE_TREE',p=>{p[key]='f'.repeat(40);});
 for(const key of ['postgresExecuted','syntheticOnly'])mutate('missing-native-'+key,'PROOF_POSTGRES_EXECUTION',p=>{p[key]=false;});
 mutate('non-UTC-engine','PROOF_POSTGRES_EXECUTION',p=>{p.engine.timezone='America/Argentina/Buenos_Aires';});
 mutate('wrong-major-engine','PROOF_POSTGRES_EXECUTION',p=>{p.engine.number='160001';});
 mutate('native-lock-absent','PROOF_NATIVE_LOCK',p=>{p.nativeLockObservations=[];});
 mutate('native-lock-is-not-lock','PROOF_NATIVE_LOCK',p=>{p.nativeLockObservations[0].wait_event_type='Client';});
 mutate('native-PID-invalid','PROOF_NATIVE_LOCK',p=>{p.nativeLockObservations[0].pid=0;});
 mutate('native-group-omitted','PROOF_CHECK_NAMES',p=>{p.checks.pop();});
 mutate('native-group-failed','PROOF_CHECK_NAMES',p=>{p.checks[0].status='FAIL';});
 mutate('native-count-forged','PROOF_CHECK_NAMES',p=>{p.totalCheckCount=12;});
 mutate('native-names-duplicated','PROOF_CHECK_NAMES',p=>{p.checks[1]=clone(p.checks[0]);});
 for(const key of ['syntheticBlobWrites','syntheticBlobReads','localOoxmlAnalyses'])mutate('fixture-not-observed-'+key,'PROOF_NATIVE_FIXTURE',p=>{p[key]=0;});
 for(const key of ['realProviderRequests','uncontrolledFetchAttempts'])mutate('provider-IO-'+key,'PROOF_PROVIDER_IO',p=>{p[key]=1;});
 for(const key of ['realProviderAcceptanceVerified','realWorkbookImported','realHumanSelectionVerified','currencyConfirmed','calendarConfirmed','actualCurveCreated'])mutate('false-claim-'+key,'PROOF_PROVIDER_IO',p=>{p[key]=true;});
 mutate('production-write','PROOF_PRODUCTION_BOUNDARY',p=>{p.productionDataWritten=true;});
 for(const key of ['poolClosed','databaseRemoved'])mutate('cleanup-not-positive-'+key,'PROOF_CLEANUP',p=>{p[key]=false;});
 for(const key of ['poolClosed','databaseRemoved','adminClosed'])mutate('cleanup-inner-not-positive-'+key,'PROOF_CLEANUP',p=>{p.cleanup[key]=false;});
 mutate('orphan-connection','PROOF_CLEANUP',p=>{p.cleanup.pgStatActivityBeforeDrop=1;});
 mutate('missing-cleanup-field','PROOF_CLEANUP',p=>{delete p.cleanup.adminClosed;});
 for(const current of contract.extension.proofs){const dependencies=planBaselineDependenciesFor(current.kind);if(!historicalPlanBaselineDependenciesFor(current.kind).length)continue;
  good(current.id+'-actual-current-closure-and-frozen-previous-path-set',()=>{validatePlanBaselinePreviousSourceLineage(current);equal(currentProducerSourceFiles(current,root),current.sourceFiles,'PROOF_SOURCE_MANIFEST');});
  for(const file of dependencies){const changed=clone(contract),target=changed.extension.proofs.find(spec=>spec.id===current.id);target.sourceFiles=target.sourceFiles.filter(source=>source!==file);bad(current.id+'-contract-missing-'+file,'PLAN_BASELINE_CURRENT_SOURCE_DEPENDENCIES',()=>validatePlanBaselineContract(changed));}
   const old=current.sourceFiles.filter(file=>!dependencies.includes(file)&&!currentWhatsappFeedbackDependenciesFor(current.kind).includes(file)&&!planMeasurementCurrentDependencies(current.kind).includes(file)&&!participantPreanalysisProofSourceAdditions(current).includes(file));good(current.id+'-previous-count-remains-'+old.length,()=>assert.equal(old.length,PLAN_BASELINE_PREVIOUS_SOURCE_COUNTS[current.kind]));
  const changed={...current,sourceFiles:[...current.sourceFiles]},index=changed.sourceFiles.findIndex(file=>!dependencies.includes(file));changed.sourceFiles[index]='src/lib/foreign-plan-baseline-previous.mjs';bad(current.id+'-previous-path-lineage-cannot-be-redefined','PLAN_BASELINE_PREVIOUS_SOURCE_LINEAGE',()=>validatePlanBaselinePreviousSourceLineage(changed));
 }
 return checks;
}
export function currentProducerSourceFiles(spec,root){
 if(spec.kind===PLAN_BUDGET_CI_KIND)return planBudgetUiSourceBinding(file=>readFileSync(path.join(root,file))).sourceManifest.map(row=>row.path);
 return captureRuntimeProducerSourceFiles({spec,root,legacyCollect:previousProducerSourceFiles,collectParentCompany:whatsappFieldCompanyNativeSourceFiles});
}
function previousProducerSourceFiles(spec,root){
 if(spec.kind===PLAN_BUDGET_CI_KIND)return planBudgetUiSourceBinding(file=>readFileSync(path.join(root,file))).sourceManifest.map(row=>row.path);
 if(spec.kind==='PG_COMPANY_KYC'){
  const contract=JSON.parse(readFileSync(path.join(root,'.github/workspace-acceptance-contract.json')));
  if(contract.whatsappFieldContinuityCurrentRevision){const scan=relative=>readdirSync(path.join(root,relative),{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?scan(relative+'/'+entry.name):[relative+'/'+entry.name]);return whatsappFieldCompanyNativeSourceFiles(file=>readFileSync(path.join(root,file)),scan('src/lib').sort());}
 }
 if(spec.kind===FIELD_TASK_PAGINATION_CI_KIND)return fieldTaskPaginationCiSourceClosure(file=>{try{const target=path.join(root,file);return lstatSync(target).isFile()?readFileSync(target):null;}catch{return null;}});
 if(spec.kind===FOCUSED_WORKSPACE_CI_KIND)return focusedWorkspaceCiSourceClosure(file=>{try{const target=path.join(root,file);return lstatSync(target).isFile()?readFileSync(target):null;}catch{return null;}});
 if(spec.kind===PARTICIPANT_PREANALYSIS_KIND)return participantPreanalysisCiSourceClosure(file=>{try{const target=path.join(root,file);return lstatSync(target).isFile()?readFileSync(target):null;}catch{return null;}});
 if(spec.kind==='UI_DOCUMENT_CURVE')return documentCurveUiSourceSets(file=>readFileSync(path.join(root,file))).combined;
 if(spec.kind==='PG_PLAN_BASELINE')return planBaselineCurrentSourceFiles(root);
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
 if(isIdentity(spec)){
  const seeds=[...text.matchAll(/\bcopyGraph\('([^']+)'\)/g)].map(match=>match[1]);const destination=spec.producerSha256===IDENTITY_DESTINATION_UX_CURRENT_REVISION.browser.producerDelta.currentProducerSha256;equal(seeds,['src/app/(identity)/cuenta/workspace-client.js','src/app/(identity)/cuenta/workspace-recovery-journal.mjs','src/lib/participant-policy.mjs',...(destination?IDENTITY_DESTINATION_UX_CURRENT_REVISION.browser.copyGraphAdditions:[])],'PROOF_IDENTITY_SOURCE_ROOTS');
  assert.equal(text.split("import {respondClosedCompanySubscription} from './lib/company-subscription-ui-fixture.mjs';").length,2,'One explicit closed subscription fixture import');
  assert.equal(text.split("pinFixtureGraph('scripts/lib/company-subscription-ui-fixture.mjs');").length,2,'One exact closed subscription fixture dependency graph');
  return walk([...seeds,COMPANY_SUBSCRIPTION_UI_FIXTURE]);
 }
 if(spec.kind==='PORTFOLIO_UNIT')return portfolioUnitSourceFiles(root);
 if(['UI_PORTFOLIO','UI_PREPARATION','UI_INTAKE'].includes(spec.kind)){assert.equal(text.split("from './lib/plan-document-curve-fixture-copy.mjs'").length,2,'One actual reviewed copier helper import');assert.equal(text.split('copyPlanDocumentCurveFixture({').length,2,'One actual reviewed copier call');}
 if(spec.kind==='UI_PORTFOLIO')return [...array('files').map(file=>'src/app/(identity)/cuenta/'+file),...documentCurveDependenciesFor(spec.kind),'src/lib/plan-import-cyp-curve.mjs'].sort();
 if(spec.kind==='PG_PORTFOLIO')return walk(array('sourcePaths'));
 if(spec.kind==='PG_BANK')return array('sourceFiles').sort();
 if(spec.kind==='PG_INTAKE')return array('sourcePaths').sort();
 if(spec.kind==='PG_PREPARATION')return array('sourcePaths').sort();
 if(spec.kind==='UI_PREPARATION')return [...array('copiedFiles').map(file=>'src/app/(identity)/cuenta/'+file),...documentCurveDependenciesFor(spec.kind),'src/lib/plan-import-cyp-curve.mjs'].sort();
 if(spec.kind==='UI_BANK'){const seeds=[...text.matchAll(/\bvisit\('([^']+)'(?:,true)?\)/g)].map(match=>match[1]);assert.equal(seeds.length,3,'Exact current bank producer roots');return walk(seeds);}
 if(spec.kind==='UI_INTAKE')return [...array('files').map(file=>'src/app/(identity)/cuenta/'+file),...literals(/\.\.\.\[([^\]]+)\]\.map\(file=>/g),...documentCurveDependenciesFor(spec.kind),'src/lib/plan-import-cyp-curve.mjs'].sort();
 if(spec.kind==='UI_JOINT'||spec.kind==='UI_CAUSAL')return walk(literals(/for\(const file of \[([^\]]+)\]\)visit\(file\);/g),array('files').map(file=>'src/app/(identity)/cuenta/'+file));
  assert.equal(spec.kind,'PG_COMPANY_KYC');const originalCompanyRoots="const sourceManifest=[...sources('src/lib'),'src/app/(identity)/cuenta/private-bank-account-format.mjs','scripts/fixtures/meta-signup-field-lifecycle-fixture.mjs','scripts/lib/kyc-context-feedback-native.mjs']",currentCompanyRoots=originalCompanyRoots.slice(0,-1)+",'scripts/lib/kyc-current-image-native.mjs'"+']';assert.equal(text.split(currentCompanyRoots).length,2,'One exact current company producer declaration');assert.equal(currentCompanyRoots.replace(",'scripts/lib/kyc-current-image-native.mjs'",''),originalCompanyRoots,'Exact previous company producer roots remain unchanged');
 const files=relative=>readdirSync(path.join(root,relative),{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(relative+'/'+entry.name):[relative+'/'+entry.name]);
  return [...files('src/lib'),COMPANY_KYC_FORMAT_CLOSURE_SOURCE,'scripts/fixtures/meta-signup-field-lifecycle-fixture.mjs',KYC_CONTEXT_NATIVE_HELPER,'scripts/lib/kyc-current-image-native.mjs'].sort();
}
function validateCompanyKycCurrentSourceClosure(contract){
  const spec=contract.extension.proofs.find(proof=>proof.kind==='PG_COMPANY_KYC'),dependencies=[...companyKycCurrentSourceClosureDependenciesFor(spec.kind),...planBaselineDependenciesFor(spec.kind),...currentWhatsappFeedbackDependenciesFor(spec.kind),...planMeasurementCurrentDependencies(spec.kind),...participantPreanalysisProofSourceAdditions(spec)];
 if(spec.sourceFiles.length!==COMPANY_KYC_EXPIRY_PREVIOUS_SOURCE_COUNTS[spec.kind]+dependencies.length||dependencies.some(file=>spec.sourceFiles.filter(source=>source===file).length!==1))deny('COMPANY_KYC_CURRENT_SOURCE_CLOSURE');
}
export function validateWhatsappFeedbackPreviousSourceLineage(spec){
 if(!currentWhatsappFeedbackDependenciesFor(spec?.kind).length)return;
 const required=[...currentWhatsappFeedbackDependenciesFor(spec?.kind),...planMeasurementCurrentDependencies(spec?.kind)];
 if(!Array.isArray(spec.sourceFiles)||required.some(file=>spec.sourceFiles.filter(source=>source===file).length!==1))deny('WHATSAPP_FEEDBACK_CURRENT_SOURCE_DEPENDENCIES');
 let currentAdditions;try{currentAdditions=participantPreanalysisProofSourceAdditions(spec);}catch(error){if(error.code!=='PLAN_MEASUREMENT_CURRENT_CI_LINEAGE_REJECTED')throw error;const counts=[INTEGRATED_IDENTITY_CURRENT_REVISION.proofSourceDeltas.find(row=>row.id===spec.id)?.currentCount,WHATSAPP_FIELD_CONTINUITY_CURRENT_REVISION.proofSourceDeltas.find(row=>row.id===spec.id)?.currentCount].filter(Number.isSafeInteger);if(new Set(spec.sourceFiles).size!==spec.sourceFiles.length||counts.length&&!counts.includes(spec.sourceFiles.length))deny('WHATSAPP_FEEDBACK_CURRENT_SOURCE_DEPENDENCIES');deny('WHATSAPP_FEEDBACK_PREVIOUS_SOURCE_LINEAGE');}
 const dependencies=[...currentWhatsappFeedbackDependenciesFor(spec?.kind),...planMeasurementCurrentDependencies(spec?.kind),...currentAdditions];
 if(!Array.isArray(spec.sourceFiles)||dependencies.some(file=>spec.sourceFiles.filter(source=>source===file).length!==1)||spec.sourceFiles.length!==WHATSAPP_FEEDBACK_PREVIOUS_SOURCE_COUNTS[spec.kind]+dependencies.length)deny('WHATSAPP_FEEDBACK_CURRENT_SOURCE_DEPENDENCIES');
 const previous=spec.sourceFiles.filter(file=>!dependencies.includes(file)).toSorted();
 if(previous.length!==WHATSAPP_FEEDBACK_PREVIOUS_SOURCE_COUNTS[spec.kind]||hash(canonical(previous))!==WHATSAPP_FEEDBACK_PREVIOUS_PATHS_SHA256[spec.kind])deny('WHATSAPP_FEEDBACK_PREVIOUS_SOURCE_LINEAGE');
 if(spec.kind==='PG_COMPANY_KYC'){
  if(!Array.isArray(spec.checkNames)||spec.checkNames.length!==13+COMPANY_KYC_CONTEXT_CHECK_SUFFIXES.length||hash(canonical(spec.checkNames.slice(0,13)))!==WHATSAPP_FEEDBACK_PREVIOUS_COMPANY_CHECKS_SHA256)deny('WHATSAPP_FEEDBACK_PREVIOUS_CHECK_LINEAGE');
  equal(spec.checkNames.slice(13),COMPANY_KYC_CONTEXT_CHECK_SUFFIXES.map(suffix=>'COMPANY'+suffix),'WHATSAPP_FEEDBACK_CURRENT_CHECK_NAMES');
 }
}
function validateCompanyKycPreviousSourceLineage(spec){
 let currentAdditions;try{currentAdditions=participantPreanalysisProofSourceAdditions(spec);}catch(error){if(error.code==='PLAN_MEASUREMENT_CURRENT_CI_LINEAGE_REJECTED')deny('COMPANY_KYC_PREVIOUS_SOURCE_LINEAGE');throw error;}
  const dependencies=[...companyKycCurrentSourceClosureDependenciesFor(spec.kind),...planBaselineDependenciesFor(spec.kind),...currentWhatsappFeedbackDependenciesFor(spec.kind),...planMeasurementCurrentDependencies(spec.kind),...currentAdditions];
 const previous=spec.sourceFiles.filter(file=>!dependencies.includes(file)).toSorted();
 if(hash(canonical(previous))!==COMPANY_KYC_EXPIRY_PREVIOUS_SOURCE_PATHS_SHA256)deny('COMPANY_KYC_PREVIOUS_SOURCE_LINEAGE');
}
function companyKycCurrentSourceClosureSelftest(spec,proof,root,validate){
 if(spec.kind!=='PG_COMPANY_KYC')return [];
  const dependencies=[...companyKycCurrentSourceClosureDependenciesFor(spec.kind),...planBaselineDependenciesFor(spec.kind),...currentWhatsappFeedbackDependenciesFor(spec.kind),...planMeasurementCurrentDependencies(spec.kind),...participantPreanalysisProofSourceAdditions(spec)],checks=[],prefix=spec.id+'-expiry-current-source-';if(!dependencies.length)return checks;
 const good=(name,run)=>{run();checks.push({name:prefix+name,result:'PASS',boundary:'pure source and shadow proof; no PG/UI/provider execution'});};
 const mutate=(name,code,edit)=>{const value=clone(proof);edit(value);assert.throws(()=>validate(value),error=>error.code===code);checks.push({name:prefix+name,result:'PASS',expectedDenial:code,boundary:'pure adversarial shadow proof'});};
 good('actual-emitter-and-declared-corpus-exact',()=>equal(currentProducerSourceFiles(spec,root),spec.sourceFiles.toSorted(),'PROOF_SOURCE_MANIFEST'));
 good('previous-209-path-lineage-immutable',()=>{const previous=spec.sourceFiles.filter(file=>!dependencies.includes(file)).toSorted();assert.equal(previous.length,209);validateCompanyKycPreviousSourceLineage(spec);});
 for(const file of dependencies){
  good('source-pinned-once-'+file,()=>assert.equal(spec.sourceFiles.filter(source=>source===file).length,1));
  mutate('missing-source-'+file,'PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>ref.path!==file);});
  mutate('changed-source-hash-'+file,'PROOF_SOURCE_HASH',p=>{p.sourceManifest.find(ref=>ref.path===file).sha256='f'.repeat(64);});
  mutate('same-count-foreign-source-'+file,'PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest.find(ref=>ref.path===file).path='src/lib/foreign-expiry-source.mjs';assert.equal(p.sourceManifest.length,spec.sourceFiles.length);});
 }
  mutate('initial-210-emitter-omission-cannot-certify-AST-closure','PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>ref.path!==COMPANY_KYC_FORMAT_CLOSURE_SOURCE&&!planBaselineDependenciesFor(spec.kind).includes(ref.path)&&!currentWhatsappFeedbackDependenciesFor(spec.kind).includes(ref.path)&&!planMeasurementCurrentDependencies(spec.kind).includes(ref.path)&&!participantPreanalysisProofSourceAdditions(spec).includes(ref.path));assert.equal(p.sourceManifest.length,210);});
 mutate('previous-209-manifest-cannot-certify-expiry','PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>!dependencies.includes(ref.path));assert.equal(p.sourceManifest.length,209);});
 mutate('previous-reviewed-producer-cannot-certify-current-native-groups','PROOF_HARNESS_SOURCE',p=>{p.harnessSha256=COMPANY_KYC_EXPIRY_PREVIOUS_PRODUCER_SHA256;});
 return checks;
}
function companyKycCurrentSourceContractSelftest(contract){
 const checks=[],spec=contract.extension.proofs.find(proof=>proof.kind==='PG_COMPANY_KYC');
 for(const file of companyKycCurrentSourceClosureDependenciesFor(spec.kind)){
  const changed=clone(restoreParticipantPreanalysisPreviousContract(contract));changed.extension.proofs.find(proof=>proof.id===spec.id).sourceFiles=spec.sourceFiles.map(source=>source===file?'src/lib/foreign-current-expiry-source.mjs':source);
  assert.throws(()=>validateContract(changed),error=>error.code==='COMPANY_KYC_CURRENT_SOURCE_CLOSURE');checks.push({name:spec.id+'-expiry-contract-same-count-source-denied-'+file,result:'PASS',expectedDenial:'COMPANY_KYC_CURRENT_SOURCE_CLOSURE',boundary:'pure adversarial CURRENT contract'});
 }
 const changed=clone(contract),target=changed.extension.proofs.find(proof=>proof.id===spec.id);assert.ok(target.sourceFiles.includes('src/lib/geo.js'));target.sourceFiles[target.sourceFiles.indexOf('src/lib/geo.js')]='src/lib/foreign-expiry-baseline.mjs';
 // Keep the frozen lineage assertion independent from the existing Gate
 // control that substitutes a declared path to exercise PROOF_BINDING_SOURCE.
 validateCompanyKycPreviousSourceLineage(spec);
 assert.throws(()=>validateCompanyKycPreviousSourceLineage(target),error=>error.code==='COMPANY_KYC_PREVIOUS_SOURCE_LINEAGE');checks.push({name:spec.id+'-expiry-contract-frozen-209-path-lineage-denied',result:'PASS',expectedDenial:'COMPANY_KYC_PREVIOUS_SOURCE_LINEAGE',boundary:'pure adversarial CURRENT source lineage'});
 return checks;
}
function currentKycStatusClosureSelftest(spec,proof,root,validate){
 const dependencies=currentKycStatusDependenciesFor(spec.kind);if(!dependencies.length)return [];
 const previousCount=CURRENT_KYC_STATUS_BASE_COUNTS[spec.kind]??CURRENT_KYC_FEEDBACK_ONLY_BASE_COUNTS[spec.kind];assert.ok(Number.isSafeInteger(previousCount));
 const checks=[],prefix=spec.id+'-current-kyc-status-';
 const good=(name,run)=>{run();checks.push({name:prefix+name,result:'PASS',boundary:'pure CURRENT source fixture; no PG/UI/provider execution'});};
 const mutate=(name,code,edit)=>{const value=clone(proof);edit(value);assert.throws(()=>validate(value),error=>error.code===code);checks.push({name:prefix+name,result:'PASS',boundary:'pure adversarial CURRENT source fixture'});};
 const rewrite=(value,file,{remove=false,replacement=null,changedHash=false}={})=>{
  let changed=0;
  if(spec.kind==='PG_FIELD'){
   for(const map of [value.sourceSha256,value.voiceProgressSourceSha256,value.mediaLeaseSourceSha256,value.videoAudioSourceSha256,value.participantKycFixture.sourceSha256])if(Object.hasOwn(map,file)){
    const original=map[file];if(remove||replacement)delete map[file];if(replacement)map[replacement]=original;if(changedHash)map[file]='f'.repeat(64);changed++;
   }
  }else{
   const key=spec.kind==='PG_OVERTIME'?'file':'path';
   value.sourceManifest=value.sourceManifest.filter(ref=>{if(ref[key]!==file)return true;changed++;if(replacement)ref[key]=replacement;if(changedHash)ref.sha256='f'.repeat(64);return !remove;});
  }
  assert.ok(changed>0,'CURRENT source exists in shadow manifest: '+file);
 };
 good('exact-additive-count-and-producer-closure',()=>{assert.equal(spec.sourceFiles.length,previousCount+dependencies.length+calendarPreparationDependenciesFor(spec.kind).length+whatsappPlanImportDependenciesFor(spec.kind).length+organizationUsageDependenciesFor(spec.kind).length+proofFixtureDependenciesFor(spec.kind).length+civilDataDependenciesFor(spec.kind).length+companyKycCurrentSourceClosureDependenciesFor(spec.kind).length+companySubscriptionBackendDependenciesFor(spec.kind).length+companySubscriptionFixtureDependenciesFor(spec.kind).length+taskMeasurementDependenciesFor(spec.kind).length+planBaselineDependenciesFor(spec.kind).length+planMeasurementCurrentDependencies(spec.kind).length+participantPreanalysisProofSourceAdditions(spec).length);equal(currentProducerSourceFiles(spec,root),spec.sourceFiles.toSorted(),'PROOF_SOURCE_MANIFEST');});
 for(const file of dependencies){
  good('source-pinned-'+file,()=>assert.ok(spec.sourceFiles.includes(file)));
  mutate('missing-source-'+file,'PROOF_SOURCE_MANIFEST',value=>rewrite(value,file,{remove:true}));
  mutate('changed-source-hash-'+file,'PROOF_SOURCE_HASH',value=>rewrite(value,file,{changedHash:true}));
  mutate('same-count-foreign-source-'+file,'PROOF_SOURCE_MANIFEST',value=>rewrite(value,file,{replacement:'src/lib/foreign-current-kyc-source.mjs'}));
 }
 mutate('previous-current-manifest-cannot-certify-reader','PROOF_SOURCE_MANIFEST',value=>{for(const file of [...dependencies,...calendarPreparationDependenciesFor(spec.kind),...whatsappPlanImportDependenciesFor(spec.kind),...organizationUsageDependenciesFor(spec.kind),...proofFixtureDependenciesFor(spec.kind),...civilDataDependenciesFor(spec.kind),...companyKycCurrentSourceClosureDependenciesFor(spec.kind),...companySubscriptionBackendDependenciesFor(spec.kind),...companySubscriptionFixtureDependenciesFor(spec.kind),...taskMeasurementDependenciesFor(spec.kind),...planBaselineDependenciesFor(spec.kind),...planMeasurementCurrentDependencies(spec.kind),...participantPreanalysisProofSourceAdditions(spec)])rewrite(value,file,{remove:true});const count=isCanonicalField(spec)?canonicalFieldManifest(spec,value).length:value.sourceManifest.length;assert.equal(count,previousCount);});
 const replyDependencies=currentKycReplyFeedbackDependenciesFor(spec.kind);
 if(replyDependencies.length)mutate('previous-reply-manifest-cannot-certify-delivery-reader','PROOF_SOURCE_MANIFEST',value=>{for(const file of replyDependencies)rewrite(value,file,{remove:true});const count=isCanonicalField(spec)?canonicalFieldManifest(spec,value).length:value.sourceManifest.length;assert.equal(count,spec.sourceFiles.length-replyDependencies.length);});
 checks.push(...organizationUsageClosureSelftest(spec,proof,root,validate));
 return checks;
}
function organizationUsageClosureSelftest(spec,proof,root,validate){
  const dependencies=[...organizationUsageDependenciesFor(spec.kind),...proofFixtureDependenciesFor(spec.kind),...civilDataDependenciesFor(spec.kind),...companyKycCurrentSourceClosureDependenciesFor(spec.kind),...commercialAcceptanceDependenciesFor(spec.kind),...planBaselineDependenciesFor(spec.kind),...currentWhatsappFeedbackDependenciesFor(spec.kind),...planMeasurementCurrentDependencies(spec.kind),...participantPreanalysisProofSourceAdditions(spec)];if(!dependencies.length)return [];
 const previousCount=ORGANIZATION_USAGE_PREVIOUS_SOURCE_COUNTS[spec.kind]??CIVIL_PREVIOUS_SOURCE_COUNTS[spec.kind],checks=[],prefix=spec.id+'-organization-usage-';
 const good=(name,run)=>{run();checks.push({name:prefix+name,result:'PASS',boundary:'pure CURRENT source fixture; no PG/UI/provider execution'});};
 const mutate=(name,code,edit)=>{const value=clone(proof);edit(value);assert.throws(()=>validate(value),error=>error.code===code);checks.push({name:prefix+name,result:'PASS',expectedDenial:code,boundary:'pure adversarial CURRENT source fixture'});};
 const rewrite=(value,file,{remove=false,replacement=null,changedHash=false}={})=>{
  let changed=0;
  if(spec.kind==='PG_FIELD'){
   for(const map of [value.sourceSha256,value.voiceProgressSourceSha256,value.mediaLeaseSourceSha256,value.videoAudioSourceSha256,value.participantKycFixture.sourceSha256])if(Object.hasOwn(map,file)){
    const original=map[file];if(remove||replacement)delete map[file];if(replacement)map[replacement]=original;if(changedHash)map[file]='f'.repeat(64);changed++;
   }
  }else{
   const key=spec.kind==='PG_OVERTIME'?'file':'path';
   value.sourceManifest=value.sourceManifest.filter(ref=>{if(ref[key]!==file)return true;changed++;if(replacement)ref[key]=replacement;if(changedHash)ref.sha256='f'.repeat(64);return !remove;});
  }
  assert.ok(changed>0,'CURRENT organization usage source exists: '+file);
 };
 good('exact-additive-count-and-real-AST-closure',()=>{assert.equal(spec.sourceFiles.length,previousCount+dependencies.length);equal(currentProducerSourceFiles(spec,root),spec.sourceFiles.toSorted(),'PROOF_SOURCE_MANIFEST');});
  if(civilDataDependenciesFor(spec.kind).length+companyKycCurrentSourceClosureDependenciesFor(spec.kind).length)good('civil-current-count-and-closure-exact',()=>assert.equal(spec.sourceFiles.length,CIVIL_PREVIOUS_SOURCE_COUNTS[spec.kind]+civilDataDependenciesFor(spec.kind).length+companyKycCurrentSourceClosureDependenciesFor(spec.kind).length+commercialAcceptanceDependenciesFor(spec.kind).length+planBaselineDependenciesFor(spec.kind).length+currentWhatsappFeedbackDependenciesFor(spec.kind).length+planMeasurementCurrentDependencies(spec.kind).length+participantPreanalysisProofSourceAdditions(spec).length));
 for(const file of dependencies){
  good('source-pinned-once-'+file,()=>assert.equal(spec.sourceFiles.filter(source=>source===file).length,1));
  mutate('missing-source-'+file,'PROOF_SOURCE_MANIFEST',value=>rewrite(value,file,{remove:true}));
  mutate('changed-source-hash-'+file,'PROOF_SOURCE_HASH',value=>rewrite(value,file,{changedHash:true}));
  mutate('same-count-foreign-source-'+file,'PROOF_SOURCE_MANIFEST',value=>{rewrite(value,file,{replacement:'src/lib/foreign-organization-usage-source.mjs'});assert.equal(isCanonicalField(spec)?canonicalFieldManifest(spec,value).length:value.sourceManifest.length,previousCount+dependencies.length);});
 }
 mutate('previous-current-manifest-cannot-certify-usage','PROOF_SOURCE_MANIFEST',value=>{for(const file of dependencies)rewrite(value,file,{remove:true});assert.equal(isCanonicalField(spec)?canonicalFieldManifest(spec,value).length:value.sourceManifest.length,previousCount);});
 return checks;
}
function validateOrganizationUsageProofSources(contract){
 for(const spec of contract.extension.proofs){
  if(proofFixtureDependenciesFor(spec.kind).some(file=>spec.sourceFiles.filter(source=>source===file).length!==1))deny('CURRENT_PROOF_FIXTURE_SOURCE_DEPENDENCIES');
  const dependencies=organizationUsageDependenciesFor(spec.kind);if(!dependencies.length)continue;
  if(spec.kind==='PG_COMPANY_KYC'&&companyKycCurrentSourceClosureDependenciesFor(spec.kind).some(file=>!spec.sourceFiles.includes(file)))deny('COMPANY_KYC_CURRENT_SOURCE_CLOSURE');
  if(dependencies.some(file=>!spec.sourceFiles.includes(file))||spec.sourceFiles.length!==ORGANIZATION_USAGE_PREVIOUS_SOURCE_COUNTS[spec.kind]+dependencies.length+proofFixtureDependenciesFor(spec.kind).length+civilDataDependenciesFor(spec.kind).length+companyKycCurrentSourceClosureDependenciesFor(spec.kind).length+commercialAcceptanceDependenciesFor(spec.kind).length+planBaselineDependenciesFor(spec.kind).length+currentWhatsappFeedbackDependenciesFor(spec.kind).length+planMeasurementCurrentDependencies(spec.kind).length+participantPreanalysisProofSourceAdditions(spec).length)deny('ORGANIZATION_USAGE_SOURCE_DEPENDENCIES');
 }
}
function validateCivilDataProofSources(contract){
 for(const spec of contract.extension.proofs){
  const dependencies=civilDataDependenciesFor(spec.kind);if(!dependencies.length)continue;
  if(dependencies.some(file=>spec.sourceFiles.filter(source=>source===file).length!==1))deny('PARTICIPANT_CIVIL_SOURCE_DEPENDENCIES');
  if(['PG_BANK','PG_INTAKE'].includes(spec.kind)&&spec.sourceFiles.length!==CIVIL_PREVIOUS_SOURCE_COUNTS[spec.kind]+dependencies.length+planMeasurementCurrentDependencies(spec.kind).length+participantPreanalysisProofSourceAdditions(spec).length)deny('PARTICIPANT_CIVIL_SOURCE_DEPENDENCIES');
 }
}
function organizationUsageContractSelftest(contract){
 const checks=[];
 for(const spec of contract.extension.proofs)for(const file of organizationUsageDependenciesFor(spec.kind))for(const mode of ['missing','foreign']){
  const changed=clone(restoreParticipantPreanalysisPreviousContract(contract)),target=changed.extension.proofs.find(proof=>proof.id===spec.id);
  if(mode==='missing')target.sourceFiles=target.sourceFiles.filter(source=>source!==file);else target.sourceFiles[target.sourceFiles.indexOf(file)]='src/lib/foreign-organization-usage-source.mjs';
  assert.throws(()=>validateContract(changed),error=>error.code==='ORGANIZATION_USAGE_SOURCE_DEPENDENCIES');
  checks.push({name:spec.id+'-organization-usage-contract-source-'+mode+'-'+file,result:'PASS',expectedDenial:'ORGANIZATION_USAGE_SOURCE_DEPENDENCIES',boundary:'pure CURRENT contract fixture'});
 }
 for(const spec of contract.extension.proofs)for(const file of proofFixtureDependenciesFor(spec.kind))for(const mode of ['missing','foreign']){
  const changed=clone(restoreParticipantPreanalysisPreviousContract(contract)),target=changed.extension.proofs.find(proof=>proof.id===spec.id);
  if(mode==='missing')target.sourceFiles=target.sourceFiles.filter(source=>source!==file);else target.sourceFiles[target.sourceFiles.indexOf(file)]='scripts/lib/foreign-intake-causal-fixture.mjs';
  assert.throws(()=>validateContract(changed),error=>error.code==='CURRENT_PROOF_FIXTURE_SOURCE_DEPENDENCIES');
  checks.push({name:spec.id+'-current-causal-fixture-contract-'+mode,result:'PASS',expectedDenial:'CURRENT_PROOF_FIXTURE_SOURCE_DEPENDENCIES',boundary:'pure CURRENT contract fixture'});
 }
 for(const spec of contract.extension.proofs)for(const file of civilDataDependenciesFor(spec.kind))for(const mode of ['missing','foreign']){
  const changed=clone(restoreParticipantPreanalysisPreviousContract(contract)),target=changed.extension.proofs.find(proof=>proof.id===spec.id);
  if(mode==='missing')target.sourceFiles=target.sourceFiles.filter(source=>source!==file);else target.sourceFiles[target.sourceFiles.indexOf(file)]='src/lib/foreign-participant-civil-source.mjs';
  assert.throws(()=>validateContract(changed),error=>error.code==='PARTICIPANT_CIVIL_SOURCE_DEPENDENCIES');
  checks.push({name:spec.id+'-civil-data-contract-'+mode+'-'+file,result:'PASS',expectedDenial:'PARTICIPANT_CIVIL_SOURCE_DEPENDENCIES',boundary:'pure CURRENT contract fixture'});
 }
 return checks;
}
function ownTemplateClosureSelftest(spec,proof,root,validate){
 const dependencies=ownTemplateDependenciesFor(spec.kind);if(!dependencies.length)return [];
 const checks=[],prefix=spec.id+'-own-template-';
 const good=(name,run)=>{run();checks.push({name:prefix+name,result:'PASS',boundary:'pure shadow fixture, no Git/PG/UI/provider execution'});};
 const mutate=(name,code,edit)=>{const value=clone(proof);edit(value);assert.throws(()=>validate(value),error=>error.code===code);checks.push({name:prefix+name,result:'PASS',expectedDenial:code,boundary:'pure shadow fixture'});};
 good('current-exact-count-and-real-producer-closure',()=>{assert.equal(spec.sourceFiles.length,currentOwnTemplateSourceCount(spec.kind,spec));equal(currentProducerSourceFiles(spec,root),spec.sourceFiles.toSorted(),'PROOF_SOURCE_MANIFEST');});
 for(const file of dependencies){
  good('current-source-pinned-'+file,()=>assert.ok(spec.sourceFiles.includes(file)));
  mutate('missing-source-'+file,'PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>ref.path!==file);});
  mutate('changed-source-hash-'+file,'PROOF_SOURCE_HASH',p=>{p.sourceManifest.find(ref=>ref.path===file).sha256='f'.repeat(64);});
  mutate('same-count-foreign-source-'+file,'PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest.find(ref=>ref.path===file).path='src/lib/foreign-own-template-source.mjs';assert.equal(p.sourceManifest.length,currentOwnTemplateSourceCount(spec.kind,spec));});
 }
 mutate('previous-manifest-cannot-certify-current-source','PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>!dependencies.includes(ref.path));assert.equal(p.sourceManifest.length,currentOwnTemplateSourceCount(spec.kind,spec)-dependencies.length);});
 return checks;
}
function monthlyCurveClosureSelftest(spec,proof,root,validate){
 const dependencies=monthlyCurveDependenciesFor(spec.kind),checks=[],prefix=spec.id+'-monthly-source-curve-';
 const good=(name,run)=>{run();checks.push({name:prefix+name,result:'PASS',boundary:'pure shadow proof; no PG/UI/provider execution'});};
 const mutate=(name,code,edit)=>{const value=clone(proof);edit(value);assert.throws(()=>validate(value),error=>error.code===code);checks.push({name:prefix+name,result:'PASS',expectedDenial:code,boundary:'pure shadow proof'});};
 good('additive-count-and-real-source-closure',()=>{assert.equal(spec.sourceFiles.length,currentOwnTemplateSourceCount(spec.kind,spec));equal(currentProducerSourceFiles(spec,root),spec.sourceFiles.toSorted(),'PROOF_SOURCE_MANIFEST');});
 for(const file of dependencies){
  good('source-pinned-'+file,()=>assert.ok(spec.sourceFiles.includes(file)));
  mutate('missing-source-'+file,'PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>ref.path!==file);});
  mutate('changed-source-hash-'+file,'PROOF_SOURCE_HASH',p=>{p.sourceManifest.find(ref=>ref.path===file).sha256='f'.repeat(64);});
  mutate('same-count-foreign-source-'+file,'PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest.find(ref=>ref.path===file).path='src/lib/foreign-monthly-source-curve.mjs';assert.equal(p.sourceManifest.length,currentOwnTemplateSourceCount(spec.kind,spec));});
 }
 mutate('previous-manifest-cannot-certify-v3','PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>![...currentPlanDependenciesFor(spec.kind),...participantPreanalysisProofSourceAdditions(spec),...officeAccountDependenciesFor(spec.kind),...currentKycStatusDependenciesFor(spec.kind),...companySubscriptionBackendDependenciesFor(spec.kind),...companySubscriptionFixtureDependenciesFor(spec.kind),...taskMeasurementDependenciesFor(spec.kind)].includes(ref.path));assert.equal(p.sourceManifest.length,OWN_TEMPLATE_SOURCE_COUNTS[spec.kind]);});
 return checks;
}
function monthlyCurveContractSelftest(workflow,contract,root){
 const checks=[],prefix='monthly-source-curve-';
 const good=(name,run)=>{run();checks.push({name:prefix+name,result:'PASS',boundary:'pure contract and source read; no PG/UI/provider execution'});};
 const bad=(name,code,edit)=>{const changed=clone(restoreParticipantPreanalysisPreviousContract(contract));edit(changed);assert.throws(()=>validateContract(changed),error=>error.code===code);checks.push({name:prefix+name,result:'PASS',expectedDenial:code,boundary:'pure contract fixture'});};
 good('historical-block-and-current-command-both-pinned',()=>{
  assert.equal(hash(canonical(contract.blocks.slice(0,46))),BASELINE_BLOCKS_SHA256);
  assert.notEqual(currentCommandBlock(contract,12).commandSha256,contract.blocks.find(block=>block.id===12).commandSha256);
  equal(currentCommandBlock(contract,12).step,workflow.jobs.plans.steps.find(step=>step.name===contract.monthlySourceCurve.step.name),'WORKFLOW_NOT_EQUIVALENT');
 });
 bad('missing-extension','MONTHLY_CURVE_EXTENSION_SHAPE',c=>{delete c.monthlySourceCurve;});
 bad('wrong-version','MONTHLY_CURVE_EXTENSION_IDENTITY',c=>{c.monthlySourceCurve.version=2;});
 bad('foreign-block','MONTHLY_CURVE_EXTENSION_IDENTITY',c=>{c.monthlySourceCurve.blockId=11;});
 bad('foreign-lane','MONTHLY_CURVE_EXTENSION_IDENTITY',c=>{c.monthlySourceCurve.lane='people';});
 bad('baseline-command-replaced','MONTHLY_CURVE_BASELINE_COMMAND',c=>{c.monthlySourceCurve.baselineCommandSha256=c.monthlySourceCurve.commandSha256;});
 bad('current-command-digest-replaced','MONTHLY_CURVE_COMMAND_DIGEST',c=>{c.monthlySourceCurve.commandSha256=c.monthlySourceCurve.baselineCommandSha256;});
 bad('missing-ui-suite-resealed','MONTHLY_CURVE_EXTENSION_COMMAND',c=>{c.monthlySourceCurve.step.run=c.monthlySourceCurve.step.run.replace('node --test tests/production-plan-import*.test.mjs tests/production-plan-source-curve-ui.test.mjs','node --test tests/production-plan-import*.test.mjs');c.monthlySourceCurve.commandSha256=hash(c.monthlySourceCurve.step.run);});
 bad('missing-ui-lint-resealed','MONTHLY_CURVE_EXTENSION_COMMAND',c=>{c.monthlySourceCurve.step.run=c.monthlySourceCurve.step.run.replace(" 'src/app/(identity)/cuenta/plan-source-curve.mjs'",'');c.monthlySourceCurve.commandSha256=hash(c.monthlySourceCurve.step.run);});
 bad('extra-command-resealed','MONTHLY_CURVE_EXTENSION_COMMAND',c=>{c.monthlySourceCurve.step.run+='\ntrue';c.monthlySourceCurve.commandSha256=hash(c.monthlySourceCurve.step.run);});
 for(const [kind,dependencies] of Object.entries(MONTHLY_CURVE_DEPENDENCIES)){
  for(const file of dependencies)bad('contract-source-omitted-'+kind+'-'+file,'MONTHLY_CURVE_SOURCE_DEPENDENCIES',c=>{const spec=c.extension.proofs.find(proof=>proof.kind===kind);spec.sourceFiles=spec.sourceFiles.filter(source=>source!==file);});
  bad('dependency-policy-omitted-'+kind,'MONTHLY_CURVE_SOURCE_DEPENDENCIES',c=>{delete c.monthlySourceCurve.sourceDependencies[kind];});
 }
 good('unit-producer-autogenerated-manifest-intact',()=>{const spec=contract.extension.proofs.find(proof=>proof.kind==='UNIT');equal(bankUnitSourceFiles(root),spec.sourceFiles.toSorted(),'PROOF_SOURCE_MANIFEST');});
 for(const [file,sources] of [
  ['scripts/verify-plan-import-postgres.mjs',['tests/fixtures/plan-import-monthly-curve-synthetic.mjs','tests/fixtures/plan-import-cyp-curve-synthetic.mjs']],
  ['scripts/verify-plan-import-ui.mjs',['src/lib/plan-import-monthly-curve.mjs','src/lib/plan-import-cyp-curve.mjs','tests/fixtures/plan-import-cyp-curve-synthetic.mjs']],
  ['scripts/verify-plan-import-boundary.mjs',['plan-import-monthly-curve.mjs','plan-import-cyp-curve.mjs']],
  ['scripts/verify-workspace-plan-recovery-ui.mjs',['src/lib/plan-import-monthly-curve.mjs','src/lib/plan-import-cyp-curve.mjs']]
 ])good('plans-producer-dependency-'+file,()=>{const source=readFileSync(path.join(root,file),'utf8');for(const dependency of sources)assert.ok(source.includes("'"+dependency+"'"),'Literal v3/v4 source binding: '+file+' -> '+dependency);});
 return checks;
}
function calendarPreparationClosureSelftest(spec,proof,root,validate){
 const dependencies=calendarPreparationDependenciesFor(spec.kind),fixtureDependencies=[...companySubscriptionFixtureDependenciesFor(spec.kind),...taskMeasurementDependenciesFor(spec.kind),...organizationUsageDependenciesFor(spec.kind),...civilDataDependenciesFor(spec.kind),...companyKycCurrentSourceClosureDependenciesFor(spec.kind),...planBaselineDependenciesFor(spec.kind),...planMeasurementCurrentDependencies(spec.kind),...participantPreanalysisProofSourceAdditions(spec)],previousCount=CALENDAR_PREPARATION_PREVIOUS_SOURCE_COUNTS[spec.kind],checks=[],prefix=spec.id+'-calendar-preparation-';
 const good=(name,run)=>{run();checks.push({name:prefix+name,result:'PASS',boundary:'pure current source proof; no PG/UI/provider execution'});};
 const mutate=(name,code,edit)=>{const value=clone(proof);edit(value);assert.throws(()=>validate(value),error=>error.code===code);checks.push({name:prefix+name,result:'PASS',expectedDenial:code,boundary:'pure adversarial current source proof'});};
 good('exact-additive-count-and-real-producer-closure',()=>{assert.equal(spec.sourceFiles.length,previousCount+dependencies.length+fixtureDependencies.length);equal(currentProducerSourceFiles(spec,root),spec.sourceFiles.toSorted(),'PROOF_SOURCE_MANIFEST');});
 for(const file of dependencies){
  good('source-pinned-once-'+file,()=>assert.equal(spec.sourceFiles.filter(source=>source===file).length,1));
  mutate('missing-source-'+file,'PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>ref.path!==file);});
  mutate('changed-source-hash-'+file,'PROOF_SOURCE_HASH',p=>{p.sourceManifest.find(ref=>ref.path===file).sha256='f'.repeat(64);});
  mutate('same-count-foreign-source-'+file,'PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest.find(ref=>ref.path===file).path='src/app/(identity)/cuenta/foreign-calendar-source.mjs';assert.equal(p.sourceManifest.length,previousCount+dependencies.length+fixtureDependencies.length);});
 }
 mutate('previous-current-manifest-cannot-certify-calendar','PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>![...dependencies,...fixtureDependencies].includes(ref.path));assert.equal(p.sourceManifest.length,previousCount);});
 return checks;
}
function calendarPreparationContractSelftest(workflow,contract,root){
 const checks=[],prefix='calendar-preparation-';
 const good=(name,run)=>{run();checks.push({name:prefix+name,result:'PASS',boundary:'pure contract and source read; no PG/UI/provider execution'});};
 const bad=(name,code,edit)=>{const changed=clone(restoreParticipantPreanalysisPreviousContract(contract));edit(changed);assert.throws(()=>validateContract(changed),error=>error.code===code);checks.push({name:prefix+name,result:'PASS',expectedDenial:code,boundary:'pure contract fixture'});};
 const reseal=extension=>{extension.commandSha256=hash(extension.step.run);};
 good('monthly-v3-and-current-command-both-pinned',()=>{assert.equal(contract.monthlySourceCurve.version,3);assert.equal(contract.calendarPreparation.baselineCommandSha256,contract.monthlySourceCurve.commandSha256);assert.notEqual(contract.calendarPreparation.commandSha256,contract.monthlySourceCurve.commandSha256);equal(currentCommandBlock(contract,12).step,workflow.jobs.plans.steps.find(step=>step.name===contract.calendarPreparation.step.name),'WORKFLOW_NOT_EQUIVALENT');equal(contract.calendarPreparation.step,expectedCalendarPreparationStep(contract),'CALENDAR_PREPARATION_EXTENSION_COMMAND');});
 good('ui-producer-copies-helper-once',()=>{const source=readFileSync(path.join(root,'scripts/verify-plan-import-ui.mjs'),'utf8'),arrays=[...source.matchAll(/\bcopiedFiles=\[([^\]]+)\]/g)];assert.equal(arrays.length,1);assert.equal([...arrays[0][1].matchAll(/['"]([^'"]+)['"]/g)].filter(match=>match[1]==='plan-import-calendar-suggestions.mjs').length,1);});
 bad('missing-extension','CALENDAR_PREPARATION_EXTENSION_SHAPE',c=>{delete c.calendarPreparation;});
 bad('wrong-extension-type','CALENDAR_PREPARATION_EXTENSION_SHAPE',c=>{c.calendarPreparation=[];});
 bad('unknown-extension-field','CALENDAR_PREPARATION_EXTENSION_SHAPE',c=>{c.calendarPreparation.foreign=true;});
 for(const version of [0,2,'1'])bad('wrong-version-'+version,'CALENDAR_PREPARATION_EXTENSION_IDENTITY',c=>{c.calendarPreparation.version=version;});
 bad('foreign-block','CALENDAR_PREPARATION_EXTENSION_IDENTITY',c=>{c.calendarPreparation.blockId=11;});
 bad('foreign-lane','CALENDAR_PREPARATION_EXTENSION_IDENTITY',c=>{c.calendarPreparation.lane='people';});
 bad('wrong-baseline-command','CALENDAR_PREPARATION_BASELINE_COMMAND',c=>{c.calendarPreparation.baselineCommandSha256='f'.repeat(64);});
 bad('historical-command-cannot-replace-monthly-baseline','CALENDAR_PREPARATION_BASELINE_COMMAND',c=>{c.calendarPreparation.baselineCommandSha256=c.blocks.find(block=>block.id===12).commandSha256;});
 for(const digest of ['f'.repeat(64),null])bad('wrong-command-digest-'+String(digest),'CALENDAR_PREPARATION_COMMAND_DIGEST',c=>{c.calendarPreparation.commandSha256=digest;});
 bad('step-name-changed','CALENDAR_PREPARATION_EXTENSION_COMMAND',c=>{c.calendarPreparation.step.name='Foreign calendar command';});
 bad('step-type-invalid','CALENDAR_PREPARATION_EXTENSION_COMMAND',c=>{c.calendarPreparation.step=null;});
 bad('helper-lint-removed-resealed','CALENDAR_PREPARATION_EXTENSION_COMMAND',c=>{c.calendarPreparation.step.run=c.calendarPreparation.step.run.replace(" '"+CALENDAR_PREPARATION_SOURCE+"'",'');reseal(c.calendarPreparation);});
 bad('helper-lint-duplicated-resealed','CALENDAR_PREPARATION_EXTENSION_COMMAND',c=>{c.calendarPreparation.step.run=c.calendarPreparation.step.run.replace("'"+CALENDAR_PREPARATION_SOURCE+"'","'"+CALENDAR_PREPARATION_SOURCE+"' '"+CALENDAR_PREPARATION_SOURCE+"'");reseal(c.calendarPreparation);});
 bad('helper-path-changed-resealed','CALENDAR_PREPARATION_EXTENSION_COMMAND',c=>{c.calendarPreparation.step.run=c.calendarPreparation.step.run.replace(CALENDAR_PREPARATION_SOURCE,'src/app/(identity)/cuenta/foreign-calendar-source.mjs');reseal(c.calendarPreparation);});
 bad('monthly-command-cannot-certify-calendar','CALENDAR_PREPARATION_EXTENSION_COMMAND',c=>{c.calendarPreparation.step=clone(c.monthlySourceCurve.step);reseal(c.calendarPreparation);});
 bad('extra-command-resealed','CALENDAR_PREPARATION_EXTENSION_COMMAND',c=>{c.calendarPreparation.step.run+='\ntrue';reseal(c.calendarPreparation);});
 bad('dependency-policy-omitted','CALENDAR_PREPARATION_SOURCE_DEPENDENCIES',c=>{delete c.calendarPreparation.sourceDependencies.UI_IDENTITY_ONLY;});
 bad('duplicate-policy-source','CALENDAR_PREPARATION_SOURCE_DEPENDENCIES',c=>{c.calendarPreparation.sourceDependencies.UI_IDENTITY_ONLY.push(CALENDAR_PREPARATION_SOURCE);});
 bad('foreign-policy-source','CALENDAR_PREPARATION_SOURCE_DEPENDENCIES',c=>{c.calendarPreparation.sourceDependencies.UI_IDENTITY_ONLY[0]='src/app/(identity)/cuenta/foreign-calendar-source.mjs';});
 bad('foreign-policy-kind','CALENDAR_PREPARATION_SOURCE_DEPENDENCIES',c=>{c.calendarPreparation.sourceDependencies.PG_COMPANY_KYC=[CALENDAR_PREPARATION_SOURCE];});
 bad('contract-source-omitted','CALENDAR_PREPARATION_SOURCE_DEPENDENCIES',c=>{const spec=c.extension.proofs.find(proof=>isIdentity(proof));spec.sourceFiles=spec.sourceFiles.filter(file=>file!==CALENDAR_PREPARATION_SOURCE);});
 bad('contract-source-replaced','CALENDAR_PREPARATION_SOURCE_DEPENDENCIES',c=>{const spec=c.extension.proofs.find(proof=>isIdentity(proof));spec.sourceFiles[spec.sourceFiles.indexOf(CALENDAR_PREPARATION_SOURCE)]='src/app/(identity)/cuenta/foreign-calendar-source.mjs';});
 return checks;
}
function whatsappPlanImportClosureSelftest(spec,proof,root,validate){
 const dependencies=whatsappPlanImportDependenciesFor(spec.kind),subscriptionDependencies=[...companySubscriptionBackendDependenciesFor(spec.kind),...taskMeasurementDependenciesFor(spec.kind),...currentKycReplyFeedbackDependenciesFor(spec.kind),...organizationUsageDependenciesFor(spec.kind),...proofFixtureDependenciesFor(spec.kind),...civilDataDependenciesFor(spec.kind),...companyKycCurrentSourceClosureDependenciesFor(spec.kind),...planBaselineDependenciesFor(spec.kind),...currentWhatsappFeedbackDependenciesFor(spec.kind),...planMeasurementCurrentDependencies(spec.kind),...participantPreanalysisProofSourceAdditions(spec)],previousCount=WHATSAPP_PLAN_IMPORT_PREVIOUS_SOURCE_COUNTS[spec.kind],checks=[],prefix=spec.id+'-whatsapp-plan-import-';
 const good=(name,run)=>{run();checks.push({name:prefix+name,result:'PASS',boundary:'pure current source proof; no PG/UI/provider execution'});};
 const mutate=(name,code,edit)=>{const value=clone(proof);edit(value);assert.throws(()=>validate(value),error=>error.code===code);checks.push({name:prefix+name,result:'PASS',expectedDenial:code,boundary:'pure adversarial current source proof'});};
 const rewrite=(value,file,{remove=false,replacement=null,changedHash=false}={})=>{
  let changed=0;
  if(spec.kind==='PG_FIELD'){
   for(const map of [value.sourceSha256,value.voiceProgressSourceSha256,value.mediaLeaseSourceSha256,value.videoAudioSourceSha256,value.participantKycFixture.sourceSha256])if(Object.hasOwn(map,file)){
    const original=map[file];if(remove||replacement)delete map[file];if(replacement)map[replacement]=original;if(changedHash)map[file]='f'.repeat(64);changed++;
   }
  }else{
   const key=spec.kind==='PG_OVERTIME'?'file':'path';
   value.sourceManifest=value.sourceManifest.filter(ref=>{if(ref[key]!==file)return true;changed++;if(replacement)ref[key]=replacement;if(changedHash)ref.sha256='f'.repeat(64);return !remove;});
  }
  assert.ok(changed>0,'WhatsApp plan source exists in shadow proof: '+file);
 };
 good('exact-additive-count-and-real-producer-closure',()=>{assert.equal(spec.sourceFiles.length,previousCount+dependencies.length+subscriptionDependencies.length);equal(currentProducerSourceFiles(spec,root),spec.sourceFiles.toSorted(),'PROOF_SOURCE_MANIFEST');});
 for(const file of dependencies){
  good('source-pinned-once-'+file,()=>assert.equal(spec.sourceFiles.filter(source=>source===file).length,1));
  mutate('missing-source-'+file,'PROOF_SOURCE_MANIFEST',p=>rewrite(p,file,{remove:true}));
  mutate('changed-source-hash-'+file,'PROOF_SOURCE_HASH',p=>rewrite(p,file,{changedHash:true}));
  mutate('same-count-foreign-source-'+file,'PROOF_SOURCE_MANIFEST',p=>{rewrite(p,file,{replacement:'src/lib/foreign-whatsapp-plan-import.mjs'});assert.equal(isCanonicalField(spec)?canonicalFieldManifest(spec,p).length:p.sourceManifest.length,previousCount+dependencies.length+subscriptionDependencies.length);});
 }
 mutate('previous-current-manifest-cannot-certify-whatsapp-import','PROOF_SOURCE_MANIFEST',p=>{for(const file of [...dependencies,...subscriptionDependencies])rewrite(p,file,{remove:true});assert.equal(isCanonicalField(spec)?canonicalFieldManifest(spec,p).length:p.sourceManifest.length,previousCount);});
 return checks;
}
function whatsappPlanImportContractSelftest(workflow,contract,root){
 const checks=[],prefix='whatsapp-plan-import-';
 const good=(name,run)=>{run();checks.push({name:prefix+name,result:'PASS',boundary:'pure contract and source read; no PG/UI/provider execution'});};
 const bad=(name,code,edit)=>{const changed=clone(restoreParticipantPreanalysisPreviousContract(contract));edit(changed);assert.throws(()=>validateContract(changed),error=>error.code===code);checks.push({name:prefix+name,result:'PASS',expectedDenial:code,boundary:'pure contract fixture'});};
 const denied=(name,code,run)=>{assert.throws(run,error=>error.code===code);checks.push({name:prefix+name,result:'PASS',expectedDenial:code,boundary:'pure adversarial test source fixture'});};
 const reseal=extension=>{extension.commandSha256=hash(extension.step.run);};
 const readSource=file=>Buffer.from(readFileSync(path.join(root,file),'utf8').replaceAll('\r\n','\n'));
 const provenanceFence=source=>{const sourceIndex=source.indexOf('const readSource=gitSource(root,actual);'),fenceIndex=source.indexOf('verifyWhatsappPlanTestSources(contract,readSource);'),bindingIndex=source.indexOf('const extensionProofBindings='),recordIndex=source.indexOf('const record=seal(');if(sourceIndex<0||fenceIndex<=sourceIndex||bindingIndex<=fenceIndex||recordIndex<=bindingIndex)deny('WHATSAPP_PLAN_IMPORT_PROVENANCE_FENCE');};
 good('provenance-verifies-Git-tests-before-proofs-and-record',()=>provenanceFence(provenance.toString()));
 denied('provenance-test-source-fence-removal-denied','WHATSAPP_PLAN_IMPORT_PROVENANCE_FENCE',()=>provenanceFence(provenance.toString().replace('verifyWhatsappPlanTestSources(contract,readSource);','')));
 good('historical-meta-and-current-command-both-pinned',()=>{assert.equal(contract.whatsappPlanImport.baselineCommandSha256,contract.blocks.find(block=>block.id===26).commandSha256);assert.notEqual(contract.whatsappPlanImport.commandSha256,contract.whatsappPlanImport.baselineCommandSha256);equal(currentCommandBlock(contract,26).step,workflow.jobs.meta.steps.find(step=>step.name===contract.whatsappPlanImport.step.name),'WORKFLOW_NOT_EQUIVALENT');equal(contract.whatsappPlanImport.step,expectedWhatsappPlanImportStep(contract),'WHATSAPP_PLAN_IMPORT_EXTENSION_COMMAND');});
 good('reviewed-tests-and-fixtures-exact-GitLF',()=>verifyWhatsappPlanTestSources(contract,readSource));
 denied('previous-transport-fixture-pin-cannot-certify-usage','WHATSAPP_PLAN_IMPORT_TEST_SOURCE_HASH',()=>{const previous=clone(contract);previous.whatsappPlanImport.testSources.find(source=>source.path==='tests/fixtures/meta-plan-import-transport-synthetic.mjs').sha256=ORGANIZATION_USAGE_PREVIOUS_TRANSPORT_FIXTURE_SHA256;verifyWhatsappPlanTestSources(previous,readSource);});
 denied('previous-link-test-pin-cannot-certify-usage','WHATSAPP_PLAN_IMPORT_TEST_SOURCE_HASH',()=>{const previous=clone(contract);previous.whatsappPlanImport.testSources.find(source=>source.path==='tests/production-plan-import-link-ui.test.mjs').sha256=ORGANIZATION_USAGE_PREVIOUS_LINK_TEST_SHA256;verifyWhatsappPlanTestSources(previous,readSource);});
 denied('previous-own-runtime-fixture-pin-cannot-certify-expiry','WHATSAPP_PLAN_IMPORT_TEST_SOURCE_HASH',()=>{const previous=clone(contract);previous.whatsappPlanImport.testSources.find(source=>source.path==='tests/fixtures/own-company-runtime.mjs').sha256=EXPIRY_FEEDBACK_PREVIOUS_OWN_RUNTIME_FIXTURE_SHA256;verifyWhatsappPlanTestSources(previous,readSource);});
 denied('previous-plan-transport-test-pin-cannot-certify-schedule-read','WHATSAPP_PLAN_IMPORT_TEST_SOURCE_HASH',()=>{const previous=clone(contract);previous.whatsappPlanImport.testSources.find(source=>source.path==='tests/production-meta-plan-import-transport.test.mjs').sha256=SCHEDULE_READ_PREVIOUS_PLAN_TRANSPORT_TEST_SHA256;verifyWhatsappPlanTestSources(previous,readSource);});
 for(const source of contract.whatsappPlanImport.testSources){
  const altered=clone(contract);altered.whatsappPlanImport.testSources.find(entry=>entry.path===source.path).sha256='f'.repeat(64);
  denied('test-source-pin-changed-denied-'+source.path,'WHATSAPP_PLAN_IMPORT_TEST_SOURCE_HASH',()=>verifyWhatsappPlanTestSources(altered,readSource));
  denied('test-source-mutated-bytes-denied-'+source.path,'WHATSAPP_PLAN_IMPORT_TEST_SOURCE_HASH',()=>verifyWhatsappPlanTestSources(contract,file=>file===source.path?Buffer.concat([readSource(file),Buffer.from('altered synthetic test source')]):readSource(file)));
 }
 bad('missing-extension','WHATSAPP_PLAN_IMPORT_EXTENSION_SHAPE',c=>{delete c.whatsappPlanImport;});
 bad('wrong-extension-type','WHATSAPP_PLAN_IMPORT_EXTENSION_SHAPE',c=>{c.whatsappPlanImport=[];});
 bad('unknown-extension-field','WHATSAPP_PLAN_IMPORT_EXTENSION_SHAPE',c=>{c.whatsappPlanImport.foreign=true;});
 for(const version of [0,2,'1'])bad('wrong-version-'+version,'WHATSAPP_PLAN_IMPORT_EXTENSION_IDENTITY',c=>{c.whatsappPlanImport.version=version;});
 bad('foreign-block','WHATSAPP_PLAN_IMPORT_EXTENSION_IDENTITY',c=>{c.whatsappPlanImport.blockId=12;});
 bad('foreign-lane','WHATSAPP_PLAN_IMPORT_EXTENSION_IDENTITY',c=>{c.whatsappPlanImport.lane='plans';});
 bad('wrong-baseline-command','WHATSAPP_PLAN_IMPORT_BASELINE_COMMAND',c=>{c.whatsappPlanImport.baselineCommandSha256='f'.repeat(64);});
 for(const digest of ['f'.repeat(64),null])bad('wrong-command-digest-'+String(digest),'WHATSAPP_PLAN_IMPORT_COMMAND_DIGEST',c=>{c.whatsappPlanImport.commandSha256=digest;});
 bad('step-name-changed','WHATSAPP_PLAN_IMPORT_EXTENSION_COMMAND',c=>{c.whatsappPlanImport.step.name='Foreign Meta command';});
 bad('step-type-invalid','WHATSAPP_PLAN_IMPORT_EXTENSION_COMMAND',c=>{c.whatsappPlanImport.step=null;});
 for(const file of WHATSAPP_PLAN_IMPORT_TEST_FILES)bad('selected-test-removed-resealed-'+file,'WHATSAPP_PLAN_IMPORT_EXTENSION_COMMAND',c=>{const line='node --test '+WHATSAPP_PLAN_IMPORT_TEST_FILES.join(' ');c.whatsappPlanImport.step.run=c.whatsappPlanImport.step.run.replace(line,line.replace(' '+file,''));reseal(c.whatsappPlanImport);});
 bad('lint-removed-resealed','WHATSAPP_PLAN_IMPORT_EXTENSION_COMMAND',c=>{c.whatsappPlanImport.step.run=c.whatsappPlanImport.step.run.replace('npx eslint '+WHATSAPP_PLAN_IMPORT_LINT_SOURCES.join(' ')+' --max-warnings 0\n','');reseal(c.whatsappPlanImport);});
 bad('selected-test-duplicated-resealed','WHATSAPP_PLAN_IMPORT_EXTENSION_COMMAND',c=>{c.whatsappPlanImport.step.run=c.whatsappPlanImport.step.run.replace('node --test ','node --test '+WHATSAPP_PLAN_IMPORT_TEST_FILES[0]+' ');reseal(c.whatsappPlanImport);});
 bad('test-path-foreign-resealed','WHATSAPP_PLAN_IMPORT_EXTENSION_COMMAND',c=>{c.whatsappPlanImport.step.run=c.whatsappPlanImport.step.run.replace(WHATSAPP_PLAN_IMPORT_TEST_FILES[0],'tests/production-foreign-meta.test.mjs');reseal(c.whatsappPlanImport);});
 bad('historical-command-cannot-certify-new-transport','WHATSAPP_PLAN_IMPORT_EXTENSION_COMMAND',c=>{c.whatsappPlanImport.step=clone(c.blocks.find(block=>block.id===26).step);reseal(c.whatsappPlanImport);});
 bad('existing-PG-command-removed-resealed','WHATSAPP_PLAN_IMPORT_EXTENSION_COMMAND',c=>{c.whatsappPlanImport.step.run=c.whatsappPlanImport.step.run.replace('node scripts/verify-meta-field-bridge-postgres.mjs\n','');reseal(c.whatsappPlanImport);});
 bad('extra-command-resealed','WHATSAPP_PLAN_IMPORT_EXTENSION_COMMAND',c=>{c.whatsappPlanImport.step.run+='\ntrue';reseal(c.whatsappPlanImport);});
 bad('test-source-omitted','WHATSAPP_PLAN_IMPORT_TEST_SOURCES',c=>{c.whatsappPlanImport.testSources.pop();});
 bad('test-source-duplicated','WHATSAPP_PLAN_IMPORT_TEST_SOURCES',c=>{c.whatsappPlanImport.testSources.push(clone(c.whatsappPlanImport.testSources[0]));});
 bad('test-source-foreign','WHATSAPP_PLAN_IMPORT_TEST_SOURCES',c=>{c.whatsappPlanImport.testSources[0].path='tests/production-foreign-meta.test.mjs';});
 bad('test-source-hash-invalid','WHATSAPP_PLAN_IMPORT_TEST_SOURCES',c=>{c.whatsappPlanImport.testSources[0].sha256='invalid';});
 bad('test-source-extra-property','WHATSAPP_PLAN_IMPORT_TEST_SOURCES',c=>{c.whatsappPlanImport.testSources[0].foreign=true;});
 for(const [kind,dependencies] of Object.entries(WHATSAPP_PLAN_IMPORT_DEPENDENCIES)){
  bad('dependency-policy-omitted-'+kind,'WHATSAPP_PLAN_IMPORT_SOURCE_DEPENDENCIES',c=>{delete c.whatsappPlanImport.sourceDependencies[kind];});
  bad('dependency-policy-duplicated-'+kind,'WHATSAPP_PLAN_IMPORT_SOURCE_DEPENDENCIES',c=>{c.whatsappPlanImport.sourceDependencies[kind].push(dependencies[0]);});
  bad('dependency-policy-foreign-'+kind,'WHATSAPP_PLAN_IMPORT_SOURCE_DEPENDENCIES',c=>{c.whatsappPlanImport.sourceDependencies[kind][0]='src/lib/foreign-whatsapp-plan-import.mjs';});
  for(const file of dependencies)bad('contract-source-omitted-'+kind+'-'+file,'WHATSAPP_PLAN_IMPORT_SOURCE_DEPENDENCIES',c=>{const spec=c.extension.proofs.find(proof=>proof.kind===kind);spec.sourceFiles=spec.sourceFiles.filter(source=>source!==file);});
 }
 bad('dependency-policy-foreign-kind','WHATSAPP_PLAN_IMPORT_SOURCE_DEPENDENCIES',c=>{c.whatsappPlanImport.sourceDependencies.UI_IDENTITY_ONLY=['src/lib/meta-plan-import-transport.mjs'];});
 return checks;
}
function validateCompanySubscriptionProofSources(contract){
 for(const spec of contract.extension.proofs){
  const dependencies=companySubscriptionProofDependenciesFor(spec.kind);
  if(dependencies.some(file=>spec.sourceFiles.filter(source=>source===file).length!==1))deny('COMPANY_SUBSCRIPTION_SOURCE_DEPENDENCIES');
  if(isIdentity(spec)&&PREVIOUS_COMPANY_BILLING_UI_SOURCES.some(file=>spec.sourceFiles.includes(file)))deny('COMPANY_SUBSCRIPTION_SOURCE_DEPENDENCIES');
 }
}
function validateTaskMeasurementProofSources(contract){
 for(const spec of contract.extension.proofs)if(taskMeasurementDependenciesFor(spec.kind).some(file=>spec.sourceFiles.filter(source=>source===file).length!==1))deny('TASK_MEASUREMENT_SOURCE_DEPENDENCIES');
}
function taskMeasurementProofClosureSelftest(spec,proof,root,validate){
 const dependencies=taskMeasurementDependenciesFor(spec.kind),checks=[],prefix=spec.id+'-task-measurement-';if(!dependencies.length)return checks;
 const good=(name,run)=>{run();checks.push({name:prefix+name,result:'PASS',boundary:'pure current source proof; no PG/UI/provider execution'});};
 const mutate=(name,code,edit)=>{const value=clone(proof);edit(value);assert.throws(()=>validate(value),error=>error.code===code);checks.push({name:prefix+name,result:'PASS',expectedDenial:code,boundary:'pure adversarial current source proof'});};
 const rewrite=(value,file,{remove=false,replacement=null,changedHash=false}={})=>{
  let changed=0;
  if(spec.kind==='PG_FIELD'){
   for(const map of [value.sourceSha256,value.voiceProgressSourceSha256,value.mediaLeaseSourceSha256,value.videoAudioSourceSha256,value.participantKycFixture.sourceSha256])if(Object.hasOwn(map,file)){const previous=map[file];if(remove||replacement)delete map[file];if(replacement)map[replacement]=previous;if(changedHash)map[file]='f'.repeat(64);changed++;}
  }else{const key=spec.kind==='PG_OVERTIME'?'file':'path';value.sourceManifest=value.sourceManifest.filter(ref=>{if(ref[key]!==file)return true;changed++;if(replacement)ref[key]=replacement;if(changedHash)ref.sha256='f'.repeat(64);return !remove;});}
  assert.ok(changed>0,'Current task measurement source exists in proof: '+file);
 };
 good('exact-current-producer-closure',()=>equal(currentProducerSourceFiles(spec,root),spec.sourceFiles.toSorted(),'PROOF_SOURCE_MANIFEST'));
 for(const file of dependencies){
  good('source-pinned-once-'+file,()=>assert.equal(spec.sourceFiles.filter(source=>source===file).length,1));
  mutate('missing-source-'+file,'PROOF_SOURCE_MANIFEST',value=>rewrite(value,file,{remove:true}));
  mutate('changed-source-hash-'+file,'PROOF_SOURCE_HASH',value=>rewrite(value,file,{changedHash:true}));
  mutate('same-count-foreign-source-'+file,'PROOF_SOURCE_MANIFEST',value=>rewrite(value,file,{replacement:'src/lib/foreign-task-measurement.mjs'}));
 }
 return checks;
}
function taskMeasurementContractSelftest(contract){
 const checks=[];
 for(const spec of contract.extension.proofs)for(const file of taskMeasurementDependenciesFor(spec.kind))for(const mode of ['missing','foreign']){
  const value=clone(restoreParticipantPreanalysisPreviousContract(contract)),target=value.extension.proofs.find(proof=>proof.kind===spec.kind);
  if(mode==='missing')target.sourceFiles=target.sourceFiles.filter(source=>source!==file);else target.sourceFiles[target.sourceFiles.indexOf(file)]='src/lib/foreign-task-measurement.mjs';
  assert.throws(()=>validateContract(value),error=>error.code==='TASK_MEASUREMENT_SOURCE_DEPENDENCIES');checks.push({name:spec.id+'-task-measurement-contract-'+mode+'-'+file,result:'PASS',expectedDenial:'TASK_MEASUREMENT_SOURCE_DEPENDENCIES',boundary:'pure contract fixture'});
 }
 return checks;
}
function companySubscriptionProofClosureSelftest(spec,proof,root,validate){
 const dependencies=companySubscriptionProofDependenciesFor(spec.kind),checks=[],prefix=spec.id+'-company-subscription-';if(!dependencies.length)return checks;
 const good=(name,run)=>{run();checks.push({name:prefix+name,result:'PASS',boundary:'pure current source proof; no PG/UI/provider execution'});};
 const mutate=(name,code,edit)=>{const value=clone(proof);edit(value);assert.throws(()=>validate(value),error=>error.code===code);checks.push({name:prefix+name,result:'PASS',expectedDenial:code,boundary:'pure adversarial current source proof'});};
 good('exact-current-producer-closure',()=>equal(currentProducerSourceFiles(spec,root),spec.sourceFiles.toSorted(),'PROOF_SOURCE_MANIFEST'));
 for(const file of dependencies){
  good('source-pinned-once-'+file,()=>assert.equal(spec.sourceFiles.filter(source=>source===file).length,1));
  mutate('missing-source-'+file,'PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>ref.path!==file);});
  mutate('changed-source-hash-'+file,'PROOF_SOURCE_HASH',p=>{p.sourceManifest.find(ref=>ref.path===file).sha256='f'.repeat(64);});
  mutate('same-count-foreign-source-'+file,'PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest.find(ref=>ref.path===file).path='src/lib/foreign-company-subscription.mjs';assert.equal(p.sourceManifest.length,spec.sourceFiles.length);});
 }
 if(isIdentity(spec)){
  mutate('previous-same-count-billing-mount-denied','PROOF_SOURCE_MANIFEST',p=>{for(const [index,file]of COMPANY_SUBSCRIPTION_UI_SOURCES.entries())p.sourceManifest.find(ref=>ref.path===file).path=PREVIOUS_COMPANY_BILLING_UI_SOURCES[index];assert.equal(p.sourceManifest.length,spec.sourceFiles.length);});
  mutate('previous-117-manifest-without-closed-fixture-denied','PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>![...companySubscriptionFixtureDependenciesFor(spec.kind),...taskMeasurementDependenciesFor(spec.kind),...organizationUsageDependenciesFor(spec.kind),...civilDataDependenciesFor(spec.kind),...companyKycCurrentSourceClosureDependenciesFor(spec.kind),...planBaselineDependenciesFor(spec.kind),...planMeasurementCurrentDependencies(spec.kind),...participantPreanalysisProofSourceAdditions(spec)].includes(ref.path));assert.equal(p.sourceManifest.length,117);});
 }
  else mutate('previous-191-source-manifest-denied','PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>![...dependencies,...taskMeasurementDependenciesFor(spec.kind),...organizationUsageDependenciesFor(spec.kind),...civilDataDependenciesFor(spec.kind),...companyKycCurrentSourceClosureDependenciesFor(spec.kind),...planBaselineDependenciesFor(spec.kind),...currentWhatsappFeedbackDependenciesFor(spec.kind),...planMeasurementCurrentDependencies(spec.kind),...participantPreanalysisProofSourceAdditions(spec)].includes(ref.path));assert.equal(p.sourceManifest.length,191);});
 return checks;
}
function companySubscriptionContractSelftest(contract){
 const checks=[],bad=(name,edit)=>{const value=clone(restoreParticipantPreanalysisPreviousContract(contract));edit(value);assert.throws(()=>validateContract(value),error=>error.code==='COMPANY_SUBSCRIPTION_SOURCE_DEPENDENCIES');checks.push({name:'company-subscription-contract-'+name,result:'PASS',expectedDenial:'COMPANY_SUBSCRIPTION_SOURCE_DEPENDENCIES',boundary:'pure contract fixture'});};
 for(const kind of ['PG_COMPANY_KYC','UI_IDENTITY_ONLY'])for(const file of companySubscriptionProofDependenciesFor(kind)){
  bad('missing-'+file,c=>{const spec=c.extension.proofs.find(p=>p.kind===kind);spec.sourceFiles=spec.sourceFiles.filter(source=>source!==file);});
  bad('same-count-foreign-'+file,c=>{const spec=c.extension.proofs.find(p=>p.kind===kind);spec.sourceFiles[spec.sourceFiles.indexOf(file)]='src/lib/foreign-company-subscription.mjs';});
 }
 bad('previous-billing-mount-restored',c=>{const spec=c.extension.proofs.find(isIdentity);for(const [index,file]of COMPANY_SUBSCRIPTION_UI_SOURCES.entries())spec.sourceFiles[spec.sourceFiles.indexOf(file)]=PREVIOUS_COMPANY_BILLING_UI_SOURCES[index];});
 return checks;
}
function extensionSelftest(contract,root,currentCompanyChecks=[],currentContinuityChecks=[],currentReactiveChecks=[],currentTemplateChecks=[],currentMonthlyChecks=[],currentKycStatusChecks=[],currentWhatsappPlanChecks=[]){
 const checks=[],discoveryChecks=[],videoChecks=[],preparationChecks=[],preparationProofChecks=[],identityClosureChecks=[],billingClosureChecks=[],subscriptionClosureChecks=[],expectedHead=contract.extension.baseHead;
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
 function runCaptureExtensionFixtureBody(spec,contract,readSource,fixturePorts){
const {validateExtensionProof,currentProducerSourceFiles,companyKycCurrentSourceClosureSelftest,companySubscriptionProofClosureSelftest,currentKycStatusClosureSelftest,documentCurveCopySelftest,monthlyCurveClosureSelftest,organizationUsageClosureSelftest,ownTemplateClosureSelftest,taskMeasurementProofClosureSelftest,whatsappPlanImportClosureSelftest}=fixturePorts;

   const originalCheckCount=checks.length;
  const evidence=new Map(),base={status:spec.kind==='UI_CAUSAL'?'EXPECTED_CAUSAL_FAILURE':'PASS',productionDataWritten:false,sourceManifest:spec.sourceFiles.map(file=>({path:file,sha256:hash(readSource(file))})),harnessSha256:spec.producerSha256};
  let proof={...base};
  if(spec.kind.startsWith('PG_')){Object.assign(proof,{schemaRemoved:true,checks:[...spec.checkNames],realProviderCalls:0,providerCalls:0,unexpectedNetworkCalls:0,sqlFailures:[],...(spec.kind==='PG_COMPANY_KYC'?{productionDataTouched:false,databaseCreated:false,environment:'schema-only-localhost-postgresql-corporate-KYC',realClerkLogin:false,realMetaAccepted:false,humanAccepted:false,poolClosed:true,adminClosed:true,ownConnectionsClosed:true,expiryFeedbackNative:companyKycExpiryNativeShadowFixture(),contextFeedbackNative:companyKycContextNativeShadowFixture()}:{})});
if(spec.kind==='PG_COMPANY_KYC'&&contract.integratedIdentityCurrentRevision)proof.currentImageNative=integratedCompanyCurrentShadowFixture(contract,readSource);if(spec.kind==='PG_COMPANY_KYC'&&contract.whatsappFieldContinuityCurrentRevision)proof.neutralStepGuidanceNative=whatsappFieldNeutralStepShadowFixture('COMPANY');}
  else if(spec.kind==='UNIT'){Object.assign(proof,{sourceRevision:expectedHead,sourceState:'committed exact Git HEAD',trackedClean:true,postgresExecuted:false,suites:TEST_SUITES.map((file,index)=>{const bytes=tap(index===4?RECOVERY_CASES:Array.from({length:EXPECTED_SUITE_COUNTS[file]||1},(_,i)=>'shadow fixture '+index+' case '+i)),filename='.vercel/participant-bank-intake-contract-evidence/suite-'+index+'.tap';evidence.set(filename,bytes);return {file,exitCode:0,...parseTap(bytes,{recovery:index===4,expectedTests:EXPECTED_SUITE_COUNTS[file]??null}),tap:{path:filename,bytes:bytes.length,sha256:hash(bytes)}};})});}
  else{Object.assign(proof,{errors:[],realProviderCalls:0,providerCalls:0,postgresExecuted:false,realIdentityAccepted:false,widths:[320,390,768,1280],sourceRevision:expectedHead,sourceState:'committed exact Git HEAD',trackedClean:true,dirtyTrackedPaths:[],fullSuite:true,badTransform:null,causalFailure:null});const modes=spec.kind==='UI_BANK'?['normal','invalid-cancel','lost-reload','unknown-close-reload','same-retry','stale','denied-forged','integrated']:spec.kind==='UI_INTAKE'?INTAKE_UI_MODES:['bank','intake'];proof.checks=proof.widths.flatMap(width=>modes.map(mode=>({width,mode,parentAndSiblingBlocked:true,ownRecoveryAndLocalCloseEnabled:true,noFeedbackDeadlock:true,automaticPost:false,storagePrivate:true,...(spec.kind==='UI_INTAKE'?{posts:intakeUiExpectedPosts(mode),...intakeUiExistingGuards(mode),privateStored:false,canonicalInvitationPrepared:true,scopeIsolated:true,canonicalInvitationConfirmed:true,focusRetainedAfterInvite:true,focusedRefresh:true,fullListExplicit:true,...(INTAKE_UI_FOCUSED_404_MODES.includes(mode)?{focused404Cleared:true,explicitListReconsulted:true,confirmedReceiptRetained:mode!=='continuation-missing'}:{})}:{})})));
   if(spec.kind==='UI_CAUSAL'){const source='src/app/(identity)/cuenta/participant-panel.js',original=readSource(source),needle=CIVIL_CURRENT_BANK_LOCK,replacement=CIVIL_CURRENT_CAUSAL_BANK_LOCK;Object.assign(proof,{widths:[320],checks:[],badTransform:{source,originalSha256:hash(original),fixtureSha256:hash(Buffer.from(original.toString().replace(needle,replacement))),needle,replacement,runtimeSourceEdited:false},causalFailure:{stage:'own-bank-save',message:'own bank save must remain enabled while its own pending gates siblings (shadow fixture)',expectedFailure:true}});}
  }
   if(spec.kind==='PG_PREPARATION')Object.assign(proof,{ok:true,sourceRevision:expectedHead,sourceState:'EXACT_CI_SOURCE',trackedClean:true,databaseRemoved:true,fixture:'disposable-local-postgres-canonical-workspace-with-synthetic-sessions',totalCheckCount:spec.checkNames.length});
   if(spec.kind==='UI_PREPARATION')Object.assign(proof,{validated:true,synthetic:true,realProviderCalls:false,sourceState:'EXACT_CI_SOURCE',fixtureRemoved:true,totalCheckCount:24,checks:proof.widths.flatMap(width=>PREPARATION_MODES.map(mode=>({width,mode,posts:mode==='cancel'?2:1,recoveryReads:0,currentSessionToken:true,placeholdersOnly:true,tasksUnchanged:true,noPayloadPersistence:true,horizontalOverflow:false})))});
   if(intakeWithdrawalCurrentCheckCount(spec)!==null)proof.checks.push(...INTAKE_WITHDRAWAL_CHECK_NAMES);
   const validate=value=>validateExtensionProof(spec,Buffer.from(JSON.stringify(value)),{expectedHead,readSource,readEvidence:file=>evidence.get(file)}),mutate=(name,code,edit)=>{const value=clone(proof);edit(value);bad(spec.id+'-'+name,code,()=>validate(value));};
  if(['UI_INTAKE','UI_PREPARATION','UI_JOINT','UI_CAUSAL'].includes(spec.kind))Object.assign(proof,documentCurveCopyShadow(readSource,spec));
  good(spec.id+'-complete-proof',()=>validate(proof));checks.push(...documentCurveCopySelftest(spec,proof,validate));
  if(['UI_JOINT','UI_CAUSAL'].includes(spec.kind))mutate('pre-document-relocation-harness-cannot-certify-current-source','PROOF_HARNESS_SOURCE',p=>{p.harnessSha256=JOINT_DOCUMENT_RELOCATION_PREVIOUS_PRODUCER_SHA256;});
  if(spec.kind==='PG_BANK')checks.push(...organizationUsageClosureSelftest(spec,proof,root,validate));
  checks.push(...companyKycCurrentSourceClosureSelftest(spec,proof,root,validate));
    if(taskMeasurementDependenciesFor(spec.kind).length)subscriptionClosureChecks.push(()=>taskMeasurementProofClosureSelftest(spec,proof,root,validate));
    if(companySubscriptionProofDependenciesFor(spec.kind).length)subscriptionClosureChecks.push(()=>companySubscriptionProofClosureSelftest(spec,proof,root,validate));
   if(whatsappPlanImportDependenciesFor(spec.kind).length)currentWhatsappPlanChecks.push(()=>whatsappPlanImportClosureSelftest(spec,proof,root,validate));
   if(ownTemplateDependenciesFor(spec.kind).length)currentTemplateChecks.push(()=>ownTemplateClosureSelftest(spec,proof,root,validate));
  if(currentKycStatusDependenciesFor(spec.kind).length)currentKycStatusChecks.push(()=>currentKycStatusClosureSelftest(spec,proof,root,validate));
   if(monthlyCurveDependenciesFor(spec.kind).length||calendarPreparationDependenciesFor(spec.kind).length)currentMonthlyChecks.push(()=>monthlyCurveClosureSelftest(spec,proof,root,validate));
  if(spec.kind!=='UNIT')good(spec.id+'-real-current-producer-source-manifest-exact',()=>fixturePorts.verifyCurrentCollector());
  good(spec.id+'-reordered-source-manifest',()=>{const reordered=clone(proof);reordered.sourceManifest.reverse();assert.equal(validate(reordered).sourceManifestSha256,validate(proof).sourceManifestSha256);});
  bad(spec.id+'-malformed-json','PROOF_JSON',()=>validateExtensionProof(spec,Buffer.from('{'),{expectedHead,readSource}));bad(spec.id+'-invalid-utf8','PROOF_ENCODING',()=>validateExtensionProof(spec,Buffer.from([255]),{expectedHead,readSource}));
   mutate('wrong-status','PROOF_STATUS',p=>{if(spec.kind==='PG_PREPARATION')p.ok=false;else if(spec.kind==='UI_PREPARATION')p.validated=false;else p.status='FAIL';});mutate('production-write','PROOF_PRODUCTION_BOUNDARY',p=>{if(spec.kind==='PG_COMPANY_KYC')p.productionDataTouched=true;else p.productionDataWritten=true;});mutate('wrong-source-head','PROOF_SOURCE_HEAD',p=>{p.sourceRevision='f'.repeat(40);});mutate('wrong-harness','PROOF_HARNESS_SOURCE',p=>{p.harnessSha256='f'.repeat(64);});mutate('missing-source','PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest.pop();});mutate('foreign-source','PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest.push({path:'src/foreign.mjs',sha256:'f'.repeat(64)});});mutate('wrong-source-hash','PROOF_SOURCE_HASH',p=>{p.sourceManifest[0].sha256='f'.repeat(64);});
   if(spec.kind.startsWith('PG_')){mutate('cleanup-failure','PROOF_CLEANUP',p=>{if(spec.kind==='PG_PREPARATION')p.databaseRemoved=false;else p.schemaRemoved=false;});mutate('missing-check','PROOF_CHECK_NAMES',p=>{p.checks.pop();});mutate('provider-call','PROOF_PROVIDER_IO',p=>{p.realProviderCalls=1;p.providerCalls=1;});}
  if(spec.kind==='PG_COMPANY_KYC'&&contract.whatsappFieldContinuityCurrentRevision){
   mutate('neutral-current-missing-additional-native-evidence','WHATSAPP_FIELD_CONTINUITY_CURRENT_CI_LINEAGE_REJECTED',p=>{delete p.neutralStepGuidanceNative;});
   mutate('neutral-current-missing-case-cannot-reuse-previous17','WHATSAPP_FIELD_CONTINUITY_CURRENT_CI_LINEAGE_REJECTED',p=>{p.neutralStepGuidanceNative.cases.pop();});
   mutate('neutral-current-foreign-case-name','WHATSAPP_FIELD_CONTINUITY_CURRENT_CI_LINEAGE_REJECTED',p=>{p.neutralStepGuidanceNative.cases[0].name='foreign-guidance-case';});
   mutate('neutral-current-four-commands-cannot-collapse-to-one','WHATSAPP_FIELD_CONTINUITY_CURRENT_CI_LINEAGE_REJECTED',p=>{p.neutralStepGuidanceNative.cases[0].commands=['HOLA'];});
   mutate('neutral-current-worker-mutation','WHATSAPP_FIELD_CONTINUITY_CURRENT_CI_LINEAGE_REJECTED',p=>{p.neutralStepGuidanceNative.cases[0].workerBytesUnchanged=false;});
   mutate('neutral-current-observed-blocker-required','WHATSAPP_FIELD_CONTINUITY_CURRENT_CI_LINEAGE_REJECTED',p=>{p.neutralStepGuidanceNative.cases.find(row=>row.blockedPid).blockingPids=[];});
   mutate('neutral-current-actual-mutation-transaction-required','WHATSAPP_FIELD_CONTINUITY_CURRENT_CI_LINEAGE_REJECTED',p=>{p.neutralStepGuidanceNative.cases.find(row=>row.mutationTransaction).mutationTransaction='';});
   mutate('neutral-current-original-deadline-cannot-renew','WHATSAPP_FIELD_CONTINUITY_CURRENT_CI_LINEAGE_REJECTED',p=>{p.neutralStepGuidanceNative.cases.find(row=>row.actualSqlClock).deadlineRenewed=true;});
   mutate('neutral-current-private-provider-or-acceptance-claims-denied','WHATSAPP_FIELD_CONTINUITY_CURRENT_CI_LINEAGE_REJECTED',p=>{p.neutralStepGuidanceNative.privateIo=1;});
  }
  if(spec.kind==='PG_COMPANY_KYC'){
   mutate('database-created','PROOF_CLEANUP',p=>{p.databaseCreated=true;});mutate('wrong-engine','PROOF_CLEANUP',p=>{p.environment='database-created-fixture';});mutate('network-call','PROOF_PROVIDER_IO',p=>{p.unexpectedNetworkCalls=1;});mutate('network-array-is-not-zero','PROOF_PROVIDER_IO',p=>{p.unexpectedNetworkCalls=[];});for(const key of ['realClerkLogin','realMetaAccepted','humanAccepted'])mutate('accepted-'+key,'PROOF_PROVIDER_IO',p=>{p[key]=true;});
   for(const key of ['poolClosed','adminClosed','ownConnectionsClosed'])mutate('expiry-missing-positive-'+key,'PROOF_CLEANUP',p=>{delete p[key];});
   mutate('expiry-missing-native-evidence','PROOF_KYC_EXPIRY_NATIVE',p=>{delete p.expiryFeedbackNative;});
   mutate('expiry-prompt-rewritten','PROOF_KYC_EXPIRY_NATIVE',p=>{p.expiryFeedbackNative.preparedClaimPromptBytesRewritten=true;});
   mutate('expiry-same-backend-is-not-concurrency','PROOF_KYC_EXPIRY_NATIVE',p=>{p.expiryFeedbackNative.cases[0].distinctBackendPids=[101,101];});
   mutate('expiry-no-observed-native-blocker','PROOF_KYC_EXPIRY_NATIVE',p=>{p.expiryFeedbackNative.cases[0].blockers=[];});
   mutate('expiry-uncommitted-receipt-visible','PROOF_KYC_EXPIRY_NATIVE',p=>{p.expiryFeedbackNative.cases[0].uncommittedReceiptInvisible=false;});
   mutate('expiry-lost-ACK-is-not-rollback','PROOF_KYC_EXPIRY_NATIVE',p=>{p.expiryFeedbackNative.cases[1].outcomes[0].realRollback=true;});
   mutate('expiry-unknown-rollback-field-is-not-false','PROOF_KYC_EXPIRY_NATIVE',p=>{delete p.expiryFeedbackNative.cases[1].outcomes[0].realRollback;});
   mutate('expiry-rollback-cannot-recover-a-committed-receipt','PROOF_KYC_EXPIRY_NATIVE',p=>{p.expiryFeedbackNative.cases[1].outcomes[1].recoveryReturnedReceipt=true;});
   mutate('expiry-revoked-cannot-send','PROOF_KYC_EXPIRY_NATIVE',p=>{p.expiryFeedbackNative.cases[2].httpTransfers=1;});
   mutate('expiry-worker-must-be-unchanged','PROOF_KYC_EXPIRY_NATIVE',p=>{p.expiryFeedbackNative.cases[0].workerBytesUnchanged=false;});
   mutate('expiry-cannot-capture-media-or-deposit','PROOF_KYC_EXPIRY_NATIVE',p=>{p.expiryFeedbackNative.cases[0].mediaAndDepositDelta=1;});
    mutate('context-missing-native-evidence','PROOF_KYC_CONTEXT_NATIVE',p=>{delete p.contextFeedbackNative;});
    mutate('context-missing-native-group','PROOF_KYC_CONTEXT_NATIVE',p=>{p.contextFeedbackNative.cases.pop();});
    mutate('context-private-worker-mutated','PROOF_KYC_CONTEXT_NATIVE',p=>{p.contextFeedbackNative.cases[0].workerBytesUnchanged=false;});
    mutate('context-repeat-provider-POST','PROOF_KYC_CONTEXT_NATIVE',p=>{p.contextFeedbackNative.cases[0].httpTransfers=2;});
    mutate('context-consent-chosen','PROOF_KYC_CONTEXT_NATIVE',p=>{p.contextFeedbackNative.cases[1].consentChosen=true;});
    mutate('context-revoked-provider-POST','PROOF_KYC_CONTEXT_NATIVE',p=>{p.contextFeedbackNative.cases[2].httpTransfers=1;});
    mutate('context-capture-dispatched','PROOF_KYC_CONTEXT_NATIVE',p=>{p.contextFeedbackNative.cases[3].captureDispatches=1;});
    mutate('context-source-lease-extended','PROOF_KYC_CONTEXT_NATIVE',p=>{p.contextFeedbackNative.cases[4].sourceLeaseMs=180000;});
    mutate('context-final-fence-after-sixty-seconds','PROOF_KYC_CONTEXT_NATIVE',p=>{p.contextFeedbackNative.cases[4].prePostMs=60000;});
    mutate('context-delay-suppressed','PROOF_KYC_CONTEXT_NATIVE',p=>{p.contextFeedbackNative.cases[4].statementDelayMs=0;});
    mutate('context-physical-latency-claimed','PROOF_KYC_CONTEXT_NATIVE',p=>{p.contextFeedbackNative.cases[4].productionLatencyMeasured=true;});
    for(const key of ['humanAccepted','identityCertified','permissionsGranted'])mutate('context-false-claim-'+key,'PROOF_KYC_CONTEXT_NATIVE',p=>{p.contextFeedbackNative[key]=true;});
  }
   if(['UI_BANK','UI_INTAKE','UI_JOINT','UI_PREPARATION'].includes(spec.kind)){mutate('partial-matrix','PROOF_MATRIX',p=>{p.checks.pop();});mutate('duplicate-matrix','PROOF_MATRIX',p=>{p.checks[0]=p.checks[1];});mutate('ui-error','PROOF_UI_ERRORS',p=>{p.errors=['shadow error'];});}
   if(spec.kind==='PG_PREPARATION'||spec.kind==='UI_PREPARATION'){
    mutate('dirty-tracked','PROOF_SOURCE_STATE',p=>{p.trackedClean=false;});mutate('uncommitted-source','PROOF_SOURCE_STATE',p=>{p.sourceState='LOCAL_REVIEW_SOURCE';});mutate('missing-head','PROOF_SOURCE_STATE',p=>{delete p.sourceRevision;});mutate('wrong-total',spec.kind==='UI_PREPARATION'?'PROOF_MATRIX':'PROOF_CHECK_NAMES',p=>{p.totalCheckCount=0;});
    if(spec.kind==='UI_PREPARATION'){mutate('fixture-not-removed','PROOF_CLEANUP',p=>{p.fixtureRemoved=false;});mutate('provider-call','PROOF_PROVIDER_IO',p=>{p.providerCalls=1;});mutate('private-payload-stored','PROOF_PREPARATION_GUARDS',p=>{p.checks[0].noPayloadPersistence=false;});mutate('tasks-mutated','PROOF_PREPARATION_GUARDS',p=>{p.checks[0].tasksUnchanged=false;});}
   }
  if(spec.kind==='UI_JOINT'){mutate('dirty-tracked','PROOF_SOURCE_STATE',p=>{p.trackedClean=false;});mutate('uncommitted-source','PROOF_SOURCE_STATE',p=>{p.sourceState='uncommitted';});mutate('null-head','PROOF_SOURCE_HEAD',p=>{p.sourceRevision=null;});for(const key of ['parentAndSiblingBlocked','ownRecoveryAndLocalCloseEnabled','noFeedbackDeadlock','storagePrivate'])mutate('missing-'+key,'PROOF_JOINT_GUARDS',p=>{p.checks[0][key]=false;});mutate('auto-post','PROOF_JOINT_GUARDS',p=>{p.checks[0].automaticPost=true;});}
  if(spec.kind==='UI_CAUSAL'){mutate('wrong-stage','PROOF_CAUSAL_FAILURE',p=>{p.causalFailure.stage='unrelated';});mutate('runtime-mutated','PROOF_CAUSAL_TRANSFORM',p=>{p.badTransform.runtimeSourceEdited=true;});mutate('wrong-fixture-hash','PROOF_CAUSAL_TRANSFORM',p=>{p.badTransform.fixtureSha256='f'.repeat(64);});}
  if(spec.kind==='UI_CAUSAL')mutate('pre-civil-transform-cannot-certify-current-panel','PROOF_CAUSAL_TRANSFORM',p=>{
   p.badTransform.needle='locked={busy||Boolean(attempt)||Boolean(durableReference)||!recoveryReady||Boolean(draft)||intakePending}';
   p.badTransform.replacement='locked={busy||Boolean(attempt)||Boolean(durableReference)||!recoveryReady||Boolean(draft)||intakePending||hasBankPending}';
   p.badTransform.fixtureSha256=hash(Buffer.from(readSource(p.badTransform.source).toString('utf8').replace(p.badTransform.needle,p.badTransform.replacement)));
  });
  if(spec.kind==='UNIT'){mutate('missing-suite','PROOF_UNIT_SUITES',p=>{p.suites.pop();});mutate('changed-tap-digest','PROOF_TAP_DIGEST',p=>{p.suites[4].tap.sha256='f'.repeat(64);});for(const names of [RECOVERY_CASES.slice(0,6),[...RECOVERY_CASES,'extra shadow case'],[...RECOVERY_CASES.slice(0,6),'wrong case']]){const bytes=tap(names),filename=proof.suites[4].tap.path,original=evidence.get(filename);evidence.set(filename,bytes);mutate('recovery-exact7-'+names.length+'-'+names.at(-1),'PROOF_UNIT_RESULTS',p=>{p.suites[4].tap={path:filename,bytes:bytes.length,sha256:hash(bytes)};});evidence.set(filename,original);}for(const key of ['fail','cancelled','skipped','todo']){const filename=proof.suites[4].tap.path,original=evidence.get(filename),bytes=Buffer.from(original.toString().replace('# '+key+' 0','# '+key+' 1'));evidence.set(filename,bytes);mutate('recovery-'+key,'PROOF_UNIT_RESULTS',p=>{p.suites[4].tap={path:filename,bytes:bytes.length,sha256:hash(bytes)};});evidence.set(filename,original);}}
  const historicalSuiteCounts={...EXPECTED_SUITE_COUNTS,'tests/production-employee-intake.test.mjs':ADMITTED_GUIDANCE_PREVIOUS_UNIT_TEST_COUNTS.intake,'tests/production-company-channel-kyc.test.mjs':76,'tests/production-participant-onboarding-next-step.test.mjs':35};
  if(spec.kind==='UNIT')for(const [file,count] of Object.entries(historicalSuiteCounts)){
   const index=TEST_SUITES.indexOf(file),filename=proof.suites[index].tap.path,original=evidence.get(filename);
   for(const size of [count-1,count+1]){const bytes=tap(Array.from({length:size},(_,i)=>'shadow exact suite '+i));evidence.set(filename,bytes);mutate('exact-suite-count-'+file+'-'+size,'PROOF_UNIT_RESULTS',p=>{p.suites[index]={file,exitCode:0,...parseTap(bytes),tap:{path:filename,bytes:bytes.length,sha256:hash(bytes)}};});}
   evidence.set(filename,original);
  }
  // Append current schema2 controls after the entire historical and portfolio sequence.
  if(spec.kind==='UNIT')currentCompanyChecks.push(()=>{
   const start=checks.length;
   const staleSpec={...spec,producerSha256:INTAKE_PLAIN_TEXT_UNIT_BASELINE_PRODUCER.producerSha256};bad('bank-intake-units-historical-pin-cannot-certify-current-plain-text-harness','PROOF_HARNESS_SOURCE',()=>validateExtensionProof(staleSpec,Buffer.from(JSON.stringify({...proof,harnessSha256:staleSpec.producerSha256})),{expectedHead,readSource,readEvidence:file=>evidence.get(file)}));
   const previousSpec={...spec,producerSha256:KYC_RETRY_PREVIOUS_UNIT_PRODUCER_SHA256};bad('bank-intake-units-previous-current-pin-cannot-certify-rejected-retry-count','PROOF_HARNESS_SOURCE',()=>validateExtensionProof(previousSpec,Buffer.from(JSON.stringify({...proof,harnessSha256:previousSpec.producerSha256})),{expectedHead,readSource,readEvidence:file=>evidence.get(file)}));
   const previousReplySpec={...spec,producerSha256:KYC_REPLY_PREVIOUS_UNIT_PRODUCER_SHA256};bad('bank-intake-units-previous-current-pin-cannot-certify-reply-feedback-count','PROOF_HARNESS_SOURCE',()=>validateExtensionProof(previousReplySpec,Buffer.from(JSON.stringify({...proof,harnessSha256:previousReplySpec.producerSha256})),{expectedHead,readSource,readEvidence:file=>evidence.get(file)}));
   const previousGuidanceSpec={...spec,producerSha256:ADMITTED_GUIDANCE_PREVIOUS_UNIT_PRODUCER_SHA256};bad('bank-intake-units-previous-current-pin-cannot-certify-admitted-guidance-count','PROOF_HARNESS_SOURCE',()=>validateExtensionProof(previousGuidanceSpec,Buffer.from(JSON.stringify({...proof,harnessSha256:previousGuidanceSpec.producerSha256})),{expectedHead,readSource,readEvidence:file=>evidence.get(file)}));
   const changed=clone(restoreParticipantPreanalysisPreviousContract(contract));changed.evidenceProducers.find(record=>record.path===spec.path).producerSha256=spec.producerSha256;bad('bank-intake-units-historical-record-cannot-be-overwritten','EXTENSION_PRODUCER_CONTRACT',()=>validateContract(changed));
   const intakeIndex=TEST_SUITES.indexOf('tests/production-employee-intake.test.mjs'),intakePath=proof.suites[intakeIndex].tap.path,intakeOriginal=evidence.get(intakePath),legacyIntakeTap=tap(Array.from({length:65},(_,i)=>'historical employee intake suite '+i));evidence.set(intakePath,legacyIntakeTap);mutate('plain-text-intake-legacy-sixty-five-tests','PROOF_UNIT_RESULTS',p=>{p.suites[intakeIndex]={file:TEST_SUITES[intakeIndex],exitCode:0,...parseTap(legacyIntakeTap),tap:{path:intakePath,bytes:legacyIntakeTap.length,sha256:hash(legacyIntakeTap)}};});evidence.set(intakePath,intakeOriginal);
   const guidanceCount=EXPECTED_SUITE_COUNTS[TEST_SUITES[intakeIndex]];
   for(const size of [ADMITTED_GUIDANCE_PREVIOUS_UNIT_TEST_COUNTS.intake,guidanceCount-1,guidanceCount+1]){
    const bytes=tap(Array.from({length:size},(_,i)=>'admitted guidance suite '+i));evidence.set(intakePath,bytes);
    mutate('admitted-guidance-exact-current-suite-count-'+size,'PROOF_UNIT_RESULTS',p=>{p.suites[intakeIndex]={file:TEST_SUITES[intakeIndex],exitCode:0,...parseTap(bytes),tap:{path:intakePath,bytes:bytes.length,sha256:hash(bytes)}};if(size===ADMITTED_GUIDANCE_PREVIOUS_UNIT_TEST_COUNTS.intake)assert.equal(p.suites.reduce((total,suite)=>total+suite.tests,0),ADMITTED_GUIDANCE_PREVIOUS_UNIT_TEST_COUNTS.total);});
   }
   evidence.set(intakePath,intakeOriginal);
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
   const changed=clone(restoreParticipantPreanalysisPreviousContract(contract));changed.evidenceProducers.find(record=>record.path===spec.path).producerSha256=spec.producerSha256;bad('company-kyc-postgres-historical-record-cannot-be-overwritten','EXTENSION_PRODUCER_CONTRACT',()=>validateContract(changed));
   good('company-kyc-postgres-previous-ten-SQL-checks-preserved',()=>{assert.equal(hash(canonical(spec.checkNames.slice(0,COMPANY_KYC_EXPIRY_PREVIOUS_CHECK_COUNT))),COMPANY_KYC_EXPIRY_PREVIOUS_CHECK_NAMES_SHA256);});
    good('company-kyc-postgres-current-thirteen-SQL-checks-exact',()=>{const previous=spec.checkNames.slice(0,13);assert.equal(previous.length,COMPANY_KYC_EXPIRY_PREVIOUS_CHECK_COUNT+COMPANY_KYC_EXPIRY_NATIVE_CHECK_COUNT);equal([...readFileSync(path.join(root,spec.producer),'utf8').matchAll(/checks\.push\('([^']+)'\)/g)].map(match=>match[1]),previous,'PROOF_CHECK_NAMES');});
    good('company-kyc-postgres-current-context-eighteen-SQL-checks-exact',()=>{const historicalSpec=restoreWhatsappFieldContinuityPreviousContract(contract).extension.proofs.find(row=>row.id===spec.id),previousSpec={...spec,producerSha256:historicalSpec.producerSha256,checkNames:integratedIdentityPreviousProofChecks(historicalSpec)};validateWhatsappFeedbackPreviousSourceLineage(previousSpec);const suffixes=[...readFileSync(path.join(root,KYC_CONTEXT_NATIVE_HELPER),'utf8').matchAll(/checks\.push\(kind\+'([^']+)'\)/g)].map(match=>match[1]);equal(suffixes,COMPANY_KYC_CONTEXT_CHECK_SUFFIXES,'PROOF_CHECK_NAMES');equal(previousSpec.checkNames.slice(13),suffixes.map(suffix=>'COMPANY'+suffix),'PROOF_CHECK_NAMES');});
    mutate('previous-thirteen-checks-cannot-certify-current-context','PROOF_CHECK_NAMES',p=>{p.checks=p.checks.slice(0,13);});
   mutate('previous-ten-checks-cannot-certify-expiry','PROOF_CHECK_NAMES',p=>{p.checks=spec.checkNames.slice(0,COMPANY_KYC_EXPIRY_PREVIOUS_CHECK_COUNT);});
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
    const voiceDependencies=['src/lib/voice-progress-draft.mjs'],videoDependencies=videoDependenciesFor(spec.kind),preparationDependencies=preparationDependenciesFor(spec.kind),planImportDependencies=planImportDependenciesFor(spec.kind),currentDependencies=[...onboardingDependencies,...voiceDependencies,...videoDependencies,...preparationDependencies,...planImportDependencies,...identityDependenciesFor(spec.kind),...companyBillingDependenciesFor(spec.kind),...intakeContinuityDependenciesFor(spec.kind),...reactiveIdentityDependenciesFor(spec.kind),...currentOwnDependenciesFor(spec.kind),...reviewerDependenciesFor(spec.kind),...intakeAssignmentDependenciesFor(spec.kind),...currentPlanDependenciesFor(spec.kind),...participantPreanalysisProofSourceAdditions(spec),...officeAccountDependenciesFor(spec.kind),...currentKycStatusDependenciesFor(spec.kind)];
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
    mutate('old-'+beforeVoiceCount+'-source-manifest-without-voice','PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>![...voiceDependencies,...discoveryDependenciesFor(spec.kind),...videoDependencies,...preparationDependencies,...planImportDependencies,...identityDependenciesFor(spec.kind),...companyBillingDependenciesFor(spec.kind),...intakeContinuityDependenciesFor(spec.kind),...reactiveIdentityDependenciesFor(spec.kind),...currentOwnDependenciesFor(spec.kind),...reviewerDependenciesFor(spec.kind),...intakeAssignmentDependenciesFor(spec.kind),...currentPlanDependenciesFor(spec.kind),...participantPreanalysisProofSourceAdditions(spec),...officeAccountDependenciesFor(spec.kind),...currentKycStatusDependenciesFor(spec.kind)].includes(ref.path));assert.equal(p.sourceManifest.length,beforeVoiceCount);});
   mutate('old-'+previousCount+'-source-manifest','PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>![...currentDependencies,...discoveryDependenciesFor(spec.kind)].includes(ref.path));assert.equal(p.sourceManifest.length,previousCount);});
  }
  // Append discovery controls after the complete historical check sequence.
   if(!['PG_PREPARATION','UI_PREPARATION'].includes(spec.kind))discoveryChecks.push(()=>{
    const dependencies=discoveryDependenciesFor(spec.kind),previousCount=beforeDiscoveryCounts[spec.kind],videoDependencies=videoDependenciesFor(spec.kind),preparationDependencies=preparationDependenciesFor(spec.kind),planImportDependencies=planImportDependenciesFor(spec.kind);
    assert.equal(spec.sourceFiles.length,previousCount+dependencies.length+videoDependencies.length+preparationDependencies.length+planImportDependencies.length+identityDependenciesFor(spec.kind).length+companyBillingDependenciesFor(spec.kind).length+intakeContinuityDependenciesFor(spec.kind).length+reactiveIdentityDependenciesFor(spec.kind).length+currentOwnDependenciesFor(spec.kind).length+reviewerDependenciesFor(spec.kind).length+intakeAssignmentDependenciesFor(spec.kind).length+currentPlanDependenciesFor(spec.kind).length+participantPreanalysisProofSourceAdditions(spec).length+officeAccountDependenciesFor(spec.kind).length+currentKycStatusDependenciesFor(spec.kind).length,'Exact current discovery source count: '+spec.id);
   for(const file of dependencies){
    assert.ok(spec.sourceFiles.includes(file),'Canonical account discovery source must be pinned: '+file);
    mutate('missing-discovery-source-'+file,'PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>ref.path!==file);});
    mutate('changed-discovery-hash-'+file,'PROOF_SOURCE_HASH',p=>{p.sourceManifest.find(ref=>ref.path===file).sha256='f'.repeat(64);});
   }
    mutate('old-'+previousCount+'-source-manifest-without-discovery','PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>![...dependencies,...videoDependencies,...preparationDependencies,...planImportDependencies,...identityDependenciesFor(spec.kind),...companyBillingDependenciesFor(spec.kind),...intakeContinuityDependenciesFor(spec.kind),...reactiveIdentityDependenciesFor(spec.kind),...currentOwnDependenciesFor(spec.kind),...reviewerDependenciesFor(spec.kind),...intakeAssignmentDependenciesFor(spec.kind),...currentPlanDependenciesFor(spec.kind),...participantPreanalysisProofSourceAdditions(spec),...officeAccountDependenciesFor(spec.kind),...currentKycStatusDependenciesFor(spec.kind)].includes(ref.path));assert.equal(p.sourceManifest.length,previousCount);});
  });
  // Append only the extractor's causal controls after all 553 historical checks.
  if(videoDependenciesFor(spec.kind).length)videoChecks.push(()=>{
   const dependencies=videoDependenciesFor(spec.kind),previousCount=beforeVideoCounts[spec.kind],preparationDependencies=preparationDependenciesFor(spec.kind),planImportDependencies=planImportDependenciesFor(spec.kind);
   assert.equal(spec.sourceFiles.length,previousCount+dependencies.length+preparationDependencies.length+planImportDependencies.length+identityDependenciesFor(spec.kind).length+companyBillingDependenciesFor(spec.kind).length+intakeContinuityDependenciesFor(spec.kind).length+reactiveIdentityDependenciesFor(spec.kind).length+currentOwnDependenciesFor(spec.kind).length+reviewerDependenciesFor(spec.kind).length+intakeAssignmentDependenciesFor(spec.kind).length+currentPlanDependenciesFor(spec.kind).length+participantPreanalysisProofSourceAdditions(spec).length+officeAccountDependenciesFor(spec.kind).length+currentKycStatusDependenciesFor(spec.kind).length,'Exact current video source count: '+spec.id);
   for(const file of dependencies){
    assert.ok(spec.sourceFiles.includes(file),'Canonical contextual video source must be pinned: '+file);
    mutate('missing-video-source-'+file,'PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>ref.path!==file);});
    mutate('changed-video-hash-'+file,'PROOF_SOURCE_HASH',p=>{p.sourceManifest.find(ref=>ref.path===file).sha256='f'.repeat(64);});
   }
   mutate('old-'+previousCount+'-source-manifest-without-video','PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>![...dependencies,...preparationDependencies,...planImportDependencies,...identityDependenciesFor(spec.kind),...companyBillingDependenciesFor(spec.kind),...intakeContinuityDependenciesFor(spec.kind),...reactiveIdentityDependenciesFor(spec.kind),...currentOwnDependenciesFor(spec.kind),...reviewerDependenciesFor(spec.kind),...intakeAssignmentDependenciesFor(spec.kind),...currentPlanDependenciesFor(spec.kind),...participantPreanalysisProofSourceAdditions(spec),...officeAccountDependenciesFor(spec.kind),...currentKycStatusDependenciesFor(spec.kind)].includes(ref.path));assert.equal(p.sourceManifest.length,previousCount);});
  });
   if(preparationDependenciesFor(spec.kind).length)preparationChecks.push(()=>{for(const file of preparationDependenciesFor(spec.kind)){assert.ok(spec.sourceFiles.includes(file),'Current KYC/preparation source must be pinned: '+file);mutate('missing-kyc-preparation-source-'+file,'PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>ref.path!==file);});mutate('changed-kyc-preparation-hash-'+file,'PROOF_SOURCE_HASH',p=>{p.sourceManifest.find(ref=>ref.path===file).sha256='f'.repeat(64);});}});
   if(identityDependenciesFor(spec.kind).length)identityClosureChecks.push(()=>{for(const file of identityDependenciesFor(spec.kind)){assert.ok(spec.sourceFiles.includes(file),'Current participant admission source must be pinned: '+file);mutate('missing-admission-source-'+file,'PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>ref.path!==file);});mutate('changed-admission-hash-'+file,'PROOF_SOURCE_HASH',p=>{p.sourceManifest.find(ref=>ref.path===file).sha256='f'.repeat(64);});}});
   if(companyBillingDependenciesFor(spec.kind).length)billingClosureChecks.push(()=>{
    const dependencies=companyBillingDependenciesFor(spec.kind);
    for(const file of dependencies){assert.ok(spec.sourceFiles.includes(file),'Current company billing source must be pinned: '+file);mutate('missing-company-billing-source-'+file,'PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>ref.path!==file);});mutate('changed-company-billing-hash-'+file,'PROOF_SOURCE_HASH',p=>{p.sourceManifest.find(ref=>ref.path===file).sha256='f'.repeat(64);});}
    mutate('old-163-source-manifest-without-company-billing','PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>![...dependencies,...reactiveIdentityDependenciesFor(spec.kind),...currentOwnDependenciesFor(spec.kind),...reviewerDependenciesFor(spec.kind),...intakeAssignmentDependenciesFor(spec.kind),...currentPlanDependenciesFor(spec.kind),...participantPreanalysisProofSourceAdditions(spec),...officeAccountDependenciesFor(spec.kind),...currentKycStatusDependenciesFor(spec.kind)].includes(ref.path));assert.equal(p.sourceManifest.length,163);});
   });
   if(spec.kind==='PG_PREPARATION')identityClosureChecks.push(()=>{
    good('project-preparation-existing-fifteen-SQL-checks-exact',()=>equal([...readFileSync(path.join(root,spec.producer),'utf8').matchAll(/checks\.push\('([^']+)'\)/g)].map(match=>match[1]),spec.checkNames,'PROOF_CHECK_NAMES'));
    for(const file of ['src/lib/participant-admission.mjs','src/lib/participant-approved-identity.mjs','src/lib/participant-kyc-image-set.mjs']){assert.ok(spec.sourceFiles.includes(file),'Current project preparation admission dependency must be pinned: '+file);mutate('missing-admission-source-'+file,'PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>ref.path!==file);});mutate('changed-admission-hash-'+file,'PROOF_SOURCE_HASH',p=>{p.sourceManifest.find(ref=>ref.path===file).sha256='f'.repeat(64);});}
    const staleSpec={...spec,producerSha256:PREPARATION_PG_BASELINE_PRODUCER.producerSha256};bad('project-preparation-historical-pin-cannot-certify-current-harness','PROOF_HARNESS_SOURCE',()=>validateExtensionProof(staleSpec,Buffer.from(JSON.stringify({...proof,harnessSha256:staleSpec.producerSha256})),{expectedHead,readSource}));
    const changed=clone(restoreParticipantPreanalysisPreviousContract(contract));changed.evidenceProducers.find(record=>record.path===spec.path).producerSha256=spec.producerSha256;bad('project-preparation-historical-record-cannot-be-overwritten','EXTENSION_PRODUCER_CONTRACT',()=>validateContract(changed));
   });
   if(spec.kind==='UI_PREPARATION')identityClosureChecks.push(()=>{
    const staleSpec={...spec,producerSha256:COPY_CLOSURE_UI_BASELINE_PRODUCERS[spec.kind].producerSha256};bad('project-preparation-ui-historical-pin-cannot-certify-current-harness','PROOF_HARNESS_SOURCE',()=>validateExtensionProof(staleSpec,Buffer.from(JSON.stringify({...proof,harnessSha256:staleSpec.producerSha256})),{expectedHead,readSource}));
    const changed=clone(restoreParticipantPreanalysisPreviousContract(contract));changed.evidenceProducers.find(record=>record.path===spec.path).producerSha256=spec.producerSha256;bad('project-preparation-ui-historical-record-cannot-be-overwritten','EXTENSION_PRODUCER_CONTRACT',()=>validateContract(changed));
   });
   if(['PG_PREPARATION','UI_PREPARATION'].includes(spec.kind))preparationProofChecks.push(...checks.splice(originalCheckCount));
  // Append named reactive-source adversarial controls only after the full
  // previous sequence. The count is corroborated by current producer closure.
  if(reactiveIdentityDependenciesFor(spec.kind).length)currentReactiveChecks.push(()=>{
   const start=checks.length,previous=REACTIVE_SOURCE_COUNTS[spec.kind]-1;
   good(spec.id+'-reactive-source-name-required',()=>assert.ok(spec.sourceFiles.includes(REACTIVE_IDENTITY_SOURCE)));
   good(spec.id+'-reactive-source-count-and-closure-exact',()=>{assert.equal(spec.sourceFiles.length,REACTIVE_SOURCE_COUNTS[spec.kind]+currentOwnDependenciesFor(spec.kind).length+reviewerDependenciesFor(spec.kind).length+intakeAssignmentDependenciesFor(spec.kind).length+currentPlanDependenciesFor(spec.kind).length+participantPreanalysisProofSourceAdditions(spec).length+officeAccountDependenciesFor(spec.kind).length+currentKycStatusDependenciesFor(spec.kind).length);equal(currentProducerSourceFiles(spec,root),spec.sourceFiles.toSorted(),'PROOF_SOURCE_MANIFEST');});
   mutate('missing-reactive-source','PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>ref.path!==REACTIVE_IDENTITY_SOURCE);});
   mutate('changed-reactive-source-hash','PROOF_SOURCE_HASH',p=>{p.sourceManifest.find(ref=>ref.path===REACTIVE_IDENTITY_SOURCE).sha256='f'.repeat(64);});
   mutate('historical-'+previous+'-source-manifest-without-reactive','PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>![REACTIVE_IDENTITY_SOURCE,...currentOwnDependenciesFor(spec.kind),...reviewerDependenciesFor(spec.kind),...intakeAssignmentDependenciesFor(spec.kind),...currentPlanDependenciesFor(spec.kind),...participantPreanalysisProofSourceAdditions(spec),...officeAccountDependenciesFor(spec.kind),...currentKycStatusDependenciesFor(spec.kind)].includes(ref.path));assert.equal(p.sourceManifest.length,previous);});
   mutate('same-count-foreign-reactive-source','PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest.find(ref=>ref.path===REACTIVE_IDENTITY_SOURCE).path='src/lib/foreign-reactive.mjs';assert.equal(p.sourceManifest.length,REACTIVE_SOURCE_COUNTS[spec.kind]+currentOwnDependenciesFor(spec.kind).length+reviewerDependenciesFor(spec.kind).length+intakeAssignmentDependenciesFor(spec.kind).length+currentPlanDependenciesFor(spec.kind).length+participantPreanalysisProofSourceAdditions(spec).length+officeAccountDependenciesFor(spec.kind).length+currentKycStatusDependenciesFor(spec.kind).length);});
   return checks.splice(start);
  });
  // Keep all historical controls above intact; append the new continuation
  // closure and exact behavioural matrix checks after the existing sequence.
  if(intakeContinuityDependenciesFor(spec.kind).length||Object.hasOwn(INTAKE_CONTINUITY_BASELINE_PRODUCERS,spec.kind))currentContinuityChecks.push(()=>{
   const start=checks.length;
   for(const file of intakeContinuityDependenciesFor(spec.kind)){
    good(spec.id+'-current-intake-continuity-source-pinned',()=>assert.ok(spec.sourceFiles.includes(file)));
    mutate('missing-intake-continuity-source','PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>ref.path!==file);});
    mutate('changed-intake-continuity-hash','PROOF_SOURCE_HASH',p=>{p.sourceManifest.find(ref=>ref.path===file).sha256='f'.repeat(64);});
    const previousCount=spec.kind==='UI_INTAKE'?21:93;
    good(spec.id+'-current-intake-continuity-source-count-exact',()=>assert.equal(spec.sourceFiles.length,previousCount+1+reactiveIdentityDependenciesFor(spec.kind).length+currentOwnDependenciesFor(spec.kind).length+reviewerDependenciesFor(spec.kind).length+intakeAssignmentDependenciesFor(spec.kind).length+currentPlanDependenciesFor(spec.kind).length+participantPreanalysisProofSourceAdditions(spec).length+officeAccountDependenciesFor(spec.kind).length+currentKycStatusDependenciesFor(spec.kind).length));
    mutate('old-'+previousCount+'-source-manifest-without-intake-continuity','PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>![file,...reactiveIdentityDependenciesFor(spec.kind),...currentOwnDependenciesFor(spec.kind),...reviewerDependenciesFor(spec.kind),...intakeAssignmentDependenciesFor(spec.kind),...currentPlanDependenciesFor(spec.kind),...participantPreanalysisProofSourceAdditions(spec),...officeAccountDependenciesFor(spec.kind),...currentKycStatusDependenciesFor(spec.kind)].includes(ref.path));assert.equal(p.sourceManifest.length,previousCount);});
   }
   if(Object.hasOwn(INTAKE_CONTINUITY_BASELINE_PRODUCERS,spec.kind)){
    const staleSpec={...spec,producerSha256:INTAKE_CONTINUITY_BASELINE_PRODUCERS[spec.kind].producerSha256};
    bad(spec.id+'-historical-pin-cannot-certify-current-continuity-harness','PROOF_HARNESS_SOURCE',()=>validateExtensionProof(staleSpec,Buffer.from(JSON.stringify({...proof,harnessSha256:staleSpec.producerSha256})),{expectedHead,readSource}));
    const changed=clone(restoreParticipantPreanalysisPreviousContract(contract));changed.evidenceProducers.find(record=>record.path===spec.path).producerSha256=spec.producerSha256;
    bad(spec.id+'-historical-record-cannot-be-overwritten','EXTENSION_PRODUCER_CONTRACT',()=>validateContract(changed));
   }
   if(Object.hasOwn(KYC_FEEDBACK_PREVIOUS_PRODUCER_PINS,spec.kind)){
    const staleSpec={...spec,producerSha256:KYC_FEEDBACK_PREVIOUS_PRODUCER_PINS[spec.kind]};
    bad(spec.id+'-previous-current-pin-cannot-certify-KYC-feedback-harness','PROOF_HARNESS_SOURCE',()=>validateExtensionProof(staleSpec,Buffer.from(JSON.stringify({...proof,harnessSha256:staleSpec.producerSha256})),{expectedHead,readSource}));
   }
   if(Object.hasOwn(RESOURCE_USAGE_PREVIOUS_PRODUCER_PINS,spec.kind)){
    const staleSpec={...spec,producerSha256:RESOURCE_USAGE_PREVIOUS_PRODUCER_PINS[spec.kind]};
    bad(spec.id+'-previous-current-pin-cannot-certify-resource-usage-harness','PROOF_HARNESS_SOURCE',()=>validateExtensionProof(staleSpec,Buffer.from(JSON.stringify({...proof,harnessSha256:staleSpec.producerSha256})),{expectedHead,readSource}));
   }
   if(Object.hasOwn(CIVIL_PREVIOUS_PRODUCER_PINS,spec.kind)){
    const staleSpec={...spec,producerSha256:CIVIL_PREVIOUS_PRODUCER_PINS[spec.kind]};
    bad(spec.id+'-pre-civil-pin-cannot-certify-current-harness','PROOF_HARNESS_SOURCE',()=>validateExtensionProof(staleSpec,Buffer.from(JSON.stringify({...proof,harnessSha256:staleSpec.producerSha256})),{expectedHead,readSource}));
   }
   if(spec.kind==='PG_BANK'){
    const changed=clone(restoreParticipantPreanalysisPreviousContract(contract));changed.evidenceProducers.find(record=>record.path===spec.path).producerSha256=spec.producerSha256;
    bad(spec.id+'-historical-record-cannot-be-overwritten','EXTENSION_PRODUCER_CONTRACT',()=>validateContract(changed));
   }
   if(proofFixtureDependenciesFor(spec.kind).length){
    const staleSpec={...spec,producerSha256:INTAKE_CAUSAL_FIXTURE_PREVIOUS_PRODUCER_SHA256};
    bad(spec.id+'-pre-fix-causal-producer-cannot-certify-current-fixture','PROOF_HARNESS_SOURCE',()=>validateExtensionProof(staleSpec,Buffer.from(JSON.stringify({...proof,harnessSha256:staleSpec.producerSha256})),{expectedHead,readSource}));
   }
   if(spec.kind==='UI_INTAKE'){
    good('intake-ui-current-twenty-producer-modes-exact',()=>{const match=readFileSync(path.join(root,spec.producer),'utf8').match(/\bmodes=\[([^\]]+)\]/);assert.ok(match);equal([...match[1].matchAll(/'([^']+)'/g)].map(value=>value[1]),INTAKE_UI_MODES,'PROOF_MATRIX');});
    good('intake-ui-current-eighty-check-binding-exact',()=>assert.equal(validate(proof).checks,80));
    mutate('legacy-thirty-two-matrix','PROOF_MATRIX',p=>{p.checks=p.checks.filter(row=>INTAKE_UI_MODES.slice(0,8).includes(row.mode));assert.equal(p.checks.length,32);});
    mutate('legacy-forty-eight-matrix','PROOF_MATRIX',p=>{p.checks=p.checks.filter(row=>INTAKE_UI_MODES.slice(0,12).includes(row.mode));assert.equal(p.checks.length,48);});
    mutate('legacy-sixty-matrix-without-existing-profile','PROOF_MATRIX',p=>{p.checks=p.checks.filter(row=>INTAKE_UI_MODES.slice(0,15).includes(row.mode));assert.equal(p.checks.length,60);});
    mutate('eighty-wrong-mode','PROOF_MATRIX',p=>{p.checks.find(row=>row.mode==='paged-worker').mode='foreign-mode';assert.equal(p.checks.length,80);});
    for(const key of ['canonicalInvitationConfirmed','focusRetainedAfterInvite','focusedRefresh','fullListExplicit']){
     mutate('paged-worker-'+key+'-missing','PROOF_INTAKE_GUARDS',p=>{delete p.checks.find(row=>row.mode==='paged-worker')[key];});
     mutate('paged-worker-'+key+'-false','PROOF_INTAKE_GUARDS',p=>{p.checks.find(row=>row.mode==='paged-worker')[key]=false;});
    }
    for(const mode of INTAKE_UI_MODES){
     mutate(mode+'-unexpected-post-count','PROOF_INTAKE_GUARDS',p=>{p.checks.find(row=>row.mode===mode).posts++;});
     for(const key of Object.keys(intakeUiExistingGuards(mode))){
      mutate(mode+'-'+key+'-missing','PROOF_INTAKE_GUARDS',p=>{delete p.checks.find(row=>row.mode===mode)[key];});
      mutate(mode+'-'+key+'-false','PROOF_INTAKE_GUARDS',p=>{p.checks.find(row=>row.mode===mode)[key]=false;});
     }
     if(!['invite','scope-switch'].includes(mode)){
      mutate(mode+'-private-stored','PROOF_INTAKE_GUARDS',p=>{p.checks.find(row=>row.mode===mode).privateStored=true;});
      mutate(mode+'-automatic-post','PROOF_INTAKE_GUARDS',p=>{p.checks.find(row=>row.mode===mode).automaticPost=true;});
     }
    }
    mutate('invite-canonical-preparation-false','PROOF_INTAKE_GUARDS',p=>{p.checks.find(row=>row.mode==='invite').canonicalInvitationPrepared=false;});
    mutate('scope-switch-isolation-false','PROOF_INTAKE_GUARDS',p=>{p.checks.find(row=>row.mode==='scope-switch').scopeIsolated=false;});
    for(const mode of INTAKE_UI_FOCUSED_404_MODES){
     for(const key of ['focused404Cleared','explicitListReconsulted']){
      mutate(mode+'-'+key+'-missing','PROOF_INTAKE_GUARDS',p=>{delete p.checks.find(row=>row.mode===mode)[key];});
      mutate(mode+'-'+key+'-false','PROOF_INTAKE_GUARDS',p=>{p.checks.find(row=>row.mode===mode)[key]=false;});
     }
     mutate(mode+'-confirmed-receipt-retention-missing','PROOF_INTAKE_GUARDS',p=>{delete p.checks.find(row=>row.mode===mode).confirmedReceiptRetained;});
     mutate(mode+'-confirmed-receipt-retention-wrong','PROOF_INTAKE_GUARDS',p=>{p.checks.find(row=>row.mode===mode).confirmedReceiptRetained=mode==='continuation-missing';});
    }
   }
   if(spec.kind==='PG_INTAKE'){
    const withdrawalCurrent=intakeWithdrawalCurrentCheckCount(spec)!==null;
    // Retain historical33 mutation oracles; reattach the two current assertions before the real validator.
    const mutateInheritedIntake=(name,code,edit)=>mutate(name,code,value=>{if(withdrawalCurrent)value.checks=value.checks.slice(0,spec.checkNames.length);edit(value);if(withdrawalCurrent)value.checks.push(...INTAKE_WITHDRAWAL_CHECK_NAMES);});
    const plainTextCheck='real-PG-signed-plain-name-email-current-sealed-outbox-time-fence-no-person-or-grant';
    const additions=['real-PG-canonical-additive-ASSIGN-retains-policy-digest-and-WAITING-signed-consent-bytes',...['nonnumeric','overflow','maximum-ten-digits'].map(name=>'real-PG-additive-proof-'+name+'-revision-fails-closed-without-SQL-cast-error'),'real-PG-additive-proof-missing-confirmed-baseline-denies-unchanged-WAITING','real-PG-additive-proof-duplicate-revision-denies-unchanged-WAITING','real-PG-old-signed-routing-revision-remains-rejected-after-only-addition','real-PG-canonical-SUSPEND-ACTIVATE-never-revives-policy-or-WAITING-consent','real-PG-canonical-REVOKE-ASSIGN-never-revives-policy-or-WAITING-consent','real-PG-anchor-REVOKE-denies-WAITING-admission-with-destination-still-ACTIVE'];
    const existingAdditions=["real-PG-existing-roster-candidate-current-snapshot-readonly-no-selection","real-PG-create-with-existing-contact-keeps-duplicate-denial","real-PG-existing-choice-snapshot-or-current-row-change-terminal-rejection","real-PG-existing-choice-registration-provenance-missing-foreign-duplicate-denial","real-PG-existing-choice-normalized-contact-ambiguity-denies-without-SQL-error","real-PG-existing-choice-stripped-participation-and-prior-admission-ledger-denial","real-PG-existing-choice-current-eligibility-markers-deny-preserving-source-consent","real-PG-existing-choice-preserves-roster-signed-consent-one-receipt-no-grant","real-PG-existing-choice-different-operations-one-admission-one-rejection","real-PG-existing-choice-audit-failure-rolls-back-worker-and-intake","real-PG-existing-choice-committed-ACK-loss-readback-without-write-repeat","real-PG-existing-roster-provenance-tamper-denies-accepted-permissions"];
    const legacy=names=>names.filter(name=>!additions.includes(name)&&!existingAdditions.includes(name));
    good('intake-postgres-current-thirty-three-SQL-checks-exact',()=>{
     let source=restorePlanBudgetIntakeWithdrawalProducerText(contract,readSource(spec.producer)).toString('utf8');
     const loop="checks.push('real-PG-additive-proof-'+name+'-revision-fails-closed-without-SQL-cast-error');";
     assert.equal(source.split(loop).length,2);source=source.replace(loop,additions.slice(1,4).map(name=>"checks.push('"+name+"');").join(''));
     assert.equal(spec.checkNames.length,33);equal([...source.matchAll(/checks\.push\('([^']+)'\)/g)].map(match=>match[1]),spec.checkNames,'PROOF_CHECK_NAMES');assert.equal(legacy(spec.checkNames).length,11);assert.equal(additions.length,10);assert.equal(existingAdditions.length,12);
    });
    mutateInheritedIntake('legacy-eight-checks','PROOF_CHECK_NAMES',p=>{p.checks=legacy(p.checks).filter(name=>!name.startsWith('real-PG-focused-')&&name!==plainTextCheck);assert.equal(p.checks.length,8);});
    mutateInheritedIntake('legacy-ten-checks-without-plain-text-causal-fence','PROOF_CHECK_NAMES',p=>{p.checks=legacy(p.checks).filter(name=>name!==plainTextCheck);assert.equal(p.checks.length,10);});
    mutateInheritedIntake('eleven-checks-duplicate','PROOF_CHECK_NAMES',p=>{p.checks=legacy(p.checks);p.checks[4]=p.checks[3];assert.equal(p.checks.length,11);});
    mutateInheritedIntake('eleven-checks-wrong-name','PROOF_CHECK_NAMES',p=>{p.checks=legacy(p.checks);p.checks[4]='foreign focused check';assert.equal(p.checks.length,11);});
    mutateInheritedIntake('eleven-checks-wrong-order','PROOF_CHECK_NAMES',p=>{p.checks=legacy(p.checks);[p.checks[4],p.checks[5]]=[p.checks[5],p.checks[4]];});
    mutateInheritedIntake('legacy-twenty-one-checks-without-existing-profile','PROOF_CHECK_NAMES',p=>{p.checks=p.checks.filter(value=>!existingAdditions.includes(value));assert.equal(p.checks.length,21);});
    for(const name of [...additions,...existingAdditions])mutateInheritedIntake('current-addition-omitted-'+name,'PROOF_CHECK_NAMES',p=>{p.checks=p.checks.filter(value=>value!==name);assert.equal(p.checks.length,32);});
    mutateInheritedIntake('current-addition-duplicate','PROOF_CHECK_NAMES',p=>{p.checks[p.checks.indexOf(additions[1])]=additions[0];assert.equal(p.checks.length,33);});
    mutateInheritedIntake('existing-addition-duplicate','PROOF_CHECK_NAMES',p=>{p.checks[p.checks.indexOf(existingAdditions[1])]=existingAdditions[0];assert.equal(p.checks.length,33);});
    mutateInheritedIntake('existing-addition-wrong-order','PROOF_CHECK_NAMES',p=>{const index=p.checks.indexOf(existingAdditions[1]);[p.checks[index],p.checks[index+1]]=[p.checks[index+1],p.checks[index]];});
    mutateInheritedIntake('current-addition-wrong-order','PROOF_CHECK_NAMES',p=>{const index=p.checks.indexOf(additions[1]);[p.checks[index],p.checks[index+1]]=[p.checks[index+1],p.checks[index]];});
    if(withdrawalCurrent){
     good('intake-postgres-current-thirty-five-SQL-checks-exact',()=>{let source=readSource(spec.producer).toString('utf8');const loop="checks.push('real-PG-additive-proof-'+name+'-revision-fails-closed-without-SQL-cast-error');";assert.equal(source.split(loop).length,2);source=source.replace(loop,additions.slice(1,4).map(name=>"checks.push('"+name+"');").join(''));assert.equal(proof.checks.length,35);equal([...source.matchAll(/checks\.push\('([^']+)'\)/g)].map(match=>match[1]),proof.checks,'PROOF_CHECK_NAMES');assert.equal(validate(proof).checks,35);});
     mutate('withdrawal-missing-current-ledger','PROOF_CHECK_NAMES',p=>{p.checks=p.checks.slice(0,33);});
     for(const name of INTAKE_WITHDRAWAL_CHECK_NAMES)mutate('withdrawal-omitted-'+name,'PROOF_CHECK_NAMES',p=>{p.checks=p.checks.filter(value=>value!==name);});
     mutate('withdrawal-duplicate','PROOF_CHECK_NAMES',p=>{p.checks[34]=p.checks[33];});
     mutate('withdrawal-wrong-order','PROOF_CHECK_NAMES',p=>{[p.checks[33],p.checks[34]]=[p.checks[34],p.checks[33]];});
    }
   }
   return checks.splice(start);
  });

}

 const selftestProgressToken043=selftestProgressStart("F2.extension-proof-fixture-iterations");
 for(const spec of contract.extension.proofs.filter(spec=>!['PG_PLAN_BASELINE','UI_DOCUMENT_CURVE',PARTICIPANT_PREANALYSIS_KIND,FOCUSED_WORKSPACE_CI_KIND,FIELD_TASK_PAGINATION_CI_KIND,PLAN_BUDGET_CI_KIND].includes(spec.kind)&&!isPortfolio(spec)&&!isIdentity(spec)&&!isCanonicalField(spec))) {
  const fixturePorts={validateExtensionProof,currentProducerSourceFiles,companyKycCurrentSourceClosureSelftest,companySubscriptionProofClosureSelftest,currentKycStatusClosureSelftest,documentCurveCopySelftest,monthlyCurveClosureSelftest,organizationUsageClosureSelftest,ownTemplateClosureSelftest,taskMeasurementProofClosureSelftest,whatsappPlanImportClosureSelftest,checks,currentCollectorName:spec.id+"-real-current-producer-source-manifest-exact",verifyCurrentCollector:()=>equal(currentProducerSourceFiles(spec,root),spec.sourceFiles.toSorted(),'PROOF_SOURCE_MANIFEST')};
  if(hasCaptureRuntime(contract)&&["PG_BANK","PG_INTAKE","PG_COMPANY_KYC"].includes(spec.kind))runCaptureNativeFixtureIteration(contract,readSource,spec,root,[...new Set([discoveryChecks,videoChecks,preparationChecks,preparationProofChecks,identityClosureChecks,billingClosureChecks,subscriptionClosureChecks,currentCompanyChecks,currentContinuityChecks,currentReactiveChecks,currentTemplateChecks,currentMonthlyChecks,currentKycStatusChecks,currentWhatsappPlanChecks])],runCaptureExtensionFixtureBody,fixturePorts);
  else runCaptureExtensionFixtureBody(spec,contract,readSource,fixturePorts);
 }
 selftestProgressEnd("F2.extension-proof-fixture-iterations",selftestProgressToken043);


 const selftestProgressToken044=selftestProgressStart("F2.local.discoveryChecks-drain");
 for(const run of discoveryChecks)run();
 selftestProgressEnd("F2.local.discoveryChecks-drain",selftestProgressToken044);


 const selftestProgressToken045=selftestProgressStart("F2.local.videoChecks-drain");
 for(const run of videoChecks)run();
 selftestProgressEnd("F2.local.videoChecks-drain",selftestProgressToken045);


 const selftestProgressToken046=selftestProgressStart("F2.local.preparationChecks-drain");
 for(const run of preparationChecks)run();
 selftestProgressEnd("F2.local.preparationChecks-drain",selftestProgressToken046);


 const selftestProgressToken047=selftestProgressStart("F2.local.preparationProofChecks-drain");
 checks.push(...preparationProofChecks);
 selftestProgressEnd("F2.local.preparationProofChecks-drain",selftestProgressToken047);


 const selftestProgressToken048=selftestProgressStart("F2.local.identityClosureChecks-drain");
 for(const run of identityClosureChecks)run();
 selftestProgressEnd("F2.local.identityClosureChecks-drain",selftestProgressToken048);


 const selftestProgressToken049=selftestProgressStart("F2.local.billingClosureChecks-drain");
 for(const run of billingClosureChecks)run();
 selftestProgressEnd("F2.local.billingClosureChecks-drain",selftestProgressToken049);


 const selftestProgressToken050=selftestProgressStart("F2.local.subscriptionClosureChecks-drain");
 for(const run of subscriptionClosureChecks)checks.push(...run());
 selftestProgressEnd("F2.local.subscriptionClosureChecks-drain",selftestProgressToken050);

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
 if(hasCaptureRuntime(contract)){try{validateContract(captureBudget.restoreCaptureRuntimePreviousContract(contract));}catch(error){if(error.code==='PLAN_BUDGET_CURRENT_CI_LINEAGE_REJECTED')deny('PROOF_BINDING_SOURCE');throw error;}return contract;}
 if(contract?.[PLAN_BUDGET_CURRENT_SECTION]){try{validateContract(restorePlanBudgetPreviousContract(contract));}catch(error){if(error.code==='PLAN_BUDGET_CURRENT_CI_LINEAGE_REJECTED')deny('PROOF_BINDING_SOURCE');throw error;}return contract;}
 if(contract?.[WORKSITE_LIVE_HOURS_CURRENT_SECTION]){try{validateContract(restoreWorksiteLiveHoursPreviousContract(contract));}catch(error){if(error.code==='WORKSITE_LIVE_HOURS_CURRENT_CI_LINEAGE_REJECTED')deny('PROOF_BINDING_SOURCE');throw error;}return contract;}
 if(contract?.whatsappFieldContinuityCurrentRevision){try{validateContract(restoreWhatsappFieldContinuityPreviousContract(contract));}catch(error){if(error.code==='WHATSAPP_FIELD_CONTINUITY_CURRENT_CI_LINEAGE_REJECTED')deny('PROOF_BINDING_SOURCE');throw error;}return contract;}
 if(contract?.planMeasurementDocumentAssociationRevision){try{validateContract(restoreDocumentTaskAssociationPreviousContract(contract));}catch(error){if(error.code==='PLAN_MEASUREMENT_DOCUMENT_ASSOCIATION_CI_LINEAGE_REJECTED')deny('PROOF_BINDING_SOURCE');throw error;}return contract;}
 if(contract?.integratedIdentityCurrentRevision){try{validateIntegratedIdentityWorkspaceContract(contract);validateContract(restoreIntegratedIdentityPreviousContract(contract));}catch(error){if(error.code==='INTEGRATED_IDENTITY_CURRENT_CI_LINEAGE_REJECTED')deny('PROOF_BINDING_SOURCE');throw error;}return contract;}
 if(contract?.participantPreanalysisCurrentRevision){try{validateParticipantPreanalysisWorkspaceContract(contract);validateContract(restoreParticipantPreanalysisPreviousContract(contract));}catch(error){if(error.code==='PLAN_MEASUREMENT_CURRENT_CI_LINEAGE_REJECTED')deny('PROOF_BINDING_SOURCE');throw error;}return contract;}
 if(contract?.version!==2||contract.sourceCommit!=='61d316a8983c268d43f8af6de10df9743a46278e')deny('CONTRACT_BASE');
 if(contract.workflow?.services?.postgres?.image!==POSTGRES_SERVICE_IMAGE)deny('POSTGRES_SERVICE_IMAGE');
 equal(Object.keys(contract.lanes).sort(),[...LANES].sort(),'CONTRACT_LANES');
 const ids=contract.blocks.map(block=>block.id);
 equal(ids,Array.from({length:56},(_,i)=>i+7),'CONTRACT_BLOCKS');
 for(const block of contract.blocks){if(typeof block.step.run!=='string'||hash(block.step.run)!==block.commandSha256)deny('CONTRACT_COMMAND');}
 const assigned=Object.values(contract.lanes).flatMap(lane=>lane.blocks);
 equal([...assigned].sort((a,b)=>a-b),ids,'CONTRACT_COVERAGE');
 if(new Set(assigned).size!==56)deny('CONTRACT_DUPLICATE_BLOCK');
 const patterns=Object.values(contract.lanes).flatMap(lane=>lane.artifacts);
 equal([...patterns].sort(),[...contract.artifactPatterns].sort(),'CONTRACT_ARTIFACT_COVERAGE');
 if(patterns.length!==60||new Set(patterns).size!==60)deny('CONTRACT_ARTIFACT_DUPLICATE');
 patterns.forEach(patternValid);
  validateEvidenceContract(contract);validateExtension(contract);validateMonthlyCurveExtension(contract);validateCalendarPreparationExtension(contract);validateWhatsappPlanImportExtension(contract);validateCompanySubscriptionProofSources(contract);validateTaskMeasurementProofSources(contract);validateCivilDataProofSources(contract);validateOrganizationUsageProofSources(contract);validateCompanyKycCurrentSourceClosure(contract);validatePlanBaselineContract(contract);validateDocumentCurveUiContract(contract);
  for(const spec of contract.extension.proofs){try{validateWhatsappFeedbackPreviousSourceLineage(spec);}catch(error){
   // A replacement of the published source set remains the existing binding
   // denial category. The direct lineage validator keeps its precise cause.
   if(error.code==='WHATSAPP_FEEDBACK_PREVIOUS_SOURCE_LINEAGE')deny('PROOF_BINDING_SOURCE');throw error;
  }}
 try{validateKycExpiredCurrentWorkspaceContract(contract);}catch(error){if(error.code==='PLAN_MEASUREMENT_CURRENT_CI_LINEAGE_REJECTED'||error.code==='KYC_EXPIRED_CURRENT_LINEAGE_REJECTED'&&error.reason==='PUBLISHED_CONTRACT_CHANGED')deny('PROOF_BINDING_SOURCE');throw error;}
 return contract;
}
export function loadContract(filename){
 const bytes=readFileSync(filename);let contract;try{contract=JSON.parse(bytes.toString('utf8'));}catch{deny('CONTRACT_CHECKSUM');}
 const checksumContract=hasCaptureRuntime(contract)?captureBudget.restoreCaptureRuntimePreviousContract(contract):contract;
 // Keep the complete historical checksum. The separately authenticated outer
 // declaration must restore those exact bytes; no self-referential new checksum.
 if(hash(bytes)!==EXPECTED_CONTRACT_SHA256){
  if(!checksumContract?.[WORKSITE_LIVE_HOURS_CURRENT_SECTION])deny('CONTRACT_CHECKSUM');
  try{if(hash(JSON.stringify(restoreWorksiteLiveHoursPreviousContract(checksumContract),null,2)+'\n')!==EXPECTED_CONTRACT_SHA256)deny('CONTRACT_CHECKSUM');}catch(error){if(error.code==='WORKSITE_LIVE_HOURS_CURRENT_CI_LINEAGE_REJECTED')deny('CONTRACT_CHECKSUM');throw error;}
 }
 return validateContract(contract);
}
export function buildWorkflow(contract){
 if(hasCaptureRuntime(contract))return buildCaptureRuntimeWorkflow(contract,buildWorkflow(captureBudget.restoreCaptureRuntimePreviousContract(contract)));
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
    ...ownership.blocks.map(id=>clone(currentCommandBlock(contract,id).step)),
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
 return {blocks:contract.blocks.length,artifactPatterns:contract.artifactPatterns.length,lanes:LANES.length};
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
 const readSource=gitSource(root,actual);
 const expectedTree=execFileSync('git',['rev-parse',actual+'^{tree}'],{cwd:root,encoding:'utf8'}).trim();
 // Preserve verified screenshot bytes through the existing narrow upload
 // pattern. The producer's private temporary paths remain original provenance.
 let weeklyUi=null;
 if(lane==='plans'&&contract.weeklyCypCurrentRevision){const bytes=readFileSync(path.join(root,'.vercel/private/plan-import-ui-validation.json'));weeklyUi={bytes,screenshots:(contract[PLAN_PARTIDA_PREVIEW_CURRENT_SECTION]?retainPlanPartidaPreviewUiScreenshots:retainWeeklyCypImportUiScreenshots)({root,bytes,readSource,expectedHead:actual,expectedTree})};}
 const files=collect(root,owner.artifacts);
 requireEvidence(files,owner.requiredRetainedEvidence,'MISSING_REQUIRED_RETAINED_EVIDENCE');
 const producedNotUploaded=collect(root,owner.requiredProducedEvidence);
 requireEvidence(producedNotUploaded,owner.requiredProducedEvidence,'MISSING_REQUIRED_PRODUCED_EVIDENCE');
  verifyWhatsappPlanTestSources(contract,readSource);
  verifyKycExpiredCurrentSources(contract.kycExpiredCurrentComposition,readSource);
 // The retained block26 proof keeps its historical37 and adds nine wait controls.
 if(lane==='meta'&&contract.progressEvidenceWaitCurrentRevision){
  const nativePath='.vercel/meta-field-evidence/postgres.json',nativeBytes=readFileSync(path.join(root,nativePath)),retained=files.find(file=>file.path===nativePath);
  if(!retained||retained.sha256!==hash(nativeBytes)||retained.bytes!==nativeBytes.length)deny('PROOF_PROGRESS_WAIT_FILE_BINDING');
  const nativeReader=file=>file===nativePath?readFileSync(path.join(root,nativePath)):readSource(file);
  try{validateProgressEvidenceWaitNativeProofBytes(nativeBytes,contract,nativeReader);}catch(error){if(error.code==='PROGRESS_EVIDENCE_WAIT_NATIVE_PROOF_REJECTED')deny('PROOF_PROGRESS_WAIT_BOUNDARY');throw error;}
  if(!readFileSync(path.join(root,nativePath)).equals(nativeBytes))deny('PROOF_PROGRESS_WAIT_FILE_BINDING');
 }
 // This is an explicit semantic check of the retained native block29 proof.
 // It validates exactly the bytes hashed into the same provenance record.
 if(lane==='channels'){
  const nativePath='.vercel/private/company-channel-postgres-proof.json',nativeBytes=readFileSync(path.join(root,nativePath)),retained=files.find(file=>file.path===nativePath);
  if(!retained||retained.sha256!==hash(nativeBytes)||retained.bytes!==nativeBytes.length)deny('PROOF_COMPANY_CORE_FILE_BINDING');
  try{if(hasCaptureRuntime(contract)){const proof=JSON.parse(nativeBytes);normalizeCaptureCompanyCoreNativeProof({contract,proof,root,readSource,readEvidence:file=>{if(file!==nativePath)return null;const fresh=readFileSync(path.join(root,nativePath));if(!fresh.equals(nativeBytes))deny('PROOF_COMPANY_CORE_FILE_BINDING');return fresh;},normalizeLegacy:(projected,reader)=>validateCompanyOnboardingUxNativeProofBytes(Buffer.from(JSON.stringify(projected)),reader)});}else validateCompanyOnboardingUxNativeProofBytes(nativeBytes,readSource);}catch(error){if(error.code==='COMPANY_ONBOARDING_UX_NATIVE_PROOF_REJECTED'||error.code==='CAPTURE_QUALITY_COLLECTOR_REJECTED')deny('PROOF_COMPANY_CORE_BOUNDARY');throw error;}
 }
 // The same retained block12 browser bytes must contain all160 historical
 // journeys plus the four canonical v5 journeys. Viewport PNGs are read here;
 // this local synthetic check does not certify a human or provider workflow.
 if(weeklyUi){
  const uiPath='.vercel/private/plan-import-ui-validation.json',retained=files.find(file=>file.path===uiPath);
  if(!retained||retained.sha256!==hash(weeklyUi.bytes)||retained.bytes!==weeklyUi.bytes.length)deny('PROOF_WEEKLY_CYP_UI_FILE_BINDING');
  (contract[PLAN_PARTIDA_PREVIEW_CURRENT_SECTION]?validatePlanPartidaPreviewRetainedScreenshotBindings:validateWeeklyCypRetainedScreenshotBindings)(files,weeklyUi.screenshots);
 }

  const extensionProofBindings=contract.extension.proofs.filter(p=>p.lane===lane).map(spec=>validateExtensionProof(spec,readFileSync(path.join(root,spec.path)),{expectedHead:actual,expectedTree,...clock,readSource,expectedRoot:root,readEvidence:file=>readFileSync(path.join(root,cleanPath(file)))}));
 if(lane==='workspace-ui'&&contract.identityDestinationUxCurrentRevision){const raw=JSON.parse(readFileSync(path.join(root,'.vercel/workspace-identity-only-evidence/browser.json')));validateIdentityDestinationRetainedScreenshots(files,raw.destinationNavigation?.checks?.map(row=>row.screenshot));}
 const record=seal({version:2,proofBindings:extensionProofBindings,lane,head:actual,...clock,workflowSha256,contractSha256:EXPECTED_CONTRACT_SHA256,blockIds:[...owner.blocks],commandDigests:owner.blocks.map(id=>currentCommandBlock(contract,id).commandSha256),artifactPatterns:[...owner.artifacts],requiredRetainedEvidence:[...owner.requiredRetainedEvidence],requiredProducedEvidence:[...owner.requiredProducedEvidence],producedNotUploaded,verifierSha256:verifierSha256(),packageLockSha256:contract.packageLockSha256,requirementsSha256:contract.requirementsSha256,files});
 if(Buffer.byteLength(JSON.stringify(record))>400*1024)deny('PROVENANCE_LIMIT');
 assertLaneOutputSize(JSON.stringify(record));
 return record;
}
export function retainWeeklyCypImportUiScreenshots({root,bytes,readSource,expectedHead,expectedTree}){
 const originals=new Map(),readEvidence=file=>{const target=path.join(root,cleanPath(file)),stat=lstatSync(target);if(!stat.isFile()||stat.isSymbolicLink()||!realpathSync(target).startsWith(realpathSync(root)+path.sep))deny('PROOF_WEEKLY_CYP_UI_SCREENSHOT_SOURCE');const data=readFileSync(target);originals.set(file,data);return data;};
 try{validateWeeklyCypImportUiProofBytes(bytes,readSource,{expectedHead,expectedTree,readEvidence});}catch(error){if(error.code==='WEEKLY_CYP_UI_PROOF_REJECTED')deny('PROOF_WEEKLY_CYP_UI_BOUNDARY');throw error;}
 const proof=JSON.parse(utf8(bytes)),retained=[];
 for(const declaration of WEEKLY_CYP_CURRENT_REVISION.browser.retainedScreenshots){const source=proof.investmentCurveChecks.find(row=>row.width===declaration.width),data=originals.get(source.screenshot),target=path.join(root,cleanPath(declaration.path));if(!Buffer.isBuffer(data)||!realpathSync(path.dirname(target)).startsWith(realpathSync(root)+path.sep))deny('PROOF_WEEKLY_CYP_UI_SCREENSHOT_SOURCE');
  // Preflight forbids stale evidence. Exclusive creation also prevents an
  // existing file or link from being overwritten by the retention seam.
  writeFileSync(target,data,{flag:'wx'});if(!readFileSync(target).equals(data))deny('PROOF_WEEKLY_CYP_UI_SCREENSHOT_BINDING');retained.push({path:declaration.path,sha256:hash(data),bytes:data.length});}
 return retained;
}
export function validateWeeklyCypRetainedScreenshotBindings(files,expected=null){
 if(!Array.isArray(files))deny('PROOF_WEEKLY_CYP_UI_SCREENSHOT_BINDING');
 if(expected!==null&&(!Array.isArray(expected)||expected.length!==4||new Set(expected.map(row=>row.path)).size!==4))deny('PROOF_WEEKLY_CYP_UI_SCREENSHOT_BINDING');
 for(const declaration of WEEKLY_CYP_CURRENT_REVISION.browser.retainedScreenshots){const matches=files.filter(row=>row.path===declaration.path);if(matches.length!==1||!sha(matches[0].sha256)||!Number.isSafeInteger(matches[0].bytes)||matches[0].bytes<=24)deny('PROOF_WEEKLY_CYP_UI_SCREENSHOT_BINDING');if(expected){const bound=expected.find(row=>row.path===declaration.path);if(!bound||bound.sha256!==matches[0].sha256||bound.bytes!==matches[0].bytes)deny('PROOF_WEEKLY_CYP_UI_SCREENSHOT_BINDING');}}
}
// The old164 retention/decoder entry remains strict. Current record/gate uses
// this separate180 entry only with the authenticated compiled outer contract.
export function retainPlanPartidaPreviewUiScreenshots({root,bytes,readSource,expectedHead,expectedTree}){
 const originals=new Map(),rootReal=realpathSync(root),readEvidence=file=>{const target=path.isAbsolute(file)?path.resolve(file):path.join(root,cleanPath(file)),relative=path.relative(rootReal,target).split(path.sep).join('/');cleanPath(relative);const stat=lstatSync(target);if(!stat.isFile()||stat.isSymbolicLink()||!realpathSync(target).startsWith(rootReal+path.sep))deny('PROOF_PLAN_PARTIDA_UI_SCREENSHOT_SOURCE');const data=readFileSync(target);originals.set(file,data);return data;};
 try{validatePlanPartidaPreviewImportUiProofBytes(bytes,readSource,{expectedHead,expectedTree,expectedRoot:rootReal,readEvidence});}catch(error){if(['WEEKLY_CYP_UI_PROOF_REJECTED','PLAN_PARTIDA_PREVIEW_UI_PROOF_REJECTED','PLAN_PARTIDA_PREVIEW_CURRENT_CI_LINEAGE_REJECTED'].includes(error.code))deny('PROOF_PLAN_PARTIDA_UI_BOUNDARY');throw error;}
 const proof=JSON.parse(utf8(bytes)),retained=[],declarations=[...WEEKLY_CYP_CURRENT_REVISION.browser.retainedScreenshots.map(row=>({...row,kind:'investment'})),...PLAN_PARTIDA_PREVIEW_CURRENT_REVISION.browser.retainedTableScreenshots.map(row=>({...row,kind:'table'}))];
 for(const row of declarations){const source=row.kind==='investment'?proof.investmentCurveChecks.find(item=>item.width===row.width)?.screenshot:proof.curveTableReadbacks.find(item=>item.width===row.width)?.screenshot?.path,data=originals.get(source),target=path.join(root,cleanPath(row.path));if(!Buffer.isBuffer(data)||!realpathSync(path.dirname(target)).startsWith(rootReal+path.sep))deny('PROOF_PLAN_PARTIDA_UI_SCREENSHOT_SOURCE');writeFileSync(target,data,{flag:'wx'});if(!readFileSync(target).equals(data))deny('PROOF_PLAN_PARTIDA_UI_SCREENSHOT_BINDING');retained.push({path:row.path,sha256:hash(data),bytes:data.length});}
 return retained;
}
export function validatePlanPartidaPreviewRetainedScreenshotBindings(files,expected=null){
 const tables=PLAN_PARTIDA_PREVIEW_CURRENT_REVISION.browser.retainedTableScreenshots,oldPaths=WEEKLY_CYP_CURRENT_REVISION.browser.retainedScreenshots.map(row=>row.path);if(expected!==null&&(!Array.isArray(expected)||expected.length!==8||new Set(expected.map(row=>row.path)).size!==8))deny('PROOF_PLAN_PARTIDA_UI_SCREENSHOT_BINDING');validateWeeklyCypRetainedScreenshotBindings(files,expected?expected.filter(row=>oldPaths.includes(row.path)):null);
 for(const row of tables){const matches=files.filter(file=>file.path===row.path);if(matches.length!==1||!sha(matches[0].sha256)||!Number.isSafeInteger(matches[0].bytes)||matches[0].bytes<=45)deny('PROOF_PLAN_PARTIDA_UI_SCREENSHOT_BINDING');if(expected){const original=expected.find(file=>file.path===row.path);if(!original||original.sha256!==matches[0].sha256||original.bytes!==matches[0].bytes)deny('PROOF_PLAN_PARTIDA_UI_SCREENSHOT_BINDING');}}
}
export function validateIdentityDestinationRetainedScreenshots(files,expected=null){
 const declared=IDENTITY_DESTINATION_UX_CURRENT_REVISION.browser.retainedScreenshots;if(expected&&JSON.stringify(expected.map(row=>row?.path))!==JSON.stringify(declared.map(row=>row.path)))deny('PROOF_IDENTITY_DESTINATION_SCREENSHOT_BINDING');
 for(const[index,row]of declared.entries()){const matches=files.filter(file=>file.path===row.path);if(matches.length!==1||!sha(matches[0].sha256)||matches[0].bytes<24||expected&&matches[0].sha256!==expected[index].sha256)deny('PROOF_IDENTITY_DESTINATION_SCREENSHOT_BINDING');}
 return true;
}
export function gate({needs,contract,expectedHead,workflowSha256,runId,runAttempt,readSource}){
 validateContract(contract);if(!head(expectedHead)||!sha(workflowSha256)||!positive(runId)||!positive(runAttempt))deny('EXPECTED_IDENTITY_INVALID');
 if(typeof readSource!=='function')deny('PROOF_SOURCE_RESOLVER');
 try{verifyKycExpiredCurrentSources(contract.kycExpiredCurrentComposition,readSource);}catch(error){if(['KYC_EXPIRED_CURRENT_LINEAGE_REJECTED','PLAN_MEASUREMENT_CURRENT_CI_LINEAGE_REJECTED'].includes(error.code))deny('PROOF_BINDING_SOURCE');throw error;}
 return evaluateGateRecords({needs,contract,expectedHead,workflowSha256,runId,runAttempt},{assertBindings:(bindings,lane,files)=>assertProofBindings(bindings,contract,lane,files,expectedHead,readSource),verifierDigest:verifierSha256});
}
function evaluateGateRecords({needs,contract,expectedHead,workflowSha256,runId,runAttempt},{assertBindings,verifierDigest}){
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
  if(record.version!==2||record.lane!==lane||record.head!==expectedHead||record.runId!==runId||record.runAttempt!==runAttempt||record.workflowSha256!==workflowSha256||record.contractSha256!==EXPECTED_CONTRACT_SHA256||record.verifierSha256!==verifierDigest()||record.packageLockSha256!==contract.packageLockSha256||record.requirementsSha256!==contract.requirementsSha256)deny('PROVENANCE_IDENTITY');
  if(!sha(record.manifestSha256)||hash(JSON.stringify(unseal(record))+'\n')!==record.manifestSha256)deny('PROVENANCE_DIGEST');
  equal(record.blockIds,contract.lanes[lane].blocks,'BLOCK_COVERAGE');
  equal(record.commandDigests,record.blockIds.map(id=>currentCommandBlock(contract,id).commandSha256),'COMMAND_DIGEST');
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
  if(lane==='plans'&&contract.weeklyCypCurrentRevision)(contract[PLAN_PARTIDA_PREVIEW_CURRENT_SECTION]?validatePlanPartidaPreviewRetainedScreenshotBindings:validateWeeklyCypRetainedScreenshotBindings)(record.files);
  if(lane==='plans'&&contract[PLAN_BUDGET_CURRENT_SECTION])budgetScreenshotSummary(record.files);
  if(lane==='workspace-ui'&&contract.identityDestinationUxCurrentRevision)validateIdentityDestinationRetainedScreenshots(record.files);
  if(!Array.isArray(record.producedNotUploaded)||record.producedNotUploaded.length!==record.requiredProducedEvidence.length)deny('MISSING_REQUIRED_PRODUCED_EVIDENCE');
  for(const file of record.producedNotUploaded){
   exactKeys(file,['path','sha256','bytes'],'INVALID_EVIDENCE_SHAPE');cleanPath(file.path);
   if(paths.has(file.path))deny('PATH_COLLISION');paths.add(file.path);
   if(!sha(file.sha256)||!Number.isSafeInteger(file.bytes)||file.bytes<0||file.bytes>64*1024*1024)deny('INVALID_EVIDENCE_DIGEST');
   if(!record.requiredProducedEvidence.includes(file.path))deny('PRODUCED_EVIDENCE_NOT_OWNED');
  }
  requireEvidence(record.producedNotUploaded,record.requiredProducedEvidence,'MISSING_REQUIRED_PRODUCED_EVIDENCE');
  if(record.files.reduce((n,item)=>n+item.bytes,0)>200*1024*1024)deny('EVIDENCE_LIMIT');
  assertBindings(record.proofBindings,lane,record.files);
  fileCount+=record.files.length;
  records.push({lane,artifactId:job.outputs.artifactId,artifactDigest:job.outputs.artifactDigest,manifestSha256:record.manifestSha256,fileCount:record.files.length,producedNotUploaded:record.producedNotUploaded,blockIds:record.blockIds,proofBindings:record.proofBindings});
 }
 equal(records.flatMap(record=>record.blockIds).sort((a,b)=>a-b),contract.blocks.map(block=>block.id),'TOTAL_BLOCK_COVERAGE');
 return {version:1,state:'PASS',head:expectedHead,runId,runAttempt,workflowSha256,contractSha256:EXPECTED_CONTRACT_SHA256,verifierSha256:verifierDigest(),packageLockSha256:contract.packageLockSha256,requirementsSha256:contract.requirementsSha256,lanes:records,commandBlocks:contract.blocks.length,artifactPatterns:contract.artifactPatterns.length,requiredRetainedFiles:Object.values(contract.lanes).flatMap(owner=>owner.requiredRetainedEvidence).length,producedNotUploadedFiles:Object.values(contract.lanes).flatMap(owner=>owner.requiredProducedEvidence).length,fileCount};
}
function expectedNeeds(contract,expectedHead,workflowSha256,readSource){
 return Object.fromEntries(LANES.map((lane,i)=>{
  const owner=contract.lanes[lane],file=filename=>({path:filename,sha256:'1'.repeat(64),bytes:128}),files=owner.requiredRetainedEvidence.map(file);
  if(lane==='plans'&&contract.weeklyCypCurrentRevision)files.push(...WEEKLY_CYP_CURRENT_REVISION.browser.retainedScreenshots.map(row=>file(row.path)));
  if(lane==='plans'&&contract[PLAN_PARTIDA_PREVIEW_CURRENT_SECTION])files.push(...PLAN_PARTIDA_PREVIEW_CURRENT_REVISION.browser.retainedTableScreenshots.map(row=>file(row.path)));
  if(lane==='plans'&&contract[PLAN_BUDGET_CURRENT_SECTION])files.push(...planBudgetRetainedScreenshotPaths(contract).map(file));
  if(lane==='workspace-ui'&&contract.identityDestinationUxCurrentRevision)files.push(...IDENTITY_DESTINATION_UX_CURRENT_REVISION.browser.retainedScreenshots.map(row=>file(row.path)));
  const record=seal({version:2,proofBindings:proofBindings(contract,lane,files,expectedHead,readSource),lane,head:expectedHead,runId:'100',runAttempt:'1',workflowSha256,contractSha256:EXPECTED_CONTRACT_SHA256,blockIds:[...owner.blocks],commandDigests:owner.blocks.map(id=>currentCommandBlock(contract,id).commandSha256),artifactPatterns:[...owner.artifacts],requiredRetainedEvidence:[...owner.requiredRetainedEvidence],requiredProducedEvidence:[...owner.requiredProducedEvidence],producedNotUploaded:owner.requiredProducedEvidence.map(file),verifierSha256:verifierSha256(),packageLockSha256:contract.packageLockSha256,requirementsSha256:contract.requirementsSha256,files});
  return [lane,{result:'success',outputs:{provenance:JSON.stringify(record),artifactId:String(i+1),artifactDigest:'2'.repeat(64)}}];
 }));
}
const PURE_PROVENANCE_DECODER_BOUNDARY='pure provenance decoder; not public gate integration; not native or human acceptance';
function freezeProvenanceFixture(value){
 if(value&&typeof value==='object'){for(const child of Object.values(value))freezeProvenanceFixture(child);Object.freeze(value);}return value;
}
// Only selftests call this private factory, after their actual current gate
// positive. Its owned expectations never enter the public gate or a source scope.
function ownedProvenanceDecoder(input,authenticatedReport){
 assert.equal(authenticatedReport.state,'PASS');assert.equal(authenticatedReport.head,input.expectedHead);equal(authenticatedReport.lanes.map(row=>row.lane),LANES,'DECODER_FIXTURE_LANES');
 const context=freezeProvenanceFixture(clone({contract:input.contract,expectedHead:input.expectedHead,workflowSha256:input.workflowSha256,runId:input.runId,runAttempt:input.runAttempt}));
 const fields=['id','path','producer','kind','result','sourceRevision','harnessSha256','sourceManifestSha256','sourceReferences'];
 const owned=freezeProvenanceFixture(Object.fromEntries(authenticatedReport.lanes.map(row=>[
  row.lane,row.proofBindings.map(binding=>Object.fromEntries(fields.map(key=>[key,clone(binding[key])]))),
 ])));
 const digest=authenticatedReport.verifierSha256;assert.ok(sha(digest));
 for(const lane of LANES)equal(owned[lane].map(row=>row.id),context.contract.extension.proofs.filter(spec=>spec.lane===lane).map(spec=>spec.id),'DECODER_FIXTURE_BINDINGS');
 const expected=(lane,files)=>context.contract.extension.proofs.filter(spec=>spec.lane===lane).map((spec,index)=>({...owned[lane][index],proofSha256:files.find(file=>file.path===spec.path).sha256,bytes:files.find(file=>file.path===spec.path).bytes,checks:summary(spec,files,context.contract)}));
 const assertBindings=(bindings,lane,files)=>assertProofBindingsWithExpected(bindings,context.contract,lane,()=>expected(lane,files));
 const decode=needs=>evaluateGateRecords({...context,needs},{assertBindings,verifierDigest:()=>digest});
 const check=(checks,name,code,run)=>{if(code)assert.throws(run,error=>error.code===code);else run();checks.push({name,result:'PASS',...(code?{expectedDenial:code}:{}),boundary:PURE_PROVENANCE_DECODER_BOUNDARY});};
 return Object.freeze({decode,
  variableFiles(checks,prefix,needs,specId){
   const spec=context.contract.extension.proofs.find(row=>row.id===specId);assert.ok(spec);
   for(const field of ['sha256','bytes']){const value=clone(needs),record=JSON.parse(value[spec.lane].outputs.provenance),file=record.files.find(row=>row.path===spec.path);assert.ok(file);file[field]=field==='sha256'?'f'.repeat(64):file.bytes+1;value[spec.lane].outputs.provenance=JSON.stringify(seal(unseal(record)));check(checks,prefix+'-current-files-'+field+'-resealed','PROOF_BINDING_IDENTITY',()=>decode(value));}
  },
  coreChecks(checks,needs){
   const lane=LANES[0],record=JSON.parse(needs[lane].outputs.provenance),bindings=clone(record.proofBindings);let calls=0;
   for(const [name,value]of [['not-array',null],['wrong-ids',[]]])check(checks,'provenance-decoder-lazy-'+name,'PROOF_BINDINGS',()=>{try{assertProofBindingsWithExpected(value,context.contract,lane,()=>{calls++;return expected(lane,record.files);});}finally{assert.equal(calls,0);}});
   const malformed=clone(bindings);malformed[0].extra=true;
   check(checks,'provenance-decoder-shape-after-factory','PROOF_BINDING_SHAPE',()=>{calls=0;try{assertProofBindingsWithExpected(malformed,context.contract,lane,()=>{calls++;return expected(lane,record.files);});}finally{assert.equal(calls,1);}});
   const sentinel=Object.assign(new Error('Controlled expected-binding failure'),{code:'DECODER_EXPECTED_FACTORY_SENTINEL'});
   check(checks,'provenance-decoder-factory-error-before-shape','DECODER_EXPECTED_FACTORY_SENTINEL',()=>assertProofBindingsWithExpected(malformed,context.contract,lane,()=>{throw sentinel;}));
   check(checks,'provenance-decoder-verifier-nine-calls-on-pass',null,()=>{calls=0;const result=evaluateGateRecords({...context,needs},{assertBindings,verifierDigest:()=>{calls++;return digest;}});assert.equal(result.state,'PASS');assert.equal(calls,9);});
   check(checks,'provenance-decoder-wrong-head-short-circuits-verifier','PROVENANCE_IDENTITY',()=>{const value=clone(needs),first=JSON.parse(value[lane].outputs.provenance);first.head='f'.repeat(40);value[lane].outputs.provenance=JSON.stringify(seal(unseal(first)));calls=0;try{evaluateGateRecords({...context,needs:value},{assertBindings,verifierDigest:()=>{calls++;return digest;}});}finally{assert.equal(calls,0);}});
  },
 });
}
function provenanceDecoderPublicIntegrationSelftest(workflow,contract,root){
 const checks=[],expectedHead='a'.repeat(40),workflowSha256=hash(canonical(workflow)),readSource=file=>Buffer.from(utf8(readFileSync(path.join(root,sourcePath(file)))).replaceAll('\r\n','\n'));
 // A separate CURRENT matrix. Never derive these 22 rows from a historical
 // native fixture, whose proof family and source counts are intentionally older.
 const needs=expectedNeeds(contract,expectedHead,workflowSha256,readSource),input={needs,contract,expectedHead,workflowSha256,runId:'100',runAttempt:'1',readSource};
 const ids=['bank-intake-units','bank-postgres','intake-postgres','bank-ui','intake-ui','joint-ui','joint-causal','company-kyc-postgres','project-preparation-postgres','project-preparation-ui','portfolio-units','portfolio-ui','portfolio-postgres','identity-only-ui','field-canonical-postgres','overtime-canonical-postgres','plan-baseline-postgres','document-curve-ui','participant-kyc-preanalysis-postgres','focused-workspace-ui','field-task-pagination-ui','budget-source-ui'];
 equal(contract.extension.proofs.map(spec=>spec.id),ids,'PUBLIC_GATE_INTEGRATION_CATALOG');
 const good=(name,run)=>{run();checks.push({name,result:'PASS',boundary:'public current gate integration; no native or human acceptance'});};
 const bad=(name,code,run)=>{assert.throws(run,error=>error.code===code);checks.push({name,result:'PASS',expectedDenial:code,boundary:'public current gate integration; no native or human acceptance'});};
 for(const id of ids){const spec=contract.extension.proofs.find(row=>row.id===id),value=clone(needs),record=JSON.parse(value[spec.lane].outputs.provenance);record.proofBindings.find(row=>row.id===id).sourceManifestSha256='f'.repeat(64);value[spec.lane].outputs.provenance=JSON.stringify(seal(unseal(record)));let reads=0;bad('public-gate-binding-valid64-wrong-'+id,'PROOF_BINDING_SOURCE',()=>{try{gate({...input,needs:value,readSource:file=>{reads++;return readSource(file);}});}finally{assert.ok(reads>0);}});}
 const producer=contract.extension.proofs[0].producer,actual=readSource(producer),changed=Buffer.concat([actual,Buffer.from('\n// controlled public gate source mutation\n')]);let altered=false;
 const mutable=file=>file===producer&&altered?changed:readSource(file);
 good('public-gate-same-reader-initial-success',()=>assert.equal(gate({...input,readSource:mutable}).state,'PASS'));
 altered=true;bad('public-gate-same-reader-change-after-success','PROOF_BINDING_SOURCE',()=>gate({...input,readSource:mutable}));altered=false;
 good('public-gate-valid-reader-recovers-without-cache',()=>assert.equal(gate({...input,readSource:mutable}).state,'PASS'));
 const afterPrefix=extra=>{const value=clone(needs),outputs=value[LANES[0]].outputs,original=outputs.provenance,record=JSON.parse(original);record.proofBindings[0].extra=true;const malformed=JSON.stringify(seal(unseal(record)));altered=false;Object.defineProperty(outputs,'provenance',{enumerable:true,get(){altered=true;return malformed;}});return {...input,...extra,needs:value,readSource:mutable};};
 bad('public-gate-source-denial-after-prefix-before-binding-shape','PROOF_HARNESS_SOURCE',()=>gate(afterPrefix({})));
 for(const field of ['skipSourceValidation','sourceAlreadyVerified','expectedBindings','bindingForLane','assertBindings'])bad('public-gate-extra-port-fields-cannot-bypass-'+field,'PROOF_HARNESS_SOURCE',()=>gate(afterPrefix({[field]:()=>[]})));
 good('public-gate-private-export-set-unchanged',()=>{const ast=parse(readFileSync(path.join(root,script),'utf8'),{sourceType:'module'});assert.equal(ast.program.body.some(node=>node.type==='ExportDefaultDeclaration'||node.type==='ExportAllDeclaration'||node.type==='ExportNamedDeclaration'&&node.source!==null),false);const actual=ast.program.body.filter(node=>node.type==='ExportNamedDeclaration').flatMap(node=>node.declaration?.id?[node.declaration.id.name]:node.declaration?.declarations?node.declaration.declarations.map(row=>row.id.name):node.specifiers.map(row=>row.exported.name));equal(actual,['EXPECTED_CONTRACT_SHA256','WHATSAPP_FEEDBACK_PREVIOUS_SOURCE_COUNTS','IDENTITY_ONLY_CHECKS','LANES','validateCompanyKycContextNativeProof','validateDocumentCurveUiContract','validateExtensionProof','validatePlanBaselineContract','currentProducerSourceFiles','validateWhatsappFeedbackPreviousSourceLineage','cleanPath','assertSourceIdentity','validateContract','loadContract','buildWorkflow','equivalent','assertFreshEvidence','canonicalDependencyTextSha256','assertDependencies','assertLaneOutputSize','readLaneNeedsEnvironment','provenance','retainWeeklyCypImportUiScreenshots','validateWeeklyCypRetainedScreenshotBindings','retainPlanPartidaPreviewUiScreenshots','validatePlanPartidaPreviewRetainedScreenshotBindings','validateIdentityDestinationRetainedScreenshots','gate','kycExpiredCurrentCompositionSelftest','selftest','planBudgetCurrentGateSelftest','selftestErrorDiagnostics'],'PUBLIC_GATE_EXPORT_SET');});
 return checks;
}
export function kycExpiredCurrentCompositionSelftest(contract,root=process.cwd()){
 const checks=[],section=contract.kycExpiredCurrentComposition,prefix='kyc-expired-current-composition-';
 const good=(name,run)=>{run();checks.push({name:prefix+name,result:'PASS',boundary:'pure current source/contract read; no PG/provider execution'});};
 const bad=(name,run)=>{assert.throws(run,error=>['KYC_EXPIRED_CURRENT_LINEAGE_REJECTED','PLAN_MEASUREMENT_CURRENT_CI_LINEAGE_REJECTED'].includes(error.code));checks.push({name:prefix+name,result:'PASS',expectedDenial:'KYC_EXPIRED_CURRENT_LINEAGE_REJECTED',boundary:'pure source/contract negative fixture'});};
 const readSource=file=>Buffer.from(readFileSync(path.join(root,file),'utf8').replaceAll('\r\n','\n'));
 good('all-published-contract-fields-byte-equivalent',()=>validateKycExpiredCurrentWorkspaceContract(contract));
 good('actual-production-and-native-125-source-closure',()=>{
  const result=verifyKycExpiredCurrentSources(section,readSource);assert.equal(result.publishedCurrentSourceCount??result.sourceCount,contract.planMeasurementCurrentLineage?127:125);
  if(contract[PLAN_BUDGET_CURRENT_SECTION]){
   // Authenticate a private snapshot before using the current COMPACT binding.
   // The published127/125/117 lineage and the older fallback remain independent.
   const current=clone(contract);verifyPlanBudgetCurrentSources(current,readSource);
   const compact=current[PLAN_BUDGET_CURRENT_SECTION].sourceSetDeltas.find(row=>row.family==='COMPACT'),family=current[PLAN_BUDGET_CURRENT_SECTION].sourceFamilies.find(row=>row.family==='COMPACT');
   assert.ok(compact&&family,'The authenticated current COMPACT delta and family are required');
   if(hasCaptureRuntime(current)){
    const parent=captureBudget.restoreCaptureRuntimePreviousContract(current),prior=parent[PLAN_BUDGET_CURRENT_SECTION].sourceFamilies.find(row=>row.family==='COMPACT');
    const advance=current[PLAN_BUDGET_CURRENT_SECTION].captureQualityRuntime.familyAdvances.find(row=>row.family==='COMPACT');
    assert.ok(prior&&advance,'The exact parent COMPACT family and additive capture delta are required');
    assert.equal(compact.currentCount,prior.currentFiles.length);assert.equal(compact.currentPathsSha256,hash(canonical(prior.currentFiles)));
    assert.equal(advance.previousCount,prior.currentFiles.length);assert.equal(advance.currentCount,family.currentFiles.length);
    assert.deepEqual(advance.removals,[]);assert.deepEqual([...prior.currentFiles,...advance.additions].sort(),family.currentFiles);
   }else{assert.equal(compact.currentCount,family.currentFiles.length);assert.equal(compact.currentPathsSha256,hash(canonical(family.currentFiles)));}
   assert.equal(result.sourceCount,family.currentFiles.length);assert.equal(result.sourcePathsSha256,hash(canonical(family.currentFiles)));
  }else assert.equal(result.sourceCount,contract[WORKSITE_LIVE_HOURS_CURRENT_SECTION]?.sourceSetDeltas.find(row=>row.family==='COMPACT')?.currentCount??contract.whatsappFieldContinuityCurrentRevision?.sourceSetDeltas.find(row=>row.family==='COMPACT').currentCount??contract.integratedIdentityCurrentRevision?.consumerSourceDeltas.find(row=>row.family==='COMPACT').currentCount??contract.participantPreanalysisCurrentRevision?.consumerSourceDeltas.find(row=>row.family==='COMPACT').currentCount??(contract.planMeasurementCurrentLineage?127:125));
 });
 good('old-117-source-corpus-plus-exact-eight-additions',()=>{assert.equal(section.previousSourceCount,117);assert.equal(section.sourceFiles.length,125);equal(section.sourceAdditions,KYC_EXPIRED_CURRENT_ADDITIONS,'PROOF_BINDING_SOURCE');});
 good('thirteen-historical-plus-prior-and-composed-contexts',()=>{assert.equal(section.historicalScenarioCount,13);assert.equal(section.historicalMeasurementCount,3);assert.equal(section.historicalPostCount,4);assert.equal(section.priorContextPostCount,1);assert.equal(section.composedCurrentPostCount,1);assert.equal(section.totalPostCount,6);});
 for(const [name,edit]of [
  ['missing-section',value=>{delete value.kycExpiredCurrentComposition;}],
  ['historical-contract-field-replaced',value=>{value.packageLockSha256='f'.repeat(64);} ],
  ['old-117-cannot-certify-current',value=>{value.kycExpiredCurrentComposition.sourceCount=117;}],
  ['same-count-foreign-current-source',value=>{value.kycExpiredCurrentComposition.sourceFiles[0]='src/lib/foreign-source.mjs';}],
  ['source-addition-omitted',value=>{value.kycExpiredCurrentComposition.sourceAdditions.pop();}],
  ['historical-source-corpus-replaced',value=>{value.kycExpiredCurrentComposition.previousSourcePathsSha256='f'.repeat(64);} ],
  ['historical-check-sequence-replaced',value=>{value.kycExpiredCurrentComposition.historicalChecksSha256='f'.repeat(64);} ],
  ['prior-context-check-substituted',value=>{value.kycExpiredCurrentComposition.priorContextChecks=[...value.kycExpiredCurrentComposition.composedCurrentChecks];}],
  ['current-context-check-omitted',value=>{value.kycExpiredCurrentComposition.composedCurrentChecks=[];}],
  ['original-lease-extended',value=>{value.kycExpiredCurrentComposition.sourceLeaseMs=120000;}],
  ['blanket-total-substituted',value=>{value.kycExpiredCurrentComposition.historicalPostCount=6;value.kycExpiredCurrentComposition.priorContextPostCount=0;value.kycExpiredCurrentComposition.composedCurrentPostCount=0;}],
  ['old-validator-pin-cannot-certify-current',value=>{value.kycExpiredCurrentComposition.validationSources.find(ref=>ref.path==='scripts/verify-company-kyc-outbound-compact-ci.mjs').sha256=value.kycExpiredCurrentComposition.previousValidatorSha256;}],
 ])bad(name,()=>{const changed=clone(contract);edit(changed);validateKycExpiredCurrentWorkspaceContract(changed);});
 for(const file of KYC_EXPIRED_CURRENT_ADDITIONS)bad('missing-runtime-dependency-'+file,()=>verifyKycExpiredCurrentSources(section,name=>name===file?null:readSource(name)));
 for(const ref of [...section.reviewedSources,...section.validationSources])bad('changed-reviewed-Git-bytes-'+ref.path,()=>verifyKycExpiredCurrentSources(section,file=>file===ref.path?Buffer.concat([readSource(file),Buffer.from('\n// altered reviewed bytes\n')]):readSource(file)));
 for(const file of KYC_EXPIRED_CURRENT_VALIDATION_SOURCES)bad('validation-source-pin-omitted-'+file,()=>{const changed=clone(contract);changed.kycExpiredCurrentComposition.validationSources=changed.kycExpiredCurrentComposition.validationSources.filter(ref=>ref.path!==file);validateKycExpiredCurrentWorkspaceContract(changed);});
 return checks;
}
export function selftest(workflow,contract,root=process.cwd()){
 // Preserve the original typed negative oracles on the complete authenticated
 // prior contract; the new outer revision has independent current-source negatives.

 const selftestProgressToken003=selftestProgressStart("F0.restore-historical-fixture");
 const historicalContractForNegativeFixtures=restoreParticipantPreanalysisPreviousContract(contract);
 selftestProgressEnd("F0.restore-historical-fixture",selftestProgressToken003);

 const checks=[];
 function good(name,run){run();checks.push({name,result:'PASS'});}
 function bad(name,code,run){assert.throws(run,error=>error.code===code);checks.push({name,result:'PASS',expectedDenial:code});}
 function badDecoder(name,code,run){bad(name,code,run);checks.at(-1).boundary=PURE_PROVENANCE_DECODER_BOUNDARY;}

 const selftestProgressToken004=selftestProgressStart("F0.workflow-baseline-equivalence");
 good('yaml-parsed-and-full-baseline-equivalent',()=>equivalent(workflow,contract));
 selftestProgressEnd("F0.workflow-baseline-equivalence",selftestProgressToken004);


 const selftestProgressToken005=selftestProgressStart("F0.plan-budget-conditional-region");
 if(contract[PLAN_BUDGET_CURRENT_SECTION])checks.push(...planBudgetCurrentGateSelftest(workflow,contract,root));
 selftestProgressEnd("F0.plan-budget-conditional-region",selftestProgressToken005);


 const selftestProgressToken006=selftestProgressStart("F0.document-association-conditional-region");
 if(contract.planMeasurementDocumentAssociationRevision){
  good('document-association-complete-a203-checkpoint-restored',()=>assert.equal(hash(JSON.stringify(restoreDocumentTaskAssociationPreviousContract(contract),null,2)+'\n'),DOCUMENT_TASK_ASSOCIATION_PREVIOUS_CONTRACT_SHA256));
  good('document-association-current-source-leaves-independent-from-native-proofs',()=>verifyDocumentTaskAssociationCurrentSources(contract,file=>Buffer.from(utf8(readFileSync(path.join(root,sourcePath(file)))).replaceAll('\r\n','\n'))));
  for(const [name,edit]of [['old-source-relabelled-current',c=>{c.planMeasurementDocumentAssociationRevision.reviewedSourceChanges[0].currentSha256=c.planMeasurementDocumentAssociationRevision.reviewedSourceChanges[0].previousSha256;}],['source-delta-omitted',c=>{c.planMeasurementDocumentAssociationRevision.reviewedSourceChanges.pop();}],['foreign-checkpoint',c=>{c.planMeasurementDocumentAssociationRevision.previousContractSha256='f'.repeat(64);}],['historical49-pin-tampered',c=>{c.planMeasurementCurrentLineage.currentValidationSources[0].sha256='f'.repeat(64);}]]){const changed=clone(contract);edit(changed);bad('document-association-'+name,'PROOF_BINDING_SOURCE',()=>validateContract(changed));}
 }
 selftestProgressEnd("F0.document-association-conditional-region",selftestProgressToken006);


 const selftestProgressToken007=selftestProgressStart("F0.workspace-continuity-conditional-region");
 if(contract.workspaceContinuityCurrentRevision){
  good('workspace-continuity-complete-d5d-checkpoint-restored',()=>assert.equal(hash(JSON.stringify(restoreWorkspaceContinuityPreviousContract(contract),null,2)+'\n'),WORKSPACE_CONTINUITY_PREVIOUS_CONTRACT_SHA256));
  good('workspace-continuity-current-source-independent-of-original-proofs',()=>verifyWorkspaceContinuityCurrentSources(contract,file=>Buffer.from(utf8(readFileSync(path.join(root,sourcePath(file)))).replaceAll('\r\n','\n'))));
  for(const[name,edit]of [['old-source-relabelled-current',c=>{c.workspaceContinuityCurrentRevision.reviewedSourceChanges[0].currentSha256=c.workspaceContinuityCurrentRevision.reviewedSourceChanges[0].previousSha256;}],['source-delta-omitted',c=>{c.workspaceContinuityCurrentRevision.reviewedSourceChanges.pop();}],['foreign-checkpoint',c=>{c.workspaceContinuityCurrentRevision.previousContractSha256='f'.repeat(64);}],['old-focused20-as-current',c=>{const prior=restoreWorkspaceContinuityPreviousContract(contract);c.extension.proofs.find(row=>row.id==='focused-workspace-ui').checkNames=prior.extension.proofs.find(row=>row.id==='focused-workspace-ui').checkNames;}],['evidence-producer-disagrees',c=>{c.evidenceProducers.find(row=>row.path==='.vercel/private/focused-workspace-ui-evidence/current-ci.json').producerSha256='f'.repeat(64);}]]){const changed=clone(contract);edit(changed);bad('workspace-continuity-'+name,'PROOF_BINDING_SOURCE',()=>validateContract(changed));}
 }
 selftestProgressEnd("F0.workspace-continuity-conditional-region",selftestProgressToken007);


 const selftestProgressToken008=selftestProgressStart("F0.whatsapp-field-conditional-region");
 if(contract.whatsappFieldContinuityCurrentRevision){
  good('whatsapp-field-complete052-checkpoint-restored',()=>assert.equal(hash(JSON.stringify(restoreWhatsappFieldContinuityPreviousContract(contract),null,2)+'\n'),WHATSAPP_FIELD_CONTINUITY_PREVIOUS_CONTRACT_SHA256));
  good('whatsapp-field-current-source-independent-of-local-observations',()=>verifyWhatsappFieldContinuityCurrentSources(contract,file=>Buffer.from(utf8(readFileSync(path.join(root,sourcePath(file)))).replaceAll('\r\n','\n'))));
  good('whatsapp-field-independent21st-proof-and59th-block-ID65',()=>{const proof=contract.extension.proofs.find(row=>row.kind===FIELD_TASK_PAGINATION_CI_KIND);assert.equal(proof.blockId,65);assert.equal(proof.checkNames.length,33);assert.equal(restorePlanBudgetPreviousContract(contract).blocks.length,59);assert.equal(restorePlanBudgetPreviousContract(contract).extension.proofs.length,21);assert.equal(restoreWhatsappFieldContinuityPreviousContract(contract).blocks.length,58);});
  for(const[name,edit]of [['old-source-as-current',c=>{c.whatsappFieldContinuityCurrentRevision.reviewedSourceChanges[0].currentSha256=c.whatsappFieldContinuityCurrentRevision.reviewedSourceChanges[0].previousSha256;}],['source-delta-omitted',c=>{c.whatsappFieldContinuityCurrentRevision.reviewedSourceChanges.pop();}],['foreign052-checkpoint',c=>{c.whatsappFieldContinuityCurrentRevision.previousContractSha256='f'.repeat(64);}],['missing-pagination-proof',c=>{c.extension.proofs=c.extension.proofs.filter(row=>row.kind!==FIELD_TASK_PAGINATION_CI_KIND);}],['old-focused45-as-current',c=>{c.extension.proofs.find(row=>row.id==='focused-workspace-ui').checkNames=restoreWhatsappFieldContinuityPreviousContract(contract).extension.proofs.find(row=>row.id==='focused-workspace-ui').checkNames;}],['pagination-record-mismatch',c=>{c.evidenceProducers.find(row=>row.blockId===65).producerSha256='f'.repeat(64);}]]){const value=clone(contract);edit(value);bad('whatsapp-field-'+name,'PROOF_BINDING_SOURCE',()=>validateContract(value));}
 }
 selftestProgressEnd("F0.whatsapp-field-conditional-region",selftestProgressToken008);


 const selftestProgressToken009=selftestProgressStart("F0.kycExpiredCurrentCompositionSelftest");
 checks.push(...kycExpiredCurrentCompositionSelftest(contract,root));
 selftestProgressEnd("F0.kycExpiredCurrentCompositionSelftest",selftestProgressToken009);

 const shadowSource=file=>Buffer.from(utf8(readFileSync(path.join(root,sourcePath(file)))).replaceAll('\r\n','\n'));

 const selftestProgressToken010=selftestProgressStart("F0.integratedIdentityCurrentSelftest");
 checks.push(...integratedIdentityCurrentSelftest(contract,shadowSource));
 selftestProgressEnd("F0.integratedIdentityCurrentSelftest",selftestProgressToken010);


 const selftestProgressToken011=selftestProgressStart("F1.expectedNeeds-input");
 const original=buildWorkflow(contract),expectedHead='a'.repeat(40),workflowSha256='b'.repeat(64),needs=expectedNeeds(contract,expectedHead,workflowSha256,shadowSource),input={needs,contract,expectedHead,workflowSha256,runId:'100',runAttempt:'1',readSource:shadowSource};
 selftestProgressEnd("F1.expectedNeeds-input",selftestProgressToken011);


 const selftestProgressToken012=selftestProgressStart("F1.public-gate-and-owned-decoder");
 bad('gate-source-resolver-required','PROOF_SOURCE_RESOLVER',()=>gate({...input,readSource:undefined}));
 let currentGateReport;
 good('gate-all-eight-lanes-and-50-blocks',()=>{assert.equal(contract.blocks.filter(block=>block.id<=56).length,50);assert.equal(restoreParticipantPreanalysisPreviousContract(contract).blocks.length,56);currentGateReport=gate(input);assert.equal(currentGateReport.commandBlocks,contract.blocks.length);});
 const decoder=ownedProvenanceDecoder(input,currentGateReport),decodeJsonCase=decoder.decode;decoder.variableFiles(checks,'provenance-decoder-main',needs,'bank-intake-units');decoder.coreChecks(checks,needs);
 good('gate-all-eight-lanes-and-additive-KYC-57',()=>{assert.equal(restoreParticipantPreanalysisPreviousContract(contract).blocks.length,56);assert.equal(gate(input).commandBlocks,contract.blocks.length);});
 selftestProgressEnd("F1.public-gate-and-owned-decoder",selftestProgressToken012);


 const selftestProgressToken013=selftestProgressStart("F1.lane-transport");
 const laneEnv=Object.fromEntries(LANES.map(lane=>[laneEnvironmentKey(lane),JSON.stringify(needs[lane])]));
 good('lane-environment-preserves-exact-eight-records',()=>equal(readLaneNeedsEnvironment({...laneEnv,PATH:'controlled'}),needs,'ENV_TRANSPORT_CHANGED'));
 good('lane-environment-still-runs-exact-gate',()=>{assert.equal(restoreParticipantPreanalysisPreviousContract(contract).blocks.length,56);assert.equal(gate({...input,needs:readLaneNeedsEnvironment(laneEnv)}).commandBlocks,contract.blocks.length);});
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
 selftestProgressEnd("F1.lane-transport",selftestProgressToken013);


 const selftestProgressToken014=selftestProgressStart("F1.provenance-and-workflow-negatives");
 for(const result of ['failure','cancelled','skipped']){const n=clone(needs);n.people.result=result;badDecoder('gate-'+result,'LANE_NOT_SUCCESS',()=>decodeJsonCase(n));}
 let n=clone(needs);delete n.meta;badDecoder('missing-lane','MISSING_OR_EXTRA_LANE',()=>decodeJsonCase(n));
 n=clone(needs);n.unexpected=n.meta;badDecoder('extra-lane','MISSING_OR_EXTRA_LANE',()=>decodeJsonCase(n));
 n=clone(needs);n.meta.outputs.artifactId='';badDecoder('missing-artifact','MISSING_ARTIFACT',()=>decodeJsonCase(n));
 n=clone(needs);delete n.meta.outputs.provenance;badDecoder('missing-output','MISSING_LANE_OUTPUT',()=>decodeJsonCase(n));
 n=clone(needs);n.meta.outputs.artifactDigest='';badDecoder('missing-artifact-digest','MISSING_ARTIFACT',()=>decodeJsonCase(n));
 n=clone(needs);n.meta.outputs.artifactId=n.contracts.outputs.artifactId;badDecoder('artifact-id-collision','ARTIFACT_COLLISION',()=>decodeJsonCase(n));
 function altered(name,code,edit){const n=clone(needs),r=JSON.parse(n.people.outputs.provenance);edit(r);delete r.manifestSha256;n.people.outputs.provenance=JSON.stringify(seal(r));badDecoder(name,code,()=>decodeJsonCase(n));}
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
 n=clone(needs);n.people.outputs.provenance='{}';badDecoder('empty-provenance','INVALID_PROVENANCE_SHAPE',()=>decodeJsonCase(n));
 n=clone(needs);let r=JSON.parse(n.people.outputs.provenance);r.files[0].bytes++;n.people.outputs.provenance=JSON.stringify(r);badDecoder('unsealed-provenance-change','PROVENANCE_DIGEST',()=>decodeJsonCase(n));
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
 selftestProgressEnd("F1.provenance-and-workflow-negatives",selftestProgressToken014);


 const selftestProgressToken015=selftestProgressStart("F1.artifact-and-retention-controls");
 checks.push(...gitSourceReaderSelftest());
 // Keep one fresh public gate call for this group. Artifact permutations below
 // exercise the same pure decoder already owned by the authenticated F1 report;
 // they do not cache, replace or claim current-source authentication.
 good('all-historical-optional-PNGs-absent-with-required-weekly-captures-present',()=>assert.equal(gate(input).state,'PASS'));
 if(contract.weeklyCypCurrentRevision)for(const screenshot of WEEKLY_CYP_CURRENT_REVISION.browser.retainedScreenshots){const n=clone(needs),r=JSON.parse(n.plans.outputs.provenance);r.files=r.files.filter(file=>file.path!==screenshot.path);delete r.manifestSha256;n.plans.outputs.provenance=JSON.stringify(seal(r));badDecoder('weekly-retained-capture-omitted-'+screenshot.width,'PROOF_WEEKLY_CYP_UI_SCREENSHOT_BINDING',()=>decodeJsonCase(n));}
 for(const lane of LANES)for(const pattern of contract.lanes[lane].optionalArtifactPatterns.filter(pattern=>!PORTFOLIO_ARTIFACTS.includes(pattern))){
  const n=clone(needs),r=JSON.parse(n[lane].outputs.provenance);
  r.files.push({path:pattern.replaceAll('*','fixture'),sha256:'4'.repeat(64),bytes:128});
  delete r.manifestSha256;n[lane].outputs.provenance=JSON.stringify(seal(r));
  good('optional-PNG-present-'+lane,()=>assert.equal(decodeJsonCase(n).state,'PASS'));checks.at(-1).boundary=PURE_PROVENANCE_DECODER_BOUNDARY;
 }
 for(const lane of LANES)for(const filename of contract.lanes[lane].requiredRetainedEvidence.filter(filename=>!isPortfolioEvidence(filename))){
  const n=clone(needs),r=JSON.parse(n[lane].outputs.provenance);
  r.files=r.files.filter(file=>file.path!==filename);
  if(!r.files.length){const owned=contract.lanes[lane].artifacts.find(pattern=>pattern.endsWith('/'));if(owned)r.files.push({path:owned+'diagnostic.json',sha256:'4'.repeat(64),bytes:128});}
  delete r.manifestSha256;n[lane].outputs.provenance=JSON.stringify(seal(r));
   const historicalEmpty=lane==='contracts'&&filename==='.vercel/private/biometric-real-model-proof.json';
   badDecoder((historicalEmpty?'missing-main-proof-with-other-artifact-':'missing-main-proof-')+lane+'-'+filename,r.files.length?'MISSING_REQUIRED_RETAINED_EVIDENCE':'EMPTY_EVIDENCE',()=>decodeJsonCase(n));
   if(historicalEmpty){const prior=clone(needs),empty=JSON.parse(prior[lane].outputs.provenance);empty.files=[];delete empty.manifestSha256;prior[lane].outputs.provenance=JSON.stringify(seal(empty));badDecoder('missing-main-proof-'+lane+'-'+filename,'EMPTY_EVIDENCE',()=>decodeJsonCase(prior));}
 }
 for(const lane of LANES)for(const filename of contract.lanes[lane].requiredProducedEvidence){
  const n=clone(needs),r=JSON.parse(n[lane].outputs.provenance);
  r.producedNotUploaded=r.producedNotUploaded.filter(file=>file.path!==filename);
  delete r.manifestSha256;n[lane].outputs.provenance=JSON.stringify(seal(r));
  badDecoder('missing-produced-not-uploaded-'+filename,'MISSING_REQUIRED_PRODUCED_EVIDENCE',()=>decodeJsonCase(n));
 }
 altered('required-retained-list-omitted','RETAINED_EVIDENCE_CONTRACT',r=>{r.requiredRetainedEvidence.pop();});
 altered('required-produced-list-omitted','PRODUCED_EVIDENCE_CONTRACT',r=>{r.requiredProducedEvidence.pop();});
 altered('wrong-helper-digest','PROVENANCE_IDENTITY',r=>{r.verifierSha256='c'.repeat(64);});
 altered('wrong-package-lock-digest','PROVENANCE_IDENTITY',r=>{r.packageLockSha256='c'.repeat(64);});
 altered('wrong-python-requirements-digest','PROVENANCE_IDENTITY',r=>{r.requirementsSha256='c'.repeat(64);});
 altered('produced-file-foreign','PRODUCED_EVIDENCE_NOT_OWNED',r=>{r.producedNotUploaded[0].path='.vercel/foreign-produced.json';});
 selftestProgressEnd("F1.artifact-and-retention-controls",selftestProgressToken015);


 const selftestProgressToken016=selftestProgressStart("F1.source-identity-and-overtime");
 for(const file of ['scripts/verify-participants-ui.mjs','src/lib/field-operations-store.mjs','AGENTS.md']){
  bad('dirty-tracked-source-'+file,'TRACKED_SOURCE_DIRTY',()=>assertSourceIdentity({expectedHead,actualHead:expectedHead,dirtyTrackedPaths:[file]}));
 }
 bad('dirty-staged-source','TRACKED_SOURCE_DIRTY',()=>assertSourceIdentity({expectedHead,actualHead:expectedHead,dirtyTrackedPaths:['src/lib/verified-session.mjs']}));
 bad('source-HEAD-mismatch-before-provenance','SOURCE_HEAD_MISMATCH',()=>assertSourceIdentity({expectedHead,actualHead:'c'.repeat(40),dirtyTrackedPaths:[]}));
 good('clean-source-identity',()=>assert.equal(assertSourceIdentity({expectedHead,actualHead:expectedHead,dirtyTrackedPaths:[]}),expectedHead));
 const wrongLane=clone(historicalContractForNegativeFixtures),wa='.vercel/customer-whatsapp-evidence/';
 wrongLane.lanes.meta.artifacts=wrongLane.lanes.meta.artifacts.filter(pattern=>pattern!==wa);
 wrongLane.lanes['workspace-ui'].artifacts.push(wa);
 bad('wrong-upload-lane-for-canonical-producer','RETAINED_EVIDENCE_NOT_OWNED',()=>validateContract(wrongLane));
 const wrongProducer=clone(historicalContractForNegativeFixtures);wrongProducer.evidenceProducers[0].producer='scripts/verify-workspace-ui.mjs';
 bad('wrong-principal-proof-producer','EVIDENCE_PRODUCER_COVERAGE',()=>validateContract(wrongProducer));
 const overtimeProducers=contract.evidenceProducers.filter(producer=>producer.blockId===52);
 good('overtime-block-52-three-canonical-proofs',()=>{
  equal(overtimeProducers.map(producer=>({path:producer.path,lane:producer.lane,retained:producer.retained})),[
   {path:'.vercel/private/field-overtime-unit-proof.json',lane:'field',retained:true},
   {path:'.vercel/private/field-overtime-postgres-proof.json',lane:'field',retained:true},
   {path:'.vercel/private/field-overtime-ui-proof.json',lane:'field',retained:true}
  ],'OVERTIME_PRODUCER_CONTRACT');
  const overtimeHistoricalContract=contract.whatsappFieldContinuityCurrentRevision?restoreWhatsappFieldContinuityPreviousContract(contract):contract;
  equal(overtimeHistoricalContract.lanes.field.blocks,[20,39,40,52],'OVERTIME_BLOCK_ASSIGNMENT');
  equal(contract.lanes.field.blocks,contract.whatsappFieldContinuityCurrentRevision?[20,39,40,52,65]:[20,39,40,52],'OVERTIME_BLOCK_ASSIGNMENT');
 });
 for(const [name,code,edit] of [
  ['omitted','CONTRACT_BLOCKS',c=>{c.blocks=c.blocks.filter(block=>block.id!==52);}],
  ['duplicate','CONTRACT_BLOCKS',c=>{c.blocks.push(clone(c.blocks.find(block=>block.id===52)));}],
  ['duplicate-assignment','CONTRACT_COVERAGE',c=>{c.lanes.field.blocks.push(52);}],
  ['foreign-lane','EVIDENCE_PRODUCER_COVERAGE',c=>{c.lanes.field.blocks=c.lanes.field.blocks.filter(id=>id!==52);c.lanes.meta.blocks.push(52);}],
  ['changed-command','CONTRACT_COMMAND',c=>{c.blocks.find(block=>block.id===52).step.run+='\ntrue';}]
 ]){const c=clone(historicalContractForNegativeFixtures);edit(c);bad('overtime-52-'+name,code,()=>validateContract(c));}
 function alteredField(name,code,edit){const n=clone(needs),r=JSON.parse(n.field.outputs.provenance);edit(r);delete r.manifestSha256;n.field.outputs.provenance=JSON.stringify(seal(r));badDecoder(name,code,()=>decodeJsonCase(n));}
 alteredField('overtime-52-omitted-from-provenance','BLOCK_COVERAGE',r=>{r.blockIds=r.blockIds.filter(id=>id!==52);});
 alteredField('overtime-52-duplicate-in-provenance','BLOCK_COVERAGE',r=>{r.blockIds.push(52);});
 alteredField('overtime-52-command-digest-changed','COMMAND_DIGEST',r=>{r.commandDigests[r.blockIds.indexOf(52)]='3'.repeat(64);});
 for(const producer of overtimeProducers){
  const omitted=clone(historicalContractForNegativeFixtures);omitted.evidenceProducers=omitted.evidenceProducers.filter(item=>item.path!==producer.path);
  bad('overtime-producer-omitted-'+producer.path,'EVIDENCE_PRODUCER_COVERAGE',()=>validateContract(omitted));
  const notRetained=clone(historicalContractForNegativeFixtures);notRetained.evidenceProducers.find(item=>item.path===producer.path).retained=false;
  bad('overtime-producer-not-retained-'+producer.path,'RETAINED_PRODUCER_COVERAGE',()=>validateContract(notRetained));
  const foreign=clone(historicalContractForNegativeFixtures);foreign.evidenceProducers.find(item=>item.path===producer.path).lane='meta';
  bad('overtime-producer-foreign-lane-'+producer.path,'EVIDENCE_PRODUCER_COVERAGE',()=>validateContract(foreign));
  const colliding=clone(historicalContractForNegativeFixtures);colliding.evidenceProducers.find(item=>item.path===producer.path).path=contract.evidenceProducers[0].path;
  bad('overtime-producer-path-collision-'+producer.path,'DUPLICATE_REQUIRED_EVIDENCE',()=>validateContract(colliding));
 }
 selftestProgressEnd("F1.source-identity-and-overtime",selftestProgressToken016);


 const selftestProgressToken017=selftestProgressStart("F1.dependency-fixtures");
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
 selftestProgressEnd("F1.dependency-fixtures",selftestProgressToken017);


 const selftestProgressToken018=selftestProgressStart("F1.filesystem-and-proof-binding-controls");
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
  const decoderSpecs=contract.extension.proofs.filter(spec=>![PARTICIPANT_PREANALYSIS_KIND,FOCUSED_WORKSPACE_CI_KIND,FIELD_TASK_PAGINATION_CI_KIND,PLAN_BUDGET_CI_KIND].includes(spec.kind)&&!isPortfolio(spec)&&!isIdentity(spec)&&!isCanonicalField(spec));equal(decoderSpecs.map(spec=>spec.id),['bank-intake-units','bank-postgres','intake-postgres','bank-ui','intake-ui','joint-ui','joint-causal','company-kyc-postgres','project-preparation-postgres','project-preparation-ui','plan-baseline-postgres','document-curve-ui'],'DECODER_EXTENSION_CATALOG');
  for(const spec of decoderSpecs){
   for(const [name,code,edit] of [
    ['binding-omitted','PROOF_BINDINGS',r=>{r.proofBindings=r.proofBindings.filter(b=>b.id!==spec.id);}],
    ['binding-head','PROOF_BINDING_IDENTITY',r=>{r.proofBindings.find(b=>b.id===spec.id).sourceRevision='f'.repeat(40);}],
    ['binding-proof-digest','PROOF_BINDING_IDENTITY',r=>{r.proofBindings.find(b=>b.id===spec.id).proofSha256='f'.repeat(64);}],
    ['binding-source-manifest','PROOF_BINDING_SOURCE',r=>{r.proofBindings.find(b=>b.id===spec.id).sourceManifestSha256='invalid';}],
    ['binding-source-manifest-valid64-wrong','PROOF_BINDING_SOURCE',r=>{r.proofBindings.find(b=>b.id===spec.id).sourceManifestSha256='f'.repeat(64);}],
    ['binding-harness','PROOF_BINDING_IDENTITY',r=>{r.proofBindings.find(b=>b.id===spec.id).harnessSha256='f'.repeat(64);}],
    ['binding-checks','PROOF_BINDING_IDENTITY',r=>{r.proofBindings.find(b=>b.id===spec.id).checks=0;}]
   ]){if(spec.kind==='UI_CAUSAL'&&name==='binding-checks')continue;const n=clone(needs),r=JSON.parse(n[spec.lane].outputs.provenance);edit(r);delete r.manifestSha256;n[spec.lane].outputs.provenance=JSON.stringify(seal(r));badDecoder(spec.id+'-'+name,code,()=>decodeJsonCase(n));}
   bad(spec.id+'-current-source-bytes-tampered','PROOF_BINDING_SOURCE',()=>gate({...input,readSource:file=>file===spec.sourceFiles[0]?Buffer.concat([shadowSource(file),Buffer.from('altered shadow source')]):shadowSource(file)}));
   // Keep this binding control independent from the causal fixture-presence
   // guard when its additive script source sorts before the application graph.
   const sourceIndex=spec.sourceFiles.findIndex(file=>!proofFixtureDependenciesFor(spec.kind).includes(file)&&!planBaselineDependenciesFor(spec.kind).includes(file)&&(spec.kind!=='PG_PLAN_BASELINE'||![...PLAN_BASELINE_SOURCE_ROOTS,...PLAN_BASELINE_BACKEND_SOURCES,'package.json','package-lock.json'].includes(file))&&(spec.kind!=='UI_DOCUMENT_CURVE'||![...DOCUMENT_CURVE_UI_RENDER_ROOTS,DOCUMENT_CURVE_UI_FIXTURE_ROOT,DOCUMENT_CURVE_SOURCE,'scripts/lib/owned-fixture-cleanup.mjs','package.json','package-lock.json'].includes(file)));assert.ok(sourceIndex>=0);
   const changedPath=clone(contract);changedPath.extension.proofs.find(p=>p.id===spec.id).sourceFiles[sourceIndex]=spec.kind==='PG_PLAN_BASELINE'?'src/lib/geo.js':spec.producer;bad(spec.id+'-current-source-path-tampered','PROOF_BINDING_SOURCE',()=>gate({...input,contract:changedPath}));
  }
  for(const id of [53,54,55,56,57,61,62])for(const [name,code,edit] of [
   ['omitted','CONTRACT_BLOCKS',c=>{c.blocks=c.blocks.filter(b=>b.id!==id);}],
   ['duplicate','CONTRACT_BLOCKS',c=>{c.blocks.push(clone(c.blocks.find(b=>b.id===id)));}],
   ['command-changed','CONTRACT_COMMAND',c=>{c.blocks.find(b=>b.id===id).step.run+='\ntrue';}]
  ]){const c=clone(historicalContractForNegativeFixtures);edit(c);bad('extension-block-'+id+'-'+name,code,()=>validateContract(c));}
  const changedBaseline=clone(historicalContractForNegativeFixtures);changedBaseline.blocks[0].step.run+='\ntrue';changedBaseline.blocks[0].commandSha256=hash(changedBaseline.blocks[0].step.run);bad('old-block-changed-with-recomputed-digest','BASELINE_BLOCKS_CHANGED',()=>validateContract(changedBaseline));
  const freshFixture=mkdtempSync(path.join(parent,'ci-bank-intake-selftest-fixture-'));
  try{for(const spec of contract.extension.proofs.filter(spec=>![PARTICIPANT_PREANALYSIS_KIND,FOCUSED_WORKSPACE_CI_KIND,FIELD_TASK_PAGINATION_CI_KIND,PLAN_BUDGET_CI_KIND].includes(spec.kind)&&!isPortfolio(spec)&&!isIdentity(spec)&&!isCanonicalField(spec))){const filename=path.join(freshFixture,spec.path);mkdirSync(path.dirname(filename),{recursive:true});writeFileSync(filename,'shadow stale evidence\n');bad(spec.id+'-stale-main-before-execution','STALE_EVIDENCE',()=>assertFreshEvidence({root:freshFixture,lane:spec.lane,contract}));rmSync(filename);}}
  finally{const resolved=path.resolve(freshFixture);assert.ok(path.dirname(resolved)===path.resolve(parent)&&path.basename(resolved).startsWith('ci-bank-intake-selftest-fixture-'));rmSync(resolved,{recursive:true,force:true});}
 selftestProgressEnd("F1.filesystem-and-proof-binding-controls",selftestProgressToken018);

 const currentCompanyChecks=[],currentContinuityChecks=[],currentReactiveChecks=[],currentTemplateChecks=[],currentMonthlyChecks=[],currentKycStatusChecks=[],currentCalendarChecks=[],currentWhatsappPlanChecks=[];
 const selftestProgressToken019=selftestProgressStart("F2.extensionSelftest");
 checks.push(...extensionSelftest(contract,root,currentCompanyChecks,currentContinuityChecks,currentReactiveChecks,currentTemplateChecks,currentMonthlyChecks,currentKycStatusChecks,currentWhatsappPlanChecks));
 selftestProgressEnd("F2.extensionSelftest",selftestProgressToken019);

 const selftestProgressToken020=selftestProgressStart("F2.portfolioSelftest");
 checks.push(...portfolioSelftest(workflow,contract,root));
 selftestProgressEnd("F2.portfolioSelftest",selftestProgressToken020);

 const selftestProgressToken021=selftestProgressStart("F2.currentCompanyChecks-drain");
 for(const run of currentCompanyChecks)checks.push(...run());
 selftestProgressEnd("F2.currentCompanyChecks-drain",selftestProgressToken021);

 const selftestProgressToken022=selftestProgressStart("F2.identitySelftest");
 checks.push(...identitySelftest(workflow,contract,root,currentContinuityChecks,currentTemplateChecks,currentMonthlyChecks,currentKycStatusChecks,currentCalendarChecks));
 selftestProgressEnd("F2.identitySelftest",selftestProgressToken022);

 const selftestProgressToken023=selftestProgressStart("F2.canonicalFieldSelftest");
 checks.push(...canonicalFieldSelftest(workflow,contract,root,currentReactiveChecks,currentKycStatusChecks,currentWhatsappPlanChecks));
 selftestProgressEnd("F2.canonicalFieldSelftest",selftestProgressToken023);

 const selftestProgressToken024=selftestProgressStart("F2.currentContinuityChecks-drain");
 for(const run of currentContinuityChecks)checks.push(...run());
 selftestProgressEnd("F2.currentContinuityChecks-drain",selftestProgressToken024);

 const selftestProgressToken025=selftestProgressStart("F2.currentReactiveChecks-drain");
 for(const run of currentReactiveChecks)checks.push(...run());
 selftestProgressEnd("F2.currentReactiveChecks-drain",selftestProgressToken025);

 const selftestProgressToken026=selftestProgressStart("F2.currentTemplateChecks-drain");
 for(const run of currentTemplateChecks)checks.push(...run());
 selftestProgressEnd("F2.currentTemplateChecks-drain",selftestProgressToken026);


 const selftestProgressToken027=selftestProgressStart("F2.postgres-service-image-negatives");
 for(const [name,image] of [
   ['foreign-registry',POSTGRES_SERVICE_IMAGE.replace('docker.io','foreign.invalid')],
   ['changed-digest',POSTGRES_SERVICE_IMAGE.replace(/sha256:[a-f0-9]{64}$/,'sha256:'+'0'.repeat(64))],
   ['mutable-latest','docker.io/library/postgres:latest']
  ]){const changed=clone(historicalContractForNegativeFixtures);changed.workflow.services.postgres.image=image;bad('postgres-service-'+name+'-denied','POSTGRES_SERVICE_IMAGE',()=>validateContract(changed));}
 selftestProgressEnd("F2.postgres-service-image-negatives",selftestProgressToken027);


 const selftestProgressToken028=selftestProgressStart("F2.currentMonthlyChecks-drain");
 for(const run of currentMonthlyChecks)checks.push(...run());
 selftestProgressEnd("F2.currentMonthlyChecks-drain",selftestProgressToken028);


 const selftestProgressToken029=selftestProgressStart("F2.monthlyCurveContractSelftest");
 checks.push(...monthlyCurveContractSelftest(workflow,contract,root));
 selftestProgressEnd("F2.monthlyCurveContractSelftest",selftestProgressToken029);


 const selftestProgressToken030=selftestProgressStart("F2.currentKycStatusChecks-drain");
 for(const run of currentKycStatusChecks)checks.push(...run());
 selftestProgressEnd("F2.currentKycStatusChecks-drain",selftestProgressToken030);


 const selftestProgressToken031=selftestProgressStart("F2.calendarPreparationContractSelftest");
 checks.push(...calendarPreparationContractSelftest(workflow,contract,root));
 selftestProgressEnd("F2.calendarPreparationContractSelftest",selftestProgressToken031);


 const selftestProgressToken032=selftestProgressStart("F2.currentCalendarChecks-drain");
 for(const run of currentCalendarChecks)checks.push(...run());
 selftestProgressEnd("F2.currentCalendarChecks-drain",selftestProgressToken032);


 const selftestProgressToken033=selftestProgressStart("F2.whatsappPlanImportContractSelftest");
 checks.push(...whatsappPlanImportContractSelftest(workflow,contract,root));
 selftestProgressEnd("F2.whatsappPlanImportContractSelftest",selftestProgressToken033);


 const selftestProgressToken034=selftestProgressStart("F2.currentWhatsappPlanChecks-drain");
 for(const run of currentWhatsappPlanChecks)checks.push(...run());
 selftestProgressEnd("F2.currentWhatsappPlanChecks-drain",selftestProgressToken034);


 const selftestProgressToken035=selftestProgressStart("F3.companySubscriptionContractSelftest");
 checks.push(...companySubscriptionContractSelftest(contract));
 selftestProgressEnd("F3.companySubscriptionContractSelftest",selftestProgressToken035);


 const selftestProgressToken036=selftestProgressStart("F3.taskMeasurementContractSelftest");
 checks.push(...taskMeasurementContractSelftest(contract));
 selftestProgressEnd("F3.taskMeasurementContractSelftest",selftestProgressToken036);


 const selftestProgressToken037=selftestProgressStart("F3.organizationUsageContractSelftest");
 checks.push(...organizationUsageContractSelftest(contract));
 selftestProgressEnd("F3.organizationUsageContractSelftest",selftestProgressToken037);


 const selftestProgressToken038=selftestProgressStart("F3.companyKycCurrentSourceContractSelftest");
 checks.push(...companyKycCurrentSourceContractSelftest(contract));
 selftestProgressEnd("F3.companyKycCurrentSourceContractSelftest",selftestProgressToken038);

 const selftestProgressToken039=selftestProgressStart("F3.planBaselineSelftest");
 checks.push(...planBaselineSelftest(workflow,contract,root));
 selftestProgressEnd("F3.planBaselineSelftest",selftestProgressToken039);

 const selftestProgressToken040=selftestProgressStart("F3.documentCurveUiSelftest");
 checks.push(...documentCurveUiSelftest(workflow,contract,root));
 selftestProgressEnd("F3.documentCurveUiSelftest",selftestProgressToken040);

 const selftestProgressToken041=selftestProgressStart("F3.documentCurveCurrentSourceLineageSelftest");
 checks.push(...documentCurveCurrentSourceLineageSelftest(contract,root));
 selftestProgressEnd("F3.documentCurveCurrentSourceLineageSelftest",selftestProgressToken041);

 const selftestProgressToken042=selftestProgressStart("F3.provenanceDecoderPublicIntegrationSelftest");
 checks.push(...provenanceDecoderPublicIntegrationSelftest(workflow,contract,root));
 selftestProgressEnd("F3.provenanceDecoderPublicIntegrationSelftest",selftestProgressToken042);

  return checks;
}
function canonicalFieldSelftest(workflow,contract,root,currentReactiveChecks=[],currentKycStatusChecks=[],currentWhatsappPlanChecks=[]){
 const checks=[],expectedHead=contract.extension.baseHead,cache=new Map();
 const readSource=file=>{if(!cache.has(file))cache.set(file,Buffer.from(utf8(readFileSync(path.join(root,sourcePath(file)))).replaceAll('\r\n','\n')));return cache.get(file);};
 const good=(name,run)=>{run();checks.push({name,result:'PASS',boundary:'pure canonical field shadow fixture; no Git/PG/UI/provider execution'});};
 const bad=(name,code,run)=>{assert.throws(run,error=>error.code===code);checks.push({name,result:'PASS',expectedDenial:code,boundary:'pure canonical field shadow fixture'});};
 const aggregateReadSource=file=>Buffer.from(utf8(readFileSync(path.join(root,sourcePath(file)))).replaceAll('\r\n','\n'));
 const workflowSha256=hash(canonical(workflow)),needs=expectedNeeds(contract,expectedHead,workflowSha256,aggregateReadSource),input={needs,contract,expectedHead,workflowSha256,runId:'100',runAttempt:'1',readSource:aggregateReadSource};
 const decoderSpecs=contract.extension.proofs.filter(isCanonicalField);equal(decoderSpecs.map(spec=>spec.id),['field-canonical-postgres','overtime-canonical-postgres'],'DECODER_FIELD_CATALOG');
 let currentGateReport;good('canonical-field-public-gate-current-eight-lanes',()=>{currentGateReport=gate(input);assert.equal(currentGateReport.state,'PASS');});checks.at(-1).boundary='public current gate integration; no native or human acceptance';
 const decoder=ownedProvenanceDecoder(input,currentGateReport),decodeJsonCase=decoder.decode;decoder.variableFiles(checks,'provenance-decoder-canonical-field',needs,'field-canonical-postgres');
 const badDecoder=(name,code,run)=>{bad(name,code,run);checks.at(-1).boundary=PURE_PROVENANCE_DECODER_BOUNDARY;};
 for(const spec of decoderSpecs){
  for(const [name,code,edit] of [
   ['binding-omitted','PROOF_BINDINGS',r=>{r.proofBindings=r.proofBindings.filter(b=>b.id!==spec.id);}],
   ['binding-source','PROOF_BINDING_SOURCE',r=>{r.proofBindings.find(b=>b.id===spec.id).sourceManifestSha256='f'.repeat(64);}],
   ['binding-harness','PROOF_BINDING_IDENTITY',r=>{r.proofBindings.find(b=>b.id===spec.id).harnessSha256='f'.repeat(64);}],
   ['binding-checks','PROOF_BINDING_IDENTITY',r=>{r.proofBindings.find(b=>b.id===spec.id).checks=0;}],
   ['evidence-omitted','MISSING_REQUIRED_RETAINED_EVIDENCE',r=>{r.files=r.files.filter(f=>f.path!==spec.path);}]
  ]){const value=clone(needs),record=JSON.parse(value[spec.lane].outputs.provenance);edit(record);delete record.manifestSha256;value[spec.lane].outputs.provenance=JSON.stringify(seal(record));badDecoder(spec.id+'-'+name,code,()=>decodeJsonCase(value));}
 }

 function runCaptureFieldFixtureBody(spec,contract,readSource,fixturePorts){
const {validateExtensionProof,currentProducerSourceFiles,currentKycStatusClosureSelftest,whatsappPlanImportClosureSelftest}=fixturePorts;

  const sets=canonicalFieldSourceSets(spec,readSource),map=files=>Object.fromEntries(files.map(file=>[file,hash(readSource(file))]));
  const fixture={records:[{projectId:'p-shadow',workerId:'w-shadow',submissionId:'kyc-shadow',submissionReceiptId:'participant_'+'1'.repeat(64),reviewReceiptId:'participant_'+'2'.repeat(64),actorId:'worker',reviewerActorId:'reviewer',contentHash:'3'.repeat(64),canonicalAdmissionConfirmed:true,identityCertified:false,providerCalls:0}],syntheticPrivateCalls:{privatePuts:2,privateReads:6},providerCalls:0,biometricIdentityCertified:false};
  const proof={status:'PASS',harnessSha256:spec.producerSha256,providerCalls:0,participantKycFixture:fixture};
  if(spec.kind==='PG_FIELD'){
   for(const [key,files] of Object.entries(sets)){if(key==='fixture')fixture.sourceSha256=map(files);else proof[key]=map(files);}
   for(const [group,countKey,count] of FIELD_CHECK_GROUPS){proof[group]=spec.checkNames.map(row=>JSON.parse(row)).filter(row=>row.group===group).map(row=>row.name);proof[countKey]=count;}
   Object.assign(proof,{environment:'disposable-local-postgresql17',databaseEngineVersion:'17.6',databaseRemoved:true,totalChecks:spec.checkNames.length,productionDataWritten:false,reviewPaginationProviderCalls:0,voiceProgressProviderCalls:0,mediaLeaseProviderCalls:0,videoAudioProviderCalls:0,physicalAttendanceAccepted:false,whatsAppTested:false,videoAudioFfmpegExecuted:false});
  }else Object.assign(proof,{environment:'disposable-random-schema-on-approved-local-postgres',schema:'obrasaas_overtime_'+'a'.repeat(32),disposableSchemaRemoved:true,realBusinessDatabaseUsed:false,newOvertimeEnum:false,paymentEngineUsed:false,humanAccepted:false,sqlFailures:[],checks:[...spec.checkNames],sourceManifest:sets.sourceManifest.map(file=>({file,sha256:hash(readSource(file))}))});
  const privacyRevision=fieldPrivacySpecRevision(spec,readSource);if(privacyRevision){
   const privacyFixture=clone(fixture);delete privacyFixture.sourceSha256;
   proof.ownHistoryPrivacy={version:1,currentAccountKycCanonical:true,originalAuthorRestored:true,reviewerRoles:['ADMIN','DIRECTOR','SITE_MANAGER'],readBusinessWrites:0,participantKycFixture:privacyFixture};
   if(spec.kind==='PG_FIELD')Object.assign(proof.ownHistoryPrivacy,{checks:privacyRevision.addedChecks.map(value=>JSON.parse(value).name),deniedBeforePrivateRead:true,postReadAuthorityRaces:['REASSIGNED','REVOKED'],providerCalls:0});
   else Object.assign(proof.ownHistoryPrivacy,{sameWorkerReassigned:true,newAuthorOwnShiftWithForeignPredecessorReadable:true});
  }
  if(attendanceReviewCurrentCheckCount(spec)!==null)Object.assign(proof,{attendanceReviewChecks:[...ATTENDANCE_REVIEW_CHECK_NAMES],attendanceReviewCheckCount:ATTENDANCE_REVIEW_CHECK_NAMES.length,totalChecks:attendanceReviewCurrentCheckCount(spec)});
  const validate=value=>validateExtensionProof(spec,Buffer.from(JSON.stringify(value)),{expectedHead,readSource}),mutate=(name,code,edit)=>{const value=clone(proof);edit(value);bad(spec.id+'-'+name,code,()=>validate(value));};
  currentKycStatusChecks.push(()=>currentKycStatusClosureSelftest(spec,proof,root,validate));
   currentWhatsappPlanChecks.push(()=>whatsappPlanImportClosureSelftest(spec,proof,root,validate));
  good(spec.id+'-complete-current-proof',()=>assert.equal(validate(proof).checks,attendanceReviewCurrentCheckCount(spec)??privacyRevision?.currentCheckCount??(spec.kind==='PG_FIELD'?66:29)));
  good(spec.id+'-current-manifest-closure-exact',()=>fixturePorts.verifyCurrentCollector());
  currentReactiveChecks.push(()=>{
   const start=checks.length,previous=REACTIVE_SOURCE_COUNTS[spec.kind]-1;
   good(spec.id+'-reactive-source-name-count-and-closure-exact',()=>{assert.ok(spec.sourceFiles.includes(REACTIVE_IDENTITY_SOURCE));assert.equal(spec.sourceFiles.length,REACTIVE_SOURCE_COUNTS[spec.kind]+ownCompanyDependenciesFor(spec.kind).length+taskMeasurementDependenciesFor(spec.kind).length+reviewerDependenciesFor(spec.kind).length+intakeAssignmentDependenciesFor(spec.kind).length+currentPlanDependenciesFor(spec.kind).length+participantPreanalysisProofSourceAdditions(spec).length+officeAccountDependenciesFor(spec.kind).length+currentKycStatusDependenciesFor(spec.kind).length);equal(currentProducerSourceFiles(spec,root),spec.sourceFiles.toSorted(),'PROOF_SOURCE_MANIFEST');});
   const remove=p=>{const removed=[REACTIVE_IDENTITY_SOURCE,...ownCompanyDependenciesFor(spec.kind),...taskMeasurementDependenciesFor(spec.kind),...reviewerDependenciesFor(spec.kind),...intakeAssignmentDependenciesFor(spec.kind),...currentPlanDependenciesFor(spec.kind),...participantPreanalysisProofSourceAdditions(spec),...officeAccountDependenciesFor(spec.kind),...currentKycStatusDependenciesFor(spec.kind)];if(spec.kind==='PG_FIELD'){for(const key of Object.keys(sets)){const map=key==='fixture'?p.participantKycFixture.sourceSha256:p[key];for(const file of removed)delete map[file];}}else p.sourceManifest=p.sourceManifest.filter(ref=>!removed.includes(ref.file));};
   mutate('historical-'+previous+'-source-manifest-without-reactive','PROOF_SOURCE_MANIFEST',p=>{remove(p);assert.equal(canonicalFieldManifest(spec,p).length,previous);});
   mutate('same-count-foreign-reactive-source','PROOF_SOURCE_MANIFEST',p=>{if(spec.kind==='PG_FIELD'){for(const key of Object.keys(sets)){const map=key==='fixture'?p.participantKycFixture.sourceSha256:p[key];if(Object.hasOwn(map,REACTIVE_IDENTITY_SOURCE)){map['src/lib/foreign-reactive.mjs']=map[REACTIVE_IDENTITY_SOURCE];delete map[REACTIVE_IDENTITY_SOURCE];}}}else p.sourceManifest.find(ref=>ref.file===REACTIVE_IDENTITY_SOURCE).file='src/lib/foreign-reactive.mjs';assert.equal(canonicalFieldManifest(spec,p).length,REACTIVE_SOURCE_COUNTS[spec.kind]+ownCompanyDependenciesFor(spec.kind).length+taskMeasurementDependenciesFor(spec.kind).length+reviewerDependenciesFor(spec.kind).length+intakeAssignmentDependenciesFor(spec.kind).length+currentPlanDependenciesFor(spec.kind).length+participantPreanalysisProofSourceAdditions(spec).length+officeAccountDependenciesFor(spec.kind).length+currentKycStatusDependenciesFor(spec.kind).length);});
   return checks.splice(start);
  });
  bad(spec.id+'-invalid-json','PROOF_JSON',()=>validateExtensionProof(spec,Buffer.from('{'),{expectedHead,readSource}));
  mutate('wrong-status','PROOF_STATUS',p=>{p.status='FAIL';});mutate('wrong-producer','PROOF_HARNESS_SOURCE',p=>{p.harnessSha256='f'.repeat(64);});
  mutate('wrong-head','PROOF_SOURCE_HEAD',p=>{p.sourceRevision='f'.repeat(40);});mutate('real-database','PROOF_PRODUCTION_BOUNDARY',p=>{if(spec.kind==='PG_FIELD')p.productionDataWritten=true;else p.realBusinessDatabaseUsed=true;});
  mutate('provider-call','PROOF_PROVIDER_IO',p=>{p.providerCalls=1;});mutate('fixture-provider-call','PROOF_PROVIDER_IO',p=>{p.participantKycFixture.providerCalls=1;});mutate('claims-biometric-certification','PROOF_PROVIDER_IO',p=>{p.participantKycFixture.biometricIdentityCertified=true;});
  mutate('fixture-no-records','PROOF_FIELD_KYC_FIXTURE',p=>{p.participantKycFixture.records=[];});mutate('fixture-private-calls-forged','PROOF_FIELD_KYC_FIXTURE',p=>{p.participantKycFixture.syntheticPrivateCalls.privateReads++;});
  if(privacyRevision){
   mutate('own-history-privacy-omitted','PROOF_FIELD_HISTORY_PRIVACY',p=>{delete p.ownHistoryPrivacy;});mutate('own-history-privacy-extra-field','PROOF_FIELD_HISTORY_PRIVACY',p=>{p.ownHistoryPrivacy.unreviewed=true;});
   for(const key of ['currentAccountKycCanonical','originalAuthorRestored'])mutate('own-history-privacy-'+key,'PROOF_FIELD_HISTORY_PRIVACY',p=>{p.ownHistoryPrivacy[key]=false;});
   mutate('own-history-business-write','PROOF_FIELD_HISTORY_PRIVACY',p=>{p.ownHistoryPrivacy.readBusinessWrites=1;});mutate('own-history-reviewers-omitted','PROOF_FIELD_HISTORY_PRIVACY',p=>{p.ownHistoryPrivacy.reviewerRoles.pop();});
   mutate('own-history-fixture-provider-call','PROOF_PROVIDER_IO',p=>{p.ownHistoryPrivacy.participantKycFixture.providerCalls=1;});mutate('own-history-fixture-not-canonical','PROOF_FIELD_KYC_FIXTURE',p=>{p.ownHistoryPrivacy.participantKycFixture.records[0].canonicalAdmissionConfirmed=false;});
   mutate('own-history-fixture-calls-forged','PROOF_FIELD_KYC_FIXTURE',p=>{p.ownHistoryPrivacy.participantKycFixture.syntheticPrivateCalls.privateReads++;});
   if(spec.kind==='PG_FIELD'){
    mutate('own-history-check-omitted','PROOF_FIELD_HISTORY_PRIVACY',p=>{p.ownHistoryPrivacy.checks=[];});mutate('own-history-check-changed','PROOF_FIELD_HISTORY_PRIVACY',p=>{p.ownHistoryPrivacy.checks[0]='foreign privacy check';});
    mutate('own-history-private-read-before-denial','PROOF_FIELD_HISTORY_PRIVACY',p=>{p.ownHistoryPrivacy.deniedBeforePrivateRead=false;});mutate('own-history-race-omitted','PROOF_FIELD_HISTORY_PRIVACY',p=>{p.ownHistoryPrivacy.postReadAuthorityRaces.pop();});mutate('own-history-provider-call','PROOF_FIELD_HISTORY_PRIVACY',p=>{p.ownHistoryPrivacy.providerCalls=1;});
   }else{
    for(const key of ['sameWorkerReassigned','newAuthorOwnShiftWithForeignPredecessorReadable'])mutate('own-history-privacy-'+key,'PROOF_FIELD_HISTORY_PRIVACY',p=>{p.ownHistoryPrivacy[key]=false;});
   }
  }
  for(const [key,value] of [['canonicalAdmissionConfirmed',false],['identityCertified',true],['providerCalls',1],['contentHash','not-a-sha256'],['reviewerActorId','worker'],['reviewReceiptId','missing'],['submissionReceiptId','missing']])mutate('fixture-record-'+key,'PROOF_FIELD_KYC_FIXTURE',p=>{p.participantKycFixture.records[0][key]=value;});
  for(const file of spec.sourceFiles){
   mutate('source-omitted-'+file,'PROOF_SOURCE_MANIFEST',p=>{if(spec.kind==='PG_FIELD'){for(const key of Object.keys(sets)){const source=key==='fixture'?p.participantKycFixture.sourceSha256:p[key];delete source[file];}}else p.sourceManifest=p.sourceManifest.filter(ref=>ref.file!==file);});
   mutate('source-hash-altered-'+file,'PROOF_SOURCE_HASH',p=>{if(spec.kind==='PG_FIELD'){for(const key of Object.keys(sets)){const source=key==='fixture'?p.participantKycFixture.sourceSha256:p[key];if(Object.hasOwn(source,file))source[file]='f'.repeat(64);}}else p.sourceManifest.find(ref=>ref.file===file).sha256='f'.repeat(64);});
  }
  if(spec.kind==='PG_FIELD'){
   const beforeScheduleProgressSpec={...spec,producerSha256:'9fae027d39730ad59d89567e23b79998551ff7782490de5b6684980d41f6f430'};
   bad(spec.id+'-pre-schedule-progress-pin-cannot-certify-current-harness','PROOF_HARNESS_SOURCE',()=>validateExtensionProof(beforeScheduleProgressSpec,Buffer.from(JSON.stringify({...proof,harnessSha256:beforeScheduleProgressSpec.producerSha256})),{expectedHead,readSource}));
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
  const changed=clone(restoreParticipantPreanalysisPreviousContract(contract));changed.evidenceProducers.find(record=>record.path===spec.path).baselineProducerGitBlobSha256=spec.producerSha256;bad(spec.id+'-historical-record-not-overwritten','EXTENSION_PRODUCER_CONTRACT',()=>validateContract(changed));
  const omitted=clone(restoreParticipantPreanalysisPreviousContract(contract));omitted.extension.proofs=omitted.extension.proofs.filter(p=>p.id!==spec.id);bad(spec.id+'-typed-proof-not-optional','EXTENSION_PROOF_COVERAGE',()=>validateContract(omitted));
  const parent=path.resolve(root,'.vercel/workspace-ci-evidence'),scratch=mkdtempSync(path.join(parent,'ci-canonical-field-selftest-'));
  try{const target=path.join(scratch,spec.path);mkdirSync(path.dirname(target),{recursive:true});writeFileSync(target,'stale canonical field proof');bad(spec.id+'-stale-before-execution','STALE_EVIDENCE',()=>assertFreshEvidence({root:scratch,lane:spec.lane,contract}));}
  finally{assert.equal(path.dirname(path.resolve(scratch)),parent);rmSync(scratch,{recursive:true,force:true});}

}
 for(const spec of contract.extension.proofs.filter(isCanonicalField)) {
  const fixturePorts={validateExtensionProof,currentProducerSourceFiles,companyKycCurrentSourceClosureSelftest,companySubscriptionProofClosureSelftest,currentKycStatusClosureSelftest,documentCurveCopySelftest,monthlyCurveClosureSelftest,organizationUsageClosureSelftest,ownTemplateClosureSelftest,taskMeasurementProofClosureSelftest,whatsappPlanImportClosureSelftest,checks,currentCollectorName:spec.id+"-current-manifest-closure-exact",verifyCurrentCollector:()=>equal(currentProducerSourceFiles(spec,root),spec.sourceFiles.toSorted(),'PROOF_SOURCE_MANIFEST')};
  if(hasCaptureRuntime(contract)&&["PG_FIELD"].includes(spec.kind))runCaptureNativeFixtureIteration(contract,readSource,spec,root,[...new Set([currentReactiveChecks,currentKycStatusChecks,currentWhatsappPlanChecks])],runCaptureFieldFixtureBody,fixturePorts);
  else runCaptureFieldFixtureBody(spec,contract,readSource,fixturePorts);
 }
 return checks;
}
// Synthetic selftest facts only. Public proof validators keep their complete
// current-source, RAW and screenshot path; no source reader escapes this scope.
function withIdentityScenarioFacts({contract,spec,proof,expectedHead,readSource,readEvidence},run){
 const rejectScope=(ok,reason)=>{if(!ok)throw Object.assign(new Error('Identity scenario fact scope rejected: '+reason),{code:'SELFTEST_IDENTITY_FACT_SCOPE_REJECTED',reason});};
 const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
 rejectScope(typeof run==='function'&&typeof readSource==='function'&&typeof readEvidence==='function','ACTUAL_PORTS_AND_CALLBACK');
 rejectScope(run.constructor?.name!=='AsyncFunction'&&run.constructor?.name!=='AsyncGeneratorFunction','ASYNC_CALLBACK');
 rejectScope(spec?.kind==='UI_IDENTITY_ONLY'&&expectedHead===contract.extension.baseHead,'EXACT_IDENTITY_FIXTURE');
 assert.deepEqual(spec,contract.extension.proofs.find(row=>row.kind==='UI_IDENTITY_ONLY'));
 const originalProofJson=JSON.stringify(proof),originalContractJson=JSON.stringify(contract),originalSpecJson=JSON.stringify(spec);
 const owned119=freeze(clone(proof)),owned119Json=JSON.stringify(owned119),ownedSpec=freeze(clone(spec));
 let active=false;
 return captureBudget.withCaptureRuntimePreviousSources(contract,readSource,()=>{
  let baseline103=null,baseline103Json=null;
  try{
   // This is the unmodified public Home wrapper, including current source and
   // actual screenshot reads. Its existing return consumes only the supplement.
   baseline103=freeze(clone(validateIdentityDestinationUxBrowserSupplement(owned119,contract,{readSource,readEvidence})));
   baseline103Json=JSON.stringify(baseline103);validateIdentityProof(ownedSpec,baseline103,expectedHead);
   const requireActive=()=>rejectScope(active,'CLOSED_SCOPE');
   const facts=Object.freeze({
    cloneProof:()=>{requireActive();return clone(baseline103);},
    validateFacts:value=>{requireActive();rejectScope(canonical({...value,checks:baseline103.checks})===canonical(baseline103),'ONLY_CHECKS_MUTABLE');validateIdentityProof(ownedSpec,value,expectedHead);},
   });
   active=true;
   const result=run(facts);rejectScope(result===undefined,'SYNCHRONOUS_VOID_CALLBACK_REQUIRED');
  }finally{
   active=false;
   try{
    // Reread CURRENT sources and screenshot bytes through the public path even
    // when a fact callback throws. Never reuse a previously accepted reader.
    if(baseline103!==null){
     const after=validateIdentityDestinationUxBrowserSupplement(owned119,contract,{readSource,readEvidence});
     rejectScope(JSON.stringify(after)===baseline103Json,'BASELINE103_UNCHANGED');
    }
   }finally{
    rejectScope(JSON.stringify(owned119)===owned119Json,'OWNED119_UNCHANGED');
    rejectScope(JSON.stringify(proof)===originalProofJson,'OBSERVED119_UNCHANGED');
    rejectScope(JSON.stringify(spec)===originalSpecJson,'SPEC_UNCHANGED');
    rejectScope(JSON.stringify(contract)===originalContractJson,'CONTRACT_UNCHANGED');
   }
  }
 });
}

function identitySelftest(workflow,contract,root,currentContinuityChecks=[],currentTemplateChecks=[],currentMonthlyChecks=[],currentKycStatusChecks=[],currentCalendarChecks=[]){
 const checks=[],expectedHead=contract.extension.baseHead,spec=contract.extension.proofs.find(isIdentity);
 const good=(name,run)=>{run();checks.push({name:'identity-only-ui-'+name,result:'PASS',boundary:'pure identity shadow fixture; no Git/PG/UI/provider execution'});};
 const bad=(name,code,run)=>{assert.throws(run,error=>error.code===code);checks.push({name:'identity-only-ui-'+name,result:'PASS',expectedDenial:code,boundary:'pure identity shadow fixture'});};
 // Shadow fixtures model Linux Git bytes. The native validator compares exact Git bytes.
 const readSource=file=>Buffer.from(utf8(readFileSync(path.join(root,sourcePath(file)))).replaceAll('\r\n','\n'));
 const proof={status:'PASS',environment:'isolated-browser-real-components-with-controlled-session-and-http',sourceRevision:expectedHead,sourceState:'EXACT_CI_SOURCE',trackedClean:true,dirtyTrackedPaths:[],widths:[320,390,768,1280],totalCheckCount:IDENTITY_ONLY_CHECK_COUNT,checks:clone(IDENTITY_ONLY_CHECKS),sourceManifest:spec.sourceFiles.map(file=>({path:file,sha256:hash(readSource(file))})),harnessSha256:spec.producerSha256,pageErrors:[],requestErrors:[],screenshots:identityScreenshotNames.map(name=>IDENTITY_ARTIFACTS[0]+name),actualPageReloadTested:true,nativeIndexedDbReceiptReferencesTested:true,automaticRecoveryPostCount:0,postgresExecuted:false,realClerkLogin:false,realEmailDelivery:false,productionDataWritten:false,realProviderCalls:0,physicalWhatsAppVerified:false,fixtureRemoved:true,browserClosed:true,serverStopped:true};
 const destinationShadow=identityDestinationUxBrowserShadow(contract);Object.assign(proof,destinationShadow.fields);
 const validate=value=>validateExtensionProof(spec,Buffer.from(JSON.stringify(value)),{expectedHead,readSource,readEvidence:file=>destinationShadow.evidence.get(file)||null});
 currentTemplateChecks.push(()=>ownTemplateClosureSelftest(spec,proof,root,validate));
 currentMonthlyChecks.push(()=>monthlyCurveClosureSelftest(spec,proof,root,validate));
 currentKycStatusChecks.push(()=>currentKycStatusClosureSelftest(spec,proof,root,validate));
 currentCalendarChecks.push(()=>calendarPreparationClosureSelftest(spec,proof,root,validate));
 const mutate=(name,code,edit)=>{const value=clone(proof);edit(value);bad(name,code,()=>validate(value));};
 good('complete-103-exact-source-proof',()=>assert.equal(validate(proof).checks,IDENTITY_ONLY_CHECK_COUNT));
 good('current-source-closure-exact',()=>equal(currentProducerSourceFiles(spec,root),spec.sourceFiles.toSorted(),'PROOF_SOURCE_MANIFEST'));
  checks.push(...companySubscriptionProofClosureSelftest(spec,proof,root,validate));
 good('manifest-order-independent',()=>{const value=clone(proof);value.sourceManifest.reverse();assert.equal(validate(value).sourceManifestSha256,validate(proof).sourceManifestSha256);});
 bad('malformed-json','PROOF_JSON',()=>validateExtensionProof(spec,Buffer.from('{'),{expectedHead,readSource}));bad('invalid-utf8','PROOF_ENCODING',()=>validateExtensionProof(spec,Buffer.from([255]),{expectedHead,readSource}));
 mutate('wrong-status','PROOF_STATUS',p=>{p.status='FAIL';});mutate('production-write','PROOF_PRODUCTION_BOUNDARY',p=>{p.productionDataWritten=true;});
 mutate('wrong-head','PROOF_SOURCE_HEAD',p=>{p.sourceRevision='f'.repeat(40);});mutate('missing-head','PROOF_IDENTITY_SHAPE',p=>{delete p.sourceRevision;});
 mutate('dirty-source','PROOF_SOURCE_STATE',p=>{p.trackedClean=false;});mutate('dirty-path','PROOF_SOURCE_STATE',p=>{p.dirtyTrackedPaths=['src/lib/participant-admission.mjs'];});mutate('local-review-source','PROOF_SOURCE_STATE',p=>{p.sourceState='LOCAL_REVIEW_SOURCE';});
 mutate('wrong-harness','PROOF_HARNESS_SOURCE',p=>{p.harnessSha256='f'.repeat(64);});
 mutate('historical-harness-cannot-certify-current-source','PROOF_HARNESS_SOURCE',p=>{p.harnessSha256=IDENTITY_UI_BASELINE_PRODUCER.producerSha256;});
 {const changed=clone(restoreParticipantPreanalysisPreviousContract(contract));changed.evidenceProducers.find(record=>record.path===spec.path).producerSha256=spec.producerSha256;bad('historical-record-cannot-be-overwritten','EXTENSION_PRODUCER_CONTRACT',()=>validateContract(changed));}
 mutate('foreign-environment','PROOF_IDENTITY_ENVIRONMENT',p=>{p.environment='production-browser';});
 for(const [key,value] of [['realProviderCalls',1],['postgresExecuted',true],['realClerkLogin',true],['realEmailDelivery',true],['physicalWhatsAppVerified',true]])mutate('provider-'+key,'PROOF_PROVIDER_IO',p=>{p[key]=value;});
 mutate('provider-array-not-zero','PROOF_PROVIDER_IO',p=>{p.realProviderCalls=[];});
 for(const key of ['fixtureRemoved','browserClosed','serverStopped'])mutate('cleanup-'+key,'PROOF_CLEANUP',p=>{p[key]=false;});
 for(const key of ['pageErrors','requestErrors'])mutate('error-'+key,'PROOF_UI_ERRORS',p=>{p[key]=['shadow failure'];});
 mutate('wrong-width','PROOF_MATRIX',p=>{p.widths[0]=321;});mutate('wrong-total','PROOF_MATRIX',p=>{p.totalCheckCount=34;});
 withIdentityScenarioFacts({contract,spec,proof,expectedHead,readSource,readEvidence:file=>destinationShadow.evidence.get(file)||null},({cloneProof,validateFacts})=>{
  const mutateFacts=(name,code,edit)=>{const value=cloneProof();edit(value);bad(name,code,()=>validateFacts(value));checks.at(-1).boundary='pure identity fact decoder inside one fresh synchronous current-source and RAW scope; no native or human acceptance';};
  for(const [index,row] of IDENTITY_ONLY_CHECKS.entries()){
   mutateFacts('scenario-'+index+'-omitted','PROOF_IDENTITY_CHECKS',p=>{p.checks.splice(index,1);});
   mutateFacts('scenario-'+index+'-altered','PROOF_IDENTITY_CHECKS',p=>{p.checks[index]={...row,width:321};});
  }
 });
 // Two public integration anchors retain the complete current source/RAW path.
 mutate('public-scenario-first-omitted','PROOF_IDENTITY_CHECKS',p=>{p.checks.splice(0,1);});
 mutate('public-scenario-last-altered','PROOF_IDENTITY_CHECKS',p=>{p.checks[p.checks.length-1]={...p.checks.at(-1),width:321};});
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
 let currentGateReport;
 good('gate-binds-103-checks',()=>{currentGateReport=gate(input);assert.equal(currentGateReport.lanes.find(lane=>lane.lane==='workspace-ui').proofBindings.find(binding=>binding.id===spec.id).checks,IDENTITY_ONLY_CHECK_COUNT);});
 const decoder=ownedProvenanceDecoder(input,currentGateReport),decodeJsonCase=decoder.decode;decoder.variableFiles(checks,'provenance-decoder-identity',needs,'identity-only-ui');
 const badDecoder=(name,code,run)=>{bad(name,code,run);checks.at(-1).boundary=PURE_PROVENANCE_DECODER_BOUNDARY;};
 for(const [name,code,edit] of [
  ['binding-omitted','PROOF_BINDINGS',r=>{r.proofBindings=r.proofBindings.filter(b=>b.id!==spec.id);}],
  ['binding-head','PROOF_BINDING_IDENTITY',r=>{r.proofBindings.find(b=>b.id===spec.id).sourceRevision='f'.repeat(40);}],
  ['binding-source','PROOF_BINDING_SOURCE',r=>{r.proofBindings.find(b=>b.id===spec.id).sourceManifestSha256='f'.repeat(64);}],
  ['binding-proof','PROOF_BINDING_IDENTITY',r=>{r.proofBindings.find(b=>b.id===spec.id).proofSha256='f'.repeat(64);}],
  ['binding-harness','PROOF_BINDING_IDENTITY',r=>{r.proofBindings.find(b=>b.id===spec.id).harnessSha256='f'.repeat(64);}],
  ['binding-checks','PROOF_BINDING_IDENTITY',r=>{r.proofBindings.find(b=>b.id===spec.id).checks=34;}],
  ['binding-closure-count','PROOF_BINDING_IDENTITY',r=>{r.proofBindings.find(b=>b.id===spec.id).sourceReferences--; }],
  ['evidence-omitted','MISSING_REQUIRED_RETAINED_EVIDENCE',r=>{r.files=r.files.filter(f=>f.path!==spec.path);}]
 ]){const value=clone(needs),record=JSON.parse(value[spec.lane].outputs.provenance);edit(record);delete record.manifestSha256;value[spec.lane].outputs.provenance=JSON.stringify(seal(record));badDecoder(name,code,()=>decodeJsonCase(value));}
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
 ]){const value=clone(restoreParticipantPreanalysisPreviousContract(contract));edit(value);bad(name,code,()=>validateContract(value));}
 const parent=path.resolve(root,'.vercel/workspace-ci-evidence'),fixture=mkdtempSync(path.join(parent,'ci-identity-selftest-fixture-'));
 try{const target=path.join(fixture,spec.path);mkdirSync(path.dirname(target),{recursive:true});writeFileSync(target,'stale identity shadow proof');bad('stale-proof-before-execution','STALE_EVIDENCE',()=>assertFreshEvidence({root:fixture,lane:spec.lane,contract}));}
 finally{const resolved=path.resolve(fixture);assert.ok(path.dirname(resolved)===parent&&path.basename(resolved).startsWith('ci-identity-selftest-fixture-'));rmSync(resolved,{recursive:true,force:true});}
 currentContinuityChecks.push(()=>{
  const start=checks.length;
  good('current-intake-continuity-source-pinned',()=>assert.ok(spec.sourceFiles.includes(INTAKE_CONTINUITY_SOURCE)));
  good('current-intake-continuity-source-count-exact',()=>assert.equal(spec.sourceFiles.length,98+currentOwnDependenciesFor(spec.kind).length+reviewerDependenciesFor(spec.kind).length+intakeAssignmentDependenciesFor(spec.kind).length+currentPlanDependenciesFor(spec.kind).length+participantPreanalysisProofSourceAdditions(spec).length+officeAccountDependenciesFor(spec.kind).length+currentKycStatusDependenciesFor(spec.kind).length+companySubscriptionFixtureDependenciesFor(spec.kind).length));
  mutate('missing-intake-continuity-source','PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>ref.path!==INTAKE_CONTINUITY_SOURCE);});
  mutate('changed-intake-continuity-hash','PROOF_SOURCE_HASH',p=>{p.sourceManifest.find(ref=>ref.path===INTAKE_CONTINUITY_SOURCE).sha256='f'.repeat(64);});
  mutate('old-97-source-manifest-without-intake-continuity','PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>![INTAKE_CONTINUITY_SOURCE,...currentOwnDependenciesFor(spec.kind),...reviewerDependenciesFor(spec.kind),...intakeAssignmentDependenciesFor(spec.kind),...currentPlanDependenciesFor(spec.kind),...participantPreanalysisProofSourceAdditions(spec),...officeAccountDependenciesFor(spec.kind),...currentKycStatusDependenciesFor(spec.kind),...companySubscriptionFixtureDependenciesFor(spec.kind)].includes(ref.path));assert.equal(p.sourceManifest.length,97);});
  return checks.splice(start);
 });
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
  }else if(spec.kind==='UI_PORTFOLIO')Object.assign(proof,{...documentCurveCopyShadow(readSource,spec),state:'PASS_LOCAL_UI_NOT_RELEASE_ACCEPTANCE',fixtureRemoved:true,errors:[],widths:[320,390,768,1280],checks:[320,390,768,1280].flatMap(width=>PORTFOLIO_MODES.map(mode=>({width,mode,reads:['pagination','503','401','403','409','503-html','401-html','403-html','409-html','invalid-json'].includes(mode)?2:1,providerCalls:0,mutations:0,horizontalOverflow:false})))});
  else Object.assign(proof,{sourceState:'EXACT_CI_SOURCE',trackedClean:true,dirtyTrackedPaths:[],productionDataTouched:false,environment:'local-disposable-postgresql',databaseRemoved:true,connectionClosed:true,physicalWhatsAppTested:false,checks:[...spec.checkNames],totalCheckCount:spec.checkNames.length});
  const validate=value=>validateExtensionProof(spec,Buffer.from(JSON.stringify(value)),{expectedHead,readSource,readEvidence:file=>evidence.get(file)});
  const mutate=(name,code,edit)=>{const value=clone(proof);edit(value);bad(spec.id+'-'+name,code,()=>validate(value));};
  checks.push(...documentCurveCopySelftest(spec,proof,validate));
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
   const staleSpec={...spec,producerSha256:COPY_CLOSURE_UI_BASELINE_PRODUCERS[spec.kind].producerSha256};bad('portfolio-ui-historical-pin-cannot-certify-current-harness','PROOF_HARNESS_SOURCE',()=>validateExtensionProof(staleSpec,Buffer.from(JSON.stringify({...proof,harnessSha256:staleSpec.producerSha256})),{expectedHead,readSource}));
   const changed=clone(restoreParticipantPreanalysisPreviousContract(contract));changed.evidenceProducers.find(record=>record.path===spec.path).producerSha256=spec.producerSha256;bad('portfolio-ui-historical-record-cannot-be-overwritten','EXTENSION_PRODUCER_CONTRACT',()=>validateContract(changed));
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
 equal(specs.map(spec=>spec.id),['portfolio-units','portfolio-ui','portfolio-postgres'],'DECODER_PORTFOLIO_CATALOG');
 let currentGateReport;good('portfolio-public-gate-current-eight-lanes',()=>{currentGateReport=gate(input);assert.equal(currentGateReport.state,'PASS');});checks.at(-1).boundary='public current gate integration; no native or human acceptance';
 const decoder=ownedProvenanceDecoder(input,currentGateReport),decodeJsonCase=decoder.decode;decoder.variableFiles(checks,'provenance-decoder-portfolio',needs,'portfolio-units');
 const badDecoder=(name,code,run)=>{bad(name,code,run);checks.at(-1).boundary=PURE_PROVENANCE_DECODER_BOUNDARY;};
 for(const spec of specs){
  for(const [name,code,edit] of [
   ['binding-omitted','PROOF_BINDINGS',r=>{r.proofBindings=r.proofBindings.filter(b=>b.id!==spec.id);}],
   ['binding-head','PROOF_BINDING_IDENTITY',r=>{r.proofBindings.find(b=>b.id===spec.id).sourceRevision='f'.repeat(40);}],
   ['binding-source','PROOF_BINDING_SOURCE',r=>{r.proofBindings.find(b=>b.id===spec.id).sourceManifestSha256='f'.repeat(64);}],
   ['binding-proof','PROOF_BINDING_IDENTITY',r=>{r.proofBindings.find(b=>b.id===spec.id).proofSha256='f'.repeat(64);}],
   ['binding-harness','PROOF_BINDING_IDENTITY',r=>{r.proofBindings.find(b=>b.id===spec.id).harnessSha256='f'.repeat(64);}],
   ['binding-checks','PROOF_BINDING_IDENTITY',r=>{r.proofBindings.find(b=>b.id===spec.id).checks=0;}],
   ['evidence-omitted','MISSING_REQUIRED_RETAINED_EVIDENCE',r=>{r.files=r.files.filter(f=>f.path!==spec.path);}]
  ]){const value=clone(needs),record=JSON.parse(value[spec.lane].outputs.provenance);edit(record);delete record.manifestSha256;value[spec.lane].outputs.provenance=JSON.stringify(seal(record));badDecoder(spec.id+'-'+name,code,()=>decodeJsonCase(value));}
  bad(spec.id+'-current-Git-source-altered','PROOF_BINDING_SOURCE',()=>gate({...input,readSource:file=>file===spec.sourceFiles.at(-1)?Buffer.concat([readSource(file),Buffer.from('changed shadow source')]):readSource(file)}));
 }
 for(const [name,code,edit] of [
  ['block-omitted','CONTRACT_BLOCKS',c=>{c.blocks=c.blocks.filter(block=>block.id!==59);}],['block-duplicated','CONTRACT_BLOCKS',c=>{c.blocks.push(clone(c.blocks.find(block=>block.id===59)));}],
  ['command-changed','CONTRACT_COMMAND',c=>{c.blocks.find(block=>block.id===59).step.run+='\ntrue';}],
  ['command-resealed','PORTFOLIO_BLOCK_COMMAND',c=>{const block=c.blocks.find(block=>block.id===59);block.step.run+='\ntrue';block.commandSha256=hash(block.step.run);}],
  ['baseline-58-command-resealed','PORTFOLIO_BASELINE_BLOCKS_CHANGED',c=>{const b=c.blocks.find(b=>b.id===58);b.step.run+='\ntrue';b.commandSha256=hash(b.step.run);}]
 ]){const value=clone(restoreParticipantPreanalysisPreviousContract(contract));edit(value);bad('portfolio-'+name,code,()=>validateContract(value));}
 for(const spec of specs){const value=clone(restoreParticipantPreanalysisPreviousContract(contract));value.extension.proofs=value.extension.proofs.filter(p=>p.id!==spec.id);bad(spec.id+'-contract-binding-omitted','EXTENSION_PROOF_COVERAGE',()=>validateContract(value));}
 const parent=path.resolve(root,'.vercel/workspace-ci-evidence'),fixture=mkdtempSync(path.join(parent,'ci-portfolio-selftest-fixture-'));
 try{for(const spec of specs){const target=path.join(fixture,spec.path);mkdirSync(path.dirname(target),{recursive:true});writeFileSync(target,'stale portfolio shadow proof');bad(spec.id+'-stale-before-execution','STALE_EVIDENCE',()=>assertFreshEvidence({root:fixture,lane:spec.lane,contract}));rmSync(target);}}
 finally{const resolved=path.resolve(fixture);assert.ok(path.dirname(resolved)===parent&&path.basename(resolved).startsWith('ci-portfolio-selftest-fixture-'));rmSync(resolved,{recursive:true,force:true});}
 return checks;
}

// Pure source/aggregate shadows: no browser, PostgreSQL or provider evidence.
export function planBudgetCurrentGateSelftest(workflow,contract,root=process.cwd()){
 const checks=[],readSource=file=>Buffer.from(readFileSync(path.join(root,sourcePath(file)),'utf8').replaceAll('\r\n','\n')),expectedHead='a'.repeat(40),workflowSha256=hash(yaml.dump(workflow)),needs=expectedNeeds(contract,expectedHead,workflowSha256,readSource),input={contract,needs,expectedHead,runId:'100',runAttempt:'1',workflowSha256,readSource};
 const good=(name,run)=>{run();checks.push({name:'budget-current-'+name,result:'PASS',boundary:'pure source and aggregate shadow; no browser acceptance'});},bad=(name,code,change)=>{const copy=clone(needs),record=JSON.parse(copy.plans.outputs.provenance);change(record);copy.plans.outputs.provenance=JSON.stringify(seal(unseal(record)));assert.throws(()=>decodeJsonCase(copy),error=>error.code===code);checks.push({name:'budget-current-'+name,result:'PASS',expectedDenial:code,boundary:PURE_PROVENANCE_DECODER_BOUNDARY});};
 good('exact-corrected11-contract-inverse',()=>assert.equal(hash(JSON.stringify(restorePlanBudgetPreviousContract(contract),null,2)+'\n'),'8b19235b22aa3c208098283537511fe1c816f7ff86404790a98999f0e818f839'));
 good('all-current-sources-bound',()=>verifyPlanBudgetCurrentSources(contract,readSource));let currentGateReport;good('all23-pngs-bound-in-aggregate',()=>{currentGateReport=gate(input);});
 const decoder=ownedProvenanceDecoder(input,currentGateReport),decodeJsonCase=decoder.decode;decoder.variableFiles(checks,'provenance-decoder-budget',needs,'budget-source-ui');
 bad('budget-ci-json-omitted','MISSING_REQUIRED_RETAINED_EVIDENCE',r=>{r.files=r.files.filter(file=>file.path!==PLAN_BUDGET_CI_PROOF_PATH);});
 bad('one-png-omitted','PROOF_BUDGET_UI_SCREENSHOT_BINDING',r=>{r.files=r.files.filter(file=>file.path!==planBudgetRetainedScreenshotPaths(contract)[0]);});
 bad('same-png-duplicated','PATH_COLLISION',r=>{r.files.push(clone(r.files.find(file=>file.path===planBudgetRetainedScreenshotPaths(contract)[0])));});
 bad('png-hash-altered','PROOF_BINDING_IDENTITY',r=>{r.files.find(file=>file.path===planBudgetRetainedScreenshotPaths(contract)[0]).sha256='f'.repeat(64);});
 bad('typed-proof23-count-forged','PROOF_BINDING_IDENTITY',r=>{r.proofBindings.find(proof=>proof.kind===PLAN_BUDGET_CI_KIND).checks.cases=22;});
 bad('foreign-source-revision','PROVENANCE_IDENTITY',r=>{r.head='f'.repeat(40);});
 return checks;
}

function writeJson(filename,value){mkdirSync(path.dirname(filename),{recursive:true});writeFileSync(filename,JSON.stringify(value,null,2)+'\n');}
function options(argv){const parsed={};for(let i=0;i<argv.length;i+=2){if(!argv[i]?.startsWith('--')||!argv[i+1])deny('CLI_ARGUMENT');parsed[argv[i].slice(2)]=argv[i+1];}return parsed;}
// CLI selftest diagnostics only: original calls and result rows remain unchanged.
function selftestProgressStart(label){
 try{
  if(process.argv[2]!=='selftest'||!process.argv[1]||path.resolve(process.argv[1])!==fileURLToPath(import.meta.url))return null;
  const started=process.hrtime.bigint(),line=JSON.stringify({state:'SELFTEST_PROGRESS',phase:'START',label})+'\n';
  if(writeSelftestProgressSync(2,line)!==Buffer.byteLength(line))return null;
  return started;
 }catch{return null;}
}
function selftestProgressEnd(label,started){
 if(started===null)return;
 try{
  const elapsedMs=Number((process.hrtime.bigint()-started)/1000000n);
  writeSelftestProgressSync(2,JSON.stringify({state:'SELFTEST_PROGRESS',phase:'END',label,elapsedMs})+'\n');
 }catch{}
}
function main(){

 const selftestProgressToken001=selftestProgressStart("CLI.load-contract-workflow-options");
 const [mode,...args]=process.argv.slice(2),opts=options(args),root=path.resolve(opts.root||process.cwd()),contract=loadContract(path.resolve(root,opts.contract||contractPath)),file=path.resolve(root,opts.workflow||workflowPath),bytes=readFileSync(file),workflow=yaml.load(bytes.toString('utf8'));
 selftestProgressEnd("CLI.load-contract-workflow-options",selftestProgressToken001);


 const selftestProgressToken002=selftestProgressStart("CLI.equivalence-and-dependencies");
 equivalent(workflow,contract);dependencies(root,contract);
 selftestProgressEnd("CLI.equivalence-and-dependencies",selftestProgressToken002);

 if(mode==='equivalence'){if(opts['expected-head'])identity(root,opts['expected-head']);console.log(JSON.stringify({state:'PASS',commandBlocks:contract.blocks.length,artifactPatterns:contract.artifactPatterns.length,lanes:8}));return;}
 if(mode==='selftest'){
  const sourceHead=opts['expected-head']?identity(root,opts['expected-head']):identity(root,execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim());
   const checks=selftest(workflow,contract,root),output=path.resolve(root,opts.output||'.vercel/workspace-ci-evidence/selftest.json');writeJson(output,{version:1,state:'PASS',head:sourceHead,workflowSha256:hash(bytes),contractSha256:EXPECTED_CONTRACT_SHA256,verifierSha256:verifierSha256(),packageLockSha256:contract.packageLockSha256,requirementsSha256:contract.requirementsSha256,checks});
  const escape=value=>value.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  writeFileSync(output.replace(/\.json$/,'.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="workspace-ci-private-design" tests="${checks.length}" failures="0">${checks.map(check=>`<testcase name="${escape(check.name)}"/>`).join('')}</testsuite>\n`);
  console.log(JSON.stringify({state:'PASS',checks:checks.length,commandBlocks:contract.blocks.length,artifactPatterns:contract.artifactPatterns.length,lanes:8}));return;
 }
 if(mode==='preflight'){
  identity(root,opts['expected-head']);clocks(process.env);if(!LANES.includes(opts.lane))deny('UNKNOWN_LANE');
  verifyKycExpiredCurrentSources(contract.kycExpiredCurrentComposition,gitSource(root,opts['expected-head']));
  assertFreshEvidence({root,lane:opts.lane,contract});
  console.log(JSON.stringify({state:'PASS',lane:opts.lane}));return;
 }
 if(mode==='provenance'){
  const record=provenance({root,lane:opts.lane,contract,expectedHead:opts['expected-head'],workflowSha256:hash(bytes)}),manifest=path.join(root,'.vercel/workspace-ci-evidence/lane-'+opts.lane+'.json');mkdirSync(path.dirname(manifest),{recursive:true});writeFileSync(manifest,JSON.stringify(unseal(record))+'\n');
  if(!process.env.GITHUB_OUTPUT)deny('OUTPUT_FILE_REQUIRED');writeFileSync(process.env.GITHUB_OUTPUT,'record='+JSON.stringify(record)+'\n',{flag:'a'});return;
 }
 if(mode==='gate'){
  identity(root,opts['expected-head']);const filename=path.join(root,'.vercel/workspace-ci-evidence/gate.json');
  try{const report=gate({needs:readLaneNeedsEnvironment(process.env),contract,expectedHead:opts['expected-head'],workflowSha256:hash(bytes),...clocks(process.env),readSource:gitSource(root,opts['expected-head'])});writeJson(filename,report);console.log(JSON.stringify({state:'PASS',lanes:8,commandBlocks:contract.blocks.length,artifactPatterns:contract.artifactPatterns.length,fileCount:report.fileCount}));}
  catch(error){writeJson(filename,{version:1,state:'FAIL',code:error.code||'GATE_FAILED'});throw error;}return;
 }
 deny('UNKNOWN_COMMAND');
}
// Opt-in CLI failure formatting only: never changes or executes a selftest check.
export function selftestErrorDiagnostics(error,argv){
 try{
  if(!Array.isArray(argv)||argv[0]!=='selftest'||options(argv.slice(1))['diagnostic-errors']!=='code-stack-v1')return {};
  const operators=['strictEqual','notStrictEqual','deepStrictEqual','notDeepStrictEqual','deepEqual','notDeepEqual','==','!=','===','!==','throws','doesNotThrow','rejects','doesNotReject','match','doesNotMatch','fail','ifError','ok'];
  let operator=null,stack=null;
  try{const value=error?.operator;if(typeof value==='string'&&operators.includes(value))operator=value;}catch{}
  try{const value=error?.stack;if(typeof value==='string')stack=value;}catch{}
  // Reject whole data-URL frames before truncation; never serialize the header.
  const frames=stack===null?[]:stack.split(/\r?\n/).filter(line=>/^\s*at /.test(line)&&!line.toLowerCase().includes('data:')).slice(0,8).map(line=>line.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').trimStart().slice(0,512));
  return {diagnosticErrors:'code-stack-v1',operator,frames};
 }catch{return {};}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{main();}catch(error){console.error(JSON.stringify({state:'FAIL',code:error.code||'VERIFIER_FAILED',...selftestErrorDiagnostics(error,process.argv.slice(2))}));process.exitCode=1;}}

// Static copies of the existing selftest-only helper bodies. Explicit fixture
// ports below never change the public current collector or native entrypoint.
function captureNativeFixtureSelftestHelpers(readFileSync,currentProducerSourceFiles){
function companyKycCurrentSourceClosureSelftest(spec,proof,root,validate){
 if(spec.kind!=='PG_COMPANY_KYC')return [];
  const dependencies=[...companyKycCurrentSourceClosureDependenciesFor(spec.kind),...planBaselineDependenciesFor(spec.kind),...currentWhatsappFeedbackDependenciesFor(spec.kind),...planMeasurementCurrentDependencies(spec.kind),...participantPreanalysisProofSourceAdditions(spec)],checks=[],prefix=spec.id+'-expiry-current-source-';if(!dependencies.length)return checks;
 const good=(name,run)=>{run();checks.push({name:prefix+name,result:'PASS',boundary:'pure source and shadow proof; no PG/UI/provider execution'});};
 const mutate=(name,code,edit)=>{const value=clone(proof);edit(value);assert.throws(()=>validate(value),error=>error.code===code);checks.push({name:prefix+name,result:'PASS',expectedDenial:code,boundary:'pure adversarial shadow proof'});};
 good('actual-emitter-and-declared-corpus-exact',()=>equal(currentProducerSourceFiles(spec,root),spec.sourceFiles.toSorted(),'PROOF_SOURCE_MANIFEST'));
 good('previous-209-path-lineage-immutable',()=>{const previous=spec.sourceFiles.filter(file=>!dependencies.includes(file)).toSorted();assert.equal(previous.length,209);validateCompanyKycPreviousSourceLineage(spec);});
 for(const file of dependencies){
  good('source-pinned-once-'+file,()=>assert.equal(spec.sourceFiles.filter(source=>source===file).length,1));
  mutate('missing-source-'+file,'PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>ref.path!==file);});
  mutate('changed-source-hash-'+file,'PROOF_SOURCE_HASH',p=>{p.sourceManifest.find(ref=>ref.path===file).sha256='f'.repeat(64);});
  mutate('same-count-foreign-source-'+file,'PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest.find(ref=>ref.path===file).path='src/lib/foreign-expiry-source.mjs';assert.equal(p.sourceManifest.length,spec.sourceFiles.length);});
 }
  mutate('initial-210-emitter-omission-cannot-certify-AST-closure','PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>ref.path!==COMPANY_KYC_FORMAT_CLOSURE_SOURCE&&!planBaselineDependenciesFor(spec.kind).includes(ref.path)&&!currentWhatsappFeedbackDependenciesFor(spec.kind).includes(ref.path)&&!planMeasurementCurrentDependencies(spec.kind).includes(ref.path)&&!participantPreanalysisProofSourceAdditions(spec).includes(ref.path));assert.equal(p.sourceManifest.length,210);});
 mutate('previous-209-manifest-cannot-certify-expiry','PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>!dependencies.includes(ref.path));assert.equal(p.sourceManifest.length,209);});
 mutate('previous-reviewed-producer-cannot-certify-current-native-groups','PROOF_HARNESS_SOURCE',p=>{p.harnessSha256=COMPANY_KYC_EXPIRY_PREVIOUS_PRODUCER_SHA256;});
 return checks;
}
function companySubscriptionProofClosureSelftest(spec,proof,root,validate){
 const dependencies=companySubscriptionProofDependenciesFor(spec.kind),checks=[],prefix=spec.id+'-company-subscription-';if(!dependencies.length)return checks;
 const good=(name,run)=>{run();checks.push({name:prefix+name,result:'PASS',boundary:'pure current source proof; no PG/UI/provider execution'});};
 const mutate=(name,code,edit)=>{const value=clone(proof);edit(value);assert.throws(()=>validate(value),error=>error.code===code);checks.push({name:prefix+name,result:'PASS',expectedDenial:code,boundary:'pure adversarial current source proof'});};
 good('exact-current-producer-closure',()=>equal(currentProducerSourceFiles(spec,root),spec.sourceFiles.toSorted(),'PROOF_SOURCE_MANIFEST'));
 for(const file of dependencies){
  good('source-pinned-once-'+file,()=>assert.equal(spec.sourceFiles.filter(source=>source===file).length,1));
  mutate('missing-source-'+file,'PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>ref.path!==file);});
  mutate('changed-source-hash-'+file,'PROOF_SOURCE_HASH',p=>{p.sourceManifest.find(ref=>ref.path===file).sha256='f'.repeat(64);});
  mutate('same-count-foreign-source-'+file,'PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest.find(ref=>ref.path===file).path='src/lib/foreign-company-subscription.mjs';assert.equal(p.sourceManifest.length,spec.sourceFiles.length);});
 }
 if(isIdentity(spec)){
  mutate('previous-same-count-billing-mount-denied','PROOF_SOURCE_MANIFEST',p=>{for(const [index,file]of COMPANY_SUBSCRIPTION_UI_SOURCES.entries())p.sourceManifest.find(ref=>ref.path===file).path=PREVIOUS_COMPANY_BILLING_UI_SOURCES[index];assert.equal(p.sourceManifest.length,spec.sourceFiles.length);});
  mutate('previous-117-manifest-without-closed-fixture-denied','PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>![...companySubscriptionFixtureDependenciesFor(spec.kind),...taskMeasurementDependenciesFor(spec.kind),...organizationUsageDependenciesFor(spec.kind),...civilDataDependenciesFor(spec.kind),...companyKycCurrentSourceClosureDependenciesFor(spec.kind),...planBaselineDependenciesFor(spec.kind),...planMeasurementCurrentDependencies(spec.kind),...participantPreanalysisProofSourceAdditions(spec)].includes(ref.path));assert.equal(p.sourceManifest.length,117);});
 }
  else mutate('previous-191-source-manifest-denied','PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>![...dependencies,...taskMeasurementDependenciesFor(spec.kind),...organizationUsageDependenciesFor(spec.kind),...civilDataDependenciesFor(spec.kind),...companyKycCurrentSourceClosureDependenciesFor(spec.kind),...planBaselineDependenciesFor(spec.kind),...currentWhatsappFeedbackDependenciesFor(spec.kind),...planMeasurementCurrentDependencies(spec.kind),...participantPreanalysisProofSourceAdditions(spec)].includes(ref.path));assert.equal(p.sourceManifest.length,191);});
 return checks;
}
function currentKycStatusClosureSelftest(spec,proof,root,validate){
 const dependencies=currentKycStatusDependenciesFor(spec.kind);if(!dependencies.length)return [];
 const previousCount=CURRENT_KYC_STATUS_BASE_COUNTS[spec.kind]??CURRENT_KYC_FEEDBACK_ONLY_BASE_COUNTS[spec.kind];assert.ok(Number.isSafeInteger(previousCount));
 const checks=[],prefix=spec.id+'-current-kyc-status-';
 const good=(name,run)=>{run();checks.push({name:prefix+name,result:'PASS',boundary:'pure CURRENT source fixture; no PG/UI/provider execution'});};
 const mutate=(name,code,edit)=>{const value=clone(proof);edit(value);assert.throws(()=>validate(value),error=>error.code===code);checks.push({name:prefix+name,result:'PASS',boundary:'pure adversarial CURRENT source fixture'});};
 const rewrite=(value,file,{remove=false,replacement=null,changedHash=false}={})=>{
  let changed=0;
  if(spec.kind==='PG_FIELD'){
   for(const map of [value.sourceSha256,value.voiceProgressSourceSha256,value.mediaLeaseSourceSha256,value.videoAudioSourceSha256,value.participantKycFixture.sourceSha256])if(Object.hasOwn(map,file)){
    const original=map[file];if(remove||replacement)delete map[file];if(replacement)map[replacement]=original;if(changedHash)map[file]='f'.repeat(64);changed++;
   }
  }else{
   const key=spec.kind==='PG_OVERTIME'?'file':'path';
   value.sourceManifest=value.sourceManifest.filter(ref=>{if(ref[key]!==file)return true;changed++;if(replacement)ref[key]=replacement;if(changedHash)ref.sha256='f'.repeat(64);return !remove;});
  }
  assert.ok(changed>0,'CURRENT source exists in shadow manifest: '+file);
 };
 good('exact-additive-count-and-producer-closure',()=>{assert.equal(spec.sourceFiles.length,previousCount+dependencies.length+calendarPreparationDependenciesFor(spec.kind).length+whatsappPlanImportDependenciesFor(spec.kind).length+organizationUsageDependenciesFor(spec.kind).length+proofFixtureDependenciesFor(spec.kind).length+civilDataDependenciesFor(spec.kind).length+companyKycCurrentSourceClosureDependenciesFor(spec.kind).length+companySubscriptionBackendDependenciesFor(spec.kind).length+companySubscriptionFixtureDependenciesFor(spec.kind).length+taskMeasurementDependenciesFor(spec.kind).length+planBaselineDependenciesFor(spec.kind).length+planMeasurementCurrentDependencies(spec.kind).length+participantPreanalysisProofSourceAdditions(spec).length);equal(currentProducerSourceFiles(spec,root),spec.sourceFiles.toSorted(),'PROOF_SOURCE_MANIFEST');});
 for(const file of dependencies){
  good('source-pinned-'+file,()=>assert.ok(spec.sourceFiles.includes(file)));
  mutate('missing-source-'+file,'PROOF_SOURCE_MANIFEST',value=>rewrite(value,file,{remove:true}));
  mutate('changed-source-hash-'+file,'PROOF_SOURCE_HASH',value=>rewrite(value,file,{changedHash:true}));
  mutate('same-count-foreign-source-'+file,'PROOF_SOURCE_MANIFEST',value=>rewrite(value,file,{replacement:'src/lib/foreign-current-kyc-source.mjs'}));
 }
 mutate('previous-current-manifest-cannot-certify-reader','PROOF_SOURCE_MANIFEST',value=>{for(const file of [...dependencies,...calendarPreparationDependenciesFor(spec.kind),...whatsappPlanImportDependenciesFor(spec.kind),...organizationUsageDependenciesFor(spec.kind),...proofFixtureDependenciesFor(spec.kind),...civilDataDependenciesFor(spec.kind),...companyKycCurrentSourceClosureDependenciesFor(spec.kind),...companySubscriptionBackendDependenciesFor(spec.kind),...companySubscriptionFixtureDependenciesFor(spec.kind),...taskMeasurementDependenciesFor(spec.kind),...planBaselineDependenciesFor(spec.kind),...planMeasurementCurrentDependencies(spec.kind),...participantPreanalysisProofSourceAdditions(spec)])rewrite(value,file,{remove:true});const count=isCanonicalField(spec)?canonicalFieldManifest(spec,value).length:value.sourceManifest.length;assert.equal(count,previousCount);});
 const replyDependencies=currentKycReplyFeedbackDependenciesFor(spec.kind);
 if(replyDependencies.length)mutate('previous-reply-manifest-cannot-certify-delivery-reader','PROOF_SOURCE_MANIFEST',value=>{for(const file of replyDependencies)rewrite(value,file,{remove:true});const count=isCanonicalField(spec)?canonicalFieldManifest(spec,value).length:value.sourceManifest.length;assert.equal(count,spec.sourceFiles.length-replyDependencies.length);});
 checks.push(...organizationUsageClosureSelftest(spec,proof,root,validate));
 return checks;
}
function documentCurveCopySelftest(spec,proof,validate){
 if(!['UI_INTAKE','UI_PREPARATION','UI_PORTFOLIO','UI_JOINT','UI_CAUSAL'].includes(spec.kind))return [];
 const checks=[],bad=(name,edit)=>{const value=clone(proof);edit(value);assert.throws(()=>validate(value),error=>error.code==='PROOF_DOCUMENT_CURVE_COPY');checks.push({name:spec.id+'-document-copy-'+name,result:'PASS',expectedDenial:'PROOF_DOCUMENT_CURVE_COPY',boundary:'pure source/relocation shadow; no UI execution'});};
 bad('source-map-missing',p=>{delete p.documentCurveSourceManifest;});bad('source-map-substituted',p=>{p.documentCurveSourceManifest[1].path='src/lib/foreign-document-curve.mjs';});bad('source-map-stale',p=>{p.documentCurveSourceManifest[1].sha256='f'.repeat(64);});bad('source-map-duplicate',p=>{p.documentCurveSourceManifest[1]=clone(p.documentCurveSourceManifest[0]);});bad('relocation-missing',p=>{p.fixtureTransforms=[];});
 for(const key of ['sourceSha256','copiedBeforeSha256','fixtureSha256'])bad('relocation-'+key,p=>{p.fixtureTransforms[0][key]='f'.repeat(64);});bad('relocation-foreign-root',p=>{p.fixtureTransforms[0].fixtureRelativePath='../foreign.mjs';});bad('relocation-wrong-module',p=>{p.fixtureTransforms[0].dependencySourcePath='src/lib/foreign-document-curve.mjs';});bad('relocation-untracked-fields',p=>{p.fixtureTransforms[0].exactCopied=true;});
 if(proof.fixtureTransforms.length===2){bad('cyp-module-omitted',p=>{p.documentCurveSourceManifest=p.documentCurveSourceManifest.filter(row=>row.path!=='src/lib/plan-import-cyp-curve.mjs');});bad('second-relocation-omitted',p=>{p.fixtureTransforms.pop();});bad('relocations-reordered',p=>{p.fixtureTransforms.reverse();});for(const key of ['sourceSha256','copiedBeforeSha256','fixtureSha256'])bad('second-relocation-'+key,p=>{p.fixtureTransforms[1][key]='f'.repeat(64);});}
 return checks;
}
function monthlyCurveClosureSelftest(spec,proof,root,validate){
 const dependencies=monthlyCurveDependenciesFor(spec.kind),checks=[],prefix=spec.id+'-monthly-source-curve-';
 const good=(name,run)=>{run();checks.push({name:prefix+name,result:'PASS',boundary:'pure shadow proof; no PG/UI/provider execution'});};
 const mutate=(name,code,edit)=>{const value=clone(proof);edit(value);assert.throws(()=>validate(value),error=>error.code===code);checks.push({name:prefix+name,result:'PASS',expectedDenial:code,boundary:'pure shadow proof'});};
 good('additive-count-and-real-source-closure',()=>{assert.equal(spec.sourceFiles.length,currentOwnTemplateSourceCount(spec.kind,spec));equal(currentProducerSourceFiles(spec,root),spec.sourceFiles.toSorted(),'PROOF_SOURCE_MANIFEST');});
 for(const file of dependencies){
  good('source-pinned-'+file,()=>assert.ok(spec.sourceFiles.includes(file)));
  mutate('missing-source-'+file,'PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>ref.path!==file);});
  mutate('changed-source-hash-'+file,'PROOF_SOURCE_HASH',p=>{p.sourceManifest.find(ref=>ref.path===file).sha256='f'.repeat(64);});
  mutate('same-count-foreign-source-'+file,'PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest.find(ref=>ref.path===file).path='src/lib/foreign-monthly-source-curve.mjs';assert.equal(p.sourceManifest.length,currentOwnTemplateSourceCount(spec.kind,spec));});
 }
 mutate('previous-manifest-cannot-certify-v3','PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>![...currentPlanDependenciesFor(spec.kind),...participantPreanalysisProofSourceAdditions(spec),...officeAccountDependenciesFor(spec.kind),...currentKycStatusDependenciesFor(spec.kind),...companySubscriptionBackendDependenciesFor(spec.kind),...companySubscriptionFixtureDependenciesFor(spec.kind),...taskMeasurementDependenciesFor(spec.kind)].includes(ref.path));assert.equal(p.sourceManifest.length,OWN_TEMPLATE_SOURCE_COUNTS[spec.kind]);});
 return checks;
}
function organizationUsageClosureSelftest(spec,proof,root,validate){
  const dependencies=[...organizationUsageDependenciesFor(spec.kind),...proofFixtureDependenciesFor(spec.kind),...civilDataDependenciesFor(spec.kind),...companyKycCurrentSourceClosureDependenciesFor(spec.kind),...commercialAcceptanceDependenciesFor(spec.kind),...planBaselineDependenciesFor(spec.kind),...currentWhatsappFeedbackDependenciesFor(spec.kind),...planMeasurementCurrentDependencies(spec.kind),...participantPreanalysisProofSourceAdditions(spec)];if(!dependencies.length)return [];
 const previousCount=ORGANIZATION_USAGE_PREVIOUS_SOURCE_COUNTS[spec.kind]??CIVIL_PREVIOUS_SOURCE_COUNTS[spec.kind],checks=[],prefix=spec.id+'-organization-usage-';
 const good=(name,run)=>{run();checks.push({name:prefix+name,result:'PASS',boundary:'pure CURRENT source fixture; no PG/UI/provider execution'});};
 const mutate=(name,code,edit)=>{const value=clone(proof);edit(value);assert.throws(()=>validate(value),error=>error.code===code);checks.push({name:prefix+name,result:'PASS',expectedDenial:code,boundary:'pure adversarial CURRENT source fixture'});};
 const rewrite=(value,file,{remove=false,replacement=null,changedHash=false}={})=>{
  let changed=0;
  if(spec.kind==='PG_FIELD'){
   for(const map of [value.sourceSha256,value.voiceProgressSourceSha256,value.mediaLeaseSourceSha256,value.videoAudioSourceSha256,value.participantKycFixture.sourceSha256])if(Object.hasOwn(map,file)){
    const original=map[file];if(remove||replacement)delete map[file];if(replacement)map[replacement]=original;if(changedHash)map[file]='f'.repeat(64);changed++;
   }
  }else{
   const key=spec.kind==='PG_OVERTIME'?'file':'path';
   value.sourceManifest=value.sourceManifest.filter(ref=>{if(ref[key]!==file)return true;changed++;if(replacement)ref[key]=replacement;if(changedHash)ref.sha256='f'.repeat(64);return !remove;});
  }
  assert.ok(changed>0,'CURRENT organization usage source exists: '+file);
 };
 good('exact-additive-count-and-real-AST-closure',()=>{assert.equal(spec.sourceFiles.length,previousCount+dependencies.length);equal(currentProducerSourceFiles(spec,root),spec.sourceFiles.toSorted(),'PROOF_SOURCE_MANIFEST');});
  if(civilDataDependenciesFor(spec.kind).length+companyKycCurrentSourceClosureDependenciesFor(spec.kind).length)good('civil-current-count-and-closure-exact',()=>assert.equal(spec.sourceFiles.length,CIVIL_PREVIOUS_SOURCE_COUNTS[spec.kind]+civilDataDependenciesFor(spec.kind).length+companyKycCurrentSourceClosureDependenciesFor(spec.kind).length+commercialAcceptanceDependenciesFor(spec.kind).length+planBaselineDependenciesFor(spec.kind).length+currentWhatsappFeedbackDependenciesFor(spec.kind).length+planMeasurementCurrentDependencies(spec.kind).length+participantPreanalysisProofSourceAdditions(spec).length));
 for(const file of dependencies){
  good('source-pinned-once-'+file,()=>assert.equal(spec.sourceFiles.filter(source=>source===file).length,1));
  mutate('missing-source-'+file,'PROOF_SOURCE_MANIFEST',value=>rewrite(value,file,{remove:true}));
  mutate('changed-source-hash-'+file,'PROOF_SOURCE_HASH',value=>rewrite(value,file,{changedHash:true}));
  mutate('same-count-foreign-source-'+file,'PROOF_SOURCE_MANIFEST',value=>{rewrite(value,file,{replacement:'src/lib/foreign-organization-usage-source.mjs'});assert.equal(isCanonicalField(spec)?canonicalFieldManifest(spec,value).length:value.sourceManifest.length,previousCount+dependencies.length);});
 }
 mutate('previous-current-manifest-cannot-certify-usage','PROOF_SOURCE_MANIFEST',value=>{for(const file of dependencies)rewrite(value,file,{remove:true});assert.equal(isCanonicalField(spec)?canonicalFieldManifest(spec,value).length:value.sourceManifest.length,previousCount);});
 return checks;
}
function ownTemplateClosureSelftest(spec,proof,root,validate){
 const dependencies=ownTemplateDependenciesFor(spec.kind);if(!dependencies.length)return [];
 const checks=[],prefix=spec.id+'-own-template-';
 const good=(name,run)=>{run();checks.push({name:prefix+name,result:'PASS',boundary:'pure shadow fixture, no Git/PG/UI/provider execution'});};
 const mutate=(name,code,edit)=>{const value=clone(proof);edit(value);assert.throws(()=>validate(value),error=>error.code===code);checks.push({name:prefix+name,result:'PASS',expectedDenial:code,boundary:'pure shadow fixture'});};
 good('current-exact-count-and-real-producer-closure',()=>{assert.equal(spec.sourceFiles.length,currentOwnTemplateSourceCount(spec.kind,spec));equal(currentProducerSourceFiles(spec,root),spec.sourceFiles.toSorted(),'PROOF_SOURCE_MANIFEST');});
 for(const file of dependencies){
  good('current-source-pinned-'+file,()=>assert.ok(spec.sourceFiles.includes(file)));
  mutate('missing-source-'+file,'PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>ref.path!==file);});
  mutate('changed-source-hash-'+file,'PROOF_SOURCE_HASH',p=>{p.sourceManifest.find(ref=>ref.path===file).sha256='f'.repeat(64);});
  mutate('same-count-foreign-source-'+file,'PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest.find(ref=>ref.path===file).path='src/lib/foreign-own-template-source.mjs';assert.equal(p.sourceManifest.length,currentOwnTemplateSourceCount(spec.kind,spec));});
 }
 mutate('previous-manifest-cannot-certify-current-source','PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest=p.sourceManifest.filter(ref=>!dependencies.includes(ref.path));assert.equal(p.sourceManifest.length,currentOwnTemplateSourceCount(spec.kind,spec)-dependencies.length);});
 return checks;
}
function taskMeasurementProofClosureSelftest(spec,proof,root,validate){
 const dependencies=taskMeasurementDependenciesFor(spec.kind),checks=[],prefix=spec.id+'-task-measurement-';if(!dependencies.length)return checks;
 const good=(name,run)=>{run();checks.push({name:prefix+name,result:'PASS',boundary:'pure current source proof; no PG/UI/provider execution'});};
 const mutate=(name,code,edit)=>{const value=clone(proof);edit(value);assert.throws(()=>validate(value),error=>error.code===code);checks.push({name:prefix+name,result:'PASS',expectedDenial:code,boundary:'pure adversarial current source proof'});};
 const rewrite=(value,file,{remove=false,replacement=null,changedHash=false}={})=>{
  let changed=0;
  if(spec.kind==='PG_FIELD'){
   for(const map of [value.sourceSha256,value.voiceProgressSourceSha256,value.mediaLeaseSourceSha256,value.videoAudioSourceSha256,value.participantKycFixture.sourceSha256])if(Object.hasOwn(map,file)){const previous=map[file];if(remove||replacement)delete map[file];if(replacement)map[replacement]=previous;if(changedHash)map[file]='f'.repeat(64);changed++;}
  }else{const key=spec.kind==='PG_OVERTIME'?'file':'path';value.sourceManifest=value.sourceManifest.filter(ref=>{if(ref[key]!==file)return true;changed++;if(replacement)ref[key]=replacement;if(changedHash)ref.sha256='f'.repeat(64);return !remove;});}
  assert.ok(changed>0,'Current task measurement source exists in proof: '+file);
 };
 good('exact-current-producer-closure',()=>equal(currentProducerSourceFiles(spec,root),spec.sourceFiles.toSorted(),'PROOF_SOURCE_MANIFEST'));
 for(const file of dependencies){
  good('source-pinned-once-'+file,()=>assert.equal(spec.sourceFiles.filter(source=>source===file).length,1));
  mutate('missing-source-'+file,'PROOF_SOURCE_MANIFEST',value=>rewrite(value,file,{remove:true}));
  mutate('changed-source-hash-'+file,'PROOF_SOURCE_HASH',value=>rewrite(value,file,{changedHash:true}));
  mutate('same-count-foreign-source-'+file,'PROOF_SOURCE_MANIFEST',value=>rewrite(value,file,{replacement:'src/lib/foreign-task-measurement.mjs'}));
 }
 return checks;
}
function whatsappPlanImportClosureSelftest(spec,proof,root,validate){
 const dependencies=whatsappPlanImportDependenciesFor(spec.kind),subscriptionDependencies=[...companySubscriptionBackendDependenciesFor(spec.kind),...taskMeasurementDependenciesFor(spec.kind),...currentKycReplyFeedbackDependenciesFor(spec.kind),...organizationUsageDependenciesFor(spec.kind),...proofFixtureDependenciesFor(spec.kind),...civilDataDependenciesFor(spec.kind),...companyKycCurrentSourceClosureDependenciesFor(spec.kind),...planBaselineDependenciesFor(spec.kind),...currentWhatsappFeedbackDependenciesFor(spec.kind),...planMeasurementCurrentDependencies(spec.kind),...participantPreanalysisProofSourceAdditions(spec)],previousCount=WHATSAPP_PLAN_IMPORT_PREVIOUS_SOURCE_COUNTS[spec.kind],checks=[],prefix=spec.id+'-whatsapp-plan-import-';
 const good=(name,run)=>{run();checks.push({name:prefix+name,result:'PASS',boundary:'pure current source proof; no PG/UI/provider execution'});};
 const mutate=(name,code,edit)=>{const value=clone(proof);edit(value);assert.throws(()=>validate(value),error=>error.code===code);checks.push({name:prefix+name,result:'PASS',expectedDenial:code,boundary:'pure adversarial current source proof'});};
 const rewrite=(value,file,{remove=false,replacement=null,changedHash=false}={})=>{
  let changed=0;
  if(spec.kind==='PG_FIELD'){
   for(const map of [value.sourceSha256,value.voiceProgressSourceSha256,value.mediaLeaseSourceSha256,value.videoAudioSourceSha256,value.participantKycFixture.sourceSha256])if(Object.hasOwn(map,file)){
    const original=map[file];if(remove||replacement)delete map[file];if(replacement)map[replacement]=original;if(changedHash)map[file]='f'.repeat(64);changed++;
   }
  }else{
   const key=spec.kind==='PG_OVERTIME'?'file':'path';
   value.sourceManifest=value.sourceManifest.filter(ref=>{if(ref[key]!==file)return true;changed++;if(replacement)ref[key]=replacement;if(changedHash)ref.sha256='f'.repeat(64);return !remove;});
  }
  assert.ok(changed>0,'WhatsApp plan source exists in shadow proof: '+file);
 };
 good('exact-additive-count-and-real-producer-closure',()=>{assert.equal(spec.sourceFiles.length,previousCount+dependencies.length+subscriptionDependencies.length);equal(currentProducerSourceFiles(spec,root),spec.sourceFiles.toSorted(),'PROOF_SOURCE_MANIFEST');});
 for(const file of dependencies){
  good('source-pinned-once-'+file,()=>assert.equal(spec.sourceFiles.filter(source=>source===file).length,1));
  mutate('missing-source-'+file,'PROOF_SOURCE_MANIFEST',p=>rewrite(p,file,{remove:true}));
  mutate('changed-source-hash-'+file,'PROOF_SOURCE_HASH',p=>rewrite(p,file,{changedHash:true}));
  mutate('same-count-foreign-source-'+file,'PROOF_SOURCE_MANIFEST',p=>{rewrite(p,file,{replacement:'src/lib/foreign-whatsapp-plan-import.mjs'});assert.equal(isCanonicalField(spec)?canonicalFieldManifest(spec,p).length:p.sourceManifest.length,previousCount+dependencies.length+subscriptionDependencies.length);});
 }
 mutate('previous-current-manifest-cannot-certify-whatsapp-import','PROOF_SOURCE_MANIFEST',p=>{for(const file of [...dependencies,...subscriptionDependencies])rewrite(p,file,{remove:true});assert.equal(isCanonicalField(spec)?canonicalFieldManifest(spec,p).length:p.sourceManifest.length,previousCount);});
 return checks;
}
return {companyKycCurrentSourceClosureSelftest,companySubscriptionProofClosureSelftest,currentKycStatusClosureSelftest,documentCurveCopySelftest,monthlyCurveClosureSelftest,organizationUsageClosureSelftest,ownTemplateClosureSelftest,taskMeasurementProofClosureSelftest,whatsappPlanImportClosureSelftest};
}

// Only declared synthetic native fixtures use this checkpoint boundary. Actual
// collectors, aggregate inputs and current native proof verification stay current.
function runCaptureNativeFixtureIteration(actualContract,actualRead,currentSpec,root,queues,run,actualPorts){
 assert.equal(typeof actualRead,'function');
 // The old FIELD shadow uses a local buffer cache. It must never supply the
 // new authority boundary: obtain fresh physical text for every scope read.
 const readCurrentPhysical=file=>{const value=readFileSync(path.join(root,sourcePath(file))),text=value.toString('utf8');assert.ok(value.equals(Buffer.from(text)));return Buffer.from(text.replaceAll('\r\n','\n'));};
 const start=queues.map(queue=>queue.length),checks=actualPorts.checks,checkStart=checks.length,currentCollectorName=actualPorts.currentCollectorName;
 const mark=rows=>rows.map(row=>row.name===currentCollectorName?row:{...row,checkpoint:'literal Git731 synthetic native fixture'});
 return captureBudget.withCaptureRuntimePreviousSources(actualContract,readCurrentPhysical,(parent,parentRead)=>{
  assert.equal(hash(JSON.stringify(parent,null,2)+'\n'),'d5ef59b111dd3e25b8f08854d3e8e4df4838a7913e3e22b76299c1916b9913d2');
  const parentJson=JSON.stringify(parent),parentSpec=parent.extension.proofs.find(row=>row.id===currentSpec.id),advance=actualContract.planBudgetCurrentRevision.captureQualityRuntime.proofSourceSetAdvances.find(row=>row.kind===currentSpec.kind);
  assert.ok(parentSpec&&advance);equal(parentSpec.sourceFiles,advance.previousFiles,'PROOF_SOURCE_MANIFEST');equal(currentSpec.sourceFiles,advance.currentFiles,'PROOF_SOURCE_MANIFEST');
  const fixtureReadFileSync=(filename,options)=>{
   assert.equal(typeof filename,'string');const absolute=path.resolve(filename),relative=path.relative(root,absolute).split(path.sep).join('/');sourcePath(relative);assert.ok(absolute.startsWith(path.resolve(root)+path.sep));
   const value=parentRead(relative);assert.ok(Buffer.isBuffer(value));const encoding=typeof options==='string'?options:options?.encoding;return encoding?value.toString(encoding):Buffer.from(value);
  };
  const fixtureCollector=(spec,sourceRoot)=>{
   assert.equal(path.resolve(sourceRoot),path.resolve(root));equal(spec,parentSpec,'PROOF_SOURCE_MANIFEST');
   // Derive the physical current graph independently first; only its exact
   // authenticated additive set may project to the literal checkpoint graph.
   const files=currentProducerSourceFiles(currentSpec,root);equal(files,advance.currentFiles,'PROOF_SOURCE_MANIFEST');return [...advance.previousFiles];
  };
  const ports={...actualPorts,...captureNativeFixtureSelftestHelpers(fixtureReadFileSync,fixtureCollector),validateExtensionProof:validatePreviousExtensionProof,currentProducerSourceFiles:fixtureCollector};
  const result=run(parentSpec,parent,parentRead,ports);assert.ok(!result||typeof result.then!=='function','Synthetic fixture iteration must remain synchronous');
  for(let index=checkStart;index<checks.length;index++)checks[index]=mark([checks[index]])[0];
  for(const[index,queue]of queues.entries())for(let at=start[index];at<queue.length;at++)if(typeof queue[at]==='function'){
   const callback=queue[at];queue[at]=()=>captureBudget.withCaptureRuntimePreviousSources(actualContract,readCurrentPhysical,()=>{
    assert.equal(JSON.stringify(parent),parentJson,'The owned fixture parent must remain unchanged');
    try{const value=callback();assert.ok(!value||typeof value.then!=='function','Deferred fixture callback must remain synchronous');return Array.isArray(value)?mark(value):value;}
    finally{assert.equal(JSON.stringify(parent),parentJson,'The owned fixture parent must remain unchanged');}
   });
  }
  return result;
 });
}
