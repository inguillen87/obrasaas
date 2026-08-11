# Implementation plan: tenant privacy control plane

Selected recommendation: `tenant-privacy-control-plane` from
`../proposals/centralize-privacy-lifecycle-control.md`.

Implementation baseline: commit
`3f9fe4ec72216d7a659d68714989e17f3044c0c4`.

The user explicitly requested continued implementation and professionalization
of the PDF-driven roadmap. We therefore begin with the reversible,
non-destructive portion of the recommended option. This plan does not authorize
or claim production erasure.

## Phase PRO-05A: case and discovery foundation

Work packages:

- add tenant-scoped `DataSubjectRequest` and immutable
  `DataSubjectDiscoveryManifest`/item records;
- implement the first route for canonical `WORKER_PERSON` subjects while the
  schema keeps a tenant-member subject kind for a later, separately reviewed adapter;
- require an authenticated administrator and a bounded idempotency key; the
  signed API action records authority attestation for inventory only, never
  requester-identity verification;
- implement a versioned catalog whose adapters return counts and opaque
  references without sensitive values;
- canonicalize and hash each immutable manifest;
- mark unknown JSON, storage, provider and backup scope as blockers;
- expose a private no-store admin API that creates or exactly replays one case
  and performs the bounded discovery pass;
- correct unsupported public 30/90-day technical promises;
- prove zero data mutation, tenant isolation, replay, manifest integrity and
  secret/PII absence in tests.

Acceptance criteria:

- repeated create/discovery with the same idempotency payload does not duplicate
  a request or manifest;
- changing an idempotent payload is rejected;
- a subject outside the active organization is indistinguishable from absent;
- the API never returns encrypted payloads, fingerprints, full identifiers,
  provider payloads, signed URLs or tokens;
- no discovery result can enter an execution state;
- unclassified domains keep the request blocked;
- migrations pass from zero and current upgrade fixtures; Prisma validation,
  tests, lint and production build pass locally.

Rollback:

- disable the discovery route and remove its callers;
- preserve minimal case/manifests for audit while the issue is reviewed;
- do not drop tables until every running release has drained and a separate
  reviewed migration is approved.

## Phase PRO-05B: decisions, holds and clocks

### PRO-05B.1 verified slice

The non-executable control plane is implemented at commit
`871cf2fa940084ad791b7febce494cf57be2e2d6`. It adds proportional requester or
representative verification events, explicit jurisdiction/due-date reviews,
per-item action/basis, narrowly scoped legal holds, maker-checker decisions and
deadline observability. Its canonical product contract is
[`DATA_SUBJECT_DECISION_CONTROL_PLANE.md`](../../../DATA_SUBJECT_DECISION_CONTROL_PLANE.md)
and its immutable Preview record is
[`2026-08-11-preview-871cf2f.md`](../../../evidence/2026-08-11-preview-871cf2f.md).

PostgreSQL 17 CI ran disposable races; Vercel/Neon Preview ran rollback-only
with the disposable flag forced to `0`. The authenticated Preview smoke proved
read-only `ADMIN` access, the `AUDITOR` boundary and signed-out fail-closed
behavior. The queue was empty and no POST or domain mutation was executed.

Every contract remains `executionAllowed: false`. No destructive adapter becomes
available in this phase. Legal entity/matrix approval, a populated synthetic
maker-checker journey, cross-tenant negatives and the whole of PRO-05C/D remain
open; real workers and Production remain NO-GO.

## Phase PRO-05C: domain execution

Implement one adapter per reviewed domain. Each adapter owns row locking,
idempotency, safe retry, audit minimization and its existing append-only
invariants. Start with expired transient bundles; defer conversations, payment
evidence and attendance until their retention matrix and pseudonymization
contracts are approved.

## Phase PRO-05D: providers and restore safety

Add storage and provider propagation receipts, backup inventory, deletion
tombstones, restore quarantine and a drill that proves tombstone replay before
restored data becomes ordinarily accessible.
