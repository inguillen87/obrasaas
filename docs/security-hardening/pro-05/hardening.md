# Security Hardening Review: PRO-05 privacy lifecycle

## Evidence Basis

I inspected the client specification, current Prisma graph, public privacy and
deletion pages, the bounded onboarding-retention worker, and the product's own
traceability documents at commit `3f9fe4e`. The collection is integrity-bound
in [context.md](context.md). It shows a useful local cryptographic-erasure
pattern, but no cross-domain request, discovery, hold, provider or backup
control plane.

The legal references inform the engineering invariants; they are not a
substitute for counsel approving labour, tax and evidentiary retention by
country. Argentina's current law, for example, combines access and correction
rights with explicit exceptions where a legal duty or third-party interest
requires preservation. We therefore cannot safely reduce PRO-05 to a generic
`DELETE` cascade.

## Constraints

We preserve the append-only evidence already protecting identity, payments,
attendance and WhatsApp operations. We also keep destructive execution off
until a verified requester, a versioned discovery manifest, a reviewed legal
basis and domain-specific tests exist. The first phase remains inside the
current Next.js/PostgreSQL deployment and outside interactive field hot paths.

## Opportunity Portfolio

| Opportunity | Evidence | Options | Recommendation | Proposal |
| --- | --- | --- | --- | --- |
| Centralize privacy lifecycle control | Mixed delete constraints, unsupported public deadlines, one bounded local purge, explicit PRO-05 gate | 1. truthful manual runbook; 2. tenant privacy control plane; 3. dedicated orchestrator | Option 2 under current scale and deployment constraints | [Full proposal](proposals/centralize-privacy-lifecycle-control.md) |

## Recommendation Summary

I recommend Option 2, the incremental tenant privacy control plane. The
attractive part of Option 1 is its speed and reversibility, so we should still
take its immediate truthfulness fix. It cannot, however, prove that a worker's
phone, GPS, images, messages, financial data, AI-derived observations and
provider copies were all discovered. Option 3 offers stronger process and
credential isolation, but today it would add queues, network authorization and
a second on-call surface before case volume justifies them.

With Option 2 we can make the first slice deliberately non-destructive: create
a case, verify its tenant and subject, inventory known domains, hash the
manifest, and block on every unknown JSON/provider/backup surface. Later
adapters can reuse the repository's existing bounded, transactional purge
pattern. This materially advances PRO-05 without pretending it is closed.

## Next Decisions

- Approve the controller/processor map and retention matrix with counsel for
  each launch country.
- Assign a verified privacy contact and operational owner before production.
- Keep real worker pilot data gated until access, restriction, erasure,
  provider propagation and backup tombstone replay pass end-to-end tests.
- Reconsider the dedicated service only if volume, organizational ownership or
  credential separation outgrow the in-application control plane.
