# Identity and worksite media usage

This extends the existing organization ledger to the actual Worker OCR and
Incident photo, audio and sampled-video engines. It reuses AuditLog, private Blob,
canonical membership, project authorization and current provider configuration.
It does not provision a database, provider account, financial account or KYC
certification. The internal biometric adapter is not reported as an OpenAI call.

## Dispatch and recovery

The server binds version 2 to organization, actor, project, Worker/Incident,
resource revision digest, source SHA, operation, stage, request digest, actual
notice and requested model. The source is already confirmed privately. Each
actual provider dispatch takes the organization advisory lock before Project,
then rechecks current authority, current consent and the owned processing lease.
Reservation and DISPATCHED are committed before the external transfer.

A RESERVED record can be recovered because no provider transfer was admitted.
Recovery and the final fence both check another pending dispatch for the same
organization/project/resource/source/stage. Changing actor, operation, revision
or caption cannot release DISPATCHED or UNKNOWN. The server does not claim that
an uncertain result was free, lost, completed, cancelled or safe to replay.

Technical observation uses an in-memory capability minted by this store. It can
settle the already-admitted receipt after membership, consent or lease changes;
it cannot recover private files, return OCR fields, admit a person or grant a
role. Final business output still requires the current resource and permissions.
Already settled observations are idempotent; a conflicting fact is rejected.

## Provider facts

Chat Completions usage is normalized before refusal, JSON or business validation.
Transcriptions distinguish valid token usage from provider-reported billable
`usage.seconds`. File bytes, request time and top-level audio duration do not
supply a billable duration. Missing units remain UNMEASURED; transport or bounded
response uncertainty remains UNKNOWN. Neither state implies a zero cost.

Video transcription and visual sampling have separate receipts and consents.
A valid visual result can remain available for human review when its optional
audio stage is unconfirmed. The result explicitly retains those limitations;
it does not invent transcript, speaker, progress, attendance or quantities.

## Client and human review

`GET /api/identity/company-usage` uses independent DTO version 2, with legacy
version 1 still accepted by the client. It totals token units and audio seconds
separately and labels the six analysis stages. It omits private source names,
documents, prompts, URLs, resource/subject identifiers and provider identifiers.
Cost remains null, capacity CONTRACT_PENDING and funding UNCONFIRMED.

OCR recovery uses the exact authenticated `detail=ocr-usage`, Worker, submission
and operation. Field recovery uses operation and evidence together. Both preserve
current authorization and distinguish a held provider operation from a completed
business receipt. A consultation does not repeat a provider request. Pending UI
does not re-enable retransmission merely because a lease or a GET expired.

Unconfirmed field analysis preserves the original and allows an independently
authorized human to review the source. A live processing lease remains exclusive.
Expired analysis can be reviewed only after its resource receipt is verified;
the explicit review rejects later private business finalization while technical
usage can still settle. No analysis automatically changes Gantt progress, stock,
attendance, identity certification, employment access or a payment.

## Verification limits

The dedicated workflow binds the exact source before and after execution, actual
adapter/store tests, native PostgreSQL resource rows, both advisory lock orders,
capability rejection, revocation settlement and owned database cleanup. Its UI
tests use synthetic sessions and API data. These controls do not prove delivery
to a real phone, acceptance of a real document, professional BINDX/RENAPER
identity verification, a funded merchant or physical worksite operation.
