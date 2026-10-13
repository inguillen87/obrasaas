# Company subscription checkout

The customer is the existing canonical `Organization`. Its administrator can
inspect the company plan without creating a project or passing participant KYC.
`/cuenta` mounts `CompanySubscriptionPanel`; the two exact API routes are:

- `/api/identity/company-subscription`: signed Clerk session, current canonical
  membership, both administrator roles and exact company scope. Mutations also
  require the canonical origin.
- `/api/identity/company-subscription/notifications`: bounded JSON, provider
  signature and a server-created verification capability. It never accepts
  body-supplied payment facts as a receipt.

Legacy `/api/billing` routes remain retired. No migration, legacy `Tenant`
subscription or new database is used.

## Commercial configuration

The selected reference is USD 149/month Pro and USD 349/month Enterprise per
company, with one ObraSaaS subscription and no automatically billed extras.
These reference prices are not proof that an Argentine Mercado Pago account
can settle subscriptions in USD. ARS requires an explicitly approved server
quote; the application never computes an exchange rate or takes an amount
from the browser.

The release stays closed until the merchant, offer, tax treatment, terms,
included usage and provider funding arrangement have been approved and verified.
The KYC budgeting reference is ARS 130 for the two selected RENAPER operations
plus a provisional 30% reserve: ARS 169. This is not a BINDX quote or a complete
identity verification cost, and it is not an executable checkout price.

Server-only release settings are `OBRASAAS_COMPANY_SUBSCRIPTION_RELEASE`
(`company-subscription-v1`) and `OBRASAAS_COMPANY_SUBSCRIPTION_CATALOG`, whose
schema is validated by `approvedSubscriptionConfiguration`. The provider needs
`MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_SUBSCRIPTION_MERCHANT_ID`,
`MERCADOPAGO_SUBSCRIPTION_CURRENCY`, `MERCADOPAGO_SUBSCRIPTION_CHECKOUT_HOST`
and `MERCADOPAGO_SUBSCRIPTION_WEBHOOK_SECRET`. Credentials must be entered using
the provider's secure configuration flow, never in source control or evidence.
Missing financial settings keep purchase unavailable. The separate commercial
catalog can display the selected USD references without a merchant or provider
connection. The default catalog has no confirmed tax treatment, included-service
terms or complete contract text, so it cannot be accepted or used for checkout.
Live financial configuration remains restricted to the mapped ObraSaaS Vercel
production project and canonical application URL; a local server or Preview
remains closed even with financial credentials.

### Approved commercial catalog source

`companyCommercialRuntimeCatalog` now supplies the raw immutable catalog to the
production store. Its server-only inputs are independent from the merchant:

- `OBRASAAS_COMPANY_COMMERCIAL_RELEASE`: exactly `company-commercial-v1`.
- `OBRASAAS_COMPANY_COMMERCIAL_CATALOG`: bounded JSON, at most 131072 UTF-8
  bytes, with exactly `version`, `catalogVersion` and `offers`. Use a new
  version, not the pending default version. One or two complete offers are
  supported; an approved Pro-only catalog need not invent Enterprise terms.
- `OBRASAAS_COMPANY_COMMERCIAL_APPROVAL`: JSON at most 4096 UTF-8 bytes, with
  exactly `version:1`, the derived `catalogDigest`, `approvalReference` and
  `fundingEvidenceReference`. References use the existing ASCII identifier
  syntax and point to the operator-reviewed approval and funding dossier.

The loader validates every offer's complete tax/included conditions, contract
text and exact UTF-8 SHA-256. All offers in this configured catalog must be
complete. It preserves CR/LF and Unicode bytes rather than normalizing them.
The shared financial offer schema must accept its exact projection, including
the tax label's 160-character bound. The current adapter also requires at most
13 minor-unit digits and a maximum of 1000000000000. ARS is an explicit amount;
there is no exchange calculation. These checks establish representability,
not evidence that a particular merchant can settle that currency.

Wrong project/origin/target, missing release, incomplete terms, malformed or
oversized JSON, invalid approval references, mismatched digest and unsupported
financial projection return the frozen pending default. Neither approval
reference is exposed through the customer DTO. These references are operator
assertions, not cryptographic proof of an actual contract or funded service;
the supporting agreements and budget must be reviewed before configuration.
No production approval, terms, funding or merchant is created by this change.

