import {PLAN_BUDGET_CURRENT_SECTION,restorePlanBudgetPreviousContract,restorePlanBudgetSourceSet} from './plan-budget-current-ci-lineage.mjs';
import {WORKSITE_LIVE_HOURS_CURRENT_SECTION,restoreWorksiteLiveHoursSourceSet as worksiteSourceSet0} from './worksite-live-hours-current-ci-lineage.mjs';
import {restoreMaterialReviewPreviousContract as materialOuter0,materialReviewCurrentSourcePin as materialOuter1,verifyMaterialReviewCurrentSources as materialOuter2,materialReviewValidationFiles as materialOuter3,restoreMaterialReviewSourceSet as materialOuter4,materialReviewProofSourceAdditions as materialOuter5} from './material-review-current-ci-lineage.mjs';
import {existingApiPlanCurrentNativeSourceFiles as planNative0,existingApiPlanNativeSourceFilesFromReader as planNative1} from './meta-existing-api-plan-current-ci-lineage.mjs';
function materialOuterCall(fn,args){try{return fn(...args);}catch(error){if(['MATERIAL_REVIEW_CURRENT_CI_LINEAGE_REJECTED','EXISTING_API_PLAN_CURRENT_CI_LINEAGE_REJECTED','WORKSITE_LIVE_HOURS_CURRENT_CI_LINEAGE_REJECTED'].includes(error.code))throw Object.assign(new Error(error.message),{code:'WHATSAPP_FIELD_CONTINUITY_CURRENT_CI_LINEAGE_REJECTED'});throw error;}}
const restoreWorksiteLiveHoursSourceSet=(...args)=>materialOuterCall(worksiteSourceSet0,args);
const existingApiPlanCurrentNativeSourceFiles=(...args)=>materialOuterCall(planNative0,args);
const existingApiPlanNativeSourceFilesFromReader=(...args)=>materialOuterCall(planNative1,args);
const restoreMaterialReviewPreviousContract=(...args)=>materialOuterCall(materialOuter0,args);
const materialReviewCurrentSourcePin=(...args)=>materialOuterCall(materialOuter1,args);
const verifyMaterialReviewCurrentSources=(...args)=>materialOuterCall(materialOuter2,args);
const materialReviewValidationFiles=(...args)=>materialOuterCall(materialOuter3,args);
const restoreMaterialReviewSourceSet=(...args)=>materialOuterCall(materialOuter4,args);
const materialReviewProofSourceAdditions=(...args)=>materialOuterCall(materialOuter5,args);
import {createHash} from 'node:crypto';
import {parse} from '@babel/parser';
import checkpoint from '../../tests/fixtures/whatsapp-field-continuity-contract-052.json' with {type:'json'};

