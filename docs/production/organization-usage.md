# Organization usage and recoverable schedule imports

The web schedule import and the tenant WhatsApp schedule import share the existing private-source pipeline. For a PDF or image that requests OpenAI analysis, the pipeline records a technical usage receipt in the existing `AuditLog`. This is a record of execution, not a funded allowance, a customer invoice or a new database.

The private source must be stored and verified before the usage reservation. The canonical organization, membership, project access, role and participant admission must pass again before dispatch. All writable paths acquire the organization usage advisory lock before their project lock. No network request runs inside its owning SQL transaction.

The receipt binds the organization, actor, project, draft, operation UUID, stage, source digest, extraction request digest, consent version and requested model. A duplicate request recovers the existing draft and receipt; it does not dispatch another analysis. The existing operation and private-source guards remain in force.

## Observation states

| State | Meaning |
| --- | --- |
| `RESERVED` | A technical reservation exists; dispatch is unconfirmed. |
| `DISPATCHED` | The canonical pre-dispatch fence committed. The provider result is pending. |
| `UNKNOWN` | Dispatch may have occurred, but no usable response was observed. |
| `OBSERVED` | The provider returned internally consistent token counters. |
| `UNMEASURED` | A provider response was observed without usable token counters. |

Response usage is recorded before validating the extracted business rows. A refusal, incomplete extraction, wrong model or invalid schedule does not erase the tokens that the provider reported. Missing usage and network uncertainty do not become zero-cost observations. Model names and provider identifiers are never accepted as proof of identity or payment.

A server-created, in-memory capability permits technical settlement after the initiating membership is revoked. It cannot be recreated from a serialized receipt ID. Settlement does not restore the person's access; subsequent private readback still requires current canonical authorization.

Expiration of the extraction lease does not prove that no provider request occurred. A pending usage receipt stays recoverable, without automatic redispatch. The client retains the selected file and current corrections where possible; private views are discarded on context or access changes. GET recovery does not process another file.

## Coverage and commercial boundaries

Coverage is observed independently of provider funding. A current literal trial can be shown as `TRIAL_CURRENT`; a paid period requires its exact existing verified payment receipt and matching organization, subscription, amount, currency, period and provider resource. An `ACTIVE` organization alone does not prove payment. Incomplete evidence remains `UNCONFIRMED`.

A confirmed expired trial or paid period defers new paid analysis and preserves the confirmed source for authorized consultation. Supported Excel imports continue through the local OOXML parser without an OpenAI usage reservation. This change does not create customer quotas or define a new price.

The account readback is a separate versioned contract restricted to the current canonical company administrator. It shows usage counters and at most 20 recent opaque receipts. It excludes source names, source URLs, prompts, extracted rows, phone numbers, worker documents, raw provider IDs and internal request bindings. This does not alter the financial subscription v1 response.

The approved subscription direction remains one monthly company charge. Provider financing is `UNCONFIRMED`, capacity is `CONTRACT_PENDING` and cost is `null` until the commercial configuration is approved. No automatic extra invoice or separate vendor charge is created. These receipts alone do not certify that an unlimited all-inclusive offer is financially sustainable.

## Verification and acceptance

The dedicated workflow uses the existing pinned disposable PostgreSQL image and injected synthetic HTTP responses. It must verify the actual web and WhatsApp compositions, concurrent lock ordering, exact replay, revocation fences, token observation before business validation, unknown-result retention and source preservation. The DOM fixture checks desktop and mobile viewports with owned IPC cleanup.

Source-bound fixture evidence proves the implementation against those contracts. It does not prove a live customer OpenAI charge, provider funding, professional KYC certification, Meta Advanced Access, physical field operation or human acceptance. Those remain separate release and pilot checks.
