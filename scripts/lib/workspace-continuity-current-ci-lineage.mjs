import {restoreWhatsappFieldContinuityPreviousContract as outer0,whatsappFieldContinuityCurrentSourcePin as outer1,verifyWhatsappFieldContinuityCurrentSources as outer2,restoreWhatsappFieldContinuitySourceSet as outer3,whatsappFieldContinuityProofSourceAdditions as outer4,whatsappFieldContinuityValidationFiles as outer5} from './whatsapp-field-continuity-current-ci-lineage.mjs';
function outerCall(fn,args){try{return fn(...args);}catch(error){if(error.code==='WHATSAPP_FIELD_CONTINUITY_CURRENT_CI_LINEAGE_REJECTED')throw Object.assign(new Error(error.message),{code:'WORKSPACE_CONTINUITY_CURRENT_CI_LINEAGE_REJECTED'});throw error;}}
const restoreWhatsappFieldContinuityPreviousContract=(...args)=>outerCall(outer0,args);
const whatsappFieldContinuityCurrentSourcePin=(...args)=>outerCall(outer1,args);
const verifyWhatsappFieldContinuityCurrentSources=(...args)=>outerCall(outer2,args);
const restoreWhatsappFieldContinuitySourceSet=(...args)=>outerCall(outer3,args);
const whatsappFieldContinuityProofSourceAdditions=(...args)=>outerCall(outer4,args);
const whatsappFieldContinuityValidationFiles=(...args)=>outerCall(outer5,args);

import {createHash} from 'node:crypto';
import checkpoint from '../../tests/fixtures/workspace-continuity-contract-d5d.json' with {type:'json'};