export const WHATSAPP_FIELD_CONTINUITY_SECTION='whatsappFieldContinuityCurrentRevision';
export const WHATSAPP_FIELD_CONTINUITY_CONTRACT_PATH='.github/workspace-acceptance-contract.json';
export const WHATSAPP_FIELD_CONTINUITY_CHECKPOINT_PATH='tests/fixtures/whatsapp-field-continuity-contract-052.json';
export const WHATSAPP_FIELD_CONTINUITY_HELPER_PATH='scripts/lib/whatsapp-field-continuity-current-ci-lineage.mjs';
export const WHATSAPP_FIELD_CONTINUITY_TEST_PATH='tests/production-whatsapp-field-continuity-current-ci-lineage.test.mjs';
export const WHATSAPP_FIELD_CONTINUITY_PREVIOUS_CONTRACT_SHA256='f7a72979af7b789d92333d4f631d6bbbccf247c5c04ce6edd88f64f70b6099bb';
const sha=value=>createHash('sha256').update(value).digest('hex');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const plain=value=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const safe=value=>typeof value==='string'&&(value==='.gitattributes'||/^(?:src|scripts|tests|\.github)\//.test(value))&&!value.includes('..')&&!value.includes('\\')&&!/[\x00-\x1f]/.test(value);
const requireLineage=(ok,message)=>{if(!ok)throw Object.assign(new Error(message),{code:'WHATSAPP_FIELD_CONTINUITY_CURRENT_CI_LINEAGE_REJECTED'});};
const exactKeys=(value,keys,label)=>requireLineage(plain(value)&&same(Object.keys(value).sort(),[...keys].sort()),label);
function deepFreeze(value){if(value&&typeof value==='object'){for(const child of Object.values(value))deepFreeze(child);Object.freeze(value);}return value;}
deepFreeze(checkpoint);
requireLineage(sha(JSON.stringify(checkpoint,null,2)+'\n')===WHATSAPP_FIELD_CONTINUITY_PREVIOUS_CONTRACT_SHA256,'Complete published 052 checkpoint required');

// PENDING is deliberately unusable. Final source and observation matrices are
// bound only after their owners freeze the complete current producers.
export const WHATSAPP_FIELD_CONTINUITY_FOCUSED_UI=deepFreeze({
  "status": "REVIEWED_FROZEN_CURRENT_SOURCE",
  "ciVersion": "focused-workspace-ci-v3",
  "rawVersion": 4,
  "previousRawVersion": 2,
  "previousCheckCount": 20,
  "previousTotalCheckCount": 45,
  "previousCheckNames": [
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
    "three-step-synthetic-identity-explicit-consents-and-unknown-receipt-survive-navigation-1440",
    "fresh-list-project-preserves-section-no-POST-320",
    "fresh-list-project-preserves-section-no-POST-390",
    "fresh-list-project-preserves-section-no-POST-1440",
    "refresh-does-not-restore-old-view-list-role-390",
    "refresh-does-not-restore-old-view-list-scope-390",
    "refresh-does-not-restore-old-view-list-missing-390",
    "refresh-does-not-restore-old-view-list-401-390",
    "refresh-does-not-restore-old-view-list-403-390",
    "refresh-does-not-restore-old-view-list-500-390",
    "refresh-does-not-restore-old-view-project-401-390",
    "refresh-does-not-restore-old-view-project-403-390",
    "refresh-does-not-restore-old-view-project-500-390",
    "refresh-does-not-restore-old-view-project-scope-390",
    "refresh-does-not-restore-old-view-project-id-390",
    "refresh-does-not-restore-old-view-project-null-390",
    "refresh-truncated-list-promotes-fresh-canonical-project-390",
    "refresh-truncated-list-denial-keeps-old-view-closed-390",
    "refresh-truncated-list-inactive-project-keeps-old-view-closed-390",
    "refresh-private-KYC-denial-keeps-only-private-presentation-390",
    "refresh-office-selection-uses-fresh-listed-context-without-operational-GET-390",
    "refresh-late-list-cannot-reenter-rotated-session-390",
    "refresh-late-project-cannot-reenter-unmounted-workspace-390",
    "bootstrap-ready-receipt-compact-disclosure-trial-no-POST-320",
    "bootstrap-ready-receipt-compact-disclosure-trial-no-POST-390",
    "bootstrap-ready-receipt-compact-disclosure-trial-no-POST-1440"
  ],
  "checkNames": [
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
    "three-step-synthetic-identity-explicit-consents-and-unknown-receipt-survive-navigation-1440",
    "fresh-list-project-preserves-section-no-POST-320",
    "fresh-list-project-preserves-section-no-POST-390",
    "fresh-list-project-preserves-section-no-POST-1440",
    "refresh-does-not-restore-old-view-list-role-390",
    "refresh-does-not-restore-old-view-list-scope-390",
    "refresh-does-not-restore-old-view-list-missing-390",
    "refresh-does-not-restore-old-view-list-401-390",
    "refresh-does-not-restore-old-view-list-403-390",
    "refresh-does-not-restore-old-view-list-500-390",
    "refresh-does-not-restore-old-view-project-401-390",
    "refresh-does-not-restore-old-view-project-403-390",
    "refresh-does-not-restore-old-view-project-500-390",
    "refresh-does-not-restore-old-view-project-scope-390",
    "refresh-does-not-restore-old-view-project-id-390",
    "refresh-does-not-restore-old-view-project-null-390",
    "refresh-truncated-list-promotes-fresh-canonical-project-390",
    "refresh-truncated-list-denial-keeps-old-view-closed-390",
    "refresh-truncated-list-inactive-project-keeps-old-view-closed-390",
    "refresh-private-KYC-denial-keeps-only-private-presentation-390",
    "refresh-office-selection-uses-fresh-listed-context-without-operational-GET-390",
    "refresh-late-list-cannot-reenter-rotated-session-390",
    "refresh-late-project-cannot-reenter-unmounted-workspace-390",
    "bootstrap-ready-receipt-compact-disclosure-trial-no-POST-320",
    "bootstrap-ready-receipt-compact-disclosure-trial-no-POST-390",
    "bootstrap-ready-receipt-compact-disclosure-trial-no-POST-1440",
    "account-task-pages-draft-100-200-205-single-GET-field-320",
    "account-task-pages-draft-100-200-205-single-GET-inventory-320",
    "account-task-pages-draft-100-200-205-single-GET-field-390",
    "account-task-pages-draft-100-200-205-single-GET-inventory-390",
    "account-task-pages-draft-100-200-205-single-GET-field-1440",
    "account-task-pages-draft-100-200-205-single-GET-inventory-1440",
    "account-task-pages-503-retry-field-390",
    "account-task-pages-403-clear-field-390",
    "account-task-pages-busy-uncertain-and-late-page-field-390",
    "account-task-pages-503-retry-inventory-390",
    "account-task-pages-403-clear-inventory-390",
    "account-task-pages-busy-uncertain-and-late-page-inventory-390",
    "account-task-pages-404-revoked-clear-field-390",
    "account-task-pages-404-revoked-clear-inventory-390"
  ],
  "continuityCheckNames": [
    "fresh-list-project-preserves-section-no-POST-320",
    "fresh-list-project-preserves-section-no-POST-390",
    "fresh-list-project-preserves-section-no-POST-1440",
    "refresh-does-not-restore-old-view-list-role-390",
    "refresh-does-not-restore-old-view-list-scope-390",
    "refresh-does-not-restore-old-view-list-missing-390",
    "refresh-does-not-restore-old-view-list-401-390",
    "refresh-does-not-restore-old-view-list-403-390",
    "refresh-does-not-restore-old-view-list-500-390",
    "refresh-does-not-restore-old-view-project-401-390",
    "refresh-does-not-restore-old-view-project-403-390",
    "refresh-does-not-restore-old-view-project-500-390",
    "refresh-does-not-restore-old-view-project-scope-390",
    "refresh-does-not-restore-old-view-project-id-390",
    "refresh-does-not-restore-old-view-project-null-390",
    "refresh-truncated-list-promotes-fresh-canonical-project-390",
    "refresh-truncated-list-denial-keeps-old-view-closed-390",
    "refresh-truncated-list-inactive-project-keeps-old-view-closed-390",
    "refresh-private-KYC-denial-keeps-only-private-presentation-390",
    "refresh-office-selection-uses-fresh-listed-context-without-operational-GET-390",
    "refresh-late-list-cannot-reenter-rotated-session-390",
    "refresh-late-project-cannot-reenter-unmounted-workspace-390",
    "bootstrap-ready-receipt-compact-disclosure-trial-no-POST-320",
    "bootstrap-ready-receipt-compact-disclosure-trial-no-POST-390",
    "bootstrap-ready-receipt-compact-disclosure-trial-no-POST-1440"
  ],
  "taskPagingCheckNames": [
    "account-task-pages-draft-100-200-205-single-GET-field-320",
    "account-task-pages-draft-100-200-205-single-GET-inventory-320",
    "account-task-pages-draft-100-200-205-single-GET-field-390",
    "account-task-pages-draft-100-200-205-single-GET-inventory-390",
    "account-task-pages-draft-100-200-205-single-GET-field-1440",
    "account-task-pages-draft-100-200-205-single-GET-inventory-1440",
    "account-task-pages-503-retry-field-390",
    "account-task-pages-403-clear-field-390",
    "account-task-pages-busy-uncertain-and-late-page-field-390",
    "account-task-pages-503-retry-inventory-390",
    "account-task-pages-403-clear-inventory-390",
    "account-task-pages-busy-uncertain-and-late-page-inventory-390",
    "account-task-pages-404-revoked-clear-field-390",
    "account-task-pages-404-revoked-clear-inventory-390"
  ],
  "widths": [
    390,
    1440
  ],
  "continuityWidths": [
    320,
    390,
    1440
  ],
  "taskPagingWidths": [
    320,
    390,
    1440
  ],
  "previousUnitFiles": [
    "tests/production-focused-workspace-navigation.test.mjs",
    "tests/production-focused-workspace-ui.test.mjs",
    "tests/production-focused-workspace-ci.test.mjs"
  ],
  "continuityUnitFiles": [
    "tests/production-focused-workspace-navigation.test.mjs",
    "tests/production-focused-workspace-ui.test.mjs",
    "tests/production-focused-workspace-ci.test.mjs",
    "tests/production-focused-workspace-continuity-ui.test.mjs",
    "tests/production-company-bootstrap-receipt.test.mjs"
  ],
  "unitFiles": [
    "tests/production-focused-workspace-navigation.test.mjs",
    "tests/production-focused-workspace-ui.test.mjs",
    "tests/production-focused-workspace-ci.test.mjs",
    "tests/production-focused-workspace-continuity-ui.test.mjs",
    "tests/production-company-bootstrap-receipt.test.mjs",
    "tests/production-focused-workspace-task-pagination.test.mjs"
  ],
  "requestMatrix": [
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/project-preparation",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/project-creation",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/office-review",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/project-preparation",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/project-creation",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/office-review",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/project-preparation",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/project-creation",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/office-review",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/project-preparation",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/project-creation",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/office-review",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/participants",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/project-preparation",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/project-creation",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/office-review",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 390,
      "role": "AUDITOR",
      "mode": "navigation",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null
    },
    {
      "width": 390,
      "role": "AUDITOR",
      "mode": "navigation",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/project-preparation",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/project-creation",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/office-review",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/participants",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 390,
      "role": "AUDITOR",
      "mode": "navigation",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null
    },
    {
      "width": 390,
      "role": "AUDITOR",
      "mode": "navigation",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "company-without-selection",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "company-without-selection",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "company-without-selection",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "empty-company",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "empty-company",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "empty-company",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "wizard",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "wizard",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "wizard",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "wizard",
      "path": "/api/identity/project-preparation",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "wizard",
      "path": "/api/identity/project-creation",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "wizard",
      "path": "/api/identity/office-review",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "wizard",
      "path": "/api/identity/participants",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "wizard",
      "path": "/api/identity/participants",
      "method": "POST",
      "projectId": "project-a",
      "explicitFinalStep": true,
      "actualRecoveryJournalReferencePreserved": true
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/project-preparation",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/project-creation",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/office-review",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/project-preparation",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/project-creation",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/office-review",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/participants",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/project-preparation",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/project-creation",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/office-review",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 1440,
      "role": "AUDITOR",
      "mode": "navigation",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null
    },
    {
      "width": 1440,
      "role": "AUDITOR",
      "mode": "navigation",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/project-preparation",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/project-creation",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/office-review",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "navigation",
      "path": "/api/identity/participants",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 1440,
      "role": "AUDITOR",
      "mode": "navigation",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null
    },
    {
      "width": 1440,
      "role": "AUDITOR",
      "mode": "navigation",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "company-without-selection",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "company-without-selection",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "company-without-selection",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "empty-company",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "empty-company",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "empty-company",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "wizard",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "wizard",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "wizard",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "wizard",
      "path": "/api/identity/project-preparation",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "wizard",
      "path": "/api/identity/project-creation",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "wizard",
      "path": "/api/identity/office-review",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "wizard",
      "path": "/api/identity/participants",
      "method": "GET",
      "projectId": "project-a"
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "wizard",
      "path": "/api/identity/participants",
      "method": "POST",
      "projectId": "project-a",
      "explicitFinalStep": true,
      "actualRecoveryJournalReferencePreserved": true
    },
    {
      "width": 320,
      "role": "ADMIN",
      "mode": "continuity-success",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "phase": 0,
      "responseStatus": 200
    },
    {
      "width": 320,
      "role": "ADMIN",
      "mode": "continuity-success",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 200
    },
    {
      "width": 320,
      "role": "ADMIN",
      "mode": "continuity-success",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null,
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 320,
      "role": "ADMIN",
      "mode": "continuity-success",
      "path": "/api/identity/project-preparation",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 320,
      "role": "ADMIN",
      "mode": "continuity-success",
      "path": "/api/identity/project-creation",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 320,
      "role": "ADMIN",
      "mode": "continuity-success",
      "path": "/api/identity/office-review",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 320,
      "role": "ADMIN",
      "mode": "continuity-success",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "phase": 1,
      "responseStatus": 200
    },
    {
      "width": 320,
      "role": "ADMIN",
      "mode": "continuity-success",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "phase": 1,
      "responseStatus": 200
    },
    {
      "width": 320,
      "role": "ADMIN",
      "mode": "continuity-success",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null,
      "phase": 1,
      "responseStatus": 403
    },
    {
      "width": 320,
      "role": "ADMIN",
      "mode": "continuity-success",
      "path": "/api/identity/project-preparation",
      "method": "GET",
      "projectId": "project-a",
      "phase": 1,
      "responseStatus": 403
    },
    {
      "width": 320,
      "role": "ADMIN",
      "mode": "continuity-success",
      "path": "/api/identity/project-creation",
      "method": "GET",
      "projectId": "project-a",
      "phase": 1,
      "responseStatus": 403
    },
    {
      "width": 320,
      "role": "ADMIN",
      "mode": "continuity-success",
      "path": "/api/identity/office-review",
      "method": "GET",
      "projectId": "project-a",
      "phase": 1,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-success",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "phase": 0,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-success",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-success",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null,
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-success",
      "path": "/api/identity/project-preparation",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-success",
      "path": "/api/identity/project-creation",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-success",
      "path": "/api/identity/office-review",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-success",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "phase": 1,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-success",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "phase": 1,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-success",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null,
      "phase": 1,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-success",
      "path": "/api/identity/project-preparation",
      "method": "GET",
      "projectId": "project-a",
      "phase": 1,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-success",
      "path": "/api/identity/project-creation",
      "method": "GET",
      "projectId": "project-a",
      "phase": 1,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-success",
      "path": "/api/identity/office-review",
      "method": "GET",
      "projectId": "project-a",
      "phase": 1,
      "responseStatus": 403
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "continuity-success",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "phase": 0,
      "responseStatus": 200
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "continuity-success",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 200
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "continuity-success",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null,
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "continuity-success",
      "path": "/api/identity/project-preparation",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "continuity-success",
      "path": "/api/identity/project-creation",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "continuity-success",
      "path": "/api/identity/office-review",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "continuity-success",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "phase": 1,
      "responseStatus": 200
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "continuity-success",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "phase": 1,
      "responseStatus": 200
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "continuity-success",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null,
      "phase": 1,
      "responseStatus": 403
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "continuity-success",
      "path": "/api/identity/project-preparation",
      "method": "GET",
      "projectId": "project-a",
      "phase": 1,
      "responseStatus": 403
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "continuity-success",
      "path": "/api/identity/project-creation",
      "method": "GET",
      "projectId": "project-a",
      "phase": 1,
      "responseStatus": 403
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "continuity-success",
      "path": "/api/identity/office-review",
      "method": "GET",
      "projectId": "project-a",
      "phase": 1,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-list-role",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "phase": 0,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-list-role",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-list-role",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null,
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-list-role",
      "path": "/api/identity/project-preparation",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-list-role",
      "path": "/api/identity/project-creation",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-list-role",
      "path": "/api/identity/office-review",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-list-role",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "phase": 1,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-list-scope",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "phase": 0,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-list-scope",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-list-scope",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null,
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-list-scope",
      "path": "/api/identity/project-preparation",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-list-scope",
      "path": "/api/identity/project-creation",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-list-scope",
      "path": "/api/identity/office-review",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-list-scope",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "phase": 1,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-list-scope",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null,
      "phase": 1,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-list-missing",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "phase": 0,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-list-missing",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-list-missing",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null,
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-list-missing",
      "path": "/api/identity/project-preparation",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-list-missing",
      "path": "/api/identity/project-creation",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-list-missing",
      "path": "/api/identity/office-review",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-list-missing",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "phase": 1,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-list-missing",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null,
      "phase": 1,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-list-401",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "phase": 0,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-list-401",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-list-401",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null,
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-list-401",
      "path": "/api/identity/project-preparation",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-list-401",
      "path": "/api/identity/project-creation",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-list-401",
      "path": "/api/identity/office-review",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-list-401",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "phase": 1,
      "responseStatus": 401
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-list-403",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "phase": 0,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-list-403",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-list-403",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null,
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-list-403",
      "path": "/api/identity/project-preparation",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-list-403",
      "path": "/api/identity/project-creation",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-list-403",
      "path": "/api/identity/office-review",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-list-403",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "phase": 1,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-list-500",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "phase": 0,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-list-500",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-list-500",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null,
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-list-500",
      "path": "/api/identity/project-preparation",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-list-500",
      "path": "/api/identity/project-creation",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-list-500",
      "path": "/api/identity/office-review",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-list-500",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "phase": 1,
      "responseStatus": 500
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-project-401",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "phase": 0,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-project-401",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-project-401",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null,
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-project-401",
      "path": "/api/identity/project-preparation",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-project-401",
      "path": "/api/identity/project-creation",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-project-401",
      "path": "/api/identity/office-review",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-project-401",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "phase": 1,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-project-401",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "phase": 1,
      "responseStatus": 401
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-project-401",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null,
      "phase": 1,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-project-403",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "phase": 0,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-project-403",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-project-403",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null,
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-project-403",
      "path": "/api/identity/project-preparation",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-project-403",
      "path": "/api/identity/project-creation",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-project-403",
      "path": "/api/identity/office-review",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-project-403",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "phase": 1,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-project-403",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "phase": 1,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-project-403",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null,
      "phase": 1,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-project-500",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "phase": 0,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-project-500",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-project-500",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null,
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-project-500",
      "path": "/api/identity/project-preparation",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-project-500",
      "path": "/api/identity/project-creation",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-project-500",
      "path": "/api/identity/office-review",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-project-500",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "phase": 1,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-project-500",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "phase": 1,
      "responseStatus": 500
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-project-500",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null,
      "phase": 1,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-project-scope",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "phase": 0,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-project-scope",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-project-scope",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null,
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-project-scope",
      "path": "/api/identity/project-preparation",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-project-scope",
      "path": "/api/identity/project-creation",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-project-scope",
      "path": "/api/identity/office-review",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-project-scope",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "phase": 1,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-project-scope",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "phase": 1,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-project-scope",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null,
      "phase": 1,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-project-id",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "phase": 0,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-project-id",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-project-id",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null,
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-project-id",
      "path": "/api/identity/project-preparation",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-project-id",
      "path": "/api/identity/project-creation",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-project-id",
      "path": "/api/identity/office-review",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-project-id",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "phase": 1,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-project-id",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "phase": 1,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-project-id",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null,
      "phase": 1,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-project-null",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "phase": 0,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-project-null",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-project-null",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null,
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-project-null",
      "path": "/api/identity/project-preparation",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-project-null",
      "path": "/api/identity/project-creation",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-project-null",
      "path": "/api/identity/office-review",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-project-null",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "phase": 1,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-project-null",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "phase": 1,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-project-null",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null,
      "phase": 1,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-truncated-success",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "phase": 0,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-truncated-success",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-truncated-success",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null,
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-truncated-success",
      "path": "/api/identity/project-preparation",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-truncated-success",
      "path": "/api/identity/project-creation",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-truncated-success",
      "path": "/api/identity/office-review",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-truncated-success",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "phase": 1,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-truncated-success",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "phase": 1,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-truncated-success",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null,
      "phase": 1,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-truncated-success",
      "path": "/api/identity/project-preparation",
      "method": "GET",
      "projectId": "project-a",
      "phase": 1,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-truncated-success",
      "path": "/api/identity/project-creation",
      "method": "GET",
      "projectId": "project-a",
      "phase": 1,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-truncated-success",
      "path": "/api/identity/office-review",
      "method": "GET",
      "projectId": "project-a",
      "phase": 1,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-truncated-denied",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "phase": 0,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-truncated-denied",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-truncated-denied",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null,
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-truncated-denied",
      "path": "/api/identity/project-preparation",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-truncated-denied",
      "path": "/api/identity/project-creation",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-truncated-denied",
      "path": "/api/identity/office-review",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-truncated-denied",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "phase": 1,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-truncated-denied",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "phase": 1,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-truncated-denied",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null,
      "phase": 1,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-truncated-inactive",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "phase": 0,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-truncated-inactive",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-truncated-inactive",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null,
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-truncated-inactive",
      "path": "/api/identity/project-preparation",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-truncated-inactive",
      "path": "/api/identity/project-creation",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-truncated-inactive",
      "path": "/api/identity/office-review",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-truncated-inactive",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "phase": 1,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-truncated-inactive",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "phase": 1,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-truncated-inactive",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null,
      "phase": 1,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-private-kyc",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "phase": 0,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-private-kyc",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-private-kyc",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null,
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-private-kyc",
      "path": "/api/identity/project-preparation",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-private-kyc",
      "path": "/api/identity/project-creation",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-private-kyc",
      "path": "/api/identity/office-review",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-private-kyc",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "phase": 1,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-private-kyc",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "phase": 1,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-private-kyc",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null,
      "phase": 1,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-private-kyc",
      "path": "/api/identity/participants",
      "method": "GET",
      "projectId": "project-a",
      "phase": 1,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "AUDITOR",
      "mode": "continuity-office",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "phase": 0,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "AUDITOR",
      "mode": "continuity-office",
      "path": "/api/identity/office-review",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "AUDITOR",
      "mode": "continuity-office",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "phase": 1,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "AUDITOR",
      "mode": "continuity-office",
      "path": "/api/identity/office-review",
      "method": "GET",
      "projectId": "project-a",
      "phase": 1,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-late-list",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "phase": 0,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-late-list",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-late-list",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null,
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-late-list",
      "path": "/api/identity/project-preparation",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-late-list",
      "path": "/api/identity/project-creation",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-late-list",
      "path": "/api/identity/office-review",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-late-list",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "phase": 1,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-late-list",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "phase": 1,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-late-project",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "phase": 0,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-late-project",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-late-project",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null,
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-late-project",
      "path": "/api/identity/project-preparation",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-late-project",
      "path": "/api/identity/project-creation",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-late-project",
      "path": "/api/identity/office-review",
      "method": "GET",
      "projectId": "project-a",
      "phase": 0,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-late-project",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "phase": 1,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-late-project",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "phase": 1,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-late-project",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null,
      "phase": 1,
      "responseStatus": 403
    },
    {
      "width": 320,
      "role": "ADMIN",
      "mode": "continuity-bootstrap",
      "path": "/api/identity/company-onboarding",
      "method": "GET",
      "projectId": null
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "continuity-bootstrap",
      "path": "/api/identity/company-onboarding",
      "method": "GET",
      "projectId": null
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "continuity-bootstrap",
      "path": "/api/identity/company-onboarding",
      "method": "GET",
      "projectId": null
    },
    {
      "width": 320,
      "role": "ADMIN",
      "mode": "task-paging-success",
      "consumer": "field",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "scope": null,
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 320,
      "role": "ADMIN",
      "mode": "task-paging-success",
      "consumer": "field",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 320,
      "role": "ADMIN",
      "mode": "task-paging-success",
      "consumer": "field",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null,
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 403
    },
    {
      "width": 320,
      "role": "ADMIN",
      "mode": "task-paging-success",
      "consumer": "field",
      "path": "/api/identity/project-preparation",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 403
    },
    {
      "width": 320,
      "role": "ADMIN",
      "mode": "task-paging-success",
      "consumer": "field",
      "path": "/api/identity/project-creation",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 403
    },
    {
      "width": 320,
      "role": "ADMIN",
      "mode": "task-paging-success",
      "consumer": "field",
      "path": "/api/identity/office-review",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 403
    },
    {
      "width": 320,
      "role": "ADMIN",
      "mode": "task-paging-success",
      "consumer": "field",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": "task_100",
      "responseStatus": 200
    },
    {
      "width": 320,
      "role": "ADMIN",
      "mode": "task-paging-success",
      "consumer": "field",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": "task_200",
      "responseStatus": 200
    },
    {
      "width": 320,
      "role": "ADMIN",
      "mode": "task-paging-success",
      "consumer": "inventory",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "scope": null,
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 320,
      "role": "ADMIN",
      "mode": "task-paging-success",
      "consumer": "inventory",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 320,
      "role": "ADMIN",
      "mode": "task-paging-success",
      "consumer": "inventory",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null,
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 403
    },
    {
      "width": 320,
      "role": "ADMIN",
      "mode": "task-paging-success",
      "consumer": "inventory",
      "path": "/api/identity/project-preparation",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 403
    },
    {
      "width": 320,
      "role": "ADMIN",
      "mode": "task-paging-success",
      "consumer": "inventory",
      "path": "/api/identity/project-creation",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 403
    },
    {
      "width": 320,
      "role": "ADMIN",
      "mode": "task-paging-success",
      "consumer": "inventory",
      "path": "/api/identity/office-review",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 403
    },
    {
      "width": 320,
      "role": "ADMIN",
      "mode": "task-paging-success",
      "consumer": "inventory",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": "task_100",
      "responseStatus": 200
    },
    {
      "width": 320,
      "role": "ADMIN",
      "mode": "task-paging-success",
      "consumer": "inventory",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": "task_200",
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-success",
      "consumer": "field",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "scope": null,
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-success",
      "consumer": "field",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-success",
      "consumer": "field",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null,
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-success",
      "consumer": "field",
      "path": "/api/identity/project-preparation",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-success",
      "consumer": "field",
      "path": "/api/identity/project-creation",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-success",
      "consumer": "field",
      "path": "/api/identity/office-review",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-success",
      "consumer": "field",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": "task_100",
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-success",
      "consumer": "field",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": "task_200",
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-success",
      "consumer": "inventory",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "scope": null,
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-success",
      "consumer": "inventory",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-success",
      "consumer": "inventory",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null,
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-success",
      "consumer": "inventory",
      "path": "/api/identity/project-preparation",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-success",
      "consumer": "inventory",
      "path": "/api/identity/project-creation",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-success",
      "consumer": "inventory",
      "path": "/api/identity/office-review",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-success",
      "consumer": "inventory",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": "task_100",
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-success",
      "consumer": "inventory",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": "task_200",
      "responseStatus": 200
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "task-paging-success",
      "consumer": "field",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "scope": null,
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "task-paging-success",
      "consumer": "field",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "task-paging-success",
      "consumer": "field",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null,
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 403
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "task-paging-success",
      "consumer": "field",
      "path": "/api/identity/project-preparation",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 403
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "task-paging-success",
      "consumer": "field",
      "path": "/api/identity/project-creation",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 403
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "task-paging-success",
      "consumer": "field",
      "path": "/api/identity/office-review",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 403
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "task-paging-success",
      "consumer": "field",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": "task_100",
      "responseStatus": 200
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "task-paging-success",
      "consumer": "field",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": "task_200",
      "responseStatus": 200
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "task-paging-success",
      "consumer": "inventory",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "scope": null,
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "task-paging-success",
      "consumer": "inventory",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "task-paging-success",
      "consumer": "inventory",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null,
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 403
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "task-paging-success",
      "consumer": "inventory",
      "path": "/api/identity/project-preparation",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 403
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "task-paging-success",
      "consumer": "inventory",
      "path": "/api/identity/project-creation",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 403
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "task-paging-success",
      "consumer": "inventory",
      "path": "/api/identity/office-review",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 403
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "task-paging-success",
      "consumer": "inventory",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": "task_100",
      "responseStatus": 200
    },
    {
      "width": 1440,
      "role": "ADMIN",
      "mode": "task-paging-success",
      "consumer": "inventory",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": "task_200",
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-503-retry",
      "consumer": "field",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "scope": null,
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-503-retry",
      "consumer": "field",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-503-retry",
      "consumer": "field",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null,
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-503-retry",
      "consumer": "field",
      "path": "/api/identity/project-preparation",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-503-retry",
      "consumer": "field",
      "path": "/api/identity/project-creation",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-503-retry",
      "consumer": "field",
      "path": "/api/identity/office-review",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-503-retry",
      "consumer": "field",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": "task_100",
      "responseStatus": 503
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-503-retry",
      "consumer": "field",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": "task_100",
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-403-clear",
      "consumer": "field",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "scope": null,
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-403-clear",
      "consumer": "field",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-403-clear",
      "consumer": "field",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null,
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-403-clear",
      "consumer": "field",
      "path": "/api/identity/project-preparation",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-403-clear",
      "consumer": "field",
      "path": "/api/identity/project-creation",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-403-clear",
      "consumer": "field",
      "path": "/api/identity/office-review",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-403-clear",
      "consumer": "field",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": "task_100",
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-busy",
      "consumer": "field",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "scope": null,
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-busy",
      "consumer": "field",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-busy",
      "consumer": "field",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null,
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-busy",
      "consumer": "field",
      "path": "/api/identity/project-preparation",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-busy",
      "consumer": "field",
      "path": "/api/identity/project-creation",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-busy",
      "consumer": "field",
      "path": "/api/identity/office-review",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-busy",
      "consumer": "field",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": "task_100",
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-busy",
      "consumer": "field",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": "task_100",
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-503-retry",
      "consumer": "inventory",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "scope": null,
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-503-retry",
      "consumer": "inventory",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-503-retry",
      "consumer": "inventory",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null,
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-503-retry",
      "consumer": "inventory",
      "path": "/api/identity/project-preparation",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-503-retry",
      "consumer": "inventory",
      "path": "/api/identity/project-creation",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-503-retry",
      "consumer": "inventory",
      "path": "/api/identity/office-review",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-503-retry",
      "consumer": "inventory",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": "task_100",
      "responseStatus": 503
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-503-retry",
      "consumer": "inventory",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": "task_100",
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-403-clear",
      "consumer": "inventory",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "scope": null,
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-403-clear",
      "consumer": "inventory",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-403-clear",
      "consumer": "inventory",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null,
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-403-clear",
      "consumer": "inventory",
      "path": "/api/identity/project-preparation",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-403-clear",
      "consumer": "inventory",
      "path": "/api/identity/project-creation",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-403-clear",
      "consumer": "inventory",
      "path": "/api/identity/office-review",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-403-clear",
      "consumer": "inventory",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": "task_100",
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-busy",
      "consumer": "inventory",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "scope": null,
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-busy",
      "consumer": "inventory",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-busy",
      "consumer": "inventory",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null,
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-busy",
      "consumer": "inventory",
      "path": "/api/identity/project-preparation",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-busy",
      "consumer": "inventory",
      "path": "/api/identity/project-creation",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-busy",
      "consumer": "inventory",
      "path": "/api/identity/office-review",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-busy",
      "consumer": "inventory",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": "task_100",
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-busy",
      "consumer": "inventory",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": "task_100",
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-404-revoked-clear",
      "consumer": "field",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "scope": null,
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-404-revoked-clear",
      "consumer": "field",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-404-revoked-clear",
      "consumer": "field",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null,
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-404-revoked-clear",
      "consumer": "field",
      "path": "/api/identity/project-preparation",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-404-revoked-clear",
      "consumer": "field",
      "path": "/api/identity/project-creation",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-404-revoked-clear",
      "consumer": "field",
      "path": "/api/identity/office-review",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-404-revoked-clear",
      "consumer": "field",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": "task_100",
      "responseStatus": 404
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-404-revoked-clear",
      "consumer": "inventory",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": null,
      "scope": null,
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-404-revoked-clear",
      "consumer": "inventory",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-404-revoked-clear",
      "consumer": "inventory",
      "path": "/api/identity/company-subscription",
      "method": "GET",
      "projectId": null,
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-404-revoked-clear",
      "consumer": "inventory",
      "path": "/api/identity/project-preparation",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-404-revoked-clear",
      "consumer": "inventory",
      "path": "/api/identity/project-creation",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-404-revoked-clear",
      "consumer": "inventory",
      "path": "/api/identity/office-review",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": null,
      "responseStatus": 403
    },
    {
      "width": 390,
      "role": "ADMIN",
      "mode": "task-paging-404-revoked-clear",
      "consumer": "inventory",
      "path": "/api/identity/workspace",
      "method": "GET",
      "projectId": "project-a",
      "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "afterTask": "task_100",
      "responseStatus": 404
    }
  ],
  "screenshotNames": [
    "overview-before-checks-390.png",
    "overview-before-checks-1440.png",
    "overview-390.png",
    "identity-deep-390.png",
    "legacy-schedule-390.png",
    "limited-role-390.png",
    "draft-before-390.png",
    "draft-after-390.png",
    "project-picker-before-390.png",
    "project-picker-after-390.png",
    "company-plan-company-without-selection-390.png",
    "company-plan-empty-company-390.png",
    "wizard-front-390.png",
    "wizard-back-390.png",
    "wizard-final-before-390.png",
    "wizard-uncertain-after-390.png",
    "overview-1440.png",
    "identity-deep-1440.png",
    "legacy-schedule-1440.png",
    "limited-role-1440.png",
    "draft-before-1440.png",
    "draft-after-1440.png",
    "project-picker-before-1440.png",
    "project-picker-after-1440.png",
    "company-plan-company-without-selection-1440.png",
    "company-plan-empty-company-1440.png",
    "wizard-front-1440.png",
    "wizard-back-1440.png",
    "wizard-final-before-1440.png",
    "wizard-uncertain-after-1440.png",
    "continuity-restored-320.png",
    "continuity-restored-390.png",
    "continuity-restored-1440.png",
    "continuity-list-role-390.png",
    "continuity-list-scope-390.png",
    "continuity-list-missing-390.png",
    "continuity-list-401-390.png",
    "continuity-list-403-390.png",
    "continuity-list-500-390.png",
    "continuity-project-401-390.png",
    "continuity-project-403-390.png",
    "continuity-project-500-390.png",
    "continuity-project-scope-390.png",
    "continuity-project-id-390.png",
    "continuity-project-null-390.png",
    "continuity-truncated-promoted-390.png",
    "continuity-truncated-denied-390.png",
    "continuity-truncated-inactive-390.png",
    "continuity-private-only-390.png",
    "continuity-office-restored-390.png",
    "continuity-late-list-rejected-390.png",
    "continuity-unmounted-late-project-390.png",
    "bootstrap-ready-compact-320.png",
    "bootstrap-ready-open-320.png",
    "bootstrap-ready-compact-390.png",
    "bootstrap-ready-open-390.png",
    "bootstrap-ready-compact-1440.png",
    "bootstrap-ready-open-1440.png",
    "task-pages-field-205-320.png",
    "task-pages-inventory-205-320.png",
    "task-pages-field-205-390.png",
    "task-pages-inventory-205-390.png",
    "task-pages-field-205-1440.png",
    "task-pages-inventory-205-1440.png",
    "task-pages-field-503-retry-390.png",
    "task-pages-field-403-clear-390.png",
    "task-pages-field-parent-block-390.png",
    "task-pages-inventory-503-retry-390.png",
    "task-pages-inventory-403-clear-390.png",
    "task-pages-inventory-parent-block-390.png",
    "task-pages-field-404-revoked-clear-390.png",
    "task-pages-inventory-404-revoked-clear-390.png"
  ],
  "requestProjectionFieldsOmitted": [
    "operationId",
    "recoveryReferenceSha256",
    "syntheticImageSha256"
  ],
  "taskPagingFixture": {
    "pageSha256": "81172bf9a67fd42465b97db593192c50aff075582edf8ec5a2e25d19b2df5669",
    "consumerAuthority": "Controlled callback protocol only; no real form, provider, authorization or business command"
  },
  "matrixObservation": {
    "rawProofSha256": "fe25b51ef2399b0b0ce936fe784933ffb9ffebdee1dd2409a2f826209edca197",
    "sourceState": "LOCAL_REVIEW_SOURCE",
    "rawProofTransformed": false,
    "formalCiAcceptance": false
  }
});
export const WHATSAPP_FIELD_CONTINUITY_PAGINATION_UI=deepFreeze({
  "status": "REVIEWED_FROZEN_CURRENT_SOURCE",
  "ciVersion": "field-task-pagination-ci-v1",
  "rawVersion": 1,
  "checkNames": [
    "real-form-keeps-draft-through-pages-2-and-3-evidence-320",
    "real-form-keeps-draft-through-pages-2-and-3-progress-320",
    "real-form-keeps-draft-through-pages-2-and-3-material-request-320",
    "real-form-keeps-draft-through-pages-2-and-3-consumption-320",
    "real-form-keeps-draft-through-pages-2-and-3-evidence-390",
    "real-form-keeps-draft-through-pages-2-and-3-progress-390",
    "real-form-keeps-draft-through-pages-2-and-3-material-request-390",
    "real-form-keeps-draft-through-pages-2-and-3-consumption-390",
    "real-form-keeps-draft-through-pages-2-and-3-evidence-1440",
    "real-form-keeps-draft-through-pages-2-and-3-progress-1440",
    "real-form-keeps-draft-through-pages-2-and-3-material-request-1440",
    "real-form-keeps-draft-through-pages-2-and-3-consumption-1440",
    "page-503-keeps-form-and-explicit-retry-evidence-320",
    "page-503-keeps-form-and-explicit-retry-progress-320",
    "page-503-keeps-form-and-explicit-retry-material-request-320",
    "page-503-keeps-form-and-explicit-retry-consumption-320",
    "page-503-keeps-form-and-explicit-retry-evidence-390",
    "page-503-keeps-form-and-explicit-retry-progress-390",
    "page-503-keeps-form-and-explicit-retry-material-request-390",
    "page-503-keeps-form-and-explicit-retry-consumption-390",
    "page-503-keeps-form-and-explicit-retry-evidence-1440",
    "page-503-keeps-form-and-explicit-retry-progress-1440",
    "page-503-keeps-form-and-explicit-retry-material-request-1440",
    "page-503-keeps-form-and-explicit-retry-consumption-1440",
    "uncertain-original-command-blocks-task-paging-evidence-320",
    "uncertain-original-command-blocks-task-paging-progress-320",
    "uncertain-original-command-blocks-task-paging-consumption-320",
    "uncertain-original-command-blocks-task-paging-evidence-390",
    "uncertain-original-command-blocks-task-paging-progress-390",
    "uncertain-original-command-blocks-task-paging-consumption-390",
    "uncertain-original-command-blocks-task-paging-evidence-1440",
    "uncertain-original-command-blocks-task-paging-progress-1440",
    "uncertain-original-command-blocks-task-paging-consumption-1440"
  ],
  "widths": [
    320,
    390,
    1440
  ],
  "unitFiles": [
    "tests/production-worksite-task-selector.test.mjs",
    "tests/production-workspace-task-page.test.mjs",
    "tests/production-field-task-pagination-ci.test.mjs",
    "tests/production-whatsapp-field-continuity-current-ci-lineage.test.mjs"
  ],
  "requestMatrix": [
    {
      "width": 320,
      "mode": "evidence",
      "path": "/api/identity/field-operations",
      "method": "GET",
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 320,
      "mode": "evidence",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0100",
      "responseStatus": 200
    },
    {
      "width": 320,
      "mode": "evidence",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0200",
      "responseStatus": 200
    },
    {
      "width": 320,
      "mode": "progress",
      "path": "/api/identity/field-operations",
      "method": "GET",
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 320,
      "mode": "progress",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0100",
      "responseStatus": 200
    },
    {
      "width": 320,
      "mode": "progress",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0200",
      "responseStatus": 200
    },
    {
      "width": 320,
      "mode": "material-request",
      "path": "/api/identity/field-operations",
      "method": "GET",
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 320,
      "mode": "material-request",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0100",
      "responseStatus": 200
    },
    {
      "width": 320,
      "mode": "material-request",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0200",
      "responseStatus": 200
    },
    {
      "width": 320,
      "mode": "consumption",
      "path": "/api/identity/field-operations",
      "method": "GET",
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 320,
      "mode": "consumption",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0100",
      "responseStatus": 200
    },
    {
      "width": 320,
      "mode": "consumption",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0200",
      "responseStatus": 200
    },
    {
      "width": 390,
      "mode": "evidence",
      "path": "/api/identity/field-operations",
      "method": "GET",
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 390,
      "mode": "evidence",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0100",
      "responseStatus": 200
    },
    {
      "width": 390,
      "mode": "evidence",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0200",
      "responseStatus": 200
    },
    {
      "width": 390,
      "mode": "progress",
      "path": "/api/identity/field-operations",
      "method": "GET",
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 390,
      "mode": "progress",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0100",
      "responseStatus": 200
    },
    {
      "width": 390,
      "mode": "progress",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0200",
      "responseStatus": 200
    },
    {
      "width": 390,
      "mode": "material-request",
      "path": "/api/identity/field-operations",
      "method": "GET",
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 390,
      "mode": "material-request",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0100",
      "responseStatus": 200
    },
    {
      "width": 390,
      "mode": "material-request",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0200",
      "responseStatus": 200
    },
    {
      "width": 390,
      "mode": "consumption",
      "path": "/api/identity/field-operations",
      "method": "GET",
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 390,
      "mode": "consumption",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0100",
      "responseStatus": 200
    },
    {
      "width": 390,
      "mode": "consumption",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0200",
      "responseStatus": 200
    },
    {
      "width": 1440,
      "mode": "evidence",
      "path": "/api/identity/field-operations",
      "method": "GET",
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 1440,
      "mode": "evidence",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0100",
      "responseStatus": 200
    },
    {
      "width": 1440,
      "mode": "evidence",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0200",
      "responseStatus": 200
    },
    {
      "width": 1440,
      "mode": "progress",
      "path": "/api/identity/field-operations",
      "method": "GET",
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 1440,
      "mode": "progress",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0100",
      "responseStatus": 200
    },
    {
      "width": 1440,
      "mode": "progress",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0200",
      "responseStatus": 200
    },
    {
      "width": 1440,
      "mode": "material-request",
      "path": "/api/identity/field-operations",
      "method": "GET",
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 1440,
      "mode": "material-request",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0100",
      "responseStatus": 200
    },
    {
      "width": 1440,
      "mode": "material-request",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0200",
      "responseStatus": 200
    },
    {
      "width": 1440,
      "mode": "consumption",
      "path": "/api/identity/field-operations",
      "method": "GET",
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 1440,
      "mode": "consumption",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0100",
      "responseStatus": 200
    },
    {
      "width": 1440,
      "mode": "consumption",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0200",
      "responseStatus": 200
    },
    {
      "width": 320,
      "mode": "evidence",
      "path": "/api/identity/field-operations",
      "method": "GET",
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 320,
      "mode": "evidence",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0100",
      "responseStatus": 503
    },
    {
      "width": 320,
      "mode": "evidence",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0100",
      "responseStatus": 200
    },
    {
      "width": 320,
      "mode": "progress",
      "path": "/api/identity/field-operations",
      "method": "GET",
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 320,
      "mode": "progress",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0100",
      "responseStatus": 503
    },
    {
      "width": 320,
      "mode": "progress",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0100",
      "responseStatus": 200
    },
    {
      "width": 320,
      "mode": "material-request",
      "path": "/api/identity/field-operations",
      "method": "GET",
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 320,
      "mode": "material-request",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0100",
      "responseStatus": 503
    },
    {
      "width": 320,
      "mode": "material-request",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0100",
      "responseStatus": 200
    },
    {
      "width": 320,
      "mode": "consumption",
      "path": "/api/identity/field-operations",
      "method": "GET",
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 320,
      "mode": "consumption",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0100",
      "responseStatus": 503
    },
    {
      "width": 320,
      "mode": "consumption",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0100",
      "responseStatus": 200
    },
    {
      "width": 390,
      "mode": "evidence",
      "path": "/api/identity/field-operations",
      "method": "GET",
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 390,
      "mode": "evidence",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0100",
      "responseStatus": 503
    },
    {
      "width": 390,
      "mode": "evidence",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0100",
      "responseStatus": 200
    },
    {
      "width": 390,
      "mode": "progress",
      "path": "/api/identity/field-operations",
      "method": "GET",
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 390,
      "mode": "progress",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0100",
      "responseStatus": 503
    },
    {
      "width": 390,
      "mode": "progress",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0100",
      "responseStatus": 200
    },
    {
      "width": 390,
      "mode": "material-request",
      "path": "/api/identity/field-operations",
      "method": "GET",
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 390,
      "mode": "material-request",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0100",
      "responseStatus": 503
    },
    {
      "width": 390,
      "mode": "material-request",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0100",
      "responseStatus": 200
    },
    {
      "width": 390,
      "mode": "consumption",
      "path": "/api/identity/field-operations",
      "method": "GET",
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 390,
      "mode": "consumption",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0100",
      "responseStatus": 503
    },
    {
      "width": 390,
      "mode": "consumption",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0100",
      "responseStatus": 200
    },
    {
      "width": 1440,
      "mode": "evidence",
      "path": "/api/identity/field-operations",
      "method": "GET",
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 1440,
      "mode": "evidence",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0100",
      "responseStatus": 503
    },
    {
      "width": 1440,
      "mode": "evidence",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0100",
      "responseStatus": 200
    },
    {
      "width": 1440,
      "mode": "progress",
      "path": "/api/identity/field-operations",
      "method": "GET",
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 1440,
      "mode": "progress",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0100",
      "responseStatus": 503
    },
    {
      "width": 1440,
      "mode": "progress",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0100",
      "responseStatus": 200
    },
    {
      "width": 1440,
      "mode": "material-request",
      "path": "/api/identity/field-operations",
      "method": "GET",
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 1440,
      "mode": "material-request",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0100",
      "responseStatus": 503
    },
    {
      "width": 1440,
      "mode": "material-request",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0100",
      "responseStatus": 200
    },
    {
      "width": 1440,
      "mode": "consumption",
      "path": "/api/identity/field-operations",
      "method": "GET",
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 1440,
      "mode": "consumption",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0100",
      "responseStatus": 503
    },
    {
      "width": 1440,
      "mode": "consumption",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0100",
      "responseStatus": 200
    },
    {
      "width": 320,
      "mode": "evidence",
      "path": "/api/identity/field-operations",
      "method": "GET",
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 320,
      "mode": "evidence",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0100",
      "responseStatus": 200
    },
    {
      "width": 320,
      "mode": "evidence",
      "path": "/api/identity/field-media",
      "method": "POST",
      "afterTask": null,
      "responseStatus": 503
    },
    {
      "width": 320,
      "mode": "progress",
      "path": "/api/identity/field-operations",
      "method": "GET",
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 320,
      "mode": "progress",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0100",
      "responseStatus": 200
    },
    {
      "width": 320,
      "mode": "progress",
      "path": "/api/identity/field-operations",
      "method": "POST",
      "afterTask": null,
      "responseStatus": 503
    },
    {
      "width": 320,
      "mode": "consumption",
      "path": "/api/identity/field-operations",
      "method": "GET",
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 320,
      "mode": "consumption",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0100",
      "responseStatus": 200
    },
    {
      "width": 320,
      "mode": "consumption",
      "path": "/api/identity/field-operations",
      "method": "POST",
      "afterTask": null,
      "responseStatus": 503
    },
    {
      "width": 390,
      "mode": "evidence",
      "path": "/api/identity/field-operations",
      "method": "GET",
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 390,
      "mode": "evidence",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0100",
      "responseStatus": 200
    },
    {
      "width": 390,
      "mode": "evidence",
      "path": "/api/identity/field-media",
      "method": "POST",
      "afterTask": null,
      "responseStatus": 503
    },
    {
      "width": 390,
      "mode": "progress",
      "path": "/api/identity/field-operations",
      "method": "GET",
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 390,
      "mode": "progress",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0100",
      "responseStatus": 200
    },
    {
      "width": 390,
      "mode": "progress",
      "path": "/api/identity/field-operations",
      "method": "POST",
      "afterTask": null,
      "responseStatus": 503
    },
    {
      "width": 390,
      "mode": "consumption",
      "path": "/api/identity/field-operations",
      "method": "GET",
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 390,
      "mode": "consumption",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0100",
      "responseStatus": 200
    },
    {
      "width": 390,
      "mode": "consumption",
      "path": "/api/identity/field-operations",
      "method": "POST",
      "afterTask": null,
      "responseStatus": 503
    },
    {
      "width": 1440,
      "mode": "evidence",
      "path": "/api/identity/field-operations",
      "method": "GET",
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 1440,
      "mode": "evidence",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0100",
      "responseStatus": 200
    },
    {
      "width": 1440,
      "mode": "evidence",
      "path": "/api/identity/field-media",
      "method": "POST",
      "afterTask": null,
      "responseStatus": 503
    },
    {
      "width": 1440,
      "mode": "progress",
      "path": "/api/identity/field-operations",
      "method": "GET",
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 1440,
      "mode": "progress",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0100",
      "responseStatus": 200
    },
    {
      "width": 1440,
      "mode": "progress",
      "path": "/api/identity/field-operations",
      "method": "POST",
      "afterTask": null,
      "responseStatus": 503
    },
    {
      "width": 1440,
      "mode": "consumption",
      "path": "/api/identity/field-operations",
      "method": "GET",
      "afterTask": null,
      "responseStatus": 200
    },
    {
      "width": 1440,
      "mode": "consumption",
      "path": "/api/identity/workspace",
      "method": "GET",
      "afterTask": "task-0100",
      "responseStatus": 200
    },
    {
      "width": 1440,
      "mode": "consumption",
      "path": "/api/identity/field-operations",
      "method": "POST",
      "afterTask": null,
      "responseStatus": 503
    }
  ],
  "commandEqualityGroups": [
    [
      74,
      83,
      92
    ],
    [
      77
    ],
    [
      80
    ],
    [
      86
    ],
    [
      89
    ],
    [
      95
    ],
    [
      98
    ]
  ],
  "postCount": 9,
  "screenshotNames": [
    "evidence-page-three-320.png",
    "progress-page-three-320.png",
    "material-request-page-three-320.png",
    "consumption-page-three-320.png",
    "evidence-page-three-390.png",
    "progress-page-three-390.png",
    "material-request-page-three-390.png",
    "consumption-page-three-390.png",
    "evidence-page-three-1440.png",
    "progress-page-three-1440.png",
    "material-request-page-three-1440.png",
    "consumption-page-three-1440.png"
  ],
  "mediaActionLabels": [
    "Girar foto 90°",
    "Usar este archivo",
    "Quitar archivo"
  ],
  "controlledSourceTransform": {
    "file": "tests/production-worksite-task-selector.test.mjs",
    "sourceLfSha256": "15d764467be94b0f84cc0988d969458ee52660d6f1d2f4c7c5cb96d5d9125a7f",
    "kind": "SWC_SELECTOR_DATA_MODULE",
    "source": "src/app/(identity)/cuenta/worksite-task-selector.js",
    "compiler": "next/dist/build/swc/index.js",
    "packageLockSha256": "dfa3ff3914547f35828a0b697e6007c6cf856546be86bf8a7810cdce59e60449"
  },
  "unitCaseMatrix": {
    "file": "tests/production-workspace-task-page.test.mjs",
    "sourceLfSha256": "9bed3622f630c43c4069ce8cb0a8c4fa6a42a262a6550cc0f9e6ef83220e3fb6",
    "caseNames": [
      "pages 2 and 3 use canonical read parameters and append all 205 tasks",
      "overlapping clicks issue one request, and the response needs the original cursor",
      "a transient failure preserves the cursor and can be retried without a write",
      "a late page cannot enter a changed context {\"scope\":\"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\"}",
      "a late page cannot enter a changed context {\"projectId\":\"project_b\"}",
      "a late page cannot enter a changed context {\"role\":\"AUDITOR\"}",
      "a late page cannot enter a changed context {\"generation\":8}",
      "a late page cannot enter a changed context {\"officeReviewOnly\":true}",
      "reset aborts an old read; a new generation completes while the old callback is ignored",
      "dispose aborts and prevents callbacks or new reads after unmount",
      "access rejection reaches the canonical parent handler {\"status\":401}",
      "access rejection reaches the canonical parent handler {\"status\":403}",
      "access rejection reaches the canonical parent handler {\"status\":409,\"code\":\"WORKSPACE_CONTEXT_CHANGED\"}",
      "access rejection reaches the canonical parent handler {\"status\":404,\"code\":\"WORKSPACE_PROJECT_UNAVAILABLE\"}",
      "a generic 404 is a retryable read error without a canonical project denial",
      "a write or uncertain attempt blocks reads, including one that starts after the request",
      "a previously consumed cursor cannot loop the same page indefinitely",
      "revision-aware merge does not replace an already approved task with an older page snapshot",
      "an unavailable context issues no read: {\"scope\":\"invalid\"}",
      "an unavailable context issues no read: {\"projectId\":\"../other\"}",
      "an unavailable context issues no read: {\"generation\":-1}",
      "an unavailable context issues no read: {\"officeReviewOnly\":true}",
      "an unavailable context issues no read: {\"cursor\":\"../../other\"}",
      "an unavailable context issues no read: {\"cursor\":null}",
      "unconfirmed page leaves the current task list untouched: wrong scope",
      "unconfirmed page leaves the current task list untouched: wrong project",
      "unconfirmed page leaves the current task list untouched: inactive project",
      "unconfirmed page leaves the current task list untouched: unknown response shape",
      "unconfirmed page leaves the current task list untouched: too many rows",
      "unconfirmed page leaves the current task list untouched: duplicate task",
      "unconfirmed page leaves the current task list untouched: bad revision",
      "unconfirmed page leaves the current task list untouched: unconfirmed quantity basis",
      "unconfirmed page leaves the current task list untouched: bad total",
      "unconfirmed page leaves the current task list untouched: cursor outside page",
      "unconfirmed page leaves the current task list untouched: reused cursor",
      "the canonical page validator accepts an empty final page"
    ]
  },
  "matrixObservation": {
    "rawProofSha256": "7bcfff2a256dd2b2dd205410a81563feed32c837e36f6091dca859170dddc296",
    "sourceState": "LOCAL_REVIEW_SOURCE",
    "rawProofTransformed": false,
    "formalCiAcceptance": false
  }
});
export const WHATSAPP_FIELD_CONTINUITY_NATIVE=deepFreeze({
  "status": "REVIEWED_FROZEN_CURRENT_SOURCE",
  "families": {
    "COMPANY": {
      "kind": "COMPANY",
      "dtoField": "neutralStepGuidanceNative",
      "producer": "scripts/verify-company-channel-kyc-postgres.mjs",
      "producerSha256": "212a3f1ac6993954681a765635034ed0e48ac038db0ad3c6159df603ce049903",
      "sourceFiles": [
        "scripts/fixtures/meta-signup-field-lifecycle-fixture.mjs",
        "scripts/lib/kyc-context-feedback-native.mjs",
        "scripts/lib/kyc-current-image-native.mjs",
        "scripts/lib/kyc-neutral-step-guidance-native.mjs",
        "src/app/(identity)/cuenta/private-bank-account-format.mjs",
        "src/lib/afipValidator.js",
        "src/lib/aiVision.js",
        "src/lib/auditLedger.js",
        "src/lib/auth.js",
        "src/lib/bindx-civil-data-client.mjs",
        "src/lib/blobStorage.js",
        "src/lib/brand-assets.mjs",
        "src/lib/canonical-invited-account.mjs",
        "src/lib/company-billing-http.mjs",
        "src/lib/company-billing.mjs",
        "src/lib/company-channel-connection.mjs",
        "src/lib/company-channel-http.mjs",
        "src/lib/company-channel-kyc.mjs",
        "src/lib/company-channel-routing.mjs",
        "src/lib/company-channel-schema.mjs",
        "src/lib/company-channel-store.mjs",
        "src/lib/company-entitlement.mjs",
        "src/lib/company-onboarding-http.mjs",
        "src/lib/company-onboarding-identity.mjs",
        "src/lib/company-onboarding-policy.mjs",
        "src/lib/company-onboarding-store.mjs",
        "src/lib/company-phone-format.mjs",
        "src/lib/company-subscription-catalog.mjs",
        "src/lib/company-subscription-http.mjs",
        "src/lib/company-subscription-policy.mjs",
        "src/lib/company-subscription-provider.mjs",
        "src/lib/company-subscription-routing.mjs",
        "src/lib/company-subscription-runtime-config.mjs",
        "src/lib/company-subscription-runtime.mjs",
        "src/lib/company-subscription-store.mjs",
        "src/lib/computerVision.js",
        "src/lib/constructor-crm-http.mjs",
        "src/lib/constructor-crm-policy.mjs",
        "src/lib/constructor-crm-runtime.mjs",
        "src/lib/constructor-crm-schema.mjs",
        "src/lib/constructor-crm-store.mjs",
        "src/lib/customer-whatsapp-http.mjs",
        "src/lib/customer-whatsapp-setup.mjs",
        "src/lib/db.js",
        "src/lib/defaultState.js",
        "src/lib/design-system.js",
        "src/lib/dolarCac.js",
        "src/lib/employee-intake-channel-continuity.mjs",
        "src/lib/enterprise-crm-policy.mjs",
        "src/lib/field-media-privacy.mjs",
        "src/lib/field-media.mjs",
        "src/lib/field-operations-http.mjs",
        "src/lib/field-operations-policy.mjs",
        "src/lib/field-operations-runtime.mjs",
        "src/lib/field-operations-store.mjs",
        "src/lib/field-overtime-policy.mjs",
        "src/lib/field-overtime-store.mjs",
        "src/lib/field-report-feedback.mjs",
        "src/lib/field-shift-summary.mjs",
        "src/lib/geo.js",
        "src/lib/identity-return-path.mjs",
        "src/lib/kyc-pilot-boundary.mjs",
        "src/lib/legacy-access-boundary.js",
        "src/lib/llmCopilot.js",
        "src/lib/material-inventory.mjs",
        "src/lib/mercadopago.js",
        "src/lib/meta-app-callback.mjs",
        "src/lib/meta-app-recovery.mjs",
        "src/lib/meta-callback-diagnostics.mjs",
        "src/lib/meta-channel-binding.mjs",
        "src/lib/meta-cloud-protocol.mjs",
        "src/lib/meta-customer-activation.mjs",
        "src/lib/meta-customer-app-projection.mjs",
        "src/lib/meta-customer-callback.mjs",
        "src/lib/meta-customer-coexistence.mjs",
        "src/lib/meta-customer-credentials.mjs",
        "src/lib/meta-customer-http.mjs",
        "src/lib/meta-customer-inbox-review.mjs",
        "src/lib/meta-customer-onboarding.mjs",
        "src/lib/meta-customer-outbound.mjs",
        "src/lib/meta-customer-permissions.mjs",
        "src/lib/meta-customer-processing-runtime.mjs",
        "src/lib/meta-customer-processing.mjs",
        "src/lib/meta-customer-provider.mjs",
        "src/lib/meta-customer-template-send-http.mjs",
        "src/lib/meta-customer-template-send-runtime.mjs",
        "src/lib/meta-customer-template-send.mjs",
        "src/lib/meta-customer-templates.mjs",
        "src/lib/meta-demo-pilot-http.mjs",
        "src/lib/meta-demo-pilot-policy.mjs",
        "src/lib/meta-demo-pilot-runtime.mjs",
        "src/lib/meta-demo-pilot-store.mjs",
        "src/lib/meta-demo-pilot.mjs",
        "src/lib/meta-development-pilot-policy.mjs",
        "src/lib/meta-employee-intake.mjs",
        "src/lib/meta-field-bridge.mjs",
        "src/lib/meta-field-conversation.mjs",
        "src/lib/meta-kyc-bridge.mjs",
        "src/lib/meta-kyc-challenge.mjs",
        "src/lib/meta-kyc-context-feedback.mjs",
        "src/lib/meta-kyc-context-outbound.mjs",
        "src/lib/meta-kyc-conversation.mjs",
        "src/lib/meta-kyc-current-image.mjs",
        "src/lib/meta-kyc-expiry-feedback.mjs",
        "src/lib/meta-kyc-identity.mjs",
        "src/lib/meta-kyc-outbound.mjs",
        "src/lib/meta-kyc-rejection-policy.mjs",
        "src/lib/meta-kyc-rejection.mjs",
        "src/lib/meta-own-company-connection.mjs",
        "src/lib/meta-own-company-policy.mjs",
        "src/lib/meta-own-company-templates.mjs",
        "src/lib/meta-plan-import-conversation.mjs",
        "src/lib/meta-plan-import-origin.mjs",
        "src/lib/meta-plan-import-recovery.mjs",
        "src/lib/meta-plan-import-transport.mjs",
        "src/lib/meta-recovery-diagnostics.mjs",
        "src/lib/meta-release-observation.mjs",
        "src/lib/meta-test-dispatch.mjs",
        "src/lib/meta-test-recipient-binding.mjs",
        "src/lib/meta-webhook-scope.mjs",
        "src/lib/meta-whatsapp-transport.mjs",
        "src/lib/metaTemplates.js",
        "src/lib/nlpEngine.js",
        "src/lib/office-review-http.mjs",
        "src/lib/office-review-policy.mjs",
        "src/lib/office-review-runtime.mjs",
        "src/lib/office-review-store.mjs",
        "src/lib/operations-status.mjs",
        "src/lib/organization-resource-usage-policy.mjs",
        "src/lib/organization-resource-usage-store.mjs",
        "src/lib/organization-usage-http.mjs",
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
        "src/lib/participant-http.mjs",
        "src/lib/participant-identity-provider.mjs",
        "src/lib/participant-kyc-chat-attempt.mjs",
        "src/lib/participant-kyc-chat-closure.mjs",
        "src/lib/participant-kyc-chat-copy.mjs",
        "src/lib/participant-kyc-image-set.mjs",
        "src/lib/participant-kyc-notice-links.mjs",
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
        "src/lib/participant-runtime.mjs",
        "src/lib/participant-store.mjs",
        "src/lib/participant-verified-office.mjs",
        "src/lib/pdfGenerator.js",
        "src/lib/person-worksite-journey.mjs",
        "src/lib/pilot-media.mjs",
        "src/lib/plan-baseline-http.mjs",
        "src/lib/plan-baseline-policy.mjs",
        "src/lib/plan-baseline-runtime.mjs",
        "src/lib/plan-baseline-store.mjs",
        "src/lib/plan-import-analyzer.mjs",
        "src/lib/plan-import-cyp-curve.mjs",
        "src/lib/plan-import-document-curve.mjs",
        "src/lib/plan-import-http.mjs",
        "src/lib/plan-import-monthly-curve.mjs",
        "src/lib/plan-import-ooxml.mjs",
        "src/lib/plan-import-policy.mjs",
        "src/lib/plan-import-runtime.mjs",
        "src/lib/plan-import-store.mjs",
        "src/lib/plan-measurement-configuration.mjs",
        "src/lib/plan-measurement-http.mjs",
        "src/lib/plan-measurement-policy.mjs",
        "src/lib/plan-measurement-runtime.mjs",
        "src/lib/plan-measurement-source.mjs",
        "src/lib/plan-measurement-store.mjs",
        "src/lib/predictiveAI.js",
        "src/lib/prisma.js",
        "src/lib/private-biometric-analyzer.mjs",
        "src/lib/private-image-upload.mjs",
        "src/lib/procurement-money.js",
        "src/lib/procurement-quantity.js",
        "src/lib/production-identity-config.mjs",
        "src/lib/progress-measurement-quantity.js",
        "src/lib/project-creation-http.mjs",
        "src/lib/project-creation-policy.mjs",
        "src/lib/project-creation-runtime.mjs",
        "src/lib/project-creation-store.mjs",
        "src/lib/project-preparation-http.mjs",
        "src/lib/project-preparation-policy.mjs",
        "src/lib/project-preparation-store.mjs",
        "src/lib/realtime.js",
        "src/lib/retired-billing.mjs",
        "src/lib/session-recovery.mjs",
        "src/lib/site-photo-http.mjs",
        "src/lib/site-photo-service.mjs",
        "src/lib/site-purchase-http.mjs",
        "src/lib/site-purchase-policy.mjs",
        "src/lib/site-purchase-store.mjs",
        "src/lib/site-register-http.mjs",
        "src/lib/site-register-policy.mjs",
        "src/lib/site-register-store.mjs",
        "src/lib/task-progress-measurement.js",
        "src/lib/useBreakpoint.js",
        "src/lib/verified-session.mjs",
        "src/lib/video-audio-extractor.mjs",
        "src/lib/video-frame-extractor.mjs",
        "src/lib/voice-progress-draft.mjs",
        "src/lib/weatherTelemetry.js",
        "src/lib/webhookDispatcher.js",
        "src/lib/whatsapp/field-worker-intent-policy.js",
        "src/lib/whatsapp/obra-intent-policy.js",
        "src/lib/whatsapp/operational-proposal-decision-policy.js",
        "src/lib/whatsapp/project-workspace-profile.js",
        "src/lib/whatsapp/template-review-policy.js",
        "src/lib/whatsapp/tenant-workspace-policy.js",
        "src/lib/whatsappNotifications.js",
        "src/lib/worker-channel-consent-policy.mjs",
        "src/lib/worker-channel-http.mjs",
        "src/lib/worker-channel-identity.mjs",
        "src/lib/worker-channel-runtime.mjs",
        "src/lib/workspace-http.mjs",
        "src/lib/workspace-policy.mjs",
        "src/lib/workspace-runtime.mjs",
        "src/lib/workspace-store.mjs"
      ],
      "sourceCount": 235,
      "sourcePathsSha256": "1a26e97cd22fbf77d620e29b20e50c3b01365d205160c2e476a38fc7dc072899",
      "checkNames": [
        "native-COMPANY-neutral-four-command-current-v3-guidance-no-capture-row-lock-ACK-and-original-deadline-fences"
      ],
      "caseNames": [
        "signed-production-neutral-four-commands-consent",
        "signed-production-neutral-four-commands-front",
        "signed-production-neutral-four-commands-back",
        "signed-production-neutral-four-commands-selfie",
        "signed-production-neutral-four-commands-confirm",
        "current-issuer-revoked-after-reservation-no-first-POST-or-replay",
        "actual-PG-concurrent-guidance-receipt-single-outbox-and-HTTP",
        "native-guidance-ROLLBACK-leaves-no-receipt",
        "native-guidance-COMMIT-ACK-loss-and-Graph-unknown-no-second-POST",
        "original-conversation-deadline-crossed-after-first-provider-guard-no-POST",
        "original-SENT-prompt-failed-in-same-locked-transaction-after-snapshot-no-first-POST",
        "canonical-preparer-refuses-second-live-same-phone-challenge-first-claim-retained",
        "canonically-expired-additional-attempt-does-not-create-live-ambiguity"
      ],
      "caseMatrix": [
        {
          "name": "signed-production-neutral-four-commands-consent",
          "commands": [
            "HOLA",
            "ESTADO",
            "MENU",
            "MENÚ"
          ],
          "replyCopyVersion": 3,
          "posts": 4,
          "replayPosts": 0,
          "workerBytesUnchanged": true,
          "sourcePromptBytesUnchanged": true,
          "privateIo": 0,
          "captureWrites": 0
        },
        {
          "name": "signed-production-neutral-four-commands-front",
          "commands": [
            "HOLA",
            "ESTADO",
            "MENU",
            "MENÚ"
          ],
          "replyCopyVersion": 3,
          "posts": 4,
          "replayPosts": 0,
          "workerBytesUnchanged": true,
          "sourcePromptBytesUnchanged": true,
          "privateIo": 0,
          "captureWrites": 0
        },
        {
          "name": "signed-production-neutral-four-commands-back",
          "commands": [
            "HOLA",
            "ESTADO",
            "MENU",
            "MENÚ"
          ],
          "replyCopyVersion": 3,
          "posts": 4,
          "replayPosts": 0,
          "workerBytesUnchanged": true,
          "sourcePromptBytesUnchanged": true,
          "privateIo": 0,
          "captureWrites": 0
        },
        {
          "name": "signed-production-neutral-four-commands-selfie",
          "commands": [
            "HOLA",
            "ESTADO",
            "MENU",
            "MENÚ"
          ],
          "replyCopyVersion": 3,
          "posts": 4,
          "replayPosts": 0,
          "workerBytesUnchanged": true,
          "sourcePromptBytesUnchanged": true,
          "privateIo": 0,
          "captureWrites": 0
        },
        {
          "name": "signed-production-neutral-four-commands-confirm",
          "commands": [
            "HOLA",
            "ESTADO",
            "MENU",
            "MENÚ"
          ],
          "replyCopyVersion": 3,
          "posts": 4,
          "replayPosts": 0,
          "workerBytesUnchanged": true,
          "sourcePromptBytesUnchanged": true,
          "privateIo": 0,
          "captureWrites": 0
        },
        {
          "name": "current-issuer-revoked-after-reservation-no-first-POST-or-replay",
          "posts": 0,
          "state": "SEND_STARTED",
          "workerBytesUnchanged": true
        },
        {
          "name": "actual-PG-concurrent-guidance-receipt-single-outbox-and-HTTP",
          "uncommittedReceiptInvisible": true,
          "receiptCount": 1,
          "outboxCount": 1,
          "posts": 1,
          "workerBytesUnchanged": true
        },
        {
          "name": "native-guidance-ROLLBACK-leaves-no-receipt",
          "commitApplied": false,
          "receiptCount": 1,
          "outboxCount": 1,
          "posts": 1,
          "replayPosts": 0,
          "workerBytesUnchanged": true
        },
        {
          "name": "native-guidance-COMMIT-ACK-loss-and-Graph-unknown-no-second-POST",
          "commitApplied": true,
          "receiptCount": 1,
          "outboxCount": 1,
          "posts": 1,
          "replayPosts": 0,
          "workerBytesUnchanged": true
        },
        {
          "name": "original-conversation-deadline-crossed-after-first-provider-guard-no-POST",
          "actualSqlClock": true,
          "issuanceOffsetMs": 1792000,
          "sourceLeaseStillLive": true,
          "deadlineRenewed": false,
          "posts": 0,
          "workerBytesUnchanged": true,
          "state": "SEND_STARTED"
        },
        {
          "name": "original-SENT-prompt-failed-in-same-locked-transaction-after-snapshot-no-first-POST",
          "actualRollbackRestoresPrompt": true,
          "posts": 0,
          "state": "SEND_STARTED",
          "workerBytesUnchanged": true
        },
        {
          "name": "canonical-preparer-refuses-second-live-same-phone-challenge-first-claim-retained",
          "secondPreparationCode": "META_KYC_CHALLENGE_AMBIGUOUS",
          "secondChallengeCreated": false,
          "posts": 1,
          "receiptCount": 1,
          "workerBytesUnchanged": true
        },
        {
          "name": "canonically-expired-additional-attempt-does-not-create-live-ambiguity",
          "posts": 1,
          "expiredWorkerBytesUnchanged": true,
          "deadlineRenewed": false
        }
      ],
      "extraKeys": [],
      "matrixObservation": {
        "rawProofSha256": "1f23cae4e2d9a4b15cd357dce67a4a13f90160ffe559ec256a14da4719bc6f84",
        "rawProofTransformed": false,
        "formalCiAcceptance": false
      }
    },
    "OWN": {
      "kind": "OWN_COMPANY_RUNTIME",
      "dtoField": "neutralStepGuidanceNative",
      "producer": "scripts/verify-company-kyc-outbound-compact-postgres.mjs",
      "producerSha256": "362bdcc31bf9eb37197e3c21485dd6522ab3343ea2d01d9fe1db4b3f27b56700",
      "sourceFiles": [
        "package-lock.json",
        "package.json",
        "scripts/lib/company-channel-disposable-fixture.mjs",
        "scripts/lib/company-channel-migration.mjs",
        "scripts/lib/disposable-postgres-cleanup.mjs",
        "scripts/lib/kyc-current-image-native.mjs",
        "scripts/lib/kyc-current-image-own-native.mjs",
        "scripts/lib/kyc-neutral-step-guidance-native.mjs",
        "scripts/lib/kyc-neutral-step-guidance-own-native.mjs",
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
        "src/lib/meta-kyc-current-image.mjs",
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
        "src/lib/participant-kyc-chat-copy.mjs",
        "src/lib/participant-kyc-image-set.mjs",
        "src/lib/participant-kyc-notice-links.mjs",
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
      ],
      "sourceCount": 139,
      "sourcePathsSha256": "cd474d8e9a3b754daaeef61f986e31f1c92997a8423cd9a14c06d43ea706dbea",
      "checkNames": [
        "native-OWN-neutral-current-v3-guidance-original-v2-grant-60s-lease-and-final-deadline-fences"
      ],
      "caseNames": [
        "signed-production-neutral-four-commands-consent",
        "signed-production-neutral-four-commands-front",
        "signed-production-neutral-four-commands-back",
        "signed-production-neutral-four-commands-selfie",
        "signed-production-neutral-four-commands-confirm",
        "current-issuer-revoked-after-reservation-no-first-POST-or-replay",
        "actual-PG-concurrent-guidance-receipt-single-outbox-and-HTTP",
        "native-guidance-ROLLBACK-leaves-no-receipt",
        "native-guidance-COMMIT-ACK-loss-and-Graph-unknown-no-second-POST",
        "original-conversation-deadline-crossed-after-first-provider-guard-no-POST",
        "original-SENT-prompt-failed-in-same-locked-transaction-after-snapshot-no-first-POST",
        "OWN-neutral-full-composition-original-60s-lease-controlled-225ms-SQL-200ms-Graph"
      ],
      "caseMatrix": [
        {
          "name": "signed-production-neutral-four-commands-consent",
          "commands": [
            "HOLA",
            "ESTADO",
            "MENU",
            "MENÚ"
          ],
          "replyCopyVersion": 3,
          "posts": 4,
          "replayPosts": 0,
          "workerBytesUnchanged": true,
          "sourcePromptBytesUnchanged": true,
          "privateIo": 0,
          "captureWrites": 0
        },
        {
          "name": "signed-production-neutral-four-commands-front",
          "commands": [
            "HOLA",
            "ESTADO",
            "MENU",
            "MENÚ"
          ],
          "replyCopyVersion": 3,
          "posts": 4,
          "replayPosts": 0,
          "workerBytesUnchanged": true,
          "sourcePromptBytesUnchanged": true,
          "privateIo": 0,
          "captureWrites": 0
        },
        {
          "name": "signed-production-neutral-four-commands-back",
          "commands": [
            "HOLA",
            "ESTADO",
            "MENU",
            "MENÚ"
          ],
          "replyCopyVersion": 3,
          "posts": 4,
          "replayPosts": 0,
          "workerBytesUnchanged": true,
          "sourcePromptBytesUnchanged": true,
          "privateIo": 0,
          "captureWrites": 0
        },
        {
          "name": "signed-production-neutral-four-commands-selfie",
          "commands": [
            "HOLA",
            "ESTADO",
            "MENU",
            "MENÚ"
          ],
          "replyCopyVersion": 3,
          "posts": 4,
          "replayPosts": 0,
          "workerBytesUnchanged": true,
          "sourcePromptBytesUnchanged": true,
          "privateIo": 0,
          "captureWrites": 0
        },
        {
          "name": "signed-production-neutral-four-commands-confirm",
          "commands": [
            "HOLA",
            "ESTADO",
            "MENU",
            "MENÚ"
          ],
          "replyCopyVersion": 3,
          "posts": 4,
          "replayPosts": 0,
          "workerBytesUnchanged": true,
          "sourcePromptBytesUnchanged": true,
          "privateIo": 0,
          "captureWrites": 0
        },
        {
          "name": "current-issuer-revoked-after-reservation-no-first-POST-or-replay",
          "posts": 0,
          "state": "SEND_STARTED",
          "workerBytesUnchanged": true
        },
        {
          "name": "actual-PG-concurrent-guidance-receipt-single-outbox-and-HTTP",
          "uncommittedReceiptInvisible": true,
          "receiptCount": 1,
          "outboxCount": 1,
          "posts": 1,
          "workerBytesUnchanged": true
        },
        {
          "name": "native-guidance-ROLLBACK-leaves-no-receipt",
          "commitApplied": false,
          "receiptCount": 1,
          "outboxCount": 1,
          "posts": 1,
          "replayPosts": 0,
          "workerBytesUnchanged": true
        },
        {
          "name": "native-guidance-COMMIT-ACK-loss-and-Graph-unknown-no-second-POST",
          "commitApplied": true,
          "receiptCount": 1,
          "outboxCount": 1,
          "posts": 1,
          "replayPosts": 0,
          "workerBytesUnchanged": true
        },
        {
          "name": "original-conversation-deadline-crossed-after-first-provider-guard-no-POST",
          "actualSqlClock": true,
          "issuanceOffsetMs": 1792000,
          "sourceLeaseStillLive": true,
          "deadlineRenewed": false,
          "posts": 0,
          "workerBytesUnchanged": true,
          "state": "SEND_STARTED"
        },
        {
          "name": "original-SENT-prompt-failed-in-same-locked-transaction-after-snapshot-no-first-POST",
          "actualRollbackRestoresPrompt": true,
          "posts": 0,
          "state": "SEND_STARTED",
          "workerBytesUnchanged": true
        },
        {
          "name": "OWN-neutral-full-composition-original-60s-lease-controlled-225ms-SQL-200ms-Graph",
          "statementDelayMs": 225,
          "graphDelayMs": 200,
          "sourceLeaseMs": 60000,
          "leaseExtended": false,
          "workerWrites": 0,
          "posts": 1,
          "productionLatencyMeasured": false
        }
      ],
      "extraKeys": [
        "originalV2ActivationReceipt",
        "originalGrantUnchanged",
        "setupChronology",
        "syntheticIssuanceClock"
      ],
      "matrixObservation": {
        "rawProofSha256": "0cb137a7d90722327491fd82a3940d69fe11520254ed8b02beabb85db050f5e0",
        "rawProofTransformed": false,
        "formalCiAcceptance": false
      }
    }
  }
});
export const WHATSAPP_FIELD_CONTINUITY_CURRENT_REVISION=deepFreeze({
  "version": 1,
  "status": "REVIEWED_FROZEN_CURRENT_SOURCE",
  "referenceHead": "052c13c3736f91a2b8fd388656dffdd4f89e2c12",
  "referenceTree": "0675e362f65bde501e5d7f46d753562d770864dc",
  "previousContractSha256": "f7a72979af7b789d92333d4f631d6bbbccf247c5c04ce6edd88f64f70b6099bb",
  "reviewedSourceChanges": [
    {
      "path": "scripts/verify-company-channel-kyc-postgres.mjs",
      "previousSha256": "a1410e44be6b7aaaf5a2e036263cbf1106cbe928551b2ceabe465d3576cd5973",
      "currentSha256": "212a3f1ac6993954681a765635034ed0e48ac038db0ad3c6159df603ce049903"
    },
    {
      "path": "scripts/verify-company-kyc-outbound-compact-postgres.mjs",
      "previousSha256": "f6196154ce1c8563b974a99f3feda5eeea4f33082436629ed7924ba3dbbb51a4",
      "currentSha256": "362bdcc31bf9eb37197e3c21485dd6522ab3343ea2d01d9fe1db4b3f27b56700"
    },
    {
      "path": "scripts/verify-field-operations-ui.mjs",
      "previousSha256": "4d5715178af955b332b5acf8a11ff66f7567f0d8e3b7efc10f535c98db6c8df9",
      "currentSha256": "114baf2bcf9a8c683d18c3ea4080c2b11ad175b9d7c294bbeb76bd364105f9e6"
    },
    {
      "path": "scripts/verify-focused-workspace-ui.mjs",
      "previousSha256": "dd416eb551c96273b79ee3b1ca94ec726d7c432d2231e19028f08ccdf0fd7a5a",
      "currentSha256": "00278d6fe4980a84a41508412340a0acde44bc4790945753cd7b557d80fb545e"
    },
    {
      "path": "scripts/verify-material-inventory-ui.mjs",
      "previousSha256": "6f9498d721a731aa62d968c0db27120c5a0034c467dc72fdf7be95fcdf80d26e",
      "currentSha256": "d3793a6122a6ecd0c15dc0ba6d55d57bb7e0bb01756d77fd5c8bb6822c960cc8"
    },
    {
      "path": "src/app/(identity)/cuenta/field-operations-panel.js",
      "previousSha256": "4a316a854777d17e2751898bc5066eedffc790334fefc6c45a6a1f584c1dfb80",
      "currentSha256": "c49b5639442fcc1f334fb2684c9921e18c3930448f74653a6cae4262ae12e081"
    },
    {
      "path": "src/app/(identity)/cuenta/field-operations-panel.module.css",
      "previousSha256": "902ddf080d80103d72c5ca7d067270cb7e1cf3bc5d42399e78dc1ecd4750b4f8",
      "currentSha256": "5ccd8b5beae691b9ab6ee2dc0c0ae876a5fdffe15d31d24c6807f117bd76949c"
    },
    {
      "path": "src/app/(identity)/cuenta/material-inventory-panel.js",
      "previousSha256": "7b69c8e2ed29c4c38a929eec4453ff18253c62cadc21a989a911eeea91ab940e",
      "currentSha256": "4d62e1542deaa10e218237e507eba13823e0d8601b4d755969dc96a9fc26081c"
    },
    {
      "path": "src/app/(identity)/cuenta/workspace-client.js",
      "previousSha256": "75ae3226996571c43e5a03f47df2241dc28425a00b804f8eb86600b0ea528858",
      "currentSha256": "943f71658a65f113b98ba4e900be95e1020858ba4d85a4431f1a51926ef597fa"
    },
    {
      "path": "src/lib/company-channel-kyc.mjs",
      "previousSha256": "5b18997e19675f3d08852485749c2482a1bb8412649747b512202915c61f2259",
      "currentSha256": "5b46276ad3aa5d656a0027be4a6bf58aa3fba4f557dd86e0c13d0d5b0cecba85"
    },
    {
      "path": "src/lib/company-channel-routing.mjs",
      "previousSha256": "82b83dbd787ed210415bf2e9acc38ea93a7b9c180cbcb0a70d010e862ac84d51",
      "currentSha256": "9ed740dbb4ae1ca7d44171f176f0001d824b056a0f17a8f58ed1ea5a5a2e2f68"
    },
    {
      "path": "src/lib/meta-field-conversation.mjs",
      "previousSha256": "f6891230831a4c0b6909770c1f20e96e8930ef0324b64aa01ab04b1cac6bec3b",
      "currentSha256": "a839410418cafdc915e827ff993f8d83b268cadec08157ff9a8906d27d61c6dc"
    },
    {
      "path": "src/lib/meta-kyc-context-feedback.mjs",
      "previousSha256": "45d3fe19bcd40c302a7b0bd24a29fb996583ed9cfaa50232803b4f4c95b232b9",
      "currentSha256": "c8e549ba41e57e637e754e0bef5cd52c2e14a96bab5400f598e4e5aff2249668"
    },
    {
      "path": "src/lib/meta-kyc-context-outbound.mjs",
      "previousSha256": "d9679d579f3f9994e36e3412cdf2cddc29db2c9ad2946cc8f48a767f417078c1",
      "currentSha256": "cdcf9465f36960b9b9c1252733f7b063538adfe3d4d0b4b15faef5f0d4a0bbfc"
    },
    {
      "path": "src/lib/meta-kyc-expiry-feedback.mjs",
      "previousSha256": "17ea8c4384981eacf2b0ab231474cf322176af9c8aedda2c7010d2d1bb5cd615",
      "currentSha256": "9734d647efc6daa72a2a69072d698f05d1edf3a0795b7476df4498aa1328e5a7"
    },
    {
      "path": "src/lib/meta-kyc-identity.mjs",
      "previousSha256": "427292fe2d4e08ea973eba880a5060dce64ba7d284f353601ed00ee4d5cce7b4",
      "currentSha256": "295f87ecb3b4586313a4f9c48a2d5c9acf8fa263682d99d44a966be243af2319"
    },
    {
      "path": "src/lib/meta-own-company-policy.mjs",
      "previousSha256": "00f36ef2c37394cd0509636454ab521b2306d7323ac5da7c46ea002f476fa00e",
      "currentSha256": "7db3875cd0f31fec077f4d9a4f8875be1ddf4a5772acff4559069ae950ff0821"
    },
    {
      "path": "src/lib/participant-kyc-chat-copy.mjs",
      "previousSha256": "82eda34190a5eb38e92a13167e1f1de1b5bb4ff6f817e5c2ec93cc658eb44927",
      "currentSha256": "d886219584d5e8b9d9db1ad16a36c726f6982fa0e8400c3be51af2623574ab96"
    }
  ],
  "validationDeltas": [
    {
      "path": ".gitattributes",
      "previousSha256": "5ff38c0d92b588ae71ac359f4411e4799d3d25273e6ee28fd4c049debccbd8c9",
      "currentSha256": "05e6be0315f3e37cbe5396e6083b54d830bd59abeb84381fdf5a5f571943ce46"
    },
    {
      "path": ".github/workflows/workspace-acceptance.yml",
      "previousSha256": "8b44d2a7f21958a9bf0383e6e5da963a09e3e2c28948b9b737cf268c90fd63b3",
      "currentSha256": "82075780c9ddb9530b47697ff0cacff6c4e73c0aba06999ab945151d7ff14858"
    },
    {
      "path": "scripts/lib/integrated-identity-current-ci-lineage.mjs",
      "previousSha256": "0589622d1111637cf170657b52bf71c9b74f1fb2e65cb7258b0dc68db25fed98",
      "currentSha256": "2b9b7f26beb8aa2ae1d6ba9cab9c1a0bee6c457ce5f17a0eb7ea8f1fcb7c9faa"
    },
    {
      "path": "scripts/lib/workspace-continuity-current-ci-lineage.mjs",
      "previousSha256": "c11c301a8c909a77e33dbd61d36eec0bfaa71f4689ba20f6f1685403dc093fec",
      "currentSha256": "e6290ab4d9bb76dc2d6855726d785bba6054b4037d6ed726937345019b11b596"
    },
    {
      "path": "scripts/verify-company-kyc-outbound-compact-ci.mjs",
      "previousSha256": "53b09460a0efe5c95db25ec9cbba9b59a53a8534dceef75d026b3f609d57c66e",
      "currentSha256": "d3a08f3d3c7027556cd2d517db29cb85b8b432f413de50079fd2f6cc46913b68"
    },
    {
      "path": "scripts/verify-consumption-feedback-ci.mjs",
      "previousSha256": "33eafd467efbd607111ccc933b0e138cef249ba9c096c634f0c6ecd1509a8c09",
      "currentSha256": "537c70c6accdccc8220fc438502dd1af4da7a6f5fa46cd0414f4f4b222240897"
    },
    {
      "path": "scripts/verify-focused-workspace-ci.mjs",
      "previousSha256": "b7d134ed370e7984f8aed315127b82e4d2bdebe20a6d0d79a7453bf7e1f63dab",
      "currentSha256": "a4eb59cb781eeb9578e46ffcdec21833cce1ba79eb9f99e3543fda799dfc62f4"
    },
    {
      "path": "tests/fixtures/company-kyc-memory.mjs",
      "previousSha256": "4d1e6188974235d2d6e7048e3260fef5a99c1f147654525b181f87cc28769723",
      "currentSha256": "3ee01bf26c409481edea5bcc1c3510fbeb86f6d48bdcf9fe8916ae1f2eb385cc"
    },
    {
      "path": "tests/fixtures/meta-kyc-chat-memory.mjs",
      "previousSha256": "2aefd8b380e45fd40cd1368a90c94add645415fa3337be8460045b6c9c11cf71",
      "currentSha256": "da195a128c41ed598fcb45def9eecdcc71020237e10c524d6cbcb89bc7745cc3"
    },
    {
      "path": "tests/production-company-kyc-outbound-compact-ci.test.mjs",
      "previousSha256": "65d64e2d68a371310893c12073f1cb3e186753a4bf4f85e1171d922ceff262b2",
      "currentSha256": "f5cf6fc2dd327058ca2e22196ab0bb9dfc436914f1eb39a0f1a8b8ef6b7c66f1"
    },
    {
      "path": "tests/production-field-outbound-current-ci-lineage.test.mjs",
      "previousSha256": "43b095e245845dbf4636bed107bae08a841956b5c304a6cee13b721a8d24989c",
      "currentSha256": "e132c85a3b4439ab6ea314907c82422fdddcaeb8aee9ca72e5dc0037784722be"
    },
    {
      "path": "tests/production-focused-workspace-ci.test.mjs",
      "previousSha256": "cbba731e7ea3c1db48406827118f5b569d2c50d6c015f6c0b45d476fd5259c6b",
      "currentSha256": "fa7cce48eb957bc56a7465fa6b61cf05a4083caae6d7bd40e431c12feef3cb79"
    },
    {
      "path": "tests/production-focused-workspace-continuity-ui.test.mjs",
      "previousSha256": "90d44767054e7dc0732caf71d8a3a2e6950d0829870cf60dcf03061cd3a9417c",
      "currentSha256": "e839e4aee67df7c2558a6fdfced25310c4e9cab0d95ae1b605b0158d9004e37b"
    },
    {
      "path": "tests/production-integrated-identity-current-ci-lineage.test.mjs",
      "previousSha256": "a5ed6df6a488480c258a3d3db9affb77f2d462d227f0d5fde75a2059075291af",
      "currentSha256": "8496a01877f9de82945b4d0ff0cf6431b71e70e9a320319f8acd66a1aa09d982"
    },
    {
      "path": "tests/production-kyc-reply-feedback-current-lineage.test.mjs",
      "previousSha256": "43649a2c500301f4e3e872f086a3dff327c72591d1251dd59bc067b1292ef282",
      "currentSha256": "4f78c3c6f93460cb4764358c4fc2fee1480df851af6aea9d53037e6314bccde4"
    },
    {
      "path": "tests/production-material-consumption-feedback-ci.test.mjs",
      "previousSha256": "4342158578f2589c07b6e605582395549c45cf634e5a412ebab8ce5f4bf990ea",
      "currentSha256": "87d154dce14a4d4aaa72b4ec05237cf57f62aef33e3fb4256571d8ed633b3c60"
    },
    {
      "path": "tests/production-meta-customer-composition.test.mjs",
      "previousSha256": "5820c8eb8d54275ca8970e18d25e16b1b59fd3b08a7d5439186851748dae4654",
      "currentSha256": "9ecee8c303ac76c4b0f755464015ce2445a315b0e21c3c16d4e200f7640e6997"
    },
    {
      "path": "tests/production-meta-routing-discovery.test.mjs",
      "previousSha256": "fda63e8e1ae132c51327a81b3ab78f536895915d7bb2f493d0f68f9dfb7741bd",
      "currentSha256": "42e273574d66cb692ba391c1d278a69b7adda3b12b7c0319603a8a8024054b8f"
    },
    {
      "path": "tests/production-ooxml-accounting-current-ci-lineage.test.mjs",
      "previousSha256": "b21de4ac898eea69683adeba44d66aba170ad6cd8625c75203f307bef68d4762",
      "currentSha256": "54d7eecb5adfa295bb71d6e85c682cc62becae79f45def26da360c6e89181105"
    },
    {
      "path": "tests/production-participant-preanalysis-current-ci-lineage.test.mjs",
      "previousSha256": "6cb2d234dd3eee662cab7d713da8477c9c4933f176b519ee3f456c0619cccaca",
      "currentSha256": "12e14b7574906a4492b73437feea48478e2e05447456fdd7fbbce11eb61a5fa5"
    },
    {
      "path": "tests/production-plan-measurement-current-ci-lineage.test.mjs",
      "previousSha256": "81672df862a520d56b3046f625a6cbcdb17b02f10cb3246345e9187217eee75c",
      "currentSha256": "c55ffae0870fde49a795842c77fca3a9657b0efb687ea3487787ded2ebdb21ee"
    },
    {
      "path": "tests/production-plan-measurement-document-association-ci-lineage.test.mjs",
      "previousSha256": "3b64c238a093e1af4ffebd61d664c780635042bf370c4b7e5254ffbe386782ea",
      "currentSha256": "6e1424a595ed5be8ee7111a4aa0edc031e10678f8da0ec2c337cd9d9da2281cd"
    },
    {
      "path": "tests/production-whatsapp-feedback-workspace-ci.test.mjs",
      "previousSha256": "e3729bc7083843ae395f189e9ede2e80cc973794d0a164eaa9dc011e702930d8",
      "currentSha256": "6ea3caa05bd7847b13c0d48cc4883e1bbe8cbba07e6f8849125d9544c509445a"
    },
    {
      "path": "tests/production-workspace-continuity-current-ci-lineage.test.mjs",
      "previousSha256": "491f043c638e52e6d00ea4551a9ac5688e92286225ddadb3e95d552fdea65661",
      "currentSha256": "b68b3ebacd8cdf29c9d2f7b791c24d05e748c9c1d603fe7953c31de18c8fc990"
    }
  ],
  "addedSources": [
    {
      "path": "scripts/lib/kyc-neutral-step-guidance-native.mjs",
      "sha256": "ddfd08e00f35b3f33254eed513d7bba81ec9791b23ca0d078362132fd24d546e"
    },
    {
      "path": "scripts/lib/kyc-neutral-step-guidance-own-native.mjs",
      "sha256": "8e417c9d93d3a265b7ea7dc34b81737454286b573fd3738a6cfc37f0a5520955"
    },
    {
      "path": "scripts/verify-field-task-pagination-ci.mjs",
      "sha256": "fe25cce6cecd014c923852c09f7eccb9431efd33805eb8bbad03bea79997a94d"
    },
    {
      "path": "scripts/verify-field-task-pagination-ui.mjs",
      "sha256": "4b98ee409dfca7fa78ffac58c82796c9013f34286691e19e4993149ffd0ad604"
    },
    {
      "path": "src/app/(identity)/cuenta/worksite-task-selector.js",
      "sha256": "d790aeec929ed1ef2ac724883988b03f6640f3882133d917760f0ddeb2a2488c"
    },
    {
      "path": "src/app/(identity)/cuenta/worksite-task-selector.module.css",
      "sha256": "12351228e827ea0e9a42a45f4d40a3fb713edd01bf0aab3ab6f58efbde7fa434"
    },
    {
      "path": "src/app/(identity)/cuenta/workspace-task-page.mjs",
      "sha256": "9dde484ab352b4d64d0301e735ae511d7a75ef9633439e77558dd273de1d9aa6"
    },
    {
      "path": "tests/production-field-task-pagination-ci.test.mjs",
      "sha256": "0d8abfb43c696a007bbc676d8472599b24cc3d7edb465419f992d9811f988999"
    },
    {
      "path": "tests/production-focused-workspace-task-pagination.test.mjs",
      "sha256": "9821b448d023f626372453485fb9a2cf81c1f0d75d918c8e32bec916f989be25"
    },
    {
      "path": "tests/production-meta-kyc-feedback-query-composition.test.mjs",
      "sha256": "776cb847320b65ecc3ad8f2d8e8be8bb3eb43fd38764bcd4c4aa878c8c1dd77c"
    },
    {
      "path": "tests/production-meta-kyc-neutral-step-guidance.test.mjs",
      "sha256": "bf9bbf5f7a7cec81e733f07897d5b866f62418fe00571e120827f9d55e23a87d"
    },
    {
      "path": "tests/production-meta-kyc-own-lock-order.test.mjs",
      "sha256": "f22b97294dd5b65414a70943aeeffdb5eb87272a5540216dfcef5c871b599d41"
    },
    {
      "path": "tests/production-whatsapp-menu-continuity.test.mjs",
      "sha256": "538692c0e4be18bec85867134cc5d58119e996f7fac4748df562adc34711c606"
    },
    {
      "path": "tests/production-worksite-task-selector.test.mjs",
      "sha256": "15d764467be94b0f84cc0988d969458ee52660d6f1d2f4c7c5cb96d5d9125a7f"
    },
    {
      "path": "tests/production-workspace-task-page.test.mjs",
      "sha256": "9bed3622f630c43c4069ce8cb0a8c4fa6a42a262a6550cc0f9e6ef83220e3fb6"
    }
  ],
  "proofSourceDeltas": [
    {
      "id": "company-kyc-postgres",
      "family": "PG_COMPANY_KYC",
      "previousCount": 234,
      "previousPathsSha256": "8518028e316557ff1920c4395e6cf9c5a3a3b682e0f3dc5646f74d3224dd16b8",
      "currentCount": 235,
      "currentPathsSha256": "1a26e97cd22fbf77d620e29b20e50c3b01365d205160c2e476a38fc7dc072899",
      "additions": [
        "scripts/lib/kyc-neutral-step-guidance-native.mjs"
      ]
    },
    {
      "id": "identity-only-ui",
      "family": "UI_IDENTITY_ONLY",
      "previousCount": 144,
      "previousPathsSha256": "35aa758b5c040065d0d104c2a75ca049294b8823c8da9e41693359c1941e8e57",
      "currentCount": 147,
      "currentPathsSha256": "d157ca1cec4db1f3139cd33c9674f998655f8ad83c740ae942dd769ffdd5abf0",
      "additions": [
        "src/app/(identity)/cuenta/worksite-task-selector.js",
        "src/app/(identity)/cuenta/worksite-task-selector.module.css",
        "src/app/(identity)/cuenta/workspace-task-page.mjs"
      ]
    },
    {
      "id": "participant-kyc-preanalysis-postgres",
      "family": "PG_PARTICIPANT_KYC_PREANALYSIS",
      "previousCount": 233,
      "previousPathsSha256": "9844cc0014597fcedda24f4ac25cf6a7c1a7c3bfdb8a37f9510e76388aa5642f",
      "currentCount": 235,
      "currentPathsSha256": "71c09c50336b9e87cd1da0de7618209175846b70f6d5d890432d274ca039aed2",
      "additions": [
        "scripts/lib/whatsapp-field-continuity-current-ci-lineage.mjs",
        "tests/fixtures/whatsapp-field-continuity-contract-052.json"
      ]
    },
    {
      "id": "focused-workspace-ui",
      "family": "UI_FOCUSED_WORKSPACE",
      "previousCount": 174,
      "previousPathsSha256": "e0d4ef354cade414d88d8d0348ed818d9bd0447b26a3bba38d8a7c8cbebf51d4",
      "currentCount": 180,
      "currentPathsSha256": "5163b57706633f09f8f66345b4694326b36d208b3f21206191cd388d23505961",
      "additions": [
        "scripts/lib/whatsapp-field-continuity-current-ci-lineage.mjs",
        "src/app/(identity)/cuenta/worksite-task-selector.js",
        "src/app/(identity)/cuenta/worksite-task-selector.module.css",
        "src/app/(identity)/cuenta/workspace-task-page.mjs",
        "tests/fixtures/whatsapp-field-continuity-contract-052.json",
        "tests/production-focused-workspace-task-pagination.test.mjs"
      ]
    }
  ],
  "sourceSetDeltas": [
    {
      "family": "COMPACT",
      "previousCount": 137,
      "previousPathsSha256": "ab60b810e098f47892e1a17cb01ce1f7f8e1796c1687776b528100e62cb3083f",
      "currentCount": 139,
      "currentPathsSha256": "cd474d8e9a3b754daaeef61f986e31f1c92997a8423cd9a14c06d43ea706dbea",
      "additions": [
        "scripts/lib/kyc-neutral-step-guidance-native.mjs",
        "scripts/lib/kyc-neutral-step-guidance-own-native.mjs"
      ],
      "currentFiles": [
        "package-lock.json",
        "package.json",
        "scripts/lib/company-channel-disposable-fixture.mjs",
        "scripts/lib/company-channel-migration.mjs",
        "scripts/lib/disposable-postgres-cleanup.mjs",
        "scripts/lib/kyc-current-image-native.mjs",
        "scripts/lib/kyc-current-image-own-native.mjs",
        "scripts/lib/kyc-neutral-step-guidance-native.mjs",
        "scripts/lib/kyc-neutral-step-guidance-own-native.mjs",
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
        "src/lib/meta-kyc-current-image.mjs",
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
        "src/lib/participant-kyc-chat-copy.mjs",
        "src/lib/participant-kyc-image-set.mjs",
        "src/lib/participant-kyc-notice-links.mjs",
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
      "family": "CONSUMPTION_FEEDBACK_UI",
      "previousCount": 20,
      "previousPathsSha256": "1083db1ab59ad3633942fd88c27b9894a5e728419da2800a9ce3c912c555ca7a",
      "currentCount": 22,
      "currentPathsSha256": "a199678963148d623e1312081691b3fd29930e215474b08838b368bad04dc0ac",
      "additions": [
        "src/app/(identity)/cuenta/worksite-task-selector.js",
        "src/app/(identity)/cuenta/worksite-task-selector.module.css"
      ],
      "currentFiles": [
        "src/app/(identity)/cuenta/company-channel-view.mjs",
        "src/app/(identity)/cuenta/material-inventory-panel.js",
        "src/app/(identity)/cuenta/material-inventory-panel.module.css",
        "src/app/(identity)/cuenta/material-inventory-view.mjs",
        "src/app/(identity)/cuenta/own-company-number-view.mjs",
        "src/app/(identity)/cuenta/own-company-templates-view.mjs",
        "src/app/(identity)/cuenta/participant-office-account-view.mjs",
        "src/app/(identity)/cuenta/plan-baseline-view.mjs",
        "src/app/(identity)/cuenta/plan-source-curve.mjs",
        "src/app/(identity)/cuenta/private-bank-account-format.mjs",
        "src/app/(identity)/cuenta/site-purchase-view.mjs",
        "src/app/(identity)/cuenta/template-send-view.mjs",
        "src/app/(identity)/cuenta/worksite-task-selector.js",
        "src/app/(identity)/cuenta/worksite-task-selector.module.css",
        "src/app/(identity)/cuenta/workspace-recovery-journal.mjs",
        "src/app/(identity)/cuenta/workspace-recovery-panel.js",
        "src/app/(identity)/cuenta/workspace-recovery-storage.mjs",
        "src/app/(identity)/cuenta/workspace-request-lifecycle.js",
        "src/app/(identity)/cuenta/workspace-request-lifecycle.mjs",
        "src/app/(identity)/cuenta/workspace-session-request.mjs",
        "src/app/(identity)/cuenta/workspace.module.css",
        "src/lib/plan-import-document-curve.mjs"
      ]
    }
  ],
  "currentProofChanges": [
    {
      "id": "company-kyc-postgres",
      "previousProducerSha256": "a1410e44be6b7aaaf5a2e036263cbf1106cbe928551b2ceabe465d3576cd5973",
      "currentProducerSha256": "212a3f1ac6993954681a765635034ed0e48ac038db0ad3c6159df603ce049903",
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
        "COMPANY-context-native-original-60s-lease-225ms-SQL-200ms-Graph-single-POST",
        "COMPANY-CURRENT-image-native-signed-production-priority-three-images-causal-receipts-locks-rollback-recovery-and-current-fences"
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
      "id": "focused-workspace-ui",
      "previousProducerSha256": "b7d134ed370e7984f8aed315127b82e4d2bdebe20a6d0d79a7453bf7e1f63dab",
      "currentProducerSha256": "a4eb59cb781eeb9578e46ffcdec21833cce1ba79eb9f99e3543fda799dfc62f4",
      "previousCheckNames": [
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
        "three-step-synthetic-identity-explicit-consents-and-unknown-receipt-survive-navigation-1440",
        "fresh-list-project-preserves-section-no-POST-320",
        "fresh-list-project-preserves-section-no-POST-390",
        "fresh-list-project-preserves-section-no-POST-1440",
        "refresh-does-not-restore-old-view-list-role-390",
        "refresh-does-not-restore-old-view-list-scope-390",
        "refresh-does-not-restore-old-view-list-missing-390",
        "refresh-does-not-restore-old-view-list-401-390",
        "refresh-does-not-restore-old-view-list-403-390",
        "refresh-does-not-restore-old-view-list-500-390",
        "refresh-does-not-restore-old-view-project-401-390",
        "refresh-does-not-restore-old-view-project-403-390",
        "refresh-does-not-restore-old-view-project-500-390",
        "refresh-does-not-restore-old-view-project-scope-390",
        "refresh-does-not-restore-old-view-project-id-390",
        "refresh-does-not-restore-old-view-project-null-390",
        "refresh-truncated-list-promotes-fresh-canonical-project-390",
        "refresh-truncated-list-denial-keeps-old-view-closed-390",
        "refresh-truncated-list-inactive-project-keeps-old-view-closed-390",
        "refresh-private-KYC-denial-keeps-only-private-presentation-390",
        "refresh-office-selection-uses-fresh-listed-context-without-operational-GET-390",
        "refresh-late-list-cannot-reenter-rotated-session-390",
        "refresh-late-project-cannot-reenter-unmounted-workspace-390",
        "bootstrap-ready-receipt-compact-disclosure-trial-no-POST-320",
        "bootstrap-ready-receipt-compact-disclosure-trial-no-POST-390",
        "bootstrap-ready-receipt-compact-disclosure-trial-no-POST-1440"
      ],
      "currentCheckNames": [
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
        "three-step-synthetic-identity-explicit-consents-and-unknown-receipt-survive-navigation-1440",
        "fresh-list-project-preserves-section-no-POST-320",
        "fresh-list-project-preserves-section-no-POST-390",
        "fresh-list-project-preserves-section-no-POST-1440",
        "refresh-does-not-restore-old-view-list-role-390",
        "refresh-does-not-restore-old-view-list-scope-390",
        "refresh-does-not-restore-old-view-list-missing-390",
        "refresh-does-not-restore-old-view-list-401-390",
        "refresh-does-not-restore-old-view-list-403-390",
        "refresh-does-not-restore-old-view-list-500-390",
        "refresh-does-not-restore-old-view-project-401-390",
        "refresh-does-not-restore-old-view-project-403-390",
        "refresh-does-not-restore-old-view-project-500-390",
        "refresh-does-not-restore-old-view-project-scope-390",
        "refresh-does-not-restore-old-view-project-id-390",
        "refresh-does-not-restore-old-view-project-null-390",
        "refresh-truncated-list-promotes-fresh-canonical-project-390",
        "refresh-truncated-list-denial-keeps-old-view-closed-390",
        "refresh-truncated-list-inactive-project-keeps-old-view-closed-390",
        "refresh-private-KYC-denial-keeps-only-private-presentation-390",
        "refresh-office-selection-uses-fresh-listed-context-without-operational-GET-390",
        "refresh-late-list-cannot-reenter-rotated-session-390",
        "refresh-late-project-cannot-reenter-unmounted-workspace-390",
        "bootstrap-ready-receipt-compact-disclosure-trial-no-POST-320",
        "bootstrap-ready-receipt-compact-disclosure-trial-no-POST-390",
        "bootstrap-ready-receipt-compact-disclosure-trial-no-POST-1440",
        "account-task-pages-draft-100-200-205-single-GET-field-320",
        "account-task-pages-draft-100-200-205-single-GET-inventory-320",
        "account-task-pages-draft-100-200-205-single-GET-field-390",
        "account-task-pages-draft-100-200-205-single-GET-inventory-390",
        "account-task-pages-draft-100-200-205-single-GET-field-1440",
        "account-task-pages-draft-100-200-205-single-GET-inventory-1440",
        "account-task-pages-503-retry-field-390",
        "account-task-pages-403-clear-field-390",
        "account-task-pages-busy-uncertain-and-late-page-field-390",
        "account-task-pages-503-retry-inventory-390",
        "account-task-pages-403-clear-inventory-390",
        "account-task-pages-busy-uncertain-and-late-page-inventory-390",
        "account-task-pages-404-revoked-clear-field-390",
        "account-task-pages-404-revoked-clear-inventory-390"
      ]
    }
  ],
  "focusedUi": {
    "status": "REVIEWED_FROZEN_CURRENT_SOURCE",
    "ciVersion": "focused-workspace-ci-v3",
    "rawVersion": 4,
    "previousRawVersion": 2,
    "previousCheckCount": 20,
    "previousTotalCheckCount": 45,
    "previousCheckNames": [
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
      "three-step-synthetic-identity-explicit-consents-and-unknown-receipt-survive-navigation-1440",
      "fresh-list-project-preserves-section-no-POST-320",
      "fresh-list-project-preserves-section-no-POST-390",
      "fresh-list-project-preserves-section-no-POST-1440",
      "refresh-does-not-restore-old-view-list-role-390",
      "refresh-does-not-restore-old-view-list-scope-390",
      "refresh-does-not-restore-old-view-list-missing-390",
      "refresh-does-not-restore-old-view-list-401-390",
      "refresh-does-not-restore-old-view-list-403-390",
      "refresh-does-not-restore-old-view-list-500-390",
      "refresh-does-not-restore-old-view-project-401-390",
      "refresh-does-not-restore-old-view-project-403-390",
      "refresh-does-not-restore-old-view-project-500-390",
      "refresh-does-not-restore-old-view-project-scope-390",
      "refresh-does-not-restore-old-view-project-id-390",
      "refresh-does-not-restore-old-view-project-null-390",
      "refresh-truncated-list-promotes-fresh-canonical-project-390",
      "refresh-truncated-list-denial-keeps-old-view-closed-390",
      "refresh-truncated-list-inactive-project-keeps-old-view-closed-390",
      "refresh-private-KYC-denial-keeps-only-private-presentation-390",
      "refresh-office-selection-uses-fresh-listed-context-without-operational-GET-390",
      "refresh-late-list-cannot-reenter-rotated-session-390",
      "refresh-late-project-cannot-reenter-unmounted-workspace-390",
      "bootstrap-ready-receipt-compact-disclosure-trial-no-POST-320",
      "bootstrap-ready-receipt-compact-disclosure-trial-no-POST-390",
      "bootstrap-ready-receipt-compact-disclosure-trial-no-POST-1440"
    ],
    "checkNames": [
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
      "three-step-synthetic-identity-explicit-consents-and-unknown-receipt-survive-navigation-1440",
      "fresh-list-project-preserves-section-no-POST-320",
      "fresh-list-project-preserves-section-no-POST-390",
      "fresh-list-project-preserves-section-no-POST-1440",
      "refresh-does-not-restore-old-view-list-role-390",
      "refresh-does-not-restore-old-view-list-scope-390",
      "refresh-does-not-restore-old-view-list-missing-390",
      "refresh-does-not-restore-old-view-list-401-390",
      "refresh-does-not-restore-old-view-list-403-390",
      "refresh-does-not-restore-old-view-list-500-390",
      "refresh-does-not-restore-old-view-project-401-390",
      "refresh-does-not-restore-old-view-project-403-390",
      "refresh-does-not-restore-old-view-project-500-390",
      "refresh-does-not-restore-old-view-project-scope-390",
      "refresh-does-not-restore-old-view-project-id-390",
      "refresh-does-not-restore-old-view-project-null-390",
      "refresh-truncated-list-promotes-fresh-canonical-project-390",
      "refresh-truncated-list-denial-keeps-old-view-closed-390",
      "refresh-truncated-list-inactive-project-keeps-old-view-closed-390",
      "refresh-private-KYC-denial-keeps-only-private-presentation-390",
      "refresh-office-selection-uses-fresh-listed-context-without-operational-GET-390",
      "refresh-late-list-cannot-reenter-rotated-session-390",
      "refresh-late-project-cannot-reenter-unmounted-workspace-390",
      "bootstrap-ready-receipt-compact-disclosure-trial-no-POST-320",
      "bootstrap-ready-receipt-compact-disclosure-trial-no-POST-390",
      "bootstrap-ready-receipt-compact-disclosure-trial-no-POST-1440",
      "account-task-pages-draft-100-200-205-single-GET-field-320",
      "account-task-pages-draft-100-200-205-single-GET-inventory-320",
      "account-task-pages-draft-100-200-205-single-GET-field-390",
      "account-task-pages-draft-100-200-205-single-GET-inventory-390",
      "account-task-pages-draft-100-200-205-single-GET-field-1440",
      "account-task-pages-draft-100-200-205-single-GET-inventory-1440",
      "account-task-pages-503-retry-field-390",
      "account-task-pages-403-clear-field-390",
      "account-task-pages-busy-uncertain-and-late-page-field-390",
      "account-task-pages-503-retry-inventory-390",
      "account-task-pages-403-clear-inventory-390",
      "account-task-pages-busy-uncertain-and-late-page-inventory-390",
      "account-task-pages-404-revoked-clear-field-390",
      "account-task-pages-404-revoked-clear-inventory-390"
    ],
    "continuityCheckNames": [
      "fresh-list-project-preserves-section-no-POST-320",
      "fresh-list-project-preserves-section-no-POST-390",
      "fresh-list-project-preserves-section-no-POST-1440",
      "refresh-does-not-restore-old-view-list-role-390",
      "refresh-does-not-restore-old-view-list-scope-390",
      "refresh-does-not-restore-old-view-list-missing-390",
      "refresh-does-not-restore-old-view-list-401-390",
      "refresh-does-not-restore-old-view-list-403-390",
      "refresh-does-not-restore-old-view-list-500-390",
      "refresh-does-not-restore-old-view-project-401-390",
      "refresh-does-not-restore-old-view-project-403-390",
      "refresh-does-not-restore-old-view-project-500-390",
      "refresh-does-not-restore-old-view-project-scope-390",
      "refresh-does-not-restore-old-view-project-id-390",
      "refresh-does-not-restore-old-view-project-null-390",
      "refresh-truncated-list-promotes-fresh-canonical-project-390",
      "refresh-truncated-list-denial-keeps-old-view-closed-390",
      "refresh-truncated-list-inactive-project-keeps-old-view-closed-390",
      "refresh-private-KYC-denial-keeps-only-private-presentation-390",
      "refresh-office-selection-uses-fresh-listed-context-without-operational-GET-390",
      "refresh-late-list-cannot-reenter-rotated-session-390",
      "refresh-late-project-cannot-reenter-unmounted-workspace-390",
      "bootstrap-ready-receipt-compact-disclosure-trial-no-POST-320",
      "bootstrap-ready-receipt-compact-disclosure-trial-no-POST-390",
      "bootstrap-ready-receipt-compact-disclosure-trial-no-POST-1440"
    ],
    "taskPagingCheckNames": [
      "account-task-pages-draft-100-200-205-single-GET-field-320",
      "account-task-pages-draft-100-200-205-single-GET-inventory-320",
      "account-task-pages-draft-100-200-205-single-GET-field-390",
      "account-task-pages-draft-100-200-205-single-GET-inventory-390",
      "account-task-pages-draft-100-200-205-single-GET-field-1440",
      "account-task-pages-draft-100-200-205-single-GET-inventory-1440",
      "account-task-pages-503-retry-field-390",
      "account-task-pages-403-clear-field-390",
      "account-task-pages-busy-uncertain-and-late-page-field-390",
      "account-task-pages-503-retry-inventory-390",
      "account-task-pages-403-clear-inventory-390",
      "account-task-pages-busy-uncertain-and-late-page-inventory-390",
      "account-task-pages-404-revoked-clear-field-390",
      "account-task-pages-404-revoked-clear-inventory-390"
    ],
    "widths": [
      390,
      1440
    ],
    "continuityWidths": [
      320,
      390,
      1440
    ],
    "taskPagingWidths": [
      320,
      390,
      1440
    ],
    "previousUnitFiles": [
      "tests/production-focused-workspace-navigation.test.mjs",
      "tests/production-focused-workspace-ui.test.mjs",
      "tests/production-focused-workspace-ci.test.mjs"
    ],
    "continuityUnitFiles": [
      "tests/production-focused-workspace-navigation.test.mjs",
      "tests/production-focused-workspace-ui.test.mjs",
      "tests/production-focused-workspace-ci.test.mjs",
      "tests/production-focused-workspace-continuity-ui.test.mjs",
      "tests/production-company-bootstrap-receipt.test.mjs"
    ],
    "unitFiles": [
      "tests/production-focused-workspace-navigation.test.mjs",
      "tests/production-focused-workspace-ui.test.mjs",
      "tests/production-focused-workspace-ci.test.mjs",
      "tests/production-focused-workspace-continuity-ui.test.mjs",
      "tests/production-company-bootstrap-receipt.test.mjs",
      "tests/production-focused-workspace-task-pagination.test.mjs"
    ],
    "requestMatrix": [
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/project-preparation",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/project-creation",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/office-review",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/project-preparation",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/project-creation",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/office-review",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/project-preparation",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/project-creation",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/office-review",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/project-preparation",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/project-creation",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/office-review",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/participants",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/project-preparation",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/project-creation",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/office-review",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 390,
        "role": "AUDITOR",
        "mode": "navigation",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null
      },
      {
        "width": 390,
        "role": "AUDITOR",
        "mode": "navigation",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/project-preparation",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/project-creation",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/office-review",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/participants",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 390,
        "role": "AUDITOR",
        "mode": "navigation",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null
      },
      {
        "width": 390,
        "role": "AUDITOR",
        "mode": "navigation",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "company-without-selection",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "company-without-selection",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "company-without-selection",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "empty-company",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "empty-company",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "empty-company",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "wizard",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "wizard",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "wizard",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "wizard",
        "path": "/api/identity/project-preparation",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "wizard",
        "path": "/api/identity/project-creation",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "wizard",
        "path": "/api/identity/office-review",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "wizard",
        "path": "/api/identity/participants",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "wizard",
        "path": "/api/identity/participants",
        "method": "POST",
        "projectId": "project-a",
        "explicitFinalStep": true,
        "actualRecoveryJournalReferencePreserved": true
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/project-preparation",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/project-creation",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/office-review",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/project-preparation",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/project-creation",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/office-review",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/participants",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/project-preparation",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/project-creation",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/office-review",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 1440,
        "role": "AUDITOR",
        "mode": "navigation",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null
      },
      {
        "width": 1440,
        "role": "AUDITOR",
        "mode": "navigation",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/project-preparation",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/project-creation",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/office-review",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "navigation",
        "path": "/api/identity/participants",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 1440,
        "role": "AUDITOR",
        "mode": "navigation",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null
      },
      {
        "width": 1440,
        "role": "AUDITOR",
        "mode": "navigation",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "company-without-selection",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "company-without-selection",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "company-without-selection",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "empty-company",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "empty-company",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "empty-company",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "wizard",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "wizard",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "wizard",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "wizard",
        "path": "/api/identity/project-preparation",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "wizard",
        "path": "/api/identity/project-creation",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "wizard",
        "path": "/api/identity/office-review",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "wizard",
        "path": "/api/identity/participants",
        "method": "GET",
        "projectId": "project-a"
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "wizard",
        "path": "/api/identity/participants",
        "method": "POST",
        "projectId": "project-a",
        "explicitFinalStep": true,
        "actualRecoveryJournalReferencePreserved": true
      },
      {
        "width": 320,
        "role": "ADMIN",
        "mode": "continuity-success",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "phase": 0,
        "responseStatus": 200
      },
      {
        "width": 320,
        "role": "ADMIN",
        "mode": "continuity-success",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 200
      },
      {
        "width": 320,
        "role": "ADMIN",
        "mode": "continuity-success",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null,
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 320,
        "role": "ADMIN",
        "mode": "continuity-success",
        "path": "/api/identity/project-preparation",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 320,
        "role": "ADMIN",
        "mode": "continuity-success",
        "path": "/api/identity/project-creation",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 320,
        "role": "ADMIN",
        "mode": "continuity-success",
        "path": "/api/identity/office-review",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 320,
        "role": "ADMIN",
        "mode": "continuity-success",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "phase": 1,
        "responseStatus": 200
      },
      {
        "width": 320,
        "role": "ADMIN",
        "mode": "continuity-success",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "phase": 1,
        "responseStatus": 200
      },
      {
        "width": 320,
        "role": "ADMIN",
        "mode": "continuity-success",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null,
        "phase": 1,
        "responseStatus": 403
      },
      {
        "width": 320,
        "role": "ADMIN",
        "mode": "continuity-success",
        "path": "/api/identity/project-preparation",
        "method": "GET",
        "projectId": "project-a",
        "phase": 1,
        "responseStatus": 403
      },
      {
        "width": 320,
        "role": "ADMIN",
        "mode": "continuity-success",
        "path": "/api/identity/project-creation",
        "method": "GET",
        "projectId": "project-a",
        "phase": 1,
        "responseStatus": 403
      },
      {
        "width": 320,
        "role": "ADMIN",
        "mode": "continuity-success",
        "path": "/api/identity/office-review",
        "method": "GET",
        "projectId": "project-a",
        "phase": 1,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-success",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "phase": 0,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-success",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-success",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null,
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-success",
        "path": "/api/identity/project-preparation",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-success",
        "path": "/api/identity/project-creation",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-success",
        "path": "/api/identity/office-review",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-success",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "phase": 1,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-success",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "phase": 1,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-success",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null,
        "phase": 1,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-success",
        "path": "/api/identity/project-preparation",
        "method": "GET",
        "projectId": "project-a",
        "phase": 1,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-success",
        "path": "/api/identity/project-creation",
        "method": "GET",
        "projectId": "project-a",
        "phase": 1,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-success",
        "path": "/api/identity/office-review",
        "method": "GET",
        "projectId": "project-a",
        "phase": 1,
        "responseStatus": 403
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "continuity-success",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "phase": 0,
        "responseStatus": 200
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "continuity-success",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 200
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "continuity-success",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null,
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "continuity-success",
        "path": "/api/identity/project-preparation",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "continuity-success",
        "path": "/api/identity/project-creation",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "continuity-success",
        "path": "/api/identity/office-review",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "continuity-success",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "phase": 1,
        "responseStatus": 200
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "continuity-success",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "phase": 1,
        "responseStatus": 200
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "continuity-success",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null,
        "phase": 1,
        "responseStatus": 403
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "continuity-success",
        "path": "/api/identity/project-preparation",
        "method": "GET",
        "projectId": "project-a",
        "phase": 1,
        "responseStatus": 403
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "continuity-success",
        "path": "/api/identity/project-creation",
        "method": "GET",
        "projectId": "project-a",
        "phase": 1,
        "responseStatus": 403
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "continuity-success",
        "path": "/api/identity/office-review",
        "method": "GET",
        "projectId": "project-a",
        "phase": 1,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-list-role",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "phase": 0,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-list-role",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-list-role",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null,
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-list-role",
        "path": "/api/identity/project-preparation",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-list-role",
        "path": "/api/identity/project-creation",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-list-role",
        "path": "/api/identity/office-review",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-list-role",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "phase": 1,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-list-scope",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "phase": 0,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-list-scope",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-list-scope",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null,
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-list-scope",
        "path": "/api/identity/project-preparation",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-list-scope",
        "path": "/api/identity/project-creation",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-list-scope",
        "path": "/api/identity/office-review",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-list-scope",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "phase": 1,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-list-scope",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null,
        "phase": 1,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-list-missing",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "phase": 0,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-list-missing",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-list-missing",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null,
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-list-missing",
        "path": "/api/identity/project-preparation",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-list-missing",
        "path": "/api/identity/project-creation",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-list-missing",
        "path": "/api/identity/office-review",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-list-missing",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "phase": 1,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-list-missing",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null,
        "phase": 1,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-list-401",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "phase": 0,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-list-401",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-list-401",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null,
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-list-401",
        "path": "/api/identity/project-preparation",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-list-401",
        "path": "/api/identity/project-creation",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-list-401",
        "path": "/api/identity/office-review",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-list-401",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "phase": 1,
        "responseStatus": 401
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-list-403",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "phase": 0,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-list-403",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-list-403",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null,
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-list-403",
        "path": "/api/identity/project-preparation",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-list-403",
        "path": "/api/identity/project-creation",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-list-403",
        "path": "/api/identity/office-review",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-list-403",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "phase": 1,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-list-500",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "phase": 0,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-list-500",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-list-500",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null,
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-list-500",
        "path": "/api/identity/project-preparation",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-list-500",
        "path": "/api/identity/project-creation",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-list-500",
        "path": "/api/identity/office-review",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-list-500",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "phase": 1,
        "responseStatus": 500
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-project-401",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "phase": 0,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-project-401",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-project-401",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null,
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-project-401",
        "path": "/api/identity/project-preparation",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-project-401",
        "path": "/api/identity/project-creation",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-project-401",
        "path": "/api/identity/office-review",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-project-401",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "phase": 1,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-project-401",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "phase": 1,
        "responseStatus": 401
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-project-401",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null,
        "phase": 1,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-project-403",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "phase": 0,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-project-403",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-project-403",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null,
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-project-403",
        "path": "/api/identity/project-preparation",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-project-403",
        "path": "/api/identity/project-creation",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-project-403",
        "path": "/api/identity/office-review",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-project-403",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "phase": 1,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-project-403",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "phase": 1,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-project-403",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null,
        "phase": 1,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-project-500",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "phase": 0,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-project-500",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-project-500",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null,
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-project-500",
        "path": "/api/identity/project-preparation",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-project-500",
        "path": "/api/identity/project-creation",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-project-500",
        "path": "/api/identity/office-review",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-project-500",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "phase": 1,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-project-500",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "phase": 1,
        "responseStatus": 500
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-project-500",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null,
        "phase": 1,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-project-scope",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "phase": 0,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-project-scope",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-project-scope",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null,
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-project-scope",
        "path": "/api/identity/project-preparation",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-project-scope",
        "path": "/api/identity/project-creation",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-project-scope",
        "path": "/api/identity/office-review",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-project-scope",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "phase": 1,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-project-scope",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "phase": 1,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-project-scope",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null,
        "phase": 1,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-project-id",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "phase": 0,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-project-id",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-project-id",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null,
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-project-id",
        "path": "/api/identity/project-preparation",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-project-id",
        "path": "/api/identity/project-creation",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-project-id",
        "path": "/api/identity/office-review",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-project-id",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "phase": 1,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-project-id",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "phase": 1,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-project-id",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null,
        "phase": 1,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-project-null",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "phase": 0,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-project-null",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-project-null",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null,
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-project-null",
        "path": "/api/identity/project-preparation",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-project-null",
        "path": "/api/identity/project-creation",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-project-null",
        "path": "/api/identity/office-review",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-project-null",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "phase": 1,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-project-null",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "phase": 1,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-project-null",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null,
        "phase": 1,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-truncated-success",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "phase": 0,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-truncated-success",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-truncated-success",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null,
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-truncated-success",
        "path": "/api/identity/project-preparation",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-truncated-success",
        "path": "/api/identity/project-creation",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-truncated-success",
        "path": "/api/identity/office-review",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-truncated-success",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "phase": 1,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-truncated-success",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "phase": 1,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-truncated-success",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null,
        "phase": 1,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-truncated-success",
        "path": "/api/identity/project-preparation",
        "method": "GET",
        "projectId": "project-a",
        "phase": 1,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-truncated-success",
        "path": "/api/identity/project-creation",
        "method": "GET",
        "projectId": "project-a",
        "phase": 1,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-truncated-success",
        "path": "/api/identity/office-review",
        "method": "GET",
        "projectId": "project-a",
        "phase": 1,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-truncated-denied",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "phase": 0,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-truncated-denied",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-truncated-denied",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null,
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-truncated-denied",
        "path": "/api/identity/project-preparation",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-truncated-denied",
        "path": "/api/identity/project-creation",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-truncated-denied",
        "path": "/api/identity/office-review",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-truncated-denied",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "phase": 1,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-truncated-denied",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "phase": 1,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-truncated-denied",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null,
        "phase": 1,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-truncated-inactive",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "phase": 0,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-truncated-inactive",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-truncated-inactive",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null,
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-truncated-inactive",
        "path": "/api/identity/project-preparation",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-truncated-inactive",
        "path": "/api/identity/project-creation",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-truncated-inactive",
        "path": "/api/identity/office-review",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-truncated-inactive",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "phase": 1,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-truncated-inactive",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "phase": 1,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-truncated-inactive",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null,
        "phase": 1,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-private-kyc",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "phase": 0,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-private-kyc",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-private-kyc",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null,
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-private-kyc",
        "path": "/api/identity/project-preparation",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-private-kyc",
        "path": "/api/identity/project-creation",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-private-kyc",
        "path": "/api/identity/office-review",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-private-kyc",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "phase": 1,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-private-kyc",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "phase": 1,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-private-kyc",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null,
        "phase": 1,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-private-kyc",
        "path": "/api/identity/participants",
        "method": "GET",
        "projectId": "project-a",
        "phase": 1,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "AUDITOR",
        "mode": "continuity-office",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "phase": 0,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "AUDITOR",
        "mode": "continuity-office",
        "path": "/api/identity/office-review",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "AUDITOR",
        "mode": "continuity-office",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "phase": 1,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "AUDITOR",
        "mode": "continuity-office",
        "path": "/api/identity/office-review",
        "method": "GET",
        "projectId": "project-a",
        "phase": 1,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-late-list",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "phase": 0,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-late-list",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-late-list",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null,
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-late-list",
        "path": "/api/identity/project-preparation",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-late-list",
        "path": "/api/identity/project-creation",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-late-list",
        "path": "/api/identity/office-review",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-late-list",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "phase": 1,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-late-list",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "phase": 1,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-late-project",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "phase": 0,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-late-project",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-late-project",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null,
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-late-project",
        "path": "/api/identity/project-preparation",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-late-project",
        "path": "/api/identity/project-creation",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-late-project",
        "path": "/api/identity/office-review",
        "method": "GET",
        "projectId": "project-a",
        "phase": 0,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-late-project",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "phase": 1,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-late-project",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "phase": 1,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-late-project",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null,
        "phase": 1,
        "responseStatus": 403
      },
      {
        "width": 320,
        "role": "ADMIN",
        "mode": "continuity-bootstrap",
        "path": "/api/identity/company-onboarding",
        "method": "GET",
        "projectId": null
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "continuity-bootstrap",
        "path": "/api/identity/company-onboarding",
        "method": "GET",
        "projectId": null
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "continuity-bootstrap",
        "path": "/api/identity/company-onboarding",
        "method": "GET",
        "projectId": null
      },
      {
        "width": 320,
        "role": "ADMIN",
        "mode": "task-paging-success",
        "consumer": "field",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "scope": null,
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 320,
        "role": "ADMIN",
        "mode": "task-paging-success",
        "consumer": "field",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 320,
        "role": "ADMIN",
        "mode": "task-paging-success",
        "consumer": "field",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null,
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 403
      },
      {
        "width": 320,
        "role": "ADMIN",
        "mode": "task-paging-success",
        "consumer": "field",
        "path": "/api/identity/project-preparation",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 403
      },
      {
        "width": 320,
        "role": "ADMIN",
        "mode": "task-paging-success",
        "consumer": "field",
        "path": "/api/identity/project-creation",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 403
      },
      {
        "width": 320,
        "role": "ADMIN",
        "mode": "task-paging-success",
        "consumer": "field",
        "path": "/api/identity/office-review",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 403
      },
      {
        "width": 320,
        "role": "ADMIN",
        "mode": "task-paging-success",
        "consumer": "field",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": "task_100",
        "responseStatus": 200
      },
      {
        "width": 320,
        "role": "ADMIN",
        "mode": "task-paging-success",
        "consumer": "field",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": "task_200",
        "responseStatus": 200
      },
      {
        "width": 320,
        "role": "ADMIN",
        "mode": "task-paging-success",
        "consumer": "inventory",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "scope": null,
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 320,
        "role": "ADMIN",
        "mode": "task-paging-success",
        "consumer": "inventory",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 320,
        "role": "ADMIN",
        "mode": "task-paging-success",
        "consumer": "inventory",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null,
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 403
      },
      {
        "width": 320,
        "role": "ADMIN",
        "mode": "task-paging-success",
        "consumer": "inventory",
        "path": "/api/identity/project-preparation",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 403
      },
      {
        "width": 320,
        "role": "ADMIN",
        "mode": "task-paging-success",
        "consumer": "inventory",
        "path": "/api/identity/project-creation",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 403
      },
      {
        "width": 320,
        "role": "ADMIN",
        "mode": "task-paging-success",
        "consumer": "inventory",
        "path": "/api/identity/office-review",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 403
      },
      {
        "width": 320,
        "role": "ADMIN",
        "mode": "task-paging-success",
        "consumer": "inventory",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": "task_100",
        "responseStatus": 200
      },
      {
        "width": 320,
        "role": "ADMIN",
        "mode": "task-paging-success",
        "consumer": "inventory",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": "task_200",
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-success",
        "consumer": "field",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "scope": null,
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-success",
        "consumer": "field",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-success",
        "consumer": "field",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null,
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-success",
        "consumer": "field",
        "path": "/api/identity/project-preparation",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-success",
        "consumer": "field",
        "path": "/api/identity/project-creation",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-success",
        "consumer": "field",
        "path": "/api/identity/office-review",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-success",
        "consumer": "field",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": "task_100",
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-success",
        "consumer": "field",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": "task_200",
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-success",
        "consumer": "inventory",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "scope": null,
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-success",
        "consumer": "inventory",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-success",
        "consumer": "inventory",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null,
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-success",
        "consumer": "inventory",
        "path": "/api/identity/project-preparation",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-success",
        "consumer": "inventory",
        "path": "/api/identity/project-creation",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-success",
        "consumer": "inventory",
        "path": "/api/identity/office-review",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-success",
        "consumer": "inventory",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": "task_100",
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-success",
        "consumer": "inventory",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": "task_200",
        "responseStatus": 200
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "task-paging-success",
        "consumer": "field",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "scope": null,
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "task-paging-success",
        "consumer": "field",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "task-paging-success",
        "consumer": "field",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null,
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 403
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "task-paging-success",
        "consumer": "field",
        "path": "/api/identity/project-preparation",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 403
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "task-paging-success",
        "consumer": "field",
        "path": "/api/identity/project-creation",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 403
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "task-paging-success",
        "consumer": "field",
        "path": "/api/identity/office-review",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 403
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "task-paging-success",
        "consumer": "field",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": "task_100",
        "responseStatus": 200
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "task-paging-success",
        "consumer": "field",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": "task_200",
        "responseStatus": 200
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "task-paging-success",
        "consumer": "inventory",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "scope": null,
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "task-paging-success",
        "consumer": "inventory",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "task-paging-success",
        "consumer": "inventory",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null,
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 403
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "task-paging-success",
        "consumer": "inventory",
        "path": "/api/identity/project-preparation",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 403
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "task-paging-success",
        "consumer": "inventory",
        "path": "/api/identity/project-creation",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 403
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "task-paging-success",
        "consumer": "inventory",
        "path": "/api/identity/office-review",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 403
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "task-paging-success",
        "consumer": "inventory",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": "task_100",
        "responseStatus": 200
      },
      {
        "width": 1440,
        "role": "ADMIN",
        "mode": "task-paging-success",
        "consumer": "inventory",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": "task_200",
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-503-retry",
        "consumer": "field",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "scope": null,
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-503-retry",
        "consumer": "field",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-503-retry",
        "consumer": "field",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null,
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-503-retry",
        "consumer": "field",
        "path": "/api/identity/project-preparation",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-503-retry",
        "consumer": "field",
        "path": "/api/identity/project-creation",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-503-retry",
        "consumer": "field",
        "path": "/api/identity/office-review",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-503-retry",
        "consumer": "field",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": "task_100",
        "responseStatus": 503
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-503-retry",
        "consumer": "field",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": "task_100",
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-403-clear",
        "consumer": "field",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "scope": null,
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-403-clear",
        "consumer": "field",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-403-clear",
        "consumer": "field",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null,
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-403-clear",
        "consumer": "field",
        "path": "/api/identity/project-preparation",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-403-clear",
        "consumer": "field",
        "path": "/api/identity/project-creation",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-403-clear",
        "consumer": "field",
        "path": "/api/identity/office-review",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-403-clear",
        "consumer": "field",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": "task_100",
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-busy",
        "consumer": "field",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "scope": null,
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-busy",
        "consumer": "field",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-busy",
        "consumer": "field",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null,
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-busy",
        "consumer": "field",
        "path": "/api/identity/project-preparation",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-busy",
        "consumer": "field",
        "path": "/api/identity/project-creation",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-busy",
        "consumer": "field",
        "path": "/api/identity/office-review",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-busy",
        "consumer": "field",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": "task_100",
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-busy",
        "consumer": "field",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": "task_100",
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-503-retry",
        "consumer": "inventory",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "scope": null,
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-503-retry",
        "consumer": "inventory",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-503-retry",
        "consumer": "inventory",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null,
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-503-retry",
        "consumer": "inventory",
        "path": "/api/identity/project-preparation",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-503-retry",
        "consumer": "inventory",
        "path": "/api/identity/project-creation",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-503-retry",
        "consumer": "inventory",
        "path": "/api/identity/office-review",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-503-retry",
        "consumer": "inventory",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": "task_100",
        "responseStatus": 503
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-503-retry",
        "consumer": "inventory",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": "task_100",
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-403-clear",
        "consumer": "inventory",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "scope": null,
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-403-clear",
        "consumer": "inventory",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-403-clear",
        "consumer": "inventory",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null,
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-403-clear",
        "consumer": "inventory",
        "path": "/api/identity/project-preparation",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-403-clear",
        "consumer": "inventory",
        "path": "/api/identity/project-creation",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-403-clear",
        "consumer": "inventory",
        "path": "/api/identity/office-review",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-403-clear",
        "consumer": "inventory",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": "task_100",
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-busy",
        "consumer": "inventory",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "scope": null,
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-busy",
        "consumer": "inventory",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-busy",
        "consumer": "inventory",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null,
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-busy",
        "consumer": "inventory",
        "path": "/api/identity/project-preparation",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-busy",
        "consumer": "inventory",
        "path": "/api/identity/project-creation",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-busy",
        "consumer": "inventory",
        "path": "/api/identity/office-review",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-busy",
        "consumer": "inventory",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": "task_100",
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-busy",
        "consumer": "inventory",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": "task_100",
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-404-revoked-clear",
        "consumer": "field",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "scope": null,
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-404-revoked-clear",
        "consumer": "field",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-404-revoked-clear",
        "consumer": "field",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null,
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-404-revoked-clear",
        "consumer": "field",
        "path": "/api/identity/project-preparation",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-404-revoked-clear",
        "consumer": "field",
        "path": "/api/identity/project-creation",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-404-revoked-clear",
        "consumer": "field",
        "path": "/api/identity/office-review",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-404-revoked-clear",
        "consumer": "field",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": "task_100",
        "responseStatus": 404
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-404-revoked-clear",
        "consumer": "inventory",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": null,
        "scope": null,
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-404-revoked-clear",
        "consumer": "inventory",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-404-revoked-clear",
        "consumer": "inventory",
        "path": "/api/identity/company-subscription",
        "method": "GET",
        "projectId": null,
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-404-revoked-clear",
        "consumer": "inventory",
        "path": "/api/identity/project-preparation",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-404-revoked-clear",
        "consumer": "inventory",
        "path": "/api/identity/project-creation",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-404-revoked-clear",
        "consumer": "inventory",
        "path": "/api/identity/office-review",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": null,
        "responseStatus": 403
      },
      {
        "width": 390,
        "role": "ADMIN",
        "mode": "task-paging-404-revoked-clear",
        "consumer": "inventory",
        "path": "/api/identity/workspace",
        "method": "GET",
        "projectId": "project-a",
        "scope": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "afterTask": "task_100",
        "responseStatus": 404
      }
    ],
    "screenshotNames": [
      "overview-before-checks-390.png",
      "overview-before-checks-1440.png",
      "overview-390.png",
      "identity-deep-390.png",
      "legacy-schedule-390.png",
      "limited-role-390.png",
      "draft-before-390.png",
      "draft-after-390.png",
      "project-picker-before-390.png",
      "project-picker-after-390.png",
      "company-plan-company-without-selection-390.png",
      "company-plan-empty-company-390.png",
      "wizard-front-390.png",
      "wizard-back-390.png",
      "wizard-final-before-390.png",
      "wizard-uncertain-after-390.png",
      "overview-1440.png",
      "identity-deep-1440.png",
      "legacy-schedule-1440.png",
      "limited-role-1440.png",
      "draft-before-1440.png",
      "draft-after-1440.png",
      "project-picker-before-1440.png",
      "project-picker-after-1440.png",
      "company-plan-company-without-selection-1440.png",
      "company-plan-empty-company-1440.png",
      "wizard-front-1440.png",
      "wizard-back-1440.png",
      "wizard-final-before-1440.png",
      "wizard-uncertain-after-1440.png",
      "continuity-restored-320.png",
      "continuity-restored-390.png",
      "continuity-restored-1440.png",
      "continuity-list-role-390.png",
      "continuity-list-scope-390.png",
      "continuity-list-missing-390.png",
      "continuity-list-401-390.png",
      "continuity-list-403-390.png",
      "continuity-list-500-390.png",
      "continuity-project-401-390.png",
      "continuity-project-403-390.png",
      "continuity-project-500-390.png",
      "continuity-project-scope-390.png",
      "continuity-project-id-390.png",
      "continuity-project-null-390.png",
      "continuity-truncated-promoted-390.png",
      "continuity-truncated-denied-390.png",
      "continuity-truncated-inactive-390.png",
      "continuity-private-only-390.png",
      "continuity-office-restored-390.png",
      "continuity-late-list-rejected-390.png",
      "continuity-unmounted-late-project-390.png",
      "bootstrap-ready-compact-320.png",
      "bootstrap-ready-open-320.png",
      "bootstrap-ready-compact-390.png",
      "bootstrap-ready-open-390.png",
      "bootstrap-ready-compact-1440.png",
      "bootstrap-ready-open-1440.png",
      "task-pages-field-205-320.png",
      "task-pages-inventory-205-320.png",
      "task-pages-field-205-390.png",
      "task-pages-inventory-205-390.png",
      "task-pages-field-205-1440.png",
      "task-pages-inventory-205-1440.png",
      "task-pages-field-503-retry-390.png",
      "task-pages-field-403-clear-390.png",
      "task-pages-field-parent-block-390.png",
      "task-pages-inventory-503-retry-390.png",
      "task-pages-inventory-403-clear-390.png",
      "task-pages-inventory-parent-block-390.png",
      "task-pages-field-404-revoked-clear-390.png",
      "task-pages-inventory-404-revoked-clear-390.png"
    ],
    "requestProjectionFieldsOmitted": [
      "operationId",
      "recoveryReferenceSha256",
      "syntheticImageSha256"
    ],
    "taskPagingFixture": {
      "pageSha256": "81172bf9a67fd42465b97db593192c50aff075582edf8ec5a2e25d19b2df5669",
      "consumerAuthority": "Controlled callback protocol only; no real form, provider, authorization or business command"
    },
    "matrixObservation": {
      "rawProofSha256": "fe25b51ef2399b0b0ce936fe784933ffb9ffebdee1dd2409a2f826209edca197",
      "sourceState": "LOCAL_REVIEW_SOURCE",
      "rawProofTransformed": false,
      "formalCiAcceptance": false
    }
  },
  "paginationUi": {
    "status": "REVIEWED_FROZEN_CURRENT_SOURCE",
    "ciVersion": "field-task-pagination-ci-v1",
    "rawVersion": 1,
    "checkNames": [
      "real-form-keeps-draft-through-pages-2-and-3-evidence-320",
      "real-form-keeps-draft-through-pages-2-and-3-progress-320",
      "real-form-keeps-draft-through-pages-2-and-3-material-request-320",
      "real-form-keeps-draft-through-pages-2-and-3-consumption-320",
      "real-form-keeps-draft-through-pages-2-and-3-evidence-390",
      "real-form-keeps-draft-through-pages-2-and-3-progress-390",
      "real-form-keeps-draft-through-pages-2-and-3-material-request-390",
      "real-form-keeps-draft-through-pages-2-and-3-consumption-390",
      "real-form-keeps-draft-through-pages-2-and-3-evidence-1440",
      "real-form-keeps-draft-through-pages-2-and-3-progress-1440",
      "real-form-keeps-draft-through-pages-2-and-3-material-request-1440",
      "real-form-keeps-draft-through-pages-2-and-3-consumption-1440",
      "page-503-keeps-form-and-explicit-retry-evidence-320",
      "page-503-keeps-form-and-explicit-retry-progress-320",
      "page-503-keeps-form-and-explicit-retry-material-request-320",
      "page-503-keeps-form-and-explicit-retry-consumption-320",
      "page-503-keeps-form-and-explicit-retry-evidence-390",
      "page-503-keeps-form-and-explicit-retry-progress-390",
      "page-503-keeps-form-and-explicit-retry-material-request-390",
      "page-503-keeps-form-and-explicit-retry-consumption-390",
      "page-503-keeps-form-and-explicit-retry-evidence-1440",
      "page-503-keeps-form-and-explicit-retry-progress-1440",
      "page-503-keeps-form-and-explicit-retry-material-request-1440",
      "page-503-keeps-form-and-explicit-retry-consumption-1440",
      "uncertain-original-command-blocks-task-paging-evidence-320",
      "uncertain-original-command-blocks-task-paging-progress-320",
      "uncertain-original-command-blocks-task-paging-consumption-320",
      "uncertain-original-command-blocks-task-paging-evidence-390",
      "uncertain-original-command-blocks-task-paging-progress-390",
      "uncertain-original-command-blocks-task-paging-consumption-390",
      "uncertain-original-command-blocks-task-paging-evidence-1440",
      "uncertain-original-command-blocks-task-paging-progress-1440",
      "uncertain-original-command-blocks-task-paging-consumption-1440"
    ],
    "widths": [
      320,
      390,
      1440
    ],
    "unitFiles": [
      "tests/production-worksite-task-selector.test.mjs",
      "tests/production-workspace-task-page.test.mjs",
      "tests/production-field-task-pagination-ci.test.mjs",
      "tests/production-whatsapp-field-continuity-current-ci-lineage.test.mjs"
    ],
    "requestMatrix": [
      {
        "width": 320,
        "mode": "evidence",
        "path": "/api/identity/field-operations",
        "method": "GET",
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 320,
        "mode": "evidence",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0100",
        "responseStatus": 200
      },
      {
        "width": 320,
        "mode": "evidence",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0200",
        "responseStatus": 200
      },
      {
        "width": 320,
        "mode": "progress",
        "path": "/api/identity/field-operations",
        "method": "GET",
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 320,
        "mode": "progress",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0100",
        "responseStatus": 200
      },
      {
        "width": 320,
        "mode": "progress",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0200",
        "responseStatus": 200
      },
      {
        "width": 320,
        "mode": "material-request",
        "path": "/api/identity/field-operations",
        "method": "GET",
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 320,
        "mode": "material-request",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0100",
        "responseStatus": 200
      },
      {
        "width": 320,
        "mode": "material-request",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0200",
        "responseStatus": 200
      },
      {
        "width": 320,
        "mode": "consumption",
        "path": "/api/identity/field-operations",
        "method": "GET",
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 320,
        "mode": "consumption",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0100",
        "responseStatus": 200
      },
      {
        "width": 320,
        "mode": "consumption",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0200",
        "responseStatus": 200
      },
      {
        "width": 390,
        "mode": "evidence",
        "path": "/api/identity/field-operations",
        "method": "GET",
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 390,
        "mode": "evidence",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0100",
        "responseStatus": 200
      },
      {
        "width": 390,
        "mode": "evidence",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0200",
        "responseStatus": 200
      },
      {
        "width": 390,
        "mode": "progress",
        "path": "/api/identity/field-operations",
        "method": "GET",
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 390,
        "mode": "progress",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0100",
        "responseStatus": 200
      },
      {
        "width": 390,
        "mode": "progress",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0200",
        "responseStatus": 200
      },
      {
        "width": 390,
        "mode": "material-request",
        "path": "/api/identity/field-operations",
        "method": "GET",
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 390,
        "mode": "material-request",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0100",
        "responseStatus": 200
      },
      {
        "width": 390,
        "mode": "material-request",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0200",
        "responseStatus": 200
      },
      {
        "width": 390,
        "mode": "consumption",
        "path": "/api/identity/field-operations",
        "method": "GET",
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 390,
        "mode": "consumption",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0100",
        "responseStatus": 200
      },
      {
        "width": 390,
        "mode": "consumption",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0200",
        "responseStatus": 200
      },
      {
        "width": 1440,
        "mode": "evidence",
        "path": "/api/identity/field-operations",
        "method": "GET",
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 1440,
        "mode": "evidence",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0100",
        "responseStatus": 200
      },
      {
        "width": 1440,
        "mode": "evidence",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0200",
        "responseStatus": 200
      },
      {
        "width": 1440,
        "mode": "progress",
        "path": "/api/identity/field-operations",
        "method": "GET",
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 1440,
        "mode": "progress",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0100",
        "responseStatus": 200
      },
      {
        "width": 1440,
        "mode": "progress",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0200",
        "responseStatus": 200
      },
      {
        "width": 1440,
        "mode": "material-request",
        "path": "/api/identity/field-operations",
        "method": "GET",
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 1440,
        "mode": "material-request",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0100",
        "responseStatus": 200
      },
      {
        "width": 1440,
        "mode": "material-request",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0200",
        "responseStatus": 200
      },
      {
        "width": 1440,
        "mode": "consumption",
        "path": "/api/identity/field-operations",
        "method": "GET",
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 1440,
        "mode": "consumption",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0100",
        "responseStatus": 200
      },
      {
        "width": 1440,
        "mode": "consumption",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0200",
        "responseStatus": 200
      },
      {
        "width": 320,
        "mode": "evidence",
        "path": "/api/identity/field-operations",
        "method": "GET",
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 320,
        "mode": "evidence",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0100",
        "responseStatus": 503
      },
      {
        "width": 320,
        "mode": "evidence",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0100",
        "responseStatus": 200
      },
      {
        "width": 320,
        "mode": "progress",
        "path": "/api/identity/field-operations",
        "method": "GET",
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 320,
        "mode": "progress",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0100",
        "responseStatus": 503
      },
      {
        "width": 320,
        "mode": "progress",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0100",
        "responseStatus": 200
      },
      {
        "width": 320,
        "mode": "material-request",
        "path": "/api/identity/field-operations",
        "method": "GET",
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 320,
        "mode": "material-request",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0100",
        "responseStatus": 503
      },
      {
        "width": 320,
        "mode": "material-request",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0100",
        "responseStatus": 200
      },
      {
        "width": 320,
        "mode": "consumption",
        "path": "/api/identity/field-operations",
        "method": "GET",
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 320,
        "mode": "consumption",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0100",
        "responseStatus": 503
      },
      {
        "width": 320,
        "mode": "consumption",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0100",
        "responseStatus": 200
      },
      {
        "width": 390,
        "mode": "evidence",
        "path": "/api/identity/field-operations",
        "method": "GET",
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 390,
        "mode": "evidence",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0100",
        "responseStatus": 503
      },
      {
        "width": 390,
        "mode": "evidence",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0100",
        "responseStatus": 200
      },
      {
        "width": 390,
        "mode": "progress",
        "path": "/api/identity/field-operations",
        "method": "GET",
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 390,
        "mode": "progress",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0100",
        "responseStatus": 503
      },
      {
        "width": 390,
        "mode": "progress",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0100",
        "responseStatus": 200
      },
      {
        "width": 390,
        "mode": "material-request",
        "path": "/api/identity/field-operations",
        "method": "GET",
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 390,
        "mode": "material-request",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0100",
        "responseStatus": 503
      },
      {
        "width": 390,
        "mode": "material-request",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0100",
        "responseStatus": 200
      },
      {
        "width": 390,
        "mode": "consumption",
        "path": "/api/identity/field-operations",
        "method": "GET",
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 390,
        "mode": "consumption",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0100",
        "responseStatus": 503
      },
      {
        "width": 390,
        "mode": "consumption",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0100",
        "responseStatus": 200
      },
      {
        "width": 1440,
        "mode": "evidence",
        "path": "/api/identity/field-operations",
        "method": "GET",
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 1440,
        "mode": "evidence",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0100",
        "responseStatus": 503
      },
      {
        "width": 1440,
        "mode": "evidence",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0100",
        "responseStatus": 200
      },
      {
        "width": 1440,
        "mode": "progress",
        "path": "/api/identity/field-operations",
        "method": "GET",
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 1440,
        "mode": "progress",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0100",
        "responseStatus": 503
      },
      {
        "width": 1440,
        "mode": "progress",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0100",
        "responseStatus": 200
      },
      {
        "width": 1440,
        "mode": "material-request",
        "path": "/api/identity/field-operations",
        "method": "GET",
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 1440,
        "mode": "material-request",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0100",
        "responseStatus": 503
      },
      {
        "width": 1440,
        "mode": "material-request",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0100",
        "responseStatus": 200
      },
      {
        "width": 1440,
        "mode": "consumption",
        "path": "/api/identity/field-operations",
        "method": "GET",
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 1440,
        "mode": "consumption",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0100",
        "responseStatus": 503
      },
      {
        "width": 1440,
        "mode": "consumption",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0100",
        "responseStatus": 200
      },
      {
        "width": 320,
        "mode": "evidence",
        "path": "/api/identity/field-operations",
        "method": "GET",
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 320,
        "mode": "evidence",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0100",
        "responseStatus": 200
      },
      {
        "width": 320,
        "mode": "evidence",
        "path": "/api/identity/field-media",
        "method": "POST",
        "afterTask": null,
        "responseStatus": 503
      },
      {
        "width": 320,
        "mode": "progress",
        "path": "/api/identity/field-operations",
        "method": "GET",
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 320,
        "mode": "progress",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0100",
        "responseStatus": 200
      },
      {
        "width": 320,
        "mode": "progress",
        "path": "/api/identity/field-operations",
        "method": "POST",
        "afterTask": null,
        "responseStatus": 503
      },
      {
        "width": 320,
        "mode": "consumption",
        "path": "/api/identity/field-operations",
        "method": "GET",
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 320,
        "mode": "consumption",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0100",
        "responseStatus": 200
      },
      {
        "width": 320,
        "mode": "consumption",
        "path": "/api/identity/field-operations",
        "method": "POST",
        "afterTask": null,
        "responseStatus": 503
      },
      {
        "width": 390,
        "mode": "evidence",
        "path": "/api/identity/field-operations",
        "method": "GET",
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 390,
        "mode": "evidence",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0100",
        "responseStatus": 200
      },
      {
        "width": 390,
        "mode": "evidence",
        "path": "/api/identity/field-media",
        "method": "POST",
        "afterTask": null,
        "responseStatus": 503
      },
      {
        "width": 390,
        "mode": "progress",
        "path": "/api/identity/field-operations",
        "method": "GET",
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 390,
        "mode": "progress",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0100",
        "responseStatus": 200
      },
      {
        "width": 390,
        "mode": "progress",
        "path": "/api/identity/field-operations",
        "method": "POST",
        "afterTask": null,
        "responseStatus": 503
      },
      {
        "width": 390,
        "mode": "consumption",
        "path": "/api/identity/field-operations",
        "method": "GET",
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 390,
        "mode": "consumption",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0100",
        "responseStatus": 200
      },
      {
        "width": 390,
        "mode": "consumption",
        "path": "/api/identity/field-operations",
        "method": "POST",
        "afterTask": null,
        "responseStatus": 503
      },
      {
        "width": 1440,
        "mode": "evidence",
        "path": "/api/identity/field-operations",
        "method": "GET",
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 1440,
        "mode": "evidence",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0100",
        "responseStatus": 200
      },
      {
        "width": 1440,
        "mode": "evidence",
        "path": "/api/identity/field-media",
        "method": "POST",
        "afterTask": null,
        "responseStatus": 503
      },
      {
        "width": 1440,
        "mode": "progress",
        "path": "/api/identity/field-operations",
        "method": "GET",
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 1440,
        "mode": "progress",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0100",
        "responseStatus": 200
      },
      {
        "width": 1440,
        "mode": "progress",
        "path": "/api/identity/field-operations",
        "method": "POST",
        "afterTask": null,
        "responseStatus": 503
      },
      {
        "width": 1440,
        "mode": "consumption",
        "path": "/api/identity/field-operations",
        "method": "GET",
        "afterTask": null,
        "responseStatus": 200
      },
      {
        "width": 1440,
        "mode": "consumption",
        "path": "/api/identity/workspace",
        "method": "GET",
        "afterTask": "task-0100",
        "responseStatus": 200
      },
      {
        "width": 1440,
        "mode": "consumption",
        "path": "/api/identity/field-operations",
        "method": "POST",
        "afterTask": null,
        "responseStatus": 503
      }
    ],
    "commandEqualityGroups": [
      [
        74,
        83,
        92
      ],
      [
        77
      ],
      [
        80
      ],
      [
        86
      ],
      [
        89
      ],
      [
        95
      ],
      [
        98
      ]
    ],
    "postCount": 9,
    "screenshotNames": [
      "evidence-page-three-320.png",
      "progress-page-three-320.png",
      "material-request-page-three-320.png",
      "consumption-page-three-320.png",
      "evidence-page-three-390.png",
      "progress-page-three-390.png",
      "material-request-page-three-390.png",
      "consumption-page-three-390.png",
      "evidence-page-three-1440.png",
      "progress-page-three-1440.png",
      "material-request-page-three-1440.png",
      "consumption-page-three-1440.png"
    ],
    "mediaActionLabels": [
      "Girar foto 90°",
      "Usar este archivo",
      "Quitar archivo"
    ],
    "controlledSourceTransform": {
      "file": "tests/production-worksite-task-selector.test.mjs",
      "sourceLfSha256": "15d764467be94b0f84cc0988d969458ee52660d6f1d2f4c7c5cb96d5d9125a7f",
      "kind": "SWC_SELECTOR_DATA_MODULE",
      "source": "src/app/(identity)/cuenta/worksite-task-selector.js",
      "compiler": "next/dist/build/swc/index.js",
      "packageLockSha256": "dfa3ff3914547f35828a0b697e6007c6cf856546be86bf8a7810cdce59e60449"
    },
    "unitCaseMatrix": {
      "file": "tests/production-workspace-task-page.test.mjs",
      "sourceLfSha256": "9bed3622f630c43c4069ce8cb0a8c4fa6a42a262a6550cc0f9e6ef83220e3fb6",
      "caseNames": [
        "pages 2 and 3 use canonical read parameters and append all 205 tasks",
        "overlapping clicks issue one request, and the response needs the original cursor",
        "a transient failure preserves the cursor and can be retried without a write",
        "a late page cannot enter a changed context {\"scope\":\"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\"}",
        "a late page cannot enter a changed context {\"projectId\":\"project_b\"}",
        "a late page cannot enter a changed context {\"role\":\"AUDITOR\"}",
        "a late page cannot enter a changed context {\"generation\":8}",
        "a late page cannot enter a changed context {\"officeReviewOnly\":true}",
        "reset aborts an old read; a new generation completes while the old callback is ignored",
        "dispose aborts and prevents callbacks or new reads after unmount",
        "access rejection reaches the canonical parent handler {\"status\":401}",
        "access rejection reaches the canonical parent handler {\"status\":403}",
        "access rejection reaches the canonical parent handler {\"status\":409,\"code\":\"WORKSPACE_CONTEXT_CHANGED\"}",
        "access rejection reaches the canonical parent handler {\"status\":404,\"code\":\"WORKSPACE_PROJECT_UNAVAILABLE\"}",
        "a generic 404 is a retryable read error without a canonical project denial",
        "a write or uncertain attempt blocks reads, including one that starts after the request",
        "a previously consumed cursor cannot loop the same page indefinitely",
        "revision-aware merge does not replace an already approved task with an older page snapshot",
        "an unavailable context issues no read: {\"scope\":\"invalid\"}",
        "an unavailable context issues no read: {\"projectId\":\"../other\"}",
        "an unavailable context issues no read: {\"generation\":-1}",
        "an unavailable context issues no read: {\"officeReviewOnly\":true}",
        "an unavailable context issues no read: {\"cursor\":\"../../other\"}",
        "an unavailable context issues no read: {\"cursor\":null}",
        "unconfirmed page leaves the current task list untouched: wrong scope",
        "unconfirmed page leaves the current task list untouched: wrong project",
        "unconfirmed page leaves the current task list untouched: inactive project",
        "unconfirmed page leaves the current task list untouched: unknown response shape",
        "unconfirmed page leaves the current task list untouched: too many rows",
        "unconfirmed page leaves the current task list untouched: duplicate task",
        "unconfirmed page leaves the current task list untouched: bad revision",
        "unconfirmed page leaves the current task list untouched: unconfirmed quantity basis",
        "unconfirmed page leaves the current task list untouched: bad total",
        "unconfirmed page leaves the current task list untouched: cursor outside page",
        "unconfirmed page leaves the current task list untouched: reused cursor",
        "the canonical page validator accepts an empty final page"
      ]
    },
    "matrixObservation": {
      "rawProofSha256": "7bcfff2a256dd2b2dd205410a81563feed32c837e36f6091dca859170dddc296",
      "sourceState": "LOCAL_REVIEW_SOURCE",
      "rawProofTransformed": false,
      "formalCiAcceptance": false
    }
  },
  "native": {
    "status": "REVIEWED_FROZEN_CURRENT_SOURCE",
    "families": {
      "COMPANY": {
        "kind": "COMPANY",
        "dtoField": "neutralStepGuidanceNative",
        "producer": "scripts/verify-company-channel-kyc-postgres.mjs",
        "producerSha256": "212a3f1ac6993954681a765635034ed0e48ac038db0ad3c6159df603ce049903",
        "sourceFiles": [
          "scripts/fixtures/meta-signup-field-lifecycle-fixture.mjs",
          "scripts/lib/kyc-context-feedback-native.mjs",
          "scripts/lib/kyc-current-image-native.mjs",
          "scripts/lib/kyc-neutral-step-guidance-native.mjs",
          "src/app/(identity)/cuenta/private-bank-account-format.mjs",
          "src/lib/afipValidator.js",
          "src/lib/aiVision.js",
          "src/lib/auditLedger.js",
          "src/lib/auth.js",
          "src/lib/bindx-civil-data-client.mjs",
          "src/lib/blobStorage.js",
          "src/lib/brand-assets.mjs",
          "src/lib/canonical-invited-account.mjs",
          "src/lib/company-billing-http.mjs",
          "src/lib/company-billing.mjs",
          "src/lib/company-channel-connection.mjs",
          "src/lib/company-channel-http.mjs",
          "src/lib/company-channel-kyc.mjs",
          "src/lib/company-channel-routing.mjs",
          "src/lib/company-channel-schema.mjs",
          "src/lib/company-channel-store.mjs",
          "src/lib/company-entitlement.mjs",
          "src/lib/company-onboarding-http.mjs",
          "src/lib/company-onboarding-identity.mjs",
          "src/lib/company-onboarding-policy.mjs",
          "src/lib/company-onboarding-store.mjs",
          "src/lib/company-phone-format.mjs",
          "src/lib/company-subscription-catalog.mjs",
          "src/lib/company-subscription-http.mjs",
          "src/lib/company-subscription-policy.mjs",
          "src/lib/company-subscription-provider.mjs",
          "src/lib/company-subscription-routing.mjs",
          "src/lib/company-subscription-runtime-config.mjs",
          "src/lib/company-subscription-runtime.mjs",
          "src/lib/company-subscription-store.mjs",
          "src/lib/computerVision.js",
          "src/lib/constructor-crm-http.mjs",
          "src/lib/constructor-crm-policy.mjs",
          "src/lib/constructor-crm-runtime.mjs",
          "src/lib/constructor-crm-schema.mjs",
          "src/lib/constructor-crm-store.mjs",
          "src/lib/customer-whatsapp-http.mjs",
          "src/lib/customer-whatsapp-setup.mjs",
          "src/lib/db.js",
          "src/lib/defaultState.js",
          "src/lib/design-system.js",
          "src/lib/dolarCac.js",
          "src/lib/employee-intake-channel-continuity.mjs",
          "src/lib/enterprise-crm-policy.mjs",
          "src/lib/field-media-privacy.mjs",
          "src/lib/field-media.mjs",
          "src/lib/field-operations-http.mjs",
          "src/lib/field-operations-policy.mjs",
          "src/lib/field-operations-runtime.mjs",
          "src/lib/field-operations-store.mjs",
          "src/lib/field-overtime-policy.mjs",
          "src/lib/field-overtime-store.mjs",
          "src/lib/field-report-feedback.mjs",
          "src/lib/field-shift-summary.mjs",
          "src/lib/geo.js",
          "src/lib/identity-return-path.mjs",
          "src/lib/kyc-pilot-boundary.mjs",
          "src/lib/legacy-access-boundary.js",
          "src/lib/llmCopilot.js",
          "src/lib/material-inventory.mjs",
          "src/lib/mercadopago.js",
          "src/lib/meta-app-callback.mjs",
          "src/lib/meta-app-recovery.mjs",
          "src/lib/meta-callback-diagnostics.mjs",
          "src/lib/meta-channel-binding.mjs",
          "src/lib/meta-cloud-protocol.mjs",
          "src/lib/meta-customer-activation.mjs",
          "src/lib/meta-customer-app-projection.mjs",
          "src/lib/meta-customer-callback.mjs",
          "src/lib/meta-customer-coexistence.mjs",
          "src/lib/meta-customer-credentials.mjs",
          "src/lib/meta-customer-http.mjs",
          "src/lib/meta-customer-inbox-review.mjs",
          "src/lib/meta-customer-onboarding.mjs",
          "src/lib/meta-customer-outbound.mjs",
          "src/lib/meta-customer-permissions.mjs",
          "src/lib/meta-customer-processing-runtime.mjs",
          "src/lib/meta-customer-processing.mjs",
          "src/lib/meta-customer-provider.mjs",
          "src/lib/meta-customer-template-send-http.mjs",
          "src/lib/meta-customer-template-send-runtime.mjs",
          "src/lib/meta-customer-template-send.mjs",
          "src/lib/meta-customer-templates.mjs",
          "src/lib/meta-demo-pilot-http.mjs",
          "src/lib/meta-demo-pilot-policy.mjs",
          "src/lib/meta-demo-pilot-runtime.mjs",
          "src/lib/meta-demo-pilot-store.mjs",
          "src/lib/meta-demo-pilot.mjs",
          "src/lib/meta-development-pilot-policy.mjs",
          "src/lib/meta-employee-intake.mjs",
          "src/lib/meta-field-bridge.mjs",
          "src/lib/meta-field-conversation.mjs",
          "src/lib/meta-kyc-bridge.mjs",
          "src/lib/meta-kyc-challenge.mjs",
          "src/lib/meta-kyc-context-feedback.mjs",
          "src/lib/meta-kyc-context-outbound.mjs",
          "src/lib/meta-kyc-conversation.mjs",
          "src/lib/meta-kyc-current-image.mjs",
          "src/lib/meta-kyc-expiry-feedback.mjs",
          "src/lib/meta-kyc-identity.mjs",
          "src/lib/meta-kyc-outbound.mjs",
          "src/lib/meta-kyc-rejection-policy.mjs",
          "src/lib/meta-kyc-rejection.mjs",
          "src/lib/meta-own-company-connection.mjs",
          "src/lib/meta-own-company-policy.mjs",
          "src/lib/meta-own-company-templates.mjs",
          "src/lib/meta-plan-import-conversation.mjs",
          "src/lib/meta-plan-import-origin.mjs",
          "src/lib/meta-plan-import-recovery.mjs",
          "src/lib/meta-plan-import-transport.mjs",
          "src/lib/meta-recovery-diagnostics.mjs",
          "src/lib/meta-release-observation.mjs",
          "src/lib/meta-test-dispatch.mjs",
          "src/lib/meta-test-recipient-binding.mjs",
          "src/lib/meta-webhook-scope.mjs",
          "src/lib/meta-whatsapp-transport.mjs",
          "src/lib/metaTemplates.js",
          "src/lib/nlpEngine.js",
          "src/lib/office-review-http.mjs",
          "src/lib/office-review-policy.mjs",
          "src/lib/office-review-runtime.mjs",
          "src/lib/office-review-store.mjs",
          "src/lib/operations-status.mjs",
          "src/lib/organization-resource-usage-policy.mjs",
          "src/lib/organization-resource-usage-store.mjs",
          "src/lib/organization-usage-http.mjs",
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
          "src/lib/participant-http.mjs",
          "src/lib/participant-identity-provider.mjs",
          "src/lib/participant-kyc-chat-attempt.mjs",
          "src/lib/participant-kyc-chat-closure.mjs",
          "src/lib/participant-kyc-chat-copy.mjs",
          "src/lib/participant-kyc-image-set.mjs",
          "src/lib/participant-kyc-notice-links.mjs",
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
          "src/lib/participant-runtime.mjs",
          "src/lib/participant-store.mjs",
          "src/lib/participant-verified-office.mjs",
          "src/lib/pdfGenerator.js",
          "src/lib/person-worksite-journey.mjs",
          "src/lib/pilot-media.mjs",
          "src/lib/plan-baseline-http.mjs",
          "src/lib/plan-baseline-policy.mjs",
          "src/lib/plan-baseline-runtime.mjs",
          "src/lib/plan-baseline-store.mjs",
          "src/lib/plan-import-analyzer.mjs",
          "src/lib/plan-import-cyp-curve.mjs",
          "src/lib/plan-import-document-curve.mjs",
          "src/lib/plan-import-http.mjs",
          "src/lib/plan-import-monthly-curve.mjs",
          "src/lib/plan-import-ooxml.mjs",
          "src/lib/plan-import-policy.mjs",
          "src/lib/plan-import-runtime.mjs",
          "src/lib/plan-import-store.mjs",
          "src/lib/plan-measurement-configuration.mjs",
          "src/lib/plan-measurement-http.mjs",
          "src/lib/plan-measurement-policy.mjs",
          "src/lib/plan-measurement-runtime.mjs",
          "src/lib/plan-measurement-source.mjs",
          "src/lib/plan-measurement-store.mjs",
          "src/lib/predictiveAI.js",
          "src/lib/prisma.js",
          "src/lib/private-biometric-analyzer.mjs",
          "src/lib/private-image-upload.mjs",
          "src/lib/procurement-money.js",
          "src/lib/procurement-quantity.js",
          "src/lib/production-identity-config.mjs",
          "src/lib/progress-measurement-quantity.js",
          "src/lib/project-creation-http.mjs",
          "src/lib/project-creation-policy.mjs",
          "src/lib/project-creation-runtime.mjs",
          "src/lib/project-creation-store.mjs",
          "src/lib/project-preparation-http.mjs",
          "src/lib/project-preparation-policy.mjs",
          "src/lib/project-preparation-store.mjs",
          "src/lib/realtime.js",
          "src/lib/retired-billing.mjs",
          "src/lib/session-recovery.mjs",
          "src/lib/site-photo-http.mjs",
          "src/lib/site-photo-service.mjs",
          "src/lib/site-purchase-http.mjs",
          "src/lib/site-purchase-policy.mjs",
          "src/lib/site-purchase-store.mjs",
          "src/lib/site-register-http.mjs",
          "src/lib/site-register-policy.mjs",
          "src/lib/site-register-store.mjs",
          "src/lib/task-progress-measurement.js",
          "src/lib/useBreakpoint.js",
          "src/lib/verified-session.mjs",
          "src/lib/video-audio-extractor.mjs",
          "src/lib/video-frame-extractor.mjs",
          "src/lib/voice-progress-draft.mjs",
          "src/lib/weatherTelemetry.js",
          "src/lib/webhookDispatcher.js",
          "src/lib/whatsapp/field-worker-intent-policy.js",
          "src/lib/whatsapp/obra-intent-policy.js",
          "src/lib/whatsapp/operational-proposal-decision-policy.js",
          "src/lib/whatsapp/project-workspace-profile.js",
          "src/lib/whatsapp/template-review-policy.js",
          "src/lib/whatsapp/tenant-workspace-policy.js",
          "src/lib/whatsappNotifications.js",
          "src/lib/worker-channel-consent-policy.mjs",
          "src/lib/worker-channel-http.mjs",
          "src/lib/worker-channel-identity.mjs",
          "src/lib/worker-channel-runtime.mjs",
          "src/lib/workspace-http.mjs",
          "src/lib/workspace-policy.mjs",
          "src/lib/workspace-runtime.mjs",
          "src/lib/workspace-store.mjs"
        ],
        "sourceCount": 235,
        "sourcePathsSha256": "1a26e97cd22fbf77d620e29b20e50c3b01365d205160c2e476a38fc7dc072899",
        "checkNames": [
          "native-COMPANY-neutral-four-command-current-v3-guidance-no-capture-row-lock-ACK-and-original-deadline-fences"
        ],
        "caseNames": [
          "signed-production-neutral-four-commands-consent",
          "signed-production-neutral-four-commands-front",
          "signed-production-neutral-four-commands-back",
          "signed-production-neutral-four-commands-selfie",
          "signed-production-neutral-four-commands-confirm",
          "current-issuer-revoked-after-reservation-no-first-POST-or-replay",
          "actual-PG-concurrent-guidance-receipt-single-outbox-and-HTTP",
          "native-guidance-ROLLBACK-leaves-no-receipt",
          "native-guidance-COMMIT-ACK-loss-and-Graph-unknown-no-second-POST",
          "original-conversation-deadline-crossed-after-first-provider-guard-no-POST",
          "original-SENT-prompt-failed-in-same-locked-transaction-after-snapshot-no-first-POST",
          "canonical-preparer-refuses-second-live-same-phone-challenge-first-claim-retained",
          "canonically-expired-additional-attempt-does-not-create-live-ambiguity"
        ],
        "caseMatrix": [
          {
            "name": "signed-production-neutral-four-commands-consent",
            "commands": [
              "HOLA",
              "ESTADO",
              "MENU",
              "MENÚ"
            ],
            "replyCopyVersion": 3,
            "posts": 4,
            "replayPosts": 0,
            "workerBytesUnchanged": true,
            "sourcePromptBytesUnchanged": true,
            "privateIo": 0,
            "captureWrites": 0
          },
          {
            "name": "signed-production-neutral-four-commands-front",
            "commands": [
              "HOLA",
              "ESTADO",
              "MENU",
              "MENÚ"
            ],
            "replyCopyVersion": 3,
            "posts": 4,
            "replayPosts": 0,
            "workerBytesUnchanged": true,
            "sourcePromptBytesUnchanged": true,
            "privateIo": 0,
            "captureWrites": 0
          },
          {
            "name": "signed-production-neutral-four-commands-back",
            "commands": [
              "HOLA",
              "ESTADO",
              "MENU",
              "MENÚ"
            ],
            "replyCopyVersion": 3,
            "posts": 4,
            "replayPosts": 0,
            "workerBytesUnchanged": true,
            "sourcePromptBytesUnchanged": true,
            "privateIo": 0,
            "captureWrites": 0
          },
          {
            "name": "signed-production-neutral-four-commands-selfie",
            "commands": [
              "HOLA",
              "ESTADO",
              "MENU",
              "MENÚ"
            ],
            "replyCopyVersion": 3,
            "posts": 4,
            "replayPosts": 0,
            "workerBytesUnchanged": true,
            "sourcePromptBytesUnchanged": true,
            "privateIo": 0,
            "captureWrites": 0
          },
          {
            "name": "signed-production-neutral-four-commands-confirm",
            "commands": [
              "HOLA",
              "ESTADO",
              "MENU",
              "MENÚ"
            ],
            "replyCopyVersion": 3,
            "posts": 4,
            "replayPosts": 0,
            "workerBytesUnchanged": true,
            "sourcePromptBytesUnchanged": true,
            "privateIo": 0,
            "captureWrites": 0
          },
          {
            "name": "current-issuer-revoked-after-reservation-no-first-POST-or-replay",
            "posts": 0,
            "state": "SEND_STARTED",
            "workerBytesUnchanged": true
          },
          {
            "name": "actual-PG-concurrent-guidance-receipt-single-outbox-and-HTTP",
            "uncommittedReceiptInvisible": true,
            "receiptCount": 1,
            "outboxCount": 1,
            "posts": 1,
            "workerBytesUnchanged": true
          },
          {
            "name": "native-guidance-ROLLBACK-leaves-no-receipt",
            "commitApplied": false,
            "receiptCount": 1,
            "outboxCount": 1,
            "posts": 1,
            "replayPosts": 0,
            "workerBytesUnchanged": true
          },
          {
            "name": "native-guidance-COMMIT-ACK-loss-and-Graph-unknown-no-second-POST",
            "commitApplied": true,
            "receiptCount": 1,
            "outboxCount": 1,
            "posts": 1,
            "replayPosts": 0,
            "workerBytesUnchanged": true
          },
          {
            "name": "original-conversation-deadline-crossed-after-first-provider-guard-no-POST",
            "actualSqlClock": true,
            "issuanceOffsetMs": 1792000,
            "sourceLeaseStillLive": true,
            "deadlineRenewed": false,
            "posts": 0,
            "workerBytesUnchanged": true,
            "state": "SEND_STARTED"
          },
          {
            "name": "original-SENT-prompt-failed-in-same-locked-transaction-after-snapshot-no-first-POST",
            "actualRollbackRestoresPrompt": true,
            "posts": 0,
            "state": "SEND_STARTED",
            "workerBytesUnchanged": true
          },
          {
            "name": "canonical-preparer-refuses-second-live-same-phone-challenge-first-claim-retained",
            "secondPreparationCode": "META_KYC_CHALLENGE_AMBIGUOUS",
            "secondChallengeCreated": false,
            "posts": 1,
            "receiptCount": 1,
            "workerBytesUnchanged": true
          },
          {
            "name": "canonically-expired-additional-attempt-does-not-create-live-ambiguity",
            "posts": 1,
            "expiredWorkerBytesUnchanged": true,
            "deadlineRenewed": false
          }
        ],
        "extraKeys": [],
        "matrixObservation": {
          "rawProofSha256": "1f23cae4e2d9a4b15cd357dce67a4a13f90160ffe559ec256a14da4719bc6f84",
          "rawProofTransformed": false,
          "formalCiAcceptance": false
        }
      },
      "OWN": {
        "kind": "OWN_COMPANY_RUNTIME",
        "dtoField": "neutralStepGuidanceNative",
        "producer": "scripts/verify-company-kyc-outbound-compact-postgres.mjs",
        "producerSha256": "362bdcc31bf9eb37197e3c21485dd6522ab3343ea2d01d9fe1db4b3f27b56700",
        "sourceFiles": [
          "package-lock.json",
          "package.json",
          "scripts/lib/company-channel-disposable-fixture.mjs",
          "scripts/lib/company-channel-migration.mjs",
          "scripts/lib/disposable-postgres-cleanup.mjs",
          "scripts/lib/kyc-current-image-native.mjs",
          "scripts/lib/kyc-current-image-own-native.mjs",
          "scripts/lib/kyc-neutral-step-guidance-native.mjs",
          "scripts/lib/kyc-neutral-step-guidance-own-native.mjs",
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
          "src/lib/meta-kyc-current-image.mjs",
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
          "src/lib/participant-kyc-chat-copy.mjs",
          "src/lib/participant-kyc-image-set.mjs",
          "src/lib/participant-kyc-notice-links.mjs",
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
        ],
        "sourceCount": 139,
        "sourcePathsSha256": "cd474d8e9a3b754daaeef61f986e31f1c92997a8423cd9a14c06d43ea706dbea",
        "checkNames": [
          "native-OWN-neutral-current-v3-guidance-original-v2-grant-60s-lease-and-final-deadline-fences"
        ],
        "caseNames": [
          "signed-production-neutral-four-commands-consent",
          "signed-production-neutral-four-commands-front",
          "signed-production-neutral-four-commands-back",
          "signed-production-neutral-four-commands-selfie",
          "signed-production-neutral-four-commands-confirm",
          "current-issuer-revoked-after-reservation-no-first-POST-or-replay",
          "actual-PG-concurrent-guidance-receipt-single-outbox-and-HTTP",
          "native-guidance-ROLLBACK-leaves-no-receipt",
          "native-guidance-COMMIT-ACK-loss-and-Graph-unknown-no-second-POST",
          "original-conversation-deadline-crossed-after-first-provider-guard-no-POST",
          "original-SENT-prompt-failed-in-same-locked-transaction-after-snapshot-no-first-POST",
          "OWN-neutral-full-composition-original-60s-lease-controlled-225ms-SQL-200ms-Graph"
        ],
        "caseMatrix": [
          {
            "name": "signed-production-neutral-four-commands-consent",
            "commands": [
              "HOLA",
              "ESTADO",
              "MENU",
              "MENÚ"
            ],
            "replyCopyVersion": 3,
            "posts": 4,
            "replayPosts": 0,
            "workerBytesUnchanged": true,
            "sourcePromptBytesUnchanged": true,
            "privateIo": 0,
            "captureWrites": 0
          },
          {
            "name": "signed-production-neutral-four-commands-front",
            "commands": [
              "HOLA",
              "ESTADO",
              "MENU",
              "MENÚ"
            ],
            "replyCopyVersion": 3,
            "posts": 4,
            "replayPosts": 0,
            "workerBytesUnchanged": true,
            "sourcePromptBytesUnchanged": true,
            "privateIo": 0,
            "captureWrites": 0
          },
          {
            "name": "signed-production-neutral-four-commands-back",
            "commands": [
              "HOLA",
              "ESTADO",
              "MENU",
              "MENÚ"
            ],
            "replyCopyVersion": 3,
            "posts": 4,
            "replayPosts": 0,
            "workerBytesUnchanged": true,
            "sourcePromptBytesUnchanged": true,
            "privateIo": 0,
            "captureWrites": 0
          },
          {
            "name": "signed-production-neutral-four-commands-selfie",
            "commands": [
              "HOLA",
              "ESTADO",
              "MENU",
              "MENÚ"
            ],
            "replyCopyVersion": 3,
            "posts": 4,
            "replayPosts": 0,
            "workerBytesUnchanged": true,
            "sourcePromptBytesUnchanged": true,
            "privateIo": 0,
            "captureWrites": 0
          },
          {
            "name": "signed-production-neutral-four-commands-confirm",
            "commands": [
              "HOLA",
              "ESTADO",
              "MENU",
              "MENÚ"
            ],
            "replyCopyVersion": 3,
            "posts": 4,
            "replayPosts": 0,
            "workerBytesUnchanged": true,
            "sourcePromptBytesUnchanged": true,
            "privateIo": 0,
            "captureWrites": 0
          },
          {
            "name": "current-issuer-revoked-after-reservation-no-first-POST-or-replay",
            "posts": 0,
            "state": "SEND_STARTED",
            "workerBytesUnchanged": true
          },
          {
            "name": "actual-PG-concurrent-guidance-receipt-single-outbox-and-HTTP",
            "uncommittedReceiptInvisible": true,
            "receiptCount": 1,
            "outboxCount": 1,
            "posts": 1,
            "workerBytesUnchanged": true
          },
          {
            "name": "native-guidance-ROLLBACK-leaves-no-receipt",
            "commitApplied": false,
            "receiptCount": 1,
            "outboxCount": 1,
            "posts": 1,
            "replayPosts": 0,
            "workerBytesUnchanged": true
          },
          {
            "name": "native-guidance-COMMIT-ACK-loss-and-Graph-unknown-no-second-POST",
            "commitApplied": true,
            "receiptCount": 1,
            "outboxCount": 1,
            "posts": 1,
            "replayPosts": 0,
            "workerBytesUnchanged": true
          },
          {
            "name": "original-conversation-deadline-crossed-after-first-provider-guard-no-POST",
            "actualSqlClock": true,
            "issuanceOffsetMs": 1792000,
            "sourceLeaseStillLive": true,
            "deadlineRenewed": false,
            "posts": 0,
            "workerBytesUnchanged": true,
            "state": "SEND_STARTED"
          },
          {
            "name": "original-SENT-prompt-failed-in-same-locked-transaction-after-snapshot-no-first-POST",
            "actualRollbackRestoresPrompt": true,
            "posts": 0,
            "state": "SEND_STARTED",
            "workerBytesUnchanged": true
          },
          {
            "name": "OWN-neutral-full-composition-original-60s-lease-controlled-225ms-SQL-200ms-Graph",
            "statementDelayMs": 225,
            "graphDelayMs": 200,
            "sourceLeaseMs": 60000,
            "leaseExtended": false,
            "workerWrites": 0,
            "posts": 1,
            "productionLatencyMeasured": false
          }
        ],
        "extraKeys": [
          "originalV2ActivationReceipt",
          "originalGrantUnchanged",
          "setupChronology",
          "syntheticIssuanceClock"
        ],
        "matrixObservation": {
          "rawProofSha256": "0cb137a7d90722327491fd82a3940d69fe11520254ed8b02beabb85db050f5e0",
          "rawProofTransformed": false,
          "formalCiAcceptance": false
        }
      }
    }
  },
  "addedBlock": {
    "id": 65,
    "step": {
      "name": "Canonical task pagination, preserved field drafts and current WhatsApp guidance",
      "run": "npx eslint scripts/lib/whatsapp-field-continuity-current-ci-lineage.mjs scripts/lib/kyc-neutral-step-guidance-native.mjs scripts/lib/kyc-neutral-step-guidance-own-native.mjs scripts/verify-field-task-pagination-ci.mjs scripts/verify-field-task-pagination-ui.mjs tests/production-field-task-pagination-ci.test.mjs tests/production-whatsapp-field-continuity-current-ci-lineage.test.mjs tests/production-meta-kyc-neutral-step-guidance.test.mjs tests/production-whatsapp-menu-continuity.test.mjs tests/production-worksite-task-selector.test.mjs tests/production-workspace-task-page.test.mjs tests/production-focused-workspace-task-pagination.test.mjs --max-warnings 0\nnode --test tests/production-meta-kyc-neutral-step-guidance.test.mjs tests/production-whatsapp-menu-continuity.test.mjs\nnode scripts/verify-field-task-pagination-ci.mjs browser --expected-head \"$GITHUB_SHA\"\nnode scripts/verify-field-task-pagination-ci.mjs verify --expected-head \"$GITHUB_SHA\"\n"
    },
    "commandSha256": "dd996e6daa50b928b515e0331bcc23e6f818fc83aeae1de99e6a9bb0da2a792f"
  },
  "addedProof": {
    "id": "field-task-pagination-ui",
    "kind": "UI_FIELD_TASK_PAGINATION",
    "blockId": 65,
    "lane": "field",
    "producer": "scripts/verify-field-task-pagination-ci.mjs",
    "path": ".vercel/private/field-task-pagination-ui-evidence/current-ci.json",
    "sourceFiles": [
      "package-lock.json",
      "package.json",
      "scripts/lib/field-outbound-current-ci-lineage.mjs",
      "scripts/lib/integrated-identity-current-ci-lineage.mjs",
      "scripts/lib/kyc-expired-current-ci-lineage.mjs",
      "scripts/lib/ooxml-accounting-current-ci-lineage.mjs",
      "scripts/lib/owned-fixture-cleanup.mjs",
      "scripts/lib/participant-preanalysis-current-ci-lineage.mjs",
      "scripts/lib/plan-measurement-current-ci-lineage.mjs",
      "scripts/lib/plan-measurement-document-association-ci-lineage.mjs",
      "scripts/lib/whatsapp-field-continuity-current-ci-lineage.mjs",
      "scripts/lib/workspace-continuity-current-ci-lineage.mjs",
      "scripts/verify-field-task-pagination-ci.mjs",
      "scripts/verify-field-task-pagination-ui.mjs",
      "src/app/(identity)/cuenta/company-channel-view.mjs",
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
      "src/app/(identity)/cuenta/material-inventory-panel.js",
      "src/app/(identity)/cuenta/material-inventory-panel.module.css",
      "src/app/(identity)/cuenta/material-inventory-view.mjs",
      "src/app/(identity)/cuenta/own-company-number-view.mjs",
      "src/app/(identity)/cuenta/own-company-templates-view.mjs",
      "src/app/(identity)/cuenta/participant-office-account-view.mjs",
      "src/app/(identity)/cuenta/plan-baseline-view.mjs",
      "src/app/(identity)/cuenta/plan-source-curve.mjs",
      "src/app/(identity)/cuenta/private-bank-account-format.mjs",
      "src/app/(identity)/cuenta/private-workspace-download.js",
      "src/app/(identity)/cuenta/schedule-workbench.mjs",
      "src/app/(identity)/cuenta/site-purchase-view.mjs",
      "src/app/(identity)/cuenta/task-progress-measurement-view.mjs",
      "src/app/(identity)/cuenta/voice-progress-draft-view.js",
      "src/app/(identity)/cuenta/worksite-task-selector.js",
      "src/app/(identity)/cuenta/worksite-task-selector.module.css",
      "src/app/(identity)/cuenta/workspace-recovery-journal.mjs",
      "src/app/(identity)/cuenta/workspace-recovery-storage.mjs",
      "src/app/(identity)/cuenta/workspace-request-lifecycle.js",
      "src/app/(identity)/cuenta/workspace-request-lifecycle.mjs",
      "src/app/(identity)/cuenta/workspace-session-request.mjs",
      "src/app/(identity)/cuenta/workspace-task-page.mjs",
      "src/lib/field-media-privacy.mjs",
      "src/lib/geo.js",
      "src/lib/plan-import-document-curve.mjs",
      "src/lib/progress-measurement-quantity.js",
      "src/lib/task-progress-measurement.js",
      "src/lib/voice-progress-draft.mjs",
      "tests/fixtures/integrated-identity-contract-27aa.json",
      "tests/fixtures/plan-measurement-contract-a203.json",
      "tests/fixtures/whatsapp-field-continuity-contract-052.json",
      "tests/fixtures/workspace-continuity-contract-d5d.json",
      "tests/production-field-task-pagination-ci.test.mjs",
      "tests/production-whatsapp-field-continuity-current-ci-lineage.test.mjs",
      "tests/production-worksite-task-selector.test.mjs",
      "tests/production-workspace-task-page.test.mjs"
    ],
    "producerSha256": "fe25cce6cecd014c923852c09f7eccb9431efd33805eb8bbad03bea79997a94d",
    "checkNames": [
      "real-form-keeps-draft-through-pages-2-and-3-evidence-320",
      "real-form-keeps-draft-through-pages-2-and-3-progress-320",
      "real-form-keeps-draft-through-pages-2-and-3-material-request-320",
      "real-form-keeps-draft-through-pages-2-and-3-consumption-320",
      "real-form-keeps-draft-through-pages-2-and-3-evidence-390",
      "real-form-keeps-draft-through-pages-2-and-3-progress-390",
      "real-form-keeps-draft-through-pages-2-and-3-material-request-390",
      "real-form-keeps-draft-through-pages-2-and-3-consumption-390",
      "real-form-keeps-draft-through-pages-2-and-3-evidence-1440",
      "real-form-keeps-draft-through-pages-2-and-3-progress-1440",
      "real-form-keeps-draft-through-pages-2-and-3-material-request-1440",
      "real-form-keeps-draft-through-pages-2-and-3-consumption-1440",
      "page-503-keeps-form-and-explicit-retry-evidence-320",
      "page-503-keeps-form-and-explicit-retry-progress-320",
      "page-503-keeps-form-and-explicit-retry-material-request-320",
      "page-503-keeps-form-and-explicit-retry-consumption-320",
      "page-503-keeps-form-and-explicit-retry-evidence-390",
      "page-503-keeps-form-and-explicit-retry-progress-390",
      "page-503-keeps-form-and-explicit-retry-material-request-390",
      "page-503-keeps-form-and-explicit-retry-consumption-390",
      "page-503-keeps-form-and-explicit-retry-evidence-1440",
      "page-503-keeps-form-and-explicit-retry-progress-1440",
      "page-503-keeps-form-and-explicit-retry-material-request-1440",
      "page-503-keeps-form-and-explicit-retry-consumption-1440",
      "uncertain-original-command-blocks-task-paging-evidence-320",
      "uncertain-original-command-blocks-task-paging-progress-320",
      "uncertain-original-command-blocks-task-paging-consumption-320",
      "uncertain-original-command-blocks-task-paging-evidence-390",
      "uncertain-original-command-blocks-task-paging-progress-390",
      "uncertain-original-command-blocks-task-paging-consumption-390",
      "uncertain-original-command-blocks-task-paging-evidence-1440",
      "uncertain-original-command-blocks-task-paging-progress-1440",
      "uncertain-original-command-blocks-task-paging-consumption-1440"
    ]
  },
  "addedArtifactPattern": ".vercel/private/field-task-pagination-ui-evidence/",
  "addedEvidenceProducer": {
    "producer": "scripts/verify-field-task-pagination-ci.mjs",
    "path": ".vercel/private/field-task-pagination-ui-evidence/current-ci.json",
    "retained": true,
    "blockId": 65,
    "lane": "field",
    "producerSha256": "fe25cce6cecd014c923852c09f7eccb9431efd33805eb8bbad03bea79997a94d",
    "sourceBasis": "EXPECTED_HEAD_GIT_BYTES"
  },
  "limits": {
    "historical49PinsChanged": false,
    "rawProofTransformed": false,
    "currentCiAccepted": false,
    "identityOrProviderAccepted": false
  }
});

