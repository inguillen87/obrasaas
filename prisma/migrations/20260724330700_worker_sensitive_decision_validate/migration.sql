-- Validate scope references after their low-lock NOT VALID installation.
ALTER TABLE "WorkerPerson"
  VALIDATE CONSTRAINT "WorkerPerson_verifier_membership_fkey";
ALTER TABLE "WorkerPerson"
  VALIDATE CONSTRAINT "WorkerPerson_rejecter_membership_fkey";
ALTER TABLE "WorkerOnboardingClaim"
  VALIDATE CONSTRAINT "WorkerClaim_reviewer_membership_fkey";
ALTER TABLE "WorkerPaymentDestination"
  VALIDATE CONSTRAINT "WorkerPayment_submitter_membership_fkey";
ALTER TABLE "WorkerPaymentDestination"
  VALIDATE CONSTRAINT "WorkerPayment_submitter_channel_fkey";
ALTER TABLE "WorkerPaymentDestination"
  VALIDATE CONSTRAINT "WorkerPayment_verifier_membership_fkey";
ALTER TABLE "WorkerPaymentDestination"
  VALIDATE CONSTRAINT "WorkerPayment_activator_membership_fkey";
ALTER TABLE "WorkerPaymentDestination"
  VALIDATE CONSTRAINT "WorkerPayment_rejecter_membership_fkey";
ALTER TABLE "WorkerPaymentDestination"
  VALIDATE CONSTRAINT "WorkerPayment_revoker_membership_fkey";

-- The old FK already proves every row satisfies the new reference. Swap only
-- after the RESTRICT constraint is valid, so organizationId can never be nulled
-- by deleting a WorkerPerson.
ALTER TABLE "Worker"
  VALIDATE CONSTRAINT "Worker_person_scope_restrict_fkey";
ALTER TABLE "Worker"
  DROP CONSTRAINT "Worker_organizationId_personId_fkey";
ALTER TABLE "Worker"
  RENAME CONSTRAINT "Worker_person_scope_restrict_fkey"
  TO "Worker_organizationId_personId_fkey";

ALTER TABLE "WorkerPaymentDestination"
  VALIDATE CONSTRAINT "WorkerPayment_alias_resolution_check";
ALTER TABLE "WorkerPaymentDestination"
  VALIDATE CONSTRAINT "WorkerPayment_separation_of_duties_check";

-- Legacy decisions may predate membership-scoped actors or evidence hashes.
-- Keep their constraints NOT VALID only when such rows actually exist; either
-- way, PostgreSQL already enforces the policy for every new or changed row.
DO $$
BEGIN
  BEGIN
    ALTER TABLE "WorkerPerson"
      VALIDATE CONSTRAINT "WorkerPerson_identity_decision_actor_check";
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'WorkerPerson legacy decisions require actor/evidence backfill';
  END;

  BEGIN
    ALTER TABLE "WorkerOnboardingClaim"
      VALIDATE CONSTRAINT "WorkerClaim_review_actor_check";
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'WorkerOnboardingClaim legacy reviews require actor/evidence backfill';
  END;

  BEGIN
    ALTER TABLE "WorkerPaymentDestination"
      VALIDATE CONSTRAINT "WorkerPayment_submission_actor_check";
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'WorkerPaymentDestination legacy submissions require maker backfill';
  END;

  BEGIN
    ALTER TABLE "WorkerPaymentDestination"
      VALIDATE CONSTRAINT "WorkerPayment_decision_actor_check";
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'WorkerPaymentDestination legacy decisions require actor backfill';
  END;
END;
$$;

-- The v2/v3 checks are strict supersets of the original v2-only checks. Validate
-- first, then perform a narrow constraint-name swap; no encrypted data is changed.
ALTER TABLE "WorkerPerson"
  VALIDATE CONSTRAINT "WorkerPerson_identity_bundle_v3_check";
ALTER TABLE "WorkerPerson"
  DROP CONSTRAINT "WorkerPerson_identity_bundle_check";
ALTER TABLE "WorkerPerson"
  RENAME CONSTRAINT "WorkerPerson_identity_bundle_v3_check"
  TO "WorkerPerson_identity_bundle_check";

ALTER TABLE "WorkerChannelIdentity"
  VALIDATE CONSTRAINT "WorkerChannelIdentity_encrypted_address_v3_check";
ALTER TABLE "WorkerChannelIdentity"
  DROP CONSTRAINT "WorkerChannelIdentity_encrypted_address_check";
ALTER TABLE "WorkerChannelIdentity"
  RENAME CONSTRAINT "WorkerChannelIdentity_encrypted_address_v3_check"
  TO "WorkerChannelIdentity_encrypted_address_check";

ALTER TABLE "WorkerChannelIdentity"
  VALIDATE CONSTRAINT "WorkerChannelIdentity_provider_subject_v3_check";
ALTER TABLE "WorkerChannelIdentity"
  DROP CONSTRAINT "WorkerChannelIdentity_provider_subject_check";
ALTER TABLE "WorkerChannelIdentity"
  RENAME CONSTRAINT "WorkerChannelIdentity_provider_subject_v3_check"
  TO "WorkerChannelIdentity_provider_subject_check";

ALTER TABLE "WorkerOnboardingClaim"
  VALIDATE CONSTRAINT "WorkerOnboardingClaim_sender_v3_check";
ALTER TABLE "WorkerOnboardingClaim"
  DROP CONSTRAINT "WorkerOnboardingClaim_sender_check";
ALTER TABLE "WorkerOnboardingClaim"
  RENAME CONSTRAINT "WorkerOnboardingClaim_sender_v3_check"
  TO "WorkerOnboardingClaim_sender_check";

ALTER TABLE "WorkerOnboardingClaim"
  VALIDATE CONSTRAINT "WorkerOnboardingClaim_identity_bundle_v3_check";
ALTER TABLE "WorkerOnboardingClaim"
  DROP CONSTRAINT "WorkerOnboardingClaim_identity_bundle_check";
ALTER TABLE "WorkerOnboardingClaim"
  RENAME CONSTRAINT "WorkerOnboardingClaim_identity_bundle_v3_check"
  TO "WorkerOnboardingClaim_identity_bundle_check";

ALTER TABLE "WorkerPaymentDestination"
  VALIDATE CONSTRAINT "WorkerPaymentDestination_encrypted_payload_v3_check";
ALTER TABLE "WorkerPaymentDestination"
  DROP CONSTRAINT "WorkerPaymentDestination_encrypted_payload_check";
ALTER TABLE "WorkerPaymentDestination"
  RENAME CONSTRAINT "WorkerPaymentDestination_encrypted_payload_v3_check"
  TO "WorkerPaymentDestination_encrypted_payload_check";
