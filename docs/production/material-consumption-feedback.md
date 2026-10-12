# Material consumption feedback

After an authorized participant proposes consumption, the WhatsApp acknowledgement identifies the worksite, material, exact quantity/unit, informing time, proposal ID and receipt. It describes the saved proposal; only an independent authorized review changes stock. Replaying that delivery preserves its original acknowledgement even after later review.

`ESTADO` offers **Mis consumos**, and `CONSUMOS` opens the participant's own history. Pages contain at most five reports; selection, detail, paging and return actions retain the current conversation nonce. Detail shows the current pending/approved/rejected/reversed state and available decision/reversal reasons, timestamps and receipts. An active business draft is preserved until explicit cancellation. These queries do not approve a report or move stock, and do not introduce proactive sends.

The private reader resolves the current tenant, project assignment, participant, reporting permission and canonical approved identity before accessing report rows. Visibility requires both the current worker ID and the immutable original informing account. Reassigning a worker does not transfer history, cursor access or direct-ID access to the replacement account. The same own-reader restriction applies to administrators/directors using the personal WhatsApp route; general web review retains its existing ADMIN/DIRECTOR authorization.

New proposals save their original material name and proposal receipt with the incident, inside the existing transaction. Existing rows may omit those fields. The web labels the mutable linked worker separately from the informing account, shows available review/reversal evidence, and marks incomplete historical events as unconfirmed instead of inventing names, times or receipts. Recovery separates `recordedConsumptionSnapshot` from the current `consumption`; the original receipt and stock effect do not become a claim about a later state.

The change uses the existing organization/project/worker/incident/audit model, encrypted Meta callback/lease/bridge and recovery journal. It adds no migration, provider credentials, commercial activation or production pilot records.

## Acceptance boundaries

- Unit coverage checks conversation contracts, author/worker isolation, immutable material/receipt data, original versus current state and exact decisions.
- The additive native fixture uses an explicitly guarded, owned disposable PostgreSQL database with synthetic canonical identity, real signed callback parsing and encrypted inbox/lease processing. Fifteen groups cover all consumption states, keyset paging, worker reassignment, permissions/revocations, original acknowledgement replay and unchanged stock on reads. It prohibits provider HTTP and closes its pools/database.
- The additive browser fixture renders the exact Next JSX/CSS with synthetic auth/APIs. Twelve cases cover 320/390/768/1280 px, legacy event gaps, receipt/reload recovery, retained unknown UUIDs, denial after visible history/private drafts, and discarded cross-company late responses. It owns and closes only its own IPC server, browser and fixture.
- An additive CI validator binds those receipts to the exact event commit/tree, complete source closures, producer hashes, expected checks and resource cleanup. The existing workspace, access-boundary and measurement suites remain required.

Local/CI acceptance is distinct from real identity presentation/review, customer WhatsApp delivery, and physical field operation. Publication is recorded separately after the final immutable candidate passes CI.