function section(contract){
 if(!plain(contract)||!Object.hasOwn(contract,WHATSAPP_FIELD_CONTINUITY_SECTION))return null;
 const value=contract[WHATSAPP_FIELD_CONTINUITY_SECTION],expected=WHATSAPP_FIELD_CONTINUITY_CURRENT_REVISION;
 requireLineage(expected.status==='REVIEWED_FROZEN_CURRENT_SOURCE','Current WA/field source is not frozen');
 exactKeys(value,[...Object.keys(expected),'validationSources'],'Exact current WA/field revision shape required');
 for(const[key,item]of Object.entries(expected))requireLineage(same(value[key],item),'Unreviewed current WA/field revision: '+key);
 requireLineage(Array.isArray(value.validationSources)&&same(value.validationSources.map(row=>row?.path),[WHATSAPP_FIELD_CONTINUITY_HELPER_PATH,WHATSAPP_FIELD_CONTINUITY_TEST_PATH]),'Exact WA/field validation source paths required');
 for(const row of value.validationSources){exactKeys(row,['path','sha256'],'Exact validation pin shape required');requireLineage(hash(row.sha256),'Current validation hash required');}
 return value;
}
function union(previous,delta){
 requireLineage(Array.isArray(previous)&&previous.length===delta.previousCount&&sha(JSON.stringify(previous))===delta.previousPathsSha256,'Exact 052 source set required: '+delta.family);
 requireLineage(Array.isArray(delta.additions)&&new Set(delta.additions).size===delta.additions.length&&delta.additions.every(file=>safe(file)&&!previous.includes(file)),'Only enumerated additive source dependencies are allowed');
 const current=[...previous,...delta.additions].sort();requireLineage(current.length===delta.currentCount&&sha(JSON.stringify(current))===delta.currentPathsSha256,'Exact current source set required: '+delta.family);return current;
}
export function composeWhatsappFieldContinuityContract(value){
 section({[WHATSAPP_FIELD_CONTINUITY_SECTION]:value});const current=structuredClone(checkpoint);
 for(const delta of value.proofSourceDeltas){const proof=current.extension.proofs.find(row=>row.id===delta.id);requireLineage(Boolean(proof),'Unknown predecessor proof');proof.sourceFiles=union(proof.sourceFiles,delta);if(delta.id==='participant-kyc-preanalysis-postgres'){requireLineage(same(current.participantPreanalysisCurrentRevision.ciSourceFiles,checkpoint.extension.proofs.find(row=>row.id===delta.id).sourceFiles),'AI current metadata and proof sources must agree');current.participantPreanalysisCurrentRevision.ciSourceFiles=[...proof.sourceFiles];}}
 for(const change of value.currentProofChanges){const proof=current.extension.proofs.find(row=>row.id===change.id);requireLineage(proof&&proof.producerSha256===change.previousProducerSha256&&same(proof.checkNames,change.previousCheckNames),'Exact 052 producer and checks required');requireLineage(same(change.currentCheckNames.slice(0,change.previousCheckNames.length),change.previousCheckNames),'Every historical check must remain an ordered prefix');proof.producerSha256=change.currentProducerSha256;proof.checkNames=[...change.currentCheckNames];const records=current.evidenceProducers.filter(row=>row.path===proof.path&&row.producer===proof.producer);requireLineage(records.length===1&&records[0].producerSha256===change.previousProducerSha256,'Exact previous evidence producer record required');records[0].producerSha256=change.currentProducerSha256;}
 const block=value.addedBlock,proof=value.addedProof,record=value.addedEvidenceProducer,artifact=value.addedArtifactPattern;
 requireLineage(artifact==='.vercel/private/field-task-pagination-ui-evidence/','Only the canonical retained pagination artifact namespace is permitted');
 requireLineage(block.id===65&&!current.blocks.some(row=>row.id===65)&&block.commandSha256===sha(block.step.run),'Exact additive 59th block, unique ID65 and command required');
 requireLineage(proof.id==='field-task-pagination-ui'&&proof.kind==='UI_FIELD_TASK_PAGINATION'&&proof.blockId===65&&proof.lane==='field'&&proof.path===artifact+'current-ci.json'&&same(record,{producer:proof.producer,path:proof.path,retained:true,blockId:65,lane:'field',producerSha256:proof.producerSha256,sourceBasis:'EXPECTED_HEAD_GIT_BYTES'}),'Independent pagination proof and producer must agree');
 requireLineage(!current.extension.proofs.some(row=>row.id===proof.id)&&!current.artifactPatterns.includes(artifact),'A new proof and artifact namespace are required');
 current.blocks.push(structuredClone(block));current.lanes.field.blocks.push(65);current.lanes.field.artifacts.push(artifact);current.lanes.field.requiredRetainedEvidence.push(proof.path);current.artifactPatterns.push(artifact);current.evidenceProducers.push(structuredClone(record));current.extension.proofs.push(structuredClone(proof));
 current[WHATSAPP_FIELD_CONTINUITY_SECTION]=structuredClone(value);return current;
}
// Only metadata is inverted. Current source readers and original native/browser
// bytes are never replaced by historical data or relabelled as a current run.
export function restoreWhatsappFieldContinuityPreviousContract(contract){
 contract=restoreMaterialReviewPreviousContract(contract);
 const value=section(contract);if(!value)return contract;
 requireLineage(same(contract,composeWhatsappFieldContinuityContract(value)),'The complete 052 contract must restore without any historical edit');return structuredClone(checkpoint);
}
function authenticatedSection(contract){const value=section(contract);if(value)restoreWhatsappFieldContinuityPreviousContract(contract);return value;}
const historicalPinCache=new Map();
function historicalPins(file){
 if(historicalPinCache.has(file))return new Set(historicalPinCache.get(file));const result=new Set();
 function walk(value){if(!value||typeof value!=='object')return;if(!Array.isArray(value)&&(value.path===file||value.file===file||value.producer===file))for(const key of ['sha256','sourceLfSha256','producerSha256','previousSha256','currentSha256','originalSha256','previousProducerSha256','currentProducerSha256'])if(hash(value[key]))result.add(value[key]);for(const child of Object.values(value))if(child&&typeof child==='object')walk(child);}walk(checkpoint);historicalPinCache.set(file,[...result]);return result;
}
export function whatsappFieldContinuityCurrentSourcePin(contract,ref){
 const value=section(contract);
 if(!value)return materialReviewCurrentSourcePin(contract,ref);
 const row=[...value.reviewedSourceChanges,...value.validationDeltas].find(item=>item.path===ref.path);
 if(!row)return materialReviewCurrentSourcePin(contract,ref);
 const current=materialReviewCurrentSourcePin(contract,{path:row.path,sha256:row.currentSha256});
 if(current!==row.currentSha256&&[row.currentSha256,current].includes(ref.sha256))return current;
 const allowed=historicalPins(ref.path);allowed.add(row.previousSha256);requireLineage(allowed.has(ref.sha256),'Only an authenticated 052 or inherited source pin may advance: '+ref.path);return current;
}
export function whatsappFieldContinuityValidationFiles(contract){
 const value=authenticatedSection(contract);if(!value)return[];
 return [...new Set([...materialReviewValidationFiles(contract),WHATSAPP_FIELD_CONTINUITY_CHECKPOINT_PATH,...value.reviewedSourceChanges.map(row=>row.path),...value.validationDeltas.map(row=>row.path),...value.addedSources.map(row=>row.path),...value.validationSources.map(row=>row.path)])].sort();
}
export function verifyWhatsappFieldContinuityCurrentSources(contract,readSource){
 verifyMaterialReviewCurrentSources(contract,readSource);
 const value=authenticatedSection(contract);if(!value)return null;requireLineage(typeof readSource==='function','Current committed source reader required');
 const original=readSource(WHATSAPP_FIELD_CONTINUITY_CHECKPOINT_PATH);requireLineage(Buffer.isBuffer(original)&&sha(original)===WHATSAPP_FIELD_CONTINUITY_PREVIOUS_CONTRACT_SHA256,'Exact original 052 GitLF checkpoint bytes required');
 const refs=[...value.reviewedSourceChanges.map(row=>({path:row.path,sha256:row.currentSha256})),...value.validationDeltas.map(row=>({path:row.path,sha256:row.currentSha256})),...value.addedSources,...value.validationSources];requireLineage(new Set(refs.map(row=>row.path)).size===refs.length,'Unique current WA/field references required');
 for(const row of refs){requireLineage(safe(row.path)&&hash(row.sha256),'Exact safe current source reference required');const bytes=readSource(row.path);requireLineage(Buffer.isBuffer(bytes),'Missing current WA/field source: '+row.path);const text=bytes.toString('utf8');requireLineage(bytes.equals(Buffer.from(text))&&sha(text.replaceAll('\r\n','\n'))===materialReviewCurrentSourcePin(contract,row),'Stale current WA/field source: '+row.path);}
 return{version:1,previousContractSha256:WHATSAPP_FIELD_CONTINUITY_PREVIOUS_CONTRACT_SHA256,completeCheckpointRestored:true,historical49PinsPreserved:true,auxiliaryValidationSources:refs.map(row=>({...row})),nativeOrBrowserAcceptance:false};
}
export function restoreWhatsappFieldContinuitySourceSet(family,files,contract){
 const value=authenticatedSection(contract),delta=value&&[...value.sourceSetDeltas,...value.proofSourceDeltas].find(row=>row.family===family);
 // This API also owns its exact frozen historical layer. Only that complete
 // count/hash may bypass projections belonging to later revisions.
 const frozenLayer=delta&&Array.isArray(files)&&new Set(files).size===files.length&&same(files,[...files].sort())&&files.length===delta.currentCount&&sha(JSON.stringify(files))===delta.currentPathsSha256;
 if(!frozenLayer)files=restoreMaterialReviewSourceSet(family,files,contract);
 if(!value||!delta)return files;
 requireLineage(Array.isArray(files)&&new Set(files).size===files.length&&same(files,[...files].sort())&&files.length===delta.currentCount&&sha(JSON.stringify(files))===delta.currentPathsSha256,'Exact current WA/field source set required: '+family);
 const previous=files.filter(file=>!delta.additions.includes(file));requireLineage(previous.length===delta.previousCount&&sha(JSON.stringify(previous))===delta.previousPathsSha256,'Exact 052 predecessor set must remain present: '+family);return previous;
}
function inheritedProofSet(spec){
 const candidates=[];const proof=checkpoint.extension.proofs.find(row=>row.id===spec.id);if(proof)candidates.push([proof.sourceFiles.length,sha(JSON.stringify(proof.sourceFiles))]);
 for(const value of Object.values(checkpoint)){if(!plain(value))continue;for(const row of value.proofSourceDeltas||[])if(row.id===spec.id)candidates.push([row.previousCount,row.previousPathsSha256],[row.currentCount,row.currentPathsSha256]);}
 return candidates.some(([count,digest])=>spec.sourceFiles?.length===count&&sha(JSON.stringify(spec.sourceFiles))===digest);
}
export function whatsappFieldContinuityProofSourceAdditions(spec){
 if(inheritedProofSet(spec||{}))return[];
 const outer=materialReviewProofSourceAdditions(spec);if(outer.length)spec={...spec,sourceFiles:spec.sourceFiles.filter(file=>!outer.includes(file))};
 const delta=WHATSAPP_FIELD_CONTINUITY_CURRENT_REVISION.proofSourceDeltas?.find(row=>row.id===spec?.id);if(!delta)return outer;
 if(inheritedProofSet(spec))return outer;
 requireLineage(spec.sourceFiles?.length===delta.currentCount&&sha(JSON.stringify(spec.sourceFiles))===delta.currentPathsSha256,'Unknown WA/field proof source set');return [...delta.additions,...outer];
}

