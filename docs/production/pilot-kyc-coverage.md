# Bounded identity-document pilot coverage

This feature is separate from commercial subscription coverage. It does not
extend a trial, invent a payment, change a plan or approve identity/admission.
It has no activation side effect on account, identity or usage reads.

## Operator action and scope

`/api/platform/usage-pilot-grants` accepts signed production sessions only. A
strict verifier rejects impersonated sessions. Each operation resolves the
subject's current canonical `PlatformUser.systemRole=SUPERADMIN` in the database.
Organization administrators and legacy service keys do not grant this authority.
The canonical production origin and exact GET/POST route are enforced separately.

POST has `{action: "CREATE" | "REVOKE", input}`. Creation input contains only
`preset`, `operationId`, `organizationId`, `projectId`, `workerId`,
`expectedSubmissionId` and `expectedContentHash`. The preset is
`PILOT_KYC_ONCE_V1`: one reservation, valid for 24 hours from database issuance,
for one existing worker and project, automatic OCR v2 only. Source pin fields
are either both null before that worker's first presentation, or the exact
existing submission and content hash. An existing source must have a runnable
OCR stage and its original consent and submission receipt.

The response supplies exact expiry and current status. One grant may ever be
issued per organization for this preset. A new operation UUID does not renew it.
Exact request replay returns the same receipt; changed replay is rejected.
Revocation is an immutable separate receipt. It does not refund a reservation.

## Reservation and dispatch

Grant creation/revocation and resource reservation use the same organization
usage advisory lock. The reservation binds the immutable grant digest and its
exact canonical resource source. RESERVED, DISPATCHED, UNKNOWN, OBSERVED and
UNMEASURED all consume the slot conservatively. No other person, stage, project,
historical consent or substituted source can use it. A legacy reservation is
never silently assigned a grant.

The final fence checks the issuer's current role, revocation, expiry, source,
consent and bound reservation again. The transition to DISPATCHED additionally
has a database-clock expiry predicate in its UPDATE, so expiry during the checks
cannot authorize a provider call. An uncertain dispatch remains uncertain;
changing the operation, actor, source revision or lease does not release it.

An eligible HELD v2 presentation can resume through existing recovery, using its
original private images, consent and deterministic operation. Completed facial
work remains independent. Neither a new upload nor a personal consent is
fabricated. No general recovery endpoint should be invoked as a read-only check.

## Customer readback

The original commercial coverage snapshot and historical v1/v2 usage envelopes
are retained. Where a grant exists, company usage returns a version 3 envelope
with a separate, non-nominal pilot status. Its read-only lookup does not acquire
row locks or grant authority. The UI displays availability, reservation,
revocation or expiry without representing a paid subscription or provider funds.

## Validation and operational boundary

Unit and boundary tests cover grants, strict session authority, revocation,
source/consent changes, both expiry boundaries, replay/uncertainty, read-only
projection and the exact proxy route. The PostgreSQL runner requires an explicit
disposable local target and creates/removes only its own fixture database. Its
native race and recovery checks must pass before publication or issuing a real
grant. Local tests do not establish production inference, personal acceptance,
identity certification, liveness or attendance authorization.
