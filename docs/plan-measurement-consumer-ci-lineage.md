The physical source import adds `plan-measurement-policy.mjs` and
`plan-measurement-source.mjs` to three existing native dependency graphs:
organization usage 113 → 115, consumption feedback 108 → 110, and KYC reply
feedback 109 → 111. Their existing native producers and 16/23/8 check groups
remain unchanged. The UI graphs remain 26/20/3 sources.

The pure `plan-measurement-consumer-lineage-v1` guard checks each exact current
path set, removes only these two named additions to compare the immutable prior
path-set hash, and checks the previous producer's LF body hash. Raw native
source manifests still match every expected committed Git blob. The aggregate
receipt includes the raw hashes of both additions and the CI-only helper; that
helper is excluded from the native execution graph because the producer never
imports it.

Previous native receipts cannot certify the enlarged source graph. Missing,
duplicate, reordered and same-count substituted paths, missing committed bytes,
and a producer resealed after a body change are denied. Existing earlier
document, civil and own-report source fixtures remain intact and are compared
after removing only the known later additions. Local fixtures and tests do not
certify production publication, real documents or human acceptance.