The catalog is captured when the server module starts. Changing private
settings requires a new deployment; it is not immediate revocation of every
old process during rollout. Closing this source never closes the independent
financial recovery configuration: previous receipts, reads, reconciliation and
cancellation keep their recorded offer. Current acceptance can be recorded
without a merchant, but checkout still needs exact matching financial terms,
verified payer, provider readiness and the separate durable acceptance receipt.

## Commercial offer and explicit acceptance

The company response adds a separate versioned commercial catalog. Offer and
catalog digests cover the server's immutable amounts, monthly period, included
conditions and exact contract text. `termsSha256` covers the exact UTF-8 text;
JSON formatting or newline normalization does not substitute for that hash.
The browser verifies these hashes before offering an unchecked confirmation.
Incomplete conditions remain pending, even if a financial provider is ready.

An explicit `accept_offer` records an append-only
`company.subscription.offer.accepted` entry in the existing `AuditLog` under
the canonical company transaction. It retains the full server offer and terms,
versions and digests, accepting administrator and membership, company and SQL
timestamp. The browser sends only references, hashes and explicit acceptance;
it cannot supply an amount, merchant, payer or payment facts. The acceptance
does not modify Organization subscription/trial/financial metadata or grant a
paid period, participant admission or identity approval.

Acceptance and financial operations have separate identifiers and recovery
paths. An absent acceptance read does not prove a completed financial
`NO_DISPATCH` closure, release an uncertain reference or authorize a new UUID.
A lost acknowledgment recovers the original acceptance by its operation ID.
Changing company, administrator, offer or terms clears browser confirmation.
Older financial attempts remain readable and recoverable without inventing an
acceptance that was never recorded.

Every new checkout needs an actual current acceptance by the initiating
administrator, matching the immutable financial offer and complete commercial
conditions. It has a different financial UUID. Before external creation, the
server rechecks current authority and the accepted terms; a later catalog
change cannot silently reuse an earlier confirmation. Existing charges can
still be reconciled against their captured offer and verified provider facts.

These changes prepare the contractual flow. They do not activate a merchant,
approve taxes, included limits or provider funding, accept terms for the real
pilot administrator, or certify payment/identity. Real contract and provider
acceptance remain separate operational steps.

## Financial lifecycle

An immutable offer and operation reference are committed to `AuditLog` before
the one-shot external create. Membership, organization and the execution lease
are checked immediately before each external request. A timeout cannot cause a
second create. A validated remote resource ID survives a failed local finish,
including revocation of the initiating administrator, as a passive recovery
reference; it grants no access.

If an explicit recovery finds that no operation was reserved, it commits a
`NO_DISPATCH` closure under the same company lock. A delayed original begin or
cancellation must reject that closure before contacting the provider. Only the
correlated durable closure can settle the browser reference; an ordinary absent
attempt is insufficient. The UI reads the current company again before offering
a new purchase. Already reserved uncertain operations can never take this path.

Recovery only reads a known resource, a bounded complete invoice page, the
selected fresh invoice and the actual current payment. An incomplete or
ambiguous invoice page stays unconfirmed. A signature, provider authorization
or browser return alone never activates a plan. Resource and payment locks
prevent adoption into another company. Webhook replay reservation precedes all
external reads; processed duplicates reuse the stored outcome.

A verified matching approved payment grants its exact monthly UTC interval.
Renewal receipts extend coverage monotonically. An older invoice cannot shorten
a newer period, while a refund or chargeback revokes the matching current
receipt. Cancellation stops provider renewal and preserves already paid access
until the stored interval ends. Existing manual grants retain their registered
entitlement and are not labeled as verified payments.

The browser persists only scope, company, action, operation ID and timestamp
before dispatch, then reads the reference back. It neither persists financial
payloads nor expires uncertainty into permission for another purchase.

## Validation and operational limits

Unit tests exercise the actual adapter with synthetic HTTP, signed events,
durable reconciliation, identity revocation, refunds and missed-webhook recovery.
The dedicated PostgreSQL harness uses a guarded disposable localhost database
and a simulated UTC clock to test real transactions and locks. The DOM harness
copies and hashes the exact JSX dependency closure, intercepts synthetic API
responses, checks 320/390/768/1280 pixels and closes only its own browser/server
before guarded fixture cleanup. None is a real payment or physical-device
acceptance.

Publication of this code does not enable checkout. Activation still needs a
verified merchant/currency, finalized commercial terms, provider funding for
the single-invoice promise and a real purchase/renewal/cancellation acceptance
test. Existing WhatsApp pilot operation is separate. This release does not
claim a uniform runtime paywall or implement usage caps for every module.