const syntaxShape=value=>Array.isArray(value)?value.map(syntaxShape):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([key])=>!['start','end','loc','extra','comments','leadingComments','innerComments','trailingComments'].includes(key)).map(([key,item])=>[key,syntaxShape(item)])):value;
export function whatsappFieldCompanyNativeSourceFiles(readSource,libraryFiles){
 const family=WHATSAPP_FIELD_CONTINUITY_NATIVE.families?.COMPANY;requireLineage(WHATSAPP_FIELD_CONTINUITY_NATIVE.status==='REVIEWED_FROZEN_CURRENT_SOURCE'&&family,'Frozen current COMPANY producer required');
 requireLineage(typeof readSource==='function'&&Array.isArray(libraryFiles)&&same(libraryFiles,[...libraryFiles].sort())&&new Set(libraryFiles).size===libraryFiles.length&&libraryFiles.every(file=>safe(file)&&file.startsWith('src/lib/')),'Complete distinct current library paths required');
 const raw=readSource(family.producer);requireLineage(Buffer.isBuffer(raw)&&sha(raw.toString('utf8').replaceAll('\r\n','\n'))===family.producerSha256,'Exact current COMPANY producer source required');
 const tree=parse(raw.toString('utf8'),{sourceType:'module'}),declarations=tree.program.body.filter(node=>node.type==='VariableDeclaration').flatMap(node=>node.declarations),actual=declarations.find(node=>node.id?.name==='sourceManifest')?.init;
 const roots=['src/app/(identity)/cuenta/private-bank-account-format.mjs','scripts/fixtures/meta-signup-field-lifecycle-fixture.mjs','scripts/lib/kyc-context-feedback-native.mjs','scripts/lib/kyc-current-image-native.mjs','scripts/lib/kyc-neutral-step-guidance-native.mjs'];
 const expected=parse("const sourceManifest=[...sources('src/lib'),"+roots.map(file=>JSON.stringify(file)).join(',')+"].map(file=>({path:file,sha256:sha(readFileSync(path.join(root,file)))}));",{sourceType:'module'}).program.body[0].declarations[0].init;
 requireLineage(actual&&same(syntaxShape(actual),syntaxShape(expected)),'Exact additive current COMPANY source-manifest AST required');
 const files=[...libraryFiles,...roots].sort(),contractBytes=readSource('.github/workspace-acceptance-contract.json'),contract=Buffer.isBuffer(contractBytes)?JSON.parse(contractBytes):null,expectedFiles=existingApiPlanNativeSourceFilesFromReader(readSource,'COMPANY',family.sourceFiles);
 const previousFiles=contract?.[WORKSITE_LIVE_HOURS_CURRENT_SECTION]?restoreWorksiteLiveHoursSourceSet(contract,'PG_COMPANY_KYC',files):files;
 requireLineage(same(previousFiles,expectedFiles),'Exact complete current COMPANY path set required');for(const file of files)requireLineage(Buffer.isBuffer(readSource(file)),'Missing actual COMPANY source: '+file);return files;
}