export const WORKSPACE_CONTINUITY_CONTRACT_PATH='.github/workspace-acceptance-contract.json';
export const WORKSPACE_CONTINUITY_CHECKPOINT_PATH='tests/fixtures/workspace-continuity-contract-d5d.json';
export const WORKSPACE_CONTINUITY_HELPER_PATH='scripts/lib/workspace-continuity-current-ci-lineage.mjs';
export const WORKSPACE_CONTINUITY_TEST_PATH='tests/production-workspace-continuity-current-ci-lineage.test.mjs';
export const WORKSPACE_CONTINUITY_PREVIOUS_CONTRACT_SHA256='8c2afc33e9454b9c7a9d9fd2056f2c3de75f4657bbcbce4fb1bdf618e0590db3';
export const WORKSPACE_CONTINUITY_SECTION='workspaceContinuityCurrentRevision';
const sha=value=>createHash('sha256').update(value).digest('hex');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const plain=value=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const safe=value=>typeof value==='string'&&(value==='.gitattributes'||/^(?:src|scripts|tests|\.github)\//.test(value))&&!value.includes('..')&&!value.includes('\\')&&!/[\x00-\x1f]/.test(value);
const requireLineage=(ok,message)=>{if(!ok)throw Object.assign(new Error(message),{code:'WORKSPACE_CONTINUITY_CURRENT_CI_LINEAGE_REJECTED'});};
const exactKeys=(value,keys,label)=>requireLineage(plain(value)&&same(Object.keys(value).sort(),[...keys].sort()),label);
function deepFreeze(value){if(value&&typeof value==='object'){for(const child of Object.values(value))deepFreeze(child);Object.freeze(value);}return value;}
deepFreeze(checkpoint);
requireLineage(sha(JSON.stringify(checkpoint,null,2)+'\n')===WORKSPACE_CONTINUITY_PREVIOUS_CONTRACT_SHA256,'The complete d5d checkpoint is immutable');

// Pending metadata is deliberately unusable by a current CI envelope. The
// complete observed matrix is bound after the original browser run completes.
export const WORKSPACE_CONTINUITY_FOCUSED_UI=deepFreeze({
  "status": "REVIEWED_FROZEN_CURRENT_SOURCE",
  "ciVersion": "focused-workspace-ci-v2",
  "rawVersion": 2,
  "previousRawVersion": 1,
  "previousCheckCount": 20,
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
    "three-step-synthetic-identity-explicit-consents-and-unknown-receipt-survive-navigation-1440"
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
    "bootstrap-ready-receipt-compact-disclosure-trial-no-POST-1440"
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
  "widths": [
    390,
    1440
  ],
  "continuityWidths": [
    320,
    390,
    1440
  ],
  "previousUnitFiles": [
    "tests/production-focused-workspace-navigation.test.mjs",
    "tests/production-focused-workspace-ui.test.mjs",
    "tests/production-focused-workspace-ci.test.mjs"
  ],
  "unitFiles": [
    "tests/production-focused-workspace-navigation.test.mjs",
    "tests/production-focused-workspace-ui.test.mjs",
    "tests/production-focused-workspace-ci.test.mjs",
    "tests/production-focused-workspace-continuity-ui.test.mjs",
    "tests/production-company-bootstrap-receipt.test.mjs"
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
    "bootstrap-ready-open-1440.png"
  ],
  "requestProjectionFieldsOmitted": [
    "operationId",
    "recoveryReferenceSha256",
    "syntheticImageSha256"
  ],
  "matrixObservation": {
    "rawProofSha256": "e55ed20baa471ea156c5a22113731650549f90d56161b717a4197521d8099174",
    "sourceState": "LOCAL_REVIEW_SOURCE",
    "rawProofTransformed": false,
    "formalCiAcceptance": false
  },
  "controlledSourceTransforms": [
    {
      "file": "tests/production-company-bootstrap-receipt.test.mjs",
      "sourceLfSha256": "44676be514b092d8146f6f8ade5c4b0867f8bceb1b9f5c7ab204bb5f90e503af",
      "kind": "SWC_READY_BRANCH_DATA_MODULE",
      "source": "src/app/(identity)/cuenta/company-bootstrap-panel.js",
      "compiler": "next/dist/build/swc/index.js",
      "packageLockSha256": "dfa3ff3914547f35828a0b697e6007c6cf856546be86bf8a7810cdce59e60449"
    }
  ]
});
export const WORKSPACE_CONTINUITY_CURRENT_REVISION=deepFreeze({
  "version": "workspace-continuity-current-lineage-v1",
  "status": "REVIEWED_FROZEN_CURRENT_SOURCE",
  "referenceHead": "d5d70c541a38f5043327f16d36b3270d74557c47",
  "referenceTree": "4a614bf805992eb50c7705816e1c09fd62641c99",
  "previousContractSha256": "8c2afc33e9454b9c7a9d9fd2056f2c3de75f4657bbcbce4fb1bdf618e0590db3",
  "reviewedSourceChanges": [
    {
      "path": "src/app/(identity)/cuenta/workspace-client.js",
      "previousSha256": "4143cf960157d8bd5f642842ee1672a3555c0e415c3dc4579763e2e8eabf84fb",
      "currentSha256": "75ae3226996571c43e5a03f47df2241dc28425a00b804f8eb86600b0ea528858"
    },
    {
      "path": "src/app/(identity)/cuenta/company-bootstrap-panel.js",
      "previousSha256": "b6978839dc303a0299d594ac9bd86f11e9154fdc61f74a8f4a5310eb5c2549f3",
      "currentSha256": "f8fabe5917469d3303328ebdfc447fc4c6f3bd2e1f407abbd97c4ba7b8e713d3"
    },
    {
      "path": "scripts/verify-focused-workspace-ui.mjs",
      "previousSha256": "6d61015a48202dc0affe71afe37bd026618dda325b055f1863589bdecee2963d",
      "currentSha256": "dd416eb551c96273b79ee3b1ca94ec726d7c432d2231e19028f08ccdf0fd7a5a"
    }
  ],
  "validationDeltas": [
    {
      "path": "scripts/lib/plan-measurement-document-association-ci-lineage.mjs",
      "previousSha256": "f97e010f809480f33864b6552d4c7481ce66995363783ad6854e42d21b9daefd",
      "currentSha256": "0a14f5211348d30d3a16b441a126880aeed8c7e196973ecceda7ee00307f0ef4"
    },
    {
      "path": "scripts/verify-focused-workspace-ci.mjs",
      "previousSha256": "3b9c0a1fa09e4cdd7eb731270d18c36e5f2bfbf480aa156447f3d02048a8a92d",
      "currentSha256": "b7d134ed370e7984f8aed315127b82e4d2bdebe20a6d0d79a7453bf7e1f63dab"
    },
    {
      "path": "tests/production-focused-workspace-ci.test.mjs",
      "previousSha256": "49f03cddbaf14de7912c95a8584ec5d3b2a46746c8f13745b0cfe2caae9b7b0a",
      "currentSha256": "cbba731e7ea3c1db48406827118f5b569d2c50d6c015f6c0b45d476fd5259c6b"
    },
    {
      "path": "tests/production-integrated-identity-current-ci-lineage.test.mjs",
      "previousSha256": "c13b690839a47f7ddd3ff2004f731236248b9698e789dcbd7be0ef39da6462b9",
      "currentSha256": "a5ed6df6a488480c258a3d3db9affb77f2d462d227f0d5fde75a2059075291af"
    },
    {
      "path": "tests/production-plan-measurement-current-ci-lineage.test.mjs",
      "previousSha256": "ed0fbc0ea043ba056df9b3cee093af63d16c9f56ea1bb999db0b7a77f0c54fb9",
      "currentSha256": "81672df862a520d56b3046f625a6cbcdb17b02f10cb3246345e9187217eee75c"
    },
    {
      "path": "tests/production-plan-measurement-document-association-ci-lineage.test.mjs",
      "previousSha256": "b39cebcbe42d37bdc25f2c974c337198c1be0065a0e87f4b6cf71948dee2cf63",
      "currentSha256": "3b64c238a093e1af4ffebd61d664c780635042bf370c4b7e5254ffbe386782ea"
    },
    {
      "path": ".gitattributes",
      "previousSha256": "e1d3326c228b20a41e71e8218253d810405cd138f510c4c7b2281601b8ea8c23",
      "currentSha256": "5ff38c0d92b588ae71ac359f4411e4799d3d25273e6ee28fd4c049debccbd8c9"
    }
  ],
  "addedSources": [
    {
      "path": "tests/production-focused-workspace-continuity-ui.test.mjs",
      "sha256": "90d44767054e7dc0732caf71d8a3a2e6950d0829870cf60dcf03061cd3a9417c"
    },
    {
      "path": "tests/production-company-bootstrap-receipt.test.mjs",
      "sha256": "44676be514b092d8146f6f8ade5c4b0867f8bceb1b9f5c7ab204bb5f90e503af"
    }
  ],
  "proofSourceDeltas": [
    {
      "id": "focused-workspace-ui",
      "family": "FOCUSED_WORKSPACE_CI",
      "previousCount": 170,
      "previousPathsSha256": "aea278136cfc58258f3f92e081cbdf9066c4770a48371eaa079b5ce5a4a77a88",
      "currentCount": 174,
      "currentPathsSha256": "e0d4ef354cade414d88d8d0348ed818d9bd0447b26a3bba38d8a7c8cbebf51d4",
      "additions": [
        "scripts/lib/workspace-continuity-current-ci-lineage.mjs",
        "tests/fixtures/workspace-continuity-contract-d5d.json",
        "tests/production-company-bootstrap-receipt.test.mjs",
        "tests/production-focused-workspace-continuity-ui.test.mjs"
      ]
    },
    {
      "id": "participant-kyc-preanalysis-postgres",
      "family": "WORKSPACE_PG_PARTICIPANT_KYC_PREANALYSIS",
      "previousCount": 231,
      "previousPathsSha256": "31655b2096aac71b78ab7471af7c538c75019a153beb40393d012a823b9f1835",
      "currentCount": 233,
      "currentPathsSha256": "9844cc0014597fcedda24f4ac25cf6a7c1a7c3bfdb8a37f9510e76388aa5642f",
      "additions": [
        "scripts/lib/workspace-continuity-current-ci-lineage.mjs",
        "tests/fixtures/workspace-continuity-contract-d5d.json"
      ]
    }
  ],
  "sourceSetDeltas": [],
  "currentProofChanges": [
    {
      "id": "focused-workspace-ui",
      "previousProducerSha256": "3b9c0a1fa09e4cdd7eb731270d18c36e5f2bfbf480aa156447f3d02048a8a92d",
      "currentProducerSha256": "b7d134ed370e7984f8aed315127b82e4d2bdebe20a6d0d79a7453bf7e1f63dab",
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
        "three-step-synthetic-identity-explicit-consents-and-unknown-receipt-survive-navigation-1440"
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
        "bootstrap-ready-receipt-compact-disclosure-trial-no-POST-1440"
      ]
    }
  ],
  "focusedUi": {
    "status": "REVIEWED_FROZEN_CURRENT_SOURCE",
    "ciVersion": "focused-workspace-ci-v2",
    "rawVersion": 2,
    "previousRawVersion": 1,
    "previousCheckCount": 20,
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
      "three-step-synthetic-identity-explicit-consents-and-unknown-receipt-survive-navigation-1440"
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
      "bootstrap-ready-receipt-compact-disclosure-trial-no-POST-1440"
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
    "widths": [
      390,
      1440
    ],
    "continuityWidths": [
      320,
      390,
      1440
    ],
    "previousUnitFiles": [
      "tests/production-focused-workspace-navigation.test.mjs",
      "tests/production-focused-workspace-ui.test.mjs",
      "tests/production-focused-workspace-ci.test.mjs"
    ],
    "unitFiles": [
      "tests/production-focused-workspace-navigation.test.mjs",
      "tests/production-focused-workspace-ui.test.mjs",
      "tests/production-focused-workspace-ci.test.mjs",
      "tests/production-focused-workspace-continuity-ui.test.mjs",
      "tests/production-company-bootstrap-receipt.test.mjs"
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
      "bootstrap-ready-open-1440.png"
    ],
    "requestProjectionFieldsOmitted": [
      "operationId",
      "recoveryReferenceSha256",
      "syntheticImageSha256"
    ],
    "matrixObservation": {
      "rawProofSha256": "e55ed20baa471ea156c5a22113731650549f90d56161b717a4197521d8099174",
      "sourceState": "LOCAL_REVIEW_SOURCE",
      "rawProofTransformed": false,
      "formalCiAcceptance": false
    },
    "controlledSourceTransforms": [
      {
        "file": "tests/production-company-bootstrap-receipt.test.mjs",
        "sourceLfSha256": "44676be514b092d8146f6f8ade5c4b0867f8bceb1b9f5c7ab204bb5f90e503af",
        "kind": "SWC_READY_BRANCH_DATA_MODULE",
        "source": "src/app/(identity)/cuenta/company-bootstrap-panel.js",
        "compiler": "next/dist/build/swc/index.js",
        "packageLockSha256": "dfa3ff3914547f35828a0b697e6007c6cf856546be86bf8a7810cdce59e60449"
      }
    ]
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

function section(contract){
 if(!plain(contract)||!Object.hasOwn(contract,WORKSPACE_CONTINUITY_SECTION))return null;
 const value=contract[WORKSPACE_CONTINUITY_SECTION],expected=WORKSPACE_CONTINUITY_CURRENT_REVISION;
 requireLineage(expected.status==='REVIEWED_FROZEN_CURRENT_SOURCE'&&WORKSPACE_CONTINUITY_FOCUSED_UI.status===expected.status,'Current continuity source and browser matrix are not frozen');
 exactKeys(value,[...Object.keys(expected),'validationSources'],'Exact additive continuity revision shape required');
 for(const[key,item]of Object.entries(expected))requireLineage(same(value[key],item),'Unreviewed continuity revision: '+key);
 requireLineage(Array.isArray(value.validationSources)&&same(value.validationSources.map(row=>row?.path),[WORKSPACE_CONTINUITY_HELPER_PATH,WORKSPACE_CONTINUITY_TEST_PATH]),'Exact current continuity validation source paths required');
 for(const row of value.validationSources){exactKeys(row,['path','sha256'],'Exact validation source pin shape required');requireLineage(hash(row.sha256),'Current validation source hash required');}
 return value;
}
function union(previous,delta){
 requireLineage(Array.isArray(previous)&&previous.length===delta.previousCount&&sha(JSON.stringify(previous))===delta.previousPathsSha256,'Exact d5d source set required: '+delta.family);
 requireLineage(Array.isArray(delta.additions)&&new Set(delta.additions).size===delta.additions.length&&delta.additions.every(file=>safe(file)&&!previous.includes(file)),'Only exact additive continuity source dependencies are allowed');
 const current=[...previous,...delta.additions].sort();requireLineage(current.length===delta.currentCount&&sha(JSON.stringify(current))===delta.currentPathsSha256,'Exact current continuity source set required: '+delta.family);return current;
}
export function composeWorkspaceContinuityContract(value){
 section({[WORKSPACE_CONTINUITY_SECTION]:value});const current=structuredClone(checkpoint);
 for(const delta of value.proofSourceDeltas){const proof=current.extension.proofs.find(row=>row.id===delta.id);requireLineage(Boolean(proof),'Unknown d5d proof');proof.sourceFiles=union(proof.sourceFiles,delta);if(delta.id==='participant-kyc-preanalysis-postgres'){requireLineage(same(current.participantPreanalysisCurrentRevision.ciSourceFiles,checkpoint.extension.proofs.find(row=>row.id===delta.id).sourceFiles),'AI current metadata and proof sources must agree');current.participantPreanalysisCurrentRevision.ciSourceFiles=[...proof.sourceFiles];}}
 for(const change of value.currentProofChanges){const proof=current.extension.proofs.find(row=>row.id===change.id);requireLineage(proof&&proof.producerSha256===change.previousProducerSha256&&same(proof.checkNames,change.previousCheckNames),'Exact d5d producer and check matrix required');requireLineage(same(change.currentCheckNames.slice(0,change.previousCheckNames.length),change.previousCheckNames),'All historical browser checks must remain an ordered prefix');proof.producerSha256=change.currentProducerSha256;proof.checkNames=[...change.currentCheckNames];const records=current.evidenceProducers.filter(row=>row.path===proof.path&&row.producer===proof.producer);requireLineage(records.length===1&&records[0].producerSha256===change.previousProducerSha256,'Exact d5d evidence producer record required');records[0].producerSha256=change.currentProducerSha256;}
 current[WORKSPACE_CONTINUITY_SECTION]=structuredClone(value);return current;
}
// Only contract metadata is inverted. Current-source readers and original raw
// browser/native evidence are never replaced by historical bytes.
export function restoreWorkspaceContinuityPreviousContract(contract){
 contract=restoreWhatsappFieldContinuityPreviousContract(contract);
 const value=section(contract);if(!value)return contract;
 requireLineage(same(contract,composeWorkspaceContinuityContract(value)),'The outer delta must restore the complete d5d contract without altering history');return structuredClone(checkpoint);
}
function authenticatedSection(contract){const value=section(contract);if(value)restoreWorkspaceContinuityPreviousContract(contract);return value;}
const historicalPinCache=new Map();
function historicalPins(file){
 if(historicalPinCache.has(file))return new Set(historicalPinCache.get(file));const result=new Set();
 function walk(value){if(!value||typeof value!=='object')return;if(!Array.isArray(value)&&(value.path===file||value.file===file||value.producer===file))for(const key of ['sha256','sourceLfSha256','producerSha256','previousSha256','currentSha256','originalSha256','previousProducerSha256','currentProducerSha256'])if(hash(value[key]))result.add(value[key]);for(const child of Object.values(value))if(child&&typeof child==='object')walk(child);}walk(checkpoint);historicalPinCache.set(file,[...result]);return result;
}
export function workspaceContinuityCurrentSourcePin(contract,ref){
 const outerPin=whatsappFieldContinuityCurrentSourcePin(contract,ref);if(outerPin!==ref.sha256)return outerPin;
 const value=section(contract);if(!value)return ref.sha256;
 const row=[...value.reviewedSourceChanges,...value.validationDeltas].find(item=>item.path===ref.path);if(!row)return ref.sha256;
 const allowed=historicalPins(ref.path);allowed.add(row.previousSha256);requireLineage(allowed.has(ref.sha256),'Only an authenticated d5d or inherited source pin may advance: '+ref.path);return row.currentSha256;
}
export function workspaceContinuityValidationFiles(contract){
 const outer=whatsappFieldContinuityValidationFiles(contract),value=authenticatedSection(contract);if(!value)return outer;
 return [...new Set([...outer,WORKSPACE_CONTINUITY_CHECKPOINT_PATH,...value.reviewedSourceChanges.map(row=>row.path),...value.validationDeltas.map(row=>row.path),...value.addedSources.map(row=>row.path),...value.validationSources.map(row=>row.path)])].sort();
}
export function verifyWorkspaceContinuityCurrentSources(contract,readSource){
 verifyWhatsappFieldContinuityCurrentSources(contract,readSource);
 const value=authenticatedSection(contract);if(!value)return null;requireLineage(typeof readSource==='function','Current committed source reader required');
 const original=readSource(WORKSPACE_CONTINUITY_CHECKPOINT_PATH);requireLineage(Buffer.isBuffer(original)&&sha(original)===WORKSPACE_CONTINUITY_PREVIOUS_CONTRACT_SHA256,'Original d5d RAW checkpoint bytes required');
 const refs=[...value.reviewedSourceChanges.map(row=>({path:row.path,sha256:row.currentSha256})),...value.validationDeltas.map(row=>({path:row.path,sha256:row.currentSha256})),...value.addedSources,...value.validationSources];requireLineage(new Set(refs.map(row=>row.path)).size===refs.length,'Unique continuity source references required');
 for(const row of refs){requireLineage(safe(row.path)&&hash(row.sha256),'Exact safe current source reference required');const bytes=readSource(row.path);requireLineage(Buffer.isBuffer(bytes),'Missing current continuity source: '+row.path);const text=bytes.toString('utf8');requireLineage(bytes.equals(Buffer.from(text))&&sha(text.replaceAll('\r\n','\n'))===whatsappFieldContinuityCurrentSourcePin(contract,row),'Stale current continuity source: '+row.path);}
 return{version:1,previousContractSha256:WORKSPACE_CONTINUITY_PREVIOUS_CONTRACT_SHA256,completeCheckpointRestored:true,historical49PinsPreserved:true,auxiliaryValidationSources:refs.map(row=>({...row})),nativeOrBrowserAcceptance:false};
}
export function restoreWorkspaceContinuitySourceSet(family,files,contract){
 const outerFamily=family==='FOCUSED_WORKSPACE_CI'?'UI_FOCUSED_WORKSPACE':family==='WORKSPACE_PG_PARTICIPANT_KYC_PREANALYSIS'?'PG_PARTICIPANT_KYC_PREANALYSIS':family==='WORKSPACE_PG_COMPANY_KYC'?'PG_COMPANY_KYC':family==='WORKSPACE_UI_IDENTITY_ONLY'?'UI_IDENTITY_ONLY':family;
 files=restoreWhatsappFieldContinuitySourceSet(outerFamily,files,contract);
 const value=authenticatedSection(contract);if(!value)return files;const delta=[...value.sourceSetDeltas,...value.proofSourceDeltas].find(row=>row.family===family);if(!delta)return files;
 requireLineage(Array.isArray(files)&&new Set(files).size===files.length&&same(files,[...files].sort())&&files.length===delta.currentCount&&sha(JSON.stringify(files))===delta.currentPathsSha256,'Exact current continuity source set required: '+family);
 const previous=files.filter(file=>!delta.additions.includes(file));requireLineage(previous.length===delta.previousCount&&sha(JSON.stringify(previous))===delta.previousPathsSha256,'Exact d5d predecessor sources must remain present: '+family);return previous;
}
function inheritedProofSet(spec){
 const candidates=[];const proof=checkpoint.extension.proofs.find(row=>row.id===spec.id);if(proof)candidates.push([proof.sourceFiles.length,sha(JSON.stringify(proof.sourceFiles))]);
 for(const value of Object.values(checkpoint)){if(!plain(value))continue;for(const row of value.proofSourceDeltas||[])if(row.id===spec.id)candidates.push([row.previousCount,row.previousPathsSha256],[row.currentCount,row.currentPathsSha256]);}
 return candidates.some(([count,digest])=>spec.sourceFiles?.length===count&&sha(JSON.stringify(spec.sourceFiles))===digest);
}
export function workspaceContinuityProofSourceAdditions(spec){
 const outer=whatsappFieldContinuityProofSourceAdditions(spec);if(outer.length)spec={...spec,sourceFiles:spec.sourceFiles.filter(file=>!outer.includes(file))};
 const delta=WORKSPACE_CONTINUITY_CURRENT_REVISION.proofSourceDeltas.find(row=>row.id===spec?.id);if(!delta)return outer;
 if(inheritedProofSet(spec))return outer;
 requireLineage(spec.sourceFiles?.length===delta.currentCount&&sha(JSON.stringify(spec.sourceFiles))===delta.currentPathsSha256,'Unknown continuity proof source set');return [...delta.additions,...outer];
}
