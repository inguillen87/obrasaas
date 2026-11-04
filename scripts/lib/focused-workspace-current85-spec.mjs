// Source-derived current85 specification; no observed597 vector is used.
import {createHash} from 'node:crypto';
import {WHATSAPP_FIELD_CONTINUITY_FOCUSED_UI as historical59} from './whatsapp-field-continuity-current-ci-lineage.mjs';
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const declared={
  "producerSha256": "ba7e060f53ba0a5acad6f39e0c2bdc5354c56dfaafc5cb7761ea9cff2715aabd",
  "currentCaseCount": 85,
  "partitions": [
    20,
    25,
    14,
    20,
    6
  ],
  "checks": [
    {
      "index1": 1,
      "index0": 0,
      "name": "hidden-panel-headings-absent-from-accessibility-tree-390",
      "width": 390,
      "role": "ADMIN",
      "family": "original20",
      "mode": "navigation",
      "rawNameRule": "name + colon + positive safe integer at least5"
    },
    {
      "index1": 2,
      "index0": 1,
      "name": "one-mounted-visible-overview-and-hidden-panels-390",
      "width": 390,
      "role": "ADMIN",
      "family": "original20",
      "mode": "navigation",
      "rawNameRule": "exact name"
    },
    {
      "index1": 3,
      "index0": 2,
      "name": "identity-deep-link-history-no-mutation-390",
      "width": 390,
      "role": "ADMIN",
      "family": "original20",
      "mode": "navigation",
      "rawNameRule": "exact name"
    },
    {
      "index1": 4,
      "index0": 3,
      "name": "legacy-plan-import-fragment-opens-schedule-390",
      "width": 390,
      "role": "ADMIN",
      "family": "original20",
      "mode": "navigation",
      "rawNameRule": "exact name"
    },
    {
      "index1": 5,
      "index0": 4,
      "name": "nonadmin-cannot-see-billing-or-integration-navigation-390",
      "width": 390,
      "role": "AUDITOR",
      "family": "original20",
      "mode": "navigation",
      "rawNameRule": "exact name"
    },
    {
      "index1": 6,
      "index0": 5,
      "name": "schedule-draft-survives-section-navigation-without-POST-390",
      "width": 390,
      "role": "ADMIN",
      "family": "original20",
      "mode": "navigation",
      "rawNameRule": "exact name"
    },
    {
      "index1": 7,
      "index0": 6,
      "name": "no-project-hint-keeps-an-explicit-usable-project-picker-390",
      "width": 390,
      "role": "ADMIN",
      "family": "original20",
      "mode": "navigation",
      "rawNameRule": "exact name"
    },
    {
      "index1": 8,
      "index0": 7,
      "name": "company-plan-and-recovery-without-selected-project-company-without-selection-390",
      "width": 390,
      "role": "ADMIN",
      "family": "original20",
      "mode": "company-without-selection",
      "rawNameRule": "exact name"
    },
    {
      "index1": 9,
      "index0": 8,
      "name": "company-plan-and-recovery-without-selected-project-empty-company-390",
      "width": 390,
      "role": "ADMIN",
      "family": "original20",
      "mode": "empty-company",
      "rawNameRule": "exact name"
    },
    {
      "index1": 10,
      "index0": 9,
      "name": "three-step-synthetic-identity-explicit-consents-and-unknown-receipt-survive-navigation-390",
      "width": 390,
      "role": "ADMIN",
      "family": "original20",
      "mode": "wizard",
      "rawNameRule": "exact name"
    },
    {
      "index1": 11,
      "index0": 10,
      "name": "hidden-panel-headings-absent-from-accessibility-tree-1440",
      "width": 1440,
      "role": "ADMIN",
      "family": "original20",
      "mode": "navigation",
      "rawNameRule": "name + colon + positive safe integer at least5"
    },
    {
      "index1": 12,
      "index0": 11,
      "name": "one-mounted-visible-overview-and-hidden-panels-1440",
      "width": 1440,
      "role": "ADMIN",
      "family": "original20",
      "mode": "navigation",
      "rawNameRule": "exact name"
    },
    {
      "index1": 13,
      "index0": 12,
      "name": "identity-deep-link-history-no-mutation-1440",
      "width": 1440,
      "role": "ADMIN",
      "family": "original20",
      "mode": "navigation",
      "rawNameRule": "exact name"
    },
    {
      "index1": 14,
      "index0": 13,
      "name": "legacy-plan-import-fragment-opens-schedule-1440",
      "width": 1440,
      "role": "ADMIN",
      "family": "original20",
      "mode": "navigation",
      "rawNameRule": "exact name"
    },
    {
      "index1": 15,
      "index0": 14,
      "name": "nonadmin-cannot-see-billing-or-integration-navigation-1440",
      "width": 1440,
      "role": "AUDITOR",
      "family": "original20",
      "mode": "navigation",
      "rawNameRule": "exact name"
    },
    {
      "index1": 16,
      "index0": 15,
      "name": "schedule-draft-survives-section-navigation-without-POST-1440",
      "width": 1440,
      "role": "ADMIN",
      "family": "original20",
      "mode": "navigation",
      "rawNameRule": "exact name"
    },
    {
      "index1": 17,
      "index0": 16,
      "name": "no-project-hint-keeps-an-explicit-usable-project-picker-1440",
      "width": 1440,
      "role": "ADMIN",
      "family": "original20",
      "mode": "navigation",
      "rawNameRule": "exact name"
    },
    {
      "index1": 18,
      "index0": 17,
      "name": "company-plan-and-recovery-without-selected-project-company-without-selection-1440",
      "width": 1440,
      "role": "ADMIN",
      "family": "original20",
      "mode": "company-without-selection",
      "rawNameRule": "exact name"
    },
    {
      "index1": 19,
      "index0": 18,
      "name": "company-plan-and-recovery-without-selected-project-empty-company-1440",
      "width": 1440,
      "role": "ADMIN",
      "family": "original20",
      "mode": "empty-company",
      "rawNameRule": "exact name"
    },
    {
      "index1": 20,
      "index0": 19,
      "name": "three-step-synthetic-identity-explicit-consents-and-unknown-receipt-survive-navigation-1440",
      "width": 1440,
      "role": "ADMIN",
      "family": "original20",
      "mode": "wizard",
      "rawNameRule": "exact name"
    },
    {
      "index1": 21,
      "index0": 20,
      "name": "fresh-list-project-preserves-section-no-POST-320",
      "width": 320,
      "role": "ADMIN",
      "family": "continuity25",
      "mode": "continuity-success",
      "rawNameRule": "exact name"
    },
    {
      "index1": 22,
      "index0": 21,
      "name": "fresh-list-project-preserves-section-no-POST-390",
      "width": 390,
      "role": "ADMIN",
      "family": "continuity25",
      "mode": "continuity-success",
      "rawNameRule": "exact name"
    },
    {
      "index1": 23,
      "index0": 22,
      "name": "fresh-list-project-preserves-section-no-POST-1440",
      "width": 1440,
      "role": "ADMIN",
      "family": "continuity25",
      "mode": "continuity-success",
      "rawNameRule": "exact name"
    },
    {
      "index1": 24,
      "index0": 23,
      "name": "refresh-does-not-restore-old-view-list-role-390",
      "width": 390,
      "role": "ADMIN",
      "family": "continuity25",
      "mode": "continuity-list-role",
      "rawNameRule": "exact name"
    },
    {
      "index1": 25,
      "index0": 24,
      "name": "refresh-does-not-restore-old-view-list-scope-390",
      "width": 390,
      "role": "ADMIN",
      "family": "continuity25",
      "mode": "continuity-list-scope",
      "rawNameRule": "exact name"
    },
    {
      "index1": 26,
      "index0": 25,
      "name": "refresh-does-not-restore-old-view-list-missing-390",
      "width": 390,
      "role": "ADMIN",
      "family": "continuity25",
      "mode": "continuity-list-missing",
      "rawNameRule": "exact name"
    },
    {
      "index1": 27,
      "index0": 26,
      "name": "refresh-does-not-restore-old-view-list-401-390",
      "width": 390,
      "role": "ADMIN",
      "family": "continuity25",
      "mode": "continuity-list-401",
      "rawNameRule": "exact name"
    },
    {
      "index1": 28,
      "index0": 27,
      "name": "refresh-does-not-restore-old-view-list-403-390",
      "width": 390,
      "role": "ADMIN",
      "family": "continuity25",
      "mode": "continuity-list-403",
      "rawNameRule": "exact name"
    },
    {
      "index1": 29,
      "index0": 28,
      "name": "refresh-does-not-restore-old-view-list-500-390",
      "width": 390,
      "role": "ADMIN",
      "family": "continuity25",
      "mode": "continuity-list-500",
      "rawNameRule": "exact name"
    },
    {
      "index1": 30,
      "index0": 29,
      "name": "refresh-does-not-restore-old-view-project-401-390",
      "width": 390,
      "role": "ADMIN",
      "family": "continuity25",
      "mode": "continuity-project-401",
      "rawNameRule": "exact name"
    },
    {
      "index1": 31,
      "index0": 30,
      "name": "refresh-does-not-restore-old-view-project-403-390",
      "width": 390,
      "role": "ADMIN",
      "family": "continuity25",
      "mode": "continuity-project-403",
      "rawNameRule": "exact name"
    },
    {
      "index1": 32,
      "index0": 31,
      "name": "refresh-does-not-restore-old-view-project-500-390",
      "width": 390,
      "role": "ADMIN",
      "family": "continuity25",
      "mode": "continuity-project-500",
      "rawNameRule": "exact name"
    },
    {
      "index1": 33,
      "index0": 32,
      "name": "refresh-does-not-restore-old-view-project-scope-390",
      "width": 390,
      "role": "ADMIN",
      "family": "continuity25",
      "mode": "continuity-project-scope",
      "rawNameRule": "exact name"
    },
    {
      "index1": 34,
      "index0": 33,
      "name": "refresh-does-not-restore-old-view-project-id-390",
      "width": 390,
      "role": "ADMIN",
      "family": "continuity25",
      "mode": "continuity-project-id",
      "rawNameRule": "exact name"
    },
    {
      "index1": 35,
      "index0": 34,
      "name": "refresh-does-not-restore-old-view-project-null-390",
      "width": 390,
      "role": "ADMIN",
      "family": "continuity25",
      "mode": "continuity-project-null",
      "rawNameRule": "exact name"
    },
    {
      "index1": 36,
      "index0": 35,
      "name": "refresh-truncated-list-promotes-fresh-canonical-project-390",
      "width": 390,
      "role": "ADMIN",
      "family": "continuity25",
      "mode": "continuity-truncated-success",
      "rawNameRule": "exact name"
    },
    {
      "index1": 37,
      "index0": 36,
      "name": "refresh-truncated-list-denial-keeps-old-view-closed-390",
      "width": 390,
      "role": "ADMIN",
      "family": "continuity25",
      "mode": "continuity-truncated-denied",
      "rawNameRule": "exact name"
    },
    {
      "index1": 38,
      "index0": 37,
      "name": "refresh-truncated-list-inactive-project-keeps-old-view-closed-390",
      "width": 390,
      "role": "ADMIN",
      "family": "continuity25",
      "mode": "continuity-truncated-inactive",
      "rawNameRule": "exact name"
    },
    {
      "index1": 39,
      "index0": 38,
      "name": "refresh-private-KYC-denial-keeps-only-private-presentation-390",
      "width": 390,
      "role": "ADMIN",
      "family": "continuity25",
      "mode": "continuity-private-kyc",
      "rawNameRule": "exact name"
    },
    {
      "index1": 40,
      "index0": 39,
      "name": "refresh-office-selection-uses-fresh-listed-context-without-operational-GET-390",
      "width": 390,
      "role": "AUDITOR",
      "family": "continuity25",
      "mode": "continuity-office",
      "rawNameRule": "exact name"
    },
    {
      "index1": 41,
      "index0": 40,
      "name": "refresh-late-list-cannot-reenter-rotated-session-390",
      "width": 390,
      "role": "ADMIN",
      "family": "continuity25",
      "mode": "continuity-late-list",
      "rawNameRule": "exact name"
    },
    {
      "index1": 42,
      "index0": 41,
      "name": "refresh-late-project-cannot-reenter-unmounted-workspace-390",
      "width": 390,
      "role": "ADMIN",
      "family": "continuity25",
      "mode": "continuity-late-project",
      "rawNameRule": "exact name"
    },
    {
      "index1": 43,
      "index0": 42,
      "name": "bootstrap-ready-receipt-compact-disclosure-trial-no-POST-320",
      "width": 320,
      "role": "ADMIN",
      "family": "continuity25",
      "mode": "continuity-bootstrap",
      "rawNameRule": "exact name"
    },
    {
      "index1": 44,
      "index0": 43,
      "name": "bootstrap-ready-receipt-compact-disclosure-trial-no-POST-390",
      "width": 390,
      "role": "ADMIN",
      "family": "continuity25",
      "mode": "continuity-bootstrap",
      "rawNameRule": "exact name"
    },
    {
      "index1": 45,
      "index0": 44,
      "name": "bootstrap-ready-receipt-compact-disclosure-trial-no-POST-1440",
      "width": 1440,
      "role": "ADMIN",
      "family": "continuity25",
      "mode": "continuity-bootstrap",
      "rawNameRule": "exact name"
    },
    {
      "index1": 46,
      "index0": 45,
      "name": "account-task-pages-draft-100-200-205-single-GET-field-320",
      "width": 320,
      "role": "ADMIN",
      "family": "taskPaging14",
      "mode": "task-paging-success",
      "consumer": "field",
      "rawNameRule": "exact name"
    },
    {
      "index1": 47,
      "index0": 46,
      "name": "account-task-pages-draft-100-200-205-single-GET-inventory-320",
      "width": 320,
      "role": "ADMIN",
      "family": "taskPaging14",
      "mode": "task-paging-success",
      "consumer": "inventory",
      "rawNameRule": "exact name"
    },
    {
      "index1": 48,
      "index0": 47,
      "name": "account-task-pages-draft-100-200-205-single-GET-field-390",
      "width": 390,
      "role": "ADMIN",
      "family": "taskPaging14",
      "mode": "task-paging-success",
      "consumer": "field",
      "rawNameRule": "exact name"
    },
    {
      "index1": 49,
      "index0": 48,
      "name": "account-task-pages-draft-100-200-205-single-GET-inventory-390",
      "width": 390,
      "role": "ADMIN",
      "family": "taskPaging14",
      "mode": "task-paging-success",
      "consumer": "inventory",
      "rawNameRule": "exact name"
    },
    {
      "index1": 50,
      "index0": 49,
      "name": "account-task-pages-draft-100-200-205-single-GET-field-1440",
      "width": 1440,
      "role": "ADMIN",
      "family": "taskPaging14",
      "mode": "task-paging-success",
      "consumer": "field",
      "rawNameRule": "exact name"
    },
    {
      "index1": 51,
      "index0": 50,
      "name": "account-task-pages-draft-100-200-205-single-GET-inventory-1440",
      "width": 1440,
      "role": "ADMIN",
      "family": "taskPaging14",
      "mode": "task-paging-success",
      "consumer": "inventory",
      "rawNameRule": "exact name"
    },
    {
      "index1": 52,
      "index0": 51,
      "name": "account-task-pages-503-retry-field-390",
      "width": 390,
      "role": "ADMIN",
      "family": "taskPaging14",
      "mode": "task-paging-503-retry",
      "consumer": "field",
      "rawNameRule": "exact name"
    },
    {
      "index1": 53,
      "index0": 52,
      "name": "account-task-pages-403-clear-field-390",
      "width": 390,
      "role": "ADMIN",
      "family": "taskPaging14",
      "mode": "task-paging-403-clear",
      "consumer": "field",
      "rawNameRule": "exact name"
    },
    {
      "index1": 54,
      "index0": 53,
      "name": "account-task-pages-busy-uncertain-and-late-page-field-390",
      "width": 390,
      "role": "ADMIN",
      "family": "taskPaging14",
      "mode": "task-paging-busy",
      "consumer": "field",
      "rawNameRule": "exact name"
    },
    {
      "index1": 55,
      "index0": 54,
      "name": "account-task-pages-503-retry-inventory-390",
      "width": 390,
      "role": "ADMIN",
      "family": "taskPaging14",
      "mode": "task-paging-503-retry",
      "consumer": "inventory",
      "rawNameRule": "exact name"
    },
    {
      "index1": 56,
      "index0": 55,
      "name": "account-task-pages-403-clear-inventory-390",
      "width": 390,
      "role": "ADMIN",
      "family": "taskPaging14",
      "mode": "task-paging-403-clear",
      "consumer": "inventory",
      "rawNameRule": "exact name"
    },
    {
      "index1": 57,
      "index0": 56,
      "name": "account-task-pages-busy-uncertain-and-late-page-inventory-390",
      "width": 390,
      "role": "ADMIN",
      "family": "taskPaging14",
      "mode": "task-paging-busy",
      "consumer": "inventory",
      "rawNameRule": "exact name"
    },
    {
      "index1": 58,
      "index0": 57,
      "name": "account-task-pages-404-revoked-clear-field-390",
      "width": 390,
      "role": "ADMIN",
      "family": "taskPaging14",
      "mode": "task-paging-404-revoked-clear",
      "consumer": "field",
      "rawNameRule": "exact name"
    },
    {
      "index1": 59,
      "index0": 58,
      "name": "account-task-pages-404-revoked-clear-inventory-390",
      "width": 390,
      "role": "ADMIN",
      "family": "taskPaging14",
      "mode": "task-paging-404-revoked-clear",
      "consumer": "inventory",
      "rawNameRule": "exact name"
    },
    {
      "index1": 60,
      "index0": 59,
      "name": "home-decisions-auto-scoped-read-and-queues-320",
      "width": 320,
      "role": "ADMIN",
      "family": "home20",
      "mode": "home-normal",
      "rawNameRule": "exact name"
    },
    {
      "index1": 61,
      "index0": 60,
      "name": "home-decisions-auto-scoped-read-and-queues-390",
      "width": 390,
      "role": "ADMIN",
      "family": "home20",
      "mode": "home-normal",
      "rawNameRule": "exact name"
    },
    {
      "index1": 62,
      "index0": 61,
      "name": "home-decisions-auto-scoped-read-and-queues-768",
      "width": 768,
      "role": "ADMIN",
      "family": "home20",
      "mode": "home-normal",
      "rawNameRule": "exact name"
    },
    {
      "index1": 63,
      "index0": 62,
      "name": "home-decisions-auto-scoped-read-and-queues-1440",
      "width": 1440,
      "role": "ADMIN",
      "family": "home20",
      "mode": "home-normal",
      "rawNameRule": "exact name"
    },
    {
      "index1": 64,
      "index0": 63,
      "name": "home-decisions-director-390",
      "width": 390,
      "role": "DIRECTOR",
      "family": "home20",
      "mode": "home-director",
      "rawNameRule": "exact name"
    },
    {
      "index1": 65,
      "index0": 64,
      "name": "home-decisions-no-management-read-WORKER-390",
      "width": 390,
      "role": "WORKER",
      "family": "home20",
      "mode": "home-no-manager",
      "rawNameRule": "exact name"
    },
    {
      "index1": 66,
      "index0": 65,
      "name": "home-decisions-no-management-read-AUDITOR-390",
      "width": 390,
      "role": "AUDITOR",
      "family": "home20",
      "mode": "home-no-manager",
      "rawNameRule": "exact name"
    },
    {
      "index1": 67,
      "index0": 66,
      "name": "home-decisions-only-when-home-active-390",
      "width": 390,
      "role": "ADMIN",
      "family": "home20",
      "mode": "home-inactive",
      "rawNameRule": "exact name"
    },
    {
      "index1": 68,
      "index0": 67,
      "name": "home-decisions-no-false-zero-denied-390",
      "width": 390,
      "role": "ADMIN",
      "family": "home20",
      "mode": "home-denied",
      "rawNameRule": "exact name"
    },
    {
      "index1": 69,
      "index0": 68,
      "name": "home-decisions-no-false-zero-500-390",
      "width": 390,
      "role": "ADMIN",
      "family": "home20",
      "mode": "home-500",
      "rawNameRule": "exact name"
    },
    {
      "index1": 70,
      "index0": 69,
      "name": "home-decisions-no-false-zero-missing-390",
      "width": 390,
      "role": "ADMIN",
      "family": "home20",
      "mode": "home-missing",
      "rawNameRule": "exact name"
    },
    {
      "index1": 71,
      "index0": 70,
      "name": "home-decisions-no-false-zero-foreign-scope-390",
      "width": 390,
      "role": "ADMIN",
      "family": "home20",
      "mode": "home-foreign-scope",
      "rawNameRule": "exact name"
    },
    {
      "index1": 72,
      "index0": 71,
      "name": "home-decisions-no-false-zero-foreign-project-390",
      "width": 390,
      "role": "ADMIN",
      "family": "home20",
      "mode": "home-foreign-project",
      "rawNameRule": "exact name"
    },
    {
      "index1": 73,
      "index0": 72,
      "name": "home-decisions-no-false-zero-negative-390",
      "width": 390,
      "role": "ADMIN",
      "family": "home20",
      "mode": "home-negative",
      "rawNameRule": "exact name"
    },
    {
      "index1": 74,
      "index0": 73,
      "name": "home-decisions-no-false-zero-invalid-date-390",
      "width": 390,
      "role": "ADMIN",
      "family": "home20",
      "mode": "home-invalid-date",
      "rawNameRule": "exact name"
    },
    {
      "index1": 75,
      "index0": 74,
      "name": "home-decisions-no-false-zero-capability-390",
      "width": 390,
      "role": "ADMIN",
      "family": "home20",
      "mode": "home-capability",
      "rawNameRule": "exact name"
    },
    {
      "index1": 76,
      "index0": 75,
      "name": "home-decisions-no-false-zero-missing-evidence-390",
      "width": 390,
      "role": "ADMIN",
      "family": "home20",
      "mode": "home-missing-evidence",
      "rawNameRule": "exact name"
    },
    {
      "index1": 77,
      "index0": 76,
      "name": "home-decisions-no-false-zero-negative-evidence-390",
      "width": 390,
      "role": "ADMIN",
      "family": "home20",
      "mode": "home-negative-evidence",
      "rawNameRule": "exact name"
    },
    {
      "index1": 78,
      "index0": 77,
      "name": "home-decisions-explicit-retry-390",
      "width": 390,
      "role": "ADMIN",
      "family": "home20",
      "mode": "home-retry",
      "rawNameRule": "exact name"
    },
    {
      "index1": 79,
      "index0": 78,
      "name": "home-decisions-late-response-does-not-reenter-hidden-home-390",
      "width": 390,
      "role": "ADMIN",
      "family": "home20",
      "mode": "home-late",
      "rawNameRule": "exact name"
    },
    {
      "index1": 80,
      "index0": 79,
      "name": "identity-entry-no-authorized-obra-390",
      "width": 390,
      "role": "ADMIN",
      "family": "identityEntry6",
      "mode": "identity-none",
      "rawNameRule": "exact name"
    },
    {
      "index1": 81,
      "index0": 80,
      "name": "identity-entry-one-obra-requires-choice-390",
      "width": 390,
      "role": "ADMIN",
      "family": "identityEntry6",
      "mode": "identity-one",
      "rawNameRule": "exact name"
    },
    {
      "index1": 82,
      "index0": 81,
      "name": "identity-entry-two-obras-require-choice-390",
      "width": 390,
      "role": "ADMIN",
      "family": "identityEntry6",
      "mode": "identity-two",
      "rawNameRule": "exact name"
    },
    {
      "index1": 83,
      "index0": 82,
      "name": "identity-entry-foreign-obra-hint-not-opened-390",
      "width": 390,
      "role": "ADMIN",
      "family": "identityEntry6",
      "mode": "identity-foreign",
      "rawNameRule": "exact name"
    },
    {
      "index1": 84,
      "index0": 83,
      "name": "identity-entry-organization-change-390",
      "width": 390,
      "role": "ADMIN",
      "family": "identityEntry6",
      "mode": "identity-organization",
      "rawNameRule": "exact name"
    },
    {
      "index1": 85,
      "index0": 84,
      "name": "identity-entry-generic-start-unchanged-390",
      "width": 390,
      "role": "ADMIN",
      "family": "identityEntry6",
      "mode": "identity-generic",
      "rawNameRule": "exact name"
    }
  ],
  "homeCases": [
    {
      "name": "home-decisions-auto-scoped-read-and-queues-320",
      "width": 320,
      "role": "ADMIN",
      "mode": "home-normal",
      "operationsStatusRequestsAsserted": 4,
      "projectId": "project-a"
    },
    {
      "name": "home-decisions-auto-scoped-read-and-queues-390",
      "width": 390,
      "role": "ADMIN",
      "mode": "home-normal",
      "operationsStatusRequestsAsserted": 4,
      "projectId": "project-a"
    },
    {
      "name": "home-decisions-auto-scoped-read-and-queues-768",
      "width": 768,
      "role": "ADMIN",
      "mode": "home-normal",
      "operationsStatusRequestsAsserted": 4,
      "projectId": "project-a"
    },
    {
      "name": "home-decisions-auto-scoped-read-and-queues-1440",
      "width": 1440,
      "role": "ADMIN",
      "mode": "home-normal",
      "operationsStatusRequestsAsserted": 4,
      "projectId": "project-a"
    },
    {
      "name": "home-decisions-director-390",
      "width": 390,
      "role": "DIRECTOR",
      "mode": "home-director",
      "operationsStatusRequestsAsserted": 1,
      "projectId": "project-a"
    },
    {
      "name": "home-decisions-no-management-read-WORKER-390",
      "width": 390,
      "role": "WORKER",
      "mode": "home-no-manager",
      "operationsStatusRequestsAsserted": 0,
      "projectId": "project-a"
    },
    {
      "name": "home-decisions-no-management-read-AUDITOR-390",
      "width": 390,
      "role": "AUDITOR",
      "mode": "home-no-manager",
      "operationsStatusRequestsAsserted": 0,
      "projectId": "project-a"
    },
    {
      "name": "home-decisions-only-when-home-active-390",
      "width": 390,
      "role": "ADMIN",
      "mode": "home-inactive",
      "operationsStatusRequestsAsserted": 1,
      "projectId": "project-a"
    },
    {
      "name": "home-decisions-no-false-zero-denied-390",
      "width": 390,
      "role": "ADMIN",
      "mode": "home-denied",
      "operationsStatusRequestsAsserted": 1,
      "projectId": "project-a"
    },
    {
      "name": "home-decisions-no-false-zero-500-390",
      "width": 390,
      "role": "ADMIN",
      "mode": "home-500",
      "operationsStatusRequestsAsserted": 1,
      "projectId": "project-a"
    },
    {
      "name": "home-decisions-no-false-zero-missing-390",
      "width": 390,
      "role": "ADMIN",
      "mode": "home-missing",
      "operationsStatusRequestsAsserted": 1,
      "projectId": "project-a"
    },
    {
      "name": "home-decisions-no-false-zero-foreign-scope-390",
      "width": 390,
      "role": "ADMIN",
      "mode": "home-foreign-scope",
      "operationsStatusRequestsAsserted": 1,
      "projectId": "project-a"
    },
    {
      "name": "home-decisions-no-false-zero-foreign-project-390",
      "width": 390,
      "role": "ADMIN",
      "mode": "home-foreign-project",
      "operationsStatusRequestsAsserted": 1,
      "projectId": "project-a"
    },
    {
      "name": "home-decisions-no-false-zero-negative-390",
      "width": 390,
      "role": "ADMIN",
      "mode": "home-negative",
      "operationsStatusRequestsAsserted": 1,
      "projectId": "project-a"
    },
    {
      "name": "home-decisions-no-false-zero-invalid-date-390",
      "width": 390,
      "role": "ADMIN",
      "mode": "home-invalid-date",
      "operationsStatusRequestsAsserted": 1,
      "projectId": "project-a"
    },
    {
      "name": "home-decisions-no-false-zero-capability-390",
      "width": 390,
      "role": "ADMIN",
      "mode": "home-capability",
      "operationsStatusRequestsAsserted": 1,
      "projectId": "project-a"
    },
    {
      "name": "home-decisions-no-false-zero-missing-evidence-390",
      "width": 390,
      "role": "ADMIN",
      "mode": "home-missing-evidence",
      "operationsStatusRequestsAsserted": 1,
      "projectId": "project-a"
    },
    {
      "name": "home-decisions-no-false-zero-negative-evidence-390",
      "width": 390,
      "role": "ADMIN",
      "mode": "home-negative-evidence",
      "operationsStatusRequestsAsserted": 1,
      "projectId": "project-a"
    },
    {
      "name": "home-decisions-explicit-retry-390",
      "width": 390,
      "role": "ADMIN",
      "mode": "home-retry",
      "operationsStatusRequestsAsserted": 2,
      "projectId": "project-a"
    },
    {
      "name": "home-decisions-late-response-does-not-reenter-hidden-home-390",
      "width": 390,
      "role": "ADMIN",
      "mode": "home-late",
      "operationsStatusRequestsAsserted": 2,
      "projectId": "project-a"
    }
  ],
  "identityCases": [
    {
      "name": "identity-entry-no-authorized-obra-390",
      "width": 390,
      "role": "ADMIN",
      "mode": "identity-none"
    },
    {
      "name": "identity-entry-one-obra-requires-choice-390",
      "width": 390,
      "role": "ADMIN",
      "mode": "identity-one",
      "afterExplicitChoice": {
        "requiredWorkspaceProject": "project-a",
        "foreignProjectBoundRequests": 0,
        "identityVisible": true,
        "pressedProjectNames": [
          "Obra sintética de continuidad"
        ]
      }
    },
    {
      "name": "identity-entry-two-obras-require-choice-390",
      "width": 390,
      "role": "ADMIN",
      "mode": "identity-two",
      "afterExplicitChoice": {
        "requiredWorkspaceProject": "project-a",
        "foreignProjectBoundRequests": 0,
        "identityVisible": true,
        "pressedProjectNames": [
          "Obra sintética de continuidad"
        ]
      }
    },
    {
      "name": "identity-entry-foreign-obra-hint-not-opened-390",
      "width": 390,
      "role": "ADMIN",
      "mode": "identity-foreign"
    },
    {
      "name": "identity-entry-organization-change-390",
      "width": 390,
      "role": "ADMIN",
      "mode": "identity-organization"
    },
    {
      "name": "identity-entry-generic-start-unchanged-390",
      "width": 390,
      "role": "ADMIN",
      "mode": "identity-generic"
    }
  ],
  "sourceDerivedHomeOperationsRequestTotal": 32,
  "screenshots": {
    "count": 78,
    "rows": [
      {
        "index1": 1,
        "path": "overview-before-checks-390.png",
        "width": 390,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 2,
        "path": "overview-before-checks-1440.png",
        "width": 1440,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 3,
        "path": "overview-390.png",
        "width": 390,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 4,
        "path": "identity-deep-390.png",
        "width": 390,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 5,
        "path": "legacy-schedule-390.png",
        "width": 390,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 6,
        "path": "limited-role-390.png",
        "width": 390,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 7,
        "path": "draft-before-390.png",
        "width": 390,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 8,
        "path": "draft-after-390.png",
        "width": 390,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 9,
        "path": "project-picker-before-390.png",
        "width": 390,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 10,
        "path": "project-picker-after-390.png",
        "width": 390,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 11,
        "path": "company-plan-company-without-selection-390.png",
        "width": 390,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 12,
        "path": "company-plan-empty-company-390.png",
        "width": 390,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 13,
        "path": "wizard-front-390.png",
        "width": 390,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 14,
        "path": "wizard-back-390.png",
        "width": 390,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 15,
        "path": "wizard-final-before-390.png",
        "width": 390,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 16,
        "path": "wizard-uncertain-after-390.png",
        "width": 390,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 17,
        "path": "overview-1440.png",
        "width": 1440,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 18,
        "path": "identity-deep-1440.png",
        "width": 1440,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 19,
        "path": "legacy-schedule-1440.png",
        "width": 1440,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 20,
        "path": "limited-role-1440.png",
        "width": 1440,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 21,
        "path": "draft-before-1440.png",
        "width": 1440,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 22,
        "path": "draft-after-1440.png",
        "width": 1440,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 23,
        "path": "project-picker-before-1440.png",
        "width": 1440,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 24,
        "path": "project-picker-after-1440.png",
        "width": 1440,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 25,
        "path": "company-plan-company-without-selection-1440.png",
        "width": 1440,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 26,
        "path": "company-plan-empty-company-1440.png",
        "width": 1440,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 27,
        "path": "wizard-front-1440.png",
        "width": 1440,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 28,
        "path": "wizard-back-1440.png",
        "width": 1440,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 29,
        "path": "wizard-final-before-1440.png",
        "width": 1440,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 30,
        "path": "wizard-uncertain-after-1440.png",
        "width": 1440,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 31,
        "path": "continuity-restored-320.png",
        "width": 320,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 32,
        "path": "continuity-restored-390.png",
        "width": 390,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 33,
        "path": "continuity-restored-1440.png",
        "width": 1440,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 34,
        "path": "continuity-list-role-390.png",
        "width": 390,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 35,
        "path": "continuity-list-scope-390.png",
        "width": 390,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 36,
        "path": "continuity-list-missing-390.png",
        "width": 390,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 37,
        "path": "continuity-list-401-390.png",
        "width": 390,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 38,
        "path": "continuity-list-403-390.png",
        "width": 390,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 39,
        "path": "continuity-list-500-390.png",
        "width": 390,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 40,
        "path": "continuity-project-401-390.png",
        "width": 390,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 41,
        "path": "continuity-project-403-390.png",
        "width": 390,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 42,
        "path": "continuity-project-500-390.png",
        "width": 390,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 43,
        "path": "continuity-project-scope-390.png",
        "width": 390,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 44,
        "path": "continuity-project-id-390.png",
        "width": 390,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 45,
        "path": "continuity-project-null-390.png",
        "width": 390,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 46,
        "path": "continuity-truncated-promoted-390.png",
        "width": 390,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 47,
        "path": "continuity-truncated-denied-390.png",
        "width": 390,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 48,
        "path": "continuity-truncated-inactive-390.png",
        "width": 390,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 49,
        "path": "continuity-private-only-390.png",
        "width": 390,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 50,
        "path": "continuity-office-restored-390.png",
        "width": 390,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 51,
        "path": "continuity-late-list-rejected-390.png",
        "width": 390,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 52,
        "path": "continuity-unmounted-late-project-390.png",
        "width": 390,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 53,
        "path": "bootstrap-ready-compact-320.png",
        "width": 320,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null",
        "maximumScrollWidth": "viewport width + 1"
      },
      {
        "index1": 54,
        "path": "bootstrap-ready-open-320.png",
        "width": 320,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null",
        "maximumScrollWidth": "viewport width + 1"
      },
      {
        "index1": 55,
        "path": "bootstrap-ready-compact-390.png",
        "width": 390,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null",
        "maximumScrollWidth": "viewport width + 1"
      },
      {
        "index1": 56,
        "path": "bootstrap-ready-open-390.png",
        "width": 390,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null",
        "maximumScrollWidth": "viewport width + 1"
      },
      {
        "index1": 57,
        "path": "bootstrap-ready-compact-1440.png",
        "width": 1440,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null",
        "maximumScrollWidth": "viewport width + 1"
      },
      {
        "index1": 58,
        "path": "bootstrap-ready-open-1440.png",
        "width": 1440,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null",
        "maximumScrollWidth": "viewport width + 1"
      },
      {
        "index1": 59,
        "path": "task-pages-field-205-320.png",
        "width": 320,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 60,
        "path": "task-pages-inventory-205-320.png",
        "width": 320,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 61,
        "path": "task-pages-field-205-390.png",
        "width": 390,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 62,
        "path": "task-pages-inventory-205-390.png",
        "width": 390,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 63,
        "path": "task-pages-field-205-1440.png",
        "width": 1440,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 64,
        "path": "task-pages-inventory-205-1440.png",
        "width": 1440,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 65,
        "path": "task-pages-field-503-retry-390.png",
        "width": 390,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 66,
        "path": "task-pages-field-403-clear-390.png",
        "width": 390,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 67,
        "path": "task-pages-field-parent-block-390.png",
        "width": 390,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 68,
        "path": "task-pages-inventory-503-retry-390.png",
        "width": 390,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 69,
        "path": "task-pages-inventory-403-clear-390.png",
        "width": 390,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 70,
        "path": "task-pages-inventory-parent-block-390.png",
        "width": 390,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 71,
        "path": "task-pages-field-404-revoked-clear-390.png",
        "width": 390,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 72,
        "path": "task-pages-inventory-404-revoked-clear-390.png",
        "width": 390,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null"
      },
      {
        "index1": 73,
        "path": "home-pending-decisions-320.png",
        "width": 320,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null",
        "maximumScrollWidth": "viewport width + 1"
      },
      {
        "index1": 74,
        "path": "home-pending-decisions-390.png",
        "width": 390,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null",
        "maximumScrollWidth": "viewport width + 1"
      },
      {
        "index1": 75,
        "path": "home-pending-decisions-768.png",
        "width": 768,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null",
        "maximumScrollWidth": "viewport width + 1"
      },
      {
        "index1": 76,
        "path": "home-pending-decisions-1440.png",
        "width": 1440,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null",
        "maximumScrollWidth": "viewport width + 1"
      },
      {
        "index1": 77,
        "path": "identity-entry-one-obra-390.png",
        "width": 390,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null",
        "phase": "BEFORE_EXPLICIT_PROJECT_CHOICE",
        "identityActionTopExpected": null
      },
      {
        "index1": 78,
        "path": "identity-entry-two-obras-390.png",
        "width": 390,
        "viewportHeight": 1000,
        "fullPage": true,
        "geometryKeys": [
          "width",
          "height",
          "scrollWidth",
          "identityActionTop"
        ],
        "scrollWidth": "positive safe integer",
        "identityActionTop": "finite number or null",
        "phase": "BEFORE_EXPLICIT_PROJECT_CHOICE",
        "identityActionTopExpected": null
      }
    ],
    "proofBytesRequiredForIntegrity": true,
    "pngPhysicalHeightIsNotViewportHeight": true
  },
  "requestFactShapes": {
    "general": [
      "width",
      "role",
      "mode",
      "path",
      "method",
      "projectId"
    ],
    "wizardAdded": [
      "operationId",
      "explicitFinalStep",
      "syntheticImageSha256",
      "actualRecoveryJournalReferencePreserved",
      "recoveryReferenceSha256"
    ],
    "continuity": [
      "width",
      "role",
      "mode",
      "path",
      "method",
      "projectId",
      "phase",
      "responseStatus"
    ],
    "bootstrap": [
      "width",
      "role",
      "mode",
      "path",
      "method",
      "projectId"
    ],
    "taskPaging": [
      "width",
      "role",
      "mode",
      "consumer",
      "path",
      "method",
      "projectId",
      "scope",
      "afterTask",
      "responseStatus"
    ]
  }
};
const matrix=structuredClone(historical59.requestMatrix);
if(matrix.length!==406||createHash('sha256').update(JSON.stringify(matrix)).digest('hex')!=='1625cbbd3a610f3a53433bfd17ccb4d9fc1ceff4920487b52f8c78f0fc8a932d')throw new Error('Frozen historical406 changed');
export const CURRENT85_SPEC=freeze({...declared,frozenHistory:{legacy59RequestCount:406,legacy59Requests:matrix,legacy59RequestFieldsOmitted:[...historical59.requestProjectionFieldsOmitted],legacy59MatrixSha256Declared:'1625cbbd3a610f3a53433bfd17ccb4d9fc1ceff4920487b52f8c78f0fc8a932d'}});
export const CURRENT85_CHECK_NAMES=Object.freeze(CURRENT85_SPEC.checks.map(row=>row.name));
export const CURRENT85_UNIT_FILES=Object.freeze([...historical59.unitFiles,'tests/production-focused-workspace-current85-ci.test.mjs']);