// Extend only a complete authenticated API-layer native set. The old matrix
// stays immutable; current raw receipts carry the exact outer source union.
function currentWorksiteNativeSourceFiles(contract,familyName,previous){
 const family=familyName==='COMPANY'?'PG_COMPANY_KYC':'COMPACT';let current=previous;
 if(contract?.[WORKSITE_LIVE_HOURS_CURRENT_SECTION]){
  const delta=contract[WORKSITE_LIVE_HOURS_CURRENT_SECTION].sourceSetDeltas.find(row=>row.family===family);
  requireLineage(delta&&Array.isArray(delta.additions),'An exact current native companion delta is required');
  current=[...previous,...delta.additions].sort();
  const restored=restoreWorksiteLiveHoursSourceSet(contract,family,current);
  requireLineage(same(restored,previous),'The complete historical native matrix must restore exactly');
 }
 if(contract?.[PLAN_BUDGET_CURRENT_SECTION]){
  try{
   // Authenticate the complete outer declaration and its inverse before using
   // its delta. The raw native proof remains the full actual source manifest.
   restorePlanBudgetPreviousContract(contract);
   const delta=contract[PLAN_BUDGET_CURRENT_SECTION].sourceSetDeltas.find(row=>row.family===family);
   requireLineage(delta&&Array.isArray(delta.additions),'An exact Budget native companion delta is required');
   let next;
   if(delta.contractPointer!==null){
    const pointer=/^\/extension\/proofs\/(\d+)\/sourceFiles$/.exec(delta.contractPointer),proof=pointer?contract.extension?.proofs?.[Number(pointer[1])]:null;
    requireLineage(proof&&proof.kind===family&&proof.producer===WHATSAPP_FIELD_CONTINUITY_NATIVE.families[familyName].producer&&contract.extension.proofs.filter(row=>row.kind===family).length===1&&Array.isArray(proof.sourceFiles),'The authenticated complete current native proof is required');
    next=[...proof.sourceFiles];
   }else{
    const currentFamily=contract[PLAN_BUDGET_CURRENT_SECTION].sourceFamilies.find(row=>row.family===family);
    requireLineage(currentFamily&&Array.isArray(currentFamily.currentFiles),'The authenticated complete current native family is required');
    next=[...currentFamily.currentFiles];
   }
   const restored=restorePlanBudgetSourceSet(contract,family,next);
   requireLineage(same(restored,current),'The complete pre-Budget native matrix must restore exactly');current=next;
  }catch(error){if(error.code==='PLAN_BUDGET_CURRENT_CI_LINEAGE_REJECTED')requireLineage(false,error.message);throw error;}
 }
 return current;
}

