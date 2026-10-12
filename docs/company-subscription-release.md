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
Missing settings provide no offer or purchase button. Live configuration is
also restricted to the mapped ObraSaaS Vercel production project and canonical
application URL; a local server or Preview remains closed even with those keys.

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
