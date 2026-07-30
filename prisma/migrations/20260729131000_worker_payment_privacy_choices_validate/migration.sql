BEGIN;

ALTER TABLE "WorkerPrivacyChoiceEvent"
  VALIDATE CONSTRAINT "WorkerPrivacyChoice_organization_fkey";
ALTER TABLE "WorkerPrivacyChoiceEvent"
  VALIDATE CONSTRAINT "WorkerPrivacyChoice_person_scope_fkey";
ALTER TABLE "WorkerPrivacyChoiceEvent"
  VALIDATE CONSTRAINT "WorkerPrivacyChoice_membership_actor_fkey";
ALTER TABLE "WorkerPrivacyChoiceEvent"
  VALIDATE CONSTRAINT "WorkerPrivacyChoice_channel_actor_fkey";
ALTER TABLE "WorkerPaymentDestination"
  VALIDATE CONSTRAINT "WorkerPayment_privacy_contract_check";
ALTER TABLE "WorkerPaymentDestination"
  VALIDATE CONSTRAINT "WorkerPayment_privacy_choice_scope_fkey";

COMMIT;