// Additional native observations are mandatory under this current contract.
// Original13/17/4 matrices, leases and raw proofs remain independently checked
// by their existing validators; this guard never replaces those checks.
export function validateWhatsappFieldNeutralStepNative(proof,familyName,contract,readSource){
 const value=authenticatedSection(contract);if(!value)return null;
 requireLineage(['COMPANY','OWN'].includes(familyName)&&WHATSAPP_FIELD_CONTINUITY_NATIVE.status==='REVIEWED_FROZEN_CURRENT_SOURCE','Exact current native family required');
 verifyWhatsappFieldContinuityCurrentSources(contract,readSource);
 const family=WHATSAPP_FIELD_CONTINUITY_NATIVE.families[familyName],dto=proof?.[family.dtoField];
 exactKeys(dto,['version','status','kind','postgresExecuted','compositionFactory','checks','cases','syntheticOnly','realProviderCalls','privateIo','identityCertified','permissionsGranted','humanAccepted','sourceState',...family.extraKeys],'current neutral-guidance native DTO');
 requireLineage(dto.version===1&&dto.status==='PASS'&&dto.kind===family.kind&&dto.postgresExecuted===true&&dto.compositionFactory==='createMetaCustomerProductionProcessor'&&same(dto.checks,family.checkNames)&&dto.syntheticOnly===true&&dto.realProviderCalls===0&&dto.privateIo===0&&dto.identityCertified===false&&dto.permissionsGranted===false&&dto.humanAccepted===false&&dto.sourceState==='ADDITIVE_NATIVE_GROUP_HISTORICAL_17_AND_4_UNCHANGED','All actual native execution, isolation and non-acceptance facts required');
 if(familyName==='OWN'){
  requireLineage(dto.originalGrantUnchanged===true&&typeof dto.originalV2ActivationReceipt==='string'&&dto.originalV2ActivationReceipt.length>0&&dto.originalV2ActivationReceipt.length<=256&&!/[\x00-\x1f]/.test(dto.originalV2ActivationReceipt),'The original v2 activation receipt must remain explicit and unchanged');
  exactKeys(dto.setupChronology,['canonicalGrantIssuedAt','earliestCanonicalClaimedAt','grantPrecedesClaim','grantAndOriginReceiptUnchanged','continuationClock'],'Exact original OWN setup chronology required');
  const chronology=dto.setupChronology,canonicalInstant=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
  requireLineage(canonicalInstant(chronology.canonicalGrantIssuedAt)&&canonicalInstant(chronology.earliestCanonicalClaimedAt)&&Date.parse(chronology.canonicalGrantIssuedAt)<=Date.parse(chronology.earliestCanonicalClaimedAt)&&chronology.grantPrecedesClaim===true&&chronology.grantAndOriginReceiptUnchanged===true&&chronology.continuationClock==='actual-PostgreSQL-clock','Original canonical OWN grant must precede its earliest canonical claim under the actual continuation clock');
  exactKeys(dto.syntheticIssuanceClock,['windows','dateNowDescriptorRestored','dateNowFunctionRestored','continuationClock'],'Exact OWN synthetic issuance clock restoration evidence required');
  const issuance=dto.syntheticIssuanceClock;
  requireLineage(issuance.windows===1&&issuance.dateNowDescriptorRestored===true&&issuance.dateNowFunctionRestored===true&&issuance.continuationClock==='actual-PostgreSQL-clock','Exactly one synthetic issuance window must restore the Date.now descriptor and function before actual-clock continuation');
 }
 requireLineage(Array.isArray(dto.cases)&&same(dto.cases.map(row=>row?.name),family.caseNames),'Every current native case is required in order');
 const projected=dto.cases.map(row=>{
  const omit=[];
  if(row.name==='actual-PG-concurrent-guidance-receipt-single-outbox-and-HTTP'){
   requireLineage(Number.isSafeInteger(row.blockedPid)&&row.blockedPid>0&&Array.isArray(row.blockingPids)&&row.blockingPids.length>0&&new Set(row.blockingPids).size===row.blockingPids.length&&row.blockingPids.every(pid=>Number.isSafeInteger(pid)&&pid>0&&pid!==row.blockedPid),'Actual PG blocker observations required without inferring an exclusive source-row lock');omit.push('blockedPid','blockingPids');
  }
  if(row.name==='original-SENT-prompt-failed-in-same-locked-transaction-after-snapshot-no-first-POST'){
   requireLineage(typeof row.mutationTransaction==='string'&&/^[1-9]\d*$/.test(row.mutationTransaction),'Actual locked mutation transaction required');omit.push('mutationTransaction');
  }
  if(row.name==='OWN-neutral-full-composition-original-60s-lease-controlled-225ms-SQL-200ms-Graph'){
   requireLineage(Number.isFinite(row.elapsedMs)&&row.elapsedMs>0&&row.elapsedMs<60000&&Number.isFinite(row.marginMs)&&row.marginMs===60000-row.elapsedMs&&row.marginMs>0&&row.statementDelayMs===225&&row.graphDelayMs===200&&row.sourceLeaseMs===60000&&row.leaseExtended===false&&row.productionLatencyMeasured===false,'The unchanged controlled225/200 budget must fit its original60000ms source lease');omit.push('elapsedMs','marginMs');
  }
  return Object.fromEntries(Object.entries(row).filter(([key])=>!omit.includes(key)));
 });
 requireLineage(same(projected,family.caseMatrix),'Every fixed current native observation must equal its reviewed matrix');
 const producer=readSource(family.producer);requireLineage(Buffer.isBuffer(producer)&&sha(producer.toString('utf8').replaceAll('\r\n','\n'))===family.producerSha256&&proof.harnessSha256===sha(producer),'Actual native harness must equal the current source reader');
 const currentNativeFiles=currentWorksiteNativeSourceFiles(contract,familyName,existingApiPlanCurrentNativeSourceFiles(contract,familyName,family.sourceFiles));
 requireLineage(Array.isArray(proof.sourceManifest)&&proof.sourceManifest.length===currentNativeFiles.length&&same(proof.sourceManifest.map(row=>row?.path).sort(),currentNativeFiles),'The complete current native source manifest is required');
 for(const row of proof.sourceManifest){exactKeys(row,['path','sha256'],'native source reference');const bytes=readSource(row.path);requireLineage(Buffer.isBuffer(bytes)&&row.sha256===sha(bytes),'Stale native source bytes: '+row.path);}
 return{version:1,status:'PASS',family:familyName,currentCases:family.caseNames.length,currentNativeSourceCount:currentNativeFiles.length,historicalCasesPreserved:familyName==='COMPANY'?17:4,rawProofTransformed:false,sourceLeaseExtended:false,identityOrProviderAccepted:false};
}

// Pure negative-test fixture only. It does not execute SQL or create a receipt;
// current CI still requires the original, separately hashed producer output.
export function whatsappFieldNeutralStepShadowFixture(familyName){
 const family=WHATSAPP_FIELD_CONTINUITY_NATIVE.families?.[familyName];requireLineage(WHATSAPP_FIELD_CONTINUITY_NATIVE.status==='REVIEWED_FROZEN_CURRENT_SOURCE'&&family,'Frozen native matrix required for its explicit unit shadow');
 const cases=structuredClone(family.caseMatrix);for(const row of cases){if(row.name==='actual-PG-concurrent-guidance-receipt-single-outbox-and-HTTP'){row.blockedPid=101;row.blockingPids=[102];}if(row.name==='original-SENT-prompt-failed-in-same-locked-transaction-after-snapshot-no-first-POST')row.mutationTransaction='11';if(row.name==='OWN-neutral-full-composition-original-60s-lease-controlled-225ms-SQL-200ms-Graph'){row.elapsedMs=50000;row.marginMs=10000;}}
 return{version:1,status:'PASS',kind:family.kind,postgresExecuted:true,compositionFactory:'createMetaCustomerProductionProcessor',checks:[...family.checkNames],cases,syntheticOnly:true,realProviderCalls:0,privateIo:0,identityCertified:false,permissionsGranted:false,humanAccepted:false,sourceState:'ADDITIVE_NATIVE_GROUP_HISTORICAL_17_AND_4_UNCHANGED',...(familyName==='OWN'?{originalV2ActivationReceipt:'synthetic-shadow-original-v2-receipt',originalGrantUnchanged:true,setupChronology:{canonicalGrantIssuedAt:'2026-01-01T00:00:00.000Z',earliestCanonicalClaimedAt:'2026-01-01T00:01:00.000Z',grantPrecedesClaim:true,grantAndOriginReceiptUnchanged:true,continuationClock:'actual-PostgreSQL-clock'},syntheticIssuanceClock:{windows:1,dateNowDescriptorRestored:true,dateNowFunctionRestored:true,continuationClock:'actual-PostgreSQL-clock'}}:{})};
}
